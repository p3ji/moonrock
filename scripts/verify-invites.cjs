// Local browser regression: no email is sent and ordering APIs use fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/Users/pushp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.CAFE_URL || 'http://127.0.0.1:4193';
const seed = JSON.parse(fs.readFileSync(path.join(root, 'src/catalog.json'), 'utf8'));


async function mockKitchen(page, mutations) {
  const session = { loggedIn: false };
  const round = { id: 'invite-test', menu_id: seed.id, title: 'Preview gathering', status: 'active', created_at: '2026-11-10T18:00:00Z', menu_title: seed.title, order_count: 0 };
  const state = { activeRoundId: round.id, selectedRound: round, rounds: [round, { ...round, id: 'mistake', title: 'Mistaken event', status: 'archived' }], menus: [{ ...seed, archived: 0 }], orders: [], totals: [], settings: { lights: false, r2d2: false, chime: false } };
  // A static preview lacks the Worker's /back route; serve the packaged host page.
  if (['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
    await page.route(url => url.pathname === '/back', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, '.cloudflare-dist/back.html'), 'utf8') }));
  }
  await page.route('http://localhost:8088/**', route => route.abort());
  await page.route('**/api/**', route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (pathname === '/api/back/login') {
      session.loggedIn = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (pathname === '/api/back/delete-event') {
      state.rounds = state.rounds.filter(round => round.id !== request.postDataJSON().id);
      session.deleted = (session.deleted || 0) + 1;
      return route.fulfill({ json: { ok: true } });
    }
    if (pathname === '/api/back/logout') {
      session.loggedIn = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (pathname === '/api/back' && request.method() === 'GET') return route.fulfill({ status: session.loggedIn ? 200 : 401, json: session.loggedIn ? state : { error: 'Enter the host passcode.' } });
    if (request.method() !== 'GET') mutations.push(request.url());
    if (pathname === '/api/menu') return route.fulfill({ json: { ...seed, menuId: seed.id, roundId: round.id } });
    return route.fulfill({ status: 403, json: { error: 'Test blocks writes' } });
  });
  return session;
}

