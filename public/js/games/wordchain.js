import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

const COLL = 'wordchain_entries';

export function mount(container, loggedIn) {
  let unsub = null;
  let lastWord = '';
  let usedWords = new Set();

  container.innerHTML = `
    <div class="game-wordchain">
      ${loggedIn ? `
      <div class="game-input-bar">
        <div class="game-wordchain__prompt" id="wc-prompt">첫 번째 단어를 입력하세요!</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input id="wc-input" class="form-input wc-input" placeholder="단어 입력" maxlength="20" autocomplete="off">
          <button id="wc-submit" class="btn btn--primary btn--sm">올리기</button>
        </div>
      </div>` : `
      <div class="jabdam-login-hint">
        <a href="#/login" class="btn btn--ghost btn--sm">로그인하고 참여하기 →</a>
      </div>`}
      <div id="wc-chain" class="wc-chain">
        <div class="loading-center"><div class="spinner"></div></div>
      </div>
    </div>`;

  const chainEl = container.querySelector('#wc-chain');
  const promptEl = container.querySelector('#wc-prompt');
  const inputEl = container.querySelector('#wc-input');
  const submitBtn = container.querySelector('#wc-submit');

  function updatePrompt(word) {
    if (!promptEl) return;
    if (!word) { promptEl.innerHTML = '첫 번째 단어를 입력하세요!'; return; }
    const nextChar = word[word.length - 1];
    promptEl.innerHTML = `<span class="wc-next-char">'${escHtml(nextChar)}'</span>로 시작하는 단어를 입력하세요`;
  }

  const q = query(collection(db, COLL), orderBy('createdAt', 'asc'), limit(60));
  unsub = onSnapshot(q, snap => {
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    usedWords = new Set(entries.map(e => e.word));
    lastWord = entries.length ? entries[entries.length - 1].word : '';
    updatePrompt(lastWord);

    if (!entries.length) {
      chainEl.innerHTML = `<div class="wc-empty">아직 아무 단어도 없어요!<br>첫 번째로 시작해봐요 🔤</div>`;
      return;
    }
    chainEl.innerHTML = `
      <div class="wc-chain-scroll">
        <div class="wc-chain-list">
          ${entries.map((e, i) => `
            <span class="wc-word${i === entries.length - 1 ? ' wc-word--last' : ''}">
              <span class="wc-word__text">${escHtml(e.word)}</span>
              <span class="wc-word__author">${escHtml(e.authorName || '익명')}</span>
            </span>
            ${i < entries.length - 1 ? '<span class="wc-arrow">→</span>' : ''}
          `).join('')}
        </div>
      </div>
      <div class="wc-count">${entries.length}개 연결됨</div>`;
  });

  submitBtn?.addEventListener('click', async () => {
    const word = inputEl?.value.trim();
    if (!word) return;
    if (word.length < 2) { toast.warn('단어는 2자 이상이어야 해요'); return; }
    if (lastWord && word[0] !== lastWord[lastWord.length - 1]) {
      toast.error(`'${lastWord[lastWord.length - 1]}'로 시작하는 단어를 입력해주세요!`); return;
    }
    if (usedWords.has(word)) { toast.error('이미 사용된 단어예요!'); return; }

    submitBtn.disabled = true; submitBtn.textContent = '...';
    try {
      const user = auth.currentUser;
      const name = appState.nickname || user?.displayName || '익명';
      await addDoc(collection(db, COLL), {
        word, authorName: name, uid: user.uid, createdAt: serverTimestamp(),
      });
      if (inputEl) inputEl.value = '';
    } catch (e) {
      toast.error(e.message || '올리기 실패');
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = '올리기';
    }
  });

  inputEl?.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn?.click(); });

  return () => { if (unsub) { unsub(); unsub = null; } };
}
