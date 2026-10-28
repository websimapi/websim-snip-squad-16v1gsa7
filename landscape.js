import * as THREE from './vendor/three.module.js';
// Seeded geometry: the same landscape, leaf placement and wind in every replay.
export function createLandscape(scene){
 let seed=28031;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const root=new THREE.Group();scene.add(root);const dummy=new THREE.Object3D();
 const earth=new THREE.MeshStandardMaterial({color:'#84966c',roughness:1,vertexColors:true});
 const terrain=new THREE.PlaneGeometry(38,8,120,40);terrain.rotateX(-Math.PI/2);
 const p=terrain.attributes.position,colors=[];
 function height(x,z){return .22+Math.sin(x*.32+z*.24)*.34+Math.cos(x*.62-z*.6)*.16+Math.sin(z*1.1)*.08;}
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));const c=new THREE.Color('#c1cbaa').lerp(new THREE.Color('#637b54'),random()*.48);colors.push(c.r,c.g,c.b);}
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
 const ground=new THREE.Mesh(terrain,earth);ground.position.set(6.4,0,-6.5);ground.receiveShadow=true;root.add(ground);
 for(let i=0;i<6;i++){const hill=new THREE.Mesh(new THREE.SphereGeometry(2.6,40,24),new THREE.MeshStandardMaterial({color:new THREE.Color('#9cafa0').lerp(new THREE.Color('#bcc8ba'),i/8),roughness:1}));hill.scale.set(1.4,.35+random()*.16,.48);hill.position.set(-5+i*4.2,.3,-10.4);root.add(hill);}
 const rockMat=new THREE.MeshStandardMaterial({color:'#a9aa97',roughness:.94});
 const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,1),rockMat,50);
 for(let i=0;i<50;i++){const x=random()*30-15,z=random()*6-3;dummy.position.set(x+6.4,height(x,z)+.01,z-6.5);dummy.rotation.set(random(),random()*6,random());const s=.035+random()*.12;dummy.scale.set(s*1.4,s*.6,s);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.receiveShadow=true;rocks.castShadow=true;root.add(rocks);
 const bark=new THREE.MeshStandardMaterial({color:'#786b50',roughness:.95});
 const leafMat=new THREE.MeshStandardMaterial({color:'#789765',roughness:.78,side:THREE.DoubleSide});leafMat.userData.wind=true;
 const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),leafMat,1800);let li=0;
 function branch(a,b,r){const d=b.clone().sub(a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.48,r,d.length(),10),bark);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.castShadow=true;root.add(mesh);}
 for(let i=0;i<10;i++){
 const x=-4+i*2.25+(random()-.5)*.7,z=-5.2-random()*3,y=height(x-6.4,z+6.5),h=.9+random()*.75,base=new THREE.Vector3(x,y,z);
 branch(base,base.clone().add(new THREE.Vector3(.03,h,0)),.04);
 for(let k=0;k<5;k++){const a=k*2.4+i,tip=base.clone().add(new THREE.Vector3(Math.cos(a)*.36,h*(.65+random()*.28),Math.sin(a)*.25));branch(base.clone().add(new THREE.Vector3(.02,h*.45,0)),tip,.018);
 for(let j=0;j<36;j++){const az=random()*Math.PI*2,v=random()*2-1,r=Math.cbrt(random())*.42;dummy.position.copy(tip).add(new THREE.Vector3(Math.cos(az)*Math.sqrt(1-v*v)*r,v*r*.9,Math.sin(az)*Math.sqrt(1-v*v)*r));dummy.rotation.set(random()*3,random()*6,random()*3);dummy.scale.set(.038+random()*.025,.065+random()*.025,.018);dummy.updateMatrix();leaves.setMatrixAt(li,dummy.matrix);leaves.setColorAt(li,new THREE.Color('#6d8e58').lerp(new THREE.Color('#a5b87b'),random()));li++;}}
 }
 leaves.castShadow=true;leaves.receiveShadow=true;root.add(leaves);
 const grassMat=new THREE.MeshStandardMaterial({color:'#91a368',roughness:.9});grassMat.userData.wind=true;
 const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.013,.18,4),grassMat,800);
 for(let i=0;i<800;i++){const x=random()*30-15,z=random()*6-3;dummy.position.set(x+6.4,height(x,z)+.07,z-6.5);dummy.rotation.set((random()-.5)*.4,random()*6,(random()-.5)*.5);dummy.scale.set(1,.45+random(),1);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}grass.receiveShadow=true;root.add(grass);
 return root;
}
