import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

const CARD_THEMES = {
  ai_judge:     { g1: '#6C5CE7', g2: '#a29bfe', emoji: '⚖️', label: '판결소' },
  ai_translate: { g1: '#00B894', g2: '#55efc4', emoji: '✨', label: '창작소' },
  ai_naming:    { g1: '#e17055', g2: '#FF6B4A', emoji: '✨', label: '창작소' },
};

function getCardContent(post) {
  switch (post.type) {
    case 'ai_judge': {
      const sit = (post.situation || post.title || '').slice(0, 70);
      const v = (post.verdicts || [])[0];
      return {
        subject: `"${sit}${(post.situation || post.title || '').length > 70 ? '...' : ''}"`,
        result: v ? `${v.judgeName}\n"${(v.verdict || '').slice(0, 90)}${(v.verdict || '').length > 90 ? '...' : ''}"` : '',
      };
    }
    case 'ai_translate': {
      const orig = (post.originalText || '').slice(0, 60);
      const trl = (post.translated || '').slice(0, 90);
      return {
        subject: `"${orig}${(post.originalText || '').length > 60 ? '...' : ''}"`,
        result: `→ ${post.styleName || ''}\n"${trl}${(post.translated || '').length > 90 ? '...' : ''}"`,
      };
    }
    case 'ai_naming': {
      const names = (post.names || []).slice(0, 3).map(n => n.name).join(' · ');
      return {
        subject: `"${(post.description || post.title || '').slice(0, 60)}"`,
        result: names,
      };
    }
    default:
      return null;
  }
}

function buildCardEl(post) {
  const theme = CARD_THEMES[post.type];
  const content = getCardContent(post);
  if (!theme || !content) return null;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'width:600px', 'padding:44px 40px 36px',
    `background:linear-gradient(135deg,${theme.g1},${theme.g2})`,
    'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif',
    'color:#fff', 'border-radius:28px', 'box-sizing:border-box',
    'display:flex', 'flex-direction:column', 'gap:20px',
  ].join(';');

  const resultBlock = content.result
    ? `<div style="background:rgba(255,255,255,0.18);border-radius:16px;padding:18px 20px;font-size:14px;line-height:1.65;white-space:pre-line;">${escHtml(content.result)}</div>`
    : '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:34px;line-height:1">${theme.emoji}</span>
      <div>
        <div style="font-size:20px;font-weight:900;letter-spacing:-0.3px">${theme.label}</div>
        <div style="font-size:12px;opacity:0.75;margin-top:2px">소소킹 AI킹</div>
      </div>
    </div>
    <div style="background:rgba(0,0,0,0.22);border-radius:16px;padding:18px 20px;font-size:15px;line-height:1.65;">${escHtml(content.subject)}</div>
    ${resultBlock}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
      <div style="font-size:11px;opacity:0.65">sosoking.co.kr</div>
      <div style="font-size:12px;font-weight:700;background:rgba(255,255,255,0.25);padding:7px 16px;border-radius:20px">나도 해보기 →</div>
    </div>`;

  document.body.appendChild(el);
  return el;
}

// 카드 이미지를 blob + dataUrl 로 반환 (저장/공유에 공용)
export async function generateShareCardBlob(post) {
  const h2c = window.html2canvas;
  if (!h2c) return null;
  const el = buildCardEl(post);
  if (!el) return null;
  try {
    const canvas = await h2c(el, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
    el.remove();
    const dataUrl = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    return { blob, dataUrl };
  } catch {
    el?.remove();
    return null;
  }
}

export async function downloadShareCard(post) {
  const h2c = window.html2canvas;
  if (!h2c) { toast.warn('카드 기능을 불러오는 중이에요. 잠시 후 다시 시도해주세요'); return; }
  const data = await generateShareCardBlob(post);
  if (!data) { toast.warn('이 게시글은 카드 저장을 지원하지 않아요'); return; }
  const a = document.createElement('a');
  a.href = data.dataUrl;
  a.download = 'sosoking-result.png';
  a.click();
  toast.success('카드가 저장됐어요! 📸');
}
