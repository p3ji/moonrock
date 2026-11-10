import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import worker from '../worker.mjs';
const require = createRequire(import.meta.url);
const { OrderHandoff, OrderPoller } = require(process.env.IOT_HANDOFF_MODULE || '../../IoT/cafe-handoff.js');
const sqlite = new DatabaseSync(':memory:');
for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) {
  sqlite.exec(readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'));
}
const DB = {
  prepare(sql) {
    return { args: [], bind(...args) { this.args = args; return this; },
      async first() { return sqlite.prepare(sql).get(...this.args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...this.args) }; },
      async run() { const result = sqlite.prepare(sql).run(...this.args); return { meta: { changes: result.changes } }; }
    };
  },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
};
const env = { DB, HOST_OPEN: 'true' };
const url = 'https://cafe.example';
const request = (path, data) => new Request(url + path, data === undefined ? {} : { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const call = (path, data, bindings = env) => worker.fetch(request(path, data), bindings);
const read = async path => (await call(path)).json();
const add = (id, time = new Date().toISOString(), round = 'first-gathering') => sqlite.prepare('INSERT INTO orders(id,request_id,round_id,guest_name,items,note,created_at) VALUES(?,?,?,?,?,?,?)').run(id, 'request-' + id, round, 'Fixture Guest', JSON.stringify([{ quantity: 2 }, { quantity: 1 }]), 'Fixture note', time);

// Exercise the real existing submission path, including rejection and retry.
const beforeSubmit = await read('/api/iot/orders?feed=2');
const menu = await read('/api/menu');
const item = menu.sections.flatMap(section => section.items).find(item => !item.options.length);
const submission = { name: 'Fixture Guest', roundId: menu.roundId, requestId: 'fixture-order-request-0001', items: [{ itemId: item.id, optionId: '', quantity: 1 }] };
assert.equal((await call('/api/orders', { ...submission, items: [{ ...submission.items[0], quantity: 0 }] })).status, 400);
assert.equal((await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(beforeSubmit.cursor))).events.length, 0);
const submitted = await call('/api/orders', submission);
assert.equal(submitted.status, 201);
const savedOrder = await submitted.json();
assert.equal((await call('/api/orders', submission)).status, 200);
const afterSubmit = await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(beforeSubmit.cursor));
assert.deepEqual(afterSubmit.events.map(event => event.id), [savedOrder.id]);
sqlite.exec('DELETE FROM orders');

// Only saved orders enter the feed, and short bursts are paginated without loss.
let baseline = await read('/api/iot/orders?feed=2');
assert.deepEqual(baseline.events, []);
assert.equal(baseline.settings.elegoo, true);
const timestamp = new Date().toISOString();
for (let i = 0; i < 55; i++) add('burst-' + i, timestamp);
const page = await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(baseline.cursor));
assert.equal(page.events.length, 50);
assert.equal(page.hasMore, true);
assert.deepEqual(Object.keys(page.events[0]).sort(), ['created_at', 'hasNote', 'id', 'totalItems']);
assert.equal(page.events[0].totalItems, 3);
assert.equal(page.events[0].hasNote, true);
let next = await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(page.cursor));
assert.equal(next.events.length, 5);
assert.equal(next.hasMore, false);
assert.equal(new Set([...page.events, ...next.events].map(e => e.id)).size, 55);
assert.equal((await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(next.cursor))).events.length, 0);
assert.equal((await read('/api/iot/orders?feed=2')).events.length, 0, 'Fresh connections must not replay existing orders');
assert.equal((await call('/api/iot/orders?feed=2&after=invalid')).status, 400);

// Reused SQLite rowids after deletion and the first order of a new event work.
sqlite.exec('DELETE FROM orders');
add('after-delete', new Date(Date.parse(timestamp) + 1000).toISOString());
next = await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(next.cursor));
assert.equal(next.events[0].id, 'after-delete');
sqlite.exec("UPDATE rounds SET status='archived'; INSERT INTO rounds(id,menu_id,title,status) VALUES('new-round','moonrock-original','Fixture event','active')");
add('new-round-order', timestamp, 'new-round');
next = await read('/api/iot/orders?feed=2&after=' + encodeURIComponent(next.cursor));
assert.deepEqual(next.events.map(e => e.id), ['new-round-order']);

// Settings require host access, merge partial changes, and reach the hub feed.
assert.equal((await call('/api/iot/settings', { elegoo: false })).status, 401);
assert.equal((await call('/api/back/iot-settings', { elegoo: false }, { DB })).status, 401);
assert.equal((await call('/api/back/iot-settings', { elegoo: 'false' })).status, 400);
const muted = await (await call('/api/back/iot-settings', { elegoo: false })).json();
assert.equal(muted.settings.elegoo, false);
assert.equal(muted.settings.r2d2, true);
const lightsMuted = await (await call('/api/back/iot-settings', { lights: false })).json();
assert.equal(lightsMuted.settings.elegoo, false);
assert.notEqual(lightsMuted.settingsRevision, muted.settingsRevision);
assert.equal((await read('/api/iot/orders?feed=2')).settings.elegoo, false);
console.log('PASS order feed: committed metadata, bursts, cursor deduplication, deletion, event changes, authenticated device settings');

