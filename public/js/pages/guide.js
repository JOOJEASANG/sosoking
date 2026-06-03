import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const AI_KINGS = [
  {
    emoji: '⚖️',
    name: '미친판사',
    path: '/ai-judge',
    desc: '억울한 상황을 적으면 개성 강한 판사 3명이 각자 판결을 내립니다. 판사는 직접 고르거나 랜덤으로 뽑혀요.',
    examples: ['친구가 내 치킨 허락없이 먹음 → 유죄/무죄?', '카톡 읽씹 → 이게 잘못인가?'],
    judges: ['⚖️ 엄근진 법관', '😭 감성 판사', '👴 꼰대 판사', '🔬 과학자 판사', '🤔 철학자 판사', '👽 외계인 판사', '🤪 돌아이 판사'],
  },
  {
    emoji: '🌍',
    name: '사투리번역사',
    path: '/ai-translate',
    desc: '어떤 텍스트든 진짜 그 지역 사람처럼 사투리로 번역해드립니다. 사진 속 글자도 번역 가능!',
    examples: ['오늘 밥 먹었어? → 🔥 오늘 밥 무봤나? 억수로 배고프데이', '회의 언제 끝나요? → 🐢 회의 언제 끝나유~ 천천히 하지유'],
    styles: ['🔥 경상도 사투리', '🌾 전라도 사투리', '🐢 충청도 사투리', '🗺️ 연변 사투리'],
  },
  {
    emoji: '💘',
    name: 'AI궁합',
    path: '/ai-match',
    desc: '두 가지를 입력하면 AI가 궁합 점수와 분석을 해드립니다. 사람도 음식도 뭐든 OK.',
    examples: ['나 + 우리 팀장 → 천생연분 or 최악의조합?', '치킨 + 맥주 → 궁합 91% 찰떡!'],
    tip: '이름만 써도 되고 사진을 첨부하면 더 재밌는 분석이 나와요.',
  },
  {
    emoji: '🎭',
    name: 'AI작명소',
    path: '/ai-naming',
    desc: '설명하거나 사진을 올리면 AI가 웃기고 그럴듯한 이름을 5개 지어드립니다. 사람·음식·동물·물건 뭐든 OK.',
    examples: ['회의 때 항상 졸는 팀장 → "숨참고버티기팀장", "회의의신"...', '매운 듯 안 매운 듯 애매한 떡볶이 → "기묘한매움탕"...'],
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
        <p class="guide-hero__sub">AI가 판결하고, 번역하고, 궁합 보고, 이름 짓는<br>대한민국 유일무이한 AI 놀이터입니다 ㅋㅋ</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[
            ['#guide-what',   '소소킹이란?'],
            ['#guide-kings',  'AI킹 4종 소개'],
            ['#guide-start',  '시작하기'],
            ['#guide-limit',  '일일 사용 제한'],
            ['#guide-ladder', '사다리게임 추가 기회'],
            ['#guide-points', '포인트 사용 안내'],
            ['#guide-share',  '결과 공유하기'],
            ['#guide-rules',  '이용 규칙'],
          ].map(([href, label]) => `<a class="guide-toc__item" href="${href}">${label}</a>`).join('')}
        </div>
      </div>

      <section id="guide-what" class="guide-section">
        <h2 class="guide-section__title">🤔 소소킹이란?</h2>
        <div class="guide-section__body">
          <p>소소킹은 <strong>AI를 재미있게 활용하는 커뮤니티</strong>입니다.</p>
          <p>딱딱한 AI 챗봇이 아니라, <strong>웃기고 황당하고 공감 가는</strong> AI 캐릭터들이 여러분의 요청을 처리합니다.</p>
          <p>결과물은 자동으로 게시되어 <strong>다른 사람들이 댓글로 반응</strong>할 수 있어요. 재밌는 결과는 카카오톡으로 공유해보세요!</p>
        </div>
      </section>

      <section id="guide-kings" class="guide-section">
        <h2 class="guide-section__title">👑 AI킹 4종 소개</h2>
        <div style="display:flex;flex-direction:column;gap:20px;margin-top:16px">
          ${AI_KINGS.map(k => `
            <div class="card" style="padding:20px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <span style="font-size:32px">${k.emoji}</span>
                <div>
                  <div style="font-size:18px;font-weight:900;color:var(--color-text-primary)">${k.name}</div>
                  <div style="font-size:13px;color:var(--color-text-secondary)">${k.desc}</div>
                </div>
              </div>
              <div style="background:var(--color-surface-2);border-radius:10px;padding:12px;margin-bottom:12px">
                <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:8px">예시</div>
                ${k.examples.map(e => `<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:4px">• ${e}</div>`).join('')}
              </div>
              ${k.judges ? `<div style="font-size:12px;color:var(--color-text-muted)">${k.judges.join(' · ')}</div>` : ''}
              ${k.styles ? `<div style="font-size:12px;color:var(--color-text-muted)">${k.styles.join(' · ')}</div>` : ''}
              ${k.categories ? `<div style="font-size:12px;color:var(--color-text-muted)">${k.categories.join(' · ')}</div>` : ''}
              ${k.tip ? `<div style="font-size:12px;color:var(--color-primary);margin-top:8px">💡 ${k.tip}</div>` : ''}
              <button class="btn btn--primary btn--sm" style="margin-top:14px" data-path="${k.path}">
                ${k.emoji} ${k.name} 해보기
              </button>
            </div>`).join('')}
        </div>
      </section>

      <section id="guide-start" class="guide-section">
        <h2 class="guide-section__title">🚀 시작하기</h2>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
          ${[
            ['1', '회원가입', '구글 또는 카카오 계정으로 간편하게 가입할 수 있어요.'],
            ['2', 'AI킹 선택', '미친판사, 사투리번역사, AI궁합, AI작명소 중 하나를 선택하세요.'],
            ['3', '내용 입력', '상황, 텍스트, 두 가지 대상, 또는 이름 지을 대상을 입력하세요.'],
            ['4', '결과 확인', '자동으로 결과 페이지로 이동하며 댓글로 반응할 수 있어요.'],
            ['5', '공유하기', '재밌는 결과는 카카오톡이나 링크로 공유해보세요!'],
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
        <h2 class="guide-section__title">⏱️ 이용 제한</h2>
        <div class="guide-section__body">
          <div class="guide-notice">
            <strong>🆓 현재 무료 운영 중!</strong><br>
            각 AI킹은 하루 <strong>3회</strong>까지 무료로 이용할 수 있어요.<br>
            자정(00:00 KST)에 횟수가 초기화됩니다.
          </div>
          <table style="width:100%;margin-top:14px;font-size:13px;border-collapse:collapse">
            <tr style="background:var(--color-surface-2)">
              <th style="padding:8px 12px;text-align:left;border-radius:8px 0 0 0">AI킹</th>
              <th style="padding:8px 12px;text-align:center;border-radius:0 8px 0 0">하루 무료 횟수</th>
            </tr>
            ${['⚖️ 미친판사', '🌍 사투리번역사', '💘 AI궁합', '🎭 AI작명소'].map(k => `
              <tr style="border-top:1px solid var(--color-border)">
                <td style="padding:8px 12px">${k}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:700">3회</td>
              </tr>`).join('')}
          </table>
        </div>
      </section>

      <section id="guide-ladder" class="guide-section">
        <h2 class="guide-section__title">🎰 사다리게임 추가 기회</h2>
        <div class="guide-section__body">
          <div class="guide-notice">
            <strong>🆓 무료 횟수를 다 쓰셨나요?</strong><br>
            사다리게임을 하면 <strong>AI킹 추가 이용권</strong>을 무료로 얻을 수 있어요!
          </div>
          <table style="width:100%;margin-top:14px;font-size:13px;border-collapse:collapse">
            <tr style="background:var(--color-surface-2)">
              <th style="padding:8px 12px;text-align:left;border-radius:8px 0 0 0">항목</th>
              <th style="padding:8px 12px;text-align:center;border-radius:0 8px 0 0">내용</th>
            </tr>
            ${[
              ['참여 방법', '홈 또는 AI킹 페이지 → 사다리게임 버튼'],
              ['하루 참여', '1일 1회 무료 참여 가능'],
              ['보상', 'AI킹 추가 이용권 1~3회 (결과에 따라 다름)'],
              ['초기화', '매일 자정(00:00 KST)에 참여 횟수 초기화'],
            ].map(([label, val]) => `
              <tr style="border-top:1px solid var(--color-border)">
                <td style="padding:8px 12px;font-weight:700">${label}</td>
                <td style="padding:8px 12px;text-align:center">${val}</td>
              </tr>`).join('')}
          </table>
          <p style="margin-top:12px;font-size:13px;color:var(--color-text-secondary)">
            💡 추가 이용권은 4가지 AI킹 어디서나 공통으로 사용할 수 있어요.
          </p>
        </div>
      </section>

      <section id="guide-points" class="guide-section">
        <h2 class="guide-section__title">🪙 포인트 사용 안내</h2>
        <div class="guide-section__body">
          <p>활동 포인트를 모아 <strong>AI킹 추가 이용권</strong>을 구입할 수 있어요.</p>
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
              ['내 글에 좋아요 받기', '+5p'],
              ['내 글에 댓글 받기', '+10p'],
              ['글 작성', '+10p'],
            ].map(([label, pts]) => `
              <tr style="border-top:1px solid var(--color-border)">
                <td style="padding:8px 12px">${label}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--color-primary)">${pts}</td>
              </tr>`).join('')}
          </table>
          <div class="guide-notice" style="margin-top:16px">
            <strong>🛒 포인트 사용처</strong>
          </div>
          <p style="margin-top:10px;font-size:13px;color:var(--color-text-secondary)">
            포인트로 AI킹 추가 이용권을 구입할 수 있어요. 이용권 1회당 100p가 필요하며 10회 구매 시 3회 보너스가 제공됩니다.<br>
            <a href="#/points-shop" style="color:var(--color-primary);font-weight:700">→ 포인트 상점 바로가기</a>
          </p>
        </div>
      </section>

      <section id="guide-share" class="guide-section">
        <h2 class="guide-section__title">📤 결과 공유하기</h2>
        <div class="guide-section__body">
          <p>AI킹 결과 페이지에서 <strong>링크 복사 버튼(🔗)</strong>을 누르면 결과를 공유할 수 있어요.</p>
          <p>재밌는 판결문, 웃긴 번역, 황당한 궁합 결과를 친구들에게 공유해보세요!</p>
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
            ['❌', '금지', '광고/스팸성 내용'],
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
          🤖 AI킹 놀이터 바로가기
        </button>
      </div>
    </div>`;

  el.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
  });
  el.querySelector('#btn-guide-start')?.addEventListener('click', () => navigate('/ai-king'));
}
