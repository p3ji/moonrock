// Opt-in physical test: one stationary R2-D2 reply and Meross light pulse.
// Does not create a guest order or change kitchen preferences.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
if (!process.argv.includes('--operate-devices')) throw new Error('Pass --operate-devices to run a physical café alert.');
const base = process.env.IOT_URL || 'http://127.0.0.1:8088';
const read = async () => {
  const response = await fetch(base + '/status', { signal: AbortSignal.timeout(5000) });
  assert(response.ok, 'Hub status must be accessible');
  return response.json();
};
const before = await read();
assert(before.ready && before.devices.length, 'Meross switches must be ready');
assert(before.r2d2.connected && !before.r2d2.driving && !before.r2d2.alerting, 'R2-D2 must be connected and idle');
assert(before.settings.lights && before.settings.r2d2, 'Kitchen must enable lights and R2-D2');
assert.equal(before.settings.elegoo, false, 'Keep the disabled Elegoo out of this test');
assert(before.devices.every(device => !device.isPulsing), 'Switches must be idle');
const snapshots = [];
let done = false;
const monitoring = (async () => {
  while (!done) {
    snapshots.push(await read());
    await sleep(200);
  }
})();
try {
  const response = await fetch(base + '/pulse?wait=true&mode=handoff&duration=2', { signal: AbortSignal.timeout(30000) });
  assert(response.ok, 'Café alert request must succeed');
  assert.equal((await response.json()).completed, true);
  await sleep(1800);
} finally {
  done = true;
  await monitoring;
}
const after = await read();
assert(snapshots.some(state => state.r2d2.alerting), 'R2-D2 must report an active reply');
for (const device of before.devices) {
  assert(snapshots.some(state => state.devices.find(row => row.uuid === device.uuid)?.isOn), 'Each Meross switch must report ON during the pulse');
  const restored = after.devices.find(row => row.uuid === device.uuid);
  assert.equal(restored?.isOn, device.isOn, 'Each switch must restore its prior state');
  assert.equal(restored?.desiredOn, device.desiredOn);
}
assert.equal(after.pendingOffCount, 0);
assert.equal(after.r2d2.alerting, false);
assert.equal(after.r2d2.driving, false);
assert.equal(after.r2d2.domeAngle, before.r2d2.domeAngle);
console.log(`PASS live hub: ${before.devices.length} Meross switches reported ON and restored; R2-D2 reported active/completed reply and remained stationary.`);
console.log('R2-D2 handoff does not publish intermediate dome positions. Verify physical dome movement and sound by observation.');
