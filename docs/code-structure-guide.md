# 소소킹 코드 구조

## 클라이언트 진입

```text
public/index.html
├─ public/js/boot.js
│  └─ public/js/app-safe.js
└─ public/js/app-extensions-loader.js
   └─ public/js/app-module-registry.js
```

- `boot.js`는 핵심 앱 하나만 불러오고 실패 시 진단 화면을 표시합니다.
- `app-safe.js`는 공통 레이아웃, 인증 상태, 라우터를 초기화합니다.
- 확장 모듈은 registry에 등록된 파일만 동적으로 불러옵니다.

## 주요 페이지

```text
public/js/pages/
├─ home.js
├─ feed.js
├─ write.js
├─ detail.js
├─ account.js
├─ login.js
├─ signup.js
├─ admin-safe.js
├─ guide.js
├─ terms.js
├─ privacy.js
├─ scraps.js
└─ hall.js
```

현재 공개 콘텐츠는 판결·상담·토론·드립 네 유형입니다. `write.js`는 `multi-write.js`를 불러오고, 실제 입력 구성은 `public/js/multi-write/`에서 담당합니다.

## 상세 화면

```text
public/js/pages/detail.js
└─ public/js/detail/
   ├─ constants.js
   ├─ data.js
   ├─ body-render.js
   ├─ comment-render.js
   └─ similar-render.js
```

상세 화면의 투표·댓글·반응은 브라우저에서 Firestore 카운터를 직접 수정하지 않고 Callable Function을 사용합니다.

## 공통 모듈

```text
public/js/components/   UI 컴포넌트
public/js/services/     실제 사용 중인 데이터 서비스
public/js/utils/        공통 유틸리티
public/js/multi-write/  글쓰기 세부 모듈
public/js/detail/       상세 세부 모듈
```

독립 실행형 패치 파일을 추가할 때는 반드시 `app-module-registry.js`에 등록합니다. registry, 페이지 import, HTML script 중 어느 곳에서도 연결되지 않은 파일은 유지하지 않습니다.

## Cloud Functions

```text
functions/package.json
└─ functions/functions-main-v2.js
```

`functions-main-v2.js`만 공개 export를 결정합니다. 주요 구현은 다음과 같습니다.

- `secure-feed-functions.js`: 피드 투표·반응·조회·SEO
- `secure-multi-functions.js`: 멀티 참여 기능
- `secure-interactions-functions.js`: 상세 반응과 작성물 상호작용
- `ai-character-comments-v2-functions.js`: 유형별 AI 캐릭터 댓글
- `daily-auto-post-v2-functions.js`: 일일 자동 콘텐츠
- `four-game-ai-content-functions.js`: 관리자 수동 콘텐츠 생성
- `sitemap-functions.js`: 동적 사이트맵
- `account-functions.js`: 계정 기능
- `admin-*-functions.js`: 관리자 전용 기능

같은 함수 이름을 여러 파일에서 export한 뒤 순서로 덮어쓰는 구조는 사용하지 않습니다.

## 스타일

핵심 CSS는 `base.css`, `layout.css`, `components.css`, `pages.css`, `responsive.css`입니다. 추가 스타일 파일은 현재 DOM과 연결된 경우에만 `index.html`에서 로드합니다.

리팩터링 순서:

1. 같은 화면을 수정하는 CSS를 기능별로 통합
2. HTML 참조를 통합 파일로 변경
3. 로컬 경로와 모바일 화면 검사
4. 대체된 파일 삭제

## 데이터 호환

새 글은 네 가지 현재 유형으로만 생성합니다. 이전 버전 게시물은 읽기 호환을 위해 상세 렌더러가 일부 구형 필드를 처리할 수 있지만, 구형 유형을 만드는 스케줄러·관리자 생성기·미션 기능은 유지하지 않습니다.
