(() => {
 const form=document.getElementById('portalSearch'),input=document.getElementById('siteSearch'),status=document.getElementById('searchStatus');
 if(!form||!input||!status)return;
 const cards=[...document.querySelectorAll('.tool-card,.info-card')];
 function filter(){
  const q=input.value.trim().toLocaleLowerCase('ko-KR');
  let found=0;
  for(const card of cards){
   const match=!q||(card.dataset.search+' '+card.textContent).toLocaleLowerCase('ko-KR').includes(q);
   card.hidden=!match;
   if(match)found++;
  }
  status.hidden=found!==0;
  status.textContent=found?'검색 결과 '+found+'개':'검색 결과가 없습니다. 다른 단어로 검색해 보세요.';
 }
 input.addEventListener('input',filter);
 form.addEventListener('submit',event=>{event.preventDefault();filter();document.getElementById('services')?.scrollIntoView({behavior:'smooth',block:'start'});});
 filter();
})();