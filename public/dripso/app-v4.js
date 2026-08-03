import { initAuth, auth, db, functions } from '/js/firebase.js?v=20260729-auth-session-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const MODES = Object.freeze({
  blank: {
    label: '빈칸채우기', icon: '🧩', short: '문장의 마지막 한 방만 채워주세요.',
    example: '회의가 길어지는 이유는 ______ 때문이다.',
    titlePlaceholder: '예: 회의가 길어지는 진짜 이유',
    promptPlaceholder: '예: 회의가 길어지는 이유는 ______ 때문이다.',
    entryPlaceholder: '빈칸에 들어갈 한마디를 입력해 주세요.'
  },
  naming: {
    label: '이름붙이기', icon: '🏷️', short: '별명·필살기·제품명을 붙여주세요.',
    example: '퇴근 직전에 일을 주는 기술의 이름은?',
    titlePlaceholder: '예: 부장님의 퇴근 방해 기술',
    promptPlaceholder: '예: 퇴근 직전에 일을 주는 기술의 이름을 지어주세요.',
    entryPlaceholder: '이름만 짧고 강하게 입력해 주세요.'
  },
  comeback: {
    label: '받아치기', icon: '↩️', short: '상대의 한마디를 재치 있게 받아칩니다.',
    example: '“이거 금방 끝나.” 가장 적절한 대답은?',
    titlePlaceholder: '예: 금방 끝난다는 말에 받아치기',
    promptPlaceholder: '예: “이거 금방 끝나.”라는 말에 가장 웃긴 답은?',
    entryPlaceholder: '상대에게 돌려줄 한마디를 입력해 주세요.'
  },
  wrong: {
    label: '오답제출', icon: '❌', short: '정답 대신 가장 웃긴 오답을 냅니다.',
    example: '회사에서 가장 중요한 자원은?',
    titlePlaceholder: '예: 회사의 가장 중요한 자원',
    promptPlaceholder: '예: 회사에서 가장 중요한 자원은? 정답 말고 오답만.',
    entryPlaceholder: '정답처럼 당당한 오답을 입력해 주세요.'
  },
  headline: {
    label: '뉴스제목', icon: '📰', short: '평범한 사건을 속보로 만들어주세요.',
    example: '냉장고 케이크 실종 사건을 속보로 쓴다면?',
    titlePlaceholder: '예: 냉장고 케이크 실종 속보',
    promptPlaceholder: '예: 가족이 냉장고 케이크를 다 먹은 상황의 기사 제목은?',
    entryPlaceholder: '한 줄짜리 속보 제목을 입력해 주세요.'
  },
  excuse: {
    label: '변명대회', icon: '🥸', short: '황당하지만 순간 납득되는 변명을 냅니다.',
    example: '약속에 한 시간 늦은 이유는?',
    titlePlaceholder: '예: 지각 한 시간 변명대회',
    promptPlaceholder: '예: 약속에 한 시간 늦은 가장 황당한 변명은?',
    entryPlaceholder: '말하는 순간은 그럴듯한 변명을 입력해 주세요.'
  },
  manual: {
    label: '사용설명서', icon: '📘', short: '사람과 상황을 제품 설명서처럼 표현합니다.',
    example: '부장님 사용 시 주의사항은?',
    titlePlaceholder: '예: 부장님 사용설명서',
    promptPlaceholder: '예: 부장님 사용 시 주의사항을 한 줄로 작성해 주세요.',
    entryPlaceholder: '주의사항이나 사용법을 한 줄로 입력해 주세요.'
  }
});

const MODE_ORDER = Object.keys(MODES);
const MODE_MARKER = /^\[\[dripso-mode:([a-z-]+)\]\]\s*/i;
const PAGE_SIZE = 100;
const MAX_PAGES = 30;
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 700 * 1024;
const MAX_IMAGE_EDGE = 1280;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const calls = Object.freeze({
  createTournament: httpsCallable(functions, 'createDripsoTournamentBattle'),
  submitTournament: httpsCallable(functions, 'submitDripsoTournamentEntry'),
  getTournamentView: httpsCallable(functions, 'getDripsoTournamentView'),
  getTournamentMatchup: httpsCallable(functions, 'getDripsoTournamentMatchup'),
  voteTournament: httpsCallable(functions, 'voteDripsoTournamentMatchup'),
  submitV2: httpsCallable(functions, 'submitDripsoBattleEntry'),
  getV2View: httpsCallable(functions, 'getDripsoBattleView'),
  getV2Matchup: httpsCallable(functions, 'getDripsoBattleMatchup'),
  voteV2: httpsCallable(functions, 'voteDripsoBattleMatchup'),
  addLegacyComment: httpsCallable(functions, 'addDripsoComment'),
  toggleLegacyLike: httpsCallable(functions, 'toggleDripsoCommentLike')
});

const app = document.getElementById('dripso-app');
const nav = document.querySelector('.dripso-bottom-nav');
const dialog = document.getElementById('topic-dialog');
const topicForm = document.getElementById('topic-form');
const modeSelect = document.getElementById('battle-mode');
const titleInput = document.getElementById('topic-title');
const promptInput = document.getElementById('topic-prompt');
const entryDuration = document.getElementById('entry-duration');
const prelimDuration = document.getElementById('voting-duration');
const finalsDuration = document.getElementById('finals-duration');
const imageInput = document.getElementById('topic-image');
const imagePreview = document.getElementById('topic-image-preview');
const imagePreviewImage = document.getElementById('topic-image-preview-img');
const imageStatus = document.getElementById('topic-image-status');
const imageRemove = document.getElementById('remove-topic-image');
const submitButton = document.getElementById('topic-submit');
const openDialogButton = document.getElementById('open-topic-dialog');
const closeDialogButton = document.getElementById('close-topic-dialog');
const accountLink = document.getElementById('account-link');
const toast = document.getElementById('toast');

let routeToken = 0;
let topicsCache = null;
let topicsCacheAt = 0;
let profileNickname = '';
let countdownTimer = 0;
let toastTimer = 0;
let selectedImageDataUrl = '';
let imageWorkToken = 0;
let imageProcessing = false;
let submittingTopic = false;
let browsePhase = 'all';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function emitRendered(name = 'route') {
  window.dispatchEvent(new CustomEvent('dripso:rendered', { detail: { name } }));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = String(message || '');
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
}

function errorText(error, fallback) {
  const raw = String(error?.message || '');
  return raw.replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function isMember() {
  return Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
}

function ms(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const valueMs = ms(value);
  if (!valueMs) return '방금 전';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(valueMs));
}

function remaining(deadline) {
  const left = Math.max(0, Number(deadline || 0) - Date.now());
  const minutes = Math.floor(left / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  if (minutes > 0) return `${minutes}분`;
  return left > 0 ? `${Math.ceil(left / 1000)}초` : '마감';
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' ? url.href : '';
  } catch {
    return '';
  }
}

