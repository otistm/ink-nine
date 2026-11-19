/* Ink Nine for desktop: everything the desktop edition adds on top of the phone game.
   Loaded after draw.js and before main.js, so it can swap in wider framing, mouse and keyboard controls,
   a hole map, a rangefinder and extra ink detail, while the phone game's files stay exactly as they are. */
"use strict";

/* ---------- online: desktop rounds stay on this computer for now ----------
   Testers' leaderboard and ghosts stay phone-only until the desktop career has its own tables. */
async function saveProgress(){ // the hole card appears a moment later, so wait for its note line
  NET.save='Desktop rounds stay on this computer for now.';
  for(let n=0;n<20;n++){ const el=document.getElementById('netnote'); if(el){ netNote(); return; } await new Promise(r=>setTimeout(r,250)); } }
async function saveRound(){ return false; }
async function syncName(){}
{ const base=feedbackContext; feedbackContext=function(){ return {...base(),edition:'desktop'}; }; }

/* ---------- layout: the course gets the middle, the bag and tools sit at the sides ---------- */
measureView=function(){
  const tb=$('top').getBoundingClientRect();
  view.top=tb.bottom; view.bot=60; view.side=Math.min(190,W*.14); view.cx=W/2; view.cy=(view.top+(Hh-view.bot))/2;
};
aimFrame=function(ang){
  const b=S.ball,h=H(),c=CLUBS[S.club],lie=lieNow(),r=reachFor(c,lie);
  const pts=[[b.x,b.y],[b.x+Math.cos(ang)*r,b.y+Math.sin(ang)*r]];
  if(distToCup()<r*1.3) pts.push(h.cup);
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  const pad=56, uh=Hh-view.top-view.bot, uw=W-2*view.side;
  const z=Math.max(1.1,Math.min(18,Math.min((uw-pad*2)/(x1-x0+2),(uh-pad*2)/(y1-y0+2))));
  return {x:(x0+x1)/2,y:(y0+y1)/2,z};
};
enterLook=function(){
  if(S.state!=='aim'||look.on||MOD.fog) return; coachEvent({t:'look'}); look.on=true; drag=null; look.ptrs.clear();
  const bb=look.bb=holeBounds(), uh=Hh-view.top-view.bot, uw=W-2*view.side;
  camT={x:(bb.x0+bb.x1)/2,y:(bb.y0+bb.y1)/2,z:Math.max(.45,Math.min((uw-32)/(bb.x1-bb.x0),(uh-24)/(bb.y1-bb.y0)))};
  sfx('tick'); tone(520,.18,'sine',.08,780); setLookUI();
};
$('lookhint').firstElementChild.textContent='Drag to look around, scroll to zoom. Space to go back.';
$('hint').firstElementChild.textContent='Pick a club, then click and drag back from anywhere. Let go to swing.';

/* ---------- the whole hole, for the map, contours and markers ---------- */
function staticBounds(h,m){
  const pts=[h.tee,h.cup];
  const add=s=>{ if(s.t==='c') s.pts.forEach(p=>pts.push(p)); else if(s.t==='e'){ const r=Math.max(s.rx,s.ry); pts.push([s.x-r,s.y-r],[s.x+r,s.y+r]); } };
  h.green.forEach(add); h.fair.forEach(add); h.water.forEach(add); h.sand.forEach(add);
  h.trees.forEach(t=>{ pts.push([t[0]-t[2],t[1]-t[2]],[t[0]+t[2],t[1]+t[2]]); });
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; pts.forEach(p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); });
  return {x0:x0-m,x1:x1+m,y0:y0-m,y1:y1+m};
}
const toWorld=(sx,sy)=>[cam.x+(sx-view.cx)/cam.z, cam.y+(sy-view.cy)/cam.z];

