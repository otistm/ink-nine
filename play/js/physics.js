/* Ink Nine: Per-step simulation: flight, bounces, rolling, trees and the cup. */
"use strict";
/* ============================================================
   SIMULATION TICK
   ============================================================ */
function physStep(dt){
  const b=S.ball,h=H();
  if(b.mode==='air'){
    flightStep(b,{x:S.wind.x*MOD.wind,y:S.wind.y*MOD.wind},dt);
    const T=terrAt(h,b.x,b.y), hz=b.z-T[0], pz=hz-b.vz*dt;
    // trees
    let inAny=-1;
    for(let i=0;i<h.trees.length;i++){ const tr=h.trees[i],dx=b.x-tr[0],dy=b.y-tr[1],d=Math.hypot(dx,dy),th=tr[2]*1.8;
      if(d<tr[2]&&hz<th&&hz>0){ inAny=i; if(b.inTree!==i){ b.inTree=i;
          if(pz>=th){ b.vx*=.2; b.vy*=.2; b.vz=Math.min(b.vz,0)*.3; }
          else{ const nx=dx/(d||1),ny=dy/(d||1),vn=b.vx*nx+b.vy*ny; if(vn<0){ b.vx-=2*vn*nx; b.vy-=2*vn*ny; } b.vx*=.35; b.vy*=.35; b.vz*=.4; }
          if(S.shot) S.shot.treeHit=true; sfx('tree'); for(let k=0;k<8;k++) burst(b.x,b.y,Math.random()*TAU,'rough'); } } }
    if(inAny<0) b.inTree=-1;
    if(b.trail.length<600) b.trail.push([b.x,b.y,Math.max(0,hz)]); recPoint();
    if(hz<=0&&b.vz-(T[1]*b.vx+T[2]*b.vy)<0) land(T);
  } else if(b.mode==='roll'){
    const lie=surfaceAt(h,b.x,b.y);
    if(lie==='water'||lie==='ob'){ penalty(lie); return; }
    const sl=slopeAt(h,b.x,b.y,lie); b.vx+=sl[0]*dt; b.vy+=sl[1]*dt;
    const dx=h.cup[0]-b.x,dy=h.cup[1]-b.y,dc=Math.hypot(dx,dy);
    let sp=Math.hypot(b.vx,b.vy);
    if(dc<.55*MOD.cupR&&sp<3){ b.vx+=dx/dc*2.2*dt; b.vy+=dy/dc*2.2*dt; }
    if(MOD.magnet&&dc<2&&dc>.05&&sp<5){ b.vx+=dx/dc*3.2*dt; b.vy+=dy/dc*3.2*dt; }
    const ns=Math.max(0,sp-rollDecel(lie,sp,b.rollMul)*dt);
    if(lie==='rough'&&sp>1.2){ if(Math.random()<dt*7) burst(b.x,b.y,Math.random()*TAU,'rough'); S.sq+=(Math.random()-.5)*.06; } if(sp>0){ b.vx*=ns/sp; b.vy*=ns/sp; }
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.z=zgAt(h,b.x,b.y); recPoint();
    const d2=Math.hypot(h.cup[0]-b.x,h.cup[1]-b.y);
    if(d2<.3*MOD.cupR){
      if(ns<2.6+MOD.cupV+(S.shot&&S.shot.isPutt?CS(CLUBS[PUTTER]).capV:0)){ sink(); return; }
      if(!b.lipped){ b.lipped=true; const r=(Math.random()<.5?-1:1)*(.4+Math.random()*.5),c=Math.cos(r),s=Math.sin(r);
        const vx=b.vx*c-b.vy*s, vy=b.vx*s+b.vy*c; b.vx=vx*.65; b.vy=vy*.65; tone(520,.05,'sine',.12); }
    } else b.lipped=false;
    if(ns<.12&&Math.hypot(sl[0],sl[1])<rollOf(lie)*.55){ b.vx=b.vy=0; b.mode='rest'; }
  }
}
function bounceApply(b,lie,first,g){
  const s=SURF[lie]; let e=s.e, f=s.f; g=g||[0,0];
  if(MOD.bouncy&&lie!=='sand'){ e=Math.min(.7,e*1.8); f=Math.min(.85,f*1.25); }
  if(first) f*=(1-(b.check||0)); f=Math.max(0,Math.min(.95,f));
  const nl=Math.hypot(g[0],g[1],1), nx=-g[0]/nl, ny=-g[1]/nl, nz=1/nl, vn=b.vx*nx+b.vy*ny+b.vz*nz;
  let tx=(b.vx-vn*nx)*f, ty=(b.vy-vn*ny)*f, tz=(b.vz-vn*nz)*f, rev=false;
  if(first&&b.back>0&&(lie==='green'||lie==='fairway'||lie==='tee')){ const th=Math.hypot(tx,ty)||1e-6, nh=th-b.back*(lie==='green'?1:.6); tx=tx/th*nh; ty=ty/th*nh; rev=nh<0; }
  const out=-vn*e;
  b.vx=tx+out*nx; b.vy=ty+out*ny; b.vz=tz+out*nz;
  if(out<1.4||lie==='sand'){ b.vz=0; b.mode='roll'; }
  return rev;
}
function land(T){
  const b=S.ball,h=H(); T=T||terrAt(h,b.x,b.y); b.z=T[0]; const lie=surfaceAt(h,b.x,b.y), impact=Math.max(0,-(b.vz-(T[1]*b.vx+T[2]*b.vy)));
  if(lie==='water'||lie==='ob'){ penalty(lie); return; }
  if(Math.hypot(h.cup[0]-b.x,h.cup[1]-b.y)<.35*MOD.cupR&&Math.hypot(b.vx,b.vy)<30){ sink(); return; }
  const first=b.bounces===0;
  if(first&&S.shot){ S.shot.carry=Math.hypot(b.x-S.shot.x,b.y-S.shot.y); S.shot.land={x:b.x,y:b.y,lie,d:Math.hypot(h.cup[0]-b.x,h.cup[1]-b.y)}; }
  const rev=bounceApply(b,lie,first,[T[1],T[2]]); b.bounces++; b.z=T[0]+.001;
  if(rev&&S.shot){ S.shot.spunBack=true; parts.push({k:'ring',x:b.x,y:b.y,t:0,life:.5,r:.8,thin:true}); tone(700,.12,'sine',.08,420); }
  S.sq=Math.min(.55,impact/34); S.sqv=0;
  if(lie==='sand'){ sfx('sand'); for(let i=0;i<14;i++) burst(b.x,b.y,Math.random()*TAU,'sand'); }
  else { sfx('bounce',impact); if(impact>6) parts.push({k:'ring',x:b.x,y:b.y,t:0,life:.45,r:1.2,thin:true});
    if(lie==='rough') for(let i=0;i<5;i++) burst(b.x,b.y,Math.random()*TAU,'rough'); }

}
