# 소소킹 코드 구조 기준

소소킹은 피드와 게임 기능이 계속 늘어날 예정이므로, 새 기능을 추가할 때 한 파일에 모든 코드를 넣지 않고 역할별로 분리한다.

## 기본 원칙

1. 화면 파일은 페이지 조립만 담당한다.
2. Firestore 읽기/쓰기 코드는 actions 또는 api 파일로 분리한다.
3. 게임 규칙, 승패 판정, 점수 계산은 rules 파일로 분리한다.
4. HTML 문자열 생성은 ui/render 파일로 분리한다.
5. 여러 게임에서 같이 쓰는 함수는 games/common.js에 둔다.
6. 피드에서 같이 쓰는 함수는 feed 또는 components 폴더로 분리한다.
7. 기능 추가 시 기존 동작 파일을 크게 갈아엎기보다, 작은 모듈을 추가하고 연결한다.

## 게임 파일 권장 구조

```txt
public/js/pages/mafia-game.js          라우트 진입, 화면 조립, 이벤트 연결
public/js/games/common.js              게임 공통 함수
public/js/games/mafia/rules.js         역할 배정, 승패 판정, 투표 계산
public/js/games/mafia/actions.js       방 만들기, 참가, 시작, 투표, 집계
public/js/games/mafia/render.js        마피아게임 HTML 렌더링
```

## 피드 파일 권장 구조

```txt
public/js/pages/feed.js                피드 페이지 조립
public/js/feed/query.js                Firestore 조회
public/js/feed/filter.js               필터/정렬 계산
public/js/feed/render.js               검색바, 필터바, 빈 상태 렌더링
public/js/components/feed-card.js      피드 카드 UI
```

## 앞으로 작업 방식

- 새 게임은 반드시 games/{gameName}/ 폴더를 만들고 시작한다.
- 기존 게임을 고칠 때도 가능하면 rules/actions/render로 나눈다.
- 긴 파일은 300~400줄을 넘기기 전에 분리한다.
- 사용자 화면에 영향이 큰 수정은 작은 커밋으로 나눠 반영한다.
- Firestore rules가 바뀌는 작업은 최종 답변에 반드시 명시한다.

## 우선 리팩터링 대상

1. mafia-game.js
   - rules.js: 역할 배정, 생존자 계산, 투표 집계, 승패 판정
   - actions.js: 방 생성, 참가, 시작, 투표, 집계, 리셋
   - render.js: 로비/방/투표 UI HTML

2. liar-game.js
   - common.js 재사용
   - 방 생성/참가 액션 분리
   - 로비/방 화면 렌더 분리

3. feed.js
   - 필터/정렬 계산 분리
   - 검색/무한스크롤 이벤트 분리
