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

function renderCard() {
  const item = currentChallenge();
  const key = challengeKey();
  return `
    <section class="weekly-fill-card" data-weekly-fill-card>
      <div class="weekly-fill-card__badge">SYSTEM WEEKLY</div>
      <div class="weekly-fill-card__main">
        <div class="weekly-fill-card__icon">🧩</div>
        <div>
          <h2>${item.title}</h2>
          <p class="weekly-fill-card__sentence">${item.sentence}</p>
          <p class="weekly-fill-card__hint">${item.hint}</p>
        </div>
      </div>
      <div class="weekly-fill-card__foot">
        <span>주간 코드 ${key} · 매주 자동 변경</span>
        <button class="btn btn--primary btn--sm" type="button" data-weekly-fill-copy>문장 복사</button>
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
    .weekly-fill-card__foot span {
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 850;
    }
    [data-theme="dark"] .weekly-fill-card__icon {
      background: rgba(255,255,255,.12);
    }
    [data-theme="dark"] .weekly-fill-card__badge {
      color: #ddd6fe;
      background: rgba(124,58,237,.28);
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
      .weekly-fill-card__foot .btn {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

async function copySentence() {
  const text = currentChallenge().sentence;
  try {
    await navigator.clipboard.writeText(text);
    window.dispatchEvent(new CustomEvent('toast:success', { detail: '이번 주 빈칸 문장을 복사했어요' }));
    if (window.toast?.success) window.toast.success('이번 주 빈칸 문장을 복사했어요');
  } catch {
    alert(text);
  }
}

function findInsertionRoot() {
  return document.querySelector('.feed-page')
    || document.querySelector('.home-page')
    || document.querySelector('#page-content > div')
    || document.getElementById('page-content');
}

function shouldShow() {
  const hash = location.hash || '#/';
  return hash === '#/' || hash.startsWith('#/feed');
}

function injectCard() {
  injectStyle();
  if (!shouldShow()) return;
  if (document.querySelector('[data-weekly-fill-card]')) return;
  const root = findInsertionRoot();
  if (!root) return;
  root.insertAdjacentHTML('afterbegin', renderCard());
  document.querySelector('[data-weekly-fill-copy]')?.addEventListener('click', copySentence);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(injectCard, 180);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
