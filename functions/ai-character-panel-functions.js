'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const CHARACTER_GUIDE = [
  '- 운영봇 🤖: 사회자. 제목·내용·이미지를 요약하고, 토론/드립 판을 연다. 직접 드립 우승을 노리지 않는다.',
  '- 주접러 😍: 뭐든 과하게 띄워주고 호들갑을 떤다. 칭찬이 너무 커서 웃기는 캐릭터.',
  '- 반항아 😤: 일단 삐딱하게 본다. 모두가 동의할 때 일부러 반대쪽 허점을 찾는다.',
  '- 갈팡러 🤔: 이쪽도 맞고 저쪽도 맞는 것 같아서 결정을 못 한다. 양쪽 논리를 다 살리며 토론을 더 헷갈리게 만든다.',
  '- 팩폭러 🧊: 감정 없이 핵심을 찌른다. 차갑지만 짧고 정확해야 한다.',
  '- 광기러 🤪: 상상력이 이상한 방향으로 튄다. 말도 안 되는데 묘하게 그럴듯해야 한다.',
  '- 음모론자 👁️: 사소한 상황을 거대한 사건처럼 해석한다. 과몰입 추리로 웃긴다.',
  '- 아재봇 🧓: 일부러 썰렁한 말장난을 친다. 노잼인데 자꾸 생각나는 톤.',
  '- 과몰입러 🎭: 작은 일을 영화, 뉴스, 대하드라마처럼 크게 만든다.',
].join('\n');

function clean(value, max = 1000) {
  return String(value || '').replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function getAiKey() {
  try {
    const snap = await db.doc('config/ai').get();
    if (snap.exists) {
      const key = snap.data()?.apiKey;
      if (key && String(key).length > 10) return String(key).trim();
    }
  } catch {}
  try { return GEMINI_API_KEY.value().trim(); } catch { return null; }
}

async function isFeatureEnabled() {
  try {
    const snap = await db.doc('config/ai').get();
    if (!snap.exists) return true;
    const data = snap.data() || {};
    if (data.enabled === false) return false;
    return data.features?.characterPanel !== false;
  } catch { return true; }
}

async function isAdmin(uid) {
  if (!uid) return false;
  try { return (await db.doc(`admins/${uid}`).get()).exists; } catch { return false; }
}

function postType(post) {
  const modules = post.modules || {};
  if (post.subtype === 'vote' || post.feedType === 'vote' || modules.vote?.enabled || modules.vote?.ox || post.type === 'vote') return 'vote';
  return 'drip';
}

function voteOptions(post) {
  const options = post.modules?.vote?.options;
  if (!Array.isArray(options)) return [];
  return options.map(item => clean(item?.text || item, 80)).filter(Boolean).slice(0, 4);
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\s"'<>]/.test(raw)) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch { return ''; }
}

async function imagePartFromUrl(url) {
  const safe = safeUrl(url);
  if (!safe) return null;
  const res = await fetch(safe, { redirect: 'follow' });
  if (!res.ok) return null;
  const mimeType = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(mimeType)) return null;
  const len = Number(res.headers.get('content-length') || 0);
  if (len && len > 4 * 1024 * 1024) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) return null;
  return { inlineData: { data: buffer.toString('base64'), mimeType } };
}

async function buildImageParts(images = []) {
  const urls = (Array.isArray(images) ? images : []).map(safeUrl).filter(Boolean).slice(0, 3);
  const parts = [];
  for (const url of urls) {
    try {
      const part = await imagePartFromUrl(url);
      if (part) parts.push(part);
    } catch (error) {
      console.warn('[ai-character-panel] image skipped', error.message);
    }
  }
  return parts;
}

