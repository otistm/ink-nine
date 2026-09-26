/* Ink Nine: All course data (Meadowbrook, Saltmarsh Links, Crownwood, Practice Green), terrain heightfield, surface lookup and slopes. */
"use strict";
/* ---------- the nine ---------- */
const R=(x0,y0,x1,y1)=>({t:'r',x0:Math.min(x0,x1),y0:Math.min(y0,y1),x1:Math.max(x0,x1),y1:Math.max(y0,y1)});
function grove(x,y0,y1,step,seed,jit=6,r0=6,r1=10){ const r=seeded(seed),t=[]; for(let y=y0;y>=y1;y-=step) t.push([x+(r()-.5)*jit*2,y+(r()-.5)*step*.5,r0+r()*(r1-r0)]); return t; }
// hills: gaussian bumps (a>0) or bowls (a<0); they tilt every rolling ball, not just on greens
const COURSE_MEADOW=[
 {name:'Opening Line',tip:'Wide landing area at 240. A mound in the middle kicks balls toward the bunkers.',
  par:4,len:360,tee:[0,0],cup:[-4,-358],
  fair:[C(20,[0,-45],[0,-205]),E(0,-240,28,34),C(18,[0,-265],[-3,-338])],
  green:[E(-2,-355,15,12),E(-9,-366,10,8,.3)],water:[],ob:[],
  sand:[E(-30,-236,8,6,.4),E(-35,-247,6,5),E(15,-340,6,4,.6),E(-21,-372,5,4)],
  trees:[...grove(-56,-70,-330,34,3),...grove(56,-90,-320,38,4),[18,-392,9],[-30,-394,8]],
  hills:[{x:6,y:-232,r:12,a:5},{x:-4,y:-358,r:6,a:-.6}],slope:[.15,-.1]},
 {name:'The Moat',tip:'Water guards the front and right. The safe miss is the grass on the left.',
  par:3,len:165,tee:[0,0],cup:[14,-168],
  fair:[E(-30,-140,14,11)],
  green:[E(-2,-158,15,11,.2),E(14,-168,9,8)],
  water:[E(10,-108,40,19,.15),E(38,-150,13,27)],ob:[],
  sand:[E(-17,-171,6,4,-.3),E(2,-179,5,3)],
  trees:[[-46,-160,9],[-40,-185,8],[10,-202,10],[40,-198,8],[62,-118,9]],
  hills:[{x:4,y:-160,r:6,a:.9}],slope:[.2,.05]},
 {name:'Long Way Round',tip:'Play left around the lake, or carry it to the island fairway and go for eagle.',
  par:5,len:520,tee:[0,0],cup:[142,-508],
  fair:[C(22,[0,-45],[-8,-250],[0,-380],[60,-455],[118,-490]),E(130,-420,20,17)],
  green:[E(140,-505,16,13,.5)],
  water:[E(70,-310,48,68,.25)],ob:[],
  sand:[E(-36,-238,9,6),E(-30,-392,8,6),E(148,-432,6,5),E(162,-492,6,8),E(150,-524,8,4)],
  trees:[...grove(-54,-90,-430,36,5),[50,-130,9],[60,-165,8],[182,-468,9],[186,-440,8],[172,-542,9],[124,-546,8]],
  hills:[{x:-6,y:-300,r:16,a:5},{x:132,y:-500,r:6,a:.7}],slope:[.1,.3]},
 {name:'Stakes',tip:'Out of bounds down the whole right side. The fairway pinches at 250 and the green has a false front.',
  par:4,len:392,tee:[0,0],cup:[-10,-390],
  fair:[C(20,[0,-45],[-6,-205]),C(12,[-6,-205],[-10,-292]),E(-12,-318,18,15),C(13,[-12,-330],[-12,-368])],
  green:[E(-12,-385,15,13)],water:[],ob:[R(40,40,260,-480)],
  sand:[E(-34,-250,10,7,.3),E(12,-262,6,4),E(8,-397,6,5),E(-33,-392,6,6)],
  trees:[...grove(-56,-60,-400,32,8),[-5,-432,9],[-30,-426,8]],
  hills:[{x:-12,y:-370,r:7,a:2.2}],slope:[-.2,.2]},
 {name:'Pot Luck',tip:'Seven pot bunkers and a two-tier green. The pin is on the top shelf.',
  par:3,len:188,tee:[0,0],cup:[5,-195],
  fair:[C(12,[0,-120],[0,-162])],
  green:[E(0,-185,17,14),E(-9,-196,8,7)],water:[],ob:[],
  sand:[E(-22,-178,4,4),E(-21,-195,4,4),E(21,-182,4,4),E(19,-198,4,3),E(-7,-167,5,3),E(9,-166,4,3),E(1,-205,6,3)],
  trees:[[-40,-120,9],[40,-140,8],[-34,-217,9],[32,-220,10],[0,-234,8],[-52,-170,8],[54,-185,9]],
  hills:[{x:-8,y:-187,r:5,a:.75},{x:2,y:-187,r:5,a:.75},{x:12,y:-187,r:5,a:.75}],slope:[.1,.3]},
 {name:'The Needle',tip:'Drivable if you thread the chute. A cross bunker waits at 215.',
  par:4,len:305,tee:[0,0],cup:[8,-308],
  fair:[C(11,[0,-45],[0,-200]),E(0,-248,17,24)],
  green:[E(0,-298,18,14),E(10,-310,10,8)],water:[],ob:[],
  sand:[C(3.5,[-15,-214],[0,-219],[15,-213]),E(-20,-300,5,7),E(22,-296,4,6)],
  trees:[...grove(-25,-60,-262,20,11,2,6,8),...grove(25,-70,-262,20,12,2,6,8)],
  hills:[{x:7,y:-307,r:7,a:-.7}],slope:[-.25,0]},
 {name:'Creek Bend',tip:'The creek crosses twice. Lay up short of each one, or fly them both.',
  par:5,len:535,tee:[0,0],cup:[3,-523],
  fair:[C(22,[0,-45],[0,-192]),C(22,[8,-232],[60,-332]),C(20,[62,-372],[20,-470]),C(14,[20,-470],[4,-505])],
  green:[E(0,-520,16,14),E(10,-508,8,6)],
  water:[C(6,[-120,-208],[-40,-203],[30,-214],[100,-202],[170,-212]),C(6,[-70,-356],[20,-345],[95,-354],[180,-342])],ob:[],
  sand:[E(40,-497,7,5,.4),E(-24,-510,6,6),E(92,-298,9,6),E(-20,-160,8,5)],
  trees:[[-40,-280,10],[-30,-302,8],[112,-420,9],[-24,-420,9],[-34,-440,7],[60,-560,10],[-20,-560,8],[50,-120,9],[-45,-100,9]],
  hills:[{x:44,y:-425,r:14,a:5}],slope:[.2,-.25]},
 {name:'Island',tip:'All carry. The green funnels toward the pin.',
  par:3,len:132,tee:[0,0],cup:[4,-131],
  fair:[],green:[E(0,-127,14,11),E(-8,-120,7,6)],
  water:[E(0,-125,34,30)],ob:[],
  sand:[E(11,-117,4,3,.4)],
  trees:[[-44,-150,9],[48,-140,8],[0,-172,10],[-30,-176,8],[30,-178,9]],
  hills:[{x:4,y:-131,r:6,a:-.6}],slope:[0,.25]},
 {name:'Homeward',tip:'The lake hugs the whole left side and the green leans toward it. Bail right, finish brave.',
  par:4,len:422,tee:[0,0],cup:[-48,-418],
  fair:[C(22,[0,-45],[5,-220],[-15,-340],[-32,-392])],
  green:[E(-45,-415,15,12,-.4)],
  water:[E(-70,-262,40,150,.12),E(-82,-422,26,24)],ob:[],
  sand:[E(28,-232,10,6),E(-20,-434,6,5),E(-24,-398,4,3)],
  trees:[...grove(54,-60,-420,34,21),[-20,-462,9],[-50,-458,8]],
  hills:[{x:-44,y:-410,r:6,a:.6}],slope:[-.3,.1]}
];
/* ---------- Saltmarsh Links: seaside, dunes, pot bunkers, wind ---------- */
const COURSE_LINKS=[
 {name:'Harbor Mouth',tip:'The sea runs down the whole left side. Dunes on the right kick balls back toward it.',par:4,tee:[0,0],cup:[-28,-380],
  fair:[C(24,[0,-45],[-10,-220],[-25,-340])],green:[E(-30,-378,15,12)],water:[C(40,[-90,20],[-85,-200],[-80,-440])],
  sand:[E(22,-230,5,5),E(12,-250,4,4),E(-8,-362,4,4),E(-2,-394,4,4)],trees:[[72,-100,7],[82,-262,8]],
  hills:[{x:40,y:-150,r:18,a:4},{x:35,y:-300,r:16,a:4},{x:-28,y:-380,r:6,a:-.5}],slope:[-.2,.1]},
 {name:'The Dunes',tip:'A dune ridge crosses at 200. Carry it, or lay up and play over it.',par:4,tee:[0,0],cup:[15,-352],
  fair:[C(22,[0,-45],[0,-170]),E(0,-240,26,30),C(18,[0,-270],[10,-322])],green:[E(12,-350,15,13)],ob:[R(62,40,220,-430)],
  sand:[E(-20,-232,5,4),E(26,-262,5,4),E(-4,-336,4,4),E(31,-356,4,5)],trees:[[-60,-120,8],[-56,-300,8]],
  hills:[{x:-20,y:-200,r:12,a:5},{x:10,y:-205,r:12,a:5},{x:38,y:-198,r:11,a:5}],slope:[.15,.2]},
 {name:'Lighthouse',tip:'All carry over the inlet to a green ringed by pots.',par:3,tee:[0,0],cup:[4,-177],
  fair:[C(10,[0,-130],[0,-158])],green:[E(0,-175,14,12)],water:[E(-10,-85,55,30,.2)],
  sand:[E(-18,-170,4,4),E(18,-165,4,4),E(0,-192,6,3)],trees:[[40,-192,8]],
  hills:[{x:-6,y:-172,r:5,a:.8}],slope:[-.3,.1]},
 {name:'Long Shore',tip:'Sea on the right, dunes on the left, pots down the middle. Three good shots.',par:5,tee:[0,0],cup:[47,-531],
  fair:[C(24,[0,-45],[5,-250],[25,-420],[40,-495])],green:[E(45,-528,16,13,.3)],water:[C(38,[95,30],[95,-260],[110,-560])],ob:[R(-220,40,-72,-600)],
  sand:[E(0,-290,6,5),E(15,-312,5,4),E(28,-542,5,5),E(62,-514,5,5)],trees:[[-60,-300,8]],
  hills:[{x:-40,y:-200,r:20,a:4},{x:-30,y:-400,r:18,a:4},{x:40,y:-470,r:12,a:3}],slope:[.25,-.2]},
 {name:'Salt Pan',tip:'A waste bunker crosses at 200. The green is crowned and sheds weak approaches.',par:4,tee:[0,0],cup:[-10,-403],
  fair:[C(24,[0,-45],[0,-182]),C(22,[0,-218],[-10,-365])],green:[E(-12,-400,16,14)],
  sand:[E(0,-200,42,13,.08),E(-34,-390,5,5),E(10,-416,5,5)],trees:[[50,-120,9],[-56,-280,9]],
  hills:[{x:-12,y:-400,r:9,a:.9}],slope:[0,.15]},
 {name:'Wee Knoll',tip:'The green sits on a knoll. Anything short or long rolls off.',par:3,tee:[0,0],cup:[2,-141],
  fair:[],green:[E(0,-140,11,10)],
  sand:[E(-15,-136,4,4),E(15,-144,4,4),E(-4,-156,5,3),E(6,-125,5,3)],trees:[[30,-100,8],[-35,-162,8]],
  hills:[{x:0,y:-140,r:12,a:1.4}],slope:[0,0]},
 {name:'Crosswinds',tip:'Dogleg left around a bay. Cut the corner over the water if you dare.',par:4,tee:[0,0],cup:[-55,-362],
  fair:[C(22,[0,-45],[0,-230],[-40,-330])],green:[E(-52,-360,15,12,-.3)],water:[E(-80,-230,50,60,.2)],
  sand:[E(24,-240,6,5),E(-30,-380,4,4),E(-72,-346,4,4)],trees:[[45,-300,8]],
  hills:[{x:40,y:-120,r:18,a:4}],slope:[-.3,.1]},
 {name:'Bramble',tip:'An S-bend with a burn at 265 and fences down the right.',par:5,tee:[0,0],cup:[6,-508],
  fair:[C(22,[0,-45],[20,-200],[-10,-340],[0,-470])],green:[E(4,-505,16,14)],water:[C(5,[-80,-270],[0,-262],[80,-275])],ob:[R(70,40,220,-560)],
  sand:[E(-20,-180,6,5),E(35,-330,6,5),E(-15,-490,5,5),E(24,-518,5,4)],trees:[[-60,-200,8],[-50,-362,8]],
  hills:[{x:30,y:-120,r:18,a:4},{x:-40,y:-420,r:18,a:4}],slope:[.1,.3]},
 {name:'Clubhouse',tip:'The sea guards the left of the final green. Bail right and grind.',par:4,tee:[0,0],cup:[-22,-428],
  fair:[C(24,[0,-45],[5,-250],[-10,-390])],green:[E(-18,-425,16,13)],water:[C(30,[-110,-200],[-80,-380],[-60,-470])],
  sand:[E(30,-260,6,5),E(-40,-272,5,5),E(8,-442,5,5),E(-4,-406,5,3)],trees:[[62,-160,8]],
  hills:[{x:40,y:-330,r:18,a:4}],slope:[-.25,.15]}
];
/* ---------- Crownwood: championship woodland, water, narrow ---------- */
const COURSE_CROWN=[
 {name:'Cathedral',tip:'A long chute of trees. A mound in the landing area splits the fairway.',par:4,tee:[0,0],cup:[3,-400],
  fair:[C(18,[0,-45],[0,-360])],green:[E(0,-398,14,12)],
  sand:[E(-14,-250,6,4),E(-18,-385,6,8),E(18,-405,6,8)],trees:[...grove(-34,-60,-360,24,31,3,7,10),...grove(34,-60,-360,24,32,3,7,10)],
  hills:[{x:0,y:-240,r:14,a:4}],slope:[.2,.1]},
 {name:'Reservoir',tip:'A lake guards the right of the landing area and the front of the green. Lay up short of 495.',par:5,tee:[0,0],cup:[12,-543],
  fair:[C(22,[0,-45],[-10,-260],[-20,-420],[0,-470])],green:[E(10,-540,16,13)],water:[E(60,-260,40,80,.1),E(15,-505,30,10)],
  sand:[E(-40,-300,8,6),E(35,-555,6,5),E(-12,-553,5,5)],trees:grove(-62,-80,-500,40,33),
  hills:[{x:12,y:-543,r:6,a:-.4}],slope:[.15,.25]},
 {name:'Postage Stamp',tip:'A tiny green over water, wrapped in sand.',par:3,tee:[0,0],cup:[1,-156],
  fair:[],green:[E(0,-155,9,8)],water:[E(0,-90,30,24)],
  sand:[E(-14,-152,5,6),E(14,-158,5,6),E(0,-167,8,3),E(-2,-142,7,3)],trees:[[-40,-170,9],[40,-165,9],[0,-190,10]],
  hills:[{x:1,y:-156,r:4,a:-.4}],slope:[.2,.2]},
 {name:'Timberline',tip:'Dogleg right. Trees block the corner, and the green has a false front.',par:4,tee:[0,0],cup:[120,-458],
  fair:[C(20,[0,-45],[0,-240],[70,-330],[110,-420])],green:[E(118,-455,15,12,.4)],
  sand:[E(95,-440,6,5),E(140,-448,5,6)],trees:[[30,-200,10],[40,-230,10],[35,-165,9],[55,-255,9],[20,-135,9],...grove(-40,-80,-300,34,41),[-20,-330,10],[20,-400,9],[150,-490,9]],
  hills:[{x:118,y:-440,r:6,a:1.5}],slope:[-.2,.2]},
 {name:'Twin Ponds',tip:'Ponds squeeze both sides of the landing area.',par:4,tee:[0,0],cup:[-4,-383],
  fair:[C(18,[0,-45],[0,-340])],green:[E(0,-380,15,12)],water:[E(-45,-230,22,30),E(45,-250,22,30)],
  sand:[E(20,-370,6,5),E(-20,-393,6,4)],trees:[[-60,-120,9],[60,-110,9],[-50,-340,9],[55,-350,9]],
  hills:[{x:0,y:-380,r:10,a:.7}],slope:[.2,-.1]},
 {name:'Island Crown',tip:'A long carry to an island. No bail-out.',par:3,tee:[0,0],cup:[4,-180],
  fair:[],green:[E(0,-178,13,11)],water:[E(0,-170,40,34)],
  sand:[E(-10,-168,4,3)],trees:[[-56,-200,9],[56,-190,9]],
  hills:[{x:4,y:-180,r:6,a:-.5}],slope:[.25,0]},
 {name:'Long Gallery',tip:'A creek crosses at 335 between two walls of trees.',par:5,tee:[0,0],cup:[-3,-563],
  fair:[C(22,[0,-45],[-20,-250],[10,-420],[0,-520])],green:[E(0,-560,16,13)],water:[C(6,[-90,-330],[0,-338],[90,-325])],
  sand:[E(20,-230,7,6),E(-25,-470,7,6),E(-18,-575,6,5),E(20,-548,5,6)],trees:[...grove(-62,-80,-540,40,71),...grove(62,-90,-540,40,72)],
  hills:[{x:-5,y:-420,r:16,a:4}],slope:[-.1,.3]},
 {name:"Needle's Eye",tip:'Short, but water left of the green and trees everywhere else.',par:4,tee:[0,0],cup:[-8,-332],
  fair:[C(14,[0,-45],[0,-290])],green:[E(-5,-330,13,11)],water:[E(-40,-300,18,40)],
  sand:[E(15,-322,5,6)],trees:[...grove(26,-60,-300,22,51,2,6,8),...grove(-26,-60,-240,22,52,2,6,8)],
  hills:[{x:-8,y:-332,r:6,a:.8}],slope:[-.3,0]},
 {name:'The Crown',tip:'A long finisher. Water crosses just in front of the green.',par:4,tee:[0,0],cup:[5,-460],
  fair:[C(24,[0,-45],[10,-260],[0,-390])],green:[E(0,-455,17,14)],water:[C(8,[-120,-420],[0,-418],[120,-425])],
  sand:[E(-26,-465,6,6),E(28,-450,6,6),E(-30,-250,8,6)],trees:[...grove(-60,-80,-400,36,61),...grove(64,-80,-400,36,62)],
  hills:[{x:5,y:-460,r:8,a:.9}],slope:[.1,.3]}
];
/* ---------- Practice Green: the tutorial course ---------- */
const COURSE_TUT=[
 {name:'First Swing',tip:'A wide, friendly hole to learn the swing.',par:4,tee:[0,0],cup:[3,-287],
  fair:[C(30,[0,-45],[0,-255])],green:[E(0,-285,20,16)],sand:[E(-27,-280,6,5)],
  trees:[[-62,-120,9],[64,-160,9],[-58,-240,8],[60,-300,9]],hills:[{x:-3,y:-287,r:7,a:-.5}],slope:[.2,.1]},
 {name:'Around the Bend',tip:'Trees guard the corner. Curve it around them.',par:4,tee:[0,0],cup:[120,-325],
  fair:[C(26,[0,-45],[0,-190],[70,-250],[110,-300])],green:[E(118,-322,17,14,.4)],sand:[E(140,-312,5,6)],
  trees:[[40,-170,11],[55,-195,10],[30,-140,10],[66,-218,9],[-50,-120,9],[-40,-260,9],[150,-360,9]],hills:[{x:-4,y:-130,r:14,a:5}],slope:[-.2,.2]},
 {name:'Over the Pond',tip:'Water in front. Fly it high and make it stop.',par:3,tee:[0,0],cup:[2,-96],
  fair:[],green:[E(0,-95,14,11)],water:[E(0,-58,34,20)],sand:[E(16,-104,5,4)],
  trees:[[-40,-110,9],[42,-120,8],[0,-130,9]],hills:[{x:2,y:-96,r:5,a:-.4}],slope:[0,.2]}
];
const COURSES=[{name:'Meadowbrook',holes:COURSE_MEADOW},{name:'Saltmarsh Links',holes:COURSE_LINKS},{name:'Crownwood',holes:COURSE_CROWN},{name:'Practice Green',holes:COURSE_TUT}];
COURSES.forEach(c=>c.holes.forEach(h=>{
  for(const k of ['fair','water','sand','ob','hills','trees']) h[k]=h[k]||[];
  [...h.fair,...h.water,...h.sand].forEach(s=>{ if(s.t==='c') s.poly=chaikin(s.pts); });
  if(!h.len){ const f=h.fair.find(s=>s.t==='c'); let L=0,p=h.tee;
    if(f&&h.par>3){ f.pts.forEach(q=>{ L+=Math.hypot(q[0]-p[0],q[1]-p[1]); p=q; }); }
    L+=Math.hypot(h.cup[0]-p[0],h.cup[1]-p[1]); h.len=Math.round(L); }
}));
/* Terrain is a real heightfield (yards). Designed hills keep their spots; off-green mounds are
   built taller so they genuinely kick and steer the ball. Each hole also gets gentle rolling ground. */
