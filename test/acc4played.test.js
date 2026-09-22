// ACC4 — REGISTERED DATE AND TIME PLAYED ON THE PROFILE CARD (2026-09-22).
//
// Mac: "Lets add an account registered date and time played to the
// icon profile."
//
// ═══ WHAT THESE PINS ARE FOR ═══════════════════════════════════════
//
// THE REGISTERED DATE IS A COLUMN THAT ALREADY EXISTED (0002 stamps
// `registered_at`); the only work was carrying it to the card, and the
// pin is that a guest gets no date rather than 1970.
//
// TIME PLAYED IS THE ONE THAT CAN BE BUILT WRONG, and the wrong build
// passes a naive test: a tab counts seconds and posts the number. These
// pins drive what that build cannot survive - a beat carrying a forged
// number, two tabs beating one account, a beat after the machine slept,
// a beat that arrives late and out of order. Each one is answered by
// the SERVICE's clock in one SQL statement, over the real migrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { register, creditPlay, createGuest, accountView } from '../server-account/src/accounts.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { PLAY_BEAT_S, PLAY_GRACE_S, startPlayClock } from '../src/net/playClock.js';
import { accountPlayBeat, SESSION_KEY, DEFAULT_ACCOUNT_SERVICE } from '../src/net/accountClient.js';
import { accountCard, registeredText, playedText } from '../src/ui/enhancedAccount.js';
import { AccountFlow } from '../src/ui/accountFlow.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort();

