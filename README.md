# 소소킹 황당재판소

일상의 사소하고 억울한 사건을 접수하면 AI가 사건의 핵심을 분석하고 원고·피고 공방과 황당판결을 만드는 오락형 서비스입니다.

## 재구축 진행 상태

### 1단계 — 제품 골격 완료

- 반응형 홈 화면
- Google 로그인
- 이메일 회원가입·로그인
- 사건 접수 폼
- Cloud Functions 서버 검증 및 사건 저장
- 사용자 본인 사건만 읽을 수 있는 Firestore 규칙
- 중복 접수 및 일일 접수 제한

### 2단계 — AI 판결 엔진 완료

- 행위자, 핵심 대상, 결정적 행동, 실제 피해 결과 추출
- 동물 음식 사건, 네비게이션 오안내, 음식 선점, 물건 은닉, 지각, 디지털 사건별 코미디 프레임
- Gemini `gemini-2.5-flash` 판결 생성
- 사건 명사를 이용한 말장난과 건조한 반전 강제
- 첫 두 문장 사건 명확성 검사
- 원고·피고 주장 중복 검사
- 맞춤형 주문 3개 검사
- 품질 미달 시 1회 재작성
- API 오류·JSON 오류·품질 미달 시 사건 맞춤형 로컬 판결 사용
- 중복 생성 잠금과 기존 결과 재사용
- 모델 시도 횟수와 토큰 사용량 기록
- 완성 결과를 `results/{caseId}`에 저장

## 기술 구성

- Firebase Hosting
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase
- Gemini API
- Firebase Secret Manager의 `GEMINI_API_KEY`
- GitHub Actions 자동 검증 및 배포
- Vanilla JavaScript ES Modules

## 핵심 함수

### `createCaseDraft`

인증된 사용자의 사건 접수 내용을 검증한 뒤 `cases/{caseId}`에 저장합니다.

### `generateJudgment`

본인 사건인지 확인하고 다음 순서로 판결을 생성합니다.

1. 결정적 사건 요소 분석
2. Gemini JSON 판결 생성
3. 사건 명확성·코미디·주장 분리·맞춤 주문 품질검사
4. 품질 미달 시 재작성
5. 실패 시 사건 맞춤형 로컬 판결로 대체
6. `results/{caseId}` 저장 및 사건 상태 완료 처리

## 판결 데이터 구조

`results/{caseId}`

- `caseAnalysis`
  - `actor`
  - `target`
  - `action`
  - `consequence`
  - `defendantType`
  - `comedyFrame`
- `judgment`
  - `headline`
  - `incidentLevel`
  - `opening`
  - `comedyLines`
  - `summary`
  - `facts`
  - `investigation`
  - `plaintiffClaim`
  - `defendantClaim`
  - `opinion`
  - `orders`
  - `closingComment`
  - `legalNotice`
- `generationMode`
- `model`
- `aiAttempts`
- `usage`
- `quality`

## 자동검증 사례

- 공원에서 리트리버가 빵을 먹어버린 사건
- 네비게이션이 다른 장소를 안내해 약속이 무산된 사건
- 마지막 만두 선점 사건
- 리모컨 소파 틈 은닉 사건

각 사건은 행위자·대상 추출, 첫 문장 명확성, 사건 맞춤 개그, 건조한 반전, 대립 주장, 주문 3개 검사를 통과해야 배포됩니다.

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

3단계에서 사건 생성 상태를 보여주는 재판 연출과 판결 결과 화면, 모바일 가독성, 공유 기능을 구현합니다.
