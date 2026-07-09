const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];

const FORBIDDEN_BORING = ['평온', '정적', '미세한 흔적', '기록 보존 가치', '결정적 순간', '원래 상태', '단순한 배경', '생활형 증거'];
const OBJECT_HINTS = [
  ['빵', '빵'], ['라면', '라면'], ['커피', '커피'], ['치킨', '치킨'], ['과자', '과자'], ['푸딩', '푸딩'], ['아이스크림', '아이스크림'], ['떡볶이', '떡볶이'],
  ['리모컨', '리모컨'], ['충전기', '충전기'], ['우산', '우산'], ['자리', '자리'], ['주차', '주차자리'], ['카톡', '카톡'], ['문자', '문자'], ['택배', '택배'], ['냉장고', '냉장고']
];
const PLACE_HINTS = ['공원', '회사', '집', '카페', '편의점', '식당', '학교', '버스', '지하철', '엘리베이터', '주차장', '놀이터', '사무실', '거실'];
const ACTOR_PACKS = [
  {
    keys: ['강아지','개','반려견','댕댕이'],
    actor: '강아지 피고',
    side: '꼬리변호인단',
    signature: '꼬리 흔들기와 눈망울 항변',
    excuse: item => `강아지 측은 ${item}이 먼저 코를 불렀고, 피고는 냄새의 소환장에 성실히 출석했을 뿐이라고 항변한다.`,
    witness: ['목줄 잡은 보호자의 흔들리는 손목', '벤치 아래 비둘기 1호', '산책로를 지나던 유모차 방청객', '입가에 남은 수상한 빵가루'],
    penalty: item => [`피고 강아지는 향후 ${item} 발견 시 보호자 승인 전까지 코만 출석시킨다.`, '보호자는 산책 중 간식권 침해 예방을 위해 목줄 경보 단계를 한 칸 올린다.', '피고는 원고 앞에서 3초간 미안한 눈망울을 제출한다.']
  },
  {
    keys: ['고양이','냥이','길고양이'],
    actor: '고양이 피고',
    side: '냥권수호 변호인단',
    signature: '모른 척 그루밍 항변',
    excuse: item => `고양이 측은 ${item}이 잠시 자신의 영역 안으로 들어왔고, 피고는 우주의 균형을 확인했을 뿐이라고 주장한다.`,
    witness: ['창틀 위 먼지', '눈 마주치자 외면한 피고', '식탁 모서리의 발자국', '방청석이 목격한 태연한 그루밍'],
    penalty: item => [`피고 고양이는 향후 ${item} 접근 전 집사를 1회 바라본다.`, '집사는 피해물 보관 시 냥권 사각지대를 피한다.', '피고는 미안함 대신 골골송 5초를 제공한다.']
  },
  {
    keys: ['친구','동료','회사','직장','남편','아내','엄마','아빠','가족','사람'],
    actor: '생활 피고',
    side: '그럴수도 변호인단',
    signature: '대수롭지 않다는 표정 항변',
    excuse: item => `피고 측은 ${item} 문제가 이렇게까지 기록철에 오를 줄 몰랐으며, 당시에는 그냥 넘어갈 수 있는 생활 소음으로 보였다고 항변한다.`,
    witness: ['옆에서 눈치 보던 컵', '말없이 식어가던 공기', '원고의 1.5초 늦은 대답', '방청석 없는 방청석의 술렁임'],
    penalty: item => [`피고는 향후 ${item} 관련 행동 전 원고의 표정을 1회 확인한다.`, '피고는 그럴 수도 있지 발언권을 하루 1회로 제한한다.', '피고는 원고에게 작은 간식으로 감정 항소비용을 납부한다.']
  }
];

