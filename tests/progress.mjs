import fs from 'node:fs/promises';import assert from 'node:assert/strict';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'snip-tests-'));const modulePath=path.join(scratch,'server.mjs');
await fs.writeFile(modulePath,(await fs.readFile(new URL('../server.js',import.meta.url),'utf8'))+'\nexport {lobbies};');
const {room,lobbies,setPose,stepSimulation,snapshot,hydrate}=await import(pathToFileURL(modulePath).href);
let messages=[];const c={id:'signed-in-host',identity:'user',userId:'trusted-account-id',username:'host',send(m){messages.push(m);}};const r={broadcast(){}};let writes=[];const env={DB:{prepare(sql){return {bind(...args){return {sql,args};}}},async batch(items){writes.push(...items);}}};const send=m=>room.onMessage(c,JSON.stringify(m),r,env);
await room.onConnect(c,r);await send({t:'create'});await send({t:'start'});const l=[...lobbies.values()][0];
await send({t:'won',seconds:1,snips:0});assert.equal(l.status,'playing');assert.equal(writes.length,0);
setPose(l.state.bodies[0],205,432,0);stepSimulation(l.state,1/60);assert(l.state.released);for(let i=0;i<4;i++)setPose(l.state.bodies[i],100+i*100,584,0);let snap=snapshot(l.state);snap.ball={x:1100,y:470,vx:0,vy:0,angle:0};hydrate(l.state,snap);
for(let i=0;i<20;i++){l.lastTick=Date.now()-50;await room.onTick(r,env);}
assert.equal(l.status,'won');assert.equal(l.saved,'saved');assert.equal(writes.length,2);assert(writes.every(q=>q.args[0]==='trusted-account-id'));assert(writes.some(q=>q.sql.includes('platform_progress')));assert(writes.some(q=>q.sql.includes('platform_clears')));for(let i=0;i<3;i++)await room.onTick(r,env);assert.equal(writes.length,2);
console.log('PASS: forged win ignored; server collision-derived goal, one awaited DB batch, trusted account attribution, no duplicate clears.');

await fs.rm(scratch,{recursive:true,force:true});
