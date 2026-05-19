import { auth, db } from './firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function getPageContext() {
  const hash = window.location.hash || '#/';
  return {
    hash,
    path: location.pathname,
    url: `${location.origin}${location.pathname}${hash}`,
    title: document.title || '소소킹',
  };
}

function ensureButton() {
  if (document.getElementById('feedback-open-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'feedback-open-btn';
  btn.type = 'button';
  btn.className = 'feedback-open-btn';
  btn.innerHTML = `<span class="feedback-open-btn__icon">💬</span><span class="feedback-open-btn__text">의견·버그</span>`;
  btn.addEventListener('click', openFeedbackModal);
  document.body.appendChild(btn);
}

function openFeedbackModal() {
  if (!auth.currentUser) {
    toast.warn('로그인 후 의견이나 버그를 보낼 수 있어요.');
    navigate('/login');
    return;
  }

  document.getElementById('feedback-modal')?.remove();
  const page = getPageContext();
  const overlay = document.createElement('div');
  overlay.id = 'feedback-modal';
  overlay.className = 'feedback-modal';
  overlay.innerHTML = `
    <div class="feedback-modal__backdrop"></div>
    <div class="feedback-modal__panel" role="dialog" aria-modal="true" aria-label="의견 및 버그 신고">
      <div class="feedback-modal__header">
        <div>
          <div class="feedback-modal__eyebrow">소소킹 제작중</div>
          <div class="feedback-modal__title">의견 · 버그 신고</div>
        </div>
        <button type="button" class="feedback-modal__close" id="feedback-close" aria-label="닫기">✕</button>
      </div>
      <div class="feedback-modal__body">
        <div class="feedback-type-tabs" role="tablist">
          <label class="feedback-type-tab active"><input type="radio" name="feedback-type" value="bug" checked><span>🐞 버그</span></label>
          <label class="feedback-type-tab"><input type="radio" name="feedback-type" value="opinion"><span>💡 의견</span></label>
          <label class="feedback-type-tab"><input type="radio" name="feedback-type" value="feature"><span>✨ 기능제안</span></label>
        </div>

        <div class="form-group">
          <label class="form-label">제목 <span class="required">*</span></label>
          <input id="feedback-title" class="form-input" maxlength="80" placeholder="예: 모바일에서 작명소 버튼이 안 눌려요">
        </div>
        <div class="form-group">
          <label class="form-label">내용 <span class="required">*</span></label>
          <textarea id="feedback-message" class="form-textarea" rows="6" maxlength="1000" placeholder="어떤 화면에서 어떤 문제가 있었는지 최대한 자세히 적어주세요."></textarea>
          <div class="form-hint">현재 페이지 주소, 브라우저 정보가 함께 저장됩니다.</div>
        </div>
        <div class="form-group">
          <label class="form-label">답변 받을 연락처 <span style="font-size:11px;color:var(--color-text-muted)">(선택)</span></label>
          <input id="feedback-contact" class="form-input" maxlength="120" placeholder="이메일, 카톡 오픈채팅 등">
        </div>
        <div class="feedback-page-box">
          <div class="feedback-page-box__label">현재 페이지</div>
          <div class="feedback-page-box__url">${esc(page.url)}</div>
        </div>
      </div>
      <div class="feedback-modal__footer">
        <button type="button" class="btn btn--ghost" id="feedback-cancel">취소</button>
        <button type="button" class="btn btn--primary" id="feedback-submit">보내기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#feedback-close')?.addEventListener('click', close);
  overlay.querySelector('#feedback-cancel')?.addEventListener('click', close);
  overlay.querySelector('.feedback-modal__backdrop')?.addEventListener('click', close);
  overlay.querySelectorAll('[name="feedback-type"]').forEach(input => {
    input.addEventListener('change', () => {
      overlay.querySelectorAll('.feedback-type-tab').forEach(label => {
        const radio = label.querySelector('input');
        label.classList.toggle('active', !!radio?.checked);
      });
    });
  });
  overlay.querySelector('#feedback-submit')?.addEventListener('click', () => submitFeedback(overlay));
  setTimeout(() => overlay.querySelector('#feedback-title')?.focus(), 50);
}

async function submitFeedback(overlay) {
  const user = auth.currentUser;
  if (!user) return;
  const type = overlay.querySelector('[name="feedback-type"]:checked')?.value || 'bug';
  const title = overlay.querySelector('#feedback-title')?.value.trim() || '';
  const message = overlay.querySelector('#feedback-message')?.value.trim() || '';
  const contact = overlay.querySelector('#feedback-contact')?.value.trim() || '';
  const btn = overlay.querySelector('#feedback-submit');

  if (!title) { toast.warn('제목을 입력해주세요.'); return; }
  if (!message || message.length < 5) { toast.warn('내용을 5자 이상 입력해주세요.'); return; }

  try {
    btn.disabled = true;
    btn.textContent = '전송 중...';
    await addDoc(collection(db, 'feedback'), {
      type,
      title: title.slice(0, 80),
      message: message.slice(0, 1000),
      contact: contact.slice(0, 120),
      status: 'new',
      page: getPageContext(),
      userAgent: navigator.userAgent || '',
      reporterId: user.uid,
      reporterName: appState.nickname || user.displayName || user.email?.split('@')[0] || '익명',
      reporterEmail: user.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    overlay.remove();
    toast.success('접수됐어요. 확인해볼게요!');
  } catch (error) {
    console.error(error);
    toast.error('전송에 실패했어요. 잠시 후 다시 시도해주세요.');
    btn.disabled = false;
    btn.textContent = '보내기';
  }
}

window.addEventListener('hashchange', () => setTimeout(ensureButton, 100));
setTimeout(ensureButton, 500);
