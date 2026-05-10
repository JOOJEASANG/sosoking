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
      <div class="vc-loading-sub">판사와 양측 캐릭터를 불러오고 있습니다</div>
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
      <div class="vc-sky-glow"></div>
      <div class="vc-titlebar">
        <div>
          <div class="vc-kicker">2D 가상 법정 · Beta</div>
          <div class="vc-case-title">${escHtml(session.topicTitle || '생활 사건')}</div>
        </div>
        <div class="vc-status-chip">${escHtml(state.label)}</div>
      </div>

      <div class="vc-courtroom">
        <div class="vc-audience vc-audience-left">👥 👀 👥</div>
        <div class="vc-audience vc-audience-right">👥 😮 👥</div>

        <div class="vc-judge-bench">
          <div class="vc-nameplate">${escHtml(session.judgeType || 'AI 판사')}</div>
          <div class="vc-avatar vc-judge ${state.judgeActive ? 'is-talking' : ''}">
            <span>${judge.icon}</span>
          </div>
          <div class="vc-judge-mood">${escHtml(judge.mood)}</div>
        </div>

        <div class="vc-character vc-host">
          <div class="vc-avatar vc-mini ${state.hostActive ? 'is-talking' : ''}"><span>🎙️</span></div>
          <div class="vc-char-label">진행자</div>
        </div>

        <div class="vc-character vc-plaintiff ${state.speaker === 'plaintiff' ? 'is-active-side' : ''}">
          <div class="vc-desk vc-desk-red"></div>
          <div class="vc-avatar vc-player vc-red ${state.speaker === 'plaintiff' ? 'is-talking' : ''}"><span>${pickAvatar(pName, 'plaintiff')}</span></div>
          <div class="vc-char-label red">원고</div>
          <div class="vc-char-name">${escHtml(pName)}</div>
          <div class="vc-team-count">팀원 ${pTeam}/${session.teamSize || 1}</div>
        </div>

        <div class="vc-character vc-defendant ${state.speaker === 'defendant' ? 'is-active-side' : ''}">
          <div class="vc-desk vc-desk-blue"></div>
          <div class="vc-avatar vc-player vc-blue ${state.speaker === 'defendant' ? 'is-talking' : ''}"><span>${pickAvatar(dName, 'defendant')}</span></div>
          <div class="vc-char-label blue">피고</div>
          <div class="vc-char-name">${escHtml(dName)}</div>
          <div class="vc-team-count">팀원 ${dTeam}/${session.teamSize || 1}</div>
        </div>

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
      speakerLabel: '진행자',
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
    speakerLabel: '진행자',
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
    .vc-stage { position: relative; overflow: hidden; border: 1.5px solid rgba(201,168,76,.35); border-radius: 20px; min-height: 390px; background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.22), transparent 55%), linear-gradient(180deg, #171a2b 0%, #0d1117 100%); box-shadow: 0 18px 48px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06); }
    [data-theme="light"] .vc-stage { background: radial-gradient(ellipse at 50% 0%, rgba(232,96,44,.18), transparent 55%), linear-gradient(180deg, #fff7ee 0%, #ffe9d8 100%); box-shadow: 0 10px 32px rgba(154,112,24,.14); }
    .vc-sky-glow { position:absolute; inset:-80px -80px auto; height:180px; background: radial-gradient(circle, rgba(201,168,76,.28), transparent 65%); animation: vcGlow 4s ease-in-out infinite alternate; pointer-events:none; }
    .vc-titlebar { position: relative; z-index: 3; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px 16px 0; }
    .vc-kicker { font-size:10px; font-weight:900; letter-spacing:.12em; color:var(--gold); text-transform:uppercase; }
    .vc-case-title { margin-top:3px; font-family:var(--font-serif); font-size:16px; font-weight:900; color:var(--cream); line-height:1.35; }
    .vc-status-chip { flex-shrink:0; padding:6px 10px; border-radius:999px; border:1px solid rgba(201,168,76,.38); background:rgba(201,168,76,.1); color:var(--gold); font-size:11px; font-weight:900; }
    .vc-courtroom { position:relative; height:245px; margin:10px 12px 0; border-radius:18px; background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015)); border:1px solid rgba(255,255,255,.06); perspective:900px; }
    [data-theme="light"] .vc-courtroom { background:rgba(255,255,255,.58); border-color:rgba(232,96,44,.14); }
    .vc-courtroom:before { content:''; position:absolute; left:9%; right:9%; bottom:0; height:48%; background: linear-gradient(180deg, rgba(201,168,76,.1), rgba(201,168,76,.03)); clip-path: polygon(12% 0,88% 0,100% 100%,0 100%); border-radius:18px 18px 0 0; }
    .vc-audience { position:absolute; top:22px; font-size:20px; opacity:.34; filter:blur(.1px); }
    .vc-audience-left { left:14px; } .vc-audience-right { right:14px; }
    .vc-judge-bench { position:absolute; top:18px; left:50%; transform:translateX(-50%); width:118px; text-align:center; z-index:2; }
    .vc-nameplate { font-size:9px; color:var(--gold); font-weight:900; margin-bottom:4px; white-space:nowrap; }
    .vc-judge-mood { display:inline-flex; margin-top:4px; padding:2px 8px; border-radius:999px; background:rgba(0,0,0,.18); font-size:10px; color:var(--cream-dim); }
    .vc-avatar { display:flex; align-items:center; justify-content:center; margin:0 auto; border-radius:50%; background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); border:2px solid rgba(201,168,76,.45); box-shadow:0 8px 26px rgba(0,0,0,.28); transform-origin:bottom center; }
    .vc-avatar span { line-height:1; filter:drop-shadow(0 3px 8px rgba(0,0,0,.25)); }
    .vc-judge { width:70px; height:70px; font-size:38px; }
    .vc-player { width:58px; height:58px; font-size:31px; }
    .vc-mini { width:42px; height:42px; font-size:24px; }
    .vc-red { border-color:rgba(231,76,60,.62); background:linear-gradient(135deg, rgba(231,76,60,.26), rgba(231,76,60,.06)); }
    .vc-blue { border-color:rgba(52,152,219,.62); background:linear-gradient(135deg, rgba(52,152,219,.25), rgba(52,152,219,.06)); }
    .vc-character { position:absolute; z-index:3; text-align:center; }
    .vc-host { left:50%; bottom:58px; transform:translateX(-50%); opacity:.92; }
    .vc-plaintiff { left:24px; bottom:18px; }
    .vc-defendant { right:24px; bottom:18px; }
    .vc-char-label { margin-top:5px; font-size:11px; font-weight:900; color:var(--cream); }
    .vc-char-label.red { color:#ff7b74; } .vc-char-label.blue { color:#6fb8ff; }
    .vc-char-name { max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:800; color:var(--cream); }
    .vc-team-count { font-size:10px; color:var(--cream-dim); }
    .vc-desk { width:76px; height:20px; margin:0 auto -8px; border-radius:10px 10px 3px 3px; box-shadow:0 6px 18px rgba(0,0,0,.18); }
    .vc-desk-red { background:linear-gradient(135deg, rgba(231,76,60,.45), rgba(231,76,60,.16)); border:1px solid rgba(231,76,60,.35); }
    .vc-desk-blue { background:linear-gradient(135deg, rgba(52,152,219,.45), rgba(52,152,219,.16)); border:1px solid rgba(52,152,219,.35); }
    .vc-floor-seal { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); width:62px; height:62px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; opacity:.18; border:2px solid rgba(201,168,76,.35); }
    .vc-dialogue-panel { margin:10px 12px 0; padding:11px 13px; border-radius:14px; background:rgba(0,0,0,.2); border:1px solid rgba(201,168,76,.18); position:relative; z-index:4; }
    [data-theme="light"] .vc-dialogue-panel { background:rgba(255,255,255,.72); }
    .vc-dialogue-speaker { font-size:10px; font-weight:900; color:var(--gold); margin-bottom:4px; letter-spacing:.06em; }
    .vc-dialogue-text { font-size:13px; color:var(--cream); line-height:1.55; }
    .vc-roundbar { display:flex; align-items:center; gap:12px; padding:12px 14px 14px; }
    .vc-round-label { min-width:74px; font-size:11px; font-weight:900; color:var(--cream-dim); }
    .vc-round-dots { flex:1; display:flex; gap:5px; }
    .vc-round-dots span { flex:1; height:5px; border-radius:999px; background:rgba(255,255,255,.1); }
    .vc-round-dots span.done { background:rgba(201,168,76,.72); } .vc-round-dots span.now { background:var(--gold); box-shadow:0 0 10px rgba(201,168,76,.5); }
    .is-talking { animation: vcTalk .72s ease-in-out infinite alternate; }
    .is-active-side .vc-player { box-shadow:0 0 0 4px rgba(201,168,76,.16), 0 10px 30px rgba(0,0,0,.32); }
    .is-judging .vc-judge { animation: vcJudge 1s ease-in-out infinite alternate; }
    .vc-stage-loading { min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; }
    .vc-loading-gavel { font-size:44px; animation: vcTalk .8s ease-in-out infinite alternate; }
    .vc-loading-title { margin-top:8px; font-weight:900; color:var(--cream); } .vc-loading-sub { margin-top:4px; font-size:12px; color:var(--cream-dim); }
    @keyframes vcTalk { from { transform:translateY(0) rotate(-1deg); } to { transform:translateY(-5px) rotate(1deg); } }
    @keyframes vcJudge { from { transform:translateY(0) scale(1); } to { transform:translateY(-4px) scale(1.04); } }
    @keyframes vcGlow { from { opacity:.45; transform:scale(.95); } to { opacity:1; transform:scale(1.05); } }
    @media (max-width:420px) { .vc-stage { min-height:372px; } .vc-courtroom { height:230px; margin-left:8px; margin-right:8px; } .vc-plaintiff { left:12px; } .vc-defendant { right:12px; } .vc-player { width:52px; height:52px; font-size:28px; } .vc-judge { width:64px; height:64px; font-size:35px; } .vc-char-name { max-width:86px; } .vc-host { bottom:54px; } }
  `;
  document.head.appendChild(style);
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
