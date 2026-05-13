import { db, auth } from '../firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';
import { injectPredictStyle } from './predict-home.js';

export function renderFeedback(container) {
  injectPredictStyle();
  injectFeedbackStyle();
  container.innerHTML = `
    <main class="predict-app simple-page soso-doc-page feedback-page">
      <section class="doc-hero feedback-hero">
        <a href="#/" class="back-link">‹</a>
        <div class="doc-hero-copy">
          <img src="/logo.svg" alt="소소킹">
          <div><span>FEEDBACK</span><h1>의견접수</h1><p>버그 신고, 기능 제안, 운영 아이디어를 보내주세요. 제출된 의견은 서비스 개선에만 활용됩니다.</p></div>
        </div>
        <b>💬</b>
      </section>

      <section class="feedback-shell">
        <div class="feedback-info-card">
          <b>이런 의견을 보내주세요</b>
          <div><span>🐛</span><p>화면 깨짐, 저장 실패, 로그인 문제</p></div>
          <div><span>💡</span><p>예측판·소소피드 기능 아이디어</p></div>
          <div><span>🎨</span><p>디자인, 문구, 이용 흐름 개선점</p></div>
        </div>
        <form class="feedback-card" id="feedback-form">
          <label class="form-label">유형</label>
          <div class="cat-filter" id="fb-type-filter">
            <button type="button" class="cat-pill active" data-cat="버그신고">🐛 버그신고</button>
            <button type="button" class="cat-pill" data-cat="기능제안">💡 기능제안</button>
            <button type="button" class="cat-pill" data-cat="디자인의견">🎨 디자인의견</button>
            <button type="button" class="cat-pill" data-cat="기타">💬 기타</button>
          </div>

          <label class="form-label">닉네임 <span class="optional">선택</span></label>
          <input type="text" class="form-input" id="fb-nickname" placeholder="익명으로 전달됩니다" maxlength="20">

          <label class="form-label">의견 내용</label>
          <textarea class="form-textarea" id="fb-content" placeholder="불편한 점, 개선 아이디어, 칭찬을 자유롭게 적어주세요." maxlength="500"></textarea>
          <div class="char-counter" id="fb-counter">0 / 500</div>

          <button class="feedback-submit" id="fb-submit" type="submit">의견 보내기</button>
          <p class="feedback-note">1시간에 1회 제출할 수 있습니다. 개인정보는 입력하지 마세요.</p>
        </form>
      </section>
    </main>
  `;

  let category = '버그신고';
  const pills = container.querySelectorAll('#fb-type-filter .cat-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      category = pill.dataset.cat;
    });
  });

  const textarea = container.querySelector('#fb-content');
  const counter = container.querySelector('#fb-counter');
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 500`;
    counter.classList.toggle('over', len > 500);
  });

  container.querySelector('#feedback-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content) { showToast('의견 내용을 입력해주세요.', 'error'); return; }
    if (content.length > 500) { showToast('500자 이내로 입력해주세요.', 'error'); return; }

    const ratioKey = 'fb_last_sent';
    const last = parseInt(localStorage.getItem(ratioKey) || '0');
    if (Date.now() - last < 3_600_000) {
      showToast('1시간에 1회만 의견을 보낼 수 있습니다.', 'error');
      return;
    }

    const btn = container.querySelector('#fb-submit');
    btn.disabled = true;
    btn.textContent = '전송 중...';

    try {
      await addDoc(collection(db, 'feedback'), {
        category,
        content,
        nickname: container.querySelector('#fb-nickname').value.trim() || '익명',
        userId: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        status: 'new'
      });
      localStorage.setItem(ratioKey, String(Date.now()));
      showToast('의견을 보내주셔서 감사합니다. 서비스 개선에 반영하겠습니다.', 'success');
      setTimeout(() => { location.hash = '#/'; }, 1600);
    } catch (err) {
      console.error('feedback error:', err);
      showToast('전송 실패. 잠시 후 다시 시도해주세요.', 'error');
      btn.disabled = false;
      btn.textContent = '의견 보내기';
    }
  });
}

function injectFeedbackStyle() {
  if (document.getElementById('sosoking-feedback-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-feedback-style';
  style.textContent = `
    .feedback-shell{max-width:880px;margin:0 auto;display:grid;grid-template-columns:300px 1fr;gap:14px;align-items:start}.feedback-info-card,.feedback-card{border:1px solid rgba(79,124,255,.14);border-radius:30px;padding:20px;background:rgba(255,255,255,.86);box-shadow:0 18px 54px rgba(55,90,170,.10)}.feedback-info-card b{display:block;font-size:18px;margin-bottom:14px}.feedback-info-card div{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:18px;background:rgba(79,124,255,.05);margin-top:8px}.feedback-info-card span{font-size:20px}.feedback-info-card p{margin:0;color:var(--predict-muted);font-size:13px;line-height:1.55}.feedback-card{display:grid;gap:10px}.feedback-card .form-label{margin-top:6px;color:var(--predict-muted);font-size:12px;font-weight:1000}.cat-filter{display:flex;flex-wrap:wrap;gap:7px}.cat-pill{border:1px solid rgba(79,124,255,.15);border-radius:999px;padding:9px 11px;background:rgba(79,124,255,.06);color:var(--predict-ink);font-weight:900;cursor:pointer}.cat-pill.active{background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;box-shadow:0 10px 24px rgba(79,124,255,.22)}.form-input,.form-textarea{width:100%;box-sizing:border-box;border:1px solid rgba(79,124,255,.14);border-radius:17px;padding:13px;background:var(--predict-bg);color:var(--predict-ink);font-family:inherit}.form-textarea{min-height:160px;resize:vertical}.char-counter{text-align:right;color:var(--predict-muted);font-size:12px;font-weight:900}.char-counter.over{color:var(--predict-hot)}.feedback-submit{border:0;border-radius:18px;padding:15px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000;box-shadow:0 12px 30px rgba(79,124,255,.22)}.feedback-note{text-align:center;margin:2px 0 0;color:var(--predict-muted);font-size:12px;line-height:1.6}@media(max-width:760px){.feedback-shell{grid-template-columns:1fr}.feedback-info-card,.feedback-card{padding:18px;border-radius:26px}}[data-theme="dark"] .feedback-info-card,[data-theme="dark"] .feedback-card{background:rgba(16,23,34,.88);box-shadow:none}
  `;
  document.head.appendChild(style);
}
