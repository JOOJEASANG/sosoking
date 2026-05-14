import { injectAppStyle } from '../components/ui-style.js';
import { addFeedComment, createFeedReport, getFeedComments, getFeedPost, getFeedPosts, getMyFeedVote, increaseFeedView, likeFeedPost, voteFeedOption, FALLBACK_FEED_ITEMS } from '../feed/feed-engine.js';

export function renderSosoFeed(container) {
  injectAppStyle();
  injectFeedPolishStyle();
  const hash = location.hash || '#/feed';
  if (hash === '#/feed/new') { location.hash = '#/feed/new'; return; }
  if (hash.startsWith('#/feed/') && !['#/feed/top', '#/feed/new'].includes(hash)) return renderFeedDetail(container, decodeURIComponent(hash.replace('#/feed/', '')));
  const topOnly = hash === '#/feed/top';
  renderFeedLoading(container, topOnly);
  getFeedPosts({ topOnly })
    .then(items => renderFeedList(container, topOnly, items))
    .catch(() => renderFeedList(container, topOnly, FALLBACK_FEED_ITEMS));
}

function renderFeedLoading(container, topOnly = false) {
  container.innerHTML = `<main class="predict-app soso-feed-page feed-polish"><section class="feed-hero"><div class="feed-hero-copy"><span>SOSO FEED</span><h1>${topOnly ? '인기 소소피드 불러오는 중' : '소소피드 불러오는 중'}</h1><p>웃긴 글, 사진, 소소한 논쟁을 정리하고 있습니다.</p></div></section></main>`;
}

function renderFeedList(container, topOnly = false, feedItems = FALLBACK_FEED_ITEMS) {
  const items = Array.isArray(feedItems) ? feedItems : [];
  const hasItems = items.length > 0;
  const popular = [...items].sort((a, b) => score(b) - score(a));
  const commentTop = [...items].sort((a, b) => Number(b.stats?.comments || 0) - Number(a.stats?.comments || 0))[0] || popular[0];
  container.innerHTML = `
    <main class="predict-app soso-feed-page feed-polish">
      <section class="feed-hero feed-hero-fixed">
        <div class="feed-hero-copy">
          <span>SOSO FEED</span>
          <h1>피드 하나로 최신글, 인기글, 검색까지</h1>
          <p>사진 제목학원, 밸런스게임, 퀴즈, 정보공유, 릴레이소설, 역할극까지 한 피드에서 찾고 참여합니다.</p>
          <div class="feed-actions"><a href="#/feed/new">글 올리기</a><a href="#/mission">오늘 미션</a></div>
        </div>
        <div class="feed-stat-card">
          <b>현재 피드 요약</b>
          <div><span>전체 글</span><strong>${num(items.length)}</strong></div>
          <div><span>인기 점수 TOP</span><strong>${hasItems ? num(score(popular[0])) : '-'}</strong></div>
          <div><span>댓글 TOP</span><strong>${hasItems ? num(commentTop?.stats?.comments) : '-'}</strong></div>
        </div>
      </section>
      <section class="feed-dashboard">
        <article><b>🔥 인기 TOP</b><span>${escapeHtml(popular[0]?.title || '아직 등록된 글 없음')}</span></article>
        <article><b>💬 댓글 많은 글</b><span>${escapeHtml(commentTop?.title || '아직 댓글 데이터 없음')}</span></article>
        <article><b>🔎 검색 가능</b><span>제목, 본문, 태그, 유형으로 원하는 소소피드를 찾을 수 있습니다.</span></article>
      </section>
      <section class="feed-search-panel">
        <div class="feed-tabs-inline"><a class="${topOnly ? '' : 'active'}" href="#/feed">최신</a><a class="${topOnly ? 'active' : ''}" href="#/feed/top">인기</a><a href="#/feed/new">만들기</a></div>
        <div class="feed-search-box"><span>🔎</span><input id="feed-search-input" placeholder="제목, 태그, 유형, 내용 검색" autocomplete="off"><button id="feed-search-clear" type="button">초기화</button></div>
        <div class="feed-filter-chips"><button class="active" data-filter="all">전체</button><button data-filter="정보">정보</button><button data-filter="퀴즈">퀴즈</button><button data-filter="역할극">역할극</button><button data-filter="투표">투표</button><button data-filter="영상">영상</button></div>
      </section>
      <section class="feed-layout">
        <div class="feed-main">
          <div class="section-head feed-head"><div><span>${topOnly ? 'POPULAR' : 'TODAY SOSO'}</span><h2 id="feed-list-title">${topOnly ? '인기 소소피드' : '오늘의 소소피드'}</h2></div><a class="feed-mini-link" href="#/feed/new">새 글</a></div>
          <div id="feed-result-count" class="feed-result-count">${hasItems ? `${num(items.length)}개의 글` : '아직 글 없음'}</div>
          <div class="feed-list" id="feed-list">${hasItems ? items.map(feedCard).join('') : feedEmptyState()}</div>
        </div>
        <aside class="feed-side">
          <div class="side-card"><b>피드 사용법</b><p>하단 메뉴는 단순하게 유지하고, 최신/인기/유형 검색은 피드 안에서 처리합니다.</p></div>
          <div class="side-card"><b>올릴 수 있는 것</b><div class="side-tags"><span>정보공유</span><span>릴레이소설</span><span>역할극</span><span>퀴즈</span><span>영상 리액션</span></div></div>
          <div class="side-card caution"><b>운영 원칙</b><p>저작권 문제 없는 이미지와 링크, 개인정보 없는 글, 혐오·성인·비방 없는 콘텐츠만 허용합니다.</p></div>
        </aside>
      </section>
    </main>`;
  bindFeedSearch(container, items, topOnly);
}

