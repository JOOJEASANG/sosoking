import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const CASES = [
  {
    title: '마지막 만두 증발 사건',
    docket: '게임2026-만두-001',
    fact: '원고가 마지막 만두를 남겨두고 물을 뜨러 간 사이, 접시에는 간장 자국만 남았다.',
    plaintiff: '원고는 마지막 만두가 식사의 결말이자 하루의 희망이었다고 주장한다.',
    defendant: '피고는 만두가 공용 접시 위에 있었으므로 묵시적 공유재산이라고 항변한다.',
    evidence: ['증 제1호: 간장만 남은 접시 사진', '증 제2호: 피고의 젓가락 끝 윤기', '증 제3호: 방청석의 탄식 2회'],
    options: [
      ['피고는 3일간 만두를 반으로 나눠 먹는다.', 35, '구체적이고 가벼우며 다시 떠올리면 웃긴 처분입니다.'],
      ['피고는 만두 앞에서 1분간 묵념한다.', 24, '웃기긴 하지만 재발 방지력이 조금 약합니다.'],
      ['피고는 젓가락 사용법을 다시 배운다.', 18, '상황과 관련은 있지만 처분의 선명도가 낮습니다.']
    ]
  },
  {
    title: '카톡 ㅇㅋ 단독 답변 사건',
    docket: '게임2026-읽씹-014',
    fact: '원고가 긴 고민 상담을 보냈지만 피고는 두 시간 뒤 ㅇㅋ 두 글자만 남겼다.',
    plaintiff: '원고는 ㅇㅋ가 답장이 아니라 감정의 폐업신고였다고 주장한다.',
    defendant: '피고는 짧지만 긍정적 의사표시였고, 데이터 절약의 미덕이었다고 항변한다.',
    evidence: ['증 제1호: 원고의 17줄 메시지', '증 제2호: 피고의 ㅇㅋ 1건', '증 제3호: 읽음 표시 후 침묵 2시간'],
    options: [
      ['피고는 하루 동안 모든 답장에 감탄사를 붙인다.', 35, '처분이 가볍고 바로 실행 가능하며 사건의 핵심을 찌릅니다.'],
      ['피고는 이모티콘을 100개 보낸다.', 16, '과해서 오히려 스팸형 처분입니다.'],
      ['피고는 말줄임표 사용을 연습한다.', 22, '분위기는 맞지만 사건 해결력이 약합니다.']
    ]
  },
  {
    title: '리모컨 행방 묵비권 사건',
    docket: '게임2026-리모컨-404',
    fact: '거실 리모컨이 사라졌고 피고가 마지막 사용자였지만 나는 모른다는 말만 반복했다.',
    plaintiff: '원고는 채널 선택권이 침해되어 생활 평온이 흔들렸다고 주장한다.',
    defendant: '피고는 리모컨도 독립된 이동 의사가 있을 수 있다고 항변한다.',
    evidence: ['증 제1호: 소파 틈 먼지', '증 제2호: 마지막 채널 변경 기록', '증 제3호: 피고의 어색한 시선 회피'],
    options: [
      ['피고는 일주일간 리모컨에게 위치 보고를 한다.', 35, '사건 대상인 리모컨을 직접 판결문에 끌어들이는 좋은 처분입니다.'],
      ['피고는 TV 앞에서 사과문을 읽는다.', 23, '그럴듯하지만 리모컨 실종의 허무함이 덜 살아납니다.'],
      ['피고는 리모컨을 높임말로 부른다.', 28, '웃기지만 재판 결과라기보다는 벌칙에 가깝습니다.']
    ]
  },
  {
    title: '아이스크림 한입 과다 사건',
    docket: '게임2026-한입-777',
    fact: '한입만 먹으라고 했지만 피고의 한입은 거의 지형 변경 수준이었다.',
    plaintiff: '원고는 한입의 사회통념상 범위가 명백히 초과되었다고 주장한다.',
    defendant: '피고는 개인별 구강 면적 차이를 고려해야 한다고 항변한다.',
    evidence: ['증 제1호: 반달 모양으로 사라진 아이스크림', '증 제2호: 피고의 “진짜 한입” 진술', '증 제3호: 원고의 얼어붙은 표정'],
    options: [
      ['피고는 다음 한입 요청 시 티스푼을 사용한다.', 35, '사건 원인에 정확히 맞고 상상하기 쉬운 생활형 처분입니다.'],
      ['피고는 아이스크림 앞에서 거리두기를 한다.', 26, '재미는 있으나 집행 방식이 조금 애매합니다.'],
      ['피고는 냉동실에게 사과한다.', 20, '재밌지만 피해자인 원고와 연결이 약합니다.']
    ]
  },
  {
    title: '충전기 빌림 후 정착 사건',
    docket: '게임2026-충전-220',
    fact: '잠깐만 빌린 충전기가 피고 책상에서 새 삶을 시작했다.',
    plaintiff: '원고는 배터리 3% 상태에서 인간 존엄이 흔들렸다고 주장한다.',
    defendant: '피고는 충전기가 자발적으로 책상에 머문 것으로 보인다고 항변한다.',
    evidence: ['증 제1호: 피고 책상 뒤편 케이블 흔적', '증 제2호: 원고 배터리 3% 캡처', '증 제3호: “금방 돌려줄게” 녹취 취지'],
    options: [
      ['피고는 5일간 충전기에 이름표를 붙인다.', 35, '재발 방지와 웃음 포인트가 모두 살아 있습니다.'],
      ['피고는 충전기에게 귀가 시간을 적어준다.', 30, '상당히 좋지만 집행 가능성이 조금 낮습니다.'],
      ['피고는 케이블을 일렬로 세운다.', 18, '귀엽지만 사건 핵심과 거리가 있습니다.']
    ]
  }
];

