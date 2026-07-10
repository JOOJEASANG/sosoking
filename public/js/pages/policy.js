import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { policyDefault, POLICY_EFFECTIVE_DATE } from '../data/default-policy-docs.js?v=20260710-full-audit1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const POLICY_TYPES = {
  terms: ['이용약관','서비스 이용 조건'],
  privacy: ['개인정보처리방침','처리 정보와 이용자 권리'],
  ai_disclaimer: ['AI 서비스 안내','AI 생성 과정과 주의사항'],
};

function safePolicyType(type) {
  return Object.hasOwn(POLICY_TYPES, type) ? type : 'terms';
}

function replaceBusinessInfo(content, business = {}) {
  const values = {
    companyName: business.companyName || '소소킹 황당재판소',
    email: business.email || '운영자 이메일 준비 중',
    contact: business.contact || '운영자 연락처 준비 중',
    address: business.address || '운영자 주소 준비 중',
  };
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), String(content || ''));
}

function isStaleStoredPolicy(type, content = '') {
  const source = String(content);
  if (!source.trim()) return true;
  if (source.includes('2026년 7월 8일')) return true;
  if (source.includes('웃김 점수') || source.includes('소소 형량')) return true;
  if (type === 'guide' && source.includes('AI가 접수관, 수사관, 변호사, 판사를 혼자 다 합니다')) return true;
  if (type === 'terms' && !source.includes('원고측') && !source.includes('피고측')) return true;
  return false;
}

function policyTabs(activeType) {
  return `<nav class="policy-tabs" aria-label="운영 정책">
    ${Object.entries(POLICY_TYPES).map(([type,[title]]) => `<a href="#/policy/${type}" class="${type === activeType ? 'active' : ''}">${escapeHtml(title)}</a>`).join('')}
    <a href="#/guide">이용안내</a>
  </nav>`;
}

function businessCard(business = {}) {
  const rows = [
    ['운영자', business.companyName],
    ['이메일', business.email],
    ['연락처', business.contact],
    ['주소', business.address],
    ['사업자등록번호', business.businessNumber],
    ['통신판매업 신고번호', business.ecommerceNumber],
  ].filter(([,value]) => String(value || '').trim());
  if (!rows.length) return '';
  return `<section class="card" style="padding:18px;margin-top:14px;">
    <div class="court-kicker">OPERATOR INFORMATION</div>
    <div style="display:grid;gap:8px;margin-top:10px;">${rows.map(([label,value]) => `<div style="display:grid;grid-template-columns:110px 1fr;gap:10px;font-size:12px;line-height:1.65;"><strong style="color:var(--gold);">${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('')}</div>
  </section>`;
}

export async function renderPolicy(container, type) {
  const safeType = safePolicyType(type);
  const fallback = policyDefault(safeType);
  const [policySnap, settingsSnap] = await Promise.all([
    getDoc(doc(db, 'policy_docs', safeType)).catch(() => null),
    getDoc(doc(db, 'public_settings', 'config')).catch(() => null),
  ]);
  const stored = policySnap?.exists() ? policySnap.data() : {};
  const settings = settingsSnap?.exists() ? settingsSnap.data() : {};
  const business = settings.businessInfo || settings.business || settings;
  const useFallback = isStaleStoredPolicy(safeType, stored.content);
  const title = useFallback ? fallback.title : String(stored.title || fallback.title);
  const summary = useFallback ? fallback.summary : String(stored.summary || fallback.summary || POLICY_TYPES[safeType][1]);
  const content = replaceBusinessInfo(useFallback ? fallback.content : stored.content, business);

  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">운영 정책</span></div>
      <main class="container" style="padding-top:22px;padding-bottom:90px;max-width:780px;">
        <section class="court-shell policy-hero">
          <div class="policy-kicker">SOSOKING SERVICE POLICY</div>
          <h1 class="policy-title">${escapeHtml(title)}</h1>
          <p class="policy-summary">${escapeHtml(summary)}</p>
          <div class="policy-updated">현재 기본 정책 시행일 · ${escapeHtml(POLICY_EFFECTIVE_DATE)}</div>
        </section>
        ${policyTabs(safeType)}
        <article class="card policy-document">${escapeHtml(content)}</article>
        ${businessCard(business)}
        <div class="disclaimer" style="margin-top:14px;"><strong>안내</strong><br>본 문서는 현재 서비스 기능과 데이터 흐름을 기준으로 정리한 운영 정책입니다. 사업 형태나 적용 법령에 따라 전문적인 법률 검토와 추가 보완이 필요할 수 있습니다.</div>
      </main>
    </div>`;
}
