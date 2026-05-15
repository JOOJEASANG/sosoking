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

### 1단계 ✅
- [x] 계획서 작성
- [x] 기존 patch/중복 파일 정리 (30개+ 제거)
- [x] 새 CSS 구조 (base, layout, components, pages, responsive)
- [x] router.js, app.js, state.js 작성
- [x] header.js, bottom-nav.js, toast.js

### 2단계 ✅
- [x] home.js (메인 + 사이드바)
- [x] feed.js (무한스크롤 + 필터)
- [x] write.js (3카테고리 15유형 폼)
- [x] feed-card.js, reaction-bar.js

### 3단계 ✅
- [x] image-uploader.js (1600px 자동압축, 드래그앤드롭)
- [x] detail.js (상세 페이지, 투표/퀴즈/삼행시 인터랙션)
- [x] 투표 버그 수정 (read-modify-write 패턴)

### 4단계 ✅
- [x] OX퀴즈, 객관식퀴즈, 주관식퀴즈 인터랙션 (detail.js)
- [x] 삼행시 참여 입력 (detail.js)
- [x] 미친작명소, 나만의노하우 특수 폼 (write.js)
- [x] modal.js 컴포넌트

### 5단계 ✅
- [x] tools/python/ 7개 스크립트
  - generate_sitemap.py, generate_daily_missions.py
  - export_stats.py, cleanup_test_data.py
  - check_bad_words.py, backup_firestore.py
  - generate_admin_report.py

### 6단계 ✅
- [x] account.js, login.js (Google + 이메일)
- [x] mission.js
- [x] admin.js (관리자 대시보드)
- [x] services/ 5개 파일
  - auth-service.js, feed-service.js, upload-service.js
  - user-service.js, admin-service.js

### 7단계 ✅
- [x] 순환 의존성 수정 (state.js 분리)
- [x] Firestore 투표 버그 수정
- [x] firestore.rules v2 업데이트 (feeds/missions/comments)
- [x] storage.rules feeds/ 경로 추가
- [x] firestore.indexes.json v2 쿼리 인덱스 추가
- [x] manifest.json v2 업데이트
- [x] sw.js 캐시 버전 업데이트
- [x] admin/index.html SPA 리다이렉트
- [x] 구버전 파일 완전 제거 (soso-home.js, soso-feed.js, auth.js 등)
