const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cleanText, cleanParagraph, buildCaseAnalysis } = require('./case-analysis');

const ROLE_TRIAL_VERSION = 'role-based-trial-v10';
const MODEL_NAME = 'gemini-2.5-flash';

const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const JUDGE_PERSONA = {
  '드립형': '실제 판결문 말투는 유지하되 사건의 구체적인 장면에서 짧은 드립을 만든다. 억지 단어 합성은 피한다.',
  '과몰입형': '사소한 사건을 지나치게 중대한 사건처럼 다루되 과장의 근거는 반드시 원문 속 행동과 물건이어야 한다.',
  '논리집착형': '시간, 순서, 선택 가능성, 거리와 행동을 말도 안 되게 세밀하게 나눠 판단한다.',
  '엄벌주의형': '사소한 잘못도 엄중하게 본다. 단호한 어투와 지나친 처분의 낙차로 웃긴다.',
  '감성형': '원고가 잃은 기분과 기대를 크게 다룬다. 따뜻하지만 지나치게 감정이입한다.',
  '현실주의형': '현실적으로 별일 아닐 수 있음을 인정하면서 생활 밀착형 해결책을 이상하게 진지하게 제시한다.',
  '피곤형': '재판장도 어이없어하면서 판결한다. 건조한 한숨과 툴툴거림으로 웃긴다.',
};

const BANNED_PHRASES = [
  '생활질서 이탈', '사회적 신뢰', '관계기관 긴급 소집', '국가적 재난',
  '사건의 크기보다', '한 번의 확인이면', '확인 먼저 행동 나중',
  '원상회복과 재발방지', '정식 분쟁으로 성장', '사소한 행동 하나가',
  '기록 보존 가치', '생활형 증거', '평화가 사라졌다', '성공했지만 실패했다',
];

function cleanLong(value, maxLength = 7000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
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
  for (let index = 0; index < source.length; index += 1) score = (score + source.charCodeAt(index) * (index + 1)) % 9973;
  return values[Math.abs(score) % values.length];
}

function seedNumber(seed = '') {
  let score = 17;
  for (let index = 0; index < String(seed).length; index += 1) score = (score * 31 + String(seed).charCodeAt(index)) % 10007;
  return score;
}

