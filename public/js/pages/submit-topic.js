import { db, functions, trackEvent } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

const CASE_SUGGESTIONS = [
  {
    title: '카톡 답장 지연 사건',
    summary: '읽은 뒤 바로 답하지 않아 서운함이 생긴 사건',
    plaintiffPosition: '읽었으면 최소한 확인했다는 답장은 해줘야 했습니다',
    defendantPosition: '읽었다고 바로 답할 수 있는 상황은 아니었습니다',
    category: '카톡',
  },
  {
    title: '치킨 마지막 조각 사건',
    summary: '마지막 조각을 누가 먹어야 하는지 다툰 사건',
    plaintiffPosition: '마지막 조각은 눈치 보고 공평하게 나눴어야 합니다',
    defendantPosition: '먼저 집은 사람이 먹는 게 자연스러운 상황이었습니다',
    category: '음식',
  },
  {
    title: '더치페이 100원 정산 사건',
    summary: '100원 단위 정산을 두고 분위기가 어색해진 사건',
    plaintiffPosition: '금액이 작아도 정확하게 정산하는 게 깔끔합니다',
    defendantPosition: '100원 단위까지 따지면 너무 야박하게 느껴집니다',
    category: '정산',
  },
  {
    title: '약속 5분 지각 사건',
    summary: '5분 지각을 사과해야 하는지 다툰 사건',
    plaintiffPosition: '5분이라도 늦었으면 기다린 사람에게 사과해야 합니다',
    defendantPosition: '5분 정도는 생활 오차 범위로 봐줄 수 있습니다',
    category: '친구',
  },
  {
    title: '냉장고 음료 개봉 사건',
    summary: '냉장고에 있던 음료를 허락 없이 마신 사건',
    plaintiffPosition: '이름이 없더라도 남이 산 음료는 허락받아야 합니다',
    defendantPosition: '공용 냉장고에 있으면 어느 정도 공유로 볼 수 있습니다',
    category: '생활',
  },
  {
    title: '데이트 메뉴 결정 회피 사건',
    summary: '아무거나라고 한 뒤 메뉴에 불만이 생긴 사건',
    plaintiffPosition: '아무거나라고 했으면 선택 결과를 받아들여야 합니다',
    defendantPosition: '아무거나에도 최소한의 분위기와 상식은 필요합니다',
    category: '연애',
  },
  {
    title: '단톡방 공지 미확인 사건',
    summary: '단톡방 공지를 확인하지 않아 문제가 생긴 사건',
    plaintiffPosition: '공지로 올렸으면 각자 확인할 책임이 있습니다',
    defendantPosition: '정말 중요한 내용이면 직접 한 번 더 알려줘야 합니다',
    category: '카톡',
  },
  {
    title: '사무실 에어컨 온도 사건',
    summary: '사무실 에어컨 온도를 두고 불편함이 생긴 사건',
    plaintiffPosition: '더운 사람은 더 이상 해결 방법이 없어 온도를 낮춰야 합니다',
    defendantPosition: '너무 낮은 온도는 추운 사람에게 큰 불편을 줍니다',
    category: '직장',
  },
];

