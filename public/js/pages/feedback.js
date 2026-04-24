import { db, auth } from '../firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';

export function renderFeedback(container) {
  container.innerHTML = `
    <div class="page-header">
      <a href="#/" class="back-btn">←</a>
      <span class="logo">💬 의견 접수</span>
    </div>
    <div class="container" style="padding-top:24px;padding-bottom:120px;">
      <div class="card" style="margin-bottom:20px;padding:16px 18px;">
        <p style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin:0;">
          소소킹 서비스를 더 좋게 만들기 위한 의견을 보내주세요.<br>
          버그 신고, 기능 제안, 칭찬 모두 환영합니다. 🙏
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">유형</label>
        <div class="cat-filter" id="fb-type-filter">
          <button class="cat-pill active" data-cat="버그신고">🐛 버그신고</button>
          <button class="cat-pill" data-cat="기능제안">💡 기능제안</button>
          <button class="cat-pill" data-cat="칭찬">❤️ 칭찬</button>
          <button class="cat-pill" data-cat="기타">💬 기타</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">닉네임 <span class="optional">선택</span></label>
        <input type="text" class="form-input" id="fb-nickname" placeholder="익명으로 전달됩니다" maxlength="20">
      </div>

      <div class="form-group">
        <label class="form-label">의견 내용</label>
        <textarea class="form-textarea" id="fb-content" placeholder="불편하신 점, 개선 아이디어, 칭찬을 자유롭게 적어주세요." style="min-height:160px;"></textarea>
        <div class="char-counter" id="fb-counter">0 / 500</div>
      </div>

      <button class="btn btn-primary" id="fb-submit">의견 보내기</button>

      <p style="text-align:center;font-size:11px;color:var(--cream-dim);margin-top:16px;line-height:1.7;">
        제출된 의견은 서비스 개선에만 활용되며 외부에 공개되지 않습니다.
      </p>
    </div>
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

  container.querySelector('#fb-submit').addEventListener('click', async () => {
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
      showToast('의견을 보내주셔서 감사합니다! 서비스 개선에 반영하겠습니다 🙏', 'success');
      setTimeout(() => { location.hash = '#/'; }, 2000);
    } catch (err) {
      console.error('feedback error:', err);
      showToast('전송 실패. 잠시 후 다시 시도해주세요.', 'error');
      btn.disabled = false;
      btn.textContent = '의견 보내기';
    }
  });
}
