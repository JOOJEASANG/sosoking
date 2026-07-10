# 소소킹 Firebase 배포 운영서

프로젝트 ID는 `sosoking-481e6`입니다.

## 배포 구조

배포는 두 워크플로로 분리합니다.

### 1. Firebase Core 자동배포

파일: `.github/workflows/firebase-deploy.yml`

`main` 푸시 시 다음 순서로 자동 실행됩니다.

1. Functions와 프론트 JavaScript 문법 검사
2. Firestore 보안 계약 및 배포 계약 검사
3. `functions/main.js`의 현재 export 전체 배포
4. 소스에서 제거된 기존 Cloud Functions 폐기
5. Firestore Rules와 Indexes 배포
6. Firebase Hosting 배포

Functions는 개별 이름 목록을 별도로 관리하지 않습니다. 다음 명령을 사용해 현재 소스 전체를 배포합니다.

```bash
firebase deploy --only functions --force --project sosoking-481e6 --non-interactive
```

`--force`는 소스에서 제거된 Function을 운영 환경에서도 정리할 때 확인 질문 없이 진행하기 위해 사용합니다. Functions를 Firestore Rules보다 먼저 배포하는 이유는, 규칙이 클라이언트 직접 쓰기·삭제를 차단하기 전에 필요한 Callable Function이 운영 환경에 존재하도록 하기 위해서입니다.

### 2. Firebase Storage Rules 수동배포

파일: `.github/workflows/firebase-storage-rules.yml`

Storage Rules는 GitHub Actions의 **Deploy Firebase Storage Rules** 워크플로에서 `Run workflow`로 수동 실행합니다.

Storage는 사건 이미지와 프로필 사진에 실제 사용되지만, Firebase Storage 기본 버킷 조회에는 별도 IAM 권한이 필요합니다. 이 권한 문제로 Functions·Firestore·Hosting의 자동배포까지 실패하지 않도록 워크플로를 분리했습니다.

## GitHub Secret

두 워크플로는 다음 Secret을 사용합니다.

```text
FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6
```

값은 Firebase 배포용 서비스 계정 JSON 전체입니다. 서비스 계정을 확인할 때는 JSON의 `client_email` 값을 사용합니다.

## Storage 403 오류 해결

오류 예시:

```text
Permission 'firebasestorage.defaultBucket.get' denied
```

Google Cloud Console의 프로젝트 `sosoking-481e6` IAM에서 Secret JSON의 `client_email` 서비스 계정에 다음 역할을 추가합니다.

```text
Cloud Storage for Firebase Viewer
roles/firebasestorage.viewer
```

이 역할에는 `firebasestorage.defaultBucket.get` 권한이 포함됩니다.

Storage 전체 관리 권한이 필요한 특별한 경우에는 다음 역할을 사용할 수 있지만, 일반 배포 계정에는 최소 권한을 우선합니다.

```text
Cloud Storage for Firebase Admin
roles/firebasestorage.admin
```

`roles/firebasestorage.serviceAgent`는 Google 관리 서비스 에이전트 전용이므로 GitHub Actions 서비스 계정에 부여하지 않습니다.

조회 권한을 추가한 뒤 다른 권한 오류가 발생하면, 오류 메시지에 표시된 Firebase Rules 또는 프로젝트 권한을 추가로 확인해야 합니다.

## Storage Rules 배포 절차

1. Google Cloud IAM에서 서비스 계정 권한을 보완합니다.
2. GitHub 저장소의 **Actions**로 이동합니다.
3. **Deploy Firebase Storage Rules**를 선택합니다.
4. **Run workflow**를 실행합니다.
5. `Deploy Storage Rules` 단계가 성공했는지 확인합니다.

Storage Rules가 수정된 경우 반드시 이 워크플로를 다시 실행합니다.

## 실패 판단 기준

### Core 워크플로 실패

Functions, Firestore, Hosting 중 하나가 실제로 배포되지 않은 상태이므로 원인을 수정한 뒤 다시 실행해야 합니다. 실패를 무시하지 않습니다.

Functions 전체 배포 단계가 실패하면 삭제 예정 Function도 운영 환경에 남을 수 있으므로, 다음 단계로 진행하기 전에 반드시 성공 여부를 확인합니다.

### Storage 워크플로 실패

기존 Storage Rules는 그대로 유지됩니다. 새 규칙만 적용되지 않은 상태입니다. IAM 권한을 보완한 뒤 수동으로 다시 실행합니다.

## 로컬 검증

Functions 의존성을 설치한 뒤 다음 명령을 실행합니다.

```bash
npm install --prefix functions --no-audit --no-fund
npm run lint --prefix functions
```

이 검사는 다음 항목을 포함합니다.

- Functions 및 브라우저 모듈 문법
- Firestore 보안 규칙 계약
- 소스 기준 Functions 전체 배포와 `--force` 적용
- 구형 판결 구조화 Functions 재연결 방지
- Core와 Storage 워크플로 분리
- 공개 설정 접근 경로

## 운영 원칙

- `main`에는 검증이 끝난 PR만 병합합니다.
- Functions 이름을 워크플로에 중복 하드코딩하지 않습니다.
- 배포 오류를 `continue-on-error`로 숨기지 않습니다.
- Storage 권한 문제는 Core 배포와 분리하되, Storage Rules 변경 시 수동 배포를 누락하지 않습니다.
- 서비스 계정 JSON이나 Gemini API 키는 저장소 파일에 기록하지 않습니다.
