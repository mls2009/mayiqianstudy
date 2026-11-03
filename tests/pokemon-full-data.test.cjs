const {test}=require('node:test');
const assert=require('node:assert/strict');
let data=[];try{data=require('../pokemon-full-data.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('全量战斗条目覆盖1025物种，所有名称、中文资料来源和形态元数据均可追溯',()=>{
    assert.equal(data.length,1351);
    assert.equal(new Set(data.map(p=>p.id)).size,1351);
    assert.equal(new Set(data.map(p=>p.speciesId)).size,1025);
    for(const p of data){
        assert.ok(p.name&&p.englishName&&p.description&&p.descriptionLanguage);
        assert.ok(p.types.length&&p.heightM>0&&p.weightKg>=0,p.name);
        assert.ok(Array.isArray(p.formVariants));
    }
    assert.equal(data.reduce((n,p)=>n+p.formVariants.length,0),1579);
});
test('全部物种进化边双向一致，无环；形态变化不冒充永久进化',()=>{
    const byId=new Map(data.map(p=>[p.id,p]));assert.ok(byId.size>1000);
    for(const p of data){
        assert.ok(byId.has(p.familyRoot));
        if(p.evolvesFrom)assert.ok(byId.get(p.evolvesFrom).evolvesTo.includes(p.id));
        for(const id of p.evolvesTo)assert.equal(byId.get(id).evolvesFrom,p.id);
        if(p.formOf){assert.ok(byId.get(p.formOf).forms.includes(p.id));assert.equal(p.evolvesFrom,null);}
        const seen=new Set();let q=p;
        while(q){assert.ok(!seen.has(q.id),'cycle '+p.id);seen.add(q.id);q=byId.get(q.formOf||q.evolvesFrom);}
    }
    assert.deepEqual(byId.get(1).evolvesTo,[2]);assert.deepEqual(byId.get(2).evolvesTo,[3]);
    assert.equal(byId.get(25).stage,1);assert.equal(byId.get(3).stage,2);
    assert.equal(byId.get(10034).isMega,true);assert.equal(byId.get(10034).formOf,6);
    assert.equal(byId.get(10034).stage,2);
});
test('传说、幻之、超级进化与实际进化条件来自源数据',()=>{
    assert.ok(data.length>1000);const get=id=>data.find(p=>p.id===id);
    assert.equal(get(144).isLegendary,true);assert.equal(get(151).isMythical,true);
    assert.ok(get(2).evolutionConditions.some(c=>c.minimum_level===16));
    assert.equal(get(133).evolvesTo.length,8);
    assert.ok(get(10326).isMega);
});
test('地区形态的实际进化使用指定形态，不错误连接普通物种',()=>{
 const get=id=>data.find(p=>p.id===id);
 assert.ok(get(865).evolutionParents?.includes(10166));
 assert.ok(!get(865).evolutionParents?.includes(83));
 assert.ok(get(10166).evolutionChildren?.includes(865));
 assert.ok(get(10166).evolutionChildren.every(id=>get(id).evolutionParents.includes(10166)));
});
