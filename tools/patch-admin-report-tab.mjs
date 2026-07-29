import fs from 'node:fs';

// One-shot patch that adds a report queue to the consolidated administrator dashboard.
function patch(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`${file}: patch target missing: ${before.slice(0, 120)}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(file, source);
}

const reportTab = `async function tabReports(target) {
  const reportSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
  const resultSnaps = await Promise.all(reportSnap.docs.map(report => {
    const caseId = String(report.data().caseId || '');
    return caseId ? getDoc(doc(db, 'results', caseId)).catch(() => null) : Promise.resolve(null);
  }));
  const rows = reportSnap.docs.map((reportDocument, index) => {
    const report = reportDocument.data();
    const caseId = String(report.caseId || '');
    const result = resultSnaps[index]?.exists() ? resultSnaps[index].data() : {};
    const pending = report.status === 'pending';
    return \`<tr>
      <td><b>\${escapeHtml(result.caseTitle || caseId || '-')}</b><div style="font-size:10px;color:var(--cream-dim);">\${escapeHtml(fmtDate(report.createdAt))}</div></td>
      <td>\${escapeHtml(report.reason || '-')}</td>
      <td>\${escapeHtml(report.status || 'pending')}<div style="font-size:10px;color:var(--cream-dim);">신고자 \${escapeHtml(String(report.userId || '').slice(0, 16))}</div></td>
      <td><div class="admin-actions">
        \${caseId ? \`<a class="admin-btn gold" href="/#/result/\${encodeURIComponent(caseId)}" style="text-decoration:none;">보기</a>\` : ''}
        \${pending ? \`<button type="button" class="admin-btn red" data-report-action="hide" data-report-id="\${escapeAttr(reportDocument.id)}">숨김 처리</button><button type="button" class="admin-btn" data-report-action="dismiss" data-report-id="\${escapeAttr(reportDocument.id)}">기각</button>\` : ''}
      </div></td>
    </tr>\`;
  });

  target.innerHTML = \`<div class="card" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">숨김 처리는 신고 대상 사건과 판결문을 동시에 비공개로 전환합니다. 기각은 공개 상태를 유지하고 신고만 종결합니다.</div>\${tableWrap(['신고 대상', '신고 사유', '상태', '처리'], rows)}\`;
  target.querySelectorAll('[data-report-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const reportId = button.dataset.reportId || '';
      const action = button.dataset.reportAction || '';
      if (!reportId || !['hide', 'dismiss'].includes(action)) return;
      const prompt = action === 'hide'
        ? '신고 대상 판결기록을 비공개로 전환하고 신고를 종결할까요?'
        : '공개 상태를 유지하고 신고를 기각할까요?';
      if (!confirm(prompt)) return;
      const restore = setBusy(button, action === 'hide' ? '숨김 중...' : '처리 중...');
      try {
        await callables.moderateReport({ reportId, action });
        toast(action === 'hide' ? '판결기록을 숨기고 신고를 종결했습니다.' : '신고를 기각했습니다.', 'success');
        await loadTab('reports');
      } catch (error) {
        toast(errorMessage(error, '신고 처리에 실패했습니다.'), 'error');
        restore();
      }
    });
  });
}

`;

patch('public/admin/admin.js', [
  [
    "  syncStats: httpsCallable(functions, 'syncPublicStatsNow')",
    "  syncStats: httpsCallable(functions, 'syncPublicStatsNow'),\n  moderateReport: httpsCallable(functions, 'moderateReport')"
  ],
  [
    "  ['records', '사건·판결기록'],\n  ['users', '회원'],",
    "  ['records', '사건·판결기록'],\n  ['reports', '신고'],\n  ['users', '회원'],"
  ],
  [
    "    else if (tab === 'records') await tabRecords(target);\n    else if (tab === 'users') await tabUsers(target);",
    "    else if (tab === 'records') await tabRecords(target);\n    else if (tab === 'reports') await tabReports(target);\n    else if (tab === 'users') await tabUsers(target);"
  ],
  [
    "async function tabUsers(target) {",
    `${reportTab}async function tabUsers(target) {`
  ]
]);

patch('public/admin/admin-bootstrap.js', [
  [
    "./admin.js?v=20260729-admin-consolidated-1",
    "./admin.js?v=20260729-report-moderation-1"
  ]
]);
