let scheduled = false;

function refineJudgmentResult() {
  const shell = document.querySelector('.result-shell');
  if (!shell || shell.dataset.conciseJudgment === 'true') return;
  shell.dataset.conciseJudgment = 'true';

  const comedy = shell.querySelector('.comedy-section');
  if (comedy) {
    const label = comedy.querySelector('.result-section-label');
    if (label) label.textContent = '판결문에서 건진 두 줄';
    comedy.querySelectorAll('.comedy-grid blockquote').forEach((item, index) => {
      if (index > 1) item.remove();
    });
  }

  const opinion = shell.querySelector('.opinion-section');
  const orders = shell.querySelector('.orders-section');
  const closing = shell.querySelector('.closing-panel');
  const cover = shell.querySelector('.judgment-cover');
  let anchor = comedy || cover;

  [opinion, orders, closing].forEach(section => {
    if (!section || !anchor) return;
    anchor.after(section);
    anchor = section;
  });

  const detailSections = [
    shell.querySelector('.case-core-section'),
    shell.querySelector('.claim-section'),
    shell.querySelector('.result-two-column'),
  ].filter(Boolean);

  if (detailSections.length && !shell.querySelector('.judgment-detail-fold')) {
    const details = document.createElement('details');
    details.className = 'card judgment-detail-fold';
    const summary = document.createElement('summary');
    summary.innerHTML = '<span>판결 근거 자세히 보기</span><small>사건 분석 · 양측 주장 · 감식 기록</small>';
    const body = document.createElement('div');
    body.className = 'judgment-detail-body';
    detailSections.forEach(section => body.appendChild(section));
    details.append(summary, body);
    anchor?.after(details);
  }

  const share = shell.querySelector('.share-toolbar');
  if (share) {
    const title = share.querySelector('strong');
    const copy = share.querySelector('span');
    if (title) title.textContent = '판결을 공유하거나 저장하세요';
    if (copy) copy.textContent = '핵심 두 줄과 주문 중심으로 공유됩니다.';
  }
}

function scheduleRefine() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    refineJudgmentResult();
  });
}

window.addEventListener('hashchange', scheduleRefine);
new MutationObserver(scheduleRefine).observe(document.getElementById('app'), { childList: true, subtree: true });
scheduleRefine();
