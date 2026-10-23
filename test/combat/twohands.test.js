// TWO-HANDS (2026-10-16, bible/05-Combat/Two-Hands.md): both fists up, a pair of weapons, the hands that run - the law
// (combat/twoHands/handsLaw.js), the swing it times and the blow it lands (combat/playerWeapon.js, characters/weaponStates.js),
// and the sprite lane's two hands drawn through a real weapon rig (combat/twoHands/twoHands.js, combat/weapon/weaponRig.js) on a
// synthetic WEAPON CIF. The Morrowind lane's pins are test/combat/twohands_mw.test.js.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  HANDS_MODE, DUAL_TYPES, dualEligible, handsModeOf, twoHanded, otherHand, strikeHandOf, FLURRY_WINDOW,
  mirrorStrike, mirrorRect, MIRROR_UV, handOnLeft, DUAL, offHandToHit, offHandBurden, offHandHold, offHandDamage, OFF_HAND_BLOW,
  GUARD, guardStep, guardOffset, RUN_STEP_M, RUN_PUMP, runPhaseStep, runHandsWanted, pumpOf, runWeightStep, easeTo,
  RUN_3D, pumpTarget3D, MELEE_PAINTED_ARM, strikePicture, runPhaseOfBob, runHandsKept,
} from '../../src/combat/twoHands/handsLaw.js';
import { PlayerWeapon, handDesc } from '../../src/combat/playerWeapon.js';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { WEAPON_TYPES, weaponTypeForItem, WEAPON_FILE, getWeaponAnims, STATE_INDEX } from '../../src/combat/fpsWeapon.js';
import { CifRciFile } from '../../src/formats/cifRciFile.js';
import { ITEM_HANDS } from '../../src/characters/equipTable.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { WALK_STEP_INTERVAL } from '../../src/systems/footsteps.js';
import { getMeleeWeaponAnimTime, swingFrameSeconds, SWING_FRAME_MAX, swingHeft, createWeaponMachine, machineAttack, machineStep, blowSchedule } from '../../src/characters/weaponStates.js';
import { resetToDefaults, setValue } from '../../src/systems/settings/settings.js';
import { _resetModSettings, setModSetting, MOD_SETTINGS as MOD_KEYS } from '../../src/systems/modSettings.js';
import { registerFormulaOverride, setPlayerAttackHook, registerPlayerStrikeListener, calculateAttackDamage } from '../../src/combat/formulas.js';
import { installPcaao } from '../../src/combat/pcaao.js';
import { modsOff } from '../modsOff.js';
import { ENCHANTMENT_TYPES } from '../../src/systems/enchantments.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { SKILLS } from '../../src/systems/skills.js';
import { tallySwingSkills } from '../../src/scenes/hostCombat.js';
import { resolveDuelStrike, duelAttackerOf, duelWeaponOf, duelStandIn } from '../../src/combat/duelCombat.js';
import { registerMeleeWeaponAnimTime } from '../../src/characters/weaponStates.js';
import { HeadBobber } from '../../src/player/headBobber.js';
import { motionBagOf } from '../../src/player/motor.js';
import { techniqueItem } from '../../src/combat/techniques.js';
import { createTwoHands } from '../../src/combat/twoHands/twoHands.js';
import { createWeaponWidget } from '../../src/combat/weapon/weaponWidget.js';
import { fpArm } from '../../src/combat/fpArm.js';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { Renderer } from '../../src/render/renderer.js';
import { glowRingDraws, glowPad } from '../../src/render/weaponGlowGlsl.js';
import { drawRigSpriteBox } from '../../src/render/characterSprite.js';
import { perspective, lookAt } from '../../src/world/mat4.js';
import { glowSpec } from '../../src/systems/weaponGlow.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const weapon = (templateIndex, name) => ({ name, group: 'Weapons', templateIndex, material: 0 });
const KATANA = weapon(121, 'Katana');
const DAGGER = weapon(113, 'Dagger');
const LONGSWORD = weapon(120, 'Longsword');
const CLAYMORE = weapon(122, 'Claymore');
const LONG_BOW = weapon(130, 'Long Bow');
const BUCKLER = { name: 'Buckler', group: 'Armor', templateIndex: 109, material: 0 };
const desc = (item) => handDesc(item);

// ---- THE LAW ---------------------------------------------------------------------------------------------------------

test('TWO-HANDS law: the hands\' modes - both empty is the fists, two one-handed melee weapons the pair, and everything else DFU\'s one used hand (a shield, a two-hander, a bow, the beast, a light in a hand)', () => {
  assert.equal(handsModeOf({}), HANDS_MODE.Fists, 'nothing in either hand');
  assert.equal(handsModeOf({ right: desc(KATANA), left: desc(DAGGER) }), HANDS_MODE.Dual);
  assert.equal(handsModeOf({ right: desc(DAGGER), left: desc(LONGSWORD) }), HANDS_MODE.Dual, 'either way round');
  assert.equal(handsModeOf({ right: desc(KATANA) }), HANDS_MODE.Single, 'one weapon, one hand');
  assert.equal(handsModeOf({ left: desc(DAGGER) }), HANDS_MODE.Single, 'one weapon in the left');
  assert.equal(handsModeOf({ right: desc(CLAYMORE) }), HANDS_MODE.Single, 'a two-hander');
  assert.equal(handsModeOf({ right: desc(KATANA), left: desc(CLAYMORE) }), HANDS_MODE.Single, 'never a two-hander in a pair');
  assert.equal(handsModeOf({ right: desc(KATANA), left: desc(LONG_BOW) }), HANDS_MODE.Single, 'never a bow in a pair');
  assert.equal(handsModeOf({ left: { item: true, shield: true } }), HANDS_MODE.Single, 'a fist and a shield are DFU\'s');
  assert.equal(handsModeOf({ claws: true }), HANDS_MODE.Single, 'the beast\'s claws are one sprite');
  assert.equal(handsModeOf({ claws: true, right: desc(KATANA), left: desc(DAGGER) }), HANDS_MODE.Single);
  assert.equal(handsModeOf({ leftBusy: true }), HANDS_MODE.Single, 'a light in a hand takes it: one fist beside it');
  assert.equal(handsModeOf({ leftBusy: true, right: desc(KATANA), left: desc(DAGGER) }), HANDS_MODE.Single);
  assert.equal(twoHanded(HANDS_MODE.Fists), true); assert.equal(twoHanded(HANDS_MODE.Dual), true); assert.equal(twoHanded(HANDS_MODE.Single), false);
  // the leaf's two tables, pinned to their homes
  const T = WEAPON_TYPES;
  assert.deepEqual([...DUAL_TYPES].sort((a, b) => a - b), [T.LongBlade, T.LongBlade_Magic, T.Dagger, T.Dagger_Magic, T.Mace, T.Mace_Magic,
    T.Flail, T.Flail_Magic, T.Warhammer, T.Warhammer_Magic, T.Battleaxe, T.Battleaxe_Magic].sort((a, b) => a - b));
  for (const t of [T.Staff, T.Staff_Magic, T.Bow, T.Melee, T.Werecreature, T.Thunderlock, T.Thunderlock_Magic]) {
    assert.equal(dualEligible({ item: true, type: t, hands: ITEM_HANDS.Either }), false, `type ${t}`);
  }
  assert.equal(dualEligible({ item: true, type: T.Mace, hands: ITEM_HANDS.Both }), false, 'ItemHands.Both is the leaf\'s 4');
  assert.equal(dualEligible({ item: true, type: T.Mace, hands: ITEM_HANDS.Either }), true);
  assert.equal(dualEligible({ item: true, type: T.Mace, hands: ITEM_HANDS.Either, shield: true }), false);
});

test('TWO-HANDS law: which hand strikes - the lead opens an exchange, the other hand answers within the flurry\'s window, and a pause hands it back to the lead; one hand in use is always the lead; the fists carry no off-hand cost', () => {
  const S = HANDS_MODE;
  assert.deepEqual(strikeHandOf({ mode: S.Single, lead: 'L', last: 'L', sinceLast: 0 }), { hand: 'L', flurry: false, off: false });
  assert.deepEqual(strikeHandOf({ mode: S.Dual, lead: 'R' }), { hand: 'R', flurry: false, off: false }, 'the opening');
  assert.deepEqual(strikeHandOf({ mode: S.Dual, lead: 'R', last: 'R', sinceLast: 0.1 }), { hand: 'L', flurry: true, off: true }, 'the answer');
  assert.deepEqual(strikeHandOf({ mode: S.Dual, lead: 'R', last: 'L', sinceLast: FLURRY_WINDOW }), { hand: 'R', flurry: true, off: false }, 'the window is inclusive');
  assert.deepEqual(strikeHandOf({ mode: S.Dual, lead: 'R', last: 'L', sinceLast: FLURRY_WINDOW + 0.01 }), { hand: 'R', flurry: false, off: false }, 'a pause: the lead again');
  assert.deepEqual(strikeHandOf({ mode: S.Dual, lead: 'L', last: 'L', sinceLast: 0 }), { hand: 'R', flurry: true, off: true }, 'a left lead\'s off hand is the right');
  assert.deepEqual(strikeHandOf({ mode: S.Fists, lead: 'R', last: 'R', sinceLast: 0 }), { hand: 'L', flurry: false, off: false }, 'the fists alternate at DFU\'s numbers');
  assert.equal(otherHand('R'), 'L'); assert.equal(otherHand('L'), 'R');
  assert.equal(FLURRY_WINDOW, 0.75);
  assert.ok(FLURRY_WINDOW > SWING_FRAME_MAX, 'a beat longer than the slowest frame');
});

test('TWO-HANDS law: the mirror - a left hand is a right hand in the glass: its strike mapped, its rect mirrored about the screen\'s middle, and the side each hand is drawn on (a left-handed player\'s whole picture mirrored)', () => {
  assert.equal(mirrorStrike('StrikeLeft'), 'StrikeRight'); assert.equal(mirrorStrike('StrikeRight'), 'StrikeLeft');
  assert.equal(mirrorStrike('StrikeDownLeft'), 'StrikeDownRight'); assert.equal(mirrorStrike('StrikeDownRight'), 'StrikeDownLeft');
  for (const s of ['Idle', 'StrikeDown', 'StrikeUp']) assert.equal(mirrorStrike(s), s);
  assert.deepEqual(mirrorRect({ x: 232, y: 170, w: 40, h: 30 }, 320), { x: 48, y: 170, w: 40, h: 30 });
  assert.deepEqual(mirrorRect({ x: 110, y: 0, w: 10, h: 1 }, 200, 50), { x: 180, y: 0, w: 10, h: 1 }, 'about a screen that starts at x0 (60 in from either edge)');
  assert.deepEqual(MIRROR_UV, { u0: 1, v0: 0, u1: 0, v1: 1 });
  assert.equal(handOnLeft('L', false), true); assert.equal(handOnLeft('R', false), false);
  assert.equal(handOnLeft('L', true), false); assert.equal(handOnLeft('R', true), true);
});

test('TWO-HANDS law: THE PAINTED ARM - the bare hand\'s art paints both arms (its idle, StrikeDownLeft, StrikeRight and StrikeDownRight the right; StrikeDown, StrikeLeft and StrikeUp the left), a weapon\'s the right alone; a hand\'s picture is its own arm on its own side, the asked way across wherever the art has it, and its mirror is exactly "the painted arm is not this side"', () => {
  assert.deepEqual([...MELEE_PAINTED_ARM], ['R', 'L', 'R', 'L', 'R', 'R', 'L']);
  const STATES = ['Idle', 'StrikeDown', 'StrikeDownLeft', 'StrikeLeft', 'StrikeRight', 'StrikeDownRight', 'StrikeUp'];
  const melee = (st) => MELEE_PAINTED_ARM[STATES.indexOf(st)];
  // a weapon: DFU's own picture for the right hand, the mirror of the mirrored strike for the left - as it always was
  for (const st of STATES) {
    assert.deepEqual(strikePicture('R', st), { state: st, mirror: false });
    assert.deepEqual(strikePicture('L', st), { state: mirrorStrike(st), mirror: true });
    assert.deepEqual(strikePicture('R', st, { leftHanded: true }), { state: mirrorStrike(st), mirror: true }, 'a left-handed player\'s right hand is on the left');
  }
  // the fists, every hand and strike: the expected picture, case by case
  const want = {
    R: { Idle: ['Idle', false], StrikeDown: ['StrikeDown', true], StrikeDownLeft: ['StrikeDownLeft', false], StrikeLeft: ['StrikeRight', false],
      StrikeRight: ['StrikeRight', false], StrikeDownRight: ['StrikeDownRight', false], StrikeUp: ['StrikeUp', true] },
    L: { Idle: ['Idle', true], StrikeDown: ['StrikeDown', false], StrikeDownLeft: ['StrikeDownRight', true], StrikeLeft: ['StrikeLeft', false],
      StrikeRight: ['StrikeLeft', false], StrikeDownRight: ['StrikeDownLeft', true], StrikeUp: ['StrikeUp', false] },
  };
  for (const hand of /** @type {const} */ (['R', 'L'])) {
    for (const st of STATES) {
      const p = strikePicture(hand, st, { painted: melee });
      assert.deepEqual([p.state, p.mirror], want[hand][st], `${hand} ${st}`);
      const shown = p.mirror ? otherHand(melee(p.state)) : melee(p.state);
      assert.equal(shown, hand, `${hand} ${st}: the arm on the screen is the hand's`);
      assert.equal(p.mirror, melee(p.state) !== hand, 'the one rule: mirrored exactly when the painted arm is not this side');
      // the way across the screen: the asked one, or - where the art has this hand only the other way - its mirror
      assert.ok(p.state === st || p.state === mirrorStrike(st));
    }
  }
});

