const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../pokemon-core.js');
const date='2026-11-03';
function ready(extra=false){let s=P.setPlan(P.empty(),date,['识字故事','英语绘本','完成8篇英语作业','识字10个']);for(const i of extra?[0,1,2,3]:[0,1])s=P.complete(s,date,i,s.days[date].tasks[i].text);return s;}
const draw=(s,d,roll=0,pick=0,at,ball='normal')=>P.claim(s,d,ball==='master'?'english':'literacy',ball==='master'?'master':'required',[[roll,pick]],at);
test('默认可选内容可编辑，任一组必选独立就绪',()=>{
 assert.deepEqual(P.freshDay().tasks.slice(2,4).map(t=>t.text),['完成8篇英语作业','识字10个']);
 const s=ready();for(const group of P.groups.filter(g=>g.key!=='math'))assert.deepEqual(P.rewardOptions(s.days[date],group.key),['required']);
});
test('普通球严格排除传说幻之和超级进化；大师球后三档各5%，其余55/30',()=>{
 assert.deepEqual(P.odds('normal'),[20,50,20,10,0,0,0]);assert.deepEqual(P.odds('master'),[0,0,55,30,5,5,5]);
 for(const p of P.catalog)if(p.isLegendary||p.isMythical||p.isMega)assert.ok(P.category(p,'normal')>=4);
 for(const [roll,rarity] of [[0,2],[.549,2],[.55,3],[.85,4],[.90,5],[.95,6],[.99999,6]]){
  const e=P.encountersFor(draw(ready(true),date,roll,0,undefined,'master'))[0],p=P.getPokemon(e.pokemonId);assert.equal(e.rarity,rarity);assert.ok(p.stage>=1||p.isMega||p.isMythical||p.isLegendary);
 }
 for(const roll of [0,.199,.2,.699,.7,.899,.9,.99999]){const e=P.encountersFor(draw(ready(),date,roll,.999))[0],p=P.getPokemon(e.pokemonId);assert.ok(!p.isMega&&!p.isLegendary&&!p.isMythical);}
});
test('已拥有形态的权重恰好减半；两个账号不共享权重',()=>{
 const s=ready(),first=P.poolWeights(s,'normal',0)[0];assert.equal(first.weight,1);
 const captured=draw(s,date);assert.equal(P.poolWeights(captured,'normal',0).find(p=>p.id===first.id).weight,.5);
 assert.equal(P.poolWeights(P.empty(),'normal',0).find(p=>p.id===first.id).weight,1);
 assert.throws(()=>draw(ready(),date,-.1,0));assert.throws(()=>draw(ready(),date,0,1));
});
test('所有形态在普通池或大师池可获得，熟悉伙伴不改变真实进化阶段',()=>{
 assert.equal(P.catalog.length,1351);
 const normal=new Set([0,1,2,3].flatMap(k=>P.poolWeights(P.empty(),'normal',k).map(p=>p.id))),master=new Set([2,3,4,5,6].flatMap(k=>P.poolWeights(P.empty(),'master',k).map(p=>p.id)));
 assert.equal(new Set([...normal,...master]).size,1351);
 assert.equal(P.category(P.getPokemon(6),'normal'),0);assert.equal(P.category(P.getPokemon(6),'master'),3);
 assert.equal(P.category(P.getPokemon(808),'normal'),5);assert.equal(P.category(P.getPokemon(10034),'normal'),6);
});
test('重复降权使第二次命中区间减半，数量再多也保持半权重',()=>{
 const first=P.poolWeights(ready(),'normal',0)[0].id;let s=draw(ready(),date);const next='2026-11-04';
 s=P.setPlan(s,next,['识字','英语','作业','识字']);s=P.complete(s,next,0,'识字');
 const pool=P.poolWeights(s,'normal',0),total=pool.reduce((n,p)=>n+p.weight,0);
 assert.equal(P.encountersFor(draw(s,next,0,(.5-1e-7)/total)).find(e=>e.date===next).pokemonId,first);
 assert.notEqual(P.encountersFor(draw(s,next,0,(.5+1e-7)/total)).find(e=>e.date===next).pokemonId,first);
 s=draw(s,next);assert.equal(P.encountersFor(s,first).length,2);assert.equal(P.poolWeights(s,'normal',0).find(p=>p.id===first).weight,.5);
});
test('开始前必须约定两项必选，避免完成一项后锁定空白任务',()=>{
 assert.throws(()=>P.setPlan(P.empty(),date,['识字','','英语作业','识字练习']),/必选/);assert.throws(()=>P.setPlan(P.empty(),date,['','英文阅读','英语作业','识字练习']),/必选/);
 assert.equal(P.setPlan(P.empty(),date,['识字','英语','','']).days[date].tasks[2].text,'');
});
test('旧版三档稀有度正确映射，保留原始规则快照且不重复领取',()=>{
 const old={days:{'2026-11-02':{tasks:ready().days[date].tasks,encounter:{pokemonId:144,rarity:2,at:'2026-11-02T03:00:00Z',date:'2026-11-02',tasks:[],odds:[75,20,5]}}}};
 const e=P.encountersFor(old)[0];assert.equal(e.rarity,4);assert.equal(e.legacy,true);assert.equal(e.ball,'normal');
 assert.equal(old.days['2026-11-02'].encounter.rarity,2);assert.deepEqual(e.odds,[75,20,5]);assert.deepEqual(P.pending(old),[]);
});
