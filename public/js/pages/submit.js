import { db, auth } from '../firebase.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';

const MAX_TITLE = 50;
const MAX_DESC = 500;

export function renderSubmit(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">사건 접수서</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:60px;">
        <p style="font-size:13px;color:var(--cream-dim);margin-bottom:28px;">억울한 사건을 접수하면 AI 판사가 배정됩니다.</p>
        <form id="submit-form">
          <div class="form-group">
            <label class="form-label">사건명 <span style="color:var(--red)">*</span></label>
            <input type="text" id="case-title" class="form-input" maxlength="${MAX_TITLE}" placeholder="예: 라면 국물 무단 음용 사건" required>
            <div class="char-counter"><span id="title-count">0</span>/${MAX_TITLE}</div>
          </div>
          <div class="form-group">
            <label class="form-label">사건 경위 <span style="color:var(--red)">*</span></label>
            <textarea id="case-desc" class="form-textarea" maxlength="${MAX_DESC}" placeholder="어떤 일이 있었는지 상세히 작성해주세요." required></textarea>
            <div class="char-counter"><span id="desc-count">0</span>/${MAX_DESC}</div>
          </div>
          <div class="form-group">
            <label class="form-label">억울 지수</label>
            <div class="slider-value"><span id="grievance-val">5</span><span style="font-size:14px;color:var(--cream-dim);"> / 10</span></div>
            <input type="range" id="grievance" class="form-range" min="1" max="10" value="5">
            <div class="slider-labels"><span>🙂 약간 억울</span><span>😤 극도로 억울</span></div>
          </div>
          <hr class="divider">
          <div class="form-group">
            <label class="form-label">닉네임 <span class="optional">선택</span></label>
            <input type="text" id="nickname" class="form-input" maxlength="20" placeholder="비워두면 익명으로 처리됩니다">
          </div>
          <div class="form-group">
            <label class="form-label">원하는 판결 <span class="optional">선택</span></label>
            <input type="text" id="desired-verdict" class="form-input" maxlength="100" placeholder="예: 사과를 받고 싶습니다">
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            <strong>⚠️ 개인정보 입력 금지</strong><br>
            실명, 연락처 등 개인정보는 절대 입력하지 마세요.
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">⚖️ 사건 접수하기</button>
        </form>
      </div>
    </div>
  `;

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
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '접수 중...';

    const user = auth.currentUser;
    if (!user) {
      showToast('인증 오류. 새로고침 후 다시 시도해주세요.', 'error');
      btn.disabled = false; btn.innerHTML = '⚖️ 사건 접수하기'; return;
    }

    const today = new Date().toISOString().split('T')[0];
    const limitRef = doc(db, 'rate_limits', user.uid);
    const limitSnap = await getDoc(limitRef);

    if (limitSnap.exists()) {
      const d = limitSnap.data();
      if (d.date === today && d.count >= 3) {
        showToast('오늘 접수 한도(3건)를 초과했습니다.', 'error');
        btn.disabled = false; btn.innerHTML = '⚖️ 사건 접수하기'; return;
      }
      if (d.lastSubmittedAt) {
        const last = d.lastSubmittedAt.toDate ? d.lastSubmittedAt.toDate() : new Date(d.lastSubmittedAt);
        const diff = (Date.now() - last.getTime()) / 1000;
        if (diff < 45) {
          showToast(`${Math.ceil(45 - diff)}초 후에 다시 접수할 수 있습니다.`, 'error');
          btn.disabled = false; btn.innerHTML = '⚖️ 사건 접수하기'; return;
        }
      }
    }

    const title = document.getElementById('case-title').value.trim();
    const desc = document.getElementById('case-desc').value.trim();
    const grievance = parseInt(document.getElementById('grievance').value);
    const nickname = document.getElementById('nickname').value.trim() || '익명';
    const desired = document.getElementById('desired-verdict').value.trim();
    const caseId = `${user.uid}_${Date.now()}`;

    try {
      await setDoc(doc(db, 'cases', caseId), {
        userId: user.uid, caseTitle: title, caseDescription: desc,
        grievanceIndex: grievance, nickname, desiredVerdict: desired,
        status: 'pending', isPublic: false, reportCount: 0, createdAt: serverTimestamp()
      });
      const prev = limitSnap.exists() && limitSnap.data().date === today ? limitSnap.data().count : 0;
      await setDoc(limitRef, { date: today, count: prev + 1, lastSubmittedAt: new Date() });
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (err) {
      console.error(err);
      showToast('접수 중 오류가 발생했습니다.', 'error');
      btn.disabled = false; btn.innerHTML = '⚖️ 사건 접수하기';
    }
  });
}
