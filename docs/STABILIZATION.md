# Stabilization Guide

이 문서는 소소킹 코드 정리/통합/안정화 기준입니다.

## 1. 클라이언트 모듈 로딩

보조 모듈 목록은 `public/js/app-module-registry.js`에서 관리합니다.

- `POST_BOOT_MODULES`: 앱 진입점이 로드된 뒤 반드시 보정해야 하는 모듈
- `SAFE_OPTIONAL_MODULES`: `app-safe.js`에서 부팅 후 병렬 로드하는 선택 모듈
- `EXTENSION_MODULES`: `app-extensions-loader.js`에서 관리하는 화면/기능 확장 모듈

새 보정 파일을 추가할 때는 `index.html`에 직접 script를 늘리지 말고 registry에 추가합니다.

## 2. 퀴즈 제거 상태

일반 피드 퀴즈와 멀티 퀴즈 정답 확인 Callable Function은 제거되었습니다.

제거된 항목:

- `checkQuizAnswer`
- `checkMultiQuizAnswer`
- 퀴즈 정답 포인트 지급 규칙
- 정답 없는 퀴즈 polish 모듈

호환 목적으로 `public/css/quiz-share-card.css`는 빈 파일로 유지합니다. 기존 HTML 또는 서비스워커 캐시가 해당 파일을 요청해도 404가 발생하지 않게 하기 위한 목적입니다.

## 3. CSS 정리 원칙

현재 CSS는 다수의 보정 파일이 누적되어 있으므로 한 번에 삭제하지 않습니다. 아래 순서로 통합합니다.

1. `base.css`, `layout.css`, `components.css`, `pages.css`, `responsive.css`는 핵심 파일로 유지
2. `*-fix.css`, `*-polish.css`, `*-final*.css`는 기능별로 묶어 새 파일로 병합
3. 병합 후 기존 파일은 빈 호환 파일로 1회 배포 유지
4. 다음 배포에서 HTML 참조 제거
5. 마지막 배포에서 빈 파일 삭제

이 순서를 지키면 브라우저 캐시와 서비스워커 캐시 때문에 생기는 CSS 404 또는 화면 깨짐을 줄일 수 있습니다.

## 4. Functions 정리 원칙

`functions/functions-main-v2.js`는 공개 export의 단일 기준입니다.

- 같은 기능 이름을 여러 모듈에서 export하지 않습니다.
- 레거시 함수가 필요하면 export하지 말고 파일 내부 주석으로만 남깁니다.
- 실제 운영 함수는 `functions-main-v2.js`에 명시적으로 연결합니다.

## 5. 배포 전 확인

```bash
npm run check
firebase deploy --only firestore:rules,functions,hosting
```

배포 후 확인:

- 홈 `/`
- 피드 `/#/feed`
- 글쓰기 `/#/write`
- 상세 `/#/detail/{postId}`
- 관리자 `/#/admin`
- 공유 URL `/p/{postId}`
