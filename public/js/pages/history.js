/* history.js — 역사정치 자료실 + 선택형 시뮬레이션 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { getQueryParams, navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function fmtDay(day) { return `DAY ${String(day || 1).padStart(2, '0')}`; }
function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ error })); }

function ensureHistoryStyle() {
  if (document.getElementById('history-page-style')) return;
  const style = document.createElement('style');
  style.id = 'history-page-style';
  style.textContent = `
    .history-page{padding-bottom:28px}.history-hero{border-radius:28px;padding:24px 20px;margin-bottom:14px;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(67,56,202,.82));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.20)}.history-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.09em;color:rgba(255,255,255,.62)}.history-hero__title{font-size:28px;font-weight:1000;margin:6px 0 4px;color:#fff;line-height:1.15}.history-hero__sub{font-size:14px;line-height:1.6;color:rgba(255,255,255,.76);max-width:720px}.history-hero__chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.history-chip{border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);padding:6px 9px;font-size:12px;font-weight:900;color:#fff}.history-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.history-card{border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:15px;text-align:left;box-shadow:0 10px 24px rgba(15,23,42,.055);cursor:pointer;font-family:inherit;color:inherit}.history-card:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(15,23,42,.08)}.history-card__meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}.history-card__tag{border-radius:999px;background:rgba(99,102,241,.09);color:#4f46e5;font-size:11px;font-weight:1000;padding:5px 8px}.history-card__title{font-size:17px;font-weight:1000;color:var(--color-text-primary);margin-bottom:5px;line-height:1.28}.history-card__summary{font-size:13px;line-height:1.55;color:var(--color-text-secondary);margin-bottom:10px}.history-card__question{font-size:12px;line-height:1.45;color:var(--color-text-muted);border-top:1px dashed rgba(100,116,139,.22);padding-top:9px}.history-detail{border-radius:24px;background:var(--color-surface,#fff);border:1px solid rgba(100,116,139,.16);box-shadow:0 14px 34px rgba(15,23,42,.07);overflow:hidden;margin-bottom:14px}.history-detail__head{padding:18px;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,250,252,.94));border-bottom:1px solid rgba(100,116,139,.12)}.history-detail__back{border:0;border-radius:999px;background:rgba(99,102,241,.09);color:#4f46e5;font-weight:1000;padding:8px 10px;font-family:inherit;cursor:pointer;margin-bottom:12px}.history-detail__title{font-size:24px;font-weight:1000;color:var(--color-text-primary);line-height:1.2}.history-detail__summary{font-size:14px;line-height:1.65;color:var(--color-text-secondary);margin-top:8px}.history-detail__body{padding:16px;display:grid;gap:12px}.history-box{border-radius:18px;border:1px solid rgba(100,116,139,.14);background:rgba(248,250,252,.78);padding:14px}.history-box__title{font-size:14px;font-weight:1000;color:var(--color-text-primary);margin-bottom:7px}.history-box__text{font-size:13px;line-height:1.65;color:var(--color-text-secondary)}.history-box__text p{margin:0 0 8px}.history-box__text p:last-child{margin-bottom:0}.history-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}.history-list li{font-size:13px;line-height:1.6;color:var(--color-text-secondary);padding-left:16px;position:relative}.history-list li:before{content:'•';position:absolute;left:0;color:#6366f1;font-weight:1000}.history-timeline{display:grid;gap:8px}.history-timeline__item{display:grid;grid-template-columns:72px 1fr;gap:10px;align-items:start}.history-timeline__label{border-radius:999px;background:rgba(99,102,241,.09);color:#4f46e5;font-size:11px;font-weight:1000;padding:5px 7px;text-align:center}.history-timeline__text{font-size:13px;line-height:1.6;color:var(--color-text-secondary)}.history-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.history-choice{border:1px solid rgba(100,116,139,.16);border-radius:18px;background:#fff;padding:13px;text-align:left;font-family:inherit;cursor:pointer;color:inherit}.history-choice.active{border-color:var(--party-color,#6366f1);box-shadow:0 0 0 3px color-mix(in srgb,var(--party-color,#6366f1) 15%,transparent)}.history-choice__title{font-size:14px;font-weight:1000;color:var(--color-text-primary);margin-bottom:6px}.history-choice__stance{font-size:12px;line-height:1.55;color:var(--color-text-secondary)}.history-result{display:none;border-radius:18px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(51,65,85,.92));color:#fff;padding:14px;margin-top:10px}.history-result.show{display:block}.history-result__title{font-size:15px;font-weight:1000;color:#fff;margin-bottom:6px}.history-result__text{font-size:13px;line-height:1.6;color:rgba(255,255,255,.76)}.history-score{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.history-score span{border-radius:999px;background:rgba(99,102,241,.09);border:1px solid rgba(99,102,241,.12);padding:5px 8px;font-size:11px;font-weight:900;color:#4f46e5}.history-result .history-score span{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.12);color:#fff}.history-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.history-comment-form{display:grid;gap:8px}.history-comment-form textarea{width:100%;min-height:76px;resize:vertical;font-family:inherit;font-size:13px;line-height:1.55}.history-comments{display:grid;gap:9px;margin-top:12px}.history-comment{border:1px solid rgba(100,116,139,.13);border-radius:15px;background:rgba(255,255,255,.72);padding:10px}.history-comment__meta{font-size:12px;font-weight:1000;color:var(--color-text-primary);margin-bottom:4px}.history-comment__text{font-size:13px;line-height:1.55;color:var(--color-text-secondary);white-space:pre-wrap}.history-comment__empty{font-size:13px;color:var(--color-text-muted);padding:8px 0}@media(max-width:760px){.history-grid,.history-choice-grid{grid-template-columns:1fr}.history-timeline__item{grid-template-columns:1fr}.history-timeline__label{text-align:left;width:max-content}.history-hero__title{font-size:23px}}
  `;
  document.head.appendChild(style);
}

function renderHero(count) {
  return `<div class="history-hero"><div class="history-hero__eyebrow">HISTORY POLITICS SIMULATION</div><div class="history-hero__title">📚 역사정치 자료실</div><div class="history-hero__sub">실제 한국 현대사의 사건·제도·쟁점을 모티브로 삼고, 인물과 정당은 모두 가상화한 선택형 정치 시뮬레이션입니다.</div><div class="history-hero__chips"><span class="history-chip">1987년부터 순차 생성</span><span class="history-chip">하루 3건 자동 자료</span><span class="history-chip">댓글 토론</span><span class="history-chip">${count || 0}개 사건</span></div></div>`;
}

function renderArchive(events) {
  return `<div class="history-grid">${events.map(e => `<button type="button" class="history-card" data-day="${e.day}"><div class="history-card__meta"><span class="history-card__tag">${fmtDay(e.day)}</span><span class="history-card__tag">${escHtml(e.era)}</span><span class="history-card__tag">${escHtml(e.motifYear)}년 모티브</span></div><div class="history-card__title">${escHtml(e.title)}</div><div class="history-card__summary">${escHtml(e.summary)}</div><div class="history-card__question">질문 · ${escHtml(e.question)}</div></button>`).join('')}</div>`;
}
function renderScores(scores) { return (scores || []).map(s => `<span>${escHtml(s.label)} ${s.value > 0 ? '+' : ''}${s.value}</span>`).join(''); }
function renderParagraphs(items) { return (items || []).map(text => `<p>${escHtml(text)}</p>`).join(''); }
function renderList(items) { return `<ul class="history-list">${(items || []).map(text => `<li>${escHtml(text)}</li>`).join('')}</ul>`; }
function renderTimeline(items) { return `<div class="history-timeline">${(items || []).map(item => `<div class="history-timeline__item"><div class="history-timeline__label">${escHtml(item.label)}</div><div class="history-timeline__text">${escHtml(item.text)}</div></div>`).join('')}</div>`; }
function renderTerms(items) { return `<ul class="history-list">${(items || []).map(item => `<li><b>${escHtml(item.term)}</b> · ${escHtml(item.desc)}</li>`).join('')}</ul>`; }

function renderCommentsBox(day) {
  return `<div class="history-box" id="history-comments-box"><div class="history-box__title">💬 댓글 토론</div><div class="history-box__text">이 사건에 대한 생각을 남겨보세요.</div><div class="history-comment-form"><textarea id="history-comment-input" maxlength="500" placeholder="댓글을 입력하세요. 500자까지 가능합니다."></textarea><button class="btn btn--primary btn--sm" id="history-comment-submit">댓글 등록</button></div><div class="history-comments" id="history-comments-list"><div class="history-comment__empty">댓글을 불러오는 중입니다.</div></div></div>`;
}

function renderDetail(event) {
  const detail = event.detail || {};
  return `<div class="history-detail"><div class="history-detail__head"><button type="button" class="history-detail__back" id="history-back">← 자료실 전체</button><div class="history-card__meta"><span class="history-card__tag">${fmtDay(event.day)}</span><span class="history-card__tag">${escHtml(event.era)}</span><span class="history-card__tag">${escHtml(event.motifYear)}년 모티브</span></div><div class="history-detail__title">${escHtml(event.title)}</div><div class="history-detail__summary">${escHtml(event.summary)}</div></div><div class="history-detail__body">
    <div class="history-box"><div class="history-box__title">📌 실제 역사 모티브</div><div class="history-box__text"><b>${escHtml(event.motif)}</b><br>${escHtml(event.actualResult)}</div></div>
    <div class="history-box"><div class="history-box__title">🧭 시대 배경</div><div class="history-box__text">${renderParagraphs(detail.background)}</div></div>
    <div class="history-box"><div class="history-box__title">🕰️ 전개 흐름</div>${renderTimeline(detail.timeline)}</div>
    <div class="history-box"><div class="history-box__title">⚖️ 핵심 쟁점</div>${renderList(detail.keyIssues)}</div>
    <div class="history-box"><div class="history-box__title">🎮 게임 질문</div><div class="history-box__text">${escHtml(event.question)}</div></div>
    <div class="history-box"><div class="history-box__title">🏛️ 가상 정당 선택</div><div class="history-choice-grid">${(event.choices || []).map(choice => { const meta = event.partyMeta?.[choice.partyId] || {}; return `<button type="button" class="history-choice" data-choice="${escHtml(choice.id)}" style="--party-color:${escHtml(meta.color || '#6366f1')}"><div class="history-choice__title">${escHtml(choice.emoji)} ${escHtml(choice.title)}</div><div class="history-choice__stance">${escHtml(choice.stance)}</div></button>`; }).join('')}</div><div class="history-result" id="history-result"></div></div>
    <div class="history-box"><div class="history-box__title">🧠 왜 중요한가</div><div class="history-box__text">${escHtml(detail.whyImportant || '')}</div></div>
    <div class="history-box"><div class="history-box__title">📖 용어/지표 이해</div>${renderTerms(detail.terms)}</div>
    <div class="history-box"><div class="history-box__title">💬 토론 질문</div>${renderList(detail.discussionQuestions)}</div>
    <div class="history-box"><div class="history-box__title">🔎 실제/가상 구분</div><div class="history-box__text">${escHtml(event.notice)}</div></div>
    <div class="history-box"><div class="history-box__title">🔍 더 찾아볼 검색어</div><div class="history-score">${(event.sourceGuide || []).map(s => `<span>${escHtml(s)}</span>`).join('')}</div></div>
    ${renderCommentsBox(event.day)}
    <div class="history-actions"><button class="btn btn--primary" id="history-go-battle">오늘 논쟁 참여</button><button class="btn btn--ghost" id="history-go-republic">공화국 현황</button></div>
  </div></div>`;
}

function renderCommentList(comments) {
  if (!comments?.length) return '<div class="history-comment__empty">아직 댓글이 없습니다. 첫 의견을 남겨보세요.</div>';
  return comments.map(c => `<div class="history-comment"><div class="history-comment__meta">${escHtml(c.nickname || '시민')}</div><div class="history-comment__text">${escHtml(c.text || '')}</div></div>`).join('');
}

async function loadHistoryComments(day) {
  const list = document.getElementById('history-comments-list');
  if (!list) return;
  const res = await call('getHistoryComments', { day, limit: 30 });
  if (res?.error) { list.innerHTML = '<div class="history-comment__empty">댓글 기능은 배포 후 사용할 수 있습니다.</div>'; return; }
  list.innerHTML = renderCommentList(res.comments || []);
}

function bindHistoryComments(day) {
  const btn = document.getElementById('history-comment-submit');
  const input = document.getElementById('history-comment-input');
  btn?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const text = String(input?.value || '').trim();
    if (text.length < 2) { toast.info('댓글을 2자 이상 입력해주세요.'); return; }
    btn.disabled = true;
    const res = await call('addHistoryComment', { day, text });
    btn.disabled = false;
    if (res?.error) { toast.error(res.error.message || '댓글 등록에 실패했습니다.'); return; }
    if (input) input.value = '';
    toast.success('댓글을 등록했습니다.');
    loadHistoryComments(day);
  });
  loadHistoryComments(day);
}

async function loadArchive(el) {
  const res = await call('getHistoryArchive', { limit: 80 });
  if (res?.error) throw res.error;
  const { events = [], count = 0 } = res;
  el.innerHTML = `<div class="history-page page-enter">${renderHero(count)}<div class="page-section">${renderArchive(events)}</div></div>`;
  el.querySelectorAll('[data-day]').forEach(btn => btn.addEventListener('click', () => navigate(`/history?day=${btn.dataset.day}`)));
}

async function loadDetail(el, day) {
  const res = await call('getHistoryEvent', { day });
  if (res?.error) throw res.error;
  const { event } = res;
  el.innerHTML = `<div class="history-page page-enter">${renderHero(30)}<div class="page-section">${renderDetail(event)}</div></div>`;
  el.querySelector('#history-back')?.addEventListener('click', () => navigate('/history'));
  el.querySelector('#history-go-battle')?.addEventListener('click', () => navigate('/battle'));
  el.querySelector('#history-go-republic')?.addEventListener('click', () => navigate('/republic'));
  el.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => {
    const choice = (event.choices || []).find(c => c.id === btn.dataset.choice);
    if (!choice) return;
    el.querySelectorAll('[data-choice]').forEach(b => b.classList.toggle('active', b === btn));
    const result = el.querySelector('#history-result');
    result.classList.add('show');
    result.innerHTML = `<div class="history-result__title">${escHtml(choice.emoji)} 당신의 선택 · ${escHtml(choice.title)}</div><div class="history-result__text">${escHtml(choice.result)}</div><div class="history-score">${renderScores(choice.scores)}</div>`;
  }));
  bindHistoryComments(day);
}

export async function renderHistory() {
  setMeta('역사정치 자료실', '실제 역사 사건을 가상 인물과 정당으로 풀어보는 역사정치 시뮬레이션');
  ensureHistoryStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="history-page page-enter"><div class="skeleton" style="height:150px;border-radius:24px;margin-bottom:12px"></div><div class="skeleton" style="height:420px;border-radius:18px"></div></div>`;
  try {
    const params = getQueryParams();
    const day = Number(params.day || 0);
    if (day) await loadDetail(el, day);
    else await loadArchive(el);
  } catch (error) {
    console.error('[history] load failed', error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📚</div><div class="empty-state__title">역사자료를 불러오지 못했어요</div><button class="btn btn--primary" style="margin-top:16px" id="history-retry">다시 시도</button></div>`;
    el.querySelector('#history-retry')?.addEventListener('click', renderHistory);
  }
}
