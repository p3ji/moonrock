(() => {
 const section=document.querySelector('.rabbit-crossing');if(!section)return;
 const track=section.querySelector('.rabbit-track');let playing=false,observer;
 const resize=()=>section.style.setProperty('--rabbit-distance',section.clientWidth+track.offsetWidth+50+'px');resize();
 track.addEventListener('animationend',event=>{if(event.target===track&&event.animationName==='rabbit-cross-page'){playing=false;section.classList.add('rabbit-finished')}});
 function watch(){
  observer?.disconnect();
  const margin=Math.round(innerHeight*.35);
  observer=new IntersectionObserver(entries=>{for(const entry of entries){
   if(!entry.isIntersecting||entry.intersectionRatio<.35)continue;
   if(!playing){
    playing=true;section.classList.remove('rabbit-running','rabbit-finished');void track.offsetWidth;section.classList.add('rabbit-running');
   }
  }},{threshold:[0,.35],rootMargin:`-${margin}px 0px -${margin}px 0px`});
  observer.observe(section);
 }
 watch();addEventListener('resize',()=>{resize();watch()});
})();
