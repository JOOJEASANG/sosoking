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
export function makeShift(start,month,pattern){
 const base=utc(start);if(!Number.isFinite(base)||!/^\d{4}-\d{2}$/.test(month)||!Array.isArray(pattern)||pattern.length<1||pattern.length>31||pattern.some(x=>!x||x.length>20))throw Error('날짜와 근무 패턴을 확인하세요.');
 const first=utc(month+'-01');if(!Number.isFinite(first))throw Error('조회 월을 확인하세요.');
 const d=new Date(first),out=[];while(d.toISOString().slice(0,7)===month){let delta=Math.round((+d-base)/86400000),index=((delta%pattern.length)+pattern.length)%pattern.length;out.push({date:d.toISOString().slice(0,10),weekday:d.getUTCDay(),kind:pattern[index]});d.setUTCDate(d.getUTCDate()+1)}return out;
}
export function shiftIcs(days,stamp=new Date()){
 const esc=s=>String(s).replaceAll('\\','\\\\').replaceAll('\r','').replaceAll('\n','\\n').replaceAll(';','\\;').replaceAll(',','\\,');
 const compact=s=>s.replaceAll('-','');
 const now=stamp.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const next=s=>new Date(utc(s)+86400000).toISOString().slice(0,10);
 const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SOSOKING//Shift Calendar//KO','CALSCALE:GREGORIAN'];
 for(const d of days)rows.push('BEGIN:VEVENT','UID:shift-'+compact(d.date)+'@sosoking','DTSTAMP:'+now,'DTSTART;VALUE=DATE:'+compact(d.date),'DTEND;VALUE=DATE:'+compact(next(d.date)),'SUMMARY:'+esc(d.kind),'END:VEVENT');
 return [...rows,'END:VCALENDAR',''].join('\r\n');
}
export const validDate=s=>Number.isFinite(utc(s));
export function routeStatus(meta,today){if(!meta?.checked)return '확인일 미등록';if(meta.validUntil&&meta.validUntil<today)return '유효기간 경과';const age=(utc(today)-utc(meta.checked))/86400000;return age>90?'재확인 필요':'확인일 등록';}
export function filterPosts(posts,{category='',region='',search='',departure='',arrival='',sort='latest'}={}){
 const text=x=>String(x??'').toLowerCase(),tokens=text(search).trim().split(/\s+/).filter(Boolean);
 return posts.filter(p=>{const m=p.meta||{},hay=text([p.title,p.body,p.category,m.region,m.departure,m.arrival,m.operator,m.schedule].join(' '));return (!category||p.category===category)&&(!region||m.region===region)&&(!departure||text(m.departure||p.title+' '+p.body).includes(text(departure)))&&(!arrival||text(m.arrival||p.title+' '+p.body).includes(text(arrival)))&&tokens.every(t=>hay.includes(t))}).sort((a,b)=>{if(sort==='checked')return String(b.meta?.checked||'').localeCompare(String(a.meta?.checked||''))||(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);const d=(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);return sort==='oldest'?-d:d});
}
