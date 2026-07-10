# 소소킹 판결소

일상 속 소소한 억울함과 황당한 사례를 접수하면 AI 재판부가 지나치게 진지한 판결문을 작성하는 Firebase 기반 오락형 서비스입니다.

실제 법률 상담이나 분쟁 해결 서비스가 아니며, 핵심 재미는 **사소한 사건 + 과한 재판 말투 + 실행 가능한 소소 형량**입니다.

---

## 서비스 기준

### 핵심 콘셉트

- 사람 간 갈등뿐 아니라 모기, 리모컨, 마지막 만두처럼 사소한 대상도 피고가 될 수 있습니다.
- 입력이 하찮을수록 판결문은 더 엄숙하게 작성합니다.
- 결론은 가볍고 공감 가능하며 실제로 해볼 수 있는 소소한 처분으로 마무리합니다.
- 뉴스·위원회·상황실 표현은 보조 장치로만 사용하고 메인 정체성은 재판과 판결로 유지합니다.

### 다루지 않는 방향

- 실제 법률 서비스처럼 보이는 구성
- 정치·혐오·성적 내용·실제 범죄·개인정보 중심 콘텐츠
- 학교폭력·가정폭력·직장 내 괴롭힘·의료·정신건강 문제를 오락처럼 소비하는 구성
- 욕설·비하·자극적인 표현에 의존하는 개그

---

## 사용자 흐름

1. **사건 접수** — 사건명, 사건 내용, 판사 성향 등을 입력합니다.
2. **AI 재판 진행** — Gemini가 재판 기록과 최종 판결문을 생성합니다.
3. **최종 판결** — `results/{caseId}`의 `judgmentScript`와 기존 호환 필드를 결과 화면에서 표시합니다.
4. **공개 판결기록** — 사용자가 선택한 판결만 공개합니다.
5. **방청객 참여** — 반응 투표와 방청석 댓글을 남깁니다.
6. **항소심** — 사건 소유자는 1심 판결에 대한 항소심을 신청할 수 있습니다.

구형 판결문 파서와 자동 구조화·백필 Functions는 제거했습니다. 새 판결 V2가 완성되기 전까지 기존 문서의 호환 필드는 읽기 전용으로만 사용합니다.

---

## 방청객 반응

공개 판결에는 다음 다섯 반응 중 하나를 선택할 수 있습니다.

- ⚖️ 원고 편
- 🛡️ 피고 편
- 🤝 쌍방과실
- 😳 판사님 과합니다
- 😂 웃겼다

게시판 정렬 기준:

- **최신** — 최근 선고 순
- **인기** — 투표와 댓글 참여도 기준
- **명판결** — `웃겼다` 반응 기준

---

## 프로젝트 구조

- `public/` — Firebase Hosting 정적 프론트엔드
- `public/js/pages/` — 홈, 접수, 재판, 결과, 게시판, 정책, 내 사건
- `public/admin/` — 관리자 페이지
- `functions/` — Firebase Cloud Functions와 Gemini 연동
- `firestore.rules` — Firestore 접근 제어
- `firestore.indexes.json` — Firestore 복합 인덱스
- `storage.rules` — 사건 이미지와 프로필 사진 접근 제어
- `.github/workflows/firebase-deploy.yml` — Functions·Firestore·Hosting 자동배포
- `.github/workflows/firebase-storage-rules.yml` — Storage Rules 수동배포

---

## 주요 백엔드 기능

- `submitCase` — 사건 접수, 일일 한도·쿨다운·금칙어 검사
- `suggestCaseTitle` — 사건명 추천
- `generateTrial` — AI 재판 및 최종 판결 생성
- `voteResult` — 공개 판결 반응 투표
- `addCourtComment` — 방청석 댓글
- `requestAppeal` — 항소심 생성
- `deleteMyCase` — 사용자 본인 사건 전체 정리
- `deleteCourtPost` / `deleteUserProfile` — 관리자 정리 기능
- `recoverStaleTrials` / `repairSocialCounters` — 운영 데이터 복구

Functions는 하드코딩된 이름 목록이 아니라 `functions/main.js`의 현재 export 전체를 기준으로 배포합니다. 소스에서 제거된 Function은 다음 Core 배포에서 운영 환경에서도 폐기됩니다.

---

## 보안 구조

- Firebase Auth 사용자를 기준으로 접근 권한을 판단합니다.
- 사건 생성과 삭제는 클라이언트 직접 쓰기가 아니라 Callable Function으로 처리합니다.
- `users`, `user_names`, `cases`, `results`의 중요 쓰기·삭제 경로는 서버 전용입니다.
- 이메일 문서 기반 관리자 권한은 이메일 인증 완료 계정만 인정합니다.
- 민감한 AI 설정은 관리자 전용 `site_settings`에 저장합니다.
- 사용자 화면에 필요한 값만 `public_settings`로 분리합니다.
- 사용자 입력과 AI 결과는 화면 출력 전에 escape 처리합니다.
- Storage의 사건 이미지는 사건 소유자만 읽을 수 있고 클라이언트 직접 쓰기는 차단합니다.

---

## 관리자 설정

관리자 권한은 Firestore의 `admins/{uid}` 또는 `admins/{email}` 문서로 판단합니다.

관리자 페이지에서 관리하는 항목:

- 일일 사건 접수 한도와 쿨다운
- 금칙어
- AI 모델·프롬프트
- AI 자동 생성 설정
- 사용량·비용 계산 기준
- 사업자 정보와 정책 문서
- 사건·판결·회원 데이터 정리
- 운영 데이터 복구 작업

관리자 로그인 후 공개 가능한 설정은 `public_settings/config`으로 동기화됩니다.

---

## 로컬 검증

```bash
npm install --prefix functions --no-audit --no-fund
npm run lint --prefix functions
```

검증 범위:

- Functions와 브라우저 JavaScript 문법
- Firestore 보안 계약
- 공개 설정 접근 경로
- 소스 기준 Functions 전체 배포 계약
- Firebase Core와 Storage 배포 분리
- 구형 판결 구조화 Function이 다시 연결되지 않는지 확인

---

## 배포

Functions·Firestore·Hosting은 `main` 푸시 시 자동 배포합니다.

Firebase Storage Rules는 별도 IAM 권한이 필요하므로 전용 수동 워크플로로 배포합니다. 서비스 계정 권한, 실행 순서, 403 오류 해결 방법은 [배포 운영서](docs/DEPLOYMENT.md)를 기준으로 합니다.

---

## 필수 운영 값

- Firebase 프로젝트: `sosoking-481e6`
- GitHub Secret: `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`
- Firebase Functions Secret: `GEMINI_API_KEY`
- Functions 런타임: Node.js 20

서비스 계정 JSON과 Gemini API 키를 저장소 파일에 커밋하지 않습니다.
