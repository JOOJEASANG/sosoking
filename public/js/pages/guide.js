import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const FEATURES = [
  {
    emoji: '🏛️', name: '소소공화국', path: '/republic', badge: '게임 허브',
    desc: '내 정치 인생 진행도, 오늘 정치 루틴, 대통령·정당·대선·국회 흐름을 한 화면에서 확인합니다.',
    examples: ['입당 → 당대표 → 대통령 → 국회·헌재 흐름 확인', '오늘 정치 루틴으로 할 일 바로 이동', '공화국 전체 현황 확인'],
    tip: '처음 시작하면 공화국 허브부터 확인하세요.',
  },
  {
    emoji: '⚔️', name: '정치배틀', path: '/battle', badge: '매일 투표',
    desc: '매일 정치 안건을 두고 정당들이 맞붙습니다. 유저는 정당 입장을 보고 하루 한 표를 행사하며 정치력을 얻습니다.',
    examples: ['정당별 입장 비교', '투표하고 +5P', '토론 댓글과 반응으로 참여'],
    tip: '토론 멘트 추천 버튼으로 댓글 참여를 쉽게 시작할 수 있어요.',
  },
  {
    emoji: '🏛️', name: '정당', path: '/parties', badge: '입당·유세',
    desc: '국민안정당·청년혁명당·중도민주당 중 한 곳에 입당하고, 활동으로 정치력을 쌓아 당대표를 노립니다.',
    examples: ['정당 입당', '정당별 정치력과 당원 확인', '당내 1위가 대선 후보로 연결'],
    tip: '정당에 입당하면 정치게임 흐름이 더 명확해집니다.',
  },
  {
    emoji: '👑', name: '대통령 선거', path: '/election', badge: '대선 판세',
    desc: '정당 당대표 또는 AI 후보가 대선에 출마합니다. 유저 투표로 대통령이 결정되고, 대통령은 포고령을 발표할 수 있습니다.',
    examples: ['후보별 득표율 확인', '공약 작성·공약 추천', '대통령 포고령 발표·추천'],
    tip: '내가 후보라면 공약 추천을 활용해 유권자에게 메시지를 보여주세요.',
  },
  {
    emoji: '🏛️', name: '소소국회', path: '/congress', badge: '법안·탄핵',
    desc: '정당 세력과 대통령 권력을 견제하는 공간입니다. 법안과 탄핵소추 흐름이 헌법재판소와 조기대선으로 이어집니다.',
    examples: ['법안 표결', '대통령 견제', '탄핵소추 흐름 확인'],
    tip: '국회는 대선 이후 정국을 흔드는 핵심 이벤트입니다.',
  },
  {
    emoji: '⚖️', name: '헌법재판소', path: '/constitutional-court', badge: '탄핵심판',
    desc: '국회 탄핵소추 이후 최종 심판이 열리는 단계입니다. 인용 시 대통령 파면과 조기대선 흐름으로 연결됩니다.',
    examples: ['탄핵심판 진행 상황', 'AI 재판관 의견', '인용·기각 결과 확인'],
    tip: '탄핵은 국회와 헌재가 이어지는 권력 견제 이벤트입니다.',
  },
];

const RANK_ITEMS = [
  ['👤', '평민', '0P'], ['🏡', '동민', '100P'], ['📜', '향사', '300P'],
  ['🏛️', '군수', '700P'], ['⚔️', '부사', '1,500P'], ['🎓', '사대부', '3,000P'],
  ['👑', '당대표', '6,000P'], ['🏅', '국무총리', '12,000P'], ['🌟', '대통령', '25,000P'],
];

const EARN_TABLE = [
  ['첫 가입 보너스', '+500P', true],
  ['매일 출석 체크', '+20P', true],
  ['정치배틀 투표', '+5P', true],
  ['대통령 선거 투표', '+5P', true],
  ['탄핵 청원 서명', '+5P', true],
  ['글 작성', '+10P', false],
  ['댓글 작성', '+20P', false],
  ['댓글에 반응', '+1P', false],
];

const LIMIT_TABLE = [
  ['정치배틀 투표', '1표/일', true],
  ['대통령 선거 투표', '1표/선거', true],
  ['헌법재판소 AI 의견', '심판별 제한', false],
  ['추천 문구 버튼', '입력 보조 기능', false],
];

const ROUTINE = [
  ['1', '공화국 확인', '오늘 정치 루틴과 내 진행도를 확인합니다.', '/republic'],
  ['2', '정치배틀 투표', '정당 입장을 보고 하루 한 표를 행사합니다.', '/battle'],
  ['3', '정당 활동', '입당·유세·정당 세력을 확인합니다.', '/parties'],
  ['4', '대선 참여', '후보·공약·투표·포고령 흐름을 확인합니다.', '/election'],
  ['5', '국회·헌재 확인', '법안과 탄핵 정국을 확인합니다.', '/congress'],
];

