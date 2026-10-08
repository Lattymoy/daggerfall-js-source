// WILD2 + WILD3 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md sections 2, 6, 9-11): THE ZONE'S FOUR RINGS and their
// loot, the zone map's ink, the fast journeys' law, the pace's cap, the giants and the strangers' names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WILD_REGION, WILD_RINGS, WILD_RING_LOOT, buildWildMask, wildRingAt, wildRingLoot, wildRingBonus, wildRingChains, wildRingAnchors,
  wildLootOpts, wildFoeLoot, wildPileMore, applyWildFoe, wildJourney, WILD_TRAVEL_FEE, WILD_TRAVEL_FEES, WILD_TRAVEL_COOLDOWN_MS, wildGiantSize,
  WILD_GIANT, WILD_GIANT_SIZE, setWildHere, wildRing, WILD_STRANGER_M, WILD_STRANGER_SLOW_M,
} from '../src/systems/wildZone.js';
import { plainFoeLootRule } from '../src/systems/foeLootCap.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { wildLootAfter } from '../src/scenes/hostCombat.js';
import { ringPixels, zoneMapView, zoneMapLimits, smoothChain, RING_INK } from '../src/ui/wildZoneMap.js';
import { scaleMinOf } from '../src/ui/inkMap.js';
import { setPaceZoneCap, paceRateOn, paceNow, paceCanRise, WILD_PACE_CAP, _resetTravelPace } from '../src/systems/travelPace.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';

/** A 60 x 40 map whose zone is the 40 x 30 box at (10..49, 5..34) - the whole region (`cut: null`; ZONE-CUT's pin is
 *  test/wild1_zone.test.js's). */
const mask = buildWildMask({ width: 60, height: 40, regionAt: (x, y) => (x >= 10 && x < 50 && y >= 5 && y < 35 ? WILD_REGION : 0), cut: null });
const W = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('WILD2: four rings by depth - the outer quarter at the edge, the heart in the middle, never lighter going in; +25% to +100%', () => {
  assert.deepEqual([...WILD_RING_LOOT], [1.25, 1.5, 1.75, 2], '"25% more ... 50% ... 75 ... 100% more loot"');
  assert.equal(wildRingBonus(1), '+25% loot'); assert.equal(wildRingBonus(4), '+100% loot');
  assert.equal(wildRingAt(10, 20, mask), 1, 'the edge is the foothills');
  assert.equal(wildRingAt(29, 19, mask), 4, 'the middle is the heart');
  assert.equal(wildRingAt(5, 20, mask), 0, 'outside, no ring');
  let was = 0;
  for (let x = 10; x <= 29; x++) { const r = wildRingAt(x, 19, mask); assert.ok(r >= was, `deeper never lighter at ${x}`); was = r; }
  assert.deepEqual(new Set(Array.from({ length: 20 }, (_, i) => wildRingAt(10 + i, 19, mask))), new Set([1, 2, 3, 4]), 'all four met on the way in');
  assert.equal(wildRingLoot(9), 2, 'a ring nobody can name is paid as the heart');
  const chains = wildRingChains(mask, 4);
  assert.ok(chains.length >= 1 && chains.every((c) => c.length > 2), 'the heart has its line');
  const anchors = wildRingAnchors(mask);
  assert.deepEqual(anchors.map((a) => a.ring), [4, 3, 2, 1], 'each ring named, the heart first');
  assert.ok(anchors.slice(1).every((a, i) => a.y < anchors[i].y), 'the outer rings named up the column north of the heart');
});

