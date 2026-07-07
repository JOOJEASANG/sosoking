import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';
import { escapeHtml, escapeAttr, compactText } from '../js/utils/sanitize.js?v=20260630-3';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let booted = false;
let editId = '';

const FUN_SAMPLE = {
  title: '라면 한 입 청구 후 반 냄비를 집행한 사건',
  category: '음식',
  summary: '피고가 “한 입만”이라는 평화로운 문장으로 접근한 뒤, 젓가락을 퇴근시키지 않고 면발 반을 증발시킨 생활형 국물침투 사건.',
  caseDescription: '원고는 야심한 시간 라면 1봉을 조리하여 평온한 야식권을 행사하고 있었다. 피고는 “한 입만”이라고 말하며 젓가락 1회 사용권을 요청했으나, 실제로는 면발 다회 집행 및 국물 상당량 흡입을 진행하였다. 원고는 냄비 바닥을 확인한 순간 본 사건을 그냥 넘길 수 없다고 판단하였다.',
  plaintiffClaim: '한 입이라더니 젓가락이 퇴근을 안 했습니다.',
  defendantExcuse: '면이 먼저 저를 따라왔고, 국물은 현장 보존 차원에서 확인했습니다.',
  desiredVerdict: '라면 1봉 재구매, 계란 1개 추가, “한 입” 표현 3일 사용금지'
};

function keyOf(v) { return String(v || '').trim().toLowerCase(); }
function slug(v) {
  const base = String(v || 'case').trim().toLowerCase()
    .replace(/[^가-힣a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return `${base || 'case'}-${Date.now().toString(36)}`;
}
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return alert(msg);
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 2800);
}
async function isAdminUser(user) {
  if (!user) return false;
  try {
    const byUid = await getDoc(doc(db, 'admins', user.uid));
    if (byUid.exists()) return true;
    const email = keyOf(user.email);
    if (!email) return false;
    const byEmail = await getDoc(doc(db, 'admins', email));
    return byEmail.exists();
  } catch {
    return false;
  }
}
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
function bool(id) { return !!document.getElementById(id)?.checked; }
function numVal(id, fallback = 0) {
  const n = Number(document.getElementById(id)?.value || fallback);
  return Number.isFinite(n) ? n : fallback;
}
function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function addAdminTab() {
  const nav = document.querySelector('.admin-nav');
  if (!nav || document.getElementById('absurd-cases-admin-tab')) return;
  const btn = document.createElement('button');
  btn.id = 'absurd-cases-admin-tab';
  btn.className = 'admin-tab';
  btn.textContent = '황당사례';
  btn.onclick = () => {
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    renderAbsurdCaseAdmin();
  };
  nav.appendChild(btn);
}

