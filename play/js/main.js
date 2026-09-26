/* Ink Nine: Main loop and startup. Loaded last. */
"use strict";
/* ============================================================
   LOOP
   ============================================================ */
let lastT=performance.now(), acc=0;
const ease=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
function frame(now){
  const dt=Math.min(.05,(now-lastT)/1000); lastT=now; S.t+=dt; const t=S.t;
  // physics
  const b=S.ball;
  // slow motion when a ball is tracking into the cup
  { let tg=1; const h=H(), dx=h.cup[0]-b.x, dy=h.cup[1]-b.y, d=Math.hypot(dx,dy), sp=Math.hypot(b.vx,b.vy);
    if(S.state==='flight'&&b.mode==='roll'&&d<1.8&&d>.02&&sp>.25&&sp<6&&(b.vx*dx+b.vy*dy)/(sp*d)>.88) tg=.28;
    if(S.state==='flight'&&b.mode==='air'&&b.vz<0&&b.z-zgAt(h,b.x,b.y)<4&&d<2.5) tg=.28;
    S.slow+=(tg-S.slow)*(1-Math.exp(-dt*(tg<S.slow?12:4)));
    if(tg<1&&!S.slowOn){ S.slowOn=true; tone(80,.5,'sine',.2,55); } else if(tg===1) S.slowOn=false;
    if(S.slow<.8&&S.state==='flight'){ camT.x=(b.x+h.cup[0])/2; camT.y=(b.y+h.cup[1])/2; camT.z=Math.min(30,Math.max(camT.z,cam.z*1.02,12)); } }
  if(S.hitStop>0){ S.hitStop-=dt; }
  else if(S.state==='flight'||S.state==='sunk'){ acc+=dt*TS*S.slow; while(acc>=DT){ physStep(DT); acc-=DT; if(S.state!=='flight') break; } } else acc=0;
  if(S.state==='flight'&&b.mode==='rest'){ if(S.restT===0){ awardShot('rest'); recEnd('rest'); saveRun('aim'); } S.restT+=dt; if(S.restT>.55){ if(S.strokes>=10||!startGhosts()) toAim(); } }
  if(S.state==='ghost'){ S.timer+=dt; if(updateGhosts(dt)){ S.ghostHold=(S.ghostHold||0)+dt; if(S.ghostHold>.7){ S.ghostHold=0; toAim(); } } }
  if(S.state==='water'){ S.timer+=dt; if(S.timer>1.5){ Object.assign(b,{x:S.last.x,y:S.last.y,z:0,vx:0,vy:0,vz:0,mode:'rest',trail:[]}); S.sq=.5; toAim(); } }
  if(S.state==='sunk'){ S.sinkT+=dt; S.timer+=dt; if(S.timer>1.1&&!S.banked) bankHole(S.strokes); if(S.timer>2.6) finishHole(S.strokes); }
  // squash & flag springs (follow-through)
  S.sqv+=(-190*S.sq-11*S.sqv)*dt; S.sq+=S.sqv*dt;
  S.fpv+=(-160*S.fp-7*S.fpv)*dt; S.fp+=S.fpv*dt;
  // camera: intro staging, then a slightly underdamped spring
  if(S.state==='intro'){ const I=S.intro; I.t+=dt; const u=ease(Math.max(0,Math.min(1,(I.t-1.4)/2.2)));
    cam.x=I.from.x+(I.to.x-I.from.x)*u; cam.y=I.from.y+(I.to.y-I.from.y)*u; cam.z=Math.exp(Math.log(I.from.z)+(Math.log(I.to.z)-Math.log(I.from.z))*u);
    if(I.t>4.2) endIntro(); }
  else {
    if(S.state==='flight'&&b.mode!=='rest'&&S.slow>=.8){ camT.x=b.x+b.vx*.3; camT.y=b.y+b.vy*.3; }
    if(S.state==='sunk'){ const h=H(); camT.x=h.cup[0]; camT.y=h.cup[1]-1.5; camT.z=Math.max(camT.z,8); }
    const k=24,c=8.2; cam.vx+=(k*(camT.x-cam.x)-c*cam.vx)*dt; cam.vy+=(k*(camT.y-cam.y)-c*cam.vy)*dt;
    cam.x+=cam.vx*dt; cam.y+=cam.vy*dt; cam.z*=Math.exp((Math.log(camT.z)-Math.log(cam.z))*(1-Math.exp(-dt*3)));
  }
  S.shake*=Math.exp(-dt*9); const sk=S.shake*(RM?.15:1); shakeOff.x=(Math.random()-.5)*sk; shakeOff.y=(Math.random()-.5)*sk;
  if(S.state==='flight'&&((t*10)|0)%3===0) updHUD();
  { const tgt=S.points+S.holePts; if(Math.abs(tgt-S.disp)>.5){ S.disp+=(tgt-S.disp)*(1-Math.exp(-dt*5)); if(Math.abs(tgt-S.disp)<1) S.disp=tgt; $('pv').textContent=Math.round(S.disp).toLocaleString(); } }
  draw(t,dt);
  requestAnimationFrame(frame);
}

/* boot */
addEventListener('resize',()=>{ resize(); if(S.state==='aim') frameAim(); });
resize();
EV=null;
S.field=RIVALS.map(r=>({...r,scores:[]}));
computeMod();
updHUD();
{ const RUN=meta.name?loadRun():null; if(!(RUN&&resumeRun(RUN))){ EV=EVENTS[0]; showHome(); } }
requestAnimationFrame(frame);
