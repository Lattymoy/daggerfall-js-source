// SPELL-GIFT (2026-09-27, Discord - Tabitha, a cleric: "After testing, a LARGE amount of buffs & spells just don't work
// when cast on another person, even with touch. Normal regen seems okay, but Regen + Anything, Fortify Attributes,
// etc. Kinda wonky"; "Allow us to see buff timers or SOME sort of indicator that we have placed a buff on a party
// teammate"; "Area at Range & Area around Caster don't have good tooltips or UI elements"; "Allow casting of buffs on
// players outside party", with her whitelist and blacklist; "I think Shield is also hard-coded as a self-only").
//
// The wire lost nothing (every effect of a three-effect gift lands - allycast.test.js). What failed was the aim: a
// CasterOnly buff - DFU's spellbook, and every spell the maker snaps to CasterOnly for one self-only effect, "Regen +
// anything" - went off on the caster the moment it was readied unless the friend already stood under the crosshair.
// It arms now while a mate is NEAR, and the click decides. A gift sorts with the buffs on the receiver's HUD, a
// readied spell aimed at a player says where it will land, a blast names everyone in one line, and a stranger may be
// given the stranger's list - Tabitha's safe list - while their "Spells from strangers" switch is on.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import {
  ALLY_ARM_RADIUS, ALLY_ARMED_LINE, STRANGER_CAST_TYPES, strangerCastable, strangerEffect, allyCastable, allyCastSpell,
  allyCastCasterLineMany, ALLY_CAST_TYPES,
} from '../src/systems/allyCast.js';
import { activeSpellIcons } from '../src/ui/hudActiveSpells.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';
import { createInfection, INFECTION } from '../src/systems/infection.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8), FORTIFY = fx(9, 0, 10), REGEN = fx(18, -1, 2), LIGHT = fx(15, -1, 0), LEVITATE = fx(14, -1, 0);
const spellOf = (rangeType, effects, name = 'Balm') => ({ name, index: 90, element: 4, rangeType, effects });
const PRESS = 'Press button to fire spell.';
const mkPlayer = () => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50, strength: 50 }, career: {}, activeEffects: [],
});
/** The cast engine behind fakes (friendlyspells.test.js's rig): `mates` the bodies the host hands in, `pick` the
 *  crosshair's answer; the spell each seam is asked with is recorded. */
function magicRig(player, { mates = [], pick = null } = {}) {
  const world = { said: [], frames: [], marksAsked: [], pickAsked: [], pick };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity, heightAt: () => -100 },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l) },
    say: (l) => world.said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
    startCastAnim: null,
    allyTarget: (eye, dir, reach, sp) => { world.pickAsked.push(sp?.name ?? null); return world.pick; },
    castAtAlly: (id, frame) => { world.frames.push({ id, frame }); return true; },
    allyMarks: (sp) => { world.marksAsked.push(sp?.name ?? null); return mates; },
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, world };
}
const mate = (id, name, feet) => ({ id, name, feet, height: 1.8 });
const selfEffects = (p) => p.activeEffects.filter((a) => !a.ended && a.bundleId != null).length;

test('SPELL-GIFT: a CasterOnly buff readied with a mate NEAR arms - it does not go off on the caster - and the click gives it to the mate under the crosshair', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { mates: [mate('peer-0002', 'Bran', [3, 0, 6])] });   // near, not in the crosshair
  magic.readySpell(spellOf(0, [REGEN, FORTIFY, EMPTY], 'Regen and Strength'));
  assert.equal(selfEffects(player), 0, 'not cast on me at the ready (the report)');
  assert.deepEqual(world.said.slice(-2), [PRESS, ALLY_ARMED_LINE], 'DFU\'s line, and where the click will land');
  world.pick = { id: 'peer-0002', name: 'Bran', distance: 2 };   // the player turns to Bran
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  for (let t = 0; t < 1; t += 1 / 60) magic.update(1 / 60, [0, -50, 0], [0, 0, 1]);
  assert.equal(world.frames.length, 1, 'given');
  assert.deepEqual(world.frames[0].frame.spell.effects.map((e) => e.type), [18, 9], 'both effects ride');
  assert.equal(selfEffects(player), 0, 'and nothing landed on me');
});

