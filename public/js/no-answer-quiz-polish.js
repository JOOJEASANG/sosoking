// no-answer-quiz-polish.js
// 정답 없는 퀴즈는 정답 입력/선택 UI 대신 안내 문구만 표시합니다.

import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function detailId() {
  const match = (location.hash || '').match(/^#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

async function polishNoAnswerQuiz() {
  const postId = detailId();
  if (!postId) return;
  const module = document.querySelector('[data-multi-module="quiz"]');
  if (!module || module.dataset.noAnswerPolished === '1') return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = snap.data() || {};
    const quiz = post.modules?.quiz || {};
    if (quiz.noAnswer !== true) return;

    module.dataset.noAnswerPolished = '1';
    module.querySelector('.multi-quiz-options')?.remove();
    module.querySelector('.multi-submit-row')?.remove();
    module.querySelector('#multi-quiz-result')?.remove();

    const explanation = quiz.explanation || '정답이 없는 퀴즈입니다. 댓글로 자유롭게 이야기해보세요.';
    module.insertAdjacentHTML('beforeend', `
      <div class="multi-quiz-result is-open is-no-answer" style="display:block">
        <b>정답 없는 퀴즈</b>
        <span>${esc(explanation)}</span>
      </div>`);

    const count = module.querySelector('#multi-quiz-correct-count');
    if (count) count.textContent = '정답 없음';
    const first = module.querySelector('#multi-quiz-first-correct');
    if (first) first.textContent = '댓글로 의견을 남겨보세요';
  } catch (error) {
    console.warn('[no-answer-quiz-polish] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(polishNoAnswerQuiz, 260);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 900);
