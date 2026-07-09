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
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const OBJECT_HINTS = [
  ['빵', '빵'], ['샌드위치', '샌드위치'], ['도넛', '도넛'], ['라면', '라면'], ['커피', '커피'], ['치킨', '치킨'], ['과자', '과자'], ['푸딩', '푸딩'], ['아이스크림', '아이스크림'], ['떡볶이', '떡볶이'],
  ['리모컨', '리모컨'], ['충전기', '충전기'], ['우산', '우산'], ['자리', '자리'], ['주차', '주차자리'], ['카톡', '카톡'], ['문자', '문자'], ['택배', '택배'], ['냉장고', '냉장고'], ['돈', '돈봉투'],
  ['게임', '게임'], ['약속', '약속'], ['청소', '청소'], ['설거지', '설거지'], ['화장실', '화장실'], ['엘리베이터', '엘리베이터'], ['소리', '소리'], ['냄새', '냄새'], ['말', '말'], ['사진', '사진']
];
const PLACE_HINTS = ['공원', '회사', '집', '카페', '편의점', '식당', '학교', '버스', '지하철', '엘리베이터', '주차장', '놀이터', '사무실', '거실', '방', '매장', '학원', '독서실', 'PC방'];
const BORING_WORDS = ['평온', '정적', '미세한 흔적', '기록 보존 가치', '결정적 순간', '원래 상태', '단순한 배경', '생활형 증거', '본 사건은 법적으로'];
const CONTAMINATION_RULES = [
  { mustHaveAny: ['공원'], block: ['공원', '벤치', '산책로'] },
  { mustHaveAny: ['빵', '샌드위치', '도넛'], block: ['빵', '빵가루', '탄수화물', '한입권'] },
  { mustHaveAny: ['강아지', '개', '반려견', '댕댕이', '멍멍이'], block: ['강아지', '피고견', '꼬리', '목줄', '멍', '보호자', '산책 중이던', '비둘기'] },
  { mustHaveAny: ['고양이', '냥이', '길고양이'], block: ['고양이', '피고묘', '냥', '그루밍', '골골송', '집사'] }
];

