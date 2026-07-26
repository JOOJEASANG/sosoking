(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $("#case-form");
  const incidentInput = $("#incident");
  const charCount = $("#char-count");
  const formError = $("#form-error");
  const courtroom = $("#courtroom");
  const stageContent = $("#stage-content");
  const caseNumber = $("#case-number");
  const nextButton = $("#next-button");
  const backButton = $("#back-button");
  const restartButton = $("#restart-button");
  const submitButton = form?.querySelector('button[type="submit"]');
  const stageDots = $$('[data-stage-dot]');
  if (!form || !incidentInput || !courtroom || !stageContent || !submitButton || !nextButton || !backButton || !restartButton) return;

  const submitMarkup = submitButton.innerHTML;
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
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,20}(로|길|동)\s*\d+/,
  ];
  const severity = {
    official: { label: "정식 수사", authority: "소문동 생활질서수사대", scale: "참고인 4명과 문서철 2권이 투입됐다.", impact: "피해보다 억울함이 더 크게 집계됐다." },
    special: { label: "특별 수사", authority: "소문동 특별합동수사본부", scale: "수사관 17명과 브리핑룸이 필요 이상으로 설치됐다.", impact: "주변인의 참견이 사건을 전국급으로 확대했다." },
    national: { label: "국가급 대응", authority: "범일상질서 국가비상대책본부", scale: "상황판과 전국 유사 사례 집계가 시작됐다. 총리실은 모른다.", impact: "직접 피해보다 여기까지 온 과정이 더 충격적이다." }
  };
  const categories = [
    { keys: ["과자", "치킨", "아이스크림", "커피", "푸딩", "빵", "라면", "콜라", "먹", "간식"], subject: "개인 식량 자산", charge: "간식주권 침해 및 잔존량 급감" },
    { keys: ["늦", "지각", "약속", "기다", "출근"], subject: "약속 시각", charge: "시간질서 교란 및 대기시간 전가" },
    { keys: ["충전기", "리모컨", "케이블", "이어폰", "마우스", "키보드", "휴대폰"], subject: "생활 필수장비", charge: "전자생활 기반시설 무단 점유" },
    { keys: ["카톡", "답장", "읽씹", "문자", "단톡", "메시지", "연락"], subject: "메신저 응답", charge: "감정 대기 및 답변의무 방치" }
  ];
  const state = { stage: 0, data: null, question: 0, verdict: null, confirmed: false, sharing: false };

  function esc(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function hash(value) {
    let result = 0;
    for (let i = 0; i < value.length; i += 1) result = ((result << 5) - result + value.charCodeAt(i)) | 0;
    return Math.abs(result);
  }

  function clean(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function fallbackProfile(incident, level) {
    const category = categories.find((item) => item.keys.some((key) => incident.includes(key))) || { subject: "일상질서", charge: "사소행위 확대 및 관계 평온 교란" };
    return {
      title: `${category.subject} 관련 경미 행위의 대형사건 전환 사건`,
      charge: category.charge,
      scene: "제보 내용을 확인한 수사팀은 현장의 작은 차이를 중대한 생활질서 변화로 해석했다.",
      damages: "직접 피해 소량, 기분 손상 중간, 설명에 들어간 시간 과다",
      authority: severity[level].authority,
      scale: severity[level].scale,
      impact: severity[level].impact,
      evidence: [
        ["증거 제1호", "당사자 진술", "양측 모두 별일 아니라고 말하면서 사건 설명은 20분째 이어졌다."],
        ["증거 제2호", "현장 정황", "사건 전후의 차이는 작지만 제보자는 정확히 구분할 수 있다고 주장했다."],
        ["증거 제3호", "주변인 반응", "처음에는 관심 없던 주변인들이 현재 각자 책임비율을 계산 중이다."]
      ],
      questions: [
        ["왜 이런 행동을 했습니까?", "피고", "당시에는 이 정도로 커질 줄 몰랐습니다.", "판사", "모든 대형 사건은 대체로 그 문장으로 시작합니다."],
        ["바로 사과했습니까?", "피고", "사과 전에 설명부터 했습니다.", "검사", "사과보다 설명이 네 배 길었다는 기록이 있습니다."],
        ["같은 상황이면 어떻게 하겠습니까?", "피고", "조금 덜 들키게 하겠습니다.", "판사", "반성의 방향이 잘못됐습니다."]
      ],
      prosecution: "피고는 사소한 행동 뒤 즉시 사과하지 않고 장문의 해명을 추가해 사건을 스스로 확대했습니다.",
      defense: "직접 피해는 미미하며 제보자 역시 사건을 주변 사람에게 알려 사회적 확산에 기여했습니다.",
      judge: "행위보다 해명과 소문이 더 큰 피해를 만들었다는 데 양측 의견이 일치합니다.",
      verdicts: [
        ["피고 유죄", "정식 사과 1회 및 같은 행동 7일 금지", "사과문이 너무 진지해 제보자가 오히려 부담을 느끼고 취하를 요청했다."],
        ["쌍방 과실", "간식 하나를 정확히 나눠 먹으며 종결", "간식을 어떻게 나눌지를 두고 책임비율 산정이 다시 시작됐다."],
        ["사건 기각", "이 일을 다른 사람에게 더 말하지 않기", "판결 직후 양측이 결과를 각자 단체대화방에 공유했다."]
      ],
      judgeTypes: ["사과보다 집행 가능성을 중시하는 생활밀착형 재판관", "양쪽을 모두 조금씩 벌주는 균형 집착형 재판관", "사건 종결보다 후속 사건을 잘 만드는 서사 중심형 재판관"]
    };
  }

  function normalize(raw, fallback) {
    const objectsToRows = (items, fields, fallbackRows) => {
      if (!Array.isArray(items) || items.length < 3) return fallbackRows;
      return items.slice(0, 3).map((item, index) => fields.map((field, fieldIndex) => clean(item?.[field], fallbackRows[index][fieldIndex])));
    };
    return {
      title: clean(raw?.title, fallback.title), charge: clean(raw?.charge, fallback.charge), scene: clean(raw?.scene, fallback.scene), damages: clean(raw?.damages, fallback.damages),
      authority: clean(raw?.authority, fallback.authority), scale: clean(raw?.scale, fallback.scale), impact: clean(raw?.impact, fallback.impact),
      evidence: objectsToRows(raw?.evidence, ["label", "title", "detail"], fallback.evidence),
      questions: objectsToRows(raw?.questions, ["question", "speaker", "response", "replySpeaker", "reply"], fallback.questions),
      prosecution: clean(raw?.prosecution, fallback.prosecution), defense: clean(raw?.defense, fallback.defense), judge: clean(raw?.judge, fallback.judge),
      verdicts: objectsToRows(raw?.verdicts, ["title", "sentence", "afterStory"], fallback.verdicts),
      judgeTypes: Array.isArray(raw?.judgeTypes) && raw.judgeTypes.length >= 3 ? raw.judgeTypes.slice(0, 3).map((item, i) => clean(item, fallback.judgeTypes[i])) : fallback.judgeTypes
    };
  }

  async function fetchCase(incident, level) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 36000);
    try {
      const response = await fetch("/api/generate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sosoking-Client": "court-v2" },
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
    $$("input[name=\"severity\"], .example-chip", form).forEach((element) => { element.disabled = active; });
    submitButton.disabled = active;
    submitButton.classList.toggle("is-generating", active);
    submitButton.innerHTML = active ? '<span class="loading-spinner" aria-hidden="true"></span><span>재판부가 사건을 과장 중입니다…</span>' : submitMarkup;
    formError.classList.toggle("is-status", active);
    formError.textContent = active ? "증거를 확대 해석하고 양측의 억지 주장을 정리하고 있습니다." : "";
  }

  function makeData(incident, level, profile, source, reason = "") {
    return {
      incident,
      level,
      profile,
      source,
      reason,
      openedAt: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date()),
      number: `${new Date().getFullYear()}-소판-${(hash(incident + profile.title) % 9000) + 1000}`
    };
  }

  function sourceNotice(data) {
    const ai = data.source === "ai";
    return `<div class="source-notice ${ai ? "source-notice--ai" : "source-notice--fallback"}"><strong>${ai ? "AI 맞춤 사건" : "예비 판례 적용"}</strong><span>${ai ? "입력한 내용을 바탕으로 방금 작성된 가상 재판입니다." : `AI 재판부 연결 전이라 준비된 판례로 진행합니다.${data.reason ? ` ${esc(data.reason)}` : ""}`}</span></div>`;
  }

  function renderOpening() {
    const data = state.data;
    const p = data.profile;
    const ai = data.source === "ai";
    stageContent.innerHTML = `<div class="dossier-topline"><span class="dossier-label">긴급 사건 접수 보고</span><span class="source-chip ${ai ? "is-ai" : "is-fallback"}">${ai ? "AI 맞춤" : "예비 판례"}</span></div><h2>${esc(p.title)}</h2><p class="stage-lead">${data.openedAt}, 제보자는 다음과 같은 중대한 일상질서 침해를 신고했다.<br><strong>“${esc(data.incident)}”</strong></p>${sourceNotice(data)}<div class="fact-grid"><div class="fact-card"><small>적용 혐의</small><strong>${esc(p.charge)}</strong><p>실제 법률과 관계없는 자체 혐의입니다.</p></div><div class="fact-card"><small>예상 피해</small><strong>${esc(p.damages)}</strong><p>${esc(p.impact)}</p></div><div class="fact-card"><small>담당 기관</small><strong>${esc(p.authority)}</strong><p>${esc(p.scale)}</p></div></div><div class="judge-line"><strong>재판부 예비 의견</strong><br>“별일 아닌 것처럼 보입니다. 따라서 더욱 철저히 조사하겠습니다.”</div>`;
  }

  function renderInvestigation() {
    const p = state.data.profile;
    stageContent.innerHTML = `<span class="dossier-label">현장 감식 결과</span><h2>사소한 현장에서 지나치게 많은 증거가 발견됐다.</h2><p class="stage-lead">${esc(p.scene)} 수사팀은 관계없는 물건에도 번호표를 붙였고 현재 번호표가 부족하다.</p><div class="evidence-grid">${p.evidence.map((item, i) => `<div class="evidence-card" data-mark="${i + 1}"><small>${esc(item[0])}</small><strong>${esc(item[1])}</strong><p>${esc(item[2])}</p></div>`).join("")}</div><div class="judge-line"><strong>수사팀 브리핑</strong><br>“결정적 증거인지는 모르겠으나 보고서 분량에는 충분합니다.”</div>`;
  }

  function renderInterrogation() {
    const p = state.data.profile;
    const selected = p.questions[state.question];
    stageContent.innerHTML = `<span class="dossier-label">피고인 집중 신문</span><h2>피고는 혐의를 부인했으나 설명할수록 불리해졌다.</h2><div class="question-list">${p.questions.map((item, i) => `<button type="button" class="question-button ${i === state.question ? "is-selected" : ""}" data-question="${i}"><span>${esc(item[0])}</span><span aria-hidden="true">신문 ${i + 1}</span></button>`).join("")}</div><div class="dialogue"><div class="speech"><b>신문관</b><p>${esc(selected[0])}</p></div><div class="speech is-right"><b>${esc(selected[1])}</b><p>${esc(selected[2])}</p></div><div class="speech"><b>${esc(selected[3])}</b><p>${esc(selected[4])}</p></div></div>`;
    $$("[data-question]", stageContent).forEach((button) => button.addEventListener("click", () => {
      state.question = Number(button.dataset.question);
      renderInterrogation();
    }));
  }

  function renderTrial() {
    const p = state.data.profile;
    stageContent.innerHTML = `<span class="dossier-label">소문난 판결소 제1법정</span><h2>양측은 사소한 문제를 국가적 쟁점으로 키웠다.</h2><div class="court-columns"><section class="counsel-card prosecution"><h3>검사 측 최종 의견</h3><blockquote>“${esc(p.prosecution)}”</blockquote></section><section class="counsel-card defense"><h3>변호인 측 최종 의견</h3><blockquote>“${esc(p.defense)}”</blockquote></section></div><div class="dialogue"><div class="speech"><b>검사</b><p>행동은 사소했지만 해명이 사건을 키웠습니다.</p></div><div class="speech is-right"><b>변호인</b><p>여기까지 키운 것은 수사본부와 재판부도 마찬가지입니다.</p></div><div class="speech"><b>재판장</b><p>${esc(p.judge)}</p></div></div><div class="judge-line"><strong>재판장</strong><br>“상식과 감정, 그리고 약간의 편견을 종합해 판결하겠습니다.”</div>`;
  }

  function sharePanel() {
    return `<section class="share-panel" aria-labelledby="share-title"><div><span class="share-kicker">판결문 반출 허가</span><h3 id="share-title">이 황당한 판결을 증거로 남기세요.</h3><p>입력한 원문은 공유 카드에 넣지 않습니다. 사건명과 판결 결과만 저장됩니다.</p></div><div class="share-buttons"><button type="button" class="secondary-button share-button" data-share-action="download"><svg class="ui-icon" aria-hidden="true"><use href="./icons.svg#file"></use></svg>결과 카드 저장</button><button type="button" class="primary-button share-button" data-share-action="share"><svg class="ui-icon" aria-hidden="true"><use href="./icons.svg#megaphone"></use></svg>판결 공유</button></div><p class="share-status" data-share-status role="status" aria-live="polite"></p></section>`;
  }

  function renderVerdict() {
    const p = state.data.profile;
    const selected = state.verdict === null ? null : p.verdicts[state.verdict];
    const result = state.confirmed && selected
      ? `<div class="result-banner"><h3>주문: ${esc(selected[0])}</h3><p>피고에게 <strong>${esc(selected[1])}</strong>을 명한다. 피고는 이해하지 못했으나 일단 고개를 끄덕였다.</p></div><div class="after-story"><h3>판결 집행 후 긴급 속보</h3><p>${esc(selected[2])}</p></div><div class="judge-line"><strong>당신의 판결 성향</strong><br>${esc(p.judgeTypes[state.verdict])}</div>${sharePanel()}`
      : '<div class="judge-line"><strong>재판장 안내</strong><br>“가장 속이 시원하거나 가장 웃긴 판결을 선택하십시오.”</div>';
    stageContent.innerHTML = `<span class="dossier-label">최종 선고</span><h2>${state.confirmed ? "판결은 끝났지만 유치함은 남았다." : "이 사소한 사건에 과도하게 적절한 판결을 내려주세요."}</h2><div class="verdict-grid">${p.verdicts.map((item, i) => `<button type="button" class="verdict-card ${state.verdict === i ? "is-selected" : ""}" data-verdict="${i}" ${state.confirmed ? "disabled" : ""}><strong>${esc(item[0])}</strong><p>${esc(item[1])}</p></button>`).join("")}</div>${result}`;
    if (!state.confirmed) {
      $$("[data-verdict]", stageContent).forEach((button) => button.addEventListener("click", () => {
        state.verdict = Number(button.dataset.verdict);
        renderVerdict();
        updateNext();
      }));
    } else {
      $$("[data-share-action]", stageContent).forEach((button) => button.addEventListener("click", () => handleShareAction(button.dataset.shareAction)));
    }
  }

  const renderers = [renderOpening, renderInvestigation, renderInterrogation, renderTrial, renderVerdict];

  function render() {
    stageDots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === state.stage);
      dot.classList.toggle("is-done", i < state.stage);
    });
    backButton.hidden = state.stage === 0 || state.confirmed;
    renderers[state.stage]();
    updateNext();
  }

  function updateNext() {
    nextButton.textContent = ["현장 수사 개시 →", "피고인 심문 시작 →", "법정 공방 개정 →", "최종 판결로 이동 →", state.confirmed ? "새 사건 접수하기" : "이 판결 확정하기"][state.stage];
    nextButton.disabled = state.stage === 4 && state.verdict === null;
  }

  function reset() {
    Object.assign(state, { stage: 0, data: null, question: 0, verdict: null, confirmed: false, sharing: false });
    courtroom.hidden = true;
    form.reset();
    charCount.textContent = "0";
    formError.textContent = "";
    formError.classList.remove("is-status");
    incidentInput.focus();
    $(".intake-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function validate(value) {
    if (value.length < 7) return "조금만 더 자세히 적어주세요. 최소 7자는 필요합니다.";
    if (blocked.some((term) => value.includes(term))) return "실제 심각한 피해나 범죄는 코미디 재판으로 만들지 않습니다.";
    if (privatePatterns.some((pattern) => pattern.test(value))) return "전화번호·이메일·주소·차량번호 등 개인정보로 보이는 내용을 지워주세요.";
    return "";
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지 생성 실패")), "image/png", 0.95);
    });
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
    const chars = [...String(text)];
    const lines = [];
    let line = "";
    for (const char of chars) {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
        if (lines.length === maxLines - 1) break;
      } else {
        line = next;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    const consumed = lines.join("").length;
    if (consumed < chars.length) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  function drawStamp(ctx, x, y, text, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = "#b52228";
    ctx.fillStyle = "#b52228";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "900 48px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 2);
    ctx.restore();
  }

  async function createShareCardBlob() {
    if (!state.data || state.verdict === null) throw new Error("확정된 판결이 없습니다.");
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    const p = state.data.profile;
    const verdict = p.verdicts[state.verdict];
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 기능을 사용할 수 없습니다.");

    ctx.fillStyle = "#f6f0e4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#13203a";
    ctx.fillRect(0, 0, canvas.width, 226);
    ctx.fillStyle = "rgba(185,139,53,0.14)";
    ctx.beginPath();
    ctx.arc(930, 1010, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d6c8b2";
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, 972, 1242);

    drawStamp(ctx, 116, 112, "소", -0.08);
    drawStamp(ctx, 964, 112, "소", 0.08);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "800 56px serif";
    ctx.fillText("문난 판결", 540, 128);
    ctx.font = "700 23px sans-serif";
    ctx.fillStyle = "#d9c79f";
    ctx.fillText("사소한 일상 전문 대형사건 처리기관", 540, 177);

    ctx.textAlign = "left";
    ctx.fillStyle = "#b52228";
    ctx.font = "800 25px sans-serif";
    ctx.fillText("최종 판결문", 102, 298);
    ctx.fillStyle = "#13203a";
    ctx.font = "900 56px serif";
    let y = wrapCanvasText(ctx, p.title, 102, 370, 876, 72, 3) + 42;

    ctx.strokeStyle = "#b52228";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(102, y);
    ctx.lineTo(978, y);
    ctx.stroke();
    y += 72;

    ctx.fillStyle = "#6f675b";
    ctx.font = "800 24px sans-serif";
    ctx.fillText("주문", 102, y);
    y += 58;
    ctx.fillStyle = "#b52228";
    ctx.font = "900 48px serif";
    y = wrapCanvasText(ctx, verdict[0], 102, y, 876, 62, 2) + 40;

    ctx.fillStyle = "#13203a";
    ctx.font = "700 32px sans-serif";
    y = wrapCanvasText(ctx, verdict[1], 102, y, 876, 50, 4) + 62;

    ctx.fillStyle = "#efe5d3";
    ctx.fillRect(102, y, 876, 184);
    ctx.fillStyle = "#6f675b";
    ctx.font = "800 22px sans-serif";
    ctx.fillText("판결 집행 후 긴급 속보", 136, y + 45);
    ctx.fillStyle = "#29251f";
    ctx.font = "600 27px sans-serif";
    wrapCanvasText(ctx, verdict[2], 136, y + 92, 808, 39, 3);
    y += 236;

    ctx.fillStyle = "#13203a";
    ctx.font = "800 22px sans-serif";
    ctx.fillText("당신의 판결 성향", 102, y);
    ctx.fillStyle = "#6f675b";
    ctx.font = "600 27px sans-serif";
    wrapCanvasText(ctx, p.judgeTypes[state.verdict], 102, y + 48, 876, 40, 3);

    ctx.fillStyle = "#13203a";
    ctx.fillRect(54, 1192, 972, 104);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "800 25px sans-serif";
    ctx.fillText("별일 아니지만, 일단 재판부터 열겠습니다.", 540, 1234);
    ctx.fillStyle = "#d9c79f";
    ctx.font = "700 22px sans-serif";
    ctx.fillText("sosoking.co.kr · 오락용 가상 판결", 540, 1272);

    return canvasBlob(canvas);
  }

  function setShareStatus(message, isError = false) {
    const status = $("[data-share-status]", stageContent);
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function setShareBusy(active) {
    state.sharing = active;
    $$("[data-share-action]", stageContent).forEach((button) => { button.disabled = active; });
  }

  async function downloadCard() {
    const blob = await createShareCardBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `소문난-판결소-${state.data.number}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setShareStatus("판결 결과 카드를 이미지로 저장했습니다.");
  }

  async function shareResult() {
    const p = state.data.profile;
    const verdict = p.verdicts[state.verdict];
    const shareText = `소문난 판결소\n${p.title}\n판결: ${verdict[0]}\n형벌: ${verdict[1]}`;
    const url = location.origin;
    const blob = await createShareCardBlob();
    const file = new File([blob], `소문난-판결소-${state.data.number}.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "소문난 판결소 판결문", text: shareText, url, files: [file] });
      setShareStatus("판결문 공유 창을 열었습니다.");
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "소문난 판결소 판결문", text: shareText, url });
      setShareStatus("판결 결과를 공유했습니다.");
      return;
    }
    await navigator.clipboard.writeText(`${shareText}\n${url}`);
    setShareStatus("공유 문구를 복사했습니다. 원하는 대화방에 붙여넣으세요.");
  }

  async function handleShareAction(action) {
    if (state.sharing) return;
    setShareBusy(true);
    setShareStatus("판결문을 정리하고 있습니다.");
    try {
      if (action === "download") await downloadCard();
      else await shareResult();
    } catch (error) {
      if (error?.name === "AbortError") setShareStatus("공유가 취소됐습니다.");
      else setShareStatus("공유 카드를 만들지 못했습니다. 다시 시도해주세요.", true);
      console.error("share failed", error);
    } finally {
      setShareBusy(false);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const incident = incidentInput.value.replace(/\s+/g, " ").trim();
    const error = validate(incident);
    formError.classList.remove("is-status");
    formError.textContent = error;
    if (error) return;
    const level = String(new FormData(form).get("severity") || "official");
    const fallback = fallbackProfile(incident, level);
    setLoading(true);
    let profile;
    let source = "ai";
    let reason = "";
    try {
      profile = normalize(await fetchCase(incident, level), fallback);
    } catch (requestError) {
      source = "fallback";
      reason = requestError?.name === "AbortError" ? "작성 시간이 길어 예비 판례로 전환됐습니다." : "AI 서버가 아직 연결되지 않았거나 일시적으로 응답하지 않았습니다.";
      profile = fallback;
      console.info("AI fallback", requestError);
    } finally {
      setLoading(false);
    }
    Object.assign(state, { stage: 0, data: makeData(incident, level, profile, source, reason), question: 0, verdict: null, confirmed: false, sharing: false });
    caseNumber.textContent = `사건번호 ${state.data.number} · ${severity[level].label} · ${source === "ai" ? "AI 맞춤 재판" : "예비 판례 재판"}`;
    courtroom.hidden = false;
    render();
    courtroom.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  incidentInput.addEventListener("input", () => {
    charCount.textContent = String(incidentInput.value.length);
    formError.textContent = "";
    formError.classList.remove("is-status");
  });
  $$(".example-chip").forEach((button) => button.addEventListener("click", () => {
    incidentInput.value = button.dataset.example || "";
    charCount.textContent = String(incidentInput.value.length);
    incidentInput.focus();
  }));
  nextButton.addEventListener("click", () => {
    if (state.stage < 4) {
      state.stage += 1;
      render();
      courtroom.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (!state.confirmed) {
      if (state.verdict !== null) {
        state.confirmed = true;
        render();
      }
    } else reset();
  });
  backButton.addEventListener("click", () => {
    if (state.stage > 0 && !state.confirmed) {
      state.stage -= 1;
      render();
    }
  });
  restartButton.addEventListener("click", reset);
})();
