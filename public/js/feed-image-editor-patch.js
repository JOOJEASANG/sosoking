import { auth, db } from './firebase.js';
import { uploadFeedImage } from './feed/feed-engine.js';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const STYLE_ID = 'soso-feed-image-editor-patch';
const MAX_LONG_SIDE = 1600;
const QUALITY = 0.82;
const MAX_BYTES = 5 * 1024 * 1024;
let selectedImages = [];
let activeCropId = '';
let boundForm = null;
let scheduled = false;

const BADGE_BY_TYPE = {
  '미친작명소':'📸','사진 제목학원':'📸','삼행시짓기':'📝','댓글 배틀':'🔥','웃참 챌린지':'🤣','밸런스게임':'⚖️','민심 투표':'🗳️','선택지 배틀':'🥊','정답 퀴즈':'✅','센스 퀴즈':'🧩','심리 테스트':'🔮','릴레이소설':'📚','막장드라마':'💥','역할극방':'🎭','정보공유':'🔗','꿀팁 링크':'💡','사이트 추천':'🛠️','영상 리액션':'🎬','이미지 링크':'🖼️','소소토론':'💬','생각 갈림':'🤔','AI놀이':'🤖','AI 역할극':'🎙️'
};

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .soso-img-note{display:block;margin-top:8px;color:#667085;font-size:12px;line-height:1.5;font-weight:850}.soso-img-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.soso-img-card{position:relative;border:1px solid rgba(79,124,255,.15);border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 10px 26px rgba(55,90,170,.08)}.soso-img-card.primary{outline:3px solid rgba(124,92,255,.28)}.soso-img-card img{width:100%;height:116px;object-fit:cover;display:block}.soso-img-card .badge{position:absolute;left:8px;top:8px;padding:5px 8px;border-radius:999px;background:linear-gradient(135deg,#ff7a59,#7c5cff);color:#fff;font-size:10px;font-weight:1000}.soso-img-tools{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:7px}.soso-img-tools button{border:0;border-radius:10px;background:#eef3ff;color:#4f46e5;padding:8px 4px;font-size:11px;font-weight:1000;cursor:pointer}.soso-img-tools .danger{background:#fff0f3;color:#d6336c}.soso-img-card small{display:block;padding:0 8px 8px;color:#667085;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.crop-modal{position:fixed;inset:0;z-index:5000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(8,12,24,.62);backdrop-filter:blur(12px)}.crop-modal.show{display:flex}.crop-box{width:min(760px,100%);max-height:92vh;overflow:auto;border-radius:28px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.28);padding:18px}.crop-box h3{margin:0 0 10px;font-size:22px;letter-spacing:-.055em}.crop-stage{height:min(55vh,430px);border-radius:22px;background:#111827;display:grid;place-items:center;overflow:hidden;position:relative}.crop-stage:after{content:'';position:absolute;inset:9%;border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 999px rgba(0,0,0,.30);border-radius:14px;pointer-events:none}.crop-stage img{max-width:100%;max-height:100%;transform:translate(var(--x,0px),var(--y,0px)) scale(var(--z,1));transform-origin:center;user-select:none}.crop-controls{display:grid;gap:10px;margin-top:14px}.crop-controls label{display:grid!important;grid-template-columns:92px 1fr!important;align-items:center;gap:10px;margin:0!important;font-size:13px!important}.crop-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.crop-actions button{border:0;border-radius:14px;padding:12px 15px;font-weight:1000;cursor:pointer}.crop-actions .apply{background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff}.crop-actions .cancel{background:#eef1f8;color:#4b5563}.three-line-helper{margin:10px 0 0;padding:12px;border-radius:16px;background:linear-gradient(135deg,#fff7df,#f4f0ff);border:1px solid rgba(124,92,255,.14);font-size:13px;line-height:1.65;font-weight:900;color:#151a33}
    @media(max-width:640px){.soso-img-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.soso-img-card img{height:104px}.crop-box{padding:14px;border-radius:24px}.crop-stage{height:340px}.crop-controls label{grid-template-columns:1fr!important;gap:5px}}
    [data-theme="dark"] .soso-img-card,[data-theme="dark"] .crop-box{background:#111827;color:#f5f7fb}[data-theme="dark"] .soso-img-note,[data-theme="dark"] .soso-img-card small{color:#a8b3c7}[data-theme="dark"] .three-line-helper{background:rgba(255,255,255,.06);color:#f5f7fb}
  `;
  document.head.appendChild(style);
}

function clean(v, max = 500) { return String(v || '').replace(/[<>]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, max); }
function normalizeType(v) { const type = clean(v || '미친작명소', 30); return type === '사진 제목학원' ? '미친작명소' : type; }
function getType() { return normalizeType(document.querySelector('#feed-type')?.value || document.querySelector('#type-grid button.active')?.dataset?.type || '미친작명소'); }
function getLimit(type = getType()) { return type === '미친작명소' ? 3 : ['정보공유','꿀팁 링크','사이트 추천'].includes(type) ? 10 : 5; }
function escapeHtml(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function safeVoteKey(v) { return clean(v, 40).replace(/[.~*/\[\]]/g, '_') || 'option'; }
function isImageUrl(url) { return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(String(url || '')); }
function mediaTypeFor(type, linkUrl, hasImages) { if (hasImages) return 'upload'; if (!linkUrl) return 'none'; if (/youtu\.be|youtube\.com/.test(linkUrl)) return 'youtube'; if (isImageUrl(linkUrl)) return 'image_link'; return ['정보공유','꿀팁 링크','사이트 추천'].includes(type) ? 'link_summary' : 'link'; }
function host(url) { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; } }
async function authorName(user) { if (!user || user.isAnonymous) return '익명 소소러'; try { const s = await getDoc(doc(db, 'users', user.uid)); if (s.exists() && s.data().nickname) return clean(s.data().nickname, 40); } catch {} return clean(user.displayName || user.email || '소소킹 유저', 40); }
function fileDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = rej; r.readAsDataURL(file); }); }
function loadImg(src) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; }); }
function toBlob(canvas, q) { return new Promise(res => canvas.toBlob(res, 'image/jpeg', q)); }

async function processFile(file, crop = null) {
  const img = await loadImg(await fileDataUrl(file));
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (crop) {
    const aspect = crop.aspect || sw / sh;
    const zoom = Math.max(1, Number(crop.zoom || 1));
    sw = img.naturalWidth / zoom;
    sh = sw / aspect;
    if (sh > img.naturalHeight / zoom) { sh = img.naturalHeight / zoom; sw = sh * aspect; }
    const mx = Math.max(0, img.naturalWidth - sw), my = Math.max(0, img.naturalHeight - sh);
    sx = Math.min(mx, Math.max(0, mx / 2 + (Number(crop.x || 0) / 100) * (mx / 2)));
    sy = Math.min(my, Math.max(0, my / 2 + (Number(crop.y || 0) / 100) * (my / 2)));
  }
  const ratio = Math.min(1, MAX_LONG_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * ratio); canvas.height = Math.round(sh * ratio);
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  let q = QUALITY, blob = await toBlob(canvas, q);
  while (blob && blob.size > MAX_BYTES && q > 0.55) { q -= 0.08; blob = await toBlob(canvas, q); }
  if (!blob || blob.size > MAX_BYTES) throw new Error('사진을 자동으로 줄였지만 5MB를 초과합니다. 다른 사진을 선택해주세요.');
  return new File([blob], String(file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function addFiles(files) {
  const limit = getLimit();
  const slot = Math.max(0, limit - selectedImages.length);
  if (!slot) return alert(`${getType()}은(는) 최대 ${limit}장까지 올릴 수 있습니다.`);
  const picked = [...files].filter(f => String(f.type || '').startsWith('image/')).slice(0, slot);
  if ([...files].length > slot) alert(`최대 ${limit}장까지만 추가됩니다.`);
  const status = document.querySelector('#feed-write-status');
  for (const file of picked) {
    if (status) status.textContent = `사진 자동 압축 중... ${file.name}`;
    const processed = await processFile(file);
    selectedImages.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, original: file, file: processed, url: URL.createObjectURL(processed), name: processed.name, primary: selectedImages.length === 0 });
  }
  if (status) status.textContent = `사진 ${selectedImages.length}/${limit}장 준비 완료. 필요하면 자르기/대표사진을 지정하세요.`;
  renderImages(); updatePreviewImage();
}

function renderImages() {
  const box = document.querySelector('#feed-upload-box');
  if (!box) return;
  let grid = document.querySelector('#soso-img-grid');
  if (!grid) { grid = document.createElement('div'); grid.id = 'soso-img-grid'; grid.className = 'soso-img-grid'; box.insertAdjacentElement('afterend', grid); }
  const type = getType(), limit = getLimit(type);
  const name = document.querySelector('#feed-image-name'); if (name) name.textContent = selectedImages.length ? `선택된 사진 ${selectedImages.length}/${limit}장` : '선택된 이미지 없음';
  const help = document.querySelector('#feed-upload-help'); if (help) help.textContent = `${type}: 최대 ${limit}장. 큰 사진은 자동 압축되며, 자르기 버튼으로 수동 조정할 수 있습니다.`;
  grid.innerHTML = selectedImages.map((it, i) => `<div class="soso-img-card ${it.primary ? 'primary' : ''}" data-id="${it.id}">${it.primary ? '<span class="badge">대표</span>' : ''}<img src="${it.url}" alt="첨부 사진 ${i + 1}"><div class="soso-img-tools"><button type="button" data-img-act="primary">대표</button><button type="button" data-img-act="crop">자르기</button><button type="button" data-img-act="left">←</button><button type="button" data-img-act="right">→</button><button type="button" class="danger" data-img-act="remove">삭제</button></div><small>${escapeHtml(it.name)}</small></div>`).join('');
}
function updatePreviewImage() { const primary = selectedImages.find(v => v.primary) || selectedImages[0]; const img = document.querySelector('#preview-image'); if (!img) return; if (primary) { img.src = primary.url; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); } }
function setPrimary(id) { selectedImages.forEach(v => v.primary = v.id === id); renderImages(); updatePreviewImage(); }
function removeImage(id) { const old = selectedImages.find(v => v.id === id); if (old?.url) URL.revokeObjectURL(old.url); selectedImages = selectedImages.filter(v => v.id !== id); if (selectedImages.length && !selectedImages.some(v => v.primary)) selectedImages[0].primary = true; renderImages(); updatePreviewImage(); }
function moveImage(id, dir) { const i = selectedImages.findIndex(v => v.id === id), n = i + dir; if (i < 0 || n < 0 || n >= selectedImages.length) return; [selectedImages[i], selectedImages[n]] = [selectedImages[n], selectedImages[i]]; renderImages(); }

function modal() {
  let m = document.querySelector('#crop-modal'); if (m) return m;
  m = document.createElement('div'); m.id = 'crop-modal'; m.className = 'crop-modal';
  m.innerHTML = `<div class="crop-box"><h3>사진 수동 자르기</h3><div class="crop-stage"><img id="crop-img" alt="자르기"></div><div class="crop-controls"><label>비율<select id="crop-aspect"><option value="1">1:1</option><option value="1.333">4:3</option><option value="1.777">16:9</option><option value="0">원본</option></select></label><label>확대<input id="crop-zoom" type="range" min="1" max="3" step="0.05" value="1"></label><label>좌우<input id="crop-x" type="range" min="-100" max="100" value="0"></label><label>상하<input id="crop-y" type="range" min="-100" max="100" value="0"></label></div><div class="crop-actions"><button type="button" class="cancel" id="crop-cancel">취소</button><button type="button" class="apply" id="crop-apply">적용</button></div></div>`;
  document.body.appendChild(m);
  const sync = () => { const img = m.querySelector('#crop-img'); img.style.setProperty('--z', m.querySelector('#crop-zoom').value); img.style.setProperty('--x', `${Number(m.querySelector('#crop-x').value) * 1.2}px`); img.style.setProperty('--y', `${Number(m.querySelector('#crop-y').value) * 1.2}px`); };
  m.querySelectorAll('input,select').forEach(el => el.addEventListener('input', sync));
  m.querySelector('#crop-cancel').addEventListener('click', () => m.classList.remove('show'));
  m.querySelector('#crop-apply').addEventListener('click', applyCrop);
  return m;
}
function openCrop(id) { const it = selectedImages.find(v => v.id === id); if (!it) return; activeCropId = id; const m = modal(); m.querySelector('#crop-img').src = URL.createObjectURL(it.original); m.querySelector('#crop-zoom').value = 1; m.querySelector('#crop-x').value = 0; m.querySelector('#crop-y').value = 0; m.querySelector('#crop-aspect').value = 1; m.classList.add('show'); }
async function applyCrop() { const it = selectedImages.find(v => v.id === activeCropId), m = document.querySelector('#crop-modal'); if (!it || !m) return; const original = await loadImg(await fileDataUrl(it.original)); const sel = Number(m.querySelector('#crop-aspect').value || 1); const aspect = sel || original.naturalWidth / original.naturalHeight; const cropped = await processFile(it.original, { aspect, zoom: Number(m.querySelector('#crop-zoom').value), x: Number(m.querySelector('#crop-x').value), y: Number(m.querySelector('#crop-y').value) }); if (it.url) URL.revokeObjectURL(it.url); it.file = cropped; it.url = URL.createObjectURL(cropped); it.name = cropped.name; m.classList.remove('show'); renderImages(); updatePreviewImage(); }

function patchImageInput() {
  const input = document.querySelector('#feed-image'), btn = document.querySelector('#feed-image-btn'), box = document.querySelector('#feed-upload-box');
  if (!input || !btn || input.dataset.multiImagePatch === '1') return;
  input.dataset.multiImagePatch = '1'; input.multiple = true; input.accept = 'image/*'; btn.textContent = '📸 사진 선택/추가';
  if (box && !box.querySelector('.soso-img-note')) box.insertAdjacentHTML('beforeend', '<small class="soso-img-note">정보글 최대 10장, 미친작명소 최대 3장. 사진은 자동 압축되고 수동 자르기가 가능합니다.</small>');
  input.addEventListener('change', async e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try { await addFiles(e.target.files || []); } catch (err) { alert(err.message || '사진 처리에 실패했습니다.'); } input.value = ''; }, true);
  btn.addEventListener('click', e => { e.preventDefault(); input.click(); }, true);
}

function patchThreeLine() {
  const typeGrid = document.querySelector('#type-grid'); if (!typeGrid) return;
  const cat = document.querySelector('.category-grid button.active')?.dataset?.category || 'fun';
  if (cat === 'fun' && !typeGrid.querySelector('[data-type="삼행시짓기"]')) { const b = document.createElement('button'); b.type = 'button'; b.dataset.type = '삼행시짓기'; b.innerHTML = '<b>📝</b> 삼행시짓기'; typeGrid.appendChild(b); }
}
function applyThreeLine() {
  const t = document.querySelector('#feed-type'); if (t) t.value = '삼행시짓기';
  const help = document.querySelector('#feed-type-help'); if (help) help.textContent = '제시어를 넣으면 사람들이 댓글로 삼행시를 이어가는 드립형 글입니다.';
  const title = document.querySelector('#feed-title'), content = document.querySelector('#feed-content'), q = document.querySelector('#feed-question');
  if (title) title.placeholder = '예: 소소킹으로 삼행시 가자'; if (content) content.placeholder = '제시어와 예시 삼행시를 적어주세요.'; if (q) q.placeholder = '예: 이 제시어로 제일 웃긴 삼행시는?';
  ['댓글로 삼행시','제일 웃긴 답 추천','제시어 바꾸기','다음 제시어 추천'].forEach((v,i) => { const input = document.querySelectorAll('.feed-option-input')[i]; if (input) input.value = v; });
  const prev = document.querySelector('#preview-type-label'); if (prev) prev.textContent = '📝 삼행시짓기'; renderThreeLineBox();
}
function renderThreeLineBox() { const content = document.querySelector('#feed-content'); if (!content) return; let box = document.querySelector('#three-line-helper'); if (!box) { box = document.createElement('div'); box.id = 'three-line-helper'; box.className = 'three-line-helper'; content.insertAdjacentElement('afterend', box); } const raw = (document.querySelector('#feed-title')?.value || '소소킹').replace(/삼행시|짓기|가자|으로|로/g, '').trim().slice(0,3).padEnd(3,'·'); box.innerHTML = `<b>삼행시 미리보기</b><br>${escapeHtml(raw[0])}: 댓글로 첫 줄<br>${escapeHtml(raw[1])}: 댓글로 둘째 줄<br>${escapeHtml(raw[2])}: 댓글로 마무리`; }

async function submitPatched(e) {
  const form = e.target?.closest?.('#feed-write-form'); if (!form) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const user = auth.currentUser; if (!user) { alert('로그인 후 글을 올릴 수 있습니다.'); location.hash = '#/login'; return; }
  const type = getType(), limit = getLimit(type); if (selectedImages.length > limit) return alert(`${type}은(는) 최대 ${limit}장까지 올릴 수 있습니다.`);
  const title = clean(document.querySelector('#feed-title')?.value, 90), content = clean(document.querySelector('#feed-content')?.value, 1200), question = clean(document.querySelector('#feed-question')?.value, 90);
  if (title.length < 4) return alert('제목을 4자 이상 입력해주세요.'); if (content.length < 5) return alert('본문 또는 상황 설명을 5자 이상 입력해주세요.');
  const status = document.querySelector('#feed-write-status'), submit = form.querySelector('.write-submit'); if (submit) submit.disabled = true;
  try {
    const ordered = [...selectedImages].sort((a,b) => Number(!a.primary) - Number(!b.primary)); const imageUrls = [];
    for (let i=0;i<ordered.length;i++) imageUrls.push(await uploadFeedImage(ordered[i].file, p => { if (status) status.textContent = `사진 업로드 중... ${i+1}/${ordered.length} (${p}%)`; }));
    const options = [...document.querySelectorAll('.feed-option-input')].map(i => clean(i.value, 40)).filter(Boolean).slice(0,4); const finalOptions = options.length >= 2 ? options : ['공감한다','애매하다','반대한다','댓글로 말한다'];
    const tags = clean(document.querySelector('#feed-tags')?.value, 120).split(',').map(v => clean(v.replace(/^#/, ''), 18)).filter(Boolean).slice(0, 6);
    const linkUrl = clean(document.querySelector('#feed-link-url')?.value, 700), mediaType = mediaTypeFor(type, linkUrl, imageUrls.length > 0);
    const payload = { type, badge: BADGE_BY_TYPE[type] || '✨', title, content, summary: clean(content, 180), question: question || '사람들은 어떻게 생각할까요?', options: finalOptions, votes: Object.fromEntries(finalOptions.map(o => [safeVoteKey(o), 0])), voteTotal:0, tags: tags.length ? tags : ['소소피드'], views:0, likes:0, comments:0, status:'published', source:user.isAnonymous?'anonymous_user':'user', authorId:user.uid, authorName: await authorName(user), imageUrl: imageUrls[0] || (mediaType === 'image_link' ? linkUrl : ''), imageUrls, imageCount:imageUrls.length, mediaType, linkUrl, linkTitle: clean(document.querySelector('#feed-link-title')?.value,120), linkSummary: clean(document.querySelector('#feed-link-summary')?.value,260), linkSource: clean(host(linkUrl),80), embedUrl:'', thumbnailUrl:'', topComment:'', createdAt:serverTimestamp(), createdAtMs:Date.now(), updatedAt:serverTimestamp() };
    if (status) status.textContent = '소소피드 등록 중...';
    const ref = await addDoc(collection(db, 'soso_feed_posts'), payload); selectedImages = []; location.hash = `#/feed/${ref.id}`;
  } catch (err) { alert(err.message || '등록에 실패했습니다.'); if (status) status.textContent = err.message || '등록 실패'; }
  finally { if (submit) submit.disabled = false; }
}

