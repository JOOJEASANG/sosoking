import { initAuth, auth, db, functions } from '/js/firebase.js?v=20260729-auth-session-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const MODE_META = Object.freeze({
  blank: {
    label: '빈칸채우기', icon: '🧩', short: '문장은 준비됐습니다. 마지막 한 방만 넣으세요.',
    example: '회의가 길어지는 이유는 ______ 때문이다.',
    titlePlaceholder: '예: 회의가 길어지는 진짜 이유',
    promptPlaceholder: '예: 회의가 길어지는 이유는 ______ 때문이다.'
  },
  naming: {
    label: '이름붙이기', icon: '🏷️', short: '별명·필살기·제품명·영화 제목을 붙입니다.',
    example: '퇴근 직전에 일을 주는 기술의 이름은?',
    titlePlaceholder: '예: 부장님의 퇴근 방해 기술',
    promptPlaceholder: '예: 퇴근 직전에 일을 주는 기술의 이름을 지어주세요.'
  },
  comeback: {
    label: '받아치기', icon: '↩️', short: '상대의 한마디에 짧고 강하게 답합니다.',
    example: '“이거 금방 끝나.” 가장 적절한 대답은?',
    titlePlaceholder: '예: 금방 끝난다는 말에 받아치기',
    promptPlaceholder: '예: 상대가 “이거 금방 끝나”라고 말했다. 가장 웃긴 답은?'
  },
  wrong: {
    label: '오답제출', icon: '❌', short: '정답 대신 가장 웃긴 오답을 제출합니다.',
    example: '회사에서 가장 중요한 자원은?',
    titlePlaceholder: '예: 회사의 가장 중요한 자원',
    promptPlaceholder: '예: 회사에서 가장 중요한 자원은 무엇일까요? 정답 말고 오답만.'
  },
  headline: {
    label: '뉴스제목', icon: '📰', short: '평범한 사건을 속보와 기사 제목으로 만듭니다.',
    example: '냉장고 케이크 실종 사건을 속보로 쓴다면?',
    titlePlaceholder: '예: 냉장고 케이크 실종 속보',
    promptPlaceholder: '예: 가족이 냉장고 케이크를 다 먹은 상황의 뉴스 제목을 지어주세요.'
  },
  excuse: {
    label: '변명대회', icon: '🥸', short: '황당하지만 순간 납득되는 변명을 만듭니다.',
    example: '약속에 한 시간 늦은 이유는?',
    titlePlaceholder: '예: 지각 한 시간 변명대회',
    promptPlaceholder: '예: 약속에 한 시간 늦었습니다. 가장 황당하지만 그럴듯한 변명은?'
  },
  manual: {
    label: '사용설명서', icon: '📘', short: '사람과 상황을 제품 설명서처럼 표현합니다.',
    example: '부장님 사용 시 주의사항은?',
    titlePlaceholder: '예: 부장님 사용설명서',
    promptPlaceholder: '예: 부장님 사용 시 주의사항을 한 줄로 작성해주세요.'
  }
});

const MODE_ORDER = Object.keys(MODE_META);
const MODE_MARKER = /^\[\[dripso-mode:([a-z-]+)\]\]\s*/i;
const GAME_VERSION = 2;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 700 * 1024;
const MAX_IMAGE_EDGE = 1280;

const createBattle = httpsCallable(functions, 'createDripsoBattle');
const submitBattleEntry = httpsCallable(functions, 'submitDripsoBattleEntry');
const getBattleView = httpsCallable(functions, 'getDripsoBattleView');
const getBattleMatchup = httpsCallable(functions, 'getDripsoBattleMatchup');
const voteBattleMatchup = httpsCallable(functions, 'voteDripsoBattleMatchup');
const addLegacyComment = httpsCallable(functions, 'addDripsoComment');
const toggleLegacyLike = httpsCallable(functions, 'toggleDripsoCommentLike');

const app = document.getElementById('dripso-app');
const nav = document.querySelector('.dripso-bottom-nav');
const topicDialog = document.getElementById('topic-dialog');
const topicForm = document.getElementById('topic-form');
const battleMode = document.getElementById('battle-mode');
const entryDuration = document.getElementById('entry-duration');
const votingDuration = document.getElementById('voting-duration');
const topicTitle = document.getElementById('topic-title');
const topicPrompt = document.getElementById('topic-prompt');
const topicImage = document.getElementById('topic-image');
const topicImagePreview = document.getElementById('topic-image-preview');
const topicImagePreviewImg = document.getElementById('topic-image-preview-img');
const topicImageStatus = document.getElementById('topic-image-status');
const removeTopicImageButton = document.getElementById('remove-topic-image');
const topicSubmit = document.getElementById('topic-submit');
const openTopicDialogButton = document.getElementById('open-topic-dialog');
const closeTopicDialogButton = document.getElementById('close-topic-dialog');
const accountLink = document.getElementById('account-link');
const toast = document.getElementById('toast');

let topicsCache = null;
let toastTimer = 0;
let countdownTimer = 0;
let routeVersion = 0;
let profileNickname = '';
let selectedImageDataUrl = '';
let imageSelectionVersion = 0;
let imageProcessing = false;
let topicSubmitting = false;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const millis = timestampMs(value);
  if (!millis) return '방금 전';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(millis));
}

function formatDeadline(millis) {
  if (!millis) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(millis));
}

