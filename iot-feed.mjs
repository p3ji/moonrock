const DEFAULTS = { lights: true, r2d2: true, elegoo: true, chime: true };

export async function readSettings(DB) {
  await DB.prepare('CREATE TABLE IF NOT EXISTS iot_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
  const { results = [] } = await DB.prepare('SELECT key,value FROM iot_settings').all();
  const settings = { ...DEFAULTS };
  for (const row of results) {
    if (Object.hasOwn(settings, row.key)) settings[row.key] = row.value === '1' || row.value === 'true';
  }
  return { settings, settingsRevision: results.find(row => row.key === '_revision')?.value || 'initial' };
}

export async function saveSettings(DB, changes) {
  await readSettings(DB);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw Object.assign(new Error('Check the order response settings.'), { status: 400 });
  }
  const entries = Object.entries(changes).filter(([key]) => Object.hasOwn(DEFAULTS, key));
  if (!entries.length || entries.some(([, value]) => typeof value !== 'boolean')) {
    throw Object.assign(new Error('Choose on or muted for an order response.'), { status: 400 });
  }
  const statements = [...entries, ['_revision', crypto.randomUUID()]].map(([key, value]) =>
    DB.prepare('INSERT INTO iot_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .bind(key, typeof value === 'boolean' ? (value ? '1' : '0') : value));
  await DB.batch(statements);
  return readSettings(DB);
}

const cursorFor = (roundId, row) => JSON.stringify([roundId, row?.created_at || '', row?.sequence || 0]);

// A read-only feed of committed orders. The cursor includes time because SQLite
// can reuse rowids after orders are deleted. Guest names and notes stay private.
export async function readOrderFeed(DB, after) {
  const round = await DB.prepare("SELECT id FROM rounds WHERE status='active'").first();
  const roundId = round?.id || null;
  let cursor;
  if (after) {
    try { cursor = JSON.parse(after); } catch {}
    if (!Array.isArray(cursor) || cursor.length !== 3 ||
        !(cursor[0] === null || typeof cursor[0] === 'string') ||
        typeof cursor[1] !== 'string' || cursor[1].length > 40 ||
        !Number.isSafeInteger(cursor[2]) || cursor[2] < 0) {
      throw Object.assign(new Error('Invalid order feed cursor.'), { status: 400 });
    }
  }
  // A first connection establishes a baseline, with no old show.
  if (!cursor || !roundId) {
    const latest = roundId ? await DB.prepare('SELECT created_at,rowid AS sequence FROM orders WHERE round_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(roundId).first() : null;
    return { events: [], cursor: cursorFor(roundId, latest), hasMore: false };
  }
  if (cursor[0] !== roundId) cursor = [roundId, '', 0];
  const { results = [] } = await DB.prepare('SELECT id,items,note,created_at,rowid AS sequence FROM orders WHERE round_id=? AND (created_at>? OR (created_at=? AND rowid>?)) ORDER BY created_at,rowid LIMIT 51')
    .bind(roundId, cursor[1], cursor[1], cursor[2]).all();
  const page = results.slice(0, 50);
  const events = page.map(row => ({
    id: row.id,
    created_at: row.created_at,
    totalItems: JSON.parse(row.items).reduce((sum, item) => sum + item.quantity, 0),
    hasNote: Boolean(row.note?.trim())
  }));
  return { events, cursor: page.length ? cursorFor(roundId, page.at(-1)) : JSON.stringify(cursor), hasMore: results.length > 50 };
}
