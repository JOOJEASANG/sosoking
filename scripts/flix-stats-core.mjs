export const DAY_MS=86400000,SEOUL_OFFSET=32400000;
export const dayOf=(ms=Date.now())=>Math.floor((ms+SEOUL_OFFSET)/DAY_MS);
export const dayLabel=day=>new Date(day*DAY_MS).toISOString().slice(0,10);
export function summarizeStats(rows,works,today=dayOf(),now=Date.now()){
 const daily=new Map(),browsers=new Map(),live=new Map();let totalActive=0,totalWatch=0;const todayRows=[];
 for(const row of rows){if(!row||typeof row.uid!=='string'||!Number.isInteger(row.day)||row.day<today-29||row.day>today)continue;
 const k=row.day+':'+row.uid;if(daily.has(k))continue;daily.set(k,row);
 const seen=browsers.get(row.uid)||{firstDay:row.firstDay,days:new Set(),watch:0,active:0};seen.firstDay=Math.min(seen.firstDay,row.firstDay);seen.days.add(row.day);seen.watch+=row.watchSeconds||0;seen.active+=row.activeSeconds||0;browsers.set(row.uid,seen);
 if(row.day===today){todayRows.push(row);totalActive+=row.activeSeconds||0;totalWatch+=row.watchSeconds||0}
 if(row.updatedMs>=now-120000&&row.updatedMs<=now+10000){const old=live.get(row.uid);if(!old||row.updatedMs>old.updatedMs)live.set(row.uid,row)}
 }
 const trend=Array.from({length:7},(_,i)=>{const day=today-6+i;return {day,label:dayLabel(day).slice(5),visitors:[...daily.values()].filter(x=>x.day===day).length}});
 const rankings=new Map();for(const x of works){if(!x||typeof x.workId!=='string'||x.day<today-6||x.day>today||x.watchSeconds<=0)continue;const row=rankings.get(x.workId)||{id:x.workId,watchSeconds:0,users:new Set()};row.watchSeconds+=x.watchSeconds;row.users.add(x.uid);rankings.set(x.workId,row)}
 return {live:live.size,watching:[...live.values()].filter(x=>x.playing===true).length,todayVisitors:todayRows.length,newToday:todayRows.filter(x=>x.firstDay===today).length,unique30:browsers.size,returning30:browsers.size?[...browsers.values()].filter(x=>x.firstDay<Math.min(...x.days)||x.days.size>1).length/browsers.size:0,avgActive:todayRows.length?totalActive/todayRows.length:0,avgWatch:todayRows.filter(x=>x.watchSeconds>0).length?totalWatch/todayRows.filter(x=>x.watchSeconds>0).length:0,totalWatch,trend,rankings:[...rankings.values()].map(x=>({id:x.id,watchSeconds:x.watchSeconds,viewers:x.users.size})).sort((a,b)=>b.watchSeconds-a.watchSeconds).slice(0,10)};
}
export function samplePlayback(bucket,elapsed,state){const seconds=Math.max(0,Math.min(2.5,Number(elapsed)||0));if(!state.visible)return;bucket.active+=seconds;if(state.playing&&typeof state.workId==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(state.workId)){bucket.watch+=seconds;bucket.works[state.workId]=(bucket.works[state.workId]||0)+seconds}}