/** D1's surface over the REAL migrations - 0005 included, because the
 *  walk picks up every file in the folder. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}

const T0 = 1_800_000_000;
const beatAt = (db, id, nowS) => creditPlay({ db, nowS }, id);
const guestIn = async (db) => (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;

// ── THE LAW: creditPlay ─────────────────────────────────────────────

test('ACC4: a sitting is credited by the SERVICE clock, beat to beat - and the first beat credits nothing', async () => {
  const db = d1();
  const id = await guestIn(db);
  assert.deepEqual(await beatAt(db, id, T0), { playedS: 0 }, 'the first beat OPENS the sitting - there is no earlier beat to measure from');
  assert.deepEqual(await beatAt(db, id, T0 + PLAY_BEAT_S), { playedS: PLAY_BEAT_S });
  assert.deepEqual(await beatAt(db, id, T0 + 2 * PLAY_BEAT_S), { playedS: 2 * PLAY_BEAT_S });
  // ONE LATE BEAT IS FORGIVEN: a throttled timer or a dropped request
  // must not cost the sitting. The grace is inclusive.
  assert.deepEqual(await beatAt(db, id, T0 + 2 * PLAY_BEAT_S + PLAY_GRACE_S), { playedS: 2 * PLAY_BEAT_S + PLAY_GRACE_S });
});

test('ACC4: a gap wider than the grace is a NEW sitting and credits nothing (mutant: credit every gap - a tab closed overnight is eight hours played)', async () => {
  const db = d1();
  const id = await guestIn(db);
  await beatAt(db, id, T0);
  await beatAt(db, id, T0 + PLAY_BEAT_S);
  const slept = T0 + PLAY_BEAT_S + PLAY_GRACE_S + 1;
  assert.deepEqual(await beatAt(db, id, slept), { playedS: PLAY_BEAT_S }, 'one second past the grace credits nothing');
  // ...and that beat OPENED the next sitting, so the one after counts
  assert.deepEqual(await beatAt(db, id, slept + 60), { playedS: PLAY_BEAT_S + 60 });
  assert.equal(PLAY_GRACE_S, 2 * PLAY_BEAT_S, 'the grace is DERIVED from the beat - moving one moves the other');
  assert.ok(PLAY_GRACE_S > PLAY_BEAT_S, 'a grace no wider than the beat would drop a sitting on every on-time knock');
});

test('ACC4: TWO TABS BEATING ONE ACCOUNT COUNT THE WALL CLOCK ONCE (mutant: read then write - both tabs credit the same minutes)', async () => {
  const db = d1();
  const id = await guestIn(db);
  // Tab A knocks on the hour marks, tab B half a beat out of phase.
  // Every beat measures from the OTHER's, so ten minutes of two tabs is
  // ten minutes played - not twenty.
  const half = PLAY_BEAT_S / 2;
  let last;
  for (let k = 0; k <= 4; k++) {
    await beatAt(db, id, T0 + k * PLAY_BEAT_S);          // tab A
    last = await beatAt(db, id, T0 + k * PLAY_BEAT_S + half);   // tab B
  }
  assert.equal(last.playedS, 4 * PLAY_BEAT_S + half, 'wall-clock time from the first beat to the last, exactly once');

  // AND WHEN THEIR BEATS LAND TOGETHER. Sequential beats cannot tell an
  // atomic UPDATE from read-then-write; two in flight at once can - both
  // would read the same last beat and both credit the gap from it.
  const db2 = d1();
  const id2 = await guestIn(db2);
  await beatAt(db2, id2, T0);
  await Promise.all([beatAt(db2, id2, T0 + 100), beatAt(db2, id2, T0 + 101)]);
  const row = db2._raw.prepare('SELECT played_s FROM players WHERE id = ?').get(id2);
  assert.equal(row.played_s, 101, 'two beats in flight together credited the same minutes twice');
});

test('ACC4: a beat that lands LATE and out of order credits nothing and does not drag the clock back', async () => {
  const db = d1();
  const id = await guestIn(db);
  await beatAt(db, id, T0);
  await beatAt(db, id, T0 + 200);
  // a request stamped earlier than the last one to land
  assert.deepEqual(await beatAt(db, id, T0 + 100), { playedS: 200 });
  // had the clock moved back to +100, this would credit 200; it credits 100
  assert.deepEqual(await beatAt(db, id, T0 + 300), { playedS: 300 });
  // a beat at the SAME second as the last credits nothing either
  assert.deepEqual(await beatAt(db, id, T0 + 300), { playedS: 300 });
});

test('ACC4: time played is the ROW\'s, so registering keeps every minute a guest played', async () => {
  const db = d1();
  const id = await guestIn(db);
  await beatAt(db, id, T0);
  await beatAt(db, id, T0 + PLAY_BEAT_S);
  const r = await register({ db, subtle, rand, nowS: T0 + PLAY_BEAT_S + 1 }, id, { handle: 'Nystul', password: 'a-long-enough-password' });
  assert.ok(!r.error, r.error);
  const row = db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
  const view = accountView(row, T0);
  assert.equal(view.playedS, PLAY_BEAT_S);
  assert.equal(view.registeredAt, T0 + PLAY_BEAT_S + 1);
});

test('ACC4: every existing row starts at ZERO and no beat yet - nothing is guessed into the column', () => {
  const db = d1();
  db._raw.prepare("INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES ('p_old', NULL, NULL, 'Old Guest', 1, 1)").run();
  const row = db._raw.prepare('SELECT played_s, played_at FROM players WHERE id = ?').get('p_old');
  assert.equal(row.played_s, 0);
  assert.equal(row.played_at, null);
  assert.match(src('server-account/migrations/0005_played.sql'), /STARTS AT ZERO/);
});

// ── THE WORKER, end to end ──────────────────────────────────────────

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call };
}

test('ACC4: the beat route READS NOTHING a client sends - a forged number is not a request anybody answers', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { call } = await stand();
  const me = (await call('POST', '/v1/auth/guest', {})).body;

  const first = await call('POST', '/v1/account/played', { playedS: 999_999, seconds: 999_999 }, me.secret);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { playedS: 0 });
  clock += 120_000;
  const second = await call('POST', '/v1/account/played', { playedS: 999_999 }, me.secret);
  assert.deepEqual(second.body, { playedS: 120 }, 'two minutes by the service clock, whatever the body claimed');

  // ...and the account view carries it, beside a registered date that is
  // NULL for a guest (not 0, which is 1970)
  const seen = (await call('GET', '/v1/account', undefined, me.secret)).body.account;
  assert.equal(seen.playedS, 120);
  assert.equal(seen.registeredAt, null);

  // Behind the door like every other account route.
  assert.equal((await call('POST', '/v1/account/played', {})).status, 401);
  assert.ok(ROUTES.has('/v1/account/played'));
  assert.ok(!OPEN_ROUTES.has('/v1/account/played'), 'a stranger cannot knock for an account');
});

// ── THE CLIENT: the clock, the beat, the card ───────────────────────

test('ACC4: the clock knocks at once, then every beat - and a hidden page does not knock', () => {
  const beats = [];
  let tick = null; let every = null; let cleared = null;
  let visible = true;
  const stop = startPlayClock({
    beat: () => { beats.push('knock'); },
    visible: () => visible,
    setInterval: (fn, ms) => { tick = fn; every = ms; return 7; },
    clearInterval: (id) => { cleared = id; },
  });
  assert.equal(beats.length, 1, 'the sitting opens the moment the world does');
  assert.equal(every, PLAY_BEAT_S * 1000);
  tick(); assert.equal(beats.length, 2);
  visible = false;
  tick(); tick();
  assert.equal(beats.length, 2, 'a background tab is not time played');
  visible = true;
  tick(); assert.equal(beats.length, 3);
  stop();
  assert.equal(cleared, 7);
});

test('ACC4: a beat that throws or rejects is dropped - a counter never breaks the world it counts', async () => {
  let tick = null;
  const rejected = [];
  const onRej = (e) => rejected.push(e);
  process.on('unhandledRejection', onRej);
  try {
    let n = 0;
    startPlayClock({
      beat: () => { n++; if (n === 1) throw new Error('sync'); return Promise.reject(new Error('async')); },
      setInterval: (fn) => { tick = fn; return 1; },
      clearInterval: () => {},
    });
    assert.doesNotThrow(() => tick());
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(rejected, []);
  } finally { process.off('unhandledRejection', onRej); }
});

test('ACC4: the beat sends the session as a Bearer and NO NUMBER, and a device with no session never knocks', async () => {
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const sent = [];
  const fetch = async (url, init) => { sent.push({ url, init }); return { ok: true, json: async () => ({ playedS: 5 }) }; };
  const beat = accountPlayBeat({ fetch, storage });

  assert.equal(await beat(), null);
  assert.equal(sent.length, 0, 'signed out, so nothing is asked');

  // READ AT EACH BEAT, not captured: signing in mid-sitting counts from the next knock
  m.set(SESSION_KEY, JSON.stringify({ id: 'p1', name: 'Nystul', kind: 'linked', sessionId: 's', secret: 'sek' }));
  const r = await beat();
  assert.equal(r.ok, true);
  assert.equal(r.data.playedS, 5);
  assert.equal(sent[0].url, `${DEFAULT_ACCOUNT_SERVICE}/v1/account/played`);
  assert.equal(sent[0].init.method, 'POST');
  assert.equal(sent[0].init.headers.authorization, 'Bearer sek');
  assert.doesNotMatch(sent[0].init.body, /\d/, 'the body carries a number - the service would ignore it, and this side should not be pretending');
});

test('ACC4: the world host starts the clock, on the stored session, gated on visibility', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /startPlayClock\(\{\s*beat: accountPlayBeat\(\{[^}]*storage: appStorage\(\)/,
    'the world no longer knocks with the device\'s own session');
  assert.match(w, /visible: \(\) => globalThis\.document\?\.visibilityState !== 'hidden'/);
  assert.equal((w.match(/startPlayClock\(/g) ?? []).length, 1, 'one clock per page - two would knock twice (harmless to the total, a wasted D1 write each beat)');
});

test('ACC4: the two facts read as words - a local date with the month named, and hours and minutes', () => {
  const s = Math.floor(new Date(2026, 8, 22, 23, 30).getTime() / 1000);   // LOCAL 22 Sep 2026, late evening
  assert.equal(registeredText(s), 'Sep 22, 2026', 'the player\'s own day, whatever UTC says');
  assert.equal(registeredText(null), null);
  assert.equal(registeredText(0), null, 'a zero is not 1970 - it is no date');
  assert.equal(registeredText(undefined), null);

  assert.equal(playedText(0), '0m');
  assert.equal(playedText(59), '0m');
  assert.equal(playedText(300), '5m');
  assert.equal(playedText(3599), '59m');
  assert.equal(playedText(3600), '1h 0m');
  assert.equal(playedText(125 * 3600 + 7 * 60 + 30), '125h 7m', 'hours do not roll into days - "125h" is how a game says it');
  assert.equal(playedText(undefined), '0m');
  assert.equal(playedText(-40), '0m');
});

/** The card's smallest document - enhancedaccount.test.js's stub. */
function fakeDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', disabled: false, children: [],
      append: (...kids) => n.children.push(...kids.filter(Boolean)),
      setAttribute() {},
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', {
      get() { return n._txt ?? null; },
      set(v) { n._txt = v; if (v === '') n.children.length = 0; },
    });
    return n;
  };
  return { createElement: mk };
}

