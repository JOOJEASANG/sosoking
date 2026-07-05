# sosoking

Firebase Hosting + Cloud Functions 기반 **토론소·드립소 커뮤니티 웹앱**입니다.

## 운영 구조

- 사이트는 `토론소(vote)`와 `드립소(drip)` 두 공간만 운영합니다.
- 운영봇(`opsbot`)은 공개 캐릭터가 아니라 사회자 역할로만 사용합니다.
- 공개 AI 캐릭터는 8명입니다. 캐릭터 정의는 `public/js/ai-residents.js`에서 관리합니다.
- 관리자 AI 샘플 생성은 현재 사이트 구조에 맞춰 `feeds` 문서로 저장하며, 작성자는 운영봇이 아니라 가상닉네임으로 생성합니다.
- 레거시 게임/퀴즈/오락실 라우트는 `/feed`로 보냅니다.

## 배포 전 확인

```bash
firebase login
firebase use sosoking-481e6
cd functions
npm install
cd ..
npm run check
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

## 필수 Secret

Gemini 기능을 사용하는 Functions는 Firebase Secret Manager의 `GEMINI_API_KEY`를 사용합니다.

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Anthropic 기반 자동 콘텐츠/AI 캐릭터 댓글 기능은 Firebase Secret Manager의 `ANTHROPIC_API_KEY`를 사용합니다.

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

## 주요 코드 기준

- 앱 진입점: `public/js/boot.js` → `public/js/app-safe.js`
- 보조 모듈 등록: `public/js/app-module-registry.js`
- 토론/드립 AI 샘플 생성: `functions/two-space-ai-content-functions.js`
- 공개 Cloud Functions export 기준: `functions/functions-main-v2.js`
- 모바일 최종 정렬 CSS: `public/css/site-operation-cleanup.css`
- 운영 문구/레거시 메뉴 보정: `public/js/site-operation-cleanup.js`

## 보안 구조

- 투표는 `votePostOption` / `castFeedVote` Callable Function 트랜잭션으로 처리합니다.
- 게시글/댓글/삼행시 반응은 `reactToPost`, `reactToComment`, `reactToAcrostic`, `toggleFeedReaction` Callable Function으로 처리합니다.
- 조회수는 `incrementPostView` / `registerPostView` Callable Function으로 처리합니다.
- 일반 사용자가 Firestore에서 반응 카운터를 직접 조작하지 못하도록 Rules를 유지합니다.

## 확인 경로

- 홈 `/`
- 피드 `/#/feed`
- 글쓰기 `/#/write`
- 상세 `/#/detail/{postId}`
- 관리자 `/#/admin`
- 공유 URL `/p/{postId}`
