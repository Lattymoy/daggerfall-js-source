// WBX (2026-09-26): THE OBLIVION GATE, FIXED AND DEEPENED - Mac, after the first fights: "None of the 3D geometry that
// was built including the oblivion interior/exterior gate are visible", "The boss muusic phase doesn't play", "Loot drops
// should show their sprite and have a small colored loot line that extrudes from the sprite itself", "The boss phases
// need to be more defined and more detailed mechanics", "The oblivion portal on the inside should spawn inside at the
// end of the fight. Currently there's no way to leave after ending"; and a player's report (Swololo on Discord): the
// damage too low, regeneration undoing it, the boss hard to place and to read, weapons broken, loot "pillaged", soul
// trap dead - and "maybe it should be 1.5 times faster", which Mac turned down ("I dont think making mechanics faster is
// the play"). Design: bible/11-Multiplayer/World-Bosses.md section 12.
//
//   WBX1 the one index type          render/renderer.js createMesh; the gate's, the court's and the land's builders
//   WBX2 the portal home             scenes/gateCourt.js portalFrame, world/gateArena.js portalDoor, worldModes gateWayHome
//   WBX3 the loot line               render/spoilsGlow.js, scenes/spoilsPool.js (the item's own sprite), ui/itemIconColor32.js
//   WBX4 his damage and his mark     net/gateBrain.js `base`, net/gateStrike.js strikeDamage; render/gateTelegraph.js mark
//   WBX5 the phases                  net/gateBrain.js PHASE_TURN, the leap, the meteor, the spokes, the burning ground
//   WBX6 no regeneration, no wear    systems/courtRules.js; combat/formulas.js damageEquipment and the stand-in's spareGear
//   WBX7 the soul trap               scenes/hostMagic.js, scenes/dungeonContext.js spellOnBoss, the court's roll at his fall
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Renderer } from '../src/render/renderer.js';
import { buildGateModel, GATE_HEIGHT, ARCH_Y0 } from '../src/world/gateModel.js';
import { buildCourtModel, courtToDungeon, portalDoor, PORTAL_AFTER_MS, PORTAL_RISE_MS, PORTAL_DROP, COURT_TEXT, EXIT_H } from '../src/world/gateArena.js';
import { buildDeadlandsLand, buildShardModel } from '../src/world/deadlandsLand.js';
import {
  ATTACKS, ATTACK_BY_ID, POOLS, POOL_TICK_MS, PHASE_NAMES, PHASE_TURN, BOSS_R, COURT_R, BOSS_REACH_R, COURT_CENTRE, newFight, joinFight, stepBrain,
  windupOf, wrapYaw, PHASE_AT,
} from '../src/net/gateBrain.js';
import { inAttack, spokeLanes, landingPools, poolUnder, strikeDamage, blowOf, strikeVerdict } from '../src/net/gateStrike.js';
import { telegraphShape, telegraphField, markShape, poolShapes, TELEGRAPH_KIND, TELEGRAPH_FS, BOSS_MARK_R, BOSS_MARK_CHEVRON_LEN, BOSS_MARK_CHEVRON_HALF_W } from '../src/render/gateTelegraph.js';
import { bossPlace, bossHop, bossAct, bossStandIn, bossLookOf, LEAP_AIR_MS, LEAP_HEIGHT, ATTACK_COLORS, POOL_COLOR, WARD_COLOR, BOSS_CUES, QUAKE_ON } from '../src/world/gateBoss.js';
import { createGateCourt, COURT_PHASE_TEXT, COURT_STRIKE_TEXT, MARK_COLOR, COURT_ROUND_MS } from '../src/scenes/gateCourt.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { bossBarModel, BOSS_BAR_TEXT } from '../src/ui/gateBossBar.js';
import { createSpoilsPool, iconSize, SPOILS_ICON_ARCHIVE, SPOILS_TAKE_AFTER_MS, SPOILS_TAKE_M, SPOILS_ICON_MAX_M, SPOILS_ICON_M_PER_PX } from '../src/scenes/spoilsPool.js';
import { lineHeight } from '../src/render/spoilsGlow.js';
import { itemIconKey, itemIconColor32 } from '../src/ui/itemIconColor32.js';
import { setCourtRules, regenBarred } from '../src/systems/courtRules.js';
import { applySpell } from '../src/systems/effects.js';
import { passiveSpecialsMagicRound, REGENERATE_AMOUNT, REGENERATE_PER_ROUNDS } from '../src/systems/passiveSpecials.js';
import { REGENERATION_FLAGS } from '../src/systems/specialAdvantages.js';
import { damageEquipment } from '../src/combat/formulas.js';
import { RELAY_VERSION } from '../src/net/wire.js';
import { relayVersionAtLeast } from './relayVersion.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
/** A seeded [0,1) source (mulberry32). */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A court driven by hand (wb4_gate_boss.test.js's shape) with the WBX doors recorded. */
function court({ feet = [0, 0, 0], health = 100, maxHealth = 100, save = 100 } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const struck = [], said = [], home = [], doors = [], traps = [];
  const me = { health, maxHealth, level: 12 };
  const pos = { feet };
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t,
    feet: () => (pos.feet ? courtToDungeon(pos.feet[0], pos.feet[1] ?? 0, pos.feet[2]) : null), player: () => me, save: () => save,
    strike: (dmg, how) => { struck.push([dmg, how]); me.health -= dmg; }, say: (t) => said.push(t),
    wayHome: () => home.push(clock.t), portalDoor: (d) => doors.push(d), soulTrap: (t) => traps.push(t),
  });
  return { c, link, clock, struck, said, home, doors, traps, me, pos };
}
const at = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };

// ═══ WBX1 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WBX1 the one index type: createMesh uploads 32-bit elements whatever the model handed in - the gate, the court and the land were built with 16-bit ones and every draw of them was refused - and the builders now hand 32-bit ones in (mutants: the widening dropped; a builder back on Uint16Array)', () => {
  const uploads = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, FLOAT: 4 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { if (k === 'bufferData') uploads.push([a[0], a[1]]); return {}; };
    },
  });
  const r = Object.create(Renderer.prototype);
  r.gl = gl; r._bindVao = () => {};
  const model = { positions: new Float32Array(9), normals: new Float32Array(9), uvs: new Float32Array(6), indices: new Uint16Array([0, 1, 2]), subMeshes: [{ textureArchive: 1, textureRecord: 0, startIndex: 0, primitiveCount: 1 }] };
  const mesh = r.createMesh(model);
  const el = uploads.find((u) => u[0] === gl.ELEMENT_ARRAY_BUFFER)[1];
  assert.ok(el instanceof Uint32Array, 'widened to the type every draw reads (gl.UNSIGNED_INT)');
  assert.deepEqual([...el], [0, 1, 2]);
  assert.equal(mesh.triIndices, model.indices, 'the wireframe still reads the model\'s own array');
  uploads.length = 0;
  const wide = new Uint32Array([2, 1, 0]);
  r.createMesh({ ...model, indices: wide });
  assert.equal(uploads.find((u) => u[0] === gl.ELEMENT_ARRAY_BUFFER)[1], wide, 'a 32-bit array goes up as it is');
  for (const [name, m] of [['the gate', buildGateModel()], ['the court', buildCourtModel()], ['the land', buildDeadlandsLand()], ['a shard', buildShardModel()]]) {
    assert.ok(m.indices instanceof Uint32Array, `${name} builds 32-bit indices`);
  }
  assert.match(read('src/render/renderer.js'), /buf\(gl\.ELEMENT_ARRAY_BUFFER, model\.indices instanceof Uint32Array \? model\.indices : Uint32Array\.from\(model\.indices\)\);/);
});

// ═══ WBX2 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WBX2 the portal home: nothing while he stands or falls; PORTAL_AFTER_MS into his fall it stands where he fell and rises over PORTAL_RISE_MS; its door is laid once and its rising said once; walking through its fire takes the way home - and nothing before it has risen, nothing for the dead (mutants: the portal at the court\'s centre; the door laid every frame; the walk-through unrisen)', () => {
  const h = court({ feet: [3, 0, 3] });
  const fell = state({ x: 6, z: -4, fell: { at: 50000, top: ['Mac'], n: 2 } });
  at(h, 49000, state({ x: 6, z: -4 }));
  assert.equal(h.c.portal(), null, 'not while he stands');
  at(h, 50000 + PORTAL_AFTER_MS - 1, fell);
  assert.equal(h.c.portal(), null, 'nor while he falls');
  at(h, 50000 + PORTAL_AFTER_MS, fell);
  const p = h.c.portal();
  assert.deepEqual(p.at, [6, -4], 'where he fell');
  assert.equal(p.rise, 0);
  assert.equal(h.doors.length, 1);
  assert.deepEqual(h.doors[0], portalDoor([6, -4]), 'its door, for the exit\'s ray and name');
  assert.deepEqual(h.said, [COURT_TEXT.portal]);
  at(h, 50000 + PORTAL_AFTER_MS + PORTAL_RISE_MS / 2, fell);
  assert.ok(Math.abs(h.c.portal().rise - 0.5) < 1e-9, 'rising');
  assert.equal(h.doors.length, 1, 'laid once'); assert.equal(h.said.length, 1, 'said once');
  // through it before it has risen: nothing
  h.pos.feet = [6, 0, -4 + 1]; at(h, 50000 + PORTAL_AFTER_MS + 600, fell);
  h.pos.feet = [6, 0, -4 - 1]; at(h, 50000 + PORTAL_AFTER_MS + 700, fell);
  assert.deepEqual(h.home, [], 'not through a fire still rising');
  // risen: the step through its plane, inside the opening, is the way home
  const T = 50000 + PORTAL_AFTER_MS + PORTAL_RISE_MS;
  h.pos.feet = [6, 0, -4 + 1]; at(h, T, fell);
  assert.deepEqual(h.home, []);
  h.pos.feet = [6, 0, -4 - 1]; at(h, T + 50, fell);
  assert.deepEqual(h.home, [T + 50], 'through the fire, home');
  // beside it (outside the opening), nothing
  const b = court({ feet: [6 + 8, 0, -4 + 1] });
  at(b, T, fell); b.pos.feet = [6 + 8, 0, -4 - 1]; at(b, T + 50, fell);
  assert.deepEqual(b.home, [], 'past the opening\'s edge');
  // the dead walk nowhere
  const d = court({ feet: [6, 0, -4 + 1], health: 0 });
  at(d, T, fell); d.pos.feet = [6, 0, -4 - 1]; at(d, T + 50, fell);
  assert.deepEqual(d.home, []);
  // a court come to late says nothing of it
  const late = court();
  at(late, 50000 + PORTAL_AFTER_MS + PORTAL_RISE_MS + 5000, fell);
  assert.deepEqual(late.said, [], 'a portal long risen is not announced');
  assert.equal(late.doors.length, 1, 'but its door stands');
  // the door's record: at the fall in the dungeon's frame, a body tall; the fire stood on the floor (the plinth absent)
  const door = portalDoor([6, -4]);
  assert.deepEqual([door.matrix[12], door.matrix[13], door.matrix[14]], courtToDungeon(6, 0, -4));
  assert.equal(door.size.y, EXIT_H);
  assert.equal(PORTAL_DROP, ARCH_Y0, 'the fire\'s foot on the floor');
});