const factsOf = (account) => {
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network'); } }, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  flow.stage = 'in';
  flow.account = account;
  const card = accountCard(fakeDoc(), flow);
  card.paint();
  const list = card.root.all.find((n) => n.className === 'acctfacts');
  return Object.fromEntries(list.children.map((li) => [li.children[0]._txt, li.children[1]._txt]));
};

test('ACC4: the card shows the registered date and the time played; a guest gets no date row', () => {
  const reg = Math.floor(new Date(2026, 8, 21, 12).getTime() / 1000);
  const linked = factsOf({ name: 'Lattymoy', handle: 'Lattymoy', kind: 'linked', registeredAt: reg, playedS: 2 * 3600 + 15 * 60 });
  assert.equal(linked.Registered, 'Sep 21, 2026');
  assert.equal(linked['Time played'], '2h 15m');

  const guest = factsOf({ name: 'Theod Gwyn', guestName: 'Theod Gwyn', kind: 'guest', registeredAt: null, playedS: 600 });
  assert.equal('Registered' in guest, false, 'a guest has registered nothing - no row, not a dash, not 1970');
  assert.equal(guest['Time played'], '10m', 'a guest\'s time is counted too - registering keeps the row');

  // A service a deploy behind answers no `playedS` at all: the card says 0m, not "undefined".
  assert.equal(factsOf({ name: 'Old', handle: 'Old', kind: 'linked' })['Time played'], '0m');
});
