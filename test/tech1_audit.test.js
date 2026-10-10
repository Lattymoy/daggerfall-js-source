// AUDIT TECH1 (2026-10-10, the owner: "Audit this and ensure perfection"; bible/05-Combat/Weapon-Techniques.md AUDIT
// TECH1): the findings of the four lanes of the audit, each pinned on the real classes where the game has one - the
// Shadowstep that turned away from its foe, the leap that met a ceiling, the click that threw a landing strike away, the
// all-round reach that widened DFU's protected fallback, the paralysis that leaked a plain shot, the strike that skipped
// the swing's gate, the window that did not hold the key, the bow the Volley's shafts forgot, the shafts born inside walls,
// the open water, the last of a body's fatigue, a new character's cooldowns, the unidentified piece's name.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as T from '../src/combat/techniques.js';
import { blowReaches, bodyRadius } from '../src/combat/techniqueBlow.js';
import { TECHNIQUES } from '../src/combat/techniqueRoster.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { setSigilDueling } from '../src/systems/sigil.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { SWING_FATIGUE_COST } from '../src/scenes/hostCombat.js';
import { itemChatText, itemBriefLines } from '../src/ui/enhancedInventory.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = () => ({ strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (o = {}) => ({ isPlayer: true, level: 8, items: [], stats: stats(), skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [], ...o });
const foeAt = (x, z, o = {}) => ({ entity: { ...player({ isPlayer: false }), health: 100, maxHealth: 100 }, ai: { feet: [x, 0, z], height: 1.8, yaw: 0, ...(o.ai ?? {}) }, ...o });
const piece = (make, id, value = 20, known = true) => {
  const it = LR.applyRarity(make(), 'rare', lcg(7));
  it.isIdentified = known;
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  return it;
};
const arrows = (n) => ({ ...createWeapon(ARROW_TEMPLATE, 0), stackCount: n });
/** Flat ground at y = 0 (a floor mesh, as indoors), and a ceiling at `ceil` when given - a height, or a height by x (a
 *  beam over part of a room), read at the ray's own start. */
const room = (ceil = Infinity) => ({
  raycast: (o, d, max) => {
    if (d[1] < 0) { const t = -o[1] / d[1]; return t <= max ? t : Infinity; }
    const c = typeof ceil === 'function' ? ceil(o[0]) : ceil;
    if (d[1] > 0 && Number.isFinite(c) && o[1] < c) { const t = (c - o[1]) / d[1]; return t <= max ? t : Infinity; }
    return Infinity;
  },
  surfaceHit: (o, d, max) => (d[1] < 0 && o[1] >= 0 && o[1] <= max ? { dist: o[1], normal: [0, 1, 0] } : null),
  heightAt: () => -Infinity,
});
const R1 = {}, R2 = {};
function rig({ pw, entity, door = null, cam = null, collider = room(), rigId = R1 }) {
  const log = { said: [], started: [], shots: 0 };
  const ctx = (held, extra = {}) => ({
    rig: rigId, entity, pw, cam: cam ?? { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: [0, 0, 0] }, collider, held, ready: true, cancel: false,
    startSwing: (s) => { if (!pw.techniqueStrike(s)) return false; log.started.push(s); return true; },
    door, say: (l) => log.said.push(l), noteShot: () => { log.shots++; }, ...extra,
  });
  return { log, ctx };
}
const weaponOf = (it) => { const pw = new PlayerWeapon({ weapon: it, liveSpeed: 50 }); pw.sheathed = false; pw.update(0); return pw; };
const reset = () => { _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null); };
const flyMotor = () => ({ grounded: true, techniqueLaunch() { this.grounded = false; return true; } });

