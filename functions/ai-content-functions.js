'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';

const POST_TYPES = [
  { type: 'vote',          cat: 'golra' },
  { type: 'initial_game',  cat: 'golra' },
  { type: 'random_battle', cat: 'golra' },
  { type: 'naming',        cat: 'usgyo' },
  { type: 'crazy_court',   cat: 'usgyo' },
  { type: 'drip',          cat: 'usgyo' },
  { type: 'quiz',          cat: 'malhe' },
  { type: 'relay',         cat: 'malhe' },
  { type: 'acrostic',      cat: 'malhe' },
];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function dayOfYear() {
  const [y, m, d] = todayKST().split('-').map(Number);
  return Math.floor((new Date(y, m - 1, d) - new Date(y, 0, 1)) / 86400000) + 1;
}

function clean(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

let _settingsCache = null;
let _settingsCacheAt = 0;
const SETTINGS_TTL = 5 * 60 * 1000;

async function settings() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < SETTINGS_TTL) return _settingsCache;
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  _settingsCache = { aiAutoContentEnabled: data.aiAutoContentEnabled !== false, aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)) };
  _settingsCacheAt = now;
  return _settingsCache;
}

async function reserveUsage(kind) {
  const current = await settings();
  if (!current.aiAutoContentEnabled && kind === 'daily_content') return { ok: false, reason: 'disabled' };
  if (current.aiDailyLimit <= 0) return { ok: false, reason: 'limit-zero' };
  const date = todayKST();
  const ref = db.doc(`ai_usage/${date}`);
  let ok = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = Number(snap.exists ? snap.data().total || 0 : 0);
    if (used >= current.aiDailyLimit) return;
    ok = true;
    tx.set(ref, { date, total: FieldValue.increment(1), [kind]: FieldValue.increment(1), limit: current.aiDailyLimit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok, reason: ok ? 'reserved' : 'daily-limit-reached' };
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

// 유형별 전용 AI 프롬프트 (현재 9가지 놀이판 타입)
const TYPE_PROMPTS = {
  vote: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
골라킹 투표 포스트를 하나 만들어줘. 일상·취향·음식·문화·직장 중 하나의 주제로, 여러 선택지 중 가장 끌리는 것을 고르는 투표야. 선택지는 3개이고 각각 구체적이고 재미있어야 해.

반드시 아래 JSON 형식만 출력해:
{
  "title": "투표 제목 (예: 지금 당장 먹고 싶은 야식은?)",
  "desc": "참여 유도 설명 (1~2문장, 예: 오늘 밤 야식을 딱 하나만 고른다면? 댓글로 이유도 남겨주세요!)",
  "options": [
    { "text": "선택지1 구체 내용", "votes": 0 },
    { "text": "선택지2 구체 내용", "votes": 0 },
    { "text": "선택지3 구체 내용", "votes": 0 }
  ],
  "tags": ["골라킹", "소소킹"]
}`,

  initial_game: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
초성게임 포스트를 하나 만들어줘. 일상 생활에서 자주 쓰는 단어나 요즘 유행하는 표현의 초성을 제시해서 맞히는 게임이야.

반드시 아래 JSON 형식만 출력해:
{
  "title": "초성게임: ㅅㅅㅋ (이 자리에는 실제 초성을 넣어줘)",
  "initials": "2~5글자 초성 (예: ㅅㅅㅋ, ㄱㅇㅅ, ㅊㅅㄱ)",
  "hint": "힌트 한 문장 (예: 요즘 핫한 게임 커뮤니티 이름이에요, 너무 직접적인 힌트는 NO)",
  "answer": "정답 단어 (예: 소소킹)",
  "tags": ["초성게임", "소소킹"]
}`,

  random_battle: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
랜덤대결 포스트를 하나 만들어줘. 같은 주제로 각자가 다른 답변을 댓글로 달고, 가장 반응이 많은 사람이 이기는 게임이야. 배틀 주제는 구체적이고 재미있어야 해.

반드시 아래 JSON 형식만 출력해:
{
  "title": "대결 제목 (예: 오늘의 랜덤 대결 🔥 — 나만의 야식 루틴 자랑!)",
  "desc": "대결 설명 (예: 같은 주제로 각자 자신의 답을 댓글로 달아보세요. 가장 공감·웃음 반응을 많이 받은 사람이 오늘의 랜덤 대결 왕!)",
  "battleTopic": "배틀 주제 한 문장 (예: 나만의 야식 루틴을 알려주세요)",
  "tags": ["랜덤대결", "소소킹"]
}`,

  naming: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
미친작명소 포스트를 하나 만들어줘. 특정 상황·감정·사물·현상에 웃기거나 찰떡인 별명/제목을 짓는 게임이야. 참여자들이 댓글로 창의적인 이름을 달도록 유도해야 해.

반드시 아래 JSON 형식만 출력해:
{
  "title": "작명 대상이 명확한 제목 (예: '퇴근 5분 전에 들어오는 급한 업무 지시'에 딱 맞는 이름을 지어줘!)",
  "desc": "작명 유도 설명 (예: 이 상황을 단어 하나 또는 짧은 문장으로 표현한다면? 가장 찰진 이름을 댓글로 남겨주세요. 베스트 작명이 왕좌에 오릅니다!)",
  "tags": ["미친작명소", "소소킹"]
}`,

  crazy_court: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
억까재판 포스트를 하나 만들어줘. 일상에서 생긴 황당하거나 억지스러운 상황을 제시하고 "유죄냐 무죄냐"를 투표하는 재판 놀이야. 상황이 구체적이고 공감되거나 웃겨야 해.

반드시 아래 JSON 형식만 출력해:
{
  "title": "억까재판: [상황을 한 줄로] (예: 억까재판: 카톡 읽고 3시간 후에 답장한 사람, 유죄냐 무죄냐?)",
  "desc": "상황 설명 2~3문장 (예: 친구가 카톡을 읽고 3시간 동안 답장을 안 했어요. 이유는 '바빠서'라고 하는데, 과연 이 사람은 유죄일까요 무죄일까요?)",
  "evidence": "추가 변명 또는 증거 (예: 사실 급한 회의가 있었다고 함)",
  "tags": ["억까재판", "소소킹"]
}`,

  drip: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
한줄드립 포스트를 하나 만들어줘. 직장·학교·일상에서 생기는 어이없거나 공감가는 상황을 제시하고, 그 상황에 딱 맞는 한 줄 드립을 댓글로 달도록 하는 게임이야.

반드시 아래 JSON 형식만 출력해:
{
  "title": "상황 설명 제목 (예: 팀장이 퇴근 직전에 '저녁 먹고 회의해요~' 했을 때 ㅋㅋ)",
  "desc": "드립 유도 설명 (예: 이 상황에서 가장 찰진 한 줄 드립을 달아보세요. 공감 폭발하는 드립이 오늘의 드립왕!)",
  "tags": ["한줄드립", "소소킹"]
}`,

  quiz: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
미친퀴즈 포스트를 하나 만들어줘. 음식·건강·상식·생활꿀팁·역사 등 일상 주제로, 의외의 정답이 나올 수 있는 흥미로운 객관식 4지선다 퀴즈를 만들어. 정답과 해설도 포함해야 해.

반드시 아래 JSON 형식만 출력해:
{
  "title": "오늘의 미친퀴즈 🧠",
  "desc": "퀴즈 문제 (예: 다음 중 하루에 가장 많은 칼로리를 소모하는 활동은?)",
  "quizMode": "multiple",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "answerIdx": 1,
  "explanation": "정답 해설 1~2문장",
  "tags": ["미친퀴즈", "소소킹"]
}`,

  relay: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
막장킹 릴레이 포스트를 하나 만들어줘. 댓글로 한 문장씩 이어가는 릴레이 소설의 시작 문장을 만들어야 해. 반전이나 막장 요소가 있어서 이어 쓰고 싶어지는 흥미로운 첫 문장이어야 해. 등장인물도 구체적으로 설정해줘.

반드시 아래 JSON 형식만 출력해:
{
  "title": "릴레이 소설 제목 (예: 오늘의 막장 릴레이: 수상한 택배가 왔다)",
  "desc": "참여 유도 설명 (예: 댓글로 한 문장씩 이어서 이야기를 완성해보세요. 어디로 흘러갈지는 아무도 몰라요!)",
  "startSentence": "첫 시작 문장 (예: 현관문을 열자 이름도 주소도 없는 작은 상자가 놓여 있었고, 안에서는 희미하게 음악 소리가 들렸다.)",
  "characters": "등장인물 (예: 주인공, 수상한 택배를 보낸 사람, 옆집 할머니)",
  "tags": ["막장킹", "소소킹"]
}`,

  acrostic: `너는 한국 커뮤니티 게임 콘텐츠 작가야.
삼행시짓기 챌린지 포스트를 하나 만들어줘. 일상에서 자주 쓰는 재미있는 3~4글자 단어를 제시어로 골라야 해.

반드시 아래 JSON 형식만 출력해:
{
  "keyword": "3~4글자 한국어 단어 (예: 월요일, 퇴근길, 치킨집, 카페인, 야근중)",
  "desc": "참여 유도 설명 (예: '월요일'로 삼행시를 지어보세요! 각 글자로 시작하는 한 문장씩, 가장 웃기거나 공감되는 삼행시를 댓글로 남겨주세요.)",
  "tags": ["삼행시짓기", "소소킹"]
}`,
};

// 폴백 콘텐츠: API 실패시 사용, 실제 운영 가능한 내용으로 구성
function fallbackContent(type, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const pick = list => list[seed % list.length];
  const tags = ['소소킹'];

  const map = {
    vote: pick([
      { title: '지금 당장 먹고 싶은 야식은?', desc: '가장 끌리는 야식 하나만 골라주세요!', options: [{ text: '🍗 치킨', votes: 0 }, { text: '🍜 라면', votes: 0 }, { text: '🍕 피자', votes: 0 }], tags: ['골라킹', ...tags] },
      { title: '스트레스받을 때 제일 먼저 하고 싶은 건?', desc: '나만의 스트레스 해소법을 투표로 알아봐요!', options: [{ text: '🍔 폭식하기', votes: 0 }, { text: '🛌 그냥 자버리기', votes: 0 }, { text: '🏃 운동하러 가기', votes: 0 }], tags: ['골라킹', ...tags] },
      { title: '주말 아침 기상 시간은?', desc: '평일의 내가 가장 부러워할 주말 기상 시간!', options: [{ text: '🌅 7시 이전 (아침형 인간)', votes: 0 }, { text: '☀️ 9~11시 (적당히 늦잠)', votes: 0 }, { text: '🌞 12시 이후 (하루 반납)', votes: 0 }], tags: ['골라킹', ...tags] },
    ]),

    initial_game: pick([
      { title: '초성게임: ㅅㅅㅋ', initials: 'ㅅㅅㅋ', hint: '요즘 핫한 게임 커뮤니티 이름이에요!', answer: '소소킹', tags: ['초성게임', ...tags] },
      { title: '초성게임: ㅊㄱ', initials: 'ㅊㄱ', hint: '배달 음식 중 국민 야식 TOP1', answer: '치킨', tags: ['초성게임', ...tags] },
      { title: '초성게임: ㄱㅇㅅ', initials: 'ㄱㅇㅅ', hint: '일하다 지칠 때 생각나는 그 시간', answer: '고의성', tags: ['초성게임', ...tags] },
    ]),

    random_battle: pick([
      { title: '오늘의 랜덤 대결 🔥 — 나만의 야식 루틴 자랑!', desc: '아래 주제로 각자 자신만의 답을 댓글로 달아보세요. 가장 공감·웃음 반응을 많이 받은 사람이 오늘의 랜덤 대결 왕!', battleTopic: '나만의 야식 루틴을 알려주세요 (메뉴, 먹는 방법, 먹는 시간 다 포함!)', tags: ['랜덤대결', ...tags] },
      { title: '오늘의 랜덤 대결 🔥 — 월요일 생존기 공유', desc: '같은 주제로 각자의 이야기를 달아보세요. 반응이 가장 많은 사람이 오늘의 승자!', battleTopic: '이번 주 월요일 버티는 나만의 생존 방법이나 각오 한 마디', tags: ['랜덤대결', ...tags] },
      { title: '오늘의 랜덤 대결 🔥 — 퇴근 후 첫 번째 행동 공개!', desc: '퇴근하고 나서 제일 먼저 하는 것, 솔직하게 공유해봐요. 가장 공감받은 사람이 오늘의 퇴근왕!', battleTopic: '퇴근 후 집에 도착하면 가장 먼저 하는 행동 솔직 공개', tags: ['랜덤대결', ...tags] },
    ]),

    naming: pick([
      { title: '퇴근 5분 전에 갑자기 날아오는 급한 업무 지시에 딱 맞는 이름을 지어줘!', desc: '이 상황을 단어 하나 또는 짧은 문장으로 표현한다면? 가장 찰진 이름을 댓글로 남겨주세요. 베스트 작명이 왕좌에 오릅니다!', tags: ['미친작명소', ...tags] },
      { title: '카톡 읽씹 당한 후 3시간 뒤 갑자기 답장 오는 그 상황, 뭐라고 부를까?', desc: '이 어이없는 상황에 딱 맞는 이름을 지어보세요. 가장 공감·웃음을 부르는 작명이 오늘의 작명왕!', tags: ['미친작명소', ...tags] },
      { title: '배달 예상 시간 30분인데 1시간 넘어도 안 올 때 그 기다리는 시간, 이름을 붙여봐!', desc: '이 초조한 기다림의 시간을 한 마디로 표현한다면? 베스트 작명을 댓글로 남겨주세요!', tags: ['미친작명소', ...tags] },
    ]),

    crazy_court: pick([
      { title: '억까재판: 카톡 읽고 3시간 후 답장한 사람, 유죄냐 무죄냐?', desc: '친구가 카톡을 읽고 3시간 동안 답장을 안 했어요. 이유는 "바빠서"라고 하는데, 과연 이 사람은 유죄일까요 무죄일까요?', evidence: '사실 급한 회의가 있었다고 함', tags: ['억까재판', ...tags] },
      { title: '억까재판: 배달 예상 시간 30분인데 1시간 만에 온 배달기사, 유죄냐 무죄냐?', desc: '배달 앱에 30분이라고 나왔는데 실제로는 1시간이 걸렸어요. 배달기사님은 유죄일까요?', evidence: '도로가 막혔다는 증언 있음', tags: ['억까재판', ...tags] },
    ]),

    drip: pick([
      { title: '팀장이 퇴근 10분 전에 "오늘 회식 어때요~? 😊" 했을 때 ㅋㅋㅋ', desc: '이 상황에서 가장 찰진 한 줄 드립을 달아보세요. 공감 폭발하는 드립이 오늘의 드립왕!', tags: ['한줄드립', ...tags] },
      { title: '배달 시켰는데 "문 앞에 두고 갈게요" 하고 엘리베이터 앞에 놓고 간 배달기사 ㅋㅋ', desc: '이 황당한 상황에서 딱 한 마디 드립을 날려보세요!', tags: ['한줄드립', ...tags] },
      { title: '다이어트 3일 만에 치킨 시키면서 "이번 한 번만"이라고 혼자 중얼거리는 그 순간', desc: '이 상황에 딱 맞는 드립 한 줄 해주세요. 웃음 반응이 가장 많은 드립이 왕좌에!', tags: ['한줄드립', ...tags] },
    ]),

    quiz: pick([
      { title: '오늘의 미친퀴즈 🧠', desc: '삼겹살을 구울 때 뚜껑을 덮으면 더 빨리 익는다는 게 맞을까요?', quizMode: 'multiple', options: ['맞다, 열이 순환해서 빨리 익어요', '틀려요, 오히려 더 늦게 익어요', '차이 없어요', '고기 두께에 따라 달라요'], answerIdx: 0, explanation: '뚜껑을 덮으면 프라이팬 내부 온도가 올라가 열이 고르게 전달되어 더 빠르게 익습니다.', tags: ['미친퀴즈', ...tags] },
      { title: '오늘의 미친퀴즈 🧠', desc: '사람은 하루에 평균 몇 번 이상 스마트폰 화면을 켤까요?', quizMode: 'multiple', options: ['50번 미만', '50~100번', '100~150번', '150번 이상'], answerIdx: 3, explanation: '연구에 따르면 스마트폰 사용자는 하루 평균 150~200회 이상 화면을 확인한다고 합니다.', tags: ['미친퀴즈', ...tags] },
    ]),

    relay: pick([
      { title: '막장 릴레이 시작 🎬 — 수상한 택배가 왔다', desc: '댓글로 한 문장씩 이어서 이야기를 완성해보세요. 어디로 흘러갈지는 아무도 몰라요!', startSentence: '현관문을 열자 이름도 주소도 없는 작은 상자가 놓여 있었고, 상자 안에서는 희미하게 음악 소리가 들렸다.', characters: '주인공, 수상한 택배를 보낸 익명의 인물, 옆집 눈치 보는 할머니', tags: ['막장킹', ...tags] },
      { title: '막장 릴레이 시작 🎬 — 카페에서 생긴 일', desc: '한 문장씩 댓글로 이어가는 막장 릴레이 소설! 상상력을 마음껏 발휘해보세요.', startSentence: '조용한 카페에 앉아 노트북을 열었는데, 맞은편에 앉은 낯선 사람이 갑자기 종이 한 장을 내 테이블 위에 밀어 넣었다.', characters: '주인공, 수상한 낯선 사람, 눈치 빠른 바리스타', tags: ['막장킹', ...tags] },
      { title: '막장 릴레이 시작 🎬 — 엘리베이터에 갇혔다', desc: '댓글로 한 문장씩 이어 써서 오늘의 막장 소설을 완성해보세요!', startSentence: '엘리베이터 문이 닫히는 순간, 함께 탄 사람이 주머니에서 작은 봉투를 꺼내며 말했다. "이거 꼭 읽어봐야 해요."', characters: '주인공, 수상한 동승자, 엘리베이터 점검 기사', tags: ['막장킹', ...tags] },
    ]),

    acrostic: pick([
      { keyword: '월요일', desc: "'월요일'로 삼행시를 지어보세요! 각 글자로 시작하는 한 문장씩, 가장 웃기거나 공감되는 삼행시를 댓글로 남겨주세요.", tags: ['삼행시짓기', ...tags] },
      { keyword: '퇴근길', desc: "'퇴근길'로 삼행시 도전! 퇴근하는 기분을 담아 각 글자로 시작하는 한 줄씩 완성해보세요.", tags: ['삼행시짓기', ...tags] },
      { keyword: '치킨집', desc: "'치킨집'으로 삼행시를 만들어보세요! 각 글자로 시작하는 문장으로 가장 재밌는 삼행시를 완성해주세요.", tags: ['삼행시짓기', ...tags] },
      { keyword: '야근중', desc: "'야근중'으로 삼행시 도전! 직장인의 애환을 담아 각 글자로 시작하는 한 줄씩 써보세요.", tags: ['삼행시짓기', ...tags] },
    ]),
  };

  return map[type] || { title: '오늘의 소소 놀이', desc: '함께 참여해보세요!', tags };
}

function arr(value, max = 8) {
  return Array.isArray(value) ? value.slice(0, max).map(v => typeof v === 'object' ? v : String(v || '').slice(0, 80)) : [];
}

function buildDoc(type, cat, content, date, source) {
  const base = {
    type, cat,
    authorId: 'sosoking-ai',
    authorName: source === 'ai' ? '소소킹AI 🤖' : '소소킹 운영봇',
    authorPhoto: '', images: [],
    tags: arr(content.tags, 6).map(String),
    reactions: { total: 0 }, commentCount: 0, viewCount: 0,
    isAiGenerated: true, aiGeneratedDate: date, aiSource: source,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
  const optionList = value => arr(value, 6).map(o => typeof o === 'object'
    ? { text: String(o.text || o || '').slice(0, 80), votes: Number(o.votes || 0) }
    : { text: String(o || '').slice(0, 80), votes: 0 });

  if (type === 'vote') {
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), options: optionList(content.options) }, secretDoc: null };
  }
  if (type === 'initial_game') {
    const initials = clean(content.initials, 10);
    const answer = clean(content.answer, 30);
    return {
      mainDoc: { ...base, title: `초성게임: ${initials}`, initials, hint: clean(content.hint, 100), desc: '' },
      secretDoc: { answer, quizMode: 'short' },
    };
  }
  if (type === 'random_battle') {
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), battleTopic: clean(content.battleTopic, 100) }, secretDoc: null };
  }
  if (type === 'naming') {
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) }, secretDoc: null };
  }
  if (type === 'crazy_court') {
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), evidence: clean(content.evidence, 100) }, secretDoc: null };
  }
  if (type === 'drip') {
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) }, secretDoc: null };
  }
  if (type === 'quiz') {
    const opts = Array.isArray(content.options) ? content.options.map(String) : [];
    const answerIdx = Math.max(0, Math.min(Number(content.answerIdx || 0), opts.length - 1));
    return {
      mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), quizMode: 'multiple', options: opts },
      secretDoc: { quizMode: 'multiple', answerIdx, explanation: clean(content.explanation, 500) },
    };
  }
  if (type === 'relay') {
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), startSentence: clean(content.startSentence, 200), characters: clean(content.characters, 200) }, secretDoc: null };
  }
  if (type === 'acrostic') {
    const keyword = clean(content.keyword, 12) || '월요일';
    return { mainDoc: { ...base, title: `'${keyword}' 삼행시 도전!`, keyword, desc: clean(content.desc, 1000) }, secretDoc: null };
  }
  return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) }, secretDoc: null };
}

