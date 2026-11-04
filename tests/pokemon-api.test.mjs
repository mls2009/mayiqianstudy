import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {handleAdventure as handle} from '../pokemon-api.mjs';
function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE records(id TEXT PRIMARY KEY,user_id TEXT,behavior_name TEXT,score INTEGER,timestamp TEXT,date TEXT,category TEXT)');return {async batch(statements){db.exec('BEGIN');try{const results=[];for(const q of statements)results.push(await q.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){let args=[];const q={bind(...a){args=a;return q;},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async first(){return db.prepare(sql).get(...args);}};return q;}};}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
const request=(method,body,user='马亦谦')=>new Request('https://example.test/api/adventure?userId='+encodeURIComponent(user),{method,...(body?{body:JSON.stringify({...body,userId:user}),headers:{'Content-Type':'application/json'}}:{})});
const envs=()=>({DB_MAYIQIAN:database(),DB_MAYICHU:database()});
async function ready(env,user='马亦谦',indices=[0,1,2,3]){assert.equal((await handle(request('POST',{action:'plan',date:today,texts:['识字','绘本','8篇英语','识字10个']},user),env)).status,200);for(const index of indices)assert.equal((await handle(request('POST',{action:'complete',date:today,index},user),env)).status,200);}
const claim=(env,group,choice,user='马亦谦')=>handle(request('POST',{action:'encounter',date:today,group,choice},user),env);
const state=async(env,user='马亦谦')=>(await handle(request('GET',null,user),env)).json();
test('两个账号都遵守每组一次互斥，领取一组不锁另一组，两数据库互不影响',async()=>{
 const env=envs();
 for(const user of ['马亦谦','马熠初']){
  await ready(env,user);assert.equal((await claim(env,'literacy','master',user)).status,200);
  assert.equal((await claim(env,'literacy','required',user)).status,400);
  assert.equal((await claim(env,'literacy','extra-normal',user)).status,400);
  assert.equal((await claim(env,'english','extra-normal',user)).status,200);
  const s=await state(env,user);assert.equal(s.days[today].encounters.length,3);assert.equal(s.days[today].claims.literacy.count,1);assert.equal(s.days[today].claims.english.count,2);
  assert.equal((await claim(env,'english','master',user)).status,400);
  if(user==='马亦谦')assert.deepEqual((await state(env,'马熠初')).days,{});
 }
});
test('同一组并发领取两个普通球与大师球，只成功一个方案，不会只入库第一个普通球',async()=>{
 const env=envs();await ready(env);
 const results=await Promise.all(['master','extra-normal'].map(choice=>claim(env,'english',choice)));
 assert.equal(results.filter(r=>r.status===200).length,1);
 const s=await state(env),receipt=s.days[today].claims.english;
 assert.equal(s.days[today].encounters.length,receipt.choice==='master'?1:2);
 assert.equal((await claim(env,'english','required')).status,400);
 assert.equal((await claim(env,'literacy','required')).status,200);
});
test('领必选后对应可选不能补领，另一个必选仍可单独领取',async()=>{
 const env=envs();await ready(env,'马亦谦',[0,1]);
 assert.equal((await claim(env,'literacy','required')).status,200);
 assert.equal((await handle(request('POST',{action:'complete',date:today,index:3}),env)).status,400);
 assert.equal((await claim(env,'literacy','master')).status,400);assert.equal((await claim(env,'english','required')).status,200);
 assert.equal((await state(env)).days[today].encounters.length,2);
});
test('拒绝未知账号、未知组、缺组的旧客户端和未完成对应任务的请求',async()=>{
 const env=envs();assert.equal((await handle(request('GET',null,'甲'),env)).status,400);
 assert.equal((await handle(request('GET'),{DB:database()})).status,400);
 assert.equal((await handle(request('POST',{action:'complete',date:'2099-01-01',index:0}),env)).status,400);
 await ready(env,'马亦谦',[0]);assert.equal((await claim(env,'literacy','master')).status,400);assert.equal((await claim(env,'english','required')).status,400);
 assert.equal((await claim(env,'other','required')).status,400);
 assert.equal((await handle(request('POST',{action:'encounter',date:today,ball:'normal'}),env)).status,400);
});
test('无需填写计划即可通过API确认固定任务，客户端不能替换学习内容',async()=>{
 const env=envs();
 const r=await handle(request('POST',{action:'complete',date:today,index:1,text:'任意内容'}),env);
 assert.equal(r.status,200);
 assert.equal((await r.json()).days[today].tasks[1].text,'完成4篇英语作业');
 assert.equal((await claim(env,'english','required')).status,200);
 assert.equal((await claim(env,'english','required')).status,400);
});

test('购买原子扣积分发石头，重复请求不重复扣，余额不足和另一个账号均不受影响',async()=>{
 const env=envs();await env.DB_MAYIQIAN.prepare("INSERT INTO records(id,user_id,score) VALUES ('initial','马亦谦',15)").run();
 const buy=(id,user='马亦谦')=>handle(request('POST',{action:'buy',date:today,type:'电',operationId:id},user),env);
 assert.equal((await buy('purchase1')).status,200);
 let s=await state(env);assert.equal(s._balance,5);assert.equal(s.stones['电'],1);
 assert.equal((await buy('purchase1')).status,400);assert.equal((await buy('purchase2')).status,409);
 assert.equal((await buy('purchase3','马熠初')).status,409);
 s=await state(env);assert.equal(s._balance,5);assert.equal(s.stones['电'],1);
 assert.equal((await env.DB_MAYIQIAN.prepare("SELECT COUNT(*) AS n FROM records WHERE behavior_name='宝可梦商店购买雷进化石' AND score=-10").first()).n,1);
});
test('扣分写入失败时整笔购买回滚，不发石头也不扣积分',async()=>{
 const env=envs();await env.DB_MAYIQIAN.prepare("INSERT INTO records(id,user_id,score) VALUES ('initial','马亦谦',15)").run();
 await env.DB_MAYIQIAN.prepare("CREATE TRIGGER reject_purchase BEFORE INSERT ON records WHEN NEW.score=-10 BEGIN SELECT RAISE(ABORT,'test failure'); END").run();
 await assert.rejects(handle(request('POST',{action:'buy',date:today,type:'电',operationId:'rollback1'}),env));
 const s=await state(env);assert.equal(s._balance,15);assert.equal(s.stones?.['电']||0,0);
});
test('两账号数学可选翻倍领大师球，数学与识字英语互不锁定',async()=>{
 const env=envs();
 for(const user of ['马亦谦','马熠初']){
  for(const index of [4,5])assert.equal((await handle(request('POST',{action:'complete',date:today,index},user),env)).status,200);
  assert.equal((await claim(env,'math','master',user)).status,200);
  assert.equal((await claim(env,'math','extra-normal',user)).status,400);
  assert.equal((await handle(request('POST',{action:'complete',date:today,index:0},user),env)).status,200);
  assert.equal((await claim(env,'literacy','required',user)).status,200);
  const s=await state(env,user);assert.equal(s.days[today].claims.math.count,1);assert.equal(s.days[today].encounters.length,2);
 }
});
