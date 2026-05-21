import { auth, db } from './firebase.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CHALLENGES = [
  {
    title: '이번 주 빈칸챌린지',
    sentence: '요즘 내 상태는 ___인데, 이유는 ___ 때문이다.',
    hint: '솔직하게 적어도 되고 웃기게 적어도 됩니다.',
  },
  {
    title: '이번 주 빈칸챌린지',
    sentence: '친구가 갑자기 ___라고 해서 나는 ___했다.',
    hint: '상황을 상상해서 막장으로 채워보세요.',
  },
  {
    title: '이번 주 빈칸챌린지',
    sentence: '내가 사장이라면 회사에 ___ 제도를 만들겠다.',
    hint: '말도 안 되는 제도일수록 좋습니다.',
  },
  {
    title: '이번 주 빈칸챌린지',
    sentence: '오늘의 운세: ___을 조심하면 ___을 얻는다.',
    hint: '엉뚱한 운세를 만들어보세요.',
  },
  {
    title: '이번 주 빈칸챌린지',
    sentence: 'AI가 나에게 ___하라고 했지만 나는 ___했다.',
    hint: 'AI와 인간의 이상한 대결 느낌으로 써보세요.',
  },
  {
    title: '이번 주 빈칸챌린지',
    sentence: '내 인생 영화 제목은 ___이고 장르는 ___이다.',
    hint: '자기소개처럼 적어도 되고 개그로 가도 됩니다.',
  },
];

function weekIndex() {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  const week = Math.floor(((now - oneJan) / dayMs + oneJan.getDay()) / 7);
  return Math.abs((now.getFullYear() * 53 + week) % CHALLENGES.length);
}

function currentChallenge() {
  return CHALLENGES[weekIndex()] || CHALLENGES[0];
}

function challengeKey() {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  const week = Math.floor(((now - oneJan) / dayMs + oneJan.getDay()) / 7) + 1;
  return `${now.getFullYear()}-${String(week).padStart(2, '0')}`;
}

function blankCount(sentence) {
  return (sentence.match(/___/g) || []).length;
}

function fillSentence(sentence, answers) {
  return answers.reduce((s, a) => s.replace('___', a), sentence);
}

async function initWeekDoc() {
  if (!auth.currentUser) return;
  const key  = challengeKey();
  const ref  = doc(db, 'weekly_fill', key);
  const snap = await getDoc(ref).catch(() => null);
  if (snap?.exists()) return;
  const item = currentChallenge();
  await setDoc(ref, {
    weekKey:        key,
    title:          item.title,
    sentence:       item.sentence,
    hint:           item.hint,
    challengeIndex: weekIndex(),
    createdAt:      serverTimestamp(),
  }).catch(() => {});
}

async function loadMyAnswer() {
  if (!auth.currentUser) return null;
  const snap = await getDoc(
    doc(db, 'weekly_fill', challengeKey(), 'answers', auth.currentUser.uid)
  ).catch(() => null);
  return snap?.exists() ? snap.data() : null;
}

async function saveAnswer(blanks) {
  if (!auth.currentUser) throw new Error('not-logged-in');
  const item = currentChallenge();
  const key  = challengeKey();
  await setDoc(doc(db, 'weekly_fill', key, 'answers', auth.currentUser.uid), {
    weekKey:    key,
    sentence:   item.sentence,
    blanks,
    filled:     fillSentence(item.sentence, blanks),
    authorId:   auth.currentUser.uid,
    authorName: auth.currentUser.displayName || '익명',
    createdAt:  serverTimestamp(),
  });
}

function renderCardDone(filled) {
  const item = currentChallenge();
  const key  = challengeKey();
  return `
    <section class="weekly-fill-card weekly-fill-card--done" data-weekly-fill-card>
      <div class="weekly-fill-card__badge weekly-fill-card__badge--done">✅ 이번 주 미션 완료</div>
      <div class="weekly-fill-card__main">
        <div class="weekly-fill-card__icon">🧩</div>
        <div style="min-width:0">
          <h2>${item.title}</h2>
          <p class="weekly-fill-card__sentence weekly-fill-card__sentence--filled">${filled}</p>
        </div>
      </div>
      <div class="weekly-fill-card__foot">
        <span>주간 코드 ${key} · 매주 자동 변경</span>
      </div>
    </section>`;
}