const ACTOR_PACKS = [
  {
    keys: ['강아지', '개', '반려견', '댕댕이', '멍멍이'],
    actor: '강아지 피고', prosecutorAlias: '간식권침해특별검사', defenseAlias: '꼬리변호인단',
    witnessA: s => s.place === '공원' ? '벤치 밑 비둘기 1호' : '현장 주변의 무심한 시선', witnessB: () => '목줄을 붙잡고 흔들리던 보호자 손목', witnessC: s => s.item.includes('빵') ? '입가에 묻은 수상한 빵가루' : `${s.item} 주변에 남은 수상한 흔적`,
    motive: s => `${s.item}의 냄새가 피고의 코를 긴급 호출했다는 주장`,
    excuse: s => `피고견 측은 “${s.item}이 먼저 냄새로 저를 불렀습니다. 저는 소환장에 응했을 뿐입니다.”라고 항변하였다.`,
    cross: s => `검사: “피고는 ${s.item}을 보았습니까?”\n피고견: “멍.”\n검사: “먹거나 건드렸습니까?”\n피고견: “멍…”\n재판장: “방금 두 번째 멍은 유죄 쪽에 가깝습니다.”`,
    penalty: s => [`피고견은 원고 앞에서 미안한 눈망울 5초를 집행한다.`, `보호자는 ${s.item} 또는 동급의 대체 만족물 1개를 원고에게 평화적으로 지급한다.`, `향후 ${s.item} 발견 시 피고견의 코는 보호자 승인 전까지 접근금지된다.`]
  },
  {
    keys: ['고양이', '냥이', '길고양이'],
    actor: '고양이 피고', prosecutorAlias: '냥심분석검사', defenseAlias: '냥권수호 변호인단',
    witnessA: () => '현장을 애써 외면한 창틀 먼지', witnessB: () => '갑자기 그루밍을 시작한 꼬리', witnessC: () => '현장 모서리에 남은 발자국 의혹',
    motive: s => `${s.item}이 자기 영역 안으로 들어왔다는 주장`,
    excuse: s => `피고묘 측은 “${s.item}은 제가 가져간 것이 아니라 우주가 잠시 제 앞에 내려놓은 것입니다.”라고 주장하였다.`,
    cross: s => `검사: “피고는 ${s.item}에 접근했습니까?”\n피고묘: “야옹.”\n검사: “그 후 왜 그루밍을 했습니까?”\n재판장: “증거 인멸을 혀로 한 정황이 있습니다.”`,
    penalty: s => [`피고묘는 원고에게 골골송 5초를 제공한다.`, `집사는 ${s.item} 상당의 대체 만족물을 원고에게 제공한다.`, `피고묘는 향후 ${s.item} 앞에서 모른 척하기 전에 최소 1회 눈치를 본다.`]
  },
  {
    keys: ['친구', '동료', '회사', '직장', '남편', '아내', '엄마', '아빠', '가족', '사람', '사장', '알바', '손님', '직원', '선배', '후배'],
    actor: '생활 피고', prosecutorAlias: '일상질서특별검사', defenseAlias: '그럴수도 변호인단',
    witnessA: () => '옆에서 눈치 보던 종이컵', witnessB: () => '갑자기 조용해진 공기청정기', witnessC: () => '원고의 1.5초 늦은 대답',
    motive: s => `${s.item} 문제가 이렇게까지 커질 줄 몰랐다는 주장`,
    excuse: s => `피고 측은 “${s.item} 문제는 생활 중 흔히 발생하는 작은 바람소리라고 생각했습니다.”라고 항변하였다.`,
    cross: s => `검사: “피고는 원고가 ${s.item} 때문에 굳어가는 것을 보았습니까?”\n피고: “그 정도는 아닌 줄 알았습니다.”\n재판장: “그 말이 바로 이 법정의 연료입니다.”`,
    penalty: s => [`피고는 ${s.item} 관련 행동 전 원고 표정을 1회 확인한다.`, `피고는 ‘그럴 수도 있지’ 발언권을 하루 1회로 제한한다.`, `피고는 원고에게 작은 간식 또는 음료로 감정 항소비용을 납부한다.`]
  }
];

