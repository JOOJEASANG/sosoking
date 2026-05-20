import { auth, db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';

const PRESETS = {
  general: { label: '일반글', icon: '📝', titlePlaceholder: '예: 오늘 있었던 웃긴 일', descPlaceholder: '글, 사진, 질문, 상황 설명 등을 자유롭게 적어보세요.', tagsPlaceholder: '#일상, #피드, #소소킹' },
  vote: { label: '투표/판정', icon: '🗳️', titlePlaceholder: '예: 여러분의 판정은?', descPlaceholder: '투표/판정받을 질문이나 상황을 본문에 적어주세요.', tagsPlaceholder: '#투표, #판정', voteOptionPlaceholders: ['그렇다', '아니다'] },
  naming: { label: '미친작명소', icon: '😜', titlePlaceholder: '예: 이 사진 이름 좀 지어줘', descPlaceholder: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.', tagsPlaceholder: '#작명, #미친작명소' },
  acrostic: { label: '삼행시', icon: '✍️', titlePlaceholder: '예: 삼행시 도전', descPlaceholder: '제시어를 넣고 사람들이 한 줄씩 완성하게 해보세요.', tagsPlaceholder: '#삼행시, #제시어', acrosticPlaceholder: '예: 소소킹' },
  quiz: { label: '퀴즈', icon: '🧠', titlePlaceholder: '예: 퀴즈 도전', descPlaceholder: '맞혀야 할 문제를 본문에 적어주세요.', tagsPlaceholder: '#퀴즈, #문제', quizAnswerPlaceholder: '예: 소' },
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const preset = new URLSearchParams(query).get('preset') || 'general';
  return PRESETS[preset] ? preset : 'general';
}

function renderPresetButtons(activeKey) {
  return `
    <div class="multi-preset-box multi-preset-box--simple">
      <div class="multi-preset-box__title">글쓰기 형식</div>
      <div class="multi-preset-box__desc">기본은 일반글입니다. 형식을 선택하면 아래 입력 항목이 바뀝니다.</div>
      <div class="multi-preset-list">
        ${Object.entries(PRESETS).map(([key, p]) => `
          <button type="button" class="multi-preset-btn ${activeKey === key ? 'active' : ''}" data-multi-preset="${key}" aria-pressed="${activeKey === key ? 'true' : 'false'}">${p.icon} ${p.label}</button>`).join('')}
      </div>
    </div>`;
}

function moduleCard(key, icon, title, desc, body) {
  return `
    <div class="multi-module is-enabled multi-module--selected" data-module-card="${key}">
      <input type="hidden" data-module-toggle="${key}" value="1">
      <div class="multi-module__head multi-module__head--static">
        <span class="multi-module__icon">${icon}</span>
        <span class="multi-module__text"><b>${title}</b><small>${desc}</small></span>
      </div>
      <div class="multi-module__body">${body}</div>
    </div>`;
}

function renderQuizOptionRows(count = 2) {
  return Array.from({ length: count }, (_, i) => `
    <div class="multi-quiz-option-row">
      <label class="multi-quiz-answer-pick"><input type="radio" name="mw-quiz-correct" value="${i}" ${i === 0 ? 'checked' : ''}> 정답</label>
      <input class="form-input mw-quiz-option" maxlength="80" placeholder="선택지 ${i + 1}">
    </div>`).join('');
}

function renderSelectedModule(activeKey, preset) {
  if (activeKey === 'general') {
    return `<div class="multi-general-note"><b>일반글</b><span>제목, 본문, 사진, 태그만 저장됩니다. 댓글과 답글만 사용할 수 있습니다.</span></div>`;
  }

  if (activeKey === 'vote') {
    return moduleCard('vote', '🗳️', '투표/판정', '본문에 적은 질문/상황을 기준으로 선택지만 입력합니다.', `
      <div class="multi-module-inline-note">질문이나 상황 설명은 위 <b>본문</b>에 적어주세요.</div>
      <div class="multi-option-list" id="mw-vote-options">${preset.voteOptionPlaceholders.map((v, i) => `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${i + 1} · 예: ${esc(v)}">`).join('')}</div>
      <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option">+ 선택지 추가</button>`);
  }

  if (activeKey === 'naming') {
    return moduleCard('naming', '😜', '미친작명소', '다른 사용자가 웃긴 이름을 등록할 수 있습니다.', `
      <div class="form-group"><label class="form-label">글자수 제한</label><select id="mw-naming-count" class="form-select"><option value="0">자유</option><option value="3">3글자</option><option value="5">5글자</option></select></div>`);
  }

  if (activeKey === 'acrostic') {
    return moduleCard('acrostic', '✍️', '삼행시', '제시어를 입력하면 다른 사용자가 글자별로 한 줄씩 작성할 수 있습니다.', `
      <div class="form-group"><label class="form-label">제시어 <span class="required">*</span></label><input id="mw-acrostic-keyword" class="form-input" maxlength="8" placeholder="${esc(preset.acrosticPlaceholder)}"></div>`);
  }

  if (activeKey === 'quiz') {
    return moduleCard('quiz', '🧠', '퀴즈', '본문에 적은 문제를 기준으로 정답 기능만 설정합니다.', `
      <div class="multi-module-inline-note">문제는 위 <b>본문</b>에 적어주세요.</div>
      <div class="form-group">
        <label class="form-label">퀴즈 방식 <span class="required">*</span></label>
        <input type="hidden" id="mw-quiz-mode" value="subjective">
        <div class="multi-quiz-mode-toggle" role="radiogroup" aria-label="퀴즈 방식 선택">
          <button type="button" class="multi-quiz-mode-btn active" data-quiz-mode="subjective" role="radio" aria-checked="true">주관식</button>
          <button type="button" class="multi-quiz-mode-btn" data-quiz-mode="multiple" role="radio" aria-checked="false">객관식</button>
        </div>
      </div>
      <div id="mw-quiz-subjective-box" class="form-group"><label class="form-label">정답 <span class="required">*</span></label><input id="mw-quiz-answer" class="form-input" maxlength="80" placeholder="${esc(preset.quizAnswerPlaceholder)}"></div>
      <div id="mw-quiz-multiple-box" style="display:none">
        <div class="form-group">
          <label class="form-label">객관식 선택지와 정답 <span class="required">*</span></label>
          <div class="multi-option-list" id="mw-quiz-options">${renderQuizOptionRows(2)}</div>
          <button class="btn btn--ghost btn--sm" type="button" id="mw-add-quiz-option">+ 선택지 추가</button>
        </div>
      </div>`);
  }

  return '';
}

function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const renderKey = window.location.hash || '#/write?type=multi';
  const presetKey = getPresetKey();
  const preset = PRESETS[presetKey] || PRESETS.general;
  const bodyRequired = presetKey === 'vote' || presetKey === 'quiz';
  const bodyLabel = presetKey === 'vote' ? '본문 · 질문/상황' : presetKey === 'quiz' ? '본문 · 문제' : '본문';

  el.innerHTML = `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}">
      <div class="write-step-header"><button class="write-back-btn" id="multi-back-type" type="button">←</button><h1 class="write-step-title">🧩 피드 글쓰기</h1></div>
      ${renderPresetButtons(presetKey)}
      <div class="card">
        <div class="card__body--lg">
          <div class="form-group"><label class="form-label">제목 <span class="required">*</span></label><input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder)}"></div>
          <div class="form-group"><label class="form-label">${bodyLabel}${bodyRequired ? ' <span class="required">*</span>' : ''}</label><textarea id="mw-desc" class="form-textarea" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea></div>
          <div class="form-group"><label class="form-label">사진</label><div id="mw-img-uploader"></div><div class="form-hint">사진 개수 제한 없이 올릴 수 있어요.</div></div>
          <div class="form-group"><label class="form-label">태그</label><input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder)}"></div>
          <div class="multi-module-list multi-module-list--selected">${renderSelectedModule(presetKey, preset)}</div>
          <div class="multi-comment-note">💬 댓글과 답글은 항상 켜져 있습니다.</div>
        </div>
        <div class="card__footer"><div class="write-submit"><button class="btn btn--ghost" type="button" id="multi-cancel">취소</button><button class="btn btn--primary" type="button" id="multi-submit">올리기</button></div></div>
      </div>
    </div>`;

  const uploader = document.getElementById('mw-img-uploader');
  if (uploader) initImageUploader(uploader, Infinity);
  bindMultiWriteEvents();
}

function setQuizMode(mode) {
  const normalized = mode === 'multiple' ? 'multiple' : 'subjective';
  const hidden = document.getElementById('mw-quiz-mode');
  if (hidden) hidden.value = normalized;
  document.querySelectorAll('[data-quiz-mode]').forEach(btn => {
    const active = btn.dataset.quizMode === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  const isMultiple = normalized === 'multiple';
  const subjective = document.getElementById('mw-quiz-subjective-box');
  const multiple = document.getElementById('mw-quiz-multiple-box');
  if (subjective) subjective.style.display = isMultiple ? 'none' : '';
  if (multiple) multiple.style.display = isMultiple ? '' : 'none';
}

function bindMultiWriteEvents() {
  document.getElementById('multi-back-type')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));

  document.querySelectorAll('[data-multi-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.multiPreset;
      const nextHash = preset === 'general' ? '#/write?type=multi' : `#/write?type=multi&preset=${preset}`;
      history.pushState(null, '', nextHash);
      renderMultiWrite();
    });
  });

  document.getElementById('mw-add-vote-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-vote-options');
    const count = list?.querySelectorAll('.mw-vote-option').length || 0;
    if (count >= 8) { toast.warn('선택지는 최대 8개까지 가능해요'); return; }
    list.insertAdjacentHTML('beforeend', `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${count + 1}">`);
  });

  document.querySelectorAll('[data-quiz-mode]').forEach(btn => {
    btn.addEventListener('click', () => setQuizMode(btn.dataset.quizMode));
  });

  document.getElementById('mw-add-quiz-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-quiz-options');
    const count = list?.querySelectorAll('.mw-quiz-option').length || 0;
    if (count >= 6) { toast.warn('객관식 선택지는 최대 6개까지 가능해요'); return; }
    list.insertAdjacentHTML('beforeend', `
      <div class="multi-quiz-option-row">
        <label class="multi-quiz-answer-pick"><input type="radio" name="mw-quiz-correct" value="${count}"> 정답</label>
        <input class="form-input mw-quiz-option" maxlength="80" placeholder="선택지 ${count + 1}">
      </div>`);
  });

  document.getElementById('multi-submit')?.addEventListener('click', submitMultiPost);
}

