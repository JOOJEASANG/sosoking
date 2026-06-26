// debate-comment-choice-sync.js — 댓글 입장을 위의 A/B 투표 선택과 자동 동기화합니다.

const STYLE_ID = 'debate-comment-choice-sync-style';
const NOTE_CLASS = 'debate-comment-choice-note';
let syncScheduled = false;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #debate-comment-side{display:none!important}
    .${NOTE_CLASS}{display:flex;align-items:center;min-height:38px;border-radius:12px;padding:9px 12px;background:rgba(224,93,68,.08);color:var(--color-text-secondary);font-size:12px;font-weight:800;line-height:1.5}
    .${NOTE_CLASS}[data-ready="true"]{color:#c84431}
  `;
  document.head.appendChild(style);
}

function selectedVote() {
  const selected = document.querySelector('.debate-vote button.active[data-vote]');
  return selected?.dataset.vote === 'agree' || selected?.dataset.vote === 'disagree'
    ? selected.dataset.vote
    : '';
}

function setIfChanged(element, property, value) {
  if (element[property] !== value) element[property] = value;
}

function syncCommentChoice() {
  const form = document.querySelector('.debate-form');
  const sideSelect = document.getElementById('debate-comment-side');
  const textarea = document.getElementById('debate-comment-text');
  const submit = document.getElementById('debate-comment-submit');
  if (!form || !sideSelect || !textarea || !submit) return;

  let note = form.querySelector(`.${NOTE_CLASS}`);
  if (!note) {
    note = document.createElement('div');
    note.className = NOTE_CLASS;
    form.insertBefore(note, textarea);
  }

  const vote = selectedVote();
  const ready = Boolean(vote);
  const readyValue = ready ? 'true' : 'false';
  const message = ready
    ? `현재 선택한 ${vote === 'agree' ? 'A' : 'B'} 의견으로 댓글이 등록됩니다.`
    : '댓글을 작성하려면 먼저 위에서 A 또는 B를 선택해주세요.';
  const placeholder = ready
    ? `선택한 ${vote === 'agree' ? 'A' : 'B'} 의견에 대한 이유를 적어주세요.`
    : '먼저 A 또는 B를 선택해주세요.';

  setIfChanged(sideSelect, 'value', ready ? vote : 'neutral');
  if (sideSelect.getAttribute('aria-hidden') !== 'true') sideSelect.setAttribute('aria-hidden', 'true');
  setIfChanged(textarea, 'disabled', !ready);
  setIfChanged(submit, 'disabled', !ready);
  if (note.dataset.ready !== readyValue) note.dataset.ready = readyValue;
  setIfChanged(note, 'textContent', message);
  setIfChanged(textarea, 'placeholder', placeholder);
}

function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(() => {
    syncScheduled = false;
    syncCommentChoice();
  });
}

ensureStyle();
syncCommentChoice();

const observer = new MutationObserver(scheduleSync);
observer.observe(document.body, { childList: true, subtree: true });
