// AUDIT FB1031 II - the COVER lane (TRUNK-FOES: "Jungle trees need better or more collision, enemies just hide in them
// it sucks"). The goal every fix keeps: no pair is one-way - if A sees or shoots B through cover, B sees or shoots A; a
// body pressed behind cover's solid part is hidden both ways; a body in front of it is seen and struck. K1 an end in a
// proxy hides only where the line crosses its middle inside it (a lifted crown's floor too); K2 the two-way pin samples
// a lifted crown and ends above and below it (test/characters/fb1031_foes.test.js F1); K3 the push alone where the side
// step is refused; K4 the dungeon's shaft names the relay's bodies, a bolt DEX5's corpse prefabs; K5 F2's lists' five
// laws; K6 a band stands outside the view's WIDTH. bible/03-World/Player-Arc.md TRUNK-FOES, bible/06-Systems/Travel-View.md
// BAND-NEAR. New exports are read off their modules, so each pin fails on its own.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepFoesOffBodies } from '../../src/characters/foeSpacing.js';
import { canSeeTarget } from '../../src/characters/enemy/enemyMotor.js';
import { enemyArrowOrigin } from '../../src/characters/enemy/enemyTargets.js';
import { Collider } from '../../src/player/collider.js';
import * as coverLaw from '../../src/ai/cover.js';
import { jungleBody } from '../../src/world/propBodies.js';
import { jungleCover } from '../../src/world/jungle/jungleModels.js';
import { ArrowFlight, shaftBodies } from '../../src/combat/arrowFlight.js';
import { createPlayerMagic, liveCollider, flightStop } from '../../src/scenes/hostMagic.js';
import * as spellcast from '../../src/systems/spellcast.js';
import * as corpseMarker from '../../src/scenes/corpseMarker.js';
import * as bands from '../../src/systems/travel/travelBands.js';
import { campAnchorSpot, PACK_SPACING, PACK_ALERT_RADIUS } from '../../src/systems/campEncounters.js';
import { hostText } from '../hostText.mjs';

const { createCoverIndex, coverProxy, coverDistance, rayCylinder, COVER_MIDDLE_GRACE: G } = coverLaw;

/** open ground with a cover index holding `items` */
function field(items, ground = new Collider(() => 0)) {
  ground.cover = createCoverIndex({ enabled: () => true });
  ground.cover.add('pixel', items);
  return ground;
}
/** where the last cover query of a flight was asked from - how far a missile flew */
function lastAsked(col) {
  const at = { pos: null }, real = col.cover.hit;
  col.cover.hit = (o, ...rest) => { at.pos = [...o]; return real(o, ...rest); };
  return at;
}
const foe = (x, z, over = {}) => ({ ai: { feet: [x, 0, z], height: 1.8 }, dead: false, ...over });
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const yawTo = (f, t) => Math.atan2(t[0] - f[0], t[2] - f[2]);
/** a young tree of Bantha-Jungle's understorey: its trunk's body and its two cover proxies */
const young = (species, scale, c = [0, 0, 0]) => [jungleBody(c, species, scale), ...jungleCover(c, species, scale)];

/** my shaft out of `from` exactly (a world muzzle, the bloom at its centre) along `dir`; whether it struck `target` */
function myShaft(col, target, { from, dir, me = [0, 0, -50], technique = null, others = [] }) {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: col });
  const roll = Math.random;
  Math.random = () => 0;
  try { f.fire(from, dir, { fromPlayer: true, muzzle: { world: from }, ...(technique ? { technique } : {}) }); } finally { Math.random = roll; }
  const struck = [];
  const foeTargets = [target, ...others].map((t) => ({ feet: t.ai.feet, ref: t }));
  for (let i = 0; i < 120 && !f.arrows[0].dead; i++) f.update(1 / 60, { playerFeet: me, playerHeight: 1.8, foeTargets, onPlayerArrowHitFoe: (m, t) => { struck.push(t); } });
  return struck.includes(target);
}
/** a foe archer's shaft out of `from` along `dir` at me standing at `me` (`height` tall); whether it hit me */
function foeShaft(col, me, { from, dir, archer, height = 1.8 }) {
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: col });
  a.fire(from, dir, { enemy: true, shooterFoe: archer, aimFoe: null });
  let hit = false;
  for (let i = 0; i < 120 && !a.arrows[0].dead; i++) a.update(1 / 60, { playerFeet: me, playerHeight: height, onPlayerHit: () => { hit = true; }, foeTargets: [{ feet: archer.ai.feet, ref: archer }], onFoeHit: () => {} });
  return hit;
}

