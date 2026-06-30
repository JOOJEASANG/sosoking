# 소소킹 판결소

사소한 일상의 억울함을 AI 판사단이 과하게 진지하게 판결해주는 Firebase 기반 오락 서비스입니다.

## 구조

- `public/` — Firebase Hosting 정적 프론트엔드
- `public/js/pages/` — 홈, 접수, 재판 진행, 결과, 정책, 내 사건 페이지
- `public/admin/` — 관리자 페이지
- `functions/` — Firebase Cloud Functions, Gemini API 호출
- `firestore.rules` — Firestore 접근 제어 규칙
- `firestore.indexes.json` — Firestore 복합 인덱스

## 주요 보안 구조

- 사용자는 Firebase Anonymous Auth로 접속합니다.
- 사건 접수는 클라이언트 직접 쓰기가 아니라 `submitCase` Callable Function에서 처리합니다.
- 일일 접수 제한과 쿨다운은 서버 트랜잭션으로 검사합니다.
- `generateTrial`은 로그인 여부와 사건 소유자를 검증한 뒤 실행합니다.
- `results` 문서는 소유자, 공개 판결문, 관리자만 읽을 수 있습니다.
- 사용자 입력 및 AI 생성 결과는 화면 렌더링 전 escape 처리합니다.

## 관리자 설정

관리자 권한은 Firestore `admins/{uid}` 문서 존재 여부로 판단합니다.

관리자 페이지에서 설정 가능한 항목:

- 일일 접수 한도
- 재접수 쿨다운
- 금칙어
- 사용량·비용 계산 기준
- 사업자 정보
- 정책 문서

## 배포

```bash
firebase deploy
```

Functions 배포 전 Gemini API Key Secret이 필요합니다.

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

## 주의

본 서비스는 AI 기반 오락 콘텐츠입니다. 생성된 판결문은 실제 법률 자문이나 법원 판결이 아니며 어떠한 법적 효력도 없습니다.
