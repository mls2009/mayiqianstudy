const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../pokemon-core.js');
const date='2026-11-04';
test('数学翻倍后可选大师球，独立领取且不能补领',()=>{
 let s=P.complete(P.empty(),date,4);assert.deepEqual(P.rewardOptions(s.days[date],'math'),['required']);
 s=P.complete(s,date,5);assert.deepEqual(P.rewardOptions(s.days[date],'math'),['required','extra-normal','master']);
 s=P.claim(s,date,'math','master',[[.99,0]]);assert.equal(s.days[date].claims.math.count,1);assert.deepEqual(P.rewardOptions(s.days[date],'math'),[]);assert.throws(()=>P.claim(s,date,'math','required'));
 assert.equal(s.days[date].encounters[0].tasks[0].text,'数学练习册3页 或 摩比数学5页');assert.equal(s.days[date].encounters[0].tasks[1].text,'数学练习册6页 或 摩比数学10页');
});
test('旧四项学习和已领取记录保留，数学可独立开始',()=>{
 const old={days:{[date]:{tasks:['字','英语','作业','识字'].map(text=>({text,done:true})),claims:{literacy:{choice:'required',count:1}},encounters:[]}}};
 const s=P.complete(old,date,4);assert.equal(s.days[date].tasks.length,6);assert.equal(old.days[date].tasks.length,4);assert.deepEqual(P.rewardOptions(s.days[date],'math'),['required']);assert.deepEqual(P.rewardOptions(s.days[date],'literacy'),[]);
});
