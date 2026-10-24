// MIXED-PAIR (2026-10-23, the owner: "Being able to hold a melee and pistolet as a duel wield option"; "Make the best
// decisions"; bible/05-Combat/Two-Hands.md "A blade and a gun"). A one-handed blade in one hand and a Dwarven Pistolet in the
// other are a pair: the law (combat/twoHands/handsLaw.js gunHandOf, mixedStrike, MIXED), the turns on the two machines
// (combat/playerWeapon.js _mixedAttack), the one-handed reload, the off hand's terms on either kind, and the sprite lane
// through the real rig (combat/weapon/weaponRig.js: the gun on its own frame, the blade on the pair's, each lowered under
// the other's strike). The balance is MEASURED through the machine and the formula, as Two-Hands' is.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPistolet } from '../../src/systems/pistolet.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { PlayerWeapon, handDesc } from '../../src/combat/playerWeapon.js';
import { playerArrowHitFoe } from '../../src/combat/arrowFlight.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import {
  HANDS_MODE, handsModeOf, gunHandOf, mixedStrike, MIXED, DUAL, OFF_HAND_BLOW, offHandDamage, FLURRY_WINDOW,
} from '../../src/combat/twoHands/handsLaw.js';
import { PISTOLET_FEEL } from '../../src/combat/gun/gunFeel.js';
import { pistolRig } from './weapon/pistolRigHarness.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { midScreenText } from '../../src/ui/midScreenText.js';
import { setModSetting } from '../../src/systems/modSettings.js';
import { fpArm } from '../../src/combat/fpArm.js';
import { isBowWeapon } from '../../src/scenes/hostCombat.js';

const weapon = (templateIndex, name) => ({ name, group: 'Weapons', templateIndex, material: 0, currentCondition: 100000, maxCondition: 100000 });
const LONGSWORD = () => weapon(120, 'Longsword');
const DAGGER = () => weapon(113, 'Dagger');
const CLAYMORE = () => weapon(122, 'Claymore');
const BUCKLER = { name: 'Buckler', group: 'Armor', templateIndex: 109, material: 0 };
const desc = (item) => handDesc(item);

function pairOf(right, left, { lead = 'R' } = {}) {
  const pw = new PlayerWeapon();
  pw.updateHands(right, left);
  pw.usingRightHand = lead === 'R';
  pw.applyWeapon();
  return pw;
}
/** AUDIT MIXED-PAIR L1-2: a pair in the GAME's own swing - the rig's `swingCtx` over an entity wearing the hands, at its
 *  live Speed (combat/weapon/weaponRig.js:"playerWeapon.animCtx = () =>") - never a bare hand's heft. */
const fighter = (speed = 50) => ({ isPlayer: true, level: 1, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), armor: 0, stats: { strength: 50, agility: 50, luck: 50, speed, endurance: 50, willpower: 50, intelligence: 50, personality: 50 } });
function realPair(right, left, { lead = 'R', speed = 50 } = {}) {
  const ent = fighter(speed);
  ent.equip = { slots: { [EQUIP_SLOTS.RightHand]: right, [EQUIP_SLOTS.LeftHand]: left } };
  const pw = new PlayerWeapon({ liveSpeed: () => speed });
  pw.updateHands(right, left); pw.usingRightHand = lead === 'R'; pw.applyWeapon(); pw.sheathed = false;
  pw.animCtx = () => pw.swingCtx(ent);
  return pw;
}
const DT = 1 / 60;
const step = (pw, n = 1) => { const evs = []; for (let i = 0; i < n; i++) evs.push(...pw.update(DT)); return evs; };
const untilIdle = (pw) => { for (let i = 0; i < 600 && (pw.machine.state !== 'Idle' || pw.strike); i++) pw.update(DT); };

test('MIXED-PAIR THE LAW: a one-handed blade and a Pistolet are a PAIR (handsModeOf), and gunHandOf names the gun\'s hand - never for two blades, two guns, one weapon, a shield or a two-hander; MIXED.RELOAD is the record\'s (mutants: the two-of-a-kind clause back; the gun\'s hand swapped; a blade read as a gun)', () => {
  const [sword, gun] = [LONGSWORD(), createPistolet()];
  assert.equal(handsModeOf({ right: desc(sword), left: desc(gun) }), HANDS_MODE.Dual, 'a blade and a gun are a pair');
  assert.equal(handsModeOf({ right: desc(gun), left: desc(sword) }), HANDS_MODE.Dual);
  assert.equal(gunHandOf(desc(sword), desc(gun)), 'L');
  assert.equal(gunHandOf(desc(gun), desc(sword)), 'R');
  assert.equal(gunHandOf(desc(sword), desc(DAGGER())), null, 'two blades: no gun hand');
  assert.equal(gunHandOf(desc(gun), desc(createPistolet())), null, 'two guns: a gun pair, not a mixed one');
  assert.equal(gunHandOf(desc(gun), null), null, 'one gun: no pair');
  assert.equal(gunHandOf(desc(sword), { item: BUCKLER, shield: true }), null, 'a shield is no hand of a pair');
  assert.equal(handsModeOf({ right: desc(CLAYMORE()), left: desc(gun) }), HANDS_MODE.Single, 'a two-hander never pairs');
  assert.equal(handsModeOf({ right: desc(createThunderlock()), left: desc(sword) }), HANDS_MODE.Single, 'nor the two-handed Thunderlock');
  assert.equal(handsModeOf({ right: desc(sword), left: desc(gun), leftBusy: true }), HANDS_MODE.Single, 'a light in the hand still breaks it');
  assert.deepEqual({ ...MIXED }, { RELOAD: 2 });   // AUDIT MIXED-PAIR L1-2: 1.5 counted the same whole blows as a free hand
});

test('MIXED-PAIR THE PULL FALLS TO THE BLADE (mixedStrike): the law\'s gun hand that cannot fire gives the pull to the blade - never a flurry\'s, the off hand\'s exactly when the blade is not the lead; a gun that can fire, a blade named, or no mixed pair, the law\'s answer unchanged (mutants: no fall; the fall a flurry; the fall\'s off read off the gun)', () => {
  const gunL = { hand: 'L', flurry: true, off: true };
  assert.deepEqual(mixedStrike(gunL, { gunHand: 'L', gunReady: false, lead: 'R' }), { hand: 'R', flurry: false, off: false }, 'the lead blade takes it, whole');
  assert.deepEqual(mixedStrike({ hand: 'R', flurry: false, off: false }, { gunHand: 'R', gunReady: false, lead: 'R' }), { hand: 'L', flurry: false, off: true }, 'a lead gun reloading: the off blade');
  assert.equal(mixedStrike(gunL, { gunHand: 'L', gunReady: true, lead: 'R' }), gunL, 'a loaded gun fires');
  const blade = { hand: 'R', flurry: true, off: false };
  assert.equal(mixedStrike(blade, { gunHand: 'L', gunReady: false, lead: 'R' }), blade, 'a blade named swings');
  assert.equal(mixedStrike(gunL, { gunHand: null, gunReady: false }), gunL, 'no mixed pair: nothing to fall to');
});

