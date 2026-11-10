// Local browser regression: no email is sent and ordering APIs use fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/Users/pushp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.CAFE_URL || 'http://127.0.0.1:4193';
const seed = JSON.parse(fs.readFileSync(path.join(root, 'src/catalog.json'), 'utf8'));
const inviteUrl = 'https://cafe.peji.ca/#home';

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
      await page.route('**/api/**', route => {
        if (route.request().method() !== 'GET') mutations.push(route.request().url());
        if (new URL(route.request().url()).pathname === '/api/menu') return route.fulfill({ json: { ...seed, menuId: seed.id, roundId: 'invite-test' } });
        return route.fulfill({ status: 403, json: { error: 'Test blocks writes' } });
      });
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

      await page.goto(base + '/#home');
      const opener = page.getByRole('button', { name: 'Invite friends', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Pull up another chair.' });
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.activeElement.id), 'invite-title');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.equal(await dialog.locator('#invite-link').inputValue(), inviteUrl);
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
      await dialog.getByRole('button', { name: 'Open email app' }).click();
      const draft = new URL(await page.evaluate(() => window.testMailto[0]));
      assert.equal(draft.protocol, 'mailto:');
      assert.equal(draft.pathname, '');
      assert.equal(draft.searchParams.get('bcc'), 'first@example.com,second@example.com');
      assert.equal(draft.searchParams.get('subject'), 'You’re invited to Moonrock');
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
      await page.screenshot({ path: `/tmp/moonrock-home-invites-${width}.png` });
      assert.deepEqual(mutations, [], 'Invitation must not write to ordering APIs');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: email validation/BCC/draft, copy/fallback, share/cancel/failure, keyboard/focus, mobile fit, no API writes`);
      await context.close();
    }

    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.route('**/api/**', route => route.fulfill({ json: { ...seed, menuId: seed.id, roundId: 'invite-test' } }));
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
    await page.goto(base + '/');
    await page.locator('.blackhole-stage.loaded').waitFor();
    await page.evaluate(() => scrollTo({ top: (document.querySelector('.blackhole-stage').offsetHeight - innerHeight) * .94, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.landing-preview')?.inert === false);
    await page.locator('.landing-preview [data-open-invites]').click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    assert(await page.locator('.invite-share').isHidden());
    await page.getByRole('button', { name: 'Close invitations' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    console.log('PASS arrival preview opens invitations; unsupported native sharing is hidden');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
