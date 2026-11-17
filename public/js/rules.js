// SOSOKING: Rift Guard — deterministic game rules shared by gameplay and tests.
export const WIDTH = 1000;
export const HEIGHT = 600;
export const CELL = 50;
export const COLS = WIDTH / CELL;
export const ROWS = HEIGHT / CELL;

export const ROUTES = [
  [[-1,2],[3,2],[3,4],[7,4],[7,2],[12,2],[12,5],[18,5],[20,5]],
  [[-1,9],[3,9],[3,7],[7,7],[7,9],[12,9],[12,5],[18,5],[20,5]]
];
export const RUINS = [[1,4],[2,4],[5,0],[5,10],[9,0],[10,7],[10,10],[15,2],[15,8],[17,10],[18,1],[1,6]];
export const DIFFICULTIES = {
  easy:{label:"정찰",hp:.83,speed:.92,credits:450,lives:25,score:1},
  normal:{label:"작전",hp:1,speed:1,credits:370,lives:20,score:1.5},
  hard:{label:"극한",hp:1.28,speed:1.13,credits:350,lives:15,score:2.3}
};

export const TOWERS = {
  pulse:{name:"펄스 캐논",sub:"빠른 단일 공격",cost:90,range:153,damage:18,interval:.55,speed:650,color:"#65f4d5",key:"1"},
  frost:{name:"서리 방사기",sub:"광역 둔화",cost:125,range:148,damage:12,interval:1.28,speed:370,splash:62,slow:.48,color:"#75b4ff",key:"2"},
  rail:{name:"레일 스나이퍼",sub:"긴 사거리 · 관통",cost:175,range:245,damage:68,interval:1.68,pierce:3,color:"#ffcc77",key:"3"},
  arc:{name:"아크 코일",sub:"연쇄 번개",cost:205,range:171,damage:33,interval:1.18,chain:4,color:"#cc95ff",key:"4"}
};

export const ENEMIES = {
  drone:{name:"드론",hp:72,speed:67,bounty:12,damage:1,color:"#ef7b9b",size:12},
  dash:{name:"스프린터",hp:43,speed:114,bounty:11,damage:1,color:"#fbcd7a",size:10},
  shield:{name:"실드봇",hp:152,shield:82,speed:53,bounty:22,damage:2,color:"#7aabff",size:16},
  tank:{name:"중장갑",hp:320,armor:.30,speed:37,bounty:29,damage:3,color:"#ff9d77",size:20},
  split:{name:"분열체",hp:132,speed:72,bounty:21,damage:2,color:"#b5ee91",size:15},
  boss:{name:"공허 군주",hp:2000,shield:260,armor:.18,speed:35,bounty:230,damage:6,color:"#ed79ff",size:31}
};

export const CARDS = [
  {id:"damage",icon:"✦",name:"고출력 탄두",description:"모든 포탑 공격력 +15%",detail:"화력 강화",tone:"mint"},
  {id:"speed",icon:"⌁",name:"시간 가속기",description:"모든 포탑 공격 속도 +12%",detail:"연사력 강화",tone:"blue"},
  {id:"range",icon:"◎",name:"정밀 탐지",description:"모든 포탑 사거리 +10%",detail:"전장 통제",tone:"purple"},
  {id:"cash",icon:"◇",name:"긴급 보급",description:"즉시 160 크레딧 획득",detail:"경제 확장",tone:"amber"},
  {id:"repair",icon:"♥",name:"긴급 수리",description:"코어 내구도 +5 (최대 30)",detail:"생존 강화",tone:"rose"},
  {id:"shield",icon:"⬡",name:"에너지 장벽",description:"코어 보호막 +5",detail:"피해 흡수",tone:"blue"},
  {id:"bounty",icon:"◈",name:"잔해 회수",description:"적 처치 보상 +20%",detail:"경제 성장",tone:"amber"},
  {id:"freeze",icon:"❆",name:"극저온 촉매",description:"서리 포탑 둔화 효과 +12%",detail:"제어 강화",tone:"purple"},
  {id:"crit",icon:"✧",name:"약점 해석",description:"공격 시 12% 확률로 2배 피해",detail:"폭발 화력",tone:"rose"}
];

