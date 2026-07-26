# 소문난 판결소 배포 체크리스트

운영 사이트를 바로 덮지 않고 Firebase 미리보기 환경에서 먼저 검증합니다.

## 1. 기존 비밀값 확인

기존 저장소에서 사용하던 항목을 그대로 재사용합니다.

- GitHub Secret: `GEMINI_API_KEY`
- GitHub Secret: `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`
- Firebase Secret Manager: `GEMINI_API_KEY`
- Firebase 프로젝트: `sosoking-481e6`

GitHub Actions는 `GEMINI_API_KEY`가 있으면 Firebase Secret Manager에 자동 동기화합니다. GitHub Secret이 비어 있으면 Firebase에 이미 등록된 값을 유지합니다.

키를 저장소 파일이나 브라우저 코드에 직접 작성하지 않습니다.

수동 등록은 기존 Secret이 모두 없는 경우에만 사용합니다.

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

## 2. 함수 의존성 설치

```bash
cd functions
npm install
cd ..
```

## 3. 저장소 검사

```bash
npm test
npm run check
npm run --prefix functions lint
```

반드시 모든 정적 테스트와 문법 검사가 통과해야 합니다.

## 4. Firebase 미리보기 검증

Hosting 미리보기와 Functions를 검증 환경에 배포합니다.

```bash
firebase deploy --only functions:generateCourtCase
firebase hosting:channel:deploy court-preview --expires 7d
```

함수 배포 후 미리보기 주소에서 사건 접수부터 판결 공유까지 직접 확인합니다.

## 5. 대표 사건 20개 자동 평가

```bash
COURT_BASE_URL="미리보기 주소" npm run evaluate
```

확인 항목:

- 20개 사건이 모두 정상 응답하는지
- 사건명이 `사건`으로 끝나는지
- 증거·심문·판결·재판관 성향이 각각 3개인지
- 판결과 후일담이 중복되지 않는지
- 평균 응답 시간이 허용 범위인지
- Gemini 안전 차단과 예비 판례 전환이 정상인지

## 6. 수동 점검

- Android Chrome
- iPhone Safari
- PC Chrome과 Edge
- 긴 사건명에서 카드가 깨지지 않는지
- 결과 카드 PNG 저장 여부
- Web Share 지원 기기에서 이미지 공유 여부
- AI 실패 시 예비 판례 자동 전환 여부
- 심각한 소재와 개인정보 입력 차단 여부
- 양쪽 `소` 인장과 아이콘이 모바일에서 선명한지

## 7. 운영 배포 기준

다음 조건을 모두 충족할 때만 운영 배포합니다.

- 자동 테스트 전부 통과
- 대표 사건 20개 형식 통과율 100%
- 치명적인 안전 필터 누락 없음
- 모바일 핵심 흐름 오류 없음
- Gemini 사용량 제한과 결제 알림 점검 완료
- 기존 운영 사이트 백업 브랜치 확인
- Firebase 릴리스 롤백 지점 확인

## 8. 운영 반영

`rebuild/sosoking-v2`를 `main`에 반영하면 GitHub Actions가 다음 순서로 처리합니다.

1. 정적 검사와 테스트
2. GitHub `GEMINI_API_KEY`를 Firebase Secret Manager에 동기화
3. `generateCourtCase` 함수와 Hosting 배포

직접 배포해야 하는 경우:

```bash
firebase deploy --only functions:generateCourtCase,hosting
```

## 9. 문제 발생 시

- Hosting은 Firebase 릴리스 기록에서 직전 버전으로 롤백
- Functions 오류가 지속되면 Hosting의 API rewrite를 제거하거나 예비 판례 모드로 전환
- 기존 커뮤니티 소스는 `backup/community-v1-20260726`에서 복구
