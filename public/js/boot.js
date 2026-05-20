function showBootError(error) {
  const app = document.getElementById('app');
  if (!app) return;
  const message = error && (error.stack || error.message) ? String(error.stack || error.message) : String(error || '알 수 없는 오류');
  console.error('[sosoking boot] failed', error);
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f7f7fb;color:#1f2937;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;">
      <div style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;box-shadow:0 12px 32px rgba(15,23,42,.08);">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">소소킹을 불러오지 못했어요</div>
        <div style="font-size:14px;line-height:1.7;color:#4b5563;margin-bottom:16px;">브라우저 캐시나 배포 중인 파일 문제일 수 있습니다. 강력 새로고침 후에도 계속되면 아래 오류 첫 줄을 확인해주세요.</div>
        <button type="button" onclick="location.reload()" style="border:0;border-radius:999px;background:#ff6b4a;color:#fff;font-weight:800;padding:10px 16px;cursor:pointer;">다시 불러오기</button>
        <pre style="margin-top:16px;max-height:220px;overflow:auto;background:#111827;color:#e5e7eb;border-radius:12px;padding:12px;font-size:12px;white-space:pre-wrap;">${message.replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]))}</pre>
      </div>
    </div>`;
}

window.addEventListener('error', event => {
  if (!document.querySelector('.app-shell')) showBootError(event.error || event.message);
});

window.addEventListener('unhandledrejection', event => {
  if (!document.querySelector('.app-shell')) showBootError(event.reason);
});

import('./app.js').catch(showBootError);
