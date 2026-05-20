export function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(t => t.replace('#', '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function getBodyText() {
  return document.getElementById('mw-desc')?.value.trim() || '';
}

function enabled(key) {
  return !!document.querySelector(`[data-module-toggle="${key}"]`);
}

function getVoteOptions() {
  return [...document.querySelectorAll('.mw-vote-option')]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function getQuizOptions() {
  return [...document.querySelectorAll('.mw-quiz-option')].map(input => input.value.trim());
}

function getFillCounts() {
  const raw = document.getElementById('mw-fill-counts')?.value || document.getElementById('mw-fill-count')?.value || '4';
  const counts = String(raw)
    .split(',')
    .map(v => Math.max(1, Math.min(12, Number(v.trim()) || 0)))
    .filter(Boolean)
    .slice(0, 6);
  return counts.length ? counts : [4];
}

function countBodyBlanks(bodyText) {
  const matches = String(bodyText || '').match(/_{2,}|□+/g);
  return matches ? matches.length : 0;
}

export function collectMultiModules() {
  const modules = { comments: { enabled: true } };
  const bodyText = getBodyText();

  if (enabled('vote')) {
    const options = getVoteOptions();
    if (!bodyText) throw new Error('본문에 투표/판정 질문이나 상황을 입력해주세요.');
    if (options.length < 2) throw new Error('투표 선택지를 2개 이상 입력해주세요.');
    modules.vote = { enabled: true, question: bodyText, options: options.map(text => ({ text, votes: 0 })) };
  }

  if (enabled('fill')) {
    if (!bodyText) throw new Error('본문에 빈칸 채우기 문장을 입력해주세요.');
    const blankCount = countBodyBlanks(bodyText);
    const counts = getFillCounts();
    const normalizedCounts = blankCount > 0
      ? Array.from({ length: blankCount }, (_, i) => counts[i] || counts[counts.length - 1] || 4)
      : counts;
    modules.fill = {
      enabled: true,
      prompt: bodyText,
      blankCounts: normalizedCounts,
      blanks: normalizedCounts.map((count, index) => ({ index, charCount: count })),
      charCount: normalizedCounts[0] || 4,
      blankCount: normalizedCounts[0] || 4,
    };
  }

  if (enabled('naming')) {
    modules.naming = { enabled: true, charCount: Number(document.getElementById('mw-naming-count')?.value || 0) };
  }

  if (enabled('acrostic')) {
    const keyword = document.getElementById('mw-acrostic-keyword')?.value.trim() || '';
    if ([...keyword].length < 2) throw new Error('삼행시 제시어는 2글자 이상 입력해주세요.');
    modules.acrostic = { enabled: true, keyword };
  }

  if (enabled('relay')) {
    if (!bodyText) throw new Error('본문에 릴레이 시작 문장이나 상황을 입력해주세요.');
    modules.relay = { enabled: true, startSentence: bodyText };
  }

  if (enabled('quiz')) {
    const mode = document.getElementById('mw-quiz-mode')?.value || 'subjective';
    if (!bodyText) throw new Error('본문에 미친퀴즈 문제를 입력해주세요.');

    if (mode === 'multiple') {
      const rawOptions = getQuizOptions();
      const options = rawOptions.filter(Boolean);
      const correctIndex = Number(document.querySelector('input[name="mw-quiz-correct"]:checked')?.value || 0);
      const answer = rawOptions[correctIndex] || '';
      if (options.length < 2) throw new Error('객관식 선택지를 2개 이상 입력해주세요.');
      if (!answer.trim()) throw new Error('정답으로 선택한 객관식 선택지를 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'multiple', question: bodyText, options: options.map(text => ({ text })), answer };
    } else {
      const answer = document.getElementById('mw-quiz-answer')?.value.trim() || '';
      if (!answer) throw new Error('정답을 입력해주세요.');
      modules.quiz = { enabled: true, mode: 'subjective', question: bodyText, answer };
    }
  }

  if (enabled('anonymous')) {
    if (!bodyText) throw new Error('본문에 익명비밀글 내용을 입력해주세요.');
    modules.anonymous = { enabled: true };
  }

  return modules;
}
