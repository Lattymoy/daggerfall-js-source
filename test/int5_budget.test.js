// INT5 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "Measure 7 days, then enforce"): THE
// WEALTH BUDGET - a gain no witness explains, against a bucket the time played fills.
// PIN MOVED (its audit, the same day): the first judgement CHARGES what a save adds to the realm's baseline (its stored
// record at the cutover, a newborn's purse, customs' allowance) - it was the baseline itself, and any save could be;
// a win's spoils past the cap are never clamped away; the bucket keeps no debt while it only measures; a crafted or
// market-bought piece's arrival is witnessed once; the level the budget reads is the one the realm trusts; a change of
// the measure is no gain.
//   - budget.js and verdict.js pure: the bucket's step; the trusted level;
//   - the service: MEASURE first - a gain past the bucket a `measure` finding, nothing held, the hour kept; enforce - held
//     until play refills it, a signed win's spoils filling it at the trusted level; the cutover's baseline; the level
//     a save claims past its play; the measure's version moved; a craft's arrival; the measure's report, by band.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server-account/src/index.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, freshSave, layRecord } from './realmSeat.mjs';
import { stepBudget, budgetConfigOf, bandOf, BUDGET_DEFAULT, spoilsGrant, grantSpoils } from '../server-account/src/budget.js';
import { trustedLevel, LEVEL_RISE_S } from '../server-account/src/verdict.js';
import { WEALTH_VERSION } from '../server-account/src/judge.js';
import { MEASURE_PLAYED_MIN } from '../server-account/src/review.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { seeded } from './honestItems.mjs';
import { REALM_BIRTH_WEALTH_MAX } from '../src/net/realmGoldLaw.js';

test('INT5: the bucket - the first judgement full, and the save\'s gain on its baseline charged; filled by play at the band\'s rate to its cap, never cut down to it (a win\'s spoils); spent by a gain, never by a fall; while measuring, no debt kept', () => {
  const band = { rate: 3_600, cap: 10_000 };
  assert.deepEqual(stepBudget({ allowance: null, played: 0, gain: 999_999, band }), { allowance: 10_000 - 999_999, over: 989_999 }, 'the first judgement charges what the save adds');
  assert.deepEqual(stepBudget({ allowance: null, played: 0, gain: -5, band }), { allowance: 10_000, over: 0 });
  assert.deepEqual(stepBudget({ allowance: 0, played: 3_600, gain: 0, band }), { allowance: 3_600, over: 0 }, 'an hour of play fills an hour\'s rate');
  assert.deepEqual(stepBudget({ allowance: 9_000, played: 3_600, gain: 0, band }), { allowance: 10_000, over: 0 }, 'to the cap');
  assert.deepEqual(stepBudget({ allowance: 70_000, played: 3_600, gain: 50_000, band }), { allowance: 20_000, over: 0 }, 'a grant past the cap kept (AUDIT INT: clamped to the cap before the gain was charged)');
  assert.deepEqual(stepBudget({ allowance: 5_000, played: 0, gain: -40_000, band }), { allowance: 5_000, over: 0 }, 'spending refills nothing');
  assert.deepEqual(stepBudget({ allowance: 5_000, played: 0, gain: 8_000, band }), { allowance: -3_000, over: 3_000 });
  assert.deepEqual(stepBudget({ allowance: -3_000, played: 3_600, gain: 0, band }), { allowance: 600, over: 0 }, 'play pays an overrun back');
  assert.deepEqual(stepBudget({ allowance: 5_000, played: 0, gain: 8_000, band, enforce: false }), { allowance: 0, over: 3_000 }, 'measuring: the over found, no debt kept (AUDIT INT: a week\'s debt held everyone the day enforce came on)');
  assert.equal(bandOf(BUDGET_DEFAULT, 1).upTo, 5);
  assert.equal(bandOf(BUDGET_DEFAULT, 5000), BUDGET_DEFAULT.bands.at(-1));
  assert.equal(BUDGET_DEFAULT.enforce, false, 'MEASURE first');
  assert.deepEqual(budgetConfigOf({ enforce: true, bands: [{ upTo: 10, rate: 1, cap: 2 }] }), { enforce: true, bands: [{ upTo: 10, rate: 1, cap: 2 }] });
  for (const bad of [null, { enforce: 'yes', bands: [] }, { enforce: true, bands: [] }, { enforce: true, bands: [{ upTo: 10, rate: -1, cap: 2 }] }, { enforce: true, bands: [{ upTo: 10, rate: 1, cap: 2 }, { upTo: 5, rate: 1, cap: 2 }] }]) {
    assert.equal(budgetConfigOf(bad), null, JSON.stringify(bad));
  }
  assert.equal(spoilsGrant(10), 80_000);
});

