import { functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const MODES = [
  { id: 'bukhan',    emoji: '🪖', label: '북한말',      desc: '위대한 수령 말씀처럼' },
  { id: 'gyeongsang',emoji:'🔥', label: '경상도 사투리', desc: '억세고 직선적인' },
  { id: 'jeolla',   emoji: '🌿', label: '전라도 사투리', desc: '구성지고 정 많은' },
  { id: 'jeju',     emoji: '🍊', label: '제주도 말',    desc: '아무도 못 알아듣는' },
  { id: 'chungcheong',emoji:'🐢',label: '충청도 사투리', desc: '느릿느릿 여유로운' },
  { id: 'joseon',   emoji: '👑', label: '사극왕체',     desc: '과인이 이르노니' },
  { id: 'gupsik',   emoji: '🍚', label: '급식체',       desc: '급식이들의 언어' },
  { id: 'mz',       emoji: '📱', label: 'MZ체',         desc: '갬성충 바이브' },
  { id: 'kkondae',  emoji: '👴', label: '꼰대체',       desc: '내 때는 말이야...' },
  { id: 'judge',    emoji: '⚖️', label: '판사체',       desc: '주문을 낭독한다' },
  { id: 'konglish', emoji: '🌍', label: '코믹 콩글리시', desc: '외국인이 쓴 한국어' },
  { id: 'broken',   emoji: '💥', label: '붕괴번역',     desc: '구글 번역기 망가진 날' }
];

const SAMPLES = [
  '오늘 점심 뭐 먹을지 모르겠어',
  '야 나 오늘 지각했는데 과장이 또 뭐라 함',
  '사랑한다고 말하고 싶은데 용기가 안 나',
  '치킨이랑 피자 중에 뭐 시킬지 고민됨',
  '월요일 아침은 진짜 사람이 살 곳이 못 된다'
];

let selectedModeId = 'bukhan';

function ensureStyle() {
  if (document.getElementById('translate-page-style')) return;
  const style = document.createElement('style');
  style.id = 'translate-page-style';
  style.textContent = `
    .tl-page{--tl-accent:#c9a84c;--tl-red:#ff4d3d;}
    .tl-wrap{max-width:560px;margin:0 auto;padding:18px 16px 90px;}
    .tl-kicker{font-size:11px;letter-spacing:.16em;color:var(--gold);text-transform:uppercase;font-weight:800;}
    .tl-head{font-family:var(--font-serif);font-size:26px;font-weight:900;line-height:1.25;margin:8px 0 4px;text-wrap:balance;}
    .tl-head em{color:var(--tl-red);font-style:normal;}
    .tl-sub{font-size:13px;color:var(--cream-dim);margin-bottom:16px;}
    .tl-intake{background:var(--navy-card);border:1px solid var(--border);border-radius:16px;padding:16px 15px 15px;box-shadow:var(--shadow);}
    .tl-intake-label{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.1em;color:var(--cream-dim);font-weight:700;margin-bottom:8px;text-transform:uppercase;}
    .tl-intake textarea{width:100%;resize:vertical;min-height:84px;border:1px dashed var(--border);border-radius:11px;padding:12px;font-family:var(--font-sans);font-size:15px;line-height:1.65;color:var(--cream);background:rgba(255,255,255,.03);}
    .tl-intake textarea:focus-visible{outline:2px solid var(--gold);outline-offset:1px;}
    .tl-samples{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
    .tl-samples button{cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--cream-dim);background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:999px;padding:6px 11px;transition:transform .12s;}
    .tl-samples button:hover{transform:translateY(-1px);}
    .tl-samples button:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .tl-sec{font-size:10px;letter-spacing:.14em;color:var(--cream-dim);text-transform:uppercase;font-weight:700;margin:22px 2px 10px;}
    .tl-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
    .tl-mode{cursor:pointer;position:relative;border:1.5px solid var(--border);border-radius:13px;background:var(--navy-card);padding:11px 6px 9px;text-align:center;transition:transform .14s,border-color .18s;font-family:inherit;color:var(--cream);}
    .tl-mode:hover{transform:translateY(-2px);}
    .tl-mode:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .tl-mode[aria-pressed="true"]{border-color:var(--gold);background:rgba(201,168,76,.12);}
    .tl-mode[aria-pressed="true"]::after{content:"선택";position:absolute;top:-8px;right:-4px;font-size:9px;font-weight:800;color:#241a05;background:var(--gold);border-radius:999px;padding:3px 6px;}
    .tl-mode-emoji{font-size:26px;line-height:1;}
    .tl-mode-label{font-weight:900;font-size:12px;margin-top:5px;}
    .tl-mode-desc{font-size:9px;color:var(--cream-dim);margin-top:2px;line-height:1.3;}
    .tl-cta{margin-top:16px;width:100%;cursor:pointer;font-family:var(--font-serif);font-size:18px;font-weight:900;color:#fff;background:var(--tl-red);border:0;border-radius:14px;padding:15px;transition:transform .12s,filter .2s;}
    .tl-cta:hover{transform:translateY(-2px);filter:brightness(1.05);}
    .tl-cta:disabled{opacity:.6;cursor:progress;transform:none;}
    .tl-cta:focus-visible{outline:3px solid var(--gold);outline-offset:2px;}
    .tl-result{margin-top:24px;}
    .tl-result[hidden]{display:none;}
    .tl-card{background:var(--navy-card);border:2px solid var(--border);border-radius:8px;padding:18px 17px 15px;box-shadow:var(--shadow);position:relative;overflow:hidden;}
    .tl-card-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid var(--border);padding-bottom:10px;margin-bottom:13px;}
    .tl-card-title{font-family:var(--font-serif);font-size:16px;font-weight:900;}
    .tl-card-mode{font-size:10px;color:var(--cream-dim);margin-top:3px;}
    .tl-badge{font-size:28px;line-height:1;}
    .tl-tagline{font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--tl-accent);text-transform:uppercase;margin-bottom:10px;}
    .tl-translated{font-size:16px;line-height:1.8;color:var(--cream);font-weight:700;word-break:keep-all;background:rgba(255,255,255,.03);border-radius:10px;padding:14px 13px;}
    .tl-style-note{margin-top:11px;font-size:11px;color:var(--cream-dim);border-top:1px dashed var(--border);padding-top:9px;}
    .tl-stamp{position:absolute;right:10px;bottom:40px;width:70px;height:70px;border:2.5px solid var(--tl-red);border-radius:50%;color:var(--tl-red);display:grid;place-items:center;text-align:center;font-family:var(--font-serif);font-size:11px;font-weight:900;line-height:1.1;transform:rotate(-16deg);opacity:.75;pointer-events:none;}
    .tl-actions{display:flex;gap:9px;margin-top:14px;}
    .tl-actions button{flex:1;cursor:pointer;font-family:inherit;font-weight:900;font-size:13px;border-radius:12px;padding:12px 8px;border:1.5px solid var(--border);transition:transform .1s;color:var(--cream);background:var(--navy-card);}
    .tl-actions button:hover{transform:translateY(-2px);}
    .tl-actions button.share{background:var(--gold);color:#241a05;border-color:var(--gold);}
    .tl-actions button:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .tl-loading{text-align:center;padding:30px 10px;color:var(--cream-dim);}
    .tl-loading .big{font-size:42px;animation:tl-spin 1.4s linear infinite;}
    @keyframes tl-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    .tl-disclaimer{margin-top:22px;text-align:center;font-size:10.5px;color:var(--cream-dim);line-height:1.65;}
    @media(prefers-reduced-motion:reduce){.tl-loading .big{animation:none;}}
    @media(max-width:400px){.tl-modes{grid-template-columns:repeat(2,1fr);}}
  `;
  document.head.appendChild(style);
}

function buildModePicker() {
  return MODES.map(m => `
    <button type="button" class="tl-mode" data-mode="${m.id}" aria-pressed="${m.id === selectedModeId ? 'true' : 'false'}">
      <div class="tl-mode-emoji">${m.emoji}</div>
      <div class="tl-mode-label">${escapeHtml(m.label)}</div>
      <div class="tl-mode-desc">${escapeHtml(m.desc)}</div>
    </button>`).join('');
}

function wireModePicker(container) {
  container.querySelectorAll('.tl-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedModeId = btn.dataset.mode;
      container.querySelectorAll('.tl-mode').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === selectedModeId ? 'true' : 'false'));
    });
  });
}

