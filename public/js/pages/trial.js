import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const DOCKET_STEPS = [
  ['filed', '사건접수', '사건번호 부여'],
  ['investigation', '수사보고', '정황·증거 검토'],
  ['plaintiff', '원고측 변론', '청구취지 정리'],
  ['defendant', '피고측 변론', '답변·항변 정리'],
  ['sentenced', '재판부 판결', '주문 및 이유']
];

const PROGRESS_STAGES = DOCKET_STEPS.map(([id]) => id);
const JUDGES = [
  ['꼰대형', '🧓'],
  ['냉혈형', '🧊'],
  ['회피형', '🏃'],
  ['추궁형', '🔎'],
  ['오버형', '🚨'],
  ['드립형', '🎭'],
  ['빙의형', '🌀']
];

const STAGE_LOADING = {
  filed: '접수계가 사건 서류를 낚아챘습니다.\n사건번호 부여 중 · 담당 판사 긴급 호출 중',
  investigation: '수사기록을 펼치고 정황을 맞추는 중입니다.\n증거판에 빨간 줄이 하나씩 늘어나고 있습니다.',
  plaintiff: '원고석 마이크가 켜졌습니다.\n억울함을 청구취지와 주장요지로 정리하고 있습니다.',
  defendant: '피고석에서 반론이 들어오고 있습니다.\n앞선 진술과 충돌하는 부분을 조용히 체크하는 중입니다.',
  sentenced: '재판부가 마지막 숙의에 들어갔습니다.\n법봉을 들고 이 사건만의 생활형 처분을 확정하는 중입니다.'
};

const STAGE_EMOJI = {
  filed: '📋',
  investigation: '🔍',
  plaintiff: '🗣️',
  defendant: '🛡️',
  sentenced: '🔨'
};

const STAGE_SCENE = {
  filed: ['접수 완료 대기', '서류가 재판부로 이동 중'],
  investigation: ['수사기록 분석', '사건의 앞뒤를 맞추는 중'],
  plaintiff: ['원고측 변론', '억울함을 조목조목 정리 중'],
  defendant: ['피고측 변론', '반론과 사정을 검토 중'],
  sentenced: ['재판부 숙의', 'AI 판사가 주문을 작성 중']
};

const STAGE_PROGRESS = {
  filed: 12,
  investigation: 34,
  plaintiff: 56,
  defendant: 78,
  sentenced: 94
};

