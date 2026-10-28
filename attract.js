import {createRenderer} from './renderer.js';
import {createSimulation,hydrate} from './engine.js';
import {getLevel} from './levels.js';
export function createAttract({canvas,replayHost,label,requestSync}){
 let enabled=true,mode='idle',liveCode=null,liveRound=null,state=null,renderer=null,unmount=null,generation=0,loading=false,lastReplay=0;
 const getRenderer=()=>renderer||(renderer=createRenderer(canvas,{background:true}));
 function clearReplay(){unmount?.();unmount=null;replayHost.replaceChildren();}
 function scenic(text){canvas.hidden=false;replayHost.hidden=true;label.textContent=text;label.dataset.live='false';const r=getRenderer(),idle=createSimulation(getLevel(1));idle.attractIdle=true;r.set(idle,-1);r.show(enabled);}
 async function fallback(){
  if(!enabled||mode==='live'||loading)return;
  if(mode==='replay'&&Date.now()-lastReplay<90000)return;
  loading=true;const version=generation;
  try{
   const result=await fetch('/api/replays/random',{cache:'no-store'});if(!result.ok)throw new Error('Replay list unavailable');
   const {replay}=await result.json();if(!enabled||version!==generation||mode==='live')return;
   if(!replay){mode='idle';scenic('Waiting for the first completed run');return;}
   const response=await fetch('/api/replays/'+replay.id);if(!response.ok)throw new Error('Replay unavailable');
   const data=await response.json();
   if(data.format!==1||data.sceneVersion!==3||!data.frames?.length)throw new Error('Unsupported replay');
   const {mountReplay}=await import('./replay-player.jsx');if(!enabled||version!==generation||mode==='live')return;
   clearReplay();renderer?.dispose();renderer=null;canvas.hidden=true;replayHost.hidden=false;mode='replay';lastReplay=Date.now();label.textContent='Instant replay · Completed run';label.dataset.live='false';
   unmount=mountReplay(replayHost,data,error=>{console.warn('Replay playback failed',error);if(mode==='replay'){mode='idle';clearReplay();scenic('Replay temporarily unavailable');}});
  }catch(error){if(enabled&&version===generation&&mode!=='live'){mode='idle';scenic('Waiting for a game');console.warn(error.message);}}
  finally{loading=false;}
 }
 const retry=setInterval(()=>{if(enabled&&mode!=='live')fallback();},20000);
 scenic('Finding a live game');fallback();
 return {
  enabled(value){if(enabled===value)return;enabled=value;generation++;if(!value){renderer?.show(false);clearReplay();mode='idle';}else{mode='idle';scenic('Finding a live game');fallback();}},
  receive(message){if(!enabled)return;
   if(message.t==='attract-effect'){if(mode==='live')renderer?.effect(message.event);return;}
   if(!message.live){if(mode==='live'){generation++;mode='idle';liveCode=null;scenic('Finding a completed run');}fallback();return;}
   generation++;
   if(mode!=='live'||liveCode!==message.code||liveRound!==message.round){clearReplay();state=createSimulation(getLevel(1));getRenderer().reset();liveCode=message.code;liveRound=message.round;}
   if(message.state.bodies.some(b=>!b.shape&&b.revision!==state.bodies[b.id].revision)){requestSync();return;}
   mode='live';hydrate(state,message.state);canvas.hidden=false;replayHost.hidden=true;getRenderer().set(state,-1);renderer.show(true);label.textContent='Live · '+message.code;label.dataset.live='true';
  },
  disconnected(){generation++;mode='idle';if(enabled){scenic('Finding a completed run');fallback();}},
  dispose(){clearInterval(retry);clearReplay();renderer?.dispose();}
 };
}
