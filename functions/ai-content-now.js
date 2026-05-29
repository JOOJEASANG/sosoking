function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function list(value, fallback = [], max = 8) {
  const arr = Array.isArray(value) ? value : fallback;
  return arr.map(v => clean(typeof v === 'string' ? v : v?.text || v?.label || '', 90)).filter(Boolean).slice(0, max);
}

function parseJson(raw) {
  const text = String(raw || '').trim().replace(/```json|```/g, '').trim();
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('AI 응답 JSON 파싱 실패');
}

function typeMeta(preset) {
  return {
    collect: { subtype: 'collect', feedType: 'collect', typeLabel: '모음방' },
    vote: { subtype: 'vote', feedType: 'vote', typeLabel: '토론방' },
    quiz: { subtype: 'quiz', feedType: 'quiz', typeLabel: '퀴즈방' },
    drip: { subtype: 'drip', feedType: 'drip', typeLabel: '드립방' },
  }[preset] || { subtype: 'collect', feedType: 'collect', typeLabel: '모음방' };
}

function fallbackDraft(preset) {
  const base = {
    title: '잠깐 보고 가는 소소한 모음',
    desc: '가볍게 보고 댓글로 한마디 남기기 좋은 짧은 콘텐츠입니다.',
    tags: ['소소킹', '짧은모음', '유머'],
  };
  const map = {
    collect: {
      title: '오늘 저장각 웃긴 쇼츠 모음',
      desc: '짧게 보고 피식하기 좋은 유튜브 모음입니다.',
      collectKind: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      tags: ['유튜브', '쇼츠', '웃긴영상'],
    },
    vote: {
      title: '친구 사이 이 상황 가능?',
      desc: '둘 중 뭐가 더 이해되는지 골라주세요.',
      options: ['가능하다', '불가능하다', '상황 따라 다르다'],
      tags: ['토론방', '선택지', '공감'],
    },
    quiz: {
      title: '눈치 빠른 사람만 맞히는 퀴즈',
      desc: '다음 상황에서 가장 그럴듯한 정답은 무엇일까요?',
      options: ['첫 번째 선택지', '두 번째 선택지', '세 번째 선택지', '네 번째 선택지'],
      answer: '두 번째 선택지',
      correctIndex: 1,
      explanation: '상황 흐름상 두 번째가 가장 자연스럽습니다.',
      hint: '문장을 천천히 읽어보세요.',
      tags: ['퀴즈방', '문제', '정답'],
    },
    drip: {
      title: '오늘의 한줄',
      desc: '월요일 아침 내 표정은 이미 퇴근했다',
      tags: ['드립방', '오늘의한줄', '짧은웃음'],
    },
  };
  return { ...base, ...(map[preset] || {}) };
}

function promptFor(preset) {
  const meta = typeMeta(preset);
  return `소소킹 관리자용 AI 콘텐츠 데이터를 만드세요.

소소킹 현재 구조:
- 모음방: 유튜브 쇼츠/영상, 웃긴그림, 링크를 짧게 모아보는 방
- 토론방: 제목, 짧은 상황 설명, 일반 선택지로 의견을 모으는 방
- 퀴즈방: 주관식 또는 객관식 퀴즈를 올리는 방
- 드립방: 제목/본문 없이 오늘의 한줄만 올리는 방

현재 생성 유형: ${meta.typeLabel}

공통 조건:
- 한국어
- 짧고 가볍고 웃기거나 공감되는 톤
- 민감한 정치, 혐오, 성적 내용, 불법 내용, 실명 비방 금지
- 반드시 JSON만 출력

필수 JSON 스키마:
{
  "title": "제목 또는 오늘의 한줄 제목",
  "desc": "본문 또는 오늘의 한줄",
  "tags": ["태그1", "태그2", "태그3"],
  "collectKind": "youtube|image|link",
  "url": "유튜브 또는 링크 URL, 없으면 빈 문자열",
  "options": ["선택지1", "선택지2", "선택지3"],
  "quizMode": "subjective|multiple",
  "answer": "퀴즈 정답",
  "correctIndex": 0,
  "hint": "퀴즈 힌트",
  "explanation": "퀴즈 해설"
}

유형별 지시:
- 모음방: title은 40자 이내. desc는 80자 이내 한줄 설명. collectKind는 youtube, image, link 중 하나. url은 실제 접속 가능한 예시 URL이 아니어도 빈 문자열로 둬도 됩니다.
- 토론방: title은 질문형. desc는 상황 설명 100자 이내. options는 일반 선택지 2~4개. 찬성/반대, 밸런스 고정 표현은 쓰지 말고 자연스러운 선택지로 작성.
- 퀴즈방: title과 desc는 문제 형태. quizMode는 multiple 권장. options 2~4개, correctIndex, answer, hint, explanation 필수.
- 드립방: title은 반드시 "오늘의 한줄". desc는 80자 이내 한 줄 드립 하나만 작성.

현재 유형 ${preset}에 맞게 만들어주세요.`;
}

