(() => {
  const openers = document.querySelectorAll('[data-open-invites]');
  const dashboard = document.querySelector('#dashboard');
  if (!openers.length || !dashboard) return;

  // Always share the public café, including from a local or installed preview.
  let inviteUrl = 'https://cafe.peji.ca/#home';
  const dialog = document.createElement('dialog');
  dialog.className = 'invite-dialog';
  dialog.setAttribute('aria-labelledby', 'invite-title');
  dialog.setAttribute('aria-describedby', 'invite-description');
  dialog.innerHTML = `
    <header class="invite-header">
      <p class="invite-eyebrow">A LITTLE MORE COMPANY</p>
      <h2 id="invite-title" tabindex="-1">Pull up another chair.</h2>
      <p id="invite-description">Invite someone to Moonrock for food, drinks, and a game or two.</p>
      <button class="invite-close" type="button" aria-label="Close invitations">×</button>
    </header>
    <div class="invite-body">
      <form id="invite-form" novalidate>
        <label for="invite-heading">Invitation title</label>
        <input id="invite-heading" maxlength="100" value="You’re invited to Moonrock">
        <label for="invite-when">Gathering date and time <span>(optional)</span></label>
        <input id="invite-when" type="datetime-local">
        <p class="invite-help" id="invite-timezone"></p>
        <label for="invite-emails">Invite by email</label>
        <textarea id="invite-emails" rows="2" maxlength="6000" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="friend@example.com, another@example.com" aria-describedby="invite-email-help invite-error"></textarea>
        <p id="invite-email-help" class="invite-help">Separate addresses with commas, spaces, or new lines. Up to 20 people; recipients go in BCC.</p>
        <label for="invite-message">A note from you <span>(optional)</span></label>
        <textarea id="invite-message" rows="2" maxlength="500" placeholder="Come over for a cozy evening this Saturday!"></textarea>
        <button class="invite-preview" type="button">Preview guest welcome</button><p id="invite-error" class="invite-error" role="alert"></p>
        <button class="invite-primary" type="submit">Open email app <span aria-hidden="true">↗</span></button>
        <p class="invite-help">Review and send in your email app. Addresses are not stored by Moonrock.</p>
      </form>
      <section class="invite-link-section" aria-labelledby="invite-link-title">
        <h3 id="invite-link-title">Or share a link</h3>
        <p class="invite-help">Anyone with the link can explore the café, menu, and games.</p>
        <label class="invite-link-label" for="invite-link">Café link</label>
        <input id="invite-link" type="url" readonly value="${inviteUrl}">
        <div class="invite-link-actions">
          <button class="invite-copy" type="button">Copy link</button>
          <button class="invite-share" type="button" hidden>Share…</button>
        </div>
      </section>
      <p class="invite-status" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>`;
  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const heading = dialog.querySelector('#invite-heading');
  const when = dialog.querySelector('#invite-when');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  dialog.querySelector('#invite-timezone').textContent = 'Time zone: ' + zone;
  const emails = dialog.querySelector('#invite-emails');
  const message = dialog.querySelector('#invite-message');
  const link = dialog.querySelector('#invite-link');
  const error = dialog.querySelector('.invite-error');
  const status = dialog.querySelector('.invite-status');
  const copy = dialog.querySelector('.invite-copy');
  const share = dialog.querySelector('.invite-share');
  let returnFocus = null, previousOverflow = '', revision = 0;

  function invitationText(includeLink = true) {
    return [
      message.value.trim(),
      heading.value.trim() || 'You’re invited to Moonrock',
      when.value ? new Date(when.value).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) + ' (' + zone + ')' : '',
      'Come for something good to eat, stay for a game and good company.',
      includeLink ? `Take a look at the café, menu, and games:\n${inviteUrl}` : '',
    ].filter(Boolean).join('\n\n');
  }

  function updateInvitation() {
    const details = { title: heading.value.trim() || 'You’re invited to Moonrock', message: message.value.trim(), when: when.value ? new Date(when.value).toISOString() : '', zone };
    inviteUrl = 'https://cafe.peji.ca/#home?invite=' + encodeURIComponent(JSON.stringify(details));
    link.value = inviteUrl;
    clearFeedback();
  }
  dialog.querySelector('.invite-preview').addEventListener('click', () => {
    updateInvitation();
    window.dispatchEvent(new CustomEvent('moonrock-preview-invite', { detail: inviteUrl }));
  });
  function clearFeedback() {
    revision++;
    status.textContent = '';
    copy.textContent = 'Copy link';
    error.textContent = '';
    emails.removeAttribute('aria-invalid');
  }

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-open-invites]');
    if (!opener || dialog.open || dashboard.hidden) return;
    returnFocus = opener;
    clearFeedback();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('#invite-title').focus({ preventScroll: true });
  });

  dialog.querySelector('.invite-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    revision++;
    document.body.style.overflow = previousOverflow;
    // Keep a personal note while clearing recipients when the invitation closes.
    emails.value = '';
    clearFeedback();
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true });
  });

  // Use the kitchen's existing login, lock, and session-expiry transitions.
  new MutationObserver(() => {
    if (!dashboard.hidden) return;
    emails.value = '';
    message.value = '';
    heading.value = 'You’re invited to Moonrock';
    when.value = '';
    updateInvitation();
    if (dialog.open) dialog.close();
  }).observe(dashboard, { attributes: true, attributeFilter: ['hidden'] });
  emails.addEventListener('input', clearFeedback);
  for (const field of [message, heading, when]) field.addEventListener('input', updateInvitation);
  updateInvitation();
  link.addEventListener('focus', () => link.select());

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearFeedback();
    const recipients = [...new Set(emails.value.split(/[\s,;]+/).filter(Boolean).map(email => email.toLowerCase()))];
    const emailCheck = document.createElement('input');
    emailCheck.type = 'email';
    const invalid = recipients.find(email => {
      emailCheck.value = email;
      return email.length > 254 || !emailCheck.checkValidity() || !email.split('@')[1]?.includes('.');
    });
    if (!recipients.length || recipients.length > 20 || invalid) {
      error.textContent = !recipients.length ? 'Add an email address to invite someone.' : recipients.length > 20 ? 'Invite up to 20 people at a time.' : `Check this email address: ${invalid}`;
      emails.setAttribute('aria-invalid', 'true');
      emails.focus();
      return;
    }
    const draft = document.createElement('a');
    draft.href = `mailto:?bcc=${encodeURIComponent(recipients.join(','))}&subject=${encodeURIComponent(heading.value.trim() || 'You’re invited to Moonrock')}&body=${encodeURIComponent(invitationText())}`;
    draft.hidden = true;
    document.body.append(draft);
    draft.click();
    draft.remove();
    status.textContent = 'Finish sending in your email app. If nothing opens, copy the café link below.';
  });

  copy.addEventListener('click', async () => {
    clearFeedback();
    const currentRevision = revision;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      if (currentRevision !== revision || !dialog.open) return;
      copy.textContent = 'Copied ✓';
      status.textContent = 'Café link copied. Send it to someone you’d love to see.';
    } catch {
      if (currentRevision !== revision || !dialog.open) return;
      link.focus();
      link.select();
      status.textContent = 'Select and copy the café link above to share it.';
    }
  });

  share.hidden = typeof navigator.share !== 'function';
  share.addEventListener('click', async () => {
    clearFeedback();
    const currentRevision = revision;
    try {
      await navigator.share({ title: heading.value.trim() || 'You’re invited to Moonrock', text: invitationText(false), url: inviteUrl });
    } catch (err) {
      if (currentRevision === revision && dialog.open && err?.name !== 'AbortError') status.textContent = 'Sharing is unavailable here. Copy the café link instead.';
    }
  });
})();
