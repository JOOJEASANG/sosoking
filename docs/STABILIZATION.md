# 소소킹 안정화 기준

이 문서는 소소킹의 실행 경로, 모듈 추가, 레거시 호환, 배포 전 검증 기준을 고정합니다.

## 1. 단일 앱 진입점

클라이언트 실행 경로는 다음 하나만 사용합니다.

```text
public/index.html
  → public/js/boot.js
  → public/js/app-safe.js
```

`boot.js`는 `app-safe.js`가 실패하면 오류 화면과 진단 정보를 표시합니다. 별도의 구형 앱 fallback을 두지 않습니다. 두 개의 앱 진입점이 동시에 라우트와 이벤트를 등록하지 않도록 합니다.

## 2. 보조 모듈 관리

보조 모듈은 `public/js/app-module-registry.js`에서만 등록합니다.

- `POST_BOOT_MODULES`: 앱 초기화 직후 반드시 필요한 보정
- `SAFE_OPTIONAL_MODULES`: 핵심 앱 부팅을 막지 않는 보안·계정 보조 모듈
- `EXTENSION_MODULES`: 화면과 기능을 확장하는 모듈

자체 `MutationObserver`를 실행하는 파일을 저장소에 추가하고 registry에 연결하지 않은 채 방치하지 않습니다. 원본 기능에 통합된 보정 파일은 registry 항목과 파일을 함께 제거합니다.

## 3. 현재 콘텐츠 유형

새 콘텐츠 생성과 글쓰기 화면은 다음 네 유형만 사용합니다.

- `judgment`: 판결
- `consult`: 상담
- `vote`: 토론
- `drip`: 드립

예전 퀴즈·작명·삼행시·릴레이 데이터는 기존 게시물 표시를 위해 일부 렌더링 호환 코드만 유지할 수 있습니다. 새 예약 작업이나 관리자 생성 기능에서 예전 유형을 다시 만들지 않습니다.

## 4. CSS 정리

핵심 CSS는 다음 파일입니다.

- `base.css`
- `layout.css`
- `components.css`
- `pages.css`
- `responsive.css`

추가 CSS는 `public/index.html`에서 실제로 로드되고 현재 DOM 클래스와 연결되어 있어야 합니다. 내용이 비어 있거나 HTML에서 불러오지 않는 호환 파일은 유지하지 않습니다.

서비스워커는 HTML·JS·CSS·JSON을 캐시에 고정하지 않으므로, 참조를 먼저 제거한 뒤 같은 배포에서 빈 호환 파일을 삭제할 수 있습니다.

## 5. Cloud Functions

`functions/functions-main-v2.js`가 공개 Functions export의 단일 기준입니다.

- 같은 함수 이름을 여러 모듈에서 중복 export하지 않습니다.
- 최신 구현으로 대체된 모듈은 require와 파일을 함께 제거합니다.
- 사용하지 않는 Callable Function과 예약 작업을 호환 목적으로 계속 배포하지 않습니다.
- 일일 자동 콘텐츠는 `daily-auto-post-v2-functions.js` 한 곳에서만 예약합니다.
- AI 댓글은 `ai-character-comments-v2-functions.js`를 사용합니다.

## 6. Secret과 데이터

- AI 호출은 Firebase Secret Manager의 `GEMINI_API_KEY`를 사용합니다.
- 브라우저 코드에 API 키를 포함하지 않습니다.
- 기존 컬렉션 데이터를 삭제하는 작업은 코드 정리와 분리해서 수행합니다.
- 코드에서 사용하지 않는 컬렉션에 데이터를 계속 쌓는 예약 작업은 제거합니다.

## 7. 배포 전 확인

```bash
cd functions
npm ci
cd ..
npm run check
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

추가로 확인할 항목:

- 모든 로컬 `import`·`require` 대상 파일 존재
- `index.html`의 CSS·JS·아이콘 경로 존재
- registry에 등록된 모듈 존재
- Functions 엔트리에 중복 export 없음
- JSON 파일 구문 정상
- 홈, 피드, 글쓰기, 상세, 계정, 관리자 라우트 정상

배포 후 확인 절차는 `STABILIZATION_CHECKLIST.md`를 따릅니다.
