import { auth, db, functions } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { escHtml } from './utils/helpers.js';

function descToPlain(raw) {
  const s = String(raw || '');
  if (!/<[a-z]/i.test(s)) return s;
  const tmp = document.createElement('div');
  tmp.innerHTML = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

const TYPE_LABELS = {
  multi: '만능 놀이글',
  vote: '투표·판정',
  naming: '미친작명소',
};

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function cleanTags(value) {
  return String(value || '')
    .split(',')
    .map(v => v.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function toInput(value) {
  return escHtml(String(value || ''));
}

function hasOwnerToolbar(root) {
  return !!root.querySelector('[data-owner-toolbar="true"]');
}

async function fetchCurrentPost() {
  const postId = getDetailId();
  if (!postId) return null;
  const snap = await getDoc(doc(db, 'feeds', postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

function canEdit(post) {
  const uid = auth.currentUser?.uid;
  return !!uid && !!post && post.authorId === uid;
}

function renderToolbar(post) {
  return `
    <div class="owner-toolbar" data-owner-toolbar="true">
      <button type="button" class="btn btn--ghost btn--sm" id="btn-owner-edit">✏️ 수정</button>
      <button type="button" class="btn btn--ghost btn--sm owner-delete-btn" id="btn-owner-delete">🗑️ 삭제</button>
    </div>`;
}

function renderOptionsEditor(post) {
  if (!Array.isArray(post.options) || post.type !== 'vote') return '';
  return `
    <div class="form-group">
      <label class="form-label">선택지</label>
      <div id="owner-edit-options" class="owner-edit-options">
        ${post.options.map((opt, i) => {
          const text = typeof opt === 'object' ? opt.text : opt;
          return `<input class="form-input owner-edit-option" value="${toInput(text)}" maxlength="80" placeholder="선택지 ${i + 1}">`;
        }).join('')}
      </div>
      <div class="form-hint">투표 수는 유지되고 선택지 이름만 수정됩니다.</div>
    </div>`;
}

function moduleEnabled(post, key) {
  return !!post.modules?.[key]?.enabled;
}

function renderMultiVoteOptions(post) {
  const options = post.modules?.vote?.options || [{ text: '', votes: 0 }, { text: '', votes: 0 }];
  const normalized = options.length >= 2 ? options : [{ text: '', votes: 0 }, { text: '', votes: 0 }];
  return normalized.map((opt, i) => `<input class="form-input owner-multi-vote-option" value="${toInput(opt.text)}" maxlength="80" placeholder="선택지 ${i + 1}" data-votes="${Number(opt.votes || 0)}">`).join('');
}

function renderMultiModulesEditor(post) {
  const modules = post.modules || {};
  return `
    <div class="owner-multi-edit">
      <div class="owner-multi-edit__title">🧩 만능 놀이 기능 수정</div>
      <div class="owner-multi-edit__hint">켜진 기능과 기본 설정을 수정할 수 있습니다. 기존 참여글은 유지됩니다.</div>

      <div class="owner-multi-module">
        <label class="owner-multi-module__head">
          <input type="checkbox" id="owner-multi-vote-enabled" ${moduleEnabled(post, 'vote') ? 'checked' : ''}>
          <span>🗳️ 투표</span>
        </label>
        <div class="owner-multi-module__body">
          <input class="form-input" id="owner-multi-vote-question" value="${toInput(modules.vote?.question)}" maxlength="100" placeholder="투표 질문">
          <div class="owner-edit-options" id="owner-multi-vote-options">${renderMultiVoteOptions(post)}</div>
          <button type="button" class="btn btn--ghost btn--sm" id="owner-add-multi-vote-option">+ 선택지 추가</button>
        </div>
      </div>

      <div class="owner-multi-module">
        <label class="owner-multi-module__head">
          <input type="checkbox" id="owner-multi-quiz-enabled" ${moduleEnabled(post, 'quiz') ? 'checked' : ''}>
          <span>🧠 간단 문제</span>
        </label>
        <div class="owner-multi-module__body">
          <input class="form-input" id="owner-multi-quiz-question" value="${toInput(modules.quiz?.question)}" maxlength="160" placeholder="문제">
          <input class="form-input" id="owner-multi-quiz-answer" value="${toInput(modules.quiz?.answer)}" maxlength="80" placeholder="정답">
        </div>
      </div>
    </div>`;
}

function renderTypeExtraEditor(post) {
  if (post.type === 'multi') return renderMultiModulesEditor(post);
  return '';
}

function bindMultiEditEvents(overlay) {
  const addBtn = overlay.querySelector('#owner-add-multi-vote-option');
  addBtn?.addEventListener('click', () => {
    const list = overlay.querySelector('#owner-multi-vote-options');
    const count = list?.querySelectorAll('.owner-multi-vote-option').length || 0;
    if (count >= 8) { toast.warn('선택지는 최대 8개까지 수정할 수 있어요'); return; }
    list.insertAdjacentHTML('beforeend', `<input class="form-input owner-multi-vote-option" maxlength="80" placeholder="선택지 ${count + 1}" data-votes="0">`);
  });
}

function openEditModal(post) {
  document.getElementById('owner-edit-modal')?.remove();
  const typeLabel = TYPE_LABELS[post.type] || post.type || '게시글';
  const overlay = document.createElement('div');
  overlay.id = 'owner-edit-modal';
  overlay.className = 'owner-edit-modal';
  overlay.innerHTML = `
    <div class="owner-edit-modal__backdrop"></div>
    <div class="owner-edit-modal__panel">
      <div class="owner-edit-modal__header">
        <div>
          <div class="owner-edit-modal__eyebrow">${escHtml(typeLabel)} 수정</div>
          <div class="owner-edit-modal__title">내 게시글 수정</div>
        </div>
        <button type="button" class="owner-edit-modal__close" id="owner-edit-close">✕</button>
      </div>
      <div class="owner-edit-modal__body">
        <div class="form-group">
          <label class="form-label">제목</label>
          <input class="form-input" id="owner-edit-title" value="${toInput(post.title)}" maxlength="100">
        </div>
        <div class="form-group">
          <label class="form-label">내용</label>
          <textarea class="form-textarea" id="owner-edit-desc" rows="5" maxlength="2000">${escHtml(descToPlain(post.desc))}</textarea>
        </div>
        ${renderOptionsEditor(post)}
        ${renderTypeExtraEditor(post)}
        <div class="form-group">
          <label class="form-label">태그</label>
          <input class="form-input" id="owner-edit-tags" value="${toInput((post.tags || []).join(', '))}" maxlength="120">
          <div class="form-hint">쉼표로 구분해 입력하세요.</div>
        </div>
        <div class="owner-edit-note">사진 교체는 다음 단계에서 붙일 수 있게 두고, 이번 수정은 텍스트/선택지/유형별 기본 정보만 저장합니다.</div>
      </div>
      <div class="owner-edit-modal__footer">
        <button type="button" class="btn btn--ghost" id="owner-edit-cancel">취소</button>
        <button type="button" class="btn btn--primary" id="owner-edit-save">저장</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#owner-edit-close')?.addEventListener('click', close);
  overlay.querySelector('#owner-edit-cancel')?.addEventListener('click', close);
  overlay.querySelector('.owner-edit-modal__backdrop')?.addEventListener('click', close);
  overlay.querySelector('#owner-edit-save')?.addEventListener('click', () => saveEdit(post, overlay));
  bindMultiEditEvents(overlay);
}

function collectMultiModules(post) {
  const original = post.modules || {};
  const modules = { comments: { enabled: true } };

  if (document.getElementById('owner-multi-vote-enabled')?.checked) {
    const inputs = [...document.querySelectorAll('.owner-multi-vote-option')];
    const options = inputs.map((input, i) => ({
      text: input.value.trim(),
      votes: Number(input.dataset.votes || original.vote?.options?.[i]?.votes || 0),
    })).filter(opt => opt.text);
    if (options.length < 2) throw new Error('투표 선택지는 2개 이상 필요합니다.');
    modules.vote = {
      enabled: true,
      question: document.getElementById('owner-multi-vote-question')?.value.trim() || '선택해주세요',
      options,
      votedBy: Array.isArray(original.vote?.votedBy) ? original.vote.votedBy : [],
    };
  }

  if (document.getElementById('owner-multi-quiz-enabled')?.checked) {
    const question = document.getElementById('owner-multi-quiz-question')?.value.trim() || '';
    const answer = document.getElementById('owner-multi-quiz-answer')?.value.trim() || '';
    if (!question || !answer) throw new Error('문제와 정답을 모두 입력해주세요.');
    modules.quiz = { enabled: true, question, answer };
  }

  return modules;
}

function collectPatch(post) {
  const title = document.getElementById('owner-edit-title')?.value.trim();
  if (!title) throw new Error('제목을 입력해주세요.');

  const patch = {
    title,
    desc: document.getElementById('owner-edit-desc')?.value.trim() || '',
    tags: cleanTags(document.getElementById('owner-edit-tags')?.value || ''),
    updatedAt: serverTimestamp(),
  };

  const optionInputs = [...document.querySelectorAll('.owner-edit-option')];
  if (optionInputs.length) {
    const labels = optionInputs.map(input => input.value.trim()).filter(Boolean);
    if (labels.length < 2) throw new Error('선택지는 2개 이상 필요합니다.');
    patch.options = (post.options || []).map((old, i) => {
      const text = labels[i] || (typeof old === 'object' ? old.text : old) || `선택지 ${i + 1}`;
      const votes = typeof old === 'object' ? Number(old.votes || 0) : 0;
      return { text, votes };
    });
  }

  if (post.type === 'multi') patch.modules = collectMultiModules(post);
  if (post.type === 'naming') patch.charCount = Number(document.getElementById('owner-edit-char-count')?.value || 0);
  return patch;
}

async function saveEdit(post, overlay) {
  const btn = overlay.querySelector('#owner-edit-save');
  try {
    const patch = collectPatch(post);
    btn.disabled = true;
    btn.textContent = '저장 중...';
    await updateDoc(doc(db, 'feeds', post.id), patch);
    toast.success('게시글을 수정했어요.');
    overlay.remove();
    navigate(`/detail/${post.id}`);
    setTimeout(() => window.dispatchEvent(new Event('hashchange')), 60);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '수정에 실패했어요.');
    btn.disabled = false;
    btn.textContent = '저장';
  }
}

async function deletePost(post) {
  if (!confirm('이 게시글을 삭제할까요? 삭제하면 복구하기 어렵습니다.')) return;
  if (!confirm('댓글, 삼행시, 스크랩 정보도 함께 정리됩니다. 정말 삭제할까요?')) return;

  try {
    const fn = httpsCallable(functions, 'deleteOwnPost');
    await fn({ postId: post.id });
    toast.success('게시글을 삭제했어요.');
    navigate('/feed');
  } catch (error) {
    console.error(error);
    toast.error(error.message || '삭제에 실패했어요.');
  }
}

async function ensureOwnerActions() {
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || hasOwnerToolbar(root)) return;
  const header = root.querySelector('.detail-header');
  if (!header) return;

  try {
    const post = await fetchCurrentPost();
    if (!canEdit(post)) return;
    header.insertAdjacentHTML('beforeend', renderToolbar(post));
    document.getElementById('btn-owner-edit')?.addEventListener('click', () => openEditModal(post));
    document.getElementById('btn-owner-delete')?.addEventListener('click', () => deletePost(post));
  } catch (error) {
    console.warn('[post-owner-actions] failed', error);
  }
}

let timer = null;
function schedule(delay = 160) {
  clearTimeout(timer);
  timer = setTimeout(ensureOwnerActions, delay);
}

// auth 상태 변경(로그인 완료) 시 즉시 재시도
onAuthStateChanged(auth, user => { if (user) schedule(80); });

window.addEventListener('hashchange', () => schedule(200));
new MutationObserver(() => schedule()).observe(document.body, { childList: true, subtree: true });
setTimeout(() => schedule(600), 0);
