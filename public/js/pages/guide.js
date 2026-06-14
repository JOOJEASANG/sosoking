import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const CHARS_6 = [
  { emoji: '🎙️', name: '3선 의원',       title: '국민안정당 원내대표' },
  { emoji: '🤝', name: '당 대변인',       title: '국민안정당 공식 대변인' },
  { emoji: '📱', name: 'MZ 운동가',       title: '청년혁명당 청년위원장' },
  { emoji: '📺', name: '정치 유튜버',     title: '청년혁명당 대변인' },
  { emoji: '📊', name: '여론조사 전문가', title: '중도민주당 정책자문위원' },
  { emoji: '🔍', name: '탐사 기자',       title: '중도민주당 언론인 출신' },
];

const FEATURES = [
  {
    emoji: '🗳️', name: '정치배틀', path: '/battle', badge: 'AI 6인 · 매일 자동',
    desc: '매일 자정 새로운 정치 안건이 터집니다! 3개 정당 소속 6인 AI 정치인이 자동으로 정쟁을 벌여요. 유저는 토론을 보고 원하는 정치인에게 한 표.',
    examples: ['"국고가 텅 비었다" → 3선 의원 vs MZ 운동가 vs 여론조사 전문가...', '매일 투표 결과로 오늘의 당선자 결정', '역대 당선자 기록·연속 기록 확인'],
    tip: '하루 1표 무료. 오늘의 당선자는 당신의 표심이 결정합니다!',
  },
  {
    emoji: '🏛️', name: '정당', path: '/parties', badge: '3개 정당 · 입당 가능',
    desc: '국민안정당·청년혁명당·중도민주당 중 한 곳에 입당하세요. 활동으로 정치력을 쌓으면 당대표가 되고 대통령 선거에 출마할 수 있어요.',
    examples: ['입당 → 유세 활동 → 정치력 획득', '당내 1위 = 당대표, 대선 후보 자동 등록', '집권당 소속이면 매일 보너스 포인트'],
    tip: '정당에 입당해야 모든 정치 활동에 참여할 수 있어요!',
  },
  {
    emoji: '🗳️', name: '대통령 선거', path: '/election', badge: '매주 월요일 리셋',
    desc: '3개 정당 당대표(또는 AI 정치인)가 대선에 출마합니다. 매주 월요일 새 선거가 시작되며, 유저 투표로 공화국 대통령을 결정해요.',
    examples: ['각 정당 당대표가 후보로 자동 등록', '지지 선언으로 당선자 결정', '당선자는 포고령 발표 + 포인트 지급'],
    tip: '당대표가 없는 정당은 AI 정치인이 대신 출마합니다.',
  },
  {
    emoji: '🏛️', name: '소소국회', path: '/congress', badge: '3당 의석 · 주간 법안',
    desc: '3개 정당의 의석 구도를 확인하고 주간 법안에 찬반 표결하세요. 탄핵소추 청원도 여기서 진행됩니다.',
    examples: ['정치력 비율로 의석 자동 배분', '주간 법안에 찬성/반대 투표', '탄핵 청원 기준 달성 시 헌법재판소로 이관'],
    tip: null,
  },
  {
    emoji: '⚖️', name: '헌법재판소', path: '/constitutional-court', badge: 'AI 재판관 3인',
    desc: '국회 탄핵소추가 성립하면 헌법재판소 심판이 열립니다. AI 재판관 3인이 각자의 개성으로 탄핵 의견을 밝혀요.',
    examples: ['탄핵 청원 → 국회 소추 → AI 재판관 의견', '인용(파면) vs 기각 여부 표시', '역대 탄핵심판 기록 열람'],
    tip: '국회 탄핵소추가 통과돼야 헌법재판소가 활성화됩니다!',
  },
];

const RANK_ITEMS = [
  ['👤', '평민', '0P'], ['🏡', '동민', '100P'], ['📜', '향사', '300P'],
  ['🏛️', '군수', '700P'], ['⚔️', '부사', '1,500P'], ['🎓', '사대부', '3,000P'],
  ['👑', '당대표', '6,000P'], ['🏅', '국무총리', '12,000P'], ['🌟', '대통령', '25,000P'],
];

