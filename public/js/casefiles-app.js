import {CASES, CASE_BY_ID, CATEGORY_NAMES, dailyCase} from './casefiles-data.js';

const KEY = 'sosoking:casefiles:v1';
const contentRoot = document.querySelector('#view');
const nav = document.querySelector('#site-nav');
const APP_VERSION = 1;
let saved = readSaved();
let run = null;
let activeWitness = '';
let feedback = '';
let selectedCategory = '전체';
let searchText = '';
let ticker = null;

function readSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {history:Array.isArray(data.history)?data.history.slice(0,200):[],drafts:data.drafts && typeof data.drafts==='object'?data.drafts:{}};
  } catch { return {history:[],drafts:{}}; }
}
function persist() { try { localStorage.setItem(KEY,JSON.stringify(saved)); } catch { /* private browsing */ } }
function e(v) { return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dateLabel(date){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric'}).format(date);}
function todayKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function elapsed(){return run ? Math.max(0,Math.floor((Date.now()-run.started)/1000)) : 0;}
function duration(sec){return Math.floor(sec/60)+'분 '+String(sec%60).padStart(2,'0')+'초';}
function levelStars(n){return '◆'.repeat(n)+'◇'.repeat(3-n);}
function getSolved(id) {return saved.history.filter(h=>h.caseId===id).sort((a,b)=>b.score-a.score)[0];}
function badgeFor(score){return score>=95?'전설의 수사관':score>=80?'명탐정':score>=60?'예리한 조사관':score>=35?'견습 수사관':'다시 도전하는 탐정';}
function caseCard(c, featured=false) {
  const score=getSolved(c.id);
  return '<a href="#/case/'+c.id+'" class="case-card theme-'+c.theme+(featured?' featured-card':'')+'" aria-label="'+e(c.title)+' 시작">'
  +'<div class="card-top"><span class="case-num">CASE '+c.number+'</span><span class="case-status">'+(score?'최고 '+score.score+'점':'미해결')+'</span></div>'
  +'<div class="case-illustration"><div class="file-shadow"></div><div class="file-stamp">CONFIDENTIAL</div><span class="case-symbol">'+({festival:'⌕',cafe:'▤',library:'◈',school:'◉',gallery:'▧',package:'▣',studio:'◐',bakery:'✳'}[c.id]||'⌕')+'</span></div>'
  +'<div class="card-meta">'+e(c.category)+' <span>·</span> '+levelStars(c.level)+' <span>·</span> '+c.minutes+'분</div>'
  +'<h3>'+e(c.title)+'</h3><p>'+e(c.tagline)+'</p><span class="card-open">사건 열기 <span aria-hidden="true">↗</span></span></a>';
}
function stats() {
  const byCase=new Map();
  for(const h of saved.history) { const old=byCase.get(h.caseId); if(!old||old.score<h.score)byCase.set(h.caseId,h); }
  const wins=[...byCase.values()].filter(x=>x.solved).length;
  return {played:byCase.size,solved:wins,avg:byCase.size?Math.round([...byCase.values()].reduce((a,b)=>a+b.score,0)/byCase.size):0,attempts:saved.history.length};
}
function sectionTitle(eyebrow,title,description){return '<div class="section-head"><div><span class="eyebrow">'+eyebrow+'</span><h2>'+title+'</h2><p>'+description+'</p></div></div>';}
function home(){
  const current=dailyCase();
  const s=stats();
  const recent=CASES.filter(x=>x.id!==current.id).slice(0,3);
  return '<section class="hero"><div class="hero-copy"><div class="hero-label"><span class="pulse-dot"></span> NEW CASEFILES · 플레이 무료</div><h1>진실은 언제나<br><em>증거 속에</em> 숨어 있다.</h1><p>현장을 뒤지고, 거짓 진술을 무너뜨리고, 마지막 법정에서 사건을 뒤집어라. 추리의 결말은 당신의 선택에 달렸다.</p>'
  +'<div class="hero-actions"><a class="btn btn-gold" href="#/case/'+current.id+'">오늘의 추천 사건 시작 <span>↗</span></a><a class="btn btn-outline" href="#/archive">모든 사건 보기</a></div>'
  +'<div class="hero-benefits"><span>◌ 실시간 AI 호출 없음</span><span>◌ 설치 없이 바로 플레이</span><span>◌ 점수 · 기록 저장</span></div></div>'
  +'<div class="hero-art" role="img" aria-label="사건 현장의 증거 파일, 종이 문서, 단서들이 놓인 조사 보드"><div class="hero-halo"></div><div class="board-document doc-one"><span>CLASSIFIED / '+current.number+'</span><strong>EVIDENCE</strong><div class="mock-lines"></div></div><div class="board-document doc-two"><span>CASE NOTE</span><strong>?</strong></div><div class="board-string string-a"></div><div class="board-string string-b"></div><div class="board-pin pin-one"></div><div class="board-pin pin-two"></div><div class="board-fingerprint">◎</div><div class="hero-evidence-tag">증거번호 001 — 미확인</div></div></section>'
  +'<div class="ticker"><span class="ticker-tag">오늘의 사건</span><span>'+e(current.title)+' · '+e(current.tagline)+'</span><span class="ticker-date">'+dateLabel(new Date())+'</span></div>'
  +'<section class="section" id="daily">'+sectionTitle('TODAY’S CASE','오늘의 추천 사건','매일 바뀌는 추천 사건부터 시작하세요. 기존 사건도 언제든 다시 도전할 수 있습니다.')
  +'<div class="daily-feature"><div class="daily-case theme-'+current.theme+'"><span class="eyebrow">FILE NO. '+current.number+'</span><h3>'+e(current.title)+'</h3><p>'+e(current.intro)+'</p><div class="daily-details"><span>난이도 '+levelStars(current.level)+'</span><span>약 '+current.minutes+'분</span><span>'+e(current.category)+'</span></div><a class="btn btn-gold" href="#/case/'+current.id+'">'+(saved.drafts[current.id]?'수사 이어하기':'수사 시작하기')+' ↗</a></div>'
  +'<div class="daily-side"><div class="metric-title">내 수사 기록 <span>LOCAL RECORD</span></div><div class="metric-main">'+s.solved+'<small> / '+CASES.length+'건 해결</small></div><div class="metric-row"><span>도전한 사건</span><b>'+s.played+'건</b></div><div class="metric-row"><span>평균 최고 점수</span><b>'+s.avg+'점</b></div><div class="metric-row"><span>총 플레이 횟수</span><b>'+s.attempts+'회</b></div><a href="#/records" class="tiny-link">내 기록 자세히 보기 ↗</a></div></div></section>'
  +'<section class="section">'+sectionTitle('INVESTIGATION METHOD','당신의 수사는 세 단계','읽고 끝나는 퀴즈가 아닙니다. 직접 증거를 확보하고 진술을 깨뜨려야 합니다.')
  +'<div class="mode-grid"><article class="mode-card"><span class="mode-num">01</span><div class="mode-glyph">⌕</div><h3>현장수사</h3><p>증거물을 하나씩 조사해 사건의 흐름을 복원합니다.</p><span>FIND THE CLUE ↗</span></article><article class="mode-card"><span class="mode-num">02</span><div class="mode-glyph">❞</div><h3>증인신문</h3><p>세 명의 진술을 듣고 말과 맞지 않는 증거를 제시합니다.</p><span>BREAK THE ALIBI ↗</span></article><article class="mode-card"><span class="mode-num">03</span><div class="mode-glyph">⚖</div><h3>법정공방</h3><p>범인과 결정적 증거를 선택해 진실을 입증합니다.</p><span>MAKE YOUR CASE ↗</span></article></div></section>'
  +'<section class="section">'+sectionTitle('CASE ARCHIVE','다른 사건도 도전','각각 다른 현장, 다른 진술, 다른 반전이 기다립니다.')
  +'<div class="case-grid">'+recent.map(c=>caseCard(c)).join('')+'</div><div class="center-action"><a href="#/archive" class="btn btn-outline">전체 '+CASES.length+'개 사건 보기 →</a></div></section>';
}
function archive(){
  const filtered=CASES.filter(c=>(selectedCategory==='전체'||c.category===selectedCategory)&&(!searchText||[c.title,c.tagline,c.intro,c.category].join(' ').toLowerCase().includes(searchText.toLowerCase())));
  return '<section class="page-lead"><span class="eyebrow">ALL FILES · '+CASES.length+' CASES</span><h1>사건 보관소</h1><p>골라서 풀어보세요. 같은 사건도 다시 도전하면 최고 점수가 갱신됩니다.</p></section>'
    +'<section class="archive-controls"><div class="filters" role="group" aria-label="사건 유형 선택">'+['전체',...CATEGORY_NAMES].map(cat=>'<button type="button" data-action="filter" data-category="'+e(cat)+'" class="chip '+(selectedCategory===cat?'active':'')+'">'+e(cat)+'</button>').join('')+'</div><label class="search-field"><span>⌕</span><input id="case-search" type="search" placeholder="사건 검색" aria-label="사건 검색" value="'+e(searchText)+'"></label></section>'
    +'<section class="case-grid archive-grid">'+(filtered.length?filtered.map(c=>caseCard(c)).join(''):'<p class="empty-state">조건에 맞는 사건이 없습니다.</p>')+'</section>';
}
function records(){
  const s=stats();
  const sorted=[...saved.history].sort((a,b)=>b.finished-a.finished);
  return '<section class="page-lead"><span class="eyebrow">DETECTIVE DOSSIER</span><h1>나의 수사 기록</h1><p>이 기기에 저장된 플레이 기록입니다. 다른 기기와 자동으로 동기화되지 않습니다.</p></section>'
  +'<div class="record-metrics"><div><span>도전 사건</span><strong>'+s.played+'</strong><small>건</small></div><div><span>해결 사건</span><strong>'+s.solved+'</strong><small>건</small></div><div><span>평균 최고 점수</span><strong>'+s.avg+'</strong><small>점</small></div><div><span>누적 도전</span><strong>'+s.attempts+'</strong><small>회</small></div></div>'
  +'<section class="section">'+sectionTitle('CASE HISTORY','수사 완료 기록','최근 해결한 사건 순서로 표시합니다.')
  +(sorted.length?'<div class="history-list">'+sorted.map(h=>{const c=CASE_BY_ID[h.caseId];if(!c)return '';return '<a href="#/case/'+c.id+'" class="history-item"><span class="history-number">'+c.number+'</span><span class="history-text"><strong>'+e(c.title)+'</strong><small>'+new Date(h.finished).toLocaleDateString('ko-KR')+' · '+duration(h.seconds)+' · '+(h.solved?'해결':'미해결')+'</small></span><strong class="history-score">'+h.score+'점</strong><span class="history-arrow">↗</span></a>';}).join('')+'</div>':'<div class="empty-panel"><span class="empty-icon">⌕</span><h3>아직 수사 기록이 없습니다</h3><p>첫 사건을 해결하고 탐정 기록을 남겨보세요.</p><a href="#/archive" class="btn btn-gold">사건 선택하기</a></div>')
  +'</section><button class="quiet-button" data-action="clear-records">이 기기의 기록 삭제</button>';
}
function guide(){
  return '<section class="page-lead"><span class="eyebrow">DETECTIVE HANDBOOK</span><h1>수사 가이드</h1><p>소소킹은 읽는 판결문이 아니라 직접 참여하는 짧은 추리 게임입니다.</p></section>'
  +'<div class="guide-grid"><div class="guide-block"><span>01 / 조사</span><h2>현장 단서를 확보하세요</h2><p>증거 카드를 누르면 조사 내용이 드러납니다. 최소 세 개의 증거를 확보해야 다음 단계로 갈 수 있습니다.</p></div>'
  +'<div class="guide-block"><span>02 / 신문</span><h2>거짓 진술을 반박하세요</h2><p>증인을 골라 진술을 듣고, 모순되는 물증을 제시하세요. 틀린 증거를 제출하면 점수가 차감됩니다.</p></div>'
  +'<div class="guide-block"><span>03 / 법정</span><h2>결정적인 선택을 하세요</h2><p>책임이 있는 인물과 핵심 증거를 모두 선택해야 제출할 수 있습니다. 힌트를 사용하면 감점됩니다.</p></div>'
  +'<div class="guide-block"><span>비용 / 운영</span><h2>실시간 AI 없는 플레이</h2><p>현재 사건은 미리 작성·검수되어 저장돼 있습니다. 게임 중 AI 판결문을 생성하거나 AI API를 호출하지 않습니다.</p></div></div>'
  +'<div class="guide-notice"><strong>안내</strong><p>사건과 등장인물은 모두 창작된 오락용 이야기입니다. 실제 수사 또는 법률 판단과 관계없습니다. 기록은 이 브라우저에만 저장됩니다.</p></div>';
}
function defaultRun(id){
  return {v:APP_VERSION,caseId:id,stage:'brief',found:[],interviews:[],contradiction:false,mistakes:0,hint:false,culprit:'',keyClue:'',started:Date.now()};
}
function openCase(id,restart=false){
  if(!CASE_BY_ID[id]){location.hash='#/archive';return;}
  if(run&&run.caseId===id&&!restart)return;
  if(!restart && saved.drafts[id] && saved.drafts[id].v===APP_VERSION){
    const draft=saved.drafts[id];
    run={...draft,found:Array.isArray(draft.found)?draft.found:[],interviews:Array.isArray(draft.interviews)?draft.interviews:[]};
  }else run=defaultRun(id);
  activeWitness='';feedback='';
}
function remember(){
  if(run&&run.stage!=='result'){saved.drafts[run.caseId]={...run};persist();}
}
function progress(){
  if(!run)return '';
  const stages=[['brief','접수'],['search','현장수사'],['interrogate','증인신문'],['court','법정공방'],['result','결과']];
  const at=stages.findIndex(s=>s[0]===run.stage);
  return '<div class="steps" aria-label="수사 진행 단계">'+stages.map((s,i)=>'<div class="step '+(i===at?'current':i<at?'done':'')+'"><span>'+String(i+1).padStart(2,'0')+'</span><b>'+s[1]+'</b></div>').join('')+'</div>';
}
function caseLayout(c,body){
 return '<div class="play-wrap"><div class="play-toolbar"><a href="#/archive" class="backlink">← 사건 보관소</a><span class="case-label">CASE FILE '+c.number+'</span><span id="session-timer" class="session-timer">'+duration(elapsed())+'</span></div>'
 +'<div class="play-header"><span class="eyebrow">'+e(c.kicker)+' · '+levelStars(c.level)+'</span><h1>'+e(c.title)+'</h1><p>'+e(c.tagline)+'</p></div>'
 +progress()+'<div class="play-content">'+body+'</div></div>';
}
function briefing(c){
 return '<div class="brief-grid"><div class="brief-main"><div class="paper-top"><span>INCIDENT REPORT</span><b>#'+c.number+'</b></div><h2>사건 브리핑</h2><p class="brief-story">'+e(c.intro)+'</p><div class="case-facts"><div><span>발생 장소</span><strong>'+e(c.location)+'</strong></div><div><span>확인 시각</span><strong>'+e(c.time)+'</strong></div><div><span>당시 날씨</span><strong>'+e(c.weather)+'</strong></div></div><div class="brief-head">수사 전 확인 사항</div><ol class="brief-list">'+c.notes.map(x=>'<li>'+e(x)+'</li>').join('')+'</ol><button type="button" class="btn btn-gold btn-wide" data-action="begin">현장으로 이동 →</button></div>'
 +'<aside class="brief-aside"><div class="brief-emblem">⌕</div><span>ASSIGNED DETECTIVE</span><h3>당신이 담당 수사관입니다</h3><p>사건은 자동으로 해결되지 않습니다. 직접 단서를 조사하고 모순을 찾아야 법정에 설 수 있습니다.</p><div class="aside-divider"></div><small>수집 가능한 증거</small><strong>04</strong><small>신문 가능 인물</small><strong>03</strong></aside></div>';
}
function searchScene(c){
 return '<div class="play-panel"><div class="play-intro"><span class="eyebrow">PHASE 01 / CRIME SCENE</span><h2>현장수사</h2><p>증거물에 접근해 내용을 확인하세요. 최소 3개의 증거를 조사하면 신문을 시작할 수 있습니다.</p></div>'
 +'<div class="scene-board theme-'+c.theme+'"><div class="scene-top"><span>SCENE / '+e(c.location)+'</span><span>SECURE ZONE · '+e(c.time)+'</span></div><div class="scene-grid">'+c.clues.map((clue,i)=>'<button type="button" data-action="inspect" data-id="'+clue.id+'" class="scene-object '+(run.found.includes(clue.id)?'found':'')+'"><span class="scene-idx">'+String(i+1).padStart(2,'0')+'</span><span class="scene-icon">'+(['▤','⌕','▣','◈'][i])+'</span><strong>'+e(clue.name)+'</strong><small>'+(run.found.includes(clue.id)?'조사 완료 ✓':'조사하기 +')+'</small></button>').join('')+'</div></div>'
 +'<div class="evidence-section"><div class="split-heading"><h3>증거 파일 <span>'+run.found.length+' / '+c.clues.length+'</span></h3><span class="light-caption">눌러서 세부 내용 확인</span></div><div class="evidence-grid">'+(run.found.length?c.clues.filter(x=>run.found.includes(x.id)).map(clue=>'<button type="button" class="evidence-card" data-action="inspect" data-id="'+clue.id+'"><span class="evidence-label">EVIDENCE / '+e(clue.tag)+'</span><strong>'+e(clue.name)+'</strong><small>기록 열기 ↗</small></button>').join(''):'<div class="evidence-placeholder">아직 확보한 증거가 없습니다. 현장의 물건을 조사하세요.</div>')+'</div></div>'
 +'<div class="stage-footer"><span>'+run.found.length+' / 3개 최소 수집</span><button class="btn btn-gold" type="button" data-action="interrogate" '+(run.found.length<3?'disabled':'')+'>증인신문으로 →</button></div></div>';
}
function interrogate(c){
 const w=c.witnesses.find(x=>x.id===activeWitness);
 return '<div class="play-panel"><div class="play-intro"><span class="eyebrow">PHASE 02 / INTERROGATION</span><h2>증인신문</h2><p>증인의 진술과 수집한 증거를 대조하세요. 모순을 찾아내면 추가 점수를 획득합니다.</p></div>'
 +'<div class="interrogation-layout"><div class="witness-grid">'+c.witnesses.map((x,i)=>'<button type="button" class="witness-card '+(activeWitness===x.id?'active ':'')+(run.interviews.includes(x.id)?'questioned':'')+'" data-action="witness" data-id="'+x.id+'"><span class="witness-avatar">'+['01','02','03'][i]+'</span><strong>'+e(x.name)+'</strong><small>'+e(x.role)+'</small><em>'+(run.interviews.includes(x.id)?'진술 확인 ✓':'신문하기 ↗')+'</em></button>').join('')+'</div>'
 +'<div class="testimony">'+(w?'<div class="testimony-heading"><span>WITNESS STATEMENT</span><b>'+e(w.name)+'</b></div><p class="testimony-question">Q. '+e(w.question)+'</p><blockquote>'+e(w.statement)+'</blockquote><p class="testimony-follow">'+e(w.follow)+'</p><div class="cross-title">이 진술에 반박할 증거가 있나요?</div><div class="cross-evidence">'+c.clues.filter(x=>run.found.includes(x.id)).map(clue=>'<button data-action="challenge" data-id="'+clue.id+'" type="button">'+e(clue.name)+' ↗</button>').join('')+'</div>': '<div class="testimony-empty"><span>❞</span><h3>신문할 인물을 선택하세요</h3><p>왼쪽 인물을 누르면 진술을 확인할 수 있습니다.</p></div>')+'</div></div>'
 +(feedback?'<div class="feedback-box '+(feedback.startsWith('정확')?'success':'')+'" role="status">'+e(feedback)+'</div>':'')
 +'<div class="stage-footer"><span>진술 확인 '+run.interviews.length+'/3 · 모순 '+(run.contradiction?'발견':'미발견')+'</span><button class="btn btn-gold" type="button" data-action="court" '+(run.interviews.length<2?'disabled':'')+'>법정으로 →</button></div></div>';
}
function courtroom(c){
 const suspects=c.witnesses;
 return '<div class="play-panel"><div class="play-intro"><span class="eyebrow">PHASE 03 / FINAL ARGUMENT</span><h2>최후의 법정</h2><p>책임이 있는 인물과 결정적 물증을 선택하세요. 최종 제출 이후에는 답을 바꿀 수 없습니다.</p></div>'
 +'<div class="courtroom-banner"><span>THE TRUTH WILL BE REVEALED</span><div>⚖</div><strong>최후의 증명</strong></div>'
 +'<div class="court-selections"><div class="court-group"><div class="court-question"><span>01 / PERSON</span><h3>누가 사건을 일으켰습니까?</h3></div><div class="court-options">'+suspects.map(x=>'<button type="button" data-action="culprit" data-id="'+x.id+'" class="court-option '+(run.culprit===x.id?'selected':'')+'"><span class="choice-dot"></span><span><strong>'+e(x.name)+'</strong><small>'+e(x.role)+'</small></span></button>').join('')+'</div></div>'
 +'<div class="court-group"><div class="court-question"><span>02 / EVIDENCE</span><h3>결정적 증거는 무엇입니까?</h3></div><div class="court-options">'+c.clues.filter(x=>run.found.includes(x.id)).map(x=>'<button type="button" data-action="key" data-id="'+x.id+'" class="court-option '+(run.keyClue===x.id?'selected':'')+'"><span class="choice-dot"></span><span><strong>'+e(x.name)+'</strong><small>'+e(x.tag)+'</small></span></button>').join('')+'</div></div></div>'
 +'<div class="hint-row"><button type="button" class="hint-button" data-action="hint">'+(run.hint?'힌트 확인됨':'힌트 보기 (8점 감점)')+'</button>'+(run.hint?'<p>'+e(c.hint)+'</p>':'')+'</div>'
 +'<div class="stage-footer"><span>최종 증거 제출 · 1회</span><button type="button" class="btn btn-gold" data-action="submit" '+(!run.culprit||!run.keyClue?'disabled':'')+'>최종 증거 제출 →</button></div></div>';
}
function finish(c){
 const result=run.final;
 if(!result)return '';
 const winner=c.witnesses.find(x=>x.id===c.answer);
 const clue=c.clues.find(x=>x.id===c.keyClue);
 return '<div class="result-view"><span class="eyebrow">CASE CLOSED / '+c.number+'</span><div class="result-seal">'+(result.solved?'✓':'!')+'</div><h2>'+(result.solved?'사건의 진상을 밝혀냈습니다':'결정적인 단서를 놓쳤습니다')+'</h2><p>'+e(badgeFor(result.score))+'</p>'
 +'<div class="result-score"><strong>'+result.score+'</strong><span>/ 100 POINTS</span></div><div class="result-mini"><span>수사 시간 <b>'+duration(result.seconds)+'</b></span><span>확보한 증거 <b>'+run.found.length+'개</b></span><span>신문 성공 <b>'+(run.contradiction?'1회':'0회')+'</b></span></div>'
 +'<div class="solution-card"><span>THE TRUTH / 사건의 진상</span><h3>책임 인물: '+e(winner.name)+'</h3><p>'+e(c.reveal)+'</p><div class="solution-fact"><span>결정적 증거</span><strong>'+e(clue.name)+'</strong></div><div class="solution-fact"><span>사건 결론</span><strong>'+e(c.motive)+'</strong></div></div>'
 +'<div class="score-breakdown"><span>정답 인물 <b>'+(result.correctCulprit?'50점':'0점')+'</b></span><span>핵심 증거 <b>'+(result.correctEvidence?'25점':'0점')+'</b></span><span>진술 반박 <b>'+(run.contradiction?'15점':'0점')+'</b></span><span>기본 수사 <b>'+(run.found.length>=3?'10점':'0점')+'</b></span><span>오답·힌트 감점 <b>-'+(run.mistakes*5+(run.hint?8:0))+'점</b></span></div>'
 +'<div class="result-actions"><button type="button" data-action="replay" class="btn btn-outline">다시 도전하기</button><a href="#/archive" class="btn btn-gold">다른 사건 수사하기 →</a></div></div>';
}
function renderPlay(id){
 const c=CASE_BY_ID[id];if(!c)return archive();
 openCase(id);
 const map={brief:briefing,search:searchScene,interrogate,court:courtroom,result:finish};
 return caseLayout(c,(map[run.stage]||briefing)(c));
}
function render(){
 const route=decodeURIComponent(location.hash.replace(/^#\/?/,'')||'');
 const [page,id]=route.split('/');
 nav.querySelectorAll('a').forEach(a=>{const key=a.getAttribute('data-nav');a.classList.toggle('active',key===page||(key==='home'&&!route));});
 if(page==='case'&&id){contentRoot.innerHTML=renderPlay(id);document.title=CASE_BY_ID[id]?CASE_BY_ID[id].title+' | 소소킹 사건파일':'소소킹 사건파일';}
 else {run=null;contentRoot.innerHTML=page==='archive'?archive():page==='records'?records():page==='guide'?guide():home();document.title='소소킹 사건파일 | 직접 풀어내는 수사·법정 게임';}
 window.scrollTo({top:0,behavior:'instant'}); updateTimer();
}
function updateTimer() {
 if(ticker){clearInterval(ticker);ticker=null;}
 if(run&&run.stage!=='result'){
  ticker=setInterval(()=>{const el=document.querySelector('#session-timer');if(el)el.textContent=duration(elapsed());},1000);
 }
}
function draw(){if(!run)return;const c=CASE_BY_ID[run.caseId];contentRoot.innerHTML=caseLayout(c,({brief:briefing,search:searchScene,interrogate,court:courtroom,result:finish}[run.stage])(c));updateTimer();remember();}
function showEvidence(clue){
 const modal=document.querySelector('#evidence-dialog');
 modal.querySelector('.modal-label').textContent='EVIDENCE '+clue.tag.toUpperCase();
 modal.querySelector('.modal-title').textContent=clue.name;
 modal.querySelector('.modal-copy').textContent=clue.detail;
 if(typeof modal.showModal==='function')modal.showModal();
}
function complete(){
 const c=CASE_BY_ID[run.caseId];const correctCulprit=run.culprit===c.answer;const correctEvidence=run.keyClue===c.keyClue;
 const score=Math.max(0,Math.min(100,(correctCulprit?50:0)+(correctEvidence?25:0)+(run.contradiction?15:0)+(run.found.length>=3?10:0)-run.mistakes*5-(run.hint?8:0)));
 run.final={correctCulprit,correctEvidence,score,solved:correctCulprit&&correctEvidence,seconds:elapsed()};
 run.stage='result';
 saved.history.unshift({caseId:c.id,score,solved:run.final.solved,seconds:run.final.seconds,finished:Date.now()});
 saved.history=saved.history.slice(0,200);
 delete saved.drafts[c.id];persist();draw();
}
contentRoot.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action;const id=button.dataset.id;
 if(action==='filter'){selectedCategory=button.dataset.category;contentRoot.innerHTML=archive();return;}
 if(action==='clear-records'){if(confirm('이 기기에 저장한 모든 게임 기록과 진행 중인 수사를 삭제할까요?')){saved={history:[],drafts:{}};persist();render();}return;}
 if(!run && action!=='filter')return;
 const c=CASE_BY_ID[run.caseId];
 if(action==='begin'){run.stage='search';draw();}
 else if(action==='inspect'){const clue=c.clues.find(x=>x.id===id);if(!clue)return;if(!run.found.includes(id))run.found.push(id);draw();showEvidence(clue);}
 else if(action==='interrogate'&&run.found.length>=3){run.stage='interrogate';draw();}
 else if(action==='witness'){activeWitness=id;if(!run.interviews.includes(id))run.interviews.push(id);feedback='';draw();}
 else if(action==='challenge'){
  if(!activeWitness||!run.found.includes(id))return;
  const correct=activeWitness===c.contradiction.witness&&id===c.contradiction.clue;
  if(correct){run.contradiction=true;feedback='정확한 반박! '+c.contradiction.line;}
  else {run.mistakes++;feedback='이 증거만으로는 진술을 뒤집기 어렵습니다. 다른 근거를 확인하세요. (-5점)';}
  draw();
 }
 else if(action==='court'&&run.interviews.length>=2){run.stage='court';draw();}
 else if(action==='culprit'){run.culprit=id;draw();}
 else if(action==='key'){run.keyClue=id;draw();}
 else if(action==='hint'){run.hint=true;draw();}
 else if(action==='submit'&&run.culprit&&run.keyClue){if(confirm('이 인물과 증거로 최종 결론을 제출할까요?'))complete();}
 else if(action==='replay'){openCase(c.id,true);draw();}
});
contentRoot.addEventListener('input',event=>{
 if(event.target.id!=='case-search')return;
 searchText=event.target.value;
 const cursor=event.target.selectionStart;
 contentRoot.innerHTML=archive();
 const input=contentRoot.querySelector('#case-search');input?.focus();input?.setSelectionRange(cursor,cursor);
});
document.querySelector('#evidence-dialog .modal-close')?.addEventListener('click',()=>document.querySelector('#evidence-dialog').close());
document.querySelector('#evidence-dialog')?.addEventListener('click',event=>{if(event.target.tagName==='DIALOG')event.target.close();});
window.addEventListener('hashchange',()=>{remember();render();});
window.addEventListener('pagehide',remember);
document.querySelector('#menu-toggle')?.addEventListener('click',()=>document.querySelector('#site-nav').classList.toggle('open'));
nav.addEventListener('click',e=>{if(e.target.closest('a'))nav.classList.remove('open');});
render();