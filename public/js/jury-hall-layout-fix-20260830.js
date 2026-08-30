// 민심소/명예의 전당 UX 보정
// - 정상 운영 중인 Firestore 데이터 구조는 건드리지 않는다.
// - 명예의 전당에서 판결문/승패/민심 분포를 미리 노출하지 않는다.
// - 랭킹 카드는 민심소의 동일 사건 블라인드 판정으로 이어진다.
// - 모바일에서 민심소 하단 버튼이 카드 밖으로 넘치지 않게 한다.

const JURY_TARGET_KEY = 'sosoking-jury-target-case';
const boundHallCards = new WeakSet();
let patchQueued = false;

function injectLayoutStyle() {
  if (document.getElementById('jury-hall-layout-fix-style')) return;

  const style = document.createElement('style');
  style.id = 'jury-hall-layout-fix-style';
  style.textContent = `
    /* 판결기록 카드 느낌을 민심소 사건 목록에 적용하되 판결 내용은 숨긴다. */
    .jury-list-card {
      position: relative;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center !important;
      gap: 10px 14px !important;
      padding: 14px 16px 15px !important;
      border-left: 3px solid rgba(201, 168, 76, .62) !important;
      border-radius: 14px !important;
      overflow: hidden;
    }

    .jury-list-card::before {
      content: 'BLIND CASE';
      grid-column: 1 / -1;
      display: block;
      margin-bottom: -2px;
      font-size: 9px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: .12em;
      color: var(--gold);
      opacity: .78;
    }

    .jury-list-card.judged::before {
      content: '판정 완료';
      color: var(--cream-dim);
      letter-spacing: .04em;
    }

    .jury-list-main {
      min-width: 0;
    }

    .jury-list-title {
      margin-bottom: 7px !important;
      font-size: 15.5px !important;
      line-height: 1.45 !important;
    }

    .jury-list-meta {
      gap: 6px 8px !important;
    }

    .jury-list-cta {
      align-self: center;
      justify-self: end;
      padding: 7px 10px;
      border: 1px solid rgba(201, 168, 76, .32);
      border-radius: 999px;
      background: rgba(201, 168, 76, .08);
      line-height: 1.25;
    }

    /* 투표 후 하단 3개 버튼이 좁은 화면에서 바깥으로 빠지지 않게 고정한다. */
    .jury-actions {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px !important;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .jury-actions .btn {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100%;
      margin: 0 !important;
      padding-left: 8px !important;
      padding-right: 8px !important;
      box-sizing: border-box;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: center;
    }

    .jury-actions .btn-primary {
      grid-column: 1 / -1;
    }

    /* 명예의 전당은 결과 열람 페이지가 아니라 랭킹 보드로만 보이게 한다. */
    .hall-card-summary,
    .hall-split,
    .hall-split-legend {
      display: none !important;
    }

    .hall-card {
      cursor: pointer;
    }

    .hall-blind-note {
      display: block;
      margin-top: 8px;
      font-size: 10.5px;
      font-weight: 800;
      color: var(--cream-dim);
    }

    .hall-blind-note strong {
      color: var(--gold);
    }

    @media (max-width: 520px) {
      .jury-list-card {
        grid-template-columns: minmax(0, 1fr) !important;
      }

      .jury-list-cta {
        justify-self: start;
      }
    }

    @media (max-width: 390px) {
      .jury-actions {
        grid-template-columns: minmax(0, 1fr) !important;
      }

      .jury-actions .btn-primary {
        grid-column: auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function resultCaseIdFromHref(href) {
  const raw = String(href || '');
  const marker = '#/result/';
  const index = raw.indexOf(marker);
  if (index < 0) return '';
  try {
    return decodeURIComponent(raw.slice(index + marker.length));
  } catch {
    return '';
  }
}

function patchHall() {
  const page = document.querySelector('.hall-page');
  if (!page) return;

  const intro = page.querySelector('.hall-intro-copy');
  if (intro) {
    intro.textContent = '민심소에 쌓인 참여 기록으로 만든 랭킹입니다. 판결 내용과 어느 쪽이 우세한지는 여기서 공개하지 않고, 블라인드 판정은 민심소에서 진행합니다.';
  }

  page.querySelectorAll('.hall-section-title').forEach(title => {
    const text = title.textContent || '';
    if (text.includes('화제의 판결')) title.textContent = '🔥 화제의 사건';
    if (text.includes('논란의 판결')) title.textContent = '⚖️ 접전의 사건';
  });

  page.querySelectorAll('.hall-card-summary, .hall-split, .hall-split-legend').forEach(element => element.remove());

  page.querySelectorAll('.hall-card').forEach(card => {
    const originalHref = card.getAttribute('href') || '';
    const caseId = card.dataset.juryCaseId || resultCaseIdFromHref(originalHref);
    if (caseId) card.dataset.juryCaseId = caseId;

    card.setAttribute('href', '#/jury');
    card.removeAttribute('data-public-result-link');

    const body = card.querySelector('.hall-card-body');
    if (body && !body.querySelector('.hall-blind-note')) {
      body.insertAdjacentHTML(
        'beforeend',
        '<span class="hall-blind-note"><strong>민심소</strong>에서 판결을 보지 않고 먼저 판정하기 ›</span>'
      );
    }

    if (!boundHallCards.has(card)) {
      boundHallCards.add(card);
      card.addEventListener('click', () => {
        const targetCaseId = card.dataset.juryCaseId || '';
        if (!targetCaseId) return;
        try {
          sessionStorage.setItem(JURY_TARGET_KEY, targetCaseId);
        } catch {
          /* 저장이 막혀도 민심소 이동 자체는 정상 동작한다. */
        }
      });
    }
  });
}

function openRequestedJuryCase() {
  if (!document.querySelector('.jury-page')) return;

  let targetCaseId = '';
  try {
    targetCaseId = sessionStorage.getItem(JURY_TARGET_KEY) || '';
  } catch {
    return;
  }
  if (!targetCaseId) return;

  const card = [...document.querySelectorAll('.jury-list-card')]
    .find(element => element.dataset.caseId === targetCaseId);
  if (!card) return;

  try {
    sessionStorage.removeItem(JURY_TARGET_KEY);
  } catch {
    /* no-op */
  }
  card.click();
}

function patchPage() {
  injectLayoutStyle();
  patchHall();
  openRequestedJuryCase();
}

function schedulePatch() {
  if (patchQueued) return;
  patchQueued = true;
  queueMicrotask(() => {
    patchQueued = false;
    patchPage();
  });
}

const host = document.getElementById('page-content') || document.body;
const observer = new MutationObserver(schedulePatch);
observer.observe(host, { childList: true, subtree: true });
window.addEventListener('hashchange', schedulePatch);

patchPage();
