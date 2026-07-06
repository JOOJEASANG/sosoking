import { setMeta } from '../utils/seo.js';

function featureCard(icon, title, desc) {
  return `
    <div style="padding:14px;border-radius:18px;border:1px solid rgba(148,163,184,.26);background:rgba(255,255,255,.68)">
      <div style="font-size:24px;margin-bottom:8px">${icon}</div>
      <div style="font-size:15px;font-weight:950;color:var(--color-text-primary);margin-bottom:5px">${title}</div>
      <div style="font-size:12px;color:var(--color-text-secondary);line-height:1.55">${desc}</div>
    </div>`;
}

export async function renderCharacterGames() {
  setMeta('추리방', '방을 만들어 접속해서 플레이하는 소소킹 AI 캐릭터 추리방');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div id="character-game-root" class="page-enter" style="max-width:1040px;margin:0 auto;padding:4px 0 22px">
      <section style="padding:22px;border-radius:24px;background:linear-gradient(135deg,rgba(17,24,39,.10),rgba(99,102,241,.10),rgba(236,72,153,.06));border:1px solid rgba(148,163,184,.28);margin-bottom:14px">
        <div style="font-size:13px;font-weight:950;color:var(--color-primary);margin-bottom:6px">🕵️ SOSOKING SHADOW ROOM</div>
        <h1 style="margin:0;font-size:clamp(25px,4vw,36px);line-height:1.18;color:var(--color-text-primary)">소소킹 추리방</h1>
        <p style="margin:9px 0 0;font-size:14px;color:var(--color-text-secondary);line-height:1.7;max-width:760px">
          이제 게임은 모두 방을 만들어 접속하는 방식으로만 진행됩니다. 단서가 너무 노골적인 쉬움·보통·어려움 미니게임은 제거하고, 역할을 숨긴 상태에서 밤 행동·낮 토론·투표로 추리하는 방식에 집중합니다.
        </p>
      </section>

      <section class="card" style="margin-bottom:14px">
        <div class="card__body">
          <div style="font-size:16px;font-weight:950;color:var(--color-text-primary);margin-bottom:10px">게임 방식</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
            ${featureCard('🚪', '방 생성 후 접속', '혼자방이든 친구 초대방이든 반드시 방을 만든 뒤 해당 방에서 게임이 시작됩니다.')}
            ${featureCard('🎭', '역할 비공개', '그림자·조사자·보호자·시민 역할은 서버에서 배정되고 각자 자기 역할만 확인합니다.')}
            ${featureCard('🌙', '밤 행동', '그림자, 조사자, 보호자가 각자 비공개 행동을 선택합니다. 시민은 아침을 기다립니다.')}
            ${featureCard('💬', '낮 토론', '운영봇 결과와 AI 캐릭터 발언을 보고 토론한 뒤 의심 대상을 정합니다.')}
            ${featureCard('🗳️', '투표 집계', '방장이 투표를 열고 집계하면 가장 많이 지목된 참가자가 탈락합니다.')}
            ${featureCard('🏁', '결과 리포트', '승패가 나면 숨은 그림자와 각 역할이 공개되어 결과를 확인합니다.')}
          </div>
        </div>
      </section>
    </div>`;

  window.dispatchEvent(new CustomEvent('sosoking:game-room-page-ready'));
}
