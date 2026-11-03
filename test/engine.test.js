const test=require('node:test'),assert=require('node:assert');const E=require('../engine');
const C=s=>{const m=s.match(/^(10|[2-9JQKA])([SHDC])$/);return{r:{J:11,Q:12,K:13,A:14}[m[1]]||+m[1],s:m[2],id:s};};
// build a game in play phase with explicit hands
function G(hands,o={}){const n=hands.length;const g=E.newGame(hands.map((_,i)=>({id:'p'+i,name:'P'+i})),{rules:o.rules});
  g.players.forEach((p,i)=>{p.hand=hands[i].map(C);p.up=(o.up?.[i]||[]).map(C);p.down=(o.down?.[i]||['KC']).map(C);p.ready=true;});
  g.draw=(o.draw||[]).map(C);g.phase='play';g.turn=o.turn||0;g.need3S=false;g.pile=(o.pile||[]).map(s=>{const c=C(s);return{...c,v:c.r};});
  g.mode=o.mode||(g.pile.length?(g.pile.at(-1).r===9?'low':g.pile.at(-1).r===2?'any':'norm'):'any');if(o.now)g.now=o.now;return g;}
const ok=(g,i,ids,o)=>E.play(g,'p'+i,ids,o),bad=(g,i,ids,o)=>assert.throws(()=>E.play(g,'p'+i,ids,o));
test('deal 3 down / 3 up / 3 hand, rest is draw pile, 52 cards',()=>{const g=E.newGame([{id:'a'},{id:'b'},{id:'c'}]);
  g.players.forEach(p=>{assert.equal(p.down.length,3);assert.equal(p.up.length,3);assert.equal(p.hand.length,3)});assert.equal(g.draw.length,52-27);
  assert.equal(new Set([...g.draw,...g.players.flatMap(p=>[...p.up,...p.down,...p.hand])].map(c=>c.id)).size,52);});
test('swap hand<->up then 3♠ holder starts and must play it',()=>{const g=E.newGame([{id:'a',name:'a'},{id:'b',name:'b'}]);
  const pa=g.players[0],pb=g.players[1];const all=[...g.draw,...pa.hand,...pa.up,...pa.down,...pb.hand,...pb.up,...pb.down];
  // force 3S into b's hand
  const i=pb.hand.findIndex(()=>1);const s3=all.find(c=>c.id==='3S');for(const z of[g.draw,pa.hand,pa.up,pa.down,pb.up,pb.down,pb.hand]){const k=z.indexOf(s3);if(k>=0){z[k]=pb.hand[0];pb.hand[0]=s3;break;}}
  const h=pa.hand[1].id,u=pa.up[0].id;E.swap(g,'a',h,u);assert.equal(pa.up[0].id,h);
  E.ready(g,'a');assert.equal(g.phase,'swap');E.ready(g,'b');assert.equal(g.phase,'play');assert.equal(g.turn,1);
  const other=pb.hand.find(c=>c.r!==3);if(other)assert.throws(()=>E.play(g,'b',[other.id]),/3♠/);E.play(g,'b',['3S']);assert.equal(g.pile.at(-1).id,'3S');});
test('multiples of same rank; mixed ranks rejected',()=>{const g=G([['5S','5H','6D'],['KD']]);bad(g,0,['5S','6D']);ok(g,0,['5S','5H']);assert.equal(g.pile.length,2);});
test('must play equal or higher',()=>{const g=G([['4S','8H'],['KD']],{pile:['7C']});bad(g,0,['4S']);ok(g,0,['8H']);
  const g2=G([['7S'],['KD']],{pile:['7C']});ok(g2,0,['7S']);});
test('ace high or low',()=>{let g=G([['AS','4C'],['5D','2C','KS']],{pile:['KC']});ok(g,0,['AS'],{aceHigh:true});assert.equal(g.pile.at(-1).v,14);
  assert.throws(()=>E.play(g,'p1',['KS']));E.play(g,'p1',['2C']);
  g=G([['AS','4C'],['5D','KS']],{pile:['KC']});ok(g,0,['AS'],{aceHigh:false});assert.equal(g.pile.at(-1).v,1);E.play(g,'p1',['5D']);});
test('9: next must be 3-8 (10 allowed), 2 on 9 rejected, K rejected',()=>{const g=G([['9S'],['2C','KD','3H','10C']]);ok(g,0,['9S']);
  bad(g,1,['2C']);bad(g,1,['KD']);ok(g,1,['3H']);
  const g2=G([['9S'],['10C','4D']]);ok(g2,0,['9S']);ok(g2,1,['10C']);assert.equal(g2.pile.length,0);});
test('2 is wild on anything but a 9, resets pile',()=>{const g=G([['2C','4D'],['3H','4C']],{pile:['KD']});ok(g,0,['2C']);ok(g,1,['3H']);});
test('10 burns the pile, same player goes again',()=>{const g=G([['10C','4D','5S'],['KD']],{pile:['KD','QS']});ok(g,0,['10C']);
  assert.equal(g.pile.length,0);assert.equal(g.burned,3);assert.equal(g.turn,0);});
