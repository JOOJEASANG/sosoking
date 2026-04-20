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

const NICK_ADJ = ['억울한','분노한','황당한','지친','당황한','슬픈','안타까운','기막힌','억억억','억울억울'];
const NICK_NOUN = ['직장인','집사','아무개','라면러버','과자지킴이','충전기수호자','리모컨분실자','냉장고파수꾼','에어컨전사','택배대기자','이불킥전문가','눈치없는피해자','읽씹피해자','국물도둑피해자'];

function _randomNickname() {
  const adj = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
  const noun = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  return adj + noun;
}

const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따',
  '이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원',
  '자살','자해','응급','정신과','우울증','공황'
];

function _isTooSerious(text) {
  return SERIOUS_KEYWORDS.some(kw => text.includes(kw));
}

function _showSeriousModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#1a2035;border:2px solid #e74c3c;border-radius:16px;padding:28px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        <div style="font-size:52px;margin-bottom:12px;">😰</div>
        <div style="font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;color:#e74c3c;margin-bottom:10px;">잠깐, 판사님이 당황했습니다</div>
        <p style="font-size:14px;color:rgba(245,240,232,0.7);line-height:1.75;margin-bottom:22px;">
          이 사건은 저희 AI 판사들이<br>
          <strong style="color:#f5f0e8;">감당하기 어려울 수 있어요.</strong><br><br>
          진짜 법적 문제라면 실제 전문가의<br>도움을 받으시는 게 좋습니다.<br>
          <span style="font-size:12px;opacity:0.5;">(저희 판사는 커피나 마시러 가있을게요)</span>
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a href="https://www.lawnb.com" target="_blank" rel="noopener" style="display:block;padding:13px;border-radius:12px;background:rgba(231,76,60,0.15);border:1.5px solid rgba(231,76,60,0.4);color:#e74c3c;font-weight:700;font-size:14px;text-decoration:none;">⚖️ 진짜 법률 상담 찾아보기</a>
          <button id="_serious-confirm" style="padding:13px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(245,240,232,0.6);font-size:13px;cursor:pointer;">🎭 그냥 재미로 접수할게요 (법적 효력 없음 인지)</button>
          <button id="_serious-cancel" style="padding:10px;border-radius:12px;background:none;border:none;color:rgba(245,240,232,0.35);font-size:13px;cursor:pointer;">취소</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_serious-confirm').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#_serious-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

export function renderSubmit(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">사건 접수서</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
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

    const rawTitle = document.getElementById('case-title').value;
    const rawDesc = document.getElementById('case-desc').value;
    if (_isTooSerious(rawTitle + ' ' + rawDesc)) {
      const proceed = await _showSeriousModal();
      if (!proceed) return;
    }

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
        grievanceIndex: grievance, nickname: _randomNickname(), desiredVerdict: desired,
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
