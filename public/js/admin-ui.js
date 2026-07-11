import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const getDashboardCallable = httpsCallable(functions, 'getAdminDashboard');
const moderateReportCallable = httpsCallable(functions, 'moderateReport');
const backfillPublicCallable = httpsCallable(functions, 'backfillPublicResults');

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function number(value) { return new Intl.NumberFormat('ko-KR').format(Number(value || 0)); }
function formatDate(value) {
  if (!value) return '날짜 미상';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '날짜 미상' : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export async function loadAdminDashboard() {
  const response = await getDashboardCallable({});
  return response.data;
}

export function adminPageHtml(data) {
  const counts = data?.counts || {};
  const usage = data?.usage || {};
  const reports = Array.isArray(data?.reports) ? data.reports : [];
  return `<section class="admin-page"><div class="container admin-shell">
    <header class="admin-head"><div><div class="eyebrow">운영 관리자</div><h1>신고와 서비스 상태를<br>한곳에서 확인합니다</h1><p>사용자 공개 판결을 검토하고, 문제가 있는 콘텐츠를 숨기거나 신고를 기각할 수 있습니다.</p></div><div class="admin-head-actions"><button class="button" id="sync-public-results" type="button">공개 데이터 동기화</button><button class="button" id="refresh-admin" type="button">새로고침</button></div></header>
    <section class="admin-stats"><article class="card"><span>전체 사건</span><strong>${number(counts.cases)}</strong></article><article class="card"><span>완성 판결</span><strong>${number(counts.results)}</strong></article><article class="card"><span>공개 판결</span><strong>${number(counts.publicResults)}</strong></article><article class="card warning"><span>대기 신고</span><strong>${number(counts.pendingReports)}</strong></article><article class="card danger"><span>숨김 판결</span><strong>${number(counts.hiddenResults)}</strong></article></section>
    <section class="card admin-usage"><div><span>최근 판결 100건 Gemini 사용</span><strong>${number(usage.gemini)}건</strong></div><div><span>안전 대체 판결</span><strong>${number(usage.fallback)}건</strong></div><div><span>기록된 총 토큰</span><strong>${number(usage.totalTokens)}</strong></div></section>
    <section class="admin-reports"><div class="admin-section-head"><div><span>신고 검토함</span><h2>처리 대기 ${number(reports.length)}건</h2></div></div>
      ${reports.length ? reports.map(report => `<article class="card report-item" data-report-id="${safe(report.id)}"><div class="report-main"><div class="report-meta"><span>신고 ${formatDate(report.createdAt)}</span><span>공감 ${number(report.reactionCount)}</span><span>댓글 ${number(report.commentCount)}</span><span class="moderation-state ${safe(report.moderationStatus)}">${report.moderationStatus === 'hidden' ? '현재 숨김' : report.isPublic ? '현재 공개' : '현재 비공개'}</span></div><h3>${safe(report.caseTitle)}</h3><p class="report-description">${safe(report.caseDescription || '사건 설명이 없습니다.')}</p><div class="report-reason"><span>신고 사유</span><strong>${safe(report.reason)}</strong></div><a class="report-link" href="#/result/${encodeURIComponent(report.caseId)}">판결 내용 확인</a></div><div class="report-actions"><textarea class="textarea moderation-note" maxlength="300" placeholder="처리 메모(선택)"></textarea><button class="button button-danger" data-action="hide" type="button">판결 숨김</button><button class="button" data-action="dismiss" type="button">신고 기각</button>${report.moderationStatus === 'hidden' ? '<button class="button button-primary" data-action="restore" type="button">공개 복구</button>' : ''}</div></article>`).join('') : `<div class="card admin-empty"><div class="receipt-check">✓</div><h2>처리할 신고가 없습니다</h2><p>현재 공개 재판 커뮤니티가 정상 상태입니다.</p></div>`}
    </section>
  </div></section>`;
}

export function bindAdminActions({ onRefresh, showToast, showError }) {
  document.getElementById('refresh-admin')?.addEventListener('click', onRefresh);
  document.getElementById('sync-public-results')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = '동기화 중...';
    try {
      const response = await backfillPublicCallable({});
      showToast(`공개 판결 ${response.data.synced}건을 안전 문서로 동기화했습니다.`);
      await onRefresh();
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.textContent = '공개 데이터 동기화';
    }
  });
  document.querySelectorAll('.report-item [data-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const item = button.closest('.report-item');
      const reportId = item?.dataset.reportId;
      const action = button.dataset.action;
      const note = item?.querySelector('.moderation-note')?.value?.trim() || '';
      const labels = { hide: '숨김 처리', dismiss: '신고 기각', restore: '공개 복구' };
      if (!window.confirm(`${labels[action]}을 진행할까요?`)) return;
      item.querySelectorAll('button').forEach(target => { target.disabled = true; });
      try { await moderateReportCallable({ reportId, action, note }); showToast(`${labels[action]}이 완료되었습니다.`); await onRefresh(); }
      catch (error) { showError(error); item.querySelectorAll('button').forEach(target => { target.disabled = false; }); }
    });
  });
}