function formatRemaining(millis) {
  const remaining = Math.max(0, millis - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  if (minutes > 0) return `${minutes}분`;
  const seconds = Math.ceil(remaining / 1000);
  return seconds > 0 ? `${seconds}초` : '마감';
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = String(message || '');
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2400);
}

function errorMessage(error, fallback) {
  const raw = String(error?.message || '');
  return raw.replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function isAccountUser() {
  return Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
}

function currentRoute() {
  const value = (location.hash || '#/').replace(/^#\/?/, '');
  const [name = '', id = ''] = value.split('/');
  if (name === 'topic' && id) {
    try { return { name: 'topic', id: decodeURIComponent(id) }; }
    catch { return { name: 'home' }; }
  }
  if (name === 'mode' && MODE_META[id]) return { name: 'mode', mode: id };
  if (['browse', 'popular', 'hall', 'create'].includes(name)) return { name };
  return { name: 'home' };
}

function setActiveNav(name) {
  const active = name === 'mode' ? 'browse' : name;
  nav.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === active);
  });
}

function renderLoading() {
  app.replaceChildren(element('section', 'loading-card', '드립 배틀을 불러오는 중입니다.'));
}

function renderError(message) {
  app.replaceChildren(element('section', 'error-card', message));
}

function parsedTopic(topic) {
  const rawPrompt = String(topic?.prompt || '');
  const match = rawPrompt.match(MODE_MARKER);
  let mode = MODE_META[topic?.mode] ? topic.mode : '';
  if (!mode && match && MODE_META[match[1]]) mode = match[1];
  if (!mode && topic?.type === 'naming') mode = 'naming';
  if (!mode && topic?.type === 'situation') mode = 'comeback';
  if (!mode) return null;
  return {
    ...topic,
    mode,
    gameVersion: Number(topic.gameVersion) || 1,
    displayPrompt: rawPrompt.replace(MODE_MARKER, '').trim()
  };
}

function battlePhase(topic) {
  if (Number(topic.gameVersion) !== GAME_VERSION) return 'legacy';
  const entryDeadlineMs = timestampMs(topic.entryDeadline);
  const votingDeadlineMs = timestampMs(topic.votingDeadline);
  if (!entryDeadlineMs || !votingDeadlineMs) return 'legacy';
  if (Date.now() < entryDeadlineMs) return 'recruiting';
  if (Date.now() < votingDeadlineMs) return 'voting';
  return 'closed';
}

function phaseLabel(topic) {
  const phase = battlePhase(topic);
  if (phase === 'recruiting') return `출전중 · ${formatRemaining(timestampMs(topic.entryDeadline))}`;
  if (phase === 'voting') return `심사중 · ${formatRemaining(timestampMs(topic.votingDeadline))}`;
  if (phase === 'closed') return '경기 종료';
  return '자유 반응';
}

async function loadTopics(force = false) {
  if (topicsCache && !force) return topicsCache;
  const snapshot = await getDocs(query(
    collection(db, 'dripso_topics'),
    where('status', '==', 'visible'),
    limit(200)
  ));
  topicsCache = snapshot.docs
    .map(item => parsedTopic({ id: item.id, ...item.data() }))
    .filter(Boolean);
  return topicsCache;
}

function sortedLatest(items) {
  return [...items].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
}

function popularityScore(topic) {
  if (Number(topic.gameVersion) === GAME_VERSION) {
    return Math.max(0, Number(topic.pairVoteCount) || 0) * 10
      + Math.max(0, Number(topic.commentCount) || 0) * 3
      + Math.max(0, Number(topic.topBattleScore) || 0);
  }
  return Math.max(0, Number(topic.topLikeCount) || 0) * 10
    + Math.max(0, Number(topic.commentCount) || 0);
}

function sortedPopular(items) {
  return [...items].sort((a, b) =>
    popularityScore(b) - popularityScore(a)
    || timestampMs(b.updatedAt) - timestampMs(a.updatedAt)
  );
}

function safeTopicImageUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'firebasestorage.googleapis.com'
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