test('TWO-HANDS law: THE BALANCE - the pair is tempo, not twice the damage: the flurry thrown from the raised hand (a frame into its swing), the off hand\'s surety by Agility and its share of the damage, its burden by weight; and MEASURED THROUGH THE MACHINE at two frame rates - a quarter more swings and about 9% more damage a second for a matched pair at either, a quarter more fatigue a second', () => {
  assert.deepEqual({ ...DUAL }, { FLURRY_FROM_FRAME: 1, OFF_DAMAGE: 0.8, OFF_TO_HIT: -5, OFF_TO_HIT_PER_AGILITY: 0.1, OFF_TO_HIT_MIN: -10, OFF_TO_HIT_MAX: 0, OFF_WEIGHT: 1.5 });
  assert.deepEqual([0, 30, 44, 45, 50, 55, 70, 100, 140].map(offHandToHit), [-10, -7, -6, -5, -5, -4, -3, 0, 0], 'the rounded tenth of (Agility - 50), held in [-10, 0]');
  assert.equal(offHandToHit(NaN), -5, 'no Agility reads as 50');
  assert.deepEqual([0, -3, 1, 2, 4, 8, 13].map(offHandDamage), [0, -3, 1, 2, 3, 6, 10], 'a miss stays a miss, a landed blow at least 1');
  assert.equal(offHandBurden(0.5, 50), 1, 'a dagger costs the off arm nothing');
  assert.ok(Math.abs(offHandBurden(4.5, 50) - swingHeft(6.75, 50) / swingHeft(4.5, 50)) < 1e-12);
  assert.ok(offHandBurden(4.5, 50) > 1.08 && offHandBurden(4.5, 50) < 1.12, 'a longsword a tenth');
  assert.ok(offHandBurden(4.5, 90) < offHandBurden(4.5, 50), 'a strong arm feels it less');
  // AUDIT 2: THE BURDEN IN WHOLE TICKS, held at the blow's end, the fraction carried to the next
  assert.deepEqual(offHandHold({}), { hold: 0, carry: 0 }, 'no burden, nothing held');
  assert.deepEqual(offHandHold({ burden: 1, ticks: 4, tick: 0.2, carry: 0.25 }), { hold: 0, carry: 0.25 }, 'a dagger owes nothing new; the carry waits');
  const h1 = offHandHold({ burden: 1.1, ticks: 4, tick: 0.2 });
  assert.ok(h1.hold === 0 && Math.abs(h1.carry - 0.4) < 1e-9, `0.4 of a tick owed, none held yet (${JSON.stringify(h1)})`);
  const h3 = [0, 1, 2].reduce((c) => offHandHold({ burden: 1.1, ticks: 4, tick: 0.2, carry: c.carry }), { carry: 0 });
  assert.ok(h3.hold === 1 && Math.abs(h3.carry - 0.2) < 1e-9, `the third blow holds one: 3 x 0.4 = 1.2 (${JSON.stringify(h3)})`);
  let paid = 0, carry = 0;
  for (let n = 0; n < 1000; n++) { const h = offHandHold({ burden: offHandBurden(4.5, 50), ticks: 4, tick: 0.2, carry }); paid += h.hold; carry = h.carry; }
  assert.ok(Math.abs(paid + carry - 1000 * 4 * (offHandBurden(4.5, 50) - 1)) < 1e-6, 'over a fight the burden is paid exactly');
  assert.deepEqual(offHandHold({ burden: 1.3, ticks: 5, tick: SWING_FRAME_MAX }), { hold: 0, carry: 0 }, 'no blow a tick slower than SWING-LAW\'s slowest');
  const capped = offHandHold({ burden: 1.3, ticks: 10, tick: SWING_FRAME_MAX / 1.1 });
  assert.ok(capped.hold === 1 && capped.carry < 1e-9, `held to the slowest frame: 10 ticks owe one, not three (${JSON.stringify(capped)})`);
  // THE MEASUREMENT, through the real machine (it steps a frame at a time and drops each tick's remainder - DFU's
  // coroutine): a held button, one dagger against two, the record's 65% model on the off hand's own terms
  const run = (right, left, dt) => {
    const pw = new PlayerWeapon({ liveSpeed: 50 });
    const entity = { stats: { speed: 50, strength: 50, agility: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: right, [EQUIP_SLOTS.LeftHand]: left } } };
    pw.updateHands(right, left); pw.applyWeapon(); pw.animCtx = () => pw.swingCtx(entity);
    let n = 0, dmg = 0;
    for (let t = 0; t < 120; t += dt) {
      if (pw.machine.state === 'Idle' && pw.clickAttack(() => 0.5)) { n++; dmg += pw.strike.off ? (0.65 + offHandToHit(50) / 100) * DUAL.OFF_DAMAGE : 0.65; }
      pw.update(dt); pw.updateHands(right, left); pw.applyWeapon();
    }
    return { n, dmg };
  };
  for (const fps of [30, 144]) {
    const one = run(weapon(113, 'a'), null, 1 / fps), two = run(weapon(113, 'a'), weapon(113, 'b'), 1 / fps);
    const swings = two.n / one.n, edge = two.dmg / one.dmg;
    assert.ok(swings > 1.22 && swings < 1.28, `${fps} fps: a quarter more swings (${swings.toFixed(3)}) - DFU's fatigue a swing, a quarter more a second`);
    assert.ok(edge > 1.06 && edge < 1.11, `${fps} fps: about 9% more damage a second (${edge.toFixed(3)}), whatever the frame rate`);
  }
  // AUDIT 2: A HEAVY OFF WEAPON'S BURDEN IS THE SAME AT EVERY FRAME RATE - paid in whole ticks held at its blows' end
  // (offHandHold), where the first audit's factor on the tick's time made a longsword pair x1.165 at 30 fps and x1.204 at
  // 60. A held exchange is lead, off, lead, off: 4 ticks, then 4 and the burden's (b - 1) x 4
  const b = offHandBurden(templateByIndex(120).baseWeight, 50);
  assert.ok(b > 1.05, `a longsword is felt in the off hand (${b})`);
  const want = 5 / (4 + 2 * (b - 1));
  const rates = [30, 60, 144, 1000].map((fps) => run(LONGSWORD, weapon(120, 'b'), 1 / fps).n / run(LONGSWORD, null, 1 / fps).n);
  for (const r of rates) assert.ok(Math.abs(r - want) < 0.006, `x${r.toFixed(4)} as often as one longsword, the ticks' own x${want.toFixed(4)}, at 30, 60, 144 and 1000 fps: ${rates.map((x) => x.toFixed(4))}`);
});

test('TWO-HANDS law: the guard, the run - the guard\'s follower eased in fast and out slower, its offset toward the middle and down; one stroke a step on the footstep interval, the pump\'s place, the run\'s gate and its weight', () => {
  assert.equal(RUN_STEP_M, WALK_STEP_INTERVAL, 'PlayerFootsteps.WalkStepInterval, the head bob\'s own clock');
  assert.equal(easeTo(0, 1, 0, 0.1), 1, 'a zero time constant arrives');
  const g1 = guardStep(0, true, GUARD.IN_TAU), g2 = guardStep(1, false, GUARD.OUT_TAU);
  assert.ok(Math.abs(g1 - (1 - Math.exp(-1))) < 1e-9 && Math.abs(g2 - Math.exp(-1)) < 1e-9);
  assert.ok(GUARD.IN_TAU < GUARD.OUT_TAU, 'in fast, out slower');
  assert.deepEqual(guardOffset(1, 'right'), [-GUARD.IN, GUARD.DOWN], 'a right-side hand draws in to its left, and down');
  assert.deepEqual(guardOffset(1, 'left'), [GUARD.IN, GUARD.DOWN]);
  assert.deepEqual(guardOffset(0, 'right'), [-0, 0]);
  // a pair's resting WEAPON lowers by a share of its own height (Mac: "the other weapon in hand should lower slightly")
  assert.deepEqual(guardOffset(1, 'right', { height: 143 }), [0, GUARD.LOWER * 143], 'a dagger\'s picture, 143 design pixels tall - straight down');
  assert.deepEqual(guardOffset(0.5, 'left', { height: 86 }), [0, GUARD.LOWER * 86 * 0.5], 'a katana\'s, half way, never in: its cut side stays on the view\'s edge');
  assert.ok(GUARD.LOWER * 86 > GUARD.DOWN, 'a weapon dips past the fists\' nine pixels - the tuck did not read on a weapon');
  assert.ok(GUARD.LOWER <= 0.15, 'slightly: the dagger\'s hand stays in the view');
  // the fists' bounce, out of step - and (AUDIT 2) ONLY EVER DOWN: a sine about the rest lifted each cut wrist off the
  // view's bottom edge for half its beat
  const b = guardOffset(0, 'right', { time: 0.5 / GUARD.BOUNCE_HZ, bounce: 1, hand: 'R' })[1];
  const bl = guardOffset(0, 'right', { time: 0.5 / GUARD.BOUNCE_HZ, bounce: 1, hand: 'L' })[1];
  assert.ok(Math.abs(b - 2 * GUARD.BOUNCE_PX) < 1e-9 && Math.abs(bl) < 1e-9, `the fists bounce out of step: the right at its lowest as the left is at rest (${b}, ${bl})`);
  for (let k = 0; k < 64; k++) for (const hand of ['R', 'L']) assert.ok(guardOffset(0, 'left', { time: k / 64 / GUARD.BOUNCE_HZ, bounce: 1, hand })[1] >= 0, 'never above the rest');
  assert.deepEqual({ ...GUARD }, { IN: 10, DOWN: 9, LOWER: 0.12, IN_TAU: 0.05, OUT_TAU: 0.14, BOUNCE_PX: 1.6, BOUNCE_HZ: 1.15 }, 'the record\'s numbers (L5: each could change unseen)');
  // one step is PI of the stride, and the arms swing one stroke a step
  assert.ok(Math.abs(runPhaseStep(0, RUN_STEP_M, 1) - Math.PI) < 1e-9);
  assert.equal(runPhaseStep(1, 7, -1), 1, 'no backward time');
  const top = pumpOf(Math.PI / 2, 'R'), back = pumpOf(Math.PI / 2, 'L');
  assert.deepEqual([top.s, back.s], [1, -1], 'out of step by half a stride');
  // THE RUNNING ARM IS THE ART'S OWN: the rise's lowest frame, its foot on the view's edge at the top of the stroke - never
  // a lift; PIN MOVED (TWO-HANDS FIELD, Mac: "Too high, like uppercuts"): one frame, not the rise's 1-3 by how far up the
  // stroke is (2 and 3 are the punch's own peak, half the view high - the real-art pin below), on an even sine
  assert.deepEqual([top.dx, top.dy, top.frame], [RUN_PUMP.IN, 0, RUN_PUMP.ARM_FRAME], 'the top: in toward the middle, the foot on the edge - no lift');
  assert.deepEqual([back.dx, back.dy, back.frame], [-RUN_PUMP.OUT, RUN_PUMP.DROP, RUN_PUMP.ARM_FRAME], 'the bottom: out, down past the view');
  assert.ok(RUN_PUMP.DROP > 1, 'the bottom of the stroke leaves the view');
  assert.equal(RUN_PUMP.ARM_STATE, 'StrikeDownLeft', 'WEAPON10 record 2, the jab across - a closed fist seen from its back on its own forearm (PIN MOVED, TWO-HANDS FIELD: record 5, the uppercut, shows the fist\'s inside - Mac: "Why is the underhand showing when extended and not the fist")');
  assert.equal(RUN_PUMP.ARM_FRAME, 1, 'its frame that leaves only at the foot, a third of the view high (the real-art pin below)');
  assert.equal(MELEE_PAINTED_ARM[2], 'R', 'the right arm, mirrored for the left (one rule)');
  const mid = pumpOf(Math.PI / 6, 'R');   // sin = 0.5
  assert.ok(Math.abs(mid.s - 0.5) < 1e-9 && Math.abs(mid.dy - RUN_PUMP.DROP / 4) < 1e-9, 'an even stroke: no snap holding the fist at the top');
  for (let k = 0; k < 64; k++) {
    const p = pumpOf(k * Math.PI / 32, 'R'), q = pumpOf((k + 1) * Math.PI / 32, 'R');
    assert.ok(p.dy >= 0 && p.frame === RUN_PUMP.ARM_FRAME, 'never up: the pump only lowers a sprite');
    assert.ok((q.s - p.s) * (q.dy - p.dy) <= 1e-12, 'the arm rises as the stroke goes forward and falls as it goes back');
  }
  assert.deepEqual({ ...RUN_PUMP }, { ARM_STATE: 'StrikeDownLeft', ARM_FRAME: 1, DROP: 1.05, IN: 0.06, OUT: 0.03, SWAP: 0.5, IN_TAU: 0.12, OUT_TAU: 0.16, PUNCH_TAU: 0.04, MIN_SPEED: 1.0, CATCH: 0.5, AIR_GRACE: 0.6 }, 'the record\'s numbers (AUDIT 2, L5: each could change unseen)');
  const want = { running: true, grounded: true, speed: RUN_PUMP.MIN_SPEED, emptyHands: true };
  assert.equal(runHandsWanted(want), true);
  for (const [k, v] of [['running', false], ['standing', true], ['grounded', false], ['crouching', true], ['riding', true], ['swimming', true], ['climbing', true], ['emptyHands', false], ['attacking', true], ['speed', RUN_PUMP.MIN_SPEED - 0.01]]) {
    assert.equal(runHandsWanted({ ...want, [k]: v }), false, `not with ${k} = ${v}`);
  }
  const up = runWeightStep(0, true, false, RUN_PUMP.IN_TAU), down = runWeightStep(1, false, false, RUN_PUMP.OUT_TAU), punch = runWeightStep(1, true, true, RUN_PUMP.PUNCH_TAU);
  assert.ok(Math.abs(up - (1 - Math.exp(-1))) < 1e-9 && Math.abs(down - Math.exp(-1)) < 1e-9 && Math.abs(punch - Math.exp(-1)) < 1e-9);
  assert.ok(RUN_PUMP.PUNCH_TAU < RUN_PUMP.IN_TAU, 'a punch takes the fist at once');
  // the 3D stroke, the same stride
  const t3 = pumpTarget3D(Math.PI / 2, 'R'), b3 = pumpTarget3D(Math.PI / 2, 'L');
  assert.deepEqual([t3.x, t3.y, t3.d], [RUN_3D.TOP.x, RUN_3D.TOP.y, RUN_3D.TOP.d]);
  assert.deepEqual([b3.x, b3.y, b3.d], [RUN_3D.BOTTOM.x, RUN_3D.BOTTOM.y, RUN_3D.BOTTOM.d]);
  assert.ok(RUN_3D.TOP.y > -1 && RUN_3D.BOTTOM.y < -1, 'the top on the picture, the bottom under it');
});

// ---- THE SWING AND THE BLOW --------------------------------------------------------------------------------------------

test('TWO-HANDS the swing (AUDIT 2): a tick\'s time is the weapon\'s whatever the hand - nothing a ctx carries scales SWING-LAW\'s answer; an off-hand blow\'s burden is whole ticks HELD on its last frame, after its hit, and the schedule the Morrowind arm fits says so', () => {
  const entity = { stats: { speed: 50, strength: 50 }, equip: { slots: {} } };
  const base = getMeleeWeaponAnimTime(50, { entity, weaponType: WEAPON_TYPES.Melee });
  assert.equal(base, swingFrameSeconds(50, { handling: 0.9 }));
  assert.equal(getMeleeWeaponAnimTime(50, { entity, weaponType: WEAPON_TYPES.Melee, tempo: 1.5 }), base, 'the first audit\'s ctx.tempo is gone: it rounded to a different frame at every frame rate');
  assert.equal(getMeleeWeaponAnimTime(50, { tempo: 1.5 }), (3 * (115 - 50)) / 980, 'a foe\'s machine: DFU\'s line');
  // THE HOLD: on the last frame, one tick a resume, after the hit - the hit lands where DFU's does
  const walk = (hold) => {
    const m = createWeaponMachine(false);
    machineAttack(m, 'StrikeDown');
    m.hold = hold;
    const sched = blowSchedule(m, 50, null, 0);
    const seen = [];
    for (let i = 0; i < 20 && m.state !== 'Idle'; i++) { const ev = machineStep(m, 0.25, 50, null); seen.push(ev.includes('hit') ? `${m.frame}!` : String(m.frame)); }
    return { seen: seen.join(' '), ticks: Math.round(sched.seconds / sched.step), hitAt: Math.round(sched.hitAt / sched.step) };
  };
  assert.deepEqual(walk(0), { seen: '1 2! 3 4 0', ticks: 5, hitAt: 2 }, 'DFU\'s five ticks');
  assert.deepEqual(walk(2), { seen: '1 2! 3 4 4 4 0', ticks: 7, hitAt: 2 }, 'two held on the last frame; the hit and the schedule\'s hit unmoved, its end two ticks on');
  const fresh = createWeaponMachine(false);
  fresh.hold = 3; machineAttack(fresh, 'StrikeDown');
  assert.equal(fresh.hold, 0, 'every strike begins owing nothing - only its caller sets a hold');
  // THROUGH PLAYERWEAPON: the lead holds nothing; the off hand's longsword holds its burden's whole ticks, carrying the rest
  const pw = new PlayerWeapon({});
  const he = { stats: { speed: 50, strength: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: KATANA, [EQUIP_SLOTS.LeftHand]: LONGSWORD } } };
  pw.updateHands(KATANA, LONGSWORD); pw.applyWeapon(); pw.animCtx = () => pw.swingCtx(he);
  const b = offHandBurden(templateByIndex(120).baseWeight, 50);
  let offBlows = 0, held = 0;
  for (let n = 0; n < 40; n++) {
    assert.ok(pw.clickAttack(() => 0.5));
    if (pw.strike.off) { offBlows++; held += pw.machine.hold; } else assert.equal(pw.machine.hold, 0, 'the lead\'s blow holds nothing');
    assert.equal(pw.swingCtx(he).tempo, undefined, 'the ctx carries no factor');
    for (let i = 0; i < 600 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
    pw.applyWeapon();
  }
  assert.equal(offBlows, 20);
  assert.ok(Math.abs(held + pw._burdenCarry - offBlows * (5 - DUAL.FLURRY_FROM_FRAME) * (b - 1)) < 1e-9, `the burden paid exactly: ${held} ticks held + ${pw._burdenCarry.toFixed(3)} carried over ${offBlows} blows at x${b.toFixed(4)}`);
  assert.ok(held >= 1, 'and paid: a longsword in the off hand is felt');
});