test('MIXED-PAIR THE TURNS through the machine: a held trigger opens with the lead blade, the gun answers inside FLURRY_WINDOW, and while the gun reloads every pull is the blade\'s; never two strikes at once - a shot\'s frames hold the blade, a swing holds the gun; the counts a minute at Speed 50 (mutants: the overlap; the reload not the gun\'s alone; the classic clock blind to the shot\'s end)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet());
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.equal(pw.gunHand, 'L');
  assert.equal(pw.mixedPair, true);
  const order = [];
  let overlap = 0, hits = { R: 0, L: 0 };
  for (let t = 0; t < 60; t += DT) {
    pw._attack('StrikeDown');
    const s = pw.strike;
    if (s && order.at(-1) !== s.hand) order.push(s.hand);
    // the gun firing and a blade's swing on the classic machine at once is the overlap the pair never allows
    if (pw.pistols.L.state === 'Firing' && s?.hand === 'R') overlap++;
    for (const e of pw.update(DT)) if (e === 'hit') hits[pw.strike?.hand ?? '?']++;
  }
  assert.deepEqual(order.slice(0, 3), ['R', 'L', 'R'], 'the lead blade opens, the gun answers, the blade again');
  assert.equal(overlap, 0, 'one strike at a time');
  assert.ok(hits.R > 2 * hits.L && hits.L > 0, `the blade fills the gun's one-handed reload (${JSON.stringify(hits)})`);
  // AUDIT MIXED-PAIR L1-2: the counts a minute in the GAME's own swing (realPair - the blade's heft, the live Speed), at
  // 30, 60 and 144 frames a second: three blows to a shot, and a lone Pistolet's and a lone longsword's the same minute
  const minute = (pwx, fps) => { const n = { R: 0, L: 0 }; for (let t = 0; t < 60; t += 1 / fps) { pwx._attack('StrikeDown'); for (const e of pwx.update(1 / fps)) if (e === 'hit') n[pwx.activeHand]++; } return n; };
  for (const fps of [30, 60, 144]) {
    const n = minute(realPair(LONGSWORD(), createPistolet()), fps);
    assert.ok(n.L >= 16 && n.L <= 17 && n.R >= 3 * n.L - 1 && n.R <= 3 * n.L + 2, `${fps} fps: ${JSON.stringify(n)}`);
  }
  assert.deepEqual(minute(realPair(createPistolet(), null), 60), { R: 32, L: 0 });
  assert.deepEqual(minute(realPair(LONGSWORD(), null), 60), { R: 52, L: 0 });
});

test('MIXED-PAIR THE ONE-HANDED RELOAD: the gun beside a blade reloads MIXED.RELOAD times a free hand\'s - its own machine\'s, so a gun moved to the other hand takes it, a gun pair and a lone gun keep the free hand\'s, and the blade put away mid-reload loads at the free pace from there (mutants: the reload on both machines; never reset)', () => {
  const free = PISTOLET_FEEL.reloadMs, oneHanded = free * MIXED.RELOAD;
  const gun = createPistolet(), sword = LONGSWORD();
  const pw = pairOf(sword, gun);
  pw._attack('StrikeDown'); step(pw);   // the pistols made
  assert.deepEqual([pw.pistols.R.cooldownMs, pw.pistols.L.cooldownMs], [free, oneHanded], 'the left gun loads one-handed');
  pw.updateHands(gun, sword); pw.applyWeapon(); step(pw);
  assert.deepEqual([pw.pistols.R.cooldownMs, pw.pistols.L.cooldownMs], [oneHanded, free], 'moved to the right: the right\'s reload');
  pw.updateHands(gun, createPistolet()); pw.applyWeapon(); step(pw);
  assert.deepEqual([pw.pistols.R.cooldownMs, pw.pistols.L.cooldownMs], [free, free], 'a gun pair: a free hand\'s each');
  // the reload as the pull reads it: a shot, then the blade beside it, then the gun again at one-handed pace
  const p2 = pairOf(sword, gun, { lead: 'L' });
  assert.ok(p2._attack('StrikeDown') && p2.strike.hand === 'L', 'the lead gun fires');
  untilIdle(p2);
  const loaded = p2.handReloadUntil('L');
  const fired = p2.machine.now;
  while (p2.machine.now < loaded + 0.5) { p2._attack('StrikeDown'); p2.update(DT); if (p2.strike?.hand === 'L') break; }
  assert.ok(p2.machine.now - fired >= oneHanded / 1000 - 0.1, `the gun waits out its one-handed reload (${(p2.machine.now - fired).toFixed(2)} s)`);
  // the blade put away mid-reload: the gun alone loads at a free hand's pace from there - AUDIT MIXED-PAIR L1-6: the share
  // already loaded stands (it was the elapsed time that stood, so 70% of a one-handed reload was all but loaded at once)
  const p3 = pairOf(sword, gun, { lead: 'L' });
  p3._attack('StrikeDown'); untilIdle(p3);
  while (p3.pistols.L.cooledMs < 0.7 * oneHanded) p3.update(DT);
  const share = p3.pistols.L.cooledMs / oneHanded;
  p3.updateHands(null, gun); p3.applyWeapon(); step(p3);
  assert.equal(p3.pistols.L.cooldownMs, free);
  assert.ok(Math.abs(p3._pistolLeft('L') - ((1 - share) * free) / 1000) < 2 * DT, `the rest at a free hand's pace (${p3._pistolLeft('L').toFixed(3)} s left of ${(((1 - share) * free) / 1000).toFixed(3)})`);
  // and a blade drawn beside a lone gun mid-reload: the rest at the one-handed pace
  const lone = pairOf(null, gun, { lead: 'L' });
  lone._attack('StrikeDown'); untilIdle(lone);
  while (lone.pistols.L.cooledMs < 0.8 * free) lone.update(DT);
  const had = lone.pistols.L.cooledMs / free;
  lone.updateHands(sword, gun); lone.applyWeapon(); step(lone);
  assert.ok(Math.abs(lone._pistolLeft('L') - ((1 - had) * oneHanded) / 1000) < 2 * DT, `the rest one-handed (${lone._pistolLeft('L').toFixed(3)} s)`);
});

