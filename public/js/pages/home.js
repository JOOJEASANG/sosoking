import { getFeedPosts } from '../feed/feed-engine.js';
import { injectAppStyle } from '../components/ui-style.js';

export function renderHome(container) {
  injectAppStyle();
  draw(container, []);
  getFeedPosts({ pageSize: 3 }).then(items => draw(container, items || [])).catch(() => draw(container, []));
}

function draw(container, items = []) {
  container.innerHTML = `
    <main class="predict-app soso-home-page">
      <section class="soso-home-hero">
        <div class="soso-home-brand"><img src="/logo.svg" alt="소소킹"><div><b>소소킹</b><small>소소한 웃음과 게임이 모이는 피드</small></div></div>
        <div class="soso-home-copy">
          <span>SOSO FEED PLAYGROUND</span>
          <h1>보고, 고르고,<br><em>놀고, 댓글 달자</em></h1>
          <p>사진 제목학원, 밸런스게임, 소소토론, 퀴즈, AI놀이까지 한 피드에서 가볍게 즐기는 커뮤니티입니다.</p>
          <div class="soso-home-actions"><a href="#/feed/new">소소피드 만들기</a><a href="#/feed">피드 구경하기</a></div>
          <div class="soso-home-tags"><i>게임머니 없음</i><i>정산 없음</i><i>투표·댓글·문제·토론</i></div>
        </div>
      </section>

      <section class="soso-play-grid">
        <a href="#/feed/new"><b>📸 사진 제목학원</b><span>사진 올리고 가장 웃긴 제목을 고르기</span></a>
        <a href="#/feed/new"><b>⚖️ 밸런스게임</b><span>둘 중 하나 고르고 댓글로 토론하기</span></a>
        <a href="#/feed/new"><b>🧠 퀴즈 만들기</b><span>문제 내고 정답과 해설로 놀기</span></a>
        <a href="#/feed/new"><b>🤖 AI놀이</b><span>AI 제목 추천, 선택지 만들기, 요약 활용</span></a>
      </section>

      <section class="soso-home-recent">
        <div class="section-head"><div><span>RECENT SOSO</span><h2>최근 소소피드</h2></div><a href="#/feed">전체보기</a></div>
        <div class="soso-recent-grid">${items.length ? items.map(card).join('') : emptyCard()}</div>
      </section>
    </main>`;
}

function card(item) {
  return `<a class="soso-recent-card" href="#/feed/${encodeURIComponent(item.id)}"><span>${escapeHtml(item.badge || '✨')} ${escapeHtml(item.type || '소소피드')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.content || '')}</p><small>댓글 ${Number(item.stats?.comments || 0).toLocaleString()} · 좋아요 ${Number(item.stats?.likes || 0).toLocaleString()}</small></a>`;
}

function emptyCard() {
  return `<div class="soso-recent-card"><span>READY</span><h3>아직 올라온 소소피드가 없습니다</h3><p>첫 글을 올리면 이곳에 표시됩니다.</p><small>사진 · 밸런스게임 · 퀴즈 · 토론</small></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
