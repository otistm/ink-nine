/* Ink Nine for desktop: loaded before everything else.
   The desktop edition keeps its own saved progress. Every "inknine-…" key the game reads or writes is
   quietly stored as "inknine-desk-…" instead, so phone progress in the same browser is never touched. */
"use strict";
const DESKTOP=true;
(()=>{
  const P='inknine-', D='inknine-desk-', map=k=>(typeof k==='string'&&k.startsWith(P)&&!k.startsWith(D))?D+k.slice(P.length):k;
  const sp=Storage.prototype, get=sp.getItem, set=sp.setItem, rem=sp.removeItem;
  sp.getItem=function(k){ return get.call(this,map(k)); };
  sp.setItem=function(k,v){ return set.call(this,map(k),v); };
  sp.removeItem=function(k){ return rem.call(this,map(k)); };
})();
