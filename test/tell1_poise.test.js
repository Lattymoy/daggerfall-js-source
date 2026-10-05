// TELL1 - POISE AND THE STAGGER (bible/12-Enhanced-AI/Feud-Arc.md section 3; Mac, 2026-10-04: "player's can easily stun
// these enemies and breath more depth into it", then "Go" on every call). Before it, any landed blow broke any
// telegraphed wind-up for free (the knock it wrote broke it). Now a foe winding up HOLDS through a blow - no shove, no
// Hurt - and the blow's weight fills its poise meter; past its poise the wind-up breaks and the foe is STAGGERED.
// The law (the table, the classes, the weights); every health multiplier writing what it stood (`healthMult`); the brain
// on the real motor (hold, break, stagger, the token, the cooldown, no stunlock, a paralysis still breaks, the switch
// off); the formulas' tail and a spell's landing taking a quarter more from a staggered foe; THE REAL STREET POOL (a
// hold writes no shove, a stagger writes the breaking blow's shove half again, a foe not winding up keeps DFU's); the
// foe-vs-foe payload; the watch's and the dungeon's doors, the hosts' Hurt, the spell rounds and the arrows' kinds.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { enemyWeightClassicUnits, weaponKnockbackSpeed, calculateAttackDamage } from '../src/combat/formulas.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, windupHolds, windupStruck, staggeredNow, tokensOut, LOCAL_TARGET } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, BLOW_COOLDOWN_MIN } from '../src/ai/foeBlows.js';
import { TELL, weightClass, kindHealth, poiseSpecial, poiseOf, staggerSeconds, blowK, behind, blowWeight } from '../src/ai/tells.js';
import { blowTaken, blowTakenScale, blowTakenNames } from '../src/systems/blowTaken.js';
import { promoteEliteFoe } from '../src/systems/eliteFoes.js';
import { applyChampion } from '../src/systems/champions.js';
import { applyDamageToNonPlayer, windupDoor } from '../src/scenes/hostCombat.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL1: the table is the arc\'s section 27 (mutants: any number moved)', () => {
  assert.deepEqual({ ...TELL, POISE_W: { ...TELL.POISE_W }, STAGGER_S: { ...TELL.STAGGER_S }, PUNISH_S: { ...TELL.PUNISH_S }, CHAIN_NEXT: { ...TELL.CHAIN_NEXT }, COOLDOWN: { ...TELL.COOLDOWN } }, {
    POISE_W: { light: 0.2, medium: 0.3, heavy: 0.4, massive: 0.5 },
    WEIGHT_MEDIUM: 200, WEIGHT_HEAVY: 700, WEIGHT_MASSIVE: 1500, POISE_FLOOR_MASSIVE: 60,   // PIN MOVED (AUDIT TELL: the duel harness's floor)
    POISE_ELITE: 1.5, POISE_ELITE_DUNGEON: 1.25, POISE_CHAMPION: 1.25, POISE_STALWART: 1.5, POISE_REVENANT_RANK: 0.1,
    K_BLUNT: 1.5, K_AXE: 1.25, K_LONG_BLADE: 1.0, K_SHORT_BLADE: 0.7, K_HANDS: 0.6, K_CLAWS: 1.0, K_TWO_HANDED: 1.15,
    K_ARROW: 0.5, K_SPELL: 0.75, K_PEER: 1, POISE_BACK: 1.5, BACK_DEG: 110, POISE_WEAK: 2,
    STAGGER_S: { light: 1.4, medium: 1.2, heavy: 1.0, massive: 0.8 },
    STAGGER_KNOCK: 1.5, STAGGER_TAKEN: 1.25, STAGGER_IMMUNE: 3,
    GLINT_PULSE: 0.9, GLINT_PULSE_S: 0.15, GLINT_STEADY: 0.2, TELL_NOW: 0.2, GLINT_REDUCED: 0.45, RELEASE_LEAD: 0.25,
    WIND_PITCH: 0.85, WIND_CLASS_PITCH: 0.6, WIND_CLASS_VOLUME: 0.6, RELEASE_PITCH: 0.45, NEAR_M: 6, NEAR_FLOOR: 0.6,
    IRON_SHAPES: ['slam', 'ring'], IRON_ELITE: 1 / 3, IRON_EXTRA: 0.2,
    PUNISH_S: { lunge: 1.0, sweep: 0.8, slam: 1.2, ring: 1.0, charge: 1.4, leap: 1.2 }, PUNISH_IRON: 0.3, PUNISH_TAKEN: 1.3,
    TELL_LATE: 0.25, PERFECT_WINDOW: 1.5, PERFECT_PITCH: 1.25,
    WINDUP_VARY: [0.9, 1.25], WINDUP_ELITE: 0.9, WINDUP_RANK: 0.03, TELL_MIN_WINDUP: 0.55, TRACKERS: ['lunge', 'charge'],
    TRACK_RATE: 120, TRACK_SHARE: 0.5, FEINT_CHANCE: 1 / 5, FEINT_AT: 0.55, FEINT_GAP: 3, FEINT_FADE: 0.15,
    CHAIN_CHANCE: 0.35, CHAIN_WINDUP: 0.5, CHAIN_FLOOR: 0.45, CHAIN_GAP: 0.15,
    CHAIN_NEXT: { sweep: 'lunge', lunge: 'sweep', slam: 'sweep', ring: 'slam' },
    COOLDOWN: { ordinary: [8, 15], champion: [7, 13], elite: [6, 11] }, COOLDOWN_RANK: 0.08,
    AIMED_SHARE: 1 / 3,
  });
});

