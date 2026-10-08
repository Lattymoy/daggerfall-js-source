// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md): THE OPEN ZONE - its mask and edge, its foes, what a death in
// it keeps and drops, the respawn's clear ground, the death screen's hold, and the maps' fog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WILD_REGION, WILD_FOE_HEALTH_MULT, WILD_FOE_DAMAGE_MULT, WILD_LOOT_GOLD_MULT, WILD_LOOT_DROP_MULT, WILD_LOOT_RARE_MULT,
  WILD_DEATH_HOLD_S, buildWildMask, wildInside, wildNear, wildEdgeChains, applyWildFoe, isWildRegion, setWildDeath, wildDeath,
  wildDeathLines, setWildHere, wildHere,
} from '../src/systems/wildZone.js';
import { keptOnWildDeath, wildCanLose, takeWildDrop, wornOffer, wildRecord, wildChunks, wildSpawnSpot } from '../src/systems/wildDeath.js';
import { fogPixels } from '../src/ui/wildMapInk.js';
import { DeathScreen, ONLINE_RESPAWN_SECONDS } from '../src/ui/deathScreen.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { REGION_NAMES } from '../src/formats/mapsTables.js';

/** A 40 x 20 map whose zone is the 6 x 4 box at (10..15, 5..8). */
const box = (x, y) => (x >= 10 && x <= 15 && y >= 5 && y <= 8 ? WILD_REGION : 3);
const mask = buildWildMask({ width: 40, height: 20, regionAt: box, nearPx: 2 });

test('WILD1: the zone is the Wrothgarian Mountains - region 16 - and its numbers are the owner\'s', () => {
  assert.equal(WILD_REGION, 16);
  assert.equal(REGION_NAMES[WILD_REGION], 'Wrothgarian Mountains');
  assert.ok(isWildRegion(16) && !isWildRegion(17) && !isWildRegion(-1));
  assert.deepEqual([WILD_FOE_HEALTH_MULT, WILD_FOE_DAMAGE_MULT], [4, 4], '"Mobs are 4x stronger"');
  assert.deepEqual([WILD_LOOT_GOLD_MULT, WILD_LOOT_DROP_MULT, WILD_LOOT_RARE_MULT], [2, 2, 2], '"twice gold and twice the dropchance for rarity items and double drops"');
  assert.equal(WILD_DEATH_HOLD_S, 120, '"has to wait 2mins till respawn"');
});

test('WILD1: the mask - inside, the band around it, its box, and its edge as closed chains of pixel corners', () => {
  assert.deepEqual(mask.box, { x0: 10, y0: 5, x1: 15, y1: 8 });
  assert.ok(wildInside(mask, 10, 5) && wildInside(mask, 15.9, 8.9));
  assert.ok(!wildInside(mask, 9, 5) && !wildInside(mask, 16, 5), 'a pixel past the box is out');
  assert.ok(wildNear(mask, 8, 5) && wildNear(mask, 17, 10), 'within the band');
  assert.ok(!wildNear(mask, 7, 5) && !wildNear(mask, 18, 5), 'past it');
  assert.ok(!wildInside(null, 10, 5) && !wildNear(mask, -1, 5), 'no mask, or off the map: never');
  const chains = wildEdgeChains(mask);
  assert.equal(chains.length, 1, 'one closed loop');
  const c = chains[0];
  assert.deepEqual(c[0], c.at(-1), 'closed');
  const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [10, 16, 5, 9], 'round the pixels\' outer corners');
  assert.equal(c.length, 5, 'a rectangle\'s straight runs merged to its four corners');
});

test('WILD1: a foe of the zone - four times its health and its blows over an elite\'s, once; a puppet its blows alone', () => {
  const e = { maxHealth: 50, health: 50, damageScale: 3, healthMult: 5 };
  assert.equal(applyWildFoe(e), true);
  // PVPDUNGEONS: and its ring's share on top (no ring said: the heart's, twice)
  assert.deepEqual([e.maxHealth, e.health, e.damageScale, e.healthMult], [400, 400, 24, 40]);
  assert.equal(applyWildFoe(e), false, 'never twice');
  assert.equal(e.maxHealth, 400);
  const f = { maxHealth: 40, health: 40 };
  applyWildFoe(f, { ring: 1 });
  assert.deepEqual([f.maxHealth, f.damageScale], [200, 5], 'the foothills: +25% over the zone\'s four times');
  const p = { maxHealth: 30, health: 30 };
  applyWildFoe(p, { own: false });
  assert.deepEqual([p.maxHealth, p.health, p.damageScale], [30, 30, 8], 'its maximum is its owner\'s word');
});

