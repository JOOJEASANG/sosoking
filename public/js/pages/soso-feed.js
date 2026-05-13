import { injectPredictStyle } from './predict-home.js';

const FEED_ITEMS = [
  { id:'office-chat-after-work', type:'생각 갈림', badge:'💬', title:'퇴근 후 단톡방 업무 지시, 어디까지 이해 가능?', summary:'회사 단톡방이 퇴근 후에도 계속 울릴 때 사람들은 어디까지 참을 수 있을까요?', question:'이 상황에서 제일 가까운 생각은?', options:['급한 일이면 가능','다음날 해도 된다','계속되면 선 넘음','읽씹한다'], stats:{ views:12840, likes:932, comments:214 }, topComment:'한두 번은 괜찮은데 반복되면 퇴근이 퇴근이 아님.', tags:['직장','단톡방','퇴근'] },
  { id:'funny-photo-title-school', type:'사진 제목학원', badge:'📸', title:'이 사진 제목 뭐가 제일 웃김?', summary:'평범한 사진도 제목 하나로 웃긴 글이 됩니다. AI 후보와 유저 드립이 붙는 참여형 글입니다.', question:'이 장면에 제일 어울리는 제목은?', options:['월요일 아침 내 표정','회의 끝난 줄 알았는데','퇴근 1분 전 부장님','오늘도 참았다'], stats:{ views:23620, likes:1840, comments:356 }, topComment:'퇴근 1분 전 부장님은 너무 현실이라 웃프다.', tags:['웃긴사진','제목학원','드립'] },
  { id:'friend-always-late', type:'소소한 논쟁', badge:'🤔', title:'친구가 매번 늦는데 사과는 잘한다면?', summary:'사과는 하지만 계속 반복되는 지각. 사람들은 이해할까요, 거리 둘까요?', question:'당신이라면 어떻게 할까요?', options:['계속 봐준다','한 번 제대로 말한다','슬슬 거리 둔다','이미 손절이다'], stats:{ views:9870, likes:715, comments:168 }, topComment:'사과보다 중요한 건 다음에 안 늦는 거라고 봄.', tags:['친구','인간관계','공감'] },
  { id:'food-court-kid-running', type:'생활 매너', badge:'🍽️', title:'식당에서 아이가 계속 뛰어다닐 때, 누가 말해야 할까?', summary:'부모가 먼저 제지해야 할지, 가게도 말해야 할지 은근히 의견이 갈리는 생활 이슈입니다.', question:'가장 맞는 생각은?', options:['부모가 먼저','가게도 말해야 함','상황 봐야 함','애라서 어쩔 수 없음'], stats:{ views:15420, likes:1104, comments:287 }, topComment:'애가 문제가 아니라 방치하는 어른이 문제인 경우가 많음.', tags:['식당','매너','육아'] }
];

export function renderSosoFeed(container) {
  injectPredictStyle();
  injectFeedStyle();
  const hash = location.hash || '#/feed';
  if (hash === '#/feed/new') return renderFeedWrite(container);
  if (hash === '#/feed/top') return renderFeedList(container, true);
  return renderFeedList(container, false);
}