function pathPoint(pts,t){ let L=0; const seg=[]; for(let i=0;i<pts.length-1;i++){ const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]); seg.push(l); L+=l; }
  let d=t*L; for(let i=0;i<seg.length;i++){ if(d<=seg[i]||i===seg.length-1){ const u=seg[i]?Math.min(1,d/seg[i]):0, a=pts[i],b=pts[i+1]; return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,(b[0]-a[0])/(seg[i]||1),(b[1]-a[1])/(seg[i]||1),L]; } d-=seg[i]; } return [pts[0][0],pts[0][1],0,-1,L]; }
COURSES.forEach((c,ci)=>c.holes.forEach((h,hi)=>{
  h.fringe=h.green.map(g=>({...g,rx:g.rx+1.6,ry:g.ry+1.6}));
  h.terr=h.hills.map(k=>{ const onG=inAny(h.green,k.x,k.y); return {x:k.x,y:k.y,rx:k.r,ry:k.r,rot:0,h:k.a*k.r/(2*G)*(onG||k.a<0?1:1.8)}; });
  const f=h.fair.find(s=>s.t==='c'), route=[h.tee,...(f&&h.par>3?f.pts:[]),h.cup], rnd=seeded(1000+ci*97+hi*13), L=pathPoint(route,0)[4], n=Math.max(2,Math.round(L/65));
  const g0=h.green[0];
  for(let i=0;i<n;i++){
    const [px,py,dx,dy]=pathPoint(route,(i+.5)/n+(rnd()-.5)*.08), off=(rnd()-.5)*70, rad=20+rnd()*22, x=px-dy*off, y=py+dx*off;
    if(Math.hypot(x-g0.x,y-g0.y)<rad+24||Math.hypot(x-h.tee[0],y-h.tee[1])<rad+10) continue;
    h.terr.push({x,y,rx:rad*(.8+rnd()*.5),ry:rad*(.8+rnd()*.5),rot:rnd()*Math.PI,h:(rnd()<.55?1:-1)*(1+rnd()*2.2)});
  }
}));
let HOLES=COURSE_MEADOW;
let COURSE_PAR=HOLES.reduce((a,h)=>a+h.par,0);

