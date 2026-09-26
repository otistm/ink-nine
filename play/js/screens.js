/* Ink Nine: Trophies, name screen, clubhouse, pro shop, feedback and starting an invitational. */
"use strict";
/* ---------- trophies ---------- */
function trophySVG(medal,size=46){
  const fill=medal==='Gold'?'#000':medal==='Silver'?'url(#tHatch)':'#fff', dash=medal?'':' stroke-dasharray="3 3" opacity=".35"';
  return `<svg class="troph" width="${size}" height="${size*1.1}" viewBox="0 0 40 44" aria-hidden="true"><defs><pattern id="tHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="4" stroke="#000" stroke-width="1.6"/></pattern></defs>
  <g stroke="#000" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"${dash}>
  <path d="M10 7H5c0 6 3 9 6.5 9.5M30 7h5c0 6-3 9-6.5 9.5" fill="none"/>
  <path d="M10 4h20v9c0 7-4.5 11-10 11S10 20 10 13z" fill="${fill}"/>
  <path d="M17 24h6v6h-6z" fill="#fff"/><path d="M11 31h18v6H11z" fill="${medal==='Gold'?'#000':'#fff'}"/>
  ${medal==='Gold'?'<path d="M20 8.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff" stroke="none"/>':''}</g></svg>`;
}
function shopBagSVG(){ return `<svg width="34" height="40" viewBox="0 0 34 40" aria-hidden="true"><g stroke="#000" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="#fff">
  <path d="M9 10 L7 2 M15 10 L16 1 M21 10 L25 3"/><circle cx="7" cy="2.5" r="2" fill="#000"/><rect x="14" y="0" width="5" height="3" rx="1" fill="#000"/><path d="M24 2 l3 2" />
  <path d="M6 10h22l-2 27H8z"/><path d="M8 17h18M9 30h16" fill="none"/></g></svg>`; }
function pips(lv){ return `<span class="pips">${[0,1,2,3,4].map(i=>`<i class="${i<lv?'on':''}"></i>`).join('')}</span>`; }
function statsAt(c,lv){ const T=TUNE[c.id]; return c.putter?{carry:c.carry+T.roll*lv,acc:0,spin:0,cap:lv}:{carry:c.carry*(1+T.carry*lv),acc:Math.round(T.acc*lv*100),spin:Math.round(T.spin*lv*100)}; }
function statText(c,lv){ const a=statsAt(c,lv); if(c.putter) return `${Math.round(a.carry)} yds of roll${lv?', friendlier cup':''}`;
  return `${Math.round(a.carry)} yds carry`+(a.acc?`, ${a.acc}% straighter`:'')+(a.spin?`, +${a.spin}% spin`:''); }