function renderFeedList(container, topOnly = false) {
  const popular = [...FEED_ITEMS].sort((a, b) => b.stats.views - a.stats.views);
  const items = topOnly ? popular : FEED_ITEMS;
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <section class="feed-hero">
        <div class="feed-hero-copy">
          <span>SOSO FEED</span>
          <h1>웃긴 글, 사진, 소소한 논쟁이 쌓이는 곳</h1>
          <p>AI와 관리자가 먼저 콘텐츠를 쌓고, 유저는 사진·글·질문을 올려 투표와 댓글을 만들 수 있는 참여형 피드입니다.</p>
          <div class="feed-actions"><a href="#/feed/new">글 올리기</a><a href="#/feed/top">인기글 보기</a></div>
        </div>
        <div class="feed-stat-card"><b>오늘의 인기 기준</b><div><span>조회</span><strong>${num(popular[0].stats.views)}</strong></div><div><span>댓글</span><strong>${num(popular[0].stats.comments)}</strong></div><div><span>좋아요</span><strong>${num(popular[0].stats.likes)}</strong></div></div>
      </section>
      <section class="feed-dashboard"><article><b>🔥 조회수 TOP</b><span>${escapeHtml(popular[0].title)}</span></article><article><b>💬 댓글 많은 글</b><span>${escapeHtml([...FEED_ITEMS].sort((a,b)=>b.stats.comments-a.stats.comments)[0].title)}</span></article><article><b>📸 사진 제목학원</b><span>사진 하나로 투표와 드립을 만들어요.</span></article></section>
      <section class="feed-layout"><div class="feed-main"><div class="section-head feed-head"><div><span>${topOnly ? 'POPULAR' : 'TODAY SOSO'}</span><h2>${topOnly ? '인기 소소피드' : '오늘의 소소피드'}</h2></div><a class="feed-mini-link" href="#/feed">전체</a></div><div class="feed-list">${items.map(feedCard).join('')}</div></div><aside class="feed-side"><div class="side-card"><b>소소피드가 필요한 이유</b><p>검색에 쌓이는 글과 사진이 있어야 자연 유입이 생깁니다. 예측판은 오늘 즐길거리, 소소피드는 오래 남는 콘텐츠 자산입니다.</p></div><div class="side-card"><b>올릴 수 있는 것</b><div class="side-tags"><span>웃긴 사진</span><span>짧은 사연</span><span>제목학원</span><span>소소한 논쟁</span><span>오늘의 질문</span></div></div><div class="side-card caution"><b>운영 원칙</b><p>저작권 문제 없는 이미지, 개인정보 없는 글, 혐오·성인·비방 없는 콘텐츠만 허용합니다.</p></div></aside></section>
    </main>`;
}

function renderFeedWrite(container) {
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>SOSO WRITE</span><h1>소소피드 올리기</h1></div><b>임시저장</b></div>
      <section class="write-layout">
        <article class="write-card">
          <div class="write-tabs"><button class="active">사진/짤</button><button>짧은 글</button><button>질문</button></div>
          <label>제목</label><input placeholder="예: 이 사진 제목 뭐가 제일 웃김?" />
          <label>본문 또는 상황 설명</label><textarea placeholder="사진이나 상황을 짧게 설명해주세요. 개인정보, 비방, 저작권 문제 있는 내용은 올릴 수 없습니다."></textarea>
          <div class="upload-box"><div>📸</div><b>사진 업로드 영역</b><span>다음 단계에서 Firebase Storage와 연결됩니다.</span></div>
          <label>AI가 만들어줄 참여 질문</label><input placeholder="예: 이 상황에서 제일 웃긴 제목은?" />
          <div class="option-editor"><input placeholder="선택지 1"/><input placeholder="선택지 2"/><input placeholder="선택지 3"/><input placeholder="선택지 4"/></div>
          <button class="write-submit">미리보기 생성</button>
        </article>
        <aside class="write-preview">
          <b>미리보기</b>
          <div class="feed-card preview-card"><div class="feed-card-top"><span>📸 사진 제목학원</span><b>미리보기</b></div><h3>제목을 입력하면 여기에 표시됩니다</h3><p>본문 설명과 AI 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.</p><div class="feed-question"><b>AI 질문 예시</b><div class="feed-option"><span>월요일 아침 내 표정</span><i style="--w:72%"></i></div><div class="feed-option"><span>퇴근 1분 전 부장님</span><i style="--w:48%"></i></div></div><div class="feed-top-comment"><b>인기 한 줄 예시</b><span>이건 제목만 봐도 상황이 그려짐.</span></div></div>
          <div class="side-card caution"><b>아직 저장 전</b><p>현재는 디자인/흐름 확인용 화면입니다. 다음 단계에서 Firestore 저장, 이미지 업로드, 관리자 검수 상태를 연결합니다.</p></div>
        </aside>
      </section>
    </main>`;
}

