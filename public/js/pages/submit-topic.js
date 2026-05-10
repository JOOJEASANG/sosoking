import { db, functions, trackEvent } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

const CASE_SUGGESTIONS = [
  {
    title: '카톡 읽씹 무죄 사건',
    summary: '읽었으면 바로 답해야 한다 vs 답장은 마음의 준비가 필요하다',
    plaintiffPosition: '읽었으면 바로 답장하는 게 기본 예의입니다',
    defendantPosition: '읽었다고 바로 답할 의무까지 생기는 건 아닙니다',
    category: '카톡',
  },
  {
    title: '치킨 마지막 조각 선취 사건',
    summary: '마지막 조각은 나눠야 한다 vs 먼저 집은 사람이 임자다',
    plaintiffPosition: '마지막 조각은 눈치 보고 공평하게 나눠야 합니다',
    defendantPosition: '먹고 싶으면 먼저 집었어야 합니다',
    category: '음식',
  },
  {
    title: '더치페이 100원 단위 정산 사건',
    summary: '100원까지 정산해야 한다 vs 그 정도는 넘어가야 한다',
    plaintiffPosition: '금액이 작아도 정확한 정산이 깔끔합니다',
    defendantPosition: '100원 단위까지 따지면 인간미가 없습니다',
    category: '정산',
  },
  {
    title: '약속 시간 5분 지각 유죄 사건',
    summary: '5분도 지각이다 vs 5분은 인간적으로 봐줘야 한다',
    plaintiffPosition: '5분이라도 늦었으면 명백한 지각입니다',
    defendantPosition: '5분은 생활 오차 범위 안에 들어갑니다',
    category: '친구',
  },
  {
    title: '냉장고 음료 무단 개봉 사건',
    summary: '남의 음료를 마시면 안 된다 vs 집 냉장고는 공유 구역이다',
    plaintiffPosition: '이름이 없더라도 남이 산 음료는 허락받아야 합니다',
    defendantPosition: '공용 냉장고에 있으면 어느 정도 공유로 봐야 합니다',
    category: '생활',
  },
  {
    title: '데이트 메뉴 결정 회피 사건',
    summary: '아무거나라고 해놓고 불평하면 안 된다 vs 진짜 아무거나는 아니다',
    plaintiffPosition: '아무거나라고 했으면 선택 결과를 받아들여야 합니다',
    defendantPosition: '아무거나에도 최소한의 상식과 분위기는 필요합니다',
    category: '연애',
  },
  {
    title: '단톡방 공지 미확인 사건',
    summary: '공지 안 읽은 사람이 잘못이다 vs 중요한 건 따로 말해줘야 한다',
    plaintiffPosition: '공지로 올렸으면 확인 책임은 각자에게 있습니다',
    defendantPosition: '정말 중요한 일이라면 직접 한 번 더 알려줘야 합니다',
    category: '카톡',
  },
  {
    title: '사무실 에어컨 온도 전쟁 사건',
    summary: '추운 사람이 맞춰야 한다 vs 더운 사람이 더 힘들다',
    plaintiffPosition: '추운 사람은 겉옷을 입을 수 있으니 온도를 낮춰야 합니다',
    defendantPosition: '사무실이 냉장고도 아닌데 너무 낮추면 안 됩니다',
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
        <span class="logo">✏️ 사건 등록</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="submit-topic-tip">
          💡 생활 속 억울한 일을 <strong>사건</strong>으로 등록하면 바로 공개됩니다.<br>
          친구에게 링크를 보내 원고·피고로 재판을 시작하세요.<br>
          <strong>양쪽 입장이 팽팽해야 더 재밌는 판결이 나옵니다!</strong>
        </div>
        <div style="margin-bottom:18px;padding:14px 16px;border:1.5px solid rgba(201,168,76,0.28);border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,0.10),rgba(255,255,255,0.03));">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:12px;font-weight:900;color:var(--gold);letter-spacing:.06em;margin-bottom:3px;">🤖 자동 사건 추천</div>
              <div style="font-size:12px;color:var(--cream-dim);line-height:1.5;">토론 주제가 아니라 생활법정용 사건 형식으로 채워집니다.</div>
            </div>
            <button type="button" id="auto-case-btn" style="flex-shrink:0;border:none;border-radius:12px;padding:11px 13px;background:var(--gold);color:#0d1117;font-size:12px;font-weight:900;cursor:pointer;">추천 받기</button>
          </div>
        </div>
        <form id="topic-form">
          <div class="form-group">
            <label class="form-label">사건명 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-title" class="form-input" maxlength="30" placeholder="예: 치킨 마지막 조각 선취 사건" required>
            <div class="char-counter"><span id="c-title">0</span>/30</div>
          </div>
          <div class="form-group">
            <label class="form-label">사건 요약 <span style="font-size:11px;color:var(--cream-dim);font-weight:400;">(선택 · 비우면 자동 생성)</span></label>
            <input type="text" id="t-summary" class="form-input" maxlength="60" placeholder="예: 먼저 집은 사람이 임자다 vs 나눠 먹어야 한다">
            <div class="char-counter"><span id="c-summary">0</span>/60</div>
          </div>
          <div class="form-group">
            <label class="form-label">🔴 원고 입장 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-plaintiff" class="form-input" maxlength="100" placeholder="예: 마지막 조각은 눈치 보고 나눠야 한다" required>
            <div class="char-counter"><span id="c-plaintiff">0</span>/100</div>
          </div>
          <div class="form-group">
            <label class="form-label">🔵 피고 입장 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-defendant" class="form-input" maxlength="100" placeholder="예: 먼저 집은 사람이 임자다" required>
            <div class="char-counter"><span id="c-defendant">0</span>/100</div>
          </div>
          <div class="form-group">
            <label class="form-label">카테고리</label>
            <select id="t-category" class="form-input" style="cursor:pointer;">
              ${categories.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            · 개인정보, 특정인 비방 내용은 등록 불가<br>
            · 등록 즉시 공개 — 친구에게 링크를 보내 바로 재판 시작 가능<br>
            · 양쪽 모두 나름 억울한 사건일수록 좋은 판결이 나옵니다
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">⚖️ 사건 등록하기</button>
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
    showToast('생활법정 사건 형식으로 자동 추천했습니다', 'success');
  });

  document.getElementById('topic-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '등록 중...';

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
      showToast(err.message || '등록 실패', 'error');
      btn.disabled = false;
      btn.textContent = '⚖️ 사건 등록하기';
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
        <span class="logo">✏️ 사건 등록</span>
      </div>
      <div class="container" style="padding-top:56px;padding-bottom:80px;text-align:center;">
        <div style="font-size:72px;line-height:1;margin-bottom:20px;animation:gavelDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;">⚖️</div>
        <h2 style="font-family:var(--font-serif);font-size:24px;font-weight:700;color:var(--gold);margin-bottom:10px;">사건 등록 완료!</h2>
        <p style="font-size:14px;color:var(--cream-dim);line-height:1.8;margin-bottom:36px;">
          지금 바로 공개됐습니다.<br>
          친구에게 링크를 보내고 재판을 시작하세요!
        </p>

        ${topicId ? `
          <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;margin:0 auto 28px;">
            <a href="#/topic/${topicId}" class="btn btn-primary" style="font-size:16px;">🔥 재판 바로 시작하기</a>
            <button id="copy-link-btn" class="btn btn-secondary">🔗 링크 복사해서 친구에게 보내기</button>
          </div>
          <div id="link-box" style="display:none;background:rgba(255,255,255,0.04);border:1.5px dashed rgba(201,168,76,0.4);border-radius:10px;padding:12px 16px;margin:0 auto 20px;max-width:320px;word-break:break-all;font-size:12px;color:var(--cream-dim);font-family:monospace;">${link}</div>
          <button id="new-topic-btn" style="background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;text-decoration:underline;padding:4px;">
            + 다른 사건도 등록하기
          </button>
        ` : `
          <a href="#/topics" class="btn btn-secondary" style="max-width:240px;margin:0 auto;">사건 목록 보기</a>
        `}
      </div>
    </div>
  `;

  if (!topicId || !link) return;

  document.getElementById('copy-link-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast('링크가 복사되었습니다! 친구에게 보내세요', 'success');
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
