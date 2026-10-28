import {createSimulation,stepSimulation,setControl,clearControls,applyAction,hydrate} from './engine.js';
import {getLevel} from './levels.js';
import {createInput} from './input.js';
import {createRenderer} from './renderer.js';
import {createAttract} from './attract.js';
const $=s=>document.querySelector(s), level=getLevel(1);
const icon=id=>`<svg><use href="#i-${id}"/></svg>`;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img=(url,name,cls='')=>url?`<img class="${cls}" src="${escape(url)}" alt="${escape(name)}" referrerpolicy="no-referrer">`:`<span class="avatar-initial ${cls}">${escape(name?.[0]?.toUpperCase()||'?')}</span>`;
let socket=null,identity=null,lobby=null,lobbies=[],state=createSimulation(level),active=0,online=false,pads=[],deviceSeats=new Map(),deviceActive=new Map(),progress=null,lastCode=null;
const renderer=createRenderer($('#board'));
const attract=createAttract({canvas:$('#attract-live'),replayHost:$('#attract-replay'),label:$('#attract-status'),requestSync:()=>{if(online&&!lobby)send({t:'watch-attract',enabled:true});}});
const controls=new Map(),deviceControls=new Map();let latestSnapshot=0,needsSync=false;
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function send(m){if(!online||!socket){toast('Connecting to the squad server…');return false;}socket.send(m);return true;}
function connection(text,ok){$('#connection').innerHTML=`<i></i>${escape(text)}`;$('#connection').classList.toggle('offline',!ok);}
function mySeats(){return lobby?.seats.filter(s=>s?.mine)||[];}
function seatFor(device){const seats=mySeats();const assigned=deviceSeats.get(device);if(assigned&&seats.some(s=>s.id===assigned))return assigned;if(device.startsWith('pad:')){const idx=pads.findIndex(p=>p.device===device);if(idx>0)return null;}return seats[0]?.id;}
function bodiesFor(device='kb'){const id=seatFor(device);return lobby?.assignments.flatMap((s,i)=>s===id?[i]:[])||[];}
function allMine(){return lobby?.assignments.flatMap((s,i)=>mySeats().some(v=>v.id===s)?[i]:[])||[];}
function rebuild(){renderer.set(state,active);updateCharacters();}
function act(action){if(lobby?.status!=='playing'||!allMine().includes(action.body))return;if(action.type==='jump')applyAction(state,action);send({t:'act',action,round:lobby.round});}
function stopBody(id){if(id==null)return;controls.set(id,{x:0,rotate:0,crouch:false});setControl(state,id,{x:0});if(lobby?.status==='playing')send({t:'inputs',round:lobby.round,inputs:[{body:id,x:0,rotate:0,crouch:false}]});}
function currentBody(device){const ids=bodiesFor(device);let id=deviceActive.get(device)??(device==='kb'||device==='touch'?active:undefined);if(!ids.includes(id))id=ids[0];return id;}
function cycle(device,step=1){const ids=bodiesFor(device);if(!ids.length)return;const current=currentBody(device);stopBody(current);const next=ids[(Math.max(0,ids.indexOf(current))+step+ids.length)%ids.length];deviceActive.set(device,next);if(device==='kb'||device==='touch'){deviceActive.set('kb',next);deviceActive.set('touch',next);}active=next;const held=deviceControls.get(device);if(held)controls.set(next,held);rebuild();}
function handleInput(e){
 if(e.type==='pads'){pads=e.pads;updatePads();return;}
 if(document.querySelector('dialog[open]'))return;
 if(e.type==='start'&&e.device.startsWith('pad:')){if(!lobby){send({t:'create'});return;}if(!seatFor(e.device)){send({t:'guest',device:e.device});return;}if(lobby.status!=='playing'&&lobby.you.host)send({t:'start'});return;}
 if(e.type==='start'&&lobby?.you.host&&lobby.status!=='playing'){send({t:'start'});return;}
 if(!lobby||lobby.status!=='playing')return;
 if(e.type==='cycle'){cycle(e.device,e.step);return;}
 if(e.type==='select'){if(allMine().includes(e.body)){stopBody(currentBody(e.device));active=e.body;deviceActive.set(e.device,e.body);const seat=lobby.assignments[e.body];deviceSeats.set(e.device,seat);rebuild();}return;}
 const b=currentBody(e.device);if(b==null)return;
 deviceActive.set(e.device,b);
 if(e.type==='control'){const c={x:e.x,rotate:e.rotate,crouch:e.crouch};deviceControls.set(e.device,c);controls.set(b,c);setControl(state,b,c);if(e.x||e.rotate)active=b;return;}
 active=b;if(['jump','snip','restore'].includes(e.type))act({type:e.type,body:b});
}
const input=createInput(handleInput);
function updateCharacters(){
 if(!lobby)return;const mine=allMine();
 const signature=active+':'+mine.join(',')+':'+state.bodies.map(b=>b.alive).join(',');
 if(updateCharacters.signature!==signature){updateCharacters.signature=signature;$('#characters').innerHTML=level.bodies.map(b=>`<button class="char-pick ${b.id===active?'active':''}" style="--c:${b.color}" data-char="${b.id}" ${mine.includes(b.id)?'':'disabled'} title="${b.name}" aria-label="Control ${b.name}" aria-pressed="${b.id===active}">${b.id+1}</button>`).join('');}
 $('#objective').textContent=!mine.length?'Spectating · Your squad is live.':!state.bodies[active]?.alive?'Press R or ↺ to reform your paper pal.':!state.released?'Jump onto the red button to release the seed.':'Carve a scoop, then carry the seed into the flowerpot.';
 $('#mission-release').classList.toggle('done',state.released);$('#mission-deliver').classList.toggle('done',state.won);
 $('#level-stats').textContent=`${Math.floor(state.time/60)}:${String(Math.floor(state.time)%60).padStart(2,'0')}  ·  ${state.snips} snip${state.snips===1?'':'s'}`;
}
function renderLobby(){
 if(!lobby){$('#menu').hidden=false;$('#game').hidden=true;renderer.show(false);attract.enabled(true);if(online)send({t:'watch-attract',enabled:true});return;}
 attract.enabled(false);
 $('#menu').hidden=true;$('#game').hidden=false;renderer.show(true);$('#lobby-code').textContent=lobby.code;
 const mine=allMine();if(!mine.includes(active))active=mine[0]??0;
 $('#lock').innerHTML=icon('lock')+(lobby.locked?'Locked':'Open');$('#lock').disabled=!lobby.you.host;$('#lock').title=lobby.locked?'New arrivals can spectate only':'Anyone can join, including during a round';
 $('#restart').hidden=!lobby.you.host||lobby.status!=='playing';
 $('#players').innerHTML=lobby.seats.map((s,i)=>s?`<div class="player-seat">${s.username?`<a href="https://websim.com/@${encodeURIComponent(s.username)}" target="_blank" rel="noopener">${img(s.avatar,s.label)}</a>`:img(s.avatar,s.label)}<div class="player-details"><span class="player-label">${s.username?`<a href="https://websim.com/@${encodeURIComponent(s.username)}" target="_blank" rel="noopener">@${escape(s.label)}</a>`:escape(s.label)}${s.mine?'<small>you</small>':''}</span><span class="player-role">P${i+1} · ${s.bodies.map(b=>`<i class="tiny-dot" style="background:${level.bodies[b].color}"></i>`).join('')} ${s.owner===lobby.host&&!s.guest?'HOST':''}</span></div>${s.guest&&(s.mine||lobby.you.host)?`<button class="seat-remove" data-remove="${escape(s.id)}" title="Remove guest">×</button>`:''}</div>`:`<button class="player-seat empty-seat" data-guest ${lobby.locked?'disabled':''}>${icon('plus')}${mine.length?'Add local guest':'Join as player'}</button>`).join('');
 const overlay=$('#round-overlay');overlay.hidden=lobby.status==='playing';
 $('#start').hidden=!lobby.you.host;
 if(lobby.status==='won'){
  $('#round-title').textContent='Signed, sealed, delivered!';$('#round-description').textContent=`Your garden is growing. ${lobby.seconds}s · ${lobby.snips} snips.`;$('#start').innerHTML='Play again '+icon('refresh');
  $('#save-status').textContent=!lobby.you.signedIn?'Sign in to websim to save future clears.':lobby.saved==='saved'?'Progress saved to your account.':lobby.saved==='guest'?'Sign in to websim to save future clears.':lobby.saved==='error'?'Puzzle cleared. Progress could not be saved.':'Saving progress…';
  if(lobby.saved==='saved')loadProgress();
 }else{
  $('#round-title').textContent='A little teamwork?';$('#round-description').textContent=lobby.you.host?'Release the seed. Carve a scoop. Get it into the flowerpot.':`Waiting for ${lobby.hostName} to start the puzzle.`;$('#start').innerHTML="Let's snip "+icon('arrow');$('#save-status').textContent='';
 }
 rebuild();
}
function quickLobbies(){
 $('#quick-lobbies').innerHTML=lobbies.length?lobbies.map(l=>`<button class="quick-lobby" data-lobby="${l.code}" aria-label="${escape(l.hostName)}'s lobby, ${l.players} of 4 players${l.locked||l.full?', join as spectator':''}" title="${escape(l.hostName)} · ${l.code} · ${l.players}/4${l.locked?' · Locked':''}">${img(l.hostAvatar,l.hostName)}<span class="quick-count">+${Math.max(0,l.players-1)}</span>${l.full?'<span class="full-badge">FULL</span>':l.locked?'<span class="full-badge">LOCK</span>':''}</button>`).join(''):'<span class="empty-lobbies">Your next squad<br>starts here.</span>';
 $('#lobby-list').innerHTML=lobbies.length?lobbies.map(l=>`<button type="button" class="lobby-row" data-lobby="${l.code}">${img(l.hostAvatar,l.hostName)}<span class="row-info"><b>@${escape(l.hostName)}</b><small>${l.code} · ${l.status==='playing'?'In a puzzle':l.status==='won'?'Puzzle complete':'Getting together'}</small></span><span>${l.full||l.locked?'Spectate':l.players+' / 4 →'}</span></button>`).join(''):'<p class="small-note">No open squads yet. Create a lobby and invite a friend.</p>';
}
function receive(m){
 if(m.t==='attract'||m.t==='attract-effect'){if(!lobby)attract.receive(m);return;}
 if(m.t==='replay-saved'&&m.id){$('#save-status').textContent+=' Instant replay saved.';return;}
 if(m.t==='welcome'){identity=m.you;online=true;connection('Ready to snip',true);}
 if(m.t==='lobbies'){lobbies=m.list;quickLobbies();}
 if(m.t==='lobby'){
  const changed=lobby?.code!==m.lobby.code||lobby?.round!==m.lobby.round,ownership=JSON.stringify(lobby?.assignments)!==JSON.stringify(m.lobby.assignments);lobby=m.lobby;lastCode=lobby.code;
  if(changed){state=createSimulation(level);renderer.reset();needsSync=false;latestSnapshot=0;}if(ownership||changed){controls.clear();deviceControls.clear();clearControls(state);}
  renderLobby();
 }
 if(m.t==='sync'||m.t==='snapshot'){
  if(!lobby||m.round!==lobby.round)return;latestSnapshot=performance.now();
  if(m.state.bodies.some(b=>!b.shape&&b.revision!==state.bodies[b.id].revision)){if(!needsSync){needsSync=true;send({t:'sync'});}return;}
  hydrate(state,m.state);needsSync=false;
  for(const [id,c]of controls)if(allMine().includes(id))setControl(state,id,c);
  rebuild();
 }
 if(m.t==='effect'&&m.round===lobby?.round){renderer.effect(m.event);if(m.event.type==='release')toast('Seed released. The bridge is open!');if(m.event.type==='seed-reset')toast('Seed returned to the chute. Try a scoop to hold it.');}
 if(m.t==='seated'){if(m.device)deviceSeats.set(m.device,m.seat);toast(m.device?'Controller joined the squad.':'Local guest added.');}
 if(m.t==='left'){lobby=null;lastCode=null;controls.clear();deviceControls.clear();deviceSeats.clear();deviceActive.clear();history.replaceState(null,'',location.pathname);renderLobby();}
 if(m.t==='hint')toast(m.msg);
 if(m.t==='error'){toast(m.msg);if(m.msg.includes('closed')){lobby=null;lastCode=null;renderLobby();}}
}
async function connect(){
 connection('Connecting',false);
 try{
  socket=await window.WebsimSocket.joinRoom();
  socket.onmessage=e=>{try{receive(JSON.parse(e.data));}catch(err){console.error('Message failed',err);toast('A sync was interrupted. Rejoining the puzzle…');send({t:'sync'});}};
  online=true;connection('Ready to snip',true);
  socket.onreconnect=()=>{online=true;controls.clear();clearControls(state);connection('Reconnected',true);if(lastCode)send({t:'join',code:lastCode});else send({t:'watch-attract',enabled:true});};
  socket.onclose=e=>{online=false;attract.disconnected();controls.clear();clearControls(state);rebuild();connection('Disconnected',false);toast(e.reason||'Connection closed. Reload to reconnect.');};
  const urlCode=new URL(location.href).searchParams.get('lobby');if(urlCode)send({t:'join',code:urlCode.toUpperCase()});else send({t:'watch-attract',enabled:true});
 }catch(err){attract.disconnected();console.error(err);connection('Connection unavailable',false);toast('Could not reach the realtime server. Reload to try again.');}
}
async function loadProgress(){try{const r=await fetch('/api/progress');if(!r.ok)return;progress=await r.json();const row=progress.rows?.find(r=>r.level===1);if(row)$('#create').title=`Level 1 cleared ${row.clears} times · Best: ${row.best_seconds}s · ${row.best_snips} snips`;}catch{}}
function updatePads(){
 $('#pad-list').innerHTML=pads.map(p=>`<div class="pad-row">${escape(p.id)} · ${p.mapping==='standard'?'Ready':'Custom mapping available'}</div>`).join('');
 $('#configure-pad').hidden=!pads.length;
 if(pads.length)toast(`${pads.length} controller${pads.length>1?'s':''} detected. ${pads.length>1?'Press Start on extra pads to add guests.':''}`);
}
$('#create').addEventListener('click',()=>send({t:'create'}));
$('#join').addEventListener('click',()=>{$('#join-dialog').showModal();$('#join-code').focus();});
$('#join-form').addEventListener('submit',e=>{e.preventDefault();if(send({t:'join',code:$('#join-code').value.trim().toUpperCase()}))$('#join-dialog').close();});
$('#help').addEventListener('click',()=>{input.clear();for(const id of allMine())stopBody(id);$('#help-dialog').showModal();});
$('#start').addEventListener('click',()=>send({t:'start'}));
$('#restart').addEventListener('click',()=>send({t:'start'}));
$('#lock').addEventListener('click',()=>send({t:'lock',locked:!lobby.locked}));
$('#leave').addEventListener('click',()=>send({t:'leave'}));
$('#code-button').addEventListener('click',async()=>{try{const u=new URL(location.href);u.searchParams.set('lobby',lobby.code);await navigator.clipboard.writeText(u.href);toast('Invite link copied. Send it to your squad.');}catch{toast('Lobby code: '+lobby.code);}});
$('#board').addEventListener('pointerdown',e=>{const id=renderer.hit(e.clientX,e.clientY);if(id!=null&&allMine().includes(id)){stopBody(currentBody('kb'));stopBody(currentBody('touch'));active=id;const seat=lobby.assignments[id];deviceSeats.set('kb',seat);deviceSeats.set('touch',seat);deviceActive.set('kb',active);deviceActive.set('touch',active);rebuild();}});
$('#help-dialog').addEventListener('close',()=>input.cancelCalibration());
$('#configure-pad').addEventListener('click',()=>{if(!pads.length)return;input.calibrate(pads[0].index,text=>$('#calibration-status').textContent=text);});
document.addEventListener('click',e=>{
 const close=e.target.closest('[data-close]');if(close)close.closest('dialog').close();
 const quick=e.target.closest('[data-lobby]');if(quick){send({t:'join',code:quick.dataset.lobby});$('#join-dialog').close();}
 const guest=e.target.closest('[data-guest]');if(guest)send({t:'guest'});
 const rem=e.target.closest('[data-remove]');if(rem)send({t:'unseat',seat:rem.dataset.remove});
 const ch=e.target.closest('[data-char]');if(ch&&!ch.disabled){stopBody(currentBody('kb'));stopBody(currentBody('touch'));active=+ch.dataset.char;const seat=lobby.assignments[active];deviceSeats.set('kb',seat);deviceSeats.set('touch',seat);deviceActive.set('kb',active);deviceActive.set('touch',active);rebuild();}
 const touch=e.target.closest('[data-action]');if(touch){if(touch.dataset.action==='cycle')cycle('touch');else handleInput({type:touch.dataset.action,device:'touch'});}
});
for(const b of document.querySelectorAll('[data-hold]')){const name=b.dataset.hold;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input.touch.hold(name,true);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>input.touch.hold(name,false));}
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
window.addEventListener('offline',()=>{online=false;controls.clear();clearControls(state);rebuild();connection('Offline',false);});
let lastFrame=performance.now();
function frame(t){const dt=Math.min((t-lastFrame)/1000,.05);lastFrame=t;if(lobby?.status==='playing'&&online&&(!latestSnapshot||t-latestSnapshot<800)){for(const [id,c]of controls)if(allMine().includes(id))setControl(state,id,c);stepSimulation(state,dt);state.events=[];renderer.set(state,active);if(t-(frame.lastUI||0)>150){frame.lastUI=t;updateCharacters();}}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(()=>{if(lobby?.status==='playing'&&online&&!document.hidden){send({t:'inputs',round:lobby.round,inputs:allMine().map(body=>({body,...(controls.get(body)||{x:0,rotate:0,crouch:false})}))});}},80);
quickLobbies();loadProgress();connect();
