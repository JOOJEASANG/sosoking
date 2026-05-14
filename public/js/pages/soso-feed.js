import { injectAppStyle } from '../components/ui-style.js';
import { addFeedComment, createFeedReport, getFeedComments, getFeedPost, getFeedPosts, getMyFeedVote, increaseFeedView, likeFeedPost, voteFeedOption, FALLBACK_FEED_ITEMS } from '../feed/feed-engine.js';

export function renderSosoFeed(container) {
  injectAppStyle();
  const hash = location.hash || '#/feed';
  if (hash === '#/feed/new') {
    location.hash = '#/feed/new';
    return;
  }
  if (hash.startsWith('#/feed/') && !['#/feed/top', '#/feed/new'].includes(hash)) {
    return renderFeedDetail(container, decodeURIComponent(hash.replace('#/feed/', '')));
  }
  renderFeedLoading(container, hash === '#/feed/top');
  getFeedPosts({ topOnly: hash === '#/feed/top' })
    .then(items => renderFeedList(container, hash === '#/feed/top', items))
    .catch(() => renderFeedList(container, hash === '#/feed/top', FALLBACK_FEED_ITEMS));
}

function renderFeedLoading(container, topOnly = false) {
  container.innerHTML = `<main class="predict-app soso-feed-page"><section class="feed-hero"><div class="feed-hero-copy"><span>SOSO FEED</span><h1>${topOnly ? '인기 소소피드 불러오는 중' : '소소피드 불러오는 중'}</h1><p>웃긴 글, 사진, 소소한 논쟁을 정리하고 있습니다.</p></div></section></main>`;
}

