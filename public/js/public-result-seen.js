// 서버 렌더링된 공개 판결문(/result/<caseId>)을 열면 그 사건을 민심소 '본 사건'
// 목록에 추가한다.
//
// 민심소(가려진 판결 맞히기)와 판결기록/공유 링크(판결 전문 읽기)는 같은 공개
// 사건 풀을 쓴다. SPA에서 판결문을 열면 result.js가 markJurySeen을 부르지만,
// 검색·공유로 들어와 canonical /result/<caseId> 정적 페이지에서 전문을 읽은
// 사건은 그 경로를 타지 않아 민심소에 다시 나온다. 이 스크립트가 그 경로를 메운다.
//
// CSP(script-src 'self')에 막히지 않도록 인라인이 아니라 동일 출처 외부
// 스크립트로 싣는다. jury-seen.js와 키·상한·중복처리 규칙을 똑같이 맞춘다.

(function () {
  'use strict';

  var SEEN_KEY = 'sosoking-jury-seen';
  var SEEN_LIMIT = 400;
  var ID_PATTERN = /^[A-Za-z0-9_-]{1,180}$/;

  function currentCaseId() {
    var match = String(location.pathname || '').match(/\/result\/([^/?#]+)/);
    if (!match) return '';
    var decoded;
    try {
      decoded = decodeURIComponent(match[1]);
    } catch (error) {
      return '';
    }
    return ID_PATTERN.test(decoded) ? decoded : '';
  }

  function markSeen(caseId) {
    if (!caseId) return;
    try {
      var seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      if (!Array.isArray(seen)) seen = [];
      if (seen.indexOf(caseId) !== -1) return;
      seen.push(caseId);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-SEEN_LIMIT)));
    } catch (error) {
      /* 저장이 막힌 브라우저에서도 판결문 열람은 계속 동작해야 한다. */
    }
  }

  markSeen(currentCaseId());
})();
