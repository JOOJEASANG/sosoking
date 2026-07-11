const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cleanText, cleanParagraph, buildCaseAnalysis } = require('./case-analysis');

const ROLE_TRIAL_VERSION = 'role-based-trial-v10';
const MODEL_NAME = 'gemini-2.5-flash';

const COURTROOMS = [
  '제404호 황당법정',
  '제101호 사소분쟁법정',
  '제777호 과몰입법정',
  '제3호 억울함전담법정',
];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const JUDGE_PERSONA = {
  '드립형': '실제 판결문 말투는 유지하되 사건의 구체적인 장면에서 짧은 드립을 만든다. 억지 단어 합성은 피한다.',
  '과몰입형': '사소한 사건을 지나치게 중대한 사건처럼 다루되, 과장의 근거는 반드시 원문 속 행동과 물건이어야 한다.',
  '논리집착형': '시간, 순서, 선택 가능성, 거리와 행동을 말도 안 되게 세밀하게 나눠 판단한다. 과한 분석 자체가 웃음이 되게 한다.',
  '엄벌주의형': '사소한 잘못도 엄중하게 본다. 단호한 어투와 지나친 처분의 낙차로 웃긴다.',
  '감성형': '원고가 잃은 기분과 기대를 크게 다룬다. 따뜻하지만 지나치게 감정이입한다.',
  '현실주의형': '현실적으로 별일 아닐 수 있음을 인정하면서도 생활 밀착형 해결책을 이상하게 진지하게 제시한다.',
  '피곤형': '재판장도 어이없어하면서 판결한다. 건조한 한숨과 현실적인 툴툴거림으로 웃긴다.',
};

const BANNED_PHRASES = [
  '생활질서 이탈', '사회적 신뢰', '관계기관 긴급 소집', '국가적 재난',
  '사건의 크기보다', '한 번의 확인이면', '확인 먼저 행동 나중',
  '원상회복과 재발방지', '정식 분쟁으로 성장', '사소한 행동 하나가',
  '기록 보존 가치', '생활형 증거', '평화가 사라졌다', '성공했지만 실패했다',
];

function cleanLong(value, maxLength = 7000) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function sanitize(value, maxLength = 7000) {
  let output = cleanLong(value, maxLength)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('프롬프트', '접수조서')
    .replaceAll('사용자 입력', '접수진술');
  for (const phrase of BANNED_PHRASES) output = output.replaceAll(phrase, '');
  return output.replace(/ {2,}/g, ' ').trim();
}