function parsedTopic(id, data = {}) {
  const rawPrompt = String(data.prompt || '');
  const marker = rawPrompt.match(MODE_MARKER);
  let mode = MODES[data.mode] ? data.mode : '';
  if (!mode && marker && MODES[marker[1]]) mode = marker[1];
  if (!mode && data.type === 'naming') mode = 'naming';
  if (!mode && data.type === 'situation') mode = 'comeback';
  if (!mode) return null;
  return {
    id,
    ...data,
    mode,
    gameVersion: Number(data.gameVersion) || 1,
    displayPrompt: rawPrompt.replace(MODE_MARKER, '').trim()
  };
}

function route() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [path, queryString = ''] = raw.split('?');
  const [name = '', value = ''] = path.split('/');
  const params = new URLSearchParams(queryString);
  if (name === 'topic' && value) {
    try { return { name: 'topic', id: decodeURIComponent(value) }; }
    catch { return { name: 'home' }; }
  }
  if (name === 'mode' && MODES[value]) return { name: 'mode', mode: value, phase: params.get('phase') || 'all' };
  if (['browse', 'popular', 'hall', 'create'].includes(name)) return { name, phase: params.get('phase') || 'all' };
  return { name: 'home' };
}

function phaseOf(topic, now = Date.now()) {
  if (topic.gameVersion === 3) {
    if (now < ms(topic.entryDeadline)) return 'recruiting';
    if (now < ms(topic.prelimDeadline)) return 'prelim';
    if (topic.tournamentRound === 'semifinal' && now < ms(topic.semifinalDeadline)) return 'semifinal';
    if (topic.tournamentRound === 'final' && now < ms(topic.finalDeadline)) return 'final';
    if (topic.tournamentRound === 'closed') return 'closed';
    return 'transition';
  }
  if (topic.gameVersion === 2) {
    if (Date.now() < ms(topic.entryDeadline)) return 'recruiting';
    if (Date.now() < ms(topic.votingDeadline)) return 'voting';
    return 'closed';
  }
  return 'legacy';
}

function phaseLabel(topic, compact = false) {
  const phase = phaseOf(topic);
  if (phase === 'recruiting') return compact ? '출전 중' : `출전 중 · ${remaining(ms(topic.entryDeadline))}`;
  if (phase === 'prelim') return compact ? '익명 예선' : `익명 예선 · ${remaining(ms(topic.prelimDeadline))}`;
  if (phase === 'voting') return compact ? '비교 심사' : `비교 심사 · ${remaining(ms(topic.votingDeadline))}`;
  if (phase === 'semifinal') return compact ? '준결승' : `파이널4 · ${remaining(ms(topic.semifinalDeadline))}`;
  if (phase === 'final') return compact ? '최종 결승' : `최종 결승 · ${remaining(ms(topic.finalDeadline))}`;
  if (phase === 'transition') return '대진 확정 중';
  if (phase === 'closed') return topic.winnerText ? '챔피언 확정' : '경기 종료';
  return '자유 배틀';
}

function phaseDeadline(topic) {
  const phase = phaseOf(topic);
  if (phase === 'recruiting') return ms(topic.entryDeadline);
  if (phase === 'prelim') return ms(topic.prelimDeadline);
  if (phase === 'voting') return ms(topic.votingDeadline);
  if (phase === 'semifinal') return ms(topic.semifinalDeadline);
  if (phase === 'final') return ms(topic.finalDeadline);
  return 0;
}

function popularity(topic) {
  const votes = Math.max(0, Number(topic.pairVoteCount || topic.prelimVoteCount || 0));
  const finals = Math.max(0, Number(topic.tournamentVoteCount || 0));
  const entries = Math.max(0, Number(topic.commentCount || 0));
  const reactions = Math.max(0, Number(topic.topLikeCount || 0));
  return finals * 20 + votes * 10 + entries * 3 + reactions * 8;
}

async function fetchAllTopics(force = false) {
  if (!force && topicsCache && Date.now() - topicsCacheAt < 15000) return topicsCache;
  const documents = [];
  let cursor = null;
  let usedOrdering = true;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let snapshot;
    try {
      const constraints = [where('status', '==', 'visible')];
      if (usedOrdering) constraints.push(orderBy('createdAt', 'desc'));
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(PAGE_SIZE));
      snapshot = await getDocs(query(collection(db, 'dripso_topics'), ...constraints));
    } catch (error) {
      if (page === 0 && usedOrdering) {
        console.warn('Dripso ordered list unavailable; retrying without order:', error?.code || error);
        usedOrdering = false;
        cursor = null;
        continue;
      }
      throw error;
    }
    documents.push(...snapshot.docs);
    if (snapshot.size < PAGE_SIZE) break;
    cursor = snapshot.docs.at(-1);
  }
  topicsCache = documents
    .map(item => parsedTopic(item.id, item.data()))
    .filter(Boolean)
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  topicsCacheAt = Date.now();
  return topicsCache;
}

