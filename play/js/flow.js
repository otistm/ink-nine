/* Ink Nine: Hole flow: starting holes, aiming, shooting, penalties and holing out. */
"use strict";
/* ============================================================
   FLOW
   ============================================================ */
function startHole(i){
  if(look.on){ look.on=false; look.ptrs.clear(); setLookUI(); }
  openWind(false);
  S.hole=i; S.strokes=0; const h=H(), b=S.ball;
  Object.assign(b,{x:h.tee[0],y:h.tee[1],z:0,vx:0,vy:0,vz:0,mode:'rest',trail:[],inTree:-1});
  S.rec[i]={s:0,tw:S.twist.name||'',shots:[]}; S.ghosts=[];
  const ang=Math.random()*TAU, mph=Math.round(S.twist.ids.includes('gale')?15+Math.random()*10:EV.wind[0]+Math.random()*(EV.wind[1]-EV.wind[0]));
  S.wind={x:Math.cos(ang)*mph*.489,y:Math.sin(ang)*mph*.489,mph};
  parts.length=0; S.fp=0; S.fpv=0;
  S.holePts=0; S.banked=false; S.cloverUsed=false; S.slow=1; refreshChips();
  updHUD(); measureView();
  const aim=aimFrame(aimAngle());
  const g0=h.green[0], gz=Math.min(W,Hh-view.top-view.bot)*.5/(g0.rx*2+22);
  S.intro={t:0,from:{x:g0.x,y:g0.y,z:gz},to:aim};
  cam.x=g0.x; cam.y=g0.y; cam.z=gz; cam.vx=cam.vy=0; camT={...aim};
  S.state='intro';
  $('tn').textContent=`Hole ${i+1}`; $('tname').textContent=h.name; $('ttip').textContent=S.twist.ids.length?`${S.twist.name}. ${S.twist.desc}`:h.tip; $('tp').textContent=`Par ${h.par}`; $('tl').textContent=`${h.len} yards, wind ${mph} mph`;
  const t=$('title'); t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
  updHUD(); saveRun('aim');
}
function endIntro(){ if(S.state!=='intro') return; S.state='aim'; const t=$('title'); t.classList.remove('go'); updHUD(); coachEvent({t:'hole',i:S.hole}); }
function toAim(){
  setTimeout(()=>coachShow(),0);
  S.state='aim';
  if(S.strokes>=10){ callout('Picked up','Ten is the max on a hole'); finishHole(10); return; }
  frameAim(); updHUD();
}
function aimAngle(){ const b=S.ball,h=H(); return Math.atan2(h.cup[1]-b.y,h.cup[0]-b.x); }
function reachFor(c,lie){ return c.putter? Math.max(5,Math.min(30,distToCup()*1.25)) : CS(c).carry*lieFactor(c,lie)*MOD.carry; }
function aimFrame(ang){
  const b=S.ball,h=H(),c=CLUBS[S.club],lie=lieNow(),r=reachFor(c,lie);
  const pts=[[b.x,b.y],[b.x+Math.cos(ang)*r,b.y+Math.sin(ang)*r]];
  if(distToCup()<r*1.3) pts.push(h.cup);
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  const pad=44, uh=Hh-view.top-view.bot;
  const z=Math.max(1.1,Math.min(18,Math.min((W-pad*2)/(x1-x0+2),(uh-pad*2)/(y1-y0+2))));
  return {x:(x0+x1)/2,y:(y0+y1)/2,z};
}
function frameAim(){ camT=aimFrame(aimAngle()); }

