import { navigate } from '../router.js';
import { auth, db, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';

const EARN_ITEMS = [
  { icon: '🎁', action: '첫 가입 보너스',             pts: '+500P', id: 'signup',  cta: '받기' },
  { icon: '📅', action: '매일 출석 체크',              pts: '+20P',  id: 'daily',   cta: '받기' },
  { icon: '📅', action: '출석 체크 (당대표)',           pts: '+30P',  note: '당대표 보너스' },
  { icon: '🗳️', action: '정치배틀 투표',              pts: '+5P' },
  { icon: '🗳️', action: '대통령 선거 투표',           pts: '+5P',   note: '선거일 +10P' },
  { icon: '🚨', action: '주간 정치 위기 투표',         pts: '+5P' },
  { icon: '✍️', action: '탄핵 청원 서명',             pts: '+5P' },
  { icon: '⭐', action: '포고령 평가',                pts: '+3P' },
  { icon: '❓', action: '대통령에게 질문',             pts: '+3P' },
  { icon: '📝', action: '글 작성',                    pts: '+10P' },
  { icon: '💬', action: '댓글 작성',                  pts: '+20P' },
  { icon: '👍', action: '댓글에 반응',                pts: '+1P' },
  { icon: '❤️', action: '내 글에 반응 받기',           pts: '+1P' },
  { icon: '🪜', action: '사다리게임 보너스 (하루 1회)', pts: 'AI 추가권 1회' },
];

const RANK_LEVELS = [
  { min: 0,     label: '평민',     emoji: '👤', color: '#9ca3af' },
  { min: 100,   label: '동민',     emoji: '🏡', color: '#6b7280' },
  { min: 300,   label: '향사',     emoji: '📜', color: '#78716c' },
  { min: 700,   label: '군수',     emoji: '🏛️', color: '#b45309' },
  { min: 1500,  label: '부사',     emoji: '⚔️', color: '#7c3aed' },
  { min: 3000,  label: '사대부',   emoji: '🎓', color: '#2563eb' },
  { min: 6000,  label: '당대표',   emoji: '👑', color: '#d97706' },
  { min: 12000, label: '국무총리', emoji: '🏅', color: '#dc2626' },
  { min: 25000, label: '대통령',   emoji: '🌟', color: '#FF4B2B' },
];

function getRank(pts) {
  let rank = RANK_LEVELS[0];
  for (const r of RANK_LEVELS) { if (pts >= r.min) rank = r; }
  const idx = RANK_LEVELS.indexOf(rank);
  const next = RANK_LEVELS[idx + 1] || null;
  return { ...rank, next };
}

function esc(v) {
  return String(v || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function renderRankCard(points) {
  const rank = getRank(points);
  const nextMin = rank.next ? rank.next.min : null;
  const toNext = nextMin ? nextMin - points : null;
  const pct = rank.next
    ? Math.min(100, Math.round(((points - rank.min) / (rank.next.min - rank.min)) * 100))
    : 100;
  return `<div class="pts-rank-card" style="--rank-color:${rank.color}">
    <div class="pts-rank-card__left">
      <div class="pts-rank-card__emoji">${rank.emoji}</div>
      <div>
        <div class="pts-rank-card__name">${rank.label}</div>
        <div class="pts-rank-card__sub">${rank.next ? `다음: ${rank.next.emoji} ${rank.next.label}` : '최고 등급'}</div>
      </div>
    </div>
    <div class="pts-rank-card__right">
      <div class="pts-rank-card__pts">${points.toLocaleString()}<span>P</span></div>
      ${toNext !== null ? `<div class="pts-rank-card__to-next">${toNext.toLocaleString()}P 더 모으면 승급</div>` : ''}
    </div>
    <div class="pts-rank-bar">
      <div class="pts-rank-bar__fill" style="width:${pct}%"></div>
    </div>
  </div>`;
}

export async function renderPointsShop() {
  setMeta('내 포인트 · 정치력 현황');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  let userData = {};
  try {
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    userData = snap.data() || {};
  } catch {}

  const balance = Number(userData.points || userData.totalPoints || 0);
  const extraUses = Number(userData.extraAiUses || 0);
  const nickname = userData.nickname || auth.currentUser?.displayName || '정치인';
  const partyId = userData.partyId || '';

  el.innerHTML = `<div class="page-section">
    <div class="pts-page">

      <!-- 히어로 헤더 -->
      <div class="pts-hero">
        <div class="pts-hero__eyebrow">MY POLITICAL ACCOUNT</div>
        <div class="pts-hero__title">🪙 ${esc(nickname)}의 정치 자산</div>
        <div class="pts-hero__sub">활동할수록 포인트와 정치력이 쌓입니다</div>
      </div>

      <!-- 잔액 카드 -->
      <div class="pts-balance-card">
        <div class="pts-balance-card__inner">
          <div>
            <div class="pts-balance-card__label">보유 포인트</div>
            <div class="pts-balance-card__amount">${balance.toLocaleString()}<span>P</span></div>
          </div>
          <div class="pts-balance-card__extras">
            ${extraUses > 0 ? `<div class="pts-extra-badge">AI 추가권 ${extraUses}회</div>` : ''}
            ${partyId ? `<div class="pts-party-badge">🏛️ 정당 가입</div>` : `<a class="pts-party-badge pts-party-badge--cta" href="#/parties">🏛️ 정당 입당하기</a>`}
          </div>
        </div>
      </div>

      <!-- 정치력 랭크 -->
      ${renderRankCard(balance)}

      <!-- 빠른 수령 -->
      <div class="pts-quick-earn">
        <div class="pts-section-title">⚡ 빠른 수령</div>
        <div class="pts-quick-grid">
          <button class="pts-quick-btn" id="btn-claim-daily">
            <span class="pts-quick-btn__icon">📅</span>
            <span class="pts-quick-btn__label">오늘 출석</span>
            <span class="pts-quick-btn__pts">+20P</span>
          </button>
          <a class="pts-quick-btn" href="#/battle">
            <span class="pts-quick-btn__icon">🗳️</span>
            <span class="pts-quick-btn__label">정치배틀</span>
            <span class="pts-quick-btn__pts">+5P</span>
          </a>
          <a class="pts-quick-btn" href="#/election">
            <span class="pts-quick-btn__icon">👑</span>
            <span class="pts-quick-btn__label">대선 투표</span>
            <span class="pts-quick-btn__pts">+5P</span>
          </a>
          <a class="pts-quick-btn" href="#/">
            <span class="pts-quick-btn__icon">🚨</span>
            <span class="pts-quick-btn__label">위기 투표</span>
            <span class="pts-quick-btn__pts">+5P</span>
          </a>
        </div>
      </div>

      <!-- 포인트 적립 가이드 -->
      <div class="pts-earn-guide">
        <div class="pts-section-title">💡 포인트 적립 방법</div>
        <div class="pts-earn-list">
          ${EARN_ITEMS.map(e => `
            <div class="pts-earn-item">
              <span class="pts-earn-item__icon">${e.icon}</span>
              <span class="pts-earn-item__label">
                ${esc(e.action)}
                ${e.note ? `<span class="pts-earn-item__note">${esc(e.note)}</span>` : ''}
              </span>
              <span class="pts-earn-item__pts">${esc(e.pts)}</span>
              ${e.id === 'signup' ? `<button class="btn btn--ghost btn--sm pts-claim-btn" id="btn-claim-signup">받기</button>` : ''}
            </div>`).join('')}
        </div>
      </div>

      <!-- 정치 랭크 안내 -->
      <div class="pts-rank-guide">
        <div class="pts-section-title">🏆 정치 등급 체계</div>
        <div class="pts-rank-table">
          ${RANK_LEVELS.map(r => `
            <div class="pts-rank-row ${balance >= r.min ? 'pts-rank-row--reached' : ''}">
              <span class="pts-rank-row__emoji">${r.emoji}</span>
              <span class="pts-rank-row__label" style="color:${r.color}">${r.label}</span>
              <span class="pts-rank-row__min">${r.min.toLocaleString()}P~</span>
            </div>`).join('')}
        </div>
      </div>

    </div>
  </div>`;

  document.getElementById('btn-claim-daily')?.addEventListener('click', async btn => {
    const b = document.getElementById('btn-claim-daily');
    if (b) b.disabled = true;
    try {
      const result = await httpsCallable(functions, 'claimDailyBonus')({});
      if (result.data?.awarded) {
        const pts = result.data.points || 20;
        toast.success(`오늘 출석 보너스 +${pts}P! 📅`);
        renderPointsShop();
      } else {
        toast.info('오늘 출석 보너스는 이미 받으셨어요');
        if (b) b.disabled = false;
      }
    } catch (e) {
      toast.error(e.message || '오류가 발생했어요');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-claim-signup')?.addEventListener('click', async () => {
    try {
      const result = await httpsCallable(functions, 'claimSignupBonus')({});
      if (result.data?.awarded) {
        toast.success('가입 보너스 500P 지급됐어요! 🎁');
        renderPointsShop();
      } else {
        toast.info('이미 가입 보너스를 받으셨어요');
      }
    } catch (e) { toast.error(e.message || '오류가 발생했어요'); }
  });
}
