#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
const base='https://takoitalia.com/staff/';
const directory=resolve('docs/webapp/activation/evidence');await mkdir(directory,{recursive:true});
const privateDirectory=resolve(homedir(),'.config/tako-webapp');
const adminText=await readFile(resolve(privateDirectory,'agency-cattolico-credenziali.txt'),'utf8');
const admin={email:adminText.match(/^Email:\s*(.+)$/m)?.[1],password:adminText.match(/^Password iniziale:\s*(.+)$/m)?.[1]};
const owner=JSON.parse(await readFile(resolve(privateDirectory,'qa-login.json'),'utf8'));
assert.ok(admin.email&&admin.password&&owner.email&&owner.password,'Private credentials required');
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const [kind,credentials] of [['admin',admin],['owner',owner]]){
  const context=await browser.createBrowserContext();const page=await context.newPage();
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.name));
  await page.goto(base,{waitUntil:'networkidle2',timeout:90000});
  await page.waitForSelector('input[type="email"]',{timeout:60000});
  await page.type('input[type="email"]',credentials.email);await page.type('input[type="password"]',credentials.password);
  const loginResponse=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/auth/login'),{timeout:60000}),page.click('form button[type="submit"]')]).then(values=>values[0]);
  let loginCode;try{loginCode=(await loginResponse.json()).error?.code}catch{}
  assert.equal(loginResponse.status(),200,JSON.stringify({kind,stage:'login',status:loginResponse.status(),errorCode:loginCode}));
  await page.waitForFunction(()=>window.__takoRestaurantId&&document.querySelector('.bb-tab'),{timeout:90000});
  const identity=await page.evaluate(async()=>{const response=await fetch('/api/auth/me',{credentials:'include'});const body=await response.json();return {status:response.status,agency:body.data?.agency===true,role:body.data?.role,errorCode:body.error?.code};});
  assert.equal(identity.status,200,JSON.stringify({kind,stage:'identity',...identity}));assert.equal(identity.agency,kind==='admin');
  const api=await page.evaluate(async()=>{const response=await fetch('/api/agency/restaurants',{credentials:'include'});const body=await response.json();return {status:response.status,count:Array.isArray(body.data)?body.data.length:null,errorCode:body.error?.code};});
  assert.equal(api.status,kind==='admin'?200:403,JSON.stringify({kind,stage:'agency',...api}));
  if(kind==='admin'){
   assert.ok(api.count>=18);
   await page.evaluate(()=>[...document.querySelectorAll('.bb-tab')].find(button=>button.textContent.includes('Locali'))?.click());
   await page.waitForSelector('.agency-location',{timeout:90000});
   assert.ok(await page.$$eval('.agency-location',elements=>elements.length>=18));
  }else{
   await page.evaluate(()=>[...document.querySelectorAll('.bb-tab')].find(button=>button.textContent.trim()==='Menu')?.click());
   await page.waitForSelector('nav[aria-label="Editor menu"]',{timeout:90000});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:resolve(directory,`cloud-${kind}-mobile.png`),fullPage:true});
  const cookies=await page.cookies();assert.ok(cookies.some(cookie=>cookie.httpOnly&&cookie.secure),'Secure session cookie required');
  assert.deepEqual(errors,[]);
  results.push({kind,login:true,identity:identity.status,agencyAccess:api.status,count:api.count,mobileOverflow:false,secureHttpOnlySession:true});
  await context.close();
 }
 await writeFile(resolve(directory,'cloud-dashboard-mobile.json'),JSON.stringify({base,results},null,2));
 console.log(JSON.stringify({results}));
}finally{
 const process=browser.process();
 await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,5000))]);
 if(process&&process.exitCode===null)process.kill('SIGTERM');
 browser.disconnect();
}
