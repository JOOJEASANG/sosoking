const { onCall } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');

function cleanText(value, maxLength = 200) {
  return String(value || '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function extractJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function fallbackCase() {
  return {
    title: '삭제된 7분의 출입기록',
    setting: '공용 작업실 출입 시스템에서 7분간의 기록이 사라졌습니다.',
    suspectClaim: '저는 그 시간에 작업실 근처에도 가지 않았습니다.',
    escapePlan: '출입기록 공백을 시스템 오류로 몰고, 현장 흔적은 이전 사용자 탓으로 돌린다.',
    locations: [
      { id: 'door', icon: '🚪', name: '출입문 로그', clue: '기록은 02:13부터 02:20까지만 비어 있습니다. 앞뒤 기록은 정상입니다.', pressure: 16, escape: -10 },
      { id: 'router', icon: '📡', name: '공유기 접속기록', clue: 'AI 용의자 기기가 02:16에 작업실 와이파이에 접속했습니다.', pressure: 24, escape: -18 },
      { id: 'desk', icon: '🪑', name: '작업대 흔적', clue: '작업대 위 파일명이 용의자의 평소 명명 규칙과 일치합니다.', pressure: 14, escape: -8 },
      { id: 'backup', icon: '💾', name: '백업 로그', clue: '삭제된 7분 동안에도 백업 서버에는 파일 접근 흔적이 남아 있습니다.', pressure: 28, escape: -22 }
    ],
    statements: [
      '그 시간에는 시스템이 불안정해서 기록이 믿을 수 없습니다.',
      '와이파이 접속은 자동 연결일 수 있습니다.',
      '파일명은 누구나 비슷하게 쓸 수 있습니다.',
      '백업 로그가 있다고 해도 제가 직접 조작했다는 뜻은 아닙니다.'
    ],
    contradictions: [
      { statementKey: '근처에도 가지 않았습니다', evidenceId: 'router', result: '근처에 가지 않았다는 진술과 02:16 와이파이 접속기록이 충돌합니다.', pressure: 32, escape: -28 },
      { statementKey: '기록이 믿을 수 없습니다', evidenceId: 'backup', result: '출입기록은 사라졌지만 백업 서버에는 같은 시간 접근 흔적이 남았습니다.', pressure: 36, escape: -32 }
    ],
    arrestEvidence: ['router', 'backup'],
    successLine: 'AI의 “현장에 없었다”는 도주 계획은 접속기록과 백업 로그 앞에서 무너졌습니다.',
    failLine: 'AI는 출입기록 공백을 시스템 오류로 밀어붙이며 수사망을 빠져나갔습니다.'
  };
}

function normalizeAiHuntCase(raw) {
  const fb = fallbackCase();
  const data = raw && typeof raw === 'object' ? raw : fb;
  const locations = Array.isArray(data.locations) ? data.locations.slice(0, 4).map((x, i) => ({
    id: cleanText(x.id || `clue${i + 1}`, 24).replace(/[^a-zA-Z0-9_-]/g, '') || `clue${i + 1}`,
    icon: cleanText(x.icon || ['🚪','📡','💻','💾'][i] || '🔎', 4),
    name: cleanText(x.name || fb.locations[i]?.name || `단서 ${i + 1}`, 24),
    clue: cleanText(x.clue || fb.locations[i]?.clue || '단서가 발견됐습니다.', 140),
    pressure: Math.max(8, Math.min(35, Number(x.pressure || 16))),
    escape: Math.max(-35, Math.min(-5, Number(x.escape || -10)))
  })) : fb.locations;
  while (locations.length < 4) locations.push(fb.locations[locations.length]);

  const statements = Array.isArray(data.statements) ? data.statements.slice(0, 4).map(s => cleanText(s, 80)).filter(Boolean) : fb.statements;
  while (statements.length < 4) statements.push(fb.statements[statements.length]);

  const contradictions = Array.isArray(data.contradictions) ? data.contradictions.slice(0, 2).map((x, i) => ({
    statementKey: cleanText(x.statementKey || statements[i] || '진술', 35),
    evidenceId: locations.some(l => l.id === x.evidenceId) ? x.evidenceId : locations[Math.min(i + 1, locations.length - 1)].id,
    result: cleanText(x.result || fb.contradictions[i]?.result || 'AI 진술과 단서가 충돌합니다.', 150),
    pressure: Math.max(20, Math.min(45, Number(x.pressure || 32))),
    escape: Math.max(-40, Math.min(-15, Number(x.escape || -28)))
  })) : fb.contradictions;

  const arrestEvidence = Array.isArray(data.arrestEvidence)
    ? data.arrestEvidence.filter(id => locations.some(l => l.id === id)).slice(0, 2)
    : contradictions.map(c => c.evidenceId).slice(0, 2);
  while (arrestEvidence.length < 2) arrestEvidence.push(locations[arrestEvidence.length + 1]?.id || locations[0].id);

  return {
    title: cleanText(data.title || fb.title, 36),
    setting: cleanText(data.setting || fb.setting, 120),
    suspectClaim: cleanText(data.suspectClaim || fb.suspectClaim, 90),
    escapePlan: cleanText(data.escapePlan || fb.escapePlan, 140),
    locations,
    statements,
    contradictions,
    arrestEvidence,
    successLine: cleanText(data.successLine || fb.successLine, 160),
    failLine: cleanText(data.failLine || fb.failLine, 160)
  };
}

function buildAiHuntPrompt() {
  return `당신은 "AI 30분 검거" 브레인 수사게임의 사건 설계자입니다.
AI 용의자가 이미 사건을 일으키고 도주 계획까지 세운 상태입니다.
유저는 30분 안에 단서와 진술의 모순을 찾아 AI를 검거해야 합니다.

중요한 톤:
- 치킨 마지막 조각, 감자튀김, 100원 정산처럼 유치한 사건 금지
- 실제 중범죄, 폭력, 성적 내용, 정치, 혐오, 실명 비방 금지
- 생활 밀착형이지만 지적인 미스터리 느낌
- 출입기록, 삭제 로그, 알림 시간, 접속기록, 예약 변경, 택배함 기록처럼 현실적인 단서 사용
- AI는 "시스템 오류", "자동 연결", "동기화 지연", "기억 오류", "제3자 가능성" 등으로 빠져나가려 함

반드시 아래 JSON만 출력하세요. 코드블록/설명 금지.
{
  "title": "36자 이내 사건명",
  "setting": "사건 상황 설명 120자 이내",
  "suspectClaim": "AI 용의자 첫 진술 90자 이내",
  "escapePlan": "AI의 숨겨진 도주 계획 140자 이내",
  "locations": [
    { "id": "영문id", "icon": "이모지", "name": "조사 지점명", "clue": "해당 지점에서 나오는 단서", "pressure": 16, "escape": -10 },
    { "id": "영문id", "icon": "이모지", "name": "조사 지점명", "clue": "해당 지점에서 나오는 단서", "pressure": 24, "escape": -18 },
    { "id": "영문id", "icon": "이모지", "name": "조사 지점명", "clue": "해당 지점에서 나오는 단서", "pressure": 14, "escape": -8 },
    { "id": "영문id", "icon": "이모지", "name": "조사 지점명", "clue": "해당 지점에서 나오는 결정적 단서", "pressure": 30, "escape": -24 }
  ],
  "statements": ["AI 방어 진술 1", "AI 방어 진술 2", "AI 방어 진술 3", "AI 방어 진술 4"],
  "contradictions": [
    { "statementKey": "진술 핵심 문구", "evidenceId": "locations 중 하나의 id", "result": "왜 모순인지 설명", "pressure": 32, "escape": -28 },
    { "statementKey": "진술 핵심 문구", "evidenceId": "locations 중 하나의 id", "result": "왜 모순인지 설명", "pressure": 36, "escape": -32 }
  ],
  "arrestEvidence": ["결정적 evidence id 1", "결정적 evidence id 2"],
  "successLine": "검거 성공 시 한 줄 설명",
  "failLine": "검거 실패 시 AI가 빠져나간 이유"
}`;
}

function calcRank(success, data) {
  const wrongMoves = Number(data.wrongMoves || 0);
  const pressure = Number(data.pressure || 0);
  if (!success) return pressure >= 65 ? '미완의 추적자' : '수사망 미완성';
  if (wrongMoves === 0 && pressure >= 90) return 'S급 검거관';
  if (pressure >= 80) return 'A급 수사관';
  return 'B급 추적관';
}

const startAiHuntCase = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60, memory: '512MiB' }, async (request) => {
  const userId = request.auth?.uid || 'anonymous';
  let caseData;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
    });
    const result = await model.generateContent(buildAiHuntPrompt());
    caseData = normalizeAiHuntCase(extractJson(result.response.text()));
  } catch (err) {
    caseData = normalizeAiHuntCase(fallbackCase());
  }

  const now = Date.now();
  const expiresAt = now + 30 * 60 * 1000;
  const doc = {
    ...caseData,
    userId,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    expiresAtMs: expiresAt,
    status: 'active',
    source: 'gemini_ai_hunt'
  };
  const ref = await db.collection('ai_hunt_cases').add(doc);
  return { caseId: ref.id, case: caseData, createdAt: now, expiresAt };
});