// the cast engine (test/characters/fb1031_foes.test.js's rig)
const damageEffect = (mag = 20) => ({ type: 4, subType: 0, magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 });
const bolt = () => ({ name: 'Test Spell', index: 90, element: 0, rangeType: 2, effects: [damageEffect()] });
const mkFoe = (x, z, over = {}) => ({ dead: false, ai: { feet: [x, 0, z] }, entity: { level: 1, health: 400, maxHealth: 400, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] }, ...over });
function rig(col, foes, extra = {}) {
  const player = { isPlayer: true, level: 10, health: 500, maxHealth: 500, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const world = { hurt: 0 };
  const sinks = { heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
    uploadRecord: () => {}, uploadRecordFrame: () => {}, collider: liveCollider(() => col), playerEntity: player,
    playerSinks: { ...sinks, hurt: (n) => { world.hurt += n; }, say() {} }, say: () => {}, surfacePlayer() {},
    foes: () => foes, foeSinks: () => ({ ...sinks, hurt() {} }),
    absorbCtx: () => ({ inside: false, day: true }), rolls: () => 0.99, ...extra,
  });
  return { magic, world };
}
const fly = (magic, feet) => { for (let i = 0; i < 120 && magic.missileCount() > 0; i++) magic.update(1 / 60, feet); };

// ─── K1: THE MIDDLE, EITHER END ───────────────────────────────────────

test('AUDIT FB1031 II K1 executed: a foe standing in a young flame tree\'s crown and me crouched under its edge see each other and shoot each other - the line crosses the middle under the crown\'s floor; a 1.8 m body in a crown and a 0.9 m one past its middle see each other', () => {
  // x0.36: the crown from 1.08 m, 1.97 m out (Bantha-Jungle's understorey); the foe in it, me crouched (0.9 m) by its edge
  const col = field(young(3, 0.36)), ff = [-0.79, 0, 1.07], me = [-0.18, 0, -0.87];
  const yaw = yawTo(ff, me), archer = { ai: { feet: ff, height: 1.8, yaw }, dead: false };
  assert.equal(canSeeTarget(col, ff, yaw, 1.8, me, 0.9), true, 'the foe sees me');
  assert.equal(canSeeTarget(col, me, yawTo(me, ff), 0.9, ff, 1.8), true, '...and I see it');
  const from = enemyArrowOrigin(archer.ai);
  assert.equal(foeShaft(col, me, { from, dir: unit([me[0] - from[0], 0.4 - from[1], me[2] - from[2]]), archer, height: 0.9 }), true, 'its shaft hits me');
  const eye = [me[0], 0.8, me[2]];
  assert.equal(myShaft(col, archer, { from: eye, dir: unit([ff[0] - eye[0], 1.5 - eye[1], ff[2] - eye[2]]), me }), true, '...and mine at its head strikes it (lost on the crown before)');
  // x0.45 (crown from 1.35 m, 2.46 m out): A standing in it, B a 0.9 m body 7.5 m off past its middle
  const col2 = field(young(3, 0.45)), A = [-1.70, 0, 0.29], B = [5.27, 0, -2.53];
  assert.equal(canSeeTarget(col2, A, yawTo(A, B), 1.8, B, 0.9), true, 'A sees B');
  assert.equal(canSeeTarget(col2, B, yawTo(B, A), 0.9, A, 1.8), true, '...and B sees A (B was blind)');
});

