const seed=(id,title,category,genre,year,emoji,tags,summary,people)=>({id,title,category,genre,year,emoji,tags,summary,people,period:String(year),moment:`${title}을(를) 처음 접했을 때의 장면과 당시 함께했던 사람들의 기억이 지금도 선명하게 남아 있습니다.`,culture:`${year}년대 ${category} 문화를 떠올리게 하는 대표적인 추억 항목입니다.`,sources:['공식 자료와 신뢰할 수 있는 기록을 순차 검수합니다.'],related:[],userMemories:['친구들과 이 이야기를 자주 나누던 기억이 납니다.']});

const memories=[
seed('family-arcade','가족오락관','방송','예능',1984,'🎤',['가족','주말','퀴즈'],'온 가족이 함께 보던 장수 오락 프로그램','허참 외'),
seed('hourglass','모래시계','방송','드라마',1995,'⌛',['드라마','귀가시계','시대극'],'거리까지 한산하게 만들었다는 국민 드라마','최민수·고현정·박상원'),
seed('first-love','첫사랑','방송','드라마',1996,'📺',['드라마','가족','청춘'],'높은 시청률로 기억되는 가족 드라마','최수종·배용준·이승연'),
seed('infinite-challenge','무한도전','방송','예능',2005,'♾️',['도전','토요일','밈'],'매주 새로운 도전으로 시대의 밈을 만든 예능','유재석 외'),
seed('xman','X맨을 찾아라','방송','예능',2003,'❌',['예능','댄스','당연하지'],'주말 예능 전성기를 상징한 프로그램','유재석·강호동 외'),

seed('contact','접속','영화','로맨스',1997,'☎️',['PC통신','OST','극장'],'PC통신 시대의 감성을 담은 한국 멜로 영화','한석규·전도연'),
seed('shiri','쉬리','영화','액션',1999,'🐟',['블록버스터','흥행','극장'],'한국형 블록버스터 시대를 연 흥행작','한석규·최민식·김윤진'),
seed('jsa','공동경비구역 JSA','영화','드라마',2000,'🪖',['분단','미스터리','명작'],'한국영화의 완성도를 새롭게 보여준 작품','송강호·이병헌·신하균'),
seed('friend','친구','영화','드라마',2001,'👬',['부산','우정','유행어'],'강렬한 대사와 우정 이야기로 기억되는 영화','유오성·장동건'),
seed('sassy-girl','엽기적인 그녀','영화','로맨틱코미디',2001,'🚇',['로맨스','코미디','PC통신'],'2000년대 초반 로맨틱코미디 열풍의 대표작','전지현·차태현'),
seed('christmas-august','8월의 크리스마스','영화','멜로',1998,'📷',['사진관','멜로','감성'],'잔잔한 정서로 오래 사랑받은 한국 멜로','한석규·심은하'),
seed('beat','비트','영화','청춘',1997,'🏍️',['청춘','질주','1990년대'],'1990년대 청춘의 불안과 질주를 담은 영화','정우성·고소영'),
seed('two-cops','투캅스','영화','코미디',1993,'🚓',['형사','코미디','비디오'],'비디오 대여점 시절 자주 빌려 보던 흥행 코미디','안성기·박중훈'),

seed('know','난 알아요','음악','가요',1992,'🎧',['댄스','세대교체','가요'],'한국 대중음악의 흐름을 바꾼 상징적인 데뷔곡','서태지와 아이들'),
seed('candy','캔디','음악','아이돌',1996,'🍬',['H.O.T.','아이돌','패션'],'장갑과 멜빵 패션까지 유행시킨 대표곡','H.O.T.'),
seed('couple','커플','음악','아이돌',1998,'💛',['젝스키스','겨울','아이돌'],'세대를 넘어 다시 사랑받는 겨울 대표곡','젝스키스'),
seed('im-your-girl','I’m Your Girl','음악','아이돌',1997,'💿',['S.E.S.','걸그룹','1세대'],'1세대 걸그룹 시대를 연 대표곡','S.E.S.'),
seed('eternal-love','영원한 사랑','음악','아이돌',1999,'🎀',['핑클','걸그룹','떼창'],'손가락 안무와 후렴구가 기억나는 대표곡','핑클'),
seed('road','길','음악','발라드',2001,'🛣️',['god','국민그룹','발라드'],'위로와 공감의 가사로 사랑받은 노래','god'),
seed('twist-king','트위스트 킹','음악','댄스',1996,'🕺',['터보','여름','댄스'],'여름이면 떠오르는 신나는 댄스곡','터보'),
seed('woman-beach','해변의 여인','음악','댄스',1997,'🏖️',['쿨','여름','휴가'],'휴가철마다 들려오던 여름 대표곡','쿨'),
seed('wrong-meeting','잘못된 만남','음악','댄스',1995,'⚡',['김건모','노래방','댄스'],'빠른 랩과 멜로디로 노래방을 휩쓴 곡','김건모'),

seed('slam-dunk','슬램덩크','만화','스포츠',1990,'🏀',['농구','만화책','청춘'],'농구 열풍을 일으킨 스포츠 만화의 대표작','이노우에 다케히코'),
seed('dragon-ball','드래곤볼','만화','모험',1984,'🐉',['모험','전투','만화책'],'학교 앞 만화방과 단행본 수집의 상징','토리야마 아키라'),
seed('sailor-moon','세일러문','만화','마법소녀',1992,'🌙',['마법소녀','TV애니','변신'],'변신 장면과 주제가가 기억나는 인기 애니메이션','타케우치 나오코'),
seed('cardcaptor','카드캡터 체리','만화','판타지',1996,'🃏',['체리','마법','애니메이션'],'섬세한 그림과 캐릭터로 사랑받은 작품','CLAMP'),
seed('pokemon','포켓몬스터','만화','모험',1997,'⚡',['피카츄','애니','스티커'],'애니메이션과 게임, 스티커 열풍을 함께 만든 작품','포켓몬 컴퍼니'),
seed('digimon','디지몬 어드벤처','만화','모험',1999,'🥚',['디지몬','진화','주제가'],'진화 장면과 주제가가 강하게 남은 애니메이션','도에이 애니메이션'),
seed('hani','달려라 하니','만화','스포츠',1985,'🏃',['육상','한국만화','하니'],'한국 애니메이션을 대표하는 스포츠 성장 이야기','이진주'),
seed('youngsim','영심이','만화','일상',1990,'🎒',['학교','한국만화','일상'],'평범한 학생의 일상을 유쾌하게 그린 작품','배금택'),
seed('superboard','날아라 슈퍼보드','만화','모험',1990,'☁️',['손오공','한국애니','주제가'],'주제가와 개성 강한 캐릭터가 기억나는 작품','허영만 원작'),

seed('starcraft','스타크래프트','게임','PC게임',1998,'👾',['PC방','e스포츠','전략'],'PC방 문화와 e스포츠 열풍을 만든 게임','블리자드 엔터테인먼트'),
seed('lineage','리니지','게임','온라인',1998,'⚔️',['온라인게임','혈맹','PC방'],'국내 온라인 RPG 문화를 크게 확장한 게임','엔씨소프트'),
seed('wind','바람의나라','게임','온라인',1996,'🍃',['온라인게임','도트','RPG'],'초기 국내 온라인 게임의 상징적인 작품','넥슨'),
seed('diablo2','디아블로 II','게임','PC게임',2000,'🔥',['아이템','PC방','액션RPG'],'밤새 아이템을 모으던 PC방의 기억','블리자드 엔터테인먼트'),
seed('kart','카트라이더','게임','레이싱',2004,'🏎️',['레이싱','학교친구','온라인'],'친구들과 방을 만들어 즐기던 국민 레이싱 게임','넥슨'),
seed('metal-slug','메탈슬러그','게임','오락실',1996,'🔫',['오락실','협동','액션'],'문방구 앞 오락기에서 자주 보던 액션 게임','SNK'),

seed('two-percent','2% 부족할 때','광고','음료',1999,'🥤',['광고','유행어','음료'],'감성적인 문구와 스타 마케팅으로 기억되는 광고','롯데칠성음료'),
seed('anycall','애니콜 광고','광고','전자기기',1990,'📱',['휴대전화','CM','스타'],'휴대전화 대중화 시기의 대표적인 브랜드 광고','삼성전자'),
seed('pager','삐삐','생활문화','통신',1990,'📟',['공중전화','숫자암호','연락'],'숫자 암호로 마음을 전하던 이동통신 이전의 기억','이동통신 문화'),
seed('video-shop','비디오 대여점','생활문화','공간',1988,'📼',['비디오','주말','대여점'],'주말마다 영화 테이프를 고르던 동네 문화 공간','생활문화'),
seed('stationery-arcade','문방구 오락기','생활문화','놀이',1990,'🕹️',['문방구','동전','하굣길'],'학교가 끝나면 친구들과 모이던 작은 오락실','생활문화')
];

