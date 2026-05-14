import { injectAppStyle } from '../components/ui-style.js';
import { createFeedPost, uploadFeedImage } from '../feed/feed-engine.js';

const FEED_WRITE_TYPES = [
  {
    type: '사진 제목학원',
    badge: '📸',
    desc: '사진 한 장에 가장 웃긴 제목을 붙이는 참여형 글입니다.',
    titlePlaceholder: '예: 이 사진 제목 뭐가 제일 웃김?',
    contentPlaceholder: '사진 상황을 짧게 설명해주세요. 저작권, 개인정보, 비방 요소가 있으면 올릴 수 없습니다.',
    questionPlaceholder: '예: 이 사진에 제일 잘 어울리는 제목은?',
    options: ['월요일 아침 내 표정', '퇴근 1분 전 부장님', '급식 마지막 치킨 한 조각', '댓글로 제목 달기']
  },
  {
    type: '밸런스게임',
    badge: '⚖️',
    desc: '둘 중 하나를 고르게 만드는 가벼운 선택 게임입니다.',
    titlePlaceholder: '예: 평생 하나만 먹는다면?',
    contentPlaceholder: '비교할 상황을 짧고 분명하게 적어주세요.',
    questionPlaceholder: '예: 당신의 선택은?',
    options: ['A 선택', 'B 선택', '둘 다 싫다', '댓글로 다른 선택']
  },
  {
    type: '소소토론',
    badge: '💬',
    desc: '사소하지만 은근히 갈리는 주제로 의견을 나누는 글입니다.',
    titlePlaceholder: '예: 카톡 답장 3시간 뒤면 서운하다 vs 아니다',
    contentPlaceholder: '토론 주제와 상황을 적어주세요. 공격적인 표현은 피해주세요.',
    questionPlaceholder: '예: 이 정도면 서운한가요?',
    options: ['서운하다', '괜찮다', '상황마다 다르다', '댓글로 의견']
  },
  {
    type: '퀴즈',
    badge: '🧠',
    desc: '정답을 맞히거나 센스 있는 답을 고르는 문제형 글입니다.',
    titlePlaceholder: '예: 이 상황에서 범인은 누구?',
    contentPlaceholder: '문제 설명과 필요한 힌트를 적어주세요.',
    questionPlaceholder: '예: 정답은 무엇일까요?',
    options: ['1번', '2번', '3번', '4번']
  },
  {
    type: 'AI놀이',
    badge: '🤖',
    desc: 'AI 답변, 상상력, 밈을 활용해 같이 노는 글입니다.',
    titlePlaceholder: '예: AI한테 이런 답변 받았는데 누가 제일 웃김?',
    contentPlaceholder: 'AI가 만든 문장, 이미지 설명, 상황극 내용을 적어주세요.',
    questionPlaceholder: '예: 어떤 버전이 제일 재밌나요?',
    options: ['더 웃기게', '더 현실적으로', '더 과하게', '댓글로 이어가기']
  }
];

function getTypeConfig(type) {
  return FEED_WRITE_TYPES.find(item => item.type === type) || FEED_WRITE_TYPES[0];
}