test('TELL1: the weight classes, by DFU\'s own weight - a rat light, an orc and a man medium, a grizzly heavy, a giant massive', () => {
  assert.deepEqual([199, 200, 699, 700, 1499, 1500].map(weightClass), ['light', 'medium', 'medium', 'heavy', 'heavy', 'massive']);
  const w = (t) => enemyWeightClassicUnits(t >= 128, 'male', ENEMY_BASICS[t]?.weight ?? 0, []);
  assert.equal(weightClass(w(M.Rat)), 'light');
  assert.equal(weightClass(w(M.SkeletalWarrior)), 'light');
  assert.equal(weightClass(w(M.Orc)), 'medium');
  assert.equal(weightClass(w(M.Warrior)), 'medium', 'a man at 350');
  assert.equal(weightClass(enemyWeightClassicUnits(true, 'female', 0, [])), 'medium', 'a woman at 240');
  assert.equal(weightClass(w(M.GrizzlyBear)), 'heavy');
  assert.equal(weightClass(w(M.DaedraLord)), 'heavy');
  assert.equal(weightClass(w(M.Giant)), 'massive');
  assert.equal(weightClass(NaN), 'light');
  assert.deepEqual([600, 1000, 3000, 2].map(staggerSeconds), [1.2, 1.0, 0.8, 1.4]);
});

test('TELL1: poise - the kind\'s own health by its weight, by what it is (an elite, an Elite Dungeon\'s, a champion, a Stalwart, a revenant by rank)', () => {
  assert.equal(poiseOf({ maxHealth: 100 }, 600), 30);
  assert.equal(poiseOf({ maxHealth: 200 }, 3000), 100);   // PIN MOVED (AUDIT TELL, the duel harness): a massive one's at least POISE_FLOOR_MASSIVE
  assert.equal(poiseOf({ maxHealth: 100 }, 3000), 60, 'a massive one of 100: 50 under the floor, 60');
  assert.equal(poiseOf({ maxHealth: 100, eliteFoe: true, healthMult: 1 }, 3000), 90, 'the floor, then what it is');
  assert.equal(poiseOf({ maxHealth: 100 }, 2), 20);
  assert.equal(kindHealth({ maxHealth: 500, healthMult: 5 }), 100, 'an elite\'s x5 taken off');
  assert.equal(kindHealth({ maxHealth: 0 }), 1);
  assert.equal(poiseSpecial({ eliteFoe: true }), 1.5);
  assert.equal(poiseSpecial({ elite: true }), 1.25);
  assert.equal(poiseSpecial({ eliteFoe: true, elite: true }), 1.5, 'an elite in an Elite Dungeon is an elite');
  assert.equal(poiseSpecial({ champion: 'mighty' }), 1.25);
  assert.equal(poiseSpecial({ champion: 'stalwart' }), 1.5);
  assert.ok(Math.abs(poiseSpecial({ revenant: { rank: 3 } }) - 1.3) < 1e-12);
  assert.equal(poiseSpecial(null), 1);
  assert.equal(poiseOf({ maxHealth: 500, healthMult: 5, eliteFoe: true }, 600), 45, 'an elite orc of 100: 100 x 0.3 x 1.5');
});

