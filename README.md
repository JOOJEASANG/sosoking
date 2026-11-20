# 소소킹 — 소소한 정보와 유용한 웹 도구

사이트: https://sosoking-481e6.web.app/

소소킹은 일상에서 필요한 작은 정보와 도구를 무료로 제공하는 정보·유틸리티 포털입니다.

## 사이트 구조

- `/`: 통합 홈페이지, 도구 검색 및 바로 가기
- `/tools.html`: 문자수·바이트 계산, 날짜 간격, 퍼센트, 랜덤 뽑기, 용지규격(ISO·JIS)과 300dpi 픽셀
- `/info.html`: 종이 규격, 해상도, 날짜 산정, 퍼센트 상식
- `/daily.html`: 기존 '나의 하루체크' 프로그램 (개인 기록과 기존 공유 항목 기능 유지)

도구 입력은 브라우저에서만 처리하며 외부 서버로 보내지 않습니다. 하루체크의 개인 일기는 기존처럼 해당 브라우저의 localStorage에 저장되며, 다른 사용자가 공유한 '항목 정의'만 Firebase Firestore에서 조회합니다.

**기존 하루체크 이용자 안내:** 메인 화면이 `/`에서 `/daily.html`로 이동했지만 origin과 저장 키 `sosoking-daily-journal-v1`는 변경되지 않습니다. 같은 브라우저에서 이전 기록을 사용할 수 있습니다. 다른 기기나 브라우저에서는 JSON 백업을 복원해야 합니다. 기존 콘텐츠를 자동으로 서버에 업로드하지 않습니다.

## 실행 및 검증

Node.js 20 이상에서 `npm install`, `npm run check`, `npm run build`, `node scripts/verify-pwa.mjs`, `node scripts/verify-seo.mjs --built`를 실행합니다. `npm run dev`로 로컬에서 확인할 수 있습니다.

GitHub Actions는 PR에서 테스트/빌드를, main 병합 후 Firebase Hosting·Firestore Rules 배포와 공유 항목 권한 검증을 수행합니다. 기존 Firestore 규칙은 이번 전환에서 변경하지 않습니다.

기존의 예전 프로그램 버전은 `archive/pre-daily-check-2026-11-19` 브랜치에 백업되어 있습니다. 복원 전에 보안과 개인 데이터 처리 정책을 재확인하세요.

## 운영 원칙

- 명확한 정보 출처 및 ISO/JIS 같은 규격 표기를 유지합니다.
- 서버나 계정이 필요 없는 도구는 로컬 실행을 우선합니다.
- 새 정보·프로그램은 자체 경로로 추가하며 기존 하루체크 기록을 삭제하지 않습니다.
- PWA는 공개 정적 자산만 캐시하고 개인 기록·Firestore 요청은 캐시하지 않습니다.
