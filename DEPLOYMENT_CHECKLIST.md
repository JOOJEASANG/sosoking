# 소소킹 배포 체크리스트

이 문서는 운영 안정화 패치 이후 배포와 확인 순서를 정리합니다.

## 1. 배포 전 확인

```bash
firebase use sosoking-481e6
firebase deploy --only functions,hosting
```

Functions와 Hosting을 함께 배포해야 관리자 도구와 새 Callable 함수가 동시에 적용됩니다.

## 2. 배포 직후 관리자 점검

관리자 페이지 접속 후 `AI 설정` 탭에서 아래 순서대로 실행합니다.

1. `멈춘 재판 복구`
   - 10분 이상 `processing` 상태에 머문 사건을 복구합니다.
   - 결과가 이미 있으면 완료 처리하고, 결과가 없으면 다시 pending으로 돌립니다.

2. `최근 투표·댓글 카운트 보정`
   - 최근 판결문 최대 300건의 투표/댓글 카운트를 다시 계산합니다.
   - 게시판 랭킹과 표시 카운트가 기존 데이터와 맞도록 정리합니다.

3. `오늘의 AI 판결기록 지금 생성`
   - 오늘 날짜의 자동 AI 판결문 생성/복구를 확인합니다.

## 3. 사용자 기능 테스트

아래 기능을 실제 계정으로 한 번씩 확인합니다.

- 로그인 후 황당사건 접수
- 관리자 설정의 일일 접수 한도 반영 여부
- 중대한 사건 키워드 서버 차단 여부
- 판결 생성 완료 후 결과 페이지 이동
- 공개/비공개 전환
- 공개 판결문에서 투표 반영
- 댓글 작성 후 게시판 카운트 반영
- 관리자 사건 삭제 시 사건/판결/투표/댓글/신고 완전삭제

## 4. Firestore 확인 포인트

- `cases/{caseId}.status`가 `pending`, `processing`, `completed`, `error` 중 정상 상태인지 확인
- `results/{caseId}.reactionTotal`, `totalVotes`, `commentCount`가 표시값과 맞는지 확인
- `rate_limits/{uid}.count`가 관리자 설정 `dailyLimit`와 맞게 제한되는지 확인
- `usage_stats/daily_YYYY-MM-DD`가 생성량과 토큰 사용량을 기록하는지 확인

## 5. 문제가 생겼을 때

- 판결 생성 중 멈춤: 관리자 AI 탭에서 `멈춘 재판 복구` 실행
- 게시판 인기순/댓글 수 이상: 관리자 AI 탭에서 `최근 투표·댓글 카운트 보정` 실행
- 특정 사건 삭제 잔여 데이터 의심: 관리자 기록 탭에서 삭제 버튼으로 다시 완전삭제 실행
- Functions 호출 오류: Firebase Console > Functions 로그에서 `recoverStaleTrials`, `repairSocialCounters`, `submitCase`, `generateTrial` 로그 확인
