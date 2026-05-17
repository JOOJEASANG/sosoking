import { db, auth, functions } from './firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const callCheckInitial = httpsCallable(functions, 'checkInitialGameAnswer');
const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function isWritePage() {
  return (window.location.hash || '').startsWith('#/write');
}

function isInitialGameForm() {
  return isWritePage() && !!document.getElementById('f-initial-answer');
}

function clean(value, max = 80) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(text) {
  return [...String(text || '').trim()].map(ch => {
    const code = ch.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return ch;
    return INITIALS[Math.floor((code - 0xac00) / 588)] || ch;
  }).join('');
}

function findAcrosticCard() {
  return [...document.querySelectorAll('[data-type="acrostic"]')][0];
}

function patchTypeCard() {
  const card = findAcrosticCard();
  if (!card || card.dataset.initialPatched === '1') return;
  card.dataset.initialPatched = '1';
  card.dataset.type = 'initial_game';
  const icon = card.querySelector('.type-select-card__icon');
  const name = card.querySelector('.type-select-card__name');
  const desc = card.querySelector('.type-select-card__desc');
  if (icon) icon.textContent = '🔤';
  if (name) name.textContent = '초성게임';
  if (desc) desc.textContent = '최대 5글자 정답을 초성으로 맞혀요';
}

function renderInitialGameForm() {
  const fields = document.getElementById('form-fields');
  const title = document.querySelector('.write-step-title');
  if (!fields || fields.dataset.initialGame === '1') return;
  fields.dataset.initialGame = '1';
  if (title) title.textContent = '🔤 초성게임';
  fields.innerHTML = `
    <div class="form-group">
      <label class="form-label">정답 단어 <span class="required">*</span></label>
      <input id="f-initial-answer" class="form-input" placeholder="예: 소소킹" maxlength="5" autocomplete="off">
      <div class="form-hint">2~5글자 · 저장 후 정답은 공개되지 않고 초성만 보여요</div>
    </div>
    <div class="form-group">
      <label class="form-label">자동 초성</label>
      <div id="initial-preview" style="padding:18px;border-radius:14px;background:#F3F4F6;border:1px solid var(--color-border);font-size:30px;font-weight:950;letter-spacing:.12em;text-align:center;color:var(--color-primary)">?</div>
    </div>
    <div class="form-group">
      <label class="form-label">힌트</label>
      <input id="f-initial-hint" class="form-input" placeholder="예: 이 사이트 이름" maxlength="60">
      <div class="form-hint">힌트는 선택사항이에요</div>
    </div>
    <div class="form-group">
      <label class="form-label">안내</label>
      <div style="padding:12px 14px;border-radius:12px;background:#F9FAFB;border:1px solid var(--color-border);font-size:14px;line-height:1.6;color:var(--color-text-secondary)">초성만 보고 정답을 맞히는 게임이에요. 짧고 재밌는 단어로 만들어보세요.</div>
    </div>
    <div class="form-group">
      <label class="form-label">태그</label>
      <input id="f-tags" class="form-input" placeholder="#초성게임, #퀴즈" maxlength="100">
    </div>
  `;
  document.getElementById('f-initial-answer')?.addEventListener('input', updatePreview);
  updatePreview();
}

function updatePreview() {
  const answer = clean(document.getElementById('f-initial-answer')?.value || '', 5);
  const preview = document.getElementById('initial-preview');
  if (preview) preview.textContent = answer ? getInitials(answer) : '?';
}

function collectInitialData() {
  const answer = clean(document.getElementById('f-initial-answer')?.value || '', 5);
  const hint = clean(document.getElementById('f-initial-hint')?.value || '', 60);
  const len = [...answer].length;
  if (len < 2 || len > 5) {
    toast.error('정답 단어는 2~5글자로 입력해주세요');
    return null;
  }
  const initials = getInitials(answer);
  const tagsRaw = document.getElementById('f-tags')?.value || '';
  const tags = tagsRaw.split(',').map(t => t.replace('#', '').trim()).filter(Boolean);
  if (!tags.includes('초성게임')) tags.unshift('초성게임');
  if (!tags.includes('퀴즈')) tags.push('퀴즈');
  return {
    answer,
    post: {
      type: 'initial_game',
      cat: 'usgyo',
      title: `${initials} 초성게임`,
      desc: hint ? `힌트: ${hint}` : '초성만 보고 정답을 맞혀보세요.',
      initials,
      answerLength: len,
      hint,
      tags: tags.slice(0, 8),
    },
  };
}

