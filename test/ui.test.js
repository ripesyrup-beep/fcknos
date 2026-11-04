// Real-browser UI test: headless google-chrome via puppeteer-core against a local server.
const test=require('node:test'),assert=require('node:assert'),path=require('path');
process.env.FCKNOS_TEST_HOOKS='1';const {start}=require('../server');const pp=require('puppeteer-core');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome',SHOTS=path.join(__dirname,'..','shots');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('UI renders and plays in a real browser (no console/page errors)',{timeout:90000},async()=>{
  const srv=await start(0);const U='http://localhost:'+srv.address().port;
  const b=await pp.launch({executablePath:CHROME,args:['--no-sandbox']});const errors=[];
  try{
    const pages=[];for(let i=0;i<3;i++){const c=await b.createBrowserContext();const p=await c.newPage();
      p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto(U);pages.push(p);}
    const [A,B,C]=pages,click=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(e)e.click();return !!e},s);
    await A.waitForSelector('#new');await A.type('#nm','Bryan');await A.screenshot({path:SHOTS+'/ui-1-home.png'});
    await click(A,'#new');await A.waitForSelector('.code');const code=(await A.$eval('.code',e=>e.textContent)).trim();assert.match(code,/^\d{4}$/);
    for(const [p,n] of [[B,'Aubrey'],[C,'Mom']]){await p.waitForSelector('#nm');await p.type('#nm',n);await p.type('#cd',code);await click(p,'#join');await p.waitForSelector('.code');}
    await A.waitForFunction(()=>document.querySelectorAll('.pl').length===3);await A.screenshot({path:SHOTS+'/ui-2-lobby.png',fullPage:true});
    await click(A,'#go');for(const p of pages){await p.waitForSelector('#rdy');}
    for(const p of pages){await click(p,'#rdy');await sleep(150);}
    await A.waitForFunction(()=>document.querySelector('.status')&&/turn/i.test(document.querySelector('.status').textContent));
    await A.screenshot({path:SHOTS+'/ui-3-ingame.png',fullPage:true});
    assert.ok(await A.$('#hand .card'),'hand cards render');
    // force an ace (test-only hook), play it, expect HIGH/LOW popup
    await A.evaluate(()=>tx({t:'rig'}));await A.waitForSelector('#hand .card[data-id="AS"]');
    await click(A,'#hand .card[data-id="AS"]');await sleep(100);await click(A,'#pl');
    await A.waitForSelector('#ahi');await A.screenshot({path:SHOTS+'/ui-4-ace-popup.png'});
    await click(A,'#ahi');await B.waitForFunction(()=>/ACE → HIGH/.test(document.body.textContent));
    await B.screenshot({path:SHOTS+'/ui-5-ace-high-banner.png',fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{await b.close();srv.shutdown();}});
test('PLAY VS BOTS in a real browser: bots play, no console errors',{timeout:90000},async()=>{
  const srv=await start(0);const U='http://localhost:'+srv.address().port;
  const b=await pp.launch({executablePath:CHROME,args:['--no-sandbox']});const errors=[];
  try{const p=await b.newPage();p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
    await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto(U);
    const click=s=>p.evaluate(s=>{const e=document.querySelector(s);if(e)e.click();return !!e},s);
    await p.waitForSelector('#vsb');await click('.nbot[data-n="3"]');await sleep(100);await p.type('#nm','Bryan');
    await p.screenshot({path:SHOTS+'/ui-6-bots-home.png',fullPage:true});
    await p.evaluate(()=>{window.__fastBots=false});await click('#vsb');await p.waitForSelector('#rdy');
    const names=await p.$$eval('.pl b',es=>es.map(e=>e.textContent));assert.equal(names.length,3);
    assert.equal(await p.$$eval('.pl small',es=>es.filter(e=>/BOT/.test(e.textContent)).length),3);
    await click('#rdy');let myTurns=0,logLen=0;
    for(let i=0;i<300&&myTurns<3;i++){await sleep(150);
      const st=await p.evaluate(()=>({s:(document.querySelector('.status')||{}).textContent||'',ace:!!document.querySelector('#ahi'),over:/WINS/.test((document.querySelector('.status')||{}).textContent||'')}));
      if(st.over)break;if(st.ace){await click('#ahi');continue;}
      if(/^YOUR TURN/.test(st.s)){myTurns++;const played=await p.evaluate(()=>{const c=document.querySelector('#hand .card.ok')||document.querySelector('#table .card.back.ok');if(!c)return false;c.click();return true;});
        await sleep(80);if(!(await click('#pl:not([disabled])')))await click('#pu:not([disabled])');}}
    logLen=await p.$$eval('.log div',es=>es.length);assert.ok(myTurns>=1,'human got turns');assert.ok(logLen>=5,'bots played (log '+logLen+')');
    await p.screenshot({path:SHOTS+'/ui-7-bots-ingame.png',fullPage:true});
    assert.deepEqual(errors,[]);}finally{await b.close();srv.shutdown();}});
