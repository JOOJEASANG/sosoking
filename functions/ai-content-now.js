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
    general: { subtype: 'general', feedType: 'general', typeLabel: '일반글' },
    vote: { subtype: 'vote', feedType: 'vote', typeLabel: '투표/판정' },
    naming: { subtype: 'naming', feedType: 'naming', typeLabel: '미친작명소' },
    drip: { subtype: 'drip', feedType: 'drip', typeLabel: '드립' },
    acrostic: { subtype: 'acrostic', feedType: 'acrostic', typeLabel: '행시' },
    relay: { subtype: 'relay', feedType: 'relay', typeLabel: '막장릴레이' },
    quiz: { subtype: 'quiz', feedType: 'quiz', typeLabel: '미친퀴즈' },
  }[preset] || { subtype: 'general', feedType: 'general', typeLabel: '일반글' };
}

function acrosticLabel(keyword = '') {
  const n = [...String(keyword || '')].length;
  return ({ 2: '이행시', 3: '삼행시', 4: '사행시', 5: '오행시' })[n] || `${n}행시`;
}

function fallbackDraft(preset) {
  const base = {
    title: '요즘 이 상황, 나만 웃긴가요?',
    desc: '가볍게 보고 댓글로 한마디 남기기 좋은 소소한 상황입니다. 여러분 생각은 어떤가요?',
    tags: ['소소킹', '공감', '유머'],
  };
  const map = {
    vote: { title: '친구랑 의견 갈리는 밸런스 판정', desc: '둘 중 뭐가 더 이해되는지 골라주세요.', options: ['완전 이해됨', '이건 좀 억까', '둘 다 가능', '댓글로 판정'] },
    naming: { title: '이 상황 이름 좀 붙여주세요', desc: '분명 별일 아닌데 묘하게 킹받는 이 상황, 이름을 뭐라고 부르면 좋을까요?', charCount: 0 },
    drip: { title: '퇴근 5분 전에 팀장이 부른 이유', desc: '가장 킹받는 한 줄 드립을 남겨보세요.' },
    acrostic: { title: '소소킹으로 행시 한 번 가볼까요?', desc: '제시어 글자마다 센스 있게 한 줄씩 완성해보세요.', keyword: '소소킹' },
    relay: { title: '갑자기 분위기 막장 릴레이', desc: '평범한 하루였는데, 엘리베이터 문이 열리자 모두가 나를 쳐다봤다.', missionKey: 'twist' },
    quiz: { title: '눈치 빠른 사람만 맞히는 미친퀴즈', desc: '다음 상황에서 가장 그럴듯한 정답은 무엇일까요?', options: ['첫 번째 선택지', '두 번째 선택지', '세 번째 선택지', '네 번째 선택지'], answer: '두 번째 선택지', correctIndex: 1, explanation: '상황 흐름상 두 번째가 가장 자연스럽습니다.', hint: '문장을 천천히 읽어보세요.' },
  };
  return { ...base, ...(map[preset] || {}) };
}

function promptFor(preset) {
  const meta = typeMeta(preset);
  return `소소킹 커뮤니티 관리자용 AI 게시글 데이터를 만드세요.\n유형: ${meta.typeLabel}\n\n공통 조건:\n- 한국어, 유머/공감/참여형 톤\n- 제목 40자 이내\n- desc는 게시글 본문으로 바로 쓸 수 있게 작성\n- 민감한 정치/혐오/성적/불법/실명 비방 금지\n- 반드시 JSON만 출력\n\n필수 JSON 스키마:\n{\n  "title": "게시글 제목",\n  "desc": "게시글 본문",\n  "tags": ["태그1", "태그2", "태그3"],\n  "options": ["투표/퀴즈 선택지"],\n  "keyword": "행시 제시어 2~5글자",\n  "charCount": 0,\n  "missionKey": "none|but|horror|animal|twist|dialogue",\n  "answer": "퀴즈 정답",\n  "correctIndex": 0,\n  "hint": "퀴즈 힌트",\n  "explanation": "퀴즈 해설"\n}\n\n유형별 지시:\n- 일반글: title, desc, tags 중심.\n- 투표/판정: options 2~4개 필수. desc는 투표 질문/상황.\n- 미친작명소: 이름 붙이기 좋은 상황. charCount는 0, 3, 5 중 하나.\n- 드립: 80자 이내 한 줄 드립을 유도하는 주제. title은 드립 소재, desc는 상황 설명 1~2문장.\n- 행시: keyword는 2~5글자. desc는 참여 유도.\n- 막장릴레이: desc는 이어쓰기 시작 문장. missionKey 하나 선택.\n- 미친퀴즈: 객관식 options 4개, correctIndex, answer, hint, explanation 필수.\n\n현재 유형 ${preset}에 맞게 만들어주세요.`;
}

