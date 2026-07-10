# Firebase Storage 배포 IAM 안내

GitHub Actions의 Firebase 서비스 계정에 `firebasestorage.defaultBucket.get` 권한이 없으면 Storage Rules 배포가 실패합니다.

## 원인

GitHub Secret `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`에 저장된 서비스 계정이 Firebase Storage 기본 버킷을 조회하지 못하는 상태입니다.

오류 예시:

```text
Permission 'firebasestorage.defaultBucket.get' denied
```

## 권한 보완

Secret JSON의 `client_email` 값을 확인한 뒤 Google Cloud Console의 IAM에서 해당 서비스 계정에 다음 역할 중 하나를 부여합니다.

- 최소 버킷 조회 권한: `roles/firebasestorage.viewer`
- Firebase Storage 전체 관리가 필요한 경우: `roles/firebasestorage.admin`

`roles/firebasestorage.serviceAgent`는 Google 관리 서비스 에이전트 전용이므로 일반 GitHub Actions 서비스 계정에는 부여하지 않습니다.

Storage Security Rules 자체를 배포할 권한은 기존 Firebase Rules 관련 역할에서 제공되어야 합니다. 조회 권한을 추가한 뒤에도 다른 권한 오류가 나오면 해당 오류에 표시된 권한을 별도로 보완합니다.

## 현재 워크플로 동작

- Functions를 먼저 배포합니다.
- Firestore Rules, Firestore Indexes, Hosting을 핵심 단계로 배포합니다.
- Storage Rules는 별도 단계에서 시도합니다.
- Storage IAM 권한이 부족하면 GitHub Actions에 경고를 남기되 핵심 배포는 실패시키지 않습니다.
- IAM 권한이 추가되면 별도 코드 변경 없이 다음 실행부터 Storage Rules도 자동 배포됩니다.
