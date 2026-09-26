// WB4b (2026-09-25, Mac: "a large boss arena with an oversized enemy"): THE BOSS IS FOUGHT, DRIVEN. The entity a blow on
// him is computed against (world/gateBoss.js bossStandIn - the game's own formula, measured: a level-1 iron longsword
// lands about half its swings, a level-20 blade nearly all); where a swing meets him (bossReach - his skin, not his
// middle); the spell engine's helpers for a body that states its own radius (systems/spellcast.js - the touch swept
// down its aim, the blast and the missile against his whole body, a foe measured as it always was); the court's doors
// (scenes/gateCourt.js target and hit - the blow's number out as the wire's frame, the ward turning it, the flinch) and
// the relay's side of the same frame (net/wire.js validGateIn, net/gateBrain.js applyHit); and the seams in the dungeon
// context, the spell engine, the dungeon arm and the world host, by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { bossStandIn, bossReach, bossLookOf, bossAct, BOSS_ARMOR, BOSS_LOOKS } from '../src/world/gateBoss.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { pickTouchTarget, sweepFoes, missileHitsFoe, TOUCH_RANGE, TOUCH_SPHERE_CAST_RADIUS } from '../src/systems/spellcast.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { validGateIn } from '../src/net/wire.js';
import { newFight, joinFight, applyHit, BOSS_H, BOSS_R, HIT_KINDS, MELEE_REACH } from '../src/net/gateBrain.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { WEAPON_REACH } from '../src/combat/playerWeapon.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const STATS = (v) => ({ strength: v, intelligence: v, willpower: v, agility: v, endurance: v, personality: v, speed: v, luck: v });
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };

test('WB4b his stand-in: his own mobile\'s entity, every metal biting where a Daedra Lord\'s needs Mithril, a knight\'s armour where a Daedra Lord\'s is a wall, a health nothing here empties - and the game\'s own formula against it lands a level-1 iron longsword more than half the time, a level-20 blade nearly always (mutants: the Daedra Lord\'s metal kept; his own armour kept)', () => {
  const look = bossLookOf('ruhn');
  const e = bossStandIn(look, 'Valkynaz Ruhn');
  assert.equal(e.name, 'Valkynaz Ruhn');
  assert.equal(e.mobileType, 31); assert.equal(e.isClass, false, 'a monster to the formula (+40 to hit, as any)');
  assert.equal(ENEMY_BASICS[31].minMetalToHit, 5, 'the Daedra Lord\'s own - Mithril');
  assert.equal(e.minMetalToHit, 0, 'every metal bites');
  assert.equal(e.armor, BOSS_ARMOR); assert.deepEqual(e.armorValues, new Array(7).fill(BOSS_ARMOR));
  assert.ok(ENEMY_BASICS[31].armorValue * 5 < 0, 'the Daedra Lord\'s own armour is a wall');
  assert.ok(e.health >= 1e9 && e.maxHealth >= 1e9, 'nothing local empties him - the relay holds his health');
  assert.notEqual(bossStandIn(look, 'x'), e, 'one a fight, made fresh');
  const swing = (p, w, n, rolls) => {
    let hits = 0, sum = 0;
    for (let i = 0; i < n; i++) { const d = calculateAttackDamage(p, e, { weapon: { ...w }, damageMod: 0, toHitMod: 0, backstabChance: 0, rolls }); if (d > 0) { hits++; sum += d; } }   // a fresh blade each swing: the formula wears the one it is handed
    return { rate: hits / n, avg: sum / Math.max(1, hits) };
  };
  const lv1 = swing({ isPlayer: true, level: 1, skills: 40, stats: STATS(55), health: 40, maxHealth: 40 }, { templateIndex: 120, material: 0, flags: 0 }, 3000, seeded(7));
  assert.ok(lv1.rate > 0.5 && lv1.rate < 0.8, `a level-1 iron longsword lands more than half its swings, not all: ${lv1.rate.toFixed(2)}`);
  assert.ok(lv1.avg > 6 && lv1.avg < 13, `for about eight to twelve: ${lv1.avg.toFixed(1)}`);
  const lv20 = swing({ isPlayer: true, level: 20, skills: 80, stats: STATS(75), health: 200, maxHealth: 200 }, { templateIndex: 123, material: 8, flags: 0 }, 3000, seeded(11));
  assert.ok(lv20.rate > 0.85, `a level-20 blade nearly always: ${lv20.rate.toFixed(2)}`);
  assert.ok(lv20.avg > lv1.avg * 1.8);
});

