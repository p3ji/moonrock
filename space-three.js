import * as THREE from './assets/space/three.module.js';
const overlay=document.querySelector('#arrival');
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{overlay.hidden=true;}
if(renderer){
renderer.domElement.className='cosmic-canvas';overlay.prepend(renderer.domElement);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x030611);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.05,1800);
function points(count,fn,size){const pos=[],colors=[];for(let i=0;i<count;i++){const p=fn(i);pos.push(...p.slice(0,3));const c=new THREE.Color(p[3]||0xd9e3ff);colors.push(c.r,c.g,c.b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const obj=new THREE.Points(g,new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(obj);return obj;}
let seed=78;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
points(6500,()=>[(rand()-.5)*1000,(rand()-.5)*700,-rand()*1100,0xcddcff],.32);
const galaxy=points(22000,i=>{const r=Math.pow(rand(),.6)*90,a=r*.12+(i%4)*Math.PI/2+(rand()-.5)*.5;return [Math.cos(a)*r,(rand()-.5)*(5-r*.035),Math.sin(a)*r,i%8===0?0xf8d4a3:i%3===0?0x899bfa:0xd6c7eb]},.32);galaxy.position.set(0,0,-140);galaxy.rotation.z=.3;galaxy.rotation.x=.5;
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'#fff7d8');gradient.addColorStop(.12,'#ffdd9e');gradient.addColorStop(.4,'#d5914a55');gradient.addColorStop(1,'#00000000');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));glow.position.set(-55,25,-360);glow.scale.set(90,90,1);scene.add(glow);
scene.add(new THREE.AmbientLight(0xa4b9e5,.25));const sun=new THREE.DirectionalLight(0xffe0ac,3.5);sun.position.set(-70,40,0);scene.add(sun);
const loader=new THREE.TextureLoader();function planet(file,r,x,y,z){const map=loader.load(file);map.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,64,48),new THREE.MeshStandardMaterial({map,roughness:1}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
const earth=planet('./assets/space/earth.jpg',22,-30,5,-340);earth.rotation.z=.18;
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(22.45,48,32),new THREE.MeshBasicMaterial({color:0x5c9cf5,transparent:true,opacity:.12,side:THREE.BackSide}));earth.add(atmosphere);
const moon=planet('./assets/space/moon.jpg',13,8,-5,-450);
const cafe=new THREE.Group();cafe.position.set(8,-3,-437.1);scene.add(cafe);
const building=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.5,1.5),new THREE.MeshStandardMaterial({color:0x44404a,roughness:.8}));cafe.add(building);
const windowMat=new THREE.MeshBasicMaterial({color:0xffce7d});for(const x of [-.8,0,.8]){const win=new THREE.Mesh(new THREE.PlaneGeometry(.52,1),windowMat);win.position.set(x,0,.76);cafe.add(win);}const roof=new THREE.Mesh(new THREE.ConeGeometry(2.1,.7,4),new THREE.MeshStandardMaterial({color:0x353747}));roof.rotation.y=Math.PI/4;roof.position.y=1.1;cafe.add(roof);
const light=new THREE.PointLight(0xffbb66,8,15);light.position.set(8,-2,-434);scene.add(light);
const rail=new THREE.CatmullRomCurve3([new THREE.Vector3(0,95,90),new THREE.Vector3(0,38,-65),new THREE.Vector3(4,8,-220),new THREE.Vector3(24,9,-320),new THREE.Vector3(12,0,-400),new THREE.Vector3(8,-2,-427)]);
let frame,start=0;const target=new THREE.Vector3();function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}resize();addEventListener('resize',resize);
function render(now){if(overlay.hidden){cancelAnimationFrame(frame);return;}const t=Math.max(0,Math.min(1,(now-start)/14000));camera.position.copy(rail.getPointAt(t));if(t<.76)target.copy(rail.getPointAt(Math.min(1,t+.035)));else target.set(8,-3,-450).lerp(new THREE.Vector3(8,-3,-437),Math.min(1,(t-.76)/.24));camera.lookAt(target);earth.rotation.y+=.0008;renderer.render(scene,camera);frame=requestAnimationFrame(render);}
function run(){if(overlay.hidden)return;start=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}
new MutationObserver(()=>{if(!overlay.hidden)run();else cancelAnimationFrame(frame)}).observe(overlay,{attributes:true,attributeFilter:['hidden']});run();
}