function topicImageElement(topic, className) {
  const imageUrl = safeTopicImageUrl(topic.imageUrl);
  if (!imageUrl) return null;
  const image = element('img', className);
  image.src = imageUrl;
  image.alt = `${String(topic.title || '드립 배틀')} 첨부 이미지`;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function modeBadge(mode) {
  const meta = MODE_META[mode] || MODE_META.blank;
  return element('span', `type-badge battle-${mode}`, `${meta.icon} ${meta.label}`);
}

function statusBadge(topic) {
  const phase = battlePhase(topic);
  return element('span', `battle-status-chip ${phase}`, phaseLabel(topic));
}

function topicCard(topic, rank = 0) {
  const meta = MODE_META[topic.mode] || MODE_META.blank;
  const card = element('a', 'topic-card battle-topic-card');
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;
  const top = element('div', 'topic-meta');
  top.append(modeBadge(topic.mode), statusBadge(topic));
  card.append(top);
  const image = topicImageElement(topic, 'topic-card-image');
  if (image) card.append(image);
  if (rank > 0) card.append(element('span', 'hall-rank', `명예 ${rank}위`));
  card.append(
    element('h3', '', String(topic.title || `${meta.label} 배틀`)),
    element('p', '', String(topic.displayPrompt || ''))
  );
  if (rank > 0 && (topic.winnerText || topic.leaderText)) {
    card.append(element('blockquote', 'hall-winner-preview', `“${String(topic.winnerText || topic.leaderText)}”`));
  }
  const stats = element('div', 'topic-stats');
  if (Number(topic.gameVersion) === GAME_VERSION) {
    stats.append(
      element('span', '', `출전 ${Math.max(0, Number(topic.commentCount) || 0)}`),
      element('span', '', `심사 ${Math.max(0, Number(topic.pairVoteCount) || 0)}`),
      element('span', '', `판주 ${String(topic.nickname || '익명 드리퍼')}`)
    );
  } else {
    stats.append(
      element('span', '', `출전 ${Math.max(0, Number(topic.commentCount) || 0)}`),
      element('span', '', `반응 ${Math.max(0, Number(topic.topLikeCount) || 0)}`),
      element('span', '', `판주 ${String(topic.nickname || '익명 드리퍼')}`)
    );
  }
  card.append(stats);
  return card;
}

function topicListSection(items, emptyText, ranked = false) {
  if (!items.length) return element('div', 'empty-card', emptyText);
  const list = element('div', 'topic-list');
  list.replaceChildren(...items.map((topic, index) => topicCard(topic, ranked ? index + 1 : 0)));
  return list;
}

function modeTile(mode) {
  const meta = MODE_META[mode];
  const tile = element('a', `battle-mode-tile mode-${mode}`);
  tile.href = `#/mode/${mode}`;
  tile.append(
    element('span', 'battle-mode-icon', meta.icon),
    element('strong', '', meta.label),
    element('small', '', meta.short),
    element('em', '', meta.example)
  );
  return tile;
}

function sectionHeading(kicker, title, actionText = '', actionMode = '') {
  const heading = element('div', 'section-heading');
  const copy = element('div');
  copy.append(element('p', 'section-kicker', kicker), element('h2', '', title));
  heading.append(copy);
  if (actionText) {
    const action = element('button', 'write-button', actionText);
    action.type = 'button';
    action.dataset.openDialog = actionMode || 'blank';
    heading.append(action);
  }
  return heading;
}

async function renderHome() {
  setActiveNav('home');
  const topics = sortedLatest(await loadTopics());
  const recruiting = topics.filter(topic => battlePhase(topic) === 'recruiting');
  const voting = topics.filter(topic => battlePhase(topic) === 'voting');

  const hero = element('section', 'hero-card battle-hero');
  hero.append(
    element('p', 'eyebrow', 'BLIND COMEDY BATTLE'),
    element('h1', '', '먼저 출전하고, 마감 뒤 두 작품씩 붙습니다.'),
    element('p', '', '출전 중에는 다른 답을 볼 수 없습니다. 심사 시간에는 작성자 없이 두 작품만 비교하고, 종료 뒤 우승작과 전체 순위를 공개합니다.')
  );
  const heroActions = element('div', 'battle-hero-actions');
  const browse = element('a', 'submit-button battle-hero-link', '열린 배틀 찾기');
  browse.href = '#/browse';
  const create = element('button', 'write-button', '새 배틀 열기');
  create.type = 'button';
  create.dataset.openDialog = 'blank';
  heroActions.append(browse, create);
  hero.append(heroActions);

  const modes = element('section', 'section-block');
  modes.append(sectionHeading('7 BATTLE MODES', '10초 안에 골라서 출전'));
  const grid = element('div', 'battle-mode-grid');
  grid.replaceChildren(...MODE_ORDER.map(modeTile));
  modes.append(grid);

  const live = element('section', 'section-block');
  live.append(
    sectionHeading('ENTRY OPEN', '지금 블라인드 출전 중', '배틀 열기', 'blank'),
    topicListSection(recruiting.slice(0, 10), '현재 출전 접수 중인 배틀이 없습니다.')
  );

  const judging = element('section', 'section-block');
  judging.append(
    sectionHeading('DUEL VOTING', '지금 1대1 심사 중'),
    topicListSection(voting.slice(0, 8), '현재 비교투표가 진행 중인 배틀이 없습니다.')
  );

  app.replaceChildren(hero, modes, live, judging);
  startCountdowns();
}

function filterBar(activeMode = '') {
  const bar = element('nav', 'battle-filter-bar');
  const all = element('a', activeMode ? '' : 'active', '전체');
  all.href = '#/browse';
  bar.append(all);
  for (const mode of MODE_ORDER) {
    const meta = MODE_META[mode];
    const link = element('a', activeMode === mode ? 'active' : '', `${meta.icon} ${meta.label}`);
    link.href = `#/mode/${mode}`;
    bar.append(link);
  }
  return bar;
}

async function renderBrowse(activeMode = '') {
  setActiveNav(activeMode ? 'mode' : 'browse');
  const topics = sortedLatest(await loadTopics())
    .filter(topic => !activeMode || topic.mode === activeMode);
  const meta = activeMode ? MODE_META[activeMode] : null;
  const header = element('section', 'page-heading battle-page-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(
    element('p', 'section-kicker', meta ? `${meta.icon} BATTLE MODE` : 'ALL BATTLES'),
    element('h1', '', meta ? meta.label : '배틀찾기'),
    element('p', '', meta ? meta.short : '출전 중, 심사 중, 종료된 배틀을 한곳에서 확인합니다.')
  );
  const write = element('button', 'write-button', '＋ 배틀 열기');
  write.type = 'button';
  write.dataset.openDialog = activeMode || 'blank';
  header.append(copy, write);
  const section = element('section', 'section-block');
  section.append(filterBar(activeMode), topicListSection(topics, '이 방식으로 열린 배틀이 아직 없습니다.'));
  app.replaceChildren(header, section);
  startCountdowns();
}

async function renderPopular() {
  setActiveNav('popular');
  const topics = sortedPopular(await loadTopics());
  const header = element('section', 'page-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(
    element('p', 'section-kicker', '🔥 ACTIVE BATTLES'),
    element('h1', '', '지금 가장 뜨거운 배틀'),
    element('p', '', '출전자 수와 1대1 심사 참여가 많은 경기부터 보여줍니다.')
  );
  header.append(copy);
  const section = element('section', 'section-block');
  section.append(topicListSection(topics, '아직 활발한 배틀이 없습니다.'));
  app.replaceChildren(header, section);
  startCountdowns();
}

async function renderHall() {
  setActiveNav('hall');
  const topics = sortedPopular(await loadTopics())
    .filter(topic => Number(topic.gameVersion) === GAME_VERSION && battlePhase(topic) === 'closed')
    .filter(topic => topic.winnerText || topic.leaderText)
    .slice(0, 30);
  const header = element('section', 'page-heading hall-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(
    element('p', 'section-kicker', '🏆 HALL OF DRIP'),
    element('h1', '', '명예의전당'),
    element('p', '', '심사 시간이 끝나 최종 우승이 확정된 작품만 기록합니다.')
  );
  header.append(copy);
  const section = element('section', 'section-block');
  section.append(topicListSection(topics, '아직 우승작이 탄생하지 않았습니다.', true));
  app.replaceChildren(header, section);
}

async function loadLegacyComments(topicId) {
  const snapshot = await getDocs(query(
    collection(db, `dripso_topics/${topicId}/comments`),
    where('status', '==', 'visible'),
    limit(200)
  ));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0)
      || timestampMs(a.createdAt) - timestampMs(b.createdAt));
}

