const BOOT_VERSION = '2026-07-24-cleanup-v1';

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
        <div style="font-size:14px;line-height:1.7;color:#4b5563;margin-bottom:16px;">앱을 시작하는 중 오류가 발생했습니다. 아래 내용을 확인해주세요.</div>
        <button type="button" onclick="location.reload()" style="border:0;border-radius:999px;background:#ff6b4a;color:#fff;font-weight:800;padding:10px 16px;cursor:pointer;">다시 불러오기</button>
        <pre style="margin-top:16px;max-height:320px;overflow:auto;background:#111827;color:#e5e7eb;border-radius:12px;padding:12px;font-size:12px;white-space:pre-wrap;">${escapeHtml(full)}</pre>
      </div>
    </div>`;
}

async function probe(path) {
  try {
    const url = `/js/${path}?probe=${encodeURIComponent(BOOT_VERSION)}&t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text().catch(() => '');
    return `${path}: status=${res.status}; type=${res.headers.get('content-type') || ''}; first120=${text.slice(0, 120).replace(/\s+/g, ' ')}`;
  } catch (error) {
    return `${path}: error=${error && error.message ? error.message : String(error)}`;
  }
}

async function collectDiagnostics() {
  return [
    `bootVersion=${BOOT_VERSION}`,
    await probe('app-safe.js'),
  ].join('\n');
}

async function loadPostBootModules() {
  try {
    const registry = await import(`./app-module-registry.js?v=${Date.now()}`);
    await registry.importModuleGroup(registry.POST_BOOT_MODULES, { label: 'post-boot' });
  } catch (error) {
    console.warn('[sosoking boot] post boot modules failed', error);
  }
}

window.addEventListener('error', async event => {
  if (!document.querySelector('.app-shell')) showBootError(event.error || event.message, await collectDiagnostics());
});

window.addEventListener('unhandledrejection', async event => {
  if (!document.querySelector('.app-shell')) showBootError(event.reason, await collectDiagnostics());
});

const appUrl = `./app-safe.js?v=${encodeURIComponent(BOOT_VERSION)}&t=${Date.now()}`;
import(appUrl)
  .then(loadPostBootModules)
  .catch(async error => showBootError(error, await collectDiagnostics()));
