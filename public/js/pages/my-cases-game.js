import { renderMyCases as renderBaseMyCases } from './my-cases.js?v=20260630-9';

function titleByCount(count) {
  if (count >= 20) return '전설의 생활소송왕';
  if (count >= 10) return '법정 단골 원고';
  if (count >= 5) return '생활분쟁 수집가';
  if (count >= 1) return '억울함 초심자';
  return '미등록 원고';
}
function badgeSet(count, completed, maxLv) {
  const badges = [];
  if (count >= 1) badges.push(['📮', '첫 사건 접수']);
  if (completed >= 1) badges.push(['📜', '판결문 보유']);
  if (maxLv >= 8) badges.push(['🔥', '극대노 기록']);
  if (count >= 5) badges.push(['🏛️', '법정 단골']);
  if (completed >= 10) badges.push(['👑', '명예 원고']);
  if (!badges.length) badges.push(['🔒', '배지 대기중']);
  return badges;
}
function addProfileGame(container) {
  const inner = container.querySelector('.container');
  if (!inner || document.getElementById('my-game-profile')) return;
  const rows = Array.from(inner.querySelectorAll('.card')).filter(card => card.textContent.includes('억울지수'));
  const count = rows.length;
  const completed = rows.filter(card => card.textContent.includes('판결문 보기')).length;
  const maxLv = rows.reduce((m, card) => {
    const match = card.textContent.match(/억울지수\s*(\d+)/);
    return Math.max(m, Number(match?.[1] || 0));
  }, 0);
  const title = titleByCount(count);
  const badges = badgeSet(count, completed, maxLv);
  const profile = document.createElement('div');
  profile.id = 'my-game-profile';
  profile.className = 'court-shell';
  profile.style.cssText = 'padding:18px;margin-bottom:14px;';
  profile.innerHTML = `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
      <div class="court-seal" style="width:54px;height:54px;font-size:25px;">🎖️</div>
      <div style="flex:1;min-width:0;">
        <div class="court-kicker">PLAYER PROFILE</div>
        <div class="court-title" style="font-size:20px;">${title}</div>
        <div class="court-desc">사소한 억울함을 중대 사건으로 격상한 전적입니다.</div>
      </div>
    </div>
    <div class="court-ledger" style="grid-template-columns:repeat(3,1fr);">
      <div><strong>${count}</strong><span>접수 사건</span></div>
      <div><strong>${completed}</strong><span>선고 완료</span></div>
      <div><strong>Lv.${maxLv || 0}</strong><span>최고 억울함</span></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
      ${badges.map(([icon, label]) => `<span style="display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(201,168,76,.35);background:rgba(201,168,76,.12);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;color:#fff8ec;">${icon} ${label}</span>`).join('')}
    </div>`;
  const header = inner.querySelector('.card');
  header?.insertAdjacentElement('afterend', profile);
}

export async function renderMyCases(container) {
  await renderBaseMyCases(container);
  addProfileGame(container);
}
