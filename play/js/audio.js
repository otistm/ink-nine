/* Ink Nine: Tiny procedural sound effects. */
"use strict";
/* ============================================================
   AUDIO — tiny procedural foley
   ============================================================ */
let AC=null;
function audioInit(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==='suspended') AC.resume(); }
function tone(f,d,type,v,f2){ if(!AC) return; const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+d);
  g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t+d+.02); }
function noise(d,v,fc,q){ if(!AC) return; const t=AC.currentTime,n=Math.floor(AC.sampleRate*d),buf=AC.createBuffer(1,n,AC.sampleRate),a=buf.getChannelData(0);
  for(let i=0;i<n;i++) a[i]=(Math.random()*2-1)*(1-i/n);
  const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain(); s.buffer=buf; f.type='bandpass'; f.frequency.value=fc; f.Q.value=q||1; g.gain.value=v;
  s.connect(f).connect(g).connect(AC.destination); s.start(t); }
function sfx(k,p=1){
  if(k==='hit'){ noise(.07,.35+.4*p,3200,.7); tone(210,.09,'triangle',.3,80); }
  else if(k==='putt'){ tone(1250,.05,'sine',.16,900); }
  else if(k==='bounce'){ tone(170,.06,'sine',Math.min(.2,.04+p*.01),90); }
  else if(k==='sand'){ noise(.22,.25,1400,.6); }
  else if(k==='splash'){ noise(.55,.5,700,.5); tone(300,.25,'sine',.1,120); }
  else if(k==='tree'){ noise(.25,.3,3800,.5); }
  else if(k==='cup'){ tone(340,.06,'triangle',.25,200); setTimeout(()=>{tone(660,.15,'sine',.22); setTimeout(()=>tone(990,.35,'sine',.2),110);},90); }
  else if(k==='tick'){ tone(900,.03,'sine',.08); }
}