function loginNotice(text = '참여는 로그인 후 가능합니다.') {
  const notice = element('div', 'login-notice');
  notice.append(`${text} `);
  const link = element('a', '', '로그인하기');
  link.href = '/#/auth';
  notice.append(link);
  return notice;
}

function legacyComposer(topicId, mode) {
  if (!isAccountUser()) return loginNotice('출전과 반응은 로그인 후 가능합니다.');
  const form = element('form', 'comment-form');
  form.dataset.legacyCommentForm = topicId;
  const area = element('textarea');
  area.name = 'text';
  area.maxLength = mode === 'naming' ? 80 : 180;
  area.required = true;
  area.rows = 2;
  area.placeholder = mode === 'naming' ? '이름만 짧고 강하게 입력해 주세요.' : '짧고 강한 한마디를 남겨주세요.';
  const footer = element('div', 'comment-form-footer');
  footer.append(element('small', '', `${profileNickname || '로그인 사용자'}로 출전합니다.`));
  const submit = element('button', 'comment-submit', '이 한마디로 출전');
  submit.type = 'submit';
  footer.append(submit);
  form.append(area, footer);
  return form;
}

function legacyCommentCard(topicId, comment, index) {
  const card = element('article', `comment-card${index < 3 ? ' best' : ''}`);
  card.dataset.commentId = comment.id;
  const meta = element('div', 'comment-meta');
  meta.append(
    element('span', index < 3 ? 'best-rank' : '', index < 3 ? `BEST ${index + 1}` : `#${index + 1}`),
    element('span', '', `${String(comment.nickname || '익명 드리퍼')} · ${formatDate(comment.createdAt)}`)
  );
  const like = element('button', 'like-button', `❤️ 반응 ${Math.max(0, Number(comment.likeCount) || 0)}`);
  like.type = 'button';
  like.dataset.legacyLike = comment.id;
  like.dataset.topic = topicId;
  card.append(meta, element('p', 'comment-text', String(comment.text || '')), like);
  return card;
}

async function renderLegacyTopic(topic) {
  const comments = await loadLegacyComments(topic.id);
  const meta = MODE_META[topic.mode];
  const detail = element('section', 'topic-detail battle-topic-detail');
  const back = element('a', 'back-button', `← ${meta.label} 배틀로 돌아가기`);
  back.href = `#/mode/${topic.mode}`;
  detail.append(back, modeBadge(topic.mode), element('h1', '', String(topic.title || `${meta.label} 배틀`)));
  const image = topicImageElement(topic, 'topic-detail-image');
  if (image) detail.append(image);
  detail.append(
    element('p', 'topic-prompt battle-prompt', String(topic.displayPrompt || '')),
    element('div', 'battle-rule-note', '기존 자유형 배틀 · 댓글 반응으로 순위를 정합니다.'),
    element('p', 'topic-author', `판주 ${String(topic.nickname || '익명 드리퍼')} · 출전 ${comments.length}명`),
    legacyComposer(topic.id, topic.mode)
  );
  const section = element('section', 'section-block');
  const heading = sectionHeading('CROWD RANKING', '현재 반응 순위');
  heading.append(element('span', '', `${comments.length}개`));
  section.append(heading);
  if (comments.length) {
    const list = element('div', 'comment-list');
    list.replaceChildren(...comments.map((comment, index) => legacyCommentCard(topic.id, comment, index)));
    section.append(list);
  } else {
    section.append(element('div', 'empty-card', '아직 출전작이 없습니다. 첫 한마디를 남겨주세요.'));
  }
  app.replaceChildren(detail, section);
}

