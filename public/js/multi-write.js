import { auth, db, functions } from './firebase.js';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
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

const callGetRegisteredMemberCount = httpsCallable(functions, 'getRegisteredMemberCount');
const MAX_FEED_IMAGES = 20;
let deadlineGateState = { checked: false, enabled: false, registeredCount: 0, threshold: 50 };

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  return getMultiPresetFromHash(window.location.hash || '');
}

function feedTypeFromPreset(presetKey) {
  if (['vote', 'naming', 'drip', 'quiz'].includes(presetKey)) return presetKey;
  return 'general';
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
    drip: '🤣 사용자가 한 줄 드립을 남기고 반응을 받습니다.',
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
  const deadline = collectDeadlineSettings();
  const deadlineHtml = deadline.enabled
    ? `<div class="multi-preview-rule">⏰ ${esc(deadline.label)} · 마감 후 베스트 참여작을 확정하기 좋습니다.</div>`
    : '';
  const titleHtml = `<div class="multi-preview-card__title">${esc(title)}</div>`;
  const guideHtml = `<div class="multi-preview-guide">${guide}</div>`;
  const tagsHtml = tags.length ? `<div class="multi-preview-tags">${tags.map(tag => `<span>#${esc(tag)}</span>`).join('')}</div>` : '';

  if (presetKey === 'vote') {
    const options = [...document.querySelectorAll('.mw-vote-option')].map(input => input.value.trim()).filter(Boolean);
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}${deadlineHtml}<div class="multi-preview-options">${(options.length ? options : ['선택지 1', '선택지 2']).map(option => `<span>${esc(option)}</span>`).join('')}</div>${tagsHtml}`;
  }

  if (presetKey === 'fill') {
    const parsed = renderFillPreviewText(bodyText);
    const emptyNotice = parsed.count ? '' : '<div class="multi-preview-warn">빈칸 표시가 아직 없어요. 스페이스 2칸 이상, ___, □□□를 넣어보세요.</div>';
    return `${titleHtml}<div class="multi-preview-body multi-preview-body--fill">${parsed.html}</div>${guideHtml}${deadlineHtml}${emptyNotice}${tagsHtml}`;
  }

  if (presetKey === 'naming') {
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}${deadlineHtml}<div class="multi-preview-rule">규칙: 자유 작명</div>${tagsHtml}`;
  }

  if (presetKey === 'drip') {
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}${deadlineHtml}<div class="multi-preview-rule">참여: 80자 이내 한 줄 드립</div>${tagsHtml}`;
  }

  if (presetKey === 'quiz') {
    const mode = document.getElementById('mw-quiz-mode')?.value || 'subjective';
    const options = [...document.querySelectorAll('.mw-quiz-option')].map(input => input.value.trim()).filter(Boolean);
    const answer = mode === 'multiple' ? '객관식 선택지를 고르면 서버에서 정답 확인' : '정답 입력 후 서버에서 확인';
    const hint = document.getElementById('mw-quiz-hint')?.value.trim() || '';
    const hintHtml = hint ? `<div class="multi-preview-rule">💡 힌트: ${esc(hint)}</div>` : '';
    return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}${deadlineHtml}${hintHtml}<div class="multi-preview-rule">방식: ${mode === 'multiple' ? '객관식' : '주관식'} · ${answer}</div>${mode === 'multiple' ? `<div class="multi-preview-options">${(options.length ? options : ['선택지 1', '선택지 2']).map(option => `<span>${esc(option)}</span>`).join('')}</div>` : ''}${tagsHtml}`;
  }

  return `${titleHtml}<div class="multi-preview-body">${lineHtml(bodyText)}</div>${guideHtml}${deadlineHtml}${tagsHtml}`;
}

function updateGamePreview() {
  const preview = document.getElementById('mw-preview-body');
  if (!preview) return;
  preview.innerHTML = renderPreviewBody();
}

async function ensureDeadlineGate() {
  if (deadlineGateState.checked) return deadlineGateState;
  try {
    const result = await callGetRegisteredMemberCount({});
    const data = result.data || {};
    deadlineGateState = {
      checked: true,
      enabled: !!data.enabled,
      registeredCount: Number(data.count || 0),
      threshold: Number(data.threshold || 50),
    };
  } catch {
    deadlineGateState = { checked: true, enabled: false, registeredCount: 0, threshold: 50 };
  }
  return deadlineGateState;
}

function collectDeadlineSettings() {
  const mode = document.getElementById('mw-deadline-mode')?.value || 'none';
  const gate = deadlineGateState;
  if (mode === 'none' || !gate.enabled) {
    return { enabled: false, mode: 'none', label: '마감 없음', memberGate: gate };
  }
  const now = new Date();
  if (mode === '1h') {
    return { enabled: true, mode, label: '1시간 마감', deadlineAt: new Date(now.getTime() + 60 * 60 * 1000), memberGate: gate };
  }
  if (mode === '24h') {
    return { enabled: true, mode, label: '24시간 마감', deadlineAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), memberGate: gate };
  }
  if (mode === 'manual') {
    return { enabled: true, mode, label: '작성자 직접 마감', deadlineAt: null, memberGate: gate };
  }
  return { enabled: false, mode: 'none', label: '마감 없음', memberGate: gate };
}

