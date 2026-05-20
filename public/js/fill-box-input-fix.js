function syncFillAnswer() {
  const hidden = document.getElementById('multi-fill-answer');
  const boxes = [...document.querySelectorAll('.multi-fill-char')];
  if (!hidden || !boxes.length) return;
  hidden.value = boxes.map(input => input.value.trim()).join('');
}

function bindFillBoxes() {
  const boxes = [...document.querySelectorAll('.multi-fill-char')];
  if (!boxes.length) return;
  boxes.forEach((input, idx) => {
    if (input.dataset.fillBoxReady === '1') return;
    input.dataset.fillBoxReady = '1';
    input.addEventListener('input', () => {
      const value = input.value || '';
      if ([...value].length > 1) input.value = [...value].slice(-1).join('');
      if (input.value && boxes[idx + 1]) boxes[idx + 1].focus();
      syncFillAnswer();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value && boxes[idx - 1]) boxes[idx - 1].focus();
      if (event.key === 'Enter') {
        event.preventDefault();
        syncFillAnswer();
        document.getElementById('multi-fill-submit')?.click();
      }
    });
    input.addEventListener('paste', event => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text') || '';
      [...text].slice(0, boxes.length - idx).forEach((ch, offset) => {
        boxes[idx + offset].value = ch;
      });
      syncFillAnswer();
      const next = boxes[Math.min(boxes.length - 1, idx + [...text].length)];
      next?.focus();
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