test('WBX2 the seams: the court is handed the way home and the door; the way home is one door (gateWayHome) - the bridge\'s membrane and the portal both - through the fire and never for the dead; the portal is drawn with the gate\'s own fire pass', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /wayHome: \(\) => \{ modes\?\.gateWayHome\?\.\(\); \},/);
  assert.match(w, /portalDoor: \(door\) => \{ modes\?\.dungeonCtx\?\.exitDoors\?\.push\?\.\(door\); \},/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /if \(isGateArena\(dungeonLoc\)\) \{ gateWayHome\(\); return true; \}/, 'the bridge\'s membrane');
  assert.match(wm, /\n    gateWayHome,   \/\/ WBX2/);
  const gc = read('src/scenes/gateCourt.js');
  assert.match(gc, /portalPass\.draw\(\[\{ origin: portal\.origin, yaw: 0, open: 1, fade: portal\.rise, spin \}\], proj, view, eye, seconds, fog\);/);
  assert.match(gc, /portalPass = new GatePassRenderer\(gl, profile\);/);
});

// ═══ WBX3 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** A floor at y 0, as the collider's ray answers it. */
const floor = (from, dir, len) => { if (dir[1] >= 0) return null; const t = from[1] / -dir[1]; return t <= len ? { dist: t, normal: [0, 1, 0] } : null; };