function cleanText(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanLong(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n); }
function sanitize(v, n = 5000) {
  return cleanLong(v, n).replaceAll('사이트', '기록철').replaceAll('시스템', '재판부').replaceAll('AI', '재판부').replaceAll('프롬프트', '접수조서').replaceAll('자동 생성', '작성').replaceAll('사용자 입력', '접수진술').replaceAll('생활형 처분', '소소형량').replaceAll('평온', '멘탈 방어막').replaceAll('정적', '갑자기 열린 무음모드').replaceAll('미세한 흔적', '수상한 생활 잔여물').replaceAll('기록 보존 가치', '방청석 박제 가치').replaceAll('결정적 순간', '방청석이 숟가락 내려놓은 순간');
}
function safeJson(text) { const raw = String(text || '').replace(/```json|```/g, '').trim(); const a = raw.indexOf('{'); const b = raw.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('JSON parse failed'); return JSON.parse(raw.slice(a, b + 1)); }
function pickFrom(arr, seed = '') { let x = 0; const s = String(seed || Date.now()); for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 1)) % 9973; return arr[Math.abs(x) % arr.length]; }
function pickJudge(v) { return JUDGES.includes(v) ? v : JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length]; }
function kstDateKey(d = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
function list(v, fallback, max, len) { const rows = Array.isArray(v) ? v.map(x => sanitize(x, len)).filter(Boolean).slice(0, max) : []; while (rows.length < fallback.length) rows.push(fallback[rows.length]); return rows.slice(0, max); }
async function loadSettings() { try { const s = await db.doc('site_settings/config').get(); return s.exists ? s.data() : {}; } catch { return {}; } }
function softenCaseText(text) { return cleanText(text, 1200).replaceAll('음주운전', '술기운 의혹').replaceAll('고소', '엄숙 항의').replaceAll('신고', '방청석 제보').replaceAll('절도', '슬쩍 실종').replaceAll('사기', '말바꾸기 의혹').replaceAll('폭행', '과격한 몸짓').replaceAll('형사', '매우 진지한').replaceAll('법원', '마음속 재판장'); }
function includesAny(text, keys) { return keys.some(k => text.includes(k)); }
function detectObject(text) {
  const found = OBJECT_HINTS.find(([k]) => text.includes(k));
  if (found) return found[1];
  const tokens = text.replace(/[.,!?。！？\n]/g, ' ').split(/\s+/).map(t => t.replace(/(을|를|이|가|은|는|에|에서|에게|한테|으로|로|도|만|까지|부터)$/g, '')).filter(t => t.length >= 2 && !['제가','내가','나는','저는','하고','했는데','있었는데','한눈판사이','사건','내용','접수된','다음과','같다'].includes(t));
  return tokens[0] || '그 일';
}
function detectPlace(text) { return PLACE_HINTS.find(p => text.includes(p)) || '그 현장'; }
function actorPack(text) { return ACTOR_PACKS.find(p => includesAny(text, p.keys)) || ACTOR_PACKS[2]; }
function hasInput(text, terms) { return terms.some(t => text.includes(t)); }
function forbiddenTermsForInput(inputText) { return CONTAMINATION_RULES.flatMap(rule => hasInput(inputText, rule.mustHaveAny) ? [] : rule.block); }
function hasForbiddenContamination(outputText, scene) { return forbiddenTermsForInput(scene.inputText || '').some(term => outputText.includes(term)); }
function funnyTitleSeed(item, place, actor, seed) {
  return pickFrom([`${place} ${item} 긴급재판 사건`, `${item} 권리침해 사건`, `${actor} 방청석 술렁 사건`, `${place} 일상질서 흔들림 사건`, `${item} 멘탈압수 사건`, `${item} 대참사 특별재판 사건`], seed).replace(/사건\s*사건$/g, '사건').slice(0, 44);
}
function scenarioFor(c) {
  const rawTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const rawDesc = cleanText(c.caseDescription, 1200) || rawTitle;
  const desc = softenCaseText(rawDesc);
  const inputText = `${rawTitle} ${rawDesc} ${desc}`;
  const item = detectObject(inputText);
  const place = detectPlace(inputText);
  const pack = actorPack(inputText);
  const actor = pack.actor;
  const seed = `${rawTitle}|${rawDesc}`;
  const sceneBase = { rawTitle, rawDesc, desc, inputText, item, place, actor, seed };
  const scene = { ...sceneBase, title: funnyTitleSeed(item, place, actor, seed), prosecutorAlias: pack.prosecutorAlias, defenseAlias: pack.defenseAlias, witnessA: pack.witnessA(sceneBase), witnessB: pack.witnessB(sceneBase), witnessC: pack.witnessC(sceneBase), fakeExhibit: `${item} 주변에 남은 억울함의 테두리`, motive: pack.motive(sceneBase), excuse: pack.excuse(sceneBase), cross: pack.cross(sceneBase), penalties: pack.penalty(sceneBase) };
  if (item.includes('빵') && hasInput(inputText, ['빵', '샌드위치', '도넛'])) scene.fakeExhibit = '반달 모양으로 사라진 빵의 마지막 기억';
  return scene;
}
async function imageForGemini(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  const path = img?.storagePath || c?.imageStoragePath || '';
  const mimeType = cleanText(img?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  let data = String(img?.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data && path) { const [buf] = await getStorage().bucket().file(path).download(); if (buf.length > 700000) return null; data = buf.toString('base64'); }
  return data && data.length <= 950000 && /^[A-Za-z0-9+/=]+$/.test(data) ? { mimeType, data } : null;
}
function imageMeta(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  return img && typeof img === 'object' ? { storagePath: cleanText(img.storagePath || c.imageStoragePath, 240), mimeType: cleanText(img.mimeType, 30), width: Number(img.width || 0), height: Number(img.height || 0), originalName: cleanText(img.originalName, 80), originalSize: Number(img.originalSize || 0), resizedSize: Number(img.resizedSize || 0) } : null;
}
function fallbackFor(c, judgeType, people) {
  const s = scenarioFor(c);
  const absurdDetails = [`${s.place}에서 ${s.item}이 원고의 하루 계획을 살짝 흔듦`, `${s.actor}이 사건 반경 안으로 자연스럽게 진입함`, `${s.fakeExhibit}이 증거 제1호로 제출됨`, `${s.witnessA}이 말없이 현장 분위기를 무겁게 만듦`, `${s.witnessB}이 사건 직후 이상하게 존재감이 커짐`, `원고의 방심 시간이 피고 측 논리의 틈으로 악용됨`, `${s.item} 관련 억울함이 공기 중에 둥둥 떠다님`, `원고의 빈손 또는 빈마음이 법정에서 가장 큰 소리로 증언함`, `${s.actor}의 태연함이 방청석 혈압 버튼을 누름`, `사소한 일이 갑자기 대하드라마 1화로 확장됨`, `재판부가 ${s.item}의 행방을 두고 3초간 침묵함`, `방청석 없는 ${s.place}에 마음속 방청객 12명이 착석함`];
  const evidenceBits = [`증거 1호: ${s.fakeExhibit}`, `증거 2호: 원고에게 남은 허무한 빈자리`, `증거 3호: ${s.witnessA}의 무언의 진술`, `증거 4호: ${s.witnessB}의 흔들리는 현장감`, `증거 5호: ${s.actor}의 너무 자연스러운 태도`, `증거 6호: ${s.item}이 있어야 할 자리에 남은 상실감`, `증거 7호: 사건 직후 원고 표정의 와이파이 끊김 현상`, `증거 8호: ${s.place} 공기 중 떠다닌 '이건 좀 억울하다' 농도`];
  const defendantExcuses = [s.excuse, `${s.defenseAlias}은 원고가 방심한 짧은 시간이 사실상 사건의 열린 문처럼 보였다고 주장하였다.`, `피고 측은 ${s.item}이 너무 당당히 존재해 오해를 불렀다고 항변하였다.`, `피고 측은 고의가 아니라 상황, 분위기, 순간 판단의 삼자합작이라고 주장하였다.`, `다만 피고 측도 사건 직후 원고 표정이 로딩 화면처럼 굳은 사실은 부인하지 못하였다.`];
  const penaltyIdeas = [...s.penalties, `원고는 향후 ${s.place}에서 ${s.item} 관련 경계태세를 1단계 올릴 수 있다.`, `재판부는 본 사건을 '${s.item} 관련 생활참사'로 마음속 기록철에 편철한다.`, `${s.actor}은 같은 상황 재발 시 재판장 눈치를 1회 확인한다.`].slice(0, 6);
  return {
    refinedCaseTitle: s.title,
    absurdityTitle: `${s.title} 기록철`,
    expandedCase: ['🎬 사건 브리핑', `서기 ${people.recordClerk}: “지금부터 ${s.title}에 대한 소소킹 황당재판을 개정합니다. 방청석은 웃음을 참되, 억울함은 참지 마십시오.”`, `원고는 ${s.place}에서 ${s.item}과 관련된 평범한 시간을 보내고 있었다. 그러나 잠깐의 방심 또는 예기치 못한 상황 속에서 ${s.actor}이 사건의 중앙무대로 들어왔다.`, `검찰은 이를 단순한 해프닝이 아니라 “원고의 일상 계획이 예고 없이 방향을 잃은 사건”으로 규정하였다.`, `방청석에서는 ${s.witnessA}과 ${s.witnessB}이 증인으로 거론되자 술렁임이 발생하였다.`, `재판장은 “오늘의 쟁점은 ${s.item}이 왜 원고의 의도와 다른 길로 갔는가”라고 말하며 마음속 법봉을 내려쳤다.`].join('\n'),
    caseTimeline: ['🎞️ 현장 재연', `00:00 원고가 ${s.place}에서 ${s.item} 문제와 관련해 평범한 하루를 보내고 있었다.`, `00:02 사건의 틈이 열린다. 훗날 검찰은 이 순간을 “일상질서가 삐끗한 2초”라고 부르게 된다.`, `00:03 ${s.actor}이 현장 반경 안으로 들어온다. 등장 자체는 조용했으나, 사건성은 이미 재판장 책상 위에 올라와 있었다.`, `00:04 ${s.item} 관련 상황이 원고의 예상과 다른 방향으로 굴러간다. 방청석 상상도에는 이 장면이 슬로모션으로 재생된다.`, `00:07 원고가 상황을 확인한다. 손에는 계획만 있고 마음에는 물음표가 남는다.`, `00:12 ${s.witnessB}이 현장감을 더하고, ${s.fakeExhibit}은 증거로 굳어지고 있었다.`].join('\n'),
    forensicReport: ['🔍 증거 제출 및 감정 결과', evidenceBits[0], evidenceBits[1], evidenceBits[2], evidenceBits[3], `소소국과수 감정 결과, ${s.item}은 단순 요소가 아니라 원고의 당일 감정 스위치에 직접 연결된 핵심 물체 또는 상황으로 판명되었다.`, `특히 ${s.actor}의 태연한 태도는 사건 후 원고의 억울함을 전자레인지 2분 30초 수준으로 데운 것으로 보인다.`, `감정관 ${people.analystName}: “이건 크기는 작아도 마음속 파장은 중형급입니다.”`].join('\n'),
    plaintiffArg: ['🧑‍⚖️ 원고 측 주장', `${people.prosecutorName}: “원고는 ${s.item} 문제를 이런 방향으로 넘기겠다고 동의한 적이 없습니다.”`, `검찰은 ${s.actor}이 ${s.item}에 관여한 과정이 지나치게 자연스러웠다는 점을 오히려 수상하다고 보았다.`, `원고 측은 “잠깐 방심한 것은 맞지만, 그것이 내 하루 계획을 셀프 반납하겠다는 뜻은 아니었다”고 진술하였다.`, `${s.witnessA}의 침묵과 ${s.witnessB}의 흔들림은 사건 당시 현장이 얼마나 어이없었는지를 보여주는 간접 증거라고 주장하였다.`, `검찰은 끝으로 “${s.item} 하나쯤이라는 말이야말로 본 사건을 대형화시킨 핵심 발언”이라고 강조하였다.`].join('\n'),
    defendantArg: ['🎭 피고 측 변론', `${people.defenderName}: “본 사건은 악의가 아니라 상황의 오해와 순간 판단이 만든 우발적 소동입니다.”`, s.excuse, `${s.defenseAlias}: “원고의 방심 또는 현장 분위기 때문에 ${s.item}이 무방비 상태처럼 보였습니다.”`, s.cross, `피고 측은 최후진술에서 “그렇게까지 커질 줄은 몰랐다”는 취지의 태도를 보였다.`].join('\n'),
    courtOpinion: ['⚖️ 재판부의 과몰입 판단', `${judgeType} 재판부는 세 가지 쟁점을 본다.`, `첫째, ${s.item}은 언제 원고의 기대에서 이탈했는가. 둘째, ${s.actor}의 관여는 우발인가, 과감한 현장 진입인가. 셋째, 이 사소한 일이 왜 원고의 하루를 살짝 구겨놓았는가.`, `재판부는 피고 측의 ${s.motive}을 일부 이해한다. 그러나 이해한다고 해서 원고의 억울함이 자동 환불되는 것은 아니다.`, `재판장은 “사소함은 정상참작 사유이나, 원고의 어이없음을 없던 일로 만드는 만능열쇠는 아니다”라고 판시하였다.`, `따라서 본 법정은 이 사건을 사소하지만 웃기고, 웃기지만 원고 입장에서는 꽤 억울한 생활참사로 인정한다.`].join('\n'),
    sentence: ['📜 최종 판결', '문서명: 주문 및 소소형량', `1. ${penaltyIdeas[0]}`, `2. ${penaltyIdeas[1]}`, `3. ${penaltyIdeas[2]}`, `4. ${penaltyIdeas[3]}`, `5. ${penaltyIdeas[4]}`, `6. ${penaltyIdeas[5]}`, `재판부는 위 명령을 선고하며, ${s.place} 내 모든 ${s.item} 관련 당사자에게 경계심을 1단계 상향할 것을 권고한다.`].join('\n'),
    closingComment: `재판장 한마디: “${s.item}은 작았으나, 사라지거나 꼬이는 순간 원고 마음속에는 긴급속보 자막이 떴습니다.”`,
    absurdDetails, evidenceBits, defendantExcuses, penaltyIdeas, scene: s
  };
}
function normalize(raw, fb) { return { refinedCaseTitle: sanitize(raw.refinedCaseTitle, 80) || fb.refinedCaseTitle, absurdityTitle: sanitize(raw.absurdityTitle, 120) || fb.absurdityTitle, expandedCase: sanitize(raw.expandedCase || fb.expandedCase, 6200), caseTimeline: sanitize(raw.caseTimeline || fb.caseTimeline, 5200), forensicReport: sanitize(raw.forensicReport || fb.forensicReport, 5200), plaintiffArg: sanitize(raw.plaintiffArg || fb.plaintiffArg, 4600), defendantArg: sanitize(raw.defendantArg || fb.defendantArg, 4600), courtOpinion: sanitize(raw.courtOpinion || fb.courtOpinion, 4600), sentence: sanitize(raw.sentence || fb.sentence, 3400), closingComment: sanitize(raw.closingComment || fb.closingComment, 360), absurdDetails: list(raw.absurdDetails, fb.absurdDetails, 12, 190), evidenceBits: list(raw.evidenceBits, fb.evidenceBits, 8, 190), defendantExcuses: list(raw.defendantExcuses, fb.defendantExcuses, 5, 240), penaltyIdeas: list(raw.penaltyIdeas, fb.penaltyIdeas, 6, 240) }; }
function allResultText(data) { return [data.refinedCaseTitle, data.absurdityTitle, data.expandedCase, data.caseTimeline, data.forensicReport, data.plaintiffArg, data.defendantArg, data.courtOpinion, data.sentence, data.closingComment, ...(data.absurdDetails || []), ...(data.evidenceBits || []), ...(data.defendantExcuses || []), ...(data.penaltyIdeas || [])].join(' '); }
function tooGeneric(data, scene) { const joined = allResultText(data); const boringHits = BORING_WORDS.filter(w => joined.includes(w)).length; const concreteHits = [scene.item, scene.place, scene.actor, scene.witnessA, scene.witnessB].filter(w => w && joined.includes(w)).length; const dialogueHits = (joined.match(/[“”]/g) || []).length + (joined.match(/:/g) || []).length; return boringHits >= 2 || concreteHits < 4 || dialogueHits < 10 || joined.length < 1300 || hasForbiddenContamination(joined, scene); }
function strictContextNotice(scene) { const forbidden = forbiddenTermsForInput(scene.inputText || ''); return forbidden.length ? `\n절대 금지: 입력에 없는 다음 요소를 결과에 쓰지 마라: ${forbidden.join(', ')}. 예시 사건을 가져오지 말고 입력 사건만 사용하라.` : '\n입력 사건에 실제로 있는 요소만 사용하라.'; }
async function generateAi(model, c, judgeType, people, geminiImage, fb) {
  const scene = fb.scene || scenarioFor(c);
  const prompt = `너는 소소킹 황당재판소의 예능 재판 대본 작가다. 결과는 실제 법률 조언이 아니라 오락용 황당재판 대본이다. JSON만 출력한다.\n\n입력 사건명: ${scene.rawTitle}\n입력 사건내용: ${scene.rawDesc}\n이번 사건의 장소: ${scene.place}\n이번 사건의 핵심 대상: ${scene.item}\n이번 사건의 가상 피고: ${scene.actor}\n이번 사건의 가상 증인 후보: ${scene.witnessA}, ${scene.witnessB}, ${scene.witnessC}\n재판부 성향: ${judgeType}\n담당자: ${JSON.stringify(people)}\n${strictContextNotice(scene)}\n\n반드시 지킬 것:\n1. 딱딱한 문서 설명 금지. 예능 재판 대본처럼 써라.\n2. 모든 주요 필드에 대사 문장을 넣어라.\n3. 사건내용을 그대로 반복하지 말고, 위에 적힌 이번 사건의 장소·대상·피고·증인만 사용해 가짜 목격자·가짜 증거·가짜 현장 재연·가짜 신문 장면을 만들어라.\n4. 입력에 없는 공원, 빵, 강아지, 고양이, 목줄, 꼬리, 비둘기 같은 예시 요소를 절대 끌어오지 마라.\n5. ${scene.item}, ${scene.place}, ${scene.actor}가 계속 등장해야 한다.\n6. 피고 측 변론은 말도 안 되지만 웃기고 그럴듯해야 한다.\n7. 재판부 판단은 엄숙한 판결문 말투이되 내용은 골때려야 한다.\n8. 주문은 사건별 맞춤형으로 써라. 아무 사건에나 붙는 일반 문구 금지.\n9. 금지 표현: 평온, 정적, 미세한 흔적, 기록 보존 가치, 결정적 순간, 원래 상태, 단순한 배경, 생활형 증거.\n\n필드: refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, sentence, closingComment, absurdDetails(12개), evidenceBits(8개), defendantExcuses(5개), penaltyIdeas(6개).`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const data = normalize(safeJson(result.response.text()), fb);
  const finalData = tooGeneric(data, scene) ? normalize(fb, fb) : data;
  return { data: finalData, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  let c = snap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(c.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  const people = { courtroom: c.courtroom || pickFrom(COURTROOMS, c.caseTitle), recordClerk: c.recordClerk || pickFrom(CLERKS, c.caseTitle), analystName: c.analystName || pickFrom(ANALYSTS, c.caseTitle), prosecutorName: c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle), defenderName: c.defenderName || pickFrom(DEFENDERS, c.caseTitle) };

  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
    c = current;
    tx.update(caseRef, { status: 'processing', courtStage: 'hearing', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  });

  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const fb = fallbackFor(c, judgeType, people);
  const geminiImage = await imageForGemini(c).catch(err => { console.warn('image load skipped:', err.message || err); return null; });
  let data = fb;
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let generationMode = 'local-context-bound-script-v7';
  let aiGenerated = false;

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName, generationConfig: { temperature: 1.25, topP: 0.98, topK: 64, maxOutputTokens: 8000, responseMimeType: 'application/json' } });
    const generated = await generateAi(model, c, judgeType, people, geminiImage, fb);
    data = generated.data;
    totals = generated.usage;
    generationMode = tooGeneric(data, fb.scene) ? 'local-context-bound-script-v7' : 'ai-context-bound-script-v7';
    aiGenerated = generationMode.startsWith('ai-');
  } catch (err) { console.error('document generation skipped:', err); }

  try {
    await resultRef.set({ userId: c.userId, ownerId: c.userId, isPublic: c.isPublic === true, docketNumber: c.docketNumber || '', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과', originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '', absurdityTitle: data.absurdityTitle, imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '', expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas, grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType, reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment, aiGenerated, generationMode, resultVersion: 'context-bound-absurd-script-v7', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${data.refinedCaseTitle || c.caseTitle || '본 사건'}을 실제 법률 사안이 아닌 예능형 황당재판 대본으로 판단한다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion, executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', appealNotice: '본 사건은 1회에 한하여 마음속 항소가 가능하다. 다만 항소심도 실제 법적 효력은 없다.', reactionTotal: 0, totalVotes: 0, commentCount: 0, courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await caseRef.update({ status: 'completed', courtStage: 'sentenced', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, isPublic: c.isPublic === true, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  } catch (err) {
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: err.message || '저장 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({ date: today, geminiRequests: FieldValue.increment(totals.requests), geminiInputTokens: FieldValue.increment(totals.inputTokens), geminiOutputTokens: FieldValue.increment(totals.outputTokens), caseCount: FieldValue.increment(1), imageCaseCount: FieldValue.increment(geminiImage ? 1 : 0), firestoreReads: FieldValue.increment(3), firestoreWrites: FieldValue.increment(4), functionInvocations: FieldValue.increment(1), robustAbsurdCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { console.error('usage log failed:', e); }
  }
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'context-bound-absurd-script-v7', generationMode };
});
