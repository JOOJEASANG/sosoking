import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderSosoNews(container, newsId) {
  if (newsId) {
    await renderNewsResult(container, newsId);
    return;
  }

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📺 소소뉴스</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">

        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:56px;margin-bottom:12px;animation:ldBounce 1.5s ease-in-out infinite;display:inline-block;">📺</div>
          <h2 style="font-family:var(--font-serif);font-size:24px;font-weight:700;color:var(--news);margin-bottom:8px;">소소뉴스</h2>
          <p style="font-size:14px;color:var(--text-dim);line-height:1.7;">오늘 있었던 아주 사소한 일을 입력하면<br>AI 앵커가 <strong style="color:var(--news);">긴급 뉴스</strong>로 보도해드립니다 📡</p>
        </div>

        <div class="card" style="border-color:rgba(251,146,60,0.35);margin-bottom:20px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="color:var(--news);">📢 오늘 있었던 사소한 사건</label>
            <textarea class="form-textarea" id="news-input" placeholder="예) 편의점에서 1+1 과자를 혼자 다 먹었다&#10;예) 엘리베이터에서 방귀를 뀌고 재빨리 내렸다&#10;예) 라면에 계란을 넣으려다 노른자를 터뜨렸다" style="min-height:120px;border-color:rgba(251,146,60,0.25);"></textarea>
            <div class="char-counter"><span id="news-char">0</span>/100</div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label" style="color:var(--news);">🎙️ 보도 채널 선택</label>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <button class="channel-btn active" data-ch="cnn">🌐 CNN 코리아</button>
            <button class="channel-btn" data-ch="mbc">📻 MBC 뉴스데스크</button>
            <button class="channel-btn" data-ch="yt">▶️ 유튜브 생방송</button>
          </div>
        </div>

        <div id="news-msg" style="text-align:center;font-size:13px;min-height:18px;color:var(--red);margin-bottom:12px;"></div>
        <button id="news-btn" class="btn btn-primary" style="background:var(--news);color:#fff;box-shadow:0 2px 18px var(--news-glow);">📡 긴급 보도 요청</button>

        <div style="margin-top:32px;" id="recent-news"></div>
      </div>
    </div>
  `;

  const textarea = container.querySelector('#news-input');
  const charEl   = container.querySelector('#news-char');
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charEl.textContent = len;
    charEl.parentElement.className = 'char-counter' + (len > 100 ? ' over' : '');
  });

  let selectedChannel = 'cnn';
  container.querySelectorAll('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedChannel = btn.dataset.ch;
    });
  });

  container.querySelector('#news-btn').addEventListener('click', async () => {
    const text = textarea.value.trim();
    const msgEl = container.querySelector('#news-msg');
    if (!text) { msgEl.textContent = '사건 내용을 입력해주세요'; return; }
    if (text.length > 100) { msgEl.textContent = '100자 이내로 입력해주세요'; return; }
    msgEl.textContent = '';
    const btn = container.querySelector('#news-btn');
    btn.disabled = true; btn.textContent = '📡 보도 준비 중...';
    try {
      trackEvent('sosonews_request', { channel: selectedChannel });
      const generateNews = httpsCallable(functions, 'generateNews');
      const res = await generateNews({ event: text, channel: selectedChannel });
      location.hash = `#/sosonews/${res.data.newsId}`;
    } catch (err) {
      showToast(err.message || '보도 요청 실패', 'error');
      btn.disabled = false; btn.textContent = '📡 긴급 보도 요청';
    }
  });

  loadRecentNews(container);
}

async function loadRecentNews(container) {
  const el = container.querySelector('#recent-news');
  if (!el) return;
  try {
    const snap = await getDocs(query(collection(db, 'sosonews'), orderBy('createdAt', 'desc'), limit(5)));
    if (snap.empty) return;
    el.innerHTML = `
      <div class="sk-section-title">📺 최근 긴급 보도</div>
      ${snap.docs.map(d => {
        const data = d.data();
        return `
          <div class="topic-card" onclick="location.hash='#/sosonews/${d.id}'" style="margin-bottom:8px;border-left-color:rgba(251,146,60,0.5);">
            <div class="topic-card-title">${data.headline || '긴급 속보'}</div>
            <div class="topic-card-footer">
              <span style="color:var(--news);background:var(--news-dim);border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;">${chName(data.channel)}</span>
              <span>${timeAgo(data.createdAt?.toDate?.())}</span>
            </div>
          </div>`;
      }).join('')}
    `;
  } catch {}
}

async function renderNewsResult(container, newsId) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/sosonews" class="back-btn">‹</a>
        <span class="logo">📺 소소뉴스</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="loading-dots" style="padding:60px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;

  try {
    const snap = await getDoc(doc(db, 'sosonews', newsId));
    if (!snap.exists()) {
      container.querySelector('.container').innerHTML = `<div class="empty-state"><span class="empty-state-icon">📺</span><div class="empty-state-title">뉴스를 찾을 수 없습니다</div><a href="#/sosonews" class="btn btn-secondary" style="margin-top:20px;max-width:200px;margin-left:auto;margin-right:auto;display:flex;">돌아가기</a></div>`;
      return;
    }
    const data = snap.data();
    container.querySelector('.container').innerHTML = `
      <div class="news-result-card card" style="border-color:rgba(251,146,60,0.4);background:linear-gradient(135deg,rgba(251,146,60,0.1),rgba(251,146,60,0.03));margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span style="background:var(--news);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;animation:pulse 1s infinite;">🔴 LIVE</span>
          <span style="font-size:12px;color:var(--news);font-weight:700;">${chName(data.channel)}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-dim);letter-spacing:0.06em;margin-bottom:8px;">[ 긴급 속보 ]</div>
        <h2 style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--text);line-height:1.4;margin-bottom:16px;">${data.headline}</h2>
        <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:16px;font-size:14px;color:var(--text);line-height:1.9;white-space:pre-wrap;">${data.report}</div>
        ${data.anchor ? `<div style="margin-top:14px;font-size:12px;color:var(--text-dim);text-align:right;">— ${data.anchor} 앵커</div>` : ''}
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">원본 제보 내용</div>
        <div style="font-size:14px;color:var(--text);line-height:1.7;">${data.event}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <button onclick="navigator.share ? navigator.share({title:'소소뉴스 긴급 속보',text:'${(data.headline||'').replace(/'/g,"\\'")}',url:location.href}) : navigator.clipboard.writeText(location.href).then(()=>alert('링크 복사됨!'))" class="btn btn-primary" style="background:var(--news);color:#fff;box-shadow:0 2px 18px var(--news-glow);">📤 친구에게 공유</button>
        <a href="#/sosonews" class="btn btn-ghost">📺 다른 사건 보도하기</a>
      </div>
    `;
  } catch {
    showToast('뉴스를 불러오지 못했습니다', 'error');
  }
}

function chName(ch) {
  return ch === 'mbc' ? '📻 MBC 뉴스데스크' : ch === 'yt' ? '▶️ 유튜브 생방송' : '🌐 CNN 코리아';
}

function timeAgo(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return '방금 전';
  if (diff < 60) return `${diff}분 전`;
  if (diff < 1440) return `${Math.floor(diff/60)}시간 전`;
  return `${Math.floor(diff/1440)}일 전`;
}