function score(item) { return Number(item.stats?.views || 0) + Number(item.stats?.comments || 0) * 8 + Number(item.stats?.likes || 0) * 5 + Number(item.stats?.votes || 0) * 3; }
function feedEmptyState(message = '아직 등록된 소소피드가 없습니다') { return `<section class="feed-empty-state"><div>✨</div><span>NO POSTS</span><h3>${escapeHtml(message)}</h3><p>첫 글을 올리면 바로 목록과 인기 영역에 반영됩니다.</p><a href="#/feed/new">첫 소소피드 올리기</a></section>`; }

function bindFeedSearch(container, sourceItems, topOnly) {
  let activeFilter = 'all';
  const input = container.querySelector('#feed-search-input');
  const list = container.querySelector('#feed-list');
  const count = container.querySelector('#feed-result-count');
  const render = () => {
    const term = (input?.value || '').trim().toLowerCase();
    let items = [...sourceItems];
    if (topOnly) items.sort((a, b) => score(b) - score(a));
    if (activeFilter !== 'all') items = items.filter(item => searchText(item).includes(activeFilter.toLowerCase()));
    if (term) items = items.filter(item => searchText(item).includes(term));
    list.innerHTML = items.length ? items.map(feedCard).join('') : feedEmptyState('검색 결과가 없습니다');
    count.textContent = term || activeFilter !== 'all' ? `${num(items.length)}개의 검색 결과` : `${num(items.length)}개의 글`;
  };
  input?.addEventListener('input', render);
  container.querySelector('#feed-search-clear')?.addEventListener('click', () => { input.value = ''; activeFilter = 'all'; container.querySelectorAll('.feed-filter-chips button').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === 'all')); render(); });
  container.querySelectorAll('.feed-filter-chips button').forEach(btn => btn.addEventListener('click', () => { activeFilter = btn.dataset.filter || 'all'; container.querySelectorAll('.feed-filter-chips button').forEach(item => item.classList.remove('active')); btn.classList.add('active'); render(); }));
}
function searchText(item) { return [item.title, item.summary, item.content, item.type, item.authorName, ...(item.tags || [])].join(' ').toLowerCase(); }

async function renderFeedDetail(container, postId) {
  container.innerHTML = `<main class="predict-app soso-feed-page"><div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>SOSO DETAIL</span><h1>소소피드 불러오는 중</h1></div><b>...</b></div></main>`;
  try {
    const [post, comments, myVote] = await Promise.all([getFeedPost(postId), getFeedComments(postId), getMyFeedVote(postId)]);
    increaseFeedView(postId);
    drawFeedDetail(container, post, comments, myVote);
  } catch (error) {
    container.innerHTML = `<main class="predict-app soso-feed-page"><div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>NOT FOUND</span><h1>게시글을 찾을 수 없습니다</h1></div><b>!</b></div><section class="side-card detail-error"><p>${escapeHtml(error.message || '삭제되었거나 공개되지 않은 글입니다.')}</p><a href="#/feed">소소피드로 돌아가기</a></section></main>`;
  }
}