test('SPELL-GIFT: armed near a mate, a click at nothing casts it on the caster, as CasterOnly always does; nobody near, it fires on the spot (DFU)', () => {
  const p1 = mkPlayer();
  const r1 = magicRig(p1, { mates: [mate('peer-0002', 'Bran', [0, 0, ALLY_ARM_RADIUS - 1])] });
  r1.magic.readySpell(spellOf(0, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.equal(selfEffects(p1), 0);
  r1.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  r1.magic.firePending([0, 0.9, 0], [0, 0, 1]);
  for (let t = 0; t < 1; t += 1 / 60) r1.magic.update(1 / 60, [0, -50, 0], [0, 0, 1]);
  assert.equal(r1.world.frames.length, 0);
  assert.ok(selfEffects(p1) > 0, 'aimed at no one: on me');
  const p2 = mkPlayer();
  const r2 = magicRig(p2, { mates: [mate('peer-0002', 'Bran', [0, 0, ALLY_ARM_RADIUS + 2])] });
  r2.magic.readySpell(spellOf(0, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.ok(selfEffects(p2) > 0, 'nobody within the radius: DFU\'s instant cast on the spot');
  assert.ok(!r2.world.said.includes(ALLY_ARMED_LINE));
});

test('SPELL-GIFT: a spell that is no gift (a harmful effect in it) never arms for a mate; the seams are asked WITH the spell', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { mates: [mate('peer-0002', 'Bran', [0, 0, 3])] });
  magic.readySpell(spellOf(0, [HEAL, fx(4, 0), EMPTY], 'Heal and Harm'));
  assert.ok(!world.said.includes(ALLY_ARMED_LINE), 'a Damage Health in it: no gift, the ordinary instant cast');
  const r2 = magicRig(mkPlayer(), { mates: [mate('peer-0002', 'Bran', [0, 0, 3])] });
  r2.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Mend'));
  assert.ok(r2.world.marksAsked.includes('Mend'), 'the host is handed the spell - its list decides who may be reached (strangers)');
  assert.ok(r2.world.pickAsked.includes('Mend'), '...the crosshair pick too');
});

test('SPELL-GIFT: a blast that reaches several mates is ONE line naming them all', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { mates: [mate('peer-0002', 'Bran', [1, 0, 1]), mate('peer-0003', 'Cass', [-1, 0, 1]), mate('peer-0004', 'Dee', [0, 0, -2])] });
  magic.readySpell(spellOf(3, [HEAL, EMPTY, EMPTY], 'Aura'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  const lines = world.said.filter((l) => l.startsWith('You cast Aura on '));
  assert.deepEqual(lines, ['You cast Aura on Bran, Cass and Dee.']);
  assert.equal(world.frames.length, 3);
  assert.equal(allyCastCasterLineMany('Heal', ['Bran']), 'You cast Heal on Bran.');
  assert.equal(allyCastCasterLineMany('Heal', []), null, 'nobody given: no line');
});

test('SPELL-GIFT: the stranger\'s list is Tabitha\'s safe list - and nothing of her unsafe one', () => {
  assert.deepEqual([...STRANGER_CAST_TYPES].sort((a, b) => a - b), [3, 8, 9, 10, 18, 20, 27, 30, 35]);
  for (const t of STRANGER_CAST_TYPES) assert.ok(ALLY_CAST_TYPES.has(t), `${t}: a stranger's gift is a party's gift first`);
  for (const [t, s] of [[10, 0], [18, -1], [20, -1], [3, 0], [3, 1], [3, 2], [9, 0], [9, 7], [35, -1], [8, 0], [8, 1], [8, 2], [8, 3], [27, -1], [30, -1]]) {
    assert.ok(strangerEffect({ type: t, subType: s }), `${t},${s} is safe`);
  }
  for (const [t, name] of [[25, 'Slowfall'], [0, 'Paralyze'], [14, 'Levitate'], [13, 'Invisibility'], [15, 'Light'], [4, 'Damage']]) {
    assert.ok(!strangerEffect({ type: t, subType: 0 }), `${name} is no stranger's gift`);
  }
  assert.ok(strangerCastable(spellOf(1, [HEAL, REGEN, EMPTY])));
  assert.ok(!strangerCastable(spellOf(1, [REGEN, LIGHT, EMPTY])), 'Regen + Light stays a party\'s');
  assert.ok(allyCastable(spellOf(1, [REGEN, LEVITATE, EMPTY])), '...which a party mate may still be given');
  // the receiver keeps the stranger's list alone
  const got = allyCastSpell({ name: 'Mixed', effects: [REGEN, LEVITATE, HEAL] }, { stranger: true });
  assert.deepEqual(got.effects.map((e) => e.type), [18, 10]);
  assert.equal(allyCastSpell({ name: 'Float', effects: [LEVITATE] }, { stranger: true }), null, 'nothing safe in it: nothing lands');
  assert.deepEqual(allyCastSpell({ name: 'Mixed', effects: [REGEN, LEVITATE] }).effects.map((e) => e.type), [18, 14], 'a mate\'s keeps the party\'s list');
});

test('SPELL-GIFT: a gift sorts with the BUFFS on the receiver\'s HUD - DFU\'s null-caster arm sent it to the debuff row', () => {
  const entity = { activeEffects: [
    { bundleId: 1, bundleName: 'Mine', bundleType: 'Spell', bundleIcon: 3, bundleSelfCast: true, roundsRemaining: 9 },
    { bundleId: 2, bundleName: 'Bran\'s Regen', bundleType: 'Spell', bundleIcon: 5, bundleSelfCast: false, bundleAlly: true, roundsRemaining: 9 },
    { bundleId: 3, bundleName: 'Curse', bundleType: 'Spell', bundleIcon: 7, bundleSelfCast: false, roundsRemaining: 9 },
  ] };
  const { self, other } = activeSpellIcons(entity);
  assert.deepEqual(self.map((i) => i.displayName), ['Mine', 'Bran\'s Regen']);
  assert.deepEqual(other.map((i) => i.displayName), ['Curse'], 'a foe\'s spell is still the debuff row');
});

test('SPELL-GIFT by source: the receiver takes a stranger\'s list only with the switch on, the pick and the bodies take strangers for it, the plaque says where a readied spell lands without the menu, and the switch is the player\'s', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const mate = !!social\?\.isPartyPeer\(id\);\s*\n\s*if \(!mate && !getPref\('acceptStrangerSpells'\)\) return;/);
  assert.match(w, /const spell = allyCastSpell\(d\?\.spell, \{ stranger: !mate \}\);/);
  assert.match(w, /if \(peerMenuFor !== id\) \{\s*\n\s*const cast = castPlaqueLine\(id\);\s*\n\s*const name = cast \? peerName\(id\) : null;\s*\n\s*return name \? \{ title: name, renown: null, subs: \[cast\], actions: \[\], actionsUnlit: true \} : null;\s*\n\s*\}/,
    'a cast about to land is no look: its line, nothing else');
  assert.match(w, /allyTarget: \(eye, dir, reach, sp\) => allyTargetPick\(eye, dir, reach, sp\),/);
  assert.match(w, /allyMarks: \(sp\) => allyMarksNear\(sp\),/);
  assert.match(rd('src/scenes/worldModes.js'), /allyMarks: \(sp\) => host\.allyMarks\?\.\(sp\) \?\? null,/, 'the dungeon engine\'s bodies, forwarded with the spell');
  assert.match(rd('src/scenes/dungeonContext.js'), /allyTarget: \(eye, dir, reach, sp\) => opts\.allyTarget\?\.\(eye, dir, reach, sp\) \?\? null,/);
  assert.equal(PREF_DEFAULTS.acceptStrangerSpells, true, 'on: the ask');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('acceptStrangerSpells'), 'the player\'s own, online');
  assert.match(rd('src/ui/enhancedMenu.js'), /c\.append\(prefRow\('acceptStrangerSpells', 'Spells from strangers',/);
});

// ─── AUDIT (the batch's audit, agent B) ────────────────────────────────────────────────────────────────────────────

test('AUDIT SPELL-GIFT B2: the ready\'s arm counts MATES - a stranger near leaves a caster-only buff DFU\'s instant cast (every online player self-buffing in a town was armed, and told to "aim at a party member"); a mate among them still arms (mutants: every mark counted)', () => {
  const stranger = { ...mate('peer-0009', 'Passerby', [0, 0, 3]), mate: false };
  const p1 = mkPlayer();
  const r1 = magicRig(p1, { mates: [stranger] });
  r1.magic.readySpell(spellOf(0, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.ok(selfEffects(p1) > 0, 'a stranger 3 m off: on me at the ready');
  assert.ok(!r1.world.said.includes(ALLY_ARMED_LINE));
  const p2 = mkPlayer();
  const r2 = magicRig(p2, { mates: [stranger, mate('peer-0002', 'Bran', [0, 0, 6])] });
  r2.magic.readySpell(spellOf(0, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.equal(selfEffects(p2), 0, 'a mate among them: armed');
  assert.ok(r2.world.said.includes(ALLY_ARMED_LINE));
});

test('AUDIT SPELL-GIFT B6: a STRANGER\'s Cure Disease leaves an incubating infection be - a player choosing the curse lost it to anyone passing - and cures the rest; a party mate\'s cures as ever (mutants: the stranger\'s flag never read)', () => {
  const infected = () => { const p = mkPlayer(); p.activeEffects.push(createInfection(INFECTION.Vampirism), { kind: 'disease', disease: 3, daysOfSymptomsLeft: 5, statMods: {} }); return p; };
  const cure = allyCastSpell({ name: 'Cure', effects: [fx(3, 0, 0)] }, { stranger: true });
  assert.ok(cure, 'Cure Disease is on the stranger\'s list');
  const p1 = infected();
  magicRig(p1).magic.applySpellToPlayer(cure, 10, null, { allyCast: true, strangerCast: true });
  assert.deepEqual(p1.activeEffects.filter((a) => a.kind === 'disease').map((a) => !!a.infection), [true], 'the infection stays, the plain disease is cured');
  const p2 = infected();
  magicRig(p2).magic.applySpellToPlayer(cure, 10, null, { allyCast: true, strangerCast: false });
  assert.equal(p2.activeEffects.filter((a) => a.kind === 'disease').length, 0, 'a mate\'s cures both');
});
