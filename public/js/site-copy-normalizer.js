function ensureFooterLinks() {
  const footer = document.getElementById('site-footer');
  if (!footer || footer.dataset.footerLinksRestored === '1') return;
  footer.dataset.footerLinksRestored = '1';

  footer.innerHTML = `
    <div class="site-footer__body" id="footer-body" hidden>
      <div class="site-footer__inner">
        <div class="site-footer__brand-block">
          <a href="#/" class="site-footer__brand">
            <img src="/logo.svg" alt="" width="26" height="26">
            <span>소소킹</span>
          </a>
          <div class="site-footer__tagline">소소함의 재미<br>짧게 놀고 피식 웃는 커뮤니티</div>
        </div>
        <div>
          <div class="site-footer__col-title">바로가기</div>
          <div class="site-footer__links">
            <a href="#/feed">피드</a>
            <a href="#/write?type=multi&preset=drip">드립</a>
            <a href="#/sosoland">게임</a>
            <a href="#/guide">이용안내</a>
          </div>
        </div>
        <div>
          <div class="site-footer__col-title">정보</div>
          <div class="site-footer__links">
            <a href="#/terms">이용약관</a>
            <a href="#/privacy">개인정보처리방침</a>
          </div>
        </div>
      </div>
    </div>
    <div class="site-footer__copy-bar">
      <div class="site-footer__copy">© ${new Date().getFullYear()} 소소킹. All rights reserved.</div>
      <button class="site-footer__toggle" id="btn-footer-toggle" aria-expanded="false" title="푸터 펼치기">더보기</button>
    </div>`;

  document.getElementById('btn-footer-toggle')?.addEventListener('click', function () {
    const body = document.getElementById('footer-body');
    if (!body) return;
    const expanded = this.getAttribute('aria-expanded') === 'true';
    const next = !expanded;
    this.setAttribute('aria-expanded', String(next));
    this.classList.toggle('open', next);
    body.hidden = !next;
    this.textContent = next ? '접기' : '더보기';
  });
}

function scheduleFooterRestore() {
  clearTimeout(window.__sosokingFooterTimer);
  window.__sosokingFooterTimer = setTimeout(ensureFooterLinks, 80);
}

const observer = new MutationObserver(scheduleFooterRestore);
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleFooterRestore);
setTimeout(ensureFooterLinks, 300);