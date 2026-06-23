/* playground.js — 소소킹 AI 캐릭터 놀이터 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

const CHARACTERS = [
  { id: 'jungding', emoji: '🎒', name: '사춘기 중딩' },
  { id: 'saibi', emoji: '🙏', name: '사이비 교주' },
  { id: 'prophet', emoji: '🔮', name: '예언가' },
  { id: 'joojeob', emoji: '🤩', name: '주접러' },
  { id: 'chamgyeon', emoji: '👀', name: '참견러' },
  { id: 'kkondae', emoji: '👴', name: '꼰대' },
];

const MODES = {
  judge: { icon: '⚖️', label: '판결소', title: '내 억울함, 캐릭터 판사에게 맡기기', desc: '상황을 구체적으로 적고 판사 3명을 골라보세요. 같은 사건도 캐릭터마다 전혀 다른 판결이 나옵니다.' },
  create: { icon: '✨', label: '창작소', title: '평범한 문장을 캐릭터 작품으로', desc: '말투를 완전히 바꾸거나 대상에 찰떡인 이름 5개를 만들어보세요.' },
  consult: { icon: '🫂', label: '상담소', title: '고민을 3인 상담단에게 털어놓기', desc: '뻔한 위로 대신 각자 세계관이 확실한 캐릭터들이 예상 밖의 조언을 건넵니다.' },
  lounge: { icon: '💬', label: '토론방', title: '오늘의 소소한 논쟁에 참여하기', desc: '자료를 읽고 찬성·반대에 투표한 뒤, 내 경험과 의견을 댓글로 나눠보세요.' },
};

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(response => response.data || {});
}

function modeNavigation(activeMode) {
  return Object.entries(MODES).map(([key, mode]) => `<button class="${key === activeMode ? 'active' : ''}" data-mode="${key}">${mode.icon} ${mode.label}</button>`).join('');
}

function characterButtons(selected, multiple) {
  return CHARACTERS.map(character => `<button type="button" class="king-char-option${selected.includes(character.id) ? ' selected' : ''}" data-char-id="${character.id}" data-multiple="${multiple ? 'true' : 'false'}"><span class="king-char-option__emoji">${character.emoji}</span><span class="king-char-option__name">${character.name}</span></button>`).join('');
}

function judgeForm() {
  return `<div class="king-tool-card"><h2>⚖️ 판결 신청서</h2><p class="king-tool-card__desc">누가, 언제, 무엇을 했고 왜 억울한지 적을수록 판결이 구체적으로 나옵니다.</p><div class="king-form"><div class="king-field"><label for="king-main-text">상황 설명</label><textarea id="king-main-text" maxlength="500" placeholder="예: 친구가 약속시간에 한 시간 늦었는데 미안하다는 말도 없이 내가 예민하다고 합니다. 누가 더 잘못했나요?"></textarea></div><div class="king-field"><div class="king-field__label">판사 3명 선택</div><div class="king-char-select" id="king-char-select">${characterButtons(['jungding','prophet','kkondae'], true)}</div></div><div class="king-tool-note">AI 캐릭터의 결과는 재미와 참고를 위한 내용이며 실제 법률·의료·전문 판단을 대신하지 않습니다.</div><button class="king-primary" id="king-submit">판결 시작하기</button></div></div>`;
}

function createForm() {
  return `<div class="king-tool-card"><h2>✨ 캐릭터 창작소</h2><p class="king-tool-card__desc">말투 변환과 작명 중 하나를 고른 뒤 캐릭터를 선택하세요.</p><div class="king-form"><div class="king-field"><label for="king-create-kind">만들기 종류</label><select id="king-create-kind"><option value="translate">캐릭터 말투로 바꾸기</option><option value="name">이름 5개 짓기</option></select></div><div class="king-field"><label for="king-main-text">원문 또는 대상 설명</label><textarea id="king-main-text" maxlength="1200" placeholder="말투를 바꿀 문장이나 이름을 지을 대상의 특징을 적어주세요."></textarea></div><div class="king-field"><div class="king-field__label">캐릭터 1명 선택</div><div class="king-char-select" id="king-char-select">${characterButtons(['joojeob'], false)}</div></div><button class="king-primary" id="king-submit">결과 만들기</button></div></div>`;
}

function consultForm() {
  return `<div class="king-tool-card"><h2>🫂 캐릭터 상담소</h2><p class="king-tool-card__desc">고민을 솔직하고 구체적으로 적고 상담사 3명을 고르세요.</p><div class="king-form"><div class="king-field"><label for="king-main-text">고민 또는 상황</label><textarea id="king-main-text" maxlength="1400" placeholder="예: 직장에서 나만 계속 어려운 일을 맡는데 거절하면 무능력하게 볼까 봐 말하지 못하고 있어요."></textarea></div><div class="king-field"><div class="king-field__label">상담사 3명 선택</div><div class="king-char-select" id="king-char-select">${characterButtons(['jungding','chamgyeon','kkondae'], true)}</div></div><div class="king-tool-note">위기 상황이나 전문 상담이 필요한 문제는 관련 기관과 전문가의 도움을 우선 이용하세요.</div><button class="king-primary" id="king-submit">상담 시작하기</button></div></div>`;
}

function loungeForm(materials) {
  const cards = materials.length ? materials.map(material => `<button class="king-material-card" data-material-id="${escHtml(material.id)}"><div class="king-material-card__meta"><span>${escHtml(material.category || '생활논쟁')}</span><span>찬성 ${Number(material.agreeCount || 0)}</span><span>반대 ${Number(material.disagreeCount || 0)}</span></div><h3>${escHtml(material.title || '오늘의 논쟁')}</h3><p>${escHtml(material.summary || '')}</p></button>`).join('') : '<div class="king-empty">오늘의 논쟁을 준비하고 있습니다.</div>';
  return `<div class="king-tool-card"><h2>💬 오늘의 토론 주제</h2><p class="king-tool-card__desc">관심 있는 주제를 눌러 자료를 읽고 투표와 댓글에 참여하세요.</p><div class="king-material-grid" style="margin-top:16px">${cards}</div><div class="king-inline-actions"><button class="king-secondary" data-go="/materials">자료실 전체보기</button><button class="king-primary" data-go="/debates">토론 많은 순서</button></div></div>`;
}

function toolForm(mode, materials) {
  if (mode === 'create') return createForm();
  if (mode === 'consult') return consultForm();
  if (mode === 'lounge') return loungeForm(materials);
  return judgeForm();
}

function sidePanel() {
  return `<aside class="king-side-card"><h3>다른 공간 둘러보기</h3><p>결과를 만든 뒤 오늘의 논쟁과 자료실에도 참여해보세요.</p><div class="king-side-list"><button data-go="/today"><span>🔥</span><span><strong>오늘의 논쟁</strong><small>매일 바뀌는 찬반 주제</small></span></button><button data-go="/materials"><span>📚</span><span><strong>소소자료실</strong><small>생활분쟁과 소비자 이슈</small></span></button><button data-go="/debates"><span>🏆</span><span><strong>토론 많은 글</strong><small>사람들이 많이 말한 주제</small></span></button><button data-go="/account"><span>👤</span><span><strong>내 정보</strong><small>닉네임과 이용 상태 확인</small></span></button></div></aside>`;
}

function selectedCharacterIds(container) {
  return [...container.querySelectorAll('.king-char-option.selected')].map(button => button.dataset.charId);
}

function bindCharacterSelection(root) {
  const container = root.querySelector('#king-char-select');
  if (!container) return;
  container.querySelectorAll('.king-char-option').forEach(button => button.addEventListener('click', () => {
    const multiple = button.dataset.multiple === 'true';
    if (!multiple) {
      container.querySelectorAll('.king-char-option').forEach(item => item.classList.remove('selected'));
      button.classList.add('selected');
      return;
    }
    const selected = selectedCharacterIds(container);
    if (button.classList.contains('selected')) {
      if (selected.length <= 1) return;
      button.classList.remove('selected');
      return;
    }
    if (selected.length >= 3) {
      toast.info('캐릭터는 최대 3명까지 선택할 수 있어요.');
      return;
    }
    button.classList.add('selected');
  }));
}

function showResult(root, title, cards) {
  root.querySelector('#king-result')?.remove();
  const panel = document.createElement('section');
  panel.id = 'king-result';
  panel.className = 'king-result-panel';
  panel.innerHTML = `<h2>${escHtml(title)}</h2><div class="king-result-grid">${cards.join('')}</div>`;
  root.querySelector('.king-tool-layout')?.insertAdjacentElement('afterend', panel);
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resultCard(name, text) {
  return `<div class="king-result-card"><div class="king-result-card__name">${escHtml(name)}</div><div class="king-result-card__text">${escHtml(text)}</div></div>`;
}

async function handleSubmit(root, mode) {
  if (!auth.currentUser) {
    toast.info('로그인 후 AI 놀이터를 이용할 수 있어요.');
    navigate('/login');
    return;
  }

  const text = String(root.querySelector('#king-main-text')?.value || '').trim();
  const charContainer = root.querySelector('#king-char-select');
  const characterIds = charContainer ? selectedCharacterIds(charContainer) : [];
  const submit = root.querySelector('#king-submit');
  const original = submit?.textContent || '결과 만들기';

  if (text.length < (mode === 'create' ? 2 : 5)) {
    toast.info(mode === 'create' ? '내용을 2자 이상 입력해주세요.' : '상황을 5자 이상 입력해주세요.');
    return;
  }

  if (submit) { submit.disabled = true; submit.textContent = '캐릭터들이 생각하는 중…'; }
  try {
    if (mode === 'judge') {
      const data = await call('aiJudge', { situation: text, characterIds });
      const cards = (data.verdicts || []).map(item => resultCard(item.charName || '캐릭터 판사', item.verdict || ''));
      showResult(root, '판결 결과', cards);
    } else if (mode === 'consult') {
      const data = await call('aiConsultV2', { concern: text, characterIds });
      const cards = (data.advices || []).map(item => resultCard(item.charName || '캐릭터 상담사', item.advice || ''));
      showResult(root, '상담 결과', cards);
    } else if (mode === 'create') {
      const kind = root.querySelector('#king-create-kind')?.value || 'translate';
      const characterId = characterIds[0] || 'joojeob';
      if (kind === 'name') {
        const data = await call('aiNameV2', { subject: text, characterId });
        const cards = (data.names || []).map((item, index) => resultCard(`${index + 1}. ${item.name}`, item.reason || ''));
        showResult(root, `${data.characterName || '캐릭터'}의 작명 결과`, cards);
      } else {
        const data = await call('aiTranslateV2', { text, characterId });
        showResult(root, `${data.characterName || '캐릭터'} 말투 변환`, [resultCard('변환된 문장', data.result || '')]);
      }
    }
    toast.success('결과가 완성됐어요.');
  } catch (error) {
    console.error('[king playground]', error);
    toast.error(error?.message || 'AI 결과를 만들지 못했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = original; }
  }
}

export async function renderPlayground(mode = 'judge') {
  const activeMode = MODES[mode] ? mode : 'judge';
  const config = MODES[activeMode];
  setMeta(`${config.label} | 소소킹 AI 놀이터`, config.desc);

  const root = document.getElementById('page-content');
  if (!root) return;
  root.innerHTML = '<div class="king-playground"><div class="skeleton" style="height:260px;border-radius:30px"></div></div>';

  let materials = [];
  if (activeMode === 'lounge') {
    try {
      const data = await call('getTodayMaterials');
      materials = Array.isArray(data.materials) ? data.materials : [];
    } catch (error) {
      console.warn('[playground materials]', error);
    }
  }

  root.innerHTML = `<div class="king-playground page-enter"><section class="king-playground__hero"><div><div class="king-kicker">${config.icon} ${config.label}</div><h1>${config.title}</h1><p>${config.desc}</p></div><button class="king-secondary" data-go="/">홈으로</button></section><nav class="king-mode-nav" aria-label="AI 놀이터 메뉴">${modeNavigation(activeMode)}</nav><div class="king-tool-layout">${toolForm(activeMode, materials)}${sidePanel()}</div></div>`;

  root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => navigate(`/playground/${button.dataset.mode}`)));
  root.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  root.querySelectorAll('[data-material-id]').forEach(button => button.addEventListener('click', () => navigate(`/material/${button.dataset.materialId}`)));
  bindCharacterSelection(root);
  root.querySelector('#king-submit')?.addEventListener('click', () => handleSubmit(root, activeMode));
}
