/* Ink Nine: Touch input: swing drag, curve, tempo ring, strike dial and telescope. */
"use strict";
/* ============================================================
   INPUT — drag back anywhere, release to swing
   ============================================================ */
let drag=null;
const maxDrag=()=>Math.min(W,Hh)*.42;
function dragInfo(){
  const dx=drag.x0-drag.x, dy=drag.y0-drag.y, l=Math.hypot(dx,dy);
  return {power:Math.min(1,l/maxDrag()), ang:l>4?Math.atan2(dy,dx):aimAngle(), l};
}
// Bend a shot by bowing the drag: bulge to the right of your pull and the ball curves right.
function dragCurve(){
  const p=drag.path, dx=drag.x-drag.x0, dy=drag.y-drag.y0, l=Math.hypot(dx,dy); if(l<30||p.length<3) return 0;
  const ax=-dx/l, ay=-dy/l, rx=-ay, ry=ax; let best=0;
  for(const q of p){ const qx=q[0]-drag.x0, qy=q[1]-drag.y0, t=(qx*dx+qy*dy)/(l*l); if(t<.05||t>.98) continue;
    const v=((qx-dx*t)*rx+(qy-dy*t)*ry)/l; if(Math.abs(v)>Math.abs(best)) best=v; }
  return Math.sign(best)*Math.max(0,Math.min(1,(Math.abs(best)-.05)/.2));
}
// Swing tempo: a ring shrinks onto the ball once every 1.1s. Let go as it lands for a pure strike.
const PULSE=1.1, RING_IN=17, RING_OUT=63;
function timing(){
  const ph=((performance.now()-drag.t0)/1000/PULSE)%1, r=RING_IN+(RING_OUT-RING_IN)*(1-ph);
  const q=(r-RING_IN)<=4.5*MOD.perfect?'pure':ph<.3?'mishit':'good'; return {q,r,ph};
}
$('coachSkip').addEventListener('click',()=>{ sfx('tick'); endTutorial(); showHome(); });
/* ---------- strike dial ---------- */
S.strike=0;
function setStrike(v){
  S.strike=Math.abs(v)<.12?0:Math.round(v*20)/20;
  const y=75-S.strike*50; $('dialDot').setAttribute('transform',`translate(0 ${y-75})`);
  $('miniDot').setAttribute('cy',String(20-S.strike*11)); $('dname').textContent=strikeName(S.strike);
  $('strike').setAttribute('aria-label',`Strike point: ${strikeName(S.strike)}`); updHUD();
}
function openDial(o){ const d=$('dial'); d.hidden=!o; $('strike').classList.toggle('on',o); $('strike').setAttribute('aria-expanded',String(o)); }
$('strike').addEventListener('click',()=>{ audioInit(); if(look.on) exitLook(); openDial($('dial').hidden); sfx('tick'); });
{ const svg=$('dialSvg'); let on=false, lastQ=null;
  const at=e=>{ const r=svg.getBoundingClientRect(), y=(e.clientY-r.top)/r.height*150; setStrike(Math.max(-1,Math.min(1,(75-y)/50)));
    const q=Math.round(S.strike*4); if(q!==lastQ){ lastQ=q; tone(500+S.strike*200,.03,'sine',.06); } };
  svg.addEventListener('pointerdown',e=>{ on=true; try{ svg.setPointerCapture(e.pointerId); }catch(_){} at(e); });
  svg.addEventListener('pointermove',e=>{ if(on) at(e); });
  svg.addEventListener('pointerup',()=>{ on=false; });
  svg.addEventListener('pointercancel',()=>{ on=false; });
  svg.addEventListener('keydown',e=>{ if(e.key==='ArrowUp') setStrike(Math.min(1,S.strike+.1)); if(e.key==='ArrowDown') setStrike(Math.max(-1,S.strike-.1)); });
  svg.setAttribute('tabindex','0');
}
/* ---------- telescope: free look ---------- */
const look={on:false,ptrs:new Map(),start:null,vel:{x:0,y:0},lt:0,bb:null};
function holeBounds(){
  const h=H(), pts=[h.tee,h.cup,[S.ball.x,S.ball.y]];
  const add=s=>{ if(s.t==='c') s.pts.forEach(p=>pts.push(p)); else if(s.t==='e'){ const m=Math.max(s.rx,s.ry); pts.push([s.x-m,s.y-m],[s.x+m,s.y+m]); } };
  h.green.forEach(add); h.fair.forEach(add); h.water.forEach(add); h.sand.forEach(add);
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; pts.forEach(p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); });
  return {x0:x0-20,x1:x1+20,y0:y0-20,y1:y1+20};
}
function setLookUI(){ const b=$('scope'); b.classList.toggle('on',look.on); b.setAttribute('aria-pressed',String(look.on));
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); $('lookhint').hidden=!look.on; $('hint').style.visibility=look.on?'hidden':''; }
function enterLook(){
  if(S.state!=='aim'||look.on||MOD.fog) return; coachEvent({t:'look'}); look.on=true; drag=null; look.ptrs.clear();
  const bb=look.bb=holeBounds(), uh=Hh-view.top-view.bot;
  camT={x:(bb.x0+bb.x1)/2,y:(bb.y0+bb.y1)/2,z:Math.max(.45,Math.min((W-32)/(bb.x1-bb.x0),(uh-24)/(bb.y1-bb.y0)))};
  sfx('tick'); tone(520,.18,'sine',.08,780); setLookUI();
}
function exitLook(){ if(!look.on) return; look.on=false; look.ptrs.clear(); frameAim(); tone(780,.16,'sine',.08,520); setLookUI(); }
function lookGesture(){ let cx=0,cy=0; look.ptrs.forEach(p=>{cx+=p.x;cy+=p.y;}); const n=look.ptrs.size; cx/=n; cy/=n;
  let d=0; if(n>=2){ const a=[...look.ptrs.values()]; d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); } return {cx,cy,d}; }
