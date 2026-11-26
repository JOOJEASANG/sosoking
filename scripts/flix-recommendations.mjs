// Independent site activity and editorial metadata only; never derive scores from YouTube API statistics.
const DAY=86400000,finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
export const RECOMMENDATION_VERSION='editorial-watch-v2';
export function rankWorks(items,watchRows=null,now=Date.now(),monthlyRows=null){
 const visible=items.filter(w=>!w.hidden),watch=new Map();
 if(Array.isArray(watchRows))for(const x of watchRows)if(typeof x.workId==='string'&&finite(x.watchSeconds))watch.set(x.workId,(watch.get(x.workId)||0)+Math.min(x.watchSeconds,86400));
 const rows=visible.map(w=>({id:w.id,watch:watch.get(w.id)||0,featured:!!w.featured,added:Date.parse(w.addedAt)||0}));
 rows.sort((a,b)=>Number(b.featured)-Number(a.featured)||b.watch-a.watch||b.added-a.added||a.id.localeCompare(b.id));
 const popular=rows.filter(x=>x.watch>0).sort((a,b)=>b.watch-a.watch||a.id.localeCompare(b.id));
 const monthly=new Map();if(Array.isArray(monthlyRows))for(const x of monthlyRows)if(typeof x.workId==='string'&&finite(x.watchSeconds))monthly.set(x.workId,(monthly.get(x.workId)||0)+Math.min(x.watchSeconds,86400));const monthlyPopular=visible.filter(w=>(monthly.get(w.id)||0)>0).sort((a,b)=>monthly.get(b.id)-monthly.get(a.id)||a.id.localeCompare(b.id)).map(w=>w.id).slice(0,10);return {version:RECOMMENDATION_VERSION,monthlyPopular,ranked:rows.map(x=>x.id).slice(0,100),popular:popular.map(x=>x.id).slice(0,10),popularSource:'watch',newWorks:rows.filter(x=>x.added>0&&now-x.added>=0&&now-x.added<=14*DAY).sort((a,b)=>b.added-a.added||a.id.localeCompare(b.id)).map(x=>x.id).slice(0,10)};
}