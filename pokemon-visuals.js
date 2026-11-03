(function(root) {
    // Position a family on concentric rings; each branch receives its own angular sector.
    function radialLayout(members) {
        const byId=new Map(members.map(p=>[p.id,p]));
        const base=members.find(p=>!byId.has(p.graphParent));
        let leaf=0,maxDepth=0;const positions=[];
        const edges=members.flatMap(p=>[...p.evolutionChildren.map(to=>({from:p.id,to,kind:'evolution'})),...p.forms.map(to=>({from:p.id,to,kind:'form'}))]);
        function visit(p,depth) {
            const node={id:p.id,depth};positions.push(node);maxDepth=Math.max(maxDepth,depth);
            const children=members.filter(child=>child.graphParent===p.id).map(child=>child.id);
            if(!children.length)node.sector=leaf++;
            else {
                const nodes=children.map(id=>{return visit(byId.get(id),depth+1);});
                node.sector=(nodes[0].sector+nodes.at(-1).sector)/2;
            }
            return node;
        }
        visit(base,0);
        let nodes=positions.map(n=>{const angle=(-90+n.sector*360/leaf)*Math.PI/180;return {...n,x:n.depth*155*Math.cos(angle),y:n.depth*155*Math.sin(angle)};});
        let nearest=Infinity;
        for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)nearest=Math.min(nearest,Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y));
        const scale=Math.max(1,110/nearest),radius=maxDepth*155*scale,width=Math.max(440,radius*2+150),height=width;
        nodes=nodes.map(n=>({...n,x:width/2+n.x*scale,y:height/2+n.y*scale}));
        return {nodes,edges,maxDepth,width,height,rings:Array.from({length:maxDepth},(_,i)=>(i+1)*155*scale)};
    }
    function tabForHash(hash) {
        return {'#pokemon':'pokemon','#expPlan':'pokemon','#expDex':'pokemon','#expHelp':'pokemon','#animation':'pokemon','#home':'home','#stats':'stats','#settings':'settings'}[hash] || 'home';
    }
    root.PokemonVisuals={radialLayout,tabForHash};
    if(typeof module!=='undefined')module.exports=root.PokemonVisuals;
})(globalThis);