test('TELL1: every multiplier of a foe\'s health writes what it stood - an elite, an Elite Dungeon\'s elite, a champion, a revenant, the dungeon\'s doubling, a rite\'s summoner, a sworn one (mutants: a site that forgets it)', async () => {
  const e = { maxHealth: 40, health: 40, level: 12, mobileType: M.Orc };
  assert.equal(promoteEliteFoe(e, { checkLevel: false }), true);
  assert.equal(e.healthMult, 5); assert.equal(kindHealth(e), 40);
  const ed = { maxHealth: 40, health: 40, level: 12, mobileType: M.Orc };
  promoteEliteFoe(ed, { checkLevel: false, eliteDungeon: true });
  assert.equal(ed.healthMult, 7);
  const puppet = { maxHealth: 200, health: 200, level: 12, mobileType: M.Orc };
  promoteEliteFoe(puppet, { own: false });
  assert.equal(puppet.healthMult, undefined, 'a puppet\'s maximum is its owner\'s word - nothing stood here');
  setPref('lootRarity', true);
  const c = { maxHealth: 40, health: 40, level: 12, mobileType: M.Orc };
  assert.equal(applyChampion(c, 1), true, 'Stalwart');
  assert.equal(c.healthMult, 3); assert.equal(kindHealth(c), 40);
  setPref('lootRarity', false);
  const rv = await import('../src/systems/revenant.js');
  const r = { id: 'x', name: 'Grushnak the Butcher', rank: 2, returns: 0, history: [] };
  const re = { maxHealth: 40, health: 40 };
  rv.applyRevenant(re, r, { now: 0 });
  assert.equal(re.healthMult, 1.5); assert.equal(kindHealth(re), 40);
  assert.match(rd('src/scenes/dungeonContext.js'), /entity\.maxHealth = Math\.max\(1, Math\.round\(entity\.maxHealth \* ELITE_HEALTH_SCALE\)\);\n\s*entity\.health = entity\.maxHealth;\n\s*entity\.healthMult = \(entity\.healthMult \?\? 1\) \* ELITE_HEALTH_SCALE;/);
  assert.match(rd('src/scenes/riteHost.js'), /f\.entity\.healthMult = \(f\.entity\.healthMult \?\? 1\) \* RITE_SUMMONER_HEALTH;/);
  assert.match(rd('src/systems/revenantCompanions.js'), /entity\.healthMult = \(entity\.healthMult \?\? 1\) \* \(1 \+ REVENANT_HEALTH_PER_RANK \* rank\);/);
});

test('TELL1: a blow\'s class - blunt, axe, long blade, short blade, hands, claws, two-handed on top, an arrow, a spell\'s landing (its round nothing), a peer\'s, nothing else', () => {
  const wpn = (t) => ({ group: 'Weapons', templateIndex: t, material: 0 });
  assert.equal(blowK({ weapon: wpn(WEAPONS.Mace) }), 1.5);
  assert.ok(Math.abs(blowK({ weapon: wpn(WEAPONS.Warhammer) }) - 1.5 * 1.15) < 1e-12, 'a two-handed hammer');
  assert.equal(blowK({ weapon: wpn(WEAPONS.Battle_Axe) }), 1.25, 'the battle axe one-handed (DFU\'s hands table)');
  assert.ok(Math.abs(blowK({ weapon: wpn(WEAPONS.War_Axe) }) - 1.25 * 1.15) < 1e-12, 'the war axe two-handed');
  assert.ok(Math.abs(blowK({ weapon: wpn(WEAPONS.Flail) }) - 1.5 * 1.15) < 1e-12, 'the flail two-handed');
  assert.equal(blowK({ weapon: wpn(WEAPONS.Longsword) }), 1.0);
  assert.ok(Math.abs(blowK({ weapon: wpn(WEAPONS.Claymore) }) - 1.15) < 1e-12);
  assert.equal(blowK({ weapon: wpn(WEAPONS.Dagger) }), 0.7);
  assert.equal(blowK({ weapon: wpn(WEAPONS.Long_Bow) }), 0.5, 'a shaft a foe loosed carries its bow');
  assert.equal(blowK({}), 0.6, 'bare hands');
  assert.equal(blowK({ claws: true }), 1.0, 'claws');
  assert.equal(blowK({ kind: 'arrow', weapon: wpn(WEAPONS.Warhammer) }), 0.5);
  assert.equal(blowK({ kind: 'spell' }), 0.75);
  assert.equal(blowK({ kind: 'spell', round: true }), 0, 'a later round');
  assert.equal(blowK({ peer: true, weapon: wpn(WEAPONS.Dagger) }), 1, 'a peer\'s relayed blow, its class unknown');
  assert.equal(blowK({ kind: 'fall' }), 0);
});

test('TELL1: from behind - more than 110 degrees off the locked facing; the weight is its damage by its class, half again from behind, double its weakness', () => {
  const o = [0, 0, 0];
  assert.equal(behind(o, 0, [0, 0, 2]), false, 'ahead');
  assert.equal(behind(o, 0, [2, 0, 0]), false, 'beside');
  assert.equal(behind(o, 0, [0, 0, -2]), true, 'behind');
  const a = 115 * Math.PI / 180;
  assert.equal(behind(o, 0, [Math.sin(a) * 2, 0, Math.cos(a) * 2]), true, '115 degrees off');
  const b = 105 * Math.PI / 180;
  assert.equal(behind(o, 0, [Math.sin(b) * 2, 0, Math.cos(b) * 2]), false, '105 degrees off');
  assert.equal(behind(o, Math.PI, [0, 0, 2]), true, 'facing -z, a blow from +z is behind');
  assert.equal(behind(o, 0, o), false); assert.equal(behind(null, 0, o), false);
  assert.equal(blowWeight(10, 1.5), 15);
  assert.equal(blowWeight(10, 1.5, { back: true }), 22.5);
  assert.equal(blowWeight(10, 1, { weak: true }), 20);
  assert.equal(blowWeight(0, 1.5), 0); assert.equal(blowWeight(10, 0), 0);
});

