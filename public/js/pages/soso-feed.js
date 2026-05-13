import { injectPredictStyle } from './predict-home.js';
import { createFeedPost, getFeedPosts, FALLBACK_FEED_ITEMS } from '../feed/feed-engine.js';

export function renderSosoFeed(container) {
  injectPredictStyle();
  injectFeedStyle();
  const hash = location.hash || '#/feed';
  if (hash === '#/feed/new') return renderFeedWrite(container);
  renderFeedLoading(container, hash === '#/feed/top');
  getFeedPosts({ topOnly: hash === '#/feed/top' })
    .then(items => renderFeedList(container, hash === '#/feed/top', items))
    .catch(() => renderFeedList(container, hash === '#/feed/top', FALLBACK_FEED_ITEMS));
}

function renderFeedLoading(container, topOnly = false) {
  container.innerHTML = `<main class="predict-app soso-feed-page"><section class="feed-hero"><div class="feed-hero-copy"><span>SOSO FEED</span><h1>${topOnly ? '인기 소소피드 불러오는 중' : '소소피드 불러오는 중'}</h1><p>웃긴 글, 사진, 소소한 논쟁을 정리하고 있습니다.</p></div></section></main>`;
}

function renderFeedList(container, topOnly = false, feedItems = FALLBACK_FEED_ITEMS) {
  const items = feedItems.length ? feedItems : FALLBACK_FEED_ITEMS;
  const popular = [...items].sort((a, b) => Number(b.stats?.views || 0) - Number(a.stats?.views || 0));
  const commentTop = [...items].sort((a, b) => Number(b.stats?.comments || 0) - Number(a.stats?.comments || 0))[0] || popular[0];
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <section class="feed-hero">
        <div class="feed-hero-copy">
          <span>SOSO FEED</span>
          <h1>웃긴 글, 사진, 소소한 논쟁이 쌓이는 곳</h1>
          <p>AI와 관리자가 먼저 콘텐츠를 쌓고, 유저는 사진·글·질문을 올려 투표와 댓글을 만들 수 있는 참여형 피드입니다.</p>
          <div class="feed-actions"><a href="#/feed/new">글 올리기</a><a href="#/feed/top">인기글 보기</a></div>
        </div>
        <div class="feed-stat-card"><b>오늘의 인기 기준</b><div><span>조회</span><strong>${num(popular[0]?.stats?.views)}</strong></div><div><span>댓글</span><strong>${num(commentTop?.stats?.comments)}</strong></div><div><span>좋아요</span><strong>${num(popular[0]?.stats?.likes)}</strong></div></div>
      </section>
      <section class="feed-dashboard"><article><b>🔥 조회수 TOP</b><span>${escapeHtml(popular[0]?.title || '준비 중')}</span></article><article><b>💬 댓글 많은 글</b><span>${escapeHtml(commentTop?.title || '준비 중')}</span></article><article><b>📸 사진 제목학원</b><span>사진 하나로 투표와 드립을 만들어요.</span></article></section>
      <section class="feed-layout"><div class="feed-main"><div class="section-head feed-head"><div><span>${topOnly ? 'POPULAR' : 'TODAY SOSO'}</span><h2>${topOnly ? '인기 소소피드' : '오늘의 소소피드'}</h2></div><a class="feed-mini-link" href="#/feed">전체</a></div><div class="feed-list">${items.map(feedCard).join('')}</div></div><aside class="feed-side"><div class="side-card"><b>소소피드가 필요한 이유</b><p>검색에 쌓이는 글과 사진이 있어야 자연 유입이 생깁니다. 예측판은 오늘 즐길거리, 소소피드는 오래 남는 콘텐츠 자산입니다.</p></div><div class="side-card"><b>올릴 수 있는 것</b><div class="side-tags"><span>웃긴 사진</span><span>짧은 사연</span><span>제목학원</span><span>소소한 논쟁</span><span>오늘의 질문</span></div></div><div class="side-card caution"><b>운영 원칙</b><p>저작권 문제 없는 이미지, 개인정보 없는 글, 혐오·성인·비방 없는 콘텐츠만 허용합니다.</p></div></aside></section>
    </main>`;
}

function renderFeedWrite(container) {
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>SOSO WRITE</span><h1>소소피드 올리기</h1></div><b>DB 저장</b></div>
      <section class="write-layout">
        <form id="feed-write-form" class="write-card">
          <div class="write-tabs"><button type="button" data-type="사진/짤" class="active">사진/짤</button><button type="button" data-type="짧은 글">짧은 글</button><button type="button" data-type="질문">질문</button></div>
          <input id="feed-type" type="hidden" value="사진/짤" />
          <label>제목</label><input id="feed-title" maxlength="90" placeholder="예: 이 사진 제목 뭐가 제일 웃김?" required />
          <label>본문 또는 상황 설명</label><textarea id="feed-content" maxlength="1200" placeholder="사진이나 상황을 짧게 설명해주세요. 개인정보, 비방, 저작권 문제 있는 내용은 올릴 수 없습니다." required></textarea>
          <div class="upload-box"><div>📸</div><b>사진 업로드 영역</b><span>이번 단계는 글 저장까지 연결했습니다. 이미지 업로드는 다음 단계에서 Firebase Storage로 연결합니다.</span></div>
          <label>참여 질문</label><input id="feed-question" maxlength="90" placeholder="예: 이 상황에서 제일 웃긴 제목은?" />
          <div class="option-editor"><input class="feed-option-input" placeholder="선택지 1"/><input class="feed-option-input" placeholder="선택지 2"/><input class="feed-option-input" placeholder="선택지 3"/><input class="feed-option-input" placeholder="선택지 4"/></div>
          <label>태그</label><input id="feed-tags" placeholder="예: 웃긴사진, 직장, 공감" />
          <button class="write-submit" type="submit">소소피드 등록</button><p id="feed-write-status" class="write-status">등록하면 Firestore soso_feed_posts에 저장됩니다.</p>
        </form>
        <aside class="write-preview">
          <b>미리보기</b>
          <div class="feed-card preview-card"><div class="feed-card-top"><span>📸 사진 제목학원</span><b>미리보기</b></div><h3 id="preview-title">제목을 입력하면 여기에 표시됩니다</h3><p id="preview-content">본문 설명과 참여 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.</p><div class="feed-question"><b id="preview-question">참여 질문 예시</b><div class="feed-option"><span id="preview-option-a">월요일 아침 내 표정</span><i style="--w:72%"></i></div><div class="feed-option"><span id="preview-option-b">퇴근 1분 전 부장님</span><i style="--w:48%"></i></div></div><div class="feed-top-comment"><b>인기 한 줄 예시</b><span>이건 제목만 봐도 상황이 그려짐.</span></div></div>
          <div class="side-card caution"><b>현재 연결 상태</b><p>글 저장과 목록 불러오기는 Firestore로 연결했습니다. 이미지 업로드, 댓글, 좋아요, 조회수 증가는 다음 단계에서 붙입니다.</p></div>
        </aside>
      </section>
    </main>`;
  bindWriteForm(container);
}

