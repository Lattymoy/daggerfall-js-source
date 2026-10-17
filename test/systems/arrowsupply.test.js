// ARROW-SUPPLY (2026-10-11, Mac: "allow arrows to stick in walls/ground wherever shot and be retrieved", "Allow arrows to
// sometimes be retrieved from enemies", "Allow crafting of arrows", "Buff the shop's stock of arrows";
// bible/05-Combat/Arrow-Supply.md). STUCK-ARROWS, the lodge and the cap, FLETCH and SHOP-ARROWS - each by execution
// through its real producer, the four hosts by their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ArrowFlight, playerArrowHitFoe, stickable, stickArrow, liveStuckArrows, pruneStuckArrows, stuckArrowSetBack,
  stuckArrowMatrix, groundEntry, syncStuckArrowDraws, arrowMatrix,
  STUCK_ARROW_OWNER, STUCK_ARROWS_MAX, STUCK_ARROW_LIFT, STUCK_ARROW_EMBED, STUCK_ARROW_LABEL, STUCK_ARROW_NO_STORE, ARROW_LODGE_CHANCE,
} from '../../src/combat/arrowFlight.js';
import { createDroppedLoot, droppedLootHooks } from '../../src/scenes/droppedLoot.js';
import { Collider } from '../../src/player/collider.js';
import { startShotTally, stopShotTally } from '../../src/systems/shotTally.js';
import { spendAmmoFor, ARROW_TEMPLATE, ammoCountFor } from '../../src/systems/inventory.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { capLootList } from '../../src/systems/foeLootCap.js';
import { stockShopShelf, shopArrowStack, shopPelletStack, shopAmmoStack, SHOP_ARROWS_MAX, SHOP_ITEM_GROUPS } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES as B } from '../../src/world/buildingNames.js';
import { useItem, usableItem } from '../../src/systems/useItem.js';
import { fletchYield, FLETCH_TEMPLATES } from '../../src/systems/fletching.js';
import { registerTemplateOverrides, templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { RRI_TEMPLATE_PATCHES } from '../../src/systems/roleplayRealismItems/rriItems.js';
import { createForagingItem } from '../../src/systems/foraging/foragingInstall.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
const BOW = { group: 'Weapons', templateIndex: 130, name: 'Long Bow', material: 0 };
const arrows = (n, extra = {}) => ({ ...createWeapon(ARROW_TEMPLATE, 0, () => 0), stackCount: n, ...extra });
const arrowCount = (items) => ammoCountFor(items, null);

/** A host's own pool - drawn:false piles never mount, so the renderer is never asked for one. */
const pool = () => createDroppedLoot({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
  getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
  uploadRecordFrame: () => {},
});
/** A wall across z = 5 facing the archer, and the bare ground at y = 0 (the collider's heightAt floor). */
const walled = () => { const c = new Collider(() => 0); c.addMesh('wall', new Float32Array([-5, -5, 5, 5, -5, 5, 5, 5, 5, -5, 5, 5]), quadIdx, I); return c; };
const flyOut = (a, steps = 40) => { for (let i = 0; i < steps && a.arrows.some((m) => !m.dead); i++) a.update(0.05); };

test('STUCK-ARROWS: a player shaft that meets a wall stays where it struck - one Arrow in a pile of the host\'s own pool, at the ray\'s point less the lift, along its flight, named and storing nothing, unsaved and drawn by the flight (mutants: still LOST; the point off the ray; no lift; no label; no noStore; saved)', () => {
  const loot = pool();
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: walled(), loot });
  a.fire([0, 1.5, 0], [0, 0, 1], { fromPlayer: true, weapon: BOW, muzzle: { world: [0, 1.5, 0] } });
  flyOut(a);
  const stuck = liveStuckArrows(loot);
  assert.equal(stuck.length, 1, 'the shaft stuck');
  const p = stuck[0];
  assert.equal(p.owner, STUCK_ARROW_OWNER);
  assert.deepEqual(p.items.map((it) => [it.templateIndex, it.stackCount]), [[ARROW_TEMPLATE, 1]], 'one Arrow - bowDamageArrow, the one minter');
  assert.ok(Math.abs(p.pos[2] - 5) < 1e-6, `at the wall (z ${p.pos[2]})`);
  assert.ok(Math.abs(p.pos[1] - (1.5 - STUCK_ARROW_LIFT)) < 1e-6, 'the box\'s middle at the shaft');
  assert.deepEqual(p.stuckDir, [0, 0, 1]);
  assert.equal(p.label, STUCK_ARROW_LABEL);
  assert.equal(droppedLootHooks(p).capacity(), STUCK_ARROW_NO_STORE, 'nothing is put on a stuck shaft');
  assert.equal(p.unsaved, true);
  assert.equal(p.drawn, false);
  assert.equal(loot.snapshotScene().length, 0, 'no scene cache carries it');
  assert.equal(loot.snapshotWorld((q) => ({ x: q[0], z: q[2] })).length, 0, 'no world save either');
  // ...and it is a pile every host already presses: the loot target, by the pool's own key
  const t = loot.lootTargets().find((x) => x.key === `droppedLoot:${p.id}`);
  assert.ok(t, 'a target');
  assert.ok(t.aabb.min[1] < 1.5 && t.aabb.max[1] > 1.5, 'the box spans the shaft');
  assert.equal(loot.labelFor(t.key), 'Arrow');
});

