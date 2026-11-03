// fcknos rule engine — Bryan's house Shithead/Palace. Pure, server-authoritative.
const RN = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'};
const DEFAULTS = {
  slapMs: 4000,          // slap-in window
  fourBurns: true,       // four of a kind (consecutive on pile) burns
  aceAnywhere: true,     // [flag] Ace is a high card: playable on anything except after a 9
  tenOnNine: true,       // [flag] 10 may be played on a 9
  aceLowOnNine: false,   // [flag] low Ace (1) does not count as 3-8
  sevenRule: 'none',     // Bryan: 7 does nothing special
};
function deck(){const d=[];for(const s of 'SHDC')for(let r=2;r<=14;r++)d.push({r,s,id:RN[r]+s});return d;}
function shuffle(a,rng=Math.random){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function newGame(players,opts={},rng){
  const rules={...DEFAULTS,...(opts.rules||{})};
  const d=opts.deck||shuffle(deck(),rng);
  const ps=players.map((p,i)=>({id:p.id,name:p.name,seat:i,down:d.splice(0,3),up:d.splice(0,3),hand:d.splice(0,3),ready:false,place:0}));
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
    if(r>=3&&r<=8)return true; if(r===10)return R.tenOnNine; if(r===14&&!aceHigh)return R.aceLowOnNine; return false;}
  if(r===2||r===10)return true; if(r===14)return R.aceAnywhere||topVal(g)<=(aceHigh?14:1);
  if(g.mode==='any')return true; return r>=topVal(g);}
function topVal(g){for(let i=g.pile.length-1;i>=0;i--)return g.pile[i].v;return 0;}
function is369(cs){return cs.length===3&&[3,6,9].every(r=>cs.some(c=>c.r===r));}
function zone(p,g){if(g&&g.need3S&&p.up.some(c=>c.id==='3S'))return 'up';return p.hand.length?'hand':p.up.length?'up':'down';}
function legal(g,id){const p=P(g,id),z=zone(p,g),src=p[z];if(z==='down')return [{blind:true}];
  const out=[];const by={};src.forEach(c=>(by[c.r]=by[c.r]||[]).push(c));
  for(const r in by){const n=+r;for(const ah of n===14?[true,false]:[false])if(fits(g,n,ah)){
    if(g.need3S&&!by[r].some(c=>c.id==='3S'))continue; out.push({ids:by[r].map(c=>c.id),aceHigh:ah});}}
  const t=[3,6,9].map(r=>src.find(c=>c.r===r)); if(t.every(Boolean)&&(!g.need3S||t[0].id==='3S'))out.push({ids:t.map(c=>c.id),combo:true});
  return out;}
function next(g,from){const n=g.players.length;for(let k=1;k<=n;k++){const p=g.players[(from+k)%n];if(!p.place)return p.seat;}return from;}
function checkOut(g,p){if(!p.place&&!p.hand.length&&!p.up.length&&!p.down.length){g.places.push(p.seat);p.place=g.places.length;log(g,`${p.name} is OUT (#${p.place})`);}
  const left=g.players.filter(q=>!q.place);
  if(g.teams){for(const t of [0,1])if(g.players.filter(q=>q.team===t).every(q=>q.place)){g.phase='over';g.winner={team:t};log(g,`Team ${t+1} wins!`);return;}}
  if(left.length<=1){g.phase='over';if(left[0]){left[0].place=g.players.length;log(g,`${left[0].name} is the Shithead`);}g.winner={seat:g.places[0]};}}
