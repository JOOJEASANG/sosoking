/* home.js */
import { auth, db, functions } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts, fetchTodayBest } from '../services/feed-service.js';
import {
  collection, collectionGroup, query, orderBy, limit, getDocs, where,
  doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';

const TYPE_LABEL = {
  ai_judge:     '⚖️ 판결소',
  ai_translate: '✨ 창작소',
  ai_naming:    '✨ 창작소',
};

const AI_KINGS = [
  { path: '/battle',   emoji: '🗳️', name: '정치배틀', desc: '7인 AI 정치인 토론·투표' },
  { path: '/parties',  emoji: '🏛️', name: '정당',     desc: '입당하고 정치력 쌓기' },
  { path: '/ai-judge', emoji: '⚖️', name: '판결소',   desc: '7인 중 3인 AI 판결' },
];

function getKstDateString(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function checkStreak(uid) {
  try {
    const today     = getKstDateString();
    const yesterday = getKstDateString(new Date(Date.now() - 86400000));
    const userRef   = doc(db, 'users', uid);
    const snap      = await getDoc(userRef);
    if (!snap.exists()) return;
    const { lastVisit = '', streak = 0 } = snap.data();
    if (lastVisit === today) return;
    const newStreak = lastVisit === yesterday ? streak + 1 : 1;
    await updateDoc(userRef, { lastVisit: today, streak: newStreak });
    appState.streak = newStreak;
  } catch { /* non-critical */ }
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function commentScore(comment) {
  const r = comment.reactions || {};
  return Number(r.funny || 0) * 3 + Number(r.fire || 0) * 2 + Number(r.like || 0) + Number(comment.likes || 0);
}

function moduleLabel(post) {
  return TYPE_LABEL[post.type] || TYPE_LABEL[post.feedType] || TYPE_LABEL[post.subtype] || '';
}

async function fetchPopularComments(n = 6) {
  try {
    const q = query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(80));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => {
        const data = d.data();
        return { id: d.id, postId: d.ref.parent?.parent?.id || data.postId || '', ...data, _score: commentScore(data) };
      })
      .filter(c => c.text && c.postId && !c.hidden)
      .sort((a, b) => b._score !== a._score ? b._score - a._score : (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, n);
  } catch { return []; }
}

async function fetchTodayBattle() {
  try {
    const getBattleStatus = httpsCallable(functions, 'getBattleStatus');
    const { data } = await getBattleStatus();
    return data;
  } catch { return null; }
}

function renderBattleCard(battle) {
  if (!battle) return '';
  const king = battle.currentKing;
  const kingText = king
    ? `${king.emoji} ${king.name}${king.streak > 1 ? ` · 🔥${king.streak}일 연속` : ''}`
    : '오늘의 당선자 미정';
  const previewTurns = (battle.turns || []).slice(0, 2);
  const totalVotes = battle.totalVotes || 0;

  return `
    <div class="home-battle-card" data-path="/battle">
      <div class="home-battle-card__head">
        <span class="home-battle-card__king">🏛️ ${escHtml(kingText)}</span>
        <span class="home-battle-card__status">${battle.exists ? (totalVotes > 0 ? `${totalVotes}표` : '투표중') : '준비중'}</span>
      </div>
      <div class="home-battle-card__topic">${escHtml(battle.topic || '오늘의 정치 스캔들')}</div>
      <div class="home-battle-card__preview">
        ${previewTurns.map(t =>
          `<div class="home-battle-card__line">${t.emoji} <b>${escHtml(t.charName || '')}</b> ${escHtml((t.text || '').slice(0, 35))}…</div>`
        ).join('')}
      </div>
      <div class="home-battle-card__cta">토론 보고 한 표 던지기 →</div>
    </div>`;
}

function renderHero() {
  const user = auth.currentUser;
  const nick = appState.nickname || user?.displayName || '';
  const streak = appState.streak || 0;

  return `
    <section class="home-hero-v3">
      <div class="home-hero-v3__top">
        <div class="home-hero-v3__badge">🏛️ 소소공화국</div>
        <h1 class="home-hero-v3__title">
          ${nick ? `${escHtml(nick)}님,<br>` : ''}오늘의 당선자는 누구? 🏛️
        </h1>
        <p class="home-hero-v3__sub">7인 AI 정치인의 매일 정쟁 — 당신의 한 표가 오늘의 당선자를 결정합니다</p>
        ${streak >= 2 ? `<div class="home-hero-v3__streak">🔥 ${streak}일 연속 방문 중!</div>` : ''}
      </div>

      <div class="home-aiking-grid">
        ${AI_KINGS.map(k => `
          <button class="home-aiking-card" data-path="${k.path}" type="button">
            <span class="home-aiking-card__emoji">${k.emoji}</span>
            <span class="home-aiking-card__name">${k.name}</span>
            <span class="home-aiking-card__desc">${k.desc}</span>
          </button>`).join('')}
      </div>

    </section>`;
}

function renderPopularPost(post, index) {
  const label = moduleLabel(post);
  return `
    <div class="home-rank-item" data-id="${post.id}">
      <div class="home-rank-item__num home-rank-item__num--${index < 3 ? index + 1 : 'rest'}">${index + 1}</div>
      <div class="home-rank-item__body">
        <div class="home-rank-item__type">${label}</div>
        <div class="home-rank-item__title">${escHtml(post.title || '제목 없음')}</div>
      </div>
      <div class="home-rank-item__stats">
        ${post.reactions?.total ? `<span>❤️ ${fmtNum(post.reactions.total)}</span>` : ''}
        ${post.commentCount    ? `<span>💬 ${fmtNum(post.commentCount)}</span>`    : ''}
      </div>
    </div>`;
}

function renderTodayBest(post) {
  if (!post) return '';
  return `
    <div class="home-today-best" data-id="${post.id}">
      <div class="home-today-best__label">⭐ 오늘의 베스트</div>
      <div class="home-today-best__title">${escHtml(post.title || '제목 없음')}</div>
      <div class="home-today-best__meta">
        <span class="home-today-best__room">${moduleLabel(post)}</span>
        ${post.reactions?.total ? `<span>❤️ ${fmtNum(post.reactions.total)}</span>` : ''}
        ${post.commentCount  ? `<span>💬 ${fmtNum(post.commentCount)}</span>` : ''}
      </div>
    </div>`;
}

function renderPopularComment(comment, index) {
  const timeStr = formatTime(comment.createdAt?.toDate?.() || comment.createdAt);
  const score = comment._score || 0;
  return `
    <button class="home-compact-feed-item" type="button" data-id="${comment.postId}">
      <span class="home-compact-feed-item__badge">💬 ${index + 1}</span>
      <span class="home-compact-feed-item__title">${escHtml(comment.text || '').slice(0, 100)}</span>
      <span class="home-compact-feed-item__meta">${escHtml(comment.authorName || '익명')} · ${timeStr}${score ? ` · 반응 ${fmtNum(score)}` : ''}</span>
    </button>`;
}

export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `<div class="home-dash page-enter home-dash--v2">
    <div class="skeleton" style="height:280px;border-radius:18px"></div>
    <div class="skeleton" style="height:200px;border-radius:18px;margin-top:16px"></div>
  </div>`;

  try {
    setMeta('소소킹 · 가상 정치 공화국');
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [hotPosts, popularComments, todayBest, battleData] = await Promise.all([
      fetchHotPosts(8),
      fetchPopularComments(6),
      fetchTodayBest(),
      fetchTodayBattle(),
    ]);

    const battleHTML = renderBattleCard(battleData);

    const bestHTML = todayBest ? `
      <div class="home-section-header" style="margin-bottom:8px">
        <span class="home-section-title">⭐ 오늘의 베스트</span>
      </div>
      ${renderTodayBest(todayBest)}` : '';

    const hotHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🔥 인기 모음</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.length
            ? hotPosts.map(renderPopularPost).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 없어요. 첫 번째가 되어보세요!</div></div>'}
        </div>
      </div>`;

    const commentsHTML = popularComments.length ? `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">💬 따끈한 댓글</span>
        </div>
        <div class="home-compact-feed-list">
          ${popularComments.map(renderPopularComment).join('')}
        </div>
      </div>` : '';

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${renderHero()}${battleHTML}${bestHTML}${hotHTML}${commentsHTML}</div>`;

    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed'));
    el.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
    el.querySelectorAll('[data-id]').forEach(item =>
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`))
    );
  } catch (err) {
    console.error('[home] renderHome error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">홈을 불러오지 못했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">다시 불러오기</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}