test('TWO-HANDS PlayerWeapon: the mode off the caches, the strike\'s hand off the law, the weapon in use the striking hand\'s for the strike and the lead\'s again after it, the swing\'s ctx naming the striking hand, and the off hand\'s burden held in ticks', () => {
  const pw = new PlayerWeapon({});
  pw.updateHands(KATANA, DAGGER); pw.applyWeapon();
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.equal(pw.weapon, KATANA, 'at rest: the lead\'s');
  const entity = { stats: { speed: 50, strength: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: KATANA, [EQUIP_SLOTS.LeftHand]: DAGGER } } };
  pw.animCtx = () => pw.swingCtx(entity);
  const hands = [], weapons = [], holds = [], starts = [];
  for (let n = 0; n < 4; n++) {
    assert.ok(pw.clickAttack(() => 0.5), `strike ${n}`);
    hands.push(pw.strike.hand); weapons.push(pw.weapon.name);
    holds.push(pw.machine.hold); starts.push(pw.machine.frame);
    assert.equal(pw.swingCtx(entity).usingRightHand, pw.strike.hand === 'R', 'the ctx names the striking hand (RR reads its weapon)');
    for (let i = 0; i < 600 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
    assert.equal(pw.machine.state, 'Idle');
    pw.applyWeapon();
    assert.equal(pw.weapon, KATANA, 'back to the lead\'s');
  }
  assert.deepEqual(hands, ['R', 'L', 'R', 'L'], 'the exchange alternates');
  assert.deepEqual(weapons, ['Katana', 'Dagger', 'Katana', 'Dagger'], 'the weapon in use is the striking hand\'s');
  assert.deepEqual(starts, [0, DUAL.FLURRY_FROM_FRAME, DUAL.FLURRY_FROM_FRAME, DUAL.FLURRY_FROM_FRAME], 'the opening from the first frame, every answer from the raised hand');
  assert.deepEqual(holds, [0, 0, 0, 0], 'nothing held: a dagger in the off hand feels no burden, and the lead never does');
  // the Morrowind arm's pacing reads the strike from the frame it stands on (weaponStates.js blowSchedule)
  const pw2 = new PlayerWeapon({});
  pw2.updateHands(KATANA, DAGGER); pw2.applyWeapon(); pw2.animCtx = () => pw2.swingCtx(entity);
  pw2.clickAttack(() => 0.5);
  const open = pw2.strikeSchedule(1 / 60);
  for (let i = 0; i < 600 && pw2.machine.state !== 'Idle'; i++) pw2.update(1 / 60);
  pw2.applyWeapon(); pw2.clickAttack(() => 0.5);
  const answer = pw2.strikeSchedule(1 / 60);
  const ticks = (s) => [Math.round(s.seconds / s.step), Math.round(s.hitAt / s.step)];
  assert.deepEqual([ticks(open), ticks(answer)], [[5, 2], [4, 1]], `five ticks the hit at two; the answer four, the hit at one: ${JSON.stringify([open, answer])}`);
  // a pause hands the exchange back to the lead
  for (let i = 0; i < 60; i++) pw.update(1 / 60);
  pw.clickAttack(() => 0.5);
  assert.equal(pw.strike.hand, 'R');
  // H BETWEEN BLOWS (AUDIT): it picks the lead and ENDS the exchange - the next blow opens a new one, the new lead's,
  // from the first frame and with no off-hand cost owed to nobody; and nothing changes hands, so nothing is billed
  for (let i = 0; i < 600 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
  pw.applyWeapon();
  const billed = { equipCountdown: 0 };
  assert.equal(pw.toggleHand({ entity: billed, bowSwitching: true }), 'Using weapon in left hand.');
  assert.equal(billed.equipCountdown, 0, 'H with both hands up bills no switch');
  pw.applyWeapon(); pw.clickAttack(() => 0.5);
  assert.deepEqual(pw.strike, { hand: 'L', flurry: false, off: false }, 'a new exchange, opened by the new lead');
  assert.equal(pw.machine.frame, 0);
  for (let i = 0; i < 600 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
  pw.applyWeapon(); pw.clickAttack(() => 0.5);
  assert.deepEqual(pw.strike, { hand: 'R', flurry: true, off: true }, 'the old lead now answers, as the off hand');
  pw.toggleHand({ apply: true });
  for (let i = 0; i < 600 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
  // THE BURDEN UNDER A MOD'S ANSWER (AUDIT: Roleplay & Realism: Items' weaponBalance answers every swing in the game;
  // AUDIT 2: in ticks of whatever answered): the mod's tick is every blow's, and the off hand's burden is held in it
  const heavy = new PlayerWeapon({});
  const he = { stats: { speed: 50, strength: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: KATANA, [EQUIP_SLOTS.LeftHand]: LONGSWORD } } };
  heavy.updateHands(KATANA, LONGSWORD); heavy.applyWeapon(); heavy.animCtx = () => heavy.swingCtx(he);
  registerMeleeWeaponAnimTime(() => 0.2);
  try {
    heavy.clickAttack(() => 0.5);
    assert.equal(getMeleeWeaponAnimTime(50, heavy.swingCtx(he)), 0.2, 'the lead: the mod\'s answer');
    for (let i = 0; i < 600 && heavy.machine.state !== 'Idle'; i++) heavy.update(1 / 60);
    heavy.applyWeapon(); heavy.clickAttack(() => 0.5);
    const b = offHandBurden(templateByIndex(120).baseWeight, 50);
    assert.ok(heavy.strike.off && b > 1.05, `the off hand's longsword is felt (${b})`);
    assert.equal(getMeleeWeaponAnimTime(50, heavy.swingCtx(he)), 0.2, 'the off hand: the mod\'s answer too');
    assert.ok(Math.abs(heavy.machine.hold + heavy._burdenCarry - 4 * (b - 1)) < 1e-9, 'its burden owed in the mod\'s ticks');
  } finally { registerMeleeWeaponAnimTime(null); }
  // the fists: alternate, nothing held, no off
  const f = new PlayerWeapon({});
  f.updateHands(null, null); f.applyWeapon();
  assert.equal(f.handsMode, HANDS_MODE.Fists);
  const fe = { stats: { speed: 50, strength: 50 }, equip: { slots: {} } };
  const seen = [];
  for (let n = 0; n < 3; n++) {
    f.clickAttack(() => 0.5);
    seen.push([f.strike.hand, f.strike.flurry, f.strike.off, f.machine.hold]);
    for (let i = 0; i < 600 && f.machine.state !== 'Idle'; i++) f.update(1 / 60);
  }
  assert.deepEqual(seen, [['R', false, false, 0], ['L', false, false, 0], ['R', false, false, 0]]);
  // THE RESTING WEAPON (AUDIT: the HUD and a technique read it): the lead's through the off hand's blow
  const rw = new PlayerWeapon({});
  rw.updateHands(KATANA, DAGGER); rw.applyWeapon();
  rw.clickAttack(() => 0.5);
  for (let i = 0; i < 600 && rw.machine.state !== 'Idle'; i++) rw.update(1 / 60);
  rw.applyWeapon(); rw.clickAttack(() => 0.5);
  assert.equal(rw.strike.hand, 'L');
  assert.equal(rw.weapon, DAGGER, 'the weapon in use is the striking hand\'s');
  assert.equal(rw.restingWeapon, KATANA, 'the weapon at rest is the lead\'s');
  assert.equal(rw.offStrike, true, 'the off hand\'s blow - the flag every player-vs-player arm hands on');
  assert.equal(techniqueItem({ equip: { slots: {} } }, rw), KATANA, 'a technique reads the lead\'s weapon through the off hand\'s blow');
  // THE HANDS STOP BEING TWO MID-STRIKE (AUDIT: a quickslot swap has no attack gate): the weapon in use is the one hand's
  const mid = new PlayerWeapon({});
  mid.updateHands(null, null); mid.applyWeapon();
  mid.clickAttack(() => 0.5);
  for (let i = 0; i < 600 && mid.machine.state !== 'Idle'; i++) mid.update(1 / 60);
  mid.applyWeapon(); mid.clickAttack(() => 0.5);
  assert.equal(mid.strike.hand, 'L');
  mid.updateHands(KATANA, null); mid.applyWeapon();
  assert.equal(mid.handsMode, HANDS_MODE.Single);
  assert.equal(mid.weapon, KATANA, 'the katana taken mid-blow is the weapon in use, not the left fist\'s nothing');
  // a technique is the lead's whatever the exchange
  const t = new PlayerWeapon({});
  t.updateHands(KATANA, DAGGER); t.applyWeapon();
  t.clickAttack(() => 0.5);
  for (let i = 0; i < 600 && t.machine.state !== 'Idle'; i++) t.update(1 / 60);
  assert.ok(t.techniqueStrike('StrikeDown'));
  assert.deepEqual(t.strike, { hand: 'R', flurry: false, off: false });
  // a rig that drives its own weapon (no caches) stays single and its weapon untouched
  const own = new PlayerWeapon({});
  own.weapon = LONG_BOW;
  own.clickAttack(() => 0.5);
  assert.equal(own.weapon, LONG_BOW);
});

test('TWO-HANDS PlayerWeapon: THE OFF HAND\'S BLOW through the real formula - its to-hit term five points under the lead\'s at Agility 50, none at 100 (read where DFU\'s AdjustWeaponHitChanceMod sees it), and four fifths of the lead\'s damage on every roll both land - SEEN SO by the HUD and the strike listeners (the share is laid inside the formula); the lead\'s blow is DFU\'s, its flurry blows too; and the same terms on a blow between players', () => {
  const mods = [];
  registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, mod) => { mods.push(mod); return undefined; });
  const player = { isPlayer: true, level: 1, skills: 50, armor: 0, stats: { strength: 75, agility: 50, luck: 50, speed: 50 } };
  const foeEntity = () => ({ isPlayer: false, careerIndex: 0, health: 300, maxHealth: 300, armor: 0, skills: 30, minMetalToHit: -1, affinity: 'Human', stats: { strength: 50, agility: 50, luck: 50 } });
  const sweep = (off, flurry = off) => {
    const out = [];
    for (let k = 0; k < 100; k++) {
      const pw = new PlayerWeapon({});
      pw.updateHands(KATANA, DAGGER); pw.applyWeapon();
      pw.machine.state = 'StrikeLeft';
      pw.strike = { hand: off ? 'L' : 'R', flurry, off };
      pw.weapon = KATANA;   // the same weapon both ways: only the off hand's terms differ
      const roll = (k + 0.5) / 100;
      const res = pw.resolveHit([{ entity: foeEntity(), ai: { feet: [0, 0, 1] } }], player, () => ({ dist: 1, inView: true, losClear: true }), () => roll);
      out.push(res[0].damage);
    }
    return out;
  };
  try {
    mods.length = 0;
    const lead = sweep(false);
    const leadMods = mods.splice(0);
    const off = sweep(true);
    const offMods = mods.splice(0);
    assert.equal(leadMods.length, 100); assert.equal(offMods.length, 100);
    for (let k = 0; k < 100; k++) assert.equal(offMods[k] - leadMods[k], offHandToHit(50), `roll ${k}: five points less sure`);
    // the LEAD's flurry blow is DFU's exactly - its mods and its damage the opening's (AUDIT: flurry is not off)
    const leadFlurry = sweep(false, true);
    assert.deepEqual(mods.splice(0), leadMods, 'the lead\'s flurry blow: DFU\'s to-hit');
    assert.deepEqual(leadFlurry, lead, 'and DFU\'s damage');
    const hits = (a) => a.filter((d) => d > 0).length;
    assert.ok(hits(off) <= hits(lead), 'never surer');
    // the damage, on rolls both land: the chance raised past the clamp through the same hook, so nearly all do
    registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, mod) => mod + 1000);
    const leadSure = sweep(false), offSure = sweep(true);
    let both = 0;
    for (let k = 0; k < 100; k++) if (leadSure[k] > 0 && offSure[k] > 0) { both++; assert.equal(offSure[k], offHandDamage(leadSure[k]), `roll ${k}`); }
    // what the HUD and a strike listener (a leech, an echo) are told is the blow that LANDED (AUDIT: the share inside)
    const told = [], heard = [];
    setPlayerAttackHook((n) => told.push(n.damage));
    registerPlayerStrikeListener('twohands-test', (a, t, d) => heard.push(d));
    try {
      const landed = sweep(true);
      assert.deepEqual(told, landed, 'the HUD: every blow, the shared number');
      assert.deepEqual(heard, landed.filter((d) => d > 0), 'the strike listeners: every landed blow, the shared number');
    }
    finally { setPlayerAttackHook(null); registerPlayerStrikeListener('twohands-test', null); }
    assert.ok(both >= 80, `measured on ${both} rolls`);
    assert.ok(leadSure.some((d, k) => d > 0 && offSure[k] < d), 'and the off hand\'s is the lighter');
    registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, mod) => { mods.push(mod); return undefined; });
    assert.ok(lead.length === 100 && off.length === 100);
    // a surer hand at Agility 100
    player.stats.agility = 100;
    sweep(false); const lead100 = mods.splice(0);
    sweep(true); const off100 = mods.splice(0);
    assert.equal(off100[0] - lead100[0], offHandToHit(100));
    // A BLOW BETWEEN PLAYERS (combat/duelCombat.js resolveDuelStrike - every duel, siege, tourney and wild-zone arm):
    // the same two terms on the striker's own sheet - `off` threaded from the striking rig
    player.stats.agility = 50;
    const duel = (off, k) => resolveDuelStrike({ by: 'melee', a: duelAttackerOf(player, KATANA), w: duelWeaponOf(KATANA), sw: 'StrikeLeft', ...(off ? { off: true } : {}) }, duelStandIn(), { rolls: () => (k + 0.5) / 100 });
    mods.length = 0;
    for (let k = 0; k < 50; k++) duel(false, k);
    const pvpLead = mods.splice(0);
    for (let k = 0; k < 50; k++) duel(true, k);
    const pvpOff = mods.splice(0);
    assert.ok(pvpLead.length === 50 && pvpOff.length === 50);
    for (let k = 0; k < 50; k++) assert.equal(pvpOff[k] - pvpLead[k], offHandToHit(50), 'the off hand\'s to-hit between players');
    registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, mod) => mod + 1000);
    let pvpBoth = 0;
    for (let k = 0; k < 50; k++) { const l = duel(false, k).dmg, o = duel(true, k).dmg; if (l > 0 && o > 0) { pvpBoth++; assert.equal(o, offHandDamage(l), `pvp roll ${k}`); } }
    assert.ok(pvpBoth >= 40, `and its share, on ${pvpBoth} rolls`);
  } finally {
    registerFormulaOverride('adjustWeaponHitChanceMod', null);
  }
});

