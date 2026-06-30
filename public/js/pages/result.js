import { db, auth } from '../firebase.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/sanitize.js';

const _fontsReady = document.fonts.ready;

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let currentY = y;
  let line = '';
  for (const char of String(text || '')) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
}

function _drawDivider(ctx, y, W) {
  ctx.strokeStyle = 'rgba(201,168,76,0.38)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, y);
  ctx.lineTo(W - 100, y);
  ctx.stroke();
}

async function _generateShareImage({ judgeType, icon, caseTitle, sentence, grievanceIndex }) {
  const W = 900, H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await _fontsReady;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#101522');
  bg.addColorStop(0.52, '#161b2e');
  bg.addColorStop(1, '#0d1117');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, W - 64, H - 64);
  ctx.strokeStyle = 'rgba(201,168,76,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.textAlign = 'center';
  ctx.font = '700 44px "Noto Serif KR", serif';
  ctx.fillStyle = '#c9a84c';
  ctx.fillText('소소킹 판결소', W / 2, 130);

  ctx.font = '84px serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('⚖️', W / 2, 225);
  _drawDivider(ctx, 270, W);

  const badge = `${icon} ${judgeType || 'AI'} 판사`;
  ctx.font = '700 28px "Noto Sans KR", sans-serif';
  const badgeW = Math.min(ctx.measureText(badge).width + 56, W - 120);
  const badgeX = W / 2 - badgeW / 2;
  ctx.fillStyle = 'rgba(201,168,76,0.12)';
  _roundRect(ctx, badgeX, 304, badgeW, 60, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.5)';
  ctx.stroke();
  ctx.fillStyle = '#e8c97a';
  ctx.fillText(badge, W / 2, 344);

  ctx.font = '700 38px "Noto Serif KR", serif';
  ctx.fillStyle = '#f5f0e8';
  const titleEndY = _wrapText(ctx, caseTitle || '판결 결과', W / 2, 438, W - 150, 58);

  ctx.font = '24px "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(245,240,232,0.52)';
  ctx.fillText(`억울지수 ${grievanceIndex || '?'}/10 · 법적효력 0%`, W / 2, titleEndY + 54);

  _drawDivider(ctx, titleEndY + 90, W);

  ctx.font = '700 22px "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(245,240,232,0.55)';
  ctx.fillText('📜 생활형 처분', W / 2, titleEndY + 135);

  const cardTop = titleEndY + 170;
  const cardH = H - cardTop - 150;
  ctx.fillStyle = '#1a2035';
  _roundRect(ctx, 68, cardTop, W - 136, cardH, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.55)';
  ctx.stroke();

  const fontSize = String(sentence || '').length > 60 ? 26 : 32;
  ctx.font = `700 ${fontSize}px "Noto Serif KR", serif`;
  ctx.fillStyle = '#e8c97a';
  _wrapText(ctx, sentence || '피고는 3일간 반성문 대신 간식을 산다.', W / 2, cardTop + fontSize + 38, W - 190, fontSize * 1.7);

  _drawDivider(ctx, H - 104, W);
  ctx.font = '22px "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(245,240,232,0.42)';
  ctx.fillText('sosoking.co.kr', W / 2, H - 62);

  return canvas;
}