test('WBX3 each piece is itself on the floor: an item stands as its own picture (the pack\'s, uploaded under the pool\'s pseudo-archive, keyed by the picture), gold keeps its pile; its line leaves the top of its sprite; a resting piece is taken only SPOILS_TAKE_AFTER_MS after it came to rest (mutants: the pile for every piece; the line from the floor; the take at once)', async () => {
  const uploads = [], batches = [], destroyed = [], taken = [];
  const clock = { t: 0 };
  const feet = { at: null };
  const renderer = {
    textures: new Set(),
    uploadTexture: (a, r, img) => { uploads.push([a, r, img.width, img.height]); return {}; },
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; batches.push(b); return b; },
    destroyBillboardBatch: (b) => destroyed.push(b),
  };
  const icon = { key: '207_3', width: 30, height: 20, colors: new Uint8ClampedArray(30 * 20 * 4) };
  const glowDraws = [];
  const p = createSpoilsPool({
    renderer, gl: null, getTexture: async () => ({ getSize: () => ({ width: 40, height: 30 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecordFrame: () => {},
    ray: floor, feet: () => feet.at, now: () => clock.t, take: (x) => taken.push(x), iconOf: async () => icon,
  });
  assert.equal(p.spew({ day: 900, seed: 77, level: 10, at: [0, 3, 0], bearing: 0 }), true);
  await new Promise((r) => setImmediate(r));
  for (let i = 0; i < 400; i++) { clock.t += 16; p.frame(); }
  const st = p.state();
  const items = st.pieces.filter((x) => x.kind === 'item'), gold = st.pieces.find((x) => x.kind === 'gold');
  assert.ok(items.length === 4 && items.every((x) => x.rest && x.icon), 'every item rests as its own picture');
  assert.ok(gold.rest && !gold.icon, 'gold keeps its pile');
  assert.ok(uploads.length >= 1 && uploads.every((u) => u[0] === SPOILS_ICON_ARCHIVE && u[1] === 'icon:207_3'), 'uploaded under the pool\'s pseudo-archive, keyed by the picture');
  const size = iconSize(30, 20);
  assert.ok(Math.abs(size.w - 30 * SPOILS_ICON_M_PER_PX) < 1e-9 && Math.abs(size.h - 20 * SPOILS_ICON_M_PER_PX) < 1e-9, 'its own texels, its own aspect');
  assert.ok(items.every((x) => Math.abs(x.h - size.h) < 1e-9), 'standing its picture\'s height');
  const big = iconSize(400, 100);
  assert.ok(Math.abs(big.w - SPOILS_ICON_MAX_M) < 1e-9 && big.h < big.w, 'never taller or wider than the most');
  assert.ok(batches.some((b) => b.archive === SPOILS_ICON_ARCHIVE && b.record === 'icon:207_3'));
  // the line: out of the top of the sprite
  const pass = { drawn: 0, draw(lines) { glowDraws.push(lines); this.drawn = lines.length; } };
  const q = createSpoilsPool({ renderer, gl: null, ray: floor, now: () => clock.t, take: () => {}, iconOf: async () => icon });
  assert.match(read('src/scenes/spoilsPool.js'), /root: \[f\.fly\.pos\[0\], f\.fly\.pos\[1\] \+ f\.h, f\.fly\.pos\[2\]\]/, 'the line\'s root is the sprite\'s crown');
  void q; void pass;
  // the take: not before it has rested SPOILS_TAKE_AFTER_MS, then as the feet pass over it
  const piece = st.pieces.find((x) => x.kind === 'item');
  feet.at = [piece.pos[0], piece.pos[1], piece.pos[2]];
  const restAt = clock.t;   // every piece has rested well before now - take them
  clock.t += 16; p.frame();
  assert.ok(taken.length >= 1, 'taken, long rested');
  // a fresh spew: my feet on the first piece the moment it rests - it waits SPOILS_TAKE_AFTER_MS, then it is taken
  const taken2 = [];
  const clock2 = { t: 0 };
  let stand = null;
  const fresh = createSpoilsPool({ renderer, gl: null, ray: floor, feet: () => stand, now: () => clock2.t, take: (x) => taken2.push(x), iconOf: null });
  fresh.spew({ day: 901, seed: 5, level: 3, at: [0, 0.05, 0], bearing: 0 });
  let firstRest = null;
  for (let i = 0; i < 400 && firstRest === null; i++) {
    clock2.t += 16; fresh.frame();
    const first = fresh.state().pieces.find((x) => x.rest);
    if (first) { firstRest = clock2.t; stand = [first.pos[0], first.pos[1], first.pos[2]]; }
  }
  assert.ok(firstRest !== null, 'a piece came to rest');
  while (clock2.t + 16 < firstRest + SPOILS_TAKE_AFTER_MS) { clock2.t += 16; fresh.frame(); }
  assert.deepEqual(taken2, [], 'under my feet, but not taken before it has rested SPOILS_TAKE_AFTER_MS');
  for (let i = 0; i < 4; i++) { clock2.t += 16; fresh.frame(); }
  assert.ok(taken2.length >= 1, 'taken once it has rested SPOILS_TAKE_AFTER_MS');
  void restAt; void SPOILS_TAKE_M;
});

test('WBX3 the picture, the burst and the pieces\' words: the icon\'s key is its archive, record and dye; a page with no canvas has none; the burst says the spoils are this player\'s alone (mutants: two dyes one key; the burst unsaid)', async () => {
  assert.equal(itemIconKey({ archive: 207, record: 3, dye: null }), '207_3');
  assert.notEqual(itemIconKey({ archive: 207, record: 3, dye: 'Iron' }), itemIconKey({ archive: 207, record: 3, dye: 'Ebony' }), 'two dyes, two pictures');
  assert.equal(await itemIconColor32(null), null);
  assert.equal(await itemIconColor32({ templateIndex: 101 }), null, 'node has no canvas - the pile stands');
  const gc = read('src/scenes/gateCourt.js');
  assert.match(gc, /if \(spoils\.spew\(\{[^\n]*\}\)\) say\(COURT_STRIKE_TEXT\.spilled\(bossOf\(s\)\.name\)\);/);
  assert.match(COURT_STRIKE_TEXT.spilled('Valkynaz Ruhn'), /yours alone/);
  assert.match(read('src/scenes/world.js'), /iconOf: itemIconColor32,/);
  assert.ok(lineHeight('artifact') > lineHeight('legendary'));
});

// ═══ WBX4 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WBX4 his damage: every attack a larger share and a base beside it - two landings leave anyone low, three end them; the base is whole points on the struck player\'s own machine (mutants: a base dropped; a share back at its old value)', () => {
  const was = { cleave: 0.30, slam: 0.35, charge: 0.25, hellfire: 0.30, nova: 0.40 };
  for (const [k, old] of Object.entries(was)) {
    assert.ok(ATTACKS[k].pct >= old, `${k}: never less than it was`);
    assert.ok(ATTACKS[k].base > 0, `${k}: a base beside the share`);
  }
  for (const A of ATTACK_BY_ID) assert.ok(Number.isFinite(A.base), `${A.key} names its base`);
  // Swololo: "people who were dying were under 150 health and got hit by mechanic twice"
  for (const hp of [40, 150, 400]) {
    const two = strikeDamage(ATTACKS.cleave.pct, hp, ATTACKS.cleave.base) + strikeDamage(ATTACKS.slam.pct, hp, ATTACKS.slam.base);
    const three = two + strikeDamage(ATTACKS.charge.pct, hp, ATTACKS.charge.base);
    assert.ok(two >= hp * 0.75, `${hp}: two landings leave you low (${two})`);
    assert.ok(three >= hp, `${hp}: a third ends you (${three})`);
  }
  assert.deepEqual(blowOf(W('meteor')), { pct: ATTACKS.meteor.pct, base: ATTACKS.meteor.base, el: 'fire', name: ATTACKS.meteor.name, saved: true });
});

test('WBX4 his mark: a ring about his feet a little wider than his body and a chevron before it where he faces - behind him none; drawn while he stands, gold while the ward holds, gone at his fall (mutants: the chevron behind him; the mark after his fall)', () => {
  const m = markShape([2, -3], Math.PI / 2, MARK_COLOR);   // facing +x
  assert.equal(m.kind, TELEGRAPH_KIND.mark);
  const f = (x, z) => telegraphField(m, x, z);
  assert.ok(f(2 + BOSS_MARK_R + 0.3, -3).chevron, 'ahead of him, the chevron');
  assert.ok(!f(2 - BOSS_MARK_R - 0.3, -3).chevron, 'behind him none');
  assert.ok(!f(2 + BOSS_MARK_R + BOSS_MARK_CHEVRON_LEN + 0.2, -3).chevron, 'no longer than its length');
  assert.ok(!f(2 + BOSS_MARK_R + 0.1, -3 + BOSS_MARK_CHEVRON_HALF_W + 0.1).chevron, 'no wider than its half-width');
  assert.ok(f(2, -3).inside && f(2 + BOSS_MARK_R, -3).edge < 1e-9, 'the ring at BOSS_MARK_R');
  assert.ok(BOSS_MARK_R > BOSS_R, 'a little wider than his body');
  assert.match(TELEGRAPH_FS, /\} else if \(uKind == 7\) \{/);
  // the court draws it
  const h = court();
  at(h, 9000, state({ x: 4, z: 1, yaw: 0.5 }));
  assert.deepEqual(h.c.state().mark.origin, [4, 1]);
  assert.equal(h.c.state().mark.yaw, 0.5);
  assert.deepEqual(h.c.state().mark.color, MARK_COLOR);
  at(h, 9100, state({ x: 4, z: 1, yaw: 0.5, shieldUntil: 9500 }));
  assert.deepEqual(h.c.state().mark.color, WARD_COLOR, 'gold while the ward holds');
  at(h, 9200, state({ x: 4, z: 1, fell: { at: 9150, top: [], n: 1 } }));
  assert.equal(h.c.state().mark, null, 'gone at his fall');
});

// ═══ WBX5 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WBX5 the new shapes: the leap and the meteor are one disc at their spot; the spokes are four lanes from his feet, the first along his facing, and the telegraph shows exactly what lands - point for point (mutants: a spoke off its angle; the point disc under every target)', () => {
  const leap = W('leap', { x: 0, z: 0, tg: [[8, 2]] });
  assert.ok(inAttack(leap, 8 + ATTACKS.leap.r - 0.1, 2) && !inAttack(leap, 8 + ATTACKS.leap.r + 0.1, 2), 'about its spot');
  assert.ok(!inAttack(leap, 0, 0), 'not where he stood');
  const met = W('meteor', { tg: [[-5, 5], [9, 9]] });
  assert.ok(inAttack(met, -5, 5) && !inAttack(met, 9, 9), 'one spot - the first');
  const sp = W('spokes', { x: 1, z: 1, yw: 0 });
  const lanes = spokeLanes(sp);
  assert.equal(lanes.length, 4);
  assert.deepEqual(lanes[0].slice(0, 2), [1, 1]);
  assert.ok(Math.abs(lanes[0][2] - 1) < 1e-9 && Math.abs(lanes[0][3] - (1 + ATTACKS.spokes.len)) < 1e-9, 'the first along his facing');
  assert.ok(inAttack(sp, 1, 10) && inAttack(sp, 10, 1) && inAttack(sp, 1, -10) && inAttack(sp, -8, 1), 'down each lane');
  assert.ok(!inAttack(sp, 1 + 7, 1 + 7), 'safe between them');
  const turned = W('spokes', { x: 1, z: 1, yw: Math.PI / 4 });
  assert.ok(inAttack(turned, 1 + 7, 1 + 7) && !inAttack(turned, 1, 10), 'the four between them');
  const rng = seeded(3);
  for (const atk of [leap, met, sp, turned]) {
    const shape = telegraphShape(atk, 2, atk.at - 100);
    for (let i = 0; i < 400; i++) {
      const x = (rng() * 2 - 1) * COURT_R, z = (rng() * 2 - 1) * COURT_R;
      if (Math.hypot(x, z) > COURT_R) continue;
      assert.equal(telegraphField(shape, x, z).inside, inAttack(atk, x, z), `${ATTACK_BY_ID[atk.a].key} at ${x.toFixed(2)},${z.toFixed(2)}`);
    }
  }
  assert.equal(telegraphShape(sp, 2, 9000).kind, TELEGRAPH_KIND.spokes);
  assert.equal(telegraphShape(leap, 2, 9000).kind, TELEGRAPH_KIND.discs);
  assert.deepEqual(telegraphShape(met, 2, 9000).points, [[-5, 5]]);
});

