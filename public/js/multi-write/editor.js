const SIZE_MAP = {
  small: '13px',
  normal: '15px',
  large: '19px',
};

function stripDangerous(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function plainTextFromHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = stripDangerous(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

export function sanitizeRichHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = stripDangerous(html);
  const allowed = new Set(['B', 'STRONG', 'BR', 'DIV', 'P', 'SPAN', 'FONT']);

  function clean(node) {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      clean(child);
      if (!allowed.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }
      const textAlign = child.style?.textAlign || '';
      const fontSize = child.style?.fontSize || '';
      const fontTagSize = child.getAttribute('size') || '';
      [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
      if (['left', 'center', 'right'].includes(textAlign)) child.style.textAlign = textAlign;
      if (/^(13|15|19)px$/.test(fontSize)) child.style.fontSize = fontSize;
      if (child.tagName === 'FONT') {
        const span = document.createElement('span');
        span.style.fontSize = fontTagSize === '2' ? SIZE_MAP.small : fontTagSize === '5' ? SIZE_MAP.large : SIZE_MAP.normal;
        span.innerHTML = child.innerHTML;
        child.replaceWith(span);
      }
    });
  }

  clean(tpl.content);
  return tpl.innerHTML
    .replace(/<div><br><\/div>/g, '<br>')
    .replace(/(<br>\s*){4,}/g, '<br><br><br>')
    .trim()
    .slice(0, 2000);
}

function syncTextarea(textarea, editor) {
  const html = sanitizeRichHtml(editor.innerHTML);
  textarea.value = html;
  textarea.dataset.plainText = plainTextFromHtml(html);
}

function exec(command, value = null) {
  document.execCommand(command, false, value);
}

export function initRichEditor() {
  const textarea = document.getElementById('mw-desc');
  if (!textarea || document.getElementById('mw-rich-editor')) return;

  textarea.classList.add('mw-desc-hidden');
  const wrapper = document.createElement('div');
  wrapper.className = 'mw-editor-wrap';
  wrapper.innerHTML = `
    <div class="mw-editor-toolbar" role="toolbar" aria-label="본문 편집 도구">
      <button type="button" data-editor-cmd="bold"><b>B</b></button>
      <button type="button" data-editor-align="left">왼쪽</button>
      <button type="button" data-editor-align="center">가운데</button>
      <button type="button" data-editor-align="right">오른쪽</button>
      <button type="button" data-editor-size="small">작게</button>
      <button type="button" data-editor-size="normal">보통</button>
      <button type="button" data-editor-size="large">크게</button>
      <button type="button" data-editor-youtube>유튜브</button>
    </div>
    <div id="mw-rich-editor" class="mw-rich-editor" contenteditable="true" data-placeholder="${textarea.getAttribute('placeholder') || '본문을 입력하세요'}"></div>
  `;
  textarea.insertAdjacentElement('afterend', wrapper);
  const editor = wrapper.querySelector('#mw-rich-editor');
  editor.innerHTML = textarea.value || '';
  syncTextarea(textarea, editor);

  wrapper.querySelector('[data-editor-cmd="bold"]')?.addEventListener('click', () => {
    editor.focus();
    exec('bold');
    syncTextarea(textarea, editor);
  });

  wrapper.querySelectorAll('[data-editor-align]').forEach(btn => btn.addEventListener('click', () => {
    editor.focus();
    const align = btn.dataset.editorAlign;
    exec(align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : 'justifyLeft');
    syncTextarea(textarea, editor);
  }));

  wrapper.querySelectorAll('[data-editor-size]').forEach(btn => btn.addEventListener('click', () => {
    editor.focus();
    const size = btn.dataset.editorSize === 'small' ? '2' : btn.dataset.editorSize === 'large' ? '5' : '3';
    exec('fontSize', size);
    syncTextarea(textarea, editor);
  }));

  wrapper.querySelector('[data-editor-youtube]')?.addEventListener('click', () => {
    const input = document.getElementById('mw-youtube-url');
    const current = input?.value || '';
    const url = window.prompt('유튜브 링크를 입력해주세요.', current);
    if (url === null) return;
    if (input) {
      input.value = url.trim();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }
  });

  editor.addEventListener('input', () => syncTextarea(textarea, editor));
  editor.addEventListener('blur', () => {
    editor.innerHTML = sanitizeRichHtml(editor.innerHTML);
    syncTextarea(textarea, editor);
  });
  editor.addEventListener('paste', event => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    exec('insertText', text.slice(0, 2000));
    syncTextarea(textarea, editor);
  });
}

export function syncRichEditor() {
  const textarea = document.getElementById('mw-desc');
  const editor = document.getElementById('mw-rich-editor');
  if (textarea && editor) syncTextarea(textarea, editor);
}

export function getRichPlainText() {
  const textarea = document.getElementById('mw-desc');
  return textarea?.dataset.plainText || plainTextFromHtml(textarea?.value || '');
}