const $=s=>document.querySelector(s),grid=$('#grid'),dialog=$('#dialog');
let current=null,currentTab='story';
function filtered(){const q=$('#inlineQ').value.trim().toLowerCase(),c=$('#cf').value,d=$('#df').value;return memories.filter(x=>(!q||[x.title,x.category,x.genre,x.year,x.summary,x.people,...x.tags].join(' ').toLowerCase().includes(q))&&(c==='all'||x.category===c)&&(d==='all'||Math.floor(x.year/10)*10==Number(d)))}
function typeClass(v){return {영화:'movie',음악:'music',만화:'comic',게임:'game',광고:'ad',생활문화:'life'}[v]||''}
function render(){const a=filtered();$('#sum').textContent=`${a.length}개의 기억을 찾았습니다.`;grid.innerHTML=a.map(x=>`<button class="card" data-id="${x.id}"><div class="poster ${typeClass(x.category)}">${x.emoji}<b>${x.category}</b></div><div class="body"><div class="meta"><span>${x.genre}</span><span>${x.year}</span></div><h3>${x.title}</h3><p>${x.summary}</p><div class="chips">${x.tags.map(t=>`<i>#${t}</i>`).join('')}</div></div></button>`).join('');grid.querySelectorAll('.card').forEach(b=>b.onclick=()=>openItem(b.dataset.id))}
function openItem(id){current=memories.find(x=>x.id===id);currentTab='story';drawDetail();dialog.showModal()}
function drawDetail(){const x=current;$('#dc').innerHTML=`<div class="detail-shell"><div class="detail-cover ${typeClass(x.category)}"><span>${x.category}</span>${x.emoji}</div><div class="detail-main"><div class="eyebrow">${x.category} · ${x.genre} · ${x.year}</div><h2>${x.title}</h2><p class="detail-lead">${x.summary}</p><div class="detail-facts"><div><small>기록 연도</small><b>${x.period}</b></div><div><small>주요 인물·주체</small><b>${x.people}</b></div><div><small>키워드</small><b>${x.tags.join(' · ')}</b></div></div><div class="detail-tabs"><button data-tab="story" class="${currentTab==='story'?'active':''}">이야기</button><button data-tab="media" class="${currentTab==='media'?'active':''}">공식 자료</button><button data-tab="related" class="${currentTab==='related'?'active':''}">관련 추억</button><button data-tab="memory" class="${currentTab==='memory'?'active':''}">사람들의 기억</button></div><div class="detail-panel">${tabContent(x)}</div><div class="detail-actions"><button class="primary" onclick="writeMemory()">내 추억 남기기</button><button class="secondary" onclick="shareItem()">주소 복사</button></div></div></div>`;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;drawDetail()})}
function tabContent(x){if(currentTab==='media')return `<div class="source-list">${x.sources.map(s=>`<div class="source-item"><b>${s}</b><small>검수 완료 후 공식 링크와 영상이 표시됩니다.</small></div>`).join('')}</div>`;if(currentTab==='related'){const near=memories.filter(m=>m.id!==x.id&&(m.category===x.category||Math.abs(m.year-x.year)<=2)).slice(0,4);return `<div class="related-list">${near.map(r=>`<button class="related-item" onclick="openItem('${r.id}')"><b>${r.title}</b><small>${r.year} · ${r.category}</small></button>`).join('')}</div>`}if(currentTab==='memory')return `<div class="memory-list">${x.userMemories.map((m,i)=>`<div class="memory-item"><b>추억여행자 ${i+1}</b><small>${m}</small></div>`).join('')}</div>`;return `<div class="detail-section"><h3>기억나는 장면</h3><p>${x.moment}</p></div><div class="detail-section"><h3>그 시대의 의미</h3><p>${x.culture}</p></div>`}
function writeMemory(){dialog.close();location.hash='memory';document.querySelector('#memoryForm input[placeholder="작품이나 물건의 이름"]').value=current.title}
function shareItem(){const url=`${location.origin}${location.pathname}?item=${current.id}`;navigator.clipboard?.writeText(url);alert('항목 주소를 복사했습니다.')}
function quick(v){$('#inlineQ').value=v;render();location.hash='archive'}
function category(v){$('#cf').value=v;render();location.hash='archive'}
function heroSearch(){$('#inlineQ').value=$('#heroQ').value;render();location.hash='archive'}
function resetAll(){$('#inlineQ').value='';$('#cf').value=$('#df').value='all';render()}
function randomCard(){openItem(memories[Math.floor(Math.random()*memories.length)].id)}
window.quick=quick;window.category=category;window.heroSearch=heroSearch;window.resetAll=resetAll;window.randomCard=randomCard;window.openItem=openItem;window.closeDialog=()=>dialog.close();window.writeMemory=writeMemory;window.shareItem=shareItem;
document.addEventListener('DOMContentLoaded',()=>{render();$('#statTotal').textContent=`${memories.length}`;const today=memories[new Date().getDate()%memories.length];$('#todayTitle').textContent=today.title;$('#todayText').textContent=today.summary;$('#todayIcon').textContent=today.emoji;$('#todayOpen').onclick=()=>openItem(today.id);$('#inlineQ').addEventListener('input',render);$('#cf').addEventListener('change',render);$('#df').addEventListener('change',render);$('#heroQ').addEventListener('keydown',e=>{if(e.key==='Enter')heroSearch()});$('#memoryForm').addEventListener('submit',e=>{e.preventDefault();$('#notice').textContent='소중한 추억이 임시 저장되었습니다.';e.target.reset()});const id=new URLSearchParams(location.search).get('item');if(id&&memories.some(x=>x.id===id))openItem(id)});