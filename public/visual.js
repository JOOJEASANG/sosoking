(() => {
  "use strict";

  const stageContent = document.querySelector("#stage-content");
  if (!stageContent) return;

  function icon(name, className = "ui-icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="./icons.svg#${name}"></use></svg>`;
  }

  function mark(element) {
    element.dataset.visualDecorated = "true";
  }

  function decorateCards(root) {
    const factIcons = ["charge", "damage", "agency"];
    root.querySelectorAll(".fact-card:not([data-visual-decorated])").forEach((card, index) => {
      card.insertAdjacentHTML("afterbegin", `<span class="card-icon card-icon--fact">${icon(factIcons[index] || "file")}</span>`);
      mark(card);
    });

    root.querySelectorAll(".evidence-card:not([data-visual-decorated])").forEach((card) => {
      card.insertAdjacentHTML("afterbegin", `<span class="card-icon card-icon--evidence">${icon("evidence")}</span>`);
      mark(card);
    });

    root.querySelectorAll(".verdict-card:not([data-visual-decorated])").forEach((card) => {
      card.insertAdjacentHTML("afterbegin", `<span class="card-icon card-icon--verdict">${icon("verdict")}</span>`);
      mark(card);
    });
  }

  function decorateQuestions(root) {
    root.querySelectorAll(".question-button:not([data-visual-decorated])").forEach((button) => {
      const first = button.querySelector("span");
      if (first) first.insertAdjacentHTML("afterbegin", icon("question", "ui-icon question-icon"));
      mark(button);
    });
  }

  function decorateCounsel(root) {
    root.querySelectorAll(".counsel-card:not([data-visual-decorated])").forEach((card) => {
      const heading = card.querySelector("h3");
      if (heading) {
        const name = card.classList.contains("prosecution") ? "prosecutor" : "defense";
        heading.insertAdjacentHTML("afterbegin", `<span class="role-medallion">${icon(name)}</span>`);
      }
      mark(card);
    });
  }

  function roleIcon(label) {
    if (label.includes("검사")) return "prosecutor";
    if (label.includes("변호")) return "defense";
    if (label.includes("판사") || label.includes("재판")) return "judge";
    if (label.includes("피고") || label.includes("용의")) return "witness";
    return "question";
  }

  function decorateDialogue(root) {
    root.querySelectorAll(".speech:not([data-visual-decorated])").forEach((speech) => {
      const label = speech.querySelector("b");
      if (label) {
        label.insertAdjacentHTML("afterbegin", `<span class="speech-avatar">${icon(roleIcon(label.textContent || ""))}</span>`);
      }
      mark(speech);
    });
  }

  function decorateNotices(root) {
    root.querySelectorAll(".judge-line:not([data-visual-decorated])").forEach((notice) => {
      notice.insertAdjacentHTML("afterbegin", `<span class="notice-icon">${icon("judge")}</span>`);
      mark(notice);
    });

    root.querySelectorAll(".result-banner:not([data-visual-decorated])").forEach((result) => {
      result.insertAdjacentHTML("afterbegin", `<span class="result-seal">${icon("gavel")}</span>`);
      mark(result);
    });

    root.querySelectorAll(".after-story:not([data-visual-decorated])").forEach((story) => {
      const heading = story.querySelector("h3");
      if (heading) heading.insertAdjacentHTML("afterbegin", icon("megaphone", "ui-icon after-icon"));
      mark(story);
    });
  }

  function decorate(root = stageContent) {
    decorateCards(root);
    decorateQuestions(root);
    decorateCounsel(root);
    decorateDialogue(root);
    decorateNotices(root);
  }

  const observer = new MutationObserver(() => decorate());
  observer.observe(stageContent, { childList: true, subtree: true });
  decorate();
})();