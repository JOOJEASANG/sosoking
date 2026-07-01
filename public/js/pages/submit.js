import { functions } from '../firebase.js?v=20260630-3';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const MAX_TITLE = 30;
const MAX_DESC = 200;
const MAX_QUICK = 120;
const MAX_DESIRED = 80;

const QUICK_EXAMPLES = ['오늘 모기 때문에 잠을 못 잠','엘리베이터가 내 앞에서 닫힘','라면은 스프 먼저인가 면 먼저인가','마지막 만두는 먼저 본 사람이 먹어도 되는가','리모컨은 잡은 사람이 임자인가'];
const JUDGES = [
  { id: '엄벌주의형', icon: '🚨', desc: '하찮은 피고도 엄중 선고' },
  { id: '감성형', icon: '🥹', desc: '원고의 서운함에 과몰입' },
  { id: '현실주의형', icon: '🧊', desc: '팩트로 조용히 판결' },
  { id: '과몰입형', icon: '🔥', desc: '한 줄 사건을 대형 재판으로 확대' },
  { id: '피곤형', icon: '😴', desc: '귀찮지만 판결문은 씀' },
  { id: '논리집착형', icon: '🧮', desc: '하찮은 증거까지 수치화' },
  { id: '드립형', icon: '🎭', desc: '정색한 판결 개그' }
];

