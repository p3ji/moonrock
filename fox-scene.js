(() => {
 const sleeping=document.querySelector('#home .hero-rock'),hero=document.querySelector('#home');
 if(!sleeping||!hero)return;
 sleeping.classList.add('sleeping-fox-scene');
 const half=new Image(),open=new Image();
 half.src='assets/fox-natural/eyes-half.webp';half.className='fox-eyes-half';half.alt='';half.setAttribute('aria-hidden','true');
 open.src='assets/fox-natural/eyes-open.webp';open.className='fox-eyes-open';open.alt='';open.setAttribute('aria-hidden','true');
 sleeping.parentElement.append(half,open);
 let frame=0,current=0,last=0;
 const clamp=v=>Math.max(0,Math.min(1,v));
 const ease=v=>{const t=clamp(v);return t*t*(3-2*t)};
 function update(now){
  frame=0;const target=clamp((scrollY-hero.offsetTop-40)/280),dt=last?Math.min(50,now-last):16;last=now;
  current+=(target-current)*(1-Math.exp(-dt/85));if(Math.abs(target-current)<.001)current=target;
  const ready=half.complete&&half.naturalWidth&&open.complete&&open.naturalWidth;
  half.style.opacity=ready?String(ease(current*2)):'0';
  open.style.opacity=ready?String(ease(current*2-1)):'0';
  sleeping.alt=current>.8?'A three-tailed silver fox resting on a golden crescent, its eyes softly open':current>.15?'A three-tailed silver fox slowly waking on a golden crescent':'A three-tailed silver fox sleeping on a golden crescent moon';
  if(current!==target)frame=requestAnimationFrame(update);else last=0;
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update)}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);half.addEventListener('load',schedule);open.addEventListener('load',schedule);schedule();
})();