function renderCard() {
  const item = currentChallenge();
  const key  = challengeKey();
  const n    = blankCount(item.sentence);
  const inputs = Array.from({ length: n }, (_, i) => `
    <div class="wfc-blank-row">
      <label class="wfc-blank-label">빈칸 ${i + 1}</label>
      <input class="wfc-blank-input" type="text" data-idx="${i}"
        placeholder="내용을 입력하세요" maxlength="30">
    </div>`).join('');

  return `
    <section class="weekly-fill-card" data-weekly-fill-card>
      <div class="weekly-fill-card__badge">SYSTEM WEEKLY</div>
      <div class="weekly-fill-card__main">
        <div class="weekly-fill-card__icon">🧩</div>
        <div style="min-width:0">
          <h2>${item.title}</h2>
          <p class="weekly-fill-card__sentence">${item.sentence}</p>
          <p class="weekly-fill-card__hint">${item.hint}</p>
        </div>
      </div>
      <div class="wfc-form" style="display:none">
        ${inputs}
        <button class="btn btn--primary wfc-submit-btn" type="button" data-wfc-submit>✏️ 제출하기</button>
        <button class="btn btn--ghost btn--sm wfc-cancel-btn" type="button" data-wfc-cancel>취소</button>
      </div>
      <div class="weekly-fill-card__foot" data-wfc-foot>
        <span>주간 코드 ${key} · 매주 자동 변경</span>
        <button class="btn btn--primary btn--sm" type="button" data-wfc-open>참여하기</button>
      </div>
    </section>`;
}

function injectStyle() {
  if (document.getElementById('weekly-fill-style')) return;
  const style = document.createElement('style');
  style.id = 'weekly-fill-style';
  style.textContent = `
    .weekly-fill-card {
      position: relative;
      overflow: hidden;
      margin: 0 0 14px;
      padding: 16px;
      border-radius: 20px;
      border: 1px solid rgba(124,58,237,.20);
      background: linear-gradient(135deg, rgba(124,58,237,.12), rgba(255,107,74,.09));
      box-shadow: var(--shadow-sm);
    }
    .weekly-fill-card--done {
      border-color: rgba(34,197,94,.24);
      background: linear-gradient(135deg, rgba(34,197,94,.09), rgba(16,185,129,.06));
    }
    .weekly-fill-card__badge {
      display: inline-flex;
      margin-bottom: 10px;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(124,58,237,.14);
      color: #7c3aed;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .06em;
    }
    .weekly-fill-card__badge--done {
      background: rgba(34,197,94,.14);
      color: var(--color-success);
    }
    .weekly-fill-card__main {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .weekly-fill-card__icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 17px;
      background: rgba(255,255,255,.58);
      font-size: 25px;
      flex: 0 0 auto;
    }
    .weekly-fill-card h2 {
      margin: 0 0 7px;
      color: var(--color-text-primary);
      font-size: 18px;
      font-weight: 950;
      letter-spacing: -.03em;
    }
    .weekly-fill-card__sentence {
      margin: 0;
      color: var(--color-text-primary);
      font-size: 16px;
      font-weight: 950;
      line-height: 1.55;
    }
    .weekly-fill-card__sentence--filled {
      color: var(--color-success);
    }
    .weekly-fill-card__hint {
      margin: 6px 0 0;
      color: var(--color-text-muted);
      font-size: 12.5px;
      font-weight: 800;
      line-height: 1.45;
    }
    .weekly-fill-card__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 13px;
      padding-top: 12px;
      border-top: 1px dashed rgba(124,58,237,.22);
    }
    .weekly-fill-card--done .weekly-fill-card__foot {
      border-top-color: rgba(34,197,94,.24);
    }
    .weekly-fill-card__foot span {
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 850;
    }
    .wfc-form {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed rgba(124,58,237,.22);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .wfc-blank-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .wfc-blank-label {
      font-size: 12px;
      font-weight: 800;
      color: var(--color-text-muted);
    }
    .wfc-blank-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid var(--color-border-light);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-family: inherit;
      font-size: 14px;
      font-weight: 800;
      outline: none;
      box-sizing: border-box;
    }
    .wfc-blank-input:focus {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,.12);
    }
    .wfc-submit-btn {
      width: 100%;
      margin-top: 4px;
    }
    .wfc-cancel-btn {
      width: 100%;
    }
    .weekly-mission-card {
      margin: 0 0 12px;
      padding: 14px 16px;
      border-radius: 17px;
      border: 1px solid rgba(124,58,237,.20);
      background: linear-gradient(135deg, rgba(124,58,237,.08), rgba(255,107,74,.06));
    }
    .weekly-mission-card--done {
      border-color: rgba(34,197,94,.22);
      background: linear-gradient(135deg, rgba(34,197,94,.07), rgba(16,185,129,.05));
    }
    .weekly-mission-card__head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .weekly-mission-card__title {
      font-size: 13px;
      font-weight: 900;
      color: var(--color-text-primary);
    }
    .weekly-mission-card__status {
      margin-left: auto;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 950;
      background: rgba(124,58,237,.14);
      color: #7c3aed;
    }
    .weekly-mission-card__status--done {
      background: rgba(34,197,94,.14);
      color: var(--color-success);
    }
    .weekly-mission-card__sentence {
      font-size: 13px;
      font-weight: 800;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .weekly-mission-card__sentence--filled {
      color: var(--color-success);
      font-weight: 900;
    }
    .weekly-mission-card__go {
      width: 100%;
    }
    .wfc-acct-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed rgba(124,58,237,.20);
    }
    [data-theme="dark"] .weekly-fill-card__icon {
      background: rgba(255,255,255,.12);
    }
    [data-theme="dark"] .weekly-fill-card__badge {
      color: #ddd6fe;
      background: rgba(124,58,237,.28);
    }
    [data-theme="dark"] .wfc-blank-input {
      background: var(--color-surface-2);
    }
    @media (max-width: 767px) {
      .weekly-fill-card {
        margin: 0 0 12px;
        padding: 14px;
        border-radius: 17px;
      }
      .weekly-fill-card__main {
        gap: 10px;
      }
      .weekly-fill-card__icon {
        width: 42px;
        height: 42px;
        border-radius: 15px;
      }
      .weekly-fill-card__sentence {
        font-size: 14.5px;
      }
      .weekly-fill-card__foot {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `;
  document.head.appendChild(style);
}

