(() => {
  const button = document.querySelector('.cafe-record');
  const audio = document.getElementById('cafe-music');
  if (!button || !audio) return;
  const caption = button.querySelector('.music-caption');
  let wanted = false, attempt = 0;
  audio.volume = .35;
  function render(state) {
    const on = state === 'playing', loading = state === 'loading';
    button.classList.toggle('playing', on);
    button.classList.toggle('loading', loading);
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-busy', String(loading));
    button.setAttribute('aria-label', wanted ? 'Pause café music' : state === 'error' ? 'Retry café music' : 'Play café music');
    button.title = state === 'error' ? 'Music unavailable. Tap to retry.' : wanted ? 'Pause café music' : 'Play café music';
    if (caption) caption.textContent = state === 'error' ? 'Retry music' : loading ? 'Loading…' : on ? 'Music on' : 'Music off';
  }
  button.addEventListener('click', async () => {
    const token = ++attempt;
    wanted = !wanted;
    if (!wanted) { audio.pause(); render('paused'); return; }
    if (audio.error) audio.load();
    render('loading');
    try { await audio.play(); if (token === attempt && wanted) render('playing'); }
    catch { if (token === attempt && wanted) { wanted = false; render('error'); } }
  });
  audio.addEventListener('playing', () => { if (wanted) render('playing'); else audio.pause(); });
  audio.addEventListener('waiting', () => { if (wanted) render('loading'); });
  audio.addEventListener('pause', () => { if (!audio.paused) return; wanted = false; ++attempt; render(audio.error ? 'error' : 'paused'); });
  audio.addEventListener('error', () => { wanted = false; ++attempt; render('error'); });
  render('paused');
})();
