/* history.js — 자료실 목록·상세·사용자 등록·댓글 */
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

function styleOnce() {
  if (document.getElementById('material-page-style')) return;
  const style = document.createElement('style');
  style.id = 'material-page-style';
  style.textContent = `
    .mat-page{display:grid;gap:15px;padding-bottom:30px}.mat-hero,.mat-panel{border:1px solid rgba(100,116,139,.16);border-radius:25px;background:var(--color-surface,#fff);padding:19px;box-shadow:0 12px 30px rgba(15,23,42,.055)}
    .mat-hero{padding:26px;background:radial-gradient(circle at 88% 16%,rgba(105,196,171,.24),transparent 28%),linear-gradient(135deg,#10243b,#276653);color:#fff}.mat-hero h1{margin:7px 0 8px;color:#fff;font-size:31px;line-height:1.25}.mat-hero p{max-width:760px;margin:0;color:rgba(255,255,255,.78);line-height:1.7}.mat-hero__eyebrow{font-size:10px;font-weight:1000;letter-spacing:.12em;color:rgba(255,255,255,.64)}
    .mat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mat-card{position:relative;display:block;width:100%;min-height:190px;border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:18px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 10px 26px rgba(15,23,42,.055);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}.mat-card:hover{transform:translateY(-3px);border-color:rgba(47,125,110,.34);box-shadow:0 17px 34px rgba(15,23,42,.08)}.mat-card__arrow{position:absolute;right:18px;top:17px;color:#2f7d6e;font-weight:1000}.mat-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:13px}.mat-meta span,.mat-chip{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:10px;font-weight:1000}.mat-title{padding-right:28px;font-size:19px;font-weight:1000;line-height:1.4;color:var(--color-text-primary);margin-bottom:8px}.mat-text{font-size:13px;line-height:1.7;color:var(--color-text-secondary)}
    .mat-body{display:grid;grid-template-columns:minmax(0,1fr) 310px;align-items:start;gap:14px}.mat-main{display:grid;gap:14px}.mat-side{position:sticky;top:18px;display:grid;gap:14px}.mat-panel h2{font-size:17px;margin:0 0 10px;color:var(--color-text-primary)}.mat-panel p{font-size:14px;line-height:1.8;color:var(--color-text-secondary);margin:0 0 10px}.mat-point{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid rgba(100,116,139,.10)}.mat-point:last-child{border-bottom:0}.mat-point__num{display:grid;place-items:center;width:28px;height:28px;border-radius:10px;background:rgba(47,125,110,.10);color:#2f7d6e;font-size:11px;font-weight:1000}.mat-tags{display:flex;gap:6px;flex-wrap:wrap}.mat-actions{display:flex;gap:8px;flex-wrap:wrap}.mat-source{font-size:12px;line-height:1.65;color:var(--color-text-muted)}.mat-disclaimer{border-color:rgba(245,158,11,.22);background:rgba(245,158,11,.07)}
    .mat-compose{display:none}.mat-compose.open{display:block}.mat-form{display:grid;gap:12px}.mat-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mat-form label{display:grid;gap:6px;color:var(--color-text-primary);font-size:12px;font-weight:900}.mat-form input,.mat-form textarea{width:100%;font:inherit}.mat-form textarea{min-height:100px;resize:vertical}.mat-form__help{font-size:11px;color:var(--color-text-muted);line-height:1.6}.mat-comment-form{display:grid;gap:8px}.mat-comment-form textarea{width:100%;min-height:92px;resize:vertical;font:inherit}.mat-comments{margin-top:15px}.mat-comment{padding:13px 0;border-top:1px solid rgba(100,116,139,.12)}.mat-comment:first-child{border-top:0}.mat-comment b{font-size:12px;color:var(--color-text-primary)}.mat-comment time{margin-left:6px;font-size:10px;color:var(--color-text-muted)}.mat-comment p{margin:6px 0 0;white-space:pre-wrap;font-size:13px}
    @media(max-width:900px){.mat-body{grid-template-columns:1fr}.mat-side{position:static}.mat-grid{grid-template-columns:1fr}}
    @media(max-width:640px){.mat-form-grid{grid-template-columns:1fr}.mat-hero{padding:22px}.mat-hero h1{font-size:27px}}
  `;
  document.head.appendChild(style);
}

function originLabel(material) {
  if (material.sourceType === 'user') return '사용자 등록';
  if (material.aiGenerated) return 'AI 일일자료';
  if (material.imported) return '관리자 등록';
  return '자료';
}

function listCard(material) {
  return `<button class="mat-card" data-id="${escHtml(material.id)}"><span class="mat-card__arrow">↗</span><div class="mat-meta"><span>${escHtml(material.category || '생활정보')}</span><span>${originLabel(material)}</span><span>조회 ${Number(material.viewCount || 0)}</span></div><div class="mat-title">${escHtml(material.title)}</div><div class="mat-text">${escHtml(material.summary)}</div></button>`;
}

function splitLines(value, max = 10) {
  return String(value || '').split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, max);
}

