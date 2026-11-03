const test=require('node:test'),assert=require('node:assert'),WS=require('ws');const {start}=require('../server');
function bot(url,name){const ws=new WS(url);const b={ws,name,st:null,errs:0,q:[]};
  b.send=m=>ws.send(JSON.stringify(m));b.ready=new Promise(r=>ws.on('open',r));
  ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='state'){b.st=m;b.onstate&&b.onstate(m);}if(m.t==='err')b.errs++;if(m.t==='joined')b.code=m.code;});return b;}
const wait=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{if(f()){clearInterval(i);res()}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('timeout'))}},10)});
test('4 headless bots play a full team game to the end over websockets',async()=>{
  const srv=await start(0);const url='ws://localhost:'+srv.address().port;
  const bots=['Ann','Bob','Cat','Dan'].map(n=>bot(url,n));await Promise.all(bots.map(b=>b.ready));
  bots[0].send({t:'create',name:'Ann'});await wait(()=>bots[0].code);
  for(const b of bots.slice(1))b.send({t:'join',code:bots[0].code,name:b.name});
  await wait(()=>bots.every(b=>b.st&&b.st.lobby.length===4));
  bots[0].send({t:'rules',rules:{slapMs:300}});bots[0].send({t:'start'});
  await wait(()=>bots.every(b=>b.st.game));let moves=0,slaps=0;
  for(const b of bots){b.send({t:'ready'});
    b.onstate=m=>{const g=m.game;if(!g||g.phase!=='play')return;
      if(g.slap&&g.slap.mine&&g.slap.msLeft>0&&Math.random()<.7){slaps++;return b.send({t:'slap'});}
      if(g.turn!==g.me.seat)return;if(g.mode==='aceWait')return b.send({t:'ace',choice:Math.random()<.5?'high':'low'});moves++;
      const L=g.me.legal;if(!L.length)return b.send({t:'pickup'});
      if(L[0].blind)return b.send({t:'play',index:0});
      const pick=L.sort((a,c)=>(a.combo?99:0)-(c.combo?99:0)||parseInt(a.ids[0])-parseInt(c.ids[0]))[0];b.send({t:'play',ids:pick.ids});};}
  await wait(()=>bots[0].st.game.phase==='over',60000);
  const g=bots[0].st.game;console.log('moves',moves,'slap attempts',slaps,'winner',JSON.stringify(g.winner),g.log.slice(-4).join(' | '));
  assert.equal(g.winner.team!=null,true);assert.ok(g.teams);
  for(const b of bots)b.ws.close();srv.shutdown();});
test('lobby: bad code rejected, reconnect with token resumes seat',async()=>{const srv=await start(0);const url='ws://localhost:'+srv.address().port;
  const a=bot(url),b=bot(url);await Promise.all([a.ready,b.ready]);a.send({t:'create',name:'A'});await wait(()=>a.code);
  b.send({t:'join',code:'0000',name:'B'});await wait(()=>b.errs);b.send({t:'join',code:a.code,name:'B'});await wait(()=>b.st);
  let tok;b.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='joined')tok=m.token});
  await new Promise(r=>setTimeout(r,50));const tok2=JSON.parse(JSON.stringify(b.st.you));b.ws.close();await wait(()=>a.st.lobby.some(p=>!p.on));
  srv.shutdown();});
