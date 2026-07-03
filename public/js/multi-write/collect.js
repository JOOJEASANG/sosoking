export function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(t => t.replace('#', '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function htmlToPlainText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

function isGhost(el) {
  return el?.dataset?.templateGhost === '1';
}

function realValue(el) {
  if (!el || isGhost(el)) return '';
  return el.value?.trim?.() || '';
}

export function getBodyText() {
  const desc = document.getElementById('mw-desc');
  if (isGhost(desc) || document.getElementById('mw-rich-editor')?.dataset.templateGhost === '1') return '';
  return desc?.dataset.plainText || htmlToPlainText(desc?.value || '') || desc?.value.trim() || '';
}

export function getBodyHtml() {
  const desc = document.getElementById('mw-desc');
  if (isGhost(desc) || document.getElementById('mw-rich-editor')?.dataset.templateGhost === '1') return '';
  return desc?.value.trim() || '';
}

export function isAnonymousWriteChecked() {
  return !!document.getElementById('mw-anonymous-toggle')?.checked;
}

function enabled(key) {
  return !!document.querySelector(`[data-module-toggle="${key}"]`);
}

function getTitleText() {
  return realValue(document.getElementById('mw-title'));
}

function getVoteOptions(panelKey) {
  return [...document.querySelectorAll(`[data-option-panel="${panelKey}"] .mw-vote-option`)]
    .map(input => realValue(input))
    .filter(Boolean);
}

function optionLabel(map, key, fallback) {
  return map[key] || fallback || key || '';
}

function buildVoteModule({ panelKey, question, mode }) {
  const options = getVoteOptions(panelKey);
  if (!question) throw new Error(panelKey === 'judgment' ? '판결받을 사건 내용을 입력해주세요.' : '토론 주제를 입력해주세요.');
  if (options.length < 2) throw new Error(panelKey === 'judgment' ? '판결 선택지를 확인해주세요.' : '찬성/반대 선택지를 확인해주세요.');
  return {
    enabled: true,
    voteMode: mode,
    question,
    options: options.map(text => ({ text, votes: 0 })),
  };
}

export function collectMultiModules() {
  const modules = { comments: { enabled: true } };
  const bodyText = getBodyText();
  const titleText = getTitleText();

  if (isAnonymousWriteChecked()) {
    modules.anonymous = { enabled: true, mode: 'general-option' };
  }

  if (enabled('judgment')) {
    modules.vote = buildVoteModule({ panelKey: 'judgment', question: bodyText || titleText, mode: 'judgment' });
  }

  if (enabled('vote')) {
    modules.vote = buildVoteModule({ panelKey: 'vote', question: bodyText || titleText, mode: 'pros_cons' });
  }

  if (enabled('consult')) {
    if (!bodyText) throw new Error('상담 내용을 입력해주세요.');
    const topic = realValue(document.getElementById('mw-consult-topic')) || 'daily';
    const style = realValue(document.getElementById('mw-consult-style')) || 'funny';
    modules.consult = {
      enabled: true,
      topic,
      topicLabel: optionLabel({
        daily: '일상', people: '관계', work: '직장/학교', money: '소비/선택', vent: '하소연',
      }, topic, '일상'),
      style,
      styleLabel: optionLabel({
        empathy: '공감', realistic: '현실조언', choice: '선택도움', soft: '순한맛', funny: '웃긴해결',
      }, style, '웃긴해결'),
      question: bodyText,
    };
  }

  if (enabled('drip')) {
    const prompt = bodyText || titleText;
    if (!prompt) throw new Error('드립 주제를 입력해주세요.');
    modules.drip = {
      enabled: true,
      prompt,
      maxLength: 50,
      responseLabel: '한 줄 드립',
    };
  }

  return modules;
}
