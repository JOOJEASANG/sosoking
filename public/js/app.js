import { auth, functions, waitForAuthReady } from './firebase.js';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const appRoot = document.getElementById('app');
const toastRoot = document.getElementById('toast-root');
const createCaseDraft = httpsCallable(functions, 'createCaseDraft');
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const state = {
  user: null,
  authMode: 'signin',
  receipt: null,
};

const categories = [
  ['food', '음식·식탐'],
  ['late', '약속·지각'],
  ['relationship', '연인·관계'],
  ['family', '가족·생활'],
  ['work', '직장·학교'],
  ['digital', '디지털·연락'],
  ['other', '기타 생활분쟁'],
];

const judges = [
  ['드립형', '사건 소재로 짧고 정확하게 비틉니다.'],
  ['과몰입형', '사소한 일을 국가적 위기로 키웁니다.'],
  ['논리집착형', '시간·수량·행동을 집요하게 계산합니다.'],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function routeInfo() {
  const raw = (location.hash || '#/').slice(1);
  const [path = '/', query = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

function displayName(user) {
  return user?.displayName || user?.email?.split('@')[0] || '재판 참여자';
}

function userAvatar(user) {
  if (user?.photoURL) {
    return `<img src="${escapeHtml(user.photoURL)}" alt="${escapeHtml(displayName(user))}">`;
  }
  return `<span class="user-avatar">${escapeHtml(displayName(user).slice(0, 1))}</span>`;
}

function showToast(message, type = 'normal') {
  const item = document.createElement('div');
  item.className = `toast${type === 'error' ? ' error' : ''}`;
  item.textContent = message;
  toastRoot.appendChild(item);
  window.setTimeout(() => item.remove(), 3600);
}

function authErrorMessage(error) {
  const code = String(error?.code || '');
  const messages = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/invalid-email': '이메일 형식을 확인해 주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/weak-password': '비밀번호는 6자 이상 입력해 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/popup-blocked': '팝업이 차단되었습니다. 브라우저 설정을 확인해 주세요.',
    'functions/unauthenticated': '로그인 후 사건을 접수해 주세요.',
    'functions/invalid-argument': error?.message || '입력 내용을 다시 확인해 주세요.',
    'functions/resource-exhausted': '잠시 후 다시 시도해 주세요.',
  };
  return messages[code] || error?.message || '처리 중 오류가 발생했습니다.';
}

function layout(content, activePath) {
  const user = state.user;
  return `
    <div class="site-shell">
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="#/" aria-label="소소킹 홈">
            <span class="brand-seal">소</span>
            <span class="brand-copy"><strong>소소킹 황당재판소</strong><span>SMALL CASE, SERIOUS COURT</span></span>
          </a>
          <nav class="main-nav" aria-label="주요 메뉴">
            <a class="nav-link home-link ${activePath === '/' ? 'active' : ''}" href="#/">홈</a>
            <a class="nav-link ${activePath === '/submit' ? 'active' : ''}" href="#/submit">사건 접수</a>
            ${user ? `
              <span class="user-chip">${userAvatar(user)}<span>${escapeHtml(displayName(user))}</span></span>
              <button class="nav-button" id="logout-button" type="button">로그아웃</button>
            ` : `<a class="nav-link nav-primary" href="#/login">로그인</a>`}
          </nav>
        </div>
      </header>
      <main class="page">${content}</main>
      <footer class="site-footer">
        <div class="container footer-inner">
          <span>소소킹 황당재판소 · 오락형 AI 재판 서비스</span>
          <span>실제 법률 판단이나 상담을 대신하지 않습니다.</span>
        </div>
      </footer>
    </div>`;
}

function homePage() {
  return `
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <div class="eyebrow">일상 억울함 정식 접수</div>
          <h1>사소한 사건도<br><em>재판까지 가야</em> 끝난다</h1>
          <p class="hero-copy">빵 한입, 리모컨 실종, 약속 지각처럼 그냥 넘기기에는 계속 생각나는 사건을 접수하세요. AI 재판부가 사건의 핵심을 찾아 원고와 피고의 공방을 만들고 맞춤형 황당판결을 선고합니다.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="#/submit">내 사건 접수하기</a>
            <a class="button" href="#how-it-works">재판 과정 보기</a>
          </div>
        </div>
        <article class="hero-docket" aria-label="사건 예시">
          <div class="docket-number">사건번호 SOSO-0001</div>
          <h2 class="docket-title">공원 빵 리트리버 무단취식 사건</h2>
          <ul class="docket-facts">
            <li>원고가 한눈판 사이 리트리버가 빵을 먹음</li>
            <li>피고는 꼬리를 흔들었으나 공식 사과는 없었음</li>
            <li>증거물은 이미 소화기관으로 이송된 상태</li>
          </ul>
          <div class="docket-stamp"><span>예상 쟁점</span><strong>공원이라고 모든 빵이 공공빵인가</strong></div>
        </article>
      </div>
    </section>

    <section class="section section-soft" id="how-it-works">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">재판 진행 방식</div>
          <h2>입력은 간단하게,<br>판결은 사건에 딱 맞게</h2>
          <p>사용자가 같은 내용을 여러 번 읽지 않도록 사건 이해, 공방, 판결을 분명히 나눕니다.</p>
        </div>
        <div class="step-grid">
          <article class="card step-card"><span class="step-number">1</span><h3>사건 접수</h3><p>누가 무엇을 했고 왜 억울한지 있는 그대로 작성합니다.</p></article>
          <article class="card step-card"><span class="step-number">2</span><h3>AI 사건 분석</h3><p>행위자·대상·행동·피해와 웃길 수 있는 지점을 먼저 분리합니다.</p></article>
          <article class="card step-card"><span class="step-number">3</span><h3>황당판결 선고</h3><p>원고 주장, 피고의 황당한 변명, 맞춤형 주문과 마지막 한마디를 만듭니다.</p></article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><div class="eyebrow">이번 재구축의 원칙</div><h2>길게 쓰는 AI보다<br>정확히 웃기는 AI</h2></div>
        <div class="feature-grid">
          <article class="card feature-card"><strong>첫 문장부터 사건이 보이게</strong><span>누가 무엇을 해서 어떤 피해가 났는지 먼저 말합니다.</span></article>
          <article class="card feature-card"><strong>소재를 이용한 웃음</strong><span>아무 사건에나 붙는 문구 대신 빵·네비·리모컨 자체를 비틉니다.</span></article>
          <article class="card feature-card"><strong>실제로 맞춤형인 주문</strong><span>사과, 피해 회복, 재발방지를 사건 내용에 맞게 정합니다.</span></article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container cta-panel">
        <div><h2>그냥 넘기기에는 조금 억울한가요?</h2><p>지금 사건을 접수해 두면 다음 단계의 AI 판결 엔진이 이어서 심리합니다.</p></div>
        <a class="button button-primary" href="#/submit">사건 접수 시작</a>
      </div>
    </section>`;
}

function authPage(params) {
  if (state.user) {
    const target = params.get('next') === 'submit' ? '#/submit' : '#/';
    queueMicrotask(() => { location.hash = target; });
    return '';
  }
  const signup = state.authMode === 'signup';
  return `
    <section class="auth-page">
      <div class="container auth-layout">
        <div class="auth-intro">
          <div class="eyebrow">재판 참여자 확인</div>
          <h1>${signup ? '소소킹 재판소에\n참여하세요' : '내 사건을 이어서\n관리하세요'}</h1>
          <p>로그인하면 사건을 안전하게 저장하고, 다음 단계에서 완성되는 판결과 공개 여부를 직접 관리할 수 있습니다.</p>
        </div>
        <div class="card auth-card">
          <div class="auth-tabs">
            <button class="auth-tab ${signup ? '' : 'active'}" type="button" data-auth-mode="signin">로그인</button>
            <button class="auth-tab ${signup ? 'active' : ''}" type="button" data-auth-mode="signup">회원가입</button>
          </div>
          <button class="google-button" id="google-login" type="button">Google 계정으로 계속하기</button>
          <div class="divider">또는 이메일</div>
          <p class="form-error" id="auth-error"></p>
          <form id="auth-form" novalidate>
            <div class="field"><label for="auth-email">이메일</label><input class="input" id="auth-email" name="email" type="email" autocomplete="email" required></div>
            <div class="field"><label for="auth-password">비밀번호</label><input class="input" id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required><span class="field-note">${signup ? '6자 이상 입력해 주세요.' : '가입한 이메일과 비밀번호를 입력해 주세요.'}</span></div>
            <button class="button button-primary button-full" id="auth-submit" type="submit">${signup ? '회원가입' : '로그인'}</button>
          </form>
        </div>
      </div>
    </section>`;
}

function authRequiredPage() {
  return `
    <section class="form-page">
      <div class="container">
        <div class="card receipt-card">
          <div class="receipt-check">!</div>
          <h2>로그인 후 사건을 접수할 수 있습니다</h2>
          <p>작성한 사건과 이후 생성될 판결을 본인 계정에 안전하게 보관하기 위한 절차입니다.</p>
          <a class="button button-primary" href="#/login?next=submit">로그인하고 계속하기</a>
        </div>
      </div>
    </section>`;
}

function receiptPage(receipt) {
  return `
    <section class="form-page">
      <div class="container">
        <div class="card receipt-card">
          <div class="receipt-check">✓</div>
          <h2>사건 접수가 완료되었습니다</h2>
          <p><strong>${escapeHtml(receipt.title)}</strong> 사건을 안전하게 저장했습니다. 다음 단계에서 AI 판결 엔진을 연결하면 이 사건부터 바로 심리할 수 있습니다.</p>
          <span class="receipt-id">CASE ${escapeHtml(receipt.caseId)}</span>
          <div class="hero-actions" style="justify-content:center">
            <button class="button button-primary" id="new-case-button" type="button">새 사건 접수</button>
            <a class="button" href="#/">홈으로</a>
          </div>
        </div>
      </div>
    </section>`;
}

function submitPage() {
  if (!state.user) return authRequiredPage();
  if (state.receipt) return receiptPage(state.receipt);
  return `
    <section class="form-page">
      <div class="container">
        <div class="form-head">
          <div class="eyebrow">사건 접수서</div>
          <h1>무슨 일이 있었는지<br>있는 그대로 적어주세요</h1>
          <p>잘 쓰려고 애쓸 필요 없습니다. 사실관계와 억울한 지점만 분명하면 됩니다.</p>
        </div>
        <form class="card form-card" id="case-form" novalidate>
          <p class="form-error" id="case-error"></p>
          <div class="field"><label for="case-title">사건 제목</label><input class="input" id="case-title" name="title" maxlength="70" placeholder="예: 공원 빵 리트리버 무단취식 사건" required><span class="field-note">4~70자. 누가 무엇을 했는지 드러나면 좋습니다.</span></div>
          <div class="field"><label for="case-description">사건 내용</label><textarea class="textarea" id="case-description" name="description" maxlength="1500" placeholder="어디서, 누가, 무엇을 했고 그 결과 왜 억울했는지 적어주세요." required></textarea><span class="field-note">30~1,500자. AI가 멋대로 추측하지 않도록 실제 있었던 일만 적어주세요.</span></div>
          <div class="field-row two">
            <div class="field"><label for="defendant-name">피고 이름 또는 대상</label><input class="input" id="defendant-name" name="defendantName" maxlength="40" placeholder="예: 남편, 리트리버, 차량 네비게이션"></div>
            <div class="field"><label for="category">사건 분류</label><select class="select" id="category" name="category">${categories.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>
          </div>
          <div class="field"><span class="field-label">담당 판사 성향</span><div class="choice-grid">${judges.map(([name, description], index) => `<div class="choice"><input id="judge-${index}" name="judgeType" type="radio" value="${name}" ${index === 0 ? 'checked' : ''}><label for="judge-${index}"><strong>${name}</strong><br><span class="field-note">${description}</span></label></div>`).join('')}</div></div>
          <div class="field"><label for="grievance">억울함 정도</label><div class="range-wrap"><input class="range" id="grievance" name="grievanceIndex" type="range" min="1" max="10" value="6"><output class="range-value" id="grievance-value">6</output></div></div>
          <div class="field"><label for="desired-verdict">원하는 해결 또는 판결</label><textarea class="textarea" id="desired-verdict" name="desiredVerdict" maxlength="240" style="min-height:100px" placeholder="예: 보호자가 같은 빵을 사주고 리트리버는 정중히 사과했으면 좋겠다."></textarea></div>
          <label class="checkbox-row"><input name="isPublic" type="checkbox"><span>판결 완성 후 공개 사건 게시판에 올릴 수 있도록 공개 상태로 접수합니다. 기본값은 비공개입니다.</span></label>
          <div class="form-actions"><a class="button" href="#/">취소</a><button class="button button-primary" id="case-submit" type="submit">사건 접수하기</button></div>
        </form>
      </div>
    </section>`;
}

function notFoundPage() {
  return `<section class="form-page"><div class="container"><div class="card receipt-card"><div class="receipt-check">?</div><h2>재판 기록을 찾지 못했습니다</h2><p>주소가 올바른지 확인하거나 홈에서 다시 시작해 주세요.</p><a class="button button-primary" href="#/">홈으로</a></div></div></section>`;
}

function setFormError(element, message) {
  element.textContent = message;
  element.classList.toggle('visible', Boolean(message));
}

function redirectAfterLogin() {
  const { params } = routeInfo();
  location.hash = params.get('next') === 'submit' ? '#/submit' : '#/';
}

function bindCommon() {
  document.getElementById('logout-button')?.addEventListener('click', async () => {
    await signOut(auth);
    state.receipt = null;
    showToast('로그아웃했습니다.');
    location.hash = '#/';
  });
}

function bindAuth() {
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.authMode;
      render();
    });
  });

  const errorBox = document.getElementById('auth-error');
  document.getElementById('google-login')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    setFormError(errorBox, '');
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('로그인했습니다.');
      redirectAfterLogin();
    } catch (error) {
      setFormError(errorBox, authErrorMessage(error));
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('auth-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = document.getElementById('auth-submit');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    setFormError(errorBox, '');
    submit.disabled = true;
    try {
      if (state.authMode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const fallbackName = email.split('@')[0].slice(0, 24);
        if (fallbackName) await updateProfile(credential.user, { displayName: fallbackName });
        showToast('회원가입이 완료되었습니다.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('로그인했습니다.');
      }
      redirectAfterLogin();
    } catch (error) {
      setFormError(errorBox, authErrorMessage(error));
    } finally {
      submit.disabled = false;
    }
  });
}