function refill(g,p){while(p.hand.length<3&&g.draw.length)p.hand.push(g.draw.shift());}
function burn(g,why){g.burned+=g.pile.length;g.pile=[];g.mode='any';g.slap=null;log(g,'🔥 pile burned ('+why+')');}
function afterLay(g,p,cards,o={}){ // cards already removed from player; lay on pile and resolve
  const combo=is369(cards)&&o.combo;
  for(const c of cards)g.pile.push({...c,v:c.r===14?(o.aceHigh===false?1:14):c.r,by:p.seat});
  log(g,`${p.name} ${o.slap?'SLAPS':'plays'} ${cards.map(c=>RN[c.r]).join(' ')}${combo?' (3-6-9!)':''}`);
  refill(g,p); g.slap=null;
  const top=g.pile[g.pile.length-1].r; let run=0;for(let i=g.pile.length-1;i>=0&&g.pile[i].r===top;i--)run++;
  let again=false;
  if(!combo&&top===10){burn(g,'10');again=true;}
  else if(!combo&&g.rules.fourBurns&&run>=4){burn(g,'four of a kind');again=true;}
  else {g.mode=combo||top===9?'low':top===2?'any':'norm';
    if(!combo&&run===3){const holder=g.players.find(q=>!q.place&&[...q.hand,...q.up].some(c=>c.r===top));
      g.slap={rank:top,until:g.now()+g.rules.slapMs,hint:!!holder};}}
  checkOut(g,p); if(g.phase==='over')return;
  g.turn=again&&!p.place?p.seat:next(g,p.seat);}
function play(g,id,ids,o={}){if(g.phase!=='play')throw new Error('not playing');const p=P(g,id);if(g.turn!==p.seat)throw new Error('not your turn');
  const z=zone(p,g);
  if(z==='down'){const c=p.down.splice(o.index||0,1)[0];if(!c)throw new Error('no card');
    if(fits(g,c.r,c.r===14)||(c.r===14&&fits(g,14,false))){g.need3S=false;return afterLay(g,p,[c],{aceHigh:fits(g,14,true)});}
    log(g,`${p.name} flips ${RN[c.r]} — no good, picks up`);p.hand.push(c);return pickup(g,id,true);}
  const cards=ids.map(i=>p[z].find(c=>c.id===i));if(!cards.length||cards.some(c=>!c))throw new Error('cards not in '+z);
  const combo=is369(cards);
  if(!combo){if(cards.some(c=>c.r!==cards[0].r))throw new Error('must be same rank');
    if(!fits(g,cards[0].r,o.aceHigh!==false))throw new Error('can\'t play that on this pile');}
  if(g.need3S&&!cards.some(c=>c.id==='3S'))throw new Error('first play must include the 3♠');
  g.need3S=false; p[z]=p[z].filter(c=>!ids.includes(c.id));
  afterLay(g,p,cards,{aceHigh:o.aceHigh!==false,combo});}
function pickup(g,id,force){const p=P(g,id);if(g.turn!==p.seat)throw new Error('not your turn');
  if(!force&&zone(p)!=='down'&&legal(g,id).length)throw new Error('you have a legal play');
  if(!force)log(g,`${p.name} picks up ${g.pile.length}`);p.hand.push(...g.pile);g.pile=[];g.mode='any';g.slap=null;g.turn=next(g,p.seat);}
function slap(g,id){const p=P(g,id);const s=g.slap;
  if(g.phase!=='play'||!s||g.now()>s.until)throw new Error('too late');
  const src=p.hand.length?p.hand:p.up;const c=src.find(c=>c.r===s.rank);if(!c)throw new Error('you don\'t have it');
  src.splice(src.indexOf(c),1);afterLay(g,p,[c],{slap:true});}
function view(g,id){const me=g.players.find(p=>p.id===id);
  return {phase:g.phase,rules:g.rules,teams:g.teams,turn:g.turn,mode:g.mode,draw:g.draw.length,burned:g.burned,need3S:g.need3S,
    pile:g.pile.slice(-6).map(c=>({id:c.id,r:c.r,v:c.v})),pileCount:g.pile.length,log:g.log.slice(-12),winner:g.winner,
    slap:g.slap&&{rank:g.slap.rank,msLeft:g.slap.until-g.now(),mine:!!me&&[...(me.hand.length?me.hand:me.up)].some(c=>c.r===g.slap.rank)},
    players:g.players.map(p=>({seat:p.seat,name:p.name,team:p.team,up:p.up,down:p.down.length,hand:p.hand.length,ready:p.ready,place:p.place})),
    me:me&&{seat:me.seat,hand:me.hand.slice().sort((a,b)=>a.r-b.r),legal:g.phase==='play'&&g.turn===me.seat?legal(g,id):[]}};}
module.exports={DEFAULTS,deck,newGame,swap,ready,play,pickup,slap,legal,view,fits,is369,RN};