async function generateOneType({ type, cat, force = false, actorId = 'admin' }) {
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/ai_content_${date}_${type}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { skipped: true, type, reason: 'already-generated' };

  let content = fallbackContent(type, date);
  let source = 'fallback';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const usage = apiKey ? await reserveUsage('daily_content') : { ok: false, reason: 'no-key' };

  if (apiKey && usage.ok) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const prompt = TYPE_PROMPTS[type];
      if (prompt) {
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });
        const parsed = parseJson(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
        if (parsed) {
          content = parsed;
          source = 'ai';
        }
      }
    } catch (error) {
      console.error(`[ai-content] fallback for ${type}`, error);
    }
  }

  const { mainDoc, secretDoc } = buildDoc(type, cat, content, date, source);
  const feedRef = db.collection('feeds').doc();
  await Promise.all([
    feedRef.set(mainDoc),
    secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));
  await markerRef.set({ date, type, cat, docId: feedRef.id, source, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, type, cat, docId: feedRef.id, source };
}

async function generateDailyAiContent({ force = false, actorId = 'scheduler' } = {}) {
  const date = todayKST();
  const { type, cat } = POST_TYPES[dayOfYear() % POST_TYPES.length];
  return generateOneType({ type, cat, force, actorId });
}

async function generateAllAiContent({ force = false, actorId = 'admin' } = {}) {
  const results = [];
  for (const { type, cat } of POST_TYPES) {
    try {
      const result = await generateOneType({ type, cat, force, actorId });
      results.push(result);
    } catch (e) {
      console.error(`[ai-content] error for ${type}`, e);
      results.push({ error: true, type, message: e.message });
    }
  }
  return { results, total: results.length, ok: results.filter(r => r.ok).length, skipped: results.filter(r => r.skipped).length };
}

exports.dailyAiContent = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 120 }, async () => {
  await generateDailyAiContent();
});

exports.generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateDailyAiContent({ force: request.data && request.data.force === true, actorId: request.auth.uid });
});

exports.generateAllAiContentNow = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateAllAiContent({ force: request.data && request.data.force === true, actorId: request.auth.uid });
});