async function unlockKitchen(page) {
  await page.getByLabel('Host passcode').fill('preview-only');
  await page.getByRole('button', { name: 'Open kitchen', exact: true }).click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Users/pushp/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    args: ['--enable-unsafe-swiftshader'],
  });
  try {
    for (const width of [375, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      const page = await context.newPage();
      const errors = [], mutations = [];
      page.on('pageerror', error => errors.push(error.message));
      const session = await mockKitchen(page, mutations);
      await page.addInitScript(() => {
        window.testMailto = [];
        window.testShares = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async text => {
            if (window.failClipboard) throw Error('Clipboard unavailable');
            window.testClipboard = text;
          },
        } });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
          if (window.cancelShare) throw new DOMException('Cancelled', 'AbortError');
          if (window.failShare) throw Error('Sharing unavailable');
          window.testShares.push(data);
        } });
        document.addEventListener('click', event => {
          const link = event.target.closest('a[href^="mailto:"]');
          if (link) { event.preventDefault(); window.testMailto.push(link.href); }
        }, true);
      });

      await page.goto(base + '/back');
      assert(await page.locator('[data-open-invites]').isHidden(), 'Invitation control must be hidden until login');
      await page.locator('[data-open-invites]').evaluate(button => button.click());
      assert.equal(await page.locator('.invite-dialog').evaluate(element => element.open), false);
      await unlockKitchen(page);
      await page.getByRole('tab', { name: 'History', exact: true }).click();
      page.once('dialog', confirmation => confirmation.dismiss());
      await page.getByRole('button', { name: 'Delete event', exact: true }).click();
      assert.equal(session.deleted || 0, 0);
      page.once('dialog', confirmation => confirmation.accept());
      await page.getByRole('button', { name: 'Delete event', exact: true }).click();
      await page.getByRole('button', { name: 'Delete event', exact: true }).waitFor({ state: 'detached' });
      assert.equal(session.deleted, 1);
      await page.getByRole('tab', { name: 'Orders', exact: true }).click();
      assert.equal(await page.locator('#round-title').innerText(), 'Preview gathering');
      const opener = page.getByRole('button', { name: 'Invite friends', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Pull up another chair.' });
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.activeElement.id), 'invite-title');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      let inviteUrl = await dialog.locator('#invite-link').inputValue();
      assert(inviteUrl.startsWith('https://cafe.peji.ca/#home?invite='));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await dialog.screenshot({ path: `/tmp/moonrock-invites-${width}.png` });

      await dialog.getByRole('button', { name: 'Open email app' }).click();
      assert.match(await dialog.getByRole('alert').innerText(), /Add an email address/);
      await dialog.getByLabel('Invite by email').fill('invalid-email');
      await dialog.getByRole('button', { name: 'Open email app' }).click();
      assert.match(await dialog.getByRole('alert').innerText(), /Check this email address/);
      await dialog.getByLabel('Invite by email').fill(Array.from({ length: 21 }, (_, i) => `guest${i}@example.com`).join(','));
      await dialog.getByRole('button', { name: 'Open email app' }).click();
      assert.match(await dialog.getByRole('alert').innerText(), /up to 20/);
      await dialog.getByLabel('Invite by email').fill('first@example.com?subject=Injected');
      await dialog.getByRole('button', { name: 'Open email app' }).click();
      assert.equal(await page.evaluate(() => window.testMailto.length), 0);

      const note = 'Saturday at 6? Tea & games! <b>See you soon</b>\nBring a friend.';
      await dialog.getByLabel('Invite by email').fill('FIRST@example.com; second@example.com\nfirst@example.com');
      await dialog.getByLabel('A note from you').fill(note);
      await dialog.getByLabel('Invitation title').fill('A cozy game night');
      await dialog.getByLabel('Gathering date and time').fill('2026-12-12T18:30');
      inviteUrl = await dialog.locator('#invite-link').inputValue();
      await dialog.getByRole('button', { name: 'Preview guest welcome' }).click();
      const welcome = page.getByRole('dialog', { name: 'A cozy game night' });
      await welcome.waitFor({ state: 'visible' });
      assert.equal(await welcome.locator('.welcome-note').innerText(), note);
      assert.match(await welcome.locator('.welcome-date').innerText(), /December/);
      await welcome.getByRole('button', { name: 'Back to invitation' }).click();
      await dialog.getByRole('button', { name: 'Open email app' }).click();
      const draft = new URL(await page.evaluate(() => window.testMailto[0]));
      assert.equal(draft.protocol, 'mailto:');
      assert.equal(draft.pathname, '');
      assert.equal(draft.searchParams.get('bcc'), 'first@example.com,second@example.com');
      assert.equal(draft.searchParams.get('subject'), 'A cozy game night');
      assert(draft.searchParams.get('body').includes(note));
      assert(draft.searchParams.get('body').includes(inviteUrl));
      assert(!draft.searchParams.get('body').includes('first@example.com'));
      assert.match(await dialog.getByRole('status').innerText(), /Finish sending in your email app/);
      assert.equal(await dialog.locator('b').count(), 0, 'Personal note must not become HTML');

      await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
      assert.equal(await page.evaluate(() => window.testClipboard), inviteUrl);
      assert.match(await dialog.getByRole('status').innerText(), /link copied/);
      await page.evaluate(() => { window.failClipboard = true; });
      await dialog.getByRole('button', { name: 'Copied ✓', exact: true }).click();
      assert.match(await dialog.getByRole('status').innerText(), /Select and copy/);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'invite-link');
      assert.equal(await dialog.locator('#invite-link').evaluate(input => input.selectionEnd - input.selectionStart), inviteUrl.length);

      await dialog.getByRole('button', { name: 'Share…', exact: true }).click();
      const shared = await page.evaluate(() => window.testShares[0]);
      assert.equal(shared.url, inviteUrl);
      assert(shared.text.includes(note));
      assert(!shared.text.includes(inviteUrl), 'Share sheet should not repeat the URL');
      await page.evaluate(() => { window.cancelShare = true; });
      await dialog.getByRole('button', { name: 'Share…', exact: true }).click();
      assert.equal(await dialog.locator('.invite-status').innerText(), '');
      await page.evaluate(() => { window.cancelShare = false; window.failShare = true; });
      await dialog.getByRole('button', { name: 'Share…', exact: true }).click();
      assert.match(await dialog.getByRole('status').innerText(), /Copy the café link instead/);

      // Native modal blocks the underlying page and restores the opener on Escape.
      await dialog.getByRole('button', { name: 'Share…', exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      assert(await dialog.evaluate(element => element.matches(':modal')));
      assert(await page.evaluate(() => document.querySelector('.invite-dialog').contains(document.activeElement)));
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement.matches('[data-open-invites]') && document.body.style.overflow !== 'hidden');
      assert(await opener.evaluate(button => document.activeElement === button));
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await opener.click();
      assert.equal(await dialog.getByLabel('Invite by email').inputValue(), '');
      assert.equal(await dialog.getByLabel('A note from you').inputValue(), note);
      await dialog.getByRole('button', { name: 'Close invitations' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.screenshot({ path: `/tmp/moonrock-back-invites-${width}.png` });

      await opener.click();
      await dialog.getByLabel('Invite by email').fill('guest@example.com');
      session.loggedIn = false;
      await page.evaluate(() => document.getElementById('refresh').click());
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.body.style.overflow !== 'hidden' && document.activeElement.id === 'passcode');
      assert(await page.locator('[data-open-invites]').isHidden());
      assert.equal(await page.locator('#invite-emails').inputValue(), '');
      assert.equal(await page.locator('#invite-message').inputValue(), '');
      await unlockKitchen(page);
      await page.getByRole('button', { name: 'Lock kitchen', exact: true }).click();
      await page.locator('#login').waitFor({ state: 'visible' });
      assert(await page.locator('[data-open-invites]').isHidden());
      assert.deepEqual(mutations, [], 'Invitation must not write to ordering APIs');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: back-office login/lock/session expiry, email validation/BCC/draft, copy/fallback, share/cancel/failure, keyboard/focus, mobile fit, no API writes`);
      await context.close();
    }

    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await mockKitchen(page, []);
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
    await page.goto(base + '/back');
    await unlockKitchen(page);
    await page.getByRole('button', { name: 'Invite friends', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    assert(await page.locator('.invite-share').isHidden());
    await page.getByRole('button', { name: 'Close invitations' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.goto(base + '/#home');
    assert.equal(await page.locator('[data-open-invites]').count(), 0);
    assert.equal(await page.locator('.invite-dialog').count(), 0);
    assert.equal(await page.locator('script[src*="invites.js"]').count(), 0);
    console.log('PASS public home page has no sharing controls; unsupported native sharing is hidden');
    const details = { title: 'A cozy game night', message: '<img src=x onerror=alert(1)> Welcome!\nBring a game.', when: '2026-12-12T23:30:00.000Z', zone: 'America/Toronto' };
    await page.goto(base + '/#home?invite=' + encodeURIComponent(JSON.stringify(details)));
    const welcome = page.getByRole('dialog', { name: details.title });
    await welcome.waitFor({ state: 'visible' });
    assert.equal(await welcome.locator('.welcome-note').innerText(), details.message);
    assert.equal(await welcome.locator('img').count(), 0);
    assert.match(await welcome.locator('.welcome-date').innerText(), /December/);
    await welcome.getByRole('button', { name: 'Come on in' }).click();
    await welcome.waitFor({ state: 'detached' });
    await page.reload();
    assert.equal(await page.locator('.guest-welcome').count(), 0);
    await page.goto(base + '/#home?invite=broken');
    assert.equal(await page.locator('.guest-welcome').count(), 0);
    console.log('PASS personalized guest welcome, safe text, gathering time, dismissal, reload, and malformed link');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
