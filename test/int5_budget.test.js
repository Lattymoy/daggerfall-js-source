// INT5 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "Measure 7 days, then enforce"): THE
// WEALTH BUDGET - a gain no witness explains, against a bucket the time played fills.
//   - budget.js pure: the bucket's first judgement full and nothing charged, filled by the seconds played at the level's
//     rate to its cap, spent by a gain, untouched by a fall; a staff config's shape;
//   - the service: MEASURE first - a gain past the bucket recorded as a `measure` finding and the hour's gain kept, and
//     nothing held; once staff set `enforce`, the same gain holds the trade ('budget') until play refills the bucket; a
//     signed win's spoils fill it (grantSpoils); the measure's report, by band.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server-account/src/index.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, freshSave } from './realmSeat.mjs';
import { stepBudget, budgetConfigOf, bandOf, BUDGET_DEFAULT, spoilsGrant, grantSpoils } from '../server-account/src/budget.js';
import { MEASURE_PLAYED_MIN } from '../server-account/src/review.js';

test('INT5: the bucket - the first judgement full and nothing charged; filled by play at the band\'s rate to its cap; spent by a gain, never by a fall; past it, the gold over', () => {
  const band = { rate: 3_600, cap: 10_000 };
  assert.deepEqual(stepBudget({ allowance: null, played: 0, gain: 999_999, band }), { allowance: 10_000, over: 0 }, 'the cutover baselines');
  assert.deepEqual(stepBudget({ allowance: 0, played: 3_600, gain: 0, band }), { allowance: 3_600, over: 0 }, 'an hour of play fills an hour\'s rate');
  assert.deepEqual(stepBudget({ allowance: 9_000, played: 3_600, gain: 0, band }), { allowance: 10_000, over: 0 }, 'to the cap');
  assert.deepEqual(stepBudget({ allowance: 5_000, played: 0, gain: -40_000, band }), { allowance: 5_000, over: 0 }, 'spending refills nothing');
  assert.deepEqual(stepBudget({ allowance: 5_000, played: 0, gain: 8_000, band }), { allowance: -3_000, over: 3_000 });
  assert.deepEqual(stepBudget({ allowance: -3_000, played: 3_600, gain: 0, band }), { allowance: 600, over: 0 }, 'play pays an overrun back');
  assert.equal(bandOf(BUDGET_DEFAULT, 1).upTo, 5);
  assert.equal(bandOf(BUDGET_DEFAULT, 5000), BUDGET_DEFAULT.bands.at(-1));
  assert.equal(BUDGET_DEFAULT.enforce, false, 'MEASURE first');
  assert.deepEqual(budgetConfigOf({ enforce: true, bands: [{ upTo: 10, rate: 1, cap: 2 }] }), { enforce: true, bands: [{ upTo: 10, rate: 1, cap: 2 }] });
  for (const bad of [null, { enforce: 'yes', bands: [] }, { enforce: true, bands: [] }, { enforce: true, bands: [{ upTo: 10, rate: -1, cap: 2 }] }, { enforce: true, bands: [{ upTo: 10, rate: 1, cap: 2 }, { upTo: 5, rate: 1, cap: 2 }] }]) {
    assert.equal(budgetConfigOf(bad), null, JSON.stringify(bad));
  }
  assert.equal(spoilsGrant(10), 80_000);
});

async function stand() {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const who = await s.registered('eve');
  const R = await seatRealm(s.env, who.secret, 'eve');
  const put = async (goldPieces) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify(freshSave({ name: 'eve', goldPieces })),
    }), s.env);
    return (await res.json()).tradeHeld;
  };
  /** Seconds played, as the service credits them (accounts.js creditPlay's column), and the clock on. */
  const play = (seconds) => { raw.prepare('UPDATE players SET played_s = played_s + ? WHERE id = ?').run(seconds, who.id); now += seconds; };
  const row = () => ({ ...raw.prepare('SELECT wealth, allowance, held FROM realm_characters WHERE id = ?').get(R.id) });
  const kinds = () => raw.prepare('SELECT kind FROM realm_findings WHERE char_id = ? ORDER BY id').all(R.id).map((r) => r.kind);
  return { s, raw, who, R, put, play, row, kinds, done: () => { Date.now = realNow; } };
}

test('INT5 service: MEASURE - the baseline full, a gain inside the bucket charged, one past it a `measure` finding and nothing held; the hour\'s gain and play kept for the report', async () => {
  const t = await stand();
  try {
    const cap = BUDGET_DEFAULT.bands[0].cap;
    assert.equal(await t.put(100), null);
    assert.deepEqual(t.row(), { wealth: 100, allowance: cap, held: null }, 'the first judgement since the seat\'s - full');
    t.play(1_800);
    assert.equal(await t.put(100 + 20_000), null);
    assert.equal(t.row().allowance, cap - 20_000, 'a half hour fills nothing past the cap; the gain spends it');
    t.play(60);
    assert.equal(await t.put(100 + 20_000 + cap), null, 'past the bucket - MEASURE holds nothing');
    assert.deepEqual(t.kinds(), ['measure']);
    const hours = t.raw.prepare('SELECT gain, loss, played_s, checkpoints FROM realm_wealth_hours WHERE char_id = ?').all(t.R.id).map((r) => ({ ...r }));
    assert.equal(hours.reduce((n, h) => n + h.gain, 0), 20_000 + cap);
    assert.equal(hours.reduce((n, h) => n + h.played_s, 0), 1_860);
    // the report, by band - the developer's
    const mac = await t.s.registered('mac');
    t.play(MEASURE_PLAYED_MIN);
    await t.put(100 + 20_000 + cap);
    const rep = (await t.s.call('/v1/mod/realm-budget', { days: 7 }, mac.secret)).body;
    assert.equal(rep.isDefault, true);
    assert.equal(rep.bands[0].hours >= 1, true, 'an hour played enough to say a rate');
    assert.equal(rep.bands[0].overs, 1, 'who the line standing would have held');
  } finally { t.done(); }
});

test('INT5 service: enforce on (staff) - a gain past the bucket holds the trade (\'budget\') until play refills it; a signed win\'s spoils fill it', async () => {
  const t = await stand();
  try {
    const mac = await t.s.registered('mac');
    const config = { enforce: true, bands: [{ upTo: 1000, rate: 36_000, cap: 50_000 }] };
    assert.equal((await t.s.call('/v1/mod/realm-budget', { set: config }, mac.secret)).status, 200);
    assert.equal((await t.s.call('/v1/mod/realm-budget', { set: { enforce: 'no' } }, mac.secret)).status, 400);
    assert.equal(await t.put(100), null);
    assert.equal(t.row().allowance, 50_000);
    assert.equal(await t.put(100 + 80_000), 'budget', '30,000 past the bucket');
    assert.deepEqual(t.kinds(), ['budget']);
    t.play(3_600);
    assert.equal(await t.put(100 + 80_000), null, 'an hour of play pays it back');
    // a recorded win's spoils
    const before = t.row().allowance;
    await grantSpoils(t.s.env.DB, t.who.id);
    assert.equal(t.row().allowance, Math.min(before + spoilsGrant(1)), 'the playing character\'s bucket, by its level');
  } finally { t.done(); }
});
