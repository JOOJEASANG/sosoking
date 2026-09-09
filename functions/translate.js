'use strict';

// 미친 번역소: 입력 텍스트 → 선택 모드로 병맛 번역. 결과는 Firestore에 저장.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { requireAppCheck, enforceActionRateLimit, reserveAiRequest } = require('./security');
const { inspectContent } = require('./content-safety');
const { TRANSLATION_MODES, buildTranslationPrompt } = require('./translate-prompt');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = String(process.env.TRANSLATE_MODELS || 'gemini-2.5-flash,gemini-2.5-flash-lite')
  .split(',').map(s => s.trim()).filter(Boolean);

function clean(value, maxLen) {
  return String(value || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    translated: { type: 'string' },
    style_note: { type: 'string' },
    tagline: { type: 'string' }
  },
  required: ['translated', 'style_note', 'tagline']
};

function safeJson(text) {
  const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw Object.assign(new Error('JSON 형식을 찾을 수 없습니다.'), { code: 'JSON_NOT_FOUND' });
  return JSON.parse(raw.slice(start, end + 1));
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(p => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean).join('\n').trim();
}

async function callGemini(apiKey, modelName, prompt) {
  const generationConfig = {
    temperature: 1.0,
    topP: 0.95,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA
  };
  if (/2\.5-(pro|flash)$/.test(modelName)) generationConfig.thinkingConfig = { thinkingBudget: 512 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }),
        signal: controller.signal
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(
        new Error(clean(payload?.error?.message, 300) || `Gemini ${response.status}`),
        { code: `GEMINI_HTTP_${response.status}` }
      );
    }
    const finishReason = clean(payload?.candidates?.[0]?.finishReason, 40);
    const text = extractText(payload);
    if (!text) {
      const blocked = clean(payload?.promptFeedback?.blockReason, 80);
      throw Object.assign(new Error('Gemini 응답 본문이 없습니다.'), { code: blocked ? 'CONTENT_BLOCKED' : 'EMPTY_RESPONSE' });
    }
    return { text, finishReason, usage: payload?.usageMetadata || {} };
  } finally {
    clearTimeout(timer);
  }
}

async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch (_) {
    return {};
  }
}

async function logUsage(totals) {
  try {
    await db.doc('usage_stats/translate').set({
      totalAttempts: FieldValue.increment(totals.attempts),
      totalSuccess: FieldValue.increment(totals.success),
      totalInTokens: FieldValue.increment(totals.inTok),
      totalOutTokens: FieldValue.increment(totals.outTok),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (_) {}
}

function normalizeResult(parsed) {
  return {
    translated: clean(parsed?.translated, 500) || '번역기가 잠시 폭발했습니다.',
    style_note: clean(parsed?.style_note, 80) || '',
    tagline: clean(parsed?.tagline, 100) || ''
  };
}

exports.generateTranslation = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 120,
  memory: '256MiB'
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  requireAppCheck(request);

  const uid = request.auth.uid;
  const text = clean(request.data?.text, 300);
  const modeId = clean(request.data?.modeId, 20);
  const mode = TRANSLATION_MODES.find(m => m.id === modeId) || TRANSLATION_MODES[0];

  if (text.length < 2) throw new HttpsError('invalid-argument', '번역할 내용을 조금만 더 입력해주세요.');

  const safety = inspectContent(text);
  if (!safety.safe) {
    return { safe: false, code: clean(safety.code, 60) || 'UNSAFE', message: clean(safety.message, 300) };
  }

  const settings = await loadSettings();
  const provider = request.auth.token?.firebase?.sign_in_provider || '';
  const isAnonymous = provider === 'anonymous';
  const anonLimit = clampInt(settings.translateAnonDailyLimit, 5, 1, 100);
  const memberLimit = clampInt(settings.translateUserDailyLimit, 20, 1, 1000);
  const dailyLimit = isAnonymous ? anonLimit : memberLimit;

  try {
    await enforceActionRateLimit(uid, 'translate', { cooldownSeconds: 3, dailyLimit });
  } catch (err) {
    if (isAnonymous && err instanceof HttpsError && err.code === 'resource-exhausted') {
      throw new HttpsError('resource-exhausted', `오늘 무료 번역 ${anonLimit}회를 다 썼어요. 로그인하면 하루 ${memberLimit}회까지 번역할 수 있어요!`);
    }
    throw err;
  }

  try {
    await reserveAiRequest(uid, 'translate', settings);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('resource-exhausted', clean(err?.message, 200) || '오늘 번역 한도를 확인할 수 없습니다.');
  }

  const apiKey = clean(geminiKey.value(), 500);
  if (!apiKey) throw new HttpsError('failed-precondition', '번역소 설정이 아직 준비되지 않았습니다.');

  const configured = clean(settings.geminiModel, 60);
  const models = [...new Set([configured, ...DEFAULT_MODELS].filter(Boolean))];
  const totals = { attempts: 0, success: 0, inTok: 0, outTok: 0 };
  let result = null;

  for (let i = 0; i < models.length; i += 1) {
    try {
      totals.attempts += 1;
      const raw = await callGemini(apiKey, models[i], buildTranslationPrompt(text, mode));
      totals.success += 1;
      totals.inTok += Number(raw.usage.promptTokenCount || 0);
      totals.outTok += Number(raw.usage.candidatesTokenCount || 0);

      const candidate = normalizeResult(safeJson(raw.text));
      if (candidate.translated.length < 2) throw Object.assign(new Error('번역 결과가 부족합니다.'), { code: 'OUTPUT_INCOMPLETE' });

      const outSafety = inspectContent([candidate.translated, candidate.style_note, candidate.tagline].join('\n'));
      if (!outSafety.safe) throw Object.assign(new Error('출력 안전검사 실패'), { code: 'UNSAFE_OUTPUT' });

      result = candidate;
      break;
    } catch (err) {
      console.error('generateTranslation attempt failed:', {
        model: models[i],
        code: clean(err?.code, 60),
        message: clean(err?.message, 200)
      });
      if (['API_KEY_MISSING', 'GEMINI_HTTP_401', 'GEMINI_HTTP_403', 'GEMINI_HTTP_429'].includes(clean(err?.code, 60))) break;
    }
  }

  await logUsage(totals);
  if (!result) throw new HttpsError('unavailable', '번역기가 잠시 뇌를 재부팅 중입니다. 잠시 후 다시 시도해 주세요.');

  let resultId = null;
  try {
    const docRef = db.collection('translation_results').doc();
    await docRef.set({
      uid,
      modeId: mode.id,
      modeLabel: mode.label,
      originalText: text,
      translated: result.translated,
      style_note: result.style_note,
      tagline: result.tagline,
      createdAt: FieldValue.serverTimestamp()
    });
    resultId = docRef.id;
  } catch (_) {}

  return {
    safe: true,
    modeId: mode.id,
    modeLabel: mode.label,
    modeEmoji: mode.emoji,
    result: { ...result, resultId }
  };
});
