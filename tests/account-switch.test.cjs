const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('切换账号后，迟到的旧账号请求不能覆盖新账号分数与记录',async()=>{
 const source=fs.readFileSync(require.resolve('../script.js'),'utf8');
 const start=source.indexOf('async function refreshAllViews()'),end=source.indexOf('\nfunction getAllRecords()',start);
 const requests=new Map(),shown=[];
 const ctx={currentUser:'马亦谦',FIXED_USER_ID:'default',currentTab:'home',cachedRecords:[],console:{log(){},error(){}},
 apiGetRecords:user=>new Promise(r=>requests.set(user+':records',r)),apiGetUserStats:user=>new Promise(r=>requests.set(user+':stats',r)),
 updateScoreDisplay:stats=>shown.push(stats.totalScore),updateRewardCardDisplay(){},renderRecords(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 const old=ctx.refreshAllViews();ctx.currentUser='马熠初';const fresh=ctx.refreshAllViews();
 requests.get('马熠初:records')([{userId:'马熠初'}]);requests.get('马熠初:stats')({totalScore:2});await fresh;
 requests.get('马亦谦:records')([{userId:'马亦谦'}]);requests.get('马亦谦:stats')({totalScore:99});await old;
 assert.equal(ctx.cachedRecords[0].userId,'马熠初');assert.deepEqual(shown,[2]);
});