function splitTags(value, max = 8) {
  return String(value || '').split(/[,#]+/).map(item => item.trim()).filter(Boolean).slice(0, max);
}

function composerHtml() {
  return `<section class="mat-panel mat-compose" id="mat-compose"><h2>자료 등록</h2><p class="mat-source">회원이 직접 공유할 생활정보나 경험을 등록할 수 있습니다. 개인정보와 확인되지 않은 단정적 정보는 제외해주세요.</p><div class="mat-form"><label>제목<input class="form-input" id="mat-write-title" maxlength="100" placeholder="자료 제목"></label><label>요약<textarea class="form-input" id="mat-write-summary" maxlength="260" placeholder="어떤 내용인지 2문장 이내로 설명해주세요."></textarea></label><label>핵심 내용<textarea class="form-input" id="mat-write-body" maxlength="4000" placeholder="핵심 내용을 줄마다 하나씩 적어주세요."></textarea><span class="mat-form__help">줄바꿈 기준으로 핵심 항목이 나뉩니다.</span></label><div class="mat-form-grid"><label>카테고리<input class="form-input" id="mat-write-category" maxlength="40" value="생활정보"></label><label>태그<input class="form-input" id="mat-write-tags" maxlength="160" placeholder="소비, 직장, 주거"></label><label>출처 이름<input class="form-input" id="mat-write-source" maxlength="80" placeholder="선택 입력"></label><label>출처 주소<input class="form-input" id="mat-write-url" maxlength="500" placeholder="https://..."></label></div><button class="btn btn--primary" id="mat-write-submit">자료 등록하기</button></div></section>`;
}

async function bindComposer(element) {
  const toggle = element.querySelector('#mat-write-open');
  const panel = element.querySelector('#mat-compose');
  toggle?.addEventListener('click', () => {
    if (!auth.currentUser) { navigate('/login?return=/materials'); return; }
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open')) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  element.querySelector('#mat-write-submit')?.addEventListener('click', async event => {
    if (!auth.currentUser) { navigate('/login?return=/materials'); return; }
    const button = event.currentTarget;
    const payload = {
      title: element.querySelector('#mat-write-title')?.value || '',
      summary: element.querySelector('#mat-write-summary')?.value || '',
      body: splitLines(element.querySelector('#mat-write-body')?.value, 10),
      category: element.querySelector('#mat-write-category')?.value || '생활정보',
      tags: splitTags(element.querySelector('#mat-write-tags')?.value, 8),
      sourceName: element.querySelector('#mat-write-source')?.value || '',
      sourceUrl: element.querySelector('#mat-write-url')?.value || '',
    };
    if (payload.title.trim().length < 3 || payload.summary.trim().length < 10 || !payload.body.length) {
      toast.info('제목, 요약, 핵심 내용을 모두 입력해주세요.');
      return;
    }
    button.disabled = true;
    button.textContent = '등록 중…';
    const result = await call('createUserMaterial', payload);
    if (!result.ok || !result.id) {
      button.disabled = false;
      button.textContent = '자료 등록하기';
      toast.error(result.error?.message || '자료 등록에 실패했습니다.');
      return;
    }
    toast.success('자료를 등록했습니다.');
    navigate(`/material/${result.id}`);
  });
}

function formatCommentDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function commentHtml(comment) {
  return `<div class="mat-comment"><b>${escHtml(comment.nickname || '익명')}</b><time>${escHtml(formatCommentDate(comment.createdAtMillis))}</time><p>${escHtml(comment.text || '')}</p></div>`;
}

async function reloadMaterialComments(materialId) {
  const container = document.getElementById('material-comments');
  if (!container) return;
  const result = await call('getMaterialComments', { materialId, limit: 60 });
  const comments = Array.isArray(result.comments) ? result.comments : [];
  container.innerHTML = comments.length ? comments.map(commentHtml).join('') : '<div class="mat-text">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</div>';
  const count = document.getElementById('material-comment-count');
  if (count) count.textContent = `${comments.length}개`;
}

export async function renderHistory() {
  setMeta('자료실', 'AI·관리자·회원이 함께 만드는 생활정보 자료실');
  styleOnce();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="mat-page"><div class="skeleton" style="height:170px;border-radius:25px"></div><div class="skeleton" style="height:430px;border-radius:22px"></div></div>`;

  const result = await call('getMaterials', { limit: 50 });
  const items = Array.isArray(result.materials) ? result.materials : [];
  element.innerHTML = `<div class="mat-page page-enter"><section class="mat-hero"><div class="mat-hero__eyebrow">MATERIAL ARCHIVE</div><h1>소소자료실</h1><p>AI 일일자료와 관리자 자료뿐 아니라 회원이 직접 등록한 생활정보도 함께 나눕니다. 각 자료에서 댓글로 경험과 의견을 이어갈 수 있습니다.</p><div class="mat-actions" style="margin-top:14px"><button class="btn btn--primary" id="mat-write-open">+ 자료 등록</button><button class="btn btn--ghost" data-go="/today">오늘의 콘텐츠</button><button class="btn btn--ghost" data-go="/debates">토론실</button></div></section>${composerHtml()}<div class="mat-grid">${items.length ? items.map(listCard).join('') : '<div class="empty-state"><div class="empty-state__title">등록된 자료가 없습니다.</div><div class="empty-state__desc">첫 자료를 직접 등록해보세요.</div></div>'}</div></div>`;
  element.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => navigate(`/material/${button.dataset.id}`)));
  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  await bindComposer(element);
}

export async function renderMaterialDetail(id) {
  styleOnce();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="mat-page"><div class="skeleton" style="height:560px;border-radius:25px"></div></div>`;

  const result = await call('getMaterial', { materialId: id });
  if (!result.ok || !result.material) {
    element.innerHTML = '<div class="empty-state"><div class="empty-state__title">자료를 찾을 수 없습니다.</div><button class="btn btn--primary" id="back-materials">자료실로</button></div>';
    element.querySelector('#back-materials')?.addEventListener('click', () => navigate('/materials'));
    return;
  }

  const material = result.material;
  setMeta(material.title, material.summary);
  const tags = Array.isArray(material.tags) ? material.tags : [];
  const body = Array.isArray(material.body) ? material.body : [];
  const guides = Array.isArray(material.sourceGuide) ? material.sourceGuide : [];
  const typeLabel = material.sourceType === 'user' ? 'USER MATERIAL' : material.aiGenerated ? 'AI DAILY MATERIAL' : 'ADMIN MATERIAL';

  element.innerHTML = `<div class="mat-page page-enter"><section class="mat-hero"><button class="btn btn--ghost btn--sm" id="mat-back">← 자료실</button><div class="mat-hero__eyebrow" style="margin-top:18px">${typeLabel}</div><h1>${escHtml(material.title)}</h1><p>${escHtml(material.summary)}</p><div class="mat-tags" style="margin-top:13px"><span class="mat-chip">${escHtml(material.category)}</span>${tags.map(tag => `<span class="mat-chip">#${escHtml(tag)}</span>`).join('')}</div></section><div class="mat-body"><div class="mat-main"><section class="mat-panel"><h2>핵심 정리</h2>${body.map((paragraph, index) => `<div class="mat-point"><span class="mat-point__num">${index + 1}</span><p>${escHtml(paragraph)}</p></div>`).join('')}</section><section class="mat-panel mat-disclaimer"><h2>이용 안내</h2><p>${escHtml(material.disclaimer || '일반적인 생활정보이며 개별 상황에 대한 전문적인 판단을 대신하지 않습니다.')}</p></section><section class="mat-panel"><h2>댓글 <span id="material-comment-count" class="mat-chip">0개</span></h2><div class="mat-comment-form"><textarea class="form-input" id="material-comment-text" maxlength="700" placeholder="자료에 대한 경험이나 의견을 남겨주세요."></textarea><button class="btn btn--primary" id="material-comment-submit">댓글 등록</button></div><div id="material-comments" class="mat-comments"><div class="mat-text">댓글을 불러오는 중…</div></div></section></div><aside class="mat-side"><section class="mat-panel"><h2>자료 정보</h2><p class="mat-source"><b>등록 방식</b><br>${escHtml(originLabel(material))}</p><p class="mat-source"><b>등록자·출처</b><br>${escHtml(material.sourceName || '소소킹')}</p>${material.sourceUrl ? `<a class="btn btn--ghost btn--sm" href="${escHtml(material.sourceUrl)}" target="_blank" rel="noopener noreferrer">출처 열기</a>` : ''}</section><section class="mat-panel"><h2>추가 확인 항목</h2><div class="mat-tags">${guides.length ? guides.map(guide => `<span class="mat-chip">${escHtml(guide)}</span>`).join('') : '<span class="mat-source">별도 검색어가 없습니다.</span>'}</div></section><section class="mat-panel"><h2>찬반을 나누고 싶다면</h2><p class="mat-source">A와 B 중 하나를 고르는 토론은 토론실에서 참여할 수 있습니다.</p><button class="btn btn--primary" id="go-debates">토론실 열기</button></section></aside></div></div>`;
  element.querySelector('#mat-back')?.addEventListener('click', () => navigate('/materials'));
  element.querySelector('#go-debates')?.addEventListener('click', () => navigate('/debates'));
  element.querySelector('#material-comment-submit')?.addEventListener('click', async event => {
    if (!auth.currentUser) { navigate(`/login?return=/material/${id}`); return; }
    const textElement = element.querySelector('#material-comment-text');
    const text = String(textElement?.value || '').trim();
    if (text.length < 2) { toast.info('댓글을 2자 이상 입력해주세요.'); return; }
    const button = event.currentTarget;
    button.disabled = true;
    const output = await call('addMaterialComment', { materialId: id, text });
    button.disabled = false;
    if (!output.ok) { toast.error(output.error?.message || '댓글 등록에 실패했습니다.'); return; }
    textElement.value = '';
    toast.success('댓글을 등록했습니다.');
    await reloadMaterialComments(id);
  });
  await reloadMaterialComments(id);
}
