/* Ink Nine: Friends online (Claude storage or Supabase), ghost ball recording and replay, and the leaderboard. */
"use strict";
/* ============================================================
   FRIENDS — best rounds shared through the artifact's database.
   rounds/<id>             : { events: { <eventId>: {tot, tp, at} } }   (index, tiny)
   rounds/<id>/events/<ev> : { tot, tp, holes:[{s, tw, shots:[{p:[x,y,z,...], e}]}] }
   ============================================================ */
const NET={db:null,user:null,uid:null,sb:null,ready:null,err:'',save:'',load:''};
const IN_CLAUDE=!!(window.claude&&window.claude.use);
const ONLINE_OUTSIDE=!IN_CLAUDE&&!!(SUPABASE_URL&&SUPABASE_ANON_KEY);
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
NET.ready=(async()=>{ try{
  if(IN_CLAUDE){
    const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
    NET.db=db; NET.user=user; NET.uid=user?await user.id():null;
  } else if(ONLINE_OUTSIDE){
    const { createClient }=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
    let { data:{ session } }=await sb.auth.getSession();
    if(!session){ const r=await sb.auth.signInAnonymously(); session=r.data&&r.data.session;
      if(r.error){ NET.err=/anonymous/i.test(r.error.message||'')?'Anonymous sign-ins are turned off. Turn them on in Supabase, under Authentication.':'Could not sign in: '+(r.error.message||'unknown error'); } }
    if(session){
      const t=await sb.from('rounds').select('player_id',{head:true,count:'exact'}).limit(1);
      if(t.error){ NET.err=/does not exist|PGRST205|42P01|schema cache/i.test((t.error.message||'')+(t.error.code||''))?'The rounds table is missing. Run supabase-setup.sql in the Supabase SQL Editor.':'Database error: '+(t.error.message||t.error.code); }
      else { NET.sb=sb; NET.uid=session.user.id; }
    }
  }
}catch(e){ NET.err='Could not reach Supabase: '+(e&&e.message||e); console.warn('Online play unavailable',e); } })();
// never let a stalled network call leave the game "connecting" forever
NET.ready=Promise.race([NET.ready,new Promise(r=>setTimeout(()=>{ if(!NET.sb&&!NET.db&&!NET.err&&ONLINE_OUTSIDE) NET.err='Timed out reaching Supabase. Check your connection and reload.'; r(); },15000))]);
NET.ready.then(()=>syncName());
async function loadFriends(ev){
  if(ev&&ev.id==='tutorial'){ S.friends=[]; return; }
  S.friends=[]; await NET.ready;
  if(NET.sb){ try{
      const {data,error}=await NET.sb.from('rounds').select('player_id,name,tot,holes').eq('event',ev.id).eq('grp',meta.grp||'').neq('player_id',NET.uid).order('tot',{ascending:true}).limit(6);
      if(error) throw error;
      NET.load=`Found ${(data||[]).length} other player${(data||[]).length===1?'':'s'} in ${meta.grp?'group '+meta.grp:'the open group'} for this event.`;
      const out=(data||[]).filter(r=>Array.isArray(r.holes)&&r.holes.length).map(r=>({id:r.player_id,name:String(r.name||'Player').slice(0,16),tot:r.tot,holes:r.holes}));
      if(EV===ev){ S.friends=out; if(!$('card').hidden&&S.state==='card'&&document.querySelector('.board')) document.querySelector('.board').outerHTML=boardHTML(); }
    }catch(e){ S.friends=[]; NET.load='Could not load friends: '+(e.message||e.code||e); } return; }
  const db=NET.db; if(!db) return;
  try{
    const snap=await db.collection('rounds').get();
    const chosen={}; snap.docs.forEach(d=>{ const v=d.data(); if(v&&typeof v.name==='string') chosen[d.id]=v.name.slice(0,16); });
    const ids=snap.docs.filter(d=>d.id!==NET.uid&&d.data()?.events?.[ev.id]).map(d=>d.id).slice(0,6);
    const out=[];
    for(const id of ids){ const d=await db.doc(`rounds/${id}/events/${ev.id}`).get(); if(d.exists&&Array.isArray(d.data().holes)) out.push({id,holes:d.data().holes,tot:d.data().tot}); }
    let names={}; if(NET.user&&out.length){ try{ names=await NET.user.profiles(out.map(f=>f.id)); }catch(e){} }
    out.forEach(f=>{ f.name=chosen[f.id]||((names[f.id]&&names[f.id].name)||'Friend').split(' ')[0]||'Friend'; });
    if(EV===ev){ S.friends=out; if(!$('card').hidden&&S.state==='card'&&document.querySelector('.board')){ const b=document.querySelector('.board'); b.outerHTML=boardHTML(); } }
  }catch(e){ S.friends=[]; }
}
async function syncName(){
  await NET.ready;
  if(NET.sb&&NET.uid&&meta.name){ try{ await NET.sb.from('rounds').update({name:meta.name,grp:meta.grp||''}).eq('player_id',NET.uid); }catch(e){} return; }
  const db=NET.db, uid=NET.uid; if(!db||!uid||!meta.name) return;
  try{ const ref=db.doc(`rounds/${uid}`), cur=await ref.get(); await ref.set({...(cur.exists?cur.data():{events:{}}),name:meta.name}); }catch(e){}
}
async function loadMine(ev){
  S.myRemote=null; await NET.ready; if(!NET.sb||!NET.uid) return;
  try{ const {data}=await NET.sb.from('rounds').select('tot,grp,holes').eq('player_id',NET.uid).eq('event',ev.id).maybeSingle();
    if(data) S.myRemote={tot:data.tot,grp:data.grp||'',complete:Array.isArray(data.holes)&&data.holes.length>=9}; }catch(e){}
}
function netNote(){ const el=document.getElementById('netnote'); if(el) el.textContent=[NET.save,NET.load].filter(Boolean).join(' '); }
async function saveProgress(){
  if(EV&&EV.id==='tutorial') return;
  await NET.ready; if(!NET.sb||!NET.uid){ if(ONLINE_OUTSIDE){ NET.save='Not saved online: '+(NET.err||'not connected'); netNote(); } return; }
  const R=S.myRemote; if(R&&R.complete&&R.grp===(meta.grp||'')){ NET.save=`Your finished best round (${toParStr(R.tot-COURSE_PAR)}) is what friends see until you beat it.`; netNote(); return; }
  const n=S.scores.length, tot=S.scores.reduce((a,b)=>a+b,0), par=HOLES.slice(0,n).reduce((a,h)=>a+h.par,0);
  try{ const {error}=await NET.sb.from('rounds').upsert({player_id:NET.uid,event:EV.id,grp:meta.grp||'',name:meta.name||'',tot,tp:tot-par,holes:S.rec.slice(0,n).map(r=>({s:r.s,tw:r.tw,shots:r.shots})),updated_at:new Date().toISOString()},{onConflict:'player_id,event'});
    NET.save=error?`Online save failed: ${error.message||error.code}`:`Saved online through hole ${n}.`; }catch(e){ NET.save='Online save failed: '+(e.message||e); }
  netNote();
}
async function saveRound(){
  await NET.ready;
  const tot=S.scores.reduce((a,b)=>a+b,0), tp=tot-COURSE_PAR, holes=S.rec.map(r=>({s:r.s,tw:r.tw,shots:r.shots}));
  if(NET.sb&&NET.uid){ try{
      const {data:cur}=await NET.sb.from('rounds').select('tot,grp').eq('player_id',NET.uid).eq('event',EV.id).maybeSingle();
      const curDone=S.myRemote?S.myRemote.complete:!!cur;
      if(cur&&curDone&&cur.tot<=tot&&(cur.grp||'')===(meta.grp||'')) return false;
      const {error}=await NET.sb.from('rounds').upsert({player_id:NET.uid,event:EV.id,grp:meta.grp||'',name:meta.name||'',tot,tp,holes,updated_at:new Date().toISOString()},{onConflict:'player_id,event'});
      NET.save=error?`Online save failed: ${error.message||error.code}`:'Round saved online.'; if(!error) S.myRemote={tot,grp:meta.grp||'',complete:true};
      return !error;
    }catch(e){ return false; } }
  const db=NET.db, uid=NET.uid; if(!db||!uid) return false;
  try{
    const ref=db.doc(`rounds/${uid}`), cur=await ref.get(), idx=(cur.exists&&cur.data().events)||{};
    if(idx[EV.id]&&idx[EV.id].tot<=tot) return false;
    await db.doc(`rounds/${uid}/events/${EV.id}`).set({name:meta.name||'',tot,tp,holes:S.rec.map(r=>({s:r.s,tw:r.tw,shots:r.shots})),at:Date.now()});
    await ref.set({name:meta.name||'',events:{...idx,[EV.id]:{tot,tp,at:Date.now()}}});
    return true;
  }catch(e){ return false; }
}
// recording my shots on the current hole
const REC_EVERY=10; let recTick=0;
function recStart(){ const r=S.rec[S.hole]; if(!r) return; const b=S.ball; r.shots.push({p:[+b.x.toFixed(1),+b.y.toFixed(1),0],e:''}); recTick=0; }
function recPoint(force){ const r=S.rec[S.hole]; if(!r||!r.shots.length) return; if(!force&&(++recTick%REC_EVERY)) return;
  const b=S.ball, sh=r.shots[r.shots.length-1]; if(sh.p.length>600) return; sh.p.push(+b.x.toFixed(1),+b.y.toFixed(1),+Math.max(0,b.z-zgAt(H(),b.x,b.y)).toFixed(1)); }