function phasePanel(phase, deadlineMs, entryCount, pairVoteCount) {
  const panel = element('section', `battle-phase-panel ${phase}`);
  const icon = phase === 'recruiting' ? '🔒' : phase === 'voting' ? '⚔️' : '🏆';
  const title = phase === 'recruiting'
    ? '블라인드 출전 중'
    : phase === 'voting' ? '1대1 비교심사 중' : '경기 종료';
  const description = phase === 'recruiting'
    ? '마감 전에는 본인 작품만 볼 수 있습니다. 다른 출전작과 닉네임은 공개되지 않습니다.'
    : phase === 'voting'
      ? '작성자 정보 없이 두 작품만 나타납니다. 더 웃긴 한쪽을 선택해 주세요.'
      : '투표가 끝났습니다. 우승작과 전체 순위를 공개합니다.';
  panel.append(element('span', 'battle-phase-icon', icon));
  const copy = element('div', 'battle-phase-copy');
  copy.append(element('strong', '', title), element('p', '', description));
  const status = element('div', 'battle-phase-stats');
  status.append(
    element('span', '', `출전자 ${entryCount}명`),
    element('span', '', `비교심사 ${pairVoteCount}회`)
  );
  if (deadlineMs && phase !== 'closed') {
    const countdown = element('span', 'battle-live-countdown', formatRemaining(deadlineMs));
    countdown.dataset.deadline = String(deadlineMs);
    status.append(countdown);
  }
  copy.append(status);
  panel.append(copy);
  return panel;
}

function ownEntryCard(entry, label = '내 출전작') {
  if (!entry) return null;
  const card = element('article', 'comment-card own-battle-entry');
  card.dataset.commentId = entry.id;
  const meta = element('div', 'comment-meta');
  meta.append(element('span', 'best-rank', label), element('span', '', '다른 사용자에게는 아직 공개되지 않습니다.'));
  card.append(meta, element('p', 'comment-text', String(entry.text || '')));
  return card;
}

function gameEntryComposer(topicId, mode, ownEntry) {
  if (!isAccountUser()) return loginNotice('블라인드 출전은 로그인 후 가능합니다.');
  const form = element('form', 'comment-form game-entry-form');
  form.dataset.gameEntryForm = topicId;
  const area = element('textarea');
  area.name = 'text';
  area.maxLength = mode === 'naming' ? 80 : 180;
  area.required = true;
  area.rows = 2;
  area.value = String(ownEntry?.text || '');
  area.placeholder = mode === 'naming' ? '이름만 짧고 강하게 입력해 주세요.' : '설명보다 한 방이 좋습니다. 짧게 입력해 주세요.';
  const footer = element('div', 'comment-form-footer');
  footer.append(element('small', '', ownEntry ? '마감 전까지 같은 작품을 수정할 수 있습니다.' : '한 계정당 한 작품만 출전합니다.'));
  const submit = element('button', 'comment-submit', ownEntry ? '출전작 수정' : '블라인드 출전');
  submit.type = 'submit';
  footer.append(submit);
  form.append(area, footer);
  return form;
}

function resultEntryCard(entry, index, winnerId) {
  const isWinner = entry.id === winnerId;
  const card = element('article', `comment-card game-result-card${isWinner ? ' battle-winner' : ''}`);
  card.dataset.commentId = entry.id;
  const meta = element('div', 'comment-meta');
  meta.append(
    element('span', isWinner ? 'best-rank' : '', isWinner ? '🏆 우승' : `${index + 1}위`),
    element('span', '', String(entry.nickname || '익명 드리퍼'))
  );
  card.append(
    meta,
    element('p', 'comment-text', String(entry.text || '')),
    element('div', 'battle-result-score', `선택 ${Math.max(0, Number(entry.battleScore) || 0)}회 · 대결 노출 ${Math.max(0, Number(entry.duelCount) || 0)}회`)
  );
  return card;
}

async function fillMatchup(topicId, container, version) {
  if (!isAccountUser()) {
    container.replaceChildren(loginNotice('1대1 비교심사는 로그인 후 참여할 수 있습니다.'));
    return;
  }
  container.replaceChildren(element('div', 'loading-card compact', '다음 두 작품을 고르는 중입니다.'));
  try {
    const response = await getBattleMatchup({ topicId });
    if (version !== routeVersion || !container.isConnected) return;
    const data = response.data || {};
    if (data.completed) {
      const complete = element('div', 'battle-vote-complete');
      complete.append(element('span', '', '✅'), element('strong', '', '현재 가능한 비교를 모두 완료했습니다.'), element('p', '', String(data.reason || '다른 배틀의 심사에도 참여해 보세요.')));
      container.replaceChildren(complete);
      return;
    }
    const duel = element('div', 'battle-duel');
    const title = element('div', 'battle-duel-heading');
    title.append(element('p', 'section-kicker', 'ANONYMOUS DUEL'), element('h2', '', '어느 쪽이 더 웃겼습니까?'));
    const choices = element('div', 'battle-duel-choices');
    for (const [side, entry] of [['A', data.left], ['B', data.right]]) {
      const button = element('button', 'battle-duel-choice');
      button.type = 'button';
      button.dataset.duelTopic = topicId;
      button.dataset.duelLeft = data.left.id;
      button.dataset.duelRight = data.right.id;
      button.dataset.duelSelected = entry.id;
      button.append(element('span', 'battle-duel-letter', side), element('p', '', String(entry.text || '')));
      choices.append(button);
    }
    duel.append(title, choices, element('small', 'battle-duel-remaining', `남은 비교 후보 약 ${Math.max(1, Number(data.remaining) || 1)}개`));
    container.replaceChildren(duel);
  } catch (error) {
    container.replaceChildren(element('div', 'error-card', errorMessage(error, '비교할 작품을 불러오지 못했습니다.')));
  }
}

