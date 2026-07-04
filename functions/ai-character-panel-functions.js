'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

function clean(value, max = 1000) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
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
  } catch {
    return true;
  }
}

async function isAdmin(uid) {
  if (!uid) return false;
  try {
    const snap = await db.doc(`admins/${uid}`).get();
    return snap.exists;
  } catch {
    return false;
  }
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
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
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
    ? `토론소 글이다. 선택지: ${options.length ? options.join(' VS ') : '사용자 선택지 없음'}\n운영봇은 사회자로 쟁점을 선명하게 정리한다. 캐릭터들은 양쪽 논리를 재밌게 정리하고, 왜 갈릴 만한지 보여줘야 한다.`
    : '드립소 글이다. 운영봇은 사회자로 상황을 요약하고, 캐릭터들은 작명, 이상한 번역, 말투 변환, 근황뉴스, 한 줄 드립 중 가장 어울리는 방식으로 받아친다.';

  return `너는 소소킹의 핵심 AI 캐릭터 엔진이다.
목표: 사용자가 올린 제목, 내용, 첨부 이미지까지 모두 파악해서 사람들이 댓글을 달고 싶게 만드는 고품질 토론/드립 결과를 만든다.

절대 규칙:
- 운영봇은 드립러가 아니라 사회자다. 항상 판을 열고, 상황을 정리하고, 유저 참여를 유도한다.
- 뻔한 말, 안전하지만 재미없는 말, 일반적인 상담 멘트 금지.
- 제목과 본문에서 구체적인 단어를 반드시 집어서 활용한다.
- 이미지가 있으면 이미지 속 분위기, 물체, 표정, 상황, 구도에서 웃긴 포인트를 찾아 반영한다.
- 이미지가 있어도 보이지 않는 척하지 말고, 보이는 범위 안에서만 묘사한다.
- 공격, 혐오, 성희롱, 신상추정, 특정인 조롱은 금지한다. 대상은 사람 자체가 아니라 상황과 말투여야 한다.
- 캐릭터는 서로 다른 관점을 가져야 한다. 셋 다 비슷한 말 금지.
- 각 캐릭터는 한 방이 있어야 한다. 최소 한 줄은 사용자가 댓글로 따라 치고 싶을 정도여야 한다.
- 한국 인터넷 유머 톤은 가능하지만, 욕설에 의존하지 말고 표현력으로 웃겨라.

캐릭터 역할:
- 운영봇 🤖: 사회자. 요약, 쟁점 정리, 룰 안내, 댓글 유도만 한다. 직접 우승 드립을 치지 않는다.
- 민수 😂: 드립왕. 짧고 커뮤식으로 웃긴 한 줄을 만든다.
- 지은 🧠: 똑똑이. 상황을 분석하고 마지막에 날카로운 웃긴 표현을 붙인다.
- 준호 🗳️: 토론러. 양쪽 논리를 분리하고 VS 구도를 재밌게 만든다.
- 철구 😈: 살짝 매운맛. 선은 넘지 않고 상황의 허점을 찌른다.

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
    "id": "opsbot",
    "name": "운영봇",
    "emoji": "🤖",
    "role": "사회자",
    "opening": "사회자처럼 판을 여는 문장 1~2문장",
    "summary": "상황 요약 1문장",
    "question": "유저가 댓글/투표로 참여하고 싶게 만드는 질문 1문장"
  },
  "characters": [
    {
      "id": "minsu 또는 jieun 또는 junho 또는 cheolgu",
      "name": "캐릭터명",
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

function fallbackPanel(post) {
  const kind = postType(post);
  const title = clean(post.title, 80) || '이 상황';
  const options = voteOptions(post);
  return {
    enabled: true,
    status: 'fallback',
    kind,
    headline: kind === 'vote' ? 'AI 토론소 개장' : 'AI 드립소 개장',
    imageRead: '',
    host: {
      id: 'opsbot',
      name: '운영봇',
      emoji: '🤖',
      role: '사회자',
      opening: kind === 'vote'
        ? `토론소 열었습니다. 오늘 안건은 “${title}”입니다.`
        : `드립소 열었습니다. 오늘 소재는 “${title}”입니다.`,
      summary: kind === 'vote' && options.length ? `${options.join(' VS ')} 구도로 의견이 갈릴 수 있습니다.` : '짧고 강한 한 줄이 잘 먹히는 소재입니다.',
      question: kind === 'vote' ? '여러분은 어느 쪽입니까?' : '이 상황, 한 줄로 어떻게 살릴까요?',
    },
    characters: kind === 'vote' ? [
      { id: 'junho', name: '준호', emoji: '🗳️', role: '토론러', stance: '쟁점 정리', lines: ['이건 선택지보다 기준이 더 중요합니다.', '사람마다 참는 선이 달라서 갈릴 수 있습니다.'], punchline: '오늘도 평화로운 줄 알았는데 VS가 열렸습니다.' },
      { id: 'jieun', name: '지은', emoji: '🧠', role: '똑똑이', stance: '분석', lines: ['핵심은 감정이 아니라 반복 여부입니다.', '한 번이면 해프닝, 반복이면 패턴입니다.'], punchline: '이건 의견이 아니라 생활 데이터 싸움입니다.' },
      { id: 'cheolgu', name: '철구', emoji: '😈', role: '매운맛', stance: '허점 찾기', lines: ['좋게 보면 취향 차이, 나쁘게 보면 그냥 고집입니다.', '근데 이걸로 갈리는 게 제일 웃깁니다.'], punchline: '사소한데 이상하게 자존심 걸리는 안건입니다.' },
    ] : [
      { id: 'minsu', name: '민수', emoji: '😂', role: '드립왕', stance: '커뮤식 한 줄', lines: ['이건 설명보다 표정으로 이미 끝난 상황입니다.', '한 줄로 살리면 더 웃길 소재입니다.'], punchline: '이 상황 이름은 오늘부로 “소소한 대참사”입니다.' },
      { id: 'cheolgu', name: '철구', emoji: '😈', role: '매운맛', stance: '허점 찌르기', lines: ['웃긴 건 본인은 진지했을 가능성이 높다는 점입니다.', '그래서 더 드립감입니다.'], punchline: '진심과 대참사는 종이 한 장 차이입니다.' },
      { id: 'jieun', name: '지은', emoji: '🧠', role: '똑똑이', stance: '상황 분석', lines: ['소재의 웃음 포인트는 기대와 현실의 차이입니다.', '댓글은 짧게 갈수록 강합니다.'], punchline: '논리적으로 봐도 이건 드립으로 처리하는 게 맞습니다.' },
    ],
    bestLines: kind === 'vote' ? ['이건 사소한데 은근히 갈리는 안건입니다.', '오늘도 평화로운 척하던 토론소가 열렸습니다.'] : ['진심과 대참사는 종이 한 장 차이입니다.', '이 상황 이름은 소소한 대참사입니다.'],
    commentPrompt: kind === 'vote' ? '당신은 어느 쪽인지 투표하고 한 줄 이유를 남겨주세요.' : '이 소재를 더 웃긴 한 줄로 받아쳐주세요.',
  };
}

function normalizePanel(parsed, post, imageCount) {
  const base = fallbackPanel(post);
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  return {
    enabled: true,
    status: chars.length ? 'ready' : base.status,
    kind: data.kind === 'vote' ? 'vote' : postType(post),
    headline: clean(data.headline, 40) || base.headline,
    imageRead: clean(data.imageRead, 240) || '',
    imageCountAnalyzed: imageCount,
    host: {
      id: 'opsbot',
      name: '운영봇',
      emoji: '🤖',
      role: '사회자',
      opening: clean(data.host?.opening, 220) || base.host.opening,
      summary: clean(data.host?.summary, 180) || base.host.summary,
      question: clean(data.host?.question, 160) || base.host.question,
    },
    characters: (chars.length ? chars : base.characters).slice(0, 4).map((item, index) => {
      const fallback = base.characters[index] || base.characters[0];
      const lines = Array.isArray(item.lines) ? item.lines : [];
      return {
        id: clean(item.id, 30) || fallback.id,
        name: clean(item.name, 20) || fallback.name,
        emoji: clean(item.emoji, 4) || fallback.emoji,
        role: clean(item.role, 30) || fallback.role,
        stance: clean(item.stance, 60) || fallback.stance,
        lines: lines.map(line => clean(line, 180)).filter(Boolean).slice(0, 3).length ? lines.map(line => clean(line, 180)).filter(Boolean).slice(0, 3) : fallback.lines,
        punchline: clean(item.punchline, 160) || fallback.punchline,
      };
    }),
    bestLines: (Array.isArray(data.bestLines) ? data.bestLines : base.bestLines).map(line => clean(line, 140)).filter(Boolean).slice(0, 4),
    commentPrompt: clean(data.commentPrompt, 180) || base.commentPrompt,
    model: 'gemini-2.5-flash',
    generatedAt: FieldValue.serverTimestamp(),
  };
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
    await ref.set({ aiCharacterPanel: panel, aiCharacterPanelUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, fallback: true, reason: 'no-api-key', panel };
  }

  let parsed = null;
  let imageCount = 0;
  try {
    const imageParts = await buildImageParts(post.images || []);
    imageCount = imageParts.length;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.95, maxOutputTokens: 2200 },
    });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptFor(post) }, ...imageParts] }],
    });
    parsed = parseJson(result.response.text());
  } catch (error) {
    console.error('[generateCharacterPanel]', error);
  }

  const panel = normalizePanel(parsed, post, imageCount);
  await ref.set({ aiCharacterPanel: panel, aiCharacterPanelUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, panel };
});