test('STUCK-ARROWS: a shaft into the bare ground sticks where its step crossed the ground (mutants: no ground arm; the step\'s end, not the crossing)', () => {
  const loot = pool();
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: new Collider(() => 0), loot });
  a.fire([0, 1, 0], [0, -0.6, 0.8], { fromPlayer: true, weapon: BOW, muzzle: { world: [0, 1, 0] } });
  flyOut(a);
  const [p] = liveStuckArrows(loot);
  assert.ok(p, 'stuck in the ground');
  assert.ok(Math.abs(p.pos[1] + STUCK_ARROW_LIFT) < 1e-6, 'on the ground');
  assert.ok(Math.abs(p.pos[2] - 1 / 0.6 * 0.8) < 1e-6, `where the line meets y = 0 (z ${p.pos[2]})`);
  // the crossing, by itself: halfway down a step that ends half a unit under
  assert.deepEqual(groundEntry([0, 0.5, 0], [0, -0.5, 2], { heightAt: () => 0 }), [0, 0, 1]);
  assert.deepEqual(groundEntry([0, -0.2, 0], [0, -0.5, 2], { heightAt: () => 0 }), [0, 0, 0], 'already under: where the step began');
});

test('STUCK-ARROWS: what never sticks - an enemy\'s shaft, a peer\'s drawn echo, a conjured round, the gun\'s pellet, a shaft on a bout\'s sand, and a host with no pool (mutants: each gate dropped)', () => {
  const shoot = (meta, loot = pool()) => {
    const a = new ArrowFlight({ getGpuMesh: () => null, collider: walled(), loot });
    a.fire([0, 1.5, 0], [0, 0, 1], { muzzle: { world: [0, 1.5, 0] }, ...meta });
    flyOut(a);
    return loot ? liveStuckArrows(loot).length : 0;
  };
  assert.equal(shoot({ fromPlayer: true, weapon: BOW }), 1, 'the control');
  assert.equal(shoot({ enemy: true, weapon: BOW }), 0, 'an enemy\'s');
  assert.equal(shoot({ fromPlayer: true, visual: true, weapon: BOW }), 0, 'a peer\'s echo');
  assert.equal(shoot({ fromPlayer: true, summoned: true, weapon: BOW }), 0, 'a conjured round vanishes');
  assert.equal(shoot({ fromPlayer: true, weapon: createThunderlock() }), 0, 'a pellet is spent');
  startShotTally([]);
  assert.equal(shoot({ fromPlayer: true, weapon: BOW }), 0, 'the sand keeps the LOST law - the healers pay it');
  stopShotTally();
  assert.equal(shoot({ fromPlayer: true, weapon: BOW }, null), 0, 'no pool, DFU\'s LOST');
  assert.equal(stickable({ fromPlayer: true, weapon: BOW }), true);
  assert.equal(stickable(null), false);
});

