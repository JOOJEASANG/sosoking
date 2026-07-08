import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const MAX_TITLE = 40;
const MAX_DESC = 320;
const MAX_DESIRED = 160;
const DAILY_LIMIT = 3;
const MAX_ORIGINAL_IMAGE = 25 * 1024 * 1024;
const MAX_RESIZED_IMAGE = 500 * 1024;
const MAX_IMAGE_DIM = 1600;

const JUDGES = [
  { id: '엄벌주의형', icon: '👨‍⚖️', desc: '사소해도 중대 사건으로 격상' },
  { id: '감성형', icon: '😢', desc: '판사가 먼저 울컥합니다' },
  { id: '현실주의형', icon: '🤦', desc: '팩트로 쓸쓸하게 정리' },
  { id: '과몰입형', icon: '🔥', desc: '이걸 재판까지 끌고 갑니다' },
  { id: '피곤형', icon: '😴', desc: '귀찮지만 처분은 매섭게' },
  { id: '논리집착형', icon: '🧮', desc: '한 입의 범위를 소수점으로 계산' },
  { id: '드립형', icon: '🎭', desc: '진지한 얼굴로 드립 폭격' }
];

const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따',
  '이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원',
  '응급','정신과','우울증','공황','자해','자살','의료','진단','치료'
];

function _isTooSerious(text) {
  const source = String(text || '').replace(/\s+/g, '');
  return SERIOUS_KEYWORDS.some(kw => source.includes(kw));
}
function _formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}
function _autoTitle(desc) {
  const text = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const head = text.replace(/[.!?。！？].*$/g, '').slice(0, 24).trim();
  return `${head || '이걸로'} 사건`.slice(0, MAX_TITLE);
}
function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function _loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 불러오지 못했습니다.')); };
    img.src = url;
  });
}
function _canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 압축에 실패했습니다.')), 'image/jpeg', quality);
  });
}
async function _resizeImageForAi(file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.');
  if (file.size > MAX_ORIGINAL_IMAGE) throw new Error('원본 이미지는 25MB 이하만 첨부할 수 있습니다.');
  const img = await _loadImage(file);
  let maxDim = MAX_IMAGE_DIM;
  let bestBlob = null;
  let finalWidth = 0;
  let finalHeight = 0;
  for (let round = 0; round < 5; round++) {
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    for (const q of [0.86, 0.78, 0.68, 0.58, 0.48]) {
      const blob = await _canvasToBlob(canvas, q);
      bestBlob = blob;
      finalWidth = width;
      finalHeight = height;
      if (blob.size <= MAX_RESIZED_IMAGE) {
        return { data: await _blobToBase64(blob), mimeType: 'image/jpeg', originalName: file.name || 'attached-image.jpg', originalSize: file.size, resizedSize: blob.size, width, height };
      }
    }
    maxDim = Math.round(maxDim * 0.82);
  }
  if (!bestBlob) throw new Error('이미지 압축에 실패했습니다.');
  if (bestBlob.size > MAX_RESIZED_IMAGE) throw new Error('이미지를 자동 압축했지만 아직 큽니다. 더 작은 이미지를 첨부해주세요.');
  return { data: await _blobToBase64(bestBlob), mimeType: 'image/jpeg', originalName: file.name || 'attached-image.jpg', originalSize: file.size, resizedSize: bestBlob.size, width: finalWidth, height: finalHeight };
}

function _showSeriousModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#1a2035;border:2px solid #e74c3c;border-radius:16px;padding:28px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        <div style="font-size:52px;margin-bottom:12px;">😰</div>
        <div style="font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;color:#e74c3c;margin-bottom:10px;">잠깐, 황당재판부가 정색했습니다</div>
        <p style="font-size:14px;color:rgba(245,240,232,0.72);line-height:1.75;margin-bottom:22px;">실제 범죄·소송·학교폭력·의료·정신건강 같은 내용은 접수할 수 없습니다.<br>소소한 일상 사건으로 바꿔 다시 작성해주세요.</p>
        <button id="_serious-cancel" style="padding:13px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(245,240,232,0.75);font-size:13px;cursor:pointer;width:100%;">가벼운 사건으로 다시 작성하기</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_serious-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

