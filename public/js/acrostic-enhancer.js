import { db, auth } from './firebase.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function isAcrosticWritePage() {
  const hash = window.location.hash || '';
  return hash.startsWith('#/write') && (hash.includes('type=acrostic') || !!document.getElementById('f-keyword'));
}

function getDetailPostId() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function clean(value, max = 100) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getKeyword() {
  return clean(document.getElementById('f-keyword')?.value || '', 6);
}

function getPoemType(keyword) {
  const len = [...String(keyword || '')].length;
  return ({ 3: '삼행시', 4: '사행시', 5: '오행시', 6: '육행시' })[len] || '삼행시';
}

function useEuro(keyword) {
  const chars = [...String(keyword || '')];
  const last = chars[chars.length - 1] || '';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '로';
  const jong = (code - 0xac00) % 28;
  return jong !== 0 && jong !== 8 ? '으로' : '로';
}

function getAutoTitle(keyword) {
  return keyword ? `${keyword}${useEuro(keyword)} ${getPoemType(keyword)} 짓기` : '';
}

function getGuideText(keyword) {
  return `재치있고 재밌는 ${getPoemType(keyword)}를 지어보세요.`;
}

function ensureTitlePreview(keyword) {
  const input = document.getElementById('f-keyword');
  if (!input) return;
  const group = input.closest('.form-group') || input.parentElement;
  if (!group) return;

  let preview = document.getElementById('acrostic-title-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'acrostic-title-preview';
    preview.style.cssText = 'margin-top:8px;padding:10px 12px;border-radius:10px;background:var(--color-primary-bg);border:1px solid var(--color-primary-border);font-size:13px;font-weight:800;color:var(--color-text)';
    group.appendChild(preview);
  }

  preview.innerHTML = keyword
    ? `자동 제목: <span style="color:var(--color-primary)">${escapeHtml(getAutoTitle(keyword))}</span>`
    : '제시어를 입력하면 제목이 자동으로 만들어져요';
}

function replaceDescInputWithGuide(keyword) {
  const textarea = document.getElementById('f-desc');
  if (!textarea) return;
  const group = textarea.closest('.form-group');
  if (!group) return;

  const guideText = getGuideText(keyword || getKeyword());
  if (group.dataset.acrosticGuide === '1') {
    const guide = document.getElementById('acrostic-guide-text');
    const hidden = document.getElementById('f-desc');
    if (guide) guide.textContent = guideText;
    if (hidden) hidden.value = guideText;
    return;
  }

  group.dataset.acrosticGuide = '1';
  group.innerHTML = `
    <label class="form-label">안내</label>
    <div id="acrostic-guide-text" style="padding:12px 14px;border-radius:12px;background:#F9FAFB;border:1px solid var(--color-border);font-size:14px;line-height:1.6;color:var(--color-text-secondary)">${escapeHtml(guideText)}</div>
    <textarea id="f-desc" style="display:none">${escapeHtml(guideText)}</textarea>
  `;
}

function updateAcrosticUi() {
  if (!isAcrosticWritePage()) return;
  const keyword = getKeyword();
  ensureTitlePreview(keyword);
  replaceDescInputWithGuide(keyword);
}

function renderLineInputs() {
  if (!isAcrosticWritePage()) return;
  const keyword = getKeyword();
  updateAcrosticUi();
  const box = document.getElementById('acrostic-lines');
  if (!box || !keyword) return;

  const chars = [...keyword];
  const current = [...box.querySelectorAll('.acrostic-line-input')].map(input => input.value || '');
  if (box.dataset.keyword === keyword && box.querySelectorAll('.acrostic-line-input').length === chars.length) return;
  box.dataset.keyword = keyword;
  box.innerHTML = `
    <div class="acrostic-lines-box">
      <div style="font-size:12px;font-weight:800;color:var(--color-text-muted);margin-bottom:10px">${escapeHtml(getPoemType(keyword))} 작성 · 글자마다 한 줄씩 입력하세요</div>
      ${chars.map((ch, i) => `
        <div class="acrostic-line-row">
          <span class="acrostic-line-char">${escapeHtml(ch)}</span>
          <input class="form-input acrostic-line-input" id="acrostic-line-${i}" data-char="${escapeHtml(ch)}" placeholder="${escapeHtml(ch)}로 시작하는 한 줄" maxlength="80" value="${escapeHtml(current[i] || '')}">
        </div>`).join('')}
    </div>`;
}