const calls = [];
const r2d2 = new EventEmitter();
Object.assign(r2d2, { isConnected: true, isManuallyActive: () => false, triggerAlert(_duration, options) {
  assert.equal(options.mode, 'handoff'); calls.push('r2d2');
  this.emit('stateChanged', { connected: true, alerting: true });
  queueMicrotask(() => this.emit('stateChanged', { connected: true, alerting: false })); return true;
} });
let settings = { lights: true, elegoo: true, r2d2: true, chime: true };
const handoff = new OrderHandoff({
  elegoo: { async triggerOrderAlert() { calls.push('elegoo'); return true; } },
  r2d2, lights: { isInitialized: true, async pulse(ms) { assert.equal(ms, 2000); calls.push('lights'); } },
  getSettings: () => settings, sleep: async () => {}, chime: () => calls.push('chime'),
  onState: event => { if (!event.active) calls.push('done:' + event.orderId); },
  onError: (device, error) => { throw new Error(device + ': ' + error.message); }
});
const order = id => ({ id, created_at: new Date().toISOString(), totalItems: 2 });
await Promise.all([handoff.enqueue(order('one')), handoff.enqueue(order('two')), handoff.enqueue(order('one'))]);
assert.deepEqual(calls, ['elegoo','r2d2','lights','chime','done:one','elegoo','r2d2','lights','chime','done:two']);
calls.length = 0;
settings = { lights: false, elegoo: false, r2d2: false, chime: false };
await handoff.enqueue(order('muted'));
assert.deepEqual(calls, ['done:muted']);
calls.length = 0;
await handoff.enqueue({ ...order('stale'), created_at: '2000-01-01T00:00:00Z' });
assert.deepEqual(calls, []);
settings = { lights: true, elegoo: true, r2d2: true, chime: false };
handoff.elegoo.triggerOrderAlert = async () => { calls.push('elegoo'); handoff.cancel(); return false; };
await handoff.enqueue(order('cancel'));
assert.deepEqual(calls, ['elegoo', 'done:cancel']);
calls.length = 0;
handoff.elegoo.triggerOrderAlert = async () => { throw new Error('fixture offline'); };
handoff.onError = () => {};
await handoff.enqueue(order('device-error'));
assert.deepEqual(calls, ['r2d2','lights','done:device-error']);
calls.length = 0;
r2d2.isManuallyActive = () => true;
handoff.elegoo.triggerOrderAlert = async () => false;
await handoff.enqueue(order('manual'));
assert.deepEqual(calls, ['lights','done:manual']);
// A stuck device promise must not hold the response queue indefinitely.
const stuckCalls = [];
const stuck = new OrderHandoff({
  elegoo: {}, r2d2: {}, lights: { isInitialized: true, pulse: () => new Promise(() => {}) },
  getSettings: () => ({ lights: true, elegoo: false, r2d2: false, chime: true }),
  sleep: async () => {}, deviceTimeoutMs: 5,
  chime: () => stuckCalls.push('chime'), onError: device => stuckCalls.push(device + '-timeout')
});
await stuck.enqueue(order('stuck-device'));
assert.deepEqual(stuckCalls, ['lights-timeout', 'chime']);
console.log('PASS handoff: sequence, queued bursts, duplicates, mute, stale events, cancellation, isolated failures, manual R2-D2 priority');

const dir = mkdtempSync(join(tmpdir(), 'moonrock-handoff-'));
try {
  const received = [];
  const snapshots = [];
  let localSetting = true;
  const pollOptions = {
    url: url + '/api/iot/orders', stateFile: join(dir, 'cursor.json'),
    handoff: { enqueue(event) { received.push(event.id); return Promise.resolve(true); } },
    applySettings(value) { snapshots.push(value); localSetting = value.elegoo; },
    fetchImpl: async target => worker.fetch(new Request(target), env),
    onError: (source, error) => { throw new Error(source + ': ' + error.message); }
  };
  let poller = new OrderPoller(pollOptions);
  await poller.poll();
  assert.deepEqual(received, []);
  add('poll-1', new Date(Date.parse(timestamp) + 2000).toISOString(), 'new-round');
  add('poll-2', new Date(Date.parse(timestamp) + 2000).toISOString(), 'new-round');
  await poller.poll();
  assert.deepEqual(received, ['poll-1', 'poll-2']);
  await poller.poll();
  assert.equal(received.length, 2);
  poller = new OrderPoller(pollOptions);
  await poller.poll();
  assert.equal(received.length, 2, 'Restart must retain cursor');
  localSetting = true;
  await poller.poll();
  assert.equal(localSetting, true, 'Unchanged cloud settings must not undo local hub controls');
  await call('/api/back/iot-settings', { elegoo: false });
  await poller.poll();
  assert.equal(localSetting, false, 'New kitchen settings must reach the hub');
  assert.equal(snapshots.length, 3);
  console.log('PASS poller: Worker-to-hub integration, persistence, restart deduplication and settings revision');
} finally { rmSync(dir, { recursive: true, force: true }); sqlite.close(); }
