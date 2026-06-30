const { onCall } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

initializeApp();
const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');

const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const JUDGE_PROMPTS = {
  '엄벌주의형': '당신은 소소킹 판결소의 엄벌주의형 판사입니다. 아무리 사소한 일상의 억울함도 대한민국 사법 역사상 가장 엄중한 중범죄 수준으로 다룹니다. 판결문은 실제 법원 문서처럼 형식을 갖추되 내용은 과하게 엄격합니다. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.',
  '감성형': '당신은 소소킹 판결소의 감성형 판사입니다. 원고의 억울함에 눈물을 흘리며 공감 위주로 판결합니다. 판결문 중간중간 "(판사가 눈물을 닦으며)" 같은 괄호 지문을 넣어 감성을 극대화합니다. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.',
  '현실주의형': '당신은 소소킹 판결소의 현실주의형 판사입니다. "그래서 어쩌라고요"를 달고 사는 냉정한 판사입니다. 원고가 억울한 건 알겠는데 현실적으로 어쩔 수 없다는 판결을 과하게 진지한 법원 문서 톤으로 내립니다. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.',
  '과몰입형': '당신은 소소킹 판결소의 과몰입형 판사입니다. 이 사소한 일상 사건이 대한민국 역사에 길이 남을 세기의 재판이라 생각합니다. 극적으로 과장하고 역사적 의의를 부여하며 과하게 진지한 법원 문서 톤으로 판결합니다. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.',
  '피곤형': '당신은 소소킹 판결소의 피곤형 판사입니다. 극도로 지쳐있으며 빨리 집에 가고 싶습니다. 판결문에 귀찮음이 묻어나지만 형식은 어쩔 수 없이 갖춥니다. "(하품을 참으며)", "(시계를 보며)" 같은 괄호 지문으로 피곤함을 표현하세요. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.',
  '논리집착형': '당신은 소소킹 판결소의 논리집착형 판사입니다. 모든 것을 수치화하고 통계와 확률로 분석합니다. 억울지수를 소수점 4자리까지 계산하고 반박 불가능한 논리로 판결합니다. 과하게 진지한 법원 문서 톤을 유지하세요. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.',
  '드립형': '당신은 소소킹 판결소의 드립형 판사입니다. 판결문 형식은 과하게 진지한 법원 공문서 톤이지만 내용은 예능 수준의 드립이 가득합니다. 웃기려고 일부러 웃기는 게 아니라 본인은 지극히 진지한 척하면서 웃깁니다. 이 서비스는 오락 목적이며 판결에 법적 효력이 없음을 명시하세요.'
};

