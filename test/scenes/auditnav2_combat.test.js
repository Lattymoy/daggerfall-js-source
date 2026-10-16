// AUDIT NAV2 (combat) - the naval second pass's deep audit, its friend-and-foe lens: who the player's own harm and his
// crew's own harm may reach, through the doors a boarding fight actually opens.
//
//   F54  A failed pickpocket (Steal mode) on one of the player's own hands ran only the motor half of
//        MakeEnemyHostileToAttacker: his target became the player and his team stayed PlayerAlly, so he was still a
//        shipmate - he beat the player while the swing, the shaft and the spell all passed through him. A shipmate is
//        no mark (the arm refuses him); any other ally that catches the player's hand is reverted - that call's player
//        arm IS the ally revert - and is fair game.
//   F55  A worn Vampiric Effect (At Range) drained every body within 2.25 m through the world's foe sink at the
//        player's provenance: a shipmate beside him was drained and turned on him, and a prize's yielded men were
//        un-surrendered (the drain woke the area). DFU's VampiricEffect writes CurrentHealth and raises no attack; the
//        spared are passed by; and the encounter pool's damage door itself refuses a shipmate the player's harm.
//   F56  A crewman's AreaAroundCaster spell struck the player and his mates: the cast executor's caster wrapper carried
//        no foe, so the one engine could not tell the blast was a crewman's.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { liveEnchantFoes, liveEnchantFoeSinks, sensesContext } from '../../src/scenes/shared.js';
import { makeEnemiesHostile } from '../../src/scenes/hostCombat.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { enchantmentMagicRound, ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';
import { activateMobileEnemy } from '../../src/player/mobileEnemyActivate.js';
import { PICKPOCKET_DISTANCE } from '../../src/player/activate.js';
import { castEnemySpell } from '../../src/characters/enemy/enemyCasting.js';
import { PLAYER_TARGET, staticTeamOf } from '../../src/characters/enemy/enemyTargets.js';
import { isShipmate, sparedByPlayer } from '../../src/combat/friendlyFire.js';
import { resetToDefaults } from '../../src/systems/settings/settings.js';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
/** One line of world.js's from its start (test/systems/naval/deckwalk.test.js's own way). */
const line = (start) => { const i = WORLD.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
/** world.js's `const foeSinks = (g, fromPlayer = true) => ({ ... });`, lifted whole and bound to a pool. */
function worldFoeSinks(exteriorFoes, player, cityGuards) {
  const i = WORLD.indexOf('  const foeSinks = (g, fromPlayer = true) => ({');
  assert.ok(i >= 0, 'world.js\'s foe sinks lifted');
  const src = WORLD.slice(i, WORLD.indexOf('\n  });\n', i) + 6);
  // eslint-disable-next-line no-new-func
  return new Function('exteriorFoes', 'player', 'cityGuards', 'maxFatigue', `${src}\n return foeSinks;`)(exteriorFoes, player, cityGuards, () => 100);
}
/** world.js's enchant pool and its membership router (the live mode above ground), lifted line by line. */
function worldEnchantDoors(exteriorFoes, cityGuards, foeSinks) {
  const src = ['  const _mode = () => ', '  const _insidePool = () => ', '  const enchantFoes = () => ', '  const enchantFoeSinks = (f, fromPlayer = true) => '].map(line).join('');
  // eslint-disable-next-line no-new-func
  return new Function('modes', 'exteriorFoes', 'cityGuards', 'foeSinks', 'liveEnchantFoes', 'liveEnchantFoeSinks', `${src} return { enchantFoes, enchantFoeSinks };`)(
    null, exteriorFoes, cityGuards, foeSinks, liveEnchantFoes, liveEnchantFoeSinks);
}

// ── the real exterior foe pool (test/systems/naval/deckwalk.test.js's, over the crafted MONSTER.BSA and CLASS cfgs) ─────────────

function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ isPlayer: true, level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
/** The pool, with the player's hurts kept (`hurtMe`) and the area's wake wired to its own foes, as the world wires it
 *  (`makeAreaHostile: _makeEnemiesHostile` - the whole live database). */
function foesPool({ rolls = () => 0.01 } = {}) {
  const hurtMe = [];
  const pe = playerEntity();
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe, audio: null, onPlayerHurt: (d) => hurtMe.push(d), rolls, rand: () => 0.01,
    makeAreaHostile: () => makeEnemiesHostile(pool.foes),
  });
  return { pool, pe, hurtMe };
}
/** `seconds` of the pool's own update with the world's senses (the shared candidate list), the player standing still;
 *  `each` is asked after every frame. */