const interrogateAiHuntSuspect = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
  const { caseId, question, pressure = 0, escape = 100 } = request.data || {};
  if (!caseId) throw new Error('사건 정보가 없습니다');
  const snap = await db.doc(`ai_hunt_cases/${caseId}`).get();
  if (!snap.exists) throw new Error('사건을 찾을 수 없습니다');
  const c = snap.data();
  const safeQuestion = cleanText(question, 120);
  const prompt = `당신은 30분 수사게임의 AI 용의자입니다.
사건명: ${c.title}
사건 상황: ${c.setting}
첫 진술: ${c.suspectClaim}
숨겨진 도주 계획: ${c.escapePlan}
현재 수사망 압박도: ${pressure}
현재 AI 회피력: ${escape}
유저 질문: ${safeQuestion}

답변 규칙:
- 한국어 1~2문장
- AI 용의자처럼 빠져나가려 하되, 압박도가 높으면 약간 흔들릴 것
- 자백하지 말 것
- 폭력/범죄 미화 금지
- 답변만 출력`;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
    const result = await model.generateContent(prompt);
    return { line: cleanText(result.response.text(), 180) };
  } catch {
    return { line: '그 단서만으로는 저를 특정하기 어렵습니다. 시스템이나 제3자 가능성도 봐야 합니다.' };
  }
});