async function renderGameTopic(topic) {
  const version = routeVersion;
  const response = await getBattleView({ topicId: topic.id });
  if (version !== routeVersion) return;
  const view = response.data || {};
  const phase = String(view.phase || battlePhase(topic));
  const meta = MODE_META[topic.mode];
  const detail = element('section', 'topic-detail battle-topic-detail');
  const back = element('a', 'back-button', `← ${meta.label} 배틀로 돌아가기`);
  back.href = `#/mode/${topic.mode}`;
  detail.append(back, modeBadge(topic.mode), element('h1', '', String(topic.title || `${meta.label} 배틀`)));
  const image = topicImageElement(topic, 'topic-detail-image');
  if (image) detail.append(image);
  detail.append(
    element('p', 'topic-prompt battle-prompt', String(topic.displayPrompt || '')),
    element('p', 'topic-author', `판주 ${String(topic.nickname || '익명 드리퍼')}`)
  );

  const deadlineMs = phase === 'recruiting' ? Number(view.entryDeadlineMs) : Number(view.votingDeadlineMs);
  const phaseBlock = phasePanel(
    phase,
    deadlineMs,
    Math.max(0, Number(view.entryCount) || 0),
    Math.max(0, Number(view.pairVoteCount) || 0)
  );

  if (phase === 'recruiting') {
    detail.append(phaseBlock, gameEntryComposer(topic.id, topic.mode, view.ownEntry));
    const section = element('section', 'section-block blind-entry-section');
    section.append(sectionHeading('BLIND ENTRY', '출전작은 마감 뒤 공개됩니다.'));
    const own = ownEntryCard(view.ownEntry);
    if (own) section.append(own);
    else section.append(element('div', 'empty-card', '아직 출전하지 않았습니다. 위 입력창에 한마디를 남겨주세요.'));
    app.replaceChildren(detail, section);
    startCountdowns();
    return;
  }

  if (phase === 'voting') {
    detail.append(phaseBlock);
    const own = ownEntryCard(view.ownEntry, '내 출전작');
    if (own) detail.append(own);
    const section = element('section', 'section-block battle-voting-section');
    const matchupHost = element('div', 'battle-matchup-host');
    section.append(matchupHost);
    app.replaceChildren(detail, section);
    startCountdowns();
    await fillMatchup(topic.id, matchupHost, version);
    return;
  }

  detail.append(phaseBlock);
  const entries = Array.isArray(view.entries) ? view.entries : [];
  const winner = view.winner || entries[0] || null;
  if (winner) {
    const winnerCard = element('section', 'battle-winner-showcase');
    winnerCard.append(
      element('span', 'battle-winner-crown', '🏆'),
      element('p', 'section-kicker', 'FINAL WINNER'),
      element('blockquote', '', `“${String(winner.text || '')}”`),
      element('strong', '', String(winner.nickname || '익명 드리퍼')),
      element('small', '', `1대1 선택 ${Math.max(0, Number(winner.battleScore) || 0)}회`)
    );
    detail.append(winnerCard);
  }
  const section = element('section', 'section-block');
  section.append(sectionHeading('FINAL RANKING', '최종 순위'));
  if (entries.length) {
    const list = element('div', 'comment-list');
    list.replaceChildren(...entries.map((entry, index) => resultEntryCard(entry, index, winner?.id || '')));
    section.append(list);
  } else {
    section.append(element('div', 'empty-card', '출전작이 없어 우승작을 정하지 못했습니다.'));
  }
  app.replaceChildren(detail, section);
}

async function renderTopic(topicId) {
  renderLoading();
  const topicSnap = await getDoc(doc(db, 'dripso_topics', topicId));
  const topic = topicSnap.exists() ? parsedTopic({ id: topicSnap.id, ...topicSnap.data() }) : null;
  if (!topic || topic.status !== 'visible') {
    renderError('삭제되었거나 현재 드립배틀에서 볼 수 없는 주제입니다.');
    return;
  }
  setActiveNav('browse');
  if (Number(topic.gameVersion) === GAME_VERSION) await renderGameTopic(topic);
  else await renderLegacyTopic(topic);
}

function applyModeForm(mode) {
  const selected = MODE_META[mode] ? mode : 'blank';
  battleMode.value = selected;
  const meta = MODE_META[selected];
  topicTitle.placeholder = meta.titlePlaceholder;
  topicPrompt.placeholder = meta.promptPlaceholder;
}

function syncTopicSubmitState() {
  topicSubmit.disabled = imageProcessing || topicSubmitting;
  topicSubmit.textContent = imageProcessing
    ? '사진 처리 중…'
    : (topicSubmitting ? '배틀 여는 중…' : '블라인드 배틀 열기');
}

