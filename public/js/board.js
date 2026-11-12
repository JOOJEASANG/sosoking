import {TILES, TEAMS, tide} from './rules.js';

const WATER = ['#9bcfc1','#bfe0cf','#77b8ac','#afd8cb'];
const LAND = ['#eac18c','#a9cbb6','#e8b8a3','#aabdcf','#d6c5a1','#adc9a6','#c9bbd5','#e7cb9e',
  '#e4b193','#a9cdce','#edc291','#ccbada','#accbc2','#daa988','#b1c8b9','#d5ba9c'];
const MONUMENTS = {0:'post',4:'warehouse',8:'light',12:'bottle'};
const positions = Array.from({length:16},(_,i) => i < 4 ? [-2+i,2] : i < 8 ? [2,6-i] : i < 12 ? [10-i,-2] : [-2,i-14]);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function tint(hex,amount) {
  const c = parseInt(hex.slice(1),16);
  const ch = shift => Math.max(0,Math.min(255,((c>>shift)&255)+amount));
  return 'rgb('+[ch(16),ch(8),ch(0)].join(',')+')';
}

export class Board {
  constructor(canvas,onTile) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.onTile=onTile; this.rotation=0;
    this.hover=null; this.hit=[]; this.frame=0; this.state=null; this.me=null; this.animation=null; this.seen=0;
    this.art=new Image(); this.art.onload=()=>this.paint(); this.art.src=new URL('../art/post-island.webp',import.meta.url);
    this.resize=new ResizeObserver(()=>this.paint()); this.resize.observe(canvas);
    this.click = event => {
      const rect=canvas.getBoundingClientRect(), x=event.clientX-rect.left, y=event.clientY-rect.top;
      const hit = [...this.hit].reverse().find(p => Math.abs(x-p.x)/p.w + Math.abs(y-p.y)/p.h < 1.14);
      if(hit) onTile(hit.i);
    };
    canvas.addEventListener('click',this.click);
  }
  stop() { cancelAnimationFrame(this.frame); this.resize.disconnect(); this.canvas.removeEventListener('click',this.click); this.art.onload=null; }
  rotate() { this.rotation=(this.rotation+1)%4; this.paint(); }
  highlight(path) { this.hover=path||null; this.paint(); }
  update(g,me) {
    const m=g.move;
    if(m && this.state && this.seen!==m.turn && !reduced) {
      this.animation={m,start:performance.now(),duration:Math.min(1600,360+m.path.length*150)};
    }
    if(m) this.seen=m.turn;
    this.state=g; this.me=me; this.paint();
  }
  paint() {
    cancelAnimationFrame(this.frame);
    const canvas=this.canvas, c=this.ctx;
    const w=canvas.clientWidth, h=canvas.clientHeight;
    if(!this.state || !w || !h || !c) return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr) || canvas.height!==Math.round(h*dpr)) {
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    }
    c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h);
    const u=Math.min(w/10.9,h/6.35), cx=w/2, cy=h*.53, angle=this.rotation*Math.PI/2, cc=Math.cos(angle), ss=Math.sin(angle);
    function view(x,z) {return [x*cc-z*ss,x*ss+z*cc];}
    function iso(x,z,y=0) {const [a,b]=view(x,z);return [cx+(a-b)*u,cy+((a+b)*.49-y)*u];}
    function poly(pts,fill,stroke,lineWidth=1) {
      c.beginPath(); pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath();
      if(fill) {c.fillStyle=fill; c.fill();}
      if(stroke) {c.strokeStyle=stroke;c.lineWidth=lineWidth;c.stroke();}
    }
    function face(v,fill,stroke,lineWidth) {poly(v.map(p=>iso(...p)),fill,stroke,lineWidth);}
    function square(x,z,dx,dz,low,height,color,high=color) {
      const bounds=[[x-dx,z-dz],[x+dx,z-dz],[x+dx,z+dz],[x-dx,z+dz]];
      const edges=bounds.map((p,i)=>[p,bounds[(i+1)%4]]).sort((e,f)=> {
        const dep=k=>k.reduce((s,[x,z])=>s+view(x,z).reduce((a,b)=>a+b),0);return dep(e)-dep(f);
      });
      edges.forEach(([p,q])=>{
        const a=iso(...p,low), b=iso(...q,low);
        poly([a,b,iso(...q,height),iso(...p,height)],tint(color,(a[0]+b[0])/2>iso(x,z)[0]?-27:-43));
      });
      face(bounds.map(p=>[...p,height]),high);
    }
    function ellipse(x,y,rx,ry,fill) {c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
    function line(x1,y1,x2,y2,color,width) {c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
    function ridge(x,z,dx,dz,low,peak,col) {
      const v=[[x-dx,z-dz,low],[x+dx,z-dz,low],[x+dx,z+dz,low],[x-dx,z+dz,low]],top=[x,z,peak];
      const order=[0,1,2,3].sort((a,b)=>iso(...v[a])[1]+iso(...v[(a+1)%4])[1]-iso(...v[b])[1]-iso(...v[(b+1)%4])[1]);
      order.forEach(i=>face([v[i],v[(i+1)%4],top],tint(col,[-8,10,-18,5][i])));
    }
    function tower(x,z,base=.23,scale=1) {
      const q=(r,lo,hi,col)=>square(x,z,r*scale,r*scale,base+lo*scale,base+hi*scale,col);
      q(.15,0,.26,'#fff0c8');q(.125,.26,.43,'#ce6d4e');q(.115,.43,.62,'#f3dfac');q(.16,.62,.67,'#3c6966');
      q(.09,.67,.79,'#f9c85e');ridge(x,z,.17*scale,.17*scale,base+.79*scale,base+1*scale,'#be5945');
    }
    function house(x,z,roof,level=1) {
      const base=.23; square(x,z,.21,.18,base,base+.27,'#efd3a4');
      ridge(x,z,.27,.235,base+.27,base+.52,roof);
      const [a,b]=iso(x,z,base+.15); ellipse(a,b,.035*u,.045*u,'#385c58');
      if(level===2) tower(x+.17,z-.13,base+.22,.63);
    }
    function tree(x,z,base=.22) {
      square(x,z,.038,.038,base,base+.19,'#927b53');
      ridge(x,z,.18,.17,base+.12,base+.51,'#538971');ridge(x,z,.13,.13,base+.27,base+.60,'#709b75');
    }
    function islandMini(i,x,z) {
      const [a,b]=iso(x,z,.22);
      const blob=(dx,dy,rx,ry,col)=>ellipse(a+dx*u,b+dy*u,rx*u,ry*u,col);
      const stroke=(x1,y1,x2,y2,col,weight)=>line(a+x1*u,b+y1*u,a+x2*u,b+y2*u,col,u*weight);
      const shape=(pts,col,edge)=>poly(pts.map(([dx,dy])=>[a+u*dx,b+u*dy]),col,edge,u*.013);
      blob(0,.055,.29,.075,'rgba(57,84,66,.18)');
      if(i===1||i===11) {
        const cols=i===1?['#658653','#809851','#eaa050']:['#698e70','#a68abb','#c4a5d0'];
        for(const [dx,dy,k] of [[-.12,-.045,.8],[.09,.005,1]]) {
          stroke(dx,dy,dx,dy-.24*k,'#8f7550',.045);
          blob(dx,dy-.26*k,.145*k,.17*k,cols[0]);blob(dx-.02,dy-.30*k,.128*k,.135*k,cols[1]);
          for(const [cx,cy] of [[-.061,-.30],[.046,-.277],[-.012,-.37]])blob(dx+cx*k,dy+cy*k,.028*k,.03*k,cols[2]);
        }
      } else if(i===2) {
        shape([[-.22,0],[-.28,-.11],[-.24,-.22],[-.15,-.26],[-.10,-.32],[0,-.31],[.10,-.32],[.16,-.24],[.23,-.21],[.25,-.1],[.15,.02],[0,.055]],'#f0c2ac','#ba877e');
        for(const dx of [-.2,-.11,0,.11,.2])stroke(-.01,.015,dx,-.23+Math.abs(dx)*.2,'#c58c85',.014);
      } else if(i===3) {
        square(x,z,.205,.16,.21,.44,'#f4d0aa');ridge(x,z,.27,.22,.44,.65,'#a75e54');
        blob(0,-.13,.075,.07,'#57786e');stroke(-.13,-.17,-.09,-.17,'#f0c783',.04);
      } else if(i===6) {
        for(const [dx,dy,col] of [[-.15,-.14,'#e9a2a3'],[.02,-.32,'#dc877a'],[.14,-.19,'#efc86f']]){
          stroke(dx*.6,.035,dx,dy,'#538267',.028);
          for(let j=0;j<5;j++)blob(dx+Math.cos(j*1.256)*.044,dy+Math.sin(j*1.256)*.044,.039,.037,col);
          blob(dx,dy,.035,.033,'#e7bb5c');
        }
      } else if(i===7||i===14) {
        const col=i===7?'#a6c9b7':'#e9d0a9';
        blob(0,.028,.26,.07,'#e9d6ad');blob(.13,-.10,.095,.08,'#a4815d');blob(.14,-.10,.052,.044,'#e1ceac');
        shape([[-.18,-.18],[.15,-.18],[.11,-.015],[.02,.025],[-.09,0]],col,'#a68967');
        blob(-.015,-.18,.165,.058,col);blob(-.016,-.178,.124,.036,i===7?'#799063':'#87644f');
        stroke(-.06,-.27,-.045,-.355,'#faf0d3',.02);
      } else if(i===9) {
        square(x,z,.19,.17,.205,.43,'#a7c6c3');ridge(x,z,.23,.21,.43,.7,'#99cbd0');
        stroke(-.12,-.24,-.055,-.37,'#e1ece0',.026);
      } else if(i===10) {
        square(x,z,.20,.15,.20,.36,'#bf9765');
        for(const dx of [-.17,.17])square(x+dx,z,.021,.032,.34,.56,'#9d815c');
        for(let j=0;j<5;j++)square(x-.19+j*.079,z,.041,.207,.53,.58,j%2?'#f0d3a3':'#d28a64');
        blob(-.08,-.08,.054,.05,'#e1ac53');blob(.025,-.07,.044,.045,'#9a9f5c');
      } else if(i===13) {
        blob(-.02,-.115,.235,.17,'#c2835e');blob(-.045,-.145,.202,.142,'#dfac7c');
        blob(-.02,-.055,.108,.1,'#a17150');blob(-.02,-.033,.078,.073,'#675d4b');
        blob(.12,-.01,.105,.051,'#ecc179');stroke(.07,-.04,.10,-.06,'#ad8559',.015);
      } else if(i===15) {
        const pts=[];for(let j=0;j<10;j++){const k=j%2?.105:.218,ang=-Math.PI/2+j*Math.PI/5;pts.push([Math.cos(ang)*k,Math.sin(ang)*k*.83-.115]);}
        shape(pts,'#ebbc65','#bb8b4a');blob(.19,0,.07,.034,'#f4dca5');
      }
    }
    function boat(x,z,seat,jump=0) {
      const [a,b]=iso(x,z,.29+jump), sz=u*.34, t=TEAMS[seat];
      ellipse(a,b+sz*.14,sz*.78,sz*.23,'rgba(43,74,63,.25)');
      poly([[a-sz*.82,b-sz*.03],[a+sz*.78,b-sz*.03],[a+sz*.44,b+sz*.32],[a-sz*.43,b+sz*.28]],'#714f3c');
      poly([[a-sz*.8,b-sz*.05],[a+sz*.79,b-sz*.05],[a+sz*.54,b+sz*.07],[a-sz*.62,b+sz*.11]],'#f4c681');
      line(a,b-sz*.98,a,b-sz*.08,'#594c3d',Math.max(1,sz*.08));
      poly([[a-sz*.09,b-sz*.95],[a-sz*.09,b-sz*.12],[a-sz*.65,b-sz*.16]],t.color);
      poly([[a+sz*.05,b-sz*.75],[a+sz*.54,b-sz*.16],[a+sz*.05,b-sz*.12]],'#fff5d9');
      poly([[a,b-sz*1.04],[a+sz*.43,b-sz*.95],[a,b-sz*.83]],t.color);
    }
    // A wooden, bevelled base and an inlaid water surface keep perspective consistent at every rotation.
    ellipse(cx,cy+u*.47,u*5.0,u*2.37,'rgba(45,75,62,.10)');
    square(0,0,2.53,2.53,-.34,-.21,'#987453','#d7ad74');
    square(0,0,2.51,2.51,-.21,-.12,'#dbb783','#eed3a0');
    square(0,0,2.49,2.49,-.12,-.03,'#62998d','#a0ccc0');
    for(let i=0;i<75;i++) {
      const x=(((i*43)%97)/96-.5)*4.7,z=(((i*67+13)%101)/100-.5)*4.7, [a,b]=iso(x,z,-.015);
      line(a-u*.055,b,a+u*(i%3===0?.10:.05),b-u*.016,WATER[i%4],Math.max(1,u*.016));
    }
    const g=this.state, self=g.players.find(p=>p.id===this.me), goal=self?.destination;
    const current=g.players[g.active]; let drawnPlayers=[];
    const anim=this.animation, pMove=anim && Math.min(1,(performance.now()-anim.start)/anim.duration);
    if(anim && pMove>=1) this.animation=null;
    for(const p of g.players.filter(p=>!p.out)) {
      let [x,z]=positions[p.pos],jump=0;
      if(anim && pMove<1 && p.id===anim.m.player) {
        const path=[anim.m.from,...anim.m.path], t=Math.max(0,pMove)*(path.length-1),idx=Math.min(path.length-2,Math.floor(t)),f=t-idx;
        [x,z]=positions[path[idx]].map((n,k)=>n+(positions[path[idx+1]][k]-n)*f);
        jump=Math.sin(f*Math.PI)*.105;
      }
      const offsets=[[-.17,.18],[.18,.18],[-.17,-.15],[.18,-.15]];
      const [dx,dz]=offsets[p.seat]; drawnPlayers.push({x:x+dx,z:z+dz,seat:p.seat,jump,key:view(x,z).reduce((a,b)=>a+b)+.30});
    }
    const objects=positions.map(([x,z],i)=>({type:'tile',x,z,i,key:view(x,z).reduce((a,b)=>a+b)}));
    objects.push({type:'island',key:-.1});objects.push(...drawnPlayers.map(p=>({...p,type:'boat'})));objects.sort((a,b)=>a.key-b.key);
    this.hit=[];
    for(const obj of objects) {
      const {type,x,z,i}=obj;
      if(type==='boat') {boat(x,z,obj.seat,obj.jump);continue;}
      if(type==='island') {
        if(this.art.complete && this.art.naturalWidth) {
          const width=u*2.95, height=width*this.art.naturalHeight/this.art.naturalWidth;
          c.drawImage(this.art,cx-width/2,cy+u*.57-height,width,height);
        } else {square(0,0,.65,.62,0,.24,'#a99c71','#98b48d');house(-.05,0,'#c16a4c');tree(.35,-.2);}
        continue;
      }
      const off=g.offices[i], team=off&&g.players.find(p=>p.id===off.owner);
      const pal=team ? TEAMS[team.seat].light : LAND[i];
      square(x,z,.473,.473,-.01,.17,pal);
      const bounds=([n,y])=>[[-n,-n],[n,-n],[n,n],[-n,n]].map(([a,b])=>iso(x+a,z+b,y));
      poly(bounds([.42,.174]),null,'rgba(255,251,223,.62)',Math.max(1,u*.014));
      if(this.hover?.includes(i)) poly(bounds([.395,.179]),'rgba(250,213,105,.48)','#a97a35',Math.max(1,u*.033));
      if(i===goal && g.phase!=='finished') poly(bounds([.445,.183]),null,'#ad512c',Math.max(1.7,u*.048));
      const [a,b]=iso(x,z,.19), special=MONUMENTS[i];
      this.hit.push({i,x:a,y:b,w:u*.94,h:u*.46});
      if(off && team) house(x,z,TEAMS[team.seat].color,off.level);
      else if(special==='light') tower(x,z,.19,.87);
      else if(special==='post') house(x,z,'#bb6750');
      else if(special==='warehouse') {square(x,z,.20,.17,.19,.39,'#d8a757');ridge(x,z,.26,.20,.39,.55,'#557e79');}
      else if(special==='bottle') {
        square(x,z,.095,.10,.19,.43,'#6b9c8e');square(x,z,.048,.06,.43,.53,'#8dbab0');square(x,z,.05,.063,.53,.57,'#b79465');
      } else if(i===5) {tree(x,z);tree(x+.19,z-.11,.19);}
      else islandMini(i,x,z);
      const nx=a,ny=b+u*.241, fullLabel=w>=560;
      c.font='700 '+Math.max(fullLabel?10:9,Math.min(13,u*(fullLabel?.15:.19)))+'px system-ui,sans-serif';
      c.textAlign='center';c.textBaseline='middle';
      c.fillStyle='#354c41';c.fillText(fullLabel?TILES[i].name:String(i).padStart(2,'0'),nx,ny,u*1.19);
      if(i===goal && g.phase!=='finished') {
        const flagX=a+u*.25,flagY=b-u*.18;
        line(flagX,flagY+u*.10,flagX,flagY-u*.42,'#864428',Math.max(1,u*.026));
        poly([[flagX,flagY-u*.43],[flagX+u*.36,flagY-u*.43],[flagX+u*.36,flagY-u*.215],[flagX,flagY-u*.215]],'#fff4cd','#9b5738',1);
        line(flagX+u*.025,flagY-u*.41,flagX+u*.18,flagY-u*.30,'#a76442',.9);
        line(flagX+u*.18,flagY-u*.30,flagX+u*.335,flagY-u*.41,'#a76442',.9);
      }
    }
    if(current && !anim && g.phase!=='finished') {
      const [x,z]=positions[current.pos], [a,b]=iso(x,z,.18);
      poly([[a,b+u*.38],[a+u*.07,b+u*.31],[a-u*.07,b+u*.31]],TEAMS[current.seat].color);
    }
    if(this.animation) this.frame=requestAnimationFrame(()=>this.paint());
  }
}
