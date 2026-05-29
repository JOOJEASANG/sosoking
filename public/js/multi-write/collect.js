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

function getVoteOptions() {
  return [...document.querySelectorAll('.mw-vote-option')]
    .map(input => realValue(input))
    .filter(Boolean);
}

function getQuizOptions() {
  return [...document.querySelectorAll('.mw-quiz-option')].map(input => realValue(input));
}

export function parseYouTubeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';

    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (url.pathname.startsWith('/watch')) id = url.searchParams.get('v') || '';
      else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] || '';
      else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
    }

    id = String(id || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
    return {
      enabled: true,
      provider: 'youtube',
      videoId: id,
      url: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
    };
  } catch {
    return null;
  }
}

function collectKindLabel(kind) {
  return { youtube: '유튜브', image: '웃긴그림' }[kind] || '모음';
}

export function collectMultiModules() {
  const modules = { comments: { enabled: true } };
  const bodyText = getBodyText();
  const titleText = getTitleText();

  if (isAnonymousWriteChecked()) {
    modules.anonymous = { enabled: true, mode: 'general-option' };
  }

  if (enabled('collect')) {
    const urlRaw = realValue(document.getElementById('mw-collect-url'));
    const youtube = parseYouTubeUrl(urlRaw);
    if (urlRaw && !youtube) throw new Error('유튜브 링크 형식이 올바르지 않습니다. 쇼츠, 공유 링크, watch 링크를 사용할 수 있어요.');
    const kind = youtube ? 'youtube' : 'image';
    const caption = realValue(document.getElementById('mw-collect-caption')) || bodyText;
    const collect = { enabled: true, kind, label: collectKindLabel(kind), caption };

    if (youtube) {
      collect.url = youtube.url;
      collect.youtube = youtube;
      modules.youtube = youtube;
    }

    modules.collect = collect;
  }

  if (enabled('vote')) {
    const options = getVoteOptions();
    const voteMode = document.getElementById('mw-vote-mode')?.value || 'general';
    const question = bodyText || titleText;
    if (!question) throw new Error('토론 주제를 입력해주세요.');
    if (options.length < 2) throw new Error('선택지를 2개 이상 입력해주세요.');
    const voteData = { enabled: true, question, options: options.map(text => ({ text, votes: 0 })) };
    if (voteMode !== 'general') voteData.voteMode = voteMode;
    modules.vote = voteData;
  }

  if (enabled('drip')) {
    if (!bodyText) throw new Error('드립 주제를 입력해주세요.');
    modules.drip = { enabled: true, prompt: bodyText.slice(0, 80), maxLength: 50, responseLabel: '한 줄 드립' };
  }

  if (enabled('quiz')) {
    const mode = document.getElementById('mw-quiz-mode')?.value || 'subjective';
    const noAnswer = document.getElementById('mw-quiz-no-answer')?.checked === true;
    const hint = realValue(document.getElementById('mw-quiz-hint'));
    const explanation = realValue(document.getElementById('mw-quiz-explanation'));
    if (!bodyText) throw new Error('내용에 퀴즈 문제를 입력해주세요.');

    if (mode === 'multiple') {
      const rawOptions = getQuizOptions();
      const options = rawOptions.filter(Boolean);
      const correctRawIndex = Number(document.querySelector('input[name="mw-quiz-correct"]:checked')?.value || 0);
      const correctAnswer = rawOptions[correctRawIndex] || '';
      const correctIndex = options.indexOf(correctAnswer);
      const answer = correctAnswer;
      if (options.length < 2) throw new Error('객관식 선택지를 2개 이상 입력해주세요.');
      if (!noAnswer && !answer.trim()) throw new Error('정답으로 선택한 객관식 선택지를 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'multiple', noAnswer, question: bodyText, options: options.map(text => ({ text })), answer: noAnswer ? '' : answer, correctIndex: noAnswer ? null : correctIndex, hint, explanation };
    } else {
      const answer = realValue(document.getElementById('mw-quiz-answer'));
      if (!noAnswer && !answer) throw new Error('정답을 입력해주세요. 정답이 없으면 정답 없는 퀴즈를 체크해주세요.');
      modules.quiz = { enabled: true, mode: 'subjective', noAnswer, question: bodyText, answer: noAnswer ? '' : answer, hint, explanation };
    }
  }

  return modules;
}
