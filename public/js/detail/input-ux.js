export function setupRelayCounter() {
  document.getElementById('comment-input')?.addEventListener('input', function () {
    const counter = document.getElementById('relay-char-count');
    if (counter) counter.textContent = `${this.value.length} / 150`;
  });
}

export function setupCharBoxInput() {
  const freeInput = document.getElementById('free-naming-input');
  if (freeInput) {
    freeInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') document.getElementById('btn-char-submit')?.click();
    });
    return;
  }

  const boxes = [...document.querySelectorAll('.char-box')];
  boxes.forEach((box, index) => bindCharBox(box, index, boxes));
}

function bindCharBox(box, index, boxes) {
  let composing = false;

  box.addEventListener('compositionstart', () => { composing = true; });
  box.addEventListener('compositionend', () => {
    composing = false;
    trimCharBox(box);
    focusNextIfReady(box, index, boxes);
  });
  box.addEventListener('input', () => {
    if (composing) return;
    trimCharBox(box);
    focusNextIfReady(box, index, boxes);
  });
  box.addEventListener('keydown', event => handleCharBoxKeydown(event, box, index, boxes));
  box.addEventListener('paste', event => handleCharBoxPaste(event, index, boxes));
}

function trimCharBox(box) {
  if ([...box.value].length > 1) box.value = [...box.value].slice(-1).join('');
}

function focusNextIfReady(box, index, boxes) {
  if (box.value && index < boxes.length - 1) boxes[index + 1].focus();
}

function handleCharBoxKeydown(event, box, index, boxes) {
  if (event.key === 'Backspace' && !box.value && index > 0) {
    event.preventDefault();
    boxes[index - 1].value = '';
    boxes[index - 1].focus();
  }
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault();
    boxes[index - 1].focus();
  }
  if (event.key === 'ArrowRight' && index < boxes.length - 1) {
    event.preventDefault();
    boxes[index + 1].focus();
  }
  if (event.key === 'Enter') document.getElementById('btn-char-submit')?.click();
}

function handleCharBoxPaste(event, index, boxes) {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData('text');
  const chars = [...text].slice(0, boxes.length - index);
  chars.forEach((char, offset) => {
    if (boxes[index + offset]) boxes[index + offset].value = char;
  });
  boxes[Math.min(index + chars.length, boxes.length - 1)]?.focus();
}
