import * as THREE from './assets/space/three.module.js';
import {GLTFLoader} from './assets/space/GLTFLoader.js';
const stage=document.querySelector('.blackhole-stage'),host=stage.querySelector('.blackhole-view');
const landing=document.querySelector('#home');
const preview=landing.cloneNode(true);preview.removeAttribute('id');preview.classList.add('landing-preview');preview.setAttribute('aria-hidden','true');preview.inert=true;
preview.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));preview.querySelectorAll('.fox-eyes-open,.fox-eyes-half').forEach(el=>el.remove());
stage.querySelector('.blackhole-sticky').append(preview);
document.documentElement.classList.add('cinema-ready');

let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{stage.classList.add('failed');document.documentElement.classList.remove('cinema-ready');preview.remove();}
if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x020208);renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.01,500);scene.add(new THREE.AmbientLight(0xffffff,2));let model,mixer;
const center=new THREE.Vector3();let distance=14;
new GLTFLoader().load('./assets/blackhole.glb',g=>{
 model=g.scene;
 if(g.animations.length){mixer=new THREE.AnimationMixer(model);g.animations.forEach(clip=>mixer.clipAction(clip).play());}
 const box=new THREE.Box3().setFromObject(model);box.getCenter(center);
 distance=box.getSize(new THREE.Vector3()).length()*1.4;
 camera.near=Math.max(.0001,distance*.0001);camera.far=distance*10;camera.updateProjectionMatrix();
 scene.add(model);stage.classList.add('loaded');
},undefined,()=>stage.classList.add('failed'));
const clamp=x=>Math.max(0,Math.min(1,x));let smooth=0,last=0,frame;
const sticky=stage.querySelector('.blackhole-sticky');
function resize(){const width=sticky.clientWidth,height=sticky.clientHeight;if(renderer.domElement.width!==Math.floor(width*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(height*renderer.getPixelRatio()))renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}resize();addEventListener('resize',()=>{resize();schedule()});
function render(now){const dt=Math.min(50,now-(last||now));last=now;const viewportHeight=sticky.clientHeight;const progress=clamp(scrollY/(stage.offsetHeight-viewportHeight));smooth+=(progress-smooth)*(1-Math.exp(-dt/75));const p=smooth;const blackholeVisible=p<.68&&stage.getBoundingClientRect().bottom>0;if(blackholeVisible&&mixer)mixer.update(dt/1000);
const flight=clamp(p/.68),easedFlight=flight*flight*(3-2*flight);
const zoom=distance*(Math.pow(1-easedFlight,1.7)*.995+.005);
camera.position.copy(center).add(new THREE.Vector3(0,.157,1).normalize().multiplyScalar(zoom));camera.lookAt(center);
const ease=(a,b)=>{const t=clamp((p-a)/(b-a));return t*t*(3-2*t)};
host.style.opacity=String(1-ease(.53,.68));
preview.style.setProperty('--landing-bg',ease(.72,.91));
preview.style.setProperty('--landing-moon',ease(.70,.84));
preview.style.setProperty('--landing-copy',ease(.84,.97));
preview.style.setProperty('--landing-rise',`${(1-ease(.84,.97))*18}px`);
const landed=scrollY>=stage.offsetHeight-viewportHeight-1;
const interactive=p>=.84&&!landed,focused=document.activeElement;
const transfer=landed&&preview.contains(focused)?{href:focused.closest('a')?.getAttribute('href'),to:landing}:interactive&&landing.contains(focused)?{href:focused.closest('a')?.getAttribute('href'),to:preview}:null;
landing.style.visibility=landed?'visible':'hidden';preview.style.visibility=landed?'hidden':'visible';
preview.inert=!interactive;preview.setAttribute('aria-hidden',String(!interactive));preview.style.pointerEvents=interactive?'auto':'none';
if(transfer?.href){const link=[...transfer.to.querySelectorAll('a')].find(a=>a.getAttribute('href')===transfer.href);link?.focus({preventScroll:true});}

stage.querySelector('.blackhole-skip').style.visibility=p>.75?'hidden':'visible';
stage.style.setProperty('--plunge',p);host.style.visibility=blackholeVisible?'visible':'hidden';if(blackholeVisible)renderer.render(scene,camera);frame=blackholeVisible||Math.abs(smooth-progress)>.001?requestAnimationFrame(render):0}
function schedule(){if(!frame){last=0;frame=requestAnimationFrame(render)}}
schedule();addEventListener('scroll',schedule,{passive:true});addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(!event.persisted)renderer.dispose()});addEventListener('pageshow',event=>{if(event.persisted)schedule()});}
