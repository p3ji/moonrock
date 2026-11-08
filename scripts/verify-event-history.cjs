// Creates test events and orders on the local Wrangler database only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const base='http://127.0.0.1:4191',browser=await chromium.launch();
 try{
 const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/back');await page.locator('#passcode').fill(fs.readFileSync('.dev.vars','utf8').match(/HOST_PASSCODE="([^"]+)"/)[1]);await page.locator('#login-form button').click();await page.locator('#dashboard').waitFor({state:'visible'});
 const post=(path,data)=>ctx.request.post(base+path,{headers:{Origin:base},data});
 await page.locator('#new-event').click();await page.locator('#gathering-name').fill('History test event');await page.locator('.activation-form button[type=submit]').click();await page.locator('[data-view-orders]').click();
 await page.locator('#round-title').filter({hasText:'History test event'}).waitFor();
 const menu=await(await ctx.request.get(base+'/api/menu')).json(),item=menu.sections.flatMap(s=>s.items).find(i=>!i.options.length);
 let response=await post('/api/orders',{name:'Test guest',requestId:crypto.randomUUID(),roundId:menu.roundId,items:[{itemId:item.id,quantity:2}],note:'Test note'});assert.equal(response.status(),201);const orderId=(await response.json()).id;
 await page.locator('#refresh').click();await page.locator('#orders').getByText('Test guest',{exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await page.locator('#close-round').click();await page.locator('#history-tab').waitFor({state:'visible'});
 const event=page.locator('#history-list .menu-card').filter({hasText:'History test event'}).first();assert.match(await event.innerText(),/1 order/);await event.locator('[data-history]').click();await page.locator('#history-detail').getByText('Test guest',{exact:true}).waitFor();assert.match(await page.locator('#history-detail').innerText(),/Test note/);assert.equal(await page.locator('#history-detail input,#history-detail [data-delete]').count(),0);
 assert.equal((await post('/api/back/delete-order',{id:orderId})).status(),409);assert.equal((await post('/api/back/reset',{roundId:menu.roundId})).status(),404);assert.equal((await post('/api/back/fulfillment',{id:orderId,fulfilledItems:[0]})).status(),404);
 const closed=await(await ctx.request.get(base+'/api/back')).json();assert.equal(closed.activeRoundId,null);assert.equal(closed.orders.length,0);assert.equal(closed.selectedRound,undefined);
 await page.locator('[data-tab=orders]').click();assert.equal(await page.locator('.kitchen-grid').isVisible(),false);await page.locator('#new-event').click();await page.locator('#gathering-name').fill('Next test event');await page.locator('.activation-form button[type=submit]').click();await page.locator('[data-view-orders]').click();await page.locator('#round-title').filter({hasText:'Next test event'}).waitFor();assert.equal(await page.locator('#orders .order-card').count(),0);
 await page.locator('[data-tab=orders]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#history-tab').isVisible(),true);await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#menus-tab').isVisible(),true);
 for(const width of [375,1200]){await page.setViewportSize({width,height:850});for(const tab of ['orders','history','menus']){await page.locator(`[data-tab=${tab}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tab} overflows at ${width}`)}await page.locator('[data-tab=history]').click();await page.screenshot({path:`/tmp/cafe-history-${width}.png`,fullPage:true})}
 assert.deepEqual(errors,[]);console.log('PASS event creation, isolated orders, completion, dated history, saved orders and notes, read-only history, tab keyboard navigation, mobile and desktop layouts.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
