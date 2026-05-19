import { auth, db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';

const PRESETS = {
  vote: {
    label: '골라봐', icon: '🗳️', modules: ['vote'],
    title: '둘 중 뭐가 더 나아?', desc: '사람들의 선택을 받아보고 싶은 내용을 적어보세요.',
    voteQuestion: '어느 쪽을 고를까요?', voteOptions: ['A 선택', 'B 선택'], tags: '골라봐, 투표'
  },
  naming: {
    label: '미친작명소', icon: '😜', modules: ['naming'],
    title: '이 사진 이름 좀 지어줘', desc: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.', tags: '작명, 미친작명소'
  },
  initial_game: {
    label: '초성게임', icon: '🔤', modules: ['quiz'],
    title: '초성게임 도전', desc: '초성이나 힌트를 본문에 적고 정답을 문제 기능에 넣어보세요.',
    quizQuestion: '정답은 무엇일까요?', quizAnswer: '', tags: '초성게임, 문제'
  },
  crazy_court: {
    label: '억까재판', icon: '⚖️', modules: ['vote'],
    title: '이거 억까인가요?', desc: '상황을 적고 사람들이 판결하게 해보세요.',
    voteQuestion: '이건 억까인가요?', voteOptions: ['억까다', '아니다'], tags: '억까재판, 판결'
  },
  relay: {
    label: '막장릴레이', icon: '🎭', modules: ['relay'],
    title: '막장릴레이 시작', desc: '첫 문장을 던지고 사람들이 이야기를 이어가게 해보세요.',
    relayStart: '어느 날 갑자기 이상한 일이 벌어졌다.', tags: '막장릴레이, 이어쓰기'
  },
  acrostic: {
    label: '삼행시짓기', icon: '✍️', modules: ['acrostic'],
    title: '삼행시 도전', desc: '제시어를 넣고 사람들이 한 줄씩 완성하게 해보세요.',
    acrosticKeyword: '소소킹', tags: '삼행시, 제시어'
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
    <div class="type-select-card__name">만능 놀이글</div>
    <div class="type-select-card__desc">글·사진·투표·작명·삼행시·릴레이·문제를 한 번에 조합</div>`;
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
      <div class="multi-preset-box__title">빠른 템플릿</div>
      <div class="multi-preset-box__desc">기존 6개 유형을 만능 놀이글 모듈 조합으로 빠르게 시작합니다.</div>
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
        <h1 class="write-step-title">🧩 만능 놀이글</h1>
      </div>
      <div class="multi-write-intro">
        <div class="multi-write-intro__title">필요한 놀이 기능만 켜서 하나의 글로 만드세요.</div>
        <div class="multi-write-intro__desc">기존 6개 유형을 템플릿으로 불러오거나, 원하는 기능을 직접 조합할 수 있습니다.</div>
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
            <input id="mw-tags" class="form-input" maxlength="100" value="${esc(preset?.tags || '')}" placeholder="#태그, #만능글, #소소킹">
          </div>

          <div class="multi-module-list">
            ${moduleCard('vote', '🗳️', '투표 추가', '선택지를 만들어 사람들이 고르게 합니다.', `
              <div class="form-group">
                <label class="form-label">투표 질문</label>
                <input id="mw-vote-question" class="form-input" maxlength="100" value="${esc(preset?.voteQuestion || '')}" placeholder="예: 어떤 이름이 제일 웃김?">
              </div>
              <div class="multi-option-list" id="mw-vote-options">
                ${(preset?.voteOptions || ['','']).map((v, i) => `<input class="form-input mw-vote-option" maxlength="80" value="${esc(v)}" placeholder="선택지 ${i + 1}">`).join('')}
              </div>
              <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option">+ 선택지 추가</button>`, isOn('vote'))}

            ${moduleCard('naming', '😜', '작명 참여 추가', '참여자들이 웃긴 이름을 올립니다.', `
              <div class="form-group">
                <label class="form-label">글자수 제한</label>
                <select id="mw-naming-count" class="form-select">
                  <option value="0">자유</option>
                  <option value="3">3글자</option>
                  <option value="5">5글자</option>
                </select>
              </div>`, isOn('naming'))}

            ${moduleCard('acrostic', '✍️', '삼행시 참여 추가', '제시어 글자별로 한 줄씩 작성합니다.', `
              <div class="form-group">
                <label class="form-label">제시어</label>
                <input id="mw-acrostic-keyword" class="form-input" maxlength="8" value="${esc(preset?.acrosticKeyword || '')}" placeholder="예: 소소킹">
              </div>`, isOn('acrostic'))}

            ${moduleCard('relay', '🎭', '릴레이 이어쓰기 추가', '참여자들이 한 문장씩 이야기를 이어갑니다.', `
              <div class="form-group">
                <label class="form-label">시작 문장</label>
                <textarea id="mw-relay-start" class="form-textarea" rows="3" maxlength="300" placeholder="예: 어느 날 내 폰에 이상한 문자가 도착했다.">${esc(preset?.relayStart || '')}</textarea>
              </div>`, isOn('relay'))}

            ${moduleCard('quiz', '🧠', '간단 문제 추가', '정답 맞히기 문제를 넣습니다.', `
              <div class="form-group">
                <label class="form-label">문제</label>
                <input id="mw-quiz-question" class="form-input" maxlength="160" value="${esc(preset?.quizQuestion || '')}" placeholder="예: 소소킹의 첫 글자는?">
              </div>
              <div class="form-group">
                <label class="form-label">정답</label>
                <input id="mw-quiz-answer" class="form-input" maxlength="80" value="${esc(preset?.quizAnswer || '')}" placeholder="예: 소">
              </div>`, isOn('quiz'))}
          </div>

          <div class="multi-comment-note">💬 일반 댓글과 공유는 항상 켜져 있습니다.</div>
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

  if (enabled('relay')) {
    const startSentence = document.getElementById('mw-relay-start')?.value.trim() || '';
    if (!startSentence) throw new Error('릴레이 시작 문장을 입력해주세요.');
    modules.relay = { enabled: true, startSentence };
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
    toast.success('만능 놀이글을 올렸어요! 🎉');
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
