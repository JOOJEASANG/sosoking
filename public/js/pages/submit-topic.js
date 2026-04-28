import { db, functions, trackEvent } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

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
        <span class="logo">⚖️ 사건 등록</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="submit-topic-tip">
          💡 억울한 사건을 등록하면 <strong>바로 공개</strong>됩니다.<br>
          등록 후 링크를 친구에게 보내 즉시 재판을 시작하세요!<br>
          <strong>양쪽 입장이 팽팽해야 좋은 재판이 됩니다!</strong>
        </div>
        <form id="topic-form">
          <div class="form-group">
            <label class="form-label">사건명 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-title" class="form-input" maxlength="30" placeholder="예: 치킨 마지막 조각 선취 사건" required>
            <div class="char-counter"><span id="c-title">0</span>/30</div>
          </div>
          <div class="form-group">
            <label class="form-label">한 줄 요약 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-summary" class="form-input" maxlength="60" placeholder="예: 먼저 집으면 임자 vs 눈치가 예의다" required>
            <div class="char-counter"><span id="c-summary">0</span>/60</div>
          </div>
          <div class="form-group">
            <label class="form-label">원고 측 주장 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-plaintiff" class="form-input" maxlength="100" placeholder="예: 마지막 조각은 눈치 봐야 한다" required>
            <div class="char-counter"><span id="c-plaintiff">0</span>/100</div>
          </div>
          <div class="form-group">
            <label class="form-label">피고 측 주장 <span style="color:var(--red)">*</span></label>
            <input type="text" id="t-defendant" class="form-input" maxlength="100" placeholder="예: 테이블 위 음식은 먼저 집는 사람 것" required>
            <div class="char-counter"><span id="c-defendant">0</span>/100</div>
          </div>
          <div class="form-group">
            <label class="form-label">카테고리</label>
            <select id="t-category" class="form-input" style="cursor:pointer;">
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            · 개인정보, 특정인 비방 내용은 등록 불가<br>
            · 등록 즉시 공개 — 친구에게 링크를 보내 바로 재판 시작 가능<br>
            · 양쪽이 다 억울한 주제일수록 좋은 재판이 됩니다
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

  document.getElementById('topic-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '등록 중...';

    try {
      const submitTopicFn = httpsCallable(functions, 'submitTopic');
      const result = await submitTopicFn({
        title: document.getElementById('t-title').value.trim(),
        summary: document.getElementById('t-summary').value.trim(),
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

function showSuccessScreen(container, topicId) {
  const link = topicId ? `${location.origin}/#/topic/${topicId}` : null;

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/topics" class="back-btn">‹</a>
        <span class="logo">⚖️ 사건 등록</span>
      </div>
      <div class="container" style="padding-top:56px;padding-bottom:80px;text-align:center;">
        <div style="font-size:72px;line-height:1;margin-bottom:20px;animation:crownBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both;">⚖️</div>
        <h2 style="font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--court);margin-bottom:10px;">사건 등록 완료!</h2>
        <p style="font-size:14px;color:var(--text-dim);line-height:1.8;margin-bottom:36px;">
          지금 바로 공개됐습니다.<br>
          친구에게 링크를 보내고 재판을 시작하세요!
        </p>

        ${topicId ? `
          <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;margin:0 auto 28px;">
            <a href="#/topic/${topicId}" class="btn btn-primary" style="font-size:16px;">⚖️ 재판 바로 시작하기</a>
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
      showToast('링크가 복사되었습니다! 친구에게 보내세요 😊', 'success');
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
