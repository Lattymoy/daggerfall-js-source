// FIELD BUGS 2026-10-09e - UNWITNESSED-ORE, the Discord's "Mining veins": "I mined about 200-300 veins of iron, but
// there were not a single vein of silver, gold, platinum or mithril in the mountains. There were only veins of iron and
// boulders... maybe Mountain area and MountainWoods area are bugged".
//
// They were the law, not a bug: a pixel no three witnesses have vouched for (net/nodeLaw.js witnessedFact) was held to
// tier 2, and the Mountain's table holds Iron at 1 and nothing again until Silver at 3 - so every mountain pixel nobody
// else had worked stood Iron alone, and the Mountain Woods never stood its Silver. A lone miner confirms nothing. A vein
// on such ground is held where a dungeon's deep vein already is - UNCONFIRMED_VEIN_TIER, 3 - and the Mining page says
// what still waits on the witnesses. `01-Overview/Field-Bugs-2026-10-09e.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from './accountDb.mjs';
import {
  UNCONFIRMED_VEIN_TIER, VEIN_TABLES, veins, dungeonVeins, herbPatches, trees, regionWritTable, nodeKey,
} from '../src/net/nodeLaw.js';
import { xpForRank } from '../src/net/professionLaw.js';
import { utcDay } from '../src/net/marksLaw.js';
import { CLIMATES as C } from '../src/formats/mapsTables.js';
import { SEASONS } from '../src/systems/gameDate.js';
import { MINING_GROUND_LINE } from '../src/ui/profPages.js';

const DAY = 20_300;
/** Every material a climate's veins stand over many days and pixels, by the witnesses' word. */
const stood = (climate, confirmed, region = 21) => {   // a March: no signature beside the climate's
  const out = new Set();
  for (let d = 0; d < 120; d++) for (let x = 300; x < 306; x++) for (const v of veins({ x, y: 150, day: DAY + d, climate, region, confirmed })) out.add(v.material);
  return [...out].sort();
};

test('UNWITNESSED-ORE law: a vein on ground nobody has vouched for is held to tier 3 - the Mountain stands Silver beside its Iron, the Mountain Woods its Silver beside its three; Gold, Platinum, Mithril and the signatures still wait on the witnesses', () => {
  assert.equal(UNCONFIRMED_VEIN_TIER, 3);
  assert.deepEqual(stood(C.Mountain, false), ['metal:iron', 'metal:silver'], 'the field\'s mountains: Iron alone before');
  assert.deepEqual(stood(C.MountainWoods, false), ['metal:copper', 'metal:iron', 'metal:lead', 'metal:silver']);
  assert.deepEqual(stood(C.Mountain, true), ['metal:gold', 'metal:iron', 'metal:platinum', 'metal:silver', 'ore:mithril'], 'the confirmed Mountain\'s whole table');
  // no other climate's ground moves: none holds a tier-3 metal
  for (const k of ['Woodlands', 'HauntedWoodlands', 'Swamp', 'Rainforest', 'Subtropical', 'Desert', 'Desert2']) {
    assert.deepEqual(stood(C[k], false), [...VEIN_TABLES[C[k]]].filter((m) => !/silver|gold|platinum|mithril|ebony/.test(m)).sort(), `${k} as it was`);
  }
  // a signature region (Wayrest's Mithril) takes no signature unconfirmed
  for (let d = 0; d < 40; d++) assert.ok(veins({ x: 400, y: 150, day: DAY + d, climate: C.Mountain, region: 23, confirmed: false }).every((v) => !v.signature && v.tier <= 3));
});

test('UNWITNESSED-ORE law: the one cap is the dungeon\'s too - an unconfirmed deep vein Silver, as it was; the herbs and the trees keep theirs (2); the Court asks what the ground stands', () => {
  for (let id = 1; id < 60; id++) for (const v of dungeonVeins({ dungeon: id, day: DAY, climate: C.Mountain, confirmed: false })) assert.deepEqual([v.tier, v.material], [3, 'metal:silver']);
  for (let d = 0; d < 60; d++) {
    for (const p of herbPatches({ x: 300, y: 150, day: DAY + d, climate: C.Mountain, confirmed: false })) assert.ok(p.tier <= 2, 'an herb on anyone\'s word, as it was');
    for (const t of trees({ x: 300, y: 150, day: DAY + d, climate: C.Rainforest, confirmed: false })) assert.ok(t.tier <= 2, 'a tree on anyone\'s word, as it was');
  }
  const un = regionWritTable(16, [{ climate: C.Mountain, confirmed: false }], SEASONS.Summer).map((m) => m.material);
  assert.ok(un.includes('metal:silver'), 'the Court may ask the Silver the vein stands');
  assert.ok(!un.includes('metal:gold') && !un.includes('ore:orichalcum'));
  const src = readFileSync(new URL('../src/net/nodeLaw.js', import.meta.url), 'utf8');
  assert.equal(src.match(/confirmed \? 7 : UNCONFIRMED_VEIN_TIER\)/g)?.length, 3, 'the vein, the deep vein and the Court read the one cap');
});

test('UNWITNESSED-ORE service: an unconfirmed Mountain pixel\'s Silver vein is mined - the law\'s Silver into the Stores at tier 3\'s XP, no gem, no signature - and its Gold is no vein there', async () => {
  const realNow = Date.now;
  const now = utcDay(T0) * 86_400 + 4 * 3600;
  Date.now = () => now * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
    const raw = s.env.DB._raw;
    const mac = await s.registered('Mac');
    raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'mining', ?, NULL, NULL, ?)`)
      .run(mac.id, mac.character, xpForRank(30), now);
    const day = utcDay(now);
    let found = null;
    for (let x = 300; x < 800 && !found; x++) {
      const v = veins({ x, y: 200, day, climate: C.Mountain, region: 16, confirmed: false }).find((n) => n.material === 'metal:silver');
      if (v) found = { x, ...v };
    }
    assert.ok(found, 'a Silver vein on an unconfirmed Mountain pixel');
    const body = {
      character: mac.character, node: nodeKey({ kind: 'vein', x: found.x, y: 200, day, slot: found.slot }), kind: 'ore',
      climate: C.Mountain, region: 16, act: { glints: 0, clean: false }, at: now - 2, rid: 'ore-000001',
    };
    const r = await s.call('/v1/prof/harvest', body, mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.material, 'metal:silver');
    assert.equal(r.body.xp, 45, 'tier 3\'s XP (15 x tier)');
    assert.equal(r.body.gem, undefined, 'no gem on ground nobody vouched for');
  } finally { Date.now = realNow; }
});

test('UNWITNESSED-ORE page: the Mining page says what the ground holds on anyone\'s word and what waits on three players', () => {
  assert.match(MINING_GROUND_LINE, /fewer than three players have gathered on holds Silver at most\. Gold, Platinum, Mithril and a region's own ore appear there once three different players/);
  const src = readFileSync(new URL('../src/ui/profPages.js', import.meta.url), 'utf8');
  assert.match(src, /if \(GATHER_HOW\[_sel\]\) pane\.append\(el\('p', 'px-note', GATHER_HOW\[_sel\]\)\);[^\n]*\n\s+if \(_sel === 'mining'\) pane\.append\(el\('p', 'px-note', MINING_GROUND_LINE\)\);/);
});
