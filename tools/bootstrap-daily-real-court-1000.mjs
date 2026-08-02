import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();
const API_ROOT = 'https://www.law.go.kr/DRF';
const API_OC = String(process.env.LAW_OPEN_API_OC || 'test').trim();
const TARGET_SIZE = Math.max(3, Math.min(1000, Math.floor(Number(process.env.DAILY_COURT_TARGET_SIZE) || 1000)));
const START_DATE = '20200101';
const BOOTSTRAP_VERSION = 'law-open-data-ox-v1';
const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 80;
const DETAIL_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 4;

const ALLOWED_CASE_TYPES = ['민사', '행정', '세무', '특허', '가사'];
const BLOCKED_TERMS = [
  '강간', '강제추행', '성폭력', '성매매', '음란', '아동학대', '가정폭력',
  '살인', '사망', '시체', '자살', '마약', '폭행', '상해', '감금', '유괴',
  '살해', '성범죄', '스토킹', '도박', '뇌물', '테러', '국가보안', '군사기밀',
  '이혼', '친권', '양육권', '입양취소'
];

function compact(value, max = 1000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) || 32));
}

function plainText(value = '') {
  return decodeEntities(String(value || ''))
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dateDigits(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(0, 8) : '';
}

function isoDate(value = '') {
  const digits = dateDigits(value);
  return digits ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : '';
}

function todayDigits() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()).replace(/-/g, '');
}

function arrayOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function listPayload(json = {}) {
  const payload = json.PrecSearch || json.precSearch || json;
  return {
    total: Number(payload.totalCnt || payload.totalCount || 0),
    items: arrayOf(payload.prec || payload.Prec || payload.items || payload.item)
  };
}

function detailPayload(json = {}) {
  return json.PrecService || json.precService || json;
}

function hasBlockedTerm(text = '') {
  const source = compact(text, 5000);
  return BLOCKED_TERMS.some(term => source.includes(term));
}

function eligibleListItem(item = {}) {
  const decided = dateDigits(item.선고일자 || item.decidedAt);
  if (!decided || decided < START_DATE || decided > todayDigits()) return false;
  const type = compact(item.사건종류명 || item.caseType, 40);
  if (type && !ALLOWED_CASE_TYPES.some(allowed => type.includes(allowed))) return false;
  const headline = `${item.사건명 || ''} ${item.법원명 || ''} ${type}`;
  return !hasBlockedTerm(headline);
}

function splitIssueBlocks(value = '') {
  const text = plainText(value)
    .replace(/\s*(?=\[\d+\]\s*)/g, '\n')
    .replace(/\s+(?=\d+\.\s+)/g, '\n')
    .replace(/\n{2,}/g, '\n');
  const chunks = text.split(/\n(?=(?:\[\d+\]|\d+\.|[가-하]\.))/).map(part => compact(part, 1200));
  return chunks.filter(Boolean);
}

function selectBinaryIssue(issueText = '') {
  const blocks = splitIssueBlocks(issueText);
  const candidates = blocks.filter(block => /\((?:적극|소극)\)/.test(block));
  const selected = candidates.find(block => block.length >= 25 && block.length <= 650) || candidates[0];
  if (!selected) return null;
  const positive = selected.includes('(적극)');
  const negative = selected.includes('(소극)');
  if (positive === negative) return null;
  const question = compact(selected
    .replace(/^\[\d+\]\s*|^\d+\.\s*|^[가-하]\.\s*/, '')
    .replace(/\((?:적극|소극)\)/g, '')
    .replace(/[.。]\s*$/, ''), 520);
  if (question.length < 18 || hasBlockedTerm(question)) return null;
  return { positive, question, selected, blocks };
}

