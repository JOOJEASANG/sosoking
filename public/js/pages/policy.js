import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { DEFAULT_POLICY_DOCS, policyDefault } from '../data/default-policy-docs.js?v=20260708-1';

const TITLES = Object.fromEntries(Object.entries(DEFAULT_POLICY_DOCS).map(([key, policy]) => [key, policy.title]));

function applyBiz(text, biz) {
  return String(text || '')
    .replace(/{companyName}/g, biz.companyName || '소소킹 황당재판소')
    .replace(/{ceoName}/g, biz.ceoName || '')
    .replace(/{businessNumber}/g, biz.businessNumber || '')
    .replace(/{contact}/g, biz.contact || '')
    .replace(/{email}/g, biz.email || '')
    .replace(/{address}/g, biz.address || '');
}

function bizInfoHtml(biz) {
  if (!biz || !Object.values(biz).some(Boolean)) return '';
  const rows = [
    biz.companyName && `상호: ${biz.companyName}`,
    biz.ceoName && `대표자: ${biz.ceoName}`,
    biz.businessNumber && `사업자등록번호: ${biz.businessNumber}`,
    biz.contact && `연락처: ${biz.contact}`,
    biz.email && `이메일: ${biz.email}`,
    biz.address && `주소: ${biz.address}`,
  ].filter(Boolean).map(escapeHtml);
  if (!rows.length) return '';
  return `
    <div class="card" style="margin-top:32px;padding:16px;">
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">운영자 정보</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:2;">${rows.join('<br>')}</div>
    </div>`;
}

export async function renderPolicy(container, type) {
  const safeType = Object.prototype.hasOwnProperty.call(TITLES, type) ? type : 'terms';
  const fallback = policyDefault(safeType);
  container.innerHTML = `
    <div class="page-header">
      <a href="#/" class="back-btn">‹</a>
      <span class="logo">${escapeHtml(fallback.title || TITLES[safeType] || '정책')}</span>
    </div>
    <div class="container" style="padding:28px 20px 80px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  try {
    // Public policy content and public business information must fail independently.
    const [policySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'policy_docs', safeType)).catch(() => null),
      getDoc(doc(db, 'public_settings', 'config')).catch(() => null),
    ]);
    const biz = settingsSnap?.exists() ? (settingsSnap.data().businessInfo || {}) : {};
    const policy = policySnap?.exists() ? policySnap.data() : {};
    const title = policy.title || fallback.title || TITLES[safeType] || '정책';
    const raw = policy.content || fallback.content || '아직 등록된 내용이 없습니다.';
    const content = applyBiz(raw, biz);
    container.querySelector('.page-header .logo').textContent = title;
    container.querySelector('.container').innerHTML =
      `<div class="card" style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;padding:20px;">${escapeHtml(content)}</div>${bizInfoHtml(biz)}`;
  } catch (err) {
    console.error('policy render failed:', err);
    const content = fallback.content || '불러오지 못했습니다.';
    container.querySelector('.container').innerHTML =
      `<div class="card" style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;padding:20px;">${escapeHtml(content)}</div>`;
  }
}