function renderFeedList(container, topOnly = false, feedItems = FALLBACK_FEED_ITEMS) {
  const items = Array.isArray(feedItems) ? feedItems : [];
  const hasItems = items.length > 0;
  const popular = [...items].sort((a, b) => Number(b.stats?.views || 0) - Number(a.stats?.views || 0));
  const commentTop = [...items].sort((a, b) => Number(b.stats?.comments || 0) - Number(a.stats?.comments || 0))[0] || popular[0];
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <section class="feed-hero">
        <div class="feed-hero-copy">
          <span>SOSO FEED</span>
          <h1>웃긴 글, 사진, 소소한 논쟁이 쌓이는 곳</h1>
          <p>사진 제목학원, 밸런스게임, 소소토론, 퀴즈, AI놀이를 한 피드에서 즐기는 참여형 공간입니다.</p>
          <div class="feed-actions"><a href="#/feed/new">글 올리기</a><a href="#/feed/top">인기글 보기</a></div>
        </div>
        <div class="feed-stat-card">
          <b>현재 운영 데이터</b>
          <div><span>조회 TOP</span><strong>${hasItems ? num(popular[0]?.stats?.views) : '-'}</strong></div>
          <div><span>댓글 TOP</span><strong>${hasItems ? num(commentTop?.stats?.comments) : '-'}</strong></div>
          <div><span>좋아요 TOP</span><strong>${hasItems ? num(popular[0]?.stats?.likes) : '-'}</strong></div>
        </div>
      </section>
      <section class="feed-dashboard">
        <article><b>🔥 조회수 TOP</b><span>${escapeHtml(popular[0]?.title || '아직 등록된 글 없음')}</span></article>
        <article><b>💬 댓글 많은 글</b><span>${escapeHtml(commentTop?.title || '아직 댓글 데이터 없음')}</span></article>
        <article><b>📸 사진 제목학원</b><span>실제 글이 등록되면 이곳에 운영 데이터가 표시됩니다.</span></article>
      </section>
      <section class="feed-layout">
        <div class="feed-main">
          <div class="section-head feed-head"><div><span>${topOnly ? 'POPULAR' : 'TODAY SOSO'}</span><h2>${topOnly ? '인기 소소피드' : '오늘의 소소피드'}</h2></div><a class="feed-mini-link" href="#/feed">전체</a></div>
          <div class="feed-list">${hasItems ? items.map(feedCard).join('') : feedEmptyState()}</div>
        </div>
        <aside class="feed-side">
          <div class="side-card"><b>소소피드가 필요한 이유</b><p>검색에 쌓이는 글과 사진이 있어야 자연 유입이 생깁니다. 소소피드는 오래 남는 콘텐츠 자산입니다.</p></div>
          <div class="side-card"><b>올릴 수 있는 것</b><div class="side-tags"><span>사진 제목학원</span><span>밸런스게임</span><span>소소토론</span><span>퀴즈</span><span>AI놀이</span></div></div>
          <div class="side-card caution"><b>운영 원칙</b><p>저작권 문제 없는 이미지, 개인정보 없는 글, 혐오·성인·비방 없는 콘텐츠만 허용합니다.</p></div>
        </aside>
      </section>
    </main>`;
}

function feedEmptyState() {
  return `<section class="feed-empty-state"><div>✨</div><span>NO POSTS YET</span><h3>아직 등록된 소소피드가 없습니다</h3><p>첫 글을 올리면 바로 목록과 인기 영역에 반영됩니다.</p><a href="#/feed/new">첫 소소피드 올리기</a></section>`;
}

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
    <main class="predict-app soso-feed-page">
      <div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>${escapeHtml(post.type)}</span><h1>${escapeHtml(post.title)}</h1></div><b>조회 ${num(post.stats?.views)}</b></div>
      <section class="feed-detail-layout">
        <article class="feed-card detail-main-card">
          <div class="feed-card-top"><span>${escapeHtml(post.badge)} ${escapeHtml(post.type)}</span><b>♡ ${num(post.stats?.likes)}</b></div>
          ${post.imageUrl ? `<img class="feed-image detail-image" src="${escapeAttr(post.imageUrl)}" alt="${escapeAttr(post.title)}">` : ''}
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.content || post.summary)}</p>
          <div class="feed-question"><b>${escapeHtml(post.question)}</b>${voteButtons(post, myVote)}</div>
          <div id="vote-status" class="write-status">${myVote ? `내 선택: ${escapeHtml(myVote)}` : '선택지를 누르면 바로 투표됩니다.'}</div>
          <div class="feed-tags">${(post.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
          <div class="detail-actions"><button id="feed-like-btn" type="button">♡ 좋아요</button><button id="feed-report-btn" type="button">신고</button><button type="button" onclick="navigator.share&&navigator.share({title:document.title,url:location.href})">공유</button></div>
        </article>
        <aside class="detail-side">
          <div class="side-card"><b>글 정보</b><p>작성자 ${escapeHtml(post.authorName || '익명 소소러')}<br>투표 ${num(post.stats?.votes)} · 댓글 ${num(post.stats?.comments)} · 좋아요 ${num(post.stats?.likes)}</p></div>
          <div class="side-card caution"><b>참여 안내</b><p>선택지를 고르면 결과 퍼센트가 표시됩니다. 한 글에는 한 번만 투표할 수 있습니다.</p></div>
        </aside>
      </section>
      <section class="comments-section feed-comments">
        <div class="section-head compact"><div><span>COMMENTS</span><h2>한 줄 댓글</h2></div></div>
        <form id="feed-comment-form" class="comment-form"><input id="feed-comment-input" maxlength="300" placeholder="한 줄 생각을 남겨보세요"/><button>등록</button></form>
        <div class="comment-list">${comments.length ? comments.map(commentCard).join('') : '<div class="comment-item"><b>아직 댓글 없음</b><p>첫 한 줄을 남겨보세요.</p><small>공감 0</small></div>'}</div>
      </section>
    </main>`;

  container.querySelectorAll('.feed-vote-option:not([disabled])').forEach(button => button.addEventListener('click', async event => {
    const option = event.currentTarget.dataset.option;
    const status = container.querySelector('#vote-status');
    event.currentTarget.disabled = true;
    status.textContent = '투표 저장 중...';
    try {
      await voteFeedOption(post.id, option);
      const nextPost = await getFeedPost(post.id);
      drawFeedDetail(container, nextPost, comments, option);
    } catch (error) {
      status.textContent = error.message || '투표에 실패했습니다.';
      event.currentTarget.disabled = false;
    }
  }));

  container.querySelector('#feed-like-btn')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = '좋아요 완료';
    try { await likeFeedPost(post.id); } catch { event.currentTarget.textContent = '좋아요 실패'; }
  });

  container.querySelector('#feed-report-btn')?.addEventListener('click', () => openReportDialog(post.id));
  container.querySelector('#feed-comment-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = container.querySelector('#feed-comment-input');
    const button = event.currentTarget.querySelector('button');
    if (!input.value.trim()) return;
    button.disabled = true;
    button.textContent = '등록 중';
    try {
      await addFeedComment(post.id, input.value);
      const [nextComments, nextPost, nextVote] = await Promise.all([getFeedComments(post.id), getFeedPost(post.id), getMyFeedVote(post.id)]);
      drawFeedDetail(container, nextPost, nextComments, nextVote);
    } catch (error) {
      button.disabled = false;
      button.textContent = '등록';
      alert(error.message || '댓글 등록에 실패했습니다.');
    }
  });
}

