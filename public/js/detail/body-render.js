import { escHtml } from '../utils/helpers.js';
import { renderLegacyVoteOptions, renderLegacyBattleVs } from './vote-actions.js';

function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
}

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\s"'<>]/.test(raw)) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (url.protocol === 'http:' && url.hostname !== window.location.hostname && url.hostname !== 'localhost') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function safeImageList(images) {
  return (Array.isArray(images) ? images : []).map(safeImageUrl).filter(Boolean).slice(0, 20);
}

export function renderImageSection(images) {
  const safeImages = safeImageList(images);
  if (!safeImages.length) return '';
  const dataAttr = encodeURIComponent(JSON.stringify(safeImages));
  const visible = safeImages.slice(0, 4);
  const extra = safeImages.length > 4 ? safeImages.length - 4 : 0;
  const cols = Math.min(safeImages.length, 4);
  return `
    <div class="detail-gallery detail-gallery--${cols}" data-images="${escAttr(dataAttr)}">
      ${visible.map((src, i) => `
        <div class="detail-gallery__thumb" data-gallery-idx="${i}">
          <img src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">
          ${i === 3 && extra > 0 ? `<div class="detail-gallery__more">+${extra}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

const AI_KING_AGAIN = {
  ai_judge:     { path: '/ai-judge',     label: '⚖️ 나도 판결받기' },
  ai_translate: { path: '/ai-translate', label: '✨ 나도 번역하기' },
  ai_match:     { path: '/ai-match',     label: '💘 나도 궁합보기' },
  ai_naming:    { path: '/ai-translate', label: '✨ 나도 이름짓기' },
  ai_consult:   { path: '/ai-consult',   label: '💬 나도 상담받기' },
  ai_debate:    { path: '/ai-judge',     label: '⚖️ 나도 캐릭터한테 물어보기' },
};

function renderAiAgainBtn(type) {
  const info = AI_KING_AGAIN[type];
  if (!info) return '';
  return `
    <div class="ai-result-actions">
      <a href="#${info.path}" class="btn btn--primary">${info.label}</a>
      <a href="#/feed?type=${type}" class="btn btn--ghost">다른 결과 보기</a>
    </div>
    <div class="ai-result-share-row">
      <button id="btn-share" class="btn btn--primary btn--sm" style="flex:1;max-width:200px">📤 공유하기</button>
    </div>`;
}

export function renderTypeBody(post) {
  switch (post.type) {
    case 'ai_judge':
      return renderAiJudgeBody(post) + renderAiAgainBtn('ai_judge');
    case 'ai_translate':
      return renderAiTranslateBody(post) + renderAiAgainBtn('ai_translate');
    case 'ai_match':
      return renderAiMatchBody(post) + renderAiAgainBtn('ai_match');
    case 'ai_naming':
      return renderAiNamingBody(post) + renderAiAgainBtn('ai_naming');
    case 'ai_consult':
      return renderAiConsultBody(post) + renderAiAgainBtn('ai_consult');
    case 'ai_debate':
      return renderAiDebateBody(post) + renderAiAgainBtn('ai_debate');
    case 'balance':
    case 'vote':
      if (!post.options?.length) return '';
      return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderLegacyVoteOptions(post)}</div>`;

    case 'battle':
      return renderLegacyBattleVs(post);

    case 'story':
      return post.feeling
        ? `<div style="padding:12px 16px;background:var(--color-malhe-bg);border-left:3px solid var(--color-malhe);border-radius:8px;font-size:13px;margin-top:8px"><strong>💚 느낀 점</strong><br>${escHtml(post.feeling).replace(/\n/g, '<br>')}</div>`
        : '';

    case 'laugh': {
      const diffMap = { easy: '😌 쉬움', normal: '😬 보통', hard: '😤 어려움', extreme: '💀 극한' };
      return post.difficulty
        ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--color-warning-bg);border-radius:var(--radius-pill);font-size:13px;font-weight:700;margin-top:8px">웃참 난이도: ${escHtml(diffMap[post.difficulty] || post.difficulty)}</div>`
        : '';
    }

    case 'howto':
      return renderHowtoBody(post);

    case 'fail':
      return `
        ${post.lesson ? `<div style="padding:12px 16px;background:var(--color-malhe-bg);border-radius:10px;font-size:13px;margin-top:8px"><strong>알게 된 점:</strong> ${escHtml(post.lesson)}</div>` : ''}
        ${post.redo ? `<div style="padding:12px 16px;background:var(--color-golra-bg);border-radius:10px;font-size:13px;margin-top:8px"><strong>다시 한다면:</strong> ${escHtml(post.redo)}</div>` : ''}`;

    default:
      return '';
  }
}