function resultHtml(mode, result) {
  const m = MODES.find(x => x.id === mode.id) || MODES[0];
  return `
    <div class="tl-card">
      <div class="tl-card-head">
        <div>
          <div class="tl-card-title">${escapeHtml(m.emoji)} ${escapeHtml(m.label)} 번역 완료</div>
          <div class="tl-card-mode">${escapeHtml(m.desc)}</div>
        </div>
        <div class="tl-badge">${escapeHtml(m.emoji)}</div>
      </div>
      <div class="tl-tagline">${escapeHtml(result.tagline || '번역 완료')}</div>
      <div class="tl-translated">${escapeHtml(result.translated)}</div>
      <div class="tl-style-note">📌 ${escapeHtml(result.style_note || '')}</div>
      <div class="tl-stamp" aria-hidden="true">미친<br>번역소<br><small>인증</small></div>
    </div>
    <div class="tl-actions">
      <button type="button" id="tl-copy">📋 복사</button>
      <button type="button" id="tl-share" class="share">🔗 공유</button>
      <button type="button" id="tl-again">🔄 다시</button>
    </div>`;
}

export async function renderTranslate(container) {
  ensureStyle();
  container.innerHTML = `
    <div class="tl-page">
      <div class="page-header"><span class="logo">💥 미친 번역소</span></div>
      <div class="tl-wrap">
        <div class="tl-kicker">번역 · TRANSLATE</div>
        <h1 class="tl-head">뭐든 집어넣으면<br><em>미치게 번역</em>해드립니다</h1>
        <p class="tl-sub">북한말·사투리·꼰대체·급식체·판사체… 병맛 번역 12종 세트</p>

        <section class="tl-intake">
          <div class="tl-intake-label"><span>▓ 번역할 내용</span><span id="tl-count">0 / 200</span></div>
          <textarea id="tl-text" maxlength="200" placeholder="번역할 내용을 입력하세요. 짧을수록 더 미쳐요 ^^"></textarea>
          <div class="tl-samples" id="tl-samples"></div>
        </section>

        <div class="tl-sec">번역 모드 선택 · 뭘로 미칠까?</div>
        <div class="tl-modes" id="tl-modes">${buildModePicker()}</div>

        <button class="tl-cta" id="tl-go" type="button">💥 번역 시작 · 미치게 바꿔줘</button>

        <section class="tl-result" id="tl-result" hidden aria-live="polite"></section>

        <p class="tl-disclaimer">100% 오락용이며 실제 번역 효력이 없습니다.<br>사투리·방언은 문화유산입니다 — 웃음이지 비하가 아닙니다.</p>
      </div>
    </div>`;

  const textEl = container.querySelector('#tl-text');
  const countEl = container.querySelector('#tl-count');
  const goBtn = container.querySelector('#tl-go');
  const resultEl = container.querySelector('#tl-result');

  textEl.addEventListener('input', () => { countEl.textContent = `${textEl.value.length} / 200`; });

  container.querySelector('#tl-samples').innerHTML =
    SAMPLES.map(s => `<button type="button" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
  container.querySelectorAll('#tl-samples [data-s]').forEach(b => b.addEventListener('click', () => {
    textEl.value = b.dataset.s;
    countEl.textContent = `${textEl.value.length} / 200`;
    textEl.focus();
  }));

  wireModePicker(container);

  const generateTranslation = httpsCallable(functions, 'generateTranslation', { timeout: 130000 });

  async function go() {
    const text = textEl.value.trim();
    if (text.length < 2) { showToast('번역할 내용을 입력해주세요!', 'warn'); textEl.focus(); return; }

    goBtn.disabled = true;
    resultEl.hidden = false;
    resultEl.innerHTML = `<div class="tl-loading"><div class="big">🌀</div><p>번역 중… 병맛 회로 가동 중</p></div>`;

    try {
      const modeId = selectedModeId;
      const res = await generateTranslation({ text, modeId });
      const data = res.data;

      if (!data.safe) {
        const msg = data.code === 'CRISIS' ? '🧡 지금 많이 힘드신가요? 자살예방상담전화 109로 연락해 주세요.' : '입력한 내용을 번역할 수 없었어요. 다른 내용을 입력해 보세요.';
        resultEl.innerHTML = `<div style="padding:20px;border-radius:14px;border:1.5px solid var(--border);background:var(--navy-card);font-size:14px;line-height:1.7;">${escapeHtml(msg)}</div>`;
        return;
      }

      const modeObj = { id: data.modeId, label: data.modeLabel, emoji: data.modeEmoji };
      resultEl.innerHTML = resultHtml(modeObj, data.result);

      resultEl.querySelector('#tl-copy')?.addEventListener('click', () => {
        const txt = `${data.modeEmoji} ${data.modeLabel} 번역\n\n${data.result.translated}\n\n— 미친 번역소`;
        navigator.clipboard.writeText(txt).then(() => showToast('복사됨!'), () => showToast('복사 실패'));
      });
      resultEl.querySelector('#tl-share')?.addEventListener('click', () => {
        const txt = `${data.modeEmoji} 미친 번역소 — ${data.modeLabel}\n\n${data.result.translated}\n\nsosoking.web.app`;
        if (navigator.share) {
          navigator.share({ title: '미친 번역소', text: txt }).catch(() => {});
        } else {
          navigator.clipboard.writeText(txt).then(() => showToast('링크 복사됨!'), () => showToast('복사 실패'));
        }
      });
      resultEl.querySelector('#tl-again')?.addEventListener('click', () => {
        resultEl.hidden = true;
        resultEl.innerHTML = '';
        textEl.value = '';
        countEl.textContent = '0 / 200';
        textEl.focus();
      });
    } catch (err) {
      const msg = err?.message || '번역 중 오류가 발생했습니다.';
      const isLimit = err?.code === 'resource-exhausted';
      resultEl.innerHTML = `<div style="padding:18px;border-radius:14px;border:1.5px solid var(--border);background:var(--navy-card);">
        <p style="font-size:13.5px;line-height:1.7;margin:0;">${isLimit ? '⏰ ' : '😵 '}${escapeHtml(msg)}</p>
      </div>`;
    } finally {
      goBtn.disabled = false;
    }
  }

  goBtn.addEventListener('click', go);
  textEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go();
  });
}