test('INT5: the level the realm trusts - the save\'s, never past one a LEVEL_RISE_S played since it last rose (AUDIT INT: level 1000 in one save, and a win paid two million); a fall at once', () => {
  assert.deepEqual(trustedLevel({ seen: 5, at: 1_000, level: 1000, played: 1_000 + 2 * LEVEL_RISE_S + 7 }), { level: 7, at: 1_000 + 2 * LEVEL_RISE_S });
  assert.deepEqual(trustedLevel({ seen: 5, at: 1_000, level: 6, played: 1_000 + 9 * LEVEL_RISE_S }), { level: 6, at: 1_000 + LEVEL_RISE_S }, 'what it claims, when play reaches it');
  assert.deepEqual(trustedLevel({ seen: 5, at: 1_000, level: 5, played: 99_999 }), { level: 5, at: 1_000 });
  assert.deepEqual(trustedLevel({ seen: 5, at: 1_000, level: 3, played: 99_999 }), { level: 3, at: 1_000 }, 'never more than the save says');
  assert.deepEqual(trustedLevel({ seen: null, at: null, level: 12, played: 500 }), { level: 12, at: 500 }, 'the baseline\'s');
  assert.deepEqual(trustedLevel({ seen: 5, at: 1_000, level: 'x', played: 2_000 }), { level: 5, at: 1_000 });
});

async function stand() {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const who = await s.registered('eve');
  const R = await seatRealm(s.env, who.secret, 'eve');
  const putSave = async (save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200);
    return (await res.json()).tradeHeld;
  };
  const put = (goldPieces, extra = {}) => putSave(freshSave({ name: 'eve', goldPieces, ...extra }));
  /** Seconds played, as the service credits them (accounts.js creditPlay's column), and the clock on. */
  const play = (seconds) => { raw.prepare('UPDATE players SET played_s = played_s + ? WHERE id = ?').run(seconds, who.id); now += seconds; };
  const row = () => ({ ...raw.prepare('SELECT wealth, allowance, held, level_seen FROM realm_characters WHERE id = ?').get(R.id) });
  const kinds = () => raw.prepare('SELECT kind FROM realm_findings WHERE char_id = ? ORDER BY id').all(R.id).map((r) => r.kind);
  const lastDetail = () => JSON.parse(raw.prepare('SELECT detail FROM realm_findings WHERE char_id = ? ORDER BY id DESC LIMIT 1').get(R.id).detail);
  return { s, raw, who, R, put, putSave, play, row, kinds, lastDetail, done: () => { Date.now = realNow; } };
}

