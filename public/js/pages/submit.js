import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const MAX_TITLE = 30;
const MAX_DESC = 200;
const MAX_DESIRED = 100;
const DAILY_LIMIT = 3;

const JUDGES = [
  { id: '엄벌주의형', icon: '👨‍⚖️', desc: '사소해도 중대 사건으로 격상' },
  { id: '감성형', icon: '🥹', desc: '판사가 먼저 울컥합니다' },
  { id: '현실주의형', icon: '🤦', desc: '팩트로 쓸쓸하게 정리' },
  { id: '과몰입형', icon: '🔥', desc: '생활사에 남길 대재판' },
  { id: '피곤형', icon: '😴', desc: '귀찮지만 양식은 완벽' },
  { id: '논리집착형', icon: '🧮', desc: '억울함을 소수점으로 계산' },
  { id: '드립형', icon: '🎭', desc: '진지한 얼굴로 드립 폭격' }
];

const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따',
  '이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원',
  '자살','자해','응급','정신과','우울증','공황'
];

function _isTooSerious(text) {
  return SERIOUS_KEYWORDS.some(kw => text.includes(kw));
}

function _showSeriousModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#1a2035;border:2px solid #e74c3c;border-radius:16px;padding:28px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        <div style="font-size:52px;margin-bottom:12px;">😰</div>
        <div style="font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;color:#e74c3c;margin-bottom:10px;">잠깐, 생활법정이 정색했습니다</div>
        <p style="font-size:14px;color:rgba(245,240,232,0.72);line-height:1.75;margin-bottom:22px;">
          이 사건은 웃고 넘기기보다<br>
          <strong style="color:#f5f0e8;">실제 전문가의 도움이 필요할 수 있어요.</strong><br><br>
          그래도 단순 오락용 각색이라면 계속 진행할 수 있습니다.<br>
          <span style="font-size:12px;opacity:0.55;">(판사님은 일단 물 한 잔 마셨습니다)</span>
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
        <span class="logo">소장 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="card" style="padding:18px;margin-bottom:18px;border-color:rgba(201,168,76,.45);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:6px;">E-FILING</div>
          <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;">소소킹 판결소 제3생활부</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">접수 후 사건번호가 부여되고, 접수심사 → 증거조사 → 변론 → 선고 순서로 진행됩니다.</div>
        </div>
        <form id="submit-form">
          <div class="form-group">
            <label class="form-label">사건명 <span style="color:var(--red)">*</span></label>
            <input type="text" id="case-title" class="form-input" maxlength="${MAX_TITLE}" placeholder="예: 라면 국물 무단 음용 사건" required>
            <div class="char-counter"><span id="title-count">0</span>/${MAX_TITLE}</div>
          </div>
          <div class="form-group">
            <label class="form-label">사건 경위 <span style="color:var(--red)">*</span></label>
            <textarea id="case-desc" class="form-textarea" style="min-height:112px;" maxlength="${MAX_DESC}" placeholder="누가, 언제, 무엇을 해서, 왜 억울한지 적어주세요. 단, 실명·연락처는 쓰지 마세요." required></textarea>
            <div class="char-counter"><span id="desc-count">0</span>/${MAX_DESC}</div>
          </div>
          <div class="form-group">
            <label class="form-label">억울 지수</label>
            <div class="slider-value"><span id="grievance-val">5</span><span style="font-size:14px;color:var(--cream-dim);"> / 10</span></div>
            <input type="range" id="grievance" class="form-range" min="1" max="10" value="5">
            <div class="slider-labels"><span>🙂 살짝 서운</span><span>😤 선고 필요</span></div>
          </div>
          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(255,255,255,.025);">
            <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">재판 진행 예정</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;color:var(--cream-dim);text-align:center;"><span>1 접수</span><span>2 증거조사</span><span>3 변론</span><span>4 판사배정</span><span>5 판결작성</span><span>6 선고</span></div>
          </div>
          <div class="form-group">
            <label class="form-label">담당 판사 선택 <span class="optional">선택 안 하면 랜덤 배정</span></label>
            <div class="judge-grid" id="judge-grid">
              <div class="judge-option active" data-judge=""><span style="font-size:22px;">🎲</span><div class="judge-option-name">랜덤 배정</div><div class="judge-option-desc">재판부가 배당</div></div>
              ${JUDGES.map(j => `<div class="judge-option" data-judge="${escapeHtml(j.id)}"><span style="font-size:22px;">${j.icon}</span><div class="judge-option-name">${escapeHtml(j.id)}</div><div class="judge-option-desc">${escapeHtml(j.desc)}</div></div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">원하는 판결 <span class="optional">선택</span></label>
            <input type="text" id="desired-verdict" class="form-input" maxlength="${MAX_DESIRED}" placeholder="예: 사과와 라면 국물 3숟갈 반환">
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            <strong>⚠️ 접수 전 확인사항</strong><br>
            · 하루 접수 한도는 계정당 <strong>${settings.dailyLimit}건</strong>으로 고정됩니다.<br>
            · 재접수 대기: <strong>${settings.cooldownSec}초</strong><br>
            · 실명·연락처·주민번호 등 개인정보 입력 금지<br>
            · 본 서비스는 AI 기반 <strong>오락 목적</strong>이며 법적 효력이 없습니다
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">소장 제출 및 사건번호 발급</button>
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

  document.getElementById('case-title').addEventListener('input', function() {
    document.getElementById('title-count').textContent = this.value.length;
  });
  document.getElementById('case-desc').addEventListener('input', function() {
    document.getElementById('desc-count').textContent = this.value.length;
  });
  document.getElementById('grievance').addEventListener('input', function() {
    document.getElementById('grievance-val').textContent = this.value;
  });

  document.getElementById('submit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('case-title').value.trim();
    const desc = document.getElementById('case-desc').value.trim();
    const desired = document.getElementById('desired-verdict').value.trim();
    const grievance = parseInt(document.getElementById('grievance').value, 10);
    if (!title || !desc) return showToast('사건명과 사건 경위를 입력해주세요.', 'error');
    if (_isTooSerious(`${title} ${desc}`)) {
      const proceed = await _showSeriousModal();
      if (!proceed) return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '전자소송 접수 중...';
    try {
      const submitCase = httpsCallable(functions, 'submitCase');
      const res = await submitCase({ caseTitle: title, caseDescription: desc, grievanceIndex: grievance, desiredVerdict: desired, selectedJudge });
      const caseId = res.data?.caseId;
      if (!caseId) throw new Error('caseId missing');
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (err) {
      console.error(err);
      const msg = err?.message || '접수 중 오류가 발생했습니다.';
      showToast(msg.replace('FirebaseError: ', ''), 'error');
      btn.disabled = false;
      btn.textContent = '소장 제출 및 사건번호 발급';
    }
  });
}
