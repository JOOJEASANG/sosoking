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
const app = document.getElementById('dripso-app');
let refreshVersion = 0;
let refreshTimer = 0;

const TYPE_META = {
  daily: { label: '오늘의 한줄', icon: '💬' },
  naming: { label: '이름짓기', icon: '🏷️' },
  situation: { label: '상황드립', icon: '🎭' }
};

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

function currentRoute() {
  const value = (location.hash || '#/').replace(/^#\/?/, '');
  const [name = '', id = ''] = value.split('/');
  if (name === 'topic' && id) {
    try {
      return { name: 'topic', id: decodeURIComponent(id) };
    } catch {
      return { name: 'home' };
    }
  }
  if (['daily', 'naming', 'situation', 'popular'].includes(name)) return { name };
  return { name: 'home' };
}

function routeKey(route) {
  return route.name === 'topic' ? `topic:${route.id}` : route.name;
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

function topicCard(topic) {
  const meta = TYPE_META[topic.type] || TYPE_META.daily;
  const card = element('a', 'topic-card');
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;

  const top = element('div', 'topic-meta');
  top.append(
    element('span', `type-badge ${topic.type || ''}`, `${meta.icon} ${meta.label}`),
    element('span', '', formatDate(topic.createdAt))
  );
  card.append(top);

  const imageUrl = safeImageUrl(topic.imageUrl);
  if (imageUrl) {
    const image = element('img', 'topic-card-image');
    image.src = imageUrl;
    image.alt = `${String(topic.title || '드립 주제')} 첨부 이미지`;
    image.loading = 'lazy';
    image.decoding = 'async';
    card.append(image);
  }

  const stats = element('div', 'topic-stats');
  stats.append(
    element('span', '', `💬 ${Math.max(0, Number(topic.commentCount) || 0)}`),
    element('span', '', `❤️ ${Math.max(0, Number(topic.topLikeCount) || 0)}`),
    element('span', '', `by ${String(topic.nickname || '익명 드리퍼')}`)
  );
  card.append(
    element('h3', '', String(topic.title || '제목 없는 주제')),
    element('p', '', String(topic.prompt || '')),
    stats
  );
  return card;
}

function commentCard(topicId, comment, index) {
  const card = element('article', `comment-card${index < 3 ? ' best' : ''}`);
  card.dataset.commentId = comment.id;
  const meta = element('div', 'comment-meta');
  meta.append(
    element('span', index < 3 ? 'best-rank' : '', index < 3 ? `BEST ${index + 1}` : `#${index + 1}`),
    element('span', '', `${String(comment.nickname || '익명 드리퍼')} · ${formatDate(comment.createdAt)}`)
  );
  const like = element('button', 'like-button', `❤️ 좋아요 ${Math.max(0, Number(comment.likeCount) || 0)}`);
  like.type = 'button';
  like.dataset.like = comment.id;
  like.dataset.topic = topicId;
  card.append(meta, element('p', 'comment-text', String(comment.text || '')), like);
  return card;
}

function replaceList(section, selector, list, emptyText, key) {
  const existing = section.querySelector(selector);
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

async function refreshTopics(route, version) {
  const docs = await fetchAllPages(collection(db, 'dripso_topics'), [
    where('status', '==', 'visible'),
    orderBy('createdAt', 'desc')
  ]);
  if (version !== refreshVersion) return;
  let topics = docs.map(document => ({ id: document.id, ...document.data() }));
  if (route.name === 'daily' || route.name === 'naming' || route.name === 'situation') {
    topics = topics.filter(topic => topic.type === route.name);
  } else if (route.name === 'popular') {
    topics.sort((a, b) =>
      Number(b.topLikeCount || 0) - Number(a.topLikeCount || 0)
      || Number(b.commentCount || 0) - Number(a.commentCount || 0)
      || timestampMs(b.updatedAt) - timestampMs(a.updatedAt)
    );
  } else {
    topics = topics.slice(0, 8);
  }

  const section = [...app.querySelectorAll('.section-block')].at(-1);
  if (!section) return;
  const list = element('div', 'topic-list');
  list.replaceChildren(...topics.map(topicCard));
  const emptyText = route.name === 'home'
    ? '아직 등록된 주제가 없습니다. 첫 드립판을 열어주세요.'
    : '아직 등록된 주제가 없습니다.';
  replaceList(section, '.topic-list', list, emptyText, routeKey(route));
}

async function refreshComments(route, version) {
  const docs = await fetchAllPages(collection(db, `dripso_topics/${route.id}/comments`), [
    where('status', '==', 'visible'),
    orderBy('likeCount', 'desc'),
    orderBy('createdAt', 'asc')
  ]);
  if (version !== refreshVersion) return;
  const comments = docs.map(document => ({ id: document.id, ...document.data() }));
  const section = [...app.querySelectorAll('.section-block')].at(-1);
  if (!section) return;
  const list = element('div', 'comment-list');
  list.replaceChildren(...comments.map((comment, index) => commentCard(route.id, comment, index)));
  const count = section.querySelector('.section-heading > span');
  const author = app.querySelector('.topic-author');
  if (count) count.textContent = `${comments.length}개`;
  if (author) author.textContent = author.textContent.replace(/댓글\s+\d+개$/, `댓글 ${comments.length}개`);
  replaceList(
    section,
    '.comment-list',
    list,
    '아직 댓글 드립이 없습니다. 첫 한마디를 남겨주세요.',
    routeKey(route)
  );
}

async function refresh() {
  const version = ++refreshVersion;
  const route = currentRoute();
  try {
    if (route.name === 'topic') await refreshComments(route, version);
    else await refreshTopics(route, version);
  } catch (error) {
    console.error('Dripso pagination refresh failed:', error);
  }
}

function paginationAlreadyApplied(route) {
  const key = routeKey(route);
  const selector = route.name === 'topic' ? '.comment-list' : '.topic-list';
  const list = app.querySelector(`${selector}[data-pagination-complete="${CSS.escape(key)}"]`);
  const empty = app.querySelector(`.empty-card[data-pagination-complete="${CSS.escape(key)}"]`);
  return Boolean(list || empty);
}

function scheduleRefresh() {
  const route = currentRoute();
  if (paginationAlreadyApplied(route)) return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refresh(), 120);
}

new MutationObserver(scheduleRefresh).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  refreshVersion += 1;
  scheduleRefresh();
});
scheduleRefresh();
