import './admin-absurd-cases.js?v=20260707-2';
import './session-helper.js?v=20260707-1';
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast3');
const generateDailyAiNow = httpsCallable(functions, 'generateDailyAiNow');
const recoverStaleTrialsNow = httpsCallable(functions, 'recoverStaleTrialsNow');
const repairSocialCountersNow = httpsCallable(functions, 'repairSocialCountersNow');

function toast(msg) {
  const c = document.getElementById('toast-container');
  if (!c) return alert(msg);
  const t = document.createElement('div');
  t.className = 'toast success';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function buttonLoading(btn, text) {
  btn.disabled = true;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = text;
}
function buttonDone(btn) {
  btn.disabled = false;
  btn.textContent = btn.dataset.originalText || btn.textContent;
}
function injectDailyButton() {
  const content = document.getElementById('tab-content');
  if (!content || document.getElementById('daily-ai-now-box')) return;
  const text = content.textContent || '';
  if (!text.includes('AI 자동 사건') && !text.includes('자동 생성') && !text.includes('주제 힌트')) return;
  const box = document.createElement('div');
  box.id = 'daily-ai-now-box';
  box.className = 'card';
  box.style.cssText = 'padding:16px;margin-bottom:14px;border-color:rgba(201,168,76,.45);';
  box.innerHTML = `
    <div style="font-weight:900;color:var(--gold);margin-bottom:7px;">🤖 AI 판결기록 생성/운영 복구</div>
    <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">
      오늘의 AI 판결기록을 즉시 생성하거나, 생성 중 멈춘 사건과 기존 투표·댓글 카운트를 보정합니다.
      배포 직후 한 번씩 실행하면 기존 데이터 정리에 도움이 됩니다.
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <button class="btn btn-primary" id="daily-ai-now-btn">오늘의 AI 판결기록 지금 생성</button>
      <button class="btn btn-secondary" id="recover-stale-trials-btn">멈춘 재판 복구</button>
      <button class="btn btn-secondary" id="repair-social-counters-btn">투표·댓글 카운트 보정</button>
    </div>
    <div id="admin-ai-tool-result" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:10px;"></div>`;
  content.prepend(box);

  const resultBox = document.getElementById('admin-ai-tool-result');
  document.getElementById('daily-ai-now-btn').onclick = async () => {
    const btn = document.getElementById('daily-ai-now-btn');
    buttonLoading(btn, '생성 중...');
    try {
      const res = await generateDailyAiNow({ force: true });
      const id = res.data?.caseId || '';
      toast(`AI 판결기록 생성 완료 ${id}`);
      resultBox.textContent = id ? `생성 완료: ${id}` : '생성 완료';
      if (id) setTimeout(() => { location.href = `/#/result/${encodeURIComponent(id)}`; }, 500);
    } catch (err) {
      console.error(err);
      alert((err.message || '생성 실패').replace('FirebaseError: ', ''));
      buttonDone(btn);
    }
  };

  document.getElementById('recover-stale-trials-btn').onclick = async () => {
    const btn = document.getElementById('recover-stale-trials-btn');
    buttonLoading(btn, '복구 중...');
    try {
      const res = await recoverStaleTrialsNow({});
      const recovered = Number(res.data?.recoveredCount || 0);
      const checked = Number(res.data?.checked || 0);
      resultBox.textContent = `멈춘 재판 확인 ${checked}건 / 복구 ${recovered}건`;
      toast(`멈춘 재판 복구 완료: ${recovered}건`);
    } catch (err) {
      console.error(err);
      alert((err.message || '복구 실패').replace('FirebaseError: ', ''));
    } finally {
      buttonDone(btn);
    }
  };

  document.getElementById('repair-social-counters-btn').onclick = async () => {
    const btn = document.getElementById('repair-social-counters-btn');
    buttonLoading(btn, '보정 중...');
    try {
      const res = await repairSocialCountersNow({ limit: 300, onlyPublic: false });
      const repaired = Number(res.data?.repairedCount || 0);
      const checked = Number(res.data?.checked || 0);
      resultBox.textContent = `판결문 카운트 확인 ${checked}건 / 보정 ${repaired}건`;
      toast(`카운트 보정 완료: ${repaired}건`);
    } catch (err) {
      console.error(err);
      alert((err.message || '카운트 보정 실패').replace('FirebaseError: ', ''));
    } finally {
      buttonDone(btn);
    }
  };
}

setInterval(injectDailyButton, 500);
window.addEventListener('click', () => setTimeout(injectDailyButton, 50), true);