function categoryFor(text = '') {
  const value = compact(text, 4000);
  const mappings = [
    ['주거·임대차', ['임대차', '전세', '월세', '아파트', '공동주택', '주차장', '집합건물']],
    ['직장·노동', ['근로자', '임금', '퇴직금', '해고', '근로계약', '산업재해', '노동조합']],
    ['소비자·계약', ['소비자', '매매', '계약금', '위약금', '약관', '전자상거래', '용역', '하자']],
    ['교통·보험', ['자동차', '교통사고', '보험금', '보험계약', '운송', '주차']],
    ['개인정보·명예', ['개인정보', '초상권', '명예훼손', '게시물', '인터넷', '정보통신']],
    ['가족·상속', ['상속', '유류분', '유언', '부양', '혼인', '재산분할']],
    ['지식재산', ['특허', '상표', '저작권', '디자인권', '영업비밀']],
    ['세금·행정', ['과세', '부가가치세', '소득세', '법인세', '행정처분', '취소소송']],
    ['금융·채권', ['대출', '채권', '채무', '보증', '이자', '신용카드', '예금']]
  ];
  return mappings.find(([, terms]) => terms.some(term => value.includes(term)))?.[0] || '생활·민사';
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function funLineFor(id, positive) {
  const positiveLines = [
    '길었던 법률문장을 한 글자로 줄이면 이번 답은 O였습니다.',
    '재판부의 OX판은 이번 쟁점에서 O 쪽으로 기울었습니다.',
    '법률용어는 길었지만 결론표시는 또렷하게 O였습니다.'
  ];
  const negativeLines = [
    '긴 판결문 끝에 남은 한 글자는 이번에는 X였습니다.',
    '재판부는 그 주장에 법률상 X 표시를 붙였습니다.',
    '가능해 보였던 주장도 판례의 OX판에서는 X였습니다.'
  ];
  const lines = positive ? positiveLines : negativeLines;
  return lines[stableHash(id) % lines.length];
}

function sourceSequence(item = {}, detail = {}) {
  return compact(detail.판례일련번호 || item.판례일련번호 || item.ID || item.id, 30).replace(/\D/g, '');
}

function sourceUrlFor(sequence) {
  return `https://www.law.go.kr/LSW/precInfoP.do?precSeq=${sequence}`;
}

function caseIdFor(sequence) {
  return `law-prec-${sequence}`;
}

function buildCase(item = {}, detailJson = {}) {
  const detail = detailPayload(detailJson);
  const sequence = sourceSequence(item, detail);
  if (!sequence) return null;

  const caseName = compact(detail.사건명 || item.사건명, 120);
  const court = compact(detail.법원명 || item.법원명, 80);
  const caseNumber = compact(detail.사건번호 || item.사건번호, 60);
  const decidedAt = isoDate(detail.선고일자 || item.선고일자);
  const issueText = plainText(detail.판시사항);
  const holdingText = plainText(detail.판결요지);
  const caseType = compact(detail.사건종류명 || item.사건종류명, 40);
  if (!caseName || !court || !caseNumber || !decidedAt || decidedAt.replace(/-/g, '') < START_DATE) return null;
  if (caseType && !ALLOWED_CASE_TYPES.some(type => caseType.includes(type))) return null;
  if (hasBlockedTerm(`${caseName} ${issueText} ${holdingText}`)) return null;

  const binary = selectBinaryIssue(issueText);
  if (!binary) return null;

  const id = caseIdFor(sequence);
  const questionBody = binary.question;
  const reasoningSource = compact(holdingText || binary.selected, 1000);
  const article = compact(plainText(detail.참조조문), 240);
  const secondaryIssue = binary.blocks
    .map(block => compact(block.replace(/\((?:적극|소극)\)/g, ''), 260))
    .find(block => block && block !== compact(binary.selected.replace(/\((?:적극|소극)\)/g, ''), 260));
  const evidence = [
    `${court} ${decidedAt} 선고 ${caseNumber}`,
    article ? `관련 조문: ${article}` : `공식 판례 일련번호: ${sequence}`,
    secondaryIssue ? `함께 다뤄진 쟁점: ${secondaryIssue}` : `사건 분야: ${caseType || '민사·행정'}`
  ].filter(Boolean).slice(0, 3);

  return {
    id,
    title: compact(caseName, 58),
    category: categoryFor(`${caseName} ${questionBody} ${holdingText}`),
    court,
    caseNumber,
    decidedAt,
    sourceUrl: sourceUrlFor(sequence),
    sourceLabel: '국가법령정보센터 판례',
    summary: compact(`「${caseName}」 사건에서 '${questionBody}'가 핵심 쟁점이 됐다. 실제 결론은 판결을 선택한 뒤 공개된다.`, 520),
    question: compact(`${questionBody} — 법원의 판단은?`, 560),
    choices: [
      { id: 'yes', label: 'O · 그렇다, 법원도 인정했다' },
      { id: 'no', label: 'X · 아니다, 그렇게 보지 않았다' }
    ],
    correctChoiceId: binary.positive ? 'yes' : 'no',
    reasoning: compact(reasoningSource, 1000),
    funLine: funLineFor(id, binary.positive),
    evidence,
    sourcePrecSeq: sequence,
    generatedFrom: BOOTSTRAP_VERSION,
    quizFormat: 'official-ox'
  };
}

async function fetchJson(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json,text/plain,*/*', 'user-agent': 'sosoking-daily-court-catalog/1.0' }
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    return JSON.parse(body.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (attempt >= MAX_RETRIES) throw error;
    await new Promise(resolve => setTimeout(resolve, 700 * (2 ** (attempt - 1))));
    return fetchJson(url, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function apiUrl(endpoint, params) {
  const url = new URL(`${API_ROOT}/${endpoint}`);
  url.search = new URLSearchParams({ OC: API_OC, type: 'JSON', ...params }).toString();
  return url.toString();
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        console.warn(`detail skipped: ${error.message}`);
        results[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function existingSequence(data = {}) {
  const explicit = String(data.sourcePrecSeq || '').replace(/\D/g, '');
  if (explicit) return explicit;
  return String(data.sourceUrl || '').match(/[?&]precSeq=(\d+)/)?.[1] || '';
}

function sortNewest(a, b) {
  return String(b.decidedAt || '').localeCompare(String(a.decidedAt || ''))
    || String(a.id || '').localeCompare(String(b.id || ''));
}

function categoryRoundRobin(items) {
  const groups = new Map();
  for (const item of [...items].sort(sortNewest)) {
    const category = String(item.category || '생활·민사');
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  const orderedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko-KR'));
  const result = [];
  while (orderedGroups.some(([, group]) => group.length)) {
    for (const [, group] of orderedGroups) {
      if (group.length) result.push(group.shift());
    }
  }
  return result;
}

function buildOrder(items) {
  const modern = items.filter(item => String(item.decidedAt || '').replace(/-/g, '') >= START_DATE);
  const legends = items.filter(item => String(item.decidedAt || '').replace(/-/g, '') < START_DATE).sort(sortNewest);
  const modernOrder = categoryRoundRobin(modern);
  const ordered = [];
  let legendIndex = 0;
  modernOrder.forEach((item, index) => {
    ordered.push(item);
    if ((index + 1) % 15 === 0 && legendIndex < legends.length) ordered.push(legends[legendIndex++]);
  });
  ordered.push(...legends.slice(legendIndex));
  return ordered.slice(0, TARGET_SIZE);
}

async function writeCases(cases) {
  for (let offset = 0; offset < cases.length; offset += 400) {
    const batch = db.batch();
    cases.slice(offset, offset + 400).forEach(item => {
      batch.set(db.doc(`daily_court_catalog/${item.id}`), {
        ...item,
        active: true,
        syncedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }
}

async function updateCatalogConfig() {
  const snapshot = await db.collection('daily_court_catalog').get();
  const active = snapshot.docs
    .filter(doc => doc.data()?.active !== false)
    .map(doc => ({ id: doc.id, ...doc.data() }));
  const ordered = buildOrder(active);
  if (ordered.length < TARGET_SIZE) {
    throw new Error(`오늘의 재판 카탈로그가 ${ordered.length}건으로 목표 ${TARGET_SIZE}건에 미달합니다.`);
  }
  const categoryCounts = ordered.reduce((counts, item) => {
    const category = String(item.category || '생활·민사');
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  await db.doc('daily_court_config/catalog').set({
    orderedCaseIds: ordered.map(item => item.id),
    size: ordered.length,
    dailyCaseCount: 3,
    targetSize: TARGET_SIZE,
    source: '국가법령정보센터 공식 판례 OX 카탈로그',
    bootstrapVersion: BOOTSTRAP_VERSION,
    categoryCounts,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return ordered;
}

const existingSnapshot = await db.collection('daily_court_catalog').get();
const existingItems = existingSnapshot.docs
  .filter(doc => doc.data()?.active !== false)
  .map(doc => ({ id: doc.id, ...doc.data() }));
const existingIds = new Set(existingItems.map(item => item.id));
const existingSequences = new Set(existingItems.map(existingSequence).filter(Boolean));

if (existingItems.length >= TARGET_SIZE) {
  const ordered = await updateCatalogConfig();
  console.log(JSON.stringify({ completed: true, reused: true, count: ordered.length, target: TARGET_SIZE }));
  process.exit(0);
}

const additions = [];
let totalAvailable = 0;
for (let page = 1; page <= MAX_LIST_PAGES && existingItems.length + additions.length < TARGET_SIZE; page += 1) {
  const listUrl = apiUrl('lawSearch.do', {
    target: 'prec', display: String(LIST_PAGE_SIZE), page: String(page), sort: 'ddes', prncYd: `${START_DATE}~${todayDigits()}`
  });
  const payload = listPayload(await fetchJson(listUrl));
  totalAvailable = Math.max(totalAvailable, payload.total);
  const candidates = payload.items.filter(eligibleListItem).filter(item => {
    const sequence = sourceSequence(item);
    return sequence && !existingSequences.has(sequence) && !existingIds.has(caseIdFor(sequence));
  });

  const built = await mapPool(candidates, DETAIL_CONCURRENCY, async item => {
    const sequence = sourceSequence(item);
    const detailUrl = apiUrl('lawService.do', { target: 'prec', ID: sequence });
    return buildCase(item, await fetchJson(detailUrl));
  });

  for (const gameCase of built.filter(Boolean)) {
    const sequence = String(gameCase.sourcePrecSeq || '');
    if (existingSequences.has(sequence) || existingIds.has(gameCase.id)) continue;
    existingSequences.add(sequence);
    existingIds.add(gameCase.id);
    additions.push(gameCase);
    if (existingItems.length + additions.length >= TARGET_SIZE) break;
  }
  console.log(JSON.stringify({ page, candidates: candidates.length, accepted: additions.length, target: TARGET_SIZE }));
  if (!payload.items.length || (payload.total && page * LIST_PAGE_SIZE >= payload.total)) break;
}

if (existingItems.length + additions.length < TARGET_SIZE) {
  throw new Error(`공식 판례를 ${existingItems.length + additions.length}건만 확보했습니다. 목표 ${TARGET_SIZE}건, API 검색 결과 ${totalAvailable}건입니다.`);
}

await writeCases(additions);
const ordered = await updateCatalogConfig();
console.log(JSON.stringify({
  completed: true,
  source: '국가법령정보센터 Open API',
  aiUsed: false,
  added: additions.length,
  count: ordered.length,
  target: TARGET_SIZE,
  newest: ordered[0]?.decidedAt || '',
  bootstrapVersion: BOOTSTRAP_VERSION
}));
