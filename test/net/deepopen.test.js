// DEEP-OPEN (2026-10-25; bible/06-Systems/Professions-Arc.md section 53) - A DUNGEON'S DEEP VEINS ON ANYONE'S WORD. The
// report (SaberGGaming): no Dwarven Scrap anywhere. Probed: over 32,249 dungeon-days a dungeon nobody had witnessed drew
// Silver every time and Dwarven Scrap never - its veins were held to UNCONFIRMED_VEIN_TIER (3), and a dungeon is
// confirmed only once three week-old accounts have worked it, which almost never happens. The owner's choice: "FULL ORE
// TABLE" - such a dungeon draws over the deep veins' whole table (Silver, Gold, Dwarven Scrap, Platinum, Adamantium)
// under the account's four such veins a day (DEEP_UNCONFIRMED_PER_DAY), and the witnesses remain for the climate's claim
// alone: a woodland dungeon's Moonstone. The trade the owner accepted, named: a modified client that invents dungeon ids
// mines four full-table deep veins a day, and no more. The law, the service, the ore card and the Mining page's line.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import {
  DUNGEON_VEINS, NODE_TIER_WEIGHTS, UNCONFIRMED_VEIN_TIER, VEIN_TABLES, DUNGEON_GEM, dungeonVeins, dungeonVein, dungeonVeinTable,
  deepClimateOres, drawFromTable, veinGem, dveinKey,
} from '../../src/net/nodeLaw.js';
import { DEEP_UNCONFIRMED_PER_DAY, minedMaterial, xpForRank } from '../../src/net/professionLaw.js';
import { CLIMATES as C } from '../../src/formats/mapsTables.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { oreMapTip, oreWord } from '../../src/ui/oreMapTip.js';
import { MINING_GROUND_LINE } from '../../src/ui/professions/profPages.js';

const DAY0 = 20_300;
const tierOf = (k) => minedMaterial(k).tier;

test('DEEP-OPEN law, the probe: over 32,256 dungeon-days a dungeon nobody has witnessed draws the deep table\'s every ore, Dwarven Scrap among them, at its tiers\' weights - where the cap it was held to drew Silver and nothing else; never its climate\'s Moonstone (mutants: the cap back; the climate\'s table unwitnessed)', () => {
  // the report, reproduced on the law's own draw: held to tier 3, the table stands Silver whatever the dice say
  for (const u of [0, 0.25, 0.5, 0.75, 0.999]) for (const v of [0, 0.5, 0.999]) assert.equal(drawFromTable(DUNGEON_VEINS, u, v, UNCONFIRMED_VEIN_TIER).material, 'metal:silver');
  const seen = new Map(), tiers = new Map();
  let veins = 0;
  for (let id = 1; id <= 4032; id++) {
    for (let d = 0; d < 8; d++) {
      for (const v of dungeonVeins({ dungeon: id, day: DAY0 + d, climate: C.Woodlands, confirmed: false })) {
        seen.set(v.material, (seen.get(v.material) ?? 0) + 1);
        tiers.set(v.tier, (tiers.get(v.tier) ?? 0) + 1);
        veins++;
      }
    }
  }
  assert.deepEqual([...seen.keys()].sort(), [...DUNGEON_VEINS].sort(), 'every ore of the table, and no Moonstone');
  assert.ok(seen.get('ore:dwarven') / veins > 0.12, `Dwarven Scrap ${seen.get('ore:dwarven')} of ${veins}`);
  // the tiers at section 6's weights, renormalised over 3-6 (15 : 10 : 6 : 4), within a point
  const w = [3, 4, 5, 6].map((t) => NODE_TIER_WEIGHTS[t - 1]), all = w.reduce((a, b) => a + b, 0);
  for (const [i, t] of [3, 4, 5, 6].entries()) assert.ok(Math.abs(tiers.get(t) / veins - w[i] / all) < 0.01, `tier ${t}: ${tiers.get(t)} of ${veins}`);
  // tier 4's two, evenly
  assert.ok(Math.abs(seen.get('metal:gold') - seen.get('ore:dwarven')) / veins < 0.01);
});

