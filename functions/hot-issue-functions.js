const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

async function assertAdmin(uid) {
  if (!uid) throw new Error('인증 필요');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new Error('관리자 권한 필요');
}

const RSS_SOURCES = [
  { key: 'top', name: '종합', url: 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'entertainment', name: '연예/방송', url: 'https://news.google.com/rss/search?q=%EC%97%B0%EC%98%88%20OR%20%EB%B0%A9%EC%86%A1%20when:1d&hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'sports', name: '스포츠', url: 'https://news.google.com/rss/search?q=%EC%8A%A4%ED%8F%AC%EC%B8%A0%20OR%20%EC%95%BC%EA%B5%AC%20OR%20%EC%B6%95%EA%B5%AC%20when:1d&hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'it', name: 'IT/게임', url: 'https://news.google.com/rss/search?q=IT%20OR%20%EA%B2%8C%EC%9E%84%20OR%20AI%20when:1d&hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'life', name: '날씨/생활', url: 'https://news.google.com/rss/search?q=%EB%82%A0%EC%94%A8%20OR%20%EC%83%9D%ED%99%9C%20OR%20%EA%B5%90%ED%86%B5%20when:1d&hl=ko&gl=KR&ceid=KR:ko' }
];

const BLOCK_WORDS = ['사망','피해자','살인','성폭행','성범죄','아동','참사','자살','극단적','전쟁','테러','대선','총선','선거','정당','후보','코인','비트코인','주가','급등주','투자'];

function todayKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function cleanText(value, max = 120) {
  return String(value || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function isBlocked(text) {
  const source = String(text || '').toLowerCase();
  return BLOCK_WORDS.some(word => source.includes(word.toLowerCase()));
}

function parseItems(xml, source) {
  const items = [];
  const itemBlocks = String(xml || '').match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks.slice(0, 40)) {
    const title = cleanText((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '', 160).replace(/\s+-\s+[^-]{2,30}$/g, '');
    const link = cleanText((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '', 300);
    const pubDate = cleanText((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '', 80);
    if (!title || isBlocked(title)) continue;
    items.push({ title, link, pubDate, sourceKey: source.key, category: source.name });
  }
  return items;
}

function extractKeywords(title) {
  const stop = new Set(['오늘','내일','논란','공개','발표','관련','속보','종합','단독','기자','뉴스','영상','사진','이슈','한국','서울','공식','확인']);
  return [...new Set(String(title || '').replace(/[\[\](){}'"“”‘’.,!?…:;·|]/g, ' ').split(/\s+/).map(w => w.trim()).filter(w => w.length >= 2 && w.length <= 16 && !stop.has(w) && !/^\d+$/.test(w)))].slice(0, 8);
}

function scoreIssues(items) {
  const map = new Map();
  for (const item of items) {
    for (const keyword of extractKeywords(item.title)) {
      if (isBlocked(keyword)) continue;
      const id = keyword.toLowerCase();
      const prev = map.get(id) || { keyword, title: item.title, category: item.category, sourceKeys: new Set(), titles: [], score: 0 };
      prev.sourceKeys.add(item.sourceKey);
      prev.titles.push(item.title);
      prev.score += 10 + Math.min(10, keyword.length) + (item.sourceKey === 'top' ? 6 : 3);
      if (item.title.length > prev.title.length) prev.title = item.title;
      map.set(id, prev);
    }
  }
  return [...map.values()].map(issue => ({
    keyword: issue.keyword,
    title: issue.title,
    category: issue.category,
    sampleTitles: [...new Set(issue.titles)].slice(0, 5),
    sourceCount: issue.sourceKeys.size,
    mentionCount: issue.titles.length,
    hotScore: Math.min(99, Math.round(issue.score + issue.sourceKeys.size * 8 + issue.titles.length * 3))
  })).filter(issue => issue.mentionCount >= 2 || issue.sourceCount >= 2).sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
}

function shortTitle(issue) {
  return cleanText(issue?.keyword || issue?.title || '오늘의 이슈', 18);
}

function sampleLine(issue) {
  const first = Array.isArray(issue?.sampleTitles) ? issue.sampleTitles[0] : '';
  return first ? `대표 기사 흐름: ${cleanText(first, 72)}` : '오늘 수집된 기사 흐름을 기준으로 만든 예측입니다.';
}

function toneForCategory(category) {
  if (String(category).includes('스포츠')) return { verb: '경기 후폭풍', clue: '경기 결과, 선수 발언, 팬 반응이 내일까지 이어지는지가 관건입니다.' };
  if (String(category).includes('연예')) return { verb: '화제성', clue: '방송 클립, 커뮤니티 반응, 추가 입장 여부가 흐름을 바꿀 수 있습니다.' };
  if (String(category).includes('IT')) return { verb: '기술/게임 이슈', clue: '신제품, 업데이트, 이용자 반응이 내일까지 살아남는지가 포인트입니다.' };
  if (String(category).includes('날씨') || String(category).includes('생활')) return { verb: '생활 체감 이슈', clue: '날씨, 교통, 생활 불편처럼 내일도 직접 체감되는지가 중요합니다.' };
  return { verb: '뉴스 흐름', clue: '추가 기사와 댓글 반응이 이어지면 내일도 상단에 남을 수 있습니다.' };
}

function makeBoardsFromIssues(issues, dateKey = todayKey()) {
  const top = issues[0] || { keyword: '오늘의 핫이슈', title: '오늘의 핫이슈', category: '종합', hotScore: 80, sampleTitles: [] };
  const second = issues[1] || { keyword: '추격 이슈', title: '추격 이슈', category: '종합', hotScore: 70, sampleTitles: [] };
  const topName = shortTitle(top);
  const secondName = shortTitle(second);
  const topTone = toneForCategory(top.category);
  const secondTone = toneForCategory(second.category);
  const categories = [...new Set(issues.map(i => i.category).filter(Boolean))].slice(0, 4);
  const categoryOptions = (categories.length ? categories : ['연예/방송','스포츠','IT/게임','날씨/생활']).map((label, idx) => ({ id: `cat_${idx}`, label, odds: [2.0, 2.2, 2.5, 2.8][idx] || 2.4 }));
  return [
    {
      id: `${dateKey}-hot-issue-survive`, dateKey, status: 'open', category: '오늘의 메인판',
      title: `“${topName}” 이슈, 내일도 계속 뜰까?`, issue: topName, sourceTitle: top.title,
      summary: `오늘 가장 눈에 띈 ${topTone.verb}입니다. 하루짜리로 식을지, 내일까지 계속 화제가 될지 맞혀보세요.`,
      question: `내일 오후 6시에도 “${topName}” 관련 흐름이 주요 이슈로 남아 있을까?`,
      options: [{ id: 'survive', label: '내일도 뜬다', odds: 1.7 }, { id: 'fade', label: '오늘로 식는다', odds: 1.9 }],
      closeAtText: '오늘 23:59', resultAtText: '내일 18:00', resultRule: '내일 자동 수집된 핫이슈 TOP5 키워드 기준',
      heat: top.hotScore, participants: 0, aiComment: `${topTone.clue} ${sampleLine(top)}`,
      issueKeyword: top.keyword, gameTags: ['메인판','하루짜리 판별','댓글 흐름'], sampleTitles: top.sampleTitles || [],
      createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now()
    },
    {
      id: `${dateKey}-trend-category-winner`, dateKey, status: 'open', category: '내일의 판세',
      title: '내일 뉴스판을 장악할 분야는?', issue: '카테고리 흐름',
      summary: '오늘 이슈가 여러 갈래로 갈라졌습니다. 내일은 어떤 분야가 가장 많이 살아남을지 고르는 판입니다.',
      question: '내일 오후 6시 핫이슈 TOP5에서 가장 많이 보일 분야는?', options: categoryOptions,
      closeAtText: '오늘 23:59', resultAtText: '내일 18:00', resultRule: '내일 자동 수집 TOP5 이슈의 카테고리 최다 등장 기준',
      heat: Math.max(70, Math.min(99, Math.round((issues[0]?.hotScore || 70) * 0.9))), participants: 0,
      aiComment: '단일 키워드보다 큰 흐름을 보는 판입니다. 오늘 강한 분야가 내일도 이어질지, 전혀 다른 분야가 치고 올라올지 보는 재미가 있습니다.',
      gameTags: ['분야 맞히기','흐름 예측','넓게 보기'], createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now()
    },
    {
      id: `${dateKey}-second-place-reverse`, dateKey, status: 'open', category: '반전판',
      title: `“${secondName}”, 내일 1위로 뒤집을까?`, issue: secondName, sourceTitle: second.title,
      summary: `지금은 2등 흐름이지만 변수는 남아 있습니다. 추가 기사나 반응이 붙으면 내일 판이 뒤집힐 수 있습니다.`,
      question: `내일 오후 6시 기준, “${secondName}” 이슈가 오늘의 1위 이슈를 제치고 가장 뜨거워질까?`,
      options: [{ id: 'reverse', label: '뒤집는다', odds: 2.6 }, { id: 'no_reverse', label: '못 뒤집는다', odds: 1.55 }],
      closeAtText: '오늘 23:59', resultAtText: '내일 18:00', resultRule: '내일 자동 수집 핫이슈 점수 1위 여부 기준',
      heat: second.hotScore, participants: 0, aiComment: `${secondTone.clue} ${sampleLine(second)}`,
      issueKeyword: second.keyword, gameTags: ['역전 가능성','고배율','반전판'], sampleTitles: second.sampleTitles || [],
      createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now()
    }
  ];
}

async function collectIssuesInternal() {
  const allItems = [];
  for (const source of RSS_SOURCES) {
    try {
      const res = await fetch(source.url, { headers: { 'User-Agent': 'sosoking-bot/1.0' } });
      const xml = await res.text();
      allItems.push(...parseItems(xml, source));
    } catch (error) {
      console.error('RSS fetch failed', source.key, error.message);
    }
  }
  return scoreIssues(allItems);
}

async function saveIssuesAndBoards({ force = false } = {}) {
  const dateKey = todayKey();
  const issues = await collectIssuesInternal();
  const boards = makeBoardsFromIssues(issues, dateKey);
  const batch = db.batch();
  batch.set(db.doc(`daily_issues/${dateKey}`), { dateKey, issues, collectedAt: FieldValue.serverTimestamp(), collectedAtMs: Date.now(), source: 'rss' }, { merge: true });
  boards.forEach(board => {
    const { id, ...data } = board;
    batch.set(db.doc(`prediction_boards/${id}`), force ? data : { ...data, participants: FieldValue.increment(0) }, { merge: true });
  });
  await batch.commit();
  return { dateKey, issues, boards: boards.map(({ id, ...data }) => ({ id, ...data })) };
}

const collectHotIssues = onCall({ region: 'asia-northeast3', timeoutSeconds: 120 }, async (request) => {
  await assertAdmin(request.auth?.uid);
  return { ok: true, ...(await saveIssuesAndBoards({ force: true })) };
});
const scheduledCollectHotIssues = onSchedule({ region: 'asia-northeast3', schedule: 'every day 09:00', timeZone: 'Asia/Seoul', timeoutSeconds: 300 }, async () => { await saveIssuesAndBoards({ force: false }); return null; });
const scheduledRefreshHotIssues = onSchedule({ region: 'asia-northeast3', schedule: 'every day 21:00', timeZone: 'Asia/Seoul', timeoutSeconds: 300 }, async () => { await saveIssuesAndBoards({ force: false }); return null; });

module.exports = { collectHotIssues, scheduledCollectHotIssues, scheduledRefreshHotIssues };