test('MIXED-PAIR THE FALL IN THE MACHINE: a pull the law gives the gun while it reloads - or with no Pellet for it (`gunReady`) - is the blade\'s, from its first frame (no flurry\'s frame); a technique is the lead\'s alone and waits for a lead gun (mutants: no fall in the machine; a fall thrown as a flurry; a technique falling)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet());
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  untilIdle(pw);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L', 'the gun answers inside the window');
  untilIdle(pw);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  untilIdle(pw);
  assert.equal(pw.pistols.L.state, 'Cooling', 'the gun still reloading');
  assert.ok(pw._attack('StrikeDown'), 'the pull the law gives the gun...');
  assert.equal(pw.strike.hand, 'R', '...is the blade\'s');
  assert.equal(pw.strike.flurry, false, 'never a flurry\'s');
  assert.equal(pw.machine.frame, 0, 'from its first frame');
  // no Pellet: the loaded gun refuses its own pull, the blade takes it
  const dry = pairOf(LONGSWORD(), createPistolet());
  dry.gunReady = () => false;
  for (let i = 0; i < 4; i++) { assert.ok(dry._attack('StrikeDown')); assert.equal(dry.strike.hand, 'R'); untilIdle(dry); }
  // a technique is the lead's: a lead gun reloading refuses it - the blade does not throw the gun's technique
  const led = pairOf(LONGSWORD(), createPistolet(), { lead: 'L' });
  assert.ok(led.techniqueStrike('StrikeDown')); untilIdle(led);
  assert.equal(led.techniqueStrike('StrikeDown'), false, 'the lead gun reloading: no technique');
  // AUDIT MIXED-PAIR L5-5: nor with no Pellet for it - a loaded lead gun with none fires no technique (AUDIT PISTOL-PORT A5)
  const dryLed = pairOf(LONGSWORD(), createPistolet(), { lead: 'L' });
  dryLed.gunReady = () => false;
  assert.equal(dryLed.techniqueStrike('StrikeDown'), false, 'no Pellet: no technique');
  assert.equal(dryLed.pistols.L.shots, 0);
});

test('MIXED-PAIR THE OFF HAND\'S TERMS ON EITHER KIND: the off gun\'s shot lands DUAL\'s share at impact, read off the gun it left; the off blade\'s swing is an offStrike with its held ticks; H swaps the lead and the terms with it (mutants: the off gun landing whole; the shot\'s weapon the blade)', () => {
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  const foe = () => ({ entity: { minMetalToHit: -1, armorValues: [0, 0, 0, 0, 0, 0, 0], items: [], basics: { bloodIndex: 2 }, isClass: false, careerIndex: 0, skills: 0, maxHealth: 300, health: 300, stats: { strength: 50, agility: 50, luck: 50 } }, ai: { feet: [0, 0, 0], yaw: 0 } });
  const shooter = () => ({ isPlayer: true, level: 1, skills: 30, skillUses: [], stats: { strength: 50, agility: 50, luck: 50 } });
  const landed = (w, pwx) => playerArrowHitFoe({ weapon: w, fromPlayer: true, summoned: false, pos: [0, 1, 0], dir: [0, 0, 1] }, foe(),
    { playerEntity: shooter(), playerWeapon: pwx, playerFeet: [0, 0, 5], dealDamage: () => {}, say: () => {}, rolls: seq(0, 0.99, 0.05, 0.999, 0.99) });
  const gun = createPistolet(), sword = LONGSWORD();
  const pw = pairOf(sword, gun);
  assert.equal(pw.isOffHandItem(gun), true, 'the gun beside a lead blade is the off hand\'s');
  assert.equal(pw.isOffHandItem(sword), false);
  const lone = landed(gun, pairOf(gun, null));
  assert.ok(lone > 0);
  assert.equal(landed(gun, pw), offHandDamage(lone), 'its shot lands DUAL\'s share');
  // the gun strikes: its hit is the gun's - the weapon the hosts fire is the gun, the strike the off hand's
  pw._attack('StrikeDown'); untilIdle(pw);
  pw._attack('StrikeDown');
  assert.equal(pw.strike.hand, 'L');
  const evs = []; for (let i = 0; i < 10 && !evs.includes('hit'); i++) evs.push(...pw.update(DT));
  assert.ok(evs.includes('hit'), 'the shot\'s hit');
  assert.equal(pw.weapon, gun, 'the weapon the hosts fire is the gun');
  assert.equal(pw.offStrike, true, 'and the strike the off hand\'s');
  assert.equal(pw.blowWeight, OFF_HAND_BLOW.blowWeight);
  // H: the gun leads - its shot whole, the blade the off hand's swing, with its held ticks (landed on an idle machine:
  // a shot's impact takes the machine's swing modifiers as it stands, as the lone gun's did)
  untilIdle(pw);
  pw.toggleHand({ bowSwitching: false });
  assert.equal(pw.leadHand, 'L');
  assert.equal(pw.isOffHandItem(gun), false);
  assert.equal(landed(gun, pw), lone, 'the lead gun\'s shot lands whole');
  const off = pairOf(sword, gun, { lead: 'L' });
  off.animCtx = () => ({ entity: { stats: { strength: 50 } }, weaponType: 3, usingRightHand: true });
  off.gunReady = () => false;   // the gun dry: the pull is the blade's, as the off hand
  assert.ok(off._attack('StrikeDown'));
  assert.equal(off.strike.hand, 'R');
  assert.equal(off.offStrike, true, 'the blade beside a lead gun is the off hand\'s');
  assert.equal(DUAL.OFF_DAMAGE, OFF_HAND_BLOW.blowWeight);
});

test('MIXED-PAIR A FLURRY\'S BLADE: the blade that answers the gun\'s shot inside FLURRY_WINDOW is thrown from the raised hand - DUAL.FLURRY_FROM_FRAME frames in - as any pair\'s answer, on the blade\'s own tick (mutants: the shot\'s end never told the classic clock; the blade begun on the pistol\'s clock)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet(), { lead: 'L' });
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L', 'the lead gun opens');
  untilIdle(pw);
  assert.ok(pw._attack('StrikeDown'));
  assert.deepEqual({ ...pw.strike }, { hand: 'R', flurry: true, off: true }, 'the blade answers the shot');
  assert.equal(pw.machine.frame, DUAL.FLURRY_FROM_FRAME);
  assert.deepEqual([pw.machine.tick, pw.machine.hitFrame, pw.machine.ranged], [null, null, false], 'on the blade\'s own law - the shot left the machine on the pistol\'s clock');
  untilIdle(pw);
  for (let t = 0; t < FLURRY_WINDOW + 0.1; t += DT) pw.update(DT);
  pw.gunReady = () => false;
  assert.ok(pw._attack('StrikeDown'));
  assert.deepEqual({ ...pw.strike }, { hand: 'R', flurry: false, off: true }, 'past the window the exchange opens again - the lead gun dry, its pull the blade\'s, from rest');
});

