import { injectAppStyle } from '../components/ui-style.js';
import { createFeedPost, uploadFeedImage } from '../feed/feed-engine.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const CATEGORIES = [
  { id:'fun', label:'재미', icon:'😂', desc:'짤, 드립, 댓글놀이' },
  { id:'game', label:'게임/투표', icon:'🎮', desc:'선택하고 겨루기' },
  { id:'quiz', label:'퀴즈', icon:'🧠', desc:'정답·센스 문제' },
  { id:'story', label:'소설/역할극', icon:'🎭', desc:'누구나 이어쓰기' },
  { id:'info', label:'정보', icon:'🔗', desc:'링크·AI 요약' },
  { id:'media', label:'영상/이미지', icon:'🎬', desc:'유튜브·이미지 링크' },
  { id:'talk', label:'토론', icon:'💬', desc:'생각 갈림 주제' },
  { id:'ai', label:'AI', icon:'🤖', desc:'AI 답변으로 놀기' }
];

const FEED_WRITE_TYPES = [
  { category:'fun', type:'사진 제목학원', badge:'📸', panel:'default', desc:'사진 한 장에 가장 웃긴 제목을 붙이는 참여형 글입니다.', titlePlaceholder:'예: 이 사진 제목 뭐가 제일 웃김?', contentPlaceholder:'사진 상황을 짧게 설명해주세요.', questionPlaceholder:'예: 이 사진에 제일 잘 어울리는 제목은?', options:['월요일 아침 내 표정','퇴근 1분 전 부장님','급식 마지막 치킨 한 조각','댓글로 제목 달기'] },
  { category:'fun', type:'댓글 배틀', badge:'🔥', panel:'default', desc:'본문보다 댓글이 주인공인 드립 대결형 글입니다.', titlePlaceholder:'예: 이 상황에서 제일 킹받는 한마디는?', contentPlaceholder:'상황만 짧게 던지고 댓글로 드립을 받는 글입니다.', questionPlaceholder:'예: 댓글 배틀 시작! 당신의 한마디는?', options:['참는다','받아친다','읽씹한다','댓글이 정답'] },
  { category:'fun', type:'웃참 챌린지', badge:'🤣', panel:'default', desc:'웃긴 상황을 올리고 누가 참을 수 있는지 고르는 글입니다.', titlePlaceholder:'예: 이거 보고 안 웃으면 인정', contentPlaceholder:'웃긴 상황, 짤, 대사를 적어주세요.', questionPlaceholder:'예: 웃참 가능?', options:['불가능','가능','애매함','댓글이 더 웃김'] },

  { category:'game', type:'밸런스게임', badge:'⚖️', panel:'default', desc:'둘 중 하나를 고르게 만드는 가벼운 선택 게임입니다.', titlePlaceholder:'예: 평생 하나만 먹는다면?', contentPlaceholder:'비교할 상황을 짧고 분명하게 적어주세요.', questionPlaceholder:'예: 당신의 선택은?', options:['A 선택','B 선택','둘 다 싫다','댓글로 다른 선택'] },
  { category:'game', type:'민심 투표', badge:'🗳️', panel:'default', desc:'사람들 생각을 빠르게 확인하는 투표형 글입니다.', titlePlaceholder:'예: 이거 나만 불편해?', contentPlaceholder:'투표하고 싶은 상황을 짧게 설명해주세요.', questionPlaceholder:'예: 사람들 생각은?', options:['나도 그럼','전혀 아님','상황마다 다름','댓글 봐야 함'] },
  { category:'game', type:'선택지 배틀', badge:'🥊', panel:'default', desc:'여러 후보를 붙여 사람들이 고르게 하는 글입니다.', titlePlaceholder:'예: 오늘 야식 최강자는?', contentPlaceholder:'붙이고 싶은 후보들을 적어주세요.', questionPlaceholder:'예: 최종 승자는?', options:['1번 후보','2번 후보','3번 후보','댓글 추천'] },

  { category:'quiz', type:'정답 퀴즈', badge:'✅', panel:'quiz', desc:'정답과 해설이 있는 퀴즈형 글입니다.', titlePlaceholder:'예: 이 상황에서 범인은 누구?', contentPlaceholder:'문제 설명과 힌트를 적어주세요.', questionPlaceholder:'예: 정답은 무엇일까요?', options:['1번','2번','3번','4번'] },
  { category:'quiz', type:'센스 퀴즈', badge:'🧩', panel:'quiz', desc:'정답보다 센스 있는 답을 고르는 문제형 글입니다.', titlePlaceholder:'예: 이 상황에서 제일 센스 있는 답은?', contentPlaceholder:'상황과 보기의 의도를 적어주세요.', questionPlaceholder:'예: 제일 센스 있는 답은?', options:['1번','2번','3번','댓글이 정답'] },
  { category:'quiz', type:'심리 테스트', badge:'🔮', panel:'quiz', desc:'선택지로 성향을 가볍게 보는 놀이입니다.', titlePlaceholder:'예: 당신의 숨은 성격은?', contentPlaceholder:'테스트 상황과 결과 느낌을 적어주세요.', questionPlaceholder:'예: 가장 끌리는 선택은?', options:['A','B','C','D'] },

  { category:'story', type:'릴레이소설', badge:'📚', panel:'story', desc:'제목과 첫 장면을 올리면 누구든 댓글로 이어가는 소설입니다.', titlePlaceholder:'예: 갑자기 고양이가 말을 걸었다', contentPlaceholder:'첫 장면을 적어주세요. 다음 장면은 댓글이 이어갑니다.', questionPlaceholder:'예: 다음 장면은 어떻게 될까요?', options:['반전','감동','공포','개그'] },
  { category:'story', type:'막장드라마', badge:'💥', panel:'story', desc:'막장 상황을 던지고 댓글로 다음 장면을 이어가는 글입니다.', titlePlaceholder:'예: 결혼식장에서 전 남친이 나타났다', contentPlaceholder:'막장 상황의 첫 장면을 적어주세요.', questionPlaceholder:'예: 다음 전개는?', options:['복수','오열','반전','코미디'] },
  { category:'story', type:'역할극방', badge:'🎭', panel:'roleplay', desc:'등장인물을 정하거나 유저가 직접 역할을 입력해 이어가는 역할극입니다.', titlePlaceholder:'예: 수상한 아파트 단톡방', contentPlaceholder:'세계관과 시작 상황을 적어주세요.', questionPlaceholder:'예: 어떤 역할로 이어갈까요?', options:['주인공','빌런','목격자','새 역할 입력'] },

  { category:'info', type:'정보공유', badge:'🔗', panel:'link', desc:'유용한 사이트 링크를 AI 요약 카드로 정리해 공유합니다.', titlePlaceholder:'예: 무료 이미지 사이트 추천', contentPlaceholder:'링크가 어떤 점에서 유용한지 직접 설명하거나, AI 요약 버튼을 눌러 채워보세요.', questionPlaceholder:'예: 이 정보 쓸만한가요?', options:['유용함','나중에 볼래','다른 사이트 추천','댓글로 의견'] },
  { category:'info', type:'꿀팁 링크', badge:'💡', panel:'link', desc:'작업·생활·공부에 유용한 링크를 짧게 정리합니다.', titlePlaceholder:'예: 표지 디자인 참고 사이트', contentPlaceholder:'왜 유용한지 적거나 AI 요약을 활용해보세요.', questionPlaceholder:'예: 이 꿀팁 저장각인가요?', options:['저장각','애매함','이미 알고 있음','댓글로 추천'] },
  { category:'info', type:'사이트 추천', badge:'🛠️', panel:'link', desc:'유용한 웹사이트를 소개하고 사람들 평가를 받습니다.', titlePlaceholder:'예: 업무 자동화에 좋은 사이트', contentPlaceholder:'사이트 사용법과 장단점을 적어주세요.', questionPlaceholder:'예: 이 사이트 써볼 만한가요?', options:['좋음','보통','별로','대체 사이트 추천'] },

  { category:'media', type:'영상 리액션', badge:'🎬', panel:'link', desc:'유튜브/쇼츠 링크를 붙이고 영상 반응을 모으는 글입니다.', titlePlaceholder:'예: 이 영상 한 줄 요약하면?', contentPlaceholder:'유튜브 링크와 웃긴 장면 설명을 적어주세요.', questionPlaceholder:'예: 이 영상의 제일 웃긴 포인트는?', options:['웃김','킹받음','공감됨','댓글로 요약'] },
  { category:'media', type:'이미지 링크', badge:'🖼️', panel:'link', desc:'이미지 주소를 붙여 짤/자료를 카드로 공유합니다.', titlePlaceholder:'예: 이 짤 제목 뭐가 제일 웃김?', contentPlaceholder:'이미지 링크의 출처와 상황 설명을 적어주세요.', questionPlaceholder:'예: 이 이미지 한 줄 평은?', options:['웃김','공감됨','저장각','댓글로 제목'] },

  { category:'talk', type:'소소토론', badge:'💬', panel:'default', desc:'사소하지만 은근히 갈리는 주제로 의견을 나누는 글입니다.', titlePlaceholder:'예: 카톡 답장 3시간 뒤면 서운하다 vs 아니다', contentPlaceholder:'토론 주제와 상황을 적어주세요. 공격적인 표현은 피해주세요.', questionPlaceholder:'예: 이 정도면 서운한가요?', options:['서운하다','괜찮다','상황마다 다르다','댓글로 의견'] },
  { category:'talk', type:'생각 갈림', badge:'🤔', panel:'default', desc:'사람마다 기준이 갈리는 주제를 묻는 글입니다.', titlePlaceholder:'예: 친구끼리 돈 계산 어디까지 해야 함?', contentPlaceholder:'갈리는 기준을 설명해주세요.', questionPlaceholder:'예: 내 생각은?', options:['엄격해야 함','대충 해도 됨','상황마다 다름','댓글로 기준'] },

  { category:'ai', type:'AI놀이', badge:'🤖', panel:'default', desc:'AI 답변, 상상력, 밈을 활용해 같이 노는 글입니다.', titlePlaceholder:'예: AI한테 이런 답변 받았는데 누가 제일 웃김?', contentPlaceholder:'AI가 만든 문장, 이미지 설명, 상황극 내용을 적어주세요.', questionPlaceholder:'예: 어떤 버전이 제일 재밌나요?', options:['더 웃기게','더 현실적으로','더 과하게','댓글로 이어가기'] },
  { category:'ai', type:'AI 역할극', badge:'🎙️', panel:'roleplay', desc:'AI가 만든 캐릭터나 상황을 바탕으로 역할극을 이어갑니다.', titlePlaceholder:'예: AI가 만든 이상한 왕국 회의', contentPlaceholder:'세계관과 시작 대사를 적어주세요.', questionPlaceholder:'예: 어떤 역할로 참여할까요?', options:['왕','신하','반란군','새 역할 입력'] }
];

