import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';import worker from '../worker.js';
function db(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return {prepare(sql){let args=[];const q={bind(...a){args=a;return q;},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async first(){return db.prepare(sql).get(...args);},async all(){return {results:db.prepare(sql).all(...args)};}};return q;}};}
const req=(method,user,body)=>new Request('https://example.test/api/records?userId='+encodeURIComponent(user),{method,...(body?{body:JSON.stringify({...body,userId:user}),headers:{'content-type':'application/json'}}:{})});
test('行为打分也使用两个物理数据库；清空一方不会影响另一方',async()=>{
 const env={DB_MAYIQIAN:db(),DB_MAYICHU:db(),DB:{prepare(){throw Error('不应访问旧共享数据库');}}};
 for(const user of ['马亦谦','马熠初'])assert.equal((await worker.fetch(req('POST',user,{behaviorName:'隔离测试',score:1,date:'2026-11-03',timestamp:new Date().toISOString()}),env)).status,200);
 for(const user of ['马亦谦','马熠初']){const rows=await(await worker.fetch(req('GET',user),env)).json();assert.equal(rows.length,1);assert.equal(rows[0].user_id,user);}
 const clear=new Request('https://example.test/api/records/clear',{method:'POST',body:JSON.stringify({userId:'马亦谦'})});
 assert.equal((await worker.fetch(clear,env)).status,200);
 assert.equal((await(await worker.fetch(req('GET','马亦谦'),env)).json()).length,0);
 assert.equal((await(await worker.fetch(req('GET','马熠初'),env)).json()).length,1);
});
