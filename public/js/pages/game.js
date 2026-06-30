import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const ROUNDS = [
  {
    title: '마지막 만두 증발 사건',
    desc: '원고가 마지막 만두를 남겨두고 물을 뜨러 간 사이, 접시에는 간장 자국만 남았다.',
    options: ['피고는 3일간 만두를 반으로 나눠 먹는다.', '피고는 만두 앞에서 묵념한다.', '피고는 젓가락 사용법을 다시 배운다.'],
    answer: 0,
    reason: '소소킹 판결은 가볍고 구체적인 생활형 처분일수록 잘 어울립니다.'
  },
  {
    title: '카톡 ㅇㅋ 단독 답변 사건',
    desc: '원고가 긴 고민 상담을 보냈지만 피고는 두 시간 뒤 ㅇㅋ 두 글자만 남겼다.',
    options: ['피고는 하루 동안 모든 답장에 감탄사를 붙인다.', '피고는 이모티콘을 100개 보낸다.', '피고는 말줄임표 사용을 연습한다.'],
    answer: 0,
    reason: '너무 크지 않고 바로 상상되는 처분이 정답에 가깝습니다.'
  },
  {
    title: '리모컨 행방 묵비권 사건',
    desc: '거실 리모컨이 사라졌고 피고가 마지막 사용자였지만 나는 모른다는 말만 반복했다.',
    options: ['피고는 일주일간 리모컨에게 위치 보고를 한다.', '피고는 TV 앞에서 사과문을 읽는다.', '피고는 리모컨을 높임말로 부른다.'],
    answer: 0,
    reason: '리모컨에게 위치 보고라는 이상한 구체성이 소소킹답습니다.'
  },
  {
    title: '아이스크림 한입 과다 사건',
    desc: '한입만 먹으라고 했지만 피고의 한입은 거의 지형 변경 수준이었다.',
    options: ['피고는 다음 한입 요청 시 티스푼을 사용한다.', '피고는 아이스크림 앞에서 거리두기를 한다.', '피고는 냉동실에게 사과한다.'],
    answer: 0,
    reason: '장면이 선명하고 부담 없는 처분이 가장 재미있습니다.'
  },
  {
    title: '충전기 빌림 후 정착 사건',
    desc: '잠깐만 빌린 충전기가 피고 책상에서 새 삶을 시작했다.',
    options: ['피고는 5일간 충전기에 이름표를 붙인다.', '피고는 충전기에게 귀가 시간을 적어준다.', '피고는 케이블을 일렬로 세운다.'],
    answer: 0,
    reason: '생활 도구를 과하게 진지하게 다루는 게 이 게임의 포인트입니다.'
  }
];

let idx = 0;
let score = 0;
let answered = false;

export function renderGame(container) {
  idx = 0;
  score = 0;
  answered = false;
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">판결 게임</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="text-align:center;margin-bottom:22px;">
          <div style="font-size:50px;margin-bottom:8px;">🎮⚖️</div>
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);">생활법정 배심원 게임</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">사건을 보고 가장 소소킹다운 판결을 고르세요.</div>
        </div>
        <div id="game-box"></div>
      </div>
    </div>`;
  drawRound();
}

function drawRound() {
  answered = false;
  const box = document.getElementById('game-box');
  if (!box) return;
  const r = ROUNDS[idx];
  box.innerHTML = `
    <div class="card" style="padding:20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span class="badge badge-gold">${idx + 1} / ${ROUNDS.length}</span><span style="font-size:13px;color:var(--cream-dim);">점수 ${score}점</span></div>
      <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;margin-bottom:10px;">${escapeHtml(r.title)}</div>
      <div style="font-size:14px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(r.desc)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">${r.options.map((op, i) => `<button class="card game-option" data-i="${i}" style="text-align:left;padding:16px 18px;border:1px solid var(--border);cursor:pointer;background:rgba(255,255,255,0.035);"><div style="font-size:12px;color:var(--gold);font-weight:800;margin-bottom:5px;">판결 ${i + 1}</div><div style="font-size:15px;line-height:1.55;color:var(--cream);">${escapeHtml(op)}</div></button>`).join('')}</div>
    <div id="game-result" style="margin-top:14px;"></div>`;
  document.querySelectorAll('.game-option').forEach(btn => btn.addEventListener('click', () => choose(Number(btn.dataset.i))));
}

function choose(choice) {
  if (answered) return;
  answered = true;
  const r = ROUNDS[idx];
  const ok = choice === r.answer;
  if (ok) score += 20;
  document.querySelectorAll('.game-option').forEach(btn => {
    const i = Number(btn.dataset.i);
    btn.style.opacity = i === choice || i === r.answer ? '1' : '.45';
    if (i === r.answer) btn.style.borderColor = '#27ae60';
    if (i === choice && !ok) btn.style.borderColor = '#e74c3c';
  });
  const result = document.getElementById('game-result');
  result.innerHTML = `<div class="card" style="padding:18px;border-color:${ok ? '#27ae60' : '#e74c3c'};"><div style="font-size:18px;font-weight:900;color:${ok ? '#27ae60' : '#e74c3c'};margin-bottom:8px;">${ok ? '정답입니다.' : '아쉽습니다.'}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:14px;">${escapeHtml(r.reason)}</div><button class="btn btn-primary" id="next-round">${idx >= ROUNDS.length - 1 ? '최종 결과 보기' : '다음 사건'}</button></div>`;
  document.getElementById('next-round').onclick = () => idx >= ROUNDS.length - 1 ? drawFinal() : (idx += 1, drawRound());
}

function drawFinal() {
  const box = document.getElementById('game-box');
  const grade = score >= 90 ? '생활법정 수석판사' : score >= 70 ? '소소킹 예비판사' : score >= 50 ? '억울함 감별사' : '방청객 1열';
  box.innerHTML = `<div class="card" style="padding:28px 22px;text-align:center;"><div style="font-size:58px;margin-bottom:12px;">🏆</div><div style="font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--gold);margin-bottom:8px;">${escapeHtml(grade)}</div><div style="font-size:42px;font-weight:900;margin-bottom:8px;">${score}점</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:22px;">당신은 사소한 억울함과 과한 판결의 균형을 어느 정도 이해했습니다.</div><a href="#/submit" class="btn btn-primary">내 사건 접수하기</a><button class="btn btn-secondary" id="again" style="margin-top:10px;">다시 하기</button></div>`;
  document.getElementById('again').onclick = () => { idx = 0; score = 0; drawRound(); };
}