test('TWO-HANDS (AUDIT 2): THE OFF HAND\'S BLOW IS 0.8 OF A BLOW IN EVERYTHING IT COUNTS - its weapon\'s Strikes enchantments and a power\'s per-blow charge set off that share of the time (one roll), the skills it trains that share of a use; its share laid ahead of PCAAO\'s own wear at the shipped defaults; its sureness by the LIVE Agility, against a foe and a player alike; and the beast\'s H is DFU\'s', () => {
  assert.deepEqual({ ...OFF_HAND_BLOW }, { blowShare: offHandDamage, blowWeight: DUAL.OFF_DAMAGE }, 'one home for the player\'s swing and a blow between players');
  const player = () => ({ isPlayer: true, level: 1, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), armor: 0, stats: { strength: 75, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 } });
  const skeleton = () => ({ isPlayer: false, careerIndex: 0, mobileType: MOBILE_TYPES.SkeletalWarrior, health: 300, maxHealth: 300, armor: 0, skills: 30, minMetalToHit: -1, stats: { strength: 50, agility: 50, luck: 50 } });
  // POTENT VS UNDEAD's +5 (a Strikes payload) and the strike listeners' `blow`, on rolls a whole blow and the off hand's
  const potent = () => ({ ...KATANA, currentCondition: 1000, maxCondition: 1000, enchantments: [{ type: ENCHANTMENT_TYPES.PotentVs, param: 0 }] });
  const heard = [];
  registerPlayerStrikeListener('twohands-weight', (a, t, d, w, info) => heard.push(info.blow));
  try {
    let fewer = 0, landed = 0, lightLanded = 0, wholeLanded = 0;
    for (let k = 0; k < 100; k++) {
      const roll = () => (k + 0.5) / 100;
      const whole = calculateAttackDamage(player(), skeleton(), { weapon: potent(), toHitMod: 1000, rolls: roll });
      const weighed = calculateAttackDamage(player(), skeleton(), { weapon: potent(), toHitMod: 1000, rolls: roll, blowWeight: DUAL.OFF_DAMAGE });
      if (!(whole > 0)) continue;
      landed++;
      assert.equal(whole - weighed, roll() < DUAL.OFF_DAMAGE ? 0 : 5, `roll ${k}: Potent Vs on ${DUAL.OFF_DAMAGE} of the rolls`);
      if (weighed < whole) fewer++;
      if (weighed > 0) { if (roll() < DUAL.OFF_DAMAGE) wholeLanded++; else lightLanded++; }
    }
    assert.ok(landed >= 90 && fewer >= 15, `a fifth of the off hand's blows set off no Strikes payload (${fewer} of ${landed})`);
    assert.equal(heard.filter((b) => b === false).length, lightLanded, 'and the strike listeners are told the same blows do not count whole');
    assert.equal(heard.filter((b) => b === true).length, landed + wholeLanded, 'every other landed blow - every whole one - does');
  } finally { registerPlayerStrikeListener('twohands-weight', null); }
  // ...and the player's swing hands it on: on a roll past the share, the lead's blow counts whole and the off hand's not
  const told = [];
  registerPlayerStrikeListener('twohands-weight', (a, t, d, w, info) => told.push(info.blow));
  registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, mod) => mod + 1000);
  try {
    for (const off of [false, true]) {
      const p = new PlayerWeapon({});
      p.updateHands(KATANA, DAGGER); p.applyWeapon();
      p.machine.state = 'StrikeLeft'; p.strike = { hand: off ? 'L' : 'R', flurry: off, off }; p.weapon = KATANA;
      p.resolveHit([{ entity: skeleton(), ai: { feet: [0, 0, 1] } }], player(), () => ({ dist: 1, inView: true, losClear: true }), () => 0.9);
    }
    assert.deepEqual(told, [true, false], 'the lead\'s blow whole; the off hand\'s, on a roll of 0.9, not');
  } finally { registerPlayerStrikeListener('twohands-weight', null); registerFormulaOverride('adjustWeaponHitChanceMod', null); }
  // THE TALLY: a whole swing a use; the off hand's 0.8 of one, the fraction carried on the player
  const tp = player();
  for (let n = 0; n < 10; n++) tallySwingSkills(tp, KATANA, DUAL.OFF_DAMAGE);
  assert.deepEqual([tp.skillUses[SKILLS.LongBlade], tp.skillUses[SKILLS.CriticalStrike]], [8, 8], 'ten off-hand blows train eight uses');
  tallySwingSkills(tp, KATANA);
  assert.equal(tp.skillUses[SKILLS.LongBlade], 9, 'a whole swing always one');
  const pw = new PlayerWeapon({});
  pw.updateHands(KATANA, DAGGER); pw.applyWeapon();
  pw.clickAttack(() => 0.5);
  assert.equal(pw.blowWeight, 1, 'the lead\'s blow weighs one');
  for (let i = 0; i < 600 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
  pw.applyWeapon(); pw.clickAttack(() => 0.5);
  assert.ok(pw.offStrike && pw.blowWeight === DUAL.OFF_DAMAGE, 'the off hand\'s, its share');
  // every tally a host makes hands the swing's weight on; techniques are the lead's. PIN MOVED (AUDIT PISTOLET A2): the
  // ranged arm's too - a bow never strikes off (DFU's line), but a Pistolet pair's off-hand shot does, and world.js and
  // exterior.js counted it whole where the other two hosts weighed it (THE FOUR HOSTS RULE)
  for (const [file, rig, n] of [['worldModes', 'interiorWeapon.playerWeapon', 2], ['dungeonContext', 'playerWeapon', 2], ['world', 'weaponRig.playerWeapon', 4], ['exterior', 'weaponRig.playerWeapon', 3], ['cityGuards', 'playerWeapon', 1]]) {
    const text = rd(`src/scenes/${file}.js`);
    const weighed = text.split(`tallySwingSkills(playerEntity, ${rig}.weapon, ${rig}.blowWeight)`).length - 1;
    assert.equal(weighed, n, `${file}: every melee tally weighed (${weighed} of ${n})`);
    assert.equal((text.match(/tallySwingSkills\(/g) ?? []).length - weighed, 0, `${file}: none unweighed`);
  }
  // PCAAO AT THE SHIPPED DEFAULTS (its core rolls every blow): the off hand's share is laid ahead of its own wear, once
  _resetModSettings(); installPcaao();
  try {
    let both = 0;
    for (let k = 0; k < 100; k++) {
      const roll = () => (k + 0.5) / 100;
      const one = (opts) => {
        const w = { ...KATANA, currentCondition: 1000, maxCondition: 1000 };
        let wear = null, told = null;
        registerFormulaOverride('applyConditionDamageThroughPhysicalHit', (item, owner, d) => { if (item === w) wear = d; return undefined; });
        setPlayerAttackHook((n) => { told = n.damage; });
        try { return { ret: calculateAttackDamage(player(), skeleton(), { weapon: w, toHitMod: 1000, rolls: roll, ...opts }), told, wear }; }
        finally { setPlayerAttackHook(null); registerFormulaOverride('applyConditionDamageThroughPhysicalHit', null); }
      };
      const whole = one({}), off = one(OFF_HAND_BLOW);
      if (!(whole.ret > 0 && off.ret > 0)) continue;
      both++;
      assert.equal(off.ret, offHandDamage(whole.ret), `roll ${k}: shared once`);
      assert.equal(off.told, off.ret, 'the HUD the blow that landed');
      if (whole.wear != null) assert.equal(off.wear, off.ret, `roll ${k}: the wear by the blow that landed (${off.wear} of ${whole.wear})`);
    }
    assert.ok(both >= 80, `on ${both} rolls`);
  } finally { modsOff(); installPcaao(); }
  // THE LIVE AGILITY: a fever's +40 is the off hand's sureness against a foe, and the sheet's own Agility between players
  const mods = [];
  registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, mod) => { mods.push(mod); return undefined; });
  try {
    const sure = { ...player(), activeEffects: [{ kind: 'disease', statMods: { agility: 40 } }] };
    for (const off of [false, true]) {
      const p = new PlayerWeapon({});
      p.updateHands(KATANA, DAGGER); p.applyWeapon();
      p.machine.state = 'StrikeLeft'; p.strike = { hand: off ? 'L' : 'R', flurry: off, off }; p.weapon = KATANA;
      p.resolveHit([{ entity: skeleton(), ai: { feet: [0, 0, 1] } }], sure, () => ({ dist: 1, inView: true, losClear: true }), () => 0.5);
    }
    assert.equal(mods[1] - mods[0], offHandToHit(90), 'Agility 50 on the sheet, 90 live: the live one');
    mods.length = 0;
    const agile = { ...player(), stats: { ...player().stats, agility: 90 } };
    for (const off of [false, true]) resolveDuelStrike({ by: 'melee', a: duelAttackerOf(agile, KATANA), w: duelWeaponOf(KATANA), sw: 'StrikeLeft', ...(off ? { off: true } : {}) }, duelStandIn(), { rolls: () => 0.5 });
    assert.equal(mods[1] - mods[0], offHandToHit(90), 'between players: the striker\'s own Agility');
  } finally { registerFormulaOverride('adjustWeaponHitChanceMod', null); }
  // THE BEAST'S H (L4): a transformed lycanthrope's claws stay the weapon in use - one hand, DFU's line
  const claws = { name: 'claws', werecreatureClaws: true };
  const beast = new PlayerWeapon({});
  beast.updateHands(null, null); beast.applyWeapon(claws);
  assert.equal(beast.toggleHand({ bowSwitching: false }), 'Using weapon in left hand.');
  assert.deepEqual([beast.weapon, beast.handsMode], [claws, HANDS_MODE.Single], 'the claws, one hand - never the fists');
});

// ---- THE SPRITE LANE, THROUGH A REAL RIG -------------------------------------------------------------------------------

/** A WEAPON CIF: the "wielding" image every non-bow file opens with, then the anim records (record 0 the idle). */
function cif(recs) {
  const parts = recs.map(({ w, h, frames }) => {
    const head = 12 + 31 * 2 + 2, runs = Math.ceil((w * h) / 127) + 1;
    const b = new Uint8Array(head + runs * 2); const v = new DataView(b.buffer);
    v.setUint16(0, w, true); v.setUint16(2, h, true);
    for (let f = 0; f < frames; f++) v.setUint16(12 + f * 2, head, true);
    for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
    v.setUint16(12 + 62, b.length, true);
    return b;
  });
  const wield = new Uint8Array(12 + 40 * 30); const wv = new DataView(wield.buffer);
  wv.setUint16(4, 40, true); wv.setUint16(6, 30, true); wv.setUint16(10, 40 * 30, true); wield.fill(1, 12);
  const all = [wield, ...parts];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
const MELEE = cif(Array.from({ length: 7 }, () => ({ w: 120, h: 100, frames: 5 })));
const DT = 1 / 60;
const tick = () => new Promise((res) => setTimeout(res, 0));

/** A seeded Math.random for the rig's own rolls (the click's strike direction - `_rollClickStrike`): every run of the
 *  suite meets the same blows, side strikes among them (AUDIT: a random draw let a mutant live one run in seven). */
let _seed = 20261016;
Math.random = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x80000000; };

async function rigWith({ right = null, left = null, widget = false, run = false, sheathed = false, light = null, spellArmed = null, walk = false, bobber = null, entityExtra = {}, modsOff = false } = {}) {
  resetToDefaults(); _resetModSettings();
  if (modsOff) for (const k of Object.keys(MOD_KEYS)) setModSetting(k, 'Enabled', false);   // Settings > Features "All off", from the first frame
  setModSetting('weapon-widget', 'Enabled', widget);
  const quads = [], said = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex, rect, uv) => quads.push({ tex, rect, uv }) };
  const canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200 };
  const entity = { items: [], lightSource: light, equip: { slots: { [EQUIP_SLOTS.RightHand]: right, [EQUIP_SLOTS.LeftHand]: left } }, stats: { speed: 50, strength: 50, agility: 50 }, ...entityExtra };
  const cam = { z: 0, run, walk, bobTimer: null, climbing: false, grounded: true };
  const r = createWeaponRig({ renderer, canvas, entity, audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) }, say: (l) => said.push(l),
    fetchBytes: async () => MELEE, ...(spellArmed ? { spellArmed } : {}),
    camera: () => ({ pos: [0, 1.7, cam.z], yaw: 0, pitch: 0, climbing: cam.climbing, move: { grounded: cam.grounded, running: cam.run, standing: !cam.run && !cam.walk, bobTimer: cam.bobTimer } }) });
  if (!sheathed) r.toggleSheath();
  for (let i = 0; i < 20; i++) { r.frame(DT); r.draw(); await tick(); }
  const frame = async ({ held = false, move = 0 } = {}) => {
    cam.z += move * DT;
    // the host's own order: the head bob steps on the motor's frame (player/headBobber.js, its timer handed out), then the rig
    if (bobber) { const out = {}; bobber.update(DT, { yaw: 0, pitch: 0 }, { velocity: move, moving: move > 0, running: cam.run, out }); cam.bobTimer = out.bobTimer; }
    r.attackInput(0, 0, held);
    quads.length = 0;
    r.frame(DT); r.draw();
    await tick();
    return quads.map((q) => ({ ...q, rec: String(q.tex).split(':').slice(-2, -1)[0], mirrored: q.uv?.u0 === 1 && q.uv?.u1 === 0 }));
  };
  return { r, frame, said, entity, cam };
}

/** The arm a drawn quad shows on the screen: the record's painted arm (handsLaw.js MELEE_PAINTED_ARM), turned about by a
 *  mirror. */
const shownArm = (x) => { const p = MELEE_PAINTED_ARM[Number(x.rec)]; return x.mirrored ? otherHand(p) : p; };
const STATE_REC = { Idle: '0', StrikeDown: '1', StrikeDownLeft: '2', StrikeLeft: '3', StrikeRight: '4', StrikeDownRight: '5', StrikeUp: '6' };
/** The running arm's record (RUN_PUMP.ARM_STATE's) - PIN MOVED (TWO-HANDS FIELD): the pins named record 5, the uppercut. */
const RUN_REC = STATE_REC[RUN_PUMP.ARM_STATE];
const meleePainted = (state) => MELEE_PAINTED_ARM[Number(STATE_REC[state])];

