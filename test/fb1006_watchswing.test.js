// FIELD BUGS 2026-10-06 (WATCH-SWING) - a player's screenshot: two watchmen and a body in the road, and over the
// HUD the red CRASH bar the frame loop raises when it dies -
//
//     TypeError: Cannot set properties of null (setting 'conceal')
//       at Object.Ct [as update] (arenaGate-B2xzuGcP.js:317:20981)
//       at yx (world-BfE0WID5.js:2997:20957)
//
// Line 317 of that build's arenaGate chunk is the city watch's draw in cityGuards.js update(): `g.batch.conceal = ...`
// (a build of main lands the same statement on the same line, its `=` 41 columns on, and world.js's frame on line
// 2997 of its world chunk). A watchman read alive at the top of his iteration was dead at the bottom of it, killed by
// HIS OWN BLOW. A blow at the player runs calculateAttackDamage's struck tail (the Ring of Namira bouncing it back, systems/artifactEffects.js onPlayerStruckByEnemy) and then the
// host's hurt seam (the player's one damage door, where Spite of the Spurned, the loot's thorns and the Warden's Nova
// answer it), and every one of them lands through the watchman's own door, damageGuard, whose kill frees his live
// batch and nulls it. The loop went on to dress the batch it had just freed. The same interleave let a later
// watchman's blow free a batch already pushed into the frame's list (the Nova strikes every foe around the player),
// and the foe arm's `continue` (MT-ii: a watchman landing a blow on a monster) skipped his draw for that frame.
//
// THE FIX: the draw reads the frame's END. update() drives every watchman first, then builds the list from the ones
// still standing, as the encounter pool's batches() always has. These pins run the real pool on watch1.test.js's
// synthetic CLASS18.CFG and the real reflection (registered by systems/worldTick.js, which the pool imports), with the
// Ring worn in the shape PSCALE1's DOORS-2 pin wears it. The monster is the encounter pool's own, on a crafted
// MONSTER.BSA. The renderer stub marks a freed batch `_dead`, as render/renderer.js destroyBillboardBatch does.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { registerFormulaOverride } from '../src/combat/formulas.js';
import { ARTIFACTS } from '../src/systems/artifactEffects.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';
import { PLAYER_TARGET } from '../src/characters/enemyTargets.js';

// ---- the crafted data (watch1.test.js): the watch's class and a rat's career -----------------------------------
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa(records) {
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + 18 * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + 14, bytes.length, true); pos += 18; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const fetchBytes = async (n) => { if (n === 'CLASS18.CFG') return stubClassCfg(); if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); };
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };

const RING_OF_NAMIRA = { name: 'Artifact', currentCondition: 800, maxCondition: 800, enchantments: [{ type: T.SpecialArtifactEffect, param: ARTIFACTS.RingOfNamira }] };
const player = ({ ring = false } = {}) => ({
  isPlayer: true, level: 1, reflexes: 2, health: 100, maxHealth: 100,
  skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [],
  stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 },
  crimeCommitted: 4,   // Assault: a crime that holds the watch standing
  ...(ring ? { equip: { slots: { Ring0: RING_OF_NAMIRA } } } : {}),
});
/** A pool's deps. The renderer keeps every batch it minted and marks a freed one, as the real one does. */
const rig = (pe, extra = {}) => ({
  renderer: {
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: (b) => { if (b) b._dead = true; },   // render/renderer.js: `batch._dead = true` (EL2), its VAO deleted
    textures: new Map(),
  },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...extra,
});
const summon = (guards, at) => guards.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: at, fwdYaw: 0, guard: true, disable: () => {} }] });
/** This frame, the watchman stands where he is and senses what the pin sets (his motor and attack machine held), and
 *  pacification's one roll is spent: the frame under test is his blow's alone. */
function hold(g) {
  g.ai.update = () => {};
  g.attack.update = () => {};
  g.ai.justEncountered = false;
}
/** ...and his swing reaches its damage frame (mobileUnit.js C16: the -1 marker's latch, the consumer clears it) at
 *  `target`, in sight and inside 0.25 (meleeHitConnects: whatever the yaw). */
function armBlow(g, target) {
  hold(g);
  g.ai.target = target;
  g.ai.inSight = true; g.ai.detected = true; g.ai._dist = 0.2;
  g.mobile.doMeleeDamage = true;
}
/** One update with every blow landing for six (the formula's registered core, PCO1 - the struck tail is the
 *  callers' law and runs after it either way). */