function setActiveNav(name) {
  const normalized = name === 'mode' ? 'browse' : name === 'topic' ? 'browse' : name;
  nav?.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === normalized;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function loading(message = '드립 배틀을 불러오는 중입니다.') {
  const card = el('section', 'loading-card v4-loading');
  card.setAttribute('aria-live', 'polite');
  card.append(el('span', 'loading-spinner', 'ㅋ'), el('p', '', message));
  return card;
}

function emptyState(title, description = '', action = null) {
  const card = el('section', 'empty-card v4-empty');
  card.append(el('span', 'empty-mark', 'ㅋ'), el('strong', '', title));
  if (description) card.append(el('p', '', description));
  if (action) card.append(action);
  return card;
}

function errorState(message) {
  const retry = el('button', 'secondary-button', '다시 불러오기');
  retry.type = 'button';
  retry.dataset.retryRoute = 'true';
  const card = el('section', 'error-card v4-empty');
  card.append(el('strong', '', '화면을 불러오지 못했습니다.'), el('p', '', message), retry);
  return card;
}

function officialBadge() {
  return el('span', 'official-battle-badge', '👑 드립소 공식 배틀');
}

function modeBadge(mode) {
  const meta = MODES[mode] || MODES.blank;
  return el('span', `type-badge battle-${mode}`, `${meta.icon} ${meta.label}`);
}

function statusChip(topic, compact = false) {
  const phase = phaseOf(topic);
  const chip = el('span', `battle-status-chip ${phase}`, phaseLabel(topic, compact));
  const deadline = phaseDeadline(topic);
  if (deadline && !compact) chip.dataset.deadline = String(deadline);
  return chip;
}

function topicCard(topic, options = {}) {
  const card = el('a', `topic-card battle-topic-card v4-topic-card${topic.official ? ' official-battle-card' : ''}`);
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;
  const top = el('div', 'topic-meta');
  top.append(modeBadge(topic.mode), statusChip(topic));
  card.append(top);
  if (topic.official) card.append(officialBadge());
  const imageUrl = safeImageUrl(topic.imageUrl);
  if (imageUrl) {
    const image = el('img', 'topic-card-image');
    image.src = imageUrl;
    image.alt = `${String(topic.title || '드립 배틀')} 첨부 이미지`;
    image.loading = 'lazy';
    image.decoding = 'async';
    card.append(image);
  }
  if (options.rank) card.append(el('span', 'hall-rank', `${options.rank}위`));
  card.append(el('h3', '', String(topic.title || `${MODES[topic.mode].label} 배틀`)));
  card.append(el('p', 'topic-card-prompt', String(topic.displayPrompt || '')));
  if (options.showWinner && (topic.winnerText || topic.leaderText)) {
    card.append(el('blockquote', 'hall-winner-preview', `“${String(topic.winnerText || topic.leaderText)}”`));
  }
  const stats = el('div', 'topic-stats');
  stats.append(
    el('span', '', `출전 ${Math.max(0, Number(topic.commentCount) || 0)}`),
    el('span', '', topic.gameVersion === 1
      ? `반응 ${Math.max(0, Number(topic.topLikeCount) || 0)}`
      : `심사 ${Math.max(0, Number(topic.pairVoteCount || topic.prelimVoteCount) || 0)}`),
    el('span', '', topic.official ? '공식 운영' : `판주 ${String(topic.nickname || '익명 드리퍼')}`)
  );
  card.append(stats);
  return card;
}

function topicList(items, emptyTitle, emptyDescription = '') {
  if (!items.length) return emptyState(emptyTitle, emptyDescription);
  const list = el('div', 'topic-list v4-topic-list');
  list.replaceChildren(...items.map(topic => topicCard(topic)));
  return list;
}

function sectionHeading(kicker, title, link = null) {
  const heading = el('div', 'section-heading v4-section-heading');
  const copy = el('div');
  copy.append(el('p', 'section-kicker', kicker), el('h2', '', title));
  heading.append(copy);
  if (link) heading.append(link);
  return heading;
}

function routeLink(text, href, className = 'text-link') {
  const link = el('a', className, text);
  link.href = href;
  return link;
}

function openButton(text = '배틀 열기', mode = 'blank', className = 'write-button') {
  const button = el('button', className, text);
  button.type = 'button';
  button.dataset.openDialog = mode;
  return button;
}

function phaseGroup(topic) {
  const phase = phaseOf(topic);
  if (phase === 'recruiting') return 'entry';
  if (['prelim', 'voting', 'semifinal', 'final', 'transition'].includes(phase)) return 'vote';
  if (phase === 'closed') return 'closed';
  return 'legacy';
}

function modeTile(mode) {
  const meta = MODES[mode];
  const tile = el('a', `battle-mode-tile mode-${mode}`);
  tile.href = `#/mode/${mode}`;
  tile.append(
    el('span', 'battle-mode-icon', meta.icon),
    el('strong', '', meta.label),
    el('small', '', meta.short),
    el('em', '', meta.example)
  );
  return tile;
}

async function renderHome() {
  setActiveNav('home');
  const topics = await fetchAllTopics();
  const active = topics.filter(topic => ['entry', 'vote'].includes(phaseGroup(topic)));
  const official = active.find(topic => topic.official) || topics.find(topic => topic.official && phaseGroup(topic) !== 'closed');
  const entryOpen = active.filter(topic => phaseGroup(topic) === 'entry' && topic.id !== official?.id).slice(0, 8);
  const voting = active.filter(topic => phaseGroup(topic) === 'vote' && topic.id !== official?.id).slice(0, 6);

  const hero = el('section', 'hero-card battle-hero v4-hero');
  hero.append(
    el('p', 'eyebrow', '10-SECOND COMEDY ARENA'),
    el('h1', '', '한 줄로 출전하고, 익명 투표로 챔피언을 정합니다.'),
    el('p', '', '작명처럼 쉽게 한마디만 쓰면 됩니다. 출전작은 결승 전까지 숨겨지고, 심사에서는 작성자 없이 두 작품만 비교합니다.')
  );
  const actions = el('div', 'battle-hero-actions');
  actions.append(routeLink('오늘의 경기 보기', '#/browse?phase=entry', 'primary-link'), openButton('내 배틀 열기', 'blank', 'secondary-button'));
  hero.append(actions);

  const spotlight = el('section', 'section-block official-spotlight-section');
  spotlight.append(sectionHeading('TODAY\'S OFFICIAL BATTLE', '오늘의 공식 경기'));
  if (official) {
    const wrap = el('div', 'official-spotlight');
    wrap.append(topicCard(official));
    const guide = el('aside', 'official-guide');
    guide.append(
      el('strong', '', '처음 오셨나요?'),
      el('p', '', '문제를 읽고 떠오른 한마디를 입력하면 출전 완료입니다. 다른 답은 마감 뒤 투표할 때 공개됩니다.'),
      routeLink('10초 만에 출전하기 →', `#/topic/${encodeURIComponent(official.id)}`, 'text-link')
    );
    wrap.append(guide);
    spotlight.append(wrap);
  } else {
    spotlight.append(emptyState('공식 경기를 준비하고 있습니다.', '회원 배틀을 먼저 열거나 잠시 뒤 다시 확인해 주세요.', openButton('첫 배틀 열기', 'blank', 'secondary-button')));
  }

  const modes = el('section', 'section-block');
  modes.append(sectionHeading('7 EASY MODES', '생각나는 방식부터 고르세요', routeLink('전체 배틀', '#/browse')));
  const modeGrid = el('div', 'battle-mode-grid');
  modeGrid.replaceChildren(...MODE_ORDER.map(modeTile));
  modes.append(modeGrid);

  const live = el('section', 'section-block');
  live.append(sectionHeading('ENTRY OPEN', '지금 출전할 수 있는 경기', routeLink('모두 보기', '#/browse?phase=entry')));
  live.append(topicList(entryOpen, '현재 추가 출전 경기 없음', '오늘의 공식 경기에서 먼저 한마디를 남겨보세요.'));

  const judge = el('section', 'section-block');
  judge.append(sectionHeading('ANONYMOUS VOTE', '지금 심사할 수 있는 경기', routeLink('심사 경기 보기', '#/browse?phase=vote')));
  judge.append(topicList(voting, '현재 심사 중인 경기 없음', '출전 마감 뒤 익명 비교심사가 시작됩니다.'));

  app.replaceChildren(hero, spotlight, modes, live, judge);
  startCountdowns();
  emitRendered('home');
}

function filterLink(label, href, active) {
  const link = el('a', active ? 'active' : '', label);
  link.href = href;
  if (active) link.setAttribute('aria-current', 'page');
  return link;
}

function filters(activeMode = '', phase = 'all') {
  const wrap = el('div', 'battle-filter-stack');
  const phases = el('nav', 'battle-filter-bar phase-filter-bar');
  const base = activeMode ? `#/mode/${activeMode}` : '#/browse';
  for (const [value, label] of [['all', '전체'], ['entry', '출전 중'], ['vote', '심사 중'], ['closed', '종료']]) {
    phases.append(filterLink(label, value === 'all' ? base : `${base}?phase=${value}`, phase === value));
  }
  const modes = el('nav', 'battle-filter-bar mode-filter-bar');
  modes.append(filterLink('모든 종목', phase === 'all' ? '#/browse' : `#/browse?phase=${phase}`, !activeMode));
  for (const mode of MODE_ORDER) {
    const meta = MODES[mode];
    const href = phase === 'all' ? `#/mode/${mode}` : `#/mode/${mode}?phase=${phase}`;
    modes.append(filterLink(`${meta.icon} ${meta.label}`, href, activeMode === mode));
  }
  wrap.append(phases, modes);
  return wrap;
}

async function renderBrowse(activeMode = '', requestedPhase = 'all') {
  setActiveNav(activeMode ? 'mode' : 'browse');
  browsePhase = ['entry', 'vote', 'closed'].includes(requestedPhase) ? requestedPhase : 'all';
  let topics = await fetchAllTopics();
  if (activeMode) topics = topics.filter(topic => topic.mode === activeMode);
  if (browsePhase !== 'all') topics = topics.filter(topic => phaseGroup(topic) === browsePhase);
  topics = topics.sort((a, b) => Number(b.official) - Number(a.official) || ms(b.createdAt) - ms(a.createdAt));
  const meta = activeMode ? MODES[activeMode] : null;

  const heading = el('section', 'page-heading battle-page-heading v4-page-heading');
  const copy = el('div', 'page-heading-copy');
  copy.append(
    el('p', 'section-kicker', meta ? `${meta.icon} BATTLE MODE` : 'ALL BATTLES'),
    el('h1', '', meta ? meta.label : '배틀찾기'),
    el('p', '', meta ? meta.short : '출전·심사·종료 상태와 일곱 종목을 한곳에서 골라보세요.')
  );
  heading.append(copy, openButton('＋ 배틀 열기', activeMode || 'blank'));

  const section = el('section', 'section-block browse-results');
  section.append(filters(activeMode, browsePhase));
  const summary = el('div', 'result-summary');
  summary.append(el('strong', '', `${topics.length}개 경기`), el('span', '', browsePhase === 'entry' ? '지금 출전 가능' : browsePhase === 'vote' ? '지금 심사 가능' : browsePhase === 'closed' ? '완료된 경기' : '전체 상태'));
  section.append(summary, topicList(topics, '조건에 맞는 배틀이 없습니다.', '다른 종목이나 상태를 선택해 보세요.'));
  app.replaceChildren(heading, section);
  startCountdowns();
  emitRendered('browse');
}

async function renderPopular() {
  setActiveNav('popular');
  const topics = [...await fetchAllTopics()].sort((a, b) => popularity(b) - popularity(a) || ms(b.updatedAt) - ms(a.updatedAt));
  const heading = el('section', 'page-heading v4-page-heading simple-heading');
  const copy = el('div', 'page-heading-copy');
  copy.append(el('p', 'section-kicker', '🔥 ACTIVE BATTLES'), el('h1', '', '지금 가장 뜨거운 경기'), el('p', '', '출전과 익명 심사 참여가 많은 경기부터 보여드립니다.'));
  heading.append(copy);
  const section = el('section', 'section-block');
  section.append(topicList(topics, '아직 참여 기록이 없습니다.', '첫 출전과 첫 심사를 남겨주세요.'));
  app.replaceChildren(heading, section);
  startCountdowns();
  emitRendered('popular');
}

async function renderHall() {
  setActiveNav('hall');
  const topics = [...await fetchAllTopics()]
    .filter(topic => phaseGroup(topic) === 'closed' && (topic.winnerText || topic.leaderText))
    .sort((a, b) => popularity(b) - popularity(a) || ms(b.updatedAt) - ms(a.updatedAt))
    .slice(0, 100);
  const heading = el('section', 'page-heading v4-page-heading hall-heading');
  const copy = el('div', 'page-heading-copy');
  copy.append(el('p', 'section-kicker', '🏆 HALL OF DRIP'), el('h1', '', '명예의전당'), el('p', '', '최종 우승이 확정된 작품만 기록합니다.'));
  heading.append(copy);
  const section = el('section', 'section-block');
  if (!topics.length) section.append(emptyState('아직 챔피언이 없습니다.', '첫 공식 경기의 결승이 끝나면 이곳에 기록됩니다.'));
  else {
    const list = el('div', 'topic-list hall-list');
    list.replaceChildren(...topics.map((topic, index) => topicCard(topic, { rank: index + 1, showWinner: true })));
    section.append(list);
  }
  app.replaceChildren(heading, section);
  emitRendered('hall');
}

function topicHero(topic) {
  const detail = el('section', `topic-detail battle-topic-detail v4-topic-detail${topic.official ? ' official-topic' : ''}`);
  const back = routeLink('← 배틀 목록으로', topic.mode ? `#/mode/${topic.mode}` : '#/browse', 'back-button');
  detail.append(back);
  const labels = el('div', 'topic-label-row');
  labels.append(modeBadge(topic.mode), statusChip(topic));
  if (topic.official) labels.append(officialBadge());
  detail.append(labels, el('h1', '', String(topic.title || `${MODES[topic.mode].label} 배틀`)));
  const imageUrl = safeImageUrl(topic.imageUrl);
  if (imageUrl) {
    const image = el('img', 'topic-detail-image');
    image.src = imageUrl;
    image.alt = `${topic.title || MODES[topic.mode].label} 첨부 이미지`;
    detail.append(image);
  }
  detail.append(el('p', 'topic-prompt battle-prompt', String(topic.displayPrompt || '')));
  detail.append(el('p', 'topic-author', topic.official ? `👑 드립소 공식 · ${String(topic.officialCategory || '오늘의 주제')}` : `판주 ${String(topic.nickname || '익명 드리퍼')}`));
  return detail;
}

function loginNotice(message) {
  const notice = el('div', 'login-notice');
  notice.append(`${message} `, routeLink('로그인하기', '/#/auth', 'text-link'));
  return notice;
}

function ownEntryCard(entry, note = '결승 종료 전까지 다른 사용자에게 공개되지 않습니다.') {
  if (!entry) return null;
  const card = el('article', 'comment-card own-battle-entry');
  card.dataset.commentId = String(entry.id || '');
  const meta = el('div', 'comment-meta');
  meta.append(el('span', 'best-rank', '내 출전작'), el('span', '', note));
  card.append(meta, el('p', 'comment-text', String(entry.text || '')));
  return card;
}

function entryComposer(topic, entry, version) {
  if (!isMember()) return loginNotice('블라인드 출전은 로그인 후 가능합니다.');
  const form = el('form', 'comment-form game-entry-form');
  form.dataset.entryTopic = topic.id;
  form.dataset.entryVersion = String(version);
  const area = el('textarea');
  area.name = 'text';
  area.required = true;
  area.rows = 2;
  area.maxLength = topic.mode === 'naming' ? 80 : 180;
  area.value = String(entry?.text || '');
  area.placeholder = MODES[topic.mode]?.entryPlaceholder || '짧고 강한 한마디를 입력해 주세요.';
  const footer = el('div', 'comment-form-footer');
  footer.append(el('small', '', entry ? '출전 마감 전까지 수정할 수 있습니다.' : '한 계정당 한 작품만 출전합니다.'));
  const button = el('button', 'comment-submit', entry ? '출전작 수정' : '블라인드 출전');
  button.type = 'submit';
  footer.append(button);
  form.append(area, footer);
  return form;
}

function phasePanel(topic, view, phase) {
  const info = {
    recruiting: ['🔒', '블라인드 출전', '다른 작품은 보이지 않으며 한 계정당 한 작품만 제출합니다.', Number(view.entryDeadlineMs || ms(topic.entryDeadline))],
    prelim: ['⚔️', '익명 1대1 예선', '작성자 없이 두 작품만 비교해 파이널4 시드를 정합니다.', Number(view.prelimDeadlineMs || ms(topic.prelimDeadline))],
    voting: ['⚔️', '익명 1대1 심사', '작성자 없이 두 작품만 보고 더 웃긴 한쪽을 선택합니다.', Number(view.votingDeadlineMs || ms(topic.votingDeadline))],
    semifinal: ['4️⃣', '파이널4 준결승', '예선 상위 네 작품이 결승 진출을 놓고 맞붙습니다.', Number(view.semifinalDeadlineMs || ms(topic.semifinalDeadline))],
    final: ['🏁', '최종 결승', '준결승 승자 두 작품 중 챔피언을 선택합니다.', Number(view.finalDeadlineMs || ms(topic.finalDeadline))],
    transition: ['⏳', '대진 확정 중', '예선 결과를 집계해 다음 대진을 만들고 있습니다.', 0],
    closed: ['🏆', '우승 확정', '경기가 끝나 챔피언과 전체 순위가 공개됐습니다.', 0]
  }[phase] || ['💬', '자유 배틀', '댓글 반응으로 순위를 정합니다.', 0];
  const panel = el('section', `battle-phase-panel tournament-phase ${phase}`);
  panel.append(el('span', 'battle-phase-icon', info[0]));
  const copy = el('div', 'battle-phase-copy');
  copy.append(el('strong', '', info[1]), el('p', '', info[2]));
  const stats = el('div', 'battle-phase-stats');
  const entryCount = Math.max(0, Number(view.entryCount ?? topic.commentCount) || 0);
  stats.append(el('span', '', `출전자 ${entryCount}명`));
  if (topic.gameVersion === 3) {
    stats.append(el('span', '', `예선 ${Math.max(0, Number(view.prelimVoteCount ?? topic.prelimVoteCount) || 0)}표`));
    stats.append(el('span', '', `결선 ${Math.max(0, Number(view.tournamentVoteCount ?? topic.tournamentVoteCount) || 0)}표`));
  } else if (topic.gameVersion === 2) {
    stats.append(el('span', '', `심사 ${Math.max(0, Number(view.pairVoteCount ?? topic.pairVoteCount) || 0)}회`));
  }
  if (info[3]) {
    const timer = el('span', 'battle-live-countdown', remaining(info[3]));
    timer.dataset.deadline = String(info[3]);
    stats.append(timer);
  }
  copy.append(stats);
  panel.append(copy);
  return panel;
}

function resultCard(entry, index, winnerId, version) {
  const winner = String(entry.id) === String(winnerId);
  const card = el('article', `comment-card game-result-card${winner ? ' battle-winner' : ''}`);
  card.dataset.commentId = String(entry.id || '');
  const meta = el('div', 'comment-meta');
  meta.append(el('span', winner ? 'best-rank' : '', winner ? '🏆 챔피언' : `${index + 1}위`), el('span', '', String(entry.nickname || '익명 드리퍼')));
  const score = version === 3
    ? `예선 선택 ${Math.max(0, Number(entry.prelimScore) || 0)}회 · 노출 ${Math.max(0, Number(entry.prelimDuels) || 0)}회`
    : `선택 ${Math.max(0, Number(entry.battleScore) || 0)}회 · 노출 ${Math.max(0, Number(entry.duelCount) || 0)}회`;
  card.append(meta, el('p', 'comment-text', String(entry.text || '')), el('div', 'battle-result-score', score));
  return card;
}

function winnerShowcase(winner) {
  const card = el('section', 'battle-winner-showcase tournament-champion');
  card.append(
    el('span', 'battle-winner-crown', '🏆'),
    el('p', 'section-kicker', 'DRIPSO CHAMPION'),
    el('blockquote', '', `“${String(winner.text || '')}”`),
    el('strong', '', String(winner.nickname || '익명 드리퍼'))
  );
  return card;
}

function tournamentBracket(view) {
  const matches = Array.isArray(view.matches) ? view.matches : [];
  if (!matches.length) return null;
  const section = el('section', 'tournament-bracket');
  section.append(el('p', 'section-kicker', 'FINAL FOUR BRACKET'), el('h2', '', '파이널 토너먼트 대진'));
  const grid = el('div', 'tournament-bracket-grid');
  for (const match of matches) {
    const card = el('article', `tournament-match ${match.round || ''} ${match.status || ''}`);
    const title = match.round === 'final' ? '최종 결승' : match.id === 'semi1' ? '준결승 1경기' : '준결승 2경기';
    card.append(el('strong', '', title));
    for (const side of ['left', 'right']) {
      const entry = match[side] || {};
      const row = el('div', `tournament-contender${match.winnerEntryId === entry.id ? ' winner' : ''}`);
      const seed = side === 'left' ? match.leftSeed : match.rightSeed;
      row.append(el('span', 'tournament-seed', seed ? `${seed}번` : '-'), el('p', '', String(entry.text || '대진 확정 중')));
      const vote = match[`${side}Votes`];
      if (Number.isFinite(Number(vote))) row.append(el('em', '', `${Number(vote)}표`));
      card.append(row);
    }
    grid.append(card);
  }
  section.append(grid);
  return section;
}

async function fillMatchup(topic, host, version, renderId) {
  if (!isMember()) {
    host.replaceChildren(loginNotice('익명 심사는 로그인 후 참여할 수 있습니다.'));
    return;
  }
  host.replaceChildren(loading('다음 두 작품을 고르는 중입니다.'));
  try {
    const response = version === 3
      ? await calls.getTournamentMatchup({ topicId: topic.id })
      : await calls.getV2Matchup({ topicId: topic.id });
    if (renderId !== routeToken || !host.isConnected) return;
    const data = response.data || {};
    if (data.completed) {
      const done = el('div', 'battle-vote-complete');
      done.append(el('span', '', '✅'), el('strong', '', '현재 가능한 심사를 완료했습니다.'), el('p', '', String(data.reason || '다른 경기의 심사에도 참여해 보세요.')));
      host.replaceChildren(done);
      return;
    }
    const duel = el('div', 'battle-duel tournament-duel');
    const heading = el('div', 'battle-duel-heading');
    heading.append(el('p', 'section-kicker', String(data.roundLabel || 'ANONYMOUS DUEL')), el('h2', '', '어느 쪽이 더 웃겼습니까?'));
    const choices = el('div', 'battle-duel-choices');
    for (const [letter, entry] of [['A', data.left], ['B', data.right]]) {
      const button = el('button', 'battle-duel-choice');
      button.type = 'button';
      button.dataset.matchupTopic = topic.id;
      button.dataset.matchupVersion = String(version);
      button.dataset.matchId = String(data.matchId || '');
      button.dataset.left = String(data.left?.id || '');
      button.dataset.right = String(data.right?.id || '');
      button.dataset.selected = String(entry?.id || '');
      button.append(el('span', 'battle-duel-letter', letter), el('p', '', String(entry?.text || '')));
      choices.append(button);
    }
    duel.append(heading, choices);
    host.replaceChildren(duel);
  } catch (error) {
    host.replaceChildren(errorState(errorText(error, '비교할 작품을 불러오지 못했습니다.')));
  }
}

async function renderTournamentTopic(topic, renderId) {
  const response = await calls.getTournamentView({ topicId: topic.id });
  if (renderId !== routeToken) return;
  const view = response.data || {};
  const phase = String(view.phase || phaseOf(topic));
  const detail = topicHero(topic);
  detail.append(phasePanel(topic, view, phase));
  const sections = [];

  if (phase === 'recruiting') {
    detail.append(entryComposer(topic, view.ownEntry, 3));
    const blind = el('section', 'section-block blind-entry-section');
    blind.append(sectionHeading('BLIND ENTRY', '내 출전 상태'));
    blind.append(ownEntryCard(view.ownEntry) || emptyState('아직 출전하지 않았습니다.', '위 입력창에 떠오른 한마디를 남겨주세요.'));
    sections.push(blind);
  } else if (['prelim', 'semifinal', 'final'].includes(phase)) {
    const mine = ownEntryCard(view.ownEntry);
    if (mine) detail.append(mine);
    const bracket = tournamentBracket(view);
    if (bracket) sections.push(bracket);
    const voting = el('section', 'section-block battle-voting-section');
    voting.append(sectionHeading('ANONYMOUS VOTE', phase === 'prelim' ? '1대1 예선 심사' : phase === 'semifinal' ? '파이널4 준결승 심사' : '최종 결승 심사'));
    const host = el('div', 'battle-matchup-host');
    voting.append(host);
    sections.push(voting);
    app.replaceChildren(detail, ...sections);
    startCountdowns();
    emitRendered('topic');
    await fillMatchup(topic, host, 3, renderId);
    return;
  } else if (phase === 'closed') {
    const entries = Array.isArray(view.entries) ? view.entries : [];
    const winner = view.winner || entries[0] || null;
    if (winner) detail.append(winnerShowcase(winner));
    const bracket = tournamentBracket(view);
    if (bracket) sections.push(bracket);
    const ranking = el('section', 'section-block');
    ranking.append(sectionHeading('FINAL RANKING', '최종 순위'));
    if (entries.length) {
      const list = el('div', 'comment-list');
      list.replaceChildren(...entries.map((entry, index) => resultCard(entry, index, winner?.id || '', 3)));
      ranking.append(list);
    } else ranking.append(emptyState('출전작이 없어 우승자를 정하지 못했습니다.'));
    sections.push(ranking);
  } else {
    const wait = el('section', 'section-block');
    wait.append(loading('다음 대진을 확정하고 있습니다.'));
    sections.push(wait);
    window.setTimeout(() => renderCurrentRoute(), 1500);
  }
  app.replaceChildren(detail, ...sections);
  startCountdowns();
  emitRendered('topic');
}

async function renderV2Topic(topic, renderId) {
  const response = await calls.getV2View({ topicId: topic.id });
  if (renderId !== routeToken) return;
  const view = response.data || {};
  const phase = String(view.phase || phaseOf(topic));
  const detail = topicHero(topic);
  detail.append(phasePanel(topic, view, phase));
  const sections = [];
  if (phase === 'recruiting') {
    detail.append(entryComposer(topic, view.ownEntry, 2));
    const blind = el('section', 'section-block');
    blind.append(sectionHeading('BLIND ENTRY', '내 출전 상태'));
    blind.append(ownEntryCard(view.ownEntry) || emptyState('아직 출전하지 않았습니다.'));
    sections.push(blind);
  } else if (phase === 'voting') {
    const mine = ownEntryCard(view.ownEntry);
    if (mine) detail.append(mine);
    const voting = el('section', 'section-block');
    voting.append(sectionHeading('ANONYMOUS VOTE', '1대1 비교심사'));
    const host = el('div', 'battle-matchup-host');
    voting.append(host);
    sections.push(voting);
    app.replaceChildren(detail, ...sections);
    startCountdowns();
    emitRendered('topic');
    await fillMatchup(topic, host, 2, renderId);
    return;
  } else {
    const entries = Array.isArray(view.entries) ? view.entries : [];
    const winner = view.winner || entries[0] || null;
    if (winner) detail.append(winnerShowcase(winner));
    const ranking = el('section', 'section-block');
    ranking.append(sectionHeading('FINAL RANKING', '최종 순위'));
    if (entries.length) {
      const list = el('div', 'comment-list');
      list.replaceChildren(...entries.map((entry, index) => resultCard(entry, index, winner?.id || '', 2)));
      ranking.append(list);
    } else ranking.append(emptyState('출전작이 없어 우승자를 정하지 못했습니다.'));
    sections.push(ranking);
  }
  app.replaceChildren(detail, ...sections);
  startCountdowns();
  emitRendered('topic');
}

async function loadLegacyComments(topicId) {
  const documents = [];
  let cursor = null;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const constraints = [where('status', '==', 'visible'), orderBy('createdAt', 'asc')];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(PAGE_SIZE));
      const snapshot = await getDocs(query(collection(db, `dripso_topics/${topicId}/comments`), ...constraints));
      documents.push(...snapshot.docs);
      if (snapshot.size < PAGE_SIZE) break;
      cursor = snapshot.docs.at(-1);
    }
  } catch (error) {
    console.warn('Ordered Dripso comments unavailable; loading a safe fallback page:', error?.code || error);
    const snapshot = await getDocs(query(
      collection(db, `dripso_topics/${topicId}/comments`),
      where('status', '==', 'visible'),
      limit(200)
    ));
    documents.splice(0, documents.length, ...snapshot.docs);
  }
  return documents.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0) || ms(a.createdAt) - ms(b.createdAt));
}

