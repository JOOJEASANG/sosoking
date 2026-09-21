'use strict';

// Batch verdict generation for demo-seed cases.
// Queries Firestore for userId='demo-seed' pending cases, generates AI verdicts
// via Gemini, and publishes results so they appear on the site.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json \
//   GOOGLE_CLOUD_PROJECT=sosoking-481e6 \
//   node functions/generate-demo-verdicts-cli.js

const { readFileSync } = require('node:fs');
const { createSign } = require('node:crypto');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildPrompt, JUDGES } = require('./verdict-prompt');
const { inspectContent } = require('./content-safety');

if (!getApps().length) initializeApp();
const db = getFirestore();

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash';
const CONCURRENCY = 3;

// ── GCP auth ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${claim}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed ${resp.status}: ${text.slice(0, 200)}`);
  }
  const { access_token } = await resp.json();
  return access_token;
}

async function getSecret(token, secretName) {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretName}/versions/latest:access`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Secret Manager ${resp.status}: ${text.slice(0, 200)}`);
  }
  const { payload } = await resp.json();
  return Buffer.from(payload.data, 'base64').toString('utf8').trim();
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function cleanText(value, maxLen = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanDocument(value, maxLen = 3200) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

function normalizeCaseTitle(value, description = '') {
  let title = cleanText(value, 32).replace(/["""'`]/g, '').replace(/[.!?]+$/, '').trim();
  if (!title || title === 'AI 사건명 작성 중') {
    title = cleanText(description, 24)
      .replace(/^(오늘|어제|방금|아까|제가|나는|저는)\s*/g, '')
      .replace(/[.!?].*$/, '')
      .replace(/(했어요|했습니다|했다|해요|합니다|인데요|인데)$/, '')
      .trim();
  }
  if (!title) title = '정체불명 생활분쟁';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return cleanText(title, 32);
}

function normalizeWinner(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ['plaintiff', 'defendant', 'both'].includes(raw) ? raw : 'both';
}

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed?.caseTitle, description),
    winner: normalizeWinner(parsed?.winner),
    tags: Array.isArray(parsed?.tags) ? parsed.tags.slice(0, 5) : [],
    reception: cleanDocument(parsed?.reception, 1500),
    investigation: cleanDocument(parsed?.investigation, 2500),
    plaintiffArg: cleanDocument(parsed?.plaintiffArg, 1500),
    defendantArg: cleanDocument(parsed?.defendantArg, 1500),
    verdict: cleanDocument(parsed?.verdict, 2500)
  };
}

function hasRequiredSections(data) {
  return Boolean(
    data
    && data.caseTitle.length >= 4
    && data.reception.length >= 60
    && data.investigation.length >= 120
    && data.plaintiffArg.length >= 60
    && data.defendantArg.length >= 60
    && data.verdict.length >= 80
  );
}

function safeJson(text) {
  const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON 형식 없음');
  return JSON.parse(raw.slice(start, end + 1));
}

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectJudge(caseId, existingType = '') {
  const existing = JUDGES.find(j => j.type === existingType);
  if (existing) return existing;
  return JUDGES[hashString(caseId) % JUDGES.length];
}

// ── Gemini call ───────────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    caseTitle: { type: 'string' },
    winner: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    reception: { type: 'string' },
    investigation: { type: 'string' },
    plaintiffArg: { type: 'string' },
    defendantArg: { type: 'string' },
    verdict: { type: 'string' }
  },
  required: ['caseTitle', 'winner', 'reception', 'investigation', 'plaintiffArg', 'defendantArg', 'verdict']
};

async function callGemini(apiKey, modelName, prompt) {
  const generationConfig = {
    temperature: 0.95,
    topP: 0.9,
    maxOutputTokens: 32768,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA
  };
  if (/2\.5-(pro|flash)$/.test(modelName)) {
    generationConfig.thinkingConfig = { thinkingBudget: 2048 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${JSON.stringify(payload?.error?.message || '').slice(0, 200)}`);

    const parts = payload?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map(p => p?.text || '').join('\n').trim() : '';
    if (!text) throw new Error('Gemini 응답 없음');
    if (payload?.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Error('출력 잘림 (MAX_TOKENS)');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ── Core per-case logic ───────────────────────────────────────────────────────

async function generateVerdict(apiKey, caseId, caseData) {
  const description = cleanText(caseData.caseDescription, 600);
  const judge = selectJudge(caseId, caseData.judgeType);
  const grievanceIndex = Number.isInteger(caseData.grievanceIndex) && caseData.grievanceIndex >= 1 && caseData.grievanceIndex <= 10
    ? caseData.grievanceIndex
    : Math.floor(Math.random() * 10) + 1;

  const safety = inspectContent(description);
  if (!safety.safe) throw new Error(`content blocked: ${safety.message}`);

  const text = await callGemini(apiKey, MODEL, buildPrompt(description, judge, grievanceIndex, false));
  const candidate = normalizeResult(safeJson(text), description);
  if (!hasRequiredSections(candidate)) throw new Error('필수 판결문 섹션 누락');

  const generatedSafety = inspectContent([
    candidate.caseTitle, candidate.reception, candidate.investigation,
    candidate.plaintiffArg, candidate.defendantArg, candidate.verdict
  ].filter(Boolean).join('\n'));
  if (!generatedSafety.safe) throw new Error(`생성 콘텐츠 차단: ${generatedSafety.message}`);

  const finalTitle = normalizeCaseTitle(candidate.caseTitle, description);
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);

  const batch = db.batch();
  batch.set(resultRef, {
    source: 'demo',
    isPublic: true,
    docketNumber: caseData.docketNumber || '',
    courtName: '소소킹 판결소',
    courtroom: '제50담4호 생활법정',
    division: '제3생활부',
    caseTitle: finalTitle,
    caseDescription: caseData.caseDescription || '',
    nickname: caseData.nickname || '익명 원고',
    judgeType: judge.type,
    judgeIcon: judge.icon,
    judgeStyle: judge.style,
    grievanceIndex,
    winner: candidate.winner,
    tags: candidate.tags,
    reception: candidate.reception,
    investigation: candidate.investigation,
    plaintiffArg: candidate.plaintiffArg,
    defendantArg: candidate.defendantArg,
    verdict: candidate.verdict,
    sentence: '',
    aiSource: 'gemini-rest',
    aiModel: MODEL,
    aiFallbackReason: '',
    promptVersion: 'verdict-v2-permissive-comedy',
    contentSafetyStatus: 'passed',
    contentSafetyCheckedAt: FieldValue.serverTimestamp(),
    groundingStatus: 'input-grounded',
    reactionTotal: 0,
    commentCount: 0,
    courtStage: 'sentenced',
    createdAt: caseData.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.update(caseRef, {
    caseTitle: finalTitle,
    status: 'completed',
    courtStage: 'sentenced',
    judgeType: judge.type,
    judgeIcon: judge.icon,
    judgeStyle: judge.style,
    grievanceIndex,
    isPublic: true,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    processingStartedAt: FieldValue.delete(),
    errorMessage: FieldValue.delete(),
    aiErrorCode: FieldValue.delete()
  });

  await batch.commit();
  return { finalTitle, judgeType: judge.type };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!SA_PATH) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS not set.');
    process.exit(1);
  }

  console.log('Fetching Gemini API key from Secret Manager...');
  const token = await getAccessToken();
  const apiKey = await getSecret(token, 'GEMINI_API_KEY');
  console.log('API key retrieved.');

  const snap = await db.collection('cases')
    .where('userId', '==', 'demo-seed')
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) {
    console.log('No pending demo cases found. Run seed-demo-cases-cli.js first.');
    return;
  }

  const docs = snap.docs;
  console.log(`Found ${docs.length} pending demo case(s). Generating verdicts (concurrency=${CONCURRENCY})...`);

  let done = 0;
  let failed = 0;

  async function processOne(doc) {
    const id = doc.id;
    const data = doc.data();
    try {
      const result = await generateVerdict(apiKey, id, data);
      done++;
      console.log(`  [OK] ${result.finalTitle} (${result.judgeType})`);
    } catch (err) {
      failed++;
      console.error(`  [FAIL] ${data.caseTitle}: ${err.message}`);
    }
  }

  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    await Promise.all(docs.slice(i, i + CONCURRENCY).map(processOne));
  }

  console.log(`\nDone: ${done} succeeded, ${failed} failed out of ${docs.length} total.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
