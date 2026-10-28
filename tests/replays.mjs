import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import backend,{beginRecording,captureRecording,saveRecording,createSimulation,stepSimulation,setPose,applyAction,snapshot,hydrate,room} from '../server.js';
import {replayState} from '../replay-data.js';
const sim=createSimulation(),rec=beginRecording(sim);let writes=0,stored=null;const chunks=[];
const env={DB:{prepare(sql){return {bind(...args){return {async run(){writes++;if(sql.startsWith('INSERT INTO replays '))stored={id:args[0],level:args[1],fps:args[2],frame_count:args[3],duration:args[4],manifest_json:args[6]};},async first(){return stored&&{manifest_json:stored.manifest_json};},async all(){return {results:chunks.sort((a,b)=>a.part-b.part)};},sql,args};},async all(){return {results:stored?[stored]:[]};}};},async batch(statements){for(const s of statements){writes++;if(s.sql.startsWith('INSERT INTO replay_chunks'))chunks.push({replay_id:s.args[0],part:s.args[1],frames_json:s.args[2]});}}}};
assert.equal(await saveRecording(rec,env),null);assert.equal(writes,0);
for(let i=0;i<120;i++)stepSimulation(sim,1/60);
setPose(sim.bodies[0],400,584,0);setPose(sim.bodies[1],400,524,Math.PI);assert(applyAction(sim,{type:'snip',body:1}));captureRecording(sim,rec);assert(rec.events.some(e=>e.type==='cut'));assert(rec.geometry['0:1']);
applyAction(sim,{type:'restore',body:0});captureRecording(sim,rec);assert(rec.geometry['0:2']);
setPose(sim.bodies[1],205,432,0);stepSimulation(sim,1/60);assert(sim.released);
for(let i=0;i<4;i++)setPose(sim.bodies[i],50+i*150,584,0);
let snap=snapshot(sim);snap.ball={x:1100,y:470,vx:0,vy:0,angle:0};hydrate(sim,snap);
for(let i=0;i<90&&!sim.won;i++)stepSimulation(sim,1/60);assert(sim.won);assert.equal(rec.frames.length,sim.steps+1);assert(rec.frames.every(Boolean));
for(const f of rec.frames){assert.equal(f[1].length,4);assert.equal(f[7].length,11);for(const [id,b] of f[1].entries())assert(rec.geometry[id+':'+b[6]]);}
const id=await saveRecording(rec,env);assert(id);assert.equal(stored.frame_count,rec.frames.length+180);assert(chunks.every(c=>c.frames_json.length<65000));
const randomResponse=await backend.fetch(new Request('https://test/api/replays/random'),env);assert.equal(randomResponse.status,200);assert.equal((await randomResponse.json()).replay.id,id);
const replayResponse=await backend.fetch(new Request('https://test/api/replays/'+id),env);const data=await replayResponse.json();assert.equal(data.frames.length,stored.frame_count);assert.deepEqual(data.frames[60],rec.frames[60]);
const first=replayState(data,0),last=replayState(data,data.frames.length-1);assert.equal(first.released,false);assert(last.won);assert(last.visual.flower>.99);
const cut=data.events.find(e=>e.type==='cut');assert(cut.seed);assert.equal(replayState(data,cut.frame).bodies[0].revision,2); // same-step restore is the final state, with BOTH events retained
assert(data.events.some(e=>e.type==='reform'&&e.frame===cut.frame));
if(process.env.REPLAY_FIXTURE)await fs.writeFile(process.env.REPLAY_FIXTURE,JSON.stringify(data));
// A title-screen observer never occupies a seat, joins a lobby, or controls a player.
const messages=new Map(),clients=['host-replay-test','watcher-replay-test'].map(id=>({id,identity:'user',userId:id,username:id,send(m){const q=messages.get(id)||[];q.push(m);messages.set(id,q);}}));
const r={broadcast(){}};for(const c of clients)await room.onConnect(c,r);
const send=(i,m)=>room.onMessage(clients[i],JSON.stringify(m),r,env);
await send(0,{t:'create'});await send(0,{t:'start'});await send(1,{t:'watch-attract',enabled:true});await room.onTick(r,env);
const live=messages.get(clients[1].id).find(m=>m.t==='attract'&&m.live);assert(live);assert(live.state.bodies.every(b=>b.shape));assert(!messages.get(clients[1].id).some(m=>m.t==='lobby'));
await send(0,{t:'leave'});await room.onTick(r,env);assert(messages.get(clients[1].id).some(m=>m.t==='attract'&&!m.live));
for(const c of clients)await room.onClose(c,r,env);
console.log('PASS: authoritative 60fps frame capture, cut/reform geometry and event history, completed-only chunk persistence, JSON endpoints, frame-addressable replay reconstruction and seatless live title observers.');
