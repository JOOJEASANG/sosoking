'use strict';

const { randomInt } = require('crypto');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const DAILY_PRESETS = ['vote', 'drip'];
const VIRTUAL_AUTHORS = {
  vote: ['논쟁구경꾼', '선택장애온사람', '반반무많이', '한표던지고감'],
  drip: ['드립수집가', '웃참실패자', '퇴근5분전', '댓글장인연습생'],
};

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
const DEBATE_LEFT = ['rebel', 'fact', 'conspiracy', 'ajae'];
const DEBATE_RIGHT = ['jujup', 'bothsides', 'madcap', 'overreact'];
const DRIP_ORDER = ['jujup', 'madcap', 'ajae', 'overreact'];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function makeRunSeed() {
  return `${Date.now()}-${randomInt(100000, 999999)}`;
}

function pickRandom(list) {
  return list[randomInt(0, list.length)];
}

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = 1200) {
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

function normalizePreset(value) {
  const key = String(value || 'drip').trim();
  if (['vote', 'debate', 'discussion', 'ox'].includes(key)) return 'vote';
  if (['drip', 'naming', 'translation', 'translate'].includes(key)) return 'drip';
  return DAILY_PRESETS.includes(key) ? key : 'drip';
}

function pickVirtualAuthor(preset, runSeed) {
  const normalized = normalizePreset(preset);
  const names = VIRTUAL_AUTHORS[normalized] || VIRTUAL_AUTHORS.drip;
  const hash = String(runSeed || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const name = names[Math.abs(hash) % names.length];
  return { id: `virtual-${normalized}-${name}`, name };
}

async function getSettings() {
  const snap = await db.doc('site_settings/dailyAutoPost').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    enabled: data.enabled !== false,
    dailyCount: Math.max(0, Math.min(Number(data.dailyCount || 2), 2)),
  };
}

async function loadRecentTitles(limit = 20) {
  try {
    const snap = await db.collection('feeds').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(doc => clean(doc.data().title, 80)).filter(Boolean);
  } catch {
    return [];
  }
}

function fallbackContent(preset) {
  const map = {
    vote: [
      { title: '배달비 4천원이면 시킨다 VS 참는다', desc: '메뉴보다 배달비가 더 크게 느껴지는 순간입니다. 이건 행복 비용일까요, 지갑 배신일까요?', options: ['시킨다', '참는다'], tags: ['토론', '배달비'] },
      { title: '카톡 답장 빠른 사람 VS 천천히 하는 사람', desc: '여러분은 어느 쪽이 더 편한가요?', options: ['빠른 답장', '천천히 답장'], tags: ['토론', '관계'] },
      { title: '쉬는 날 외출 VS 집콕', desc: '완전히 자유로운 하루가 생기면 어느 쪽인가요?', options: ['외출', '집콕'], tags: ['토론', '휴식'] },
      { title: '아침형 인간 VS 밤형 인간', desc: '하루 효율은 어느 쪽이 더 낫다고 보나요?', options: ['아침형', '밤형'], tags: ['토론', '생활'] },
      { title: '음식 사진 먼저 찍기 VS 바로 먹기', desc: '맛있는 게 나오면 사진부터 남겨야 할까요, 따뜻할 때 바로 먹어야 할까요?', options: ['사진 먼저', '바로 먹기'], tags: ['토론', '음식'] },
    ],
    drip: [
      { title: '퇴근 5분 전 회의 이름 지어주세요', desc: '퇴근 5분 전에 “잠깐 회의 가능?” 메시지가 왔을 때의 감정을 한 줄로 살려주세요.', topic: '퇴근 5분 전 회의 이름 지어주세요', tags: ['드립', '작명', '직장인'] },
      { title: '배달 예상시간이 계속 늘어날 때 한마디', desc: '배달 예상 시간이 20분에서 40분, 다시 55분으로 늘어났을 때 나올 법한 한 줄을 적어주세요.', topic: '배달 예상시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
      { title: '월요일 아침 알람 별명 짓기', desc: '월요일 아침 알람을 사람처럼 부른다면 어떤 이름이 어울릴까요?', topic: '월요일 아침 알람에게 이름 붙이기', tags: ['드립', '월요일', '작명'] },
      { title: '냉장고가 비었을 때 나오는 대사', desc: '냉장고를 열었는데 먹을 게 없을 때 내 영혼이 할 법한 말을 적어주세요.', topic: '냉장고를 열었는데 먹을 게 없을 때 한마디', tags: ['드립', '일상'] },
      { title: '카드값 알림 번역하기', desc: '카드값 알림 문자를 더 잔인하지만 웃긴 말투로 번역해주세요.', topic: '카드값 알림을 웃긴 말투로 번역하기', tags: ['드립', '번역', '월급'] },
    ],
  };
  return pickRandom(map[normalizePreset(preset)] || map.drip);
}

const PROMPTS = {
  vote: '소소킹 글쓰기의 토론 형식에 맞는 웃긴 VS 토론 글 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 반드시 2개. title은 두 선택지가 보이는 VS 제목으로 작성.',
  drip: '소소킹 글쓰기의 드립 형식에 맞는 드립 글 1개를 JSON만 출력해. 필드: title, desc, topic, tags. 작명, 번역, 핑계, 근황, 한 줄 드립 중 하나로 답하기 좋은 소재.',
};

async function makeContent(preset, date, runSeed) {
  const normalized = normalizePreset(preset);
  let content = fallbackContent(normalized);
  let source = 'fallback';
  const apiKey = ANTHROPIC_API_KEY.value();
  if (!apiKey) return { content, source, reason: 'no-key' };
  try {
    const recentTitles = await loadRecentTitles(20);
    const prompt = `${PROMPTS[normalized] || PROMPTS.drip}\n\n중복 방지 규칙:\n- 아래 최근 제목과 같은 소재, 같은 제목, 같은 상황을 쓰지 마.\n- 매번 새로운 생활 상황과 표현을 써.\n- 랜덤 시드: ${runSeed}\n- 오늘 날짜: ${date}\n최근 제목: ${recentTitles.length ? recentTitles.join(' / ') : '없음'}`;
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.9,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
    if (parsed) { content = parsed; source = 'ai'; }
  } catch (error) {
    console.error('[daily-auto-posts] fallback', normalized, error);
  }
  return { content, source, reason: source === 'ai' ? 'ai-ok' : 'ai-fallback' };
}

function toTags(content, label) {
  const tags = Array.isArray(content.tags) ? content.tags : [];
  return [...tags, label, '소소킹']
    .map(v => clean(v, 20).replace(/^#/, ''))
    .filter(Boolean)
    .filter((tag, index, self) => self.indexOf(tag) === index)
    .slice(0, 8);
}

function character(id, extras = {}) {
  return { ...CHARACTER_META[id], ...extras };
}

function debateCharacter(id, team, target, opponent, replyTo) {
  const teamName = team === 'left' ? '왼쪽팀' : '오른쪽팀';
  const lines = {
    jujup: [`${target} 이거 그냥 지나가면 예의가 아닙니다. 선택지에서 이미 주인공 냄새가 납니다.`, `${replyTo} 말도 이해는 하는데, 이건 의심보다 박수가 먼저 나와야 합니다.`, `${teamName} 입장에서는 ${target}가 댓글창을 더 살립니다.`],
    rebel: [`저는 ${target} 쪽입니다. 다들 ${opponent}로 빨리 가려는 게 더 수상합니다.`, `처음 기준을 잘못 잡으면 계속 끌려갑니다. 저는 ${target} 쪽 뒤끝이 덜하다고 봅니다.`, `${replyTo}가 분위기를 말해도 저는 결제창과 후회를 먼저 봅니다.`],
    bothsides: [`저는 ${target} 쪽인데 말하면서도 ${opponent}가 계속 고개를 듭니다.`, `${replyTo} 말도 맞습니다. 그런데 ${target}에는 설명하기 어려운 생활의 맛이 있습니다.`, `둘 다 들으니까 더 모르겠지만 오늘은 흔들리면서 ${target}입니다.`],
    fact: [`감정 빼고 보면 ${target} 쪽 기준이 더 선명합니다.`, `${replyTo} 말처럼 분위기도 중요하지만 선택 후 손해가 덜 남는 쪽을 봐야 합니다.`, `핵심은 지금의 기분이 아니라 나중의 후회입니다.`],
    madcap: [`${target}로 가는 순간 장르가 바뀝니다. 갑자기 일상이 예고편 톤이 됩니다.`, `${replyTo}는 현실을 봤지만 저는 세계관을 봤습니다.`, `이건 평범한 VS가 아니라 현실이 선택지 버튼을 잘못 눌러 열린 포털입니다.`],
    conspiracy: [`저는 ${target} 뒤의 생활 패턴을 봤습니다. 이건 우연이 아닙니다.`, `${opponent}가 너무 그럴듯해 보이는 순간이 오히려 함정입니다.`, `${replyTo}가 세계관을 봤다면 저는 작전을 봤습니다. 이건 습관 세력 간 전쟁입니다.`],
    ajae: [`저는 ${target}에 한 표 올립니다. 표가 아니라 표정 관리입니다.`, `${opponent}도 좋지만 너무 뜨거우면 국밥도 식습니다.`, `${replyTo}가 크게 갔으니 저는 짧게 갑니다. ${target}입니다.`],
    overreact: [`이건 단순히 ${target}를 고르는 장면이 아닙니다. 주인공이 결심하는 컷입니다.`, `${replyTo} 말까지 들어오니까 이 토론은 이미 클라이맥스입니다.`, `${opponent}는 안정적인 조연이고, ${target}는 음악 깔리는 선택지입니다.`],
  };
  const punchline = {
    jujup: `${target}는 선택이 아니라 축제입니다. 지금 박수 치면서 눌러야 합니다.`,
    rebel: `저는 일단 ${target}. 반대부터 해야 토론소가 열립니다.`,
    bothsides: `제 결론은 ${target}입니다. 물론 3초 뒤에 바뀔 수 있습니다.`,
    fact: `정리하면 ${target}. 이건 기분 문제가 아니라 후회 관리입니다.`,
    madcap: `${target} 누르는 순간 현실이 오늘 업데이트를 잘못 눌렀습니다.`,
    conspiracy: `${target}는 선택지가 아닙니다. 생활 질서 회복 작전입니다.`,
    ajae: `${target}로 가야 합니다. 선택은 짧고 후회는 깁니다.`,
    overreact: `${target}. 이 장면은 엔딩 크레딧 올라갈 때 박수 나옵니다.`,
  };
  return character(id, { team, targetOption: target, replyTo, stance: `${target} 편 · ${CHARACTER_META[id].role}`, lines: lines[id], punchline: punchline[id] });
}

function buildDebateCharacters(options) {
  const left = options[0] || '왼쪽 선택지';
  const right = options[1] || '오른쪽 선택지';
  return [
    ...DEBATE_LEFT.map((id, index) => debateCharacter(id, 'left', left, right, CHARACTER_META[DEBATE_RIGHT[index]].name)),
    ...DEBATE_RIGHT.map((id, index) => debateCharacter(id, 'right', right, left, CHARACTER_META[DEBATE_LEFT[index]].name)),
  ];
}

function buildDripCharacters() {
  return DRIP_ORDER.map(id => {
    const presets = {
      jujup: { replyTo: '', stance: '소재를 크게 띄움', lines: ['이 소재는 그냥 지나가면 드립 예의가 아닙니다.', '제목부터 이미 댓글러들 입장권입니다.', '한 줄만 잘 붙이면 바로 저장감입니다.'], punchline: '이 상황은 그냥 지나가면 예의가 아닙니다.' },
      madcap: { replyTo: '주접러', stance: '세계관 확장', lines: ['이건 현실이 잠깐 서버 오류 낸 장면입니다.', '주접러가 박수 치는 사이 저는 세계관 설정집을 열었습니다.', '상황이 아니라 다음 시즌 예고편에 가깝습니다.'], punchline: '현실이 오늘 업데이트를 잘못 눌렀습니다.' },
      ajae: { replyTo: '광기러', stance: '짧은 말장난', lines: ['드립은 짧아야 제맛입니다. 길면 국밥도 식습니다.', '광기러님 세계관은 큰데 저는 한 숟갈만 얹겠습니다.', '이 소재는 웃기려고 한 게 아니라 웃기게 태어났습니다.'], punchline: '이건 드립이 아니라 드립커피처럼 천천히 내려온 웃음입니다.' },
      overreact: { replyTo: '아재봇', stance: '영화처럼 키움', lines: ['이건 그냥 상황이 아니라 3부작의 시작입니다.', '아재봇이 분위기를 얼렸고 이제 제가 배경음악을 깔겠습니다.', '지금은 웃지만 2화부터 장르가 바뀔 수 있습니다.'], punchline: '이 장면, 엔딩 크레딧 올라갈 때 박수 나옵니다.' },
    }[id];
    return character(id, { team: 'drip', targetOption: '', ...presets });
  });
}

function buildAiPanel(preset, post) {
  const isVote = preset === 'vote';
  const options = isVote ? (post.modules?.vote?.options || []).map(item => item.text).filter(Boolean).slice(0, 2) : [];
  return {
    enabled: true,
    status: 'fallback',
    kind: preset,
    headline: isVote ? '운영봇이 랜덤 4대4 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    imageCountAnalyzed: 0,
    host: {
      id: 'opsbot',
      name: '운영봇',
      emoji: '🤖',
      role: '사회자',
      opening: isVote ? `오늘의 토론 주제는 “${post.title}”입니다. 캐릭터 8명이 4대4로 나눠 붙습니다.` : `오늘의 드립 소재는 “${post.title}”입니다.`,
      summary: isVote ? `${options.join(' VS ')} 구도로 의견이 갈릴 수 있습니다.` : '짧게 받을수록 더 웃긴 소재입니다.',
      question: isVote ? '어느 쪽인지 투표하고 이유를 한 줄로 남겨주세요.' : '이 상황을 더 웃긴 한 줄로 받아쳐주세요.',
    },
    characters: isVote ? buildDebateCharacters(options) : buildDripCharacters(),
    bestLines: isVote ? ['이건 기분 문제가 아니라 후회 관리입니다.', '선택지가 아니라 생활 질서 회복 작전입니다.'] : ['현실이 오늘 업데이트를 잘못 눌렀습니다.', '이 상황은 그냥 지나가면 예의가 아닙니다.'],
    commentPrompt: isVote ? '투표하고 어느 팀 말이 더 웃겼는지도 댓글로 남겨주세요.' : '더 웃긴 이름이나 한 줄 드립을 댓글로 남겨주세요.',
    model: 'fallback',
    generatedAt: FieldValue.serverTimestamp(),
  };
}

function buildPost(preset, content, date, source, runSeed) {
  const normalized = normalizePreset(preset);
  const isVote = normalized === 'vote';
  const label = isVote ? '토론소' : '드립소';
  const title = clean(content.title || (isVote ? '오늘의 토론 주제' : '오늘의 드립 주제'), 100);
  const desc = cleanMultiline(content.desc || content.topic || title, 1200);
  const virtualAuthor = pickVirtualAuthor(normalized, runSeed);
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype: normalized,
    feedType: normalized,
    typeLabel: label,
    title,
    desc,
    tags: toTags(content, label),
    images: [],
    modules: { comments: { enabled: true } },
    deadline: { enabled: false, mode: 'none', status: 'open' },
    anonymous: false,
    anonymousMode: '',
    authorId: virtualAuthor.id,
    authorName: virtualAuthor.name,
    authorPhoto: '',
    authorEmail: '',
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    pointsScore: 0,
    isAiGenerated: true,
    aiGeneratedDate: date,
    aiSource: source,
    aiPreset: normalized,
    aiRunSeed: runSeed,
    aiVirtualAuthor: true,
    aiHostId: 'opsbot',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isVote) {
    const rawOptions = Array.isArray(content.options) ? content.options : ['왼쪽', '오른쪽'];
    const options = rawOptions.map(v => clean(typeof v === 'object' ? v.text : v, 80)).filter(Boolean).slice(0, 2);
    post.modules.vote = {
      enabled: true,
      voteMode: 'pros_cons',
      question: desc || title,
      options: (options.length >= 2 ? options : ['왼쪽', '오른쪽']).map(text => ({ text, votes: 0 })),
    };
  } else {
    post.modules.drip = { enabled: true, prompt: desc || title, maxLength: 50, responseLabel: '한 줄 드립' };
  }

  post.aiCharacterPanel = buildAiPanel(normalized, post);
  return post;
}

async function createOne(preset, date) {
  const normalized = normalizePreset(preset);
  const runSeed = makeRunSeed();
  const { content, source, reason } = await makeContent(normalized, date, runSeed);
  const post = buildPost(normalized, content, date, source, runSeed);
  const ref = db.collection('feeds').doc();
  await ref.set(post);
  return { preset: normalized, docId: ref.id, title: post.title, authorName: post.authorName, source, reason, runSeed, typeLabel: post.typeLabel };
}

async function dailyAutoPostJob() {
  const settings = await getSettings();
  if (!settings.enabled || settings.dailyCount <= 0) return { skipped: true, reason: 'disabled' };
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/daily_auto_posts_${date}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return { skipped: true, reason: 'already-created', date };

  const count = Math.min(settings.dailyCount || 2, 2);
  const daySeed = Number(date.replace(/-/g, '')) || 0;
  const presets = Array.from({ length: count }, (_, index) => DAILY_PRESETS[(daySeed + index) % DAILY_PRESETS.length]);
  const results = [];
  for (const preset of presets) {
    results.push(await createOne(preset, date));
  }
  await markerRef.set({ createdAt: FieldValue.serverTimestamp(), date, count: results.length, results });
  return { ok: true, date, count: results.length, results };
}

exports.createDailyAutoPosts = onSchedule({
  region: REGION,
  schedule: 'every day 09:00',
  timeZone: 'Asia/Seoul',
  timeoutSeconds: 300,
  memory: '512MiB',
  secrets: [ANTHROPIC_API_KEY],
}, async () => {
  await dailyAutoPostJob();
});

exports._private = { dailyAutoPostJob, buildPost, makeContent };