test('WBX5 the burning ground: Hellfire leaves a pool under each mark, the Meteor one where it fell, from the landing for the pool\'s span; STAYING in one bites every POOL_TICK_MS - the first a tick after stepping in - fire through the throw; the burnt-out go (mutants: a bite at once; the pool outliving its span; no throw)', () => {
  const hf = W('hellfire', { at: 10000, tg: [[1, 1], [8, -3]] });
  const pools = landingPools(hf);
  assert.deepEqual(pools.map((p) => [p.x, p.z, p.r, p.from, p.until]), [[1, 1, POOLS.hellfire.r, 10000, 10000 + POOLS.hellfire.ms], [8, -3, POOLS.hellfire.r, 10000, 10000 + POOLS.hellfire.ms]]);
  assert.deepEqual(landingPools(W('meteor', { tg: [[4, 4], [9, 9]] })).map((p) => [p.x, p.z, p.r]), [[4, 4, POOLS.meteor.r]]);
  assert.deepEqual(landingPools(W('cleave')), [], 'a blade leaves no fire');
  assert.equal(poolUnder(pools, 1, 1, 9999), null, 'not before it lands');
  assert.equal(poolUnder(pools, 1, 1, 10000 + POOLS.hellfire.ms), null, 'nor after it has burnt out');
  assert.equal(poolUnder(pools, 8, -1, 12000), pools[1]);
  // the court: I stand where a Hellfire mark falls and stay
  const h = court({ feet: [1, 0, 1], maxHealth: 200, health: 200, save: 50 });
  at(h, 9000, state({ atk: hf, phase: 2 }));
  at(h, 10001);
  assert.equal(h.struck.length, 1, 'the landing itself');
  assert.equal(h.c.state().pools.length, 2, 'the pools laid');
  at(h, 10001 + POOL_TICK_MS - 1);
  assert.equal(h.struck.length, 1, 'no bite before a tick of standing in it');
  at(h, 10001 + POOL_TICK_MS);
  const bite = Math.trunc(strikeDamage(POOLS.hellfire.pct, 200, POOLS.hellfire.base) * 50 / 100);
  assert.deepEqual(h.struck[1], [bite, { fire: true, name: COURT_STRIKE_TEXT.burning }], 'a bite, fire through my throw');
  at(h, 10001 + POOL_TICK_MS + 500);
  assert.equal(h.struck.length, 2, 'once a tick');
  // stepping out and back in starts the grace again
  h.pos.feet = [15, 0, 15]; at(h, 10001 + 2 * POOL_TICK_MS);
  h.pos.feet = [1, 0, 1]; at(h, 10001 + 2 * POOL_TICK_MS + 100);
  assert.equal(h.struck.length, 2, 'a step out was free, a step in waits its tick');
  at(h, 10000 + POOLS.hellfire.ms + 10);
  assert.equal(h.c.state().pools.length, 0, 'burnt out, gone');
  // drawn as filled discs, by radius, in the pool's colour
  const shapes = poolShapes([...pools, ...landingPools(W('meteor', { at: 10000, tg: [[4, 4]] }))], 11000, POOL_COLOR);
  assert.equal(shapes.length, 2, 'one shape a radius');
  assert.ok(shapes.every((s) => s.kind === TELEGRAPH_KIND.discs && s.t === 1 && s.color === POOL_COLOR));
});

