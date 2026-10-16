import {createRequire} from 'node:module';
import {startHarness,fixture,ROOT} from './harness.mjs';
const puppeteer=createRequire(ROOT+'/package.json')('puppeteer-core');
const OUT=process.argv[2];
const h=await startHarness(fixture());
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--mute-audio','--hide-scrollbars']});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewport({width:1280,height:800});await page.goto(h.origin);await page.waitForSelector('.mw-studio-toolbar',{timeout:15000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,800));await page.screenshot({path:OUT+'/smoke-1.png'});
 await page.click('.mw-dp-btn').catch(e=>errors.push('click '+e.message));await new Promise(r=>setTimeout(r,800));await page.screenshot({path:OUT+'/smoke-2.png'});
 console.log(JSON.stringify(errors.slice(0,10),null,1));
}finally{await browser.close();await h.close();}
