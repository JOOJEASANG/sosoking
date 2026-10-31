// Offline demo puzzles. Networked event answers are validated by Firebase Functions.
export const localRiddles=[
 {id:'moon',icon:'🌙',title:'달빛 연못',clue:'달빛이 비치는 연못에서 수수께끼가 들려옵니다.',question:'지구 주위를 도는 자연 위성의 이름은?',hint:'밤하늘에서 밝게 빛나요.',answers:['달','moon'],points:20},
 {id:'north',icon:'🧭',title:'방향의 탑',clue:'나침반이 한쪽을 가리킵니다.',question:'나침반의 N이 가리키는 방향은?',hint:'동·서·남·북 중 하나입니다.',answers:['북','북쪽','north'],points:25},
 {id:'time',icon:'⏳',title:'모래시계 해변',clue:'모래시계의 모래가 흘러내립니다.',question:'1시간은 몇 분일까요? 숫자로 입력하세요.',hint:'한 시간의 절반은 30분.',answers:['60','60분'],points:20},
 {id:'rainbow',icon:'🌈',title:'무지개 다리',clue:'무지개가 나타났습니다.',question:'무지개는 흔히 몇 가지 색으로 표현할까요?',hint:'빨주노초파남보.',answers:['7','7개','일곱','일곱개'],points:30},
 {id:'forest',icon:'🌲',title:'속삭이는 숲',clue:'나뭇잎들이 말합니다.',question:'뿌리·줄기·가지를 가지고 잎을 내는 식물을 두 글자로?',hint:'숲에 아주 많아요.',answers:['나무'],points:25},
 {id:'ice',icon:'🧊',title:'얼어붙은 동굴',clue:'투명한 결정이 있습니다.',question:'물을 얼리면 무엇이 될까요?',hint:'음료수를 시원하게 해요.',answers:['얼음'],points:20},
 {id:'sun',icon:'☀️',title:'태양의 언덕',clue:'아침에 먼저 빛을 받습니다.',question:'지구가 공전하는 중심 별의 이름은?',hint:'낮에 하늘을 밝히는 별.',answers:['태양','해'],points:35},
 {id:'star',icon:'⭐',title:'별빛 전망대',clue:'망원경 너머로 반짝이는 점이 보여요.',question:'스스로 빛을 내는 천체를 한 글자로?',hint:'밤하늘의 반짝이는 ○.',answers:['별'],points:30},
 {id:'water',icon:'💧',title:'생명의 샘',clue:'오아시스에서 맑은 샘이 흐릅니다.',question:'수소 두 개와 산소 하나로 이루어진 액체를 한 글자로?',hint:'목이 마를 때 마셔요.',answers:['물'],points:20},
 {id:'river',icon:'🌊',title:'거울 강',clue:'강물이 흘러갑니다.',question:'강물이 들어가는 넓고 짠 물을 두 글자로?',hint:'파도가 치는 곳.',answers:['바다'],points:25},
 {id:'map',icon:'🗺️',title:'오래된 서고',clue:'해진 종이에 길과 산이 있어요.',question:'길과 지형을 그림으로 나타낸 것을 두 글자로?',hint:'여행 중 길을 찾을 때 써요.',answers:['지도'],points:40},
 {id:'key',icon:'🗝️',title:'왕의 문',clue:'잠긴 문을 발견했습니다.',question:'자물쇠를 여는 물건을 두 글자로?',hint:'열쇠고리에 있어요.',answers:['열쇠'],points:40}
];
export const localScenery=[
 {id:'scenic-1',icon:'🏕️',title:'모험가의 야영지',clue:'모험가들이 쉬어 가는 곳이에요.'},
 {id:'scenic-2',icon:'🐚',title:'조개 해안',clue:'파도 소리만 들립니다.'},
 {id:'scenic-3',icon:'🌼',title:'꽃의 정원',clue:'향긋한 꽃이 가득하지만 보물은 없네요.'},
 {id:'scenic-4',icon:'🪨',title:'바위 언덕',clue:'바위 뒤에는 아무것도 없어요.'},
 {id:'scenic-5',icon:'🍄',title:'버섯 숲길',clue:'버섯 사이에는 보물이 없어요.'},
 {id:'scenic-6',icon:'🌴',title:'야자수 숲',clue:'야자수만 발견했습니다.'}
];
export const cleanTreasureAnswer=v=>String(v||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s.,!?]/g,'');
