const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const REGION = 'asia-northeast3';

function clean(value, max = 500) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanBlock(value, max = 4000) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
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
function keywordTokens(text, max = 5) {
  const stop = new Set(['그리고','그래서','근데','아니','진짜','너무','정말','내가','제가','나를','나의','하는','했다','했는데','있다','없는','같은','그냥','사건','오늘','어제','갑자기','자꾸','계속','때문에','에서','으로','에게','한테','부터','까지']);
  return Array.from(new Set(String(text || '').match(/[가-힣A-Za-z0-9]{2,}/g) || []))
    .map(x => clean(x, 20))
    .filter(x => x && !stop.has(x) && !/^[0-9]+$/.test(x))
    .slice(0, max);
}
function titleFromDescription(desc) {
  const t = clean(desc, 160);
  const tokens = keywordTokens(t, 4);
  let base = tokens.join(' ');
  if (!base) base = t.replace(/[.!?。！？].*$/g, '').slice(0, 28).trim() || '소소한 일상';
  if (base.length > 32) base = base.slice(0, 32).trim();
  return base.endsWith('사건') ? base : `${base} 사건`;
}

module.exports = { db, FieldValue, REGION, clean, cleanBlock, pick, docketNumber, safeJson, buildModel, loadSettings, kstDateKey, keywordTokens, titleFromDescription };