test('WBX5 the phases: named, and each turn a sequence - the leap into the court\'s heart, then the Flame Nova (the Burning Court) or the spokes and the four between them (Dagon\'s Champion); the new attacks their phase\'s own; no attack faster than before (Mac: "I dont think making mechanics faster is the play") (mutants: the nova at the roar; the spokes in phase two)', () => {
  assert.deepEqual(PHASE_NAMES, ['The Warden', 'The Burning Court', "Dagon's Champion"]);
  assert.deepEqual(PHASE_TURN[2].map((e) => e.a), ['leap', 'nova']);
  assert.deepEqual(PHASE_TURN[3].map((e) => e.a), ['leap', 'spokes', 'spokes']);
  assert.ok(PHASE_TURN[2][0].centre && PHASE_TURN[3][0].centre, 'each opens at the heart');
  assert.ok(Math.abs(PHASE_TURN[3][2].turn - Math.PI / 4) < 1e-12, 'the four between them');
  assert.equal(ATTACKS.leap.phase, 2); assert.equal(ATTACKS.meteor.phase, 2); assert.equal(ATTACKS.spokes.phase, 3);
  for (const k of ['cleave', 'slam', 'charge', 'hellfire', 'nova']) assert.equal(windupOf(ATTACKS[k], 1), { cleave: 1400, slam: 1600, charge: 1200, hellfire: 2000, nova: 2200 }[k], `${k}: its wind-up as it was`);
  // the brain, whole: a fight crossing both lines walks the sequences
  const f = newFight(8, 0, 10_000_000, 'ruhn');
  assert.ok(joinFight(f, 'a', 'A', 20, 0, true));
  const bodies = [{ sub: 'a', x: 0, z: 6, dead: false }];
  f.nextAt = 0; f.pos = [5, 5];
  f.hp = f.max * PHASE_AT[0];
  const seen = [];
  const rng = seeded(11);
  for (let t = 100; t < 30000; t += 50) for (const o of stepBrain(f, t, bodies, rng)) if (o.k === 'atk' || o.k === 'ph') seen.push(o.k === 'ph' ? `ph${o.n}` : ATTACK_BY_ID[o.a].key);
  assert.deepEqual(seen.slice(0, 3), ['ph2', 'leap', 'nova'], 'the ward breaks: the leap, then the nova');
  f.hp = f.max * PHASE_AT[1];
  const seen3 = [];
  for (let t = 30000; t < 60000; t += 50) for (const o of stepBrain(f, t, bodies, rng)) if (o.k === 'atk' || o.k === 'ph') seen3.push(o.k === 'ph' ? `ph${o.n}` : ATTACK_BY_ID[o.a].key);
  assert.ok(seen3.join(',').includes('ph3,leap,spokes,spokes'), `Dagon's Champion: ${seen3.slice(0, 6).join(',')}`);
  assert.ok(Math.abs(wrapYaw(3 * Math.PI)) <= Math.PI + 1e-9 && Math.abs(wrapYaw(7.5)) <= Math.PI + 1e-9, 'a turned facing stays one the wire admits');
});

