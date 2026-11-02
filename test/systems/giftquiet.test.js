// GIFT-QUIET (2026-10-04: "sometimes theres notification spam when putting a spell on companion. Ensure there's no
// leftover notifications"): a gift's lines - the armed ready's ("Press button to fire spell." and "Aim at your
// companion..."), the caster's ("You cast Heal on Hilda.") and a party mate's on the receiving end ("Bran casts Heal on
// you.") - are said at most once in GIFT_LINE_QUIET_S of real time (systems/allyCast.js createGiftLineGate;
// scenes/hostMagic.js sayGift and sayArm; scenes/world.js online.onCast). Each was a new toast every cast and told apart
// from the line before it, so the notice stack's repeat guard (ui/hud/hudText.js NOTICE-SPAM: the back row only) never
// caught them - a heal cast again and again near a companion stacked three plates a cast in the Enhanced notice panel.
// The 2026-10-04 audit: an arm unlike the last ready's is said whatever the window, and asking inside the window does
// not hold a line back longer.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { COMPANION_ARMED_LINE, ALLY_ARMED_LINE, GIFT_LINE_QUIET_S, createGiftLineGate } from '../../src/systems/allyCast.js';
import { PRESS_BUTTON_TO_FIRE_SPELL } from '../../src/systems/mysticism.js';
import { HudText } from '../../src/ui/hud/hudText.js';

const fx = (type, subType = 0, mag = 20, dur = 0) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8);
const spellOf = (rangeType) => ({ name: 'Balyna\'s Balm', index: 90, element: 4, rangeType, effects: [HEAL, EMPTY, EMPTY], icon: 7 });
const mkPlayer = () => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 5000, maxMagicka: 5000, magicka: 5000,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
const hilda = (at) => ({
  companion: '42:Hilda', shipmate: true, dead: false,
  entity: { name: 'Hilda', health: 10, maxHealth: 5000, magicka: 0, maxMagicka: 0, fatigue: 100, maxFatigue: 100, level: 3, activeEffects: [],
    stats: { strength: 50, intelligence: 40, willpower: 40, agility: 50, endurance: 50, personality: 40, speed: 50, luck: 40 }, skills: new Array(40).fill(30), career: {}, team: 'PlayerAlly' },
  ai: { feet: [...at], height: 1.8 },
});
const NEAR = [1.5, 0, -1];      // within ALLY_ARM_RADIUS, off the aim
const AIMED = [0, 0, 2];        // under the crosshair, at touch reach
const AWAY = [40, 0, 0];        // far off
/** The engine with my companion `her` (whose feet a test may move) and, optionally, party mates (`mates`, the bodies;
 *  `pick`, the crosshair's mate); the aim runs from [0, 0.9, 0] along +z. What it says goes into a HudText (the notice
 *  stack's model - one Enhanced plate a row): `most` the most rows it held at once. The clock is the test's (`wait`). */
