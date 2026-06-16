'use strict';

// republic-history-events.js
// 군사독재 이후 새 공화국이 시작되는 시점부터 현대 정치사를 모티브로 삼는
// 하루 1개 역사 풍자 이슈 데이터 풀.
// 실제 인물·실제 정당명은 사용하지 않고, 구조와 시대 흐름만 가상화한다.

const HISTORY_EVENTS = Object.freeze([
  {
    day: 1,
    era: '새공화국 출범기',
    motifYear: 1987,
    motif: '민주화 요구와 직선제 개헌 흐름',
    parodyTitle: '광장에 울린 첫 투표함',
    issueSummary: '오랜 권위주의 체제가 물러난 뒤, 시민들은 직접 지도자를 뽑는 새 질서를 요구한다.',
    question: '새 공화국의 첫 원칙은 무엇이어야 하는가?',
    stances: {
      national: '질서 있는 전환이 우선이다. 급격한 혼란 없이 새 제도를 세워야 한다.',
      youth: '광장이 만든 역사다. 권력기관 개혁까지 밀어붙여야 한다.',
      center: '직선제는 수용하되, 사회 갈등을 줄이는 합의 개헌이 필요하다.',
    },
    effects: { stability: 1, reform: 2, conflict: -1 },
  },
  {
    day: 2,
    era: '새공화국 출범기',
    motifYear: 1987,
    motif: '새 헌법 질서와 대통령 5년 단임제',
    parodyTitle: '왕좌에 임기표를 붙이다',
    issueSummary: '새 헌법은 권력이 오래 머물지 못하도록 시간표를 붙인다.',
    question: '강한 대통령제와 권력 분산 중 무엇을 택해야 하는가?',
    stances: {
      national: '위기 대응을 위해 대통령의 책임 권한은 필요하다.',
      youth: '권력은 짧고 투명해야 한다. 견제 장치를 더 세워야 한다.',
      center: '대통령 권한은 유지하되 국회와 헌재의 균형을 강화해야 한다.',
    },
    effects: { stability: 2, reform: 1, constitutional: 2 },
  },
  {
    day: 3,
    era: '선거정치 개막기',
    motifYear: 1987,
    motif: '첫 직선 대선과 야권 분열',
    parodyTitle: '세 후보의 갈라진 광장',
    issueSummary: '새로운 투표함 앞에서 시민의 열망은 하나였지만, 정치의 길은 여러 갈래로 찢어진다.',
    question: '대의와 승리 중 어느 쪽을 먼저 선택해야 하는가?',
    stances: {
      national: '분열된 광장보다 안정적 승계가 새 질서를 지킨다.',
      youth: '분열은 아프지만 시민의 선택권도 민주주의다.',
      center: '연합하지 못한 개혁은 제도 안에서 힘을 잃는다.',
    },
    effects: { conflict: 2, reform: 1, electionHeat: 2 },
  },
  {
    day: 4,
    era: '국제개방기',
    motifYear: 1988,
    motif: '국제 행사와 세계 무대 진입',
    parodyTitle: '세계가 지켜보는 새 공화국',
    issueSummary: '새 공화국은 광장의 기억을 안고 세계 무대에 자신을 공개한다.',
    question: '국가 이미지를 위해 내부 갈등을 잠시 덮어야 하는가?',
    stances: {
      national: '국가 신뢰가 먼저다. 세계 앞에서 안정된 모습을 보여야 한다.',
      youth: '외부 시선보다 내부 민주주의가 먼저다.',
      center: '성과는 활용하되, 개혁 과제를 다음 의제로 넘기면 안 된다.',
    },
    effects: { diplomacy: 2, stability: 1, reform: 1 },
  },
  {
    day: 5,
    era: '정계개편기',
    motifYear: 1990,
    motif: '대형 정계개편과 합종연횡',
    parodyTitle: '어제의 적이 오늘의 동맹',
    issueSummary: '서로 싸우던 세력이 하루아침에 한 지붕 아래 앉으며 시민들은 정치의 셈법을 다시 배운다.',
    question: '정계개편은 안정인가, 배신인가?',
    stances: {
      national: '큰 연합은 국정 안정을 위한 현실적 선택이다.',
      youth: '명분 없는 합당은 시민의 선택을 뒤집는 거래다.',
      center: '연합은 필요하지만 공개된 원칙과 정책 합의가 있어야 한다.',
    },
    effects: { stability: 2, trust: -2, coalition: 3 },
  },
  {
    day: 6,
    era: '문민개혁기',
    motifYear: 1993,
    motif: '문민정부 출범과 군 권력 약화',
    parodyTitle: '군복을 벗은 권력의 방',
    issueSummary: '권력의 방에서 군화 소리가 잦아들고, 민간 정치가 제도의 중심으로 들어온다.',
    question: '과거 권력 구조를 어디까지 청산해야 하는가?',
    stances: {
      national: '청산은 하되 안보 조직의 사기를 꺾어서는 안 된다.',
      youth: '과거 권력의 잔재를 정리하지 않으면 민주주의는 껍데기다.',
      center: '책임은 묻되 제도 안정성을 무너뜨리지 않는 단계적 개혁이 필요하다.',
    },
    effects: { reform: 3, stability: 1, security: -1 },
  },
  {
    day: 7,
    era: '문민개혁기',
    motifYear: 1993,
    motif: '금융실명제와 부패 척결',
    parodyTitle: '검은 장부에 이름을 쓰다',
    issueSummary: '숨겨진 돈의 이름표가 드러나자, 공화국의 오래된 거래 관행이 흔들린다.',
    question: '부패 청산을 위해 경제 충격을 감수해야 하는가?',
    stances: {
      national: '투명성은 필요하지만 시장 충격을 관리해야 한다.',
      youth: '부패 비용이 더 크다. 지금 드러내야 한다.',
      center: '실명제는 하되 충격 완화 장치를 함께 둬야 한다.',
    },
    effects: { reform: 3, economy: -1, trust: 2 },
  },
  {
    day: 8,
    era: '지방정치 부활기',
    motifYear: 1995,
    motif: '지방자치 본격화',
    parodyTitle: '서울 밖에서도 정치가 시작됐다',
    issueSummary: '중앙의 명령만 기다리던 지역들이 자기 이름으로 예산과 책임을 말하기 시작한다.',
    question: '지역 권한 확대는 분권인가, 낭비인가?',
    stances: {
      national: '분권은 좋지만 국가 전체의 기준이 흔들리면 안 된다.',
      youth: '지역 시민에게 권력을 돌려주는 것이 민주주의다.',
      center: '재정 책임과 권한 이양을 함께 설계해야 한다.',
    },
    effects: { localPower: 3, stability: 1, budget: -1 },
  },
  {
    day: 9,
    era: '외환위기 전야',
    motifYear: 1997,
    motif: '외환위기 전조와 시장 불안',
    parodyTitle: '금고는 비었고 시장은 웃지 않았다',
    issueSummary: '성장의 자신감 뒤에서 부채와 불안이 커지고, 시장은 먼저 차가운 표정을 짓는다.',
    question: '위기를 막기 위해 어떤 선택을 해야 하는가?',
    stances: {
      national: '기업과 금융 질서를 빠르게 정비해야 한다.',
      youth: '위기 비용이 노동자와 서민에게만 전가되어서는 안 된다.',
      center: '구조조정과 안전망을 동시에 준비해야 한다.',
    },
    effects: { economy: -3, trust: -2, reform: 1 },
  },
  {
    day: 10,
    era: '외환위기기',
    motifYear: 1997,
    motif: '구제금융과 구조조정',
    parodyTitle: '구제금융의 겨울',
    issueSummary: '공화국은 차가운 계산서 앞에 섰고, 시민들은 성장의 그림자를 몸으로 견딘다.',
    question: '구조조정은 회복의 약인가, 고통의 전가인가?',
    stances: {
      national: '살아남아야 다시 성장할 수 있다. 고통스럽지만 정비가 필요하다.',
      youth: '위기의 책임자가 아닌 시민에게 비용을 떠넘기면 안 된다.',
      center: '구조조정은 하되 실업과 복지를 함께 다뤄야 한다.',
    },
    effects: { economy: -2, welfare: 2, conflict: 2 },
  },
  {
    day: 11,
    era: '정권교체기',
    motifYear: 1998,
    motif: '첫 평화적 정권교체',
    parodyTitle: '권력이 다른 문으로 걸어 나갔다',
    issueSummary: '투표함은 권력이 한쪽의 전유물이 아님을 증명하고, 공화국은 새 규칙을 배운다.',
    question: '정권교체 이후 보복과 개혁의 경계는 어디인가?',
    stances: {
      national: '정권교체가 국정 보복으로 흐르면 안 된다.',
      youth: '교체의 의미는 개혁으로 증명되어야 한다.',
      center: '인수와 개혁 모두 제도 안에서 관리해야 한다.',
    },
    effects: { democracy: 3, reform: 2, conflict: 1 },
  },
  {
    day: 12,
    era: '화해정치기',
    motifYear: 2000,
    motif: '남북 화해 분위기와 정상회담',
    parodyTitle: '휴전선 위에 놓인 악수',
    issueSummary: '오래 닫혀 있던 문 앞에서 공화국은 안보와 평화 사이의 어려운 계산을 시작한다.',
    question: '평화 정책은 안보를 약하게 만드는가, 강하게 만드는가?',
    stances: {
      national: '대화는 필요하지만 안보 검증 없는 낙관은 위험하다.',
      youth: '적대의 비용을 줄이는 평화정치가 필요하다.',
      center: '교류와 억지를 병행하는 현실적 평화가 답이다.',
    },
    effects: { diplomacy: 3, security: 1, conflict: 1 },
  },
  {
    day: 13,
    era: '참여정치기',
    motifYear: 2002,
    motif: '인터넷 여론과 시민 참여 확대',
    parodyTitle: '게시판에서 시작된 선거운동',
    issueSummary: '정치 연설장은 광장에서 모니터 속 게시판으로 넓어지고, 시민은 댓글로 판세를 흔든다.',
    question: '온라인 여론은 민주주의의 확장인가, 군중심리인가?',
    stances: {
      national: '빠른 여론은 책임 없는 선동으로 흐를 수 있다.',
      youth: '온라인 참여는 닫힌 정치판을 여는 새 시민권이다.',
      center: '참여는 확대하되 허위정보와 과열을 관리해야 한다.',
    },
    effects: { youth: 3, media: 2, conflict: 1 },
  },
  {
    day: 14,
    era: '스포츠 시민열기',
    motifYear: 2002,
    motif: '대규모 거리 응원과 집단 시민 경험',
    parodyTitle: '붉은 광장이 정치의 언어를 배웠다',
    issueSummary: '응원으로 모인 시민들은 광장이 단지 항의의 장소만은 아니라는 사실을 보여준다.',
    question: '대중 열기는 정치적 힘으로 이어져야 하는가?',
    stances: {
      national: '국민 통합의 에너지는 국가 자신감으로 이어져야 한다.',
      youth: '광장의 자발성은 시민정치의 가능성이다.',
      center: '열기는 소중하지만 제도 정치로 연결될 통로가 필요하다.',
    },
    effects: { unity: 3, youth: 2, stability: 1 },
  },
  {
    day: 15,
    era: '탄핵정국기',
    motifYear: 2004,
    motif: '대통령 탄핵과 헌법재판',
    parodyTitle: '의사봉이 왕좌를 두드린 날',
    issueSummary: '국회와 헌재가 대통령의 운명을 두고 맞서며, 공화국은 헌정 절차의 무게를 배운다.',
    question: '탄핵은 민주주의의 안전장치인가, 정치적 무기인가?',
    stances: {
      national: '탄핵은 신중해야 한다. 남발되면 국정이 멈춘다.',
      youth: '대통령도 헌법 위에 있을 수 없다. 책임을 물어야 한다.',
      center: '절차와 사유가 명확할 때만 탄핵은 정당성을 얻는다.',
    },
    effects: { constitutional: 3, conflict: 3, stability: -2 },
  },
  {
    day: 16,
    era: '양극화 확대기',
    motifYear: 2008,
    motif: '경제 불안과 거리 시위',
    parodyTitle: '촛불은 작았지만 광장은 컸다',
    issueSummary: '생활 불안과 정책 불신이 만나자 작은 불빛들이 거대한 정치 언어가 된다.',
    question: '거리의 분노는 정책을 바꿀 정당한 힘인가?',
    stances: {
      national: '불안은 이해하지만 국정은 거리 압력만으로 움직일 수 없다.',
      youth: '시민이 불안을 말할 때 국가는 들어야 한다.',
      center: '정부는 설명하고 시민은 검증하는 공개 협의가 필요하다.',
    },
    effects: { trust: -2, youth: 2, conflict: 2 },
  },
  {
    day: 17,
    era: '복지논쟁기',
    motifYear: 2010,
    motif: '무상복지와 재정 논쟁',
    parodyTitle: '공짜 점심의 계산서',
    issueSummary: '복지는 권리인가 비용인가를 두고 공화국의 계산기가 바쁘게 두드려진다.',
    question: '복지 확대는 미래 투자인가, 재정 부담인가?',
    stances: {
      national: '복지는 필요하지만 지속 가능한 재원이 먼저다.',
      youth: '기본 권리를 비용으로만 보면 공동체가 무너진다.',
      center: '보편과 선별을 섞어 체감도와 재정을 함께 봐야 한다.',
    },
    effects: { welfare: 3, budget: -2, conflict: 1 },
  },
  {
    day: 18,
    era: '안보긴장기',
    motifYear: 2010,
    motif: '안보 위기와 남북 긴장',
    parodyTitle: '평화의 책상 위에 놓인 경계경보',
    issueSummary: '평화의 말이 오가던 사이에도 경계의 사이렌은 공화국의 밤을 흔든다.',
    question: '안보 위기 때 정치권은 어디까지 단결해야 하는가?',
    stances: {
      national: '안보 앞에서는 정쟁을 멈추고 단호하게 대응해야 한다.',
      youth: '위기를 빌미로 표현과 비판을 막아서는 안 된다.',
      center: '초당적 대응과 사후 검증을 함께 해야 한다.',
    },
    effects: { security: 3, stability: 1, conflict: 1 },
  },
  {
    day: 19,
    era: '디지털여론기',
    motifYear: 2012,
    motif: 'SNS 선거와 온라인 프레임 전쟁',
    parodyTitle: '해시태그가 유세차를 앞지른 밤',
    issueSummary: '선거운동은 거리에서 손바닥 화면으로 옮겨가고, 짧은 문장이 긴 연설을 이긴다.',
    question: 'SNS 정치는 참여를 넓히는가, 진영을 가르는가?',
    stances: {
      national: '검증되지 않은 여론전은 민주주의를 흐릴 수 있다.',
      youth: 'SNS는 시민이 정치에 들어오는 가장 빠른 문이다.',
      center: '참여 확대와 플랫폼 책임을 함께 설계해야 한다.',
    },
    effects: { media: 3, youth: 2, conflict: 2 },
  },
  {
    day: 20,
    era: '안전국가 논쟁기',
    motifYear: 2014,
    motif: '대형 참사 이후 국가 책임 논쟁',
    parodyTitle: '국가는 어디에 있었나',
    issueSummary: '비극 앞에서 시민들은 애도와 함께 국가의 책임, 보고 체계, 안전 시스템을 묻는다.',
    question: '참사 이후 정치는 애도에 머물러야 하는가, 책임을 물어야 하는가?',
    stances: {
      national: '책임 규명은 필요하지만 사회 전체가 무너질 정도의 정쟁은 피해야 한다.',
      youth: '애도는 책임을 묻는 일과 분리될 수 없다.',
      center: '진상 규명, 제도 개편, 공동체 회복을 함께 추진해야 한다.',
    },
    effects: { trust: -3, reform: 2, safety: 3 },
  },
  {
    day: 21,
    era: '촛불탄핵기',
    motifYear: 2016,
    motif: '대규모 촛불집회와 대통령 탄핵',
    parodyTitle: '촛불이 의사봉을 움직였다',
    issueSummary: '광장의 시민, 국회의 표결, 헌재의 결정이 이어지며 공화국은 권력의 한계를 확인한다.',
    question: '광장의 요구는 어디까지 제도정치에 반영되어야 하는가?',
    stances: {
      national: '광장도 중요하지만 헌법 절차가 최종 기준이어야 한다.',
      youth: '시민의 분노가 아니었다면 제도는 움직이지 않았다.',
      center: '광장의 뜻은 절차를 통해 제도화될 때 지속된다.',
    },
    effects: { democracy: 3, constitutional: 3, conflict: 2 },
  },
  {
    day: 22,
    era: '개혁정부기',
    motifYear: 2017,
    motif: '조기 대선과 개혁 기대',
    parodyTitle: '급히 열린 투표소의 약속',
    issueSummary: '탄핵 이후 치러진 선거에서 시민들은 분노 이후의 개혁을 요구한다.',
    question: '분노로 탄생한 정부는 얼마나 빠르게 개혁해야 하는가?',
    stances: {
      national: '정권 안정 없이 급한 개혁은 또 다른 분열을 만든다.',
      youth: '기회를 놓치면 개혁 저항이 다시 커진다.',
      center: '우선순위를 정하고 가능한 것부터 제도화해야 한다.',
    },
    effects: { reform: 3, expectation: 3, conflict: 1 },
  },
  {
    day: 23,
    era: '한반도 데탕트기',
    motifYear: 2018,
    motif: '남북 대화와 평화 분위기',
    parodyTitle: '분계선 위의 짧은 산책',
    issueSummary: '잠시 열린 평화의 장면은 시민에게 기대를 주지만, 약속의 무게는 여전히 무겁다.',
    question: '상징적 평화 장면은 실제 안보 변화를 만들 수 있는가?',
    stances: {
      national: '장면보다 검증 가능한 조치가 중요하다.',
      youth: '평화의 상상력이 적대의 습관을 깰 수 있다.',
      center: '상징은 출발점이고, 제도적 합의가 목적지다.',
    },
    effects: { diplomacy: 3, security: 1, expectation: 2 },
  },
  {
    day: 24,
    era: '검찰개혁 논쟁기',
    motifYear: 2019,
    motif: '권력기관 개혁과 진영 대립',
    parodyTitle: '수사권의 저울이 기울던 날',
    issueSummary: '권력기관 개혁은 정의의 이름으로 시작됐지만, 곧 진영의 깃발 아래에서 거칠게 흔들린다.',
    question: '권력기관 개혁은 누가, 어떻게 해야 정당한가?',
    stances: {
      national: '개혁이 수사 독립성을 훼손해서는 안 된다.',
      youth: '견제받지 않는 권력기관은 민주주의의 사각지대다.',
      center: '개혁 주체도 견제받아야 제도 신뢰가 생긴다.',
    },
    effects: { reform: 3, trust: -1, conflict: 3 },
  },
  {
    day: 25,
    era: '감염병 위기기',
    motifYear: 2020,
    motif: '감염병 대응과 국가 통제 논쟁',
    parodyTitle: '마스크를 쓴 공화국',
    issueSummary: '공화국은 개인의 자유와 공동체 안전 사이에서 매일 새로운 선을 긋는다.',
    question: '위기 상황에서 국가는 시민 생활을 어디까지 제한할 수 있는가?',
    stances: {
      national: '공동체 안전을 위해 일시적 제한은 필요하다.',
      youth: '통제는 투명하고 평등해야 시민이 납득한다.',
      center: '방역 효과와 기본권 제한의 비례성을 계속 검증해야 한다.',
    },
    effects: { safety: 3, liberty: -1, trust: 1 },
  },
  {
    day: 26,
    era: '부동산 격차기',
    motifYear: 2021,
    motif: '부동산 가격 급등과 청년 불안',
    parodyTitle: '집값 그래프가 사다리를 걷어찼다',
    issueSummary: '집은 생활의 기반이어야 했지만, 어느새 세대 갈등과 자산 격차의 상징이 된다.',
    question: '부동산 문제는 시장 실패인가, 정책 실패인가?',
    stances: {
      national: '공급과 시장 신뢰를 회복해야 가격이 안정된다.',
      youth: '주거는 투기 수단이 아니라 시민의 기본 조건이다.',
      center: '공급, 세제, 금융, 임대 안정책을 함께 봐야 한다.',
    },
    effects: { economy: -1, youth: 3, conflict: 2 },
  },
  {
    day: 27,
    era: '초박빙 정치기',
    motifYear: 2022,
    motif: '근소한 대선 승부와 양극화',
    parodyTitle: '반쪽 차이로 열린 집무실',
    issueSummary: '아주 작은 표 차이는 승자를 만들었지만, 패자의 분노까지 지우지는 못했다.',
    question: '초박빙 선거 이후 통합 정치는 가능한가?',
    stances: {
      national: '승자는 책임 있게 국정을 끌고 가야 한다.',
      youth: '근소한 승리는 더 겸손한 개혁을 요구한다.',
      center: '절반의 반대를 인정하는 협치 구조가 필요하다.',
    },
    effects: { legitimacy: 1, conflict: 3, coalition: 2 },
  },
  {
    day: 28,
    era: '여소야대기',
    motifYear: 2024,
    motif: '강한 야당과 국정 교착',
    parodyTitle: '의석은 많고 문은 열리지 않았다',
    issueSummary: '국회 의석은 한쪽으로 쏠렸지만, 법안과 거부권 사이에서 공화국의 문은 자주 멈춰 선다.',
    question: '여소야대는 견제인가, 마비인가?',
    stances: {
      national: '국정 발목잡기가 되면 시민 피해가 커진다.',
      youth: '강한 의회 견제는 대통령 권력을 막는 장치다.',
      center: '거부와 강행 사이에 협상 절차를 제도화해야 한다.',
    },
    effects: { parliament: 3, conflict: 3, stability: -1 },
  },
  {
    day: 29,
    era: '헌정위기 논쟁기',
    motifYear: 2025,
    motif: '대통령 권한과 헌정 안정성 논쟁',
    parodyTitle: '비상벨은 누구의 손에 있어야 하나',
    issueSummary: '위기 권한의 범위와 통제 장치를 두고 공화국은 권력의 비상문을 다시 점검한다.',
    question: '비상권한은 강해야 하는가, 더 엄격히 통제되어야 하는가?',
    stances: {
      national: '국가 위기에는 빠른 지휘권이 필요하다.',
      youth: '비상권한은 가장 먼저 남용을 의심받아야 한다.',
      center: '발동 요건, 사후 승인, 헌재 심사를 명확히 해야 한다.',
    },
    effects: { constitutional: 3, security: 1, liberty: -1 },
  },
  {
    day: 30,
    era: '제도개편 논쟁기',
    motifYear: 2026,
    motif: '개헌과 권력구조 개편 논의',
    parodyTitle: '제7공화국 초안의 빈칸',
    issueSummary: '새 공화국의 오래된 설계도를 고칠 때가 되었는지, 시민과 정당은 다시 계산을 시작한다.',
    question: '권력구조 개편은 지금 필요한가?',
    stances: {
      national: '안정된 권력 구조를 흔들기보다 운영 개선이 먼저다.',
      youth: '제왕적 권력 구조를 고치지 않으면 위기는 반복된다.',
      center: '중임제, 분권, 결선투표 등 여러 장치를 시민투표로 정해야 한다.',
    },
    effects: { constitutional: 4, reform: 2, stability: -1 },
  },
]);

function dateSeed(dateStr) {
  const digits = String(dateStr || '').replace(/\D/g, '');
  let n = 0;
  for (let i = 0; i < digits.length; i++) n = (n * 31 + (digits.charCodeAt(i) - 48)) >>> 0;
  return n || 1;
}

function eventForDate(dateStr) {
  const idx = (dateSeed(dateStr) - 1) % HISTORY_EVENTS.length;
  return HISTORY_EVENTS[idx];
}

function eventByDay(day) {
  const n = Number(day || 1);
  return HISTORY_EVENTS.find(e => e.day === n) || HISTORY_EVENTS[0];
}

function buildHistoryPromptBlock(event) {
  return `【오늘의 역사 모티브】
- 시대: ${event.era}
- 모티브 연도: ${event.motifYear}
- 실제 모티브: ${event.motif}
- 가상 풍자 제목: ${event.parodyTitle}
- 핵심 질문: ${event.question}

【정당별 기본 입장】
- 국민질서당: ${event.stances.national}
- 시민개혁당: ${event.stances.youth}
- 국민통합당: ${event.stances.center}`;
}

module.exports = {
  HISTORY_EVENTS,
  eventForDate,
  eventByDay,
  buildHistoryPromptBlock,
};
