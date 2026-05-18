/* home.js — 온보딩 + 대시보드형 홈 */
import { auth, db } from '../firebase.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
  getCountFromServer, where, doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const QUICK_TYPES = [
  { key: 'vote',         icon: '🗳️', label: '골라킹',   desc: '투표 · 밸런스 · 선택지 배틀' },
  { key: 'naming',       icon: '😜', label: '미친작명소', desc: '사진이나 상황에 웃긴 이름 붙이기' },
  { key: 'initial_game', icon: '🔤', label: '초성게임', desc: '초성을 보고 떠오르는 단어 참여' },
  { key: 'quiz',         icon: '🧠', label: '미친퀴즈', desc: '객관식/주관식 자유 퀴즈' },
  { key: 'crazy_court',  icon: '⚖️', label: '억까재판', desc: '유죄냐 무죄냐 억지 판결 놀이' },
  { key: 'relay',        icon: '🎭', label: '막장킹',   desc: '한 문장씩 터지는 막장 전개' },
];

const WEEKLY_WORDS = [
  '소소킹', '킹받네', '라면왕', '웃참패',
  '월요일', '퇴근길', '대반전', '편의점',
  '고양이', '배달비', '알바생', '휴대폰',
  '아메리카노', '지하철역', '치킨게임', '퇴근요정',
  '소확행러', '월급루팡', '반전매력', '웃음버튼',
];

function getPoemType(word) {
  const len = [...String(word || '')].length;
  return ({ 3: '삼행시', 4: '사행시', 5: '오행시', 6: '육행시' })[len] || '삼행시';
}

function getWeeklyWord() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kst.getUTCFullYear(), 0, 1));
  const week = Math.floor(Math.floor((kst - start) / 86400000) / 7);
  return WEEKLY_WORDS[week % WEEKLY_WORDS.length];
}

async function checkStreak(uid) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const { lastVisit = '', streak = 0 } = snap.data();
    if (lastVisit === today) return;
    const newStreak = lastVisit === yesterday ? streak + 1 : 1;
    await updateDoc(userRef, { lastVisit: today, streak: newStreak });
    appState.streak = newStreak;
  } catch { /* non-critical */ }
}

async function fetchStats() {
  try {
    const [totalSnap, todaySnap] = await Promise.all([
      getCountFromServer(collection(db, 'feeds')),
      getCountFromServer(query(collection(db, 'feeds'), where('createdAt', '>=', new Date(new Date().setHours(0, 0, 0, 0))))),
    ]);
    return { total: totalSnap.data().count, today: todaySnap.data().count };
  } catch { return { total: 0, today: 0 }; }
}

async function fetchHotPosts(n = 5) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(60));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.hidden)
      .sort((a, b) => {
        const score = p => (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3;
        return score(b) - score(a);
      })
      .slice(0, n);
  } catch { return []; }
}

async function fetchRecentPosts(n = 6) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden).slice(0, n);
  } catch { return []; }
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

const TYPE_LABEL = {
  balance:'골라킹', vote:'골라킹', battle:'골라킹',
  naming:'미친작명소', initial_game:'초성게임', acrostic:'미션 행시', drip:'한줄드립',
  ox:'OX퀴즈', quiz:'미친퀴즈', crazy_court:'억까재판', relay:'막장킹', random_battle:'랜덤대결',
};