async function _loadSubmitSettings() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    const d = snap.exists() ? snap.data() : {};
    return {
      dailyLimit: Math.max(1, Math.min(20, Number.isFinite(Number(d.dailyLimit)) ? Math.floor(Number(d.dailyLimit)) : DAILY_LIMIT)),
      cooldownSec: Math.max(0, Math.min(300, Number.isFinite(Number(d.cooldownSec)) ? Math.floor(Number(d.cooldownSec)) : 45)),
    };
  } catch {
    return { dailyLimit: DAILY_LIMIT, cooldownSec: 45 };
  }
}

export async function renderSubmit(container) {
  const settings = await _loadSubmitSettings();
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">소소사건 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="card" style="padding:20px;margin-bottom:18px;border-color:rgba(201,168,76,.45);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:6px;">3초 접수 · 장황한 판결</div>
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;line-height:1.45;">짧게 쓰면, 재판부가 크게 키웁니다</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:7px;">컵라면 한 입, 푸딩 실종, 충전기 독점처럼 별것 아닌 일을 적어주세요. 사건번호·담당 조사관·증거 아닌 증거·황당 처분은 AI 재판부가 알아서 만듭니다.</div>
        </div>

        <form id="submit-form">
          <div class="form-group">
            <label class="form-label">무슨 일이 있었나요? <span style="color:var(--red)">*</span></label>
            <textarea id="case-desc" class="form-textarea" style="min-height:150px;" maxlength="${MAX_DESC}" placeholder="예: 냉장고에 마지막 푸딩을 남겨놨는데 누가 먹고 빈 자리만 남겨놨어요. 별일 아닌데 퇴근하고 기대했던 거라 너무 억울합니다." required></textarea>
            <div class="char-counter"><span id="desc-count">0</span>/${MAX_DESC}</div>
          </div>

          <div class="form-group">
            <label class="form-label">사건명 <span class="optional">선택 · 비워두면 자동 생성</span></label>
            <input type="text" id="case-title" class="form-input" maxlength="${MAX_TITLE}" placeholder="예: 마지막 푸딩 실종 사건">
            <div class="char-counter"><span id="title-count">0</span>/${MAX_TITLE}</div>
          </div>

          <details class="card" style="padding:14px;margin-bottom:18px;background:rgba(255,255,255,.025);">
            <summary style="cursor:pointer;font-weight:900;color:var(--gold);list-style:none;">선택 옵션 열기 · 사진/억울함/재판부</summary>
            <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin:8px 0 16px;">그냥 접수해도 됩니다. 더 과몰입시키고 싶을 때만 건드리세요.</div>

            <div class="form-group">
              <label class="form-label">억울함 레벨</label>
              <div class="slider-value"><span id="grievance-val">5</span><span style="font-size:14px;color:var(--cream-dim);"> / 10</span></div>
              <input type="range" id="grievance" class="form-range" min="1" max="10" value="5">
              <div class="slider-labels"><span>🙂 그냥 웃김</span><span>😤 이건 선고 필요</span></div>
            </div>

            <div class="form-group">
              <label class="form-label">원하는 황당 처분 <span class="optional">선택</span></label>
              <input type="text" id="desired-verdict" class="form-input" maxlength="${MAX_DESIRED}" placeholder="예: 푸딩 2개 배상, 3일간 한입만 금지">
            </div>

            <div class="form-group">
              <label class="form-label">담당 재판부 <span class="optional">선택 안 하면 랜덤</span></label>
              <div class="judge-grid" id="judge-grid">
                <div class="judge-option active" data-judge=""><span class="judge-option-icon">🎲</span><div class="judge-option-name">랜덤 배정</div><div class="judge-option-desc">황당재판부가 알아서 과몰입</div></div>
                ${JUDGES.map(j => `<div class="judge-option" data-judge="${escapeHtml(j.id)}"><span class="judge-option-icon">${j.icon}</span><div class="judge-option-name">${escapeHtml(j.id)}</div><div class="judge-option-desc">${escapeHtml(j.desc)}</div></div>`).join('')}
              </div>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">이미지 첨부 <span class="optional">선택</span></label>
              <input type="file" id="case-image" accept="image/jpeg,image/png,image/webp" class="form-input" style="padding:10px;background:rgba(255,255,255,.03);">
              <div id="image-status" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">사진이 있으면 분위기 참고자료로만 분석합니다. 개인정보가 있는 이미지는 올리지 마세요.</div>
              <div id="image-preview" style="display:none;margin-top:12px;"></div>
            </div>
          </details>

          <div class="card" style="padding:14px;margin-bottom:18px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.32);">
            <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.65;color:var(--cream);cursor:pointer;">
              <input type="checkbox" id="is-public" checked style="margin-top:4px;">
              <span><b style="color:var(--gold);">황당판결 기록에 공개</b><br><span style="color:var(--cream-dim);">닉네임과 판결문이 공개될 수 있습니다. 원본 첨부 이미지는 작성자에게만 표시됩니다.</span></span>
            </label>
          </div>

          <div class="disclaimer" style="margin-bottom:20px;">
            · 하루 접수 한도 <strong>${settings.dailyLimit}건</strong> · 재접수 대기 <strong>${settings.cooldownSec}초</strong><br>
            · 실명·연락처·주민번호 입력 금지 · 실제 법적 효력 없음
          </div>
          <button type="submit" class="btn btn-primary" id="submit-btn">접수하고 황당재판 받기</button>
        </form>
      </div>
    </div>`;

  let selectedJudge = '';
  let imageAttachment = null;

  document.getElementById('judge-grid')?.addEventListener('click', (e) => {
    const opt = e.target.closest('.judge-option');
    if (!opt) return;
    document.querySelectorAll('#judge-grid .judge-option').forEach(el => el.classList.remove('active'));
    opt.classList.add('active');
    selectedJudge = opt.dataset.judge || '';
  });
  document.getElementById('case-title')?.addEventListener('input', function() { document.getElementById('title-count').textContent = this.value.length; });
  document.getElementById('case-desc')?.addEventListener('input', function() { document.getElementById('desc-count').textContent = this.value.length; });
  document.getElementById('grievance')?.addEventListener('input', function() { document.getElementById('grievance-val').textContent = this.value; });
  document.getElementById('case-image')?.addEventListener('change', async function() {
    const file = this.files?.[0];
    const status = document.getElementById('image-status');
    const preview = document.getElementById('image-preview');
    imageAttachment = null;
    preview.style.display = 'none';
    preview.innerHTML = '';
    if (!file) { status.textContent = '사진이 있으면 분위기 참고자료로만 분석합니다. 개인정보가 있는 이미지는 올리지 마세요.'; return; }
    status.textContent = `이미지 확인 중... 원본 ${_formatBytes(file.size)}`;
    try {
      const resized = await _resizeImageForAi(file);
      imageAttachment = resized;
      status.textContent = `첨부 완료: ${resized.originalName} · ${resized.width}×${resized.height} · ${_formatBytes(resized.originalSize)} → ${_formatBytes(resized.resizedSize)}`;
      preview.style.display = 'block';
      preview.innerHTML = `<img src="data:${resized.mimeType};base64,${resized.data}" alt="첨부 이미지 미리보기" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;border:1px solid var(--border);">`;
    } catch (err) {
      status.textContent = err.message || '이미지를 처리하지 못했습니다.';
      showToast(status.textContent, 'error');
      this.value = '';
    }
  });

  document.getElementById('submit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('case-desc').value.trim();
    const rawTitle = document.getElementById('case-title').value.trim();
    const title = rawTitle || _autoTitle(desc);
    const grievance = parseInt(document.getElementById('grievance').value, 10);
    const desiredVerdict = document.getElementById('desired-verdict').value.trim();
    const isPublic = document.getElementById('is-public').checked;

    if (desc.length < 10) return showToast('무슨 일이 있었는지 10자 이상 적어주세요.', 'error');
    if (!title || title.length < 3) return showToast('사건명을 적거나, 사건 내용을 조금 더 길게 적어주세요.', 'error');
    const merged = `${title} ${desc} ${desiredVerdict}`;
    if (_isTooSerious(merged)) {
      const ok = await _showSeriousModal();
      if (!ok) return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '사건번호 부여 중...';
    try {
      const submitCase = httpsCallable(functions, 'submitCase');
      const res = await submitCase({ caseTitle: title, caseDescription: desc, grievanceIndex: grievance, desiredVerdict, selectedJudge, isPublic, imageAttachment });
      showToast(`사건번호 부여 완료: ${res.data?.docketNumber || '황당사건'}`, 'success');
      location.hash = `#/trial/${res.data.caseId}`;
    } catch (err) {
      console.error(err);
      let msg = err.message || '접수 실패';
      if (String(msg).includes('resource-exhausted') || String(msg).includes('일일 접수')) msg = `오늘 접수 한도(${settings.dailyLimit}건)를 모두 사용했습니다.`;
      showToast(msg, 'error');
      btn.disabled = false;
      btn.textContent = '접수하고 황당재판 받기';
    }
  });
}
