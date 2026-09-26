/* Ink Nine: Drawing the course, ball, flag, trees, aim preview, ghosts and particles. */
"use strict";
/* ============================================================
   DRAW
   ============================================================ */
function polyPath(poly){ ctx.beginPath(); poly.forEach((p,i)=>{ const [x,y]=WS(p[0],p[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); }
function ellPath(s,g=0){ const [x,y]=WS(s.x,s.y); ctx.beginPath(); ctx.ellipse(x,y,Math.max(.1,(s.rx+g)*cam.z),Math.max(.1,(s.ry+g)*cam.z),s.rot,0,TAU); }
function fillShape(s,pat){
  if(s.t==='e'){ ellPath(s); ctx.fillStyle=pat; ctx.fill(); ctx.lineWidth=INK; ctx.strokeStyle='#000'; ctx.stroke(); }
  else { polyPath(s.poly); ctx.lineWidth=2*s.r*cam.z+INK*2; ctx.strokeStyle='#000'; ctx.stroke(); ctx.lineWidth=2*s.r*cam.z; ctx.strokeStyle=pat; ctx.stroke(); }
}
function rectPath(s){ const [x0,y0]=WS(s.x0,s.y0),[x1,y1]=WS(s.x1,s.y1); ctx.beginPath(); ctx.rect(x0,y0,x1-x0,y1-y0); }
function layer(list,style,ink=INK){
  ctx.strokeStyle='#000';
  list.forEach(s=>{ if(s.t==='c'){ polyPath(s.poly); ctx.lineWidth=2*s.r*cam.z+ink*2; } else { s.t==='e'?ellPath(s):rectPath(s); ctx.lineWidth=ink*2; } ctx.stroke(); });
  list.forEach(s=>{ if(s.t==='c'){ polyPath(s.poly); ctx.lineWidth=2*s.r*cam.z; ctx.strokeStyle='#fff'; ctx.stroke(); ctx.strokeStyle=style; ctx.stroke(); }
    else { s.t==='e'?ellPath(s):rectPath(s); ctx.fillStyle='#fff'; ctx.fill(); ctx.fillStyle=style; ctx.fill(); } });
}
function drawStakes(h){
  h.ob.forEach(o=>{ const edges=[[o.x0,o.y0,o.x1,o.y0],[o.x1,o.y0,o.x1,o.y1],[o.x1,o.y1,o.x0,o.y1],[o.x0,o.y1,o.x0,o.y0]];
    edges.forEach(e=>{ const L=Math.hypot(e[2]-e[0],e[3]-e[1]),n=Math.floor(L/12);
      for(let i=0;i<=n;i++){ const u=i/Math.max(1,n),[x,y]=WS(e[0]+(e[2]-e[0])*u,e[1]+(e[3]-e[1])*u); if(x<-10||x>W+10||y<-10||y>Hh+10) continue;
        ctx.beginPath(); ctx.arc(x,y,3,0,TAU); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle='#000'; ctx.stroke(); } }); });
}
/* Slopes are drawn as cartographer's hachures: tapered strokes that run downhill,
   heavy at the top of the slope and fading to a point at the bottom. Light comes from
   the top-left, so the shadowed side of each mound gets bolder strokes. */
function hachure(x,y,ang,l,w){
  const c=Math.cos(ang),s=Math.sin(ang),px=-s*w/2,py=c*w/2;
  ctx.beginPath(); ctx.moveTo(x+px,y+py); ctx.quadraticCurveTo(x+c*l*.55+px*.5,y+s*l*.55+py*.5,x+c*l,y+s*l);
  ctx.quadraticCurveTo(x+c*l*.55-px*.5,y+s*l*.55-py*.5,x-px,y-py); ctx.closePath(); ctx.fill();
}
function drawSlopes(h){
  ctx.save(); ctx.fillStyle='#000';
  // Terrain is engraved: short strokes follow the contour on every slope that faces away from the light
  // (top-left), heavier and longer the steeper and darker it is. Flat ground stays clean paper.
  { const base=12/cam.z, ws=Math.pow(2,Math.round(Math.log2(base))), inv=1/cam.z;
    const x0=cam.x-(view.cx+20)*inv, x1=cam.x+(W-view.cx+20)*inv, y0=cam.y-(view.cy+20)*inv, y1=cam.y+(Hh-view.cy+20)*inv;
    const buckets=[[],[],[]], LX=-.5, LY=-.5, LZ=.7071;
    for(let gy=Math.floor(y0/ws)*ws; gy<=y1; gy+=ws) for(let gx=Math.floor(x0/ws)*ws; gx<=x1; gx+=ws){
      const hsh=Math.sin(gx*12.9898+gy*78.233)*43758.5453, jr=hsh-Math.floor(hsh), jx=gx+(jr-.5)*ws*.6, jy=gy+((jr*7.13)%1-.5)*ws*.6;
      const T=terrAt(h,jx,jy), m=Math.hypot(T[1],T[2]); if(m<.035) continue;
      const nl=Math.hypot(T[1],T[2],1), lam=(-T[1]*LX-T[2]*LY+LZ)/nl, dark=Math.min(1,(LZ-lam)*3.2+m*1.2);
      if(dark<.12) continue;
      const cx=-T[2]/m, cy=T[1]/m, len=ws*cam.z*(.35+.5*Math.min(1,dark)), [sx,sy]=WS(jx,jy);
      buckets[dark>.66?2:dark>.36?1:0].push(sx-cx*len/2,sy-cy*len/2,sx+cx*len/2,sy+cy*len/2);
    }
    ctx.save(); ctx.strokeStyle='#000'; ctx.lineCap='round';
    [[.22,1],[.38,1.2],[.55,1.4]].forEach(([a,w],k)=>{ const B=buckets[k]; if(!B.length) return; ctx.globalAlpha=a; ctx.lineWidth=w; ctx.beginPath();
      for(let i=0;i<B.length;i+=4){ ctx.moveTo(B[i],B[i+1]); ctx.lineTo(B[i+2],B[i+3]); } ctx.stroke(); });
    ctx.restore(); }
  // the green's overall tilt: a light grain of short downhill strokes (hidden while the putting chevrons are up)
  const gs=h.slope, gm=Math.hypot(gs[0],gs[1]);
  const putting=S.state==='aim'&&CLUBS[S.club].putter&&lieNow()==='green';
  if(gm>.08&&!putting){
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; h.green.forEach(g=>{ const m=Math.max(g.rx,g.ry); x0=Math.min(x0,g.x-m); x1=Math.max(x1,g.x+m); y0=Math.min(y0,g.y-m); y1=Math.max(y1,g.y+m); });
    if((x1-x0)*cam.z>70){
      const ang=Math.atan2(gs[1],gs[0]), sp=Math.max(4,22/cam.z), len=Math.min(16,Math.max(6,cam.z*(1+gm*3))), rnd=seeded(400+S.hole);
      ctx.globalAlpha=.3;
      for(let wy=y0,row=0;wy<y1;wy+=sp,row++) for(let wx=x0+(row%2)*sp/2;wx<x1;wx+=sp){
        const jx=wx+(rnd()-.5)*sp*.4, jy=wy+(rnd()-.5)*sp*.4;
        if(!inAny(h.green,jx,jy)||!inAny(h.green,jx+Math.cos(ang)*len/cam.z,jy+Math.sin(ang)*len/cam.z)) continue;
        const [px,py]=WS(jx,jy); hachure(px,py,ang,len,1.6);
      }
    }
  }
  ctx.restore();
}
function drawTree(tr,i,t){
  const sway=Math.sin(t*1.3+i*1.7)*(.25+S.wind.mph*.03);
  const [x,y]=WS(tr[0]+sway*Math.sign(S.wind.x||1),tr[1]+sway*.3*Math.sign(S.wind.y||1)); const r=tr[2]*cam.z;
  ctx.fillStyle='rgba(0,0,0,.09)'; ctx.beginPath(); ctx.ellipse(x+r*.35,y+r*.32,r,r*.9,0,0,TAU); ctx.fill();
  ctx.beginPath();
  for(let k=0;k<=48;k++){ const a=k/48*TAU, rr=r*(1+.075*Math.sin(a*7+i*2.1)); const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr; k?ctx.lineTo(px,py):ctx.moveTo(px,py); }
  ctx.closePath(); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=INK; ctx.strokeStyle='#000'; ctx.stroke();
  ctx.lineWidth=1.3; ctx.beginPath(); ctx.arc(x-r*.12,y-r*.12,r*.62,.15*Math.PI,.62*Math.PI); ctx.stroke();
  if(r>14){ ctx.beginPath(); for(let k=0;k<3;k++){ const a=.25*Math.PI+k*.16; ctx.moveTo(x+Math.cos(a)*r*.72,y+Math.sin(a)*r*.72); ctx.lineTo(x+Math.cos(a)*r*.86,y+Math.sin(a)*r*.86);} ctx.stroke(); }
}
function drawFlag(t){
  const h=H(); const [cx,cy]=WS(h.cup[0],h.cup[1]);
  const cr=Math.max(4*MOD.cupR,.3*MOD.cupR*cam.z);
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(cx,cy,cr,cr*.72,0,0,TAU); ctx.fill();
  const stretch=1+S.fp, ph=Math.max(36,Math.min(72,2.4*cam.z))*stretch, top=cy-ph;
  ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,top); ctx.stroke();
  const dir=S.wind.x>=0?1:-1, fl=ph*.62, fh=ph*.36, amp=2+S.wind.mph*.35, n=6;
  const topE=[],botE=[];
  for(let i=0;i<=n;i++){ const u=i/n, w=Math.sin(t*(4+S.wind.mph*.3)-i*.9)*amp*u; topE.push([cx+dir*fl*u*(1-.08*Math.abs(Math.sin(t*3-i))), top+w]); botE.push([cx+dir*fl*u*.96, top+fh*(1-u*.25)+w]); }
  ctx.beginPath(); ctx.moveTo(topE[0][0],topE[0][1]); topE.forEach(p=>ctx.lineTo(p[0],p[1])); for(let i=n;i>=0;i--) ctx.lineTo(botE[i][0],botE[i][1]); ctx.closePath();
  ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=1.8; ctx.stroke();
  ctx.fillStyle='#000'; ctx.font=`800 ${Math.round(fh*.62)}px Fraunces, Georgia, serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  const mid=topE[3]; ctx.fillText(String(S.hole+1), mid[0], mid[1]+fh*.45);
}
function drawBall(){
  const b=S.ball; if(b.mode==='gone') return;
  let bx=b.x,by=b.y,bz=Math.max(0,b.z-zgAt(H(),b.x,b.y)),scale=1;
  if(b.mode==='sunk'){ const h=H(),u=Math.min(1,S.sinkT/.16); bx=b.sx+(h.cup[0]-b.sx)*u; by=b.sy+(h.cup[1]-b.sy)*u; scale=Math.max(0,1-Math.max(0,S.sinkT-.12)/.22); if(scale<=0) return; }
  const [gx,gy]=WS(bx,by), [x,y]=WS(bx,by,bz);
  const R=4.8*Math.min(1.9,1+bz*.03)*scale;
  const sh=Math.max(.3,1-bz/45);
  ctx.fillStyle='rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(gx+1,gy+1.5,R*sh*1.15,R*sh*.6,0,0,TAU); ctx.fill();
  let ang=0,sx=1,sy=1;
  if(b.mode==='air'){ const vx=b.vx*cam.z, vy=b.vy*cam.z-b.vz*cam.z*LIFT, s=Math.hypot(vx,vy); const k=Math.min(.6,s/700); ang=Math.atan2(vy,vx); sx=1+k; sy=1/(1+k); }
  else if(b.mode==='roll'){ const s=Math.hypot(b.vx,b.vy)*cam.z; const k=Math.min(.3,s/1500); ang=Math.atan2(b.vy,b.vx); sx=1+k; sy=1/(1+k); }
  else if(drag&&S.state==='aim'){ const d=dragInfo(); const k=d.power*.32; ang=d.ang; sx=1-k*.55; sy=1+k*.45; }
  let jx=0,jy=0; if(drag&&S.state==='aim'){ const p=dragInfo().power; if(p>.85){ jx=(Math.random()-.5)*(p-.85)*14; jy=(Math.random()-.5)*(p-.85)*14; } }
  ctx.save(); ctx.translate(x+jx,y+jy);
  if(b.mode==='sunk'){ ctx.scale(1+.4*(1-scale),1-.4*(1-scale)); }
  ctx.scale(1+S.sq,1-S.sq*.8);
  ctx.rotate(ang); ctx.scale(sx,sy);
  ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=1.8; ctx.strokeStyle='#000'; ctx.stroke();
  ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,R*.55,-2.4,-1.3); ctx.stroke();
  ctx.restore();
}
function drawTrail(){
  const tr=S.ball.trail; if(tr.length<4) return;
  ctx.fillStyle='#000';
  for(let i=0;i<tr.length;i+=6){ const p=tr[i],[x,y]=WS(p[0],p[1],p[2]); ctx.globalAlpha=.15+.5*(i/tr.length); ctx.beginPath(); ctx.arc(x,y,1.3,0,TAU); ctx.fill(); }
  ctx.globalAlpha=1;
}
function drawAim(t){
  const b=S.ball,h=H(),c=CLUBS[S.club],lie=lieNow(),[bx,by]=WS(b.x,b.y);
  let ang,dist,active=false,curve=0,path=null,stop=null;
  if(drag){ const d=dragInfo(); ang=d.ang; active=d.l>4;
    const LS=lieSlope(h,b.x,b.y,ang);
    dist=d.power*(c.putter?CS(c).carry:CS(c).carry*lieFactor(c,lie)*MOD.carry*slopeCarry(LS.up));
    if(active&&!c.putter&&dist>=3){ curve=dragCurve(); const P=strikeParams(c,S.strike,lie,'pure',LS); const sim=simPath(b.x,b.y,ang,P,solveCached(P.loft,P.spin,dist),curve*SHAPE[c.id]*MOD.bend+slopeCurve(LS.side)); path=sim.pts; stop=predictStop(sim.b); } }
  else { ang=aimAngle(); dist=c.putter?Math.min(distToCup(),30):Math.min(reachFor(c,lie),distToCup()); }
  if(!path) path=[[b.x,b.y,0],[b.x+Math.cos(ang)*dist,b.y+Math.sin(ang)*dist,0]];
  const end=path[path.length-1], [sx,sy]=WS(end[0],end[1]);
  ctx.save(); ctx.globalAlpha=active?1:.35; ctx.strokeStyle='#000'; ctx.lineCap='round';
  if(path.length>2){ const ga=ctx.globalAlpha; ctx.globalAlpha=ga*.4; ctx.setLineDash([6,5]); ctx.lineDashOffset=-t*14; ctx.lineWidth=1.4; ctx.beginPath(); path.forEach((p,i)=>{ const [x,y]=WS(p[0],p[1],p[2]||0); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke(); ctx.globalAlpha=ga; }
  ctx.setLineDash([.1,7]); ctx.lineDashOffset=-t*20; ctx.lineWidth=3; ctx.beginPath();
  path.forEach((p,i)=>{ const [x,y]=WS(p[0],p[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke(); ctx.setLineDash([]);
  if(stop&&Math.hypot(stop[0]-end[0],stop[1]-end[1])>.6){ const [qx,qy]=WS(stop[0],stop[1]);
    ctx.setLineDash([5,4]); ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(qx,qy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(qx,qy,4.5,0,TAU); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(qx,qy,1.8,0,TAU); ctx.fill();
    if(stop[2]==='water'||stop[2]==='ob'){ ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(qx-5,qy-5); ctx.lineTo(qx+5,qy+5); ctx.moveTo(qx+5,qy-5); ctx.lineTo(qx-5,qy+5); ctx.stroke(); } }
  if(!c.putter){
    const rr=Math.max(9,Math.max(1.5,dist*Math.tan(CS(c).disp*MOD.disp*Math.PI/180)*1.6)*cam.z);
    ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(sx,sy,rr,rr*.8,0,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx-4,sy); ctx.lineTo(sx+4,sy); ctx.moveTo(sx,sy-4); ctx.lineTo(sx,sy+4); ctx.stroke();
    if(active){ ctx.font='800 13px Figtree, system-ui, sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      const txt=`${Math.round(dist)} yds`+(Math.abs(curve)>.05?`, bends ${curve>0?'right':'left'}`:'');
      const tw=ctx.measureText(txt).width, left=sx+rr+6+tw>W-8, tx=left?sx-rr-6:sx+rr+6; ctx.textAlign=left?'right':'left';
      ctx.lineWidth=4; ctx.strokeStyle='#fff'; ctx.strokeText(txt,tx,sy); ctx.fillStyle='#000'; ctx.fillText(txt,tx,sy); }
  } else if(active){
    ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx,sy,4,0,TAU); ctx.stroke();
  }
  ctx.restore();
  if(drag&&active&&!c.putter){ const tm=timing(); ctx.save(); ctx.strokeStyle='#000';
    ctx.globalAlpha=tm.q==='mishit'?.2:tm.q==='pure'?1:.55; ctx.lineWidth=tm.q==='pure'?3.2:1.4;
    ctx.beginPath(); ctx.arc(bx,by,tm.r,0,TAU); ctx.stroke(); ctx.restore(); }
  if(c.putter&&lie==='green'){ // chevrons point downhill; bigger = steeper
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; h.green.forEach(g=>{ const m=Math.max(g.rx,g.ry); x0=Math.min(x0,g.x-m); x1=Math.max(x1,g.x+m); y0=Math.min(y0,g.y-m); y1=Math.max(y1,g.y+m); });
    ctx.save(); ctx.strokeStyle='#000'; ctx.lineWidth=1.6; const ph=(t*.8)%1;
    for(let wx=x0+1;wx<x1;wx+=3.5) for(let wy=y0+1;wy<y1;wy+=3.5){
      if(!inAny(h.green,wx,wy)) continue; const sl=slopeAt(h,wx,wy,'green'), m=Math.hypot(sl[0],sl[1]); if(m<.06) continue;
      const a=Math.atan2(sl[1],sl[0]), dd=ph*1.6, [px,py]=WS(wx+Math.cos(a)*dd,wy+Math.sin(a)*dd), sz=3+Math.min(5,m*8);
      ctx.globalAlpha=.5*Math.sin(ph*Math.PI); ctx.save(); ctx.translate(px,py); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-sz*.4,-sz); ctx.lineTo(sz*.5,0); ctx.lineTo(-sz*.4,sz); ctx.stroke(); ctx.restore(); }
    ctx.restore(); }
  if(drag){ const d=dragInfo(); if(d.l>4){ const pa=d.ang+Math.PI, L=14+d.power*58;
    const ex=bx+Math.cos(pa)*L, ey=by+Math.sin(pa)*L;
    ctx.strokeStyle='#000'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(bx+Math.cos(pa)*8,by+Math.sin(pa)*8); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex,ey,7,0,TAU); ctx.fillStyle='#fff'; ctx.fill(); ctx.stroke();
    ctx.lineWidth=1; ctx.globalAlpha=.3; ctx.beginPath(); ctx.arc(bx,by,17,0,TAU); ctx.stroke(); ctx.globalAlpha=1;
    ctx.lineWidth=3.5; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(bx,by,17,-Math.PI/2,-Math.PI/2+d.power*TAU); ctx.stroke(); } }
}
function drawParts(dt,ground){
  for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; if(ground!==(p.k==='ring')) continue;
    p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } if(p.t<0) continue; const u=p.t/p.life;
    ctx.strokeStyle='#000'; ctx.fillStyle='#000';
    if(p.k==='ring'){ const [x,y]=WS(p.x,p.y), r=(p.r+u*(p.thin?2.5:9))*cam.z; ctx.globalAlpha=1-u; ctx.lineWidth=p.thin?1.2:2; ctx.beginPath(); ctx.ellipse(x,y,r,r*.75,0,0,TAU); ctx.stroke(); }
    else if(p.k==='dot'||p.k==='star'){ p.vz-=G*1.4*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z=Math.max(0,p.z+p.vz*dt); if(p.z===0){p.vx*=.8;p.vy*=.8;}
      const [x,y]=WS(p.x,p.y,p.z); ctx.globalAlpha=1-u*u;
      if(p.k==='dot'){ if(p.tick){ ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(x-2,y+1.5); ctx.lineTo(x,y-2); ctx.lineTo(x+2,y+1.5); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(x,y,p.s,0,TAU); ctx.fill(); } }
      else { p.rot+=dt*6; const s=(5+4*Math.sin(u*Math.PI))*(1-u*.4); ctx.save(); ctx.translate(x,y); ctx.rotate(p.rot); ctx.beginPath();
        for(let k=0;k<8;k++){ const a=k/8*TAU, rr=k%2?s*.35:s; k?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(rr,0);} ctx.closePath(); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=1.5; ctx.stroke(); ctx.restore(); } }
    else if(p.k==='label'){ const [x,y]=WS(p.x,p.y);
      const sc=u<.08?u/.08*1.3:u<.16?1.3-(u-.08)/.08*.4:u<.24?.9+(u-.16)/.08*.1:1;
      const sy=sc>1?sc*(2-sc):sc<1&&u>.08?sc*(1+(1-sc)*1.2):sc;
      ctx.globalAlpha=u>.78?(1-u)/.22:1; ctx.save(); ctx.translate(x,y-30-p.off-u*30); ctx.scale(sc,sy);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if(p.big){ ctx.font='italic 900 19px Fraunces, Georgia, serif'; const w=ctx.measureText(p.text).width+22;
        ctx.beginPath(); ctx.roundRect?ctx.roundRect(-w/2,-15,w,30,15):ctx.rect(-w/2,-15,w,30); ctx.fillStyle='#000'; ctx.fill();
        ctx.fillStyle='#fff'; ctx.fillText(p.text,0,1); }
      else { ctx.font='800 14px Figtree, system-ui, sans-serif'; ctx.lineWidth=4.5; ctx.strokeStyle='#fff'; ctx.lineJoin='round'; ctx.strokeText(p.text,0,0); ctx.fillStyle='#000'; ctx.fillText(p.text,0,0); }
      ctx.restore(); }
    else if(p.k==='streak'){ const e=1-Math.pow(1-u,3), d0=8+e*p.len, d1=d0+p.len*(1-u); ctx.globalAlpha=1-u; ctx.lineWidth=2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(p.sx+Math.cos(p.ang)*d0,p.sy+Math.sin(p.ang)*d0); ctx.lineTo(p.sx+Math.cos(p.ang)*d1,p.sy+Math.sin(p.ang)*d1); ctx.stroke(); }
    ctx.globalAlpha=1; }
}
function draw(t,dt){
  const h=H();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const [ox,oy]=WS(0,0);
  setPat(patRough,ox,oy); setPat(patSand,ox,oy); setPat(patWater,ox+t*7,oy); setPat(patStripe,ox,oy); setPat(patGreen,ox,oy); setPat(patHatch,ox,oy); setPat(patShade,ox,oy);
  ctx.fillStyle=patRough; ctx.fillRect(0,0,W,Hh);
  ctx.lineCap='round'; ctx.lineJoin='round';
  // every surface is inked as one merged layer: all outlines first, then all fills
  layer(h.ob,patHatch); drawStakes(h);
  layer(h.fair,patStripe);
  layer(h.water,patWater);
  ctx.strokeStyle='#000'; ctx.lineWidth=1.3; ctx.setLineDash([3,5]); h.green.forEach(g=>{ ellPath(g,1.6); ctx.stroke(); }); ctx.setLineDash([]);
  ctx.fillStyle='#fff'; h.green.forEach(g=>{ ellPath(g,1.45); ctx.fill(); });
  layer(h.green,patGreen,INK+.3);
  layer(h.sand,patSand);
  drawSlopes(h);

  // tee box
  { const [x,y]=WS(h.tee[0]-5,h.tee[1]-3); const w=10*cam.z, hh=6*cam.z; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,hh,Math.min(8,hh/2)):ctx.rect(x,y,w,hh);
    ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=1.6; ctx.strokeStyle='#000'; ctx.stroke();
    [-4,4].forEach(d=>{ const [mx,my]=WS(h.tee[0]+d,h.tee[1]-1.5); ctx.beginPath(); ctx.arc(mx,my,3,0,TAU); ctx.fillStyle='#000'; ctx.fill(); }); }
  drawParts(dt,true);
  if(S.state==='aim') drawAim(t);
  drawTrail();
  const b=S.ball;
  let under=false; { const bz=b.z-zgAt(h,b.x,b.y); for(const tr of h.trees){ if(Math.hypot(b.x-tr[0],b.y-tr[1])<tr[2]&&bz<tr[2]*1.8){ under=true; break; } } }
  if(under) drawBall();
  drawFlag(t);
  h.trees.forEach((tr,i)=>drawTree(tr,i,t));
  if(!under) drawBall();
  drawGhosts();
  if(MOD.fog){ const [fx,fy]=WS(b.x,b.y), g=ctx.createRadialGradient(fx,fy,60*cam.z,fx,fy,88*cam.z);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,1)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,Hh);
    ctx.save(); ctx.globalAlpha=.14; ctx.strokeStyle='#000'; ctx.lineWidth=1.2; ctx.lineCap='round';
    for(let i=0;i<14;i++){ const yy=((i*97+t*6)%(Hh+40))-20, xx=((i*211)%W)-60+Math.sin(t*.3+i)*20, rr=Math.hypot(xx+60-fx,yy-fy); if(rr<70*cam.z) continue;
      ctx.beginPath(); ctx.moveTo(xx,yy); ctx.bezierCurveTo(xx+30,yy-5,xx+60,yy+5,xx+110,yy); ctx.stroke(); }
    ctx.restore(); }
  drawParts(dt,false);
}
