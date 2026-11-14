const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../pokemon-core.js');
const base=()=>({days:{'2026-11-03':{tasks:[],encounters:[0,1].map(sequence=>({pokemonId:25,date:'2026-11-03',at:'2026-11-03T00:00:00Z',tasks:[],sequence}))}}});
test('10分购石，一石一只，保留原抽取历史及重复伙伴',()=>{let s=P.buyStone(base(),'电','operation1');assert.equal(s.stones['电'],1);const c=P.copies(s);s=P.evolve(s,c[0].id,26,'电');assert.deepEqual(P.copies(s).map(c=>c.pokemonId).sort((a,b)=>a-b),[25,26]);assert.equal(s.stones['电'],0);assert.equal(s.days['2026-11-03'].encounters[0].pokemonId,25);assert.throws(()=>P.evolve(s,c[1].id,26,'电'));});
test('拒绝无关物种、错误属性和重复购买请求',()=>{const s=P.buyStone(base(),'火','same');assert.throws(()=>P.buyStone(s,'火','same'));assert.throws(()=>P.evolve(s,P.copies(s)[0].id,6,'火'));assert.throws(()=>P.evolve(s,P.copies(s)[0].id,26,'火'));});
test('超进化石支持同物种特殊形态与超级进化，不能跳到无关物种',()=>{
 const targets=P.evolutionTargets(6,'超进化');assert.ok(targets.some(p=>p.isMega));assert.ok(!targets.some(p=>p.speciesId!==6));
 const source={days:{d:{encounters:[{pokemonId:6,date:'d',at:new Date().toISOString(),tasks:[]}]}}};
 const s=P.buyStone(source,'超进化','super1');const result=P.evolve(s,P.copies(s)[0].id,targets.find(p=>p.isMega).id,'超进化');assert.equal(result.stones['超进化'],0);assert.throws(()=>P.evolve(s,P.copies(s)[0].id,25,'超进化'));
});
test('卖出按原价退回且消耗一颗库存，重复请求与无库存均拒绝',()=>{
 const s=P.buyStone(base(),'电','buy-sell');const sold=P.sellStone(s,'电','sell-one');assert.equal(sold.stones['电'],0);assert.equal(sold.purchases.at(-1).cost,-10);assert.throws(()=>P.sellStone(sold,'电','sell-one'));assert.throws(()=>P.sellStone(sold,'电','sell-two'));
});
