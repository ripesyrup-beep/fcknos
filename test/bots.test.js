// Bots-only simulation: 200 full games through the real bot brain + engine. Reports stuck games.
const test=require('node:test'),assert=require('node:assert');const E=require('../engine'),B=require('../bots');
function run(n,seed){const g=E.newGame(Array.from({length:n},(_,i)=>({id:'b'+i,name:B.NAMES[i],bot:true})));g.now=()=>0;let steps=0;
  while(g.phase!=='over'&&steps<5000){steps++;
    const slapper=g.slap&&g.players.find(p=>E.slapCards(g,p));if(slapper&&Math.random()<.5){E.slap(g,slapper.id);continue;}
    const active=g.phase==='swap'?g.players.find(p=>!p.ready):g.players[g.turn];const m=B.decide({game:E.view(g,active.id)});
    if(!m)throw new Error('bot had no move: '+g.phase+' '+g.mode);
    try{({ready:()=>E.ready(g,active.id),ace:()=>E.chooseAce(g,active.id,m.choice),pickup:()=>E.pickup(g,active.id),play:()=>E.play(g,active.id,m.ids||[],{index:m.index})})[m.t]();}
    catch(e){E.pickup(g,active.id,true);}}
  return {over:g.phase==='over',steps,n};}
test('200 bots-only games all finish',()=>{const res=[];for(let i=0;i<200;i++)res.push(run(2+i%5));
  const stuck=res.filter(r=>!r.over).length;const avg=Math.round(res.reduce((a,r)=>a+r.steps,0)/res.length);
  console.log(`bots sim: ${res.length} games, stuck ${stuck}, avg steps ${avg}, max ${Math.max(...res.map(r=>r.steps))}`);assert.equal(stuck,0);});
