// 소소킹 사건파일: 검수된 정적 사건 데이터. 플레이 도중 생성형 AI 호출 없음.
export const CASES = [
  {
    id:'festival', number:'001', title:'사라진 1등 경품', kicker:'축제장 미스터리', category:'일상 미스터리', level:1, minutes:5,
    tagline:'추첨을 10분 앞두고 1등 상품이 감쪽같이 사라졌다.',
    intro:'동네 가을 축제. 운영진이 창고 문을 열었을 때 대형 경품 상자가 사라졌다. 출입자는 세 사람뿐. 누구의 말이 어긋났을까?',
    location:'남산 축제 운영본부', time:'오후 3:20', weather:'맑음', theme:'amber',
    notes:['상품은 오후 3시까지 잠금 창고에 있었다.','오후 3시 20분에 분실이 확인됐다.','출입 기록과 진술을 맞춰보자.'],
    clues:[
      {id:'log',name:'출입 기록지',type:'서류',detail:'15:04 민수 입장 · 15:08 퇴장 / 15:12 지연 입장 · 15:16 퇴장 / 15:18 창고 관리자 입장.',tag:'시간'},
      {id:'dust',name:'바퀴 자국',type:'현장',detail:'바닥의 고운 분필가루 위에 작은 운반 카트 바퀴 자국이 남아 있다. 출입문 방향으로 이어진다.',tag:'이동'},
      {id:'receipt',name:'택배 접수증',type:'물증',detail:'15:14에 행사장 우편 임시부스에서 대형 상자 1건이 접수됐다. 발송인은 ‘축제 운영팀’으로 적혀 있다.',tag:'결정적'},
      {id:'photo',name:'현장 사진',type:'사진',detail:'15:10에 찍힌 사진에 경품 상자가 창고 내부 선반에 그대로 보인다.',tag:'확인'}
    ],
    witnesses:[
      {id:'minsu',name:'민수',role:'행사 진행자',statement:'“3시 8분에 나왔어요. 그때 경품은 그대로였죠.”',question:'언제 창고를 나왔나요?',follow:'“입구에서 지연 씨와 잠깐 인사했어요.”'},
      {id:'jiyeon',name:'지연',role:'운영 보조',statement:'“저는 물품 목록만 확인했어요. 창고에서 상자를 옮긴 적은 없어요.”',question:'창고에서 뭘 했나요?',follow:'“3시 15분쯤 바로 손을 씻으러 갔어요.”'},
      {id:'admin',name:'동훈',role:'창고 관리자',statement:'“3시 18분에 들어가니 상자가 이미 없었어요.”',question:'사라진 걸 언제 알았나요?',follow:'“제가 도착했을 때 문은 잠겨 있지 않았어요.”'}
    ],
    contradiction:{witness:'jiyeon',clue:'receipt',line:'“상자를 옮기지 않았다”는 말과 15:14 대형 상자 발송 기록이 충돌한다.'},
    answer:'jiyeon',keyClue:'receipt', motive:'지연은 경품을 다른 장소로 옮겨 놓고 분실 소동을 벌였다.',
    reveal:'출입 시각 15:12~15:16과 택배 접수 15:14가 겹친다. 15:10 사진에는 경품이 남아 있었으므로 먼저 다녀간 민수는 범인이 될 수 없다. 지연이 카트로 상자를 옮긴 것이다.',
    hint:'경품이 마지막으로 확인된 시각과 접수증의 시각을 비교해 보세요.'
  },
  {
    id:'cafe',number:'002',title:'카페의 뒤바뀐 영수증',kicker:'영수증의 알리바이',category:'논리 추리',level:1,minutes:4,
    tagline:'계산대에서 사라진 돈. 모두가 근무 중이었다.',
    intro:'카페 마감 직전 현금 5만 원이 비었다. 사장은 전표가 한 장 빠진 것을 발견했다. 직원 셋 중 누군가 거짓 설명을 한다.',
    location:'모퉁이 카페',time:'오후 9:40',weather:'비',theme:'blue',
    notes:['마감 정산액이 5만 원 부족하다.','세 직원은 오후 9시 이후 매장에 있었다.','삭제된 거래 시간을 찾아야 한다.'],
    clues:[
      {id:'pos',name:'POS 로그',type:'기록',detail:'21:17에 현금 취소 거래 50,000원이 등록됐다. 등록 계정: 유진.',tag:'결정적'},
      {id:'shift',name:'근무표',type:'서류',detail:'유진 20:00~22:00, 태호 18:00~21:00, 선미 19:00~22:00.',tag:'시간'},
      {id:'cctv',name:'카운터 영상',type:'사진',detail:'21:15~21:19 영상에서 카운터에 서 있는 사람은 한 명. 유진과 같은 줄무늬 앞치마를 입었다.',tag:'현장'},
      {id:'note',name:'주문 메모',type:'물증',detail:'마지막 손님은 카드로 결제했다. 21:17에 현금 환불을 요청한 손님은 없었다.',tag:'확인'}
    ],
    witnesses:[
      {id:'yujin',name:'유진',role:'야간 계산 담당',statement:'“마감까지 취소 거래를 한 적 없어요.”',question:'취소 버튼을 누른 적 있나요?',follow:'“마지막 주문은 제가 받았지만 카드 결제였어요.”'},
      {id:'taeho',name:'태호',role:'오픈 직원',statement:'“저는 9시에 퇴근했어요. 정산에는 참여하지 않았죠.”',question:'몇 시에 퇴근했나요?',follow:'“퇴근 기록이 근무표에 있어요.”'},
      {id:'sunmi',name:'선미',role:'주방 담당',statement:'“주방 청소를 하느라 계산대에는 가지 않았어요.”',question:'그 시간에 어디 있었나요?',follow:'“고무장갑을 끼고 설거지를 했어요.”'}
    ],
    contradiction:{witness:'yujin',clue:'pos',line:'“취소 거래를 한 적 없다”는 진술과 유진 계정의 현금 취소 로그가 다르다.'},
    answer:'yujin',keyClue:'pos',motive:'유진이 가짜 현금 취소를 입력해 계산대를 비웠다.',
    reveal:'현금 취소 기록이 유진 계정으로 남았고, 손님이 환불을 요청하지 않았다는 메모가 이를 뒷받침한다. 카운터 영상까지 같은 시각을 가리킨다.',
    hint:'누가 현금을 만질 수 있었는지보다 취소 버튼을 누른 계정을 먼저 확인하세요.'
  },
  {
    id:'library',number:'003',title:'도서관의 빈 책장',kicker:'조용한 실종',category:'현장 수사',level:2,minutes:6,
    tagline:'닫힌 도서관에서 희귀 도서가 사라졌다.',
    intro:'희귀 자료실에서 오래된 지도책이 사라졌다. 야간 당직자는 잠긴 출입문을 강조하지만, 책이 나간 흔적은 출입구가 아니었다.',
    location:'시립 중앙도서관',time:'오전 8:05',weather:'흐림',theme:'green',
    notes:['자료실은 오후 8시에 문을 닫았다.','야간 보안 경보는 울리지 않았다.','책 크기는 일반 반납함보다 크다.'],
    clues:[
      {id:'scan',name:'반납기록',type:'기록',detail:'07:12 무인 반납함을 통해 ‘희귀 지도책’이 반납 처리됐다. 담당자 수동 인증 코드: R-29.',tag:'결정적'},
      {id:'badge',name:'관리자 출입카드',type:'기록',detail:'어젯밤 20:30 이후 자료실 출입 기록은 없다. 단, 직원용 내부 도서 이동 시스템은 별도로 작동한다.',tag:'출입'},
      {id:'cart',name:'이동 카트',type:'현장',detail:'내부 승강기 옆 카트 손잡이에 희귀 자료실의 붉은 라벨 조각이 묻어 있다.',tag:'이동'},
      {id:'manual',name:'인증 코드 목록',type:'서류',detail:'R-29는 아침 자료 정리를 담당하는 정우에게 발급된 코드다.',tag:'시간'}
    ],
    witnesses:[
      {id:'jeongwoo',name:'정우',role:'아침 정리 직원',statement:'“제가 출근했을 땐 그 책이 이미 사라져 있었어요. 반납기에는 손도 안 댔어요.”',question:'무인 반납기에서 뭘 확인했나요?',follow:'“책은 본 적조차 없는데요.”'},
      {id:'seo',name:'서연',role:'야간 경비원',statement:'“새벽 내내 출입 경보는 작동하지 않았습니다.”',question:'새벽에 출입 경보가 있었나요?',follow:'“외부 침입은 없었다고 봐요.”'},
      {id:'choi',name:'최팀장',role:'자료실 팀장',statement:'“희귀 도서는 원칙적으로 반납함에 넣을 수 없습니다.”',question:'희귀 도서는 어디에 보관하나요?',follow:'“예외 처리는 직원만 가능합니다.”'}
    ],
    contradiction:{witness:'jeongwoo',clue:'scan',line:'반납기에 손대지 않았다는 말과 정우에게 발급된 코드 R-29가 충돌한다.'},
    answer:'jeongwoo',keyClue:'scan',motive:'정우가 책을 무단으로 옮겨 반납 처리한 뒤 분실로 위장했다.',
    reveal:'책은 경보가 감지하는 외부 출입구로 나가지 않았다. 직원용 카트와 반납 시스템을 이용하면 기록상 위치를 바꿀 수 있다. 정우의 인증 코드가 열쇠다.',
    hint:'잠긴 문은 함정입니다. 서류상 책이 어디로 이동했는지 보세요.'
  },
  {
    id:'school',number:'004',title:'방송실의 12초',kicker:'교내 방송 사고',category:'시간 추리',level:2,minutes:5,
    tagline:'시험 직전 울린 장난 방송, 누가 재생했나?',
    intro:'중학교 방송실에서 시험 시작 5분 전 장난 음성이 나왔다. 재생은 예약된 파일이었지만 누가 시간을 바꿨는지는 알려지지 않았다.',
    location:'학교 방송실',time:'오전 8:55',weather:'맑음',theme:'purple',
    notes:['장난 방송은 정확히 08:55:00에 나왔다.','파일은 전날 18:00부터 저장돼 있었다.','방송실 PC 로그는 모두 자동 기록된다.'],
    clues:[
      {id:'edit',name:'재생예약 로그',type:'기록',detail:'08:43:12 예약 시각이 12:00에서 08:55로 변경됐다. 조작 계정: 방송부장.',tag:'결정적'},
      {id:'key',name:'방송실 열쇠 대장',type:'서류',detail:'08:35 현우 수령 / 08:40 반납 / 08:48 나린 수령.',tag:'출입'},
      {id:'remote',name:'원격 접속 기록',type:'기록',detail:'08:42~08:45 방송실 PC에 원격 접속이 있었다. 연결 단말기 이름: HY-LAPTOP.',tag:'시간'},
      {id:'seat',name:'교실 출석표',type:'서류',detail:'08:40부터 현우는 교실에 있었다. 같은 시각 개인 노트북을 사용한 것이 확인된다.',tag:'확인'}
    ],
    witnesses:[
      {id:'hyunwoo',name:'현우',role:'방송부장',statement:'“저는 8시 40분에 열쇠를 돌려줬어요. 방송실엔 다시 들어가지 않았습니다.”',question:'예약을 수정한 적 있나요?',follow:'“방송실에 직접 들어가지 않았으니 수정할 수 없었어요.”'},
      {id:'narin',name:'나린',role:'방송부원',statement:'“8시 48분에 장비 점검하러 들어갔어요.”',question:'방송실엔 언제 들어갔나요?',follow:'“컴퓨터에는 손대지 않았어요.”'},
      {id:'teacher',name:'담당 교사',role:'방송 담당',statement:'“방송 파일은 전날 이미 등록되어 있었어요.”',question:'예약은 언제 정해졌나요?',follow:'“당시에는 정오로 돼 있었습니다.”'}
    ],
    contradiction:{witness:'hyunwoo',clue:'remote',line:'“방송실에 안 들어가서 수정할 수 없다”는 말은 원격 접속 기록으로 반박할 수 있다.'},
    answer:'hyunwoo',keyClue:'edit',motive:'현우는 개인 노트북에서 원격으로 예약 시간을 변경했다.',
    reveal:'핵심은 물리적으로 방송실에 있었느냐가 아니다. HY-LAPTOP의 접속 시각과 예약 변경 로그가 겹친다. 방송부장 계정으로 예약이 바뀌었다.',
    hint:'닫힌 방송실 문보다 PC의 원격 접속 기록을 살펴보세요.'
  },
  {
    id:'gallery',number:'005',title:'액자 뒤의 초록 실',kicker:'갤러리 야간 사건',category:'현장 수사',level:3,minutes:7,
    tagline:'명화는 제자리에 있었지만 원본은 사라졌다.',
    intro:'작은 갤러리의 대표 작품이 복제품으로 바뀌었다. 교체된 사실은 다음 날 발견됐다. 누가 가장 마지막에 작품을 만졌을까?',
    location:'월광 갤러리',time:'오전 9:10',weather:'비',theme:'rose',
    notes:['액자는 벽에 걸린 채 유지됐다.','전날 19시 이후 외부인 방문은 없었다.','복제품은 원본과 크기가 같았다.'],
    clues:[
      {id:'thread',name:'초록 실 조각',type:'물증',detail:'액자 뒷면 못에 밝은 초록색 섬유가 끼어 있다. 전시실 설치 장갑과는 소재가 다르다.',tag:'현장'},
      {id:'uniform',name:'유니폼 수선 내역',type:'서류',detail:'도슨트 보람의 초록 가디건 소매가 어제 찢어져 수선 접수됐다.',tag:'결정적'},
      {id:'alarm',name:'보안 센서 기록',type:'기록',detail:'18:52 작품 근처 진동 감지. 19:00 이후 경보 발생 없음.',tag:'시간'},
      {id:'roster',name:'전시 교대 시간표',type:'서류',detail:'18:45~18:58 전시실에는 보람만 있었다. 설치 담당자는 18:20에 퇴근했다.',tag:'출입'}
    ],
    witnesses:[
      {id:'boram',name:'보람',role:'도슨트',statement:'“저는 어제 작품에 한 번도 손대지 않았어요.”',question:'마감 때 작품에 다가갔나요?',follow:'“그때는 조명만 껐어요.”'},
      {id:'installer',name:'승호',role:'설치 담당',statement:'“저는 6시 20분에 작업을 마치고 퇴근했어요.”',question:'마지막 설치 시각은?',follow:'“새 액자 손볼 일은 없었습니다.”'},
      {id:'guard',name:'경비원',role:'야간 담당',statement:'“7시 이후 외부 출입 흔적은 없었습니다.”',question:'야간 출입 기록은?',follow:'“밤에는 누구도 작품을 만지지 않았어요.”'}
    ],
    contradiction:{witness:'boram',clue:'uniform',line:'소매가 찢어진 초록 가디건과 액자 뒤 섬유는 “손대지 않았다”는 주장에 의문을 만든다.'},
    answer:'boram',keyClue:'uniform',motive:'보람은 전시 종료 직전 원본을 복제품과 교체했다.',
    reveal:'전시실에 혼자 있던 시각에 작품 센서가 흔들렸다. 액자 뒤 초록 실은 보람의 소매 파손과 연결된다. 다른 두 사람에게는 같은 시간대의 기회가 없다.',
    hint:'섬유가 어디서 왔는지와 마지막으로 혼자 있었던 인물을 연결하세요.'
  },
  {
    id:'package',number:'006',title:'열리지 않은 택배함',kicker:'아파트 배송 수수께끼',category:'논리 추리',level:1,minutes:4,
    tagline:'택배는 분실됐지만 잠금 기록은 멀쩡하다.',
    intro:'공용 무인 택배함에서 이어폰이 사라졌다. 수령자는 문을 열지 않았다고 했다. 택배 기사는 정상 배송을 주장한다.',
    location:'한빛 아파트 로비',time:'오후 6:15',weather:'맑음',theme:'green',
    notes:['18:00 배송 완료 알림이 발송됐다.','택배함은 비밀번호 입력 시 열리는 구조다.','18:15 수령자는 빈 택배함을 확인했다.'],
    clues:[
      {id:'open',name:'택배함 잠금 로그',type:'기록',detail:'18:02 관리용 마스터키로 3번 칸이 열렸다. 일반 수령 비밀번호 사용은 18:15가 처음이다.',tag:'결정적'},
      {id:'delivery',name:'배송 인증 사진',type:'사진',detail:'17:59 배송 기사가 이어폰 상자를 3번 칸에 넣은 모습이 찍혀 있다.',tag:'시간'},
      {id:'schedule',name:'관리실 순찰표',type:'서류',detail:'경비원 준호는 18:00~18:10 택배함 점검을 담당했다.',tag:'동선'},
      {id:'notice',name:'점검 공지',type:'서류',detail:'관리실은 당일 택배함 3번 칸의 고장 신고를 받은 적이 없다.',tag:'확인'}
    ],
    witnesses:[
      {id:'junho',name:'준호',role:'경비원',statement:'“저는 그날 3번 칸을 열어본 적이 없어요.”',question:'3번 칸을 점검했나요?',follow:'“고장 신고도 없었거든요.”'},
      {id:'driver',name:'소현',role:'택배 기사',statement:'“6시 전에 3번 칸에 확실히 넣고 사진을 찍었어요.”',question:'정상 배송이었나요?',follow:'“알림도 바로 보냈습니다.”'},
      {id:'buyer',name:'해린',role:'수령자',statement:'“6시 15분에 처음 열었는데 텅 비었어요.”',question:'몇 시에 택배함을 열었나요?',follow:'“제 비밀번호로 열었습니다.”'}
    ],
    contradiction:{witness:'junho',clue:'open',line:'3번 칸을 열지 않았다는 말과 18:02 마스터키 사용 기록이 정면으로 충돌한다.'},
    answer:'junho',keyClue:'open',motive:'준호가 마스터키로 배송된 상자를 꺼냈다.',
    reveal:'배송 사진으로 상자가 들어간 사실이 확인된다. 수령 비밀번호가 사용되기 전인 18:02에 관리용 마스터키가 작동했다. 접근 권한과 시간표가 준호를 가리킨다.',
    hint:'수령자의 비밀번호 기록보다 앞선 개방 기록을 찾으세요.'
  },
  {
    id:'studio',number:'007',title:'편집실의 마지막 3분',kicker:'영상 증거의 함정',category:'시간 추리',level:3,minutes:7,
    tagline:'삭제된 인터뷰 영상이 방송 3분 전에 바뀌었다.',
    intro:'방송국 편집실에서 인터뷰 원본이 다른 영상으로 교체됐다. 편집자는 자리에 없었다고 말하지만 파일 로그는 다르게 기록한다.',
    location:'채널 7 편집실',time:'오후 7:57',weather:'흐림',theme:'purple',
    notes:['20시에 방송이 예정됐다.','교체는 19:57에 일어났다.','편집실 PC는 계정별 작업 이력을 저장한다.'],
    clues:[
      {id:'hash',name:'파일 교체 기록',type:'기록',detail:'19:57:04 final.mp4 해시가 변경됐다. 사용자 ID: edit-b.',tag:'결정적'},
      {id:'login',name:'로그인 기록',type:'기록',detail:'edit-b 계정은 부편집자 다혜에게 배정돼 있다. 19:55부터 로그인 상태였다.',tag:'시간'},
      {id:'door',name:'출입 기록',type:'서류',detail:'19:50 다혜는 회의실로 이동했다. 편집실 입실 기록은 20시 이후에 있다.',tag:'동선'},
      {id:'terminal',name:'원격편집 설정',type:'장비',detail:'편집 시스템은 회의실 단말기에서도 같은 계정으로 원격 저장할 수 있다.',tag:'확인'}
    ],
    witnesses:[
      {id:'dahye',name:'다혜',role:'부편집자',statement:'“저는 회의실에 있었으니 편집 파일을 바꿀 수 없었어요.”',question:'편집실에 있었나요?',follow:'“회의실에 있었다는 출입 기록이 있습니다.”'},
      {id:'senior',name:'정PD',role:'총괄 PD',statement:'“원본은 오후 7시까지 정상이었어요.”',question:'원본을 마지막으로 확인한 때는?',follow:'“7시에 최종 검수했습니다.”'},
      {id:'intern',name:'윤재',role:'인턴',statement:'“저는 교체 시간에 촬영 장비를 정리하고 있었어요.”',question:'7시 57분에는?',follow:'“촬영 장비 반납 기록을 확인해 보세요.”'}
    ],
    contradiction:{witness:'dahye',clue:'terminal',line:'“회의실이라 바꿀 수 없었다”는 주장은 원격 편집 기능 때문에 성립하지 않는다.'},
    answer:'dahye',keyClue:'hash',motive:'다혜가 edit-b 계정으로 원격 접속해 최종 영상을 교체했다.',
    reveal:'19:57의 교체 기록에 edit-b 계정이 남아 있고, 그 계정은 다혜에게 배정됐다. 물리적 출입 기록만으로는 원격 작업을 배제할 수 없다.',
    hint:'사람의 위치보다 파일을 저장한 계정에 집중하세요.'
  },
  {
    id:'bakery',number:'008',title:'새벽 빵집의 비밀 주문',kicker:'냄새 없는 오븐',category:'일상 미스터리',level:2,minutes:5,
    tagline:'팔리지도 않은 빵의 결제 기록이 남았다.',
    intro:'빵집의 새벽 한정 케이크가 사라졌다. 포장도 끝나기 전인데 판매 완료 기록이 있다. 누가 주문을 꾸몄을까?',
    location:'달빛 베이커리',time:'오전 6:25',weather:'맑음',theme:'rose',
    notes:['케이크는 오전 6시 완성됐다.','일반 매장 영업은 오전 7시 시작이다.','판매 처리에는 직원 PIN이 필요하다.'],
    clues:[
      {id:'pin',name:'판매 단말기 기록',type:'기록',detail:'06:13 케이크 판매 완료. 판매 직원 PIN 끝자리 42.',tag:'결정적'},
      {id:'pins',name:'직원 PIN 배정표',type:'서류',detail:'수진 42 / 진우 18 / 서아 76.',tag:'확인'},
      {id:'tray',name:'포장대 사진',type:'사진',detail:'06:10 사진에는 포장이 끝난 케이크 1개가 놓여 있다.',tag:'시간'},
      {id:'order',name:'예약 주문부',type:'서류',detail:'해당 케이크의 예약 주문은 없다. 결제 기록의 구매자 칸도 비어 있다.',tag:'물증'}
    ],
    witnesses:[
      {id:'sujin',name:'수진',role:'계산 담당',statement:'“가게 문 열기 전에는 판매 처리를 한 적이 없어요.”',question:'판매 전표를 등록했나요?',follow:'“아직 손님이 올 시간도 아니었어요.”'},
      {id:'jinwoo',name:'진우',role:'제빵사',statement:'“6시에 완성해서 포장대에 놓았어요.”',question:'케이크를 마지막으로 본 때는?',follow:'“6시 10분쯤이었어요.”'},
      {id:'seoa',name:'서아',role:'포장 직원',statement:'“6시 15분에 와보니 이미 없었습니다.”',question:'포장대에 언제 왔나요?',follow:'“판매 처리 여부는 몰랐어요.”'}
    ],
    contradiction:{witness:'sujin',clue:'pin',line:'개점 전에는 판매 처리한 적 없다는 말과 06:13 PIN 42 판매 로그가 맞지 않는다.'},
    answer:'sujin',keyClue:'pin',motive:'수진이 허위 판매를 입력하고 케이크를 가져갔다.',
    reveal:'주문은 없지만 판매 처리만 존재한다. 이때 사용된 PIN 42는 수진의 번호다. 케이크 완성 시각과 분실 시각 사이에 이루어진 조작이다.',
    hint:'누가 케이크를 봤는지보다 판매 완료를 누른 사람을 확인하세요.'
  }
];

export const CASE_BY_ID = Object.fromEntries(CASES.map(item => [item.id,item]));
export const CATEGORY_NAMES = [...new Set(CASES.map(item=>item.category))];
export function dailyCase(date = new Date()) {
  const koreaDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const days = Math.floor((Date.parse(koreaDate+'T00:00:00Z') - Date.parse('2026-10-21T00:00:00Z'))/86400000);
  return CASES[((days%CASES.length)+CASES.length)%CASES.length];
}