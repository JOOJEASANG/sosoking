const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보', '한과몰입 법정주사'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '사소범죄전담 나과몰입 형사', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '한입권 담당 나과장 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사', '피고방어전담 임몰랐다 변호인'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
function sanitize(value, maxLen = 4000) {
  let t = cleanLong(value, maxLen);
  const pairs = [
    ['사이트', '기록철'], ['시스템', '재판부'], ['AI', '재판부'], ['프롬프트', '접수조서'], ['자동 생성', '작성'], ['사용자 입력', '접수진술'],
    ['7차 정리', '정밀 검토'], ['정리·보완', '기록 검토'], ['생활질서 미세교란', '생활평온 침범'], ['사건 경위에 기재된 결정적 행동', '그 한입의 순간'],
    ['평온한 상태에 있었다', '방심의 그늘 아래 있었다'], ['마음속 CCTV', '기억 속 현장도'], ['상상 목격자', '침묵한 현장']
  ];
  for (const [a, b] of pairs) t = t.split(a).join(b);
  return t;
}
function pickFrom(arr, seedText = '') {
  const s = String(seedText || Date.now());
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[n % arr.length];
}
function pickJudge(value) {
  if (JUDGES.includes(value)) return value;
  return JUDGES[(Date.now() + Math.floor(Math.random() * 1000000)) % JUDGES.length];
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function imageForGemini(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = cleanText(value.mimeType, 30);
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  if (!data || data.length > 700000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { mimeType, data };
}
function imageMeta(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    mimeType: cleanText(value.mimeType, 30),
    width: Number(value.width || 0),
    height: Number(value.height || 0),
    originalName: cleanText(value.originalName, 80),
    originalSize: Number(value.originalSize || 0),
    resizedSize: Number(value.resizedSize || 0)
  };
}
async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}
function buildModel(modelName, temperature) {
  return new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
    model: modelName,
    generationConfig: { temperature, topP: 0.98, topK: 50, responseMimeType: 'application/json' }
  });
}
function infer(text) {
  const t = String(text || '');
  const isDog = /개|강아지|리트리버|반려견|댕댕|견주/.test(t);
  const isBread = /빵|샌드위치|베이글|크루아상|소금빵|간식/.test(t);
  const isPark = /공원|산책|벤치|놀이터|길/.test(t);
  const isRoom = /방|문|동생|가족|집/.test(t);
  const isOffice = /회사|탕비실|카누|커피|사무실/.test(t);
  const subject = isDog ? '리트리버' : isRoom ? '동생' : isOffice ? '탕비실 범인' : '피고';
  const object = isBread ? '빵' : isOffice ? '마지막 카누' : isRoom ? '방문' : '문제의 물건';
  const place = isPark ? '공원 벤치' : isOffice ? '회사 탕비실' : isRoom ? '방 문 앞' : '사건 현장';
  const act = isDog && isBread ? '무단섭취' : isOffice ? '봉지 방치' : isRoom ? '미닫힘' : '평온 침범';
  return { subject, object, place, act, isDog, isBread };
}
function localScene(c) {
  const source = `${c.caseTitle || ''} ${c.caseDescription || ''}`;
  const k = infer(source);
  const baseTitle = cleanText(c.caseTitle, 80) || `${k.place} ${k.subject} ${k.object} ${k.act} 사건`;
  const title = baseTitle.endsWith('사건') ? baseTitle : `${baseTitle} 사건`;
  const dogBread = k.isDog && k.isBread;
  const absurdDetails = dogBread ? [
    '벤치 위에서 반쯤 열린 빵 봉투', '원고가 물병 뚜껑을 돌리던 3초의 공백', '산책줄이 허용한 42cm의 자유', '빵 봉투를 향해 낮아진 리트리버의 코끝',
    '원고의 손바닥에 남은 빵 기름기', '봉투 바닥의 반달 모양 부스러기', '견주의 어머와 얘가 왜 이러지 사이의 침묵', '피고견의 지나치게 맑은 무죄 눈망울',
    '벤치 아래로 떨어진 깨알 같은 빵가루 4점', '사라진 마지막 한입권', '입가에 잠깐 번진 빵 냄새의 잔향', '원고가 들고 있던 음료의 의미 없는 차가움'
  ] : [
    `${k.place}에 남은 이상하게 긴 정적`, `${k.object} 주변의 어긋난 위치`, `${k.subject}의 애매하게 평온한 표정`, `원고가 기대하던 ${k.object}의 원래 상태`,
    `${k.act} 직후 찾아온 침묵`, `${k.object} 앞에서 멈춘 원고의 손`, `현장 주변의 불필요하게 선명한 흔적`, `누구도 책임지지 않는 3초의 공백`,
    `피고 측의 너무 자연스러운 태도`, `원고의 표정에 남은 납득 불가`, `${k.object}이 남긴 상징적 허전함`, `사건 후 더 크게 들린 주변 소음`
  ];
  const evidenceBits = dogBread ? [
    '봉투 바닥의 반달형 부스러기 집중도', '빵 냄새가 남은 손바닥 표면', '벤치 전방 42cm 지점의 접근 가능 범위', '산책줄 장력의 순간적 완화',
    '리트리버 입가 주변의 빵가루 추정 흔적', '원고의 시선이 물병 쪽으로 이동한 시간대', '견주의 당황 표정 지속 시간', '피고견의 침묵과 꼬리 흔들림의 불일치'
  ] : [
    `${k.object} 위치의 미세한 어긋남`, `${k.place} 주변의 정적`, `원고 진술 속 3초 공백`, `${k.subject}의 모호한 반응`,
    `사건 직후 원고의 손동작`, `현장에 남은 생활 흔적`, `${k.object}이 원래 있어야 할 자리`, `피고 측 변명과 현장감의 차이`
  ];
  const defendantExcuses = dogBread ? [
    '피고견은 빵을 소유물로 인식하지 못했을 뿐이라고 주장한다.', '견주는 냄새가 먼저 피고견을 불렀다고 항변한다.', '피고 측은 원고가 봉투를 너무 민주적으로 열어두었다고 주장한다.', '피고견은 눈망울만으로 고의 부존재를 호소한다.', '피고 측은 산책줄 42cm가 우연히 만든 비극이라고 말한다.'
  ] : [
    '피고 측은 고의가 없었다고 주장한다.', '당시 상황이 너무 일상적이었다고 항변한다.', '원고가 지나치게 엄숙하게 받아들였다고 말한다.', '문제의 대상이 원래 그런 상태였다고 주장한다.', '피고 측은 3초의 공백을 기억하지 못한다고 한다.'
  ];
  const penaltyIdeas = dogBread ? [
    '견주는 동일 규격의 빵 1개와 예비빵 1개를 제공한다.', '피고견은 빵 봉투와 30cm 안전거리를 유지한다.', '견주는 산책줄 42cm 자유구역을 사건 장소에서 1회 재측정한다.', '원고에게 마지막 한입권 회복용 간식을 제공한다.', '피고견은 빵 앞에서 앉아 5초간 대기 훈련을 실시한다.', '견주는 별일 아니죠라는 말을 하기 전 봉투 바닥을 확인한다.'
  ] : [
    `${k.object} 원상회복에 준하는 생활형 조치를 실시한다.`, `피고는 같은 상황에서 3초간 멈춰 확인한다.`, `원고에게 작은 간식 또는 음료로 평화조치를 제안한다.`, `${k.place} 주변을 사건 전 상태로 정리한다.`, `피고는 그럴 수도 있지라는 말의 사용을 1회 보류한다.`, `재발 방지를 위해 ${k.object}의 위치를 먼저 확인한다.`
  ];
  const desc = cleanText(c.caseDescription, 700) || title;
  const expandedCase = `문서명: 사건 배경 및 발단 기록\n원고의 진술은 짧았다. ${desc}\n그러나 기록관은 이 문장을 곧장 덮지 못했다. ${k.place}에는 아무 일도 없었다는 듯한 공기가 남아 있었고, 그 평온함이 오히려 사건을 더 선명하게 만들었다. 원고는 ${k.object}을 단순한 물건으로 들고 있지 않았다. 그것은 잠시 쉬어 가는 시간의 증표였고, 오늘 하루가 아직 무너지지 않았다는 작고 따뜻한 보증서였다. 그때 ${k.subject}이 조용히 사건의 중심으로 진입하였다. 누구도 개막을 선언하지 않았다. 다만 ${absurdDetails[1]}이 있었고, ${absurdDetails[2]}가 있었다. 결정적 순간은 크지 않았다. ${absurdDetails[3]}이 ${k.object}을 향하는 사이, 원고가 믿고 있던 질서는 종이봉투처럼 얇게 접혔다. 현장에는 ${evidenceBits[0]}와 ${evidenceBits[1]}이 남았다. 원고가 잃은 것은 ${k.object} 그 자체만이 아니었다. 마지막 한입을 스스로 결정할 권리, 방심해도 된다는 믿음, 그리고 이 정도는 안전하겠지라는 생활의 작은 헌법이었다.`;
  return { refinedCaseTitle: title, absurdityTitle: `${title} 기록철`, expandedCase, absurdDetails, evidenceBits, defendantExcuses, penaltyIdeas, closingCommentSeed: `${k.object} 앞에서 멈춘 원고의 표정` };
}
function localDocs(c, judgeType, people, scene) {
  const d = scene.absurdDetails || [];
  const e = scene.evidenceBits || [];
  const x = scene.defendantExcuses || [];
  const p = scene.penaltyIdeas || [];
  const title = scene.refinedCaseTitle || c.caseTitle || '황당사건';
  const subject = title.replace(/사건$/g, '').trim();
  return {
    refinedCaseTitle: title,
    absurdityTitle: scene.absurdityTitle || `${title} 기록철`,
    expandedCase: sanitize(scene.expandedCase, 4400),
    caseTimeline: sanitize(`문서명: ${subject} 분초 단위 사건일지\n00분 00초, 원고는 ${d[0]} 앞에서 아직 세상이 정상적으로 굴러간다고 믿고 있었다.\n00분 03초, ${d[1]}이 발생했고, 현장은 누구도 책임지지 않는 공백을 허락하였다.\n00분 05초, ${d[2]}가 조용히 넓어졌다.\n00분 07초, ${d[3]}이 원고의 기대를 향해 다가섰다.\n00분 09초, ${e[0]}가 남았다.\n00분 12초, 원고는 ${d[9]}이 이미 원래 자리로 돌아오지 않는다는 사실을 깨달았다.\n00분 20초, 현장에는 ${e[1]}와 설명하기 어려운 정적만 남았다.`, 3200),
    forensicReport: sanitize(`문서명: ${subject} 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${e[0]}\n감정대상 2. ${e[1]}\n감정대상 3. ${e[2]}\n감정대상 4. ${e[3]}\n감정대상 5. ${e[4]}\n감정방법: 현장진술 대조, 사물 위치 추정, 표정 잔류감 분석, 생활동선 역산.\n감정결과: ${d[0]}은 단순 배경이 아니라 사건의 중심 증거로 보인다. ${e[0]}와 ${e[1]}는 원고가 느낀 허탈함이 과장만은 아니었음을 뒷받침한다.`, 3600),
    plaintiffArg: sanitize(`문서명: ${people.prosecutorName} 공소장\n검사는 본 사건을 단순한 해프닝으로 축소할 수 없다고 본다. ${d[0]}과 ${d[1]}은 원고가 방심할 자유를 잃은 순간을 증명한다. 원고가 잃은 것은 물건 하나가 아니다. ${d[9]}과 ${d[10]}이 함께 사라졌다. 피고 측이 이를 그럴 수도 있는 일로 부르는 순간, 검사는 바로 그 말이야말로 본 사건의 두 번째 피해라고 주장한다.`, 3000),
    defendantArg: sanitize(`문서명: ${people.defenderName} 답변서\n피고 측은 본 사건이 지나치게 엄숙하게 다루어졌다고 항변한다. ${x[0]} ${x[1]} 또한 ${x[2]}을 덧붙인다. 다만 변호인은 ${e[0]}과 ${d[4]}가 원고의 허탈함을 완전히 지우지는 못한다는 점을 인정하지 않을 수 없다.`, 2800),
    courtOpinion: sanitize(`문서명: 재판부 판단\n${judgeType} 재판부는 사건 배경 기록, 분초 단위 사건일지, 소소국과수 감정서, 공소장 및 답변서를 종합한다. ${d[0]}과 ${e[0]}는 이 사건이 단순한 착각으로만 정리되기 어렵게 만든다. 피고 측의 ${x[0]}도 일정 부분 참작한다. 그러나 ${d[9]} 앞에서 멈춘 원고의 표정까지 없는 일로 만들 수는 없다. 재판부는 이 조그마한 현장이 원고에게는 하루의 질서가 접히는 순간이었다는 점을 인정한다.`, 3200),
    sentence: sanitize(`문서명: 주문 및 집행권고\n1. ${p[0]}\n2. ${p[1]}\n3. ${p[2]}\n4. ${p[3]}\n5. ${p[4]}\n6. ${p[5]}`, 2600),
    closingComment: sanitize(`${scene.closingCommentSeed}은 오래가지 않았으나, 그 앞의 침묵은 충분히 길었다.`, 260)
  };
}
async function generateScene(model, c, judgeType, people, geminiImage) {
  const prompt = `너는 소소킹 황당재판소의 황당 장면 확대관이다. 짧은 접수글을 그대로 요약하지 말고, 웃긴 장면 자체를 먼저 만들어라.
입력 사건: ${cleanText(c.caseDescription, 700)}
사건명: ${cleanText(c.caseTitle, 90)}
반드시 JSON만 출력한다. absurdDetails 12개, evidenceBits 8개, defendantExcuses 5개, penaltyIdeas 6개를 만들어라.
{"refinedCaseTitle":"최종 사건명","absurdityTitle":"기록철 제목","expandedCase":"문서명: 사건 배경 및 발단 기록\\n...","absurdDetails":["구체 디테일"],"evidenceBits":["미세증거"],"defendantExcuses":["변명"],"penaltyIdeas":["처분"],"closingCommentSeed":"마지막 한 줄 소재"}`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const p = safeJson(result.response.text());
  const scene = {
    refinedCaseTitle: cleanText(p.refinedCaseTitle, 80), absurdityTitle: cleanText(p.absurdityTitle, 120), expandedCase: sanitize(p.expandedCase, 4200),
    absurdDetails: Array.isArray(p.absurdDetails) ? p.absurdDetails.map(v => cleanText(v, 140)).filter(Boolean).slice(0, 18) : [],
    evidenceBits: Array.isArray(p.evidenceBits) ? p.evidenceBits.map(v => cleanText(v, 140)).filter(Boolean).slice(0, 14) : [],
    defendantExcuses: Array.isArray(p.defendantExcuses) ? p.defendantExcuses.map(v => cleanText(v, 160)).filter(Boolean).slice(0, 10) : [],
    penaltyIdeas: Array.isArray(p.penaltyIdeas) ? p.penaltyIdeas.map(v => cleanText(v, 160)).filter(Boolean).slice(0, 10) : [],
    closingCommentSeed: cleanText(p.closingCommentSeed, 160)
  };
  return { scene, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
}
async function generateDocs(model, c, judgeType, people, scene) {
  const prompt = `아래 장면 자료를 사용해 황당재판 문서 7개를 작성하라. 추상문장보다 구체물 중심으로 쓴다. JSON만 출력한다.
장면자료: ${JSON.stringify(scene)}
{"refinedCaseTitle":"최종 사건명","absurdityTitle":"기록철 제목","expandedCase":"문서명: 사건 배경 및 발단 기록\\n...","caseTimeline":"문서명: 분초 단위 사건일지\\n...","forensicReport":"문서명: 소소국과수 감정서\\n...","plaintiffArg":"문서명: 공소장\\n...","defendantArg":"문서명: 답변서\\n...","courtOpinion":"문서명: 재판부 판단\\n...","sentence":"문서명: 주문 및 집행권고\\n1. ...","closingComment":"마지막 한 줄"}`;
  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const meta = result.response.usageMetadata || {};
  const p = safeJson(result.response.text());
  const base = localDocs(c, judgeType, people, scene);
  const data = {
    refinedCaseTitle: cleanText(p.refinedCaseTitle, 80) || base.refinedCaseTitle,
    absurdityTitle: cleanText(p.absurdityTitle, 120) || base.absurdityTitle,
    expandedCase: sanitize(p.expandedCase || base.expandedCase, 4400),
    caseTimeline: sanitize(p.caseTimeline || base.caseTimeline, 3200),
    forensicReport: sanitize(p.forensicReport || base.forensicReport, 3600),
    plaintiffArg: sanitize(p.plaintiffArg || base.plaintiffArg, 3000),
    defendantArg: sanitize(p.defendantArg || base.defendantArg, 2800),
    courtOpinion: sanitize(p.courtOpinion || base.courtOpinion, 3200),
    sentence: sanitize(p.sentence || base.sentence, 2600),
    closingComment: sanitize(p.closingComment || base.closingComment, 260)
  };
  return { data, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
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
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(c.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  const people = {
    courtroom: c.courtroom || pickFrom(COURTROOMS, c.caseTitle), recordClerk: c.recordClerk || pickFrom(CLERKS, c.caseTitle), analystName: c.analystName || pickFrom(ANALYSTS, c.caseTitle), prosecutorName: c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle), defenderName: c.defenderName || pickFrom(DEFENDERS, c.caseTitle)
  };

  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
    c = current;
    tx.update(caseRef, { status: 'processing', courtStage: 'hearing', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  });

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const geminiImage = imageForGemini(c.imageAttachment);
  const sceneModel = buildModel(modelName, 1.08);
  const docModel = buildModel(modelName, 0.98);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let scene = localScene(c);
  let data = localDocs(c, judgeType, people, scene);
  let generationMode = 'local-safe';
  let aiGenerated = false;

  try {
    const sr = await generateScene(sceneModel, c, judgeType, people, geminiImage);
    totals.requests += sr.usage.requests; totals.inputTokens += sr.usage.inputTokens; totals.outputTokens += sr.usage.outputTokens;
    if (sr.scene.absurdDetails.length >= 5 && sr.scene.evidenceBits.length >= 4) { scene = { ...scene, ...sr.scene }; generationMode = 'scene'; }
  } catch (err) {
    console.error('scene generation skipped:', err);
  }
  try {
    const dr = await generateDocs(docModel, c, judgeType, people, scene);
    totals.requests += dr.usage.requests; totals.inputTokens += dr.usage.inputTokens; totals.outputTokens += dr.usage.outputTokens;
    data = { ...data, ...dr.data }; generationMode = generationMode === 'scene' ? 'scene-docs' : 'docs'; aiGenerated = true;
  } catch (err) {
    console.error('document generation skipped:', err);
    data = localDocs(c, judgeType, people, scene);
  }

  try {
    await resultRef.set({
      isPublic, docketNumber: c.docketNumber || '', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과', originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '', absurdityTitle: data.absurdityTitle, imageAnalysis: '', hasImageAttachment: !!geminiImage, imageAttachmentMeta: imageMeta(c.imageAttachment),
      caseDescription: c.caseDescription || '', expandedCase: data.expandedCase, absurdDetails: scene.absurdDetails || [], evidenceBits: scene.evidenceBits || [], defendantExcuses: scene.defendantExcuses || [], penaltyIdeas: scene.penaltyIdeas || [], grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
      aiGenerated, generationMode, resultVersion: 'robust-absurd-scene-v2', analysisDigest: [], absurdityReview: '', keyIssues: [], evidenceList: [], investigation: '', verdict: data.courtOpinion, executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', appealNotice: '본 사건은 단심으로 종결한다.', reactionTotal: 0, totalVotes: 0, commentCount: 0, courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await caseRef.update({ status: 'completed', courtStage: 'sentenced', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, isPublic, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  } catch (err) {
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: err.message || '저장 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({ date: today, geminiRequests: FieldValue.increment(totals.requests), geminiInputTokens: FieldValue.increment(totals.inputTokens), geminiOutputTokens: FieldValue.increment(totals.outputTokens), caseCount: FieldValue.increment(1), imageCaseCount: FieldValue.increment(geminiImage ? 1 : 0), firestoreReads: FieldValue.increment(3), firestoreWrites: FieldValue.increment(4), functionInvocations: FieldValue.increment(1), robustAbsurdCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }
  return { success: true, judgeType, isPublic, hasImageAttachment: !!geminiImage, resultVersion: 'robust-absurd-scene-v2', generationMode };
});
