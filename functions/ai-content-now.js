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
      title: '오늘 저장각 웃긴짤 모음',
      desc: '보고 피식하기 좋은 웃긴 그림 모음입니다.',
      collectKind: 'image',
      tags: ['웃긴짤', '그림', '유머'],
    },
    vote: {
      title: '친구가 약속 5분 전에 “나 이제 출발” 하면?',
      desc: '',
      options: ['이해 가능', '바로 손절각', '상습이면 문제', '나도 그래서 할 말 없음'],
      tags: ['토론방', '선택지', '공감'],
    },
    quiz: {
      title: '눈치 빠른 사람만 맞히는 퀴즈',
      desc: '다음 상황에서 가장 그럴듯한 정답은 무엇일까요?',
      quizMode: 'multiple',
      noAnswer: false,
      options: ['첫 번째 선택지', '두 번째 선택지', '세 번째 선택지', '네 번째 선택지'],
      answer: '두 번째 선택지',
      correctIndex: 1,
      explanation: '상황 흐름상 두 번째가 가장 자연스럽습니다.',
      hint: '문장을 천천히 읽어보세요.',
      tags: ['퀴즈방', '문제', '정답'],
    },
    drip: {
      title: '오늘의 드립 주제',
      desc: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?',
      topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?',
      tags: ['드립방', '드립주제', '한줄드립'],
    },
  };
  return { ...base, ...(map[preset] || {}) };
}

function promptFor(preset) {
  const meta = typeMeta(preset);
  return `소소킹 관리자용 AI 콘텐츠 데이터를 만드세요.

소소킹 현재 구조:
- 모음방: 업로드한 웃긴그림을 짧게 모아보는 방. 일반 링크 카테고리는 사용하지 않음.
- 토론방: 토론 주제만 던지고, 선택지로 의견을 모으는 방. 추가 설명은 선택사항.
- 퀴즈방: 주관식, 객관식, 정답 없는 퀴즈를 올리는 방.
- 드립방: 완성된 드립을 올리는 곳이 아니라, 사람들이 50자 이내 한 줄 드립으로 답할 수 있는 주제를 던지는 방.

현재 생성 유형: ${meta.typeLabel}

공통 조건:
- 한국어
- 짧고 가볍고 웃기거나 공감되는 톤
- 민감한 정치, 혐오, 성적 내용, 불법 내용, 실명 비방 금지
- 반드시 JSON만 출력

필수 JSON 스키마:
{
  "title": "제목 또는 주제",
  "desc": "본문/설명. 토론방은 비워도 됨. 드립방은 topic과 동일해도 됨.",
  "topic": "드립방 주제 또는 토론방 주제",
  "tags": ["태그1", "태그2", "태그3"],
  "collectKind": "image",
  "options": ["선택지1", "선택지2", "선택지3"],
  "quizMode": "subjective|multiple",
  "noAnswer": false,
  "answer": "퀴즈 정답. 정답 없는 퀴즈면 빈 문자열",
  "correctIndex": 0,
  "hint": "퀴즈 힌트",
  "explanation": "퀴즈 해설 또는 정답 없는 퀴즈 안내"
}

유형별 지시:
- 모음방: title은 40자 이내. desc는 80자 이내 한줄 설명. collectKind는 image만 사용.
- 토론방: title은 토론 주제 질문형. desc는 비워도 됩니다. options는 자연스러운 선택지 2~4개. 찬성/반대 고정 표현만 반복하지 마세요.
- 퀴즈방: 주관식, 객관식, 정답 없는 퀴즈 중 하나. noAnswer가 true면 answer/correctIndex는 비우고 explanation은 참여 안내로 작성.
- 드립방: title은 반드시 "오늘의 드립 주제". topic은 사람들이 한 줄 드립으로 답할 수 있는 80자 이내 상황/질문. 완성된 드립 문장은 만들지 마세요.

현재 유형 ${preset}에 맞게 만들어주세요.`;
}

function buildPost({ preset, draft, userId, token, FieldValue }) {
  const meta = typeMeta(preset);
  let title = clean(draft.title, 80) || fallbackDraft(preset).title;
  let desc = clean(draft.desc, 1600) || fallbackDraft(preset).desc;
  const tags = list(draft.tags, ['소소킹', meta.typeLabel], 8);
  const modules = { comments: { enabled: true } };
  let quizSecret = null;

  if (preset === 'collect') {
    modules.collect = { enabled: true, kind: 'image', label: '웃긴그림', caption: desc };
  }

  if (preset === 'vote') {
    const question = clean(draft.topic || draft.title || draft.desc, 100) || fallbackDraft('vote').title;
    const options = list(draft.options, fallbackDraft('vote').options, 8);
    title = question;
    desc = clean(draft.desc, 500) || question;
    modules.vote = {
      enabled: true,
      question,
      voteMode: 'general',
      options: options.map(text => ({ text, votes: 0 })),
    };
  }

  if (preset === 'drip') {
    const topic = clean(draft.topic || draft.desc || draft.title, 80) || fallbackDraft('drip').topic;
    title = '오늘의 드립 주제';
    desc = topic;
    modules.drip = { enabled: true, prompt: topic, maxLength: 50, responseLabel: '한 줄 드립' };
  }

  if (preset === 'quiz') {
    const mode = draft.quizMode === 'subjective' ? 'subjective' : 'multiple';
    const noAnswer = draft.noAnswer === true;
    const options = list(draft.options, fallbackDraft('quiz').options, 6);
    const correctIndex = Math.max(0, Math.min(Math.max(0, options.length - 1), Number(draft.correctIndex) || 0));
    const answer = clean(draft.answer, 120) || options[correctIndex] || options[0] || '정답';
    modules.quiz = {
      enabled: true,
      mode,
      noAnswer,
      question: desc,
      hint: clean(draft.hint, 160),
      explanation: noAnswer ? clean(draft.explanation || '정답이 없는 퀴즈입니다. 댓글로 자유롭게 이야기해보세요.', 500) : clean(draft.explanation, 500),
    };
    if (mode === 'multiple') modules.quiz.options = options.map(text => ({ text }));
    if (!noAnswer) {
      if (mode === 'multiple') modules.quiz.correctIndex = correctIndex;
      else modules.quiz.answer = answer;
      quizSecret = {
        mode,
        answer: mode === 'subjective' ? answer : options[correctIndex],
        correctIndex: mode === 'multiple' ? correctIndex : null,
        answerIdx: mode === 'multiple' ? correctIndex : null,
        explanation: clean(draft.explanation, 500),
        correctCount: 0,
        firstCorrect: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
    }
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
  require('./seo-functions').register({ exports, db });

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
