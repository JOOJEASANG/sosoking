import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function getDetailId() {
  const match = (location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function safeVideoId(value) {
  const raw = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : '';
}

function extractYoutubeId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(/(?:youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (direct) return direct[1];
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return safeVideoId(url.pathname.split('/').filter(Boolean)[0]);
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (url.pathname.startsWith('/watch')) return safeVideoId(url.searchParams.get('v'));
      if (url.pathname.startsWith('/shorts/')) return safeVideoId(url.pathname.split('/')[2]);
      if (url.pathname.startsWith('/embed/')) return safeVideoId(url.pathname.split('/')[2]);
    }
  } catch {}
  return '';
}

function findVideoId(post = {}) {
  const youtube = post.modules?.youtube || {};
  return safeVideoId(youtube.videoId)
    || extractYoutubeId(youtube.url)
    || extractYoutubeId(youtube.embedUrl)
    || extractYoutubeId(post.youtubeUrl)
    || extractYoutubeId(post.videoUrl)
    || extractYoutubeId(post.desc)
    || '';
}

function renderYoutube(id) {
  const src = `https://www.youtube.com/embed/${id}`;
  return `
    <div class="detail-youtube-wrap detail-youtube-wrap--fallback" data-youtube-fallback="${id}">
      <iframe class="detail-youtube-frame" src="${src}" title="YouTube video player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
}

async function ensureYoutube() {
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || !root.querySelector('.detail-header')) return;
  if (root.querySelector('.detail-youtube-wrap')) return;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    const id = findVideoId(post);
    if (!id) return;
    const anchor = root.querySelector('.detail-gallery') || root.querySelector('.detail-header');
    anchor?.insertAdjacentHTML(anchor.classList.contains('detail-gallery') ? 'afterend' : 'afterend', renderYoutube(id));
  } catch (error) {
    console.warn('[detail-youtube-fallback] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureYoutube, 180);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
