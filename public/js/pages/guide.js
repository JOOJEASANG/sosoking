import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const JUDGE_TYPES = [
  { icon: '👨‍⚖️', name: '엄벌주의형', desc: '카톡 읽씹도 중범죄 수준으로 처리합니다', color: '#c0392b' },
  { icon: '🥹', name: '감성형', desc: '눈물을 닦으며 양측 모두에게 깊이 공감합니다', color: '#8e44ad' },
  { icon: '🤦', name: '현실주의형', desc: '"그래서 어쩌라고요" — 냉소적 직격 판결', color: '#7f8c8d' },
  { icon: '🔥', name: '과몰입형', desc: '사소한 사건을 인류 역사의 정점으로 취급합니다', color: '#e67e22' },
  { icon: '😴', name: '피곤형', desc: '빨리 끝내고 퇴근하고 싶은 번아웃 판사', color: '#95a5a6' },
  { icon: '🧮', name: '논리집착형', desc: '모든 걸 수치화하는 논리 괴물. 감정은 변수가 아닙니다', color: '#2980b9' },
  { icon: '🎭', name: '드립형', desc: '진지한 척하다 절묘한 타이밍에 드립을 날립니다', color: '#27ae60' },
];

export async function renderGuide(container) {
  let sessionLimit = 2, aiSessionLimit = 5, topicLimit = 5;
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (snap.exists()) {
      const d = snap.data();
      sessionLimit = d.dailySessionLimit ?? 2;
      aiSessionLimit = d.dailyAiSessionLimit ?? 5;
      topicLimit = d.dailyTopicLimit ?? 5;
    }
  } catch {}

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">👑 이용 안내</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">

        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:52px;margin-bottom:12px;animation:crownBounce 2s ease-in-out infinite;display:inline-block;">👑</div>
          <div style="font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--lime);margin-bottom:6px;">소소킹 게임 가이드</div>
          <div style="font-size:13px;color:var(--text-dim);">세 가지 병맛 AI 게임을 즐기는 방법</div>
        </div>

        <!-- 게임 1: 사소한 재판 -->
        <div style="font-size:11px;font-weight:700;color:var(--court);letter-spacing:.08em;margin-bottom:12px;">⚖️ 게임 1 — 사소한 재판</div>
        <div class="card" style="border-color:rgba(168,85,247,0.3);background:rgba(168,85,247,0.05);margin-bottom:8px;">
          <div style="font-size:13px;color:var(--text-dim);line-height:1.8;margin-bottom:12px;">
            일상의 억울한 사건을 AI 판사에게 맡기세요.<br>
            친구·랜덤 상대·AI 소소봇과 주장을 주고받고, 마지막에 판결을 받습니다.
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${[
              ['⚖️', '사건 고르기', '공감 100% 사건 목록에서 하나를 선택하거나 직접 등록'],
              ['🙋', '입장 선택', '원고(주장) 또는 피고(반박) 편 선택'],
              ['🎮', '대결 방식', '👫 친구 초대 · 🎲 랜덤 매칭 · 🤖 AI 소소봇'],
              ['💬', '토론', '3·5·7 라운드 중 선택, 번갈아 주장'],
              ['🏛️', 'AI 판결', '7가지 성향 판사 중 랜덤 배정 — 논리가 부족하면 진짜 집니다 ㅋ'],
            ].map(([icon, title, desc]) => `
              <div style="display:flex;gap:10px;align-items:flex-start;">
                <span style="font-size:16px;flex-shrink:0;">${icon}</span>
                <div>
                  <div style="font-weight:700;font-size:13px;color:var(--court);">${title}</div>
                  <div style="font-size:12px;color:var(--text-dim);line-height:1.6;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- 판사 유형 -->
        <div style="font-size:11px;font-weight:700;color:var(--court);letter-spacing:.08em;margin:20px 0 10px;">👨‍⚖️ 랜덤 판사 7가지 유형</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;line-height:1.7;">
          매 재판마다 판사가 랜덤 배정됩니다. 같은 사건도 판사 성향에 따라 판결 톤이 완전히 달라지니 여러 번 해보세요 😄
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:28px;">
          ${JUDGE_TYPES.map(j => `
            <div style="padding:12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
              <div style="font-size:20px;margin-bottom:4px;">${j.icon}</div>
              <div style="font-size:12px;font-weight:700;color:${j.color};margin-bottom:3px;">${j.name}</div>
              <div style="font-size:11px;color:var(--text-dim);line-height:1.5;">${j.desc}</div>
            </div>`).join('')}
        </div>

        <!-- 게임 2: 소소뉴스 -->
        <div style="font-size:11px;font-weight:700;color:var(--news);letter-spacing:.08em;margin-bottom:12px;">📺 게임 2 — 소소뉴스</div>
        <div class="card" style="border-color:rgba(251,146,60,0.3);background:rgba(251,146,60,0.05);margin-bottom:28px;">
          <div style="font-size:13px;color:var(--text-dim);line-height:1.8;margin-bottom:12px;">
            오늘 있었던 아주 사소한 일을 입력하면<br>AI 앵커가 <strong style="color:var(--news);">긴급 속보</strong>로 보도해드립니다.
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${[
              ['📢', '사소한 사건 입력', '라면 노른자 터뜨림, 방귀 들킴 등 일상 소식 (100자)'],
              ['🎙️', '채널 선택', 'CNN 코리아 / MBC 뉴스데스크 / 유튜브 생방송'],
              ['📡', '긴급 보도', 'AI 앵커가 헤드라인·기사·앵커멘트 생성'],
              ['📤', '친구 공유', '링크로 친구에게 보내서 같이 웃기'],
            ].map(([icon, title, desc]) => `
              <div style="display:flex;gap:10px;align-items:flex-start;">
                <span style="font-size:16px;flex-shrink:0;">${icon}</span>
                <div>
                  <div style="font-weight:700;font-size:13px;color:var(--news);">${title}</div>
                  <div style="font-size:12px;color:var(--text-dim);line-height:1.6;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- 게임 3: 악마와의 거래 -->
        <div style="font-size:11px;font-weight:700;color:var(--devil);letter-spacing:.08em;margin-bottom:12px;">😈 게임 3 — 악마와의 거래</div>
        <div class="card" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.05);margin-bottom:28px;">
          <div style="font-size:13px;color:var(--text-dim);line-height:1.8;margin-bottom:12px;">
            소원 하나를 말하면 악마가 황당한 조건 3가지를 제안합니다.<br>
            친구들과 투표해서 <strong style="color:var(--devil);">어떤 조건이 제일 나쁜지</strong> 골라보세요.
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${[
              ['🕯️', '소원 입력', '이루어졌으면 하는 소원을 입력 (80자)'],
              ['😈', '악마 협상', 'AI 악마가 비틀린 조건 3가지 생성'],
              ['🗳️', '조건 투표', '친구들과 링크 공유 → 어떤 조건이 제일 괴로운지 투표'],
            ].map(([icon, title, desc]) => `
              <div style="display:flex;gap:10px;align-items:flex-start;">
                <span style="font-size:16px;flex-shrink:0;">${icon}</span>
                <div>
                  <div style="font-weight:700;font-size:13px;color:var(--devil);">${title}</div>
                  <div style="font-size:12px;color:var(--text-dim);line-height:1.6;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- FAQ -->
        <div style="font-size:11px;font-weight:700;color:var(--lime);letter-spacing:.08em;margin-bottom:16px;">❓ 자주 묻는 질문</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:36px;">
          ${[
            ['진짜 법원이에요?', '아니요. 순수 오락 서비스입니다. AI 판사가 생성한 판결문에는 어떠한 법적 효력도 없습니다.'],
            ['가입 없이 이용할 수 있나요?', '네! 닉네임+4자리 PIN으로 바로 가입 가능하고, 링크를 받은 친구는 가입 없이 바로 재판에 참가할 수 있어요.'],
            ['1인도 할 수 있나요?', '네! AI 소소봇 기능으로 혼자서 즉시 시작할 수 있습니다. 소소뉴스와 악마와의 거래는 완전 혼자도 됩니다.'],
            ['모르는 사람과도 할 수 있나요?', '재판만 가능해요! 랜덤 매칭을 선택하면 같은 주제 대기자와 자동 연결됩니다.'],
            ['하루에 몇 번 할 수 있나요?', `친구·랜덤 재판은 하루 ${sessionLimit}회, AI 소소봇 재판은 하루 ${aiSessionLimit}회 가능합니다.`],
            ['직접 사건을 등록할 수 있나요?', `네! ⚖️ 재판 탭에서 등록하면 즉시 공개됩니다. 하루 ${topicLimit}회까지 가능합니다.`],
            ['개인정보 수집하나요?', '닉네임과 PIN만 저장됩니다. 이메일·이름·연락처는 절대 수집하지 않습니다.'],
          ].map(([q, a]) => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
              <summary style="padding:14px 16px;font-weight:700;font-size:13px;color:var(--text);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                Q. ${q}
                <span style="color:var(--lime);font-size:16px;">+</span>
              </summary>
              <div style="padding:0 16px 14px;font-size:13px;color:var(--text-dim);line-height:1.7;border-top:1px solid var(--border);margin-top:0;padding-top:12px;">
                A. ${a}
              </div>
            </details>`).join('')}
        </div>

        <!-- 면책 -->
        <div class="disclaimer" style="margin-bottom:24px;">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹은 AI 기반 오락 서비스입니다. 생성된 판결문·뉴스·거래 조건은 실제 법률 자문이 아니며 어떠한 효력도 없습니다.
        </div>

        <a href="#/" class="btn btn-primary" style="background:var(--lime);color:#0d1117;">👑 게임 시작하러 가기</a>
      </div>
    </div>`;
}