function legacyComposer(topic) {
  if (!isMember()) return loginNotice('출전과 반응은 로그인 후 가능합니다.');
  const form = el('form', 'comment-form');
  form.dataset.legacyEntry = topic.id;
  const area = el('textarea');
  area.name = 'text';
  area.required = true;
  area.rows = 2;
  area.maxLength = topic.mode === 'naming' ? 80 : 180;
  area.placeholder = MODES[topic.mode]?.entryPlaceholder || '짧고 강한 한마디를 입력해 주세요.';
  const footer = el('div', 'comment-form-footer');
  footer.append(el('small', '', `${profileNickname || '로그인 사용자'}로 출전합니다.`));
  const button = el('button', 'comment-submit', '이 한마디로 출전');
  button.type = 'submit';
  footer.append(button);
  form.append(area, footer);
  return form;
}

function legacyComment(topicId, comment, index) {
  const card = el('article', `comment-card${index < 3 ? ' best' : ''}`);
  card.dataset.commentId = comment.id;
  const meta = el('div', 'comment-meta');
  meta.append(el('span', index < 3 ? 'best-rank' : '', index < 3 ? `BEST ${index + 1}` : `#${index + 1}`), el('span', '', `${String(comment.nickname || '익명 드리퍼')} · ${formatDate(comment.createdAt)}`));
  const like = el('button', 'like-button', `❤️ 반응 ${Math.max(0, Number(comment.likeCount) || 0)}`);
  like.type = 'button';
  like.dataset.legacyLike = comment.id;
  like.dataset.topic = topicId;
  card.append(meta, el('p', 'comment-text', String(comment.text || '')), like);
  return card;
}