test('WB4b where a swing meets him: his skin - the reach from the eye to the nearest point of his surface, level with the eye where his height allows - so the player\'s own reach touches him from beside him, where a foe\'s centre law never could (mutants: the reach to his axis)', () => {
  const body = { feet: [10, 0, 10], height: BOSS_H, radius: BOSS_R };
  const at = (d) => bossReach([10, 1.7, 10 - d], body);
  assert.ok(Math.abs(at(4).dist - Math.hypot(4, 0.1) + BOSS_R) < 1e-9);
  assert.ok(at(BOSS_R + WEAPON_REACH - 0.1).dist <= WEAPON_REACH, 'a swing reaches him from his reach\'s edge');
  assert.ok(at(BOSS_R + WEAPON_REACH + 0.2).dist > WEAPON_REACH, 'and not past it');
  assert.equal(at(1).dist, 0, 'pressed to him');
  assert.deepEqual(at(4).point, [10, BOSS_R, 10 - BOSS_R], 'the nearest point of his skin, on the side of the eye');
  assert.equal(bossReach([10, 3, 5], body).point[1], 3, 'level with the eye where his height allows');
  assert.equal(bossReach([10, 20, 5], body).point[1], BOSS_H - BOSS_R, 'and his crown\'s where it does not');
  assert.ok(MELEE_REACH >= WEAPON_REACH, 'the relay measures a melee blow with at least the player\'s own reach');
});

test('WB4b the spell engine\'s helpers for a body that states its own radius: a touch swept down the aim meets his skin, a blast his flank, a missile his whole body - and a foe that states none is measured exactly as before (mutants: the sweep without his radius; the missile without it; the touch\'s sweep cut short)', () => {
  const boss = { dead: false, ai: { feet: [0, 0, 0], height: BOSS_H, radius: BOSS_R } };
  const north = [0, 0, 1];
  assert.equal(pickTouchTarget([0, 1.7, -(BOSS_R + TOUCH_RANGE)], north, [boss]), boss, 'the hands meet his skin at the touch\'s full reach');
  assert.equal(pickTouchTarget([0, 1.7, -(BOSS_R + TOUCH_RANGE + TOUCH_SPHERE_CAST_RADIUS + 0.1)], north, [boss]), null, 'and not past it');
  assert.equal(pickTouchTarget([0, 1.7, -3.5], north, [boss], () => false), null, 'a wall between keeps the touch off him');
  const foe = { dead: false, ai: { feet: [0, 0, 2], height: 1.8 } };
  assert.equal(pickTouchTarget([0, 0.9, 0], north, [foe]), foe, 'a foe by its middle, as it always was');
  assert.equal(pickTouchTarget([0, 0.9, 0], north, [boss, { ...foe, ai: { feet: [0, 0, 9], height: 1.8 } }]), boss, 'the first along the aim wins');
  assert.deepEqual(sweepFoes([BOSS_R + 3.9, 1, 0], 4, [boss]), [boss], 'a blast reaches his flank');
  assert.deepEqual(sweepFoes([BOSS_R + 3.9, 1, 0], 4, [{ dead: false, ai: { feet: [0, 0, 0], height: BOSS_H } }]), [], 'where a foe\'s capsule would be out of it');
  assert.equal(missileHitsFoe([BOSS_R + 0.2, 2, 0], boss), true, 'a missile meets his whole body');
  assert.equal(missileHitsFoe([BOSS_R + 0.2, 2, 0], { ai: { feet: [0, 0, 0], height: BOSS_H } }), false, 'a foe\'s capsule is a foe\'s');
});

