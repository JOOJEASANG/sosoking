import { db, auth } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate, getQueryParams } from '../router.js';
import { toast } from '../components/toast.js';
import { initImageUploader, getUploadedImages } from '../components/image-uploader.js';
import { setMeta } from '../utils/seo.js';

/* ── 카테고리/유형 정의 ── */
const CATEGORIES = [
  {
    key: 'golra', label: '골라봐', icon: '🎯', badge: '선택형', desc: '선택·투표·배틀',
    types: [
      { key: 'balance', icon: '⚖️', label: '밸런스게임', desc: 'A vs B, 둘 중 하나만!' },
      { key: 'vote',    icon: '🗳️', label: '민심투표',   desc: '여러 선택지로 투표해요' },
      { key: 'battle',  icon: '⚔️', label: '선택지배틀', desc: '후보들 중 최강자는?' },
    ],
  },
  {
    key: 'usgyo', label: '웃겨봐', icon: '😂', badge: '드립형', desc: '센스·유머 대결',
    types: [
      { key: 'naming',   icon: '😜', label: '미친작명소', desc: '사진에 웃긴 제목 붙이기' },
      { key: 'acrostic', icon: '✍️', label: '삼행시짓기', desc: '제시어로 삼행시 도전' },
      { key: 'drip',     icon: '🎤', label: '한줄드립',   desc: '한 줄로 터지는 드립 대결' },
    ],
  },
  {
    key: 'malhe', label: '도전봐', icon: '🎮', badge: '도전형', desc: '퀴즈·릴레이·창작',
    types: [
      { key: 'ox',           icon: '❓', label: 'OX퀴즈',    desc: '맞으면 O, 틀리면 X' },
      { key: 'relay',        icon: '🎭', label: '막장릴레이', desc: '한 문장씩 이어가는 스토리' },
      { key: 'random_battle', icon: '🎰', label: '랜덤대결',  desc: '같은 주제로 누가 더 재밌어?' },
    ],
  },
];

let selectedCat  = null;
let selectedType = null;

export function renderWrite() {
  setMeta('글 쓰기');
  const el = document.getElementById('page-content');
  selectedCat  = null;
  selectedType = null;

  // Support ?type=X for direct navigation from quick-start buttons
  const { type: typeParam } = getQueryParams();
  if (typeParam) {
    for (const cat of CATEGORIES) {
      const found = cat.types.find(t => t.key === typeParam);
      if (found) {
        selectedCat  = cat;
        selectedType = found;
        renderForm(el);
        return;
      }
    }
  }

  renderTypeSelect(el);
}

function stepIndicator(current) {
  const steps = ['유형 선택', '작성'];
  return `
    <div class="write-steps">
      ${steps.map((label, i) => `
        ${i > 0 ? `<div class="write-step-line ${i < current ? 'done' : ''}"></div>` : ''}
        <div class="write-step-dot ${i + 1 < current ? 'done' : i + 1 === current ? 'current' : 'pending'}" title="${label}">
          ${i + 1 < current ? '✓' : i + 1}
        </div>`).join('')}
    </div>`;
}

