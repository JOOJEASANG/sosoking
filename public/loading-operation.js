(() => {
  "use strict";

  const form = document.querySelector("#case-form");
  if (!form) return;

  const steps = [
    ["신고 내용을 대형 사건으로 오해하는 중", "접수된 한 문장을 상황판 세 칸으로 확대했습니다."],
    ["초동출동팀 18명 호출", "현장 반경 80cm에 통제선을 설치하고 있습니다."],
    ["잠복팀 위장복 선정", "배달을 기다리는 사람과 식탁보 중 최종 검토 중입니다."],
    ["국가과잉수사연구소 감식 의뢰", "부스러기와 현장 공기에 증거번호를 부여했습니다."],
    ["압수봉투와 거의 영장 확보", "관련성 낮은 물건까지 일단 봉투에 넣고 있습니다."],
    ["브리핑 마이크 7개 배치", "기자는 아직 없지만 질문 예상답변은 완성됐습니다."],
    ["재판부의 쓸데없는 엄숙함 충전", "판결 뒤 더 유치한 후속 사건을 준비하고 있습니다."]
  ];

  const overlay = document.createElement("section");
  overlay.className = "operation-loading";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="operation-loading__panel">
      <div class="operation-loading__head">
        <span class="operation-loading__seal" aria-hidden="true">소</span>
        <div><small>생활질서 특별수사본부</small><strong>사건기록 작성 중</strong></div>
        <span class="operation-loading__live"><i></i> LIVE</span>
      </div>
      <p class="operation-loading__eyebrow">수사 필요성 3% · 행정력 투입 97%</p>
      <h2>사건을 필요 이상으로<br>키우고 있습니다.</h2>
      <ol>${steps.map(([title], index) => `<li data-loading-step="${index}"><span>${String(index + 1).padStart(2, "0")}</span><b>${title}</b></li>`).join("")}</ol>
      <div class="operation-loading__report">
        <span>현재 작전</span>
        <strong data-loading-title>${steps[0][0]}</strong>
        <p data-loading-detail>${steps[0][1]}</p>
      </div>
      <div class="operation-loading__progress"><b data-loading-progress></b></div>
      <small class="operation-loading__foot">평균 15~20초가 걸립니다. 기다리는 동안 수사본부는 쓸데없이 바쁩니다.</small>
    </div>`;
  document.body.append(overlay);

  const title = overlay.querySelector("[data-loading-title]");
  const detail = overlay.querySelector("[data-loading-detail]");
  const progress = overlay.querySelector("[data-loading-progress]");
  const items = [...overlay.querySelectorAll("[data-loading-step]")];
  let timer = null;
  let current = 0;

  function paint(index) {
    current = Math.min(index, steps.length - 1);
    items.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === current);
      item.classList.toggle("is-done", itemIndex < current);
    });
    title.textContent = steps[current][0];
    detail.textContent = steps[current][1];
    progress.style.width = `${Math.round(((current + 1) / steps.length) * 100)}%`;
  }

  function show() {
    if (!overlay.hidden) return;
    current = 0;
    paint(0);
    overlay.hidden = false;
    document.body.classList.add("is-building-case");
    timer = window.setInterval(() => paint(current + 1), 2300);
  }

  function hide() {
    window.clearInterval(timer);
    timer = null;
    overlay.classList.add("is-leaving");
    window.setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("is-leaving");
      document.body.classList.remove("is-building-case");
    }, 260);
  }

  new MutationObserver(() => {
    if (form.getAttribute("aria-busy") === "true") show();
    else if (!overlay.hidden) hide();
  }).observe(form, { attributes: true, attributeFilter: ["aria-busy"] });

  form.addEventListener("submit", () => {
    queueMicrotask(() => {
      if (form.getAttribute("aria-busy") === "true") show();
    });
  });
})();
