import { auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const COUNSELOR_EMOJI = {
  gold: '🧸', profiler: '🕵️', latte: '👔', salon: '💇', taxi: '🚕',
  hani: '🌿', guru: '🔮', bungeo: '🐟',
  boss: '🍲', dog: '🐶', mc: '🎤', monk: '🧘',
  musok: '🔮', uju: '🛸', halmae: '👵', tbal: '🤖', baeu: '🎭',
};

function ensureStyle() {
  if (document.getElementById('mr-style')) return;
  const s = document.createElement('style');
  s.id = 'mr-style';
  s.textContent = `
    .mr-page{min-height:100vh;}
    .mr-tabs{display:flex;gap:8px;margin-bottom:18px;}
    .mr-tab{flex:1;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--cream-dim);font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s,background .15s;}
    .mr-tab.active{border-color:var(--gold);color:var(--gold);background:rgba(201,168,76,.08);}
    .mr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding-bottom:90px;}
    .mr-card{background:var(--navy-card);border:1px solid var(--border);border-radius:14px;padding:15px 14px 12px;display:flex;flex-direction:column;gap:8px;}
    .mr-label{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--gold);background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);border-radius:999px;padding:3px 10px;}
    .mr-main{font-size:13.5px;color:var(--cream);line-height:1.65;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);}
    .mr-sub{font-size:12px;color:var(--cream-dim);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .mr-footer{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}
    .mr-time{font-size:10px;color:var(--cream-dim);}
    .mr-stats{font-size:11px;color:var(--cream-dim);display:flex;gap:10px;}
    .mr-more{display:block;width:100%;margin:16px 0 20px;padding:13px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--cream-dim);font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s;}
    .mr-more:hover{border-color:var(--gold);}
    .mr-empty{padding:28px;text-align:center;font-size:13px;color:var(--cream-dim);border:1px dashed var(--border);border-radius:12px;line-height:1.75;}
    .mr-login{padding:36px 20px;text-align:center;}
    .mr-login-btn{display:inline-block;padding:12px 28px;border-radius:999px;background:var(--gold);color:#241a05;font-weight:800;font-size:14px;text-decoration:none;}
    [data-theme='light'] .mr-card{background:#fffaf1;}
    [data-theme='light'] .mr-main{background:rgba(0,0,0,.03);}
  `;
  document.head.appendChild(s);
}

function timeLabel(ms) {
  if (!ms) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function adviceCardHtml(r) {
  const emoji = COUNSELOR_EMOJI[r.counselorId] || '🔮';
  return `<div class="mr-card">
    <div><span class="mr-label">${emoji} ${escapeHtml(r.counselorName)}</span></div>
    ${r.worry ? `<div class="mr-sub">고민: ${escapeHtml(r.worry)}</div>` : ''}
    ${r.prescription ? `<div class="mr-main">${escapeHtml(r.prescription)}</div>` : ''}
    <div class="mr-footer">
      <span class="mr-time">${timeLabel(r.createdAt)}</span>
      <div class="mr-stats"><span>❤️ ${r.likeCount}</span><span>💬 ${r.commentCount}</span></div>
    </div>
  </div>`;
}

function translateCardHtml(r) {
  return `<div class="mr-card">
    <div><span class="mr-label">${escapeHtml(r.modeEmoji || '💥')} ${escapeHtml(r.modeLabel || '번역')}</span></div>
    ${r.originalText ? `<div class="mr-sub">원문: ${escapeHtml(r.originalText)}</div>` : ''}
    ${r.translated ? `<div class="mr-main">${escapeHtml(r.translated)}</div>` : ''}
    <div class="mr-footer">
      <span class="mr-time">${timeLabel(r.createdAt)}</span>
      <div class="mr-stats"><span>❤️ ${r.likeCount}</span><span>💬 ${r.commentCount}</span></div>
    </div>
  </div>`;
}

export async function renderMyRecords(container) {
  ensureStyle();

  const uid = auth.currentUser?.uid;

  container.innerHTML = `
    <div class="mr-page">
      <div class="page-header"><a href="#/" class="back-btn" aria-label="홈으로">‹</a><span class="logo">내 기록</span></div>
      <div class="container" style="padding-top:18px;">
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:900;color:var(--gold);margin-bottom:4px;">📁 내 기록</div>
        <p style="font-size:12.5px;color:var(--cream-dim);margin:0 0 16px;line-height:1.65;">내가 받은 상담·번역 결과 모음이에요.</p>
        ${uid ? `
          <div class="mr-tabs">
            <button type="button" class="mr-tab active" data-tab="advice">🏥 상담소 기록</button>
            <button type="button" class="mr-tab" data-tab="translation">💥 번역소 기록</button>
          </div>
          <div id="mr-grid" class="mr-grid"><div class="loading-dots"><span></span><span></span><span></span></div></div>
          <div id="mr-more-wrap"></div>
        ` : `
          <div class="mr-login">
            <p style="color:var(--cream-dim);margin-bottom:16px;">로그인하면 내 상담·번역 기록을 볼 수 있어요.</p>
            <a href="#/auth" class="mr-login-btn">로그인하기</a>
          </div>
        `}
      </div>
    </div>`;

  if (!uid) return;

  const grid = container.querySelector('#mr-grid');
  const moreWrap = container.querySelector('#mr-more-wrap');
  const getMyResults = httpsCallable(functions, 'getMyResults');

  let activeTab = 'advice';
  let lastId = null;
  let loading = false;

  async function load(append = false) {
    if (loading) return;
    loading = true;
    if (!append) {
      lastId = null;
      grid.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    }

    try {
      const { data } = await getMyResults({
        type: activeTab,
        startAfterId: append ? lastId : null,
      });

      if (!append) grid.innerHTML = '';

      if (!data.results.length && !append) {
        const label = activeTab === 'advice' ? '상담소에서 첫 상담 받기 →' : '번역소에서 첫 번역 해보기 →';
        const href = activeTab === 'advice' ? '#/clinic' : '#/translate';
        grid.innerHTML = `<div class="mr-empty">아직 기록이 없어요.<br><a href="${href}" style="color:var(--gold);">${label}</a></div>`;
      } else {
        data.results.forEach(r => {
          const el = document.createElement('div');
          el.innerHTML = activeTab === 'advice' ? adviceCardHtml(r) : translateCardHtml(r);
          grid.appendChild(el.firstElementChild);
        });
        lastId = data.lastId;
        moreWrap.innerHTML = data.hasMore
          ? '<button type="button" class="mr-more" id="mr-more-btn">더 보기</button>'
          : '';
        moreWrap.querySelector('#mr-more-btn')?.addEventListener('click', () => load(true));
      }
    } catch (err) {
      console.error('my-records load failed:', err);
      if (!append) grid.innerHTML = '<div class="mr-empty">불러오지 못했습니다.<br><button class="btn btn-secondary" id="mr-retry" style="margin-top:8px;">다시 시도</button></div>';
      grid.querySelector('#mr-retry')?.addEventListener('click', () => load());
    } finally {
      loading = false;
    }
  }

  container.querySelectorAll('.mr-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === activeTab) return;
      container.querySelectorAll('.mr-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      moreWrap.innerHTML = '';
      load();
    });
  });

  await load();
}
