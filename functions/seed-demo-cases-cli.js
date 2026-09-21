'use strict';

// Demo cases seed script — run locally:
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json \
//   GOOGLE_CLOUD_PROJECT=sosoking-481e6 \
//   node functions/seed-demo-cases-cli.js

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const JUDGE_TYPES = ['꼰대형', '냉혈형', '회피형', '추궁형', '오버형', '드립형', '빙의형'];

function randomJudge() {
  return JUDGE_TYPES[Math.floor(Math.random() * JUDGE_TYPES.length)];
}

function makeDocket(i) {
  return `소소260921-생활판결-${1001 + i}`;
}

function hoursAgo(h) {
  return Timestamp.fromDate(new Date(Date.now() - h * 3600 * 1000));
}

const CASES = [
  {
    nickname: '억울한직장인',
    judgeType: '추궁형',
    grievanceIndex: 8,
    caseTitle: '팀장 아이디어 무단 취식 사건',
    caseDescription: '기획 회의에서 제가 6페이지 분량으로 준비한 보고서 핵심 아이디어를, 팀장이 다음날 임원 앞에서 마치 본인이 어제 밤 구상한 것처럼 발표했습니다. 저는 참고자료에 이름 한 줄도 없었습니다. 회의록에는 분명히 제 이름이 있지만, 팀장은 "팀이 같이 낸 아이디어"라고 주장합니다.',
    hoursAgo: 2
  },
  {
    nickname: '분노한라면러버',
    judgeType: '냉혈형',
    grievanceIndex: 7,
    caseTitle: '공용 냉장고 도시락 무단 취식 사건',
    caseDescription: '회사 공용 냉장고에 이름표 붙여 넣어둔 제 도시락이 점심시간에 사라졌습니다. CCTV 사각지대라 범인을 특정할 수 없으나, 당일 오전 내내 빈속으로 일한 저의 오후 업무 집중도 손실과 정신적 피해를 보상받고 싶습니다. 해당 도시락은 새벽 6시에 직접 만든 제육볶음이었습니다.',
    hoursAgo: 5
  },
  {
    nickname: '황당한충전기수호자',
    judgeType: '드립형',
    grievanceIndex: 6,
    caseTitle: '충전기 무한 대여 미반납 사건',
    caseDescription: '3개월 전 옆자리 동료에게 "잠깐만요" 한다며 빌려간 맥북 충전기가 아직 돌아오지 않았습니다. 동료는 자리를 두 번 이동했고, 현재 제 충전기는 동료 서랍에 정착해 있습니다. "곧 살 거야"를 네 번 들었습니다. 충전기 원가는 79,000원이며 이 금액보다 정신적 피해가 더 큽니다.',
    hoursAgo: 8
  },
  {
    nickname: '지친리모컨분실자',
    judgeType: '꼰대형',
    grievanceIndex: 5,
    caseTitle: '회의실 50분 선점 무단 점거 사건',
    caseDescription: '오후 2시 회의실을 2주 전 예약했습니다. 당일 가보니 영업팀이 점거 중이었고, "긴급 통화 있어서요, 10분만요"가 결국 50분이 됐습니다. 저는 복도에서 노트북 들고 서서 화상회의를 진행해야 했으며, 그 사이 클라이언트에게 배경이 창문 청소 아저씨로 노출됐습니다.',
    hoursAgo: 12
  },
  {
    nickname: '안타까운과자지킴이',
    judgeType: '오버형',
    grievanceIndex: 9,
    caseTitle: '재택근무 배경화면 복장 지적 사건',
    caseDescription: '화상회의 중 팀장이 "배경 좀 정리하세요"라고 했습니다. 저는 버추얼 배경을 쓰고 있었고, 문제의 배경은 공식 회사 제공 배경이었습니다. 팀장이 지적한 것은 제 실제 방이 아니라 배경 이미지에 있는 책장이었으며, 그 책장은 픽셀이었습니다. 회의 참석자 8명이 목격했습니다.',
    hoursAgo: 15
  },
  {
    nickname: '황당한냉장고파수꾼',
    judgeType: '회피형',
    grievanceIndex: 6,
    caseTitle: '점심 메뉴 7연속 독재 사건',
    caseDescription: '우리 팀 점심은 7주 연속으로 같은 식당입니다. 팀원 5명 중 4명이 매번 다른 식당을 원하지만, 막내가 매주 "저 거기밖에 못 먹어요"를 외칩니다. 팀장은 "화합"을 이유로 매번 동의합니다. 저는 7주간 같은 순두부찌개를 먹었고 이제 순두부만 보면 팀장 얼굴이 겹쳐 보입니다.',
    hoursAgo: 20
  },
  {
    nickname: '기막힌아무개',
    judgeType: '추궁형',
    grievanceIndex: 8,
    caseTitle: '카풀 비용 3개월 미지급 사건',
    caseDescription: '같은 방향 거주 동료와 6개월째 카풀 중입니다. 처음 3개월은 비용을 나눴는데, 최근 3개월은 동료가 "다음에 밥 살게"를 반복합니다. 누적 미지급액은 약 12만 원이며, 밥은 한 번도 없었습니다. 거절하면 매일 아침 출근길이 어색해질 것을 우려해 말을 못 하고 있습니다.',
    hoursAgo: 24
  },
  {
    nickname: '슬픈직장인',
    judgeType: '드립형',
    grievanceIndex: 5,
    caseTitle: '회식 2차 강제 동반 사건',
    caseDescription: '1차 회식 후 귀가 의사를 명확히 밝혔으나, 팀장이 "오늘은 다 같이 가야지"를 세 번 반복했습니다. 결국 원치 않는 노래방에서 두 시간을 보냈으며, 저는 마이크를 한 번도 잡지 않았음에도 십만 원이 나왔습니다. 해당 비용의 반환과 2시간 자유 시간 반환을 요청합니다.',
    hoursAgo: 30
  },
  {
    nickname: '억울한집사',
    judgeType: '냉혈형',
    grievanceIndex: 7,
    caseTitle: '아파트 주차 구역 상습 침범 사건',
    caseDescription: '제 주차 구역 101호에 매주 화요일 저녁 외부 차량이 주차됩니다. 경비실에 6번 신고했고, 차량 주인은 그때마다 "잠깐이었다"고 합니다. 가장 긴 "잠깐"은 8시간이었습니다. 저는 그날 밤 세 블록 떨어진 유료 주차장을 이용했으며 비용은 7,000원이었습니다.',
    hoursAgo: 36
  },
  {
    nickname: '분노한아무개',
    judgeType: '오버형',
    grievanceIndex: 9,
    caseTitle: '위층 새벽 쿵쿵 진동 소음 사건',
    caseDescription: '위층에서 매일 밤 11시 30분에서 자정 사이에 쿵쿵거리는 소리가 납니다. 관리실 중재로 위층 주민은 "줄넘기 운동"이라고 답했습니다. 저는 아파트 내부에서의 줄넘기가 합리적인 행위인지 묻고 싶습니다. 해당 소음으로 6주간 수면 중 3회 이상 깨고 있으며 다음날 업무에 지장이 있습니다.',
    hoursAgo: 40
  },
  {
    nickname: '당황한직장인',
    judgeType: '꼰대형',
    grievanceIndex: 6,
    caseTitle: '택배 무단 수령 및 미전달 사건',
    caseDescription: '부재 시 경비실에 맡겨달라고 명시한 택배를 옆집에서 수령했습니다. 이틀 뒤 "아 그거 있어요"라며 건네줬는데, 박스가 뜯긴 흔적이 있었고 내용물 중 과자 한 봉지가 없었습니다. 옆집은 "배송 중 파손된 것 같다"고 주장합니다. 저는 과자의 소재를 밝혀달라고 요청합니다.',
    hoursAgo: 48
  },
  {
    nickname: '지친집사',
    judgeType: '회피형',
    grievanceIndex: 5,
    caseTitle: '공용 쓰레기 분리수거 꼼수 혼입 사건',
    caseDescription: '우리 동 분리수거함에 누군가 플라스틱 봉지 안에 일반 쓰레기를 숨겨서 재활용함에 넣고 있습니다. 저는 세 번 현장을 목격했고 두 번은 같은 사람이었습니다. 본인에게 말했더니 "저 아닌데요"라고 했으나, 그 봉지 안에 그분 이름이 적힌 약봉투가 있었습니다.',
    hoursAgo: 52
  },
  {
    nickname: '황당한라면러버',
    judgeType: '드립형',
    grievanceIndex: 7,
    caseTitle: '넷플릭스 계정 무단 무기한 사용 사건',
    caseDescription: '"잠깐만 써도 돼?"로 시작한 친구의 넷플릭스 접속이 11개월째입니다. 매달 구독료를 저 혼자 내고 있으며, 친구의 시청 기록은 제 알고리즘을 완전히 점령했습니다. 현재 제 메인 화면 추천 콘텐츠는 전부 친구 취향입니다. 저는 스릴러를 좋아하는데 홈 화면이 온통 로맨스입니다.',
    hoursAgo: 60
  },
  {
    nickname: '억울한과자지킴이',
    judgeType: '추궁형',
    grievanceIndex: 8,
    caseTitle: '카카오톡 2시간 읽씹 후 단톡 활동 사건',
    caseDescription: '중요한 업무 관련 메시지를 보낸 지 2시간이 지나도 답이 없었습니다. 그러나 상대방은 그 사이 공동 단톡방에서 밈을 공유했고 인스타그램 스토리를 두 개 올렸습니다. 상대방은 나중에 "못 봤다"고 했으나, 카톡은 읽음 표시가 되어있었습니다. 저는 이 모순에 대한 해명을 요구합니다.',
    hoursAgo: 65
  },
  {
    nickname: '분노한충전기수호자',
    judgeType: '냉혈형',
    grievanceIndex: 6,
    caseTitle: '밀린 돈 14만 원 만기 초과 사건',
    caseDescription: '8개월 전 급하다는 친구에게 14만 원을 빌려줬습니다. 두 달 내로 갚겠다고 했습니다. 이후 갚는다는 말을 다섯 번 들었고 실제 상환은 없었습니다. 친구는 지난달 신형 아이패드를 구입했습니다. 저는 14만 원보다 이 우선순위에 대한 설명을 더 원합니다.',
    hoursAgo: 72
  },
  {
    nickname: '안타까운리모컨분실자',
    judgeType: '오버형',
    grievanceIndex: 9,
    caseTitle: '카페 콘센트 자리 장기 점령 사건',
    caseDescription: '콘센트 있는 자리를 잡기 위해 카페 오픈 10분 전에 도착했습니다. 그러나 이미 노트북 가방이 놓여 있었고, 주인은 40분 후에 나타났습니다. 가방으로 자리를 맡아두는 행위가 정당한지, 그리고 오픈 전 선점이 정당한지, 두 주장이 충돌할 경우 누가 우선인지 판결을 요청합니다.',
    hoursAgo: 78
  },
  {
    nickname: '기막힌냉장고파수꾼',
    judgeType: '빙의형',
    grievanceIndex: 7,
    caseTitle: '독서실 무선 이어폰 음악 소음 유출 사건',
    caseDescription: '독서실에서 옆자리 이용자의 이어폰 음악이 새어나오고 있습니다. 해당 이용자는 볼륨을 본인 기준으로 "적당"하게 설정했으나 2미터 거리에서도 가사가 들립니다. 이미 한 번 매니저가 주의를 줬고 잠시 낮아졌다가 30분 후 원래 볼륨으로 복구됐습니다.',
    hoursAgo: 85
  },
  {
    nickname: '슬픈직장인',
    judgeType: '꼰대형',
    grievanceIndex: 5,
    caseTitle: '연차 신청 선점 갑질 사건',
    caseDescription: '6개월 전부터 계획한 여행을 위해 연차를 신청했더니, 같은 날 동료가 이미 신청되어 있었습니다. 동료는 제 여행 계획을 팀 대화에서 들은 다음 날 미리 신청했습니다. 팀장은 "먼저 신청한 사람 우선"이라는 원칙을 적용했습니다. 저는 이 우선권 취득 방식의 도덕성을 묻고 싶습니다.',
    hoursAgo: 90
  },
  {
    nickname: '황당한아무개',
    judgeType: '드립형',
    grievanceIndex: 8,
    caseTitle: '배달 치킨 조각 배분 불공정 사건',
    caseDescription: '가족 4인이 치킨을 시켰습니다. 드럼 2개 넓적다리 2개 날개 4개 구성인데, 아버지가 배분 전 드럼 하나를 선취하셨습니다. 잔여 배분은 "알아서 가져가"였고 결과적으로 저는 날개 한 개를 받았습니다. 아버지는 가장이 먼저 먹는 것이 전통이라고 주장하십니다.',
    hoursAgo: 96
  },
  {
    nickname: '당황한집사',
    judgeType: '추궁형',
    grievanceIndex: 7,
    caseTitle: '단톡방 무단 퇴장 타이밍 논란 사건',
    caseDescription: '모임 단톡방에서 행사가 끝난 다음날 조용히 퇴장했습니다. 이후 만난 멤버들이 "왜 퇴장했냐"며 섭섭함을 표했습니다. 저는 행사가 끝나면 목적이 달성된 방은 나가는 게 자연스럽다고 생각합니다. 얼마나 기다려야 퇴장이 허용되는지 기준이 필요합니다.',
    hoursAgo: 100
  },
  {
    nickname: '지친과자지킴이',
    judgeType: '회피형',
    grievanceIndex: 6,
    caseTitle: '강아지 목줄 미착용 산책 위협 사건',
    caseDescription: '산책 중 목줄 없는 대형견이 저를 향해 달려왔습니다. 견주는 10미터 뒤에서 "안 물어요!"를 외쳤습니다. 저는 넘어지며 무릎을 긁혔습니다. 견주는 "원래 낯선 사람한테 그래요, 습관이에요"라고 설명했습니다. 저는 이 설명이 면죄부가 되는지 여부를 묻습니다.',
    hoursAgo: 110
  },
  {
    nickname: '억울한라면러버',
    judgeType: '냉혈형',
    grievanceIndex: 8,
    caseTitle: '공용 우산 사적 점유 사건',
    caseDescription: '회사 우산꽂이의 공용 우산이 비 오는 날마다 사라집니다. 조사 결과 특정 팀원이 매번 가져가고, 비가 그치면 자기 자리 우산꽂이에 꽂아 보관합니다. 팀원은 "내가 여기 뒀잖아요"라고 하지만 그것은 본인 자리이고 우산은 공용입니다. 해당 우산의 법적 귀속을 판결해주십시오.',
    hoursAgo: 115
  },
  {
    nickname: '분노한집사',
    judgeType: '오버형',
    grievanceIndex: 9,
    caseTitle: '줄서기 노골적 새치기 3회 반복 사건',
    caseDescription: '편의점 계산대 줄에서 뒤에 선 사람이 제 앞 빈 공간(앞 사람과의 자연적 간격 30cm)을 파고들었습니다. 한 번은 실수라 여겼고 두 번째도 넘어갔습니다. 세 번째에는 제가 직접 말했더니 "몰랐어요"라고 했습니다. 같은 줄에서 세 번 모르는 것이 가능한지 여부를 판결해주십시오.',
    hoursAgo: 120
  },
  {
    nickname: '기막힌충전기수호자',
    judgeType: '드립형',
    grievanceIndex: 7,
    caseTitle: '청첩장 모바일 수신 후 실물 미발송 항의 사건',
    caseDescription: '지인에게 모바일 청첩장을 받았습니다. 결혼식에 참석했고 축의금을 했습니다. 이후 지인이 "왜 실물 청첩장 안 달라 그랬냐"며 섭섭함을 표했습니다. 저는 모바일로 받았으므로 실물을 요구할 이유를 몰랐습니다. 모바일 발송과 실물 미요청 사이에 어떤 결례가 있었는지 판결을 요청합니다.',
    hoursAgo: 130
  },
  {
    nickname: '슬픈냉장고파수꾼',
    judgeType: '꼰대형',
    grievanceIndex: 5,
    caseTitle: '공동구매 무임승차 참여 요구 사건',
    caseDescription: '팀 배달 공동구매를 제가 주도했습니다. 마감 후 한 명이 추가하고 싶다고 했습니다. 저는 이미 주문을 넣었다고 설명했으나, 그 팀원은 "왜 말 안 해줬냐"고 했습니다. 공지는 팀 단톡방에 3회 올렸습니다. 마감 이후의 참여 요청을 제가 수용해야 하는 의무가 있는지 묻습니다.',
    hoursAgo: 140
  },
  {
    nickname: '황당한직장인',
    judgeType: '빙의형',
    grievanceIndex: 8,
    caseTitle: '헬스장 러닝머신 타월 자리맡기 사건',
    caseDescription: '헬스장 러닝머신에 타월이 걸려있어 기다렸습니다. 10분 후에도 주인이 나타나지 않아 타월을 옆에 두고 사용했습니다. 5분 후 나타난 사람이 "제 자리인데요"라고 했습니다. 저는 타월 자리맡기의 유효 시간이 존재하는지, 그리고 10분이 그 시간을 초과하는지 판결을 구합니다.',
    hoursAgo: 150
  },
  {
    nickname: '당황한라면러버',
    judgeType: '회피형',
    grievanceIndex: 6,
    caseTitle: '영수증 앱 설치 요구 거절 후 할인 배제 사건',
    caseDescription: '마트 계산 시 직원이 앱 설치를 권유했고 저는 정중히 거절했습니다. 그러자 직원이 "그럼 할인 적용이 안 돼요"라고 했습니다. 저는 앱 설치를 동의하지 않은 소비자가 할인에서 배제되는 것이 정당한지, 그리고 앱 없는 고객이 불이익을 받는 구조가 옳은지 묻습니다.',
    hoursAgo: 160
  },
  {
    nickname: '억울한아무개',
    judgeType: '추궁형',
    grievanceIndex: 9,
    caseTitle: '커플 핸드폰 상시 확인 요구 사건',
    caseDescription: '연인이 카카오톡 알림이 울릴 때마다 누군지 확인을 요청합니다. 저는 프라이버시를 이유로 거부했고 연인은 "숨길 게 없으면 보여줄 수 있잖아"를 반복합니다. 저는 죄가 없어도 증명을 강요받아야 하는지 묻고 싶으며, 해당 논리가 유효한지 판결을 요청합니다.',
    hoursAgo: 170
  },
  {
    nickname: '기막힌직장인',
    judgeType: '드립형',
    grievanceIndex: 7,
    caseTitle: '택시 동승 무단 선탑 선점 사건',
    caseDescription: '친구 셋이서 카카오택시를 잡았습니다. 제가 앱으로 호출했고 도착하자마자 한 친구가 재빠르게 조수석을 차지했습니다. 결제는 제가 했습니다. 호출자가 탑승 위치 선택권을 가지는지, 아니면 선착순인지에 대해 판결이 필요합니다. 조수석에 대한 권리 소재를 명확히 해주십시오.',
    hoursAgo: 180
  },
  {
    nickname: '분노한과자지킴이',
    judgeType: '냉혈형',
    grievanceIndex: 8,
    caseTitle: '재택근무 중 쿠팡 배송 문자 응대 거부 사건',
    caseDescription: '재택근무 중 배송 기사가 문자로 "집 앞에 뒀습니다"라고 했는데 실제 위치는 3동 계단 아래였습니다. 문의 문자를 보냈으나 미읽음 상태로 퇴근 시간이 됐습니다. 이튿날 확인하니 이미 다른 가구의 물건들과 섞여있었습니다. 정확한 배치 위치 통보 의무 이행 여부를 판결해 주십시오.',
    hoursAgo: 190
  }
];

async function seed() {
  const now = Date.now();
  console.log(`Seeding ${CASES.length} demo cases...`);

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const ref = db.collection('cases').doc();
    const createdAt = Timestamp.fromDate(new Date(now - c.hoursAgo * 3600 * 1000));

    await ref.set({
      userId: 'demo-seed',
      docketNumber: makeDocket(i),
      courtName: '소소킹 판결소',
      courtroom: '제404호 생활법정',
      division: '제3생활부',
      courtStage: 'filed',
      caseTitle: c.caseTitle,
      caseDescription: c.caseDescription,
      judgeType: c.judgeType,
      grievanceIndex: c.grievanceIndex,
      nickname: c.nickname,
      status: 'pending',
      isPublic: false,
      reportCount: 0,
      createdAt,
      updatedAt: createdAt
    });

    process.stdout.write(`  [${i + 1}/${CASES.length}] ${c.caseTitle}\n`);
  }

  console.log('\nDone.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
