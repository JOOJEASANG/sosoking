import './admin-absurd-cases.js?v=20260707-1';
import './session-helper.js?v=20260707-1';
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast3');
const generateDailyAiNow = httpsCallable(functions, 'generateDailyAiNow');

function toast(msg) {
  const c = document.getElementById('toast-container');
  if (!c) return alert(msg);
  const t = document.createElement('div');
  t.className = 'toast success';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2800);
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
    <div style="font-weight:900;color:var(--gold);margin-bottom:7px;">🤖 오늘의 AI 판결기록 생성/복구</div>
    <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">현재 날짜의 AI 사건과 판결기록을 즉시 생성하거나, 내용이 비어 있으면 복구합니다. 생성 후 공개 판결기록에서 확인할 수 있습니다.</div>
    <button class="btn btn-primary" id="daily-ai-now-btn">오늘의 AI 판결기록 지금 생성</button>`;
  content.prepend(box);
  document.getElementById('daily-ai-now-btn').onclick = async () => {
    const btn = document.getElementById('daily-ai-now-btn');
    btn.disabled = true;
    btn.textContent = '생성 중...';
    try {
      const res = await generateDailyAiNow({ force: true });
      const id = res.data?.caseId || '';
      toast(`AI 판결기록 생성 완료 ${id}`);
      if (id) setTimeout(() => { location.href = `/#/result/${encodeURIComponent(id)}`; }, 500);
    } catch (err) {
      console.error(err);
      alert((err.message || '생성 실패').replace('FirebaseError: ', ''));
      btn.disabled = false;
      btn.textContent = '오늘의 AI 판결기록 지금 생성';
    }
  };
}

setInterval(injectDailyButton, 500);
window.addEventListener('click', () => setTimeout(injectDailyButton, 50), true);