test('AUDIT FB1031 II K1 the law: over the jungle\'s young trees (crowns lifted 1.08-1.86 m) a standing and a crouched eye, in a crown and round it, are hidden one way exactly when the other; and executed on one line, my shaft out of my bow hand lands exactly when a foe\'s back along it does (mutants: the end met at its side; the middle beside the line; a hold\'s grace unread)', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const EYES = [1.5, 0.75];   // canSeeTarget's eye on a 1.8 m and a 0.9 m body
  let pairs = 0, hidden = 0;
  for (const [species, scale] of [[3, 0.36], [3, 0.45], [0, 0.36], [0, 0.45], [0, 0.62]]) {
    const proxies = jungleCover([0, 0, 0], species, scale), crown = proxies[1], clampR = proxies[0].r + 0.35;
    const pt = (R) => { for (;;) { const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R; if (Math.hypot(x, z) >= clampR) return [x, z]; } };
    const hid = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d), u = d.map((v) => v / l); return proxies.some((p) => rayCylinder(a, u, p, l, l) < l - 1e-3); };
    for (let i = 0; i < 3000; i++) {
      const [ax, az] = pt(crown.r), [bx, bz] = pt(crown.r + 6);
      if (Math.hypot(ax - bx, az - bz) < 0.7) continue;
      const a = [ax, EYES[rnd() < 0.5 ? 0 : 1], az], b = [bx, EYES[rnd() < 0.5 ? 0 : 1], bz];
      const ab = hid(a, b);
      assert.equal(hid(b, a), ab, `species ${species} x${scale}: one-way between ${a.map((v) => v.toFixed(2))} and ${b.map((v) => v.toFixed(2))}`);
      pairs++; if (ab) hidden++;
    }
  }
  assert.ok(pairs > 14000 && hidden > 1500 && hidden < pairs - 1500, `the pairs reach both answers (${hidden} hidden of ${pairs})`);
  // executed: a foe standing in the crown, me crouched round it; my shaft from my bow hand O through its head Q, its back
  let lines = 0, landed = 0;
  for (const [species, scale] of [[3, 0.45], [0, 0.4]]) {
    const items = young(species, scale), col = field(items), crownR = items[2].r, clampR = items[0].r + 0.35;
    for (let i = 0; i < 70; i++) {
      const fa = rnd() * 2 * Math.PI, fr = clampR + rnd() * (crownR - clampR), ff = [Math.sin(fa) * fr, 0, Math.cos(fa) * fr];
      const ma = rnd() * 2 * Math.PI, mr = clampR + rnd() * (crownR + 6), me = [Math.sin(ma) * mr, 0, Math.cos(ma) * mr];
      if (Math.hypot(me[0] - ff[0], me[2] - ff[2]) < 2) continue;
      const archer = foe(ff[0], ff[2]), Q = [ff[0], 1.5, ff[2]];
      const O = spellcast.playerArrowOrigin([me[0], 0.8, me[2]], [Q[0] - me[0], Q[1] - 0.8, Q[2] - me[2]]);
      const mine = myShaft(col, archer, { from: O, dir: unit([Q[0] - O[0], Q[1] - O[1], Q[2] - O[2]]), me });
      const its = foeShaft(col, me, { from: Q, dir: unit([O[0] - Q[0], O[1] - Q[1], O[2] - Q[2]]), archer, height: 0.9 });
      assert.equal(its, mine, `species ${species} x${scale}: foe ${ff.map((v) => v.toFixed(2))}, me ${me.map((v) => v.toFixed(2))} - mine ${mine}, its ${its}`);
      lines++; if (mine) landed++;
    }
  }
  assert.ok(lines > 120 && landed > 30 && landed < lines - 20, `both answers (${landed} of ${lines} landed)`);
  // a hold is a body's axis: one inside the rock whose shot's line passes beside the rock is no end of that line in it
  const rock = field([coverProxy([0, 0, 10], { w: 3.68, h: 4.13 })]);
  const n = [Math.SQRT1_2, 0, -Math.SQRT1_2], d = [Math.SQRT1_2, 0, Math.SQRT1_2];   // a line 1.35 m off its axis (cover 1.29), a body 0.85 m off it
  const o = [1.35 * n[0] - 10 * d[0], 1.4, 10 + 1.35 * n[2] - 10 * d[2]], hold = [0.85 * n[0] + 0.6 * d[0], 1.4, 10 + 0.85 * n[2] + 0.6 * d[2]];
  assert.equal(coverDistance(rock, o, d, 20, false, hold), Infinity, 'a line beside the rock, a body it strikes in the rock past its middle: none');
  assert.equal(coverDistance(rock, [0, 1.4, 0], [0, 0, 1], 20, false, [0, 1.4, 10.3]), Infinity, 'one struck within a body\'s radius past the middle is at it: none');
});

