(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const views = { intake: $("#intake-view"), loading: $("#loading-view"), story: $("#story-view") };
  const state = { data: null, incident: "", severity: "official", number: "", source: "", timer: null, step: 0 };
  const loadingSteps = [
    ["접수계", "신고 문장을 사건번호보다 짧게 정리하는 중"],
    ["초동팀", "현장 반경 90cm에 통제선을 설치하는 중"],
    ["잠복팀", "아무도 요청하지 않은 위장근무를 편성하는 중"],
    ["감식실", "관련 물건의 크기와 잔여량을 48배 확대하는 중"],
    ["조사실", "피의자와 피해자의 표현 차이를 분 단위로 분석하는 중"],
    ["송치계", "가상 혐의명을 필요 이상으로 엄숙하게 작성하는 중"],
    ["조정실", "배상 수량과 첫 사용권을 협상하는 중"],
    ["법정", "같은 증거를 양쪽이 정반대로 해석하는 중"],
    ["재판부", "판결보다 유치한 후일담을 봉인하는 중"]
  ];

  function show(name) {
    Object.entries(views).forEach(([key, element]) => { element.hidden = key !== name; });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function caseNumber() {
    const date = new Date();
    const stamp = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    return `생활질서-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function validate(text) {
    if (text.length < 7) return "사건 내용을 7자 이상 적어주세요.";
    if (text.length > 120) return "사건 내용은 120자 이하만 접수됩니다.";
    if (["폭행", "성폭력", "학대", "자살", "자해", "살인", "납치", "유괴", "스토킹", "협박", "학교폭력", "가정폭력", "아동학대", "사망", "흉기", "마약"].some((term) => text.includes(term))) return "실제 심각한 피해나 범죄는 코미디 사건으로 접수할 수 없습니다.";
    if (/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\//i.test(text)) return "전화번호·이메일·주소 같은 개인정보를 삭제해주세요.";
    return "";
  }

  function localFallback(incident) {
    const words = incident.replace(/[.,!?]/g, "").split(/\s+/).filter((word) => word.length > 1);
    const subject = words.slice(0, 2).join("·") || "생활질서";
    const primary = words.find((word) => !/내가|나는|친구|가족|동생|회사/.test(word)) || subject;
    return {
      originalIncident: incident,
      title: `${subject} 과잉절차 적용 사건`, subtitle: "최초 신고부터 판결 이후까지 자동 편철된 가상 기록", fictionalCharge: `${primary} 관련 기대권 경계초과 혐의`,
      caseSummary: `“${incident}”라는 짧은 신고가 접수되자 생활질서 특수본은 이를 단순한 다툼이 아닌 완결된 사건으로 확대했다.`,
      intake: { complaint: incident, complainantStatement: `피해자는 ${primary}에 관한 허용 범위가 분명했다고 진술했다.`, accusedInitialPosition: `피의자는 고의가 아니라 순간적인 판단이었다고 주장했다.`, assignedUnit: `${subject} 생활질서 전담반 21명` },
      initialInvestigation: {
        sceneControl: `${primary} 주변 반경 90cm를 통제하고 사건 전 상태를 재구성했다.`,
        measurements: [`${primary}의 위치·크기·잔여량을 세 차례 측정`, "사건 전후 시간을 초 단위로 복원", "관련 물건의 이동거리와 방향 기록"],
        witnessChecks: ["가장 가까운 사람의 최초 반응 확인", "현장에 있었지만 관심 없던 참고인 조사", "사건 뒤 단체대화방 반응 분석"],
        evidence: [
          { title: `${primary} 현장 상태`, detail: `${incident} 직후 상태를 사진과 자로 기록했다.`, meaning: "최초 신고와 일치하는 핵심 자료" },
          { title: `${subject} 주변 흔적`, detail: "관련 물건의 위치와 사용 흔적이 평소와 달랐다.", meaning: "행위 범위를 추정하는 보조 자료" },
          { title: "사건 전 대화 기록", detail: "허용 범위와 기대 수준을 확인할 수 있는 짧은 대화가 남아 있다.", meaning: "당사자의 사전 인식을 판단" },
          { title: "사건 후 해명 변화", detail: "해명 과정에서 표현이 세 차례 달라졌다.", meaning: "고의보다 당황한 정도를 보여주는 자료" }
        ]
      },
      overInvestigation: {
        taskForce: `${subject} 합동과잉수사본부를 편성하고 장비 11종을 투입했다.`, surveillance: `${primary}이 다시 문제될 가능성을 확인하려고 현장 옆에서 2시간 잠복했으나 간식 시간만 정확히 파악했다.`,
        forensicReports: [
          { target: `${primary} 표면`, method: "48배 확대 분석", finding: "사건 전후 형태 차이가 확인됨", unnecessaryConclusion: "관련 물건은 당시 약간 당황했을 가능성이 높음" },
          { target: `${subject} 주변`, method: "미세 위치 복원", finding: "최초 위치에서 3.7cm 이동", unnecessaryConclusion: "이동 방향은 냉장고 또는 소파 쪽을 선호함" },
          { target: "주변 공용도구", method: "사용 흔적 교차대조", finding: "사건 시간대 사용 가능성 존재", unnecessaryConclusion: "도구는 끝까지 진술을 거부함" }
        ],
        searchAndSeizure: `${primary} 주변 서랍과 포장물에 가상 확인영장을 집행하고 관련성 낮은 영수증까지 봉인했다.`, publicBriefing: `${subject} 사건은 통제되고 있으나 유사 사례 확산 가능성을 이유로 마이크 7개를 설치했다.`
      },
      interrogation: { accusedStatement: `${primary} 관련 행동은 인정하지만 결과가 그렇게 커질 줄 몰랐다고 진술했다.`, complainantRebuttal: "피해자는 결과보다 사전 허락과 사후 태도가 핵심이라고 반박했다.", witnessStatements: ["참고인은 사건 직후 모두가 관련 물건만 바라봤다고 진술했다.", "다른 참고인은 사건보다 수사 인원이 더 놀라웠다고 진술했다."], contradictions: ["행위 시각이 최초 진술보다 4분 늦어짐", "허용 범위 표현이 세 차례 변경됨", "사건 직후 태도에 관한 진술과 대화 기록이 충돌함"] },
      referral: { investigationConclusion: `${primary} 관련 기본 사실은 인정되나 피해 규모는 기대치에 따라 달라진다.`, fictionalCharge: `${primary} 기대권 경계초과 혐의`, referralOpinion: "기소 의견으로 소문동 생활질서 심사부에 송치", prosecutionDecision: "사안은 하찮지만 기록이 너무 두꺼워 가상 기소 결정", coreIssues: ["사전에 허용된 범위", "실제 행동이 허용 범위를 넘었는지", "사후 사과와 복구 제안이 충분했는지"] },
      settlement: { openingDemand: `피해자 측은 ${primary} 3배 복구와 공식 사과를 요구했다.`, counterOffer: `피의자 측은 동일한 ${primary} 1개와 간단한 사과를 제안했다.`, mediatorRecommendation: `조정위원은 ${primary} 2개 복구, 첫 사용권 보장, 관련 농담 7일 금지를 권고했다.`, result: "수량에는 접근했으나 첫 사용권 문구를 두고 부분 합의에 그쳤다.", reason: "‘먼저’의 기준을 포장 개봉 시점으로 볼지 실제 사용 시점으로 볼지 의견이 갈렸다." },
      trial: {
        prosecutionOpening: `검사는 ${primary} 자체보다 허용 범위를 넘긴 뒤 대수롭지 않게 대응한 점을 문제 삼았다.`, defenseOpening: "변호인은 피해가 즉시 복구 가능하고 사전 허용이 일부 있었다고 반박했다.",
        evidenceArguments: [
          { evidence: `${primary} 현장 상태`, prosecution: "허용 범위를 넘긴 결과가 명확하다.", defense: "정확한 원래 상태가 기록되지 않았다." },
          { evidence: "사건 전 대화", prosecution: "제한된 허용만 있었다.", defense: "금지 의사가 명확하지 않았다." },
          { evidence: "사건 후 해명", prosecution: "책임을 줄이려 진술이 바뀌었다.", defense: "당황해서 표현만 달라졌다." }
        ],
        witnessExamination: [
          { question: "사건 직후 분위기는 어땠습니까?", answer: "모두가 해당 물건만 바라봤습니다.", courtReaction: "재판부는 침묵의 길이를 중요한 정황으로 기록했다." },
          { question: "평소에도 비슷한 일이 있었습니까?", answer: "작은 전례는 있었지만 수사본부는 처음입니다.", courtReaction: "재판부는 반복성보다 과잉수사성을 주목했다." },
          { question: "복구 제안을 받았습니까?", answer: "받았지만 조건이 지나치게 작았습니다.", courtReaction: "재판부는 ‘작다’의 객관적 기준을 다시 물었다." }
        ],
        judgeQuestions: ["허용 범위를 숫자나 크기로 정한 적이 있습니까?", "지금이라도 동일한 물건으로 복구할 의사가 있습니까?"], closingStatements: "검사는 생활질서 회복을, 변호인은 즉시 화해를 요청했고 피의자는 다음부터 먼저 묻겠다고 최후진술했다."
      },
      judgment: { recognizedFacts: [`${primary} 관련 행동이 실제로 발생함`, "피해자가 일정 범위만 허용했거나 기대했음", "사후 해명과 복구 제안이 충분하지 않았음"], liabilityRatio: "피의자 80% · 피해자 20% 관리책임", order: `피의자는 ${primary} 2개를 복구하고 첫 사용권을 피해자에게 보장한다.`, sentence: "관련 물건 접근 전 사전 질문 의무 14일", reasoning: "사건은 작지만 약속의 경계와 사후 태도는 작지 않다. 다만 허용 범위를 구체적으로 정하지 않은 책임도 일부 인정한다.", afterStory: `복구된 ${primary}의 첫 사용권을 행사하는 순서를 두고 새로운 사건이 접수됐다.` }
    };
  }

  function record(label, title, copy, className = "") {
    return `<article class="record ${className}"><small>${esc(label)}</small>${title ? `<b>${esc(title)}</b>` : ""}<p>${esc(copy)}</p></article>`;
  }
  function list(items) { return `<ol class="list-block">${(items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`; }

  function render(data) {
    state.data = data;
    $("#rail-number").textContent = state.number;
    $("#rail-title").textContent = data.title;
    $("#rail-charge").textContent = data.fictionalCharge;
    $("#case-number").textContent = state.number;
    $("#case-source").textContent = state.source === "gemini" ? "AI 자동 사건기록" : "접수문 기반 자동 사건기록";
    $("#case-subtitle").textContent = data.subtitle;
    $("#case-title").textContent = data.title;
    $("#case-summary").textContent = data.caseSummary;
    $("#case-charge").textContent = data.fictionalCharge;
    $("#case-incident").textContent = data.intake.complaint || state.incident;

    $("#intake-content").innerHTML = `<div class="record-grid">${record("최초 신고", "피해자 접수 내용", data.intake.complaint, "full accent")}${record("피해자 최초 진술", "신고 취지", data.intake.complainantStatement)}${record("피의자 최초 입장", "초기 해명", data.intake.accusedInitialPosition)}${record("담당 배정", "사건 전담 조직", data.intake.assignedUnit, "full navy")}</div>`;

    $("#initial-content").innerHTML = `${record("현장 보존", "초동조치", data.initialInvestigation.sceneControl, "full accent")}<div class="record-grid">${record("현장 측정", "정밀 측정 항목", "필요 이상으로 세분화된 측정을 실시했다.", "navy")}${list(data.initialInvestigation.measurements)}${record("탐문", "참고인 확인", "관심 없던 사람까지 사건기록에 포함했다.", "gold")}${list(data.initialInvestigation.witnessChecks)}</div><div class="evidence-table">${data.initialInvestigation.evidence.map((item) => `<article class="evidence-row"><h3>${esc(item.title)}</h3><div><p>${esc(item.detail)}</p><small>${esc(item.meaning)}</small></div></article>`).join("")}</div>`;

    $("#over-content").innerHTML = `<div class="record-grid">${record("합동수사본부", "투입 조직", data.overInvestigation.taskForce, "full navy")}${record("잠복근무", "관찰 작전", data.overInvestigation.surveillance, "accent")}${record("가상 영장 집행", "압수수색", data.overInvestigation.searchAndSeizure, "gold")}</div><div class="record-grid">${data.overInvestigation.forensicReports.map((item) => `<article class="forensic-card"><span>국가과잉수사연구소 감정서</span><h3>${esc(item.target)}</h3><dl><dt>방법</dt><dd>${esc(item.method)}</dd><dt>결과</dt><dd>${esc(item.finding)}</dd><dt>불필요한 결론</dt><dd>${esc(item.unnecessaryConclusion)}</dd></dl></article>`).join("")}</div>${record("공개 브리핑", "수사본부 발표", data.overInvestigation.publicBriefing, "full accent")}`;

    $("#interrogation-content").innerHTML = `<div class="statement-pair"><article class="speaker-card accused"><h3>피의자 진술</h3><p>${esc(data.interrogation.accusedStatement)}</p></article><article class="speaker-card complainant"><h3>피해자 반박</h3><p>${esc(data.interrogation.complainantRebuttal)}</p></article></div><div class="record-grid">${record("참고인 진술", "현장 주변 진술", data.interrogation.witnessStatements.join(" / "), "full")}${record("진술 분석", "발견된 모순", "수사본부는 아래 차이를 별도 사건처럼 취급했다.", "accent")}${list(data.interrogation.contradictions)}</div>`;

    $("#referral-content").innerHTML = `<div class="record-grid">${record("수사결론", "최종 수사의견", data.referral.investigationConclusion, "full navy")}${record("적용 혐의", data.referral.fictionalCharge, data.referral.referralOpinion, "accent")}${record("가상 기소", "심사부 결정", data.referral.prosecutionDecision, "gold")}</div><div class="issue-chip-wrap">${data.referral.coreIssues.map((item) => `<span class="issue-chip">${esc(item)}</span>`).join("")}</div>`;

    $("#settlement-content").innerHTML = `<div class="settlement-flow"><article class="settlement-party"><small>피해자 요구안</small><h3>${esc(data.settlement.openingDemand)}</h3></article><div class="settlement-arrow">⇄</div><article class="settlement-party"><small>피의자 반대안</small><h3>${esc(data.settlement.counterOffer)}</h3></article></div><article class="mediator-box"><small>조정위원 권고</small><h3>${esc(data.settlement.mediatorRecommendation)}</h3></article><article class="settlement-result"><small>조정 결과</small><h3>${esc(data.settlement.result)}</h3><p>${esc(data.settlement.reason)}</p></article>`;

    $("#trial-content").innerHTML = `<div class="argument-pair"><article class="speaker-card prosecution"><h3>검사 모두진술</h3><p>${esc(data.trial.prosecutionOpening)}</p></article><article class="speaker-card defense"><h3>변호인 모두진술</h3><p>${esc(data.trial.defenseOpening)}</p></article></div><div class="evidence-table">${data.trial.evidenceArguments.map((item) => `<article class="evidence-argument"><h3>${esc(item.evidence)}</h3><div><p><b>검사</b><br>${esc(item.prosecution)}</p><p><b>변호인</b><br>${esc(item.defense)}</p></div></article>`).join("")}</div><div class="record-grid">${data.trial.witnessExamination.map((item, index) => `<article class="transcript"><b>증인신문 ${index + 1}</b><p><strong>Q.</strong> ${esc(item.question)}</p><p><strong>A.</strong> ${esc(item.answer)}</p><small>${esc(item.courtReaction)}</small></article>`).join("")}</div>${data.trial.judgeQuestions.map((item) => `<blockquote class="judge-question">재판장: “${esc(item)}”</blockquote>`).join("")}<article class="record full navy"><small>최후진술</small><p>${esc(data.trial.closingStatements)}</p></article>`;

    $("#judgment-content").innerHTML = `<article class="judgment-box"><h3>${esc(data.title)} 판결문</h3><small>인정된 사실</small>${list(data.judgment.recognizedFacts)}<p><b>책임 비율</b><br>${esc(data.judgment.liabilityRatio)}</p><p class="judgment-order">${esc(data.judgment.order)}</p><p><b>부가 명령</b><br>${esc(data.judgment.sentence)}</p><p><b>판결 이유</b><br>${esc(data.judgment.reasoning)}</p></article><article class="after-story"><small>판결 집행 후 긴급속보</small><h3>${esc(data.judgment.afterStory)}</h3></article>`;
    setupReadingObserver();
  }

  function setupReadingObserver() {
    const links = new Map($$("#stage-nav a").map((link) => [link.dataset.stage, link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.remove("active"));
      links.get(visible.target.dataset.stageSection)?.classList.add("active");
    }, { rootMargin: "-25% 0px -60% 0px", threshold: [0, .2, .5] });
    $$('[data-stage-section]').forEach((section) => observer.observe(section));
  }

  function updateReadingProgress() {
    if (views.story.hidden) return;
    const article = $(".case-dossier");
    const start = article.offsetTop;
    const end = article.offsetHeight - window.innerHeight;
    const percent = Math.max(0, Math.min(100, ((window.scrollY - start) / Math.max(1, end)) * 100));
    $("#reading-bar").style.width = `${percent}%`;
    $("#reading-percent").textContent = `${Math.round(percent)}%`;
  }

  function startLoading() {
    show("loading");
    state.step = 0;
    $("#loading-log").innerHTML = "";
    $("#loading-bar").style.width = "8%";
    $("#loading-percent").textContent = "08%";
    const add = () => {
      const item = loadingSteps[state.step];
      if (!item) return;
      $("#loading-current").textContent = item[1];
      $("#loading-log").insertAdjacentHTML("beforeend", `<li><time>절차 ${String(state.step + 1).padStart(2, "0")}</time><span><b>${esc(item[0])}</b> · ${esc(item[1])}</span></li>`);
      state.step += 1;
      const percent = Math.min(94, 8 + state.step * 10);
      $("#loading-bar").style.width = `${percent}%`;
      $("#loading-percent").textContent = `${percent}%`;
    };
    add();
    clearInterval(state.timer);
    state.timer = setInterval(add, 1900);
  }

  async function generate() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 52000);
    try {
      const response = await fetch("/api/generate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sosoking-Client": "court-v6" },
        body: JSON.stringify({ incident: state.incident, severity: state.severity }),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.case) throw new Error(body.error || "사건기록 생성 실패");
      state.source = body.meta?.source || "gemini";
      return body.case;
    } finally {
      clearTimeout(timer);
    }
  }

  function reset() {
    clearInterval(state.timer);
    state.data = null;
    state.incident = "";
    state.number = "";
    state.source = "";
    $("#incident").value = "";
    $("#char-count").textContent = "0";
    $("#form-error").textContent = "";
    $("#header-new-case").hidden = true;
    show("intake");
  }

  $("#case-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("#incident").value.replace(/\s+/g, " ").trim();
    const error = validate(text);
    $("#form-error").textContent = error;
    if (error) return;
    state.incident = text;
    state.severity = new FormData(event.currentTarget).get("severity") || "official";
    state.number = caseNumber();
    startLoading();
    try {
      state.data = await generate();
    } catch (errorObject) {
      console.warn(errorObject);
      state.source = "local-grounded-fallback";
      state.data = localFallback(text);
    }
    clearInterval(state.timer);
    $("#loading-bar").style.width = "100%";
    $("#loading-percent").textContent = "100%";
    $("#loading-current").textContent = "사건 접수부터 판결 이후까지 편철 완료";
    render(state.data);
    setTimeout(() => { show("story"); $("#header-new-case").hidden = false; updateReadingProgress(); }, 350);
  });

  $("#incident").addEventListener("input", (event) => { $("#char-count").textContent = event.target.value.length; $("#form-error").textContent = ""; });
  $$('[data-example]').forEach((button) => button.addEventListener("click", () => { $("#incident").value = button.dataset.example; $("#incident").dispatchEvent(new Event("input")); }));
  $("#header-new-case").addEventListener("click", reset);
  $("#new-case").addEventListener("click", reset);
  $("#share-case").addEventListener("click", async () => {
    const data = state.data;
    const text = `소문난 판결소\n${data.title}\n${data.judgment.order}\n${data.judgment.sentence}\n${state.number}`;
    try {
      if (navigator.share) await navigator.share({ title: "소문난 판결소", text });
      else await navigator.clipboard.writeText(text);
      $("#share-status").textContent = "판결 요약을 공유할 준비가 됐습니다.";
    } catch (error) {
      if (error.name !== "AbortError") $("#share-status").textContent = "공유하지 못했습니다.";
    }
  });
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
  show("intake");
})();