const QUICK_IDEAS = [
  { type:'정보공유', title:'작업할 때 유용한 사이트 추천', content:'유용한 링크를 넣고 AI 요약을 눌러 핵심만 정리해보세요.', question:'이 사이트 쓸만한가요?', options:['유용함','나중에 볼래','다른 사이트 추천','댓글로 의견'] },
  { type:'릴레이소설', title:'갑자기 고양이가 말을 걸었다', content:'평범한 밤, 창문 밖에서 고양이가 사람 목소리로 나를 불렀다.', question:'다음 장면은?', options:['반전','감동','공포','개그'] },
  { type:'역할극방', title:'수상한 아파트 단톡방', content:'새벽 2시, 단톡방에 누군가 “지금 복도에 있는 사람 누구세요?”라고 올렸다.', question:'어떤 역할로 이어갈까요?', options:['입주민','관리인','목격자','새 역할 입력'] },
  { type:'막장드라마', title:'결혼식장에서 전 남친이 나타났다', content:'축가가 시작되려는 순간, 문이 열리고 예상 못 한 사람이 들어왔다.', question:'다음 전개는?', options:['복수','오열','반전','코미디'] },
  { type:'밸런스게임', title:'평생 하나만 먹는다면?', content:'하나만 고를 수 있다면 무엇을 선택할 건가요?', question:'당신의 선택은?', options:['라면','치킨','떡볶이','댓글로 다른 선택'] },
  { type:'영상 리액션', title:'이 영상 한 줄 요약하면?', content:'영상 링크를 붙이고 제일 웃긴 장면을 설명해주세요.', question:'이 영상의 한 줄 평은?', options:['웃김','킹받음','공감됨','댓글로 요약'] }
];

