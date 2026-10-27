import assert from 'node:assert/strict';
import {createSimulation,stepSimulation,setControl,setPose,applyAction,snapshot,hydrate,snip,reform,polygonArea,originalShape,worldShape,overlapShape,contains,room} from '../server.js';
const frame=(s,controls={})=>{for(const [id,c] of Object.entries(controls))setControl(s,+id,c);stepSimulation(s,1/60);};
const advance=(s,n,controls={})=>{for(let i=0;i<n;i++)frame(s,controls);};
let s=createSimulation();advance(s,120);console.log('settled',s.bodies.map(b=>({x:b.x,y:b.y,ground:b.grounded})));
assert(s.bodies.every(b=>b.grounded));const y=s.bodies[0].y;applyAction(s,{type:'jump',body:0});let min=y;for(let i=0;i<65;i++){frame(s);min=Math.min(min,s.bodies[0].y);}console.log('jump rise',y-min);assert(y-min>150);assert(s.bodies[0].grounded);
// Button reached using movement and a jump from the unobstructed left side.
s=createSimulation();advance(s,80);applyAction(s,{type:'jump',body:0});for(let i=0;i<65;i++)frame(s,{0:{x:i>=13&&i<60?1:0}});console.log('button',s.released,s.bodies[0].x,s.bodies[0].y);assert(s.released);assert(s.ball);assert(s.bridge);
// Geometry, rotated subtraction, and reform at the same pivot.
s=createSimulation();setPose(s.bodies[0],350,350,.42);setPose(s.bodies[1],380,330,-.68);setPose(s.bodies[2],700,550,0);setPose(s.bodies[3],800,550,0);const before=polygonArea(s.bodies[1].shape),overlap=polygonArea(overlapShape(s.bodies[0],s.bodies[1]));assert(snip(s,0));assert(Math.abs(polygonArea(s.bodies[1].shape)-(before-overlap))<.001);const b=s.bodies[1],x=b.x,by=b.y;assert(Math.abs((b.physics.position.x-b.x)-b.com.x*Math.cos(b.angle)+b.com.y*Math.sin(b.angle))<.001);assert(reform(s,1));assert.equal(b.x,x);assert.equal(b.y,by);assert(Math.abs(polygonArea(b.shape)-polygonArea(originalShape()))<.001);
// A genuine scoop cut, then a seed lands in its curved cavity.
s=createSimulation();advance(s,80);setPose(s.bodies[0],400,584,0);setPose(s.bodies[1],400,524,Math.PI);setPose(s.bodies[2],100,584,0);setPose(s.bodies[3],740,584,0);assert(snip(s,1));console.log('scoop area',polygonArea(s.bodies[0].shape));assert(!contains(s.bodies[0].shape,0,-35));assert(contains(s.bodies[0].shape,0,45));
// Release using pressure contact; remove cutter from the path.
setPose(s.bodies[1],205,432,0);frame(s);assert(s.released);setPose(s.bodies[1],100,440,0);advance(s,160);console.log('seed caught',s.ball.position,s.bodies[0].x,s.bodies[0].y);assert(Math.abs(s.ball.position.x-400)<50);assert(s.ball.position.y>550&&s.ball.position.y<590);
// Take the scoop to the first riser before jumping.
setPose(s.bodies[3],1200,449,0);
for(let i=0;i<200&&s.bodies[0].x<755;i++)frame(s,{0:{x:1}});
console.log('riser',s.bodies[0].x,s.bodies[0].y,s.ball.position);
applyAction(s,{type:'jump',body:0});for(let i=0;i<100;i++){frame(s,{0:{x:s.bodies[0].x<808?1:0}});}
for(let i=0;i<80&&s.bodies[0].x<885;i++)frame(s,{0:{x:1}});console.log('riser2',s.bodies[0].x,s.ball.position);applyAction(s,{type:'jump',body:0});for(let i=0;i<110;i++){frame(s,{0:{x:s.bodies[0].x<950?1:0}});}
for(let i=0;i<70&&s.bodies[0].x<980;i++)frame(s,{0:{x:1}});console.log('potjump',s.bodies[0].x,s.ball.position);applyAction(s,{type:'jump',body:0});for(let i=0;i<150;i++){frame(s,{0:{x:i<50?(s.bodies[0].x<1085?1:0):i<85?-1:0,rotate:0}});}
assert(s.won);console.log('PASS: physical delivery from cut scoop across bridge and both risers into flowerpot.');
// Reconciliation reverses a prediction that opened the bridge too early.
const fresh=snapshot(createSimulation());hydrate(s,fresh);assert(!s.bridge&&!s.released&&!s.ball);assert(s.solids.every(p=>p!==s.bridgeBody));
// Realtime allocations, ownership, late joining and guest routing.
const messages=new Map();const clients=Array.from({length:6},(_,i)=>({id:'c'+i,identity:'user',userId:'user'+i,username:'player'+i,send(m){const a=messages.get(this.id)||[];a.push(typeof m==='string'?JSON.parse(m):m);messages.set(this.id,a);}}));
const r={broadcast(m){for(const c of clients)c.send(m);}};const db=[];const env={DB:{prepare(sql){return {bind(...args){return {sql,args};}};},async batch(a){db.push(...a);}}};
const msg=async(i,m)=>room.onMessage(clients[i],JSON.stringify(m),r,env);const last=(i,t)=>messages.get('c'+i)?.filter(m=>m.t===t).at(-1);for(const c of clients)await room.onConnect(c,r);
await msg(0,{t:'create'});const code=last(0,'lobby').lobby.code;assert.equal(last(0,'lobby').lobby.locked,false);
assert.deepEqual(last(0,'lobby').lobby.seats[0].bodies,[0,1,2,3]);await msg(0,{t:'start'});let round=last(0,'lobby').lobby.round;
for(let i=1;i<4;i++){await msg(i,{t:'join',code});const l=last(0,'lobby').lobby;assert.equal(l.players,i+1);assert(last(i,'sync').state.bodies.every(b=>b.shape));if(i===1)assert.deepEqual(l.seats.map(v=>v?.bodies??null),[[0,2],[1,3],null,null]);if(i===2)assert.deepEqual(l.seats.map(v=>v?.bodies??null),[[0,3],[1],[2],null]);}
await msg(4,{t:'join',code});assert.equal(last(4,'lobby').lobby.you.seats.length,0);
await msg(0,{t:'lock',locked:true});await msg(3,{t:'leave'});await msg(5,{t:'join',code});assert.equal(last(5,'lobby').lobby.you.seats.length,0);
await msg(0,{t:'sync'});const shape=JSON.stringify(last(0,'sync').state.bodies[0].shape);await msg(4,{t:'act',round,action:{type:'snip',body:0}});await msg(0,{t:'sync'});assert.equal(JSON.stringify(last(0,'sync').state.bodies[0].shape),shape);
await msg(0,{t:'lock',locked:false});await msg(0,{t:'guest',device:'pad:1'});assert(last(0,'seated').seat);assert.equal(last(0,'seated').device,'pad:1');assert(last(0,'lobby').lobby.seats.some(v=>v?.label==='player0 (GUEST 1)'));
console.log('PASS: gravity, jumping, button/bridge, exact rotated cutting, reform, real scoop collision/carry, reconciliation, 1–4 seat allocation, late join, locks/full spectators, ownership, guest labels.');