async function renderLegacyTopic(topic, renderId) {
  const comments = await loadLegacyComments(topic.id);
  if (renderId !== routeToken) return;
  const detail = topicHero(topic);
  detail.append(el('div', 'battle-rule-note', '기존 자유형 배틀 · 댓글 반응으로 순위를 정합니다.'), legacyComposer(topic));
  const section = el('section', 'section-block');
  section.append(sectionHeading('CROWD RANKING', '현재 반응 순위'));
  if (comments.length) {
    const list = el('div', 'comment-list');
    list.replaceChildren(...comments.map((comment, index) => legacyComment(topic.id, comment, index)));
    section.append(list);
  } else section.append(emptyState('아직 출전작이 없습니다.', '첫 한마디를 남겨주세요.'));
  app.replaceChildren(detail, section);
  emitRendered('topic');
}

async function renderTopic(topicId, renderId) {
  setActiveNav('topic');
  const snapshot = await getDoc(doc(db, 'dripso_topics', topicId));
  if (!snapshot.exists || snapshot.data()?.status !== 'visible') {
    app.replaceChildren(errorState('삭제되었거나 현재 볼 수 없는 배틀입니다.'));
    emitRendered('error');
    return;
  }
  const topic = parsedTopic(snapshot.id, snapshot.data());
  if (!topic) {
    app.replaceChildren(errorState('지원하지 않는 배틀 형식입니다.'));
    return;
  }
  if (topic.gameVersion === 3) await renderTournamentTopic(topic, renderId);
  else if (topic.gameVersion === 2) await renderV2Topic(topic, renderId);
  else await renderLegacyTopic(topic, renderId);
}

