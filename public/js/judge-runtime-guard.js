const RUNTIME_JUDGE_VERSION = '20260810-judge-runtime-1';

const CURRENT_JUDGES = [
  { name: '꼰대형', icon: '🧓' },
  { name: '냉혈형', icon: '🧊' },
  { name: '회피형', icon: '🏃' },
  { name: '추궁형', icon: '🔎' },
  { name: '오버형', icon: '🚨' },
  { name: '드립형', icon: '🎭' },
  { name: '빙의형', icon: '🌀' }
];

const CURRENT_BY_NAME = new Map(CURRENT_JUDGES.map(judge => [judge.name, judge]));

// trial.js의 구형 배열은 신규 배열과 동일한 7개 인덱스를 사용한다.
// 새 사건의 실제 judgeType이 아직 화면 코드에 인식되지 않아 해시 fallback으로
// 구형 이름이 노출되는 경우, 동일 인덱스의 신규 판사로 표시만 복구한다.
const LEGACY_TRIAL_TO_CURRENT = new Map([
  ['엄벌주의형', '꼰대형'],
  ['감성형', '냉혈형'],
  ['현실주의형', '회피형'],
  ['과몰입형', '추궁형'],
  ['피곤형', '오버형'],
  ['논리집착형', '드립형'],
  ['드립형', '빙의형']
]);

const STAGE_INDEX = new Map([
  ['사건접수', 0],
  ['접수중', 0],
  ['수사보고', 1],
  ['원고측 변론', 2],
  ['피고측 변론', 3],
  ['재판부 판결', 4]
]);

const PROGRESS = {
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

function currentFromTrialMeta(meta) {
  const text = meta?.textContent || '';
  for (const [legacy, current] of LEGACY_TRIAL_TO_CURRENT) {
    if (text.includes(`${legacy} 판사 배정`)) return { legacy, current };
  }
  for (const judge of CURRENT_JUDGES) {
    if (text.includes(`${judge.name} 판사 배정`)) return { legacy: '', current: judge.name };
  }
  return null;
}

function syncTrial(root) {
  const meta = root.querySelector('#docket-meta');
  const match = currentFromTrialMeta(meta);
  if (!match) return;

  const judge = CURRENT_BY_NAME.get(match.current);
  if (!judge) return;

  if (match.legacy) {
    meta.innerHTML = meta.innerHTML.replace(match.legacy, judge.name);
  }

  const icon = root.querySelector('#docket-judge-icon');
  if (icon && icon.textContent !== judge.icon) icon.textContent = judge.icon;

  const statusText = root.querySelector('#docket-status')?.textContent?.trim() || '';
  const stageIndex = STAGE_INDEX.get(statusText) ?? 0;
  const loading = root.querySelector('#loading-text');
  if (!loading || !PROGRESS[judge.name]) return;

  const lines = (loading.textContent || '').split('\n').filter(Boolean);
  if (!lines.length) return;
  const desired = PROGRESS[judge.name][stageIndex];
  const firstLine = lines[0];
  const tail = lines.find(line => line.includes('문서 작성 시간이 길어지고 있지만')) || '';
  const nextText = [firstLine, desired, tail].filter(Boolean).join('\n');
  if (loading.textContent !== nextText) loading.textContent = nextText;
}

function syncBoard(root) {
  root.querySelectorAll('.board-judge-chip').forEach(chip => {
    const text = chip.textContent || '';
    const judge = CURRENT_JUDGES.find(item => text.includes(item.name));
    if (!judge) return;
    const desired = `${judge.icon} ${judge.name} 판사`;
    if (chip.textContent !== desired) chip.textContent = desired;
  });
}

function applyRuntimeJudgeFixes() {
  const root = document.getElementById('page-content');
  if (!root) return;
  syncTrial(root);
  syncBoard(root);
  window.__SOSOKING_JUDGE_RUNTIME_VERSION__ = RUNTIME_JUDGE_VERSION;
}

let queued = false;
function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyRuntimeJudgeFixes();
  });
}

const observeTarget = document.getElementById('page-content') || document.body;
new MutationObserver(queueApply).observe(observeTarget, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', queueApply);
queueApply();
