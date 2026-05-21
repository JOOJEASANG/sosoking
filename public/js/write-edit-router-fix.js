import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';
import { appState } from './state.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function descToPlain(raw) {
  const source = String(raw || '');
  if (!/<[a-z][\s\S]*>/i.test(source)) return source;
  const tmp = document.createElement('div');
  tmp.innerHTML = source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

function params() {
  return new URLSearchParams((location.hash.split('?')[1] || '').split('#')[0]);
}

function editId() {
  const p = params();
  return p.get('edit') || p.get('postId') || p.get('id') || '';
}

function isEdit() {
  return (location.hash || '').startsWith('#/write') && !!editId();
}

function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(tag => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function typeLabel(post) {
  const subtype = post.subtype;
  const m = post.modules || {};
  if (post.anonymous || m.anonymous?.enabled || subtype === 'anonymous') return '익명비밀글';
  if (subtype === 'vote' || subtype === 'ox' || m.vote?.enabled) return '투표/판정';
  if (subtype === 'fill' || m.fill?.enabled) return '빈칸 채우기';
  if (subtype === 'naming' || m.naming?.enabled) return '미친작명소';
  if (subtype === 'acrostic' || m.acrostic?.enabled) return '삼행시';
  if (subtype === 'relay' || m.relay?.enabled) return '막장릴레이';
  if (subtype === 'quiz' || m.quiz?.enabled) return '미친퀴즈';
  return post.typeLabel || (post.type === 'multi' ? '일반글' : post.type || '게시글');
}

function hideNewWriteUi() {
  if (!isEdit()) return;
  document.querySelectorAll('.multi-preset-box,.multi-preset-list,[data-multi-preset]').forEach(el => {
    (el.closest('.multi-preset-box') || el).style.display = 'none';
  });
}

function moduleLabels(m = {}) {
  const labels = [];
  if (m.vote?.enabled) labels.push('투표/판정');
  if (m.fill?.enabled) labels.push('빈칸 채우기');
  if (m.naming?.enabled) labels.push('작명');
  if (m.acrostic?.enabled) labels.push('삼행시');
  if (m.relay?.enabled) labels.push('릴레이');
  if (m.quiz?.enabled) labels.push('문제');
  if (m.youtube?.enabled) labels.push('유튜브');
  if (m.anonymous?.enabled) labels.push('익명');
  return labels.length
    ? `<div class="feed-card__multi-chips" style="margin:8px 0 12px">${labels.map(label => `<span>${esc(label)}</span>`).join('')}</div>`
    : '';
}

function fillCounts(fill = {}) {
  if (Array.isArray(fill.blankCounts) && fill.blankCounts.length) return fill.blankCounts;
  if (Array.isArray(fill.blanks) && fill.blanks.length) return fill.blanks.map(blank => blank.charCount || 4);
  return [fill.charCount || fill.blankCount || 4];
}

function parseCounts(raw) {
  const nums = String(raw || '')
    .split(',')
    .map(value => Math.max(1, Math.min(12, Number(value.trim()) || 0)))
    .filter(Boolean)
    .slice(0, 12);
  return nums.length ? nums : [4];
}

function charCountFromBlankMarker(marker, fallback = 4) {
  const raw = String(marker || '');
  if (/^[ \t]+$/.test(raw)) return Math.max(1, Math.min(12, raw.length));
  if (/^□+$/.test(raw)) return Math.max(1, Math.min(12, [...raw].length));
  if (/^_+$/.test(raw)) return Math.max(1, Math.min(12, raw.length));
  return Math.max(1, Math.min(12, Number(fallback) || 4));
}

function parseFillTemplate(bodyText, manualCounts = []) {
  const source = String(bodyText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blankRegex = /_{2,}|□+|[ \t]{2,}/g;
  const parts = [];
  const blanks = [];
  let cursor = 0;
  let match;

  while ((match = blankRegex.exec(source))) {
    if (match.index > cursor) parts.push({ type: 'text', text: source.slice(cursor, match.index) });
    const index = blanks.length;
    const manualCount = manualCounts[index];
    const charCount = Math.max(1, Math.min(12, Number(manualCount) || charCountFromBlankMarker(match[0], manualCounts[manualCounts.length - 1] || 4)));
    const blank = { index, charCount, marker: match[0] };
    blanks.push(blank);
    parts.push({ type: 'blank', index, charCount });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) parts.push({ type: 'text', text: source.slice(cursor) });
  return { source, parts, blanks, blankCounts: blanks.map(blank => blank.charCount) };
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map(item => typeof item === 'string' ? item : (item?.url || item?.src || item?.storageUrl || ''))
    .map(url => String(url || '').trim())
    .filter(Boolean);
}

function renderExistingImages(images) {
  if (!images.length) {
    return `<div class="form-hint">기존 사진이 없습니다. 아래에서 새 사진을 추가할 수 있어요.</div>`;
  }
  return `
    <div class="img-preview-grid edit-existing-images__grid" id="edit-existing-images">
      ${images.map((url, index) => `
        <div class="img-preview-item edit-existing-image" data-image-url="${esc(url)}">
          <img src="${esc(url)}" alt="기존 사진 ${index + 1}">
          ${index === 0 ? '<div class="img-preview-star">대표</div>' : `<button class="img-preview-thumb-btn" data-edit-set-thumb="${index}" title="대표 사진으로 설정">★</button>`}
          <div class="img-preview-toolbar">
            ${index > 0 ? `<button class="img-tool-btn" data-edit-move-up="${index}" title="앞으로">↑</button>` : ''}
            ${index < images.length - 1 ? `<button class="img-tool-btn" data-edit-move-down="${index}" title="뒤로">↓</button>` : ''}
            <button class="img-tool-btn img-tool-btn--remove" data-edit-remove="${index}" title="삭제">✕</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function currentExistingImages() {
  return [...document.querySelectorAll('#edit-existing-images .edit-existing-image')]
    .map(item => item.dataset.imageUrl || '')
    .filter(Boolean);
}

function rerenderExistingImages(images) {
  const wrap = document.getElementById('edit-existing-images-wrap');
  if (!wrap) return;
  wrap.innerHTML = renderExistingImages(images);
  bindExistingImageControls();
}

function bindExistingImageControls() {
  const grid = document.getElementById('edit-existing-images');
  if (!grid || grid.dataset.bound === '1') return;
  grid.dataset.bound = '1';
  grid.addEventListener('click', event => {
    const btn = event.target.closest('button');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const images = currentExistingImages();

    if (btn.dataset.editRemove != null) {
      images.splice(Number(btn.dataset.editRemove), 1);
      rerenderExistingImages(images);
      return;
    }
    if (btn.dataset.editMoveUp != null) {
      const index = Number(btn.dataset.editMoveUp);
      if (index > 0) [images[index - 1], images[index]] = [images[index], images[index - 1]];
      rerenderExistingImages(images);
      return;
    }
    if (btn.dataset.editMoveDown != null) {
      const index = Number(btn.dataset.editMoveDown);
      if (index < images.length - 1) [images[index], images[index + 1]] = [images[index + 1], images[index]];
      rerenderExistingImages(images);
      return;
    }
    if (btn.dataset.editSetThumb != null) {
      const index = Number(btn.dataset.editSetThumb);
      const [image] = images.splice(index, 1);
      if (image) images.unshift(image);
      rerenderExistingImages(images);
      toast.success('대표 사진을 변경했어요');
    }
  });
}

function quizSecret(post) {
  return post.__quizSecret || {};
}

function renderModules(post) {
  if (post.type !== 'multi') return '';
  const m = post.modules || {};
  const desc = descToPlain(post.desc || '');
  const qSecret = quizSecret(post);
  const quiz = m.quiz || {};
  const quizMode = quiz.mode === 'multiple' || qSecret.mode === 'multiple' || qSecret.quizMode === 'multiple' ? 'multiple' : 'subjective';
  const quizOptions = Array.isArray(quiz.options) ? quiz.options : [];
  const correctIndex = Number.isInteger(Number(qSecret.correctIndex ?? qSecret.answerIdx ?? quiz.correctIndex))
    ? Number(qSecret.correctIndex ?? qSecret.answerIdx ?? quiz.correctIndex)
    : 0;
  const quizAnswer = qSecret.answer || quiz.answer || (quizMode === 'multiple' ? (quizOptions[correctIndex]?.text || '') : '');

  return `<div class="card edit-module-card" style="margin-top:12px"><div class="card__body--lg">
    <div style="font-size:14px;font-weight:900;margin-bottom:6px">기존 참여 기능</div>
    <div class="form-hint">수정 화면에서는 글쓰기 유형을 다시 고르지 않고, 기존 기능 설정만 수정합니다.</div>
    ${moduleLabels(m)}

    ${m.anonymous?.enabled || post.anonymous ? `
      <div class="form-group">
        <label class="form-label">익명 설정</label>
        <label class="edit-check-row"><input type="checkbox" id="edit-anonymous" ${post.anonymous || m.anonymous?.enabled ? 'checked' : ''}> 익명으로 표시</label>
      </div>` : ''}

    ${m.youtube?.enabled ? `
      <div class="form-group">
        <label class="form-label">유튜브 링크</label>
        <input id="edit-youtube-url" class="form-input" value="${esc(m.youtube.url || '')}" maxlength="220">
      </div>` : ''}

    ${m.vote?.enabled ? `
      <div class="form-group">
        <label class="form-label">투표/판정 질문</label>
        <input id="edit-vote-q" class="form-input" value="${esc(m.vote.question || desc || '')}" maxlength="160">
      </div>
      <div class="form-group">
        <label class="form-label">투표 선택지</label>
        ${(m.vote.options || []).map((option, index) => `<input class="form-input edit-vote-o" style="margin-bottom:8px" value="${esc(option.text || option || '')}" data-votes="${Number(option.votes || 0)}" placeholder="선택지 ${index + 1}">`).join('')}
      </div>` : ''}

    ${m.fill?.enabled ? `
      <div class="form-group">
        <label class="form-label">빈칸별 칸 수</label>
        <input id="edit-fill-counts" class="form-input" value="${esc(fillCounts(m.fill).join(', '))}" maxlength="80">
        <div class="form-hint">본문의 ___, □□□, 스페이스 2칸 이상 순서대로 칸 수를 쉼표로 입력하세요. 예: 3, 4</div>
      </div>` : ''}

    ${m.naming?.enabled ? `
      <div class="form-group">
        <label class="form-label">작명 글자 수 제한</label>
        <select id="edit-naming-count" class="form-select">
          <option value="0" ${Number(m.naming.charCount || 0) === 0 ? 'selected' : ''}>자유</option>
          <option value="3" ${Number(m.naming.charCount || 0) === 3 ? 'selected' : ''}>3글자</option>
          <option value="5" ${Number(m.naming.charCount || 0) === 5 ? 'selected' : ''}>5글자</option>
        </select>
      </div>` : ''}

    ${m.acrostic?.enabled ? `
      <div class="form-group">
        <label class="form-label">삼행시 제시어</label>
        <input id="edit-acrostic-k" class="form-input" value="${esc(m.acrostic.keyword || '')}" maxlength="12">
      </div>` : ''}

    ${m.relay?.enabled ? `
      <div class="form-group">
        <label class="form-label">릴레이 시작 문장</label>
        <textarea id="edit-relay-s" class="form-textarea" rows="3" maxlength="500">${esc(m.relay.startSentence || desc || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">릴레이 미션</label>
        <input id="edit-relay-mission" class="form-input" value="${esc(m.relay.mission?.key || 'none')}" maxlength="30">
        <div class="form-hint">예: none, but, horror, animal, twist, dialogue</div>
      </div>` : ''}

    ${m.quiz?.enabled ? `
      <div class="form-group">
        <label class="form-label">퀴즈 문제</label>
        <input id="edit-quiz-q" class="form-input" value="${esc(quiz.question || desc || '')}" maxlength="180">
      </div>
      <div class="form-group">
        <label class="form-label">퀴즈 방식</label>
        <select id="edit-quiz-mode" class="form-select">
          <option value="subjective" ${quizMode === 'subjective' ? 'selected' : ''}>주관식</option>
          <option value="multiple" ${quizMode === 'multiple' ? 'selected' : ''}>객관식</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">객관식 선택지</label>
        ${(quizOptions.length ? quizOptions : [{ text: '' }, { text: '' }]).map((option, index) => `
          <div class="edit-quiz-option-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <input class="form-input edit-quiz-o" value="${esc(option.text || option || '')}" placeholder="선택지 ${index + 1}">
            <label style="font-size:12px;white-space:nowrap"><input type="radio" name="edit-quiz-correct" value="${index}" ${index === correctIndex ? 'checked' : ''}> 정답</label>
          </div>`).join('')}
      </div>
      <div class="form-group">
        <label class="form-label">정답</label>
        <input id="edit-quiz-a" class="form-input" value="${esc(quizAnswer)}" maxlength="120">
        <div class="form-hint">객관식은 선택지 라디오를 기준으로 저장되며, 정답 칸은 보조 확인용입니다.</div>
      </div>
      <div class="form-group">
        <label class="form-label">힌트</label>
        <input id="edit-quiz-hint" class="form-input" value="${esc(quiz.hint || '')}" maxlength="160">
      </div>
      <div class="form-group">
        <label class="form-label">정답 해설</label>
        <textarea id="edit-quiz-explanation" class="form-textarea" rows="3" maxlength="500">${esc(qSecret.explanation || quiz.explanation || '')}</textarea>
      </div>` : ''}
  </div></div>`;
}

function parseYouTubeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (url.pathname.startsWith('/watch')) id = url.searchParams.get('v') || '';
      else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] || '';
      else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
    }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
    return { enabled: true, provider: 'youtube', videoId: id, url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube.com/embed/${id}` };
  } catch {
    return null;
  }
}

function relayMission(key) {
  return {
    but: { key: 'but', title: '그런데 시작', instruction: '다음 문장은 “그런데”로 시작해 주세요.', badge: '그런데' },
    horror: { key: 'horror', title: '공포 전환', instruction: '갑자기 분위기를 공포로 바꿔 주세요.', badge: '공포' },
    animal: { key: 'animal', title: '동물 등장', instruction: '동물 하나를 자연스럽게 등장시켜 주세요.', badge: '동물' },
    twist: { key: 'twist', title: '반전 넣기', instruction: '마지막에 짧은 반전을 넣어 주세요.', badge: '반전' },
    dialogue: { key: 'dialogue', title: '대사 필수', instruction: '인물 대사 한 줄을 반드시 포함해 주세요.', badge: '대사' },
  }[key] || null;
}

async function buildUpdate(post) {
  const title = document.getElementById('edit-title-force')?.value.trim() || '';
  if (!title) throw new Error('제목을 입력해주세요.');
  const desc = document.getElementById('edit-desc-force')?.value.trim() || '';
  const existingImages = currentExistingImages();
  const newImages = await getUploadedImages();
  const images = [...existingImages, ...newImages];
  const patch = {
    title,
    desc,
    tags: splitTags(document.getElementById('edit-tags-force')?.value || ''),
    images,
    updatedAt: serverTimestamp(),
  };
  let quizSecretPatch = null;

  if (post.type === 'multi') {
    const m = { ...(post.modules || {}) };

    const anonymousBox = document.getElementById('edit-anonymous');
    if (anonymousBox) {
      const anonymous = !!anonymousBox.checked;
      patch.anonymous = anonymous;
      patch.anonymousMode = anonymous ? 'general-option' : '';
      if (anonymous) {
        m.anonymous = { enabled: true, mode: 'general-option' };
        patch.authorName = '익명';
        patch.authorPhoto = '';
      } else {
        delete m.anonymous;
        patch.authorName = appState.nickname || auth.currentUser?.displayName || post.authorName || '익명';
        patch.authorPhoto = auth.currentUser?.photoURL || post.authorPhoto || '';
      }
    }

    const youtubeInput = document.getElementById('edit-youtube-url');
    if (youtubeInput) {
      const raw = youtubeInput.value.trim();
      if (raw) {
        const youtube = parseYouTubeUrl(raw);
        if (!youtube) throw new Error('유튜브 링크를 확인해주세요.');
        m.youtube = youtube;
      } else {
        delete m.youtube;
      }
    }

    if (m.vote?.enabled) {
      const opts = [...document.querySelectorAll('.edit-vote-o')]
        .map((input, index) => ({ text: input.value.trim() || `선택지 ${index + 1}`, votes: Number(input.dataset.votes || 0) }))
        .filter(option => option.text);
      if (opts.length < 2) throw new Error('투표 선택지는 2개 이상 필요합니다.');
      m.vote = { ...m.vote, question: document.getElementById('edit-vote-q')?.value.trim() || desc || '선택해주세요', options: opts };
    }

    if (m.fill?.enabled) {
      const counts = parseCounts(document.getElementById('edit-fill-counts')?.value || '4');
      const template = parseFillTemplate(desc, counts);
      m.fill = {
        ...m.fill,
        prompt: desc,
        templateParts: template.parts.length ? template.parts : m.fill.templateParts || [],
        blankCounts: template.blankCounts.length ? template.blankCounts : counts,
        blanks: template.blanks.length ? template.blanks : counts.map((count, index) => ({ index, charCount: count })),
        charCount: (template.blankCounts[0] || counts[0] || 4),
        blankCount: template.blanks.length || counts.length,
        inputMode: 'line-aware-template',
      };
    }

    if (m.naming?.enabled) {
      m.naming = { ...m.naming, charCount: Number(document.getElementById('edit-naming-count')?.value || 0) };
    }

    if (m.acrostic?.enabled) {
      const keyword = document.getElementById('edit-acrostic-k')?.value.trim() || '';
      if ([...keyword].length < 2) throw new Error('삼행시 제시어는 2글자 이상 입력해주세요.');
      m.acrostic = { ...m.acrostic, keyword };
    }

    if (m.relay?.enabled) {
      const missionKey = document.getElementById('edit-relay-mission')?.value.trim() || 'none';
      const mission = relayMission(missionKey);
      m.relay = {
        ...m.relay,
        startSentence: document.getElementById('edit-relay-s')?.value.trim() || desc || m.relay.startSentence || '',
        mission: mission ? { enabled: true, ...mission } : { enabled: false, key: 'none' },
      };
    }

    if (m.quiz?.enabled) {
      const mode = document.getElementById('edit-quiz-mode')?.value === 'multiple' ? 'multiple' : 'subjective';
      const question = document.getElementById('edit-quiz-q')?.value.trim() || desc || '';
      const hint = document.getElementById('edit-quiz-hint')?.value.trim() || '';
      const explanation = document.getElementById('edit-quiz-explanation')?.value.trim() || '';
      if (!question) throw new Error('퀴즈 문제를 입력해주세요.');

      if (mode === 'multiple') {
        const options = [...document.querySelectorAll('.edit-quiz-o')].map(input => input.value.trim()).filter(Boolean);
        const selected = Number(document.querySelector('input[name="edit-quiz-correct"]:checked')?.value || 0);
        const answer = options[selected] || document.getElementById('edit-quiz-a')?.value.trim() || '';
        const correctIndex = Math.max(0, options.indexOf(answer));
        if (options.length < 2) throw new Error('객관식 선택지는 2개 이상 필요합니다.');
        if (!answer) throw new Error('퀴즈 정답을 입력해주세요.');
        m.quiz = { enabled: true, mode, question, options: options.map(text => ({ text })), hint };
        quizSecretPatch = { quizMode: mode, mode, answer, answerIdx: correctIndex, correctIndex, explanation, updatedAt: serverTimestamp() };
      } else {
        const answer = document.getElementById('edit-quiz-a')?.value.trim() || '';
        if (!answer) throw new Error('퀴즈 정답을 입력해주세요.');
        m.quiz = { enabled: true, mode, question, hint };
        quizSecretPatch = { quizMode: mode, mode, answer, answerIdx: null, correctIndex: null, explanation, updatedAt: serverTimestamp() };
      }
    }

    patch.modules = m;
    patch.typeLabel = typeLabel({ ...post, modules: m, anonymous: patch.anonymous ?? post.anonymous });
    patch.subtype = post.subtype || '';
  }

  return { patch, quizSecretPatch };
}

function render(post) {
  const el = document.getElementById('page-content');
  if (!el) return;
  const label = typeLabel(post);
  const images = normalizeImages(post.images);

  el.innerHTML = `
    <div class="write-page post-edit-page" data-edit-post-id="${esc(post.id)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="edit-back-force" type="button">←</button>
        <h1 class="write-step-title">✏️ 게시글 수정</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          <div class="form-hint" style="margin-bottom:14px">기존 글 유형: <b>${esc(label)}</b> · 글쓰기 유형 버튼은 숨김 처리됩니다.</div>
          <div class="form-group">
            <label class="form-label">제목 <span class="required">*</span></label>
            <input id="edit-title-force" class="form-input" maxlength="100" value="${esc(post.title || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">내용</label>
            <textarea id="edit-desc-force" class="form-textarea" rows="8" maxlength="5000">${esc(descToPlain(post.desc || ''))}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">태그</label>
            <input id="edit-tags-force" class="form-input" maxlength="160" value="${esc((post.tags || []).join(', '))}">
          </div>
          <div class="form-group">
            <label class="form-label">기존 사진</label>
            <div id="edit-existing-images-wrap">${renderExistingImages(images)}</div>
          </div>
          <div class="form-group">
            <label class="form-label">새 사진 추가</label>
            <div id="edit-img-uploader"></div>
            <div class="form-hint">기존 사진을 유지한 채 새 사진을 추가할 수 있습니다. 저장 시 기존 사진 + 새 사진 순서로 반영됩니다.</div>
          </div>
        </div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" id="edit-cancel-force" type="button">취소</button>
            <button class="btn btn--primary" id="edit-save-force" type="button">수정 저장</button>
          </div>
        </div>
      </div>
      ${renderModules(post)}
    </div>`;

  const uploader = document.getElementById('edit-img-uploader');
  if (uploader) initImageUploader(uploader, Infinity);
  bindExistingImageControls();

  document.getElementById('edit-back-force')?.addEventListener('click', () => navigate(`/detail/${post.id}`));
  document.getElementById('edit-cancel-force')?.addEventListener('click', () => navigate(`/detail/${post.id}`));
  document.getElementById('edit-save-force')?.addEventListener('click', async () => {
    const btn = document.getElementById('edit-save-force');
    try {
      btn.disabled = true;
      btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '저장 중...';
      const { patch, quizSecretPatch } = await buildUpdate(post);
      btn.textContent = '저장 중...';
      await updateDoc(doc(db, 'feeds', post.id), patch);
      if (quizSecretPatch) {
        await setDoc(doc(db, 'feeds', post.id, 'secret', 'answer'), quizSecretPatch, { merge: true });
      }
      toast.success('게시글을 수정했어요.');
      navigate(`/detail/${post.id}`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || '수정 저장에 실패했어요.');
      btn.disabled = false;
      btn.textContent = '수정 저장';
    }
  });
}

async function waitForAuthReady() {
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
    return auth.currentUser;
  }
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged ? auth.onAuthStateChanged(user => { unsub(); resolve(user || null); }) : null;
    if (!unsub) resolve(auth.currentUser || null);
  });
}

async function loadQuizSecret(postId) {
  try {
    const snap = await getDoc(doc(db, 'feeds', postId, 'secret', 'answer'));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

async function renderEdit() {
  if (!isEdit()) return;
  hideNewWriteUi();
  const id = editId();
  const el = document.getElementById('page-content');
  if (!el) return;

  const rendered = el.querySelector('.post-edit-page[data-edit-post-id]');
  if (rendered?.dataset.editPostId === id) return;

  el.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  try {
    const [user, snap] = await Promise.all([waitForAuthReady(), getDoc(doc(db, 'feeds', id))]);
    if (!snap.exists()) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">수정할 글을 찾을 수 없어요</div></div>';
      return;
    }
    if (!user) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🔐</div><div class="empty-state__title">로그인 후 수정할 수 있어요</div><button class="btn btn--primary" onclick="navigate(\'/login\')" style="margin-top:16px">로그인하기</button></div>';
      return;
    }

    const post = { id: snap.id, ...snap.data() };
    if (post.type === 'multi' && post.modules?.quiz?.enabled) {
      post.__quizSecret = await loadQuizSecret(post.id);
    }
    render(post);
  } catch (error) {
    console.error(error);
    el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">수정 화면을 불러오지 못했어요</div></div>';
  }
}

function addAdminEditButtons() {
  document.querySelectorAll('#admin-content tr[data-row]').forEach(row => {
    if (row.dataset.editReady === '1') return;
    const id = row.dataset.row;
    const cell = row.querySelector('td:last-child');
    if (!id || !cell) return;
    row.dataset.editReady = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--ghost btn--sm';
    btn.textContent = '수정';
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      navigate(`/write?edit=${encodeURIComponent(id)}`);
    });
    cell.prepend(btn, document.createTextNode(' '));
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    addAdminEditButtons();
    renderEdit();
    hideNewWriteUi();
  }, 80);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-write-edit', schedule);
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 400);