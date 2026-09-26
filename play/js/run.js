/* Ink Nine: Run rules: upgrades, curses, twists, invitationals, rivals, the pro shop data, saved meta, and the game state object S. */
"use strict";
/* ============================================================
   RUN — ball upgrades, club bag, hole twists
   ============================================================ */
const UPGRADES=[
 {id:'feather',name:'Featherweight',desc:'Every club carries 10% farther.'},
 {id:'laser',  name:'True Line',    desc:'Shots fly 60% straighter.'},
 {id:'spin',   name:'Backspin',     desc:'Your strike dial reaches 40% further: higher flops, more spin-back, lower knockdowns.'},
 {id:'magnet', name:'Magnet',       desc:'The cup pulls in slow balls within 6 feet.'},
 {id:'bigcup', name:'Wide Cup',     desc:'The cup catches faster, off-center putts.'},
 {id:'chalk',  name:'Chalk Line',   desc:'Fairway finishes pay 150 instead of 50.'},
 {id:'gold',   name:'Gilded',       desc:'All shot points +30%.'},
 {id:'hot',    name:'Hot Hand',     desc:'Your streak builds twice as fast.'},
 {id:'birdie', name:'Birdie Hunter',desc:'Under-par hole multipliers get +1.'},
 {id:'clover', name:'Four-Leaf',    desc:'Your first penalty on each hole is free.'},
 {id:'sand',   name:'Sand Surfer',  desc:'No distance lost from bunkers.'},
 {id:'rough',  name:'Rough Rider',  desc:'No distance lost from the rough.'},
 {id:'anchor', name:'Anchor',       desc:'Wind has half the effect on your ball.'},
 {id:'metro',  name:'Metronome',    desc:'The pure-strike window is twice as wide.'},
 {id:'bender', name:'Bender',       desc:'Curved shots bend 60% more and pay +75.'}
];
const CLUB_DESC={'3W':'Low and long, even off the fairway.','5I':'A long iron for long approaches.','9I':'High and soft into greens.','PW':'Short approaches with bite.','SW':'Splashes out of bunkers and flops over trouble.'};
const TWISTS=[
 {id:'gale',  name:'Gale',        desc:'Wind blows 15 to 25 mph.',mult:1.5},
 {id:'fast',  name:'Glass greens',desc:'Greens run almost twice as fast.',mult:1.4},
 {id:'fog',   name:'Fog',         desc:'You can only see about 80 yards. No telescope.',mult:1.6},
 {id:'short', name:'Short bag',   desc:'Only three of your clubs, plus the putter.',mult:1.5},
 {id:'heavy', name:'Thick rough', desc:'The rough grabs the ball and costs more distance.',mult:1.3},
 {id:'tiny',  name:'Thimble cup', desc:'The cup is 40% smaller.',mult:1.5},
 {id:'bouncy',name:'Hardpan',     desc:'Baked ground. Everything bounces and runs.',mult:1.3}
];
TWISTS.forEach(t=>t.ids=[t.id]);
const STRAIGHT={id:'none',ids:[],name:'Play it straight',desc:'No twist, no bonus.',mult:1};
const CURSES=[
 {id:'lead', name:'Lead Ball', desc:'−8% carry on every club, but all points +40%.'},
 {id:'wild', name:'Wild Streak',desc:'Shots fly 40% wider, but your streak builds faster.'},
 {id:'glass',name:'Glass Jaw', desc:'Penalties cost two strokes, but under-par multipliers get +1.'}
];
const EVENTS=[
 {id:'meadow', name:'The Meadow Invitational',course:0,tier:0,blurb:'A friendly field on a parkland course. Twists are optional.',forced:()=>false,double:()=>false,rewards:3,curses:0,wind:[0,12]},
 {id:'coastal',name:'The Coastal Classic',   course:1,tier:1,blurb:'Seaside links where the wind never drops. Every other hole forces a twist, and rewards can carry curses.',forced:i=>i%2===1,double:()=>false,rewards:3,curses:.45,wind:[5,16]},
 {id:'crown',  name:'The Iron Crown',        course:2,tier:2,blurb:'A championship test in the woods. Every hole is twisted, every third one twice, and you get only two reward cards.',forced:()=>true,double:i=>i%3===2,rewards:2,curses:.5,wind:[4,14]}
];
const RIVALS=[
 {id:'dot',name:'Dot Birdwhistle',bio:'never misses a fairway',mean:.05,sd:.45},
 {id:'rex',name:'Rex Longo',bio:'bombs it, sometimes into the sea',mean:-.05,sd:1.0},
 {id:'pip',name:'Pip Hollis',bio:'magic around the greens',mean:0,sd:.7,p3:-.25},
 {id:'mae',name:'Mae Sandoval',bio:'quietly brilliant',mean:-.1,sd:.6}
];
const TIER_OFF=[.2,0,-.15];
function rivalHole(r,par,tier){
  let d=Math.round(r.mean+TIER_OFF[tier]+(par===3&&r.p3?r.p3:0)+gauss()*r.sd);
  d=Math.max(par===3?-1:-2,Math.min(3,d)); if(par===3&&Math.random()<.004) d=-2; return par+d;
}
const MEDALS=['Gold','Silver','Bronze'];
function loadJSON(k,d){ try{ return JSON.parse(localStorage.getItem(k)||'null')??d; }catch(e){ return d; } }
function saveJSON(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
const START_BAG=[0,3,7];
const META_KEY='inknine-meta';
/* Player progress (wallet, unlocked clubs, upgrades, name, tutorial) lives in localStorage under META_KEY.
   RULES FOR CHANGES: never rename or remove a field; add new fields with a default in migrateMeta;
   if a field's meaning changes, bump META_SCHEMA and convert old data inside migrateMeta. */
const META_SCHEMA=1;
function migrateMeta(m){
  const out=Object.assign({sv:META_SCHEMA,wallet:0,unlocked:START_BAG.slice(),lv:{},name:'',grp:'',tutDone:false},m);
  if(!Array.isArray(out.unlocked)) out.unlocked=START_BAG.slice();
  START_BAG.forEach(i=>{ if(!out.unlocked.includes(i)) out.unlocked.push(i); });
  if(typeof out.wallet!=='number'||!isFinite(out.wallet)) out.wallet=0;
  if(!out.lv||typeof out.lv!=='object') out.lv={};
  // example for the future: if(out.sv<2){ ...convert...; out.sv=2; }
  out.sv=META_SCHEMA; return out;
}
function loadMeta(){
  let raw=null, m={}; try{ raw=localStorage.getItem(META_KEY); }catch(e){}
  if(raw){ try{ m=JSON.parse(raw)||{}; }catch(e){ try{ localStorage.setItem(META_KEY+'-unreadable',raw); }catch(_){} m={}; } }
  const out=migrateMeta(m);
  if(raw&&m.lastVersion!==VERSION){ try{ localStorage.setItem(META_KEY+'-backup',raw); }catch(e){} }   // one safety copy per update
  out.lastVersion=VERSION; return out;
}
const meta=loadMeta();
function saveMeta(){ try{ localStorage.setItem(META_KEY,JSON.stringify(meta)); }catch(e){} }
const LEVEL_NAMES=['Stock','Tuned','Forged','Tour','Pro','Legend'], LEVEL_COST=[1000,2500,5000,9000,15000];
// what each level adds, by club family
const TUNE={DR:{carry:.04,acc:.08,spin:0},'3W':{carry:.04,acc:.08,spin:0},'5I':{carry:.03,acc:.1,spin:.05},'7I':{carry:.03,acc:.1,spin:.05},'9I':{carry:.03,acc:.1,spin:.05},
  PW:{carry:.02,acc:.1,spin:.1},SW:{carry:.02,acc:.1,spin:.1},PT:{roll:3,cap:.25}};
const CLUB_PERK={DR:'More carry, straighter drives.','3W':'More carry, straighter fairway woods.','5I':'Carry, accuracy and a touch more spin.','7I':'Carry, accuracy and a touch more spin.','9I':'Carry, accuracy and a touch more spin.',
  PW:'Accuracy and much more spin-back.',SW:'Accuracy and much more spin-back.',PT:'Longer roll range and a friendlier cup.'};
const lvOf=c=>meta.lv[c.id]||0;
function CS(c){ const lv=lvOf(c), T=TUNE[c.id];
  if(c.putter) return {carry:c.carry+T.roll*lv,disp:0,spin:1,capV:T.cap*lv,lv};
  return {carry:c.carry*(1+T.carry*lv),disp:c.disp*(1-T.acc*lv),spin:1+T.spin*lv,capV:0,lv}; }
let EV=null;
let MOD={};
function computeMod(){
  const u=S.upg,T=new Set(S.twist.ids);
  MOD={carry:(u.feather?1.1:1)*(u.lead?.92:1),disp:(u.laser?.4:1)*(u.wild?1.4:1),spinRange:u.spin?1.4:1,magnet:!!u.magnet,cupR:(u.bigcup?1.6:1)*(T.has('tiny')?.6:1),cupV:u.bigcup?1.4:0,
    fairway:u.chalk?150:50,pts:(u.gold?1.3:1)*(u.lead?1.4:1),streakStep:(u.hot?.5:.25)+(u.wild?.25:0),birdie:(u.birdie?1:0)+(u.glass?1:0),penalty:u.glass?2:1,clover:!!u.clover,sandLie:!!u.sand,roughLie:!!u.rough,
    wind:u.anchor?.5:1,perfect:u.metro?2:1,bend:u.bender?1.6:1,bendPts:u.bender?75:0,greenRoll:T.has('fast')?.55:1,heavy:T.has('heavy'),bouncy:T.has('bouncy'),fog:T.has('fog')};
  if(typeof refreshChips==='function') refreshChips();
}
const shuffle=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const owned=i=>S.bag.includes(i);
const usable=i=>owned(i)&&(!S.allowed||S.allowed.includes(i));

/* ============================================================
   GAME STATE
   ============================================================ */
const S={rec:[],friends:[],ghosts:[],upg:{},bag:START_BAG.slice(),twist:STRAIGHT,allowed:null,cloverUsed:false,slow:1,slowOn:false,hitStop:0,hole:0,scores:[],strokes:0,club:0,points:0,holePts:0,streak:0,banked:false,holeLog:[],shot:null,disp:0,state:'intro',t:0,
  ball:{x:0,y:0,z:0,vx:0,vy:0,vz:0,spin:0,mode:'rest',trail:[],bounces:0,check:0,inTree:-1},
  last:{x:0,y:0},wind:{x:0,y:0,mph:0},restT:0,timer:0,sq:0,sqv:0,fp:0,fpv:0,sinkT:0,shake:0,firstShot:true,intro:null};
S.state='card';
const H=()=>HOLES[S.hole];
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const parts=[];