test('AUDIT FB1031 II K1: a line to a body past the middle stops a grace short of the middle at the latest - one entering a crown\'s floor at the middle does not catch a foe there by its reach when that foe\'s own shot out is lost; from inside, the same (mutants: met at the middle; met where it enters only)', () => {
  const crown = { c: [0, 0, 10], r: 2.2, h: 5, lift: 1.4, _mark: 0 }, col = field([crown]);
  // from inside with a struck body past the middle: a grace short of the middle (from outside, where it enters if sooner)
  assert.ok(Math.abs(coverDistance(col, [0, 2.5, 8.5], [0, 0, 1], 20, false, [0, 2.5, 10.4]) - (1.5 - G)) < 1e-9, 'from inside: the middle less the grace');
  assert.ok(Math.abs(coverDistance(col, [0, 2.5, 5], [0, 0, 1], 20, false, [0, 2.5, 10.4]) - 2.8) < 1e-9, 'from outside: where it enters, sooner');
  assert.ok(Math.abs(rayCylinder([0, 2.5, 8.5], [0, 0, 1], crown, 20) - 1.5) < 1e-9, 'from inside with no body past it: the middle');
  // executed: my shaft rising into the crown's floor 0.05 m before its middle, at a foe 0.38 m past it
  const archer = foe(0, 10.38), s = 0.1, from = [0, 1.4 - s * 4.05, 5.9], at = [0, 1.4 + s * 0.43, 10.38];   // the floor met at z 9.95
  assert.equal(myShaft(col, archer, { from, dir: unit([0, at[1] - from[1], at[2] - from[2]]) }), false, 'my shaft: lost on the crown');
  assert.equal(foeShaft(col, [0, 0, 5.9], { from: at, dir: unit([0, from[1] - at[1], from[2] - at[2]]), archer }), false, '...as its shot back along the line is');
  // both in the crown: me 1.3 m before its middle, the foe 0.38 m past it
  const mine = [0, 1.6, 8.7];
  assert.equal(myShaft(col, archer, { from: mine, dir: [0, 0, 1] }), false, 'from inside: lost too');
  assert.equal(foeShaft(col, [0, 0, 8.7], { from: [0, 1.6, 10.38], dir: [0, 0, -1], archer }), false, '...and its, back');
});

// ─── K3: THE PUSH ALONE ───────────────────────────────────────────────

test('AUDIT FB1031 II K3: a foe walking dead at a trunk\'s middle whose side step would leave the ground (a bank\'s lip) is put straight out of the trunk in one frame - the push alone, never held in it (mutants: the push alone dropped)', () => {
  const trunk = jungleBody([0, 0, 10], 0, 1.2), R = trunk.r + 0.35;   // a banyan's 1.73 m trunk
  const bank = new Collider((x) => (x > 0.3 ? -40 : 0));   // the ground ends at x 0.3, 40 m down
  const col = field([trunk], bank);
  const f = foe(0, 8.5); f.ai.destination = [0, 0, 20];
  assert.equal(keepFoesOffBodies([f], col), 1, 'moved');
  assert.ok(Math.abs(f.ai.feet[0]) < 1e-9 && Math.abs(Math.hypot(f.ai.feet[0], f.ai.feet[2] - 10) - R) < 1e-6, `straight out to the edge (${f.ai.feet.map((v) => v.toFixed(3))})`);
  const g = foe(0, 8.5); g.ai.destination = [0, 0, 20];
  keepFoesOffBodies([g], field([trunk]));
  assert.ok(g.ai.feet[0] > 0.3, 'on open ground it still steps round');
});

// ─── K4: THE BODIES A FLIGHT STRIKES ──────────────────────────────────

