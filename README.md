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

AI 기능(헌법재판소·정치배틀·국회·대선·AI킹·패러디 이슈 등)은 Firestore `config/ai_king`(또는 `config/ai`) 문서에 저장된 키를 사용합니다. `activeModel`이 `claude`이고 `claudeApiKey`가 있으면 Anthropic을, 그 외에는 Gemini를 사용하며, Gemini 키가 없을 때는 `GEMINI_API_KEY` Secret을 폴백으로 사용합니다. 이 설정 문서는 Firestore 규칙상 관리자만 읽고 쓸 수 있습니다.

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