function applyMode(mode) {
  const selected = MODES[mode] ? mode : 'blank';
  modeSelect.value = selected;
  titleInput.placeholder = MODES[selected].titlePlaceholder;
  promptInput.placeholder = MODES[selected].promptPlaceholder;
}

function syncSubmitState() {
  submitButton.disabled = imageProcessing || submittingTopic;
  submitButton.textContent = imageProcessing ? '사진 처리 중…' : submittingTopic ? '배틀 여는 중…' : '파이널4 배틀 열기';
}

function setImageStatus(message = '', error = false) {
  imageStatus.textContent = message;
  imageStatus.classList.toggle('error', error);
}

function clearImage() {
  imageWorkToken += 1;
  selectedImageDataUrl = '';
  imageInput.value = '';
  imagePreviewImage.removeAttribute('src');
  imagePreview.hidden = true;
  imageProcessing = false;
  setImageStatus('');
  syncSubmitState();
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('사진 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('지원하지 않거나 손상된 사진입니다.'));
    image.src = url;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function compressImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('JPG, PNG, WEBP 사진만 첨부할 수 있습니다.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('원본 사진은 12MB 이하만 첨부할 수 있습니다.');
  const source = await imageFromUrl(await fileDataUrl(file));
  const sourceWidth = Math.max(1, Number(source.naturalWidth) || 1);
  const sourceHeight = Math.max(1, Number(source.naturalHeight) || 1);
  let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  for (let sizeTry = 0; sizeTry < 4; sizeTry += 1) {
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이 기기에서 사진을 처리할 수 없습니다.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    for (const quality of [0.84, 0.74, 0.64, 0.54]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob && blob.size <= MAX_UPLOAD_IMAGE_BYTES) return blob;
    }
    scale *= 0.78;
  }
  throw new Error('사진 용량을 줄이지 못했습니다. 다른 사진을 선택해 주세요.');
}

async function handleImage() {
  const file = imageInput.files?.[0];
  const token = ++imageWorkToken;
  selectedImageDataUrl = '';
  imagePreview.hidden = true;
  if (!file) return setImageStatus('');
  imageProcessing = true;
  setImageStatus('사진을 게시용 크기로 줄이는 중입니다.');
  syncSubmitState();
  try {
    const blob = await compressImage(file);
    const dataUrl = await fileDataUrl(blob);
    if (token !== imageWorkToken) return;
    selectedImageDataUrl = dataUrl;
    imagePreviewImage.src = dataUrl;
    imagePreview.hidden = false;
    setImageStatus(`사진 준비 완료 · 약 ${Math.max(1, Math.round(blob.size / 1024))}KB`);
  } catch (error) {
    if (token !== imageWorkToken) return;
    imageInput.value = '';
    setImageStatus(errorText(error, '사진을 처리하지 못했습니다.'), true);
    showToast(errorText(error, '사진을 처리하지 못했습니다.'));
  } finally {
    if (token === imageWorkToken) {
      imageProcessing = false;
      syncSubmitState();
    }
  }
}

function openDialog(mode = 'blank') {
  if (!isMember()) {
    showToast('판결소 계정으로 로그인한 뒤 배틀을 열 수 있습니다.');
    return;
  }
  applyMode(mode);
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => titleInput.focus(), 30);
}

