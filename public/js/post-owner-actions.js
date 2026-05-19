import { auth, db, functions } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { escHtml } from './utils/helpers.js';

const TYPE_LABELS = {
  multi: '만능 놀이글',
  vote: '골라봐',
  initial_game: '초성게임',
  naming: '미친작명소',
  crazy_court: '억까재판',
  relay: '막장릴레이',
  acrostic: '삼행시짓기',
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
  if (!Array.isArray(post.options) || !['vote', 'crazy_court'].includes(post.type)) return '';
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
          <input type="checkbox" id="owner-multi-naming-enabled" ${moduleEnabled(post, 'naming') ? 'checked' : ''}>
          <span>😜 작명 참여</span>
        </label>
        <div class="owner-multi-module__body">
          <select class="form-select" id="owner-multi-naming-count">
            <option value="0" ${Number(modules.naming?.charCount || 0) === 0 ? 'selected' : ''}>자유</option>
            <option value="3" ${Number(modules.naming?.charCount || 0) === 3 ? 'selected' : ''}>3글자</option>
            <option value="5" ${Number(modules.naming?.charCount || 0) === 5 ? 'selected' : ''}>5글자</option>
          </select>
        </div>
      </div>

      <div class="owner-multi-module">
        <label class="owner-multi-module__head">
          <input type="checkbox" id="owner-multi-acrostic-enabled" ${moduleEnabled(post, 'acrostic') ? 'checked' : ''}>
          <span>✍️ 삼행시</span>
        </label>
        <div class="owner-multi-module__body">
          <input class="form-input" id="owner-multi-acrostic-keyword" value="${toInput(modules.acrostic?.keyword)}" maxlength="8" placeholder="제시어">
        </div>
      </div>

      <div class="owner-multi-module">
        <label class="owner-multi-module__head">
          <input type="checkbox" id="owner-multi-relay-enabled" ${moduleEnabled(post, 'relay') ? 'checked' : ''}>
          <span>🎭 릴레이</span>
        </label>
        <div class="owner-multi-module__body">
          <textarea class="form-textarea" id="owner-multi-relay-start" rows="3" maxlength="300" placeholder="시작 문장">${toInput(modules.relay?.startSentence)}</textarea>
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
  if (post.type === 'naming') {
    return `
      <div class="form-group">
        <label class="form-label">글자수 제한</label>
        <select class="form-select" id="owner-edit-char-count">
          <option value="0" ${Number(post.charCount || 0) === 0 ? 'selected' : ''}>자유</option>
          <option value="3" ${Number(post.charCount || 0) === 3 ? 'selected' : ''}>3글자</option>
          <option value="5" ${Number(post.charCount || 0) === 5 ? 'selected' : ''}>5글자</option>
        </select>
      </div>`;
  }
  if (post.type === 'initial_game') {
    return `
      <div class="form-group">
        <label class="form-label">초성</label>
        <input class="form-input" id="owner-edit-initials" value="${toInput(post.initials)}" maxlength="8">
      </div>`;
  }
  if (post.type === 'crazy_court') {
    return `
      <div class="form-group">
        <label class="form-label">추가 증거 / 변명</label>
        <input class="form-input" id="owner-edit-evidence" value="${toInput(post.evidence)}" maxlength="120">
      </div>`;
  }
  if (post.type === 'relay') {
    return `
      <div class="form-group">
        <label class="form-label">시작 문장</label>
        <textarea class="form-textarea" id="owner-edit-start" rows="3" maxlength="300">${toInput(post.startSentence)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">등장인물</label>
        <input class="form-input" id="owner-edit-characters" value="${toInput(post.characters)}" maxlength="200">
      </div>`;
  }
  if (post.type === 'acrostic') {
    return `
      <div class="form-group">
        <label class="form-label">제시어</label>
        <input class="form-input" id="owner-edit-keyword" value="${toInput(post.keyword)}" maxlength="8">
        <div class="form-hint">제시어를 바꾸면 새 참여자는 바뀐 제시어로 작성하게 됩니다.</div>
      </div>`;
  }
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
          <textarea class="form-textarea" id="owner-edit-desc" rows="5" maxlength="2000">${toInput(post.desc)}</textarea>
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

  if (document.getElementById('owner-multi-naming-enabled')?.checked) {
    modules.naming = {
      enabled: true,
      charCount: Number(document.getElementById('owner-multi-naming-count')?.value || 0),
    };
  }

  if (document.getElementById('owner-multi-acrostic-enabled')?.checked) {
    const keyword = document.getElementById('owner-multi-acrostic-keyword')?.value.trim() || '';
    if ([...keyword].length < 2) throw new Error('삼행시 제시어는 2글자 이상 입력해주세요.');
    modules.acrostic = { enabled: true, keyword };
  }

  if (document.getElementById('owner-multi-relay-enabled')?.checked) {
    const startSentence = document.getElementById('owner-multi-relay-start')?.value.trim() || '';
    if (!startSentence) throw new Error('릴레이 시작 문장을 입력해주세요.');
    modules.relay = { enabled: true, startSentence };
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
  if (post.type === 'initial_game') {
    const initials = document.getElementById('owner-edit-initials')?.value.trim() || '';
    if (!initials) throw new Error('초성을 입력해주세요.');
    patch.initials = initials;
    patch.answerLength = [...initials].length;
    patch.title = `초성게임: ${initials}`;
  }
  if (post.type === 'crazy_court') patch.evidence = document.getElementById('owner-edit-evidence')?.value.trim() || '';
  if (post.type === 'relay') {
    patch.startSentence = document.getElementById('owner-edit-start')?.value.trim() || '';
    patch.characters = document.getElementById('owner-edit-characters')?.value.trim() || '';
  }
  if (post.type === 'acrostic') {
    const keyword = document.getElementById('owner-edit-keyword')?.value.trim() || '';
    if (!keyword) throw new Error('제시어를 입력해주세요.');
    patch.keyword = keyword;
    patch.title = `'${keyword}' 삼행시 도전!`;
  }

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
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureOwnerActions, 160);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
