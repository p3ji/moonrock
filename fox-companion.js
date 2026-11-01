(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hero=document.querySelector('.hero-rock');
 const companion=document.createElement('div');companion.className='fox-companion';companion.setAttribute('aria-hidden','true');
 companion.innerHTML='<div class="fox-puppet"><img class="fox-body" src="assets/fox-awake.webp" alt=""><img class="fox-tail" src="assets/fox-awake.webp" alt=""><i class="fox-blink"></i></div><div class="fox-sparks"></div>';
 const sparks=companion.querySelector('.fox-sparks');
 for(let i=0;i<9;i++){const spark=document.createElement('i');spark.style.setProperty('--spark-x',`${Math.cos(i*2.4)*65}px`);spark.style.setProperty('--spark-y',`${-15-Math.abs(Math.sin(i*2.4))*60}px`);spark.style.setProperty('--spark-delay',`${i*.035}s`);sparks.append(spark);}
 let wasAwake=false;

 document.body.append(companion);
 let last=0,queued=false,hopTimer;
 function update(){
  queued=false;const y=scrollY,heroBox=document.querySelector('.hero').getBoundingClientRect();
  if(reduced.matches||y<120){companion.classList.remove('awake','waking');wasAwake=false;hero.style.opacity='';return;}
  if(!wasAwake){companion.classList.add('waking');wasAwake=true;setTimeout(()=>companion.classList.remove('waking'),1500);}companion.classList.add('awake');hero.style.opacity=String(Math.max(0,1-(y-120)/180));
  const mobile=innerWidth<600,size=mobile?112:175;
  const progress=Math.min(1,Math.max(0,(y-120)/450));
  const startX=innerWidth*(mobile?.52:.68),startY=Math.max(100,heroBox.top+heroBox.height*.6);
  let targetY=innerHeight*.7;
  for(const section of document.querySelectorAll('.menu-section')){const b=section.getBoundingClientRect();if(b.top<innerHeight*.78&&b.bottom>100){targetY=Math.max(80,Math.min(innerHeight-size-30,b.top+12));break;}}
  const x=startX+(innerWidth-size-(mobile?18:35)-startX)*progress;
  const top=startY+(targetY-startY)*progress;
  companion.style.width=size+'px';companion.style.left=x+'px';companion.style.top=Math.min(innerHeight-size-30,Math.max(80,top))+'px';
  if(Math.abs(y-last)>140){companion.classList.remove('hopping');void companion.offsetWidth;companion.classList.add('hopping');clearTimeout(hopTimer);hopTimer=setTimeout(()=>companion.classList.remove('hopping'),950);last=y;}
 }
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update)}};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);reduced.addEventListener('change',schedule);update();
})();