async function submitInitialGame(btn) {
  if (!auth.currentUser) {
    navigate('/login');
    return;
  }
  const data = collectInitialData();
  if (!data) return;

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '올리는 중...';

  try {
    const docRef = await addDoc(collection(db, 'feeds'), {
      ...data.post,
      images: [],
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'feeds', docRef.id, 'secret', 'initial'), {
      answer: data.answer,
      createdAt: serverTimestamp(),
    });
    localStorage.removeItem('write-draft-initial_game');
    toast.success('초성게임을 올렸어요!');
    navigate('/feed');
  } catch (error) {
    console.error(error);
    toast.error('초성게임 올리기에 실패했어요');
    btn.disabled = false;
    btn.textContent = oldText || '올리기';
  }
}

function getDetailPostId() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function enhanceInitialDetail() {
  const body = document.querySelector('.detail-body');
  if (!body || body.dataset.initialEnhanced === '1') return;
  const badgeText = document.querySelector('.feed-card__type-badge')?.textContent || '';
  const title = document.querySelector('.detail-title')?.textContent || '';
  if (!badgeText.includes('초성게임') && !title.includes('초성게임')) return;
  body.dataset.initialEnhanced = '1';

  const initials = title.replace('초성게임', '').trim();
  body.insertAdjacentHTML('beforeend', `
    <div class="quiz-box" id="initial-game-area" style="margin-top:16px">
      <div style="font-size:36px;font-weight:950;letter-spacing:.14em;text-align:center;color:var(--color-primary);margin-bottom:14px">${escapeHtml(initials || '?')}</div>
      <div style="display:flex;gap:8px">
        <input id="initial-answer-input" class="form-input" placeholder="정답을 입력하세요" maxlength="5" style="flex:1">
        <button class="btn btn--primary" id="btn-initial-answer">확인</button>
      </div>
      <div id="initial-result" style="display:none;margin-top:12px;padding:12px;border-radius:10px;font-size:14px;font-weight:800"></div>
    </div>
  `);
}

async function checkInitialAnswer() {
  const postId = getDetailPostId();
  const answer = clean(document.getElementById('initial-answer-input')?.value || '', 5);
  if (!answer) return;
  try {
    const res = await callCheckInitial({ postId, answer });
    const result = document.getElementById('initial-result');
    if (!result) return;
    result.style.display = '';
    if (res.data?.correct) {
      result.style.background = '#DCFCE7';
      result.style.color = '#166534';
      result.textContent = `정답! ${res.data.answer}`;
    } else {
      result.style.background = '#FEE2E2';
      result.style.color = '#991B1B';
      result.textContent = '아쉽지만 오답이에요.';
    }
  } catch (error) {
    toast.error(error?.message || '정답 확인에 실패했어요');
  }
}

function boot() {
  patchTypeCard();
  if ((window.location.hash || '').startsWith('#/write') && document.querySelector('[data-type="initial_game"]')) {
    document.querySelectorAll('[data-type="initial_game"]').forEach(card => {
      if (card.dataset.initialClickBound === '1') return;
      card.dataset.initialClickBound = '1';
      card.addEventListener('click', () => setTimeout(renderInitialGameForm, 0), true);
    });
  }
  if (isInitialGameForm()) renderInitialGameForm();
  enhanceInitialDetail();
}

document.addEventListener('click', event => {
  const submitBtn = event.target?.closest?.('#btn-submit');
  if (submitBtn && isInitialGameForm()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submitInitialGame(submitBtn);
    return;
  }
  const answerBtn = event.target?.closest?.('#btn-initial-answer');
  if (answerBtn) {
    event.preventDefault();
    checkInitialAnswer();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target?.id === 'initial-answer-input') {
    event.preventDefault();
    checkInitialAnswer();
  }
}, true);

const observer = new MutationObserver(() => setTimeout(boot, 50));
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(boot, 150));
setTimeout(boot, 300);