function compact(v, max = 80) { return String(v || '').replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function autoTitle(text) {
  const raw = compact(text, 44).replace(/["“”'`]/g, '').replace(/[.!?~]+$/g, '');
  const base = raw.length > 21 ? `${raw.slice(0, 21)}…` : raw;
  if (!base) return '';
  if (base.includes('사건') || base.includes('분쟁') || base.includes('논쟁')) return base.slice(0, MAX_TITLE);
  return `${base} 사건`.slice(0, MAX_TITLE);
}

export async function renderSubmit(container) {
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">한 줄 소소사건 접수</span></div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="card" style="padding:18px;margin-bottom:18px;border-color:rgba(201,168,76,.45);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:6px;">SOSOKING TRIAL</div>
          <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;">소소킹 재판소 한 줄 접수</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">모기, 라면, 리모컨 같은 한 줄 소소사건을 넣으면 개정 → 증거조사 → 쟁점 → 판결이유 → 주문 → 소소 형량으로 과하게 판결합니다.</div>
        </div>
        <form id="submit-form">
          <div class="form-group"><label class="form-label">오늘의 소소사건 <span style="color:var(--red)">*</span></label><textarea id="quick-brief" class="form-textarea" style="min-height:88px;" maxlength="${MAX_QUICK}" placeholder="예: 오늘 모기 때문에 잠을 못 잠"></textarea><div class="char-counter"><span id="quick-count">0</span>/${MAX_QUICK}</div><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;">${QUICK_EXAMPLES.map(v => `<button type="button" class="btn btn-ghost quick-chip" data-brief="${escapeHtml(v)}" style="width:auto;min-height:34px;padding:8px 10px;font-size:12px;">${escapeHtml(v)}</button>`).join('')}</div></div>
          <details style="margin-bottom:20px;"><summary style="cursor:pointer;color:var(--gold);font-size:13px;font-weight:900;margin-bottom:12px;">선택: 제목/상세내용 직접 다듬기</summary><div class="form-group"><label class="form-label">소소사건 제목</label><input type="text" id="case-title" class="form-input" maxlength="${MAX_TITLE}" placeholder="예: 모기 수면방해 사건"><div class="char-counter"><span id="title-count">0</span>/${MAX_TITLE}</div></div><div class="form-group"><label class="form-label">상세 내용</label><textarea id="case-desc" class="form-textarea" style="min-height:100px;" maxlength="${MAX_DESC}" placeholder="추가 설명이 필요할 때만 입력하세요."></textarea><div class="char-counter"><span id="desc-count">0</span>/${MAX_DESC}</div></div></details>
          <div class="form-group"><label class="form-label">사소함 레벨</label><div class="slider-value"><span id="grievance-val">5</span><span style="font-size:14px;color:var(--cream-dim);"> / 10</span></div><input type="range" id="grievance" class="form-range" min="1" max="10" value="5"><div class="slider-labels"><span>🙂 먼지급</span><span>⚖️ 재판감</span></div></div>
          <div class="form-group"><label class="form-label">재판부 성향 <span class="optional">선택 안 하면 랜덤</span></label><div class="judge-grid" id="judge-grid"><div class="judge-option active" data-judge=""><span style="font-size:22px;">🎲</span><div class="judge-option-name">랜덤 배정</div><div class="judge-option-desc">재판부가 알아서 정색</div></div>${JUDGES.map(j => `<div class="judge-option" data-judge="${escapeHtml(j.id)}"><span style="font-size:22px;">${j.icon}</span><div class="judge-option-name">${escapeHtml(j.id)}</div><div class="judge-option-desc">${escapeHtml(j.desc)}</div></div>`).join('')}</div></div>
          <div class="form-group"><label class="form-label">원하는 소소 형량 <span class="optional">선택</span></label><input type="text" id="desired-verdict" class="form-input" maxlength="${MAX_DESIRED}" placeholder="예: 피고 모기 접근금지 30cm"></div>
          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.32);"><label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.65;color:var(--cream);cursor:pointer;"><input type="checkbox" id="is-public" checked style="margin-top:4px;"><span><b style="color:var(--gold);">공개 판결기록에 올리기</b><br><span style="color:var(--cream-dim);">체크하면 다른 유저들이 웃김 점수와 댓글을 남길 수 있습니다.</span></span></label></div>
          <div class="disclaimer" style="margin-bottom:24px;"><strong>⚠️ 접수 전 확인사항</strong><br>· 별것 아닌 소소한 사건일수록 더 재판감입니다.<br>· 실명, 연락처 같은 개인정보는 적지 마세요.<br>· 본 서비스는 AI 기반 오락 콘텐츠이며 실제 효력이 없습니다.</div>
          <button type="submit" class="btn btn-primary" id="submit-btn">소소재판 개정하기</button>
        </form>
      </div>
    </div>`;
  let selectedJudge = '';
  const quick = document.getElementById('quick-brief');
  const titleInput = document.getElementById('case-title');
  const descInput = document.getElementById('case-desc');
  const syncAuto = () => { document.getElementById('quick-count').textContent = quick.value.length; if (!titleInput.dataset.userEdited) titleInput.value = autoTitle(quick.value); if (!descInput.dataset.userEdited) descInput.value = compact(quick.value, MAX_DESC); document.getElementById('title-count').textContent = titleInput.value.length; document.getElementById('desc-count').textContent = descInput.value.length; };
  quick.addEventListener('input', syncAuto);
  document.querySelectorAll('.quick-chip').forEach(btn => btn.addEventListener('click', () => { quick.value = btn.dataset.brief || ''; titleInput.dataset.userEdited = ''; descInput.dataset.userEdited = ''; syncAuto(); }));
  titleInput.addEventListener('input', function() { this.dataset.userEdited = 'true'; document.getElementById('title-count').textContent = this.value.length; });
  descInput.addEventListener('input', function() { this.dataset.userEdited = 'true'; document.getElementById('desc-count').textContent = this.value.length; });
  document.getElementById('grievance').addEventListener('input', function() { document.getElementById('grievance-val').textContent = this.value; });
  document.getElementById('judge-grid').addEventListener('click', e => { const opt = e.target.closest('.judge-option'); if (!opt) return; document.querySelectorAll('#judge-grid .judge-option').forEach(el => el.classList.remove('active')); opt.classList.add('active'); selectedJudge = opt.dataset.judge || ''; });
  document.getElementById('submit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const quickText = quick.value.trim();
    const title = (titleInput.value.trim() || autoTitle(quickText)).slice(0, MAX_TITLE);
    const desc = (descInput.value.trim() || quickText).slice(0, MAX_DESC);
    if (!quickText && (!title || !desc)) return showToast('한 줄 소소사건을 입력해주세요.', 'error');
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '재판부 입장 중...';
    try {
      const submitCase = httpsCallable(functions, 'submitCase');
      const res = await submitCase({ caseTitle: title, caseDescription: desc, grievanceIndex: parseInt(document.getElementById('grievance').value, 10), desiredVerdict: document.getElementById('desired-verdict').value.trim(), selectedJudge, isPublic: document.getElementById('is-public').checked });
      const caseId = res.data?.caseId;
      if (!caseId) throw new Error('caseId missing');
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (err) {
      console.error(err);
      showToast((err?.message || '접수 중 오류가 발생했습니다.').replace('FirebaseError: ', ''), 'error');
      btn.disabled = false;
      btn.textContent = '소소재판 개정하기';
    }
  });
}
