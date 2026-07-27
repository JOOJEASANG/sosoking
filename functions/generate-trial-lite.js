const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const JUDGE_STYLE = {
  '엄벌주의형': '사소한 잘못도 생활질서 붕괴의 전조처럼 엄격하게 판단한다.',
  '감성형': '당사자의 서운함과 관계 회복을 중심으로 따뜻하지만 과몰입해서 판단한다.',
  '현실주의형': '핑계와 감정을 걷어내고 실제 생활에서 지킬 수 있는 해결책을 냉정하게 제시한다.',
  '과몰입형': '평범한 일상을 대하드라마와 국가적 위기 수준으로 장엄하게 확대한다.',
  '피곤형': '빨리 퇴근하고 싶어 하지만 판결문 형식과 핵심 지적만큼은 집요하게 지킨다.',
  '논리집착형': '말의 앞뒤, 시간 순서, 모순을 소수점 단위로 따지며 웃음을 만든다.',
  '드립형': '표정은 근엄하게 유지하면서 문장마다 정색한 생활형 드립을 배치한다.'
};
const SENTENCE_FALLBACKS = [
  '피고는 3일간 간식 선택권을 원고에게 우선 배정하고 변명은 하루 1회로 제한한다.',
  '피고는 다음 실수 때 변명보다 사과를 먼저 제출하고 원고 몫의 간식을 별도 보관한다.',
  '피고는 48시간 동안 생활법정의 눈치를 성실히 살피며 원고의 요청에 한 번에 답한다.',
  '피고는 다음 공동구매에서 원고 몫을 1.5배 확보하고 마지막 선택권을 원고에게 양도한다.'
];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanArray(value, maxItems, maxLen) {
  const source = Array.isArray(value) ? value : [];
  return source.map(item => cleanText(item, maxLen)).filter(Boolean).slice(0, maxItems);
}
function normalizeCaseTitle(value, description = '') {
  let title = cleanText(value, 30).replace(/["“”'`]/g, '').replace(/[.!?]+$/g, '').trim();
  if (!title || title === 'AI 사건명 작성 중') {
    const base = cleanText(description, 80)
      .replace(/^(오늘|어제|방금|아까)\s*/g, '')
      .replace(/[.!?].*$/g, '')
      .replace(/(했어요|했습니다|했다|해요|합니다)$/g, '')
      .trim()
      .slice(0, 18);
    title = base || '정체불명 생활 억울';
  }
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return cleanText(title, 30);
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
  let s = cleanText(text, 150).replace(/["“”'`]/g, '').trim().split(/\n/)[0].trim();
  if (!s) s = SENTENCE_FALLBACKS[Math.floor(Math.random() * SENTENCE_FALLBACKS.length)];
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  return s.length > 95 ? SENTENCE_FALLBACKS[Math.floor(Math.random() * SENTENCE_FALLBACKS.length)] : s;
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function detailFrom(c) {
  return cleanText(c.caseDescription, 150) || '당사자 사이에 설명하기 애매하지만 그냥 넘기기에는 묘하게 억울한 일이 발생했다';
}
function fallback(c, judgeType) {
  const caseTitle = normalizeCaseTitle('', c.caseDescription);
  const detail = detailFrom(c);
  return {
    caseTitle,
    reception: `${caseTitle}은 겉으로 보기에는 회의 안건으로 올리기도 민망한 사안이었으나, 원고의 억울지수와 사건 당시의 정적이 심상치 않아 제404호 생활법정에 긴급 접수되었다. 접수계는 “${detail}”라는 진술을 핵심 사건 경위로 기록했다. 서기는 사건기록 표지에 ‘웃으면 안 되지만 이미 늦음’이라는 비공식 메모를 남겼다.`,
    evidenceList: [
      `증 제1호 사건경위 진술서: “${detail}”라는 원고의 진술은 구체적이면서도 생활감이 지나치게 생생하여 재판부의 간식 시간을 잠시 중단시켰다.`,
      '증 제2호 사건 직후의 정적과 표정 변화: 말보다 길었던 침묵은 당사자 사이에 이미 작은 냉전이 개시되었음을 보여주는 정황증거로 채택되었다.',
      '증 제3호 뒤늦게 제출된 해명: 사건 당시에는 없던 설명이 분쟁 발생 후 갑자기 완성형 문장으로 등장하여 그 신빙성에 생활형 할인율이 적용되었다.'
    ],
    investigation: `조사관은 사건 경위의 시간 순서와 당사자의 반응, 그리고 굳이 하지 않아도 되었던 추가 행동을 집중 분석했다. 현장 감식 결과 물리적 피해는 크지 않았으나 원고의 기분에는 분명한 사용 흔적이 남아 있었다. 특히 피고의 해명이 사건 직후보다 재판이 시작된 뒤 더 정교해진 점은 매우 수상한 발전으로 평가되었다. 조사관은 본 사건의 핵심을 ‘잘못의 크기보다 대응 태도가 억울함을 증식시킨 사건’으로 정리했다.`,
    plaintiffArg: `원고는 자신이 거창한 보상을 원하는 것이 아니라 최소한의 배려와 빠른 인정이 필요했다고 주장했다. 문제 자체는 사소할 수 있지만, 사소하다는 이유로 원고의 기분까지 자동 기각되어서는 안 된다고 강조했다. 원고 측은 “처음부터 미안하다고 했으면 여기까지 오지도 않았습니다”라는 생활분쟁계의 전통적이면서도 강력한 최종변론을 제출했다.`,
    defendantArg: `피고는 고의가 없었고 상황상 어쩔 수 없었다며 선처를 구했다. 또한 원고가 사건을 다소 크게 받아들인 측면이 있다고 주장했으나, 재판부는 그 문장이 생활분쟁에서 자주 사용되는 위험한 문장임을 직권으로 고지했다. 피고 측은 마지막으로 앞으로 조심하겠다고 약속했지만 구체적인 조심 방법은 아직 준비 중이라고 답변했다.`,
    judgeInterrogation: [
      '재판부: 사건 직후 바로 사과하지 않은 이유는 무엇입니까? 피고: 그렇게까지 화가 난 줄 몰랐습니다. 재판부: 몰랐다는 답변이 화를 한 단계 추가한 사실을 인정합니까?',
      '재판부: 원고가 가장 억울했던 지점은 무엇입니까? 원고: 행동보다 대수롭지 않게 넘긴 태도였습니다. 재판부: 기록상 핵심 쟁점으로 채택합니다.',
      '재판부: 같은 상황이 다시 발생하면 어떻게 하겠습니까? 피고: 먼저 묻고 바로 사과하겠습니다. 재판부: 드디어 본 법정이 알아들을 수 있는 문장이 제출되었습니다.'
    ],
    keyFindings: [
      '사건 자체는 경미하지만 피고의 초기 대응이 억울함을 불필요하게 확대했다.',
      '원고가 요구한 핵심은 금전이나 권력이 아니라 배려, 인정, 재발 방지였다.',
      '피고의 뒤늦은 해명은 일부 참작되지만 사건 직후의 태도를 완전히 지우지는 못한다.'
    ],
    courtCommentary: `${judgeType} 재판부는 사소한 일일수록 빠른 사과가 가장 저렴하고 효과적인 분쟁 해결 수단이라고 지적한다. 사람들은 대개 큰 사건 때문에 관계가 멀어진다고 생각하지만, 실제 생활에서는 마지막 한입과 읽고도 답하지 않은 12분이 더 오래 기억되기도 한다. 재판부는 “사소함은 면책사유가 아니라 조기 해결 기회”라는 쓸데없이 그럴듯한 생활법정 명언을 선고기록에 남긴다.`,
    verdict: `${judgeType} 판사는 제출된 사건 경위와 억울지수, 양측의 변론을 종합하여 원고의 주장을 상당 부분 받아들인다. 본 사건은 국가적 위기나 실제 법률 분쟁은 아니지만, 원고의 평온한 하루에는 충분한 생활형 침해가 발생했다. 피고에게 악의가 있었다고 단정하기는 어렵지만, 사건 직후 대수롭지 않게 넘긴 태도는 억울함을 스스로 증액한 것으로 판단한다. 반면 원고 역시 피고에게 마음을 읽는 초능력까지 요구할 수는 없으므로 일부 감정 과잉 부분은 자체 조정한다. 결론적으로 피고는 말로만 억울함을 축소할 것이 아니라 구체적인 행동으로 관계 회복에 착수해야 한다. 이 판결은 실제 법적 효력이 전혀 없는 오락 콘텐츠이지만, 다음번 사과 시점을 앞당기는 정도의 생활상 효력은 기대한다.`,
    sentence: SENTENCE_FALLBACKS[Math.floor(Math.random() * SENTENCE_FALLBACKS.length)],
    aftermath: '선고 직후 피고는 판결이 생각보다 구체적이라며 잠시 말을 잃었고, 원고는 드디어 누군가 자신의 억울함을 문서로 남겼다며 만족을 표시했다. 양측은 처분 이행 여부를 두고 다시 가벼운 신경전을 벌였으나, 이번에는 사건이 커지기 전에 간식과 사과를 함께 제출하는 방향으로 잠정 합의했다. 제404호 생활법정은 이를 드문 조기 갱생 사례로 기록하고 조용히 다음 사소한 사건을 기다렸다.'
  };
}
function normalizeGenerated(parsed, c, judgeType) {
  const base = fallback(c, judgeType);
  return {
    caseTitle: normalizeCaseTitle(parsed.caseTitle, c.caseDescription),
    reception: cleanText(parsed.reception, 1100) || base.reception,
    evidenceList: cleanArray(parsed.evidenceList, 3, 360),
    investigation: cleanText(parsed.investigation, 1200) || base.investigation,
    plaintiffArg: cleanText(parsed.plaintiffArg, 1000) || base.plaintiffArg,
    defendantArg: cleanText(parsed.defendantArg, 1000) || base.defendantArg,
    judgeInterrogation: cleanArray(parsed.judgeInterrogation, 3, 420),
    keyFindings: cleanArray(parsed.keyFindings, 3, 300),
    courtCommentary: cleanText(parsed.courtCommentary, 900) || base.courtCommentary,
    verdict: cleanText(parsed.verdict, 1800) || base.verdict,
    sentence: oneSentence(parsed.sentence || base.sentence),
    aftermath: cleanText(parsed.aftermath, 900) || base.aftermath
  };
}
function contentScore(data) {
  let score = 0;
  if (data.reception.length >= 180) score++;
  if (data.evidenceList.length === 3 && data.evidenceList.every(v => v.length >= 35)) score++;
  if (data.investigation.length >= 220) score++;
  if (data.plaintiffArg.length >= 180) score++;
  if (data.defendantArg.length >= 180) score++;
  if (data.judgeInterrogation.length === 3 && data.judgeInterrogation.every(v => v.length >= 35)) score++;
  if (data.keyFindings.length === 3) score++;
  if (data.courtCommentary.length >= 150) score++;
  if (data.verdict.length >= 350) score++;
  if (data.aftermath.length >= 150) score++;
  return score;
}
function completeWithFallback(data, c, judgeType) {
  const base = fallback(c, judgeType);
  return {
    ...data,
    evidenceList: data.evidenceList.length === 3 ? data.evidenceList : base.evidenceList,
    judgeInterrogation: data.judgeInterrogation.length === 3 ? data.judgeInterrogation : base.judgeInterrogation,
    keyFindings: data.keyFindings.length === 3 ? data.keyFindings : base.keyFindings,
    reception: data.reception.length >= 160 ? data.reception : base.reception,
    investigation: data.investigation.length >= 180 ? data.investigation : base.investigation,
    plaintiffArg: data.plaintiffArg.length >= 150 ? data.plaintiffArg : base.plaintiffArg,
    defendantArg: data.defendantArg.length >= 150 ? data.defendantArg : base.defendantArg,
    courtCommentary: data.courtCommentary.length >= 130 ? data.courtCommentary : base.courtCommentary,
    verdict: data.verdict.length >= 300 ? data.verdict : base.verdict,
    aftermath: data.aftermath.length >= 130 ? data.aftermath : base.aftermath
  };
}
async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}
async function resetStaleCase(caseRef, c, resultRef) {
  if (c.status === 'completed') {
    const existing = await resultRef.get();
    if (existing.exists) return { skip: true, reason: 'completed' };
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return { skip: false, data: { ...c, status: 'pending', courtStage: 'filed' } };
  }
  if (c.status === 'processing') {
    const started = c.processingStartedAt?.toMillis ? c.processingStartedAt.toMillis() : 0;
    if (started && Date.now() - started < 10 * 60 * 1000) return { skip: true, reason: 'processing' };
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return { skip: false, data: { ...c, status: 'pending', courtStage: 'filed' } };
  }
  return { skip: false, data: c };
}
function buildPrompt(c, judgeType, retry = false) {
  return `당신은 소소킹 판결소의 수석 코미디 작가이자 생활법정 재판부다. 사용자 사건을 실제 법률 판단이 아닌 안전한 장편 오락 콘텐츠로 작성한다.

사건 경위: ${cleanText(c.caseDescription, 200)}
억울지수: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}
담당 판사: ${judgeType}
판사 성향: ${JUDGE_STYLE[judgeType] || JUDGE_STYLE['현실주의형']}

중요한 작성 원칙:
- 짧은 요약문이 아니라 읽을거리가 충분한 완성형 재판기록을 작성한다.
- 사건 경위의 구체적인 행동과 사물을 반복 활용해 이 사건만의 농담을 만든다.
- 각 항목은 서로 다른 내용과 농담을 사용하고 같은 문장을 재활용하지 않는다.
- 욕설, 비하, 혐오, 개인정보 재노출, 실제 법률 자문은 금지한다.
- 실제 법적 효력이 없는 오락 콘텐츠라는 점은 verdict 마지막 부분에 자연스럽게 밝힌다.

필드별 요구사항:
1. caseTitle: 사건 경위를 압축한 10~24자의 제목. 반드시 ‘사건’으로 끝낸다.
2. reception: 3~5문장, 220~420자. 장엄한 접수 사유, 사건번호가 어울릴 듯한 과장, 서기의 짧은 속마음 농담을 포함한다.
3. evidenceList: 정확히 3개 문자열 배열. 각 항목은 ‘증 제1호’ 형식으로 시작하고 구체적 사물·행동·정황과 재판부의 과장된 해석을 2문장으로 작성한다.
4. investigation: 4~6문장, 260~520자. 시간 순서, 행동 분석, 모순, 쓸데없는 과학수사를 포함한다.
5. plaintiffArg: 3~5문장, 220~430자. 원고가 왜 억울한지 구체적으로 주장하고 기억에 남는 한 줄 변론을 포함한다.
6. defendantArg: 3~5문장, 220~430자. 피고의 그럴듯한 변명과 그 변명이 스스로 무너지는 지점을 포함한다.
7. judgeInterrogation: 정확히 3개 문자열 배열. 각 항목은 재판부 질문, 당사자 답변, 재판부의 정색한 반응을 모두 포함한다.
8. keyFindings: 정확히 3개 문자열 배열. 증거와 변론을 바탕으로 한 핵심 판단을 사건 맞춤형으로 작성한다.
9. courtCommentary: 3~5문장, 180~360자. 판사 성향이 분명하게 드러나는 논평과 생활형 명언 1개를 포함한다.
10. verdict: 6~10문장, 480~900자. 사실 인정, 양측 책임, 판단 이유, 웃긴 비유, 결론을 충분히 서술한다.
11. sentence: 반드시 ‘피고는 ...한다.’ 한 문장, 30~90자. 실제 실행 가능하고 사건에 맞춤형인 웃긴 처분이다.
12. aftermath: 3~5문장, 180~360자. 선고 직후 양측 반응과 처분 이행 과정에서 생긴 더 사소한 후일담을 작성한다.

${retry ? '이전 응답이 너무 짧거나 항목이 누락되었다. 이번에는 위 분량과 배열 개수를 반드시 모두 충족한다.' : ''}
반드시 JSON 객체만 출력한다. 필드: caseTitle, reception, evidenceList, investigation, plaintiffArg, defendantArg, judgeInterrogation, keyFindings, courtCommentary, verdict, sentence, aftermath.`;
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
  const reset = await resetStaleCase(caseRef, c, resultRef);
  if (reset.skip) return { success: true, skipped: reset.reason };
  c = reset.data;
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
      errorMessage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  const latest = await caseRef.get();
  if (latest.data()?.status !== 'processing') return { success: true, skipped: latest.data()?.status || 'unknown' };

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  let data = fallback(c, judgeType);
  let generationMode = 'fallback';
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 1.02,
        topP: 0.95,
        maxOutputTokens: 4200,
        responseMimeType: 'application/json'
      }
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await model.generateContent(buildPrompt(c, judgeType, attempt === 1));
      const meta = result.response.usageMetadata || {};
      totals.requests += 1;
      totals.inputTokens += meta.promptTokenCount || 0;
      totals.outputTokens += meta.candidatesTokenCount || 0;
      const candidate = normalizeGenerated(safeJson(result.response.text()), c, judgeType);
      data = completeWithFallback(candidate, c, judgeType);
      if (contentScore(candidate) >= 9 || attempt === 1) {
        generationMode = contentScore(candidate) >= 7 ? 'ai' : 'ai-assisted-fallback';
        break;
      }
    }
  } catch (err) {
    console.error('generateTrial AI failed, using rich fallback:', err);
  }

  const finalTitle = normalizeCaseTitle(data.caseTitle, c.caseDescription);
  try {
    const batch = db.batch();
    batch.set(resultRef, {
      source: 'user',
      contentVersion: 2,
      generationMode,
      userId: uid,
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 판결소',
      courtroom: '제404호 생활법정',
      division: '제3생활부',
      caseTitle: finalTitle,
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.reception,
      evidenceList: data.evidenceList,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      judgeInterrogation: data.judgeInterrogation,
      keyFindings: data.keyFindings,
      courtCommentary: data.courtCommentary,
      verdict: data.verdict,
      sentence: data.sentence,
      aftermath: data.aftermath,
      reactionTotal: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.update(caseRef, {
      caseTitle: finalTitle,
      status: 'completed',
      courtStage: 'sentenced',
      judgeType,
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
      errorMessage: FieldValue.delete()
    });
    await batch.commit();
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
        firestoreReads: FieldValue.increment(4),
        firestoreWrites: FieldValue.increment(3),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic, caseTitle: finalTitle, generationMode };
});