test('STUCK-ARROWS: the pool keeps STUCK_ARROWS_MAX, the oldest going; a taken shaft\'s pile is pruned, an emptied one too - and the press takes it into the pack (mutants: no cap; the newest dropped; the prune)', () => {
  const loot = pool();
  const first = stickArrow(loot, [0, 1, 0], [0, 0, 1]);
  for (let i = 1; i <= STUCK_ARROWS_MAX; i++) stickArrow(loot, [i, 1, 0], [0, 0, 1]);
  const live = liveStuckArrows(loot);
  assert.equal(live.length, STUCK_ARROWS_MAX);
  assert.equal(live.includes(first), false, 'the oldest went');
  assert.equal(live.at(-1).pos[0], STUCK_ARROWS_MAX, 'the newest stands');
  // the press: the pile's own hooks hand its one Arrow over, and the next frame's prune frees it
  const p = live[0];
  const pack = [arrows(3)];
  const hooks = droppedLootHooks(p);
  pack.push(...hooks.items().splice(0));
  loot.releaseEmptied();   // the window's close: a container is only deactivated
  pruneStuckArrows(loot);
  assert.equal(loot._piles.includes(p), false, 'freed');
  assert.equal(liveStuckArrows(loot).length, STUCK_ARROWS_MAX - 1);
  assert.equal(arrowCount(pack), 4);
  // emptied by a take that closed no window (no releaseEmptied): the prune frees it all the same
  const q = liveStuckArrows(loot)[0];
  q.items.length = 0;
  pruneStuckArrows(loot);
  assert.equal(loot._piles.includes(q), false, 'an emptied pile goes too');
});

test('STUCK-ARROWS: the flight draws each standing shaft with the 99800 mesh, set back from the point so STUCK_ARROW_EMBED of it is in (mutants: not drawn; the set-back ignored; the tip the sphere\'s back)', async () => {
  const loot = pool();
  const gpu = { bounds: new Float32Array([0, 0, 0.1, 0.4]) };
  const asked = [];
  const a = new ArrowFlight({ getGpuMesh: (id) => { asked.push(id); return gpu; }, collider: walled(), loot });
  const drawn = [];
  const renderer = { drawMesh: (g, m) => drawn.push([g, m]) };
  a.draw(renderer);
  assert.deepEqual(asked, [], 'no shaft, no mesh asked for');
  stickArrow(loot, [1, 2, 3], [0, 0, 2]);
  a.draw(renderer);
  await Promise.resolve(); await Promise.resolve();
  a.draw(renderer);
  assert.deepEqual(asked, [99800], 'asked once');
  assert.equal(drawn.length, 1);
  // the tip is the sphere's front (cz + r = 0.5), the length its diameter (0.8): 0.5 - 0.25 * 0.8 = 0.3 back
  assert.ok(Math.abs(stuckArrowSetBack(gpu.bounds) - (0.5 - STUCK_ARROW_EMBED * 0.8)) < 1e-6);
  assert.equal(stuckArrowSetBack(null), 0);
  const want = arrowMatrix([1, 2, 3 - stuckArrowSetBack(gpu.bounds)], [0, 0, 1]);
  assert.deepEqual([...drawn[0][1]].map((v) => +v.toFixed(5)), [...want].map((v) => +v.toFixed(5)));
  assert.deepEqual([...stuckArrowMatrix(liveStuckArrows(loot)[0], gpu.bounds)], [...drawn[0][1]]);
});

test('STUCK-ARROWS: THE DUNGEON\'S HALF - an entry in its draw list for each standing shaft, gone with its pile (mutants: never removed; drawn twice)', () => {
  const loot = pool();
  const draws = [{ other: true }], held = new Map(), gpu = { bounds: null };
  const p = stickArrow(loot, [0, 1, 0], [1, 0, 0]);
  syncStuckArrowDraws(loot, draws, held, () => null);
  assert.equal(draws.length, 1, 'no mesh yet, no entry');
  syncStuckArrowDraws(loot, draws, held, () => gpu);
  syncStuckArrowDraws(loot, draws, held, () => gpu);
  assert.equal(draws.length, 2, 'one entry, once');
  assert.equal(draws[1].gpu, gpu);
  stickArrow(loot, [0, 2, 0], [1, 0, 0]);
  syncStuckArrowDraws(loot, draws, held, () => gpu);
  assert.equal(draws.length, 3, 'a second shaft: one more entry, the first not drawn again');
  p.items.length = 0;
  syncStuckArrowDraws(loot, draws, held, () => gpu);
  assert.equal(draws.length, 2, 'taken: its entry goes');
  assert.deepEqual(draws[0], { other: true }, 'and the rest stays');
  assert.equal(held.size, 1);
});

