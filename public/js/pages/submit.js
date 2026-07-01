import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const MAX_TITLE = 30;
const MAX_DESC = 200;
const MAX_QUICK = 120;
const MAX_DESIRED = 80;
const DAILY_LIMIT = 3;

const QUICK_EXAMPLES = [
  '양말은 뒤집어서 벗어도 되는가',
  '라면은 스프 먼저인가 면 먼저인가',
  '마지막 만두는 먼저 본 사람이 먹어도 되는가',
  '리모컨은 잡은 사람이 임자인가'
];

const JUDGES = [
  { id: '엄벌주의형', icon: '🚨', desc: '먼지급 사안을 재난급으로 격상' },
  { id: '감성형', icon: '🥹', desc: '제보자의 서운함에 과몰입' },
  { id: '현실주의형', icon: '🧊', desc: '차갑게 정리하고 조용히 웃김' },
  { id: '과몰입형', icon: '🔥', desc: '한 줄 다툼을 국가 의제로 확대' },
  { id: '피곤형', icon: '😴', desc: '귀찮지만 결정문은 또 씀' },
  { id: '논리집착형', icon: '🧮', desc: '하찮음을 수치화해서 심판' },
  { id: '드립형', icon: '🎭', desc: '속보 톤으로 정색 개그' }
];

const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따',
  '이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원',
  '응급','정신과','우울증','공황'
];