function parseJson(text) {
  const source = String(text || '').replace(/```json|```/gi, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Role trial JSON not found');
  return JSON.parse(source.slice(start, end + 1));
}

function pickFrom(values, seed = '') {
  let score = 0;
  const source = String(seed || 'sosoking');
  for (let index = 0; index < source.length; index += 1) {
    score = (score + source.charCodeAt(index) * (index + 1)) % 9973;
  }
  return values[Math.abs(score) % values.length];
}

function list(value, fallback = [], max = 8, length = 260) {
  const source = Array.isArray(value) ? value : [];
  const rows = source.map(item => sanitize(item, length)).filter(Boolean).slice(0, max);
  for (const item of fallback) {
    if (rows.length >= max) break;
    if (item && !rows.includes(item)) rows.push(item);
  }
  return rows;
}

function makeDocketNumber(caseId, date = new Date()) {
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(date);
  const tail = String(caseId || '').replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase().padStart(6, '0');
  return `${year}황당${tail}`;
}

function assignCourt(caseData, caseId) {
  const seed = `${caseData.title || ''}:${caseId}`;
  return {
    courtName: '소소킹 황당재판소',
    courtroom: pickFrom(COURTROOMS, seed),
    division: '제3황당재판부',
    recordClerk: pickFrom(CLERKS, `${seed}:clerk`),
    analystName: pickFrom(ANALYSTS, `${seed}:analyst`),
    prosecutorName: pickFrom(PROSECUTORS, `${seed}:prosecutor`),
    defenderName: pickFrom(DEFENDERS, `${seed}:defender`),
    judgeType: caseData.judgeType || '드립형',
  };
}

function fallbackTrial(caseData, court, docketNumber) {
  const title = cleanText(caseData.title, 90) || '소소한 황당사건';
  const description = cleanParagraph(caseData.caseDescription, 1200) || title;
  const actor = cleanText(caseData.defendantName, 40) || '피고 측';
  return normalizeTrial({
    refinedCaseTitle: title,
    expandedCase: `접수조서에 따르면 ${description}\n재판부는 원고가 실제로 겪은 행동과 결과를 중심으로 본 사건을 심리하기로 했다.`,
    caseTimeline: `수사 진행기록\n1. 원고의 접수진술을 확인했다.\n2. 피고 측의 행동과 사건 결과를 시간순으로 재구성했다.\n3. 원고가 요구한 해결방안과 피고 측의 가능한 항변을 분리했다.`,
    forensicReport: `예능용 가상 감식보고서\n접수진술을 기준으로 사건 동선과 행동 순서를 재구성했다. 실제 CCTV나 실물 증거를 확인한 것은 아니며, 황당재판 형식을 위한 가상 기록이다.`,
    plaintiffArg: `원고 측은 ${description}라는 이유로 자신의 몫과 기대가 침해됐다고 주장한다.`,
    defendantArg: `${actor} 측은 고의적인 방해가 아니라 순간적인 판단 또는 상황 오해였다고 항변한다.`,
    courtOpinion: `${court.judgeType} 재판부는 사건의 결과가 실제로 발생했고 원고가 요구한 회복이 사건과 관련된다는 점을 인정한다.`,
    sentence: `주문\n1. 피고 측은 접수 내용에서 확인되는 행동과 결과를 구체적으로 인정하고 사과하라.\n2. 피고 측은 원고가 요구한 해결방안을 사건 범위 안에서 이행하라.\n3. 양측은 같은 상황이 반복될 때 사용할 한 문장짜리 사전 확인 절차를 정하라.`,
    closingComment: '재판장 한마디: “사소한 사건일수록 설명은 구체적이어야 합니다.”',
    absurdDetails: ['접수진술과 결과 사이의 연결', '피고 측 행동의 타이밍', '원고가 실제로 잃은 몫', '요구한 해결방안의 실행 가능성'],
    evidenceBits: ['접수된 사건 설명', '원고가 지정한 피고', '사건 뒤 발생한 실제 결과', '원고가 요청한 황당 처분'],
    defendantExcuses: ['고의는 아니었다는 항변', '상황을 다르게 이해했다는 항변', '결과가 이 정도일 줄 몰랐다는 항변'],
    penaltyIdeas: ['구체적인 사과', '사건 대상의 회복', '같은 상황의 접근 제한', '재발 시 한 단계 더 진지한 재심'],
  }, {}, title, court, docketNumber);
}

function normalizeTrial(raw = {}, fallback = {}, caseTitle, court, docketNumber) {
  const source = { ...fallback, ...raw };
  const title = cleanText(caseTitle || source.refinedCaseTitle, 90) || '소소한 황당사건';
  let forensicReport = sanitize(source.forensicReport, 7000);
  if (forensicReport && !/가상|예능용|재구성/.test(forensicReport)) {
    forensicReport = `※ 아래 감식 내용은 오락용 황당재판을 위한 가상 재구성이며 실제 CCTV·실물 증거 확인 결과가 아닙니다.\n\n${forensicReport}`;
  }
  return {
    resultVersion: ROLE_TRIAL_VERSION,
    docketNumber,
    ...court,
    refinedCaseTitle: title,
    expandedCase: sanitize(source.expandedCase, 7600),
    caseTimeline: sanitize(source.caseTimeline, 7000),
    forensicReport,
    plaintiffArg: sanitize(source.plaintiffArg, 6200),
    defendantArg: sanitize(source.defendantArg, 6200),
    courtOpinion: sanitize(source.courtOpinion, 6200),
    sentence: sanitize(source.sentence, 5200),
    closingComment: sanitize(source.closingComment, 520),
    absurdDetails: list(source.absurdDetails, fallback.absurdDetails, 10, 260),
    evidenceBits: list(source.evidenceBits, fallback.evidenceBits, 8, 260),
    defendantExcuses: list(source.defendantExcuses, fallback.defendantExcuses, 5, 300),
    penaltyIdeas: list(source.penaltyIdeas, fallback.penaltyIdeas, 6, 300),
  };
}

function sourceAnchors(caseData) {
  const source = `${caseData.title || ''} ${caseData.caseDescription || ''} ${caseData.defendantName || ''}`;
  return [...new Set(source.match(/[가-힣A-Za-z0-9]{2,}/g) || [])]
    .filter(word => !['그리고', '그런데', '때문에', '있었다', '했다', '하였다', '사건'].includes(word))
    .slice(0, 18);
}

function validateTrial(trial, caseData) {
  const failures = [];
  const combined = [trial.expandedCase, trial.caseTimeline, trial.forensicReport, trial.plaintiffArg, trial.defendantArg, trial.courtOpinion, trial.sentence].join(' ');
  const anchors = sourceAnchors(caseData);
  const anchorHits = anchors.filter(anchor => combined.includes(anchor)).length;
  if (trial.expandedCase.length < 180) failures.push('사건 접수기록이 너무 짧음');
  if (trial.caseTimeline.length < 220) failures.push('수사 타임라인이 너무 짧음');
  if (trial.forensicReport.length < 220) failures.push('감식보고서가 너무 짧음');
  if (trial.plaintiffArg.length < 120) failures.push('원고 주장이 너무 짧음');
  if (trial.defendantArg.length < 120) failures.push('피고 변론이 너무 짧음');
  if (trial.courtOpinion.length < 220) failures.push('재판부 판단이 너무 짧음');
  if (trial.sentence.length < 180 || !/1\.|1번|제1/.test(trial.sentence) || !/3\.|3번|제3/.test(trial.sentence)) failures.push('주문 3개가 불완전함');
  if (trial.evidenceBits.length < 4) failures.push('증거 목록 부족');
  if (trial.absurdDetails.length < 5) failures.push('황당 디테일 부족');
  if (anchors.length && anchorHits < Math.min(4, anchors.length)) failures.push('접수 내용의 고유 단서 반영 부족');
  if (!/가상|예능용|재구성/.test(trial.forensicReport)) failures.push('가상 감식 고지 누락');
  if (BANNED_PHRASES.some(phrase => combined.includes(phrase))) failures.push('상투문구 포함');
  return { passed: failures.length === 0, failures, anchorHits, anchorCount: anchors.length };
}

function buildPrompt(caseData, court, docketNumber, previousFailures = []) {
  const title = cleanText(caseData.title, 90) || '소소한 황당사건';
  const description = cleanParagraph(caseData.caseDescription, 1500);
  const desiredVerdict = cleanParagraph(caseData.desiredVerdict, 260) || '없음';
  const persona = JUDGE_PERSONA[court.judgeType] || JUDGE_PERSONA['드립형'];
  const repair = previousFailures.length ? `\n이전 결과의 탈락 사유: ${previousFailures.join(', ')}. 같은 문제를 반드시 고쳐라.\n` : '';

  return `너는 소소킹 황당재판소의 역할 분리형 예능 재판 시스템이다. 실제 법률 조언이 아니라, 사용자의 사소한 사건을 지나치게 진지한 수사·재판 문서로 확대해 웃음을 만드는 역할극을 JSON으로만 작성한다.

[사건 정보]
사건번호: ${docketNumber}
사건명: ${title}
접수 내용: ${description}
피고: ${cleanText(caseData.defendantName, 50) || '접수 내용에서 정확히 특정'}
원하는 처분: ${desiredVerdict}
억울함: ${Number(caseData.grievanceIndex || 5)}/10
재판장 성향: ${court.judgeType}
재판장 문체: ${persona}
담당자: ${JSON.stringify(court)}
${repair}
[가장 중요한 원칙]
1. 첫 문단에서 반드시 누가 무엇을 어떻게 했고 원고에게 어떤 결과가 생겼는지 정확히 파악해 적는다.
2. 사건명만 보고 추측하지 말고 접수 내용의 구체적인 물건, 장소, 행동, 순서, 결과를 반복해서 활용한다.
3. 개그 엔진은 '사소한 사건'과 '지나치게 진지한 관료적 형식'의 낙차다. 짧은 드립 몇 줄이 아니라 접수→수사→감식→공방→판단→주문 전체가 하나의 재판극이어야 한다.
4. 수사기록에는 접수 내용에서 자연스럽게 파생되는 엉뚱한 단서, 가상 CCTV 프레임 분석, 동선 재구성, 가짜 감식 수치 중 2개 이상을 넣는다.
5. 가상 CCTV·수치·정황은 반드시 '황당재판용 가상 재구성'임을 문서 안에서 밝힌다. 실제 확인된 사실처럼 속이지 않는다.
6. 구체적인 시각이나 수치를 창작할 수 있지만 현실 사실이 아니라 예능용 재구성임이 드러나야 한다. 숫자는 사건의 타이밍과 행동을 웃기게 확대하는 데만 사용한다.
7. 원고 측은 억울함을 최대치로 밀어붙이고, 피고 측은 말도 안 되지만 자기 안에서는 일관된 독립 논리로 뻔뻔하게 항변한다.
8. 재판부 판단보다 주문이 더 과감해야 하며, 주문 1→2→3으로 갈수록 더 구체적이고 터무니없어진다. 그래도 사건 내용과 연결되어야 한다.
9. ${court.judgeType} 성격이 courtOpinion, sentence, closingComment에서 확실히 달라야 한다.
10. 생활질서, 사회적 신뢰, 국가적 재난, 원상회복과 재발방지 같은 시스템 문구를 쓰지 않는다.
11. 같은 문장을 필드마다 반복하지 않는다. 각 담당자가 실제로 다른 글을 쓴 것처럼 어휘와 관점을 바꾼다.
12. 원문에 없는 핵심 사건 자체를 새로 만들지 않는다. 상상은 수사 방식, 증거 이름, 감식 수치, 처분의 형태에만 사용한다.

[역할별 작성]
- expandedCase: 접수 담당자가 사건의 핵심과 이상한 지점을 3~5문단으로 정리한다. 첫 문단에서 사건을 정확히 파악한 것이 보여야 한다.
- caseTimeline: ${court.analystName}이 시간순 수사기록을 작성한다. 최소 5단계이며 각 단계에 구체적 행동과 관찰을 넣는다.
- forensicReport: 예능용 가상 감식보고서다. 가상 CCTV 또는 영상 프레임, 동선, 감식 수치, 증거물 분석을 사건에 맞게 3개 이상 작성한다.
- evidenceBits: 사건 전용 엉뚱한 증거 이름 4~8개. 각 항목은 무엇을 보여주는지까지 한 문장으로 쓴다.
- plaintiffArg: ${court.prosecutorName}이 원고 측을 대리해 구체적 피해와 억울함을 과장한다.
- defendantArg: ${court.defenderName}이 피고 측을 대리해 독립적인 반박 논리를 세운다.
- courtOpinion: 재판부가 쟁점을 나누고, 이 사건만의 이상한 판단 기준을 하나 만들어 적용한다.
- sentence: '주문 1., 2., 3.' 형식. 마지막 주문이 가장 기억에 남아야 한다.
- closingComment: 재판장 성격이 드러나는 짧고 인용하고 싶은 마지막 한마디.
- absurdDetails: 사건에서 뽑아낸 황당한 관찰 6~10개.
- defendantExcuses: 피고 측 변명 3~5개.
- penaltyIdeas: 사건 맞춤형 처분 후보 4~6개.

JSON 형식:
{
  "refinedCaseTitle": "사용자가 정한 사건명을 그대로 사용",
  "expandedCase": "접수 담당 기록",
  "caseTimeline": "시간순 수사 진행기록",
  "forensicReport": "예능용 가상 감식보고서",
  "plaintiffArg": "원고 측 주장",
  "defendantArg": "피고 측 변론",
  "courtOpinion": "재판부 판단",
  "sentence": "주문 1. ...\\n주문 2. ...\\n주문 3. ...",
  "closingComment": "재판장 한마디",
  "absurdDetails": ["황당한 관찰"],
  "evidenceBits": ["증거 이름과 의미"],
  "defendantExcuses": ["피고 변명"],
  "penaltyIdeas": ["처분 후보"]
}
JSON 외에는 출력하지 마라.`;
}

function usageFromResponse(response) {
  const meta = response?.usageMetadata || {};
  return {
    promptTokens: Number(meta.promptTokenCount || 0),
    outputTokens: Number(meta.candidatesTokenCount || 0),
    totalTokens: Number(meta.totalTokenCount || 0),
  };
}

function parseOrders(sentence) {
  const source = String(sentence || '');
  const matches = [...source.matchAll(/(?:주문\s*)?(\d+)[.)번항\s:-]+([\s\S]*?)(?=(?:\n\s*(?:주문\s*)?\d+[.)번항\s:-]+)|$)/g)];
  const orders = matches.slice(0, 3).map((match, index) => ({ number: index + 1, text: cleanLong(match[2], 500) })).filter(item => item.text);
  if (orders.length === 3) return orders;
  return source.split('\n').map(line => line.trim()).filter(Boolean).slice(-3).map((text, index) => ({ number: index + 1, text: text.replace(/^주문\s*\d+[.)번항\s:-]*/, '') }));
}

