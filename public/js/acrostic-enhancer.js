import { db, auth } from './firebase.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function isAcrosticWritePage() {
  const hash = window.location.hash || '';
  return hash.startsWith('#/write') && hash.includes('type=acrostic');
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
  return clean(document.getElementById('f-keyword')?.value || '', 12);
}

function renderLineInputs() {
  if (!isAcrosticWritePage()) return;
  const keyword = getKeyword();
  const box = document.getElementById('acrostic-lines');
  if (!box || !keyword) return;

  const chars = [...keyword];
  const current = [...box.querySelectorAll('.acrostic-line-input')].map(input => input.value || '');
  if (box.dataset.keyword === keyword && box.querySelectorAll('.acrostic-line-input').length === chars.length) return;
  box.dataset.keyword = keyword;
  box.innerHTML = `
    <div class="acrostic-lines-box">
      <div style="font-size:12px;font-weight:800;color:var(--color-text-muted);margin-bottom:10px">글자마다 한 줄씩 입력하세요</div>
      ${chars.map((ch, i) => `
        <div class="acrostic-line-row">
          <span class="acrostic-line-char">${escapeHtml(ch)}</span>
          <input class="form-input acrostic-line-input" id="acrostic-line-${i}" data-char="${escapeHtml(ch)}" placeholder="${escapeHtml(ch)}로 시작하는 한 줄" maxlength="80" value="${escapeHtml(current[i] || '')}">
        </div>`).join('')}
    </div>`;
}

function collectData() {
  const keyword = getKeyword();
  if (!keyword || keyword.length < 2) {
    toast.error('제시어를 2글자 이상 입력해주세요');
    return null;
  }
  renderLineInputs();

  const acrosticLines = [...keyword].map((char, index) => ({
    char,
    line: clean(document.getElementById(`acrostic-line-${index}`)?.value || '', 80),
  }));

  if (acrosticLines.some(item => !item.line)) {
    toast.error('각 글자마다 한 줄씩 입력해주세요');
    return null;
  }

  const tagsRaw = document.getElementById('f-tags')?.value || '';
  const tags = tagsRaw.split(',').map(t => t.replace('#', '').trim()).filter(Boolean);
  if (!tags.includes('삼행시')) tags.unshift('삼행시');
  if (!tags.includes('소소킹')) tags.push('소소킹');

  return {
    type: 'acrostic',
    cat: 'usgyo',
    title: `'${keyword}' 삼행시 도전!`,
    keyword,
    desc: clean(document.getElementById('f-desc')?.value || `${keyword} 제시어로 만든 삼행시입니다.`, 1000),
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
    toast.success('삼행시를 올렸어요!');
    navigate('/feed');
  } catch (error) {
    console.error(error);
    toast.error('삼행시 올리기에 실패했어요');
    btn.disabled = false;
    btn.textContent = oldText || '올리기';
  }
}

function renderMainAcrosticLines(post) {
  const body = document.querySelector('.detail-body');
  if (!body || body.querySelector('[data-main-acrostic-lines]')) return;

  const keyword = post.keyword || '';
  const lines = Array.isArray(post.acrosticLines) && post.acrosticLines.length
    ? post.acrosticLines
    : Array.isArray(post.lines)
      ? [...keyword].map((char, index) => ({ char, line: post.lines[index] || '' }))
      : [];
  if (!keyword || !lines.length) return;

  const html = `
    <div data-main-acrostic-lines style="padding:16px;background:#F3F4F6;border-radius:10px;margin-top:8px">
      <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:10px">제시어: ${escapeHtml(keyword)}</div>
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
  if (event.target?.id === 'f-keyword') setTimeout(renderLineInputs, 0);
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
  setTimeout(renderLineInputs, 250);
  setTimeout(enhanceDetail, 500);
});
setTimeout(renderLineInputs, 500);
setTimeout(enhanceDetail, 700);
