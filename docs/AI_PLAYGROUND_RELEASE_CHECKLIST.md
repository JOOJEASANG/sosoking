# AI 캐릭터 놀이터 운영 전환 체크리스트

## 병합 전 자동 확인

- [ ] `Check and Deploy Firebase Hosting` 성공
- [ ] `Firebase Hosting Preview` 성공
- [ ] 홈·판결소·창작소·상담소·토론방·내정보 PC·모바일 화면 확인
- [ ] 구형 AI 엔진과 정치게임 Functions가 배포 표면에 없는지 확인
- [ ] Firestore·Storage Rules와 Functions 배포 명령 검사
- [ ] 이용약관·개인정보처리방침 정합성 검사

## 병합 전 수동 확인

- [ ] GitHub의 Firebase 서비스 계정 비밀값 존재 확인
- [ ] 사용할 AI 공급자의 관리형 비밀 존재 확인
- [ ] 서비스 계정의 Hosting·Functions·Firestore·Storage·Secret Manager 권한 확인
- [ ] Firebase의 `config/ai_king.activeModel` 확인
- [ ] Firestore 문서에 과거 평문 AI 인증 정보가 남지 않았는지 확인

## 병합 후 자동 처리

1. Firestore Rules와 Indexes를 배포합니다.
2. Storage Rules를 배포합니다.
3. Functions를 배포하면서 제거된 구형 Functions를 정리합니다.
4. Hosting을 운영 채널에 배포합니다.

## 배포 직후 수동 확인

- [ ] 로그인·로그아웃·내정보 확인
- [ ] 판결·말투변환·작명·상담을 각각 한 번 실행
- [ ] 판결 결과가 공개 피드에 자동 등록되지 않는지 확인
- [ ] 개인 결과 열기·복사·삭제 확인
- [ ] 자료 조회·투표 변경·댓글 작성 확인
- [ ] 새 이미지 업로드와 기존 이미지 표시 확인
- [ ] 브라우저 콘솔과 Functions 로그 확인

## 문제 발생 시

`docs/PRODUCTION_RELEASE.md`의 복구 절차에 따라 화면, Functions, Rules를 구분하여 직전 정상 버전으로 되돌립니다. 사용자 데이터나 개인 AI 결과는 장애 우회를 위해 임의로 삭제하지 않습니다.

## 승인 원칙

초안 PR은 운영에 병합하지 않습니다. 운영자가 명시적으로 승인한 뒤에만 Ready 상태로 전환하며 자동 병합은 사용하지 않습니다.
