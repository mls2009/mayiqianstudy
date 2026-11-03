/* 学习探险独立保存，不参与原有行为分数计算。 */
(() => {
    const P = PokemonCore;
    const rarityNames = P.rarityNames;
    let state = P.empty(), user = '', mode = '', busy = false, generation = 0, filter = 'all', typeFilter = 'all', familyFilter = 'all', rarityFilter = 'all', search = '', dexPage = 0;
    const page = () => document.getElementById('pokemonPage');
    const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
    const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const key = () => `pokemon_v1_${user}`;
    const dateLabel = d => d.replaceAll('-','.');
    const history = () => P.encountersFor(state);
    const art = (p,cls='') => `<img class="${cls}" src="assets/pokemon/${p.id}.png" alt="${p.name}" loading="lazy" width="160" height="160">`;
    async function api(body, who = user) {
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort(),10000);
        try {
            const res = await fetch(`${API_BASE}/api/adventure?userId=${encodeURIComponent(who)}`,{
                signal:controller.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,userId:who})}:{})
            });
            if (!res.ok) {
                let error = `保存失败（${res.status}）`;
                try { error = (await res.json()).error || error; } catch {}
                throw Object.assign(Error(error),{status:res.status});
            }
            return await res.json();
        } finally { clearTimeout(timeout); }
    }
    async function load() {
        const ticket = ++generation;
        const who = currentUser;
        user = who; dexPage=0; filter='all'; busy = true; mode = ''; state = P.empty();
        render();
        try {
            // 后端尚未部署时，本机模式保持独立；不自动合并，以免重抽或覆盖收藏。
            if (new URLSearchParams(location.search).get('preview') === '1' || localStorage.getItem(`pokemon_local_${who}`)) {
                if(new URLSearchParams(location.search).get('preview') === '1')localStorage.setItem(`pokemon_local_${who}`,'1');
                mode = 'local'; state = JSON.parse(localStorage.getItem(key()) || '{"days":{}}');
            } else {
                const remote = await api(null,who);
                if (ticket !== generation) return;
                state = remote; mode = 'cloud';
            }
        } catch(e) {
            if (ticket !== generation) return;
            if (e.status === 404) {
                try {
                    state = JSON.parse(localStorage.getItem(key()) || '{"days":{}}');
                    localStorage.setItem(`pokemon_local_${who}`,'1'); mode = 'local';
                } catch { mode = 'error'; }
            } else { mode = 'error'; }
        } finally {
            if(ticket === generation) { busy = false; render(); }
        }
    }
    function render() {
        const day = state.days[today()] || P.freshDay();
        const entries = history(), owned = new Set(entries.map(e=>e.pokemonId));
        const pending = P.pending(state), locked = day.tasks.some(t=>t.done);
        const taskClaimed=i=>P.claimed(day,P.groups.find(g=>g.required===i||g.optional===i).key);
        page().innerHTML = `
            <header class="exp-heading"><div><p class="exp-eyebrow">POKÉMON · 学习探险手记</p><h1>${escape(user || currentUser)}的探索之旅</h1></div><span class="exp-date">${dateLabel(today())}</span></header>
            <section class="exp-hero"><div class="exp-hero-copy"><span class="exp-tag">每一点发现，都值得记住</span><h2>带着好奇心，<br>遇见新伙伴。</h2><p>读一个故事，认识几个字。<br>把自己的发现，留在这段旅程里。</p><a href="#expPlan" class="exp-link">看看今天的学习约定 ↓</a></div><div class="exp-hero-art">${art(P.catalog[0])}<span class="exp-art-caption">第一站 · 好奇森林</span></div></section>
            <section class="exp-experience"><div><span class="exp-eyebrow">宝可梦关系图鉴</span><h2>认识每一位伙伴。</h2><p>从进化到不同形态，点开看看它们的故事。</p></div><button class="exp-explore-button" data-action="explore">打开关系图鉴 ↗</button></section>
            <div class="exp-storage" role="status">${busy?'正在保存或读取手记…':mode==='cloud'?'☁ 手记已保存到云端':mode==='local'?'◉ 仅保存在本机浏览器 · 尚未开启跨设备同步': '暂时无法读取手记，请检查网络后重试'} ${mode==='error'?'<button data-action="retry">重新读取</button>':''}</div>
            ${mode==='local'?'<details class="exp-local"><summary>保存与备份</summary><p>本机手记不会自动上传；清除浏览器数据会丢失。可以导出备份，并在其他浏览器的本机模式恢复。</p><button data-action="export">导出手记</button><label class="exp-import">恢复备份<input type="file" accept="application/json" id="expImport"></label></details>':''}
            <section class="exp-panel" id="expPlan"><div class="exp-section-heading"><div><p class="exp-eyebrow">01 / 今天的约定</p><h2>先选内容，再开始</h2></div><span class="exp-small">${day.tasks.filter(t=>t.done).length} 项已记录</span></div>
                <p class="exp-note">和家长一起约定适合今天的内容。书由你选，顺序也由你定。留空的可选任务就当作休息。</p>
                <form id="expPlanForm"><div class="exp-task-list">${day.tasks.map((t,i)=>`<div class="exp-task ${t.done?'is-done':''}"><span class="exp-task-number">${t.done?'✓':String(i+1).padStart(2,'0')}</span><label><span>${P.labels[i]} <small>${i<2?'必选':'不必全部完成'}</small></span>${locked?`<p class="exp-task-summary">${escape(t.text||'今天没有安排这一项')}</p>`:`<input aria-label="${P.labels[i]}内容" name="task${i}" value="${escape(t.text)}" maxlength="120" placeholder="${['如：一起认识故事里的汉字','如：读一本自己选的英文绘本','如：回顾昨天遇到的词','如：找一个想知道答案的问题'][i]}" ${locked||busy?'disabled':''}>`}</label>${locked?`<button type="button" data-complete="${i}" ${t.done||taskClaimed(i)||!t.text||busy?'disabled':''}>${taskClaimed(i)?'已领取':t.done?'已完成':'家长确认'}</button>`:''}</div>`).join('')}</div>${!locked?`<button class="exp-button" type="submit" ${busy||mode==='error'?'disabled':''}>保存今天的约定</button><button class="exp-text-button" type="button" data-complete="0" ${!day.tasks[0].text||busy?'disabled':''}>识字已完成，家长确认</button><button class="exp-text-button" type="button" data-complete="1" ${!day.tasks[1].text||busy?'disabled':''}>阅读已完成，家长确认</button>`:'<p class="exp-footnote">今天的约定已锁定，不再临时加量。认真尝试也值得被看见。</p>'}</form>
            </section>
            ${renderRewards(pending)}
            <details class="exp-rules"><summary>给家长：相遇规则与抽取概率</summary><button class="exp-replay" data-action="preview">预览普通球（不消耗机会）</button><button class="exp-replay" data-action="preview-master">预览金色大师球（不消耗机会）</button><p>识字与英语两组每天各领一次。每组必选完成可领1普通球；本组必选与对应可选都完成后，可改领2普通球或1大师球。三个方案互斥，领取后该组按钮显示已领取，不再补领；另一组不受影响。2普通球一次入库，再依次揭晓。马亦谦与马熠初规则相同。</p>${['normal','master'].map(ball=>`<h3>${ball==='normal'?'普通精灵球':'金色大师球'}</h3><table class="exp-odds"><thead><tr><th>类别</th><th>概率</th></tr></thead><tbody>${P.odds(ball).map((chance,i)=>({chance,name:rarityNames[i]})).filter(r=>r.chance>0).sort((a,b)=>b.chance-a.chance).map(r=>`<tr><td>${r.name}</td><td>${r.chance}%</td></tr>`).join('')}</tbody></table>`).join('')}<p>先抽类别，再按权重抽该类伙伴；已拥有形态权重为未拥有的一半，不随数量继续降低。普通球不出传说、幻之和超级进化。普通球的常见名单来自主角团与火箭队的历代伙伴。大师球按实际进化阶段分池，传说、幻之和超级进化各5%。</p><p>约定开始前可编辑，不临时加量。任务不评价孩子的价值，不排名、不扣伙伴、不以连续打卡施压。给自由阅读和休息也留出时间。</p></details>
            ${renderDex(entries,owned)}
            <section class="exp-panel"><div class="exp-section-heading"><div><p class="exp-eyebrow">04 / 成长留下的印记</p><h2>我们的探险回忆</h2></div></div>${entries.length?entries.map(e=>{const p=P.getPokemon(e.pokemonId);return `<button class="exp-memory" data-pokemon="${p.id}">${art(p)}<span><strong>与${p.name}相遇</strong><small>${dateLabel(e.date)} 的学习 · ${e.tasks.length} 项发现</small></span><span>↗</span></button>`;}).join(''):'<p class="exp-empty">手记从今天开始。读过的故事、认识的字，都会成为旅程的一部分。</p>'}</section>
            <footer class="exp-footer">按自己的节奏，世界值得慢慢探索。<small>宝可梦角色归各权利人所有 · <a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noopener">图片来源 PokeAPI sprites</a></small></footer>`;
    }
    function renderRewards(pending) {
        const dates=[today(),...pending.filter(date=>date!==today())];
        return `<section class="exp-encounter exp-group-rewards"><div><p class="exp-eyebrow">02 / 分组领取奖励</p><h2>识字一次，英语一次。</h2><p>每组每天领取一次，必选与对应可选奖励互斥。领取后保留灰色「已领取」，另一组仍可独立领取。</p></div>${dates.map(date=>{
            const day=state.days[date]||P.freshDay();
            return `<div class="exp-reward-date">${dateLabel(date)} 的约定</div>${P.groups.map(group=>{
                const paid=P.claimed(day,group.key),options=P.rewardOptions(day,group.key),disabled=busy||mode==='error';
                const button=(choice,label,master=false)=>`<button class="exp-button ${master?'exp-master-button':''}" data-action="encounter" data-date="${date}" data-group="${group.key}" data-choice="${choice}" aria-label="${group.name}${choice==='required'?'必选':'可选'}奖励：${paid?'已领取':label}" ${paid||disabled||!options.includes(choice)?'disabled':''}>${paid?'已领取':label}</button>`;
                const claim=day.claims?.[group.key];
                return `<section class="exp-reward-group ${paid?'is-claimed':''}" aria-label="${group.name}组每日奖励"><header><h3>${group.name}组</h3><span>${paid?'今日已领取':options.length?'可以领取':'学习进行中'}</span></header><div class="exp-group-option"><strong>必选 · ${group.name}学习</strong><p>${escape(day.tasks[group.required].text||'先约定学习内容')}</p>${button('required','领取1个普通球')}</div><div class="exp-group-option"><strong>对应可选 · ${escape(day.tasks[group.optional].text||'今天不安排')}</strong><p>本组必选与可选都完成后，领取时选择精灵球。</p><button class="exp-button" data-action="choose-reward" data-date="${date}" data-group="${group.key}" aria-label="${group.name}可选奖励：${paid?'已领取':'领取奖励'}" ${paid||disabled||!options.includes('extra-normal')?'disabled':''}>${paid?'已领取':'领取奖励'}</button></div>${paid?`<p class="exp-group-receipt">${P.legacyClaim(day)?'旧版已领取记录保留，不重复发放。':`本组已领取${claim.choice==='master'?'1个大师球':claim.count+'个普通球'}，必选和可选不能再次领取。`}</p>`:''}</section>`;
            }).join('')}`;
        }).join('')}</section>`;
    }
    function rewardBallIcon(master=false) {
        const id=master?'master':'normal';
        return `<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false"><defs><radialGradient id="${id}Top" cx="35%" cy="25%" r="80%"><stop stop-color="${master?'#fff1ae':'#ff7979'}"/><stop offset=".45" stop-color="${master?'#d8a43c':'#dc3241'}"/><stop offset="1" stop-color="${master?'#92611b':'#8f182a'}"/></radialGradient><radialGradient id="${id}Bottom" cx="35%" cy="25%" r="85%"><stop stop-color="${master?'#fff7d9':'#fff'}"/><stop offset=".6" stop-color="${master?'#e9d59c':'#e5ebee'}"/><stop offset="1" stop-color="${master?'#9a804b':'#929eaa'}"/></radialGradient><clipPath id="${id}Shell"><circle cx="64" cy="62" r="50"/></clipPath></defs><ellipse cx="64" cy="118" rx="34" ry="5" fill="#26493618"/><g clip-path="url(#${id}Shell)"><circle cx="64" cy="62" r="50" fill="url(#${id}Top)"/><path d="M10 60 Q64 82 118 60 V116 H10Z" fill="url(#${id}Bottom)"/><path d="M10 60 Q64 82 118 60" fill="none" stroke="#29333d" stroke-width="7"/>${master?'<ellipse cx="36" cy="47" rx="10" ry="12" fill="#78416d"/><ellipse cx="92" cy="47" rx="10" ry="12" fill="#78416d"/><path d="M51 49 V28 L64 42 L77 28 V49" fill="none" stroke="#fff8dc" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>':''}</g><circle cx="64" cy="62" r="50" fill="none" stroke="#26354140" stroke-width="1.5"/><circle cx="64" cy="70" r="14" fill="#27313d"/><circle cx="64" cy="70" r="10.5" fill="#c0cad1"/><circle cx="64" cy="70" r="7.5" fill="#f7f8f3" stroke="#72808d" stroke-width="1.5"/></svg>`;
    }
    function showRewardPicker(date,key) {
        if(busy||mode==='error'||!P.rewardOptions(state.days[date],key).includes('extra-normal'))return;
        const group=P.groups.find(g=>g.key===key),dialog=document.getElementById('expDialog');
        PokemonEffects.stop();dialog.classList.remove('exp-map-dialog','exp-ceremony');dialog.classList.add('exp-choice-dialog');
        dialog.dataset.rewardDate=date;dialog.dataset.rewardGroup=key;dialog.dataset.rewardUser=user;dialog.dataset.rewardGeneration=generation;
        dialog.innerHTML=`<button class="exp-dialog-close" aria-label="关闭选择框">×</button><p class="exp-eyebrow">${group.name}组 · 对应可选已完成</p><h2>选择本次奖励</h2><p>两种奖励任选一种，选择后本组今日不能再领。</p><div class="exp-ball-choices"><button class="exp-ball-choice" data-reward-choice="extra-normal" aria-label="领取两个普通球"><span class="exp-ball-choice-art">${rewardBallIcon()}<span class="exp-ball-multiplier">×2</span></span><strong>普通精灵球</strong></button><button class="exp-ball-choice is-master" data-reward-choice="master" aria-label="领取一个金色大师球"><span class="exp-ball-choice-art">${rewardBallIcon(true)}</span><strong>金色大师球</strong></button></div><button class="exp-choice-cancel exp-dialog-close-action">暂不领取</button>`;
        if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
    }
    async function mutate(body) {
        if (busy || mode==='error') return;
        busy = true; render();
        const ticket = generation;
        const storageKey = key();
        const who = user;
        try {
            let next;
            if (mode==='cloud') next = await api(body, who);
            else {
                const update = () => {
                    const latest = JSON.parse(localStorage.getItem(storageKey) || '{"days":{}}');
                    const d = body.date;
                    if(body.action==='plan') next=P.setPlan(latest,d,body.texts);
                    else if(body.action==='complete') next=P.complete(latest,d,body.index,latest.days[d]?.tasks[body.index]?.text);
                    else next=P.claim(latest,d,body.group,body.choice);
                    localStorage.setItem(storageKey,JSON.stringify(next));
                };
                if(navigator.locks) await navigator.locks.request(storageKey,update); else update();
            }
            if(ticket!==generation) return;
            state=next; render();
            if(body.action==='encounter') showClaim(P.draws(state.days[body.date]).filter(e=>e.group===body.group));
        } catch(e) {
            if(ticket!==generation) return;
            notify(e.name==='AbortError'?'网络超时，请重新读取手记确认是否已保存，再重试。':e.message);
            if(mode==='cloud') { try { const next=await api(); if(ticket===generation) state=next; } catch {} }
        } finally { if(ticket===generation) {busy=false;render();} }
    }
    let messageTimer;
    function notify(text) { const out=document.getElementById('expMessage'); out.textContent=text; clearTimeout(messageTimer); messageTimer=setTimeout(()=>{out.textContent='';},8000); }
    function renderDex(entries, owned) {
        const types=[...new Set(P.catalog.flatMap(p=>p.types))];
        const families=[...new Set(P.catalog.map(p=>p.familyRoot))].map(id=>P.getPokemon(id));
        const visible=P.filterCatalog({type:typeFilter,family:familyFilter,status:filter,owned,rarity:rarityFilter,query:search});
        const totalPages=Math.max(1,Math.ceil(visible.length/36));dexPage=Math.min(dexPage,totalPages-1);
        const counts=new Map();entries.forEach(e=>counts.set(e.pokemonId,(counts.get(e.pokemonId)||0)+1));
        return `<section class="exp-panel" id="expDex"><div class="exp-section-heading"><div><p class="exp-eyebrow">03 / 我的伙伴图鉴</p><h2>每位伙伴，一段回忆</h2></div><span class="exp-count">${owned.size}<small> / ${P.catalog.length}</small></span></div>
        <form id="expSearchForm" class="exp-search"><input name="search" aria-label="搜索宝可梦" placeholder="名字、英文名或编号" value="${escape(search)}"><button type="submit">查找</button></form>
        <div class="exp-filters" role="group" aria-label="图鉴筛选">${[['all','全部伙伴'],['owned','已经相遇'],['missing','尚未遇见']].map(([k,label])=>`<button data-filter="${k}" aria-pressed="${filter===k}">${label}</button>`).join('')}</div>
        <div class="exp-dex-selects"><label>按抽取分类<select id="expRarityFilter"><option value="all">全部类别</option>${rarityNames.map((name,i)=>`<option value="${i}" ${String(rarityFilter)===String(i)?'selected':''}>${name}</option>`).join('')}</select></label><label>按属性分类<select id="expTypeFilter" aria-label="按属性分类"><option value="all">全部属性</option>${types.map(t=>`<option value="${t}" ${typeFilter===t?'selected':''}>${t}系</option>`).join('')}</select></label><label>按进化家族分类<select id="expFamilyFilter" aria-label="按进化家族分类"><option value="all">全部进化家族</option>${families.map(p=>`<option value="${p.id}" ${String(familyFilter)===String(p.id)?'selected':''}>${p.name}家族</option>`).join('')}</select></label></div>
        <p class="exp-dex-summary">${visible.length} 个形态 · 共 ${entries.length} 次相遇 · 第 ${dexPage+1} / ${totalPages} 页</p>
        <div class="exp-dex">${visible.slice(dexPage*36,(dexPage+1)*36).map(p=>{const count=counts.get(p.id)||0;return `<button class="exp-pokemon ${count?'is-owned':'is-unknown'} rarity-${p.rarity}" data-pokemon="${p.id}" aria-label="${count?p.name+'，相遇'+count+'次':'尚未遇见的'+p.name}"><span class="exp-dex-id">No.${String(p.speciesId).padStart(3,'0')}</span>${art(p)}${count?`<span class="exp-owned-badge" aria-label="已拥有${count}只">${count}</span>`:''}<strong>${p.name}</strong><span class="exp-type">${p.types.join('／')} · ${rarityNames[p.rarity]}</span><span class="exp-catch-count">${count?'相遇 '+count+' 次':'尚未相遇'}</span></button>`;}).join('')||'<p class="exp-note exp-dex-empty">没有符合条件的伙伴，试试其他搜索或分类。</p>'}</div>
        <div class="exp-pagination"><button data-page="prev" ${dexPage===0?'disabled':''}>上一页</button><span>${dexPage+1} / ${totalPages}</span><button data-page="next" ${dexPage+1===totalPages?'disabled':''}>下一页</button></div></section>`;
    }
    function renderProfile(p) {
        return `<section class="exp-profile"><h3>关于${p.name}</h3><p class="exp-profile-description">${escape(p.description)}</p><button class="exp-cry-button" data-cry="${p.id}">🔊 听听${p.name}的叫声</button><dl class="exp-profile-facts"><div><dt>全国图鉴</dt><dd>No.${String(p.speciesId).padStart(3,'0')} · 形态ID ${p.id}</dd></div><div><dt>英文名</dt><dd>${escape(p.englishName)}</dd></div><div><dt>分类</dt><dd>${escape(p.genus)}</dd></div><div><dt>属性</dt><dd>${p.types.join('／')}</dd></div><div><dt>身高</dt><dd>${p.heightM} 米</dd></div><div><dt>体重</dt><dd>${p.weightKg?p.weightKg+' 千克':'源资料未提供'}</dd></div></dl><p class="exp-profile-source">${p.descriptionKind==='summary'?'基于源数据的中文资料摘要':'图鉴介绍'} · ${escape(p.formLabel||'默认形态')} · <a href="https://pokeapi.co/" target="_blank" rel="noopener">PokeAPI</a></p></section>`;
    }
    function renderEncounterHistory(p) {
        const entries=P.encountersFor(state,p.id);
        return `<section class="exp-encounter-history"><h3>相遇记录 · ${entries.length} 次</h3>${entries.length?`<button class="exp-replay" data-replay="${p.id}">▷ 重温相遇仪式</button>`:''}${entries.length?entries.map((e,i)=>`<div class="exp-detail-memory"><span class="exp-memory-number">第 ${entries.length-i} 次相遇</span><strong>${escape(new Date(e.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))}</strong><p>${e.legacy?'旧版相遇规则 · ':''}${escape(e.method)} · ${dateLabel(e.date)}的约定</p><ul>${e.tasks.map(t=>`<li>${escape(t.text)}</li>`).join('')}</ul></div>`).join(''):'<p class="exp-note">还没有相遇记录，浏览资料不会点亮收藏。</p>'}</section>`;
    }
    function detail(id) {
        document.getElementById('expDialog').classList.remove('exp-map-dialog');
        const p=P.getPokemon(id), entries=P.encountersFor(state,id);
        const dialog=document.getElementById('expDialog');
        const owned=new Set(history().map(e=>e.pokemonId));
        const status=p=>owned.has(p.id)?'已收集':p.rarity!==undefined?'尚未收集':'图鉴资料 · 本期不可抽取';
        const link=id=>`<button class="exp-evolution-link" data-evolution="${id}">${P.getPokemon(id).name} ↗</button>`;
        dialog.innerHTML=`<button class="exp-dialog-close" aria-label="关闭">×</button><div class="exp-detail-art">${art(p)}</div><p class="exp-eyebrow">No.${String(p.id).padStart(3,'0')} · ${p.types.join('／')}</p><h2>${p.name}</h2><p>${status(p)}${p.rarity!==undefined?' · '+rarityNames[p.rarity]:''}${entries.length?' · 相遇 '+entries.length+' 次':''}</p>
            ${renderProfile(p)}<section class="exp-evolution"><h3>进化关系</h3><div class="exp-evolution-facts"><p><span>${p.formOf&&!p.evolutionParents.length?'同物种原形态':'进化前身'}</span>${p.evolutionParents.length?p.evolutionParents.map(link).join(''):p.formOf?link(p.formOf):'没有进化前身'}</p><p><span>可以进化成</span>${p.evolutionChildren.length?p.evolutionChildren.map(link).join(''):'没有后续进化'}</p>${p.forms.length?`<p><span>其他形态</span>${p.forms.map(link).join('')}</p>`:''}</div><h4>${P.getPokemon(p.familyRoot).name}家族 · 完整进化路线</h4><p class="exp-footnote">点击任意形态查看资料。查看进化关系不会自动获得伙伴。</p>${renderEvolutionGraph(p,owned)}<p class="exp-footnote">实线为物种进化，虚线为同物种形态关系。形态变化不等于永久进化。</p></section>
            ${renderEncounterHistory(p)}`;
        if(!dialog.open) dialog.showModal();
        dialog.scrollTop=0;centerGraph(dialog);
    }
    function centerGraph(dialog) {
        const scroll=dialog.querySelector('.exp-network-scroll'),node=dialog.querySelector('.exp-network-node.is-current');
        if(!scroll||!node)return;
        const a=scroll.getBoundingClientRect(),b=node.getBoundingClientRect();
        scroll.scrollLeft+=b.left+b.width/2-a.left-a.width/2;
        scroll.scrollTop+=b.top+b.height/2-a.top-a.height/2;
    }
    function renderEvolutionGraph(current,owned) {
        const graph=PokemonVisuals.radialLayout(P.family(current.id));
        const byId=new Map(graph.nodes.map(n=>[n.id,n]));
        const lines=graph.edges.map(e=>{
            const from=byId.get(e.from),to=byId.get(e.to),dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
            if(Math.abs(dx)<45 && dy < -80) return `<path class="${e.kind==='form'?'is-form':''}" d="M ${from.x+12} ${from.y-34} Q ${from.x+80} ${(from.y+to.y)/2} ${to.x+30} ${to.y+23}" marker-end="${e.kind==='form'?'':'url(#expArrow)'}"/>`;
            return `<line class="${e.kind==='form'?'is-form':''}" x1="${from.x+dx/length*36}" y1="${from.y+dy/length*36}" x2="${to.x-dx/length*39}" y2="${to.y-dy/length*39}" marker-end="${e.kind==='form'?'':'url(#expArrow)'}"/>`;
        }).join('');
        return `<div class="exp-network"><div class="exp-network-toolbar"><span>实线：进化 → · 虚线：同物种形态</span><button data-graph-zoom="out" aria-label="缩小关系图">−</button><output id="expGraphScale">100%</output><button data-graph-zoom="in" aria-label="放大关系图">＋</button></div><div class="exp-network-scroll" tabindex="0" aria-label="可滚动的进化关系图"><svg class="exp-network-svg" data-base-width="${graph.width}" viewBox="0 0 ${graph.width} ${graph.height}" style="width:${graph.width}px" role="group" aria-label="${P.getPokemon(current.familyRoot).name}家族放射进化关系图"><defs><marker id="expArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L9 5L0 9"/></marker></defs><g class="exp-network-rings" aria-hidden="true">${graph.rings.map(r=>`<circle cx="${graph.width/2}" cy="${graph.height/2}" r="${r}"/>`).join('')}</g><g class="exp-network-edges" aria-hidden="true">${lines}</g>${graph.nodes.map(n=>{
            const p=P.getPokemon(n.id),active=p.id===current.id;
            return `<g class="exp-network-node ${active?'is-current':''} ${owned.has(p.id)?'is-collected':''}" transform="translate(${n.x} ${n.y})" role="button" tabindex="0" data-evolution="${p.id}" aria-label="查看${p.name}${active?'，当前形态':''}" ${active?'aria-current="true"':''}><circle r="38"/><image href="assets/pokemon/${p.id}.png" x="-29" y="-29" width="58" height="58"/><title>${p.name}</title><text y="49" text-anchor="middle">${p.name.length>10?p.name.slice(0,9)+'…':p.name}</text><text class="exp-node-status" y="64" text-anchor="middle">${active?'当前形态':owned.has(p.id)?'已收集':p.rarity!==undefined?'尚未收集':'资料形态'}</text></g>`;
        }).join('')}</svg></div><p class="exp-network-legend"><span>● 当前形态</span><span>● 已收集</span><span>○ 尚未收集／资料</span></p><button class="exp-map-open" data-map="${current.id}">展开进化关系图 ↗</button></div>`;
    }
    function showEvolutionMap(id,focusProfile=false) {
        const dialog=document.getElementById('expDialog'),p=P.getPokemon(id);
        const sameFamily=dialog.classList.contains('exp-map-dialog')&&dialog.dataset.family===String(p.familyRoot);
        const previous=dialog.querySelector('.exp-network-scroll'),oldZoom=Number(dialog.querySelector('.exp-network-svg')?.dataset.zoom||1);
        const scroll=sameFamily?{left:previous.scrollLeft,top:previous.scrollTop,dialog:dialog.scrollTop}:null;
        const owned=new Set(history().map(e=>e.pokemonId));
        const link=id=>`<button class="exp-evolution-link" data-map-select="${id}">${P.getPokemon(id).name} ↗</button>`;
        dialog.classList.add('exp-map-dialog');dialog.dataset.family=p.familyRoot;
        dialog.innerHTML=`<button class="exp-dialog-close" aria-label="关闭">×</button><p class="exp-eyebrow">POKÉDEX EXPLORER · 宝可梦关系探索</p><h2>${P.getPokemon(p.familyRoot).name}家族</h2><p>点击任意宝可梦，直接查看它的介绍、图鉴、进化与收藏记录。</p><div class="exp-map-workspace"><div class="exp-map-canvas"><label class="exp-map-picker">选择想认识的宝可梦<select id="expMapPokemon" aria-label="选择想认识的宝可梦">${P.species.map(member=>`<option value="${member.id}" ${member.id===p.id?'selected':''}>No.${String(member.id).padStart(3,'0')} ${member.name}</option>`).join('')}</select></label>${renderEvolutionGraph(p,owned)}</div><section class="exp-selected-profile" aria-label="当前宝可梦资料"><button class="exp-map-return" data-map-top>↑ 返回关系图</button><header class="exp-selected-header">${art(p)}<div><span>No.${String(p.id).padStart(3,'0')}</span><h2>${p.name}</h2><p>${owned.has(p.id)?'已收集':p.rarity!==undefined?'尚未收集':'资料形态 · 本期不可抽取'}</p></div></header>${renderProfile(p)}<section class="exp-selected-relations"><h3>进化关系</h3><div class="exp-evolution-facts"><p><span>${p.formOf&&!p.evolutionParents.length?'同物种原形态':'进化前身'}</span>${p.evolutionParents.length?p.evolutionParents.map(link).join(''):p.formOf?link(p.formOf):'没有进化前身'}</p><p><span>可以进化成</span>${p.evolutionChildren.length?p.evolutionChildren.map(link).join(''):'没有后续进化'}</p>${p.forms.length?`<p><span>其他形态</span>${p.forms.map(link).join('')}</p>`:''}</div></section>${renderEncounterHistory(p)}</section></div>`;
        if(!dialog.open)dialog.showModal();
        if(scroll) {
            const svg=dialog.querySelector('.exp-network-svg');svg.dataset.zoom=oldZoom;svg.style.width=Number(svg.dataset.baseWidth)*oldZoom+'px';dialog.querySelector('#expGraphScale').textContent=oldZoom*100+'%';
            const canvas=dialog.querySelector('.exp-network-scroll');canvas.scrollLeft=scroll.left;canvas.scrollTop=scroll.top;dialog.scrollTop=scroll.dialog;
        } else {dialog.scrollTop=0;centerGraph(dialog);}
        if(focusProfile&&matchMedia('(max-width:700px)').matches) dialog.querySelector('.exp-selected-profile').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
    }
    function previewEncounter(master=false) {
        PokemonEffects.unlock();
        PokemonEffects.play(document.getElementById('expDialog'),{pokemonId:master?6:25,rarity:master?3:0,ball:master?'master':'normal'},detail,'preview');
    }
    function showClaim(entries,index=0) {
        const e={...entries[index],bundleIndex:index+1,bundleTotal:entries.length};
        showEncounter(e,false,id=>index+1<entries.length?showClaim(entries,index+1):detail(id));
    }
    function showEncounter(e,replay=false,onView=detail) {
        PokemonEffects.play(document.getElementById('expDialog'),{...e,returning:e.duplicateWeight===.5||(e.duplicateWeight===undefined&&P.encountersFor(state,e.pokemonId).length>1)},onView,replay?'replay':'encounter');
    }
    document.addEventListener('DOMContentLoaded',()=>{
        page().addEventListener('input',e=>{if(e.target.closest('#expPlanForm'))page().querySelectorAll('[data-complete]').forEach(b=>b.disabled=true);});
        page().addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='expSearchForm'){search=new FormData(e.target).get('search')||'';dexPage=0;render();document.getElementById('expDex').scrollIntoView({block:'start'});return;}if(e.target.id!=='expPlanForm')return;const data=new FormData(e.target),texts=[0,1,2,3].map(i=>data.get('task'+i)||'');if(!texts[0].trim()||!texts[1].trim()){notify('请先填写识字与英语阅读两项必选内容。');return;}mutate({action:'plan',date:today(),texts});});
        page().addEventListener('click',e=>{
            const b=e.target.closest('button');if(!b)return;
            if(b.dataset.complete!==undefined) mutate({action:'complete',date:today(),index:Number(b.dataset.complete)});
            if(b.dataset.pokemon)detail(Number(b.dataset.pokemon));
            if(b.dataset.filter){filter=b.dataset.filter;dexPage=0;render();}
            if(b.dataset.page){dexPage+=b.dataset.page==='next'?1:-1;render();document.getElementById('expDex').scrollIntoView({block:'start'});}
            if(b.dataset.action==='retry')load();
            if(b.dataset.action==='explore')showEvolutionMap(133);
            if(b.dataset.action==='preview')previewEncounter();
            if(b.dataset.action==='preview-master')previewEncounter(true);
            if(b.dataset.action==='choose-reward')showRewardPicker(b.dataset.date,b.dataset.group);
            if(b.dataset.action==='encounter'){PokemonEffects.unlock();mutate({action:'encounter',date:b.dataset.date,group:b.dataset.group,choice:b.dataset.choice});}
            if(b.dataset.action==='export'){
                const blob=new Blob([JSON.stringify({format:'pokemon-v3',user,state},null,2)],{type:'application/json'});
                const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${user}-探险手记.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
            }
        });
        page().addEventListener('change',async e=>{
            if(e.target.id==='expRarityFilter'){rarityFilter=e.target.value;dexPage=0;render();return;}
            if(e.target.id==='expTypeFilter'){typeFilter=e.target.value;dexPage=0;render();return;}
            if(e.target.id==='expFamilyFilter'){familyFilter=e.target.value;dexPage=0;render();return;}
            if(e.target.id!=='expImport'||busy)return;
            const file=e.target.files[0];if(!file)return;
            try {
                const backup=JSON.parse(await file.text());
                if(!['pokemon-v1','pokemon-v2','pokemon-v3'].includes(backup.format)||backup.user!==user||!backup.state?.days)throw Error('请选择当前孩子的探险手记备份');
                const incoming=backup.state;
                for(const [date,d] of Object.entries(incoming.days)) {
                    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(d.tasks)||d.tasks.length!==4||d.tasks.some(t=>typeof t.text!=='string'||t.text.length>120||typeof t.done!=='boolean')) throw Error('备份内容无效');
                    if(d.encounters!==undefined&&!Array.isArray(d.encounters))throw Error('备份相遇记录无效');
                    for(const e of P.draws(d))if(!P.getPokemon(e.pokemonId)||!Array.isArray(e.tasks)||e.tasks.some(t=>typeof t.text!=='string')||!Number.isFinite(Date.parse(e.at))||e.date!==date||(e.ball&&!['normal','master'].includes(e.ball)))throw Error('备份相遇记录无效');
                }
                // 仅合并不存在的日期，绝不覆盖本机已有的学习和相遇。
                const merged={days:{...incoming.days,...state.days}};
                localStorage.setItem(key(),JSON.stringify(merged));state=merged;render();notify('备份已合并，已有的记录已保留。');
            } catch(err) {notify(err.message);}
        });
        const dialog=document.getElementById('expDialog');
        dialog.addEventListener('close',()=>{PokemonEffects.stop();dialog.classList.remove('exp-choice-dialog');});
        dialog.addEventListener('change',e=>{if(e.target.id==='expMapPokemon')showEvolutionMap(Number(e.target.value),true);});
        dialog.addEventListener('keydown',e=>{const node=e.target.closest('[data-evolution]');if(node&&node.tagName.toLowerCase()==='g'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(dialog.classList.contains('exp-map-dialog'))showEvolutionMap(Number(node.dataset.evolution),true);else detail(Number(node.dataset.evolution));}});
        dialog.addEventListener('click',async e=>{
            const choice=e.target.closest('[data-reward-choice]');
            if(choice) {
                if(busy||dialog.dataset.rewardUser!==user||dialog.dataset.rewardGeneration!==String(generation))return;
                const body={action:'encounter',date:dialog.dataset.rewardDate,group:dialog.dataset.rewardGroup,choice:choice.dataset.rewardChoice};
                if(!P.rewardOptions(state.days[body.date],body.group).includes(body.choice)){dialog.close();notify('这一组已领取或尚未准备好，请刷新后查看。');return;}
                const pickerGeneration=generation;
                const closed=new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));
                dialog.classList.remove('exp-choice-dialog');PokemonEffects.unlock();dialog.close();
                // The queued close event must finish before the encounter reuses this dialog.
                await closed;if(pickerGeneration!==generation)return;
                mutate(body);return;
            }
            if(e.target.closest('.exp-dialog-close-action')){dialog.close();return;}
            const cry=e.target.closest('[data-cry]');
            if(cry){PokemonEffects.stop();PokemonEffects.playCry(Number(cry.dataset.cry)).then(ok=>{if(!dialog.open||!cry.isConnected)return;if(ok)cry.textContent='🔊 再听一次'+P.getPokemon(Number(cry.dataset.cry)).name+'的叫声';else notify('声音未能播放，请调高手机媒体音量后再点一次。');});return;}
            const selected=e.target.closest('[data-map-select]');
            if(selected){showEvolutionMap(Number(selected.dataset.mapSelect),true);return;}
            if(e.target.closest('[data-map-top]')){dialog.querySelector('.exp-map-canvas').scrollIntoView({block:'start'});return;}
            const map=e.target.closest('[data-map]');
            if(map){showEvolutionMap(Number(map.dataset.map));return;}
            const replay=e.target.closest('[data-replay]');
            if(replay){PokemonEffects.unlock();showEncounter(P.encountersFor(state,Number(replay.dataset.replay))[0],true);return;}
            const zoom=e.target.closest('[data-graph-zoom]');
            if(zoom){const svg=dialog.querySelector('.exp-network-svg');const next=Math.max(1,Math.min(2.5,Number(svg.dataset.zoom||1)+(zoom.dataset.graphZoom==='in'?.5:-.5)));svg.dataset.zoom=next;svg.style.width=Number(svg.dataset.baseWidth)*next+'px';dialog.querySelector('#expGraphScale').textContent=next*100+'%';return;}
            const evolution=e.target.closest('[data-evolution]');
            if(evolution){if(dialog.classList.contains('exp-map-dialog'))showEvolutionMap(Number(evolution.dataset.evolution),true);else detail(Number(evolution.dataset.evolution));return;}
            if(e.target===dialog||e.target.closest('.exp-dialog-close'))dialog.close();
        });
        document.addEventListener('pokemon:open',()=>load());
        document.addEventListener('pokemon:user',()=>{if(user===currentUser)return;generation++;document.getElementById('expDialog').close();if(currentTab==='pokemon')load();});
        window.addEventListener('storage',e=>{if(currentTab==='pokemon'&&!busy&&e.key===key()&&mode==='local'){state=JSON.parse(e.newValue||'{"days":{}}');render();}});
        document.getElementById('homePokemonExplore').onclick=()=>{switchTab('pokemon');window.scrollTo(0,0);};
        const requested=PokemonVisuals.tabForHash(location.hash);
        if(requested!==currentTab)switchTab(requested);
        window.addEventListener('hashchange',()=>{const tab=PokemonVisuals.tabForHash(location.hash);if(tab!==currentTab)switchTab(tab);});
        let lastDay=today();
        setInterval(()=>{if(currentTab==='pokemon'&&!busy&&lastDay!==today()){lastDay=today();load();}},60000);
    });
})();
