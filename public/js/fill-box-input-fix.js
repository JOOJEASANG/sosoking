function fillGroups() {
  const groups = [...document.querySelectorAll('[data-fill-group]')];
  if (groups.length) {
    return groups.map(group => [...group.querySelectorAll('.multi-fill-char')]);
  }
  const boxes = [...document.querySelectorAll('.multi-fill-char')];
  return boxes.length ? [boxes] : [];
}

function syncFillAnswer() {
  const hidden = document.getElementById('multi-fill-answer');
  const groups = fillGroups();
  if (!hidden || !groups.length) return;
  const answers = groups
    .map((boxes, index) => ({ index, text: boxes.map(input => input.value.trim()).join('') }))
    .filter(item => item.text);
  hidden.value = answers.length > 1
    ? answers.map(item => `빈칸 ${item.index + 1}: ${item.text}`).join(' / ')
    : (answers[0]?.text || '');
}

function focusNextBox(allBoxes, idx) {
  allBoxes[idx + 1]?.focus();
}

function focusPrevBox(allBoxes, idx) {
  allBoxes[idx - 1]?.focus();
}

function bindFillBoxes() {
  const groups = fillGroups();
  const boxes = groups.flat();
  if (!boxes.length) return;

  boxes.forEach((input, idx) => {
    if (input.dataset.fillBoxReady === '1') return;
    input.dataset.fillBoxReady = '1';
    input.addEventListener('input', () => {
      const value = input.value || '';
      if ([...value].length > 1) input.value = [...value].slice(-1).join('');
      if (input.value) focusNextBox(boxes, idx);
      syncFillAnswer();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value) focusPrevBox(boxes, idx);
      if (event.key === 'Enter') {
        event.preventDefault();
        syncFillAnswer();
        document.getElementById('multi-fill-submit')?.click();
      }
    });
    input.addEventListener('paste', event => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text') || '';
      [...text].slice(0, boxes.length - idx).forEach((ch, offset) => { boxes[idx + offset].value = ch; });
      syncFillAnswer();
      boxes[Math.min(boxes.length - 1, idx + [...text].length)]?.focus();
    });
  });

  const submit = document.getElementById('multi-fill-submit');
  if (submit && submit.dataset.fillSubmitReady !== '1') {
    submit.dataset.fillSubmitReady = '1';
    submit.addEventListener('click', syncFillAnswer, true);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(bindFillBoxes, 80);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