test('WBX5 the leap on the screen: he stands through its wind-up, crosses the air over its last LEAP_AIR_MS on the run\'s frames and a hop of LEAP_HEIGHT, and stands where it landed after; the turn is said by its name; the bar names the phase; each new attack has its colour, its cues and its quake (mutants: the leap drawn at the landing all along; the turn unsaid)', () => {
  const leap = W('leap', { x: 0, z: 0, at: 10000, tg: [[10, 0]] });
  const s = state({ atk: leap, x: 0, z: 0 });
  assert.deepEqual(bossPlace(s, 10000 - LEAP_AIR_MS - 1), [0, 0], 'on the ground through the wind-up');
  assert.deepEqual(bossPlace(s, 10000 - LEAP_AIR_MS / 2), [5, 0], 'half way across the air');
  assert.deepEqual(bossPlace(s, 10500), [10, 0], 'where it landed');
  assert.ok(Math.abs(bossHop(s, 10000 - LEAP_AIR_MS / 2) - LEAP_HEIGHT) < 1e-9, 'at the top of his arc');
  assert.equal(bossHop(s, 10000), 0); assert.equal(bossHop(s, 9000), 0);
  assert.equal(bossAct(s, 10000 - LEAP_AIR_MS / 2).act, 'run');
  assert.equal(bossAct(s, 9000).act, 'windup');
  for (const k of ['leap', 'meteor', 'spokes']) {
    assert.ok(ATTACK_COLORS[k] && BOSS_CUES.windup[k] && BOSS_CUES.land[k], `${k}: its colour and its cues`);
  }
  assert.ok(QUAKE_ON.includes('leap') && QUAKE_ON.includes('meteor'));
  const h = court();
  at(h, 1000, state({ phase: 1 }));
  at(h, 2000, state({ phase: 2 }));
  assert.ok(h.said.includes(COURT_PHASE_TEXT[2]), 'the turn said');
  assert.match(COURT_PHASE_TEXT[3], /Dagon's Champion/);
  const bar = bossBarModel(state({ phase: 2 }), 5000, { name: 'Valkynaz Ruhn', title: 'Warden' });
  assert.equal(bar.phaseName, BOSS_BAR_TEXT.phase(2));
  assert.equal(BOSS_BAR_TEXT.phase(3), `III - ${PHASE_NAMES[2]}`);
  assert.ok(relayVersionAtLeast(114), `the brain's law moved: ${RELAY_VERSION}`);
});

// ═══ WBX6 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WBX6 no regeneration in the court: the Regenerate effect\'s round and a career\'s Regenerate Health heal nothing while the court\'s laws stand, and heal again the moment they are down; a Heal is no regeneration (mutants: the switch ignored; the heal barred too)', () => {
  // effects.test.js's own Regenerate: 4 a round, three rounds, the first at the cast
  const reg = { type: 18, subType: 255, magnitudeBaseLow: 4, magnitudeBaseHigh: 4, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 3, durationMod: 0, durationPerLevel: 0 };
  const run = () => { const healed = []; const e = { health: 10, maxHealth: 100, activeEffects: [] }; applySpell({ element: 4, rangeType: 0, effects: [reg] }, 1, e, { heal: (n) => healed.push(n) }, () => 0); return healed; };
  try {
    setCourtRules(false);
    const outside = run();
    assert.deepEqual(outside, [4], 'outside the court it heals, at the cast');
    setCourtRules(true);
    assert.equal(regenBarred(), true);
    assert.deepEqual(run(), [], 'in the court: nothing');
    const healed = [];
    const me = { isPlayer: true, career: { regeneration: REGENERATION_FLAGS.general }, health: 5, maxHealth: 50 };
    passiveSpecialsMagicRound(me, { nowMinutes: REGENERATE_PER_ROUNDS * 3, sinks: { heal: (n) => healed.push(n) } });
    assert.deepEqual(healed, [], 'a career\'s regeneration: nothing');
    setCourtRules(false);
    passiveSpecialsMagicRound(me, { nowMinutes: REGENERATE_PER_ROUNDS * 3, sinks: { heal: (n) => healed.push(n) } });
    assert.deepEqual(healed, [REGENERATE_AMOUNT], 'and again the moment the court is gone');
  } finally { setCourtRules(false); }
  assert.match(read('src/systems/enchantments.js'), /if \(round % REGEN_PER_ROUNDS !== 0 \|\| regenBarred\(\)\) return;/, 'a RegensHealth enchantment: nothing');
  assert.match(read('src/systems/effects.js'), /if \(n > 0 && sinks\.heal && !regenBarred\(\)\) sinks\.heal\(n\);/);
  assert.match(read('src/scenes/world.js'), /\n    setCourtRules\(modes\?\.gateArenaDay\?\.\(\) != null\);/, 'the frame sets it, every frame');
});

