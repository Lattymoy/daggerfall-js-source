// SET2 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md): THE SEAMS THE SETS' POWERS NEED, each a no-op
// until something registers, each proven here with a stand-in registrant. The blow's word that the foe had not noticed me
// (the swing and the shaft read it off the foe's AI, the formula carries it to every blow modifier) - and the port's
// layers under PCAAO's core too, which is ON by default and read neither the weapon's own modifiers nor the blow's, so no
// damage affix and no sigil ever landed in a default game. The player's one damage door's three new says (a modifier, a
// death save, a listener) and where they stay silent. The struck listeners beside the Ring's slot. The player's own kills,
// told from every pool. A player's cast cost, never a foe's. The port's absorption chances under DFU's own gates. The
// door the running host publishes, and the duel's word.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerWeaponBlowMod, registerWeaponDamageMod, weaponBlowMods } from '../src/systems/entityMods.js';
import { calculateAttackDamage, weaponAttackDamage, registerPlayerStruckListener, registerPlayerStrikeListener, registerFormulaOverride, setPlayerStruckHook } from '../src/combat/formulas.js';
import { pcaaoWeaponAttackDamage, pcaaoModules } from '../src/combat/pcaao.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { foeUnaware } from '../src/combat/playerWeapon.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { hurtPlayer, registerPlayerDamageMod, registerPlayerDeathSave, registerPlayerHurtListener, registerPlayerDamageVeto, playerDamageMods } from '../src/characters/playerEntity.js';
import { registerPlayerKillListener, reportPlayerKill } from '../src/systems/playerKills.js';
import { calculateCastCost, registerSpellCostMod, CAST_COST_FLOOR } from '../src/systems/spellcost.js';
import { tryAbsorption, registerAbsorptionChance } from '../src/systems/absorption.js';
import { setPlayerDoor, playerDoor } from '../src/systems/playerDoor.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const me = () => ({ isPlayer: true, level: 5, stats: stats(), skills: new Array(35).fill(40), career: {}, activeEffects: [], items: [], health: 50, maxHealth: 60, magicka: 0, maxMagicka: 100, armorValues: new Array(7).fill(100) });
const rat = () => ({ ...makeEnemyEntity(0, ENEMY_BASICS[0], { ...stats(), attackModifierFlags: 0 }, 5, () => 0.5) });

test('SET2 the blow\'s word: a foe whose AI has not detected me is unaware - never a puppet, never a foe with no AI; the formula carries `unaware` to every blow modifier under DFU\'s core, the swing and the shaft hand it over where the foe record is in hand, and a registered replacement core is handed it too (mutants: the word dropped at the formula; the swing\'s or the shaft\'s word missing; a puppet unaware)', () => {
  assert.equal(foeUnaware({ ai: { detected: false } }), true);
  assert.equal(foeUnaware({ ai: { detected: true } }), false);
  assert.equal(foeUnaware({ ai: { detected: false }, puppet: 'peer-1' }), false, 'a puppet\'s AI is its owner\'s');
  assert.equal(foeUnaware({}), false);
  assert.equal(foeUnaware(null), false);
  const seen = [];
  registerWeaponBlowMod('set2-probe', (w, d, a, t, info) => { seen.push(info?.unaware); return d; });
  try {
    const sword = createWeapon(120, 0, () => 0.5);
    weaponAttackDamage(me(), rat(), 0, sword, () => 0.5, 0, { unaware: true });
    weaponAttackDamage(me(), rat(), 0, sword, () => 0.5);
    assert.deepEqual(seen.splice(0), [true, false], 'the word, and its absence read as aware');
    assert.equal(weaponBlowMods(sword, 10, me(), rat()), 10);
    assert.deepEqual(seen.splice(0), [false], 'no info at all: aware');
    // through the whole formula (a hit forced by the rolls): the option reaches the modifier
    calculateAttackDamage(me(), rat(), { weapon: sword, rolls: () => 0.01, unaware: true });
    assert.ok(seen.includes(true), `calculateAttackDamage hands it down (${seen})`);
  } finally { registerWeaponBlowMod('set2-probe', null); }
  const pw = strip(read('src/combat/playerWeapon.js'));
  assert.match(pw, /calculateAttackDamage\(playerCombat, foe\.entity, \{[^}]*unaware: foeUnaware\(foe\)/, 'the swing\'s word');
  const af = strip(read('src/combat/arrowFlight.js'));
  assert.match(af, /calculateAttackDamage\(playerEntity, foe\.entity, \{[\s\S]*?unaware: foeUnaware\(foe\),[\s\S]*?\}\);/, 'the shaft\'s word');
  const f = strip(read('src/combat/formulas.js'));
  assert.match(f, /core\(attacker, target, \{[^}]*unaware \}\)/, 'a replacement core is handed the word');
});

