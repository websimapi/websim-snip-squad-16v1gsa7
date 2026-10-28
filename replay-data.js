// Decode immutable, frame-addressable JSON without re-running physics.
export function replayState(data,index){
 const f=data.frames[Math.max(0,Math.min(index,data.frames.length-1))],level=data.scene.level;
 return {time:f[0],bodies:f[1].map((b,id)=>({id,name:level.bodies[id].name,color:level.bodies[id].color,x:b[0],y:b[1],angle:b[2],alive:!!b[5],revision:b[6],grounded:!!b[7],shape:data.geometry[id+':'+b[6]],physics:{velocity:{x:b[3],y:b[4]}}})),ball:f[2]?{position:{x:f[2][0],y:f[2][1]},angle:f[2][2]}:null,released:!!(f[3]&1),bridge:!!(f[3]&1),won:!!(f[3]&2),snips:f[4],actions:f[5],hold:f[6],visual:{clock:f[7][0],bridge:f[7][1],buttonY:f[7][2],flower:f[7][3]}};
}