function mediaBlock(post, detail = false) {
  if (post.embedUrl && detail) return `<div class="feed-video-frame"><iframe src="${escapeAttr(post.embedUrl)}" title="${escapeAttr(post.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  if (post.thumbnailUrl && post.mediaType === 'youtube') return `<a class="feed-link-card video" href="${escapeAttr(post.linkUrl)}" target="_blank" rel="noopener"><img src="${escapeAttr(post.thumbnailUrl)}" alt="${escapeAttr(post.title)}"><div><b>▶ 영상 바로가기</b><p>${escapeHtml(post.linkTitle || post.title)}</p><small>${escapeHtml(post.linkSource || 'youtube.com')}</small></div></a>`;
  if (post.imageUrl) return `<img class="feed-image ${detail ? 'detail-image' : ''}" src="${escapeAttr(post.imageUrl)}" alt="${escapeAttr(post.title)}">`;
  if (post.linkUrl) return `<a class="feed-link-card" href="${escapeAttr(post.linkUrl)}" target="_blank" rel="noopener"><div><b>🔗 ${escapeHtml(post.linkTitle || post.title)}</b><p>${escapeHtml(post.linkSummary || post.summary || '링크 내용을 확인해보세요.')}</p><small>${escapeHtml(post.linkSource || '사이트 바로가기')}</small></div></a>`;
  return '';
}

function voteButtons(post, myVote) {
  const votes = post.votes || {};
  const total = Math.max(1, Number(post.stats?.votes || 0) || Object.values(votes).reduce((a, b) => a + Number(b || 0), 0));
  return (post.options || []).map((option) => {
    const count = Number(votes[option] || 0);
    const pct = Math.round((count / total) * 100);
    const selected = myVote === option;
    return `<button class="feed-vote-option ${selected ? 'selected' : ''}" data-option="${escapeAttr(option)}" type="button" ${myVote ? 'disabled' : ''}><span>${escapeHtml(option)}${selected ? ' · 내 선택' : ''}</span><em>${pct}%</em><i style="--w:${myVote ? pct : Math.max(16, pct)}%"></i></button>`;
  }).join('');
}

function drawFeedDetail(container, post, comments = [], myVote = null) {
  container.innerHTML = `
    <main class="predict-app soso-feed-page feed-polish">
      <div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>${escapeHtml(post.type)}</span><h1>${escapeHtml(post.title)}</h1></div><b>조회 ${num(post.stats?.views)}</b></div>
      <section class="feed-detail-layout">
        <article class="feed-card detail-main-card"><div class="feed-card-top"><span>${escapeHtml(post.badge)} ${escapeHtml(post.type)}</span><b>♡ ${num(post.stats?.likes)}</b></div>${mediaBlock(post, true)}<h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.content || post.summary)}</p><div class="feed-question"><b>${escapeHtml(post.question)}</b>${voteButtons(post, myVote)}</div><div id="vote-status" class="write-status">${myVote ? `내 선택: ${escapeHtml(myVote)}` : '선택지를 누르면 바로 투표됩니다.'}</div><div class="feed-tags">${(post.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div><div class="detail-actions"><button id="feed-like-btn" type="button">♡ 좋아요</button><button id="feed-report-btn" type="button">신고</button><button type="button" onclick="navigator.share&&navigator.share({title:document.title,url:location.href})">공유</button></div></article>
        <aside class="detail-side"><div class="side-card"><b>글 정보</b><p>작성자 ${escapeHtml(post.authorName || '익명 소소러')}<br>투표 ${num(post.stats?.votes)} · 댓글 ${num(post.stats?.comments)} · 좋아요 ${num(post.stats?.likes)}</p></div><div class="side-card caution"><b>참여 안내</b><p>선택지를 고르면 결과 퍼센트가 표시됩니다. 한 글에는 한 번만 투표할 수 있습니다.</p></div></aside>
      </section>
      <section class="comments-section feed-comments"><div class="section-head compact"><div><span>COMMENTS</span><h2>한 줄 댓글</h2></div></div><form id="feed-comment-form" class="comment-form"><input id="feed-comment-input" maxlength="300" placeholder="한 줄 생각을 남겨보세요"/><button>등록</button></form><div class="comment-list">${comments.length ? comments.map(commentCard).join('') : '<div class="comment-item"><b>아직 댓글 없음</b><p>첫 한 줄을 남겨보세요.</p><small>공감 0</small></div>'}</div></section>
    </main>`;
  container.querySelectorAll('.feed-vote-option:not([disabled])').forEach(button => button.addEventListener('click', async event => {
    const option = event.currentTarget.dataset.option; const status = container.querySelector('#vote-status'); event.currentTarget.disabled = true; status.textContent = '투표 저장 중...';
    try { await voteFeedOption(post.id, option); const nextPost = await getFeedPost(post.id); drawFeedDetail(container, nextPost, comments, option); }
    catch (error) { status.textContent = error.message || '투표에 실패했습니다.'; event.currentTarget.disabled = false; }
  }));
  container.querySelector('#feed-like-btn')?.addEventListener('click', async event => { event.currentTarget.disabled = true; event.currentTarget.textContent = '좋아요 완료'; try { await likeFeedPost(post.id); } catch { event.currentTarget.textContent = '좋아요 실패'; } });
  container.querySelector('#feed-report-btn')?.addEventListener('click', () => openReportDialog(post.id));
  container.querySelector('#feed-comment-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const input = container.querySelector('#feed-comment-input'); const button = event.currentTarget.querySelector('button'); if (!input.value.trim()) return; button.disabled = true; button.textContent = '등록 중';
    try { await addFeedComment(post.id, input.value); const [nextComments, nextPost, nextVote] = await Promise.all([getFeedComments(post.id), getFeedPost(post.id), getMyFeedVote(post.id)]); drawFeedDetail(container, nextPost, nextComments, nextVote); }
    catch (error) { button.disabled = false; button.textContent = '등록'; alert(error.message || '댓글 등록에 실패했습니다.'); }
  });
}

function commentCard(comment) { return `<div class="comment-item"><b>${escapeHtml(comment.authorName)}</b><p>${escapeHtml(comment.text)}</p><small>공감 ${num(comment.likes)}</small></div>`; }
function openReportDialog(postId) {
  document.getElementById('feed-report-modal')?.remove();
  const modal = document.createElement('div'); modal.id = 'feed-report-modal'; modal.className = 'feed-report-modal';
  modal.innerHTML = `<div class="feed-report-backdrop"></div><form class="feed-report-box"><b>신고하기</b><p>문제가 있는 글이면 사유를 선택해 주세요.</p><select id="feed-report-reason"><option>부적절한 사진/이미지</option><option>개인정보 노출</option><option>비방/혐오 표현</option><option>저작권 문제</option><option>스팸/도배</option><option>기타</option></select><textarea id="feed-report-detail" maxlength="500" placeholder="추가 설명이 있으면 적어주세요."></textarea><div><button type="button" id="feed-report-cancel">취소</button><button type="submit">신고 접수</button></div><small id="feed-report-status"></small></form>`;
  document.body.appendChild(modal); modal.querySelector('.feed-report-backdrop').addEventListener('click', () => modal.remove()); modal.querySelector('#feed-report-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); const status = modal.querySelector('#feed-report-status'); const button = modal.querySelector('button[type="submit"]'); button.disabled = true; status.textContent = '신고를 접수하고 있습니다.'; try { await createFeedReport({ postId, reason: modal.querySelector('#feed-report-reason').value, detail: modal.querySelector('#feed-report-detail').value }); status.textContent = '신고가 접수되었습니다.'; setTimeout(() => modal.remove(), 900); } catch (error) { button.disabled = false; status.textContent = error.message || '신고 접수에 실패했습니다.'; } });
}

function feedCard(item) {
  const votes = item.votes || {}; const total = Math.max(1, Number(item.stats?.votes || 0) || Object.values(votes).reduce((a, b) => a + Number(b || 0), 0));
  return `<article class="feed-card"><div class="feed-card-top"><span>${escapeHtml(item.badge)} ${escapeHtml(item.type)}</span><b>조회 ${num(item.stats?.views)}</b></div>${mediaBlock(item, false)}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.content || '')}</p><div class="feed-question"><b>${escapeHtml(item.question)}</b>${(item.options || []).map((option) => { const pct = Math.round((Number(votes[option] || 0) / total) * 100); return `<div class="feed-option"><span>${escapeHtml(option)}</span><em>${pct}%</em><i style="--w:${Math.max(12, pct)}%"></i></div>`; }).join('')}</div><div class="feed-top-comment"><b>인기 한 줄</b><span>${escapeHtml(item.topComment || '아직 인기 한 줄이 없습니다.')}</span></div><div class="feed-tags">${(item.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div><div class="feed-card-bottom"><span>♡ ${num(item.stats?.likes)}</span><span>💬 ${num(item.stats?.comments)}</span><a class="feed-participate" href="#/feed/${encodeURIComponent(item.id)}">참여하기</a></div></article>`;
}

function injectFeedPolishStyle() {
  if (document.getElementById('soso-feed-polish-style')) return;
  const style = document.createElement('style'); style.id = 'soso-feed-polish-style';
  style.textContent = `.feed-polish{padding:18px clamp(16px,4vw,34px) 112px!important}.feed-hero-fixed .feed-hero-copy{background:linear-gradient(135deg,#ffffff 0%,#fff9e8 48%,#eef3ff 100%)!important;color:#141a33!important}.feed-hero-fixed .feed-hero-copy h1{color:#141a33!important;text-shadow:none!important}.feed-hero-fixed .feed-hero-copy p{color:#596274!important}.feed-hero-fixed .feed-hero-copy span{background:rgba(255,232,92,.58)!important;color:#1b2250!important}.feed-actions a{color:#fff!important;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff)!important;font-weight:1000!important}.feed-actions a:nth-child(2){background:rgba(79,124,255,.10)!important;color:#4f7cff!important;border:1px solid rgba(79,124,255,.14)!important}.feed-stat-card{color:#141a33!important}.feed-search-panel{max-width:1040px;margin:0 auto 14px;padding:14px;border-radius:26px;background:rgba(255,255,255,.88);border:1px solid rgba(79,124,255,.13);box-shadow:0 14px 44px rgba(55,90,170,.09);backdrop-filter:blur(16px)}.feed-tabs-inline{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.feed-tabs-inline a{display:flex;justify-content:center;padding:12px;border-radius:17px;background:rgba(79,124,255,.08);color:#4f7cff;text-decoration:none;font-weight:1000}.feed-tabs-inline a.active{background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff}.feed-search-box{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px;border-radius:18px;background:#f5f7ff;border:1px solid rgba(79,124,255,.12)}.feed-search-box input{border:0;background:transparent;outline:0;padding:9px;color:#141a33;font-family:inherit;font-weight:800}.feed-search-box button,.feed-filter-chips button{border:0;border-radius:14px;padding:10px 12px;background:#fff;color:#697386;font-weight:1000}.feed-filter-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.feed-filter-chips button.active{background:rgba(255,122,89,.13);color:#ff5c8a}.feed-result-count{margin:0 0 10px;color:#697386;font-size:13px;font-weight:900}.feed-link-card{display:grid;grid-template-columns:1fr;gap:10px;margin:10px 0 12px;padding:14px;border-radius:20px;background:linear-gradient(135deg,rgba(79,124,255,.10),rgba(255,92,138,.08));border:1px solid rgba(79,124,255,.14);text-decoration:none;color:inherit}.feed-link-card.video{grid-template-columns:112px 1fr}.feed-link-card img{width:112px;height:74px;object-fit:cover;border-radius:14px}.feed-link-card b{display:block;color:#141a33}.feed-link-card p{margin:5px 0;color:#596274;font-size:13px;line-height:1.5}.feed-link-card small{color:#4f7cff;font-weight:1000}.feed-video-frame{position:relative;width:100%;padding-top:56.25%;border-radius:22px;overflow:hidden;background:#000;margin:10px 0 14px}.feed-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}[data-theme="dark"] .feed-hero-fixed .feed-hero-copy,[data-theme="dark"] .feed-search-panel{background:rgba(16,23,34,.88)!important;color:#f5f7fb!important;box-shadow:none}[data-theme="dark"] .feed-hero-fixed .feed-hero-copy h1,[data-theme="dark"] .feed-link-card b{color:#f5f7fb!important}[data-theme="dark"] .feed-hero-fixed .feed-hero-copy p,[data-theme="dark"] .feed-link-card p{color:#a8b3c7!important}[data-theme="dark"] .feed-search-box{background:rgba(255,255,255,.06)}[data-theme="dark"] .feed-search-box input{color:#fff}@media(max-width:620px){.feed-link-card.video{grid-template-columns:1fr}.feed-link-card img{width:100%;height:auto}.feed-tabs-inline{grid-template-columns:repeat(3,1fr)}}`;
  document.head.appendChild(style);
}
function num(value) { return Number(value || 0).toLocaleString(); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