function setImageStatus(message = '', isError = false) {
  topicImageStatus.textContent = message;
  topicImageStatus.classList.toggle('error', isError);
}

function clearSelectedImage() {
  imageSelectionVersion += 1;
  selectedImageDataUrl = '';
  topicImage.value = '';
  topicImagePreviewImg.removeAttribute('src');
  topicImagePreview.hidden = true;
  imageProcessing = false;
  setImageStatus('');
  syncTopicSubmitState();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('사진 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('지원하지 않거나 손상된 사진입니다.'));
    image.src = dataUrl;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function compressTopicImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('JPG, PNG, WEBP 사진만 첨부할 수 있습니다.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('원본 사진은 12MB 이하만 첨부할 수 있습니다.');
  const source = await loadImage(await readFileAsDataUrl(file));
  const sourceWidth = Math.max(1, Number(source.naturalWidth) || 1);
  const sourceHeight = Math.max(1, Number(source.naturalHeight) || 1);
  let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이 기기에서 사진을 처리할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    for (const quality of [0.84, 0.74, 0.64, 0.54]) {
      const blob = await canvasToJpegBlob(canvas, quality);
      if (blob && blob.size <= MAX_UPLOAD_IMAGE_BYTES) return blob;
    }
    scale *= 0.78;
  }
  throw new Error('사진 용량을 줄이지 못했습니다. 다른 사진을 선택해 주세요.');
}

async function handleTopicImageSelection() {
  const file = topicImage.files?.[0];
  const version = ++imageSelectionVersion;
  selectedImageDataUrl = '';
  topicImagePreview.hidden = true;
  topicImagePreviewImg.removeAttribute('src');
  if (!file) {
    setImageStatus('');
    return;
  }
  imageProcessing = true;
  setImageStatus('사진을 게시용 크기로 줄이는 중입니다.');
  syncTopicSubmitState();
  try {
    const blob = await compressTopicImage(file);
    const dataUrl = await readFileAsDataUrl(blob);
    if (version !== imageSelectionVersion) return;
    selectedImageDataUrl = dataUrl;
    topicImagePreviewImg.src = dataUrl;
    topicImagePreview.hidden = false;
    setImageStatus(`사진 준비 완료 · 약 ${Math.max(1, Math.round(blob.size / 1024))}KB`);
  } catch (error) {
    if (version !== imageSelectionVersion) return;
    selectedImageDataUrl = '';
    topicImage.value = '';
    setImageStatus(errorMessage(error, '사진을 처리하지 못했습니다.'), true);
    showToast(errorMessage(error, '사진을 처리하지 못했습니다.'));
  } finally {
    if (version === imageSelectionVersion) {
      imageProcessing = false;
      syncTopicSubmitState();
    }
  }
}

function openDialog(mode = 'blank') {
  if (!isAccountUser()) {
    showToast('판결소 계정으로 로그인한 뒤 배틀을 열 수 있습니다.');
    return;
  }
  applyModeForm(mode);
  topicDialog.showModal();
  window.setTimeout(() => topicTitle.focus(), 20);
}

function stopCountdowns() {
  window.clearInterval(countdownTimer);
  countdownTimer = 0;
}

function startCountdowns() {
  stopCountdowns();
  const update = () => {
    let expired = false;
    document.querySelectorAll('[data-deadline]').forEach(node => {
      const deadline = Number(node.dataset.deadline) || 0;
      node.textContent = formatRemaining(deadline);
      if (deadline && Date.now() >= deadline) expired = true;
    });
    if (expired) {
      stopCountdowns();
      window.setTimeout(() => void renderRoute(), 500);
    }
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}

async function renderRoute() {
  const version = ++routeVersion;
  stopCountdowns();
  const route = currentRoute();
  renderLoading();
  try {
    if (route.name === 'home') await renderHome();
    else if (route.name === 'browse') await renderBrowse();
    else if (route.name === 'mode') await renderBrowse(route.mode);
    else if (route.name === 'popular') await renderPopular();
    else if (route.name === 'hall') await renderHall();
    else if (route.name === 'topic') await renderTopic(route.id);
    else if (route.name === 'create') {
      await renderBrowse();
      openDialog('blank');
    }
    if (version !== routeVersion) return;
    app.focus({ preventScroll: true });
  } catch (error) {
    console.error('Dripso battle v2 render failed:', error);
    if (version === routeVersion) renderError(errorMessage(error, '드립 배틀을 불러오지 못했습니다.'));
  }
}

app.addEventListener('click', async event => {
  const dialogButton = event.target.closest('[data-open-dialog]');
  if (dialogButton) {
    openDialog(dialogButton.dataset.openDialog || 'blank');
    return;
  }

  const duelButton = event.target.closest('[data-duel-topic][data-duel-selected]');
  if (duelButton) {
    const host = duelButton.closest('.battle-matchup-host');
    const buttons = [...host.querySelectorAll('[data-duel-topic]')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      await voteBattleMatchup({
        topicId: duelButton.dataset.duelTopic,
        leftEntryId: duelButton.dataset.duelLeft,
        rightEntryId: duelButton.dataset.duelRight,
        selectedEntryId: duelButton.dataset.duelSelected
      });
      showToast('한 표를 반영했습니다. 다음 대결입니다.');
      await fillMatchup(duelButton.dataset.duelTopic, host, routeVersion);
      topicsCache = null;
    } catch (error) {
      showToast(errorMessage(error, '비교투표에 실패했습니다.'));
      buttons.forEach(button => { button.disabled = false; });
    }
    return;
  }

  const likeButton = event.target.closest('[data-legacy-like][data-topic]');
  if (!likeButton) return;
  if (!isAccountUser()) {
    showToast('로그인 후 반응을 남길 수 있습니다.');
    return;
  }
  likeButton.disabled = true;
  try {
    const response = await toggleLegacyLike({
      topicId: likeButton.dataset.topic,
      commentId: likeButton.dataset.legacyLike
    });
    const liked = response.data?.liked === true;
    const count = Math.max(0, Number(response.data?.likeCount) || 0);
    likeButton.classList.toggle('active', liked);
    likeButton.textContent = `❤️ 반응 ${count}`;
    topicsCache = null;
  } catch (error) {
    showToast(errorMessage(error, '반응 처리에 실패했습니다.'));
  } finally {
    likeButton.disabled = false;
  }
});

app.addEventListener('submit', async event => {
  const gameForm = event.target.closest('[data-game-entry-form]');
  if (gameForm) {
    event.preventDefault();
    const area = gameForm.querySelector('textarea[name="text"]');
    const submit = gameForm.querySelector('button[type="submit"]');
    const text = String(area?.value || '').trim();
    if (text.length < 2) {
      showToast('출전작을 2자 이상 입력해 주세요.');
      return;
    }
    submit.disabled = true;
    try {
      const response = await submitBattleEntry({ topicId: gameForm.dataset.gameEntryForm, text });
      showToast(response.data?.updated ? '출전작을 수정했습니다.' : '블라인드 출전을 완료했습니다.');
      topicsCache = null;
      await renderTopic(gameForm.dataset.gameEntryForm);
    } catch (error) {
      showToast(errorMessage(error, '출전에 실패했습니다.'));
    } finally {
      submit.disabled = false;
    }
    return;
  }

  const legacyForm = event.target.closest('[data-legacy-comment-form]');
  if (!legacyForm) return;
  event.preventDefault();
  const area = legacyForm.querySelector('textarea[name="text"]');
  const submit = legacyForm.querySelector('button[type="submit"]');
  const text = String(area?.value || '').trim();
  if (text.length < 2) {
    showToast('출전작을 2자 이상 입력해 주세요.');
    return;
  }
  submit.disabled = true;
  try {
    await addLegacyComment({ topicId: legacyForm.dataset.legacyCommentForm, text });
    topicsCache = null;
    showToast('출전 완료. 현재 순위에 반영했습니다.');
    await renderTopic(legacyForm.dataset.legacyCommentForm);
  } catch (error) {
    showToast(errorMessage(error, '출전에 실패했습니다.'));
  } finally {
    submit.disabled = false;
  }
});

topicForm.addEventListener('submit', async event => {
  event.preventDefault();
  const mode = MODE_META[battleMode.value] ? battleMode.value : 'blank';
  const title = topicTitle.value.trim();
  const prompt = topicPrompt.value.trim();
  if (title.length < 2 || prompt.length < 4) {
    showToast('제목과 문제를 조금 더 입력해 주세요.');
    return;
  }
  if (imageProcessing) {
    showToast('사진 처리가 끝난 뒤 등록해 주세요.');
    return;
  }
  topicSubmitting = true;
  syncTopicSubmitState();
  try {
    const response = await createBattle({
      mode,
      title,
      prompt,
      entryMinutes: Number(entryDuration.value),
      votingMinutes: Number(votingDuration.value),
      imageDataUrl: selectedImageDataUrl
    });
    const topicId = String(response.data?.topicId || '');
    topicsCache = null;
    topicForm.reset();
    applyModeForm('blank');
    clearSelectedImage();
    topicDialog.close();
    showToast('블라인드 드립 배틀을 열었습니다.');
    location.hash = `#/topic/${topicId}`;
  } catch (error) {
    showToast(errorMessage(error, '배틀 등록에 실패했습니다.'));
  } finally {
    topicSubmitting = false;
    syncTopicSubmitState();
  }
});

battleMode.addEventListener('change', () => applyModeForm(battleMode.value));
topicImage.addEventListener('change', () => void handleTopicImageSelection());
removeTopicImageButton.addEventListener('click', clearSelectedImage);
openTopicDialogButton.addEventListener('click', () => openDialog('blank'));
closeTopicDialogButton.addEventListener('click', () => topicDialog.close());
topicDialog.addEventListener('click', event => {
  if (event.target === topicDialog) topicDialog.close();
});
window.addEventListener('hashchange', () => void renderRoute());

onAuthStateChanged(auth, async user => {
  if (user && !user.isAnonymous) {
    const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
    profileNickname = profile?.exists() ? String(profile.data().nickname || '').slice(0, 20) : '';
    accountLink.textContent = profileNickname || user.displayName || '내 계정';
    accountLink.href = '/#/my-cases';
  } else {
    profileNickname = '';
    accountLink.textContent = '로그인';
    accountLink.href = '/#/auth';
  }
});

applyModeForm('blank');
syncTopicSubmitState();
await initAuth().catch(error => console.warn('Dripso auth init failed:', error));
await renderRoute();
