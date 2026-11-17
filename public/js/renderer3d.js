import * as THREE from "three";
import {WIDTH,HEIGHT,CELL,COLS,ROWS,ROUTES,RUINS,PATH_TILES,TOWERS,ENEMIES,canBuild} from "./rules.js";

// Physical 3-D battlefield. Game simulation stays independent of rendering and hit testing.
// Scale: 50 source pixels = 1 world unit. Source Y maps to world Z.
const UNIT=50, worldX=x=>x/UNIT-10, worldZ=y=>y/UNIT-6;
const num=v=>Math.max(0,Math.min(1,v));
const colors={pulse:0x42f5cb,frost:0x73b8ff,rail:0xffc376,arc:0xc294ff};
const scratch=new THREE.Vector3();
const material=(c,m=.63,r=.40,e=0,ei=0)=>new THREE.MeshStandardMaterial({
 color:c,metalness:m,roughness:r,emissive:e,emissiveIntensity:ei
});
const M={
 hull:material(0x243c4d,.87,.31),
 edge:material(0x4d7184,.8,.27),
 black:material(0x0b1824,.72,.46),
 alloy:material(0x647d90,.92,.22),
 bright:material(0xc5e1ed,.79,.24),
 dark:material(0x142637,.8,.5),
 glass:material(0x1d4b59,.44,.12,0x174c5b,.38),
 gold:material(0x655745,.78,.3,0xf1b65e,.35),
 road:material(0x1a2834,.61,.72),
 path:material(0x213448,.52,.53),
 ground:material(0x152535,.68,.65),
 decal:material(0x35556a,.7,.34),
 mint:material(0x2a655a,.64,.37,0x41eac1,.5),
 crystal:material(0x47b69d,.32,.12,0x3cffc0,1.7),
 purple:material(0x5e4395,.35,.2,0xa961ff,1.1)
};
const C=(color,intensity=1)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,metalness:.36,roughness:.22});
const brightMat=new THREE.MeshBasicMaterial({color:0xe6fff6});
const boxGeo=new THREE.BoxGeometry(1,1,1);
const cyl=(r1,r2,h,seg=8)=>new THREE.CylinderGeometry(r1,r2,h,seg);
const sphere=(r,seg=12)=>new THREE.SphereGeometry(r,seg,8);
const plane=(w,h)=>new THREE.PlaneGeometry(w,h);
function hash(a,b=1){let t=(Math.imul((a|0)+1442695041,(b|0)+1013904223))>>>0;t^=t<<13;t^=t>>>17;t^=t<<5;return (t>>>0)/4294967296;}
function object(parent,geo,mat,x=0,y=0,z=0,rotX=0,rotY=0,rotZ=0){
 const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.rotation.set(rotX,rotY,rotZ);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function box(parent,mat,x,y,z,w,h,d){
 const m=object(parent,boxGeo,mat,x,y,z);m.scale.set(w,h,d);return m;
}
function ring(parent,mat,r,tube,y,segments=42){
 const m=object(parent,new THREE.TorusGeometry(r,tube,7,segments),mat,0,y,0,Math.PI/2);
 return m;
}
function glowSprite(color,size,opacity=.6){
 const canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;
 const c=canvas.getContext("2d");const g=c.createRadialGradient(32,32,0,32,32,31);
 g.addColorStop(0,"rgba(255,255,255,.98)");
 g.addColorStop(.20,"rgba(255,255,255,.6)");
 g.addColorStop(1,"rgba(255,255,255,0)");
 c.fillStyle=g;c.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(canvas);
 const mat=new THREE.SpriteMaterial({map:texture,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
 const spr=new THREE.Sprite(mat);spr.scale.set(size,size,size);return spr;
}
function shrinkSafe(v){return Math.max(0.01,v);}
function disposeTree(group){
 group.traverse(o=>{if(o.geometry)o.geometry.dispose();});
 if(group.parent)group.parent.remove(group);
}
function towerModel(type,level=1){
 const root=new THREE.Group();
 const accent=C(colors[type],.8);
 const hot=C(colors[type],1.65);
 const scale=1+(level-1)*.10;
 root.scale.setScalar(scale);
 const shadow=object(root,new THREE.CircleGeometry(.53,20),
  new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.27,depthWrite:false}),0,.012,0,-Math.PI/2);
 shadow.castShadow=false;
 object(root,cyl(.43,.49,.24,8),M.black,0,.18,0);
 object(root,cyl(.38,.38,.09,8),M.edge,0,.33,0);
 object(root,cyl(.315,.32,.15,8),M.hull,0,.39,0);
 ring(root,accent,.34,.022,.365);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2;
  box(root,M.alloy,Math.sin(a)*.31,.30,Math.cos(a)*.31,.10,.13,.14);
 }
 const swivel=new THREE.Group();swivel.position.y=.54;root.add(swivel);
 object(swivel,cyl(.29,.3,.21,8),M.hull,0,0,0);
 object(swivel,cyl(.25,.25,.08,8),M.edge,0,.12,0);
 if(type==="pulse"){
  box(swivel,M.hull,-.03,.14,0,.51,.21,.48);
  for(const z of [-.16,.16]){
   box(swivel,M.alloy,.29,.15,z,.54,.125,.11);
   box(swivel,hot,.59,.15,z,.08,.08,.07);
  }
  box(swivel,accent,-.08,.26,0,.22,.07,.20);
 }
 if(type==="frost"){
  object(swivel,sphere(.29,16),M.hull,0,.20,0);
  object(swivel,sphere(.19,16),hot,0,.22,0);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   const spike=object(swivel,cyl(.015,.075,.29,6),M.bright,Math.cos(a)*.20,.23,Math.sin(a)*.20);
   spike.rotation.z=-Math.cos(a)*.72;spike.rotation.x=Math.sin(a)*.72;
  }
  object(swivel,new THREE.TorusGeometry(.24,.028,6,30),accent,.09,.20,0,0,Math.PI/2);
 }
 if(type==="rail"){
  box(swivel,M.hull,-.08,.13,0,.57,.29,.32);
  box(swivel,M.alloy,.39,.12,0,.87,.12,.16);
  box(swivel,M.black,.44,.20,0,.62,.05,.16);
  box(swivel,hot,.86,.12,0,.12,.095,.105);
  box(swivel,M.alloy,-.10,.35,0,.26,.07,.30);
  for(const z of [-.17,.17])box(swivel,accent,.18,.20,z,.30,.055,.04);
 }
 if(type==="arc"){
  object(swivel,sphere(.28,14),M.hull,0,.16,0);
  object(swivel,sphere(.17,12),hot,0,.18,0);
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3;
   const x=Math.cos(a)*.24,z=Math.sin(a)*.24;
   box(swivel,M.alloy,x,.25,z,.12,.47,.12);
   object(swivel,sphere(.074,10),hot,x,.54,z);
  }
  const coil=ring(swivel,accent,.20,.025,.22);
  coil.rotation.x=Math.PI/2;
 }
 if(level>=2){
  for(let i=0;i<level-1;i++){
   const a=Math.PI*2*(i+1)/4;
   object(root,cyl(.065,.065,.08,6),hot,Math.cos(a)*.40,.41,Math.sin(a)*.40);
  }
 }
 const led=glowSprite(colors[type],.7,.40);led.position.set(0,.70,0);root.add(led);
 root.userData={swivel,led,hot,accent};
 return root;
}
function enemyModel(e){
 const root=new THREE.Group(),kind=e.kind;
 const accent=C(Number("0x"+ENEMIES[kind].color.slice(1)),1.0);
 const shell=kind==="boss"?material(0x463354,.75,.37):kind==="tank"?material(0x514444,.83,.38):M.hull;
 const s=Math.max(.54,ENEMIES[kind].size/17)*(e.mini?.65:1);
 root.scale.setScalar(s);
 const body=new THREE.Group();root.add(body);
 const shadow=object(root,new THREE.CircleGeometry(.50,24),
  new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false}),0,.018,0,-Math.PI/2);
 shadow.castShadow=false;
 object(body,cyl(.33,.43,.26,6),shell,0,.37,0);
 box(body,M.edge,-.12,.49,0,.60,.25,.48);
 box(body,accent,.21,.51,0,.13,.13,.24);
 for(const side of [-1,1]){
  box(body,shell,-.10,.22,side*.37,.49,.30,.17);
  box(body,M.black,.07,.18,side*.39,.26,.19,.20);
  box(body,accent,.17,.30,side*.39,.13,.07,.14);
 }
 if(kind==="dash"){
  box(body,M.edge,.05,.54,0,.78,.15,.28);
  for(const side of [-1,1]){
   const wing=box(body,accent,-.07,.47,side*.45,.50,.065,.27);
   wing.rotation.y=side*.40;
  }
 }
 if(kind==="shield"){
  object(body,sphere(.26,14),accent,.12,.72,0);
  for(const side of [-1,1])box(body,M.alloy,-.23,.42,side*.43,.28,.52,.13);
 }
 if(kind==="tank"){
  box(body,M.edge,-.07,.67,0,.82,.32,.66);
  box(body,shell,-.29,.79,0,.50,.20,.60);
  object(body,cyl(.12,.12,.65,10),M.alloy,.36,.79,0,0,0,Math.PI/2);
 }
 if(kind==="split"){
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3;
   const shard=object(body,new THREE.OctahedronGeometry(.22),accent,Math.cos(a)*.34,.72,Math.sin(a)*.34);
   shard.rotation.z=a;
  }
 }
 if(kind==="boss"){
  object(body,cyl(.74,.84,.58,8),shell,-.02,.55,0);
  object(body,new THREE.IcosahedronGeometry(.56,1),M.purple,0,1.13,0);
  object(body,new THREE.IcosahedronGeometry(.27,0),C(0xffb3ff,1.6),0,1.13,0);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   const pillar=object(body,cyl(.07,.21,.74,6),M.alloy,Math.cos(a)*.69,.84,Math.sin(a)*.69);
   pillar.rotation.z=Math.sin(a)*.20;pillar.rotation.x=Math.cos(a)*.20;
   object(body,sphere(.10,8),accent,Math.cos(a)*.71,1.24,Math.sin(a)*.71);
  }
  for(const side of [-1,1])box(body,M.black,-.25,.3,side*.85,.60,.35,.30);
 }
 const eye=glowSprite(Number("0x"+ENEMIES[kind].color.slice(1)),.62,.55);eye.position.set(.33,.60,0);body.add(eye);
 const shield=new THREE.Group();
 const shieldMat=new THREE.MeshBasicMaterial({color:0x4caeff,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide});
 const dome=object(shield,new THREE.SphereGeometry(.67,28,16),shieldMat,0,.58,0);dome.castShadow=false;
 const shellRing=ring(shield,new THREE.MeshBasicMaterial({color:0x6abaff,transparent:true,opacity:.7}),.60,.015,.56);
 shield.add(glowSprite(0x3a9fff,1.7,.1));
 root.add(shield);
 const bar=new THREE.Group();bar.position.set(0,kind==="boss"?2.06:1.18,0);root.add(bar);
 const backing=box(bar,new THREE.MeshBasicMaterial({color:0x060a12,transparent:true,opacity:.80,depthTest:false}),0,.01,0,.96,.092,.08);
 const fill=box(bar,new THREE.MeshBasicMaterial({color:0x55e6ae,depthTest:false}),0,.01,.046,.94,.068,.012);
 const shieldFill=box(bar,new THREE.MeshBasicMaterial({color:0x55aeff,depthTest:false}),0,-.08,.05,.94,.04,.012);
 // Face the bar toward the camera.
 bar.rotation.y=-.4;
 root.userData={body,shield,bar,fill,shieldFill};
 return root;
}
function roadModel(root,ctx,strokeWidth,glow=false){
 const points=ctx.map(([x,y])=>new THREE.Vector3(worldX(x*CELL+CELL/2),.016,worldZ(y*CELL+CELL/2)));
 const curve=new THREE.CatmullRomCurve3(points,false,"centripetal");
 const geometry=new THREE.TubeGeometry(curve,points.length*10,strokeWidth,6,false);
 const mesh=new THREE.Mesh(geometry,glow?C(0x45bbaa,.55):M.road);
 root.add(mesh);
}
export function createBattle3D(canvas){
 // No WebGL context available in test, restricted WebViews or older browsers: keep 2-D fallback.
 if(typeof window==="undefined"||!window.WebGLRenderingContext)return null;
 let renderer;
 try{renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:"high-performance"});}
 catch(err){return null;}
 const stage=canvas.parentElement;
 if(!stage){renderer.dispose();return null;}
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x07101a);
 scene.fog=new THREE.FogExp2(0x07121d,.015);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<760?1.2:1.6));
 renderer.setSize(1000,600,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.65;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.className="battle-3d";
 renderer.domElement.setAttribute("aria-hidden","true");
 renderer.domElement.style.cssText="position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none;";
 stage.appendChild(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-14.4,14.4,8.64,-8.64,.1,180);
 camera.position.set(10,19,23);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
 const raycaster=new THREE.Raycaster(),planePick=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 scene.add(new THREE.HemisphereLight(0x90cbee,0x161826,2.2));
 const ambient=new THREE.AmbientLight(0x667da4,.85);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xcbeaff,4.3);
 sun.position.set(-8,20,10);sun.castShadow=true;
 sun.shadow.mapSize.set(window.innerWidth<760?512:1024,window.innerWidth<760?512:1024);sun.shadow.camera.left=-17;sun.shadow.camera.right=17;
 sun.shadow.camera.top=14;sun.shadow.camera.bottom=-14;
 sun.shadow.camera.near=1;sun.shadow.camera.far=55;
 sun.shadow.bias=-.002;sun.shadow.normalBias=.02;scene.add(sun);
 const warm=new THREE.PointLight(0xffb86f,21,12,2);warm.position.set(-9,4,-3);scene.add(warm);
 const cool=new THREE.PointLight(0x72d6ff,14,12,2);cool.position.set(7,3,1);scene.add(cool);
 const battlefield=new THREE.Group();scene.add(battlefield);
 const border=box(battlefield,M.black,0,-.64,0,21.2,1.0,13.2);
 border.castShadow=false;
 box(battlefield,M.edge,0,-.15,0,20.35,.06,12.36);
 for(let gx=0;gx<COLS;gx++)for(let gy=0;gy<ROWS;gy++){
  const key=gx+","+gy,road=PATH_TILES.has(key);
  const r=hash(gx+1,gy+19);
  const mat=road?M.road:r>.84?M.dark:M.ground;
  const tile=box(battlefield,mat,gx-9.5,-.07,gy-5.5,.975,.12,.975);
  tile.receiveShadow=true;
  if(!road&&r>.62){
   const d=box(battlefield,M.decal,gx-9.5,-.001,gy-5.5,.81,.008,.03);
   d.rotation.y=Math.PI/2*(gx%2);
  }
  if(road){
   if(r>.72)box(battlefield,M.decal,gx-9.5,.007,gy-5.5,.32,.007,.045);
   if(gx%4===0&&gy%3===0)box(battlefield,C(0x427a7e,.17),gx-9.5,.017,gy-5.09,.18,.01,.025);
  }else if(r>.86&&!RUINS.some(p=>p[0]===gx&&p[1]===gy)){
   const a=object(battlefield,cyl(.16,.17,.07,8),M.black,gx-9.5,.04,gy-5.5);
   const b=object(battlefield,cyl(.11,.12,.075,8),r>.94?M.mint:M.edge,gx-9.5,.095,gy-5.5);
   a.receiveShadow=true;b.receiveShadow=true;
  }
 }
 // Military-industrial structures: the battlefield has recognizable depth, not flat squares.
 const hazard=material(0xf2b55b,.37,.45,0xd79027,.20);
 for(const [x,z] of RUINS){
  const grp=new THREE.Group();grp.position.set(x-9.5,0,z-5.5);battlefield.add(grp);
  const h=.22+hash(x,z)*.29;
  box(grp,M.black,0,h*.5,0,.86,h,.86);
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2;
   box(grp,M.alloy,Math.cos(a)*.38,h*.63,Math.sin(a)*.38,.10,h*.9,.10);
  }
  box(grp,M.edge,0,h+.025,0,.68,.055,.68);
  for(const off of [-.21,.21])box(grp,hazard,off,h+.059,.09,.12,.008,.30);
  if(hash(x+13,z)<.45){
   const vent=object(grp,cyl(.15,.15,.16,8),M.black,.0,h+.12,0);
   object(grp,cyl(.075,.075,.18,8),M.alloy,0,h+.27,0);
  }
 }
 // Outer perimeter, hangars and parallax structures.
 for(let n=0;n<18;n++){
  const side=n%4, p=(n/18)*2*Math.PI;
  const x=side<2?((n*9)%24)-12:side===2?-11.4:11.4;
  const z=side<2?(side===0?-7.6:7.6):((n*7)%16)-8;
  const h=.75+hash(n,27)*2.8;
  const b=box(battlefield,n%3===0?M.edge:M.dark,x,h/2-.25,z,.55+hash(n,14)*.7,h,.65);
  box(battlefield,M.black,x,h-.12,z,.56,.14,.72);
  const top=box(battlefield,n%2?M.purple:M.mint,x,h+.03,z,.09,.055,.46);
  top.castShadow=false;
 }
 for(const z of [-6.32,6.32]){
  box(battlefield,M.black,0,-.1,z,21.5,.35,.20);
  for(let i=-10;i<=10;i+=2){
   box(battlefield,M.edge,i,.17,z,.14,.32,.18);
   box(battlefield,M.mint,i,.35,z,.08,.04,.09);
  }
 }
 for(const x of [-10.5,10.5])box(battlefield,M.black,x,-.15,0,.2,.32,12.8);
 // Two animated rift portals.
 const portals=[];
 for(let i=0;i<2;i++){
  const portal=new THREE.Group();
  portal.position.set(worldX(0),.55,worldZ(i?9*CELL+25:2*CELL+25));battlefield.add(portal);
  const col=i?0xb281ff:0x4cf4d4;
  const pMat=C(col,1.8);
  const support=box(portal,M.black,0,-.07,0,.38,.45,1.18);
  const ringA=object(portal,new THREE.TorusGeometry(.61,.07,10,46),pMat,.12,.60,0,0,Math.PI/2,0);
  ringA.rotation.y=Math.PI/2;
  const ringB=object(portal,new THREE.TorusGeometry(.44,.027,8,36),C(col,2.3),.12,.60,0,0,Math.PI/2,0);
  ringB.rotation.y=Math.PI/2;
  const core=object(portal,new THREE.SphereGeometry(.33,18,12),
   new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.45,depthWrite:false}),.12,.60,0);
  core.scale.x=.30;core.castShadow=false;
  portal.add(glowSprite(col,2.2,.42));portal.children.at(-1).position.set(.12,.65,0);
  for(let s of [-1,1]){
   box(portal,M.edge,0,.50,s*.72,.36,1.13,.24);
   box(portal,pMat,0,1.12,s*.72,.24,.12,.17);
  }
  const light=new THREE.PointLight(col,9,4,2);light.position.set(.17,.80,0);portal.add(light);
  portals.push({ringA,ringB,core,light});
 }
 // Reactor core: heavily modeled, with concentric animated containment rings.
 const reactor=new THREE.Group();reactor.position.set(worldX(925),0,worldZ(275));battlefield.add(reactor);
 object(reactor,cyl(.78,.92,.35,8),M.black,0,.12,0);
 object(reactor,cyl(.72,.76,.11,8),M.edge,0,.35,0);
 object(reactor,cyl(.54,.65,.55,8),M.hull,0,.67,0);
 object(reactor,cyl(.40,.42,.08,8),M.alloy,0,1.00,0);
 const core=object(reactor,new THREE.OctahedronGeometry(.48,0),M.crystal,0,1.50,0);
 const cage=[];
 for(let k=0;k<3;k++){
  const ob=object(reactor,new THREE.TorusGeometry(.80+k*.16,.032,6,60),k===1?M.mint:M.edge,0,1.5,0);
  ob.rotation.set(k===0?.23:k===1?1.2:.75,0,k*1.10);
  cage.push(ob);
 }
 const rLight=new THREE.PointLight(0x47ffd2,16,7,2);rLight.position.set(0,1.7,0);reactor.add(rLight);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2;
  box(reactor,M.edge,Math.cos(a)*.69,.58,Math.sin(a)*.69,.2,.80,.20);
  box(reactor,M.mint,Math.cos(a)*.69,1.04,Math.sin(a)*.69,.15,.09,.15);
 }
 const reactorHalo=glowSprite(0x4cffe1,3.9,.22);reactorHalo.position.set(0,1.6,0);reactor.add(reactorHalo);
 // Floating dust and embers enhance the sense of space.
 const dustGeometry=new THREE.BufferGeometry(),dustCount=140,coords=new Float32Array(dustCount*3);
 for(let i=0;i<dustCount;i++){
  coords[i*3]=(hash(i,3)-.5)*27;coords[i*3+1]=hash(i,4)*4+.4;coords[i*3+2]=(hash(i,5)-.5)*19;
 }
 dustGeometry.setAttribute("position",new THREE.BufferAttribute(coords,3));
 const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0x86cbd5,size:.045,transparent:true,opacity:.48,depthWrite:false}));
 scene.add(dust);
 const units=new Map(),towers=new Map();
 const bulletPool=[],beamPool=[];
 const rangeMat=new THREE.MeshBasicMaterial({color:0x4aebc2,transparent:true,opacity:.21,depthWrite:false,side:THREE.DoubleSide});
 const radiusRing=new THREE.Mesh(new THREE.RingGeometry(.98,1,90),rangeMat);
 radiusRing.rotation.x=-Math.PI/2;radiusRing.position.y=.028;radiusRing.visible=false;scene.add(radiusRing);
 const placement=new THREE.Group();scene.add(placement);
 const cellMesh=object(placement,new THREE.PlaneGeometry(.97,.97),new THREE.MeshBasicMaterial({color:0x6effd2,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}),0,.018,0,-Math.PI/2);
 cellMesh.castShadow=false;
 placement.visible=false;
 let ghost=null,ghostKey="";
 const ambientLine=object(scene,new THREE.RingGeometry(.85,.87,80),new THREE.MeshBasicMaterial({color:0x57f5ca,side:THREE.DoubleSide,transparent:true,opacity:.15}),0,.029,0,-Math.PI/2);
 ambientLine.visible=false;
 function syncTower(t){
  let record=towers.get(t);
  if(!record||record.level!==t.level){
   if(record)disposeTree(record.mesh);
   const mesh=towerModel(t.type,t.level);scene.add(mesh);
   record={mesh,level:t.level};towers.set(t,record);
  }
  const ob=record.mesh;
  ob.position.set(worldX(t.x),.014,worldZ(t.y));
  ob.userData.swivel.rotation.y=-t.angle;
  ob.userData.led.material.opacity=.32+(t.flash>0?.35:0);
 }
 function syncEnemy(e,frame){
  let mesh=units.get(e.id);
  if(!mesh){mesh=enemyModel(e);scene.add(mesh);units.set(e.id,mesh);}
  mesh.position.set(worldX(e.x),.01,worldZ(e.y));
  mesh.rotation.y=-e.angle;
  const u=mesh.userData;
  u.body.position.y=Math.sin(frame*.11+e.id)*.035;
  u.body.rotation.z=Math.sin(frame*.09+e.id)*.018;
  u.shield.visible=e.shield>0;
  u.shield.rotation.y=frame*.009;
  const totalHP=Math.max(.005,e.hp/e.maxHp);
  u.fill.scale.x=totalHP;
  u.fill.position.x=-(1-totalHP)*.47;
  u.fill.material.color.setHex(totalHP<.35?0xff718a:0x70f0b5);
  u.shieldFill.visible=e.shield>0;
  if(e.maxShield)u.shieldFill.scale.x=Math.max(.01,e.shield/e.maxShield);
  if(e.slow>0)u.body.scale.setScalar(.98);
 }
 function getBullet(i){
  if(bulletPool[i])return bulletPool[i];
  const model=new THREE.Group();const orb=object(model,sphere(.09,10),M.crystal,0,.24,0);
  orb.castShadow=false;
  const glow=glowSprite(0x55ffc9,.75,.6);glow.position.y=.24;model.add(glow);
  scene.add(model);bulletPool[i]={model,orb,glow};return bulletPool[i];
 }
 function syncShots(shots){
  shots.forEach((s,i)=>{
   const v=getBullet(i);v.model.visible=true;
   v.model.position.set(worldX(s.x),0,worldZ(s.y));v.orb.material=M.crystal;
   const c=new THREE.Color(s.color);
   v.orb.material.color.copy(c);v.glow.material.color.copy(c);
   v.model.scale.setScalar(s.kind==="frost"?1.6:1);
  });
  for(let i=shots.length;i<bulletPool.length;i++)bulletPool[i].model.visible=false;
 }
 function syncBeams(beams){
  for(const item of beamPool){scene.remove(item);item.geometry.dispose();item.material.dispose();}
  beamPool.length=0;
  for(const beam of beams){
   if(beam.ring){
    const p=beam.points[0];
    const radius=1.25*(1-beam.life/beam.max);
    const obj=new THREE.Mesh(new THREE.RingGeometry(Math.max(.01,radius-.045),Math.max(.05,radius+.045),40),
      new THREE.MeshBasicMaterial({color:beam.color,transparent:true,opacity:.6*(beam.life/beam.max),side:THREE.DoubleSide,depthWrite:false}));
    obj.rotation.x=-Math.PI/2;obj.position.set(worldX(p.x),.07,worldZ(p.y));
    scene.add(obj);beamPool.push(obj);continue;
   }
   const pts=beam.points.map(p=>new THREE.Vector3(worldX(p.x),.52,worldZ(p.y)));
   if(pts.length<2)continue;
   const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.max(3,pts.length*3),beam.width/100,5,false),
    new THREE.MeshBasicMaterial({color:beam.color,transparent:true,opacity:Math.max(.1,beam.life/beam.max),depthWrite:false}));
   scene.add(mesh);beamPool.push(mesh);
  }
 }
 function update(state,fx,frame,hover,selectedKind,selectedTower,movingTower,range){
  if(!state)return;
  const tset=new Set(state.towers);
  for(const [key,entry] of towers)if(!tset.has(key)){disposeTree(entry.mesh);towers.delete(key);}
  for(const tower of state.towers)syncTower(tower);
  const eset=new Set(state.enemies.map(e=>e.id));
  for(const [key,entry] of units)if(!eset.has(key)){disposeTree(entry);units.delete(key);}
  for(const e of state.enemies)syncEnemy(e,frame);
  syncShots(fx.shots);syncBeams(fx.beams);
  for(let i=0;i<portals.length;i++){
   const p=portals[i];
   p.ringA.rotation.x=frame*.006*i+.12;
   p.ringB.rotation.z=frame*.010*(i?1:-1);
   p.core.scale.set(.30,1+Math.sin(frame*.06+i)*.11,1);
   p.light.intensity=8+Math.sin(frame*.07+i)*2;
  }
  core.rotation.y=frame*.014;core.position.y=1.48+Math.sin(frame*.035)*.12;
  cage.forEach((r,i)=>r.rotation.y=frame*.005*(i%2?1:-1));
  reactorHalo.material.opacity=.20+Math.sin(frame*.055)*.05;
  dust.rotation.y=frame*.00005;
  const show=selectedTower&&!movingTower;
  const a=selectedKind?TOWERS[selectedKind]:movingTower?TOWERS[movingTower.type]:null;
  radiusRing.visible=!!(show||hover&&a);
  if(show){
   const radius=range(selectedTower)/UNIT;
   radiusRing.position.set(worldX(selectedTower.x),.035,worldZ(selectedTower.y));
   radiusRing.scale.setScalar(radius);
   radiusRing.material.color.setHex(0x67ffdc);
  }else if(hover&&a){
   const centerX=hover.gx*CELL+CELL/2,centerY=hover.gy*CELL+CELL/2;
   radiusRing.position.set(worldX(centerX),.035,worldZ(centerY));
   radiusRing.scale.setScalar((a.range*(state.boosts.range||1))/UNIT);
   radiusRing.material.color.setHex(canBuild(hover.gx,hover.gy,state.towers)?0x65ffca:0xf35d77);
  }
  placement.visible=!!(hover&&(selectedKind||movingTower));
  if(placement.visible){
   const {gx,gy}=hover,ok=canBuild(gx,gy,state.towers);
   placement.position.set(gx-9.5,.02,gy-5.5);
   cellMesh.material.color.setHex(ok?0x6effd2:0xff587c);
   const type=selectedKind||movingTower.type,key=type+(movingTower?.level||1);
   if(ghostKey!==key){
    if(ghost)disposeTree(ghost);
    ghost=towerModel(type,movingTower?.level||1);
    ghost.traverse(o=>{if(o.isMesh&&o.material&&o.material.clone){
      o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.62;
    }});
    placement.add(ghost);ghostKey=key;
   }
   ghost.visible=true;ghost.position.set(0,.03,0);
  }
  // Real-time environmental response when overdrive fires.
  reactorHalo.material.opacity=.22+state.overdrive/36;
  rLight.intensity=16+(state.overdrive?17:0);
  sun.intensity=4.3+state.flash*2;
  camera.position.x=10+state.shake*.004*(Math.sin(frame*2.3));
  camera.lookAt(0,0,0);
  renderer.render(scene,camera);
 }
 function pointer(event){
  const r=canvas.getBoundingClientRect();
  const nx=(event.clientX-r.left)/r.width*2-1,ny=-((event.clientY-r.top)/r.height*2-1);
  raycaster.setFromCamera({x:nx,y:ny},camera);
  if(raycaster.ray.intersectPlane(planePick,scratch)){
   return {x:(scratch.x+10)*UNIT,y:(scratch.z+6)*UNIT};
  }
  return {x:-100,y:-100};
 }
 // Context recovery: if the platform loses WebGL, refresh is preferable to a frozen screen.
 renderer.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();renderer.domElement.style.opacity="0";canvas.style.opacity="1";});
 return {update,pointer,renderer};
}
