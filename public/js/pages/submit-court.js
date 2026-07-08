import { functions } from '../firebase.js?v=20260630-3';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260708-title3';

const MAX_TITLE = 40;
const FOOD_WORDS = ['빵','푸딩','과자','커피','치킨','라면','음료','케이크','간식','도시락','아이스크림','샌드위치','김밥','초콜릿','떡볶이','피자','햄버거','사탕','젤리','쿠키'];
const ANIMAL_WORDS = ['리트리버','강아지','개','고양이','반려견','댕댕이','멍멍이','비둘기','새','까치'];
const PERSON_WORDS = ['친구','동생','언니','오빠','형','누나','엄마','아빠','남편','아내','직장동료','상사','후배','선배','손님','아이','누군가'];

function hasFinalConsonant(word) {
  const ch = String(word || '').trim().replace(/[\s"'“”‘’.,!?]+$/g, '').slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return ((code - 0xac00) % 28) !== 0;
}
function subjectParticle(word) { return hasFinalConsonant(word) ? '이' : '가'; }
function objectParticle(word) { return hasFinalConsonant(word) ? '을' : '를'; }
function compact(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .replace(/^(그|저|이)\s+/g, '')
    .replace(/\s*(한\s*마리|한마리)$/g, '')
    .trim();
}
function clipTitle(title) {
  const clean = compact(title).replace(/사건 사건$/g, '사건');
  return clean.length > MAX_TITLE ? clean.slice(0, MAX_TITLE - 1).trim() + '…' : clean;
}
function extractLocation(text) {
  const matches = [...String(text || '').matchAll(/([가-힣A-Za-z0-9]{1,12}(?:에서|에))\s/g)].map(m => m[1]);
  const bad = ['사이에','사이','중에','중에서','때에'];
  return matches.find(x => !bad.some(b => x.includes(b))) || '';
}
function extractObject(text) {
  const source = String(text || '');
  const food = FOOD_WORDS.join('|');
  const pattern = new RegExp(`((?:내|제|제가|내가|남겨둔|마지막|아껴둔|사둔|먹던|보관하던)?\\s*(?:[가-힣A-Za-z0-9]+\\s*){0,2}(?:${food}))\\s*(?:을|를|이|가)?\\s*(?:먹|가져|물고|사라|없어|훔쳐|집어)`, 'gi');
  const matches = [...source.matchAll(pattern)].map(m => compact(m[1])).filter(Boolean);
  const owned = matches.findLast(x => /^(내|제|제가|내가|남겨둔|마지막|아껴둔|사둔|먹던|보관하던)/.test(x));
  if (owned) return owned;
  if (matches.length) return matches[matches.length - 1].replace(/^(공원에서|집에서|회사에서|학교에서|카페에서)\s+/, '');

  const generic = [...source.matchAll(/([가-힣A-Za-z0-9\s]{1,16})\s*(?:을|를)\s*(?:먹|가져|물고|사라|없어|훔쳐|집어)/g)]
    .map(m => compact(m[1]))
    .filter(Boolean);
  return generic.length ? generic[generic.length - 1] : '';
}
function extractActor(text) {
  const source = String(text || '').replace(/산책\s*중이던/g, '산책중이던').replace(/한\s*마리/g, '한마리');
  const animal = ANIMAL_WORDS.join('|');
  const contextualAnimal = new RegExp(`((?:산책중이던|지나가던|옆에 있던|근처에 있던)\\s*(?:${animal}))(?:\\s*한마리)?`, 'i');
  const ca = source.match(contextualAnimal);
  if (ca?.[1]) return compact(ca[1]);

  const plainAnimal = new RegExp(`(${animal})(?:\\s*한마리)?`, 'i');
  const pa = source.match(plainAnimal);
  if (pa?.[1]) return compact(pa[1]);

  const person = PERSON_WORDS.join('|');
  const pp = source.match(new RegExp(`(${person})\\s*(?:이|가|은|는)?`, 'i'));
  return pp?.[1] ? compact(pp[1]) : '';
}
function smartTitle(desc) {
  const text = String(desc || '').replace(/한눈판사이/g, '한눈 판 사이').replace(/산책\s*중이던/g, '산책중이던').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const location = extractLocation(text);
  const actor = extractActor(text);
  const object = extractObject(text);

  if (object && actor && /먹|물고/.test(text)) return clipTitle(`${location ? location + ' ' : ''}${actor}${subjectParticle(actor)} ${object}${objectParticle(object)} 먹은 사건`);
  if (object && /먹/.test(text)) return clipTitle(`${location ? location + ' ' : ''}${object}${objectParticle(object)} 누군가 먹은 사건`);
  if (object && /가져|집어|훔쳐|물고/.test(text)) return clipTitle(`${location ? location + ' ' : ''}${actor ? actor + subjectParticle(actor) + ' ' : ''}${object}${objectParticle(object)} 가져간 사건`);
  if (object && /사라|없어/.test(text)) return clipTitle(`${location ? location + ' ' : ''}${object}${subjectParticle(object)} 사라진 사건`);

  const cleaned = text
    .replace(/^(제가|내가|나는|저는|나|저)\s*/g, '')
    .replace(/(하고 있었는데|하고 있었는 데|했는데|하던 중|한눈판사이|한눈 판 사이|잠깐 사이|사이에)/g, ' ')
    .replace(/[.!?。！？].*$/g, '')
    .trim();
  return clipTitle(`${cleaned.slice(0, 28).trim() || '소소한 일상'} 사건`);
}

function ensureSimpleSubmitStyle() {
  if (document.getElementById('simple-submit-style')) return;
  const style = document.createElement('style');
  style.id = 'simple-submit-style';
  style.textContent = `
    #submit-form details.card summary::-webkit-details-marker{display:none;}
    #submit-form details.card summary::after{content:'＋';float:right;color:var(--cream-dim);font-weight:900;}
    #submit-form details.card[open] summary::after{content:'－';}
    #submit-form .judge-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
    #submit-form .judge-option{min-height:96px;padding:12px 10px;border-radius:16px;}
    #submit-form .judge-option-icon{font-size:24px;line-height:1;margin-bottom:6px;display:inline-flex;}
    #submit-form .judge-option-name{font-size:13px;font-weight:900;line-height:1.3;}
    #submit-form .judge-option-desc{font-size:10.5px;line-height:1.45;margin-top:4px;}
    .simple-submit-note{margin:0 0 16px;padding:12px 14px;border:1px solid rgba(201,168,76,.28);border-radius:14px;background:rgba(201,168,76,.07);font-size:12px;color:var(--cream-dim);line-height:1.7;}
    .simple-submit-note strong{color:var(--gold);}
    .auto-title-note{font-size:11px;color:var(--cream-dim);line-height:1.6;margin-top:6px;}
    .auto-title-note.is-thinking{color:var(--gold);}
    @media(max-width:420px){#submit-form .judge-grid{grid-template-columns:1fr 1fr;gap:8px;}#submit-form .judge-option{padding:10px 8px;min-height:92px;}}
  `;
  document.head.appendChild(style);
}

function bindSmartAutoTitle(container) {
  const desc = container.querySelector('#case-desc');
  const title = container.querySelector('#case-title');
  const count = container.querySelector('#title-count');
  if (!desc || !title || title.dataset.smartTitleBound === '1') return;
  title.dataset.smartTitleBound = '1';
  title.placeholder = '예: 공원에서 리트리버가 내 빵을 먹은 사건';
  desc.placeholder = '예: 공원에서 빵을 먹고 있었는데 한눈판 사이 산책중이던 리트리버가 내 빵을 먹었어요.';

  let userEdited = title.value.trim().length > 0;
  let aiTimer = null;
  let aiSeq = 0;
  title.insertAdjacentHTML('afterend', '<div id="auto-title-note" class="auto-title-note">사건 내용을 쓰면 AI가 사건명을 분석해 자동 입력합니다. 직접 고친 제목은 그대로 저장됩니다.</div>');
  const note = container.querySelector('#auto-title-note');

  function setGeneratedTitle(next, source = 'rule') {
    if (!next || userEdited) return;
    title.value = next;
    title.dataset.autoGeneratedTitle = '1';
    title.dataset.userEditedTitle = '';
    title.dataset.titleSource = source;
    if (count) count.textContent = String(next.length);
  }
  function setNote(text, thinking = false) {
    if (!note) return;
    note.textContent = text;
    note.classList.toggle('is-thinking', thinking);
  }
  async function requestAiTitle(sourceText, seq) {
    try {
      setNote('AI가 사건 내용을 읽고 사건명을 요약 중입니다...', true);
      const res = await httpsCallable(functions, 'suggestCaseTitle')({ caseDescription: sourceText });
      if (seq !== aiSeq || userEdited) return;
      const aiTitle = String(res.data?.caseTitle || '').trim();
      if (aiTitle) {
        setGeneratedTitle(aiTitle, res.data?.fallback ? 'fallback' : 'ai');
        setNote(res.data?.fallback ? 'AI 제목 생성이 지연되어 임시 사건명을 넣었습니다. 직접 수정할 수 있습니다.' : 'AI가 사건 내용을 요약해 사건명을 만들었습니다. 마음에 안 들면 직접 수정하세요.');
      }
    } catch (err) {
      if (seq !== aiSeq || userEdited) return;
      console.warn('AI title preview failed:', err.message || err);
      setNote('AI 사건명 분석을 불러오지 못했습니다. 접수 시 서버에서 한 번 더 자동 생성됩니다.');
    }
  }

  title.addEventListener('input', () => {
    userEdited = title.value.trim().length > 0;
    if (userEdited) {
      title.dataset.autoGeneratedTitle = '';
      title.dataset.userEditedTitle = '1';
      setNote('접수자가 직접 수정한 사건명입니다. 이 제목이 최우선으로 저장됩니다.');
    } else {
      title.dataset.userEditedTitle = '';
      title.dataset.autoGeneratedTitle = '';
      setNote('사건 내용을 쓰면 AI가 사건명을 분석해 자동 입력합니다.');
    }
  });
  desc.addEventListener('input', () => {
    if (userEdited) return;
    const text = desc.value.trim();
    const next = smartTitle(text);
    setGeneratedTitle(next, 'rule');
    clearTimeout(aiTimer);
    aiSeq += 1;
    if (text.length < 10) {
      setNote('사건 내용을 10자 이상 쓰면 AI가 사건명을 분석합니다.');
      return;
    }
    const seq = aiSeq;
    setNote('입력을 멈추면 AI가 사건명을 분석합니다.');
    aiTimer = setTimeout(() => requestAiTitle(text, seq), 1200);
  });
}

function decorateSubmit(container) {
  ensureSimpleSubmitStyle();
  const form = container.querySelector('#submit-form');
  const topCard = container.querySelector('.container > .card');
  if (topCard) topCard.classList.add('court-shell');
  if (form && !document.getElementById('simple-submit-note')) {
    form.insertAdjacentHTML('afterbegin', `
      <div id="simple-submit-note" class="simple-submit-note">
        <strong>간단 접수 방식</strong> · 사건을 길게 쓸 필요 없습니다. 한두 문장만 적으면 사건번호, 담당 조사관, 증거 아닌 증거, 황당 처분은 재판부가 알아서 크게 키웁니다.
      </div>`);
  }
  bindSmartAutoTitle(container);
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
}
