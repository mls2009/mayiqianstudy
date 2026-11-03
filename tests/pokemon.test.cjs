const { test } = require('node:test');
const assert = require('node:assert/strict');
let P = {};
try { P = require('../pokemon-core.js'); } catch(e) { if(e.code !== 'MODULE_NOT_FOUND') throw e; }
const day = '2026-11-02';
function ready() {
    let state = P.empty();
    state = P.complete(state, day, 0, '认识五个汉字');
    return P.complete(state, day, 1, '读自己选的绘本');
}
const draw=(s,d,roll=0,pick=0,at)=>P.claim(s,d,'literacy','required',[[roll,pick]],at);
test('两组基础任务独立获得机会', () => {
    assert.equal(typeof P.complete, 'function');
    let s = P.complete(P.empty(), day, 0, '识字');
    assert.deepEqual(P.pending(s), [day]);
    s = P.complete(s, day, 1, '英文阅读');
    assert.deepEqual(P.pending(s), [day]);
});
test('只用可选任务不能获得机会，普通球概率不随临时加量变化', () => {
    let s = P.complete(P.empty(), day, 2, '复习');
    s = P.complete(s, day, 3, '探索');
    assert.deepEqual(P.pending(s), []);
    assert.deepEqual(P.odds('normal'), [20,50,20,10,0,0,0]);
    assert.deepEqual(P.rewardOptions(ready().days[day],'literacy'), ['required']);
});
test('中断学习和其他扣分不影响过去的机会', () => {
    const s = P.complete(ready(), '2026-11-06', 0, '汉字');
    assert.deepEqual(P.pending(s), [day,'2026-11-06']);
});
test('每组相遇留下快照，同一组同一天不能重复领取', () => {
    const s = ready();
    const result = draw(s, day, 0.99, 0, '2026-11-03T04:00:00Z');
    assert.equal(result.days[day].encounters[0].rarity, 3);
    assert.equal(result.days[day].encounters[0].tasks[0].text, '认识五个汉字');
    assert.equal(result.days[day].encounters[0].at, '2026-11-03T04:00:00Z');
    assert.deepEqual(P.rewardOptions(result.days[day],'literacy'), []);
    assert.deepEqual(P.rewardOptions(result.days[day],'english'), ['required']);
    assert.throws(() => draw(result, day, 0, 0));
    assert.equal(s.days[day].encounter, undefined);
});
test('没有资格不能领取，已完成和已领取任务不能修改', () => {
    assert.throws(() => draw(P.empty(), day, 0, 0));
    const s = ready();
    assert.throws(() => P.complete(s, day, 0, '替换'));
    assert.throws(()=>P.complete(draw(s,day,0,0),day,3,'额外'));
    assert.equal(P.complete(draw(s,day,0,0),day,2,'额外').days[day].tasks[2].done,true);
    assert.throws(() => P.complete(P.empty(), day, 9, '越界'));
    assert.throws(() => P.complete(P.empty(), day, 0, '  '));
});
test('概率边界和图鉴的有效性', () => {
    const s = ready();
    for (const [roll, rarity] of [[0,0],[0.199,0],[0.2,1],[0.699,1],[0.7,2],[0.899,2],[0.9,3],[0.9999,3]]) {
        const caught = draw(s, day, roll, 0).days[day].encounters[0];
        assert.equal(caught.rarity, rarity);
        assert.ok(P.catalog.some(p => p.id === caught.pokemonId));
    }
    assert.equal(new Set(P.catalog.map(p => p.id)).size, 1351);
});
test('约定开始前可修改，开始后不可临时加量', () => {
    let s = P.setPlan(P.empty(),day,['汉字','英文绘本','','']);
    s=P.setPlan(s,day,['汉字','英文绘本','复习','']);
    s=P.complete(s,day,0,s.days[day].tasks[0].text);
    assert.throws(()=>P.setPlan(s,day,['汉字','英文绘本','复习','追加']));
    assert.equal(s.days[day].tasks[3].text,'');
});
test('重复抽取保留不同日期、时间和学习来源，按最近相遇排序', () => {
    let s = draw(ready(),day,0,0,'2026-11-02T02:00:00Z');
    s=P.complete(s,'2026-11-03',0,'学习新的汉字');
    s=P.complete(s,'2026-11-03',1,'阅读第二本绘本');
    s=draw(s,'2026-11-03',0,0,'2026-11-03T03:30:00Z');
    assert.equal(typeof P.encountersFor,'function');
    const entries=P.encountersFor(s,1);
    assert.equal(entries.length,2);
    assert.deepEqual(entries.map(e=>e.at),['2026-11-03T03:30:00Z','2026-11-02T02:00:00Z']);
    assert.equal(entries[0].tasks[0].text,'学习新的汉字');
    assert.equal(entries[1].tasks[0].text,'认识五个汉字');
    assert.deepEqual(P.encountersFor(s,4),[]);
});
test('双属性都能筛选，同一属性能与收藏和家族组合筛选', () => {
    assert.equal(typeof P.filterCatalog,'function');
    assert.deepEqual(P.getPokemon(1).types,['草','毒']);
    assert.ok(P.filterCatalog({type:'毒'}).some(p=>p.id===1));
    assert.ok(P.filterCatalog({type:'飞行'}).some(p=>p.id===149));
    assert.deepEqual(P.filterCatalog({type:'草',owned:new Set([1]),status:'owned'}).map(p=>p.id),[1]);
    assert.deepEqual(P.filterCatalog({family:147}).map(p=>p.id),[147,148,149,10281]);
    assert.deepEqual(P.filterCatalog({family:147,type:'火'}),[]);
});
test('支持前身、后续阶段、分支进化、幼年形态和无进化伙伴', () => {
    assert.equal(typeof P.getPokemon,'function');
    assert.equal(P.getPokemon(2).evolvesFrom,1);
    assert.deepEqual(P.getPokemon(2).evolvesTo,[3]);
    assert.equal(P.getPokemon(25).evolvesFrom,172);
    assert.equal(P.getPokemon(149).evolvesFrom,148);
    assert.deepEqual(P.getPokemon(133).evolvesTo,[134,135,136,196,197,470,471,700]);
    assert.deepEqual(P.getPokemon(151).evolvesTo,[]);
    assert.equal(P.getPokemon(151).evolvesFrom,null);
    assert.equal(P.getPokemon(3).rarity,3); // 全部形态均可从相应奖池获得
    assert.deepEqual(P.family(149).map(p=>p.id),[147,148,149,10281]);
});
test('所有家族关系双向一致，且资料及本期图鉴都有本地图片', () => {
    assert.ok(Array.isArray(P.species));
    const fs=require('node:fs'); const path=require('node:path');
    for(const p of P.species) {
        assert.ok(p.types.length>0);
        assert.ok(fs.existsSync(path.join(__dirname,'../assets/pokemon',p.id+'.png')),p.name+'图片');
        for(const id of p.evolvesTo) assert.equal(P.getPokemon(id).evolvesFrom,p.id);
        if(p.evolvesFrom) assert.ok(P.getPokemon(p.evolvesFrom).evolvesTo.includes(p.id));
        assert.ok(P.family(p.id).some(s=>s.id===p.id));
    }
});
test('每个可点击的进化形态都有独立介绍及完整图鉴资料', () => {
    for(const p of P.species) {
        assert.equal(typeof p.description,'string',p.name+'缺少介绍');
        assert.ok(p.description.length>=15,p.name+'介绍过短');
        assert.ok(p.heightM>0,p.name+'缺少身高');
        assert.ok(p.weightKg>=0,p.name+'缺少体重');
        assert.ok(p.englishName&&p.genus,p.name+'缺少图鉴名称或分类');
    }
    assert.equal(P.getPokemon(25).englishName,'Pikachu');
    assert.equal(P.getPokemon(700).heightM,1);
    assert.ok(P.species.every(p=>p.formVariants.length>0));
    assert.equal(P.getPokemon(10190).weightKg,0); // 官方未提供，不编造体重
});