test('TWO-HANDS rig, classic sprite: both fists up - the right as DFU draws it, the left the same idle mirrored on the left; the hands take turns, and EVERY strike frame shows the striking hand\'s own arm on its own side - the bare hand\'s art paints both arms (StrikeDown, StrikeLeft and StrikeUp the left), so the picture is chosen (strikePicture), never assumed - and the other hand stays up', async () => {
  const { r, frame } = await rigWith({});
  assert.equal(r.playerWeapon.handsMode, HANDS_MODE.Fists);
  for (let i = 0; i < 90; i++) await frame();
  assert.ok(r.twoHands.state.bounce > 0.95, 'standing, the fists\' guard is alive');
  let q = await frame();
  assert.equal(q.length, 2, 'two fists');
  const [left, right] = [...q].sort((a, b) => a.rect.x - b.rect.x);
  assert.equal(left.mirrored, true); assert.equal(right.mirrored, false);
  assert.ok(Math.abs(left.rect.x - (320 - right.rect.x - right.rect.w)) < 1.5, 'the left is the right\'s mirror image (the bounce aside)');
  // a held button: the exchange - many blows, in the directions the machine picks
  const blows = [];
  const painted = new Set();
  for (let i = 0; i < 1400; i++) {
    q = await frame({ held: i < 1360 });
    const s = r.playerWeapon.strikeInFlight;
    if (!s) continue;
    const striking = q.find((x) => x.rec !== '0');
    if (!striking) continue;
    const state = r.playerWeapon.machine.state;
    assert.equal(q.at(-1), striking, 'the striking hand is drawn over the other');
    assert.equal(shownArm(striking), s.hand, `${s.hand} ${state}: the arm on the screen is the hand that throws it (record ${striking.rec}${striking.mirrored ? ', mirrored' : ''})`);
    const pic = strikePicture(s.hand, state, { painted: meleePainted });
    assert.equal(striking.rec, STATE_REC[pic.state], `${s.hand} ${state}: the picture the law chose`);
    const other = q.find((x) => x !== striking);
    assert.ok(other && other.rec === '0' && shownArm(other) === otherHand(s.hand), 'and the other hand stays up, its own arm on its own side');
    painted.add(MELEE_PAINTED_ARM[Number(STATE_REC[state])]);
    if (!blows.length || blows.at(-1).hand !== s.hand) blows.push({ hand: s.hand, state });
  }
  assert.ok(blows.length >= 6, `blows ${blows.length}`);
  assert.deepEqual(blows.slice(0, 3).map((b) => b.hand), ['R', 'L', 'R'], 'the hands take turns');
  assert.deepEqual([...painted].sort(), ['L', 'R'], 'measured over strikes Daggerfall paints with each arm');
});

test('TWO-HANDS rig, the guard: the hand that is not striking draws toward the middle and down while the other strikes - each from its own side - and back after', async () => {
  const { r, frame } = await rigWith({});
  const rest = await frame();
  const restOf = { R: rest.find((x) => shownArm(x) === 'R').rect, L: rest.find((x) => shownArm(x) === 'L').rect };
  for (const [hand, striker] of /** @type {const} */ ([['R', 'L'], ['L', 'R']])) {
    let tucked = null;
    for (let i = 0; i < 400 && !tucked; i++) {
      const q = await frame({ held: true });
      if (r.playerWeapon.strikeInFlight?.hand !== striker) continue;
      // deep in the other's blow - the guard's follower has had its time
      for (let k = 0; k < 6 && r.playerWeapon.strikeInFlight?.hand === striker; k++) tucked = (await frame({ held: true })).find((x) => x.rec === '0' && shownArm(x) === hand)?.rect ?? tucked;
      void q;
    }
    assert.ok(tucked, `the ${hand} fist seen while the ${striker} strikes`);
    const inward = hand === 'R' ? restOf.R.x - tucked.x : tucked.x - restOf.L.x;
    assert.ok(inward > GUARD.IN * 0.6 && tucked.y > restOf[hand].y + GUARD.DOWN * 0.6, `${hand}: in toward the middle and down: ${JSON.stringify(tucked)} from ${JSON.stringify(restOf[hand])}`);
    for (let i = 0; i < 140; i++) await frame();
  }
  const back = await frame();
  for (const hand of ['R', 'L']) {
    const b = back.find((x) => shownArm(x) === hand).rect;
    // PIN MOVED (TWO-HANDS AUDIT 2): the bounce only lowers a fist, by up to twice BOUNCE_PX (it swung about the rest)
    assert.ok(Math.abs(b.x - restOf[hand].x) < 1 && Math.abs(b.y - restOf[hand].y) <= 2 * GUARD.BOUNCE_PX + 0.5, `${hand} back to its rest: ${b.y} from ${restOf[hand].y}`);
  }
});

test('TWO-HANDS rig, the Weapon Widget: the right hand\'s clone and the left\'s each play their own hand\'s blows - the arm on the screen the striking hand\'s, its picture the law\'s (strikePicture over the painted arm) - and hold their idle through the other\'s; the left\'s coroutines resume at the end of the frame', async () => {
  const { r, frame } = await rigWith({ widget: true });
  let strikes = 0;
  for (let i = 0; i < 900; i++) {
    const q = await frame({ held: i < 860 });
    const s = r.playerWeapon.strikeInFlight;
    if (!s) continue;
    const arms = q.map(shownArm);
    assert.equal(new Set(arms).size, arms.length, `never two of one arm on the screen: ${arms}`);
    for (const x of q) {
      if (x.rec === '0') continue;   // a clone's idle - the other hand's, or the striker's own the frame before its clone takes the blow up
      strikes++;
      assert.equal(shownArm(x), s.hand, `the strike frame is the striking hand's arm (${s.hand}, record ${x.rec}${x.mirrored ? ', mirrored' : ''})`);
    }
  }
  assert.ok(strikes > 40, `strike frames seen: ${strikes}`);
  assert.ok(r.twoHands.offWidget, 'the left hand\'s clone');
});

