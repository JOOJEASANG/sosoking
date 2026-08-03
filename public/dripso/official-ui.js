import { db } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const app = document.getElementById('dripso-app');
let officialTopics = new Map();
let loadPromise = null;
let loadedAt = 0;
let scheduled = 0;

function topicIdFromHref(value) {
  const match = String(value || '').match(/#\/topic\/([^?#]+)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); }
  catch { return ''; }
}

function officialBadge() {
  const badge = document.createElement('span');
  badge.className = 'official-battle-badge';
  badge.textContent = '👑 드립소 공식 배틀';
  return badge;
}

async function loadOfficialTopics(force = false) {
  if (!force && loadPromise && Date.now() - loadedAt < 5 * 60 * 1000) return loadPromise;
  loadPromise = getDocs(query(
    collection(db, 'dripso_topics'),
    where('status', '==', 'visible'),
    where('official', '==', true),
    limit(60)
  )).then(snapshot => {
    officialTopics = new Map(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
    loadedAt = Date.now();
    return officialTopics;
  }).catch(error => {
    console.warn('Official Dripso topics could not be loaded:', error);
    return officialTopics;
  });
  return loadPromise;
}

function decorateCards() {
  app.querySelectorAll('a.topic-card[href*="#/topic/"]').forEach(card => {
    const topicId = topicIdFromHref(card.getAttribute('href'));
    if (!officialTopics.has(topicId)) return;
    card.classList.add('official-battle-card');
    if (!card.querySelector('.official-battle-badge')) {
      const heading = card.querySelector('h3');
      if (heading) heading.insertAdjacentElement('beforebegin', officialBadge());
      else card.prepend(officialBadge());
    }
    const stats = card.querySelector('.topic-stats');
    const owner = stats ? [...stats.children].find(node => node.textContent?.startsWith('판주 ')) : null;
    if (owner) owner.textContent = '공식 운영';
  });

  app.querySelectorAll('.topic-list').forEach(list => {
    const cards = [...list.children].filter(node => node.matches?.('a.topic-card'));
    if (cards.length < 2) return;
    const sorted = [...cards].sort((left, right) =>
      Number(right.classList.contains('official-battle-card')) - Number(left.classList.contains('official-battle-card'))
    );
    const changed = cards.some((card, index) => card !== sorted[index]);
    if (changed) sorted.forEach(card => list.append(card));
  });
}

async function decorateDetail() {
  const match = (location.hash || '').match(/^#\/topic\/([^/?#]+)/);
  if (!match) return;
  let topicId = '';
  try { topicId = decodeURIComponent(match[1]); }
  catch { return; }

  let topic = officialTopics.get(topicId);
  if (!topic) {
    const snapshot = await getDoc(doc(db, 'dripso_topics', topicId)).catch(() => null);
    if (!snapshot?.exists() || snapshot.data()?.official !== true) return;
    topic = { id: snapshot.id, ...snapshot.data() };
    officialTopics.set(topicId, topic);
  }

  const detail = app.querySelector('.topic-detail');
  if (!detail || detail.querySelector('.official-battle-badge')) return;
  const title = detail.querySelector('h1');
  if (title) title.insertAdjacentElement('beforebegin', officialBadge());
  const author = detail.querySelector('.topic-author');
  if (author) author.textContent = `👑 드립소 공식 · ${String(topic.officialCategory || '오늘의 주제')}`;
}

async function decorate() {
  await loadOfficialTopics();
  decorateCards();
  await decorateDetail();
}

function schedule() {
  window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => void decorate(), 80);
}

new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
schedule();
