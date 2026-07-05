'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const CHARACTER_GUIDE = [
  '- 주접러 😍: 과한 칭찬과 호들갑으로 분위기를 띄운다.',
  '- 반항아 😤: 일단 삐딱하게 보고 반대쪽 허점을 찾는다.',
  '- 갈팡러 🤔: 양쪽을 다 이해해서 흔들린다.',
  '- 팩폭러 🧊: 감정 없이 핵심을 짧고 차갑게 찌른다.',
  '- 광기러 🤪: 말도 안 되는 상상과 비유로 튄다.',
  '- 음모론자 👁️: 사소한 상황을 거대한 사건처럼 해석한다.',
  '- 아재봇 🧓: 썰렁한 말장난을 짧게 던진다.',
  '- 과몰입러 🎭: 작은 일을 영화, 뉴스, 대하드라마처럼 키운다.',
].join('\n');

const CHARACTER_META = {
  jujup: { id: 'jujup', name: '주접러', emoji: '😍', role: '호들갑 칭찬러' },
  rebel: { id: 'rebel', name: '반항아', emoji: '😤', role: '삐딱한 반대충' },
  bothsides: { id: 'bothsides', name: '갈팡러', emoji: '🤔', role: '양쪽 다 맞는 중립러' },
  fact: { id: 'fact', name: '팩폭러', emoji: '🧊', role: '핵심 요약러' },
  madcap: { id: 'madcap', name: '광기러', emoji: '🤪', role: '이상한 상상러' },
  conspiracy: { id: 'conspiracy', name: '음모론자', emoji: '👁️', role: '과몰입 추리러' },
  ajae: { id: 'ajae', name: '아재봇', emoji: '🧓', role: '썰렁 개그 담당' },
  overreact: { id: 'overreact', name: '과몰입러', emoji: '🎭', role: '대서사 담당' },
};