// ── the brain, on the real motor ────────────────────────────────────

function foe({ level = 12, mobileType = M.Orc, at = [0, 0, 8], health = 100 } = {}) {
  const c = new Collider(() => 0);
  const ent = { health, maxHealth: health, mobileType, level };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent, c, mobileType, gender: 'male', entity: ent };
}
function run(foes, secs, player, each = null, paralyzed = false) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) { f.ai.update(DT, player, null, paralyzed); f.atk.update(DT, f.ai, player); }
    each?.(s);
  }
}
function untilWindup(foes, f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(foes, DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}
const ORC_W = 600;   // a bare orc: medium

test('TELL1: a blow under its poise HOLDS - the wind-up stands, fills, and lands where it was aimed (mutants: the meter never fills; a hold breaks)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup([f], f, player);
  assert.ok(blow, 'it wound one up');
  assert.equal(windupHolds(f.ai), true);
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 29.9), 'hold', 'under 30 (100 x 0.3)');
  assert.equal(blow.poise, 30, 'its poise, set at the first blow');
  assert.ok(Math.abs(blow.taken - 29.9) < 1e-9);
  assert.equal(liveBlows().get(f.ai), blow, 'still on the ground');
  let verdict = null;
  run([f], 1.5, player, () => { if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict; });
  assert.equal(verdict, true, 'it landed - the hold did not break it');
  assert.equal(windupHolds(f.ai), false, 'landed, no wind-up holds');
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 999), null, 'and a blow now is DFU\'s');
});

test('TELL1: at its poise the wind-up BREAKS and it is STAGGERED - mark gone, cooldown begun, token handed on, nothing decided for its weight\'s seconds, standing, then the beat after a blow (mutants: no stagger; a stagger of the wrong length; the token kept; no cooldown)', () => {
  const f = foe();
  const other = foe({ at: [8, 0, 0] });
  other.ai.collider = f.ai.collider;
  const player = [0, 0, 0];
  assert.ok(untilWindup([f, other], f, player));
  const held = tokensOut(LOCAL_TARGET, 'melee');
  assert.ok(held >= 1);
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 20), 'hold');
  const t0 = T;
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 10), 'stagger', '20 + 10 reaches 30');
  assert.equal(liveBlows().has(f.ai), false, 'the mark is gone');
  assert.equal(f.ai._tac.state, 'staggered');
  assert.ok(f.ai._tac.blowReady >= t0 + BLOW_COOLDOWN_MIN, 'the blow\'s cooldown begun');
  assert.ok(tokensOut(LOCAL_TARGET, 'melee') < held, 'its token handed on');
  assert.equal(f.ai.staggerUntil, t0 + 1.2, 'a medium foe, 1.2 s');
  assert.equal(f.ent.staggerUntil, t0 + 1.2);
  assert.equal(staggeredNow(f.ent), true);
  const at = [...f.ai.feet];
  let acted = false, moved = 0, wound = false, swung = f.atk.swingSeq;
  run([f], 1.15, player, () => {
    if (f.ai.canAct !== false) acted = true;
    if (!f.ai.staggered) acted = true;
    moved = Math.max(moved, Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]));
    if (f.ai._tac?.state === 'windup') wound = true;
  });
  assert.equal(acted, false, 'it could do nothing through its stagger');
  assert.ok(moved < 0.02, `it stood (${moved.toFixed(3)})`);
  assert.equal(wound, false);
  assert.equal(f.atk.swingSeq, swung, 'no swing');
  run([f], 0.2, player);
  assert.equal(f.ai.staggered, false, 'over');
  assert.equal(staggeredNow(f.ent), false);
  assert.equal(f.ai.canAct, true);
  assert.ok(['recover', 'wait', 'engage'].includes(f.ai._tac.state), `then the beat after a blow (${f.ai._tac.state})`);
});

