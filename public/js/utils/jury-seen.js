// 민심소에서 '이미 본 사건'을 이 브라우저에 기억한다.
//
// 민심소(가려진 판결 맞히기)와 판결기록(판결 전문 읽기)은 같은 공개 사건 풀을
// 쓴다. 판결기록에서 판결을 읽어버린 사건이 민심소에 또 나오면 이미 답을 알아
// 재미가 없다. 그래서 '민심소에서 투표한 사건'과 '판결문 전문을 연 사건'을
// 같은 목록에 모아, 민심소가 둘 다 건너뛰게 한다.

const SEEN_KEY = 'sosoking-jury-seen';
const SEEN_LIMIT = 400;

export function jurySeenSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function markJurySeen(caseId) {
  if (!caseId) return;
  try {
    const seen = jurySeenSet();
    if (seen.has(caseId)) return;
    const list = [...seen, caseId].slice(-SEEN_LIMIT);
    localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    /* 저장이 막힌 브라우저에서도 다른 기능은 계속 동작해야 한다. */
  }
}