function lookAnchor(){ const g=lookGesture(); look.start={g,wx:cam.x+(g.cx-view.cx)/cam.z,wy:cam.y+(g.cy-view.cy)/cam.z,z:cam.z}; }
function lookDown(e){ look.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); try{ cv.setPointerCapture(e.pointerId); }catch(_){} lookAnchor(); look.vel={x:0,y:0}; look.lt=performance.now(); }
function lookMove(e){
  if(!look.ptrs.has(e.pointerId)) return; look.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const st=look.start, g=lookGesture();
  const z=(g.d>0&&st.g.d>0)?Math.max(.45,Math.min(14,st.z*g.d/st.g.d)):cam.z;
  const nx=st.wx-(g.cx-view.cx)/z, ny=st.wy-(g.cy-view.cy)/z, now=performance.now(), dt=Math.max(1,now-look.lt)/1000;
  look.vel.x=look.vel.x*.6+((nx-cam.x)/dt)*.4; look.vel.y=look.vel.y*.6+((ny-cam.y)/dt)*.4; look.lt=now;
  cam.x=nx; cam.y=ny; cam.z=z; cam.vx=cam.vy=0; camT={x:nx,y:ny,z};
}
function lookUp(e){
  look.ptrs.delete(e.pointerId);
  if(look.ptrs.size){ lookAnchor(); return; }
  // fling with follow-through, then spring back inside the hole if we flew past it
  const bb=look.bb; camT.x=Math.max(bb.x0,Math.min(bb.x1,cam.x+look.vel.x*.28)); camT.y=Math.max(bb.y0,Math.min(bb.y1,cam.y+look.vel.y*.28));
  cam.vx=look.vel.x*.5; cam.vy=look.vel.y*.5;
}
$('scope').addEventListener('click',()=>{ audioInit(); look.on?exitLook():enterLook(); });
cv.addEventListener('wheel',e=>{ if(!look.on) return; e.preventDefault(); const z=Math.max(.45,Math.min(14,cam.z*Math.exp(-e.deltaY*.0015))); cam.z=z; camT.z=z; },{passive:false});
cv.addEventListener('pointerdown',e=>{
  audioInit();
  if(S.state==='intro'){ endIntro(); return; }
  if(S.state==='ghost'){ (S.ghosts||[]).forEach(g=>{ g.t=1e9; g.done=true; }); S.ghostHold=0; toAim(); return; }
  if(!$('dial').hidden){ openDial(false); return; }
  if(look.on){ lookDown(e); return; }
  if(S.state!=='aim'||drag) return;
  drag={x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,id:e.pointerId,t0:performance.now(),path:[[e.clientX,e.clientY]]};
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  camT={x:cam.x,y:cam.y,z:cam.z};
});
cv.addEventListener('pointermove',e=>{ if(look.on){ lookMove(e); return; } if(drag&&e.pointerId===drag.id){ drag.x=e.clientX; drag.y=e.clientY; if(drag.path.length<240) drag.path.push([e.clientX,e.clientY]); } });
function release(e,cancel){
  if(look.on){ lookUp(e); return; }
  if(!drag||e.pointerId!==drag.id) return;
  const {power,ang}=dragInfo(), c=CLUBS[S.club], curve=c.putter?0:dragCurve(), q=c.putter?'good':timing().q; drag=null;
  if(!cancel&&power>.04&&S.state==='aim') shoot(ang,power,curve,q); else if(S.state==='aim') frameAim();
}
cv.addEventListener('pointerup',e=>release(e,false));
cv.addEventListener('pointercancel',e=>release(e,true));
document.addEventListener('touchmove',e=>{ if(!e.target.closest||!e.target.closest('#card')) e.preventDefault(); },{passive:false});
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&S.state==='intro') endIntro(); if(e.key==='Escape') exitLook(); });
