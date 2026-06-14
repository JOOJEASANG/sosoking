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
          <div class="site-footer__tagline">정당에 입당하고 대통령까지 도전하는<br>가상 정치 공화국 소소킹</div>
        </div>
        <div>
          <div class="site-footer__col-title">공화국</div>
          <div class="site-footer__links">
            <a href="#/republic">🏛️ 공화국 허브</a>
            <a href="#/battle">⚔️ 정치배틀</a>
            <a href="#/election">👑 대선</a>
            <a href="#/congress">🏛️ 국회</a>
            <a href="#/constitutional-court">⚖️ 헌법재판소</a>
            <a href="#/news">📰 소소신문</a>
          </div>
        </div>
        <div>
          <div class="site-footer__col-title">커뮤니티</div>
          <div class="site-footer__links">
            <a href="#/feed">피드</a>
            <a href="#/ranking">랭킹</a>
            <a href="#/parties">정당 상세</a>
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