function statLine(c,lv){ return statText(c,lv)+(lv<5?`<br><span class="nxt">Next: ${statText(c,lv+1)}</span>`:''); }
function showShop(flash){
  S.state='home';
  const rows=CLUBS.map((c,i)=>{ const un=meta.unlocked.includes(i), lv=lvOf(c), max=lv>=5, cost=LEVEL_COST[lv], can=un&&!max&&meta.wallet>=cost;
    return `<div class="srow${un?'':' locked'}${flash===i?' flash':''}" style="animation-delay:${.05+i*.04}s">
      <div class="sid">${c.id}</div>
      <div class="sinfo"><b>${c.name}</b>${un?`<span class="slv">${LEVEL_NAMES[lv]} ${pips(lv)}</span><small>${statLine(c,lv)}</small>`:`<small>Win it from a reward card during an invitational to unlock.</small>`}</div>
      ${un?(max?`<span class="smax">Maxed</span>`:`<button class="sbuy" data-i="${i}" ${can?'':'aria-disabled="true"'}><small>${LEVEL_NAMES[lv+1]}</small>${cost.toLocaleString()}</button>`):`<span class="slock">Locked</span>`}
    </div>`; }).join('');
  $('panel').innerHTML=`<h2>Pro shop</h2><p>Spend points from your rounds to upgrade the clubs you've unlocked. Upgrades carry into every invitational.</p>
    <div class="wallet"><small>Points to spend</small><b id="wv">${meta.wallet.toLocaleString()}</b></div>
    <div class="shop">${rows}</div><p class="perk" id="perk">Tap a price to upgrade.</p><button class="btn" id="back">Back to the clubhouse</button>`;
  $('card').hidden=false; $('card').classList.add('home'); if(flash==null) $('card').scrollTop=0;
  $('back').addEventListener('click',()=>{ sfx('tick'); showHome(); });
  [...$('panel').querySelectorAll('.srow:not(.locked)')].forEach(r=>{ const i=CLUBS.findIndex(c=>c.id===r.querySelector('.sid').textContent); r.addEventListener('pointerenter',()=>{ $('perk').textContent=`${CLUBS[i].name}: ${CLUB_PERK[CLUBS[i].id]}`; }); });
  [...$('panel').querySelectorAll('.sbuy')].forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); audioInit(); const i=+b.dataset.i, c=CLUBS[i], lv=lvOf(c), cost=LEVEL_COST[lv];
    if(meta.wallet<cost){ b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); tone(160,.12,'triangle',.1); $('perk').textContent=`You need ${(cost-meta.wallet).toLocaleString()} more points for that.`; return; }
    meta.wallet-=cost; meta.lv[c.id]=lv+1; saveMeta(); blips(4); setTimeout(()=>tone(880,.25,'triangle',.12),260);
    const y=$('card').scrollTop; showShop(i); $('card').scrollTop=y; $('perk').textContent=`${c.name} is now ${LEVEL_NAMES[lv+1]}. ${CLUB_PERK[c.id]}`; refreshChips(); }));
}
function showName(editing){
  S.state='home';
  $('panel').innerHTML=`<h2 class="logo">Ink Nine</h2><p>${editing?'Change the name friends see on the leaderboard and over your ghost ball.':'What should we call you? Friends will see this name on the leaderboard and over your ghost ball.'}</p>
    <form id="nameForm" class="nameform" autocomplete="off"><label for="nameIn">Your name</label>
    <input id="nameIn" maxlength="16" placeholder="Your name" value="${esc(meta.name||'')}" autocapitalize="words" spellcheck="false" enterkeyhint="go">
    ${ONLINE_OUTSIDE?`<label for="grpIn">Group code (optional)</label><input id="grpIn" class="grpin" maxlength="24" placeholder="e.g. sunday-crew" value="${esc(meta.grp||'')}" autocapitalize="none" spellcheck="false"><small class="nhelp">Friends who enter the same code see each other on the leaderboard and as ghost balls. Leave it empty to play with everyone.</small>`:''}
    <p class="nerr" id="nerr"></p><button class="btn" type="submit">${editing?'Save':'Tee off'}</button>
    ${editing?'<button class="btn ghost" type="button" id="nameBack">Back</button>':''}</form>`;
  $('card').hidden=false; $('card').classList.add('home'); $('card').scrollTop=0;
  const inp=$('nameIn'); setTimeout(()=>inp.focus(),120);
  $('nameForm').addEventListener('submit',e=>{ e.preventDefault(); audioInit();
    const v=inp.value.replace(/\s+/g,' ').trim();
    if(v.length<1){ $('nerr').textContent='Enter a name to start.'; inp.classList.remove('nope'); void inp.offsetWidth; inp.classList.add('nope'); tone(160,.12,'triangle',.1); return; }
    meta.name=v.slice(0,16); if($('grpIn')) meta.grp=$('grpIn').value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24); saveMeta(); syncName(); blips(3); showHome(); });
  if(editing) $('nameBack').addEventListener('click',()=>{ sfx('tick'); showHome(); });
}
async function refreshNetLine(){
  if(!ONLINE_OUTSIDE) return; await NET.ready; const el=document.getElementById('netline'); if(!el) return;
  if(NET.err){ el.textContent='Online play problem: '+NET.err; el.classList.add('bad'); return; }
  if(!NET.sb){ el.textContent='Online play is offline right now.'; return; }
  try{ const {data,error}=await NET.sb.from('rounds').select('player_id,name').eq('grp',meta.grp||'');
    if(error) throw error;
    const others=[...new Map((data||[]).filter(r=>r.player_id!==NET.uid).map(r=>[r.player_id,r.name||'Player'])).values()];
    const where=meta.grp?`group ${meta.grp}`:'the open group';
    if(document.getElementById('netline')) el.textContent=others.length?`Online in ${where} with ${others.slice(0,6).join(', ')}${others.length>6?` and ${others.length-6} more`:''}.`:`Online in ${where}. Nobody else has played a hole yet.`;
  }catch(e){ el.textContent='Online play problem: '+(e.message||e.code||'could not read rounds'); el.classList.add('bad'); }
}
function netDetails(){
  const el=document.getElementById('netline'); if(!el) return;
  el.textContent=`Player ${NET.uid?NET.uid.slice(0,8):'(none)'}, group "${meta.grp||''}". ${NET.err||(NET.sb?'Connected.':'Not connected.')} ${NET.save||''} ${NET.load||''}`.trim();
}
/* ---------- feedback: testers send notes straight into the Supabase "feedback" table ---------- */
const FB_KINDS=['Bug','Idea','Too hard','Too easy','Other'];
function feedbackContext(){ const h=HOLES&&HOLES[S.hole];
  return {version:VERSION,event:EV?EV.id:'',hole:EV?S.hole+1:null,holeName:h?h.name:'',state:S.state,strokes:S.strokes,twist:S.twist?S.twist.name:'',
    club:CLUBS[S.club]?.id||'',points:S.points,device:navigator.userAgent.slice(0,160),screen:`${W}x${Hh}`,standalone:!!(matchMedia('(display-mode: standalone)').matches||navigator.standalone)}; }