test('WILD2: a foe of a ring - its odds, its gold and its cap at the ring\'s multiplier; a pile its share of a second roll', () => {
  setWildHere(true, 2); assert.equal(wildRing(), 2); setWildHere(false); assert.equal(wildRing(), 0);
  assert.deepEqual(wildLootOpts({ lootDropMult: 1.2 }, 2), { lootDropMult: 1.2 * 1.5, lootQualityMult: 1.5 }, 'over an elite\'s');
  const e = { maxHealth: 10, health: 10 };
  applyWildFoe(e, { ring: 1 });
  assert.equal(wildFoeLoot(e), 1.25);
  assert.equal(wildFoeLoot({}), 1, 'a foe of no zone');
  const plain = plainFoeLootRule({ mobileType: 1, level: 1 }).cap;
  assert.equal(plainFoeLootRule({ mobileType: 1, level: 1, wildFoe: true, wildRing: 4 }).cap, plain * 2, 'the heart\'s cap twice as wide');
  const rich = { wildFoe: true, wildRing: 3, items: [{ group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: 40 }] };
  wildLootAfter(rich);
  assert.equal(rich.items[0].stackCount, 70, 'gold x1.75 in the high crags');
  const roll = () => [{ templateIndex: 7 }];
  assert.equal(wildPileMore([{ templateIndex: 1 }], roll, 4, () => 0.99).length, 2, 'the heart always rolls twice');
  assert.equal(wildPileMore([{ templateIndex: 1 }], roll, 1, () => 0.3).length, 1, 'the foothills one time in four');
  assert.equal(wildPileMore([{ templateIndex: 1 }], roll, 1, () => 0.2).length, 2);
});

test('WILD2: the zone map\'s ink - each ring its tone, the view holding the whole zone in the legend\'s leftover room', () => {
  const px = ringPixels(mask, 2);
  const alphaAt = (mx, my) => px.data[(((my - mask.box.y0) * 2) * px.w + (mx - mask.box.x0) * 2) * 4 + 3];
  assert.ok(alphaAt(29, 19) > alphaAt(10, 19), 'the heart\'s fill heavier than the foothills\'');
  assert.equal(RING_INK.length, WILD_RINGS);
  const v = zoneMapView(mask, { paperW: 1200, paperH: 760 });
  assert.ok(v.ox <= 10 && v.ox + (1200 - 300) / v.scale >= 50, 'the box across, in the room left of the legend');
  assert.ok(v.oy <= 5 && v.oy + 760 / v.scale >= 35, 'and down');
  const lim = zoneMapLimits(mask, { paperW: 1200, paperH: 760 });
  assert.ok(scaleMinOf(lim) > scaleMinOf({ mapW: 1000, mapH: 500, paperW: 1200, paperH: 760 }) * 5, 'never zoomed back out to the bay');
  const sq = smoothChain([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }], 2);
  assert.deepEqual(sq[0], sq.at(-1), 'a ring line stays closed');
  assert.ok(sq.every((p) => p.x > 0 || p.y > 0), 'its corners cut');
});

