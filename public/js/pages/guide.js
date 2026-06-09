import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const CHARS_6 = ['🎒 사춘기 중딩', '🙏 사이비 교주', '🔮 예언가', '🤩 주접러', '👀 참견러', '👴 꼰대'];

const FEATURES = [
  {
    emoji: '⚖️',
    name: '판결소',
    path: '/ai-judge',
    badge: '6인 AI',
    desc: '억울한 상황을 적으면 6인 캐릭터 중 랜덤 3인이 각자의 세계관으로 판결을 내립니다. 캐릭터를 직접 고를 수도 있어요!',
    examples: [
      '친구가 내 치킨 허락없이 먹음 → 유죄/무죄?',
      '카톡 읽씹 → 이게 잘못인가?',
      '발표 자료에서 오타 발견 → 진행? 취소?',
    ],
    extra: `<div style="font-size:12px;color:var(--color-text-muted)">${CHARS_6.join(' · ')}</div>`,
    tip: '사진도 첨부할 수 있어요. 상황 사진만 올려도 판결해 드립니다!',
  },
  {
    emoji: '✨',
    name: '창작소',
    path: '/ai-translate',
    badge: '6인 AI',
    desc: '번역하기 + 이름짓기 두 탭으로 구성. 6인 캐릭터 중 3인이 각자의 스타일로 창작합니다. 사진 속 글자도 OK!',
    examples: [
      '오늘 밥 먹었어? → 🙏 교주: "형제여, 몸을 위한 성찬으로 이 순간을 채우소서"',
      '회의 때 항상 졸는 팀장 → 👴 꼰대: "졸음극복팀장" (우리 때는 졸면 혼났어)',
    ],
    extra: `<div style="font-size:12px;color:var(--color-text-muted)">${CHARS_6.join(' · ')}</div>`,
    tip: '텍스트 없이 이미지만 올려도 번역·작명이 가능해요.',
  },
  {
    emoji: '🗣️',
    name: '토론방',
    path: '/feed',
    badge: 'A/B 투표',
    desc: '뜨거운 주제로 A편 vs B편 투표를 하고 댓글로 갑론을박! 직접 주제를 올릴 수도 있어요.',
    examples: [
      '치킨 : 부먹 vs 찍먹 → 어느 편?',
      '카톡 읽씹은 실례인가? → 실례다 vs 아니다',
      '회식 참석 → 당연히 가야지 vs 칼퇴가 정답',
    ],
    tip: '토론 주제를 올릴 때 A편·B편 선택지를 직접 입력해보세요!',
  },
  {
    emoji: '🗨️',
    name: '수다방',
    path: '/jabdam',
    badge: '채팅 + 게임',
    desc: '자유롭게 글 올리고 수다! 탭으로 끝말잇기·초성게임도 즐길 수 있어요.',
    examples: [
      '📝 자유 수다 — 링크·유튜브 첨부도 가능',
      '🔗 끝말잇기 — 마지막 글자로 이어가기',
      '🎯 초성게임 — 초성 보고 정답 맞추기',
    ],
    tip: '로그인 없이도 글을 읽을 수 있어요. 참여는 로그인 후!',
  },
];