const JUDGE_PROGRESS = {
  '꼰대형': [
    '꼰대형 판사가 이 사건이 결국 기본과 예의의 문제였다는 결론부터 참지 못하고 있습니다.',
    '조사 기록에서 “그 정도는 알아서 했어야지”라고 말할 지점을 찾는 중입니다.',
    '원고가 원했던 평범한 기본사항을 굳이 청구취지로 만드는 중입니다.',
    '피고의 해명이 왜 일을 시키기 전에 했어야 할 일을 더 분명하게 만드는지 검토 중입니다.',
    '생활수칙과 짧은 인생훈계가 함께 들어간 주문을 작성하는 중입니다.'
  ],
  '냉혈형': [
    '냉혈형 판사가 서운함을 잠시 치우고 실제로 무엇이 없어졌고 늦었는지 계산 중입니다.',
    '시간·횟수·결과만 남겨 사건을 냉정하게 재구성하는 중입니다.',
    '원고의 감정을 실제 불편과 결과 단위로 환산하는 중입니다.',
    '피고의 사정 설명 중 결과를 바꾸지 못하는 부분을 조용히 제외하는 중입니다.',
    '말보다 이행 여부가 바로 확인되는 차가운 생활형 처분을 확정하는 중입니다.'
  ],
  '회피형': [
    '회피형 판사가 왜 재판부가 여기까지 관여해야 하는지 관할부터 고민 중입니다.',
    '당사자끼리 해결할 마지막 탈출구가 남았는지 수사기록을 뒤지는 중입니다.',
    '원고 요구에서 재판부가 최소한으로 손댈 한 가지만 고르는 중입니다.',
    '피고가 지금 바로 해결하면 재판부가 퇴장할 수 있는지 검토 중입니다.',
    '다시는 이 사건을 보지 않기 위한 최소개입형 주문을 작성하는 중입니다.'
  ],
  '추궁형': [
    '추궁형 판사가 첫 문장부터 시간표현과 단어 하나를 표시해두는 중입니다.',
    '앞뒤가 맞지 않는 한 지점을 잡고 진술 순서를 다시 맞추는 중입니다.',
    '원고 주장 중 피고에게 다시 물어볼 정확한 질문을 뽑는 중입니다.',
    '피고의 설명이 자기 앞문장과 충돌하는 순간을 끝까지 추적하는 중입니다.',
    '마지막까지 남은 모순 하나를 판결 이유에 못 박는 중입니다.'
  ],
  '오버형': [
    '오버형 판사가 생활분쟁을 비상상황으로 격상하고 상황판부터 펼치는 중입니다.',
    '사소한 현장을 대형사건 수사본부급 절차로 과하게 재구성하는 중입니다.',
    '원고의 평범한 요구를 생활질서 복구 작전의 목표로 격상하는 중입니다.',
    '피고의 항변이 이번 사태의 위기등급을 낮출 수 있는지 엄숙히 심사 중입니다.',
    '생활질서 정상화 조치를 국가적 선포처럼 주문에 적는 중입니다.'
  ],
  '드립형': [
    '드립형 판사가 이 사건에서만 가능한 핵심 소재 한 방을 찾는 중입니다.',
    '범용 농담은 기각하고 실제 사건 장면에서 웃기는 연결만 남기는 중입니다.',
    '원고의 진지함을 깨지 않으면서 사건 맞춤형 한 줄을 준비하는 중입니다.',
    '피고의 변명이 자기 말에 걸리는 순간을 드립 없이도 웃기게 정리하는 중입니다.',
    '첫 장면을 마지막 두 문장에서 회수할 콜백을 확정하는 중입니다.'
  ],
  '빙의형': [
    '빙의형 판사가 사건이 속한 세계의 실제 규칙과 익숙한 표현부터 파악하는 중입니다.',
    '게임이면 플레이 구조, 회사면 업무 흐름처럼 사건 분야의 문법으로 정황을 읽는 중입니다.',
    '원고가 그 세계에서 당연히 기대했을 정상적인 결과를 복원하는 중입니다.',
    '피고의 설명이 해당 분야의 실제 관습과 맞는지 과몰입 검토 중입니다.',
    '사건 세계관 안에서만 성립하는 생활형 처분과 마지막 콜백을 작성하는 중입니다.'
  ]
};

let caseData = null;

