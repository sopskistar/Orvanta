import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { renderTestimonials, syntheticReview } from './testimonial-fixture.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.QA_URL || 'http://127.0.0.1:3000';
const dir='artifacts/qa'; await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const routes=['/','/services/','/demo/','/contact/','/privacy/'];
const sizes=[['desktop',1440,1000],['tablet',768,1024],['mobile',375,812]];
const report={base,checks:[],consoleErrors:[],links:[],viewports:[]};
const check=(name,condition)=>{assert.ok(condition,name);report.checks.push(name);};
try {
 const urls=new Set();
 for(const [device,width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',isMobile:device==='mobile',hasTouch:device==='mobile'});
  const page=await context.newPage();page.on('pageerror',e=>report.consoleErrors.push(e.message));
  for(const route of routes){
   const response=await page.goto(base+route,{waitUntil:'networkidle'});check(`${device} ${route} HTTP 200`,response.status()===200);await page.evaluate(()=>document.fonts.ready);
   if(route==='/demo/')await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
   check(`${device} ${route} simplified demo copy`,!/fictional|browser demonstration|edited excerpts from an actual test call|this demonstration captures an enquiry|sample home cleaning/i.test(await page.locator('body').innerText()));
   if(route==='/'){
    check(`${device} service scenarios section is visible`,await page.locator('.testimonials-section').count()===1);
    check(`${device} four explicitly illustrative scenarios`,await page.locator('.service-scenario').count()===4&&await page.locator('.testimonials-section').innerText().then(text=>text.includes('Illustrative service scenarios, not customer testimonials or measured results.')));
    check(`${device} How Orvanta works has four steps`,await page.locator('.pilot-section h2').innerText()==='How Orvanta works'&&await page.locator('.pilot-list li').count()===4);
   }
   check(`${device} ${route} production canonical URL`,await page.locator('link[rel="canonical"]').getAttribute('href')===`https://getorvanta.xyz${route}`);
   check(`${device} ${route} Open Graph production URL`,await page.locator('meta[property="og:url"]').getAttribute('content')===`https://getorvanta.xyz${route}`);
   check(`${device} ${route} sharing image URL`,await page.locator('meta[name="twitter:image"]').getAttribute('content')==='https://getorvanta.xyz/brand/social-preview.png');
   if(route==='/demo/')check(`${device} simple demo heading`,await page.locator('h1').innerText()==='Mia — cleaning enquiry demo');
   check(`${device} ${route} one h1`,await page.locator('h1').count()===1);
   check(`${device} ${route} no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`${device} ${route} all images loaded`,await page.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)));
   const name=route==='/'?'home':route.replaceAll('/','');
   await page.screenshot({path:`${dir}/${name}-${device}.png`,fullPage:true});
   report.viewports.push({route,device,width,height});
   for(const href of await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href'))))urls.add(href);
  }
  if(device==='mobile'){
   await page.goto(base);const menu=page.locator('.menu-toggle');await menu.click();check('Mobile menu expands',await menu.getAttribute('aria-expanded')==='true');await page.screenshot({path:`${dir}/mobile-menu.png`});await page.keyboard.press('Escape');check('Escape closes menu and restores focus',await menu.getAttribute('aria-expanded')==='false'&&await menu.evaluate(el=>el===document.activeElement));
   await menu.click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'The demo',exact:true}).click();await page.waitForURL('**/demo/');check('Mobile menu navigation closes',await page.getByRole('button',{name:'Menu'}).getAttribute('aria-expanded')==='false');
  }
  await context.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${dir}/home-1280.png`});
 check('Hero headline and primary action fit 1280×800',await page.locator('.home-hero h1').evaluate(e=>e.getBoundingClientRect().bottom<800)&&await page.getByRole('link',{name:'Watch the demo',exact:true}).first().evaluate(e=>e.getBoundingClientRect().bottom<800));
 await page.keyboard.press('Tab');check('Skip link receives keyboard focus',await page.locator('.skip-link').evaluate(e=>e===document.activeElement));
 check('Focus indicator is visible',await page.locator('.skip-link').evaluate(e=>getComputedStyle(e).outlineStyle==='solid'&&parseFloat(getComputedStyle(e).outlineWidth)>=3));
 await page.keyboard.press('Enter');check('Skip link targets main content',await page.locator('main').evaluate(e=>e===document.activeElement));
 check('Reduced motion disables entrance',await page.locator('h1').evaluate(e=>getComputedStyle(e).animationName==='none'));
 await page.goto(base+'/demo/');const video=page.locator('video');
 check('Native video configured correctly',await video.evaluate(v=>v.controls&&v.preload==='metadata'&&v.playsInline&&!v.autoplay));
 await video.evaluate(async v=>{await v.play();});await page.waitForFunction(()=>document.querySelector('video').currentTime>0.3);
 check('Video decodes and plays',await video.evaluate(v=>v.videoWidth===1920&&v.currentTime>0.3&&!v.error));
 await video.evaluate(v=>{v.pause();v.currentTime=85;});await page.waitForFunction(()=>document.querySelector('video').currentTime>=85&&document.querySelector('video').readyState>=2);check('Video seeks to enquiry-record segment',await video.evaluate(v=>v.currentTime>=85));
 await page.screenshot({path:`${dir}/demo-playing.png`});
 await page.route('**/demo/Orvanta_Receptionist_Demo.mp4',route=>route.abort());await page.goto(base+'/demo/');await page.locator('.video-error').waitFor();check('Video load failure offers recovery',await page.locator('.video-error').getByRole('link',{name:'Try opening the MP4 directly'}).isVisible());await page.unroute('**/demo/Orvanta_Receptionist_Demo.mp4');
 const media=await page.request.get(base+'/demo/Orvanta_Receptionist_Demo.mp4',{headers:{Range:'bytes=0-99'}});check('Video byte ranges supported',media.status()===206&&(await media.body()).length===100);
 await page.goto(base+'/contact/');check('Contact points to supplied email',await page.getByRole('link',{name:'Email Orvanta'}).getAttribute('href').then(v=>v.startsWith('mailto:julianahonour@gmail.com')));check('No pretend contact form',await page.locator('form').count()===0);
 for(const href of urls){
  if(href.startsWith('mailto:')){report.links.push({href,status:'email link checked; no email sent'});continue;}
  if(!href.startsWith('/')&&!href.startsWith('#'))continue;
  const [path,hash]=href.split('#');
  if(path){const r=await page.request.get(base+path);check(`Link ${href} resolves`,r.ok());}
  if(hash&&path){await page.goto(base+path);check(`Anchor ${href} exists`,await page.locator(`[id="${hash}"]`).count()>0);}
  report.links.push({href,status:'ok'});
 }
 const notFound=await page.goto(base+'/this-page-does-not-exist/');check('Custom 404 status and navigation',notFound.status()===404&&await page.getByRole('link',{name:'Back to home'}).isVisible());
 for(const width of [320,390,600,1024,1920]){await page.setViewportSize({width,height:1000});for(const route of routes){await page.goto(base+route);check(`${width}px ${route} no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}}
 check('No browser runtime errors',report.consoleErrors.length===0);
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});const plain=await nojs.newPage();await plain.goto(base);check('Content and footer navigation available without JavaScript',await plain.locator('h1').isVisible()&&await plain.getByRole('navigation',{name:'Footer navigation'}).getByRole('link',{name:'Contact',exact:true}).isVisible());await nojs.close();
 // Verify every authored opaque text/background role and interaction colour.
 function lum(hex){const a=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];}
 report.contrast=[];
 for(const [fg,bg,role] of [['#f3f6fb','#08111f','navy text'],['#b7c9d5','#08111f','navy secondary'],['#f3f6fb','#142b42','raised text'],['#b7c9d5','#142b42','raised secondary'],['#79dac3','#142b42','mint links'],['#79dac3','#08111f','navy hover/focus'],['#08111f','#79dac3','button'],['#08111f','#a4e8d7','button hover'],['#08111f','#65c7af','button active'],['#08111f','#f7f7f2','light text/focus'],['#465664','#f7f7f2','light secondary']]){const [a,b]=[lum(fg),lum(bg)].sort((x,y)=>y-x);const ratio=(a+.05)/(b+.05);check(`Contrast ${role} >=4.5:1`,ratio>=4.5);report.contrast.push({fg,bg,role,ratio:Math.round(ratio*100)/100});}
 const fixtureCss=(await Promise.all(['tokens.css','base.css','globals.css'].map(file=>fs.readFile(`src/app/${file}`,'utf8')))).join('\n').replace(/@import[^;]+;/g,'');
 for(const [device,width,height] of sizes){await page.setViewportSize({width,height});await page.setContent(`<html lang="en"><head><base href="${base}/"><style>${fixtureCss}</style></head><body><p>Local synthetic layout check — never published</p>${renderTestimonials([syntheticReview,{...syntheticReview,id:'second-synthetic-fixture'}])}</body></html>`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);check(`${device} synthetic testimonial layout has no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check(`${device} synthetic testimonials have correct column count`,await page.locator('.testimonial-list').evaluate((e,expected)=>getComputedStyle(e).gridTemplateColumns.split(' ').length===expected,width<=760?1:2));await page.screenshot({path:`${dir}/testimonials-synthetic-${device}.png`,fullPage:true});}
 const html=await fs.readFile('out/index.html','utf8');check('No synthetic review data in production HTML',!/Synthetic QA fixture|Local rendering test|Not a customer/.test(html));
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(`${report.checks.length} checks passed; ${report.viewports.length} page captures; ${report.links.length} distinct links. See ${dir}/report.json`);
} finally {await browser.close();}