test('AUDIT TECH1 SHADOWSTEP: the view is turned on the foe FROM WHERE THE BODY LANDS, and the blow is its target\'s alone - all round within its reach, whatever the view, no other body (mutants: the turn from mid-dash; the target unread; another body struck)', () => {
  reset();
  const foe = foeAt(0, 5, { ai: { feet: [0, 0, 5], height: 1.8, yaw: Math.PI } });   // facing me: behind it is the far side
  setPlayerDoor({ foes: () => [foe] });
  const turns = [];
  const pw = weaponOf(piece(() => createWeapon(113, 1), 'shadowstep', 10));
  const { log, ctx } = rig({ pw, entity: player(), door: { motor: (() => { const m = flyMotor(); return () => m; })(), face: (p, from) => turns.push({ p, from }) }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.05, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, ctx(true));
  const landing = T.techniqueState().aim.point;
  T.stepTechnique(1 / 60, ctx(false));
  for (let i = 0; i < 90 && !log.started.length; i++) T.stepTechnique(1 / 60, ctx(false));
  assert.deepEqual(log.started, ['StrikeRight']);
  assert.equal(turns.length, 1);
  assert.deepEqual(turns[0].p, foe.ai.feet);
  assert.deepEqual(turns[0].from, landing, 'from the landing, behind the foe - the turn points back at it');
  const yaw = Math.atan2(turns[0].p[0] - turns[0].from[0], turns[0].p[2] - turns[0].from[2]);
  assert.ok(Math.abs(Math.abs(yaw) - Math.PI) < 1e-9, 'facing back along the dash, at the foe');
  // the blow: the target, from behind it, whatever the camera's view says; another body in view and in reach, never
  const blow = pw.techniqueBlow;
  assert.equal(blow.target, foe);
  blow.feet = [...landing];
  assert.equal(blowReaches(blow, foe, { dist: 1.2, inView: false, losClear: true }), true, 'out of the view, still struck');
  const other = foeAt(0.5, 6.2);
  assert.equal(blowReaches(blow, other, { dist: 0.6, inView: true, losClear: true }), false, 'its alone');
  assert.equal(blowReaches(blow, foe, { dist: 1.2, inView: true, losClear: false }), false, 'never through a wall');
});

test('AUDIT TECH1 THE ROOM: a leap fits under the ceiling over its path - its apex lowered to fit, or refused where the run\'s speed cap needs more height than there is; the open sky keeps the technique\'s own (mutants: the room unasked; the apex unused)', () => {
  reset();
  setPlayerDoor({ foes: () => [] });
  const cam = (pitch) => ({ pos: [0, 1.7, 0], yaw: 0, pitch, feet: [0, 0, 0] });
  // open sky: the technique's own apex
  const open = T.aimFor(TECHNIQUES.leap, cam(-0.25), room(), []);
  assert.equal(open.ok, true);
  assert.equal(open.apex, TECHNIQUES.leap.apex);
  // a 3.4 m roof: a short leap fits under a lowered apex
  const short = T.aimFor(TECHNIQUES.leap, cam(-0.45), room(3.4), []);
  assert.equal(short.ok, true, `a ${short.point?.[2]} m leap`);
  assert.ok(short.apex < TECHNIQUES.leap.apex, `lowered to ${short.apex}`);
  assert.equal(T.flightApex([0, 0, 0], short.point, TECHNIQUES.leap.apex, 1.85, room(3.4)), short.apex);
  // a 2.6 m roof: a 9 m leap needs ~1.4 m of rise for its run under 12 m/s - no room, said, and the mark red
  const far = T.aimFor(TECHNIQUES.leap, cam(-0.2), room(2.6), []);
  assert.equal(far.ok, false);
  assert.equal(far.why, T.NO_ROOM_TEXT);
  // the leap flies the apex its aim found
  const me = player();
  const launched = [];
  const motor = { grounded: true, techniqueLaunch(dir, along, up) { launched.push(up); this.grounded = false; return true; } };
  const { ctx } = rig({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap')), entity: me, collider: room(3.4), door: { motor: () => motor }, cam: cam(-0.45) });
  T.stepTechnique(1 / 60, ctx(true));
  const apex = T.techniqueState().aim.apex;
  T.stepTechnique(1 / 60, ctx(false));
  assert.equal(launched.length, 1);
  const top = (launched[0] * launched[0]) / (2 * 20);
  assert.ok(top + 1.85 <= 3.4 + 1e-6 && Math.abs(top - Math.max(apex, 0.4)) < 0.5, `the arc's top ${top} m under the roof`);
});

test('AUDIT TECH1 THE LANDING\'S STRIKE: no gesture while a leap or a dash is in the air (the rig asks techniqueFlying), and at the strike the swing\'s own gate is asked again - sheathed, a weapon changed, paralyzed: no blow, and nothing leaks (mutants: the flight flag; the gate at the strike)', () => {
  reset();
  setPlayerDoor({ foes: () => [] });
  const motor = flyMotor();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'leap'));
  const { log, ctx } = rig({ pw, entity: player(), door: { motor: () => motor }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.3, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, ctx(true));
  T.stepTechnique(1 / 60, ctx(false));
  assert.equal(T.techniqueFlying(), true, 'in the air: the rig asks no gesture');
  // the player sheathes in the air: the strike comes due with the gate shut
  for (let i = 0; i < 120 && T.techniqueState().act === 'flight'; i++) T.stepTechnique(1 / 60, ctx(false, { ready: false }));
  assert.deepEqual(log.started, [], 'no blow');
  assert.equal(T.techniqueState().act, null);
  assert.equal(pw.techniqueBlow, null);
  assert.equal(T.techniqueFlying(), false);
  // a weapon changed in the air: the same
  reset();
  setPlayerDoor({ foes: () => [] });
  const m2 = flyMotor();
  const pw2 = weaponOf(piece(() => createWeapon(120, 1), 'leap'));
  const r2 = rig({ pw: pw2, entity: player(), door: { motor: () => m2 }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.3, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, r2.ctx(true));
  T.stepTechnique(1 / 60, r2.ctx(false));
  pw2.weapon = createWeapon(130, 1);   // a bow, swapped in mid-air
  for (let i = 0; i < 120 && T.techniqueState().act === 'flight'; i++) T.stepTechnique(1 / 60, r2.ctx(false));
  assert.deepEqual(r2.log.started, [], 'a bow swapped in looses no plain shot on landing');
});

test('AUDIT TECH1 PARALYSIS: a held body\'s machine is frozen, and so is a swing\'s or a shot\'s clock - after a long paralysis the hit is still the technique\'s (claimShot), never a plain arrow (mutants: the clock run on)', () => {
  reset();
  const me = player(); me.items.push(arrows(5));
  const pw = weaponOf(piece(() => createWeapon(130, 1), 'pierce'));
  const fired = [];
  const { ctx } = rig({ pw, entity: me, door: { fireArrow: (from, dir, o) => fired.push(o) } });
  T.stepTechnique(1 / 60, ctx(true));
  T.stepTechnique(1 / 60, ctx(false));
  assert.equal(T.techniqueState().act, 'shot');
  for (let i = 0; i < 300; i++) T.stepTechnique(1 / 60, ctx(false, { paralyzed: true }));   // five seconds held
  assert.equal(T.techniqueState().act, 'shot', 'still waiting on the string');
  let evs = [];
  for (let i = 0; i < 120 && !evs.includes('hit'); i++) { evs = pw.update(1 / 60); T.stepTechnique(1 / 60, ctx(false)); }
  assert.ok(!T.claimShot(evs, ctx(false)).includes('hit'), 'the hit is the technique\'s - no plain arrow');
  assert.equal(fired.length, 1);
  assert.equal(fired[0].technique.pierce, TECHNIQUES.pierce.through);
});

test('AUDIT TECH1 A WINDOW HOLDS IT: a talk window, the pack or a map over the street (the door\'s `blocked`) holds the key, sets an aim aside unloosed, and stops the clock; a key held as it closes asks to be pressed again (mutants: the hold unread; the clock run on)', () => {
  reset();
  const me = player(); me.items.push(arrows(9));
  const pw = weaponOf(piece(() => createWeapon(130, 1), 'volley'));
  const { log, ctx } = rig({ pw, entity: me, door: { fireArrow() {} } });
  T.stepTechnique(1 / 60, ctx(true));
  assert.equal(T.techniqueState().aiming, true);
  T.stepTechnique(1 / 60, ctx(false, { blocked: true }));   // the window opens as the key comes up
  assert.equal(T.techniqueState().aiming, false);
  T.stepTechnique(1 / 60, ctx(false));
  assert.deepEqual(log.started, [], 'nothing loosed');
  // a press under the window is the window's
  T.stepTechnique(1 / 60, ctx(true, { blocked: true }));
  T.stepTechnique(1 / 60, ctx(true));   // the window closes with the key still down
  assert.equal(T.techniqueState().aiming, false, 'pressed again, not carried');
  // the clock stops under it
  reset();
  const me2 = player();
  const pw2 = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  const r2 = rig({ pw: pw2, entity: me2 });
  T.stepTechnique(1 / 60, r2.ctx(true));
  const before = T.techniqueWait('whirlwind');
  for (let i = 0; i < 60; i++) T.stepTechnique(0.25, r2.ctx(false, { blocked: true }));
  assert.equal(T.techniqueWait('whirlwind'), before, 'fifteen seconds under a window: not a second off');
});

test('AUDIT TECH1 THE VOLLEY: its shafts carry the bow that loosed them, whatever is in hand when they fall, and each starts in the open - pulled down its own line to short of a ceiling over its point (mutants: the live weapon; the spawn unasked)', () => {
  reset();
  const me = player(); me.items.push(arrows(10));
  const bow = piece(() => createWeapon(130, 1), 'volley');
  const pw = weaponOf(bow);
  const fired = [];
  const beam = (x) => (x > 0.5 ? 2 : 3);   // a 3 m room with a beam at 2 m over part of the disc - the middle's ray never sees it
  const { ctx } = rig({ pw, entity: me, collider: room(beam), door: { fireArrow: (from, dir, o) => fired.push({ from, dir, o }) } });
  T.stepTechnique(1 / 60, ctx(true));
  T.stepTechnique(1 / 60, ctx(false));
  let evs = [];
  for (let i = 0; i < 120 && !evs.includes('hit'); i++) evs = pw.update(1 / 60);
  T.claimShot(evs, ctx(false));
  pw.weapon = createWeapon(120, 1);   // a sword drawn before they fall
  for (let i = 0; i < 240; i++) T.stepTechnique(1 / 60, ctx(false));
  assert.equal(fired.length, 6);
  let underBeam = 0;
  for (const f of fired) {
    assert.equal(f.o.weapon, bow, 'the bow that loosed it');
    const land = f.from[0] + f.dir[0] * (f.from[1] / -f.dir[1]);   // where it comes down
    assert.ok(f.from[1] < beam(land), `born under what stands over its point: ${f.from[1]} at x ${land}`);
    if (land > 0.5) underBeam++;
  }
  assert.ok(underBeam > 0, 'some fell under the beam');
});

test('AUDIT TECH1 THE REFUSALS: the open water refuses a leap, as DFU refuses a jump there; a technique never spends the last of a body (its price and the blow\'s own drain after it); the gauntlets\' technique sleeps with a weapon drawn, and says so (mutants: each)', () => {
  reset();
  setPlayerDoor({ foes: () => [] });
  const said = (setup, entity = player()) => {
    T._resetTechniquesForTests();
    const r = rig({ entity, ...setup() });
    T.stepTechnique(1 / 60, r.ctx(true));
    return r.log.said;
  };
  const leaper = () => ({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap')) });
  assert.deepEqual(said(() => ({ ...leaper(), door: { motor: () => ({ grounded: true, onExteriorWater: true, techniqueLaunch: () => true }) } })), [T.CANNOT_LEAP_TEXT], 'the open water');
  assert.deepEqual(said(() => ({ ...leaper(), door: { motor: () => ({ grounded: true, isPlayerSwimming: true, techniqueLaunch: () => true }) } })), [T.CANNOT_LEAP_TEXT], 'swimming');
  const price = T.techniqueFatigue(TECHNIQUES.whirlwind);
  const sword = () => ({ pw: weaponOf(piece(() => createWeapon(120, 1), 'whirlwind')) });
  assert.deepEqual(said(sword, player({ fatigue: price + SWING_FATIGUE_COST })), [T.TIRED_TEXT], 'the price and the blow\'s drain: the last of the body');
  assert.deepEqual(said(sword, player({ fatigue: price + SWING_FATIGUE_COST + 1 })), [], 'one more: it goes');
  // the gauntlets' line with a sword drawn
  const g = piece(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: 103, material: 0x0201 })), 'haymaker');
  const me = player(); me.equip.slots[EQUIP_SLOTS.Gloves] = g;
  assert.deepEqual(said(() => ({ pw: weaponOf(createWeapon(120, 1)) }), me), [T.GAUNTLETS_TEXT]);
  assert.deepEqual(said(() => ({ pw: weaponOf(createWeapon(120, 1)) })), [T.NO_TECHNIQUE_TEXT], 'no gauntlets\' line: the plain word');
});

test('AUDIT TECH1 A LOAD AND THE NAME: a load (systems/save.js restoresSoFar - the player\'s entity is one object, refilled in place) starts the cooldowns, the aim and the act fresh; an unidentified piece\'s technique works and is named no more than its card names it (mutants: the load unread; the name told)', () => {
  reset();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  const me = player();
  const r = rig({ pw, entity: me });
  T.stepTechnique(1 / 60, r.ctx(true));
  assert.ok(T.techniqueWait('whirlwind') > 0);
  for (let i = 0; i < 120; i++) pw.update(1 / 60);
  T.stepTechnique(1 / 60, r.ctx(false));
  assert.ok(T.techniqueWait('whirlwind') > 0, 'no load: it waits on');
  assert.notEqual(restorePlayer(me, snapshotPlayer(me)), null, 'a load lands');
  T.stepTechnique(1 / 60, r.ctx(false));
  assert.equal(T.techniqueWait('whirlwind'), 0, 'after a load it waits on nothing of the moment before');
  // unidentified: it works; the chip and the lines say "Your technique"
  reset();
  const blind = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind', 20, false));
  const you = player();
  assert.deepEqual(LR.rarityLines(blind.weapon).slice(-1), ['Unidentified']);
  const b = rig({ pw: blind, entity: you });
  T.stepTechnique(1 / 60, b.ctx(true));
  assert.deepEqual(b.log.started, ['StrikeLeft'], 'it works unidentified, as an enchantment does');
  assert.equal(T.techniqueHudChips(you, blind)[0].name, T.UNKNOWN_TECHNIQUE);
  for (let i = 0; i < 120; i++) { blind.update(1 / 60); T.stepTechnique(1 / 60, b.ctx(false)); }   // the swing done, the cooldown still running
  T.stepTechnique(1 / 60, b.ctx(true));
  assert.ok(b.log.said.at(-1).startsWith(`${T.UNKNOWN_TECHNIQUE} is not ready`), b.log.said.at(-1));
  blind.weapon.isIdentified = true;
  assert.equal(T.techniqueHudChips(you, blind)[0].name, 'Whirlwind', 'known: its name');
});

test('AUDIT TECH1 THE PROTECTED: an ally or a foe at peace is never in a technique\'s all-round reach - struck only where a plain swing\'s look would strike it - and never the foe a leap or a Shadowstep picks (mutants: the fallback widened; the pick unfiltered)', () => {
  reset();
  const SWORD = { ...createWeapon(120, 1), group: 'Weapons' };
  const pw = new PlayerWeapon({ weapon: SWORD, liveSpeed: 50 });
  pw.machine.state = 'StrikeLeft';
  const peaceBehind = foeAt(0, -2.4, { ai: { feet: [0, 0, -2.4], height: 1.8, yaw: 0, isHostile: false } });
  const sight = (f) => ({ dist: Math.hypot(f.ai.feet[0], f.ai.feet[2]), inView: f.ai.feet[2] > 0, losClear: true });
  pw.techniqueBlow = T.swingBlow('whirlwind', 20, { feet: [0, 0, 0], yaw: 0 });
  assert.deepEqual(pw.resolveHit([peaceBehind], player(), sight, () => 0.01), [], 'behind me at peace: untouched');
  const peaceAhead = foeAt(0, 1.5, { ai: { feet: [0, 0, 1.5], height: 1.8, yaw: 0, isHostile: false } });
  assert.deepEqual(pw.resolveHit([peaceAhead], player(), sight, () => 0.01).map((x) => x.foe), [peaceAhead], 'in the look, as a plain swing would');
  const ally = foeAt(1.5, 0, { entity: { ...player({ isPlayer: false }), team: 'PlayerAlly' } });
  assert.deepEqual(pw.resolveHit([ally], player(), sight, () => 0.01), [], 'an ally beside me: untouched');
  // the pick
  const ahead = (o) => foeAt(0, 6, o);
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, null, [ahead({ ai: { feet: [0, 0, 6], height: 1.8, isHostile: false } })]), null, 'at peace');
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, null, [ahead({ companion: 0 })]), null, 'a companion');
  const hostile = ahead();
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, null, [hostile]), hostile);
});