function rig({ her = hilda(NEAR), mates = null, pick = null } = {}) {
  const said = [], frames = [];
  const hud = new HudText('giftquiet');
  let most = 0, nowMs = 0;
  const player = mkPlayer();
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity, heightAt: () => -100 },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health += n; }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} },
    say: (l) => { said.push(l); hud.add(l); most = Math.max(most, hud.lines.length); }, surfacePlayer() {},
    foes: () => [],
    foeSinks: (f) => ({ hurt() {}, heal(n) { f.entity.health += n; }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99, startCastAnim: null,
    companionBodies: () => (her ? [her] : []),
    ...(mates ? {
      allyMarks: () => mates,
      allyTarget: () => pick,
      castAtAlly: (id, frame) => { frames.push({ id, frame }); return true; },
    } : {}),
    giftClockMs: () => nowMs,
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  /** `s` seconds: the test's clock, and the notice stack's frames. */
  const wait = (s) => { nowMs += s * 1000; for (let i = 0; i < Math.round(s * 30); i++) hud.tick(1 / 30); };
  /** Ready the spell and click, aimed along +z. */
  const cast = (rangeType) => { magic.readySpell(spellOf(rangeType)); magic.castInput([0, 0.9, 0], [0, 0, 1]); };
  return { magic, said, frames, player, most: () => most, wait, cast };
}
const count = (said, line) => said.filter((l) => l === line).length;
const mate = (id, name, feet) => ({ id, name, feet, height: 1.8 });

test('GIFT-QUIET: the window is ten seconds of real time', () => {
  assert.equal(GIFT_LINE_QUIET_S, 10);
});

test('GIFT-QUIET: six heals with my companion near, a second apart - her armed lines said once, every heal said, and the notice stack never holds more than three plates, where it climbed to eleven (mutants: the gift lines said every time)', () => {
  const r = rig();
  for (let k = 0; k < 6; k++) { r.cast(0); r.wait(1); }
  assert.equal(r.player.health, 20 + 6 * 20, 'aimed past her: every heal mine');
  assert.equal(count(r.said, PRESS_BUTTON_TO_FIRE_SPELL), 1, r.said.join(' | '));
  assert.equal(count(r.said, COMPANION_ARMED_LINE), 1, r.said.join(' | '));
  assert.equal(count(r.said, 'You are healed 20 points.'), 6, 'an event, not a gift line');
  assert.ok(r.most() <= 3, `at most the armed pair and the heal on screen (held ${r.most()})`);
});

test('GIFT-QUIET: six touches on my companion - the caster\'s line said once, DFU\'s own ready line every time, and the stack holds three plates at most, where it climbed to ten (mutants: her caster line said every cast)', () => {
  const her = hilda(AIMED);
  const r = rig({ her });
  for (let k = 0; k < 6; k++) { r.cast(1); r.wait(1); }
  assert.equal(her.entity.health, 10 + 6 * 20, 'every touch healed her');
  assert.equal(count(r.said, 'You cast Balyna\'s Balm on Hilda.'), 1, r.said.join(' | '));
  assert.equal(count(r.said, PRESS_BUTTON_TO_FIRE_SPELL), 6, 'the classic ready line is DFU\'s and stays');
  assert.ok(r.most() <= 3, `ready, cast, ready - the rest merged (held ${r.most()})`);
});

test('GIFT-QUIET: a line asked for again and again is said again once the window has passed since it was SAID - asking does not hold it back longer (mutants: the window kept open by every asking, the gate never closing)', () => {
  const r = rig();
  for (let k = 0; k < 5; k++) { r.cast(0); r.wait(3); }   // asked at 0, 3, 6, 9 and 12 s
  assert.equal(count(r.said, COMPANION_ARMED_LINE), 2, `at 0 s and at 12 s: ${r.said.join(' | ')}`);
  assert.equal(count(r.said, PRESS_BUTTON_TO_FIRE_SPELL), 2);
});

test('GIFT-QUIET (the 2026-10-04 audit): an arm unlike the last ready\'s is said whatever the window - she steps off and the heal fires on the spot, she comes back and it arms: said again; under the crosshair after near: said again (mutants: the arm never fresh, a ready that arms nothing keeping the arm)', () => {
  const her = hilda(NEAR);
  const r = rig({ her });
  r.cast(0);                                    // armed near: both lines
  r.wait(1); her.ai.feet = [...AWAY];
  r.magic.readySpell(spellOf(0));               // nobody near: DFU's instant cast, nothing armed
  assert.equal(r.magic.readied(), null, 'fired on the spot');
  r.wait(1); her.ai.feet = [...NEAR];
  r.magic.readySpell(spellOf(0));               // armed again, inside the window
  assert.equal(r.magic.readied()?.name, 'Balyna\'s Balm', 'it waits for the click');
  assert.equal(count(r.said, COMPANION_ARMED_LINE), 2, `armed again, said again: ${r.said.join(' | ')}`);
  r.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  r.wait(1); her.ai.feet = [...AIMED];
  r.magic.readySpell(spellOf(0));               // now under the crosshair: another arm
  assert.equal(count(r.said, PRESS_BUTTON_TO_FIRE_SPELL), 3, r.said.join(' | '));
  r.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  r.wait(1);
  r.magic.readySpell(spellOf(0));               // the same arm again, inside the window: quiet
  assert.equal(count(r.said, PRESS_BUTTON_TO_FIRE_SPELL), 3, r.said.join(' | '));
});

test('GIFT-QUIET: a PARTY MATE\'s gift lines are held the same way - the CasterOnly crosshair cast, the touch, the blast, the near arm (mutants: each site said every cast)', () => {
  const bran = mate('peer-0002', 'Bran', [0, 0, 2]);
  // the crosshair: a CasterOnly heal readied at Bran goes to him (releaseFrame's ally arm)
  const a = rig({ her: null, mates: [bran], pick: { id: 'peer-0002', name: 'Bran', distance: 2 } });
  for (let k = 0; k < 4; k++) { a.cast(0); a.wait(1); }
  assert.equal(a.frames.length, 4, 'four gifts sent');
  assert.equal(count(a.said, 'You cast Balyna\'s Balm on Bran.'), 1, a.said.join(' | '));
  assert.equal(count(a.said, PRESS_BUTTON_TO_FIRE_SPELL), 1, 'the crosshair arm once');
  // by touch, with no crosshair pick: the touch meets his body (giveToAlly)
  const b = rig({ her: null, mates: [bran] });
  for (let k = 0; k < 4; k++) { b.cast(1); b.wait(1); }
  assert.equal(b.frames.length, 4);
  assert.equal(count(b.said, 'You cast Balyna\'s Balm on Bran.'), 1, b.said.join(' | '));
  // the blast around me: Bran and Hilda in it, one line each kind (giveToAllies, giveToCompanions)
  const c = rig({ her: hilda([1, 0, 1]), mates: [mate('peer-0002', 'Bran', [-1, 0, 1])] });
  for (let k = 0; k < 4; k++) { c.cast(3); c.wait(1); }
  assert.equal(c.frames.length, 4);
  assert.equal(count(c.said, 'You cast Balyna\'s Balm on Bran.'), 1, c.said.join(' | '));
  assert.equal(count(c.said, 'You cast Balyna\'s Balm on Hilda.'), 1, c.said.join(' | '));
  // near, not aimed at: the mate's arm, once
  const d = rig({ her: null, mates: [mate('peer-0002', 'Bran', [3, 0, -2])] });
  for (let k = 0; k < 4; k++) { d.cast(0); d.wait(1); }
  assert.equal(count(d.said, ALLY_ARMED_LINE), 1, d.said.join(' | '));
});

test('GIFT-QUIET: the gate - said fresh, never said, or said a window ago; held inside it however often asked; `fresh` passes it (mutants: the comparison turned, the asking refreshing the stamp)', () => {
  let t = 0;
  const pass = createGiftLineGate(() => t);
  assert.equal(pass('a'), true, 'never said');
  t = 4000; assert.equal(pass('a'), false, 'inside');
  t = 8000; assert.equal(pass('a'), false, 'inside, asked again');
  t = 10000; assert.equal(pass('a'), true, 'a window since it was SAID, not since it was asked');
  t = 10001; assert.equal(pass('b'), true, 'its own line');
  assert.equal(pass('a', true), true, 'fresh');
});

test('GIFT-QUIET by source: a party mate\'s gift on my side says its line through the gate - a stranger\'s keeps its own rate, and the heal\'s line stays', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const _mateGiftGate = createGiftLineGate\(\);/);
  assert.match(w, /const targetLine = allyCastTargetLine\(who, spell\.name\);\s*\n\s*if \(loud && \(!mate \|\| _mateGiftGate\(targetLine\)\)\) townTalk\.say\(targetLine\);/);
  assert.match(w, /if \(healed > 0 && loud\) townTalk\.say\(`You are healed \$\{healed\} points\.`\);/);
});
