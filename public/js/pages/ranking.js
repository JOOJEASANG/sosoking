/* ranking.js — 독립 토론실/토론 상세 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload)
    .then(response => response.data || {})
    .catch(error => ({ ok: false, error }));
}

function ensureStyle() {
  if (document.getElementById('debate-page-style')) return;
  const style = document.createElement('style');
  style.id = 'debate-page-style';
  style.textContent = `
    .debate-page{display:grid;gap:15px;padding-bottom:30px}.debate-hero,.debate-panel{border:1px solid rgba(100,116,139,.16);border-radius:25px;background:var(--color-surface,#fff);padding:19px;box-shadow:0 12px 30px rgba(15,23,42,.055)}.debate-hero{padding:26px;background:radial-gradient(circle at 87% 16%,rgba(255,128,80,.30),transparent 28%),linear-gradient(135deg,#321d28,#9a3f3f);color:#fff}.debate-hero h1{margin:7px 0 8px;font-size:31px;color:#fff;line-height:1.25}.debate-hero p{max-width:760px;margin:0;color:rgba(255,255,255,.79);line-height:1.7}.debate-eyebrow{font-size:10px;font-weight:1000;letter-spacing:.12em;color:rgba(255,255,255,.64)}
    .debate-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.debate-sort{display:flex;gap:7px;flex-wrap:wrap}.debate-sort button{border:1px solid rgba(100,116,139,.16);border-radius:999px;background:var(--color-surface,#fff);padding:8px 12px;color:var(--color-text-secondary);font-family:inherit;font-size:11px;font-weight:900;cursor:pointer}.debate-sort button.active{border-color:#e05d44;background:rgba(224,93,68,.10);color:#c83e2b}
    .debate-list{display:grid;gap:11px}.debate-card{position:relative;display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:13px;align-items:center;border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:15px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 10px 26px rgba(15,23,42,.055);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}.debate-card:hover{transform:translateY(-3px);border-color:rgba(224,93,68,.32);box-shadow:0 17px 34px rgba(15,23,42,.08)}.debate-rank{width:54px;height:54px;border-radius:18px;background:linear-gradient(135deg,rgba(224,93,68,.14),rgba(255,153,92,.12));color:#d24732;display:flex;align-items:center;justify-content:center;font-weight:1000}.debate-title{font-size:17px;font-weight:1000;color:var(--color-text-primary);margin-bottom:5px;line-height:1.4}.debate-text{font-size:13px;line-height:1.6;color:var(--color-text-secondary)}.debate-stats{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.debate-stats span,.debate-chip{border-radius:999px;background:rgba(224,93,68,.10);color:#c84431;padding:5px 8px;font-size:10px;font-weight:1000}
    .debate-body{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}.debate-main{display:grid;gap:14px}.debate-side{position:sticky;top:18px;display:grid;gap:14px}.debate-panel h2{margin:0 0 10px;color:var(--color-text-primary);font-size:17px}.debate-panel p{margin:0 0 10px;color:var(--color-text-secondary);font-size:14px;line-height:1.75}.debate-context{display:grid;gap:9px}.debate-context__item{padding:12px 14px;border-radius:16px;background:rgba(248,250,252,.82);border:1px solid rgba(100,116,139,.10);color:var(--color-text-secondary);font-size:13px;line-height:1.7}
    .debate-vote{display:grid;grid-template-columns:1fr 1fr;gap:10px}.debate-vote button{min-height:150px;border:1px solid rgba(100,116,139,.16);border-radius:20px;background:var(--color-surface,#fff);padding:16px;text-align:left;font-family:inherit;color:inherit;cursor:pointer;transition:.18s}.debate-vote button:hover{transform:translateY(-2px)}.debate-vote button.active{outline:3px solid rgba(224,93,68,.18);border-color:#e05d44}.debate-vote__label{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--color-text-primary);font-size:15px;font-weight:1000}.debate-vote__count{color:#d24732}.debate-vote p{margin-top:10px;font-size:13px}.debate-meter{display:grid;gap:8px}.debate-meter__row{display:grid;grid-template-columns:78px 1fr 42px;gap:8px;align-items:center;color:var(--color-text-secondary);font-size:11px;font-weight:900}.debate-meter__bar{height:10px;border-radius:999px;background:rgba(100,116,139,.13);overflow:hidden}.debate-meter__bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#e05d44,#ff9a5c)}
    .debate-form{display:grid;gap:8px}.debate-form textarea{width:100%;min-height:92px;resize:vertical;font-family:inherit}.debate-comment{padding:12px 0;border-top:1px solid rgba(100,116,139,.12)}.debate-comment:first-child{border-top:0}.debate-comment b{font-size:12px;color:var(--color-text-primary)}.debate-comment p{margin:5px 0 0;white-space:pre-wrap;font-size:13px}.debate-tags{display:flex;gap:6px;flex-wrap:wrap}.debate-actions{display:flex;gap:8px;flex-wrap:wrap}
    @media(max-width:900px){.debate-body{grid-template-columns:1fr}.debate-side{position:static}}
    @media(max-width:760px){.debate-card{grid-template-columns:44px minmax(0,1fr)}.debate-rank{width:42px;height:42px;border-radius:14px}.debate-stats{grid-column:2;justify-content:flex-start}.debate-vote{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function card(debate, index) {
  return `<button class="debate-card" data-id="${escHtml(debate.id)}"><div class="debate-rank">${index + 1}</div><div><div class="debate-title">${escHtml(debate.title)}</div><div class="debate-text">${escHtml(debate.summary)}</div></div><div class="debate-stats"><span>${escHtml(debate.category || '생활토론')}</span><span>투표 ${Number(debate.totalVotes || 0)}</span><span>댓글 ${Number(debate.commentCount || 0)}</span></div></button>`;
}

function sideLabel(side) {
  return side === 'agree' ? '찬성' : side === 'disagree' ? '반대' : '중립';
}

function commentHtml(comment) {
  return `<div class="debate-comment"><b>${escHtml(comment.nickname || '익명')} · ${sideLabel(comment.side)}</b><p>${escHtml(comment.text || '')}</p></div>`;
}

async function reloadComments(debateId) {
  const container = document.getElementById('debate-comments');
  if (!container) return;
  const result = await call('getDebateComments', { debateId, limit: 60 });
  const comments = Array.isArray(result.comments) ? result.comments : [];
  container.innerHTML = comments.length ? comments.map(commentHtml).join('') : '<div class="debate-text">아직 의견이 없습니다. 첫 의견을 남겨보세요.</div>';
}

async function loadDebateList(element, order = 'latest') {
  element.querySelector('#debate-list').innerHTML = '<div class="skeleton" style="height:360px;border-radius:22px"></div>';
  const result = await call('getDebates', { limit: 40, order });
  const items = Array.isArray(result.debates) ? result.debates : [];
  const list = element.querySelector('#debate-list');
  if (!list) return;
  list.innerHTML = items.length ? items.map(card).join('') : '<div class="empty-state"><div class="empty-state__title">등록된 토론이 없습니다.</div><div class="empty-state__desc">AI 일일 생성 또는 관리자 직접 등록 후 표시됩니다.</div></div>';
  list.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => navigate(`/debate/${button.dataset.id}`)));
}

export async function renderRanking() {
  setMeta('토론실', 'AI가 하루 한 번 만들고 관리자가 직접 등록하는 독립 생활 토론실');
  ensureStyle();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="debate-page page-enter"><section class="debate-hero"><div class="debate-eyebrow">SOSOKING DEBATE ROOM</div><h1>소소토론실</h1><p>자료실과 분리된 독립 공간입니다. AI가 하루 한 번 만든 토론과 관리자가 직접 등록한 주제에 찬반투표하고 의견을 나눠보세요.</p><div class="debate-actions" style="margin-top:14px"><button class="btn btn--ghost" data-go="/today">오늘의 콘텐츠</button><button class="btn btn--ghost" data-go="/materials">자료실</button></div></section><div class="debate-toolbar"><div><b style="color:var(--color-text-primary)">토론 주제</b></div><div class="debate-sort"><button class="active" data-order="latest">최신순</button><button data-order="comments">댓글순</button><button data-order="votes">투표순</button></div></div><div id="debate-list" class="debate-list"></div></div>`;
  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  element.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', async () => {
    element.querySelectorAll('[data-order]').forEach(item => item.classList.toggle('active', item === button));
    await loadDebateList(element, button.dataset.order);
  }));
  await loadDebateList(element, 'latest');
}

export async function renderDebateDetail(id) {
  ensureStyle();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="debate-page"><div class="skeleton" style="height:620px;border-radius:25px"></div></div>`;

  const result = await call('getDebate', { debateId: id });
  if (!result.ok || !result.debate) {
    element.innerHTML = '<div class="empty-state"><div class="empty-state__title">토론을 찾을 수 없습니다.</div><button class="btn btn--primary" id="back-debates">토론실로</button></div>';
    element.querySelector('#back-debates')?.addEventListener('click', () => navigate('/debates'));
    return;
  }

  const debate = result.debate;
  setMeta(debate.title, debate.summary);
  const context = Array.isArray(debate.context) ? debate.context : [];
  const questions = Array.isArray(debate.questions) ? debate.questions : [];
  const tags = Array.isArray(debate.tags) ? debate.tags : [];
  const total = Math.max(0, Number(debate.totalVotes || 0));
  const agreePercent = total ? Math.round(Number(debate.agreeCount || 0) / total * 100) : 50;
  const disagreePercent = total ? 100 - agreePercent : 50;

  element.innerHTML = `<div class="debate-page page-enter"><section class="debate-hero"><button class="btn btn--ghost btn--sm" id="debate-back">← 토론실</button><div class="debate-eyebrow" style="margin-top:18px">${debate.aiGenerated ? 'AI DAILY DEBATE' : 'ADMIN DEBATE'}</div><h1>${escHtml(debate.title)}</h1><p>${escHtml(debate.summary)}</p><div class="debate-tags" style="margin-top:13px"><span class="debate-chip">${escHtml(debate.category)}</span>${tags.map(tag => `<span class="debate-chip">#${escHtml(tag)}</span>`).join('')}</div></section><div class="debate-body"><div class="debate-main"><section class="debate-panel"><h2>상황 보기</h2><div class="debate-context">${context.map(item => `<div class="debate-context__item">${escHtml(item)}</div>`).join('')}</div></section><section class="debate-panel"><h2>내 선택은?</h2><div class="debate-vote"><button data-vote="agree" class="${result.myVote === 'agree' ? 'active' : ''}"><div class="debate-vote__label"><span>${escHtml(debate.agreeTitle)}</span><span class="debate-vote__count">${Number(debate.agreeCount || 0)}표</span></div><p>${escHtml(debate.agreeText)}</p></button><button data-vote="disagree" class="${result.myVote === 'disagree' ? 'active' : ''}"><div class="debate-vote__label"><span>${escHtml(debate.disagreeTitle)}</span><span class="debate-vote__count">${Number(debate.disagreeCount || 0)}표</span></div><p>${escHtml(debate.disagreeText)}</p></button></div></section><section class="debate-panel"><h2>댓글 토론</h2><div class="debate-form"><select id="debate-comment-side"><option value="neutral">중립 의견</option><option value="agree">찬성 의견</option><option value="disagree">반대 의견</option></select><textarea id="debate-comment-text" maxlength="700" placeholder="왜 그렇게 생각하는지 의견을 적어주세요."></textarea><button class="btn btn--primary" id="debate-comment-submit">의견 등록</button></div><div id="debate-comments" style="margin-top:14px"></div></section></div><aside class="debate-side"><section class="debate-panel"><h2>현재 투표</h2><div class="debate-meter"><div class="debate-meter__row"><span>${escHtml(debate.agreeTitle)}</span><div class="debate-meter__bar"><span style="width:${agreePercent}%"></span></div><b>${agreePercent}%</b></div><div class="debate-meter__row"><span>${escHtml(debate.disagreeTitle)}</span><div class="debate-meter__bar"><span style="width:${disagreePercent}%"></span></div><b>${disagreePercent}%</b></div></div><p style="margin-top:12px">총 ${total}표 · 댓글 ${Number(debate.commentCount || 0)}개</p></section><section class="debate-panel"><h2>생각해볼 질문</h2>${questions.length ? questions.map(question => `<p>• ${escHtml(question)}</p>`).join('') : '<p>자유롭게 의견을 나눠보세요.</p>'}</section><section class="debate-panel"><h2>자료가 필요하다면</h2><p>생활정보와 정리 자료는 별도 자료실에서 확인할 수 있습니다.</p><button class="btn btn--ghost" id="go-materials">자료실 열기</button></section></aside></div></div>`;

  element.querySelector('#debate-back')?.addEventListener('click', () => navigate('/debates'));
  element.querySelector('#go-materials')?.addEventListener('click', () => navigate('/materials'));
  element.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const output = await call('voteDebate', { debateId: id, side: button.dataset.vote });
    if (!output.ok) { toast.error(output.error?.message || '투표에 실패했습니다.'); return; }
    toast.success('투표를 반영했습니다.');
    renderDebateDetail(id);
  }));
  element.querySelector('#debate-comment-submit')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const textElement = element.querySelector('#debate-comment-text');
    const sideElement = element.querySelector('#debate-comment-side');
    const text = String(textElement?.value || '').trim();
    if (text.length < 2) { toast.info('의견을 2자 이상 입력해주세요.'); return; }
    const output = await call('addDebateComment', { debateId: id, text, side: sideElement?.value || 'neutral' });
    if (!output.ok) { toast.error(output.error?.message || '의견 등록에 실패했습니다.'); return; }
    textElement.value = '';
    toast.success('의견을 등록했습니다.');
    await reloadComments(id);
  });
  await reloadComments(id);
}