test('MIXED-PAIR THE BALANCE, MEASURED in the game\'s own swing (the rig\'s swingCtx, the blade\'s heft, the live Speed) and the formula (bible/05-Combat/Two-Hands.md "A blade and a gun"): a longsword and a Pistolet land a fifth over a longsword pair at Speed 10 and 50, near level at 100, the same at 30, 60 and 144 frames a second, on a fifth of a gun pair\'s Pellets; the one-handed reload costs the gun a shot in three at every Speed (mutants: MIXED.RELOAD 1; the reload\'s float edge)', () => {
  const foe = () => ({ isPlayer: false, careerIndex: 0, mobileType: MOBILE_TYPES.Rat ?? 0, health: 3000, maxHealth: 3000, armor: 0, skills: 30, minMetalToHit: -1, stats: { strength: 50, agility: 50, luck: 50 } });
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  const means = new Map();
  const mean = (w, off) => {
    const k = `${w.templateIndex}:${off}`;
    if (!means.has(k)) { let s = 0; const N = 20000; for (let i = 0; i < N; i++) s += Math.max(0, calculateAttackDamage(fighter(), foe(), { weapon: w, toHitMod: 1000, rolls: rnd, ...(off ? OFF_HAND_BLOW : {}) })); means.set(k, s / N); }
    return means.get(k);
  };
  // AUDIT MIXED-PAIR L1-2: measured with the pair's own ctx - the first measure handed every weapon a bare hand's heft
  const run = (R, L, { speed = 50, fps = 60, reload = null } = {}) => {
    const pw = realPair(R, L, { speed });
    // the free hand's pace for the comparison - its loaded share rescaled as the machine's own (L1-6), so the next frame's
    // rescale back to MIXED.RELOAD and this one cancel
    if (reload != null) { const was = pw._pistolsFor.bind(pw); pw._pistolsFor = () => { const p = was(); const g = p && pw.gunHand ? p[pw.gunHand] : null; const ms = PISTOLET_FEEL.reloadMs * reload; if (g && g.cooldownMs !== ms) { if (g.state === 'Cooling') g._cool *= ms / g.cooldownMs; g.cooldownMs = ms; } return p; }; }
    let d = 0, shots = 0;
    const dt = 1 / fps;
    for (let t = 0; t < 120; t += dt) {
      pw._attack('StrikeDown');
      for (const e of pw.update(dt)) {
        if (e !== 'hit') continue;
        const shot = pw.machine.ranged;
        if (shot) shots++;
        d += mean(pw.weapon, shot ? pw.isOffHandItem(pw.weapon) : pw.offStrike);
      }
    }
    return { dps: d / 120, shots: shots / 2 };
  };
  const ratio = {};
  for (const speed of [10, 50, 100]) {
    const mixed = run(LONGSWORD(), createPistolet(), { speed }), swordPair = run(LONGSWORD(), LONGSWORD(), { speed });
    const gunPair = run(createPistolet(), createPistolet(), { speed }), freeHand = run(LONGSWORD(), createPistolet(), { speed, reload: 1 });
    ratio[speed] = mixed.dps / swordPair.dps;
    assert.ok(mixed.shots < freeHand.shots, `Speed ${speed}: the one-handed reload costs the gun shots (${mixed.shots} a minute, ${freeHand.shots} with a hand free)`);
    assert.ok(mixed.shots <= 0.3 * gunPair.shots, `Speed ${speed}: a fifth of a gun pair's Pellets or fewer (${mixed.shots} to ${gunPair.shots})`);
  }
  assert.ok(ratio[10] > 1.15 && ratio[10] < 1.3, `Speed 10: a fifth over a longsword pair (x${ratio[10].toFixed(3)})`);
  assert.ok(ratio[50] > 1.12 && ratio[50] < 1.27, `Speed 50: a fifth over a longsword pair (x${ratio[50].toFixed(3)})`);
  assert.ok(ratio[100] >= 1 && ratio[100] < 1.08, `Speed 100: near level with a longsword pair (x${ratio[100].toFixed(3)})`);
  // the same at every frame rate (the reload's float edge cost the gun a whole blow at 30 frames a second, never at 60)
  const at = [30, 60, 144].map((fps) => run(LONGSWORD(), createPistolet(), { fps }).shots);
  assert.ok(Math.max(...at) - Math.min(...at) <= 1, `shots a minute at 30, 60 and 144 fps: ${at.join(', ')}`);
  // AUDIT MIXED-PAIR L1-3: a reload a float's width from its end is ended as the turn is decided (63 frames of 33.33 ms
  // are 2099.999999999998 ms) - the gun fires; a real share short of it still waits
  const edge = realPair(LONGSWORD(), createPistolet(), { lead: 'L' });
  assert.ok(edge._attack('StrikeDown', { lead: true })); untilIdle(edge);
  assert.equal(edge.pistols.L.state, 'Cooling');
  edge.pistols.L._cool = edge.pistols.L.cooldownMs - 2e-12;
  assert.equal(edge._attack('StrikeDown', { lead: true }), true, 'a hair short: loaded');
  assert.equal(edge.pistols.L.state, 'Firing');
  untilIdle(edge);
  edge.pistols.L._cool = edge.pistols.L.cooldownMs - 5;
  assert.equal(edge._attack('StrikeDown', { lead: true }), false, '5 ms short: still loading');
});

// ---- THE SPRITE LANE, THROUGH THE REAL RIG --------------------------------------------------------------------------

