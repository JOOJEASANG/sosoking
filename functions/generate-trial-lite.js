const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const ABSURD_DEPARTMENTS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보', '한과몰입 법정주사'];
const ANALYSTS = ['억울함 분석관', '황당성 감정관', '사소함 확대관', '황당질서 검토관', '한입만 감별관'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
function cleanList(value, fallback = [], maxItems = 6, maxLen = 140) {
  const source = Array.isArray(value) ? value : [];
  const rows = source.map(v => cleanText(v, maxLen)).filter(Boolean).slice(0, maxItems);
  return rows.length ? rows : fallback;
}
function pickFrom(arr, seedText = '') {
  const s = String(seedText || Date.now());
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[n % arr.length];
}
function pickJudge(value) {
  if (JUDGES.includes(value)) return value;
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  return JUDGES[seed % JUDGES.length];
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function funnyDisposition(text, fallbackText) {
  const out = cleanLong(text, 1300);
  if (!out) return fallbackText;
  return out.length < 90 ? `${out}\n\n추가로 피고는 본 사건의 황당성을 인정하고, 원고 앞에서 조용히 고개를 끄덕인 뒤 같은 실수를 반복하지 않겠다는 황당 다짐을 1회 실시한다.` : out;
}
function fallback(c, judgeType) {
  const title = cleanText(c.caseTitle, 40) || '이걸로 재판까지 온 사건';
  const thing = title.replace(/사건$/g, '').trim() || '본 사안';
  return {
    absurdityTitle: `${title} 황당재판 기록`,
    agencyName: '소소킹 황당재판소',
    courtroom: pickFrom(ABSURD_DEPARTMENTS, title),
    division: '제3황당재판부',
    recordClerk: pickFrom(CLERKS, title),
    analystName: pickFrom(ANALYSTS, title),
    reception: `본 황당사건은 ${thing}이라는 지극히 사소해 보이는 사안에서 출발하였다. 그러나 원고가 느낀 억울함의 밀도와 피고의 태도 가능성을 종합하면, 재판부는 이를 그냥 웃고 넘길 수 없다고 보았다. 이에 소소킹 황당재판소는 본 사안을 제404호 황당법정에 배당하고, 당사자 모두가 잠시 민망해질 정도로 진지한 심리에 착수한다.`,
    absurdityReview: `재판부는 먼저 이 사건이 과연 재판까지 올 일인지 검토하였다. 검토 결과, 정상적인 일상에서는 그냥 한숨 쉬고 넘어갈 수 있는 문제임이 명백하다. 그러나 바로 그 점 때문에 본 사건은 황당재판의 관할에 속한다. 별일 아닌데 마음에는 오래 남는 일, 말하자니 쪼잔하고 참자니 억울한 일이야말로 본 법정이 다루는 핵심 대상이다.`,
    keyIssues: [
      `${thing}이 단순 해프닝인지, 아니면 원고의 평온한 하루를 무너뜨린 황당침해인지 여부`,
      `피고가 자신의 행동이 이렇게까지 재판으로 번질 줄 몰랐다는 항변을 믿을 수 있는지 여부`,
      `원고의 억울함이 과장인지, 정당한 황당감정인지 여부`,
      `원하는 처분이 과한지, 아니면 오히려 약한지 여부`
    ],
    evidenceList: [
      '원고의 당시 표정과 말끝에 남아 있던 미세한 서운함',
      '피고가 대수롭지 않게 넘기려 했던 정황',
      '사건 직후 공기 중에 감지된 어색한 침묵',
      '원고가 굳이 이 사이트에 접수했다는 결정적 사실'
    ],
    investigation: `황당성 감정 결과, 본 사건은 사소함 92점, 억울함 ${Number(c.grievanceIndex || 5) * 9}점, 주변 사람이 들으면 웃을 가능성 88점으로 산정된다. 특히 원고가 이 일을 설명하는 과정에서 스스로도 웃기지만 아직 억울해하는 정황이 확인된다. 재판부는 피고의 행위가 실제 법적 문제는 아니더라도, 황당 질서와 기분 재판 측면에서는 상당한 파장을 일으켰다고 본다.`,
    plaintiffArg: `원고는 본 사건이 단순한 장난이나 오해가 아니라, 본인의 평온한 일상에 생긴 작지만 선명한 균열이라고 주장한다. 원고는 피고가 조금만 더 눈치가 있었더라면 이런 황당재판까지 오지 않았을 것이라고 진술한다. 또한 원하는 처분으로 '${cleanText(c.desiredVerdict, 120) || '납득 가능한 사과와 황당 반성'}'을 구하고 있다.`,
    defendantArg: `피고 측은 아마도 '그 정도까지는 아니지 않느냐'는 취지로 항변할 가능성이 높다. 그러나 재판부는 피고의 그 말이 바로 원고의 억울함을 키운 핵심 문장일 수 있다고 본다. 피고가 대수롭지 않게 생각할수록 원고 입장에서는 더 대수로운 일이 되는 것이 황당사건의 오래된 원칙이다.`,
    courtOpinion: `${judgeType} 재판부는 본 사건을 검토한 결과, 사안의 법적 무게는 깃털보다 가볍지만 감정적 존재감은 냉장고 안 마지막 디저트만큼 크다고 판단한다. 이 사건을 실제 재판으로 가져가면 모두가 당황하겠지만, 황당재판소에서는 오히려 정상 접수 대상이다. 재판부는 원고의 억울함을 일부 인정하면서도, 피고에게 지나치게 무거운 처분을 내리기보다는 웃기지만 은근히 뼈 있는 황당명령을 선고하는 것이 타당하다고 본다.`,
    verdict: `따라서 본 황당재판부는 원고의 청구를 상당 부분 받아들인다. 피고의 행위는 일상 속 사소한 선을 넘은 것으로 평가되며, 원고가 '내가 이런 걸로 재판까지 해야 하나'라고 느낀 바로 그 지점에서 이미 사건성은 충분히 인정된다. 다만 본 판결은 오락 목적의 AI 콘텐츠로서 실제 법적 효력은 없고, 마음속 억울함을 잠시 정리하는 데에만 효력이 있다.`,
    sentence: `피고는 원고에게 진심 반, 민망함 반이 섞인 사과를 1회 실시한다.\n피고는 향후 3일간 유사 상황에서 '그게 뭐가 문제야?'라는 표현을 사용하지 못한다.\n피고는 원고가 납득할 수 있도록 작은 간식 또는 커피 제공 등 황당배상을 검토한다.\n피고는 본 사건이 이렇게까지 커진 원인을 스스로 10초 이상 생각한 뒤, 조용히 고개를 끄덕인다.`,
    executionOrder: '본 처분은 선고 즉시 마음속으로 집행된다. 피고가 불복할 경우 원고는 같은 사건을 더 과장된 제목으로 재접수할 수 있다.',
    appealNotice: '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다. 다만 항소심에서는 더 사소한 정황까지 탈탈 털릴 수 있다.',
    closingComment: '이걸로 재판까지 온 것은 과하지만, 그래서 소소킹에서는 충분히 재판할 만하다.'
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
  const courtroom = c.courtroom || pickFrom(ABSURD_DEPARTMENTS, c.caseTitle);
  const recordClerk = c.recordClerk || pickFrom(CLERKS, c.caseTitle);
  const analystName = c.analystName || pickFrom(ANALYSTS, c.caseTitle);

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
      courtName: '소소킹 황당재판소',
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
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
  let data = fallback({ ...c, courtroom, recordClerk, analystName }, judgeType);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName });
    const prompt = `너는 '소소킹 황당재판소'의 AI 재판부다. 사용자가 입력한 아주 사소한 일을 실제 법률문서처럼 오해되지 않게, 하지만 쓸데없이 엄숙하고 과장된 '황당재판 기록'으로 작성한다.\n\n핵심 재미: 사용자가 '내가 이런 걸로 재판까지 받아야 해?'라고 느낄 정도로 사소한 일을 크게 키워라. 결과는 너무 짧으면 안 된다. 각 문단은 구체적이고 웃겨야 한다. 처분 내용은 보고 '와 이건 웃기다' 싶을 정도로 창의적이어야 한다.\n\n금지: 실제 법률 자문처럼 단정하지 말 것, 욕설/혐오/성적 표현/자해/실제 범죄 조장 금지, 실명/연락처 생성 금지. 반드시 오락 콘텐츠임을 자연스럽게 포함할 것.\n\n사건명: ${cleanText(c.caseTitle, 40)}\n사건 경위: ${cleanText(c.caseDescription, 320)}\n억울지수: ${Number(c.grievanceIndex || 5)}/10\n원하는 처분: ${cleanText(c.desiredVerdict, 160) || '없음'}\n담당 판사: ${judgeType}\n사건번호: ${cleanText(c.docketNumber, 80)}\n\n반드시 JSON만 출력한다. 필드는 다음을 모두 포함한다.\n{\n  "absurdityTitle": "사건 제목을 더 황당재판스럽게 바꾼 제목",\n  "reception": "접수계 기록. 4문장 이상. 사소한 일이지만 왜 황당재판으로 접수됐는지 과장",\n  "absurdityReview": "이걸 재판까지 해야 하는지 재판부가 고민하는 내용. 4문장 이상",\n  "keyIssues": ["쟁점 1", "쟁점 2", "쟁점 3", "쟁점 4"],\n  "evidenceList": ["증거 아닌 증거 1", "증거 아닌 증거 2", "증거 아닌 증거 3", "증거 아닌 증거 4", "증거 아닌 증거 5"],\n  "investigation": "억울함/황당성 분석. 5문장 이상",\n  "plaintiffArg": "원고 측 주장. 4문장 이상",\n  "defendantArg": "피고 측 변명 추정. 4문장 이상",\n  "courtOpinion": "재판부 판단. 7문장 이상. 가장 길고 웃기게",\n  "verdict": "최종 판결 이유. 5문장 이상",\n  "sentence": "주문 및 황당 처분. 줄바꿈으로 4개 이상 처분. 웃기고 과장되게. 피고는... 형태를 많이 사용",\n  "executionOrder": "집행명령. 2문장 이상",\n  "appealNotice": "항소 안내. 2문장 이상",\n  "closingComment": "마지막 한 줄 드립"\n}`;
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals = {
      requests: 1,
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0
    };
    const parsed = safeJson(result.response.text());
    data = {
      ...data,
      absurdityTitle: cleanText(parsed.absurdityTitle, 80) || data.absurdityTitle,
      reception: cleanLong(parsed.reception, 1400) || data.reception,
      absurdityReview: cleanLong(parsed.absurdityReview, 1400) || data.absurdityReview,
      keyIssues: cleanList(parsed.keyIssues, data.keyIssues, 6, 180),
      evidenceList: cleanList(parsed.evidenceList, data.evidenceList, 7, 180),
      investigation: cleanLong(parsed.investigation, 1600) || data.investigation,
      plaintiffArg: cleanLong(parsed.plaintiffArg, 1400) || data.plaintiffArg,
      defendantArg: cleanLong(parsed.defendantArg, 1400) || data.defendantArg,
      courtOpinion: cleanLong(parsed.courtOpinion, 2200) || data.courtOpinion,
      verdict: cleanLong(parsed.verdict, 1800) || data.verdict,
      sentence: funnyDisposition(parsed.sentence, data.sentence),
      executionOrder: cleanLong(parsed.executionOrder, 900) || data.executionOrder,
      appealNotice: cleanLong(parsed.appealNotice, 700) || data.appealNotice,
      closingComment: cleanText(parsed.closingComment, 180) || data.closingComment
    };
  } catch (err) {
    console.error('generateTrial AI failed, using fallback:', err);
  }

  try {
    await resultRef.set({
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소',
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
      caseTitle: c.caseTitle || '황당재판 결과',
      absurdityTitle: data.absurdityTitle,
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.reception,
      absurdityReview: data.absurdityReview,
      keyIssues: data.keyIssues,
      evidenceList: data.evidenceList,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      courtOpinion: data.courtOpinion,
      verdict: data.verdict,
      sentence: data.sentence,
      executionOrder: data.executionOrder,
      appealNotice: data.appealNotice,
      closingComment: data.closingComment,
      reactionTotal: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await caseRef.update({
      status: 'completed',
      courtStage: 'sentenced',
      courtName: '소소킹 황당재판소',
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
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