function showToast(type, msg) {
  window.dispatchEvent(new CustomEvent(`toast:${type}`, { detail: msg }));
  window.toast?.[type]?.(msg);
}

function bindCard() {
  const card = document.querySelector('[data-weekly-fill-card]');
  if (!card) return;

  card.querySelector('[data-wfc-open]')?.addEventListener('click', () => {
    if (!auth.currentUser) {
      window.navigate?.('/login');
      return;
    }
    card.querySelector('.wfc-form').style.display = 'flex';
    card.querySelector('[data-wfc-foot]').style.display = 'none';
    card.querySelector('.wfc-blank-input')?.focus();
  });

  card.querySelector('[data-wfc-cancel]')?.addEventListener('click', () => {
    card.querySelector('.wfc-form').style.display = 'none';
    card.querySelector('[data-wfc-foot]').style.display = '';
  });

  card.querySelector('[data-wfc-submit]')?.addEventListener('click', async () => {
    const inputs = [...card.querySelectorAll('.wfc-blank-input')];
    const blanks = inputs.map(i => i.value.trim());
    const emptyInput = inputs.find(i => !i.value.trim());
    if (emptyInput) {
      emptyInput.focus();
      showToast('error', '빈칸을 모두 채워주세요');
      return;
    }

    const btn = card.querySelector('[data-wfc-submit]');
    btn.disabled = true;
    btn.textContent = '제출 중...';

    try {
      await saveAnswer(blanks);
      const filled = fillSentence(currentChallenge().sentence, blanks);
      card.outerHTML = renderCardDone(filled);
      showToast('success', '이번 주 빈칸 미션을 완료했어요! 🎉');
      updateAccountMissionCard(filled);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '✏️ 제출하기';
      showToast('error', '제출에 실패했어요. 다시 시도해주세요');
    }
  });
}

function markMissionDone(card, filled) {
  card.classList.add('weekly-mission-card--done');
  const statusEl = card.querySelector('.weekly-mission-card__status');
  if (statusEl) {
    statusEl.classList.add('weekly-mission-card__status--done');
    statusEl.textContent = '✅ 완료';
  }
  const sentEl = card.querySelector('.weekly-mission-card__sentence');
  if (sentEl) {
    sentEl.textContent = filled;
    sentEl.classList.add('weekly-mission-card__sentence--filled');
  }
  card.querySelector('.wfc-acct-form')?.remove();
}

function updateAccountMissionCard(filled) {
  const card = document.querySelector('[data-weekly-mission]');
  if (card) markMissionDone(card, filled);
}

