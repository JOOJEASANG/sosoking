import { db, functions } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderSubmitTopic(container) {
  let categories = [];
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
    categories = snap.docs.map(d => d.data().name);
  } catch { categories = ['카톡', '연애', '음식', '정산', '직장', '생활', '친구', '기타']; }

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/topics" class="back-btn">‹</a>
        <span class="logo">✏️ 주제 등록</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="submit-topic-tip">
          💡 누구나 공감할 수 있는 일상 갈등 주제를 등록해주세요.<br>
          검토 후 공개 사건으로 전환됩니다.<br>
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
            · 등록 후 관리자 검토 완료 시 공개 전환<br>
            · 양쪽이 다 억울한 주제일수록 좋은 재판이 됩니다
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">✏️ 주제 등록 신청</button>
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
      const submitTopic = httpsCallable(functions, 'submitTopic');
      await submitTopic({
        title: document.getElementById('t-title').value.trim(),
        summary: document.getElementById('t-summary').value.trim(),
        plaintiffPosition: document.getElementById('t-plaintiff').value.trim(),
        defendantPosition: document.getElementById('t-defendant').value.trim(),
        category: document.getElementById('t-category').value,
      });
      showToast('등록 신청 완료! 검토 후 공개됩니다.', 'success');
      document.getElementById('topic-form').reset();
      counters.forEach(([, countId]) => { document.getElementById(countId).textContent = '0'; });
    } catch (err) {
      showToast(err.message || '등록 실패', 'error');
    }

    btn.disabled = false;
    btn.textContent = '✏️ 주제 등록 신청';
  });
}
