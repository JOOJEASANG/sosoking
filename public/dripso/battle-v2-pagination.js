import { db } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const GAME_VERSION = 2;
const app = document.getElementById('dripso-app');
const MODE_MARKER = /^\[\[dripso-mode:([a-z-]+)\]\]\s*/i;
const MODE_META = Object.freeze({
  blank: { label: '빈칸채우기', icon: '🧩' },
  naming: { label: '이름붙이기', icon: '🏷️' },
  comeback: { label: '받아치기', icon: '↩️' },
  wrong: { label: '오답제출', icon: '❌' },
  headline: { label: '뉴스제목', icon: '📰' },
  excuse: { label: '변명대회', icon: '🥸' },
  manual: { label: '사용설명서', icon: '📘' }
});
let refreshVersion = 0;
let refreshTimer = 0;

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

function formatRemaining(millis) {
  const minutes = Math.max(0, Math.floor((millis - Date.now()) / 60000));
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  return minutes > 0 ? `${minutes}분` : '마감';
}

function currentRoute() {
  const value = (location.hash || '#/').replace(/^#\/?/, '');
  const [name = '', id = ''] = value.split('/');
  if (name === 'mode' && MODE_META[id]) return { name: 'mode', mode: id };
  if (['browse', 'popular', 'hall'].includes(name)) return { name };
  if (name === 'create') return { name: 'browse' };
  return null;
}

function routeKey(route) {
  return route.name === 'mode' ? `mode:${route.mode}` : route.name;
}

async function fetchAllPages(collectionRef, constraints) {
  const documents = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageQuery = query(
      collectionRef,
      ...constraints,
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE_SIZE)
    );
    const snapshot = await getDocs(pageQuery);
    documents.push(...snapshot.docs);
    if (snapshot.size < PAGE_SIZE) return documents;
    cursor = snapshot.docs.at(-1);
  }
  throw new Error('드립소 목록이 안전한 최대 조회 범위를 초과했습니다.');
}

function parsedTopic(document) {
  const topic = { id: document.id, ...document.data() };
  const rawPrompt = String(topic.prompt || '');
  const match = rawPrompt.match(MODE_MARKER);
  let mode = MODE_META[topic.mode] ? topic.mode : '';
  if (!mode && match && MODE_META[match[1]]) mode = match[1];
  if (!mode && topic.type === 'naming') mode = 'naming';
  if (!mode && topic.type === 'situation') mode = 'comeback';
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
  const entryDeadline = timestampMs(topic.entryDeadline);
  const votingDeadline = timestampMs(topic.votingDeadline);
  if (Date.now() < entryDeadline) return 'recruiting';
  if (Date.now() < votingDeadline) return 'voting';
  return 'closed';
}

function statusText(topic) {
  const phase = battlePhase(topic);
  if (phase === 'recruiting') return `출전중 · ${formatRemaining(timestampMs(topic.entryDeadline))}`;
  if (phase === 'voting') return `심사중 · ${formatRemaining(timestampMs(topic.votingDeadline))}`;
  if (phase === 'closed') return '경기 종료';
  return '자유 반응';
}

function safeImageUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'firebasestorage.googleapis.com'
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

function topicCard(topic, rank = 0) {
  const meta = MODE_META[topic.mode] || MODE_META.blank;
  const card = element('a', 'topic-card battle-topic-card');
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;
  const top = element('div', 'topic-meta');
  top.append(
    element('span', `type-badge battle-${topic.mode}`, `${meta.icon} ${meta.label}`),
    element('span', `battle-status-chip ${battlePhase(topic)}`, statusText(topic))
  );
  card.append(top);
  const imageUrl = safeImageUrl(topic.imageUrl);
  if (imageUrl) {
    const image = element('img', 'topic-card-image');
    image.src = imageUrl;
    image.alt = `${String(topic.title || '드립 배틀')} 첨부 이미지`;
    image.loading = 'lazy';
    image.decoding = 'async';
    card.append(image);
  }
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

function popularityScore(topic) {
  if (Number(topic.gameVersion) === GAME_VERSION) {
    return Math.max(0, Number(topic.pairVoteCount) || 0) * 10
      + Math.max(0, Number(topic.commentCount) || 0) * 3
      + Math.max(0, Number(topic.topBattleScore) || 0);
  }
  return Math.max(0, Number(topic.topLikeCount) || 0) * 10
    + Math.max(0, Number(topic.commentCount) || 0);
}

function replaceList(section, list, emptyText, key) {
  const existing = section.querySelector('.topic-list');
  const empty = section.querySelector('.empty-card');
  if (list.childElementCount) {
    list.dataset.paginationComplete = key;
    if (existing) existing.replaceWith(list);
    else if (empty) empty.replaceWith(list);
    else section.append(list);
  } else {
    const emptyNode = element('div', 'empty-card', emptyText);
    emptyNode.dataset.paginationComplete = key;
    if (existing) existing.replaceWith(emptyNode);
    else if (empty) empty.replaceWith(emptyNode);
    else section.append(emptyNode);
  }
}

async function refresh() {
  const route = currentRoute();
  if (!route) return;
  const version = ++refreshVersion;
  const docs = await fetchAllPages(collection(db, 'dripso_topics'), [
    where('status', '==', 'visible'),
    orderBy('createdAt', 'desc')
  ]);
  if (version !== refreshVersion) return;
  let topics = docs.map(parsedTopic).filter(Boolean);
  let ranked = false;
  if (route.name === 'mode') topics = topics.filter(topic => topic.mode === route.mode);
  else if (route.name === 'popular') {
    topics.sort((a, b) => popularityScore(b) - popularityScore(a) || timestampMs(b.updatedAt) - timestampMs(a.updatedAt));
  } else if (route.name === 'hall') {
    topics = topics
      .filter(topic => Number(topic.gameVersion) === GAME_VERSION && battlePhase(topic) === 'closed')
      .filter(topic => topic.winnerText || topic.leaderText)
      .sort((a, b) => popularityScore(b) - popularityScore(a) || timestampMs(b.updatedAt) - timestampMs(a.updatedAt))
      .slice(0, 30);
    ranked = true;
  }
  const section = [...app.querySelectorAll('.section-block')].at(-1);
  if (!section) return;
  const list = element('div', 'topic-list');
  list.replaceChildren(...topics.map((topic, index) => topicCard(topic, ranked ? index + 1 : 0)));
  replaceList(section, list, '아직 등록된 드립 배틀이 없습니다.', routeKey(route));
}

function paginationAlreadyApplied(route) {
  if (!route) return true;
  const key = routeKey(route);
  return Boolean(
    app.querySelector(`.topic-list[data-pagination-complete="${CSS.escape(key)}"]`)
    || app.querySelector(`.empty-card[data-pagination-complete="${CSS.escape(key)}"]`)
  );
}

function scheduleRefresh() {
  const route = currentRoute();
  if (!route || paginationAlreadyApplied(route)) return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refresh().catch(error => {
    console.error('Dripso battle v2 pagination failed:', error);
  }), 140);
}

new MutationObserver(scheduleRefresh).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  refreshVersion += 1;
  scheduleRefresh();
});
scheduleRefresh();
