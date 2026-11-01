(() => {
  const arrival = document.querySelector('#arrival');
  const replay = document.querySelector('#replay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let timer;
  let running = false;
  const remember = () => { try { sessionStorage.setItem('moonrock-arrived', '1'); } catch {} };
  const finish = (goToMenu = false) => {
    clearTimeout(timer);
    const focusedInside = arrival.contains(document.activeElement);
    arrival.hidden = true;
    running = false;
    remember();
    if (goToMenu) {
      const menu = document.querySelector('#menu');
      menu.scrollIntoView({behavior:'instant'});
      menu.setAttribute('tabindex','-1');
      menu.focus({preventScroll:true});
    } else if (focusedInside) replay.focus({preventScroll:true});
  };
  const stars = arrival.querySelector('.flight-stars');
  for (let i=0; i<54; i++) {
    const star=document.createElement('i');
    star.className='flight-star';
    const angle=i*2.399963;
    const radius=22+(i%11)*7;
    star.style.setProperty('--x',`${Math.cos(angle)*radius}px`);
    star.style.setProperty('--y',`${Math.sin(angle)*radius}px`);
    star.style.setProperty('--delay',`${-(i%17)/10}s`);
    stars.append(star);
  }
  const start = () => {
    if (reduced.matches) return;
    clearTimeout(timer);
    arrival.hidden=true;
    void arrival.offsetWidth;
    arrival.hidden=false;
    running=true;
    remember();
    timer=setTimeout(()=>finish(),6100);
  };
  replay.hidden=reduced.matches;
  replay.addEventListener('click',()=>{start();document.querySelector('#skip-arrival').focus({preventScroll:true});});
  document.querySelector('#skip-arrival').addEventListener('click',event=>{event.preventDefault();finish(true);});
  document.addEventListener('keydown',event=>{if(running && event.key==='Escape')finish(true);});
  document.addEventListener('focusin',event=>{if(running&&!arrival.contains(event.target))finish();});
  document.querySelector('.arrival-rock').addEventListener('error',()=>finish());
  reduced.addEventListener('change',()=>{replay.hidden=reduced.matches;if(reduced.matches)finish();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)finish();});
  let seen=false;
  try {seen=sessionStorage.getItem('moonrock-arrived')==='1';}catch{}
  if(!seen&&!location.hash&&!reduced.matches)start();
})();
