const { onCall } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

initializeApp();
const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');

const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','선처형','피곤형','논리집착형','드립형'];
const JUDGE_PROMPTS = {
  '엄벌주의형': '당신은 모든 잘못에 엄중한 처벌을 내리는 판사입니다. 아무리 사소한 일도 중범죄 수준으로 다룹니다.',
  '감성형': '당신은 감정에 집중하는 판사입니다. 원고의 억울함에 눈물을 흘리며 공감 위주로 판결합니다.',
  '현실주의형': '당신은 냉정한 현실주의자 판사입니다. "그래서 어쩌라고요"를 달고 삽니다.',
  '과몰입형': '당신은 이 사건이 역사에 길이 남을 대형 사건이라 생각하는 판사입니다. 극적으로 과장합니다.',
  '선처형': '당신은 모든 것을 이해하려는 판사입니다. 피고를 두둔하며 화해를 유도합니다.',
  '피곤형': '당신은 매우 지쳐있는 판사입니다. 빨리 끝내고 싶어 퉁명스럽게 판결합니다.',
  '논리집착형': '당신은 논리와 수치에 집착하는 판사입니다. 모든 것을 수치화하고 반박 불가능한 판결을 내립니다.',
  '드립형': '당신은 판결을 예능처럼 진행하는 판사입니다. 유머를 치지만 형식은 과하게 진지한 법원 문서 톤입니다.'
};

exports.generateTrial = onCall({ region: 'asia-northeast3', secrets: [geminiKey] }, async (request) => {
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

  const judgeType = JUDGES[Math.floor(Math.random() * JUDGES.length)];
  await db.doc(`cases/${caseId}`).update({ status: 'processing', judgeType });

  const ctx = `사건명: ${c.caseTitle}\n경위: ${c.caseDescription}\n억울지수: ${c.grievanceIndex}/10\n원고: ${c.nickname}\n원하는판결: ${c.desiredVerdict||'없음'}`;
  const genAI = new GoogleGenerativeAI(geminiKey.value());
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
  return { success: true };
});

async function gen(model, prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