test('AUDIT FB1031 II K4: the dungeon\'s shaft of mine names the bodies the relay runs that the flight strikes - the court\'s boss at a flat\'s middle and my opponent on the sand are struck, not shielded; a technique\'s shaft names neither one it struck nor a player; the host hands them (mutants: the stand-ins unread; one the technique struck named; the opponent named for a technique; the host unwired)', () => {
  const dmb = spellcast.dungeonMissileBodies, feet = (list) => list.map((x) => x.feet);
  const boss = { boss: true, dead: false, ai: { feet: [0, 0, 10], height: 3, radius: 0.8 } }, rival = { rival: 'p1', dead: false, ai: { feet: [1, 0, 10], height: 1.8, radius: 0.35 } };
  const crystal = { crystal: 1, dead: false, ai: { feet: [2, 0, 10], height: 1, radius: 0.5 } }, a = foe(3, 3);
  assert.deepEqual(feet(dmb({ fromPlayer: true, arrow: true }, [a], [9, 0, 9], 1.8, [boss, rival, null, crystal])), [a.ai.feet, boss.ai.feet, rival.ai.feet, crystal.ai.feet], 'mine: the foes and the relay\'s bodies');
  assert.deepEqual(feet(dmb({ fromPlayer: true, arrow: true, technique: { struck: [boss, a] } }, [a], [9, 0, 9], 1.8, [boss, rival, crystal])), [crystal.ai.feet], 'a technique\'s: none it struck, never a player');
  assert.deepEqual(feet(dmb({ arrow: true, shooterFoe: a }, [a], [9, 0, 9], 1.8, [boss])), [[9, 0, 9]], 'a foe\'s shaft: none of them');
  // the dungeon's flight replayed (flightStop swept with the list, the advance, the arm's capsule test)
  const col = field([coverProxy([0, 0, 10], { w: 3, h: 3 })], new Collider(() => -100));
  for (const [name, body] of [['the court\'s boss', boss], ['my opponent', { ...rival, ai: { ...rival.ai, feet: [0, 0, 10] } }]]) {
    const m = { fromPlayer: true, arrow: true, pos: [0, 1.2, 0], dir: [0, 0, 1] };
    let out = 'flew on';
    for (let i = 0; i < 120 && out === 'flew on'; i++) {
      const step = spellcast.ARROW_FLIGHT_SPEED / 60, { unit: u, reach } = spellcast.missileReach(m.dir, step);
      const cs = flightStop(col, m.pos, u, reach, step, true, dmb(m, [], [0, 0, -0.5], 1.8, [body]));
      if (Number.isFinite(cs.stop) && cs.stop <= reach) { out = 'lost on the flat'; break; }
      const was = [...m.pos];
      m.pos[2] += step * cs.advance;
      if (spellcast.missileHitsCapsule(m.pos, body.ai.feet, body.ai.height, body.ai.radius, was)) out = 'struck';
    }
    assert.equal(out, 'struck', `${name} at the flat's middle`);
  }
  assert.match(hostText('src/scenes/dungeonContext.js'), /dungeonMissileBodies\(m, foes, playerFeet, playerHeight, m\.fromPlayer \? \[gateBossBody\(\), arenaRivalBody\(\), \.\.\.gateCrystalBodies\(\), \.\.\.gateHostBodies\(\)\] : null\)\);/, 'the dungeon\'s flight hands them');
});

test('AUDIT FB1031 II K4 (DEX5): a mod\'s corpse prefab lying in a rock\'s cover in front of its middle is met by my bolt and a peer\'s drawn one, not lost on the rock; behind the middle, shielded (mutants: the prefabs unnamed for mine, for the drawn one)', () => {
  const prefab = (z, hits) => ({ dead: true, corpse: true, ai: { feet: [0, 0, z] }, entity: { level: 1, health: 0, maxHealth: 40, activeEffects: [] }, corpsePrefab: { sphere: () => ({ center: [0, 0.6, z], radius: 0.6 }), struck: () => { hits.n++; } } });
  assert.deepEqual(corpseMarker.corpsePrefabBodies([prefab(9.2, {}), mkFoe(1, 1)]), [{ ai: { feet: [0, 0, 9.2], height: 1.2, radius: 0.6 } }], 'a sphere is a capsule as tall as it is wide; a live foe is none');
  for (const [z, want] of [[9.2, 1], [11.2, 0]]) {
    const hits = { n: 0 }, col = field([coverProxy([0, 0, 10], { w: 3.68, h: 4.13 })]);
    const { magic } = rig(col, [prefab(z, hits)]);
    magic.setReadied(bolt()); magic.castInput([0, 1.4, 0], [0, 0, 1]); fly(magic, [0, 0, -0.5]);
    assert.equal(hits.n, want, `my bolt at a prefab ${z < 10 ? 'in front of' : 'behind'} the middle`);
  }
  const col = field([coverProxy([0, 0, 10], { w: 3.68, h: 4.13 })]), at = lastAsked(col);
  const { magic } = rig(col, [prefab(9.6, { n: 0 })]);
  magic.spellVisual({ from: [0, 1.4, 0], dir: [0, 0, 1], element: 0, rangeType: 2, casterId: 'p1' }); fly(magic, [0, 0, -50]);
  assert.ok(at.pos[2] > 8.5, `a peer's drawn bolt flies to a prefab 0.4 m before the middle (${at.pos[2].toFixed(2)}), not to the rock's side (8.26)`);
});

// ─── K5: F2'S LISTS ───────────────────────────────────────────────────

