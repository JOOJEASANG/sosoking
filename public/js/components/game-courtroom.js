import { db } from '../firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let unsubscribeStage = null;
let currentSessionId = null;
let styleInjected = false;

const JUDGE_META = {
  '엄벌주의형': { icon: '👨‍⚖️', mood: '엄숙', line: '본 법정은 소소한 사건도 엄중히 다룹니다.' },
  '감성형': { icon: '🥹', mood: '공감', line: '양쪽 마음이 다 이해돼서 벌써 눈물이 납니다.' },
  '현실주의형': { icon: '🤦', mood: '현실', line: '그래서 핵심만 말해봅시다.' },
  '과몰입형': { icon: '🔥', mood: '과몰입', line: '이 사건은 생활사에 길이 남을 중대 사건입니다.' },
  '피곤형': { icon: '😴', mood: '퇴근희망', line: '좋습니다. 빨리 듣고 판결하겠습니다.' },
  '논리집착형': { icon: '🧮', mood: '분석', line: '감정은 변수가 아닙니다. 점수로 보겠습니다.' },
  '드립형': { icon: '🎭', mood: '드립', line: '진지하게 듣겠습니다. 웃기면 가산점입니다.' },
};

export function syncGameCourtroom(hash) {
  const match = String(hash || '').match(/^#\/debate\/([^/]+)/);
  const sessionId = match ? decodeURIComponent(match[1]) : null;

  if (!sessionId) {
    cleanupStage();
    return;
  }

  window.setTimeout(() => mountStage(sessionId), 0);
}

function cleanupStage() {
  currentSessionId = null;
  if (unsubscribeStage) {
    unsubscribeStage();
    unsubscribeStage = null;
  }
  document.getElementById('virtual-courtroom-stage')?.remove();
}

function mountStage(sessionId) {
  injectStyle();

  const page = document.getElementById('page-content');
  if (!page) return;
  const host = page.querySelector('.container') || page;
  if (!host) return;

  let stage = document.getElementById('virtual-courtroom-stage');
  if (!stage) {
    stage = document.createElement('section');
    stage.id = 'virtual-courtroom-stage';
    stage.className = 'vc-stage-shell';
    host.prepend(stage);
  }

  if (currentSessionId === sessionId && unsubscribeStage) return;
  if (unsubscribeStage) unsubscribeStage();
  currentSessionId = sessionId;

  stage.innerHTML = renderLoadingStage();
  unsubscribeStage = onSnapshot(doc(db, 'debate_sessions', sessionId), snap => {
    if (!snap.exists()) {
      stage.innerHTML = renderEmptyStage();
      return;
    }
    stage.innerHTML = renderStage({ id: snap.id, ...snap.data() });
  }, () => {
    stage.innerHTML = renderErrorStage();
  });
}

function renderLoadingStage() {
  return `
    <div class="vc-stage vc-stage-loading">
      <div class="vc-loading-gavel">⚖️</div>
      <div class="vc-loading-title">가상 법정 입장 중...</div>
      <div class="vc-loading-sub">판사석·원고석·피고석을 준비하고 있습니다</div>
    </div>`;
}

function renderEmptyStage() {
  return `
    <div class="vc-stage vc-stage-loading">
      <div class="vc-loading-gavel">⚠️</div>
      <div class="vc-loading-title">재판장을 찾을 수 없습니다</div>
    </div>`;
}

function renderErrorStage() {
  return `
    <div class="vc-stage vc-stage-loading">
      <div class="vc-loading-gavel">🔒</div>
      <div class="vc-loading-title">가상 법정 정보를 불러오지 못했습니다</div>
      <div class="vc-loading-sub">로그인 상태 또는 권한을 확인해주세요</div>
    </div>`;
}

function renderStage(session) {
  const judge = JUDGE_META[session.judgeType] || { icon: '👨‍⚖️', mood: '판사', line: '양측 변론을 듣겠습니다.' };
  const state = getCourtState(session);
  const pName = session.plaintiff?.nickname || '원고 대기';
  const dName = session.defendant?.nickname || '피고 대기';
  const pTeam = Array.isArray(session.plaintiffTeam) ? session.plaintiffTeam.length : (session.plaintiff ? 1 : 0);
  const dTeam = Array.isArray(session.defendantTeam) ? session.defendantTeam.length : (session.defendant ? 1 : 0);
  const roundNow = Math.min((session.currentRound || 0) + 1, session.maxRounds || 5);
  const maxRounds = session.maxRounds || 5;

  return `
    <div class="vc-stage ${state.stageClass}">
      <div class="vc-ceiling-light"></div>
      <div class="vc-titlebar">
        <div>
          <div class="vc-kicker">LIVE MOCK COURT · 오락용 모의법정</div>
          <div class="vc-case-title">${escHtml(session.topicTitle || '생활 사건')}</div>
        </div>
        <div class="vc-status-chip">${escHtml(state.label)}</div>
      </div>

      <div class="vc-courtroom">
        <div class="vc-back-wall">
          <div class="vc-court-emblem">⚖️</div>
          <div class="vc-wall-title">소소킹 생활법정</div>
          <div class="vc-wall-subtitle">실제 법적 효력 없음</div>
        </div>

        <div class="vc-gallery vc-gallery-left">
          <span>방청석</span><b>👥 👀 👥</b><b>👥 😮 👥</b>
        </div>
        <div class="vc-gallery vc-gallery-right">
          <span>방청석</span><b>👥 👏 👥</b><b>👥 🤔 👥</b>
        </div>

        <div class="vc-judge-bench">
          <div class="vc-bench-top">
            <div class="vc-nameplate">${escHtml(session.judgeType || 'AI 판사')}</div>
            <div class="vc-avatar vc-judge ${state.judgeActive ? 'is-talking' : ''}"><span>${judge.icon}</span></div>
            <div class="vc-judge-mood">${escHtml(judge.mood)}</div>
          </div>
          <div class="vc-bench-base"><span>판사석</span></div>
        </div>

        <div class="vc-witness-stand">
          <div class="vc-witness-rail"></div>
          <div class="vc-witness-label">증언대</div>
          <div class="vc-witness-mic">🎙️</div>
        </div>

        <div class="vc-character vc-host">
          <div class="vc-avatar vc-mini ${state.hostActive ? 'is-talking' : ''}"><span>🧑‍💼</span></div>
          <div class="vc-char-label">서기</div>
        </div>

        <div class="vc-character vc-plaintiff ${state.speaker === 'plaintiff' ? 'is-active-side' : ''}">
          <div class="vc-desk vc-desk-red"><span>원고석</span></div>
          <div class="vc-avatar vc-player vc-red ${state.speaker === 'plaintiff' ? 'is-talking' : ''}"><span>${pickAvatar(pName, 'plaintiff')}</span></div>
          <div class="vc-char-label red">원고</div>
          <div class="vc-char-name">${escHtml(pName)}</div>
          <div class="vc-team-count">팀원 ${pTeam}/${session.teamSize || 1}</div>
        </div>

        <div class="vc-character vc-defendant ${state.speaker === 'defendant' ? 'is-active-side' : ''}">
          <div class="vc-desk vc-desk-blue"><span>피고석</span></div>
          <div class="vc-avatar vc-player vc-blue ${state.speaker === 'defendant' ? 'is-talking' : ''}"><span>${pickAvatar(dName, 'defendant')}</span></div>
          <div class="vc-char-label blue">피고</div>
          <div class="vc-char-name">${escHtml(dName)}</div>
          <div class="vc-team-count">팀원 ${dTeam}/${session.teamSize || 1}</div>
        </div>

        <div class="vc-aisle"></div>
        <div class="vc-floor-seal">⚖️</div>
      </div>

      <div class="vc-dialogue-panel">
        <div class="vc-dialogue-speaker">${escHtml(state.speakerLabel)}</div>
        <div class="vc-dialogue-text">${escHtml(state.line || judge.line)}</div>
      </div>

      <div class="vc-roundbar">
        <div class="vc-round-label">라운드 ${roundNow}/${maxRounds}</div>
        <div class="vc-round-dots">
          ${Array.from({ length: maxRounds }).map((_, i) => `<span class="${i < (session.currentRound || 0) ? 'done' : i === (session.currentRound || 0) ? 'now' : ''}"></span>`).join('')}
        </div>
      </div>
    </div>`;
}

function getCourtState(session) {
  const status = session.status;
  const round = session.currentRound || 0;
  const rounds = Array.isArray(session.rounds) ? session.rounds : [];
  const cur = rounds[round] || {};

  if (status === 'waiting') {
    return {
      label: '상대 입장 대기',
      stageClass: 'is-waiting',
      speaker: 'host',
      speakerLabel: '법정 서기',
      hostActive: true,
      line: '상대가 입장하면 재판이 시작됩니다. 초대 링크를 보내보세요.',
    };
  }
  if (session.aiGenerating) {
    return {
      label: 'AI 변론 준비 중',
      stageClass: 'is-ai-thinking',
      speaker: session.plaintiff?.userId === 'AI' ? 'plaintiff' : 'defendant',
      speakerLabel: '소소봇',
      line: 'AI 측이 재치 있는 변론을 준비하고 있습니다...',
    };
  }
  if (status === 'judging') {
    return {
      label: '판결 중',
      stageClass: 'is-judging',
      speaker: 'judge',
      speakerLabel: 'AI 판사',
      judgeActive: true,
      line: '양측 변론을 검토하고 최종 판결문을 작성하고 있습니다.',
    };
  }
  if (status === 'completed') {
    const winner = session.verdict?.winner;
    const winnerLabel = winner === 'plaintiff' ? '원고 승소' : winner === 'defendant' ? '피고 승소' : '무승부';
    return {
      label: '판결 완료',
      stageClass: 'is-completed',
      speaker: 'judge',
      speakerLabel: 'AI 판사',
      judgeActive: true,
      line: `주문. 본 사건은 ${winnerLabel}로 판결합니다.`,
    };
  }
  if (status === 'verdict_requested' || status === 'ready_for_verdict') {
    return {
      label: '판결 대기',
      stageClass: 'is-ready',
      speaker: 'judge',
      speakerLabel: 'AI 판사',
      judgeActive: true,
      line: '판결 요청이 준비되었습니다. 양측의 동의 또는 판결 버튼을 기다립니다.',
    };
  }
  if (!cur.plaintiff) {
    return {
      label: '원고 변론 차례',
      stageClass: 'is-plaintiff-turn',
      speaker: 'plaintiff',
      speakerLabel: '원고석',
      line: '원고가 먼저 사건의 억울함을 변론할 차례입니다.',
    };
  }
  if (!cur.defendant) {
    return {
      label: '피고 반론 차례',
      stageClass: 'is-defendant-turn',
      speaker: 'defendant',
      speakerLabel: '피고석',
      line: '피고가 원고의 변론에 반론할 차례입니다.',
    };
  }
  return {
    label: '다음 라운드 준비',
    stageClass: 'is-active',
    speaker: 'host',
    speakerLabel: '법정 서기',
    hostActive: true,
    line: '다음 라운드로 넘어갑니다. 양측은 다음 변론을 준비해주세요.',
  };
}

function pickAvatar(name, side) {
  const plaintiff = ['🧑‍💼', '🙋', '😤', '🥺', '🕵️'];
  const defendant = ['🧑‍⚖️', '🤷', '😎', '🛡️', '🧑‍💻'];
  const list = side === 'plaintiff' ? plaintiff : defendant;
  const seed = String(name || side).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return list[seed % list.length];
}

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .vc-stage-shell { margin: 0 0 18px; }
    .vc-stage { position: relative; overflow: hidden; border: 1.5px solid rgba(201,168,76,.35); border-radius: 22px; min-height: 438px; background: radial-gradient(ellipse at 50% 0%, rgba(255,222,153,.16), transparent 54%), linear-gradient(180deg, #17100b 0%, #24170e 52%, #0d1117 100%); box-shadow: 0 18px 48px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.06); }
    [data-theme="light"] .vc-stage { background: radial-gradient(ellipse at 50% 0%, rgba(232,96,44,.14), transparent 55%), linear-gradient(180deg, #fff7ee 0%, #f4dcc2 60%, #fff8f2 100%); box-shadow: 0 10px 32px rgba(154,112,24,.16); }
    .vc-ceiling-light { position:absolute; left:50%; top:-120px; transform:translateX(-50%); width:360px; height:260px; background:radial-gradient(circle, rgba(255,232,179,.36), transparent 68%); animation: vcGlow 4s ease-in-out infinite alternate; pointer-events:none; }
    .vc-titlebar { position: relative; z-index: 6; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px 16px 0; }
    .vc-kicker { font-size:10px; font-weight:900; letter-spacing:.12em; color:var(--gold); text-transform:uppercase; }
    .vc-case-title { margin-top:3px; font-family:var(--font-serif); font-size:16px; font-weight:900; color:var(--cream); line-height:1.35; }
    .vc-status-chip { flex-shrink:0; padding:6px 10px; border-radius:999px; border:1px solid rgba(201,168,76,.4); background:rgba(201,168,76,.12); color:var(--gold); font-size:11px; font-weight:900; box-shadow:0 4px 14px rgba(0,0,0,.16); }
    .vc-courtroom { position:relative; height:284px; margin:10px 12px 0; border-radius:18px; overflow:hidden; background: linear-gradient(180deg, rgba(118,74,37,.25), rgba(45,28,17,.36)); border:1px solid rgba(255,221,156,.11); perspective:900px; }
    [data-theme="light"] .vc-courtroom { background:linear-gradient(180deg, rgba(255,255,255,.72), rgba(165,103,55,.12)); border-color:rgba(154,112,24,.18); }
    .vc-courtroom:before { content:''; position:absolute; left:0; right:0; top:0; height:46%; background: repeating-linear-gradient(90deg, rgba(122,74,37,.5) 0 18px, rgba(86,51,29,.55) 18px 36px), linear-gradient(180deg, rgba(255,255,255,.05), transparent); opacity:.62; }
    .vc-courtroom:after { content:''; position:absolute; left:8%; right:8%; bottom:0; height:47%; background: linear-gradient(180deg, rgba(184,119,62,.28), rgba(98,58,31,.2)); clip-path: polygon(16% 0,84% 0,100% 100%,0 100%); border-radius:18px 18px 0 0; }
    .vc-back-wall { position:absolute; left:50%; top:10px; transform:translateX(-50%); width:188px; text-align:center; z-index:2; color:var(--cream); }
    .vc-court-emblem { width:42px; height:42px; margin:0 auto 3px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1.5px solid rgba(201,168,76,.45); background:rgba(0,0,0,.18); font-size:24px; }
    .vc-wall-title { font-family:var(--font-serif); font-size:12px; font-weight:900; color:var(--gold); }
    .vc-wall-subtitle { margin-top:1px; font-size:9px; color:var(--cream-dim); font-weight:800; }
    .vc-gallery { position:absolute; top:70px; width:58px; min-height:98px; z-index:2; padding:8px 5px; border-radius:10px; background:rgba(0,0,0,.18); border:1px solid rgba(255,255,255,.06); text-align:center; opacity:.8; }
    .vc-gallery-left { left:8px; } .vc-gallery-right { right:8px; }
    .vc-gallery span { display:block; font-size:9px; color:var(--gold); font-weight:900; margin-bottom:5px; }
    .vc-gallery b { display:block; font-size:14px; line-height:1.7; font-weight:400; opacity:.82; }
    .vc-judge-bench { position:absolute; top:64px; left:50%; transform:translateX(-50%); width:152px; text-align:center; z-index:4; }
    .vc-bench-top { position:relative; z-index:3; }
    .vc-bench-base { margin:-6px auto 0; width:148px; height:46px; border-radius:10px 10px 4px 4px; background:linear-gradient(180deg, #7a4d2e, #4d2c19); border:1.5px solid rgba(255,221,156,.22); box-shadow:0 10px 22px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.12); display:flex; align-items:flex-end; justify-content:center; padding-bottom:7px; }
    .vc-bench-base span { color:rgba(255,232,195,.74); font-size:10px; font-weight:900; letter-spacing:.14em; }
    .vc-nameplate { display:inline-flex; justify-content:center; max-width:142px; margin-bottom:4px; padding:3px 9px; border-radius:999px; background:rgba(0,0,0,.26); border:1px solid rgba(201,168,76,.3); font-size:9px; color:var(--gold); font-weight:900; white-space:nowrap; }
    .vc-judge-mood { display:inline-flex; margin-top:4px; padding:2px 8px; border-radius:999px; background:rgba(0,0,0,.22); font-size:10px; color:var(--cream-dim); }
    .vc-avatar { display:flex; align-items:center; justify-content:center; margin:0 auto; border-radius:50%; background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); border:2px solid rgba(201,168,76,.45); box-shadow:0 8px 26px rgba(0,0,0,.28); transform-origin:bottom center; }
    .vc-avatar span { line-height:1; filter:drop-shadow(0 3px 8px rgba(0,0,0,.25)); }
    .vc-judge { width:62px; height:62px; font-size:34px; background:linear-gradient(135deg, rgba(255,245,221,.24), rgba(201,168,76,.06)); }
    .vc-player { width:58px; height:58px; font-size:31px; }
    .vc-mini { width:42px; height:42px; font-size:24px; }
    .vc-red { border-color:rgba(231,76,60,.62); background:linear-gradient(135deg, rgba(231,76,60,.26), rgba(231,76,60,.06)); }
    .vc-blue { border-color:rgba(52,152,219,.62); background:linear-gradient(135deg, rgba(52,152,219,.25), rgba(52,152,219,.06)); }
    .vc-character { position:absolute; z-index:5; text-align:center; }
    .vc-host { left:50%; bottom:75px; transform:translateX(-50%); opacity:.94; }
    .vc-plaintiff { left:74px; bottom:22px; }
    .vc-defendant { right:74px; bottom:22px; }
    .vc-char-label { margin-top:5px; font-size:11px; font-weight:900; color:var(--cream); }
    .vc-char-label.red { color:#ff7b74; } .vc-char-label.blue { color:#6fb8ff; }
    .vc-char-name { max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:800; color:var(--cream); }
    .vc-team-count { font-size:10px; color:var(--cream-dim); }
    .vc-desk { position:relative; width:96px; height:28px; margin:0 auto -8px; border-radius:10px 10px 3px 3px; box-shadow:0 7px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.11); display:flex; align-items:center; justify-content:center; }
    .vc-desk span { font-size:9px; font-weight:900; color:rgba(255,255,255,.72); letter-spacing:.08em; }
    .vc-desk-red { background:linear-gradient(180deg, rgba(139,58,45,.85), rgba(82,38,30,.9)); border:1px solid rgba(231,76,60,.35); }
    .vc-desk-blue { background:linear-gradient(180deg, rgba(45,84,128,.85), rgba(29,52,82,.9)); border:1px solid rgba(52,152,219,.35); }
    .vc-witness-stand { position:absolute; left:50%; bottom:28px; transform:translateX(-50%); z-index:4; width:78px; height:72px; text-align:center; }
    .vc-witness-rail { position:absolute; left:8px; right:8px; bottom:16px; height:44px; border-radius:10px 10px 4px 4px; border:1.5px solid rgba(255,221,156,.18); background:linear-gradient(180deg, rgba(116,72,39,.88), rgba(61,37,21,.92)); box-shadow:0 8px 18px rgba(0,0,0,.25); }
    .vc-witness-label { position:absolute; bottom:24px; left:0; right:0; font-size:9px; font-weight:900; color:rgba(255,232,195,.76); }
    .vc-witness-mic { position:absolute; left:50%; bottom:54px; transform:translateX(-50%); font-size:20px; }
    .vc-aisle { position:absolute; left:50%; bottom:0; transform:translateX(-50%); z-index:3; width:74px; height:88px; background:linear-gradient(180deg, rgba(201,168,76,.12), rgba(255,255,255,.02)); clip-path:polygon(34% 0,66% 0,100% 100%,0 100%); opacity:.85; }
    .vc-floor-seal { position:absolute; left:50%; bottom:6px; transform:translateX(-50%); z-index:4; width:54px; height:54px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:27px; opacity:.22; border:2px solid rgba(201,168,76,.35); background:rgba(0,0,0,.06); }
    .vc-dialogue-panel { margin:10px 12px 0; padding:11px 13px; border-radius:14px; background:rgba(0,0,0,.22); border:1px solid rgba(201,168,76,.2); position:relative; z-index:6; box-shadow:inset 0 1px 0 rgba(255,255,255,.04); }
    [data-theme="light"] .vc-dialogue-panel { background:rgba(255,255,255,.72); }
    .vc-dialogue-speaker { font-size:10px; font-weight:900; color:var(--gold); margin-bottom:4px; letter-spacing:.06em; }
    .vc-dialogue-text { font-size:13px; color:var(--cream); line-height:1.55; }
    .vc-roundbar { display:flex; align-items:center; gap:12px; padding:12px 14px 14px; }
    .vc-round-label { min-width:74px; font-size:11px; font-weight:900; color:var(--cream-dim); }
    .vc-round-dots { flex:1; display:flex; gap:5px; }
    .vc-round-dots span { flex:1; height:5px; border-radius:999px; background:rgba(255,255,255,.1); }
    .vc-round-dots span.done { background:rgba(201,168,76,.72); } .vc-round-dots span.now { background:var(--gold); box-shadow:0 0 10px rgba(201,168,76,.5); }
    .is-talking { animation: vcTalk .72s ease-in-out infinite alternate; }
    .is-active-side .vc-player { box-shadow:0 0 0 4px rgba(201,168,76,.18), 0 10px 30px rgba(0,0,0,.36); }
    .is-active-side .vc-desk { filter:brightness(1.12); box-shadow:0 0 0 3px rgba(201,168,76,.12), 0 9px 20px rgba(0,0,0,.3); }
    .is-judging .vc-judge { animation: vcJudge 1s ease-in-out infinite alternate; }
    .is-completed .vc-ceiling-light, .is-judging .vc-ceiling-light { opacity:1; }
    .vc-stage-loading { min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; }
    .vc-loading-gavel { font-size:44px; animation: vcTalk .8s ease-in-out infinite alternate; }
    .vc-loading-title { margin-top:8px; font-weight:900; color:var(--cream); } .vc-loading-sub { margin-top:4px; font-size:12px; color:var(--cream-dim); }
    @keyframes vcTalk { from { transform:translateY(0) rotate(-1deg); } to { transform:translateY(-5px) rotate(1deg); } }
    @keyframes vcJudge { from { transform:translateY(0) scale(1); } to { transform:translateY(-4px) scale(1.04); } }
    @keyframes vcGlow { from { opacity:.48; transform:translateX(-50%) scale(.95); } to { opacity:1; transform:translateX(-50%) scale(1.05); } }
    @media (max-width:420px) { .vc-stage { min-height:424px; } .vc-courtroom { height:270px; margin-left:8px; margin-right:8px; } .vc-back-wall { top:8px; } .vc-gallery { width:42px; top:76px; padding:6px 3px; } .vc-gallery b { font-size:11px; } .vc-gallery span { font-size:8px; } .vc-judge-bench { top:64px; width:138px; } .vc-bench-base { width:132px; } .vc-plaintiff { left:42px; } .vc-defendant { right:42px; } .vc-player { width:52px; height:52px; font-size:28px; } .vc-judge { width:58px; height:58px; font-size:32px; } .vc-char-name { max-width:78px; } .vc-host { bottom:72px; } .vc-witness-stand { width:62px; } .vc-witness-label { font-size:8px; } .vc-desk { width:78px; height:25px; } }
  `;
  document.head.appendChild(style);
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}
