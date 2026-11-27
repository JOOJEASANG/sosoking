import {groupCandidates,batchEligible,cleanCuration,sourceEpisode} from './curation-core.js';
const seconds=s=>{const m=String(s).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):0};
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const adult=/19\s*금|청소년\s*관람\s*불가|성인\s*전용|성인\s*인증|연령\s*제한|age[\s-]*restricted|nsfw|(?:^|[\s[(])(?:18|19)\+(?=$|[\s)\]])/i;
const unwanted=/shorts\b|쇼츠|숏폼|숏츠|예고|티저|trailer|teaser|하이라이트|highlight|비하인드|메이킹|튜토리얼|제작\s*(?:방법|과정|강의)|단편|short\s*film/i;
const types=['드라마','영화','애니메이션'];
export function candidateSafe(c,now=Date.now()){const checked=Date.parse(c.checkedAt),published=Date.parse(c.publishedAt);return c.verifiedPublic===true&&!c.adultLabel&&!adult.test(c.title||'')&&!unwanted.test([c.title,c.formatTags].join(' '))&&c.typeHint!=='trailer'&&/^[A-Za-z0-9_-]{11}$/.test(c.videoId||'')&&/^UC[A-Za-z0-9_-]{22}$/.test(c.channelId||'')&&!!c.creator?.trim()&&!!c.title?.trim()&&Number.isFinite(checked)&&checked<=now+60000&&now-checked<=24*3600000&&Number.isFinite(published)&&published<=now+60000&&seconds(c.duration)>=300}
export function candidateType(c){return types.includes(c.autoKind)?c.autoKind:/애니메이션|animation/i.test(c.title)?'애니메이션':/영화|film|movie/i.test(c.title)?'영화':/드라마|사극|drama/i.test(c.title)?'드라마':''}
function genre(title,type){return /사극|역사/.test(title)?'사극':/로맨스|멜로/.test(title)?'로맨스':/판타지/.test(title)?'판타지':/스릴러|추리/.test(title)?'스릴러':/코미디|개그/.test(title)?'코미디':type==='애니메이션'?'애니메이션':'기타'}
export function quickReviewPlan(catalog,groups,settings={},now=Date.now()){
 const next=structuredClone(catalog),clean=cleanCuration(settings),excluded=new Set(clean.excluded),held=new Set(clean.held||[]),used=new Set(next.flatMap(w=>w.episodes.map(e=>e.videoId))),published=[];
 for(const g of groups){
  const rows=g.items||[],first=rows[0];if(!first||rows.length>40||rows.some(c=>!candidateSafe(c,now)||used.has(c.videoId)||excluded.has(c.videoId)||held.has(c.videoId)||c.channelId!==first.channelId||c.creator!==first.creator))throw Error('재생 검증 실패, 중복, 보류 또는 제외 후보입니다. 재수집하거나 상세 검토하세요.');
  const target=g.workId?next.find(w=>w.id===g.workId):null;
  if(g.workId&&(!target||target.hidden||target.creator!==first.creator||target.status!=='연재 중'||!batchEligible(g,target.episodes.length+1)||normalize(g.title)!==normalize(target.tracking?.matchTitle||target.title)))throw Error('기존 작품과 연속 회차가 일치하지 않습니다.');
  const series=!target&&batchEligible(g,1)&&rows.every(c=>c.typeHint!=='compilation'&&sourceEpisode(c.title)?.key===sourceEpisode(first.title)?.key);
  const feature=!target&&!series&&rows.length===1&&!sourceEpisode(first.title)&&['popular','series-compilation'].includes(first.discoveryKind)&&seconds(first.duration)>=600;
  const type=target?.type||candidateType(first)||(series?'드라마':'');
  if(!target&&(!type||(!series&&!feature)))throw Error('작품 유형 또는 연속 회차를 확인해야 합니다.');
  const title=String(g.title||first.title).trim();if(!target&&(!title||title.length>200||next.some(w=>w.creator===first.creator&&normalize(w.tracking?.matchTitle||w.title)===normalize(title))))throw Error('같은 작품이 이미 있거나 작품명이 올바르지 않습니다.');
  const work=target||{id:'yt-'+first.videoId.toLowerCase().replace(/_/g,'-'),title,creator:first.creator,genre:genre(title,type),type,status:series?'연재 중':'완결',language:'한국어',description:'제작자가 공개한 AI 영상입니다. 자세한 작품 정보는 원본 영상에서 확인할 수 있습니다.',addedAt:new Date(now).toISOString().slice(0,10),tracking:{enabled:series,autoPublish:series,matchTitle:series?title:''},episodes:[]};
  if(!target&&next.some(w=>w.id===work.id))throw Error('작품 ID 중복');
  for(const c of rows){work.episodes.push({number:work.episodes.length+1,title:c.title,videoId:c.videoId,start:0,duration:seconds(c.duration),publishedAt:c.publishedAt.slice(0,10)});used.add(c.videoId)}
  if(!target)next.push(work);published.push({id:work.id,title:work.title,count:rows.length});
 }
 return {items:next,published};
}
export function currentReviewGroups(items,settings={}){return groupCandidates(items,settings)}
