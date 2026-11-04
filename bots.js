// Server-side bot brain. Only ever sees the same view a player gets (no peeking at other hands).
const E=require('./engine');
const NAMES=['Ace','Duke','Mabel','Rosie','Hank','Pearl','Gus','Dottie'];
const SPECIAL=r=>r===2||r===10||r===14;
const score=(o,hand)=>{ // lower = play first
  if(o.blind)return 0;const cs=o.ids.map(id=>hand.find(c=>c.id===id)).filter(Boolean);const r=cs[0]?cs[0].r:0;
  let s=o.combo?60:o.straight?-5*cs.length:SPECIAL(r)?40+r:r;  // dump straights, save 2/10/A/3-6-9
  return s-cs.length*0.5;};
function decide(v){const g=v.game;if(!g)return null;const me=g.me;if(!me)return null;
  if(g.phase==='swap'){return {t:'ready'};}
  if(g.phase!=='play'||g.turn!==me.seat)return null;
  if(g.mode==='aceWait')return {t:'ace',choice:Math.random()<0.75?'high':'low'};
  const L=me.legal||[];
  if(!L.length)return g.pileCount?{t:'pickup'}:null;
  if(L[0].blind)return {t:'play',index:0};
  // burn a big pile with a 10 if it's sensible
  const ten=L.find(o=>!o.straight&&!o.combo&&me.hand.find(c=>c.id===o.ids[0]&&c.r===10));
  if(ten&&g.pileCount>=6)return {t:'play',ids:ten.ids};
  const best=L.slice().sort((a,b)=>score(a,me.hand)-score(b,me.hand))[0];
  return {t:'play',ids:best.ids};}
module.exports={NAMES,decide};
