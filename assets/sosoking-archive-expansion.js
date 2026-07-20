(()=>{
const eras=[1975,1980,1985,1990,1995,2000,2005,2010,2015,2020];
const catalog={
'방송':{emoji:'📺',genre:'시대 방송',subjects:['주말 가족예능','명절 특집방송','공개 코미디','청춘 드라마','일일 연속극','아침 어린이방송','퀴즈 프로그램','가요 순위방송','스포츠 중계','만화영화 시간','시사 토론방송','라디오 공개방송','연예 정보프로그램','재연 드라마','학교 배경 드라마','농촌 가족드라마','여름 납량특집','연말 시상식']},
'영화':{emoji:'🎬',genre:'영화 문화',subjects:['동네 단관극장','주말의 명화','비디오 대여점 신작','홍콩 액션영화','한국 청춘영화','가족 코미디영화','멜로영화 포스터','공포영화 심야상영','학교 단체관람','명절 특선영화','무협영화 비디오','SF 영화 상상력','극장 앞 매표소','손으로 그린 영화간판','더빙 외화','자동차극장','영화잡지 부록','비디오테이프 예고편']},
'음악':{emoji:'🎵',genre:'대중음악',subjects:['카세트테이프 녹음','라디오 신청곡','길보드 차트','대학가요제','강변가요제','댄스가요 열풍','발라드 전성기','노래방 애창곡','아이돌 팬클럽','음악다방 신청곡','워크맨 이어폰','CD 플레이어','가요톱텐 1위','테이프 늘어짐','리어카 음반가게','교실 장기자랑','응원가 떼창','미니홈피 배경음악']},
'만화':{emoji:'📚',genre:'만화·애니',subjects:['동네 만화방','소년잡지 연재만화','순정만화 단행본','TV 만화 주제가','로봇 애니메이션','마법소녀 변신장면','스포츠 만화 열풍','학교 앞 만화대여점','해적판 만화책','문구점 캐릭터 스티커','만화영화 비디오','주말 아침 애니메이션','국산 명랑만화','학습만화 전집','캐릭터 딱지','애니메이션 OST','만화책 돌려보기','방학 특집 만화']},
'게임':{emoji:'🕹️',genre:'게임 문화',subjects:['문방구 오락기','동네 오락실','전자오락실 격투게임','패미컴 합팩','휴대용 게임기','PC방 밤샘','온라인 RPG','전략 시뮬레이션','레이싱 게임','리듬 게임','두더지 잡기 기계','오락실 농구게임','게임잡지 공략집','플로피디스크 게임','전화선 모뎀게임','학교 컴퓨터실','조이스틱 대전','게임 CD 번들']},
'광고':{emoji:'📢',genre:'광고 문화',subjects:['과자 CM송','음료수 스타광고','전화기 광고','가전제품 가족광고','자동차 광고 카피','학습지 광고','장난감 광고','운동화 광고','껌 광고 유행어','세제 비교광고','라면 광고','아이스크림 광고','공익광고 캠페인','신문 전면광고','버스 정류장 광고','극장 상영 전 광고','달력 판촉광고','동네 전파사 전단']},
'생활문화':{emoji:'📼',genre:'생활 기록',subjects:['삐삐 숫자암호','공중전화 동전','비디오테이프 되감기','동네 문방구','학교 앞 불량식품','국민학교 운동회','골목 고무줄놀이','딱지치기','구슬치기','종이인형 놀이','미니카 경주','다마고치 키우기','워크맨 산책','사진관 가족사진','수동 타자기','연탄난로 도시락','시장 통닭 봉투','버스 회수권']}
};
const suffixes=['의 기억','풍경','이야기','추억','문화 기록','그 시절','다시 보기'];
const existing=new Set(memories.map(x=>x.title));
let serial=1;
Object.entries(catalog).forEach(([category,info])=>{
  eras.forEach((year,ei)=>info.subjects.forEach((subject,si)=>{
    const title=`${year}년대 ${subject} ${suffixes[(ei+si)%suffixes.length]}`;
    if(existing.has(title))return;
    memories.push({
      id:`archive-${category}-${year}-${serial++}`,
      title,category,genre:info.genre,year,emoji:info.emoji,
      tags:[`${year}년대`,subject.split(' ')[0],'레트로'],
      summary:`${year}년대 사람들의 일상 속에 자리했던 ${subject}을(를) 돌아보는 시대 문화 기록입니다.`,
      people:'당시 대중문화와 생활 속 사람들',period:`${year}년대`,
      moment:`${subject}을(를) 접하기 위해 가족이나 친구들과 기다리고 함께 즐기던 장면이 오래된 기억으로 남아 있습니다.`,
      culture:`기술과 유행, 여가생활이 달라지던 ${year}년대의 분위기를 보여주는 생활문화 자료입니다.`,
      sources:['초기 시대문화 데이터로 등록되었으며 세부 자료는 순차 검수합니다.'],related:[],userMemories:[]
    });
  }))
});
let visibleCount=60;
const originalFiltered=filtered;
function resetVisible(){visibleCount=60}
render=function(){
  const all=originalFiltered();const shown=all.slice(0,visibleCount);
  $('#sum').textContent=`전체 ${memories.length.toLocaleString()}개 중 ${all.length.toLocaleString()}개의 기억을 찾았습니다.`;
  grid.innerHTML=shown.map(x=>`<button class="card" data-id="${x.id}"><div class="poster ${typeClass(x.category)}">${x.emoji}<b>${x.category}</b></div><div class="body"><div class="meta"><span>${x.genre}</span><span>${x.year}</span></div><h3>${x.title}</h3><p>${x.summary}</p><div class="chips">${x.tags.slice(0,3).map(t=>`<i>#${t}</i>`).join('')}</div></div></button>`).join('');
  grid.querySelectorAll('.card').forEach(b=>b.onclick=()=>openItem(b.dataset.id));
  let wrap=document.querySelector('.load-more-wrap');if(wrap)wrap.remove();
  if(shown.length<all.length){wrap=document.createElement('div');wrap.className='load-more-wrap';wrap.innerHTML=`<button class="load-more">추억 더 보기 (${shown.length.toLocaleString()} / ${all.length.toLocaleString()})</button>`;grid.after(wrap);wrap.querySelector('button').onclick=()=>{visibleCount+=60;render()}}
};
quick=function(v){resetVisible();$('#inlineQ').value=v;render();location.hash='archive'};
category=function(v){resetVisible();$('#cf').value=v;render();location.hash='archive'};
heroSearch=function(){resetVisible();$('#inlineQ').value=$('#heroQ').value;render();location.hash='archive'};
resetAll=function(){resetVisible();$('#inlineQ').value='';$('#cf').value=$('#df').value='all';render()};
window.quick=quick;window.category=category;window.heroSearch=heroSearch;window.resetAll=resetAll;
document.addEventListener('DOMContentLoaded',()=>{
  $('#statTotal').textContent=memories.length.toLocaleString();
  ['#inlineQ','#cf','#df'].forEach(sel=>document.querySelector(sel)?.addEventListener(sel==='#inlineQ'?'input':'change',resetVisible));
});
})();
