const BOOT_VERSION = '2026-06-26-full-audit-v1';

function showBootError(error, diagnostics = '') {
  const app = document.getElementById('app');
  if (!app) return;
  console.error('[sosoking boot] failed', error, diagnostics);
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f7f7fb;color:#1f2937;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;">
      <div style="max-width:520px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;box-shadow:0 12px 32px rgba(15,23,42,.08);text-align:center;">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">소소킹을 불러오지 못했어요</div>
        <div style="font-size:14px;line-height:1.7;color:#4b5563;margin-bottom:16px;">일시적인 연결 또는 파일 로딩 문제일 수 있습니다. 페이지를 다시 불러와주세요.</div>
        <button type="button" onclick="location.reload()" style="border:0;border-radius:999px;background:#ff6b4a;color:#fff;font-weight:800;padding:10px 16px;cursor:pointer;">다시 불러오기</button>
      </div>
    </div>`;
}

async function probe(path) {
  try {
    const url = `/js/${path}?probe=${encodeURIComponent(BOOT_VERSION)}`;
    const response = await fetch(url, { cache: 'no-cache' });
    const text = await response.text().catch(() => '');
    return `${path}: status=${response.status}; type=${response.headers.get('content-type') || ''}; first120=${text.slice(0, 120).replace(/\s+/g, ' ')}`;
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
  const modules = [
    './owner-edit-route-override.js',
    './app-stability-suite.js',
  ];
  await Promise.allSettled(modules.map(path => import(`${path}?v=${encodeURIComponent(BOOT_VERSION)}`)));
}

window.addEventListener('error', async event => {
  if (!document.querySelector('.app-shell')) showBootError(event.error || event.message, await collectDiagnostics());
});

window.addEventListener('unhandledrejection', async event => {
  if (!document.querySelector('.app-shell')) showBootError(event.reason, await collectDiagnostics());
});

const safeUrl = `./app-safe.js?v=${encodeURIComponent(BOOT_VERSION)}`;
import(safeUrl).then(loadPostBootModules).catch(async safeError => {
  showBootError(safeError, await collectDiagnostics());
});