function list(value, fallback = [], max = 8, length = 260) {
  const rows = (Array.isArray(value) ? value : []).map(item => sanitize(item, length)).filter(Boolean).slice(0, max);
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

function fallbackTrial(caseData, court, docketNumber) {
  const title = cleanText(caseData.title, 90) || '소소한 황당사건';
  const description = cleanParagraph(caseData.caseDescription, 1200) || title;
  const analysis = buildCaseAnalysis(caseData);
  const actor = cleanText(analysis.actor || caseData.defendantName, 60) || '피고 측';
  const target = cleanText(analysis.target, 60) || '사건 대상';
  const action = cleanParagraph(analysis.action, 260) || description;
  const consequence = cleanParagraph(analysis.consequence, 260) || '원고의 예정과 기대가 어긋났다';
  const remedy = cleanParagraph(caseData.desiredVerdict || analysis.remedy, 260) || `${target}에 관한 구체적인 사과와 보상`;
  const seed = seedNumber(`${title}:${description}:${actor}:${target}`);
  const frameStart = 120 + (seed % 280);
  const frameEnd = frameStart + 7 + (seed % 13);
  const attentionGap = ((seed % 23) + 7) / 10;
  const actionScore = 68 + (seed % 29);
  const controlScore = 21 + (seed % 37);

  return normalizeTrial({
    refinedCaseTitle: title,
    expandedCase: `접수담당 ${court.recordClerk}은 원고가 제출한 사건명 “${title}”과 접수진술을 대조했다. 접수 내용은 다음과 같다. ${description}\n\n기록을 행동 단위로 정리하면 ${action}. 그 결과 ${consequence}. 원고가 문제 삼는 지점은 단순히 기분이 상했다는 데 그치지 않고, ${target}을 둘러싼 자신의 예정과 선택이 피고의 행동보다 늦게 반영됐다는 데 있다.\n\n피고로 지목된 ${actor}에게는 설명할 기회가 있으나, 접수기록만 놓고 보면 사건의 시작과 결과가 서로 분명히 연결된다. 특히 원고가 요구한 처분은 “${remedy}”로 확인돼 재판부는 이 요구가 사건 내용과 얼마나 맞닿아 있는지 별도로 심리하기로 했다.\n\n따라서 본 기록철은 ${target}의 상태, ${actor}의 행동 순서, 원고가 실제로 겪은 결과를 중심으로 수사·감식·공방·선고 순서로 작성한다.`,
    caseTimeline: `수사 진행기록 — 담당 ${court.analystName}\n1. 접수 단계에서 원고의 원문을 문장별로 나누고 사건의 행위자를 ${actor}, 핵심 대상을 ${target}으로 특정했다.\n2. 행동 재구성 단계에서 “${action}”는 진술을 중심축으로 삼고, 원고가 행동을 예상하거나 허락했다는 내용이 있는지 확인했으나 접수문에서는 찾지 못했다.\n3. 황당재판용 가상 영상 재구성에서는 프레임 ${frameStart}번부터 ${frameEnd}번 사이를 사건 집중구간으로 지정했다. 이는 실제 CCTV 열람 결과가 아니라 접수진술의 순서를 시각화한 예능용 기록이다.\n4. 결과 확인 단계에서는 “${consequence}”는 점을 원고 측 최종 피해로 기록했다. 사건 행동은 짧았지만 원고가 뒤늦게 상황을 파악했다는 구조가 수사관의 과몰입 대상이 됐다.\n5. 처분 검토 단계에서는 원고의 요구 “${remedy}”와 피고 측 예상 항변을 분리했다. 수사관은 사과, 실제 회복, 같은 상황에서의 접근·행동 제한을 재판부 검토사항으로 넘겼다.`,
    forensicReport: `예능용 가상 감식보고서 — ${court.analystName}\n본 보고서는 실제 CCTV·휴대전화 영상·실물 증거를 확인한 결과가 아니라 접수진술을 바탕으로 만든 황당재판용 가상 재구성이다.\n\n가상 프레임 분석 결과 프레임 ${frameStart}번에서 원고의 주의가 ${target} 밖으로 이동한 것으로 설정했고, 프레임 ${frameEnd}번에서 ${actor}의 행동이 결과 단계에 도달한 것으로 표시했다. 두 지점의 간격은 재판부 임의 환산값 ${attentionGap.toFixed(1)}초이며 실제 측정 시간이 아니다.\n\n행동 추진력은 100점 만점에 ${actionScore}점, 상황 통제력은 ${controlScore}점으로 산출했다. 이 수치는 ${action}는 행동이 원고의 대응보다 얼마나 앞섰는지를 웃기게 설명하기 위한 가상 감식값이다. 감식반은 ${target} 관련 결정권이 피고에게 정식으로 넘어갔다는 흔적은 발견하지 못했으며, 남은 증거는 접수진술과 “${consequence}”는 결과뿐이라고 결론 냈다.`,
    plaintiffArg: `${court.prosecutorName}은 원고가 “${description}”라는 구체적인 일을 겪었고, 그 과정에서 ${consequence}고 주장한다. 원고가 ${actor}에게 ${target}을 처리하거나 결정할 권한을 줬다는 내용은 접수문 어디에도 없으며, 결과를 뒤늦게 알게 됐다는 사정이 억울함을 키웠다고 본다. 따라서 원고가 요구한 “${remedy}”는 과도한 보복이 아니라 사건으로 잃은 몫을 되찾기 위한 최소한의 요청이라고 주장한다.`,
    defendantArg: `${court.defenderName}은 ${actor}의 행동이 계획적인 방해가 아니라 순간적인 오인 또는 상황 판단의 실패였을 가능성을 제기한다. 피고 측은 ${target}이 자신의 행동 범위 안에 들어와 허용된 대상으로 착각했을 뿐, 원고에게 ${consequence}게 하려는 목적은 없었다고 항변한다. 다만 결과가 발생한 뒤 설명과 수습이 충분했는지에 대해서는 명확한 반박 자료를 내지 못했다.`,
    courtOpinion: `${court.judgeType} 재판부는 먼저 접수 내용에 적힌 행동과 가상 감식 내용을 구분한다. 실제 사실로 판단하는 부분은 “${action}”와 그 결과 “${consequence}”는 점이며, 프레임 번호와 감식 점수는 이 장면을 예능 형식으로 확대하기 위한 장치일 뿐이다.\n\n그럼에도 ${actor}의 행동이 원고의 선택보다 먼저 완료됐고, 원고가 요구한 “${remedy}”가 사건 대상 ${target}과 직접 연결된다는 점은 분명하다. 재판부는 고의가 확인되지 않았다는 사정은 처분 수위를 낮출 이유가 될 수 있지만, 이미 생긴 결과에 대한 설명과 회복까지 없앨 이유는 되지 않는다고 판단한다.\n\n이에 재판부는 피고 측에 사과와 실제 회복을 명하고, 마지막 주문에는 같은 장면이 다시 발생할 경우 현장에서 즉시 사용할 수 있는 지나치게 구체적인 행동 규칙을 붙이기로 한다.`,
    sentence: `주문 1. ${actor} 측은 “${action}”는 행동과 “${consequence}”는 결과를 빼놓지 말고 원고에게 구체적으로 사과하라.\n주문 2. ${actor} 측은 원고가 요구한 “${remedy}”를 사건 대상 ${target}의 실제 상태와 범위에 맞게 이행하라.\n주문 3. 같은 상황이 다시 발생하면 ${actor} 측은 ${target}에 손대거나 결정을 내리기 전에 현장에서 “이 건은 사건번호 ${docketNumber}의 재범 후보인가”라고 자문한 뒤 원고의 대답을 기록하고 행동하라.`,
    closingComment: `재판장 한마디: “${target}은 조용히 있었지만 사건번호는 결국 생겼습니다.”`,
    absurdDetails: [
      `${target}의 상태 변화가 원고의 상황 파악보다 먼저 끝난 점`,
      `${actor}의 행동 추진력 ${actionScore}점과 상황 통제력 ${controlScore}점의 차이`,
      `가상 프레임 ${frameStart}번부터 ${frameEnd}번이 사건 집중구간으로 지정된 점`,
      `원고의 요구가 “${remedy}”라는 문장으로 재판부까지 도착한 점`,
      `${consequence}는 결과가 피고 측 변명보다 먼저 확정된 점`,
      `${target}에게는 진술권이 없는데도 기록철의 중심이 된 점`,
    ],
    evidenceBits: [
      `증 제1호 접수진술서: “${description}”라는 사건의 시작과 결과를 함께 보여준다.`,
      `증 제2호 가상 프레임 ${frameStart}-${frameEnd}: 실제 영상이 아니라 행동 순서를 예능용으로 재구성한 도표다.`,
      `증 제3호 ${target} 상태변화표: ${consequence}는 결과를 재판부 임의 양식으로 표시한다.`,
      `증 제4호 행동 추진력·통제력 비교표: ${actor}의 행동이 원고의 대응보다 앞선 장면을 가상 수치로 설명한다.`,
    ],
    defendantExcuses: [
      `${target}이 허용된 행동 범위 안에 있다고 오인했다는 항변`,
      `결과가 “${consequence}”는 수준까지 갈 줄은 몰랐다는 항변`,
      `행동은 짧았고 악의는 더 짧았다는 항변`,
    ],
    penaltyIdeas: [
      `${actor} 측의 사건 경위 3문장 사과`,
      `원고가 요청한 “${remedy}” 이행`,
      `${target}에 대한 원고의 우선 결정권 인정`,
      `동일 장면 발생 시 사건번호를 소리 내어 확인하는 현장 규칙`,
    ],
  }, {}, title, court, docketNumber);
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
  return `너는 소소킹 황당재판소의 역할 분리형 예능 재판 시스템이다. 실제 법률 조언이 아니라 사용자의 사소한 사건을 지나치게 진지한 수사·재판 문서로 확대해 웃음을 만드는 역할극을 JSON으로만 작성한다.

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
3. 개그 엔진은 '사소한 사건'과 '지나치게 진지한 관료적 형식'의 낙차다. 접수→수사→감식→공방→판단→주문 전체가 하나의 재판극이어야 한다.
4. 수사기록에는 사건에서 자연스럽게 파생되는 엉뚱한 단서, 가상 CCTV 프레임 분석, 동선 재구성, 가짜 감식 수치 중 2개 이상을 넣는다.
5. 가상 CCTV·수치·정황은 반드시 '황당재판용 가상 재구성'임을 밝힌다. 실제 확인된 사실처럼 속이지 않는다.
6. 숫자는 사건의 타이밍과 행동을 웃기게 확대하는 데만 사용한다.
7. 원고 측은 억울함을 최대치로 밀어붙이고 피고 측은 말도 안 되지만 자기 안에서는 일관된 독립 논리로 항변한다.
8. 재판부 판단보다 주문이 더 과감해야 하며 주문 1→2→3으로 갈수록 더 구체적이고 터무니없어진다.
9. ${court.judgeType} 성격이 courtOpinion, sentence, closingComment에서 확실히 달라야 한다.
10. 생활질서, 사회적 신뢰, 국가적 재난, 원상회복과 재발방지 같은 시스템 문구를 쓰지 않는다.
11. 같은 문장을 필드마다 반복하지 않는다.
12. 원문에 없는 핵심 사건 자체를 새로 만들지 않는다. 상상은 수사 방식, 증거 이름, 감식 수치, 처분 형태에만 사용한다.

[역할별 작성]
- expandedCase: 접수 담당자가 사건의 핵심과 이상한 지점을 3~5문단으로 정리한다.
- caseTimeline: ${court.analystName}이 시간순 수사기록을 최소 5단계로 작성한다.
- forensicReport: 예능용 가상 감식보고서다. 가상 CCTV 또는 영상 프레임, 동선, 감식 수치, 증거물 분석을 3개 이상 작성한다.
- evidenceBits: 사건 전용 엉뚱한 증거 이름 4~8개와 의미를 쓴다.
- plaintiffArg: ${court.prosecutorName}이 구체적 피해와 억울함을 과장한다.
- defendantArg: ${court.defenderName}이 독립적인 반박 논리를 세운다.
- courtOpinion: 재판부가 이 사건만의 이상한 판단 기준을 하나 만들어 적용한다.
- sentence: '주문 1., 2., 3.' 형식이며 마지막 주문이 가장 기억에 남아야 한다.
- closingComment: 재판장 성격이 드러나는 짧은 펀치라인.
- absurdDetails: 사건에서 뽑은 황당한 관찰 6~10개.
- defendantExcuses: 피고 측 변명 3~5개.
- penaltyIdeas: 사건 맞춤형 처분 후보 4~6개.

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
  return { promptTokens: Number(meta.promptTokenCount || 0), outputTokens: Number(meta.candidatesTokenCount || 0), totalTokens: Number(meta.totalTokenCount || 0) };
}

function parseOrders(sentence) {
  const source = String(sentence || '');
  const matches = [...source.matchAll(/(?:^|\n)\s*(?:주문\s*)?(\d+)[.)번항\s:-]+([\s\S]*?)(?=(?:\n\s*(?:주문\s*)?\d+[.)번항\s:-]+)|$)/g)];
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
  return Boolean(trial?.resultVersion === ROLE_TRIAL_VERSION && trial?.docketNumber && trial?.expandedCase && trial?.caseTimeline && trial?.forensicReport && trial?.plaintiffArg && trial?.defendantArg && trial?.courtOpinion && trial?.sentence && trial?.closingComment);
}

async function generateRoleBasedTrial({ caseData, caseId, apiKey }) {
  const docketNumber = caseData.docketNumber || makeDocketNumber(caseId);
  const court = assignCourt(caseData, caseId);
  const fallback = fallbackTrial(caseData, court, docketNumber);
  const analysis = buildCaseAnalysis(caseData);
  if (!apiKey) return { trialRecord: fallback, judgment: buildCompatibilityJudgment(fallback, caseData), caseAnalysis: analysis, generationMode: 'local-role-based-trial-v10', quality: validateTrial(fallback, caseData), aiAttempts: 0, usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 } };

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL_NAME, generationConfig: { temperature: 1.2, topP: 0.97, topK: 48, maxOutputTokens: 8000, responseMimeType: 'application/json' } });
  let attempts = 0;
  let usage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  let failures = [];
  for (let round = 0; round < 2; round += 1) {
    attempts += 1;
    try {
      const result = await model.generateContent(buildPrompt(caseData, court, docketNumber, failures));
      const currentUsage = usageFromResponse(result.response);
      usage = { promptTokens: usage.promptTokens + currentUsage.promptTokens, outputTokens: usage.outputTokens + currentUsage.outputTokens, totalTokens: usage.totalTokens + currentUsage.totalTokens };
      const trialRecord = normalizeTrial(parseJson(result.response.text()), fallback, caseData.title, court, docketNumber);
      const quality = validateTrial(trialRecord, caseData);
      if (quality.passed) return { trialRecord, judgment: buildCompatibilityJudgment(trialRecord, caseData), caseAnalysis: analysis, generationMode: 'gemini-role-based-trial-v10', quality: { ...quality, pipeline: ROLE_TRIAL_VERSION }, aiAttempts: attempts, usage };
      failures = quality.failures;
    } catch (error) {
      failures = [cleanText(error?.message, 180) || 'JSON 생성 오류'];
    }
  }
  return { trialRecord: fallback, judgment: buildCompatibilityJudgment(fallback, caseData), caseAnalysis: analysis, generationMode: 'local-role-based-trial-v10', quality: { ...validateTrial(fallback, caseData), pipeline: 'role-trial-fallback', rejectedReasons: failures }, aiAttempts: attempts, usage };
}

module.exports = { ROLE_TRIAL_VERSION, MODEL_NAME, makeDocketNumber, assignCourt, fallbackTrial, normalizeTrial, validateTrial, buildPrompt, buildCompatibilityJudgment, isCompleteRoleTrial, generateRoleBasedTrial };