test('DEEP-OPEN law: the witnesses keep the climate\'s claim alone - deepClimateOres is a woodland dungeon\'s Moonstone and nothing else; a confirmed woodland dungeon stands it, an unconfirmed one never; a dungeon of any other climate draws the same unconfirmed or not; its Diamond on anyone\'s word, no climate\'s claim (mutants: the climate ore for every climate; the dungeon\'s gem held back)', () => {
  const deep = Object.fromEntries(Object.keys(VEIN_TABLES).map((c) => [c, deepClimateOres(Number(c))]));
  for (const [c, ores] of Object.entries(deep)) assert.deepEqual(ores, [C.Woodlands, C.HauntedWoodlands].includes(Number(c)) ? ['ore:moonstone'] : [], `climate ${c}`);
  for (const c of [C.Woodlands, C.HauntedWoodlands]) assert.deepEqual(dungeonVeinTable(c), [...DUNGEON_VEINS, ...deepClimateOres(c)]);
  let moon = 0;
  for (let id = 1; id < 600; id++) {
    const conf = dungeonVeins({ dungeon: id, day: DAY0, climate: C.HauntedWoodlands, confirmed: true });
    const un = dungeonVeins({ dungeon: id, day: DAY0, climate: C.HauntedWoodlands, confirmed: false });
    moon += conf.filter((v) => v.material === 'ore:moonstone').length;
    assert.ok(un.every((v) => v.material !== 'ore:moonstone'), `dungeon ${id}: no Moonstone on anyone's word`);
    assert.deepEqual(un.map((v) => [v.slot, v.marker, v.bearing]), conf.map((v) => [v.slot, v.marker, v.bearing]), 'the same veins where they stand - only the ore of a claim the witnesses hold differs');
    assert.deepEqual(dungeonVeins({ dungeon: id, day: DAY0, climate: C.Desert, confirmed: false }), dungeonVeins({ dungeon: id, day: DAY0, climate: C.Desert, confirmed: true }));
  }
  assert.ok(moon > 0, 'witnessed, the woods\' Moonstone stands');
  const dice = (...u) => { let i = 0; return () => u[i++] ?? 0.99; };
  assert.equal(veinGem({ kind: 'dvein', climate: C.Desert, glints: 2, confirmed: false }, dice(0.01, 0.5)), DUNGEON_GEM, 'a dungeon\'s Diamond on anyone\'s word');
  assert.equal(veinGem({ kind: 'vein', climate: C.Mountain, glints: 2, confirmed: false }, dice(0, 0)), null, 'a surface vein\'s gem still waits on the witnesses');
  assert.equal(DEEP_UNCONFIRMED_PER_DAY, 4, 'the bound the owner accepted: four full-table deep veins a day on invented ids');
});

