# 소소킹 운영 배포 절차

운영 배포는 `main` 브랜치에 병합된 커밋만 대상으로 합니다. 기능 브랜치와 PR에서는 저장소 정적검사와 로컬 정적 서버 기반 PC·모바일 브라우저 검사를 수행합니다.

## 1. 병합 전 필수 확인

### GitHub Actions 설정

- `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`가 등록되어 있어야 합니다.
- 현재 Functions가 선언하는 `GEMINI_API_KEY`가 Firebase Secret Manager에 등록되어 있어야 합니다.
- Anthropic을 실제 운영 공급자로 사용하려면 `ANTHROPIC_API_KEY` 등록뿐 아니라 `AI_RUNTIME_SECRETS` 배포 선언도 함께 변경해야 합니다.
- 서비스 계정은 Firebase Hosting, Cloud Functions, Firestore Rules·Indexes, Cloud Storage Rules 배포 권한을 가져야 합니다.

비밀값의 존재 여부와 IAM 권한은 저장소 정적검사만으로 확인할 수 없으므로 Firebase Console과 GitHub 저장소 설정에서 사람이 직접 확인합니다.

### Firebase 설정

- `config/ai_king.activeModel`은 실제 배포된 Secret 공급자와 일치해야 합니다.
- AI 인증 정보가 `config/ai` 또는 `config/ai_king` 문서에 평문으로 남아 있지 않아야 합니다.
- Firestore 복합 인덱스에 `materials(status, createdAt)`, `debates(status, createdAt)`, `debates(status, commentCount)`가 포함되어야 합니다.
- Storage Rules는 `feeds/{uid}`의 제한된 이미지 형식만 허용하고 자료·토론 이미지 경로의 클라이언트 쓰기를 차단해야 합니다.
- Firebase Hosting 사이트 ID, 사용자 도메인, DNS와 SSL 상태를 별도로 확인해야 합니다.

### PR 검사

- 저장소 `npm run check` 성공
- `Check and Deploy Firebase Hosting` 정적검사 성공
- `Preview UI Check`의 로컬 정적 서버 시작 성공
- Chromium 데스크톱·모바일 화면 검사 성공
- 홈·판결소·창작소·미친 상담소·오늘의 콘텐츠·자료실·토론실·이용안내·이용약관·개인정보처리방침·내정보 화면 확인
- 자바스크립트 페이지 오류, 정적 파일 404와 가로 넘침이 없는지 확인
- 관리자 운영센터의 메뉴·callable export·콘텐츠 삭제 계약은 저장소 자동검사로 확인
- 실제 관리자 데이터 조회·상태 변경·삭제는 운영 권한이 있는 테스트 계정으로 별도 확인
- 이용약관, 개인정보처리방침, 이용안내와 README가 현재 기능과 일치하는지 확인
- PR이 mergeable 상태인지 확인

PR 브라우저 검사는 Firebase Preview 채널 상태와 무관하게 저장소의 `public` 폴더를 로컬 서버로 제공해 실행합니다. Firebase 운영 Hosting 배포는 `main` 병합 후 별도 workflow가 수행합니다.

## 2. main 병합 후 자동 배포 순서

1. Hosting workflow가 저장소 검사를 다시 수행합니다.
2. Backend workflow가 저장소 검사를 다시 수행합니다.
3. Backend workflow는 Firestore Rules, Indexes, Storage Rules, Functions를 각각 실행해 모든 단계의 결과를 수집합니다.
4. 어느 한 단계라도 실패하면 마지막 검증 단계에서 Backend workflow 전체를 실패 처리합니다.
5. Hosting workflow가 운영 Hosting 채널에 정적 파일을 배포합니다.

Backend 각 단계는 진단을 위해 앞 단계가 실패해도 실행될 수 있지만, 실패를 성공으로 처리해서는 안 됩니다.

## 3. 배포 직후 점검

