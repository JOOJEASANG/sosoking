const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const dns = require('dns').promises;
const net = require('net');

const db = getFirestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const SUMMARY_MODEL = 'gemini-2.5-flash-lite';
const MAX_HTML_BYTES = 700000;
const FETCH_TIMEOUT_MS = 9000;

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const BLOCK_WORDS = ['성인', '도박', '카지노', '토토', '불법', '마약', '폭력'];

function clean(value, max = 1000) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function isPrivateIp(address) {
  if (!address) return true;
  if (address === '::1') return true;
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80')) return true;
  if (net.isIPv4(address)) {
    return /^(10\.|127\.|169\.254\.|192\.168\.)/.test(address) || /^(172\.(1[6-9]|2\d|3[0-1])\.)/.test(address);
  }
  return false;
}

async function assertPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host || BLOCKED_HOSTS.includes(host) || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('허용되지 않는 링크입니다.');
  if (net.isIP(host) && isPrivateIp(host)) throw new Error('허용되지 않는 링크입니다.');
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error('허용되지 않는 링크입니다.');
  } catch (error) {
    if (error.message === '허용되지 않는 링크입니다.') throw error;
    throw new Error('링크 주소를 확인할 수 없습니다.');
  }
}

async function validateUrl(raw) {
  const url = new URL(String(raw || '').trim());
  if (url.protocol !== 'https:') throw new Error('https 링크만 요약할 수 있습니다.');
  await assertPublicHost(url.hostname);
  return url;
}

async function checkRateLimit(userId, action, maxCount, windowSeconds) {
  const ref = db.doc(`rate_limits/${userId}`);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const timestamps = (data[action] || []).filter(ts => Number(ts) > now - windowMs);
    if (timestamps.length >= maxCount) throw new Error('AI 요약 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    tx.set(ref, { [action]: [...timestamps, now].slice(-maxCount) }, { merge: true });
  });
}

function pickMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) return clean(match[1], 300);
  }
  return '';
}

function extractPage(html, url) {
  const title = clean(pickMeta(html, 'og:title') || (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || url.hostname, 120);
  const description = clean(pickMeta(html, 'description') || pickMeta(html, 'og:description'), 320);
  const body = clean(String(html || '').replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' '), 5500);
  return { title, description, body };
}

async function readLimitedText(res) {
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_HTML_BYTES) throw new Error('페이지가 너무 커서 요약할 수 없습니다.');
  const reader = res.body?.getReader?.();
  if (!reader) return (await res.text()).slice(0, MAX_HTML_BYTES);
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_HTML_BYTES) throw new Error('페이지가 너무 커서 요약할 수 없습니다.');
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function summarizeWithGemini({ title, description, body, url }) {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) throw new Error('AI 요약 키가 설정되어 있지 않습니다.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });
  const prompt = `아래 웹페이지를 소소킹 정보공유 피드용으로 요약해줘. 원문을 길게 복사하지 말고 한국어로 짧고 유용하게 정리해.\n\n규칙:\n- 제목 40자 이내\n- 요약 2문장 이내\n- 핵심 포인트 3개\n- 광고성/선정적 표현 제거\n- JSON만 반환\n\nURL: ${url}\n제목: ${title}\n설명: ${description}\n본문 일부: ${body.slice(0, 4500)}\n\n반환 형식: {"title":"","summary":"","points":["","",""]}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  try {
    const json = JSON.parse(text);
    return {
      title: clean(json.title || title, 80),
      summary: clean(json.summary || description, 260),
      points: Array.isArray(json.points) ? json.points.map(v => clean(v, 90)).filter(Boolean).slice(0, 3) : []
    };
  } catch {
    return { title: clean(title, 80), summary: clean(text || description, 260), points: [] };
  }
}

const summarizeLink = onCall({ region: 'asia-northeast3', timeoutSeconds: 45, secrets: [GEMINI_API_KEY] }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('로그인 후 링크 요약을 사용할 수 있습니다.');
  await checkRateLimit(userId, 'summarizeLink', 20, 86400);

  const url = await validateUrl(request.data?.url);
  const source = url.hostname.replace(/^www\./, '');
  if (BLOCK_WORDS.some(word => decodeURIComponent(url.toString()).includes(word))) throw new Error('요약할 수 없는 링크입니다.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'SosokingBot/1.0 (+https://sosoking.co.kr)', 'accept': 'text/html,application/xhtml+xml' }
    });
  } catch {
    throw new Error('링크 내용을 불러오지 못했습니다.');
  } finally {
    clearTimeout(timeout);
  }

  const finalUrl = new URL(res.url || url.toString());
  if (finalUrl.protocol !== 'https:') throw new Error('https 링크만 요약할 수 있습니다.');
  await assertPublicHost(finalUrl.hostname);

  if (!res.ok) throw new Error('링크 내용을 불러오지 못했습니다.');
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) throw new Error('HTML 페이지 링크만 요약할 수 있습니다.');
  const html = await readLimitedText(res);
  const page = extractPage(html, finalUrl);
  const ai = await summarizeWithGemini({ ...page, url: finalUrl.toString() });
  return {
    ok: true,
    url: finalUrl.toString(),
    source: finalUrl.hostname.replace(/^www\./, ''),
    model: SUMMARY_MODEL,
    estimatedCostLabel: 'Gemini Flash-Lite 기준: 무료 한도부터 시작, 유료 사용 시 링크 요약 1회는 보통 수 원 미만 예상',
    ...ai
  };
});

module.exports = { summarizeLink };