function promptFor(post) {
  const type = postType(post);
  const options = voteOptions(post);
  const title = clean(post.title, 160);
  const desc = clean(post.desc || post.body || '', 1800);
  const hasImages = Array.isArray(post.images) && post.images.length > 0;
  const modeGuide = type === 'vote'
    ? `토론소 글이다. 선택지: ${options.length ? options.join(' VS ') : '사용자 선택지 없음'}\n운영봇은 사회자로 쟁점을 정리한다. 캐릭터들은 서로 다른 성격으로 VS 구도를 밀어붙인다. 갈팡러는 반드시 양쪽 모두 그럴듯하다고 흔들어야 한다.`
    : '드립소 글이다. 운영봇은 사회자로 상황을 요약한다. 캐릭터들은 작명, 이상한 번역, 근황뉴스, 한 줄 드립 중 가장 잘 맞는 방식으로 받아친다.';

  return `너는 소소킹의 핵심 AI 캐릭터 엔진이다.
목표: 제목, 내용, 첨부 이미지까지 모두 파악해 사람들이 댓글을 달고 싶게 만드는 고품질 토론/드립 결과를 만든다.

절대 규칙:
- 운영봇은 드립러가 아니라 사회자다. 판을 열고, 상황을 정리하고, 유저 참여를 유도한다.
- 캐릭터는 실명형 사람이 아니라 닉네임형 캐릭터다. 이름부터 성격이 바로 보여야 한다.
- 뻔한 말, 안전하지만 재미없는 말, 일반 상담 멘트 금지.
- 제목과 본문에서 구체적인 단어를 반드시 집어서 활용한다.
- 이미지가 있으면 이미지 속 분위기, 물체, 표정, 상황, 구도에서 웃긴 포인트를 찾아 반영한다.
- 보이는 범위 밖의 인물 신상, 정체, 민감정보는 추측하지 않는다.
- 공격, 혐오, 성희롱, 실제 정신질환 조롱, 특정인 조롱 금지. 웃음의 대상은 사람 자체가 아니라 상황과 말투다.
- 캐릭터끼리 말투와 관점이 확실히 달라야 한다. 비슷한 말 반복 금지.
- 각 캐릭터는 최소 한 줄의 강한 punchline을 가져야 한다.

캐릭터 역할:
${CHARACTER_GUIDE}

${modeGuide}

게시글 제목: ${title || '(없음)'}
게시글 내용:
${desc || '(없음)'}
첨부 이미지: ${hasImages ? `${post.images.length}장 있음. 함께 제공된 이미지를 직접 보고 반영.` : '없음'}

반드시 JSON만 출력:
{
  "kind": "${type}",
  "headline": "AI 캐릭터 패널 제목 30자 이내",
  "imageRead": "이미지가 있으면 이미지 분석 1~2문장, 없으면 빈 문자열",
  "host": {
    "opening": "운영봇 사회자 멘트 1~2문장",
    "summary": "상황 요약 1문장",
    "question": "유저가 댓글/투표로 참여하고 싶게 만드는 질문 1문장"
  },
  "characters": [
    {
      "id": "jujup 또는 rebel 또는 bothsides 또는 fact 또는 madcap 또는 conspiracy 또는 ajae 또는 overreact",
      "name": "주접러/반항아/갈팡러/팩폭러/광기러/음모론자/아재봇/과몰입러 중 하나",
      "emoji": "이모지",
      "role": "역할",
      "stance": "입장 또는 드립 스타일",
      "lines": ["구체적인 분석/드립 1", "구체적인 분석/드립 2"],
      "punchline": "가장 웃긴 한 줄"
    }
  ],
  "bestLines": ["유저가 따라 치고 싶을 한 줄 2~4개"],
  "commentPrompt": "댓글 유도 문구 1문장"
}`;
}

