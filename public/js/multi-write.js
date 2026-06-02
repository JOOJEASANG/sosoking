import { auth, db } from './firebase.js';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages, uploadSingleImage } from './components/image-uploader.js';
import { awardPoints } from './utils/points.js';
import { MULTI_PRESETS, getMultiPresetFromHash } from './multi-write/presets.js';
import { renderMultiWriteHTML } from './multi-write/render.js';
import { collectMultiModules, getBodyText, getBodyHtml, splitTags } from './multi-write/collect.js';
import { fillAutoTags } from './multi-write/auto-tags.js';
import { initRichEditor, syncRichEditor } from './multi-write/editor.js';

const MAX_FEED_IMAGES = 20;

/* ── 임시저장(드래프트) ── */
const DRAFT_KEY = 'sosoking:multiWriteDraft';
let draftTimer = null;

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      syncRichEditor();
      const preset = getPresetKey();
      const title    = document.getElementById('mw-title')?.value || '';
      const desc     = document.getElementById('mw-desc')?.value || '';
      const tags     = document.getElementById('mw-tags')?.value || '';
      const dripLine = document.getElementById('mw-drip-line')?.value || '';
      if (!title && !desc && !tags && !dripLine) { clearDraft(); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ preset, title, desc, tags, dripLine, savedAt: Date.now() }));
    } catch {}
  }, 1500);
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function offerDraftRestore() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return; }
  if (!draft || Date.now() - draft.savedAt > 86_400_000) { clearDraft(); return; }

  const banner = document.createElement('div');
  banner.id = 'draft-restore-banner';
  banner.innerHTML = `
    <span style="flex:1;color:var(--color-text-primary)">💾 이전에 작성하던 내용이 있어요.</span>
    <button class="btn btn--primary btn--sm" id="draft-yes">복원하기</button>
    <button class="btn btn--ghost btn--sm" id="draft-no">무시</button>`;

  const header = document.querySelector('.write-step-header');
  if (header) header.insertAdjacentElement('afterend', banner);

  document.getElementById('draft-yes')?.addEventListener('click', () => {
    if (draft.preset) updateOptionSelection(draft.preset);
    setTimeout(() => {
      ['title','desc','tags'].forEach(key => {
        if (draft[key]) { const el = document.getElementById(`mw-${key}`); if (el) el.value = draft[key]; }
      });
      if (draft.dripLine) { const el = document.getElementById('mw-drip-line'); if (el) el.value = draft.dripLine; }
      updateWriteStateOnly();
    }, 80);
    banner.remove();
    clearDraft();
  });

  document.getElementById('draft-no')?.addEventListener('click', () => {
    clearDraft();
    banner.remove();
  });
}

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  const selected = document.getElementById('mw-selected-preset')?.value || '';
  if (selected && MULTI_PRESETS[selected] && !MULTI_PRESETS[selected].hiddenFromWriter) return selected;
  return getMultiPresetFromHash(window.location.hash || '');
}

function feedTypeFromPreset(presetKey) {
  if (['tournament', 'collect', 'vote', 'drip'].includes(presetKey)) return presetKey;
  return 'tournament';
}

function dripTopicValue() {
  return (document.getElementById('mw-drip-line')?.value.trim() || '').slice(0, 80);
}

function syncDripLineToHiddenBody() {
  const topic = dripTopicValue();
  const desc = document.getElementById('mw-desc');
  if (!desc) return;
  desc.value = topic;
  desc.dataset.plainText = topic;
}

function updateWriteStateOnly() {
  const page = document.querySelector('.multi-write-page');
  const preset = getPresetKey();
  if (page) page.dataset.presetKey = preset;
  if (preset === 'drip') syncDripLineToHiddenBody();
}

function bindTextStateEvents() {
  function onInput() { updateWriteStateOnly(); scheduleDraftSave(); }
  ['mw-title', 'mw-desc', 'mw-tags', 'mw-drip-line', 'mw-collect-url']
    .forEach(id => document.getElementById(id)?.addEventListener('input', onInput));
  document.querySelectorAll('.mw-vote-option').forEach(input => input.addEventListener('input', onInput));
  document.getElementById('mw-desc')?.addEventListener('keyup', updateWriteStateOnly);
}

