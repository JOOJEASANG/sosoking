import { auth, db, functions } from '../firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { toast } from '../components/toast.js';

const awardUserPoints = httpsCallable(functions, 'awardUserPoints');

function cleanText(value, max) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function splitTags(value) {
  return String(value || '')
    .split(/[#,\s]+/)
    .map(v => cleanText(v, 18))
    .filter(Boolean)
    .slice(0, 5);
}

function requireLogin() {
  if (auth.currentUser) return true;
  toast.info?.('로그인 후 시민발언을 작성할 수 있습니다.');
  navigate('/login');
  return false;
}

function ensureWriteStyle() {
  if (document.getElementById('civic-write-style')) return;
  const style = document.createElement('style');
  style.id = 'civic-write-style';
  style.textContent = `
    .civic-write-page{max-width:980px;margin:0 auto;padding:0 0 22px}
    .civic-write-hero{position:relative;overflow:hidden;border-radius:26px;background:linear-gradient(135deg,#111827,#4338ca 58%,#ff6b4a);color:#fff;padding:22px 22px;margin:0 0 14px;box-shadow:0 18px 38px rgba(15,23,42,.18)}
    .civic-write-hero:before{content:"";position:absolute;right:-70px;top:-80px;width:220px;height:220px;border-radius:999px;background:rgba(255,255,255,.12)}
    .civic-write-hero:after{content:"";position:absolute;left:45%;bottom:-120px;width:260px;height:260px;border-radius:999px;background:rgba(255,107,74,.22)}
    .civic-write-hero__inner{position:relative;z-index:1;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
    .civic-write-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62);margin-bottom:6px}
    .civic-write-hero__title{font-size:28px;font-weight:1000;letter-spacing:-.04em;line-height:1.15;margin:0}
    .civic-write-hero__desc{font-size:13px;line-height:1.58;color:rgba(255,255,255,.78);margin:8px 0 0;max-width:620px}
    .civic-write-hero__reward{min-width:128px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.12);border-radius:18px;padding:12px 13px;text-align:center;backdrop-filter:blur(10px)}
    .civic-write-hero__reward span{display:block;font-size:11px;color:rgba(255,255,255,.7);font-weight:900}
    .civic-write-hero__reward b{display:block;font-size:24px;margin-top:2px;color:#fff}
    .civic-write-shell{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px;align-items:start}
    .civic-write-card{border-radius:24px;background:rgba(255,255,255,.94);border:1px solid rgba(100,116,139,.12);box-shadow:0 14px 34px rgba(15,23,42,.08);padding:18px}
    .civic-write-card__head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:15px}
    .civic-write-card__title{font-size:17px;font-weight:1000;color:var(--color-text-primary)}
    .civic-write-card__sub{font-size:12px;color:var(--color-text-secondary);margin-top:3px;line-height:1.45}
    .civic-write-field{display:block;margin-bottom:14px}
    .civic-write-label{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12px;font-weight:1000;color:var(--color-text-primary);margin-bottom:7px}
    .civic-write-count{font-size:10px;color:var(--color-text-secondary);font-weight:900}
    .civic-write-input,.civic-write-textarea{width:100%;border:1px solid rgba(100,116,139,.2);background:rgba(248,250,252,.9);border-radius:16px;padding:13px 14px;font-family:inherit;font-size:14px;color:var(--color-text-primary);outline:none;transition:border-color .18s,box-shadow .18s,background .18s}
    .civic-write-textarea{min-height:220px;resize:vertical;line-height:1.65}
    .civic-write-input:focus,.civic-write-textarea:focus{border-color:rgba(255,107,74,.55);box-shadow:0 0 0 4px rgba(255,107,74,.1);background:#fff}
    .civic-write-template-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 15px}
    .civic-write-template{border:1px solid rgba(100,116,139,.14);background:linear-gradient(180deg,#fff,rgba(248,250,252,.94));border-radius:16px;padding:11px 10px;text-align:left;cursor:pointer;font-family:inherit;transition:transform .16s,box-shadow .16s,border-color .16s}
    .civic-write-template:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(15,23,42,.08);border-color:rgba(255,107,74,.26)}
    .civic-write-template b{display:block;font-size:12px;color:var(--color-text-primary);margin-bottom:3px}
    .civic-write-template span{display:block;font-size:11px;color:var(--color-text-secondary);line-height:1.35}
    .civic-write-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding-top:4px}
    .civic-write-actions__hint{font-size:11px;color:var(--color-text-secondary);line-height:1.4}
    .civic-write-actions__buttons{display:flex;gap:8px;flex-wrap:wrap}
    .civic-write-submit{min-width:150px;box-shadow:0 10px 20px rgba(255,107,74,.2)}
    .civic-write-side{display:grid;gap:12px}
    .civic-write-guide{border-radius:22px;background:#fff;border:1px solid rgba(100,116,139,.12);box-shadow:0 10px 24px rgba(15,23,42,.06);padding:15px}
    .civic-write-guide__title{font-size:13px;font-weight:1000;color:var(--color-text-primary);margin-bottom:8px}
    .civic-write-guide__list{display:grid;gap:7px;margin:0;padding:0;list-style:none}
    .civic-write-guide__list li{font-size:12px;line-height:1.45;color:var(--color-text-secondary);display:flex;gap:7px;align-items:flex-start}
    .civic-write-guide__list b{color:var(--color-text-primary)}
    .civic-write-side-card{border-radius:22px;background:linear-gradient(135deg,rgba(255,107,74,.1),rgba(67,56,202,.08));border:1px solid rgba(255,107,74,.16);padding:15px}
    .civic-write-side-card__title{font-size:13px;font-weight:1000;color:var(--color-text-primary);margin-bottom:6px}
    .civic-write-side-card__desc{font-size:12px;line-height:1.55;color:var(--color-text-secondary)}
    @media(max-width:860px){.civic-write-shell{grid-template-columns:1fr}.civic-write-side{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:560px){.civic-write-page{padding-bottom:78px}.civic-write-hero{border-radius:22px;padding:18px}.civic-write-hero__title{font-size:23px}.civic-write-hero__reward{width:100%;text-align:left}.civic-write-card{border-radius:21px;padding:15px}.civic-write-template-grid{grid-template-columns:1fr}.civic-write-side{grid-template-columns:1fr}.civic-write-actions__buttons,.civic-write-submit{width:100%}.civic-write-actions__buttons .btn{flex:1}.civic-write-submit{min-width:0}.civic-write-textarea{min-height:190px}}
  `;
  document.head.appendChild(style);
}

export async function renderWrite() {
  setMeta('시민발언 작성 - 소소킹 시민광장');
  ensureWriteStyle();
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="civic-write-page">
      <section class="civic-write-hero">
        <div class="civic-write-hero__inner">
          <div>
            <div class="civic-write-hero__eyebrow">CIVIC SPEECH</div>
            <h1 class="civic-write-hero__title">🏛️ 시민발언 작성</h1>
            <p class="civic-write-hero__desc">정당 홍보, 공약 토론, 정치 의견을 시민광장에 남겨보세요. 좋은 시민발언은 여론을 만들고 정치력을 키웁니다.</p>
          </div>
          <div class="civic-write-hero__reward">
            <span>등록 보상</span>
            <b>+20P</b>
          </div>
        </div>
      </section>

      <div class="civic-write-shell">
        <form id="civic-write-form" class="civic-write-card">
          <div class="civic-write-card__head">
            <div>
              <div class="civic-write-card__title">시민광장에 올릴 발언</div>
              <div class="civic-write-card__sub">제목과 내용만 입력하면 바로 공화국 여론 게시판에 공개됩니다.</div>
            </div>
          </div>

          <label class="civic-write-field">
            <span class="civic-write-label">제목 <span class="civic-write-count" id="civic-title-count">0 / 80</span></span>
            <input id="civic-write-title" class="civic-write-input" maxlength="80" placeholder="예: 청년혁명당 공약, 이대로 괜찮나?">
          </label>

          <label class="civic-write-field">
            <span class="civic-write-label">내용 <span class="civic-write-count" id="civic-desc-count">0 / 1800</span></span>
            <textarea id="civic-write-desc" class="civic-write-textarea" maxlength="1800" rows="9" placeholder="정당 홍보, 공약 토론, 정치 의견을 적어주세요. 근거와 제안이 있으면 더 좋은 시민발언이 됩니다."></textarea>
          </label>

          <label class="civic-write-field">
            <span class="civic-write-label">태그 <span class="civic-write-count">최대 5개</span></span>
            <input id="civic-write-tags" class="civic-write-input" maxlength="80" placeholder="정당홍보 공약토론 청년정책">
          </label>

          <div class="civic-write-template-grid" aria-label="작성 예시">
            <button type="button" class="civic-write-template" data-template="party"><b>🎙️ 정당 홍보</b><span>우리 정당이 밀어야 할 의제 제안</span></button>
            <button type="button" class="civic-write-template" data-template="pledge"><b>📜 공약 토론</b><span>대선 공약의 실현 가능성 검토</span></button>
            <button type="button" class="civic-write-template" data-template="opinion"><b>🗣️ 정치 의견</b><span>오늘의 공화국 여론 남기기</span></button>
          </div>

          <div class="civic-write-actions">
            <div class="civic-write-actions__hint">등록 후 시민광장 목록과 상세 화면에 표시됩니다.</div>
            <div class="civic-write-actions__buttons">
              <button type="button" class="btn btn--ghost" id="civic-write-cancel">취소</button>
              <button type="submit" class="btn btn--primary civic-write-submit" id="civic-write-submit">시민발언 등록 +20P</button>
            </div>
          </div>
        </form>

        <aside class="civic-write-side">
          <div class="civic-write-guide">
            <div class="civic-write-guide__title">좋은 시민발언 기준</div>
            <ul class="civic-write-guide__list">
              <li><span>1</span><div><b>주장</b>을 먼저 분명히 적기</div></li>
              <li><span>2</span><div><b>근거</b>나 사례를 짧게 붙이기</div></li>
              <li><span>3</span><div><b>정당·대선·국회</b> 흐름과 연결하기</div></li>
            </ul>
          </div>
          <div class="civic-write-side-card">
            <div class="civic-write-side-card__title">정치력 연결</div>
            <div class="civic-write-side-card__desc">시민발언으로 얻은 정치력은 내 정당 정치력에도 반영됩니다. 정당 1위가 되면 당대표·대선 후보 흐름으로 이어집니다.</div>
          </div>
        </aside>
      </div>
    </div>`;

  bindWriteEvents();
}

function updateCounters() {
  const titleEl = document.getElementById('civic-write-title');
  const descEl = document.getElementById('civic-write-desc');
  const titleCount = document.getElementById('civic-title-count');
  const descCount = document.getElementById('civic-desc-count');
  if (titleCount && titleEl) titleCount.textContent = `${titleEl.value.length} / 80`;
  if (descCount && descEl) descCount.textContent = `${descEl.value.length} / 1800`;
}

function bindWriteEvents() {
  const form = document.getElementById('civic-write-form');
  const titleEl = document.getElementById('civic-write-title');
  const descEl = document.getElementById('civic-write-desc');
  const tagsEl = document.getElementById('civic-write-tags');
  const submitBtn = document.getElementById('civic-write-submit');

  document.getElementById('civic-write-cancel')?.addEventListener('click', () => navigate('/feed'));
  titleEl?.addEventListener('input', updateCounters);
  descEl?.addEventListener('input', updateCounters);

  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.template;
      if (type === 'party') {
        titleEl.value = '우리 정당이 이번 주에 밀어야 할 의제';
        descEl.value = '시민광장에서 우리 정당의 핵심 의제를 제안합니다. 단순 구호보다 실제 시민에게 어떤 변화가 생기는지 중심으로 토론해 봅시다.';
        tagsEl.value = '정당홍보 시민여론';
      } else if (type === 'pledge') {
        titleEl.value = '이 공약은 실현 가능할까?';
        descEl.value = '대선 공약은 인기보다 실행 가능성이 중요합니다. 재원, 우선순위, 시민 체감 효과를 기준으로 함께 따져봤으면 합니다.';
        tagsEl.value = '공약토론 대선';
      } else {
        titleEl.value = '오늘의 공화국 여론';
        descEl.value = '정치배틀, 정당전, 대선 흐름을 보면서 느낀 시민 의견을 남깁니다. 다른 시민들의 반박과 보완 의견도 듣고 싶습니다.';
        tagsEl.value = '정치의견 시민발언';
      }
      updateCounters();
      descEl.focus();
    });
  });

  updateCounters();

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!requireLogin()) return;

    const title = cleanText(titleEl.value, 80);
    const desc = cleanText(descEl.value, 1800);
    const tags = splitTags(tagsEl.value);

    if (title.length < 2) {
      toast.warn?.('제목을 2자 이상 입력해주세요.');
      titleEl.focus();
      return;
    }
    if (desc.length < 10) {
      toast.warn?.('내용을 10자 이상 입력해주세요.');
      descEl.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';

    try {
      const user = auth.currentUser;
      const docRef = await addDoc(collection(db, 'feeds'), {
        type: 'citizen_speech',
        feedType: 'citizen_speech',
        subtype: 'citizen_speech',
        cat: 'multi',
        title,
        desc,
        tags,
        images: [],
        authorId: user.uid,
        authorName: appState.nickname || user.displayName || user.email?.split('@')[0] || '시민',
        partyId: appState.partyId || '',
        isUserCreated: true,
        hidden: false,
        commentCount: 0,
        viewCount: 0,
        reactions: { total: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await awardUserPoints({ action: 'post_create', meta: { postId: docRef.id } });
      } catch (pointError) {
        console.warn('[write] point award failed', pointError);
      }

      toast.success?.('시민발언이 등록됐습니다.');
      navigate(`/detail/${encodeURIComponent(docRef.id)}`);
    } catch (error) {
      console.error('[write] failed', error);
      toast.error?.('시민발언 등록에 실패했습니다. 권한 또는 네트워크 상태를 확인해주세요.');
      submitBtn.disabled = false;
      submitBtn.textContent = '시민발언 등록 +20P';
    }
  });
}
