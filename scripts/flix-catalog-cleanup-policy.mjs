import {durationSeconds} from './flix-catalog-validation.mjs';
import {excludedFormat,classifyCandidate,MIN_EPISODE_SECONDS,MIN_FEATURE_SECONDS,MIN_FEATURE_VIEWS} from './flix-discovery-policy.mjs';
export function auditCatalog(items,metadata){
 const next=structuredClone(items),hidden=[],review=[],retained=[];
 for(const w of next){if(w.hidden)continue;
 const byId=new Map();for(const e of w.episodes){const group=byId.get(e.videoId)||[];group.push(e);byId.set(e.videoId,group)}
 const series=w.episodes.length>1||w.type!=='영화'&&w.episodes.some(e=>/\d+\s*(?:화|회)|\bEP\.?\s*\d+/i.test(e.title));
 const reasons=[];for(const [id,episodes] of byId){const c=metadata.get(id);if(!c){reasons.push({id,state:'review',reason:'원본 정보 미확인 또는 재생 제한'});continue}
 const seconds=durationSeconds(c.duration);
 if(excludedFormat(c)||excludedFormat({title:w.title})||episodes.every(e=>excludedFormat({title:e.title}))){reasons.push({id,state:'exclude',reason:'쇼츠·단편·홍보성 영상'});continue}
 if(!seconds){reasons.push({id,state:'review',reason:'재생시간 미확인'});continue}
 const compilation=episodes.length>1||/몰아보기|통합본|모아보기|전편|전\s*회차|full\s*(?:season|series)/i.test([c.title,...episodes.map(e=>e.title)].join(' '));
 const episodic=series||classifyCandidate(c)==='series';
 if(compilation||episodic){const min=compilation?MIN_FEATURE_SECONDS:MIN_EPISODE_SECONDS;reasons.push({id,state:seconds>=min?'keep':'exclude',reason:seconds>=min?'연재/통합본 기준 충족':'연재/통합본 재생시간 미달'});continue}
 if(seconds<MIN_FEATURE_SECONDS){reasons.push({id,state:'exclude',reason:'독립 본편 10분 미만'});continue}
 if(!Number.isSafeInteger(c.viewCount)){reasons.push({id,state:'review',reason:'조회수 미확인'});continue}
 reasons.push({id,state:c.viewCount>=MIN_FEATURE_VIEWS?'keep':'exclude',reason:c.viewCount>=MIN_FEATURE_VIEWS?'인기 본편 기준 충족':'조회수 3,000회 미만'});
 }
 if(reasons.length&&reasons.every(x=>x.state==='exclude')){w.hidden=true;hidden.push({id:w.id,title:w.title,reasons})}
 else if(reasons.some(x=>x.state!=='keep'))review.push({id:w.id,title:w.title,reasons:reasons.filter(x=>x.state!=='keep')});
 else retained.push(w.id);
 }
 return {items:next,hidden,review,retained};
}