export async function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el || !isMultiQuery()) return;

  if (!auth.currentUser) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✏️</div>
        <div class="empty-state__title">로그인 후 올릴 수 있어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login?return=/write?type=multi')">로그인하기</button>
      </div>`;
    return;
  }

  const renderKey = '#/write?type=multi';
  const presetKey = getPresetKey();
  el.innerHTML = renderMultiWriteHTML({ renderKey, presetKey });
  initImageUploader(document.getElementById('mw-img-uploader'), MAX_FEED_IMAGES);
  initRichEditor(document.getElementById('mw-desc'));
  bindMultiWriteEvents();
  bindTextStateEvents();
  setVoteMode('general');
  updateOptionSelection(presetKey);
  updateWriteStateOnly();
  setTimeout(offerDraftRestore, 150);
}

function setWriteSectionVisibility(normalized) {
  const isTournament = normalized === 'tournament';
  document.querySelectorAll('[data-write-section]').forEach(section => {
    const key = section.dataset.writeSection;
    if (key === 'drip-line') section.style.display = normalized === 'drip' ? '' : 'none';
    if (key === 'standard-fields') section.style.display = normalized === 'drip' ? 'none' : '';
    if (key === 'content-field') section.style.display = (normalized === 'drip' || isTournament) ? 'none' : '';
    if (key === 'collect-url-field') section.style.display = 'none';
    if (key === 'media-field') section.style.display = isTournament ? 'none' : '';
    if (key === 'vote-panel') section.style.display = normalized === 'vote' ? '' : 'none';
    if (key === 'drip-panel') section.style.display = normalized === 'drip' ? '' : 'none';
    if (key === 'tournament-panel') section.style.display = isTournament ? '' : 'none';
  });
}

function updateOptionSelection(preset) {
  const normalized = MULTI_PRESETS[preset] && !MULTI_PRESETS[preset].hiddenFromWriter ? preset : 'tournament';
  const hidden = document.getElementById('mw-selected-preset');
  if (hidden) hidden.value = normalized;
  const page = document.querySelector('.multi-write-page');
  if (page) page.dataset.presetKey = normalized;

  document.querySelectorAll('[data-multi-preset]').forEach(btn => {
    const active = btn.dataset.multiPreset === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  document.querySelectorAll('[data-option-panel]').forEach(panel => {
    panel.style.display = panel.dataset.optionPanel === normalized ? '' : 'none';
  });

  setWriteSectionVisibility(normalized);

  document.querySelectorAll('[data-module-input]').forEach(input => {
    const key = input.dataset.moduleInput;
    if (key === normalized) input.setAttribute('data-module-toggle', key);
    else input.removeAttribute('data-module-toggle');
  });

  if (normalized === 'vote') setVoteMode('general');
  if (normalized === 'drip') syncDripLineToHiddenBody();
  window.dispatchEvent(new Event('sosoking:write-option-changed'));
}

function setVoteMode() {
  const hidden = document.getElementById('mw-vote-mode');
  if (hidden) hidden.value = 'general';
  document.querySelectorAll('.mw-vote-option').forEach(opt => { opt.readOnly = false; });
  const addBtn = document.getElementById('mw-add-vote-option');
  if (addBtn) addBtn.style.display = '';
}

function bindMultiWriteEvents() {
  document.getElementById('multi-back-type')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('mw-drip-line')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') event.preventDefault();
  });
  document.getElementById('mw-drip-line')?.addEventListener('input', event => {
    if (event.target.value.length > 80) event.target.value = event.target.value.slice(0, 80);
  });
  document.getElementById('mw-auto-tags')?.addEventListener('click', () => {
    if (getPresetKey() === 'drip') syncDripLineToHiddenBody();
    else syncRichEditor();
    const tags = fillAutoTags({ force: true });
    updateWriteStateOnly();
    if (tags.length) toast.success('태그를 자동 생성했어요');
    else toast.warn('제목이나 내용을 조금 더 입력하면 태그를 만들 수 있어요');
  });

  document.querySelectorAll('[data-multi-preset]').forEach(btn => btn.addEventListener('click', () => updateOptionSelection(btn.dataset.multiPreset)));

  document.getElementById('mw-add-vote-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-vote-options');
    const count = list?.querySelectorAll('.mw-vote-option').length || 0;
    if (count >= 8) {
      toast.warn('선택지는 최대 8개까지 가능해요');
      return;
    }
    list.insertAdjacentHTML('beforeend', `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${count + 1}">`);
    list?.lastElementChild?.addEventListener('input', updateWriteStateOnly);
  });

  document.getElementById('multi-submit')?.addEventListener('click', submitMultiPost);

  // Tournament size picker
  document.querySelectorAll('.t-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = parseInt(btn.dataset.tSize || '8');
      document.querySelectorAll('.t-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.t-item-row').forEach(row => {
        const idx = parseInt(row.dataset.tItemIdx || '0');
        row.style.display = idx < size ? '' : 'none';
      });
    });
  });

  // Tournament per-item image buttons
  document.querySelectorAll('[data-t-img-btn]').forEach(imgBtn => {
    imgBtn.addEventListener('click', () => {
      const idx = imgBtn.dataset.tImgBtn;
      document.querySelector(`.t-item-file[data-item-idx="${idx}"]`)?.click();
    });
  });

  document.querySelectorAll('.t-item-file').forEach(fileInput => {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const idx = fileInput.dataset.itemIdx;
      const imgBtn = document.querySelector(`[data-t-img-btn="${idx}"]`);
      const reader = new FileReader();
      reader.onload = ev => {
        if (imgBtn) imgBtn.innerHTML = `<img src="${ev.target.result}" alt="">`;
        fileInput._tournamentFile = file;
      };
      reader.readAsDataURL(file);
    });
  });
}

