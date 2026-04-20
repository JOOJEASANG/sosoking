const W = 1080, H = 1080;
const GOLD = '#c9a84c';
const GOLD_DIM = 'rgba(201,168,76,0.18)';
const NAVY = '#0d1117';
const NAVY2 = '#161b2e';
const CREAM = '#f5f0e8';
const RED = '#e74c3c';

export async function shareCard({ caseTitle, judgeType, judgeIcon, sentence, grievanceIndex, caseId }) {
  const btn = document.getElementById('btn-share-card');
  if (btn) { btn.disabled = true; btn.textContent = '카드 생성 중...'; }

  try {
    await document.fonts.ready;
    const canvas = buildCard({ caseTitle, judgeType, judgeIcon, sentence, grievanceIndex, caseId });

    if (navigator.canShare) {
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          const file = new File([blob], '소소킹_판결문.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: `${caseTitle} - 소소킹 판결소`,
                text: sentence,
              });
              resolve();
              return;
            } catch (e) {
              if (e.name !== 'AbortError') download(canvas);
            }
          } else {
            download(canvas);
          }
          resolve();
        }, 'image/png');
      });
    } else {
      download(canvas);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '📸 판결 카드 저장 / 공유'; }
  }
}

function download(canvas) {
  const a = document.createElement('a');
  a.download = '소소킹_판결문.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function buildCard({ caseTitle, judgeType, judgeIcon, sentence, grievanceIndex, caseId }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');

  // 배경 그라디언트
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, NAVY2);
  bg.addColorStop(1, NAVY);
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // 미세 도트 텍스처
  c.fillStyle = 'rgba(201,168,76,0.025)';
  for (let x = 20; x < W; x += 36) {
    for (let y = 20; y < H; y += 36) {
      c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill();
    }
  }

  // 외곽 이중 테두리
  c.strokeStyle = GOLD; c.lineWidth = 4;
  c.strokeRect(32, 32, W - 64, H - 64);
  c.strokeStyle = 'rgba(201,168,76,0.35)'; c.lineWidth = 1;
  c.strokeRect(44, 44, W - 88, H - 88);

  c.textAlign = 'center';

  // 앱 이름
  c.fillStyle = GOLD;
  c.font = '700 32px "Noto Serif KR", serif';
  c.fillText('⚖️  소소킹 판결소', W / 2, 106);

  // 사건번호
  const caseNum = `사건번호 ${caseId ? hashNum(caseId) : '2025'}-소소-${Math.floor(Math.random()*9000+1000)}호`;
  c.fillStyle = 'rgba(245,240,232,0.35)';
  c.font = '400 22px "Noto Sans KR", sans-serif';
  c.fillText(caseNum, W / 2, 144);

  // 상단 구분선
  divider(c, 130, 166);

  // 판사 정보
  c.fillStyle = 'rgba(245,240,232,0.75)';
  c.font = '500 30px "Noto Sans KR", sans-serif';
  c.fillText(`${judgeIcon}  ${judgeType} 판사`, W / 2, 218);

  // 억울지수 뱃지
  c.fillStyle = GOLD_DIM;
  c.beginPath(); c.roundRect(W / 2 - 90, 234, 180, 38, 19); c.fill();
  c.strokeStyle = 'rgba(201,168,76,0.4)'; c.lineWidth = 1;
  c.beginPath(); c.roundRect(W / 2 - 90, 234, 180, 38, 19); c.stroke();
  c.fillStyle = GOLD;
  c.font = '700 20px "Noto Sans KR", sans-serif';
  c.fillText(`억울지수  ${grievanceIndex} / 10`, W / 2, 260);

  // 사건명 배경
  c.fillStyle = 'rgba(255,255,255,0.04)';
  c.beginPath(); c.roundRect(76, 296, W - 152, 210, 10); c.fill();

  // 사건명
  c.fillStyle = CREAM;
  c.font = '700 52px "Noto Serif KR", serif';
  const titleLines = wrap(c, caseTitle, W - 220);
  const titleH = titleLines.length * 68;
  const titleY = 296 + (210 - titleH) / 2 + 54;
  titleLines.forEach((line, i) => c.fillText(line, W / 2, titleY + i * 68));

  // 판결 도장
  c.save();
  c.translate(W / 2, 566);
  c.rotate(-0.05);
  c.strokeStyle = 'rgba(231,76,60,0.88)'; c.lineWidth = 5;
  c.strokeRect(-84, -30, 168, 60);
  c.fillStyle = 'rgba(231,76,60,0.88)';
  c.font = '900 38px "Noto Serif KR", serif';
  c.fillText('판  결', 0, 14);
  c.restore();

  // 중간 구분선
  divider(c, 596, 614);

  // 생활형 처분 라벨
  c.fillStyle = 'rgba(201,168,76,0.8)';
  c.font = '700 20px "Noto Sans KR", sans-serif';
  c.fillText('📜  생활형 처분', W / 2, 650);

  // 처분 내용
  c.fillStyle = '#e8c97a';
  c.font = '600 36px "Noto Serif KR", serif';
  const sentLines = wrap(c, sentence, W - 180);
  sentLines.forEach((line, i) => c.fillText(line, W / 2, 706 + i * 54));

  // 하단 구분선
  divider(c, 130, H - 122);

  // 면책 문구
  c.fillStyle = 'rgba(245,240,232,0.22)';
  c.font = '400 18px "Noto Sans KR", sans-serif';
  c.fillText('이 판결은 법적 효력이 없는 AI 오락 서비스입니다', W / 2, H - 88);

  // URL
  c.fillStyle = 'rgba(201,168,76,0.55)';
  c.font = '600 20px "Noto Sans KR", sans-serif';
  c.fillText('sosoking-481e6.web.app', W / 2, H - 56);

  return canvas;
}

function divider(c, x1, y) {
  c.strokeStyle = 'rgba(201,168,76,0.28)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x1, y); c.lineTo(W - x1, y); c.stroke();
}

function wrap(c, text, maxW) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (c.measureText(test).width > maxW) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function hashNum(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 9000 + 1000;
}