test('WILD1: a death keeps the consumables and what never changes hands, drops the bag and the cart - never what is worn', () => {
  const potion = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle };
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch };
  const sword = { group: 'Weapons', templateIndex: 120, equipSlot: 5 };
  const helm = { group: 'Armor', templateIndex: 102, equipSlot: 0 };
  const loose = { group: 'Armor', templateIndex: 103 };
  const quest = { group: 'Armor', templateIndex: 104, questItem: true };
  const cart = { group: 'Transportation', templateIndex: 1 };
  const book = { group: 'UselessItems2', templateIndex: TEMPLATES.Spellbook };
  const cargo = { group: 'Weapons', templateIndex: 121 };
  assert.ok(keptOnWildDeath(potion) && keptOnWildDeath(torch), '"except campfires, torches, potions etc"');
  assert.ok(!wildCanLose(potion) && !wildCanLose(quest) && !wildCanLose(cart) && !wildCanLose(book));
  assert.ok(wildCanLose(sword), 'a worn piece may leave - to a killer\'s choice');
  const items = [potion, sword, loose, quest, cart, torch, book, helm];
  const wagon = [cargo];
  const drop = takeWildDrop(items, wagon);
  assert.deepEqual(drop, [loose, cargo], 'the bag first, then the cart');
  assert.deepEqual(items, [potion, sword, quest, cart, torch, book, helm], 'the rest stays, in its order');
  assert.deepEqual(wagon, [], '"it also loses all loot in it"');
  assert.deepEqual(wornOffer(items), [sword, helm], 'the killer\'s choice: the worn pieces a death lets go');
  const rec = wildRecord({ ...sword, questItem: true });
  assert.equal(rec.equipSlot, undefined); assert.equal(rec.questItem, undefined);
  assert.deepEqual(wildChunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('WILD1: the rise\'s clear ground - off every other body, facing open ground for the team', () => {
  const at = wildSpawnSpot([0, 0, 0], { bodies: [[0, 0, 0], [0, 0, 2]], yaw: 0, room: 2.5, step: 2 });
  assert.ok(Math.hypot(at.pos[0], at.pos[2]) >= 2, 'never on a body');
  assert.ok(Math.hypot(at.pos[0] - 0, at.pos[2] - 2) >= 2.5);
  const walled = wildSpawnSpot([0, 0, 0], { clear: (p, yaw) => Math.abs(yaw - Math.PI) < 1e-9 });
  assert.equal(walled.yaw, Math.PI, 'the bearing whose back is open');
  assert.deepEqual(wildSpawnSpot([3, 1, 4], { clear: () => false }).pos, [3, 1, 4], 'nothing better: the marker itself');
});

test('WILD1: the death screen holds two minutes in the zone and takes no Enter; its lines say what it cost', () => {
  const realDoc = globalThis.document;
  try {
    setWildDeath(null);
    const s = new DeathScreen({ online: true });
    assert.equal(s.holdSeconds, ONLINE_RESPAWN_SECONDS);
    setWildDeath({ killer: 'Ria', dropped: 3 });
    assert.equal(s.holdSeconds, WILD_DEATH_HOLD_S);
    assert.equal(s.respawnIn, 120);
    s.input('confirm');
    assert.equal(s.sequence.reset, false, 'Enter does not rise in the zone');
    assert.deepEqual(wildDeathLines(wildDeath()), ['Ria may claim one piece of your worn gear.', '3 things you carried lie where you fell, for ten minutes.', 'In the mountains the dead wait two minutes.']);
    setWildDeath({ killer: 'Ria', dropped: 0, claimed: 'Iron Helm' });
    assert.equal(wildDeathLines()[0], 'Ria took your Iron Helm.');
  } finally { setWildDeath(null); globalThis.document = realDoc; }
});

test('WILD1: the live flag, and the fog\'s pixels - inside the zone only, feathered toward its edge', () => {
  setWildHere(true); assert.equal(wildHere(), true); setWildHere(false); assert.equal(wildHere(), false);
  const big = buildWildMask({ width: 60, height: 40, regionAt: (x, y) => (x >= 10 && x < 40 && y >= 10 && y < 30 ? WILD_REGION : 0) });
  const fog = fogPixels(big, 2);
  assert.equal(fog.w, 60); assert.equal(fog.h, 40);
  const alpha = (mx, my) => fog.data[((Math.round((my - big.box.y0) * 2)) * fog.w + Math.round((mx - big.box.x0) * 2)) * 4 + 3];
  assert.ok(alpha(25, 20) > alpha(10.3, 20), 'thick in its heart, thin at its edge');
  assert.ok(alpha(25, 20) > 0);
});