async function submitTournamentPost(btn) {
  const sizeBtn = document.querySelector('.t-size-btn.active');
  const size = parseInt(sizeBtn?.dataset.tSize || '8');
  const title = document.getElementById('mw-title')?.value.trim() || '';

  if (!title) {
    toast.error('대결 제목을 입력해주세요.');
    return;
  }

  const rows = [...document.querySelectorAll('.t-item-row')].filter(row => parseInt(row.dataset.tItemIdx || '0') < size);
  const rawItems = rows.map(row => ({
    name: row.querySelector('.t-item-name')?.value.trim() || '',
    file: row.querySelector('.t-item-file')?._tournamentFile || null,
  }));
  const emptyCount = rawItems.filter(item => !item.name).length;
  if (emptyCount > 0) {
    toast.error(`항목을 모두 입력해주세요. (${size - emptyCount}/${size})`);
    return;
  }

  btn.disabled = true;
  btn.textContent = '사진 업로드 중...';

  try {
    const itemsWithUrls = await Promise.all(rawItems.map(async item => {
      if (!item.file) return { name: item.name, imageUrl: '' };
      try {
        const url = await uploadSingleImage(item.file);
        return { name: item.name, imageUrl: url };
      } catch {
        return { name: item.name, imageUrl: '' };
      }
    }));

    btn.textContent = '게시글 저장 중...';
    const preset = MULTI_PRESETS.tournament;
    const manualTags = splitTags(document.getElementById('mw-tags')?.value || '');
    const tags = manualTags.length ? manualTags : ['대결방', '토너먼트', `${size}강`];
    const docRef = doc(collection(db, 'feeds'));

    await setDoc(docRef, {
      type: 'multi',
      cat: 'multi',
      subtype: 'tournament',
      feedType: 'tournament',
      typeLabel: preset.label,
      title,
      desc: '',
      tags,
      images: [],
      modules: {
        comments: { enabled: true },
        tournament: {
          enabled: true,
          size,
          items: itemsWithUrls,
          wins: {},
          plays: 0,
        },
      },
      anonymous: false,
      anonymousMode: '',
      authorId: auth.currentUser.uid,
      authorName: appState.nickname || auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      authorEmail: auth.currentUser.email || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      pointsScore: 0,
      createdAt: serverTimestamp(),
    });

    clearDraft();
    toast.success(`${preset.label}에 올렸어요! +10P 🎉`);
    navigate(`/detail/${docRef.id}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '올리기에 실패했어요.');
    btn.disabled = false;
    btn.textContent = '올리기';
  }
}

async function submitMultiPost() {
  if (!auth.currentUser) {
    navigate('/login');
    return;
  }

  const presetKey = getPresetKey();
  if (presetKey === 'drip') syncDripLineToHiddenBody();
  else syncRichEditor();

  const btn = document.getElementById('multi-submit');

  if (presetKey === 'tournament') {
    return submitTournamentPost(btn);
  }

  let title = document.getElementById('mw-title')?.value.trim() || '';
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.tournament;
  const bodyValue = getBodyHtml() || getBodyText();
  const desc = presetKey === 'drip' ? dripTopicValue() : (presetKey === 'vote' ? (bodyValue || title) : bodyValue);

  if (presetKey === 'drip') {
    title = '오늘의 드립 주제';
    if (!desc && !hasPendingImages()) {
      toast.error('드립 주제를 적거나 사진을 올려주세요.');
      return;
    }
  } else if (!title) {
    toast.error(presetKey === 'vote' ? '토론 주제를 입력해주세요.' : '제목을 입력해주세요.');
    return;
  }

  let docRef = null;
  try {
    const publicModules = collectMultiModules();
    btn.disabled = true;
    btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '올리는 중...';

    const images = await getUploadedImages();
    if (images.length > MAX_FEED_IMAGES) throw new Error(`사진은 최대 ${MAX_FEED_IMAGES}장까지 올릴 수 있어요.`);
    if (presetKey === 'collect' && publicModules.collect?.kind === 'image' && !images.length) {
      throw new Error('사진 파일을 업로드해주세요.');
    }
    btn.textContent = '게시글 저장 중...';

    const manualTags = splitTags(document.getElementById('mw-tags')?.value || '');
    const tags = manualTags.length ? manualTags : fillAutoTags({ force: true });
    docRef = doc(collection(db, 'feeds'));

    const postData = {
      type: 'multi',
      cat: 'multi',
      subtype: presetKey,
      feedType: feedTypeFromPreset(presetKey),
      typeLabel: preset.label,
      title,
      desc,
      tags,
      images,
      modules: publicModules,
      anonymous: false,
      anonymousMode: '',
      authorId: auth.currentUser.uid,
      authorName: appState.nickname || auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      authorEmail: auth.currentUser.email || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      pointsScore: 0,
      createdAt: serverTimestamp(),
    };

    await setDoc(docRef, postData);
    await awardPoints('post_create', { postId: docRef.id, type: presetKey }).catch(() => {});
    clearDraft();
    toast.success(`${preset.label}에 올렸어요! +10P 🎉`);
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
    const key = '#/write?type=multi';
    if (!page || page.dataset.renderKey !== key) renderMultiWrite();
    else updateWriteStateOnly();
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
