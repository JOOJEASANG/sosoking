# 소소킹 황당재판소

일상의 사소하고 억울한 사건을 AI가 분석하고 맞춤형 황당판결로 만드는 오락형 웹 서비스입니다.

## 운영 기능

- Google·이메일 로그인과 안전한 사건 접수
- Gemini 판결 생성, 품질검사, 재작성, 로컬 대체 판결
- 단계별 재판 연출과 모바일 판결 결과
- 링크 공유와 판결 PNG 저장
- 내 사건 목록, 공개 전환, 삭제
- 공개 재판 게시판, 이번 주 소소킹, 반응, 댓글, 신고
- 관리자 통계, 신고 검토, 판결 숨김·기각·복구
- 비공개 원본 판결과 공개용 안전 판결 문서 분리
- 캐시·오프라인·오류 안내와 검색엔진 기본 설정

## 화면 경로

- `#/` 홈
- `#/login` 로그인
- `#/submit` 사건 접수
- `#/trial/{caseId}` AI 재판
- `#/result/{caseId}` 판결 결과
- `#/my-cases` 내 사건
- `#/board` 공개 재판
- `#/admin` 관리자

## 데이터 구조

- `cases/{caseId}` 사건과 생성 상태
- `results/{caseId}` 작성자 전용 원본 판결
- `public_results/{caseId}` 공개 화면에 필요한 필드만 포함한 안전 문서
- `result_reactions`, `court_comments`, `reports` 커뮤니티 데이터

핵심 문서의 생성·수정·삭제는 클라이언트에서 직접 할 수 없으며 Callable Functions에서 인증과 소유권을 다시 확인합니다.

## 주요 Functions

- `createCaseDraft`, `generateJudgment`
- `updateCaseVisibility`, `deleteMyCase`
- `toggleReaction`, `addCourtComment`, `deleteCourtComment`, `reportPublicCase`
- `getAdminDashboard`, `moderateReport`
- `syncPublicResult`, `backfillPublicResults`

## 설정

GitHub Actions Secret:

- `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`

Firebase Secret Manager:

- `GEMINI_API_KEY`

실제 Secret 값은 저장소에 포함하지 않습니다.

## 검증과 배포

```bash
npm install --prefix functions
npm run check --prefix functions
```

`main` 병합 시 GitHub Actions가 1~8단계 회귀검사 후 Functions, Firestore Rules·Indexes, Hosting을 배포합니다.

기존 공개 판결은 관리자 화면에서 **공개 데이터 동기화**를 한 번 실행합니다. 이후에는 자동 동기화됩니다.