function renderHowtoBody(post) {
  return `
    ${post.summary ? `<div style="padding:12px 16px;background:var(--color-primary-bg);border-radius:10px;font-weight:700;color:var(--color-primary);margin-bottom:12px">💡 ${escHtml(post.summary)}</div>` : ''}
    ${post.materials ? `<div style="font-size:13px;margin-bottom:8px"><strong>준비물:</strong> ${escHtml(post.materials)}</div>` : ''}
    ${post.steps?.length ? `
      <div class="howto-steps-display">
        <div class="howto-steps-display__title">단계별 순서</div>
        ${post.steps.map((step, i) => `
          <div class="howto-step-display">
            <div class="howto-step-display__num">${i + 1}</div>
            <div class="howto-step-display__text">${escHtml(step).replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>` : ''}
    ${post.caution ? `<div style="font-size:13px;color:var(--color-warning);padding:10px 12px;background:var(--color-warning-bg);border-radius:8px;margin-top:8px">⚠️ ${escHtml(post.caution)}</div>` : ''}`;
}

function renderAiJudgeBody(post) {
  const verdicts = Array.isArray(post.verdicts) ? post.verdicts : [];
  return `
    <div class="ai-judge-result">
      <div class="ai-judge-situation">
        <strong>📋 상황</strong><br>
        ${escHtml(post.situation || post.title || '').replace(/\n/g, '<br>')}
      </div>
      <div class="ai-verdict-list">
        ${verdicts.map(v => `
          <div class="ai-verdict-item ai-verdict-item--judge" data-judge="${escHtml(v.charId || v.judgeId || '')}">
            <div class="ai-verdict-judge">${escHtml(v.charName || v.judgeName || '')}</div>
            <div class="ai-verdict-text">${escHtml(v.verdict || '').replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function parseDebateSides(topic) {
  const parts = String(topic || '').split(/ vs /i);
  return {
    sideA: (parts[0] || 'A편').trim(),
    sideB: (parts[1] || 'B편').trim(),
  };
}

function renderAiDebateBody(post) {
  const turns = Array.isArray(post.turns) ? post.turns : [];
  const { sideA, sideB } = parseDebateSides(post.topic || post.title);
  const voteA = Number(post.voteA || 0);
  const voteB = Number(post.voteB || 0);
  const total = voteA + voteB;
  const pctA = total ? Math.round(voteA / total * 100) : 50;
  const pctB = total ? Math.round(voteB / total * 100) : 50;
  const aLabel = total ? `${voteA}표 (${pctA}%)` : '첫 투표!';
  const bLabel = total ? `${voteB}표 (${pctB}%)` : '첫 투표!';

  return `
    <div class="ai-debate-result">
      <div class="ai-debate-topic">
        <span class="ai-debate-topic__label">🗣️ 오늘의 주제</span>
        <span class="ai-debate-topic__text">${escHtml(post.topic || post.title || '').replace(/\n/g, '<br>')}</span>
      </div>
      <div class="ai-debate-thread">
        ${turns.map(t => `
          <div class="ai-debate-turn" data-char="${escHtml(t.charId || '')}">
            <div class="ai-debate-turn__name">${escHtml(t.charName || '')}</div>
            <div class="ai-debate-turn__bubble">${escHtml(t.text || '').replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>
      <div class="ai-debate-foot">누가 이겼을까? 편 들고 댓글 남기기 👇</div>
      <div class="ai-debate-vote" id="debate-vote-area" data-post-id="${escHtml(post.id || '')}">
        <div class="ai-debate-vote__label">어느 편 손을 들어주겠어요?</div>
        <div class="ai-debate-vote__btns">
          <button class="ai-debate-vote-btn" data-side="A">
            <span class="ai-debate-vote-btn__side">🔴 A편</span>
            <span class="ai-debate-vote-btn__text">${escHtml(sideA)}</span>
            <span class="ai-debate-vote-btn__count" id="debate-count-a">${escHtml(aLabel)}</span>
          </button>
          <div class="ai-debate-vote__vs">VS</div>
          <button class="ai-debate-vote-btn ai-debate-vote-btn--b" data-side="B">
            <span class="ai-debate-vote-btn__side">🔵 B편</span>
            <span class="ai-debate-vote-btn__text">${escHtml(sideB)}</span>
            <span class="ai-debate-vote-btn__count" id="debate-count-b">${escHtml(bLabel)}</span>
          </button>
        </div>
        <div class="ai-debate-vote__hint" id="debate-vote-hint">투표하면 댓글을 남길 수 있어요 · 댓글에 AI가 숨어있어요 🤖</div>
      </div>
    </div>`;
}

function renderAiConsultBody(post) {
  const advices = Array.isArray(post.advices) ? post.advices : [];
  return `
    <div class="ai-judge-result">
      <div class="ai-judge-situation">
        <strong>💬 고민</strong><br>
        ${escHtml(post.concern || post.title || '').replace(/\n/g, '<br>')}
      </div>
      <div class="ai-verdict-list">
        ${advices.map(a => `
          <div class="ai-verdict-item ai-verdict-item--consult" data-char="${escHtml(a.charId || '')}">
            <div class="ai-verdict-judge">${escHtml(a.charName || '')}</div>
            <div class="ai-verdict-text">${escHtml(a.advice || '').replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderAiTranslateBody(post) {
  const translations = Array.isArray(post.translations) && post.translations.length
    ? post.translations
    : [{ charId: post.characterId || '', charName: post.styleName || '번역 결과', translated: post.translated || '' }];
  return `
    <div class="ai-translate-result">
      ${post.originalText ? `<div class="ai-translate-original">
        <div class="ai-translate-original__label">원문</div>
        ${escHtml(post.originalText).replace(/\n/g, '<br>')}
      </div>` : ''}
      <div class="ai-verdict-list" style="margin-top:${post.originalText ? '12px' : '0'}">
        ${translations.map(t => `
          <div class="ai-verdict-item ai-verdict-item--judge" data-char="${escHtml(t.charId || '')}">
            <div class="ai-verdict-judge">${escHtml(t.charName || '')} 번역</div>
            <div class="ai-verdict-text">${escHtml(t.translated || '').replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderAiNamingBody(post) {
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  if (Array.isArray(post.namingResults) && post.namingResults.length > 1) {
    return `
      <div class="ai-naming-result">
        ${post.description ? `<div class="ai-judge-situation"><strong>🎭 작명 요청</strong><br>${escHtml(post.description).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="ai-verdict-list" style="margin-top:12px">
          ${post.namingResults.map(r => `
            <div class="ai-verdict-item ai-verdict-item--judge" data-char="${escHtml(r.charId || '')}">
              <div class="ai-verdict-judge">${escHtml(r.charName || '')} 작명</div>
              ${r.names.map((n, i) => `
                <div style="margin-top:8px${i > 0 ? ';border-top:1px solid var(--color-border);padding-top:8px' : ''}">
                  <div style="font-weight:700;color:var(--color-text-primary)">${medals[i] || ''} ${escHtml(n.name || '')}</div>
                  <div class="ai-verdict-text" style="margin-top:3px">${escHtml(n.reason || '').replace(/\n/g, '<br>')}</div>
                </div>`).join('')}
            </div>`).join('')}
        </div>
      </div>`;
  }
  const names = Array.isArray(post.names) ? post.names : [];
  return `
    <div class="ai-naming-result">
      <div class="ai-judge-situation">
        <strong>🎭 작명 요청</strong><br>
        ${escHtml(post.description || post.title || '').replace(/\n/g, '<br>')}
      </div>
      <div class="ai-verdict-list">
        ${names.map((n, i) => `
          <div class="ai-verdict-item">
            <div class="ai-verdict-judge" style="font-size:16px">
              ${medals[i] || ''} ${escHtml(n.name || '')}
            </div>
            <div class="ai-verdict-text">${escHtml(n.reason || '').replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderSingleMatch(post, m) {
  const score = Math.max(0, Math.min(100, parseInt(m.score) || 0));
  return `
    <div class="ai-match-items">
      <span>${escHtml(post.itemA || '')}</span>
      <span class="ai-match-items__vs">💘</span>
      <span>${escHtml(post.itemB || '')}</span>
    </div>
    <div class="ai-match-score-ring" style="--score:${score}">
      <span class="ai-match-score-num">${score}%</span>
    </div>
    <div class="ai-match-grade">${escHtml(m.grade || '')}</div>
    ${m.reason ? `<div class="ai-match-reason"><strong>궁합 분석 🔮</strong><br>${escHtml(m.reason).replace(/\n/g, '<br>')}</div>` : ''}
    ${m.chemistry ? `<div class="ai-match-chemistry"><strong>둘이 만나면? 💥</strong><br>${escHtml(m.chemistry).replace(/\n/g, '<br>')}</div>` : ''}
    ${m.advice ? `<div class="ai-match-advice">💡 ${escHtml(m.advice)}</div>` : ''}`;
}

function renderAiMatchBody(post) {
  if (Array.isArray(post.analyses) && post.analyses.length > 1) {
    return `
      <div class="ai-match-result">
        <div class="ai-match-items">
          <span>${escHtml(post.itemA || '')}</span>
          <span class="ai-match-items__vs">💘</span>
          <span>${escHtml(post.itemB || '')}</span>
        </div>
        <div class="ai-verdict-list" style="margin-top:16px">
          ${post.analyses.map(m => {
            const score = Math.max(0, Math.min(100, parseInt(m.score) || 0));
            return `
              <div class="ai-verdict-item ai-verdict-item--consult" data-char="${escHtml(m.charId || '')}">
                <div class="ai-verdict-judge">${escHtml(m.charName || '')} <span style="font-weight:400;font-size:13px">— ${score}% ${escHtml(m.grade || '')}</span></div>
                ${m.reason ? `<div class="ai-verdict-text" style="margin-top:6px">${escHtml(m.reason).replace(/\n/g, '<br>')}</div>` : ''}
                ${m.chemistry ? `<div class="ai-verdict-text" style="margin-top:6px;color:var(--color-primary)">${escHtml(m.chemistry).replace(/\n/g, '<br>')}</div>` : ''}
                ${m.advice ? `<div style="margin-top:6px;font-size:12px;color:var(--color-warning);font-weight:700">💡 ${escHtml(m.advice)}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  const m = post.matchResult || (Array.isArray(post.analyses) ? post.analyses[0] : null) || {};
  return `<div class="ai-match-result">${renderSingleMatch(post, m)}</div>`;
}

export function renderLegacyInteractive() {
  return '';
}