test('AUDIT FB1031 II K5: F2\'s lists\' laws - my Piercing Shot past a foe it struck at a crown\'s middle, or a duel body there, is lost on the crown short of one behind; a peer\'s drawn bolt stops on a peer at the middle, and out of the caster\'s own crown is lost at its middle; a shipmate\'s bolt is lost on a crown I stand at the middle of; the dungeon\'s technique shaft names none it struck (mutants: the technique\'s pass-through; the drawn list\'s peers; its caster; the shipmate\'s list names me; the dungeon\'s struck filter)', () => {
  const crownAt = (z) => [{ c: [0, 0, z], r: 2.2, h: 5, lift: 1.0, _mark: 0 }];
  // a technique's shaft: a struck foe or a player at the crown's middle opens nothing
  const behind = foe(0, 23.6), struckOne = foe(0, 20), duel = foe(0, 20, { duel: true });
  const pierce = () => ({ pierce: 3, struck: [struckOne] });
  assert.equal(myShaft(field(crownAt(20)), behind, { from: [0, 1.4, 0], dir: [0, 0, 1], technique: pierce(), others: [struckOne] }), false, 'past one it struck: lost on the crown');
  assert.equal(myShaft(field(crownAt(20)), behind, { from: [0, 1.4, 0], dir: [0, 0, 1], technique: pierce(), others: [duel] }), false, 'past a duel body: lost on the crown');
  assert.equal(myShaft(field(crownAt(20)), behind, { from: [0, 1.4, 0], dir: [0, 0, 1], others: [foe(0.6, 21.5)] }), false, 'a plain shaft, nobody at the middle: lost');
  assert.deepEqual(shaftBodies({ fromPlayer: true, technique: pierce() }, [struckOne, duel, behind].map((t) => ({ feet: t.ai.feet, ref: t })), null, 1.8, false, true).map((b) => b.feet), [behind.ai.feet], 'its list: the one behind alone');
  // a peer's drawn bolt
  const peers = [{ id: 'p1', feet: [0, 0, 20.9], height: 1.8 }, { id: 'p2', feet: [0, 0, 20], height: 1.8 }];
  { const col = field(crownAt(20)), at = lastAsked(col), { magic } = rig(col, [], { peerBodies: () => [peers[1]] });
    magic.spellVisual({ from: [0, 1.4, 0], dir: [0, 0, 1], element: 0, rangeType: 2, casterId: 'p1' }); fly(magic, [0, 0, -50]);
    assert.ok(at.pos[2] > 18.6, `stops on a peer at the crown's middle (${at.pos[2].toFixed(2)}), not on the crown's side`); }
  { const col = field(crownAt(20)), at = lastAsked(col), { magic } = rig(col, [], { peerBodies: () => [peers[0]] });
    magic.spellVisual({ from: [0, 1.4, 20.9], dir: [0, 0, -1], element: 0, rangeType: 2, casterId: 'p1' }); fly(magic, [0, 0, -50]);
    assert.ok(at.pos[2] > 19.5, `out of the caster's own crown: lost at its middle (${at.pos[2].toFixed(2)}) - its own body opens nothing`); }
  // a shipmate's bolt flies past me - and so names me not: a crown I stand at the middle of stops it
  { const col = field(crownAt(20)), at = lastAsked(col), { magic, world } = rig(col, []);
    const mate = mkFoe(0, 0, { deckBoat: 0, entity: { ...mkFoe(0, 0).entity, team: 'PlayerAlly' } });
    magic.fireEnemyMissile([0, 1.4, 0.6], [0, 0, 1], bolt(), 1, mate); fly(magic, [0, 0, 20]);
    assert.equal(world.hurt, 0, 'it never hurts me');
    assert.ok(at.pos[2] < 18, `lost on the crown (${at.pos[2].toFixed(2)})`); }
  // the dungeon's technique shaft
  const a = foe(1, 1), b = foe(2, 2);
  assert.deepEqual(spellcast.dungeonMissileBodies({ fromPlayer: true, arrow: true, technique: { struck: [a] } }, [a, b], [9, 0, 9], 1.8).map((x) => x.feet), [b.ai.feet], 'the dungeon\'s: none it struck');
});

// ─── K6: THE VIEW'S WIDTH ─────────────────────────────────────────────

