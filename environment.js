import * as THREE from './vendor/three.module.js';
export function createEnvironment(scene){
 const uniforms={time:{value:0},sunDir:{value:new THREE.Vector3()},day:{value:1},moonPhase:{value:.7}};
 const sky=new THREE.Mesh(new THREE.PlaneGeometry(40,24),new THREE.ShaderMaterial({depthWrite:false,uniforms,
 vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`
 precision highp float;
 varying vec2 vUv;uniform float time;uniform vec3 sunDir;uniform float day;uniform float moonPhase;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float a=.5,n=0.;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+7.1;a*=.5;}return n;}
 void main(){
 vec2 world=(vUv-.5)*vec2(40.,24.);vec3 ray=normalize(vec3(world.x,world.y+7.,-12.));
 float h=clamp(ray.y*.8+.3,0.,1.);
 vec3 daylight=mix(vec3(.76,.84,.78),vec3(.10,.34,.63),h);
 vec3 night=mix(vec3(.09,.14,.23),vec3(.012,.025,.075),h);
 vec3 col=mix(night,daylight,day);
 float dusk=(1.-smoothstep(.01,.4,abs(sunDir.y)));
 col+=vec3(.5,.16,.045)*dusk*pow(1.-h,3.);
 vec3 moonDir=vec3(-sunDir.xy,sunDir.z);
 vec2 sunLocal=world-sunDir.xy*vec2(11.,3.2);vec2 moonLocal=world-moonDir.xy*vec2(11.,3.2);
 float sd=length(sunLocal)/12.;float md=length(moonLocal)/12.;
 col+=vec3(1.,.55,.17)*exp(-sd*9.)*.5;
 col+=vec3(1.,.85,.55)*(1.-smoothstep(.031,.039,sd))*2.5;
 float moon=1.-smoothstep(.028,.032,md);
 vec3 mr=normalize(cross(vec3(0.,1.,0.),moonDir));
 float mx=moonLocal.x/.36;
 float my=moonLocal.y/.36;
 float mz=sqrt(max(0.,1.-mx*mx-my*my));
 float phaseLight=smoothstep(-.07,.09,mx*sin(moonPhase*6.283)+mz*cos(moonPhase*6.283));
 col=mix(col,vec3(.64,.75,.91)*(.14+.86*phaseLight),moon*(1.-day));
 vec2 starcell=floor(vUv*vec2(1000.,600.));float stars=step(.9982,hash(starcell))*pow(1.-day,3.);
 col+=stars*vec3(.6,.72,1.)*(.65+.35*sin(time*.5+hash(starcell)*60.));
 vec2 p=world*vec2(.20,.32)+vec2(time*.018,time*.003);
 float density=fbm(p+fbm(p*.6+time*.003));
 float cloud=smoothstep(.47,.69,density)*.88;
 float edge=fbm(p+sunDir.xy*.28)-density;
 vec3 cloudColor=mix(vec3(.12,.17,.27),vec3(.90,.93,.91),day);
 cloudColor+=vec3(1.,.75,.43)*max(0.,edge)*day*3.;
 cloudColor*=.8+.3*smoothstep(.48,.6,density);
 col=mix(col,cloudColor,cloud);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}));
 sky.position.set(6.4,4,-12);sky.renderOrder=-10;scene.add(sky);
 const hemi=new THREE.HemisphereLight(0xc5e7ff,0x695840,1.55);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffefcf,3.6),moon=new THREE.DirectionalLight(0x9dbaff,.35);
 for(const light of [sun,moon]){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-9,right:9,top:7,bottom:-7,near:.5,far:36});light.shadow.bias=-.00012;light.shadow.normalBias=.012;light.shadow.radius=3;light.target.position.set(6.4,2,0);scene.add(light,light.target);}
 const fill=new THREE.DirectionalLight(0xfff3e1,2.0);fill.position.set(3,8,12);scene.add(fill);
 // Layered terrain and trees are real geometry beyond the glass, not a wall receiving floating shadows.
 const distant=new THREE.Group();scene.add(distant);
 function mesh(geo,color,x,y,z){const o=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:1}));o.position.set(x,y,z);distant.add(o);return o;}
 for(let layer=0;layer<3;layer++){
 const shape=new THREE.Shape();shape.moveTo(-14,-2);for(let i=0;i<=80;i++){let x=-14+i*.5;let y=.55+layer*.46+Math.sin(x*.32+layer*1.7)*.6+Math.sin(x*.67+layer)*.22;shape.lineTo(x,y);}shape.lineTo(26,-2);shape.closePath();mesh(new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false}),['#748d7b','#91a696','#a6b6a3'][layer],0,0,-5-layer*1.5);
 }
 for(let i=0;i<9;i++){const x=-3+i*2.5,y=.4+Math.sin(x*.32)*.45,h=.65+(i%3)*.16;mesh(new THREE.CylinderGeometry(.025,.065,h,12),'#777a61',x,y+h*.4,-5.1);for(let j=0;j<3;j++){const crown=mesh(new THREE.SphereGeometry(.37+(i%3)*.035,24,16),i%2?'#83a386':'#94af8b',x+(j-1)*.22,y+h+(j%2)*.22,-5.1-(j%2)*.15);crown.scale.set(1,1.2,1);}}
 // Project the animated cloud layer onto receiving surfaces, attenuating direct light only.
 const decorated=new WeakSet();
 function cloudMaterials(){scene.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){
 if(!m?.isMeshStandardMaterial||decorated.has(m))continue;decorated.add(m);
 m.onBeforeCompile=shader=>{
 shader.uniforms.cloudTime=uniforms.time;shader.uniforms.cloudSun=uniforms.sunDir;shader.uniforms.cloudDay=uniforms.day;
 shader.vertexShader='varying vec3 vCloudWorld;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','vCloudWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
 shader.fragmentShader='varying vec3 vCloudWorld; uniform float cloudTime; uniform vec3 cloudSun; uniform float cloudDay;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 float chash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float cnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(chash(i),chash(i+vec2(1,0)),f.x),mix(chash(i+vec2(0,1)),chash(i+vec2(1,1)),f.x),f.y);}
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
 vec2 cloudPoint=vCloudWorld.xz+cloudSun.xz*((10.-vCloudWorld.y)/max(.18,abs(cloudSun.y)));
 vec2 cp=cloudPoint*.2+vec2(cloudTime*.018,cloudTime*.003);
 float cloudDensity=cnoise(cp)*.65+cnoise(cp*2.03+7.1)*.35;
 float cloudShade=1.-smoothstep(.43,.72,cloudDensity)*.28*cloudDay;
 reflectedLight.directDiffuse*=cloudShade;reflectedLight.directSpecular*=cloudShade;
 `);
 };m.customProgramCacheKey=()=> 'garden-cloud-shadow-v1';m.needsUpdate=true;
 }});}
 let elapsed=0;
 return {update(dt){
 cloudMaterials();elapsed+=dt;const a=.98+elapsed*Math.PI*2/240;
 const dir=new THREE.Vector3(Math.cos(a)*.88,Math.sin(a),-.62).normalize();
 const day=THREE.MathUtils.smoothstep(dir.y,-.16,.25);
 uniforms.time.value=elapsed;uniforms.sunDir.value.copy(dir);uniforms.day.value=day;uniforms.moonPhase.value=(.13+elapsed/1920)%1;
 sun.position.copy(sun.target.position).addScaledVector(dir,17);moon.position.copy(moon.target.position).addScaledVector(new THREE.Vector3(-dir.x,-dir.y,dir.z),17);
 // Twilight stays readable; only the dominant celestial source casts a shadow.
 sun.intensity=3.4*THREE.MathUtils.smoothstep(dir.y,-.08,.3)*(1.-.13*Math.sin(elapsed*.07));sun.color.setRGB(1, .72+.23*day,.48+.4*day);
 moon.intensity=.65*(1.-day);sun.castShadow=day>.3;moon.castShadow=day<=.3;
 hemi.intensity=.48+day*1.1;hemi.color.set(day>.4?0xc5e7ff:0x7b94cb);fill.intensity=.55+day*1.5;fill.color.set(day>.4?0xfff3e1:0xa8bde5);
 }};
}