/** A WEAPON CIF (the two-hands suite's): the "wielding" image, then seven records of 120 x 100, five frames each. */
function cif() {
  const parts = Array.from({ length: 7 }, () => {
    const w = 120, h = 100, head = 12 + 31 * 2 + 2, runs = Math.ceil((w * h) / 127) + 1;
    const b = new Uint8Array(head + runs * 2); const v = new DataView(b.buffer);
    v.setUint16(0, w, true); v.setUint16(2, h, true);
    for (let f = 0; f < 5; f++) v.setUint16(12 + f * 2, head, true);
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
const MELEE = cif();
const isGun = (q) => String(q.tex).startsWith('pistolet');

test('MIXED-PAIR THE RIG, CLASSIC SPRITE: the blade on its own side as DFU draws it, the Pistolet on the other in the mirror (a hand of a pair, its own side - never the Handedness side a lone pistol takes); the striking hand drawn over the other; each lowered under the other\'s strike; a left-handed player\'s pair crossed (mutants: the gun on the lone pistol\'s side; the pair\'s branch the melee pair\'s; the gun\'s guard never; drawn in a fixed order)', async () => {
  for (const leftHanded of [false, true]) {
    const { r, frame } = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, leftHanded });
    const rest = await frame();
    const gunQ = rest.find(isGun), blade = rest.find((q) => !isGun(q));
    assert.ok(gunQ && blade, 'both hands drawn');
    const onLeft = (q) => q.rect.x + q.rect.w / 2 < 160;
    assert.equal(onLeft(gunQ), !leftHanded, `${leftHanded ? 'left-handed: ' : ''}the gun (left hand) on the ${leftHanded ? 'right' : 'left'}`);
    assert.equal(onLeft(blade), leftHanded, 'the blade on the other side');
    assert.equal(!!gunQ.uv, !leftHanded, 'the gun on the left drawn in the mirror');
    let bladeUnderShot = null, gunUnderBlow = null, gunReloading = null, overBlade = 0, overGun = 0, shots = 0;
    for (let i = 0; i < 360; i++) {
      const q = await frame(1 / 60, i < 340);
      const s = r.playerWeapon.strikeInFlight;
      if (s?.hand === 'L' && r.playerWeapon.pistols.L.state === 'Firing') shots = Math.max(shots, r.playerWeapon.pistols.L.shots);
      if (!s || q.length < 2) continue;
      const last = q.at(-1);
      // the gun's guard under the FIRST blow, the gun loaded and resting - before any shot dips it to reload
      if (s.hand === 'R') { if (isGun(last)) overGun++; else overBlade++; if (!shots) gunUnderBlow = Math.max(gunUnderBlow ?? -Infinity, q.find(isGun).rect.y); else gunReloading = Math.max(gunReloading ?? -Infinity, q.find(isGun)?.rect.y ?? -Infinity); }
      if (s.hand === 'L') { assert.ok(isGun(last), 'the gun\'s shot over the blade'); bladeUnderShot = Math.max(bladeUnderShot ?? -Infinity, q.find((x) => !isGun(x)).rect.y); }
    }
    assert.ok(overBlade > 0 && overGun === 0, 'the blade\'s blow drawn over the gun');
    assert.ok(gunUnderBlow > gunQ.rect.y + 2 && gunUnderBlow < gunQ.rect.y + 40, `the loaded gun lowers by its guard under the blade's blow (${gunQ.rect.y.toFixed(1)} -> ${gunUnderBlow.toFixed(1)})`);
    assert.ok(gunReloading > gunUnderBlow + 20, `and dips out of the way to reload, on its own frame, while the blade swings (${gunReloading.toFixed(1)})`);
    assert.ok(bladeUnderShot > blade.rect.y + 1, `the blade lowers under the shot (${blade.rect.y.toFixed(1)} -> ${bladeUnderShot.toFixed(1)})`);
  }
});

test('MIXED-PAIR THE RIG, THE GUN\'S PELLETS: with none in the pack the pair is not put away (a lone gun\'s guard is the gun\'s) and every pull is the blade\'s; with Pellets the gun fires (mutants: the pair sheathed for the gun\'s Pellets; the gun firing dry)', async () => {
  const said = [];
  const wasSet = midScreenText.set.bind(midScreenText);
  midScreenText.set = (m, d) => { said.push(m); return wasSet(m, d); };
  const dry = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, pellets: 0 });
  dry.r.playerWeapon.usingRightHand = false;   // the gun leads: the weapon in use at rest is the gun, which a lone gun's guard would sheathe
  for (let i = 0; i < 30; i++) await dry.frame(1 / 60, false);
  assert.equal(dry.r.playerWeapon.weapon?.templateIndex, createPistolet().templateIndex, 'at rest the weapon in use is the lead gun');
  assert.equal(dry.r.playerWeapon.sheathed, false, 'at rest, dry, not put away');
  for (let i = 0; i < 300; i++) await dry.frame(1 / 60, true);
  assert.equal(dry.r.playerWeapon.sheathed, false, 'still drawn');
  assert.equal(dry.r.playerWeapon.pistols.L.shots, 0, 'the gun never fired');
  assert.ok(dry.r.swing.n > 3, `the blade swung (${dry.r.swing.n})`);
  // AUDIT MIXED-PAIR L4-8: and the gun's want is said - once, FPSWeapon's own line - never a silent gun
  assert.equal(said.filter((m) => m === 'You have no pellets.').length, 1, `said once (${JSON.stringify(said)})`);
  said.length = 0;
  const wet = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE });
  for (let i = 0; i < 300; i++) await wet.frame(1 / 60, true);
  assert.ok(wet.r.playerWeapon.pistols.L.shots > 0, 'with Pellets the gun fires');
  assert.equal(said.filter((m) => m === 'You have no pellets.').length, 0, 'with Pellets nothing is said');
  midScreenText.set = wasSet;
});

test('MIXED-PAIR THE RIG, THE GUN HAND\'S CLONE RESTS: under the Weapon Widget the gun is drawn on its own frame, and its hand\'s clone stands on a still machine - never winding up a swing for a shot, never drawn - while the blade\'s clone plays its blows (mutant: the gun hand\'s clone fed the pair\'s view)', async () => {
  const { r, frame } = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, widget: { Enabled: true } });
  let gunCloneSwung = false, bladeCloneSwung = false, withGun = 0;
  for (let i = 0; i < 360; i++) {
    const q = await frame(1 / 60, i < 340);
    if (r.twoHands.offWidget.animating) gunCloneSwung = true;
    if (r.widget.animating) bladeCloneSwung = true;
    assert.ok(q.filter(isGun).length <= 1, 'one gun on the screen');
    if (q.filter(isGun).length === 1) withGun++;
  }
  // AUDIT MIXED-PAIR L5-1: and the gun IS drawn - every frame (the `<= 1` above passed with no gun at all)
  assert.equal(withGun, 360, `the gun on its own frame every frame (${withGun} of 360)`);
  assert.equal(gunCloneSwung, false, 'the gun hand\'s clone never swings');
  assert.equal(bladeCloneSwung, true, 'the blade\'s clone plays its blows');
});