function closeDialog() {
  if (dialog.open) dialog.close();
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
      node.textContent = remaining(deadline);
      if (deadline && Date.now() >= deadline) expired = true;
    });
    if (expired) {
      stopCountdowns();
      topicsCache = null;
      window.setTimeout(() => renderCurrentRoute(), 500);
    }
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}

async function renderCurrentRoute() {
  const renderId = ++routeToken;
  stopCountdowns();
  app.replaceChildren(loading());
  const current = route();
  try {
    if (current.name === 'home') await renderHome();
    else if (current.name === 'browse') await renderBrowse('', current.phase);
    else if (current.name === 'mode') await renderBrowse(current.mode, current.phase);
    else if (current.name === 'popular') await renderPopular();
    else if (current.name === 'hall') await renderHall();
    else if (current.name === 'topic') await renderTopic(current.id, renderId);
    else if (current.name === 'create') {
      await renderBrowse('', 'all');
      openDialog('blank');
    }
    if (renderId !== routeToken) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (error) {
    console.error('Dripso v4 render failed:', error);
    if (renderId === routeToken) {
      app.replaceChildren(errorState(errorText(error, '드립소 화면을 불러오지 못했습니다.')));
      emitRendered('error');
    }
  }
}

app.addEventListener('click', async event => {
  const retry = event.target.closest('[data-retry-route]');
  if (retry) return void renderCurrentRoute();

  const open = event.target.closest('[data-open-dialog]');
  if (open) return openDialog(open.dataset.openDialog || 'blank');

  const matchup = event.target.closest('[data-matchup-topic][data-selected]');
  if (matchup) {
    event.preventDefault();
    const host = matchup.closest('.battle-matchup-host');
    const buttons = [...host.querySelectorAll('[data-matchup-topic]')];
    buttons.forEach(button => { button.disabled = true; });
    const version = Number(matchup.dataset.matchupVersion) || 3;
    try {
      const payload = {
        topicId: matchup.dataset.matchupTopic,
        leftEntryId: matchup.dataset.left,
        rightEntryId: matchup.dataset.right,
        selectedEntryId: matchup.dataset.selected
      };
      if (version === 3) payload.matchId = matchup.dataset.matchId;
      if (version === 3) await calls.voteTournament(payload);
      else await calls.voteV2(payload);
      topicsCache = null;
      showToast('심사 결과를 반영했습니다.');
      const topicSnap = await getDoc(doc(db, 'dripso_topics', payload.topicId));
      const topic = parsedTopic(topicSnap.id, topicSnap.data());
      await fillMatchup(topic, host, version, routeToken);
    } catch (error) {
      showToast(errorText(error, '투표에 실패했습니다.'));
      buttons.forEach(button => { button.disabled = false; });
    }
    return;
  }

  const like = event.target.closest('[data-legacy-like][data-topic]');
  if (like) {
    if (!isMember()) return showToast('로그인 후 반응을 남길 수 있습니다.');
    like.disabled = true;
    try {
      const response = await calls.toggleLegacyLike({ topicId: like.dataset.topic, commentId: like.dataset.legacyLike });
      like.classList.toggle('active', response.data?.liked === true);
      like.textContent = `❤️ 반응 ${Math.max(0, Number(response.data?.likeCount) || 0)}`;
      topicsCache = null;
    } catch (error) {
      showToast(errorText(error, '반응 처리에 실패했습니다.'));
    } finally {
      like.disabled = false;
    }
  }
});

app.addEventListener('submit', async event => {
  const entryFormNode = event.target.closest('[data-entry-topic]');
  if (entryFormNode) {
    event.preventDefault();
    const text = String(entryFormNode.querySelector('textarea')?.value || '').trim();
    if (text.length < 2) return showToast('출전작을 2자 이상 입력해 주세요.');
    const button = entryFormNode.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const version = Number(entryFormNode.dataset.entryVersion) || 3;
      const response = version === 3
        ? await calls.submitTournament({ topicId: entryFormNode.dataset.entryTopic, text })
        : await calls.submitV2({ topicId: entryFormNode.dataset.entryTopic, text });
      topicsCache = null;
      showToast(response.data?.updated ? '출전작을 수정했습니다.' : '블라인드 출전을 완료했습니다.');
      await renderTopic(entryFormNode.dataset.entryTopic, routeToken);
    } catch (error) {
      showToast(errorText(error, '출전에 실패했습니다.'));
    } finally {
      button.disabled = false;
    }
    return;
  }

  const legacy = event.target.closest('[data-legacy-entry]');
  if (!legacy) return;
  event.preventDefault();
  const text = String(legacy.querySelector('textarea')?.value || '').trim();
  if (text.length < 2) return showToast('출전작을 2자 이상 입력해 주세요.');
  const button = legacy.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await calls.addLegacyComment({ topicId: legacy.dataset.legacyEntry, text });
    topicsCache = null;
    showToast('출전을 완료했습니다.');
    await renderTopic(legacy.dataset.legacyEntry, routeToken);
  } catch (error) {
    showToast(errorText(error, '출전에 실패했습니다.'));
  } finally {
    button.disabled = false;
  }
});

