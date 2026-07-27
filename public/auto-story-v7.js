(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const views = { intake: $("#intake-view"), loading: $("#loading-view"), story: $("#story-view") };
  const state = { data: null, incident: "", severity: "official", number: "", source: "", timer: null, step: 0 };
  const loadingSteps = [
    ["코미디 분석실", "신고문에서 가장 쓸데없이 심각하게 받아들일 단어를 고르는 중"],
    ["접수계", "사건보다 긴 사건번호를 부여하는 중"],
    ["초동팀", "현장 통제선이 가족 동선을 막지 않는 척하는 중"],
    ["잠복팀", "평범해 보이지만 전혀 평범하지 않은 위장 사유를 작성하는 중"],
    ["감식실", "해당 사건에만 가능한 쓸데없는 측정 단위를 개발하는 중"],
    ["조사실", "피의자의 ‘그 정도는 아니다’에서 그 정도를 수치화하는 중"],
    ["조정실", "거의 합의한 양측이 ‘거의’의 뜻으로 다시 다투는 중"],
    ["법정", "같은 증거를 정반대 방향으로 설명하는 중"],
    ["재판부", "첫 장의 반복 개그를 판결 후일담에서 회수하는 중"]
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

  function extractSubject(incident) {
    const words = incident.replace(/[.,!?]/g, "").split(/\s+/).filter((word) => word.length > 1 && !/내가|나는|친구|가족|동생|회사|너무|그냥/.test(word));
    return words[0] || "생활질서";
  }

  function localFallback(incident) {
    const subject = extractSubject(incident);
    const food = /(먹|아이스크림|치킨|푸딩|커피|라면|빵|간식|한입)/.test(incident);
    const time = /(늦|지각|시간|분|약속)/.test(incident);
    const missing = /(사라|없어|잃어|리모컨|충전기|우산|이어폰|열쇠)/.test(incident);
    const profile = food ? {
      centralMisread: "수사본부는 ‘한입’을 일상어가 아니라 부피 단위로 해석했다.", runningGag: "한입의 법정 정의", escalationRule: "피의자가 한입이라고 주장할 때마다 측정 장비가 하나씩 추가된다.", finalCallback: "배상 음식의 첫 한입 권리를 두고 같은 분쟁이 재발한다."
    } : time ? {
      centralMisread: "수사본부는 지각 시간을 기다린 사람이 메뉴판을 읽은 횟수로 환산했다.", runningGag: "거의 다 왔다의 실제 거리", escalationRule: "거의 다 왔다고 말할 때마다 지도상 거리가 늘어난다.", finalCallback: "판결 이행 시각에도 늦어 시간이 증인으로 채택된다."
    } : missing ? {
      centralMisread: `수사본부는 ${subject} 분실을 물건의 자발적 잠적으로 판단했다.`, runningGag: `${subject}의 묵비권`, escalationRule: `수색 범위가 넓어질수록 ${subject}은 처음 장소에 가까워진다.`, finalCallback: `찾은 ${subject}의 보관 표지판이 다시 사라진다.`
    } : {
      centralMisread: `수사본부는 ${subject} 관련 불만을 생활질서 기반시설 붕괴의 전조로 해석했다.`, runningGag: `${subject}의 객관적 기준`, escalationRule: "별일 아니라는 말이 나올 때마다 서류가 두 장씩 늘어난다.", finalCallback: `${subject}의 기준을 정하다 기준 자체가 다시 사건이 된다.`
    };
    const beats = {
      intake: `신고는 한 줄이었지만 접수번호는 신고보다 길었다. ${profile.runningGag}이 공식 쟁점이 됐다.`,
      initialInvestigation: "통제선 안으로 들어간 사람은 없었고 나오는 사람만 계속 늘었다.",
      overInvestigation: `${profile.escalationRule} 수사본부는 이를 해결책이 아니라 인력 증원 사유로 사용했다.`,
      interrogation: "피의자의 ‘그 정도’가 몇 정도인지 묻자 진술이 갑자기 길어졌다.",
      referral: "사건보다 송치 상자가 먼저 대형 분류를 받았다.",
      settlement: "양측은 거의 합의했으나 ‘거의’의 뜻을 두고 다시 갈라졌다.",
      trial: "검사와 변호인은 같은 사진을 들고 서로 반대 방향을 가리켰다.",
      judgment: profile.finalCallback
    };
    return {
      originalIncident: incident,
      comicProfile: profile,
      comicBeats: beats,
      title: `${subject} 객관적 기준 긴급확정 사건`, subtitle: "한 줄의 불만이 8단계 사건기록이 된 경위", fictionalCharge: `${subject} 기대치 무단변경 및 사후설명 지연 혐의`,
      caseSummary: `“${incident}”라는 신고를 접수한 수사본부가 ${profile.runningGag}을 공식 쟁점으로 삼으면서 사건이 걷잡을 수 없이 커졌다.`,
      intake: { complaint: incident, complainantStatement: `피해자는 ${subject} 자체보다 상대가 대수롭지 않게 넘긴 태도가 더 문제라고 진술했다.`, accusedInitialPosition: "피의자는 일부 사실을 인정하면서도 ‘말이 그렇게 커질 일은 아니다’라고 진술해 사건을 키웠다.", assignedUnit: `${subject} 특별사건 전담반 17명과 기록정리요원 1명` },
      initialInvestigation: { sceneControl: `${subject} 주변을 보존하고 양측이 기억하는 원래 상태를 서로 다른 색 테이프로 표시했다.`, measurements: [`${subject}의 원래 상태를 세 가지 가정으로 복원`, "당사자 표정이 굳은 시간을 초 단위로 기록", "사건 전후 해명 문장의 형용사 수 비교"], witnessChecks: ["사건 직전 정상 상태를 본 사람 조사", "최초 해명을 들은 사람 조사", "사건 후 가장 먼저 웃은 사람 조사"], evidence: [
        { title: `${subject} 현장 상태`, detail: `${incident} 직후 모습을 여러 각도에서 기록했다.`, meaning: "신고 내용의 실제 변화 확인" },
        { title: "최초 해명 문장", detail: "첫 해명과 10분 뒤 해명에서 형용사가 달라졌다.", meaning: "책임 축소 표현 확인" },
        { title: "사건 전 대화", detail: "사전 허용 범위를 추정할 짧은 대화가 남아 있다.", meaning: "당사자의 기대 수준 판단" },
        { title: "사건 후 반응", detail: "사과보다 웃음표시가 먼저 전송됐다.", meaning: "사후 태도 판단" }
      ] },
      overInvestigation: { taskForce: `${subject} 합동과잉수사본부가 꾸려졌고 사건 설명보다 조직도가 더 오래 걸렸다.`, surveillance: `${subject} 재발을 확인하려고 잠복했지만 수사팀이 먼저 지쳐 교대표만 완성했다.`, forensicReports: [
        { target: `${subject} 핵심 흔적`, method: "각도별 촬영과 크기 비교", finding: "물리적 차이는 작지만 감정 차이는 큼", unnecessaryConclusion: "크기와 서운함은 비례하지 않음" },
        { target: "최초 해명 음성", method: "말끝 흐림과 접속사 분석", finding: "책임이 커질수록 ‘근데’ 사용 증가", unnecessaryConclusion: "방어 전략이 내용보다 접속사에 의존함" },
        { target: "주변 정황", method: "시간대별 위치 재구성", finding: "설명되지 않는 짧은 공백 확인", unnecessaryConclusion: "공백은 짧았지만 해명은 길었음" }
      ], searchAndSeizure: `${subject} 주변 보관공간에 가상 확인영장을 집행하고 무관한 쿠폰도 동기 가능성으로 봉인했다.`, publicBriefing: `대변인은 ${profile.runningGag}을 발표했으나 기자들은 왜 대변인이 필요한지부터 질문했다.` },
      interrogation: { accusedStatement: `피의자는 ${subject} 관련 행동은 인정하지만 피해자가 기억하는 규모는 과장됐다고 주장했다.`, complainantRebuttal: "피해자는 규모보다 사전 허락과 사후 태도가 핵심이라고 반박했다.", witnessStatements: ["참고인은 피의자가 사건 직후 주변 반응을 먼저 살폈다고 진술했다.", `다른 참고인은 ${profile.runningGag}이 평소에도 농담처럼 반복됐다고 진술했다.`], contradictions: ["최초에는 인정했으나 조사실에서는 기억이 흐려짐", "허용 범위 표현이 조사마다 달라짐", "사과했다고 주장했지만 기록에는 해명이 먼저 남음"] },
      referral: { investigationConclusion: `${subject} 관련 기본 행위와 해명 변화가 확인됐다.`, fictionalCharge: `${subject} 기대치 무단변경 혐의`, referralOpinion: `${profile.runningGag} 판단을 위해 생활질서 심사부에 송치`, prosecutionDecision: "반복 개그의 증거가 충분하다는 이유로 가상 기소 결정", coreIssues: [`${profile.runningGag}의 의미`, "허용 범위를 알고 있었는지", "복구 제안이 진심이었는지"] },
      settlement: { openingDemand: `${subject} 원상복구와 공개 사과`, counterOffer: `${subject} 복구는 수용하되 공개 사과는 작은 목소리로 제한`, mediatorRecommendation: `${subject} 복구와 다음 사용 전 사전 질문`, result: "거의 합의했으나 최종 서명이 보류됐다.", reason: "공개의 범위를 거실까지로 볼지 단체대화방까지로 볼지 합의하지 못했다." },
      trial: { prosecutionOpening: `검사는 ${subject} 자체보다 ${profile.runningGag}을 알고도 축소해 말한 태도를 문제 삼았다.`, defenseOpening: "변호인은 즉시 복구 가능하고 평소 관행이 있었다고 반박했다.", evidenceArguments: [
        { evidence: `${subject} 현장 상태`, prosecution: "허용 범위를 넘긴 결과가 보인다.", defense: "원래 상태 자료가 없어 비교가 어렵다." },
        { evidence: "최초 해명", prosecution: "표현 변화는 책임 축소다.", defense: "당황해서 단어만 바뀌었다." },
        { evidence: profile.runningGag, prosecution: "피의자도 의미를 알고 있었다.", defense: "농담을 법정 기준으로 바꾸는 것은 과도하다." }
      ], witnessExamination: [
        { question: "사건 직후 가장 먼저 한 말은 무엇입니까?", answer: "정확히 기억나지 않지만 사과는 아니었습니다.", courtReaction: "재판부는 기억보다 사과가 아니었다는 점을 또렷하게 기록했다." },
        { question: `${profile.runningGag}을 이전에도 들었습니까?`, answer: "농담처럼 여러 번 들었습니다.", courtReaction: "재판부는 반복된 농담이 생활규칙이 될 수 있는지 검토했다." },
        { question: "지금 합의가 가능한가요?", answer: "상대가 정확한 기준을 인정하면 가능합니다.", courtReaction: "재판부는 양측이 해결보다 정의에 더 관심이 있다고 판단했다." }
      ], judgeQuestions: [`${profile.runningGag}을 숫자나 행동으로 설명할 수 있습니까?`, "지금 복구하면 끝납니까, 표현 문제로 계속됩니까?"], closingStatements: "피의자는 마지막까지 ‘그렇게까지는’이라고 말했고 재판장은 ‘어디까지인지’를 다시 물었다." },
      judgment: { recognizedFacts: [`${subject} 관련 행위가 발생함`, "해명이 축소 방향으로 바뀜", "허용 범위도 사전에 완전히 수치화되지는 않음"], liabilityRatio: "피의자 75% · 피해자 25% 기준설명 미흡", order: `${subject}을 복구하고 다음 사용 전 완전한 문장으로 허락을 구한다.`, sentence: "변명에 접속사 ‘근데’를 7일간 사용하지 못한다.", reasoning: `재판부는 ${profile.runningGag}이 완벽히 정해지지 않았더라도 상대의 기대를 알았으면 확인할 의무가 있다고 판단했다.`, afterStory: profile.finalCallback }
    };
  }

  function record(label, title, copy, className = "") {
    return `<article class="record ${className}"><small>${esc(label)}</small>${title ? `<b>${esc(title)}</b>` : ""}<p>${esc(copy)}</p></article>`;
  }
  function list(items) { return `<ol class="list-block">${(items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`; }
  function beat(text) { return `<aside class="stage-punchline"><small>기록관 주석</small><p>${esc(text)}</p></aside>`; }

  function render(data) {
    state.data = data;
    $("#rail-number").textContent = state.number;
    $("#rail-title").textContent = data.title;
    $("#rail-charge").textContent = data.fictionalCharge;
    $("#case-number").textContent = state.number;
    $("#case-source").textContent = state.source === "gemini" ? "AI 코미디 사건기록" : "접수문 기반 코미디 기록";
    $("#case-subtitle").textContent = data.subtitle;
    $("#case-title").textContent = data.title;
    $("#case-summary").textContent = data.caseSummary;
    $("#case-charge").textContent = data.fictionalCharge;
    $("#case-incident").textContent = data.intake.complaint || state.incident;
    const profile = data.comicProfile || {};
    $(".case-cover").insertAdjacentHTML("beforeend", `<section class="comic-dna"><article><small>수사본부의 핵심 오해</small><p>${esc(profile.centralMisread)}</p></article><article><small>반복 쟁점</small><p>${esc(profile.runningGag)}</p></article><article><small>사건 확대 규칙</small><p>${esc(profile.escalationRule)}</p></article></section>`);

    $("#intake-content").innerHTML = `<div class="record-grid">${record("최초 신고", "피해자 접수 내용", data.intake.complaint, "full accent")}${record("피해자 최초 진술", "신고 취지", data.intake.complainantStatement)}${record("피의자 최초 입장", "초기 해명", data.intake.accusedInitialPosition)}${record("담당 배정", "사건 전담 조직", data.intake.assignedUnit, "full navy")}</div>${beat(data.comicBeats.intake)}`;
    $("#initial-content").innerHTML = `${record("현장 보존", "초동조치", data.initialInvestigation.sceneControl, "full accent")}<div class="record-grid">${record("현장 측정", "정밀 측정 항목", "수사팀은 사건에만 존재하는 측정 단위를 즉석에서 만들었다.", "navy")}${list(data.initialInvestigation.measurements)}${record("탐문", "참고인 확인", "참고인들은 사건보다 질문의 구체성에 더 당황했다.", "gold")}${list(data.initialInvestigation.witnessChecks)}</div><div class="evidence-table">${data.initialInvestigation.evidence.map((item) => `<article class="evidence-row"><h3>${esc(item.title)}</h3><div><p>${esc(item.detail)}</p><small>${esc(item.meaning)}</small></div></article>`).join("")}</div>${beat(data.comicBeats.initialInvestigation)}`;
    $("#over-content").innerHTML = `<div class="record-grid">${record("합동수사본부", "투입 조직", data.overInvestigation.taskForce, "full navy")}${record("잠복근무", "관찰 작전", data.overInvestigation.surveillance, "accent")}${record("가상 영장 집행", "압수수색", data.overInvestigation.searchAndSeizure, "gold")}</div><div class="record-grid">${data.overInvestigation.forensicReports.map((item) => `<article class="forensic-card"><span>국가과잉수사연구소 감정서</span><h3>${esc(item.target)}</h3><dl><dt>방법</dt><dd>${esc(item.method)}</dd><dt>결과</dt><dd>${esc(item.finding)}</dd><dt>굳이 내린 결론</dt><dd>${esc(item.unnecessaryConclusion)}</dd></dl></article>`).join("")}</div>${record("공개 브리핑", "수사본부 발표", data.overInvestigation.publicBriefing, "full accent")}${beat(data.comicBeats.overInvestigation)}`;
    $("#interrogation-content").innerHTML = `<div class="statement-pair"><article class="speaker-card accused"><h3>피의자 진술</h3><p>${esc(data.interrogation.accusedStatement)}</p></article><article class="speaker-card complainant"><h3>피해자 반박</h3><p>${esc(data.interrogation.complainantRebuttal)}</p></article></div><div class="record-grid">${record("참고인 진술", "현장 주변 진술", data.interrogation.witnessStatements.join(" / "), "full")}${record("진술 분석", "발견된 모순", "수사본부는 형용사 하나가 바뀐 것도 별도 쟁점으로 분류했다.", "accent")}${list(data.interrogation.contradictions)}</div>${beat(data.comicBeats.interrogation)}`;
    $("#referral-content").innerHTML = `<div class="record-grid">${record("수사결론", "최종 수사의견", data.referral.investigationConclusion, "full navy")}${record("적용 혐의", data.referral.fictionalCharge, data.referral.referralOpinion, "accent")}${record("가상 기소", "심사부 결정", data.referral.prosecutionDecision, "gold")}</div><div class="issue-chip-wrap">${data.referral.coreIssues.map((item) => `<span class="issue-chip">${esc(item)}</span>`).join("")}</div>${beat(data.comicBeats.referral)}`;
    $("#settlement-content").innerHTML = `<div class="settlement-flow"><article class="settlement-party"><small>피해자 요구안</small><h3>${esc(data.settlement.openingDemand)}</h3></article><div class="settlement-arrow">⇄</div><article class="settlement-party"><small>피의자 반대안</small><h3>${esc(data.settlement.counterOffer)}</h3></article></div><article class="mediator-box"><small>지친 조정위원의 권고</small><h3>${esc(data.settlement.mediatorRecommendation)}</h3></article><article class="settlement-result"><small>조정 결과</small><h3>${esc(data.settlement.result)}</h3><p>${esc(data.settlement.reason)}</p></article>${beat(data.comicBeats.settlement)}`;
    $("#trial-content").innerHTML = `<div class="argument-pair"><article class="speaker-card prosecution"><h3>검사 모두진술</h3><p>${esc(data.trial.prosecutionOpening)}</p></article><article class="speaker-card defense"><h3>변호인 모두진술</h3><p>${esc(data.trial.defenseOpening)}</p></article></div><div class="evidence-table">${data.trial.evidenceArguments.map((item) => `<article class="evidence-argument"><h3>${esc(item.evidence)}</h3><div><p><b>검사</b><br>${esc(item.prosecution)}</p><p><b>변호인</b><br>${esc(item.defense)}</p></div></article>`).join("")}</div><div class="record-grid">${data.trial.witnessExamination.map((item, index) => `<article class="transcript"><b>증인신문 ${index + 1}</b><p><strong>Q.</strong> ${esc(item.question)}</p><p><strong>A.</strong> ${esc(item.answer)}</p><small>${esc(item.courtReaction)}</small></article>`).join("")}</div>${data.trial.judgeQuestions.map((item) => `<blockquote class="judge-question">재판장: “${esc(item)}”</blockquote>`).join("")}<article class="record full navy"><small>최후진술</small><p>${esc(data.trial.closingStatements)}</p></article>${beat(data.comicBeats.trial)}`;
    $("#judgment-content").innerHTML = `<article class="judgment-box"><h3>${esc(data.title)} 판결문</h3><small>인정된 사실</small>${list(data.judgment.recognizedFacts)}<p><b>책임 비율</b><br>${esc(data.judgment.liabilityRatio)}</p><p class="judgment-order">${esc(data.judgment.order)}</p><p><b>부가 명령</b><br>${esc(data.judgment.sentence)}</p><p><b>판결 이유</b><br>${esc(data.judgment.reasoning)}</p></article>${beat(data.comicBeats.judgment)}<article class="after-story"><small>처음의 반복 개그가 돌아온 긴급속보</small><h3>${esc(data.judgment.afterStory)}</h3></article>`;
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
        headers: { "Content-Type": "application/json", "X-Sosoking-Client": "court-v7" },
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
    $(".comic-dna")?.remove();
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
      state.source = "local-comedy-fallback";
      state.data = localFallback(text);
    }
    clearInterval(state.timer);
    $("#loading-bar").style.width = "100%";
    $("#loading-percent").textContent = "100%";
    $("#loading-current").textContent = "반복 개그와 마지막 콜백까지 편철 완료";
    render(state.data);
    setTimeout(() => { show("story"); $("#header-new-case").hidden = false; updateReadingProgress(); }, 350);
  });

  $("#incident").addEventListener("input", (event) => { $("#char-count").textContent = event.target.value.length; $("#form-error").textContent = ""; });
  $$('[data-example]').forEach((button) => button.addEventListener("click", () => { $("#incident").value = button.dataset.example; $("#incident").dispatchEvent(new Event("input")); }));
  $("#header-new-case").addEventListener("click", reset);
  $("#new-case").addEventListener("click", reset);
  $("#share-case").addEventListener("click", async () => {
    const data = state.data;
    const text = `소문난 판결소\n${data.title}\n반복 쟁점: ${data.comicProfile.runningGag}\n${data.judgment.order}\n${data.judgment.afterStory}\n${state.number}`;
    try {
      if (navigator.share) await navigator.share({ title: "소문난 판결소", text });
      else await navigator.clipboard.writeText(text);
      $("#share-status").textContent = "판결과 마지막 콜백을 공유할 준비가 됐습니다.";
    } catch (error) {
      if (error.name !== "AbortError") $("#share-status").textContent = "공유하지 못했습니다.";
    }
  });
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
  show("intake");
})();