test('AUDIT FB1031 II K6: a band met with the view down stands outside the view\'s WIDTH - its horizontal half-view and its pack\'s spread past it, FOV + 2 at the least; lifted bandStand on the real campAnchorSpot at 32:9 and at 16:9 stands no member in view (mutants: the aspect unread; the spread unread; the jitter unallowed; the host hands no aspect)', () => {
  const bsb = bands.bandStandBearing, deg = Math.PI / 180;
  const halfOf = (vfov, aspect) => Math.atan(Math.tan((vfov / 2) * deg) * aspect) / deg;
  const near = bands.BAND_STAND_M - PACK_SPACING, spread = Math.asin(PACK_SPACING / near) / deg;
  const wide = bsb(0.7, 0.7, 60, false, 32 / 9, near, PACK_SPACING);
  assert.ok(Math.abs(wide.bearingDegrees - (halfOf(60, 32 / 9) + spread + 2)) < 1e-9, `32:9 at 60: the half-view ${halfOf(60, 32 / 9).toFixed(1)} + the spread ${spread.toFixed(1)} + 2 (${wide.bearingDegrees.toFixed(1)})`);
  assert.deepEqual(bsb(0.7, 0.7, 60, false, 16 / 9, near, PACK_SPACING), { yawRad: 0.7, bearingDegrees: 62 }, '16:9 at 60: FOV + 2, wider than the view');
  assert.deepEqual(bsb(0.7 + 70 * deg, 0.7, 60, false, 16 / 9, near, PACK_SPACING), { yawRad: 0.7 + 70 * deg, bearingDegrees: 0 }, '16:9: one 70 degrees off keeps its own bearing');
  assert.equal(bsb(0.7 + 70 * deg, 0.7, 60, false, 32 / 9, near, PACK_SPACING).bearingDegrees, wide.bearingDegrees, '32:9: one 70 degrees off is in the view - to the edge');
  // the host's own bandStand, lifted, over the real anchor law; members 1..PACK_SPACING about each anchor
  const w = hostText('src/scenes/world.js');
  const m = /\n {2}function bandStand\([^)]*\) \{\n[\s\S]*?\n {2}\}\n/.exec(w);
  assert.ok(m, 'bandStand lifted');
  let seed = 5;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const [name, cw, ch, FOV] of [['32:9', 32, 9, 60], ['16:9', 16, 9, 60], ['32:9', 32, 9, 75]]) {
    const camYaw = 0.7, half = halfOf(FOV, cw / ch), anchors = [];
    const scope = {
      bandRoom: () => true, player: { feetAt: () => [0, 0, 0] }, BAND_STAND_MIN_M: bands.BAND_STAND_MIN_M, PACK_SPACING, PACK_ALERT_RADIUS,
      wildFoes: { alert() {} }, exteriorFoes: { noticedPlayer() {} }, performance: { now: () => 0 }, bandStandBearing: bsb,
      cam: { yaw: camYaw }, fieldOfView: () => FOV * deg, travelView: { active: false }, renderer: { _camPos: [0, 0, 0] },
      largeHudWorldAspect: (cwi, chi) => cwi / chi, canvas: { clientWidth: cw, clientHeight: ch },
      _standCampEncounter: (hit, feet) => {
        anchors.push(campAnchorSpot({ feet, yawRad: hit.yawRad ?? camYaw, fovDegrees: FOV, groundAt: () => 0, minDistance: hit.minDistance, maxDistance: hit.maxDistance, bearingDegrees: hit.bearingDegrees, rolls: rnd }));
        return { foes: Promise.resolve([]) };
      },
    };
    const stand = new Function('s', `const { ${Object.keys(scope).join(', ')} } = s; ${m[0]} return bandStand;`)(scope);
    const off = (x, z) => Math.abs((((Math.atan2(x, z) - camYaw) / deg % 360) + 540) % 360 - 180);
    let inView = 0;
    for (let i = 0; i < 400; i++) {
      stand({ mobileTypes: [1, 2] }, camYaw + (rnd() - 0.5) * 2 * half * deg, bands.BAND_STAND_M);
      const a = anchors[anchors.length - 1];
      for (let k = 0; k < 4; k++) { const t = rnd() * 2 * Math.PI, r = 1 + rnd() * (PACK_SPACING - 1); if (off(a.x + Math.sin(t) * r, a.z + Math.cos(t) * r) < half) inView++; }
    }
    assert.equal(inView, 0, `${name} at ${FOV}: no member in the view's ${half.toFixed(1)} degrees`);
  }
});