test('INT5 service: MEASURE - a newborn\'s baseline its purse, a gain inside the bucket charged, one past it a `measure` finding, nothing held and no debt kept; the hour\'s gain and play kept for the report', async () => {
  const t = await stand();
  try {
    const cap = BUDGET_DEFAULT.bands[0].cap;
    assert.deepEqual(t.row(), { wealth: 100, allowance: cap, held: null, level_seen: 1 }, 'the birth: a hundred gold under a newborn\'s purse - full');
    assert.ok(100 < REALM_BIRTH_WEALTH_MAX);
    t.play(1_800);
    assert.equal(await t.put(100 + 20_000), null);
    assert.equal(t.row().allowance, cap - 20_000, 'a half hour fills nothing past the cap; the gain spends it');
    t.play(60);
    assert.equal(await t.put(100 + 20_000 + cap), null, 'past the bucket - MEASURE holds nothing');
    assert.deepEqual(t.kinds(), ['measure']);
    assert.equal(t.row().allowance, 0, 'and keeps no debt');
    const hours = t.raw.prepare('SELECT gain, loss, played_s FROM realm_wealth_hours WHERE char_id = ?').all(t.R.id).map((r) => ({ ...r }));
    assert.equal(hours.reduce((n, h) => n + h.gain, 0), 20_000 + cap);
    assert.equal(hours.reduce((n, h) => n + h.played_s, 0), 1_860);
    // the report, by band - the developer's, asked of the database a quantile at a time
    const mac = await t.s.registered('mac');
    t.play(MEASURE_PLAYED_MIN);
    await t.put(100 + 20_000 + cap);
    const rep = (await t.s.call('/v1/mod/realm-budget', { days: 7 }, mac.secret)).body;
    assert.equal(rep.isDefault, true);
    assert.equal(rep.bands[0].hours >= 1, true, 'an hour played enough to say a rate');
    assert.equal(rep.bands[0].overs, 1, 'who the line standing would have held');
    assert.equal(rep.bands[0].quantiles.length, 4);
  } finally { t.done(); }
});

test('INT5 service: enforce on (staff) - a gain past the bucket holds the trade (\'budget\') until play refills it; a signed win\'s spoils fill it at the TRUSTED level, past the cap', async () => {
  const t = await stand();
  try {
    const mac = await t.s.registered('mac');
    const config = { enforce: true, bands: [{ upTo: 1000, rate: 36_000, cap: 50_000 }] };
    assert.equal((await t.s.call('/v1/mod/realm-budget', { set: config }, mac.secret)).status, 200);
    assert.equal((await t.s.call('/v1/mod/realm-budget', { set: { enforce: 'no' } }, mac.secret)).status, 400);
    const rando = await t.s.registered('rando');
    assert.equal((await t.s.call('/v1/mod/realm-budget', { set: config }, rando.secret)).status, 403, 'a developer\'s alone');
    // a bucket above a cap staff lowered is spent down, never cut (a win's spoils above it are kept the same way); staff's
    // clear fills it to the line standing
    assert.equal((await t.s.call('/v1/mod/realm-clear', { id: t.R.id }, mac.secret)).status, 200);
    assert.equal(await t.put(100), null);
    assert.equal(t.row().allowance, 50_000);
    assert.equal(await t.put(100 + 80_000), 'budget', '30,000 past the bucket');
    assert.deepEqual(t.kinds(), ['staff', 'budget'], 'the clear staff made, then the gain');
    assert.equal(await t.put(100 + 80_000), 'budget', 'standing still in its debt: held still');
    assert.deepEqual(t.kinds(), ['staff', 'budget'], 'and nothing new found - the hold stands until it is paid');
    t.play(3_600);
    assert.equal(await t.put(100 + 80_000), null, 'an hour of play pays it back');
    // the save claims level 1000; the realm trusts what its play reached - and a win's grant reads that one
    t.play(LEVEL_RISE_S * 2);
    await t.put(100 + 80_000, { level: 1000 });
    assert.equal(t.row().level_seen, 1 + Math.floor((3_600 + LEVEL_RISE_S * 2) / LEVEL_RISE_S), 'the level its play reached');
    const before = t.row().allowance;
    await grantSpoils(t.s.env.DB, t.who.id);
    assert.equal(t.row().allowance, before + spoilsGrant(t.row().level_seen), 'the trusted level\'s grant, never 1000\'s');
    assert.ok(t.row().allowance > 50_000, 'past the cap, kept');
    assert.equal(await t.put(100 + 80_000, { level: 1000 }), null);
    assert.ok(t.row().allowance > 50_000, 'the next step never cuts it to the cap');
    // a win's spoils landing between a checkpoint's read and its write are kept (AUDIT INT: the verdict wrote its own
    // number over them)
    const batch = t.s.env.DB.batch.bind(t.s.env.DB);
    let once = true;
    t.s.env.DB.batch = async (stmts) => { if (once) { once = false; await grantSpoils(t.s.env.DB, t.who.id); } return batch(stmts); };
    const was = t.row().allowance;
    await t.put(100 + 80_000, { level: 1000 });
    t.s.env.DB.batch = batch;
    assert.equal(t.row().allowance, was + spoilsGrant(t.row().level_seen), 'the grant, and the step\'s nothing');
  } finally { t.done(); }
});

