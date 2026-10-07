// PROF1 (2026-09-28, Mac: "Begin!") - THE PROFESSIONS' SERVICE: the switch and the wall, a character's state, a
// harvest (the law's node, the day, the hour, the rank, the cap, the Stores' room, the witnessed pixel), a request asked
// twice, a withdrawal (bought first), the Court writs (posted from witnessed ground, taken whole by the first, three a
// day, the pay struck), and a specialisation (free, then 1,000 Marks and a week). Driven through the real Worker over
// node:sqlite (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 22.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { herbPatches, nodeKey, utcDayOfMs, pixelKey } from '../src/net/nodeLaw.js';
import { herbKey, rankOfXp, writXp, STORES_MAX, COURT_WRITS_PER_DAY, RESPEC, xpForRank } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { RENOWN_TRACKS_MAX } from '../src/net/renown.js';   // RENOWN-CHAR: a writ's Renown makes a track only under the tracks' bound

const DAY = 86_400;
const WOODS = 231, SWAMP = 228, ANTICLERE = 21, DAGGERFALL = 17;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
/** The first second from `from` whose shared hour is `want` (a whole minute of it, not its edge). */
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
/** Noon on the shared clock, in the day T0 falls in - with room for ten minutes either side inside the UTC day. */
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(NOON);
let _rid = 0;
const rid = () => `prof-${String(++_rid).padStart(6, '0')}`;

/** A pixel's patches today (unconfirmed unless said), and the first of a tier. T0's day is winter on the shared clock
 *  (month 1): the Woodlands' uncommon herbs are all bare, so a tier-2 patch is sought in the Swamp (its Bamboo grows). */
const patchesAt = (x, y, confirmed = false, climate = WOODS) => herbPatches({ x, y, day: utcDay(_now), climate, confirmed });
function patchOfTier(tier, confirmed = false, climate = WOODS, from = 300) {
  for (let x = from; x < 700; x++) {
    const p = patchesAt(x, 200, confirmed, climate).find((q) => q.tier === tier);
    if (p) return { x, y: 200, climate, ...p };
  }
  throw new Error('no patch of that tier');
}
const harvestBody = (who, p, extra = {}) => ({
  character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
  climate: p.climate ?? WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid(), ...extra,
});
async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const stores = (who, material) => raw.prepare("SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin").all(who.id, who.character, material)
    .map((r) => [r.origin, Number(r.qty)]);
  const give = (who, material, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, material, origin, qty);
  const xpOf = (who, prof = 'herbalism') => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof = 'herbalism') => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xp, _now);
  return { ...s, raw, age, stores, give, xpOf, setXp };
}

// ─── THE WALL AND THE SWITCH ─────────────────────────────────────────

test('PROF1 service: registered only; PROFESSIONS_OPEN off shuts every route, dev opens it to the developers alone; the routes are served', async () => {
  const s = await stand({ PROFESSIONS_OPEN: 'dev' });
  const g = await s.guest();
  assert.deepEqual((await s.call('/v1/prof/state', { character: 'char-guest' }, g.secret)).body, { error: 'prof-need-account' });
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  assert.equal((await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).status, 200, 'a developer at dev');
  const shut = await s.call('/v1/prof/state', { character: ann.character }, ann.secret);
  assert.deepEqual([shut.status, shut.body], [403, { error: 'prof-closed' }]);
  const off = await stand({ PROFESSIONS_OPEN: 'off' });
  const m2 = await off.registered('Mac');
  for (const path of ['/v1/prof/state', '/v1/prof/pixels', '/v1/prof/harvest', '/v1/prof/spec', '/v1/stores/withdraw', '/v1/writs/list', '/v1/writs/deliver']) {
    const r = await off.call(path, { character: m2.character, rid: rid(), pixels: [], region: 1, id: 'c:1:1:0' }, m2.secret);
    assert.equal(r.body?.error, 'prof-closed', path);
  }
  assert.deepEqual((await s.call('/v1/prof/state', { character: 'no' }, mac.secret)).body, { error: 'prof-character' });
});