function feedCard(item) {
  const total = item.options.length * 17 + (item.stats.likes % 33);
  return `<article class="feed-card"><div class="feed-card-top"><span>${item.badge} ${escapeHtml(item.type)}</span><b>조회 ${num(item.stats.views)}</b></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="feed-question"><b>${escapeHtml(item.question)}</b>${item.options.map((o, i) => `<div class="feed-option"><span>${escapeHtml(o)}</span><i style="--w:${Math.max(12, Math.min(88, total - i * 13))}%"></i></div>`).join('')}</div><div class="feed-top-comment"><b>인기 한 줄</b><span>${escapeHtml(item.topComment)}</span></div><div class="feed-tags">${item.tags.map(t => `<span>#${escapeHtml(t)}</span>`).join('')}</div><div class="feed-card-bottom"><span>♡ ${num(item.stats.likes)}</span><span>💬 ${num(item.stats.comments)}</span><button type="button">참여하기</button></div></article>`;
}

function injectFeedStyle() {
  if (document.getElementById('sosoking-feed-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-feed-style';
  style.textContent = `.soso-feed-page{padding:22px clamp(18px,4vw,36px) 108px}.feed-hero,.feed-dashboard,.feed-layout,.write-layout,.feed-write-header{max-width:1120px;margin-left:auto;margin-right:auto}.feed-hero{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:stretch;margin-bottom:16px}.feed-hero-copy{position:relative;overflow:hidden;border-radius:34px;padding:34px;background:linear-gradient(135deg,#101b3c,#4f7cff 62%,#7c5cff);color:#fff;box-shadow:0 28px 80px rgba(79,124,255,.22)}.feed-hero-copy:after{content:'✦';position:absolute;right:28px;top:16px;font-size:110px;opacity:.12}.feed-hero-copy span{font-size:11px;font-weight:1000;letter-spacing:.16em;color:rgba(255,255,255,.72)}.feed-hero-copy h1{max-width:720px;margin:8px 0 10px;font-size:clamp(34px,6vw,58px);line-height:1.04;letter-spacing:-.07em}.feed-hero-copy p{max-width:620px;margin:0;color:rgba(255,255,255,.76);font-size:15px;line-height:1.75}.feed-actions{display:flex;gap:8px;margin-top:22px}.feed-actions a{display:inline-flex;padding:13px 16px;border-radius:16px;text-decoration:none;font-weight:1000}.feed-actions a:first-child{background:#fff;color:#17245f}.feed-actions a:last-child{background:rgba(255,255,255,.14);color:#fff}.feed-stat-card{display:grid;gap:10px;border-radius:30px;padding:22px;background:rgba(255,255,255,.88);box-shadow:0 18px 54px rgba(55,90,170,.13)}.feed-stat-card>b{font-size:17px}.feed-stat-card div{padding:14px;border-radius:18px;background:rgba(79,124,255,.07)}.feed-stat-card span{display:block;color:var(--predict-muted);font-size:12px;font-weight:900}.feed-stat-card strong{font-size:24px;color:var(--predict-main)}.feed-dashboard{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.feed-dashboard article,.side-card,.feed-card,.write-card,.write-preview{border:1px solid rgba(79,124,255,.12);background:rgba(255,255,255,.86);border-radius:24px;box-shadow:0 16px 46px rgba(55,90,170,.10)}.feed-dashboard article{padding:16px}.feed-dashboard b{display:block;font-size:14px}.feed-dashboard span{display:block;margin-top:5px;color:var(--predict-muted);font-size:13px;line-height:1.5}.feed-layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.feed-mini-link{border:1px solid var(--predict-line);background:var(--predict-card);border-radius:999px;padding:9px 12px;color:var(--predict-ink);font-weight:900;text-decoration:none}.feed-list{display:grid;gap:14px}.feed-card{position:relative;overflow:hidden;padding:18px}.feed-card:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,#4f7cff,#ff5c8a,#ffc542)}.feed-card-top{display:flex;justify-content:space-between;gap:10px;margin-bottom:12px}.feed-card-top span,.feed-card-top b{display:inline-flex;padding:7px 10px;border-radius:999px;background:rgba(79,124,255,.08);font-size:11px;font-weight:1000;color:var(--predict-main)}.feed-card-top b{color:var(--predict-hot);background:rgba(255,92,138,.10)}.feed-card h3{margin:0;font-size:24px;line-height:1.28;letter-spacing:-.05em}.feed-card p{color:var(--predict-muted);line-height:1.75}.feed-question{margin-top:12px;padding:14px;border-radius:20px;background:rgba(79,124,255,.06)}.feed-question>b{display:block;margin-bottom:10px}.feed-option{position:relative;overflow:hidden;margin-top:8px;padding:11px 12px;border-radius:14px;background:#fff}.feed-option span{position:relative;z-index:2;font-size:13px;font-weight:900}.feed-option i{position:absolute;left:0;top:0;bottom:0;width:var(--w);background:linear-gradient(90deg,rgba(79,124,255,.16),rgba(255,92,138,.14))}.feed-top-comment{margin-top:12px;padding:13px;border-radius:18px;background:rgba(255,197,66,.12)}.feed-top-comment b{display:block;font-size:12px;color:#a06a00}.feed-top-comment span{display:block;margin-top:4px;color:var(--predict-ink);font-size:13px;line-height:1.55}.feed-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.feed-tags span,.side-tags span{display:inline-flex;padding:6px 9px;border-radius:999px;background:rgba(79,124,255,.08);color:var(--predict-main);font-size:12px;font-weight:900}.feed-card-bottom{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--predict-muted);font-size:13px;font-weight:900}.feed-card-bottom button{margin-left:auto;border:0;border-radius:14px;padding:11px 14px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000}.feed-side{display:grid;gap:12px;position:sticky;top:16px}.side-card{padding:16px}.side-card b{display:block;font-size:16px}.side-card p{color:var(--predict-muted);font-size:13px;line-height:1.7}.side-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.side-card.caution{background:linear-gradient(135deg,rgba(255,197,66,.13),rgba(255,255,255,.86))}.write-layout{display:grid;grid-template-columns:1fr 360px;gap:16px}.write-card,.write-preview{padding:18px}.write-tabs{display:flex;gap:8px;margin-bottom:14px}.write-tabs button{border:1px solid var(--predict-line);border-radius:999px;padding:9px 12px;background:var(--predict-card);font-weight:900}.write-tabs .active{background:var(--predict-main);color:#fff}.write-card label{display:block;margin:14px 0 7px;color:var(--predict-muted);font-size:12px;font-weight:1000}.write-card input,.write-card textarea{width:100%;border:1px solid var(--predict-line);border-radius:16px;padding:13px;background:var(--predict-bg);color:var(--predict-ink);font-family:inherit}.write-card textarea{min-height:100px;resize:vertical}.upload-box{margin-top:14px;border:1.5px dashed rgba(79,124,255,.32);border-radius:20px;padding:28px;text-align:center;background:rgba(79,124,255,.06)}.upload-box div{font-size:38px}.upload-box span{display:block;color:var(--predict-muted);font-size:12px;margin-top:5px}.option-editor{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.write-submit{width:100%;margin-top:16px;border:0;border-radius:18px;padding:15px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000}.preview-card{margin-top:12px;box-shadow:none}@media(max-width:900px){.feed-hero,.feed-layout,.write-layout{grid-template-columns:1fr}.feed-side{position:static}.feed-dashboard{grid-template-columns:1fr}.feed-card h3{font-size:21px}.feed-actions{flex-direction:column}.option-editor{grid-template-columns:1fr}}[data-theme="dark"] .feed-stat-card,[data-theme="dark"] .feed-dashboard article,[data-theme="dark"] .side-card,[data-theme="dark"] .feed-card,[data-theme="dark"] .write-card,[data-theme="dark"] .write-preview{background:rgba(16,23,34,.88);box-shadow:none}[data-theme="dark"] .feed-option{background:rgba(255,255,255,.06)}`;
  document.head.appendChild(style);
}

function num(n){return Number(n||0).toLocaleString()}
function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
