import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, increment, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

const COLL = 'chosung_puzzles';

function guessedKey(id) { return `cs_done_${id}`; }

export function mount(container, loggedIn) {
  let unsub = null;
  let puzzles = [];

  container.innerHTML = `
    <div class="game-chosung">
      ${loggedIn ? `
      <div class="game-input-bar">
        <div class="cs-create-header">✏️ 초성 문제 출제하기</div>
        <div class="cs-create-row">
          <input id="cs-initials" class="form-input" placeholder="초성 (예: ㅅㅅㅋ)" maxlength="10">
          <input id="cs-answer" class="form-input" placeholder="정답 (예: 소소킹)" maxlength="20">
          <input id="cs-hint" class="form-input" placeholder="힌트 (선택)" maxlength="30">
          <button id="cs-create" class="btn btn--primary btn--sm">출제</button>
        </div>
      </div>` : `
      <div class="jabdam-login-hint">
        <a href="#/login" class="btn btn--ghost btn--sm">로그인하고 참여하기 →</a>
      </div>`}
      <div id="cs-list" class="cs-list">
        <div class="loading-center"><div class="spinner"></div></div>
      </div>
    </div>`;

  const listEl = container.querySelector('#cs-list');

  function renderPuzzleCard(p) {
    const isSolved = !!p.solved;
    const myUid = auth.currentUser?.uid;
    const isMine = myUid && myUid === p.uid;
    const done = !!localStorage.getItem(guessedKey(p.id));

    return `
      <div class="cs-card${isSolved ? ' cs-card--solved' : ''}" data-id="${escHtml(p.id)}">
        <div class="cs-card__head">
          <span class="cs-badge${isSolved ? ' cs-badge--solved' : ''}">
            ${isSolved ? '✅ 해결!' : '🎯 도전'}
          </span>
          <span class="cs-card__author">${escHtml(p.authorName || '익명')} 출제</span>
          <span class="cs-card__time">${formatTime(p.createdAt?.toDate?.() || p.createdAt)}</span>
          ${isMine ? `<button class="cs-delete-btn" data-id="${escHtml(p.id)}" title="삭제">✕</button>` : ''}
        </div>
        <div class="cs-card__initials">${escHtml(p.initials || '')}</div>
        ${p.hint ? `<div class="cs-card__hint">💡 힌트: ${escHtml(p.hint)}</div>` : ''}
        ${isSolved
          ? `<div class="cs-card__solved">정답: <strong>${escHtml(p.answer || '')}</strong> — 🏆 ${escHtml(p.firstSolvedName || '?')}님이 맞췄어요!</div>`
          : loggedIn && !done
            ? `<div class="cs-card__guess">
                <input class="form-input cs-guess-input" data-id="${escHtml(p.id)}" placeholder="정답 입력" maxlength="30">
                <button class="btn btn--primary btn--sm cs-guess-btn" data-id="${escHtml(p.id)}">제출</button>
               </div>`
            : loggedIn && done
              ? `<div class="cs-card__tried">이미 제출했어요 — 정답이 공개되길 기다려봐요!</div>`
              : ''}
        <div class="cs-card__stats">${p.guessCount || 0}번 도전</div>
      </div>`;
  }

  function reRender() {
    if (!puzzles.length) {
      listEl.innerHTML = `<div class="wc-empty">아직 문제가 없어요!<br>첫 번째로 출제해봐요 🎯</div>`;
      return;
    }
    listEl.innerHTML = puzzles.map(p => renderPuzzleCard(p)).join('');
    attachHandlers();
  }

  function attachHandlers() {
    listEl.querySelectorAll('.cs-guess-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const inputEl = listEl.querySelector(`.cs-guess-input[data-id="${id}"]`);
        const guess = inputEl?.value.trim();
        if (!guess) return;
        const puzzle = puzzles.find(p => p.id === id);
        if (!puzzle) return;

        btn.disabled = true;
        try {
          const correct = guess.toLowerCase() === (puzzle.answer || '').toLowerCase().trim();
          if (correct) {
            const user = auth.currentUser;
            const name = appState.nickname || user?.displayName || '익명';
            await updateDoc(doc(db, COLL, id), {
              guessCount: increment(1),
              solved: true,
              firstSolvedBy: user.uid,
              firstSolvedName: name,
            });
            localStorage.setItem(guessedKey(id), '1');
            toast.success('🎉 정답이에요! 대단해요!');
          } else {
            await updateDoc(doc(db, COLL, id), { guessCount: increment(1) });
            localStorage.setItem(guessedKey(id), '1');
            toast.error('아쉽! 틀렸어요 😅');
          }
        } catch (e) {
          toast.error(e.message || '오류');
        } finally {
          btn.disabled = false;
        }
      });
    });

    listEl.querySelectorAll('.cs-guess-input').forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          listEl.querySelector(`.cs-guess-btn[data-id="${input.dataset.id}"]`)?.click();
        }
      });
    });

    listEl.querySelectorAll('.cs-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 문제를 삭제할까요?')) return;
        try {
          const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          await deleteDoc(doc(db, COLL, btn.dataset.id));
        } catch (e) { toast.error(e.message || '삭제 실패'); }
      });
    });
  }

  const q = query(collection(db, COLL), orderBy('createdAt', 'desc'), limit(20));
  unsub = onSnapshot(q, snap => {
    puzzles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    reRender();
  });

  const createBtn = container.querySelector('#cs-create');
  createBtn?.addEventListener('click', async () => {
    const initialsEl = container.querySelector('#cs-initials');
    const answerEl = container.querySelector('#cs-answer');
    const hintEl = container.querySelector('#cs-hint');
    const initials = initialsEl?.value.trim();
    const answer = answerEl?.value.trim();
    const hint = hintEl?.value.trim() || '';
    if (!initials) { toast.warn('초성을 입력해주세요'); return; }
    if (!answer) { toast.warn('정답을 입력해주세요'); return; }

    createBtn.disabled = true; createBtn.textContent = '...';
    try {
      const user = auth.currentUser;
      const name = appState.nickname || user?.displayName || '익명';
      await addDoc(collection(db, COLL), {
        initials, answer, hint,
        authorName: name, uid: user.uid,
        solved: false, firstSolvedBy: null, firstSolvedName: null,
        guessCount: 0, createdAt: serverTimestamp(),
      });
      if (initialsEl) initialsEl.value = '';
      if (answerEl) answerEl.value = '';
      if (hintEl) hintEl.value = '';
      toast.success('문제가 출제됐어요! 🎯');
    } catch (e) {
      toast.error(e.message || '출제 실패');
    } finally {
      createBtn.disabled = false; createBtn.textContent = '출제';
    }
  });

  return () => { if (unsub) { unsub(); unsub = null; } };
}
