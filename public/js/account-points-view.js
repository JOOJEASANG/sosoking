import { auth, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

async function renderPoints() {
  if (!auth.currentUser) return;
  const page = document.querySelector('.account-profile-card .account-stats');
  if (!page || page.dataset.pointsReady === '1') return;
  page.dataset.pointsReady = '1';

  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null);
  const data = snap?.exists?.() ? snap.data() : {};
  const points = Number(data.points || data.totalPoints || 0);

  page.insertAdjacentHTML('beforeend', `
    <div class="account-stat account-stat--points">
      <div class="account-stat__num">${formatPoint(points)}</div>
      <div class="account-stat__label">포인트</div>
    </div>`);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(renderPoints, 250);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
