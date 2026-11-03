const C=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(e)e.click();return !!e},s);
const pp=require('puppeteer-core');const U=process.argv[2]||'http://localhost:8787';
(async()=>{const b=await pp.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const ic=await b.newPage();for(const s of[192,512]){await ic.setViewport({width:s,height:s});await ic.goto('file://'+__dirname+'/public/icon.svg');await ic.screenshot({path:`public/icon-${s}.png`,omitBackground:true});}
 const ctx=[];const pages=[];for(let i=0;i<4;i++){const c=await b.createBrowserContext();const p=await c.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto(U);pages.push(p);}
 const [A,...R]=pages;const nm=['Bryan','Aubrey','Mom','Jake'];
 await A.type('#nm',nm[0]);await A.screenshot({path:'shots/1-home.png'});await C(A,'#new');await A.waitForSelector('.code');
 const code=await A.$eval('.code',e=>e.textContent);
 for(let i=0;i<3;i++){const p=R[i];await p.type('#nm',nm[i+1]);await p.type('#cd',code);await C(p,'#join');await p.waitForSelector('.code');}
 await new Promise(r=>setTimeout(r,500));await C(A,'#ob');await new Promise(r=>setTimeout(r,300));await A.screenshot({path:'shots/2-lobby-host.png',fullPage:true});
 await R[0].screenshot({path:'shots/3-lobby-guest.png'});
 await C(A,'#go');await A.waitForSelector('#rdy');await A.screenshot({path:'shots/4-swap.png',fullPage:true});
 for(const p of pages){await C(p,'#rdy');await new Promise(r=>setTimeout(r,150));};await new Promise(r=>setTimeout(r,500));
 for(let k=0;k<6;k++)for(const p of pages){const ok=await p.$('#hand .card.ok, #table .card.ok');const my=await p.$eval('.status',e=>e.textContent);
   if(!my.startsWith('YOUR'))continue;if(ok){await p.evaluate(()=>document.querySelector('#hand .card.ok, #table .card.ok').click());await new Promise(r=>setTimeout(r,100));if(k<5)await p.evaluate(()=>{const b=document.querySelector('#pl:not([disabled])')||document.querySelector('#ph');if(b)b.click()});}else await C(p,'#pu:not([disabled])');await new Promise(r=>setTimeout(r,300));}
 for(let i=0;i<4;i++)await pages[i].screenshot({path:`shots/5-play-${nm[i]}.png`,fullPage:true});
 await C(A,'#rb');await A.screenshot({path:'shots/6-rules.png',fullPage:true});await b.close();})();
