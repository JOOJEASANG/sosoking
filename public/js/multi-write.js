import { auth, db } from './firebase.js';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';
import { awardPoints } from './utils/points.js';
import { MULTI_PRESETS, getMultiPresetFromHash } from './multi-write/presets.js';
import { renderMultiWriteHTML, renderQuizOptionRow } from './multi-write/render.js';
import { collectMultiModules, getBodyText, getBodyHtml, splitTags, isAnonymousWriteChecked } from './multi-write/collect.js';
import { fillAutoTags } from './multi-write/auto-tags.js';
import { initRichEditor, syncRichEditor } from './multi-write/editor.js';

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  return getMultiPresetFromHash(window.location.hash || '');
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function lineHtml(value) {
  return esc(value).replace(/\n/g, '<br>');
}

function blankHtml(count = 4) {
  const safeCount = Math.max(1, Math.min(12, Number(count) || 4));
  return `<span class="multi-preview-blank">${Array.from({ length: safeCount }, () => '<i></i>').join('')}</span>`;
}

function renderFillPreviewText(text) {
  let blankIndex = 0;
  const html = esc(text || '본문에 스페이스 2칸, ___, □□□로 빈칸을 만들어보세요.')
    .replace(/_{2,}|□+|[ \t]{2,}/g, marker => {
      blankIndex += 1;
      return blankHtml(marker.length || 4);
    })
    .replace(/\n/g, '<br>');
  return { html, count: blankIndex };
}

function participationGuide(presetKey) {
  return {
    general: '💬 댓글로 이야기를 이어갈 수 있어요.',
    vote: '🗳️ 사용자가 선택지에 투표하고 댓글로 판정 이유를 남깁니다.',
    fill: '🧩 사용자가 문장 속 빈칸을 채워 재미있는 답을 남깁니다.',
    naming: '😜 사용자가 가장 웃긴 이름을 지어 올립니다.',
    acrostic: '✍️ 사용자가 제시어 글자마다 한 줄씩 완성합니다.',
    relay: '🎭 사용자가 시작 문장 뒤로 이야기를 이어 씁니다.',
    quiz: '🧠 사용자가 정답을 맞히고 결과를 바로 확인합니다.',
  }[presetKey] || '💬 참여자가 댓글과 답글로 반응할 수 있어요.';
}

