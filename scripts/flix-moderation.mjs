import {cleanCuration} from '../public/flix/curation-core.js';

// Exclude only originals no longer present in any remaining episode/chapter.
export function removedVideoIds(before, after) {
 const remaining=new Set(after.flatMap(w=>w.episodes.map(e=>e.videoId)));
 return [...new Set(before.flatMap(w=>w.episodes.map(e=>e.videoId)))].filter(id=>!remaining.has(id));
}
export function excludeOriginals(settings,ids) {
 const next=cleanCuration(settings);
 const excluded=new Set([...next.excluded,...ids]);
 if(excluded.size>500)throw Error('제외 목록 500개 한도에 도달했습니다. 제외 목록을 관리한 뒤 다시 시도하세요.');
 return {...next,excluded:[...excluded],held:next.held.filter(id=>!excluded.has(id))};
}
export function deleteWorksPlan(items,ids,settings) {
 const wanted=new Set(ids);
 if(!wanted.size||[...wanted].some(id=>!items.some(w=>w.id===id)))throw Error('작품이 변경되었습니다. 최신 목록을 불러오세요.');
 const next=items.filter(w=>!wanted.has(w.id)),removed=removedVideoIds(items,next);
 return {items:next,removed,settings:excludeOriginals(settings,removed)};
}