function bind() {
  const form = document.querySelector('#feed-write-form'); if (!form || boundForm === form) return; boundForm = form; selectedImages = [];
  form.addEventListener('submit', submitPatched, true);
  document.addEventListener('click', e => { const card = e.target?.closest?.('.soso-img-card'), act = e.target?.dataset?.imgAct; if (!card || !act) return; e.preventDefault(); e.stopPropagation(); const id = card.dataset.id; if (act==='primary') setPrimary(id); if (act==='crop') openCrop(id); if (act==='left') moveImage(id,-1); if (act==='right') moveImage(id,1); if (act==='remove') removeImage(id); }, true);
  document.addEventListener('click', e => { const btn = e.target?.closest?.('#type-grid button[data-type]'); if (!btn) return; setTimeout(() => { if (btn.dataset.type === '삼행시짓기') applyThreeLine(); renderImages(); }, 40); }, true);
  document.addEventListener('input', e => { if (getType() === '삼행시짓기' && ['feed-title','feed-content'].includes(e.target?.id)) renderThreeLineBox(); }, true);
}

function patch() { if (!location.hash.startsWith('#/feed/new')) return; injectStyle(); patchThreeLine(); patchImageInput(); bind(); renderImages(); }
function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; patch(); }); }
new MutationObserver(schedule).observe(document.getElementById('page-content') || document.body, { childList:true, subtree:true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();
window.addEventListener('hashchange', () => setTimeout(schedule, 50));
setTimeout(schedule, 0); setTimeout(schedule, 400); setTimeout(schedule, 1200);