function inAny(list,x,y){ for(const s of list) if(inShape(s,x,y)) return true; return false; }
function surfaceAt(h,x,y){
  if(Math.abs(x-h.tee[0])<=5&&Math.abs(y-h.tee[1])<=3) return 'tee';
  if(inAny(h.ob,x,y)) return 'ob';
  if(inAny(h.sand,x,y)) return 'sand';
  if(inAny(h.green,x,y)) return 'green';
  if(inAny(h.fringe,x,y)) return 'fringe';
  if(inAny(h.water,x,y)) return 'water';
  if(inAny(h.fair,x,y)) return 'fairway';
  return 'rough';
}
function terrAt(h,x,y){ // returns [height, dz/dx, dz/dy]
  let z=0,gx=0,gy=0;
  for(const k of h.terr){ const dx=x-k.x,dy=y-k.y; const RR=Math.max(k.rx,k.ry)*3.2; if(Math.abs(dx)>RR||Math.abs(dy)>RR) continue;
    const c=Math.cos(k.rot),sn=Math.sin(k.rot),u=dx*c+dy*sn,v=-dx*sn+dy*c,q=u*u/(k.rx*k.rx)+v*v/(k.ry*k.ry); if(q>10) continue;
    const e=k.h*Math.exp(-q), du=-2*u/(k.rx*k.rx)*e, dv=-2*v/(k.ry*k.ry)*e;
    z+=e; gx+=du*c-dv*sn; gy+=du*sn+dv*c; }
  return [z,gx,gy];
}
const zgAt=(h,x,y)=>terrAt(h,x,y)[0];
// Rolling acceleration: gravity down the slope, plus the green's overall tilt.
function slopeAt(h,x,y,lie){
  const t=terrAt(h,x,y); let ax=-G*t[1], ay=-G*t[2];
  if(lie==='green'){ ax+=h.slope[0]; ay+=h.slope[1]; }
  return [ax,ay];
}
// Lie: how the ground tilts under the ball relative to the aim line.
function lieSlope(h,x,y,ang){ const t=terrAt(h,x,y), dx=Math.cos(ang), dy=Math.sin(ang); return {up:t[1]*dx+t[2]*dy, side:t[1]*(-dy)+t[2]*dx}; }
const slopeCarry=up=>Math.max(.8,Math.min(1.12,1-.9*up));
const slopeCurve=side=>Math.max(-.7,Math.min(.7,-side*2.5));
function lieName(L){ if(Math.abs(L.up)>=Math.abs(L.side)&&Math.abs(L.up)>.05) return L.up>0?'uphill lie':'downhill lie';
  if(Math.abs(L.side)>.05) return `sidehill lie, curves ${L.side>0?'left':'right'}`; return ''; }
