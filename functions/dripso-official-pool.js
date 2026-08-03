'use strict';

const SCENES = Object.freeze([
  { key:'late-task', category:'직장', label:'퇴근 직전 추가 업무', event:'퇴근 5분 전에 새 업무가 생긴 상황', target:'퇴근 직전에 일을 주는 부장님', quote:'이거 금방 끝나.', question:'회사에서 퇴근 직전 가장 필요한 능력은?', object:'퇴근 직전 추가 업무' },
  { key:'long-meeting', category:'직장', label:'끝나지 않는 회의', event:'짧게 하겠다던 회의가 두 시간을 넘긴 상황', target:'회의를 짧게 하겠다고 말한 진행자', quote:'회의는 짧게 하겠습니다.', question:'회의의 진짜 목적은 무엇일까?', object:'끝나지 않는 회의' },
  { key:'friday-mail', category:'직장', label:'금요일 오후 메일', event:'금요일 퇴근 직전에 긴급 메일이 도착한 상황', target:'금요일 오후에 긴급 메일을 보낸 사람', quote:'메일 하나만 확인해 주세요.', question:'금요일 오후 메일의 무게는 어느 정도일까?', object:'금요일 오후 긴급 메일' },
  { key:'weekend-call', category:'직장', label:'주말의 업무 연락', event:'주말 아침에 업무 연락을 받은 상황', target:'주말 아침에 업무 전화를 건 사람', quote:'이번 주말에 잠깐 가능하시죠?', question:'주말에 가장 듣기 무서운 말은?', object:'주말 업무 연락' },
  { key:'alarm-snooze', category:'일상', label:'알람 다섯 번 끄기', event:'알람을 다섯 번 끄고 다시 잠든 상황', target:'알람을 끄고도 계속 자는 사람', quote:'5분만 더 잘게.', question:'알람의 천적은 무엇일까?', object:'다섯 번째 알람' },
  { key:'monday', category:'일상', label:'월요일 아침', event:'월요일 아침에 눈을 뜬 상황', target:'월요일 아침의 나', quote:'월요일도 금방 지나가.', question:'월요일을 버티는 데 가장 필요한 것은?', object:'월요일 아침' },
  { key:'late-delivery', category:'배달', label:'늦어지는 배달', event:'배달 예정 시간이 계속 늘어나는 상황', target:'곧 도착한다고 세 번째 말한 배달 앱', quote:'배달이 곧 도착합니다.', question:'배달을 기다릴 때 시간은 왜 느리게 갈까?', object:'계속 늦어지는 배달' },
  { key:'cake-missing', category:'가족', label:'냉장고 케이크 실종', event:'냉장고에 넣어둔 케이크가 사라진 상황', target:'케이크를 먹지 않았다고 주장하는 가족', quote:'난 케이크 안 먹었어.', question:'냉장고 속 케이크는 어디로 사라졌을까?', object:'사라진 냉장고 케이크' },
  { key:'diet-tomorrow', category:'음식', label:'내일부터 다이어트', event:'다이어트 중 야식을 주문한 상황', target:'내일부터 다이어트하겠다는 사람', quote:'오늘만 먹고 내일부터.', question:'다이어트가 항상 내일부터 시작되는 이유는?', object:'다이어트 중 야식' },
  { key:'gym-gear', category:'운동', label:'장비부터 산 운동', event:'운동은 시작하지 않고 장비만 모두 산 상황', target:'운동 장비부터 완벽하게 산 사람', quote:'운동은 장비부터지.', question:'운동 첫날 가장 먼저 단련되는 것은?', object:'새 운동 장비' },
  { key:'remote', category:'가족', label:'리모컨 실종 사건', event:'온 가족이 TV 리모컨을 찾는 상황', target:'매번 사라지는 TV 리모컨', quote:'리모컨이 발이 달렸나?', question:'TV 리모컨의 주 서식지는 어디일까?', object:'사라진 TV 리모컨' },
  { key:'laundry', category:'집안일', label:'쌓여가는 빨래', event:'빨래가 산처럼 쌓였는데 계속 미루는 상황', target:'빨래를 한꺼번에 하겠다는 사람', quote:'빨래는 한 번에 해야 효율적이야.', question:'빨래 바구니는 언제 가득 찰까?', object:'산처럼 쌓인 빨래' },
  { key:'dishes', category:'집안일', label:'불려두는 설거지', event:'설거지를 물에 담가둔 채 하루가 지난 상황', target:'설거지를 불려두는 중이라는 사람', quote:'물에 불려두는 중이야.', question:'설거지에서 가장 오래 걸리는 단계는?', object:'물에 담긴 설거지' },
  { key:'battery', category:'디지털', label:'배터리 1퍼센트', event:'휴대전화 배터리가 1퍼센트 남은 상황', target:'배터리 1퍼센트인 휴대전화', quote:'배터리 1%면 충분해.', question:'배터리 1퍼센트로 할 수 있는 가장 중요한 일은?', object:'배터리 1퍼센트' },
  { key:'wifi', category:'디지털', label:'와이파이 없는 집', event:'집에서 갑자기 와이파이가 끊긴 상황', target:'갑자기 연결을 끊은 와이파이 공유기', quote:'인터넷 없이도 살 수 있지.', question:'와이파이가 끊기면 가족이 가장 먼저 하는 일은?', object:'끊어진 와이파이' },
  { key:'group-chat', category:'관계', label:'단체방 읽고 침묵', event:'단체방에서 모두 읽고 아무도 답하지 않는 상황', target:'읽고도 답하지 않는 단체방 사람들', quote:'읽고 답장하려고 했어.', question:'단체방의 침묵은 몇 명부터 시작될까?', object:'읽음만 늘어나는 단체방' },
  { key:'boss-typo', category:'직장', label:'상사에게 보낸 오타', event:'상사에게 중요한 메시지를 오타로 보낸 상황', target:'보내기 버튼을 너무 빨리 누른 나', quote:'오타인 거 아시죠?', question:'메시지를 보낸 뒤 가장 빨리 발견되는 것은?', object:'상사에게 보낸 오타 메시지' },
  { key:'wrong-size', category:'쇼핑', label:'사이즈 실패 쇼핑', event:'온라인으로 산 옷의 사이즈가 맞지 않는 상황', target:'사이즈표를 믿고 주문한 사람', quote:'입다 보면 늘어나.', question:'온라인 쇼핑에서 가장 믿기 어려운 숫자는?', object:'맞지 않는 온라인 주문 옷' },
  { key:'delivered', category:'택배', label:'보이지 않는 배송 완료', event:'배송 완료라고 뜨지만 택배가 보이지 않는 상황', target:'배송 완료라고 알려준 택배 알림', quote:'배송 완료라고 뜨는데?', question:'배송 완료된 택배는 어디에 숨어 있을까?', object:'보이지 않는 배송 완료 택배' },
  { key:'missed-bus', category:'교통', label:'눈앞에서 떠난 버스', event:'정류장에 도착하자 버스가 떠난 상황', target:'눈앞에서 문을 닫고 떠난 버스', quote:'다음 버스 금방 와.', question:'버스가 가장 빨리 출발하는 순간은 언제일까?', object:'눈앞에서 떠난 버스' },
  { key:'subway-seat', category:'교통', label:'지하철 빈자리 경쟁', event:'지하철 빈자리 하나를 여러 사람이 동시에 발견한 상황', target:'멀리서 빈자리를 발견한 승객', quote:'저 자리 비어 보이는데?', question:'지하철 빈자리까지 필요한 최고 속도는?', object:'지하철의 마지막 빈자리' },
  { key:'parking', category:'자동차', label:'주차 자리 선점', event:'기다리던 주차 자리를 다른 차가 먼저 차지한 상황', target:'기다리던 자리에 먼저 들어온 운전자', quote:'잠깐 세운 거예요.', question:'주차장에서 가장 희귀한 자원은?', object:'방금 빼앗긴 주차 자리' },
  { key:'traffic', category:'자동차', label:'막히는 지름길', event:'지름길이라 선택한 도로가 더 막힌 상황', target:'지름길을 자신 있게 추천한 사람', quote:'이 길이 더 빠르다니까.', question:'내비게이션의 예상 시간은 언제 늘어날까?', object:'막히는 지름길' },
  { key:'umbrella', category:'날씨', label:'우산 없는 비', event:'우산 없이 나왔는데 갑자기 비가 내린 상황', target:'비 예보를 무시하고 나온 사람', quote:'비 안 올 줄 알았지.', question:'비 오는 날 가장 먼저 사라지는 것은?', object:'집에 두고 온 우산' },
  { key:'aircon', category:'계절', label:'한여름 에어컨 고장', event:'한여름에 에어컨이 고장 난 상황', target:'가장 더운 날 멈춘 에어컨', quote:'에어컨 없이도 버틸 만해.', question:'한여름 실내에서 가장 귀한 것은?', object:'고장 난 에어컨' },
  { key:'cold-shower', category:'계절', label:'겨울 찬물 샤워', event:'한겨울에 온수가 나오지 않는 상황', target:'겨울 아침에 멈춘 보일러', quote:'찬물 샤워가 건강에 좋아.', question:'겨울 찬물 샤워에서 가장 먼저 깨닫는 것은?', object:'나오지 않는 온수' },
  { key:'cafe-name', category:'카페', label:'카페 이름 오기입', event:'카페 컵에 내 이름이 전혀 다르게 적힌 상황', target:'내 이름을 새롭게 창조한 카페 직원', quote:'이름 철자가 이렇게 맞나요?', question:'카페에서 내 이름은 몇 가지로 변신할까?', object:'이름이 틀린 카페 컵' },
  { key:'menu-photo', category:'음식', label:'메뉴 사진과 현실', event:'주문한 음식이 메뉴 사진과 전혀 다른 상황', target:'사진과 다른 음식을 내놓은 식당', quote:'사진은 연출된 이미지입니다.', question:'메뉴 사진에서 가장 과장된 것은?', object:'사진과 다른 실제 메뉴' },
  { key:'late-friend', category:'관계', label:'거의 다 왔다는 친구', event:'친구가 거의 다 왔다고 한 뒤 한 시간이 지난 상황', target:'한 시간째 거의 다 왔다는 친구', quote:'나 거의 다 왔어.', question:'약속에서 거의 다 왔다는 말은 몇 분을 뜻할까?', object:'친구의 거의 다 왔다는 메시지' },
  { key:'blind-date', category:'연애', label:'어색한 소개팅', event:'소개팅에서 대화가 갑자기 끊긴 상황', target:'소개팅에서 질문이 떨어진 두 사람', quote:'취미가 어떻게 되세요?', question:'소개팅에서 가장 길게 느껴지는 시간은?', object:'소개팅의 어색한 침묵' },
  { key:'nothing', category:'연애', label:'아무것도 아니라는 말', event:'상대가 아무것도 아니라고 했지만 표정은 아닌 상황', target:'아무것도 아니라는 말을 한 연인', quote:'아무것도 아니야.', question:'아무것도 아니라는 말의 실제 뜻은?', object:'아무것도 아니라는 한마디' },
  { key:'family-question', category:'가족', label:'명절의 좋은 소식', event:'가족 모임에서 좋은 소식이 없냐는 질문을 받은 상황', target:'좋은 소식을 기다리는 친척', quote:'좋은 소식 없어?', question:'가족 모임에서 가장 피하고 싶은 질문은?', object:'좋은 소식을 묻는 가족 질문' },
  { key:'child-sleep', category:'육아', label:'잠들지 않는 아이', event:'일찍 자겠다던 아이가 밤늦게까지 깨어 있는 상황', target:'잘 시간이 되면 갑자기 활발해지는 아이', quote:'오늘은 일찍 잘 거야.', question:'아이의 잠은 왜 잘 시간에 달아날까?', object:'밤늦게까지 남은 아이의 체력' },
  { key:'pet-food', category:'반려동물', label:'간식 훔친 반려동물', event:'반려동물이 몰래 간식을 먹다 들킨 상황', target:'간식 앞에서 무죄 표정을 짓는 반려동물', quote:'한 입만 먹었어.', question:'반려동물이 가장 빨리 배우는 기술은?', object:'몰래 사라진 반려동물 간식' },
  { key:'exam', category:'학교', label:'시험 중 기억 삭제', event:'시험지를 받자 공부한 내용이 전부 생각나지 않는 상황', target:'시험 시작과 동시에 멈춘 내 기억', quote:'시험 범위가 어디까지였지?', question:'시험지를 받으면 가장 먼저 사라지는 것은?', object:'시험 직전까지 외운 내용' },
  { key:'homework', category:'학교', label:'마감 직전 과제', event:'과제 마감 한 시간 전에 시작한 상황', target:'마감 직전까지 과제를 미룬 학생', quote:'아직 시간 많아.', question:'과제 마감 시간은 왜 갑자기 빨라질까?', object:'마감 한 시간 전의 과제' },
  { key:'afk', category:'게임', label:'게임 중 자리 비움', event:'중요한 게임 도중 팀원이 자리를 비운 상황', target:'결정적인 순간에 자리를 비운 팀원', quote:'잠깐 자리 비울게.', question:'게임에서 잠깐은 몇 판을 뜻할까?', object:'자리 비운 팀원의 캐릭터' },
  { key:'password', category:'디지털', label:'기억나지 않는 비밀번호', event:'비밀번호를 여러 번 틀려 로그인이 막힌 상황', target:'내가 만들고도 기억하지 못하는 비밀번호', quote:'비밀번호가 분명 이거였는데.', question:'비밀번호를 바꾸면 가장 먼저 잊는 사람은?', object:'기억나지 않는 새 비밀번호' },
  { key:'update', category:'디지털', label:'급할 때 시작된 업데이트', event:'급하게 컴퓨터를 써야 하는데 업데이트가 시작된 상황', target:'가장 바쁜 순간에 시작된 자동 업데이트', quote:'업데이트는 금방 끝납니다.', question:'자동 업데이트는 왜 급할 때 시작될까?', object:'끝나지 않는 자동 업데이트' },
  { key:'midnight-snack', category:'음식', label:'편의점 야식', event:'늦은 밤 편의점에서 야식을 잔뜩 산 상황', target:'야식은 간식이라고 주장하는 사람', quote:'야식은 간식이야.', question:'밤에 먹는 음식의 칼로리는 어디로 갈까?', object:'늦은 밤 편의점 야식' }
]);