const DEFAULT_CATEGORY = 'fun';
function getTypeConfig(type) { return FEED_WRITE_TYPES.find(item => item.type === type) || FEED_WRITE_TYPES[0]; }
function getCategory(id) { return CATEGORIES.find(item => item.id === id) || CATEGORIES[0]; }
function typeButtons(categoryId) { return FEED_WRITE_TYPES.filter(item => item.category === categoryId).map((item, index) => `<button type="button" data-type="${escapeAttr(item.type)}" class="${index === 0 ? 'active' : ''}"><b>${item.badge}</b> ${escapeHtml(item.type)}</button>`).join(''); }
function categoryButtons(activeId = DEFAULT_CATEGORY) { return CATEGORIES.map(item => `<button type="button" data-category="${item.id}" class="${item.id === activeId ? 'active' : ''}"><b>${item.icon}</b><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.desc)}</small></button>`).join(''); }
function mediaTypeFor(type, linkUrl) { if (!linkUrl) return 'none'; if (/youtu\.be|youtube\.com/.test(linkUrl)) return 'youtube'; if (/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(linkUrl)) return 'image_link'; return ['정보공유','꿀팁 링크','사이트 추천'].includes(type) ? 'link_summary' : 'link'; }

export function renderSosoFeed(container) {
  const hash = location.hash || '#/feed';
  if (hash === '#/feed/new') return renderFeedWrite(container);
  injectAppStyle();
  container.innerHTML = `<main class="predict-app soso-feed-page"><section class="feed-hero"><div class="feed-hero-copy"><span>SOSO FEED</span><h1>소소피드 불러오는 중</h1><p>피드 목록과 상세 화면을 준비하고 있습니다.</p></div></section></main>`;
  import('./soso-feed.js').then(module => module.renderSosoFeed(container)).catch(() => {
    container.innerHTML = `<main class="predict-app soso-feed-page"><section class="feed-empty-state"><div>!</div><h3>소소피드를 불러오지 못했습니다</h3><p>잠시 후 다시 시도해주세요.</p><a href="#/">홈으로</a></section></main>`;
  });
}

