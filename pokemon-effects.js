/* Original Web Audio cues and CSS animation; replay never changes collection data. */
(() => {
    let audio, master, stopActive;
    let soundGeneration=0;
    const cryBuffers=new Map();
    const voices=new Set();
    function unlock() {
        try {
            const Context=window.AudioContext||window.webkitAudioContext;
            if(!Context)return;
            try {if(navigator.audioSession)navigator.audioSession.type='playback';}catch {}
            if(!audio){audio=new Context();master=audio.createGain();master.gain.value=.36;master.connect(audio.destination);}
            audio.resume().catch(()=>{});
        } catch {} // The ceremony remains usable when browser audio is unavailable.
    }
    function tone(frequency,duration=.18,delay=0,type='sine') {
        if(!audio||audio.state!=='running')return;
        const oscillator=audio.createOscillator(), gain=audio.createGain(), at=audio.currentTime+delay;
        oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,at);
        gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.45,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
        oscillator.connect(gain);gain.connect(master);voices.add(oscillator);
        oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
        oscillator.start(at);oscillator.stop(at+duration+.02);
    }
    function silence() {soundGeneration++;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
    function vibrate(duration) {try {return typeof navigator.vibrate==='function'&&navigator.vibrate(duration);}catch{return false;}}
    function loadCry(id) {
        if(!audio)return Promise.resolve(null);
        if(!cryBuffers.has(id))cryBuffers.set(id,fetch(`assets/pokemon-cries/${id}.mp3`).then(res=>{if(!res.ok)throw Error('叫声暂不可用');return res.arrayBuffer();}).then(data=>audio.decodeAudioData(data)).catch(error=>{cryBuffers.delete(id);throw error;}));
        return cryBuffers.get(id);
    }
    async function playCry(id) {
        unlock();
        const ticket=soundGeneration;
        try {
            const buffer=await loadCry(id);
            if(!buffer||ticket!==soundGeneration||audio.state!=='running')return false;
            const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;gain.gain.value=.8;source.connect(gain);gain.connect(audio.destination);voices.add(source);
            source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();if(!stopActive&&navigator.audioSession)navigator.audioSession.type='auto';};
            source.start();return true;
        } catch {return false;}
    }
    function play(dialog, encounter, onView, mode='encounter') {
        const replay=mode==='replay',preview=mode==='preview',masterBall=encounter.ball==='master';
        if(stopActive)stopActive();
        const p=PokemonCore.getPokemon(encounter.pokemonId);
        const timers=[];
        let finished=false,cryStarted=false;
        if(audio)loadCry(p.id).catch(()=>{});
        dialog.classList.remove('exp-map-dialog');
        dialog.classList.add('exp-ceremony');
        dialog.innerHTML=`<div class="enc-scene rarity-${encounter.rarity} ${masterBall?'is-master-ball':''}" data-phase="arrival">
            <div class="enc-sky" aria-hidden="true"><i class="enc-sun"></i><i class="enc-cloud cloud-one"></i><i class="enc-cloud cloud-two"></i></div>
            <svg class="enc-forest" viewBox="0 0 500 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path fill="#acc7a0" d="M0 260Q70 220 140 270T300 260T500 245V700H0Z"/><g fill="#628e71"><path d="M-35 0H45L70 570H-30Z M430 0H485L530 600H450Z"/><circle cx="25" cy="120" r="110"/><circle cx="465" cy="150" r="120"/></g><g fill="#315f50"><path d="M-25 0H15L45 680H-30Z M480 0H520L530 700H455Z"/><circle cx="-10" cy="25" r="100"/><circle cx="490" cy="25" r="110"/></g><path fill="#608664" d="M0 420Q100 350 230 425T500 400V700H0Z"/><ellipse fill="#89a775" cx="250" cy="640" rx="220" ry="130"/><ellipse fill="#bed09b" cx="250" cy="500" rx="170" ry="110"/><g fill="#497653"><path d="M0 700L8 590L35 650L48 565L70 665L85 610L108 700Z M380 700L402 620L420 665L432 575L453 648L471 590L500 700Z"/></g></svg>
            <div class="enc-topline"><span>${preview?'动画预览 · 不消耗机会，不增加收藏':replay?'重温相遇 · 收藏不会增加':masterBall?'金色大师球 · 学习相遇':'好奇森林 · 今日相遇'}</span><button class="exp-dialog-close" aria-label="关闭">×</button></div>
            <div class="enc-heading" aria-live="polite"><p id="encChapter">一段学习，一次相遇</p><h2 id="encTitle">森林里，藏着一位伙伴。</h2></div>
            <div class="enc-floor-shadow" aria-hidden="true"></div><div class="enc-halo" aria-hidden="true"></div>
            <div class="enc-rays" aria-hidden="true"></div><div class="enc-release-beam" aria-hidden="true"></div>
            <div class="enc-particles" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--angle:${i*30}deg;--distance:${85+(i%3)*25}px;--delay:${(i%4)*.08}s"></i>`).join('')}</div>
            <div class="enc-ball-flight" aria-hidden="true"><div class="enc-ball"><canvas class="enc-ball-canvas" width="400" height="440"></canvas></div></div>
            <div class="enc-partner"><img src="assets/pokemon/${p.id}.png" alt="${p.name}" width="240" height="240"></div>
            <div class="enc-result"><span>${PokemonCore.rarityNames[encounter.rarity]}</span><h2>${p.name}</h2><p>${preview?'这是演示伙伴，不会计入收藏。':replay?'再看一次，我们相遇的瞬间。':encounter.returning?'老朋友，又见面啦！':'很高兴，成为你的新伙伴。'}</p></div>
            <div class="enc-controls"><p id="encCaption">听，草叶在轻轻响动…</p><button class="exp-button" id="encView" hidden>看看伙伴的故事 ↗</button><button id="encSkip">跳过动画，直接见面</button></div>
        </div>`;
        const scene=dialog.querySelector('.enc-scene'), ball=dialog.querySelector('.enc-ball');
        const caption=dialog.querySelector('#encCaption');
        const ballArt=PokemonBall.mount(dialog.querySelector('.enc-ball-canvas'),{master:masterBall});
        const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
        const clearTimers=()=>{timers.forEach(clearTimeout);};
        const startCry=()=>{if(!cryStarted){cryStarted=true;playCry(p.id);}};
        const cleanup=()=>{clearTimers();ballArt.dispose();silence();vibrate(0);if(navigator.audioSession)navigator.audioSession.type='auto';dialog.classList.remove('exp-ceremony');document.removeEventListener('visibilitychange',visibility);dialog.removeEventListener('close',cleanup);if(stopActive===cleanup)stopActive=null;};
        const finish=(skip=false)=>{
            if(finished)return;finished=true;clearTimers();ballArt.dispose();vibrate(0);if(skip){silence();cryStarted=false;}startCry();scene.classList.add('is-open','is-glowing','is-silhouette','is-revealed','is-finished');scene.dataset.phase='complete';
            dialog.querySelector('#encChapter').textContent=preview?'相遇动画体验 · 演示结束':'相遇，是旅程里温柔的纪念';dialog.querySelector('#encTitle').textContent=replay?'又见面了，我的伙伴。':'你好，新的旅伴。';
            caption.textContent=preview?'预览不会产生抽取或学习记录。':'学习的点滴，已经留在这次相遇里。';
            if(preview)dialog.querySelector('#encView').textContent='认识演示伙伴，查看图鉴 ↗';
            if(encounter.bundleTotal>1){caption.textContent=`本次${encounter.bundleTotal}位伙伴均已入库 · 正在查看第${encounter.bundleIndex}位`;if(encounter.bundleIndex<encounter.bundleTotal)dialog.querySelector('#encView').textContent='继续开启第'+(encounter.bundleIndex+1)+'个普通球 ↗';}
            dialog.querySelector('#encView').hidden=false;dialog.querySelector('#encSkip').hidden=true;
        };
        const visibility=()=>{if(document.hidden){silence();cryStarted=true;finish();}};
        stopActive=cleanup;dialog.addEventListener('close',cleanup);document.addEventListener('visibilitychange',visibility);
        dialog.querySelector('#encSkip').onclick=()=>finish(true);
        dialog.querySelector('#encView').onclick=()=>{cleanup();onView(p.id);};

        if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
        if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
        if(masterBall){tone(261,.6);tone(392,.7,.2);tone(523,.8,.4);}
        later(()=>{tone(220,.18,0,'triangle');tone(440,.12,.08);},850);
        [1250,2350,3450].forEach((at,index)=>later(()=>{
            vibrate([25,35,45][index]);scene.dataset.phase='shake-'+(index+1);ball.classList.remove('is-shaking');void ball.offsetWidth;ball.classList.add('is-shaking');ballArt.pulse();
            caption.textContent=['轻轻一下，里面是谁呢？','又动了一下，再等一小会儿…','准备好了吗？伙伴就要出现了。'][index];
            tone(330+index*55,.12,0,'triangle');tone(440+index*55,.15,.16);
        },at));
        later(()=>{scene.classList.add('is-unlocking');ballArt.pulse();caption.textContent='咔哒，锁扣轻轻松开了。';tone(660,.09,0,'triangle');},4350);
        later(()=>{scene.classList.add('is-open');scene.dataset.phase='opening';ballArt.open();dialog.querySelector('#encTitle').textContent=masterBall?'金色大师球，开启。':'精灵球，打开了。';caption.textContent='看，球盖正沿着后侧慢慢掀起。';tone(523,.5);tone(784,.6,.12);},4650);
        later(()=>{scene.classList.add('is-glowing');caption.textContent='光芒从球里升起来了…';},5200);
        later(()=>{scene.classList.add('is-silhouette');scene.dataset.phase='silhouette';caption.textContent='这个轮廓，你认识吗？';},6150);
        later(()=>{scene.classList.add('is-revealed');scene.dataset.phase='reveal';dialog.querySelector('#encTitle').textContent=`你好，${p.name}！`;caption.textContent='欢迎加入我们的探索之旅。';[523,659,784,1047].forEach((f,i)=>tone(f,.55,i*.1));},7300);
        later(startCry,7750);
        later(()=>finish(),8750);
    }
    window.PokemonEffects={unlock,play,playCry,stop:()=>{if(stopActive)stopActive();else{silence();vibrate(0);if(navigator.audioSession)navigator.audioSession.type='auto';}}};
})();