function recEnd(kind){ const r=S.rec[S.hole]; if(!r||!r.shots.length) return; const sh=r.shots[r.shots.length-1]; if(sh.e) return; recPoint(true); sh.e=kind; }
/* ---------- ghost replay ---------- */
const GHOST_SPEED=2.2; // sim-seconds of their shot per real second
function startGhosts(){
  const n=(S.rec[S.hole]?.shots.length)||0; S.ghosts=[];
  (S.friends||[]).forEach(f=>{ const hole=f.holes[S.hole]; if(!hole) return;
    if(n-1<hole.shots.length){ const sh=hole.shots[n-1]; S.ghosts.push({f,path:sh.p,e:sh.e,t:0,holed:sh.e==='in',s:hole.s,shot:n}); }
    else S.ghosts.push({f,path:[H().cup[0],H().cup[1],0],e:'in',t:1e9,holed:true,s:hole.s,shot:n,done:true}); });
  if(!S.ghosts.length) return false;
  let x0=S.ball.x,x1=x0,y0=S.ball.y,y1=y0; S.ghosts.forEach(g=>{ for(let i=0;i<g.path.length;i+=3){ x0=Math.min(x0,g.path[i]); x1=Math.max(x1,g.path[i]); y0=Math.min(y0,g.path[i+1]); y1=Math.max(y1,g.path[i+1]); } });
  const uh=Hh-view.top-view.bot; camT={x:(x0+x1)/2,y:(y0+y1)/2,z:Math.max(1.1,Math.min(18,Math.min((W-80)/(x1-x0+10),(uh-90)/(y1-y0+10))))};
  S.state='ghost'; S.timer=0; tone(420,.2,'sine',.06,640); return true;
}
function ghostPos(g){ const pts=g.path.length/3, idx=Math.min(pts-1,g.t*GHOST_SPEED*TS/(REC_EVERY*DT)), i=Math.floor(idx), u=idx-i, j=Math.min(pts-1,i+1);
  return [g.path[i*3]+(g.path[j*3]-g.path[i*3])*u,g.path[i*3+1]+(g.path[j*3+1]-g.path[i*3+1])*u,g.path[i*3+2]+(g.path[j*3+2]-g.path[i*3+2])*u,idx>=pts-1]; }