function typeButtons() {
  return FEED_WRITE_TYPES.map((item, index) => `
    <button type="button" data-type="${escapeAttr(item.type)}" class="${index === 0 ? 'active' : ''}">
      <b>${item.badge}</b> ${escapeHtml(item.type)}
    </button>
  `).join('');
}

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
  injectAppStyle();
  const config = FEED_WRITE_TYPES[0];
  container.innerHTML = `
    <main class="predict-app soso-feed-page">
      <div class="simple-header feed-write-header">
        <a href="#/feed" class="back-link">‹</a>
        <div><span>SOSO WRITE</span><h1>소소피드 만들기</h1></div>
        <b>유형 선택</b>
      </div>
      <section class="write-layout">
        <form id="feed-write-form" class="write-card">
          <label>글 유형</label>
          <div class="write-tabs" style="flex-wrap:wrap">${typeButtons()}</div>
          <p id="feed-type-help" class="write-status">${escapeHtml(config.desc)}</p>
          <input id="feed-type" type="hidden" value="${escapeAttr(config.type)}" />

          <label>제목</label>
          <input id="feed-title" maxlength="90" placeholder="${escapeAttr(config.titlePlaceholder)}" required />

          <label>본문 또는 상황 설명</label>
          <textarea id="feed-content" maxlength="1200" placeholder="${escapeAttr(config.contentPlaceholder)}" required></textarea>

          <label>사진 선택</label>
          <div class="upload-box" id="feed-upload-box">
            <input id="feed-image" type="file" accept="image/*" hidden />
            <button type="button" id="feed-image-btn">📸 이미지 선택</button>
            <b id="feed-image-name">선택된 이미지 없음</b>
            <span id="feed-upload-help">사진 제목학원은 이미지가 있으면 훨씬 잘 살아납니다. 5MB 이하 이미지만 업로드됩니다.</span>
            <img id="feed-image-preview" class="upload-preview" alt="이미지 미리보기" hidden />
          </div>

          <label>참여 질문</label>
          <input id="feed-question" maxlength="90" placeholder="${escapeAttr(config.questionPlaceholder)}" />

          <div class="option-editor">
            ${config.options.map(option => `<input class="feed-option-input" value="${escapeAttr(option)}" placeholder="선택지" />`).join('')}
          </div>

          <label>태그</label>
          <input id="feed-tags" placeholder="예: ${escapeAttr(config.type)}, 공감, 웃김" />

          <button class="write-submit" type="submit">소소피드 등록</button>
          <p id="feed-write-status" class="write-status">유형을 고르면 제목·질문·선택지 예시가 자동으로 바뀝니다.</p>
        </form>

        <aside class="write-preview">
          <b>미리보기</b>
          <div class="feed-card preview-card">
            <div class="feed-card-top"><span id="preview-type-label">${escapeHtml(config.badge)} ${escapeHtml(config.type)}</span><b>미리보기</b></div>
            <img id="preview-image" class="feed-image" alt="미리보기 이미지" hidden />
            <h3 id="preview-title">제목을 입력하면 여기에 표시됩니다</h3>
            <p id="preview-content">본문 설명과 참여 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.</p>
            <div class="feed-question">
              <b id="preview-question">${escapeHtml(config.questionPlaceholder.replace(/^예:\s*/, ''))}</b>
              <div class="feed-option"><span id="preview-option-a">${escapeHtml(config.options[0])}</span><i style="--w:72%"></i></div>
              <div class="feed-option"><span id="preview-option-b">${escapeHtml(config.options[1])}</span><i style="--w:48%"></i></div>
            </div>
            <div class="feed-top-comment"><b>인기 한 줄 예시</b><span>이건 제목만 봐도 상황이 그려짐.</span></div>
          </div>
          <div class="side-card caution"><b>연결 상태</b><p>글 유형, 이미지 업로드, 글 저장, 목록, 상세, 댓글, 좋아요, 조회수, 투표, 신고까지 기존 흐름과 연결됩니다.</p></div>
        </aside>
      </section>
    </main>`;
  bindWriteForm(container);
}

