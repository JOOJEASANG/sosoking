import { db } from '../firebase.js';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let allTopics = [];
let allCategories = [];
let _renderGen = 0;
let _activeCat = '';

export async function renderTopics(container) {
  allTopics = [];
  allCategories = [];
  const gen = ++_renderGen;
  try { localStorage.setItem('sosoking_game_mode', 'court'); } catch {}

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">🏛️ 사건 목록</span>
      </div>
      <div class="container" style="padding-top:16px;padding-bottom:80px;">
        <div class="submit-topic-tip" style="margin-bottom:16px;">
          📋 공감되는 사건을 고르고 <strong>원고</strong> 또는 <strong>피고</strong> 입장에서 재판을 시작하세요.<br>
          모든 사건은 AI 판사가 재미로 판결합니다.
        </div>
        <div class="search-input-wrap">
          <input type="text" id="search-input" class="search-input" placeholder="사건 검색...">
          <span class="search-icon">🔍</span>
        </div>
        <div class="cat-filter" id="cat-filter" style="margin-bottom:20px;"></div>
        <div id="topics-list">
          <div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
  `;

  await Promise.all([loadCategories(), loadTopics()]);
  if (gen !== _renderGen) return;
  renderFilter();
  renderList();

  document.getElementById('search-input')?.addEventListener('input', function () {
    renderList(this.value.trim());
  });

  document.getElementById('topics-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('.vote-btn');
    if (!btn) return;
    e.stopPropagation();
    const topicId = btn.dataset.topicId;
    const side = btn.dataset.side;
    if (!topicId || !side) return;
    try { if (localStorage.getItem(`sosoking_vote_${topicId}`)) return; } catch {}
    try { localStorage.setItem(`sosoking_vote_${topicId}`, side); } catch {}

    const topic = allTopics.find(t => t.id === topicId);
    if (topic) {
      if (side === 'A') topic.votesA = (topic.votesA || 0) + 1;
      else topic.votesB = (topic.votesB || 0) + 1;
      const wrap = btn.closest('[data-vote-wrap]');
      if (wrap) wrap.outerHTML = voteBarHtml(topic);
    }
    try {
      await updateDoc(doc(db, 'topics', topicId), { [`votes${side}`]: increment(1) });
    } catch {}
  });
}

async function loadCategories() {
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
    const seen = new Set();
    allCategories = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
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
  if (!el) return;
  el.innerHTML = '<button class="cat-pill active" data-cat="">전체</button>' +
    allCategories.map(c =>
      `<button class="cat-pill" data-cat="${escAttr(c.name)}">${escHtml(c.icon || '')} ${escHtml(c.name)}</button>`
    ).join('');
  el.addEventListener('click', e => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    el.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const search = document.getElementById('search-input')?.value.trim() || '';
    renderList(search, pill.dataset.cat);
  });
}

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
      <a href="#/submit-topic" class="btn btn-secondary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">사건 등록하기</a>
    </div>`;
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="topic-card" onclick="location.hash='#/topic/${encodeURIComponent(t.id)}'" style="margin-bottom:10px;">
      <div class="topic-card-title">${escHtml(t.title)}</div>
      <div class="topic-card-summary">${escHtml(t.summary)}</div>
      <div class="topic-card-footer">
        <span class="topic-card-cat">${escHtml(t.category || '생활')}</span>
        <span>재판 ${(t.playCount||0).toLocaleString()}회</span>
        ${t.isOfficial ? '<span style="color:var(--gold);font-size:10px;font-weight:700;">공식</span>' : ''}
      </div>
      ${voteBarHtml(t)}
    </div>
  `).join('');
}

function voteBarHtml(t) {
  let myVote = null;
  try { myVote = localStorage.getItem(`sosoking_vote_${t.id}`); } catch {}
  const votesA = t.votesA || 0;
  const votesB = t.votesB || 0;
  const total = votesA + votesB;

  if (myVote) {
    const pct = total > 0 ? Math.round((votesA / total) * 100) : 50;
    return `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:4px;">
        <span style="color:#e74c3c;">🔴 원고 ${pct}%</span>
        <span style="color:#3498db;">🔵 피고 ${100 - pct}%</span>
      </div>
      <div style="height:7px;border-radius:4px;overflow:hidden;display:flex;background:rgba(255,255,255,0.06);">
        <div style="width:${pct}%;background:linear-gradient(90deg,#e74c3c,#ff6b6b);border-radius:4px 0 0 4px;"></div>
        <div style="width:${100 - pct}%;background:linear-gradient(90deg,#3498db,#5dade2);border-radius:0 4px 4px 0;"></div>
      </div>
      <div style="text-align:center;font-size:10px;color:var(--cream-dim);margin-top:3px;">${total.toLocaleString()}명 참여</div>
    </div>`;
  }
  return `<div data-vote-wrap style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;" onclick="event.stopPropagation()">
    <span style="font-size:11px;color:var(--cream-dim);flex-shrink:0;">나는?</span>
    <button class="vote-btn" data-topic-id="${escAttr(t.id)}" data-side="A" style="flex:1;padding:6px;border-radius:8px;border:1.5px solid rgba(231,76,60,0.5);background:rgba(231,76,60,0.08);color:#e74c3c;font-size:12px;font-weight:700;cursor:pointer;">🔴 원고</button>
    <button class="vote-btn" data-topic-id="${escAttr(t.id)}" data-side="B" style="flex:1;padding:6px;border-radius:8px;border:1.5px solid rgba(52,152,219,0.5);background:rgba(52,152,219,0.08);color:#3498db;font-size:12px;font-weight:700;cursor:pointer;">🔵 피고</button>
  </div>`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function escAttr(s) { return escHtml(s); }
