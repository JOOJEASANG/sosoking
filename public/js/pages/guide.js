import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const JUDGE_TYPES = [
  { icon: '👨‍⚖️', name: '엄벌주의형', desc: '카톡 읽씹도 중범죄로 판정하는 강경 심판', color: '#c0392b' },
  { icon: '🥹', name: '감성형', desc: '눈물을 닦으며 양측 모두에게 깊이 공감합니다', color: '#8e44ad' },
  { icon: '🤦', name: '현실주의형', desc: '"그래서 어쩌라고요" — 냉소적 직격 판정', color: '#7f8c8d' },
  { icon: '🔥', name: '과몰입형', desc: '사소한 주제를 인류 역사의 정점으로 취급합니다', color: '#e67e22' },
  { icon: '😴', name: '피곤형', desc: '빨리 끝내고 퇴근하고 싶은 번아웃 심판', color: '#95a5a6' },
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
        <span class="logo">📖 이용 안내</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">

        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:48px;margin-bottom:12px;">🥊</div>
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;margin-bottom:6px;">소소킹 토론배틀 사용법</div>
          <div style="font-size:13px;color:var(--cream-dim);">친구와 토론하고 AI 심판에게 공정한 판정을 받으세요.</div>
        </div>

        <!-- 이용 순서 -->
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">🎯 이용 순서</div>
        <div style="display:flex;flex-direction:column;gap:0;margin-bottom:36px;">
          ${[
            ['🔥', '주제 고르기', '카톡 읽씹, 치킨 마지막 조각, 더치페이… 공감 100% 주제 중 하나를 고르거나, 직접 등록하세요.'],
            ['🙋', '입장 선택', 'A팀(주장하는 쪽) 또는 B팀(반박하는 쪽) 중 내 입장을 선택하세요.'],
            ['🎮', '대결 방식 선택', '👫 친구와 대결 — 링크를 보내면 가입 없이 바로 입장\n🎲 랜덤 매칭 — 모르는 사람과 자동 연결\n🤖 AI와 대결 — 소소봇이 상대, 혼자서 즉시 시작'],
            ['💬', '토론 (3·5·7 라운드)', '시작 전 3·5·7 라운드 중 선택합니다. A팀이 먼저 주장하고 B팀이 반박하는 순서로 진행하며, 1라운드 완료 후 언제든 판정 요청 가능합니다.'],
            ['🏆', 'AI 판정', '7가지 중 랜덤 배정된 AI 심판이 논리와 설득력만으로 판정합니다. 억울해도 논리가 부족하면 집니다. 패배 팀에겐 재밌는 미션도 내려지며, 판정 결과를 이미지 카드로 저장·공유할 수 있습니다 😄'],
          ].map(([icon, title, desc], i) => `
            <div style="display:flex;gap:0;align-items:stretch;">
              <div style="display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0;">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#0d1117;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;">${i + 1}</div>
                ${i < 4 ? '<div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(201,168,76,0.4),transparent);margin:4px 0;"></div>' : ''}
              </div>
              <div style="flex:1;padding:0 0 24px 16px;">
                <div style="font-weight:700;font-size:14px;color:var(--gold);margin-bottom:4px;padding-top:8px;">${icon} ${title}</div>
                <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${desc}</div>
              </div>
            </div>`).join('')}
        </div>

        <!-- 심판 유형 -->
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">👨‍⚖️ 랜덤 심판 7가지 유형</div>
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:14px;line-height:1.7;">
          매 배틀마다 심판이 랜덤 배정됩니다. 같은 주제도 심판 성향에 따라 판정 톤이 완전히 달라지니 여러 번 해보세요 😄
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:32px;">
          ${JUDGE_TYPES.map(j => `
            <div style="padding:12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
              <div style="font-size:22px;margin-bottom:5px;">${j.icon}</div>
              <div style="font-size:12px;font-weight:700;color:${j.color};margin-bottom:3px;">${j.name}</div>
              <div style="font-size:11px;color:var(--cream-dim);line-height:1.5;">${j.desc}</div>
            </div>`).join('')}
        </div>

        <!-- FAQ -->
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">❓ 자주 묻는 질문</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:36px;">
          ${[
            ['진짜 법원이에요?', '아니요. 순수 오락 서비스입니다. AI 심판이 생성한 판정문에는 어떠한 법적 효력도 없습니다.'],
            ['친구가 가입해야 하나요?', '아니요. 링크를 받은 친구는 회원가입 없이 바로 참가할 수 있습니다. 가입은 선택 사항이에요.'],
            ['1인도 할 수 있나요?', '네! AI 상대(소소봇) 기능으로 혼자서 즉시 시작할 수 있습니다. 소소봇이 논리적으로 반박해줍니다.'],
            ['모르는 사람과도 할 수 있나요?', '네! 랜덤 매칭을 선택하면 같은 주제 대기자와 자동 연결됩니다. 대기자가 없으면 내가 먼저 기다릴 수 있어요.'],
            ['라운드는 몇 번이나 할 수 있나요?', '시작 전 3·5·7 라운드 중 선택합니다. 1라운드 완료 후 "지금 바로 판정받기"로 조기 판정도 가능합니다.'],
            ['하루에 몇 번 할 수 있나요?', `친구·랜덤 배틀은 하루 ${sessionLimit}회, AI(소소봇) 배틀은 하루 ${aiSessionLimit}회 참여 가능합니다.`],
            ['로그인이 필요한가요?', '아니요. 익명으로 이용 가능합니다. 로그인(구글/이메일)하면 닉네임 설정과 배틀 기록 관리가 더 편리해요.'],
            ['회원 탈퇴하면 어떻게 되나요?', '계정 메뉴 → 회원 탈퇴 시 계정과 모든 배틀 기록이 즉시 영구 삭제됩니다.'],
            ['직접 주제를 등록할 수 있나요?', `네! ✏️ 주제 등록에서 등록하면 즉시 공개됩니다. 링크를 친구에게 보내 바로 배틀을 시작하세요. 하루 ${topicLimit}회까지 등록 가능합니다.`],
            ['다크/라이트 모드를 바꿀 수 있나요?', '네! 하단 내비게이션의 🔓(로그인) 또는 🔐(비로그인) 버튼을 탭하면 나오는 메뉴에서 테마를 변경할 수 있습니다.'],
            ['개인정보 수집하나요?', '익명 이용 시 개인 식별 정보는 수집하지 않습니다. 로그인하면 이메일과 닉네임이 저장됩니다. 이름·연락처·주민번호는 절대 입력하지 마세요.'],
          ].map(([q, a]) => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
              <summary style="padding:14px 16px;font-weight:700;font-size:13px;color:var(--cream);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                Q. ${q}
                <span style="color:var(--gold);font-size:16px;">+</span>
              </summary>
              <div style="padding:0 16px 14px;font-size:13px;color:var(--cream-dim);line-height:1.7;border-top:1px solid var(--border);margin-top:0;padding-top:12px;">
                A. ${a}
              </div>
            </details>`).join('')}
        </div>

        <!-- 면책 -->
        <div class="disclaimer" style="margin-bottom:24px;">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 토론배틀은 AI 기반 오락 서비스입니다. 생성된 판정문은 실제 법률 자문이 아니며 어떠한 법적 효력도 없습니다. 진짜 법적 문제는 실제 전문가에게 문의하세요.
        </div>

        <a href="#/topics" class="btn btn-primary">🔥 배틀 시작하러 가기</a>
      </div>
    </div>`;
}
