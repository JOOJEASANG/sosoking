const { onCall } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
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
    const reception = await gen(model, `당신은 소소킹 판결소 접수관입니다. 아래 사건을 공식 접수하는 문서를 작성하세요. 형식은 과하게 진지한 법원 공문서 톤, 내용은 사소한 일상 사건. 사건번호 부여 후 2~3문단.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ reception }, { merge: true });

    const investigation = await gen(model, `당신은 소소킹 판결소 수사관입니다. 아래 사건의 수사기록을 작성하세요. 증거물 목록, 현장진술 포함, 경찰 수사보고서 톤으로 2~3문단.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ investigation }, { merge: true });

    const plaintiffArg = await gen(model, `당신은 원고 측 변호사입니다. 아래 사건에서 원고 입장을 극적으로 변호하는 법정 주장을 작성하세요. 격정적이고 과하게 진지하게 2~3문단.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ plaintiffArg }, { merge: true });

    const defendantArg = await gen(model, `당신은 피고 측 변호사입니다. 아래 사건에서 피고를 나름의 논리로 변호하는 법정 주장을 작성하세요. 유머러스하게 반박하되 진지한 톤으로 2~3문단.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ defendantArg, judgeType }, { merge: true });

    const verdict = await gen(model, `${JUDGE_PROMPTS[judgeType]}\n\n아래 사건에 대한 최종 판결문을 작성하세요. 실제 법원 판결문처럼 진지하게, 판결 이유와 근거 포함, 3~4문단.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ verdict }, { merge: true });

    const sentence = await gen(model, `${JUDGE_PROMPTS[judgeType]}\n\n위 사건에 대해 창의적인 생활형 처분을 한 문장으로만 내려주세요. 예: "피고는 향후 30일간 라면 국물 취식을 금지한다." 딱 한 문장만.\n\n${ctx}`);
    await db.doc(`results/${caseId}`).set({ sentence }, { merge: true });

    await db.doc(`cases/${caseId}`).update({ status: 'completed' });
  } catch (err) {
    await db.doc(`cases/${caseId}`).update({ status: 'error', errorMessage: err.message || '알 수 없는 오류' });
    throw err;
  }
  return { success: true };
});

async function gen(model, prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