function bindSubmit() {
  document.getElementById('new-case-button')?.addEventListener('click', () => {
    state.receipt = null;
    render();
  });

  const range = document.getElementById('grievance');
  const output = document.getElementById('grievance-value');
  range?.addEventListener('input', () => { output.textContent = range.value; });

  document.getElementById('case-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = document.getElementById('case-submit');
    const errorBox = document.getElementById('case-error');
    const data = new FormData(form);
    const payload = {
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      defendantName: String(data.get('defendantName') || '').trim(),
      category: String(data.get('category') || 'other'),
      judgeType: String(data.get('judgeType') || '드립형'),
      grievanceIndex: Number(data.get('grievanceIndex') || 6),
      desiredVerdict: String(data.get('desiredVerdict') || '').trim(),
      isPublic: data.get('isPublic') === 'on',
    };

    if (payload.title.length < 4) return setFormError(errorBox, '사건 제목을 4자 이상 입력해 주세요.');
    if (payload.description.length < 30) return setFormError(errorBox, '사건 내용을 30자 이상 적어주세요.');

    setFormError(errorBox, '');
    submit.disabled = true;
    submit.textContent = '접수 중...';
    try {
      const response = await createCaseDraft(payload);
      state.receipt = { caseId: response.data.caseId, title: payload.title };
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setFormError(errorBox, authErrorMessage(error));
      submit.disabled = false;
      submit.textContent = '사건 접수하기';
    }
  });
}

function render() {
  const route = routeInfo();
  let content;
  if (route.path === '/') content = homePage();
  else if (route.path === '/login') content = authPage(route.params);
  else if (route.path === '/submit') content = submitPage();
  else content = notFoundPage();

  appRoot.innerHTML = layout(content, route.path);
  bindCommon();
  if (route.path === '/login') bindAuth();
  if (route.path === '/submit') bindSubmit();
}

window.addEventListener('hashchange', () => {
  state.receipt = null;
  render();
  window.scrollTo(0, 0);
});

await waitForAuthReady();
onAuthStateChanged(auth, user => {
  state.user = user;
  render();
});
