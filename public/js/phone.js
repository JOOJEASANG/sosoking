import {convertOldNumber} from './phone-rules.js';
const form=document.querySelector('#numberForm'),input=document.querySelector('#oldNumber'),result=document.querySelector('#result');
function text(tag,content,cls=''){const n=document.createElement(tag);n.textContent=content;if(cls)n.className=cls;return n;}
form.addEventListener('submit',event=>{
 event.preventDefault();const out=convertOldNumber(input.value);result.replaceChildren();result.hidden=false;
 if(!out.ok){result.className='result-box failure';result.append(text('strong','변환 결과를 확인할 수 없습니다.'),text('p',out.reason));return;}
 result.className='result-box success';result.append(text('span','전환 당시 배정 규칙으로 계산한 추정 번호','eyebrow'),text('strong',out.estimated,'phone-result'),text('p',`${out.old} → ${out.estimated}`),text('p',out.disclaimer,'note'));
 const copy=document.createElement('button');copy.type='button';copy.className='btn secondary';copy.textContent='결과 복사';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(out.estimated);copy.textContent='복사했습니다';}catch{copy.textContent='복사할 수 없습니다';}});result.append(copy);
});

for(const a of document.querySelectorAll('[data-nav="tools"]'))a.setAttribute('aria-current','page');
const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='다시 입력';reset.addEventListener('click',()=>{form.reset();result.hidden=true;result.replaceChildren();input.focus()});form.append(reset);