/* ---------- contour lines: the ground's shape, drawn like a survey map ---------- */
const CT_STEP=2, CT_LEVEL=.5;
function contours(h){
  if(h._ct) return h._ct;
  const bb=staticBounds(h,40), nx=Math.ceil((bb.x1-bb.x0)/CT_STEP)+1, ny=Math.ceil((bb.y1-bb.y0)/CT_STEP)+1, Z=new Float32Array(nx*ny);
  let lo=0,hi=0;
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const z=zgAt(h,bb.x0+i*CT_STEP,bb.y0+j*CT_STEP); Z[j*nx+i]=z; lo=Math.min(lo,z); hi=Math.max(hi,z); }
  const minor=[], major=[];
  const P=(i,j,e,L)=>{ // point where the level crosses edge e of cell (i,j): 0 top, 1 right, 2 bottom, 3 left
    const a=Z[j*nx+i], b=Z[j*nx+i+1], c=Z[(j+1)*nx+i+1], d=Z[(j+1)*nx+i];
    let x,y,t;
    if(e===0){ t=(L-a)/(b-a); x=i+t; y=j; } else if(e===1){ t=(L-b)/(c-b); x=i+1; y=j+t; }
    else if(e===2){ t=(L-d)/(c-d); x=i+t; y=j+1; } else { t=(L-a)/(d-a); x=i; y=j+t; }
    return [bb.x0+x*CT_STEP, bb.y0+y*CT_STEP];
  };
  const CASES=[[],[[3,2]],[[2,1]],[[3,1]],[[0,1]],[[0,1],[3,2]],[[0,2]],[[3,0]],[[3,0]],[[0,2]],[[0,3],[2,1]],[[0,1]],[[3,1]],[[2,1]],[[3,2]],[]];
  for(let L=Math.ceil(lo/CT_LEVEL)*CT_LEVEL; L<=hi; L+=CT_LEVEL){
    if(Math.abs(L)<.25) continue;
    const out=Math.abs(Math.round(L)-L)<.01?major:minor;
    for(let j=0;j<ny-1;j++) for(let i=0;i<nx-1;i++){
      const k=(Z[j*nx+i]>L?8:0)|(Z[j*nx+i+1]>L?4:0)|(Z[(j+1)*nx+i+1]>L?2:0)|(Z[(j+1)*nx+i]>L?1:0);
      for(const [e0,e1] of CASES[k]){ const p=P(i,j,e0,L), q=P(i,j,e1,L); out.push(p[0],p[1],q[0],q[1]); }
    }
  }
  return h._ct={minor,major};
}
function drawContours(h){
  const C=contours(h); ctx.save(); ctx.strokeStyle='#000'; ctx.lineCap='round';
  [[C.minor,.13,.9],[C.major,.24,1.15]].forEach(([A,a,w])=>{ if(!A.length) return; ctx.globalAlpha=a; ctx.lineWidth=w; ctx.beginPath();
    for(let i=0;i<A.length;i+=4){ const [x0,y0]=WS(A[i],A[i+1]), [x1,y1]=WS(A[i+2],A[i+3]);
      if((x0<-20&&x1<-20)||(x0>W+20&&x1>W+20)||(y0<-20&&y1<-20)||(y0>Hh+20&&y1>Hh+20)) continue;
      ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); }
    ctx.stroke(); });
  ctx.restore();
}

/* ---------- bunker lips: the bank throws a hatched shadow into the sand ---------- */
function bunkerLips(h){
  h.sand.forEach(s=>{ if(s.t!=='e') return; const m=Math.min(s.rx,s.ry); if(m*cam.z<7) return;
    const [x,y]=WS(s.x,s.y), o=m*.3*cam.z;
    ctx.save(); ellPath(s); ctx.clip(); ctx.beginPath();
    ctx.ellipse(x,y,s.rx*cam.z+3,s.ry*cam.z+3,s.rot,0,TAU); ctx.ellipse(x+o*.7,y+o,s.rx*cam.z,s.ry*cam.z,s.rot,0,TAU);
    ctx.fillStyle=patShade; ctx.globalAlpha=.55; ctx.fill('evenodd'); ctx.restore(); });
}