function run(pool, pe, feet, seconds, each = () => {}) {
  const eye = [feet[0], feet[1] + 1.6, feet[2]];
  let t = 0;
  for (let i = 0; i < seconds * 30; i++) {
    pool.update(1 / 30, feet, eye, sensesContext(pe, t / 60, { candidates: () => pool.foes.filter((f) => !f.dead && !f.puppet), playerEntity: pe }));
    t += 1 / 30;
    each();
  }
}
/** A hand of the player's standing on a deck (the world's registry, DECK-WALK), up and fighting. */
async function hand(pool, at, deck = {}) {
  const f = await pool.spawnFoe(144, at, { feetGiven: true, loose: true, transient: true, allied: true, yaw: Math.PI });
  f.deckBoat = deck;
  f.ai.isHostile = true;
  return f;
}
/** A thief with no skill at all: the pickpocket's roll fails. */
const clumsy = (pe) => ({ ...pe, skills: new Array(40).fill(0), level: 1, stats: { agility: 1, luck: 1 } });

// ── F54: the pickpocket ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F54 A SHIPMATE IS NO MARK: Steal mode on one of the player\'s own hands on a deck is refused - the activation consumed, nothing rolled, no line at any range, no attempt spent, no room turned; with a roll that would have failed, he never turns - in 20 s of the pool\'s own update his target is never the player and he never strikes him; Info still names him (mutants: the refusal unread, the refusal after the roll, the refusal under the distance line)', async () => {
  resetToDefaults();
  const { pool, pe, hurtMe } = foesPool({ rolls: () => 0.5 });
  const feet = [100, 0, 98.8];
  const crewman = await hand(pool, [100, 0, 100]);
  assert.equal(crewman.entity.isClass, true, 'a hand is a class enemy - a mark the arm would try');
  assert.equal(isShipmate(crewman), true);
  const said = [];
  let rolled = 0, walked = 0;
  const deps = {
    hud: (t) => said.push(t), modal: (t) => said.push(t), midScreen: (t) => said.push(t),
    makeEnemiesHostile: () => { walked++; makeEnemiesHostile(pool.foes); }, playerFeet: feet,
    rolls: () => { rolled++; return 0.999; },   // a roll that fails
  };
  assert.equal(activateMobileEnemy(crewman, PICKPOCKET_DISTANCE + 5, 'steal', clumsy(pe), deps), true, 'out of reach: consumed');
  assert.equal(activateMobileEnemy(crewman, 1.2, 'steal', clumsy(pe), deps), true, 'in reach: consumed - he was the ray\'s hit');
  let turned = 0;
  run(pool, pe, feet, 20, () => { if (crewman.ai.target === PLAYER_TARGET) turned++; });
  assert.deepEqual({ turned, struck: hurtMe.length }, { turned: 0, struck: 0 }, 'in 20 s his target is never the player, and he never strikes him');
  assert.equal(crewman.entity.team, 'PlayerAlly');
  assert.equal(isShipmate(crewman), true, 'still the player\'s hand');
  assert.deepEqual(said, [], 'no line: not the result, and not "too far away" either');
  assert.equal(rolled, 0, 'nothing rolled');
  assert.equal(crewman.entity.pickpocketAttempted, undefined, 'no attempt spent on him');
  assert.equal(walked, 0, 'no room turned');
  const seen = [];
  activateMobileEnemy(crewman, 1.2, 'info', pe, { hud: (t) => seen.push(t) });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^You see an? /, 'Info still names him');
});

