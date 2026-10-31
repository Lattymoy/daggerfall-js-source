// AUDIT-STOREFRONT III (lanes A and B, 2026-10-30; bible/01-Overview/audits/Audit-Storefront.md): THE LAWS. The daily
// wares on a short sale - the deployed schedule drops titles late and three effects first - and the gate that keeps a
// second season out until the Folios can show more than one.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AURUM_DAILY, AURUM_DAILY_FROM, aurumDailyById, aurumDailyOf } from '../../src/net/aurumLaw.js';
import { PASS_SEASONS, PASS_PANELS, PASS_PREMIUM_AURUM } from '../../src/net/battlePassLaw.js';
import { PASS_SEASON_TEXT, PASS_SEASON_LOOK, PASS_FOLIO_TEXT } from '../../src/ui/passText.js';
import { PASS_FOLIO_EMBLEM } from '../../src/ui/enhanced/enhancedPass.js';

const slotOf = (id) => aurumDailyById(id).slot;
const THREE = ['kill:ashen', 'kill:voidrend', 'kill:pyre'];
/** The deployed schedule's first weeks: three kill effects, no title yet, every icon (Aurum's own). */
const shortSale = (id) => THREE.includes(id) || slotOf(id) === 'icon';

test('AUDIT-STOREFRONT III A2: a short sale still shows five a day - a slot with no ware hands its count on, here to a third icon (mutants: the short count dropped)', () => {
  for (let d = AURUM_DAILY_FROM + 29; d < AURUM_DAILY_FROM + 60; d++) {
    const picks = aurumDailyOf(d, shortSale);
    assert.equal(picks.length, 5, `day ${d}`);
    assert.deepEqual(picks.map(slotOf), ['effect', 'effect', 'icon', 'icon', 'icon'], `day ${d}: the slots in order`);
    assert.equal(new Set(picks).size, 5);
  }
});

test('AUDIT-STOREFRONT III A2: three effects for two places take turns - each shows two days and rests one, never three running, none favoured by its id (mutants: a tie by the id; the run not kept)', () => {
  const shown = new Map(THREE.map((id) => [id, 0])), run = new Map();
  let prev = [];
  for (let d = AURUM_DAILY_FROM + 29; d < AURUM_DAILY_FROM + 89; d++) {
    const fx = aurumDailyOf(d, shortSale).filter((id) => slotOf(id) === 'effect');
    for (const id of THREE) {
      run.set(id, fx.includes(id) ? (prev.includes(id) ? run.get(id) + 1 : 1) : 0);
      assert.ok(run.get(id) <= 2, `day ${d}: ${id} ${run.get(id)} days running`);
    }
    for (const id of fx) shown.set(id, shown.get(id) + 1);
    prev = fx;
  }
  const counts = [...shown.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `each shown alike: ${JSON.stringify([...shown])}`);
});

test('AUDIT-STOREFRONT III A2: with every ware on sale the rotation is as it was - every ware comes round, none two days running (the record\'s year)', () => {
  const all = () => true;
  let prev = [];
  const seen = new Set();
  for (let d = AURUM_DAILY_FROM; d < AURUM_DAILY_FROM + 120; d++) {
    const picks = aurumDailyOf(d, all);
    for (const id of picks) assert.ok(!prev.includes(id), `day ${d}: ${id} two days running`);
    for (const id of picks) seen.add(id);
    prev = picks;
  }
  assert.equal(seen.size, AURUM_DAILY.length);
});

test('AUDIT-STOREFRONT III B1, B2: THE SECOND-SEASON GATE - one season, and every per-season table keyed by exactly the seasons there are', () => {
  // B1: the card (server-account/src/battlePass.js passOf) and the window (src/ui/enhanced/enhancedPass.js) hold ONE season,
  // the one shown. A season's folios never expire, so once s2 is shown, s1's would leave the only window that sells them.
  // Before a second season joins PASS_SEASONS: the card carries every season whose tracks are open (its bought items and
  // its premium track each), the window draws a season's covers each, and PASS_CHALLENGES is keyed by season (B2) - then
  // this gate is lifted.
  assert.equal(PASS_SEASONS.length, 1, 'a second season needs the Folios to show every open season first (AUDIT-STOREFRONT III B1)');
  const ids = PASS_SEASONS.map((s) => s.id).sort();
  for (const [name, table] of Object.entries({ PASS_PANELS, PASS_PREMIUM_AURUM, PASS_SEASON_TEXT, PASS_SEASON_LOOK, PASS_FOLIO_TEXT, PASS_FOLIO_EMBLEM })) {
    assert.deepEqual(Object.keys(table).sort(), ids, `${name}: a row a season, no more`);
  }
});
