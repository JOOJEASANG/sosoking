import { auth, db, functions } from '/js/firebase.js?v=20260729-auth-session-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const moderateReport = httpsCallable(functions, 'moderateDripsoReport');
let dialog = null;
let list = null;
let status = null;
let built = false;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function formatDate(value) {
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  } catch {
    return '-';
  }
}

function errorMessage(error, fallback) {
  return String(error?.message || '')
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .dripso-admin-launch{position:fixed;right:18px;bottom:20px;z-index:180;width:auto;min-height:44px;padding:0 16px;border:1px solid var(--gold);border-radius:999px;background:var(--navy-light);color:var(--gold);font:800 12px 'Noto Sans KR',sans-serif;box-shadow:0 9px 24px rgba(0,0,0,.28);cursor:pointer}
    .dripso-admin-dialog{width:min(900px,calc(100% - 24px));max-height:86vh;padding:0;border:1px solid var(--border);border-radius:18px;background:var(--navy-light);color:var(--cream);box-shadow:0 24px 70px rgba(0,0,0,.5)}
    .dripso-admin-dialog::backdrop{background:rgba(0,0,0,.72)}
    .dripso-admin-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border);background:var(--navy-light);z-index:1}
    .dripso-admin-head h2{margin:0;color:var(--gold);font-size:18px}
    .dripso-admin-close{width:36px;height:36px;border:1px solid var(--border);border-radius:50%;background:var(--surface-soft);color:var(--cream);cursor:pointer}
    .dripso-admin-body{padding:16px;overflow:auto;max-height:calc(86vh - 70px)}
    .dripso-admin-status{margin:0 0 12px;color:var(--cream-dim);font-size:12px}
    .dripso-report-card{padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-soft);margin-bottom:10px}
    .dripso-report-meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--gold);font-size:11px;font-weight:800}
    .dripso-report-reason{margin:9px 0;color:var(--cream);font-size:13px;line-height:1.65;white-space:pre-wrap}
    .dripso-report-id{color:var(--cream-dim);font-size:10px;overflow-wrap:anywhere}
    .dripso-report-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .dripso-report-actions button{border:1px solid var(--border);border-radius:7px;background:var(--navy);color:var(--cream-dim);padding:7px 10px;font-size:11px;cursor:pointer}
    .dripso-report-actions button.hide{border-color:var(--gold);color:var(--gold)}
    .dripso-report-actions button.delete{border-color:var(--red);color:var(--red)}
  `;
  document.head.append(style);
}

function actionButton(label, action, reportId) {
  const button = element('button', action, label);
  button.type = 'button';
  button.dataset.reportAction = action;
  button.dataset.reportId = reportId;
  return button;
}

function reportCard(report) {
  const card = element('article', 'dripso-report-card');
  const target = report.targetType === 'comment' ? '댓글' : '주제';
  const meta = element('div', 'dripso-report-meta');
  meta.append(
    element('span', '', target),
    element('span', '', formatDate(report.createdAt))
  );
  const ids = element('div', 'dripso-report-id', `topic: ${report.topicId}${report.commentId ? ` · comment: ${report.commentId}` : ''}`);
  const actions = element('div', 'dripso-report-actions');
  actions.append(
    actionButton('숨김', 'hide', report.id),
    actionButton('완전 삭제', 'delete', report.id),
    actionButton('기각', 'dismiss', report.id)
  );
  card.append(meta, element('p', 'dripso-report-reason', report.reason || '신고 사유 없음'), ids, actions);
  return card;
}

async function loadReports() {
  status.textContent = '신고 목록을 불러오는 중입니다.';
  list.replaceChildren();
  try {
    const snapshot = await getDocs(query(
      collection(db, 'dripso_reports'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(100)
    ));
    const reports = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    status.textContent = reports.length ? `처리 대기 ${reports.length}건` : '처리 대기 중인 신고가 없습니다.';
    list.replaceChildren(...reports.map(reportCard));
  } catch (error) {
    status.textContent = errorMessage(error, '신고 목록을 불러오지 못했습니다.');
  }
}

function buildUi() {
  if (built) return;
  built = true;
  injectStyles();
  const launch = element('button', 'dripso-admin-launch', '드립소 신고');
  launch.type = 'button';
  dialog = element('dialog', 'dripso-admin-dialog');
  const head = element('div', 'dripso-admin-head');
  const close = element('button', 'dripso-admin-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '닫기');
  head.append(element('h2', '', '드립소 신고 관리'), close);
  const body = element('div', 'dripso-admin-body');
  status = element('p', 'dripso-admin-status', '신고 목록을 불러오세요.');
  list = element('div');
  body.append(status, list);
  dialog.append(head, body);
  document.body.append(launch, dialog);

  launch.addEventListener('click', async () => {
    dialog.showModal();
    await loadReports();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-report-action][data-report-id]');
    if (!button) return;
    const action = button.dataset.reportAction;
    if (action === 'delete' && !window.confirm('신고 대상과 연결 데이터를 완전히 삭제할까요?')) return;
    button.disabled = true;
    try {
      await moderateReport({ reportId: button.dataset.reportId, action });
      await loadReports();
    } catch (error) {
      status.textContent = errorMessage(error, '신고 처리에 실패했습니다.');
    } finally {
      button.disabled = false;
    }
  });
}

onAuthStateChanged(auth, user => {
  if (user && !user.isAnonymous) buildUi();
});
