# 소소킹

생활 고민을 개성 강한 AI 캐릭터들과 판결하고, 바꿔 말하고, 이름 짓고, 상담하고, 함께 토론하는 Firebase 기반 참여형 웹앱입니다.

## 핵심 화면

- **판결소**: 상황을 입력하고 캐릭터 판사 3명의 판결을 받습니다.
- **창작소**: 캐릭터 말투 변환과 작명을 제공합니다.
- **상담소**: 캐릭터 상담사 3명이 서로 다른 관점으로 답합니다.
- **토론방**: 생활분쟁·소비자·민원 주제에 찬반 투표와 댓글로 참여합니다.
- **자료실**: 토론에 필요한 배경자료를 짧게 정리합니다.

## 기술 구성

- Firebase Hosting
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase, Node.js 22
- Firebase Storage
- Gemini 또는 Anthropic 기반 AI 캐릭터 기능
- 별도 번들러 없이 동작하는 ES Module SPA

## 로컬 검사

```bash
npm ci
cd functions && npm ci && cd ..
npm run check
```

검사 항목에는 JavaScript 문법, 로컬 import·정적 파일 존재 여부, Firebase rewrite 함수, 배포 워크플로 안전 설정이 포함됩니다.

## 배포 구조

운영 배포는 `main` 브랜치에서만 실행합니다.

- `public/**` 변경: Hosting 검사 및 배포
- `functions/**`, Firestore 설정 변경: 백엔드 검사 및 배포
- 기능 개발 브랜치: 운영 자동 배포 금지

```bash
firebase login
firebase use sosoking-481e6
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

## AI 설정

기존 AI킹 엔진은 Firestore `config/ai_king` 설정을 사용합니다. 새 설정을 추가할 때 API 키를 프런트 코드나 공개 문서에 기록하지 마세요. 장기적으로 모든 키를 Firebase Secret Manager로 이전하는 작업을 진행합니다.

## 운영상 주요 보안 구조

- 투표·반응·조회수·AI 기능은 Callable Function에서 처리합니다.
- 관리자 여부는 `admins/{uid}` 문서와 인증 토큰으로 확인합니다.
- Firestore Rules는 포인트·투표 카운터·관리자 설정의 클라이언트 직접 조작을 차단합니다.
- 이미지 업로드는 로그인, 파일 시그니처, 크기, 일일 쿼터를 서버에서 검사합니다.

## 개편 원칙

1. 기능이 확인되지 않은 레거시 파일은 바로 삭제하지 않고 참조 여부를 먼저 검사합니다.
2. 새 기능은 기존 보조 패치 파일보다 명확한 페이지·컴포넌트·Functions 모듈로 구현합니다.
3. 사용자에게 노출되는 미완성 버튼은 만들지 않습니다.
4. 운영 배포 전 `npm run check` 통과를 필수로 합니다.