test('AUDIT NAV2 F54 ANY OTHER ALLY IS FAIR GAME: an ally of the player\'s ashore (no deck - a summoned daedra\'s like) whose purse the player fails at turns on him in DFU\'s order, and MakeEnemyHostileToAttacker\'s player arm is the ally revert: his species\' own team again (the static row\'s), hostile, the player his target - no longer spared by any door; a lift that succeeds reverts no one (mutants: the revert dropped, the revert out of the failure arm)', async () => {
  resetToDefaults();
  const { pool, pe } = foesPool({ rolls: () => 0.5 });
  const feet = [100, 0, 98.8];
  const ally = await hand(pool, [100, 0, 100], null);
  assert.equal(isShipmate(ally), false, 'an ally, but no shipmate: no deck under him');
  const said = [];
  activateMobileEnemy(ally, 1.2, 'steal', clumsy(pe), { hud: (t) => said.push(t), modal: (t) => said.push(t), makeEnemiesHostile: () => makeEnemiesHostile(pool.foes), playerFeet: feet, rolls: () => 0.999 });
  assert.deepEqual(said, ['You are not successful.']);
  assert.equal(ally.ai.target, PLAYER_TARGET, 'he turns on the player (the motor\'s half)');
  assert.equal(ally.ai.isHostile, true);
  assert.equal(ally.entity.team, staticTeamOf(144), 'and his species\' team again (the entity\'s half) - EnemyBasics\' static row');
  assert.notEqual(ally.entity.team, 'PlayerAlly');
  assert.equal(sparedByPlayer(ally), false, 'fair game');
  // a lift that works turns no one
  const other = await hand(pool, [102, 0, 100], null);
  const sly = { ...pe, level: 30, skills: new Array(40).fill(100), stats: { agility: 100, luck: 100 } };
  const out = [];
  activateMobileEnemy(other, 1.2, 'steal', sly, { hud: (t) => out.push(t), modal: (t) => out.push(t), makeEnemiesHostile: () => makeEnemiesHostile(pool.foes), playerFeet: feet, rolls: () => 0.01 });
  assert.equal(out.length, 1);
  assert.notEqual(out[0], 'You are not successful.', `a lift: ${out[0]}`);
  assert.equal(other.entity.team, 'PlayerAlly', 'no revert for a purse the player got away with');
  assert.notEqual(other.ai.target, PLAYER_TARGET);
});

// ── F55: the vampiric drain ─────────────────────────────────────────────────────────────────────────────────────

/** A worn ring of Vampiric Effect, At Range (param 0). */
const vampire = (pe) => ({ ...pe, health: 20, maxHealth: 50, items: [{ name: 'Ring', templateIndex: 135, group: 4, currentCondition: 100, maxCondition: 100, equipSlot: 9, enchantments: [{ type: T.VampiricEffect, param: 0 }] }] });

test('AUDIT NAV2 F54 NO SPARED ONE IS A MARK: a town\'s defender (DISC19) whose purse the player fails at turned on the player while every harm of theirs still passed him by (sparedByPlayer) - the shipmate\'s twin; refused as a shipmate is, nothing rolled, nobody turned (mutant: the shipmate alone refused)', async () => {
  resetToDefaults();
  const { pool, pe } = foesPool({ rolls: () => 0.5 });
  const feet = [100, 0, 98.8];
  const guard = await hand(pool, [100, 0, 100], null);
  guard.defender = true;
  assert.equal(isShipmate(guard), false, 'no deck under him');
  assert.equal(sparedByPlayer(guard), true, 'a defender: the player\'s harm passes him by');
  let rolled = 0, walked = 0;
  assert.equal(activateMobileEnemy(guard, 1.2, 'steal', clumsy(pe), { hud: () => {}, modal: () => {}, midScreen: () => {}, makeEnemiesHostile: () => { walked++; }, playerFeet: feet, rolls: () => { rolled++; return 0.999; } }), true, 'consumed');
  assert.deepEqual({ rolled, walked }, { rolled: 0, walked: 0 }, 'nothing rolled, nobody turned');
  assert.notEqual(guard.ai.target, PLAYER_TARGET, 'he never turns on the player');
  assert.equal(sparedByPlayer(guard), true);
});

