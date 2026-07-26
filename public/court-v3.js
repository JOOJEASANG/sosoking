(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $("#case-form");
  const incidentInput = $("#incident");
  const charCount = $("#char-count");
  const formError = $("#form-error");
  const investigation = $("#investigation");
  const stageNav = $("#stage-nav");
  const stageContent = $("#stage-content");
  const caseNumber = $("#case-number");
  const operationName = $("#operation-name");
  const nextButton = $("#next-button");
  const backButton = $("#back-button");
  const restartButton = $("#restart-button");
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!form || !incidentInput || !investigation || !stageNav || !stageContent || !nextButton || !backButton || !restartButton || !submitButton) return;

  const STAGES = [
    ["접수", "사건 접수", "file"],
    ["출동", "초동 출동", "dispatch"],
    ["잠복", "잠복 수사", "binoculars"],
    ["감식", "과잉 감식", "flask"],
    ["심문", "피의자 신문", "question"],
    ["브리핑", "공개 브리핑", "mic"],
    ["판결", "최종 판결", "gavel"]
  ];
  const blocked = [
    "폭행", "폭력", "성폭력", "성추행", "성희롱", "강간", "학대", "자살", "자해", "살인", "납치", "유괴",
    "스토킹", "협박", "학교폭력", "가정폭력", "아동학대", "사망", "흉기", "마약", "응급실", "교통사고",
    "뺑소니", "음주운전", "성범죄", "불륜", "외도", "바람폈", "임신", "낙태"
  ];
  const privatePatterns = [
    /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/,
    /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
    /https?:\/\/|www\./i,
    /\b\d{6}[ -]?[1-4]\d{6}\b/,
    /\b(?:\d[ -]?){13,19}\b/,
    /\b\d{2,3}[가-힣]\d{4}\b/,
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,20}(로|길|동)\s*\d+/
  ];
  const severityLabels = { official: "정식 수사", special: "특별 수사", national: "국가급 대응" };
  const state = { stage: 0, data: null, question: 0, verdict: null, confirmed: false, sharing: false };
  const originalSubmit = submitButton.innerHTML;

  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function clean(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function hash(value) {
    let result = 0;
    for (let i = 0; i < value.length; i += 1) result = ((result << 5) - result + value.charCodeAt(i)) | 0;
    return Math.abs(result);
  }

  function validate(value) {
    if (value.length < 7) return "조금만 더 자세히 적어주세요. 최소 7자는 필요합니다.";
    if (blocked.some((term) => value.includes(term))) return "실제 심각한 피해나 범죄는 코미디 수사로 만들지 않습니다.";
    if (privatePatterns.some((pattern) => pattern.test(value))) return "전화번호·이메일·주소·차량번호 등 개인정보를 지워주세요.";
    return "";
  }

  function fallbackCase(incident, level) {
    const subject = /과자|치킨|아이스크림|커피|푸딩|빵|라면|콜라|먹|간식/.test(incident)
      ? "개인 식량 자산"
      : /늦|지각|약속|기다/.test(incident)
        ? "약속 시각"
        : /충전기|리모컨|케이블|이어폰|마우스|키보드/.test(incident)
          ? "생활 필수장비"
          : "일상질서";
    return {
      title: `${subject} 관련 경미 행위의 전국급 과잉수사 사건`,
      subtitle: "직접 피해보다 투입된 보고서 분량이 더 큰 사건",
      charge: "사소행위 확대 및 관계 평온 교란",
      summary: "제보 내용은 간단했지만 상황실은 즉시 대형 화이트보드를 설치했다.",
      damages: "직접 피해 소량, 억울함 중간, 설명 시간 과다",
      commandCenter: level === "national" ? "범일상질서 국가비상대책본부" : "소문동 생활질서 특별수사본부",
      operationName: `작전명 ‘${subject} 최종회수’`,
      emergencyGrade: level === "official" ? "관심보다 조금 높은 주의" : level === "special" ? "필요 이상 경계" : "아무도 요청하지 않은 심각",
      scale: "수사관 18명, 상황판 3개, 간식 2상자가 투입됐다.",
      impact: "주변인은 처음엔 관심이 없었으나 현재 각자 책임비율을 계산 중이다.",
      taskForceUnits: ["초동출동 1팀", "잠복관찰 2팀", "국가과잉수사연구소", "공개브리핑 지원반"],
      dispatchLog: [
        { time: "09:01", unit: "112가 아닌 생활질서 신고실", action: "제보 접수", note: "상담원은 별일 아니라고 판단했으나 보고서 양식이 이미 열렸다." },
        { time: "09:04", unit: "초동출동 1팀", action: "현장 반경 80cm 통제", note: "통제선이 너무 길어 복도까지 막혔다." },
        { time: "09:11", unit: "현장기록반", action: "사진 47장 촬영", note: "그중 31장은 초점이 맞지 않았으나 모두 증거번호를 받았다." },
        { time: "09:19", unit: "특수본 상황실", action: "전국 유사사례 검색", note: "비슷한 일은 흔했지만 일단 연관성을 배제하지 않았다." }
      ],
      surveillance: {
        location: "사건 현장과 가장 가까운 소파 뒤편",
        duration: "2시간 17분, 실제 관찰 11분",
        disguise: "배달을 기다리는 사람처럼 휴대전화를 계속 확인하는 위장",
        observation: "피고가 현장을 세 번 지나갔으나 두 번은 물을 마시러 간 것이었다.",
        unexpected: "잠복팀은 범행 대신 냉장고 문이 8초 열려 있는 별도 사건을 발견했다."
      },
      forensicReports: [
        { sample: "현장 부스러기", method: "고배율 확대와 지나친 진지함", finding: "사건 전후 위치가 3.2cm 달라졌다.", unnecessaryConclusion: "부스러기는 바삭했을 가능성이 높다." },
        { sample: "빈 포장지 또는 관련 물품", method: "지문이 있을 법한 곳을 모두 닦지 않고 관찰", finding: "접촉 흔적이 있었으나 가족 모두가 평소 만지는 물건이었다.", unnecessaryConclusion: "포장지는 쓰레기통 방향을 알고 있었다." },
        { sample: "현장 공기", method: "냄새 기억 감정법", finding: "누군가 최근까지 이곳에 있었던 정황이 확인됐다.", unnecessaryConclusion: "현장 공기는 대체로 실내 공기였다." }
      ],
      search: {
        warrant: "생활질서 임의제출 권고서 겸 거의 영장",
        target: "피고 주변 1.5m와 자주 쓰는 서랍",
        seizedItems: ["용도 불명의 집게 1개", "관련성이 낮은 영수증 2장", "사건과 무관한 충전 케이블 1개"],
        officerNote: "결정적 증거는 없었지만 압수봉투는 모두 사용했다."
      },
      evidence: [
        { label: "증거 제1호", title: "당사자 진술", detail: "양측 모두 별일 아니라고 말하면서 설명은 20분째 이어졌다.", significance: "사건이 하찮다는 사실을 양측이 공동 인정했다." },
        { label: "증거 제2호", title: "현장 위치 변화", detail: "사건 전후 물건 위치가 미세하게 달라졌다는 주장이 제기됐다.", significance: "미세하지만 제보자에게는 역사적 변화로 기록됐다." },
        { label: "증거 제3호", title: "피고의 장문 해명", detail: "사과보다 해명이 네 배 길었고 접속사도 일곱 번 사용됐다.", significance: "행위보다 해명이 사건을 더 크게 만들었다." },
        { label: "증거 제4호", title: "주변인 단체대화방", detail: "관심 없던 주변인들이 현재 유죄 비율 투표를 진행 중이다.", significance: "소문 확산의 직접적 원인은 수사본부일 가능성이 있다." }
      ],
      questions: [
        { question: "왜 이런 행동을 했습니까?", speaker: "피고", response: "당시에는 이 정도로 커질 줄 몰랐습니다.", replySpeaker: "신문관", reply: "모든 대형 사건은 대체로 그 문장으로 시작합니다." },
        { question: "즉시 사과했습니까?", speaker: "피고", response: "사과 전에 사정을 설명했습니다.", replySpeaker: "검사", reply: "설명이 사과보다 412자 길었다는 기록이 있습니다." },
        { question: "같은 상황이면 어떻게 하겠습니까?", speaker: "피고", response: "조금 덜 들키게 하겠습니다.", replySpeaker: "재판장", reply: "반성의 방향이 수사기법 쪽으로 향하고 있습니다." }
      ],
      briefing: {
        headline: "생활질서 특수본, 사소한 사건에 18명 투입 사실 공식 확인",
        spokesperson: "특수본 생활브리핑 대변인",
        statement: "현재 모든 가능성을 열어두고 닫을 가능성도 검토 중입니다.",
        reporterQuestion: "이 정도 일에 브리핑룸까지 필요한가요?",
        answer: "필요성에 대한 질문은 별도 필요성 검토위원회가 검토할 예정입니다."
      },
      prosecution: "피고는 사소한 행동 뒤 즉시 사과하지 않고 장문의 해명을 추가해 사건을 스스로 전국급으로 확대했습니다.",
      defense: "직접 피해는 미미하며 사건을 여기까지 키운 수사본부와 제보자에게도 상당한 과장 책임이 있습니다.",
      judge: "행위보다 해명, 수사, 브리핑이 더 큰 피해를 만들었다는 점에서 모두가 조금씩 유죄입니다.",
      verdicts: [
        { title: "피고 전부 유죄", sentence: "정식 사과 1회와 같은 행동 7일 금지", afterStory: "사과문이 너무 진지해 피해자가 부담을 느끼고 사과문 축약 소송을 제기했다." },
        { title: "쌍방 과장 책임", sentence: "간식 하나를 정확히 절반으로 나누며 사건 종결", afterStory: "절반의 기준을 두고 자와 전자저울이 동원되면서 재수사가 시작됐다." },
        { title: "수사본부만 유죄", sentence: "사건을 다른 사람에게 더 말하지 않기", afterStory: "판결 직후 수사본부가 성과보고회를 열어 사건이 다시 전국에 알려졌다." }
      ],
      judgeTypes: ["사과문 분량까지 판결하는 문서집착형 재판관", "양쪽을 모두 조금씩 벌주는 균형과잉형 재판관", "범인보다 수사기관을 의심하는 절차감시형 재판관"]
    };
  }

  function objectArray(raw, key, fields, count, fallback) {
    if (!Array.isArray(raw?.[key]) || raw[key].length < count) return fallback;
    return raw[key].slice(0, count).map((item, index) => {
      const normalized = {};
      fields.forEach((field) => { normalized[field] = clean(item?.[field], fallback[index][field]); });
      return normalized;
    });
  }

  function normalize(raw, fallback) {
    const data = {};
    ["title", "subtitle", "charge", "summary", "damages", "commandCenter", "operationName", "emergencyGrade", "scale", "impact", "prosecution", "defense", "judge"].forEach((key) => {
      data[key] = clean(raw?.[key], fallback[key]);
    });
    data.taskForceUnits = Array.isArray(raw?.taskForceUnits) && raw.taskForceUnits.length >= 4 ? raw.taskForceUnits.slice(0, 4).map((item, i) => clean(item, fallback.taskForceUnits[i])) : fallback.taskForceUnits;
    data.dispatchLog = objectArray(raw, "dispatchLog", ["time", "unit", "action", "note"], 4, fallback.dispatchLog);
    data.forensicReports = objectArray(raw, "forensicReports", ["sample", "method", "finding", "unnecessaryConclusion"], 3, fallback.forensicReports);
    data.evidence = objectArray(raw, "evidence", ["label", "title", "detail", "significance"], 4, fallback.evidence);
    data.questions = objectArray(raw, "questions", ["question", "speaker", "response", "replySpeaker", "reply"], 3, fallback.questions);
    data.verdicts = objectArray(raw, "verdicts", ["title", "sentence", "afterStory"], 3, fallback.verdicts);
    data.judgeTypes = Array.isArray(raw?.judgeTypes) && raw.judgeTypes.length >= 3 ? raw.judgeTypes.slice(0, 3).map((item, i) => clean(item, fallback.judgeTypes[i])) : fallback.judgeTypes;
    const normalizeObject = (key, fields) => {
      data[key] = {};
      fields.forEach((field) => { data[key][field] = clean(raw?.[key]?.[field], fallback[key][field]); });
    };
    normalizeObject("surveillance", ["location", "duration", "disguise", "observation", "unexpected"]);
    normalizeObject("briefing", ["headline", "spokesperson", "statement", "reporterQuestion", "answer"]);
    data.search = {
      warrant: clean(raw?.search?.warrant, fallback.search.warrant),
      target: clean(raw?.search?.target, fallback.search.target),
      seizedItems: Array.isArray(raw?.search?.seizedItems) && raw.search.seizedItems.length ? raw.search.seizedItems.slice(0, 3).map((item, i) => clean(item, fallback.search.seizedItems[i] || "관련성 불명 물품")) : fallback.search.seizedItems,
      officerNote: clean(raw?.search?.officerNote, fallback.search.officerNote)
    };
    return data;
  }

  async function fetchCase(incident, level) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 52000);
    try {
      const response = await fetch("/api/generate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sosoking-Client": "court-v3" },
        body: JSON.stringify({ incident, severity: level }),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.case) throw new Error(body.error || `응답 오류 ${response.status}`);
      return body.case;
    } finally {
      clearTimeout(timer);
    }
  }

  function setLoading(active) {
    form.setAttribute("aria-busy", String(active));
    incidentInput.disabled = active;
    $$('input[name="severity"], [data-example]', form).forEach((element) => { element.disabled = active; });
    submitButton.disabled = active;
    submitButton.innerHTML = active
      ? '<span>특수본 편성 중…</span><b>잠복팀 위장복 고르는 중</b>'
      : originalSubmit;
    formError.textContent = active ? "초동출동, 잠복계획, 감식의뢰서와 브리핑 문답을 작성하고 있습니다." : "";
  }

  function makeData(incident, level, profile, source, reason = "") {
    return {
      incident, level, profile, source, reason,
      openedAt: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date()),
      number: `${new Date().getFullYear()}-소수-${(hash(incident + profile.title) % 9000) + 1000}`
    };
  }

  function stageHeader(kicker, title, summary, stamp) {
    return `<header class="stage-header"><div><p class="stage-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2><p class="stage-summary">${esc(summary)}</p></div><div class="document-stamp" aria-hidden="true">${esc(stamp)}</div></header>`;
  }

  function renderOpening() {
    const { profile: p, incident, openedAt, source, reason } = state.data;
    stageContent.innerHTML = `${stageHeader("CASE FILE 01 · 긴급 사건 접수", "사건은 사소했지만 수사본부는 이미 커졌습니다.", p.summary, "사건 개시")}
      <section class="case-title-card"><h3>${esc(p.title)}</h3><p>${esc(p.subtitle)}</p><blockquote>“${esc(incident)}”<br><small>${esc(openedAt)} 제보 접수</small></blockquote></section>
      <div class="data-grid">
        <article class="data-card"><small>적용 혐의</small><strong>${esc(p.charge)}</strong><p>실제 법률과 관계없는 생활질서 자체 혐의입니다.</p></article>
        <article class="data-card"><small>가상 피해 규모</small><strong>${esc(p.damages)}</strong><p>${esc(p.impact)}</p></article>
        <article class="data-card"><small>지휘 본부</small><strong>${esc(p.commandCenter)}</strong><p>${esc(p.scale)}</p></article>
      </div>
      <div class="unit-grid">${p.taskForceUnits.map((unit) => `<span class="unit-chip">${esc(unit)}</span>`).join("")}</div>
      <p class="source-note">${source === "ai" ? "Gemini가 입력 내용을 바탕으로 방금 작성한 가상 사건기록입니다." : `AI 연결이 불안정해 예비 판례를 적용했습니다. ${esc(reason)}`}</p>`;
  }

  function renderDispatch() {
    const p = state.data.profile;
    stageContent.innerHTML = `${stageHeader("OPERATION LOG 02 · 초동 출동", "현장 반경 80cm가 즉시 통제됐습니다.", "신고 접수 3분 만에 생활질서 특수본이 움직였다. 출동 규모는 사건의 필요성과 무관하게 결정됐다.", "초동 완료")}
      <div class="timeline">${p.dispatchLog.map((item) => `<article class="timeline-item"><time class="timeline-time">${esc(item.time)}</time><div class="timeline-body"><b>${esc(item.unit)}</b><strong>${esc(item.action)}</strong><p>${esc(item.note)}</p></div></article>`).join("")}</div>`;
  }

  function renderSurveillance() {
    const p = state.data.profile;
    const s = p.surveillance;
    stageContent.innerHTML = `${stageHeader("SURVEILLANCE 03 · 잠복 수사", "범인은 모르겠고 잠복팀은 배가 고팠습니다.", "수사팀은 현장과 지나치게 가까운 장소에서 장시간 잠복했다. 위장은 자연스러웠지만 아무도 수상하게 여기지 않았다.", "잠복 해제")}
      <section class="operation-card"><p class="stage-kicker">${esc(p.operationName)}</p><h3>잠복근무 결과보고서</h3><div class="operation-card-grid"><div><small>잠복 위치</small><strong>${esc(s.location)}</strong></div><div><small>작전 시간</small><strong>${esc(s.duration)}</strong></div><div><small>위장 방법</small><strong>${esc(s.disguise)}</strong></div><div><small>긴급 등급</small><strong>${esc(p.emergencyGrade)}</strong></div></div><div class="surveillance-note"><b>관찰 내용</b><br>${esc(s.observation)}<br><br><b>예상 밖 성과</b><br>${esc(s.unexpected)}</div></section>`;
  }

  function renderForensics() {
    const p = state.data.profile;
    stageContent.innerHTML = `${stageHeader("FORENSICS 04 · 과잉 감식", "가상 국과수는 사건과 관계없는 사실까지 밝혀냈습니다.", "국가과잉수사연구소는 미세 흔적과 현장 공기를 감정했다. 결론의 절반은 쓸모없지만 보고서는 매우 두꺼웠다.", "감정서 채택")}
      <div class="forensic-grid">${p.forensicReports.map((report, i) => `<article class="forensic-card"><small>감식 ${String(i + 1).padStart(2, "0")}</small><h3>${esc(report.sample)}</h3><div class="forensic-row"><b>감식 방법</b><p>${esc(report.method)}</p></div><div class="forensic-row"><b>주요 결과</b><p>${esc(report.finding)}</p></div><div class="forensic-row"><b>쓸데없는 결론</b><p class="unnecessary">${esc(report.unnecessaryConclusion)}</p></div></article>`).join("")}</div>
      <section class="search-card"><div><p class="stage-kicker">압수수색 기록</p><h3>${esc(p.search.warrant)}</h3><p>${esc(p.search.target)}</p><div class="seized-list">${p.search.seizedItems.map((item) => `<span>${esc(item)}</span>`).join("")}</div></div><div><p class="stage-kicker">현장요원 메모</p><blockquote>“${esc(p.search.officerNote)}”</blockquote><p>아래 증거봉투를 눌러 결정적이지 않은 의미를 확인하세요.</p></div></section>
      <div class="evidence-grid">${p.evidence.map((item, i) => `<button type="button" class="evidence-envelope" data-evidence="${i}"><small>${esc(item.label)}</small><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><p class="significance">수사본부 해석: ${esc(item.significance)}</p><span class="open-hint">봉투 열기</span></button>`).join("")}</div>`;
    $$('[data-evidence]', stageContent).forEach((button) => button.addEventListener("click", () => {
      button.classList.toggle("is-open");
      const hint = $(".open-hint", button);
      if (hint) hint.textContent = button.classList.contains("is-open") ? "봉투 닫기" : "봉투 열기";
    }));
  }

  function renderInterrogation() {
    const p = state.data.profile;
    const q = p.questions[state.question];
    stageContent.innerHTML = `${stageHeader("INTERROGATION 05 · 피의자 신문", "피고는 설명할수록 새로운 혐의를 만들었습니다.", "신문실 녹화가 시작되자 피고는 침착하게 해명했지만, 재판부는 해명의 길이를 별도 증거로 채택했다.", "신문 진행")}
      <div class="question-tabs">${p.questions.map((item, i) => `<button type="button" class="${i === state.question ? "is-active" : ""}" data-question="${i}">신문 ${i + 1}<br>${esc(item.question)}</button>`).join("")}</div>
      <section class="interrogation-room"><div class="dialogue"><div class="speech"><b>신문관</b><p>${esc(q.question)}</p></div><div class="speech is-right"><b>${esc(q.speaker)}</b><p>${esc(q.response)}</p></div><div class="speech"><b>${esc(q.replySpeaker)}</b><p>${esc(q.reply)}</p></div></div></section>`;
    $$('[data-question]', stageContent).forEach((button) => button.addEventListener("click", () => {
      state.question = Number(button.dataset.question);
      renderInterrogation();
    }));
  }

  function renderBriefing() {
    const p = state.data.profile;
    const b = p.briefing;
    stageContent.innerHTML = `${stageHeader("PRESS & COURT 06 · 공개 브리핑", "마이크 7개가 사건보다 먼저 도착했습니다.", "특수본은 수사성과를 발표했고 기자들은 왜 브리핑을 하는지부터 질문했다. 이어진 법정에서는 양측이 모두 조금씩 맞는 억지를 펼쳤다.", "브리핑 종료")}
      <section class="briefing-board"><span class="breaking">긴급속보</span><h3>${esc(b.headline)}</h3><blockquote><b>${esc(b.spokesperson)}</b><br>${esc(b.statement)}</blockquote><div class="press-qa"><article><b>기자 질문</b><p>${esc(b.reporterQuestion)}</p></article><article><b>공식 답변</b><p>${esc(b.answer)}</p></article></div></section>
      <div class="court-columns"><article class="court-card prosecution"><small>검사 측 최종 의견</small><blockquote>“${esc(p.prosecution)}”</blockquote></article><article class="court-card defense"><small>변호인 측 최종 의견</small><blockquote>“${esc(p.defense)}”</blockquote></article></div>
      <div class="judge-opinion"><b>재판장 중간 의견</b><br>“${esc(p.judge)}”</div>`;
  }

  function sharePanel() {
    return `<div class="share-actions"><button type="button" class="save" data-share="save">판결문 이미지 저장</button><button type="button" class="share" data-share="share">판결 공유</button></div><p class="share-status" role="status" aria-live="polite"></p>`;
  }

  function renderVerdict() {
    const p = state.data.profile;
    const selected = state.verdict === null ? null : p.verdicts[state.verdict];
    const result = state.confirmed && selected
      ? `<section class="result-document"><h3>주문: ${esc(selected.title)}</h3><p>피고 및 관련 당사자에게 <strong>${esc(selected.sentence)}</strong>을 명한다.</p><div class="after-story"><b>판결 집행 후 긴급 속보</b><br>${esc(selected.afterStory)}</div><p><b>당신의 재판관 성향</b><br>${esc(p.judgeTypes[state.verdict])}</p>${sharePanel()}</section>`
      : `<div class="judge-opinion"><b>재판장 안내</b><br>가장 속이 시원한 판결보다 가장 웃긴 판결을 선택해도 됩니다. 본 법정은 결과보다 후일담을 중시합니다.</div>`;
    stageContent.innerHTML = `${stageHeader("FINAL VERDICT 07 · 최종 판결", state.confirmed ? "판결은 끝났지만 후속 사건은 시작됐습니다." : "사건 규모에 비해 지나치게 정교한 판결을 선택하세요.", "수사관 18명, 감식보고서 3건, 잠복 2시간을 종합한 결과 이제 사용자에게 모든 책임이 넘어왔습니다.", "최종 선고")}
      <div class="verdict-grid">${p.verdicts.map((item, i) => `<button type="button" class="verdict-card ${state.verdict === i ? "is-selected" : ""}" data-verdict="${i}" ${state.confirmed ? "disabled" : ""}><strong>${esc(item.title)}</strong><p>${esc(item.sentence)}</p></button>`).join("")}</div>${result}`;
    if (!state.confirmed) {
      $$('[data-verdict]', stageContent).forEach((button) => button.addEventListener("click", () => {
        state.verdict = Number(button.dataset.verdict);
        renderVerdict();
        updateActions();
      }));
    } else {
      $$('[data-share]', stageContent).forEach((button) => button.addEventListener("click", () => handleShare(button.dataset.share)));
    }
  }

  const renderers = [renderOpening, renderDispatch, renderSurveillance, renderForensics, renderInterrogation, renderBriefing, renderVerdict];

  function renderNav() {
    stageNav.innerHTML = STAGES.map(([short, label, icon], i) => `<li class="${i === state.stage ? "is-active" : i < state.stage ? "is-done" : ""}"><span><svg aria-hidden="true"><use href="./investigation-icons.svg#${icon}"></use></svg></span>${esc(label)}</li>`).join("");
  }

  function updateActions() {
    const labels = ["초동 출동 개시 →", "잠복 수사 투입 →", "가상 국과수 의뢰 →", "피의자 신문 시작 →", "공개 브리핑 개최 →", "최종 판결로 이동 →", state.confirmed ? "새 사건 접수하기" : "이 판결 확정하기"];
    nextButton.textContent = labels[state.stage];
    nextButton.disabled = state.stage === 6 && state.verdict === null;
    backButton.hidden = state.stage === 0 || state.confirmed;
  }

  function render() {
    renderNav();
    renderers[state.stage]();
    updateActions();
  }

  function reset() {
    Object.assign(state, { stage: 0, data: null, question: 0, verdict: null, confirmed: false, sharing: false });
    investigation.hidden = true;
    form.reset();
    charCount.textContent = "0";
    formError.textContent = "";
    incidentInput.disabled = false;
    submitButton.disabled = false;
    incidentInput.focus();
    $(".intake")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지 생성 실패")), "image/png", .95));
  }

  function wrap(ctx, text, maxWidth, maxLines) {
    const chars = [...String(text)];
    const lines = [];
    let line = "";
    for (const char of chars) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) break;
      } else line = next;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.join("").length < chars.length && lines.length) lines[lines.length - 1] = `${lines.at(-1).slice(0, -1)}…`;
    return lines;
  }

  async function createShareCard() {
    const p = state.data.profile;
    const v = p.verdicts[state.verdict];
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 기능을 사용할 수 없습니다.");
    ctx.fillStyle = "#08111f"; ctx.fillRect(0, 0, 1080, 1500);
    ctx.fillStyle = "#f1eadc"; ctx.fillRect(54, 54, 972, 1392);
    ctx.fillStyle = "#e34a3f"; ctx.fillRect(54, 54, 972, 20);
    ctx.fillStyle = "#111827"; ctx.textAlign = "center"; ctx.font = '900 54px Georgia, "Noto Serif KR", serif'; ctx.fillText("소문난 판결소", 540, 150);
    ctx.fillStyle = "#9e251f"; ctx.font = '900 22px "Noto Sans KR", sans-serif'; ctx.fillText("생활질서 특수본 최종 판결문", 540, 198);
    ctx.textAlign = "left"; ctx.fillStyle = "#111827"; ctx.font = '900 50px Georgia, "Noto Serif KR", serif';
    let y = 300;
    for (const line of wrap(ctx, p.title, 850, 4)) { ctx.fillText(line, 115, y); y += 66; }
    y += 20; ctx.strokeStyle = "#e34a3f"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(115, y); ctx.lineTo(965, y); ctx.stroke(); y += 70;
    ctx.fillStyle = "#9e251f"; ctx.font = '900 25px "Noto Sans KR", sans-serif'; ctx.fillText("주문", 115, y); y += 55;
    ctx.fillStyle = "#111827"; ctx.font = '900 46px Georgia, "Noto Serif KR", serif';
    for (const line of wrap(ctx, v.title, 850, 3)) { ctx.fillText(line, 115, y); y += 60; }
    y += 22; ctx.fillStyle = "#465163"; ctx.font = '700 30px "Noto Sans KR", sans-serif';
    for (const line of wrap(ctx, v.sentence, 850, 5)) { ctx.fillText(line, 115, y); y += 46; }
    y += 40; ctx.fillStyle = "#101c2d"; ctx.fillRect(95, y, 890, 230); ctx.fillStyle = "#f5c94a"; ctx.font = '900 22px "Noto Sans KR", sans-serif'; ctx.fillText("판결 집행 후 긴급 속보", 130, y + 50); ctx.fillStyle = "#ffffff"; ctx.font = '600 27px "Noto Sans KR", sans-serif';
    let sy = y + 100; for (const line of wrap(ctx, v.afterStory, 820, 4)) { ctx.fillText(line, 130, sy); sy += 40; }
    y += 285; ctx.fillStyle = "#9e251f"; ctx.font = '900 22px "Noto Sans KR", sans-serif'; ctx.fillText("재판관 성향", 115, y); y += 48; ctx.fillStyle = "#465163"; ctx.font = '600 27px "Noto Sans KR", sans-serif'; for (const line of wrap(ctx, p.judgeTypes[state.verdict], 850, 4)) { ctx.fillText(line, 115, y); y += 40; }
    ctx.fillStyle = "#08111f"; ctx.fillRect(54, 1320, 972, 126); ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = '900 25px "Noto Sans KR", sans-serif'; ctx.fillText("별일 아니어도 끝까지 파헤칩니다.", 540, 1370); ctx.fillStyle = "#f5c94a"; ctx.font = '700 21px "Noto Sans KR", sans-serif'; ctx.fillText("sosoking.co.kr · 오락용 가상 판결", 540, 1410);
    return canvasBlob(canvas);
  }

  function shareStatus(message, error = false) {
    const element = $(".share-status", stageContent);
    if (!element) return;
    element.textContent = message;
    element.style.color = error ? "#9e251f" : "#465163";
  }

  async function handleShare(action) {
    if (state.sharing) return;
    state.sharing = true;
    shareStatus("판결문을 봉인하고 있습니다.");
    $$('[data-share]', stageContent).forEach((button) => { button.disabled = true; });
    try {
      const blob = await createShareCard();
      const url = URL.createObjectURL(blob);
      if (action === "save") {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `소문난-판결소-${state.data.number}.png`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        shareStatus("판결문 이미지를 저장했습니다.");
      } else {
        const p = state.data.profile;
        const v = p.verdicts[state.verdict];
        const file = new File([blob], "소문난-판결소-판결문.png", { type: "image/png" });
        const text = `소문난 판결소\n${p.title}\n판결: ${v.title}\n형벌: ${v.sentence}`;
        if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: "소문난 판결소 판결문", text, url: location.origin, files: [file] });
        else if (navigator.share) await navigator.share({ title: "소문난 판결소 판결문", text, url: location.origin });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(`${text}\n${location.origin}`);
        else throw new Error("공유 기능 미지원");
        shareStatus("판결 공유 절차를 완료했습니다.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      if (error?.name === "AbortError") shareStatus("공유가 취소됐습니다.");
      else shareStatus("판결문을 만들지 못했습니다. 다시 시도해주세요.", true);
      console.error("share failed", error);
    } finally {
      state.sharing = false;
      $$('[data-share]', stageContent).forEach((button) => { button.disabled = false; });
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const incident = incidentInput.value.replace(/\s+/g, " ").trim();
    const error = validate(incident);
    formError.textContent = error;
    if (error) return;
    const level = String(new FormData(form).get("severity") || "official");
    const fallback = fallbackCase(incident, level);
    setLoading(true);
    let profile;
    let source = "ai";
    let reason = "";
    try {
      profile = normalize(await fetchCase(incident, level), fallback);
    } catch (requestError) {
      source = "fallback";
      reason = requestError?.name === "AbortError" ? "작성 시간이 길어 예비 판례로 전환됐습니다." : "AI 수사본부가 일시적으로 응답하지 않았습니다.";
      profile = fallback;
      console.info("AI fallback", requestError);
    } finally {
      setLoading(false);
    }
    Object.assign(state, { stage: 0, data: makeData(incident, level, profile, source, reason), question: 0, verdict: null, confirmed: false, sharing: false });
    caseNumber.textContent = state.data.number;
    operationName.textContent = `${profile.operationName} · ${severityLabels[level]}`;
    investigation.hidden = false;
    render();
    investigation.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  incidentInput.addEventListener("input", () => {
    charCount.textContent = String(incidentInput.value.length);
    formError.textContent = "";
  });
  $$('[data-example]').forEach((button) => button.addEventListener("click", () => {
    incidentInput.value = button.dataset.example || "";
    charCount.textContent = String(incidentInput.value.length);
    incidentInput.focus();
  }));
  nextButton.addEventListener("click", () => {
    if (state.stage < STAGES.length - 1) {
      state.stage += 1;
      render();
      investigation.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (!state.confirmed && state.verdict !== null) {
      state.confirmed = true;
      render();
    } else if (state.confirmed) reset();
  });
  backButton.addEventListener("click", () => {
    if (state.stage > 0 && !state.confirmed) {
      state.stage -= 1;
      render();
    }
  });
  restartButton.addEventListener("click", reset);
})();