test('TELL1: no stunlock - a wind-up broken inside STAGGER_IMMUNE of a stagger\'s end only breaks; past it, a stagger again (mutants: the guard gone)', () => {
  const f = foe();
  const player = [0, 0, 0];
  assert.ok(untilWindup([f], f, player));
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 99), 'stagger');
  const end = f.ai.staggerUntil;
  assert.equal(f.ai._tac.staggerReady, end + TELL.STAGGER_IMMUNE, 'the guard runs 3 s past the stagger\'s end');
  run([f], 1.3, player);
  f.ai._tac.blowReady = 0;   // the cooldown waived so a wind-up comes again (TELL4's open window reaches the guard in play)
  assert.ok(untilWindup([f], f, player, 30));
  f.ai._tac.staggerReady = T + 1;   // as though its stagger ended two seconds ago
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 99), 'break');
  assert.equal(f.ai.staggered, false);
  assert.equal(f.ai._tac.state, 'wait');
  assert.equal(liveBlows().has(f.ai), false);
  f.ai._tac.blowReady = 0;
  assert.ok(untilWindup([f], f, player, 30));
  f.ai._tac.staggerReady = T - 0.01;   // its guard just spent
  assert.equal(windupStruck(f.ai, f.ent, ORC_W, 99), 'stagger', 'past it, a stagger again');
});

test('TELL1: the weight class sets the length - a giant is staggered 0.8 s (its poise the massive floor since AUDIT TELL; the light 1.4 s is staggerSeconds\' own pin); an elite\'s poise is half again', () => {   // NAME MOVED (AUDIT TELL: it named a light foe it never staggers)
  const g = foe({ mobileType: M.Giant });
  assert.ok(untilWindup([g], g, [0, 0, 0]));
  // PIN MOVED (TELL3, bible/12-Enhanced-AI/Feud-Arc.md 5: a giant's slam is iron, one elite blow in three too - no poise
  // to weigh): the blow this pins is one with a poise (test/tell3_iron.test.js pins the iron)
  g.ai._tac.blow.guard = 'poise';
  const t0 = T;
  assert.equal(windupStruck(g.ai, g.ent, 3000, 59.9), 'hold', 'a giant of 100: poise 50, the massive floor 60');   // PIN MOVED (AUDIT TELL: POISE_FLOOR_MASSIVE)
  assert.equal(windupStruck(g.ai, g.ent, 3000, 0.2), 'stagger');
  assert.ok(Math.abs(g.ai.staggerUntil - (t0 + 0.8)) < 1e-9);
  resetTactics(); resetBlows();
  const e = foe();
  e.ent.eliteFoe = true;
  assert.ok(untilWindup([e], e, [0, 0, 0]));
  e.ai._tac.blow.guard = 'poise';   // PIN MOVED (TELL3): as above
  assert.equal(windupStruck(e.ai, e.ent, ORC_W, 44.9), 'hold', 'an elite orc: 45');
  assert.equal(windupStruck(e.ai, e.ent, ORC_W, 0.2), 'stagger');
});

test('TELL1: a paralysis still breaks a wind-up (DFU\'s CanAct), and no stagger comes of it; with the switch off nothing holds', () => {
  const f = foe();
  const player = [0, 0, 0];
  assert.ok(untilWindup([f], f, player));
  run([f], 0.2, player, null, true);
  run([f], 0.15, player);   // the brain's next turn hears the motor's word (AUDIT TACT D1)
  assert.notEqual(f.ai._tac.state, 'windup');
  assert.equal(liveBlows().has(f.ai), false);
  assert.equal(f.ai.staggered, false);
  resetTactics(); resetBlows();
  const g = foe();
  assert.ok(untilWindup([g], g, player));
  setPref('enhancedAI', false);
  assert.equal(windupHolds(g.ai), false);
  assert.equal(windupStruck(g.ai, g.ent, ORC_W, 999), null);
});

// ── what a staggered foe takes ─────────────────────────────────────