function ensureTrialAnimationStyle() {
  if (document.getElementById('trial-stage-animation-style')) return;
  const style = document.createElement('style');
  style.id = 'trial-stage-animation-style';
  style.textContent = `
    .trial-stage-page{--trial-gold:var(--gold);--trial-line:rgba(201,168,76,.24);}
    .trial-stage-page .trial-live{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid rgba(201,168,76,.34);border-radius:999px;background:rgba(201,168,76,.08);font-size:10px;font-weight:900;letter-spacing:.08em;color:var(--gold);}
    .trial-stage-page .trial-live-dot{width:7px;height:7px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 0 rgba(201,168,76,.55);animation:trial-live-pulse 1.4s ease-out infinite;}
    .trial-stage-page .trial-progress-shell{height:7px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03);}
    .trial-stage-page .trial-progress-bar{height:100%;width:12%;border-radius:999px;background:linear-gradient(90deg,rgba(201,168,76,.56),var(--gold));box-shadow:0 0 16px rgba(201,168,76,.34);transition:width .65s cubic-bezier(.2,.8,.2,1);position:relative;overflow:hidden;}
    .trial-stage-page .trial-progress-bar::after{content:'';position:absolute;inset:0;width:42%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);transform:translateX(-130%);animation:trial-progress-shine 1.7s linear infinite;}
    .trial-stage-page .trial-timeline{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;margin:18px 0 16px;position:relative;}
    .trial-stage-page .trial-timeline::before{content:'';position:absolute;left:9%;right:9%;top:21px;height:2px;background:var(--trial-line);z-index:0;}
    .trial-stage-page .trial-step{position:relative;z-index:1;text-align:center;min-width:0;color:var(--cream-dim);}
    .trial-stage-page .trial-step-orb{width:42px;height:42px;margin:0 auto 7px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--border);background:var(--surface);font-size:17px;transition:all .35s ease;}
    .trial-stage-page .trial-step-title{font-size:10px;font-weight:900;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .trial-stage-page .trial-step-sub{font-size:9px;line-height:1.35;margin-top:3px;opacity:.68;display:none;}
    .trial-stage-page .trial-step.is-done .trial-step-orb{border-color:rgba(201,168,76,.52);background:rgba(201,168,76,.09);color:var(--gold);}
    .trial-stage-page .trial-step.is-done .trial-step-title{color:var(--gold);}
    .trial-stage-page .trial-step.is-active .trial-step-orb{border-color:var(--gold);background:rgba(201,168,76,.18);box-shadow:0 0 0 5px rgba(201,168,76,.08),0 0 24px rgba(201,168,76,.2);transform:translateY(-2px);animation:trial-orb-float 1.25s ease-in-out infinite;}
    .trial-stage-page .trial-step.is-active .trial-step-title{color:var(--gold);}
    .trial-stage-page .trial-step.is-active .trial-step-sub{display:block;color:var(--cream-dim);}
    .trial-stage-page .trial-court-scene{position:relative;overflow:hidden;border:1px solid rgba(201,168,76,.3);border-radius:20px;padding:18px 14px 15px;background:radial-gradient(circle at 50% 0%,rgba(201,168,76,.12),transparent 42%),linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.04));min-height:238px;}
    .trial-stage-page .trial-court-scene::before{content:'SOSOKING AI COURT';position:absolute;top:9px;left:0;right:0;text-align:center;font-size:9px;font-weight:900;letter-spacing:.22em;color:rgba(201,168,76,.38);}
    .trial-stage-page .trial-court-light{position:absolute;width:180px;height:180px;left:50%;top:-88px;transform:translateX(-50%);border-radius:50%;background:rgba(201,168,76,.1);filter:blur(12px);animation:trial-light-breathe 2.4s ease-in-out infinite;pointer-events:none;}
    .trial-stage-page .trial-bench{position:relative;display:flex;align-items:flex-end;justify-content:center;min-height:104px;padding-top:18px;}
    .trial-stage-page .trial-judge{position:relative;z-index:3;width:84px;text-align:center;transition:transform .4s ease;}
    .trial-stage-page .trial-judge-avatar{width:58px;height:58px;margin:0 auto;display:grid;place-items:center;border-radius:50%;font-size:32px;background:var(--surface);border:1px solid rgba(201,168,76,.52);box-shadow:0 8px 24px rgba(0,0,0,.16);}
    .trial-stage-page .trial-judge-name{font-size:10px;font-weight:900;color:var(--gold);margin-top:5px;white-space:nowrap;}
    .trial-stage-page .trial-desk{position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);width:142px;height:27px;border:1px solid rgba(201,168,76,.3);border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,rgba(201,168,76,.16),rgba(201,168,76,.06));z-index:2;}
    .trial-stage-page .trial-gavel{position:absolute;z-index:5;left:calc(50% + 34px);bottom:12px;font-size:24px;transform-origin:70% 80%;opacity:.3;transition:opacity .3s ease;}
    .trial-stage-page .trial-document{position:absolute;z-index:4;left:calc(50% - 50px);bottom:8px;width:34px;height:43px;border-radius:3px;background:#f4ead8;border:1px solid rgba(92,64,22,.28);box-shadow:0 5px 12px rgba(0,0,0,.14);transform:rotate(-4deg);}
    .trial-stage-page .trial-document::before,.trial-stage-page .trial-document::after{content:'';position:absolute;left:6px;right:6px;height:2px;background:rgba(88,66,37,.25);}
    .trial-stage-page .trial-document::before{top:12px;box-shadow:0 7px 0 rgba(88,66,37,.2),0 14px 0 rgba(88,66,37,.18);}
    .trial-stage-page .trial-document::after{display:none;}
    .trial-stage-page .trial-magnifier{position:absolute;z-index:6;left:calc(50% - 6px);bottom:8px;font-size:29px;opacity:0;}
    .trial-stage-page .trial-parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;}
    .trial-stage-page .trial-party{position:relative;border:1px solid var(--border);border-radius:14px;padding:11px 10px;background:rgba(255,255,255,.02);text-align:center;transition:all .35s ease;}
    .trial-stage-page .trial-party-icon{font-size:24px;display:block;margin-bottom:3px;}
    .trial-stage-page .trial-party-label{font-size:11px;font-weight:900;}
    .trial-stage-page .trial-bubble{position:absolute;top:-18px;left:50%;transform:translateX(-50%) scale(.7);padding:5px 8px;border-radius:9px;background:var(--gold);color:#251a08;font-size:9px;font-weight:900;white-space:nowrap;opacity:0;transition:all .3s ease;box-shadow:0 6px 18px rgba(0,0,0,.12);}
    .trial-stage-page .trial-scene-caption{text-align:center;margin-top:12px;}
    .trial-stage-page .trial-scene-title{font-family:var(--font-serif);font-size:17px;font-weight:900;color:var(--gold);}
    .trial-stage-page .trial-scene-sub{font-size:11px;color:var(--cream-dim);margin-top:3px;}
    .trial-stage-page .trial-status-copy{margin-top:14px;padding:13px 14px;border-radius:14px;border:1px solid var(--border);background:rgba(255,255,255,.025);font-size:12px;color:var(--cream-dim);white-space:pre-line;line-height:1.7;text-align:left;min-height:82px;display:flex;align-items:center;}
    .trial-stage-page .trial-wait-note{text-align:center;margin-top:9px;font-size:10px;color:var(--cream-dim);opacity:.72;}
    .trial-stage-page .trial-court-scene[data-stage='filed'] .trial-document{animation:trial-document-file 1.35s ease-in-out infinite;}
    .trial-stage-page .trial-court-scene[data-stage='investigation'] .trial-magnifier{opacity:1;animation:trial-magnify 1.7s ease-in-out infinite;}
    .trial-stage-page .trial-court-scene[data-stage='investigation'] .trial-document{animation:trial-paper-twitch 1.7s ease-in-out infinite;}
    .trial-stage-page .trial-court-scene[data-stage='plaintiff'] .trial-party[data-side='plaintiff']{border-color:rgba(201,168,76,.72);background:rgba(201,168,76,.1);box-shadow:0 0 20px rgba(201,168,76,.08);transform:translateY(-2px);}
    .trial-stage-page .trial-court-scene[data-stage='plaintiff'] .trial-party[data-side='plaintiff'] .trial-bubble{opacity:1;transform:translateX(-50%) scale(1);animation:trial-bubble 1.25s ease-in-out infinite;}
    .trial-stage-page .trial-court-scene[data-stage='defendant'] .trial-party[data-side='defendant']{border-color:rgba(201,168,76,.72);background:rgba(201,168,76,.1);box-shadow:0 0 20px rgba(201,168,76,.08);transform:translateY(-2px);}
    .trial-stage-page .trial-court-scene[data-stage='defendant'] .trial-party[data-side='defendant'] .trial-bubble{opacity:1;transform:translateX(-50%) scale(1);animation:trial-bubble 1.25s ease-in-out infinite;}
    .trial-stage-page .trial-court-scene[data-stage='sentenced'] .trial-gavel{opacity:1;animation:trial-gavel 1.25s cubic-bezier(.5,.1,.3,1) infinite;}
    .trial-stage-page .trial-court-scene[data-stage='sentenced'] .trial-judge{animation:trial-judge-focus 1.8s ease-in-out infinite;}
    .trial-stage-page .trial-complete{position:relative;overflow:hidden;border-color:rgba(201,168,76,.7)!important;background:radial-gradient(circle at 50% 20%,rgba(201,168,76,.18),transparent 48%),var(--surface);animation:trial-complete-pop .5s ease both;}
    .trial-stage-page .trial-complete-seal{width:70px;height:70px;border:3px double var(--gold);border-radius:50%;display:grid;place-items:center;margin:0 auto 9px;font-family:var(--font-serif);font-size:18px;font-weight:900;color:var(--gold);transform:rotate(-8deg);animation:trial-seal .55s cubic-bezier(.2,1.4,.4,1) both;}
    .trial-stage-page .step-card.visible{animation:trial-document-reveal .45s ease both;}
    @keyframes trial-live-pulse{0%{box-shadow:0 0 0 0 rgba(201,168,76,.5)}70%{box-shadow:0 0 0 7px rgba(201,168,76,0)}100%{box-shadow:0 0 0 0 rgba(201,168,76,0)}}
    @keyframes trial-progress-shine{to{transform:translateX(340%)}}
    @keyframes trial-orb-float{0%,100%{transform:translateY(-2px)}50%{transform:translateY(-5px)}}
    @keyframes trial-light-breathe{0%,100%{opacity:.5;transform:translateX(-50%) scale(.9)}50%{opacity:1;transform:translateX(-50%) scale(1.08)}}
    @keyframes trial-document-file{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-8px) rotate(2deg)}}
    @keyframes trial-paper-twitch{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(2deg)}}
    @keyframes trial-magnify{0%,100%{transform:translate(-28px,-7px) rotate(-8deg)}50%{transform:translate(27px,-14px) rotate(9deg)}}
    @keyframes trial-bubble{0%,100%{margin-top:0}50%{margin-top:-4px}}
    @keyframes trial-gavel{0%,35%,100%{transform:rotate(-28deg)}55%{transform:rotate(18deg)}62%{transform:rotate(12deg)}}
    @keyframes trial-judge-focus{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
    @keyframes trial-complete-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes trial-seal{from{opacity:0;transform:scale(1.65) rotate(-20deg)}to{opacity:1;transform:scale(1) rotate(-8deg)}}
    @keyframes trial-document-reveal{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @media(min-width:620px){.trial-stage-page .trial-step-sub{display:block}.trial-stage-page .trial-court-scene{padding-left:32px;padding-right:32px}.trial-stage-page .trial-parties{gap:22px}}
    @media(max-width:390px){.trial-stage-page .trial-step-orb{width:36px;height:36px;font-size:15px}.trial-stage-page .trial-timeline::before{top:18px}.trial-stage-page .trial-step-title{font-size:9px}.trial-stage-page .trial-court-scene{min-height:226px}}
    @media(prefers-reduced-motion:reduce){.trial-stage-page *,.trial-stage-page *::before,.trial-stage-page *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}.trial-stage-page .trial-progress-bar{transition:none}}
    [data-theme='light'] .trial-stage-page .trial-progress-shell{background:rgba(72,48,12,.09)}
    [data-theme='light'] .trial-stage-page .trial-court-scene{background:radial-gradient(circle at 50% 0%,rgba(169,126,32,.14),transparent 42%),linear-gradient(180deg,#fffaf1,#f8f0df)}
    [data-theme='light'] .trial-stage-page .trial-party,[data-theme='light'] .trial-stage-page .trial-status-copy{background:rgba(255,255,255,.62)}
  `;
  document.head.appendChild(style);
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assignedJudge(caseId, existingType = '') {
  const existing = JUDGES.find(([type]) => type === existingType);
  if (existing) return { type: existing[0], icon: existing[1] };
  const selected = JUDGES[hashString(caseId) % JUDGES.length];
  return { type: selected[0], icon: selected[1] };
}

function progressMessage(stage, judge) {
  const stageIndex = Math.max(0, PROGRESS_STAGES.indexOf(stage));
  const judgeLine = JUDGE_PROGRESS[judge.type]?.[stageIndex] || '';
  return [STAGE_LOADING[stage] || STAGE_LOADING.filed, judgeLine].filter(Boolean).join('\n');
}

function courtSceneHtml() {
  return `
    <div id="trial-court-scene" class="trial-court-scene" data-stage="filed" aria-live="polite">
      <div class="trial-court-light" aria-hidden="true"></div>
      <div class="trial-bench" aria-hidden="true">
        <div class="trial-judge">
          <div id="scene-judge-avatar" class="trial-judge-avatar">⚖️</div>
          <div id="scene-judge-name" class="trial-judge-name">담당 판사 입장 중</div>
        </div>
        <div class="trial-desk"></div>
        <div class="trial-document"></div>
        <div class="trial-magnifier">🔎</div>
        <div class="trial-gavel">🔨</div>
      </div>
      <div class="trial-parties" aria-hidden="true">
        <div class="trial-party" data-side="plaintiff"><div class="trial-bubble">진술 중</div><span class="trial-party-icon">🙋</span><span class="trial-party-label">원고석</span></div>
        <div class="trial-party" data-side="defendant"><div class="trial-bubble">반론 중</div><span class="trial-party-icon">🙅</span><span class="trial-party-label">피고석</span></div>
      </div>
      <div class="trial-scene-caption">
        <div id="trial-scene-title" class="trial-scene-title">접수 완료 대기</div>
        <div id="trial-scene-sub" class="trial-scene-sub">서류가 재판부로 이동 중</div>
      </div>
    </div>`;
}

export async function renderTrial(container, caseId) {
  caseData = null;
  ensureTrialAnimationStyle();
  container.innerHTML = `
    <div class="trial-stage-page">
      <div class="page-header"><span class="logo">🏛️ AI 재판 진행 중</span></div>
      <div class="container" style="padding-top:20px;padding-bottom:70px;">
        <div id="docket-card" class="card court-document" style="padding:18px 18px 16px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
            <div style="min-width:0;flex:1;">
              <div class="trial-live"><span class="trial-live-dot" aria-hidden="true"></span>AI 재판부 심리중</div>
              <div id="docket-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;line-height:1.45;margin-top:9px;">사건명 분석 중</div>
              <div id="docket-meta" style="font-size:11px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">사건번호 부여 중 · 제3생활부</div>
            </div>
            <div style="text-align:right;min-width:72px;">
              <div id="docket-judge-icon" style="font-size:30px;line-height:1;">⚖️</div>
              <div id="docket-status" style="font-size:10px;color:var(--gold);font-weight:900;margin-top:5px;">사건접수</div>
            </div>
          </div>
          <div class="trial-progress-shell" role="progressbar" aria-label="AI 재판 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="12">
            <div id="trial-progress-bar" class="trial-progress-bar"></div>
          </div>
        </div>

        <div id="docket-timeline" class="trial-timeline" aria-label="AI 재판 5단계"></div>
        ${courtSceneHtml()}

        <div id="loading-area">
          <div id="loading-text" class="trial-status-copy"></div>
          <div class="trial-wait-note">AI가 실제 문서를 작성 중입니다. 단계 연출은 기다리는 시간을 재미있게 보여주는 진행 화면입니다.</div>
        </div>

        <div id="steps-container" style="margin-top:16px;"></div>
      </div>
    </div>`;

  let visualStepIndex = 0;
  let unsubscribeCase = null;
  let unsubscribeResult = null;

  const showVisualStage = (stage = 'filed', reset = false) => {
    const requestedIndex = Math.max(0, PROGRESS_STAGES.indexOf(stage));
    visualStepIndex = reset ? requestedIndex : Math.max(visualStepIndex, requestedIndex);
    const visualStage = PROGRESS_STAGES[visualStepIndex];
    const judge = assignedJudge(caseId, caseData?.judgeType || '');
    renderTimeline(visualStage);

    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = progressMessage(visualStage, judge);

    const status = document.getElementById('docket-status');
    if (status) status.textContent = stageLabel(visualStage);

    const icon = document.getElementById('docket-judge-icon');
    if (icon) icon.textContent = judge.icon;

    const scene = document.getElementById('trial-court-scene');
    if (scene) scene.dataset.stage = visualStage;
    const sceneTitle = document.getElementById('trial-scene-title');
    const sceneSub = document.getElementById('trial-scene-sub');
    if (sceneTitle) sceneTitle.textContent = STAGE_SCENE[visualStage]?.[0] || stageLabel(visualStage);
    if (sceneSub) sceneSub.textContent = STAGE_SCENE[visualStage]?.[1] || '';
    const sceneJudge = document.getElementById('scene-judge-avatar');
    const sceneJudgeName = document.getElementById('scene-judge-name');
    if (sceneJudge) sceneJudge.textContent = judge.icon;
    if (sceneJudgeName) sceneJudgeName.textContent = `${judge.type} 판사`;

    const progress = STAGE_PROGRESS[visualStage] || 12;
    const progressBar = document.getElementById('trial-progress-bar');
    if (progressBar) progressBar.style.width = `${progress}%`;
    const progressShell = progressBar?.parentElement;
    if (progressShell) progressShell.setAttribute('aria-valuenow', String(progress));
  };

  showVisualStage('filed', true);

  const progressTimer = setInterval(() => {
    if (!container.isConnected) {
      clearInterval(progressTimer);
      return;
    }
    if (visualStepIndex < PROGRESS_STAGES.length - 1) visualStepIndex += 1;
    showVisualStage(PROGRESS_STAGES[visualStepIndex]);
  }, 3200);

  const stop = () => {
    clearInterval(progressTimer);
    try { unsubscribeCase?.(); } catch {}
    try { unsubscribeResult?.(); } catch {}
    window._pageCleanup = null;
  };

  const showError = (message = '') => {
    stop();
    const la = document.getElementById('loading-area');
    if (la) {
      la.innerHTML = `
        <div class="card" style="border-color:rgba(231,76,60,.55);padding:18px;text-align:left;">
          <div style="font-size:17px;color:var(--red);font-weight:900;margin-bottom:8px;">⚠️ 판결문 작성 중 오류</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(message || 'AI 재판부가 판결문을 완성하지 못했습니다.')}</div>
          <button type="button" class="btn btn-primary" id="retry-current-case" style="margin-top:14px;">같은 사건 다시 작성</button>
          <a href="#/submit" class="btn btn-secondary" style="margin-top:8px;">새 사건 접수하기</a>
        </div>`;
      document.getElementById('retry-current-case')?.addEventListener('click', () => location.reload());
    }
  };

  const keepWaiting = () => {
    visualStepIndex = PROGRESS_STAGES.length - 1;
    showVisualStage('sentenced');
    const el = document.getElementById('loading-text');
    if (el) el.textContent += '\n\n재판부 숙의가 길어지고 있습니다. 완료되면 자동으로 판결문으로 이동합니다.';
  };

  unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), snap => {
    if (!snap.exists()) return;
    caseData = snap.data();
    const actualStage = stageFor(caseData.courtStage || caseData.status);
    updateDocket(caseData, caseId, PROGRESS_STAGES[visualStepIndex]);
    showVisualStage(actualStage);

    if (caseData.status === 'blocked') {
      showError(caseData.errorMessage || '접수할 수 없는 내용이 포함되어 있습니다.');
      return;
    }

    if (caseData.status === 'error') {
      visualStepIndex = 0;
      showVisualStage('filed', true);
      const el = document.getElementById('loading-text');
      if (el) el.textContent = '이전 작성 오류를 정리하고 같은 사건으로 다시 작성하는 중입니다... ♻️';
    }
  }, err => showError(err.message));

  unsubscribeResult = onSnapshot(doc(db, 'results', caseId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    visualStepIndex = PROGRESS_STAGES.length - 1;
    showVisualStage('sentenced');

    if (data.verdict) {
      stop();
      const progressBar = document.getElementById('trial-progress-bar');
      if (progressBar) progressBar.style.width = '100%';
      const progressShell = progressBar?.parentElement;
      if (progressShell) progressShell.setAttribute('aria-valuenow', '100');
      const la = document.getElementById('loading-area');
      if (la) la.innerHTML = `
        <div class="card trial-complete" style="padding:20px;text-align:center;">
          <div class="trial-complete-seal">판결</div>
          <div style="font-family:var(--font-serif);font-size:19px;font-weight:900;color:var(--gold);">탕! 판결문 작성 완료</div>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.65;margin-top:6px;">재판부가 서명과 도장을 마쳤습니다.<br>이제 내 예상 판정을 먼저 남기러 이동합니다.</div>
        </div>`;
      setTimeout(() => { location.hash = `#/verdict/${encodeURIComponent(caseId)}`; }, 1450);
    }
  }, err => showError(err.message));

  window._pageCleanup = stop;

  try {
    const generateTrial = httpsCallable(functions, 'generateTrial');
    await generateTrial({ caseId });
  } catch (e) {
    console.error(e);
    const msg = `${e?.code || ''} ${e?.message || ''}`.toLowerCase();
    if (msg.includes('deadline') || msg.includes('timeout')) {
      keepWaiting();
      return;
    }
    showError(e?.message || 'AI 판결문 생성에 실패했습니다.');
  }
}

