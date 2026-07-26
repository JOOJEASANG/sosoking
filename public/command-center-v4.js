(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const endpoint = "/api/generate-case";
  const roomOrder = ["field", "surveillance", "forensics", "interrogation", "briefing", "court"];
  const roomMeta = {
    field: { icon: "🚨", title: "초동 현장", short: "현장", subtitle: "통제선부터 과하게" },
    surveillance: { icon: "🥸", title: "잠복 차량", short: "잠복", subtitle: "위장은 대체로 실패" },
    forensics: { icon: "🧪", title: "과잉 감식실", short: "감식", subtitle: "부스러기도 정밀 분석" },
    interrogation: { icon: "🎙️", title: "피의자 심문실", short: "심문", subtitle: "말 한마디도 기록" },
    briefing: { icon: "📡", title: "긴급 브리핑실", short: "브리핑", subtitle: "마이크가 증거보다 많음" },
    court: { icon: "⚖️", title: "최종 법정", short: "법정", subtitle: "판결만큼은 사용자가" }
  };

  const state = {
    data: null,
    incident: "",
    severity: "official",
    caseNumber: "",
    activeRoom: null,
    completed: new Set(),
    discovered: [],
    choices: {
      disguise: "",
      evidence: new Set(),
      interrogation: {},
      briefingTone: "",
      courtEvidence: "",
      verdictIndex: null
    },
    chaos: 1,
    loadingTimer: null,
    loadingIndex: 0
  };

  const screens = {
    intake: $("#intake-screen"),
    loading: $("#loading-screen"),
    board: $("#board-screen"),
    result: $("#result-screen")
  };

  const form = $("#case-form");
  const incidentInput = $("#incident");
  const charCount = $("#char-count");
  const formError = $("#form-error");
  const missionPanel = $("#mission-panel");
  const toast = $("#toast");

  const loadingMessages = [
    ["상황실", "사건 필요성을 3%로 산정", "그래도 회의실 두 곳을 확보했습니다."],
    ["초동팀", "현장요원 14명 호출", "현재 11명은 왜 불렸는지 모릅니다."],
    ["잠복팀", "위장용 선글라스 선정", "실내지만 작전상 필요하다는 결론입니다."],
    ["감식실", "미세 부스러기 분석 착수", "분석 장비가 부스러기보다 비쌉니다."],
    ["압수반", "증거봉투와 거의 영장 준비", "압수 대상은 아직 정하지 않았습니다."],
    ["브리핑실", "마이크 7개 배치", "질문은 한 개만 받을 예정입니다."],
    ["재판부", "엄숙함 최종 충전", "웃으면 법정모독은 아니지만 분위기가 깨집니다."]
  ];

  const demoCase = {
    title: "탕비실 푸딩 뚜껑 단독 생존 사건",
    subtitle: "내용물은 사라졌으나 뚜껑만 현장을 지켰다",
    charge: "냉장보관 신뢰질서 교란 및 디저트 행방 은폐",
    summary: "회사 냉장고에 보관된 푸딩의 내용물만 사라지고 뚜껑이 남았다. 생활질서 특수본은 이를 단순 간식 문제가 아닌 조직적 냉장고 질서 붕괴로 규정했다.",
    damages: "푸딩 1개, 오후의 기대감 73%, 동료 간 신뢰 2칸",
    commandCenter: "탕비실 임시 합동수사본부",
    operationName: "작전명: 흔들리는 캐러멜",
    emergencyGrade: "생활질서 위기 2단계",
    scale: "현장요원 14명·감식장비 9종",
    impact: "회의 집중력 저하 및 냉장고 문 개방 증가",
    taskForceUnits: ["냉장고 출입동선 분석반", "디저트 흔적 정밀감식반", "숟가락 미확보 전담팀", "사내소문 긴급브리핑반"],
    dispatchLog: [
      { time: "14:03", unit: "초동대응반", action: "탕비실 반경 1.2m 통제", note: "복사기 이용자가 우회로를 요구했다." },
      { time: "14:07", unit: "보존팀", action: "푸딩 뚜껑을 A급 증거로 승격", note: "뚜껑은 별다른 의견을 내지 않았다." },
      { time: "14:12", unit: "동선팀", action: "냉장고 앞 발자국 19개 확보", note: "18개는 점심시간부터 있던 흔적이다." },
      { time: "14:18", unit: "상황실", action: "사건명을 세 차례 확대 변경", note: "최종 명칭이 원문보다 길어졌다." }
    ],
    surveillance: {
      location: "탕비실 정수기 옆 종이컵 보관대",
      duration: "1시간 47분",
      disguise: "물 마시러 왔지만 컵을 고르지 못하는 직원",
      observation: "용의선상 인물 세 명이 냉장고를 열었으나 모두 자신의 음료만 확인했다.",
      unexpected: "잠복요원이 종이컵 재고 부족 문제를 먼저 해결했다."
    },
    forensicReports: [
      { sample: "푸딩 뚜껑 안쪽", method: "캐러멜 반사광 48배 확대", finding: "갈색 소스가 시계방향으로 닦인 흔적 발견", unnecessaryConclusion: "먹은 사람은 정리정돈 의식이 부분적으로 존재한다." },
      { sample: "냉장고 선반", method: "저온 점착 흔적 스캔", finding: "작은 용기가 오른쪽으로 3.4cm 이동", unnecessaryConclusion: "용의자는 오른손잡이거나 왼손 사용을 미뤘다." },
      { sample: "탕비실 숟가락통", method: "금속 진동 잔향 비교", finding: "사건 시간대 숟가락 한 개 사용 가능성", unnecessaryConclusion: "포크로 먹었을 가능성은 국민 정서상 배제한다." }
    ],
    search: {
      warrant: "탕비실 간식보호 임시확인서 제4호",
      target: "공용 서랍, 개인 머그컵 주변, 냉장고 상단",
      seizedItems: ["빈 캐러멜 시럽 1개", "출처 불명의 작은 숟가락", "푸딩과 무관한 녹차 티백 4개"],
      officerNote: "압수품 대부분이 사건보다 오래 근무한 것으로 확인됐다."
    },
    evidence: [
      { label: "증거 A", title: "세척된 푸딩 뚜껑", detail: "내용물은 없으나 뚜껑만 깨끗하게 닦여 현장에 남았다.", significance: "충동적 범행이라기보다 설거지까지 계획한 정리형 행위로 본다." },
      { label: "증거 B", title: "시럽 네 번 추가 영수증", detail: "단것을 싫어한다던 동료가 커피에 시럽을 네 번 추가했다.", significance: "진술과 당 섭취 성향 사이에 매우 달콤한 모순이 있다." },
      { label: "증거 C", title: "작은 국자", detail: "팀장 서랍에서 푸딩보다 큰 국자가 발견됐다.", significance: "도구 선택이 과도해 오히려 범행 가능성이 낮다는 반론도 있다." },
      { label: "증거 D", title: "화분 흙의 캐러멜 향", detail: "탕비실 화분에서 희미한 캐러멜 향이 확인됐다.", significance: "푸딩을 먹지 않고 식물 영양제로 오인했을 가능성이 생겼다." }
    ],
    questions: [
      { question: "단것을 싫어한다면서 시럽은 왜 네 번 넣었습니까?", speaker: "신문관", response: "커피가 써서 단맛을 중화하려고 넣었습니다.", replySpeaker: "수사본부", reply: "단맛으로 단맛을 중화했다는 신개념 진술을 기록합니다." },
      { question: "푸딩을 마지막으로 본 시각은 언제입니까?", speaker: "신문관", response: "냉장고 문을 열었지만 보지 않으려고 노력했습니다.", replySpeaker: "수사본부", reply: "목격 회피 의지가 지나치게 구체적입니다." },
      { question: "화분에서 캐러멜 향이 나는 이유를 압니까?", speaker: "신문관", response: "식물도 가끔 디저트가 필요할 수 있다고 생각했습니다.", replySpeaker: "수사본부", reply: "식물의 묵비권을 존중하며 진술을 보류합니다." }
    ],
    briefing: {
      headline: "탕비실 푸딩 사건, 화분 연루 가능성으로 수사 확대",
      spokesperson: "생활질서 특수본 대변인",
      statement: "현재 푸딩의 행방과 화분의 영양 상태를 동시에 확인하고 있습니다. 모든 가능성을 열어두되 냉장고 문은 닫아두겠습니다.",
      reporterQuestion: "이 정도 사건에 브리핑룸과 마이크 7개가 꼭 필요합니까?",
      answer: "필요성 여부는 장비 철수 이후 별도 위원회가 검토할 예정입니다."
    },
    prosecution: "피고는 푸딩을 사라지게 했고, 증거를 세척했으며, 화분까지 사건에 끌어들였습니다. 디저트 질서에 대한 명백한 도전입니다.",
    defense: "피고가 푸딩을 먹었다는 직접 증거는 없습니다. 오히려 화분에 제공했다면 식물복지 차원의 선의였을 수 있습니다.",
    judge: "본 재판부는 푸딩보다 사건을 크게 만든 수사본부의 책임도 가볍지 않다고 봅니다.",
    verdicts: [
      { title: "푸딩 30개 공개 복구형", sentence: "피고는 전 직원 앞에서 푸딩 30개를 냉장고에 채우고 각 뚜껑에 이름을 적는다.", afterStory: "이름표가 너무 많아 냉장고 문이 닫히지 않는 후속 사건이 발생했다." },
      { title: "탕비실 공동책임형", sentence: "모든 직원은 일주일간 간식 반입과 반출을 출입대장에 기록한다.", afterStory: "커피 한 모금까지 기록하는 직원이 나타나 대장이 400쪽을 넘겼다." },
      { title: "화분과의 황당한 화해형", sentence: "피고는 화분에 공개 사과하고 식물용 영양제와 푸딩을 명확히 구분하는 교육을 받는다.", afterStory: "화분 옆에 디저트 금지 표지판이 설치되자 다른 화분이 차별을 주장했다." }
    ],
    judgeTypes: ["증거봉투 수집형 재판관", "생활질서 과잉보호형 판사", "식물권 전문 화해조정관"]
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, element]) => {
      element.hidden = key !== name;
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function caseNumber() {
    const now = new Date();
    const date = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `SO-${date}-${Math.floor(100 + Math.random() * 900)}`;
  }

  function validateIncident(value) {
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length < 7) return "사건 내용을 7자 이상 적어주세요.";
    if (text.length > 120) return "사건 내용은 120자 이하만 접수됩니다.";
    const blocked = ["폭행", "성폭력", "학대", "자살", "자해", "살인", "납치", "유괴", "스토킹", "협박", "학교폭력", "가정폭력", "아동학대", "사망", "흉기", "마약"];
    if (blocked.some((term) => text.includes(term))) return "실제 심각한 피해나 범죄는 코미디 사건으로 접수할 수 없습니다.";
    if (/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\//i.test(text)) return "전화번호·이메일·주소 같은 개인정보를 삭제해주세요.";
    return "";
  }

  function startLoading() {
    showScreen("loading");
    state.loadingIndex = 0;
    $("#operation-feed").innerHTML = "";
    $("#loading-progress").style.width = "7%";
    $("#loading-percent").textContent = "07%";
    appendLoadingMessage();
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(() => {
      if (state.loadingIndex < loadingMessages.length) appendLoadingMessage();
    }, 2300);
  }

  function appendLoadingMessage() {
    const item = loadingMessages[state.loadingIndex];
    if (!item) return;
    const minute = String(3 + state.loadingIndex * 2).padStart(2, "0");
    $("#operation-feed").insertAdjacentHTML("beforeend", `<li><time>작전+${minute}</time><span><strong>${escapeHtml(item[0])} · ${escapeHtml(item[1])}</strong><small>${escapeHtml(item[2])}</small></span></li>`);
    $("#operation-feed").scrollTop = $("#operation-feed").scrollHeight;
    state.loadingIndex += 1;
    const percent = Math.min(92, 7 + state.loadingIndex * 12);
    $("#loading-progress").style.width = `${percent}%`;
    $("#loading-percent").textContent = `${String(percent).padStart(2, "0")}%`;
  }

  async function generateCase() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sosoking-Client": "court-v3" },
        body: JSON.stringify({ incident: state.incident, severity: state.severity }),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.case) throw new Error(body.error || "사건기록 생성에 실패했습니다.");
      return body.case;
    } finally {
      clearTimeout(timeout);
    }
  }

  function resetState() {
    state.data = null;
    state.activeRoom = null;
    state.completed = new Set();
    state.discovered = [];
    state.choices = { disguise: "", evidence: new Set(), interrogation: {}, briefingTone: "", courtEvidence: "", verdictIndex: null };
    state.chaos = 1;
    missionPanel.classList.remove("open");
    missionPanel.innerHTML = `<div class="panel-empty"><div><strong>사건보드에서 장소를 선택하세요</strong><span>수사본부는 사용자가 움직이지 않으면 서류만 만듭니다.</span></div></div>`;
  }

  function completeRoom(room, clue, chaosDelta = 0) {
    state.completed.add(room);
    if (clue && !state.discovered.includes(clue)) state.discovered.push(clue);
    state.chaos = Math.max(1, Math.min(5, state.chaos + chaosDelta));
    renderBoardStatus();
    showToast(`${roomMeta[room].title} 임무 완료`);
  }

  function isLocked(room) {
    if (room === "briefing") return !["field", "surveillance", "forensics", "interrogation"].every((key) => state.completed.has(key));
    if (room === "court") return !state.completed.has("briefing");
    return false;
  }

  function renderBoard() {
    const d = state.data;
    $("#case-title").textContent = d.title;
    $("#case-number").textContent = state.caseNumber;
    $("#central-title").textContent = d.title;
    $("#central-summary").textContent = d.summary;
    $("#central-charge").textContent = d.charge;
    $("#central-grade").textContent = d.emergencyGrade;
    $("#central-scale").textContent = d.scale;
    $("#board-alert").textContent = `${d.operationName} · ${d.commandCenter}`;
    $("#new-case-button").hidden = false;
    $$(".room-node").forEach((button) => {
      const room = button.dataset.room;
      button.classList.toggle("locked", isLocked(room));
      button.classList.toggle("done", state.completed.has(room));
      button.classList.toggle("active", state.activeRoom === room);
      button.setAttribute("aria-disabled", isLocked(room) ? "true" : "false");
    });
    $$(".mobile-dock button").forEach((button) => {
      const room = button.dataset.room;
      button.classList.toggle("locked", isLocked(room));
      button.classList.toggle("active", state.activeRoom === room);
    });
    renderBoardStatus();
  }

  function renderBoardStatus() {
    const count = state.completed.size;
    $("#completion-count").textContent = `${count}/6`;
    $("#completion-bar").style.width = `${Math.round((count / 6) * 100)}%`;
    $$("#chaos-meter i").forEach((bar, index) => bar.classList.toggle("on", index < state.chaos));
    const clueStack = $("#clue-stack");
    clueStack.innerHTML = state.discovered.length
      ? state.discovered.slice(-5).reverse().map((clue, index) => `<div class="clue-pill${index === 0 ? " new" : ""}">${escapeHtml(clue)}</div>`).join("")
      : `<div class="clue-pill">아직 확보된 단서가 없습니다.</div>`;
    renderBoard();
  }

  function sheet(title, kicker, copy, body) {
    return `<button class="panel-close" type="button">사건보드로 돌아가기</button><section class="mission-sheet"><header class="sheet-header"><span class="sheet-kicker">${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></header><div class="sheet-body">${body}</div></section>`;
  }

  function renderField() {
    const d = state.data;
    const records = d.dispatchLog.map((item) => `<article class="record-card"><time>${escapeHtml(item.time)}</time><b>${escapeHtml(item.unit)} · ${escapeHtml(item.action)}</b><p>${escapeHtml(item.note)}</p></article>`).join("");
    missionPanel.innerHTML = sheet("초동 현장 봉쇄", "ROOM 01 · 현장", "통제선의 길이는 사건의 중요도와 무관합니다.", `<div class="record-list">${records}</div><div class="section-rule">투입 부서</div><div class="option-grid">${d.taskForceUnits.map((unit) => `<div class="choice-card"><b>${escapeHtml(unit)}</b><small>현재 본인들이 왜 투입됐는지 문서로 확인 중입니다.</small></div>`).join("")}</div><button class="mission-action${state.completed.has("field") ? " complete" : ""}" data-action="complete-field" type="button">${state.completed.has("field") ? "현장 통제 완료됨" : "통제선을 필요 이상으로 설치"}</button>`);
  }

  function surveillanceOptions() {
    const d = state.data.surveillance;
    return [
      { title: d.disguise, copy: "수사본부 추천안. 자연스러움은 보장하지 않습니다.", chaos: 1 },
      { title: "지나치게 큰 신문을 든 방문객", copy: "얼굴은 가려지지만 신문이 4년 전 것입니다.", chaos: 2 },
      { title: "화분 상태를 매분 확인하는 시설관리요원", copy: "식물과 눈이 마주치면 작전 실패로 간주합니다.", chaos: 1 }
    ];
  }

  function renderSurveillance() {
    const d = state.data.surveillance;
    const options = surveillanceOptions().map((item, index) => `<button class="choice-card${state.choices.disguise === item.title ? " selected" : ""}" type="button" data-disguise="${index}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.copy)}</small></button>`).join("");
    const reveal = state.choices.disguise ? `<div class="reveal-box"><b>잠복 결과</b><br>${escapeHtml(d.observation)}<br><br><b>예상 밖 성과</b><br>${escapeHtml(d.unexpected)}</div>` : "";
    missionPanel.innerHTML = sheet("잠복 위장 선택", "ROOM 02 · 잠복차량", `${d.location}에서 ${d.duration} 동안 아무렇지 않은 척해야 합니다.", `<div class="section-rule">위장 방식 선택</div><div class="option-grid">${options}</div>${reveal}<button class="mission-action${state.completed.has("surveillance") ? " complete" : ""}" data-action="complete-surveillance" type="button" ${state.choices.disguise ? "" : "disabled"}>${state.completed.has("surveillance") ? "잠복일지 제출 완료" : "선택한 위장으로 잠복 개시"}</button>`);
  }

  function renderForensics() {
    const d = state.data;
    const evidence = d.evidence.map((item, index) => `<label><input type="checkbox" data-evidence-index="${index}" ${state.choices.evidence.has(index) ? "checked" : ""}><span><b>${escapeHtml(item.label)} · ${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></span></label>`).join("");
    const reports = state.completed.has("forensics") ? `<div class="section-rule">국가과잉수사연구소 감식 결과</div><div class="record-list">${d.forensicReports.map((report) => `<article class="record-card"><time>${escapeHtml(report.method)}</time><b>${escapeHtml(report.sample)}</b><p>${escapeHtml(report.finding)}</p><div class="reveal-box"><b>쓸데없는 결론</b><br>${escapeHtml(report.unnecessaryConclusion)}</div></article>`).join("")}</div><div class="section-rule">압수수색 결과</div><div class="record-card"><b>${escapeHtml(d.search.warrant)}</b><p><strong>대상:</strong> ${escapeHtml(d.search.target)}<br><strong>압수품:</strong> ${escapeHtml(d.search.seizedItems.join(", "))}<br>${escapeHtml(d.search.officerNote)}</p></div>` : "";
    missionPanel.innerHTML = sheet("감식할 증거 선택", "ROOM 03 · 감식실", "증거 두 개를 골라야 장비 아홉 대를 켤 명분이 생깁니다.", `<div class="evidence-select">${evidence}</div><p class="form-error" id="forensic-help">${state.choices.evidence.size}/2개 선택</p><button class="mission-action${state.completed.has("forensics") ? " complete" : ""}" data-action="run-forensics" type="button" ${state.choices.evidence.size === 2 ? "" : "disabled"}>${state.completed.has("forensics") ? "감식 완료 · 보고서 열람 중" : "선택 증거를 정밀 감식 의뢰"}</button>${reports}`);
  }

  function renderInterrogation() {
    const questions = state.data.questions.map((item, index) => {
      const decision = state.choices.interrogation[index];
      return `<article class="record-card transcript"><div class="question">Q${index + 1}. ${escapeHtml(item.question)}</div><div class="answer"><b>${escapeHtml(item.response)}</b><br>${escapeHtml(item.replySpeaker)}: ${escapeHtml(item.reply)}</div><div class="judgement-toggle"><button type="button" data-question="${index}" data-judgement="suspicious" class="${decision === "suspicious" ? "selected" : ""}">수상함 표시</button><button type="button" data-question="${index}" data-judgement="understood" class="${decision === "understood" ? "selected" : ""}">일단 납득</button></div></article>`;
    }).join("");
    const judged = Object.keys(state.choices.interrogation).length;
    missionPanel.innerHTML = sheet("피의자 진술 판단", "ROOM 04 · 심문실", "정답은 없지만 수사본부는 모든 대답을 약간 수상하게 봅니다.", `<div class="record-list">${questions}</div><p class="form-error">${judged}/3개 진술 판단</p><button class="mission-action${state.completed.has("interrogation") ? " complete" : ""}" data-action="complete-interrogation" type="button" ${judged >= 2 ? "" : "disabled"}>${state.completed.has("interrogation") ? "심문조서 서명 완료" : "심문조서에 최종 의견 기록"}</button>`);
  }

  function renderBriefing() {
    if (isLocked("briefing")) {
      missionPanel.innerHTML = sheet("브리핑실 잠김", "ROOM 05 · 브리핑", "현장·잠복·감식·심문 기록이 모두 있어야 기자 앞에서 아는 척할 수 있습니다.", `<div class="lock-note">앞선 네 개 임무를 완료하세요.<br>마이크는 이미 일곱 개 설치되어 있습니다.</div>`);
      return;
    }
    const b = state.data.briefing;
    const tones = [
      ["초엄숙 발표", "사건 규모를 국가적 위기로 표현합니다."],
      ["책임회피 발표", "위원회와 추가 검토를 최대한 활용합니다."],
      ["쓸데없이 솔직한 발표", "사실 이 정도까지 할 일은 아니었다고 인정합니다."]
    ];
    missionPanel.innerHTML = sheet("공개 브리핑 방식 선택", "ROOM 05 · 브리핑", "국민은 없지만 국민적 관심을 전제로 발표합니다.", `<div class="briefing-box"><h3>${escapeHtml(b.headline)}</h3><p>${escapeHtml(b.statement)}</p><div class="press-question"><b>기자 질문</b><br>${escapeHtml(b.reporterQuestion)}<br><br><b>공식 답변</b><br>${escapeHtml(b.answer)}</div></div><div class="section-rule">발표 태도</div><div class="option-grid">${tones.map(([title, copy]) => `<button class="choice-card${state.choices.briefingTone === title ? " selected" : ""}" type="button" data-briefing-tone="${escapeHtml(title)}"><b>${escapeHtml(title)}</b><small>${escapeHtml(copy)}</small></button>`).join("")}</div><button class="mission-action${state.completed.has("briefing") ? " complete" : ""}" data-action="complete-briefing" type="button" ${state.choices.briefingTone ? "" : "disabled"}>${state.completed.has("briefing") ? "브리핑 종료 · 질문은 더 받지 않음" : "선택한 태도로 긴급 발표"}</button>`);
  }

  function renderCourt() {
    if (isLocked("court")) {
      missionPanel.innerHTML = sheet("법정 개정 대기", "ROOM 06 · 법정", "공개 브리핑까지 마쳐야 사건이 필요 이상으로 커졌다는 명분이 완성됩니다.", `<div class="lock-note">브리핑 임무를 먼저 완료하세요.<br>재판부는 이미 엄숙하게 앉아 있습니다.</div>`);
      return;
    }
    const d = state.data;
    const evidence = d.evidence.map((item, index) => `<button class="choice-card${state.choices.courtEvidence === item.title ? " selected" : ""}" type="button" data-court-evidence="${index}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.significance)}</small></button>`).join("");
    const verdicts = d.verdicts.map((item, index) => `<button class="verdict-card${state.choices.verdictIndex === index ? " selected" : ""}" type="button" data-verdict="${index}"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.sentence)}</p></button>`).join("");
    missionPanel.innerHTML = sheet("최종 증거와 형벌 선택", "ROOM 06 · 법정", "범인은 수사본부가 의심하고, 판결은 사용자가 책임집니다.", `<div class="briefing-box"><h3>검사 의견</h3><p>${escapeHtml(d.prosecution)}</p><h3>변호인 의견</h3><p>${escapeHtml(d.defense)}</p><div class="press-question"><b>재판부 중간 의견</b><br>${escapeHtml(d.judge)}</div></div><div class="section-rule">법정에 제출할 핵심 증거</div><div class="option-grid">${evidence}</div><div class="section-rule">최종 형벌</div><div class="verdict-grid">${verdicts}</div><button class="mission-action" data-action="finalize-verdict" type="button" ${state.choices.courtEvidence && Number.isInteger(state.choices.verdictIndex) ? "" : "disabled"}>판결봉을 쓸데없이 세게 내리치기</button>`);
  }

  function openRoom(room) {
    if (isLocked(room)) {
      state.activeRoom = room;
      room === "briefing" ? renderBriefing() : renderCourt();
    } else {
      state.activeRoom = room;
      ({ field: renderField, surveillance: renderSurveillance, forensics: renderForensics, interrogation: renderInterrogation, briefing: renderBriefing, court: renderCourt })[room]();
    }
    missionPanel.classList.add("open");
    renderBoard();
    missionPanel.scrollTop = 0;
  }

  function finalizeVerdict() {
    completeRoom("court", `법정 핵심 증거: ${state.choices.courtEvidence}`, 1);
    const d = state.data;
    const verdict = d.verdicts[state.choices.verdictIndex];
    const suspiciousCount = Object.values(state.choices.interrogation).filter((value) => value === "suspicious").length;
    const judgeIndex = Math.min(2, Math.floor((state.chaos + suspiciousCount) / 3));
    $("#result-case-number").textContent = state.caseNumber;
    $("#result-title").textContent = verdict.title;
    $("#result-sentence").textContent = verdict.sentence;
    $("#result-afterstory").textContent = verdict.afterStory;
    $("#result-judge-type").textContent = d.judgeTypes[judgeIndex] || d.judgeTypes[0];
    $("#result-evidence").textContent = state.choices.courtEvidence;
    $("#result-disguise").textContent = state.choices.disguise;
    $("#result-tone").textContent = state.choices.briefingTone;
    showScreen("result");
  }

  async function shareResult() {
    const verdict = state.data.verdicts[state.choices.verdictIndex];
    const text = `소문난 판결소 판결\n${verdict.title}\n${verdict.sentence}\n사건번호 ${state.caseNumber}`;
    try {
      if (navigator.share) await navigator.share({ title: "소문난 판결소", text });
      else await navigator.clipboard.writeText(text);
      $("#share-status").textContent = navigator.share ? "공유 창을 열었습니다." : "판결문을 복사했습니다.";
    } catch (error) {
      if (error?.name !== "AbortError") $("#share-status").textContent = "공유하지 못했습니다.";
    }
  }

  function newCase() {
    clearInterval(state.loadingTimer);
    resetState();
    incidentInput.value = "";
    charCount.textContent = "0";
    formError.textContent = "";
    $("#new-case-button").hidden = true;
    showScreen("intake");
    incidentInput.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const incident = incidentInput.value.replace(/\s+/g, " ").trim();
    const error = validateIncident(incident);
    formError.textContent = error;
    if (error) return;
    resetState();
    state.incident = incident;
    state.severity = new FormData(form).get("severity") || "official";
    state.caseNumber = caseNumber();
    startLoading();
    try {
      state.data = await generateCase();
    } catch (errorValue) {
      console.warn("V4 case generation fallback", errorValue);
      state.data = { ...demoCase, summary: `${incident} 수사본부는 이 일을 단순한 일상 문제가 아닌 생활질서 중대 교란으로 확대 해석했다.` };
      showToast("AI 수사본부가 늦어 예비 판례로 훈련 사건을 열었습니다.");
    }
    clearInterval(state.loadingTimer);
    $("#loading-progress").style.width = "100%";
    $("#loading-percent").textContent = "100%";
    setTimeout(() => {
      showScreen("board");
      renderBoard();
    }, 450);
  });

  incidentInput.addEventListener("input", () => {
    charCount.textContent = String(incidentInput.value.length);
    if (formError.textContent) formError.textContent = "";
  });

  $$("[data-example]").forEach((button) => button.addEventListener("click", () => {
    incidentInput.value = button.dataset.example;
    incidentInput.dispatchEvent(new Event("input"));
    incidentInput.focus();
  }));

  document.addEventListener("click", (event) => {
    const roomButton = event.target.closest("[data-room]");
    if (roomButton) {
      openRoom(roomButton.dataset.room);
      return;
    }
    if (event.target.closest(".panel-close")) {
      missionPanel.classList.remove("open");
      return;
    }
    const disguise = event.target.closest("[data-disguise]");
    if (disguise) {
      const item = surveillanceOptions()[Number(disguise.dataset.disguise)];
      state.choices.disguise = item.title;
      state.chaos = Math.min(5, state.chaos + (item.chaos > 1 ? 1 : 0));
      renderSurveillance();
      return;
    }
    const question = event.target.closest("[data-question][data-judgement]");
    if (question) {
      state.choices.interrogation[question.dataset.question] = question.dataset.judgement;
      renderInterrogation();
      return;
    }
    const tone = event.target.closest("[data-briefing-tone]");
    if (tone) {
      state.choices.briefingTone = tone.dataset.briefingTone;
      renderBriefing();
      return;
    }
    const courtEvidence = event.target.closest("[data-court-evidence]");
    if (courtEvidence) {
      state.choices.courtEvidence = state.data.evidence[Number(courtEvidence.dataset.courtEvidence)].title;
      renderCourt();
      return;
    }
    const verdict = event.target.closest("[data-verdict]");
    if (verdict) {
      state.choices.verdictIndex = Number(verdict.dataset.verdict);
      renderCourt();
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "complete-field") {
      completeRoom("field", `현장 핵심: ${state.data.dispatchLog.at(-1)?.action || "초동기록 확보"}`);
      renderField();
    } else if (action === "complete-surveillance") {
      completeRoom("surveillance", `잠복 위장: ${state.choices.disguise}`, 1);
      renderSurveillance();
    } else if (action === "run-forensics") {
      completeRoom("forensics", `감식 의뢰 증거 ${[...state.choices.evidence].map((index) => state.data.evidence[index].label).join("·")}`, 1);
      renderForensics();
    } else if (action === "complete-interrogation") {
      const suspicious = Object.values(state.choices.interrogation).filter((value) => value === "suspicious").length;
      completeRoom("interrogation", `수상한 진술 ${suspicious}건 표시`, suspicious > 1 ? 1 : 0);
      renderInterrogation();
    } else if (action === "complete-briefing") {
      completeRoom("briefing", `브리핑 태도: ${state.choices.briefingTone}`, state.choices.briefingTone === "초엄숙 발표" ? 1 : 0);
      renderBriefing();
    } else if (action === "finalize-verdict") finalizeVerdict();
  });

  missionPanel.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-evidence-index]");
    if (!checkbox) return;
    const index = Number(checkbox.dataset.evidenceIndex);
    if (checkbox.checked && state.choices.evidence.size >= 2) {
      checkbox.checked = false;
      showToast("감식 장비 예산상 증거는 두 개만 선택합니다.");
      return;
    }
    checkbox.checked ? state.choices.evidence.add(index) : state.choices.evidence.delete(index);
    renderForensics();
  });

  $("#new-case-button").addEventListener("click", newCase);
  $("#result-new-case").addEventListener("click", newCase);
  $("#share-result").addEventListener("click", shareResult);

  resetState();
  showScreen("intake");
})();