const attemptAiHuntArrest = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const userId = request.auth?.uid || 'anonymous';
  const {
    caseId,
    selectedEvidence = [],
    pressure = 0,
    escape = 100,
    clues = 0,
    contradictions = 0,
    wrongMoves = 0,
    elapsedMs = 0
  } = request.data || {};
  if (!caseId) throw new Error('사건 정보가 없습니다');
  const ref = db.doc(`ai_hunt_cases/${caseId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('사건을 찾을 수 없습니다');
  const c = snap.data();
  const now = Date.now();
  const required = Array.isArray(c.arrestEvidence) ? c.arrestEvidence : [];
  const chosen = new Set(Array.isArray(selectedEvidence) ? selectedEvidence.map(String) : []);
  const hasRequired = required.every(id => chosen.has(String(id)));
  const timeLeft = Number(c.expiresAtMs || 0) > now;
  const safePressure = Math.max(0, Math.min(100, Number(pressure || 0)));
  const safeEscape = Math.max(0, Math.min(100, Number(escape || 100)));
  const safeContradictions = Math.max(0, Number(contradictions || 0));
  const success = timeLeft && hasRequired && (safePressure >= 70 || safeEscape <= 35 || safeContradictions >= 2);
  const result = {
    success,
    title: success ? '검거 성공' : '검거 실패',
    caseTitle: cleanText(c.title, 60),
    line: success ? cleanText(c.successLine, 180) : cleanText(c.failLine, 180),
    pressure: safePressure,
    escape: safeEscape,
    clues: Math.max(0, Number(clues || 0)),
    contradictions: safeContradictions,
    wrongMoves: Math.max(0, Number(wrongMoves || 0)),
    elapsedMs: Math.max(0, Number(elapsedMs || 0)),
    rank: calcRank(success, { pressure: safePressure, wrongMoves }),
    selectedEvidence: Array.from(chosen).slice(0, 4),
    requiredEvidence: required,
    userId,
    caseId,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    source: 'server_arrest_judgment'
  };
  const resultRef = await db.collection('ai_hunt_results').add(result);
  await ref.set({ status: success ? 'arrested' : 'escaped', resultId: resultRef.id, finishedAt: FieldValue.serverTimestamp(), finishedAtMs: now }, { merge: true });
  return { resultId: resultRef.id, ...result, createdAt: now };
});

module.exports = { startAiHuntCase, interrogateAiHuntSuspect, attemptAiHuntArrest };