test('TWO-HANDS rig, the pair: a katana and a dagger - both drawn, the katana leads, the dagger answers mirrored; H picks the lead and says so (one hand in use, DFU\'s line); THE RESTING WEAPON LOWERS while the other strikes; the pair lowered for the climb; the recoil is the striking hand\'s', async () => {
  const { r, frame, said } = await rigWith({ right: KATANA, left: DAGGER });
  assert.equal(r.playerWeapon.handsMode, HANDS_MODE.Dual);
  const q = await frame();
  assert.equal(q.length, 2, 'both weapons in view');
  assert.ok(q.some((x) => x.mirrored) && q.some((x) => !x.mirrored));
  const hands = [];
  for (let i = 0; i < 300; i++) {
    await frame({ held: i < 280 });
    const s = r.playerWeapon.strikeInFlight;
    if (s) assert.equal(r.playerWeapon.weapon?.name, s.hand === 'R' ? 'Katana' : 'Dagger', 'every frame of a blow, the weapon in use is the striking hand\'s (the skill tallied, the swing\'s sound)');
    if (s && (!hands.length || hands.at(-1).hand !== s.hand)) hands.push({ hand: s.hand, weapon: r.playerWeapon.weapon?.name, off: s.off, flurry: s.flurry });
  }
  assert.deepEqual(hands.slice(0, 3), [
    { hand: 'R', weapon: 'Katana', off: false, flurry: false },
    { hand: 'L', weapon: 'Dagger', off: true, flurry: true },
    { hand: 'R', weapon: 'Katana', off: false, flurry: true },
  ]);
  for (let i = 0; i < 60; i++) await frame();
  assert.equal(r.switchHand(), true);
  assert.deepEqual(said.slice(-1), ['Leading with the left hand.']);
  assert.equal(r.playerWeapon.leadHand, 'L');
  assert.equal(r.switchHand(), true);
  assert.deepEqual(said.slice(-1), ['Leading with the right hand.']);
  // THE RESTING WEAPON LOWERS (Mac: "When attacking with a weapon, the other weapon in hand should lower slightly"): by
  // GUARD.LOWER of its own drawn height while the other strikes, eased - on the classic sprite and the Weapon Widget alike
  for (const widget of [false, true]) {
    const p2 = await rigWith({ right: KATANA, left: DAGGER, widget });
    for (let i = 0; i < 30; i++) await p2.frame();
    const at = (q) => q.find((x) => x.rect.x + x.rect.w / 2 < 160).rect;   // the left hand's (the dagger's) picture
    const restL = at(await p2.frame());
    let q2 = null;
    for (let i = 0; i < 40; i++) { q2 = await p2.frame({ held: i < 2 }); if (p2.r.twoHands.state.guard.L > 0.999) break; }
    assert.equal(p2.r.playerWeapon.strikeInFlight?.hand, 'R', 'the katana strikes');
    const dip = at(q2).y - restL.y;
    assert.ok(Math.abs(dip - GUARD.LOWER * restL.h) < 2, `the dagger lowers by its share (${widget ? 'widget' : 'classic'}): ${dip.toFixed(2)} of ${restL.h}`);
    assert.ok(Math.abs(at(q2).x - restL.x) < 1.5, `straight down - never toward the middle, its cut side stays on the view's edge: ${at(q2).x} vs ${restL.x}`);
    for (let i = 0; i < 120; i++) await p2.frame();
    assert.ok(Math.abs(at(await p2.frame()).y - restL.y) < 2, 'and back up after');
  }
  // one hand in use keeps DFU's line
  const one = await rigWith({ right: KATANA, left: CLAYMORE });
  assert.equal(one.r.playerWeapon.handsMode, HANDS_MODE.Single);
  assert.equal(one.r.switchHand(), true);
  assert.deepEqual(one.said.slice(-1), ['Using weapon in left hand.'], 'WeaponManager.cs:711, not the lead\'s line');
  // the pair lowered for the climb as the one sprite is (CLIMB4's climbDrop on the branch's own offset)
  const climb = await rigWith({ right: KATANA, left: DAGGER });
  const at = async () => { const q = await climb.frame(); assert.equal(q.length, 2); return Math.min(...q.map((x) => x.rect.y)); };
  const restY = await at();
  climb.cam.climbing = true;
  const lowered = await at();
  assert.ok(climb.r.climbLower() > 0 && climb.r.climbLower() < 0.5, `on its way down: ${climb.r.climbLower()}`);
  assert.ok(lowered > restY + 0.5, `the pair goes DOWN for the climb: ${restY} -> ${lowered}`);
  // the recoil goes to the striking hand's clone (source: the rig routes it)
  assert.match(rd('src/combat/weapon/weaponRig.js'), /playerWeapon\.onAttackResult = \(\{ foe, damage \}\) => \(pairUp\(\) && playerWeapon\.activeHand === 'L' \? twoHands\.offWidget : widget\)\.onAttackDamageCalculated\(/);
});

test('TWO-HANDS rig, the running hands: running with nothing in either hand - drawn or sheathed - the two fists pump out of step, from their guard or up from below the view, and go when the run ends; a light in a hand, a weapon, or standing still draws none', async () => {
  for (const sheathed of [false, true]) {
    const { r, frame } = await rigWith({ run: true, sheathed });
    const ys = { L: [], R: [] };
    for (let i = 0; i < 90; i++) {
      const q = await frame({ move: 7 });
      for (const x of q) ys[x.mirrored ? 'L' : 'R'].push(x.rect.y);
      if (i > 30 && q.length === 2 && Math.abs(q[0].rect.y - q[1].rect.y) > 5) assert.ok(q[1].rect.y < q[0].rect.y, 'the hand coming forward is drawn over the one going back');
    }
    assert.ok(r.twoHands.running, `running (${sheathed ? 'sheathed' : 'fists up'})`);
    const span = (a) => Math.max(...a.slice(30)) - Math.min(...a.slice(30));
    assert.ok(span(ys.R) > 20 && span(ys.L) > 20, `both pump: ${span(ys.R).toFixed(1)}, ${span(ys.L).toFixed(1)}`);
    assert.ok(Math.max(...ys.R.slice(30)) > 200, 'the bottom of the stroke leaves the view');
    let opposite = 0, n = 0;
    for (let i = 31; i < ys.R.length && i < ys.L.length; i++) { const dr = ys.R[i] - ys.R[i - 1], dl = ys.L[i] - ys.L[i - 1]; if (Math.abs(dr) > 0.5 && Math.abs(dl) > 0.5) { n++; if (Math.sign(dr) !== Math.sign(dl)) opposite++; } }
    assert.ok(opposite / n > 0.8, `out of step (${opposite}/${n})`);
  }
  // the run ends: the hands go
  const { r, frame } = await rigWith({ run: true, sheathed: true });
  for (let i = 0; i < 40; i++) await frame({ move: 7 });
  assert.ok(r.twoHands.running);
  for (let i = 0; i < 90; i++) await frame({ move: 0 });
  assert.equal(r.twoHands.running, false, 'standing, the hands are put away');
  assert.equal((await frame()).length, 0, 'and a sheathed body draws nothing');
  // a light in a hand takes the left hand: one fist beside it (and so no pair, and no running hands)
  const lit = await rigWith({ light: { templateIndex: 247 } });
  assert.equal(lit.r.playerWeapon.handsMode, HANDS_MODE.Single);
  assert.equal(lit.r.playerWeapon.leftBusy, true);
  // not with a light, a weapon, or a shield
  for (const over of [{ light: { templateIndex: 247, lit: true } }, { right: KATANA, sheathed: true }, { left: BUCKLER, sheathed: true }]) {
    const t = await rigWith({ run: true, ...over });
    for (let i = 0; i < 40; i++) await t.frame({ move: 7 });
    assert.equal(t.r.twoHands.running, false, JSON.stringify(Object.keys(over)));
  }
});

test('TWO-HANDS rig, the running hands, AUDITED: THE ARM IS THE ART\'S OWN - its frame, the foot on the view\'s edge, never lifted, the rest down and out before the arm comes up (one art a hand a frame), the top of the stroke in toward the middle; the sheathed run up from below the view, ON THE HEAD BOB\'S CLOCK (its timer, every frame); a hand TAKEN mid-run (a weapon, the beast) yields the run at once to the picture that takes it, and with nothing in its place (a spell readied with no hands drawn, a swap\'s pause) eases it out - never a frame of fists over a picture, never an empty one; a lantern at the waist takes no hand; no bounce in a walk', async () => {
  // THE RUNNING ARM IS THE ART'S OWN (Mac: "theres no arm portion of the sprite, so it looks like floating hands"): the
  // run draws the art's own arm (RUN_PUMP.ARM_STATE's frame), its FOOT ON THE VIEW'S BOTTOM EDGE or below - never lifted;
  // the fists' rest goes down out of the view first and the arm comes up from under it, one art a hand a frame
  const up = await rigWith({ run: true });
  const rest = (await up.frame()).find((x) => shownArm(x) === 'R').rect;
  const side = (x) => (x.rect.x + x.rect.w / 2 < 160 ? 'L' : 'R');
  const frameOf = (x) => Number(String(x.tex).split(':').at(-1));
  let top = null, armSeen = false, lastRestY = { L: -Infinity, R: -Infinity }, firstArmTop = null;
  for (let i = 0; i < 120; i++) {
    const q = await up.frame({ move: 7 });
    for (const sd of ['L', 'R']) assert.ok(q.filter((x) => side(x) === sd).length <= 1, 'one art a hand a frame');
    for (const x of q) {
      if (x.rec === RUN_REC) {
        assert.ok(x.rect.y + x.rect.h >= 200 - 1e-6, `the arm's foot on the view's edge or under it - never lifted: ${JSON.stringify(x.rect)}`);
        if (!armSeen) firstArmTop = x.rect.y;
        armSeen = true;
        if (side(x) === 'R' && (!top || x.rect.y + (3 - frameOf(x)) * 1e3 < top.rect.y + (3 - frameOf(top)) * 1e3)) top = x;
      } else {
        assert.equal(x.rec, '0', 'the rest\'s own idle');
        assert.ok(!armSeen, 'the rest is never back once the arm is up (until the run ends)');
        assert.ok(x.rect.y >= lastRestY[side(x)] - 1e-9, 'the rest only goes DOWN, out of the view');
        lastRestY[side(x)] = x.rect.y;
      }
    }
  }
  assert.ok(armSeen && firstArmTop > 200 * 0.8, `the arm comes up from under the view: ${firstArmTop}`);
  assert.ok(Number.isFinite(lastRestY.L) && Number.isFinite(lastRestY.R), 'the fists went DOWN out of the view first - never gone in a frame');
  assert.ok(lastRestY.L > 200 * 0.9 && lastRestY.R > 200 * 0.9, `and all the way down before the arms came up: ${JSON.stringify(lastRestY)} (from ${rest.y})`);
  for (const x of await up.frame({ move: 7 })) assert.equal(shownArm(x), side(x), 'each running arm its own side\'s - the record\'s right arm mirrored for the left');
  assert.equal(frameOf(top), RUN_PUMP.ARM_FRAME, 'the top of the stroke: the rise\'s lowest frame, its foot on the edge (PIN MOVED, TWO-HANDS FIELD: was the rise\'s last, the uppercut\'s peak)');
  assert.ok(top.rect.x + top.rect.w / 2 < rest.x + rest.w / 2 - 1, `the top of the stroke in toward the middle: ${JSON.stringify([top.rect, rest])}`);
  assert.equal(top.mirrored, false, 'the right hand: the run\'s record paints the right arm');
  assert.ok(up.r.twoHands.running);
  // the sheathed run rises from BELOW the view
  const down = await rigWith({ run: true, sheathed: true });
  const ys = [];
  for (let i = 0; i < 12 && ys.length < 4; i++) {   // from the run's first DRAWN frame (its weight is 0 on the first)
    const q = await down.frame({ move: 7 });
    if (q.length) ys.push(Math.min(...q.map((x) => x.rect.y)));
  }
  assert.ok(ys.length === 4 && ys[0] > 200 * 0.95 && ys[0] > rest.y + rest.h / 2 && ys.every((y, i) => i === 0 || y <= ys[i - 1] + 1e-9),
    `up from below the view, never from where the fists rest: ${ys.map((y) => y.toFixed(1))} against the rest's ${rest.y}`);
  // THE HEAD BOB'S CLOCK: the phase is the bob's timer, every frame
  const bobber = new HeadBobber();
  const b = await rigWith({ run: true, sheathed: true, bobber });
  for (let i = 0; i < 200; i++) await b.frame({ move: 7 });
  assert.ok(b.r.twoHands.running);
  assert.ok(Math.abs(b.r.twoHands.state.run.phase - runPhaseOfBob(bobber.timer)) < 1e-12, 'the pump\'s phase is the bob\'s, a quarter turn behind - the right arm forward as the left foot is planted');
  // TWO-HANDS AUDIT 2 (L2 F5, L3 M3): FOLLOWED, NEVER JUMPED WITH - a one-frame stop mid-run, and the bob's timer resets to
  // PI as the run resumes (HeadBobber's end transition): the pump catches it up within RUN_PUMP.CATCH of its own stride
  // (handsLaw.js runPhaseFollow, the 3D arms' law too) - the first cut took the reset whole and swapped the arms in a
  // frame (227 px of 600)
  const bobWalk = 7 * DT * Math.PI / RUN_STEP_M, bobStepOf = (p0, p1) => p1 - p0 - 2 * Math.PI * Math.round((p1 - p0) / (2 * Math.PI));
  for (let i = 0; i < 120 && Math.abs(bobber.timer - 1.5 * Math.PI) > 0.2; i++) await b.frame({ move: 7 });
  await b.frame({ move: 0 });
  const stutter = [];
  for (let i = 0; i < 90; i++) { const p0 = b.r.twoHands.state.run.phase; await b.frame({ move: 7 }); stutter.push(bobStepOf(p0, b.r.twoHands.state.run.phase)); }
  assert.ok(stutter.every((d) => d >= bobWalk * (1 - RUN_PUMP.CATCH) - 1e-9 && d <= bobWalk * (1 + RUN_PUMP.CATCH) + 1e-9), `the stutter-step: every frame within the stride's tempo +-CATCH (${stutter.slice(0, 4).map((d) => d.toFixed(3))}; a stride's step ${bobWalk.toFixed(3)})`);
  assert.ok(Math.abs(b.r.twoHands.state.run.phase - runPhaseOfBob(bobber.timer)) < 1e-12, 'and back ON the bob\'s phase');
  // ...a run's first frame takes the bob's phase at once: nothing of the pump is drawn yet, nothing to carry - a run
  // begun again after the last has gone (its stride left wherever it stopped, the bob's timer settled at PI)
  const freshBob = new HeadBobber();
  const cr = await rigWith({ run: true, sheathed: true, bobber: freshBob });
  for (let i = 0; i < 50; i++) await cr.frame({ move: 7 });
  for (let i = 0; i < 150 && cr.r.twoHands.running; i++) await cr.frame({ move: 0 });
  assert.equal(cr.r.twoHands.running, false, 'the run over, its hands gone');
  const left = cr.r.twoHands.state.run.phase;
  let firstPhase = null;
  for (let i = 0; i < 12 && firstPhase == null; i++) { await cr.frame({ move: 7 }); if (cr.r.twoHands.state.run.w > 0) firstPhase = cr.r.twoHands.state.run.phase; }
  assert.equal(firstPhase, runPhaseOfBob(freshBob.timer), 'the run\'s first frame: on the bob at once');
  assert.ok(Math.abs(Math.sin((firstPhase - left) / 2)) > 0.3, `...however far from where the last run left the stride (${left.toFixed(2)} -> ${firstPhase.toFixed(2)})`);
  // TWO-HANDS AUDIT 2 (L5): HEAD BOBBING OFF, THE PUMP KEEPS ITS OWN STRIDE - the bob hands no clock (headBobber.js `out`:
  // null), so the stride walks at the speed, one step a frame - never held to a bob that is not walking
  const bobOff = await rigWith({ run: true, sheathed: true, bobber: new HeadBobber() });
  setValue('Controls', 'HeadBobbing', false);
  try {
    for (let i = 0; i < 60; i++) await bobOff.frame({ move: 7 });
    const offSteps = [];
    for (let i = 0; i < 30; i++) { const p0 = bobOff.r.twoHands.state.run.phase; await bobOff.frame({ move: 7 }); offSteps.push(bobStepOf(p0, bobOff.r.twoHands.state.run.phase)); }
    assert.ok(bobOff.r.twoHands.running && offSteps.every((d) => Math.abs(d - bobWalk) < 1e-9), `head bobbing off: the stride's own step a frame (${offSteps.slice(0, 3).map((d) => d.toFixed(4))}, a step ${bobWalk.toFixed(4)})`);
  } finally { setValue('Controls', 'HeadBobbing', true); }
  // A HAND TAKEN MID-RUN (PIN MOVED, TWO-HANDS AUDIT 2 - the first audit ended the run at once, which emptied the view
  // in a frame where nothing took the hands' place): the run yields AT ONCE to a picture that takes the hands, and with
  // nothing in their place eases out under the view - never an empty frame
  const armsOf = (q) => q.filter((x) => x.rec === RUN_REC);   // the running arm: WEAPON10's jab across (RUN_PUMP.ARM_STATE)
  const easesOut = async (t, take, why, over = true) => {
    for (let i = 0; i < 60; i++) await t.frame({ move: 7 });
    const before = armsOf(await t.frame({ move: 7 }));
    assert.equal(before.length, 2, `${why}: both arms up first`);
    take();
    const after = armsOf(await t.frame({ move: 7 }));
    assert.equal(after.length, 2, `${why}: the arms still drawn the frame after - nothing took their place`);
    let gone = -1;
    for (let i = 0; i < 120 && gone < 0; i++) if (!(await t.frame({ move: 7 })).length) gone = i;   // nothing else draws here
    assert.ok(gone > 3 && gone < 90, `${why}: eased out under the view in ${gone} frames`);
    // (below the swap the fists' rest takes the run's place, lowered - nothing of it while the hands are put away)
    if (!over) return;
    for (let i = 0; i < 60 && t.r.twoHands.running; i++) await t.frame({ move: 7 });
    assert.equal(t.r.twoHands.running, false, `${why}: and over`);
  };
  let armed = false;
  await easesOut(await rigWith({ run: true, spellArmed: () => armed }), () => { armed = true; }, 'a spell readied mid-run, no hands drawn for it');
  const swap = await rigWith({ run: true });
  await easesOut(swap, () => { swap.entity.equipCountdown = 500; }, 'a swap under way', false);   // ms, DFU's own unit
  for (let i = 0; i < 90; i++) await swap.frame({ move: 7 });
  assert.ok(swap.r.twoHands.running && armsOf(await swap.frame({ move: 7 })).length === 2, 'the swap over and the hands still empty: the arms run again');
  const wolf = await rigWith({ run: true });
  for (let i = 0; i < 60; i++) await wolf.frame({ move: 7 });
  wolf.entity.activeEffects = [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true }];
  assert.equal(armsOf(await wolf.frame({ move: 7 })).length, 0, 'the beast\'s turn mid-run: its claws at once, no human arm');
  const katana = await rigWith({ run: true });
  for (let i = 0; i < 60; i++) await katana.frame({ move: 7 });
  katana.entity.equip.slots[EQUIP_SLOTS.RightHand] = KATANA;
  const q = await katana.frame({ move: 7 });
  assert.ok(q.every((x) => !String(x.tex).includes('WEAPON10')), 'a weapon drawn mid-run: no fist or arm drawn in its frame');
  // a lantern at the waist takes no hand (HT-WAIST): both fists, and the running hands
  setModSetting('handheld-torches', 'Handling.LanternsAtWaist', true);
  const waist = await rigWith({ run: true, light: { templateIndex: 248 } });
  setModSetting('handheld-torches', 'Handling.LanternsAtWaist', true);
  for (let i = 0; i < 60; i++) await waist.frame({ move: 7 });
  assert.equal(waist.r.playerWeapon.handsMode, HANDS_MODE.Fists, 'a lantern at the waist is in no hand');
  // a lit torch NO lane draws (Handheld Torches off, no Morrowind arm) takes no hand: both fists, and the running hands
  const lit = await rigWith({ run: true, light: { templateIndex: 247 } });
  setModSetting('handheld-torches', 'Enabled', false);
  for (let i = 0; i < 60; i++) await lit.frame({ move: 7 });
  assert.equal(lit.r.playerWeapon.handsMode, HANDS_MODE.Fists, 'a torch no hand is drawn holding is in no hand');
  assert.ok(lit.r.twoHands.running);
  // EVERY MOD OFF (AUDIT: the eye was kept only inside the mods' gate): the running hands still run - from the first frame
  const bare = await rigWith({ run: true, modsOff: true });
  for (let i = 0; i < 60; i++) await bare.frame({ move: 7 });
  assert.ok(bare.r.twoHands.running, 'the vanilla look runs too');
  // ...and switched off MID-RUN the stride keeps the body's own pace: the eye is not frozen where the mods left it
  const mid = await rigWith({ run: true });
  for (let i = 0; i < 60; i++) await mid.frame({ move: 7 });
  for (const k of Object.keys(MOD_KEYS)) setModSetting(k, 'Enabled', false);
  const steps = [];
  for (let i = 0; i < 30; i++) { const p0 = mid.r.twoHands.state.run.phase; await mid.frame({ move: 7 }); steps.push((mid.r.twoHands.state.run.phase - p0 + 2 * Math.PI) % (2 * Math.PI)); }
  const want = 7 * DT * Math.PI / RUN_STEP_M;
  assert.ok(steps.every((d) => Math.abs(d - want) < 1e-6), `a stride step a frame of ${want.toFixed(4)} at 7 m/s: ${steps.slice(0, 5).map((d) => d.toFixed(4))}`);
  // running, the run owns the fists - never the pair drawn under it; a punch thrown on the run is drawn from its FIRST
  // frame, over the other fist
  const pr = await rigWith({ run: true });
  for (let i = 0; i < 60; i++) { const qq = await pr.frame({ move: 7 }); assert.equal(qq.length, 2, 'two fists, the run\'s'); }
  const punch = await pr.frame({ move: 7, held: true });
  const s0 = pr.r.playerWeapon.strikeInFlight;
  assert.ok(s0, 'a punch on the run');
  const pic = strikePicture(s0.hand, pr.r.playerWeapon.machine.state, { leftHanded: false, painted: meleePainted });
  const strikeQuad = punch.at(-1);
  assert.ok(strikeQuad.rec === STATE_REC[pic.state] && shownArm(strikeQuad) === s0.hand, `the punch drawn from its first frame, over the other's running arm: ${JSON.stringify(punch.map((x) => [x.rec, x.mirrored]))}`);
  assert.ok(punch.slice(0, -1).every((x) => x.rec === RUN_REC), 'the other hand still runs, in the arm\'s own frames');
  assert.equal(punch.filter((x) => shownArm(x) === s0.hand).length, 1, 'the striking hand once - its punch, not its running fist under it');
  // the motion bag carries the head bob's timer to every rig (player/motor.js motionBagOf)
  assert.equal(motionBagOf({ bobTimer: 1.5 }).bobTimer, 1.5);
  assert.equal(motionBagOf({}).bobTimer, null, 'none with head bobbing off');
  // the fists' guard bounces standing, never in a walk
  const walking = await rigWith({ walk: true });
  for (let i = 0; i < 90; i++) await walking.frame({ move: 1.2 });
  assert.equal(walking.r.twoHands.state.bounce < 1e-3, true, `no bounce in a walk (${walking.r.twoHands.state.bounce})`);
});

