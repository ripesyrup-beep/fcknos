const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{WebSocketServer}=require('ws');const E=require('./engine'),BOT=require('./bots');
const PUB=path.join(__dirname,'public'),TYPES={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const rooms=new Map();// code -> {code,host,members:[{id,name,token,ws}],rules,game}
function start(port=process.env.PORT||8080){
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';const p=path.join(PUB,path.normalize(f));
  if(!p.startsWith(PUB)||!fs.existsSync(p)){r.writeHead(404);return r.end('nope');}r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);});
const wss=new WebSocketServer({server:srv});
const send=(ws,m)=>ws&&ws.readyState===1&&ws.send(JSON.stringify(m));
function push(room){driveBots(room);for(const m of room.members)if(!m.bot)send(m.ws,{t:'state',code:room.code,you:m.id,host:room.host,lobby:room.members.map(x=>({id:x.id,name:x.name,on:!!x.ws||!!x.bot,bot:!!x.bot})),rules:room.rules,game:room.game&&E.view(room.game,m.id)});}
const BOT_THINK=()=>800+Math.random()*700,BOT_SLAP=()=>500+Math.random()*2000;
function addBot(room){const used=new Set(room.members.map(m=>m.name));const name=BOT.NAMES.find(n=>!used.has(n))||'Bot'+room.members.length;
  room.members.push({id:crypto.randomUUID(),token:null,name,bot:true,ws:null});}
function act(room,b,m){if(!room.game||!rooms.has(room.code))return;const g=room.game;
  try{switch(m.t){case 'ready':E.ready(g,b.id);break;case 'ace':E.chooseAce(g,b.id,m.choice);break;case 'pickup':E.pickup(g,b.id);break;
    case 'play':E.play(g,b.id,m.ids||[],{index:m.index});break;case 'slap':E.slap(g,b.id);break;}}
  catch(e){ // never get stuck: fall back to picking up
    try{if(g.turn===E.view(g,b.id).me.seat&&g.phase==='play'&&m.t!=='slap')E.pickup(g,b.id,true);}catch{}}
  push(room);}
function driveBots(room){const g=room.game;if(!g||g.phase==='over')return;
  for(const b of room.members.filter(m=>m.bot)){const v=E.view(g,b.id);
    // slap-and-close with a human-like delay
    if(v.slap&&v.slap.mine&&v.slap.msLeft>0){const key='slap'+g.pile.length+':'+g.log.length;if(b.slapKey!==key){b.slapKey=key;
      setTimeout(()=>{const s=g.slap;if(s&&E.view(g,b.id).slap?.mine&&room.game===g)act(room,b,{t:'slap'});},Math.min(BOT_SLAP(),v.slap.msLeft-50)).unref?.();}}
    const m=BOT.decide({game:v});if(!m)continue;
    const key=g.phase+':'+g.turn+':'+g.mode+':'+g.log.length+':'+g.pile.length;if(b.key===key)continue;b.key=key;
    setTimeout(()=>{if(room.game!==g)return;const again=BOT.decide({game:E.view(g,b.id)});if(again)act(room,b,again);},m.t==='ready'?300:(room.fast?20:BOT_THINK()));}}
function code(){let c;do c=String(Math.floor(1000+Math.random()*9000));while(rooms.has(c));return c;}
wss.on('connection',ws=>{let room,me;
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
   try{switch(m.t){
    case 'create':{const c=code();room={code:c,members:[],rules:{...E.DEFAULTS},game:null};rooms.set(c,room);}// fallthrough
    case 'join':{room=room||rooms.get(String(m.code));if(!room)throw new Error('No party with that code');
      if(room.game)throw new Error('Game already started');if(room.members.length>=6)throw new Error('Party is full (6)');
      me={id:crypto.randomUUID(),token:crypto.randomUUID(),name:String(m.name||'Player').slice(0,14),ws};room.members.push(me);room.host=room.host||me.id;
      send(ws,{t:'joined',code:room.code,token:me.token});break;}
    case 'resume':{room=rooms.get(String(m.code));me=room&&room.members.find(x=>x.token===m.token);if(!me){room=null;throw new Error('Session expired');}me.ws=ws;send(ws,{t:'joined',code:room.code,token:me.token});break;}
    case 'bots':{const c=code();room={code:c,members:[],rules:{...E.DEFAULTS},game:null,fast:!!m.fast&&process.env.FCKNOS_TEST_HOOKS==='1'};rooms.set(c,room);
      me={id:crypto.randomUUID(),token:crypto.randomUUID(),name:String(m.name||'Player').slice(0,14),ws};room.members.push(me);room.host=me.id;
      const n=Math.max(1,Math.min(5,m.n|0||1));for(let i=0;i<n;i++)addBot(room);send(ws,{t:'joined',code:room.code,token:me.token});
      room.game=E.newGame(room.members,{rules:room.rules});break;}
    case 'addbot':if(me.id!==room.host||room.game)throw new Error('Only host, before start');if(room.members.length>=6)throw new Error('Party is full (6)');addBot(room);break;
    case 'kickbot':{if(me.id!==room.host||room.game)throw 0;const i=room.members.map(x=>x.bot).lastIndexOf(true);if(i>=0)room.members.splice(i,1);break;}
    case 'rules':if(me.id!==room.host||room.game)throw 0;Object.assign(room.rules,m.rules);break;
    case 'start':if(me.id!==room.host)throw new Error('Only host can start');if(room.members.length<2)throw new Error('Need 2+ players');room.game=E.newGame(room.members,{rules:room.rules});break;
    case 'again':if(me.id!==room.host)throw 0;room.game=null;break;
    case 'swap':E.swap(room.game,me.id,m.hand,m.up);break;
    case 'ready':E.ready(room.game,me.id);break;
    case 'play':E.play(room.game,me.id,m.ids||[],{aceHigh:m.aceHigh,index:m.index});break;
    case 'ace':E.chooseAce(room.game,me.id,m.choice);break;
    case 'pickup':E.pickup(room.game,me.id);break;
    case 'slap':E.slap(room.game,me.id);break;
    case 'rig':{if(process.env.FCKNOS_TEST_HOOKS!=='1')return;const g=room.game,p=g.players.find(x=>x.id===me.id);// test-only: put A♠ in my hand, my turn
      const all=g.players.flatMap(x=>[x.hand,x.up,x.down]).concat([g.draw,g.pile]);for(const z of all){const i=z.findIndex(c=>c.id==='AS');if(i>=0)z.splice(i,1);}
      p.hand.push({r:14,s:'S',id:'AS'});g.phase='play';g.turn=p.seat;g.need3S=false;g.mode='any';g.pendingAce=null;break;}
    default:return;}
   }catch(e){send(ws,{t:'err',msg:e&&e.message||'Not allowed'});}
   if(room){push(room);const g=room.game;if(g&&g.slap){clearTimeout(room.st);room.st=setTimeout(()=>push(room),g.slap.until-Date.now()+50);room.st.unref();}}});
  ws.on('close',()=>{if(me&&me.ws===ws){me.ws=null;if(room)push(room);}});});
setInterval(()=>{for(const[c,r]of rooms)if(r.members.every(m=>!m.ws||m.bot)&&r.members.every(m=>!m.ws)){r.idle=(r.idle||0)+1;if(r.idle>60)rooms.delete(c);}else r.idle=0;},60000).unref();
srv.shutdown=()=>{wss.clients.forEach(c=>c.terminate());srv.close();};
return new Promise(res=>srv.listen(port,()=>res(srv)));}
if(require.main===module)start().then(s=>console.log('fcknos on :'+s.address().port));
module.exports={start};