const CHARACTER_IDS = ['jujup', 'rebel', 'bothsides', 'fact', 'madcap', 'conspiracy', 'ajae', 'overreact'];
const DRIP_ORDER = ['jujup', 'madcap', 'ajae', 'overreact'];

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

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value || 'sosoking');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle(list, seed) {
  const arr = list.slice();
  let state = hashSeed(seed) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function teamDraftForPost(post, options = voteOptions(post)) {
  const seed = [post.id, post.title, post.desc || post.body, options.join('|')].map(v => clean(v, 200)).join('::');
  const shuffled = seededShuffle(CHARACTER_IDS, seed);
  return { left: shuffled.slice(0, 4), right: shuffled.slice(4, 8) };
}

function namesFor(ids) {
  return ids.map(id => CHARACTER_META[id]?.name || id).join(', ');
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
  const teams = teamDraftForPost(post, options);
  const leftOption = options[0] || '왼쪽 선택지';
  const rightOption = options[1] || '오른쪽 선택지';
  const title = clean(post.title, 160);
  const desc = clean(post.desc || post.body || '', 1800);
  const hasImages = Array.isArray(post.images) && post.images.length > 0;
  const modeGuide = type === 'vote'
    ? `토론소 글이다. 선택지: ${options.length ? options.join(' VS ') : '사용자 선택지 없음'}\n캐릭터 8명 전원이 일반 유저처럼 댓글 토론에 참여한다.\n이 글의 팀 배정은 글 기준 랜덤 배정이다. 반드시 아래 배정을 지켜라.\n왼쪽 팀은 ${leftOption} 편: ${namesFor(teams.left)}\n오른쪽 팀은 ${rightOption} 편: ${namesFor(teams.right)}\n각 캐릭터는 자기 팀 논리, 상대팀 반박, 제목/본문/이미지 디테일, 웃긴 한 줄을 모두 넣는다. 서로 말도 받아쳐야 한다.`
    : '드립소 글이다. 가장 잘 맞는 캐릭터 4명이 일반 댓글러처럼 참여한다. 제목, 본문, 이미지에서 구체적인 포인트를 뽑아 작명, 번역, 근황뉴스, 한 줄 드립 중 맞는 방식으로 받아친다.';

  return `너는 소소킹의 AI 캐릭터 엔진이다.
목표: 제목, 내용, 첨부 이미지를 읽고 사람들이 댓글을 달고 싶게 만드는 토론/드립 결과를 만든다.

규칙:
- 운영봇은 사회자다. 상황을 정리하고 유저 참여를 유도한다.
- 캐릭터는 닉네임형 커뮤니티 유저처럼 자연스럽게 말한다.
- 빈말 금지. 제목과 본문의 구체적인 단어를 반드시 사용한다.
- 이미지가 있으면 물체, 표정, 분위기, 구도를 반영한다.
- 비슷한 말 반복 금지. 캐릭터마다 관점과 말투가 달라야 한다.
- 각 캐릭터는 lines 3개와 punchline 1개를 쓴다.
- 토론소는 8명 전원, 글마다 랜덤 배정된 4대4 구도, 서로 반박/맞받아치기 필수다.
- 드립소는 4명이 깊게 참여한다.

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
  "host": { "opening": "운영봇 사회자 멘트", "summary": "상황 요약", "question": "댓글/투표 유도 질문" },
  "characters": [
    {
      "id": "jujup/rebel/bothsides/fact/madcap/conspiracy/ajae/overreact 중 하나",
      "name": "캐릭터 이름",
      "emoji": "이모지",
      "role": "역할",
      "team": "토론이면 left 또는 right, 드립이면 drip",
      "targetOption": "토론이면 자기 팀 선택지, 드립이면 빈 문자열",
      "replyTo": "받아치는 상대 캐릭터 이름 또는 빈 문자열",
      "stance": "입장 또는 드립 스타일",
      "lines": ["구체적인 말 1", "상대 반박 또는 이미지/본문 디테일 2", "댓글러 같은 반응 3"],
      "punchline": "가장 웃긴 한 줄"
    }
  ],
  "bestLines": ["유저가 따라 치고 싶을 한 줄 2~4개"],
  "commentPrompt": "댓글 유도 문구"
}`;
}

function makeCharacter(id, extras = {}) {
  return { ...CHARACTER_META[id], ...extras };
}

function fallbackLinesFor(id, team, target, opponent, replyTo) {
  const meta = CHARACTER_META[id] || CHARACTER_META.jujup;
  const side = team === 'left' ? '왼쪽팀' : '오른쪽팀';
  const base = {
    jujup: [`${target} 쪽 이거 그냥 지나가면 예의가 아닙니다. 선택지에서 이미 주인공 냄새가 납니다.`, `${replyTo} 말도 이해는 하는데, 이건 의심보다 박수가 먼저 나와야 합니다.`, `${side} 입장에서 보면 ${target}는 댓글창 살리는 선택입니다.`],
    rebel: [`저는 ${target} 쪽입니다. 남들이 반대편을 편하다고 할수록 더 수상합니다.`, `처음 기준을 잘못 잡으면 계속 끌려갑니다. ${opponent}는 그 함정이 보입니다.`, `${replyTo}가 분위기를 말해도 저는 뒤끝과 후회를 먼저 봅니다.`],
    bothsides: [`저는 ${target} 쪽인데 말하면서도 ${opponent}가 계속 고개를 듭니다.`, `${replyTo} 말도 맞습니다. 그런데 ${target}에는 설명하기 어려운 생활의 맛이 있습니다.`, `둘 다 들으니까 더 모르겠지만 오늘은 흔들리면서 ${target}입니다.`],
    fact: [`감정 빼고 보면 ${target} 쪽 기준이 더 선명합니다.`, `${replyTo} 말처럼 재미도 중요하지만, 선택 후 손해가 덜 남는 쪽을 봐야 합니다.`, `핵심은 지금의 기분이 아니라 나중의 후회입니다.`],
    madcap: [`${target}로 가는 순간 장르가 바뀝니다. 갑자기 예고편 톤이 됩니다.`, `${replyTo}는 현실을 봤지만 저는 세계관을 봤습니다.`, `이건 평범한 VS가 아니라 현실이 선택지 버튼을 잘못 눌러 열린 포털입니다.`],
    conspiracy: [`저는 ${target} 뒤의 생활 패턴을 봤습니다. 이건 우연이 아닙니다.`, `${opponent}가 너무 그럴듯해 보이는 순간이 오히려 함정입니다.`, `${replyTo}가 세계관을 봤다면 저는 작전을 봤습니다. 이건 습관 세력 간 전쟁입니다.`],
    ajae: [`저는 ${target}에 한 표 올립니다. 표가 아니라 표정 관리입니다.`, `${opponent}도 좋지만 너무 뜨거우면 국밥도 식습니다.`, `${replyTo}가 크게 갔으니 저는 짧게 갑니다. ${target}입니다.`],
    overreact: [`이건 단순히 ${target}를 고르는 장면이 아닙니다. 주인공이 결심하는 컷입니다.`, `${replyTo} 말까지 들어오니까 이 토론은 이미 클라이맥스입니다.`, `${opponent}는 안정적인 조연이고, ${target}는 음악 깔리는 선택지입니다.`],
  };
  const punch = {
    jujup: `${target}는 선택이 아니라 축제입니다. 지금 박수 치면서 눌러야 합니다.`,
    rebel: `저는 일단 ${target}. 반대부터 해야 토론소가 열립니다.`,
    bothsides: `제 결론은 ${target}입니다. 물론 3초 뒤에 바뀔 수 있습니다.`,
    fact: `정리하면 ${target}. 이건 기분 문제가 아니라 후회 관리입니다.`,
    madcap: `${target} 누르는 순간 현실이 오늘 업데이트를 잘못 눌렀습니다.`,
    conspiracy: `${target}는 선택지가 아닙니다. 생활 질서 회복 작전입니다.`,
    ajae: `${target}로 가야 합니다. 선택은 짧고 후회는 깁니다.`,
    overreact: `${target}. 이 장면은 엔딩 크레딧 올라갈 때 박수 나옵니다.`,
  };
  return { lines: base[id] || base.jujup, punchline: punch[id] || punch.jujup, role: meta.role };
}

function fallbackCharacters(kind, options = [], teams = null) {
  const left = options[0] || '왼쪽 선택지';
  const right = options[1] || '오른쪽 선택지';
  if (kind === 'vote') {
    const draft = teams || { left: CHARACTER_IDS.slice(0, 4), right: CHARACTER_IDS.slice(4, 8) };
    const build = (id, team, index) => {
      const target = team === 'left' ? left : right;
      const opponent = team === 'left' ? right : left;
      const otherTeam = team === 'left' ? draft.right : draft.left;
      const replyMeta = CHARACTER_META[otherTeam[index % otherTeam.length]] || CHARACTER_META.jujup;
      const tone = fallbackLinesFor(id, team, target, opponent, replyMeta.name);
      return makeCharacter(id, {
        team,
        targetOption: target,
        replyTo: replyMeta.name,
        stance: `${target} 편 · ${tone.role}`,
        lines: tone.lines,
        punchline: tone.punchline,
      });
    };
    return [
      ...draft.left.map((id, index) => build(id, 'left', index)),
      ...draft.right.map((id, index) => build(id, 'right', index)),
    ];
  }
  return [
    makeCharacter('jujup', { team: 'drip', targetOption: '', replyTo: '', stance: '소재를 크게 띄움', lines: ['이 정도 소재면 그냥 지나가면 안 됩니다.', '제목에 이미 웃음 포인트가 있고, 본문은 댓글러 입장권입니다.', '평범한 척하지만 한 줄만 잘 붙이면 바로 저장감입니다.'], punchline: '이 상황은 그냥 지나가면 예의가 아닙니다.' }),
    makeCharacter('madcap', { team: 'drip', targetOption: '', replyTo: '주접러', stance: '이상한 상상', lines: ['이건 현실이 잠깐 서버 오류 낸 장면입니다.', '주접러가 박수 치는 사이 저는 세계관 설정집을 열었습니다.', '상황이 아니라 다음 시즌 예고편에 가까운 소재입니다.'], punchline: '현실이 오늘 업데이트를 잘못 눌렀습니다.' }),
    makeCharacter('ajae', { team: 'drip', targetOption: '', replyTo: '광기러', stance: '짧은 말장난', lines: ['드립은 짧아야 제맛입니다. 길면 국밥도 식습니다.', '광기러님 세계관은 큰데, 저는 한 숟갈만 얹겠습니다.', '이 소재는 웃기려고 한 게 아니라 웃기게 태어났습니다.'], punchline: '이건 드립이 아니라 드립커피처럼 천천히 내려온 웃음입니다.' }),
    makeCharacter('overreact', { team: 'drip', targetOption: '', replyTo: '아재봇', stance: '영화처럼 키움', lines: ['이건 그냥 상황이 아니라 3부작의 시작입니다.', '아재봇이 분위기를 얼렸고, 이제 제가 배경음악을 깔겠습니다.', '지금은 웃지만 2화부터 장르가 바뀔 수 있습니다.'], punchline: '이 장면, 엔딩 크레딧 올라갈 때 박수 나옵니다.' }),
  ];
}

function fallbackPanel(post) {
  const kind = postType(post);
  const title = clean(post.title, 80) || '이 상황';
  const options = voteOptions(post);
  const teams = kind === 'vote' ? teamDraftForPost(post, options) : null;
  return {
    enabled: true,
    status: 'fallback',
    kind,
    headline: kind === 'vote' ? '운영봇이 랜덤 4대4 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    imageCountAnalyzed: 0,
    host: {
      id: 'opsbot', name: '운영봇', emoji: '🤖', role: '사회자',
      opening: kind === 'vote' ? `토론소 열었습니다. 오늘 안건은 “${title}”입니다. 이 글에서는 캐릭터 8명이 랜덤 4대4로 나눠 붙습니다.` : `드립소 열었습니다. 오늘 소재는 “${title}”입니다.`,
      summary: kind === 'vote' && options.length ? `${options.join(' VS ')} 구도로 의견이 갈릴 수 있습니다.` : '짧고 강한 한 줄이 잘 먹히는 소재입니다.',
      question: kind === 'vote' ? '어느 팀 말이 더 설득되는지 투표하고 이유를 남겨주세요.' : '이 상황, 누가 제일 웃기게 받아칠까요?',
    },
    characters: fallbackCharacters(kind, options, teams),
    bestLines: kind === 'vote'
      ? ['제 결론은 명확합니다. 저는 결론을 포기하겠습니다.', '이건 기분 문제가 아니라 후회 관리입니다.', '선택지가 아니라 생활 질서 회복 작전입니다.']
      : ['현실이 오늘 업데이트를 잘못 눌렀습니다.', '이 상황은 그냥 지나가면 예의가 아닙니다.'],
    commentPrompt: kind === 'vote' ? '투표하고 어느 팀 말이 더 웃겼는지도 댓글로 남겨주세요.' : '더 웃긴 한 줄로 받아쳐주세요.',
    model: 'fallback',
  };
}

function normalizePanel(parsed, post, imageCount) {
  const base = fallbackPanel(post);
  const kind = postType(post);
  const options = voteOptions(post);
  const teams = kind === 'vote' ? teamDraftForPost(post, options) : null;
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const rawChars = Array.isArray(data.characters) && data.characters.length ? data.characters : base.characters;
  const expectedOrder = kind === 'vote' ? [...teams.left, ...teams.right] : DRIP_ORDER;
  const orderedRawChars = kind === 'vote'
    ? expectedOrder.map(id => rawChars.find(item => clean(item.id, 30) === id)).filter(Boolean)
    : rawChars;
  const sourceChars = orderedRawChars.length >= expectedOrder.length ? orderedRawChars : rawChars;
  const charLimit = kind === 'vote' ? 8 : 4;
  return {
    enabled: true,
    status: Array.isArray(data.characters) && data.characters.length ? 'ready' : base.status,
    kind: data.kind === 'vote' ? 'vote' : kind,
    headline: clean(data.headline, 40) || base.headline,
    imageRead: clean(data.imageRead, 240) || '',
    imageCountAnalyzed: imageCount,
    host: {
      id: 'opsbot', name: '운영봇', emoji: '🤖', role: '사회자',
      opening: clean(data.host?.opening, 220) || base.host.opening,
      summary: clean(data.host?.summary, 180) || base.host.summary,
      question: clean(data.host?.question, 160) || base.host.question,
    },
    characters: sourceChars.slice(0, charLimit).map((item, index) => {
      const expectedId = expectedOrder[index] || DRIP_ORDER[index] || DRIP_ORDER[0];
      const fallback = base.characters.find(ch => ch.id === expectedId) || base.characters[index] || base.characters[0];
      const id = clean(item.id, 30) || expectedId || fallback.id;
      const meta = CHARACTER_META[id] || fallback;
      const defaultTeam = kind === 'vote' ? (teams.left.includes(id) ? 'left' : 'right') : 'drip';
      const defaultTarget = kind === 'vote' ? (defaultTeam === 'left' ? options[0] || '' : options[1] || '') : '';
      const lines = Array.isArray(item.lines) ? item.lines.map(line => clean(line, 220)).filter(Boolean).slice(0, 4) : [];
      return {
        id: id || meta.id,
        name: clean(item.name, 20) || meta.name,
        emoji: clean(item.emoji, 4) || meta.emoji,
        role: clean(item.role, 30) || meta.role,
        team: clean(item.team, 12) || fallback.team || defaultTeam,
        targetOption: clean(item.targetOption, 80) || fallback.targetOption || defaultTarget,
        replyTo: clean(item.replyTo, 20) || fallback.replyTo || '',
        stance: clean(item.stance, 80) || fallback.stance,
        lines: lines.length ? lines : fallback.lines,
        punchline: clean(item.punchline, 180) || fallback.punchline,
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { temperature: 1, maxOutputTokens: 4200 } });
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: promptFor(post) }, ...imageParts] }] });
    parsed = parseJson(result.response.text());
  } catch (error) {
    console.error('[generateCharacterPanel]', error);
  }

  const panel = normalizePanel(parsed, post, imageCount);
  return { ok: true, panel: await savePanel(ref, panel) };
});
