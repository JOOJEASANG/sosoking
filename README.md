# 소소킹 재구축 베이스라인

기존 애플리케이션 코드를 제거하고 Firebase 배포와 Gemini Secret 연결에 필요한 최소 파일만 남긴 초기화 상태입니다.

## 남아 있는 구성

- Firebase Hosting: `public/index.html` 재구축 안내 페이지
- Cloud Functions: 인증된 사용자만 호출 가능한 `systemHealth`
- Gemini Secret: Firebase Secret Manager의 `GEMINI_API_KEY`를 함수에 바인딩
- Firestore: 기존 데이터는 삭제하지 않고 임시로 모든 클라이언트 접근 차단
- Storage: 기존 파일은 삭제하지 않고 임시로 모든 접근 차단
- GitHub Actions: `main` 병합 시 Functions, Firestore, Hosting 자동 배포
- Storage Rules: 수동 워크플로로만 배포

## GitHub Secrets

- `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`

## Firebase Secrets

- `GEMINI_API_KEY`

Gemini 실제 키 값은 저장소에 포함하지 않습니다. Firebase Secret Manager에 저장된 기존 값은 코드 초기화로 삭제되지 않습니다.

## 주의

이 초기화 변경을 `main`에 병합하면 현재 Hosting은 재구축 안내 페이지로 교체되고, 현재 소스에서 내보내지 않는 기존 Cloud Functions는 `--force` 배포 과정에서 제거됩니다. Firestore 문서와 Storage 파일 자체는 삭제하지 않습니다.