test('SET2 AUDIT SET M2: the strike tail - every named strike listener told MY attack\'s FINAL damage at a foe, with the weapon, after either core (a replaced core\'s number too); never a miss, a blow at a player, a peer\'s blow resolved here, or a foe\'s; a listener that throws is skipped (mutants: the strike listeners never told; a miss told; a blow at a player told; a peer\'s blow told; a foe\'s blow told)', () => {
  const seen = [];
  const r = rat();
  registerPlayerStrikeListener('set2-strike', (a, t, dmg, w) => { seen.push([a.isPlayer === true, t === r, dmg, w?.templateIndex ?? null]); });
  registerPlayerStrikeListener('set2-throws', () => { throw new Error('a set is not the blow\'s problem'); });
  try {
    const sword = createWeapon(120, 0, () => 0.5);
    let dmg = 0;
    for (let i = 0; i < 20 && !(dmg > 0); i++) dmg = calculateAttackDamage(me(), r, { weapon: sword, rolls: () => 0.01 });
    assert.ok(dmg > 0, `the swing lands (${dmg})`);
    assert.deepEqual(seen.at(-1), [true, true, dmg, 120], 'the final damage, the weapon');
    seen.length = 0;
    assert.equal(calculateAttackDamage(me(), r, { weapon: sword, rolls: () => 0.99 }), 0, 'a miss');
    assert.deepEqual(seen, [], 'a miss tells nothing');
    calculateAttackDamage(me(), { ...me(), isPlayer: true }, { weapon: sword, rolls: () => 0.01 });
    calculateAttackDamage({ ...me(), peer: 'p1' }, r, { weapon: sword, rolls: () => 0.01 });
    calculateAttackDamage(rat(), me(), { rolls: () => 0.01 });
    let foeOnFoe = 0;
    for (let i = 0; i < 20 && !(foeOnFoe > 0); i++) foeOnFoe = calculateAttackDamage(rat(), r, { rolls: () => 0.01 });
    assert.ok(foeOnFoe > 0, 'a foe\'s bite at another foe lands');
    assert.deepEqual(seen, [], 'a blow at a player, a peer\'s blow resolved here, a foe\'s at me or at a foe: nothing');
    registerFormulaOverride('calculateAttackDamage', () => 17);
    try { calculateAttackDamage(me(), r, { weapon: sword, rolls: () => 0.01 }); } finally { registerFormulaOverride('calculateAttackDamage', null); }
    assert.deepEqual(seen, [[true, true, 17, 120]], 'a replaced core\'s final number (PCAAO\'s, after its crits and reductions)');
  } finally { registerPlayerStrikeListener('set2-strike', null); registerPlayerStrikeListener('set2-throws', null); }
  const f = read('src/combat/formulas.js');
  assert.ok(f.indexOf('for (const fn of _playerStrikeListeners.values())') < f.lastIndexOf('return report(damage);'), 'at the tail, before the report');
});

test('SET2 AUDIT L6: a blow modifier that throws is skipped and warned of, and one that answers no number is ignored - the blow and every other modifier stand (a set\'s Cleave reaches a second foe\'s death from here, and a throw aborted the swing that carried it) (mutants: a throw aborting the blow; a NaN kept)', () => {
  const sword = createWeapon(120, 0, () => 0.5);
  const warn = console.warn;
  const warned = [];
  console.warn = (...a) => { warned.push(a.join(' ')); };
  registerWeaponBlowMod('set2-throws', () => { throw new Error('boom'); });
  registerWeaponBlowMod('set2-nan', () => NaN);
  registerWeaponBlowMod('set2-after', (w, d) => d + 1);
  try {
    assert.equal(weaponBlowMods(sword, 10, me(), rat()), 11, 'the throw skipped, the NaN ignored, the next modifier reads the blow');
    assert.deepEqual(warned, ['[entityMods] a blow modifier threw boom']);
  } finally {
    console.warn = warn;
    for (const k of ['set2-throws', 'set2-nan', 'set2-after']) registerWeaponBlowMod(k, null);
  }
  assert.equal(weaponBlowMods(sword, 10, me(), rat()), 10, 'gone with them');
});