function missionPreset(key) {
  return {
    but: { key: 'but', title: '그런데 시작', instruction: '다음 문장은 “그런데”로 시작해 주세요.', badge: '그런데' },
    horror: { key: 'horror', title: '공포 전환', instruction: '갑자기 분위기를 공포로 바꿔 주세요.', badge: '공포' },
    animal: { key: 'animal', title: '동물 등장', instruction: '동물 하나를 자연스럽게 등장시켜 주세요.', badge: '동물' },
    twist: { key: 'twist', title: '반전 넣기', instruction: '마지막에 짧은 반전을 넣어 주세요.', badge: '반전' },
    dialogue: { key: 'dialogue', title: '대사 필수', instruction: '인물 대사 한 줄을 반드시 포함해 주세요.', badge: '대사' },
  }[key] || null;
}

function buildPost({ preset, draft, userId, token, FieldValue }) {
  const meta = typeMeta(preset);
  const title = clean(draft.title, 80) || fallbackDraft(preset).title;
  const desc = clean(draft.desc, 1600) || fallbackDraft(preset).desc;
  const tags = list(draft.tags, ['소소킹', meta.typeLabel], 8);
  const modules = { comments: { enabled: true } };
  let quizSecret = null;

  if (preset === 'vote') {
    const options = list(draft.options, fallbackDraft('vote').options, 8);
    modules.vote = { enabled: true, question: desc, options: options.map(text => ({ text, votes: 0 })) };
  }
  if (preset === 'naming') {
    const raw = Number(draft.charCount);
    const charCount = [0, 3, 5].includes(raw) ? raw : 0;
    modules.naming = { enabled: true, charCount };
  }
  if (preset === 'drip') {
    modules.drip = { enabled: true, prompt: desc, maxLength: 80 };
  }
  if (preset === 'acrostic') {
    let keyword = clean(draft.keyword, 10).replace(/\s+/g, '') || '소소킹';
    const chars = [...keyword].slice(0, 5);
    if (chars.length < 2) keyword = '소소킹'; else keyword = chars.join('');
    modules.acrostic = { enabled: true, keyword, lineCount: [...keyword].length, kindLabel: acrosticLabel(keyword) };
  }
  if (preset === 'relay') {
    const mission = missionPreset(draft.missionKey || 'twist');
    modules.relay = { enabled: true, startSentence: desc, mission: mission ? { enabled: true, ...mission } : { enabled: false, key: 'none' } };
  }
  if (preset === 'quiz') {
    const options = list(draft.options, fallbackDraft('quiz').options, 6);
    const correctIndex = Math.max(0, Math.min(options.length - 1, Number(draft.correctIndex) || 0));
    const answer = clean(draft.answer, 120) || options[correctIndex] || options[0] || '정답';
    modules.quiz = {
      enabled: true,
      mode: 'multiple',
      question: desc,
      options: options.map(text => ({ text })),
      hint: clean(draft.hint, 160),
    };
    quizSecret = {
      mode: 'multiple',
      answer,
      correctIndex,
      answerIdx: correctIndex,
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

    const preset = ['general', 'vote', 'naming', 'drip', 'acrostic', 'relay', 'quiz'].includes(request.data?.preset)
      ? request.data.preset
      : 'general';

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
