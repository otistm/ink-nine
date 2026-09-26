/* Ink Nine: Save and resume, the tutorial coach, and the between-hole cards. */
"use strict";
/* ============================================================
   SAVE & RESUME — the round in progress lives in localStorage, so a refresh picks up where you were.
   Snapshots are taken at every safe moment: hole start, after each shot comes to rest, as a swing
   is struck (so refreshing mid-flight still counts the stroke), on holing out, and on every card.
   ============================================================ */
const RUN_KEY='inknine-run';
/* ============================================================
   TUTORIAL — three holes on the Practice Green with a coach that
   explains one thing at a time and moves on when you've done it.
   ============================================================ */
const TUT_EVENT={id:'tutorial',name:'Tutorial',course:3,tier:0,blurb:'',forced:()=>false,double:()=>false,rewards:0,curses:0,wind:[0,0]};
const TUT_STEPS=[
 {hole:0,text:'Drag back anywhere on the course, then let go. The farther you pull, the harder you swing. The ring shows where the ball will land.',until:e=>e.t==='shot'},
 {hole:0,text:'Every club flies a different distance, shown on its chip. Tap a club that reaches the green, then swing.',target:'#clubs',until:e=>e.t==='shot'},
 {hole:0,text:'While you hold, a ring shrinks onto the ball. Let go just as it lands for a pure strike: straighter, and worth bonus points.',until:(e,st)=>e.t==='shot'&&(e.q==='pure'||++st.n>=2)},
 {hole:0,text:'On the green, pick the putter. Drifting chevrons show which way the green slopes. Roll it in.',target:'#clubs button:nth-child(8)',until:e=>false},
 {hole:1,text:'Trees block the corner. As you pull back, bow your drag sideways to curve the ball around them. The aim line bends to show the curve.',until:(e,st)=>e.t==='shot'&&(Math.abs(e.curve)>=.3||++st.n>=2)},
 {hole:1,text:'Tap the telescope to see the whole hole. Drag to look around, then tap it again to come back.',target:'#scope',until:e=>e.t==='look'||e.t==='shot'},
 {hole:1,text:'The ink shading shows mounds and slopes. They kick and steer the ball, so play around them. Finish the hole.',until:e=>false},
 {hole:2,text:'Water in front. Pick the pitching wedge, tap the ball button, and drag the dot to the bottom for a flop: high, with backspin that stops it fast.',target:'#strike',until:e=>e.t==='shot'&&e.strike<=-.3},
 {hole:2,text:'The small dot past the landing ring shows where the ball should stop rolling. Finish the hole.',until:e=>false}
];
const TUT={on:false,i:0,st:{n:0}};
function coachShow(){
  const el=$('coach'); if(!TUT.on){ el.hidden=true; document.querySelectorAll('.coach-hl').forEach(x=>x.classList.remove('coach-hl')); return; }
  const step=TUT_STEPS[TUT.i]; if(!step||step.hole!==S.hole){ el.hidden=true; return; }
  el.hidden=!(S.state==='aim'||S.state==='flight'||S.state==='ghost');
  $('coachN').textContent=`Tip ${TUT.i+1} of ${TUT_STEPS.length}`; $('coachT').textContent=step.text;
  document.querySelectorAll('.coach-hl').forEach(x=>x.classList.remove('coach-hl'));
  if(step.target&&!el.hidden){ const t=document.querySelector(step.target); if(t) t.classList.add('coach-hl'); }
}
function coachEvent(e){
  if(!TUT.on) return; const step=TUT_STEPS[TUT.i];
  if(e.t==='hole'){ while(TUT_STEPS[TUT.i]&&TUT_STEPS[TUT.i].hole<e.i) TUT.i++; TUT.st={n:0}; coachShow(); return; }
  if(step&&step.hole===S.hole&&step.until(e,TUT.st)){ TUT.i++; TUT.st={n:0}; const el=$('coach'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); tone(760,.1,'sine',.07,980); }
  coachShow();
}
function startTutorial(){
  S.state='card'; EV=TUT_EVENT; HOLES=COURSE_TUT; COURSE_PAR=HOLES.reduce((a,h)=>a+h.par,0);
  Object.assign(S,{rec:[],friends:[],earned:0,hole:0,scores:[],holeLog:[],points:0,holePts:0,streak:0,upg:{},bag:[0,1,2,3,4,5,6,7],club:0,firstShot:false,twist:STRAIGHT,allowed:null,banked:false,prevPos:null,field:[]});
  S.disp=0; $('pv').textContent='0'; $('hint').style.opacity=0; computeMod(); updPts();
  TUT.on=true; TUT.i=0; TUT.st={n:0}; $('card').hidden=true; startHole(0);
}
function endTutorial(){ TUT.on=false; coachShow(); }
function saveRun(phase,extra){
  if(!EV||EV.id==='tutorial') return; const b=S.ball;
  const snap={v:1,ev:EVENTS.indexOf(EV),phase,hole:S.hole,scores:S.scores,holeLog:S.holeLog,points:S.points,holePts:S.holePts,streak:S.streak,upg:S.upg,bag:S.bag,club:S.club,
    twist:S.twist,allowed:S.allowed,field:S.field,rec:S.rec,earned:S.earned||0,prevPos:S.prevPos||null,cloverUsed:S.cloverUsed,wind:S.wind,ball:{x:b.x,y:b.y},strokes:S.strokes,
    last:S.last,firstShot:S.firstShot,banked:S.banked,at:Date.now(),...(extra||{})};
  try{ localStorage.setItem(RUN_KEY,JSON.stringify(snap)); }catch(e){}
}
function clearRun(){ try{ localStorage.removeItem(RUN_KEY); }catch(e){} }
function loadRun(){ try{ const r=JSON.parse(localStorage.getItem(RUN_KEY)||'null'); return r&&r.v===1&&EVENTS[r.ev]?r:null; }catch(e){ return null; } }
function resumeRun(r){
  try{
    EV=EVENTS[r.ev]; HOLES=COURSES[EV.course].holes; COURSE_PAR=HOLES.reduce((a,h)=>a+h.par,0);
    Object.assign(S,{hole:r.hole||0,scores:r.scores||[],holeLog:r.holeLog||[],points:r.points||0,holePts:r.holePts||0,streak:r.streak||0,upg:r.upg||{},bag:r.bag||START_BAG.slice(),
      club:r.club||0,twist:r.twist||STRAIGHT,allowed:r.allowed||null,field:r.field||RIVALS.map(x=>({...x,scores:[]})),rec:r.rec||[],earned:r.earned||0,prevPos:r.prevPos||null,
      cloverUsed:!!r.cloverUsed,firstShot:r.firstShot!==false,banked:!!r.banked,strokes:r.strokes||0,last:r.last||{x:0,y:0},friends:[],ghosts:[]});
    S.disp=S.points+S.holePts; $('pv').textContent=Math.round(S.disp).toLocaleString(); $('hint').style.opacity=S.firstShot?1:0;
    computeMod(); updPts(); loadFriends(EV); loadMine(EV);
    if(r.phase==='twist'){ showTwist(r.hole,r.opts); return true; }
    if(r.phase==='reward'){ showCard(r.offer); return true; }
    const h=H(), b=S.ball; S.wind=r.wind||{x:0,y:0,mph:0};
    Object.assign(b,{x:r.ball.x,y:r.ball.y,z:zgAt(h,r.ball.x,r.ball.y),vx:0,vy:0,vz:0,mode:'rest',trail:[],inTree:-1});
    if(!S.rec[S.hole]) S.rec[S.hole]={s:0,tw:S.twist.name||'',shots:[]};
    parts.length=0; S.fp=0; S.fpv=0; S.slow=1; $('card').hidden=true; refreshChips();
    if(r.phase==='holed'){ S.state='card'; finishHole(S.strokes); return true; }
    S.state='aim'; updHUD(); measureView(); frameAim(); cam.x=camT.x; cam.y=camT.y; cam.z=camT.z; cam.vx=cam.vy=0; updHUD();
    callout('Welcome back',`Hole ${S.hole+1}, stroke ${S.strokes+1}`);
    return true;
  }catch(e){ console.warn('Could not resume',e); clearRun(); return false; }
}
function startEvent(k){
  endTutorial();
  clearRun();
  S.state='card'; EV=EVENTS[k]; HOLES=COURSES[EV.course].holes; COURSE_PAR=HOLES.reduce((a,h)=>a+h.par,0);
  S.rec=[]; S.friends=[]; loadFriends(EVENTS[k]); loadMine(EVENTS[k]);
  Object.assign(S,{earned:0,hole:0,scores:[],holeLog:[],points:0,holePts:0,streak:0,upg:{},bag:START_BAG.slice(),club:0,firstShot:true,twist:STRAIGHT,allowed:null,banked:false,prevPos:null});
  S.field=RIVALS.map(r=>({...r,scores:[]}));
  S.disp=0; $('pv').textContent='0'; $('hint').style.opacity=1; computeMod(); updPts();
  const b=S.ball, h=HOLES[0]; Object.assign(b,{x:h.tee[0],y:h.tee[1],z:0,mode:'rest',trail:[]}); cam.x=h.tee[0]; cam.y=h.tee[1]-120;
  showTwist(0);
}
function showCard(offerIn){
  if(EV&&EV.id==='tutorial'){ coachShow(); const done=S.scores.length, L=S.holeLog[done-1];
    if(done>=HOLES.length){ const first=!meta.tutDone; meta.tutDone=true; if(first) meta.wallet+=1000; saveMeta(); endTutorial();
      $('panel').innerHTML=`<h2>You're ready</h2><p>That's the whole toolkit: power, clubs, tempo, curve, the telescope and the strike dial.</p>${first?'<p class="wal">+1,000 points for the pro shop</p>':''}<button class="btn" id="go">Back to the clubhouse</button>`;
      $('card').hidden=false; $('card').classList.remove('home'); $('go').addEventListener('click',()=>{ sfx('tick'); showHome(); }); blips(4); return; }
    $('panel').innerHTML=`<p class="evn">Tutorial, hole ${done} of ${HOLES.length}</p><h2>${L.name}</h2><p>Next up: ${HOLES[done].name}. ${HOLES[done].tip}</p><button class="btn" id="go">Next hole</button><button class="btn ghost" id="quitTut">Skip the rest</button>`;
    $('card').hidden=false; $('card').classList.remove('home');
    $('go').addEventListener('click',()=>{ sfx('tick'); $('card').hidden=true; S.twist=STRAIGHT; computeMod(); startHole(done); });
    $('quitTut').addEventListener('click',()=>{ sfx('tick'); endTutorial(); showHome(); });
    return; }
  const done=S.scores.length, final=done===9;
  const tot=S.scores.reduce((a,b)=>a+b,0), par=HOLES.slice(0,done).reduce((a,h)=>a+h.par,0);
  const head='<tr><th>Hole</th>'+HOLES.map((_,i)=>`<th${i===done-1?' class="cur"':''}>${i+1}</th>`).join('')+'<th>Tot</th></tr>';
  const pr='<tr><td>Par</td>'+HOLES.map(h=>`<td>${h.par}</td>`).join('')+`<td class="tot">${COURSE_PAR}</td></tr>`;
  const yr='<tr><td>You</td>'+HOLES.map((h,i)=>`<td>${S.scores[i]!=null?mark(S.scores[i],h.par):''}</td>`).join('')+`<td class="tot">${tot}</td></tr>`;
  const pp='<tr><td>Pts</td>'+HOLES.map((h,i)=>`<td class="pp">${S.holeLog[i]?fmtK(S.holeLog[i].total):''}</td>`).join('')+`<td class="pp">${fmtK(S.points)}</td></tr>`;
  const table=`<table class="sc">${head}${pr}${yr}${pp}</table>`, last=S.scores[done-1], L=S.holeLog[done-1];
  if(final){
    clearRun();
    const rows=standings(), place=placeOf(rows), medal=MEDALS[place-1];
    saveRound().then(ok=>{ const el=document.getElementById('savedNote'); if(el&&ok) el.textContent='Your best round is saved. Friends will see your ghost on every hole.'; });
    const T=loadJSON('inknine-trophies',{}), B=loadJSON('inknine-bests',{}), rank=m=>m?3-MEDALS.indexOf(m):0;
    const hadAny=!!T[EV.id], upgraded=medal&&rank(medal)>rank(T[EV.id]); if(upgraded){ T[EV.id]=medal; saveJSON('inknine-trophies',T); }
    const nb=S.points>(B[EV.id]||0); if(nb){ B[EV.id]=S.points; saveJSON('inknine-bests',B); }
    const unlock=EVENTS[EVENTS.indexOf(EV)+1];
    $('panel').innerHTML=`<p class="evn">${EV.name}</p><h2>${place===1?'Champion!':`${ordinal(place)} place`}</h2>
      ${medal?`<div class="award">${trophySVG(medal,92)}<p>${medal} trophy${upgraded?'':', matching your best'}</p></div>`:`<p>Top three takes home a trophy. ${toParStr(rows.find(r=>r.you).tp)} this time.</p>`}
      <p>${tot} strokes, ${toPar(tot-par)}, ${S.points.toLocaleString()} points${nb?', a new best':''}</p><p class="wal">+${(S.earned||0).toLocaleString()} to spend in the pro shop</p><p class="wal" id="savedNote"></p>
      ${medal&&unlock&&!hadAny?`<p class="unlock">${unlock.name} is now open.</p>`:''}
      ${boardHTML()}${table}${kitLine()}
      <button class="btn" id="go">Back to the clubhouse</button><button class="btn ghost" id="again">Play this invitational again</button>`;
    if(medal){ blips(5); setTimeout(()=>{ tone(523,.25,'triangle',.12); setTimeout(()=>tone(659,.25,'triangle',.12),160); setTimeout(()=>tone(784,.5,'triangle',.14),320); },400); }
    $('go').addEventListener('click',()=>{ sfx('tick'); showHome(); });
    $('again').addEventListener('click',()=>{ sfx('tick'); startEvent(EVENTS.indexOf(EV)); });
  } else {
    loadFriends(EV);
    const offer=offerIn||rewardOffer(EV.rewards); saveRun('reward',{offer});
    $('panel').innerHTML=`<p class="evn">${EV.name}, hole ${done} of 9</p><h2>${L.name}</h2><p>Hole ${done} in ${last}, ${toPar(tot-par)} through ${done}</p>${breakdown(L)}${boardHTML()}${ONLINE_OUTSIDE?`<p class="netline" id="netnote">Saving online…</p>`:''}`+
      (offer.length?`<h3>Choose a reward</h3><div class="picks">${offer.map((o,k)=>pickHTML({...o,tag:o.kind==='club'?'New club':o.kind==='curse'?'Curse, with an upside':'Ball upgrade'},k)).join('')}</div>`:`<button class="btn" id="go">Continue</button>`)+table;
    if(offer.length) wirePicks((k,btn)=>{ const o=offer[k]; if(o.kind==='club'){ S.bag.push(o.i); if(!meta.unlocked.includes(o.i)){ meta.unlocked.push(o.i); saveMeta(); } } else S.upg[o.id]=true;
      btn.classList.add('chosen'); blips(3); computeMod(); setTimeout(()=>showTwist(done),380); });
    else $('go').addEventListener('click',()=>showTwist(done));
  }
  $('card').hidden=false; $('card').scrollTop=0; $('card').classList.toggle('home',S.state==='home');
}
function twistOptions(i){
  const pool=TWISTS.filter(t=>t.id!=='short'||S.bag.filter(k=>k!==PUTTER).length>=4);
  if(EV.double(i)){ const out=[], seen=new Set(); let guard=0;
    while(out.length<3&&guard++<50){ const [a,b]=shuffle(pool.slice()).slice(0,2), key=[a.id,b.id].sort().join();
      if(seen.has(key)) continue; seen.add(key); out.push({id:'combo',ids:[a.id,b.id],name:`${a.name} + ${b.name}`,desc:`${a.desc} ${b.desc}`,mult:+(a.mult*b.mult).toFixed(2)}); }
    return out; }
  if(EV.forced(i)) return shuffle(pool.slice()).slice(0,3);
  return [STRAIGHT,...shuffle(pool.slice()).slice(0,2)];
}
function showTwist(i,optsIn){
  const h=HOLES[i], opts=optsIn||twistOptions(i); saveRun('twist',{opts,hole:i});
  const how=i===0&&EV.id==='meadow'?`<div class="how">Pick a club, then drag back anywhere and let go. Bow your drag sideways to bend the shot. A ring shrinks onto the ball as you hold: let go as it lands for a pure strike. The ball button bottom-left sets where you strike it: low for a high, spinning flop, high for a low running knockdown.</div>`:'';
  const note=EV.double(i)?'This hole stacks two twists.':EV.forced(i)?'This hole forces a twist.':'Pick a twist';
  $('panel').innerHTML=`<p class="evn">${EV.name}, ${COURSES[EV.course].name}</p><h2>Hole ${i+1}: ${h.name}</h2><p>Par ${h.par}, ${h.len} yards. ${h.tip}</p>${how}${ONLINE_OUTSIDE||IN_CLAUDE?`<p class="netline">${(()=>{ const fs=(S.friends||[]).filter(f=>f.holes[i]&&f.holes[i].shots&&f.holes[i].shots.length); return fs.length?`Ghosts on this hole: ${fs.map(f=>`${esc(f.name)} (${f.holes[i].s})`).join(', ')}.`:`No friend has played this hole yet${(S.friends||[]).length?'':' in this event'}.`; })()}</p>`:''}<h3>${note}</h3><div class="picks">${opts.map((o,k)=>pickHTML({...o,tag:o.ids.length===0?'Safe':o.ids.length>1?'Double twist':'Twist'},k)).join('')}</div>${kitLine()}<p class="ver"><button class="linkbtn" id="fbTw">Send feedback</button></p>`;
  $('card').hidden=false; $('card').scrollTop=0; $('card').classList.toggle('home',S.state==='home');
  $('fbTw').addEventListener('click',()=>{ sfx('tick'); showFeedback(()=>showTwist(i,opts)); });
  wirePicks((k,btn)=>{ const o=opts[k]; S.twist=o; btn.classList.add('chosen'); sfx('tick');
    if(o.ids.includes('short')){ const pick=shuffle(S.bag.filter(x=>x!==PUTTER)).slice(0,3); S.allowed=[...pick,PUTTER]; } else S.allowed=null;
    computeMod(); if(!usable(S.club)) S.club=S.bag.filter(usable).sort((a,b)=>a-b)[0];
    setTimeout(()=>{ $('card').hidden=true; startHole(i); },320); });
}