test('WILD3: a fast journey - never into or out of the zone; inside it 2,500 gold and one in ten minutes; outside, nothing asked', () => {
  const inA = { x: 20, y: 20 }, inB = { x: 12, y: 8 }, out = { x: 2, y: 2 };   // PVPTIERS: inB in the foothills - the fee is the tier it lands in
  assert.deepEqual(wildJourney({ from: out, to: { x: 55, y: 2 }, mask }), { ok: true, fee: 0 });
  assert.equal(wildJourney({ from: out, to: inA, mask, gold: 1e6 }).ok, false, 'not in');
  assert.match(wildJourney({ from: inA, to: out, mask, gold: 1e6 }).text, /out of the Wrothgarian/, 'not out');
  assert.deepEqual(wildJourney({ from: inA, to: inB, mask, gold: WILD_TRAVEL_FEE }), { ok: true, fee: 2500 });
  assert.equal(wildJourney({ from: inA, to: inB, mask, gold: WILD_TRAVEL_FEE - 1 }).ok, false, 'the fee in coin');
  // PVPTIERS: deeper costs more - 2.5k, 5k, 10k, 15k by the tier it lands in
  assert.deepEqual([...WILD_TRAVEL_FEES], [2500, 5000, 10000, 15000]);
  assert.deepEqual([{ x: 40, y: 30 }, { x: 20, y: 20 }, { x: 29, y: 19 }].map((to) => [wildRingAt(to.x, to.y, mask), wildJourney({ from: inB, to, mask, gold: 1e6 }).fee]), [[2, 5000], [3, 10000], [4, 15000]]);
  assert.match(wildJourney({ from: inB, to: { x: 29, y: 19 }, mask, gold: 14_999 }).text, /15,000/, 'the heart\'s fee in coin');
  const now = 1e9;
  assert.match(wildJourney({ from: inA, to: inB, mask, gold: 1e6, now, lastAt: now - 60_000 }).text, /9 more minutes/);
  assert.equal(wildJourney({ from: inA, to: inB, mask, gold: 1e6, now, lastAt: now - WILD_TRAVEL_COOLDOWN_MS }).ok, true);
  assert.deepEqual(wildJourney({ from: inA, to: out, mask: null }), { ok: true, fee: 0 }, 'offline there is no zone');
  const w = W('src/scenes/world.js');
  for (const fn of ['async function fastTravelTo(', 'async function recallToAnchor(', 'async function teleportTo(']) {
    const i = w.indexOf(fn);
    assert.ok(/wildTravelGate\(/.test(w.slice(i, i + 1600)), `${fn} asks the zone's law`);
  }
});

test('WILD3: the pace in the zone - at most x20 off the road and x40 on it, a cap that never writes the dials', () => {
  _resetTravelPace();
  try {
    assert.equal(paceRateOn(false), 60);
    setPaceZoneCap(WILD_PACE_CAP);
    assert.deepEqual([paceRateOn(false), paceRateOn(true)], [20, 40], '"max 20x in the wilds and 40x on the roads"');
    assert.equal(paceNow('speed'), 20);
    assert.equal(paceCanRise('speed'), false);
    setPaceZoneCap(null);
    assert.equal(paceRateOn(false), 60, 'out of the zone the choice comes back');
  } finally { _resetTravelPace(); }
});

test('WILD3: giants four times their size in the open country; strangers red, nameless, and enemies to a journey', () => {
  assert.equal(WILD_GIANT, 16, 'Daggerfall\'s Giant');
  assert.equal(wildGiantSize({ wildGiant: true }), WILD_GIANT_SIZE);
  assert.equal(wildGiantSize({}), 1);
  const ef = W('src/scenes/exteriorFoes.js');
  assert.match(ef, /if \(wild && mobileType === WILD_GIANT && zoneGiant != null\) entity\.wildGiant = true;/, 'the street\'s pool alone marks them - ZONE-GIANTS: the zone\'s own eight, never a roll\'s');
  assert.match(ef, /if \(Number\.isInteger\(r\.gg\) && f\.entity\.zoneGiant !== r\.gg\) \{ f\.entity\.wildGiant = true; f\.entity\.zoneGiant = r\.gg; \}/, 'GREATER-GIANT: a puppet by its owner\'s word - the ten it calls stay ordinary');
  assert.doesNotMatch(W('src/scenes/dungeonContext.js'), /wildGiant/, 'never a dungeon\'s');
  assert.deepEqual([WILD_STRANGER_M, WILD_STRANGER_SLOW_M], [600, 200], '"Like 600m away" - "like 200m it slows you down"');
  assert.match(W('src/scenes/world.js'), /for \(const g of _wildStrangers\) if \(!\(_tvAttack\?\.kind === 'peer' && _tvAttack\.id === g\.id\)\) out\.push\(\{ dx: g\.feet\[0\] - fx\[0\], dz: g\.feet\[2\] - fx\[2\], reach: WILD_STRANGER_SLOW_M \}\);/, 'a journey slows for them (PVPNEAR: never for the one I attack)');
  // the names: a masked point is a Stranger in its tint, in both faces
  const seen = [];
  const host = { namePoints: () => [{ id: 'a', name: 'Ria', gt: 'X' }, { id: 'b', name: 'Mack' }], drawNamePoints: (_r, _f, pts, _s, colorOf) => { for (const p of pts) seen.push([p.name, colorOf?.(p.id) ?? null]); return pts.length; } };
  RemotePlayers.prototype.nameFrame.call(host, { font: {}, mask: (p) => (p.id === 'a' ? { ...p, name: 'Stranger', gt: null, tint: [1, 0, 0, 1] } : p), colorOf: () => null });
  assert.deepEqual(seen, [['Stranger', [1, 0, 0, 1]], ['Mack', null]]);
});