test('PROF1 service: a character\'s state - thirteen tracks at nothing, no Stores, the day\'s bounds', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const r = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body;
  assert.equal(r.tracks.length, 13);
  assert.deepEqual(r.tracks.find((t) => t.profession === 'herbalism'), { profession: 'herbalism', xp: 0, rank: 0, specs: { 50: null, 100: null }, respec: null });
  assert.deepEqual([r.stores, r.taken, r.today, r.writs], [[], [], {}, { today: 0, max: 3 }]);
  assert.deepEqual(r.caps, { stores: STORES_MAX, withdraw: 200, highHides: 3 });   // PROF7 moved it: Hunting's day, the account's; PROF8: Fishing's; CAP-OFF: no day's harvests, hides or hauls
  assert.deepEqual(r.hunt, { hides: 0, high: 0 });
  assert.equal(r.hauls, 0);   // PROF8: the account's hauls today
  assert.equal(r.day, utcDay(_now));
});

// ─── A HARVEST ───────────────────────────────────────────────────────

test('PROF1 service: a common herb picked - the law\'s node, today, in daylight: its own units into the Stores, 15 XP; asked again it is one harvest', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(1);
  const body = harvestBody(mac, p);
  const r = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const key = herbKey(p.herb, ANTICLERE);
  assert.equal(r.body.material, key);
  assert.ok(r.body.qty >= 1 && r.body.qty <= 3, 'an herb 1-3, no march on a pixel nobody confirmed');
  assert.equal(r.body.xp, 15, 'tier 1, plain');
  assert.deepEqual(s.stores(mac, key), [['own', r.body.qty]]);
  assert.equal(r.body.track.xp, 15);
  assert.equal(r.body.today, 1);
  const again = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.equal(again.body.repeat, true);
  assert.equal(again.body.qty, r.body.qty);
  assert.deepEqual(s.stores(mac, key), [['own', r.body.qty]], 'nothing moved twice');
  assert.equal(s.xpOf(mac), 15);
  s.env.PROFESSIONS_OPEN = 'off';
  const closed = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.deepEqual([closed.status, closed.body.repeat, closed.body.qty], [200, true, r.body.qty], 'a harvest made is answered though the switch shut after it (the rid before the switch)');
  assert.equal((await s.call('/v1/prof/harvest', { ...body, rid: rid() }, mac.secret)).body.error, 'prof-closed');
  s.env.PROFESSIONS_OPEN = 'on';
  const taken = await s.call('/v1/prof/harvest', { ...body, rid: rid() }, mac.secret);
  assert.deepEqual([taken.status, taken.body], [409, { error: 'node-taken' }], 'a node once a day');
  const food = await s.call('/v1/prof/harvest', { ...body, rid: rid(), kind: 'food', act: { finds: 3 } }, mac.secret);
  assert.equal(food.status, 200, 'the patch\'s second harvest is the Basket\'s');
  assert.match(food.body.material, /^food:(apple|orange|mushroom|egg)$/);
  assert.equal(food.body.xp, 22, 'tier 1, all three found: +50%');
  const st = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body;
  assert.deepEqual(st.taken.sort(), [`${body.node}|food`, `${body.node}|herbs`].sort());
  assert.deepEqual(st.today, { herbalism: 2 });
});