- Firebase 제공 Hosting 주소에서 비로그인 홈과 각 메뉴 열기
- 사용자 도메인이 같은 화면을 반환하는지 확인
- 로그인, 로그아웃, 내정보 열기
- 카카오 OAuth redirect URI와 실제 접속 도메인이 일치하는지 확인
- 판결소·창작소·미친 상담소 결과 생성
- 캐릭터 미선택 시 판결소·상담소에서 무작위 캐릭터 3명이 배정되는지 확인
- AI 결과가 공개 콘텐츠에 자동 등록되지 않는지 확인
- 내정보에서 개인 AI 결과 열기·복사·삭제
- 자료실 목록·상세·회원 자료 등록·댓글 작성
- 토론실 목록·상세·회원 토론 등록·A/B 투표·댓글 작성
- 토론 댓글의 별도 중립 선택창이 보이지 않고 실제 A/B 투표와 자동 연동되는지 확인
- 큰 이미지가 원본보다 확대되지 않고 약 1.8MB 이하로 최적화되는지 확인
- 이용안내·이용약관·개인정보처리방침의 공개 범위와 탈퇴 정책 확인
- 관리자 운영 현황, 자료·토론 필터와 상태 변경, 초안 등록, 생성 기록, AI 설정, 회원 검색, 신고·문의 상태 변경 확인
- 관리자 콘텐츠 삭제 시 하위 댓글·투표·조회 이벤트와 연결 이미지가 함께 삭제되는지 테스트 콘텐츠로 확인
- 회원 탈퇴 테스트 계정의 Firestore 문서·Storage 파일·Auth 계정이 삭제되는지 확인
- 브라우저 콘솔과 Functions 로그에서 새 오류 확인

## 4. 장애 발생 시 복구

### 화면 장애

1. Firebase Hosting에서 직전 정상 릴리스를 다시 활성화합니다.
2. 문제 커밋을 되돌리는 PR을 만듭니다.
3. 검사 성공 후 `main`에 병합합니다.

### Functions 장애

1. 문제 Functions 변경만 되돌리는 PR을 만듭니다.
2. 개인 AI 결과와 사용자 데이터를 임의로 삭제하지 않습니다.
3. Backend workflow로 Rules와 Functions를 다시 배포합니다.

### 관리자 기능 장애

1. 관리자 화면에서 대량 삭제나 상태 변경을 중단합니다.
2. Functions 로그에서 관리자 callable 이름과 오류 코드를 확인합니다.
3. 삭제된 문서의 최소 기록은 `deleted_posts`에서 확인하되 개인 데이터 복원 근거로 임의 사용하지 않습니다.
4. 테스트 문서로 재귀 삭제와 Storage 파일 삭제를 확인한 후 운영 작업을 재개합니다.

### Rules 장애

1. 직전 정상 Rules 파일을 복원합니다.
2. Firestore와 Storage Rules를 다시 배포합니다.
3. 클라이언트 직접 쓰기 권한을 임시로 넓혀 장애를 우회하지 않습니다.

### AI 공급자 장애

1. 현재 Functions에 실제로 연결된 공급자 Secret을 확인합니다.
2. `config/ai_king.activeModel`을 배포된 공급자와 일치시킵니다.
3. 인증 정보를 Firestore나 프런트엔드 코드에 임시 저장하지 않습니다.

### 사용자 도메인 장애

1. Firebase Console에서 저장소가 배포되는 Hosting 사이트 ID를 확인합니다.
2. `sosoking.co.kr`과 `www.sosoking.co.kr`이 다른 사이트에 연결돼 있지 않은지 확인합니다.
3. Firebase가 안내한 DNS 레코드와 SSL 연결 상태를 확인합니다.
4. 다른 서비스가 운영 중인 사이트를 추측으로 덮어쓰지 않습니다.

## 5. 운영 승인 원칙

- 초안 PR 상태에서는 운영에 병합하지 않습니다.
- 정적검사, 로컬 브라우저 검사와 실제 운영 배포 결과를 구분하여 확인합니다.
- 최종 검사 성공 후 운영자가 승인한 변경만 `main`에 병합합니다.
- 자동 병합은 사용하지 않습니다.
