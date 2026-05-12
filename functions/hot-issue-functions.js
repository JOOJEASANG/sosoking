const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

const RSS_SOURCES = [
  { key: 'top', name: '종합', url: 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'entertainment', name: '연예/방송', url: 'https://news.google.com/rss/search?q=%EC%97%B0%EC%98%88%20OR%20%EB%B0%A9%EC%86%A1%20when:1d&hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'sports', name: '스포츠', url: 'https://news.google.com/rss/search?q=%EC%8A%A4%ED%8F%AC%EC%B8%A0%20OR%20%EC%95%BC%EA%B5%AC%20OR%20%EC%B6%95%EA%B5%AC%20when:1d&hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'it', name: 'IT/게임', url: 'https://news.google.com/rss/search?q=IT%20OR%20%EA%B2%8C%EC%9E%84%20OR%20AI%20when:1d&hl=ko&gl=KR&ceid=KR:ko' },
  { key: 'life', name: '날씨/생활', url: 'https://news.google.com/rss/search?q=%EB%82%A0%EC%94%A8%20OR%20%EC%83%9D%ED%99%9C%20OR%20%EA%B5%90%ED%86%B5%20when:1d&hl=ko&gl=KR&ceid=KR:ko' }
];

const BLOCK_WORDS = [
  '사망', '피해자', '살인', '성폭행', '성범죄', '아동', '참사', '자살', '극단적', '전쟁', '테러',
  '대선', '총선', '선거', '정당', '후보', '코인', '비트코인', '주가', '급등주', '투자'
];

function todayKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function tomorrowKey(date = new Date()) {
  const kst = new Date(date.getTime() + 33 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function cleanText(value, max = 120) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function stripPublisher(title) {
  return cleanText(String(title || '').replace(/\s+-\s+[^-]{2,30}$/g, ''), 120);
}

function isBlocked(text) {
  const source = String(text || '').toLowerCase();
  return BLOCK_WORDS.some(word => source.includes(word.toLowerCase()));
}

function parseItems(xml, source) {
  const items = [];
  const itemBlocks = String(xml || '').match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks.slice(0, 40)) {
    const title = cleanText((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '', 160);
    const link = cleanText((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '', 300);
    const pubDate = cleanText((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '', 80);
    const cleanTitle = stripPublisher(title);
    if (!cleanTitle || isBlocked(cleanTitle)) continue;
    items.push({ title: cleanTitle, rawTitle: title, link, pubDate, sourceKey: source.key, category: source.name });
  }
  return items;
}

function extractKeywords(title) {
  const stop = new Set(['오늘', '내일', '논란', '공개', '발표', '관련', '속보', '종합', '단독', '기자', '뉴스', '영상', '사진', '이슈', '한국', '서울', '공식', '확인']);
  const words = String(title || '')
    .replace(/[\[\](){}'"“”‘’.,!?…:;·|]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && w.length <= 16 && !stop.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].slice(0, 8);
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
  return [...map.values()]
    .map(issue => ({
      keyword: issue.keyword,
      title: issue.title,
      category: issue.category,
      sampleTitles: [...new Set(issue.titles)].slice(0, 5),
      sourceCount: issue.sourceKeys.size,
      mentionCount: issue.titles.length,
      hotScore: Math.min(99, Math.round(issue.score + issue.sourceKeys.size * 8 + issue.titles.length * 3))
    }))
    .filter(issue => issue.mentionCount >= 2 || issue.sourceCount >= 2)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 10);
}

function makeBoardsFromIssues(issues, dateKey = todayKey()) {
  const top = issues[0] || { keyword: '오늘의 핫이슈', title: '오늘의 핫이슈', category: '종합', hotScore: 80, sampleTitles: [] };
  const second = issues[1] || { keyword: '추격 이슈', title: '추격 이슈', category: '종합', hotScore: 70, sampleTitles: [] };
  const categories = [...new Set(issues.map(i => i.category).filter(Boolean))].slice(0, 4);
  const categoryOptions = (categories.length ? categories : ['연예/방송', '스포츠', 'IT/게임', '날씨/생활']).map((label, idx) => ({
    id: `cat_${idx}`,
    label,
    odds: [2.0, 2.2, 2.5, 2.8][idx] || 2.4
  }));

  return [
    {
      id: `${dateKey}-hot-issue-survive`,
      dateKey,
      status: 'open',
      category: '핫이슈 생존',
      title: `“${top.keyword}” 이슈, 내일도 TOP5에 남을까?`,
      issue: top.keyword,
      sourceTitle: top.title,
      summary: `오늘 ${top.category} 쪽에서 가장 강하게 잡힌 키워드는 “${top.keyword}”입니다. 내일까지 이슈가 살아남을지 예측하세요.`,
      question: `내일 오후 6시 기준, “${top.keyword}” 이슈가 다시 TOP5 안에 들어올까?`,
      options: [
        { id: 'survive', label: '남는다', odds: 1.7 },
        { id: 'fade', label: '사라진다', odds: 1.9 }
      ],
      closeAtText: '오늘 23:59',
      resultAtText: '내일 18:00',
      resultRule: '내일 자동 수집된 핫이슈 TOP5 키워드 기준',
      heat: top.hotScore,
      participants: 0,
      aiComment: `수집 데이터 기준 “${top.keyword}” 관련 언급이 많이 반복됐습니다. 하루짜리인지, 내일까지 이어질지가 관전 포인트입니다.`,
      issueKeyword: top.keyword,
      sampleTitles: top.sampleTitles || [],
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    },
    {
      id: `${dateKey}-trend-category-winner`,
      dateKey,
      status: 'open',
      category: '카테고리 예측',
      title: '내일 가장 뜨거운 이슈 카테고리는?',
      issue: '카테고리 흐름',
      summary: '오늘 수집된 이슈들을 기준으로, 내일 어떤 카테고리가 가장 강할지 예측합니다.',
      question: '내일 핫이슈 TOP5 중 가장 많이 등장할 카테고리는?',
      options: categoryOptions,
      closeAtText: '오늘 23:59',
      resultAtText: '내일 18:00',
      resultRule: '내일 자동 수집 TOP5 이슈의 카테고리 최다 등장 기준',
      heat: Math.max(70, Math.min(99, Math.round((issues[0]?.hotScore || 70) * 0.9))),
      participants: 0,
      aiComment: '카테고리 예측은 단일 이슈보다 변수가 많아서 역전 재미가 큽니다.',
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    },
    {
      id: `${dateKey}-second-place-reverse`,
      dateKey,
      status: 'open',
      category: '역전 예측',
      title: `“${second.keyword}” 이슈가 내일 1위로 올라설까?`,
      issue: second.keyword,
      sourceTitle: second.title,
      summary: `현재 추격 중인 “${second.keyword}” 이슈가 내일 가장 뜨거운 이슈로 올라설지 예측합니다.`,
      question: `내일 오후 6시 기준, “${second.keyword}” 이슈가 1위로 역전할까?`,
      options: [
        { id: 'reverse', label: '역전한다', odds: 2.6 },
        { id: 'no_reverse', label: '못 한다', odds: 1.55 }
      ],
      closeAtText: '오늘 23:59',
      resultAtText: '내일 18:00',
      resultRule: '내일 자동 수집 핫이슈 점수 1위 여부 기준',
      heat: second.hotScore,
      participants: 0,
      aiComment: `“${second.keyword}”는 현재 추격 흐름입니다. 다음날 언급량이 더 붙으면 역전판이 될 수 있습니다.`,
      issueKeyword: second.keyword,
      sampleTitles: second.sampleTitles || [],
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    }
  ];
}

async function collectIssues() {
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
  const issues = await collectIssues();
  const boards = makeBoardsFromIssues(issues, dateKey);
  const batch = db.batch();
  const issueRef = db.doc(`daily_issues/${dateKey}`);
  batch.set(issueRef, { dateKey, issues, collectedAt: FieldValue.serverTimestamp(), collectedAtMs: Date.now(), source: 'rss' }, { merge: true });
  boards.forEach(board => {
    const { id, ...data } = board;
    batch.set(db.doc(`prediction_boards/${id}`), force ? data : { ...data, participants: FieldValue.increment(0) }, { merge: true });
  });
  await batch.commit();
  return { dateKey, issues, boards: boards.map(({ id, ...data }) => ({ id, ...data })) };
}

function boardWinnerFromIssues(board, tomorrowIssues = []) {
  const options = Array.isArray(board.options) ? board.options : [];
  if (!options.length) return null;
  if (board.id.includes('hot-issue-survive')) {
    const keyword = board.issueKeyword || board.issue;
    const alive = tomorrowIssues.slice(0, 5).some(issue => issue.keyword === keyword || issue.title.includes(keyword));
    return options.find(o => o.id === (alive ? 'survive' : 'fade')) || options[0];
  }
  if (board.id.includes('second-place-reverse')) {
    const keyword = board.issueKeyword || board.issue;
    const reverse = tomorrowIssues[0] && (tomorrowIssues[0].keyword === keyword || tomorrowIssues[0].title.includes(keyword));
    return options.find(o => o.id === (reverse ? 'reverse' : 'no_reverse')) || options[0];
  }
  if (board.id.includes('trend-category-winner')) {
    const counts = new Map();
    tomorrowIssues.slice(0, 5).forEach(issue => counts.set(issue.category, (counts.get(issue.category) || 0) + 1));
    const winnerCategory = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return options.find(o => o.label === winnerCategory) || options[0];
  }
  const seed = String(board.id || board.title || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return options[seed % options.length];
}

const collectHotIssues = onCall({ region: 'asia-northeast3', timeoutSeconds: 120 }, async () => {
  const result = await saveIssuesAndBoards({ force: true });
  return { ok: true, ...result };
});

const scheduledCollectHotIssues = onSchedule({ region: 'asia-northeast3', schedule: 'every day 09:00', timeZone: 'Asia/Seoul', timeoutSeconds: 300 }, async () => {
  await saveIssuesAndBoards({ force: false });
  return null;
});

const scheduledRefreshHotIssues = onSchedule({ region: 'asia-northeast3', schedule: 'every day 21:00', timeZone: 'Asia/Seoul', timeoutSeconds: 300 }, async () => {
  await saveIssuesAndBoards({ force: false });
  return null;
});

module.exports = {
  collectHotIssues,
  scheduledCollectHotIssues,
  scheduledRefreshHotIssues,
  collectIssues,
  boardWinnerFromIssues
};
