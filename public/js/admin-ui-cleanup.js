function removeAdminHomeButton() {
  document.getElementById('admin-safe-goto-site')?.remove();
  document.querySelectorAll('.admin-goto-site-btn').forEach(button => button.remove());
}

function removeStatsHeaderNote() {
  const needles = ['최근 100개 게시글 기준', '인기/참여 TOP3'];
  document.querySelectorAll('#admin-content *').forEach(el => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 90) return;
    if (!needles.some(needle => text.includes(needle))) return;
    if (el.children.length > 2) return;
    el.remove();
  });
}

function injectPolishStyle() {
  if (document.getElementById('sosoking-ui-cleanup-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-ui-cleanup-style';
  style.textContent = `
    .soso-feed-page.layout-main--full,
    .feed-page-clean {
      width: 100% !important;
      max-width: 860px !important;
      margin: 0 auto !important;
      padding: 0 16px 28px !important;
      box-sizing: border-box !important;
    }
    .soso-feed-toolbar {
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
      width: 100% !important;
      margin: 0 0 12px !important;
    }
    .soso-room-tabs,
    .soso-room-head,
    .feed-search-bar,
    .feed-control-wrap,
    .feed-control-wrap--with-sort,
    .soso-feed-summary,
    .feed-result-summary,
    #feed-list,
    .soso-feed-list,
    #feed-pagination {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    #feed-list,
    .soso-feed-list {
      gap: 12px !important;
      padding: 0 0 12px !important;
      margin: 0 !important;
    }
    #feed-list > .feed-card,
    .soso-feed-list > .feed-card,
    #feed-list > .card.feed-card,
    .soso-feed-list > .card.feed-card {
      margin: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .soso-room-head { margin: 0 !important; }
    .feed-pagination,
    #feed-pagination { margin-top: 14px !important; }

    .vote-type-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 0 0 12px;
    }
    .vote-type-toggle__btn {
      min-height: 58px;
      padding: 10px 12px;
      border: 1px solid var(--color-border-light);
      border-radius: 16px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-family: inherit;
      font-weight: 900;
      text-align: left;
      cursor: pointer;
    }
    .vote-type-toggle__btn b {
      display: block;
      color: var(--color-text-primary);
      font-size: 13px;
      margin-bottom: 3px;
    }
    .vote-type-toggle__btn span {
      display: block;
      color: var(--color-text-muted);
      font-size: 11px;
      line-height: 1.35;
    }
    .vote-type-toggle__btn.active {
      border-color: var(--color-primary-border);
      background: var(--color-primary-bg);
    }
    .vote-mode-hint {
      margin-top: 7px;
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 800;
      line-height: 1.45;
    }

    .debate-comment-mode {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
      padding: 10px;
      border: 1px solid var(--color-border-light);
      border-radius: 14px;
      background: var(--color-surface-2);
    }
    .debate-comment-mode__row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .debate-comment-mode__hint {
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 800;
      line-height: 1.45;
    }
    .debate-comment-mode button {
      min-height: 32px;
      padding: 0 11px;
      border: 1px solid var(--color-border-light);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .debate-comment-mode button.active {
      border-color: var(--color-primary-border);
      background: var(--color-primary-bg);
      color: var(--color-primary);
    }
    .debate-comment-mode [data-debate-side="A"].active {
      border-color: rgba(239, 68, 68, .34);
      background: rgba(239, 68, 68, .08);
      color: #dc2626;
    }
    .debate-comment-mode [data-debate-side="B"].active {
      border-color: rgba(59, 130, 246, .34);
      background: rgba(59, 130, 246, .08);
      color: #2563eb;
    }
    .debate-comments-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    .debate-comments-col {
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--color-border-light);
      border-radius: 16px;
      background: var(--color-surface-2);
    }
    .debate-comments-col--a { border-color: rgba(239, 68, 68, .22); }
    .debate-comments-col--b { border-color: rgba(59, 130, 246, .22); }
    .debate-comments-col__title {
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 950;
      color: var(--color-text-primary);
    }
    .debate-comment-card {
      margin-bottom: 8px;
      padding: 10px;
      border-radius: 13px;
      background: var(--color-surface);
      box-shadow: 0 6px 16px rgba(20, 14, 40, .045);
    }
    .debate-comment-card__badge {
      display: inline-flex;
      margin-bottom: 6px;
      padding: 3px 7px;
      border-radius: 999px;
      background: var(--color-primary-bg);
      color: var(--color-primary);
      font-size: 10px;
      font-weight: 950;
    }
    .debate-comment-card__text {
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 800;
      line-height: 1.55;
      word-break: break-word;
    }
    .debate-comment-card__meta {
      display: flex;
      gap: 6px;
      margin-top: 7px;
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 750;
    }
    .debate-normal-comments { margin-top: 12px; }
    .debate-empty {
      padding: 18px 8px;
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 800;
      text-align: center;
    }
    @media (max-width: 767px) {
      .soso-feed-page.layout-main--full,
      .feed-page-clean {
        max-width: 100% !important;
        padding: 0 12px 24px !important;
      }
      .soso-feed-toolbar { gap: 10px !important; }
      #feed-list,
      .soso-feed-list { gap: 10px !important; }
      .vote-type-toggle { grid-template-columns: 1fr; }
      .debate-comments-wrap { grid-template-columns: 1fr; gap: 10px; }
      .debate-comment-mode { padding: 9px; }
      .debate-comment-mode__row button { flex: 1 1 auto; }
    }
  `;
  document.head.appendChild(style);
}

function detailId() {
  const match = (location.hash || '').match(/^#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function timeText(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || !Number.isFinite(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function plain(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function dripDisplayTitle(data = {}) {
  const title = plain(data.title || '');
  const prompt = plain(data.modules?.drip?.prompt || '');
  const desc = plain(data.desc || '');
  if (!data.modules?.drip?.enabled) return '';
  if (['오늘의 드립 주제', '오늘의 한줄', '드립방 AI 글'].includes(title)) return prompt || desc || title;
  return title || prompt || desc;
}

function polishAdminDataDripTitles() {
  document.querySelectorAll('.admin-data-row').forEach(row => {
    if (row.dataset.dripTitlePolished === '1') return;
    const titleEl = row.querySelector('.admin-data-title');
    const jsonEl = row.querySelector('.admin-data-json pre');
    if (!titleEl || !jsonEl) return;
    try {
      const data = JSON.parse(jsonEl.textContent || '{}');
      const title = dripDisplayTitle(data);
      if (!title) return;
      titleEl.textContent = title;
      row.dataset.dripTitlePolished = '1';
    } catch {}
  });
}

let firebaseMods = null;
async function loadFirebaseMods() {
  if (firebaseMods) return firebaseMods;
  const [{ auth, db }, { appState }, actions, firestore, { toast }] = await Promise.all([
    import('./firebase.js'),
    import('./state.js'),
    import('./detail/action-utils.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    import('./components/toast.js'),
  ]);
  firebaseMods = { auth, db, appState, actions, firestore, toast };
  return firebaseMods;
}

function optionInputs() {
  return [...document.querySelectorAll('.mw-vote-option')];
}

function ensureVoteTypeToggle() {
  const modeInput = document.getElementById('mw-vote-mode');
  const optionList = document.getElementById('mw-vote-options');
  if (!modeInput || !optionList) return;
  const card = document.querySelector('[data-module-card="vote"], .mw-vote-compact');
  if (!card || card.querySelector('.vote-type-toggle')) return;
  card.insertAdjacentHTML('afterbegin', `
    <div class="vote-type-toggle" data-vote-type-toggle>
      <button type="button" class="vote-type-toggle__btn active" data-vote-type="general"><b>투표형</b><span>선택지를 자유롭게 추가하고 일반 댓글로 이야기합니다.</span></button>
      <button type="button" class="vote-type-toggle__btn" data-vote-type="debate"><b>선택형</b><span>옵션 2개 중 하나를 고르고 좌우 주장 토론을 합니다.</span></button>
    </div>
    <div class="vote-mode-hint" data-vote-mode-hint>투표형은 여러 선택지를 만들 수 있고, 댓글은 일반 댓글로 표시됩니다.</div>`);
}

function applyVoteType(type) {
  const modeInput = document.getElementById('mw-vote-mode');
  const list = document.getElementById('mw-vote-options');
  if (!modeInput || !list) return;
  const normalized = type === 'debate' ? 'debate' : 'general';
  modeInput.value = normalized;
  document.querySelectorAll('[data-vote-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.voteType === normalized));
  const inputs = optionInputs();
  const addBtn = document.getElementById('mw-add-vote-option');
  const hint = document.querySelector('[data-vote-mode-hint]');

  if (normalized === 'debate') {
    while (optionInputs().length > 2) optionInputs().at(-1)?.remove();
    const current = optionInputs();
    if (current[0]) current[0].placeholder = '왼쪽 선택지 예: 찬성 / 가능 / A';
    if (current[1]) current[1].placeholder = '오른쪽 선택지 예: 반대 / 불가능 / B';
    if (addBtn) addBtn.style.display = 'none';
    if (hint) hint.textContent = '선택형은 선택지 2개만 사용합니다. 상세페이지 댓글은 자동으로 좌우 주장 토론 모드로 표시됩니다.';
  } else {
    optionInputs().forEach((input, index) => { input.placeholder = `선택지 ${index + 1}`; });
    if (addBtn) addBtn.style.display = '';
    if (hint) hint.textContent = '투표형은 여러 선택지를 만들 수 있고, 댓글은 일반 댓글로 표시됩니다.';
  }
}

function enhanceVoteWriteMode() {
  ensureVoteTypeToggle();
  const modeInput = document.getElementById('mw-vote-mode');
  if (!modeInput || modeInput.dataset.voteTypeReady === '1') return;
  modeInput.dataset.voteTypeReady = '1';
  applyVoteType(modeInput.value === 'debate' ? 'debate' : 'general');
}

function bindVoteWriteModeControls() {
  if (window.__sosokingVoteWriteModeBound) return;
  window.__sosokingVoteWriteModeBound = true;
  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-vote-type]');
    if (!btn) return;
    event.preventDefault();
    applyVoteType(btn.dataset.voteType);
  }, true);
}

const postCache = new Map();
async function currentPost() {
  const id = detailId();
  if (!id) return null;
  if (postCache.has(id)) return postCache.get(id);
  const { db, firestore } = await loadFirebaseMods();
  const snap = await firestore.getDoc(firestore.doc(db, 'feeds', id));
  const post = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  postCache.set(id, post);
  return post;
}

function isVoteDetailPage() {
  return !!detailId() && !!document.querySelector('[data-multi-module="vote"], .multi-vote-options');
}

function isDebateModePost(post) {
  const mode = String(post?.modules?.vote?.voteMode || post?.voteMode || '').toLowerCase();
  return ['debate', 'choice', 'selection', 'versus'].includes(mode);
}

function voteOptionLabels(post) {
  const options = Array.isArray(post?.modules?.vote?.options) ? post.modules.vote.options : [];
  return [
    plain(options[0]?.text || options[0] || '찬성'),
    plain(options[1]?.text || options[1] || '반대'),
  ];
}

function setDebatePlaceholder(root) {
  const input = document.getElementById('comment-input');
  if (!input || !root) return;
  const side = root.querySelector('[data-debate-side].active')?.dataset.debateSide;
  const a = root.dataset.labelA || '찬성';
  const b = root.dataset.labelB || '반대';
  input.placeholder = side === 'A'
    ? `${a} 주장과 근거를 적어주세요`
    : side === 'B'
      ? `${b} 주장과 근거를 적어주세요`
      : '한쪽을 선택하고 주장을 펼쳐주세요';
}

async function enhanceVoteCommentBox() {
  if (!isVoteDetailPage()) return;
  const post = await currentPost();
  if (!isDebateModePost(post)) return;
  const box = document.getElementById('comment-write');
  if (!box || box.querySelector('.debate-comment-mode')) return;
  const [a, b] = voteOptionLabels(post);
  box.insertAdjacentHTML('afterbegin', `
    <div class="debate-comment-mode" data-mode="debate" data-label-a="${escapeHtml(a)}" data-label-b="${escapeHtml(b)}">
      <div class="debate-comment-mode__row debate-side-row" style="display:flex">
        <button type="button" data-debate-side="A">${escapeHtml(a)} 주장</button>
        <button type="button" data-debate-side="B">${escapeHtml(b)} 주장</button>
      </div>
      <div class="debate-comment-mode__hint">선택형 토론입니다. 한쪽을 선택하고 주장과 근거를 적으면 좌우 토론 영역에 표시됩니다.</div>
    </div>`);
  setDebatePlaceholder(box.querySelector('.debate-comment-mode'));
}

function bindDebateCommentControls() {
  if (window.__sosokingDebateCommentBound) return;
  window.__sosokingDebateCommentBound = true;
  document.addEventListener('click', async event => {
    const sideBtn = event.target.closest?.('[data-debate-side]');
    if (sideBtn) {
      event.preventDefault();
      const root = sideBtn.closest('.debate-comment-mode');
      root.querySelectorAll('[data-debate-side]').forEach(btn => btn.classList.toggle('active', btn === sideBtn));
      setDebatePlaceholder(root);
      return;
    }
  }, true);

  document.addEventListener('click', async event => {
    const submit = event.target.closest?.('#btn-comment');
    if (!submit || !isVoteDetailPage()) return;
    const modeRoot = document.querySelector('.debate-comment-mode');
    if (!modeRoot || modeRoot.dataset.mode !== 'debate') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (submit.dataset.pending === '1') return;

    const side = modeRoot.querySelector('[data-debate-side].active')?.dataset.debateSide || '';
    if (!side) {
      const { toast } = await loadFirebaseMods();
      toast.warn('주장을 펼칠 쪽을 선택해주세요');
      return;
    }

    const input = document.getElementById('comment-input');
    const text = input?.value.trim() || '';
    if (!text) {
      const { toast } = await loadFirebaseMods();
      toast.warn('주장을 입력해주세요');
      return;
    }

    submit.dataset.pending = '1';
    try {
      const { auth, db, appState, actions, firestore, toast } = await loadFirebaseMods();
      if (!(await actions.ensureAnonymousActor('댓글 등록에 실패했어요'))) return;
      const isGuest = auth.currentUser?.isAnonymous;
      const guestName = String(document.getElementById('comment-guest-name')?.value || '').trim().slice(0, 12);
      const authorName = isGuest ? (guestName || '익명') : (appState.nickname || auth.currentUser?.displayName || '익명');
      const label = side === 'A' ? (modeRoot.dataset.labelA || '찬성') : (modeRoot.dataset.labelB || '반대');
      await firestore.addDoc(firestore.collection(db, 'feeds', detailId(), 'comments'), {
        text,
        side,
        debateSide: side,
        debateRoleLabel: `${label} 주장`,
        commentKind: 'debateArgument',
        authorId: auth.currentUser.uid,
        authorName,
        authorPhoto: isGuest ? '' : (auth.currentUser?.photoURL || ''),
        isGuest: !!isGuest,
        reactions: {},
        reactedWith: {},
        createdAt: firestore.serverTimestamp(),
      });
      await firestore.updateDoc(firestore.doc(db, 'feeds', detailId()), { commentCount: firestore.increment(1) }).catch(() => {});
      if (input) input.value = '';
      const list = document.getElementById('comment-list');
      if (list) list.dataset.debateColumnsReady = '';
      toast.success('토론 주장이 등록됐어요');
      setTimeout(renderDebateCommentColumns, 180);
    } catch (error) {
      const { toast } = await loadFirebaseMods();
      toast.error(error.message || '등록에 실패했어요');
    } finally {
      submit.dataset.pending = '';
    }
  }, true);
}

function debateCard(comment) {
  const side = comment.side || comment.debateSide;
  const label = comment.debateRoleLabel || (side === 'A' ? '찬성 주장' : '반대 주장');
  return `<div class="debate-comment-card" data-comment-id="${escapeHtml(comment.id)}">
    <div class="debate-comment-card__badge">${escapeHtml(label)}</div>
    <div class="debate-comment-card__text">${escapeHtml(comment.text || '').replace(/\n/g, '<br>')}</div>
    <div class="debate-comment-card__meta"><span>${escapeHtml(comment.authorName || '익명')}</span><span>${timeText(comment.createdAt)}</span></div>
  </div>`;
}

let renderToken = 0;
async function renderDebateCommentColumns() {
  if (!isVoteDetailPage()) return;
  const post = await currentPost();
  if (!isDebateModePost(post)) return;
  const list = document.getElementById('comment-list');
  if (!list || list.dataset.debateColumnsReady === '1') return;
  const [labelA, labelB] = voteOptionLabels(post);
  const token = ++renderToken;
  try {
    const { db, firestore } = await loadFirebaseMods();
    const snap = await firestore.getDocs(firestore.query(
      firestore.collection(db, 'feeds', detailId(), 'comments'),
      firestore.orderBy('createdAt', 'asc'),
    ));
    if (token !== renderToken) return;
    const comments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const left = comments.filter(c => c.side === 'A' || c.debateSide === 'A');
    const right = comments.filter(c => c.side === 'B' || c.debateSide === 'B');
    const normal = comments.filter(c => !c.side && !c.debateSide);
    list.dataset.debateColumnsReady = '1';
    const normalHtml = normal.length
      ? `<div class="debate-normal-comments"><div class="comment-section__title" style="font-size:13px;margin:10px 0">일반 댓글 ${normal.length}</div>${list.innerHTML}</div>`
      : '';
    list.innerHTML = `
      <div class="debate-comments-wrap">
        <div class="debate-comments-col debate-comments-col--a">
          <div class="debate-comments-col__title">${escapeHtml(labelA)} 주장 ${left.length}</div>
          ${left.length ? left.map(debateCard).join('') : `<div class="debate-empty">${escapeHtml(labelA)} 주장을 펼쳐보세요</div>`}
        </div>
        <div class="debate-comments-col debate-comments-col--b">
          <div class="debate-comments-col__title">${escapeHtml(labelB)} 주장 ${right.length}</div>
          ${right.length ? right.map(debateCard).join('') : `<div class="debate-empty">${escapeHtml(labelB)} 주장을 펼쳐보세요</div>`}
        </div>
      </div>
      ${normalHtml}`;
  } catch (error) {
    console.warn('[debate-comments] render failed', error);
  }
}

function installEnhancements() {
  injectPolishStyle();
  // 관리자 페이지(admin.js)가 홈 버튼·헤더를 직접 렌더하므로 더 이상 제거하지 않습니다.
  polishAdminDataDripTitles();
  enhanceVoteWriteMode();
  bindVoteWriteModeControls();
  enhanceVoteCommentBox();
  bindDebateCommentControls();
  renderDebateCommentColumns();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(installEnhancements, 120);
}

new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  renderToken += 1;
  postCache.clear();
  schedule();
});
setTimeout(installEnhancements, 0);
setTimeout(schedule, 400);
