import { renderMyCases as renderBaseMyCases } from './my-cases.js?v=20260702-12';

function titleByCount(count) {
  if (count >= 20) return '전설의 소소분쟁왕';
  if (count >= 10) return '위원회 단골 제보자';
  if (count >= 5) return '한 줄 분쟁 수집가';
  if (count >= 1) return '소소제보 초심자';
  return '미등록 제보자';
}
function badgeSet(count, completed, maxLv) {
  const badges = [];
  if (count >= 1) badges.push(['📮', '첫 분쟁 접수']);
  if (completed >= 1) badges.push(['📋', '결정문 보유']);
  if (maxLv >= 8) badges.push(['🚨', '긴급속보 기록']);
  if (count >= 5) badges.push(['📡', '속보 단골']);
  if (completed >= 10) badges.push(['👑', '명예 제보자']);
  if (!badges.length) badges.push(['🔒', '배지 대기중']);
  return badges;
}
function addProfileGame(container) {
  const inner = container.querySelector('.container');
  if (!inner || document.getElementById('my-game-profile')) return;
  const rows = Array.from(inner.querySelectorAll('.card')).filter(card => card.textContent.includes('사소함'));
  const count = rows.length;
  const completed = rows.filter(card => card.textContent.includes('결정문 보기')).length;
  const maxLv = rows.reduce((m, card) => {
    const match = card.textContent.match(/사소함\s*(\d+)/);
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
        <div class="court-desc">별것 아닌 일을 긴급 안건으로 격상한 전적입니다.</div>
      </div>
    </div>
    <div class="court-ledger" style="grid-template-columns:repeat(3,1fr);">
      <div><strong>${count}</strong><span>접수 분쟁</span></div>
      <div><strong>${completed}</strong><span>결정 완료</span></div>
      <div><strong>Lv.${maxLv || 0}</strong><span>최고 사소함</span></div>
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
