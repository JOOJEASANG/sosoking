// Pure helpers shared by tools and automated tests.
export const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
export const won=n=>Number(n).toLocaleString('ko-KR')+'원';
export const validId=x=>typeof x==='string'&&/^[A-Za-z0-9]{20}$/.test(x);
export const clean=x=>String(x??'').trim();
export const uniqueOptions=x=>[...new Set(String(x??'').split(/[\n,]/).map(clean).filter(Boolean))];
export function csvText(rows){const cell=x=>'"'+String(x??'').replace(/^[\s]*[=+\-@\t\r\n]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')}
export function aggregatePoll(poll,votes){
 const n=poll.options.length,counts=Array(n).fill(0),people=Array(n).fill(0),rows=[];let quantity=0,total=0;
 for(const vote of votes){
  if(poll.mode==='order'){
   const q=Array.from({length:n},(_,i)=>Number.isInteger(vote.quantities?.[i])&&vote.quantities[i]>=0&&vote.quantities[i]<=999?vote.quantities[i]:0);
   q.forEach((x,i)=>{counts[i]+=x;people[i]+=x>0?1:0;quantity+=x;total+=x*poll.prices[i]});
   rows.push({alias:vote.alias||'익명',values:q,total:q.reduce((s,x,i)=>s+x*poll.prices[i],0)});
  }else{
   const selected=Array.isArray(vote.choices)?vote.choices:[vote.choice];
   const valid=[...new Set(selected.filter(i=>Number.isInteger(i)&&i>=0&&i<n))];
   const party=poll.mode==='attendance'&&valid.includes(0)&&Number.isInteger(vote.party)&&vote.party>=1&&vote.party<=99?vote.party:1;
   valid.forEach(i=>{counts[i]++;people[i]+=poll.mode==='attendance'&&i===0?party:1});
   rows.push({alias:vote.alias||'익명',values:valid,party:poll.mode==='attendance'&&valid.includes(0)?party:0});
  }
 }
 return {counts,people,rows,responses:votes.length,quantity,total};
}
function utc(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;let t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:NaN}
export const validDate=s=>Number.isFinite(utc(s));
export function routeStatus(meta,today){if(!meta?.checked)return '확인일 미등록';if(meta.validUntil&&meta.validUntil<today)return '유효기간 경과';const age=(utc(today)-utc(meta.checked))/86400000;return age>90?'재확인 필요':'확인일 등록';}
export function filterPosts(posts,{category='',region='',search='',departure='',arrival='',sort='latest'}={}){
 const text=x=>String(x??'').toLowerCase(),tokens=text(search).trim().split(/\s+/).filter(Boolean);
 return posts.filter(p=>{const m=p.meta||{},hay=text([p.title,p.body,p.category,m.region,m.departure,m.arrival,m.operator,m.schedule,m.returnSchedule,m.area,m.condition,m.infoKind,m.evidence].join(' '));return (!category||p.category===category)&&(!region||m.region===region)&&(!departure||text(m.departure||p.title+' '+p.body).includes(text(departure)))&&(!arrival||text(m.arrival||p.title+' '+p.body).includes(text(arrival)))&&tokens.every(t=>hay.includes(t))}).sort((a,b)=>{if(sort==='checked')return String(b.meta?.checked||'').localeCompare(String(a.meta?.checked||''))||(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);const d=(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);return sort==='oldest'?-d:d});
}

export function settlePayments(rows,custom=false){
 if(!Array.isArray(rows)||rows.length<2||rows.length>30)throw Error('참여자는 2~30명이어야 합니다.');
 const names=rows.map(r=>clean(r.name));if(names.some(n=>!n||n.length>40)||new Set(names).size!==names.length)throw Error('서로 다른 참여자 이름을 입력하세요.');
 const paid=rows.map(r=>r.paid);if(paid.some(x=>!Number.isSafeInteger(x)||x<0||x>1000000000))throw Error('결제액은 0~10억원의 정수로 입력하세요.');
 const total=paid.reduce((s,x)=>s+x,0),base=Math.floor(total/rows.length),extra=total%rows.length;
 const shares=custom?rows.map(r=>r.share):rows.map((_,i)=>base+(i<extra?1:0));if(shares.some(x=>!Number.isSafeInteger(x)||x<0||x>30000000000)||shares.reduce((s,n)=>s+n,0)!==total)throw Error('개별 부담액의 합계가 총 결제액과 같아야 합니다.');const people=rows.map((r,i)=>({name:names[i],paid:paid[i],share:shares[i],balance:paid[i]-shares[i]}));
 const debt=people.filter(p=>p.balance<0).map(p=>({name:p.name,left:-p.balance})),credit=people.filter(p=>p.balance>0).map(p=>({name:p.name,left:p.balance}));let i=0,j=0;const transfers=[];
 while(i<debt.length&&j<credit.length){const amount=Math.min(debt[i].left,credit[j].left);transfers.push({from:debt[i].name,to:credit[j].name,amount});debt[i].left-=amount;credit[j].left-=amount;if(!debt[i].left)i++;if(!credit[j].left)j++}
 return {total,base,extra:custom?0:extra,people,transfers};
}

export function allocateGroups(people,groups){
 if(!Array.isArray(people)||people.length<1||people.length>200||people.some(x=>typeof x!=='string'||!x.trim()||x.length>80)||new Set(people).size!==people.length)throw Error('서로 다른 참가자 이름을 1~200명 입력하세요.');
 if(!Array.isArray(groups)||!groups.length||groups.length>100||groups.some(x=>!x.name||x.name.length>80||!Number.isInteger(x.capacity)||x.capacity<1||x.capacity>100)||new Set(groups.map(g=>g.name)).size!==groups.length)throw Error('서로 다른 차량·조 이름과 1~100명 정원을 입력하세요.');
 const assigned=groups.map(g=>({...g,people:[]}));let i=0;for(const person of people){let found=false;for(let j=0;j<assigned.length;j++){let k=(i+j)%assigned.length;if(assigned[k].people.length<assigned[k].capacity){assigned[k].people.push(person);i=(k+1)%assigned.length;found=true;break}}if(!found)return {groups:assigned,unassigned:people.slice(assigned.reduce((s,g)=>s+g.people.length,0))}}
 return {groups:assigned,unassigned:[]};
}