test('TELL1: a staggered foe takes a quarter more - the registry, the formulas\' tail end to end, a spell\'s landing (mutants: the tail never asks; the fold unregistered)', () => {
  assert.ok(blowTakenNames().includes('tell-stagger'));
  const ent = { staggerUntil: 5 };
  T = 4;
  assert.equal(blowTakenScale(null, ent), 1.25);
  assert.equal(blowTaken(8, null, ent), 10);
  assert.equal(blowTaken(1, null, ent), 1, 'at least the blow');
  assert.equal(blowTaken(0, null, ent), 0, 'nothing landed stays nothing');
  T = 5;
  assert.equal(blowTakenScale(null, ent), 1, 'its stagger over');
  // the formula end to end: a steel longsword's min roll on a forced hit, then the same on a staggered target
  const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
  const attacker = { isPlayer: false, isClass: false, level: 20, skills: 60, stats: STATS, career: { attackModifierFlags: 0 } };
  const opts = { weapon: { templateIndex: WEAPONS.Longsword, material: 1, flags: 0 }, toHitMod: 1000, rolls: () => 0.5, dfRand: () => 0.5 };
  const target = { isPlayer: false, isClass: false, level: 5, stats: STATS, skills: 20, armorValues: new Array(7).fill(60) };
  T = 1;
  const plain = calculateAttackDamage(attacker, { ...target }, opts);
  assert.ok(plain > 0, `a blow that lands (${plain})`);
  const hit = calculateAttackDamage(attacker, { ...target, staggerUntil: 2 }, opts);
  assert.equal(hit, Math.max(1, Math.round(plain * 1.25)));
  const fm = rd('src/combat/formulas.js');
  assert.match(fm, /const m = mentorDamageTakenMult\(target\);\n\s*if \(m > 1\) damage = Math\.max\(1, Math\.round\(damage \* m\)\);\n\s*\}\n(\s*\/\/[^\n]*\n)*\s*damage = blowTaken\(damage, attacker, target, weapon, /, 'after mentor mode, before the reports');
  const hm = rd('src/scenes/hostMagic.js');
  // PIN MOVED (RVN1: the landing notes my spell in its fight's ledger between the take and the sink)
  assert.match(hm, /hurt: \(n, o\) => \{\n\s*const d = o\?\.whole \|\| o\?\.round \? n : blowTaken\(n, striker, foe\.entity, null, \{ kind: 'spell'[^\n]*\n[^\n]*\n\s*return sinks\.hurt\(d, \{ \.\.\.\(o \?\? \{\}\), element: spell\?\.element \?\? null \}\);/, 'a spell\'s landing; a kill and a round as they come (RVN1: the ledger notes it between; PIN MOVED RVN3: its element rides to the door)');
  assert.match(hm, /const r = applySpell\(spell, casterLevel, foe\.entity, landing, rolls, caster, ctx\);/);
});

// ── the doors ───────────────────────────────────────────────────────

const _store = new Map();
globalThis.localStorage ??= {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
/** The crafted MONSTER.BSA (test/revenant_fate.test.js's) with one career, for `mobileType`. */
function careersFor(mobileType) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
  const name = `ENEMY${String(mobileType).padStart(3, '0')}.CFG`;
  for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
  dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
  return out;
}
async function streetPool(mobileType) {
  const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
  const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
  const careers = careersFor(mobileType);
  const sounds = [], effects = [], shakes = [];
  const me = { isPlayer: true, name: 'Ayla', level: 10, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, health: 100, maxHealth: 100 };
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: (archive, record, size) => ({ archive, record, size }), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}) },
    collider: Object.assign(new Collider(() => 0), { heightAt: () => 0 }),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: me, audio: { play3d: (i, p, v, o) => sounds.push({ i, ...o }), playOneShot: () => {} }, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    hitEffects: { showMissEffect: (k, p, o) => effects.push({ k, ...o }), showBloodSplash: () => {}, bleed: () => {} }, shake: (k) => shakes.push(k),
  });
  return { pool, me, sounds, effects, shakes };
}
/** Frames of the real pool against a player at [0, 0, 3], the brain's clock with it. */
function poolFrames(pool, secs, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer([0, 0, 3], [0, 0, -1]);
    pool.update(DT, [0, 0, 3], [0, 1.6, 3]);
    each?.();
  }
}