const RULES = [
  ['✅', '허용', '가벼운 유머, 게임 세계관 안의 토론, 정당 응원', 'success'],
  ['✅', '허용', '공개 이슈에 대한 의견 표현 (비방·혐오 없이)', 'success'],
  ['❌', '금지', '특정인 신상 공개, 협박, 성희롱, 혐오 발언', 'danger'],
  ['❌', '금지', '광고·스팸성 내용, 명백한 불법 콘텐츠', 'danger'],
  ['⚠️', '주의', 'AI와 자동 추천 문구는 재미와 입력 보조 목적입니다. 실제 판단으로 사용하지 마세요.', 'warning'],
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
        <div class="guide-hero__icon">🏛️</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">정당에 입당하고 정치력을 쌓아 당대표, 대통령, 국회·헌재까지 도전하는 가상 정치 공화국</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[['#guide-what','소소킹이란?'],['#guide-routine','오늘 정치 루틴'],['#guide-features','주요 기능'],['#guide-rank','권력 사다리'],['#guide-limit','이용 제한'],['#guide-points','포인트 안내'],['#guide-rules','이용 규칙']].map(([href, label]) => `<a class="guide-toc__item" href="${href}">${label}</a>`).join('')}
        </div>
      </div>

      <section id="guide-what" class="guide-section">
        <h2 class="guide-section__title">🤔 소소킹이란?</h2>
        <div class="guide-section__body">
          <p>소소킹은 <strong>소소공화국이라는 가상 정치 세계</strong>에서 정당, 대선, 국회, 헌법재판소, 정치배틀을 즐기는 참여형 정치 시뮬레이션입니다.</p>
          <p>정치배틀에 투표하고, 정당에 입당하고, 정치력을 쌓아 당대표가 되면 대선 후보로 연결됩니다. 대통령이 되면 포고령을 발표하고 지지율과 탄핵 정국까지 경험할 수 있습니다.</p>
          <p>모든 정당·정치인·선거·탄핵은 <strong>오락 목적의 가상 콘텐츠</strong>이며 현실 정치와 무관합니다.</p>
        </div>
      </section>

      <section id="guide-routine" class="guide-section">
        <h2 class="guide-section__title">📋 오늘 정치 루틴</h2>
        <div class="guide-step-list">
          ${ROUTINE.map(([num, title, desc, path]) => `
            <div class="guide-step" data-path="${path}" style="cursor:pointer">
              <div class="guide-step__num">${num}</div>
              <div>
                <div class="guide-step__title">${title}</div>
                <div class="guide-step__desc">${desc}</div>
              </div>
            </div>`).join('')}
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

      <section id="guide-rank" class="guide-section">
        <h2 class="guide-section__title">👑 권력 사다리</h2>
        <div class="guide-section__body">
          <p>글·댓글·투표 등 모든 활동이 <b>정치력(P)</b>이 됩니다. 정치력이 쌓이면 등급이 오르고, 당대표와 대통령까지 도전할 수 있습니다.</p>
          <div class="guide-rank-list">
            ${RANK_ITEMS.map(([emoji, title, p]) => `
              <div class="guide-rank-item">
                <span class="guide-rank-item__emoji">${emoji}</span>
                <span class="guide-rank-item__label">${title}</span>
                <span class="guide-rank-item__min">${p}~</span>
              </div>`).join('')}
          </div>
          <p>당내 정치력 1위는 <b>당대표</b>가 되고, 대선 후보로 출마합니다. 대선에서 이기면 <b>대통령</b>이 되어 포고령을 발표할 수 있습니다.</p>
        </div>
      </section>

      <section id="guide-limit" class="guide-section">
        <h2 class="guide-section__title">⏱️ 이용 제한</h2>
        <div class="guide-section__body">
          <div class="guide-notice">
            <strong>🆓 현재 무료 운영 중!</strong><br>
            투표, AI 의견, 추천 문구 등 일부 기능은 공정성과 운영 안정성을 위해 횟수 제한이 있을 수 있습니다.
          </div>
          ${guideTable(LIMIT_TABLE, ['기능', '이용 기준'])}
        </div>
      </section>

      <section id="guide-points" class="guide-section">
        <h2 class="guide-section__title">🪙 포인트 안내</h2>
        <div class="guide-section__body">
          <p>소소킹에서 활동할수록 포인트와 정치력이 쌓입니다.</p>
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
          🏛️ 공화국 시작하기
        </button>
      </div>
    </div>`;

  el.querySelectorAll('[data-path]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.path)));
  el.querySelector('#btn-guide-start')?.addEventListener('click', () => navigate('/republic'));
}