function renderFeedWrite(container) {
  injectAppStyle(); injectWriteFunStyle();
  const startCategory = DEFAULT_CATEGORY;
  const config = FEED_WRITE_TYPES.find(item => item.category === startCategory) || FEED_WRITE_TYPES[0];
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <div class="simple-header feed-write-header"><a href="#/feed" class="back-link">‹</a><div><span>SOSO WRITE</span><h1>소소피드 만들기</h1></div><b>카테고리형</b></div>
      <section class="write-layout">
        <form id="feed-write-form" class="write-card fun-write-card">
          <div class="fun-write-hero"><span>MAKE ANYTHING</span><h2>재미, 정보, 소설, 역할극까지</h2><p>먼저 카테고리를 고르고, 그 안에서 글 형식을 선택하세요. 투표형·퀴즈형·정보형·이어쓰기형이 각각 다르게 준비됩니다.</p><div><button type="button" id="random-idea-btn">🎲 랜덤 주제</button><a href="#/mission">🎯 미션 보기</a></div></div>
          <label>카테고리</label><div class="category-grid">${categoryButtons(startCategory)}</div>
          <label>세부 형식</label><div id="type-grid" class="write-tabs fun-type-tabs" style="flex-wrap:wrap">${typeButtons(startCategory)}</div>
          <p id="feed-type-help" class="write-status">${escapeHtml(config.desc)}</p><input id="feed-type" type="hidden" value="${escapeAttr(config.type)}" />

          <div id="link-panel" class="link-panel" hidden>
            <label>사이트/영상/이미지 링크</label><input id="feed-link-url" placeholder="https:// 로 시작하는 링크를 붙여넣으세요" />
            <div class="link-actions"><button type="button" id="link-summary-btn">🤖 AI 요약</button><button type="button" id="link-card-btn">🔗 링크 카드 적용</button></div>
            <label>링크 제목</label><input id="feed-link-title" maxlength="120" placeholder="예: 무료 이미지 사이트 추천" />
            <label>링크 요약</label><textarea id="feed-link-summary" maxlength="260" placeholder="AI 요약 또는 직접 입력한 핵심 설명이 여기에 들어갑니다."></textarea>
            <p id="link-status" class="write-status">원문 전체를 복사하지 않고, 핵심 요약과 바로가기만 표시합니다.</p>
          </div>

          <div id="quiz-panel" class="extra-panel" hidden><label>정답 또는 해설</label><input id="quiz-answer" maxlength="80" placeholder="예: 정답은 2번 / 해설은 댓글에서 공개" /><textarea id="quiz-explain" maxlength="260" placeholder="짧은 해설이나 힌트를 적어주세요."></textarea></div>
          <div id="story-panel" class="extra-panel" hidden><label>소설 설정</label><input id="story-genre" maxlength="40" placeholder="장르 예: 막장, 로맨스, 공포, 개그" /><input id="story-opening" maxlength="140" placeholder="첫 문장 또는 시작 장면" /><textarea id="story-rule" maxlength="260" placeholder="이어쓰기 규칙 예: 누구나 한 문단씩, 욕설 금지, 반전 환영"></textarea></div>
          <div id="role-panel" class="extra-panel" hidden><label>역할극 설정</label><textarea id="role-characters" maxlength="360" placeholder="기본 등장인물 예: 주인공, 빌런, 목격자, 수상한 이웃"></textarea><select id="role-mode"><option value="free">유저가 직접 역할 입력 가능</option><option value="fixed">글쓴이가 정한 등장인물만 선택</option><option value="mixed">기본 등장인물 + 새 역할 추가 가능</option></select></div>

          <label>제목</label><input id="feed-title" maxlength="90" placeholder="${escapeAttr(config.titlePlaceholder)}" required />
          <label>본문 또는 상황 설명</label><textarea id="feed-content" maxlength="1200" placeholder="${escapeAttr(config.contentPlaceholder)}" required></textarea>
          <label>사진 선택</label><div class="upload-box" id="feed-upload-box"><input id="feed-image" type="file" accept="image/*" hidden /><button type="button" id="feed-image-btn">📸 이미지 선택</button><b id="feed-image-name">선택된 이미지 없음</b><span id="feed-upload-help">이미지는 선택 사항입니다. 5MB 이하 이미지 파일만 업로드됩니다.</span><img id="feed-image-preview" class="upload-preview" alt="이미지 미리보기" hidden /></div>
          <label>참여 질문</label><input id="feed-question" maxlength="90" placeholder="${escapeAttr(config.questionPlaceholder)}" />
          <div class="option-editor">${config.options.map(option => `<input class="feed-option-input" value="${escapeAttr(option)}" placeholder="선택지" />`).join('')}</div>
          <label>태그</label><input id="feed-tags" placeholder="예: ${escapeAttr(config.type)}, 공감, 웃김" />
          <button class="write-submit" type="submit">소소피드 등록</button><p id="feed-write-status" class="write-status">카테고리를 고르면 세부 형식과 입력칸이 자동으로 바뀝니다.</p>
        </form>
        <aside class="write-preview"><b>미리보기</b><div class="feed-card preview-card"><div class="feed-card-top"><span id="preview-type-label">${escapeHtml(config.badge)} ${escapeHtml(config.type)}</span><b id="preview-category-label">${escapeHtml(getCategory(config.category).label)}</b></div><img id="preview-image" class="feed-image" alt="미리보기 이미지" hidden /><div id="preview-link-card" class="preview-link-card" hidden></div><div id="preview-extra-card" class="preview-extra-card" hidden></div><h3 id="preview-title">제목을 입력하면 여기에 표시됩니다</h3><p id="preview-content">본문 설명과 참여 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.</p><div class="feed-question"><b id="preview-question">${escapeHtml(config.questionPlaceholder.replace(/^예:\s*/, ''))}</b><div class="feed-option"><span id="preview-option-a">${escapeHtml(config.options[0])}</span><i style="--w:72%"></i></div><div class="feed-option"><span id="preview-option-b">${escapeHtml(config.options[1])}</span><i style="--w:48%"></i></div></div><div class="feed-top-comment"><b>참여 예시</b><span>투표하고 댓글로 이어가면 하나의 놀이판이 됩니다.</span></div></div><div class="side-card caution"><b>운영 방식</b><p>릴레이소설과 역할극은 지금은 댓글 이어쓰기 방식으로 시작하고, 이후 전용 이어쓰기 UI로 확장할 수 있습니다.</p></div></aside>
      </section>
    </main>`;
  bindWriteForm(container);
}

function bindWriteForm(container) {
  let category = DEFAULT_CATEGORY;
  let type = FEED_WRITE_TYPES.find(item => item.category === category)?.type || FEED_WRITE_TYPES[0].type;
  let selectedFile = null;
  const form = container.querySelector('#feed-write-form'); const status = container.querySelector('#feed-write-status'); const linkStatus = container.querySelector('#link-status');

  const updatePreview = () => {
    const config = getTypeConfig(type); const options = [...container.querySelectorAll('.feed-option-input')].map(input => input.value.trim()).filter(Boolean);
    container.querySelector('#preview-type-label').textContent = `${config.badge} ${config.type}`;
    container.querySelector('#preview-category-label').textContent = getCategory(config.category).label;
    container.querySelector('#preview-title').textContent = container.querySelector('#feed-title').value || '제목을 입력하면 여기에 표시됩니다';
    container.querySelector('#preview-content').textContent = container.querySelector('#feed-content').value || '본문 설명과 참여 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.';
    container.querySelector('#preview-question').textContent = container.querySelector('#feed-question').value || config.questionPlaceholder.replace(/^예:\s*/, '');
    container.querySelector('#preview-option-a').textContent = options[0] || config.options[0];
    container.querySelector('#preview-option-b').textContent = options[1] || config.options[1];
    const linkUrl = container.querySelector('#feed-link-url')?.value.trim() || ''; const linkTitle = container.querySelector('#feed-link-title')?.value.trim() || ''; const linkSummary = container.querySelector('#feed-link-summary')?.value.trim() || ''; const linkCard = container.querySelector('#preview-link-card');
    if (linkUrl) { linkCard.hidden = false; let host = ''; try { host = new URL(linkUrl).hostname.replace(/^www\./,''); } catch {} linkCard.innerHTML = `<b>🔗 ${escapeHtml(linkTitle || '링크 카드')}</b><p>${escapeHtml(linkSummary || '링크 요약이 여기에 표시됩니다.')}</p><small>${escapeHtml(host || '사이트 바로가기')}</small>`; } else linkCard.hidden = true;
    const extra = container.querySelector('#preview-extra-card');
    if (['story','roleplay','quiz'].includes(config.panel)) {
      extra.hidden = false;
      if (config.panel === 'story') extra.innerHTML = `<b>📚 이어쓰기 설정</b><p>장르: ${escapeHtml(container.querySelector('#story-genre').value || '자유')}<br>시작: ${escapeHtml(container.querySelector('#story-opening').value || '첫 장면을 입력하세요')}</p>`;
      if (config.panel === 'roleplay') extra.innerHTML = `<b>🎭 역할극 설정</b><p>${escapeHtml(container.querySelector('#role-characters').value || '등장인물을 입력하거나 유저가 직접 역할을 만들 수 있습니다.')}</p>`;
      if (config.panel === 'quiz') extra.innerHTML = `<b>✅ 퀴즈 설정</b><p>${escapeHtml(container.querySelector('#quiz-answer').value || '정답/해설을 입력할 수 있습니다.')}</p>`;
    } else extra.hidden = true;
  };

  const applyTypeConfig = (nextType) => {
    const config = getTypeConfig(nextType); type = config.type; category = config.category;
    container.querySelector('#feed-type').value = config.type; container.querySelector('#feed-type-help').textContent = config.desc;
    container.querySelectorAll('.category-grid button').forEach(btn => btn.classList.toggle('active', btn.dataset.category === config.category));
    ['link-panel','quiz-panel','story-panel','role-panel'].forEach(id => { const el = container.querySelector(`#${id}`); if (el) el.hidden = true; });
    if (config.panel === 'link') container.querySelector('#link-panel').hidden = false;
    if (config.panel === 'quiz') container.querySelector('#quiz-panel').hidden = false;
    if (config.panel === 'story') container.querySelector('#story-panel').hidden = false;
    if (config.panel === 'roleplay') container.querySelector('#role-panel').hidden = false;
    container.querySelector('#feed-title').placeholder = config.titlePlaceholder; container.querySelector('#feed-content').placeholder = config.contentPlaceholder; container.querySelector('#feed-question').placeholder = config.questionPlaceholder; container.querySelector('#feed-tags').placeholder = `예: ${config.type}, ${getCategory(config.category).label}, 소소킹`;
    container.querySelector('#feed-upload-help').textContent = config.type === '사진 제목학원' ? '사진 제목학원은 이미지가 있으면 훨씬 잘 살아납니다. 5MB 이하 이미지만 업로드됩니다.' : '이미지는 선택 사항입니다. 5MB 이하 이미지 파일만 업로드됩니다.';
    container.querySelectorAll('.feed-option-input').forEach((input, index) => { input.value = config.options[index] || ''; input.placeholder = `선택지 ${index + 1}`; });
    updatePreview();
  };

  const renderTypesForCategory = (categoryId) => {
    category = categoryId;
    container.querySelector('#type-grid').innerHTML = typeButtons(categoryId);
    bindTypeButtons();
    const first = FEED_WRITE_TYPES.find(item => item.category === categoryId) || FEED_WRITE_TYPES[0];
    applyTypeConfig(first.type);
  };

  const bindTypeButtons = () => container.querySelectorAll('#type-grid button').forEach(button => button.addEventListener('click', () => {
    container.querySelectorAll('#type-grid button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    applyTypeConfig(button.dataset.type || type);
  }));

  const fillIdea = (idea) => {
    const config = getTypeConfig(idea.type);
    renderTypesForCategory(config.category);
    container.querySelectorAll('#type-grid button').forEach(item => item.classList.toggle('active', item.dataset.type === idea.type));
    applyTypeConfig(idea.type);
    container.querySelector('#feed-title').value = idea.title; container.querySelector('#feed-content').value = idea.content; container.querySelector('#feed-question').value = idea.question; container.querySelector('#feed-tags').value = `${idea.type}, 미션, 참여`;
    container.querySelectorAll('.feed-option-input').forEach((input, index) => { input.value = idea.options[index] || ''; }); updatePreview(); status.textContent = '랜덤 주제를 적용했습니다. 마음에 맞게 고쳐서 올려보세요.';
  };

  container.querySelectorAll('.category-grid button').forEach(button => button.addEventListener('click', () => renderTypesForCategory(button.dataset.category || DEFAULT_CATEGORY)));
  bindTypeButtons();
  container.querySelector('#random-idea-btn')?.addEventListener('click', () => fillIdea(QUICK_IDEAS[Math.floor(Math.random() * QUICK_IDEAS.length)]));
  container.querySelector('#link-card-btn')?.addEventListener('click', () => { const url = container.querySelector('#feed-link-url').value.trim(); if (!url) return; try { const host = new URL(url).hostname.replace(/^www\./,''); if (!container.querySelector('#feed-link-title').value) container.querySelector('#feed-link-title').value = host; if (!container.querySelector('#feed-link-summary').value) container.querySelector('#feed-link-summary').value = '유용한 링크입니다. 핵심 내용을 확인하고 의견을 남겨보세요.'; linkStatus.textContent = '링크 카드를 적용했습니다.'; updatePreview(); } catch { linkStatus.textContent = '올바른 https 링크를 입력해주세요.'; } });
  container.querySelector('#link-summary-btn')?.addEventListener('click', async () => { const url = container.querySelector('#feed-link-url').value.trim(); if (!url) { linkStatus.textContent = '먼저 링크를 입력해주세요.'; return; } linkStatus.textContent = 'AI가 링크를 요약하고 있습니다.'; try { const fn = httpsCallable(functions, 'summarizeLink'); const res = await fn({ url }); const data = res.data || {}; container.querySelector('#feed-link-title').value = data.title || ''; container.querySelector('#feed-link-summary').value = data.summary || ''; if (!container.querySelector('#feed-title').value) container.querySelector('#feed-title').value = data.title || '유용한 링크 공유'; if (!container.querySelector('#feed-content').value) container.querySelector('#feed-content').value = `${data.summary || ''}\n${Array.isArray(data.points) && data.points.length ? data.points.map(p => `- ${p}`).join('\n') : ''}`.trim(); linkStatus.textContent = data.estimatedCostLabel || 'AI 요약을 적용했습니다. 원문은 바로가기 버튼으로 연결됩니다.'; updatePreview(); } catch (error) { linkStatus.textContent = error.message || 'AI 요약에 실패했습니다. 직접 제목과 요약을 입력해도 됩니다.'; } });
  container.querySelector('#feed-image-btn')?.addEventListener('click', () => container.querySelector('#feed-image')?.click());
  container.querySelector('#feed-image')?.addEventListener('change', event => { selectedFile = event.target.files?.[0] || null; if (!selectedFile) return; const url = URL.createObjectURL(selectedFile); container.querySelector('#feed-image-name').textContent = selectedFile.name; container.querySelector('#feed-upload-help').textContent = `${Math.round(selectedFile.size / 1024)}KB · 등록 시 업로드됩니다.`; container.querySelector('#feed-image-preview').src = url; container.querySelector('#feed-image-preview').hidden = false; container.querySelector('#preview-image').src = url; container.querySelector('#preview-image').hidden = false; });
  ['#feed-title','#feed-content','#feed-question','#feed-link-url','#feed-link-title','#feed-link-summary','#quiz-answer','#quiz-explain','#story-genre','#story-opening','#story-rule','#role-characters','#role-mode'].forEach(selector => container.querySelector(selector)?.addEventListener('input', updatePreview)); container.querySelectorAll('.feed-option-input').forEach(input => input.addEventListener('input', updatePreview)); applyTypeConfig(type);

  form?.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('.write-submit'); button.disabled = true; button.textContent = '등록 중...'; status.textContent = selectedFile ? '이미지를 업로드하고 있습니다. 0%' : '소소피드를 저장하고 있습니다.';
    try {
      let imageUrl = ''; if (selectedFile) imageUrl = await uploadFeedImage(selectedFile, pct => { status.textContent = `이미지를 업로드하고 있습니다. ${pct}%`; });
      const config = getTypeConfig(type); const linkUrl = container.querySelector('#feed-link-url')?.value.trim() || ''; const options = [...container.querySelectorAll('.feed-option-input')].map(input => input.value.trim()).filter(Boolean); const tags = container.querySelector('#feed-tags').value.split(',').map(value => value.trim()).filter(Boolean);
      const content = buildContent(container, config);
      const post = await createFeedPost({ type, title: container.querySelector('#feed-title').value, content, question: container.querySelector('#feed-question').value, options, tags:[...new Set([getCategory(config.category).label, config.type, ...tags])].slice(0,6), imageUrl, linkUrl, mediaType: mediaTypeFor(type, linkUrl), linkTitle: container.querySelector('#feed-link-title')?.value || '', linkSummary: container.querySelector('#feed-link-summary')?.value || '' });
      status.textContent = '등록 완료! 상세 화면으로 이동합니다.'; location.hash = `#/feed/${post.id}`;
    } catch (error) { status.textContent = error.message || '등록에 실패했습니다.'; button.disabled = false; button.textContent = '소소피드 등록'; }
  });
}

