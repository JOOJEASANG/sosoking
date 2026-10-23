# 소소킹 — 새 프로젝트 시작점

사이트를 완전히 다시 구상할 수 있도록 기존 화면과 GitHub 기본 브랜치의 앱 코드를 초기화했습니다.

- 공개 화면: `public/index.html`
- 기존 서비스 오프라인 캐시 정리: `public/reset.js`
- Firebase Hosting 설정: `firebase.json`
- 자동 배포: `.github/workflows/deploy.yml`

## 이전 버전 복구

초기화 직전의 GitHub 전체 파일은 `backup/pre-clean-slate-20261023` 브랜치에 보존했습니다.

## 데이터 주의사항

이번 초기화는 `main` 브랜치의 사이트 소스와 Firebase Hosting의 공개 페이지를 교체합니다.
Firebase Authentication 사용자, Firestore 데이터, 이미 운영 환경에 배포된 Cloud Functions 및 Firebase 프로젝트 자체를 삭제하지 않습니다.
새 사이트 기획에 맞는 클라우드 데이터 정리는 별도 작업이 필요합니다.
