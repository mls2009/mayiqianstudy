const {test}=require('node:test');const assert=require('node:assert/strict');
const P=require('../pokemon-core');const V=require('../pokemon-visuals');
test('每个家族的全部进化与地区/超级形态均出现在可交互图中',()=>{
 for(const root of new Set(P.catalog.map(p=>p.familyRoot))){
  const members=P.family(root),g=V.radialLayout(members);
  assert.equal(g.nodes.length,members.length,'family '+root);
  assert.deepEqual(new Set(g.nodes.map(n=>n.id)),new Set(members.map(p=>p.id)));
  for(const p of members){if(p.formOf)assert.ok(g.edges.some(e=>e.from===p.formOf&&e.to===p.id&&e.kind==='form'));for(const parent of p.evolutionParents)assert.ok(g.edges.some(e=>e.from===parent&&e.to===p.id&&e.kind==='evolution'));}
  for(const n of g.nodes)assert.ok(n.x>=45&&n.x<=g.width-45&&n.y>=45&&n.y<=g.height-45);
  for(let i=0;i<g.nodes.length;i++)for(let j=i+1;j<g.nodes.length;j++)assert.ok(Math.hypot(g.nodes[i].x-g.nodes[j].x,g.nodes[i].y-g.nodes[j].y)>90,root+' overlap');
 }
});