test('AUDIT TECH1 THE CHAT POST: a post names the technique\'s line and leaves its "what a press does" to the card - the room under the post\'s length kept for the piece\'s other lines (mutants: the detail posted)', () => {
  reset();
  const blade = piece(() => createWeapon(120, 1), 'leap', 23);
  const detail = LR.techniqueDetail(LR.techniqueLineOf(blade));
  assert.ok(detail && itemBriefLines(blade, {}).includes(detail), 'the card carries it');
  const post = itemChatText(blade, {});
  assert.match(post, /Leap Strike \+23%/, 'the post names the line');
  assert.ok(!post.includes(detail), `and not its detail: ${post}`);
  _resetForTests();
});

test('AUDIT TECH1 A BIG BODY: its radius is read where its stand-in keeps it (the court\'s boss, a crystal, one of his host - `ai.radius`), so a Lunge\'s lane meets a body that crosses it, not only one whose middle does (mutants: the AI\'s radius unread)', () => {
  assert.equal(bodyRadius({ ai: { radius: 3 } }), 3);
  assert.equal(bodyRadius({ radius: 1, ai: { radius: 3 } }), 1, 'a record\'s own first');
  assert.equal(bodyRadius({ ai: {} }), 0.45, 'a foe\'s capsule');
  const lane = { lane: { from: [0, 0], dir: [0, 1], len: 5, halfW: 0.9 }, arc: 'all', reach: 5, feet: [0, 0, 0] };
  const boss = { ai: { feet: [3.2, 0, 3], radius: 3 } };   // his middle 3.2 m off the lane, his body over it
  assert.equal(blowReaches(lane, boss, { dist: 4, inView: true, losClear: true }), true);
  assert.equal(blowReaches(lane, { ai: { feet: [3.2, 0, 3] } }, { dist: 4, inView: true, losClear: true }), false, 'a foe that size would be wide of it');
});
