const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../pokemon-core.js');
let V={};
try {V=require('../pokemon-visuals.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('放射关系图完整保留各家族的节点和有向进化边',()=>{
    assert.equal(typeof V.radialLayout,'function');
    for(const root of new Set(P.species.map(p=>p.familyRoot))) {
        const members=P.family(root), graph=V.radialLayout(members);
        assert.deepEqual(graph.nodes.map(n=>n.id).sort((a,b)=>a-b),members.map(p=>p.id).sort((a,b)=>a-b));
        assert.equal(graph.edges.length,members.reduce((n,p)=>n+p.forms.length+p.evolutionChildren.length,0));
        for(const e of graph.edges)assert.ok((e.kind==='form'?P.getPokemon(e.from).forms:P.getPokemon(e.from).evolutionChildren).includes(e.to));
        assert.equal(graph.nodes[0].x,graph.width/2);
        assert.equal(graph.nodes[0].y,graph.height/2);
    }
});
test('所有节点留在画布内，图片和标签区域之间不重叠',()=>{
    assert.equal(typeof V.radialLayout,'function');
    for(const root of new Set(P.species.map(p=>p.familyRoot))) {
        const {nodes,width,height}=V.radialLayout(P.family(root));
        for(const n of nodes) {assert.ok(n.x>=45&&n.x<=width-45);assert.ok(n.y>=40&&n.y<=height-70);}
        for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++) {
            assert.ok(Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)>=105,`节点 ${nodes[i].id} 与 ${nodes[j].id} 重叠`);
        }
    }
});
test('伊布八个分支围绕中心放射，无进化物种只有一个中心节点',()=>{
    assert.equal(typeof V.radialLayout,'function');
    const g=V.radialLayout(P.family(133));
    assert.equal(g.nodes.length,P.family(133).length);
    assert.equal(g.edges.filter(e=>e.kind==='evolution').length,8);
    for(const n of g.nodes.filter(n=>P.getPokemon(133).evolvesTo.includes(n.id)))assert.ok(Math.abs(Math.hypot(n.x-g.width/2,n.y-g.height/2)-g.rings[0])<.01);
    assert.deepEqual(V.radialLayout(P.family(151)).edges,[]);
});
test('刷新旧的学习锚点和新动画链接仍然进入宝可梦页面',()=>{
    assert.equal(typeof V.tabForHash,'function');
    for(const hash of ['#expPlan','#pokemon','#animation'])assert.equal(V.tabForHash(hash),'pokemon');
    assert.equal(V.tabForHash('#home'),'home');
    assert.equal(V.tabForHash('#stats'),'stats');
    assert.equal(V.tabForHash('#settings'),'settings');
    assert.equal(V.tabForHash(''),'home');
    assert.equal(V.tabForHash('#unknown'),'home');
});