test('PROF1 service: the day and the node are the law\'s - yesterday\'s node lapses, an act past ten minutes is late, a slot the climate lacks is no node; the night harvests (ANY-HOUR)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(1);
  const post = async (extra) => (await s.call('/v1/prof/harvest', harvestBody(mac, p, extra), mac.secret)).body;
  assert.deepEqual(await post({ node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(_now) - 1, slot: p.slot }) }), { error: 'prof-day' });
  assert.deepEqual(await post({ at: _now - 601 }), { error: 'prof-late' });
  assert.deepEqual(await post({ at: _now + 61 }), { error: 'prof-late' });
  assert.deepEqual(await post({ node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(_now), slot: 8 }) }), { error: 'bad-node' }, 'Woodlands has eight patches (PIN MOVED, MORE-NODES)');
  assert.deepEqual(await post({ node: 'vein:1:1:1:0' }), { error: 'prof-kind' }, 'PROF2: a vein is ore, never herbs');
  assert.deepEqual(await post({ node: 'tree:1:1:1:0', kind: 'herbs' }), { error: 'prof-kind' }, 'PROF4: a tree is Logging\'s - logs, never herbs');
  assert.deepEqual(await post({ kind: 'logs' }), { error: 'prof-kind' });
  assert.deepEqual(await post({ climate: 223 }), { error: 'prof-pixel' }, 'the sea grows no herbs');
  // PIN MOVED (ANY-HOUR, 2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"):
  // 02:00 on the shared clock refused (`prof-night`) and 07:00 was day (FORAGE0 14.3); now no hour is refused
  const night = secondAt(utcDay(_now) * DAY + 60, 2);
  clock(night);
  const dark = await post({ at: night - 1, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(night), slot: p.slot }) });
  assert.ok(dark.ok, `02:00 harvests: ${JSON.stringify(dark)}`);
  clock(NOON);
});

test('PROF1 service: the rank - an uncommon herb wants Herbalism 10; unbruised it is the clean act (+50% XP); bruised it is plain and one less; a common herb has no moment', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(2, false, SWAMP);
  assert.deepEqual((await s.call('/v1/prof/harvest', harvestBody(mac, p), mac.secret)).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(10));
  const clean = await s.call('/v1/prof/harvest', harvestBody(mac, p, { act: { clean: true, bruised: false } }), mac.secret);
  assert.equal(clean.body.xp, 45, '15 x 2, +50% unbruised');
  const q = patchOfTier(2, false, SWAMP, p.x + 1);
  const bruised = await s.call('/v1/prof/harvest', harvestBody(mac, q, { act: { clean: true, bruised: true } }), mac.secret);
  assert.equal(bruised.body.xp, 30, 'a bruise is never clean, whatever the report says');
  const c = patchOfTier(1);
  const common = await s.call('/v1/prof/harvest', harvestBody(mac, c, { act: { clean: true, bruised: true } }), mac.secret);
  // PIN MOVED (2026-10-01 part four, HERB-XP - Mac: "XP follows your rank"): picked at the rank's tier, 2 at rank 10
  assert.equal(common.body.xp, 30, 'a common herb comes up by hand: no moment, no bruise - 15 x 2, never the clean act\'s +50%');
});

