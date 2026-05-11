import { STORY_CASE_PACK, STORY_CASE_CATEGORIES } from '../data/story-case-pack.js';

let timer = null;
let observer = null;

function bootStoryCaseBoard() {
  injectStyle();
  renderWhenNeeded();
  window.addEventListener('hashchange', renderWhenNeeded);
  if (!observer) {
    observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(renderWhenNeeded, 100);
    });
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
  }
}

function renderWhenNeeded() {
  if (String(location.hash || '') !== '#/topics') return;
  const list = document.getElementById('topics-list');
  if (!list || list.dataset.storyBoard === '1') return;
  const banner = document.querySelector('.official-pack-banner');
  if (banner) {
    banner.innerHTML = `<span>🕵️</span><div><strong>오늘은 단서와 반전이 있는 사건으로 진행합니다</strong><small>기존 단순 사건 대신 증거, 목격자, 반전 포인트가 있는 스토리형 사건을 우선 보여줍니다.</small></div><button onclick="location.hash='#/case-quest'">내 사건 접수</button>`;
  }
  const signTitle = document.querySelector('.case-board-sign .sign-title');
  const signSub = document.querySelector('.case-board-sign .sign-sub');
  if (signTitle) signTitle.textContent = `스토리 사건 ${STORY_CASE_PACK.length}개`;
  if (signSub) signSub.textContent = '유치한 말다툼보다 단서와 반전 중심';

  const catFilter = document.getElementById('cat-filter');
  if (catFilter && catFilter.dataset.storyFilter !== '1') {
    catFilter.dataset.storyFilter = '1';
    catFilter.innerHTML = '<button class="case-cat-pill active" data-cat="">전체</button>' + STORY_CASE_CATEGORIES.map(c => `<button class="case-cat-pill" data-cat="${esc(c.name)}">${esc(c.icon)} ${esc(c.name)}</button>`).join('');
    catFilter.addEventListener('click', e => {
      const pill = e.target.closest('.case-cat-pill');
      if (!pill) return;
      catFilter.querySelectorAll('.case-cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      drawList(pill.dataset.cat || '', document.getElementById('search-input')?.value || '');
    });
  }

  const input = document.getElementById('search-input');
  if (input && input.dataset.storySearch !== '1') {
    input.dataset.storySearch = '1';
    input.placeholder = '치킨 유언, 블루체크, 쿠폰, 에어컨, 딸기우유...';
    input.addEventListener('input', () => {
      const cat = document.querySelector('.case-cat-pill.active')?.dataset.cat || '';
      drawList(cat, input.value || '');
    });
  }
  drawList('', '');
}

function drawList(cat = '', search = '') {
  const list = document.getElementById('topics-list');
  if (!list) return;
  list.dataset.storyBoard = '1';
  const q = String(search || '').trim().toLowerCase();
  let cases = STORY_CASE_PACK.filter(c => !cat || c.category === cat);
  if (q) {
    cases = cases.filter(c => [c.title, c.summary, c.category, c.difficulty, c.hook, c.twist, c.plaintiffPosition, c.defendantPosition].some(v => String(v || '').toLowerCase().includes(q)));
  }
  if (!cases.length) {
    list.innerHTML = `<div class="case-empty-state"><div class="case-empty-icon">🔍</div><div class="case-empty-title">맞는 스토리 사건이 없습니다</div><div class="case-empty-sub">다른 검색어를 입력하거나 직접 사건을 접수해보세요.</div><button onclick="location.hash='#/case-quest'" class="case-empty-btn">🕵️ 사건 직접 접수</button></div>`;
    return;
  }
  list.innerHTML = cases.map((c, i) => `
    <article class="case-door-card story-case-card" data-case-id="${esc(c.id)}" style="animation-delay:${Math.min(i * .025, .36)}s;">
      <div class="case-door-top">
        <div class="case-file-icon">${caseIcon(c.category)}</div>
        <div>
          <div class="case-door-cat">${esc(c.category)} · ${esc(c.difficulty)}</div>
          <div class="case-door-count">스토리 사건 · 단서/반전 포함</div>
        </div>
      </div>
      <div class="case-door-title">${esc(c.title)}</div>
      <div class="case-door-summary">${esc(c.summary)}</div>
      <div class="story-hook"><b>사건 발단</b><span>${esc(c.hook)}</span></div>
      <div class="story-twist"><b>반전 포인트</b><span>${esc(c.twist)}</span></div>
      <div class="case-roles-mini">
        <div class="case-role-mini red"><span>🔴 문제 제기</span><strong>${esc(c.plaintiffPosition)}</strong></div>
        <div class="case-role-mini blue"><span>🔵 상대측 설명</span><strong>${esc(c.defendantPosition)}</strong></div>
      </div>
      <div class="story-actions">
        <button class="story-main" data-action="start" data-id="${esc(c.id)}">🕵️ 이 사건으로 시작</button>
      </div>
    </article>
  `).join('');
  list.querySelectorAll('[data-action="start"]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const item = STORY_CASE_PACK.find(x => x.id === btn.dataset.id);
    if (!item) return;
    sessionStorage.setItem('sosoking_prefill_case', JSON.stringify({
      title: item.title,
      summary: `${item.summary} ${item.hook} ${item.twist}`.slice(0, 120),
      plaintiffPosition: item.plaintiffPosition,
      defendantPosition: item.defendantPosition,
      category: item.category,
      storyCaseId: item.id,
      difficulty: item.difficulty
    }));
    location.hash = '#/case-quest';
  }));
}

function caseIcon(category) {
  if (category === '카톡') return '💬';
  if (category === '음식') return '🍗';
  if (category === '정산') return '💸';
  if (category === '직장') return '💼';
  if (category === '연애') return '💘';
  if (category === '친구') return '👫';
  if (category === '취미') return '🎮';
  if (category === '이웃') return '🏘️';
  if (category === '가족') return '👨‍👩‍👧';
  return '📁';
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }

function injectStyle() {
  if (document.getElementById('story-case-board-style')) return;
  const style = document.createElement('style');
  style.id = 'story-case-board-style';
  style.textContent = `
    .story-case-card { border-color:rgba(201,168,76,.46) !important; }
    .story-case-card:after { content:'STORY'; position:absolute; top:12px; right:12px; border-radius:999px; padding:3px 8px; background:var(--gold); color:#0d1117; font-size:10px; font-weight:900; letter-spacing:.08em; }
    .story-hook, .story-twist { position:relative; margin-bottom:9px; padding:10px 11px; border-radius:13px; border:1px solid rgba(201,168,76,.18); background:rgba(255,255,255,.035); }
    [data-theme="light"] .story-hook, [data-theme="light"] .story-twist { background:rgba(154,112,24,.055); }
    .story-hook b, .story-twist b { display:block; color:var(--gold); font-size:10px; font-weight:900; margin-bottom:3px; }
    .story-hook span, .story-twist span { display:block; color:var(--cream-dim); font-size:12px; line-height:1.55; }
    .story-twist { border-color:rgba(231,76,60,.2); }
    .story-twist b { color:#e67e22; }
    .story-actions { margin-top:12px; display:grid; }
    .story-main { border:0; border-radius:13px; padding:12px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; font-size:13px; font-weight:900; cursor:pointer; }
  `;
  document.head.appendChild(style);
}

bootStoryCaseBoard();