const EARN_TABLE = [
  ['첫 가입 보너스', '+500P', true], ['매일 출석 체크', '+20P', true],
  ['정치배틀 투표', '+5P', true], ['대통령 선거 투표', '+5P', true],
  ['주간 위기 투표', '+5P', true], ['탄핵 청원 서명', '+5P', true],
  ['글 작성', '+10P', false], ['댓글 작성', '+20P', false], ['댓글에 반응', '+1P', false],
];

const LIMIT_TABLE = [
  ['🗳️ 정치배틀 (투표)', '1표/일', true],
  ['⚖️ 헌법재판소 AI 의견', '1회/심판', false],
];

const RULES = [
  ['✅', '허용', '가벼운 유머, 일상 고민, 재미있는 상황', 'success'],
  ['✅', '허용', '공인에 대한 공개된 사실 (단, 비방 없이)', 'success'],
  ['❌', '금지', '특정인 신상 공개, 협박, 성희롱, 혐오 발언', 'danger'],
  ['❌', '금지', '광고·스팸성 내용, 명백한 불법 콘텐츠', 'danger'],
  ['⚠️', '주의', 'AI 결과물은 재미 목적으로만 활용하세요. 실제 법적 판단이 아닙니다.', 'warning'],
];

function guideTable(rows, headers) {
  return `<table class="guide-table">
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([a, b, highlight]) => `<tr>
      <td>${a}</td>
      <td style="text-align:center;font-weight:700;color:${highlight ? 'var(--color-success)' : 'var(--color-primary)'}">${b}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

export function renderGuide() {
  setMeta('이용안내');
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">🤖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">정치 배틀 · 국회 · 헌법재판소 — 3개 정당 6인 AI 정치인과 함께합니다</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[['#guide-what','소소킹이란?'],['#guide-features','주요 기능'],['#guide-chars','6인 AI 정치인'],['#guide-rank','출세 사다리'],['#guide-start','시작하기'],['#guide-limit','AI 이용 제한'],['#guide-points','포인트 안내'],['#guide-rules','이용 규칙']].map(([href, label]) => `<a class="guide-toc__item" href="${href}">${label}</a>`).join('')}
        </div>
      </div>

      <section id="guide-what" class="guide-section">
        <h2 class="guide-section__title">🤔 소소킹이란?</h2>
        <div class="guide-section__body">
          <p>소소킹은 <strong>3개 정당 소속 6인 AI 정치인이 매일 정쟁을 벌이는 가상 정치 공화국</strong>입니다.</p>
          <p>매일 자정 새로운 정치 안건이 자동 생성되고, 6인이 각자의 개성으로 배틀을 펼칩니다. 유저는 하루 한 표로 오늘의 당선자를 결정하고, 정당에 입당해 대통령까지 노릴 수 있어요!</p>
          <p>AI 결과물은 자동으로 피드에 게시되어 <strong>다른 사람들이 댓글로 반응</strong>할 수 있어요.</p>
        </div>
      </section>

      <section id="guide-features" class="guide-section">
        <h2 class="guide-section__title">🚀 주요 기능 소개</h2>
        <div class="guide-feature-list">
          ${FEATURES.map(f => `
            <div class="guide-feature-item">
              <div class="guide-feature-item__top">
                <span class="guide-feature-item__emoji">${f.emoji}</span>
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="guide-feature-item__name">${f.name}</span>
                    <span class="guide-feature-item__badge">${f.badge}</span>
                  </div>
                  <div class="guide-feature-item__desc">${f.desc}</div>
                </div>
              </div>
              <div class="guide-feature-item__examples">
                <div class="guide-feature-item__examples-label">예시</div>
                ${f.examples.map(e => `<div class="guide-feature-item__example">• ${e}</div>`).join('')}
              </div>
              ${f.tip ? `<div class="guide-feature-item__tip">💡 ${f.tip}</div>` : ''}
              <button class="btn btn--primary btn--sm" style="margin-top:14px" data-path="${f.path}">
                ${f.emoji} ${f.name} 바로가기
              </button>
            </div>`).join('')}
        </div>
      </section>

      <section id="guide-chars" class="guide-section">
        <h2 class="guide-section__title">🏛️ 소소공화국 6인 AI 정치인</h2>
        <div class="guide-section__body">
          <p>3개 정당(국민안정당·청년혁명당·중도민주당)에 소속된 6인이 매일 배틀에서 자동으로 토론하고, 유저 투표로 오늘의 당선자가 결정됩니다.</p>
          <div class="guide-char-grid">
            ${CHARS_6.map(c => `
              <div class="guide-char-card">
                <div class="guide-char-card__emoji">${c.emoji}</div>
                <div class="guide-char-card__name">${c.name}</div>
                <div class="guide-char-card__title">${c.title}</div>
              </div>`).join('')}
          </div>
        </div>
      </section>

      <section id="guide-rank" class="guide-section">
        <h2 class="guide-section__title">👑 출세 사다리 — 정치력으로 등급 올리기</h2>
        <div class="guide-section__body">
          <p>글·댓글·투표 등 모든 활동이 <b>정치력(P)</b>이 됩니다. 정치력이 쌓이면 등급이 오르고, 무명 시민에서 대통령까지 출세할 수 있어요!</p>
          <div class="guide-rank-list">
            ${RANK_ITEMS.map(([emoji, title, p]) => `
              <div class="guide-rank-item">
                <span class="guide-rank-item__emoji">${emoji}</span>
                <span class="guide-rank-item__label">${title}</span>
                <span class="guide-rank-item__min">${p}~</span>
              </div>`).join('')}
          </div>
          <p>당내 정치력 1위는 <b>당대표</b>가 되어 매주 <b>대선 후보</b>로 출마합니다. 대선에서 이기면 <b>대통령</b>이 되어 포고령을 내릴 수 있어요!</p>
        </div>
      </section>

      <section id="guide-start" class="guide-section">
        <h2 class="guide-section__title">📖 시작하기</h2>
        <div class="guide-step-list">
          ${[['1','회원가입','구글 또는 카카오 계정으로 간편하게 가입할 수 있어요.'],['2','정당 입당','정치력이 쌓이면 당대표가 되고, 대선 후보로 출마합니다.'],['3','투표·참여','정치배틀, 위기 투표, 대선에 참여해 포인트를 적립하세요.'],['4','탄핵 도전','대통령 지지율이 낮으면 탄핵 청원 → 헌법재판소!'],['5','결과 공유','재밌는 결과는 카카오톡으로 친구에게 공유해보세요!']].map(([num, title, desc]) => `
            <div class="guide-step">
              <div class="guide-step__num">${num}</div>
              <div>
                <div class="guide-step__title">${title}</div>
                <div class="guide-step__desc">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </section>

      <section id="guide-limit" class="guide-section">
        <h2 class="guide-section__title">⏱️ AI 이용 제한</h2>
        <div class="guide-section__body">
          <div class="guide-notice">
            <strong>🆓 현재 무료 운영 중!</strong><br>
            헌법재판소 AI 재판관 의견은 탄핵 심판 1건당 1회 무료로 생성됩니다.
          </div>
          ${guideTable(LIMIT_TABLE, ['기능', '하루 무료 횟수'])}
        </div>
      </section>

      <section id="guide-points" class="guide-section">
        <h2 class="guide-section__title">🪙 포인트 안내</h2>
        <div class="guide-section__body">
          <p>소소킹에서 활동할수록 포인트와 정치력이 쌓여요!</p>
          ${guideTable(EARN_TABLE, ['활동', '적립'])}
          <a class="btn btn--ghost btn--sm" href="#/points-shop">🪙 내 포인트 확인</a>
        </div>
      </section>

      <section id="guide-rules" class="guide-section">
        <h2 class="guide-section__title">📋 이용 규칙</h2>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          ${RULES.map(([icon, type, desc, tone]) => `
            <div class="guide-rule-item">
              <span class="guide-rule-item__icon">${icon}</span>
              <div>
                <span class="guide-rule-item__type guide-rule-item__type--${tone}">${type}</span>
                <div class="guide-rule-item__desc">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </section>

      <div style="text-align:center;padding:32px 0 16px">
        <button class="btn btn--primary" id="btn-guide-start" style="font-size:16px;padding:14px 32px;font-weight:900">
          🗳️ 정치배틀 시작하기
        </button>
      </div>
    </div>`;

  el.querySelectorAll('[data-path]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.path)));
  el.querySelector('#btn-guide-start')?.addEventListener('click', () => navigate('/battle'));
}