function frame(guards) {
  registerFormulaOverride('calculateAttackDamage', () => 6);
  try { return guards.update(0.016, [0, 0, 0], [0, 1.7, 0]); } finally { registerFormulaOverride('calculateAttackDamage', null); }
}

test('WATCH-SWING: a watchman his own blow kills (the Ring of Namira bouncing it back through his door) is not drawn - update() dressed the batch his death had freed and threw "Cannot set properties of null (setting \'conceal\')", the frame loop\'s CRASH; his body is drawn the next frame', async () => {
  const pe = player({ ring: true });
  const guards = createCityGuards(rig(pe));
  await summon(guards, [0, 0, 1]);
  assert.equal(guards.guards.length, 1, 'one watchman off the synthetic CLASS18.CFG');
  const g = guards.guards[0];
  const live = g.batch;
  g.entity.health = 1;   // the reflected blow is his last
  armBlow(g, PLAYER_TARGET);
  const out = frame(guards);
  assert.equal(g.dead, true, 'the Ring reflected his blow through his own door, and it killed him');
  assert.equal(g.corpse, true, 'a kill: his body stays to be looted');
  assert.equal(live._dead, true, 'his live batch was freed at the death (AUDIT 24 releaseGuardBatch)');
  assert.ok(!out.includes(live), 'and the frame does not draw it');
  assert.ok(out.every((b) => b && !b._dead), 'no freed batch in the frame\'s list');
  await settle();
  const next = guards.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  assert.ok(g.corpseMarker && next.includes(g.corpseMarker.batch), 'the next frame draws his body, and the pool runs on');
});

test('WATCH-SWING: a watchman freed LATER in the frame (the host\'s hurt seam reaching back through hurtGuard, as the Warden\'s Nova does from the player\'s damage door) leaves no freed batch in the frame\'s list - the first watchman\'s had been pushed before the second one swung', async () => {
  const pe = player();
  let guards = null, striker = null;
  // world.js's onPlayerHurt is hurtPlayer -> the player's damage door -> setHurt -> the Nova -> the published door's
  // hurtFoe -> the sink's cityGuards.hurtGuard(g, n, feet, null, { fromPlayer: true, kind: 'spell' }); its last step
  const nova = () => { for (const w of guards.guards) if (!w.dead && w !== striker) guards.hurtGuard(w, 999, [0, 0, 0], null, { fromPlayer: true, kind: 'spell' }); };
  guards = createCityGuards(rig(pe, { onPlayerHurt: nova }));
  await summon(guards, [3, 0, 0]);
  await summon(guards, [0, 0, 1]);
  assert.equal(guards.guards.length, 2, 'two watchmen');
  const first = guards.guards[0];
  striker = guards.guards[1];
  const firstLive = first.batch;
  hold(first);
  armBlow(striker, PLAYER_TARGET);
  const out = frame(guards);
  assert.equal(first.dead, true, 'the Nova killed the first watchman after his turn in the loop');
  assert.equal(firstLive._dead, true, 'his live batch freed');
  assert.ok(!out.includes(firstLive), 'and not drawn - it had been pushed into the list a watchman earlier');
  assert.ok(out.every((b) => b && !b._dead), 'no freed batch in the frame\'s list');
  assert.ok(out.includes(striker.batch), 'the striker, standing, is drawn');
});

test('WATCH-SWING: a watchman whose blow lands on a FOE (MT-ii) is drawn that frame - the foe arm\'s `continue` skipped his draw, so he blinked out on every blow he landed on a monster', async () => {
  const pe = player();
  const guards = createCityGuards(rig(pe));
  const foes = createExteriorFoes(rig(pe));
  await summon(guards, [0, 0, 1]);
  const rat = await foes.spawnFoe(0, [0, 0, 1.2], { feetGiven: true });
  assert.ok(rat?.entity && typeof rat.hurtFromFoe === 'function', 'the encounter pool\'s rat, with its cross-pool door');
  rat.entity.health = rat.entity.maxHealth = 100;
  const g = guards.guards[0];
  armBlow(g, rat);
  g.ai._armedTargeting = true;   // _armed's runTargetMachine selected the rat (a host that hands over candidates)
  const out = frame(guards);
  assert.equal(rat.entity.health, 94, 'the blow landed on the rat for six, through its own pool\'s door');
  assert.ok(out.includes(g.batch), 'and the watchman who struck it is drawn this frame');
});