function _isTooSerious(text) {
  return SERIOUS_KEYWORDS.some(kw => text.includes(kw));
}
function _compact(v, max = 80) {
  return String(v || '').replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function _autoTitle(text) {
  const raw = _compact(text, 44).replace(/["“”'`]/g, '').replace(/[.!?~]+$/g, '');
  const base = raw.length > 21 ? `${raw.slice(0, 21)}…` : raw;
  if (!base) return '';
  if (base.includes('분쟁') || base.includes('논쟁')) return base.slice(0, MAX_TITLE);
  return `${base} 분쟁`.slice(0, MAX_TITLE);
}
function _showSeriousModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#1a2035;border:2px solid #e74c3c;border-radius:16px;padding:28px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        <div style="font-size:52px;margin-bottom:12px;">😰</div>
        <div style="font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;color:#e74c3c;margin-bottom:10px;">잠깐, 소소분쟁위원회가 정색했습니다</div>
        <p style="font-size:14px;color:rgba(245,240,232,0.72);line-height:1.75;margin-bottom:22px;">
          이 내용은 웃고 넘기기보다<br>
          <strong style="color:#f5f0e8;">실제 전문가의 도움이 필요할 수 있어요.</strong><br><br>
          단순 오락용 각색이라면 계속 진행할 수 있습니다.<br>
          <span style="font-size:12px;opacity:0.55;">(위원회는 일단 회의실 문을 닫았습니다)</span>
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a href="https://www.klac.or.kr" target="_blank" rel="noopener" style="display:block;padding:13px;border-radius:12px;background:rgba(231,76,60,0.15);border:1.5px solid rgba(231,76,60,0.4);color:#e74c3c;font-weight:700;font-size:14px;text-decoration:none;">⚖️ 실제 법률 도움 알아보기</a>
          <button id="_serious-confirm" style="padding:13px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(245,240,232,0.75);font-size:13px;cursor:pointer;">🎭 오락용으로만 접수할게요</button>
          <button id="_serious-cancel" style="padding:10px;border-radius:12px;background:none;border:none;color:rgba(245,240,232,0.38);font-size:13px;cursor:pointer;">취소</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_serious-confirm').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#_serious-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}
async function _loadSubmitSettings() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    const d = snap.exists() ? snap.data() : {};
    return {
      dailyLimit: DAILY_LIMIT,
      cooldownSec: Number.isFinite(Number(d.cooldownSec)) ? Number(d.cooldownSec) : 45,
    };
  } catch {
    return { dailyLimit: DAILY_LIMIT, cooldownSec: 45 };
  }
}

export async function renderSubmit(container) {
  const settings = await _loadSubmitSettings();
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">한 줄 분쟁 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="card" style="padding:18px;margin-bottom:18px;border-color:rgba(201,168,76,.45);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:6px;">BREAKING DISPUTE</div>
          <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;">소소분쟁위원회 긴급접수</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">짧을수록 좋습니다. 한 줄 다툼을 넣으면 속보 → 브리핑 → 쟁점 → 위원회 결정 → 소소 처분으로 즉시 처리합니다.</div>
        </div>
        <form id="submit-form">
          <div class="form-group">
            <label class="form-label">오늘의 소소분쟁 <span style="color:var(--red)">*</span></label>
            <textarea id="quick-brief" class="form-textarea" style="min-height:88px;" maxlength="${MAX_QUICK}" placeholder="예: 양말은 뒤집어서 벗어도 되는가"></textarea>
            <div class="char-counter"><span id="quick-count">0</span>/${MAX_QUICK}</div>
            <div id="quick-examples" style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;">
              ${QUICK_EXAMPLES.map(v => `<button type="button" class="btn btn-ghost quick-chip" data-brief="${escapeHtml(v)}" style="width:auto;min-height:34px;padding:8px 10px;font-size:12px;">${escapeHtml(v)}</button>`).join('')}
            </div>
          </div>

          <details id="advanced-case" style="margin-bottom:20px;">
            <summary style="cursor:pointer;color:var(--gold);font-size:13px;font-weight:900;margin-bottom:12px;">선택: 제목/상세내용 직접 다듬기</summary>
            <div class="form-group">
              <label class="form-label">분쟁 제목 <span class="optional">비워두면 자동 생성</span></label>
              <input type="text" id="case-title" class="form-input" maxlength="${MAX_TITLE}" placeholder="예: 양말 뒤집기 분쟁">
              <div class="char-counter"><span id="title-count">0</span>/${MAX_TITLE}</div>
            </div>
            <div class="form-group">
              <label class="form-label">상세 내용 <span class="optional">비워두면 한 줄 내용 사용</span></label>
              <textarea id="case-desc" class="form-textarea" style="min-height:100px;" maxlength="${MAX_DESC}" placeholder="추가 설명이 필요할 때만 입력하세요. 실명·연락처는 쓰지 마세요."></textarea>
              <div class="char-counter"><span id="desc-count">0</span>/${MAX_DESC}</div>
            </div>
          </details>

          <div class="form-group">
            <label class="form-label">사소함 레벨</label>
            <div class="slider-value"><span id="grievance-val">5</span><span style="font-size:14px;color:var(--cream-dim);"> / 10</span></div>
            <input type="range" id="grievance" class="form-range" min="1" max="10" value="5">
            <div class="slider-labels"><span>🙂 먼지급</span><span>🚨 속보 필요</span></div>
          </div>
          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(255,255,255,.025);">
            <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">처리 예정</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;color:var(--cream-dim);text-align:center;"><span>1 속보</span><span>2 브리핑</span><span>3 쟁점</span><span>4 판단</span><span>5 결정</span><span>6 처분</span></div>
          </div>
          <div class="form-group">
            <label class="form-label">위원회 성향 <span class="optional">선택 안 하면 랜덤 배정</span></label>
            <div class="judge-grid" id="judge-grid">
              <div class="judge-option active" data-judge=""><span style="font-size:22px;">🎲</span><div class="judge-option-name">랜덤 배정</div><div class="judge-option-desc">위원회가 알아서 정색</div></div>
              ${JUDGES.map(j => `<div class="judge-option" data-judge="${escapeHtml(j.id)}"><span style="font-size:22px;">${j.icon}</span><div class="judge-option-name">${escapeHtml(j.id)}</div><div class="judge-option-desc">${escapeHtml(j.desc)}</div></div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">원하는 소소 처분 <span class="optional">선택</span></label>
            <input type="text" id="desired-verdict" class="form-input" maxlength="${MAX_DESIRED}" placeholder="예: 다음 라면 조리 전 의견조사 실시">
          </div>
          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.32);">
            <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.65;color:var(--cream);cursor:pointer;">
              <input type="checkbox" id="is-public" checked style="margin-top:4px;">
              <span><b style="color:var(--gold);">공개 기록에 올리기</b><br><span style="color:var(--cream-dim);">체크하면 처리 후 다른 유저들이 공개 기록에서 열람할 수 있습니다. 개인정보는 적지 마세요.</span></span>
            </label>
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            <strong>⚠️ 접수 전 확인사항</strong><br>
            · 하루 접수 한도는 계정당 <strong>${settings.dailyLimit}건</strong>입니다.<br>
            · 재접수 대기: <strong>${settings.cooldownSec}초</strong><br>
            · 진짜 심각한 문제 말고, 별것 아닌 소소한 다툼일수록 더 재밌습니다.<br>
            · 본 서비스는 AI 기반 <strong>오락 목적</strong>이며 법적 효력이 없습니다
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">긴급속보 내고 심판받기</button>
        </form>
      </div>
    </div>`;

  let selectedJudge = '';

  document.getElementById('judge-grid').addEventListener('click', (e) => {
    const opt = e.target.closest('.judge-option');
    if (!opt) return;
    document.querySelectorAll('#judge-grid .judge-option').forEach(el => el.classList.remove('active'));
    opt.classList.add('active');
    selectedJudge = opt.dataset.judge || '';
  });

  const quick = document.getElementById('quick-brief');
  const titleInput = document.getElementById('case-title');
  const descInput = document.getElementById('case-desc');
  const syncAuto = () => {
    document.getElementById('quick-count').textContent = quick.value.length;
    if (!titleInput.dataset.userEdited) {
      titleInput.value = _autoTitle(quick.value);
      document.getElementById('title-count').textContent = titleInput.value.length;
    }
    if (!descInput.dataset.userEdited) {
      descInput.value = _compact(quick.value, MAX_DESC);
      document.getElementById('desc-count').textContent = descInput.value.length;
    }
  };
  quick.addEventListener('input', syncAuto);
  document.querySelectorAll('.quick-chip').forEach(btn => btn.addEventListener('click', () => {
    quick.value = btn.dataset.brief || '';
    titleInput.dataset.userEdited = '';
    descInput.dataset.userEdited = '';
    syncAuto();
  }));
  titleInput.addEventListener('input', function() {
    this.dataset.userEdited = 'true';
    document.getElementById('title-count').textContent = this.value.length;
  });
  descInput.addEventListener('input', function() {
    this.dataset.userEdited = 'true';
    document.getElementById('desc-count').textContent = this.value.length;
  });
  document.getElementById('grievance').addEventListener('input', function() {
    document.getElementById('grievance-val').textContent = this.value;
  });

  document.getElementById('submit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const quickText = quick.value.trim();
    const title = (titleInput.value.trim() || _autoTitle(quickText)).slice(0, MAX_TITLE);
    const desc = (descInput.value.trim() || quickText).slice(0, MAX_DESC);
    const desired = document.getElementById('desired-verdict').value.trim();
    const grievance = parseInt(document.getElementById('grievance').value, 10);
    const isPublic = document.getElementById('is-public').checked;
    if (!quickText && (!title || !desc)) return showToast('한 줄 분쟁을 입력해주세요.', 'error');
    if (!title || !desc) return showToast('접수 내용을 조금만 더 적어주세요.', 'error');
    if (_isTooSerious(`${title} ${desc}`)) {
      const proceed = await _showSeriousModal();
      if (!proceed) return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '긴급속보 편성 중...';
    try {
      const submitCase = httpsCallable(functions, 'submitCase');
      const res = await submitCase({ caseTitle: title, caseDescription: desc, grievanceIndex: grievance, desiredVerdict: desired, selectedJudge, isPublic });
      const caseId = res.data?.caseId;
      if (!caseId) throw new Error('caseId missing');
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (err) {
      console.error(err);
      const msg = err?.message || '접수 중 오류가 발생했습니다.';
      showToast(msg.replace('FirebaseError: ', ''), 'error');
      btn.disabled = false;
      btn.textContent = '긴급속보 내고 심판받기';
    }
  });
}
