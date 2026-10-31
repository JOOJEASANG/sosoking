import QRCode from 'qrcode';
import seoPages from '../tools/seo-programs.json';
import './style.css';
import {localRiddles,localScenery,cleanTreasureAnswer} from './treasure-local.js';

const defs=[
 {id:'raffle',name:'행운권 추첨',desc:'입장한 참가자 중에서 공정하게 추첨',symbol:'✦',tone:'peach',category:'추첨'},
 {id:'poll',name:'실시간 투표',desc:'스마트폰으로 투표하고 결과를 한눈에',symbol:'▥',tone:'lavender',category:'참여'},
 {id:'wheel',name:'룰렛',desc:'상품과 순서를 재미있게 무작위 선택',symbol:'◉',tone:'mint',category:'추첨'},
 {id:'score',name:'점수판',desc:'개인·팀 점수를 크게 표시하고 관리',symbol:'★',tone:'sky',category:'경기'},
 {id:'teams',name:'랜덤 팀 나누기',desc:'참가자를 공정하게 여러 팀으로 편성',symbol:'♟',tone:'butter',category:'경기'},
 {id:'timer',name:'행사 타이머',desc:'발표와 게임을 위한 대형 카운트다운',symbol:'◷',tone:'rose',category:'운영'},
 {id:'bracket',name:'대진표',desc:'토너먼트 자동 편성과 우승자 결정',symbol:'⑂',tone:'lilac',category:'경기'},
 {id:'treasure',name:'온라인 보물찾기',desc:'탐험 지도를 누르고 암호를 풀어 보물을 발견하세요',symbol:'🗝️',tone:'mint',category:'게임'}
];
const byId=Object.fromEntries(defs.map(x=>[x.id,x]));
const seoById=Object.fromEntries(seoPages.map(p=>[p.id,p]));
const programUrl=id=>'/programs/'+id+'/';
const moduleIds=defs.map(x=>x.id);
const storageKey='sosoking-live-v1';
const root=document.querySelector('#app');
const load=()=>{try{return JSON.parse(localStorage.getItem(storageKey))||{}}catch{return {}}};
let saved={hosts:{},members:{},recent:[],standalone:{},...load()};
let activeEvent=null,activeId='',activeView='',loading=false,requesting=false,notice='',lastRoute='';
let polling=null,ticking=null,lastRenderKey='';
let selectedTreasureSpot='';
const visitedTreasureSpots=new Set();
let treasureRoundKey='';
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{}};
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime=n=>{const s=Math.max(0,Math.floor(Number(n)||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const timeLabel=n=>new Date(n).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const element=(str)=>str;
const dateLabel=()=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'full',timeZone:'Asia/Seoul'}).format(new Date());
const urlFor=id=>location.origin+'/#/join/'+id;
function icon(name,size=20){
 const p={spark:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"/><path d="m19 18 .6 2.4L22 21l-2.4.6L19 24l-.6-2.4L16 21l2.4-.6L19 18Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zm7 0v3h-3m-4 4h3m2 0h2v-2"/>',check:'<path d="m5 12 4 4L19 6"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 5"/>',play:'<path d="m8 5 11 7-11 7V5Z"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="m15 18-6-6 6-6"/>',external:'<path d="M14 4h6v6m0-6L10 14"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3"/>',pause:'<path d="M8 5v14m8-14v14"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 13-2l2 5M4 12l2 5a8 8 0 0 0 13-2"/>',link:'<path d="M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'};
 return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(p[name]||p.spark)+'</svg>';
}
function toast(msg,bad=false){const el=document.querySelector('#toast');el.textContent=msg;el.className='show '+(bad?'error':'');clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='',4000);}
async function api(path,data=null,secret='',method=null,personId=''){
 const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),18000);
 try{
  const r=await fetch('/api/'+path,{method:method||(data?'POST':'GET'),headers:{...(data?{'Content-Type':'application/json'}:{}),...(secret?{'Authorization':'Bearer '+secret}:{}),...(personId?{'x-person-id':personId}:{})},body:data?JSON.stringify(data):undefined,signal:controller.signal,cache:'no-store'});
  const json=await r.json().catch(()=>({error:'서버 응답을 확인할 수 없습니다.'}));
  if(!r.ok)throw Error(json.error||'요청을 처리할 수 없습니다.');
  return json;
 }finally{clearTimeout(stop);}
}
function initial(){return{
 raffle:{winners:[],last:null},poll:{id:'',question:'',options:[],counts:[],open:false,answered:0},
 wheel:{items:['1번','2번','3번','4번'],last:null,history:[]},score:{rows:[]},teams:{groups:[]},
 timer:{duration:60,remaining:60,running:false,startedAt:0},bracket:{names:[],rounds:[],finished:false},
 treasure:{status:'waiting',round:0,board:[],rankings:[],firsts:[],duration:300,startedAt:0,endsAt:0,solved:[],attempts:{}}
};}
function localEvent(id){return{id:'local-'+id,title:byId[id].name+' · 바로 사용',modules:[id],active:id,status:'open',people:[],peopleCount:0,state:initial(),createdAt:Date.now(),revision:0};}
function route(){
 if(location.hash.startsWith('#/')){try{return decodeURIComponent(location.hash.slice(2)).split('/')}catch{return ['not-found']}}
 const match=location.pathname.match(/^\/programs\/([a-z-]+)\/?(?:index\.html)?$/);
 if(match&&byId[match[1]])return ['tool',match[1]];
 return ['home'];
}
function routeMatch(){const r=route();return r[0]||'home';}
function navUpdate(){
 const r=routeMatch();
 document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('current',(r==='home'?'/':r==='tools'||r==='tool'?'/tools':r==='events'||r==='manage'||r==='join'?'/events':r==='install'?'/install':'/create')===a.dataset.nav));
}
function badge(text,extra=''){return '<span class="badge '+extra+'">'+h(text)+'</span>';}
function button(text,action,extra='',attrs=''){return '<button class="btn '+extra+'" type="button" data-do="'+action+'" '+attrs+'>'+text+'</button>';}
function sectionHead(kicker,title,desc=''){return '<div class="section-heading"><div><span class="eyebrow">'+h(kicker)+'</span><h2>'+h(title)+'</h2></div><p>'+h(desc)+'</p></div>';}
function moduleCard(m,context='tools'){
 const label=context==='create'?'모임에 추가':'바로 실행하기';
 return '<article class="program-card tone-'+m.tone+'"><div class="program-top"><div class="program-symbol">'+m.symbol+'</div>'+badge(m.category)+'</div><h3>'+h(m.name)+'</h3><p>'+h(m.desc)+'</p>'+(context==='create'?'<label class="pick-choice"><input type="checkbox" name="modules" value="'+m.id+'" '+(window.picks?.includes(m.id)?'checked':'')+'> <span>행사에 추가</span></label>':'<a class="card-link" href="'+programUrl(m.id)+'" target="_blank" rel="noopener noreferrer">'+label+' '+icon('external',17)+'</a>')+'</article>';
}
function home(){
 return '<div class="page-home"><section class="hero"><div class="shell hero-layout"><div class="hero-text"><div class="hero-pill"><span class="pulse"></span> 필요할 때 꺼내 쓰는 8가지 도구</div><h1>일상의 작은 선택도,<br><em>모임의 특별한 순간도.</em></h1><p>룰렛·대진표·추첨기·점수판까지, 클릭 한 번으로 바로 시작하세요.<br>여럿이 모일 땐 QR이나 초대 링크로 함께 즐길 수 있어요.</p><div class="hero-actions"><a href="/#/tools" class="btn primary big">프로그램 바로 사용하기 '+icon('arrow',18)+'</a><a href="/#/create" class="btn pale big">모임 만들기</a></div><div class="hero-trust"><span>'+icon('check',16)+' 별도 앱 설치 없음</span><span>'+icon('check',16)+' 필요한 기능만 선택</span><span>'+icon('check',16)+' 모바일·대형 화면</span></div></div><div class="hero-art"><div class="art-glow"></div><div class="art-card art-main"><div class="art-card-head"><span class="art-mini-logo">S</span><div><b>가을 한마음 축제</b><small>행사 진행 중 · LIVE</small></div><span class="art-dot"></span></div><div class="art-qr">▦<small>QR 입장</small></div><div class="art-people"><span class="art-avatars">● ● ●</span><b>참가자 128명</b></div><div class="art-stat"><span>추첨</span><span>투표</span><span>대진표</span></div></div><div class="float-note note-top">✦ 당첨자를 발표했어요!</div><div class="float-note note-bottom">✓ 모두 입장 완료</div></div></div></section>'
 +'<section class="shell quick-play-section"><div class="quick-header"><div><span class="eyebrow">INSTANT PLAY · 설치 없이 시작</span><h2>필요한 프로그램, 바로 시작하세요</h2><p>회원가입도 복잡한 설정도 없이. 원하는 도구를 골라 사용하세요.</p></div><a href="/#/tools" class="quick-all">8개 전체 보기 →</a></div><div class="quick-grid">'
 +[{id:'wheel',title:'룰렛 돌리기',subtitle:'오늘의 운을 시험해요',symbol:'◉',color:'mint'},{id:'raffle',title:'랜덤 추첨',subtitle:'누가 당첨될까요?',symbol:'✦',color:'peach'},{id:'bracket',title:'대진표 만들기',subtitle:'순위와 우승자를 정해요',symbol:'⑂',color:'lilac'},{id:'teams',title:'랜덤 팀 나누기',subtitle:'공평하게 팀을 나눠요',symbol:'♟',color:'butter'}].map(m=>'<a href="'+programUrl(m.id)+'" target="_blank" rel="noopener noreferrer" class="quick-card quick-'+m.color+'"><span class="quick-emoji">'+m.symbol+'</span><b>'+m.title+'</b><small>'+m.subtitle+'</small><span class="quick-arrow">↗</span></a>').join('')
 +'</div><div class="quick-help">같이 진행하고 싶나요? <a href="/#/create">행사방 만들고 QR·링크로 함께 참여하기 →</a></div></section>'

 +'<section class="shell how-section">'+sectionHead('HOW IT WORKS','세 단계면 준비 끝','현장은 QR로, 온라인 모임은 링크로. 별도 앱 없이 시작하세요.')
 +'<div class="step-grid"><div class="step"><span>01</span><div class="step-icon">'+icon('plus',26)+'</div><h3>행사 만들기</h3><p>행사명을 입력하고 원하는 프로그램 선택</p></div><div class="step-arrow">→</div><div class="step"><span>02</span><div class="step-icon">'+icon('qr',26)+'</div><h3>QR·링크 공유</h3><p>현장은 QR, 온라인은 링크로 입장</p></div><div class="step-arrow">→</div><div class="step"><span>03</span><div class="step-icon">'+icon('play',26)+'</div><h3>함께 즐기기</h3><p>진행자가 프로그램을 열면 함께 참여</p></div></div></section>'
 +'<section class="program-section"><div class="shell">'+sectionHead('PROGRAM LIBRARY','필요한 것만 쏙쏙','행사가 없어도 바로 실행할 수 있는 8가지 프로그램. 대진표도 포함돼요.')
 +'<div class="program-grid">'+defs.map(m=>moduleCard(m)).join('')+'</div><div class="section-actions"><a href="/#/create" class="btn primary">이 프로그램으로 행사 만들기 '+icon('arrow',17)+'</a></div></div></section>'
 +homeExtras()
 +'<section class="shell close-cta"><div><span class="eyebrow">ONE EVENT, MANY MOMENTS</span><h2>우리 행사에 딱 맞게<br>구성해 보세요.</h2><p>바자회, 체육대회, 온라인 동창회, 가족 모임 어디서나.</p></div><a href="/#/create" class="btn white big">행사 만들기 '+icon('arrow',17)+'</a></section></div>';
}
function homeExtras(){return "<section class=\"shell detail-section\" aria-labelledby=\"cases-title\"><div class=\"section-heading\"><div><span class=\"eyebrow\">REAL LIFE USE CASES</span><h2 id=\"cases-title\">어떤 모임이든 더 쉽게 운영하세요</h2></div><p>진행자는 준비를 줄이고 참가자는 더 편하게 즐길 수 있습니다.</p></div><div class=\"case-grid\"><article><span class=\"case-icon\">01</span><h3>학교·학급 행사</h3><p>학급 대항전, 발표 시간, 토너먼트 경기까지 필요한 도구를 한곳에서 운영해요.</p><span>대진표 · 점수판 · 타이머</span></article><article><span class=\"case-icon\">02</span><h3>회사·팀 워크숍</h3><p>조 편성 후 의견을 모으고, 마지막 경품 추첨으로 분위기를 이어가세요.</p><span>팀 나누기 · 투표 · 추첨</span></article><article><span class=\"case-icon\">03</span><h3>동호회·온라인 모임</h3><p>초대 링크로 각자 입장하고 진행자 화면을 공유하며 참여할 수 있어요.</p><span>QR 입장 · 실시간 투표 · 룰렛</span></article></div></section>\n<section class=\"feature-section\"><div class=\"shell\"><div class=\"section-heading\"><div><span class=\"eyebrow\">CHOOSE YOUR WAY</span><h2>혼자 바로 쓰기 vs 함께 행사 진행</h2></div><p>상황에 맞는 방식으로 시작하세요.</p></div><div class=\"feature-grid\"><article><div class=\"feature-illustration feature-solo\">✦ <span>ONE CLICK</span></div><div><h3>바로 사용하기</h3><p>프로그램을 선택하면 즉시 실행됩니다. 별도의 행사방 없이 이 브라우저에 결과를 저장합니다.</p><ul><li>룰렛·대진표·추첨 즉시 시작</li><li>샘플 명단으로 빠른 연습</li><li>CSV 저장과 인쇄</li></ul><a href=\"/#/tools\" class=\"feature-link\">프로그램 찾아보기 →</a></div></article><article><div class=\"feature-illustration feature-group\">▦ <span>TOGETHER</span></div><div><h3>함께 행사 진행하기</h3><p>진행자가 행사방을 만들면 참가자는 QR이나 링크로 입장합니다. 관리와 발표 화면을 분리해 운영할 수 있어요.</p><ul><li>행사당 최대 200명 입장</li><li>진행자 전용 프로그램 관리</li><li>생성 후 7일간 이용</li></ul><a href=\"/#/create\" class=\"feature-link\">행사방 만들기 →</a></div></article></div></div></section>\n<section class=\"shell install-teaser\"><div class=\"install-teaser-copy\"><span class=\"eyebrow\">SOSOKING ON YOUR HOME SCREEN</span><h2>소소킹을 스마트폰에<br>앱처럼 꺼내 쓰세요</h2><p>앱 마켓 다운로드 없이 브라우저의 ‘홈 화면에 추가’ 기능으로 아이콘을 만들 수 있습니다. 설치하지 않아도 모든 프로그램을 이용할 수 있어요.</p><div class=\"install-teaser-actions\"><button type=\"button\" class=\"btn primary big\" data-do=\"install-app\">홈 화면에 추가하기</button><a href=\"/#/install\" class=\"btn pale big\">기기별 설치 방법</a></div></div><img src=\"/install-guide.svg\" alt=\"스마트폰에 소소킹 아이콘을 추가하는 화면 예시\" width=\"480\" height=\"310\" loading=\"lazy\"></section>\n<section class=\"shell home-faq\"><div class=\"section-heading\"><div><span class=\"eyebrow\">FREQUENT QUESTIONS</span><h2>자주 묻는 질문</h2></div><p>처음 사용하는 분들도 쉽게 시작할 수 있도록 정리했습니다.</p></div><div class=\"faq-grid\"><details><summary>회원가입이나 앱 설치가 꼭 필요한가요?</summary><p>아니요. 프로그램은 웹에서 바로 이용할 수 있습니다. 홈 화면에 추가하는 기능은 선택 사항입니다.</p></details><details><summary>행사 참가자는 어떻게 입장하나요?</summary><p>진행자가 만든 행사방의 QR코드를 스캔하거나 초대 링크를 누른 뒤 닉네임을 입력하면 됩니다.</p></details><details><summary>행사를 만든 뒤 프로그램을 바꿀 수 있나요?</summary><p>네. 행사 관리실에서 7가지 프로그램을 추가하거나 제외할 수 있습니다. 이미 진행한 기록은 유지됩니다.</p></details><details><summary>진행하던 행사는 얼마나 유지되나요?</summary><p>행사방은 생성 후 7일간 이용할 수 있습니다. 진행자 비밀키는 생성 기기의 브라우저에 저장되므로 브라우저 데이터를 삭제하지 않도록 유의해 주세요.</p></details></div></section>";}
function install(){return "<div class=\"shell inner-page install-page\"><div class=\"page-intro compact\"><span class=\"eyebrow\">INSTALL SOSOKING LIVE</span><h1>소소킹을 앱처럼 사용하세요</h1><p>앱스토어 다운로드가 아닌 브라우저의 홈 화면 추가 기능입니다. 웹사이트와 동일한 7가지 프로그램을 실행합니다.</p></div><div class=\"install-hero\"><div><img class=\"install-hero-mark\" src=\"/app-icon.svg\" alt=\"소소킹 앱 아이콘\" width=\"92\" height=\"92\"><h2>홈 화면에서 한 번에 시작</h2><p>스마트폰 바탕화면에 소소킹 아이콘을 추가해 원하는 프로그램을 빠르게 이용하세요.</p><button type=\"button\" data-do=\"install-app\" class=\"btn primary big\">이 기기에 설치하기</button><p class=\"install-hero-note\">기기·브라우저에 따라 설치 메뉴 이름과 버튼 표시 여부가 달라집니다.</p></div><img class=\"install-hero-art\" src=\"/install-guide.svg\" alt=\"스마트폰 홈 화면과 소소킹 아이콘 설치 예시\" width=\"480\" height=\"310\"></div><div class=\"section-heading install-heading\"><div><span class=\"eyebrow\">STEP BY STEP</span><h2>기기별 설치 방법</h2></div><p>설치 버튼이 나타나지 않으면 아래 방법을 이용해 주세요.</p></div><div class=\"install-steps\"><article><span class=\"install-platform\">ANDROID · CHROME</span><h3>안드로이드 크롬</h3><ol><li>크롬에서 sosoking.co.kr을 엽니다.</li><li>오른쪽 위 더보기(⋮)를 누릅니다.</li><li>‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택합니다.</li><li>안내에 따라 추가를 완료합니다.</li></ol></article><article><span class=\"install-platform\">SAMSUNG INTERNET</span><h3>삼성 인터넷</h3><ol><li>삼성 인터넷에서 사이트를 엽니다.</li><li>메뉴(≡)를 누릅니다.</li><li>‘현재 페이지 추가’ 또는 홈 화면 추가 메뉴를 선택합니다.</li><li>홈 화면에 바로가기를 만듭니다.</li></ol></article><article><span class=\"install-platform\">IPHONE · SAFARI</span><h3>아이폰 사파리</h3><ol><li>사파리에서 사이트를 엽니다.</li><li>공유 버튼을 선택합니다.</li><li>‘홈 화면에 추가’를 선택합니다.</li><li>이름을 확인하고 ‘추가’를 누릅니다.</li></ol></article></div><div class=\"install-footnote\"><strong>알아두세요</strong><p>이 사이트는 웹 기반 서비스입니다. Google Play 또는 App Store에 등록된 앱을 내려받는 방식이 아니며, 행사방의 데이터 공유 기능은 인터넷 연결이 필요합니다.</p><a href=\"/#/tools\">7가지 프로그램 사용하기 →</a></div></div>";}
function tools(){
 return '<div class="shell inner-page"><div class="page-intro"><span class="eyebrow">PROGRAM LIBRARY</span><h1>행사가 없어도 좋아요.<br>골라서 바로 즐기세요.</h1><p>룰렛·대진표·추첨기까지, 클릭 한 번으로 바로 실행해요. 행사를 따로 만들 필요 없어요.</p></div><div class="direct-play-strip"><strong>지금 바로 사용 가능</strong><span>개별 도구는 회원가입·행사 생성·QR 없이 쓸 수 있어요.</span><a href="/programs/bracket/" target="_blank" rel="noopener noreferrer">대진표 바로 만들기 ↗</a></div><div class="program-grid">'+defs.map(m=>moduleCard(m)).join('')+'</div><div class="bottom-hint">'+icon('users',23)+' <div><strong>여러 사람이 함께 참여하나요?</strong><p>행사방을 만들면 QR 입장, 진행자 제어, 실시간 결과 공유가 가능합니다.</p></div><a href="/#/create" class="btn primary">행사 만들기</a></div></div>';
}
function create(){
 const selected=window.picks||['raffle','poll','bracket'];window.picks=selected;
 return '<div class="shell inner-page"><a class="back-link" href="/#/">'+icon('back',16)+' 처음으로</a><div class="page-intro compact"><span class="eyebrow">CREATE AN EVENT</span><h1>우리 행사 만들기</h1><p>현장 행사와 온라인 모임 모두 지원합니다. QR과 초대 링크가 함께 생성됩니다.</p></div>'
 +'<form id="create-form" data-form="create"><div class="form-section"><div class="form-title"><span class="step-index">01</span><div><h2>행사 이름</h2><p>온라인 채팅방과 현장 QR에 함께 표시될 이름이에요.</p></div></div><input class="text-input large" type="text" name="title" maxlength="65" minlength="2" required placeholder="예: 2026 행복한 가을 운동회"></div>'
 +'<div class="form-section"><div class="form-title"><span class="step-index">02</span><div><h2>모임 참여 방식</h2><p>참가자에게 맞는 초대 방식을 선택하세요.</p></div></div><div class="mode-options"><label class="mode-choice"><input type="radio" name="mode" value="hybrid" checked><strong>현장 + 온라인</strong><span>QR·초대 링크 모두 사용</span></label><label class="mode-choice"><input type="radio" name="mode" value="online"><strong>온라인 모임</strong><span>화상회의 채팅방에 링크 공유</span></label><label class="mode-choice"><input type="radio" name="mode" value="onsite"><strong>현장 행사</strong><span>대형 화면에 QR 표시</span></label></div></div><div class="form-section"><div class="form-title"><span class="step-index">03</span><div><h2>사용할 프로그램 선택</h2><p>필요한 것만 선택해 주세요. 선택한 프로그램은 하나의 행사방에서 운영됩니다.</p></div></div><div class="program-grid selector-grid">'+defs.map(m=>moduleCard(m,'create')).join('')+'</div></div>'
 +'<div class="create-bottom"><div><strong>프로그램 <span id="selected-count">'+selected.length+'</span>개 선택됨</strong><p>참가자는 QR코드로 입장하고 진행자는 프로그램을 제어합니다.</p></div><button class="btn primary big" type="submit" id="create-button">행사방 만들기 '+icon('arrow',18)+'</button></div></form></div>';
}
function events(){
 const rs=saved.recent.filter(x=>saved.hosts[x.id]).slice(0,30);
 return '<div class="shell inner-page"><div class="page-intro compact"><span class="eyebrow">MY EVENTS</span><h1>내 행사</h1><p>이 브라우저에서 만든 행사를 확인할 수 있습니다. 진행자 권한은 현재 브라우저에 보관됩니다.</p></div>'
 +(rs.length?'<div class="event-list">'+rs.map(x=>'<a href="/#/manage/'+x.id+'" class="event-entry"><span class="event-circle">'+icon('users',22)+'</span><span class="event-title"><b>'+h(x.title)+'</b><small>'+h(timeLabel(x.date))+'</small></span><span>관리하기 '+icon('arrow',17)+'</span></a>').join('')+'</div>':'<div class="empty-panel"><div class="empty-illustration">'+icon('plus',32)+'</div><h2>아직 만든 행사가 없어요</h2><p>첫 번째 행사를 만들고 필요한 프로그램을 선택하세요.</p><a href="/#/create" class="btn primary">새 행사 만들기</a></div>')+'</div>';
}
function shellNotice(title,message,href='#/'){return '<div class="shell inner-page"><div class="empty-panel"><div class="empty-illustration">!</div><h2>'+h(title)+'</h2><p>'+h(message)+'</p><a class="btn primary" href="'+href+'">돌아가기</a></div></div>';}
async function loadEvent(id,view,silent=false){
 if(requesting)return;
 const token=view==='manage'?saved.hosts[id]:view==='screen'?'':saved.members[id]?.token;
 const extra=view==='manage'?'&host=1':view==='join'&&saved.members[id]?'&member=1':'';
 const personId=view==='join'?saved.members[id]?.id||'':'';
 requesting=true;
 try{
  let response=await api('event?id='+encodeURIComponent(id)+extra,null,token,null,personId);
  if(route()[1]!==id||routeMatch()!==view)return;
  const selected=view==='manage'&&route()[2]==='tool'?route()[3]:null;
  if(selected&&!response.event.modules.includes(selected))throw Error('이 행사에 선택되지 않은 프로그램입니다. 행사 관리실에서 추가해 주세요.');
  if(selected&&!silent&&!activeEvent&&response.event.active!==selected){
    await api('action',{id,op:'event.active',value:selected},token);
    response=await api('event?id='+encodeURIComponent(id)+extra,null,token,null,personId);
    if(route()[1]!==id||routeMatch()!==view)return;
  }
  activeEvent=response.event;activeEvent.memberTreasure=response.memberTreasure||null;activeId=id;activeView=view;
  const currentKey=route().join('/')+'|'+String(activeEvent.revision||0)+'|'+JSON.stringify(activeEvent.memberTreasure||{});
  const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  if((!silent||currentKey!==lastRenderKey)&&(!silent||!editing))renderEvent();
  drawQr();
 }catch(error){
  if(!silent){root.innerHTML=shellNotice('행사에 연결할 수 없습니다.',error.message,'#/events');}
  else{toast('행사 정보를 새로 불러오지 못했습니다.',true);}
 }finally{requesting=false;}
}
function getMode(){return routeMatch()==='tool'?'local':routeMatch()==='manage'?'host':routeMatch()==='screen'?'screen':'participant';}
function localDemoBanner(id){
 const text={raffle:'8명으로 추첨 연습하기',poll:'가상 투표 바로 해보기',wheel:'랜덤 선물 룰렛 해보기',score:'청팀·홍팀 점수판 만들기',teams:'8명 랜덤 팀 나누기',timer:'1분 타이머 준비하기',bracket:'8팀 토너먼트 대진표 만들기',treasure:'보물섬 탐험 시작하기'};
 return '<div class="demo-strip"><div><span>QUICK START · 한 번에 체험하기</span><strong>'+h(text[id]||'바로 시작하기')+'</strong></div>'+button('샘플로 시작 →','demo-setup','btn primary','data-id="'+id+'"')+'</div>';
}
function loadLocalDemo(id){
 const names=['하늘','바다','바람','별빛','초록','달빛','구름','햇살'];
 switch(id){
  case 'raffle':localAction('local.people',names);break;
  case 'poll':localAction('poll.set',{question:'오늘 가장 기대되는 것은?',options:['행운권 추첨','맛있는 간식','게임과 대결']});localAction('poll.open');break;
  case 'wheel':localAction('wheel.set',['커피 쿠폰','꽝, 한 번 더!','간식 선물','축하 선물','오늘의 행운']);break;
  case 'score':localAction('score.set',['청팀','홍팀']);break;
  case 'teams':localAction('teams.make',{names,groupCount:2});break;
  case 'timer':localAction('timer.set',60);break;
  case 'bracket':localAction('bracket.set',names);break;
  case 'treasure':localAction('treasure.start',{duration:300});break;
  default:throw Error('지원하지 않는 프로그램입니다.');
 }
 save();renderEvent();
}