test('TWO-HANDS rig, AUDITED: a fist and a shield is DFU\'s one hand (the shield is no empty hand); with the Weapon Widget the left clone is drawn where the right\'s mirror is, and its guard tucks in under the other\'s blow', async () => {
  const sh = await rigWith({ left: BUCKLER });
  assert.equal(sh.r.playerWeapon.handsMode, HANDS_MODE.Single, 'the shield leaves one fist');
  const w = await rigWith({ widget: true });
  for (let i = 0; i < 90; i++) await w.frame();
  const q = await w.frame();
  const R = q.find((x) => !x.mirrored), L = q.find((x) => x.mirrored);
  assert.ok(R && L, 'both clones draw');
  assert.ok(Math.abs(L.rect.x - (320 - R.rect.x - R.rect.w)) < 3, `the left clone where the right's mirror is: ${L.rect.x.toFixed(1)} vs ${(320 - R.rect.x - R.rect.w).toFixed(1)}`);
  let tucked = null;
  for (let i = 0; i < 400 && !tucked; i++) {
    const qq = await w.frame({ held: true });
    const s = w.r.playerWeapon.strikeInFlight;
    if (s?.hand === 'R' && w.r.playerWeapon.machine.frame >= 2) tucked = qq.find((x) => x.rec === '0' && shownArm(x) === 'L')?.rect ?? null;
  }
  assert.ok(tucked && tucked.x > L.rect.x + GUARD.IN * 0.4, `the left clone tucks in toward the middle under the right's blow: ${JSON.stringify([tucked, L.rect])}`);
  // THE SWAY, TWO RULES (PIN MOVED, TWO-HANDS AUDIT 2 - the first audit swayed both hands one way, Bob too, which sent
  // the left hand's cut outer side into the view on every step): BOB GOES OUTWARD, as the mod's own mirrored sprite
  // takes it - walking, the two hands swing apart and together, the left the right's exact mirror on every frame (so
  // its outer side does what the mod's own right hand's does, never more)...
  const sway = await rigWith({ widget: true, walk: true });
  let prev = null, same = 0, opposite = 0, unmirrored = 0;
  for (let i = 0; i < 150; i++) {
    const qq = await sway.frame({ move: 3 });
    const r = qq.find((x) => !x.mirrored)?.rect, l = qq.find((x) => x.mirrored)?.rect;
    if (r && l && prev) { const dr = r.x - prev.r.x, dl = l.x - prev.l.x; if (Math.abs(dr) > 0.05 && Math.abs(dl) > 0.05) { if (Math.sign(dr) === Math.sign(dl)) same++; else opposite++; } }
    if (r && l && Math.abs(l.x - (320 - r.x - r.w)) > 0.05) unmirrored++;
    if (r && l) prev = { r, l };
  }
  assert.ok(opposite > 20 && same === 0, `Bob: each hand out from the middle as the other (${opposite} apart, ${same} together)`);
  assert.equal(unmirrored, 0, 'the left hand the right\'s mirror on every frame of the walk');
  // ...and INERTIA KEEPS THE SCREEN'S DIRECTION: both hands lag the look as one body (the mod pre-signs it for a flipped
  // sprite) - the left clone's rect before its mirror, by each delta alone
  const ww = createWeaponWidget({ hidden: true });
  ww._w.weaponPosition = { x: 200, y: 100, w: 100, h: 100 };
  const at = (bob, inertia) => { ww._w.swayDx = { bob, inertia }; ww._w.position = [bob + inertia, 0]; return { mine: ww.pairRect(false).x, glass: ww.pairRect(true).x }; };
  const still = at(0, 0), bobbed = at(5, 0), lagged = at(0, 5);
  assert.deepEqual([bobbed.mine - still.mine, -(bobbed.glass - still.glass)], [5, -5], 'Bob: +5 on the right hand, -5 on the left once mirrored (outward both)');
  assert.deepEqual([lagged.mine - still.mine, -(lagged.glass - still.glass)], [5, 5], 'Inertia: +5 on both, once mirrored');
  // THE PAIR DISSOLVES MID-WIND-UP (AUDIT): the left clone does not wind up forever - a torch lit (Handheld Torches on)
  const stuck = await rigWith({ widget: true });
  for (let i = 0; i < 600; i++) {
    await stuck.frame({ held: true });
    if (stuck.r.playerWeapon.strikeInFlight?.hand === 'L' && stuck.r.playerWeapon.machine.frame < 2) break;
  }
  assert.equal(stuck.r.playerWeapon.strikeInFlight?.hand, 'L', 'a left blow winding up');
  stuck.entity.lightSource = { templateIndex: 247 };
  for (let i = 0; i < 120; i++) await stuck.frame();
  assert.equal(stuck.r.playerWeapon.handsMode, HANDS_MODE.Single);
  assert.equal(stuck.r.twoHands.offWidget.animating, false, 'the left clone let its blow go');
  stuck.entity.lightSource = null;
  for (let i = 0; i < 150; i++) await stuck.frame();
  const back = await stuck.frame();
  const bl = back.find((x) => x.mirrored), br = back.find((x) => !x.mirrored);
  assert.ok(bl && br && Math.abs(bl.rect.y - br.rect.y) < 6, `both fists home again, the left not pushed off the screen: ${JSON.stringify(back.map((x) => x.rect))}`);
});

/** A WebGL2 stub that RECORDS every call (weaponglow1.test.js's): an enum read as its own name. */
function loggingRenderer() {
  const log = [];
  let id = 0;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ uniform: name });
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'drawingBufferWidth') return 800;
      if (k === 'drawingBufferHeight') return 600;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  return { r: new Renderer({ getContext: () => stub, clientWidth: 800, clientHeight: 600, width: 800, height: 600 }), log };
}
const I4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('TWO-HANDS x WEAPON-GLOW1: each hand of a pair wears ITS OWN weapon\'s element - the classic pair draws each hand\'s outline over its own picture (the left\'s rect and mirror); the renderer lights a pair\'s left blade with its own glow on its own ranges; the rig hands each hand, each clone and the Morrowind arm its own item\'s (by source)', () => {
  const fire = glowSpec('fire', 2), frost = glowSpec('frost', 1);
  // the classic pair: a hand's quad, then its outline - the same frame, rect and source (the left's mirrored)
  const th = createTwoHands({});
  const machine = { state: 'Idle', frame: 0, isBow: false, isUnarmed: false, now: 0 };
  th.step(DT, { mode: HANDS_MODE.Dual, machine });
  const art = { weaponType: WEAPON_TYPES.LongBlade, anims: getWeaponAnims(WEAPON_TYPES.LongBlade), records: Array.from({ length: 7 }, (_, r) => ({ width: 100, height: 80, frames: [`r${r}f0`, `r${r}f1`, `r${r}f2`, `r${r}f3`, `r${r}f4`] })) };
  const calls = [];
  const renderer = { drawScreenQuad: (tex, rect, uv) => calls.push(['quad', tex, rect, uv]), drawScreenQuadGlow: (tex, rect, uv, glow, frame) => calls.push(['glow', tex, rect, uv, glow, frame]) };
  th.drawPair(renderer, { width: 640, height: 400 }, { artFor: () => art, glowFor: (hand) => (hand === 'R' ? fire : frost), shown: true });
  assert.deepEqual(calls.map((c) => c[0]), ['quad', 'glow', 'quad', 'glow']);
  const [qL, gL, qR, gR] = calls;
  assert.ok(qL[2].x < 320 && qR[2].x > 320, 'the left hand first, on the left');
  assert.deepEqual([gL[1], gL[2], gL[3], gL[4]], [qL[1], qL[2], MIRROR_UV, frost], 'the left\'s outline: its frame, its rect, its mirror, ITS element');
  assert.deepEqual([gR[1], gR[2], gR[3], gR[4]], [qR[1], qR[2], qR[3], fire], 'the right\'s its own');
  assert.deepEqual(gL[5], { art: [100, 80], view: [640, 400] }, 'measured in the record\'s own pixels (drawFpsWeapon\'s line)');
  calls.length = 0;
  th.drawPair(renderer, { width: 640, height: 400 }, { artFor: () => art, shown: true });
  assert.deepEqual(calls.map((c) => c[0]), ['quad', 'quad'], 'no element, no outline');
  // the Morrowind pass: each blade lit with its own glow, on its own ranges, rings before the body
  const { r, log } = loggingRenderer();
  r.beginFrame(I4(), I4(), new Float32Array([0, 1, 0]));
  const ranges = [
    { first: 0, count: 30, slot: 'body', tex: null },
    { first: 30, count: 12, slot: 'weapon', tex: null },
    { first: 50, count: 8, slot: 'offweapon', tex: null },
  ];
  const instanced = () => log.filter((c) => c[0] === 'drawArraysInstanced').map((c) => [c[2], c[3], c[4]]);
  const looks = () => log.filter((c) => c[0] === 'uniform1i' && c[1]?.uniform === 'uLook').map((c) => c[2]);
  r.renderCharacterSprite({ vao: { id: 'arm' }, ranges, weaponGlow: fire, offWeaponGlow: frost }, I4(), I4(), I4(), 800, 600);
  assert.deepEqual(instanced(), [[30, 12, glowRingDraws('fire').length], [50, 8, glowRingDraws('frost').length]], 'the right blade\'s rings, then the left blade\'s');
  assert.deepEqual(looks(), [fire.code, frost.code, fire.code, frost.code], 'each its own element, rings and charge');
  log.length = 0;
  r.renderCharacterSprite({ vao: { id: 'arm' }, ranges, weaponGlow: null, offWeaponGlow: frost }, I4(), I4(), I4(), 800, 600);
  assert.deepEqual(instanced(), [[50, 8, glowRingDraws('frost').length]], 'a plain right blade and a frost left: the left alone');
  log.length = 0;
  r.renderCharacterSprite({ vao: { id: 'arm' }, ranges: ranges.map((x) => (x.slot === 'offweapon' ? { ...x, hidden: true } : x)), weaponGlow: null, offWeaponGlow: frost }, I4(), I4(), I4(), 800, 600);
  assert.deepEqual(instanced(), [], 'a hidden blade wears nothing');
  // the third-person picture's pad: room for the larger of the two blades' outlines
  const box = (opts) => drawRigSpriteBox({ characterSpriteBatchOpen: true, queueCharacterSprite: () => {} }, { clientHeight: 480 }, {}, I4(), { center: [0, 1, -4], halfW: 0.4, halfH: 0.9, ...opts }, perspective(1.1, 640 / 480, 0.1, 500), lookAt([0, 1.6, 6], [0, 1, 0], [0, 1, 0]), [0, 1, 0]);
  const plain = box({});
  assert.ok(glowPad('fire', plain.ph) > glowPad('frost', plain.ph));
  assert.equal(box({ glowLook: ['frost', 'fire'] }).ph, plain.ph + 2 * glowPad('fire', plain.ph), 'a frost blade and a fire one: the fire\'s room');
  assert.equal(box({ glowLook: 'frost' }).ph, plain.ph + 2 * glowPad('frost', plain.ph), 'one look as before');
  assert.match(rd('src/combat/fpArm.js'), /const padLooks = offGlow \? \[glowLook, offGlow\.look\]\.filter\(Boolean\) : glowLook;/);
  // the rig: each hand its own item's - the classic pair, each widget clone, the Morrowind arm's two blades
  const rig = rd('src/combat/weapon/weaponRig.js');
  assert.match(rig, /glowFor: \(hand\) => glowOf\(playerWeapon\.handItem\(hand\)\)/, 'the classic pair');
  assert.match(rig, /function cloneFrame\(item, hand, f\) \{[^]{0,400}glow: glowOf\(item\)/, 'each clone - the one hand\'s and each of a pair\'s');
  assert.match(rig, /fpArm\.setWeaponGlow\?\.\(meshGlow\(armItem\), armItem\);\s*fpArm\.setOffWeaponGlow\?\.\(offItem \? meshGlow\(offItem\) : null, offItem\);/, 'the arm: the blade it holds, and the left its own');
  assert.match(rd('src/combat/weapon/weaponWidget.js'), /renderer\.drawScreenQuad\(tex, rect, uv, tint \?\? undefined\);\s*if \(ctx\.glow\) renderer\.drawScreenQuadGlow\?\.\(tex, rect, uv, ctx\.glow,/, 'a clone of a pair: its outline on its own rect and source');
});

const ARENA2 = process.env.ARENA2_PATH;
const NO_ARENA2 = (!ARENA2 || !existsSync(ARENA2)) && 'ARENA2_PATH not set or missing - real-data validation skipped';

test('TWO-HANDS (ARENA2): THE CUT STAYS OFF THE SCREEN, measured on the shipped art - the running arm, WEAPON10\'s jab across (a fist seen from its back), leaves its frame at the foot alone and stands a third of the view; every weapon a pair holds is drawn flush to the view\'s side, its hand cut at its outer side (all but the plain mace), so its guard only lowers (Mac: "The sprite on the right moves to the right and exposes where it clips off")', { skip: NO_ARENA2 }, () => {
  const cif = (file) => { const c = new CifRciFile(); c.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), file))), file); return c; };
  /** Opaque pixels down a column, the foot's own row aside (a sleeve leaving at the foot touches its corner). */
  const sideCut = (b, x) => { let n = 0; for (let y = 0; y < b.height - 1; y++) if (b.data[y * b.width + x]) n++; return n; };
  const w10 = cif('WEAPON10.CIF');
  const rec = getWeaponAnims(WEAPON_TYPES.Melee)[STATE_INDEX[RUN_PUMP.ARM_STATE]].Record;
  assert.equal(rec, 2, 'the jab across - a closed fist seen from its back (PIN MOVED, TWO-HANDS FIELD: record 5, the uppercut, shows the fist\'s inside in every frame - Mac: "Why is the underhand showing when extended and not the fist")');
  {
    const b = w10.getDFBitmap(rec, RUN_PUMP.ARM_FRAME);
    const cut = sideCut(b, 0) + sideCut(b, b.width - 1);
    const foot = b.data.subarray((b.height - 1) * b.width).some((v) => v > 0);
    // the rows the arm stands from its foot: a third of the view - record 5's peak frames stood 98 of 200, half the
    // screen ("Too high, like uppercuts")
    let topRow = 0; while (topRow < b.height && !b.data.subarray(topRow * b.width, (topRow + 1) * b.width).some((v) => v > 0)) topRow++;
    const stands = b.height - topRow;
    assert.ok(cut === 0 && foot, `frame ${RUN_PUMP.ARM_FRAME}: the arm leaves at its foot alone (${cut} cut at its sides)`);
    assert.ok(stands <= 0.35 * 200, `and stands ${stands} of the view's 200 rows - a third of it`);
  }
  const uncut = [];
  for (const t of DUAL_TYPES) {
    const a = getWeaponAnims(t)[STATE_INDEX.Idle];
    assert.ok(a.Alignment === getWeaponAnims(WEAPON_TYPES.Melee)[0].Alignment && a.Offset <= 0.04, `${WEAPON_FILE[t]}: its idle flush to the view's right side (Offset ${a.Offset})`);
    const b = cif(WEAPON_FILE[t]).getDFBitmap(0, 0);
    if (!sideCut(b, b.width - 1)) uncut.push(WEAPON_FILE[t]);
  }
  assert.deepEqual(uncut, ['WEAPON05.CIF'], 'every one-handed weapon\'s idle is cut at its outer side but the plain mace\'s - a tuck in drew the cut');
});

