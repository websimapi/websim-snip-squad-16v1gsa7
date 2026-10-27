import * as THREE from './vendor/three.module.js';
import {worldShape,overlapShape,contains,polygonArea} from './engine.js';
import {getLevel} from './levels.js';
const S=.01, H=720;
export function createRenderer(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8eddf');
 const camera=new THREE.OrthographicCamera(-7.05,7.05,3.97,-3.97,.1,70);camera.position.set(6.4,5.65,24);camera.lookAt(6.4,3.6,0);
 const ambient=new THREE.HemisphereLight(0xfffff1,0x9ba98c,2.5);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xfff2d6,3.2);sun.position.set(-3,12,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-8;sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;sun.shadow.radius=4;scene.add(sun);scene.add(new THREE.AmbientLight(0xffffff,.35));
 const level=getLevel(1),roots=[],materials=new Map(),poses=new Map(),scraps=[],raycaster=new THREE.Raycaster();let sim=null,active=0,visible=false,last=performance.now(),lastPreview=0,bridgeVisual=0,flowerVisual=0,worldVersion=0;
 const staticRoot=new THREE.Group(),dynamicRoot=new THREE.Group(),previewRoot=new THREE.Group();scene.add(staticRoot,dynamicRoot,previewRoot);
 const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
 const cream=mat('#f7f2df'),green=mat('#8eaa87'),dark=mat('#435842'),wood=mat('#d5ad76'),soil=mat('#8d6a4b'),terra=mat('#d28668'),inside=mat('#ae6d51'),ink=mat('#39423a');
 const px=(x,y,z=0)=>new THREE.Vector3(x*S,(H-y)*S,z);
 function box(x,y,w,h,depth,color,z=-.08,parent=staticRoot){const m=new THREE.Mesh(new THREE.BoxGeometry(w*S,h*S,depth*S),typeof color==='string'?mat(color):color);m.position.copy(px(x+w/2,y+h/2,z));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function cylinder(x,y,r,h,color,z=.1,parent=staticRoot){const m=new THREE.Mesh(new THREE.CylinderGeometry(r*S,r*S,h*S,32),color);m.position.copy(px(x,y,z));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function rod(a,b,radius,color,parent=staticRoot){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,d.length(),10),color);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.castShadow=true;parent.add(m);return m;}
 function line(points,color,width=1,parent=staticRoot){const geo=new THREE.BufferGeometry().setFromPoints(points);const m=new THREE.Line(geo,new THREE.LineBasicMaterial({color,linewidth:width}));parent.add(m);return m;}
 function label(text,x,y,size=22,color='#81916f',z=-.8){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${size*3}px "DM Sans",sans-serif`;ctx.fillText(text,512,64);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));m.scale.set(3.6,.45,1);m.position.copy(px(x,y,z));staticRoot.add(m);return m;}
 function disposeGroup(g,ownedMaterials=false){const materials=new Set();for(const c of [...g.children]){g.remove(c);c.traverse(o=>{o.geometry?.dispose();if(ownedMaterials)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&m!==ink)materials.add(m);});}for(const m of materials)m.dispose();}
 // A shallow theatre set: everything has depth, bevels and soft physical shadows.
 const back=box(-90,-45,1460,820,12,'#f5f3e7',-1.05);back.castShadow=false;
 for(let x=-20;x<1350;x+=40)line([px(x,-10,-.98),px(x,715,-.98)],'#e0e6d5');
 for(let y=0;y<740;y+=40)line([px(-40,y,-.98),px(1320,y,-.98)],'#e0e6d5');
 // Frame of a miniature paper greenhouse.
 for(const x of [37,1245])box(x,52,8,586,12,'#c0ceb4',-.76);
 box(37,52,1216,8,12,'#c0ceb4',-.76);box(37,300,1216,5,8,'#d4dec8',-.79);
 for(const x of [340,645,950])box(x,57,5,581,8,'#d4dec8',-.79);
 label('P A P E R   G A R D E N',645,105,12,'#a5b397');
 label('01  /  SPECIAL DELIVERY',224,85,8,'#7d9171');
 for(const p of level.platforms){
  box(p.x,p.y,p.w,p.h,62,p.kind==='ground'?'#d8c8a3':'#d9b987',-.05);
  box(p.x-2,p.y-3,p.w+4,8,69,p.kind==='ground'?'#9aae87':'#b7c59b',.01);
  if(p.kind==='ground'){for(let i=0;i<p.w;i+=42)box(p.x+i+7,p.y+18,26,2,1,'#c5b591',.315);}
  else {box(p.x+12,p.y+p.h,9,Math.max(0,640-p.y-p.h),18,'#bfa47a',-.17);box(p.x+p.w-21,p.y+p.h,9,Math.max(0,640-p.y-p.h),18,'#bfa47a',-.17);}
 }
 // Recess under the folding bridge.
 box(520,682,180,35,80,'#b6c7b5',-.27);for(let i=0;i<6;i++)box(526+i*30,692,19,3,1,'#8da996',.14);
 const bridge=new THREE.Group();bridge.position.copy(px(520,640,0));staticRoot.add(bridge);
 for(let i=0;i<6;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.65),i%2?wood:mat('#e2c69b'));m.position.set((i+.5)*.3,-.06,0);m.castShadow=true;m.receiveShadow=true;bridge.add(m);line([new THREE.Vector3(i*.3,.008,.32),new THREE.Vector3((i+1)*.3,.008,.32)],'#8c8668',1,bridge);}
 // Raised pressure button.
 cylinder(205,497,40,10,wood,.02);const button=cylinder(205,488,30,13,mat('#da8b75'),.02);
 label('RELEASE',205,455,7,'#91a17d',-.25);
 // Paper seed chute, transparent shaft hints where the seed will fall.
 box(365,143,70,28,48,'#e7c987',-.1);box(374,166,52,34,43,'#d9b678',-.1);
 box(371,200,5,35,43,'#d9b678',-.1);box(424,200,5,35,43,'#d9b678',-.1);
 label('SEED POST',400,126,8,'#a69d7a',-.1);
 // Open flowerpot matches the three collision walls, with a visible hollow interior.
 const pot=level.pot,potGroup=new THREE.Group();staticRoot.add(potGroup);
 box(pot.x-pot.w/2,pot.y-pot.h,10,pot.h,52,terra,.03,potGroup);box(pot.x+pot.w/2-10,pot.y-pot.h,10,pot.h,52,terra,.03,potGroup);
 box(pot.x-pot.w/2,pot.y-10,pot.w,10,52,terra,.03,potGroup);
 box(pot.x-pot.w/2,pot.y-pot.h,pot.w,pot.h,5,inside,-.22,potGroup);
 // Low front face leaves the real opening readable.
 box(pot.x-pot.w/2,pot.y-42,pot.w,42,6,terra,.31,potGroup);
 box(pot.x-pot.w/2-4,pot.y-pot.h,18,10,60,mat('#e4a080'),.03,potGroup);box(pot.x+pot.w/2-14,pot.y-pot.h,18,10,60,mat('#e4a080'),.03,potGroup);
 const target=new THREE.Mesh(new THREE.TorusGeometry(.35,.012,6,48,Math.PI*2),new THREE.MeshBasicMaterial({color:'#e5c875',transparent:true,opacity:.65}));target.position.copy(px(pot.x,pot.y-56,.34));potGroup.add(target);
 label('SPECIAL DELIVERY',pot.x,pot.y-pot.h-28,7,'#92a179',-.25);
 // Garden details sit behind the play plane and cannot block movement.
 for(const [x,y]of [[32,636],[1226,633],[735,638],[1010,503]]){
  const root=px(x,y,-.4);for(let k=0;k<4;k++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),mat(k%2?'#9ab38b':'#799b77'));leaf.scale.set(.55,1.9,.25);leaf.position.copy(root).add(new THREE.Vector3((k-1.5)*.075,.13+(k%2)*.07,0));leaf.rotation.z=(k-1.5)*-.28;staticRoot.add(leaf);}
 }
 for(let i=0;i<3;i++){const cloud=new THREE.Group();for(let j=0;j<3;j++){const m=new THREE.Mesh(new THREE.SphereGeometry(.19+j*.045,16,12),cream);m.scale.set(1.3,.7,.3);m.position.set(j*.24,(j%2)*.07,0);cloud.add(m);}cloud.position.copy(px(590+i*195,190+(i%2)*30,-.6));staticRoot.add(cloud);}
 // The seed is a real rigid ball. Its thin seam makes rotation visible.
 const seed=new THREE.Group(),seedMesh=new THREE.Mesh(new THREE.SphereGeometry(.19,28,20),mat('#e4bd5c',.55));seedMesh.castShadow=true;seed.add(seedMesh);
 for(const rot of [0,Math.PI/2]){const seam=new THREE.Mesh(new THREE.TorusGeometry(.191,.007,5,48),mat('#aa873b'));seam.rotation.y=rot;seed.add(seam);}dynamicRoot.add(seed);seed.position.copy(px(level.seed.x,level.seed.y,.06));
 const flower=new THREE.Group();flower.position.copy(px(pot.x,pot.y-10,0));staticRoot.add(flower);
 rod([0,0,0],[0,1.18,0],.025,green,flower);
 for(const sign of [-1,1]){const l=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),green);l.scale.set(1.4,.5,.2);l.rotation.z=sign*.6;l.position.set(sign*.2,.47+sign*.08,0);flower.add(l);}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,p=new THREE.Mesh(new THREE.SphereGeometry(.16,14,10),mat(i%2?'#f2c5a0':'#e8a58d'));p.scale.set(.8,1.35,.5);p.rotation.z=-a;p.position.set(Math.sin(a)*.21,1.2+Math.cos(a)*.21,.02);flower.add(p);}
 const pollen=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12),mat('#e6c45e'));pollen.scale.z=.5;pollen.position.set(0,1.2,.13);flower.add(pollen);flower.scale.setScalar(.001);
 // Stripes show the exact material the selected shape would remove.
 const stripeCanvas=document.createElement('canvas');stripeCanvas.width=64;stripeCanvas.height=64;const sc=stripeCanvas.getContext('2d');sc.fillStyle='#fff9';sc.fillRect(0,0,64,64);sc.strokeStyle='#617157bb';sc.lineWidth=5;for(let i=-64;i<128;i+=20){sc.beginPath();sc.moveTo(i,0);sc.lineTo(i+64,64);sc.stroke();}const stripe=new THREE.CanvasTexture(stripeCanvas);stripe.wrapS=stripe.wrapT=THREE.RepeatWrapping;stripe.repeat.set(3,3);const previewMaterial=new THREE.MeshBasicMaterial({map:stripe,transparent:true,opacity:.75,depthTest:false,side:THREE.DoubleSide});
 function shapePaths(shape){return shape.map(poly=>{const outer=poly[0];const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(p[0]*S,-p[1]*S)));for(const ring of poly.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p[0]*S,-p[1]*S))));return shape;});}
 function makeCharacter(b){
  const group=new THREE.Group();group.userData.id=b.id;dynamicRoot.add(group);
  const body=new THREE.Group(),features=new THREE.Group(),legs=new THREE.Group();group.add(body,features,legs);
  const halo=new THREE.Mesh(new THREE.RingGeometry(.16,.19,32),new THREE.MeshBasicMaterial({color:'#50684d',side:THREE.DoubleSide,transparent:true,opacity:.65}));halo.rotation.x=-Math.PI/2;group.add(halo);
  const marker=new THREE.Mesh(new THREE.ConeGeometry(.055,.09,3),mat('#4b6649'));marker.rotation.z=Math.PI;group.add(marker);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;const lc=labelCanvas.getContext('2d');lc.fillStyle='#52694b';lc.font='600 29px "DM Sans", sans-serif';lc.textAlign='center';lc.fillText(b.name,128,40);const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true,depthTest:false}));tag.scale.set(.95,.24,1);group.add(tag);
  return {group,body,features,legs,halo,marker,tag,revision:-1};
 }
 function rebuildCharacter(r,b){
  disposeGroup(r.body,true);disposeGroup(r.features,true);disposeGroup(r.legs,true);
  const color=new THREE.Color(b.color),faceMat=mat(b.color),edgeMat=mat(color.clone().multiplyScalar(.75));
  for(const path of shapePaths(b.shape)){const geometry=new THREE.ExtrudeGeometry(path,{depth:.13,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.009,curveSegments:20});const mesh=new THREE.Mesh(geometry,[faceMat,edgeMat]);mesh.position.z=-.05;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.id=b.id;r.body.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,40),new THREE.LineBasicMaterial({color:color.clone().multiplyScalar(.65),transparent:true,opacity:.55}));edge.position.copy(mesh.position);r.body.add(edge);}
  if(b.alive){
   // Put the face on remaining material, outside any hole created by a cut.
   let best=[0,8],bestScore=-Infinity;for(let y=-45;y<=45;y+=8)for(let x=-34;x<=34;x+=8){if(!contains(b.shape,x,y))continue;let room=0;for(const dx of[-13,0,13])for(const dy of[-11,0,11])if(contains(b.shape,x+dx,y+dy))room++;const score=room*25-Math.hypot(x,y-6);if(score>bestScore){best=[x,y];bestScore=score;}}
   r.faceAnchor=best;
   for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.037,14,10),ink);eye.scale.set(.7,1.45,.6);eye.position.set((best[0]+side*11)*S,-best[1]*S+.045,.105);r.features.add(eye);const glint=new THREE.Mesh(new THREE.SphereGeometry(.01,8,6),mat('#fff8ed'));glint.position.copy(eye.position).add(new THREE.Vector3(-.005,.017,.022));r.features.add(glint);const cheek=new THREE.Mesh(new THREE.SphereGeometry(.048,12,8),new THREE.MeshBasicMaterial({color:'#fff1d5',transparent:true,opacity:.3}));cheek.scale.set(1.2,.5,.1);cheek.position.set((best[0]+side*20)*S,-best[1]*S-.035,.11);r.features.add(cheek);}
   const points=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI;points.push(new THREE.Vector3(best[0]*S+Math.cos(a)*.07,-best[1]*S-.015-Math.sin(a)*.055,.115));}r.features.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.008,5,false),ink));
   for(const side of[-1,1]){const foot=new THREE.Mesh(new THREE.SphereGeometry(.043,10,8),ink);foot.scale.set(1.2,.45,.7);r.legs.add(foot);}
  }r.revision=b.revision;
 }
 function preview(){disposeGroup(previewRoot);if(!sim||!sim.bodies[active]?.alive)return;for(const b of sim.bodies){if(b.id===active)continue;const shape=overlapShape(sim.bodies[active],b);if(polygonArea(shape)<2)continue;const paths=shapePaths(shape);for(const path of paths){const mesh=new THREE.Mesh(new THREE.ShapeGeometry(path),previewMaterial);mesh.position.set(0,H*S,.38);mesh.renderOrder=10;previewRoot.add(mesh);}}}
 function draw(t){
  const dt=Math.min((t-last)/1000,.05);last=t;
  if(visible&&canvas.clientWidth>0){
   const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
   if(sim){
    for(const b of sim.bodies){let r=roots[b.id];if(!r)roots[b.id]=r=makeCharacter(b);if(r.revision!==b.revision)rebuildCharacter(r,b);r.group.visible=b.alive;if(!b.alive)continue;
     let pose=poses.get(b.id);if(!pose)poses.set(b.id,pose={x:b.x,y:b.y,a:b.angle});const mix=1-Math.exp(-dt*(b.id===active?35:19));pose.x+=(b.x-pose.x)*mix;pose.y+=(b.y-pose.y)*mix;let da=b.angle-pose.a;da=Math.atan2(Math.sin(da),Math.cos(da));pose.a+=da*mix;
     r.group.position.copy(px(pose.x,pose.y,.02+b.id*.035));r.body.rotation.z=r.features.rotation.z=-pose.a;
     const pts=worldShape(b).flatMap(p=>p[0]),bottom=Math.max(...pts.map(p=>p[1])),top=Math.min(...pts.map(p=>p[1]));
     const stride=Math.sin(t*.018+ b.id)*Math.min(Math.abs(b.physics?.velocity.x||0)/4,1)*.045;
     r.legs.children.forEach((foot,i)=>{foot.position.set((i?1:-1)*.15,-(bottom-b.y)*S+.015+(i?stride:-stride),.05);});
     r.halo.visible=r.marker.visible=r.tag.visible=b.id===active;r.halo.position.set(0,-(bottom-b.y)*S+.006,0);r.marker.position.set(0,(b.y-top)*S+.2,.1);r.tag.position.set(0,(b.y-top)*S+.43,.1);
    }
    if(sim.ball){seed.position.copy(px(sim.ball.position.x,sim.ball.position.y,.08));seed.rotation.z=-sim.ball.angle;}else seed.position.copy(px(level.seed.x,level.seed.y,.02));
    bridgeVisual+=(Number(sim.bridge)-bridgeVisual)*Math.min(1,dt*5);bridge.scale.x=Math.max(.015,bridgeVisual);bridge.visible=bridgeVisual>.02;
    button.position.y=(H-(sim.released?494:488))*S;target.rotation.z=t*.0002;target.material.opacity=.4+Math.sin(t*.003)*.15;
    flowerVisual+=(Number(sim.won)-flowerVisual)*Math.min(1,dt*2);flower.scale.setScalar(Math.max(.001,flowerVisual));flower.rotation.z=Math.sin(t*.002)*.04*flowerVisual;
    if(t-lastPreview>90){lastPreview=t;preview();}
   }
   for(const p of scraps){p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=3*dt;p.mesh.rotation.z+=p.spin*dt;p.mesh.material.opacity=Math.min(1,p.life);if(p.life<=0){dynamicRoot.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}}for(let i=scraps.length-1;i>=0;i--)if(scraps[i].life<=0)scraps.splice(i,1);
   renderer.render(scene,camera);
  }requestAnimationFrame(draw);
 }
 requestAnimationFrame(draw);
 return {set(s,a){sim=s;active=a;},show(v){visible=v;},reset(){poses.clear();disposeGroup(previewRoot);},effect(e){if(e.type!=='cut')return;const color=level.bodies[e.body].color;const points=e.shape.flatMap(poly=>poly[0]);for(let i=0;i<Math.min(18,points.length);i++){const p=points[Math.floor(i/Math.min(18,points.length)*points.length)];const m=new THREE.Mesh(new THREE.BoxGeometry(.04+Math.random()*.06,.08,.02),new THREE.MeshStandardMaterial({color,transparent:true}));m.position.copy(px(p[0],p[1],.2));dynamicRoot.add(m);scraps.push({mesh:m,life:1+Math.random()*.5,velocity:new THREE.Vector3((Math.random()-.5)*2,Math.random()*1.2,Math.random()*1.4),spin:(Math.random()-.5)*8});}},hit(x,y){const bounds=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1),camera);const found=raycaster.intersectObjects(roots.filter(Boolean).map(r=>r.body),true);return found[0]?.object.userData.id;}};
}