function stageFor(stage) {
  if (stage === 'hearing' || stage === 'received' || stage === 'evidence') return 'investigation';
  if (stage === 'verdict') return 'defendant';
  if (stage === 'error') return 'filed';
  return stage || 'filed';
}

function updateDocket(c, caseId, visualStage = 'filed') {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');
  const icon = document.getElementById('docket-judge-icon');
  const judge = assignedJudge(caseId, c.judgeType || '');

  if (title) title.textContent = c.caseTitle && c.caseTitle !== 'AI 사건명 작성 중'
    ? c.caseTitle
    : '사건명 분석 중';

  if (meta) meta.innerHTML = `${escapeHtml(c.docketNumber || '사건번호 부여중')}<br>${escapeHtml(c.division || '제3생활부')} · 원고 ${escapeHtml(c.nickname || '익명')}<br>${escapeHtml(judge.icon)} ${escapeHtml(judge.type)} 판사 배정`;
  if (status) status.textContent = stageLabel(visualStage);
  if (icon) icon.textContent = judge.icon;
}

function stageLabel(stage) {
  const row = DOCKET_STEPS.find(([id]) => id === stage);
  if (row) return row[1];
  return '문서작성중';
}

function renderTimeline(activeStage) {
  const el = document.getElementById('docket-timeline');
  if (!el) return;

  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === activeStage));
  el.innerHTML = DOCKET_STEPS.map(([id, title, sub], index) => {
    const isActive = index === activeIndex;
    const isDone = index < activeIndex;
    const stateClass = isActive ? ' is-active' : isDone ? ' is-done' : '';
    const symbol = isDone ? '✓' : (STAGE_EMOJI[id] || '⚖️');
    return `<div class="trial-step${stateClass}" aria-current="${isActive ? 'step' : 'false'}">
      <div class="trial-step-orb">${symbol}</div>
      <div class="trial-step-title">${escapeHtml(title)}</div>
      <div class="trial-step-sub">${escapeHtml(sub)}</div>
    </div>`;
  }).join('');
}

