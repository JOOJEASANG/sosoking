# 소소킹 운영 배포 절차

운영 배포는 `main` 브랜치에 병합된 커밋만 대상으로 합니다. 기능 브랜치와 초안 PR에서는 정적검사와 Hosting 미리보기만 수행합니다.

## 1. 병합 전 필수 확인

### GitHub Actions 설정

- `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`가 등록되어 있어야 합니다.
- 사용하는 AI 공급자의 `GEMINI_API_KEY` 또는 `ANTHROPIC_API_KEY`가 등록되어 있거나 Firebase Secret Manager에 기존 값이 있어야 합니다.
- 서비스 계정은 다음 작업을 수행할 수 있어야 합니다.
  - Firebase Hosting 배포
  - Cloud Functions 배포
  - Firestore Rules와 Indexes 배포
  - Cloud Storage Rules 배포
  - Functions가 사용할 관리형 비밀 참조와 새 버전 등록

위 비밀값의 존재 여부와 IAM 권한은 저장소 정적검사만으로 확인할 수 없으므로 Firebase Console과 GitHub 저장소 설정에서 사람이 직접 확인합니다.

### Firebase 설정

- `config/ai_king.activeModel`은 실제 사용할 공급자와 일치해야 합니다.
- AI 인증 정보가 `config/ai` 또는 `config/ai_king` 문서에 평문으로 남아 있지 않아야 합니다.
- Firestore 복합 인덱스에 `materials(status, createdAt)`와 `materials(status, commentCount)`가 포함되어야 합니다.
- Storage Rules는 `feeds/{uid}`의 제한된 이미지 형식만 허용하고 `soso-feed` 신규 쓰기를 차단해야 합니다.

### PR 검사

- `Check and Deploy Firebase Hosting` 성공
- `Firebase Hosting Preview` 성공
- PC·모바일 캡처에서 홈·판결소·창작소·상담소·토론방·내정보 확인
- 이용약관과 개인정보처리방침의 새 서비스 내용 확인
- PR이 mergeable 상태인지 확인

## 2. main 병합 후 자동 배포 순서

1. Hosting workflow가 저장소 검사를 다시 수행합니다.
2. Backend workflow가 저장소 검사를 다시 수행합니다.
3. Firestore Rules와 Indexes를 배포합니다.
4. Storage Rules를 배포합니다.
5. Cloud Functions를 배포하고 더 이상 export하지 않는 구형 Functions를 정리합니다.
6. Hosting을 운영 채널에 배포합니다.

어느 단계든 실패하면 해당 workflow는 실패 상태로 남겨야 하며 오류를 무시하고 다음 단계로 진행하지 않습니다.

## 3. 배포 직후 점검

- 비로그인 홈과 토론방 열기
- 로그인, 로그아웃, 내정보 열기
- 판결소에서 캐릭터 3명 선택 후 결과 생성
- 창작소 말투변환과 작명 각각 실행
- 상담소 결과 생성
- 결과가 공개 피드에 자동 등록되지 않는지 확인
- 내정보에서 개인 AI 결과 열기·복사·삭제
- 자료실 최신순 조회
- 자료 상세 조회, 투표 변경, 댓글 작성
- 같은 계정으로 5초 이내 댓글 반복 시 제한되는지 확인
- 새 이미지 업로드와 기존 이미지 표시 확인
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

### Rules 장애

1. 직전 정상 Rules 파일을 복원합니다.
2. Firestore와 Storage Rules를 다시 배포합니다.
3. 클라이언트 직접 쓰기 권한을 임시로 넓혀 장애를 우회하지 않습니다.

### AI 공급자 장애

1. `config/ai_king.activeModel`을 사용 가능한 공급자로 변경합니다.
2. 관리형 비밀이 연결되어 있는지 확인합니다.
3. 인증 정보를 Firestore나 프런트엔드 코드에 임시 저장하지 않습니다.

## 5. 운영 승인 원칙

- 초안 PR 상태에서는 운영에 병합하지 않습니다.
- 최종 검사 성공 후 운영자가 명시적으로 승인한 경우에만 PR을 Ready 상태로 전환하고 병합합니다.
- 자동 병합은 사용하지 않습니다.
