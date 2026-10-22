// 정적 게임 엔진. 브라우저와 Node 테스트가 같은 채점 규칙을 사용한다.
export const MAX_SCORE = 100;
export function scoreCase(c, scene, run) {
 const found=new Set(Array.isArray(run.found)?run.found:[]);
 const links=new Set((Array.isArray(run.links)?run.links:[]).filter(i=>Number.isInteger(i) && i>=0 && i<scene.links.length));
 const correctCulprit=run.culprit===c.answer;
 const correctEvidence=run.keyClue===c.keyClue && found.has(c.keyClue);
 const correctTimeline=run.timeline!=='' && Number(run.timeline)===scene.timeline.correct;
 const deductions=links.size*7;
 const investigation=c.clues.every(x=>found.has(x.id))?6:0;
 const mistakes=Math.max(0,Math.floor(Number(run.mistakes)||0));
 const score=Math.max(0,Math.min(MAX_SCORE,(correctCulprit?35:0)+(correctEvidence?20:0)+(run.contradiction?15:0)+deductions+(correctTimeline?10:0)+investigation-(mistakes*4)-(run.hint?8:0)));
 return {correctCulprit,correctEvidence,correctTimeline,score,solved:correctCulprit&&correctEvidence,seconds:0};
}