export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="home-dash page-enter">
      <div class="skeleton" style="height:160px;border-radius:18px"></div>
      <div class="home-stat-row">${[1,2,3].map(()=>`<div class="skeleton" style="height:80px;border-radius:14px"></div>`).join('')}</div>
      <div class="skeleton" style="height:100px;border-radius:16px"></div>
      <div class="home-quick-grid">${[1,2,3,4,5,6].map(()=>`<div class="skeleton" style="height:90px;border-radius:14px"></div>`).join('')}</div>
    </div>`;

  try {
    setMeta();
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [stats, hotPosts, recentPosts] = await Promise.all([
      fetchStats(),
      fetchHotPosts(5),
      fetchRecentPosts(6),
    ]);

    const streak = appState.streak || 0;
    const weeklyWord = getWeeklyWord();
    const poemType = getPoemType(weeklyWord);

    const heroHTML = user ? `
      <div class="home-hero home-hero--user">
        ${streak > 1 ? `<div class="home-hero__streak">🔥 ${streak}일 연속 출석 중!</div>` : ''}
        <div class="home-hero__title">대표 놀이만 가볍게,<br>오늘도 소소하게 👋</div>
        <div class="home-hero__sub">골라킹, 미친작명소, 초성게임, 미친퀴즈, 억까재판, 막장킹으로 바로 참여해보세요.</div>
        <div class="home-hero__actions">
          <button class="btn btn--primary" id="hbtn-write">✏️ 놀이판 만들기</button>
          <button class="btn btn--ghost home-hero__ghost-btn" id="hbtn-feed">탐색하기</button>
        </div>
      </div>` : `
      <div class="home-hero home-hero--guest">
        <div class="home-hero__badge">✨ 소소킹에 오신 걸 환영해요!</div>
        <div class="home-hero__title">딱 필요한 대표 놀이<br>6가지 🎉</div>
        <div class="home-hero__sub">퀴즈부터 억까재판까지, 복잡하지 않게 바로 참여할 수 있어요.</div>
        <div class="home-hero__actions">
          <button class="home-hero__cta-btn" id="hbtn-join">지금 시작하기 →</button>
          <button class="btn btn--ghost home-hero__ghost-btn" id="hbtn-feed">먼저 둘러보기</button>
        </div>
      </div>`;

    const statsHTML = `
      <div class="home-stat-row">
        <div class="home-stat-card">
          <div class="home-stat-card__num">${fmtNum(stats.total)}</div>
          <div class="home-stat-card__label">📋 총 놀이판</div>
        </div>
        <div class="home-stat-card">
          <div class="home-stat-card__num">${fmtNum(stats.today)}</div>
          <div class="home-stat-card__label">🌅 오늘 새 글</div>
        </div>
        <div class="home-stat-card">
          <div class="home-stat-card__num">${QUICK_TYPES.length}가지</div>
          <div class="home-stat-card__label">🎮 대표 유형</div>
        </div>
      </div>`;

    const missionHTML = `
      <div class="home-mission-banner">
        <div class="home-mission-banner__left">
          <div class="home-mission-banner__eyebrow">✍️ 이번 주 ${poemType} 챌린지</div>
          <div class="home-mission-banner__word">${escHtml(weeklyWord)}</div>
          <div class="home-mission-banner__chars">
            ${[...weeklyWord].map(ch => `<span class="home-mission-banner__char">${escHtml(ch)}</span>`).join('')}
            <span class="home-mission-banner__chars-hint">로 ${poemType}를!</span>
          </div>
        </div>
        <div class="home-mission-banner__right">
          <button class="btn btn--primary btn--sm" id="hbtn-acrostic">도전하기</button>
          <div class="home-mission-banner__more" id="hbtn-mission-link">미션 더보기 →</div>
        </div>
      </div>`;

    const quickHTML = `
      <div class="home-section-header">
        <span class="home-section-title">⚡ 대표 놀이 만들기</span>
        <span class="home-section-sub">운영 유형을 6개로 단순화했어요</span>
      </div>
      <div class="home-quick-grid">
        ${QUICK_TYPES.map(t => `
          <button class="home-quick-btn" data-type-quick="${escHtml(t.key)}" title="${escHtml(t.desc)}">
            <span class="home-quick-btn__icon">${t.icon}</span>
            <span class="home-quick-btn__label">${escHtml(t.label)}</span>
          </button>`).join('')}
      </div>`;

    const rankHTML = hotPosts.length ? `
      <div class="home-section-header">
        <span class="home-section-title">🏆 이번 주 베스트</span>
        <a class="home-section-more" id="hbtn-more-hot">전체 보기 →</a>
      </div>
      <div class="home-rank-list">
        ${hotPosts.map((p, i) => `
          <div class="home-rank-item" data-id="${p.id}">
            <div class="home-rank-item__num home-rank-item__num--${i < 3 ? i+1 : 'rest'}">${i + 1}</div>
            <div class="home-rank-item__body">
              <div class="home-rank-item__type">${TYPE_LABEL[p.type] || p.type}</div>
              <div class="home-rank-item__title">${escHtml(p.title || '제목 없음')}</div>
            </div>
            <div class="home-rank-item__stats">
              ${p.reactions?.total ? `<span>❤️ ${p.reactions.total}</span>` : ''}
              ${p.commentCount ? `<span>💬 ${p.commentCount}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>` : '';

    const recentHTML = recentPosts.length ? `
      <div class="home-section-header">
        <span class="home-section-title">✨ 방금 올라온 글</span>
        <a class="home-section-more" id="hbtn-more-recent">더 보기 →</a>
      </div>
      <div class="home-recent-grid">
        ${recentPosts.map(p => renderFeedCard(p)).join('')}
      </div>` : '';

    el.innerHTML = `
      <div class="home-dash page-enter">
        ${heroHTML}
        ${statsHTML}
        ${missionHTML}
        ${quickHTML}
        ${rankHTML}
        ${recentHTML}
      </div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write'));
    el.querySelector('#hbtn-join')?.addEventListener('click',  () => navigate('/login'));
    el.querySelector('#hbtn-feed')?.addEventListener('click',  () => navigate('/feed'));
    el.querySelector('#hbtn-acrostic')?.addEventListener('click', () => navigate(`/write?type=acrostic&keyword=${encodeURIComponent(weeklyWord)}`));
    el.querySelector('#hbtn-mission-link')?.addEventListener('click', () => navigate('/mission'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/feed'); });
    el.querySelector('#hbtn-more-recent')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/feed'); });

    el.querySelectorAll('[data-type-quick]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/write?type=${btn.dataset.typeQuick}`));
    });
    el.querySelectorAll('[data-id]').forEach(item => {
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`));
    });

  } catch (err) {
    console.error('[home] renderHome error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">로딩 중 오류가 발생했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">새로고침</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}