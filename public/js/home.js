const search=document.querySelector('#toolSearch');
const cards=[...document.querySelectorAll('[data-tool-card]')];
const filters=[...document.querySelectorAll('[data-filter]')];
const total=document.querySelector('#toolCount');
const empty=document.querySelector('#emptySearch');
let category='all';
function apply(){
 const q=search.value.normalize('NFKC').toLocaleLowerCase('ko').trim();
 let count=0;
 for(const card of cards){
  const matchType=category==='all'||card.dataset.category===category;
  const matchText=!q||String(card.dataset.search||'').normalize('NFKC').toLocaleLowerCase('ko').includes(q);
  card.hidden=!(matchType&&matchText);if(!card.hidden)count++;
 }
 total.textContent=count+'개 프로그램';empty.hidden=count!==0;
}
function activate(next){
 category=next;
 for(const btn of filters){
  const selected=btn.dataset.filter===category;
  btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));
 }
 apply();
}
filters.forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.filter)));
search.addEventListener('input',apply);
document.querySelector('#resetSearch').addEventListener('click',()=>{search.value='';activate('all');search.focus();});
apply();
