// G8-slice (AUDIT 23 guilds-8): the guild promotion MAP REVEALS.
// DiscoverRandomLocation (PlayerGPS.cs:892-910) as the discovery
// store's location half; the ThievesGuild's rank-6/8 gated map
// messages (ThievesGuild.cs:100-103); the DarkBrotherhood's
// unconditional reveal on EVERY promotion (DarkBrotherhood.cs:105-110).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  discoverLocation, hasDiscoveredLocationId, discoverRandomLocation,
  snapshotDiscovery, restoreDiscovery,
} from '../src/systems/discovery.js';
import { GUILDS, promotionTextId } from '../src/systems/guilds.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('G8: DiscoverRandomLocation - the candidate filter, the pick, the picked-clean null', () => {
  restoreDiscovery(null);
  const region = [
    { mapId: 0x100001, discovered: true, name: 'Baked', regionName: 'R' },    // MapTable Discovered
    { mapId: 0x100002, discovered: false, name: 'Hidden A', regionName: 'R' },
    { mapId: 0x100003, discovered: false, name: 'Hidden B', regionName: 'R' },
  ];
  // roll 0.9 over 2 candidates -> index 1 (Hidden B)
  const p1 = discoverRandomLocation(region, seq(0.9));
  assert.equal(p1.name, 'Hidden B');
  assert.equal(hasDiscoveredLocationId(0x100003), true, 'the pick lands in the store (masked key)');
  // the store now excludes it: only Hidden A remains
  const p2 = discoverRandomLocation(region, seq(0.9));
  assert.equal(p2.name, 'Hidden A');
  // picked clean -> null ("there's nothing to find")
  assert.equal(discoverRandomLocation(region, seq(0)), null);
  // the location half rides the envelope beside the buildings
  const snap = snapshotDiscovery();
  restoreDiscovery(null);
  assert.equal(hasDiscoveredLocationId(0x100002), false);
  restoreDiscovery(snap);
  assert.equal(hasDiscoveredLocationId(0x100002), true);
  assert.equal(hasDiscoveredLocationId(0x100003), true);
  restoreDiscovery(null);
});

test('G8: the ThievesGuild rank-6/8 map gate - reveal wins the map id, a clean region falls plain', () => {
  const tg = GUILDS.ThievesGuild;
  const calls = [];
  const okCtx = { revealLocation: (k) => { calls.push(k); return 'Some Crypt'; } };
  assert.equal(promotionTextId(tg, 6, okCtx), 5228, 'PromotionMap1Id');
  assert.equal(promotionTextId(tg, 8, okCtx), 5229, 'PromotionMap2Id');
  assert.deepEqual(calls, ['readMapTG', 'readMapTG'], 'the reveal fires with the TG note key');
  // a region with nothing left: the plain promotion message (:101/:103 ternary)
  const dryCtx = { revealLocation: () => null };
  assert.equal(promotionTextId(tg, 6, dryCtx), tg.text.promotion);
  assert.equal(promotionTextId(tg, 8, dryCtx), tg.text.promotion);
  // ranks 2/4 never touch the reveal (fence/spymaster ids stand)
  calls.length = 0;
  assert.equal(promotionTextId(tg, 2, okCtx), 5226);
  assert.equal(promotionTextId(tg, 4, okCtx), 5227);
  assert.deepEqual(calls, [], 'only 6/8 reveal in the TG');
  // no ctx (a host without the seam): the plain message, no throw
  assert.equal(promotionTextId(tg, 6, null), tg.text.promotion);
});

test('G8: the DarkBrotherhood reveals on EVERY promotion, whatever the rank', () => {
  const db = GUILDS.DarkBrotherhood;
  const calls = [];
  const ctx = { revealLocation: (k) => { calls.push(k); return 'Some Lair'; } };
  // an even rank takes the default message AND still reveals (:105-110
  // sit before the switch, unconditional)
  assert.equal(promotionTextId(db, 2, ctx), db.text.promotion);
  assert.equal(promotionTextId(db, 3, ctx), 6612);
  assert.equal(promotionTextId(db, 7, ctx), 6614);
  assert.deepEqual(calls, ['readMapDB', 'readMapDB', 'readMapDB'], 'three promotions, three reveals');
});

test('G8: the seam threads host-to-law', () => {
  const flow = readFileSync(new URL('../src/systems/guildServiceFlow.js', import.meta.url), 'utf8');
  assert.ok(flow.includes('updateRank(memberships, guild, entity, store, now, { revealLocation, ownsHouse })'),
    'onPushEffects hands the reveal seam to updateRank');
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(wm.includes('revealLocation: host.revealLocation ?? null'), 'the interior host threads it');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes('const picked = discoverRandomLocation(rows);'), 'the world host builds the region candidates');
  assert.ok(w.includes('row.mapId, discovered: row.discovered'), 'off the map TABLE, not full location reads');
});
