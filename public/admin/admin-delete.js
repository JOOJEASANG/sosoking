function ensureAdminDeleteNotice() {
  if (document.getElementById('admin-delete-notice')) return;
  const shell = document.querySelector('.admin-shell');
  const nav = document.querySelector('.admin-nav');
  if (!shell || !nav) return;
  const div = document.createElement('div');
  div.id = 'admin-delete-notice';
  div.className = 'admin-helper';
  div.style.cssText = 'margin:0 0 14px;padding:12px 14px;border:1px solid rgba(201,168,76,.28);border-radius:12px;background:rgba(201,168,76,.08);color:var(--cream-dim);font-size:12px;line-height:1.7;';
  div.innerHTML = '<strong style="color:var(--gold);">운영 모드</strong> · 사건/회원 정리는 관리자 Callable Function으로만 처리됩니다. 직접 Firestore 문서 삭제는 사용하지 않습니다.';
  nav.insertAdjacentElement('afterend', div);
}

window.addEventListener('click', () => setTimeout(ensureAdminDeleteNotice, 0), true);
new MutationObserver(ensureAdminDeleteNotice).observe(document.body, { childList: true, subtree: true });
setTimeout(ensureAdminDeleteNotice, 300);