function eventProgramCard(event,m){
 const running=event.active===m.id;
 const url='#/manage/'+event.id+'/tool/'+m.id;
 return '<a class="event-program-card tone-'+m.tone+(running?' is-running':'')+'" href="'+url+'" target="_blank" rel="noopener noreferrer" aria-label="'+h(m.name)+' 전용 진행 페이지 새 탭에서 열기">'
 +'<div class="program-top"><span class="program-symbol">'+m.symbol+'</span>'+(running?badge('진행 중','success'):badge(m.category))+'</div>'
 +'<h3>'+h(m.name)+'</h3><p>'+h(m.desc)+'</p><span class="event-program-open">'+(running?'진행 화면 다시 열기':'프로그램 페이지 열기')+' '+icon('external',16)+'</span>'
 +'</a>';
}
function hostPanel(event){
 const current=event.active&&byId[event.active];
 return '<div class="shell live-page"><a class="back-link" href="/#/events">'+icon('back',16)+' 내 행사</a>'
 +'<div class="event-heading"><div>'+badge('행사 관리실','live-badge')+'<h1>'+h(event.title)+'</h1><p>필요한 프로그램을 선택하세요. 각 프로그램은 새 탭의 독립 페이지에서 실행됩니다.</p></div><div class="event-heading-right"><span class="people-count">'+icon('users',19)+' 참가자 '+event.peopleCount+'명</span></div></div>'
 +sharePanel(event)+editModules(event)
 +'<div class="event-control-area"><div class="workspace-head"><div><span class="eyebrow">MY EVENT PROGRAMS</span><h2>실행할 프로그램 선택</h2><p class="event-control-caption">클릭하면 해당 프로그램 전용 페이지가 새 탭에서 열립니다. 참가자와 행사 기록은 그대로 연결됩니다.</p></div><div class="event-control-now">'+(current?'<span class="pulse"></span> 진행 중: '+h(current.name):'아직 실행 중인 프로그램 없음')+'</div></div>'
 +'<div class="event-program-grid">'+event.modules.filter(id=>byId[id]).map(id=>eventProgramCard(event,byId[id])).join('')+'</div>'
 +'<div class="event-control-tip">'+icon('check',18)+' <span>이곳에서는 QR 초대·프로그램 선택·참가자 관리를 하고, 게임이나 점수판은 별도 페이지에서 운영하세요.</span></div>'
 +'<div class="event-side-overview"><div class="side-card"><h3>행사 상태</h3><div class="side-stat"><span>입장 인원</span><b>'+event.peopleCount+'명</b></div><div class="side-stat"><span>등록 프로그램</span><b>'+event.modules.length+'개</b></div><div class="side-stat"><span>입장 상태</span>'+badge(event.status==='open'?'입장 가능':'입장 마감',event.status==='open'?'success':'')+'</div>'+button(event.status==='open'?'참가자 입장 마감':'참가자 입장 열기','door','btn subtle full')+'</div>'
 +'<div class="side-card"><h3>참가자 명단</h3><div class="small-list">'+(event.people?.length?event.people.map((p,i)=>'<div><span>'+String(i+1).padStart(2,'0')+'</span>'+h(p.name)+'</div>').join(''):'<p>참가자가 QR·링크로 입장하면 표시됩니다.</p>')+'</div></div></div></div></div>';
}
const programGuides={
 raffle:{step:['참가자 명단 준비','당첨 인원 선택','무작위 추첨 · 기록 저장'],tip:'이미 당첨된 참가자는 다음 추첨에서 자동으로 제외됩니다.'},
 poll:{step:['질문과 선택지 작성','투표 시작 · 응답 접수','투표 마감 · 결과 확인'],tip:'행사방에서는 참가자 한 명당 한 번만 응답할 수 있습니다.'},
 wheel:{step:['룰렛 항목 작성','돌림판 회전','선정 결과 확인'],tip:'룰렛은 항목별 동일한 확률로 선택됩니다.'},
 score:{step:['팀 또는 선수 등록','버튼으로 점수 기록','최종 순위 확인'],tip:'+1, +5 버튼으로 점수를 더하고 − 버튼으로 수정할 수 있습니다.'},
 teams:{step:['참가자 명단 준비','팀 개수 선택','무작위 편성 결과 확인'],tip:'팀 인원 차이가 최대 1명 나도록 배정합니다.'},
 timer:{step:['제한 시간 정하기','시작 또는 일시정지','종료 확인'],tip:'타이머가 종료되면 화면 색상이 바뀌어 종료를 알려줍니다.'},
 bracket:{step:['2~32팀 명단 작성','대진표 무작위 생성','승리 팀 선택 · 우승 결정'],tip:'인원이 2의 거듭제곱이 아니어도 부전승이 자동 배정됩니다.'},
 treasure:{step:['혼자 시작하거나 행사방 공유','12곳 탐색 · 단서와 암호 풀이','보물 점수·순위 확인'],tip:'온라인 대회는 각자 같은 지도를 탐험하며, 보물 최초 발견자에게 15점 보너스를 줍니다.'}
};
function programGuide(id){
 const guide=programGuides[id];if(!guide)return '';
 return '<div class="program-guide"><div class="guide-heading"><span>이 프로그램 사용법</span><small>3 STEPS</small></div><div class="guide-steps">'+guide.step.map((step,i)=>'<span><b>0'+(i+1)+'</b>'+h(step)+'</span>').join('')+'</div><p>'+icon('check',15)+' '+h(guide.tip)+'</p></div>';
}
function exportRows(id,event){
 const s=event.state?.[id]||{},name=event.title||'소소킹';
 if(id==='raffle')return {filename:'추첨결과',rows:[['번호','참가자','추첨시간'],...(s.winners||[]).map((w,i)=>[i+1,w.name,new Date(w.at||Date.now()).toLocaleString('ko-KR')])]};
 if(id==='poll')return {filename:'투표결과',rows:[['질문',s.question||''],['선택지','득표수','득표율'],...(s.options||[]).map((x,i)=>[x,s.counts?.[i]||0,(s.answered?Math.round(100*(s.counts?.[i]||0)/s.answered):0)+'%'])]};
 if(id==='wheel')return {filename:'룰렛결과',rows:[['순서','항목','선정시간'],...(s.history||[]).map((x,i)=>[i+1,x.name,new Date(x.at||Date.now()).toLocaleString('ko-KR')])]};
 if(id==='score')return {filename:'점수판',rows:[['순위','팀/선수','점수'],...(s.rows||[]).map(x=>({...x})).sort((a,b)=>b.points-a.points).map((x,i)=>[i+1,x.name,x.points])]};
 if(id==='teams')return {filename:'팀편성',rows:[['팀','참가자'],...(s.groups||[]).flatMap(g=>g.members.map(m=>[g.name,m]))]};
 if(id==='bracket')return {filename:'대진표',rows:[['라운드','경기','선수1','선수2','승자'],...(s.rounds||[]).flatMap((matches,r)=>matches.map((m,i)=>[r+1,i+1,m.a||'',m.b||'부전승',m.winner||'미정']))]};
 if(id==='timer')return {filename:'타이머',rows:[['설정 시간','남은 시간'],[fmtTime(s.duration||0),fmtTime(timerRemaining(s))]]};
 if(id==='treasure')return {filename:'보물찾기순위',rows:[['순위','참가자','점수','발견 수'],...(s.rankings||[]).map((x,i)=>[i+1,x.name,x.points,x.found])]};
 return {filename:name,rows:[]};
}
function exportCsv(id,event){
 const data=exportRows(id,event);if(data.rows.length<=1)throw Error('저장할 결과가 없습니다. 먼저 프로그램을 진행해 주세요.');
 const safe=v=>{let x=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
 const out='\ufeff'+data.rows.map(row=>row.map(safe).join(',')).join('\r\n');
 const blob=new Blob([out],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=url;anchor.download='소소킹_'+data.filename+'_'+new Date().toISOString().slice(0,10)+'.csv';anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
}

function programDetails(id){
 const p=seoById[id];if(!p)return '';
 return '<section class="program-details" aria-label="'+h(p.title)+' 안내">'
 +'<div class="program-details-intro"><span class="eyebrow">ABOUT THIS TOOL</span><h2>'+h(p.title)+'</h2><p>'+h(p.intro)+'</p></div>'
 +'<div class="program-details-columns"><div><h3>이럴 때 활용하세요</h3><ul>'+p.use.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul></div>'
 +'<div><h3>주요 기능</h3><ul>'+p.facts.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul></div></div>'
 +'<h3 class="program-faq-title">자주 묻는 질문</h3><div class="program-faq">'+p.faq.map(([q,a])=>'<details><summary>'+h(q)+'</summary><p>'+h(a)+'</p></details>').join('')+'</div>'
 +'<p class="program-details-last"><a href="/#/tools">다른 프로그램 둘러보기 →</a></p></section>';
}

function programPage(event,id,local=false){
 const m=byId[id];
 if(!m||(!local&&!event.modules.includes(id)))return shellNotice('이 프로그램은 사용할 수 없습니다.','행사 관리실에서 해당 프로그램을 추가해 주세요.',local?'#/tools':'#/manage/'+event.id);
 const back=local?' /#/tools'.trim():'/#/manage/'+event.id;
 const running=local||event.active===id;
 return '<div class="shell single-program-page">'
 +'<div class="single-program-back"><a class="back-link" href="'+back+'">'+icon('back',17)+' '+(local?'프로그램 목록':'행사 관리실')+'로 돌아가기</a><span class="single-program-mode">'+(local?'혼자 바로 사용':'행사 연결됨 · 참가자 '+event.peopleCount+'명')+'</span></div>'
 +'<div class="single-program-title"><div class="single-program-symbol tone-'+m.tone+'"><span class="program-symbol">'+m.symbol+'</span></div><div><span class="eyebrow">'+(local?'JUST PLAY · NO EVENT NEEDED':'LIVE EVENT PROGRAM')+'</span><h1>'+h(m.name)+'</h1><p>'+h(m.desc)+'</p></div><div class="single-program-buttons">'+button(icon('external',16)+' 전체 화면','fullscreen','btn subtle')+(!local?button(icon('external',16)+' 발표 화면','open-screen','btn subtle'):'')+'</div></div>'
 +(local?'<div class="local-banner">'+icon('spark',19)+' <span>행사 없이 이 페이지에서 바로 플레이하세요. 설정과 결과는 이 브라우저에만 저장됩니다.</span></div>':
 '<div class="single-program-event"><div><span class="pulse"></span> <b>'+h(event.title)+'</b><small>'+(running?'현재 참가자 화면에도 이 프로그램이 표시됩니다.':'다른 프로그램이 현재 참가자에게 표시되고 있습니다.')+'</small></div>'
 +(running?badge('진행 중','success'):button('참가자 화면에 표시하기','activate','btn primary','data-id="'+id+'"'))+'</div>')
 +(local?localDemoBanner(id):'')
 +programGuide(id)
 +'<div class="single-program-content">'+renderModule(event,id,true,local)+'</div>'
 +'<div class="program-export-bar"><span>진행 결과를 보관하거나 다른 사람에게 공유하세요.</span><div>'+button(icon('download',16)+' 결과 CSV 저장','export-csv','btn subtle')+button('인쇄하기','print-result','btn subtle')+'</div></div>'
 +programDetails(id)
 +'<div class="single-program-footer"><a href="'+back+'">'+icon('back',16)+' '+(local?'다른 프로그램 선택하기':'행사 관리실로 돌아가기')+'</a><span>소소킹 LIVE · '+h(m.name)+' 전용 페이지</span></div></div>';
}
function sharePanel(event){
 const modeName=event.mode==='online'?'온라인 모임':event.mode==='onsite'?'현장 행사':'현장 + 온라인';
 return '<div class="share-panel"><div class="share-left"><span class="eyebrow">SHARE YOUR EVENT · '+h(modeName)+'</span><h2>온라인은 링크로,<br>현장은 QR코드로.</h2><p>화상회의 채팅방에 링크를 공유하세요. 현장에서는 QR코드를 스캔하면 돼요.<br>참가자는 앱 설치 없이 닉네임만 입력하고 들어옵니다.</p>'
 +'<div class="event-url-bar"><span>'+h(urlFor(event.id))+'</span>'+button(icon('copy',15)+' 복사','copy-link','btn white')+'</div>'
 +'<div class="share-actions">'+button(icon('link',16)+' 초대 링크 공유','share-link','btn white')+button(icon('download',16)+' QR 저장','qr-download','btn white-outline')+button(icon('external',16)+' 참가자 화면','open-join','btn white-outline')+button(icon('external',16)+' 발표 화면 열기','open-screen','btn white-outline')+'</div></div>'
 +'<div class="qr-frame"><canvas id="event-qr" width="180" height="180" aria-label="행사 참가 QR코드"></canvas><small>현장에서 스캔하고 입장!</small></div></div>';
}
function editModules(event){
 return '<details class="modules-manager"><summary>행사 프로그램 관리 · 선택한 '+event.modules.length+'개 <span>추가·제외 가능 ▼</span></summary><form data-form="event-modules"><p>행사 중에도 원하는 프로그램을 추가하거나 제외할 수 있어요. 진행 기록은 그대로 남습니다.</p><div class="manage-picks">'
 +defs.map(m=>'<label><input type="checkbox" name="modules" value="'+m.id+'" '+(event.modules.includes(m.id)?'checked':'')+'><span>'+h(m.name)+'</span></label>').join('')
 +'</div><button class="btn primary" type="submit">프로그램 구성 저장</button></form></details>';
}
function screenPanel(event){
 const module=byId[event.active];
 return '<div class="shell screen-page"><div class="screen-head"><div class="screen-event"><img src="/brand-mark.svg" alt="" width="42" height="42"><div><span>소소킹 LIVE · 온라인/현장 공유 화면</span><h1>'+h(event.title)+'</h1></div></div><div class="screen-tools"><span>'+icon('users',18)+' '+event.peopleCount+'명 참여</span>'+button('전체 화면','fullscreen','btn subtle')+'</div></div>'
 +(module?'<div class="screen-active"><span class="pulse"></span> LIVE · '+h(module.name)+'</div>'+renderModule(event,module.id,false,false,true):'<div class="screen-wait"><div>✦</div><h2>함께하는 순간을 준비 중입니다</h2><p>진행자가 프로그램을 시작하면 화면이 바뀝니다.</p></div>')
 +'<div class="screen-bottom">진행자는 별도 관리 화면에서 조작합니다. 이 화면을 화상회의에서 화면 공유하거나 행사장 스크린에 띄우세요.</div></div>';
}
function participantPanel(event){
 const person=saved.members[event.id];
 if(!person)return joinForm(event);
 const active=event.active?byId[event.active]:null;
 return '<div class="shell participate-page"><div class="participant-top">'+badge('행사 참가 중','live-badge')+'<h1>'+h(event.title)+'</h1><p><b>'+h(person.name)+'</b>님, 환영해요! · 참가자 '+event.peopleCount+'명</p></div>'
 +(active?'<div class="now-running"><span class="pulse"></span> 지금 진행 중 · '+h(active.name)+'</div>'+renderModule(event,active.id,false,false):'<div class="wait-panel"><div class="wait-icon">'+icon('spark',36)+'</div><h2>행사가 시작되길 기다리고 있어요.</h2><p>진행자가 프로그램을 시작하면 이 화면에 자동으로 나타납니다.</p><div class="wait-dots"><i></i><i></i><i></i></div></div>')
 +'<div class="participant-note">'+icon('check',16)+' 별도 앱 설치 없이 이 화면에서 계속 참여할 수 있어요.</div></div>';
}
function joinForm(event){
 return '<div class="shell join-page"><div class="join-box"><div class="join-emblem">'+icon('users',32)+'</div>'+badge('QR 행사 초대장')+'<h1>'+h(event.title)+'</h1><p>환영합니다! 닉네임을 입력하고 행사에 입장하세요.</p><div class="join-count">'+icon('users',18)+' 현재 '+event.peopleCount+'명 입장</div>'
 +(event.status==='open'?'<form data-form="join"><label class="input-label">참가자 닉네임</label><input class="text-input large" type="text" name="name" minlength="2" maxlength="24" placeholder="예: 행복이" autocomplete="nickname" required><button class="btn primary big full" type="submit">행사에 입장하기 '+icon('arrow',18)+'</button></form>':'<div class="closed-note">진행자가 입장을 마감했습니다.</div>')
 +'<small>입장한 이름은 진행자와 추첨 결과에 표시될 수 있습니다.</small></div></div>';
}
function drawQr(){
 const canvas=document.querySelector('#event-qr');
 if(!canvas||!activeEvent?.id)return;
 QRCode.toCanvas(canvas,urlFor(activeEvent.id),{width:176,margin:1,color:{dark:'#172044',light:'#ffffff'}}).catch(()=>{});
}
function moduleBox(kicker,title,description,body){
 return '<section class="module-workspace"><div class="module-header"><span class="eyebrow">'+h(kicker)+'</span><h2>'+h(title)+'</h2><p>'+h(description)+'</p></div>'+body+'</section>';
}
function inlineNames(placeholder='한 줄에 하나씩 입력',val=''){
 return '<textarea class="text-area" name="names" rows="5" placeholder="'+h(placeholder)+'" required>'+h(val)+'</textarea>';
}
function renderModule(ev,id,host,local=false,screen=false){
 const s=ev.state?.[id]||initial()[id],people=ev.people||[];
 switch(id){
 case 'raffle':{
 const winners=s.winners||[],last=s.lastBatch?.length?s.lastBatch:s.last?[s.last]:[],remaining=Math.max(0,(local?people.length:ev.peopleCount)-winners.length);
 return moduleBox('LUCKY DRAW','오늘의 행운은 누구에게?','모든 참가자에게 동등한 기회를 주는 무작위 추첨입니다.',
 '<div class="raffle-overview"><div><strong>'+ (local?people.length:ev.peopleCount) +'</strong><span>전체 참가자</span></div><div><strong>'+winners.length+'</strong><span>누적 당첨</span></div><div><strong>'+remaining+'</strong><span>남은 인원</span></div></div>'
 +'<div class="draw-area"><div class="draw-display '+(last.length?'has-winner':'')+'">'+(last.length?'<span class="draw-star">✦</span><small>CONGRATULATIONS!</small><div class="winner-spotlight">'+last.map(w=>'<strong>'+h(w.name)+'</strong>').join('')+'</div><span>축하합니다! 이번 추첨 당첨자 '+last.length+'명</span>':'<div class="draw-await"><span>✦</span><b>행운의 주인공을 기다립니다</b><small>참가자 명단을 준비하고 추첨을 시작해 보세요.</small></div>')+'</div>'
 +(host?(local?'<form data-form="local-people"><label class="input-label">추첨 대상 이름 (한 줄에 하나씩)</label>'+inlineNames('김하나\n이둘\n박세나',people.map(p=>p.name).join('\n'))+'<button class="btn subtle" type="submit">명단 적용하기</button></form>':'<p class="participant-hint">행사 QR·초대 링크로 입장한 참가자가 추첨 대상에 자동 포함됩니다.</p>')
 +'<div class="raffle-settings"><label class="input-label" for="raffle-count">한 번에 추첨할 인원</label><select id="raffle-count" class="text-input" aria-label="한 번에 추첨할 인원">'+[1,2,3,5,10].map(n=>'<option value="'+n+'">'+n+'명'+(n>remaining?' (잔여 인원 부족)':'')+'</option>').join('')+'</select></div>'
 +'<div class="module-actions">'+button('✦ 당첨자 추첨하기','raffle-draw','btn primary big',remaining<1?'disabled':'')+button('당첨 기록 초기화','raffle-reset','btn subtle')+'</div>':'<p class="participant-hint">진행자가 추첨하면 이곳에서 당첨자를 확인할 수 있어요.</p>')
 +'</div><div class="history-panel"><h3>당첨 기록 <span>'+winners.length+'명</span></h3>'+(winners.length?'<div class="winner-list">'+winners.map((w,i)=>'<div><span>'+String(i+1).padStart(2,'0')+'</span><b>'+h(w.name)+'</b><small>당첨</small></div>').join('')+'</div>':'<p class="empty-message">아직 당첨자가 없습니다.</p>')+'</div>');
 }
 case 'poll':{
 const options=s.options||[],ready=!!s.id,open=s.open;
 const voted=saved.members[ev.id]?.voted?.includes(s.id);
 const total=(s.counts||[]).reduce((a,b)=>a+b,0);
 return moduleBox('LIVE VOTING','모두의 의견을 한눈에','참가자는 QR 또는 초대 링크로 입장한 뒤 한 번씩 투표할 수 있습니다.',
 (host?'<div class="tool-form-block"><form data-form="poll"><label class="input-label">투표 질문</label><input class="text-input" name="question" maxlength="110" value="'+h(s.question)+'" placeholder="예: 오늘 가장 재미있었던 순서는?" required><label class="input-label">선택지 (한 줄에 하나씩 · 2~6개)</label><textarea class="text-area" rows="4" name="options" required placeholder="추첨\n게임\n공연">'+h(options.join('\n'))+'</textarea><button class="btn subtle" type="submit">투표 내용 저장 · 득표 초기화</button></form></div>'
 +(ready?'<div class="module-actions">'+button(open?'투표 마감하기':'투표 시작하기',open?'poll-close':'poll-open',open?'btn subtle':'btn primary')+'</div>':''):'')
  +(ready?'<div class="poll-board"><h3>'+h(s.question)+'</h3>'+(local?'<div class="local-poll-votes"><p>개별 실행 모드 · 아래 항목을 누르면 해당 득표수가 올라갑니다.</p>'+options.map((x,i)=>button('+1표 · '+h(x),'local-vote','btn subtle','data-index="'+i+'"')).join('')+'</div>':'')+(!host&&!screen&&open&&!voted?'<div class="poll-answers">'+options.map((x,i)=>button(h(x),'vote','btn vote-option','data-index="'+i+'"')).join('')+'</div>':!host&&!screen&&open&&voted?'<div class="success-message">'+icon('check',20)+' 투표를 완료했어요. 발표를 기다려 주세요.</div>':!host&&open?'<div class="module-info">투표가 진행 중입니다.</div>':'')
 +((host||!open)?'<div class="poll-results">'+options.map((x,i)=>{const n=s.counts[i]||0,pct=total?Math.round(100*n/total):0;return '<div class="poll-row"><div><b>'+h(x)+'</b><span>'+n+'표 · '+pct+'%</span></div><div class="bar-track"><span style="width:'+pct+'%"></span></div></div>'}).join('')+'</div><small class="muted">총 '+(host?s.answered||0:total)+'명 참여</small>':'')
 +'</div>':'<div class="empty-message padded">진행자가 투표를 준비하고 있습니다.</div>'));
 }
 case 'wheel':{
 const items=s.items||[],n=Math.max(items.length,1),colors=['#6D80E8','#E5E9FF','#F1AF86','#FFE4C4','#78CDB7','#DCF6E9','#BDABF4','#F0E8FF','#A5CEEE','#DBE8FA'];
 const stop=s.last?Math.max(0,items.indexOf(s.last.name)):-1,stopAngle=stop<0?0:-(stop+.5)*360/n;
 const segments=items.map((x,i)=>colors[i%colors.length]+' '+(i*360/n)+'deg '+((i+1)*360/n)+'deg').join(',');
 const labels=items.length<=12?items.map((x,i)=>'<span class="wheel-slice-label" style="--slice-angle:'+((i+.5)*360/n)+'deg">'+h(x.slice(0,8))+'</span>').join(''):'<span class="wheel-item-count">'+items.length+'개 항목</span>';
 return moduleBox('RANDOM WHEEL','돌림판, 어디에 멈출까?','룰렛에는 모든 항목이 같은 확률로 배정됩니다. 선정 결과는 기록에 남아요.',
 '<div class="wheel-layout"><div class="wheel-visual"><div class="wheel-pin"></div><div class="wheel-face" id="wheel-face" style="background:conic-gradient('+segments+');transform:rotate('+stopAngle+'deg)"><div class="wheel-label-layer">'+labels+'</div><span class="wheel-center">S</span></div></div><div class="wheel-controls">'
 +(s.last?'<div class="wheel-last"><span>마지막 당첨 결과</span><strong>'+h(s.last.name)+'</strong></div>':'<div class="wheel-last"><span>룰렛 항목</span><strong>'+items.length+'개</strong></div>')
 +(host?'<form data-form="wheel"><label class="input-label">룰렛 항목 (한 줄에 하나씩)</label>'+inlineNames('1등\n2등\n3등',items.join('\n'))+'<button class="btn subtle" type="submit">항목 적용</button></form>'+button('돌림판 회전하기','wheel-spin','btn primary big full'):('<p class="participant-hint">진행자가 돌림판을 돌리면 결과가 여기에 표시됩니다.</p>'))+'</div></div>'
 +(s.history?.length?'<div class="history-panel"><h3>추첨 기록 · '+s.history.length+'회</h3><div class="wheel-history">'+s.history.slice(-12).reverse().map((x,i)=>'<span>'+h(x.name)+'</span>').join('')+'</div></div>':''));
 }
 case 'score':{
 const rows=s.rows||[];
 return moduleBox('LIVE SCORE','우리가 만든 점수판','팀별 점수를 조정하면 전체 참가자 화면에도 반영됩니다.',
 (host?'<form data-form="score" class="compact-form"><label class="input-label">팀·선수 이름 (한 줄에 하나씩)</label>'+inlineNames('청팀\n홍팀',rows.map(x=>x.name).join('\n'))+'<button class="btn subtle" type="submit">점수판 만들기 · 점수 초기화</button></form>':'')
 +(rows.length?'<div class="score-board">'+[...rows].map(x=>({...x,index:rows.indexOf(x)})).sort((a,b)=>b.points-a.points).map((x,i)=>'<div class="score-entry"><div class="score-name"><small>'+String(i+1).padStart(2,'0')+'</small><strong>'+h(x.name)+'</strong></div><strong class="score-number">'+x.points+'</strong>'+(host?'<div class="score-controls">'+button('−5','score-minus5','btn score-button','data-index="'+x.index+'" aria-label="'+h(x.name)+' 5점 감소"')+button('−1','score-minus','btn score-button','data-index="'+x.index+'" aria-label="'+h(x.name)+' 1점 감소"')+button('+1','score-plus','btn score-button add','data-index="'+x.index+'" aria-label="'+h(x.name)+' 1점 추가"')+button('+5','score-plus5','btn score-button add','data-index="'+x.index+'" aria-label="'+h(x.name)+' 5점 추가"')+'</div>':'')+'</div>').join('')+'</div>':'<div class="empty-message padded">아직 점수판이 준비되지 않았어요.</div>'));
 }
 case 'teams':{
 const groups=s.groups||[];
 return moduleBox('TEAM MAKER','우리 팀은 누구와?','입장 참가자 또는 직접 입력한 명단을 자동으로 균등 분배합니다.',
 (host?'<form data-form="teams" class="compact-form"><label class="input-label">참가자 이름 (비우면 행사 입장자 사용)</label><textarea name="names" class="text-area" rows="4" placeholder="직접 입력하면 해당 명단으로 팀을 나눕니다.">'+h(local?(people||[]).map(x=>x.name).join('\n'):'')+'</textarea><label class="input-label">팀 수</label><select class="text-input" name="count">'+[2,3,4,5,6,8,10].map(n=>'<option value="'+n+'">'+n+'팀</option>').join('')+'</select><button class="btn primary" type="submit">무작위 팀 편성하기</button></form>':'')
 +(groups.length?'<div class="teams-grid">'+groups.map((g,i)=>'<div class="team-box"><div class="team-box-title"><span>'+(i+1).toString().padStart(2,'0')+'</span><h3>'+h(g.name)+'</h3><small>'+g.members.length+'명</small></div><div class="team-members">'+g.members.map(n=>'<div>'+h(n)+'</div>').join('')+'</div></div>').join('')+'</div>':'<div class="empty-message padded">팀 편성을 시작하면 이곳에 결과가 표시됩니다.</div>'));
 }
 case 'timer':{
 const t=s,r=timerRemaining(t);
 return moduleBox('COUNTDOWN TIMER','행사의 순간을 정확하게','발표나 경기 제한 시간을 설정하고 모두의 화면에 동시에 표시합니다.',
 '<div class="timer-display"><span>TIME REMAINING</span><strong id="time-digits" data-start="'+(t.startedAt||0)+'" data-left="'+(t.remaining||0)+'" data-running="'+(!!t.running)+'">'+fmtTime(r)+'</strong><small>'+(t.running?'카운트다운 진행 중':'대기 / 일시정지')+'</small></div>'
 +(host?'<div class="timer-presets"><span>빠른 시간 설정</span>'+[30,60,180,300,600].map(secs=>button(secs<60?secs+'초':(secs/60)+'분','timer-preset','btn subtle','data-seconds="'+secs+'"')).join('')+'</div><form data-form="timer" class="timer-settings"><label class="input-label">시간 설정</label><div class="timer-setting-row"><input class="text-input" type="number" name="minutes" min="0" max="120" value="'+Math.floor(t.duration/60)+'" aria-label="분"><span>분</span><input class="text-input" type="number" name="seconds" min="0" max="59" value="'+(t.duration%60)+'" aria-label="초"><span>초</span><button class="btn subtle" type="submit">시간 적용</button></div></form><div class="module-actions">'+button(icon(t.running?'pause':'play',17)+(t.running?' 일시정지':' 시작'),t.running?'timer-pause':'timer-start','btn primary big')+button('처음부터','timer-reset','btn subtle')+'</div>':'<p class="participant-hint">진행자의 조작에 따라 시간이 표시됩니다.</p>'));
 }
 case 'treasure':return renderTreasure(ev,s,host,local,screen);
 case 'bracket':{
 const b=s,rounds=b.rounds||[];
 return moduleBox('TOURNAMENT','승부를 결정하는 대진표','참가팀을 무작위로 배정하고 결과를 입력하면 다음 라운드가 자동으로 만들어집니다.',
 (host?'<form data-form="bracket" class="compact-form"><label class="input-label">출전 팀·선수 이름 (2~32팀, 한 줄에 하나씩)</label>'+inlineNames('청팀\n홍팀\n백팀\n녹팀',b.names?.join('\n')||'')+'<button class="btn subtle" type="submit">대진표 새로 생성하기</button></form>':'')
 +(rounds.length?'<div class="bracket-scroll"><div class="bracket-rounds">'+rounds.map((matches,r)=>'<div class="bracket-round"><h3>'+(matches.length===1?'결승전':(r+1)+'라운드')+'</h3>'+matches.map((m,idx)=>'<div class="bracket-match"><div class="match-head">경기 '+(idx+1)+(m.winner?' · 확정':'')+'</div>'+[m.a,m.b].filter(Boolean).map(name=>'<div class="bracket-person '+(m.winner===name?'won':'')+'"><span>'+h(name)+'</span>'+(m.winner===name?'<b>승</b>':host&&m.b&&!m.winner?button('승리','bracket-win','btn win-button','data-round="'+r+'" data-match="'+idx+'" data-winner="'+h(name)+'"'):'')+'</div>').join('')+'</div>').join('')+'</div>').join('')+'</div></div>'+(b.finished?'<div class="champion">✦ 최종 우승 <strong>'+h(rounds.at(-1)?.[0]?.winner||'')+'</strong></div>':''):'<div class="empty-message padded">참가팀을 입력하고 대진표를 생성해 주세요.</div>'));
 }
 default:return '';
 }
}
function treasureRemaining(s){return Math.max(0,Math.ceil(((s.endsAt||0)-Date.now())/1000));}
function treasureStatus(s){return s.status==='playing'&&treasureRemaining(s)===0?'finished':s.status;}
function renderTreasure(ev,s,host,local=false,screen=false){
 const state=treasureStatus(s),board=s.board||[],rankings=s.rankings||[];
 const roundKey=ev.id+'-'+(s.round||0);
 if(treasureRoundKey!==roundKey){treasureRoundKey=roundKey;visitedTreasureSpots.clear();selectedTreasureSpot='';}
 const member=local?{found:s.solved||[],attempts:s.attempts||{}}:ev.memberTreasure||{found:[],attempts:{}};
 const ownFound=member.found||[],foundIds=new Set(ownFound);
 const selected=board.find(x=>x.id===selectedTreasureSpot)||null;
 const count=board.filter(x=>x.kind==='treasure').length;
 const top=rankings[0];
 const player=!screen&&(!host||local);
 const canSolve=player&&state==='playing'&&treasureRemaining(s)>0;
 const controls=host?'<div class="treasure-control"><label for="treasure-duration" class="input-label">게임 제한 시간</label><select class="text-input" id="treasure-duration">'+[[180,'3분'],[300,'5분'],[600,'10분'],[900,'15분']].map(([v,t])=>'<option value="'+v+'" '+((s.duration||300)===v?'selected':'')+'>'+t+'</option>').join('')+'</select>'+button(state==='playing'?'새 보물섬으로 다시 시작':'보물찾기 시작','treasure-start','btn primary')+(state==='playing'?button('대회 종료','treasure-stop','btn subtle'):'')+'</div>':'';
 const banner=state==='waiting'?'<div class="treasure-banner">탐험 준비 중! '+(host?'제한 시간을 선택하고 시작해 보세요.':'진행자가 보물섬을 열면 참가할 수 있어요.')+'</div>':state==='finished'?'<div class="treasure-banner treasure-ended">탐험이 종료되었습니다.'+(top?' 우승: '+h(top.name)+' ('+top.points+'점)':'')+'</div>':'<div class="treasure-banner">보물 6개가 숨어 있어요. 지도를 탐험하고 암호를 풀어보세요!</div>';
 const tiles=board.map((spot,i)=>{
   const solved=foundIds.has(spot.id),first=(s.firsts||[]).find(x=>x.id===spot.id);
   const explored=visitedTreasureSpots.has(spot.id)||solved;
   const klass='treasure-tile '+(solved?'is-solved ':'')+(selected?.id===spot.id?'is-selected ':'');
   const inner='<span class="treasure-tile-no">'+String(i+1).padStart(2,'0')+'</span><span class="treasure-tile-icon">'+(solved?'🏆':explored?h(spot.icon):'❔')+'</span><b>'+(explored?h(spot.title):'미지의 장소')+'</b><small>'+(solved?'발견 완료':explored?'탐험한 장소':'눌러서 탐험')+'</small>'+(first?'<span class="treasure-first">'+icon('spark',13)+' 첫 발견</span>':'');
   return screen?'<div class="'+klass+'">'+inner+'</div>':'<button type="button" class="'+klass+'" data-do="treasure-explore" data-spot-id="'+h(spot.id)+'" aria-pressed="'+(selected?.id===spot.id)+'">'+inner+'</button>';
 }).join('');
 let selectedHtml='';
 if(!screen&&selected&&state!=='waiting'){
  const solved=foundIds.has(selected.id),tries=member.attempts?.[selected.id]||0;
  selectedHtml='<aside class="treasure-selected" id="treasure-selected"><div class="treasure-selected-top"><span>'+h(selected.icon)+'</span><div><small>선택한 탐험 장소</small><h3>'+h(selected.title)+'</h3></div></div><p>'+h(selected.clue)+'</p>'
  +(selected.kind==='scenery'?'<div class="treasure-empty">이곳은 빈 장소입니다. 다른 곳을 찾아보세요.</div>':
   '<div class="treasure-question"><b>보물 암호 문제 · '+selected.points+'점</b><p>'+h(selected.question)+'</p><details><summary>힌트 보기</summary><p>'+h(selected.hint)+'</p></details></div>'
   +(solved?'<p class="treasure-success">이미 발견한 보물입니다!</p>':
     canSolve&&tries<5?'<form data-form="treasure-answer"><input type="hidden" name="spot" value="'+h(selected.id)+'"><label for="treasure-answer-field" class="input-label">보물상자 암호 입력 · 남은 기회 '+(5-tries)+'회</label><div class="treasure-answer-row"><input id="treasure-answer-field" class="text-input" type="text" name="answer" maxlength="60" placeholder="정답을 입력하세요" autocomplete="off" required><button class="btn primary" type="submit">상자 열기</button></div></form>':tries>=5?'<p class="treasure-empty">이 보물의 도전 기회를 모두 사용했습니다.</p>':'<p class="participant-hint">지금은 암호를 입력할 수 없습니다.</p>'))
  +'</aside>';
 }
 const boardHtml=board.length?'<div class="treasure-grid">'+tiles+'</div>':'<div class="treasure-not-started"><span>🗺️</span><h3>아직 지도가 열리지 않았습니다</h3><p>게임을 시작하면 무작위로 섞인 12곳의 탐험 지도가 나타납니다.</p></div>';
 const list=rankings.length?rankings.map((x,i)=>'<div class="treasure-rank '+(x.id===saved.members[ev.id]?.id?'self':'')+'"><span>'+(i+1)+'위</span><b>'+h(x.name)+'</b><small>'+x.found+'개 발견</small><strong>'+x.points+'점</strong></div>').join(''):'<p class="empty-message">아직 보물을 발견한 참가자가 없습니다.</p>';
 const discovery=(s.firsts||[]).slice(-4).reverse().map(x=>'<div><span>✨</span><b>'+h(x.name)+'</b> 님이 첫 보물을 발견했어요!</div>').join('');
 return moduleBox('TREASURE HUNT','신비의 보물섬','지도 속 12곳을 탐험하세요. 그중 6곳에 보물이 숨겨져 있고, 암호를 풀면 점수를 획득합니다.',
 '<div class="treasure-stats"><div><small>탐험 제한시간</small><b id="treasure-clock" data-ends="'+(s.endsAt||0)+'" data-running="'+(state==='playing')+'">'+fmtTime(state==='waiting'?s.duration||300:treasureRemaining(s))+'</b></div><div><small>숨겨진 보물</small><b>'+count+'개</b></div><div><small>탐험 라운드</small><b>'+(s.round||'-')+'</b></div>'+(player?'<div><small>내가 찾은 보물</small><b>'+ownFound.length+'개</b></div>':'')+'</div>'
 +controls+banner
 +'<div class="treasure-layout"><div><div class="treasure-map-heading"><h3>탐험 지도</h3><small>장소를 눌러 단서를 확인하세요</small></div>'+boardHtml+selectedHtml+'</div>'
 +'<aside class="treasure-leaderboard"><h3>🏆 실시간 탐험 랭킹</h3>'+list+(discovery?'<div class="treasure-news">'+discovery+'</div>':'')+'<p>동점이면 해당 점수에 먼저 도달한 참가자가 앞에 표시됩니다.</p></aside></div>'
 +'<p class="treasure-rules">온라인 참가자는 닉네임으로 입장하며 발견 점수는 서버에 저장됩니다. 각 보물은 참가자별 1회만 획득할 수 있고, 첫 발견자에게 15점이 추가됩니다. 지도는 라운드마다 새로 섞입니다.</p>');
}

function timerRemaining(t){return t.running?Math.max(0,Math.ceil((t.remaining*1000-(Date.now()-t.startedAt))/1000)):t.remaining;}
function renderEvent(){
 const mode=getMode();
 if(!activeEvent)return;
 root.innerHTML=mode==='participant'?participantPanel(activeEvent):mode==='screen'?screenPanel(activeEvent):mode==='host'&&route()[2]==='tool'?programPage(activeEvent,route()[3],false):mode==='local'?programPage(activeEvent,route()[1],true):hostPanel(activeEvent);
 drawQr();updateClock();
 lastRenderKey=route().join('/')+'|'+String(activeEvent.revision||0)+'|'+JSON.stringify(activeEvent.memberTreasure||{});
 const currentTool=getMode()==='host'&&route()[2]==='tool'?byId[route()[3]]:getMode()==='local'?byId[route()[1]]:null;
 if(!location.pathname.startsWith('/programs/'))document.title=(currentTool?currentTool.name+' · '+(getMode()==='local'?'바로 사용':activeEvent.title):getMode()==='host'?activeEvent.title:'소소킹 LIVE')+' | 소소킹 LIVE';
}
function updateClock(){
 const treasure=document.querySelector('#treasure-clock');
 if(treasure&&treasure.dataset.running==='true')treasure.textContent=fmtTime(Math.max(0,Math.ceil((Number(treasure.dataset.ends)-Date.now())/1000)));
 const el=document.querySelector('#time-digits');
 if(!el)return;
 const t={running:el.dataset.running==='true',remaining:Number(el.dataset.left),startedAt:Number(el.dataset.start)};
 const rem=timerRemaining(t);
 el.textContent=fmtTime(rem);
 document.querySelector('.timer-display')?.classList.toggle('is-finished',rem===0);
}
function singleTool(id){
 if(!byId[id])return shellNotice('프로그램을 찾지 못했습니다.','다른 프로그램을 선택해 주세요.','#/tools');
 if(!saved.standalone[id]){saved.standalone[id]=localEvent(id);save()}
 activeEvent=saved.standalone[id];activeId=activeEvent.id;activeView='tool';
 if(!location.pathname.startsWith('/programs/'))document.title=byId[id].name+' | 소소킹 LIVE';
 return programPage(activeEvent,id,true);
}
async function loadRoute(){
 const [type,id]=route(),current=type||'home';
 navUpdate();
 if(!location.pathname.startsWith('/programs/'))document.title=current==='home'?'소소킹 LIVE | 무료 룰렛·랜덤 추첨기·대진표·팀 나누기':'소소킹 LIVE — 모임과 프로그램';
 document.body.classList.toggle('dedicated-program',current==='tool'||(current==='manage'&&route()[2]==='tool'));
 window.scrollTo({top:0,behavior:'instant'});
 if(current==='home'){root.innerHTML=home();}
 else if(current==='tools'){root.innerHTML=tools();}
 else if(current==='install'){root.innerHTML=install();}
 else if(current==='create'){root.innerHTML=create();}
 else if(current==='events'){root.innerHTML=events();}
 else if(current==='tool'){root.innerHTML=singleTool(id);}
 else if(['manage','join','screen'].includes(current)){
  root.innerHTML='<div class="shell loading-state"><span class="loading-spin"></span> 행사 정보를 불러오고 있어요...</div>';
  if(current==='manage'&&!saved.hosts[id])root.innerHTML=shellNotice('진행자 권한이 없습니다.','행사를 만든 브라우저에서 관리할 수 있습니다.','#/events');
  else await loadEvent(id,current);
 }else root.innerHTML=shellNotice('페이지를 찾을 수 없습니다.','주소를 다시 확인해 주세요.');
}
async function sendAction(op,value){
 if(!activeEvent)return;
 if(getMode()==='local'){const result=localAction(op,value);save();renderEvent();return result;}
 const secret=getMode()==='host'?saved.hosts[activeEvent.id]:saved.members[activeEvent.id]?.token;
 const result=await api('action',{id:activeEvent.id,op,value},secret,null,getMode()==='participant'?saved.members[activeEvent.id]?.id:'');
 await loadEvent(activeEvent.id,activeView);
 return result;
}
function rand(n){if(!Number.isSafeInteger(n)||n<1)throw Error('뽑기 범위가 잘못되었습니다.');const a=new Uint32Array(1),max=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=max);return a[0]%n;}
function shuffled(a){const result=[...a];for(let i=result.length-1;i>0;i--){const j=rand(i+1);[result[i],result[j]]=[result[j],result[i]]}return result;}
function nextBracket(b){for(let i=0;i<8;i++){const last=b.rounds.at(-1);if(!last?.every(m=>m.winner))break;if(last.length===1){b.finished=true;break;}const next=[];for(let j=0;j<last.length;j+=2)next.push({a:last[j].winner,b:last[j+1].winner,winner:null});b.rounds.push(next);}return b;}
function generateBracket(names){
 let n=1;while(n<names.length)n*=2;
 const shuffledNames=shuffled(names);let cursor=0,matches=[],doubleCount=n/2-(n-names.length);
 for(let i=0;i<n/2;i++){const a=shuffledNames[cursor++],b=i<doubleCount?shuffledNames[cursor++]:null;matches.push({a,b,winner:b?null:a});}
 return nextBracket({names,rounds:[matches],finished:false});
}
function localTreasureBoard(){return shuffled([...shuffled(localRiddles).slice(0,6).map(({answers,...rest})=>({...rest,kind:'treasure'})),...localScenery.map(x=>({...x,points:0,kind:'scenery'}))]);}
function localAction(op,val){
 const e=activeEvent,s=e.state,people=e.people||[];
 switch(op){
 case 'treasure.start':{
   const duration=Number(val?.duration||300);
   if(!Number.isInteger(duration)||duration<60||duration>1800)throw Error('제한시간은 1~30분으로 설정하세요.');
   const now=Date.now();
   e.state.treasure={status:'playing',round:(s.treasure?.round||0)+1,board:localTreasureBoard(),rankings:[],firsts:[],duration,startedAt:now,endsAt:now+duration*1000,solved:[],attempts:{}};
   selectedTreasureSpot='';break;
 }
 case 'treasure.stop':{
   s.treasure.status='finished';s.treasure.endsAt=Date.now();break;
 }
 case 'treasure.solve':{
   const t=s.treasure,spot=t.board.find(x=>x.id===val.id&&x.kind==='treasure');
   if(t.status!=='playing'||Date.now()>=t.endsAt)throw Error('보물찾기 시간이 종료되었습니다.');
   if(!spot)throw Error('보물 위치를 선택하세요.');
   if(t.solved.includes(spot.id))throw Error('이미 발견한 보물입니다.');
   const attempts=t.attempts||{};
   if((attempts[spot.id]||0)>=5)throw Error('이 보물의 기회를 모두 사용했습니다.');
   attempts[spot.id]=(attempts[spot.id]||0)+1;t.attempts=attempts;
   const secret=localRiddles.find(x=>x.id===spot.id);
   const correct=secret.answers.some(x=>cleanTreasureAnswer(x)===cleanTreasureAnswer(val.answer));
   if(!correct)return {correct:false,left:5-attempts[spot.id]};
   const points=spot.points+15;
   t.solved.push(spot.id);
   t.firsts.push({id:spot.id,name:'나',at:Date.now()});
   t.rankings=[{id:'local',name:'나',points:(t.rankings[0]?.points||0)+points,found:t.solved.length,at:Date.now()}];
   return {correct:true,points,first:true};
 }
 case 'event.active':e.active=val;break;
 case 'event.status':e.status=val;break;
 case 'local.people':e.people=[...new Set(val)].map((name,i)=>({id:String(i),name}));e.peopleCount=e.people.length;s.raffle={winners:[],last:null,lastBatch:[]};break;
 case 'raffle.draw':{
   const seen=new Set(s.raffle.winners.map(w=>w.id)),eligible=people.filter(p=>!seen.has(p.id));
   const count=Number(val===null||val===undefined?1:val);
   if(!Number.isInteger(count)||count<1||count>10)throw Error('한 번에 1~10명만 추첨할 수 있습니다.');
   if(eligible.length<count)throw Error('남은 대상자가 '+eligible.length+'명뿐입니다.');
   const picked=[];
   for(let i=0;i<count;i++){const index=rand(eligible.length),p=eligible.splice(index,1)[0];picked.push({...p,at:Date.now()});}
   s.raffle.winners.push(...picked);s.raffle.last=picked[picked.length-1];s.raffle.lastBatch=picked;break;
 }
 case 'raffle.reset':s.raffle={winners:[],last:null,lastBatch:[]};break;
 case 'poll.set':s.poll={id:String(Date.now()),question:val.question,options:val.options,counts:val.options.map(()=>0),open:false,answered:0};break;
 case 'poll.open':s.poll.open=true;break;
 case 'poll.close':s.poll.open=false;break;
 case 'poll.vote':if(!s.poll.open||!Number.isInteger(val)||val<0||val>=s.poll.counts.length)throw Error('투표할 수 없는 선택지입니다.');s.poll.counts[val]++;s.poll.answered++;break;
 case 'wheel.set':s.wheel={items:val,last:null,history:[]};break;
 case 'wheel.spin':{
   const w={name:s.wheel.items[rand(s.wheel.items.length)],at:Date.now()};s.wheel.last=w;s.wheel.history.push(w);break;
 }
 case 'score.set':s.score.rows=val.map(name=>({name,points:0}));break;
 case 'score.add':s.score.rows[val.index].points=Math.max(0,s.score.rows[val.index].points+val.delta);break;
 case 'teams.make':{
   const names=val.names.length?val.names:people.map(p=>p.name),count=val.groupCount;
   if(names.length<count)throw Error('참가자가 팀 수보다 적습니다.');
   const groups=Array.from({length:count},(_,i)=>({name:(i+1)+'팀',members:[]}));
   shuffled(names).forEach((x,i)=>groups[i%count].members.push(x));s.teams.groups=groups;break;
 }
 case 'timer.set':s.timer={duration:val,remaining:val,running:false,startedAt:0};break;
 case 'timer.start':{const remain=timerRemaining(s.timer);if(remain<=0)throw Error('타이머를 초기화한 뒤 다시 시작하세요.');s.timer={...s.timer,remaining:remain,running:true,startedAt:Date.now()};break;}
 case 'timer.pause':s.timer={...s.timer,remaining:timerRemaining(s.timer),running:false,startedAt:0};break;
 case 'timer.reset':s.timer={duration:s.timer.duration,remaining:s.timer.duration,running:false,startedAt:0};break;
 case 'bracket.set':s.bracket=generateBracket(val);break;
 case 'bracket.win':{
   const b=s.bracket,m=b.rounds[val.round]?.[val.match];if(!m||!m.a||!m.b||b.rounds[val.round+1]||![m.a,m.b].includes(val.winner))throw Error('이 경기는 수정할 수 없습니다.');
   m.winner=val.winner;nextBracket(b);break;
 }
 default:throw Error('지원하지 않는 기능입니다.');
 }
}
const nonEmptyLines=(text,max=100)=>[...new Set(String(text||'').split(/\r?\n/).map(s=>s.trim().slice(0,40)).filter(Boolean))].slice(0,max);
async function postSafe(fn){try{await fn()}catch(error){toast(error.message,true)}}
document.addEventListener('submit',ev=>{
 const form=ev.target.closest('[data-form]');if(!form)return;ev.preventDefault();
 const kind=form.dataset.form,data=new FormData(form);
 if(requesting||form.dataset.submitting==='true')return;
 form.dataset.submitting='true';
 const submitButton=form.querySelector('[type="submit"]');if(submitButton)submitButton.disabled=true;
 postSafe(async()=>{try{
  if(kind==='create'){
   const title=String(data.get('title')||'').trim(),modules=data.getAll('modules'),mode=String(data.get('mode')||'hybrid');
   if(!title||modules.length===0)throw Error('행사명과 프로그램을 선택해 주세요.');
   const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='행사방 생성 중...';
   try{
    const result=await api('create',{title,modules,mode});
    saved.hosts[result.id]=result.adminToken;
    saved.recent.unshift({id:result.id,title,date:Date.now()});save();
    toast('행사방을 만들었습니다.');
    location.hash='#/manage/'+result.id;
   }finally{button.disabled=false;button.textContent='행사방 만들기';}
  }else if(kind==='join'){
   const id=activeEvent.id,name=String(data.get('name')||'').trim();
   const result=await api('join',{id,name});
   saved.members[id]={token:result.personToken,id:result.personId,name,voted:[]};save();toast('행사에 입장했습니다.');
   await loadEvent(id,'join');
  }else if(kind==='local-people'){await sendAction('local.people',nonEmptyLines(data.get('names'),200));toast('참가자 명단을 적용했습니다.');}
  else if(kind==='poll'){
   const options=nonEmptyLines(data.get('options'),6),question=String(data.get('question')||'').trim();
   if(options.length<2)throw Error('선택지는 2개 이상 입력해야 합니다.');
   if(!confirm('새 투표를 저장하면 이전 투표의 득표가 초기화됩니다. 계속할까요?'))return;
   await sendAction('poll.set',{question,options});toast('투표 설정을 저장했습니다.');
  }else if(kind==='wheel'){
   const names=nonEmptyLines(data.get('names'),60);if(names.length<2)throw Error('항목이 2개 이상 필요합니다.');
   await sendAction('wheel.set',names);toast('룰렛 항목을 적용했습니다.');
  }else if(kind==='score'){
   const names=nonEmptyLines(data.get('names'),24);if(names.length<2)throw Error('팀 또는 선수 이름이 2개 이상 필요합니다.');
   if(!confirm('점수판을 새로 만들면 이전 점수가 초기화됩니다. 계속할까요?'))return;
   await sendAction('score.set',names);toast('점수판을 만들었습니다.');
  }else if(kind==='teams'){
   const names=nonEmptyLines(data.get('names'),200),groupCount=Number(data.get('count'));
   await sendAction('teams.make',{names,groupCount});toast('팀을 편성했습니다.');
  }else if(kind==='timer'){
   const total=Number(data.get('minutes'))*60+Number(data.get('seconds'));
   if(!(total>=5&&total<=7200))throw Error('5초에서 120분 사이로 설정하세요.');
   await sendAction('timer.set',total);toast('시간을 설정했습니다.');
  }else if(kind==='event-modules'){
   const modules=data.getAll('modules');
   if(!modules.length)throw Error('하나 이상의 프로그램을 선택해 주세요.');
   await sendAction('event.modules',modules);toast('프로그램 구성을 저장했습니다.');
  }else if(kind==='treasure-answer'){
   const spot=String(data.get('spot')||''),answer=String(data.get('answer')||'').trim();
   if(!answer)throw Error('암호를 입력해 주세요.');
   const result=await sendAction('treasure.solve',{id:spot,answer});
   if(result?.correct){selectedTreasureSpot='';renderEvent();toast('보물 발견! +'+result.points+'점'+(result.first?' · 첫 발견 보너스 포함':''));}
   else if(result?.correct===false)toast('암호가 다릅니다. 남은 기회 '+result.left+'회',true);
  }else if(kind==='bracket'){
   const names=nonEmptyLines(data.get('names'),32);
   if(names.length<2)throw Error('2팀 이상 입력하세요.');
   if(!confirm('새 대진표를 만들면 이전 경기 결과가 초기화됩니다. 계속할까요?'))return;
   await sendAction('bracket.set',names);toast('대진표를 만들었습니다.');
  }
 }finally{form.dataset.submitting='false';if(submitButton)submitButton.disabled=false;}
 });
});
document.addEventListener('change',e=>{
 if(e.target.matches('#create-form input[name="modules"]')){
  window.picks=[...document.querySelectorAll('#create-form input[name="modules"]:checked')].map(x=>x.value);
  const count=document.querySelector('#selected-count');if(count)count.textContent=window.picks.length;
 }
});
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;toast('소소킹이 홈 화면에 추가되었습니다.');});
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-do]');if(!el||el.disabled)return;
 const act=el.dataset.do;
 postSafe(async()=>{
  if(act==='treasure-explore'){selectedTreasureSpot=el.dataset.spotId;visitedTreasureSpots.add(selectedTreasureSpot);renderEvent();document.querySelector('#treasure-selected')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
  else if(act==='treasure-start'){
   const duration=Number(document.querySelector('#treasure-duration')?.value||300);
   if(activeEvent?.state?.treasure?.status==='playing'&&!confirm('기존 점수와 탐험 기록을 초기화하고 새 게임을 시작할까요?'))return;
   await sendAction('treasure.start',{duration});selectedTreasureSpot='';renderEvent();toast('새 보물섬 탐험을 시작했습니다.');
  }
  else if(act==='treasure-stop'){if(confirm('보물찾기 대회를 종료할까요?')){await sendAction('treasure.stop');toast('대회를 종료했습니다.');}}
  else if(act==='install-app'){
   if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone){toast('이미 앱 화면으로 실행 중입니다.');return;}
   if(deferredInstallPrompt){const prompt=deferredInstallPrompt;deferredInstallPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted')toast('소소킹 설치를 요청했습니다.');}
   else if(routeMatch()==='install')toast('브라우저 메뉴에서 홈 화면에 추가를 선택해 주세요.');
   else location.hash='#/install';
  }
  else if(act==='export-csv'){exportCsv(getMode()==='local'?route()[1]:route()[3],activeEvent);toast('결과 파일을 저장했습니다.');}
  else if(act==='print-result'){window.print();}
  else if(act==='copy-link'){await navigator.clipboard.writeText(urlFor(activeEvent.id));toast('참여 링크를 복사했습니다.');}
  else if(act==='qr-download'){
   const canvas=document.querySelector('#event-qr');if(!canvas)throw Error('QR코드가 없습니다.');
   const a=document.createElement('a');a.download='sosoking-qr-'+activeEvent.id+'.png';a.href=canvas.toDataURL('image/png');a.click();
  }else if(act==='open-join'){window.open(urlFor(activeEvent.id),'_blank','noopener,noreferrer');}
  else if(act==='open-screen'){window.open(location.origin+'/#/screen/'+activeEvent.id,'_blank','noopener,noreferrer');}
  else if(act==='share-link'){
    const link=urlFor(activeEvent.id);
    if(navigator.share)await navigator.share({title:activeEvent.title,text:'소소킹 LIVE 모임에 참여해 주세요!',url:link});
    else {await navigator.clipboard.writeText(link);toast('온라인 모임 초대 링크를 복사했습니다.');}
  }
  else if(act==='fullscreen'){if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}
  else if(act==='demo-setup'){if(getMode()==='local'){loadLocalDemo(el.dataset.id);toast('샘플을 불러왔습니다. 바로 플레이해 보세요!');}}
  else if(act==='activate'){if(getMode()==='participant'||getMode()==='screen')return;await sendAction('event.active',el.dataset.id);toast('프로그램 화면을 전환했습니다.');}
  else if(act==='door'){await sendAction('event.status',activeEvent.status==='open'?'closed':'open');}
  else if(act==='raffle-draw'){const count=Number(document.querySelector('#raffle-count')?.value||1);await sendAction('raffle.draw',count);toast(count+'명 추첨이 완료됐습니다.');}
  else if(act==='raffle-reset'){if(confirm('기존 당첨 기록을 모두 초기화할까요?'))await sendAction('raffle.reset');}
  else if(act==='poll-open'){await sendAction('poll.open');}
  else if(act==='poll-close'){await sendAction('poll.close');}
  else if(act==='local-vote'){if(getMode()==='local')await sendAction('poll.vote',Number(el.dataset.index));}
  else if(act==='vote'){
   const index=Number(el.dataset.index),id=activeEvent.id;
   if(getMode()==='local'){await sendAction('poll.vote',index);return;}
   const member=saved.members[id];if(member?.voted?.includes(activeEvent.state.poll.id))return;
   await sendAction('poll.vote',index);
   member.voted=[...(member.voted||[]),activeEvent.state.poll.id];save();toast('투표를 완료했습니다.');
   renderEvent();
  }else if(act==='wheel-spin'){
    el.disabled=true;
    try{
      await sendAction('wheel.spin');
      const face=document.querySelector('#wheel-face'),state=activeEvent?.state?.wheel;
      const index=state?.items?.indexOf(state?.last?.name);
      if(face&&index>=0&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches!==true){
        const angle=-(index+.5)*360/state.items.length;
        face.animate([{transform:'rotate(0deg)'},{transform:'rotate('+(1800+angle)+'deg)'}],{duration:1600,easing:'cubic-bezier(.18,.75,.2,1)',fill:'none'});
      }
    }finally{el.disabled=false;}
  }
  else if(['score-plus','score-minus','score-plus5','score-minus5'].includes(act)){await sendAction('score.add',{index:Number(el.dataset.index),delta:({'score-plus':1,'score-minus':-1,'score-plus5':5,'score-minus5':-5})[act]});}
  else if(act==='timer-preset'){await sendAction('timer.set',Number(el.dataset.seconds));toast('타이머 시간을 설정했습니다.');}
  else if(act==='timer-start'){await sendAction('timer.start');}
  else if(act==='timer-pause'){await sendAction('timer.pause');}
  else if(act==='timer-reset'){await sendAction('timer.reset');}
  else if(act==='bracket-win'){await sendAction('bracket.win',{round:Number(el.dataset.round),match:Number(el.dataset.match),winner:el.dataset.winner});}
 });
});
window.addEventListener('hashchange',()=>{activeEvent=null;loadRoute();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['join','manage','screen'].includes(routeMatch()))loadEvent(route()[1],routeMatch(),true);});
setInterval(()=>{if(document.hidden)return;updateClock();},400);
setInterval(()=>{const kind=routeMatch();if(!document.hidden&&['manage','join','screen'].includes(kind))loadEvent(route()[1],kind,true);},6000);
window.addEventListener('storage',ev=>{if(ev.key===storageKey){saved={hosts:{},members:{},recent:[],standalone:{},...load()};if(routeMatch()==='tool')loadRoute();}});
loadRoute();
