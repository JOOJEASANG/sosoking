import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const generateLatestAiCharacterComments = httpsCallable(functions, 'generateLatestAiCharacterComments');
let running = false;

function isAiPanel() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  return !!content.querySelector('#ai-minimal-panel') || content.textContent.includes('AI 관리');
}

function installRepairCard() {
  const panel = document.getElementById('ai-minimal-panel');
  if (!panel || panel.querySelector('#ai-comment-repair-card')) return;
  const card = document.createElement('div');
  card.id = 'ai-comment-repair-card';
  card.className = 'card';
  card.innerHTML = `
    <div class="card__body" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div>
        <div style="font-size:14px;font-weight:900;margin-bottom:5px">AI 캐릭터 댓글 복구</div>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6">가장 최근 커뮤니티 글의 AI 댓글을 본문과 사진 기준으로 다시 생성합니다.</div>
      </div>
      <button class="btn btn--primary btn--sm" id="btn-ai-comment-repair" type="button">최근 글 AI 댓글 생성</button>
      <div id="ai-comment-repair-result" style="width:100%;font-size:12px;color:var(--color-text-muted);display:none"></div>
    </div>`;
  panel.appendChild(card);

  card.querySelector('#btn-ai-comment-repair')?.addEventListener('click', async event => {
    if (running) return;
    const button = event.currentTarget;
    const result = card.querySelector('#ai-comment-repair-result');
    if (!confirm('가장 최근 커뮤니티 글의 기존 AI 댓글을 교체하고 다시 생성할까요?')) return;
    running = true;
    button.disabled = true;
    button.textContent = '댓글 생성 중...';
    if (result) { result.style.display = 'block'; result.textContent = '게시글과 첨부 이미지를 분석하고 있습니다.'; }
    try {
      const response = await generateLatestAiCharacterComments({});
      const data = response.data || {};
      if (result) result.innerHTML = `✅ 댓글 ${Number(data.count || 0)}개 생성 · 방식 ${String(data.source || '-')}${data.imageCount ? ` · 이미지 ${Number(data.imageCount)}장 분석` : ''} · <a href="#/detail/${encodeURIComponent(data.postId || '')}" style="color:var(--color-primary);font-weight:900">글 보기</a>`;
      toast.success(`AI 캐릭터 댓글 ${Number(data.count || 0)}개를 생성했어요`);
    } catch (error) {
      console.error('[ai-comment-repair]', error);
      if (result) result.textContent = `❌ ${error.message || 'AI 댓글 생성에 실패했습니다.'}`;
      toast.error(error.message || 'AI 댓글 생성에 실패했어요');
    } finally {
      running = false;
      button.disabled = false;
      button.textContent = '최근 글 AI 댓글 생성';
    }
  });
}

const observer = new MutationObserver(() => {
  if (isAiPanel()) installRepairCard();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('sosoking:extensions-ready', installRepairCard);
setTimeout(installRepairCard, 500);
