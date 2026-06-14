import { auth, db, functions } from '../firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
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

export async function renderWrite() {
  setMeta('시민발언 작성 - 소소킹 시민광장');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="write-page" style="max-width:720px;margin:0 auto">
      <div class="card" style="padding:18px;border-radius:22px">
        <div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:1000;color:var(--color-primary);letter-spacing:.08em">CIVIC SPEECH</div>
          <h1 style="font-size:24px;margin:4px 0 6px;color:var(--color-text-primary)">🏛️ 시민발언 작성</h1>
          <p style="margin:0;color:var(--color-text-secondary);font-size:13px;line-height:1.55">정당 홍보, 공약 토론, 정치 의견을 시민광장에 남겨보세요. 작성 후 시민광장에 공개됩니다.</p>
        </div>

        <form id="civic-write-form" class="civic-write-form">
          <label style="display:block;margin-bottom:12px">
            <span style="display:block;font-size:12px;font-weight:900;margin-bottom:6px;color:var(--color-text-primary)">제목</span>
            <input id="civic-write-title" class="input" maxlength="80" placeholder="예: 청년혁명당 공약, 이대로 괜찮나?" style="width:100%">
          </label>

          <label style="display:block;margin-bottom:12px">
            <span style="display:block;font-size:12px;font-weight:900;margin-bottom:6px;color:var(--color-text-primary)">내용</span>
            <textarea id="civic-write-desc" class="input" maxlength="1800" rows="9" placeholder="시민광장에 올릴 정치 의견, 정당 홍보, 공약 토론 내용을 적어주세요." style="width:100%;resize:vertical;line-height:1.55"></textarea>
          </label>

          <label style="display:block;margin-bottom:14px">
            <span style="display:block;font-size:12px;font-weight:900;margin-bottom:6px;color:var(--color-text-primary)">태그 선택 입력</span>
            <input id="civic-write-tags" class="input" maxlength="80" placeholder="정당홍보 공약토론 청년정책" style="width:100%">
          </label>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            <button type="button" class="btn btn--ghost btn--sm" data-template="party">정당 홍보 예시</button>
            <button type="button" class="btn btn--ghost btn--sm" data-template="pledge">공약 토론 예시</button>
            <button type="button" class="btn btn--ghost btn--sm" data-template="opinion">정치 의견 예시</button>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
            <button type="button" class="btn btn--ghost" id="civic-write-cancel">취소</button>
            <button type="submit" class="btn btn--primary" id="civic-write-submit">시민발언 등록 +20P</button>
          </div>
        </form>
      </div>
    </div>`;

  bindWriteEvents();
}

function bindWriteEvents() {
  const form = document.getElementById('civic-write-form');
  const titleEl = document.getElementById('civic-write-title');
  const descEl = document.getElementById('civic-write-desc');
  const tagsEl = document.getElementById('civic-write-tags');
  const submitBtn = document.getElementById('civic-write-submit');

  document.getElementById('civic-write-cancel')?.addEventListener('click', () => navigate('/feed'));

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
      descEl.focus();
    });
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!requireLogin()) return;

    const title = cleanText(titleEl.value, 80);
    const desc = cleanText(descEl.value, 1800);
    const tags = splitTags(tagsEl.value);

    if (title.length < 2) {
      toast.warning?.('제목을 2자 이상 입력해주세요.');
      titleEl.focus();
      return;
    }
    if (desc.length < 10) {
      toast.warning?.('내용을 10자 이상 입력해주세요.');
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