function buildContent(container, config) {
  const base = container.querySelector('#feed-content').value.trim();
  const lines = [];
  if (config.panel === 'quiz') {
    const answer = container.querySelector('#quiz-answer').value.trim(); const explain = container.querySelector('#quiz-explain').value.trim();
    if (answer || explain) lines.push(`[퀴즈 설정]\n정답/기준: ${answer || '댓글에서 공개'}\n해설: ${explain || '참여 후 확인'}`);
  }
  if (config.panel === 'story') {
    const genre = container.querySelector('#story-genre').value.trim(); const opening = container.querySelector('#story-opening').value.trim(); const rule = container.querySelector('#story-rule').value.trim();
    lines.push(`[이어쓰기 설정]\n장르: ${genre || '자유'}\n시작: ${opening || '첫 장면은 본문 참고'}\n규칙: ${rule || '누구나 댓글로 한 문단씩 이어가기'}`);
  }
  if (config.panel === 'roleplay') {
    const chars = container.querySelector('#role-characters').value.trim(); const modeText = container.querySelector('#role-mode').selectedOptions?.[0]?.textContent || '유저가 직접 역할 입력 가능';
    lines.push(`[역할극 설정]\n참여 방식: ${modeText}\n등장인물: ${chars || '유저가 자유롭게 역할을 입력합니다.'}`);
  }
  if (config.panel === 'link') {
    const linkTitle = container.querySelector('#feed-link-title').value.trim(); const linkSummary = container.querySelector('#feed-link-summary').value.trim();
    if (linkTitle || linkSummary) lines.push(`[링크 요약]\n${linkTitle}\n${linkSummary}`.trim());
  }
  return [base, ...lines].filter(Boolean).join('\n\n').slice(0, 1200);
}