function setDeadlineMode(mode) {
  const gate = deadlineGateState;
  if (!gate.enabled && mode !== 'none') {
    toast.warn(`회원 ${gate.threshold}명 이상부터 마감 기능을 사용할 수 있어요. 현재 ${gate.registeredCount}명`);
    mode = 'none';
  }
  const hidden = document.getElementById('mw-deadline-mode');
  if (hidden) hidden.value = mode;
  document.querySelectorAll('[data-deadline-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.deadlineMode === mode));
  updateGamePreview();
}

function updateDeadlineGateUI() {
  const badge = document.getElementById('mw-member-gate-badge');
  const hint = document.getElementById('mw-deadline-hint');
  const options = document.getElementById('mw-deadline-options');
  if (!badge || !hint || !options) return;
  const gate = deadlineGateState;
  if (gate.enabled) {
    badge.textContent = `활성화 · 회원 ${gate.registeredCount}명`;
    badge.classList.remove('locked');
    hint.textContent = '마감 시간이 지나면 상세페이지에서 마감 상태로 표시됩니다.';
    options.querySelectorAll('[data-deadline-mode]').forEach(btn => { btn.disabled = false; });
  } else {
    badge.textContent = `잠금 · 회원 ${gate.registeredCount}/${gate.threshold}명`;
    badge.classList.add('locked');
    hint.textContent = `회원 ${gate.threshold}명 이상부터 마감/결과 공개 기능이 열립니다.`;
    options.querySelectorAll('[data-deadline-mode]').forEach(btn => {
      if (btn.dataset.deadlineMode !== 'none') btn.disabled = true;
    });
  }
}

function cloneWithoutQuizSecret(modules) {
  const publicModules = JSON.parse(JSON.stringify(modules || {}));
  let quizSecret = null;
  if (publicModules.quiz?.enabled) {
    const quiz = publicModules.quiz;
    quizSecret = {
      mode: quiz.mode || 'subjective',
      answer: quiz.answer || '',
      correctIndex: typeof quiz.correctIndex === 'number' ? quiz.correctIndex : null,
      answerIdx: typeof quiz.correctIndex === 'number' ? quiz.correctIndex : null,
      explanation: quiz.explanation || '',
      correctCount: 0,
      firstCorrect: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    delete quiz.answer;
    delete quiz.correctIndex;
    delete quiz.explanation;
  }
  return { publicModules, quizSecret };
}

function initLivePreview() {
  ['mw-title', 'mw-desc', 'mw-tags', 'mw-fill-count', 'mw-quiz-mode', 'mw-quiz-hint']
    .forEach(id => document.getElementById(id)?.addEventListener('input', updateGamePreview));
  document.querySelectorAll('.mw-vote-option,.mw-quiz-option').forEach(input => input.addEventListener('input', updateGamePreview));
  document.getElementById('mw-desc')?.addEventListener('keyup', updateGamePreview);
}

export async function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el || !isMultiQuery()) return;

  if (!auth.currentUser) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✏️</div>
        <div class="empty-state__title">로그인 후 글을 쓸 수 있어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login?return=/write?type=multi')">로그인하기</button>
      </div>`;
    return;
  }

  const renderKey = window.location.hash || '#/write?type=multi';
  const presetKey = getPresetKey();
  await ensureDeadlineGate();
  el.innerHTML = renderMultiWriteHTML({ renderKey, presetKey, showDeadline: true });
  updateDeadlineGateUI();
  initImageUploader(document.getElementById('mw-img-uploader'), MAX_FEED_IMAGES);
  initRichEditor(document.getElementById('mw-desc'));
  bindMultiWriteEvents();
  initLivePreview();
  updateGamePreview();
}

function setVoteMode(mode) {
  const normalized = ['general', 'balance', 'judgment', 'debate'].includes(mode) ? mode : 'general';
  const hidden = document.getElementById('mw-vote-mode');
  if (hidden) hidden.value = normalized;
  document.querySelectorAll('[data-vote-mode]').forEach(btn => {
    const active = btn.dataset.voteMode === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  const modeNote = document.getElementById('mw-vote-mode-note');
  const judgmentPresets = document.getElementById('mw-vote-judgment-presets');
  const addBtn = document.getElementById('mw-add-vote-option');
  const optionList = document.getElementById('mw-vote-options');
  const notes = {
    balance: '⚖️ 둘 다 싫어도 하나를 반드시 골라야 하는 상황을 만들어보세요. 선택지는 2개로 제한됩니다.',
    judgment: '🔨 억울한 상황이나 논란 상황을 올리면 사람들이 판정을 내립니다. 아래 빠른 선택으로 선택지를 바로 채울 수 있어요.',
    debate: '💬 찬성/반대가 자동 고정됩니다. 본문에 토론 주제를 적어주세요.',
    general: '',
  };
  if (modeNote) { modeNote.textContent = notes[normalized] || ''; modeNote.style.display = notes[normalized] ? '' : 'none'; }
  if (judgmentPresets) judgmentPresets.style.display = normalized === 'judgment' ? '' : 'none';
  if (normalized === 'balance') {
    const opts = [...(optionList?.querySelectorAll('.mw-vote-option') || [])];
    opts.slice(2).forEach(opt => opt.remove());
    opts.slice(0, 2).forEach(opt => { opt.readOnly = false; });
    if (addBtn) addBtn.style.display = 'none';
  } else if (normalized === 'debate') {
    const opts = [...(optionList?.querySelectorAll('.mw-vote-option') || [])];
    opts.slice(2).forEach(opt => opt.remove());
    opts.slice(0, 2).forEach((opt, i) => { opt.value = i === 0 ? '찬성' : '반대'; opt.readOnly = true; });
    if (addBtn) addBtn.style.display = 'none';
  } else {
    const opts = [...(optionList?.querySelectorAll('.mw-vote-option') || [])];
    opts.forEach(opt => { opt.readOnly = false; });
    if (addBtn) addBtn.style.display = '';
  }
  updateGamePreview();
}

function applyJudgmentPreset(preset) {
  const [a, b] = preset.split(',');
  const opts = document.querySelectorAll('.mw-vote-option');
  if (opts[0]) opts[0].value = a || '';
  if (opts[1]) opts[1].value = b || '';
  updateGamePreview();
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
  const sub = document.getElementById('mw-quiz-subjective-box');
  const mul = document.getElementById('mw-quiz-multiple-box');
  if (sub) sub.style.display = normalized === 'subjective' ? '' : 'none';
  if (mul) mul.style.display = normalized === 'multiple' ? '' : 'none';
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

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function getImgUrlEntries() {
  return [...document.querySelectorAll('#mw-imgurl-list [data-imgurl]')].map(el => el.dataset.imgurl);
}

function addImgUrl() {
  const input = document.getElementById('mw-imgurl-input');
  const raw = input?.value.trim() || '';
  if (!raw) return;
  if (!/^https?:\/\/.{4,}/i.test(raw)) {
    toast.warn('https:// 로 시작하는 이미지 링크를 입력해주세요.');
    return;
  }
  const existing = getImgUrlEntries();
  if (existing.includes(raw)) {
    toast.warn('이미 추가된 링크예요.');
    if (input) input.value = '';
    return;
  }
  if (existing.length >= 20) {
    toast.warn('이미지 링크는 최대 20개까지 추가할 수 있어요.');
    return;
  }
  const list = document.getElementById('mw-imgurl-list');
  const chip = document.createElement('div');
  chip.className = 'mw-imgurl-chip';
  chip.dataset.imgurl = raw;
  chip.innerHTML = `<span class="mw-imgurl-chip__url">${esc(raw)}</span><button type="button" class="mw-imgurl-chip__remove" aria-label="삭제">×</button>`;
  chip.querySelector('.mw-imgurl-chip__remove')?.addEventListener('click', () => chip.remove());
  list?.appendChild(chip);
  if (input) input.value = '';
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

  document.querySelectorAll('[data-vote-mode]').forEach(btn => btn.addEventListener('click', () => setVoteMode(btn.dataset.voteMode)));
  document.querySelectorAll('[data-judgment-preset]').forEach(btn => btn.addEventListener('click', () => applyJudgmentPreset(btn.dataset.judgmentPreset)));
  document.querySelectorAll('[data-quiz-mode]').forEach(btn => btn.addEventListener('click', () => setQuizMode(btn.dataset.quizMode)));
  document.querySelectorAll('[data-fill-count]').forEach(btn => btn.addEventListener('click', () => setFillCount(btn.dataset.fillCount)));
  document.querySelectorAll('[data-deadline-mode]').forEach(btn => btn.addEventListener('click', () => setDeadlineMode(btn.dataset.deadlineMode)));

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

  const imgurlInput = document.getElementById('mw-imgurl-input');
  document.getElementById('mw-imgurl-add')?.addEventListener('click', addImgUrl);
  imgurlInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addImgUrl(); } });
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
    const deadline = collectDeadlineSettings();
    const { publicModules, quizSecret } = cloneWithoutQuizSecret(collectedModules);
    const isAnonymous = presetKey === 'general' && isAnonymousWriteChecked();
    btn.disabled = true;
    btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '올리는 중...';

    const uploadedImages = await getUploadedImages();
    const urlImages = getImgUrlEntries();
    const images = [...uploadedImages, ...urlImages];
    if (images.length > MAX_FEED_IMAGES) throw new Error(`사진은 최대 ${MAX_FEED_IMAGES}장까지 올릴 수 있어요.`);
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
    };

    if (deadline.enabled) {
      postData.deadline = {
        enabled: true,
        mode: deadline.mode,
        label: deadline.label,
        status: 'open',
        memberGate: deadline.memberGate,
      };
      if (deadline.deadlineAt) postData.deadlineAt = Timestamp.fromDate(deadline.deadlineAt);
    } else {
      postData.deadline = { enabled: false, mode: 'none', status: 'open' };
    }

    await setDoc(docRef, postData);

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