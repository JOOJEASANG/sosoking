const BOOT_VERSION = '2026-05-20-boot-v2';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]));
}

function showBootError(error, diagnostics = '') {
  const app = document.getElementById('app');
  if (!app) return;
  const message = error && (error.stack || error.message) ? String(error.stack || error.message) : String(error || '알 수 없는 오류');
  const full = diagnostics ? `${message}\n\n--- diagnostics ---\n${diagnostics}` : message;
  console.error('[sosoking boot] failed', error, diagnostics);
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f7f7fb;color:#1f2937;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;">
      <div style="max-width:620px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;box-shadow:0 12px 32px rgba(15,23,42,.08);">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">소소킹을 불러오지 못했어요</div>
        <div style="font-size:14px;line-height:1.7;color:#4b5563;margin-bottom:16px;">앱 파일 로딩 상태를 점검했습니다. 아래 오류 첫 줄과 diagnostics를 확인해주세요.</div>
        <button type="button" onclick="location.reload()" style="border:0;border-radius:999px;background:#ff6b4a;color:#fff;font-weight:800;padding:10px 16px;cursor:pointer;">다시 불러오기</button>
        <pre style="margin-top:16px;max-height:320px;overflow:auto;background:#111827;color:#e5e7eb;border-radius:12px;padding:12px;font-size:12px;white-space:pre-wrap;">${escapeHtml(full)}</pre>
      </div>
    </div>`;
}

async function collectDiagnostics() {
  const lines = [`bootVersion=${BOOT_VERSION}`];
  try {
    const url = `/js/app.js?probe=${encodeURIComponent(BOOT_VERSION)}&t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    lines.push(`appFetch.status=${res.status}`);
    lines.push(`appFetch.ok=${res.ok}`);
    lines.push(`appFetch.contentType=${res.headers.get('content-type') || ''}`);
    const text = await res.text().catch(() => '');
    lines.push(`appFetch.first120=${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  } catch (e) {
    lines.push(`appFetch.error=${e && e.message ? e.message : String(e)}`);
  }
  return lines.join('\n');
}

window.addEventListener('error', async event => {
  if (!document.querySelector('.app-shell')) showBootError(event.error || event.message, await collectDiagnostics());
});

window.addEventListener('unhandledrejection', async event => {
  if (!document.querySelector('.app-shell')) showBootError(event.reason, await collectDiagnostics());
});

const appUrl = `./app.js?v=${encodeURIComponent(BOOT_VERSION)}&t=${Date.now()}`;
import(appUrl).catch(async error => {
  showBootError(error, await collectDiagnostics());
});
