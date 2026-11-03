const {test}=require('node:test');
const assert=require('node:assert/strict');
let B={};try{B=require('../pokemon-ball.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('开盖全程铰链固定，球盖转动不改变任一点到铰链的距离',()=>{
    assert.equal(typeof B.rotateLid,'function');
    const hinge=[0,0,-1];
    for(const angle of [0,.2,.8,1.3,1.95]){
        const h=B.rotateLid(hinge,angle);h.forEach((v,i)=>near(v,hinge[i]));
        for(const p of [[0,0,1],[0,1,0],[1,0,0]]){
            const q=B.rotateLid(p,angle);
            near(Math.hypot(...q.map((v,i)=>v-hinge[i])),Math.hypot(...p.map((v,i)=>v-hinge[i])));
        }
    }
});
test('球盖前沿连续向上、向后打开，不会压扁半球',()=>{
    assert.equal(typeof B.rotateLid,'function');
    const q=B.rotateLid([0,0,1],Math.PI/2);
    near(q[0],0);near(q[1],2);near(q[2],-1);
    const top=B.rotateLid([0,1,0],0);assert.deepEqual(top,[0,1,0]);
});
test('球体同时包含曲面外壳、内壁、球沿和前端按钮，且法线有效',()=>{
    assert.equal(typeof B.buildGeometry,'function');
    const faces=B.buildGeometry();
    for(const part of ['upper-shell','lower-shell','upper-inner','lower-inner','upper-rim','lower-rim','button'])assert.ok(faces.some(f=>f.part===part),part);
    for(const f of faces){
        assert.ok(f.vertices.length>=3);
        for(const v of f.vertices){assert.equal(v.length,3);assert.ok(v.every(Number.isFinite));}
        near(Math.hypot(...f.normal),1);
    }
    assert.ok(faces.filter(f=>f.part==='upper-shell').every(f=>f.lid));
    assert.ok(faces.filter(f=>f.part==='lower-shell').every(f=>!f.lid));
});
