const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['생활증거추적팀 정침묵 수사관', '억울함 감식반 오과몰입 조사관', '소소경찰 박소소 경위'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const CATEGORY_RULES = [
  {
    id: 'food',
    label: '음식·식탐',
    keys: ['먹', '음식', '밥', '라면', '치킨', '커피', '빵', '과자', '아이스크림', '떡볶이', '간식', '메뉴', '배달'],
    terms: ['독점 점유권', '영양 균형 침해', '최후 한입 보전의무', '식욕 신뢰보호원칙'],
    grand: '식생활질서 및 최후섭취권 중대침해 사건'
  },
  {
    id: 'late',
    label: '약속·지각',
    keys: ['늦', '지각', '약속', '기다', '시간', '연락 없이', '안 왔', '출발'],
    terms: ['시공간 왜곡', '신의성실 의무 위반', '기대시간 편취', '대기권 침해'],
    grand: '시공간질서 왜곡 및 약속신뢰 붕괴 사건'
  },
  {
    id: 'love',
    label: '연인·사랑',
    keys: ['남친', '여친', '애인', '연인', '데이트', '사랑', '기념일', '부부', '남편', '아내'],
    terms: ['정서적 신뢰보호의무', '애정표현 상당성', '기념일 주의의무', '관계평온권'],
    grand: '정서신뢰질서 및 관계평온권 침해 사건'
  },
  {
    id: 'work',
    label: '직장·학교',
    keys: ['회사', '직장', '상사', '부장', '과장', '팀장', '회의', '학교', '선생', '교실', '숙제', '과제', '동료'],
    terms: ['업무평온권', '조직신뢰 보호의무', '불필요긴장 유발죄', '집단눈치 조성행위'],
    grand: '조직평온 및 업무신뢰체계 중대교란 사건'
  },
  {
    id: 'digital',
    label: '디지털·연락',
    keys: ['카톡', '문자', '전화', '읽씹', '답장', '게임', '온라인', '네비', '내비', '앱', 'SNS'],
    terms: ['디지털 응답의무', '통신신뢰 침해', '알림방치 책임', '전자적 평온권'],
    grand: '디지털신뢰체계 및 통신평온 중대침해 사건'
  },
  {
    id: 'family',
    label: '가족·생활',
    keys: ['엄마', '아빠', '부모', '가족', '형', '누나', '언니', '오빠', '동생', '아이', '자녀', '집'],
    terms: ['가정평온 유지의무', '생활배려의무', '공동공간 신뢰원칙', '가족질서 보전책임'],
    grand: '가정평온 및 공동생활질서 중대침해 사건'
  }
];

const PROMPT_LEAK_PHRASES = [
  '[Role]', '[Core Instruction]', '[Detailed Output Layout]', '사이트 제작 시', '프롬프트 외부',
  'Temperature', 'Gemini 2.5', '사용자가 입력', '출력 형식', '다음 지시', '위 지시',
  'JSON', '```', 'system prompt', '프롬프트를 공개'
];

const REQUIRED_HEADINGS = [
  '## ⚖️ 사건번호 및 사건명',
  '## 1. 사건의 경위',
  '## 2. 치열한 수사 과정',
  '## 3. 검사의 공소사실',
  '## 4. 변호인의 최후변론',
  '## 👨‍⚖️ 판사의 최종 판결'
];

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanLong(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function stableNumber(seed, min, max) {
  const text = String(seed || 'sosoking');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const range = max - min + 1;
  return min + (Math.abs(hash >>> 0) % range);
}

function pickFrom(items, seed) {
  return items[stableNumber(seed, 0, items.length - 1)];
}

function pickJudge(selected, seed) {
  return JUDGES.includes(selected) ? selected : pickFrom(JUDGES, seed);
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function detectCategory(text) {
  const normalized = String(text || '');
  let best = null;
  let bestScore = 0;
  for (const rule of CATEGORY_RULES) {
    const score = rule.keys.reduce((sum, key) => sum + (normalized.includes(key) ? 1 : 0), 0);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best || {
    id: 'other',
    label: '기타 생활분쟁',
    terms: ['생활평온권', '상호배려의무', '신뢰보호원칙', '사소분쟁 확대방지의무'],
    grand: '생활평온 및 상호배려질서 중대침해 사건'
  };
}

function detectSubject(text) {
  const tokens = String(text || '')
    .replace(/[.,!?。！？\n]/g, ' ')
    .split(/\s+/)
    .map(token => token.replace(/(을|를|이|가|은|는|에|에서|에게|한테|으로|로|도|만|까지|부터|하고|랑|와|과)$/g, ''))
    .filter(token => token.length >= 2 && token.length <= 10);
  return tokens[0] || '문제의 행위';
}

function buildDocket(caseId, title, existing) {
  const supplied = cleanText(existing, 40);
  if (/^2026고단\d{4}$/.test(supplied)) return supplied;
  return `2026고단${String(stableNumber(`${caseId}:${title}`, 1000, 9999))}`;
}

function isPromptLeak(text) {
  const output = String(text || '');
  return PROMPT_LEAK_PHRASES.some(phrase => output.includes(phrase));
}

function validateGrandScript(text, docket) {
  const output = cleanLong(text, 18000);
  if (output.length < 1200) return false;
  if (isPromptLeak(output)) return false;
  if (!output.includes(docket)) return false;
  if (!REQUIRED_HEADINGS.every(heading => output.includes(heading))) return false;
  if (!output.includes('[주문]')) return false;
  if (!/\n1\.\s/.test(output) || !/\n2\.\s/.test(output) || !/\n3\.\s/.test(output)) return false;
  return true;
}

function buildGrandPrompt({ title, description, desiredVerdict, grievanceIndex, docket, grandTitle, category, defendantName, people, judgeType }) {
  return `너는 일상의 사소한 갈등을 대한민국 사법 역사상 가장 장엄하고 비장하며 지독하게 엄숙한 세기의 재판으로 재구성하는 소소킹 재판부이다.

다음 사건 한 건의 최종 판결 기록 전문만 작성하라.
작성 규칙이나 안내문을 설명하지 말고, 결과문 외의 문장은 절대 출력하지 마라.

[사건 자료]
원래 사건명: ${title}
사건번호: ${docket}
공식 거창한 사건명: ${grandTitle}
사건 내용: ${description}
원고가 희망한 처분: ${desiredVerdict || '특별히 기재되지 아니함'}
억울함 지수: ${grievanceIndex}/10
사건 분류: ${category.label}
적용할 과장 법률용어: ${category.terms.join(', ')}
피고 호칭: ${defendantName}
서기관: ${people.recordClerk}
수사관: ${people.analystName}
검사: ${people.prosecutorName}
변호인: ${people.defenderName}
재판장 성향: ${judgeType}

[문체]
모든 문장은 웅장하고 비장한 공문서 어조인 '~하였다', '~로 판단한다', '~라 명한다'를 유지한다.
가벼운 농담, 비속어, ㅋ, ㅎㅎ 같은 표현은 쓰지 않는다.
웃음은 오직 사안의 사소함과 국가적 재판의 지나친 엄숙함 사이의 괴리에서 발생해야 한다.

[내용]
사건 자료에 실제로 없는 물건, 동물, 장소, 목격자를 사실인 것처럼 새로 만들지 않는다.
다만 사건에 맞는 가상의 과잉 수사기법은 허용한다.
수사 과정은 최소 3문단으로 작성하고, CCTV 480시간 분석, 0.1초 단위 프레임 검토, 디지털 포렌식, 심박 변화 분석, 현장 감식, 주변인 탐문을 사건 내용에 맞게 과도하게 적용한다.
검사는 사소한 행위를 문명 질서에 대한 중대 위협처럼 단죄한다.
변호인은 기상, 자기장, 생체리듬, 환경적 우연 등 기상천외한 사유로 극단적으로 방어하되 사건 내용과 연결한다.
재판장은 길고 장엄한 훈계를 한 뒤 정확히 1, 2, 3번의 주문만 선고한다.
1번과 2번은 유치하지만 구체적이고 실행 가능한 굴욕적 처분으로 작성한다.
3번은 반드시 소송 비용을 커피 기프티콘, 메로나 또는 사건에 맞는 동급 위로물로 피고가 부담한다고 명시한다.

[반드시 사용할 표제]
## ⚖️ 사건번호 및 사건명
## 1. 사건의 경위 (비극의 서막)
## 2. 치열한 수사 과정 (국가적 역량 총동원)
## 3. 검사의 공소사실 (정의의 단죄)
## 4. 변호인의 최후변론 (궤변의 극치)
## 👨‍⚖️ 판사의 최종 판결 (주문)

마크다운 표, 코드블록, JSON, 작성 설명은 쓰지 마라.`;
}

function buildLocalGrandScript({ title, description, desiredVerdict, grievanceIndex, docket, grandTitle, category, defendantName, people, judgeType, subject }) {
  const cost = category.id === 'food' ? '원고가 선택한 간식 또는 음료' : '커피 기프티콘, 메로나 또는 이에 준하는 생활형 위로물';
  const desiredLine = desiredVerdict
    ? `원고가 희망한 처분인 “${desiredVerdict}” 또한 그 취지를 참작하였다.`
    : '원고가 별도의 처분을 특정하지 아니하였으므로 재판부가 직권으로 생활형 처분을 정하였다.';

  return `## ⚖️ 사건번호 및 사건명
${docket} ${grandTitle}

${people.recordClerk}는 본 사건을 단순한 일상적 마찰로 축소할 수 없다고 보아 정식 사건기록으로 편철하였다. 이 사건의 원래 명칭은 “${title}”이며, 재판부는 그 이면에 놓인 ${category.terms[0]}과 ${category.terms[1]}의 붕괴 가능성을 중대하게 심리하였다.

## 1. 사건의 경위 (비극의 서막)
사건의 발단은 외견상 작고 평범하였다. 그러나 원고가 제출한 진술에 따르면 “${description}”라는 상황이 발생한 직후, 일상의 질서는 이전과 같은 모습으로 돌아가지 못하였다. 원고는 그 순간 자신이 단순한 불편을 겪은 것이 아니라, 누구도 대수롭지 않게 여기던 생활의 기본 신뢰가 무너지는 장면을 목격하였다고 진술하였다.

억울함 지수는 ${grievanceIndex}/10으로 기록되었다. 이는 사회 전체를 전복할 정도의 수치는 아니나, 한 사람의 하루를 끈질기게 재생시키기에는 충분한 수치였다. 원고의 머릿속에서는 사건 당시의 말투, 표정, 침묵, 뒤늦은 해명이 반복 재생되었고, 그 과정에서 ${subject}은 단순한 대상이 아니라 생활질서 붕괴의 상징으로 격상되었다.

${defendantName}은 사안의 크기가 지나치게 확대되었다고 항변하였으나, 재판부는 사소한 일이 스스로 커지는 경우는 드물며 대체로 이를 사소하다고 단정한 태도가 사건을 키운다고 판단하였다.

## 2. 치열한 수사 과정 (국가적 역량 총동원)
${people.analystName}는 현장에 존재하였던 시선, 머뭇거림, 대답의 속도, 사건 후 침묵의 길이를 모두 수사 대상으로 지정하였다. 수사팀은 현장 CCTV가 실제로 존재하는지 여부를 넘어, 원고의 기억 속 장면을 480시간 분량으로 확대 복원하였고, 문제의 순간을 0.1초 단위로 분해하여 어느 지점에서 평온이 억울함으로 전환되었는지 분석하였다.

디지털 포렌식팀은 연락 기록과 문장부호의 사용 빈도, 답변 지연 시간, 읽고도 반응하지 아니한 구간을 검토하였다. 동시에 생활심리 감식반은 원고의 심박이 상승하였을 것으로 추정되는 시점과 ${defendantName}의 상황 인식이 뒤늦게 시작된 시점을 대조하였다. 그 결과 양측의 감정 시계가 서로 다른 시간대를 사용하고 있었음이 확인되었다.

현장 감식반은 ${subject}을 둘러싼 위치 관계와 사후 태도를 입체적으로 재구성하였다. 주변인 탐문팀은 직접 목격자가 없더라도 사건 직후의 분위기와 원고의 반복 설명을 참고자료로 확보하였다. 수사팀은 이러한 자료를 종합하여, 본 사건이 단순한 오해가 아니라 ${category.terms[2]}에 대한 중대한 도전이라고 결론내렸다.

## 3. 검사의 공소사실 (정의의 단죄)
${people.prosecutorName}는 최후 의견에서 다음과 같이 주장하였다.

“이 사건은 단순히 ${subject}을 둘러싼 작은 충돌이 아니다. 이는 한 사람의 평온한 하루를 예고 없이 압수하고, 사소하다는 한마디로 책임을 면하려 한 생활질서 교란행위이다. ${defendantName}은 자신의 행동이 남긴 감정적 잔향을 외면하였고, 그 결과 원고는 사건 종료 후에도 마음속 재판을 계속하여야 하였다. 이는 ${category.terms.join(', ')}를 동시에 침해한 행위로서 엄중한 판단이 필요하다.”

검사는 특히 ${defendantName}이 사건 초기에 진지한 사과나 충분한 해명을 제공하지 아니한 점을 지적하며, 그 공백이 원고의 억울함을 증폭시킨 핵심 원인이라고 주장하였다.

## 4. 변호인의 최후변론 (궤변의 극치)
${people.defenderName}는 피고를 위하여 다음과 같이 변론하였다.

“당시 ${defendantName}의 판단 능력은 생활 피로, 미세한 기압 변화, 예측할 수 없는 생체리듬의 흔들림 및 주변 환경의 자기장 교란으로 일시 저하되어 있었다. 피고가 원고의 감정을 즉시 파악하지 못한 것은 악의의 결과가 아니라 인간 감각기관의 구조적 한계에서 비롯된 불가피한 오차였다.”

변호인은 나아가 ${subject} 자체가 오해를 유발하기 쉬운 상태였고, 당시 주변 분위기 역시 정확한 판단에 불리하게 작용하였다고 주장하였다. 그러나 재판부는 이러한 주장이 과학적 언어를 사용하였다는 이유만으로 과학적 사실이 되는 것은 아니라고 보았다.

## 👨‍⚖️ 판사의 최종 판결 (주문)
${judgeType} 재판부는 사건기록 전체를 검토하였다. 사안은 분명 사소하였다. 그러나 사소하다는 이유로 상대방이 느낀 불편과 억울함까지 자동으로 소멸하는 것은 아니다. 작은 무례가 거대한 범죄가 되는 것은 아니나, 작은 무례를 끝까지 작다고 우기는 태도는 충분히 긴 판결문을 탄생시킬 수 있다.

${desiredLine} 재판부는 ${defendantName}에게 형벌이 아닌 생활형 굴욕과 관계 회복의 의무를 부과하는 것이 상당하다고 판단하였다.

[주문]
1. ${defendantName}은 원고 앞에서 사건 당시 자신의 판단이 충분하지 못하였음을 엄숙한 표정으로 세 문장 이상 낭독하라.
2. ${defendantName}은 향후 유사 상황 발생 시 “별일 아니다”라는 취지의 발언을 먼저 하지 말고, 원고의 표정을 3초 이상 확인한 뒤 해명하라.
3. 소송 비용은 ${defendantName}이 부담한다. 그 비용은 ${cost}의 지급으로 갈음하며, 지급 시 생색을 내거나 가격을 언급하지 말라.

이 판결은 실제 법적 효력을 가지지 아니하나, 원고의 마음속 항소심을 종결시키는 데 필요한 모든 엄숙함을 갖춘 것으로 선고한다.`;
}

function buildLegacySections({ title, description, desiredVerdict, grievanceIndex, category, defendantName, people, judgeType, subject }) {
  return {
    expandedCase: `사건개요\n${title} 사건은 ${subject}을 둘러싼 생활분쟁으로 접수되었다. 원고는 “${description}”라고 진술하였고, 재판부는 이를 ${category.grand}으로 분류하였다.`,
    caseTimeline: `수사 진행 과정\n1. 접수 진술을 확보하였다.\n2. 사건 당시의 반응과 침묵을 재구성하였다.\n3. 원고의 억울함 지수 ${grievanceIndex}/10을 확인하였다.\n4. ${people.analystName}가 생활형 증거를 분석하였다.\n5. 사건을 재판부에 송치하였다.`,
    forensicReport: `수사보고서\n${subject} 자체보다 사건 이후 남은 감정의 잔열이 더 큰 것으로 분석되었다. ${category.terms.join(', ')} 위반 가능성이 참고사항으로 기록되었다.`,
    plaintiffArg: `${people.prosecutorName}는 ${defendantName}의 태도가 원고의 생활평온권을 침해하였다고 주장하였다.`,
    defendantArg: `${people.defenderName}는 피고의 행위가 고의가 아니라 판단 착오와 환경적 우연에서 비롯되었다고 항변하였다.`,
    courtOpinion: `${judgeType} 재판부는 사안 자체는 작으나 원고의 억울함이 실제로 발생하였으므로 ${defendantName}의 일부 책임을 인정한다.`,
    sentence: `판결\n1. ${defendantName}은 원고의 억울함을 인정한다.\n2. 같은 상황이 반복되지 않도록 주의한다.\n3. 소송 비용은 커피 기프티콘, 메로나 또는 동급 위로물로 부담한다.`,
    closingComment: '재판장 한마디: “작은 사건이라도 마음속에서 계속 재생되면 정식 기록의 대상이 된다.”',
    absurdDetails: [
      `${category.label} 사건으로 분류됨`,
      `억울함 지수 ${grievanceIndex}/10 확인`,
      `${category.terms[0]} 침해 여부 심리`,
      `${judgeType} 재판부 배당`
    ],
    evidenceBits: ['원고 접수 진술', '사건 직후 반응', '피고 측 해명', '생활형 감정 잔열'],
    defendantExcuses: ['판단 착오였다는 주장', '상황이 커질 줄 몰랐다는 주장', '환경적 요인이 있었다는 주장'],
    penaltyIdeas: [
      '엄숙한 사과문 낭독',
      '재발 방지 표정 확인 의무',
      desiredVerdict || '생활형 위로물 지급'
    ]
  };
}

async function loadSettings() {
  try {
    const snapshot = await db.doc('site_settings/config').get();
    return snapshot.exists ? snapshot.data() : {};
  } catch {
    return {};
  }
}

async function imageForGemini(caseData) {
  const image = caseData?.imageAttachment || caseData?.imageAttachmentMeta || null;
  const storagePath = image?.storagePath || caseData?.imageStoragePath || '';
  const mimeType = cleanText(image?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;

  let data = String(image?.data || '')
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .replace(/\s/g, '');

  if (!data && storagePath) {
    const [buffer] = await getStorage().bucket().file(storagePath).download();
    if (buffer.length > 700000) return null;
    data = buffer.toString('base64');
  }

  return data && data.length <= 950000 && /^[A-Za-z0-9+/=]+$/.test(data)
    ? { mimeType, data }
    : null;
}

function imageMeta(caseData) {
  const image = caseData?.imageAttachment || caseData?.imageAttachmentMeta || null;
  if (!image || typeof image !== 'object') return null;
  return {
    storagePath: cleanText(image.storagePath || caseData.imageStoragePath, 240),
    mimeType: cleanText(image.mimeType, 30),
    width: Number(image.width || 0),
    height: Number(image.height || 0),
    originalName: cleanText(image.originalName, 80),
    originalSize: Number(image.originalSize || 0),
    resizedSize: Number(image.resizedSize || 0)
  };
}

async function generateGrandScript(model, prompt, geminiImage) {
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts }]
  });
  return {
    text: cleanLong(result.response.text(), 18000),
    usage: result.response.usageMetadata || {}
  };
}

exports.generateTrial = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB',
  cors: true
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const initial = await caseRef.get();
  if (!initial.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');

  let caseData = initial.data();
  if (caseData.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (caseData.status === 'completed') return { success: true, skipped: 'completed' };
  if (caseData.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(caseData.status)) {
    throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');
  }

  const title = cleanText(caseData.caseTitle, 90) || '소소한 황당사건';
  const description = cleanText(caseData.caseDescription, 1400) || title;
  const desiredVerdict = cleanText(caseData.desiredVerdict, 240);
  const grievanceIndex = Math.max(1, Math.min(10, Number(caseData.grievanceIndex || 5)));
  const category = detectCategory(`${title} ${description} ${desiredVerdict}`);
  const subject = detectSubject(`${title} ${description}`);
  const docketNumber = buildDocket(caseId, title, caseData.docketNumber);
  const grandTitle = `${title} 관련 ${category.grand}`;
  const defendantName = cleanText(
    caseData.defendantName || caseData.accusedName || caseData.whoDidIt || caseData.targetName,
    40
  ) || '피고 측';
  const judgeType = pickJudge(caseData.selectedJudge, `${caseId}:${title}`);
  const people = {
    courtroom: caseData.courtroom || pickFrom(COURTROOMS, `${caseId}:courtroom`),
    recordClerk: caseData.recordClerk || pickFrom(CLERKS, `${caseId}:clerk`),
    analystName: caseData.analystName || pickFrom(ANALYSTS, `${caseId}:analyst`),
    prosecutorName: caseData.prosecutorName || pickFrom(PROSECUTORS, `${caseId}:prosecutor`),
    defenderName: caseData.defenderName || pickFrom(DEFENDERS, `${caseId}:defender`)
  };

  let acquired = false;
  await db.runTransaction(async transaction => {
    const fresh = await transaction.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
    acquired = true;
    caseData = current;
    transaction.update(caseRef, {
      status: 'processing',
      courtStage: 'hearing',
      docketNumber,
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      judgeType,
      category: category.id,
      categoryLabel: category.label,
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete()
    });
  });

  if (!acquired) return { success: true, skipped: 'already-started' };

  const localScript = buildLocalGrandScript({
    title,
    description,
    desiredVerdict,
    grievanceIndex,
    docket: docketNumber,
    grandTitle,
    category,
    defendantName,
    people,
    judgeType,
    subject
  });
  const legacy = buildLegacySections({
    title,
    description,
    desiredVerdict,
    grievanceIndex,
    category,
    defendantName,
    people,
    judgeType,
    subject
  });

  let judgmentScript = localScript;
  let aiGenerated = false;
  let generationMode = 'local-grand-trial-v12';
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let geminiImage = null;

  try {
    const settings = await loadSettings();
    const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
    geminiImage = await imageForGemini(caseData).catch(error => {
      console.warn('image load skipped:', error.message || error);
      return null;
    });

    const key = geminiKey.value().trim();
    if (key) {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.86,
          topP: 0.94,
          topK: 40,
          maxOutputTokens: 6500
        }
      });
      const prompt = buildGrandPrompt({
        title,
        description,
        desiredVerdict,
        grievanceIndex,
        docket: docketNumber,
        grandTitle,
        category,
        defendantName,
        people,
        judgeType
      });
      const generated = await generateGrandScript(model, prompt, geminiImage);
      totals = {
        requests: 1,
        inputTokens: generated.usage.promptTokenCount || 0,
        outputTokens: generated.usage.candidatesTokenCount || 0
      };
      if (validateGrandScript(generated.text, docketNumber)) {
        judgmentScript = generated.text;
        aiGenerated = true;
        generationMode = 'ai-grand-trial-v12';
      } else {
        console.warn('grand trial output rejected by validator');
      }
    }
  } catch (error) {
    console.error('grand trial generation skipped:', error.message || error);
  }

  try {
    await resultRef.set({
      userId: caseData.userId,
      ownerId: caseData.userId,
      isPublic: caseData.isPublic === true,
      docketNumber,
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      defendantName,
      category: category.id,
      categoryLabel: category.label,
      legalTerms: category.terms,
      judgeType,
      caseTitle: title,
      originalCaseTitle: title,
      refinedCaseTitle: title,
      absurdityTitle: grandTitle,
      caseDescription: caseData.caseDescription || '',
      desiredVerdict: caseData.desiredVerdict || '',
      grievanceIndex,
      nickname: caseData.nickname || '익명 원고',
      judgmentScript,
      expandedCase: legacy.expandedCase,
      reception: legacy.expandedCase,
      caseTimeline: legacy.caseTimeline,
      forensicReport: legacy.forensicReport,
      investigation: legacy.forensicReport,
      plaintiffArg: legacy.plaintiffArg,
      defendantArg: legacy.defendantArg,
      courtOpinion: legacy.courtOpinion,
      verdict: legacy.courtOpinion,
      sentence: legacy.sentence,
      closingComment: legacy.closingComment,
      absurdDetails: legacy.absurdDetails,
      evidenceBits: legacy.evidenceBits,
      evidenceList: legacy.evidenceBits,
      defendantExcuses: legacy.defendantExcuses,
      penaltyIdeas: legacy.penaltyIdeas,
      analysisDigest: legacy.absurdDetails,
      keyIssues: legacy.absurdDetails,
      imageAnalysis: '',
      hasImageAttachment: !!geminiImage,
      imageAttachmentMeta: imageMeta(caseData),
      aiGenerated,
      generationMode,
      resultVersion: 'grand-trial-v12',
      executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.',
      appealNotice: '본 사건은 1회에 한하여 마음속 항소가 가능하다. 다만 항소심도 실제 법적 효력은 없다.',
      reactionTotal: 0,
      totalVotes: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: caseData.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await caseRef.update({
      status: 'completed',
      courtStage: 'sentenced',
      docketNumber,
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      defendantName,
      category: category.id,
      categoryLabel: category.label,
      judgeType,
      isPublic: caseData.isPublic === true,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete()
    });
  } catch (error) {
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: error.message || '저장 오류',
      updatedAt: FieldValue.serverTimestamp()
    }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(1),
        imageCaseCount: FieldValue.increment(geminiImage ? 1 : 0),
        firestoreReads: FieldValue.increment(3),
        firestoreWrites: FieldValue.increment(4),
        functionInvocations: FieldValue.increment(1),
        robustAbsurdCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('usage log failed:', error.message || error);
    }
  }

  return {
    success: true,
    judgeType,
    category: category.id,
    docketNumber,
    isPublic: caseData.isPublic === true,
    hasImageAttachment: !!geminiImage,
    resultVersion: 'grand-trial-v12',
    generationMode
  };
});
