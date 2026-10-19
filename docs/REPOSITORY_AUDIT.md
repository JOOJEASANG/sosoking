# 소소킹 저장소 정리 및 보안 개선 보고서

## 검토 기준

- 업로드된 `sosoking(재미있는 판결사이트).zip`을 기준으로 소스를 복원했습니다.
- `public/index.html`, `public/admin/index.html`, `functions/main.js`, 서비스 워커와 웹 매니페스트를 실행 진입점으로 삼아 정적 참조 관계를 추적했습니다.
- 실제 실행 경로에서 도달하지 못하거나 현재 활성 구현에 대체된 파일만 제거했습니다.
- 이후 운영 코드의 인증·Firestore 규칙·AI 사용량·공개 데이터·PWA 배포 흐름을 단계적으로 재검토했습니다.

## 제거한 파일과 코드

- `functions/index.js`
  - `submitCase`, `generateTrial`을 먼저 내보낸 뒤 현재 보안 구현의 같은 이름 함수에 덮어써지던 죽은 코드였습니다.
- `public/admin/admin-email-guard.js`
  - 관리자 화면의 기존 인증 검사와 중복되고 현재 관리자 진입점에서 사용되지 않았습니다.
- `public/css/theme-toggle.css`
  - `public/js/components/theme.js`가 동일한 스타일을 런타임에 주입합니다.
- `public/js/components/app-install.js`, `public/js/pwa-init.js`
  - 현재 사용 중인 `public/js/components/pwa-ui.js`와 중복된 PWA 설치 코드였습니다.
- `public/js/components/theme-contrast.js`
  - 현재 사용 중인 법정 UI 대비 보정 코드와 역할이 중복됐습니다.
- `public/js/pages/auth.js`
  - 라우터가 사용하는 `auth2.js`로 대체된 구형 인증 화면이었습니다.
- 저장소 루트의 ZIP 파일과 일회성 분석 워크플로·임시 분석 결과를 제거했습니다.

## 구조 및 보안 개선

- Firebase Admin 초기화를 `functions/main.js`로 통합하고 실제 사용되는 Functions 모듈만 내보냅니다.
- 관리자 권한은 특정 이메일 예외 없이 Firestore의 `admins/{uid}` 또는 `admins/{email}` 문서만 사용합니다.
- 신규 사건은 Firestore 자동 ID를 사용해 공개 주소에 Firebase UID가 포함되지 않습니다.
- 공개 전환은 서버 Callable에서 소유권·관리자 권한과 콘텐츠 안전성을 검사하고 결과 문서의 과거 `userId` 필드를 제거합니다.
- 투표·댓글·닉네임·신고에는 인증 확인과 서버 횟수 제한을 적용하고, 댓글 작성자 UID는 공개 댓글과 분리합니다.
- 사용자 입력뿐 아니라 AI 생성 결과와 매일 자동 생성 사건도 저장·공개 전에 다시 검사합니다.
- AI 재시도는 사용자 작업 1건으로 한도를 차감하고 실제 외부 호출 시도와 저장 성공 건을 구분해 집계합니다.
- 홈 통계는 권한 없는 전체 사건 조회나 가상 숫자 대신 서버 집계 `site_public/statistics`를 사용합니다.
- Functions를 먼저 배포한 뒤 Firestore 규칙과 Hosting을 배포해 부분 배포 위험을 줄였습니다.
- 서비스워커 캐시 전략, 인증 경로 제외, 테마 저장소 예외 처리, 보안 응답 헤더와 CSP 보고 전용 정책을 추가했습니다.

## 과거 사건 ID 이전

- 과거 `${uid}_${timestamp}_${random}` 형식의 완료 사건을 새 opaque ID로 복사하는 재개 가능한 마이그레이션 로직을 추가했습니다.
- 사건·판결·투표·댓글·댓글 작성자 내부 매핑·댓글 통계·신고·신고 중복키를 함께 이전합니다.
- 과거 ID 원문은 별칭 문서에 저장하지 않고 SHA-256 해시만 사용합니다.
- 별칭 완료 후 기존 공유 링크는 `resolveCaseAlias` 서버 함수로 새 결과 주소에 연결됩니다.
- 마이그레이션은 일반 배포에서 자동 실행되지 않으며 별도 수동 GitHub Actions의 dry-run이 기본값입니다.
- 적용 모드는 `main` 브랜치와 확인 문자열 `MIGRATE_LEGACY_CASE_IDS`가 모두 필요합니다.
- Firestore 에뮬레이터 테스트에서 실제 복사, 해시 별칭, 신고키 갱신, 이전 문서 삭제를 확인합니다.

## 자동 검사

- Firestore 에뮬레이터 기반 보안 규칙 허용·거부 시나리오
- 과거 사건 ID 실제 마이그레이션 통합 테스트
- 개인정보·고위험 콘텐츠 및 관리자 권한 회귀검사
- Functions와 브라우저 JavaScript 문법
- 로컬 모듈과 HTML 정적 자산 경로
- 주요 JSON 파일 형식과 서비스워커 캐시 버전
- 삭제 대상 파일의 재유입
- Functions 이름 중복 내보내기
- Firebase 배포 목록과 실제 Functions 내보내기의 일치 여부

## 유지한 파일

- `*-court.js`, `*-game.js`, `*-guard.js` 파일은 기본 페이지를 가져와 UI와 동작을 확장하는 활성 래퍼이므로 유지했습니다.
- `submit-secure.js`와 `generate-trial-lite.js`는 현재 실제로 배포되는 `submitCase`, `generateTrial` 구현이므로 유지했습니다.
- Firestore 규칙의 관리자 문서 기반 권한, 본인 사건 접근, 공개 결과 접근 구조는 유지했습니다.

## 운영 확인 항목

- Firebase 프로젝트의 `admins` 컬렉션에 실제 관리자 UID 또는 이메일 문서가 등록돼 있어야 합니다.
- GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`가 유지되어야 배포와 수동 마이그레이션이 정상 진행됩니다.
- App Check 강제 전 웹 사이트 키와 허용 도메인을 먼저 설정해야 합니다.
- 과거 사건 ID 이전은 반드시 dry-run 결과를 확인한 후 apply 모드로 실행해야 합니다.
