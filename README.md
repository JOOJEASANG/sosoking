# sosoking

Firebase Hosting + Cloud Functions 기반의 AI 캐릭터 참여형 커뮤니티 웹앱입니다.

현재 공개 공간은 다음 네 가지입니다.

- 판결: 일상 사건을 가볍게 판정
- 상담: 공감·현실 조언·감정 정리
- 토론: 찬성·반대·제3의 기준 비교
- 드립: 짧은 한 줄 드립 이어치기

## 실행 구조

- 정적 앱 진입점: `public/index.html` → `public/js/boot.js` → `public/js/app-safe.js`
- 보조 모듈 목록: `public/js/app-module-registry.js`
- 글쓰기 본체: `public/js/multi-write.js`와 `public/js/multi-write/`
- 상세 화면 본체: `public/js/pages/detail.js`와 `public/js/detail/`
- Cloud Functions 단일 엔트리: `functions/functions-main-v2.js`
- AI 캐릭터 댓글: `functions/ai-character-comments-v2-functions.js`
- 일일 자동 콘텐츠: `functions/daily-auto-post-v2-functions.js`

정적 Hosting 앱이므로 별도의 프런트엔드 빌드 결과물은 만들지 않습니다.

## 설치 및 검사

```bash
cd functions
npm ci
cd ..
npm run check
```

## 필수 Secret

AI 기능은 Firebase Secret Manager의 `GEMINI_API_KEY`를 사용합니다.

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

AI 댓글은 게시글 유형·내용·캐릭터 말투를 반영하며, 중복 응답 제거와 유형별 fallback을 적용합니다.

## 배포

```bash
firebase login
firebase use sosoking-481e6
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

GitHub `main` 브랜치에 변경이 들어오면 `.github/workflows/firebase-deploy.yml`이 같은 검사를 수행한 뒤 자동 배포합니다.

## 보안 구조

- 투표와 반응은 Callable Function 트랜잭션으로 처리합니다.
- 조회수는 서버 함수에서 중복을 제한합니다.
- 일반 사용자가 Firestore 카운터를 직접 조작하지 못하도록 Rules에서 차단합니다.
- 관리자 기능은 `admins/{uid}` 문서 또는 관리자 권한을 확인합니다.
- API 키를 브라우저 코드나 Firestore 일반 문서에 저장하지 않습니다.

## 정리 원칙

- 실제 실행 경로에 연결되지 않은 파일은 저장소에 두지 않습니다.
- 같은 이름의 Cloud Function을 여러 모듈에서 중복 export하지 않습니다.
- 임시 보정은 `app-module-registry.js`에 명시적으로 등록하고, 원본에 통합한 뒤 제거합니다.
- 기존 데이터 표시를 위한 호환 코드는 필요 범위만 유지하며 새 콘텐츠 생성에는 사용하지 않습니다.

세부 기준은 `docs/STABILIZATION.md`와 `docs/STABILIZATION_CHECKLIST.md`를 따릅니다.
