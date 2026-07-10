# 소소킹 황당재판소

일상의 사소하고 억울한 사건을 접수하면 AI가 사건의 핵심을 분석하고 원고·피고 공방과 황당판결을 만드는 오락형 서비스입니다.

## 재구축 진행 상태

### 1단계 — 제품 골격

완료 범위:

- 반응형 홈 화면
- Google 로그인
- 이메일 회원가입·로그인
- 로그인 상태 유지와 로그아웃
- 사건 접수 폼
- 판사 성향·사건 분류·억울함 정도·희망 판결 입력
- Cloud Functions를 통한 서버 검증 및 사건 저장
- 사용자 본인 사건만 읽을 수 있는 Firestore 규칙
- 30초 중복 접수 제한과 하루 20건 서버 제한
- 2단계 AI 판결 엔진이 이어받을 수 있는 `generationStatus: not_started` 데이터 구조

## 기술 구성

- Firebase Hosting
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase
- Firebase Secret Manager의 `GEMINI_API_KEY`
- GitHub Actions 자동 검증 및 배포
- Vanilla JavaScript ES Modules

## 사건 문서 구조

`cases/{caseId}`

- `userId`
- `title`
- `caseDescription`
- `defendantName`
- `category`
- `judgeType`
- `grievanceIndex`
- `desiredVerdict`
- `isPublic`
- `status: received`
- `generationStatus: not_started`
- `createdAt`, `updatedAt`

클라이언트는 사건 문서를 직접 생성하거나 수정할 수 없습니다. 모든 사건 접수는 `createCaseDraft` Callable Function에서 검증 후 저장합니다.

## 필요한 Secret

GitHub Actions:

- `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`

Firebase Secret Manager:

- `GEMINI_API_KEY`

실제 Gemini 키 값은 저장소에 포함하지 않습니다.

## 로컬 검증

```bash
npm install --prefix functions
npm run check --prefix functions
```

## 다음 단계

2단계에서 사건 핵심 추출, 코미디 생성, 품질검사, 재생성 및 안전한 로컬 대체 결과를 포함하는 AI 판결 엔진을 구축합니다.
