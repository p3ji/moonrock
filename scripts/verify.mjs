import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const url=new URL('../index.html',import.meta.url).href;
const menu=JSON.parse(readFileSync(root+'src/menu.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
const results=[];
const check=(name,value)=>{assert(value,name);results.push('PASS '+name);};
for(const width of [375,768,1440]){
 const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const p=await c.newPage();
 await p.goto(url);await p.evaluate(()=>document.fonts.ready);
 check(`${width}px: wordmark fits`,await p.locator('#hero-title').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().right<=innerWidth}));
 check(`${width}px: no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(`${width}px: reduced motion hides arrival`,await p.locator('#arrival').isHidden());
 check(`${width}px: all 13 menu items`,await p.locator('.menu-items li').count()===13);
 await p.screenshot({path:root+`qa/site-${width}.png`,fullPage:true});await c.close();
}
const c=await browser.newContext();const p=await c.newPage();let errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(url);check('first visit starts arrival',await p.locator('#arrival').isVisible());
await p.waitForTimeout(6300);check('arrival completes automatically',await p.locator('#arrival').isHidden());
await p.reload();check('same session skips arrival',await p.locator('#arrival').isHidden());
await p.locator('#replay').click();check('replay starts arrival',await p.locator('#arrival').isVisible());
await p.locator('#skip-arrival').click();check('skip focuses menu',await p.evaluate(()=>document.activeElement.id==='menu'));
await p.locator('#replay').click();await p.keyboard.press('Escape');check('Escape dismisses arrival',await p.locator('#arrival').isHidden());
const print=await c.newPage();await print.goto(new URL('../print/menu.html',import.meta.url).href);await print.evaluate(()=>document.fonts.ready);
for(const section of menu)for(const item of section.items){check(`menu consistent: ${item[0]}`,await p.locator('.menu-items').allTextContents().then(t=>t.join('').includes(item[0])) && await print.locator('.print-section').allTextContents().then(t=>t.join('').includes(item[0])));}
check('print sheet content clears footer',await print.evaluate(()=>[...document.querySelectorAll('.sheet')].every(s=>{const sections=s.querySelectorAll('.print-section,.print-note');return [...sections].every(e=>e.getBoundingClientRect().bottom<s.querySelector('footer').getBoundingClientRect().top)})));
check('no JavaScript errors',errors.length===0);await c.close();
const nojs=await browser.newContext({javaScriptEnabled:false});const np=await nojs.newPage();await np.goto(url);check('no JavaScript: complete menu visible',await np.locator('.menu-items li').count()===13&&await np.locator('#arrival').isHidden());await nojs.close();
const fail=await browser.newContext();const fp=await fail.newPage();await fp.route('**/moonrock.webp',r=>r.abort());await fp.goto(url);await fp.waitForTimeout(500);check('missing image: menu available',await fp.locator('.menu-items li').count()===13);await fp.waitForTimeout(6200);check('missing image: arrival cannot stay stuck',await fp.locator('#arrival').isHidden());await fail.close();
const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('Blocked')}})});const bp=await blocked.newPage();await bp.goto(url);await bp.locator('#skip-arrival').click();check('blocked storage: skip still works',await bp.locator('#arrival').isHidden());await blocked.close();
const slow=await browser.newContext();const sp=await slow.newPage();await sp.route('**/moonrock.webp',async r=>{await new Promise(resolve=>setTimeout(resolve,9000));try{await r.continue()}catch{}});await sp.goto(url,{waitUntil:'domcontentloaded'});check('slow image: menu in HTML immediately',await sp.locator('.menu-items li').count()===13);await sp.locator('#skip-arrival').click();check('slow image: skip does not wait',await sp.locator('#arrival').isHidden());await slow.close();
await browser.close();writeFileSync(root+'qa/results.txt',results.join('\n')+'\n');console.log(results.join('\n'));
