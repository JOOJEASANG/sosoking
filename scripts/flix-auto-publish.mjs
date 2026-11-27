import {validateCatalog,durationSeconds,validId} from './flix-catalog-validation.mjs';
import {classifyCandidate} from './flix-discovery-policy.mjs';
import {groupCandidates,batchEligible,cleanCuration} from '../public/flix/curation-core.js';
import {normalizeTitle} from './flix-track-series.mjs';

export const AUTO_WORK_LIMIT=5;
export const AGE_REASON='연령 제한';
// Preserve episode numbers and administrator edits. A confirmed restricted
// original hides the entire work, including chapters of the same video.
export function hideAgeRestricted(items,records){
 const blocked=new Set(records.filter(x=>x.available===false&&x.reason===AGE_REASON).map(x=>x.videoId));
 const hidden=[];
 const next=items.map(w=>{if(w.hidden||!w.episodes.some(e=>blocked.has(e.videoId)))return w;hidden.push(w.id);return {...w,hidden:true}});
 return {items:validateCatalog(next),hidden};
}
const adultLabel=/(?:19\s*금|청소년\s*관람\s*불가|성인\s*전용|성인\s*인증|연령\s*제한|(?:^|[\s[(])(?:18|19)\+(?=$|[\s)\]])|age[\s-]*restricted|nsfw)/i;
export function hasAdultLabel(value){return adultLabel.test(String(value||''))}
export function autoSignals(v){
 const s=v.snippet||{},title=String(s.title||''),text=[title,...(Array.isArray(s.tags)?s.tags:[]),String(s.description||'').slice(0,2000)].join(' ');
 const ai=/(?:\bAI\b|인공지능|생성형\s*AI)\s*(?:로\s*(?:제작|만든)|(?:영상\s*)?(?:드라마|영화|애니메이션|애니|사극|시리즈|animation|film|movie|drama))/i.test(text)||/(?:드라마|영화|애니메이션|영상)\s*(?:를|을)?\s*(?:AI|인공지능)로\s*(?:제작|만든)/i.test(text);
 const kind=/애니메이션|\bAI\s*animation\b|\bAI\s*애니\b/i.test(text)?'애니메이션':/드라마|사극|\bAI\s*drama\b/i.test(text)?'드라마':/영화|\bAI\s*(?:film|movie)\b/i.test(text)?'영화':'';
 const language=String(s.defaultAudioLanguage||s.defaultLanguage||'').toLowerCase();
 return {aiEvidence:ai,autoKind:kind,koreanEvidence:language?(/^ko(?:[-_]|$)/.test(language)):/[가-힣]{2}/.test(title),adultLabel:hasAdultLabel(title)||hasAdultLabel((s.tags||[]).join(' '))};
}
function fresh(c,now){const checked=Date.parse(c.checkedAt),published=Date.parse(c.publishedAt);return c.verifiedPublic===true&&c.aiEvidence===true&&c.koreanEvidence===true&&['드라마','영화','애니메이션'].includes(c.autoKind)&&!c.adultLabel&&!hasAdultLabel(c.title)&&validId(c.videoId)&&/^UC[A-Za-z0-9_-]{22}$/.test(c.channelId||'')&&!!c.creator?.trim()&&Number.isFinite(checked)&&checked<=now+60000&&now-checked<=3600000&&Number.isFinite(published)&&published<=now+60000&&!!classifyCandidate(c)}
function genreFor(title,type){return /사극|역사/.test(title)?'사극':/로맨스|멜로/.test(title)?'로맨스':/판타지/.test(title)?'판타지':/스릴러|추리/.test(title)?'스릴러':/코미디|개그/.test(title)?'코미디':type==='애니메이션'?'애니메이션':'기타'}
export function autoPublishWorks(items,candidates,settings={},now=Date.now()){
 const next=structuredClone(validateCatalog(items)),clean=cleanCuration(settings),trusted=new Set(clean.trusted),ids=new Set(next.map(w=>w.id)),used=new Set(next.flatMap(w=>w.episodes.map(e=>e.videoId))),published=[];
 // Group before eligibility filtering so ambiguous or unverified sibling
 // episodes cannot be silently dropped to create a falsely consecutive series.
 for(const group of groupCandidates(candidates,clean)){
  if(published.length>=AUTO_WORK_LIMIT)break;
  const rows=group.items;
  if(group.workId||!rows.length||rows.length>20||rows.some(c=>clean.held.includes(c.videoId)||used.has(c.videoId)||!fresh(c,now)||c.autoKind!==rows[0].autoKind||c.channelId!==rows[0].channelId||c.creator!==rows[0].creator))continue;
  const first=rows[0],series=batchEligible(group,1)&&rows.every(c=>classifyCandidate(c)==='series')&&first.autoKind!=='영화';
  const feature=rows.length===1&&((classifyCandidate(first)==='popular'&&['영화','애니메이션'].includes(first.autoKind)&&/본편|장편|완결|full\s*(?:film|movie)|feature\s*film/i.test(first.title))||classifyCandidate(first)==='series-compilation');
  if(!series&&!feature)continue;
  if(series&&rows.length<2&&!trusted.has(first.channelId))continue;
  const title=String(group.title||first.title).trim();
  if(!title||title.length>200||next.some(w=>w.creator===first.creator&&normalizeTitle(w.tracking?.matchTitle||w.title)===normalizeTitle(title)))continue;
  const id='auto-'+first.videoId.toLowerCase().replace(/_/g,'-');
  if(ids.has(id))continue;
  const work={id,title,creator:first.creator,genre:genreFor(title,first.autoKind),type:first.autoKind,status:series?'연재 중':'완결',language:'한국어',description:'제작자가 공개한 AI 영상입니다. 작품 정보는 원본 영상에서 확인할 수 있습니다.',addedAt:new Date(now).toISOString().slice(0,10),tracking:{enabled:series,autoPublish:series,matchTitle:series?title:''},episodes:rows.map((c,i)=>({number:i+1,title:c.title,videoId:c.videoId,start:0,duration:durationSeconds(c.duration),publishedAt:c.publishedAt.slice(0,10)}))};
  next.push(work);validateCatalog(next);ids.add(id);rows.forEach(c=>used.add(c.videoId));published.push({id,title,episodes:rows.length});
 }
 return {items:next,published};
}
