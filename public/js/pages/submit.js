import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';

const MAX_DESC = 600;
const DAILY_LIMIT = 3;

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
        <span class="logo">사건 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="card court-document" style="padding:20px;margin-bottom:18px;border-color:rgba(201,168,76,.45);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:6px;">간편 사건 접수서</div>
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;line-height:1.45;">무슨 일이 있었는지만 적어주세요</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;margin-top:8px;">
            AI가 내용을 읽고 사건명을 정한 뒤, 사건접수·수사보고·양측 변론·재판부 판결 형식으로 정리합니다.
          </div>
        </div>

        <form id="submit-form">
          <div class="form-group">
            <label class="form-label">사건 내용 <span style="color:var(--red)">*</span></label>
            <textarea id="case-desc" class="form-textarea" style="min-height:190px;line-height:1.75;" maxlength="${MAX_DESC}" placeholder="예: 남편이 마지막으로 남겨둔 치킨 한 조각을 말도 없이 먹고, 자기는 날개인 줄 알았다고 주장했습니다. CCTV는 없지만 빈 접시와 태연한 표정이 남아 있습니다." required></textarea>
            <div class="char-counter"><span id="desc-count">0</span>/${MAX_DESC}</div>
          </div>

          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(255,255,255,.025);">
            <div style="font-weight:900;color:var(--gold);margin-bottom:9px;">판결문 구성</div>
            <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;font-size:10px;color:var(--cream-dim);text-align:center;">
              <span>사건접수</span><span>수사보고</span><span>원고측</span><span>피고측</span><span>재판부</span>
            </div>
          </div>

          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.32);">
            <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.65;color:var(--cream);cursor:pointer;">
              <input type="checkbox" id="is-public" checked style="margin-top:4px;">
              <span><b style="color:var(--gold);">판결기록에 공개</b><br><span style="color:var(--cream-dim);">체크하면 다른 이용자가 판결문을 읽고 투표하거나 댓글을 남길 수 있습니다.</span></span>
            </label>
          </div>

          <div class="disclaimer" style="margin-bottom:24px;">
            <strong>⚠️ 접수 전 확인사항</strong><br>
            · 하루 접수 한도: 계정당 <strong>${settings.dailyLimit}건</strong><br>
            · 재접수 대기: <strong>${settings.cooldownSec}초</strong><br>
            · 실명·연락처·주민번호 등 개인정보 입력 금지<br>
            · 실제 분쟁 해결이 아닌 AI 오락 콘텐츠이며 법적 효력이 없습니다
          </div>

          <button type="submit" class="btn btn-primary" id="submit-btn">사건 접수하고 판결문 받기</button>
        </form>
      </div>
    </div>`;

  const descInput = document.getElementById('case-desc');
  descInput.addEventListener('input', function() {
    document.getElementById('desc-count').textContent = this.value.length;
  });

  document.getElementById('submit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = descInput.value.trim();
    const isPublic = document.getElementById('is-public').checked;

    if (desc.length < 10) return showToast('사건 내용을 조금 더 자세히 적어주세요.', 'error');
    if (_isTooSerious(desc)) {
      const proceed = await _showSeriousModal();
      if (!proceed) return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '사건 접수 중...';

    try {
      const submitCase = httpsCallable(functions, 'submitCase');
      const res = await submitCase({ caseDescription: desc, isPublic });
      const caseId = res.data?.caseId;
      if (!caseId) throw new Error('caseId missing');
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (err) {
      console.error(err);
      showToast((err?.message || '접수 중 오류가 발생했습니다.').replace('FirebaseError: ', ''), 'error');
      btn.disabled = false;
      btn.textContent = '사건 접수하고 판결문 받기';
    }
  });
}
