import data from '../data/local-ferry.json';
import {$,node,link,empty,csv,actionRow} from './life-shared.js';
export function initLocalFerry(){
 const root=$('#localFerry');if(!root)return;
 const out=$('#localFerryResults'),count=$('#localFerryCount'),more=$('#localFerryMore'),source=$('#localFerrySource');
 let shown=8;
 const norm=s=>String(s??'').toLowerCase().replace(/\s+/g,'');
 function filtered(){const region=$('#regionFilter').value,port=norm($('#departFilter').value),island=norm($('#arriveFilter').value),words=$('#postSearch').value.trim().split(/\s+/).filter(Boolean);
 return data.rows.filter(r=>(!region||r.region===region)&&(!source.value||r.sourceType===source.value)&&norm(r.port+' '+r.area).includes(port)&&norm(r.island).includes(island)&&words.every(w=>norm([r.region,r.area,r.port,r.island,r.operator,r.note].join(' ')).includes(norm(w))))}
 function timeRow(label,times){const row=node('div',undefined,'local-time-row');row.append(node('small',label));const list=node('div',undefined,'local-times');if(!times.length)list.append(node('span','원문·매표소 확인','hint'));else for(const time of times)list.append(node('span',time,'time-pill'));row.append(list);return row}
 function render(){const rows=filtered();count.textContent='총 '+rows.length+'개 항로 · 자료 확인 '+data.checked;out.replaceChildren();if(!rows.length)empty(out,'검색 조건에 맞는 참고 자료가 없습니다. 다른 지역이나 섬 이름을 입력해 주세요.');
 for(const r of rows.slice(0,shown)){const card=node('article',undefined,'local-route');const meta=node('div',undefined,'entry-meta');meta.append(node('span',r.region+' '+r.area,'tag'),node('span',r.sourceType,'tag'+(r.sourceType==='블로그'?' warn':'')));card.append(meta,node('h3',r.port+' ↔ '+r.island,'ferry-route'),node('p',[r.operator,r.duration,r.fare].filter(Boolean).join(' · '),'hint'));
 if(r.address)card.append(node('p','승선 위치: '+r.address,'hint'));
 const detail=node('details');if(rows.length===1||r.id==='hongseong-jukdo')detail.open=true;detail.append(node('summary','시간표 및 이용 안내 ('+r.variants.length+'종)'));
 for(const v of r.variants){const box=node('div',undefined,'local-variant');box.append(node('strong',v.label),timeRow(r.port+' 출발',v.out),timeRow('섬 출발',v.back));detail.append(box)}
 detail.append(node('p',r.note,'hint'));card.append(detail,node('p','자료: '+r.sourceName+(r.published?' · 게시/수정 '+r.published:' · 게시일 미표기'),'hint'));
 const a=link('원문 확인 ↗',r.sourceUrl,'secondary');a.target='_blank';a.rel='noopener noreferrer';const actions=actionRow(a);if(r.phone)actions.append(link('운항 문의 '+r.phone,'tel:'+r.phone,'secondary'));const correction=link('정보 수정 제보','/ferry.html?write=1&route='+encodeURIComponent(r.port+' ↔ '+r.island),'secondary');actions.append(correction);card.append(actions);out.append(card)}
 more.hidden=rows.length<=shown;
 }
 for(const id of ['#regionFilter','#departFilter','#arriveFilter','#postSearch','#localFerrySource']){const el=$(id);el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{shown=8;render()})}
 more.addEventListener('click',()=>{shown+=8;render()});
 $('#localFerryCSV').addEventListener('click',()=>csv('sosoking-local-ferry.csv',[['지역','시군','출발항','섬','선박/운영','조건','항구 출발','섬 출발','요금 참고','문의','출처 종류','원문 URL','게시일','확인일','주의'],...filtered().flatMap(r=>r.variants.map(v=>[r.region,r.area,r.port,r.island,r.operator,v.label,v.out.join(' / '),v.back.join(' / '),r.fare,r.phone,r.sourceType,r.sourceUrl,r.published||'',r.checked,r.note]))]));
 const route=new URLSearchParams(location.search).get('route');if(route){const title=$('#postForm [name=title]');if(title)title.value=route.slice(0,100)+' 정보 수정';}
 render();
}