test('AUDIT NAV2 F55 THE DRAIN IS NO ATTACK, AND PASSES THE SPARED BY: one At Range round of a worn Vampiric Effect through the world\'s own chain (the shared enchant ctx body, world.js\'s enchant pool and membership router, its foe sinks, the pool\'s damage door) drains the pirates inside 2.25 m into the wearer - a yielded man of the prize\'s among them, who stays yielded, and no one across her deck wakes; the shipmate beside the player and a town\'s defender are passed by - health, team and target kept - and pay the wearer nothing (mutants: the rows\' spared unwritten, the rows spare no defender, the rows drop the drain\'s word, the drain\'s skip dropped, the drain the player\'s attack again)', async () => {
  const { pool, pe } = foesPool();
  const player = { pos: [100, 0, 98.8] };
  const crewman = await hand(pool, [100, 0, 100]);   // 1.2 m
  const yielded = await pool.spawnFoe(143, [101.2, 0, 98.8], { feetGiven: true, placed: true, team: 'Criminals' });   // 1.2 m, on her deck
  const across = await pool.spawnFoe(143, [110, 0, 110], { feetGiven: true, placed: true, team: 'Criminals' });   // across her deck
  yielded.ai.isHostile = false; across.ai.isHostile = false;   // navalStandDown: her crew throw down their arms
  const pirate = await pool.spawnFoe(143, [101.5, 0, 99.8], { feetGiven: true, loose: true, transient: true, team: 'Criminals' });   // 1.80 m, fighting on
  const defender = { defender: true, dead: false, mobileType: 180, ai: { feet: [98.5, 0, 98.8], isHostile: true }, entity: { team: 'PlayerAlly', health: 40, maxHealth: 40 } };   // DISC19-F's, 1.5 m
  const guardHurts = [];
  const cityGuards = { guards: [defender], hurtGuard: (g, n) => guardHurts.push([g, n]) };
  const { enchantFoes, enchantFoeSinks } = worldEnchantDoors(pool, cityGuards, worldFoeSinks(pool, player, cityGuards));
  assert.match(WORLD, /\n {6}foes: \(\) => enchantFoes\(\),\n {6}foeSinks: \(f\) => enchantFoeSinks\(f\),\n/, 'world.js mounts the ctx over these two doors');
  const ctx = createEnchantCtx({ playerEntity: pe, spellsByIndex: () => null, now: () => 0, sinks: {}, magic: {}, foes: () => enchantFoes(), foeSinks: (f) => enchantFoeSinks(f), feet: () => player.pos });
  const rows = ctx.nearbyFoes(2.25);
  assert.equal(rows.length, 4, 'the crewman, the yielded man, the pirate and the defender are in reach');
  const before ={ crew: crewman.entity.health, target: crewman.ai.target, yielded: yielded.entity.health, pirate: pirate.entity.health, defender: defender.entity.health };
  const wearer = vampire(pe);
  enchantmentMagicRound(wearer, 4, { ctx });
  // the spared
  assert.equal(crewman.entity.health, before.crew, 'the shipmate is not drained');
  assert.equal(crewman.entity.team, 'PlayerAlly', 'nor turned');
  assert.equal(crewman.ai.target, before.target);
  assert.notEqual(crewman.ai.target, PLAYER_TARGET);
  assert.equal(isShipmate(crewman), true);
  assert.deepEqual(guardHurts, [], 'the defender is passed by');
  assert.equal(defender.entity.health, before.defender);
  // the drained
  assert.equal(pirate.entity.health, before.pirate - 1, 'the pirate is drained');
  assert.equal(yielded.entity.health, before.yielded - 1, 'the yielded man in reach is drained too');
  assert.equal(yielded.ai.isHostile, false, 'and stays yielded - a drain is no attack');
  assert.equal(across.ai.isHostile, false, 'no one across her deck wakes');
  assert.equal(wearer.health, 22, 'the wearer takes one from each drained body, and none from the spared');
  assert.deepEqual(rows.map((r) => r.spared === true).sort(), [false, false, true, true], 'the spared rows say so: the shipmate and the defender');
});

test('AUDIT NAV2 F55 THE DOOR ITSELF: whatever road a harm of the player\'s takes to the encounter pool\'s damage door, a shipmate takes none of it - the world\'s foe sink at its default provenance and the door direct land nothing on him and turn no one; a foe\'s own harm through the same door still lands, and he stays the player\'s (mutants: the guard dropped, the guard deaf to provenance, the guard deaf to a peer)', async () => {
  const { pool } = foesPool();
  const player = { pos: [100, 0, 98.8] };
  const crewman = await hand(pool, [100, 0, 100]);
  const sinks = worldFoeSinks(pool, player, { guards: [], hurtGuard() {} });
  const hp = crewman.entity.health;
  sinks(crewman).hurt(5);   // the player's (fromPlayer defaulting true)
  pool.damageFoe(crewman, 4, player.pos);   // a blow of the player's, at the door
  assert.equal(crewman.entity.health, hp, 'none of the player\'s harm lands');
  assert.equal(crewman.entity.team, 'PlayerAlly', 'none turns him');
  assert.notEqual(crewman.ai.target, PLAYER_TARGET);
  sinks(crewman, false).hurt(3);   // a foe's spell over him
  crewman.hurtFromFoe(2);   // a pirate's blow
  assert.equal(crewman.entity.health, hp - 5, 'a foe\'s harm still lands');
  assert.equal(crewman.entity.team, 'PlayerAlly');
  assert.notEqual(crewman.ai.target, PLAYER_TARGET);
  assert.equal(isShipmate(crewman), true);
  // a PEER's blow is the peer's own law - its reader stands my crew as its own (the foes frame's `cw`) and its doors
  // pass them by; one that arrives anyway is mine to land, as a raid's defender takes one (cityGuards' damageGuard)
  pool.damageFoe(crewman, 1, null, null, { peer: true, peerId: 'mmm-0002' });
  assert.equal(crewman.entity.health, hp - 6, 'the guard is this player\'s harm alone');
  assert.equal(crewman.entity.team, 'PlayerAlly', 'and a peer\'s blow reverts no ally of mine (AUDIT WORLD2 B9\'s law)');
});

