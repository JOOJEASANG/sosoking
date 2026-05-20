import { auth, db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';
import { awardPoints } from './utils/points.js';
import { MULTI_PRESETS, getMultiPresetFromHash } from './multi-write/presets.js';
import { renderMultiWriteHTML, renderQuizOptionRows } from './multi-write/render.js';

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  return getMultiPresetFromHash(window.location.hash || '');
}

function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const renderKey = window.location.hash || '#/write?type=multi';
  const presetKey = getPresetKey();
  el.innerHTML = renderMultiWriteHTML({ renderKey, presetKey });

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

function setNamingCount(count) {
  const normalized = ['0', '3', '5'].includes(String(count)) ? String(count) : '0';
  const hidden = document.getElementById('mw-naming-count');
  if (hidden) hidden.value = normalized;
  document.querySelectorAll('[data-naming-count]').forEach(btn => {
    const active = btn.dataset.namingCount === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function bindMultiWriteEvents() {
  document.getElementById('multi-back-type')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));

  document.querySelectorAll('[data-multi-preset]').forEach(btn => btn.addEventListener('click', () => {
    const preset = btn.dataset.multiPreset;
    const nextHash = preset === 'general' ? '#/write?type=multi' : `#/write?type=multi&preset=${preset}`;
    history.pushState(null, '', nextHash);
    renderMultiWrite();
  }));

  document.getElementById('mw-add-vote-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-vote-options');
    const count = list?.querySelectorAll('.mw-vote-option').length || 0;
    if (count >= 8) {
      toast.warn('선택지는 최대 8개까지 가능해요');
      return;
    }
    list.insertAdjacentHTML('beforeend', `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${count + 1}">`);
  });

  document.querySelectorAll('[data-quiz-mode]').forEach(btn => btn.addEventListener('click', () => setQuizMode(btn.dataset.quizMode)));
  document.querySelectorAll('[data-naming-count]').forEach(btn => btn.addEventListener('click', () => setNamingCount(btn.dataset.namingCount)));

  document.getElementById('mw-add-quiz-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-quiz-options');
    const count = list?.querySelectorAll('.mw-quiz-option').length || 0;
    if (count >= 6) {
      toast.warn('객관식 선택지는 최대 6개까지 가능해요');
      return;
    }
    list.insertAdjacentHTML('beforeend', renderQuizOptionRows(count + 1).split('</div>').slice(-2, -1)[0] + '</div>');
  });

  document.getElementById('multi-submit')?.addEventListener('click', submitMultiPost);
}

function enabled(key) {
  return !!document.querySelector(`[data-module-toggle="${key}"]`);
}

function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(t => t.replace('#', '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function getBodyText() {
  return document.getElementById('mw-desc')?.value.trim() || '';
}

function collectModules() {
  const modules = { comments: { enabled: true } };
  const bodyText = getBodyText();

  if (enabled('vote')) {
    const options = [...document.querySelectorAll('.mw-vote-option')].map(i => i.value.trim()).filter(Boolean);
    if (!bodyText) throw new Error('본문에 투표/판정 질문이나 상황을 입력해주세요.');
    if (options.length < 2) throw new Error('투표 선택지를 2개 이상 입력해주세요.');
    modules.vote = { enabled: true, question: bodyText, options: options.map(text => ({ text, votes: 0 })) };
  }

  if (enabled('ox')) {
    if (!bodyText) throw new Error('본문에 OX판정 상황을 입력해주세요.');
    modules.vote = { enabled: true, question: bodyText, options: [{ text: 'O', votes: 0 }, { text: 'X', votes: 0 }], ox: true };
  }

  if (enabled('fill')) {
    if (!bodyText) throw new Error('본문에 채우기 문장을 입력해주세요.');
    modules.fill = { enabled: true, prompt: bodyText };
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
    const mode = document.getElementById('mw-quiz-mode')?.value || 'subjective';
    if (!bodyText) throw new Error('본문에 퀴즈 문제를 입력해주세요.');
    if (mode === 'multiple') {
      const rawOptions = [...document.querySelectorAll('.mw-quiz-option')].map(i => i.value.trim());
      const options = rawOptions.filter(Boolean);
      const correctIndex = Number(document.querySelector('input[name="mw-quiz-correct"]:checked')?.value || 0);
      const answer = rawOptions[correctIndex] || '';
      if (options.length < 2) throw new Error('객관식 선택지를 2개 이상 입력해주세요.');
      if (!answer.trim()) throw new Error('정답으로 선택한 객관식 선택지를 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'multiple', question: bodyText, options: options.map(text => ({ text })), answer };
    } else {
      const answer = document.getElementById('mw-quiz-answer')?.value.trim() || '';
      if (!answer) throw new Error('정답을 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'subjective', question: bodyText, answer };
    }
  }

  if (enabled('anonymous')) {
    if (!bodyText) throw new Error('본문에 익명 내용을 입력해주세요.');
    modules.anonymous = { enabled: true };
  }

  return modules;
}

async function submitMultiPost() {
  if (!auth.currentUser) {
    navigate('/login');
    return;
  }

  const btn = document.getElementById('multi-submit');
  const title = document.getElementById('mw-title')?.value.trim() || '';
  const presetKey = getPresetKey();
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.general;
  const desc = getBodyText();

  if (!title) {
    toast.error('제목을 입력해주세요.');
    return;
  }

  try {
    const modules = collectModules();
    const isAnonymous = presetKey === 'anonymous';
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
      anonymous: isAnonymous,
      authorId: auth.currentUser.uid,
      authorName: isAnonymous ? '익명' : (appState.nickname || auth.currentUser.displayName || '익명'),
      authorPhoto: isAnonymous ? '' : (auth.currentUser.photoURL || ''),
      authorEmail: auth.currentUser.email || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      pointsScore: 0,
      createdAt: serverTimestamp(),
    });

    await awardPoints('post_create', { postId: docRef.id, type: presetKey }).catch(() => {});
    toast.success('피드 글을 올렸어요! +10P 🎉');
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
