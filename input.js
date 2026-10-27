// All devices produce held platformer controls and edge-triggered actions.
export function createInput(emit){
 const keys=new Set(),touchHeld=new Set(),padPrev=new Map(),lastControl=new Map();let calibration=null,raf;let custom={};
 try{custom=JSON.parse(localStorage.getItem('snipsquad-platform-pads')||'{}');}catch{}
 const steps=['jump','snip','rotCw','rotCcw','cycleNext','restore','start'],names=['JUMP','SNIP','ROTATE RIGHT','ROTATE LEFT','SWITCH CHARACTER','REFORM','START / JOIN'];
 const mapDefault={jump:0,snip:2,rotCw:5,rotCcw:4,cycleNext:1,restore:3,start:9,back:8,left:14,right:15,down:13};
 function control(device,x,rotate=0,crouch=false){const v={x,rotate,crouch},sig=JSON.stringify(v);if(lastControl.get(device)!==sig){lastControl.set(device,sig);emit({type:'control',device,...v});}}
 function keyboard(){control('kb',Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),Number(keys.has('KeyE'))-Number(keys.has('KeyQ')),keys.has('KeyS')||keys.has('ArrowDown')||keys.has('ShiftLeft'));}
 function onDown(e){if(/INPUT|TEXTAREA/.test(e.target?.tagName))return;const code=e.code;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Tab'].includes(code))e.preventDefault();if(e.repeat)return;keys.add(code);keyboard();
  const event={device:'kb'};if(['Space','KeyW','ArrowUp'].includes(code))emit({...event,type:'jump'});
  else if(code==='KeyZ'||code==='KeyX')emit({...event,type:'snip'});else if(code==='KeyR')emit({...event,type:'restore'});
  else if(code==='Tab'||code==='KeyC')emit({...event,type:'cycle',step:e.shiftKey?-1:1});else if(/^Digit[1-4]$/.test(code))emit({...event,type:'select',body:+code.at(-1)-1});
  else if(code==='Enter')emit({...event,type:'start'});
 }
 function onUp(e){keys.delete(e.code);keyboard();}
 function updateTouch(){control('touch',Number(touchHeld.has('right'))-Number(touchHeld.has('left')),Number(touchHeld.has('rotR'))-Number(touchHeld.has('rotL')),touchHeld.has('down'));}
 function clear(){keys.clear();touchHeld.clear();keyboard();updateTouch();for(const p of padPrev.values())control(p.device,0,0,false);}
 const touch={hold(name,down){down?touchHeld.add(name):touchHeld.delete(name);updateTouch();},action(type){emit({type,device:'touch',step:1});}};
 function prompt(){calibration.callback('Press the button for '+names[calibration.step]+'.');}
 function loop(){
  const pads=navigator.getGamepads?[...navigator.getGamepads()].filter(Boolean).slice(0,4):[],list=pads.map(p=>({id:p.id,index:p.index,device:'pad:'+p.index,mapping:p.mapping}));
  const signature=list.map(p=>p.index+':'+p.id).join('|');if(signature!==loop.signature){loop.signature=signature;for(const [id,prev]of padPrev)if(!pads.some(p=>p.index===id)){control(prev.device,0);padPrev.delete(id);}emit({type:'pads',pads:list});}
  for(const p of pads){const device='pad:'+p.index,prev=padPrev.get(p.index)||{device,buttons:[]},pressed=i=>!!p.buttons[i]?.pressed,edge=i=>Number.isInteger(i)&&pressed(i)&&!prev.buttons[i];
   if(calibration?.index===p.index){const i=p.buttons.findIndex((_,i)=>edge(i));if(i>=0){if(Object.values(calibration.map).includes(i))calibration.callback('Choose a different button for '+names[calibration.step]+'.');else{calibration.map[steps[calibration.step++]]=i;if(calibration.step===steps.length){custom[p.id]=calibration.map;try{localStorage.setItem('snipsquad-platform-pads',JSON.stringify(custom));}catch{}calibration.callback('Controller buttons saved on this device.');calibration=null;}else prompt();}}prev.buttons=p.buttons.map(b=>b.pressed);padPrev.set(p.index,prev);continue;}
   const m={...mapDefault,...custom[p.id]},axisOffset=!p.mapping&&/Joy-Con/i.test(p.id)&&p.axes.length>=4&&!p.axes[0]&&!p.axes[1]?2:0;
   const stick=p.axes[axisOffset]||0,x=pressed(m.left)?-1:pressed(m.right)?1:Math.abs(stick)>.2?Math.round(stick*100)/100:0;
   control(device,x,Number(pressed(m.rotCw))-Number(pressed(m.rotCcw)),pressed(m.down)||(p.axes[axisOffset+1]||0)>.6);
   if(edge(m.jump))emit({type:'jump',device});if(edge(m.snip))emit({type:'snip',device});if(edge(m.cycleNext))emit({type:'cycle',device,step:1});if(edge(m.restore))emit({type:'restore',device});if(edge(m.start))emit({type:'start',device});
   prev.buttons=p.buttons.map(b=>b.pressed);padPrev.set(p.index,prev);
  }raf=requestAnimationFrame(loop);
 }
 addEventListener('keydown',onDown);addEventListener('keyup',onUp);addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});raf=requestAnimationFrame(loop);
 return{touch,clear,cancelCalibration(){calibration=null;},calibrate(index,callback){clear();calibration={index,callback,step:0,map:{}};prompt();},destroy(){cancelAnimationFrame(raf);removeEventListener('keydown',onDown);removeEventListener('keyup',onUp);removeEventListener('blur',clear);}};
}
