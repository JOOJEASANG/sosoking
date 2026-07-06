# 임시 보정 파일 분류표

## 목적

긴급 오류 수정 과정에서 추가된 safe/fix/patch/cleanup 계열 파일을 무리하게 삭제하지 않고, 장기 리팩터링 때 어떤 파일을 어디에 통합할지 분류한다.

## 이번 안정화에서 shim 처리한 파일

- `public/js/write-edit-fix.js`
  - 기존에는 수정 화면을 직접 렌더링했다.
  - 현재는 `write-edit-router-fix.js`가 최신 수정 화면을 담당한다.
  - 중복 렌더 방지를 위해 호환 shim으로 전환했다.
- `public/js/home-feed-compact-fix.js`
  - 기존에는 홈 최근 피드 DOM을 직접 교체했다.
  - 현재는 `pages/home.js`가 compact 홈을 직접 렌더링한다.
  - 중복 DOM 교체 방지를 위해 호환 shim으로 전환했다.

## 유지 필요 파일

### 화면 안정화

- `public/js/boot.js`
  - 앱 부팅 핵심 파일이다.
- `public/js/multi-write-stability-fix.js`
  - 글쓰기 렌더 타이밍 보정용이다.
- `public/js/multi-detail-cleanup.js`
  - 상세 참여창 중복 렌더 방지 계열이다.
- `public/js/detail-comment-fix.js`
  - 상세 댓글/로그인 유도/닉네임 fallback 보강용이다.
- `public/js/admin-ui-cleanup.js`
  - 관리자 홈 이동 버튼 제거용이다.

### 참여 기능 안정화

- `public/js/fill-box-input-fix.js`
  - 빈칸 채우기 칸 입력, 붙여넣기, 제출값 분리 보정용이다.
- `public/js/participant-replies.js`
  - 참여글 답글 기능 보정용이다.
- `public/js/acrostic-flow-fix.js`
  - 삼행시 참여 흐름 보정용이다.
- `public/js/detail-actions-bootstrap.js`
  - 상세 액션 초기화 보정용이다.

### 관리자 안정화

- `public/js/admin-data-manager.js`
  - 관리자 데이터 관리 탭이다.
- `public/js/admin-member-list-fix.js`
  - 회원 현황 보정용이다.
- `public/js/admin-ai-minimal-actions.js`
  - 최소 AI 관리 보정용이다.
- `public/js/admin-clean-dashboard.js`
  - 관리자 대시보드 정리 보정용이다.

### 이미지/게시글 관리

- `public/js/unlimited-image-uploader.js`
  - 이미지 업로드 제한 완화 보정용이다.
- `public/js/post-owner-actions.js`
  - 게시글 작성자 액션 보정용이다.
- `public/js/post-image-edit-actions.js`
  - 게시글 이미지 수정 보정용이다.
- `public/js/detail-image-visibility-patch.js`
  - 상세 이미지 표시 보정용이다.

## CSS 보정 파일

- `public/css/mobile-admin-polish.css`
  - 관리자/모바일 중간 보정 파일이다.
- `public/css/mobile-final-pass.css`
  - 최종 모바일 우선순위 보정 파일이다.
- `public/js/ui-polish-fixes.css`
  - 현재 경로가 js 폴더지만 CSS 파일이다. 장기적으로 `public/css/ui-polish-fixes.css`로 이동하는 것이 좋다.
- `public/css/clean-layout-refresh.css`
  - 레이아웃 정리용이다.
- `public/css/inner-background-fix.css`
  - 내부 배경 보정용이다.
- `public/css/legal-spacing-fix.css`
  - 약관/푸터 간격 보정용이다.

## 장기 통합 후보

### 글쓰기 관련 통합 후보

- `public/js/multi-write.js`
- `public/js/multi-write/render.js`
- `public/js/multi-write/collect.js`
- `public/js/multi-write/presets.js`
- `public/js/multi-write-stability-fix.js`
- `public/js/write-edit-router-fix.js`
- `public/js/write-edit-fix.js` — 현재 shim

목표: 글쓰기/수정 흐름을 하나의 명확한 라우터와 폼 상태 관리 구조로 통합한다.

### 상세 참여 관련 통합 후보

- `public/js/multi-detail.js`
- `public/js/multi-detail/render.js`
- `public/js/multi-detail/actions.js`
- `public/js/multi-detail-cleanup.js`
- `public/js/fill-box-input-fix.js`
- `public/js/detail-comment-fix.js`
- `public/js/participant-replies.js`
- `public/js/acrostic-flow-fix.js`

목표: 참여 기능별 렌더/이벤트/저장을 명확히 분리하고 중복 MutationObserver를 줄인다.

### 홈 관련 통합 후보

- `public/js/pages/home.js`
- `public/js/home-feed-compact-fix.js` — 현재 shim

목표: 홈 화면은 `pages/home.js` 단일 파일 기준으로 유지하고, shim 파일은 다음 안정 배포 확인 후 제거한다.

### 관리자 관련 통합 후보

- `public/js/pages/admin-safe.js`
- `public/js/admin-data-manager.js`
- `public/js/admin-member-list-fix.js`
- `public/js/admin-clean-dashboard.js`
- `public/js/admin-ui-cleanup.js`
- `public/js/admin-ai-minimal-actions.js`

목표: 관리자 페이지를 탭 기반 모듈 구조로 분리하고, 임시 cleanup 스크립트를 원본에 통합한다.

### 모바일 CSS 통합 후보

- `public/css/responsive.css`
- `public/css/mobile-admin-polish.css`
- `public/css/mobile-final-pass.css`
- `public/js/ui-polish-fixes.css`

목표: 최종적으로 `responsive.css`와 `mobile.css` 정도로 정리한다. 단, 지금 바로 삭제/이동하면 우선순위 충돌로 화면이 깨질 수 있으므로 문서화 후 별도 브랜치에서 진행한다.

## 다음 정리 우선순위

1. 수정 화면은 `write-edit-router-fix.js` 기준으로 안정 확인 후 `write-edit-fix.js` 로드 제거 검토
2. 홈 화면은 `pages/home.js` 기준으로 안정 확인 후 `home-feed-compact-fix.js` 로드 제거 검토
3. 상세 참여 이벤트는 `multi-detail.js` 기준으로 안정 확인 후 `multi-detail-cleanup.js` 역할 축소 검토
4. 관리자 화면은 `pages/admin-safe.js`에 통합한 뒤 보조 관리자 스크립트 역할 축소 검토
5. CSS는 `mobile-final-pass.css` 기준으로 실제 모바일 확인 후 중복 파일 병합 검토

## 삭제 금지 원칙

- 현재 단계에서는 위 파일들을 삭제하지 않는다.
- 배포 후 실제 화면 확인이 끝나기 전에는 통합하지 않는다.
- 통합 작업은 별도 브랜치에서 진행한다.
- 통합 후에는 `STABILIZATION_CHECKLIST.md` 전체를 다시 수행한다.
