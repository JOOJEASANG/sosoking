import { db, auth } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { initImageUploader, getUploadedImages } from '../components/image-uploader.js';

/* ── 카테고리/유형 정의 ── */
const CATEGORIES = [
  {
    key: 'golra', label: '골라봐', icon: '🎯', desc: '선택·투표·퀴즈',
    types: [
      { key: 'balance',  icon: '⚖️', label: '밸런스게임',    desc: 'A vs B 둘 중 하나!' },
      { key: 'vote',     icon: '🗳️', label: '민심투표',      desc: '여러 선택지로 투표' },
      { key: 'battle',   icon: '⚔️', label: '선택지배틀',    desc: '후보 중 최강자는?' },
      { key: 'ox',       icon: '❓', label: 'OX퀴즈',        desc: '맞으면 O, 틀리면 X' },
      { key: 'quiz',     icon: '🧠', label: '내맘대로퀴즈',  desc: '객관식 또는 주관식' },
    ],
  },
  {
    key: 'usgyo', label: '웃겨봐', icon: '😂', desc: '드립·삼행시·작명',
    types: [
      { key: 'naming',   icon: '😜', label: '미친작명소',    desc: '사진에 웃긴 제목 붙이기' },
      { key: 'acrostic', icon: '✍️', label: '삼행시짓기',    desc: '제시어로 삼행시 도전' },
      { key: 'cbattle',  icon: '💥', label: '댓글배틀',      desc: '댓글로 겨루는 배틀' },
      { key: 'laugh',    icon: '🙈', label: '웃참챌린지',    desc: '웃겨도 참을 수 있어?' },
      { key: 'drip',     icon: '🎤', label: '한줄드립',      desc: '한 줄로 표현하는 드립' },
    ],
  },
  {
    key: 'malhe', label: '말해봐', icon: '💬', desc: '경험·노하우·고민',
    types: [
      { key: 'howto',    icon: '💡', label: '나만의노하우',  desc: '직접 겪은 꿀팁 공유' },
      { key: 'story',    icon: '📖', label: '경험담',        desc: '내가 겪은 이야기' },
      { key: 'fail',     icon: '💀', label: '실패담',        desc: '실패에서 배운 것들' },
      { key: 'concern',  icon: '🤔', label: '고민/질문',     desc: '함께 고민해요' },
      { key: 'relay',    icon: '🎭', label: '막장릴레이',    desc: '이어쓰는 막장 이야기' },
    ],
  },
];

let selectedCat  = null;
let selectedType = null;

export function renderWrite() {
  const el = document.getElementById('page-content');
  selectedCat  = null;
  selectedType = null;
  renderCatSelect(el);
}

/* ── 1단계: 카테고리 선택 ── */
function renderCatSelect(el) {
  el.innerHTML = `
    <div class="write-page">
      <div class="write-step-header">
        <h1 class="write-step-title">어떤 놀이판 만들까요?</h1>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${CATEGORIES.map(cat => `
          <div class="card card--hover" data-cat="${cat.key}" style="cursor:pointer">
            <div class="card__body" style="display:flex;align-items:center;gap:16px">
              <div style="font-size:36px;flex-shrink:0">${cat.icon}</div>
              <div>
                <div style="font-size:18px;font-weight:800">${cat.label}</div>
                <div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px">${cat.desc}</div>
              </div>
              <div style="margin-left:auto;color:var(--color-text-muted)">›</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  document.querySelectorAll('[data-cat]').forEach(card => {
    card.addEventListener('click', () => {
      selectedCat = CATEGORIES.find(c => c.key === card.dataset.cat);
      renderTypeSelect(el);
    });
  });
}

