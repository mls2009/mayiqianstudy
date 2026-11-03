const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('../pokemon-core.js');
function setup({vibration=true}={}) {
    let time=0,id=0;const timers=new Map(),pulses=[],gains=[],cries=[];
    class Classes {constructor(){this.values=new Set();}add(...a){a.forEach(x=>this.values.add(x));}remove(...a){a.forEach(x=>this.values.delete(x));}}
    const node=()=>({classList:new Classes(),dataset:{},textContent:'',hidden:false,offsetWidth:80});
    const nodes=new Map();
    const events=new Map();
    const dialog={...node(),open:false,innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},showModal(){this.open=true;},addEventListener(n,f){events.set(n,f);},removeEventListener(n,f){if(events.get(n)===f)events.delete(n);},close(){this.open=false;events.get('close')?.();}};
    const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
    class AudioContext {
        constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
        resume(){this.state='running';return Promise.resolve();}
        createGain(){const g={gain:param(),connect(){},disconnect(){}};gains.push(g);return g;}
        createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}
        decodeAudioData(){return Promise.resolve({duration:2});}
        createBufferSource(){return {connect(){},disconnect(){},start(){cries.push(time);},stop(){}};}
    }
    const navigator={audioSession:{type:'auto'},...(vibration?{vibrate(value){pulses.push(value);return true;}}:{})};
    const window={AudioContext};
    const context={window,navigator,PokemonBall:{mount:()=>({open(){},pulse(){},dispose(){}})},PokemonCore:P,console,Map,Set,Uint8Array,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}),localStorage:{getItem:()=> 'off'},matchMedia:()=>({matches:false}),document:{hidden:false,addEventListener(){},removeEventListener(){}},setTimeout(fn,ms){timers.set(++id,{fn,at:time+ms});return id;},clearTimeout(i){timers.delete(i);}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../pokemon-effects.js'),'utf8'),context);
    function advance(ms){const end=time+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;}
    return {fx:window.PokemonEffects,dialog,pulses,gains,cries,navigator,advance,timers};
}
test('即使旧设置为静音也默认开启声音，移除声音开关',()=>{
    const s=setup();s.fx.unlock();
    assert.ok(s.gains[0].gain.value>0,'不能沿用旧静音设置');
    s.fx.play(s.dialog,{pokemonId:25,rarity:0},()=>{},'preview');
    assert.ok(!s.dialog.innerHTML.includes('encSound'));
});
test('三次摇晃各有一次短振动，关闭会取消后续反馈',()=>{
    const s=setup();s.fx.play(s.dialog,{pokemonId:25,rarity:0},()=>{},'preview');s.advance(4000);
    assert.deepEqual(s.pulses.filter(x=>x>0),[25,35,45]);
    s.dialog.close();assert.equal(s.timers.size,0);assert.equal(s.pulses.at(-1),0);
});
test('不支持振动的 iPhone 环境仍可完成揭晓',()=>{
    const s=setup({vibration:false});s.fx.play(s.dialog,{pokemonId:25,rarity:0},()=>{},'preview');s.advance(9500);
    assert.equal(s.dialog.querySelector('.enc-scene').dataset.phase,'complete');
});
test('叫声异步加载期间关闭演出，不会在关闭后突然播放',async()=>{
    const s=setup();assert.equal(typeof s.fx.playCry,'function');s.fx.unlock();
    const pending=s.fx.playCry(25);s.fx.stop();await pending;
    assert.equal(s.cries.length,0);
});

test('默认有声播放宝可梦叫声，且所有图鉴形态都有 MP3 资源',async()=>{
    const s=setup();s.fx.unlock();
    assert.equal(await s.fx.playCry(25),true);
    assert.equal(s.cries.length,1);
    assert.equal(s.navigator.audioSession.type,'playback');
    for(const p of P.species){const file=require('node:path').join(__dirname,'../assets/pokemon-cries',p.id+'.mp3');assert.ok(fs.statSync(file).size>1000,p.name+'叫声资源');}
});
