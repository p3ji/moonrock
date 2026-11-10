(() => {
  function showWelcome(url, preview = false) {
    let details;
    try {
      const hash = new URL(url).hash;
      const raw = new URLSearchParams(hash.split('?')[1] || '').get('invite');
      if (!raw || raw.length > 5000) return;
      details = JSON.parse(raw);
      if (!details || typeof details.title !== 'string' || typeof details.message !== 'string') return;
    } catch { return; }
    if (document.querySelector('.guest-welcome')) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'invite-dialog guest-welcome';
    dialog.setAttribute('aria-labelledby', 'guest-welcome-title');
    dialog.innerHTML = `<div class="invite-header"><p class="invite-eyebrow">${preview ? 'GUEST PREVIEW' : 'A LITTLE INVITATION FOR YOU'}</p><h2 id="guest-welcome-title" tabindex="-1"></h2><button class="invite-close" type="button" aria-label="Close welcome">×</button></div><div class="invite-body"><p class="welcome-date" hidden></p><p class="welcome-note"></p><p class="invite-help">Food, drinks, and good company at Moonrock.</p><button class="invite-primary" type="button">${preview ? 'Back to invitation' : 'Come on in'}</button></div>`;
    dialog.querySelector('h2').textContent = details.title.slice(0, 100) || 'You’re invited to Moonrock';
    dialog.querySelector('.welcome-note').textContent = details.message.slice(0, 500) || 'We saved you a seat. Make yourself at home.';
    if (typeof details.when === 'string' && details.when && Number.isFinite(Date.parse(details.when))) {
      try {
        const date = dialog.querySelector('.welcome-date');
        date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: typeof details.zone === 'string' ? details.zone : 'America/Toronto' }).format(new Date(details.when)) + ' · ' + (details.zone || 'America/Toronto');
        date.hidden = false;
      } catch { /* An invalid date or zone must not prevent opening the café. */ }
    }
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.append(dialog);
    dialog.querySelectorAll('button').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {
      dialog.remove();
      document.body.style.overflow = preview && document.querySelector('#dashboard')?.hidden ? '' : previousOverflow;
      if (preview) previousFocus?.focus({ preventScroll: true });
      else {
        history.replaceState(null, '', location.pathname + location.search);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    });
    if (!preview) {
      history.replaceState(null, '', location.pathname + location.search);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    dialog.showModal();
    dialog.querySelector('h2').focus({ preventScroll: true });
    if (preview) {
      const dashboard = document.querySelector('#dashboard');
      const observer = new MutationObserver(() => { if (dashboard.hidden && dialog.open) dialog.close(); });
      observer.observe(dashboard, { attributes: true, attributeFilter: ['hidden'] });
      dialog.addEventListener('close', () => observer.disconnect(), { once: true });
    }
  }
  window.addEventListener('moonrock-preview-invite', event => showWelcome(event.detail, true));
  if (!document.querySelector('#dashboard')) {
    showWelcome(location.href);
    window.addEventListener('hashchange', () => showWelcome(location.href));
  }
})();
