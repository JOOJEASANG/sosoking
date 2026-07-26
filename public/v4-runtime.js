(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rooms = ["field", "surveillance", "forensics", "interrogation", "briefing", "court"];
  const meta = {
    field:["🚨","초동 현장"], surveillance:["🥸","잠복 차량"], forensics:["🧪","과잉 감식실"],
    interrogation:["🎙️","피의자 심문실"], briefing:["📡","긴급 브리핑실"], court:["⚖️","최종 법정"]
  };
  const state = { data:null, incident:"", severity:"official", number:"", room:null, completed:new Set(), clues:[], chaos:1,
    disguise:"", evidence:new Set(), judgements:{}, tone:"", courtEvidence:"", verdict:null, loadingTimer:null, loadingStep:0 };
  const screens = { intake:$("#intake-screen"), loading:$("#loading-screen"), board:$("#board-screen"), result:$("#result-screen") };
  const panel = $("#mission-panel");
  const loadingLines = [
    ["상황실","사건 필요성을 3%로 산정","그래도 회의실 두 곳을 확보했습니다."],
    ["초동팀","현장요원 14명 호출","11명은 아직 호출 이유를 모릅니다."],
    ["잠복팀","위장용 선글라스 선정","실내지만 작전상 필요합니다."],
    ["감식실","미세 부스러기 분석","장비가 부스러기보다 비쌉니다."],
    ["압수반","증거봉투와 거의 영장 준비","압수 대상은 회의 중입니다."],
    ["브리핑실","마이크 7개 설치","질문은 한 개만 받습니다."],
    ["재판부","엄숙함 최종 충전","웃으면 분위기만 깨집니다."]
  ];

  function show(name) {
    Object.entries(screens).forEach(([key, el]) => el.hidden = key !== name);
    window.scrollTo(0, 0);
  }
  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1800);
  }
  function number() {
    const d = new Date();
    return `SO-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.floor(100+Math.random()*900)}`;
  }
  function validate(text) {
    if (text.length < 7) return "사건 내용을 7자 이상 적어주세요.";
    if (text.length > 120) return "사건 내용은 120자 이하만 접수됩니다.";
    if (["폭행","성폭력","학대","자살","자해","살인","납치","유괴","스토킹","협박","학교폭력","가정폭력","아동학대","사망","흉기","마약"].some(x => text.includes(x))) return "실제 심각한 피해나 범죄는 코미디 사건으로 접수할 수 없습니다.";
    if (/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\//i.test(text)) return "전화번호·이메일·주소 같은 개인정보를 삭제해주세요.";
    return "";
  }
  function demo(incident) {
    return {
      title:"생활질서 과잉대응 특별 사건", charge:"사소한 기대감 훼손 및 일상질서 흔들기", summary:`${incident} 수사본부는 이를 단순한 일상 문제가 아닌 생활질서 중대 교란으로 확대 해석했다.`,
      damages:"기대감 73%, 평온함 2칸, 대화 시간 11분", commandCenter:"임시 생활질서 합동상황실", operationName:"작전명: 필요 이상", emergencyGrade:"생활질서 위기 2단계", scale:"현장요원 14명·장비 9종",
      taskForceUnits:["동선 과잉분석반","미세흔적 확대반","관련없는 물품 압수반","마이크 다수 브리핑반"],
      dispatchLog:[
        {time:"14:03",unit:"초동반",action:"현장 반경 1.2m 통제",note:"통제선이 사건보다 길어졌다."},
        {time:"14:07",unit:"보존반",action:"주변 물건 전부 증거 후보 지정",note:"본인들도 기준을 모른다."},
        {time:"14:12",unit:"동선반",action:"발자국 19개 확보",note:"18개는 이전부터 있었다."},
        {time:"14:18",unit:"상황실",action:"사건명을 세 차례 확대",note:"최종 명칭이 제보보다 길다."}
      ],
      surveillance:{location:"현장 바로 옆 너무 잘 보이는 자리",duration:"1시간 47분",disguise:"아무 일 없이 휴대전화를 보는 사람",observation:"용의선상 인물들이 지나갔지만 모두 평범하게 행동했다.",unexpected:"잠복요원이 분리수거 문제를 먼저 해결했다."},
      forensicReports:[
        {sample:"현장 미세흔적",method:"48배 확대",finding:"흔적이 오른쪽으로 3.4cm 이동",unnecessaryConclusion:"오른손잡이거나 왼손 사용을 미뤘다."},
        {sample:"주변 포장지",method:"반사광 비교",finding:"한쪽 면이 유난히 깨끗함",unnecessaryConclusion:"정리정돈 의식이 부분적으로 존재한다."},
        {sample:"공용 도구",method:"진동 잔향 분석",finding:"사건 시간대 사용 가능성",unnecessaryConclusion:"도구는 묵비권을 행사했다."}
      ],
      search:{warrant:"생활질서 임시확인서 제4호",target:"공용 서랍과 주변 80cm",seizedItems:["관련성 낮은 영수증","작은 숟가락","오래된 티백"],officerNote:"압수품 대부분이 사건보다 오래됐다."},
      evidence:[
        {label:"증거 A",title:"깨끗하게 남은 포장",detail:"내용은 사라졌으나 포장만 현장을 지켰다.",significance:"행위 뒤 정리까지 계획했을 가능성."},
        {label:"증거 B",title:"진술과 다른 습관",detail:"평소 말과 실제 행동 사이에 사소한 차이가 있다.",significance:"매우 작지만 수사본부는 크게 본다."},
        {label:"증거 C",title:"크기가 맞지 않는 도구",detail:"사건 물건보다 훨씬 큰 도구가 발견됐다.",significance:"과도해서 오히려 무관할 수 있다."},
        {label:"증거 D",title:"엉뚱한 장소의 흔적",detail:"예상하지 못한 곳에서 비슷한 흔적이 나왔다.",significance:"새로운 황당한 가능성이 생겼다."}
      ],
      questions:[
        {question:"말과 행동이 다른 이유는 무엇입니까?",response:"그때는 상황이 달랐습니다.",replySpeaker:"수사본부",reply:"상황이 얼마나 달랐는지 별도 위원회를 엽니다."},
        {question:"마지막으로 현장을 본 시각은 언제입니까?",response:"보았지만 보지 않으려고 했습니다.",replySpeaker:"수사본부",reply:"목격 회피 의지가 구체적입니다."},
        {question:"엉뚱한 장소의 흔적을 설명할 수 있습니까?",response:"그곳도 가끔 관심이 필요합니다.",replySpeaker:"수사본부",reply:"답변보다 새로운 사건이 늘었습니다."}
      ],
      briefing:{headline:"사소한 사건, 전국적 관심 없이 수사 확대",statement:"모든 가능성을 열어두되 문은 닫아두겠습니다.",reporterQuestion:"이 정도 일에 마이크 7개가 필요합니까?",answer:"필요성은 철수 이후 검토하겠습니다."},
      prosecution:"피고의 행동은 사소하지만 수사본부가 이미 너무 많은 서류를 만들었습니다.", defense:"직접 증거는 부족하고 과잉수사 증거만 충분합니다.", judge:"사건보다 수사 규모가 커진 책임도 함께 살피겠습니다.",
      verdicts:[
        {title:"공개 복구형",sentence:"피고는 관련 물품 30개를 공개적으로 복구한다.",afterStory:"복구 물품이 너무 많아 보관 장소 분쟁이 생겼다."},
        {title:"전원 공동책임형",sentence:"모두가 일주일간 사용 내역을 기록한다.",afterStory:"기록지가 400쪽을 넘어 새 제본 사건이 발생했다."},
        {title:"황당한 화해형",sentence:"피고는 관련 없는 물건에도 공개 사과한다.",afterStory:"사과받지 못한 다른 물건이 차별을 주장했다."}
      ], judgeTypes:["증거봉투 수집형 재판관","생활질서 과잉보호형 판사","황당화해 전문 조정관"]
    };
  }

  function reset() {
    state.data=null; state.room=null; state.completed=new Set(); state.clues=[]; state.chaos=1; state.disguise=""; state.evidence=new Set(); state.judgements={}; state.tone=""; state.courtEvidence=""; state.verdict=null;
    panel.classList.remove("open"); panel.innerHTML='<div class="panel-empty"><div><strong>사건보드에서 장소를 선택하세요</strong><span>사용자가 움직이지 않으면 수사본부는 서류만 만듭니다.</span></div></div>';
  }
  function locked(room) {
    if (room === "briefing") return !["field","surveillance","forensics","interrogation"].every(x => state.completed.has(x));
    if (room === "court") return !state.completed.has("briefing");
    return false;
  }
  function sync() {
    const d=state.data; if (!d) return;
    $("#case-title").textContent=d.title; $("#case-number").textContent=state.number; $("#central-title").textContent=d.title; $("#central-summary").textContent=d.summary;
    $("#central-charge").textContent=d.charge; $("#central-grade").textContent=d.emergencyGrade; $("#central-scale").textContent=d.scale; $("#board-alert").textContent=`${d.operationName} · ${d.commandCenter}`;
    $("#completion-count").textContent=`${state.completed.size}/6`; $("#completion-bar").style.width=`${state.completed.size/6*100}%`;
    $$("#chaos-meter i").forEach((x,i)=>x.classList.toggle("on",i<state.chaos));
    $("#clue-stack").innerHTML=state.clues.length?state.clues.slice(-5).reverse().map((x,i)=>`<div class="clue-pill${i===0?" new":""}">${esc(x)}</div>`).join(""):'<div class="clue-pill">아직 확보된 단서가 없습니다.</div>';
    $$("[data-room]").forEach(b=>{const r=b.dataset.room;b.classList.toggle("locked",locked(r));b.classList.toggle("done",state.completed.has(r));b.classList.toggle("active",state.room===r);});
  }
  function complete(room, clue, chaos=0) { state.completed.add(room); if(clue&&!state.clues.includes(clue))state.clues.push(clue); state.chaos=Math.min(5,state.chaos+chaos); sync(); toast(`${meta[room][1]} 임무 완료`); }
  function sheet(title,kicker,copy,body){return `<button class="panel-close" type="button">사건보드로 돌아가기</button><section class="mission-sheet"><header class="sheet-header"><span class="sheet-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2><p>${esc(copy)}</p></header><div class="sheet-body">${body}</div></section>`;}

  function render(room) {
    const d=state.data; state.room=room; sync(); panel.classList.add("open");
    if(locked(room)){panel.innerHTML=sheet(`${meta[room][1]} 잠김`,`LOCKED`,"앞선 임무 기록이 부족합니다.",'<div class="lock-note">사건보드의 열린 장소부터 완료하세요.<br>담당자는 이미 앉아서 기다리고 있습니다.</div>');return;}
    if(room==="field") panel.innerHTML=sheet("초동 현장 봉쇄","ROOM 01","통제선 길이는 사건 중요도와 무관합니다.",`<div class="record-list">${d.dispatchLog.map(x=>`<article class="record-card"><time>${esc(x.time)}</time><b>${esc(x.unit)} · ${esc(x.action)}</b><p>${esc(x.note)}</p></article>`).join("")}</div><div class="section-rule">투입 부서</div><div class="option-grid">${d.taskForceUnits.map(x=>`<div class="choice-card"><b>${esc(x)}</b><small>호출 이유를 문서로 확인 중입니다.</small></div>`).join("")}</div><button class="mission-action${state.completed.has(room)?" complete":""}" data-action="field">${state.completed.has(room)?"현장 통제 완료됨":"통제선을 필요 이상으로 설치"}</button>`);
    if(room==="surveillance"){
      const opts=[d.surveillance.disguise,"지나치게 큰 신문을 든 방문객","화분을 매분 확인하는 시설관리요원"];
      panel.innerHTML=sheet("잠복 위장 선택","ROOM 02",`${d.surveillance.location}에서 ${d.surveillance.duration} 동안 아무렇지 않은 척합니다.`,`<div class="option-grid">${opts.map(x=>`<button class="choice-card${state.disguise===x?" selected":""}" data-disguise="${esc(x)}"><b>${esc(x)}</b><small>자연스러움은 수사본부가 보장하지 않습니다.</small></button>`).join("")}</div>${state.disguise?`<div class="reveal-box"><b>관찰</b><br>${esc(d.surveillance.observation)}<br><br><b>예상 밖 성과</b><br>${esc(d.surveillance.unexpected)}</div>`:""}<button class="mission-action${state.completed.has(room)?" complete":""}" data-action="surveillance" ${state.disguise?"":"disabled"}>${state.completed.has(room)?"잠복일지 제출 완료":"선택한 위장으로 잠복 개시"}</button>`);
    }
    if(room==="forensics"){
      const reports=state.completed.has(room)?`<div class="section-rule">감식 결과</div><div class="record-list">${d.forensicReports.map(x=>`<article class="record-card"><time>${esc(x.method)}</time><b>${esc(x.sample)}</b><p>${esc(x.finding)}</p><div class="reveal-box"><b>쓸데없는 결론</b><br>${esc(x.unnecessaryConclusion)}</div></article>`).join("")}</div><div class="record-card"><b>${esc(d.search.warrant)}</b><p>${esc(d.search.seizedItems.join(", "))}<br>${esc(d.search.officerNote)}</p></div>`:"";
      panel.innerHTML=sheet("감식할 증거 선택","ROOM 03","증거 두 개를 골라야 장비 아홉 대를 켤 명분이 생깁니다.",`<div class="evidence-select">${d.evidence.map((x,i)=>`<label><input type="checkbox" data-evidence="${i}" ${state.evidence.has(i)?"checked":""}><span><b>${esc(x.label)} · ${esc(x.title)}</b><small>${esc(x.detail)}</small></span></label>`).join("")}</div><p class="form-error">${state.evidence.size}/2개 선택</p><button class="mission-action${state.completed.has(room)?" complete":""}" data-action="forensics" ${state.evidence.size===2?"":"disabled"}>${state.completed.has(room)?"감식 완료":"정밀 감식 의뢰"}</button>${reports}`);
    }
    if(room==="interrogation") panel.innerHTML=sheet("피의자 진술 판단","ROOM 04","모든 대답을 약간 수상하게 보는 것이 원칙입니다.",`<div class="record-list">${d.questions.map((x,i)=>`<article class="record-card transcript"><div class="question">Q${i+1}. ${esc(x.question)}</div><div class="answer"><b>${esc(x.response)}</b><br>${esc(x.replySpeaker)}: ${esc(x.reply)}</div><div class="judgement-toggle"><button data-q="${i}" data-j="suspicious" class="${state.judgements[i]==="suspicious"?"selected":""}">수상함</button><button data-q="${i}" data-j="understood" class="${state.judgements[i]==="understood"?"selected":""}">일단 납득</button></div></article>`).join("")}</div><p class="form-error">${Object.keys(state.judgements).length}/3개 판단</p><button class="mission-action${state.completed.has(room)?" complete":""}" data-action="interrogation" ${Object.keys(state.judgements).length>=2?"":"disabled"}>${state.completed.has(room)?"심문조서 완료":"최종 의견 기록"}</button>`);
    if(room==="briefing") panel.innerHTML=sheet("공개 브리핑 방식 선택","ROOM 05","국민은 없지만 국민적 관심을 전제로 발표합니다.",`<div class="briefing-box"><h3>${esc(d.briefing.headline)}</h3><p>${esc(d.briefing.statement)}</p><div class="press-question"><b>기자</b><br>${esc(d.briefing.reporterQuestion)}<br><br><b>답변</b><br>${esc(d.briefing.answer)}</div></div><div class="section-rule">발표 태도</div><div class="option-grid">${["초엄숙 발표","책임회피 발표","쓸데없이 솔직한 발표"].map(x=>`<button class="choice-card${state.tone===x?" selected":""}" data-tone="${x}"><b>${x}</b><small>발표 내용보다 태도가 더 오래 남습니다.</small></button>`).join("")}</div><button class="mission-action${state.completed.has(room)?" complete":""}" data-action="briefing" ${state.tone?"":"disabled"}>${state.completed.has(room)?"브리핑 종료":"긴급 발표"}</button>`);
    if(room==="court") panel.innerHTML=sheet("최종 증거와 형벌 선택","ROOM 06","수사본부가 의심하고 사용자가 책임집니다.",`<div class="briefing-box"><h3>검사 의견</h3><p>${esc(d.prosecution)}</p><h3>변호인 의견</h3><p>${esc(d.defense)}</p><div class="press-question">${esc(d.judge)}</div></div><div class="section-rule">핵심 증거</div><div class="option-grid">${d.evidence.map(x=>`<button class="choice-card${state.courtEvidence===x.title?" selected":""}" data-court-evidence="${esc(x.title)}"><b>${esc(x.title)}</b><small>${esc(x.significance)}</small></button>`).join("")}</div><div class="section-rule">최종 형벌</div><div class="verdict-grid">${d.verdicts.map((x,i)=>`<button class="verdict-card${state.verdict===i?" selected":""}" data-verdict="${i}"><h3>${esc(x.title)}</h3><p>${esc(x.sentence)}</p></button>`).join("")}</div><button class="mission-action" data-action="court" ${state.courtEvidence!==""&&Number.isInteger(state.verdict)?"":"disabled"}>판결봉을 쓸데없이 세게 내리치기</button>`);
  }

  function result() {
    const d=state.data,v=d.verdicts[state.verdict], suspicious=Object.values(state.judgements).filter(x=>x==="suspicious").length, judge=Math.min(2,Math.floor((state.chaos+suspicious)/3));
    $("#result-case-number").textContent=state.number; $("#result-title").textContent=v.title; $("#result-sentence").textContent=v.sentence; $("#result-afterstory").textContent=v.afterStory;
    $("#result-judge-type").textContent=d.judgeTypes[judge]||d.judgeTypes[0]; $("#result-evidence").textContent=state.courtEvidence; $("#result-disguise").textContent=state.disguise; $("#result-tone").textContent=state.tone; show("result");
  }

  function startLoading() {
    show("loading"); state.loadingStep=0; $("#operation-feed").innerHTML=""; $("#loading-progress").style.width="7%"; $("#loading-percent").textContent="07%";
    const add=()=>{const x=loadingLines[state.loadingStep];if(!x)return;$("#operation-feed").insertAdjacentHTML("beforeend",`<li><time>작전+${String(3+state.loadingStep*2).padStart(2,"0")}</time><span><strong>${x[0]} · ${x[1]}</strong><small>${x[2]}</small></span></li>`);state.loadingStep++;const p=Math.min(92,7+state.loadingStep*12);$("#loading-progress").style.width=`${p}%`;$("#loading-percent").textContent=`${p}%`;};
    add(); clearInterval(state.loadingTimer); state.loadingTimer=setInterval(add,2100);
  }
  async function generate() {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
    try{const res=await fetch("/api/generate-case",{method:"POST",headers:{"Content-Type":"application/json","X-Sosoking-Client":"court-v3"},body:JSON.stringify({incident:state.incident,severity:state.severity}),signal:controller.signal});const body=await res.json().catch(()=>({}));if(!res.ok||!body.case)throw new Error(body.error||"생성 실패");return body.case;}finally{clearTimeout(timer);}
  }
  function newCase(){clearInterval(state.loadingTimer);reset();$("#incident").value="";$("#char-count").textContent="0";$("#form-error").textContent="";$("#new-case-button").hidden=true;show("intake");}

  $("#case-form").addEventListener("submit",async(e)=>{e.preventDefault();const text=$("#incident").value.replace(/\s+/g," ").trim(),error=validate(text);$("#form-error").textContent=error;if(error)return;reset();state.incident=text;state.severity=new FormData(e.currentTarget).get("severity")||"official";state.number=number();startLoading();try{state.data=await generate();}catch(err){console.warn(err);state.data=demo(text);toast("AI 수사본부가 늦어 예비 판례로 훈련 사건을 열었습니다.");}clearInterval(state.loadingTimer);$("#loading-progress").style.width="100%";$("#loading-percent").textContent="100%";setTimeout(()=>{show("board");$("#new-case-button").hidden=false;sync();},350);});
  $("#incident").addEventListener("input",e=>{$("#char-count").textContent=e.target.value.length;$("#form-error").textContent="";});
  $$("[data-example]").forEach(b=>b.addEventListener("click",()=>{$("#incident").value=b.dataset.example;$("#incident").dispatchEvent(new Event("input"));}));
  panel.addEventListener("change",e=>{if(!e.target.matches("[data-evidence]"))return;const i=Number(e.target.dataset.evidence);if(e.target.checked&&state.evidence.size>=2){e.target.checked=false;toast("감식 예산상 두 개만 선택합니다.");return;}e.target.checked?state.evidence.add(i):state.evidence.delete(i);render("forensics");});
  document.addEventListener("click",e=>{
    const rb=e.target.closest("[data-room]");if(rb){render(rb.dataset.room);return;}if(e.target.closest(".panel-close")){panel.classList.remove("open");return;}
    const dg=e.target.closest("[data-disguise]");if(dg){state.disguise=dg.dataset.disguise;render("surveillance");return;}
    const j=e.target.closest("[data-q]");if(j){state.judgements[j.dataset.q]=j.dataset.j;render("interrogation");return;}
    const t=e.target.closest("[data-tone]");if(t){state.tone=t.dataset.tone;render("briefing");return;}
    const ce=e.target.closest("[data-court-evidence]");if(ce){state.courtEvidence=ce.dataset.courtEvidence;render("court");return;}
    const v=e.target.closest("[data-verdict]");if(v){state.verdict=Number(v.dataset.verdict);render("court");return;}
    const a=e.target.closest("[data-action]")?.dataset.action;if(!a)return;
    if(a==="field"){complete(a,`현장 핵심: ${state.data.dispatchLog.at(-1).action}`);render(a);}
    if(a==="surveillance"){complete(a,`잠복 위장: ${state.disguise}`,1);render(a);}
    if(a==="forensics"){complete(a,`감식 증거: ${[...state.evidence].map(i=>state.data.evidence[i].label).join("·")}`,1);render(a);}
    if(a==="interrogation"){const n=Object.values(state.judgements).filter(x=>x==="suspicious").length;complete(a,`수상한 진술 ${n}건`,n>1?1:0);render(a);}
    if(a==="briefing"){complete(a,`브리핑 태도: ${state.tone}`,state.tone==="초엄숙 발표"?1:0);render(a);}
    if(a==="court"){complete(a,`핵심 증거: ${state.courtEvidence}`,1);result();}
  });
  $("#new-case-button").addEventListener("click",newCase);$("#result-new-case").addEventListener("click",newCase);
  $("#share-result").addEventListener("click",async()=>{const v=state.data.verdicts[state.verdict],text=`소문난 판결소\n${v.title}\n${v.sentence}\n${state.number}`;try{if(navigator.share)await navigator.share({title:"소문난 판결소",text});else await navigator.clipboard.writeText(text);$("#share-status").textContent="판결 공유 준비 완료";}catch(err){if(err.name!=="AbortError")$("#share-status").textContent="공유하지 못했습니다.";}});
  reset();show("intake");
})();
