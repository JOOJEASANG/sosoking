import { auth, db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';

const PRESETS = {
  vote: {
    label: '투표/판정', icon: '🗳️', modules: ['vote'],
    title: '여러분의 판정은?', desc: '상황을 적고 사람들의 선택이나 판정을 받아보세요.',
    voteQuestion: '어떻게 생각하세요?', voteOptions: ['그렇다', '아니다'], tags: '투표, 판정'
  },
  naming: {
    label: '미친작명소', icon: '😜', modules: ['naming'],
    title: '이 사진 이름 좀 지어줘', desc: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.', tags: '작명, 미친작명소'
  },
  acrostic: {
    label: '삼행시', icon: '✍️', modules: ['acrostic'],
    title: '삼행시 도전', desc: '제시어를 넣고 사람들이 한 줄씩 완성하게 해보세요.',
    acrosticKeyword: '소소킹', tags: '삼행시, 제시어'
  },
  quiz: {
    label: '퀴즈', icon: '🧠', modules: ['quiz'],
    title: '퀴즈 도전', desc: '문제를 내고 사람들이 정답을 맞히게 해보세요.',
    quizQuestion: '정답은 무엇일까요?', quizAnswer: '', tags: '퀴즈, 문제'
  }
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function isWriteHome() {
  return (window.location.hash || '').startsWith('#/write') && !!document.querySelector('.type-select-grid');
}

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const preset = new URLSearchParams(query).get('preset');
  return PRESETS[preset] ? preset : '';
}

function addMultiCard() {
  if (!isWriteHome()) return;
  const grid = document.querySelector('.type-select-grid');
  if (!grid || grid.querySelector('[data-type="multi"]')) return;
  const card = document.createElement('div');
  card.className = 'type-select-card type-select-card--multi';
  card.dataset.type = 'multi';
  card.dataset.cat = 'multi';
  card.innerHTML = `
    <div class="type-select-card__icon">🧩</div>
    <div class="type-select-card__name">피드 글쓰기</div>
    <div class="type-select-card__desc">사진·투표·작명·삼행시·퀴즈를 조합하는 멀티게시판 글쓰기</div>`;
  card.addEventListener('click', () => {
    history.pushState(null, '', '#/write?type=multi');
    renderMultiWrite();
  });
  grid.insertAdjacentElement('afterbegin', card);
}

function moduleCard(key, icon, title, desc, body, checked = false) {
  return `
    <div class="multi-module ${checked ? 'is-enabled' : ''}" data-module-card="${key}">
      <label class="multi-module__head">
        <input type="checkbox" class="multi-module__toggle" data-module-toggle="${key}" ${checked ? 'checked' : ''}>
        <span class="multi-module__icon">${icon}</span>
        <span class="multi-module__text">
          <b>${title}</b>
          <small>${desc}</small>
        </span>
      </label>
      <div class="multi-module__body">${body}</div>
    </div>`;
}

function renderPresetButtons(activeKey) {
  return `
    <div class="multi-preset-box">
      <div class="multi-preset-box__title">글쓰기 형식</div>
      <div class="multi-preset-box__desc">피드에 올릴 글의 기본 형식을 고르세요. 선택 후에도 기능을 자유롭게 켜고 끌 수 있습니다.</div>
      <div class="multi-preset-list">
        ${Object.entries(PRESETS).map(([key, p]) => `
          <button type="button" class="multi-preset-btn ${activeKey === key ? 'active' : ''}" data-multi-preset="${key}">${p.icon} ${p.label}</button>`).join('')}
      </div>
    </div>`;
}

function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const renderKey = window.location.hash || '#/write?type=multi';
  const presetKey = getPresetKey();
  const preset = PRESETS[presetKey] || null;
  const isOn = key => !!preset?.modules?.includes(key);

  el.innerHTML = `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">🧩 피드 글쓰기</h1>
      </div>
      <div class="multi-write-intro">
        <div class="multi-write-intro__title">멀티게시판 커뮤니티 글쓰기</div>
        <div class="multi-write-intro__desc">미친작명소, 삼행시, 투표/판정, 퀴즈를 하나의 글 안에서 조합할 수 있습니다. 이어쓰기는 댓글과 답글 흐름으로 자연스럽게 진행됩니다.</div>
      </div>
      ${renderPresetButtons(presetKey)}
      <div class="card">
        <div class="card__body--lg">
          <div class="form-group">
            <label class="form-label">제목 <span class="required">*</span></label>
            <input id="mw-title" class="form-input" maxlength="100" value="${esc(preset?.title || '')}" placeholder="예: 이 사진 제목도 짓고 투표도 해보자">
          </div>
          <div class="form-group">
            <label class="form-label">본문</label>
            <textarea id="mw-desc" class="form-textarea" rows="4" maxlength="2000" placeholder="글, 상황 설명, 질문 등을 자유롭게 입력하세요.">${esc(preset?.desc || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">사진</label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진 개수 제한 없이 올릴 수 있어요.</div>
          </div>
          <div class="form-group">
            <label class="form-label">태그</label>
            <input id="mw-tags" class="form-input" maxlength="100" value="${esc(preset?.tags || '')}" placeholder="#태그, #피드, #소소킹">
          </div>

          <div class="multi-module-list">
            ${moduleCard('vote', '🗳️', '투표/판정 기능', '선택지를 만들어 사람들이 고르거나 판정하게 합니다.', `
              <div class="form-group">
                <label class="form-label">질문</label>
                <input id="mw-vote-question" class="form-input" maxlength="100" value="${esc(preset?.voteQuestion || '')}" placeholder="예: 여러분의 판정은?">
              </div>
              <div class="multi-option-list" id="mw-vote-options">
                ${(preset?.voteOptions || ['','']).map((v, i) => `<input class="form-input mw-vote-option" maxlength="80" value="${esc(v)}" placeholder="선택지 ${i + 1}">`).join('')}
              </div>
              <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option">+ 선택지 추가</button>`, isOn('vote'))}

            ${moduleCard('naming', '😜', '미친작명소 기능', '참여자들이 웃긴 이름을 올립니다.', `
              <div class="form-group">
                <label class="form-label">글자수 제한</label>
                <select id="mw-naming-count" class="form-select">
                  <option value="0">자유</option>
                  <option value="3">3글자</option>
                  <option value="5">5글자</option>
                </select>
              </div>`, isOn('naming'))}

            ${moduleCard('acrostic', '✍️', '삼행시 기능', '제시어 글자별로 한 줄씩 작성합니다.', `
              <div class="form-group">
                <label class="form-label">제시어</label>
                <input id="mw-acrostic-keyword" class="form-input" maxlength="8" value="${esc(preset?.acrosticKeyword || '')}" placeholder="예: 소소킹">
              </div>`, isOn('acrostic'))}

            ${moduleCard('quiz', '🧠', '퀴즈 기능', '정답 맞히기 문제를 넣습니다.', `
              <div class="form-group">
                <label class="form-label">문제</label>
                <input id="mw-quiz-question" class="form-input" maxlength="160" value="${esc(preset?.quizQuestion || '')}" placeholder="예: 소소킹의 첫 글자는?">
              </div>
              <div class="form-group">
                <label class="form-label">정답</label>
                <input id="mw-quiz-answer" class="form-input" maxlength="80" value="${esc(preset?.quizAnswer || '')}" placeholder="예: 소">
              </div>`, isOn('quiz'))}
          </div>

          <div class="multi-comment-note">💬 일반 댓글과 답글은 항상 켜져 있습니다. 이어쓰기형 놀이는 댓글로 자연스럽게 진행하세요.</div>
        </div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" type="button" id="multi-cancel">취소</button>
            <button class="btn btn--primary" type="button" id="multi-submit">올리기</button>
          </div>
        </div>
      </div>
    </div>`;

  const uploader = document.getElementById('mw-img-uploader');
  if (uploader) initImageUploader(uploader, Infinity);
  bindMultiWriteEvents();
}

function bindMultiWriteEvents() {
  document.getElementById('multi-back-type')?.addEventListener('click', () => {
    history.pushState(null, '', '#/write');
    window.dispatchEvent(new Event('hashchange'));
  });
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));
  document.querySelectorAll('[data-multi-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      history.pushState(null, '', `#/write?type=multi&preset=${btn.dataset.multiPreset}`);
      renderMultiWrite();
    });
  });
  document.getElementById('mw-add-vote-option')?.addEventListener('click', () => {
    const list = document.getElementById('mw-vote-options');
    const count = list?.querySelectorAll('.mw-vote-option').length || 0;
    if (count >= 8) { toast.warn('선택지는 최대 8개까지 가능해요'); return; }
    list.insertAdjacentHTML('beforeend', `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${count + 1}">`);
  });
  document.querySelectorAll('[data-module-toggle]').forEach(toggle => {
    const card = toggle.closest('.multi-module');
    const sync = () => card?.classList.toggle('is-enabled', toggle.checked);
    toggle.addEventListener('change', sync);
    sync();
  });
  document.getElementById('multi-submit')?.addEventListener('click', submitMultiPost);
}