function youtubeData(url) {
  const raw = clean(url, 300);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname.startsWith('/watch')) id = parsed.searchParams.get('v') || '';
      else if (parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.split('/')[2] || '';
      else if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.split('/')[2] || '';
    }
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

function buildPost({ preset, draft, userId, token, FieldValue }) {
  const meta = typeMeta(preset);
  let title = clean(draft.title, 80) || fallbackDraft(preset).title;
  let desc = clean(draft.desc, 1600) || fallbackDraft(preset).desc;
  const tags = list(draft.tags, ['소소킹', meta.typeLabel], 8);
  const modules = { comments: { enabled: true } };
  let quizSecret = null;

  if (preset === 'collect') {
    const kind = ['youtube', 'image', 'link'].includes(draft.collectKind) ? draft.collectKind : 'youtube';
    const url = clean(draft.url, 300);
    const collect = {
      enabled: true,
      kind,
      label: kind === 'youtube' ? '유튜브' : kind === 'image' ? '웃긴그림' : '링크',
      caption: desc,
    };
    if (url) collect.url = url;
    if (kind === 'youtube') {
      const youtube = youtubeData(url);
      if (youtube) {
        collect.url = youtube.url;
        collect.youtube = youtube;
        modules.youtube = youtube;
      }
    }
    if (kind === 'image' && url) collect.imageUrl = url;
    modules.collect = collect;
  }

  if (preset === 'vote') {
    const options = list(draft.options, fallbackDraft('vote').options, 8);
    modules.vote = {
      enabled: true,
      question: desc,
      voteMode: 'general',
      options: options.map(text => ({ text, votes: 0 })),
    };
  }

  if (preset === 'drip') {
    title = '오늘의 한줄';
    desc = clean(desc, 80) || fallbackDraft('drip').desc;
    modules.drip = { enabled: true, prompt: desc, maxLength: 80 };
  }

  if (preset === 'quiz') {
    const mode = draft.quizMode === 'subjective' ? 'subjective' : 'multiple';
    const options = list(draft.options, fallbackDraft('quiz').options, 6);
    const correctIndex = Math.max(0, Math.min(Math.max(0, options.length - 1), Number(draft.correctIndex) || 0));
    const answer = clean(draft.answer, 120) || options[correctIndex] || options[0] || '정답';
    modules.quiz = {
      enabled: true,
      mode,
      question: desc,
      hint: clean(draft.hint, 160),
    };
    if (mode === 'multiple') {
      modules.quiz.options = options.map(text => ({ text }));
    }
    quizSecret = {
      mode,
      answer,
      correctIndex: mode === 'multiple' ? correctIndex : null,
      answerIdx: mode === 'multiple' ? correctIndex : null,
      explanation: clean(draft.explanation, 500),
      correctCount: 0,
      firstCorrect: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  return {
    post: {
      type: 'multi',
      cat: 'multi',
      subtype: meta.subtype,
      feedType: meta.feedType,
      typeLabel: meta.typeLabel,
      title,
      desc,
      tags,
      images: [],
      modules,
      anonymous: false,
      anonymousMode: '',
      authorId: userId,
      authorName: clean(token?.name || token?.email?.split('@')[0] || '관리자', 40),
      authorPhoto: token?.picture || '',
      authorEmail: token?.email || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      pointsScore: 0,
      deadline: { enabled: false, mode: 'none', status: 'open' },
      aiGenerated: true,
      generatedBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    },
    quizSecret,
  };
}

function register({ exports, onCall, db, FieldValue, GoogleGenerativeAI, geminiKey, getAiKey, logAiUsage }) {
  exports.generateAiContentNow = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 90, memory: '256MiB' }, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) throw new Error('인증 필요');
    const adminSnap = await db.doc(`admins/${userId}`).get();
    if (!adminSnap.exists) throw new Error('관리자 권한 필요');

    const preset = ['collect', 'vote', 'quiz', 'drip'].includes(request.data?.preset)
      ? request.data.preset
      : 'collect';

    const apiKey = await getAiKey();
    if (!apiKey) throw new Error('AI API 키가 설정되지 않았어요');

    let draft = fallbackDraft(preset);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const result = await model.generateContent(promptFor(preset));
      draft = { ...draft, ...parseJson(result.response.text()) };
    } catch (error) {
      console.error('generateAiContentNow AI draft error:', error.message);
    }

    const { post, quizSecret } = buildPost({ preset, draft, userId, token: request.auth.token || {}, FieldValue });
    const ref = await db.collection('feeds').add(post);
    if (quizSecret) await db.doc(`feeds/${ref.id}/secret/answer`).set(quizSecret);
    await logAiUsage().catch(() => {});
    return { ok: true, docId: ref.id, title: post.title, typeLabel: post.typeLabel, preset };
  });
}

module.exports = { register };
