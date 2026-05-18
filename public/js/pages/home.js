/* home.js — 온보딩 + 대시보드형 홈 */
import { auth, db } from '../firebase.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { fetchHotPosts } from '../services/feed-service.js';
import {
  collection, query, orderBy, limit, getDocs,
  getCountFromServer, where, doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const QUICK_TYPES = [
  { key: 'vote',         icon: '🗳️', label: '골라킹',    desc: '투표 · 밸런스 · 선택지 배틀' },
  { key: 'naming',       icon: '😜', label: '미친작명소', desc: '사진이나 상황에 웃긴 이름 붙이기' },
  { key: 'initial_game', icon: '🔤', label: '초성게임',   desc: '초성을 보고 떠오르는 단어 참여' },
  { key: 'crazy_court',  icon: '⚖️', label: '억까재판',   desc: '유죄냐 무죄냐 억지 판결 놀이' },
  { key: 'relay',        icon: '🎭', label: '막장킹',     desc: '한 문장씩 터지는 막장 전개' },
  { key: 'acrostic',     icon: '✍️', label: '삼행시짓기', desc: '제시어로 삼·사·오행시 짓기' },
];

const DAILY_QUESTIONS = [
  { emoji: '🗳️', q: '치킨 vs 피자, 평생 하나만 먹어야 한다면?',              type: 'vote' },
  { emoji: '😂', q: '나만 이런가요? 밥 먹자마자 다음 끼니 고민함 😅',         type: 'vote' },
  { emoji: '⚖️', q: '늦잠 자서 지각한 건 진짜 억까 아닌가요? 재판 열어봐요', type: 'crazy_court' },
  { emoji: '🔤', q: '요즘 머릿속에 맴도는 단어, 초성만 살짝 올려봐요',        type: 'initial_game' },
  { emoji: '✍️', q: '오늘 기분 한 줄로? 소소킹으로 삼행시 어때요',            type: 'acrostic' },
  { emoji: '😜', q: '오늘 본 가장 황당한 장면에 이름 붙여봐요',               type: 'naming' },
  { emoji: '🎭', q: '오늘 있었던 황당한 일, 막장킹으로 이어쓰기 해봐요',      type: 'relay' },
  { emoji: '🗳️', q: '아침형 인간 vs 저녁형 인간, 당신은?',                   type: 'vote' },
  { emoji: '⚖️', q: '에어컨 온도 26도 vs 23도 — 지금 당장 억까재판 개정!',  type: 'crazy_court' },
  { emoji: '🔤', q: '주변에서 제일 자주 눈에 띄는 초성 3글자는 뭔가요?',      type: 'initial_game' },
  { emoji: '😜', q: '오늘 점심 메뉴에 기막힌 이름 하나만 붙여봐요',           type: 'naming' },
  { emoji: '🎭', q: '우리 팀장님은 오늘도... 막장 이야기 같이 이어써봐요',    type: 'relay' },
  { emoji: '🗳️', q: '라면 vs 떡볶이, 자정 야식 원탑은?',                    type: 'vote' },
  { emoji: '✍️', q: '이번 주 키워드로 삼행시 한 줄씩 모아봐요',              type: 'acrostic' },
];

function getDailyQuestion() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kst.getUTCFullYear(), 0, 1));
  const day = Math.floor((kst - start) / 86400000);
  return DAILY_QUESTIONS[day % DAILY_QUESTIONS.length];
}

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
  vote:'골라킹', initial_game:'초성게임',
  naming:'미친작명소', crazy_court:'억까재판',
  quiz:'미친퀴즈', relay:'막장킹', acrostic:'삼행시짓기',
  // 구형 타입 레이블 유지 (기존 데이터 호환)
  balance:'골라킹', battle:'골라킹', drip:'한줄드립', random_battle:'랜덤대결',
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

    const dq = getDailyQuestion();
    const dailyHTML = `
      <div class="home-daily" data-type-quick="${escHtml(dq.type)}" data-q="${escHtml(dq.q)}">
        <div class="home-daily__left">
          <div class="home-daily__badge">오늘의 소소한 질문 ✨</div>
          <div class="home-daily__q">${dq.emoji} ${escHtml(dq.q)}</div>
        </div>
        <button class="home-daily__btn">올리기 →</button>
      </div>`;

    const quickHTML = `
      <div class="home-section-header">
        <span class="home-section-title">⚡ 대표 놀이 만들기</span>
        <span class="home-section-sub">뭘 올릴지 모르겠다면 위 질문부터 🙂</span>
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
        ${dailyHTML}
        ${quickHTML}
        ${rankHTML}
        ${recentHTML}
      </div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write'));
    el.querySelector('#hbtn-join')?.addEventListener('click',  () => navigate('/login'));
    el.querySelector('#hbtn-feed')?.addEventListener('click',  () => navigate('/feed'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/feed'); });
    el.querySelector('#hbtn-more-recent')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/feed'); });

    el.querySelectorAll('[data-type-quick]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/write?type=${btn.dataset.typeQuick}`));
    });
    el.querySelector('.home-daily')?.addEventListener('click', function() {
      const q = encodeURIComponent(this.dataset.q || '');
      navigate(`/write?type=${this.dataset.typeQuick}&ai=1&q=${q}`);
    });
    el.querySelectorAll('[data-id]').forEach(item => {
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`));
    });

  } catch (err) {
    console.error('[home] renderHome error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">앗, 잠깐 오류가 났어요 😅</div>
        <div class="empty-state__desc">잠시 후 다시 시도해볼까요?</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">다시 불러오기</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}