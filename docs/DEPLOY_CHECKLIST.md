# 소문난 판결소 배포 체크리스트

운영 사이트를 바로 덮지 않고 Firebase 미리보기 채널에서 먼저 검증합니다.

## 1. 배포 전 준비

- Firebase 프로젝트가 Functions 2세대를 사용할 수 있는 요금제인지 확인
- 로컬 Firebase CLI 로그인 및 대상 프로젝트 확인
- OpenAI API 키를 저장소가 아닌 Secret Manager에 등록

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

- 함수 의존성 설치

```bash
cd functions
npm install
cd ..
```

## 2. 저장소 검사

```bash
npm test
npm run check
```

반드시 모든 정적 테스트와 문법 검사가 통과해야 합니다.

## 3. Firebase 미리보기 배포

```bash
firebase hosting:channel:deploy court-preview --expires 7d
firebase deploy --only functions:generateCourtCase
```

함수 배포 후 미리보기 주소에서 사건 접수부터 판결 공유까지 직접 확인합니다.

## 4. 대표 사건 20개 자동 평가

```bash
COURT_BASE_URL="미리보기 주소" npm run evaluate
```

확인 항목:

- 20개 사건이 모두 정상 응답하는지
- 사건명이 `사건`으로 끝나는지
- 증거·심문·판결·재판관 성향이 각각 3개인지
- 판결과 후일담이 중복되지 않는지
- 평균 응답 시간이 허용 범위인지

## 5. 수동 점검

- Android Chrome
- iPhone Safari
- PC Chrome과 Edge
- 긴 사건명에서 카드가 깨지지 않는지
- 결과 카드 PNG 저장 여부
- Web Share 지원 기기에서 이미지 공유 여부
- AI 실패 시 예비 판례 자동 전환 여부
- 심각한 소재와 개인정보 입력 차단 여부

## 6. 운영 배포 기준

다음 조건을 모두 충족할 때만 운영 배포합니다.

- 자동 테스트 전부 통과
- 대표 사건 20개 형식 통과율 100%
- 치명적인 안전 필터 누락 없음
- 모바일 핵심 흐름 오류 없음
- OpenAI 사용량 제한과 결제 알림 설정 완료
- 기존 운영 사이트 백업 브랜치 확인

## 7. 운영 반영

```bash
firebase deploy --only functions:generateCourtCase,hosting
```

운영 확인 후에만 `rebuild/sosoking-v2`를 `main`에 병합합니다.

## 8. 문제 발생 시

- Hosting은 Firebase 릴리스 기록에서 직전 버전으로 롤백
- Functions 오류가 지속되면 Hosting의 API rewrite를 제거하거나 예비 판례 모드로 전환
- 기존 커뮤니티 소스는 `backup/community-v1-20260726`에서 복구
