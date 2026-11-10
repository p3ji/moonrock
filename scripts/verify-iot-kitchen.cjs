// All API writes and hardware requests are mocked; this never operates devices.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/Users/pushp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const seed = JSON.parse(fs.readFileSync(new URL('../src/catalog.json', 'file://' + __filename), 'utf8'));
const base = process.env.CAFE_URL || 'http://127.0.0.1:49193';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Users/pushp/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell', args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const width of [375, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
      const page = await context.newPage();
      const hardware = [], errors = [], writes = [];
      page.on('pageerror', error => errors.push(error.message));
      const round = { id: 'fixture-round', title: 'Fixture event', menu_id: seed.id, menu_title: seed.title, status: 'active', created_at: new Date().toISOString() };
      const settings = { lights: true, r2d2: true, elegoo: true, chime: false };
      let failOnce = true, unlocked = true;
      const orders = [];
      await page.route('**/*', async route => {
        const target = new URL(route.request().url());
        if (target.port === '8088') { hardware.push(target.href); return route.abort(); }
        if (target.origin !== base) return route.abort();
        if (target.pathname === '/api/back/iot-settings') {
          writes.push(route.request().postDataJSON());
          if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { error: 'Fixture save failed. Try again.' } }); }
          Object.assign(settings, route.request().postDataJSON());
          return route.fulfill({ json: { ok: true, settings } });
        }
        if (target.pathname === '/api/back/logout') { unlocked = false; return route.fulfill({ json: { ok: true } }); }
        if (target.pathname === '/api/back') {
          if (!unlocked) return route.fulfill({ status: 401, json: { error: 'Enter the host passcode.' } });
          return route.fulfill({ json: { activeRoundId: round.id, selectedRound: round, rounds: [round], menus: [{ ...seed, archived: 0 }], orders, totals: [], settings } });
        }
        if (target.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
        return route.continue();
      });
      await page.goto(base + '/back.html');
      const elegoo = page.locator('#elegoo-toggle');
      await elegoo.waitFor({ state: 'visible' });
      assert.equal(await elegoo.getAttribute('aria-pressed'), 'true');
      await elegoo.click();
      await page.locator('#message.error').filter({ hasText: 'Fixture save failed' }).waitFor();
      assert.equal(await elegoo.getAttribute('aria-pressed'), 'true', 'Failed save must retain actual state');
      await elegoo.click();
      await page.waitForFunction(() => document.querySelector('#elegoo-toggle').getAttribute('aria-pressed') === 'false');
      assert.equal(settings.r2d2, true);
      assert.deepEqual(writes, [{ elegoo: false }, { elegoo: false }]);
      await page.evaluate(() => localStorage.setItem('moonrock-kitchen-elegoo', 'true'));
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#elegoo-toggle').getAttribute('aria-pressed') === 'false');
      orders.push({ id: 'fixture-new-order', guest_name: 'Fixture Guest', created_at: new Date().toISOString(), items: [], fulfilledItems: [], completed: false });
      await page.locator('#refresh').click();
      await page.locator('#new-orders-status').filter({ hasText: '1 new order received.' }).waitFor();
      assert.deepEqual(hardware, [], 'The kitchen browser must not trigger a duplicate physical response');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: '/tmp/moonrock-iot-kitchen-' + width + '.png' });
      await page.locator('#logout').click();
      await elegoo.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      console.log('PASS kitchen at ' + width + 'px: Elegoo mute, failed-save recovery, shared settings, lock, no overflow or duplicate hardware calls');
      await context.close();
    }
    // Existing guest ordering keeps retry state and never contacts the IoT hub.
    const context = await browser.newContext({ viewport: { width: 375, height: 850 } });
    const page = await context.newPage();
    const sent = [], hardware = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const target = new URL(route.request().url());
      if (target.port === '8088') { hardware.push(target.href); return route.abort(); }
      if (target.origin !== base) return route.abort();
      if (target.pathname === '/api/menu') return route.fulfill({ json: { ...seed, roundId: 'fixture-round', menuId: seed.id } });
      if (target.pathname === '/api/orders') {
        sent.push(route.request().postDataJSON());
        return route.fulfill(sent.length === 1 ? { status: 503, json: { error: 'Fixture retry' } } : { status: 201, json: { id: 'fixture-order' } });
      }
      return route.continue();
    });
    await page.goto(base + '/#menu');
    await page.locator('.add-order').first().click();
    await page.locator('.cart-bar').click();
    await page.locator('.send-order').click();
    await page.locator('#guest-name').fill('Fixture Guest');
    await page.locator('.send-order').click();
    await page.locator('.cart-error').filter({ hasText: 'Fixture retry' }).waitFor();
    assert.equal(await page.locator('#guest-name').inputValue(), 'Fixture Guest');
    await page.locator('.send-order').click();
    await page.locator('.order-receipt').waitFor({ state: 'visible' });
    assert.equal(sent[0].requestId, sent[1].requestId);
    assert.deepEqual(hardware, []);
    assert.deepEqual(errors, []);
    console.log('PASS guest flow: cart, review, failed-send recovery, idempotent retry, saved-order receipt, no hardware requests');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