function bindWriteForm(container) {
  let type = '사진/짤';
  const form = container.querySelector('#feed-write-form');
  const status = container.querySelector('#feed-write-status');
  const updatePreview = () => {
    container.querySelector('#preview-title').textContent = container.querySelector('#feed-title').value || '제목을 입력하면 여기에 표시됩니다';
    container.querySelector('#preview-content').textContent = container.querySelector('#feed-content').value || '본문 설명과 참여 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.';
    container.querySelector('#preview-question').textContent = container.querySelector('#feed-question').value || '참여 질문 예시';
    const opts = [...container.querySelectorAll('.feed-option-input')].map(i => i.value).filter(Boolean);
    if (opts[0]) container.querySelector('#preview-option-a').textContent = opts[0];
    if (opts[1]) container.querySelector('#preview-option-b').textContent = opts[1];
  };
  container.querySelectorAll('.write-tabs button').forEach(btn => btn.addEventListener('click', () => {
    container.querySelectorAll('.write-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); type = btn.dataset.type || '짧은 글'; container.querySelector('#feed-type').value = type;
  }));
  ['#feed-title','#feed-content','#feed-question'].forEach(sel => container.querySelector(sel)?.addEventListener('input', updatePreview));
  container.querySelectorAll('.feed-option-input').forEach(input => input.addEventListener('input', updatePreview));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = form.querySelector('.write-submit');
    btn.disabled = true; btn.textContent = '등록 중...'; status.textContent = '소소피드를 저장하고 있습니다.';
    try {
      const options = [...container.querySelectorAll('.feed-option-input')].map(i => i.value.trim()).filter(Boolean);
      const tags = container.querySelector('#feed-tags').value.split(',').map(v => v.trim()).filter(Boolean);
      await createFeedPost({ type, title: container.querySelector('#feed-title').value, content: container.querySelector('#feed-content').value, question: container.querySelector('#feed-question').value, options, tags });
      status.textContent = '등록 완료! 소소피드 목록으로 이동합니다.';
      location.hash = '#/feed';
    } catch (error) {
      status.textContent = error.message || '등록에 실패했습니다.';
      btn.disabled = false; btn.textContent = '소소피드 등록';
    }
  });
}

