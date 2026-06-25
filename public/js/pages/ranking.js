/* ranking.js — 토론실 목록·상세·사용자 등록·A/B 투표 */
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
    .debate-choice-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.debate-choice-head h2{margin:0}.debate-choice-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(100,116,139,.10);padding:7px 11px;color:var(--color-text-secondary);font-size:11px;font-weight:900}.debate-choice-status strong{display:grid;place-items:center;min-width:24px;height:24px;border-radius:8px;background:#fff;color:#c84431;font-size:14px;box-shadow:0 3px 10px rgba(15,23,42,.08)}
    .debate-vote{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.debate-vote button{position:relative;min-height:168px;border:2px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:16px;text-align:left;font-family:inherit;color:inherit;cursor:pointer;transition:.18s;overflow:hidden}.debate-vote button:hover{transform:translateY(-2px)}.debate-vote button.active{outline:4px solid rgba(224,93,68,.14);border-color:#e05d44;background:linear-gradient(145deg,rgba(224,93,68,.08),rgba(255,255,255,.98))}.debate-vote__letter{display:grid;place-items:center;width:42px;height:42px;margin-bottom:12px;border-radius:14px;background:#26364c;color:#fff;font-size:20px;font-weight:1000}.debate-vote button[data-vote="disagree"] .debate-vote__letter{background:#b84a3b}.debate-vote__selected{position:absolute;right:12px;top:12px;border-radius:999px;background:#e05d44;color:#fff;padding:5px 8px;font-size:10px;font-weight:1000}.debate-vote__label{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;color:var(--color-text-primary);font-size:15px;font-weight:1000}.debate-vote__label>span:first-child{min-width:0;overflow-wrap:anywhere}.debate-vote__count{color:#d24732;white-space:nowrap}.debate-vote p{margin-top:10px;font-size:13px}
    .debate-meter{display:grid;gap:8px}.debate-meter__row{display:grid;grid-template-columns:78px 1fr 42px;gap:8px;align-items:center;color:var(--color-text-secondary);font-size:11px;font-weight:900}.debate-meter__bar{height:10px;border-radius:999px;background:rgba(100,116,139,.13);overflow:hidden}.debate-meter__bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#e05d44,#ff9a5c)}
    .debate-form{display:grid;gap:8px}.debate-form textarea{width:100%;min-height:92px;resize:vertical;font-family:inherit}.debate-comment{padding:12px 0;border-top:1px solid rgba(100,116,139,.12)}.debate-comment:first-child{border-top:0}.debate-comment b{font-size:12px;color:var(--color-text-primary)}.debate-comment p{margin:5px 0 0;white-space:pre-wrap;font-size:13px}.debate-tags{display:flex;gap:6px;flex-wrap:wrap}.debate-actions{display:flex;gap:8px;flex-wrap:wrap}
    .debate-compose{display:none}.debate-compose.open{display:block}.debate-write{display:grid;gap:12px}.debate-write-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.debate-write label{display:grid;gap:6px;color:var(--color-text-primary);font-size:12px;font-weight:900}.debate-write input,.debate-write textarea{width:100%;font:inherit}.debate-write textarea{min-height:96px;resize:vertical}.debate-write-side{border:1px solid rgba(100,116,139,.14);border-radius:18px;padding:13px}.debate-write-side strong{display:block;margin-bottom:10px;color:var(--color-text-primary)}.debate-write-help{font-size:11px;color:var(--color-text-muted);line-height:1.6}
    @media(max-width:900px){.debate-body{grid-template-columns:1fr}.debate-side{position:static}}
    @media(max-width:760px){.debate-card{grid-template-columns:44px minmax(0,1fr)}.debate-rank{width:42px;height:42px;border-radius:14px}.debate-stats{grid-column:2;justify-content:flex-start}.debate-write-grid{grid-template-columns:1fr}.debate-vote{gap:8px}.debate-vote button{min-height:154px;padding:13px}.debate-vote__letter{width:36px;height:36px;font-size:18px}.debate-choice-head{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function card(debate, index) {
  const source = debate.sourceType === 'user' ? '사용자 등록' : debate.aiGenerated ? 'AI 토론' : '관리자 등록';
  return `<button class="debate-card" data-id="${escHtml(debate.id)}"><div class="debate-rank">${index + 1}</div><div><div class="debate-title">${escHtml(debate.title)}</div><div class="debate-text">${escHtml(debate.summary)}</div></div><div class="debate-stats"><span>${escHtml(debate.category || '생활토론')}</span><span>${source}</span><span>투표 ${Number(debate.totalVotes || 0)}</span><span>댓글 ${Number(debate.commentCount || 0)}</span></div></button>`;
}

function sideLabel(side) {
  return side === 'agree' ? 'A' : side === 'disagree' ? 'B' : '중립';
}

function commentHtml(comment) {
  return `<div class="debate-comment"><b>${escHtml(comment.nickname || '익명')} · ${sideLabel(comment.side)}</b><p>${escHtml(comment.text || '')}</p></div>`;
}

function splitLines(value, max = 8) {
  return String(value || '').split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, max);
}

function splitTags(value, max = 8) {
  return String(value || '').split(/[,#]+/).map(item => item.trim()).filter(Boolean).slice(0, max);
}

function debateComposerHtml() {
  return `<section class="debate-panel debate-compose" id="debate-compose"><h2>토론 주제 등록</h2><p class="debate-text">회원이 직접 A와 B로 나뉘는 생활 토론을 등록할 수 있습니다. 특정인을 공격하거나 개인정보가 포함된 내용은 등록하지 마세요.</p><div class="debate-write"><label>토론 제목<input class="form-input" id="debate-write-title" maxlength="100" placeholder="A와 B 중 의견이 갈리는 질문"></label><label>상황 요약<textarea class="form-input" id="debate-write-summary" maxlength="260" placeholder="토론 배경을 2문장 이내로 설명해주세요."></textarea></label><label>상황 상세<textarea class="form-input" id="debate-write-context" maxlength="3000" placeholder="고려할 상황을 줄마다 하나씩 적어주세요."></textarea><span class="debate-write-help">줄바꿈 기준으로 상황 항목이 나뉩니다.</span></label><div class="debate-write-grid"><div class="debate-write-side"><strong>A 선택</strong><label>A 이름<input class="form-input" id="debate-write-a-title" maxlength="60" placeholder="예: 약속을 지켜야 한다"></label><label>A 설명<textarea class="form-input" id="debate-write-a-text" maxlength="400" placeholder="A를 선택하는 이유"></textarea></label></div><div class="debate-write-side"><strong>B 선택</strong><label>B 이름<input class="form-input" id="debate-write-b-title" maxlength="60" placeholder="예: 상황에 따라 바꿀 수 있다"></label><label>B 설명<textarea class="form-input" id="debate-write-b-text" maxlength="400" placeholder="B를 선택하는 이유"></textarea></label></div></div><div class="debate-write-grid"><label>카테고리<input class="form-input" id="debate-write-category" maxlength="40" value="생활토론"></label><label>태그<input class="form-input" id="debate-write-tags" maxlength="160" placeholder="친구, 직장, 소비"></label></div><button class="btn btn--primary" id="debate-write-submit">토론 등록하기</button></div></section>`;
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
  list.innerHTML = items.length ? items.map(card).join('') : '<div class="empty-state"><div class="empty-state__title">등록된 토론이 없습니다.</div><div class="empty-state__desc">첫 토론을 직접 등록해보세요.</div></div>';
  list.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => navigate(`/debate/${button.dataset.id}`)));
}

function bindDebateComposer(element) {
  const panel = element.querySelector('#debate-compose');
  element.querySelector('#debate-write-open')?.addEventListener('click', () => {
    if (!auth.currentUser) { navigate('/login?return=/debates'); return; }
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open')) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  element.querySelector('#debate-write-submit')?.addEventListener('click', async event => {
    if (!auth.currentUser) { navigate('/login?return=/debates'); return; }
    const payload = {
      title: element.querySelector('#debate-write-title')?.value || '',
      summary: element.querySelector('#debate-write-summary')?.value || '',
      context: splitLines(element.querySelector('#debate-write-context')?.value, 8),
      agreeTitle: element.querySelector('#debate-write-a-title')?.value || '',
      agreeText: element.querySelector('#debate-write-a-text')?.value || '',
      disagreeTitle: element.querySelector('#debate-write-b-title')?.value || '',
      disagreeText: element.querySelector('#debate-write-b-text')?.value || '',
      category: element.querySelector('#debate-write-category')?.value || '생활토론',
      tags: splitTags(element.querySelector('#debate-write-tags')?.value, 8),
    };
    if (payload.title.trim().length < 3 || payload.summary.trim().length < 10 || !payload.context.length || !payload.agreeTitle.trim() || !payload.disagreeTitle.trim() || payload.agreeText.trim().length < 3 || payload.disagreeText.trim().length < 3) {
      toast.info('제목, 상황, A·B 선택 내용을 모두 입력해주세요.');
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = '등록 중…';
    const result = await call('createUserDebate', payload);
    if (!result.ok || !result.id) {
      button.disabled = false;
      button.textContent = '토론 등록하기';
      toast.error(result.error?.message || '토론 등록에 실패했습니다.');
      return;
    }
    toast.success('토론을 등록했습니다.');
    navigate(`/debate/${result.id}`);
  });
}

export async function renderRanking() {
  setMeta('토론실', 'AI·관리자·회원이 함께 만드는 A/B 생활 토론실');
  ensureStyle();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="debate-page page-enter"><section class="debate-hero"><div class="debate-eyebrow">SOSOKING DEBATE ROOM</div><h1>소소토론실</h1><p>AI와 관리자뿐 아니라 회원도 직접 토론을 등록할 수 있습니다. A와 B 중 내 선택을 고르고 댓글로 이유를 나눠보세요.</p><div class="debate-actions" style="margin-top:14px"><button class="btn btn--primary" id="debate-write-open">+ 토론 등록</button><button class="btn btn--ghost" data-go="/today">오늘의 콘텐츠</button><button class="btn btn--ghost" data-go="/materials">자료실</button></div></section>${debateComposerHtml()}<div class="debate-toolbar"><div><b style="color:var(--color-text-primary)">토론 주제</b></div><div class="debate-sort"><button class="active" data-order="latest">최신순</button><button data-order="comments">댓글순</button><button data-order="votes">투표순</button></div></div><div id="debate-list" class="debate-list"></div></div>`;
  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  element.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', async () => {
    element.querySelectorAll('[data-order]').forEach(item => item.classList.toggle('active', item === button));
    await loadDebateList(element, button.dataset.order);
  }));
  bindDebateComposer(element);
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
  const choice = result.myVote === 'agree' ? 'A' : result.myVote === 'disagree' ? 'B' : '미선택';
  const typeLabel = debate.sourceType === 'user' ? 'USER DEBATE' : debate.aiGenerated ? 'AI DAILY DEBATE' : 'ADMIN DEBATE';

  element.innerHTML = `<div class="debate-page page-enter"><section class="debate-hero"><button class="btn btn--ghost btn--sm" id="debate-back">← 토론실</button><div class="debate-eyebrow" style="margin-top:18px">${typeLabel}</div><h1>${escHtml(debate.title)}</h1><p>${escHtml(debate.summary)}</p><div class="debate-tags" style="margin-top:13px"><span class="debate-chip">${escHtml(debate.category)}</span>${tags.map(tag => `<span class="debate-chip">#${escHtml(tag)}</span>`).join('')}</div></section><div class="debate-body"><div class="debate-main"><section class="debate-panel"><h2>상황 보기</h2><div class="debate-context">${context.map(item => `<div class="debate-context__item">${escHtml(item)}</div>`).join('')}</div></section><section class="debate-panel"><div class="debate-choice-head"><h2>내 선택은 여기에</h2><div class="debate-choice-status">현재 선택 <strong>${choice}</strong></div></div><div class="debate-vote"><button data-vote="agree" class="${result.myVote === 'agree' ? 'active' : ''}"><span class="debate-vote__letter">A</span>${result.myVote === 'agree' ? '<span class="debate-vote__selected">내 선택</span>' : ''}<div class="debate-vote__label"><span>${escHtml(debate.agreeTitle)}</span><span class="debate-vote__count">${Number(debate.agreeCount || 0)}표</span></div><p>${escHtml(debate.agreeText)}</p></button><button data-vote="disagree" class="${result.myVote === 'disagree' ? 'active' : ''}"><span class="debate-vote__letter">B</span>${result.myVote === 'disagree' ? '<span class="debate-vote__selected">내 선택</span>' : ''}<div class="debate-vote__label"><span>${escHtml(debate.disagreeTitle)}</span><span class="debate-vote__count">${Number(debate.disagreeCount || 0)}표</span></div><p>${escHtml(debate.disagreeText)}</p></button></div></section><section class="debate-panel"><h2>댓글 토론</h2><div class="debate-form"><select id="debate-comment-side"><option value="neutral">중립 의견</option><option value="agree">A 의견</option><option value="disagree">B 의견</option></select><textarea id="debate-comment-text" maxlength="700" placeholder="왜 A 또는 B라고 생각하는지 의견을 적어주세요."></textarea><button class="btn btn--primary" id="debate-comment-submit">의견 등록</button></div><div id="debate-comments" style="margin-top:14px"></div></section></div><aside class="debate-side"><section class="debate-panel"><h2>현재 투표</h2><div class="debate-meter"><div class="debate-meter__row"><span>A ${escHtml(debate.agreeTitle)}</span><div class="debate-meter__bar"><span style="width:${agreePercent}%"></span></div><b>${agreePercent}%</b></div><div class="debate-meter__row"><span>B ${escHtml(debate.disagreeTitle)}</span><div class="debate-meter__bar"><span style="width:${disagreePercent}%"></span></div><b>${disagreePercent}%</b></div></div><p style="margin-top:12px">총 ${total}표 · 댓글 ${Number(debate.commentCount || 0)}개</p></section><section class="debate-panel"><h2>생각해볼 질문</h2>${questions.length ? questions.map(question => `<p>• ${escHtml(question)}</p>`).join('') : '<p>자유롭게 의견을 나눠보세요.</p>'}</section><section class="debate-panel"><h2>자료가 필요하다면</h2><p>생활정보와 정리 자료는 자료실에서 확인하고 댓글도 남길 수 있습니다.</p><button class="btn btn--ghost" id="go-materials">자료실 열기</button></section></aside></div></div>`;

  element.querySelector('#debate-back')?.addEventListener('click', () => navigate('/debates'));
  element.querySelector('#go-materials')?.addEventListener('click', () => navigate('/materials'));
  element.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate(`/login?return=/debate/${id}`); return; }
    const output = await call('voteDebate', { debateId: id, side: button.dataset.vote });
    if (!output.ok) { toast.error(output.error?.message || '투표에 실패했습니다.'); return; }
    toast.success(`${button.dataset.vote === 'agree' ? 'A' : 'B'}를 선택했습니다.`);
    renderDebateDetail(id);
  }));
  element.querySelector('#debate-comment-submit')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate(`/login?return=/debate/${id}`); return; }
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
