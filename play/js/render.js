/* Ink Nine: Canvas setup, ink patterns and the world-to-screen camera transform. */
"use strict";
/* ============================================================
   RENDER SETUP
   ============================================================ */
const cv=document.getElementById('c'), ctx=cv.getContext('2d');
let W=0,Hh=0,DPR=1, view={cx:0,cy:0,top:90,bot:120};
const cam={x:0,y:0,z:2,vx:0,vy:0}; let camT={x:0,y:0,z:2};
let patRough,patSand,patWater,patStripe,patGreen,patHatch,patShade;
const INK=2.2;

function tile(w,h,draw){
  const c=document.createElement('canvas'); c.width=Math.round(w*DPR); c.height=Math.round(h*DPR);
  const g=c.getContext('2d'); g.scale(DPR,DPR); g.fillStyle='#fff'; g.fillRect(0,0,w,h);
  g.strokeStyle='#000'; g.fillStyle='#000'; g.lineCap='round'; g.lineJoin='round'; draw(g);
  return ctx.createPattern(c,'repeat');
}
function makePatterns(){
  patRough=tile(120,120,g=>{ const r=seeded(11); g.lineWidth=1.1; g.globalAlpha=.4;
    for(let i=0;i<9;i++){ const x=8+r()*104,y=8+r()*104,s=2+r()*1.2; g.beginPath(); g.moveTo(x-s,y+s*.7); g.lineTo(x-s*.2,y-s); g.moveTo(x+s*.2,y-s*.9); g.lineTo(x+s,y+s*.7); g.stroke(); } });
  patSand=tile(18,18,g=>{ const r=seeded(5); g.globalAlpha=.7; for(let i=0;i<4;i++){ g.beginPath(); g.arc(2+r()*14,2+r()*14,.85,0,TAU); g.fill(); } });
  patStripe=tile(36,8,g=>{ g.fillStyle='rgba(0,0,0,.035)'; g.fillRect(0,0,18,8); });
  patGreen=tile(12,12,g=>{ g.fillStyle='rgba(0,0,0,.03)'; g.fillRect(0,0,6,6); g.fillRect(6,6,6,6); });
  patShade=tile(8,8,g=>{ g.lineWidth=1; g.globalAlpha=.55; g.beginPath(); g.moveTo(-1,-1); g.lineTo(9,9); g.moveTo(-1,7); g.lineTo(1,9); g.moveTo(7,-1); g.lineTo(9,1); g.stroke(); });
  patHatch=tile(10,10,g=>{ g.lineWidth=1; g.globalAlpha=.4; g.beginPath(); g.moveTo(-2,12); g.lineTo(12,-2); g.moveTo(-2,2); g.lineTo(2,-2); g.moveTo(8,12); g.lineTo(12,8); g.stroke(); });
  patWater=tile(34,12,g=>{ g.lineWidth=1.3; g.globalAlpha=.8; g.beginPath(); for(let x=0;x<=34;x++){ const y=6+Math.sin(x/34*TAU)*2.2; x?g.lineTo(x,y):g.moveTo(x,y);} g.stroke(); });
}
function setPat(p,ox,oy){ if(p&&p.setTransform) p.setTransform(new DOMMatrix([1/DPR,0,0,1/DPR,ox,oy])); }
function measureView(){
  const tb=document.getElementById('top').getBoundingClientRect(), bb=document.getElementById('bar').getBoundingClientRect();
  view.top=tb.bottom; view.bot=Hh-bb.top+48; view.cx=W/2; view.cy=(view.top+(Hh-view.bot))/2;
}
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1); W=innerWidth; Hh=innerHeight;
  cv.width=Math.round(W*DPR); cv.height=Math.round(Hh*DPR);
  measureView(); makePatterns();
}
const shakeOff={x:0,y:0};
function WS(x,y,z=0){ return [view.cx+(x-cam.x)*cam.z+shakeOff.x, view.cy+(y-cam.y)*cam.z-z*cam.z*LIFT+shakeOff.y]; }
