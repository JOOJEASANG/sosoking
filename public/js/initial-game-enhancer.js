import { db, auth } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function isWritePage() {
  return (window.location.hash || '').startsWith('#/write');
}

function wantsInitialGameRoute() {
  return isWritePage() && (window.location.hash || '').includes('type=initial_game');
}

function isInitialGameForm() {
  return isWritePage() && !!document.getElementById('f-initial-pattern');
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

function findAcrosticCard() {
  return [...document.querySelectorAll('[data-type="acrostic"], [data-type="initial_game"]')][0];
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
  if (desc) desc.textContent = '최대 5글자 초성을 보고 떠오르는 단어를 적어요';
}

function renderInitialGamePage() {
  const el = document.getElementById('page-content');
  if (!el || el.dataset.initialGamePage === '1') return;
  el.dataset.initialGamePage = '1';
  el.innerHTML = `
    <div class="write-page">
      <div class="write-steps">
        <div class="write-step-dot done">✓</div>
        <div class="write-step-line done"></div>
        <div class="write-step-dot current">2</div>
      </div>
      <div class="write-step-header">
        <button class="write-back-btn" id="btn-initial-back">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 class="write-step-title">🔤 초성게임</h1>
      </div>
      <div class="card">
        <div class="card__body--lg" id="form-fields"></div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" onclick="navigate('/feed')">취소</button>
            <button class="btn btn--primary" id="btn-submit">올리기</button>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('btn-initial-back')?.addEventListener('click', () => navigate('/write'));
  renderInitialGameForm();
}

function renderInitialGameForm() {
  const fields = document.getElementById('form-fields');
  const title = document.querySelector('.write-step-title');
  if (!fields || fields.dataset.initialGame === '1') return;
  fields.dataset.initialGame = '1';
  if (title) title.textContent = '🔤 초성게임';
  fields.innerHTML = `
    <div class="form-group">
      <label class="form-label">초성 <span class="required">*</span></label>
      <input id="f-initial-pattern" class="form-input" placeholder="예: ㅅㅅㅋ" maxlength="5" autocomplete="off">
      <div class="form-hint">2~5글자 · 정답이 따로 없는 참여형 초성게임이에요</div>
    </div>
    <div class="form-group">
      <label class="form-label">미리보기</label>
      <div id="initial-preview" style="padding:18px;border-radius:14px;background:#F3F4F6;border:1px solid var(--color-border);font-size:30px;font-weight:950;letter-spacing:.12em;text-align:center;color:var(--color-primary)">?</div>
    </div>
    <div class="form-group">
      <label class="form-label">힌트</label>
      <input id="f-initial-hint" class="form-input" placeholder="예: 생각나는 단어 아무거나" maxlength="60">
      <div class="form-hint">힌트는 선택사항이에요</div>
    </div>
    <div class="form-group">
      <label class="form-label">안내</label>
      <div style="padding:12px 14px;border-radius:12px;background:#F9FAFB;border:1px solid var(--color-border);font-size:14px;line-height:1.6;color:var(--color-text-secondary)">초성을 보고 떠오르는 단어를 댓글처럼 올리는 게임이에요. 정답 맞히기가 아니라 센스 대결이에요.</div>
    </div>
    <div class="form-group">
      <label class="form-label">태그</label>
      <input id="f-tags" class="form-input" placeholder="#초성게임, #센스대결" maxlength="100">
    </div>
  `;
  document.getElementById('f-initial-pattern')?.addEventListener('input', updatePreview);
  updatePreview();
}

function updatePreview() {
  const pattern = clean(document.getElementById('f-initial-pattern')?.value || '', 5).replace(/\s/g, '');
  const preview = document.getElementById('initial-preview');
  if (preview) preview.textContent = pattern || '?';
}

function collectInitialData() {
  const pattern = clean(document.getElementById('f-initial-pattern')?.value || '', 5).replace(/\s/g, '');
  const hint = clean(document.getElementById('f-initial-hint')?.value || '', 60);
  const len = [...pattern].length;
  if (len < 2 || len > 5) {
    toast.error('초성은 2~5글자로 입력해주세요');
    return null;
  }
  const tagsRaw = document.getElementById('f-tags')?.value || '';
  const tags = tagsRaw.split(',').map(t => t.replace('#', '').trim()).filter(Boolean);
  if (!tags.includes('초성게임')) tags.unshift('초성게임');
  if (!tags.includes('센스대결')) tags.push('센스대결');
  return {
    post: {
      type: 'initial_game',
      cat: 'usgyo',
      title: `${pattern} 초성게임`,
      desc: hint ? `힌트: ${hint}` : '초성을 보고 떠오르는 단어를 적어보세요.',
      initials: pattern,
      answerLength: len,
      hint,
      gameMode: 'open_answer',
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
    await addDoc(collection(db, 'feeds'), {
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
      <div style="font-size:36px;font-weight:950;letter-spacing:.14em;text-align:center;color:var(--color-primary);margin-bottom:10px">${escapeHtml(initials || '?')}</div>
      <div style="font-size:13px;color:var(--color-text-secondary);text-align:center;margin-bottom:12px">떠오르는 단어를 댓글로 남겨보세요. 정답은 따로 없어요.</div>
    </div>
  `);
}

function boot() {
  if (wantsInitialGameRoute()) renderInitialGamePage();
  patchTypeCard();
  enhanceInitialDetail();
}

document.addEventListener('click', event => {
  const card = event.target?.closest?.('[data-type="initial_game"]');
  if (card && isWritePage()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    renderInitialGamePage();
    return;
  }

  const submitBtn = event.target?.closest?.('#btn-submit');
  if (submitBtn && isInitialGameForm()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submitInitialGame(submitBtn);
    return;
  }
}, true);

const observer = new MutationObserver(() => setTimeout(boot, 50));
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(boot, 150));
setTimeout(boot, 300);