function fallbackCharacters(kind) {
  if (kind === 'vote') {
    return [
      { id: 'rebel', name: '반항아', emoji: '😤', role: '삐딱한 반대충', stance: '일단 반대쪽부터 봄', lines: ['남들이 다 맞다고 할수록 더 의심스럽습니다.', '이건 선택지 싸움이 아니라 자존심 걸린 생활 습관 싸움입니다.'], punchline: '저는 일단 반대합니다. 이유는 지금부터 만들겠습니다.' },
      { id: 'bothsides', name: '갈팡러', emoji: '🤔', role: '양쪽 다 맞는 중립러', stance: '이쪽도 맞고 저쪽도 맞아서 더 헷갈림', lines: ['솔직히 이쪽 말도 맞고 저쪽 말도 맞습니다. 그래서 더 큰일입니다.', 'A를 고르면 B가 아쉽고, B를 고르면 A가 갑자기 설득력 있어집니다.'], punchline: '제 결론은 명확합니다. 저는 결론을 포기하겠습니다.' },
      { id: 'fact', name: '팩폭러', emoji: '🧊', role: '차가운 요약러', stance: '핵심만 찌름', lines: ['감정 빼고 보면 기준은 하나입니다. 누가 계속 손해 보는가.', '사소해 보여도 반복되면 룰이 됩니다.'], punchline: '이건 기분 문제가 아니라 누가 계속 손해 보느냐 문제입니다.' },
      { id: 'conspiracy', name: '음모론자', emoji: '👁️', role: '과몰입 추리러', stance: '사소한 일을 거대한 사건으로 해석', lines: ['우연이라고 하기엔 타이밍이 너무 절묘합니다.', '이 사건 뒤에는 분명 생활 패턴이라는 조직이 있습니다.'], punchline: '이건 단순한 VS가 아닙니다. 습관 세력 간의 전쟁입니다.' },
    ];
  }
  return [
    { id: 'jujup', name: '주접러', emoji: '😍', role: '호들갑 칭찬러', stance: '뭐든 크게 띄움', lines: ['이 정도 소재면 드립계에서는 거의 천연기념물입니다.', '평범한 상황인 척하지만 웃음 포인트가 너무 선명합니다.'], punchline: '이 상황은 그냥 지나가면 예의가 아닙니다.' },
    { id: 'madcap', name: '광기러', emoji: '🤪', role: '이상한 상상러', stance: '말도 안 되는 방향으로 튐', lines: ['이건 현실이 잠깐 서버 오류 낸 장면입니다.', '상황이 아니라 세계관 설정집 첫 페이지 같습니다.'], punchline: '현실이 오늘 업데이트를 잘못 눌렀습니다.' },
    { id: 'ajae', name: '아재봇', emoji: '🧓', role: '썰렁 개그 담당', stance: '일부러 낡은 말장난', lines: ['드립은 짧아야 제맛입니다. 길면 국밥도 식습니다.', '이 상황은 웃기려고 한 게 아니라 웃기게 태어났습니다.'], punchline: '이건 드립이 아니라 드립커피처럼 천천히 내려온 웃음입니다.' },
    { id: 'overreact', name: '과몰입러', emoji: '🎭', role: '대서사 담당', stance: '작은 일을 영화처럼 키움', lines: ['이건 그냥 상황이 아니라 3부작의 시작입니다.', '지금은 웃지만 2화부터 장르가 바뀔 수 있습니다.'], punchline: '이 장면, 엔딩 크레딧 올라갈 때 박수 나옵니다.' },
  ];
}

function fallbackPanel(post) {
  const kind = postType(post);
  const title = clean(post.title, 80) || '이 상황';
  const options = voteOptions(post);
  return {
    enabled: true,
    status: 'fallback',
    kind,
    headline: kind === 'vote' ? '운영봇이 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    imageCountAnalyzed: 0,
    host: {
      id: 'opsbot', name: '운영봇', emoji: '🤖', role: '사회자',
      opening: kind === 'vote' ? `토론소 열었습니다. 오늘 안건은 “${title}”입니다.` : `드립소 열었습니다. 오늘 소재는 “${title}”입니다.`,
      summary: kind === 'vote' && options.length ? `${options.join(' VS ')} 구도로 의견이 갈릴 수 있습니다.` : '짧고 강한 한 줄이 잘 먹히는 소재입니다.',
      question: kind === 'vote' ? '여러분은 어느 쪽인지 투표하고, 이유를 한 줄로 남겨주세요.' : '이 상황, 누가 제일 웃기게 받아칠까요?',
    },
    characters: fallbackCharacters(kind),
    bestLines: kind === 'vote'
      ? ['제 결론은 명확합니다. 저는 결론을 포기하겠습니다.', '저는 일단 반대합니다. 이유는 지금부터 만들겠습니다.']
      : ['현실이 오늘 업데이트를 잘못 눌렀습니다.', '이 상황은 그냥 지나가면 예의가 아닙니다.'],
    commentPrompt: kind === 'vote' ? '투표하고 한 줄 이유를 남겨주세요.' : '더 웃긴 한 줄로 받아쳐주세요.',
    model: 'fallback',
  };
}