function showFeedback(back){
  const prevState=S.state; S.state='home';
  $('panel').innerHTML=`<h2>Send feedback</h2><p>Tell Otis what happened or what you'd change. Your game version and where you are get attached automatically.</p>
    <div class="fbk" role="radiogroup" aria-label="Kind of feedback">${FB_KINDS.map((k,i)=>`<button type="button" role="radio" class="fbc${i===0?' on':''}" aria-checked="${i===0}">${k}</button>`).join('')}</div>
    <textarea id="fbNote" maxlength="1000" rows="5" placeholder="What happened? Which hole? What did you expect?"></textarea>
    <p class="nerr" id="fbMsg"></p><button class="btn" id="fbSend">Send</button><button class="btn ghost" id="fbBack">Back</button>`;
  $('card').hidden=false; $('card').scrollTop=0; setTimeout(()=>$('fbNote').focus(),120);
  let kind=FB_KINDS[0];
  [...document.querySelectorAll('.fbc')].forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.fbc').forEach(x=>{ x.classList.remove('on'); x.setAttribute('aria-checked','false'); }); b.classList.add('on'); b.setAttribute('aria-checked','true'); kind=b.textContent; sfx('tick'); }));
  const done=()=>{ S.state=prevState; back(); };
  $('fbBack').addEventListener('click',()=>{ sfx('tick'); done(); });
  $('fbSend').addEventListener('click',async()=>{
    const note=$('fbNote').value.trim(); if(!note){ $('fbMsg').textContent='Write a quick note first.'; return; }
    $('fbSend').disabled=true; $('fbMsg').textContent='Sending…';
    let ok=false, why=''; await NET.ready;
    if(NET.sb&&NET.uid){ try{ const {error}=await NET.sb.from('feedback').insert({player_id:NET.uid,name:meta.name||'',version:VERSION,kind,note,context:feedbackContext()}); ok=!error; if(error) why=error.message||error.code; }catch(e){ why=e.message||String(e); } }
    else why=NET.err||'online play is not connected';
    if(ok){ blips(3); $('panel').innerHTML=`<h2>Thank you</h2><p>Your note is on its way.</p><button class="btn" id="fbOk">Back</button>`; $('fbOk').addEventListener('click',()=>{ sfx('tick'); done(); }); }
    else { $('fbSend').disabled=false; $('fbMsg').textContent=`Couldn't send (${why}). Your note is still here, so you can try again or copy it.`; }
  });
}
function showHome(){
  if(!meta.name){ showName(false); return; }
  endTutorial(); if(EV&&EV.id==='tutorial') EV=EVENTS[0];
  S.state='home'; const T=loadJSON('inknine-trophies',{}), B=loadJSON('inknine-bests',{});
  const count=Object.keys(T).length;
  $('panel').innerHTML=`<h2 class="logo">Ink Nine</h2><p>Play golf. Do well. Get trophies.</p>
    <p class="asname">Playing as <b>${esc(meta.name)}</b>${ONLINE_OUTSIDE&&meta.grp?` in <b>${esc(meta.grp)}</b>`:''} <button class="linkbtn" id="editName">${ONLINE_OUTSIDE?'Change name or group':'Change name'}</button></p>
    ${meta.tutDone?'':`<button class="event tut" id="tutBtn" style="animation-delay:.05s"><span class="tw-wrap"><svg width="44" height="44" viewBox="0 0 40 40" aria-hidden="true"><g stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none"><circle cx="20" cy="22" r="11" fill="#fff"/><path d="M14 17a8 8 0 0 1 6-3"/><path d="M29 6v12"/><path d="M29 6c4-1 6 2 9 1l-1 5c-3 1-5-2-8-1" fill="#000"/></g></svg><small>New here?</small></span><span class="ev"><b>Play the tutorial</b><i>Practice Green, 3 holes</i><span>Learn the swing, clubs, tempo, curve and spin in a few minutes. Earn 1,000 points for the pro shop.</span></span></button>`}
    <div class="events">${EVENTS.map((e,k)=>{ const locked=k>0&&!T[EVENTS[k-1].id], m=T[e.id];
      return `<button class="event${locked?' locked':''}" data-k="${k}" ${locked?'aria-disabled="true"':''} style="animation-delay:${.1+k*.1}s">
        <span class="tw-wrap">${trophySVG(m)}<small>${m||(locked?'Locked':'No trophy')}</small></span>
        <span class="ev"><b>${e.name}</b><i>${COURSES[e.course].name}, ${'●'.repeat(k+1)}${'○'.repeat(2-k)}</i><span>${locked?`Finish top three in ${EVENTS[k-1].name} to unlock.`:e.blurb}</span>${B[e.id]?`<small class="bestp">Best: ${B[e.id].toLocaleString()} points</small>`:''}</span></button>`; }).join('')}</div>
    <button class="shopbtn" id="toShop"><span class="bag">${shopBagSVG()}</span><span><b>Pro shop</b><small>${meta.wallet.toLocaleString()} points to spend</small></span></button>
    ${meta.tutDone?'<p class="asname"><button class="linkbtn" id="tutAgain">Replay the tutorial</button></p>':''}
    <p class="netline" id="netline">${ONLINE_OUTSIDE?'Connecting to online play…':''}</p>
    <p class="cab">${count?`${count} of 3 trophies won`:'No trophies yet'}</p>
    <p class="ver">Version ${VERSION}. <button class="linkbtn" id="fbBtn">Send feedback</button></p>`;
  $('card').hidden=false; $('card').scrollTop=0; $('card').classList.toggle('home',S.state==='home');
  refreshNetLine(); if(document.getElementById('netline')) document.getElementById('netline').addEventListener('click',netDetails);
  { const t1=document.getElementById('tutBtn')||document.getElementById('tutAgain'); if(t1) t1.addEventListener('click',()=>{ audioInit(); sfx('tick'); startTutorial(); }); }
  $('fbBtn').addEventListener('click',()=>{ sfx('tick'); showFeedback(showHome); });
  $('editName').addEventListener('click',()=>{ sfx('tick'); showName(true); });
  $('toShop').addEventListener('click',()=>{ audioInit(); sfx('tick'); showShop(); });
  [...$('panel').querySelectorAll('.event:not(.tut)')].forEach(b=>b.addEventListener('click',()=>{ audioInit(); const k=+b.dataset.k;
    if(b.classList.contains('locked')){ b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); tone(160,.12,'triangle',.1); return; }
    sfx('tick'); startEvent(k); }));
}
