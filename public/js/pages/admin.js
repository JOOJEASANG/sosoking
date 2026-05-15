import { db, auth } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs, deleteDoc, doc, getCountFromServer } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';

const ADMIN_UIDS = []; // 관리자 UID 목록 (운영 시 추가)

export async function renderAdmin() {
  const el = document.getElementById('page-content');
  const user = appState.user;

  if (!user) { navigate('/login'); return; }
  if (ADMIN_UIDS.length && !ADMIN_UIDS.includes(user.uid)) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__title">관리자 전용 페이지예요</div></div>`;
    return;
  }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const [totalPosts, recentPosts] = await Promise.all([
    countDocs('feeds'),
    fetchRecent('feeds', 10),
  ]);

  el.innerHTML = `
    <div>
      <div class="section-header">
        <h1 class="section-title">관리자 대시보드</h1>
      </div>

      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__num">${totalPosts}</div>
          <div class="admin-stat-card__label">총 게시물</div>
        </div>
      </div>

      <div class="section-header" style="margin-top:24px">
        <h2 class="section-title">최근 게시물</h2>
      </div>
      <div class="card">
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--color-border);text-align:left">
              <th style="padding:10px 12px">제목</th>
              <th style="padding:10px 12px">유형</th>
              <th style="padding:10px 12px">작성자</th>
              <th style="padding:10px 12px">작업</th>
            </tr>
          </thead>
          <tbody>
            ${recentPosts.map(p => `
              <tr style="border-bottom:1px solid var(--color-border-light)">
                <td style="padding:10px 12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  <a href="#/detail/${p.id}" style="color:var(--color-primary)">${escHtml(p.title||'(제목없음)')}</a>
                </td>
                <td style="padding:10px 12px"><span class="badge badge--gray">${p.type||''}</span></td>
                <td style="padding:10px 12px">${escHtml(p.authorName||'익명')}</td>
                <td style="padding:10px 12px">
                  <button class="btn btn--danger btn--sm" data-delete="${p.id}">삭제</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 게시물을 삭제할까요?')) return;
      try {
        await deleteDoc(doc(db, 'feeds', btn.dataset.delete));
        btn.closest('tr').remove();
        toast.success('삭제됐어요');
      } catch { toast.error('삭제에 실패했어요'); }
    });
  });
}

async function countDocs(col) {
  try {
    const snap = await getCountFromServer(collection(db, col));
    return snap.data().count;
  } catch { return '?'; }
}

async function fetchRecent(col, n) {
  try {
    const q = query(collection(db, col), orderBy('createdAt', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