const MODE_BUILDERS = Object.freeze({
  blank: [
    s => [`${s.label}의 빈칸`, `${s.event}의 진짜 이유는 ______ 때문이다.`],
    s => [`${s.label} 한마디`, `${s.event}에서 가장 먼저 떠오른 말은 “______.”`],
    s => [`${s.label} 한 단어`, `${s.event}을 한 단어로 설명하면 ______.`],
    s => [`${s.label}의 결말`, `${s.event}의 결말은 결국 ______이었다.`],
    s => [`${s.label} 필수품`, `${s.event}에서 모두가 가장 필요했던 것은 ______이었다.`]
  ],
  naming: [
    s => [`${s.label} 영화 제목`, `${s.event}에 어울리는 영화 제목을 지어주세요.`],
    s => [`${s.label} 별명`, `${s.target}에게 가장 잘 어울리는 별명은?`],
    s => [`${s.label} 필살기`, `${s.event}을 해결하는 필살기 이름을 지어주세요.`],
    s => [`${s.label} 앱 이름`, `${s.event} 전용 앱이 출시된다면 이름은?`],
    s => [`${s.label} 작전명`, `${s.event}의 비밀 작전명을 지어주세요.`]
  ],
  comeback: [
    s => [`${s.label} 받아치기`, `누군가 “${s.quote}”라고 말했다. 가장 웃긴 대답은?`],
    s => [`${s.label} 마지막 한마디`, `“${s.quote}”라는 말을 들었을 때 한마디로 받아친다면?`],
    s => [`${s.label} 단체방 답장`, `단체방에 “${s.quote}”가 올라왔다. 가장 적절한 답장은?`],
    s => [`${s.label} 현실 답변`, `상대가 “${s.quote}”라고 우긴다. 현실적인 한마디는?`],
    s => [`${s.label} 초단문`, `친구가 “${s.quote}”라고 했다. 짧고 강하게 받아쳐 주세요.`]
  ],
  wrong: [
    s => [`${s.label} 오답`, `${s.question} 정답 말고 가장 웃긴 오답만 제출하세요.`],
    s => [`${s.label} 시험 오답`, `${s.question} 시험에 쓰면 0점이지만 웃긴 답은?`],
    s => [`${s.label} 전문가 오답`, `${s.question} 전문가인 척 완전히 틀리게 답한다면?`],
    s => [`${s.label} 어린이 오답`, `${s.question} 다섯 살 어린이처럼 답해 주세요.`],
    s => [`${s.label} 황당 오답`, `${s.question} 가장 황당하지만 기억에 남는 답은?`]
  ],
  headline: [
    s => [`${s.label} 속보`, `${s.event}을 속보 제목 한 줄로 작성해 주세요.`],
    s => [`${s.label} 경제 뉴스`, `${s.event}을 경제 뉴스처럼 보도한다면 제목은?`],
    s => [`${s.label} 스포츠 기사`, `${s.event}을 스포츠 경기 기사처럼 표현하면?`],
    s => [`${s.label} 재난문자`, `${s.event}을 긴급 재난문자처럼 한 줄로 쓴다면?`],
    s => [`${s.label} 연예 기사`, `${s.event}을 연예 기사처럼 과장한 제목은?`]
  ],
  excuse: [
    s => [`${s.label} 변명`, `${s.event}의 당사자가 할 가장 그럴듯한 변명은?`],
    s => [`${s.label} 황당 변명`, `${s.event}에 대한 황당하지만 순간 납득되는 변명은?`],
    s => [`${s.label} 첫 변명`, `${s.event}을 들킨 직후 가장 먼저 꺼낼 변명은?`],
    s => [`${s.label} 책임 회피`, `${s.event}의 책임을 피하기 위한 한마디는?`],
    s => [`${s.label} 우주 탓`, `${s.event}을 우주의 탓으로 돌리는 변명을 만들어 주세요.`]
  ],
  manual: [
    s => [`${s.label} 사용 주의`, `${s.target} 사용 시 가장 중요한 주의사항은?`],
    s => [`${s.label} 대처 설명서`, `${s.event} 대처 설명서의 첫 문장은?`],
    s => [`${s.label} 제품 설명`, `${s.object}을 제품처럼 소개하는 설명서 문구는?`],
    s => [`${s.label} 고장 증상`, `${s.target}의 대표적인 고장 증상을 한 줄로 적는다면?`],
    s => [`${s.label} 긴급 매뉴얼`, `${s.event} 긴급 대응 매뉴얼을 한 줄로 작성해 주세요.`]
  ]
});