export async function renderSubmitTopic(container) {
  let categories = [];
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
    categories = snap.docs.map(d => d.data().name);
  } catch { categories = ['카톡', '연애', '음식', '정산', '직장', '생활', '친구', '기타']; }

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/topics" class="back-btn">‹</a>
        <span class="logo">📝 사건 접수서</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="submit-topic-tip">
          💡 생활 속 애매한 일을 <strong>사건 접수서</strong>처럼 정리해보세요.<br>
          누가 잘못했는지 단정하기보다, <strong>상황과 양쪽 사정</strong>을 적으면 AI 판사가 판결합니다.<br>
          <strong>가볍고 웃긴 생활 사건일수록 더 재밌는 판결이 나옵니다!</strong>
        </div>
        <div style="margin-bottom:18px;padding:14px 16px;border:1.5px solid rgba(201,168,76,0.28);border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,0.10),rgba(255,255,255,0.03));">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:12px;font-weight:900;color:var(--gold);letter-spacing:.06em;margin-bottom:3px;">🤖 자동 사건 접수서</div>
              <div style="font-size:12px;color:var(--cream-dim);line-height:1.5;">토론 주제가 아니라 사건 상황·문제 제기·상대측 설명으로 채워집니다.</div>
            </div>
            <button type="button" id="auto-case-btn" style="flex-shrink:0;border:none;border-radius:12px;padding:11px 13px;background:var(--gold);color:#0d1117;font-size:12px;font-weight:900;cursor:pointer;">예시 작성</button>
          </div>
        </div>
        <form id="topic-form">
          <div class="form-group">
            <label class="form-label">사건명 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-title" class="form-input" maxlength="30" placeholder="예: 치킨 마지막 조각 사건" required>
            <div class="char-counter"><span id="c-title">0</span>/30</div>
          </div>
          <div class="form-group">
            <label class="form-label">사건 발생 상황 <span style="font-size:11px;color:var(--cream-dim);font-weight:400;">(선택 · 비우면 자동 정리)</span></label>
            <input type="text" id="t-summary" class="form-input" maxlength="60" placeholder="예: 마지막 조각을 허락 없이 먹어 분위기가 어색해진 사건">
            <div class="char-counter"><span id="c-summary">0</span>/60</div>
          </div>
          <div class="form-group">
            <label class="form-label">🔴 문제 제기 내용 <span style="font-size:11px;color:var(--cream-dim);font-weight:400;">(원고 측 진술)</span> <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-plaintiff" class="form-input" maxlength="100" placeholder="예: 마지막 조각은 나눠 먹거나 물어봤어야 합니다" required>
            <div class="char-counter"><span id="c-plaintiff">0</span>/100</div>
          </div>
          <div class="form-group">
            <label class="form-label">🔵 상대측 설명 <span style="font-size:11px;color:var(--cream-dim);font-weight:400;">(피고 측 진술)</span> <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-defendant" class="form-input" maxlength="100" placeholder="예: 아무도 안 먹길래 먹어도 되는 줄 알았습니다" required>
            <div class="char-counter"><span id="c-defendant">0</span>/100</div>
          </div>
          <div class="form-group">
            <label class="form-label">사건 분류</label>
            <select id="t-category" class="form-input" style="cursor:pointer;">
              ${categories.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            · 실제 인물 실명, 연락처, 주소 등 개인정보 입력 금지<br>
            · 피해자/가해자처럼 단정하지 말고 양쪽 사정을 가볍게 적어주세요<br>
            · 접수 즉시 공개 — 친구에게 링크를 보내 바로 생활법정 입장 가능
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">⚖️ 사건 접수하기</button>
        </form>
      </div>
    </div>
  `;

  const counters = [
    ['t-title', 'c-title'],
    ['t-summary', 'c-summary'],
    ['t-plaintiff', 'c-plaintiff'],
    ['t-defendant', 'c-defendant'],
  ];
  counters.forEach(([inputId, countId]) => {
    document.getElementById(inputId)?.addEventListener('input', function () {
      document.getElementById(countId).textContent = this.value.length;
    });
  });

  document.getElementById('auto-case-btn')?.addEventListener('click', () => {
    const item = CASE_SUGGESTIONS[Math.floor(Math.random() * CASE_SUGGESTIONS.length)];
    fillCaseSuggestion(item, categories);
    trackEvent('auto_case_suggestion', { category: item.category });
    showToast('사건 접수서 형식으로 예시를 작성했습니다', 'success');
  });

  document.getElementById('topic-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '접수 중...';

    try {
      const submitTopicFn = httpsCallable(functions, 'submitTopic');
      const summary = document.getElementById('t-summary').value.trim();
      const result = await submitTopicFn({
        title: document.getElementById('t-title').value.trim(),
        ...(summary && { summary }),
        plaintiffPosition: document.getElementById('t-plaintiff').value.trim(),
        defendantPosition: document.getElementById('t-defendant').value.trim(),
        category: document.getElementById('t-category').value,
      });

      const topicId = result.data?.topicId;
      trackEvent('topic_submit', { category: document.getElementById('t-category').value });
      showSuccessScreen(container, topicId);
    } catch (err) {
      showToast(err.message || '접수 실패', 'error');
      btn.disabled = false;
      btn.textContent = '⚖️ 사건 접수하기';
    }
  });
}

function fillCaseSuggestion(item, categories) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('t-title', item.title);
  set('t-summary', item.summary);
  set('t-plaintiff', item.plaintiffPosition);
  set('t-defendant', item.defendantPosition);
  const select = document.getElementById('t-category');
  if (select) {
    select.value = categories.includes(item.category) ? item.category : (categories[0] || '생활');
  }
}

function showSuccessScreen(container, topicId) {
  const link = topicId ? `${location.origin}/#/topic/${topicId}` : null;

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/topics" class="back-btn">‹</a>
        <span class="logo">📝 사건 접수서</span>
      </div>
      <div class="container" style="padding-top:56px;padding-bottom:80px;text-align:center;">
        <div style="font-size:72px;line-height:1;margin-bottom:20px;animation:gavelDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;">⚖️</div>
        <h2 style="font-family:var(--font-serif);font-size:24px;font-weight:700;color:var(--gold);margin-bottom:10px;">사건 접수 완료!</h2>
        <p style="font-size:14px;color:var(--cream-dim);line-height:1.8;margin-bottom:36px;">
          사건 기록이 접수됐습니다.<br>
          생활법정 대기실에서 재판을 시작하세요!
        </p>

        ${topicId ? `
          <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;margin:0 auto 28px;">
            <a href="#/topic/${topicId}" class="btn btn-primary" style="font-size:16px;">⚖️ 생활법정 대기실 입장</a>
            <button id="copy-link-btn" class="btn btn-secondary">🔗 사건 기록 링크 복사</button>
          </div>
          <div id="link-box" style="display:none;background:rgba(255,255,255,0.04);border:1.5px dashed rgba(201,168,76,0.4);border-radius:10px;padding:12px 16px;margin:0 auto 20px;max-width:320px;word-break:break-all;font-size:12px;color:var(--cream-dim);font-family:monospace;">${link}</div>
          <button id="new-topic-btn" style="background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;text-decoration:underline;padding:4px;">
            + 다른 사건도 접수하기
          </button>
        ` : `
          <a href="#/topics" class="btn btn-secondary" style="max-width:240px;margin:0 auto;">사건 게시판 보기</a>
        `}
      </div>
    </div>
  `;

  if (!topicId || !link) return;

  document.getElementById('copy-link-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast('사건 기록 링크가 복사되었습니다', 'success');
      document.getElementById('link-box').style.display = 'block';
    } catch {
      document.getElementById('link-box').style.display = 'block';
      showToast('링크를 직접 복사해주세요', 'info');
    }
  });

  document.getElementById('new-topic-btn')?.addEventListener('click', () => {
    renderSubmitTopic(container);
  });
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function escAttr(s) { return escHtml(s); }