/* ── 2단계: 유형 선택 ── */
function renderTypeSelect(el) {
  el.innerHTML = `
    <div class="write-page">
      <div class="write-step-header">
        <button class="write-back-btn" id="btn-back-cat">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 class="write-step-title">${selectedCat.icon} ${selectedCat.label}</h1>
      </div>
      <div class="type-select-grid">
        ${selectedCat.types.map(t => `
          <div class="type-select-card" data-type="${t.key}">
            <div class="type-select-card__icon">${t.icon}</div>
            <div class="type-select-card__name">${t.label}</div>
            <div class="type-select-card__desc">${t.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;

  document.getElementById('btn-back-cat').addEventListener('click', () => renderCatSelect(el));
  document.querySelectorAll('[data-type]').forEach(card => {
    card.addEventListener('click', () => {
      selectedType = selectedCat.types.find(t => t.key === card.dataset.type);
      renderForm(el);
    });
  });
}

/* ── 3단계: 작성 폼 ── */
function renderForm(el) {
  el.innerHTML = `
    <div class="write-page">
      <div class="write-step-header">
        <button class="write-back-btn" id="btn-back-type">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 class="write-step-title">${selectedType.icon} ${selectedType.label}</h1>
      </div>
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
          <textarea id="f-desc" class="form-textarea" placeholder="상황을 설명해주세요" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('A', '선택지 A')}
            ${renderOptionRow('B', '선택지 B')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가 (최대 4개)</button>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'vote':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">질문 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="투표 질문을 입력하세요" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('1', '선택지 1')}
            ${renderOptionRow('2', '선택지 2')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가</button>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'battle':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">배틀 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="배틀 주제를 설명하세요" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">후보 <span class="required">*</span></label>
          <div class="option-inputs" id="option-list">
            ${renderOptionRow('1', '후보 1')}
            ${renderOptionRow('2', '후보 2')}
          </div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 후보 추가</button>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'ox':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">문제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="OX 퀴즈 문제를 입력하세요" rows="3"></textarea>
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
          <textarea id="f-explanation" class="form-textarea" placeholder="정답 해설 (선택)" rows="2"></textarea>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'quiz':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">문제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="퀴즈 문제를 입력하세요" rows="3"></textarea>
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
              ${renderOptionRow('①', '보기 1')}
              ${renderOptionRow('②', '보기 2')}
            </div>
            <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 보기 추가</button>
          </div>
          <div class="form-group">
            <label class="form-label">정답 보기 번호 <span class="required">*</span></label>
            <input id="f-answer" class="form-input" type="number" min="1" placeholder="정답 번호 입력 (예: 1)">
          </div>
        </div>
        <div id="quiz-short-area" style="display:none">
          <div class="form-group">
            <label class="form-label">정답 <span class="required">*</span></label>
            <input id="f-answer-short" class="form-input" placeholder="주관식 정답 입력">
            <div class="form-hint">정답은 참여자에게 공개되지 않아요</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">해설</label>
          <textarea id="f-explanation" class="form-textarea" placeholder="정답 해설 (선택)" rows="2"></textarea>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'naming':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">상황 설명 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="사진에 대한 상황 설명을 입력하세요" rows="3"></textarea>
        </div>
        ${imageUploader(3, true)} ${commonTags}`;

    case 'acrostic':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">제시어 <span class="required">*</span></label>
          <input id="f-keyword" class="form-input" placeholder="예: 소소킹" maxlength="6" id="acrostic-keyword">
          <div class="form-hint">최대 6글자 · 입력하면 삼행시 줄이 자동 생성돼요</div>
        </div>
        <div id="acrostic-preview" style="margin-top:12px"></div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="추가 설명 (선택)" rows="2"></textarea>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'cbattle':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">배틀 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="댓글 배틀 주제를 설명하세요" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">참여 방식 설명</label>
          <input id="f-howto" class="form-input" placeholder="예: 각자 자신의 주장을 펼쳐주세요">
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'laugh':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">웃긴 상황 설명 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="웃참 도전 상황을 설명하세요" rows="4"></textarea>
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
        ${imageUploader(3)} ${commonTags}`;

    case 'drip':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">드립 주제 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="한 줄 드립 주제를 입력하세요" rows="3"></textarea>
        </div>
        ${imageUploader(3)} ${commonTags}`;

    case 'howto':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">한 줄 요약 <span class="required">*</span></label>
          <input id="f-summary" class="form-input" placeholder="노하우를 한 줄로 요약해주세요" maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label">본문 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="노하우를 자세히 설명해주세요" rows="6" style="min-height:150px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">단계별 순서</label>
          <div id="howto-steps"></div>
          <button class="add-option-btn" id="btn-add-step" style="margin-top:8px" type="button">+ 단계 추가 (최대 10개)</button>
          <div class="form-hint">각 단계를 순서대로 입력하세요</div>
        </div>
        <div class="form-group">
          <label class="form-label">준비물</label>
          <input id="f-materials" class="form-input" placeholder="예: A, B, C (쉼표로 구분)">
        </div>
        <div class="form-group">
          <label class="form-label">주의할 점</label>
          <textarea id="f-caution" class="form-textarea" placeholder="주의사항이 있다면 적어주세요" rows="2"></textarea>
        </div>
        ${imageUploader(10)} ${commonTags}`;

    case 'story':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">경험 내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="직접 겪은 이야기를 써주세요" rows="6" style="min-height:150px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">느낀 점</label>
          <textarea id="f-feeling" class="form-textarea" placeholder="이 경험에서 느낀 점" rows="2"></textarea>
        </div>
        ${imageUploader(5)} ${commonTags}`;

    case 'fail':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">실패한 내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="어떻게 실패했는지 써주세요" rows="5" style="min-height:130px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">그래서 알게 된 점 <span class="required">*</span></label>
          <textarea id="f-lesson" class="form-textarea" placeholder="실패에서 배운 것을 써주세요" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">다시 한다면?</label>
          <textarea id="f-redo" class="form-textarea" placeholder="다시 한다면 어떻게 할지 (선택)" rows="2"></textarea>
        </div>
        ${imageUploader(5)} ${commonTags}`;

    case 'concern':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">고민 내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" placeholder="고민이나 질문을 자세히 써주세요" rows="5" style="min-height:130px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">선택지 (투표 가능)</label>
          <div class="option-inputs" id="option-list"></div>
          <button class="add-option-btn" id="btn-add-option" style="margin-top:8px">+ 선택지 추가</button>
        </div>
        ${imageUploader(5)} ${commonTags}`;

    case 'relay':
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">시작 문장 <span class="required">*</span></label>
          <textarea id="f-start" class="form-textarea" placeholder="이야기의 첫 문장을 써주세요" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">현재 상황 설명</label>
          <textarea id="f-desc" class="form-textarea" placeholder="지금 상황을 설명해주세요" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">등장인물</label>
          <input id="f-characters" class="form-input" placeholder="예: 철수, 영희, 범인 (쉼표로 구분)">
        </div>
        ${imageUploader(3)} ${commonTags}`;

    default:
      return commonTitle + `
        <div class="form-group">
          <label class="form-label">내용 <span class="required">*</span></label>
          <textarea id="f-desc" class="form-textarea" rows="5"></textarea>
        </div>
        ${imageUploader(5)} ${commonTags}`;
  }
}

function renderOptionRow(label, placeholder) {
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
  const maxImg = type === 'howto' ? 10 : type === 'naming' ? 3 : 5;
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

  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { toast.error('제목을 입력해주세요'); return; }

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
    const docRef = await addDoc(collection(db, 'feeds'), {
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
    });

    if (Object.keys(secretFields).length > 0) {
      await setDoc(doc(db, 'feeds', docRef.id, 'secret', 'answer'), secretFields);
    }

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
    default:
      return {};
  }
}
