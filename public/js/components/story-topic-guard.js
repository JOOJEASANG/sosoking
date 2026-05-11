const LEGACY_TOPIC_TITLES = new Set([
  '카톡 읽씹 3시간 사건','단답형 답장 성의 부족 사건','단톡방 공지 미확인 사건','새벽 카톡 알림 사건','이모티콘만 보내기 사건','프로필뮤직 저격 의심 사건',
  '치킨 마지막 조각 사건','감자튀김 하나만 사건','메뉴 아무거나 사건','배달팁 나누기 사건','맵찔이 메뉴 강행 사건','남은 피자 포장 독점 사건',
  '더치페이 100원 정산 사건','커피값 다음에 낼게 사건','생일선물 n분의1 사건','택시비 경유지 정산 사건','OTT 계정 공유 요금 사건','쿠폰 할인 누구 몫 사건',
  '데이트 10분 지각 사건','사진 못 찍어준 사건','데이트 메뉴 결정 회피 사건','기념일 기억 착오 사건','SNS 좋아요 오해 사건','답장 속도 온도차 사건',
  '약속 5분 지각 사건','비밀 이야기 전달 사건','계획만 세우고 취소 사건','빌린 물건 늦게 돌려준 사건','단체 약속 장소 독단 결정 사건','게임 중 잠수 사건',
  '사무실 에어컨 온도 사건','점심 메뉴 강제 동행 사건','퇴근 후 메신저 사건','공용 간식 마지막 개봉 사건','회의실 뒷정리 사건','프린터 용지 보충 회피 사건',
  '냉장고 음료 무단 개봉 사건','세탁기 빨래 방치 사건','밤 11시 청소기 사건','택배 대신 받아주기 사건','설거지 내일 할게 사건','와이파이 비밀번호 공유 사건',
  '리모컨 독점 사건','냉장고 간식 이름표 사건','방 불 끄기 책임 사건','배달음식 선택권 사건','충전기 가져가기 사건','쓰레기 버리기 순번 사건',
  '주차 선 살짝 넘은 사건','엘리베이터 문 닫기 사건','분리수거 날짜 착각 사건','문앞 배달봉투 통로 점령 사건','반려견 짖음 양해 사건','현관 앞 신발장 확장 사건',
  '드라마 스포일러 사건','플레이리스트 강제 변경 사건','단체사진 보정 독점 사건','콘서트 티켓 양도 우선권 사건','보드게임 룰 해석 사건','못 나온 사진 삭제 요구 사건'
]);

let observer = null;
let timer = null;

function bootStoryTopicGuard() {
  runGuard();
  window.addEventListener('hashchange', runGuard);
  if (!observer) {
    observer = new MutationObserver(scheduleGuard);
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
  }
}

function scheduleGuard() {
  clearTimeout(timer);
  timer = setTimeout(runGuard, 120);
}

function runGuard() {
  if (String(location.hash || '') !== '#/topics') return;
  const list = document.getElementById('topics-list');
  if (!list) return;

  const cards = [...list.querySelectorAll('.case-door-card')];
  let hidden = 0;
  cards.forEach(card => {
    const title = card.querySelector('.case-door-title')?.textContent?.trim() || '';
    const isStory = card.classList.contains('story-case-card');
    if (!isStory && LEGACY_TOPIC_TITLES.has(title)) {
      card.remove();
      hidden += 1;
    }
  });

  if (hidden > 0) {
    const notice = document.querySelector('.official-pack-banner small');
    if (notice) notice.textContent = '기존 단순 사건은 숨기고, 스토리형 사건과 직접 접수한 사건만 보여줍니다.';
  }
}

bootStoryTopicGuard();