/** A court with a fight in it, driven by hand. */
function court(st) {
  const link = { st, state() { return this.st; } };
  const clock = { t: 5000 };
  const sent = [];
  const c = createGateCourt({ link, now: () => clock.t, send: (hit) => { sent.push(hit); return true; } });
  return { c, link, clock, sent };
}
const fight = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, x: 3, z: -4, yaw: 0.5, ...over });

test('WB4b the court\'s doors: him as a body while he stands (his feet, his height and radius, his ward, one stand-in a fight) and none else; a blow\'s number out as the wire\'s frame - whole points, its own sequence, its kind - the ward turning it and nothing under a point sent; he flinches; and the relay takes the very frame (mutants: a warded blow sent; the sequence not advancing; the number unrounded)', () => {
  const h = court(fight());
  const t = h.c.target();
  assert.deepEqual(t.feet, courtToDungeon(3, 0, -4));
  assert.equal(t.height, BOSS_H); assert.equal(t.radius, BOSS_R); assert.equal(t.yaw, 0.5); assert.equal(t.warded, false); assert.equal(t.mobile, BOSS_LOOKS.ruhn.mobile);
  assert.equal(h.c.target().entity, t.entity, 'one stand-in a fight');
  assert.equal(court(GATE_STATE_EMPTY).c.target(), null, 'no fight, no body');
  assert.equal(court(fight({ fell: { at: 1, top: [], n: 1 } })).c.target(), null, 'fallen, no body');
  assert.equal(h.c.hit({ d: 11.6, r: HIT_KINDS.Melee }), true);
  assert.equal(h.c.hit({ d: 30, r: HIT_KINDS.Spell }), true);
  assert.deepEqual(h.sent, [{ q: 1, d: 12, r: 0 }, { q: 2, d: 30, r: 2 }], 'whole points, a sequence of its own, the kind');
  assert.equal(bossAct(h.link.st, h.clock.t, h.clock.t).act, 'flinch');
  assert.equal(h.c.hit({ d: 0.4, r: 0 }), false); assert.equal(h.c.hit({ d: 5, r: 7 }), false);
  assert.equal(h.sent.length, 2, 'nothing under a point, nothing of no kind');
  h.link.st = fight({ shieldUntil: 9000 });
  assert.equal(h.c.target().warded, true);
  assert.equal(h.c.hit({ d: 40, r: 1 }), false, 'the ward turns it');
  assert.equal(h.sent.length, 2, 'and nothing is sent');
  // the relay's side of the same frame
  const f = newFight(700, 1000, 10_000_000, 'ruhn');
  joinFight(f, 'acct-1', 'Mac', 5, 1000, true);
  f.pos = [3, -4];
  const frame = validGateIn({ k: 'hit', ...h.sent[0] });
  assert.ok(frame, 'the wire takes it');
  assert.equal(applyHit(f, 'acct-1', frame.d, frame.r, { x: 3, z: -4 + BOSS_R + 2 }, 2000), 12, 'and the brain lands it from beside him');
});

