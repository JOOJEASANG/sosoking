import {parseYouTubeLinks,lookupLinks} from './flix-link-lookup.mjs';
export async function tryDirectLookup(input,{config,lookup=lookupLinks}={}){
 const refs=parseYouTubeLinks(input);
 // Only explicit video IDs use the existing restricted public browser key.
 // Channel/playlist and series searches remain metered server tasks.
 if(!refs.every(r=>r.type==='video'))return null;
 try{
  const key=(await config())?.publicApiKey;
  if(typeof key!=='string'||!key.trim())return null;
  return await lookup(input,{key});
 }catch{return null}
}
export function lookupQueueStatus(data,now=Date.now()){
 const at=data?.requestedAt?.toMillis?.();
 if(!data||!Number.isFinite(at))return '조회 요청 접수 중…';
 const minutes=Math.max(0,Math.floor((now-at)/60000));
 return minutes>=30?'예약 실행 지연 · '+minutes+'분 경과 · 다시 요청하거나 GitHub 수동 실행을 이용하세요.':
 minutes>=10?'예약 실행 지연 · '+minutes+'분 경과 · GitHub 수동 실행 또는 결과를 기다려주세요.':
 '조회 요청 접수 · '+minutes+'분 경과 · 예약 실행 후 자동으로 결과가 표시됩니다.';
}
export function queueConflict(data,now=Date.now()){
 const at=data?.requestedAt?.toMillis?.();
 if(!Number.isFinite(at))return '';
 if(data.status==='pending'&&now-at<=1800000)return '이미 조회 요청이 처리 대기 중입니다. 기존 결과를 기다리거나 아래 GitHub 수동 실행을 이용하세요.';
 if(data.status!=='pending'&&now-at<=60000)return '연속 조회는 1분 간격으로 가능합니다. 잠시 후 다시 시도하세요.';
 return '';
}
