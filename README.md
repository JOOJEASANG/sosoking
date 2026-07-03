# sosoking

Firebase Hosting + Cloud Functions 기반 게임형 커뮤니티 웹앱입니다.

## 배포 전 확인

firebase login
firebase use sosoking-481e6
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting

## 필수 Secret

Gemini 기능을 사용하는 Functions는 Firebase Secret Manager의 `GEMINI_API_KEY`를 사용합니다.

firebase functions:secrets:set GEMINI_API_KEY

Anthropic 기반 자동 콘텐츠/AI 캐릭터 댓글 기능은 Firebase Secret Manager의 `ANTHROPIC_API_KEY`를 사용합니다.

firebase functions:secrets:set ANTHROPIC_API_KEY

## 운영상 주요 보안 구조

- 투표는 `votePostOption` / `castFeedVote` Callable Function 트랜잭션으로 처리합니다.
- 게시글/댓글/삼행시 반응은 `reactToPost`, `reactToComment`, `reactToAcrostic`, `toggleFeedReaction` Callable Function으로 처리합니다.
- 조회수는 `incrementPostView` / `registerPostView` Callable Function으로 처리합니다.
- 일반 피드용 퀴즈 정답 확인 Callable Function은 제거되었습니다.
- Firestore Rules는 일반 사용자의 직접 반응 카운터 조작을 막도록 강화되어 있습니다.

## 정리/통합/안정화 기준

코드 정리 기준은 `docs/STABILIZATION.md`를 따릅니다.

- 클라이언트 보조 모듈 목록은 `public/js/app-module-registry.js`에서 관리합니다.
- `functions/functions-main-v2.js`는 공개 Cloud Functions export의 단일 기준입니다.
- CSS는 캐시 안정성을 위해 빈 호환 파일 유지, HTML 참조 제거, 파일 삭제 순서로 정리합니다.

## Firebase 런타임

`firebase.json`과 `functions/package.json` 모두 Node 22 기준입니다.

## 인덱스

`firestore.indexes.json`에는 관리자 신고 관리 화면용 `reports(resolved, createdAt desc)` 인덱스가 포함되어 있습니다.