/* ---------- yardage markers: discs in the fairway at 250, 200, 150 and 100 yards from the pin ---------- */
function markers(h){
  if(h._mk) return h._mk;
  const path=[h.tee]; h.fair.forEach(s=>{ if(s.t==='c') path.push(...s.pts); });
  const dc=p=>Math.hypot(p[0]-h.cup[0],p[1]-h.cup[1]), out=[];
  for(const D of [250,200,150,100]){
    if(D>h.len-25) continue;
    for(let k=0;k<path.length-1;k++){ const p=path[k], q=path[k+1];
      if((dc(p)-D)*(dc(q)-D)>0) continue;
      let lo=0,hi=1; const at=t=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t], far=dc(p)>dc(q);
      for(let n=0;n<24;n++){ const m=(lo+hi)/2; ((dc(at(m))>D)===far)?lo=m:hi=m; }
      const pt=at((lo+hi)/2); if(inAny(h.fair,pt[0],pt[1])){ out.push({x:pt[0],y:pt[1],D}); break; } }
  }
  return h._mk=out;
}
function drawMarkers(h){
  const M=markers(h); if(!M.length) return;
  ctx.save(); ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
  M.forEach(m=>{ const [x,y]=WS(m.x,m.y); if(x<-30||x>W+30||y<-30||y>Hh+30) return; const r=Math.max(3.2,Math.min(6,cam.z*.55));
    ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fillStyle='#fff'; ctx.fill(); ctx.stroke(); ctx.fillStyle='#000';
    if(m.D===100){ ctx.beginPath(); ctx.arc(x,y,r*.6,0,TAU); ctx.fill(); }
    else if(m.D===150){ ctx.beginPath(); ctx.arc(x,y,r*.6,-Math.PI/2,Math.PI/2); ctx.closePath(); ctx.fill(); }
    else if(m.D===250){ ctx.beginPath(); ctx.moveTo(x-r*.5,y); ctx.lineTo(x+r*.5,y); ctx.stroke(); }
    if(cam.z>2.2){ ctx.font='800 10px Figtree, system-ui, sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.lineWidth=3; ctx.strokeStyle='#fff'; ctx.strokeText(String(m.D),x+r+3,y); ctx.fillText(String(m.D),x+r+3,y); ctx.strokeStyle='#000'; ctx.lineWidth=1.5; } });
  ctx.restore();
}

/* the ground layer gets contours under the slope strokes, then bunker lips and markers on top */
{ const base=drawSlopes; drawSlopes=function(h){ drawContours(h); bunkerLips(h); base(h); drawMarkers(h); }; }

/* ---------- rough: a finer, denser grass texture for the bigger screen ---------- */
{ const base=makePatterns; makePatterns=function(){ base();
  patRough=tile(160,160,g=>{ const r=seeded(11);
    for(let i=0;i<22;i++){ const x=8+r()*144,y=8+r()*144,s=1.6+r()*1.7; g.globalAlpha=.26+r()*.2; g.lineWidth=1; g.beginPath();
      g.moveTo(x-s,y+s*.6); g.lineTo(x-s*.35,y-s); g.moveTo(x,y+s*.7); g.lineTo(x+s*.1,y-s*1.25); g.moveTo(x+s,y+s*.6); g.lineTo(x+s*.45,y-s*.9); g.stroke(); }
    g.globalAlpha=.22; for(let i=0;i<46;i++){ g.beginPath(); g.arc(r()*160,r()*160,.55,0,TAU); g.fill(); } }); }; }

/* ---------- trees: lobed canopies with scalloped leaf clusters, stippling and a hatched shadow ---------- */
drawTree=function(tr,i,t){
  const sway=Math.sin(t*1.3+i*1.7)*(.25+S.wind.mph*.03);
  const [x,y]=WS(tr[0]+sway*Math.sign(S.wind.x||1),tr[1]+sway*.3*Math.sign(S.wind.y||1)), r=tr[2]*cam.z;
  if(x<-r*2||x>W+r*2||y<-r*2||y>Hh+r*2) return;
  const rnd=seeded(1013+i*97+Math.abs(Math.round(tr[0]*7+tr[1]*3))), lobes=10+Math.floor(rnd()*4), ph=rnd()*TAU, ph2=rnd()*TAU;
  ctx.save(); ctx.fillStyle=patShade; ctx.globalAlpha=.5; ctx.beginPath(); ctx.ellipse(x+r*.4,y+r*.36,r*1.02,r*.9,0,0,TAU); ctx.fill(); ctx.restore();
  // a scalloped crown: a ring of rounded leaf bumps
  ctx.beginPath();
  for(let k=0;k<=120;k++){ const a=k/120*TAU, rr=r*(.9+.11*Math.abs(Math.sin(a*lobes*.5+ph))+.02*Math.sin(a*3+ph2)); const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr; k?ctx.lineTo(px,py):ctx.moveTo(px,py); }
  ctx.closePath(); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=INK; ctx.strokeStyle='#000'; ctx.stroke();
  ctx.lineCap='round';
  if(r>9){ // inner foliage: rings of outward-bulging bumps, left open on the lit top-left
    ctx.lineWidth=1.1;
    [[.6,lobes-2,.16],[.3,Math.max(3,Math.round(lobes/3)),.13]].forEach(([d,n,s])=>{ if(r*s<2.2) return; const off=rnd()*TAU;
      for(let k=0;k<n;k++){ const a=off+k/n*TAU+(rnd()-.5)*.3, lit=Math.cos(a-1.25*Math.PI); if(lit>.45) continue;
        const cx=x+Math.cos(a)*r*d, cy=y+Math.sin(a)*r*d, cr=r*s*(.85+rnd()*.3);
        ctx.beginPath(); ctx.arc(cx,cy,cr,a-1.05,a+1.05); ctx.stroke(); } });
  } else { ctx.lineWidth=1.3; ctx.beginPath(); ctx.arc(x-r*.12,y-r*.12,r*.62,.15*Math.PI,.62*Math.PI); ctx.stroke(); }
  if(r>16){ ctx.fillStyle='#000'; ctx.globalAlpha=.6; const n=Math.round(r*.9);
    for(let k=0;k<n;k++){ const a=.05*Math.PI+rnd()*.9*Math.PI, d=r*(.6+rnd()*.33); ctx.beginPath(); ctx.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,.75,0,TAU); ctx.fill(); }
    ctx.globalAlpha=1; }
};

/* ---------- the hole map: the whole hole in the top-left corner; click it to look there ---------- */
function mapRect(){ const top=view.top+16, h=Math.min(340,Hh-top-250); return h<130?null:{x:26,y:top,w:150,h}; }
function mapFit(h,R){ const bb=h._bb||(h._bb=staticBounds(h,10)); return {bb,z:Math.min((R.w-14)/(bb.x1-bb.x0),(R.h-14)/(bb.y1-bb.y0))}; }
function drawMap(t){
  const R=mapRect(); if(!R||MOD.fog) return; const h=H(), {bb,z}=mapFit(h,R);
  const sc={x:cam.x,y:cam.y,z:cam.z}, sv={cx:view.cx,cy:view.cy}, sk={x:shakeOff.x,y:shakeOff.y};
  ctx.save();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.roundRect(R.x+4,R.y+5,R.w,R.h,14); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.roundRect(R.x,R.y,R.w,R.h,14); ctx.fill(); ctx.clip();
  cam.x=(bb.x0+bb.x1)/2; cam.y=(bb.y0+bb.y1)/2; cam.z=z; view.cx=R.x+R.w/2; view.cy=R.y+R.h/2; shakeOff.x=shakeOff.y=0;
  try{
    const [ox,oy]=WS(0,0); [patRough,patSand,patWater,patGreen,patHatch].forEach(p=>setPat(p,ox,oy));
    ctx.globalAlpha=.6; ctx.fillStyle=patRough; ctx.fillRect(R.x,R.y,R.w,R.h); ctx.globalAlpha=1;
    layer(h.ob,patHatch,.8); layer(h.fair,'#fff',.8); layer(h.water,patWater,.8); layer(h.green,patGreen,.9); layer(h.sand,patSand,.7);
    ctx.lineWidth=.8; ctx.strokeStyle='#000';
    h.trees.forEach(tr=>{ const [x,y]=WS(tr[0],tr[1]); ctx.beginPath(); ctx.arc(x,y,Math.max(1.2,tr[2]*z),0,TAU); ctx.fillStyle='#fff'; ctx.fill(); ctx.stroke(); });
    { const [x,y]=WS(h.tee[0],h.tee[1]); ctx.fillStyle='#000'; ctx.fillRect(x-3,y-2,6,4); }
    { const [x,y]=WS(h.cup[0],h.cup[1]); ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y-13); ctx.lineTo(x+8,y-10); ctx.lineTo(x,y-7); ctx.closePath(); ctx.fillStyle='#fff'; ctx.fill(); ctx.stroke(); }
    const b=S.ball, [bx,by]=WS(b.x,b.y);
    if(S.state==='aim'){ const c=CLUBS[S.club], ang=drag?dragInfo().ang:aimAngle(), r=drag?dragInfo().power*reachFor(c,lieNow()):Math.min(reachFor(c,lieNow()),c.putter?distToCup():1e9);
      const [ex,ey]=WS(b.x+Math.cos(ang)*r,b.y+Math.sin(ang)*r); ctx.setLineDash([2,3]); ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ex,ey,2.5,0,TAU); ctx.stroke(); }
    if(look.on){ const [a0,b0]=[sc.x+(0-sv.cx)/sc.z,sc.y+(view.top-sv.cy)/sc.z], [a1,b1]=[sc.x+(W-sv.cx)/sc.z,sc.y+(Hh-view.bot-sv.cy)/sc.z], [p,q]=WS(a0,b0), [u,v]=WS(a1,b1);
      ctx.setLineDash([4,3]); ctx.lineWidth=1.3; ctx.strokeRect(p,q,u-p,v-q); ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(bx,by,3.6,0,TAU); ctx.fillStyle='#000'; ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle='#fff'; ctx.stroke();
  } finally {
    Object.assign(cam,sc); view.cx=sv.cx; view.cy=sv.cy; shakeOff.x=sk.x; shakeOff.y=sk.y;
  }
  ctx.restore();
  ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.roundRect(R.x,R.y,R.w,R.h,14); ctx.stroke(); ctx.restore();
}
function inMap(x,y){ const R=mapRect(); return !!R&&!MOD.fog&&x>=R.x&&x<=R.x+R.w&&y>=R.y&&y<=R.y+R.h; }
function mapToWorld(x,y){ const R=mapRect(), {bb,z}=mapFit(H(),R); return [(bb.x0+bb.x1)/2+(x-(R.x+R.w/2))/z,(bb.y0+bb.y1)/2+(y-(R.y+R.h/2))/z]; }

/* ---------- rangefinder: hover anywhere to read the distance from your ball and to the pin ---------- */
const mouse={x:0,y:0,in:false};
cv.addEventListener('pointermove',e=>{ if(e.pointerType==='mouse'){ mouse.x=e.clientX; mouse.y=e.clientY; mouse.in=true; } });
cv.addEventListener('pointerleave',()=>{ mouse.in=false; });
function drawRange(){
  if(!mouse.in||S.state!=='aim'||drag||!$('card').hidden||inMap(mouse.x,mouse.y)) return;
  const [wx,wy]=toWorld(mouse.x,mouse.y), b=S.ball, h=H(), surf=surfaceAt(h,wx,wy);
  const d1=Math.hypot(wx-b.x,wy-b.y), d2=Math.hypot(wx-h.cup[0],wy-h.cup[1]); if(d1<3) return;
  const green=surf==='green'&&lieNow()==='green', f=d=>green?`${Math.round(d*3)} ft`:`${Math.round(d)} yds`;
  const name=(SURF[surf]&&SURF[surf].name)||'out of bounds';
  const [bx,by]=WS(b.x,b.y), x=mouse.x, y=mouse.y;
  ctx.save(); ctx.strokeStyle='#000'; ctx.fillStyle='#000';
  ctx.globalAlpha=.22; ctx.lineWidth=1.2; ctx.setLineDash([2,4]); ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(x,y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
  ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(x,y,7,0,TAU); ctx.stroke();
  ctx.beginPath(); [[0,-1],[1,0],[0,1],[-1,0]].forEach(([u,v])=>{ ctx.moveTo(x+u*4,y+v*4); ctx.lineTo(x+u*11,y+v*11); }); ctx.stroke();
  ctx.font='800 13px Figtree, system-ui, sans-serif'; ctx.textBaseline='top';
  const l1=`${f(d1)} from your ball`, l2=`${f(d2)} to the pin, ${name}`, tw=Math.max(ctx.measureText(l1).width,ctx.measureText(l2).width);
  const left=x+16+tw>W-view.side, tx=left?x-16:x+16; ctx.textAlign=left?'right':'left';
  ctx.lineJoin='round'; ctx.lineWidth=4; ctx.strokeStyle='#fff'; ctx.strokeText(l1,tx,y+10); ctx.fillText(l1,tx,y+10);
  ctx.font='700 12px Figtree, system-ui, sans-serif'; ctx.fillStyle='#5c5c5c'; ctx.strokeText(l2,tx,y+27); ctx.fillText(l2,tx,y+27);
  ctx.restore();
}

{ const base=draw; draw=function(t,dt){ base(t,dt); drawRange(); drawMap(t);
  const cls=look.on?(look.ptrs.size?'grabbing':'grab'):''; if(cv.className!==cls) cv.className=cls; }; }

/* ---------- mouse: scroll to zoom, right-drag to pan, click the map to look there ---------- */
function lookHere(){ if(!look.on){ enterLook(); if(!look.on) return false; camT={x:cam.x,y:cam.y,z:cam.z}; cam.vx=cam.vy=0; } return true; }
document.addEventListener('wheel',e=>{
  if(e.target!==cv) return; e.preventDefault(); e.stopPropagation();
  if(S.state!=='aim'||drag||!lookHere()) return;
  const z0=cam.z, z=Math.max(.45,Math.min(14,z0*Math.exp(-e.deltaY*.0015))), wx=cam.x+(e.clientX-view.cx)/z0, wy=cam.y+(e.clientY-view.cy)/z0;
  cam.x=wx-(e.clientX-view.cx)/z; cam.y=wy-(e.clientY-view.cy)/z; cam.z=z; cam.vx=cam.vy=0; camT={x:cam.x,y:cam.y,z};
},{capture:true,passive:false});
document.addEventListener('pointerdown',e=>{
  if(e.target!==cv||S.state!=='aim') return;
  if(e.button===0&&inMap(e.clientX,e.clientY)){ e.stopPropagation(); audioInit(); if(drag||!lookHere()) return;
    const [wx,wy]=mapToWorld(e.clientX,e.clientY); camT={x:wx,y:wy,z:Math.max(cam.z,2.5)}; sfx('tick'); return; }
  if(e.button===1||e.button===2){ e.stopPropagation(); e.preventDefault(); audioInit(); if(drag||!lookHere()) return; lookDown(e); }
},true);
cv.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- keyboard ---------- */
document.addEventListener('keydown',e=>{
  const tg=e.target; if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable)) return;
  if(e.ctrlKey||e.metaKey||e.altKey||!$('card').hidden) return;
  const k=e.key;
  if(/^[1-8]$/.test(k)){ e.preventDefault(); if(S.state==='aim'&&!drag) clubsEl.children[+k-1].click(); return; }
  if(k===' '){ e.preventDefault(); if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
    if(S.state==='intro'){ endIntro(); return; } if(S.state==='aim'&&!drag){ audioInit(); look.on?exitLook():enterLook(); } return; }
  if(k==='w'||k==='W'){ if(!$('windBtn').disabled) $('windBtn').click(); return; }
  if(k==='ArrowUp'||k==='ArrowDown'){ e.preventDefault(); if(!$('strike').disabled){ audioInit(); setStrike(Math.max(-1,Math.min(1,S.strike+(k==='ArrowUp'?.1:-.1)))); tone(500+S.strike*200,.03,'sine',.06); } return; }
  if(k==='Escape'&&(!$('windBox').hidden||!$('dial').hidden)){ openWind(false); openDial(false); return; }
  if(k==='p'||k==='P'||(k==='Escape'&&!look.on)){ if(S.state==='aim'&&!drag&&!$('pause').disabled) $('pause').click(); }
},true);