function collectData() {
  const keyword = getKeyword();
  const len = [...keyword].length;
  if (!keyword || len < 3 || len > 6) {
    toast.error('제시어는 3~6글자로 입력해주세요');
    return null;
  }
  renderLineInputs();

  const poemType = getPoemType(keyword);
  const acrosticLines = [...keyword].map((char, index) => ({
    char,
    line: clean(document.getElementById(`acrostic-line-${index}`)?.value || '', 80),
  }));

  if (acrosticLines.some(item => !item.line)) {
    toast.error(`${poemType}의 모든 줄을 입력해주세요`);
    return null;
  }

  const tagsRaw = document.getElementById('f-tags')?.value || '';
  const tags = tagsRaw.split(',').map(t => t.replace('#', '').trim()).filter(Boolean);
  if (!tags.includes(poemType)) tags.unshift(poemType);
  if (!tags.includes('소소킹')) tags.push('소소킹');

  return {
    type: 'acrostic',
    cat: 'usgyo',
    title: getAutoTitle(keyword),
    keyword,
    poemType,
    desc: getGuideText(keyword),
    tags: tags.slice(0, 8),
    lines: acrosticLines.map(item => item.line),
    acrosticLines,
    acrosticText: acrosticLines.map(item => `${item.char}: ${item.line}`).join('\n'),
  };
}

async function submit(btn) {
  if (!auth.currentUser) {
    navigate('/login');
    return;
  }
  const data = collectData();
  if (!data) return;

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '올리는 중...';

  try {
    await addDoc(collection(db, 'feeds'), {
      ...data,
      images: [],
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    localStorage.removeItem('write-draft-acrostic');
    toast.success(`${data.poemType}를 올렸어요!`);
    navigate('/feed');
  } catch (error) {
    console.error(error);
    toast.error('올리기에 실패했어요');
    btn.disabled = false;
    btn.textContent = oldText || '올리기';
  }
}

function renderMainAcrosticLines(post) {
  const body = document.querySelector('.detail-body');
  if (!body || body.querySelector('[data-main-acrostic-lines]')) return;

  const keyword = post.keyword || '';
  const poemType = post.poemType || getPoemType(keyword);
  const lines = Array.isArray(post.acrosticLines) && post.acrosticLines.length
    ? post.acrosticLines
    : Array.isArray(post.lines)
      ? [...keyword].map((char, index) => ({ char, line: post.lines[index] || '' }))
      : [];
  if (!keyword || !lines.length) return;

  const html = `
    <div data-main-acrostic-lines style="padding:16px;background:#F3F4F6;border-radius:10px;margin-top:8px">
      <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:10px">제시어: ${escapeHtml(keyword)} · ${escapeHtml(poemType)}</div>
      ${lines.map(item => `
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
          <span style="width:28px;height:28px;background:var(--color-primary);color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0">${escapeHtml(item.char)}</span>
          <span style="font-size:14px;line-height:1.6;color:var(--color-text)">${escapeHtml(item.line)}</span>
        </div>`).join('')}
    </div>`;

  const placeholder = [...body.querySelectorAll('div')]
    .find(el => el.textContent.includes('삼행시로 참여해보세요'));
  if (placeholder) placeholder.outerHTML = html;
  else body.insertAdjacentHTML('beforeend', html);
}

async function enhanceDetail() {
  const postId = getDetailPostId();
  if (!postId) return;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = snap.data() || {};
    if (post.type !== 'acrostic') return;
    renderMainAcrosticLines(post);
  } catch {}
}

document.addEventListener('input', event => {
  if (event.target?.id === 'f-keyword') {
    setTimeout(() => {
      updateAcrosticUi();
      renderLineInputs();
    }, 0);
  }
}, true);

document.addEventListener('click', event => {
  const btn = event.target?.closest?.('#btn-submit');
  if (!btn || !isAcrosticWritePage()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  submit(btn);
}, true);

window.addEventListener('hashchange', () => {
  setTimeout(updateAcrosticUi, 200);
  setTimeout(renderLineInputs, 250);
  setTimeout(enhanceDetail, 500);
});
setTimeout(updateAcrosticUi, 400);
setTimeout(renderLineInputs, 500);
setTimeout(enhanceDetail, 700);
