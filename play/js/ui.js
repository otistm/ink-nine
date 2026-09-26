/* Ink Nine: HUD, club chips, callouts, scorecard helpers and reward cards. */
"use strict";
/* ============================================================
   UI
   ============================================================ */
const $=id=>document.getElementById(id);
const clubsEl=$('clubs');
CLUBS.forEach((c,i)=>{ const b=document.createElement('button'); b.className='club'; b.innerHTML=`${c.id}<small>${CS(c).carry}</small>`;
  b.setAttribute('aria-label',`${c.name}, ${CS(c).carry} yards`);
  b.addEventListener('click',()=>{ if(S.state!=='aim') return; audioInit();
    if(!usable(i)){ b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); tone(160,.12,'triangle',.1); return; }
    setClub(i,true); sfx('tick'); }); clubsEl.appendChild(b); });
function refreshChips(){
  CLUBS.forEach((c,i)=>{ const b=clubsEl.children[i], own=owned(i), ok=usable(i), carry=c.putter?CS(c).carry:Math.round(CS(c).carry*MOD.carry);
    b.classList.toggle('lock',!own); b.classList.toggle('off',own&&!ok); b.classList.toggle('on',i===S.club);
    b.innerHTML=`${c.id}<small>${own?carry:'locked'}</small>`;
    b.setAttribute('aria-label',own?`${c.name}, ${carry} yards${ok?'':', not allowed this hole'}`:`${c.name}, not in your bag`); });
}
function setClub(i,user){
  if(look.on) exitLook();
  S.club=i; [...clubsEl.children].forEach((b,j)=>{ b.classList.toggle('on',j===i); b.classList.remove('pop'); });
  refreshChips();
  const el=clubsEl.children[i]; void el.offsetWidth; el.classList.add('pop');
  frameAim(); updHUD(); saveRun('aim');
}
function lieNow(){ const b=S.ball; return surfaceAt(H(),b.x,b.y); }
function distToCup(){ const b=S.ball,h=H(); return Math.hypot(h.cup[0]-b.x,h.cup[1]-b.y); }
function updHUD(){
  $('scope').disabled=S.state!=='aim'||MOD.fog;
  { const off=S.state!=='aim'||CLUBS[S.club].putter; $('strike').disabled=off; if(off&&!$('dial').hidden) openDial(false); }
  const h=H(); $('hn').innerHTML=`Hole ${S.hole+1}`+(S.twist.ids.length?` <span class="tw">${S.twist.name} ×${S.twist.mult}</span>`:'');
  $('hsub').textContent=`${h.name}, par ${h.par}`;
  const d=distToCup(), lie=lieNow();
  $('dist').innerHTML=`Stroke <b>${Math.max(1,S.strokes+(S.state==='aim'?1:0))}</b>, `+(lie==='green'? `${Math.max(1,Math.round(d*3))} ft to the pin` : `${Math.round(d)} yds to the pin`);
  $('wmph').textContent=`${S.wind.mph} mph`;
  $('warrow').style.transform=`rotate(${Math.atan2(S.wind.y,S.wind.x)*180/Math.PI+90}deg)`;
  const c=CLUBS[S.club], lf=c.putter?1:lieFactor(c,lie);
  $('shot').innerHTML= S.state==='aim'||S.state==='intro' ? `${c.name} from ${SURF[lie].name} <span>${c.putter?`up to ${Math.round(CS(c).carry)} yds of roll`:Math.round(CS(c).carry*lf*MOD.carry)+' yds carry'+(S.strike?`, ${strikeName(S.strike).toLowerCase()}`:'')}${(()=>{ const n=c.putter?'':lieName(lieSlope(h,S.ball.x,S.ball.y,aimAngle())); return n?`<span>, ${n}</span>`:''; })()}</span>` : '';
}
function callout(big,small){ const el=$('callout'); el.innerHTML=`<b>${big}</b>${small?`<span>${small}</span>`:''}`; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
function scoreName(diff,strokes){
  if(strokes===1) return 'Hole in one';
  return ({'-3':'Albatross','-2':'Eagle','-1':'Birdie','0':'Par','1':'Bogey','2':'Double bogey','3':'Triple bogey'})[diff] || (diff<0?`${-diff} under`:`${diff} over`);
}
function mark(s,p){ const d=s-p; const cls=d<=-2?'b2':d===-1?'b1':d===1?'o1':d>=2?'o2':''; return `<span class="m ${cls}">${s}</span>`; }
function toPar(n){ return n===0?'even par':n>0?`${n} over par`:`${-n} under par`; }
function fmtK(n){ return n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'k':String(n); }
function breakdown(L){ return `<div class="brk"><span>${L.shots.toLocaleString()} shot points</span><span>× ${fmtMult(L.mult)} for ${L.name.toLowerCase()}</span>${L.tw>1?`<span>× ${fmtMult(L.tw)} for ${L.twName.toLowerCase()}</span>`:''}<b>+${L.total.toLocaleString()}</b></div>`; }
function kitLine(){ const ups=UPGRADES.filter(u=>S.upg[u.id]).map(u=>u.name), cs=CURSES.filter(c=>S.upg[c.id]).map(c=>c.name); return `<p class="kit"><b>Bag:</b> ${S.bag.slice().sort((a,b)=>a-b).map(i=>CLUBS[i].id).join(', ')}${ups.length?`<br><b>Ball:</b> ${ups.join(', ')}`:''}${cs.length?`<br><b>Curses:</b> ${cs.join(', ')}`:''}</p>`; }
function rewardOffer(n){
  const clubs=shuffle([1,2,4,5,6].filter(i=>!owned(i))), ups=shuffle(UPGRADES.filter(u=>!S.upg[u.id])), out=[];
  const clubCard=i=>({kind:'club',i,name:CLUBS[i].name+(lvOf(CLUBS[i])?` (${LEVEL_NAMES[lvOf(CLUBS[i])]})`:''),desc:`${Math.round(CS(CLUBS[i]).carry*MOD.carry)} yds carry. ${CLUB_DESC[CLUBS[i].id]}`+(meta.unlocked.includes(i)?'':' Unlocks it in the pro shop.')});
  if(clubs.length) out.push(clubCard(clubs.shift()));
  while(out.length<n&&ups.length){ const u=ups.shift(); out.push({kind:'upg',id:u.id,name:u.name,desc:u.desc}); }
  while(out.length<n&&clubs.length) out.push(clubCard(clubs.shift()));
  const cs=shuffle(CURSES.filter(c=>!S.upg[c.id]));
  if(cs.length&&Math.random()<EV.curses){ const c=cs[0], k=out.findIndex(o=>o.kind==='upg'); const card={kind:'curse',id:c.id,name:c.name,desc:c.desc}; if(k>=0) out[k]=card; else out.push(card); }
  return shuffle(out.slice(0,n));
}
function wirePicks(onPick){ [...$('panel').querySelectorAll('.pick')].forEach(b=>b.addEventListener('click',()=>{ audioInit(); onPick(+b.dataset.k,b); })); }
function pickHTML(o,k){ return `<button class="pick${o.kind==='curse'?' curse':''}" data-k="${k}" style="animation-delay:${.12+k*.09}s"><i>${o.tag}</i><b>${o.name}</b><span>${o.desc}</span>${o.mult!=null?`<em>×${o.mult}</em>`:''}</button>`; }
/* ---------- leaderboard ---------- */
const toParStr=n=>n===0?'E':n>0?`+${n}`:String(n);