const MODE_ORDER = Object.freeze(['blank', 'naming', 'comeback', 'wrong', 'headline', 'excuse', 'manual']);

function buildOfficialPool() {
  const rows = [];
  for (const mode of MODE_ORDER) {
    const builders = MODE_BUILDERS[mode];
    SCENES.forEach((scene, sceneIndex) => {
      builders.forEach((build, variantIndex) => {
        const [title, prompt] = build(scene);
        rows.push(Object.freeze({
          id: `${mode}-${String(sceneIndex + 1).padStart(2, '0')}-${variantIndex + 1}`,
          mode,
          title,
          prompt,
          category: scene.category,
          difficulty: variantIndex < 2 ? 'easy' : 'normal',
          recommendedMaxLength: mode === 'naming' ? 50 : 100,
          official: true
        }));
      });
    });
  }
  return Object.freeze(rows);
}

const OFFICIAL_BATTLES = buildOfficialPool();
const BY_MODE = Object.freeze(Object.fromEntries(MODE_ORDER.map(mode => [mode, Object.freeze(OFFICIAL_BATTLES.filter(item => item.mode === mode))])));

if (OFFICIAL_BATTLES.length !== 1400) throw new Error(`Expected 1400 official battles, got ${OFFICIAL_BATTLES.length}`);
if (new Set(OFFICIAL_BATTLES.map(item => item.id)).size !== OFFICIAL_BATTLES.length) throw new Error('Official battle IDs must be unique');
if (new Set(OFFICIAL_BATTLES.map(item => `${item.mode}\u0000${item.prompt}`)).size !== OFFICIAL_BATTLES.length) throw new Error('Official battle prompts must be unique');

module.exports = { MODE_ORDER, OFFICIAL_BATTLES, BY_MODE };
