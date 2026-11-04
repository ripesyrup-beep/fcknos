// fcknos rule engine — Bryan's house Shithead/Palace. Pure, server-authoritative.
const RN = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'};
const DEFAULTS = {
  slapMs: 4000,          // slap-in window
  fourBurns: true,       // four of a kind (consecutive on pile) burns
  aceAnywhere: true,     // [flag] Ace is a high card: playable on anything except after a 9
  tenOnNine: true,       // [flag] 10 may be played on a 9
  aceLowOnNine: false,   // [flag] Ace may NOT be played on a 9
  sevenRule: 'none',     // Bryan: 7 does nothing special
  straights: true,       // 4+ consecutive ranks in one move; lowest card must fit the pile (after a 9: last card must be 3-8)
  slapMinOnPile: 1,      // [flag] slap-and-close: N matching on top (N>=this) + you hold the other 4-N
  cycleLimit: 30,        // stalemate guard: after this many pick-ups with no burn, the pile is burned
};
function deck(){const d=[];for(const s of 'SHDC')for(let r=2;r<=14;r++)d.push({r,s,id:RN[r]+s});return d;}
function shuffle(a,rng=Math.random){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function newGame(players,opts={},rng){
  const rules={...DEFAULTS,...(opts.rules||{})};
  const d=opts.deck||shuffle(deck(),rng);
  const ps=players.map((p,i)=>({id:p.id,name:p.name,bot:!!p.bot,seat:i,down:d.splice(0,3),up:d.splice(0,3),hand:d.splice(0,3),ready:false,place:0}));
  const teams=ps.length===4;
  ps.forEach(p=>p.team=teams?p.seat%2:null);
  return {rules,players:ps,draw:d,pile:[],burned:0,phase:'swap',turn:-1,mode:'any',log:[],slap:null,first:true,places:[],winner:null,teams,now:()=>Date.now()};
}
function log(g,m){g.log.push(m);if(g.log.length>40)g.log.shift();}
function P(g,id){const p=g.players.find(p=>p.id===id);if(!p)throw new Error('no player');return p;}
function swap(g,id,handId,upId){if(g.phase!=='swap')throw new Error('not swap phase');const p=P(g,id);
  const hi=p.hand.findIndex(c=>c.id===handId),ui=p.up.findIndex(c=>c.id===upId);if(hi<0||ui<0)throw new Error('bad swap');
  [p.hand[hi],p.up[ui]]=[p.up[ui],p.hand[hi]];}
function ready(g,id){if(g.phase!=='swap')return;P(g,id).ready=true;
  if(g.players.every(p=>p.ready)){g.phase='play';
    const s=g.players.find(p=>[...p.hand,...p.up].some(c=>c.id==='3S'));
    g.turn=s?s.seat:g.players.reduce((b,p)=>Math.min(...p.hand.map(c=>c.r))<Math.min(...b.hand.map(c=>c.r))?p:b).seat;
    g.need3S=!!s; log(g,`${g.players[g.turn].name} starts`+(s?' with the 3♠':''));}}
// can a single rank (value v, card rank r) go on the pile now?
function fits(g,r,aceHigh){const R=g.rules;
  if(g.mode==='low'){ // after a 9 or a 3-6-9
    if(r>=3&&r<=8)return true; if(r===10)return R.tenOnNine; if(r===14)return R.aceLowOnNine; return false;}
  if(g.mode==='aceHigh')return r===14||r===2||r===10; // Ace played as HIGH: next must be A, 2 or 10
  if(g.mode==='aceLow')return !(r===14||r===2||r===10); // Ace played as LOW: anything except A, 2, 10
  if(r===2||r===10)return true; if(r===14)return R.aceAnywhere||g.mode==='any'||topVal(g)<=14;
  if(g.mode==='any')return true; return (r===10?16:r)>=topVal(g);}
function topVal(g){for(let i=g.pile.length-1;i>=0;i--)return g.pile[i].v;return 0;}
// on a 9 / 3-6-9 (next must be 3-8) the straight's LAST card decides (2-3-4-5 is a sneaky play on a 9); otherwise the lowest card must fit
function stFits(g,st){return g.mode==='low'?fits(g,st.high.r):fits(g,st.low.r);}
// straight: 4+ distinct consecutive ranks, Ace low (A-2-3-4) or high (J-Q-K-A), no wraparound. Returns {low,high} card or null
function straight(cs){if(cs.length<4)return null;const rs=cs.map(c=>c.r);if(new Set(rs).size!==rs.length)return null;
  for(const aceLow of [false,true]){const v=c=>c.r===14&&aceLow?1:c.r;const sorted=cs.slice().sort((a,b)=>v(a)-v(b));
    if(sorted.every((c,i)=>i===0||v(c)===v(sorted[i-1])+1))return {low:sorted[0],high:sorted[sorted.length-1],sorted};}return null;}
function is369(cs){return cs.length===3&&[3,6,9].every(r=>cs.some(c=>c.r===r));}
function zone(p,g){if(g&&g.need3S&&p.up.some(c=>c.id==='3S'))return 'up';return p.hand.length?'hand':p.up.length?'up':'down';}
function legal(g,id){const p=P(g,id),z=zone(p,g),src=p[z];if(z==='down')return [{blind:true}];
  const out=[];const by={};src.forEach(c=>(by[c.r]=by[c.r]||[]).push(c));
  for(const r in by){const n=+r;if(fits(g,n)){
    if(g.need3S&&!by[r].some(c=>c.id==='3S'))continue; out.push({ids:by[r].map(c=>c.id)});}}
  if(g.rules.straights){const one={};src.forEach(c=>{one[c.r]=one[c.r]||c;});
    for(const lowV of [1,...Array.from({length:13},(_,i)=>i+2)]){const run=[];for(let v=lowV;v<=14;v++){const c=one[v===1?14:v];if(!c||(v===14&&lowV===1))break;run.push(c);
      if(run.length>=4){const st=straight(run);if(st&&stFits(g,st)&&(!g.need3S||run.some(c=>c.id==='3S')))out.push({ids:run.map(c=>c.id),straight:true});}}}}
  const t=[3,6,9].map(r=>src.find(c=>c.r===r)); if(t.every(Boolean)&&(!g.need3S||t[0].id==='3S'))out.push({ids:t.map(c=>c.id),combo:true});
  return out;}
function next(g,from){const n=g.players.length;for(let k=1;k<=n;k++){const p=g.players[(from+k)%n];if(!p.place)return p.seat;}return from;}
function checkOut(g,p){if(!p.place&&!p.hand.length&&!p.up.length&&!p.down.length){g.places.push(p.seat);p.place=g.places.length;log(g,`${p.name} is OUT (#${p.place})`);}
  const left=g.players.filter(q=>!q.place);
  if(g.teams){for(const t of [0,1])if(g.players.filter(q=>q.team===t).every(q=>q.place)){g.phase='over';g.winner={team:t};log(g,`Team ${t+1} wins!`);return;}}
  if(left.length<=1){g.phase='over';if(left[0]){left[0].place=g.players.length;log(g,`${left[0].name} is the Shithead`);}g.winner={seat:g.places[0]};}}
function refill(g,p){while(p.hand.length<3&&g.draw.length)p.hand.push(g.draw.shift());}
function burn(g,why){g.burned+=g.pile.length;g.pile=[];g.mode='any';g.pendingAce=null;g.slap=null;log(g,'🔥 pile burned ('+why+')');}
function afterLay(g,p,cards,o={}){ // cards already removed from player; lay on pile and resolve
  const combo=is369(cards)&&o.combo;const st=o.straight?straight(cards):null;
  for(const c of (st?st.sorted:cards))g.pile.push({...c,v:c.r===10?16:c.r,by:p.seat});
  log(g,`${p.name} ${o.slap?'SLAPS':'plays'} ${cards.map(c=>RN[c.r]).join(' ')}${combo?' (3-6-9!)':''}${st?' (straight)':''}`);
  refill(g,p); g.slap=null;
  const top=g.pile[g.pile.length-1].r; let run=0;for(let i=g.pile.length-1;i>=0&&g.pile[i].r===top;i--)run++;
  let again=false;
  if(o.close){burn(g,'slap & close');again=true;}
  else if(!st&&stalled(g)){burn(g,'stalemate guard');again=false;g.pickups=0;}
  else if(!combo&&top===10){burn(g,st?'straight ending in 10':'10');again=true;} // a straight's END card keeps its power (10 burns, 9 = 3-8, A = call)
  else if(!combo&&!st&&g.rules.fourBurns&&run>=4){burn(g,'four of a kind');again=true;}
  else {g.mode=combo||top===9?'low':top===2?'any':'norm';
    if(!combo&&top===14){g.mode='aceWait';g.pendingAce=p.seat;}
    if(!combo&&!st&&run<4&&run>=g.rules.slapMinOnPile)g.slap={rank:top,need:4-run,until:g.now()+g.rules.slapMs};}
  if(!again)g.pickups=g.pickups||0; else g.pickups=0;
  flip(g,p); checkOut(g,p); if(g.phase==='over')return;
  if(g.mode==='aceWait'){g.turn=p.seat;return;} // ace player must choose HIGH/LOW
  g.turn=again&&!p.place?p.seat:next(g,p.seat);}
// draw pile gone + hand empty -> pick up all face-up cards into hand at once
function flip(g,p){if(!p.hand.length&&!g.draw.length&&p.up.length){p.hand=p.up;p.up=[];log(g,`${p.name} picks up their face-up cards`);}}
function chooseAce(g,id,choice){const p=P(g,id);if(g.mode!=='aceWait'||g.pendingAce!==p.seat)throw new Error('no ace to call');
  if(choice!=='high'&&choice!=='low')throw new Error('HIGH or LOW');g.mode=choice==='high'?'aceHigh':'aceLow';g.pendingAce=null;
  log(g,`${p.name}: ACE → ${choice.toUpperCase()}`);g.turn=next(g,p.seat);}
function play(g,id,ids,o={}){if(g.phase!=='play')throw new Error('not playing');if(g.mode==='aceWait')throw new Error('waiting for ACE call');const p=P(g,id);if(g.turn!==p.seat)throw new Error('not your turn');
  const z=zone(p,g);
  if(z==='down'){const c=p.down.splice(o.index||0,1)[0];if(!c)throw new Error('no card');
    if(fits(g,c.r)){g.need3S=false;return afterLay(g,p,[c]);}
    log(g,`${p.name} flips ${RN[c.r]} — no good, picks up`);p.hand.push(c);return pickup(g,id,true);}
  const cards=ids.map(i=>p[z].find(c=>c.id===i));if(!cards.length||cards.some(c=>!c))throw new Error('cards not in '+z);
  const combo=is369(cards);let st=null;
  if(!combo){if(cards.some(c=>c.r!==cards[0].r)){st=g.rules.straights&&straight(cards);if(!st)throw new Error('play one rank, a 3-6-9, or a straight of 4+');
      if(!stFits(g,st))throw new Error(g.mode==='low'?'after a 9 the straight must END on 3-8':'lowest card of the straight can\'t go on this pile');}
    else if(!fits(g,cards[0].r))throw new Error('can\'t play that on this pile');}
  if(g.need3S&&!cards.some(c=>c.id==='3S'))throw new Error('first play must include the 3♠');
  g.need3S=false; p[z]=p[z].filter(c=>!ids.includes(c.id));
  afterLay(g,p,cards,{combo,straight:!!st});}
function pickup(g,id,force){const p=P(g,id);if(g.turn!==p.seat)throw new Error('not your turn');if(g.mode==='aceWait')throw new Error('call the ACE first');
  if(!force&&!g.pile.length)throw new Error('pile is empty');
  if(!force)log(g,`${p.name} picks up ${g.pile.length}`);p.hand.push(...g.pile);g.pile=[];g.mode='any';g.slap=null;flip(g,p);g.turn=next(g,p.seat);
  g.pickups=(g.pickups||0)+1;}
// stalemate guard: lots of pick-ups with no burn -> the next lay that follows is burned
function stalled(g){return g.rules.cycleLimit>0&&(g.pickups||0)>=g.rules.cycleLimit;}
function slapCards(g,p){const s=g.slap;if(!s||p.place)return null;const src=p.hand.length?p.hand:p.up;const m=src.filter(c=>c.r===s.rank);return m.length>=s.need?m.slice(0,s.need):null;}
function slap(g,id){const p=P(g,id);const s=g.slap;
  if(g.phase!=='play'||!s||g.now()>s.until)throw new Error('too late');
  const cs=slapCards(g,p);if(!cs)throw new Error('you can\'t close it');const src=p.hand.length?p.hand:p.up;
  for(const c of cs)src.splice(src.indexOf(c),1);g.pendingAce=null;afterLay(g,p,cs,{slap:true,close:true});}
function view(g,id){const me=g.players.find(p=>p.id===id);
  return {phase:g.phase,rules:g.rules,teams:g.teams,turn:g.turn,mode:g.mode,draw:g.draw.length,burned:g.burned,need3S:g.need3S,pendingAce:g.pendingAce,
    pile:g.pile.slice(-6).map(c=>({id:c.id,r:c.r,v:c.v})),pileCount:g.pile.length,log:g.log.slice(-12),winner:g.winner,
    slap:g.slap&&{rank:g.slap.rank,need:g.slap.need,msLeft:g.slap.until-g.now(),mine:!!me&&!!slapCards(g,me)},
    players:g.players.map(p=>({seat:p.seat,name:p.name,bot:p.bot,team:p.team,up:p.up,down:p.down.length,hand:p.hand.length,ready:p.ready,place:p.place})),
    me:me&&{seat:me.seat,hand:me.hand.slice().sort((a,b)=>a.r-b.r),legal:g.phase==='play'&&g.turn===me.seat?legal(g,id):[]}};}
module.exports={straight,slapCards,chooseAce,DEFAULTS,deck,newGame,swap,ready,play,pickup,slap,legal,view,fits,is369,RN};