export function renderGuide() {
  setMeta('이용안내');
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">🤖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">판결소·창작소·토론방·수다방 — 4가지 기능과<br>개성 넘치는 AI 캐릭터 6인이 함께합니다</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[
            ['#guide-what',    '소소킹이란?'],
            ['#guide-features','4가지 기능 소개'],
            ['#guide-chars',   '6인 AI 캐릭터'],
            ['#guide-start',   '시작하기'],
            ['#guide-limit',   'AI 이용 제한'],
            ['#guide-ladder',  '사다리게임 추가 기회'],
            ['#guide-points',  '포인트 안내'],
            ['#guide-share',   '결과 공유하기'],
            ['#guide-rules',   '이용 규칙'],
          ].map(([href, label]) => `<a class="guide-toc__item" href="${href}">${label}</a>`).join('')}
        </div>
      </div>

      <section id="guide-what" class="guide-section">
        <h2 class="guide-section__title">🤔 소소킹이란?</h2>
        <div class="guide-section__body">
          <p>소소킹은 <strong>AI와 함께 즐기는 참여형 커뮤니티</strong>입니다.</p>
          <p><strong>판결소·창작소</strong>에서는 개성 넘치는 AI 캐릭터 6인이 판결하고 번역하고 이름을 짓습니다. <strong>토론방</strong>에서는 뜨거운 주제로 A/B 투표 토론을, <strong>수다방</strong>에서는 자유 채팅과 끝말잇기·초성게임을 즐길 수 있어요!</p>
          <p>AI 결과물은 자동으로 피드에 게시되어 <strong>다른 사람들이 댓글로 반응</strong>할 수 있고, 재밌는 결과는 카카오톡으로 공유할 수 있어요!</p>
        </div>
      </section>

      <section id="guide-features" class="guide-section">
        <h2 class="guide-section__title">🚀 4가지 기능 소개</h2>
        <div style="display:flex;flex-direction:column;gap:20px;margin-top:16px">
          ${FEATURES.map(f => `
            <div class="card" style="padding:20px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <span style="font-size:32px">${f.emoji}</span>
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="font-size:18px;font-weight:900;color:var(--color-text-primary)">${f.name}</div>
                    <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--color-primary-bg);color:var(--color-primary)">${f.badge}</span>
                  </div>
                  <div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px">${f.desc}</div>
                </div>
              </div>
              <div style="background:var(--color-surface-2);border-radius:10px;padding:12px;margin-bottom:10px">
                <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:8px">예시</div>
                ${f.examples.map(e => `<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:4px">• ${e}</div>`).join('')}
              </div>
              ${f.extra ? f.extra : ''}
              ${f.tip ? `<div style="font-size:12px;color:var(--color-primary);margin-top:8px">💡 ${f.tip}</div>` : ''}
              <button class="btn btn--primary btn--sm" style="margin-top:14px" data-path="${f.path}">
                ${f.emoji} ${f.name} 바로가기
              </button>
            </div>`).join('')}
        </div>
      </section>

      <section id="guide-chars" class="guide-section">
        <h2 class="guide-section__title">👥 6인 AI 캐릭터 (판결소·창작소 전용)</h2>
        <div class="guide-section__body">
          <p>판결소·창작소에서는 아래 6인의 개성 강한 AI 캐릭터가 활동합니다. 요청 시 랜덤 3인이 출동하거나, 원하는 캐릭터를 직접 골라 3인 조합을 만들 수 있어요.</p>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px">
            ${[
              { emoji: '🎒', name: '사춘기 중딩', desc: '팩폭 직격 · "ㄹㅇ 어른들 왜 이리 복잡하게 삶ㅋ"' },
              { emoji: '🙏', name: '사이비 교주', desc: '포교·계시 · "형제여, 이것은 신의 뜻이니라"' },
              { emoji: '🔮', name: '예언가',      desc: '운명 예언 · "~하리라... 서쪽을 조심하라"' },
              { emoji: '🤩', name: '주접러',      desc: '과잉 리액션 · "미쳤다 실화임?? 소름ㄷㄷ"' },
              { emoji: '👀', name: '참견러',      desc: '오지랖 만렙 · "아 그거 우리 옆집도 그랬어"' },
              { emoji: '👴', name: '꼰대',        desc: '우리때는~ · "내가 말이야, 요즘 것들은..."' },
            ].map(c => `
              <div style="padding:12px;background:var(--color-surface-2);border-radius:12px">
                <div style="font-size:24px;margin-bottom:4px">${c.emoji}</div>
                <div style="font-size:13px;font-weight:800;color:var(--color-text-primary)">${c.name}</div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;line-height:1.4">${c.desc}</div>
              </div>`).join('')}
          </div>
        </div>
      </section>

      <section id="guide-start" class="guide-section">
        <h2 class="guide-section__title">📖 시작하기</h2>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
          ${[
            ['1', '회원가입', '구글 또는 카카오 계정으로 간편하게 가입할 수 있어요.'],
            ['2', '기능 선택', '판결소, 창작소, 토론방, 수다방 중 원하는 기능으로 이동하세요.'],
            ['3', '참여하기', 'AI킹 기능은 상황을 입력하고, 토론방은 투표를, 수다방은 글을 올려보세요!'],
            ['4', '결과 확인', 'AI 결과는 자동으로 피드에 게시되며, 다른 사람들의 댓글을 받을 수 있어요.'],
            ['5', '공유하기', '재밌는 결과는 링크 복사나 카카오톡으로 친구에게 공유해보세요!'],
          ].map(([num, title, desc]) => `
            <div style="display:flex;gap:14px;align-items:flex-start">
              <div style="min-width:32px;height:32px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px">${num}</div>
              <div>
                <div style="font-weight:700;color:var(--color-text-primary);margin-bottom:2px">${title}</div>
                <div style="font-size:13px;color:var(--color-text-secondary)">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </section>

      <section id="guide-limit" class="guide-section">
        <h2 class="guide-section__title">⏱️ AI 이용 제한</h2>
        <div class="guide-section__body">
          <div class="guide-notice">
            <strong>🆓 현재 무료 운영 중!</strong><br>
            판결소·창작소(AI 기능)는 하루 <strong>3회</strong>까지 무료로 이용할 수 있어요.<br>
            자정(00:00 KST)에 횟수가 초기화됩니다.<br>
            <span style="font-size:12px;color:var(--color-text-muted)">토론방·수다방은 이용 횟수 제한 없이 자유롭게 이용 가능해요.</span>
          </div>
          <table style="width:100%;margin-top:14px;font-size:13px;border-collapse:collapse">
            <tr style="background:var(--color-surface-2)">
              <th style="padding:8px 12px;text-align:left;border-radius:8px 0 0 0">기능</th>
              <th style="padding:8px 12px;text-align:center;border-radius:0 8px 0 0">하루 무료 횟수</th>
            </tr>
            ${[
              ['⚖️ 판결소', '3회', false],
              ['✨ 창작소 (번역·작명 각각)', '3회', false],
              ['🗣️ 토론방', '제한 없음', true],
              ['🗨️ 수다방', '제한 없음', true],
            ].map(([k, v, free]) => `
              <tr style="border-top:1px solid var(--color-border)">
                <td style="padding:8px 12px">${k}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:700;color:${free ? 'var(--color-success)' : 'var(--color-text-primary)'}">${v}</td>
              </tr>`).join('')}
          </table>
        </div>
      </section>

      <section id="guide-ladder" class="guide-section">
        <h2 class="guide-section__title">🎰 사다리게임 추가 기회</h2>
        <div class="guide-section__body">
          <div class="guide-notice">
            <strong>🆓 AI 무료 횟수를 다 쓰셨나요?</strong><br>
            사다리게임을 하면 <strong>AI 추가 이용권</strong>을 무료로 얻을 수 있어요!
          </div>
          <table style="width:100%;margin-top:14px;font-size:13px;border-collapse:collapse">
            <tr style="background:var(--color-surface-2)">
              <th style="padding:8px 12px;text-align:left;border-radius:8px 0 0 0">항목</th>
              <th style="padding:8px 12px;text-align:center;border-radius:0 8px 0 0">내용</th>
            </tr>
            ${[
              ['참여 방법', '판결소 또는 창작소 횟수 소진 시 사다리게임 화면 자동 안내'],
              ['하루 참여', '1일 1회 무료 참여 가능'],
              ['보상', 'AI 추가 이용권 1회 (판결소·창작소 어디서나 사용)'],
              ['초기화', '매일 자정(00:00 KST)에 초기화'],
            ].map(([label, val]) => `
              <tr style="border-top:1px solid var(--color-border)">
                <td style="padding:8px 12px;font-weight:700">${label}</td>
                <td style="padding:8px 12px;text-align:center">${val}</td>
              </tr>`).join('')}
          </table>
        </div>
      </section>

      <section id="guide-points" class="guide-section">
        <h2 class="guide-section__title">🪙 포인트 안내</h2>
        <div class="guide-section__body">
          <p>소소킹에서 활동할수록 포인트가 쌓여요!</p>
          <div class="guide-notice" style="margin-top:12px">
            <strong>💡 포인트 적립 방법</strong>
          </div>
          <table style="width:100%;margin-top:10px;font-size:13px;border-collapse:collapse">
            <tr style="background:var(--color-surface-2)">
              <th style="padding:8px 12px;text-align:left;border-radius:8px 0 0 0">활동</th>
              <th style="padding:8px 12px;text-align:center;border-radius:0 8px 0 0">적립</th>
            </tr>
            ${[
              ['첫 가입 보너스', '+500p'],
              ['매일 출석 체크', '+20p'],
              ['글 작성', '+10p'],
              ['댓글 작성', '+20p'],
              ['댓글에 반응 남기기', '+1p'],
              ['투표 참여', '+1p'],
              ['내 글에 반응 받기', '+1p'],
            ].map(([label, pts]) => `
              <tr style="border-top:1px solid var(--color-border)">
                <td style="padding:8px 12px">${label}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--color-primary)">${pts}</td>
              </tr>`).join('')}
          </table>
        </div>
      </section>

      <section id="guide-share" class="guide-section">
        <h2 class="guide-section__title">📤 결과 공유하기</h2>
        <div class="guide-section__body">
          <p>판결소·창작소 결과 페이지에서 <strong>링크 복사 버튼(🔗)</strong>을 누르면 누구에게나 공유할 수 있어요.</p>
          <p>웃긴 판결문, 황당한 번역, 찰떡 작명 결과를 친구들에게 보내보세요!</p>
          <p style="color:var(--color-primary);font-weight:700">💡 "야 판결킹한테 우리 상황 올려봤는데 봐봐 ㅋㅋㅋ" 이런 거 기대하고 만들었습니다.</p>
        </div>
      </section>

      <section id="guide-rules" class="guide-section">
        <h2 class="guide-section__title">📋 이용 규칙</h2>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
          ${[
            ['✅', '허용', '가벼운 유머, 일상 고민, 재미있는 상황, 웃긴 번역 요청'],
            ['✅', '허용', '공인에 대한 공개된 사실 (단, 비방 없이)'],
            ['❌', '금지', '특정인 신상 공개, 협박, 성희롱, 혐오 발언'],
            ['❌', '금지', '광고·스팸성 내용'],
            ['❌', '금지', '명백한 불법 콘텐츠'],
            ['⚠️', '주의', 'AI 결과물은 재미 목적으로만 활용하세요. 실제 법적 판단이나 의학적 조언이 아닙니다.'],
          ].map(([icon, type, desc]) => `
            <div style="display:flex;gap:10px;padding:10px 14px;background:var(--color-surface-2);border-radius:10px">
              <span style="font-size:16px;min-width:20px">${icon}</span>
              <div>
                <strong style="font-size:12px;color:${type === '금지' ? 'var(--color-danger)' : type === '주의' ? 'var(--color-warning)' : 'var(--color-success)'}">${type}</strong>
                <div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </section>

      <div style="text-align:center;padding:32px 0 16px">
        <button class="btn btn--primary" id="btn-guide-start" style="font-size:16px;padding:14px 32px;font-weight:900">
          🤖 소소킹 시작하기
        </button>
      </div>
    </div>`;

  el.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
  });
  el.querySelector('#btn-guide-start')?.addEventListener('click', () => navigate('/ai-king'));
}