test('STUCK-ARROWS: THE FOUR HOSTS - the three flights pass their pool (the world its pixel), the dungeon sticks at its wall seam and draws in its list, every loose and technique door carries the conjured round, and neither save keeps an unsaved pile (mutants: by source)', () => {
  const ext = read('src/scenes/exterior.js'), world = read('src/scenes/world.js'), modes = read('src/scenes/worldModes.js'), dun = read('src/scenes/dungeonContext.js');
  assert.match(ext, /new ArrowFlight\(\{ getGpuMesh, collider: \(\) => collider, effects: hitEffects, loot: droppedLoot \}\)/);
  assert.match(world, /new ArrowFlight\(\{ getGpuMesh, collider: \(\) => collider, effects: hitEffects, loot: droppedLoot, pixelKeyAt: \(\) => `\$\{playerTravelPixel\(\)\.x\},\$\{playerTravelPixel\(\)\.y\}` \}\)/);
  assert.match(modes, /new ArrowFlight\(\{ getGpuMesh: pipeline\.getGpuMesh, collider: \(\) => interiorCtx\?\.collider, effects: interiorHitEffects, loot: interiorDropped \}\)/);
  assert.match(dun, /if \(m\.arrow && stickable\(m\)\) stickArrow\(droppedLoot, impact, _unit\);[^\n]*\n\s*retireMissile\(m\);/);
  assert.match(dun, /syncStuckArrowDraws\(droppedLoot, dynamicDraws, _stuckDraws, stuckArrowMesh\);[^\n]*\n\s*if \(!missiles\.length \|\| !playerFeet\) return;/, 'before the no-missile return');
  assert.match(dun, /droppedLoot: droppedLoot\._piles\.filter\(\(p\) => !p\.unsaved\)\.map/);
  for (const [name, s, fire] of [['exterior', ext, 'arrows.fire(eye, fwd'], ['world', world, 'arrows.fire(cam.pos, fwd'], ['worldModes', modes, 'interiorArrows.fire(player.eye, eyeDir()']]) {
    assert.match(s, /const shot = \{ summoned: false \};[^\n]*\n\s*if \(spendAmmoFor\(playerEntity\.items, \w+\.playerWeapon\.weapon, shot\)\) \{/, `${name}: the loose asks whether the round was conjured`);
    const at = s.indexOf(fire);
    assert.ok(at > 0 && s.slice(at, s.indexOf('\n', at)).includes('summoned: shot.summoned'), `${name}: the shaft carries it`);
    assert.match(s, /\.\.\.\(o\?\.summoned \? \{ summoned: true \} : \{\}\) \}\),/, `${name}: the technique door carries it`);
  }
  assert.match(dun, /if \(!spendAmmoFor\(playerEntity\.items, playerWeapon\.weapon, shot\)\) continue;\n\s*fireArrow\([^\n]*shot\.summoned \? \{ summoned: true \} : null\);/);
  assert.match(dun, /\.\.\.\(o\?\.summoned \? \{ summoned: true \} : \{\}\) \}\),/);
  assert.match(read('src/scenes/droppedLoot.js'), /p\.owner !== 'wild' && !p\.unsaved\)/);
});

test('STUCK-ARROWS: spendAmmoFor answers whether the round was conjured - DFU\'s isArrowSummoned, conjured first (mutants: never told; told the inverse)', () => {
  const pack = [arrows(1, { timeForItemToDisappear: 99 }), arrows(2)];
  const shot = {};
  assert.equal(spendAmmoFor(pack, null, shot), true, 'still a boolean');
  assert.equal(shot.summoned, true, 'the conjured one first');
  assert.equal(spendAmmoFor(pack, null, shot), true);
  assert.equal(shot.summoned, false);
  assert.equal(spendAmmoFor(pack, null), true, 'no shot asked, none told');
});

