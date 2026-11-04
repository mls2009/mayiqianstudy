(function(root) {
    const species = root.PokemonFullData || require('./pokemon-full-data.js');
    const trainers = root.PokemonTrainers || require('./pokemon-trainers.js');
    const familiar = new Set(trainers.flatMap(t=>t.pokemonIds));
    const rarityNames = ['常见伙伴','基础宝可梦','进化一次','进化两次','传说宝可梦','幻之宝可梦','超级进化'];
    function category(p,ball='normal') {
        if(p.isMega)return 6;
        if(p.isMythical)return 5;
        if(p.isLegendary)return 4;
        if(ball==='normal'&&familiar.has(p.id))return 0;
        return p.stage>=2?3:p.stage===1?2:1;
    }
    const catalog=species.map(p=>({...p,rarity:category(p),familiar:familiar.has(p.id)}));
    const byId=new Map(catalog.map(p=>[p.id,p]));
    const labels = ['识字学习','英语阅读','可选：英语作业','可选：识字练习','数学学习','可选：数学练习'];
    const groups=[{key:'literacy',name:'识字',required:0,optional:3},{key:'english',name:'英语',required:1,optional:2},{key:'math',name:'数学',required:4,optional:5}];
    const groupFor=key=>{const group=groups.find(g=>g.key===key);if(!group)throw Error('请选择学习组');return group;};
    const empty = () => ({days:{}});
    const fixedTasks = ['识字5个','完成4篇英语作业','完成8篇英语作业','识字10个','数学练习册3页 或 摩比数学5页','数学练习册6页 或 摩比数学10页'];
    const freshDay = () => ({tasks:fixedTasks.map(text=>({text,done:false})),encounters:[],claims:{}});
    const dayTasks = day => fixedTasks.map((text,i)=>day?.tasks?.[i]||{text,done:false});
    const copy = state => JSON.parse(JSON.stringify(state));
    const draws = day => day.encounters || (day.encounter?[day.encounter]:[]);
    const legacyClaim = day => !!day&&draws(day).some(e=>!e.group);
    const claimed = (day,key) => {groupFor(key);return !!day&&(!!day.claims?.[key]||(key!=='math'&&legacyClaim(day)));};
    function setPlan(state, date, texts) {
        if (!Array.isArray(texts) || ![4,6].includes(texts.length) || texts.some(t => typeof t !== 'string' || t.length > 120)) throw Error('请填写有效的学习计划');
        if(!texts[0].trim()||!texts[1].trim())throw Error('请先填写识字与英语阅读两项必选内容');
        const next = copy(state), day = next.days[date] || freshDay();
        if (day.tasks.some(t => t.done) || draws(day).length) throw Error('学习开始后，今天的约定不再增加或修改');
        day.tasks = dayTasks({tasks:texts.map(text => ({text:text.trim(),done:false}))});
        next.days[date] = day;
        return next;
    }
    function complete(state, date, index, text = fixedTasks[index]) {
        if (!Number.isInteger(index) || index < 0 || index > 5 || typeof text !== 'string' || !text.trim() || text.length > 120) throw Error('请先约定具体的学习内容');
        const next = copy(state), day = next.days[date] || freshDay();
        if(claimed(day,groups.find(g=>g.required===index||g.optional===index).key))throw Error('这一组今天的奖励已领取，不能再次领取或补领');
        day.tasks=dayTasks(day);
        if(day.tasks[index].done)throw Error('这项学习已经记录');
        day.tasks[index] = {text:text.trim(),done:true};
        next.days[date] = day;
        return next;
    }
    function rewardOptions(day,key) {
        const group=groupFor(key);
        if(!day||claimed(day,key)||!day.tasks[group.required]?.done)return [];
        return day.tasks[group.optional]?.done?['required','extra-normal','master']:['required'];
    }
    function pending(state) {
        return Object.keys(state.days).filter(date=>groups.some(g=>rewardOptions(state.days[date],g.key).length)).sort();
    }
    function odds(ball='normal') {
        if(ball==='normal')return [20,50,20,10,0,0,0];
        if(ball==='master')return [0,0,55,30,5,5,5];
        throw Error('请选择普通球或金色大师球');
    }
    function encountersFor(state, id = null) {
        return [...Object.values(state.days).flatMap(draws),...(state.evolutions||[])].filter(e=>id===null||e.pokemonId===id).map(e=>e.ball?e:{...e,ball:'normal',rarity:category(byId.get(e.pokemonId)),legacy:true}).sort((a,b)=>b.at.localeCompare(a.at)||(b.sequence||0)-(a.sequence||0));
    }
    function poolWeights(state,ball,rarity) {
        const owned=new Set(encountersFor(state).map(e=>e.pokemonId));
        return catalog.filter(p=>category(p,ball)===rarity).map(p=>({id:p.id,weight:owned.has(p.id)?.5:1}));
    }
    function claim(state,date,key,choice,randoms=Array.from({length:2},()=>[Math.random(),Math.random()]),at=new Date().toISOString()) {
        const group=groupFor(key);
        if(!rewardOptions(state.days[date],key).includes(choice))throw Error('这一组尚未完成相应任务，或今天已领取');
        const count=choice==='extra-normal'?2:1,ball=choice==='master'?'master':'normal';
        if(!Array.isArray(randoms)||randoms.length<count||randoms.slice(0,count).some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n)||n<0||n>=1)))throw Error('无效的随机数');
        const next=copy(state),day=next.days[date];
        day.claims={...day.claims,[key]:{choice,count,at}};
        day.encounters=draws(day);
        const chances=odds(ball);
        for(const [roll,pick] of randoms.slice(0,count)) {
            let cumulative=0;
            const rarity=chances.findIndex(n=>{cumulative+=n;return roll*100<cumulative;});
            const pool=poolWeights(next,ball,rarity),total=pool.reduce((n,p)=>n+p.weight,0);
            let remaining=pick*total;
            const selected=pool.find(p=>{remaining-=p.weight;return remaining<0;})||pool.at(-1);
            day.encounters.push({pokemonId:selected.id,rarity,ball,group:key,choice,at,date,
                method:`${group.name}${choice==='required'?'必选':'必选＋对应可选'} · ${ball==='master'?'金色大师球':'普通精灵球'}`,
                tasks:copy([group.required,...(choice==='required'?[]:[group.optional])].map(i=>day.tasks[i])),
                odds:chances,duplicateWeight:selected.weight,sequence:day.encounters.length+1});
        }
        return next;
    }
    const stones=[['火','#d66a43'],['水','#5b9fca'],['电','#d6af38'],['草','#73a35d'],['冰','#8bbfc9'],['一般','#a99b83'],['格斗','#b47561'],['毒','#9a75a3'],['地面','#b3915f'],['飞行','#97acc7'],['超能力','#cf839d'],['虫','#9cab52'],['岩石','#a49b70'],['幽灵','#7e79a8'],['龙','#7a91b3'],['恶','#776e69'],['钢','#8faba9'],['妖精','#ce9fac']].map(([type,color])=>({type,color,name:(type==='电'?'雷':type)+'进化石',price:10}));
    function copies(state) {
        const result=Object.entries(state.days).flatMap(([date,day])=>draws(day).map((e,i)=>({...e,id:date+':'+i})));
        for(const e of state.evolutions||[]){const c=result.find(c=>c.id===e.copyId);if(c)c.pokemonId=e.to;}
        return result;
    }
    function evolutionTargets(id,type) {return (getPokemon(id)?.evolutionChildren||[]).map(getPokemon).filter(p=>p&&!p.isMega&&p.types.includes(type));}
    function buyStone(state,type,operationId,at=new Date().toISOString()) {
        if(!stones.some(s=>s.type===type))throw Error('请选择有效的进化石');
        if(typeof operationId!=='string'||operationId.length<4||operationId.length>80)throw Error('无效购买请求');
        if(state.purchases?.some(p=>p.id===operationId))throw Error('这笔购买已经完成，请刷新查看');
        const next=copy(state);next.stones={...next.stones,[type]:(next.stones?.[type]||0)+1};
        next.purchases=[...(next.purchases||[]),{id:operationId,type,cost:10,at}];return next;
    }
    function evolve(state,copyId,to,type,at=new Date().toISOString()) {
        const c=copies(state).find(c=>c.id===copyId);
        if(!c||!evolutionTargets(c.pokemonId,type).some(p=>p.id===Number(to)))throw Error('这颗进化石不能用于这条进化路线');
        if(!(state.stones?.[type]>0))throw Error('这颗进化石的数量不足');
        const next=copy(state);next.stones[type]--;
        next.evolutions=[...(next.evolutions||[]),{copyId,from:c.pokemonId,to:Number(to),type,at,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(at)),pokemonId:Number(to),tasks:[],method:getPokemon(c.pokemonId).name+' → '+getPokemon(to).name+' · '+(stones.find(s=>s.type===type)?.name||type)+'进化',ball:'evolution'}];return next;
    }
    const getPokemon=id=>byId.get(Number(id));
    const family=id=>catalog.filter(p=>p.familyRoot===getPokemon(id).familyRoot);
    function filterCatalog({type='all',family='all',status='all',owned=new Set(),rarity='all',query=''} = {}) {
        const term=query.trim().toLowerCase();
        return catalog.filter(p=>(type==='all'||p.types.includes(type))&&(family==='all'||p.familyRoot===Number(family))&&
            (rarity==='all'||p.rarity===Number(rarity))&&(!term||`${p.name} ${p.englishName} ${p.identifier} ${p.id}`.toLowerCase().includes(term))&&
            (status==='all'||(status==='owned'?owned.has(p.id):!owned.has(p.id))));
    }
    const api={stones,copies,evolutionTargets,buyStone,evolve,catalog,species:catalog,trainers,rarityNames,category,draws,getPokemon,family,filterCatalog,encountersFor,labels,fixedTasks,dayTasks,empty,freshDay,setPlan,complete,pending,groups,claimed,legacyClaim,rewardOptions,odds,poolWeights,claim};
    root.PokemonCore=api;
    if(typeof module!=='undefined')module.exports=api;
})(globalThis);
