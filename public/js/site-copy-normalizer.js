const COPY_REPLACEMENTS = [
  ['국민안정당', '국민질서당'],
  ['청년혁명당', '시민개혁당'],
  ['중도민주당', '국민통합당'],
  ['매일 새로운 당선자가 탄생합니다', '역사 이슈와 시민의 선택으로 새공화국이 움직입니다'],
  ['역대 당선자', '역대 집권 기록'],
  ['출세 순위', '정치력 순위'],
];

function replaceCopyText(text) {
  let out = String(text || '');
  COPY_REPLACEMENTS.forEach(([from, to]) => { out = out.split(from).join(to); });
  return out;
}

function normalizeTextNodes(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(tag)) return NodeFilter.FILTER_REJECT;
      const text = node.nodeValue || '';
      return COPY_REPLACEMENTS.some(([from]) => text.includes(from)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => { node.nodeValue = replaceCopyText(node.nodeValue); });
}

function ensureFooterLinks() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.dataset.footerLinksRestored = '1';

  footer.innerHTML = `
    <div class="site-footer__body" id="footer-body" hidden>
      <div class="site-footer__inner">
        <div class="site-footer__brand-block">
          <a href="#/" class="site-footer__brand">
            <img src="/logo.svg" alt="" width="26" height="26">
            <span>소소킹</span>
          </a>
          <div class="site-footer__tagline">역사 이슈와 시민의 선택으로 움직이는<br>가상 정치 공화국 소소킹</div>
        </div>
        <div>
          <div class="site-footer__col-title">공화국</div>
          <div class="site-footer__links">
            <a href="#/republic">🏛️ 공화국 허브</a>
            <a href="#/battle">⚔️ 정치배틀</a>
            <a href="#/election">🏛️ 대선</a>
            <a href="#/congress">🏛️ 국회</a>
            <a href="#/constitutional-court">⚖️ 헌법재판소</a>
            <a href="#/news">📰 소소신문</a>
            <a href="#/king-history">📜 집권 기록</a>
          </div>
        </div>
        <div>
          <div class="site-footer__col-title">커뮤니티</div>
          <div class="site-footer__links">
            <a href="#/feed">시민광장</a>
            <a href="#/ranking">정치력 랭킹</a>
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

function normalizeVisibleCopy() {
  normalizeTextNodes(document.body);
  ensureFooterLinks();
}

function scheduleCopyNormalize() {
  clearTimeout(window.__sosokingFooterTimer);
  window.__sosokingFooterTimer = setTimeout(normalizeVisibleCopy, 80);
}

const observer = new MutationObserver(scheduleCopyNormalize);
if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', scheduleCopyNormalize);
setTimeout(normalizeVisibleCopy, 300);