function renderPreviewBody() {
  syncRichEditor();
  const presetKey = getPresetKey();
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.general;
  const title = document.getElementById('mw-title')?.value.trim() || preset.titlePlaceholder || '제목 미리보기';
  const bodyText = getBodyText() || preset.descPlaceholder || '';
  const tags = splitTags(document.getElementById('mw-tags')?.value || '');
  const guide = participationGuide(presetKey);
  const titleHtml = `<div class="multi-preview-card__title">${esc(title)}</div>`;
  const guideHtml = `<div class="multi-preview-guide">${guide}</div>`;
  const tagsHtml = tags.length ? `<div class="multi-preview-tags">${tags.map(tag => `<span>#${esc(tag)}</span>`).join('')}</div>` : '';

  if (presetKey === 'vote') {
    const options = [...document.querySelectorAll('.mw-vote-option')].map(input => input.value.trim()).filter(Boolean);
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}<div class="multi-preview-options">${(options.length ? options : ['선택지 1', '선택지 2']).map(option => `<span>${esc(option)}</span>`).join('')}</div>${tagsHtml}`;
  }

  if (presetKey === 'fill') {
    const parsed = renderFillPreviewText(bodyText);
    const emptyNotice = parsed.count ? '' : '<div class="multi-preview-warn">빈칸 표시가 아직 없어요. 스페이스 2칸 이상, ___, □□□를 넣어보세요.</div>';
    return `${titleHtml}<div class="multi-preview-body multi-preview-body--fill">${parsed.html}</div>${guideHtml}${emptyNotice}${tagsHtml}`;
  }

  if (presetKey === 'naming') {
    const count = Number(document.getElementById('mw-naming-count')?.value || 0);
    const rule = count ? `${count}글자 제한` : '글자수 자유';
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}<div class="multi-preview-rule">규칙: ${esc(rule)}</div>${tagsHtml}`;
  }

  if (presetKey === 'acrostic') {
    const keyword = document.getElementById('mw-acrostic-keyword')?.value.trim() || '제시어';
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}<div class="multi-preview-acrostic">${[...keyword].map(ch => `<span>${esc(ch)}</span>`).join('')}</div>${tagsHtml}`;
  }

  if (presetKey === 'relay') {
    return `${titleHtml}<div class="multi-preview-body multi-preview-body--relay">${lineHtml(bodyText || '시작 문장을 입력하면 릴레이 첫 문장으로 표시됩니다.')}</div>${guideHtml}<div class="multi-preview-rule">다음 사람이 이야기를 이어갑니다.</div>${tagsHtml}`;
  }

  if (presetKey === 'quiz') {
    const mode = document.getElementById('mw-quiz-mode')?.value || 'subjective';
    const options = [...document.querySelectorAll('.mw-quiz-option')].map(input => input.value.trim()).filter(Boolean);
    const answer = mode === 'multiple' ? '객관식 선택지를 고르면 서버에서 정답 확인' : '정답 입력 후 서버에서 확인';
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}<div class="multi-preview-rule">방식: ${mode === 'multiple' ? '객관식' : '주관식'} · ${answer}</div>${mode === 'multiple' ? `<div class="multi-preview-options">${(options.length ? options : ['선택지 1', '선택지 2']).map(option => `<span>${esc(option)}</span>`).join('')}</div>` : ''}${tagsHtml}`;
  }

  return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}${tagsHtml}`;
}

function updateGamePreview() {
  const preview = document.getElementById('mw-preview-body');
  if (!preview) return;
  preview.innerHTML = renderPreviewBody();
}

function schedulePreviewUpdate() {
  clearTimeout(schedulePreviewUpdate.timer);
  schedulePreviewUpdate.timer = setTimeout(updateGamePreview, 80);
}

function bindGamePreviewEvents() {
  const page = document.querySelector('.multi-write-page');
  if (!page || page.dataset.previewBound === '1') return;
  page.dataset.previewBound = '1';
  page.addEventListener('input', schedulePreviewUpdate, true);
  page.addEventListener('change', schedulePreviewUpdate, true);
  page.addEventListener('click', event => {
    if (event.target.closest('[data-quiz-mode], [data-naming-count], [data-fill-count], #mw-add-vote-option, #mw-add-quiz-option')) {
      setTimeout(updateGamePreview, 0);
    }
  }, true);
  updateGamePreview();
}

function cloneWithoutQuizSecret(modules) {
  const publicModules = JSON.parse(JSON.stringify(modules || {}));
  const quiz = publicModules.quiz;
  if (!quiz?.enabled) return { publicModules, quizSecret: null };

  const mode = quiz.mode === 'multiple' ? 'multiple' : 'subjective';
  const answer = String(quiz.answer || '').trim();
  const correctIndex = Number.isInteger(Number(quiz.correctIndex)) ? Number(quiz.correctIndex) : null;
  const quizSecret = {
    quizMode: mode,
    mode,
    answer,
    answerIdx: correctIndex,
    correctIndex,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  delete quiz.answer;
  delete quiz.correctIndex;
  if (Array.isArray(quiz.options)) {
    quiz.options = quiz.options.map(option => ({ text: String(option?.text || option || '').slice(0, 120) }));
  }

  return { publicModules, quizSecret };
}

function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const renderKey = window.location.hash || '#/write?type=multi';
  const presetKey = getPresetKey();
  el.innerHTML = renderMultiWriteHTML({ renderKey, presetKey });

  const uploader = document.getElementById('mw-img-uploader');
  if (uploader) initImageUploader(uploader, Infinity);
  initRichEditor();
  bindMultiWriteEvents();
  bindGamePreviewEvents();
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
  updateGamePreview();
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
  updateGamePreview();
}

function setFillCount(count) {
  const normalized = ['2', '3', '4', '5', '6'].includes(String(count)) ? String(count) : '4';
  const hidden = document.getElementById('mw-fill-count');
  if (hidden) hidden.value = normalized;
  document.querySelectorAll('[data-fill-count]').forEach(btn => {
    const active = btn.dataset.fillCount === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  updateGamePreview();
}

function bindMultiWriteEvents() {
  document.getElementById('multi-back-type')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('mw-auto-tags')?.addEventListener('click', () => {
    syncRichEditor();
    const tags = fillAutoTags({ force: true });
    updateGamePreview();
    if (tags.length) toast.success('태그를 자동 생성했어요');
    else toast.warn('제목이나 본문을 조금 더 입력하면 태그를 만들 수 있어요');
  });

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
    updateGamePreview();
  });

  document.querySelectorAll('[data-quiz-mode]').forEach(btn => btn.addEventListener('click', () => setQuizMode(btn.dataset.quizMode)));
  document.querySelectorAll('[data-naming-count]').forEach(btn => btn.addEventListener('click', () => setNamingCount(btn.dataset.namingCount)));
  document.querySelectorAll('[data-fill-count]').forEach(btn => btn.addEventListener('click', () => setFillCount(btn.dataset.fillCount)));

  document.getElementById('mw-add-quiz-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-quiz-options');
    const count = list?.querySelectorAll('.mw-quiz-option').length || 0;
    if (count >= 6) {
      toast.warn('객관식 선택지는 최대 6개까지 가능해요');
      return;
    }
    list.insertAdjacentHTML('beforeend', renderQuizOptionRow(count, false));
    updateGamePreview();
  });

  document.getElementById('multi-submit')?.addEventListener('click', submitMultiPost);
}

async function submitMultiPost() {
  if (!auth.currentUser) {
    navigate('/login');
    return;
  }

  syncRichEditor();
  const btn = document.getElementById('multi-submit');
  const title = document.getElementById('mw-title')?.value.trim() || '';
  const presetKey = getPresetKey();
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.general;
  const desc = getBodyHtml() || getBodyText();

  if (!title) {
    toast.error('제목을 입력해주세요.');
    return;
  }

  let docRef = null;
  try {
    const collectedModules = collectMultiModules();
    const { publicModules, quizSecret } = cloneWithoutQuizSecret(collectedModules);
    const isAnonymous = presetKey === 'general' && isAnonymousWriteChecked();
    btn.disabled = true;
    btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '올리는 중...';

    const images = await getUploadedImages();
    btn.textContent = '게시글 저장 중...';

    const manualTags = splitTags(document.getElementById('mw-tags')?.value || '');
    const tags = manualTags.length ? manualTags : fillAutoTags({ force: true });
    docRef = doc(collection(db, 'feeds'));

    await setDoc(docRef, {
      type: 'multi',
      cat: 'multi',
      subtype: presetKey,
      typeLabel: preset.label,
      title,
      desc,
      tags,
      images,
      modules: publicModules,
      anonymous: isAnonymous,
      anonymousMode: isAnonymous ? 'general-option' : '',
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

    if (quizSecret) {
      await setDoc(doc(db, 'feeds', docRef.id, 'secret', 'answer'), quizSecret);
    }

    await awardPoints('post_create', { postId: docRef.id, type: presetKey }).catch(() => {});
    toast.success('피드 글을 올렸어요! +10P 🎉');
    navigate(`/detail/${docRef.id}`);
  } catch (error) {
    console.error(error);
    if (docRef) await deleteDoc(docRef).catch(() => {});
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
    else updateGamePreview();
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