function normalizePanel(parsed, post, imageCount) {
  const base = fallbackPanel(post);
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const rawChars = Array.isArray(data.characters) && data.characters.length ? data.characters : base.characters;
  return {
    enabled: true,
    status: Array.isArray(data.characters) && data.characters.length ? 'ready' : base.status,
    kind: data.kind === 'vote' ? 'vote' : postType(post),
    headline: clean(data.headline, 40) || base.headline,
    imageRead: clean(data.imageRead, 240) || '',
    imageCountAnalyzed: imageCount,
    host: {
      id: 'opsbot', name: '운영봇', emoji: '🤖', role: '사회자',
      opening: clean(data.host?.opening, 220) || base.host.opening,
      summary: clean(data.host?.summary, 180) || base.host.summary,
      question: clean(data.host?.question, 160) || base.host.question,
    },
    characters: rawChars.slice(0, 4).map((item, index) => {
      const fallback = base.characters[index] || base.characters[0];
      const lines = Array.isArray(item.lines) ? item.lines.map(line => clean(line, 180)).filter(Boolean).slice(0, 3) : [];
      return {
        id: clean(item.id, 30) || fallback.id,
        name: clean(item.name, 20) || fallback.name,
        emoji: clean(item.emoji, 4) || fallback.emoji,
        role: clean(item.role, 30) || fallback.role,
        stance: clean(item.stance, 60) || fallback.stance,
        lines: lines.length ? lines : fallback.lines,
        punchline: clean(item.punchline, 160) || fallback.punchline,
      };
    }),
    bestLines: (Array.isArray(data.bestLines) ? data.bestLines : base.bestLines).map(line => clean(line, 140)).filter(Boolean).slice(0, 4),
    commentPrompt: clean(data.commentPrompt, 180) || base.commentPrompt,
    model: 'gemini-2.5-flash',
  };
}

async function savePanel(ref, panel) {
  await ref.set({ aiCharacterPanel: { ...panel, generatedAt: FieldValue.serverTimestamp() }, aiCharacterPanelUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return panel;
}

exports.generateCharacterPanel = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB', secrets: [GEMINI_API_KEY] }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const postId = clean(request.data?.postId, 120);
  const force = request.data?.force === true;
  if (!postId) throw new HttpsError('invalid-argument', 'postId가 필요합니다.');
  if (!(await isFeatureEnabled())) return { ok: false, skipped: true, reason: 'disabled' };

  const ref = db.doc(`feeds/${postId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = { id: snap.id, ...snap.data() };
  const admin = await isAdmin(uid);
  if (post.authorId !== uid && !admin) throw new HttpsError('permission-denied', '작성자만 AI 캐릭터 패널을 생성할 수 있습니다.');
  if (!force && post.aiCharacterPanel?.status === 'ready') return { ok: true, skipped: true, panel: post.aiCharacterPanel };

  const apiKey = await getAiKey();
  if (!apiKey) {
    const panel = normalizePanel(null, post, 0);
    return { ok: true, fallback: true, reason: 'no-api-key', panel: await savePanel(ref, panel) };
  }

  let parsed = null;
  let imageCount = 0;
  try {
    const imageParts = await buildImageParts(post.images || []);
    imageCount = imageParts.length;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { temperature: 0.95, maxOutputTokens: 2200 } });
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: promptFor(post) }, ...imageParts] }] });
    parsed = parseJson(result.response.text());
  } catch (error) {
    console.error('[generateCharacterPanel]', error);
  }

  const panel = normalizePanel(parsed, post, imageCount);
  return { ok: true, panel: await savePanel(ref, panel) };
});
