const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../pokemon-core.js');
test('新日期固定四项学习，无需先保存计划即可确认和领取',()=>{
 const texts=['识字5个','完成4篇英语作业','完成8篇英语作业','识字10个'];
 assert.deepEqual(P.freshDay().tasks.map(t=>t.text),texts);
 let s=P.complete(P.empty(),'2026-11-03',0);
 assert.equal(s.days['2026-11-03'].tasks[0].text,texts[0]);
 s=P.claim(s,'2026-11-03','literacy','required',[[0,0]]);
 assert.deepEqual(P.rewardOptions(s.days['2026-11-03'],'literacy'),[]);
 assert.equal(s.days['2026-11-03'].encounters[0].tasks[0].text,texts[0]);
 assert.equal(P.empty().days['2026-11-03'],undefined);
});
