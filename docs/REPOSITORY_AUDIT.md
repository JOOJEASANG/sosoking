# 소소킹 저장소 정리 보고서

## 검토 기준

- 업로드된 `sosoking(재미있는 판결사이트).zip`을 기준으로 소스를 복원했습니다.
- `public/index.html`, `public/admin/index.html`, `functions/main.js`, 서비스 워커와 웹 매니페스트를 실행 진입점으로 삼아 정적 참조 관계를 추적했습니다.
- 실제 실행 경로에서 도달하지 못하거나 현재 활성 구현에 대체된 파일만 제거했습니다.

## 제거한 파일과 코드

- `functions/index.js`
  - `submitCase`, `generateTrial`을 먼저 내보낸 뒤 `submit-secure.js`, `generate-trial-lite.js`의 같은 이름 함수에 덮어써지던 죽은 코드였습니다.
  - 구형 구현은 Gemini를 여러 차례 호출했지만 최종 Functions 내보내기에는 사용되지 않았습니다.
- `public/admin/admin-email-guard.js`
  - 관리자 화면의 기존 인증 검사와 중복되고 `public/admin/index.html`에서 로드되지 않았습니다.
- `public/css/theme-toggle.css`
  - `public/js/components/theme.js`가 동일한 스타일을 런타임에 주입합니다.
- `public/js/components/app-install.js`, `public/js/pwa-init.js`
  - 현재 사용 중인 `public/js/components/pwa-ui.js`와 중복된 PWA 설치 코드였습니다.
- `public/js/components/theme-contrast.js`
  - 현재 사용 중인 `public/js/components/contrast-fix.js`와 역할이 중복됐습니다.
- `public/js/pages/auth.js`
  - 라우터가 사용하는 `auth2.js`로 대체된 구형 인증 화면이었습니다.
- 저장소 루트의 ZIP 파일과 일회성 분석 워크플로·임시 분석 결과를 제거했습니다.

## 구조 및 보안 개선

- Firebase Admin 초기화를 `functions/main.js`로 옮기고 실제 사용되는 Functions 모듈만 내보내도록 단순화했습니다.
- 서버 Callable 관리자 권한은 특정 이메일 예외 없이 Firestore의 `admins/{uid}` 또는 `admins/{email}` 문서만 사용하도록 변경했습니다.
- 로그인 화면의 특정 이메일 기반 관리자 자동 이동을 제거하고, 관리자 이동 모듈이 Firestore 관리자 문서를 확인하도록 변경했습니다.
- 루트 `package.json`과 `tools/check-project.mjs`를 추가했습니다.
- 검사 도구는 다음 항목을 확인합니다.
  - Functions 및 브라우저 JS 문법
  - 로컬 모듈과 HTML 정적 자산 경로
  - 주요 JSON 파일 형식
  - 삭제 대상 파일의 재유입
  - Functions 이름 중복 내보내기
  - Firebase 배포 목록과 실제 Functions 내보내기의 일치 여부
- Firebase 배포 워크플로는 Functions 의존성을 `npm ci`로 설치하고 `npm run check` 통과 후에만 배포합니다.

## 유지한 파일

- `*-court.js`, `*-game.js`, `*-guard.js` 파일은 기본 페이지를 가져와 UI와 동작을 확장하는 활성 래퍼이므로 유지했습니다.
- `submit-secure.js`와 `generate-trial-lite.js`는 현재 실제로 배포되는 `submitCase`, `generateTrial` 구현이므로 유지했습니다.
- Firestore 규칙의 관리자 문서 기반 권한, 본인 사건 접근, 공개 판결 접근 구조는 유지했습니다.

## 병합 전 확인 권장 항목

- Firebase 프로젝트의 `admins` 컬렉션에 실제 관리자 UID 또는 이메일 문서가 등록돼 있어야 합니다.
- GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`가 유지되어 있어야 배포가 정상 진행됩니다.
- PR에서 파일 삭제 목록과 `npm run check` 결과를 확인한 뒤 병합하는 것을 권장합니다.