function renderSteps(data) {
  const target = document.getElementById('steps-container');
  if (!target) return;

  const sections = [
    ['01', '사건접수', '사건접수보고서', data.reception],
    ['02', '수사보고', '정황 및 증거 검토', data.investigation],
    ['03', '원고측 변론', '청구취지 및 주장요지', data.plaintiffArg],
    ['04', '피고측 변론', '답변취지 및 항변요지', data.defendantArg],
    ['05', '재판부 판결', '주문 및 판단이유', data.verdict]
  ];

  target.innerHTML = sections
    .filter(([, , , content]) => content)
    .map(([number, title, subtitle, content], index) => documentCard(number, title, subtitle, content, index === 4))
    .join('');
}

function documentCard(number, title, subtitle, content, verdict = false) {
  return `<section class="card court-document step-card visible" style="margin-bottom:14px;padding:20px;position:relative;overflow:hidden;">
    ${verdict ? '<div class="verdict-stamp">판결</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.14em;">DOCUMENT ${number}</div>
        <div style="font-family:var(--font-serif);font-size:19px;font-weight:900;margin-top:4px;">${escapeHtml(title)}</div>
      </div>
      <span class="badge badge-gold">${escapeHtml(subtitle)}</span>
    </div>
    <div class="step-content" style="white-space:pre-line;line-height:1.9;">${escapeHtml(content)}</div>
  </section>`;
}
