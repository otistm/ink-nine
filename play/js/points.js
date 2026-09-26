/* Ink Nine: Points: shot bonuses, streaks and hole multipliers. */
"use strict";
/* ============================================================
   POINTS — shot points build a streak multiplier; the hole score multiplies the hole
   ============================================================ */
const streakMult=()=>1+MOD.streakStep*Math.min(S.streak,8);
const fmtMult=m=>String(+m.toFixed(2));
function holeMult(score,par){ const d=score-par; return score===1?5:d<=-3?4:d===-2?3:d===-1?2:d===0?1.5:d===1?1:.5; }
function label(x,y,text,delay,big,off){ parts.push({k:'label',x,y,text,t:-delay,life:1.7,big,off:off||0}); }
function blips(n){ for(let i=0;i<n;i++) setTimeout(()=>tone(620+i*140,.08,'triangle',.1),i*220); }
function lostStreak(){ const b=S.ball; label(b.x,b.y,'Streak lost',.1,false); tone(300,.2,'triangle',.1,160); }
function updPts(){
  const el=$('streak'); el.textContent=S.streak>0?`Streak ×${fmtMult(streakMult())}`:'No streak'; el.classList.toggle('hot',S.streak>0);
  const pv=$('pv'); pv.classList.remove('bump'); void pv.offsetWidth; pv.classList.add('bump');
}
function awardShot(result){
  const sh=S.shot; if(!sh||sh.done) return; sh.done=true;
  const b=S.ball,h=H(),lie=lieNow(),items=[],good=lie==='fairway'||lie==='green';
  if(result==='sunk'){
    if(S.strokes===1) items.push(['Hole in one',2000]);
    else if(sh.isPutt){ const ft=Math.max(1,Math.round(sh.dist0*3)); items.push([`Drained ${ft} ft`,Math.max(50,ft*10)]); }
    else items.push(sh.lie==='sand'?['Holed from the sand',800]:['Chip-in',600]);
    S.streak++;
  } else if(sh.isPutt){
    if(sh.dist0*3>=25&&distToCup()*3<=3) items.push(['Lag putt',60]);
  } else {
    if(sh.lie==='tee'&&sh.carry>0) items.push(['Drive',Math.round(sh.carry)]);
    if(sh.quality==='pure') items.push(['Pure strike',50]);
    if(lie==='fairway') items.push(['Fairway',MOD.fairway]);
    if(lie==='green'){ items.push(['Green',100]); const ft=distToCup()*3; if(ft<30) items.push([`Stuck it, ${Math.max(1,Math.round(ft))} ft`,Math.round((30-ft)*10)]); }
    if(sh.lie==='sand'&&lie==='green') items.push(['Sand save',100]);
    if(sh.treeHit&&good) items.push(['Lucky bounce',150]);
    if(Math.abs(sh.curve)>=.35&&good) items.push([sh.curve>0?'Fade':'Draw',60+MOD.bendPts]);
    if(sh.strike>=.4&&sh.windMph>=10&&good) items.push(['Knockdown',80]);
    if(sh.strike<=-.4&&sh.land&&sh.land.lie==='green'&&lie==='green') items.push(['Flop',80]);
    if(sh.spunBack&&sh.land&&distToCup()<sh.land.d-.5) items.push(['Spin back',120]);
    if(good) S.streak++; else { if(S.streak>0) lostStreak(); S.streak=0; }
  }
  const px=result==='sunk'?h.cup[0]:b.x, py=result==='sunk'?h.cup[1]:b.y;
  items.forEach((it,i)=>label(px,py,`+${it[1]} ${it[0]}`,i*.22,false,i*20));
  const base=items.reduce((a,i)=>a+i[1],0), m=streakMult(), gain=Math.round(base*m*MOD.pts);
  if(gain>0){ S.holePts+=gain; blips(items.length); if(m>1) label(px,py,`${gain} with streak ×${fmtMult(m)}`,items.length*.22+.15,true,items.length*20+6); }
  updPts();
}
function bankHole(score){
  if(S.banked) return; S.banked=true;
  const h=H(), m=holeMult(score,h.par)+(score<h.par?MOD.birdie:0), tw=S.twist.mult, name=score===10&&S.strokes>=10?'Picked up':scoreName(score-h.par,score), total=Math.round(S.holePts*m*tw);
  S.holeLog[S.hole]={shots:S.holePts,mult:m,tw,twName:S.twist.name,name,total};
  S.prevPos=standings().map(r=>r.id); S.field.forEach(r=>{ r.scores[S.hole]=rivalHole(r,h.par,EV.tier); });
  S.points+=total; S.holePts=0; S.earned=(S.earned||0)+total; meta.wallet+=total; saveMeta();
  saveRun('holed');
  label(h.cup[0],h.cup[1],`${name} ×${fmtMult(m)}`,0,true,30); if(tw>1) label(h.cup[0],h.cup[1],`${S.twist.name} ×${fmtMult(tw)}`,.35,true,64); if(m>1) blips(3);
  updPts();
}
function finishHole(score){ if(S.rec[S.hole]) S.rec[S.hole].s=score; bankHole(score); S.scores[S.hole]=score; if(S.scores.length<9) saveProgress(); S.state='card'; setTimeout(showCard,score===10?1500:0); }