topicForm.addEventListener('submit', async event => {
  event.preventDefault();
  const mode = MODES[modeSelect.value] ? modeSelect.value : 'blank';
  const title = titleInput.value.trim();
  const prompt = promptInput.value.trim();
  if (title.length < 2 || prompt.length < 4) return showToast('제목과 문제를 조금 더 입력해 주세요.');
  if (imageProcessing) return showToast('사진 처리가 끝난 뒤 등록해 주세요.');
  submittingTopic = true;
  syncSubmitState();
  try {
    const response = await calls.createTournament({
      mode,
      title,
      prompt,
      entryMinutes: Number(entryDuration.value || 180),
      prelimMinutes: Number(prelimDuration.value || 180),
      finalsMinutes: Number(finalsDuration.value || 60),
      imageDataUrl: selectedImageDataUrl
    });
    const topicId = String(response.data?.topicId || '');
    if (!topicId) throw new Error('생성된 배틀 번호를 확인하지 못했습니다.');
    topicsCache = null;
    topicForm.reset();
    applyMode('blank');
    clearImage();
    closeDialog();
    showToast('파이널4 드립배틀을 열었습니다.');
    location.hash = `#/topic/${encodeURIComponent(topicId)}`;
  } catch (error) {
    showToast(errorText(error, '배틀을 열지 못했습니다.'));
  } finally {
    submittingTopic = false;
    syncSubmitState();
  }
});

modeSelect.addEventListener('change', () => applyMode(modeSelect.value));
imageInput.addEventListener('change', () => void handleImage());
imageRemove.addEventListener('click', clearImage);
openDialogButton.addEventListener('click', () => openDialog('blank'));
closeDialogButton.addEventListener('click', closeDialog);
dialog.addEventListener('click', event => {
  if (event.target === dialog) closeDialog();
});
window.addEventListener('hashchange', () => void renderCurrentRoute());
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    topicsCache = null;
    void renderCurrentRoute();
  }
});

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
  emitRendered('auth');
});

applyMode('blank');
syncSubmitState();
await initAuth().catch(error => console.warn('Dripso auth init failed:', error));
await renderCurrentRoute();