function buildCompatibilityJudgment(trial, caseData) {
  const details = trial.absurdDetails.slice(0, 3);
  while (details.length < 3) details.push(trial.closingComment || '재판부는 본 사건의 어이없음을 공식 기록했다.');
  return {
    engineVersion: 4,
    headline: trial.refinedCaseTitle,
    incidentLevel: `억울함 ${Number(caseData.grievanceIndex || 5)}/10 · ${trial.courtroom}`,
    opening: trial.expandedCase,
    comedyLines: details,
    summary: trial.expandedCase,
    facts: trial.caseTimeline,
    investigation: trial.forensicReport,
    plaintiffClaim: trial.plaintiffArg,
    defendantClaim: trial.defendantArg,
    opinion: trial.courtOpinion,
    orders: parseOrders(trial.sentence),
    closingComment: trial.closingComment.replace(/^재판장\s*한마디\s*[:：]?\s*/, ''),
    legalNotice: '본 기록의 CCTV·감식·수치 표현은 오락용 가상 재구성이며 실제 법률문서나 사실확인 자료가 아닙니다.',
  };
}

function isCompleteRoleTrial(trial) {
  return Boolean(
    trial?.resultVersion === ROLE_TRIAL_VERSION
    && trial?.docketNumber
    && trial?.expandedCase
    && trial?.caseTimeline
    && trial?.forensicReport
    && trial?.plaintiffArg
    && trial?.defendantArg
    && trial?.courtOpinion
    && trial?.sentence
    && trial?.closingComment
  );
}

