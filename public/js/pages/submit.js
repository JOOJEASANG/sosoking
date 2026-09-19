import { auth, db, functions } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';

const MAX_DESC = 600;
const DEFAULT_DAILY_LIMIT = 3;

const EXAMPLE_CASES = [
  { label: '🍗 치킨 도둑', text: '남편이 냉장고에 아껴둔 치킨 마지막 날개를 말도 없이 먹었습니다. 저는 퇴근 내내 그 치킨을 생각하며 버텼는데 집에 오니 빈 접시만 남아 있었습니다. 남편은 "날개가 두 개인 줄 알았는데 한 개밖에 없었다"고 주장하지만, 분명히 제가 아껴둔 걸 알고 먹은 것이 확실합니다.' },
  { label: '❄️ 에어컨 분쟁', text: '룸메이트가 제가 퇴근하기 30분 전부터 에어컨을 18도로 맞춰두고 정작 본인은 긴 팔을 입고 있습니다. 전기요금은 반반씩 내지만 에어컨 사용 시간은 룸메이트가 압도적으로 많습니다. 추위를 타는 저는 매일 밤 이불을 뒤집어쓰고 자는데, 룸메이트는 "방이 안 더우면 못 잔다"며 양보할 생각이 없습니다.' },
  { label: '💬 카톡 읽씹', text: '친한 친구에게 중요한 부탁을 카톡으로 보냈는데 2시간째 읽고 답장이 없습니다. 그런데 공동 단톡방에서는 이모지를 달았고 인스타 스토리도 올렸습니다. 읽씹이 명백한 상황에서 본인은 "못 봤다"고 주장할 것이 뻔해 미리 증거를 확보해뒀습니다.' },
  { label: '🧮 더치페이 계산기', text: '우리 모임에서 저만 항상 더치페이 계산을 합니다. 6개월째 이 상황인데 아무도 고맙다는 말이 없습니다. 지난주에는 제가 화장실에 다녀왔더니 계산 앱이 제 핸드폰 위에 올려져 있었습니다. 이번에 모임 나가기 전에 이 억울함을 법정에서 정리하고 싶습니다.' }
];

const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '아동학대','가정폭력','학교폭력','자살','자해','죽고 싶다','극단적 선택','마약'
];

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.floor(number)))
    : fallback;
}

function isTooSerious(text) {
  return SERIOUS_KEYWORDS.some(keyword => text.includes(keyword));
}

function showSeriousModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'serious-modal-title');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#1a2035;border:2px solid #e74c3c;border-radius:16px;padding:28px 24px;max-width:390px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.6);">
        <div style="font-size:52px;margin-bottom:12px;" aria-hidden="true">😰</div>
        <div id="serious-modal-title" style="font-size:19px;font-weight:900;color:#ff796c;margin-bottom:10px;">이 내용은 생활법정에서 다루기 어렵습니다</div>
        <p style="font-size:14px;color:rgba(245,240,232,.82);line-height:1.75;margin-bottom:22px;">
          실제 범죄·폭력·위기 상황처럼 보이는 내용은 오락형 AI 판결 대신<br>
          <strong style="color:#fff8ec;">관계 기관이나 적절한 전문가의 도움</strong>을 이용해 주세요.
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a href="https://www.klac.or.kr" target="_blank" rel="noopener noreferrer" style="display:block;padding:13px;border-radius:12px;background:rgba(231,76,60,.15);border:1.5px solid rgba(231,76,60,.45);color:#ff796c;font-weight:700;font-size:14px;text-decoration:none;">⚖️ 대한법률구조공단 알아보기</a>
          <button type="button" id="serious-cancel" style="padding:13px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff8ec;font-size:13px;cursor:pointer;">내용 다시 고치기</button>
        </div>
      </div>`;

    const close = result => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(result);
    };
    const onKeydown = event => {
      if (event.key === 'Escape') close(false);
    };

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeydown);
    overlay.querySelector('#serious-cancel').onclick = () => close(false);
    overlay.onclick = event => {
      if (event.target === overlay) close(false);
    };
    overlay.querySelector('#serious-cancel').focus();
  });
}

async function loadSubmitSettings() {
  try {
    const snap = await getDoc(doc(db, 'site_public', 'config'));
    const data = snap.exists() ? snap.data() : {};
    return {
      dailyLimitEnabled: data.dailyLimitEnabled === true,
      dailyLimit: clampNumber(data.dailyLimit, DEFAULT_DAILY_LIMIT, 1, 1000),
      cooldownSec: clampNumber(data.cooldownSec, 45, 0, 300)
    };
  } catch (error) {
    console.warn('submit settings load failed:', error?.code || error);
    return { dailyLimitEnabled: false, dailyLimit: DEFAULT_DAILY_LIMIT, cooldownSec: 45 };
  }
}

function submissionLimitText(settings) {
  return settings.dailyLimitEnabled
    ? `계정당 <strong>${settings.dailyLimit}건</strong>`
    : '<strong>현재 제한 없음</strong>';
}

function renderLoginRequired(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a>
        <span class="logo">사건 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:90px;">
        <div class="court-shell" style="padding:26px 22px;text-align:center;">
          <div class="court-seal" style="margin:0 auto 12px;" aria-hidden="true">🔐</div>
          <div class="court-kicker">LOGIN REQUIRED</div>
          <div class="court-title" style="margin-bottom:8px;">로그인 후 사건을 접수할 수 있습니다</div>
          <div class="court-desc" style="margin-bottom:22px;">
            내 사건 기록, 본인 예상 판정, 판결 확인과 공개 여부 관리를 위해<br>
            Google 또는 이메일 로그인이 필요합니다.
          </div>
          <a href="#/auth" class="btn btn-primary">로그인하고 사건 접수하기</a>
          <a href="#/jury" class="btn btn-ghost" style="margin-top:10px;">민심소 먼저 둘러보기</a>
        </div>
      </div>
    </div>`;
}

