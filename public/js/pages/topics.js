import { db } from '../firebase.js';
import { collection, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let allTopics = [];
let allCategories = [];

export async function renderTopics(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">⚖️ 사건 목록</span>
      </div>
      <div class="container" style="padding-top:20px;padding-bottom:80px;">
        <div class="search-input-wrap">
          <input type="text" id="search-input" class="search-input" placeholder="사건 검색...">
          <span class="search-icon">🔍</span>
        </div>
        <div class="cat-filter" id="cat-filter" style="margin-bottom:20px;">
          <button class="cat-pill active" data-cat="">전체</button>
        </div>
        <div id="topics-list">
          <div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
  `;

  await Promise.all([loadCategories(), loadTopics()]);
  renderFilter();
  renderList();

  document.getElementById('search-input')?.addEventListener('input', function () {
    renderList(this.value.trim());
  });
}

async function loadCategories() {
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { allCategories = []; }
}

async function loadTopics() {
  try {
    const snap = await getDocs(query(
      collection(db, 'topics'),
      where('status', '==', 'active'),
      orderBy('playCount', 'desc')
    ));
    allTopics = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { allTopics = []; }
}

function renderFilter() {
  const el = document.getElementById('cat-filter');
  if (!el || !allCategories.length) return;
  const pills = allCategories.map(c =>
    `<button class="cat-pill" data-cat="${c.name}">${c.icon || ''} ${c.name}</button>`
  ).join('');
  el.insertAdjacentHTML('beforeend', pills);
  el.addEventListener('click', e => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    el.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const search = document.getElementById('search-input')?.value.trim() || '';
    renderList(search, pill.dataset.cat);
  });
}

let _activeCat = '';
function renderList(search = '', cat = _activeCat) {
  _activeCat = cat;
  const el = document.getElementById('topics-list');
  if (!el) return;

  let list = allTopics;
  if (cat) list = list.filter(t => t.category === cat);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.summary?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <span class="empty-state-icon">🔍</span>
      <div class="empty-state-title">${allTopics.length ? '검색 결과가 없습니다' : '아직 등록된 사건이 없습니다'}</div>
      <div class="empty-state-sub">다른 검색어를 입력하거나<br>직접 사건을 등록해보세요</div>
      <a href="#/submit-topic" class="btn btn-secondary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">주제 등록하기</a>
    </div>`;
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="topic-card" onclick="location.hash='#/topic/${t.id}'" style="margin-bottom:10px;">
      <div class="topic-card-title">${t.title}</div>
      <div class="topic-card-summary">${t.summary}</div>
      <div class="topic-card-footer">
        <span class="topic-card-cat">${t.category || '생활'}</span>
        <span>재판 ${(t.playCount||0).toLocaleString()}회</span>
        ${t.isOfficial ? '<span style="color:var(--gold);font-size:10px;font-weight:700;">공식</span>' : ''}
      </div>
    </div>
  `).join('');
}
