const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocument(value, maxLen) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

function normalizeCaseTitle(value, description = '') {
  let title = cleanText(value, 32)
    .replace(/["“”'`]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (!title || title === 'AI 사건명 작성 중') {
    title = cleanText(description, 22)
      .replace(/^(오늘|어제|방금|아까)\s*/g, '')
      .replace(/[.!?].*$/g, '')
      .replace(/(했어요|했습니다|했다|해요|합니다)$/g, '')
      .trim();
  }

  if (!title) title = '정체불명 생활분쟁';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return cleanText(title, 32);
}

function safeJson(text) {
  const raw = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON 형식을 찾을 수 없습니다.');
  return JSON.parse(raw.slice(start, end + 1));
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed.caseTitle, description),
    reception: cleanDocument(parsed.reception, 1400),
    investigation: cleanDocument(parsed.investigation, 1800),
    plaintiffArg: cleanDocument(parsed.plaintiffArg, 1600),
    defendantArg: cleanDocument(parsed.defendantArg, 1600),
    verdict: cleanDocument(parsed.verdict, 2600)
  };
}

function isGoodResult(data) {
  return Boolean(
    data.caseTitle.length >= 6
    && data.reception.length >= 90
    && data.investigation.length >= 130
    && data.plaintiffArg.length >= 100
    && data.defendantArg.length >= 100
    && data.verdict.length >= 190
    && /주문|판결/.test(data.verdict)
  );
}

