import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

// Authored comedy, never real votes or generated AI verdicts.
export const QUICK_CASES = [
  ['🍗', '마지막 치킨의 행방', '배 안 고프다던 친구가 마지막 치킨을 먹었다. 친구는 “배가 아니라 입이 심심했다”고 주장한다.', ['입과 위의 분리경영은 인정하지 않는다. 다음 치킨은 피고가 주문하라.', '마지막 조각에 이름이 없었다. 원고는 다음부터 치킨에 출석부를 붙여라.', '먹은 자와 방심한 자, 다음 치킨은 반반 결제. 맛도 반반.']],
  ['📱', '답장은 없고 릴스는 온다', '내 질문에는 6시간째 답이 없는데 웃긴 영상은 8개 보냈다. 피고는 “그게 내 애정 표현”이라고 한다.', ['영상 전송 능력이 있으므로 답장 능력도 인정된다. “ㅋㅋ” 말고 문장으로 답하라.', '릴스 8개는 디지털 꽃다발이다. 다만 꽃다발에 답장도 동봉하라.', '원고는 질문을 릴스로 제작하고 피고는 댓글로 답하라. 통신 방식 조정 완료.']],
  ['🍟', '한 입의 기준', '한 입만 달라던 친구가 햄버거의 절반을 먹었다. “나는 원래 입이 크다”는 해명이다.', ['한 입을 빙자한 지분 인수다. 감자튀김 전량 양도를 명한다.', '입 크기 사전 고지가 없었다. 다음부터 한 입의 단위를 그램으로 정하라.', '남은 절반도 반으로 나누고 우정의 크기를 재측정하라.']],
  ['⏰', '지금 나왔어의 비밀', '약속에 늦은 친구가 “지금 나왔어”라고 했는데 알고 보니 이불에서 나왔다는 뜻이었다.', ['이불은 출발지가 아니다. 도착 전까지 위치 대신 발걸음 소리를 보고하라.', '목적어가 생략된 문장이다. 다음 질문은 “현관문 밖이니?”로 구체화하라.', '친구는 커피를 사고 원고는 이불 밖 진출을 축하하라.']],
  ['🔌', '충전기 장기 입주', '하루만 빌린 충전기가 친구 집에서 3주째 살고 있다. 친구는 “이미 우리 집에 적응했다”고 한다.', ['충전기의 전입신고는 무효다. 케이블을 원래 주인의 품으로 송환하라.', '3주간 반환 요청을 못 들었다. 오늘부터 정확한 퇴거일을 통보하라.', '충전기는 귀가하고 친구는 보조배터리와 새 인연을 시작하라.']],
  ['🍜', '한 젓가락의 참사', '라면 한 젓가락만 먹겠다더니 면을 전부 들어 올렸다. 피고는 “젓가락질은 한 번이었다”고 한다.', ['횟수가 아닌 양의 문제다. 새 라면을 끓여 원고 앞에 봉헌하라.', '한 젓가락 상한선이 없었다. 다음 계약에는 면발 수를 명시하라.', '남은 국물에 밥을 말아 함께 먹고 젓가락 대신 집게 사용을 금한다.']],
  ['❄️', '에어컨 온도 전쟁', '한 명은 18도, 한 명은 28도를 주장한다. 리모컨은 현재 베개 아래 은닉되어 있다.', ['리모컨 은닉은 협상 방해다. 담요와 함께 협상 테이블에 제출하라.', '더운 사람은 피부를 벗을 수 없다. 추운 사람에게 담요 우선권을 준다.', '23도에서 휴전하고 선풍기는 각자 관리한다. 평화 비용은 반반.']],
  ['📸', '음식보다 먼저 먹는 카메라', '음식 사진을 찍느라 5분 동안 못 먹게 했다. 정작 사진은 흔들려서 다시 찍자고 한다.', ['음식의 온도에도 인권… 아니 식권이 있다. 촬영은 10초 내 종료하라.', '추억도 식사의 일부다. 단, 첫 사진 이후에는 먹는 손을 막을 수 없다.', '원고는 먹고 피고는 생동감 있는 식사 다큐멘터리를 촬영하라.']],
  ['🎵', '후렴만 무한 반복', '친구가 노래 한 소절만 40분째 부른다. 다음 가사는 모른다고 한다.', ['후렴구에 갇힌 원고를 석방한다. 피고는 이어폰 안에서 단독 공연하라.', '무료 공연에 대한 과도한 항의다. 대신 다음 곡 요청권을 부여한다.', '함께 다음 가사를 검색하고 완곡 후 콘서트를 종료하라.']],
  ['🛒', '무료배송의 역설', '배송비 3천 원을 아끼려고 필요 없는 물건 2만 원어치를 더 샀다. “1만 7천 원 손해”라는 지적에 서운해한다.', ['배송비는 사라졌지만 통장도 울고 있다. 장바구니에 하루 숙성 기간을 둬라.', '택배를 여는 기쁨도 있다. 단, 절약했다고 발표하지는 말라.', '계산기는 원고가, 반품 접수는 피고가 맡는다. 다음 구매는 공동 심의.']]
];