export async function renderSubmit(container) {
  const user = auth.currentUser;
  if (!user) {
    renderLoginRequired(container);
    return;
  }

  // Render immediately with defaults — no await before innerHTML to avoid blank screen
  const settingsPromise = loadSubmitSettings();
  const defaults = { dailyLimitEnabled: false, dailyLimit: DEFAULT_DAILY_LIMIT, cooldownSec: 45 };
  let selectedJudge = '';
  let selectedGrievance = 5;

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a>
        <span class="logo">사건 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="card court-document" style="padding:20px;margin-bottom:18px;border-color:rgba(201,168,76,.45);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:6px;">간편 사건 접수서</div>
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;line-height:1.45;">무슨 일이 있었는지만 적어주세요</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;margin-top:8px;">
            AI가 내용을 읽고 사건명과 담당 판사를 정한 뒤 다섯 단계 문서로 정리합니다. 새 사건은 항상 비공개로 시작합니다.
          </div>
        </div>

        <form id="submit-form">
          <div class="form-group">
            <label class="form-label" for="case-desc">사건 내용 <span style="color:var(--red)">*</span></label>
            <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:8px;">
              <span style="font-size:11px;color:var(--cream-dim);white-space:nowrap;flex-shrink:0;">이런 사건 어때요?</span>
              ${EXAMPLE_CASES.map((c, i) => `<button type="button" class="example-case-chip" data-idx="${i}" style="padding:5px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;">${c.label}</button>`).join('')}
            </div>
            <textarea id="case-desc" class="form-textarea" style="min-height:190px;line-height:1.75;" maxlength="${MAX_DESC}" aria-describedby="desc-help desc-counter" placeholder="예: 남편이 마지막으로 남겨둔 치킨 한 조각을 말도 없이 먹고, 자기는 날개인 줄 알았다고 주장했습니다. CCTV는 없지만 빈 접시와 태연한 표정이 남아 있습니다." required></textarea>
            <div id="desc-help" style="font-size:11px;color:var(--cream-dim);margin-top:6px;">실명·연락처·주소·계좌번호 등 개인정보는 빼고 상황만 적어주세요.</div>
            <div id="desc-counter" class="char-counter" aria-live="polite"><span id="desc-count">0</span>/${MAX_DESC}</div>
          </div>

          <div class="form-group" style="margin-bottom:18px;">
            <div class="form-label" style="margin-bottom:9px;">담당 판사 유형 <span style="font-size:11px;font-weight:400;color:var(--cream-dim);">선택 안 하면 자동 배정</span></div>
            <div id="judge-picker" role="group" aria-label="판사 유형 선택" style="display:flex;flex-wrap:wrap;gap:7px;">
              <button type="button" class="judge-chip" data-judge="" aria-pressed="true" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(201,168,76,.8);background:rgba(201,168,76,.2);color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;">🎲 랜덤</button>
              <button type="button" class="judge-chip" data-judge="꼰대형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🧓 꼰대형</button>
              <button type="button" class="judge-chip" data-judge="냉혈형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🧊 냉혈형</button>
              <button type="button" class="judge-chip" data-judge="회피형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🏃 회피형</button>
              <button type="button" class="judge-chip" data-judge="추궁형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🔎 추궁형</button>
              <button type="button" class="judge-chip" data-judge="오버형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🚨 오버형</button>
              <button type="button" class="judge-chip" data-judge="드립형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🎭 드립형</button>
              <button type="button" class="judge-chip" data-judge="빙의형" aria-pressed="false" style="padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;">🌀 빙의형</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:18px;">
            <label class="form-label" for="grievance-slider" style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">억울지수 <span id="grievance-value" style="color:var(--gold);font-size:16px;font-weight:900;">5</span><span style="font-size:11px;font-weight:400;color:var(--cream-dim);">/10 — 판사가 이 억울함을 얼마나 심각하게 다룰지 결정합니다</span></label>
            <input type="range" id="grievance-slider" min="1" max="10" value="5" step="1" style="width:100%;accent-color:var(--gold);cursor:pointer;" aria-valuemin="1" aria-valuemax="10" aria-valuenow="5">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--cream-dim);margin-top:4px;"><span>소소한 억울함</span><span>극도의 억울함</span></div>
          </div>

          <div class="card" style="padding:14px;margin-bottom:14px;background:rgba(255,255,255,.025);">
            <div style="font-weight:900;color:var(--gold);margin-bottom:9px;">판결문 구성</div>
            <div class="submit-document-flow" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;font-size:10px;color:var(--cream-dim);text-align:center;">
              <span>사건접수</span><span>수사보고</span><span>원고측</span><span>피고측</span><span>재판부</span>
            </div>
          </div>

          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.32);">
            <div style="display:flex;gap:11px;align-items:flex-start;">
              <div aria-hidden="true" style="font-size:22px;line-height:1;">🔒</div>
              <div style="min-width:0;">
                <div style="font-weight:900;color:var(--gold);margin-bottom:5px;">비공개 생성 → 내 예상 판정 → AI 판결 공개</div>
                <div style="font-size:12px;line-height:1.75;color:var(--cream-dim);">
                  판결문은 먼저 비공개로 생성됩니다. 사건 기록과 양측 주장을 읽은 뒤 <strong style="color:var(--cream);">원고 승·피고 승·쌍방 과실</strong> 중 하나를 최초 1회 선택하면 AI 판결이 열립니다. 그 후 원하는 경우에만 공개 판결기록으로 전환할 수 있습니다.
                </div>
              </div>
            </div>
          </div>

          <div class="disclaimer" style="margin-bottom:24px;" id="submit-disclaimer">
            <strong>⚠️ 접수 전 확인사항</strong><br>
            · 하루 접수 한도: ${submissionLimitText(defaults)}<br>
            · 재접수 대기: <strong>${defaults.cooldownSec}초</strong><br>
            · 접수 원문은 작성자 본인에게만 공개하는 것을 원칙으로 합니다<br>
            · 실제 분쟁 해결이 아닌 AI 오락 콘텐츠이며 법적 효력이 없습니다
          </div>

          <button type="submit" class="btn btn-primary" id="submit-btn">사건 접수하고 AI 재판 시작</button>
        </form>
      </div>
    </div>`;

  // Update disclaimer once real settings arrive (non-blocking)
  settingsPromise.then(settings => {
    const el = container.querySelector('#submit-disclaimer');
    if (el) el.innerHTML = `<strong>⚠️ 접수 전 확인사항</strong><br>· 하루 접수 한도: ${submissionLimitText(settings)}<br>· 재접수 대기: <strong>${settings.cooldownSec}초</strong><br>· 접수 원문은 작성자 본인에게만 공개하는 것을 원칙으로 합니다<br>· 실제 분쟁 해결이 아닌 AI 오락 콘텐츠이며 법적 효력이 없습니다`;
  }).catch(() => {});

  const descInput = container.querySelector('#case-desc');
  const counter = container.querySelector('#desc-count');
  descInput?.addEventListener('input', () => {
    if (counter) counter.textContent = String(descInput.value.length);
  });

  container.querySelectorAll('.example-case-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const example = EXAMPLE_CASES[Number(chip.dataset.idx)];
      if (descInput && example) {
        descInput.value = example.text;
        if (counter) counter.textContent = String(example.text.length);
        descInput.focus();
      }
    });
  });

  const CHIP_SEL = 'padding:8px 13px;border-radius:20px;border:1.5px solid rgba(201,168,76,.8);background:rgba(201,168,76,.2);color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;';
  const CHIP_OFF = 'padding:8px 13px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--cream-dim);font-size:13px;font-weight:700;cursor:pointer;';
  const pickerEl = container.querySelector('#judge-picker');
  if (pickerEl) {
    pickerEl.addEventListener('click', event => {
      const chip = event.target.closest('.judge-chip');
      if (!chip) return;
      selectedJudge = chip.dataset.judge;
      pickerEl.querySelectorAll('.judge-chip').forEach(c => {
        const sel = c.dataset.judge === selectedJudge;
        c.setAttribute('aria-pressed', String(sel));
        c.style.cssText = sel ? CHIP_SEL : CHIP_OFF;
      });
    });
  }

  const grievanceSlider = container.querySelector('#grievance-slider');
  const grievanceValueEl = container.querySelector('#grievance-value');
  if (grievanceSlider) {
    grievanceSlider.addEventListener('input', () => {
      selectedGrievance = Number(grievanceSlider.value);
      if (grievanceValueEl) grievanceValueEl.textContent = String(selectedGrievance);
      grievanceSlider.setAttribute('aria-valuenow', String(selectedGrievance));
    });
  }

  container.querySelector('#submit-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const desc = descInput?.value.trim() || '';

    if (desc.length < 10) {
      descInput?.focus();
      showToast('사건 내용을 조금 더 자세히 적어주세요.', 'error');
      return;
    }

    if (isTooSerious(desc)) {
      await showSeriousModal();
      return;
    }

    const button = container.querySelector('#submit-btn');
    if (!button || button.disabled) return;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = '사건 접수 중...';

    try {
      const submitCase = httpsCallable(functions, 'submitCase');
      const response = await submitCase({
        caseDescription: desc,
        isPublic: false,
        judgeType: selectedJudge,
        grievanceIndex: selectedGrievance
      });
      const caseId = response.data?.caseId;
      if (!caseId) throw new Error('사건번호를 받지 못했습니다.');
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (error) {
      console.error('case submission failed:', error);
      showToast(String(error?.message || '접수 중 오류가 발생했습니다.').replace('FirebaseError: ', ''), 'error');
      button.disabled = false;
      button.textContent = oldText;
    }
  });
}