test('MIXED-PAIR UNDER THE MORROWIND ARM THE SHOT IS NOT LOST: the gun\'s hit held for the arm\'s release (MW-D42) keeps the gun\'s turn - the classic machine stays the shooter\'s past the pistol\'s six frames, so the hit is handed to the host at the release, as a shot - and the blade swings only after it (mutant: the blade\'s turn blind to the held hit)', async () => {
  const saved = {};
  for (const k of Object.keys(fpArm)) if (typeof fpArm[k] === 'function') { saved[k] = fpArm[k]; fpArm[k] = () => undefined; }
  let clock = 0, at = -Infinity, released = true;
  fpArm.ready = () => true; fpArm.active = () => true; fpArm.thirdActive = () => false;
  fpArm.shotBusy = () => clock - at < 1.0;
  fpArm.attack = () => { if (clock - at < 1.0) return false; at = clock; released = false; return true; };
  fpArm.takeShootRelease = () => { if (!released && clock - at >= 0.7) { released = true; return true; } return false; };   // later than the pistol's six frames (0.5 s)
  fpArm.weaponMuzzle = () => null;
  try {
    const rig = await pistolRig({ right: createPistolet(), left: LONGSWORD(), cif: MELEE, warm: 30 });
    const pw = rig.r.playerWeapon;
    assert.equal(pw.gunHand, 'R');
    rig.r.clickAttack();
    assert.equal(pw.pistols.R.state, 'Firing', 'the lead gun takes the pull');
    const hits = [];
    let rangedAtSixFrames = null;
    for (let i = 0; i < 150; i++) {
      await rig.frame();
      clock += DT;
      if (rangedAtSixFrames === null && clock > 0.6) rangedAtSixFrames = !!pw.machine.ranged;
      if (rig.events.includes('hit')) hits.push({ t: clock, shot: isBowWeapon(pw.weapon) });
    }
    assert.equal(rangedAtSixFrames, true, 'past the pistol\'s frames, still the shooter\'s machine while its hit is held');
    assert.equal(hits.length, 1, `one hit (${JSON.stringify(hits)})`);
    assert.ok(hits[0].t >= 0.7 - 1e-9 && hits[0].t < 0.8, `handed to the host at the release (${hits[0].t.toFixed(3)} s)`);
    assert.equal(hits[0].shot, true, 'as a shot, off the gun');
    assert.equal(pw.pistols.R.shots, 1);
    // AUDIT MIXED-PAIR L1-1 / L3-1 (BLOCKER): the blade leads and the gun is the LEFT hand's - the resting weapon is the
    // blade, so a shot whose hit outlives its frames landed as the longsword's blow. It is the gun's until it lands.
    clock = 0; at = -Infinity; released = true;
    const bl = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, warm: 30 });
    const bw = bl.r.playerWeapon;
    assert.equal(bw.gunHand, 'L');
    const landed = [];
    for (let i = 0; i < 400 && bw.pistols.L.shots < 1; i++) {
      if (bw.machine.state === 'Idle' && !bw.strike) bl.r.clickAttack();
      await bl.frame(); clock += DT;
      if (bl.events.includes('hit')) landed.push({ t: clock, shot: isBowWeapon(bw.weapon), weapon: bw.weapon?.name });
    }
    for (let i = 0; i < 120; i++) { await bl.frame(); clock += DT; if (bl.events.includes('hit')) landed.push({ t: clock, shot: isBowWeapon(bw.weapon), weapon: bw.weapon?.name, off: bw.isOffHandItem(bw.weapon) }); }
    const shots = landed.filter((h) => h.shot);
    assert.equal(shots.length, 1, `the left gun's shot landed as a shot (${JSON.stringify(landed)})`);
    assert.equal(shots[0].off, true, 'the off hand\'s, read at impact off the gun it left');
    // a gun pair's off pistol held past its frames: its own item at the release, so its off share (PISTOLET's terms)
    clock = 0; at = -Infinity; released = true;
    const gp = await pistolRig({ right: createPistolet(), left: createPistolet(), warm: 30 });
    const gw = gp.r.playerWeapon;
    const offs = [];
    for (let i = 0; i < 400 && gw.pistols.L.shots < 1; i++) {
      if (gw.machine.state === 'Idle' && !gw.strike) gp.r.clickAttack();
      await gp.frame(); clock += DT;
      if (gp.events.includes('hit')) offs.push(gw.isOffHandItem(gw.weapon));
    }
    for (let i = 0; i < 120; i++) { await gp.frame(); clock += DT; if (gp.events.includes('hit')) offs.push(gw.isOffHandItem(gw.weapon)); }
    assert.deepEqual(offs, [false, true], 'the lead pistol\'s shot, then the off pistol\'s as the off hand\'s');
  } finally {
    Object.assign(fpArm, saved);
  }
});

test('MIXED-PAIR THE GUN PUT BY MID-BLOW: a blade-and-gun pair\'s gun unequipped while the blade swings leaves the blade\'s blow to land - the machine is the blade\'s, and a swap never cut a blow (applyWeapon); the gun\'s pistol put by reloads on as any (mutant: the put-by resetting the blade\'s machine)', () => {
  const sword = LONGSWORD();
  const pw = pairOf(sword, createPistolet());
  assert.ok(pw._attack('StrikeDown'), 'the lead blade swings');
  assert.equal(pw.strike.hand, 'R');
  step(pw, 3);
  assert.notEqual(pw.machine.state, 'Idle', 'mid-blow');
  pw.updateHands(sword, null); pw.applyWeapon();   // the Pistolet unequipped
  const evs = [];
  for (let i = 0; i < 120 && (pw.machine.state !== 'Idle' || pw.strike); i++) evs.push(...pw.update(DT));
  assert.ok(evs.includes('hit'), 'the blade\'s blow still lands');
  assert.equal(pw.pistols, null, 'the gun is put by');
  // and the classic Pistolet's own put-by (a lone gun swapped for a sword mid-shot) still clears the shot's mirror
  const gun = createPistolet();
  const lone = pairOf(gun, null);
  assert.ok(lone._attack('StrikeDown'));
  step(lone, 1);
  lone.updateHands(sword, null); lone.applyWeapon();
  lone.update(DT);
  assert.equal(lone.machine.state, 'Idle', 'a lone gun swapped mid-shot: no shot finished as the sword\'s blow');
});

test('MIXED-PAIR THE TOUCH BUTTON ON A DRY PAIR: with no Pellet in the pack the touch button\'s pull - attackInput\'s latch, as touch.js\'s ATTACK presses it (AUDIT MIXED-PAIR L4-10: never the probes\' clickAttack) - is the blade\'s, as the drag\'s is (gunReady), and the probes\' door does the same; never refused whole (mutant: the click door\'s Pellet guard blind to the pair)', async () => {
  const dry = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, pellets: 0 });
  for (let i = 0; i < 30; i++) await dry.frame();
  await dry.frame(DT, true); await dry.frame(DT, true);   // touch.js ATTACK: hooks.attack(dx, dy, true) - the latch
  assert.notEqual(dry.r.playerWeapon.machine.state, 'Idle', 'the blade swings');
  assert.equal(dry.r.playerWeapon.strike?.hand, 'R');
  for (let i = 0; i < 120; i++) await dry.frame();
  dry.r.clickAttack();   // the probes' door
  assert.notEqual(dry.r.playerWeapon.machine.state, 'Idle', 'the probes\' door: the blade too');
  assert.equal(dry.r.playerWeapon.pistols.L.shots, 0, 'the gun never fires dry');
});

