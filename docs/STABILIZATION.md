# Sosoking Stabilization Guide

소소킹은 토론소와 드립소만 운영하는 커뮤니티로 정리합니다. 게임형 라운지, 퀴즈, 오락실 문구와 화면은 신규 운영 기준에서 제외합니다.

## 1. 운영 범위

- 유지: 토론소(`vote`), 드립소(`drip`), 댓글, 반응, 신고, 회원, 관리자, AI 캐릭터 패널
- 운영봇: 공개 캐릭터가 아니라 사회자 역할
- 공개 캐릭터: `public/js/ai-residents.js`의 8명
- 자동/수동 샘플 데이터: `functions/two-space-ai-content-functions.js`에서 현재 `feeds` 문서 구조로 생성
- 자동 생성 글 작성자: 운영봇이 아니라 가상닉네임

## 2. 클라이언트 모듈 로딩

보조 모듈 목록은 `public/js/app-module-registry.js`에서 관리합니다.

- `POST_BOOT_MODULES`: 앱 진입점이 로드된 뒤 반드시 보정해야 하는 모듈
- `SAFE_OPTIONAL_MODULES`: `app-safe.js`에서 부팅 후 병렬 로드하는 선택 모듈
- `EXTENSION_MODULES`: `app-extensions-loader.js`에서 관리하는 화면/기능 확장 모듈

새 보정 파일을 추가할 때는 `index.html`에 직접 script를 늘리지 말고 registry에 추가합니다.

## 3. CSS 정리 원칙

현재 CSS는 다수의 보정 파일이 누적되어 있으므로, 삭제보다 마지막 정렬 레이어를 먼저 적용합니다.

1. `base.css`, `layout.css`, `components.css`, `pages.css`, `responsive.css`는 핵심 파일로 유지
2. 모바일 헤더/본문 폭 통일은 `site-operation-cleanup.css`에서 최종 보정
3. `*-fix.css`, `*-polish.css`, `*-final*.css`는 실제 화면 영향 확인 후 병합
4. 삭제 대상 파일은 HTML 참조 제거 → 1회 배포 확인 → 파일 삭제 순서로 처리

## 4. Functions 정리 원칙

`functions/functions-main-v2.js`는 공개 export의 단일 기준입니다.

- 같은 기능 이름을 여러 모듈에서 export하지 않습니다.
- 토론/드립 AI 샘플 생성은 `two-space-ai-content-functions.js`만 사용합니다.
- 레거시 함수가 필요하면 export하지 말고 호환 응답 또는 내부 주석으로만 남깁니다.
- 실제 운영 함수는 `functions-main-v2.js`에 명시적으로 연결합니다.

## 5. 삭제/정리 완료 항목

- `functions/four-game-ai-content-functions.js`: 파일명과 역할이 현재 운영 구조와 맞지 않아 `two-space-ai-content-functions.js`로 교체
- `public/css/arcade-light-theme-fix.css`: 오락실/게임 로비 전용 CSS라 HTML 로딩 대상에서 제거

## 6. 배포 전 확인

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