test('SET2 PCAAO\'s core reads the port\'s layers at the stock\'s own places - the weapon\'s own modifiers over the roll (a damage affix), the blow modifiers over the whole blow after the enemy-type term (a sigil, a set) with the host\'s word - and PCAAO is on by default (mutants: either layer left out of its core)', () => {
  assert.equal(MOD_SETTINGS.pcaao.keys.Enabled.default && MOD_SETTINGS.pcaao.keys.armorHitFormulaRedone.default, true, 'the redone core is the default one');
  const sword = createWeapon(120, 0, () => 0.5);
  const mods = { ...pcaaoModules(), rolePlayRealismArchery: false };
  const bare = pcaaoWeaponAttackDamage(me(), rat(), 0, 0, sword, () => 0.5, mods);
  registerWeaponDamageMod('set2-roll', (w, d) => d + 10);
  let info = null;
  registerWeaponBlowMod('set2-blow', (w, d, a, t, i) => { info = i; return d * 2; });
  try {
    const both = pcaaoWeaponAttackDamage(me(), rat(), 0, 0, sword, () => 0.5, mods, { unaware: true });
    assert.equal(both, (bare + 10) * 2, `the roll's modifier, then the blow's (${bare} -> ${both})`);
    assert.equal(info?.unaware, true, 'the host\'s word reaches the blow modifier under this core');
  } finally { registerWeaponDamageMod('set2-roll', null); registerWeaponBlowMod('set2-blow', null); }
  const p = strip(read('src/combat/pcaao.js'));
  assert.match(p, /pcaaoWeaponAttackDamage\(attacker, target, damageModifiers, weaponAnimTime, weapon, rolls, modules, \{ unaware: !!unaware \}\)/);
});

test('SET2 the damage door: a registered modifier over the damage before the shield, a death save that leaves a live player at 1 before the guild\'s avoid-death is asked, a listener told what landed - none of them asked on a SetHealth(0) door or a duel\'s blow, and none told when a veto or a shield takes the whole blow; one that throws is skipped (mutants: the modifier after the shield; the save on the SetHealth(0) door; the listener told on a vetoed blow)', () => {
  const told = [];
  registerPlayerDamageMod('set2-half', (e, d) => d / 2);
  registerPlayerDamageMod('set2-throws', () => { throw new Error('skipped'); });
  registerPlayerHurtListener('set2-listen', (e, w) => told.push({ ...w }));
  try {
    const p = me();
    hurtPlayer(p, 20);
    assert.equal(p.health, 40, 'halved');
    assert.deepEqual(told.splice(0), [{ dmg: 10, before: 50, after: 40 }]);
    assert.equal(playerDamageMods(p, 8), 4, 'the modifiers in order, a thrower skipped');
    // the shield pool takes the (halved) blow whole: nothing landed, nobody told
    const s = me(); s.activeEffects.push({ kind: 'shield', shieldRemaining: 100, startingShield: 100, roundsRemaining: 5 });
    hurtPlayer(s, 20);
    assert.equal(s.health, 50);
    assert.equal(s.activeEffects[0].shieldRemaining, 90, 'the shield took the HALVED blow - the modifier stood before it');
    assert.deepEqual(told.splice(0), []);
    // the SetHealth(0) door (drowning) and a duel's blow: no say
    const d = me(); hurtPlayer(d, 20, { bypassShield: true });
    assert.equal(d.health, 30, 'drowning is not halved');
    const u = me(); let spared = 0; hurtPlayer(u, 20, { spare: () => { spared++; } });
    assert.equal(u.health, 30, 'a duel\'s blow is not halved');
    assert.deepEqual(told.splice(0), []);
    // a veto withholds it all
    registerPlayerDamageVeto(() => true);
    const v = me(); hurtPlayer(v, 20);
    assert.equal(v.health, 50);
    registerPlayerDamageVeto(null);
    assert.deepEqual(told.splice(0), []);
  } finally { registerPlayerDamageMod('set2-half', null); registerPlayerDamageMod('set2-throws', null); }
  // the death save
  let asked = 0;
  registerPlayerDeathSave('set2-save', () => { asked++; return true; });
  try {
    const p = me(); p.health = 10;
    assert.equal(hurtPlayer(p, 30), false, 'no death');
    assert.equal(p.health, 1, 'left at one');
    assert.deepEqual(told.splice(0), [{ dmg: 9, before: 10, after: 1 }], 'told as what it did');
    const q = me(); q.health = 40; hurtPlayer(q, 10);
    assert.equal(asked, 1, 'asked only of a blow that would kill');
    const r = me(); r.health = 10; hurtPlayer(r, 30, { bypassShield: true });
    assert.equal(r.health, 0, 'never on a SetHealth(0) door - drowning kills');
  } finally { registerPlayerDeathSave('set2-save', null); registerPlayerHurtListener('set2-listen', null); }
  const src = strip(read('src/characters/playerEntity.js'));
  assert.ok(src.indexOf('dmg = playerDamageMods(entity, dmg)') < src.indexOf('dmg = damageShieldPool(entity, dmg)'), 'the modifiers stand before the shield');
  assert.ok(src.indexOf('playerDeathSaved(entity, dmg)') < src.indexOf('_avoidDeathHook?.(entity)'), 'the save is asked before the guild');
});

