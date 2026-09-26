/* Ink Nine: Physics engine: constants, clubs, surfaces, ball flight, shapes. Units are yards and seconds. */
"use strict";
/* ============================================================
   ENGINE — pure physics, units are yards and seconds
   ============================================================ */
const TAU=Math.PI*2;
const G=10.7, KD=0.0016, KL=0.0024, KS=0.1, DT=1/120, TS=1.35, LIFT=2.4; // LIFT exaggerates height on screen so every arc reads

const CLUBS=[
  {id:'DR',name:'Driver',        carry:230,loft:14,spin:.62,check:0,  disp:2.2},
  {id:'3W',name:'3 wood',        carry:205,loft:16,spin:.70,check:.05,disp:1.8},
  {id:'5I',name:'5 iron',        carry:175,loft:19,spin:.90,check:.15,disp:1.4},
  {id:'7I',name:'7 iron',        carry:150,loft:26,spin:1.05,check:.25,disp:1.1},
  {id:'9I',name:'9 iron',        carry:125,loft:34,spin:1.20,check:.35,disp:.9},
  {id:'PW',name:'Pitching wedge',carry:100,loft:42,spin:1.35,check:.5, disp:.8},
  {id:'SW',name:'Sand wedge',    carry:70, loft:54,spin:1.50,check:.6, disp:.8},
  {id:'PT',name:'Putter',        carry:30, putter:true,disp:0}
];
const PUTTER=7;
const SURF={
  tee:    {e:.32,f:.6, roll:6,  name:'the tee'},
  fairway:{e:.32,f:.6, roll:6,  name:'the fairway'},
  rough:  {e:.16,f:.42,roll:9,  name:'the rough'},
  sand:   {e:.03,f:.1, roll:28, name:'the bunker'},
  fringe: {e:.3, f:.6, roll:3.4,name:'the fringe'},
  green:  {e:.26,f:.68,roll:1.45,name:'the green'},
  water:  {e:0,  f:0,  roll:99, name:'the water'},
  ob:     {e:0,  f:0,  roll:99, name:'out of bounds'}
};
const SHAPE={DR:1,'3W':.9,'5I':.8,'7I':.65,'9I':.5,PW:.4,SW:.3,PT:0};
// Strike dial: s=-1 hits low on the ball (higher launch, backspin), s=+1 hits high (lower launch, topspin).
// loft/spin: how far launch and spin move; cb/ct: extra check from back/topspin; back: spin-back speed on landing (yd/s)
const STRIKE={DR:{loft:3,spin:.25,cb:.05,ct:.25,back:0},'3W':{loft:3.5,spin:.3,cb:.1,ct:.25,back:0},'5I':{loft:5,spin:.35,cb:.2,ct:.3,back:.5},
  '7I':{loft:6,spin:.4,cb:.25,ct:.3,back:1.2},'9I':{loft:7,spin:.45,cb:.3,ct:.35,back:2},PW:{loft:8,spin:.5,cb:.35,ct:.35,back:3},SW:{loft:10,spin:.55,cb:.35,ct:.4,back:3.6}};
function strikeName(s){ return s<=-.6?'Flop':s<-.15?'Soft, backspin':s<.15?'Stock':s<.6?'Punch, topspin':'Knockdown'; }
function strikeParams(c,sv,lie,quality,LS){
  const R=STRIKE[c.id], k=CS(c).spin*MOD.spinRange*(quality==='mishit'?.3:quality==='good'?.85:1), se=sv*k;
  let back=se<0?-se*R.back:0; if(lie==='rough') back*=.3; else if(lie==='sand') back*=.5;
  const check=c.check*(lie==='rough'?.3:1)+(se<0?-se*R.cb:-se*R.ct);
  const lup=LS?Math.atan(LS.up)*180/Math.PI*.9:0;
  return {loft:Math.max(4,c.loft-se*R.loft+lup),spin:Math.max(.2,c.spin*(1-se*R.spin)),check:Math.max(-.4,Math.min(.95,check)),back,rollMul:se>0?1-.3*Math.min(1,se):1};
}
function lieFactor(c,lie){
  if(lie==='rough') return MOD.roughLie?1:MOD.heavy?.62:.82;
  if(lie==='fringe') return 1;
  if(lie==='sand')  return MOD.sandLie?1:c.id==='SW'?.92:.6;
  return 1;
}
function rollDecel(lie,sp,mul){ return rollOf(lie)*(mul||1)+(lie==='rough'?(MOD.heavy?.8:.5)*sp:lie==='fringe'?.12*sp:0); }
function rollOf(lie){
  let r=SURF[lie].roll;
  if(lie==='green') r*=MOD.greenRoll;
  if(lie==='rough'&&MOD.heavy) r*=1.6;
  if(MOD.bouncy&&(lie==='fairway'||lie==='rough'||lie==='tee')) r*=.7;
  return r;
}
function flightStep(b,w,dt){
  const rx=b.vx-w.x, ry=b.vy-w.y, rz=b.vz, s=Math.hypot(rx,ry,rz), hs=Math.hypot(b.vx,b.vy)||1, sd=b.side||0;
  // sidespin pushes the ball to the right of its heading (screen y points down)
  b.vx+=(-KD*s*rx+KS*sd*s*(-b.vy/hs))*dt;
  b.vy+=(-KD*s*ry+KS*sd*s*(b.vx/hs))*dt;
  if(sd) b.side=sd*Math.exp(-dt/7);
  b.vz+=(-G-KD*s*rz+KL*b.spin*s*s)*dt;
  b.spin*=Math.exp(-dt/7);
  b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt;
}
function carryFor(loft,spin,v){
  const a=loft*Math.PI/180, b={x:0,y:0,z:0,vx:0,vy:v*Math.cos(a),vz:v*Math.sin(a),spin};
  for(let t=0;t<20;t+=DT){ flightStep(b,{x:0,y:0},DT); if(b.z<0&&b.vz<0) break; }
  return b.y;
}
function solveSpeed(loft,spin,target){
  let lo=2,hi=200;
  for(let i=0;i<24;i++){ const m=(lo+hi)/2; if(carryFor(loft,spin,m)<target) lo=m; else hi=m; }
  return (lo+hi)/2;
}
function gauss(){ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v); }

/* ---------- shapes ---------- */
const E=(x,y,rx,ry,rot=0)=>({t:'e',x,y,rx,ry,rot});
const C=(r,...pts)=>({t:'c',r,pts});
function chaikin(p,n=3){
  for(let k=0;k<n;k++){ const q=[p[0]];
    for(let i=0;i<p.length-1;i++){ const a=p[i],b=p[i+1];
      q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]); }
    q.push(p[p.length-1]); p=q; }
  return p;
}
function segDist(px,py,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1;
  let t=((px-a[0])*dx+(py-a[1])*dy)/l; t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy);
}
function inShape(s,x,y){
  if(s.t==='e'){ const c=Math.cos(-s.rot),sn=Math.sin(-s.rot),dx=x-s.x,dy=y-s.y;
    const u=dx*c-dy*sn, v=dx*sn+dy*c; return (u*u)/(s.rx*s.rx)+(v*v)/(s.ry*s.ry)<=1; }
  if(s.t==='r') return x>=s.x0&&x<=s.x1&&y>=s.y0&&y<=s.y1;
  for(let i=0;i<s.poly.length-1;i++) if(segDist(x,y,s.poly[i],s.poly[i+1])<=s.r) return true;
  return false;
}

function seeded(s){ return ()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
