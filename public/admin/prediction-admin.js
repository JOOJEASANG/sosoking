import { initAuth, functions } from '../js/firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const logBox = document.getElementById('admin-log');
const collectBtn = document.getElementById('collect-btn');
const settleBtn = document.getElementById('settle-btn');

function log(message) {
  if (!logBox) return;
  const time = new Date().toLocaleTimeString();
  logBox.textContent = `[${time}] ${message}\n` + logBox.textContent;
}

async function call(name) {
  await initAuth();
  return httpsCallable(functions, name)({});
}

collectBtn?.addEventListener('click', async () => {
  collectBtn.disabled = true;
  log('핫이슈 수집을 시작합니다.');
  try {
    const result = await call('collectHotIssues');
    const data = result.data || {};
    log(`수집 완료: 이슈 ${data.issues?.length || 0}개, 예측판 ${data.boards?.length || 0}개`);
  } catch (error) {
    log(`수집 실패: ${error.message || error}`);
  } finally {
    collectBtn.disabled = false;
  }
});

settleBtn?.addEventListener('click', async () => {
  settleBtn.disabled = true;
  log('정산을 시작합니다. 오늘 생성된 예측판은 건너뜁니다.');
  try {
    const result = await call('settlePredictionBoards');
    const data = result.data || {};
    log(`정산 완료: ${(data.results || []).length}건 처리`);
  } catch (error) {
    log(`정산 실패: ${error.message || error}`);
  } finally {
    settleBtn.disabled = false;
  }
});

log('관리자 모듈 준비 완료');