test('SET2 the struck listeners: told (attacker, target, damage) when a foe\'s attack resolves with damage on the player, beside the Ring of Namira\'s own slot, which stays its own; a listener that throws is skipped (mutants: the listeners never told)', () => {
  const heard = [];
  let ring = 0;
  setPlayerStruckHook(() => { ring++; });
  registerPlayerStruckListener('set2-struck', (a, t, d) => heard.push([a.careerIndex ?? a.mobileType ?? 'foe', t.isPlayer, d]));
  registerPlayerStruckListener('set2-throws', () => { throw new Error('skipped'); });
  try {
    const foe = rat(), p = me();
    p.armorValues = new Array(7).fill(0);
    let dmg = 0;
    for (let i = 0; i < 40 && !dmg; i++) dmg = calculateAttackDamage(foe, p, { rolls: () => 0.01, dfRand: () => 0 });
    assert.ok(dmg > 0, 'a rat bites');
    assert.ok(heard.length >= 1 && heard.at(-1)[1] === true && heard.at(-1)[2] === dmg, `the listener heard the bite (${JSON.stringify(heard)})`);
    assert.equal(ring, heard.length, 'the Ring heard every one too');
  } finally { setPlayerStruckHook(null); registerPlayerStruckListener('set2-struck', null); registerPlayerStruckListener('set2-throws', null); }
});

test('SET2 the player\'s own kills: every listener told the killed entity and the blow\'s kind; each pool tells it at the moment it marks a foe dead, only for MY blow (never a peer\'s), and a puppet\'s owner\'s word tells it too (mutants: a pool\'s report dropped; a peer\'s kill told as mine)', () => {
  const heard = [];
  registerPlayerKillListener('set2-kill', (e, i) => heard.push([e.name, i.kind]));
  registerPlayerKillListener('set2-throws', () => { throw new Error('skipped'); });
  try {
    reportPlayerKill({ name: 'wolf' }, { kind: 'arrow' });
    reportPlayerKill({ name: 'rat' });
    assert.deepEqual(heard, [['wolf', 'arrow'], ['rat', 'melee']]);
  } finally { registerPlayerKillListener('set2-kill', null); registerPlayerKillListener('set2-throws', null); }
  const ext = strip(read('src/scenes/exteriorFoes.js'));
  assert.match(ext, /f\.dead = true;\s*if \(fromPlayer && !peer\) reportPlayerKill\(f\.entity, \{ kind \}\);/, 'the outdoor pool');
  assert.match(ext, /playerWeaponKillReported\(playerEntity, \{ mobileType: f\.mobileType \}\);\s*reportPlayerKill\(f\.entity, \{ kind: 'remote' \}\);/, 'a puppet\'s owner\'s word');
  assert.match(strip(read('src/scenes/dungeonContext.js')), /foe\.dead = true;\s*if \(fromPlayer && !peer\) reportPlayerKill\(foe\.entity, \{ kind \}\);/, 'the dungeon');
  assert.match(strip(read('src/scenes/cityGuards.js')), /g\.dead = true;\s*if \(fromPlayer && !peer\) reportPlayerKill\(g\.entity, \{ kind: 'melee' \}\);/, 'the watch');
});

