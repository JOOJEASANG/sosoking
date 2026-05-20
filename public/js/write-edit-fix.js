import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function getParams() {
  const raw = (location.hash.split('?')[1] || '').split('#')[0];
  return new URLSearchParams(raw);
}

function getEditId() {
  const params = getParams();
  return params.get('edit') || params.get('postId') || '';
}

function isWriteEditPath() {
  return (location.hash || '').startsWith('#/write') && !!getEditId();
}

function splitTags(value) {
  return String(value || '')
    .split(',')
    .map(v => v.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function moduleLabels(modules = {}) {
  const labels = [];
  if (modules.vote?.enabled) labels.push('투표');
  if (modules.naming?.enabled) labels.push('작명');
  if (modules.acrostic?.enabled) labels.push('삼행시');
  if (modules.relay?.enabled) labels.push('릴레이');
  if (modules.quiz?.enabled) labels.push('문제');
  return labels;
}

function renderVoteOptions(modules = {}) {
  const options = Array.isArray(modules.vote?.options) ? modules.vote.options : [];
  if (!modules.vote?.enabled) return '';
  return `
    <div class="form-group">
      <label class="form-label">투표 질문</label>
      <input id="edit-vote-question" class="form-input" maxlength="100" value="${esc(modules.vote?.question || '')}" placeholder="투표 질문">
    </div>
    <div class="form-group">
      <label class="form-label">투표 선택지</label>
      <div id="edit-vote-options" class="owner-edit-options">
        ${options.map((opt, i) => `<input class="form-input edit-vote-option" maxlength="80" value="${esc(opt.text || opt || '')}" data-votes="${Number(opt.votes || 0)}" placeholder="선택지 ${i + 1}">`).join('')}
      </div>
      <div class="form-hint">투표 수는 유지하고 선택지 문구만 수정됩니다.</div>
    </div>`;
}

function renderModuleEditor(post) {
  const modules = post.modules || {};
  if (post.type !== 'multi') return '';
  const labels = moduleLabels(modules);
  return `
    <div class="card" style="margin-top:12px">
      <div class="card__body--lg">
        <div style="font-size:14px;font-weight:900;margin-bottom:8px">🧩 기존 놀이 기능</div>
        <div class="form-hint" style="margin-bottom:12px">수정 화면에서는 글쓰기 유형을 다시 고르지 않습니다. 기존 글의 기능만 필요한 범위에서 수정합니다.</div>
        ${labels.length ? `<div class="feed-card__multi-chips" style="margin-bottom:12px">${labels.map(label => `<span>${esc(label)}</span>`).join('')}</div>` : '<div class="form-hint">켜진 놀이 기능이 없습니다.</div>'}
        ${renderVoteOptions(modules)}
        ${modules.naming?.enabled ? `<div class="form-group"><label class="form-label">작명 글자수</label><select id="edit-naming-count" class="form-select"><option value="0" ${Number(modules.naming.charCount || 0) === 0 ? 'selected' : ''}>자유</option><option value="3" ${Number(modules.naming.charCount || 0) === 3 ? 'selected' : ''}>3글자</option><option value="5" ${Number(modules.naming.charCount || 0) === 5 ? 'selected' : ''}>5글자</option></select></div>` : ''}
        ${modules.acrostic?.enabled ? `<div class="form-group"><label class="form-label">삼행시 제시어</label><input id="edit-acrostic-keyword" class="form-input" maxlength="8" value="${esc(modules.acrostic.keyword || '')}"></div>` : ''}
        ${modules.relay?.enabled ? `<div class="form-group"><label class="form-label">릴레이 시작 문장</label><textarea id="edit-relay-start" class="form-textarea" rows="3" maxlength="300">${esc(modules.relay.startSentence || '')}</textarea></div>` : ''}
        ${modules.quiz?.enabled ? `<div class="form-group"><label class="form-label">문제</label><input id="edit-quiz-question" class="form-input" maxlength="160" value="${esc(modules.quiz.question || '')}"></div><div class="form-group"><label class="form-label">정답</label><input id="edit-quiz-answer" class="form-input" maxlength="80" value="${esc(modules.quiz.answer || '')}"></div>` : ''}
      </div>
    </div>`;
}

function collectModulesPatch(post) {
  if (post.type !== 'multi') return null;
  const original = post.modules || {};
  const modules = { ...original };

  if (modules.vote?.enabled) {
    const inputs = [...document.querySelectorAll('.edit-vote-option')];
    const options = inputs.map((input, i) => ({
      text: input.value.trim(),
      votes: Number(input.dataset.votes || original.vote?.options?.[i]?.votes || 0),
    })).filter(opt => opt.text);
    if (options.length < 2) throw new Error('투표 선택지는 2개 이상 필요합니다.');
    modules.vote = {
      ...original.vote,
      enabled: true,
      question: document.getElementById('edit-vote-question')?.value.trim() || original.vote?.question || '선택해주세요',
      options,
    };
  }

  if (modules.naming?.enabled) {
    modules.naming = { ...original.naming, enabled: true, charCount: Number(document.getElementById('edit-naming-count')?.value || 0) };
  }
  if (modules.acrostic?.enabled) {
    const keyword = document.getElementById('edit-acrostic-keyword')?.value.trim() || '';
    if ([...keyword].length < 2) throw new Error('삼행시 제시어는 2글자 이상 필요합니다.');
    modules.acrostic = { ...original.acrostic, enabled: true, keyword };
  }
  if (modules.relay?.enabled) {
    const startSentence = document.getElementById('edit-relay-start')?.value.trim() || '';
    if (!startSentence) throw new Error('릴레이 시작 문장을 입력해주세요.');
    modules.relay = { ...original.relay, enabled: true, startSentence };
  }
  if (modules.quiz?.enabled) {
    const question = document.getElementById('edit-quiz-question')?.value.trim() || '';
    const answer = document.getElementById('edit-quiz-answer')?.value.trim() || '';
    if (!question || !answer) throw new Error('문제와 정답을 모두 입력해주세요.');
    modules.quiz = { ...original.quiz, enabled: true, question, answer };
  }

  return modules;
}

function renderEditPage(post) {
  const el = document.getElementById('page-content');
  if (!el) return;
  const typeText = post.typeLabel || (post.type === 'multi' ? '만능 놀이글' : post.type || '게시글');
  el.innerHTML = `
    <div class="write-page post-edit-page" data-edit-post-id="${esc(post.id)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="edit-back" type="button">←</button>
        <h1 class="write-step-title">✏️ 게시글 수정</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          <div class="form-hint" style="margin-bottom:14px">기존 글 유형: <b>${esc(typeText)}</b> · 글쓰기 유형 버튼은 수정 화면에서 표시하지 않습니다.</div>
          <div class="form-group">
            <label class="form-label">제목 <span class="required">*</span></label>
            <input id="edit-title" class="form-input" maxlength="100" value="${esc(post.title || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">내용</label>
            <textarea id="edit-desc" class="form-textarea" rows="7" maxlength="2000">${esc(post.desc || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">태그</label>
            <input id="edit-tags" class="form-input" maxlength="120" value="${esc((post.tags || []).join(', '))}">
            <div class="form-hint">쉼표로 구분해 입력하세요.</div>
          </div>
        </div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" type="button" id="edit-cancel">취소</button>
            <button class="btn btn--primary" type="button" id="edit-save">수정 저장</button>
          </div>
        </div>
      </div>
      ${renderModuleEditor(post)}
    </div>`;

  document.getElementById('edit-back')?.addEventListener('click', () => navigate(`/detail/${post.id}`));
  document.getElementById('edit-cancel')?.addEventListener('click', () => navigate(`/detail/${post.id}`));
  document.getElementById('edit-save')?.addEventListener('click', () => saveEdit(post));
}

async function saveEdit(post) {
  const btn = document.getElementById('edit-save');
  const title = document.getElementById('edit-title')?.value.trim() || '';
  if (!title) {
    toast.error('제목을 입력해주세요.');
    return;
  }
  try {
    btn.disabled = true;
    btn.textContent = '저장 중...';
    const patch = {
      title,
      desc: document.getElementById('edit-desc')?.value.trim() || '',
      tags: splitTags(document.getElementById('edit-tags')?.value || ''),
      updatedAt: serverTimestamp(),
    };
    const modules = collectModulesPatch(post);
    if (modules) patch.modules = modules;
    await updateDoc(doc(db, 'feeds', post.id), patch);
    toast.success('게시글을 수정했어요.');
    navigate(`/detail/${post.id}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '수정 저장에 실패했어요.');
    btn.disabled = false;
    btn.textContent = '수정 저장';
  }
}

async function loadEditPage() {
  if (!isWriteEditPath()) return;
  const editId = getEditId();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const snap = await getDoc(doc(db, 'feeds', editId));
    if (!snap.exists()) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">수정할 글을 찾을 수 없어요</div></div>`;
      return;
    }
    const post = { id: snap.id, ...snap.data() };
    const uid = auth.currentUser?.uid;
    if (!uid) {
      navigate('/login');
      return;
    }
    renderEditPage(post);
  } catch (error) {
    console.error('[write-edit-fix] failed', error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">수정 화면을 불러오지 못했어요</div></div>`;
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(loadEditPage, 80);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