test('DEEP-OPEN the ore card and the Mining page: the card\'s Dungeons line is the table every dungeon draws, the climate\'s deep ore said waiting on its dungeon\'s witnesses - and over many days an unwitnessed dungeon\'s draws hold every ore the line names and never the one it holds back; the page\'s line says it (mutants: the line the climate\'s whole table; the deep word unsaid)', () => {
  for (const c of Object.keys(VEIN_TABLES).map(Number)) {
    for (const fact of [null, { state: 'none' }, { state: 'confirmed' }]) {
      const lines = oreMapTip({ climate: c, region: 19, fact }).lines;
      assert.equal(lines[1], `Dungeons: ${DUNGEON_VEINS.map(oreWord).join(', ')}`);
      const deep = deepClimateOres(c).map(oreWord);
      assert.equal(lines.some((l) => /in witnessed dungeons/.test(l)), deep.length > 0, `climate ${c}: the deep word iff a deep ore waits`);
      for (const ore of deep) assert.ok(lines.some((l) => new RegExp(`${ore} (only )?in witnessed dungeons`).test(l)), `climate ${c}: ${ore} said waiting`);
    }
    const drawn = new Set();
    for (let id = 1; id < 300; id++) for (let d = 0; d < 4; d++) for (const v of dungeonVeins({ dungeon: id, day: DAY0 + d, climate: c, confirmed: false })) drawn.add(v.material);
    assert.deepEqual([...drawn].map(oreWord).sort(), DUNGEON_VEINS.map(oreWord).sort(), `climate ${c}: the card promises what an unwitnessed dungeon gives`);
  }
  assert.match(MINING_GROUND_LINE, / Deep veins in dungeons can hold any of their ores, Dwarven Scrap and Adamantium among them, in any dungeon; only a woodland dungeon's Moonstone waits for three players to gather in it\. /);
  assert.doesNotMatch(MINING_GROUND_LINE, /Silver anywhere/);
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 13 * 3600;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `deep-${String(++_rid).padStart(6, '0')}`;
const REGION = 6;
async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const setXp = (who, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'mining', ?, NULL, NULL, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, xp, _now);
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  return { ...s, raw, setXp, age };
}
const deep = (who, dungeon, slot, climate, extra = {}) => ({ character: who.character, node: dveinKey({ dungeon, day: utcDay(_now), slot }), kind: 'ore', climate, region: REGION, act: { glints: 0 }, at: _now - 2, rid: rid(), ...extra });
/** The first `n` dungeon ids from `from` whose slot 0 today draws `pred` on anyone's word. */
const dungeonsWhere = (pred, n, climate, from = 50_000) => {
  const out = [];
  for (let id = from; out.length < n && id < from + 20_000; id++) if (pred(dungeonVein({ dungeon: id, day: utcDay(_now), slot: 0, climate }))) out.push(id);
  assert.equal(out.length, n);
  return out;
};

test('DEEP-OPEN service: an account works four veins a day in dungeons nobody has vouched for - each its whole table\'s draw, Dwarven Scrap and Adamantium among them, credited at its own tier - the fifth refused `prof-deep-cap`; a witnessed dungeon is counted against no such day (mutants: the cap gone; the cap counting a confirmed dungeon; the unconfirmed vein held to Silver)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.setXp(mac, xpForRank(100));
  const [dw1, dw2] = dungeonsWhere((v) => v?.material === 'ore:dwarven', 2, C.Mountain);
  const [ad] = dungeonsWhere((v) => v?.material === 'ore:adamantium', 1, C.Mountain, 60_000);
  const [pl] = dungeonsWhere((v) => v?.material === 'metal:platinum', 1, C.Mountain, 70_000);
  for (const id of [dw1, dw2, ad, pl]) {
    const r = await s.call('/v1/prof/harvest', deep(mac, id, 0, C.Mountain), mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const law = dungeonVein({ dungeon: id, day: utcDay(_now), slot: 0, climate: C.Mountain });
    assert.equal(r.body.material, law.material, `dungeon ${id}: the whole table's draw`);
    assert.ok(tierOf(r.body.material) > UNCONFIRMED_VEIN_TIER, 'past the cap it was held to');
  }
  const fifth = await s.call('/v1/prof/harvest', deep(mac, pl + 1, 0, C.Mountain), mac.secret);
  assert.deepEqual([fifth.status, fifth.body], [409, { error: 'prof-deep-cap' }]);
  // a dungeon three week-old accounts have worked is no invented id: its veins are no such day's
  const id = 90_123;
  for (const h of ['Wit1', 'Wit2', 'Wit3']) {
    const w = await s.seated(h);
    s.age(w, 8);
    s.setXp(w, xpForRank(100));
    const n = dungeonVeins({ dungeon: id, day: utcDay(_now), climate: C.Mountain, confirmed: false }).length;
    assert.equal((await s.call('/v1/prof/harvest', deep(w, id, n - 1, C.Mountain), w.secret)).status, 200);
  }
  const conf = await s.call('/v1/prof/harvest', deep(mac, id, 0, C.Mountain), mac.secret);
  assert.equal(conf.status, 200, `a confirmed dungeon past the four: ${JSON.stringify(conf.body)}`);
});

test('DEEP-OPEN service: the climate\'s claim still waits on the witnesses - an unvouched woodland dungeon whose witnessed draw is Moonstone gives its anyone\'s-word ore; once three week-old accounts have worked it as woodland, its Moonstone is mined; the claim of another climate there refused (mutants: the climate\'s table on anyone\'s word)', async () => {
  const s = await stand();
  const day = utcDay(_now);
  // a woodland dungeon whose slot 0, witnessed, is Moonstone
  let id = null;
  for (let d = 80_000; d < 100_000 && id === null; d++) if (dungeonVein({ dungeon: d, day, slot: 0, climate: C.Woodlands, confirmed: true })?.material === 'ore:moonstone') id = d;
  assert.ok(id !== null);
  const mac = await s.seated('Mac');
  s.setXp(mac, xpForRank(100));
  const un = await s.call('/v1/prof/harvest', deep(mac, id, 0, C.Woodlands), mac.secret);
  assert.equal(un.status, 200, JSON.stringify(un.body));
  assert.equal(un.body.material, dungeonVein({ dungeon: id, day, slot: 0, climate: C.Woodlands, confirmed: false }).material);
  assert.notEqual(un.body.material, 'ore:moonstone', 'the climate is the client\'s word until three agree');
  for (const h of ['Wit1', 'Wit2', 'Wit3']) {
    const w = await s.seated(h);
    s.age(w, 8);
    s.setXp(w, xpForRank(100));
    const n = dungeonVeins({ dungeon: id, day, climate: C.Woodlands, confirmed: false }).length;
    assert.equal((await s.call('/v1/prof/harvest', deep(w, id, n - 1, C.Woodlands), w.secret)).status, 200);
  }
  const sab = await s.seated('Sab');
  s.setXp(sab, xpForRank(100));
  const witnessed = await s.call('/v1/prof/harvest', deep(sab, id, 0, C.Woodlands), sab.secret);
  assert.equal(witnessed.status, 200, JSON.stringify(witnessed.body));
  assert.equal(witnessed.body.material, 'ore:moonstone', 'witnessed woodland: its Moonstone');
  const lie = await s.call('/v1/prof/harvest', deep(sab, id, 0, C.Desert, { rid: rid() }), sab.secret);
  assert.deepEqual(lie.body, { error: 'prof-pixel' }, 'a confirmed dungeon\'s climate is the witnesses\', not the claim\'s');
});
