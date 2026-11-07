const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(v,max=100)=>typeof v==='string'&&v.trim()&&v.trim().length<=max?v.trim():fail('Please check the entered text.');
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function signature(payload,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function host(req,env){if(env.HOST_OPEN==='true')return true;if(!env.HOST_PASSCODE)return false;const value=req.headers.get('Cookie')?.match(/(?:^|;\s*)moonrock_host=([^;]+)/)?.[1];if(!value)return false;const [expiry,sig]=value.split('.');return /^\d+$/.test(expiry)&&Number(expiry)>Date.now()&&sig===await signature(expiry,env.HOST_PASSCODE);}
async function body(req){if(Number(req.headers.get('Content-Length'))>65536)fail('Request too large.',413);const raw=await req.text();if(raw.length>65536)fail('Request too large.',413);try{return JSON.parse(raw)}catch{fail('Invalid request.')}}
function validateMenu(value){if(!Array.isArray(value)||!value.length||value.length>8)fail('Use between 1 and 8 sections.');const allIds=new Set();return value.map((section,index)=>{if(!Array.isArray(section.items)||!section.items.length||section.items.length>50)fail('Each section needs 1–50 items.');return{id:`section-${index+1}`,title:text(section.title,60),zh:typeof section.zh==='string'?section.zh.trim().slice(0,60):'',items:section.items.map((item,i)=>{const id=`section-${index+1}-item-${i+1}`;allIds.add(id);const options=Array.isArray(item.options)?item.options:[];if(options.length>12)fail('Use at most 12 choices per item.');return{id,en:text(item.en,100),zh:typeof item.zh==='string'?item.zh.trim().slice(0,100):'',options:options.map((o,j)=>({id:`option-${j+1}`,en:text(o.en,80),zh:typeof o.zh==='string'?o.zh.trim().slice(0,80):''}))}})}})}
async function active(env){return env.DB.prepare("SELECT r.id,r.title,r.menu_id,m.sections,m.title AS menu_title FROM rounds r JOIN menus m ON m.id=r.menu_id WHERE r.status='active'").first()}
export default {async fetch(req,env){const url=new URL(req.url),path=url.pathname;
try{
 if(path==='/back'||path==='/back/'){const response=await env.ASSETS.fetch(req);const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers})}
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(!env.DB)return json({error:'Ordering is not available yet.'},503);
 if(req.method!=='GET'&&!path.startsWith('/api/iot/')&&req.headers.get('Origin')!==url.origin)fail('Please submit from the café website.',403);
 if(path==='/api/menu'&&req.method==='GET'){const round=await active(env);if(!round)fail('Ordering is closed for now.',409);return json({roundId:round.id,roundTitle:round.title,menuId:round.menu_id,menuTitle:round.menu_title,sections:JSON.parse(round.sections)})}
 if(path==='/api/orders'&&req.method==='POST'){
  const b=await body(req),name=text(b.name,60),requestId=text(b.requestId,100);if(!/^[\w-]{16,100}$/.test(requestId))fail('Invalid order reference.');if(b.note!==undefined&&typeof b.note!=='string')fail('Check your order note.');const note=(b.note||'').trim();if(note.length>500)fail('Order notes must be 500 characters or fewer.');
  const round=await active(env);if(!round||round.id!==b.roundId)fail('The host started a new menu or order round. Refresh the menu before ordering.',409);
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>50)fail('Choose at least one item.');
  const catalog=JSON.parse(round.sections).flatMap(s=>s.items),keys=new Set();let total=0;
  const items=b.items.map(row=>{const item=catalog.find(i=>i.id===row.itemId);if(!item)fail('An item is no longer available.',409);const option=item.options.find(o=>o.id===row.optionId);if(item.options.length&&!option)fail(`Choose an option for ${item.en}.`);if(!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>20)fail('Use quantities from 1 to 20.');const key=item.id+':'+(option?.id||'');if(keys.has(key))fail('Duplicate item.');keys.add(key);total+=row.quantity;return{itemId:item.id,optionId:option?.id||'',en:item.en,zh:item.zh,option:option?.en||'',optionZh:option?.zh||'',quantity:row.quantity}});
  if(total>100)fail('Please keep each order to 100 items or fewer.');
  const prior=await env.DB.prepare('SELECT id,guest_name,items,round_id,note FROM orders WHERE request_id=?').bind(requestId).first();if(prior){if(prior.guest_name!==name||prior.items!==JSON.stringify(items)||prior.round_id!==round.id||prior.note!==note)fail('This order reference has already been used.',409);return json({id:prior.id})}
  const id=crypto.randomUUID();const result=await env.DB.prepare("INSERT INTO orders(id,request_id,round_id,guest_name,items,note) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM rounds WHERE id=? AND status='active') ON CONFLICT(request_id) DO NOTHING").bind(id,requestId,round.id,name,JSON.stringify(items),note,round.id).run();
  if(!result.meta.changes){const existing=await env.DB.prepare('SELECT id FROM orders WHERE request_id=?').bind(requestId).first();if(existing)return json({id:existing.id});fail('This order round has closed. Refresh the menu.',409)}
  return json({id},201)
 }
 if(path==='/api/iot/orders'&&req.method==='GET'){
  try{await env.DB.prepare('CREATE TABLE IF NOT EXISTS iot_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)').run()}catch{}
  const latest=await env.DB.prepare('SELECT id, created_at, guest_name FROM orders ORDER BY created_at DESC, rowid DESC LIMIT 1').first();
  const rows=(await env.DB.prepare('SELECT key, value FROM iot_settings').all()).results||[];
  const settings={lights:true,r2d2:true,chime:true};
  for(const r of rows){if(r.key in settings)settings[r.key]=r.value==='1'||r.value==='true'};
  return json({ok:true,latest:latest||null,settings})
 }
 if(path==='/api/iot/settings'&&(req.method==='POST'||req.method==='GET')){
  try{await env.DB.prepare('CREATE TABLE IF NOT EXISTS iot_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)').run()}catch{}
  if(req.method==='POST'){
   const b=await body(req);
   for(const k of ['lights','r2d2','chime']){
    if(typeof b[k]==='boolean'||typeof b[k]==='string'){
     const val=b[k]===true||b[k]==='true'||b[k]==='1'?'1':'0';
     await env.DB.prepare('INSERT INTO iot_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=?').bind(k,val,val).run();
    }
   }
  }
  const rows=(await env.DB.prepare('SELECT key, value FROM iot_settings').all()).results||[];
  const settings={lights:true,r2d2:true,chime:true};
  for(const r of rows){if(r.key in settings)settings[r.key]=r.value==='1'||r.value==='true'};
  return json({ok:true,settings})
 }
 if(path==='/api/back/login'&&req.method==='POST'){
  if(env.HOST_OPEN==='true')return json({ok:true});if(!env.HOST_PASSCODE)fail('Host access has not been configured.',503);
  const key=await sha(req.headers.get('CF-Connecting-IP')||'local'),window=Math.floor(Date.now()/900000);const attempt=await env.DB.prepare('SELECT count,window FROM login_attempts WHERE key=?').bind(key).first();if(attempt&&attempt.window===window&&attempt.count>=10)fail('Too many attempts. Try again in 15 minutes.',429);
  const b=await body(req);await env.DB.prepare('INSERT INTO login_attempts(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=? THEN count+1 ELSE 1 END,window=?').bind(key,window,window,window).run();
  if(typeof b.passcode!=='string'||await sha(b.passcode)!==await sha(env.HOST_PASSCODE))fail('Incorrect host passcode.',401);
  await env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();const expiry=String(Date.now()+86400000);return json({ok:true},200,{'Set-Cookie':`moonrock_host=${expiry}.${await signature(expiry,env.HOST_PASSCODE)}; Path=/api/back; HttpOnly; ${url.protocol==='https:'?'Secure; ':''}SameSite=Strict; Max-Age=86400`})
 }
 if(!path.startsWith('/api/back'))fail('Not found.',404);if(!await host(req,env))fail('Enter the host passcode.',401);
 if(path==='/api/back/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':`moonrock_host=; Path=/api/back; HttpOnly; ${url.protocol==='https:'?'Secure; ':''}SameSite=Strict; Max-Age=0`});
 if(path==='/api/back'&&req.method==='GET'){
  const current=await active(env);const rounds=(await env.DB.prepare('SELECT r.*,m.title AS menu_title,(SELECT COUNT(*) FROM orders o WHERE o.round_id=r.id) AS order_count FROM rounds r JOIN menus m ON m.id=r.menu_id ORDER BY r.created_at DESC,r.rowid DESC').all()).results;
  const selected=url.searchParams.get('round')||current?.id||rounds[0]?.id;const selectedRound=rounds.find(r=>r.id===selected);if(selected&&!selectedRound)fail('Order round not found.',404);
  const menus=(await env.DB.prepare('SELECT * FROM menus ORDER BY created_at DESC,rowid DESC').all()).results.map(m=>({...m,sections:JSON.parse(m.sections)}));
  const orders=selected?(await env.DB.prepare('SELECT id,round_id,guest_name,items,note,fulfilled_items,completed,created_at FROM orders WHERE round_id=? ORDER BY created_at DESC,rowid DESC').bind(selected).all()).results.map(o=>({...o,items:JSON.parse(o.items),fulfilledItems:JSON.parse(o.fulfilled_items||'[]'),completed:!!o.completed})):[];
  const totals=new Map();for(const o of orders)for(const [index,item] of o.items.entries()){const key=item.itemId+':'+item.optionId;const prev=totals.get(key);totals.set(key,{...item,quantity:(prev?.quantity||0)+item.quantity,sent:(prev?.sent||0)+(o.fulfilledItems.includes(index)?item.quantity:0)})}
  const rows=(await env.DB.prepare('SELECT key, value FROM iot_settings').all().catch(()=>({results:[]})))?.results||[];
  const settings={lights:true,r2d2:true,chime:true};
  for(const r of rows){if(r.key in settings)settings[r.key]=r.value==='1'||r.value==='true'};
  return json({activeRoundId:current?.id||null,selectedRound,rounds,menus,orders,totals:[...totals.values()],settings})
 }
 if(path==='/api/back/delete-order'&&req.method==='POST'){const b=await body(req);await env.DB.prepare('DELETE FROM orders WHERE id=?').bind(text(b.id)).run();return json({ok:true})}
 if(path==='/api/back/fulfillment'&&req.method==='POST'){
  const b=await body(req),id=text(b.id),order=await env.DB.prepare('SELECT items FROM orders WHERE id=?').bind(id).first();if(!order)fail('Order not found.',404);
  if(!Array.isArray(b.fulfilledItems))fail('Check the selected order items.');const itemCount=JSON.parse(order.items).length,indices=[...new Set(b.fulfilledItems)];if(indices.some(index=>!Number.isInteger(index)||index<0||index>=itemCount))fail('Check the selected order items.');
  const completed=indices.length===itemCount?1:0;await env.DB.prepare('UPDATE orders SET fulfilled_items=?,completed=? WHERE id=?').bind(JSON.stringify(indices),completed,id).run();return json({ok:true})
 }
 if(path==='/api/back/reset'&&req.method==='POST'){const b=await body(req);if(!await env.DB.prepare('SELECT id FROM rounds WHERE id=?').bind(text(b.roundId)).first())fail('Round not found.',404);await env.DB.prepare('DELETE FROM orders WHERE round_id=?').bind(b.roundId).run();return json({ok:true})}
 if(path==='/api/back/close'&&req.method==='POST'){const b=await body(req),current=await active(env);if(!current||current.id!==b.roundId)fail('No active gathering to end.',404);await env.DB.prepare("UPDATE rounds SET status='archived' WHERE id=? AND status='active'").bind(current.id).run();return json({ok:true})}
 if(path==='/api/back/menus'&&req.method==='POST'){const b=await body(req),id=crypto.randomUUID(),sections=validateMenu(b.sections);await env.DB.prepare('INSERT INTO menus(id,title,sections) VALUES(?,?,?)').bind(id,text(b.title,100),JSON.stringify(sections)).run();return json({id},201)}
 if(path==='/api/back/menu-update'&&req.method==='POST'){const b=await body(req),id=text(b.id),title=text(b.title,100),sections=validateMenu(b.sections),result=await env.DB.prepare('UPDATE menus SET title=?,sections=? WHERE id=?').bind(title,JSON.stringify(sections),id).run();if(!result.meta.changes)fail('Menu not found.',404);return json({id})}
 if(path==='/api/back/menu-archive'&&req.method==='POST'){const b=await body(req);if((await active(env))?.menu_id===b.id)fail('The current menu can be archived after starting a different menu.',409);await env.DB.prepare('UPDATE menus SET archived=? WHERE id=?').bind(b.archived?1:0,text(b.id)).run();return json({ok:true})}
 if(path==='/api/back/start'&&req.method==='POST'){
  const b=await body(req),current=await active(env);if(current&&current.id!==b.expectedRoundId)fail('The active round changed. Refresh and try again.',409);
  const menu=await env.DB.prepare('SELECT id FROM menus WHERE id=? AND archived=0').bind(text(b.menuId)).first();if(!menu)fail('Choose an available menu.');
  const id=crypto.randomUUID(),title=text(b.title,100);const stmts=[env.DB.prepare("INSERT INTO rounds(id,menu_id,title,status) SELECT ?,?,?,'active' WHERE NOT EXISTS (SELECT 1 FROM rounds WHERE status='active')").bind(id,menu.id,title)];if(current)stmts.unshift(env.DB.prepare("UPDATE rounds SET status='archived' WHERE id=? AND status='active'").bind(current.id));const results=await env.DB.batch(stmts);const inserted=current?results[1]:results[0];if(!inserted.meta.changes)fail('Another round was just started. Refresh and try again.',409);return json({id},201)
 }
 fail('Not found.',404)
}catch(error){console.error(error.status?error.message:'Request failed');return json({error:error.status?error.message:'Something went wrong. Please try again.'},error.status||500)}
}};