test('TWO-HANDS rig (AUDIT 2): THE SPRITE LANE, AUDITED AGAIN - the guard never moves a striking picture; the two Weapon Widget clones keep one clock; a punch off the running arm winds up from below; the run kept through a hop; the Morrowind arm\'s hands through one door (the pack\'s too); the left clone at rest through single-hand play; a pair\'s clones never flipped; the fists\' bounce gone in a strike', async () => {
  // THE GUARD IS THE RESTING HAND'S: every strike frame of either hand is drawn where the opening blow drew it (the
  // synthetic art is one CIF for every weapon), never lowered by a guard it is easing out of
  const pr = await rigWith({ right: KATANA, left: DAGGER });
  const seenAt = new Map();
  let moved = 0, strikes = 0;
  for (let i = 0; i < 240; i++) {
    for (const x of await pr.frame({ held: true })) {
      if (x.rec === '0') continue;
      strikes++;
      const key = `${String(x.tex).split(':').slice(-2).join(':')}:${x.mirrored}`;
      if (!seenAt.has(key)) seenAt.set(key, x.rect.y); else if (Math.abs(seenAt.get(key) - x.rect.y) > 0.01) moved++;
    }
  }
  assert.ok(strikes > 60 && moved === 0, `no strike frame moved by the guard (${moved} of ${strikes})`);
  // THE BOUNCE IS GONE IN A STRIKE (L5): the fists held at it, the bounce eased away
  const fb = await rigWith({});
  for (let i = 0; i < 90; i++) await fb.frame();
  assert.ok(fb.r.twoHands.state.bounce > 0.9, 'alive at rest');
  for (let i = 0; i < 90; i++) await fb.frame({ held: true });
  assert.ok(fb.r.twoHands.state.bounce < 0.1, `gone in a strike (${fb.r.twoHands.state.bounce})`);
  // THE LEFT CLONE AT REST THROUGH SINGLE-HAND PLAY (L4: it was stepped at boot and loaded the left hand's art), and
  // ON THE RIGHT CLONE'S CLOCK when the hands become a pair (it woke seconds behind: the hands bobbed out of step)
  const one = await rigWith({ right: KATANA, widget: true, walk: true });
  for (let i = 0; i < 200; i++) await one.frame({ move: 3 });
  assert.equal(one.r.twoHands.offWidget._w.time, 0, 'never stepped while one hand is in use');
  // ...born at rest out of sight - and shown on its very first frame (a game loaded with a pair up) it stands at its place
  const born = (shown) => { const ww = createWeaponWidget({ hidden: true }); ww.lateUpdate(1 / 60, { shown, motion: {}, look: [0, 0] }); return ww._w.offsetCurrent; };
  assert.deepEqual([born(true), born(false)], [[0, 0], [2, 2]]);
  assert.ok(one.r.twoHands.offWidget.settledHidden);
  one.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(121, 'Katana B');   // a matched pair: one placement, mirrored
  for (let i = 0; i < 90; i++) await one.frame({ move: 3 });
  assert.equal(one.r.twoHands.offWidget._w.time, one.r.widget._w.time, 'stepped on the right clone\'s clock');
  let unmirrored = 0, both = 0;
  for (let i = 0; i < 90; i++) {
    const q = await one.frame({ move: 3 });
    const r = q.find((x) => !x.mirrored)?.rect, l = q.find((x) => x.mirrored)?.rect;
    if (r && l) { both++; if (Math.abs(l.x - (320 - r.x - r.w)) > 0.05) unmirrored++; }
  }
  assert.ok(both > 60 && unmirrored === 0, `after the single-hand stretch the hands bob as each other's mirror (${unmirrored} of ${both} apart)`);
  // A PAIR'S CLONES ARE NEVER FLIPPED (L5: only the classic sprite was driven left-handed) - by Handedness or Ambidexterity
  const lh = await (async () => { const o = await rigWith({ right: KATANA, left: DAGGER, widget: true }); setValue('Controls', 'Handedness', 1); return o; })();
  for (let i = 0; i < 30; i++) await lh.frame();
  assert.deepEqual([lh.r.widget.flipHorizontal, lh.r.twoHands.offWidget.flipHorizontal], [false, false], 'drawn as right hands, the mirror the rig\'s');
  resetToDefaults();
  // A PUNCH OFF THE RUNNING ARM winds up from below the view (L2: the Weapon Widget's Idle wind-up drew the fists' rest in
  // sight, where no fist stood, and sank it) - never a rested fist above the arm's foot before its strike frames
  const pun = await rigWith({ run: true, widget: true });
  for (let i = 0; i < 60; i++) await pun.frame({ move: 7 });
  const restY = (await (await rigWith({ widget: true })).frame()).find((x) => x.rec === '0')?.rect.y;
  let punched = null, risen = 0;
  for (let i = 0; i < 40; i++) {
    const q = await pun.frame({ move: 7, held: i === 0 });
    const s = pun.r.playerWeapon.strikeInFlight;
    if (s && !punched) punched = s.hand;
    if (!punched) continue;
    const idle = q.filter((x) => x.rec === '0' && shownArm(x) === punched);
    if (idle.some((x) => x.rect.y < restY + x.rect.h * 0.5)) risen++;
    if (q.some((x) => x.rec !== '0' && x.rec !== RUN_REC && shownArm(x) === punched)) break;   // its strike frames: done
  }
  assert.ok(punched, 'a punch thrown on the run');
  assert.equal(risen, 0, 'its wind-up never stood the fist at its rest');
  // THE RUN KEPT THROUGH A HOP (L2: a jump swapped arms, fists, fists, arms in under a second) - and ended by a fall
  const hop = await rigWith({ run: true });
  for (let i = 0; i < 60; i++) await hop.frame({ move: 7 });
  hop.cam.grounded = false;
  let fists = 0;
  for (let i = 0; i < 24; i++) { const q = await hop.frame({ move: 7 }); if (q.some((x) => x.rec === '0')) fists++; }   // 0.4 s aloft
  hop.cam.grounded = true;
  assert.equal(fists, 0, 'no fists through a hop');
  assert.equal((await hop.frame({ move: 7 })).filter((x) => x.rec === RUN_REC).length, 2, 'the arms still running on landing');
  assert.equal(runHandsKept({ wanted: false, aloft: true, wasWanted: true, airSeconds: RUN_PUMP.AIR_GRACE + 0.01 }), false, 'a fall ends it');
  assert.equal(runHandsKept({ wanted: false, aloft: true, wasWanted: false, airSeconds: 0 }), false, 'a jump from standing starts none');
  assert.equal(runHandsKept({ wanted: false, aloft: false, wasWanted: true, airSeconds: 0 }), false, 'on the ground, the run\'s own answer');
  // THE MORROWIND ARM'S HANDS THROUGH ONE DOOR (L4: the pack kept its own one-hand read - a left-led pair held the left
  // weapon in both hands while the window was up)
  const calls = [];
  const saved = { setWeapon: fpArm.setWeapon, setOffWeapon: fpArm.setOffWeapon, setHands: fpArm.setHands };
  const door = await rigWith({ right: KATANA, left: DAGGER });
  try {
    fpArm.setWeapon = (w) => { calls.push(['setWeapon', w?.name ?? null]); return true; };
    fpArm.setOffWeapon = (w) => calls.push(['setOffWeapon', w?.name ?? null]);
    fpArm.setHands = (h) => calls.push(['setHands', h.mode, h.lead]);
    door.r.playerWeapon.usingRightHand = false;   // a left-led pair
    door.r.handArm();
    assert.deepEqual(calls, [['setWeapon', 'Katana'], ['setHands', HANDS_MODE.Dual, 'L'], ['setOffWeapon', 'Dagger']], 'the right hand\'s item in the right, the left\'s in the left, the lead beside');
    let asked = 0;
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const e = { isPlayer: true, items: [KATANA, DAGGER], stats: {}, level: 1, career: {}, activeEffects: [], spells: [], equip: { slots: { [EQUIP_SLOTS.RightHand]: KATANA, [EQUIP_SLOTS.LeftHand]: DAGGER } } };
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, fpArm: { ...fpArm, setWorn() {}, figure: () => null, subscribe: () => () => {} }, usingRightHand: () => false, handArm: () => { asked++; } });
      view.unmount();
    });
    assert.ok(asked > 0, 'the pack asks the rig\'s door');
  } finally { Object.assign(fpArm, saved); }
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) assert.match(rd(host), /handArm: \(\) => [^\n]*\.handArm\?\.\(\)/, `${host} hands the pack the rig's door`);
});

test('TWO-HANDS rig, by source: the two-hands branch is the classic body\'s own (after the climb\'s return, before the arm\'s seam, never behind the held map) and the one-hand ladder below it is untouched; the hosts carry none of it', () => {
  const rig = rd('src/combat/weapon/weaponRig.js');
  const branch = rig.indexOf('if (c && !eotbHidesWeapon() && !fpArm.active() && !sheetWindowUp() && (runDrawn || (pairUp() && shown()))) {');   // PIN MOVED (AUDIT 2): the run as drawn this frame
  assert.ok(branch > 0, 'the branch, under the lanes\' vetoes');
  assert.ok(branch > rig.indexOf('if (!armsClimb && (_climbLower >= CLIMB_LOWER_GONE'), 'below the climb\'s lowering');
  assert.ok(branch < rig.indexOf('_armDrewLast = !eotbHidesWeapon() && fpArm.active();'), 'above the arm\'s seam');
  assert.match(rig, /const runHands = !!c && twoHands\.running && !fpArm\.active\(\) && !eotbHidesWeapon\(\) && !sheetWindowUp\(\);/);
  // AUDIT 2: and never over another picture in the hands - the run yields to it at once
  assert.match(rig, /const runDrawn = runHands && \(handsEmpty\(\) \|\| !\(shown\(\) \|\| torchOnly \|\| !!shieldRect \|\| gunSliding \|\| spellHandsDrawn\)\);/);
  assert.match(rig, /finally \{ widget\.endOfFrame\(\); twoHands\.offWidget\.endOfFrame\(\); shield\.endOfFrame\(\); \}/);
  assert.match(rig, /playerWeapon\.leftBusy = lightInHand\(\);[^\n]*\n\s*playerWeapon\.applyWeapon\(claws\);/, 'the light\'s hand decided before the mode');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(host), /twoHands|handsLaw/, `${host}: THE FOUR HOSTS - the rig is the one surface`);
  }
  // the HUD's diamond is handed the weapon AT REST in every host (AUDIT: never the off hand's mid-blow)
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(host), /weapon: (?:weaponRig|interiorWeapon)?\.?playerWeapon\.restingWeapon \?\? null,/, `${host}: the HUD's weapon`);
    assert.doesNotMatch(rd(host), /^\s+weapon: (?:weaponRig\.|interiorWeapon\.)?playerWeapon\.weapon \?\? null,/m, `${host}: never the weapon in use`);
  }
  // the off hand's terms reach every blow between players (AUDIT): each melee arm hands the STRIKING rig's off flag on
  const world = rd('src/scenes/world.js');
  assert.equal((world.match(/\{ off: weaponRig\.playerWeapon\.offStrike \}/g) ?? []).length, 3, 'the duel, the battle and the wild zone');
  assert.match(world, /\.\.\.\(weaponRig\.playerWeapon\.offStrike \? \{ off: true \} : \{\}\) \}, duelStandIn\(\)\);$/m, 'and the siege\'s works');
  assert.equal((world.match(/resolveDuelStrike\(\{[^\n]*\.\.\.\(off \? \{ off \} : \{\}\) \}, duelStandIn\(\)\)/g) ?? []).length, 3, 'each strike-out hands it to the roll');
  assert.match(rd('src/scenes/dungeonContext.js'), /opts\.wildStrike\(best, playerWeapon\.strikingWeapon, playerWeapon\.machine\?\.state, \{ off: playerWeapon\.offStrike \}\)/, 'the dungeon\'s own rig too');
  // AUDIT 2: AND THE RELAY BETWEEN THEM - the streamed world's dungeon (worldModes.js builds its context, the only live
  // builder) hands the dungeon's `{ off }` on to the host's door, which had dropped it: the arrows' own source, chained
  // as the game chains them
  const relayText = rd('src/scenes/worldModes.js').match(/wildStrike: (\([^)]*\) => !!host\.wildStrike\?\.\([^)]*\)),/)?.[1];
  const doorText = rd('src/scenes/world.js').match(/wildStrike: (\(id, weapon, swing, o\) => wildStrikeOut\(id, 'melee', weapon, swing, 0, o\)),/)?.[1];
  assert.ok(relayText && doorText, 'the relay and the door, found');
  const sent = [];
  const door = new Function('wildStrikeOut', `return ${doorText};`)((to, by, weapon, swing, drawMs = 0, { off = false } = {}) => { sent.push(off); return true; });
  const relay = new Function('host', `return ${relayText};`)({ wildStrike: door });
  assert.equal(relay('peer', null, 'StrikeDown', { off: true }), true);
  assert.deepEqual(sent, [true], `the off-hand blow reaches the host's door as the off hand's (${relayText})`);
  // the classic sprite's placement is FPSWeapon's, shared by the second hand
  const fps = rd('src/combat/fpsWeapon.js');
  // the record rides the quad (WEAPON-GLOW1's outline is measured in its own pixels), the draw's two lines main's own
  assert.match(fps, /const q = fpsWeaponQuad\(canvas, art, state, frame, \{ flipHorizontal, offsetHeight \}\);\n\s*if \(!q\) return;\n\s*const \{ tex, rect: \{ x, y, w, h \}, uv: src, rec \} = q;\n\s*renderer\.drawScreenQuad\(tex, \{ x, y, w, h \}, src, tint \?\? undefined\);[^\n]*\n\s*if \(glow\) renderer\.drawScreenQuadGlow\?\.\(tex, \{ x, y, w, h \}, src, glow, \{ art: \[rec\.width, rec\.height\]/);
  // and the one hand's clone draws the mod's own line; only a hand of a pair takes the guard and the mirror
  assert.match(rd('src/combat/weapon/weaponWidget.js'), /if \(!transform && !mirror\) \{\n\s*renderer\.drawScreenQuad\(tex, getWeaponRect\(\), w\.curAnimRect, tint \?\? undefined\);\n\s*if \(ctx\.glow\) renderer\.drawScreenQuadGlow\?\.\(tex, getWeaponRect\(\), w\.curAnimRect, ctx\.glow,[^\n]*\n\s*return true;\n\s*\}/);
});

test('TWO-HANDS rig: a left-handed player\'s picture is mirrored whole - the right hand on the left, mirrored; the left hand on the right, as DFU draws a right hand', async () => {
  resetToDefaults();
  const { r, frame } = await (async () => { const o = await rigWith({}); setValue('Controls', 'Handedness', 1); return o; })();
  for (let i = 0; i < 4; i++) await frame();
  const q = await frame();
  const [left, right] = [...q].sort((a, b) => a.rect.x - b.rect.x);
  assert.equal(left.mirrored, true); assert.equal(right.mirrored, false);
  let seen = null;
  for (let i = 0; i < 120 && !seen; i++) {
    const qq = await frame({ held: true });
    if (r.playerWeapon.strikeInFlight?.hand === 'R') seen = qq.find((x) => x.rec !== '0') ?? null;
  }
  assert.ok(seen, 'the right hand struck');
  assert.equal(shownArm(seen), 'L', 'the right hand\'s blow is on the left of the screen: its arm the left of the picture, as painted or in the mirror');
  resetToDefaults();
});

test('TWO-HANDS weaponTypeForItem and handDesc: a hand\'s item read as the law reads it', () => {
  assert.deepEqual(handDesc(null), null);
  assert.deepEqual(handDesc(KATANA), { item: KATANA, type: weaponTypeForItem(KATANA), hands: ITEM_HANDS.Either, shield: false });
  assert.equal(handDesc(CLAYMORE).hands, ITEM_HANDS.Both);
});