test('WB4b the seams, by source: the dungeon context meets him as a foe-shaped body its swing, its shafts and its spells all reach - by his skin, his whole body, his own radius - and sends every number through the court\'s door; the spell engine reaches him at every site a duel opponent is reached; the dungeon arm and the world host carry the two doors (mutants: each seam removed)', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /function gateBossBody\(\) \{\n\s*const b = opts\.gateBoss\?\.\(\) \?\? null;/);
  assert.match(dc, /const boss = gateBossBody\(\);\n\s*if \(boss\) \{ boss\._backFacing = foeDeps\.isBackFacing\(boss\.ai\.yaw, boss\.ai\.feet, playerFeet\); live\.push\(boss\); \}\n\s*const canSee = \(f\) => \{\n\s*if \(f === boss\) return bossSight\(eye, inViewFn, boss\);/, 'the swing sees him by his skin');
  assert.match(dc, /if \(foe === boss\) \{ hitEnemy = true; swingOnBoss\(boss, damage, lookDir\); continue; \}/);
  assert.match(dc, /const \{ point: p, dist \} = bossReach\(eye, boss\.ai\);/);
  assert.match(dc, /landOnBoss\(boss, damage, HIT_KINDS\.Melee\);/);
  assert.match(dc, /if \(boss && missileHitsCapsule\(m\.pos, boss\.ai\.feet, boss\.ai\.height, boss\.ai\.radius\)\) \{\n\s*if \(boss\.warded\) wardTurns\(boss\);\n\s*else playerArrowHitFoe\(m, boss, \{[^\n]*dealDamage: \(t, d\) => landOnBoss\(boss, d, HIT_KINDS\.Shaft\) \}\);/, 'a shaft meets his whole body');
  assert.match(dc, /try \{ applySpell\(harm, playerEntity\.level, boss\.entity, sinks, Math\.random, \{ entity: playerEntity \}\); \} finally \{ boss\.entity\.activeEffects = \[\]; \}/);
  assert.match(dc, /return landOnBoss\(boss, dealt, HIT_KINDS\.Spell\);/);
  assert.match(dc, /castAtBoss: opts\.gateBoss \? \(sp\) => spellOnBoss\(sp\) : null,/);
  assert.match(dc, /function landOnBoss\(boss, damage, r\) \{\n\s*if \(boss\.warded\) \{ wardTurns\(boss\); return false; \}\n\s*return !!opts\.onBossHit\?\.\(\{ d: damage, r \}\);/);
  const hm = read('src/scenes/hostMagic.js');
  // WBX7: the harmful families - and a Soul Trap, which met nobody before (it passed straight through him)
  assert.match(hm, /function bossMarksFor\(sp\) \{\n\s*if \(!bossMark \|\| !castAtBoss \|\| !sp \|\| !\(duelSpellOf\(sp\) \|\| \(sp\.effects \?\? \[\]\)\.some\(\(e\) => e && isSoulTrapEffect\(e\)\)\)\) return \[\];/, 'the harmful families, and a soul trap');
  for (const re of [
    /if \(duel && caster\?\.entity === playerEntity\) for \(const t of sweepFoes\(pos, EXPLOSION_RADIUS, bossMarksFor\(spell\)\)\) giveToBoss\(t, spell\);/,
    /const marks = \[\.\.\.allyMarksFor\(sp\), \.\.\.duelMarksFor\(sp\), \.\.\.bossMarksFor\(sp\)\];/,
    /else if \(t\?\.boss\) giveToBoss\(t, sp\);/,
    /for \(const t of sweepFoes\(eye, EXPLOSION_RADIUS, bossMarksFor\(sp\)\)\) giveToBoss\(t, sp\);/,
    /const hitBoss = bossMarksFor\(m\.spell\)\.find\(\(p\) => missileHitsCapsule\(m\.pos, p\.ai\.feet, p\.ai\.height, p\.ai\.radius\)\);/,
  ]) assert.match(hm, re);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /gateBoss: \(\) => host\.gateBoss\?\.\(\) \?\? null,/);
  assert.match(wm, /onBossHit: \(hit\) => !!host\.onBossHit\?\.\(hit\),/);
  const w = read('src/scenes/world.js');
  assert.match(w, /send: \(hit\) => !!online\?\.sendGate\?\.\(\{ k: 'hit', \.\.\.hit \}\),/);
  assert.match(w, /gateBoss: \(\) => gateCourt\?\.target\(\) \?\? null,/);
  assert.match(w, /onBossHit: \(hit\) => !!gateCourt\?\.hit\(hit\),/);
});