async function generateRoleBasedTrial({ caseData, caseId, apiKey }) {
  const docketNumber = caseData.docketNumber || makeDocketNumber(caseId);
  const court = assignCourt(caseData, caseId);
  const fallback = fallbackTrial(caseData, court, docketNumber);
  const analysis = buildCaseAnalysis(caseData);
  if (!apiKey) {
    return {
      trialRecord: fallback,
      judgment: buildCompatibilityJudgment(fallback, caseData),
      caseAnalysis: analysis,
      generationMode: 'local-role-based-trial-v10',
      quality: validateTrial(fallback, caseData),
      aiAttempts: 0,
      usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 1.2,
      topP: 0.97,
      topK: 48,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json',
    },
  });

  let attempts = 0;
  let usage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  let failures = [];
  for (let round = 0; round < 2; round += 1) {
    attempts += 1;
    try {
      const result = await model.generateContent(buildPrompt(caseData, court, docketNumber, failures));
      const currentUsage = usageFromResponse(result.response);
      usage = {
        promptTokens: usage.promptTokens + currentUsage.promptTokens,
        outputTokens: usage.outputTokens + currentUsage.outputTokens,
        totalTokens: usage.totalTokens + currentUsage.totalTokens,
      };
      const trialRecord = normalizeTrial(parseJson(result.response.text()), fallback, caseData.title, court, docketNumber);
      const quality = validateTrial(trialRecord, caseData);
      if (quality.passed) {
        return {
          trialRecord,
          judgment: buildCompatibilityJudgment(trialRecord, caseData),
          caseAnalysis: analysis,
          generationMode: 'gemini-role-based-trial-v10',
          quality: { ...quality, pipeline: ROLE_TRIAL_VERSION },
          aiAttempts: attempts,
          usage,
        };
      }
      failures = quality.failures;
    } catch (error) {
      failures = [cleanText(error?.message, 180) || 'JSON 생성 오류'];
    }
  }

  return {
    trialRecord: fallback,
    judgment: buildCompatibilityJudgment(fallback, caseData),
    caseAnalysis: analysis,
    generationMode: 'local-role-based-trial-v10',
    quality: { ...validateTrial(fallback, caseData), pipeline: 'role-trial-fallback', rejectedReasons: failures },
    aiAttempts: attempts,
    usage,
  };
}

module.exports = {
  ROLE_TRIAL_VERSION,
  MODEL_NAME,
  makeDocketNumber,
  assignCourt,
  fallbackTrial,
  normalizeTrial,
  validateTrial,
  buildPrompt,
  buildCompatibilityJudgment,
  isCompleteRoleTrial,
  generateRoleBasedTrial,
};