const TYPES = [
  ['🔨', '원칙 철벽 판사', '사소해도 선은 지킨다. 당신 앞에서 “한 입만”은 정식 계약입니다.'],
  ['🕊️', '반전 변호 판사', '모두가 유죄라고 할 때 한 번 더 듣는 당신. 핑계 속 사정까지 발견합니다.'],
  ['🤝', '평화 협상 판사', '판결보다 중요한 건 다음 치킨을 함께 먹는 일. 화해에도 드립은 필수입니다.']
];

export function makeDeck(random = Math.random) {
  const deck = QUICK_CASES.map((_, index) => index);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, 5);
}

export function judgeType(choices) {
  const counts = [0, 0, 0];
  choices.forEach(choice => { if (Number.isInteger(choice) && choice >= 0 && choice < 3) counts[choice]++; });
  const maximum = Math.max(...counts);
  // A split vote resolves toward the last expressed preference.
  return [...choices].reverse().find(choice => counts[choice] === maximum) ?? 2;
}

export function mountQuickCourt(host) {
  if (!host) return;
  let deck = makeDeck();
  let choices = [];
  let revealed = false;
  let started = false;

  const draw = (focus = false) => {
    const finished = choices.length === 5 && !revealed;
    const current = QUICK_CASES[deck[Math.min(choices.length - (revealed ? 1 : 0), 4)]];
    const [icon, title, description] = TYPES[judgeType(choices)];
    host.innerHTML = `<div class="qc-topline"><span>소소킹 체험 법정</span><span>로그인 없이 · 5문제</span></div>
      ${finished ? `
        <div class="qc-emoji" aria-hidden="true">${icon}</div>
        <p class="qc-eyebrow">5건 심리 완료 · 나의 판사 유형</p>
        <h2 tabindex="-1">${title}</h2><p class="qc-story">${description}</p>
        <div class="qc-tally">원고 승 ${choices.filter(x => x === 0).length} · 피고 승 ${choices.filter(x => x === 1).length} · 쌍방 과실 ${choices.filter(x => x === 2).length}</div>
        <div class="qc-actions"><button type="button" class="qc-primary" data-qc="share">친구에게 판사 유형 공유 ↗</button><button type="button" data-qc="restart">다른 사건으로 한 판 더</button></div>
        <p class="qc-status" role="status"></p>
        <a class="qc-real" href="#/jury">이제 실제 공개 사건 판정하러 가기 →</a>
      ` : `
        <p class="qc-eyebrow">${started ? `사건 ${Math.min(choices.length + (revealed ? 0 : 1), 5)} / 5` : '30초 과몰입 재판 · 정답은 없습니다'}</p>
        <h2 tabindex="-1">${started ? current[1] : '이 정도면… 유죄 아닌가요?'}</h2>
        <div class="qc-progress" aria-label="${choices.length}건 판정 완료">${deck.map((_, i) => `<span class="${i < choices.length ? 'is-done' : ''}"></span>`).join('')}</div>
        <div class="qc-case"><div class="qc-emoji" aria-hidden="true">${current[0]}</div><p class="qc-story">${escapeHtml(current[2])}</p></div>
        ${revealed ? `<div class="qc-verdict" role="status"><strong>땅땅땅! 당신의 판결</strong><p>${escapeHtml(current[3][choices.at(-1)])}</p></div><button type="button" class="qc-primary" data-qc="next">${choices.length === 5 ? '내 판사 유형 확인하기' : '다음 사건 주세요'} →</button>` : `<p class="qc-question">당신이 판사라면?</p><div class="qc-votes">${['원고 승 🔨', '피고 승 🕊️', '쌍방 과실 🤝'].map((label, i) => `<button type="button" data-vote="${i}">${label}</button>`).join('')}</div>`}
      `}
      <p class="qc-note">미리 작성된 가상 사건 · 재미로 보는 유형 · 실제 AI 판결·민심 투표와 별개</p>`;
    if (focus) host.querySelector('h2')?.focus({ preventScroll: true });
    host.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', () => {
      if (revealed || choices.length >= 5) return;
      started = true;
      choices.push(Number(button.dataset.vote));
      revealed = true;
      draw(true);
    }));
    host.querySelector('[data-qc="next"]')?.addEventListener('click', () => { revealed = false; draw(true); });
    host.querySelector('[data-qc="restart"]')?.addEventListener('click', () => { deck = makeDeck(); choices = []; revealed = false; started = false; draw(true); });
    host.querySelector('[data-qc="share"]')?.addEventListener('click', async () => {
      const text = `소소킹 30초 과몰입 재판에서 나는 ${title}! ${description}`;
      const url = `${location.origin}/#/`;
      const status = host.querySelector('.qc-status');
      try {
        if (navigator.share) await navigator.share({ title: '소소킹 · 나의 판사 유형', text, url });
        else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(`${text}\n${url}`);
          status.textContent = '결과와 링크를 복사했어요. 친구에게 붙여넣어 주세요!';
        } else status.textContent = `${text} ${url}`;
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = `아래 내용을 복사해 주세요: ${text} ${url}`;
      }
    });
  };
  draw();
}