test('ARROW LODGE: a real shaft that strikes a foe lodges in its pack ARROW_LODGE_CHANCE of the time, on the blow\'s own stream after its rolls; a conjured one never (mutants: always; never; the conjured lodged)', () => {
  assert.equal(ARROW_LODGE_CHANCE, 0.5);
  const foe = () => ({ dead: false, entity: { items: [], basics: {}, level: 1, stats: {}, skills: {} }, ai: { feet: [0, 0, 0], yaw: 0, height: 1.8 } });
  const player = { level: 1, items: [], stats: {}, skills: {} };
  const shaft = { weapon: BOW, pos: [0, 0, 0] };
  const hit = (m, r) => { const f = foe(); playerArrowHitFoe(m, f, { playerEntity: player, rolls: () => r }); return arrowCount(f.entity.items); };
  assert.equal(hit(shaft, 0.49), 1, 'under the chance: lodged');
  assert.equal(hit(shaft, 0.5), 0, 'at it: broken');
  assert.equal(hit({ ...shaft, summoned: true }, 0), 0, 'a conjured round vanishes (WeaponManager.cs:554-559)');
  // the roll is the LAST draw: every draw before it is the blow's, as it was
  const f = foe();
  let n = 0;
  playerArrowHitFoe(shaft, f, { playerEntity: player, rolls: () => { n++; return n === 1 ? 0.99 : 0.3; } });
  assert.ok(n >= 2);
  assert.equal(arrowCount(f.entity.items), 1, 'the last draw (0.3) decided it, the first (0.99) was the blow\'s');
  assert.match(read('src/combat/arrowFlight.js'), /if \(foe\.entity\?\.items && !orbArchiveFor\(m\.weapon\) && !m\.summoned && rolls\(\) < ARROW_LODGE_CHANCE\) \{/);
});

test('ARROW LODGE: AN ARROW IS NO FIND - a plain body keeps its cap of pieces AND every arrow in it, uncounted (mutants: arrows counted; arrows dropped; arrows ranked)', () => {
  const piece = (v) => ({ group: 'Weapons', templateIndex: 113, material: 0, value: v });
  const full = [piece(10), piece(20), piece(30), arrows(4)];
  assert.deepEqual(capLootList(full, 3), [], 'three pieces and the quiver: nothing thrown away');
  assert.equal(full.length, 4);
  const over = [piece(10), arrows(2), piece(20), piece(30), piece(40)];
  const dropped = capLootList(over, 3);
  assert.deepEqual(dropped.map((it) => it.value), [10], 'the cheapest piece goes, never the arrows');
  assert.deepEqual(over.map((it) => it.templateIndex === ARROW_TEMPLATE ? 'arrows' : it.value), ['arrows', 20, 30, 40], 'in the list\'s own order');
  assert.equal(capLootList([arrows(1), arrows(1), piece(1)], 0).length, 1, 'cap 0: the piece goes, the arrows stay');
  // the quiver never takes a piece's place, however cheap the pieces
  const cheap = [piece(1), piece(1), piece(1), piece(1), arrows(9)];
  assert.equal(capLootList(cheap, 3).length, 1, 'one piece over the cap - and only one');
  assert.equal(cheap.filter((it) => it.templateIndex === 113).length, 3);
});

test('SHOP-ARROWS: the counter\'s quiver is the pellets\' law at SHOP_ARROWS_MAX - a Weapon Smith 50 to 100, an Armorer and a General Store 14 to 29, a Pawn Shop 7 to 14, none where no weapon sells (mutants: the max; the pellets\' max)', () => {
  assert.equal(SHOP_ARROWS_MAX, 100);
  const at = (b) => [1, 10, 20].map((q) => shopArrowStack(b, q));
  assert.deepEqual(at(B.WeaponSmith), [50, 74, 100]);
  assert.deepEqual(at(B.Armorer), [14, 21, 29]);
  assert.deepEqual(at(B.GeneralStore), [14, 21, 29]);
  assert.deepEqual(at(B.PawnShop), [7, 11, 14]);
  for (const b of [B.Alchemist, B.Bookseller, B.ClothingStore, B.GemStore, B.FurnitureStore]) assert.equal(shopArrowStack(b, 20), 0);
  for (const b of Object.keys(SHOP_ITEM_GROUPS).map(Number)) for (const q of [1, 7, 20]) assert.equal(shopPelletStack(b, q), shopAmmoStack(b, q, 50), 'one law, two rounds');
});

test('SHOP-ARROWS ON THE COUNTER, FROM NO ROLL: the counter holds DFU\'s own draw plus the quiver as one stack, minted as the shelf mints arrows; no other shelf holds it, and no roll is drawn (mutants: every shelf; a roll drawn; not merged; another mint)', () => {
  for (const [b, q] of [[B.WeaponSmith, 14], [B.Armorer, 20], [B.GeneralStore, 9], [B.PawnShop, 3]]) {
    const run = (shelfIndex) => {
      let n = 0, seed = 91;
      const rolls = () => { n++; seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
      return { items: stockShopShelf({ buildingType: b, quality: q }, { level: 12 }, { rolls, shelfIndex, torchesFromItems: false }), n };
    };
    const counter = run(0), next = run(1);
    const rows = counter.items.filter((it) => it.templateIndex === ARROW_TEMPLATE);
    assert.equal(rows.length, 1, `building ${b}: one arrow stack`);
    assert.equal(arrowCount(counter.items), arrowCount(next.items) + shopArrowStack(b, q), `building ${b}: DFU's draw and the quiver`);
    assert.deepEqual([rows[0].group, rows[0].material, rows[0].currentCondition, rows[0].value], ['Weapons', 0, 0, 2], 'CreateWeapon\'s arrow');
    if (b === B.WeaponSmith || b === B.Armorer) assert.equal(counter.n, next.n, `building ${b}: the same draws`);
  }
  // an all-zero stream shelves every weapon, DFU's own arrows among them: the quiver joins that stack
  const all = stockShopShelf({ buildingType: B.WeaponSmith, quality: 21 }, { level: 1 }, { rolls: () => 0 });
  assert.equal(all.filter((it) => it.templateIndex === ARROW_TEMPLATE).length, 1, 'one stack');
  assert.equal(arrowCount(all), 1 + shopArrowStack(B.WeaponSmith, 21), 'Range(1, 21) at roll 0, and the quiver');
  const none = stockShopShelf({ buildingType: B.WeaponSmith, quality: 20 }, { level: 1 }, { rolls: () => 0.999, shelfIndex: 1 });
  assert.equal(arrowCount(none), 0, 'a shelf behind the counter: DFU\'s draw alone');
});

test('FLETCH: Use a piece of wood and it is its own weight in arrows - Twigs two, a Pine Branch four, a Wood Bundle ten - one piece a Use, into the pack, said in the window (mutants: a count table; the whole stack; the arrows into the list it lay in; a quest piece fletched)', () => {
  assert.deepEqual([...FLETCH_TEMPLATES], [8, 14, FT.WoodBundle]);
  assert.equal(fletchYield({ templateIndex: 8 }), 2);
  assert.equal(fletchYield({ templateIndex: 14 }), 4);
  assert.equal(fletchYield(createForagingItem(FT.WoodBundle)), 10);
  assert.equal(fletchYield({ templateIndex: 9 }), 0, 'not wood');
  const pack = [{ group: 'PlantIngredients1', templateIndex: 8, stackCount: 3 }, arrows(5)];
  assert.equal(usableItem(pack[0]), true, 'Use offers it');
  const r = useItem(pack[0], pack, {});
  assert.deepEqual(r, { kind: 'text', text: 'You fletch 2 arrows from the Twigs.' });
  assert.equal(pack[0].stackCount, 2, 'one piece');
  assert.equal(arrowCount(pack), 7, 'into the quiver - one stack');
  assert.equal(pack.filter((it) => it.templateIndex === ARROW_TEMPLATE).length, 1);
  // off a pile, into the pack
  const pile = [createForagingItem(FT.WoodBundle)], mine = [];
  assert.equal(useItem(pile[0], pile, { localItems: mine }).text, 'You fletch 10 arrows from the Wood Bundle.');
  assert.deepEqual([pile.length, arrowCount(mine)], [0, 10]);
  // a quest's piece keeps the ladder's answer
  const quest = [{ group: 'PlantIngredients2', templateIndex: 14, stackCount: 1, questItem: true }];
  const q = useItem(quest[0], quest, {});
  assert.notEqual(q?.text, 'You fletch 4 arrows from the Pine Branch.');
  assert.equal(quest.length, 1);
});

test('BENCH-ARROWS (FIELD BUGS 2026-10-15c, the Discord: "Crafting arrows at the workbench is useless"): a piece of wood fletches its weight over the CLASSIC Arrow\'s, whatever a mod patches - under Roleplay & Realism: Items (on by default, forced online) a Twig is two arrows, a Pine Branch four, a Wood Bundle ten, so four Twigs are eight in the field and the workbench\'s twenty stay the better trade (mutants: the patched Arrow read)', () => {
  registerTemplateOverrides(RRI_TEMPLATE_PATCHES);
  try {
    assert.equal(templateByIndex(ARROW_TEMPLATE).baseWeight, 0.1, 'the mod\'s Arrow stands');
    assert.deepEqual([fletchYield({ templateIndex: 8 }), fletchYield({ templateIndex: 14 }), fletchYield(createForagingItem(FT.WoodBundle))], [2, 4, 10]);
    const pack = [{ group: 'PlantIngredients1', templateIndex: 8, stackCount: 4 }];
    assert.deepEqual(useItem(pack[0], pack, {}), { kind: 'text', text: 'You fletch 2 arrows from the Twigs.' });
  } finally { registerTemplateOverrides([]); }
});
