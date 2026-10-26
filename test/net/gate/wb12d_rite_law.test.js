// WB12d (2026-10-01, Mac: "faithful and a Summoner"; then "Btw I want to do all 4. We're going balls deep with this"):
// THE FAITHFUL'S RITE - its law (net/gate/gateRite.js: where the circle stands, who stands at it, when it holds), the wire's
// word (net/wire.js), the receipt's rite (net/gate/gateReceipt.js) and the account service's ember (migration 0066) -
// bible/11-Multiplayer/World-Bosses.md section 19 D.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  RITE_MIN_M, RITE_MAX_M, RITE_OFF_APPROACH_DEG, RITE_REACH_M, RITE_UNITS_PER_M, RITE_FAITHFUL_MIN, RITE_FAITHFUL_MAX, RITE_CAREERS,
  RITE_SUMMONER_CAREER, riteOffset, riteLocalOf, riteNativeOf, riteNear, riteWindow, riteHolds, riteStands, riteFaithfulOf,
} from '../../../src/net/gate/gateRite.js';
import { gateSpotLocal, gateYaw, gateTimes, PIXEL_M, isGateDay, GATE_COLLAPSE_MS } from '../../../src/net/gate/gateLaw.js';
import { PIXEL_UNITS, mapPixelOfWire, validRiteIn, validRiteOut, parseClient, relaySupportsRite, RITE_RELAY_MIN, RITE_BY_MAX, sanitizeName } from '../../../src/net/wire.js';
import { ritePost } from '../../../src/net/gate/gateHerald.js';
import { RECEIPT_EARNED, receiptValid, mintReceipt, readReceipt, importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../../src/net/identityToken.js';
import { createGuest, claimGate, gateRecordOf, insigniaPurse, buyInsignia } from '../../../server-account/src/accounts.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const DAYS = Array.from({ length: 3000 }, (_, i) => i).filter(isGateDay);

test('WB12d the circle: 90 to 180 m from the arch, 50 degrees or more off either way in, inside the gate\'s own pixel with room to spare - carried out of the gate\'s frame as the Broker\'s spot is, and another day another place (mutants: the approach not kept; the distance not kept; the frame turned the wrong way)', () => {
  assert.ok(DAYS.length > 100);
  const sides = new Set(), near = [];
  let edge = Infinity;
  for (const d of DAYS) {
    const [lx, lz] = riteOffset(d), dist = Math.hypot(lx, lz);
    assert.ok(dist >= RITE_MIN_M - 1e-9 && dist <= RITE_MAX_M + 1e-9, `day ${d}: ${dist} m`);
    const offWay = Math.acos(Math.min(1, Math.abs(lz) / dist)) * (180 / Math.PI);
    assert.ok(offWay >= RITE_OFF_APPROACH_DEG - 1e-9, `day ${d}: ${offWay} degrees off the way in`);
    const [e, n] = riteLocalOf(d), [sx, sz] = gateSpotLocal(d);
    // AUDIT WB12d (L6): toward its pixel's heart - 140 m or more inside the pixel's edge, on the pixel's own land
    assert.ok(Math.min(e, n, PIXEL_M - e, PIXEL_M - n) >= 140, `day ${d}: on its pixel's own ground (${e}, ${n})`);
    edge = Math.min(edge, e, n, PIXEL_M - e, PIXEL_M - n);
    // gatePool.js gateLocal, on the circle: the offset comes back
    const c = Math.cos(gateYaw(d)), s = Math.sin(gateYaw(d)), dx = e - sx, dz = n - sz;
    assert.ok(Math.abs(c * dx - s * dz - lx) < 1e-6 && Math.abs(s * dx + c * dz - lz) < 1e-6, `day ${d}: the gate's own frame`);
    // ...and nearer its pixel's heart than any of its mirrors across the arch or its axis
    const h = PIXEL_M / 2, from = (x, z) => Math.hypot(sx + c * x + s * z - h, sz - s * x + c * z - h);
    for (const [mx, mz] of [[-lx, lz], [lx, -lz], [-lx, -lz]]) assert.ok(from(lx, lz) <= from(mx, mz) + 1e-9, `day ${d}: the heart's side`);
    sides.add(Math.sign(lx)); near.push(dist);
  }
  assert.ok(edge < 200, `the bound is met, not loose (${edge})`);
  assert.deepEqual([...sides].sort(), [-1, 1], 'either side of the arch');
  assert.ok(Math.min(...near) < 100 && Math.max(...near) > 170, 'near and far');
  // AUDIT WB12d (T): the law's own answer, written down - every client and the relay read this one place (a change here
  // is a relay version; it was a tautology, the function against itself)
  const [e700, n700] = riteLocalOf(700);
  assert.ok(Math.abs(e700 - 337.4638054557544) < 1e-9 && Math.abs(n700 - 355.8854500617274) < 1e-9, `${e700}, ${n700}`);
  assert.notDeepEqual(riteLocalOf(700), riteLocalOf(712));
});

test('WB12d the circle in the relay\'s frame: native units off the gate\'s pixel - the wire\'s own pixel law finds it there - a pose within RITE_REACH_M near, one past it not (mutants: the native frame\'s north turned; the reach unchecked)', () => {
  assert.equal(RITE_UNITS_PER_M, PIXEL_UNITS / PIXEL_M);
  for (const d of DAYS.slice(0, 60)) {
    const px = 100 + (d % 700), py = 20 + (d % 400);
    const [x, z] = riteNativeOf(d, px, py);
    assert.deepEqual(mapPixelOfWire(x, z), [px, py], `day ${d}`);
    const [e, n] = riteLocalOf(d);
    assert.ok(Math.abs(x - (px * PIXEL_UNITS + e * RITE_UNITS_PER_M)) < 1e-6 && Math.abs(z - ((499 - py) * PIXEL_UNITS + n * RITE_UNITS_PER_M)) < 1e-6);
    assert.equal(riteNear(d, px, py, x + (RITE_REACH_M - 1) * RITE_UNITS_PER_M, z), true);
    assert.equal(riteNear(d, px, py, x, z - (RITE_REACH_M + 1) * RITE_UNITS_PER_M), false);
  }
});

test('WB12d the faithful and the window: the Summoner first - a Sorcerer, known by his kind on every screen - then 6 to 8 of the four robed careers by the day\'s roll; the rite holds from the omen until the breach opens, and its circle stands until the breach collapses (mutants: the count one short; the window to the seal; the circle gone at the opening)', () => {
  const counts = new Set();
  for (const d of DAYS) {
    const f = riteFaithfulOf(d);
    assert.deepEqual(f[0], { career: RITE_SUMMONER_CAREER, summoner: true });
    assert.equal(RITE_SUMMONER_CAREER, 131, 'a Sorcerer');
    assert.ok(!RITE_CAREERS.includes(RITE_SUMMONER_CAREER), 'none of the faithful is his kind');
    const rest = f.slice(1);
    assert.ok(rest.length >= RITE_FAITHFUL_MIN && rest.length <= RITE_FAITHFUL_MAX, `day ${d}: ${rest.length}`);
    assert.ok(rest.every((x) => !x.summoner && RITE_CAREERS.includes(x.career)));
    counts.add(rest.length);
  }
  assert.deepEqual([...counts].sort(), [6, 7, 8]);
  assert.deepEqual([...RITE_CAREERS], [128, 130, 132, 133], 'Mage, Battlemage, Healer, Nightblade');
  const t = gateTimes(700);
  assert.deepEqual(riteWindow(700), { from: t.omenAt, to: t.openAt });
  assert.deepEqual([t.omenAt - 1, t.omenAt, t.openAt - 1, t.openAt].map((ms) => riteHolds(700, ms)), [false, true, true, false]);
  // the circle, its chest and the word of a broken rite stand until the breach collapses
  const gone = t.wrathAt + GATE_COLLAPSE_MS;
  assert.deepEqual([t.omenAt - 1, t.omenAt, gone - 1, gone].map((ms) => riteStands(700, ms)), [false, true, true, false]);
});

test('WB12d the receipt: a third way earned - the rite alone - and a fighter\'s `r`, written only when 1 and never on a rite\'s own receipt; minted and read back with it (mutants: r dropped from the claims; r on the rite\'s own passed)', async () => {
  assert.deepEqual([...RECEIPT_EARNED], ['dealt', 'stood', 'rite']);
  const base = { d: 700, b: 'ruhn', s: 'acct-1', c: 7, x: 'dealt', i: 1000, e: 2000 };
  assert.equal(receiptValid({ ...base, r: 1 }), true);
  assert.equal(receiptValid({ ...base, x: 'rite' }), true);
  assert.equal(receiptValid({ ...base, x: 'rite', r: 1 }), false, 'the rite\'s own is its ember already');
  assert.equal(receiptValid({ ...base, r: 2 }), false);
  assert.equal(receiptValid({ ...base, r: 0 }), false);
  const nowS = 1_800_000_000;
  const helped = readReceipt(await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-1', c: 7, x: 'dealt', l: 10, r: 1 }, null, { subtle, nowS }));
  assert.equal(helped.r, 1);
  assert.equal(helped.l, 10);
  const plain = readReceipt(await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-1', c: 7, x: 'stood' }, null, { subtle, nowS }));
  assert.equal('r' in plain, false, 'no r when none');
  assert.equal(readReceipt(await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-2', c: 9, x: 'rite' }, null, { subtle, nowS })).x, 'rite');
});

test('WB12d the wire: a rite word is {d, px, py, s, f, c} and nothing more (BROKER-CAGE\'s `c` 0 in a word from before it), parsed only after a hello; the hub\'s broken word bounds its names; a word is said only to a relay that keeps the rite (world151; world141 on its branch) - an older one closes the socket on it (mutants: a bad flag passed; the names unbounded; the version law)', () => {
  assert.deepEqual(validRiteIn({ d: 700, px: 10, py: 20, s: 1, f: 0, x: 'junk' }), { d: 700, px: 10, py: 20, s: 1, f: 0, c: 0 });
  assert.deepEqual(validRiteIn({ d: 700, px: 10, py: 20, s: 1, f: 1, c: 1 }), { d: 700, px: 10, py: 20, s: 1, f: 1, c: 1 }, 'BROKER-CAGE: every one of them seen to fall');
  for (const bad of [{ d: -1 }, { px: 1000 }, { py: 500 }, { s: 2 }, { f: true }, { d: 1.5 }, { c: 2 }, { c: true }, { c: null }]) assert.equal(validRiteIn({ d: 700, px: 10, py: 20, s: 0, f: 0, ...bad }), null, JSON.stringify(bad));
  const frame = JSON.stringify({ t: 'rite', d: 700, px: 10, py: 20, s: 1, f: 1 });
  assert.deepEqual(parseClient(frame, { hasHello: true }), { t: 'rite', d: 700, px: 10, py: 20, s: 1, f: 1, c: 0 });
  assert.ok(parseClient(frame, { hasHello: false }).error);
  const names = Array.from({ length: 20 }, (_, i) => `N${i}`);
  const out = validRiteOut({ k: 'br', d: 700, px: 1, py: 2, at: 5, by: [...names, '', 3] });
  assert.equal(out.by.length, RITE_BY_MAX);
  // AUDIT WB12d (L8): junk ahead of the names hides none of them
  assert.deepEqual(validRiteOut({ k: 'br', d: 700, px: 1, py: 2, at: 5, by: ['', 3, null, {}, ...names] }).by, names.slice(0, RITE_BY_MAX));
  assert.equal(validRiteOut({ k: 'xx', d: 700, px: 1, py: 2, at: 5 }), null);
  assert.equal(RITE_RELAY_MIN, 151);   // world141 on its branch: main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first
  assert.deepEqual(['world150', 'world151', 'world152', 'world153', 'world155', 'acct62', null].map(relaySupportsRite), [false, true, true, true, true, false, false]);
});

// ═══ THE ACCOUNT SERVICE: THE RITE'S EMBER ═══════════════════════════════════════════════════════

const MIGRATIONS = readdirSync(new URL('../../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
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
        // PIN MOVED (AUDIT FB1024, BROKER-RID): a batch's statement answers its rows as D1's does (a D1Result each - an
        // UPDATE ... RETURNING's rows in `results`; egSink read them so already, and the insignia's sale rides one now)
        _d1() { const results = stmt.all(...args); return { results, meta: { changes: Number(db.prepare('SELECT changes() AS c').get().c) } }; },
      };
      return api;
    },
    async batch(stmts) { const out = []; for (const s of stmts) out.push(s._d1()); return out; },
  };
}
const T0 = 1_800_000_000;
let _n = 0;
async function member(db) {
  const id = (await createGuest({ db, subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: T0 }, { deviceLabel: null })).id;
  const h = `Breaker${++_n}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
}
async function gatePair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}

test('WB12d the account service: a fighter who broke the rite takes two embers, one who broke it alone takes one - struck no Drakes and closed no breach; the purse sums the rows\' embers, every row before 0066 paying one; SEAT1b at the merge: a kill\'s row keeps the region its claim names, the rite\'s own row none (mutants: the rite\'s row given the region; the rite\'s ember unpaid; the rite counted a breach closed; the rite struck; the purse counting rows)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db);
  const { priv, pubKey } = await gatePair();
  const ctx = { db, nowS: T0 + 60, subtle };
  const mint = (o) => mintReceipt({ b: 'ruhn', c: 4242, ...o }, priv, { subtle, nowS: T0 });
  const struck = [];
  const strike = (day) => { struck.push(day); return null; };
  assert.deepEqual(await claimGate(ctx, A, await mint({ d: 700, s: A.id, x: 'dealt', r: 1 }), pubKey, { strike, region: 21 }), { recorded: true, day: 700, stones: 2, closed: 1 });
  assert.equal(await insigniaPurse({ db }, { id: A.id, insignia_spent: 0 }), 2, 'the gate\'s ember and the rite\'s');
  assert.deepEqual(await claimGate(ctx, B, await mint({ d: 700, s: B.id, x: 'rite' }), pubKey, { strike, region: 21 }), { recorded: true, day: 700, stones: 1, rite: true, closed: 0 }, 'the rite alone: no breach closed');
  const regionOf = (who) => db._raw.prepare('SELECT region FROM gate_kills WHERE day = 700 AND account = ?').get(who.id).region;
  assert.deepEqual([regionOf(A), regionOf(B)], [21, null], 'SEAT1b: the kill\'s row keeps its region; the rite\'s own none, no vote on the day\'s region');
  assert.deepEqual(struck, [700], 'and no Drakes struck for it');
  assert.equal(await insigniaPurse({ db }, { id: B.id, insignia_spent: 0 }), 1);
  assert.deepEqual(await claimGate(ctx, B, await mint({ d: 700, s: B.id, x: 'dealt' }), pubKey), { recorded: false, why: 'claimed', stones: 1, closed: 0 }, 'one receipt a day and account, as ever');
  assert.deepEqual(await claimGate(ctx, A, await mint({ d: 712, s: A.id, x: 'stood' }), pubKey), { recorded: true, day: 712, stones: 1, closed: 2 });
  assert.equal(await insigniaPurse({ db }, { id: A.id, insignia_spent: 1 }), 2, 'three embers, one spent');
  assert.deepEqual(await gateRecordOf({ db }, A.id), { closed: 2 });
  assert.match(src('server-account/migrations/0066_rite_ember.sql'), /^ALTER TABLE gate_kills ADD COLUMN stones INTEGER NOT NULL DEFAULT 1;$/m);
});

test('AUDIT WB12d (A1) the account service: A FIGHTER\'S `r` COUNTED AT ONE EMBER (a service from before acct62 kept its row as a plain receipt\'s) is made good when it is claimed again - and only that: a rite\'s own row, or a row already two, is never raised; every answer says the row\'s embers (mutants: never made good; a rite row raised; the embers unsaid)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db);
  const { priv, pubKey } = await gatePair();
  const ctx = { db, nowS: T0 + 60, subtle };
  const mint = (o) => mintReceipt({ b: 'ruhn', c: 4242, ...o }, priv, { subtle, nowS: T0 });
  db._raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (700, ?, 'ruhn', 'dealt', 1)").run(A.id);   // acct61's row: no stones said
  assert.equal(await insigniaPurse({ db }, { id: A.id, insignia_spent: 0 }), 1, 'the rite\'s ember lost');
  const again = await mint({ d: 700, s: A.id, x: 'dealt', r: 1 });
  assert.deepEqual(await claimGate(ctx, A, again, pubKey), { recorded: false, why: 'claimed', stones: 2, closed: 1 }, 'claimed again: made good');
  assert.equal(await insigniaPurse({ db }, { id: A.id, insignia_spent: 0 }), 2);
  assert.deepEqual(await claimGate(ctx, A, again, pubKey), { recorded: false, why: 'claimed', stones: 2, closed: 1 }, 'and never more');
  assert.deepEqual(await claimGate(ctx, B, await mint({ d: 701, s: B.id, x: 'rite' }), pubKey), { recorded: true, day: 701, stones: 1, rite: true, closed: 0 });
  db._raw.prepare("UPDATE gate_kills SET earned = 'rite' WHERE day = 701 AND account = ?").run(B.id);
  await claimGate(ctx, B, await mint({ d: 701, s: B.id, x: 'dealt', r: 1 }), pubKey);
  assert.equal(await insigniaPurse({ db }, { id: B.id, insignia_spent: 0 }), 1, 'a rite\'s own row is never raised');
});

test('AUDIT WB12d (lens T F7) the Broker\'s sale spends the purse the card shows - a breach closed with its rite broken is two embers at the sale too (mutants: the sale\'s guard counting rows)', async () => {
  const db = d1();
  const A = await member(db);
  const ins = db._raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, stones) VALUES (?, ?, 'ruhn', 'dealt', 1, 2)");
  for (let d = 0; d < 15; d++) ins.run(1000 + d, A.id);   // fifteen breaches, each with its rite broken: thirty embers
  const player = db._raw.prepare('SELECT * FROM players WHERE id = ?').get(A.id);
  assert.equal(await insigniaPurse({ db }, player), 30);
  const sale = await buyInsignia({ db, nowS: T0 + 100 }, player, {}, 'title:gatebreaker');
  assert.equal(sale.ok, true, JSON.stringify(sale));
  assert.equal(sale.purse, 0);
});

test('AUDIT WB12d (lens T F14, F21, F22): the law\'s numbers are the bible\'s - a word believed from 60 m of the circle and no further, the faithful each their own career; the wire\'s edges - the map\'s last column and row a place, a day and an instant the hub\'s word must carry, its names made safe; the channel\'s names stripped of what Discord would read (mutants: the reach strict; the reach doubled; one career a day; the last column refused; the day unchecked; an instant of 0; the names raw; the post\'s names raw)', () => {
  let edge = null;
  for (const d of DAYS) {
    const [x, z] = riteNativeOf(d, 300, 200);
    if (Math.hypot(x + 60 * RITE_UNITS_PER_M - x, 0) === 60 * RITE_UNITS_PER_M) { edge = { d, x, z }; break; }
  }
  assert.ok(edge, 'a day whose circle sits on a whole unit');
  assert.equal(riteNear(edge.d, 300, 200, edge.x + 60 * RITE_UNITS_PER_M, edge.z), true, 'at 60 m: at the circle');
  assert.equal(riteNear(edge.d, 300, 200, edge.x + 60.05 * RITE_UNITS_PER_M, edge.z), false, 'past it: not');
  let mixed = 0;
  for (const d of DAYS) if (new Set(riteFaithfulOf(d).filter((m) => !m.summoner).map((m) => m.career)).size >= 3) mixed++;
  assert.ok(mixed > DAYS.length / 2, `each of the faithful its own career (${mixed} of ${DAYS.length} days three or more)`);
  assert.deepEqual(validRiteIn({ d: 200, px: 999, py: 499, s: 1, f: 0 }), { d: 200, px: 999, py: 499, s: 1, f: 0, c: 0 }, 'the map\'s last column and row');
  assert.equal(validRiteIn({ d: 200, px: 1000, py: 499, s: 1, f: 0 }), null);
  const out = { k: 'br', d: 200, px: 300, py: 200, at: 5, by: ['Ann'], n: 1 };
  for (const d of [-1, 1.5, '200', null]) assert.equal(validRiteOut({ ...out, d }), null, `day ${d}`);
  assert.equal(validRiteOut({ ...out, at: 0 }), null, 'no instant');
  assert.equal(validRiteOut({ ...out, at: 1 })?.at, 1);
  const raw = 'Ann\u0007\u00e9  ';
  assert.notEqual(sanitizeName(raw), raw);
  assert.deepEqual(validRiteOut({ ...out, by: [raw] }).by, [sanitizeName(raw)], 'its names made safe');
  const post = ritePost({ place: 'Copperham', by: ['**Ann**', '<@&123>Bran'], n: 2 });
  assert.equal(post.embeds[0].fields.find((f) => f.name === 'Broken by').value, 'Ann and 123Bran', 'no markdown, no mention');   // HERALD-CARDS: the card's field
});
