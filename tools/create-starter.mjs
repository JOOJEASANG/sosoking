import fs from 'node:fs';
import engine from '../functions/game-engine.cjs';
const games=[];
const base=(id,type,category,title,subtitle,brief,hint,explanation,difficulty)=>({id,version:1,type,category,title,subtitle,brief,hint,explanation,difficulty,minutes:type==='robot'?5:3,edition:'오리지널',source:null,createdAt:'2026-10-13',status:'published'});
const routeMeta=[['delivery-01','마지막 한 집까지','가까운 곳부터? 이번에는 아닐지도.','마감이 다른 네 집에 배달하세요. 모든 배송을 마치고 26분 안에 출발지로 돌아오면 성공!','B의 마감이 가장 빠릅니다. 가까운 집보다 급한 집을 먼저 살펴보세요.','최단거리와 정시 배송은 다른 문제예요. B를 먼저 다녀오는 작은 우회가 네 곳의 약속을 모두 지킵니다.',1],['delivery-02','도시락 러시아워','다섯 곳의 점심시간을 지켜라.','다섯 배송지의 마감 전에 배달을 끝내세요. 각 집에서 전달하는 데 1분이 걸립니다.','C는 멀어 보여도 B를 거치는 길로 연결됩니다. 마감 순서와 거리의 균형이 중요해요.','가까운 곳을 모두 처리한 뒤 먼 곳으로 가면 급한 주문을 놓칠 수 있어요. 경유지를 생각하면 다른 경로가 보입니다.',2],['delivery-03','끝나지 않은 퇴근길','배송은 끝나도 복귀는 남는다.','배송 완료 시간뿐 아니라 기지로 돌아오는 시간까지 관리하세요. 도로 숫자는 양방향 이동 시간입니다.','마지막 집에서 출발지로 돌아오는 길도 전체 경로에 포함해 보세요.','복귀 조건이 있으면 마지막 배송지의 위치가 중요해집니다. 게임의 도로와 시간은 실제 교통 예측이 아닌 가상 조건입니다.',3]];
for(let k=0;k<3;k++){
 const m=routeMeta[k];const g=base(m[0],'route','life',...m.slice(1));
 g.nodes=[{label:'기지',x:12,y:63},{label:'A',x:27,y:20,deadline:9},{label:'B',x:48,y:74,deadline:5},{label:'C',x:69,y:28,deadline:14},{label:'D',x:89,y:65,deadline:17}];
 g.edges=[[0,1,3],[0,2,4],[1,2,2],[2,3,2],[3,4,2]];g.service=1;g.limit=26;
 if(k===1){g.nodes.push({label:'E',x:88,y:12,deadline:30});g.edges.push([3,5,3],[4,5,2]);}
 if(k===2){g.edges=[[0,1,4],[0,2,3],[1,2,3],[1,3,2],[2,4,5],[3,4,3]];}
 if(k){const order=k===1?[2,3,5,4,1]:[1,3,4,2];const d=engine.matrix(g);let t=0,p=0;for(const n of order){t+=d[p][n]+1;g.nodes[n].deadline=t+(n%2);p=n;}g.limit=t+d[p][0]+2;}
 g.bestTime=engine.solve(g).result.metric;games.push(g);
}
const paceMeta=[['pace-01','마지막 100m의 반전','처음부터 달리면, 끝에서 멈춘다.','6개 구간의 회복·유지·질주를 조합해 완주하세요. 체력은 다음 구간으로 이어집니다.','회복은 낭비가 아닙니다. 질주가 유리한 내리막을 위해 체력을 남겨보세요.','같은 체력도 어디에 쓰느냐에 따라 기록이 달라져요. 내리막의 질주 보너스와 오르막의 추가 소모를 함께 보세요.',1],['pace-02','바람을 읽는 러너','맞바람에 힘을 다 쓸 건가요?','구간별 바람에 따라 페이스의 시간이 달라집니다. 조건표를 보고 금메달 기록에 도전하세요.','질주 시간에 보너스가 붙는 구간부터 살펴보세요.','맞바람에서 버틴 뒤 유리한 구간에서 속도를 높이는 전략도 가능합니다. 실제 선수의 경기 결과를 예측하는 모델은 아닙니다.',2],['pace-03','오르막 뒤의 결승선','결승선 앞에 체력이 남아야 한다.','시작 체력이 적고 오르막이 반복됩니다. 6구간을 모두 완주하는 페이스를 계획하세요.','회복을 할 때 최대 체력을 넘겨 버리는 양도 확인해 보세요.','체력이 충분할 때 회복하면 일부 회복량이 사라집니다. 최대 체력과 다음 구간 비용까지 같이 계산하면 기록을 줄일 수 있어요.',3]];
for(let k=0;k<3;k++){
 const m=paceMeta[k],g=base(m[0],'pace','sports',...m.slice(1));g.energy=k===2?6:8;g.capacity=10;g.gold=100;g.silver=120;
 g.segments=[{label:'출발 직선',time:{}},{label:'오르막',sprintCost:2,time:{sprint:2,cruise:1}},{label:'내리막',time:{sprint:-2,recover:-1}},{label:'평지',time:{}},{label:'맞바람',time:{sprint:2,cruise:1}},{label:'마지막 직선',time:{sprint:-1}}];
 if(k===1)g.segments=[{label:'맞바람',time:{sprint:3,cruise:1}},{label:'순풍',time:{sprint:-3}},{label:'직선',time:{}},{label:'오르막',sprintCost:3,time:{sprint:3}},{label:'순풍',time:{sprint:-2}},{label:'결승 직선',time:{}}];
 if(k===2)g.segments=[{label:'오르막',sprintCost:2,time:{sprint:2}},{label:'짧은 평지',time:{}},{label:'긴 오르막',sprintCost:3,time:{sprint:3,cruise:2}},{label:'내리막',time:{sprint:-3}},{label:'회복 직선',time:{recover:-2}},{label:'마지막 오르막',sprintCost:1,time:{sprint:1}}];
 g.gold=engine.solve(g).result.metric;g.silver=g.gold+6;games.push(g);
}
const robotMeta=[['rover-01','작은 로봇의 큰 귀환','명령 7칸으로 표본 3개를 가져오세요.','화살표가 로봇의 앞 방향입니다. 앞으로·좌회전·우회전을 조합하고 같은 명령은 최대 3번 반복할 수 있어요.','앞으로 이동할 때 숫자를 2로 바꾸면 명령 슬롯을 아낄 수 있어요.','반복 명령은 슬롯을 아끼지만 배터리는 한 동작마다 소모됩니다. 이동과 회전을 구분하는 것이 첫 탐사의 핵심이에요.',1],['rover-02','통신이 끊긴 탐사선','실행 전에 경로를 완성하세요.','멀리 있는 표본 3개를 모아 오른쪽 위 기지로 돌아오세요. 실행 중에는 명령을 바꿀 수 없습니다.','긴 직선에서는 반복 횟수 3을 활용해 보세요.','통신 지연이 있는 탐사에서는 미리 명령을 구성하는 일이 중요합니다. 이 미션의 지도와 에너지 규칙은 창작입니다.',2],['rover-03','돌아가는 길이 정답','곧장 기지로 가면 놓치는 것이 있다.','모든 표본을 수집한 뒤 왼쪽 위 기지로 이동하세요. 가까운 기지만 보고 출발하면 표본을 놓칩니다.','먼 표본부터 연결하고, 마지막에 기지로 들어오는 경로를 생각해 보세요.','종착점에 도착하는 것만으로 미션이 끝나지는 않아요. 중간 목표를 모두 만족하는 순서가 필요합니다.',3]];
for(let k=0;k<3;k++){
 const m=robotMeta[k],g=base(m[0],'robot','science',...m.slice(1));g.width=k===1?6:5;g.height=k===1?6:5;g.start=[0,g.height-1,1];g.goal=k===2?[0,0]:[g.width-1,0];
 g.samples=k===0?[[2,4],[2,2],[4,1]]:k===1?[[3,5],[3,3],[5,1]]:[[3,4],[1,2],[1,0]];
 g.walls=k===0?[[0,3],[1,3],[3,3],[3,1],[1,1]]:k===1?[[0,4],[1,4],[2,4],[4,4],[4,2],[2,1]]:[[0,3],[1,3],[2,3],[4,3],[2,1],[3,1]];
 const ops=k===0?[['F',2],['L',1],['F',2],['R',1],['F',2],['L',1],['F',2]]:k===1?[['F',3],['L',1],['F',2],['R',1],['F',2],['L',1],['F',3]]:[['F',3],['L',1],['F',2],['L',1],['F',2],['R',1],['F',2],['L',1],['F',1]];
 g.solution=ops.map(([op,count])=>({op,count}));g.goldSlots=g.solution.length;g.slots=g.goldSlots+3;g.energy=ops.reduce((a,x)=>a+x[1],0)+3;games.push(g);
}
for(const g of games)engine.validate(g);
fs.writeFileSync('public/data/games.json',JSON.stringify(games,null,2)+'\n');
console.log(games.map(g=>({id:g.id,optimal:engine.solve(g).result.metric})));