test('MIXED-PAIR UNDER THE MORROWIND ARM THE HANDS TAKE TURNS ON THE ARM: while it still draws, winds up or looses the last strike (fpArm.shotBusy) neither hand\'s strike starts - the blade\'s no more than the gun\'s; free, the pull is taken (mutant: the blade\'s turn blind to the arm)', async () => {
  const saved = {};
  for (const k of Object.keys(fpArm)) if (typeof fpArm[k] === 'function') { saved[k] = fpArm[k]; fpArm[k] = () => undefined; }
  let busy = true;
  fpArm.ready = () => true; fpArm.active = () => true; fpArm.thirdActive = () => false;
  fpArm.shotBusy = () => busy;
  fpArm.attack = () => true;
  try {
    const rig = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, warm: 30 });
    const pw = rig.r.playerWeapon;
    assert.equal(pw.gunHand, 'L');
    rig.r.clickAttack();
    for (let i = 0; i < 5; i++) await rig.frame(DT, true);
    assert.equal(pw.machine.state, 'Idle', 'the lead blade waits for the arm');
    busy = false;
    rig.r.clickAttack();
    assert.notEqual(pw.machine.state, 'Idle', 'the arm free: the blade swings');
  } finally {
    Object.assign(fpArm, saved);
  }
});

test('MIXED-PAIR AUDIT, THE SHOT IS THE GUN\'S TO ITS END (L1-4, L1-5): a gun pair\'s lead pistol swapped for a longsword mid-shot lands nothing - never a blade\'s blow out of the pistol\'s mirror; a mixed pair\'s gun moved hand to hand mid-shot lands its one shot, as a shot; and the cooldown a Thunderlock owed is kept through a mixed pair\'s shot (AUDIT PISTOL-PORT C1) (mutants: the gun\'s strike read off its hand; the mixed mirror wiping the owed cooldown, under the blade too)', () => {
  const sword = LONGSWORD();
  const pair = pairOf(createPistolet(), createPistolet());
  assert.ok(pair._attack('StrikeDown')); step(pair, 3);
  const L = pair.handItem('L');
  pair.updateHands(sword, L); pair.applyWeapon();
  const evs = [];
  for (let i = 0; i < 120; i++) evs.push(...pair.update(DT));
  assert.equal(evs.filter((e) => e === 'hit').length, 0, 'the swapped pistol\'s shot is lost, no blade blow made of it');
  const gun = createPistolet();
  const moved = pairOf(sword, gun, { lead: 'L' });
  assert.ok(moved._attack('StrikeDown')); step(moved, 2);
  moved.updateHands(gun, sword); moved.applyWeapon();
  const hits = [];
  for (let i = 0; i < 120; i++) for (const e of moved.update(DT)) if (e === 'hit') hits.push({ weapon: moved.weapon, ranged: moved.machine.ranged });
  assert.deepEqual(hits, [{ weapon: gun, ranged: true }], 'one pull, one shot');
  // C1: a Thunderlock fired, swapped for a mixed pair whose gun fires, then back - it waits out its own cooldown
  const TL = createThunderlock(), hands = { R: TL, L: null };
  const pw = new PlayerWeapon(); pw.sheathed = false;
  const frame = (attack) => { pw.updateHands(hands.R, hands.L); pw.applyWeapon(); const ok = attack ? pw.clickAttack(() => 0.5) : null; pw.update(DT); return ok; };
  frame(true);
  const fired = pw.machine.now;
  for (let i = 0; i < 40; i++) frame(false);
  hands.R = sword; hands.L = gun; pw.usingRightHand = false;
  frame(true);
  assert.equal(pw.pistols.L.shots, 1, 'the pair\'s gun fired');
  for (let i = 0; i < 40; i++) frame(false);
  hands.R = TL; hands.L = null; pw.usingRightHand = true;
  let again = null;
  for (let i = 0; i < 300 && again == null; i++) if (frame(true)) again = pw.machine.now - fired;
  assert.ok(again >= 1.7, `the Thunderlock's cooldown kept (${again?.toFixed(3)} s after its shot)`);
  // ...and while the pair is still in the hands: the gun's shot never hands the blade beside it the owed time (the mirror's
  // own keep - the put-by's restates it)
  const pw2 = new PlayerWeapon(); pw2.sheathed = false;
  const h2 = { R: createThunderlock(), L: null }, blows = [];
  const frame2 = (attack) => { pw2.updateHands(h2.R, h2.L); pw2.applyWeapon(); if (attack) pw2.clickAttack(() => 0.5); for (const e of pw2.update(DT)) if (e === 'hit') blows.push({ t: pw2.machine.now, ranged: pw2.machine.ranged }); };
  frame2(true);
  const shot = pw2.machine.now;
  for (let i = 0; i < 40; i++) frame2(false);
  h2.R = sword; h2.L = createPistolet(); pw2.usingRightHand = false;
  for (let i = 0; i < 200; i++) frame2(true);
  const blade = blows.find((b) => !b.ranged && b.t > shot + 0.1);
  assert.ok(blows.some((b) => b.ranged && b.t > shot + 0.1), 'the pair\'s gun fired');
  assert.ok(blade && blade.t - shot > 1.7, `the blade waits out the Thunderlock's cooldown too (${blade ? (blade.t - shot).toFixed(2) : 'none'} s after its shot)`);
});

