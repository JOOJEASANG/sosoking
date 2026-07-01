const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function pickJudge(value) {
  if (JUDGES.includes(value)) return value;
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  return JUDGES[seed % JUDGES.length];
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function oneSentence(text) {
  let s = cleanText(text, 120).replace(/["“”'`]/g, '').trim();
  s = s.split(/\n/)[0].trim();
  if (!s) s = '피고는 다음 간식 선택권을 원고에게 양도한다.';
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  return s.length > 64 ? '피고는 다음 간식 선택권을 원고에게 양도한다.' : s;
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function fallback(c, judgeType) {
  const title = cleanText(c.caseTitle, 30) || '사소한 사건';
  const verdict = `대법원 소소부는 ${title}에 관하여 원고의 억울함이 그냥 넘기기엔 묘하게 찝찝한 수준이라고 본다. 다만 사건의 규모가 밥상 옆 접시 정도인 점을 고려하여 과한 분노는 일부 감액한다. ${judgeType} 재판부의 결론은 피식 웃음 1회와 소소한 처분으로 확정된다. 이 판결은 실제 법적 효력이 없는 오락 콘텐츠다.`;
  return {
    reception: `${title} 접수 완료. 사건은 작지만 원고 표정은 전혀 작지 않았다.`,
    investigation: '조사 결과, 사건의 크기는 미니 사이즈였으나 억울함은 대용량이었다. 증거는 평범했지만 분위기는 이상하게 엄숙했다.',
    plaintiffArg: '원고는 “이건 그냥 넘어가면 내 하루가 진다”고 주장했다. 말투는 차분했지만 마음속 북소리는 이미 시작된 상태였다.',
    defendantArg: '피고는 “그럴 의도는 아니었다”고 해명했다. 그러나 의도가 없었다는 말만으로 모든 접시가 제자리로 돌아오지는 않는다.',
    verdict,
    supremeFinal: verdict,
    sentence: '피고는 다음 간식 선택권을 원고에게 양도한다.'
  };
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');

  let c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (c.status !== 'pending') throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (current.status !== 'pending') return;
    c = current;
    tx.update(caseRef, {
      status: 'processing',
      courtStage: 'hearing',
      judgeType,
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete()
    });
  });

  const latest = await caseRef.get();
  if (latest.data()?.status !== 'processing') return { success: true, skipped: latest.data()?.status || 'unknown' };

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  let data = fallback(c, judgeType);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName });
    const prompt = `소소킹 판결소의 공개 판결기록을 JSON으로 작성한다. 핵심은 사소한 사건을 사용자가 웃으며 읽게 만드는 것이다. 재판 여정은 반드시 접수 → 조사 → 공방 → 대법원 판결 → 처분 순서로 느껴지게 한다. 길게 늘이지 말고 짧고 밀도 있게 작성한다.

금지: 실제 법률 자문처럼 보이는 표현, 무거운 범죄 묘사, 개인정보 반복, 장황한 법률 문체, 모욕적 표현, 위험한 처분, 금전 배상처럼 보이는 처분, '생활법정', '생활형', '생활분쟁' 같은 표현.
톤: 적당히 진지한 척하지만 재치 있고 웃김. 사용자가 읽다가 피식하게 만든다.

사건명: ${cleanText(c.caseTitle, 30)}
사건 경위: ${cleanText(c.caseDescription, 200)}
억울지수: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}
담당 판사: ${judgeType}

필드별 작성 규칙:
- reception: 접수. 2문장. 사건번호가 붙은 것처럼 괜히 엄숙하고 웃기게.
- investigation: 조사. 2문장. 사소함과 억울함의 대비가 느껴지게.
- plaintiffArg: 공방 중 원고 주장. 1~2문장. 과몰입하지만 공감되게.
- defendantArg: 공방 중 피고 항변. 1~2문장. 그럴듯하지만 살짝 허술하게.
- verdict: 대법원 판결. 3~4문장. '대법원 소소부'가 최종 판단하는 느낌으로 작성. 원심/파기환송/확정 같은 표현을 웃기게 활용하되 최종 결론은 분명하게. 마지막 문장에는 실제 효력이 없는 오락 콘텐츠라는 취지를 짧게 포함.
- sentence: 처분. 반드시 '피고는 ...한다.' 한 문장, 64자 이하. 사과, 양보, 간식 선택권, 리모컨 위치 보고, 마지막 한 입 양보 같은 구체적인 소소한 벌칙으로 재치 있게. '반성한다'처럼 밋밋한 처분 금지.

반드시 JSON만 출력한다. 필드: reception, investigation, plaintiffArg, defendantArg, verdict, sentence.`;
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals = {
      requests: 1,
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0
    };
    const parsed = safeJson(result.response.text());
    const verdict = cleanText(parsed.verdict, 720) || data.verdict;
    data = {
      reception: cleanText(parsed.reception, 360) || data.reception,
      investigation: cleanText(parsed.investigation, 430) || data.investigation,
      plaintiffArg: cleanText(parsed.plaintiffArg, 360) || data.plaintiffArg,
      defendantArg: cleanText(parsed.defendantArg, 360) || data.defendantArg,
      verdict,
      supremeFinal: verdict,
      sentence: oneSentence(parsed.sentence || data.sentence)
    };
  } catch (err) {
    console.error('generateTrial AI failed, using fallback:', err);
  }

  try {
    await resultRef.set({
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 판결소',
      courtroom: '제404호 소소법정',
      division: '소소킹 판결부',
      caseTitle: c.caseTitle || '판결 결과',
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.reception,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      verdict: data.verdict,
      supremeFinal: data.supremeFinal,
      sentence: data.sentence,
      reactionTotal: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await caseRef.update({
      status: 'completed',
      courtStage: 'sentenced',
      judgeType,
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    await caseRef.update({ status: 'error', courtStage: 'error', errorMessage: err.message || '알 수 없는 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw err;
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(1),
        firestoreReads: FieldValue.increment(3),
        firestoreWrites: FieldValue.increment(4),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic };
});