function enabled(key) {
  return !!document.querySelector(`[data-module-toggle="${key}"]`);
}

function splitTags(raw) {
  return String(raw || '').split(',').map(t => t.replace('#', '').trim()).filter(Boolean).slice(0, 8);
}

function getBodyText() {
  return document.getElementById('mw-desc')?.value.trim() || '';
}

function collectModules() {
  const modules = { comments: { enabled: true } };
  const bodyText = getBodyText();

  if (enabled('vote')) {
    const question = bodyText;
    const options = [...document.querySelectorAll('.mw-vote-option')].map(i => i.value.trim()).filter(Boolean);
    if (!question) throw new Error('본문에 투표/판정 질문이나 상황을 입력해주세요.');
    if (options.length < 2) throw new Error('투표 선택지를 2개 이상 입력해주세요.');
    modules.vote = { enabled: true, question, options: options.map(text => ({ text, votes: 0 })) };
  }

  if (enabled('naming')) {
    modules.naming = { enabled: true, charCount: Number(document.getElementById('mw-naming-count')?.value || 0) };
  }

  if (enabled('acrostic')) {
    const keyword = document.getElementById('mw-acrostic-keyword')?.value.trim() || '';
    if ([...keyword].length < 2) throw new Error('삼행시 제시어는 2글자 이상 입력해주세요.');
    modules.acrostic = { enabled: true, keyword };
  }

  if (enabled('quiz')) {
    const question = bodyText;
    const mode = document.getElementById('mw-quiz-mode')?.value || 'subjective';
    if (!question) throw new Error('본문에 퀴즈 문제를 입력해주세요.');

    if (mode === 'multiple') {
      const rawOptions = [...document.querySelectorAll('.mw-quiz-option')].map(i => i.value.trim());
      const options = rawOptions.filter(Boolean);
      const correctIndex = Number(document.querySelector('input[name="mw-quiz-correct"]:checked')?.value || 0);
      const answer = rawOptions[correctIndex] || '';
      if (options.length < 2) throw new Error('객관식 선택지를 2개 이상 입력해주세요.');
      if (!answer.trim()) throw new Error('정답으로 선택한 객관식 선택지를 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'multiple', question, options: options.map(text => ({ text })), answer };
    } else {
      const answer = document.getElementById('mw-quiz-answer')?.value.trim() || '';
      if (!answer) throw new Error('정답을 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'subjective', question, answer };
    }
  }

  return modules;
}

async function submitMultiPost() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const btn = document.getElementById('multi-submit');
  const title = document.getElementById('mw-title')?.value.trim() || '';
  const presetKey = getPresetKey();
  const preset = PRESETS[presetKey] || PRESETS.general;
  const desc = getBodyText();
  if (!title) { toast.error('제목을 입력해주세요.'); return; }

  try {
    const modules = collectModules();
    btn.disabled = true;
    btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '올리는 중...';
    const images = await getUploadedImages();
    btn.textContent = '게시글 저장 중...';

    const docRef = await addDoc(collection(db, 'feeds'), {
      type: 'multi',
      cat: 'multi',
      subtype: presetKey,
      typeLabel: preset.label,
      title,
      desc,
      tags: splitTags(document.getElementById('mw-tags')?.value || ''),
      images,
      modules,
      authorId: auth.currentUser.uid,
      authorName: appState.nickname || auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      authorEmail: auth.currentUser.email || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
    });
    toast.success('피드 글을 올렸어요! 🎉');
    navigate(`/detail/${docRef.id}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '올리기에 실패했어요.');
    btn.disabled = false;
    btn.textContent = '올리기';
  }
}

function run() {
  if (isMultiQuery()) {
    const page = document.querySelector('.multi-write-page');
    const key = window.location.hash || '#/write?type=multi';
    if (!page || page.dataset.renderKey !== key) renderMultiWrite();
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
