export function renderGuide(container) {
  const steps = [
    ['🔐', '로그인하고 생활사건 접수', 'Google 또는 이메일 계정으로 로그인한 뒤 사소한 생활분쟁을 접수합니다. 직접 글을 작성하는 곳은 사건접수 한 곳뿐이며, 실명·연락처·주소 등 개인정보는 빼주세요.'],
    ['🎲', 'AI 판사 자동 배정', '엄벌주의형·감성형·현실주의형·과몰입형·피곤형·논리집착형·드립형 중 한 명이 사건마다 자동 배정됩니다.'],
    ['📑', '다섯 문서와 생활형 처분 확인', 'AI가 사건접수, 수사보고, 원고측 변론, 피고측 변론, 판결문을 문서처럼 작성합니다. 접수한 본인은 결과를 바로 확인할 수 있습니다.'],
    ['🔒', '결과 확인 후 공개 선택', '사건과 판결문은 기본적으로 비공개입니다. 결과를 확인한 뒤 공개를 허용한 익명 사건만 판결기록과 오늘의 재판 후보가 됩니다.']
  ];
  const dailySteps = [
    ['1', '오늘의 익명 생활사건 3건 읽기', '접수자가 결과 확인 후 공개를 허용한 사건 가운데 매일 3건을 선정합니다. 공개사건이 부족할 때만 가상 생활사건으로 채웁니다.'],
    ['2', '원고·피고·쌍방 중 선택하기', '오늘의 재판에서는 글이나 댓글을 작성하지 않습니다. 사건 요약과 양측 주장을 읽고 정해진 선택지 하나만 고릅니다.'],
    ['3', 'AI 판결과 민심 비교하기', '선택을 제출하면 AI 판사의 판단과 전체 이용자 선택 비율이 공개됩니다. 세 사건을 완료하면 일간·주간·누적 참여 랭킹에 반영됩니다.']
  ];
  const faqs = [
    ['진짜 법원인가요?', '아닙니다. AI 생활판결과 오늘의 재판은 모두 오락 콘텐츠이며 법률상담이나 실제 재판을 대신하지 않습니다.'],
    ['글은 어디에서 작성하나요?', '사용자가 직접 내용을 작성하는 곳은 사건접수 한 곳뿐입니다. 오늘의 재판에서는 제공된 선택지만 고를 수 있습니다.'],
    ['사건 접수에 로그인이 필요한가요?', '네. 내 사건과 공개 여부를 안전하게 관리하기 위해 Google 또는 이메일 로그인이 필요합니다. 이메일 가입자는 인증을 완료해야 합니다.'],
    ['하루에 몇 번 접수할 수 있나요?', '현재 적용 중인 횟수는 사건 접수 화면에 표시됩니다. 운영자는 테스트·비용·안전 상황에 따라 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.'],
    ['내 AI 판결은 언제 볼 수 있나요?', '접수한 본인은 생성이 끝나는 즉시 전체 결과를 확인할 수 있습니다. 사건은 기본적으로 비공개입니다.'],
    ['판결 결과를 공개하면 어떻게 되나요?', '안전 검사를 통과한 익명 사건과 AI 판결문이 판결기록에 표시됩니다. 공개 사건은 오늘의 재판 후보가 되고 일반 URL과 검색엔진에 노출될 수 있습니다. 다시 비공개로 전환하거나 삭제할 수 있지만 외부 공유본이나 기존 검색 색인은 즉시 사라지지 않을 수 있습니다.'],
    ['오늘의 재판 사건은 실제 유저가 접수한 것인가요?', '공개를 허용한 익명 유저 사건을 우선 사용합니다. 공개 사건이 3건보다 적을 때만 초기 운영용 가상 생활사건이 포함됩니다.'],
    ['AI 판결과 다르게 선택하면 틀린 건가요?', '아닙니다. AI 판결은 비교 기준일 뿐 정답이 아닙니다. 다른 선택도 전체 민심 통계에 반영되며 참여 점수를 받습니다.'],
    ['내 선택이 다른 사람에게 공개되나요?', '개별 회원의 선택은 공개하지 않고 선택지별 전체 표 수와 비율만 보여줍니다.'],
    ['진짜 심각한 일이라면요?', '실제 범죄·손해·가정·노동·계약·의료 문제는 변호사, 대한법률구조공단 또는 관계 기관에 상담해야 합니다.']
  ];

  container.innerHTML = `<div><div class="page-header"><a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a><span class="logo">이용 안내</span></div><div class="container" style="padding-top:28px;padding-bottom:90px;"><div style="text-align:center;margin-bottom:32px;"><div style="font-size:48px;margin-bottom:12px;" aria-hidden="true">⚖️</div><h1 style="font-family:var(--font-serif);font-size:22px;font-weight:800;margin-bottom:6px;color:var(--gold);">소소킹 판결소 사용법</h1><div style="font-size:13px;color:var(--cream-dim);">내 이야기는 사건접수에, 다른 사건은 선택으로 판결합니다.</div></div>
  <section style="margin-bottom:36px;"><h2 style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--gold);">AI 생활판결</h2><p style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">사소한 억울함을 한 번 접수하고 문서형 AI 판결을 받는 과정입니다.</p><div style="display:flex;flex-direction:column;gap:14px;">${steps.map(([icon,title,desc], index) => `<div class="card" style="display:flex;gap:15px;align-items:flex-start;padding:18px 20px;"><div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid var(--border);border-radius:50%;background:var(--gold-dim);font-size:22px;">${icon}</div><div><div style="font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:3px;">STEP ${index + 1}</div><div style="font-weight:800;font-size:15px;margin-bottom:5px;color:var(--cream);">${title}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${desc}</div></div></div>`).join('')}</div></section>
  <section style="margin-bottom:36px;"><h2 style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--gold);">오늘의 재판</h2><p style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">공개된 익명 생활사건을 자유입력 없이 선택만으로 판결합니다.</p><div style="display:flex;flex-direction:column;gap:12px;">${dailySteps.map(([num,title,desc]) => `<div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:17px 19px;"><div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:50%;background:var(--gold);color:var(--navy);font-weight:900;">${num}</div><div><div style="font-weight:800;font-size:15px;margin-bottom:4px;color:var(--cream);">${title}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${desc}</div></div></div>`).join('')}</div><a href="#/daily-court" class="btn btn-secondary" style="margin-top:14px;">⚖️ 오늘의 재판 참여하기</a></section>
  <section style="margin-bottom:36px;"><h2 style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:16px;color:var(--gold);">자주 묻는 질문</h2><div style="display:flex;flex-direction:column;gap:10px;">${faqs.map(([question,answer]) => `<details class="card" style="padding:0;overflow:hidden;"><summary style="list-style:none;cursor:pointer;padding:16px 18px;font-weight:800;font-size:14px;color:var(--cream);display:flex;justify-content:space-between;gap:12px;"><span>Q. ${question}</span><span style="color:var(--gold);">＋</span></summary><div style="padding:0 18px 17px;font-size:13px;color:var(--cream-dim);line-height:1.75;">A. ${answer}</div></details>`).join('')}</div></section>
  <div class="disclaimer" style="margin-bottom:24px;"><strong>⚠️ 오락 서비스 안내</strong><br>AI 생활판결과 오늘의 재판은 재미를 위한 판단 비교 콘텐츠이며 법적 효력이 없습니다. 실제 법률문제는 전문가나 관계 기관에 상담해주세요.</div><a href="#/submit" class="btn btn-primary">⚖️ 내 사건 접수하기</a></div></div>`;
}
