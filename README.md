# sosoking

Firebase Hosting + Cloud Functions 기반 게임형 커뮤니티 웹앱입니다.

## 배포 전 확인

```bash
firebase login
firebase use sosoking-481e6
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

## 필수 Secret

Gemini 기능을 사용하는 Functions는 Firebase Secret Manager의 `GEMINI_API_KEY`를 사용합니다.

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Anthropic 자동 콘텐츠 기능은 현재 런타임 환경변수 `ANTHROPIC_API_KEY`를 사용합니다. Firebase Secret Manager로 통일하려면 `ai-content-functions.js`, `ai-mission-functions.js`에서 `defineSecret` 방식으로 전환하세요.

## 운영상 주요 보안 구조

- 퀴즈/OX 정답 확인은 `checkQuizAnswer` Callable Function을 통해 서버에서 처리합니다.
- 투표는 `votePostOption` Callable Function 트랜잭션으로 처리합니다.
- 게시글/댓글/삼행시 반응은 `reactToPost`, `reactToComment`, `reactToAcrostic` Callable Function으로 처리합니다.
- 조회수는 `incrementPostView` Callable Function으로 처리합니다.
- Firestore Rules는 일반 사용자의 직접 반응 카운터 조작을 막도록 강화되어 있습니다.

## Firebase 런타임

`firebase.json`과 `functions/package.json` 모두 Node 22 기준입니다.

## 인덱스

`firestore.indexes.json`에는 관리자 신고 관리 화면용 `reports(resolved, createdAt desc)` 인덱스가 포함되어 있습니다.