const solveCache=new Map();
function solveCached(loft,spin,tgt){ const k=loft.toFixed(1)+':'+spin.toFixed(2)+':'+Math.round(tgt*2); let v=solveCache.get(k); if(v==null){ v=solveSpeed(loft,spin,Math.round(tgt*2)/2); solveCache.set(k,v); } return v; }
function simPath(x,y,ang,P,v,side){
  const lo=P.loft*Math.PI/180, b={x,y,z:0,vx:Math.cos(ang)*v*Math.cos(lo),vy:Math.sin(ang)*v*Math.cos(lo),vz:v*Math.sin(lo),spin:P.spin,side,check:P.check,back:P.back,rollMul:P.rollMul}, pts=[[x,y,0]];
  const h=H(); b.z=zgAt(h,x,y); let i=0;
  for(let t=0;t<20;t+=DT){ flightStep(b,{x:0,y:0},DT); const T=terrAt(h,b.x,b.y), hz=b.z-T[0];
    if(++i%4===0) pts.push([b.x,b.y,Math.max(0,hz)]); if(hz<=0&&b.vz-(T[1]*b.vx+T[2]*b.vy)<0) break; }
  pts.push([b.x,b.y,0]); return {pts,b};
}
// Rough estimate of where the ball stops: same bounce and roll rules, no trees, no cup, no wind.
function predictStop(b0){
  const h=H(), b={...b0}; let T=terrAt(h,b.x,b.y); b.z=T[0]; let lie=surfaceAt(h,b.x,b.y);
  if(lie==='water'||lie==='ob') return null;
  bounceApply(b,lie,true,[T[1],T[2]]); b.z+=.001;
  for(let t=0;t<16;t+=DT){
    if(b.mode!=='roll'){ flightStep(b,{x:0,y:0},DT); T=terrAt(h,b.x,b.y); if(b.z<=T[0]&&b.vz-(T[1]*b.vx+T[2]*b.vy)<0){ b.z=T[0]+.001; lie=surfaceAt(h,b.x,b.y); if(lie==='water'||lie==='ob') return [b.x,b.y,lie]; bounceApply(b,lie,false,[T[1],T[2]]); } continue; }
    lie=surfaceAt(h,b.x,b.y); if(lie==='water'||lie==='ob') return [b.x,b.y,lie];
    const sl=slopeAt(h,b.x,b.y,lie); b.vx+=sl[0]*DT; b.vy+=sl[1]*DT;
    const sp=Math.hypot(b.vx,b.vy), ns=Math.max(0,sp-rollDecel(lie,sp,b.rollMul)*DT); if(sp>0){ b.vx*=ns/sp; b.vy*=ns/sp; }
    b.x+=b.vx*DT; b.y+=b.vy*DT;
    if(ns<.12&&Math.hypot(sl[0],sl[1])<rollOf(lie)*.55) break;
  }
  return [b.x,b.y,lie];
}
// Straight-line roll simulation across real surfaces and slopes (no cup, no magnet).
function rollAlong(x,y,ang,v){
  const h=H(), ux=Math.cos(ang), uy=Math.sin(ang), dt=DT*2; let bx=x,by=y,vx=ux*v,vy=uy*v;
  for(let t=0;t<14;t+=dt){ const lie=surfaceAt(h,bx,by); if(lie==='water'||lie==='ob') break;
    const sl=slopeAt(h,bx,by,lie); vx+=sl[0]*dt; vy+=sl[1]*dt;
    const sp=Math.hypot(vx,vy), ns=Math.max(0,sp-rollDecel(lie,sp)*dt); if(sp>0){ vx*=ns/sp; vy*=ns/sp; }
    bx+=vx*dt; by+=vy*dt; if(ns<.12&&Math.hypot(sl[0],sl[1])<rollOf(lie)*.55) break; }
  return (bx-x)*ux+(by-y)*uy;
}
function solvePutt(x,y,ang,target){
  let lo=.2,hi=45; for(let i=0;i<18;i++){ const m=(lo+hi)/2; if(rollAlong(x,y,ang,m)<target) lo=m; else hi=m; } return (lo+hi)/2;
}
function shoot(ang,power,curve=0,quality='good'){
  const c=CLUBS[S.club], b=S.ball, lie=lieNow();
  S.strokes++; S.last={x:b.x,y:b.y}; b.trail=[]; b.bounces=0; b.inTree=-1; b.side=0;
  if(c.putter){
    const v=solvePutt(b.x,b.y,ang,power*CS(c).carry);
    b.vx=Math.cos(ang)*v; b.vy=Math.sin(ang)*v; b.vz=0; b.z=0; b.mode='roll'; b.spin=0; b.check=0; b.back=0; b.rollMul=1;
    sfx('putt'); S.sq=-.25;
  } else {
    const LS=lieSlope(H(),b.x,b.y,ang);
    let tgt=Math.max(3,power*CS(c).carry*lieFactor(c,lie)*MOD.carry*slopeCarry(LS.up)); if(quality==='mishit') tgt*=.93;
    const P=strikeParams(c,S.strike,lie,quality,LS), v=solveCached(P.loft,P.spin,tgt), dq=quality==='pure'?.25:quality==='mishit'?2.2:1;
    const a=ang+gauss()*CS(c).disp*dq*MOD.disp*(lie==='rough'?1.8:lie==='sand'?1.5:1)*Math.PI/180, lo=P.loft*Math.PI/180;
    b.vx=Math.cos(a)*v*Math.cos(lo); b.vy=Math.sin(a)*v*Math.cos(lo); b.vz=v*Math.sin(lo); b.z=zgAt(H(),b.x,b.y)+.01;
    b.spin=P.spin; b.side=curve*SHAPE[c.id]*MOD.bend+slopeCurve(LS.side); b.check=P.check; b.back=P.back; b.rollMul=P.rollMul; b.mode='air';
    sfx('hit',power); S.shake=4+power*6; S.sq=-.6;
    const [sx,sy]=WS(b.x,b.y);
    for(let i=0;i<7;i++){ const sp=a+Math.PI+(Math.random()-.5)*1.2; parts.push({k:'streak',sx,sy,ang:sp,len:10+Math.random()*16,t:0,life:.28}); }
    if(lie!=='tee'&&lie!=='green') for(let i=0;i<8+(lie==='sand'?14:0);i++) burst(b.x,b.y,a,lie);
    if(quality==='pure'){ S.hitStop=.09; S.shake+=5; label(b.x,b.y,'Pure strike!',0,true,4); for(let i=0;i<2;i++) parts.push({k:'ring',x:b.x,y:b.y,t:-i*.08,life:.5,r:.6}); tone(1560,.12,'sine',.12); setTimeout(()=>tone(2340,.2,'sine',.08),60); }
    else if(quality==='mishit'){ label(b.x,b.y,'Mishit',0,false,4); tone(130,.16,'square',.06,90); }
  }
  coachEvent({t:'shot',curve,q:quality,strike:c.putter?0:S.strike});
  S.shot={x:b.x,y:b.y,lie,isPutt:!!c.putter,dist0:Math.hypot(H().cup[0]-S.last.x,H().cup[1]-S.last.y),carry:0,treeHit:false,done:false,curve,quality,strike:c.putter?0:S.strike,windMph:S.wind.mph*MOD.wind,land:null,spunBack:false};
  setStrike(0);
  recStart();
  S.state='flight'; S.restT=0; saveRun('aim');
  if(S.firstShot){ S.firstShot=false; $('hint').style.opacity=0; }
  updHUD();
}
function burst(x,y,a,lie){
  const sp=4+Math.random()*8, d=a+(Math.random()-.5)*1.4;
  parts.push({k:'dot',x,y,z:0,vx:Math.cos(d)*sp,vy:Math.sin(d)*sp,vz:3+Math.random()*7,t:0,life:.9,s:lie==='sand'?1.3:2.2,tick:lie!=='sand'});
}
function penalty(kind){
  recEnd('pen');
  if(S.shot) S.shot.done=true; if(S.streak>0) lostStreak(); S.streak=0; updPts();
  const b=S.ball; b.mode='gone'; S.state='water'; S.timer=0;
  const free=MOD.clover&&!S.cloverUsed; if(free) S.cloverUsed=true; else S.strokes+=MOD.penalty;
  const note=free?'Four-Leaf saves the stroke':MOD.penalty>1?'Two penalty strokes, replay the shot':'Penalty stroke, replay the shot';
  if(kind==='ob'){ for(let i=0;i<6;i++) burst(b.x,b.y,Math.random()*TAU,'rough'); sfx('tree'); callout('Out of bounds',note); S.shake=3; return; }
  for(let i=0;i<3;i++) parts.push({k:'ring',x:b.x,y:b.y,t:-i*.18,life:1.1,r:4+i*2});
  for(let i=0;i<14;i++){ const d=Math.random()*TAU,s=2+Math.random()*5; parts.push({k:'dot',x:b.x,y:b.y,z:0,vx:Math.cos(d)*s,vy:Math.sin(d)*s,vz:5+Math.random()*7,t:0,life:.9,s:1.8}); }
  sfx('splash'); callout('Splash!',note); S.shake=5;
}
function sink(){
  recEnd('in');
  const b=S.ball,h=H(); b.mode='sunk'; S.sinkT=0; S.state='sunk'; S.timer=0; b.sx=b.x; b.sy=b.y;
  S.fpv=-9; sfx('cup'); setTimeout(()=>{ if(S.state==='sunk') saveRun('holed'); },0);
  for(let i=0;i<12;i++){ const d=i/12*TAU+Math.random()*.3,s=3+Math.random()*3; parts.push({k:'star',x:h.cup[0],y:h.cup[1],z:.5,vx:Math.cos(d)*s,vy:Math.sin(d)*s,vz:6+Math.random()*5,t:0,life:1.4,rot:Math.random()*TAU}); }
  awardShot('sunk');
  const diff=S.strokes-h.par; callout(scoreName(diff,S.strokes), S.strokes===1?'One swing, one hole':null);
}