function injectWriteFunStyle() { if (document.getElementById('soso-write-fun-style')) return; const style = document.createElement('style'); style.id = 'soso-write-fun-style'; style.textContent = `.fun-write-hero{padding:18px;border-radius:24px;background:linear-gradient(135deg,rgba(255,232,92,.26),rgba(124,92,255,.10));border:1px solid rgba(255,122,89,.14);margin-bottom:16px}.fun-write-hero span{display:inline-flex;padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.72);color:#ff5c8a;font-size:11px;font-weight:1000;letter-spacing:.12em}.fun-write-hero h2{margin:10px 0 6px;font-size:24px;letter-spacing:-.06em}.fun-write-hero p{margin:0;color:var(--soso-muted,#6d7588);line-height:1.65;font-size:13px}.fun-write-hero div{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.fun-write-hero button,.fun-write-hero a,.link-actions button{display:inline-flex;border:0;border-radius:16px;padding:11px 13px;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff;text-decoration:none;font-weight:1000}.fun-write-hero a,.link-actions button:nth-child(2){background:rgba(79,124,255,.10);color:#4f7cff}.category-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.category-grid button{min-height:78px;border:1px solid rgba(79,124,255,.12);border-radius:20px;background:rgba(255,255,255,.7);color:var(--soso-ink,#151a33);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;padding:10px;text-align:left}.category-grid button b{font-size:22px}.category-grid button span{font-weight:1000}.category-grid button small{color:var(--soso-muted,#6d7588);font-size:11px}.category-grid button.active{background:linear-gradient(135deg,#fff7d7,#eef3ff);box-shadow:0 12px 28px rgba(79,124,255,.13);border-color:rgba(255,122,89,.24)}.fun-type-tabs button{min-width:130px}.link-panel,.extra-panel{margin:14px 0;padding:16px;border-radius:24px;background:rgba(79,124,255,.06);border:1px solid rgba(79,124,255,.12)}.extra-panel{background:rgba(255,122,89,.06)}.link-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}.preview-link-card,.preview-extra-card{margin:12px 0;padding:14px;border-radius:20px;background:linear-gradient(135deg,rgba(79,124,255,.10),rgba(255,92,138,.08));border:1px solid rgba(79,124,255,.14)}.preview-extra-card{background:linear-gradient(135deg,rgba(255,232,92,.20),rgba(255,122,89,.08))}.preview-link-card b,.preview-extra-card b{display:block}.preview-link-card p,.preview-extra-card p{margin:6px 0;color:var(--soso-muted,#6d7588);line-height:1.55}.preview-link-card small{color:#4f7cff;font-weight:900}@media(max-width:680px){.category-grid{grid-template-columns:repeat(2,1fr)}}`; document.head.appendChild(style); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
