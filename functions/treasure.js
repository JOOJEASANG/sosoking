'use strict';
const crypto=require('node:crypto');

// Answers live only in the server bundle, never in public Firestore documents.
const riddles=[
 {id:'moon',icon:'🌙',title:'달빛 연못',clue:'달빛이 비치는 연못에서 수수께끼가 들려옵니다.',question:'지구 주위를 도는 자연 위성의 이름은 무엇일까요?',hint:'밤하늘에서 밝게 빛나요.',answers:['달','moon'],points:20},
 {id:'north',icon:'🧭',title:'방향의 탑',clue:'오래된 나침반이 한쪽을 가리킵니다.',question:'나침반의 N이 가리키는 방향은?',hint:'동·서·남·북 중 하나입니다.',answers:['북','북쪽','north'],points:25},
 {id:'time',icon:'⏳',title:'모래시계 해변',clue:'모래시계의 모래가 흘러내립니다.',question:'1시간은 몇 분일까요? 숫자로 입력하세요.',hint:'한 시간의 절반은 30분이에요.',answers:['60','60분'],points:20},
 {id:'rainbow',icon:'🌈',title:'무지개 다리',clue:'비가 그치자 무지개가 나타났습니다.',question:'흔히 무지개는 몇 가지 색으로 표현할까요? 숫자로 입력하세요.',hint:'빨주노초파남보를 세어 보세요.',answers:['7','7개','일곱','일곱개'],points:30},
 {id:'forest',icon:'🌲',title:'속삭이는 숲',clue:'나뭇잎들이 한 목소리로 말합니다.',question:'뿌리·줄기·가지를 가지고 잎을 내는 식물을 두 글자로?',hint:'숲에는 이것이 아주 많아요.',answers:['나무'],points:25},
 {id:'ice',icon:'🧊',title:'얼어붙은 동굴',clue:'차가운 동굴 속에 투명한 결정이 있어요.',question:'물을 얼리면 무엇이 될까요? 두 글자로 답하세요.',hint:'음료수에 넣으면 시원해져요.',answers:['얼음'],points:20},
 {id:'sun',icon:'☀️',title:'태양의 언덕',clue:'아침에 가장 먼저 빛을 받는 언덕입니다.',question:'지구가 공전하는 중심 별의 이름은?',hint:'낮에 하늘을 밝히는 별이에요.',answers:['태양','해'],points:35},
 {id:'star',icon:'⭐',title:'별빛 전망대',clue:'망원경 너머로 반짝이는 점들이 보입니다.',question:'스스로 빛을 내는 천체를 한 글자로 부르면?',hint:'밤하늘의 반짝이는 ○.',answers:['별'],points:30},
 {id:'water',icon:'💧',title:'생명의 샘',clue:'오아시스 가운데 깨끗한 샘이 흐릅니다.',question:'수소 두 개와 산소 하나로 이루어진 액체를 한 글자로?',hint:'목이 마를 때 마셔요.',answers:['물'],points:20},
 {id:'river',icon:'🌊',title:'거울 강',clue:'물길이 바다로 이어집니다.',question:'강물이 마지막에 흘러 들어가는 넓고 짠 물을 두 글자로?',hint:'파도가 치는 곳이에요.',answers:['바다'],points:25},
 {id:'map',icon:'🗺️',title:'오래된 서고',clue:'해진 종이에 길과 산이 표시되어 있어요.',question:'길이나 지형을 그림으로 나타낸 것을 두 글자로?',hint:'여행할 때 길을 찾는 데 써요.',answers:['지도'],points:40},
 {id:'key',icon:'🗝️',title:'왕의 문',clue:'잠긴 문에는 작은 구멍이 있습니다.',question:'자물쇠를 열 때 쓰는 물건을 두 글자로?',hint:'열쇠고리에 달려 있어요.',answers:['열쇠'],points:40}
];
const scenic=[
 {id:'scenic-1',icon:'🏕️',title:'모험가의 야영지',clue:'모험가들이 쉬어 가는 곳이에요. 다음 장소를 탐색해 보세요.'},
 {id:'scenic-2',icon:'🐚',title:'조개 해안',clue:'파도 소리만 들립니다. 이곳에는 보물이 없네요.'},
 {id:'scenic-3',icon:'🌼',title:'꽃의 정원',clue:'향긋한 꽃이 가득하지만 보물은 다른 곳에 있습니다.'},
 {id:'scenic-4',icon:'🪨',title:'바위 언덕',clue:'커다란 바위 뒤에는 아무것도 없었어요.'},
 {id:'scenic-5',icon:'🍄',title:'버섯 숲길',clue:'버섯 사이를 살펴봐도 보물은 보이지 않습니다.'},
 {id:'scenic-6',icon:'🌴',title:'야자수 숲',clue:'바람에 흔들리는 야자수만 발견했습니다.'}
];
function shuffle(list){const out=[...list];for(let i=out.length-1;i>0;i--){const j=crypto.randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
function makeBoard(){const treasures=shuffle(riddles).slice(0,6).map(({id,icon,title,clue,question,hint,points})=>({id,icon,title,clue,question,hint,points,kind:'treasure'}));return shuffle([...treasures,...scenic.map(x=>({...x,kind:'scenery',points:0}))]);}
function answerMatches(id,input){const r=riddles.find(x=>x.id===id);if(!r)return false;const norm=v=>String(v||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s.,!?]/g,'');return r.answers.some(x=>norm(x)===norm(input));}
function blankState(){return {status:'waiting',round:0,board:[],rankings:[],firsts:[],duration:300,startedAt:0,endsAt:0};}
module.exports={makeBoard,answerMatches,blankState};