test('SET2 a player\'s cast cost: the port\'s modifiers over it after DFU\'s floor, never under 1 - and never over a foe\'s, which the foe caster prices with the player\'s skills and so asks without them (mutants: a foe\'s cast made cheaper; the floor under 1)', () => {
  const spell = { rangeType: 0, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] };
  const p = me();
  const plain = calculateCastCost(spell, p).sp;
  registerSpellCostMod('set2-cost', (e, sp) => sp * 0.5);
  try {
    assert.equal(calculateCastCost(spell, p).sp, Math.max(1, Math.round(plain * 0.5)));
    assert.equal(calculateCastCost(spell, p, { portMods: false }).sp, plain, 'a foe\'s price: none of mine');
    assert.equal(calculateCastCost(spell, { ...p, isPlayer: false }).sp, plain, 'nor any caster that is not the player');
    registerSpellCostMod('set2-cost', () => 0.2);
    assert.equal(calculateCastCost(spell, p).sp, 1, 'never under 1');
    assert.ok(CAST_COST_FLOOR >= 1);
  } finally { registerSpellCostMod('set2-cost', null); }
  assert.match(strip(read('src/characters/enemyCasting.js')), /calculateCastCost\(spell, playerEntity, \{ portMods: false \}\)\.sp/);
});

test('SET2 the port\'s absorption chances: each rolled on its own after the effect\'s arm, under DFU\'s two gates (a Destruction effect, room in the magicka for it); a source answering 0 is never rolled, so the rolls\' sequence is untouched (mutants: the gates skipped for the port\'s chances)', () => {
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 };
  const heal = { ...dmg, type: 10, subType: 8 };
  const target = () => ({ isPlayer: true, career: {}, maxMagicka: 200, magicka: 0, level: 1, skills: new Array(40).fill(50), stats: { intelligence: 50, willpower: 50 }, activeEffects: [] });
  assert.equal(tryAbsorption(dmg, 0, target()), 0, 'nothing registered: nothing absorbed');
  registerAbsorptionChance('set2-eye', (t) => (t.isPlayer ? 100 : 0));
  try {
    assert.ok(tryAbsorption(dmg, 0, target()) > 0, 'a 100% source drinks it');
    assert.equal(tryAbsorption(heal, 0, target()), 0, 'not a heal - DFU\'s school gate');
    assert.equal(tryAbsorption(dmg, 0, { ...target(), magicka: 200 }), 0, 'no room: DFU\'s headroom gate');
    let n = 0;
    assert.equal(tryAbsorption(dmg, 0, { ...target(), isPlayer: false }, { rolls: () => { n++; return 0; } }), 0, 'a source answering 0');
    assert.equal(n, 0, '...is never rolled');
  } finally { registerAbsorptionChance('set2-eye', null); }
});

test('SET2 the door and the duel: the running host publishes its door every frame it updates (its live foes MY harm may reach, my feet, a hurt through the foe\'s own sinks as mine, a spell on me as a potion\'s); the duel frame tells the sets whether a duel stands (mutants: the door never published; a hurt not mine; the duel unsaid)', () => {
  setPlayerDoor(null);
  assert.equal(playerDoor(), null);
  const d = { foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {} };
  setPlayerDoor(d);
  assert.equal(playerDoor(), d);
  setPlayerDoor('not a door');
  assert.equal(playerDoor(), null);
  const hm = strip(read('src/scenes/hostMagic.js'));
  assert.match(hm, /function update\(dt, playerFeet[^)]*\) \{\s*_doorFeet = playerFeet \?\? null;\s*setPlayerDoor\(_door\);/, 'published first thing each frame');
  assert.match(hm, /hurtFoe: \(t, n\) => \{ if \(t && !t\.dead && n > 0\) foeSinks\(t, true\)\?\.hurt\?\.\(Math\.round\(n\), \{ fromPlayer: true \}\); \}/, 'a hurt is mine, through the foe\'s own sinks');
  assert.match(hm, /castOnPlayer: \(bundle\) => \{ if \(bundle\) applySpellToPlayer\(bundle, playerEntity\.level \?\? 1, null, \{ bypassSavingThrows: true, bypassChance: true \}\); \}/);
  assert.match(hm, /foes: \(\) => playerTargets\(\)\.filter/, 'the foes MY harm may reach - the defenders passed by');
  assert.match(strip(read('src/scenes/world.js')), /const duelFrame = \(\) => \{\s*duelMgr\.tick\(\);\s*const setsWere = setsDueling\(\);\s*setSetsDueling\(!!duelMgr\.live\);/);
});