test('TELL1: THE REAL STREET POOL - a blow on a foe winding up holds (no shove, no Hurt, the parry ring), the breaking blow staggers it and its shove is half again DFU\'s; on a foe NOT winding up DFU\'s knock stands to the bit (mutants: the door\'s hold gone; the stagger shove unscaled; the weapon not passed)', async () => {
  const { pool, sounds, effects, shakes } = await streetPool(M.Orc);
  const f = await pool.spawnFoe(M.Orc, [0, 0, 0], { feetGiven: true, champion: null, eliteFoe: false });
  assert.ok(f, 'stood');
  f.entity.level = 12;   // of the telegraph tier
  f.entity.maxHealth = f.entity.health = 100;
  const look = [0, 0, -1];
  const mace = { group: 'Weapons', templateIndex: WEAPONS.Mace, material: 0 };
  // first, NOT winding up: DFU's knockback for the blow, exactly
  f.ai.knockbackSpeed = 0;
  pool.damageFoe(f, 6, [0, 0, 3], look, { weapon: mace });
  const w = enemyWeightClassicUnits(false, f.gender, ENEMY_BASICS[M.Orc].weight, f.entity.items);
  assert.equal(f.ai.knockbackSpeed, weaponKnockbackSpeed(6, w), 'DFU\'s, to the bit');
  f.ai.knockbackSpeed = 0;
  f.entity.health = 100;
  let wound = false;
  for (let i = 0; i < 4000 && !wound; i++) poolFrames(pool, DT, () => { if (f.ai._tac?.state === 'windup') wound = true; });
  assert.ok(wound, 'the real pool\'s foe wound one up');
  const blow = liveBlows().get(f.ai);
  const before = sounds.length;
  // a mace blow of 6: 6 x 1.5 = 9 of a poise of 30 (its kit weighs it; still medium)
  pool.damageFoe(f, 6, [0, 0, 3], look, { weapon: mace });
  assert.equal(f.ai.knockbackSpeed, 0, 'HOLD: no shove written');
  assert.equal(f.ai._tac.state, 'windup');
  assert.equal(f.entity.health, 94, 'its health taken all the same');
  assert.ok(Math.abs(blow.taken - 9) < 1e-9, 'the mace\'s weight on the meter');
  assert.equal(f.ai.hurtKnock, false);
  assert.equal(ENEMY_BASICS[M.Orc].parrySounds, true);
  assert.ok(sounds.slice(before).some((x) => x.i >= 428 && x.i < 437), 'a hold rings the parry (an orc is a kind DFU gives one)');
  // the breaking blow: 14 x 1.5 = 21 -> 30
  pool.damageFoe(f, 14, [0, 0, 3], look, { weapon: mace });
  assert.equal(f.ai._tac.state, 'staggered');
  assert.ok(Math.abs(f.ai.knockbackSpeed - weaponKnockbackSpeed(14, w) * TELL.STAGGER_KNOCK) < 1e-9, 'its shove half again DFU\'s');
  assert.ok(effects.some((e) => e.k === 'clang'), 'the clang spark');
  assert.ok(shakes.includes(0.6), 'the player\'s own blow kicks the camera');
  // the motor: the shove plays, the Hurt is held through the stagger
  let hurt = 0, n = 0;
  poolFrames(pool, 1.0, () => { n++; if (f.ai.hurtKnock || f.ai.staggered) hurt++; });
  assert.equal(hurt, n, 'its Hurt held every frame of its stagger');
});

test('TELL1: the foe-vs-foe payload writes no knockback on a foe winding up - its own door weighs the blow (mutants: the gate gone)', () => {
  const f = foe();
  assert.ok(untilWindup([f], f, [0, 0, 0]));
  let doorSaw = null;
  const attacker = { entity: { isClass: false }, ai: { feet: [0, 0, 9] }, mobileType: M.Orc };
  const target = { entity: { ...f.ent, basics: ENEMY_BASICS[M.Orc], isClass: false, items: [] }, ai: f.ai };
  applyDamageToNonPlayer(attacker, target, { calculateAttackDamage: () => 10, dealDamage: (t, d) => { doorSaw = d; }, direction: [0, 0, -1] });
  assert.equal(f.ai.knockbackSpeed, 0, 'no shove from the payload');
  assert.equal(doorSaw, 10, 'the door has the blow');
  // ...and the door's law for a striker: its weapon (a monster's own body: claws), from where it stands
  const word = windupDoor({ ...f, entity: f.ent }, 25, { striker: attacker, from: [0, 0, 0], weight: ORC_W });
  assert.equal(word, 'hold', 'a monster\'s own body: 25 x 1.0, under 30 (bare hands would weigh 15)');
  assert.equal(windupDoor({ ...f, entity: f.ent }, 5, { striker: attacker, from: [0, 0, 0], weight: ORC_W }), 'stagger', '25 + 5 x 1.0 reaches 30 (hands: 18)');
});