function updateGhosts(dt){
  let all=true; (S.ghosts||[]).forEach(g=>{ if(g.done) return; g.t+=dt; const p=ghostPos(g); if(p[3]){ g.done=true; if(g.holed) tone(880,.15,'sine',.06); } else all=false; });
  return all;
}
function drawGhosts(){
  const G_=S.ghosts; if(!G_||!G_.length) return; const h=H();
  ctx.save();
  G_.forEach((g,k)=>{ const [x,y,z]=ghostPos(g), idx=Math.min(g.path.length/3-1,g.t*GHOST_SPEED*TS/(REC_EVERY*DT));
    ctx.globalAlpha=.45; ctx.fillStyle='#000';
    for(let i=0;i<=idx;i+=2){ const [px,py]=WS(g.path[i*3],g.path[i*3+1],g.path[i*3+2]); ctx.beginPath(); ctx.arc(px,py,1,0,TAU); ctx.fill(); }
    const [gx,gy]=WS(x,y), [sx,sy]=WS(x,y,z), hidden=g.holed&&g.done;
    if(!hidden){ ctx.globalAlpha=.25; ctx.beginPath(); ctx.ellipse(gx+1,gy+1.5,5,2.8,0,0,TAU); ctx.fill();
      ctx.globalAlpha=.85; ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=1.6; ctx.setLineDash([2.5,2]); ctx.beginPath(); ctx.arc(sx,sy,4.6,0,TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
    const tag=g.holed&&g.done?`${g.f.name}, in for ${g.s}`:g.e==='pen'&&g.done?`${g.f.name}, splash`:g.f.name;
    const ax=hidden?WS(h.cup[0],h.cup[1])[0]:sx, ay=(hidden?WS(h.cup[0],h.cup[1])[1]-40:sy-16)-k*2;
    ctx.globalAlpha=g.done&&S.state!=='ghost'?.7:1; ctx.font='800 11.5px Figtree, system-ui, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const w=ctx.measureText(tag).width+14; ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect?ctx.roundRect(ax-w/2,ay-9,w,18,9):ctx.rect(ax-w/2,ay-9,w,18); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax-3,ay+9); ctx.lineTo(ax,ay+13); ctx.lineTo(ax+3,ay+9); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#000'; ctx.fillText(tag,ax,ay+.5); });
  ctx.restore();
}
function standings(){
  const played=S.scores.length+(S.banked&&S.scores.length<=S.hole?1:0), parTo=k=>HOLES.slice(0,k).reduce((a,h)=>a+h.par,0);
  const me=S.scores.reduce((a,b)=>a+b,0)-parTo(S.scores.length);
  const k=S.field.length?S.field[0].scores.filter(x=>x!=null).length:0;
  const rows=[{id:'you',name:meta.name?`${meta.name} (you)`:'You',tp:me,you:true},...S.field.map(r=>{ const n=r.scores.filter(x=>x!=null).length; return {id:r.id,name:r.name,bio:r.bio,tp:r.scores.reduce((a,b)=>a+(b||0),0)-parTo(n)}; }),
    ...(S.friends||[]).map(f=>{ const m=Math.min(k,f.holes.length); return {id:'f_'+f.id,name:f.name,bio:f.holes.length<9?`friend, mid-round, thru ${f.holes.length}`:`friend, best round ${toParStr(f.tot-COURSE_PAR)}`,friend:true,tp:f.holes.slice(0,m).reduce((a,h)=>a+(h.s||0),0)-parTo(m)}; })];
  return rows.sort((a,b)=>a.tp-b.tp||(a.you?-1:b.you?1:0));
}
function placeOf(rows){ const me=rows.find(r=>r.you); return rows.filter(r=>r.tp<me.tp).length+1; }
function ordinal(n){ return n===1?'1st':n===2?'2nd':n===3?'3rd':n+'th'; }
function boardHTML(){
  const rows=standings(), prev=S.prevPos||[];
  return `<div class="board">${rows.map((r,i)=>{ const pi=prev.indexOf(r.id), mv=pi>i&&pi>=0?'<i class="up">▲</i>':pi>=0&&pi<i?'<i class="dn">▼</i>':'<i></i>';
    const pos=rows.filter(x=>x.tp<r.tp).length+1;
    return `<div class="row${r.you?' me':''}${r.friend?' fr':''}" style="animation-delay:${.05+i*.06}s"><span class="pos">${pos}</span><span class="nm">${esc(r.name)}${r.bio&&!r.you?`<small>${esc(r.bio)}</small>`:''}</span>${mv}<b>${toParStr(r.tp)}</b></div>`; }).join('')}</div>`;
}
