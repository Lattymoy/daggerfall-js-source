// AUDIT 32 (2026-09-30, Mac: "Audit this") - PROF7 AS THE SERVICE KEEPS IT, AUDITED: Hunting's day counts HIDES - a
// clean pelt's second among them - and the last skinning of the rare hides is cut to their room (L2; CAP-OFF: the day's
// thirty of any tier, whose room the last skinning was cut to as well, are gone - the pin turned to say so);
// a body's ground is never read nor witnessed, so a hand-built one is no 500 (S2); a second find is kept where one of it
// fits, its count cut to its room - a Butcher's two at 4,999 Raw Meat were both lost (S3); a body's foe is refused before
// the hour's acts are spent (S4); a weave answers no track, where it answered Smithing's (S5); the Weavers' cloth alone
// lays on no first-craft XP (S1, Mac: "Whatever you think is best"). Driven through the real
// Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Online-Arc.md "AUDIT 32"; bible/06-Systems/Professions-Arc.md 29.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { bodyKey } from '../src/net/nodeLaw.js';
import { xpForRank, HIGH_HIDES_PER_DAY, STORES_MAX } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const MOB = { Rat: 0, GrizzlyBear: 4, Harpy: 13, Orc: 7 };
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(NOON);
let _rid = 0;
const rid = () => `a32s-${String(++_rid).padStart(6, '0')}`;
const today = () => utcDay(_now);
let _body = 0;
const bodyOf = () => bodyKey({ day: today(), id: (++_body).toString(16).padStart(12, '0') });
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw all `b` while `fn` runs; ids and nonces stay the CSPRNG's. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  /** `n` skinnings already taken today on the account's other character, each `qty` hides at `tier`. */
  const hunted = (who, n, qty = 1, tier = 1) => {
    const ins = raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty)
      VALUES (?, ?, 'hide', ?, 'char-alt', 'hunting', 'hide:rat', ?, 0, NULL, ?, ?, 'n', 0, NULL, ?, 1)`);
    for (let i = 0; i < n; i++) ins.run(today(), bodyOf(), who.id, qty, _now, `seed-${String(++_rid).padStart(6, '0')}`, tier);
  };
  const rate = (who) => Number(raw.prepare('SELECT count FROM rate_limits WHERE key = ?').get(`prof:${who.id}`)?.count ?? 0);
  return { ...s, raw, stores, give, setXp, hunted, rate };
}
const skin = (who, foe, extra = {}) => ({
  character: who.character, node: bodyOf(), kind: 'hide', foe, act: { clean: false, torn: false }, at: _now - 2, rid: rid(), ...extra,
});

// ─── L2: HUNTING'S DAY IS HIDES ──────────────────────────────────────

test('AUDIT 32 L2: Hunting\'s day counts hides, a clean pelt\'s second among them - the rare hides\' last skinning cut to their room; the state and the answer say hides. CAP-OFF: no day\'s room for the rest - a clean pelt past the old thirty whole, a sixteenth body of two credited', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'hunting');
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): 29 hides taken, a clean pelt that rolled its
  // second was cut to the one the day had room for, and the next refused (`prof-hunt-cap`). No room is the day's now
  s.hunted(mac, 29);
  const last = await steered(0, () => s.call('/v1/prof/harvest', skin(mac, MOB.Rat, { act: { clean: true } }), mac.secret));
  assert.equal(last.status, 200, JSON.stringify(last.body));
  assert.deepEqual([last.body.qty, last.body.hunt], [2, { hides: 31, high: 0 }], 'the clean pelt whole - the thirtieth hide and the thirty-first');
  const next = await s.call('/v1/prof/harvest', skin(mac, MOB.Rat), mac.secret);
  assert.deepEqual([next.status, next.body.hunt.hides], [200, 32], JSON.stringify(next.body));

  // fifteen clean pelts of two were the day's thirty, a sixteenth body refused: now credited, the day counted in hides
  const ann = await s.registered('Ann');
  s.setXp(ann, xpForRank(100), 'hunting');
  s.hunted(ann, 15, 2);
  const sixteenth = await s.call('/v1/prof/harvest', skin(ann, MOB.Rat), ann.secret);
  assert.deepEqual([sixteenth.status, sixteenth.body.hunt], [200, { hides: 31, high: 0 }], 'fifteen bodies of two and one more: thirty-one hides');
  const st = (await s.call('/v1/prof/state', { character: ann.character }, ann.secret)).body;
  assert.deepEqual(st.hunt, { hides: 31, high: 0 });

  // the rare hides: two taken, a clean Harpy's second cut to the third
  const bo = await s.registered('Cyrus');
  s.setXp(bo, xpForRank(100), 'hunting');
  s.hunted(bo, 1, 2, 5);
  const harpy = await steered(0, () => s.call('/v1/prof/harvest', skin(bo, MOB.Harpy, { act: { clean: true } }), bo.secret));
  assert.deepEqual([harpy.status, harpy.body.qty, harpy.body.hunt], [200, 1, { hides: HIGH_HIDES_PER_DAY, high: HIGH_HIDES_PER_DAY }]);
  assert.deepEqual((await s.call('/v1/prof/harvest', skin(bo, MOB.Harpy), bo.secret)).body, { error: 'prof-hunt-high' });
  const rat = await s.call('/v1/prof/harvest', skin(bo, MOB.Rat), bo.secret);
  assert.deepEqual([rat.status, rat.body.hunt], [200, { hides: HIGH_HIDES_PER_DAY + 1, high: HIGH_HIDES_PER_DAY }], 'a low hide still');
});

// ─── S2: A BODY NAMES NO GROUND ──────────────────────────────────────

test('AUDIT 32 S2: a body\'s ground is never read nor witnessed - a hand-built climate or region is no 500', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'hunting');
  for (const ground of [{ region: {} }, { region: [17] }, { climate: { toString: 1 } }, { region: { toString: 1 } }, { climate: 231, region: 17 }]) {
    const r = await s.call('/v1/prof/harvest', skin(mac, MOB.Rat, ground), mac.secret);
    assert.deepEqual([r.status, r.body.material], [200, 'hide:rat'], JSON.stringify(ground));
  }
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM world_witness').get().n, 0, 'a body writes no witness');
});

// ─── S3: A SECOND FIND WHERE ONE OF IT FITS ──────────────────────────

test('AUDIT 32 S3: a Butcher\'s butchery at 4,999 Raw Meat keeps the one that fits; the row\'s count is what went in, and 1 where none did', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'hunting', { spec100: 'butcher' });
  s.give(mac, 'food:meat', 'own', STORES_MAX - 1);
  const r = await s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear), mac.secret);
  assert.deepEqual([r.status, r.body.extra, r.body.extraQty, s.stores(mac, 'food:meat')], [200, 'food:meat', 1, [['own', STORES_MAX]]]);
  const full = await s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear), mac.secret);
  assert.deepEqual([full.status, full.body.extra ?? null, s.stores(mac, 'food:meat')], [200, null, [['own', STORES_MAX]]], 'the Stores full: none');
  assert.deepEqual(s.raw.prepare('SELECT extra, extra_qty FROM node_harvests WHERE player = ? ORDER BY at, rowid').all(mac.id).map((x) => [x.extra, Number(x.extra_qty)]),
    [['food:meat', 1], [null, 1]]);
});

// ─── S4: THE FOE BEFORE THE HOUR ─────────────────────────────────────

test('AUDIT 32 S4: a foe no knife skins is refused before the hour\'s acts are spent, as a craft\'s dye is', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'hunting');
  for (const foe of [MOB.Orc, '4', 4.5, -1, 1e20, null, true, [4], {}]) {
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, foe), mac.secret)).body, { error: 'prof-foe' }, JSON.stringify(foe));
  }
  assert.equal(s.rate(mac), 0, 'no act of the hour spent');
  assert.equal((await s.call('/v1/prof/harvest', skin(mac, MOB.Rat), mac.secret)).status, 200);
  assert.equal(s.rate(mac), 1);
});

// ─── S5: A WEAVE'S TRACK ─────────────────────────────────────────────

test('AUDIT 32 S5: a weave answers no track (no XP, no raising choice) - never Smithing\'s; a cure answers Hunting\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'hide:spider', 'own', 3);
  s.give(mac, 'hide:rat', 'own', 2);
  const weave = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'weave:silk', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual([weave.status, weave.body.track], [200, null]);
  const cure = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'cure:rat', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual([cure.status, cure.body.track?.profession], [200, 'hunting']);
});

// ─── S1: THE COUNTER'S CLOTH TEACHES NO FIRST CRAFT ──────────────────

test('AUDIT 32 S1 (Mac: "Whatever you think is best"): a Linen garment, a Wool rug and the Fishing-Net - wholly the Weavers\' cloth - answer their craft\'s XP and no first-craft bonus, the first recorded; a boot\'s Cured Leather keeps the 500; the recipe decides, not the units\' origin', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const xp = () => Number(s.raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(mac.id, mac.character, 'outfitting')?.xp ?? 0);
  const craft = (recipe) => s.call('/v1/prof/craft', { character: mac.character, recipe, clean: false, name: 'Mac', rid: rid() }, mac.secret);
  s.give(mac, 'cloth:linen', 'bought', 10);
  s.give(mac, 'cloth:linen', 'own', 10);   // no hand gathers it; were one to, the recipe is still the counter's
  s.give(mac, 'leather:cured', 'own', 5);
  const straps = await craft('garment-141:linen');
  assert.equal(straps.status, 200, JSON.stringify(straps.body));
  assert.deepEqual([straps.body.xp, straps.body.first, xp()], [20, true, 20], 'the craft\'s 20, its first recorded - no 500');
  assert.equal(Number(s.raw.prepare('SELECT first FROM prof_crafts WHERE player = ? AND recipe = ?').get(mac.id, 'garment-141:linen').first), 1);
  const net = await craft('fishingnet:linen');
  assert.deepEqual([net.status, net.body.xp, net.body.first], [200, 20, true]);
  const boots = await craft('garment-149:linen');
  assert.deepEqual([boots.status, boots.body.xp, boots.body.first, xp()], [200, 20 + 500, true, 560], 'a bolt and a Cured Leather: the 500 laid on');
  const again = await craft('garment-149:linen');
  assert.deepEqual([again.body.xp, again.body.first], [20, false], 'and once');
  s.setXp(mac, xpForRank(10), 'outfitting');
  s.give(mac, 'cloth:wool', 'bought', 3);
  const rug = await craft('rug-237:wool');
  assert.deepEqual([rug.status, rug.body.xp, rug.body.first, xp()], [200, 40, true, xpForRank(10) + 40], 'Wool at tier 2: 40, no 500');
});
