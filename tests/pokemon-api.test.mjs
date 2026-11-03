import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {handleAdventure as handle} from '../pokemon-api.mjs';
function database(){const db=new DatabaseSync(':memory:');return {prepare(sql){let args=[];const q={bind(...a){args=a;return q;},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async first(){return db.prepare(sql).get(...args);}};return q;}};}
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
