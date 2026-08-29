const CURRENT_COPY_MARKER = 'judge-personas-v2';
const FEED_KICKER = '🔥 사용자가 공개한 AI 생활판결';
const FEED_HEADING = '최근 공개 AI 판결 5건';

function applyCurrentHomeCopy() {
  const page = document.getElementById('page-content');
  if (!page) return;

  const heroSub = page.querySelector('.hero-sub');
  if (heroSub && heroSub.dataset.copyVersion !== CURRENT_COPY_MARKER) {
    heroSub.innerHTML = '내 억울함은 AI 판사에게 맡기고,<br><strong>꼰대부터 냉혈·회피·추궁·오버·드립·빙의까지, 누가 걸릴지 모르는 생활재판을 받아보세요.</strong><br><span style="font-size:11px;opacity:0.58;">같은 사건도 담당 판사의 성격에 따라 전혀 다른 방식으로 흘러갑니다.</span>';
    heroSub.dataset.copyVersion = CURRENT_COPY_MARKER;
  }

  const feedSection = page.querySelector('#feed-container')?.closest('.container');
  if (feedSection) {
    const kicker = feedSection.children[0];
    const heading = feedSection.children[1];
    if (kicker && kicker.textContent !== FEED_KICKER) kicker.textContent = FEED_KICKER;
    if (heading && heading.textContent !== FEED_HEADING) heading.textContent = FEED_HEADING;
  }

  const serviceNotice = Array.from(page.querySelectorAll('.disclaimer'))
    .find(element => element.textContent?.includes('오락 서비스 안내'));
  if (serviceNotice && serviceNotice.dataset.copyVersion !== CURRENT_COPY_MARKER) {
    serviceNotice.innerHTML = '<strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 사용자가 접수한 사소한 생활분쟁을 7명의 개성 강한 AI 판사가 과하게 진지하게 심리하는 오락형 생활법정입니다. 실제 사례·판례 서비스가 아니며 결과에는 법적 효력이 없습니다.';
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
