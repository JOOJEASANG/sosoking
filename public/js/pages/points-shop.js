import { navigate } from '../router.js';
import { auth, db, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';

export async function renderPointsShop() {
  setMeta('내 포인트');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const userData = await getDoc(doc(db, 'users', auth.currentUser.uid)).then(s => s.data() || {});
  const balance = userData.points || 0;
  const extraUses = userData.extraAiUses || 0;

  el.innerHTML = `
    <div class="points-shop-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">🪙 내 포인트</div>
        <div class="ai-king-header__sub">활동할수록 포인트가 쌓여요</div>
      </div>

      <!-- 잔액 카드 -->
      <div class="points-balance-card">
        <div class="points-balance-card__label">현재 포인트</div>
        <div class="points-balance-card__amount">${balance.toLocaleString()}<span>p</span></div>
        <div class="points-balance-card__extra">보유 추가 사용권 <strong>${extraUses}</strong>회</div>
      </div>

      <!-- 포인트 적립 안내 -->
      <div class="card" style="margin-top:16px">
        <div class="card__body">
          <div style="font-size:14px;font-weight:800;margin-bottom:12px">💡 포인트 적립 방법</div>
          <div class="points-earn-list">
            ${[
              { icon: '🎁', action: '첫 가입 보너스', points: '+500p', id: 'signup' },
              { icon: '📅', action: '매일 출석 체크', points: '+20p', id: 'daily' },
              { icon: '📝', action: '글 작성', points: '+10p' },
              { icon: '💬', action: '댓글 작성', points: '+20p' },
              { icon: '👍', action: '댓글에 반응 남기기', points: '+1p' },
              { icon: '🗳️', action: '투표 참여', points: '+1p' },
              { icon: '❤️', action: '내 글에 반응 받기', points: '+1p' },
              { icon: '🪜', action: '사다리게임 보너스 (하루 1회)', points: 'AI 추가권 1회' },
            ].map(e => `
              <div class="points-earn-item">
                <span class="points-earn-item__icon">${e.icon}</span>
                <span class="points-earn-item__label">${e.action}</span>
                <span class="points-earn-item__pts">${e.points}</span>
                ${e.id === 'signup' ? `<button class="btn btn--ghost btn--sm" id="btn-claim-signup" style="font-size:11px;margin-left:4px">받기</button>` : ''}
                ${e.id === 'daily' ? `<button class="btn btn--ghost btn--sm" id="btn-claim-daily" style="font-size:11px;margin-left:4px">받기</button>` : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate(-1));

  document.getElementById('btn-claim-signup')?.addEventListener('click', async () => {
    try {
      const result = await httpsCallable(functions, 'claimSignupBonus')({});
      if (result.data?.awarded) { toast.success('가입 보너스 500p 지급됐어요! 🎁'); renderPointsShop(); }
      else toast.info('이미 가입 보너스를 받으셨어요');
    } catch (e) { toast.error(e.message || '오류가 발생했어요'); }
  });

  document.getElementById('btn-claim-daily')?.addEventListener('click', async () => {
    try {
      const result = await httpsCallable(functions, 'claimDailyBonus')({});
      if (result.data?.awarded) { toast.success('오늘 출석 보너스 20p! 📅'); renderPointsShop(); }
      else toast.info('오늘 출석 보너스는 이미 받으셨어요');
    } catch (e) { toast.error(e.message || '오류가 발생했어요'); }
  });
}
