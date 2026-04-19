import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const TITLES = { terms: '이용약관', privacy: '개인정보처리방침', ai_disclaimer: 'AI 서비스 안내' };

export async function renderPolicy(container, type) {
  container.innerHTML = `
    <div class="page-header">
      <a href="#/" class="back-btn">‹</a>
      <span class="logo">${TITLES[type] || '정책'}</span>
    </div>
    <div class="container" style="padding:28px 20px 60px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  try {
    const snap = await getDoc(doc(db, 'policy_docs', type));
    const content = snap.exists() ? snap.data().content : '아직 등록된 내용이 없습니다.';
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${content}</div>`;
  } catch {
    container.querySelector('.container').innerHTML = `<div style="color:var(--cream-dim);">불러오지 못했습니다.</div>`;
  }
}