test('MIXED-PAIR AUDIT L5-4 / L5-6 / L5-8, THE GUN BESIDE THE BLADE\'S TURN: its voice is its own through the blade\'s blows - the bang, the breech open, and the close a one-handed reload on (never the Thunderlock\'s clip, never a free hand\'s pace); its frame steps through the reload with every mod off; it slides into the holster on Z; at rest the classic machine is the BLADE\'s, whatever leads; and a light carried in the hand makes no pair (mutants: the voice\'s gate the right hand\'s gun; the gun read as no pistol on the blade\'s turn; the reload voice at the free pace; the frame gate; the slide; the classic machine on the gun\'s type; the pair blind to the mode)', async () => {
  // the voice and the frame, every mod off (the Weapon Widget, Handheld Torches, Shield Widget)
  const rig = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE });
  setModSetting('handheld-torches', 'Enabled', false); setModSetting('shield-widget', 'Enabled', false);
  rig.audio.played.length = 0;
  const heard = [], gunY = new Set();
  let seen = 0;
  for (let i = 0; i < 400; i++) {
    const q = await rig.frame(DT, i < 120);
    while (seen < rig.audio.played.length) heard.push({ k: rig.audio.played[seen++], t: i * DT });
    const g = q.find(isGun);
    if (g && rig.r.playerWeapon.pistols.L.state === 'Cooling') gunY.add(Math.round(g.rect.y * 10));
  }
  const at = (k) => heard.find((h) => h.k === k)?.t ?? null;
  assert.ok(at('pistolet:fire') != null && at('pistolet:open') != null && at('pistolet:close') != null, `the gun's own voice (${heard.map((h) => h.k).join(', ')})`);
  assert.equal(heard.some((h) => h.k.startsWith('thunderlock:')), false, 'never the Thunderlock\'s');
  const loaded = PISTOLET_FEEL.reloadMs * MIXED.RELOAD / 1000;
  assert.ok(at('pistolet:close') - at('pistolet:open') > loaded - 1.2, `the close a one-handed reload on (${(at('pistolet:close') - at('pistolet:open')).toFixed(2)} s; free hand ${PISTOLET_FEEL.reloadMs / 1000} s)`);
  assert.ok(gunY.size > 3, `the gun's frame steps through its reload with every mod off (${gunY.size} heights)`);
  // Z: the gun slides into the holster - drawn on the frames the slide plays
  const z = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE });
  z.r.readyWeapon();
  let slid = 0;
  for (let i = 0; i < 40; i++) { const q = await z.frame(); if (q.some(isGun)) slid++; }
  assert.ok(slid > 5, `the gun slides out on Z (${slid} frames)`);
  // at rest the classic machine is the blade's, the gun leading or not
  const gunLed = pairOf(createPistolet(), LONGSWORD());
  step(gunLed, 3);
  assert.deepEqual([gunLed.gunHand, gunLed.machine.ranged], ['R', false], 'the gun leads: at rest, the blade\'s machine');
  // a light carried in the left hand: one hand in use, no pair
  const lit = new PlayerWeapon();
  lit.leftBusy = true;
  lit.updateHands(LONGSWORD(), createPistolet()); lit.applyWeapon();
  assert.deepEqual([lit.handsMode, lit.gunHand, lit.mixedPair], [HANDS_MODE.Single, null, false], 'a light in hand: no pair');
});

test('MIXED-PAIR AUDIT L3-6 / L5-7, THE GUN ON THE MORROWIND ARM: a left gun\'s shot leaves from the hand that fired it (the rig asks the arm\'s muzzle for the striking hand), and its reload pumps nothing over the arm (a lone gun\'s pump; the blade swings through it) (mutants: the muzzle asked for the right hand; the pump on a mixed pair)', async () => {
  const saved = {};
  for (const k of Object.keys(fpArm)) if (typeof fpArm[k] === 'function') { saved[k] = fpArm[k]; fpArm[k] = () => undefined; }
  const asked = [], poses = [];
  fpArm.ready = () => true; fpArm.active = () => true; fpArm.thirdActive = () => false;
  fpArm.shotBusy = () => false; fpArm.attack = () => true; fpArm.takeShootRelease = () => true;
  fpArm.weaponMuzzle = (hand) => { asked.push(hand); return null; };
  fpArm.setGunFeel = (pose) => { poses.push(pose); };
  try {
    const rig = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, warm: 30 });
    const pw = rig.r.playerWeapon;
    pw.usingRightHand = false;   // the gun leads: the first pull is its shot
    rig.r.clickAttack();
    assert.equal(pw.pistols.L.state, 'Firing');
    for (let i = 0; i < 3; i++) await rig.frame();
    rig.r.thunderlockMuzzle(1);
    assert.equal(asked.at(-1), 'L', 'the left gun\'s own barrel');
    poses.length = 0;
    for (let i = 0; i < 120; i++) await rig.frame();
    assert.ok(pw.pistols.L.state === 'Cooling' || pw.pistols.L.state === 'Idle');
    assert.ok(poses.length > 0 && poses.every((p) => p == null || !(p.down > 0)), `no reload pump over the arm (${JSON.stringify(poses.find((p) => p?.down > 0) ?? null)})`);
  } finally {
    Object.assign(fpArm, saved);
  }
});

test('MIXED-PAIR AUDIT L5-8 THE MACHINE WAITS OUT A HELD SHOT: the gun\'s hit held for the arm\'s release (`shotHeld`, MW-D42) is the gun\'s turn on the machine itself - its frames done and the machine Idle, a pull starts no blade until the hit lands (the rig\'s door - armCannotDraw - is a second guard, not the only one) (mutant: the machine blind to the held shot)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet(), { lead: 'L' });
  pw.sheathed = false;
  let held = false;
  pw.shotHeld = () => held;
  assert.ok(pw._attack('StrikeDown'), 'the lead gun fires');
  held = true;
  const evs = step(pw, 90);
  assert.deepEqual(evs, ['hit', 'done'], 'its frames end, its hit handed to the rig to hold');
  assert.equal(pw.machine.state, 'Idle');
  assert.equal(pw._attack('StrikeDown'), false, 'the hit still held: no blade');
  assert.equal(pw.activeHand, 'L', 'the gun\'s hand, for the host that reads `weapon` at the hit');
  held = false;
  assert.equal(pw._attack('StrikeDown'), true, 'landed: the blade');
  assert.equal(pw.strike.hand, 'R');
});

test('MIXED-PAIR AUDIT L5-8 ON A WALL (CLIMB4): the blade slides down out of the view as a lone blade does, and the gun - which has no slide to lend - is gone halfway, as a lone gun is, never hung at rest over the blade\'s slide (mutants: the pair\'s blade unlowered for the climb; the gun drawn the whole way down)', async () => {
  const rig = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE });
  let q = await rig.frame();
  const blade = (q) => q.find((x) => String(x.tex).startsWith('fpw:'));
  const y0 = blade(q).rect.y;
  rig.walk.climbing = true;
  const ys = [], guns = [];
  for (let i = 0; i < 14; i++) { q = await rig.frame(); ys.push(blade(q)?.rect.y ?? null); guns.push(q.some(isGun)); }
  assert.ok(ys.every((y, i) => y != null && y >= (i ? ys[i - 1] : y0)), `the blade slides down each frame (${ys.map((y) => Math.round(y)).join(', ')})`);
  assert.ok(ys.at(-1) - y0 > 150, 'out of the view');
  assert.ok(guns.slice(4).every((g) => !g), `the gun gone halfway (${guns.map(Number).join('')})`);
  const lone = await pistolRig({ right: createPistolet(), cif: MELEE });
  await lone.frame();
  lone.walk.climbing = true;
  const loneGuns = [];
  for (let i = 0; i < 14; i++) loneGuns.push((await lone.frame()).some(isGun));
  assert.deepEqual(guns, loneGuns, 'the pair\'s gun leaves the view as a lone gun does');
});
