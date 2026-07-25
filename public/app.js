(() => {
  "use strict";

  const form = document.querySelector("#case-form");
  const incidentInput = document.querySelector("#incident");
  const charCount = document.querySelector("#char-count");
  const formError = document.querySelector("#form-error");
  const courtroom = document.querySelector("#courtroom");
  const stageContent = document.querySelector("#stage-content");
  const caseNumber = document.querySelector("#case-number");
  const nextButton = document.querySelector("#next-button");
  const backButton = document.querySelector("#back-button");
  const restartButton = document.querySelector("#restart-button");
  const exampleButtons = document.querySelectorAll(".example-chip");
  const stageDots = [...document.querySelectorAll("[data-stage-dot]")];

  const unsafeTerms = [
    "폭행", "성폭력", "성추행", "강간", "학대", "자살", "자해", "살인",
    "납치", "스토킹", "협박", "학교폭력", "가정폭력", "아동학대"
  ];

  const state = {
    stage: 0,
    caseData: null,
    selectedQuestion: 0,
    selectedVerdict: null,
    verdictConfirmed: false
  };

  const severityProfiles = {
    official: {
      label: "정식 수사",
      authority: "소문동 생활질서수사대",
      scale: "관계자 4명이 참고인 신분으로 출석했으며, 복도 끝 회의실이 임시 수사본부로 지정됐다.",
      impact: "피해 규모는 작지만 당사자의 억울함이 상당한 것으로 확인됐다."
    },
    special: {
      label: "특별 수사",
      authority: "소문동 특별합동수사본부",
      scale: "수사관 17명과 화이트보드 3개가 긴급 투입됐으며, 브리핑룸에는 아무도 요청하지 않은 생중계석이 설치됐다.",
      impact: "직접 피해는 제한적이나 주변 사람들이 이미 두 번씩 의견을 내놓아 사태가 확대됐다."
    },
    national: {
      label: "국가급 대응",
      authority: "범일상질서 국가비상대책본부",
      scale: "관계기관이 상황판을 설치하고 전국의 유사 사례를 집계하기 시작했다. 총리실은 아직 이 사실을 모른다.",
      impact: "물질적 피해보다 ‘이런 일로 여기까지 왔다’는 사회적 충격이 더 큰 것으로 분석됐다."
    }
  };

  const categoryProfiles = {
    food: {
      keywords: ["과자", "치킨", "아이스크림", "커피", "푸딩", "빵", "음식", "라면", "콜라", "먹", "마셨", "간식"],
      title: "개인 식량 자산 무단 접근 및 잔존량 급감 사건",
      charge: "간식주권 침해 및 증거 은닉",
      scene: "사건 현장에서는 비정상적인 부스러기 분포와 내용물 감소가 동시에 확인됐다.",
      damages: "피해품 1건, 기대감 1회분, 다음 날의 행복 일부",
      evidence: [
        ["증거 제1호", "현장 부스러기", "피고의 동선과 거의 일치하지만 피고는 ‘바닥이 자신을 따라왔다’고 주장했다."],
        ["증거 제2호", "비어 있는 포장지", "쓰레기통 가장 아래에서 발견됐다. 은닉 의도는 부인했으나 위에는 휴지 14장이 덮여 있었다."],
        ["증거 제3호", "잔존 양념", "피고의 손가락에서 피해품과 같은 계열의 양념이 확인됐다. 피고는 계절성 현상이라고 진술했다."]
      ],
      questions: [
        ["왜 허락을 받지 않았습니까?", "피고", "허락을 받으려고 했으나 피해자가 잠들어 있어, 침묵을 한시적 동의로 해석했습니다.", "판사", "재판부는 잠든 사람의 침묵을 간식 양도 계약으로 보지 않습니다."],
        ["정말 한입만 먹었습니까?", "피고", "제 기준으로는 한입이었습니다. 입의 크기는 개인차가 있습니다.", "검사", "피고의 한입이 피해품 전체의 38%라는 감정 결과가 제출됐습니다."],
        ["포장지는 왜 숨겼습니까?", "피고", "분리배출을 준비하던 중이었습니다. 준비 기간은 약 사흘로 예상했습니다.", "판사", "환경 의식이 지나치게 장기 계획입니다."]
      ],
      prosecution: "피고는 피해자의 기대가 가장 높아진 시점을 골라 식량 자산에 접근했고, 빈 포장지를 하단에 배치해 발견을 지연시켰습니다. 이는 우발적 시식이 아니라 계획적 행복 선점입니다.",
      defense: "해당 식품은 공동생활 공간에 있었고 유통기한이 다가오고 있었습니다. 피고의 행위는 섭취가 아니라 긴급한 식품 구조 활동이었습니다.",
      judge: "먹어서 없어진 것인지, 구조해서 뱃속에 보관한 것인지가 이번 재판의 핵심입니다.",
      verdicts: [
        ["피고 전부 유죄", "동일 제품 3개 배상 및 냉장고 앞 공개 사과", "피고는 새 제품을 사 왔으나 피해자가 확인을 위해 먼저 한입 먹었다. 피고 측이 즉시 재심을 청구했다."],
        ["피해자도 일부 책임", "간식 보관함에 명확한 소유권 표시 명령", "피해자는 자물쇠가 달린 보관함을 설치했지만 비밀번호를 냉장고 문에 붙여두었다."],
        ["양측 화해 권고", "편의점 동행 및 각자 원하는 간식 1개 구매", "두 사람은 편의점에서 마지막 남은 같은 과자를 동시에 집었고, 새로운 사건이 접수됐다."]
      ]
    },
    time: {
      keywords: ["늦", "지각", "약속", "기다", "시간", "출근"],
      title: "약속 시각 무단 변경 및 대기시간 전가 사건",
      charge: "시간질서 교란 및 사과 지연",
      scene: "피해자는 약속 장소에 먼저 도착해 메뉴판을 세 차례 정독하고 직원과 어색한 눈인사까지 마친 상태였다.",
      damages: "대기시간, 식어버린 기대감, 먼저 도착한 사람의 체면",
      evidence: [
        ["증거 제1호", "메신저 기록", "피고는 출발했다고 말한 뒤 11분 동안 집 와이파이에 연결돼 있었다."],
        ["증거 제2호", "이동 경로", "약속 장소와 반대 방향 편의점에서 결제 기록이 확인됐다."],
        ["증거 제3호", "사과문", "‘미안 거의 다 왔어’라는 문장이 7분 간격으로 세 차례 반복됐다." ]
      ],
      questions: [
        ["‘거의 다 왔다’는 어디까지입니까?", "피고", "마음은 이미 도착해 있었습니다.", "판사", "재판부는 마음의 위치를 교통수단으로 인정하지 않습니다."],
        ["왜 늦는다고 미리 말하지 않았습니까?", "피고", "늦을 줄 몰랐습니다. 시간이 저보다 먼저 갔습니다.", "검사", "피고는 매번 시간이 먼저 간다고 주장하고 있습니다."],
        ["커피라도 사 왔습니까?", "피고", "급하게 오느라 제 것만 샀습니다.", "판사", "진술할수록 형량이 늘어나는 보기 드문 사건입니다." ]
      ],
      prosecution: "피고는 도착 가능성이 없는 시점에도 ‘거의 다 왔다’는 표현을 반복 전송해 피해자의 귀가 판단을 방해했습니다.",
      defense: "피고는 실제로 약속을 잊지 않았고 최종적으로 현장에 나타났습니다. 지각은 했지만 실종은 아니었습니다.",
      judge: "도착했다는 결과보다 오는 동안 몇 번이나 거짓말했는지가 더 큰 쟁점으로 보입니다.",
      verdicts: [
        ["상습 지각 유죄", "다음 약속 30분 전 도착 및 좌석 확보", "피고는 30분 일찍 출발했으나 날짜를 하루 잘못 알고 혼자 기다렸다."],
        ["커피 미구매 가중처벌", "피해자 음료와 디저트 전액 부담", "피고는 보상용 커피를 주문했지만 자신의 적립번호를 입력해 논란이 이어졌다."],
        ["시간 공동관리 명령", "앞으로 약속시간을 피고에게만 40분 일찍 고지", "피고는 처음으로 제시간에 도착했지만 피해자가 진짜 시간을 알려주지 않아 만나지 못했다."]
      ]
    },
    device: {
      keywords: ["충전기", "리모컨", "케이블", "이어폰", "마우스", "키보드", "휴대폰", "폰"],
      title: "생활 필수장비 차용 후 불완전 반환 사건",
      charge: "전자생활 기반시설 무단 점유",
      scene: "피해 장비는 마지막으로 정상 작동 상태에서 목격됐으나 반환 당시 핵심 부품 또는 의욕이 사라져 있었다.",
      damages: "장비 1점, 배터리 6%, 찾으러 다닌 시간 14분",
      evidence: [
        ["증거 제1호", "반환된 구성품", "본체 없이 선만, 또는 선 없이 본체만 돌아오는 선택적 반환이 확인됐다."],
        ["증거 제2호", "충전 기록", "피고의 기기는 사건 시간대에 12%에서 94%까지 충전됐다."],
        ["증거 제3호", "위치 사진", "피고는 원래 자리에 뒀다고 주장했으나 그 자리는 ‘대충 그 근처’를 의미하는 것으로 밝혀졌다." ]
      ],
      questions: [
        ["왜 완전한 상태로 돌려주지 않았습니까?", "피고", "나머지 부품도 집 안 어딘가에서 함께 생활하고 있습니다.", "판사", "재판부는 ‘어딘가’를 반환 장소로 인정하지 않습니다."],
        ["빌린 사실은 인정합니까?", "피고", "잠깐 옮겼을 뿐입니다. 기간은 기억나지 않습니다.", "검사", "옮긴 뒤 19일 동안 사용한 기록이 있습니다."],
        ["원래 자리가 어디입니까?", "피고", "눈에 보이는 곳입니다.", "판사", "현재 보이지 않기 때문에 재판이 열렸습니다." ]
      ],
      prosecution: "피고는 생활 필수장비를 빌린 뒤 구성품을 분리하고 반환 위치를 추상적으로 고지해 피해자의 배터리와 인내심을 동시에 소모시켰습니다.",
      defense: "장비는 분실된 것이 아니라 가정 내부에서 자유롭게 이동 중입니다. 소유권은 침해되지 않았고 단지 발견 가능성이 낮아졌을 뿐입니다.",
      judge: "물건이 집 안에 있다는 주장만으로 반환이 완료된다면 모든 분실물 사건이 오늘 종결됩니다.",
      verdicts: [
        ["불완전 반환 유죄", "새 장비 배상 및 기존 장비 수색 의무", "새 장비를 사자마자 기존 장비가 소파 밑에서 발견돼 장비가 두 개가 됐다. 피고가 하나를 빌려 갔다."],
        ["공동 수색 명령", "양측이 20분간 집 안 전면 수색", "수색 과정에서 잃어버린 리모컨 세 개와 2019년 영수증이 발견됐지만 문제의 장비는 나오지 않았다."],
        ["관리 소홀 공동책임", "장비마다 이름표와 귀가 장소 지정", "이름표를 붙인 뒤 피고가 이름이 비슷하다는 이유로 다시 가져갔다." ]
      ]
    },
    message: {
      keywords: ["카톡", "답장", "읽씹", "문자", "단톡", "메시지", "연락"],
      title: "메신저 열람 후 장기 무응답 및 감정 대기 사건",
      charge: "응답의무 방치 및 말줄임표 남용",
      scene: "문제의 메시지는 읽음 표시가 사라진 뒤에도 답변이 도착하지 않아 피해자가 자신의 문장을 일곱 차례 재검토했다.",
      damages: "대기시간, 자존심 일부, 삭제할까 말까 고민한 횟수 9회",
      evidence: [
        ["증거 제1호", "읽음 시각", "피고는 메시지를 받은 지 14초 만에 읽었으나 6시간 뒤 이모티콘 하나만 전송했다."],
        ["증거 제2호", "온라인 활동", "무응답 시간 중 다른 게시물에는 댓글 세 개와 좋아요 11개를 남겼다."],
        ["증거 제3호", "작성 중 표시", "세 차례 나타났다 사라졌으며 최종 답변은 ‘ㅇㅋ’였다." ]
      ],
      questions: [
        ["읽고도 왜 답하지 않았습니까?", "피고", "완벽한 답장을 고민하다 시간이 흘렀습니다.", "판사", "완벽한 답장의 결과가 ‘ㅇㅋ’입니까?"],
        ["다른 글에는 댓글을 달았습니다.", "피고", "그 댓글은 생각이 필요 없는 내용이었습니다.", "검사", "피해자 메시지는 생각이 너무 필요해서 하루가 걸렸다는 주장입니다."],
        ["작성 중 표시는 왜 세 번 떴습니까?", "피고", "쓰고 지우기를 반복했습니다.", "판사", "성의는 확인됐으나 결과물이 실종됐습니다." ]
      ],
      prosecution: "피고는 메시지를 신속히 열람하고도 답변을 장기간 보류해 피해자를 의미 추측 상태에 방치했습니다.",
      defense: "답장은 법정 기한이 정해진 업무가 아니며 피고는 늦게나마 응답했습니다. ‘ㅇㅋ’에는 동의와 확인의 의미가 모두 포함됩니다.",
      judge: "두 글자에 너무 많은 법적 효력을 부여하고 있습니다.",
      verdicts: [
        ["상습 읽씹 유죄", "앞으로 읽은 뒤 30분 이내 최소 네 글자 답변", "피고는 정확히 네 글자인 ‘알겠어요’를 모든 대화에 복사해 새로운 갈등을 만들었다."],
        ["피해자 과잉해석 일부 인정", "양측 모두 말줄임표 사용 7일 금지", "금지 첫날 두 사람은 마침표의 차가운 느낌을 두고 다시 다퉜다."],
        ["소통 방식 조정", "중요한 내용은 전화, 사소한 내용은 이모티콘으로 구분", "피고가 모든 내용을 중요하다고 판단해 하루에 12번 전화했다." ]
      ]
    },
    generic: {
      keywords: [],
      title: "일상질서 경미 훼손 및 억울함 과다 발생 사건",
      charge: "사소행위 확대 및 관계 평온 교란",
      scene: "현장에서는 물질적 피해보다 ‘굳이 왜 그랬느냐’는 의문이 더 크게 발견됐다.",
      damages: "직접 피해 소량, 기분 손상 중간, 설명에 들어간 시간 과다",
      evidence: [
        ["증거 제1호", "현장 사진", "사건 전과 후의 차이는 작지만 당사자만 정확히 알아볼 수 있었다."],
        ["증거 제2호", "당사자 진술", "양측 모두 ‘별것 아니다’라고 말하면서 20분째 설명을 이어갔다."],
        ["증거 제3호", "주변인 반응", "처음에는 관심 없던 주변인들이 현재 각자 판결문을 작성 중이다." ]
      ],
      questions: [
        ["왜 이런 행동을 했습니까?", "피고", "당시에는 이 정도로 커질 줄 몰랐습니다.", "판사", "모든 대형 사건은 대체로 그 문장으로 시작합니다."],
        ["피해자에게 바로 사과했습니까?", "피고", "설명부터 했습니다.", "검사", "사과보다 설명이 네 배 길었다는 기록이 있습니다."],
        ["다시 같은 상황이 오면 어떻게 하겠습니까?", "피고", "조금 덜 들키게 하겠습니다.", "판사", "반성의 방향이 잘못됐습니다." ]
      ],
      prosecution: "피고는 사소한 행동을 한 뒤 즉시 사과하지 않고 장문의 해명을 추가해 사건의 크기를 스스로 확대했습니다.",
      defense: "직접 피해는 미미하며 피해자도 이 사건을 주변 사람 다섯 명에게 전파해 사회적 확산에 기여했습니다.",
      judge: "행위보다 해명과 소문이 더 큰 피해를 만들었다는 데 양측 의견이 일치합니다.",
      verdicts: [
        ["피고 유죄", "정식 사과 1회 및 같은 행동 7일 금지", "피고는 사과문을 너무 진지하게 작성해 피해자가 오히려 부담을 느끼고 취하를 요청했다."],
        ["쌍방 과실", "둘이 간식 하나를 나눠 먹으며 종결", "간식을 어떻게 나눌지를 두고 책임비율 산정이 다시 시작됐다."],
        ["사건 자체 기각", "양측 모두 이 일을 다른 사람에게 더 말하지 않기", "판결 직후 양측이 판결 결과를 각자 단체대화방에 공유했다." ]
      ]
    }
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function detectCategory(text) {
    const entries = Object.entries(categoryProfiles).filter(([key]) => key !== "generic");
    const found = entries.find(([, profile]) => profile.keywords.some((keyword) => text.includes(keyword)));
    return found ? found[0] : "generic";
  }

  function makeCaseData(incident, severityKey) {
    const categoryKey = detectCategory(incident);
    const profile = categoryProfiles[categoryKey];
    const severity = severityProfiles[severityKey];
    const hash = hashString(incident + severityKey);
    const serial = String((hash % 9000) + 1000);
    const year = new Date().getFullYear();

    return {
      incident,
      categoryKey,
      severityKey,
      severity,
      profile,
      number: `${year}-소판-${serial}`,
      title: profile.title,
      accused: ["피고인 A", "유력 용의자", "생활질서 교란 혐의자"][hash % 3],
      openedAt: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date())
    };
  }

  function renderStage() {
    if (!state.caseData) return;

    stageDots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === state.stage);
      dot.classList.toggle("is-done", index < state.stage);
    });

    backButton.hidden = state.stage === 0 || state.verdictConfirmed;

    const renderers = [renderOpening, renderInvestigation, renderInterrogation, renderTrial, renderVerdict];
    renderers[state.stage]();
    updateNextButton();
  }

  function renderOpening() {
    const data = state.caseData;
    const incident = escapeHtml(data.incident);

    stageContent.innerHTML = `
      <span class="dossier-label">긴급 사건 접수 보고</span>
      <h2>${escapeHtml(data.title)}</h2>
      <p class="stage-lead">${data.openedAt}, 제보자는 다음과 같은 중대한 일상질서 침해를 신고했다.<br><strong>“${incident}”</strong></p>
      <div class="fact-grid">
        <div class="fact-card"><small>적용 혐의</small><strong>${escapeHtml(data.profile.charge)}</strong><p>실제 법률과는 전혀 관계없는 본 재판소 자체 혐의입니다.</p></div>
        <div class="fact-card"><small>예상 피해</small><strong>${escapeHtml(data.profile.damages)}</strong><p>${escapeHtml(data.severity.impact)}</p></div>
        <div class="fact-card"><small>담당 기관</small><strong>${escapeHtml(data.severity.authority)}</strong><p>${escapeHtml(data.severity.scale)}</p></div>
      </div>
      <div class="judge-line"><strong>재판부 예비 의견</strong><br>“별일 아닌 것처럼 보입니다. 따라서 더욱 철저히 조사하겠습니다.”</div>
    `;
  }

  function renderInvestigation() {
    const data = state.caseData;
    const evidenceCards = data.profile.evidence.map((item, index) => `
      <div class="evidence-card" data-mark="${index + 1}">
        <small>${escapeHtml(item[0])}</small>
        <strong>${escapeHtml(item[1])}</strong>
        <p>${escapeHtml(item[2])}</p>
      </div>
    `).join("");

    stageContent.innerHTML = `
      <span class="dossier-label">현장 감식 결과</span>
      <h2>사소한 현장에서 지나치게 많은 증거가 발견됐다.</h2>
      <p class="stage-lead">${escapeHtml(data.profile.scene)} 수사팀은 현장 보존을 위해 관계없는 물건에도 번호표를 붙였으며, 현재 번호표가 부족한 상태다.</p>
      <div class="evidence-grid">${evidenceCards}</div>
      <div class="judge-line"><strong>수사팀 브리핑</strong><br>“결정적 증거인지는 모르겠으나, 보고서 분량을 늘리는 데에는 충분합니다.”</div>
    `;
  }

  function renderInterrogation() {
    const data = state.caseData;
    const selected = data.profile.questions[state.selectedQuestion];
    const questionButtons = data.profile.questions.map((question, index) => `
      <button type="button" class="question-button ${index === state.selectedQuestion ? "is-selected" : ""}" data-question-index="${index}">
        <span>${escapeHtml(question[0])}</span><span aria-hidden="true">신문 ${index + 1}</span>
      </button>
    `).join("");

    stageContent.innerHTML = `
      <span class="dossier-label">피고인 집중 신문</span>
      <h2>피고는 혐의를 부인했으나 설명할수록 불리해졌다.</h2>
      <div class="question-list">${questionButtons}</div>
      <div class="dialogue">
        <div class="speech"><b>신문관</b><p>${escapeHtml(selected[0])}</p></div>
        <div class="speech is-right"><b>${escapeHtml(selected[1])}</b><p>${escapeHtml(selected[2])}</p></div>
        <div class="speech"><b>${escapeHtml(selected[3])}</b><p>${escapeHtml(selected[4])}</p></div>
      </div>
    `;

    stageContent.querySelectorAll("[data-question-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedQuestion = Number(button.dataset.questionIndex);
        renderInterrogation();
      });
    });
  }

  function renderTrial() {
    const data = state.caseData;
    stageContent.innerHTML = `
      <span class="dossier-label">소문난 판결소 제1법정</span>
      <h2>양측은 사소한 문제를 양보 없이 국가적 쟁점으로 키웠다.</h2>
      <div class="court-columns">
        <section class="counsel-card prosecution">
          <h3>검사 측 최종 의견</h3>
          <blockquote>“${escapeHtml(data.profile.prosecution)}”</blockquote>
        </section>
        <section class="counsel-card defense">
          <h3>변호인 측 최종 의견</h3>
          <blockquote>“${escapeHtml(data.profile.defense)}”</blockquote>
        </section>
      </div>
      <div class="dialogue">
        <div class="speech"><b>검사</b><p>피고의 행동은 사소했지만 그 후의 해명이 사건을 키웠습니다.</p></div>
        <div class="speech is-right"><b>변호인</b><p>사건을 여기까지 키운 것은 수사본부와 재판부도 마찬가지입니다.</p></div>
        <div class="speech"><b>재판장</b><p>${escapeHtml(data.profile.judge)}</p></div>
      </div>
      <div class="judge-line"><strong>재판장</strong><br>“이제 상식과 감정, 그리고 약간의 편견을 종합하여 판결하겠습니다.”</div>
    `;
  }

  function renderVerdict() {
    const data = state.caseData;
    const cards = data.profile.verdicts.map((verdict, index) => `
      <button type="button" class="verdict-card ${state.selectedVerdict === index ? "is-selected" : ""}" data-verdict-index="${index}" ${state.verdictConfirmed ? "disabled" : ""}>
        <strong>${escapeHtml(verdict[0])}</strong>
        <p>${escapeHtml(verdict[1])}</p>
      </button>
    `).join("");

    const selected = state.selectedVerdict === null ? null : data.profile.verdicts[state.selectedVerdict];
    const result = state.verdictConfirmed && selected ? `
      <div class="result-banner">
        <h3>주문: ${escapeHtml(selected[0])}</h3>
        <p>피고에게 <strong>${escapeHtml(selected[1])}</strong>을 명한다. 피고는 판결을 이해하지 못했으나 일단 고개를 끄덕였다.</p>
      </div>
      <div class="after-story">
        <h3>판결 집행 후 긴급 속보</h3>
        <p>${escapeHtml(selected[2])}</p>
      </div>
      <div class="judge-line"><strong>당신의 판결 성향</strong><br>${escapeHtml(makeJudgeType(state.selectedVerdict, data.categoryKey))}</div>
    ` : `
      <div class="judge-line"><strong>재판장 안내</strong><br>“법률 지식은 필요 없습니다. 가장 속이 시원하거나 가장 웃긴 판결을 선택하십시오.”</div>
    `;

    stageContent.innerHTML = `
      <span class="dossier-label">최종 선고</span>
      <h2>${state.verdictConfirmed ? "판결이 확정됐다. 사건은 끝났지만 유치함은 남았다." : "이 사소한 사건에 과도하게 적절한 판결을 내려주세요."}</h2>
      <div class="verdict-grid">${cards}</div>
      ${result}
    `;

    if (!state.verdictConfirmed) {
      stageContent.querySelectorAll("[data-verdict-index]").forEach((button) => {
        button.addEventListener("click", () => {
          state.selectedVerdict = Number(button.dataset.verdictIndex);
          renderVerdict();
          updateNextButton();
        });
      });
    }
  }

  function makeJudgeType(verdictIndex, categoryKey) {
    const common = [
      "사과보다 집행 가능성을 중시하는 생활밀착형 재판관",
      "양쪽 말을 듣고 양쪽 모두 조금씩 벌주는 균형 집착형 재판관",
      "문제 해결보다 다음 사건의 가능성을 키우는 서사 중심형 재판관"
    ];
    const additions = {
      food: "먹는 문제 앞에서는 증거보다 배고픔을 먼저 살피는 간식주권 전문 재판관",
      time: "분 단위의 원한을 법정 기록으로 영구 보존하는 시간질서 전문 재판관",
      device: "충전 잔량 10% 이하에서는 형량이 급격히 높아지는 전자생활 전문 재판관",
      message: "두 글자 답장에도 충분한 책임을 묻는 디지털 소통 전문 재판관",
      generic: common[verdictIndex]
    };
    return additions[categoryKey] || common[verdictIndex];
  }

  function updateNextButton() {
    const labels = [
      "현장 수사 개시 →",
      "피고인 심문 시작 →",
      "법정 공방 개정 →",
      "최종 판결로 이동 →",
      state.verdictConfirmed ? "새 사건 접수하기" : "이 판결 확정하기"
    ];
    nextButton.textContent = labels[state.stage];
    nextButton.disabled = state.stage === 4 && state.selectedVerdict === null;
  }

  function goNext() {
    if (state.stage < 4) {
      state.stage += 1;
      renderStage();
      courtroom.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!state.verdictConfirmed) {
      if (state.selectedVerdict === null) return;
      state.verdictConfirmed = true;
      renderStage();
      return;
    }

    resetCase();
  }

  function goBack() {
    if (state.stage > 0 && !state.verdictConfirmed) {
      state.stage -= 1;
      renderStage();
    }
  }

  function resetCase() {
    state.stage = 0;
    state.caseData = null;
    state.selectedQuestion = 0;
    state.selectedVerdict = null;
    state.verdictConfirmed = false;
    courtroom.hidden = true;
    form.reset();
    charCount.textContent = "0";
    formError.textContent = "";
    incidentInput.focus();
    document.querySelector(".intake-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function validateIncident(value) {
    if (value.length < 7) return "조금만 더 자세히 적어주세요. 최소 7자는 필요합니다.";
    if (unsafeTerms.some((term) => value.includes(term))) {
      return "실제 심각한 피해나 범죄는 코미디 재판으로 만들지 않습니다. 더 가볍고 사소한 일을 적어주세요.";
    }
    if (/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/.test(value) || /@/.test(value)) {
      return "전화번호나 이메일처럼 보이는 개인정보를 지우고 다시 접수해주세요.";
    }
    return "";
  }

  incidentInput.addEventListener("input", () => {
    charCount.textContent = String(incidentInput.value.length);
    if (formError.textContent) formError.textContent = "";
  });

  exampleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      incidentInput.value = button.dataset.example || "";
      charCount.textContent = String(incidentInput.value.length);
      incidentInput.focus();
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const incident = incidentInput.value.trim();
    const error = validateIncident(incident);
    formError.textContent = error;
    if (error) return;

    const severityKey = new FormData(form).get("severity") || "official";
    state.stage = 0;
    state.caseData = makeCaseData(incident, severityKey);
    state.selectedQuestion = 0;
    state.selectedVerdict = null;
    state.verdictConfirmed = false;

    caseNumber.textContent = `사건번호 ${state.caseData.number} · ${state.caseData.severity.label}`;
    courtroom.hidden = false;
    renderStage();
    courtroom.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  nextButton.addEventListener("click", goNext);
  backButton.addEventListener("click", goBack);
  restartButton.addEventListener("click", resetCase);
})();
