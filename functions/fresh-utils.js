const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function cleanBlock(value, max = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}
function pick(arr, seed = '') {
  const s = String(seed || Date.now());
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[n % arr.length];
}
function docketNumber() {
  const y = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()).replace(/\D/g, '') || new Date().getFullYear();
  return `${y}황당-${Math.floor(1000 + Math.random() * 9000)}`;
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function buildModel(key, modelName, temperature = 0.95) {
  return new GoogleGenerativeAI(key.trim()).getGenerativeModel({
    model: modelName || 'gemini-2.5-flash',
    generationConfig: { temperature, topP: 0.96, topK: 40, responseMimeType: 'application/json' }
  });
}
async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function titleFromDescription(desc) {
  const t = clean(desc, 100);
  if (/개|강아지|리트리버|반려견|댕댕|견주/.test(t) && /빵|샌드위치|베이글|크루아상|소금빵|간식/.test(t)) return '공원 리트리버 빵 무단섭취 사건';
  if (/카누|커피|탕비실/.test(t)) return '탕비실 마지막 카누 봉지 방치 사건';
  if (/방|문|동생/.test(t)) return '동생의 방문 미닫힘 반복 사건';
  if (/이어폰/.test(t)) return '침대 밑 이어폰 한쪽 실종 사건';
  const short = t.replace(/[.!?。！？].*$/g, '').slice(0, 28).trim() || '소소한 일상';
  return short.endsWith('사건') ? short : `${short} 사건`;
}

module.exports = { db, FieldValue, REGION, clean, cleanBlock, pick, docketNumber, safeJson, buildModel, loadSettings, kstDateKey, titleFromDescription };