function enabled(key) {
  return !!document.querySelector(`[data-module-toggle="${key}"]`)?.checked;
}

function splitTags(raw) {
  return String(raw || '').split(',').map(t => t.replace('#', '').trim()).filter(Boolean).slice(0, 8);
}

function collectModules() {
  const modules = { comments: { enabled: true } };

  if (enabled('vote')) {
    const options = [...document.querySelectorAll('.mw-vote-option')].map(i => i.value.trim()).filter(Boolean);
    if (options.length < 2) throw new Error('투표 선택지를 2개 이상 입력해주세요.');
    modules.vote = {
      enabled: true,
      question: document.getElementById('mw-vote-question')?.value.trim() || '선택해주세요',
      options: options.map(text => ({ text, votes: 0 })),
    };
  }

  if (enabled('naming')) {
    modules.naming = {
      enabled: true,
      charCount: Number(document.getElementById('mw-naming-count')?.value || 0),
    };
  }

  if (enabled('acrostic')) {
    const keyword = document.getElementById('mw-acrostic-keyword')?.value.trim() || '';
    if ([...keyword].length < 2) throw new Error('삼행시 제시어는 2글자 이상 입력해주세요.');
    modules.acrostic = { enabled: true, keyword };
  }

  if (enabled('quiz')) {
    const question = document.getElementById('mw-quiz-question')?.value.trim() || '';
    const answer = document.getElementById('mw-quiz-answer')?.value.trim() || '';
    if (!question || !answer) throw new Error('문제와 정답을 모두 입력해주세요.');
    modules.quiz = { enabled: true, question, answer };
  }

  return modules;
}

async function submitMultiPost() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const btn = document.getElementById('multi-submit');
  const title = document.getElementById('mw-title')?.value.trim() || '';
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
      title,
      desc: document.getElementById('mw-desc')?.value.trim() || '',
      tags: splitTags(document.getElementById('mw-tags')?.value || ''),
      images,
      modules,
      authorId: auth.currentUser.uid,
      authorName: appState.nickname || auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
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
    return;
  }
  addMultiCard();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 160);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