/* ── 1단계: 유형 선택 (카테고리 그룹 라벨만 표시, 클릭 즉시 작성 이동) ── */
function renderTypeSelect(el) {
  el.innerHTML = `
    <div class="write-page">
      ${stepIndicator(1)}
      <div class="write-step-header">
        <h1 class="write-step-title">어떤 놀이판 만들까요?</h1>
      </div>
      ${CATEGORIES.map(cat => `
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="font-size:16px">${cat.icon}</span>
            <span style="font-size:13px;font-weight:700;color:var(--color-text-secondary)">${cat.label}</span>
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:var(--color-${cat.key}-bg);color:var(--color-${cat.key}-dark);border:1px solid var(--color-${cat.key}-border)">${cat.badge}</span>
          </div>
          <div class="type-select-grid">
            ${cat.types.map(t => `
              <div class="type-select-card" data-type="${t.key}" data-cat="${cat.key}">
                <div class="type-select-card__icon">${t.icon}</div>
                <div class="type-select-card__name">${t.label}</div>
                <div class="type-select-card__desc">${t.desc}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  document.querySelectorAll('[data-type]').forEach(card => {
    card.addEventListener('click', () => {
      selectedCat  = CATEGORIES.find(c => c.key === card.dataset.cat);
      selectedType = selectedCat.types.find(t => t.key === card.dataset.type);
      renderForm(el);
    });
  });
}

/* ── 2단계: 작성 폼 ── */
function renderForm(el) {
  const type = selectedType.key;
  const hasDraft = !!localStorage.getItem(`write-draft-${type}`);

  el.innerHTML = `
    <div class="write-page">
      ${stepIndicator(2)}
      <div class="write-step-header">
        <button class="write-back-btn" id="btn-back-type">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 class="write-step-title">${selectedType.icon} ${selectedType.label}</h1>
      </div>
      ${hasDraft ? `
        <div style="background:var(--color-primary-bg);border:1px solid var(--color-primary-border);border-radius:10px;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:13px">
          <span>💾 저장된 임시 초안이 있어요</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn--primary btn--sm" id="btn-restore-draft">불러오기</button>
            <button class="btn btn--ghost btn--sm" id="btn-discard-draft">삭제</button>
          </div>
        </div>` : ''}
      <div class="card">
        <div class="card__body--lg" id="form-fields">
          ${renderFormFields()}
        </div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" onclick="navigate('/feed')">취소</button>
            <button class="btn btn--primary" id="btn-submit">올리기</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-back-type').addEventListener('click', () => renderTypeSelect(el));
  document.getElementById('btn-submit').addEventListener('click', handleSubmit);

  document.getElementById('btn-restore-draft')?.addEventListener('click', () => {
    restoreDraft(type);
    document.querySelector('[id="btn-restore-draft"]')?.closest('div[style]')?.remove();
  });
  document.getElementById('btn-discard-draft')?.addEventListener('click', () => {
    localStorage.removeItem(`write-draft-${type}`);
    document.getElementById('btn-restore-draft')?.closest('div[style]')?.remove();
  });

  // 유형별 후처리 초기화
  initFormLogic();
}

function renderFormFields() {
  const type = selectedType.key;

  const commonTitle = `
    <div class="form-group">
      <label class="form-label">제목 <span class="required">*</span></label>
      <input id="f-title" class="form-input" placeholder="제목을 입력하세요" maxlength="100">
    </div>`;

  const commonTags = `
    <div class="form-group">
      <label class="form-label">태그</label>
      <input id="f-tags" class="form-input" placeholder="#태그 (쉼표로 구분)" maxlength="100">
      <div class="form-hint">예: #밸런스, #공감, #일상</div>
    </div>`;

  const imageUploader = (max = 5, required = false) => `
    <div class="form-group">
      <label class="form-label">사진${required ? ' <span class="required">*</span>' : ''}</label>
      <div id="img-uploader"></div>
      <div class="form-hint">최대 ${max}장 · JPG/PNG · 자동 압축</div>
    </div>`;

  switch (type) {
    case 'balance':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">상황 설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 배달 시킬 때마다 항상 고민되는 그 질문이에요. 여러분의 선택은?" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('A', '예: 치킨')}
            ${renderOptionRow('B', '예: 피자')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가 (최대 4개)</button>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'vote':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">질문 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 이번 MT 장소를 정하려고 해요. 어디가 가장 좋을까요?" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('1', '예: 제주도')}
            ${renderOptionRow('2', '예: 강릉')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가</button>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'battle':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">배틀 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 한국 대중음악 역대 최강자를 뽑아봐요!" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">후보 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('1', '예: 아이유 - 좋은 날')}
            ${renderOptionRow('2', '예: BTS - Dynamite')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 후보 추가</button>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'ox':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">문제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 고양이는 하루에 16시간 이상 잔다?" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">정답 <span class="required">*</span></label>
          <div style="display:flex;gap:12px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
              <input type="radio" name="ox-answer" value="O" id="ox-o"> O (맞다)
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
              <input type="radio" name="ox-answer" value="X" id="ox-x"> X (아니다)
            </label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">해설</label>
          <textarea id="f-explanation" class="form-textarea" placeholder="예: 고양이는 포식 동물 본능으로 에너지를 아끼기 위해 많이 잠을 잡니다" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'quiz':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">문제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 대한민국의 국화(國花)는 무엇일까요? 의외로 모르는 분이 많아요!" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">퀴즈 방식 <span class="required">*</span></label>
          <div style="display:flex;gap:12px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
              <input type="radio" name="quiz-mode" value="multiple" id="qm-multi" checked> 객관식
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
              <input type="radio" name="quiz-mode" value="short" id="qm-short"> 주관식
            </label>
          </div>
        </div>
        <div id="quiz-options-area">
          <div class="form-group">
            <label class="form-label">보기 <span class="required">*</span></label>
            <div class="option-inputs" id="option-list">
              ${renderOptionRow('①', '예: 진달래')}
              ${renderOptionRow('②', '예: 무궁화')}
            </div>
            <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 보기 추가</button>
          </div>
          <div class="form-group">
            <label class="form-label">정답 보기 번호 <span class="required">*</span></label>
            <input id="f-answer" class="form-input" type="number" min="1" placeholder="예: 2  (2번이 정답인 경우)">
          </div>
        </div>
        <div id="quiz-short-area" style="display:none">
          <div class="form-group">
            <label class="form-label">정답 <span class="required">*</span></label>
            <input id="f-answer-short" class="form-input" placeholder="예: 무궁화">
            <div class="form-hint">정답은 참여자에게 공개되지 않아요</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">해설</label>
          <textarea id="f-explanation" class="form-textarea" placeholder="예: 대한민국의 국화는 무궁화로, 나라꽃으로 지정되어 있습니다" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'naming':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">상황 설명 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 친구가 보낸 사진인데 뭔가 많이 닮은 게 있는 것 같아요. 딱 맞는 제목 붙여주세요!" rows="3"></textarea>
        </div>
        ${imageUploader(2, true)} ${commonTags}`;

    case 'acrostic':
      return `
        <div class="form-group">
          <label class="form-label">제시어 <span class="required">*</span></label>
          <input id="f-keyword" class="form-input" placeholder="예: 소소킹" maxlength="6">
          <div class="form-hint">최대 6글자 · 입력하면 삼행시 줄이 자동 생성돼요</div>
        </div>
        <div id="acrostic-preview" style="margin-top:12px"></div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 창의력 넘치는 삼행시 한 번 써봐요!" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'cbattle':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">배틀 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 인생에서 하나만 먹어야 한다면? A팀은 짜장면, B팀은 짬뽕을 지지해요!" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">참여 방식 설명</label>
          <input id="f-howto" class="form-input" placeholder="예: 자신의 선택과 이유를 댓글로 올려주세요">
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'laugh':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">웃긴 상황 설명 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 절대로 웃으면 안 되는 상황들만 모아봤어요. 과연 버틸 수 있으실까요?" rows="4"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">웃참 난이도</label>
          <select id="f-difficulty" class="form-select">
            <option value="">선택 안 함</option>
            <option value="easy">😌 쉬움</option>
            <option value="normal">😬 보통</option>
            <option value="hard">😤 어려움</option>
            <option value="extreme">💀 극한</option>
          </select>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'drip':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">드립 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 월요일에 딱 어울리는 드립 한 줄만 날려주세요!" rows="3"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'howto':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">한 줄 요약 <span class="required">*</span></label>
          <input id="f-summary" class="form-input" placeholder="예: 도착 2분 전에 문 앞으로 이동하면 자리 선점 90% 성공!" maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label">본문 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 10년 경력 지하철 통근러가 알려주는 자리 선점 비법을 공유합니다" rows="6" style="min-height:150px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">단계별 순서</label>
          <div id="howto-steps"></div>
          <button class="add-option-btn" id="btn-add-step" style="margin-top:8px" type="button">+ 단계 추가 (최대 10개)</button>
          <div class="form-hint">예: 1단계 — 도착 2분 전 자리에서 일어나 문 앞으로 이동</div>
        </div>
        <div class="form-group">
          <label class="form-label">준비물</label>
          <input id="f-materials" class="form-input" placeholder="예: 교통카드, 스마트폰, 이어폰">
        </div>
        <div class="form-group">
          <label class="form-label">주의할 점</label>
          <textarea id="f-caution" class="form-textarea" placeholder="예: 혼잡 시간대에는 무리하게 이동하지 마세요" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'story':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">경험 내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 바르셀로나 첫날 짐을 분실하고 나서 벌어진 48시간의 이야기..." rows="6" style="min-height:150px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">느낀 점</label>
          <textarea id="f-feeling" class="form-textarea" placeholder="예: 그 경험 덕분에 '혼자서도 뭐든 할 수 있다'는 자신감이 생겼어요" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'fail':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">실패한 내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 자려고 누웠는데 갑자기 배고파서 야식을 시켰는데..." rows="5" style="min-height:130px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">그래서 알게 된 점 <span class="required">*</span></label>
          <textarea id="f-lesson" class="form-textarea" placeholder="예: 자기 전 야식은 소화가 안 돼서 결국 더 힘들어진다는 것을 깨달았어요" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">다시 한다면?</label>
          <textarea id="f-redo" class="form-textarea" placeholder="예: 차라리 일찍 저녁을 먹고, 자기 전에는 따뜻한 물 한 잔만 마시겠습니다" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'concern':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">고민 내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 좋은 회사에서 오퍼를 받았는데 대학원도 합격했어요. 어떻게 하면 좋을까요?" rows="5" style="min-height:130px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 (투표 가능)</label>
          <div class="option-inputs" id="option-list"></div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가</button>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'relay':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">시작 문장 <span class="required">*</span></label>
          <textarea id="f-start" class="form-textarea" placeholder="예: 어느 날 갑자기 내 폰에 모르는 번호로 문자가 왔다. '오늘 저녁은 파스타 어때요?'" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">현재 상황 설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 기억이 없는 번호인데 마치 아는 사이처럼 연락이 오는 미스터리한 상황" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">등장인물</label>
          <input id="f-characters" class="form-input" placeholder="예: 주인공(나), 모르는 번호의 상대방, 친구 B">
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'challenge24':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">상황 설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 24시간 안에 결정해야 하는 그 질문이에요. 여러분의 선택은?" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('A', '예: 치킨')}
            ${renderOptionRow('B', '예: 피자')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가 (최대 4개)</button>
        </div>
        <p style="font-size:12px;color:var(--color-text-muted)">⏰ 이 놀이판은 등록 후 24시간 후 자동으로 종료돼요.</p>
        ${imageUploader(1)} ${commonTags}`;

    case 'tournament':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">토너먼트 설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 최강의 음식을 가려봐요!" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">참가자 1~4 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('1', '참가자 1')}
            ${renderOptionRow('2', '참가자 2')}
            ${renderOptionRow('3', '참가자 3')}
            ${renderOptionRow('4', '참가자 4')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">참가자 5~8 (선택)</label>
          <div class="option-inputs" id="option-list-extra">
            ${renderOptionRow('5', '참가자 5 (선택)')}
            ${renderOptionRow('6', '참가자 6 (선택)')}
            ${renderOptionRow('7', '참가자 7 (선택)')}
            ${renderOptionRow('8', '참가자 8 (선택)')}
          </div>
        </div>
        ${imageUploader(1)} ${commonTags}`;

    case 'random_battle':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">대결 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 월요일에 딱 어울리는 드립 한 줄만 날려주세요!" rows="3"></textarea>
        </div>
        <p style="font-size:12px;color:var(--color-text-muted)">🎰 참여자들이 같은 주제로 드립/답변을 쓰고 좋아요로 우승자를 가려요.</p>
        ${imageUploader(1)} ${commonTags}`;

    case 'word_relay':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">시작 단어 <span class="required">*</span></label>
          <input id="f-start-word" class="form-input" placeholder="예: 사과" maxlength="20">
          <div class="form-hint">참여자들이 이 단어에서 이어받아 끝말잇기를 시작해요</div>
        </div>
        <div class="form-group">
          <label class="form-label">설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="예: 끝말잇기로 어디까지 이어갈 수 있을까요?" rows="2"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;


    default:
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" rows="5"></textarea>
        </div>
        ${imageUploader(1)} ${commonTags}`;
  }
}

function renderOptionRow(label, placeholder = '선택지를 입력하세요') {
  return `
    <div class="option-input-row">
      <div class="option-label">${label}</div>
      <input class="form-input option-value" placeholder="${placeholder}" maxlength="100">
      <button class="option-remove-btn" title="삭제">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`;
}

function initFormLogic() {
  const type = selectedType.key;

  // 이미지 업로더 초기화
  const maxImg = type === 'naming' ? 2 : 1;
  const uploaderEl = document.getElementById('img-uploader');
  if (uploaderEl) initImageUploader(uploaderEl, maxImg);

  // 선택지 추가 버튼
  const btnAdd = document.getElementById('btn-add-option');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const list = document.getElementById('option-list');
      const count = list.querySelectorAll('.option-input-row').length;
      const maxOpts = (type === 'balance') ? 4 : 8;
      if (count >= maxOpts) { toast.warn(`최대 ${maxOpts}개까지 추가할 수 있어요`); return; }
      const labels = ['A','B','C','D','E','F','G','H'];
      list.insertAdjacentHTML('beforeend', renderOptionRow(labels[count] || count+1, `선택지 ${count+1}`));
      attachRemoveBtns(list);
    });
    attachRemoveBtns(document.getElementById('option-list'));
  }

  // 나만의 노하우 단계 관리
  if (type === 'howto') {
    const btnAddStep = document.getElementById('btn-add-step');
    if (btnAddStep) {
      btnAddStep.addEventListener('click', () => {
        const stepsDiv = document.getElementById('howto-steps');
        const count = stepsDiv.querySelectorAll('.howto-step-row').length;
        if (count >= 10) { toast.warn('최대 10단계까지 추가할 수 있어요'); return; }
        stepsDiv.insertAdjacentHTML('beforeend', `
          <div class="howto-step-row">
            <div class="howto-step-num">${count + 1}</div>
            <textarea class="form-textarea howto-step-input" placeholder="${count + 1}단계 내용을 입력하세요" rows="2"></textarea>
            <button class="option-remove-btn howto-step-remove" title="삭제" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>`);
        attachStepRemoveBtns();
      });
    }
  }

  // 삼행시 제시어 → 미리보기
  if (type === 'acrostic') {
    const kwInput = document.getElementById('f-keyword');
    kwInput?.addEventListener('input', () => {
      const kw = kwInput.value.trim();
      const preview = document.getElementById('acrostic-preview');
      if (!kw) { preview.innerHTML = ''; return; }
      preview.innerHTML = `
        <div class="card" style="padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:8px">삼행시 미리보기</div>
          ${[...kw].map(ch => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="width:28px;height:28px;background:var(--color-primary);color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0">${ch}</span>
              <span style="font-size:13px;color:var(--color-text-muted)">:  여기에 한 줄 작성</span>
            </div>`).join('')}
        </div>`;
    });
  }

  // 퀴즈 방식 토글
  if (type === 'quiz') {
    document.querySelectorAll('[name="quiz-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        const isMultiple = document.querySelector('[name="quiz-mode"]:checked')?.value === 'multiple';
        document.getElementById('quiz-options-area').style.display = isMultiple ? '' : 'none';
        document.getElementById('quiz-short-area').style.display   = isMultiple ? 'none' : '';
      });
    });
  }

  initCharCounters();
  initDraftSave(type);
}

function initCharCounters() {
  document.querySelectorAll('.form-textarea').forEach(ta => {
    const maxLen = parseInt(ta.getAttribute('maxlength')) || 0;
    const counter = document.createElement('div');
    counter.className = 'char-counter';
    const update = () => {
      const len = ta.value.length;
      counter.textContent = maxLen ? `${len} / ${maxLen}` : `${len}자`;
      counter.className = 'char-counter' +
        (maxLen && len >= maxLen * 0.85 ? ' near-limit' : '') +
        (maxLen && len >= maxLen        ? ' over-limit'  : '');
    };
    update();
    ta.addEventListener('input', update);
    ta.after(counter);
  });
  document.querySelectorAll('.form-input[maxlength]').forEach(inp => {
    const maxLen = parseInt(inp.getAttribute('maxlength'));
    const counter = document.createElement('div');
    counter.className = 'char-counter';
    const update = () => {
      const len = inp.value.length;
      counter.textContent = `${len} / ${maxLen}`;
      counter.className = 'char-counter' +
        (len >= maxLen * 0.85 ? ' near-limit' : '') +
        (len >= maxLen        ? ' over-limit'  : '');
    };
    update();
    inp.addEventListener('input', update);
    inp.after(counter);
  });
}

function initDraftSave(type) {
  const DRAFT_KEY = `write-draft-${type}`;
  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const data = {};
      document.querySelectorAll('#form-fields input[id], #form-fields textarea[id]').forEach(el => {
        data[el.id] = el.value;
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    }, 1500);
  };
  document.getElementById('form-fields')?.addEventListener('input', scheduleSave);
}

function restoreDraft(type) {
  try {
    const data = JSON.parse(localStorage.getItem(`write-draft-${type}`) || '{}');
    Object.entries(data).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('input'));
      }
    });
    toast.success('임시 초안을 불러왔어요');
  } catch { /* ignore */ }
}

function attachRemoveBtns(list) {
  if (!list) return;
  list.querySelectorAll('.option-remove-btn').forEach(btn => {
    btn.onclick = () => {
      const rows = list.querySelectorAll('.option-input-row');
      if (rows.length <= 2) { toast.warn('최소 2개는 있어야 해요'); return; }
      btn.closest('.option-input-row').remove();
    };
  });
}

function attachStepRemoveBtns() {
  const stepsDiv = document.getElementById('howto-steps');
  if (!stepsDiv) return;
  stepsDiv.querySelectorAll('.howto-step-remove').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.howto-step-row').remove();
      // 번호 재정렬
      stepsDiv.querySelectorAll('.howto-step-num').forEach((num, i) => {
        num.textContent = i + 1;
      });
    };
  });
}

/* ── 제출 ── */
async function handleSubmit() {
  if (!auth.currentUser) { navigate('/login'); return; }

  const btn = document.getElementById('btn-submit');
  const type = selectedType.key;
  const cat  = selectedCat.key;

  let title = document.getElementById('f-title')?.value.trim();
  if (type === 'acrostic') {
    const kw = document.getElementById('f-keyword')?.value.trim();
    title = kw ? `'${kw}' 삼행시 도전!` : '';
  }
  if (!title) { toast.error(type === 'acrostic' ? '제시어를 입력해주세요' : '제목을 입력해주세요'); return; }

  const desc     = document.getElementById('f-desc')?.value.trim()     || '';
  const tagsRaw  = document.getElementById('f-tags')?.value.trim()     || '';
  const tags     = tagsRaw.split(',').map(t => t.replace('#','').trim()).filter(Boolean);

  // 유형별 추가 데이터 수집
  const extra = collectExtraData(type);
  if (extra === null) return; // 유효성 실패

  // 퀴즈 정답은 별도 secret 서브컬렉션에 저장
  const secretFields = extractSecretFields(type, extra);

  const images = await getUploadedImages();

  btn.disabled = true;
  btn.textContent = '올리는 중...';

  try {
    const postData = {
      type, cat,
      title, desc, tags,
      images,
      authorId:   auth.currentUser.uid,
      authorName: auth.currentUser.displayName || '익명',
      authorPhoto:auth.currentUser.photoURL || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
      ...extra,
    };

    if (selectedType.key === 'challenge24') {
      const expires = new Date();
      expires.setDate(expires.getDate() + 1);
      postData.expiresAt = Timestamp.fromDate(expires);
      postData.expired = false;
    }

    const docRef = await addDoc(collection(db, 'feeds'), postData);

    if (Object.keys(secretFields).length > 0) {
      await setDoc(doc(db, 'feeds', docRef.id, 'secret', 'answer'), secretFields);
    }

    localStorage.removeItem(`write-draft-${type}`);
    toast.success('올렸어요! 🎉');
    navigate('/feed');
  } catch (e) {
    console.error(e);
    toast.error('올리기에 실패했어요. 다시 시도해주세요.');
    btn.disabled = false;
    btn.textContent = '올리기';
  }
}

// 메인 문서에서 정답 필드를 제거하고 반환 (secret 서브컬렉션용)
function extractSecretFields(type, extra) {
  if (type === 'ox') {
    const secret = { answer: extra.answer, explanation: extra.explanation || '' };
    delete extra.answer;
    delete extra.explanation;
    return secret;
  }
  if (type === 'quiz') {
    const secret = { quizMode: extra.quizMode, explanation: extra.explanation || '' };
    if (extra.quizMode === 'multiple') {
      secret.answerIdx = extra.answerIdx;
      delete extra.answerIdx;
    } else {
      secret.answer = extra.answer;
      delete extra.answer;
    }
    delete extra.explanation;
    return secret;
  }
  return {};
}

function collectExtraData(type) {
  const getOptions = () =>
    [...document.querySelectorAll('#option-list .option-value')]
      .map(i => i.value.trim()).filter(Boolean);

  switch (type) {
    case 'balance':
    case 'vote':
    case 'battle': {
      const opts = getOptions();
      if (opts.length < 2) { toast.error('선택지를 2개 이상 입력해주세요'); return null; }
      return { options: opts.map(o => ({ text: o, votes: 0 })) };
    }
    case 'ox': {
      const answer = document.querySelector('[name="ox-answer"]:checked')?.value;
      if (!answer) { toast.error('정답을 선택해주세요'); return null; }
      return { answer, explanation: document.getElementById('f-explanation')?.value.trim() || '' };
    }
    case 'quiz': {
      const mode = document.querySelector('[name="quiz-mode"]:checked')?.value || 'multiple';
      if (mode === 'multiple') {
        const opts = getOptions();
        const answerIdx = parseInt(document.getElementById('f-answer')?.value) - 1;
        if (opts.length < 2) { toast.error('보기를 2개 이상 입력해주세요'); return null; }
        if (isNaN(answerIdx) || answerIdx < 0 || answerIdx >= opts.length) { toast.error('올바른 정답 번호를 입력해주세요'); return null; }
        return { quizMode: 'multiple', options: opts, answerIdx, explanation: document.getElementById('f-explanation')?.value.trim() || '' };
      } else {
        const answer = document.getElementById('f-answer-short')?.value.trim();
        if (!answer) { toast.error('정답을 입력해주세요'); return null; }
        return { quizMode: 'short', answer, explanation: document.getElementById('f-explanation')?.value.trim() || '' };
      }
    }
    case 'naming': {
      const imgs = document.querySelectorAll('#img-uploader img');
      if (!imgs.length) { toast.error('사진을 1장 이상 올려주세요'); return null; }
      return {};
    }
    case 'acrostic': {
      const keyword = document.getElementById('f-keyword')?.value.trim();
      if (!keyword) { toast.error('제시어를 입력해주세요'); return null; }
      return { keyword };
    }
    case 'howto': {
      const summary = document.getElementById('f-summary')?.value.trim();
      if (!summary) { toast.error('한 줄 요약을 입력해주세요'); return null; }
      const steps = [...document.querySelectorAll('.howto-step-input')]
        .map(el => el.value.trim()).filter(Boolean);
      return {
        summary, steps,
        materials: document.getElementById('f-materials')?.value.trim() || '',
        caution:   document.getElementById('f-caution')?.value.trim()   || '',
      };
    }
    case 'story':
      return { feeling: document.getElementById('f-feeling')?.value.trim() || '' };
    case 'fail':
      return {
        lesson: document.getElementById('f-lesson')?.value.trim() || '',
        redo:   document.getElementById('f-redo')?.value.trim()   || '',
      };
    case 'concern': {
      const opts = getOptions();
      return opts.length >= 2 ? { options: opts.map(o => ({ text: o, votes: 0 })) } : {};
    }
    case 'relay':
      return {
        startSentence: document.getElementById('f-start')?.value.trim()      || '',
        characters:    document.getElementById('f-characters')?.value.trim() || '',
      };
    case 'cbattle':
      return { howto: document.getElementById('f-howto')?.value.trim() || '' };
    case 'laugh':
      return { difficulty: document.getElementById('f-difficulty')?.value || '' };
    case 'challenge24': {
      const opts = getOptions();
      if (opts.length < 2) { toast.error('선택지를 2개 이상 입력해주세요'); return null; }
      return { options: opts.map(o => ({ text: o, votes: 0 })) };
    }
    case 'tournament': {
      const requiredOpts = [...document.querySelectorAll('#option-list .option-value')]
        .map(i => i.value.trim()).filter(Boolean);
      if (requiredOpts.length < 4) { toast.error('참가자 1~4를 모두 입력해주세요'); return null; }
      const extraOpts = [...document.querySelectorAll('#option-list-extra .option-value')]
        .map(i => i.value.trim()).filter(Boolean);
      return { options: [...requiredOpts, ...extraOpts].map(o => ({ text: o, votes: 0 })) };
    }
    case 'random_battle': {
      if (!document.getElementById('f-desc')?.value.trim()) { toast.error('대결 주제를 입력해주세요'); return null; }
      return {};
    }
    case 'word_relay': {
      const startWord = document.getElementById('f-start-word')?.value.trim();
      if (!startWord) { toast.error('시작 단어를 입력해주세요'); return null; }
      return { startWord };
    }
    default:
      return {};
  }
}