function cleanText(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanLong(v, n) { return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n); }
function sanitize(v, n = 4000) {
  let out = cleanLong(v, n)
    .replaceAll('사이트', '기록철')
    .replaceAll('시스템', '재판부')
    .replaceAll('AI', '재판부')
    .replaceAll('프롬프트', '접수조서')
    .replaceAll('자동 생성', '작성')
    .replaceAll('사용자 입력', '접수진술')
    .replaceAll('생활형 처분', '소소형량')
    .replaceAll('원고의 평온', '원고의 멘탈 방어막')
    .replaceAll('생활 평온', '일상 방어막')
    .replaceAll('평온', '멘탈 방어막')
    .replaceAll('정적', '갑자기 열린 무음모드')
    .replaceAll('미세한 흔적', '수상한 생활 잔여물')
    .replaceAll('기록 보존 가치', '방청석 박제 가치')
    .replaceAll('실제 법률 문제가 아니라', '진짜 법원에 갈 일은 아니지만');
  return out;
}
function pickFrom(arr, seed = '') { let x = 0; const s = String(seed || Date.now()); for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 1)) % 9973; return arr[x % arr.length]; }
function pickJudge(v) { return JUDGES.includes(v) ? v : JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length]; }
function kstDateKey(d = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
function safeJson(text) { const raw = String(text || '').replace(/```json|```/g, '').trim(); const a = raw.indexOf('{'); const b = raw.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('JSON parse failed'); return JSON.parse(raw.slice(a, b + 1)); }
function list(v, fallback, max, len) { const rows = Array.isArray(v) ? v.map(x => sanitize(x, len)).filter(Boolean).slice(0, max) : []; while (rows.length < fallback.length) rows.push(fallback[rows.length]); return rows.slice(0, max); }
async function loadSettings() { try { const s = await db.doc('site_settings/config').get(); return s.exists ? s.data() : {}; } catch { return {}; } }
function softenCaseText(text) {
  return cleanText(text, 1200)
    .replaceAll('음주운전', '술기운 의혹')
    .replaceAll('고소', '엄숙 항의')
    .replaceAll('신고', '방청석 제보')
    .replaceAll('절도', '슬쩍 실종')
    .replaceAll('사기', '말바꾸기 의혹')
    .replaceAll('폭행', '과격한 몸짓')
    .replaceAll('형사', '매우 진지한')
    .replaceAll('법원', '마음속 재판장');
}
function includesAny(text, keys) { return keys.some(k => text.includes(k)); }
function detectObject(text) { return (OBJECT_HINTS.find(([k]) => text.includes(k)) || [null, '사건 대상'])[1]; }
function detectPlace(text) { return PLACE_HINTS.find(p => text.includes(p)) || '현장'; }
function actorPack(text) { return ACTOR_PACKS.find(p => includesAny(text, p.keys)) || ACTOR_PACKS[2]; }
function scenarioFor(c) {
  const rawTitle = cleanText(c.caseTitle, 90) || '소소한 황당사건';
  const rawDesc = cleanText(c.caseDescription, 1200) || rawTitle;
  const desc = softenCaseText(rawDesc);
  const text = `${rawTitle} ${desc}`;
  const item = detectObject(text);
  const place = detectPlace(text);
  const pack = actorPack(text);
  const actor = pack.actor;
  const seed = `${rawTitle}|${rawDesc}`;
  const witnessA = pickFrom(pack.witness, seed + 'w1');
  const witnessB = pickFrom(pack.witness.filter(w => w !== witnessA), seed + 'w2') || pack.witness[0];
  const fakeExhibit = item === '빵' ? '반달 모양으로 사라진 빵의 마지막 기억' : `${item} 주변에 남은 억울함의 테두리`;
  return { rawTitle, rawDesc, desc, text, item, place, pack, actor, side: pack.side, signature: pack.signature, witnessA, witnessB, fakeExhibit, seed };
}
async function imageForGemini(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  const path = img?.storagePath || c?.imageStoragePath || '';
  const mimeType = cleanText(img?.mimeType, 30) || 'image/jpeg';
  if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) return null;
  let data = String(img?.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data && path) {
    const [buf] = await getStorage().bucket().file(path).download();
    if (buf.length > 700000) return null;
    data = buf.toString('base64');
  }
  return data && data.length <= 950000 && /^[A-Za-z0-9+/=]+$/.test(data) ? { mimeType, data } : null;
}
function imageMeta(c) {
  const img = c?.imageAttachment || c?.imageAttachmentMeta || null;
  return img && typeof img === 'object' ? { storagePath: cleanText(img.storagePath || c.imageStoragePath, 240), mimeType: cleanText(img.mimeType, 30), width: Number(img.width || 0), height: Number(img.height || 0), originalName: cleanText(img.originalName, 80), originalSize: Number(img.originalSize || 0), resizedSize: Number(img.resizedSize || 0) } : null;
}
function funnyTitle(scene) {
  const endings = [`${scene.item} 긴급압수 사건`, `${scene.item} 대참사 사건`, `${scene.actor} 방청석 술렁 사건`, `${scene.item} 멘탈손괴 사건`, `${scene.place} 일상질서 붕괴 사건`];
  const base = pickFrom(endings, scene.seed);
  return base.replace(/사건\s*사건$/g, '사건').slice(0, 44);
}
function fallbackFor(c, judgeType, people) {
  const scene = scenarioFor(c);
  const finalTitle = funnyTitle(scene);
  const penalties = scene.pack.penalty(scene.item);
  const absurdDetails = [
    `${scene.place}에서 ${scene.item}이 원고의 행복 예정분에서 긴급 이탈함`,
    `${scene.actor}이 ${scene.signature}으로 현장을 장악함`,
    `${scene.witnessA}이 침묵으로 사건의 심각성을 증언함`,
    `원고의 손에는 먹을 계획만 남고 ${scene.item}은 사라짐`,
    `${scene.fakeExhibit}이 생활증거 1호로 채택됨`,
    `방청석 없는 ${scene.place}에 마음속 방청석 12명이 착석함`,
    `원고의 억울함이 셀프로 기립하여 발언권을 요구함`,
    `${scene.item}의 향기가 사건의 공범처럼 현장을 배회함`,
    `${scene.actor}의 태연함이 원고의 혈압 버튼을 누름`,
    `주변 공기가 '이건 좀 억울하다' 쪽으로 기울어짐`,
    `원고의 한눈판 시간이 사건 발생 허가서처럼 악용됨`,
    `사소한 일이 갑자기 대하드라마 1화로 확장됨`
  ];
  const evidenceBits = [
    `${scene.fakeExhibit}`,
    `${scene.witnessA}의 무언의 현장 진술`,
    `${scene.witnessB}의 수상한 시선 회피`,
    `${scene.actor}의 너무 자연스러운 태도`,
    `원고 손에 남은 허무한 빈자리`,
    `${scene.place} 공기 중 떠다닌 억울함 농도`,
    `${scene.item}이 있어야 할 자리에 남은 상실감`,
    `사건 직후 원고 표정의 와이파이 끊김 현상`
  ];
  const defendantExcuses = [
    scene.pack.excuse(scene.item),
    `피고 측은 ${scene.place}의 분위기가 워낙 자유로워 ${scene.item} 역시 자유를 원한 것으로 보였다고 주장한다.`,
    `${scene.side}은 원고가 한눈을 판 순간 이미 사건의 운명이 바삭하게 구워졌다고 항변한다.`,
    `피고 측은 고의가 아니라 본능과 향기의 합작품이었다고 말한다.`,
    `다만 피고 측도 원고의 표정이 잠시 로딩 화면처럼 멈춘 사실은 부인하지 못한다.`
  ];
  const penaltyIdeas = [
    ...penalties,
    `피고 측은 ${scene.item} 상당의 대체 만족물을 원고에게 제공하는 방안을 검토한다.`,
    `원고는 향후 ${scene.place}에서 ${scene.item}을 보관할 때 방청석급 경계태세를 발령할 수 있다.`,
    `재판부는 본 사건을 ${scene.item} 계엄령 직전의 생활참사로 마음속 기록철에 편철한다.`
  ].slice(0, 6);
  return {
    refinedCaseTitle: finalTitle,
    absurdityTitle: `${finalTitle} 기록철`,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n접수된 사건내용은 다음과 같다. ${scene.rawDesc}\n\n재판부는 본 사안을 단순한 ${scene.item} 관련 해프닝으로 보지 않는다. 원고가 ${scene.place}에서 잠시 방심한 사이, ${scene.actor}은 사건의 중앙무대로 걸어 들어왔고 ${scene.item}은 원고의 입이 아닌 운명의 다른 방향으로 이동하였다. 이때 ${scene.witnessA}은 아무 말도 하지 않았으나, 그 침묵은 이미 방청석의 웅성거림과 다름없었다.`,
    caseTimeline: `문서명: 분초 단위 사건일지\n00분 00초, 원고는 ${scene.place}에서 ${scene.item}과의 평화로운 동행을 믿고 있었다.\n00분 02초, 원고가 한눈을 판 틈에 ${scene.actor}이 현장 반경 안으로 진입하였다.\n00분 04초, ${scene.item}은 원고의 소유권을 뒤로하고 피고 측 입장으로 긴급 편입되었다.\n00분 07초, 원고는 손과 입 사이에 있어야 할 행복이 증발한 사실을 확인하고 표정이 와이파이 끊긴 화면처럼 멈췄다.\n00분 12초, ${scene.witnessB}은 애써 모른 척했으나, 현장의 공기는 이미 '이건 재판감이다'라고 말하고 있었다.`,
    forensicReport: `문서명: 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${evidenceBits[0]}\n감정대상 2. 원고 손에 남은 허무한 빈자리\n감정대상 3. ${scene.actor}의 ${scene.signature}\n감정결과: ${scene.item}은 단순 물건이 아니라 원고의 예정된 행복분이었다. 특히 ${scene.actor}의 태연함은 사건 후 원고의 억울함을 전자레인지 2분 30초 수준으로 데운 것으로 판단된다.`,
    plaintiffArg: `문서명: ${people.prosecutorName} 공소장\n검사는 이 사건을 '${scene.item} 하나쯤'으로 축소하는 피고 측 태도에 강하게 이의를 제기한다. 원고에게 ${scene.item}은 단순 식품이나 물건이 아니라 그날의 작은 낙이었고, 피고는 그 낙을 예고편 없이 본편째 가져갔다. 검사는 ${scene.witnessA}과 ${scene.witnessB}의 침묵조차 현장의 어이없음을 뒷받침한다고 주장한다.`,
    defendantArg: `문서명: ${people.defenderName} 답변서\n${defendantExcuses[0]} ${defendantExcuses[1]} ${scene.side}은 원고가 한눈을 판 점도 사건 발생에 일부 기여했다고 항변한다. 그러나 재판부의 질문에 피고 측은 '${scene.item}이 왜 그렇게 빠르게 사라졌는가'에 대해 명확한 설명을 내놓지 못했다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 본 사건의 핵심 쟁점을 세 가지로 본다. 첫째, ${scene.item}은 언제부터 피고의 관심권에 들어갔는가. 둘째, 원고의 한눈판 시간은 과연 ${scene.actor}에게 자유이용권을 준 것인가. 셋째, ${scene.place}에서 발생한 이 사소한 참사가 왜 원고의 하루를 살짝 구겨놓았는가. 재판부는 피고의 귀여움 또는 태연함을 참작하되, 그 귀여움이 ${scene.item}의 행방을 정당화할 수는 없다고 판단한다.`,
    sentence: `문서명: 주문 및 소소형량\n1. ${penaltyIdeas[0]}\n2. ${penaltyIdeas[1]}\n3. ${penaltyIdeas[2]}\n4. ${penaltyIdeas[3]}\n5. ${penaltyIdeas[4]}\n6. ${penaltyIdeas[5]}`,
    closingComment: `${scene.item}은 작았으나, 사라진 순간 원고의 마음속에서는 긴급 속보 자막이 흘렀다.`,
    absurdDetails, evidenceBits, defendantExcuses, penaltyIdeas,
    scene
  };
}
function normalize(raw, fb) {
  return {
    refinedCaseTitle: sanitize(raw.refinedCaseTitle, 80) || fb.refinedCaseTitle,
    absurdityTitle: sanitize(raw.absurdityTitle, 120) || fb.absurdityTitle,
    expandedCase: sanitize(raw.expandedCase || fb.expandedCase, 5200),
    caseTimeline: sanitize(raw.caseTimeline || fb.caseTimeline, 4200),
    forensicReport: sanitize(raw.forensicReport || fb.forensicReport, 4200),
    plaintiffArg: sanitize(raw.plaintiffArg || fb.plaintiffArg, 3600),
    defendantArg: sanitize(raw.defendantArg || fb.defendantArg, 3400),
    courtOpinion: sanitize(raw.courtOpinion || fb.courtOpinion, 3800),
    sentence: sanitize(raw.sentence || fb.sentence, 3000),
    closingComment: sanitize(raw.closingComment || fb.closingComment, 300),
    absurdDetails: list(raw.absurdDetails, fb.absurdDetails, 12, 170),
    evidenceBits: list(raw.evidenceBits, fb.evidenceBits, 8, 170),
    defendantExcuses: list(raw.defendantExcuses, fb.defendantExcuses, 5, 220),
    penaltyIdeas: list(raw.penaltyIdeas, fb.penaltyIdeas, 6, 220)
  };
}
function tooGeneric(data, scene) {
  const joined = [data.expandedCase, data.caseTimeline, data.forensicReport, data.plaintiffArg, data.defendantArg, data.courtOpinion, data.sentence, data.closingComment].join(' ');
  const boringHits = FORBIDDEN_BORING.filter(w => joined.includes(w)).length;
  const concreteHits = [scene.item, scene.place, scene.actor, scene.witnessA, scene.witnessB].filter(w => w && joined.includes(w)).length;
  return boringHits >= 2 || concreteHits < 3 || joined.length < 900;
}
async function generateAi(model, c, judgeType, people, geminiImage, fb) {
  const scene = fb.scene || scenarioFor(c);
  const prompt = `너는 소소킹 황당재판소의 예능 작가 겸 재판장이다. 실제 법률 조언이 아니라, 사용자가 쓴 사소한 사건을 바탕으로 '가상의 사건 진행 과정 + 재판 공방 + 판결'을 만들어라. 결과는 JSON만 출력한다.

입력 사건명: ${scene.rawTitle}
입력 사건내용: ${scene.rawDesc}
감지된 장소: ${scene.place}
감지된 대상: ${scene.item}
가상 피고: ${scene.actor}
재판부: ${judgeType}
담당자: ${JSON.stringify(people)}

작성 방식:
1. 사건내용을 그대로 반복하지 말고, 그 내용을 바탕으로 가짜 목격자, 가짜 증거, 가짜 현장 분위기, 가짜 재판 공방을 새로 만들어라.
2. 모든 주요 섹션에 반드시 '${scene.item}', '${scene.place}', '${scene.actor}' 중 2개 이상을 넣어라.
3. 원고 주장은 억울함을 과장하되 귀엽고 진지하게 써라.
4. 피고 측은 말도 안 되지만 그럴듯한 변명을 하게 만들어라. 예: 냄새가 먼저 불렀다, 본능의 소환장이 도착했다, 한눈판 시간이 자유이용권처럼 보였다.
5. 재판부 판단은 진짜 판결문처럼 엄숙하지만 내용은 골때리게 써라.
6. 주문은 사건별 맞춤형이어야 한다. 아무 사건에나 붙일 수 있는 일반 문구 금지.
7. 금지 표현: 평온, 정적, 미세한 흔적, 기록 보존 가치, 결정적 순간, 원래 상태, 단순한 배경, 생활형 증거.
8. 문서명은 유지하되 본문은 사건별로 달라야 한다.
9. 너무 착하고 밋밋한 문장 금지. 웃긴 비유를 각 섹션마다 넣어라.

필드:
refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, sentence, closingComment, absurdDetails(12개), evidenceBits(8개), defendantExcuses(5개), penaltyIdeas(6개).

각 필드 요구:
- expandedCase: 사건내용에서 출발해 가상의 현장 상황을 5문장 이상으로 확장.
- caseTimeline: 분초 단위로 5단계 이상 사건 진행.
- forensicReport: 가짜 감정대상 3개 이상과 황당 감정결과.
- plaintiffArg: 원고 측 공소장처럼 4문장 이상.
- defendantArg: 피고 측 답변서처럼 4문장 이상.
- courtOpinion: 쟁점 3개와 판단 이유 5문장 이상.
- sentence: 반드시 '문서명: 주문 및 소소형량'으로 시작하고 6개 번호 처분.
- closingComment: 한 줄 명대사.`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const data = normalize(safeJson(result.response.text()), fb);
  return { data: tooGeneric(data, scene) ? normalize(fb, fb) : data, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
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
  let generationMode = 'local-fictional-proceedings-v5';
  let aiGenerated = false;
  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName, generationConfig: { temperature: 1.28, topP: 0.99, topK: 64, maxOutputTokens: 7000, responseMimeType: 'application/json' } });
    const generated = await generateAi(model, c, judgeType, people, geminiImage, fb);
    data = generated.data;
    totals = generated.usage;
    generationMode = tooGeneric(data, fb.scene) ? 'local-fictional-proceedings-v5' : 'ai-fictional-proceedings-v5';
    aiGenerated = generationMode.startsWith('ai-');
  } catch (err) {
    console.error('document generation skipped:', err);
  }

  try {
    await resultRef.set({
      userId: c.userId,
      ownerId: c.userId,
      isPublic: c.isPublic === true,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과', originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '', absurdityTitle: data.absurdityTitle,
      imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
      aiGenerated, generationMode, resultVersion: 'fictional-absurd-proceedings-v5', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${data.refinedCaseTitle || c.caseTitle || '본 사건'}이 진짜 법원에 갈 일은 아니지만 마음속 방청석 기준으로는 충분히 호들갑 떨 만한 사안이라고 본다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion,
      executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', appealNotice: '본 사건은 1회에 한하여 마음속 항소가 가능하다. 다만 항소심도 실제 법적 효력은 없다.', reactionTotal: 0, totalVotes: 0, commentCount: 0, courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
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
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!geminiImage, resultVersion: 'fictional-absurd-proceedings-v5', generationMode };
});