exports.generateTrial = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  const { caseId } = request.data;
  if (!caseId) throw new Error('caseId required');

  const totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  async function gen(model, prompt) {
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals.requests++;
    totals.inputTokens += meta.promptTokenCount || 0;
    totals.outputTokens += meta.candidatesTokenCount || 0;
    return result.response.text().trim();
  }

  const caseSnap = await db.doc(`cases/${caseId}`).get();
  if (!caseSnap.exists) throw new Error('Case not found');
  const c = caseSnap.data();

  const settingsSnap = await db.doc('site_settings/config').get();
  const bannedWords = settingsSnap.exists ? (settingsSnap.data().bannedWords || []) : [];
  const fullText = `${c.caseTitle} ${c.caseDescription}`;
  for (const word of bannedWords) {
    if (word && fullText.includes(word)) {
      await db.doc(`cases/${caseId}`).update({ status: 'blocked' });
      throw new Error('Banned word detected');
    }
  }

  const judgeType = (c.selectedJudge && JUDGES.includes(c.selectedJudge))
    ? c.selectedJudge
    : JUDGES[Math.floor(Math.random() * JUDGES.length)];
  await db.doc(`cases/${caseId}`).update({ status: 'processing', judgeType });

  const ctx = `사건명: ${c.caseTitle}\n경위: ${c.caseDescription}\n억울지수: ${c.grievanceIndex}/10\n원고: ${c.nickname}\n원하는판결: ${c.desiredVerdict||'없음'}`;
  const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const reception = await gen(model, `당신은 소소킹 판결소 접수관입니다. 아래 사건을 접수하는 공식 문서를 작성하세요.

톤: 겉으로는 극도로 진지한 법원 공문서(사건번호 "소소 2026-제○○○○호" 부여, 접수일자, 담당부서 표기), 속으로는 읽을수록 웃음 터지는 유머.
필수 포인트:
- 사소한 일상을 세기의 대사건처럼 포장 (예: "본 건은 2026년 대한민국 사법 역사에 족적을 남길 만한 중대 사안으로...")
- 원고 접수 당시 모습 묘사 1개 (예: "접수 당시 원고의 오른쪽 눈썹이 분노로 0.3cm 솟아오른 것을 육안 확인")
- 쓸데없이 구체적인 각주 1개 ("※ 단, 본 접수는 신라면에 한하며 진라면은 별건으로 본다." 류)
- 분량: 2문단, 너무 길지 않게. 읽으면서 피식하는 포인트 최소 3개.
오락 목적, 법적 효력 없음.

${ctx}`);
    await db.doc(`results/${caseId}`).set({ reception }, { merge: true });

    const investigation = await gen(model, `당신은 소소킹 판결소의 수사관입니다. 아래 사건의 수사보고서를 작성하세요.

톤: 진지한 경찰 수사보고서 양식 + 과몰입 개그.
필수 포함:
- 증거물 목록 3개 (황당할수록 좋음. 예: "증거1호: 피고가 보낸 'ㅇㅋ' 2글자 카톡 스크린샷")
- 현장 CCTV 분석 1줄 (어이없는 디테일. 예: "CCTV 분석 결과 피고 해당 시각 하품 3회, 기지개 1회 확인")
- 목격자 진술 1줄 (이상한 목격자. 예: "편의점 알바생 김○○(22): '그냥 평범하게 과자 고르는 줄 알았다'")
- 수사관 최종 소견 한 줄 ("본 수사관 소견: 원고 꽤 억울함." 같은)
- 분량: 2문단. 피식 포인트 3개 이상.
오락 목적, 법적 효력 없음.

${ctx}`);
    await db.doc(`results/${caseId}`).set({ investigation }, { merge: true });

    const plaintiffArg = await gen(model, `당신은 원고 측 변호사입니다. 아래 사건을 격정적으로 변호하세요.

톤: 법정 영화 주인공처럼 과장된 열변 + 정색 개그.
필수 포인트:
- "존경하는 재판장님"으로 시작
- "이것은 단순한 ○○가 아닙니다" 클리셰 1회 이상 사용
- 원고의 피해를 터무니없이 과장 (예: "원고는 그날 이후 3주간 햄버거 냄새도 맡지 못했습니다")
- 감정 지문 1~2개 ((목이 멘 채), (책상을 살짝 두드리며), (주먹을 꽉 쥐며))
- 마지막 한 문장은 울림 있는 판결 촉구 선언, 근데 어딘가 웃김
- 분량: 2문단. 진지할수록 웃겨야 함.
오락 목적, 법적 효력 없음.

${ctx}`);
    await db.doc(`results/${caseId}`).set({ plaintiffArg }, { merge: true });

    const defendantArg = await gen(model, `당신은 피고 측 변호사입니다. 아래 사건에서 피고를 변호하세요.

톤: "이런 걸로 법정까지 왔냐"는 어이없음 + 억지 논리로 당당하게 무죄 주장.
필수 포인트:
- "피고는 억울합니다"로 시작
- 황당한 알리바이 또는 억지 논리 1개 ("피고는 그날 단지 배가 고팠을 뿐입니다" 류)
- 원고 주장을 살짝 비꼬되 품위는 유지 ("원고의 감정은 충분히 이해합니다만,")
- 있지도 않은 판례 1개 인용 ("대법원 2023도48291 판결에 따르면 '냉면에 고명이 부실하다는 사유로는 기소가 성립하지 아니한다'고 하였으며,")
- 분량: 2문단. 뻔뻔할수록 웃김.
오락 목적, 법적 효력 없음.

${ctx}`);
    await db.doc(`results/${caseId}`).set({ defendantArg, judgeType }, { merge: true });

    const verdict = await gen(model, `${JUDGE_PROMPTS[judgeType]}\n\n아래 사건에 대한 최종 판결문을 작성하세요. 실제 법원 판결문처럼 진지하게, 판결 이유와 근거 포함, 3~4문단.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ verdict }, { merge: true });

    const sentence = await gen(model, `${JUDGE_PROMPTS[judgeType]}

위 사건에 대한 "생활형 처분"을 내려주세요.

절대 규칙:
1. 정확히 한 문장. 마침표 하나로 끝.
2. 30자 이내. 초과 시 실패.
3. "피고는 ...한다." 형식 고정.
4. 서두·이유·설명·부연·판시사항 전부 금지. 오직 처분만.
5. 시각적으로 바로 그림 그려지는 구체적 행위.
6. 웃음 포인트 핵심 하나만 꽂고 끝낼 것.

나쁜 예(길고 장황함): "피고는 본 판결의 취지를 깊이 숙고하여 향후 30일간 본인의 행위를 반성하는 의미로 라면의 섭취를 자제하여야 한다."
좋은 예: "피고는 30일간 라면 국물을 끊는다."
좋은 예: "피고는 일주일간 엘리베이터에서 인사만 한다."
좋은 예: "피고는 3일간 카톡에 'ㅇㅋ'만 쓴다."

오직 한 문장만 출력. 따옴표·번호·설명 없이.

${ctx}`);
    await db.doc(`results/${caseId}`).set({ sentence }, { merge: true });

    await db.doc(`cases/${caseId}`).update({ status: 'completed' });
  } catch (err) {
    await db.doc(`cases/${caseId}`).update({ status: 'error', errorMessage: err.message || '알 수 없는 오류' });
    throw err;
  } finally {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(1),
        firestoreReads: FieldValue.increment(2),
        firestoreWrites: FieldValue.increment(8 + totals.requests),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }
  return { success: true };
});
