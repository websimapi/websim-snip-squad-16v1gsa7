import {worldCells, SIZE} from './engine.js';
const names=['Poppy','Blu','Sunny','Sprout'];
export function createRenderer(canvas){
 const ctx=canvas.getContext('2d');let state=null,active=0,owners=[],last=performance.now(),particles=[],poses=new Map(),raf;
 const C=50,W=1100,H=650;
 function contour(cells){
  const set=new Set(cells.map(p=>p.join(','))),edges=new Map();
  const add=(x,y,nx,ny)=>{const k=x+','+y;if(!edges.has(k))edges.set(k,[]);edges.get(k).push([nx,ny]);};
  for(const [x,y] of cells){if(!set.has(x+','+(y-1)))add(x,y,x+1,y);if(!set.has((x+1)+','+y))add(x+1,y,x+1,y+1);if(!set.has(x+','+(y+1)))add(x+1,y+1,x,y+1);if(!set.has((x-1)+','+y))add(x,y+1,x,y);}
  const p=new Path2D();
  while(edges.size){const k=edges.keys().next().value,[sx,sy]=k.split(',').map(Number);let x=sx,y=sy;p.moveTo(x*C,y*C);let guard=0;
   do{const key=x+','+y,arr=edges.get(key);if(!arr?.length)break;const next=arr.pop();if(!arr.length)edges.delete(key);[x,y]=next;p.lineTo(x*C,y*C);}while((x!==sx||y!==sy)&&guard++<1000);p.closePath();
  }return p;
 }
 function label(text,x,y,size=11,color='#8f9d85',align='left'){ctx.fillStyle=color;ctx.font=`500 ${size}px "DM Sans",sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);}
 function slotMatch(s){const b=state.bodies[s.body],pts=worldCells(b);return b.alive&&pts.length===s.cells.length&&pts.every(p=>s.cells.some(q=>p[0]===q[0]&&p[1]===q[1]));}
 function draw(t){
  const dt=Math.min((t-last)/1000,.05);last=t;
  const ratio=Math.min(window.devicePixelRatio||1,2),width=Math.round(canvas.clientWidth*ratio),height=Math.round(width*H/W);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
  if(state){
   ctx.strokeStyle='#dce4d241';ctx.lineWidth=1;ctx.beginPath();for(let x=C;x<W;x+=C){ctx.moveTo(x,35);ctx.lineTo(x,H-35);}for(let y=C;y<H;y+=C){ctx.moveTo(35,y);ctx.lineTo(W-35,y);}ctx.stroke();
   ctx.strokeStyle='#d6dece';ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(600,75);ctx.lineTo(600,H-70);ctx.stroke();ctx.setLineDash([]);
   label('THE CUTTING TABLE',65,43,10);label('MATCH THE OUTLINES',685,43,10);
   const matches=state.slots.filter(slotMatch).length;
   label(`${matches} / 4`,W-55,43,12,'#718564','right');
   for(const s of state.slots){const b=state.bodies[s.body],path=contour(s.cells),done=slotMatch(s);ctx.fillStyle=b.color+(done?'24':'0d');ctx.fill(path);ctx.lineWidth=2.5;ctx.strokeStyle=b.color;ctx.setLineDash(done?[]:[7,7]);ctx.stroke(path);ctx.setLineDash([]);const minX=Math.min(...s.cells.map(p=>p[0])),maxY=Math.max(...s.cells.map(p=>p[1]));label(done?'✓':names[s.body],(minX+1)*C,(maxY+1)*C+23,11,done?'#708963':'#9da491','center');}
   const selected=state.bodies.find(b=>b.id===active),mine=new Set(selected?.alive?worldCells(selected).map(p=>p.join(',')):[]);
   for(const b of [...state.bodies].sort((a,b)=>(a.id===active)-(b.id===active))){
    if(!b.alive)continue;
    let pose=poses.get(b.id);if(!pose)poses.set(b.id,pose={x:b.x,y:b.y});
    pose.x+=(b.x-pose.x)*Math.min(1,dt*24);pose.y+=(b.y-pose.y)*Math.min(1,dt*24);
    const cells=worldCells(b),path=contour(cells),dx=(pose.x-b.x)*C,dy=(pose.y-b.y)*C;
    ctx.save();ctx.translate(dx,dy);ctx.shadowColor='#44543a20';ctx.shadowOffsetY=7;ctx.shadowBlur=0;ctx.fillStyle=b.color;ctx.fill(path);ctx.shadowColor='transparent';ctx.lineWidth=2.5;ctx.strokeStyle='#4d514040';ctx.stroke(path);
    // Fine paper grain, clipped to the actual silhouette.
    ctx.save();ctx.clip(path);ctx.fillStyle='#fff2';for(const [x,y] of cells){for(let j=0;j<4;j++){ctx.fillRect(x*C+((x*13+j*19)%49),y*C+((y*17+j*11)%49),1,1);}}ctx.restore();
    if(b.id!==active){const overlap=cells.filter(p=>mine.has(p.join(',')));if(overlap.length){const cut=contour(overlap);ctx.save();ctx.clip(cut);ctx.fillStyle='#fff7';ctx.fill(cut);ctx.strokeStyle='#45553c66';ctx.lineWidth=2;ctx.beginPath();for(let v=-H;v<W;v+=14){ctx.moveTo(v,0);ctx.lineTo(v+H,H);}ctx.stroke();ctx.restore();}}
    const avg=cells.reduce((p,q)=>[p[0]+q[0],p[1]+q[1]],[0,0]).map(v=>v/cells.length),center=cells.reduce((best,p)=>Math.hypot(p[0]-avg[0],p[1]-avg[1])<Math.hypot(best[0]-avg[0],best[1]-avg[1])?p:best,cells[0]);
    const fx=(center[0]+.5)*C,fy=(center[1]+.5)*C;
    ctx.fillStyle='#3e493d';for(const ex of [-10,10]){ctx.beginPath();ctx.ellipse(fx+ex,fy-6,3.8,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff9';ctx.fillRect(fx+ex-1,fy-9,1.7,2);ctx.fillStyle='#3e493d';}
    ctx.beginPath();ctx.arc(fx,fy+4,7,0,Math.PI);ctx.strokeStyle='#3e493d';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff3';ctx.beginPath();ctx.ellipse(fx-18,fy+5,5,3,0,0,7);ctx.ellipse(fx+18,fy+5,5,3,0,0,7);ctx.fill();
    if(b.id===active){ctx.lineWidth=2;ctx.strokeStyle='#3f563e';ctx.setLineDash([5,5]);ctx.stroke(path);ctx.setLineDash([]);const left=Math.min(...cells.map(p=>p[0]))*C,top=Math.min(...cells.map(p=>p[1]))*C;label('▼ '+names[b.id],left+10,top-13,12,'#52694b');}
    ctx.restore();
   }
   for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=130*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*8);ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(-4,-3,8,6);ctx.restore();}particles=particles.filter(p=>p.life>0);
   label('01',55,H-25,10,'#a0aa95');label('a little off the top',W-55,H-25,10,'#a0aa95','right');
  }raf=requestAnimationFrame(draw);
 }
 raf=requestAnimationFrame(draw);
 return {set(s,a,o=[]){state=s;active=a;owners=o;},reset(){poses.clear();particles=[];},burst(cells,color){for(const [x,y]of cells)for(let i=0;i<3;i++)particles.push({x:(x+.5)*C,y:(y+.5)*C,vx:(Math.random()-.5)*160,vy:-Math.random()*90,life:.7+Math.random()*.3,color});},hit(clientX,clientY){if(!state)return null;const r=canvas.getBoundingClientRect(),x=(clientX-r.left)/r.width*22,y=(clientY-r.top)/r.height*13;return [...state.bodies].reverse().find(b=>worldCells(b).some(p=>Math.floor(x)===p[0]&&Math.floor(y)===p[1]))?.id;}};
}