function bindAccountMission(card) {
  card.querySelector('[data-wfc-acct-submit]')?.addEventListener('click', async () => {
    const inputs = [...card.querySelectorAll('.wfc-acct-input')];
    const blanks = inputs.map(i => i.value.trim());
    const emptyInput = inputs.find(i => !i.value.trim());
    if (emptyInput) {
      emptyInput.focus();
      showToast('error', '빈칸을 모두 채워주세요');
      return;
    }
    const btn = card.querySelector('[data-wfc-acct-submit]');
    btn.disabled = true;
    btn.textContent = '제출 중...';
    try {
      await saveAnswer(blanks);
      const filled = fillSentence(currentChallenge().sentence, blanks);
      markMissionDone(card, filled);
      showToast('success', '이번 주 빈칸 미션을 완료했어요! 🎉');
      const feedCard = document.querySelector('[data-weekly-fill-card]');
      if (feedCard) feedCard.outerHTML = renderCardDone(filled);
    } catch {
      btn.disabled = false;
      btn.textContent = '✏️ 지금 참여하기';
      showToast('error', '제출에 실패했어요. 다시 시도해주세요');
    }
  });
}

function findInsertionRoot() {
  return document.querySelector('.feed-page')
    || document.querySelector('.home-page')
    || document.querySelector('#page-content > div')
    || document.getElementById('page-content');
}

function shouldShowFeed() {
  const hash = location.hash || '#/';
  return hash === '#/' || hash.startsWith('#/feed');
}

function shouldShowAccount() {
  const hash = location.hash || '#/';
  return hash.startsWith('#/account');
}

async function injectCard() {
  injectStyle();
  if (!shouldShowFeed()) return;
  if (document.querySelector('[data-weekly-fill-card]')) return;

  const [myAnswer] = await Promise.all([
    loadMyAnswer(),
    initWeekDoc(),
  ]);

  // await 중 홈페이지가 스켈레톤→실제 콘텐츠로 전환될 수 있으므로 재확인
  if (document.querySelector('[data-weekly-fill-card]')) return;
  const root = findInsertionRoot();
  if (!root) return;

  if (myAnswer) {
    root.insertAdjacentHTML('afterbegin', renderCardDone(myAnswer.filled));
  } else {
    root.insertAdjacentHTML('afterbegin', renderCard());
    bindCard();
  }
}

async function injectAccountMission() {
  injectStyle();
  if (!shouldShowAccount()) return;

  const item     = currentChallenge();
  const myAnswer = await loadMyAnswer();

  // await 중 페이지가 바뀔 수 있으므로 재확인
  const wrap = document.querySelector('.account-page-wrap');
  if (!wrap || wrap.querySelector('[data-weekly-mission]')) return;

  const profileCard = wrap.querySelector('.account-profile-card');
  if (!profileCard) return;
  const isDone   = !!myAnswer;
  const n        = blankCount(item.sentence);

  const formInputs = Array.from({ length: n }, (_, i) => `
    <div class="wfc-blank-row">
      <label class="wfc-blank-label">빈칸 ${i + 1}</label>
      <input class="wfc-blank-input wfc-acct-input" type="text" data-idx="${i}"
        placeholder="내용을 입력하세요" maxlength="30">
    </div>`).join('');

  const html = `
    <div class="weekly-mission-card ${isDone ? 'weekly-mission-card--done' : ''}" data-weekly-mission>
      <div class="weekly-mission-card__head">
        <span>🧩</span>
        <span class="weekly-mission-card__title">이번 주 빈칸 미션</span>
        <span class="weekly-mission-card__status ${isDone ? 'weekly-mission-card__status--done' : ''}">${isDone ? '✅ 완료' : '미완료'}</span>
      </div>
      <p class="weekly-mission-card__sentence ${isDone ? 'weekly-mission-card__sentence--filled' : ''}">
        ${isDone ? myAnswer.filled : item.sentence}
      </p>
      ${!isDone ? `
        <div class="wfc-acct-form">
          ${formInputs}
          <button class="btn btn--primary btn--sm" type="button" data-wfc-acct-submit style="width:100%;margin-top:4px">✏️ 지금 참여하기</button>
        </div>` : ''}
    </div>`;

  profileCard.insertAdjacentHTML('afterend', html);

  if (!isDone) {
    const card = wrap.querySelector('[data-weekly-mission]');
    bindAccountMission(card);
  }
}

let feedTimer = null;
let acctTimer = null;

function scheduleFeed() {
  clearTimeout(feedTimer);
  feedTimer = setTimeout(injectCard, 180);
}

function scheduleAccount() {
  clearTimeout(acctTimer);
  acctTimer = setTimeout(injectAccountMission, 300);
}

function schedule() {
  scheduleFeed();
  scheduleAccount();
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
