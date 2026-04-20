import { db, auth } from '../firebase.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';

const MAX_TITLE = 50;
const MAX_DESC = 500;

const JUDGES = [
  { id: '엄벌주의형', icon: '👨‍⚖️', desc: '아무리 사소해도 중범죄 수준으로' },
  { id: '감성형', icon: '🥹', desc: '눈물 흘리며 공감 위주 판결' },
  { id: '현실주의형', icon: '🤦', desc: '"그래서 어쩌라고요" 현실 직격' },
  { id: '과몰입형', icon: '🔥', desc: '역사에 남을 대형 사건 취급' },
  { id: '피곤형', icon: '😴', desc: '빨리 끝내고 싶은 번아웃 판사' },
  { id: '논리집착형', icon: '🧮', desc: '모든 걸 수치화하는 논리 괴물' },
  { id: '드립형', icon: '🎭', desc: '진지한 척 드립 치는 유머 판사' }
];

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
            <label class="form-label">담당 판사 선택 <span class="optional">선택 안 하면 랜덤 배정</span></label>
            <div class="judge-grid" id="judge-grid">
              <div class="judge-option active" data-judge="">
                <span style="font-size:22px;">🎲</span>
                <div class="judge-option-name">랜덤 배정</div>
                <div class="judge-option-desc">운명에 맡기기</div>
              </div>
              ${JUDGES.map(j => `
                <div class="judge-option" data-judge="${j.id}">
                  <span style="font-size:22px;">${j.icon}</span>
                  <div class="judge-option-name">${j.id}</div>
                  <div class="judge-option-desc">${j.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <hr class="divider">
          <div class="form-group">
            <label class="form-label">원하는 판결 <span class="optional">선택</span></label>
            <input type="text" id="desired-verdict" class="form-input" maxlength="100" placeholder="예: 사과를 받고 싶습니다">
          </div>
          <div class="disclaimer" style="margin-bottom:24px;">
            <strong>⚠️ 필독 — 접수 전 확인사항</strong><br>
            · 실명·연락처·주민번호 등 개인정보 입력 절대 금지<br>
            · 타인의 명예를 훼손하는 내용 접수 불가<br>
            · 본 서비스는 AI 기반 <strong>오락 목적</strong>이며, 판결에는 어떠한 <strong>법적 효력이 없습니다</strong><br>
            · 생성된 판결문은 실제 법률 자문이 아닙니다
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">⚖️ 억울함 공식 접수하기</button>
        </form>
      </div>
    </div>
  `;

  let selectedJudge = '';

  const setActive = (activeOpt) => {
    document.querySelectorAll('#judge-grid .judge-option').forEach(el => el.classList.remove('active'));
    activeOpt.classList.add('active');
  };

  // 초기 랜덤 버튼 활성화
  const firstOpt = document.querySelector('#judge-grid .judge-option');
  if (firstOpt) setActive(firstOpt);

  document.getElementById('judge-grid').addEventListener('click', (e) => {
    const opt = e.target.closest('.judge-option');
    if (!opt) return;
    setActive(opt);
    selectedJudge = opt.dataset.judge;
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
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '접수 중...';

    const user = auth.currentUser;
    if (!user) {
      showToast('인증 오류. 새로고침 후 다시 시도해주세요.', 'error');
      btn.disabled = false; btn.innerHTML = '⚖️ 억울함 공식 접수하기'; return;
    }

    const today = new Date().toISOString().split('T')[0];
    const limitRef = doc(db, 'rate_limits', user.uid);
    const limitSnap = await getDoc(limitRef);

    if (limitSnap.exists()) {
      const d = limitSnap.data();
      if (d.date === today && d.count >= 3) {
        showToast('오늘 접수 한도(3건)를 초과했습니다.', 'error');
        btn.disabled = false; btn.innerHTML = '⚖️ 억울함 공식 접수하기'; return;
      }
      if (d.lastSubmittedAt) {
        const last = d.lastSubmittedAt.toDate ? d.lastSubmittedAt.toDate() : new Date(d.lastSubmittedAt);
        const diff = (Date.now() - last.getTime()) / 1000;
        if (diff < 45) {
          showToast(`${Math.ceil(45 - diff)}초 후에 다시 접수할 수 있습니다.`, 'error');
          btn.disabled = false; btn.innerHTML = '⚖️ 억울함 공식 접수하기'; return;
        }
      }
    }

    const title = document.getElementById('case-title').value.trim();
    const desc = document.getElementById('case-desc').value.trim();
    const grievance = parseInt(document.getElementById('grievance').value);
    const desired = document.getElementById('desired-verdict').value.trim();
    const caseId = `${user.uid}_${Date.now()}`;

    try {
      await setDoc(doc(db, 'cases', caseId), {
        userId: user.uid, caseTitle: title, caseDescription: desc,
        grievanceIndex: grievance, nickname: '익명', desiredVerdict: desired,
        selectedJudge: selectedJudge || '',
        status: 'pending', isPublic: false, reportCount: 0, createdAt: serverTimestamp()
      });
      const prev = limitSnap.exists() && limitSnap.data().date === today ? limitSnap.data().count : 0;
      await setDoc(limitRef, { date: today, count: prev + 1, lastSubmittedAt: new Date() });
      location.hash = `#/trial/${encodeURIComponent(caseId)}`;
    } catch (err) {
      console.error(err);
      showToast('접수 중 오류가 발생했습니다.', 'error');
      btn.disabled = false; btn.innerHTML = '⚖️ 억울함 공식 접수하기';
    }
  });
}