test('TELL1: every door asks the poise door where it writes DFU\'s knock, passes the player\'s weapon, and holds the Hurt through a stagger; the spells\' rounds and the arrows\' kinds reach the doors (mutants: a door left on the old law)', () => {
  const ex = rd('src/scenes/exteriorFoes.js');
  // PIN MOVED (TELL4, bible/12-Enhanced-AI/Feud-Arc.md 6.1): an overreached foe asks the door too (the first blow staggers it)
  assert.match(ex, /const _tell = \(f\.ai\?\._tac\?\.state !== 'windup' && f\.ai\?\._tac\?\.state !== 'overreach'\) \? null : windupDoor\(f, damage, \{[^\n]*\n\s*kind, weapon, round, peer, striker, from: striker\?\.ai\?\.feet \?\? playerFeet,/);
  assert.match(ex, /if \(_tell === 'hold'\) return;\n\s*if \(knockDir && weaponKnockbackApplies\(f\.ai\.knockbackSpeed, isClass, mobileWeight\)\) \{/);
  assert.match(ex, /f\.ai\.knockbackSpeed = weaponKnockbackSpeed\(damage, w\) \* \(_tell === 'stagger' \? TELL\.STAGGER_KNOCK : 1\);/);
  assert.match(ex, /damageFoe\(foe, damage, playerFeet, lookDir, \{ weapon: playerWeapon\.strikingWeapon \}\);/);
  assert.match(ex, /hurting: f\.ai\.hurtKnock \|\| f\.ai\.staggered,/);
  assert.match(ex, /hurt: \(n, o\) => damageFoe\(f, n, null, null, \{ fromPlayer: false, kind: 'spell', whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\),/);   // PIN MOVED (RVN3: a landing's element)
  const g = rd('src/scenes/cityGuards.js');
  assert.match(g, /const _tell = \(g\.ai\?\._tac\?\.state !== 'windup' && g\.ai\?\._tac\?\.state !== 'overreach'\) \? null : windupDoor\(g, damage, \{/);   // PIN MOVED (TELL4)
  assert.match(g, /if \(_tell === 'hold'\) return;\n\s*if \(knockDir && weaponKnockbackApplies\(g\.ai\.knockbackSpeed, true, guardWeight\)\) \{/);
  assert.match(g, /g\.ai\.knockbackSpeed = weaponKnockbackSpeed\(damage, w\) \* \(_tell === 'stagger' \? TELL\.STAGGER_KNOCK : 1\);/);
  assert.match(g, /damageGuard\(foe, damage, playerFeet, lookDir, \{ weapon: playerWeapon\.strikingWeapon \}\);/);
  assert.match(g, /hurting: g\.ai\.hurtKnock \|\| g\.ai\.staggered,/);
  assert.match(g, /hurtFromFoe: \(dmg, dir, striker = null\) => damageGuard\(g, dmg, null, dir \?\? null, \{ fromPlayer: false, striker \}\)/);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const _tell = \(foe\.ai\?\._tac\?\.state !== 'windup' && foe\.ai\?\._tac\?\.state !== 'overreach'\) \? null : windupDoor\(foe, damage, \{/);   // PIN MOVED (TELL4)
  assert.match(d, /if \(_tell === 'hold'\) return;\n\s*if \(knockDir && foe\.ai\) \{/);
  assert.match(d, /foe\.ai\.knockbackSpeed = weaponKnockbackSpeed\(damage, w\) \* \(_tell === 'stagger' \? TELL\.STAGGER_KNOCK : 1\);/);
  assert.match(d, /damageFoe\(foe, damage, playerFeet, lookDir, \{ weapon: playerWeapon\.strikingWeapon \}\);/);
  assert.match(d, /hurting: f\.ai\.hurtKnock \|\| f\.ai\.staggered \|\| !!_pb\?\.staggered,/);   // PIN MOVED (TELL8: and the host's stagger on its puppet)
  assert.match(d, /hurt: \(n, o\) => damageFoe\(f, n, null, null, \{ kind: 'spell', fromPlayer: o\?\.fromPlayer \?\? fromPlayer, whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\),/);   // PIN MOVED (RVN3: a landing's element)
  assert.match(rd('src/systems/effects.js'), /sinks\.hurt\(n, \{ fromPlayer: !a\.caster \|\| !!a\.caster\.isPlayer, bundleDuel: !!a\.bundleDuel, round: true \}\);/, 'a round says it is one');
  for (const [file, re] of [
    ['src/scenes/world.js', /cityGuards\.hurtGuard\(f, d, player\.pos, m\.dir, \{ kind: 'arrow' \}\)/],
    ['src/scenes/exterior.js', /cityGuards\.hurtGuard\(f, d, player\.pos, m\.dir, \{ kind: 'arrow' \}\)/],
    ['src/scenes/worldModes.js', /interiorGuards\?\.hurtGuard\(f, d, player\.pos, m\.dir, \{ kind: 'arrow' \}\)/],
    ['src/scenes/world.js', /cityGuards\.hurtGuard\(g, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', round: !!o\?\.round \}\)/],
    ['src/scenes/exterior.js', /cityGuards\.hurtGuard\(g, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', round: !!o\?\.round \}\)/],
    ['src/scenes/worldModes.js', /interiorGuards\?\.hurtGuard\(foe, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', round: !!o\?\.round \}\)/],
  ]) assert.match(rd(file), re, file);
  assert.match(rd('src/scenes/hostCombat.js'), /if \(target\.ai && !windupHolds\(target\.ai\) && enemyKnockbackApplies\(/);
  const mo = rd('src/characters/enemyMotor.js');
  // PIN MOVED (TELL4, Feud-Arc.md 6.1): the stagger's lock is `locked` - a stagger or an overreach
  assert.match(mo, /const locked = staggered \|\| overreached \|\| \(this\.roarUntil > 0 && tacticsNow\(\) < this\.roarUntil\);/);   // PIN MOVED (RVN4: a last stand's roar holds it too)
  assert.match(mo, /this\.canAct = !paralyzed && !knocked && !locked && \(this\.isHostile \|\| foeTarget\);/);
  assert.match(mo, /if \(paralyzed \|\| paused \|\| locked \|\| !\(this\.isHostile \|\| foeTarget\)\) this\.moving = false;/);
});