test('3-6-9 trumps everything, NO burn, next must play 3-8',()=>{const g=G([['3C','6D','9H','QS'],['KD','5C','2S']],{pile:['AS']});
  ok(g,0,['3C','6D','9H']);assert.equal(g.pile.length,4);assert.equal(g.turn,1);assert.equal(g.mode,'low');bad(g,1,['KD']);bad(g,1,['2S']);ok(g,1,['5C']);
  const g2=G([['3C','6D','9H'],['5C']],{pile:['9S']});ok(g2,0,['3C','6D','9H']);assert.equal(g2.pile.length,4);});
test('four of a kind burns (toggle)',()=>{let g=G([['8C','8D'],['KD']],{pile:['8S','8H']});ok(g,0,['8C','8D']);assert.equal(g.pile.length,0);assert.equal(g.turn,0);
  g=G([['8C','8D'],['KD']],{pile:['8S','8H'],rules:{fourBurns:false}});ok(g,0,['8C','8D']);assert.equal(g.pile.length,4);});
test('7 does nothing special',()=>{const g=G([['7C'],['KD']],{pile:['5S']});ok(g,0,['7C']);ok(g,1,['KD']);});
test('slap-in: three of a rank on top, holder of fourth slaps out of turn; first wins; window expires',()=>{let t=0;
  const g=G([['7C','7D','7H','4S'],['5S'],['7S','KD'],['QC']],{now:()=>t});
  ok(g,0,['7C','7D','7H']);assert.ok(g.slap);assert.equal(g.turn,1);
  assert.throws(()=>E.slap(g,'p1'),/have/);E.slap(g,'p2');assert.equal(g.pile.length,0,'4 of a kind burned');assert.equal(g.turn,2,'continues from slapper');
  assert.throws(()=>E.slap(g,'p2'),/late/,'second slap loses the race');
  // expiry
  const g2=G([['7C','7D','7H','4S'],['5S'],['7S'],['QC']],{now:()=>t});t=0;ok(g2,0,['7C','7D','7H']);t=4001;assert.throws(()=>E.slap(g2,'p2'),/late/);
  // works for any rank
  t=0;const g3=G([['QC','QD','QH','4S'],['5S'],['QS','2D']],{now:()=>t});ok(g3,0,['QC','QD','QH']);E.slap(g3,'p2');assert.equal(g3.burned,4);});
test('cannot play -> pick up whole pile; pickup refused when you can play',()=>{const g=G([['KC'],['KD','5H']],{pile:['QS']});
  assert.throws(()=>E.pickup(g,'p0'));const g2=G([['4C'],['KD']],{pile:['5S','QS']});assert.equal(E.legal(g2,'p0').length,0);E.pickup(g2,'p0');
  assert.equal(g2.players[0].hand.length,3);assert.equal(g2.turn,1);assert.equal(g2.pile.length,0);});
test('hand refills to 3 from draw; then face-up; then blind face-down',()=>{const g=G([['5C','6C','7C'],['KD']],{draw:['8C','9C'],up:[['JH']],down:[['QD']]});
  ok(g,0,['5C']);assert.equal(g.players[0].hand.length,3);assert.equal(g.draw.length,1);
  const g2=G([[],['2D']],{up:[['JH']],down:[['QD'],['KD']],pile:['4C']});ok(g2,0,['JH']);assert.equal(g2.players[0].up.length,0);E.play(g2,'p1',['2D']);E.play(g2,'p0',[],{index:0});assert.equal(g2.players[0].place,1);});
test('blind down card that fails -> picks up pile + card',()=>{const g=G([[],['KD']],{down:[['4D'],['KD']],pile:['QS']});E.play(g,'p0',[],{index:0});
  assert.deepEqual(g.players[0].hand.map(c=>c.id).sort(),['4D','QS']);assert.equal(g.turn,1);});
test('first out wins, last holding cards loses',()=>{const g=G([['KC'],['3D'],['4D']],{down:[[],['5D'],['6D']]});ok(g,0,['KC']);assert.equal(g.players[0].place,1);assert.notEqual(g.turn,0);});
test('4 players = teams, partners across (seats 1&3 vs 2&4); team wins when both out',()=>{const g=E.newGame([1,2,3,4].map(i=>({id:'p'+i})));
  assert.ok(g.teams);assert.deepEqual(g.players.map(p=>p.team),[0,1,0,1]);assert.equal(E.newGame([1,2,3].map(i=>({id:'p'+i}))).teams,false);
  const t=G([['KC'],['2D'],['KS'],['4D']],{down:[[],['5D'],[],['6D']]});ok(t,0,['KC']);assert.equal(t.phase,'play');assert.equal(t.turn,1);E.play(t,'p1',['2D']);
  E.play(t,'p2',['KS']);assert.equal(t.phase,'over');assert.equal(t.winner.team,0);});
test('partners cannot see each other hands',()=>{const g=E.newGame([1,2,3,4].map(i=>({id:'p'+i,name:'x'})));const v=E.view(g,'p1');
  assert.ok(Array.isArray(v.me.hand));assert.ok(v.players.every(p=>typeof p.hand==='number'));assert.ok(!JSON.stringify(v).includes(JSON.stringify(g.players[2].hand[0])));});
