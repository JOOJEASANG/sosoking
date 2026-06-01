import { navigate } from '../router.js';
import { auth, db, functions } from '../firebase.js';
import { doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';

const POINT_COST = 100; // default, will be overridden from config

async function getConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'ai_king'));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

export async function renderPointsShop() {
  setMeta('포인트 상점');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const [userData, config] = await Promise.all([
    getDoc(doc(db, 'users', auth.currentUser.uid)).then(s => s.data() || {}),
    getConfig(),
  ]);

  const pointsPerUse = config.pointsPerUse || POINT_COST;
  const balance = userData.points || 0;
  const extraUses = userData.extraAiUses || 0;

  el.innerHTML = `
    <div class="points-shop-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">🪙 포인트 상점</div>
        <div class="ai-king-header__sub">포인트로 AI킹 추가 사용권을 구입하세요</div>
      </div>

      <!-- 잔액 카드 -->
      <div class="points-balance-card">
        <div class="points-balance-card__label">현재 포인트</div>
        <div class="points-balance-card__amount" id="balance-display">${balance.toLocaleString()}<span>p</span></div>
        <div class="points-balance-card__extra">보유 추가 사용권 <strong id="extra-display">${extraUses}</strong>회</div>
      </div>

      <!-- 구매 섹션 -->
      <div class="card" style="margin-top:16px">
        <div class="card__body">
          <div style="font-size:15px;font-weight:900;margin-bottom:4px">⚡ AI킹 추가 사용권</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:16px">
            하루 3회 무료 소진 후 사용권으로 추가 이용 가능 (4가지 AI킹 공통 사용)
          </div>
          <div class="points-shop-grid" id="shop-grid">
            ${[
              { qty: 1, bonus: 0 },
              { qty: 3, bonus: 0 },
              { qty: 5, bonus: 1 },
              { qty: 10, bonus: 3 },
            ].map(item => {
              const cost = item.qty * pointsPerUse;
              const affordable = balance >= cost;
              return `
                <div class="points-shop-item ${!affordable ? 'points-shop-item--disabled' : ''}">
                  <div class="points-shop-item__qty">${item.qty}회${item.bonus ? ` <span class="points-shop-item__bonus">+${item.bonus} 보너스</span>` : ''}</div>
                  <div class="points-shop-item__cost">${cost.toLocaleString()}p</div>
                  <button class="btn btn--primary btn--sm btn-purchase" data-qty="${item.qty}" ${!affordable ? 'disabled' : ''}>
                    ${affordable ? '구매' : '부족'}
                  </button>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- 포인트 적립 안내 -->
      <div class="card" style="margin-top:12px">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">💡 포인트 적립 방법</div>
          <div class="points-earn-list">
            ${[
              { icon: '🎁', action: '첫 가입 보너스', points: '+500p', id: 'signup' },
              { icon: '📅', action: '매일 출석 체크', points: '+20p', id: 'daily' },
              { icon: '❤️', action: '내 글에 좋아요 받기', points: '+5p' },
              { icon: '💬', action: '내 글에 댓글 받기', points: '+10p' },
              { icon: '📝', action: '글 작성', points: '+10p' },
              { icon: '🎰', action: '사다리 게임 (하루 1회)', points: '+20~150p', soon: true },
            ].map(e => `
              <div class="points-earn-item">
                <span class="points-earn-item__icon">${e.icon}</span>
                <span class="points-earn-item__label">${e.action}${e.soon ? ' <span style="font-size:10px;color:var(--color-text-muted)">(준비 중)</span>' : ''}</span>
                <span class="points-earn-item__pts">${e.points}</span>
                ${e.id === 'signup' ? `<button class="btn btn--ghost btn--sm" id="btn-claim-signup" style="font-size:11px;margin-left:4px">받기</button>` : ''}
                ${e.id === 'daily' ? `<button class="btn btn--ghost btn--sm" id="btn-claim-daily" style="font-size:11px;margin-left:4px">받기</button>` : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

  // 구매 버튼
  el.querySelectorAll('.btn-purchase').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qty = parseInt(btn.dataset.qty);
      btn.disabled = true;
      btn.textContent = '처리 중...';
      try {
        const fn = httpsCallable(functions, 'purchaseAiExtraUse');
        const result = await fn({ quantity: qty });
        toast.success(`사용권 ${qty}회 구매 완료! ⚡`);
        renderPointsShop();
      } catch (e) {
        toast.error(e.message || '구매에 실패했어요');
        btn.disabled = false;
        btn.textContent = '구매';
      }
    });
  });

  // 가입 보너스
  document.getElementById('btn-claim-signup')?.addEventListener('click', async () => {
    try {
      const fn = httpsCallable(functions, 'claimSignupBonus');
      const result = await fn({});
      if (result.data?.awarded) { toast.success('가입 보너스 500p 지급됐어요! 🎁'); renderPointsShop(); }
      else toast.info('이미 가입 보너스를 받으셨어요');
    } catch (e) { toast.error(e.message || '오류가 발생했어요'); }
  });

  // 일일 보너스
  document.getElementById('btn-claim-daily')?.addEventListener('click', async () => {
    try {
      const fn = httpsCallable(functions, 'claimDailyBonus');
      const result = await fn({});
      if (result.data?.awarded) { toast.success('오늘 출석 보너스 20p! 📅'); renderPointsShop(); }
      else toast.info('오늘 출석 보너스는 이미 받으셨어요');
    } catch (e) { toast.error(e.message || '오류가 발생했어요'); }
  });
}