export function seeded(seed){
  let x = (Math.imul(seed ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
  return ()=>{ x ^= x<<13; x ^= x>>>17; x ^= x<<5; return (x>>>0)/4294967296; };
}
export function gridToPixel(x,y){return {x:x*CELL+CELL/2,y:y*CELL+CELL/2};}
export function routePoints(lane){return ROUTES[lane].map(p=>gridToPixel(p[0],p[1]));}
export function getRouteLength(lane){
  const pts=routePoints(lane); let len=0;
  for(let i=1;i<pts.length;i++)len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  return len;
}
export const ROUTE_LENGTHS=[getRouteLength(0),getRouteLength(1)];
export function routePosition(lane,dist){
  const pts=routePoints(lane);
  let left=Math.max(0,dist);
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],segment=Math.hypot(b.x-a.x,b.y-a.y);
    if(left<=segment)return{x:a.x+(b.x-a.x)*left/segment,y:a.y+(b.y-a.y)*left/segment,angle:Math.atan2(b.y-a.y,b.x-a.x)};
    left-=segment;
  }
  const b=pts[pts.length-1]; return {x:b.x,y:b.y,angle:0};
}
export function pathTiles(){
  const all=new Set();
  for(const route of ROUTES)for(let i=1;i<route.length;i++){
    let [x,y]=route[i-1];const [tx,ty]=route[i];
    const sx=Math.sign(tx-x),sy=Math.sign(ty-y);
    while(x!==tx||y!==ty){
      if(x>=0&&x<COLS&&y>=0&&y<ROWS)all.add(x+","+y);
      x+=sx;y+=sy;
    }
    if(tx>=0&&tx<COLS&&ty>=0&&ty<ROWS)all.add(tx+","+ty);
  }
  return all;
}
export const PATH_TILES=pathTiles();
export const RUIN_TILES=new Set(RUINS.map(p=>p[0]+","+p[1]));
export function canBuild(x,y,towers=[]){
  const key=x+","+y;
  return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<COLS&&y>=0&&y<ROWS
    &&!PATH_TILES.has(key)&&!RUIN_TILES.has(key)
    &&!towers.some(t=>t.gx===x&&t.gy===y);
}
export function upgradePrice(type,level){
  if(level>=4)return null;
  return Math.round(TOWERS[type].cost*(.55+level*.50)/5)*5;
}
export function sellValue(type,level){
  let total=TOWERS[type].cost;
  for(let i=1;i<level;i++)total+=upgradePrice(type,i);
  return Math.round(total*.65);
}
export function wavePlan(wave){
  const rand=seeded(9000+wave*3571);
  const count=7+wave*3;
  const spacing=Math.max(.29,.90-wave*.027);
  const spawns=[];
  for(let i=0;i<count;i++){
    const p=rand();let type="drone";
    if(wave>=2&&p<.25)type="dash";
    if(wave>=3&&p>.71)type="shield";
    if(wave>=5&&p>.84)type="tank";
    if(wave>=6&&p>.50&&p<.64)type="split";
    if(wave>=9&&p<.19)type="tank";
    spawns.push({at:i*spacing,type,lane:((i+Math.floor(i/4)+wave)%2)});
  }
  if(wave%5===0)spawns.push({at:count*spacing+2.0,type:"boss",lane:wave%2});
  return {spawns,duration:count*spacing+3,boss:wave%5===0};
}
export function cardChoices(wave){
  const rand=seeded(3401+wave*113);
  const arr=[...CARDS];
  for(let i=arr.length-1;i>0;i--){let j=Math.floor(rand()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr.slice(0,3);
}
export function defaultBoosts(){
  return {damage:1,speed:1,range:1,bounty:1,freeze:0,crit:0};
}
export function applyCard(state,id){
  const b=state.boosts;
  switch(id){
    case "damage":b.damage*=1.15;break;
    case "speed":b.speed*=1.12;break;
    case "range":b.range*=1.10;break;
    case "bounty":b.bounty+=.20;break;
    case "freeze":b.freeze+=.12;break;
    case "crit":b.crit+=.12;break;
    case "cash":state.credits+=160;break;
    case "repair":state.lives=Math.min(30,state.lives+5);break;
    case "shield":state.shield+=5;break;
    default:throw new Error("Unknown protocol card");
  }
}
export function formatNumber(n){return Math.round(n).toLocaleString("ko-KR");}