test('PROF1 service: no day\'s cap (CAP-OFF) - sixty harvests a character today and the sixty-first is credited, the day counted on; the Stores\' room - full refuses, nearly full cuts the yield to fit', async (t) => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const day = utcDay(_now);
  const ins = s.raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n)
    VALUES (?, ?, 'herbs', ?, ?, 'herbalism', 'p1:9', 1, 15, ?, ?, 'x')`);
  for (let i = 0; i < 60; i++) ins.run(day, `herb:1:1:${day}:${i}x`, mac.id, mac.character, _now, `seed-${i}-xxxx`);
  const p = patchOfTier(1);
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): the sixty-first was refused, `prof-cap`
  const past = await s.call('/v1/prof/harvest', harvestBody(mac, p), mac.secret);
  assert.equal(past.status, 200, JSON.stringify(past.body));
  assert.equal(past.body.today, 61, 'the sixty-first credited, the day counted on');
  const ann = await s.registered('Ann');
  const key = herbKey(p.herb, ANTICLERE);
  s.give(ann, key, 'bought', STORES_MAX);
  const full = await s.call('/v1/prof/harvest', harvestBody(ann, p), ann.secret);
  assert.deepEqual([full.status, full.body.error], [409, 'stores-full']);
  s.give(ann, key, 'bought', STORES_MAX - 1);
  // the service's dice at their highest, so the roll is past the one unit of room (PROF2: a roll of one never proved the cut)
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => (b.byteLength === 4 ? b.fill(0xff) : real(b)));
  const one = await s.call('/v1/prof/harvest', harvestBody(ann, p), ann.secret);
  assert.equal(one.body.qty, 1, 'cut to the room left');
  assert.deepEqual(s.stores(ann, key), [['bought', STORES_MAX - 1], ['own', 1]]);
});

// ─── THE WITNESSED PIXEL ─────────────────────────────────────────────

test('PROF1 service: the witnessed pixel - three accounts a week old agreeing confirm it; a new account witnesses nothing; a claim against a confirmed pixel is refused; the pixels read says so', async () => {
  const s = await stand();
  const p = patchOfTier(1);
  const who = [];
  for (const h of ['Annwyn', 'Bosmer', 'Cyrodil', 'Dibella']) { const w = await s.registered(h); who.push(w); }
  s.age(who[0], 8); s.age(who[1], 8); s.age(who[3], 1);
  const read = async (w) => (await s.call('/v1/prof/pixels', { character: w.character, pixels: [[p.x, p.y], [p.x + 1, p.y]] }, w.secret)).body.pixels;
  assert.deepEqual((await read(who[0]))[0], { x: p.x, y: p.y, state: 'none' });
  await s.call('/v1/prof/harvest', harvestBody(who[0], p), who[0].secret);
  await s.call('/v1/prof/harvest', harvestBody(who[3], p), who[3].secret);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE key = ?").get(pixelKey(p.x, p.y)).n, 1, 'a day-old account reports nothing');
  assert.deepEqual((await read(who[0]))[0], { x: p.x, y: p.y, state: 'unconfirmed' });
  await s.call('/v1/prof/harvest', harvestBody(who[1], p), who[1].secret);
  s.age(who[2], 8);
  await s.call('/v1/prof/harvest', harvestBody(who[2], p), who[2].secret);
  assert.deepEqual((await read(who[0]))[0], { x: p.x, y: p.y, state: 'confirmed', climate: WOODS, region: ANTICLERE });
  const liar = await s.registered('Eve');
  const r = await s.call('/v1/prof/harvest', harvestBody(liar, p, { region: DAGGERFALL }), liar.secret);
  assert.deepEqual([r.status, r.body], [409, { error: 'prof-pixel' }], 'the confirmed answer stands');
  assert.deepEqual((await s.call('/v1/prof/pixels', { character: liar.character, pixels: [[1000, 1]] }, liar.secret)).body, { error: 'bad-pixels' });
});

// ─── WITHDRAW TO THE PACK ────────────────────────────────────────────

test('PROF1 service: withdraw to pack - bought units first, own kept for writs; asked twice it is one; short refuses; a key the Stores never hold is refused', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'p1:19', 'bought', 2);
  s.give(mac, 'p1:19', 'own', 5);
  const body = { character: mac.character, material: 'p1:19', qty: 3, rid: rid() };
  const r = await s.call('/v1/stores/withdraw', body, mac.secret);
  assert.deepEqual([r.status, r.body], [200, { ok: true, material: 'p1:19', qty: 3, store: { material: 'p1:19', own: 4, bought: 0 } }]);
  assert.deepEqual(s.stores(mac, 'p1:19'), [['own', 4]], 'the bought row spent and gone');
  const again = await s.call('/v1/stores/withdraw', body, mac.secret);
  assert.deepEqual(again.body, { ok: true, repeat: true, material: 'p1:19', qty: 3, store: { material: 'p1:19', own: 4, bought: 0 } });
  assert.deepEqual((await s.call('/v1/stores/withdraw', { ...body, rid: rid(), qty: 5 }, mac.secret)).body, { error: 'stores-short' });
  assert.deepEqual((await s.call('/v1/stores/withdraw', { ...body, rid: rid(), material: 'p1:21' }, mac.secret)).body, { error: 'bad-material' }, 'Black Rose is a southern plant only');
  assert.deepEqual((await s.call('/v1/stores/withdraw', { ...body, rid: rid(), qty: 201 }, mac.secret)).body, { error: 'bad-qty' });
  const all = await s.call('/v1/stores/withdraw', { ...body, rid: rid(), qty: 4 }, mac.secret);
  assert.deepEqual(all.body.store, { material: 'p1:19', own: 0, bought: 0 });
  assert.deepEqual(s.stores(mac, 'p1:19'), [], 'a row at nought is deleted');
});

// ─── COURT WRITS ─────────────────────────────────────────────────────

async function witnessed(s, region = ANTICLERE) {
  const w = await s.registered(`Wit${region}`);
  s.age(w, 8);
  await s.call('/v1/prof/harvest', harvestBody(w, patchOfTier(1), { region }), w.secret);
  return w;
}

test('PROF1 service: Court writs - a region posts none until its ground is witnessed, then six (a small server), written down for the day; each asks what the ground grows', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const list = async () => (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body;
  assert.deepEqual((await list()).writs, []);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM writ_days').get().n, 0, 'nothing written down - a later read posts');
  await witnessed(s);
  const l = await list();
  assert.equal(l.writs.length, 6);
  assert.equal(l.endsAt, (utcDay(_now) + 1) * DAY);
  for (const w of l.writs) {
    assert.match(w.material, /^(p1:|metal:|stone:)/, 'Anticlere is a Breton region: northern plants; PROF2: the ground\'s metal and stone beside them');
    assert.equal(w.qty % 10, 0);
    assert.equal(w.state, 'open');
    assert.ok(w.tier <= 2, 'an unconfirmed pixel\'s ground asks tiers 1-2 only');
  }
  assert.deepEqual((await list()).writs, l.writs, 'the day\'s writs never change under the players');
  assert.deepEqual((await s.call('/v1/writs/list', { character: mac.character, region: 62 }, mac.secret)).body, { error: 'bad-region' });
});

test('PROF1 service: a Court writ taken - filled whole from the Stores (bought first), the pay struck as a `writ` line, twice the pay in Herbalism XP, the Renown credited; asked twice it is one; another\'s is taken; three a day', async () => {
  const s = await stand();
  await witnessed(s);
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  const l = (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body;
  const w = l.writs[1];
  s.give(mac, w.material, 'bought', 5);
  s.give(mac, w.material, 'own', w.qty + 7);
  const body = { character: mac.character, id: w.id, rid: rid() };
  const r = await s.call('/v1/writs/deliver', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.pay, w.pay);
  assert.equal(r.body.balance, w.pay);
  assert.deepEqual(r.body.store, { material: w.material, own: 12, bought: 0 }, 'bought first, then own');
  assert.equal(r.body.track.xp, writXp(w.pay));
  assert.deepEqual(r.body.renown, { character: mac.character, xp: w.renown, level: r.body.renown.level, credited: w.renown, rose: r.body.renown.rose });   // RENOWN-CHAR: the delivering character's track again (MERGE 2 paid RENOWN-ACCOUNT's)
  assert.deepEqual(s.raw.prepare('SELECT char_id, xp FROM renown_tracks WHERE player = ?').all(mac.id).map((x) => ({ ...x })), [{ char_id: mac.character, xp: w.renown }], 'the character\'s own track, made by the writ');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM renown_accounts').get().n, 0, 'and never RENOWN-ACCOUNT\'s table - history now');
  assert.deepEqual(r.body.today, { filled: 1, max: COURT_WRITS_PER_DAY });
  assert.equal(r.body.writ.state, 'mine');
  const line = s.raw.prepare("SELECT * FROM marks_ledger WHERE kind = 'writ'").all();
  assert.equal(line.length, 1);
  assert.deepEqual([line[0].src_kind, line[0].dst_id, line[0].amount, line[0].rid], ['mint', mac.id, w.pay, `writ:${w.id}`]);
  const again = await s.call('/v1/writs/deliver', body, mac.secret);
  assert.equal(again.body.repeat, true);
  assert.equal(again.body.balance, w.pay, 'paid once');
  s.give(ann, w.material, 'own', 100);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: ann.character, id: w.id, rid: rid() }, ann.secret)).body, { error: 'writ-taken' });
  // three a day
  let filled = 1, renown = w.renown;
  for (const o of l.writs.filter((x) => x.id !== w.id)) {
    s.give(mac, o.material, 'own', 100);
    const d = await s.call('/v1/writs/deliver', { character: mac.character, id: o.id, rid: rid() }, mac.secret);
    if (filled < COURT_WRITS_PER_DAY) {
      assert.equal(d.status, 200);
      renown += o.renown;   // MERGE 2: each writ adds to the account's one track, the row the first one made
      assert.deepEqual([d.body.renown.xp, d.body.renown.credited], [renown, o.renown]);
      filled++;
    } else { assert.deepEqual(d.body, { error: 'writ-cap' }); break; }
  }
});

test('RENOWN-CHAR a Court writ\'s Renown is the delivering character\'s own track - onto the one it has, another character of the account untouched; at the tracks\' bound a character with none is filled and paid, and given no track (mutants: the writ paid onto no track; the first track never made; the bound unread)', async () => {
  const s = await stand();
  await witnessed(s);
  const mac = await s.registered('Mac');
  const [w1, w2] = (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body.writs;
  const track = (id) => s.raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(mac.id, id)?.xp ?? null;
  const seat = s.raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)');
  seat.run(mac.id, mac.character, 'Mac', 500);
  seat.run(mac.id, 'char-alt1', 'Alt', 9000);
  s.give(mac, w1.material, 'own', w1.qty);
  const r = await s.call('/v1/writs/deliver', { character: mac.character, id: w1.id, rid: rid() }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.renown.character, r.body.renown.xp, r.body.renown.credited], [mac.character, 500 + w1.renown, w1.renown], 'onto its own 500');
  assert.deepEqual([track(mac.character), track('char-alt1')], [500 + w1.renown, 9000], 'another character of the account is untouched');
  // THE TRACKS' BOUND: sixty an account - a character with none past it is filled and paid, and no track made
  for (let i = s.raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE player = ?').get(mac.id).n; i < RENOWN_TRACKS_MAX; i++) seat.run(mac.id, `char-b${String(i).padStart(3, '0')}`, null, 0);
  const fresh = { ...mac, character: 'char-fresh' };
  s.give(fresh, w2.material, 'own', w2.qty);
  const f = await s.call('/v1/writs/deliver', { character: fresh.character, id: w2.id, rid: rid() }, mac.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.equal(f.body.pay, w2.pay, 'filled and paid its Marks');
  assert.deepEqual([f.body.renown.character, f.body.renown.xp, f.body.renown.credited, f.body.renown.rose], [fresh.character, 0, 0, false], 'no room for a sixty-first track: no Renown');
  assert.equal(track(fresh.character), null);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE player = ?').get(mac.id).n, RENOWN_TRACKS_MAX);
});

test('PROF1 service: a Court writ raced - one account fills it between another\'s read and its UPDATE; the UPDATE refuses the second, who keeps its Stores', async () => {
  const s = await stand();
  await witnessed(s);
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  const w = (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body.writs[0];
  s.give(mac, w.material, 'own', w.qty);
  s.give(ann, w.material, 'own', w.qty);
  // Ann's read of the writ answers the open row it saw - but only after Mac's delivery has landed (a D1 race, staged)
  const prepare = s.env.DB.prepare;
  let between = null, macs = null;
  s.env.DB.prepare = (sql) => {
    const st = prepare(sql);
    if (between && sql === 'SELECT * FROM writs WHERE id = ?') {
      const go = between; between = null;
      const first = st.first;
      st.first = async () => { const row = await first(); await go(); return row; };
    }
    return st;
  };
  between = async () => { macs = await s.call('/v1/writs/deliver', { character: mac.character, id: w.id, rid: rid() }, mac.secret); };
  const anns = await s.call('/v1/writs/deliver', { character: ann.character, id: w.id, rid: rid() }, ann.secret);
  s.env.DB.prepare = prepare;
  assert.equal(macs?.status, 200, 'the first delivered');
  assert.deepEqual([anns.status, anns.body], [409, { error: 'writ-taken' }], 'the second, past its read, refused by the UPDATE');
  assert.equal(s.raw.prepare('SELECT filled_by FROM writs WHERE id = ?').get(w.id).filled_by, mac.id, 'the first stands');
  assert.deepEqual(s.stores(ann, w.material), [['own', w.qty]], 'the loser\'s units stay');
  assert.deepEqual(s.stores(mac, w.material), [], 'the winner\'s spent');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'writ'").get().n, 1, 'paid once');
  assert.equal(s.xpOf(ann), 0, 'no XP to the loser');
});

test('PROF1 service: a writ refused - short Stores, no such writ, the Marks shut, yesterday\'s', async () => {
  const s = await stand();
  await witnessed(s);
  const mac = await s.registered('Mac');
  const l = (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body;
  const w = l.writs[0];
  s.give(mac, w.material, 'own', w.qty - 1);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: mac.character, id: w.id, rid: rid() }, mac.secret)).body, { error: 'stores-short' });
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: mac.character, id: 'c:1:1:9', rid: rid() }, mac.secret)).body, { error: 'no-writ' });
  const shut = await stand({ MARKS_OPEN: 'off' });
  const m2 = await shut.registered('Mac');
  assert.deepEqual((await shut.call('/v1/writs/deliver', { character: m2.character, id: w.id, rid: rid() }, m2.secret)).body, { error: 'marks-closed' });
  clock(NOON + DAY);
  s.give(mac, w.material, 'own', w.qty);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: mac.character, id: w.id, rid: rid() }, mac.secret)).body, { error: 'writ-expired' });
  clock(NOON);
});

// ─── A SPECIALISATION ────────────────────────────────────────────────

test('PROF1 service: a specialisation - at 50, free the first time; a change burns 1,000 Marks and waits a week, the old one standing; one change at a time', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const spec = (id, extra = {}) => s.call('/v1/prof/spec', { character: mac.character, profession: 'herbalism', rank: 50, spec: id, rid: rid(), ...extra }, mac.secret);
  assert.deepEqual((await spec('gardener')).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(50));
  assert.equal(rankOfXp(xpForRank(50)), 50);
  assert.deepEqual((await spec('lumberjack')).body, { error: 'prof-spec' }, 'Logging\'s, not Herbalism\'s');
  const first = await spec('gardener');
  assert.deepEqual(first.body.track.specs, { 50: 'gardener', 100: null });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'respec'").get().n, 0, 'the first is free');
  assert.deepEqual((await spec('botanist')).body, { error: 'prof-spec-stale' }, 'AUDIT 29 A15: a change asked as if the rank were free');
  assert.deepEqual((await spec('botanist', { from: 'gardener' })).body, { error: 'marks-short' });
  s.seedMarks(mac, 1500);
  const change = await spec('botanist', { from: 'gardener' });
  assert.equal(change.body.balance, 500);
  assert.deepEqual(change.body.track.specs, { 50: 'gardener', 100: null }, 'the old one stands the week');
  assert.deepEqual(change.body.track.respec, { rank: 50, to: 'botanist', at: _now + RESPEC.days * DAY });
  assert.deepEqual((await spec('gardener', { from: 'gardener' })).body, { error: 'prof-respec-pending' });
  clock(NOON + RESPEC.days * DAY);
  const st = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body.tracks.find((t) => t.profession === 'herbalism');
  assert.deepEqual([st.specs, st.respec], [{ 50: 'botanist', 100: null }, null]);
  clock(NOON);
});