test('INT5 service: THE CUTOVER\'S BASELINE is the record the realm already held - never the first judged save (AUDIT INT: it could hold anything) - and a save adding to it is charged', async () => {
  const t = await stand();
  try {
    const stored = freshSave({ name: 'eve', goldPieces: 1_000_000, level: 20 });
    layRecord(t.s.env, t.R.id, stored);
    // as INT2 found it: a row no judge has read
    t.raw.prepare('UPDATE realm_characters SET wealth = NULL, allowance = NULL, judged_seq = NULL, level_seen = NULL WHERE id = ?').run(t.R.id);
    assert.equal(await t.put(1_000_000, { level: 20 }), null);
    assert.deepEqual(t.kinds(), [], 'the save the realm held, taken in: nothing found');
    assert.equal(t.row().level_seen, 20);
    t.raw.prepare('UPDATE realm_characters SET wealth = NULL, allowance = NULL, judged_seq = NULL WHERE id = ?').run(t.R.id);
    const cap = bandOf(BUDGET_DEFAULT, 20).cap;
    assert.equal(await t.put(1_000_000 + cap + 5_000_000, { level: 20 }), null, 'measuring');
    assert.deepEqual(t.kinds(), ['measure', 'outlier'], 'five million the realm never held, charged - and the cutover\'s flag for staff');
    assert.equal(JSON.parse(t.raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'measure'").get(t.R.id).detail).first, true);
  } finally { t.done(); }
});

test('INT5 service: the MEASURE\'S VERSION moved - the stored record measured again, and the change is no gain (AUDIT INT: an open number moved was everyone\'s gain at once); a crafted piece\'s arrival WITNESSED, once', async () => {
  const t = await stand();
  try {
    assert.equal(await t.put(100), null);
    // the measure moved since the last judgement: the record as stored, measured now, is the base - a thousand richer
    // here (a deed priced again, say), and nothing charged for it
    layRecord(t.s.env, t.R.id, freshSave({ name: 'eve', goldPieces: 1_100_100 }));
    t.raw.prepare('UPDATE realm_characters SET wealth_v = ? WHERE id = ?').run(WEALTH_VERSION - 1, t.R.id);
    assert.equal(await t.put(1_100_100), null);
    assert.deepEqual(t.kinds(), []);
    assert.equal(t.raw.prepare('SELECT wealth_v FROM realm_characters WHERE id = ?').get(t.R.id).wealth_v, WEALTH_VERSION);
    // a crafted piece the service made for this account, come into the pack: witnessed, and never twice
    const p = 'feedfacefeedface';
    const sword = { ...createWeapon(113, 9, seeded(7)), material: 9, quality: 4, provenance: p, value: 300_000 };
    t.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, NULL, 'longsword:daedric', 113, 9, 4, 7, 'p1..', ?)`).run(p, t.who.id, t.R.id, T0);
    const before = t.row().allowance;
    assert.equal(await t.put(1_100_100, { items: [sword] }), null);
    assert.deepEqual(t.kinds(), [], 'the craft no find (AUDIT INT: charged as one)');
    assert.equal(t.row().allowance, before, 'and nothing spent');
    assert.equal(t.raw.prepare('SELECT credited FROM products WHERE provenance = ?').get(p).credited, 1);
    await t.put(1_100_100);
    const after = t.row().allowance;
    assert.equal(await t.put(1_100_100, { items: [sword] }), null, 'measuring');
    assert.ok(t.row().allowance < after, 'taken up again, the same piece is no new craft');
  } finally { t.done(); }
});