async function renderAbsurdCaseAdmin() {
  const el = document.getElementById('tab-content');
  if (!el) return;
  el.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';
  const snap = await getDocs(query(collection(db, 'absurd_cases'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] }));
  const rows = snap.docs.map(d => {
    const c = d.data();
    return `<tr>
      <td><b>${escapeHtml(c.title || '-')}</b><div style="font-size:10px;color:var(--cream-dim);">${escapeHtml(d.id)} · ${escapeHtml(c.category || '기타')}</div></td>
      <td>${escapeHtml(compactText(c.summary || c.caseDescription || '', 94))}</td>
      <td>${c.isPublic === false ? '비공개' : '공개'}</td>
      <td><div class="admin-actions"><button class="admin-btn gold" onclick="window._editAbsurdCase('${escapeAttr(d.id)}')">수정</button><button class="admin-btn" onclick="window._toggleAbsurdCase('${escapeAttr(d.id)}', ${c.isPublic === false ? 'true' : 'false'})">${c.isPublic === false ? '공개' : '비공개'}</button><button class="admin-btn red" onclick="window._deleteAbsurdCase('${escapeAttr(d.id)}')">삭제</button></div></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:14px;border-color:rgba(201,168,76,.45);">
      <strong style="color:var(--gold);">등록 위치</strong>: 관리자 페이지 → <strong>황당사례</strong> 탭<br>
      공개 사례는 <code>/#/absurd-cases</code>에 표시됩니다. 핵심은 <strong style="color:var(--cream);">뉴스 요약이 아니라 “생활법정 개그”</strong>입니다.<br>
      제목은 과장되게, 원고는 억울하게, 피고는 말도 안 되게 쓰면 더 웃깁니다.
    </div>
    <form id="absurd-case-form" class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;">
        <div><div style="font-weight:900;color:var(--gold);">황당사례 등록</div><div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">소소한 일을 재판장까지 끌고 온다는 느낌으로 작성</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;"><button type="button" id="absurd-sample" class="admin-btn gold">드립 예시 넣기</button><button type="button" id="absurd-case-reset" class="admin-btn">새로 작성</button></div>
      </div>
      <input type="hidden" id="absurd-edit-id" value="">
      <div class="form-group"><label class="form-label">사건명</label><input id="absurd-title" class="form-input" maxlength="60" placeholder="예: 라면 한 입 청구 후 반 냄비를 집행한 사건" required></div>
      <div class="form-group"><label class="form-label">사건 분류</label><input id="absurd-category" class="form-input" maxlength="20" placeholder="예: 음식, 카톡·SNS, 가족, 직장" value="기타"></div>
      <div class="form-group"><label class="form-label">검찰 측 황당 요약</label><textarea id="absurd-summary" class="form-textarea" style="min-height:86px;" maxlength="260" placeholder="짧지만 웃기게. 핵심 드립이 첫 문장에 나오면 좋습니다." required></textarea></div>
      <div class="form-group"><label class="form-label">사건 발생 경위</label><textarea id="absurd-desc" class="form-textarea" style="min-height:120px;" maxlength="520" placeholder="접수 화면에 들어갈 내용입니다. 누가, 언제, 어떻게 소소한 평화를 박살냈는지 적어주세요."></textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group"><label class="form-label">원고의 억울한 절규</label><input id="absurd-plaintiff" class="form-input" maxlength="140" placeholder="예: 한 입이라더니 젓가락이 퇴근을 안 했습니다."></div>
        <div class="form-group"><label class="form-label">피고의 말도 안 되는 항변</label><input id="absurd-defendant" class="form-input" maxlength="140" placeholder="예: 면이 먼저 저를 따라왔습니다."></div>
      </div>
      <div style="display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:end;">
        <div class="form-group"><label class="form-label">억울함 폭발 지수</label><input id="absurd-grievance" type="number" min="1" max="10" class="form-input" value="7"></div>
        <div class="form-group"><label class="form-label">원고가 원하는 참교육</label><input id="absurd-desired" class="form-input" maxlength="180" placeholder="예: 라면 1봉 재구매, 계란 1개 추가, 한 입 발언 금지"></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--cream-dim);margin:2px 0 16px;"><input type="checkbox" id="absurd-public" checked> 공개 법정에 게시</label>
      <button class="btn btn-primary" id="absurd-save-btn">황당사례 저장</button>
    </form>
    <div class="card" style="overflow-x:auto;">
      <div style="font-weight:900;color:var(--gold);margin-bottom:10px;">등록된 황당사례 ${snap.docs.length}개</div>
      <table class="admin-table"><thead><tr><th>사건명</th><th>황당 요약</th><th>상태</th><th>관리</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="color:var(--cream-dim);text-align:center;padding:24px;">아직 재판장에 끌려온 사례가 없습니다.</td></tr>'}</tbody></table>
    </div>`;

  document.getElementById('absurd-case-reset').onclick = resetForm;
  document.getElementById('absurd-sample').onclick = fillSample;
  document.getElementById('absurd-case-form').onsubmit = saveCase;
}

function resetForm() {
  editId = '';
  ['absurd-title','absurd-summary','absurd-desc','absurd-plaintiff','absurd-defendant','absurd-desired'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cat = document.getElementById('absurd-category'); if (cat) cat.value = '기타';
  const gr = document.getElementById('absurd-grievance'); if (gr) gr.value = '7';
  const pub = document.getElementById('absurd-public'); if (pub) pub.checked = true;
  const btn = document.getElementById('absurd-save-btn'); if (btn) btn.textContent = '황당사례 저장';
}
function fillSample() {
  editId = '';
  setField('absurd-title', FUN_SAMPLE.title);
  setField('absurd-category', FUN_SAMPLE.category);
  setField('absurd-summary', FUN_SAMPLE.summary);
  setField('absurd-desc', FUN_SAMPLE.caseDescription);
  setField('absurd-plaintiff', FUN_SAMPLE.plaintiffClaim);
  setField('absurd-defendant', FUN_SAMPLE.defendantExcuse);
  setField('absurd-desired', FUN_SAMPLE.desiredVerdict);
  setField('absurd-grievance', '8');
  const pub = document.getElementById('absurd-public'); if (pub) pub.checked = true;
  const btn = document.getElementById('absurd-save-btn'); if (btn) btn.textContent = '황당사례 저장';
}
async function saveCase(e) {
  e.preventDefault();
  const title = val('absurd-title');
  const summary = val('absurd-summary');
  if (!title || !summary) return toast('사건명과 황당 요약을 입력해주세요.', 'error');
  const payload = {
    title,
    category: val('absurd-category') || '기타',
    summary,
    caseDescription: val('absurd-desc') || summary,
    plaintiffClaim: val('absurd-plaintiff'),
    defendantExcuse: val('absurd-defendant'),
    grievanceIndex: Math.max(1, Math.min(10, numVal('absurd-grievance', 7))),
    desiredVerdict: val('absurd-desired'),
    isPublic: bool('absurd-public'),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email || auth.currentUser?.uid || 'admin'
  };
  const id = editId || slug(title);
  if (editId) await updateDoc(doc(db, 'absurd_cases', id), payload);
  else await setDoc(doc(db, 'absurd_cases', id), { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || auth.currentUser?.uid || 'admin' });
  toast(editId ? '황당사례 수정 완료' : '황당사례 등록 완료', 'success');
  editId = '';
  await renderAbsurdCaseAdmin();
}

window._editAbsurdCase = async id => {
  const snap = await getDoc(doc(db, 'absurd_cases', id));
  if (!snap.exists()) return toast('사례를 찾지 못했습니다.', 'error');
  const c = snap.data();
  editId = id;
  document.getElementById('absurd-title').value = c.title || '';
  document.getElementById('absurd-category').value = c.category || '기타';
  document.getElementById('absurd-summary').value = c.summary || '';
  document.getElementById('absurd-desc').value = c.caseDescription || '';
  document.getElementById('absurd-plaintiff').value = c.plaintiffClaim || '';
  document.getElementById('absurd-defendant').value = c.defendantExcuse || '';
  document.getElementById('absurd-grievance').value = c.grievanceIndex || 7;
  document.getElementById('absurd-desired').value = c.desiredVerdict || '';
  document.getElementById('absurd-public').checked = c.isPublic !== false;
  document.getElementById('absurd-save-btn').textContent = '수정 저장';
  document.getElementById('absurd-case-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
window._toggleAbsurdCase = async (id, val) => {
  await updateDoc(doc(db, 'absurd_cases', id), { isPublic: val === true || val === 'true', updatedAt: serverTimestamp() });
  toast('공개 상태 변경 완료', 'success');
  renderAbsurdCaseAdmin();
};
window._deleteAbsurdCase = async id => {
  if (!confirm('이 황당사례를 삭제할까요?')) return;
  await deleteDoc(doc(db, 'absurd_cases', id));
  toast('삭제 완료', 'success');
  renderAbsurdCaseAdmin();
};

async function boot() {
  if (booted) return;
  const user = auth.currentUser;
  if (!await isAdminUser(user)) return;
  booted = true;
  const mo = new MutationObserver(() => addAdminTab());
  mo.observe(document.body, { childList: true, subtree: true });
  addAdminTab();
}

onAuthStateChanged(auth, () => setTimeout(boot, 250));
setTimeout(boot, 800);
