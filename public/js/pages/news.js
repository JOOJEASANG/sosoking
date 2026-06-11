/* news.js — 소소신문 전용 페이지 */
import { db, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const KST_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function kstDateStr(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-');
  const dt = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  const day = KST_NAMES[dt.getDay()];
  return `${Number(m)}월 ${Number(d)}일 (${day})`;
}

function isToday(dateKey) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKey = kst.toISOString().slice(0, 10);
  return dateKey === todayKey;
}

function renderFeaturedArticle(news) {
  const dateLabel = news.date ? kstDateStr(news.date) : '';
  const todayBadge = news.date && isToday(news.date)
    ? `<span class="news-badge news-badge--today">오늘</span>`
    : `<span class="news-badge">${escHtml(dateLabel)}</span>`;
  return `
    <div class="news-featured">
      <div class="news-featured__masthead">
        <span class="news-featured__logo">📰 소소신문</span>
        ${todayBadge}
      </div>
      <h1 class="news-featured__headline">${escHtml(news.headline)}</h1>
      ${news.body ? `<p class="news-featured__body">${escHtml(news.body)}</p>` : ''}
      <div class="news-featured__footer">소소공화국 공식 일간지</div>
    </div>`;
}

function renderArchiveItem(news) {
  const dateLabel = kstDateStr(news.date);
  return `
    <div class="news-archive-item">
      <span class="news-archive-item__date">${escHtml(dateLabel)}</span>
      <p class="news-archive-item__headline">${escHtml(news.headline || '기사 없음')}</p>
      ${news.body ? `<p class="news-archive-item__body">${escHtml(news.body)}</p>` : ''}
    </div>`;
}

async function fetchTodayNews() {
  try {
    const fn = httpsCallable(functions, 'getDailyNews');
    const { data } = await fn();
    return (data && data.headline) ? data : null;
  } catch { return null; }
}

async function fetchNewsArchive(excludeDate) {
  try {
    const snap = await getDocs(
      query(collection(db, 'daily_news'), orderBy('date', 'desc'), limit(14))
    );
    return snap.docs
      .map(d => ({ date: d.id, ...d.data() }))
      .filter(n => n.date !== excludeDate && n.headline);
  } catch { return []; }
}

export async function renderNews() {
  setMeta('소소신문 — 소소공화국 일간지', '소소공화국의 오늘과 역사를 전하는 소소신문');

  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="news-page page-enter">
      <div class="news-page__inner">
        <div class="news-loading">
          <span class="news-loading__icon">📰</span>
          <span>소소신문 불러오는 중…</span>
        </div>
      </div>
    </div>`;

  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKey = kst.toISOString().slice(0, 10);
  const [todayNews, archiveData] = await Promise.all([
    fetchTodayNews(),
    fetchNewsArchive(todayKey),
  ]);

  const featuredHTML = todayNews
    ? renderFeaturedArticle(todayNews)
    : `<div class="news-empty">
        <div class="news-empty__icon">🗞️</div>
        <div class="news-empty__text">오늘의 소소신문을 준비 중이에요</div>
        <div class="news-empty__sub">잠시 후 다시 확인해 주세요</div>
      </div>`;

  const archiveHTML = archiveData.length
    ? `<section class="news-archive">
        <h2 class="news-archive__title">📁 지난 호</h2>
        <div class="news-archive__list">
          ${archiveData.map(renderArchiveItem).join('')}
        </div>
      </section>`
    : '';

  el.innerHTML = `
    <div class="news-page page-enter">
      <div class="news-page__inner">
        ${featuredHTML}
        ${archiveHTML}
      </div>
    </div>`;
}
