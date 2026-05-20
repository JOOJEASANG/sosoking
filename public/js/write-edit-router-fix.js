import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function params(){return new URLSearchParams((location.hash.split('?')[1]||'').split('#')[0]);}
function editId(){const p=params();return p.get('edit')||p.get('postId')||p.get('id')||'';}
function isEdit(){return (location.hash||'').startsWith('#/write')&&!!editId();}
function tags(v){return String(v||'').split(',').map(x=>x.replace(/^#/,'').trim()).filter(Boolean).slice(0,8);}

function hideNewWriteUi(){
  if(!isEdit())return;
  document.querySelectorAll('.multi-preset-box,.multi-preset-list,[data-multi-preset]').forEach(el=>{
    (el.closest('.multi-preset-box')||el).style.display='none';
  });
}

function moduleLabels(m={}){
  const a=[]; if(m.vote?.enabled)a.push('투표'); if(m.naming?.enabled)a.push('작명'); if(m.acrostic?.enabled)a.push('삼행시'); if(m.relay?.enabled)a.push('릴레이'); if(m.quiz?.enabled)a.push('문제');
  return a.length?`<div class="feed-card__multi-chips" style="margin:8px 0 12px">${a.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:'';
}

function renderModules(post){
  if(post.type!=='multi')return'';
  const m=post.modules||{};
  return `<div class="card" style="margin-top:12px"><div class="card__body--lg">
    <div style="font-size:14px;font-weight:900;margin-bottom:6px">기존 만능글 기능</div>
    <div class="form-hint">수정 화면에서는 글쓰기 유형을 다시 고르지 않습니다.</div>${moduleLabels(m)}
    ${m.vote?.enabled?`<div class="form-group"><label class="form-label">투표 질문</label><input id="edit-vote-q" class="form-input" value="${esc(m.vote.question||'')}" maxlength="100"></div><div class="form-group"><label class="form-label">투표 선택지</label>${(m.vote.options||[]).map((o,i)=>`<input class="form-input edit-vote-o" style="margin-bottom:8px" value="${esc(o.text||'')}" data-votes="${Number(o.votes||0)}" placeholder="선택지 ${i+1}">`).join('')}</div>`:''}
    ${m.acrostic?.enabled?`<div class="form-group"><label class="form-label">삼행시 제시어</label><input id="edit-acrostic-k" class="form-input" value="${esc(m.acrostic.keyword||'')}" maxlength="8"></div>`:''}
    ${m.relay?.enabled?`<div class="form-group"><label class="form-label">릴레이 시작 문장</label><textarea id="edit-relay-s" class="form-textarea" rows="3" maxlength="300">${esc(m.relay.startSentence||'')}</textarea></div>`:''}
    ${m.quiz?.enabled?`<div class="form-group"><label class="form-label">문제</label><input id="edit-quiz-q" class="form-input" value="${esc(m.quiz.question||'')}" maxlength="160"></div><div class="form-group"><label class="form-label">정답</label><input id="edit-quiz-a" class="form-input" value="${esc(m.quiz.answer||'')}" maxlength="80"></div>`:''}
  </div></div>`;
}

function patchFor(post){
  const title=document.getElementById('edit-title-force')?.value.trim()||'';
  if(!title)throw new Error('제목을 입력해주세요.');
  const patch={title,desc:document.getElementById('edit-desc-force')?.value.trim()||'',tags:tags(document.getElementById('edit-tags-force')?.value||''),updatedAt:serverTimestamp()};
  if(post.type==='multi'){
    const m={...(post.modules||{})};
    if(m.vote?.enabled){
      const opts=[...document.querySelectorAll('.edit-vote-o')].map((input,i)=>({text:input.value.trim()||`선택지 ${i+1}`,votes:Number(input.dataset.votes||0)}));
      if(opts.length<2)throw new Error('투표 선택지는 2개 이상 필요합니다.');
      m.vote={...m.vote,question:document.getElementById('edit-vote-q')?.value.trim()||'선택해주세요',options:opts};
    }
    if(m.acrostic?.enabled)m.acrostic={...m.acrostic,keyword:document.getElementById('edit-acrostic-k')?.value.trim()||m.acrostic.keyword||''};
    if(m.relay?.enabled)m.relay={...m.relay,startSentence:document.getElementById('edit-relay-s')?.value.trim()||m.relay.startSentence||''};
    if(m.quiz?.enabled)m.quiz={...m.quiz,question:document.getElementById('edit-quiz-q')?.value.trim()||m.quiz.question||'',answer:document.getElementById('edit-quiz-a')?.value.trim()||m.quiz.answer||''};
    patch.modules=m;
  }
  return patch;
}

function render(post){
  const el=document.getElementById('page-content'); if(!el)return;
  const label=post.typeLabel||(post.type==='multi'?'만능 놀이글':post.type||'게시글');
  el.innerHTML=`<div class="write-page post-edit-page" data-edit-post-id="${esc(post.id)}"><div class="write-step-header"><button class="write-back-btn" id="edit-back-force" type="button">←</button><h1 class="write-step-title">✏️ 게시글 수정</h1></div><div class="card"><div class="card__body--lg"><div class="form-hint" style="margin-bottom:14px">기존 글 유형: <b>${esc(label)}</b> · 글쓰기 유형 버튼은 숨김 처리됩니다.</div><div class="form-group"><label class="form-label">제목 <span class="required">*</span></label><input id="edit-title-force" class="form-input" maxlength="100" value="${esc(post.title||'')}"></div><div class="form-group"><label class="form-label">내용</label><textarea id="edit-desc-force" class="form-textarea" rows="7" maxlength="2000">${esc(post.desc||'')}</textarea></div><div class="form-group"><label class="form-label">태그</label><input id="edit-tags-force" class="form-input" maxlength="120" value="${esc((post.tags||[]).join(', '))}"></div></div><div class="card__footer"><div class="write-submit"><button class="btn btn--ghost" id="edit-cancel-force" type="button">취소</button><button class="btn btn--primary" id="edit-save-force" type="button">수정 저장</button></div></div></div>${renderModules(post)}</div>`;
  document.getElementById('edit-back-force')?.addEventListener('click',()=>navigate(`/detail/${post.id}`));
  document.getElementById('edit-cancel-force')?.addEventListener('click',()=>navigate(`/detail/${post.id}`));
  document.getElementById('edit-save-force')?.addEventListener('click',async()=>{const b=document.getElementById('edit-save-force');try{b.disabled=true;b.textContent='저장 중...';await updateDoc(doc(db,'feeds',post.id),patchFor(post));toast.success('게시글을 수정했어요.');navigate(`/detail/${post.id}`);}catch(e){console.error(e);toast.error(e.message||'수정 저장에 실패했어요.');b.disabled=false;b.textContent='수정 저장';}});
}

async function renderEdit(){
  if(!isEdit())return; hideNewWriteUi();
  const id=editId(); const el=document.getElementById('page-content'); if(!el)return;
  if(el.querySelector(`[data-edit-post-id="${CSS.escape(id)}"]`))return;
  el.innerHTML='<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  try{const s=await getDoc(doc(db,'feeds',id)); if(!s.exists()){el.innerHTML='<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">수정할 글을 찾을 수 없어요</div></div>';return;} if(!auth.currentUser){el.innerHTML='<div class="empty-state"><div class="empty-state__icon">🔐</div><div class="empty-state__title">로그인 후 수정할 수 있어요</div></div>';return;} render({id:s.id,...s.data()});}catch(e){console.error(e);el.innerHTML='<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">수정 화면을 불러오지 못했어요</div></div>';}
}

function addAdminEditButtons(){
  document.querySelectorAll('#admin-content tr[data-row]').forEach(row=>{if(row.dataset.editReady==='1')return;const id=row.dataset.row;const cell=row.querySelector('td:last-child');if(!id||!cell)return;row.dataset.editReady='1';const btn=document.createElement('button');btn.type='button';btn.className='btn btn--ghost btn--sm';btn.textContent='수정';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();navigate(`/write?edit=${encodeURIComponent(id)}`);});cell.prepend(btn,document.createTextNode(' '));});
}

let timer=null;function schedule(){clearTimeout(timer);timer=setTimeout(()=>{addAdminEditButtons();renderEdit();hideNewWriteUi();},60);}
window.addEventListener('hashchange',schedule);window.addEventListener('sosoking:render-write-edit',schedule);window.addEventListener('sosoking:render-multi-write',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setTimeout(schedule,400);