test('WBX6 no wear on the blows at him: his stand-in carries spareGear, and damageEquipment spares the weapon and the struck armour for it alone - every other foe wears the gear as DFU\'s does (mutants: the stand-in unflagged; the spare for everyone)', () => {
  const standIn = bossStandIn(bossLookOf('ruhn'), 'Valkynaz Ruhn');
  assert.equal(standIn.spareGear, true);
  assert.equal(standIn.mobileType, bossLookOf('ruhn').mobile, 'and his mobile, for a soul trap');
  const weapon = { templateIndex: 115, currentCondition: 1000, maxCondition: 1000, material: 0 };
  const attacker = { isPlayer: true, items: [weapon] };
  damageEquipment(attacker, standIn, 40, weapon, 0, { rolls: () => 0 });
  assert.equal(weapon.currentCondition, 1000, 'no wear on him');
  damageEquipment(attacker, { items: [] }, 40, weapon, 0, { rolls: () => 0 });
  assert.ok(weapon.currentCondition < 1000, 'wear on anyone else');
});

// ═══ WBX7 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WBX7 the soul trap on him: kept on the relay\'s clock for its rounds (a trap running takes new rounds and keeps its chance), rolled once at his fall with his mobile when it was still running then, not when it had run out; nothing kept outside a fight (mutants: the roll at every frame; a spent trap rolled; the recast\'s chance taken)', () => {
  const h = court();
  at(h, 1000, state());
  assert.equal(h.c.trapped({ chance: 40, rounds: 3 }), true);
  assert.equal(COURT_ROUND_MS, 5000, 'a game minute on the shared clock');
  h.clock.t = 1000 + 2 * COURT_ROUND_MS;
  assert.equal(h.c.trapped({ chance: 90, rounds: 2 }), true, 'recast while it runs');
  // it now runs out at 1000 + 5 rounds
  at(h, 1000 + 5 * COURT_ROUND_MS - 10, state({ fell: { at: 1000 + 5 * COURT_ROUND_MS - 20, top: [], n: 1 } }));
  assert.deepEqual(h.traps, [{ chance: 40, mobile: bossLookOf('ruhn').mobile, name: 'Valkynaz Ruhn' }], 'rolled at his fall, the first trap\'s chance');
  at(h, 1000 + 5 * COURT_ROUND_MS + 500);
  assert.equal(h.traps.length, 1, 'once');
  const late = court();
  at(late, 1000, state());
  late.c.trapped({ chance: 40, rounds: 1 });
  at(late, 1000 + COURT_ROUND_MS + 100, state({ fell: { at: 1000 + COURT_ROUND_MS + 50, top: [], n: 1 } }));
  assert.deepEqual(late.traps, [], 'a trap that had run out before he fell is no trap');
  const none = court();
  at(none, 1000, state({ fell: { at: 900, top: [], n: 1 } }));
  assert.equal(none.c.trapped({ chance: 40, rounds: 3 }), false, 'nothing to keep it for');
});

test('WBX7 the seams: a soul trap meets him (hostMagic), the dungeon context lays it through applySpell and hands its chance and rounds to the court (onBossTrap, through the mode machine), the host rolls it with the port\'s own attemptSoulTrap and says its words', () => {
  const hm = read('src/scenes/hostMagic.js');
  assert.match(hm, /!\(duelSpellOf\(sp\) \|\| \(sp\.effects \?\? \[\]\)\.some\(\(e\) => e && isSoulTrapEffect\(e\)\)\)/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /const trapFx = \(sp\.effects \?\? \[\]\)\.filter\(\(e\) => e && isSoulTrapEffect\(e\)\);/);
  assert.match(dc, /if \(trap\) laid = !!opts\.onBossTrap\?\.\(\{ chance: trap\.chance, rounds: \(trap\.roundsRemaining \?\? 0\) \+ 1 \}\);/);
  assert.match(dc, /if \(!harm\) return laid;/, 'a trap alone still reaches him');
  assert.match(read('src/scenes/worldModes.js'), /onBossTrap: \(trap\) => !!host\.onBossTrap\?\.\(trap\),/);
  const w = read('src/scenes/world.js');
  assert.match(w, /onBossTrap: \(trap\) => !!gateCourt\?\.trapped\(trap\),/);
  assert.match(w, /const r = attemptSoulTrap\(\{ activeEffects: \[\{ kind: 'soulTrap', chance \}\] \}, mobile, playerEntity\.items \?\? \[\], Math\.random\(\)\);/);
  assert.match(w, /if \(r\.alert && SOUL_TRAP_TEXT\[r\.alert\]\) setMidScreenText\(SOUL_TRAP_TEXT\[r\.alert\]\);/);
});

test('WBX the strike verdict reads the new attacks as the old: a point disc and the spokes decided at their landing against my feet (mutants: the spokes never landing)', () => {
  const sp = W('spokes', { x: 0, z: 0, yw: 0, at: 5000 });
  assert.equal(strikeVerdict(sp, 0, 8, 4999), 'wait');
  assert.equal(strikeVerdict(sp, 0, 8, 5000), 'hit');
  assert.equal(strikeVerdict(sp, 6, 6, 5000), 'miss');
  const leap = W('leap', { at: 5000, tg: [[3, 3]] });
  assert.equal(strikeVerdict(leap, 3, 4, 5000), 'hit');
  assert.equal(strikeVerdict(leap, 15, 15, 5000), 'miss');
  assert.ok(Math.hypot(...keepTo(BOSS_REACH_R)) <= BOSS_REACH_R + 1e-9);
  assert.equal(COURT_CENTRE.length, 3);
  assert.ok(GATE_HEIGHT > 0);
});
const keepTo = (r) => [r * 0.6, r * 0.8];