let index = 0;
let score = 0;
let log = [];
let phase = 'brief';

export function renderGame(container) {
  index = 0;
  score = 0;
  log = [];
  phase = 'brief';
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">판결 게임</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:50px;margin-bottom:8px;">🎮⚖️</div>
          <div style="font-family:var(--font-serif);font-size:23px;font-weight:900;color:var(--gold);">소소킹 배심원 모의재판</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">기록을 보고, 증거를 확인하고, 가장 생활법정다운 처분을 고르세요.</div>
        </div>
        <div id="game-box"></div>
      </div>
    </div>`;
  drawBrief();
}

function current() { return CASES[index]; }

function headerHtml(c) {
  return `<div class="card" style="padding:18px;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:9px;">
      <span class="badge badge-gold">${index + 1} / ${CASES.length} 사건</span>
      <span style="font-size:12px;color:var(--cream-dim);">점수 ${score}점</span>
    </div>
    <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.1em;margin-bottom:5px;">${escapeHtml(c.docket)}</div>
    <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;margin-bottom:8px;">${escapeHtml(c.title)}</div>
    <div style="font-size:14px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(c.fact)}</div>
  </div>`;
}

function drawBrief() {
  phase = 'brief';
  const c = current();
  document.getElementById('game-box').innerHTML = `${headerHtml(c)}
    <div class="card" style="padding:18px;margin-bottom:12px;">
      <div style="font-weight:900;color:var(--gold);margin-bottom:10px;">📑 사건기록 요약</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.8;"><b style="color:var(--cream);">원고 주장</b><br>${escapeHtml(c.plaintiff)}<br><br><b style="color:var(--cream);">피고 답변</b><br>${escapeHtml(c.defendant)}</div>
    </div>
    <button class="btn btn-primary" id="to-evidence">증거조사 시작</button>`;
  document.getElementById('to-evidence').onclick = drawEvidence;
}

function drawEvidence() {
  phase = 'evidence';
  const c = current();
  document.getElementById('game-box').innerHTML = `${headerHtml(c)}
    <div class="card" style="padding:18px;margin-bottom:12px;">
      <div style="font-weight:900;color:var(--gold);margin-bottom:10px;">🔍 증거조사</div>
      ${c.evidence.map((e, i) => `<div style="padding:10px 0;border-top:${i ? '1px solid var(--border)' : '0'};font-size:13px;color:var(--cream-dim);line-height:1.6;">${escapeHtml(e)}</div>`).join('')}
    </div>
    <div class="card" style="padding:16px;margin-bottom:12px;background:rgba(201,168,76,.07);">
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">재판장: “본 법정은 지나치게 현실적인 처벌보다, 사소하지만 선명한 생활형 처분을 높게 평가합니다.”</div>
    </div>
    <button class="btn btn-primary" id="to-verdict">평의실 입장</button>`;
  document.getElementById('to-verdict').onclick = drawVerdictChoice;
}

function drawVerdictChoice() {
  phase = 'verdict';
  const c = current();
  document.getElementById('game-box').innerHTML = `${headerHtml(c)}
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${c.options.map(([text], i) => `<button class="card game-option" data-i="${i}" style="text-align:left;padding:16px 18px;border:1px solid var(--border);cursor:pointer;background:rgba(255,255,255,.035);">
        <div style="font-size:12px;color:var(--gold);font-weight:900;margin-bottom:5px;">후보 주문 ${i + 1}</div>
        <div style="font-size:15px;line-height:1.55;color:var(--cream);">${escapeHtml(text)}</div>
      </button>`).join('')}
    </div>
    <div id="game-result" style="margin-top:14px;"></div>`;
  document.querySelectorAll('.game-option').forEach(btn => btn.onclick = () => choose(Number(btn.dataset.i)));
}

function choose(choice) {
  const c = current();
  const [text, points, reason] = c.options[choice];
  score += points;
  log.push({ title: c.title, text, points });
  const best = Math.max(...c.options.map(o => o[1]));
  document.querySelectorAll('.game-option').forEach(btn => {
    const i = Number(btn.dataset.i);
    btn.disabled = true;
    const p = c.options[i][1];
    btn.style.opacity = i === choice || p === best ? '1' : '.45';
    if (p === best) btn.style.borderColor = '#27ae60';
    if (i === choice && p < best) btn.style.borderColor = '#e74c3c';
  });
  const result = document.getElementById('game-result');
  result.innerHTML = `<div class="card" style="padding:18px;border-color:${points === best ? '#27ae60' : '#c9a84c'};">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;"><div style="font-size:18px;font-weight:900;color:${points === best ? '#27ae60' : 'var(--gold)'};">${points === best ? '명판결입니다' : '부분 인용입니다'}</div><span class="badge badge-gold">+${points}점</span></div>
    <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:14px;">${escapeHtml(reason)}</div>
    <button class="btn btn-primary" id="next-round">${index >= CASES.length - 1 ? '최종 선고 보기' : '다음 사건 접수'}</button>
  </div>`;
  document.getElementById('next-round').onclick = () => index >= CASES.length - 1 ? drawFinal() : (index += 1, drawBrief());
}

function drawFinal() {
  const grade = score >= 165 ? '생활법정 수석재판장' : score >= 135 ? '소소킹 국민참여재판 우수배심원' : score >= 105 ? '억울함 감별사' : '방청석 1열 관찰인';
  const rows = log.map(r => `<div style="padding:10px 0;border-top:1px solid var(--border);text-align:left;"><div style="font-weight:800;font-size:13px;">${escapeHtml(r.title)}</div><div style="font-size:12px;color:var(--cream-dim);line-height:1.55;margin-top:3px;">${escapeHtml(r.text)} · +${r.points}점</div></div>`).join('');
  document.getElementById('game-box').innerHTML = `<div class="card" style="padding:28px 22px;text-align:center;">
    <div style="font-size:58px;margin-bottom:12px;">🏆</div>
    <div style="font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--gold);margin-bottom:8px;">${escapeHtml(grade)}</div>
    <div style="font-size:42px;font-weight:900;margin-bottom:8px;">${score}점</div>
    <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:20px;">사건기록 검토, 증거조사, 평의, 선고까지 모두 마쳤습니다.</div>
    <div class="card" style="padding:14px;margin-bottom:16px;background:rgba(255,255,255,.025);">${rows}</div>
    <a href="#/submit" class="btn btn-primary">내 사건 접수하기</a>
    <button class="btn btn-secondary" id="again" style="margin-top:10px;">다시 재판하기</button>
  </div>`;
  document.getElementById('again').onclick = () => { index = 0; score = 0; log = []; drawBrief(); };
}
