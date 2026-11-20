import {countText,normalizeLineEndSpaces,dateSpan,percentValues,candidates,chooseRandom,paperSpec} from './tool-core.js';
const $=id=>document.getElementById(id);
const formatter=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
const show=n=>formatter.format(n);
function refreshText(){
 const stats=countText($('textInput').value);
 for(const [name,value] of Object.entries({withSpace:stats.all,withoutSpace:stats.withoutSpace,wordCount:stats.words,byteCount:stats.bytes}))$(name).textContent=show(value);
}
$('textInput').addEventListener('input',refreshText);
$('normalizeText').addEventListener('click',()=>{$('textInput').value=normalizeLineEndSpaces($('textInput').value);refreshText();$('textFeedback').textContent='줄 끝 공백을 정리했습니다.';});
$('clearText').addEventListener('click',()=>{$('textInput').value='';refreshText();$('textFeedback').textContent='입력을 지웠습니다.';$('textInput').focus();});
$('copyText').addEventListener('click',async()=>{
 try{
  if(!navigator.clipboard?.writeText)throw new Error('클립보드 미지원');
  await navigator.clipboard.writeText($('textInput').value);
  $('textFeedback').textContent='텍스트를 복사했습니다.';
 }catch{$('textFeedback').textContent='복사가 제한된 브라우저입니다. 텍스트를 직접 선택해 복사해 주세요.';}
});
function localISO(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
const now=new Date(),after=new Date(now.getFullYear(),now.getMonth(),now.getDate()+7);
$('startDate').value=localISO(now);$('endDate').value=localISO(after);
function refreshDates(){
 const res=dateSpan($('startDate').value,$('endDate').value);
 $('dateAnswer').textContent=res? '날짜 차이 '+show(res.absolute)+'일 · 양 끝 날짜 포함 '+show(res.inclusive)+'일'+(res.difference<0?' (종료일이 시작일보다 앞섭니다)':''):'올바른 날짜 두 개를 선택해 주세요.';
}
for(const id of ['startDate','endDate'])$(id).addEventListener('input',refreshDates);
function refreshPercent(){
 const res=percentValues($('baseValue').value,$('percentValue').value);
 $('percentPart').textContent=res?show(res.part):'–';
 $('percentUp').textContent=res?show(res.up):'–';
 $('percentDown').textContent=res?show(res.down):'–';
}
for(const id of ['baseValue','percentValue'])$(id).addEventListener('input',refreshPercent);
function refreshCandidates(){
 const count=candidates($('randomInput').value).length;
 $('randomCount').textContent='후보 '+show(count)+'개';
}
$('randomInput').addEventListener('input',refreshCandidates);
$('pickRandom').addEventListener('click',()=>{
 const list=candidates($('randomInput').value);
 if(!list.length){$('randomAnswer').textContent='먼저 한 줄에 하나씩 후보를 입력해 주세요.';return;}
 if(list.length===1){$('randomAnswer').textContent='뽑힌 결과: '+list[0];return;}
 const values=new Uint32Array(1),limit=Math.floor(4294967296/list.length)*list.length;
 let value;do{crypto.getRandomValues(values);value=values[0];}while(value>=limit);
 $('randomAnswer').textContent='뽑힌 결과: '+chooseRandom(list,(value%list.length)/list.length);
});
function refreshPaper(){
 const r=paperSpec($('paperSize').value);
 if(!r)return;
 $('paperMM').textContent=r.width+' × '+r.height;
 $('paperPx').textContent=show(r.pixelsWidth)+' × '+show(r.pixelsHeight);
 $('paperCM').textContent=show(r.width/10)+' × '+show(r.height/10);
}
$('paperSize').addEventListener('change',refreshPaper);
refreshText();refreshDates();refreshPercent();refreshCandidates();refreshPaper();