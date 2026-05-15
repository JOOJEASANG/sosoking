# 소소킹 v2 재제작 계획서

## 목표
글과 사진 중심의 깔끔한 게임형 커뮤니티. 3개 카테고리, 15개 유형.

## 브랜치 전략
- main: 현재 상태 보관
- claude/project-plan-execution-NCENL: v2 재제작 작업 브랜치

## 유지 파일
- firebase.json, .firebaserc, firestore.rules, storage.rules
- public/js/firebase-config.js (Firebase 설정값)
- 아이콘/이미지/PWA 파일들

## 카테고리 구조
1. 골라봐: 밸런스게임, 민심투표, 선택지배틀, OX퀴즈, 내맘대로퀴즈
2. 웃겨봐: 미친작명소, 삼행시짓기, 댓글배틀, 웃참챌린지, 한줄드립
3. 말해봐: 나만의노하우, 경험담, 실패담, 고민/질문, 막장릴레이

## 파일 구조
```
public/
  index.html
  css/
    base.css        - 변수, 리셋, 타이포
    layout.css      - 컨테이너, 그리드, 사이드바
    components.css  - 버튼, 카드, 입력창, 배지
    pages.css       - 페이지별 스타일
    responsive.css  - 모바일 반응형
  js/
    firebase.js       - Firebase 초기화
    app.js            - 앱 상태/초기화
    router.js         - SPA 라우터
    services/
      auth-service.js
      feed-service.js
      upload-service.js
      quiz-service.js
      user-service.js
      admin-service.js
    components/
      header.js
      bottom-nav.js
      toast.js
      modal.js
      image-uploader.js
      feed-card.js
      quiz-box.js
      acrostic-box.js
      reaction-bar.js
    pages/
      home.js
      feed.js
      write.js
      detail.js
      mission.js
      account.js
      login.js
      guide.js
      admin.js

tools/python/
  generate_sitemap.py
  generate_daily_missions.py
  export_stats.py
  cleanup_test_data.py
  check_bad_words.py
  backup_firestore.py
  generate_admin_report.py
```

## 단계별 진행

### 1단계 (현재)
- [x] 계획서 작성
- [ ] 기존 patch/중복 파일 정리
- [ ] 새 CSS 구조 (base, layout, components, pages, responsive)
- [ ] router.js, app.js 작성
- [ ] header.js, bottom-nav.js, toast.js

### 2단계
- [ ] home.js (메인 + 사이드바)
- [ ] feed.js (피드 + 필터)
- [ ] write.js (3카테고리 15유형 폼)
- [ ] feed-card.js, reaction-bar.js

### 3단계
- [ ] image-uploader.js (압축, 자르기)
- [ ] detail.js (상세 페이지)
- [ ] feed-service.js (댓글, 투표 기능)

### 4단계
- [ ] quiz-box.js (OX, 객관식, 주관식)
- [ ] acrostic-box.js (삼행시)
- [ ] feed-card 특수 유형 (미친작명소, 나만의노하우)

### 5단계
- [ ] tools/python/ 7개 스크립트

### 6단계
- [ ] account.js, login.js
- [ ] mission.js
- [ ] admin.js

### 7단계
- [ ] PC/모바일 QA
- [ ] 오류 수정
- [ ] 운영 배포
