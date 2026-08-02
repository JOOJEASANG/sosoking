const CURRENT_COPY_MARKER = 'ai-life-verdict-only';

function applyCurrentHomeCopy() {
  const page = document.getElementById('page-content');
  if (!page) return;

  const heroSub = page.querySelector('.hero-sub');
  if (heroSub && heroSub.dataset.copyVersion !== CURRENT_COPY_MARKER) {
    heroSub.innerHTML = '내 억울함은 AI 판사에게 맡기고,<br><strong>사소한 생활분쟁을 과하게 진지한 판결문으로 받아보세요.</strong><br><span style="font-size:11px;opacity:0.58;">사용자가 접수한 내용으로 만드는 오락용 AI 생활법정입니다.</span>';
    heroSub.dataset.copyVersion = CURRENT_COPY_MARKER;
  }

  const feedSection = page.querySelector('#feed-container')?.closest('.container');
  if (feedSection) {
    const kicker = feedSection.children[0];
    const heading = feedSection.children[1];
    if (kicker) kicker.textContent = '🔥 사용자가 공개한 AI 생활판결';
    if (heading) heading.textContent = '최근 공개 AI 판결 5건';
  }

  const serviceNotice = Array.from(page.querySelectorAll('.disclaimer'))
    .find(element => element.textContent?.includes('오락 서비스 안내'));
  if (serviceNotice && serviceNotice.dataset.copyVersion !== CURRENT_COPY_MARKER) {
    serviceNotice.innerHTML = '<strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 사용자가 접수한 사소한 생활분쟁을 AI 판결문으로 만드는 오락형 생활법정입니다. 실제 사례·판례 서비스가 아니며 결과에는 법적 효력이 없습니다.';
    serviceNotice.dataset.copyVersion = CURRENT_COPY_MARKER;
  }
}

const observer = new MutationObserver(applyCurrentHomeCopy);
observer.observe(document.getElementById('page-content') || document.body, {
  childList: true,
  subtree: true
});

window.addEventListener('hashchange', applyCurrentHomeCopy);
queueMicrotask(applyCurrentHomeCopy);