function bindWriteForm(container) {
  let type = FEED_WRITE_TYPES[0].type;
  let selectedFile = null;
  const form = container.querySelector('#feed-write-form');
  const status = container.querySelector('#feed-write-status');

  const updatePreview = () => {
    const config = getTypeConfig(type);
    const options = [...container.querySelectorAll('.feed-option-input')].map(input => input.value.trim()).filter(Boolean);
    container.querySelector('#preview-type-label').textContent = `${config.badge} ${config.type}`;
    container.querySelector('#preview-title').textContent = container.querySelector('#feed-title').value || '제목을 입력하면 여기에 표시됩니다';
    container.querySelector('#preview-content').textContent = container.querySelector('#feed-content').value || '본문 설명과 참여 질문 후보가 붙으면 하나의 소소피드 카드가 됩니다.';
    container.querySelector('#preview-question').textContent = container.querySelector('#feed-question').value || config.questionPlaceholder.replace(/^예:\s*/, '');
    container.querySelector('#preview-option-a').textContent = options[0] || config.options[0];
    container.querySelector('#preview-option-b').textContent = options[1] || config.options[1];
  };

  const applyTypeConfig = (nextType) => {
    const config = getTypeConfig(nextType);
    type = config.type;
    container.querySelector('#feed-type').value = config.type;
    container.querySelector('#feed-type-help').textContent = config.desc;
    container.querySelector('#feed-title').placeholder = config.titlePlaceholder;
    container.querySelector('#feed-content').placeholder = config.contentPlaceholder;
    container.querySelector('#feed-question').placeholder = config.questionPlaceholder;
    container.querySelector('#feed-tags').placeholder = `예: ${config.type}, 공감, 웃김`;
    container.querySelector('#feed-upload-help').textContent = config.type === '사진 제목학원'
      ? '사진 제목학원은 이미지가 있으면 훨씬 잘 살아납니다. 5MB 이하 이미지만 업로드됩니다.'
      : '이미지는 선택 사항입니다. 5MB 이하 이미지 파일만 업로드됩니다.';
    container.querySelectorAll('.feed-option-input').forEach((input, index) => {
      input.value = config.options[index] || '';
      input.placeholder = `선택지 ${index + 1}`;
    });
    updatePreview();
  };

  container.querySelector('#feed-image-btn')?.addEventListener('click', () => container.querySelector('#feed-image')?.click());
  container.querySelector('#feed-image')?.addEventListener('change', event => {
    selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    container.querySelector('#feed-image-name').textContent = selectedFile.name;
    container.querySelector('#feed-upload-help').textContent = `${Math.round(selectedFile.size / 1024)}KB · 등록 시 업로드됩니다.`;
    container.querySelector('#feed-image-preview').src = url;
    container.querySelector('#feed-image-preview').hidden = false;
    container.querySelector('#preview-image').src = url;
    container.querySelector('#preview-image').hidden = false;
  });

  container.querySelectorAll('.write-tabs button').forEach(button => button.addEventListener('click', () => {
    container.querySelectorAll('.write-tabs button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    applyTypeConfig(button.dataset.type || FEED_WRITE_TYPES[0].type);
  }));

  ['#feed-title', '#feed-content', '#feed-question'].forEach(selector => container.querySelector(selector)?.addEventListener('input', updatePreview));
  container.querySelectorAll('.feed-option-input').forEach(input => input.addEventListener('input', updatePreview));
  applyTypeConfig(type);

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('.write-submit');
    button.disabled = true;
    button.textContent = '등록 중...';
    status.textContent = selectedFile ? '이미지를 업로드하고 있습니다. 0%' : '소소피드를 저장하고 있습니다.';
    try {
      let imageUrl = '';
      if (selectedFile) imageUrl = await uploadFeedImage(selectedFile, pct => { status.textContent = `이미지를 업로드하고 있습니다. ${pct}%`; });
      const options = [...container.querySelectorAll('.feed-option-input')].map(input => input.value.trim()).filter(Boolean);
      const tags = container.querySelector('#feed-tags').value.split(',').map(value => value.trim()).filter(Boolean);
      const post = await createFeedPost({
        type,
        title: container.querySelector('#feed-title').value,
        content: container.querySelector('#feed-content').value,
        question: container.querySelector('#feed-question').value,
        options,
        tags,
        imageUrl
      });
      status.textContent = '등록 완료! 상세 화면으로 이동합니다.';
      location.hash = `#/feed/${post.id}`;
    } catch (error) {
      status.textContent = error.message || '등록에 실패했습니다.';
      button.disabled = false;
      button.textContent = '소소피드 등록';
    }
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
