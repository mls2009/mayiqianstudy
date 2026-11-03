import './pokemon-full-data.js';
import './pokemon-trainers.js';
import {databaseForUser} from './account-databases.mjs';
import './pokemon-core.js';
const P = globalThis.PokemonCore;
const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
// 单行状态使用版本比较更新，保证两个设备不会重复领取同一天的相遇。
export async function handleAdventure(request, env) {
    if (!['GET','POST'].includes(request.method)) return reply({error:'不支持的请求'},405);
    let body;
    try { body = request.method === 'POST' ? await request.json() : {}; }
    catch { return reply({error:'无效的请求内容'},400); }
    const user = body.userId || new URL(request.url).searchParams.get('userId');
    if (typeof user !== 'string' || !user.trim() || user.length > 60) return reply({error:'请选择用户'},400);
    let db;try{db=databaseForUser(env,user);}catch(e){return reply({error:e.message},400);}
    await db.prepare('CREATE TABLE IF NOT EXISTS adventures (user_id TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0)').run();
    await db.prepare('INSERT OR IGNORE INTO adventures (user_id,state,version) VALUES (?,?,0)').bind(user,JSON.stringify(P.empty())).run();
    const row = await db.prepare('SELECT state,version FROM adventures WHERE user_id = ?').bind(user).first();
    const state = JSON.parse(row.state);
    const balance=async()=>Number((await db.prepare('SELECT COALESCE(SUM(score),0) AS balance FROM records WHERE user_id = ?').bind(user).first())?.balance||0);
    if (request.method === 'GET') return reply({...state,_balance:await balance()});
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
    let next;
    try {
        if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw Error('无效日期');
        if (body.action !== 'encounter' && body.date !== today) throw Error('只能记录今天的学习');
        if (body.action === 'plan') next = P.setPlan(state,body.date,body.texts);
        else if (body.action === 'complete') next = P.complete(state,body.date,body.index,P.fixedTasks[body.index]);
        else if (body.action === 'encounter') {
            const random = new Uint32Array(4);
            crypto.getRandomValues(random);
            next = P.claim(state,body.date,body.group,body.choice,[[random[0]/4294967296,random[1]/4294967296],[random[2]/4294967296,random[3]/4294967296]]);
        } else if(body.action==='buy')next=P.buyStone(state,body.type,body.operationId);
        else if(body.action==='evolve')next=P.evolve(state,body.copyId,body.to,body.type);
        else throw Error('未知操作');
    } catch(e) { return reply({error:e.message},400); }
    if(body.action==='buy') {
        const stone=P.stones.find(s=>s.type===body.type),at=new Date().toISOString();
        await db.prepare('INSERT OR IGNORE INTO users (id,name) VALUES (?,?)').bind(user,user).run();
        const results=await db.batch([
            db.prepare('UPDATE adventures SET state = ?, version = version + 1 WHERE user_id = ? AND version = ? AND (SELECT COALESCE(SUM(score),0) FROM records WHERE user_id = ?) >= 10').bind(JSON.stringify(next),user,row.version,user),
            db.prepare('INSERT INTO records (id,user_id,behavior_name,score,timestamp,date,category) SELECT ?,?,?,-10,?,?,? WHERE changes() = 1').bind(crypto.randomUUID(),user,'宝可梦商店购买'+stone.name,at,new Date(body.date+'T12:00:00').toDateString(),'shop')
        ]);
        if(results[0].meta.changes!==1)return reply({error:'积分不足10分或记录已更新，请刷新后重试'},409);
    } else {
        const result=await db.prepare('UPDATE adventures SET state = ?, version = version + 1 WHERE user_id = ? AND version = ?').bind(JSON.stringify(next),user,row.version).run();
        if(result.meta.changes!==1)return reply({error:'另一台设备已更新记录，请刷新后查看'},409);
    }
    return reply({...next,_balance:await balance()});
}