function buildPrompt(caseDescription, retry = false) {
  return `당신은 '소소킹 판결소'의 생활사건 기록관이자 코미디 판결문 작가다.
사용자가 적은 사소한 생활분쟁을 읽고, 실제 사건보고서·내용증명·판결문처럼 정돈된 문서 형식으로 작성하라.
형식은 진지하고 공식적이어야 하지만, 내용은 사건 사실에서 나온 웃음코드가 충분히 들어가야 한다.

[사건 내용]
${caseDescription}

[핵심 원칙]
- 사용자가 적지 않은 사실을 중대한 사실처럼 단정하지 않는다.
- 실제 법률 자문, 실제 법원 판결, 실제 법적 효력이 있는 문서처럼 주장하지 않는다.
- 실제 법령 조문이나 실제 기관명은 인용하지 않는다.
- 욕설, 혐오, 모욕, 신상정보 재현은 하지 않는다.
- 면책 문구나 시스템 안내 문구를 본문에 반복하지 않는다.
- 웃음은 '사소한 일을 지나치게 엄숙하게 다루는 태도', '증거의 과잉 해석', '양측의 뻔뻔하지만 그럴듯한 주장'에서 만든다.
- 모든 문단은 이 사건의 구체적인 사물·행동·말투를 반영한다.
- 각 항목마다 최소 두 번 이상 자연스러운 웃음 포인트를 넣되, 유치한 말장난만 반복하지 않는다.

[출력 형식]
반드시 아래 여섯 필드만 가진 JSON 객체로 출력한다.

1. caseTitle
- 사건 내용을 즉시 알아볼 수 있는 8~24자의 사건명
- 핵심 대상과 행동이 드러나야 한다
- 반드시 '사건'으로 끝낸다
- 예: '마지막 치킨 한 조각 무단처분 사건'

2. reception
- 실제 '사건접수보고서'처럼 작성
- 접수취지, 사건개요, 접수의견이 자연스럽게 드러나는 2~4문단
- 사소한 사건이 정식 사건으로 접수되는 과정 자체가 웃겨야 한다

3. investigation
- 실제 '수사보고'처럼 작성
- 확인된 정황, 주요 증거, 당사자 진술의 모순, 조사관 의견을 포함
- 빈 접시, 읽음 표시, 사라진 리모컨 같은 하찮은 물증을 과학수사급으로 분석
- 3~5문단

4. plaintiffArg
- 실제 내용증명 또는 준비서면의 '원고 주장'처럼 작성
- 청구취지와 주장요지를 포함
- 원고가 진지하게 억울함을 주장하지만 과몰입한 표현에서 웃음이 나도록 작성
- 2~4문단

5. defendantArg
- 실제 답변서의 '피고 변론'처럼 작성
- 답변취지와 항변요지를 포함
- 피고가 말이 되는 듯 안 되는 듯한 논리로 방어하도록 작성
- 원고 주장과 같은 농담을 반복하지 않는다
- 2~4문단

6. verdict
- 실제 판결문의 '주문'과 '이유' 형식으로 작성
- 첫 부분에 반드시 '주문'을 명시하고, 실행 가능한 웃긴 생활형 처분을 선고한다
- 이어서 사실관계, 재판부 판단, 양측 주장에 대한 판단을 포함
- 마지막에는 지나치게 근엄한 생활형 교훈 또는 재판부 한마디를 넣는다
- 5~8문단

${retry ? '[재작성 지시]\n이전 응답은 분량이 짧거나 문서 구조가 부족했다. 각 항목을 사건 사실에 맞게 더 구체적이고 풍부하게 다시 작성하라.' : ''}`;
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

exports.generateTrial = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB'
}, async request => {
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

  if (c.status === 'completed') {
    const resultSnap = await resultRef.get();
    if (resultSnap.exists) return { success: true, skipped: 'completed' };
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status === 'processing') {
    const started = c.processingStartedAt?.toMillis ? c.processingStartedAt.toMillis() : 0;
    if (started && Date.now() - started < 10 * 60 * 1000) {
      return { success: true, skipped: 'processing' };
    }
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status !== 'pending') {
    throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');
  }

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
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  const latest = await caseRef.get();
  if (latest.data()?.status !== 'processing') {
    return { success: true, skipped: latest.data()?.status || 'unknown' };
  }

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.95,
      topP: 0.95,
      maxOutputTokens: 3600,
      responseMimeType: 'application/json'
    }
  });

  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let data = null;
  let lastError = null;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await model.generateContent(buildPrompt(cleanText(c.caseDescription, 600), attempt > 0));
        const meta = result.response.usageMetadata || {};
        totals.requests += 1;
        totals.inputTokens += Number(meta.promptTokenCount || 0);
        totals.outputTokens += Number(meta.candidatesTokenCount || 0);

        const parsed = safeJson(result.response.text());
        const candidate = normalizeResult(parsed, c.caseDescription);

        if (!isGoodResult(candidate)) {
          throw new Error('AI 판결문 분량 또는 문서 구조가 부족합니다.');
        }

        data = candidate;
        break;
      } catch (err) {
        lastError = err;
        console.error(`generateTrial attempt ${attempt + 1} failed:`, err);
      }
    }

    if (!data) throw lastError || new Error('AI 판결문 생성 실패');

    const finalTitle = normalizeCaseTitle(data.caseTitle, c.caseDescription);
    const batch = db.batch();

    batch.set(resultRef, {
      source: 'user',
      userId: uid,
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 판결소',
      courtroom: '제404호 생활법정',
      division: '제3생활부',
      caseTitle: finalTitle,
      caseDescription: c.caseDescription || '',
      nickname: c.nickname || '익명 원고',
      judgeType: '소소킹 AI 재판부',
      reception: data.reception,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      verdict: data.verdict,
      sentence: '',
      aiSource: 'gemini',
      promptVersion: 'simple-document-v1',
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
      judgeType: '소소킹 AI 재판부',
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
      errorMessage: FieldValue.delete()
    });

    await batch.commit();

    return {
      success: true,
      isPublic,
      caseTitle: finalTitle
    };
  } catch (err) {
    console.error('generateTrial failed:', err);

    await caseRef.update({
      status: 'error',
      courtStage: 'error',
      errorMessage: 'AI 판결문을 완성하지 못했습니다. 잠시 후 다시 접수해 주세요.',
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete()
    }).catch(() => null);

    throw new HttpsError(
      'unavailable',
      'AI 판결문을 완성하지 못했습니다. 고정된 시스템 문구로 대신 저장하지 않았습니다. 잠시 후 다시 시도해 주세요.'
    );
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(data ? 1 : 0),
        firestoreReads: FieldValue.increment(4),
        firestoreWrites: FieldValue.increment(data ? 3 : 1),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }
});
