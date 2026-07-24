'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const dns = require('dns').promises;
const net = require('net');

const db = getFirestore();
const REGION = 'asia-northeast3';
const geminiKey = defineSecret('GEMINI_API_KEY');
const MAX_HTML_BYTES = 700000;
const FETCH_TIMEOUT_MS = 9000;

function requireRegisteredUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', '정식 회원 로그인 후 사용할 수 있습니다.');
  return uid;
}
function clean(value, max = 1000) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[<>]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}
function isPrivateIp(address) {
  if (!address || address === '::1') return true;
  if (/^(fc|fd|fe80)/i.test(address)) return true;
  if (net.isIPv4(address)) return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(address);
  return false;
}
async function assertPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host || ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.endsWith('.local') || host.endsWith('.internal')) throw new HttpsError('invalid-argument', '허용되지 않는 링크입니다.');
  if (net.isIP(host) && isPrivateIp(host)) throw new HttpsError('invalid-argument', '허용되지 않는 링크입니다.');
  let records;
  try { records = await dns.lookup(host, { all: true, verbatim: true }); }
  catch { throw new HttpsError('invalid-argument', '링크 주소를 확인할 수 없습니다.'); }
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new HttpsError('invalid-argument', '허용되지 않는 링크입니다.');
}
async function validateUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); }
  catch { throw new HttpsError('invalid-argument', 'URL 형식이 올바르지 않습니다.'); }
  if (url.protocol !== 'https:') throw new HttpsError('invalid-argument', 'HTTPS 링크만 요약할 수 있습니다.');
  await assertPublicHost(url.hostname);
  return url;
}
function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
async function reserve(uid) {
  const ref = db.doc(`rate_limits/link_summary_${todayKST()}_${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = Number(snap.exists ? snap.data()?.count || 0 : 0);
    if (count >= 20) throw new HttpsError('resource-exhausted', '오늘 링크 요약 한도를 초과했습니다.');
    tx.set(ref, { uid, action: 'link_summary', count: FieldValue.increment(1), limit: 20, day: todayKST(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) return clean(match[1], 300);
  }
  return '';
}
async function readLimited(response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_HTML_BYTES) throw new HttpsError('invalid-argument', '페이지가 너무 큽니다.');
  const reader = response.body?.getReader?.();
  if (!reader) return (await response.text()).slice(0, MAX_HTML_BYTES);
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_HTML_BYTES) throw new HttpsError('invalid-argument', '페이지가 너무 큽니다.');
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function summarize(page, url) {
  const apiKey = String(geminiKey.value() || '').trim();
  if (!apiKey) throw new HttpsError('failed-precondition', 'AI 요약 키가 설정되어 있지 않습니다.');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash-lite', generationConfig: { responseMimeType: 'application/json' } });
  const prompt = `다음 웹페이지를 한국어로 요약하세요. 원문을 길게 복사하지 말고 JSON만 출력하세요.\n형식: {"title":"40자 이내","summary":"2문장 이내","points":["핵심1","핵심2","핵심3"]}\nURL: ${url}\n제목: ${page.title}\n설명: ${page.description}\n본문: ${page.body.slice(0, 4500)}`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text().replace(/```json|```/g, '').trim();
  try {
    const json = JSON.parse(raw);
    return { title: clean(json.title || page.title, 80), summary: clean(json.summary || page.description, 260), points: (Array.isArray(json.points) ? json.points : []).map(item => clean(item, 90)).filter(Boolean).slice(0, 3) };
  } catch {
    return { title: clean(page.title, 80), summary: clean(raw || page.description, 260), points: [] };
  }
}

const summarizeLink = onCall({ region: REGION, timeoutSeconds: 45, secrets: [geminiKey] }, async request => {
  const uid = requireRegisteredUser(request);
  await reserve(uid);
  const requested = await validateUrl(request.data?.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(requested, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'SosokingBot/1.0 (+https://sosoking.co.kr)', accept: 'text/html,application/xhtml+xml' } });
  } catch {
    throw new HttpsError('unavailable', '링크 내용을 불러오지 못했습니다.');
  } finally { clearTimeout(timeout); }
  const finalUrl = new URL(response.url || requested.toString());
  if (finalUrl.protocol !== 'https:') throw new HttpsError('invalid-argument', 'HTTPS 링크만 요약할 수 있습니다.');
  await assertPublicHost(finalUrl.hostname);
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) throw new HttpsError('invalid-argument', 'HTML 페이지를 불러오지 못했습니다.');
  const html = await readLimited(response);
  const title = clean(meta(html, 'og:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || finalUrl.hostname, 120);
  const description = clean(meta(html, 'description') || meta(html, 'og:description'), 320);
  const body = clean(html.replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' '), 5500);
  return { ok: true, url: finalUrl.toString(), source: finalUrl.hostname.replace(/^www\./, ''), ...(await summarize({ title, description, body }, finalUrl.toString())) };
});

module.exports = { summarizeLink };