export async function renderResult(container, caseId) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 판결 결과</span></div>
    <div class="container" style="padding:28px 20px 80px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  let caseSnap, resultSnap;
  try {
    [caseSnap, resultSnap] = await Promise.all([
      getDoc(doc(db, 'cases', caseId)),
      getDoc(doc(db, 'results', caseId))
    ]);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 불러올 권한이 없거나 삭제된 판결문입니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  if (!resultSnap.exists()) {
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 찾을 수 없습니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  const c = caseSnap.exists() ? caseSnap.data() : {};
  const r = resultSnap.data();
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const isOwner = caseSnap.exists() && c.userId === auth.currentUser?.uid;
  const isPublic = c.isPublic || false;

  const steps = [
    ['📋 접수관','사건 접수', r.reception],
    ['🔍 수사관','수사 기록', r.investigation],
    ['💼 원고 측','원고 측 주장', r.plaintiffArg],
    ['🛡️ 피고 측','피고 측 주장', r.defendantArg],
  ];

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 판결 결과</span></div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:56px;margin-bottom:8px;">${icon}</div>
          <div class="badge badge-gold" style="font-size:13px;padding:5px 14px;">${escapeHtml(r.judgeType || 'AI')} 판사</div>
          <h2 style="margin-top:14px;font-size:20px;">${escapeHtml(c.caseTitle || r.caseTitle || '판결 결과')}</h2>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">억울지수 ${escapeHtml(c.grievanceIndex || r.grievanceIndex || '?')}/10${c.createdAt ? ` · ${escapeHtml(_fmtDate(c.createdAt))}` : ''}</div>
        </div>
        ${steps.map(([role,label,content]) => `
          <div class="card step-card visible" style="margin-bottom:12px;">
            <div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div>
            <div class="step-content">${escapeHtml(content || '')}</div>
          </div>`).join('')}
        <div class="card verdict-card step-card visible" style="margin-bottom:12px;padding:22px;">
          <div style="margin-bottom:10px;"><span class="badge badge-gold">최종 판결문</span></div>
          <div class="verdict-stamp">판결</div>
          <div class="step-content" style="margin-top:12px;">${escapeHtml(r.verdict || '')}</div>
        </div>
        <div class="card sentence-card step-card visible" style="margin-bottom:28px;">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 생활형 처분</div>
          <div class="sentence-text">${escapeHtml(r.sentence || '')}</div>
        </div>
        <div style="text-align:center;margin-bottom:16px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:11px;color:var(--cream-dim);line-height:1.7;">
          🤖 본 판결문은 <strong style="color:var(--cream);">AI가 생성한 오락 콘텐츠</strong>입니다.<br>
          실제 법적 효력이 없으며, 법률 자문으로 활용할 수 없습니다.
        </div>
        <div class="result-actions">
          ${isOwner ? `<button class="btn ${isPublic ? 'btn-ghost' : 'btn-primary'}" id="btn-share">
            ${isPublic ? '🔒 판결문 비공개로 전환' : '🔗 링크 공유하기'}
          </button>` : ''}
          <button class="btn btn-secondary" id="btn-retry">🎲 다른 판사에게 재판받기</button>
          <a href="#/" class="btn btn-ghost">처음으로 돌아가기</a>
        </div>
      </div>
    </div>`;

  if (isOwner) {
    document.getElementById('btn-share').addEventListener('click', async () => {
      const newPublic = !isPublic;
      try {
        await updateDoc(doc(db, 'cases', caseId), { isPublic: newPublic });
        await updateDoc(doc(db, 'results', caseId), {
          isPublic: newPublic,
          caseTitle: c.caseTitle || r.caseTitle || '판결 결과',
          grievanceIndex: c.grievanceIndex || r.grievanceIndex || null,
          judgeType: r.judgeType || '',
          sentence: r.sentence || '',
          createdAt: r.createdAt || c.createdAt || new Date()
        });
        if (newPublic) {
          const url = `${location.origin}/#/result/${encodeURIComponent(caseId)}`;
          let handled = false;
          if (navigator.share) {
            try {
              const canvas = await _generateShareImage({
                judgeType: r.judgeType, icon,
                caseTitle: c.caseTitle || r.caseTitle || '판결 결과',
                sentence: r.sentence,
                grievanceIndex: c.grievanceIndex || r.grievanceIndex,
              });
              const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
              const file = new File([blob], 'sosoking-verdict.png', { type: 'image/png' });
              const sharePayload = navigator.canShare?.({ files: [file] })
                ? { files: [file], url }
                : { title: `${c.caseTitle || '판결 결과'} - 소소킹 판결소`, url };
              await navigator.share(sharePayload);
              handled = true;
            } catch (e) {
              if (e.name === 'AbortError') handled = true;
            }
          }
          if (!handled) {
            await navigator.clipboard.writeText(url).catch(() => {});
            showToast('링크가 복사되었습니다 🔗', 'success');
          }
        } else {
          showToast('비공개로 전환되었습니다.', 'success');
        }
        renderResult(container, caseId);
      } catch (err) {
        console.error(err);
        showToast('처리 중 오류가 발생했습니다.', 'error');
      }
    });
  }

  document.getElementById('btn-retry').addEventListener('click', () => {
    location.hash = '#/submit';
    showToast('새 사건을 접수하면 다른 판사가 배정됩니다.', 'success');
  });
}