function feedCard(item) {
  const total = (item.options?.length || 4) * 17 + (Number(item.stats?.likes || 0) % 33);
  return `<article class="feed-card"><div class="feed-card-top"><span>${escapeHtml(item.badge)} ${escapeHtml(item.type)}</span><b>조회 ${num(item.stats?.views)}</b></div>${item.imageUrl ? `<img class="feed-image" src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.title)}">` : ''}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="feed-question"><b>${escapeHtml(item.question)}</b>${(item.options || []).map((o, i) => `<div class="feed-option"><span>${escapeHtml(o)}</span><i style="--w:${Math.max(12, Math.min(88, total - i * 13))}%"></i></div>`).join('')}</div><div class="feed-top-comment"><b>인기 한 줄</b><span>${escapeHtml(item.topComment || '아직 인기 한 줄이 없습니다.')}</span></div><div class="feed-tags">${(item.tags || []).map(t => `<span>#${escapeHtml(t)}</span>`).join('')}</div><div class="feed-card-bottom"><span>♡ ${num(item.stats?.likes)}</span><span>💬 ${num(item.stats?.comments)}</span><button type="button">참여하기</button></div></article>`;
}

function injectFeedStyle() {
  if (document.getElementById('sosoking-feed-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-feed-style';
  style.textContent = `.soso-feed-page{padding:22px clamp(18px,4vw,36px) 108px}.feed-hero,.feed-dashboard,.feed-layout,.write-layout,.feed-write-header{max-width:1120px;margin-left:auto;margin-right:auto}.feed-hero{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:stretch;margin-bottom:16px}.feed-hero-copy{position:relative;overflow:hidden;border-radius:34px;padding:34px;background:linear-gradient(135deg,#101b3c,#4f7cff 62%,#7c5cff);color:#fff;box-shadow:0 28px 80px rgba(79,124,255,.22)}.feed-hero-copy:after{content:'✦';position:absolute;right:28px;top:16px;font-size:110px;opacity:.12}.feed-hero-copy span{font-size:11px;font-weight:1000;letter-spacing:.16em;color:rgba(255,255,255,.72)}.feed-hero-copy h1{max-width:720px;margin:8px 0 10px;font-size:clamp(34px,6vw,58px);line-height:1.04;letter-spacing:-.07em}.feed-hero-copy p{max-width:620px;margin:0;color:rgba(255,255,255,.76);font-size:15px;line-height:1.75}.feed-actions{display:flex;gap:8px;margin-top:22px}.feed-actions a{display:inline-flex;padding:13px 16px;border-radius:16px;text-decoration:none;font-weight:1000}.feed-actions a:first-child{background:#fff;color:#17245f}.feed-actions a:last-child{background:rgba(255,255,255,.14);color:#fff}.feed-stat-card{display:grid;gap:10px;border-radius:30px;padding:22px;background:rgba(255,255,255,.88);box-shadow:0 18px 54px rgba(55,90,170,.13)}.feed-stat-card>b{font-size:17px}.feed-stat-card div{padding:14px;border-radius:18px;background:rgba(79,124,255,.07)}.feed-stat-card span{display:block;color:var(--predict-muted);font-size:12px;font-weight:900}.feed-stat-card strong{font-size:24px;color:var(--predict-main)}.feed-dashboard{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.feed-dashboard article,.side-card,.feed-card,.write-card,.write-preview{border:1px solid rgba(79,124,255,.12);background:rgba(255,255,255,.86);border-radius:24px;box-shadow:0 16px 46px rgba(55,90,170,.10)}.feed-dashboard article{padding:16px}.feed-dashboard b{display:block;font-size:14px}.feed-dashboard span{display:block;margin-top:5px;color:var(--predict-muted);font-size:13px;line-height:1.5}.feed-layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.feed-mini-link{border:1px solid var(--predict-line);background:var(--predict-card);border-radius:999px;padding:9px 12px;color:var(--predict-ink);font-weight:900;text-decoration:none}.feed-list{display:grid;gap:14px}.feed-card{position:relative;overflow:hidden;padding:18px}.feed-card:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,#4f7cff,#ff5c8a,#ffc542)}.feed-card-top{display:flex;justify-content:space-between;gap:10px;margin-bottom:12px}.feed-card-top span,.feed-card-top b{display:inline-flex;padding:7px 10px;border-radius:999px;background:rgba(79,124,255,.08);font-size:11px;font-weight:1000;color:var(--predict-main)}.feed-card-top b{color:var(--predict-hot);background:rgba(255,92,138,.10)}.feed-image{width:100%;max-height:340px;object-fit:cover;border-radius:20px;margin:4px 0 14px}.feed-card h3{margin:0;font-size:24px;line-height:1.28;letter-spacing:-.05em}.feed-card p{color:var(--predict-muted);line-height:1.75}.feed-question{margin-top:12px;padding:14px;border-radius:20px;background:rgba(79,124,255,.06)}.feed-question>b{display:block;margin-bottom:10px}.feed-option{position:relative;overflow:hidden;margin-top:8px;padding:11px 12px;border-radius:14px;background:#fff}.feed-option span{position:relative;z-index:2;font-size:13px;font-weight:900}.feed-option i{position:absolute;left:0;top:0;bottom:0;width:var(--w);background:linear-gradient(90deg,rgba(79,124,255,.16),rgba(255,92,138,.14))}.feed-top-comment{margin-top:12px;padding:13px;border-radius:18px;background:rgba(255,197,66,.12)}.feed-top-comment b{display:block;font-size:12px;color:#a06a00}.feed-top-comment span{display:block;margin-top:4px;color:var(--predict-ink);font-size:13px;line-height:1.55}.feed-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.feed-tags span,.side-tags span{display:inline-flex;padding:6px 9px;border-radius:999px;background:rgba(79,124,255,.08);color:var(--predict-main);font-size:12px;font-weight:900}.feed-card-bottom{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--predict-muted);font-size:13px;font-weight:900}.feed-card-bottom button{margin-left:auto;border:0;border-radius:14px;padding:11px 14px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000}.feed-side{display:grid;gap:12px;position:sticky;top:16px}.side-card{padding:16px}.side-card b{display:block;font-size:16px}.side-card p{color:var(--predict-muted);font-size:13px;line-height:1.7}.side-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.side-card.caution{background:linear-gradient(135deg,rgba(255,197,66,.13),rgba(255,255,255,.86))}.write-layout{display:grid;grid-template-columns:1fr 360px;gap:16px}.write-card,.write-preview{padding:18px}.write-tabs{display:flex;gap:8px;margin-bottom:14px}.write-tabs button{border:1px solid var(--predict-line);border-radius:999px;padding:9px 12px;background:var(--predict-card);font-weight:900}.write-tabs .active{background:var(--predict-main);color:#fff}.write-card label{display:block;margin:14px 0 7px;color:var(--predict-muted);font-size:12px;font-weight:1000}.write-card input,.write-card textarea{width:100%;border:1px solid var(--predict-line);border-radius:16px;padding:13px;background:var(--predict-bg);color:var(--predict-ink);font-family:inherit}.write-card textarea{min-height:100px;resize:vertical}.upload-box{margin-top:14px;border:1.5px dashed rgba(79,124,255,.32);border-radius:20px;padding:28px;text-align:center;background:rgba(79,124,255,.06)}.upload-box div{font-size:38px}.upload-box span{display:block;color:var(--predict-muted);font-size:12px;margin-top:5px}.option-editor{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.write-submit{width:100%;margin-top:16px;border:0;border-radius:18px;padding:15px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000}.write-status{color:var(--predict-muted);font-size:12px;line-height:1.5}.preview-card{margin-top:12px;box-shadow:none}@media(max-width:900px){.feed-hero,.feed-layout,.write-layout{grid-template-columns:1fr}.feed-side{position:static}.feed-dashboard{grid-template-columns:1fr}.feed-card h3{font-size:21px}.feed-actions{flex-direction:column}.option-editor{grid-template-columns:1fr}}[data-theme="dark"] .feed-stat-card,[data-theme="dark"] .feed-dashboard article,[data-theme="dark"] .side-card,[data-theme="dark"] .feed-card,[data-theme="dark"] .write-card,[data-theme="dark"] .write-preview{background:rgba(16,23,34,.88);box-shadow:none}[data-theme="dark"] .feed-option{background:rgba(255,255,255,.06)}`;
  document.head.appendChild(style);
}

function num(n){return Number(n||0).toLocaleString()}
function escapeAttr(s){return escapeHtml(s).replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
