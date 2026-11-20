export function countText(input='') {
 const text=String(input);
 const graphemes=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)).length:Array.from(text).length;
 const compact=text.replace(/\s/gu,'');
 const noSpaces=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(compact)).length:Array.from(compact).length;
 return {all:graphemes,withoutSpace:noSpaces,words:text.trim()?text.trim().split(/\s+/u).length:0,bytes:new TextEncoder().encode(text).length};
}
export function normalizeLineEndSpaces(input='') {return String(input).replace(/[ \t]+(?=\r?$)/gm,'');}
function dateUTC(key) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;
 const [y,m,d]=key.split('-').map(Number);
 if(y<100||y>9999||m<1||m>12||d<1||d>31)return null;
 const utc=Date.UTC(y,m-1,d),t=new Date(utc);
 return t.getUTCFullYear()===y&&t.getUTCMonth()+1===m&&t.getUTCDate()===d?utc:null;
}
export function dateSpan(from,to){
 const a=dateUTC(from),b=dateUTC(to);
 if(a===null||b===null)return null;
 const difference=Math.round((b-a)/86400000);
 return {difference,absolute:Math.abs(difference),inclusive:Math.abs(difference)+1};
}
export function percentValues(base,percent) {
 const a=Number(base),p=Number(percent);
 if(base===''||percent===''||!Number.isFinite(a)||!Number.isFinite(p))return null;
 const part=a*p/100;
 return {part,up:a+part,down:a-part};
}
export function candidates(input,max=500) {
 const entries=String(input).split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
 return [...new Set(entries)].slice(0,max);
}
export function chooseRandom(items,randomFloat) {
 if(!items.length||!(randomFloat>=0&&randomFloat<1))return null;
 return items[Math.floor(randomFloat*items.length)];
}
const PAPER=Object.freeze({
 A3:[297,420],A4:[210,297],A5:[148,210],
 'B4-JIS':[257,364],'B5-JIS':[182,257],
 'B4-ISO':[250,353],'B5-ISO':[176,250]
});
export function paperSpec(size,dpi=300) {
 const wh=PAPER[size];
 if(!wh||!Number.isFinite(dpi)||dpi<=0)return null;
 const [width,height]=wh;
 return {width,height,pixelsWidth:Math.round(width/25.4*dpi),pixelsHeight:Math.round(height/25.4*dpi)};
}