function commentCard(comment) {
  return `<div class="comment-item"><b>${escapeHtml(comment.authorName)}</b><p>${escapeHtml(comment.text)}</p><small>공감 ${num(comment.likes)}</small></div>`;
}

function openReportDialog(postId) {
  document.getElementById('feed-report-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'feed-report-modal';
  modal.className = 'feed-report-modal';
  modal.innerHTML = `<div class="feed-report-backdrop"></div><form class="feed-report-box"><b>신고하기</b><p>문제가 있는 글이면 사유를 선택해 주세요.</p><select id="feed-report-reason"><option>부적절한 사진/이미지</option><option>개인정보 노출</option><option>비방/혐오 표현</option><option>저작권 문제</option><option>스팸/도배</option><option>기타</option></select><textarea id="feed-report-detail" maxlength="500" placeholder="추가 설명이 있으면 적어주세요."></textarea><div><button type="button" id="feed-report-cancel">취소</button><button type="submit">신고 접수</button></div><small id="feed-report-status"></small></form>`;
  document.body.appendChild(modal);
  modal.querySelector('.feed-report-backdrop').addEventListener('click', () => modal.remove());
  modal.querySelector('#feed-report-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const status = modal.querySelector('#feed-report-status');
    const button = modal.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = '신고를 접수하고 있습니다.';
    try {
      await createFeedReport({ postId, reason: modal.querySelector('#feed-report-reason').value, detail: modal.querySelector('#feed-report-detail').value });
      status.textContent = '신고가 접수되었습니다.';
      setTimeout(() => modal.remove(), 900);
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message || '신고 접수에 실패했습니다.';
    }
  });
}

function feedCard(item) {
  const votes = item.votes || {};
  const total = Math.max(1, Number(item.stats?.votes || 0) || Object.values(votes).reduce((a, b) => a + Number(b || 0), 0));
  return `<article class="feed-card"><div class="feed-card-top"><span>${escapeHtml(item.badge)} ${escapeHtml(item.type)}</span><b>조회 ${num(item.stats?.views)}</b></div>${item.imageUrl ? `<img class="feed-image" src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.title)}">` : ''}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="feed-question"><b>${escapeHtml(item.question)}</b>${(item.options || []).map((option) => { const pct = Math.round((Number(votes[option] || 0) / total) * 100); return `<div class="feed-option"><span>${escapeHtml(option)}</span><em>${pct}%</em><i style="--w:${Math.max(12, pct)}%"></i></div>`; }).join('')}</div><div class="feed-top-comment"><b>인기 한 줄</b><span>${escapeHtml(item.topComment || '아직 인기 한 줄이 없습니다.')}</span></div><div class="feed-tags">${(item.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div><div class="feed-card-bottom"><span>♡ ${num(item.stats?.likes)}</span><span>💬 ${num(item.stats?.comments)}</span><a class="feed-participate" href="#/feed/${encodeURIComponent(item.id)}">참여하기</a></div></article>`;
}

function num(value) { return Number(value || 0).toLocaleString(); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
