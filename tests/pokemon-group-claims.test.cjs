const {test}=require('node:test');const assert=require('node:assert/strict');
const P=require('../pokemon-core');const date='2026-11-03';
function setup(indices){let s=P.setPlan(P.empty(),date,['识字必选','阅读必选','8篇作业','识字10个']);for(const i of indices)s=P.complete(s,date,i,s.days[date].tasks[i].text);return s;}
const normal=[[0,0],[0,0]];
test('识字和英语必选各自完成即可领取，不要求另一项完成',()=>{
 assert.equal(typeof P.claim,'function');
 let s=setup([0]);assert.deepEqual(P.rewardOptions(s.days[date],'literacy'),['required']);assert.deepEqual(P.rewardOptions(s.days[date],'english'),[]);
 s=P.claim(s,date,'literacy','required',normal);assert.equal(P.encountersFor(s).length,1);assert.ok(P.claimed(s.days[date],'literacy'));assert.ok(!P.claimed(s.days[date],'english'));
 assert.equal(P.encountersFor(s)[0].group,'literacy');assert.deepEqual(P.encountersFor(s)[0].tasks.map(t=>t.text),['识字必选']);
});
test('每项只由对应的可选升级，三种领取方案互斥',()=>{
 for(const [group,required,optional,otherOptional] of [['literacy',0,3,2],['english',1,2,3]]){
  assert.deepEqual(P.rewardOptions(setup([required,otherOptional]).days[date],group),['required']);
  const state=setup([required,optional]);assert.deepEqual(P.rewardOptions(state.days[date],group),['required','extra-normal','master']);
  for(const [choice,count,ball] of [['required',1,'normal'],['extra-normal',2,'normal'],['master',1,'master']]){
   const s=P.claim(state,date,group,choice,normal);assert.equal(P.encountersFor(s).length,count);assert.ok(P.encountersFor(s).every(e=>e.ball===ball));assert.deepEqual(P.rewardOptions(s.days[date],group),[]);
   for(const again of ['required','extra-normal','master'])assert.throws(()=>P.claim(s,date,group,again,normal));
  }
 }
});
test('两组每天各可领取一次，最多四普通球或两大师球，两组可混选',()=>{
 for(const [a,b,count] of [['required','required',2],['extra-normal','extra-normal',4],['master','master',2],['extra-normal','master',3]]){
  let s=setup([0,1,2,3]);s=P.claim(s,date,'literacy',a,normal);
  assert.ok(P.rewardOptions(s.days[date],'english').length);
  s=P.claim(s,date,'english',b,normal);assert.equal(P.encountersFor(s).length,count);assert.deepEqual(P.pending(s),[]);
 }
});
test('2普通球一次入库，每球有来源时间，第二球的重复权重基于第一球结果',()=>{
 const s=P.claim(setup([0,3]),date,'literacy','extra-normal',normal,'2026-11-03T03:00:00Z');const events=P.draws(s.days[date]);
 assert.equal(events.length,2);assert.equal(events[0].pokemonId,events[1].pokemonId);assert.equal(events[0].duplicateWeight,1);assert.equal(events[1].duplicateWeight,.5);
 assert.deepEqual(events.map(e=>e.sequence),[1,2]);assert.ok(events.every(e=>e.at==='2026-11-03T03:00:00Z'&&e.group==='literacy'));
 assert.equal(s.days[date].claims.literacy.count,2);
 const original=setup([0,3]);assert.throws(()=>P.claim(original,date,'literacy','extra-normal',[[0,0],[1,0]]));assert.equal(P.encountersFor(original).length,0);
});
test('领过必选后不能再补可选，另一天和另一组不受影响',()=>{
 let s=P.claim(setup([0,1]),date,'literacy','required',normal);
 assert.throws(()=>P.complete(s,date,3,'识字10个'),/领取/);assert.ok(P.rewardOptions(s.days[date],'english').length);
 const next='2026-11-04';s=P.setPlan(s,next,['字','阅读','作业','识字']);s=P.complete(s,next,0,'字');assert.deepEqual(P.rewardOptions(s.days[next],'literacy'),['required']);
});
test('未做必选不能只凭可选领取，未知组和未知奖励拒绝',()=>{
 let s=setup([2,3]);assert.deepEqual(P.pending(s),[]);assert.throws(()=>P.claim(s,date,'literacy','master',normal));
 s=setup([0,1,2,3]);assert.throws(()=>P.claim(s,date,'other','master',normal));assert.throws(()=>P.claim(s,date,'literacy','other',normal));
});
test('旧版未标学习组的已领取记录保留且不重复发放',()=>{
 const s=setup([0,1,2,3]);s.days[date].encounters=[{pokemonId:25,rarity:0,ball:'normal',at:'2026-11-03T01:00:00Z',date,tasks:[]}];
 for(const group of ['literacy','english']){assert.ok(P.claimed(s.days[date],group));assert.deepEqual(P.rewardOptions(s.days[date],group),[]);}
 assert.equal(P.encountersFor(s).length,1);
});
test('同一批两球时间相同时，抽取历史按实际序号倒序展示',()=>{
 const s=P.claim(setup([0,3]),date,'literacy','extra-normal',normal,'2026-11-03T03:00:00Z');
 assert.deepEqual(P.encountersFor(s).map(e=>e.sequence),[2,1]);
});