// ── F56: a crewman's blast ──────────────────────────────────────────────────────────────────────────────────────

const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const aura = { name: 'Aura', index: 90, element: 4, rangeType: 3, effects: [fx(4, 0), EMPTY, EMPTY] };   // AreaAroundCaster, Damage Health
const body = (id, feet, team, deck = true) => ({
  id, ai: { feet, height: 1.8, centreOffset: 0.9, isHostile: true }, dead: false, deckBoat: deck ? {} : null,
  entity: { health: 100, maxHealth: 100, level: 5, magicka: 500, maxMagicka: 500, team, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, activeEffects: [], skills: new Array(40).fill(50) },
});
/** The one engine (hostMagic.createPlayerMagic) over `foes`, with the player's hurts and every foe's kept. */
function engine(foes) {
  const hurt = [], mine = [];
  const player = { isPlayer: true, level: 4, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const foeSinks = (f) => ({ hurt: (n) => hurt.push([f.id, n]), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} });
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: player,
    playerSinks: { hurt: (n) => mine.push(n), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => foes, foeSinks, absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.5, startCastAnim: null,
  });
  return { magic, hurt, mine, player, foeSinks };
}
/** A foe's cast through the one executor (characters/enemy/enemyCasting.js castEnemySpell), as exteriorFoes.castSpellFrom
 *  hands it the engine's blast. */
const cast = (e, f, spell, playerFeet) => castEnemySpell(f, spell, {
  noSpellPointCost: true, playerEntity: e.player, playerFeet, playerHeight: 1.8,
  applySpell: () => {}, foeSinks: e.foeSinks, calculateCastCost: () => ({ sp: 0 }), silenceBlocksCast: () => false,
  explodeAt: (...a) => e.magic.explodeAt(...a), fireMissile: () => {}, rolls: () => 0.5,
});
const struck = (hurt) => [...new Set(hurt.map(([id]) => id))].sort();

test('AUDIT NAV2 F56 A CREWMAN\'S BLAST: his AreaAroundCaster spell, loosed by the one cast executor into the one engine, strikes the pirate in it and passes the player (1.5 m off) and his mate beside him by - the executor\'s caster wrapper carries its foe, which is what the engine asks; a pirate\'s own blast still strikes the crew and the player (mutants: the wrapper\'s foe dropped)', () => {
  const caster = body('crewCaster', [0, 0, 0], 'PlayerAlly'), mate = body('mate', [1, 0, 0], 'PlayerAlly'), pirate = body('pirate', [0, 0, 2], 'Criminals');
  assert.equal(isShipmate(caster), true);
  const e = engine([caster, mate, pirate]);
  assert.equal(cast(e, caster, aura, [-1.5, 0, 0]), true);
  assert.deepEqual(struck(e.hurt), ['pirate'], 'the pirate alone: the caster (DoAreaOfEffect\'s ignoreCaster) and his mate passed by');
  assert.deepEqual(e.mine, [], 'the player untouched');
  // the law is the crew's, not every caster's
  const foeCaster = body('pirateCaster', [0, 0, 0], 'Criminals'), hand = body('hand', [1, 0, 0], 'PlayerAlly');
  const p = engine([foeCaster, hand]);
  cast(p, foeCaster, aura, [-1.5, 0, 0]);
  assert.deepEqual(struck(p.hurt), ['hand'], 'a pirate\'s blast strikes the crew');
  assert.ok(p.mine.length > 0, 'and the player');
});
