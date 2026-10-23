// PISTOL-PORT (2026-10-22; bible/05-Combat/Dwarven-Pistolet.md "PISTOL-PORT"; the owner: "the integrated sprite pistol
// doesnt match the prototype 1:1 ... Haven't you learned anything from the thunderlock?", then "I want the prototype itself
// implemented just like we did with thunderlock"). FIELD-GUN12's pins, one gun along - IDENTITY, not agreement:
//   - the pistol lab's machine, pair and frame are the GAME'S objects, and the page imports them back;
//   - the page composes no frame of its own - every hand's spring, guard, picture, rig, rect and clack is a call;
//   - the GAME RUNS IT: the real rig (createWeaponRig in Node) and the page's own pair and frame, driven on one browser's
//     clock with one script - rest, a shot, a flurry fired while the first pistol is still mid-shot, both reloads, a walk
//     with a shot in it, a stop - draw every hand at the same rect, with the same picture, in the same order, one pistol
//     or a pair. Measured before the port on that script: 51 px apart at 1280x800;
//   - the pair's two machines in the game: a pull mid-shot fires the other pistol at once, its hit the off hand's;
//   - one pistol fires on the machine of the hand that holds it, drawn on the Handedness side;
//   - a Pistolet's flash drawn as painted - the sprite's tint rises to white, never the orb's colour (the Thunderlock's
//     sprite's; the light thrown on the room is the orb's for both guns - AUDIT PISTOL-PORT D3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pistolRig } from '../weapon/pistolRigHarness.js';
import * as LAB from '../../../src/tools/pistolLab.js';
import * as GUNLAB from '../../../src/tools/gunLab.js';
import * as VM from '../../../src/combat/gun/pistolViewmodel.js';
import { createPair, PAIR_TRIGGER } from '../../../src/combat/gun/pistolPair.js';
import { createGunMachine } from '../../../src/combat/gun/gunMachine.js';
import { gunMotion } from '../../../src/combat/gun/gunViewmodel.js';
import { LookFilter } from '../../../src/player/lookFilter.js';
import { PISTOLET_FEEL, RELOAD_CLOSE_LEAD, armGunPose } from '../../../src/combat/gun/gunFeel.js';
import { cutStrip } from '../../../src/combat/gun/pistoletArt.js';
import { unionBox } from '../../../src/combat/gun/gunSheet.js';
import { createPistolet } from '../../../src/systems/pistolet.js';
import { PlayerWeapon } from '../../../src/combat/playerWeapon.js';
import { OFF_HAND_BLOW } from '../../../src/combat/twoHands/handsLaw.js';
import { noteOrbColour, resetOrbColour } from '../../../src/characters/thunderlockIds.js';
import { readPng } from '../../../tools/pngIO.mjs';
import { createPistolLane } from '../../../src/combat/gun/pistolLane.js';
import { fpArm } from '../../../src/combat/fpArm.js';

const page = readFileSync(new URL('../../../pistol-proto.html', import.meta.url), 'utf8');

test('PISTOL-PORT IDENTITY: the lab\'s machine, pair and frame ARE the game\'s - the same objects, imported back (mutants: a lab copy of any)', () => {
  for (const k of ['PISTOL_HANDS', 'PISTOL_PANEL', 'createPistolHands', 'pistolHandFired', 'pistolHandsStep', 'pistolReloadVoice',
    'pistolHandRect', 'pistolDrawOrder', 'pistolWidgetSettings']) assert.equal(LAB[k], VM[k], k);
  assert.equal(LAB.createPair, createPair);
  assert.equal(LAB.PAIR_TRIGGER, PAIR_TRIGGER);
  assert.equal(LAB.createGunMachine, createGunMachine, 'the pistol lab\'s machine');
  assert.equal(GUNLAB.createGunMachine, createGunMachine, 'and the gun lab\'s - the Thunderlock\'s lab reads it back too');
});

test('PISTOL-PORT THE PAGE COMPOSES NOTHING: every hand\'s spring, guard, picture, rig, rect, order, clacks and settings is a call into the game\'s frame; none of the pieces it was built from is called on the page - the camera shake aside, which moves the room (mutants: a page that guards, rigs or places for itself)', () => {
  // AUDIT PISTOL-PORT D7: and what its panel feeds the frame is a module the pins run (pistolLab.js) - the page holds no
  // call into the frame's pieces at all
  for (const call of ['pistolPageStep(hands, pair, state, dt, {', 'pistolPageRect(hands, hd, state, art, canvas)', 'const state = pistolPageState();',
    'pistolDrawOrder(pair.order, drawn)', 'pistolHandFired(hands, h, state.kick)', 'const hands = createPistolHands();',
    'const pair = createPair({']) assert.ok(page.includes(call), call);
  for (const piece of ['pistolHandsStep(', 'pistolHandRect(', 'pistolReloadVoice(', 'pistolWidgetSettings(', 'labMotion(']) {
    assert.ok(!page.includes(piece), `the page calls ${piece} itself - wiring the pins cannot see`);
  }
  for (const own of ['guardStep(', 'guardOffset(', 'gunFrameRect(', 'widgetRigStep(', 'createRecoil(', 'createWidgetRig(', 'labWidgetSettings(', 'recoils', '.recoil.']) {
    assert.ok(!page.includes(own), `the page calls ${own} - a frame of its own again`);
  }
});

// ── the game runs it ────────────────────────────────────────────────────────────────────────────────────────────────
const W = 1280, H = 800, WARM = 60, FRAMES = 420;
/** A browser's own clock: rAF's timestamp in ms, its dt read back as the page reads it - (now - last) / 1000 - so the
 *  frame boundaries fall where a real page's do, rounding and all. */
const browserDts = (n, from = 123456.789) => {
  const out = []; let t = from;
  for (let i = 0; i < n; i++) { const was = t; t += 1000 / 60; out.push(Math.min(0.1, (t - was) / 1000)); }
  return out;
};
/** The script: frame -> what happens before it steps. A flurry pull lands 8 frames after the first - mid-shot. AUDIT
 *  PISTOL-PORT B1: then a strafe right and a jump with a shot in it, the motions the page could not make before. */
const SCRIPT = new Map([[20, 'pull'], [28, 'pull'], [150, 'walk'], [190, 'pull'], [240, 'stop'],
  [260, 'strafe'], [300, 'stop'], [306, 'turn'], [326, 'still'], [340, 'jump'], [346, 'pull']]);
/** AUDIT PISTOL-PORT D11: the head turned, a frame's yaw in the camera's radians - the look the Inertia lags behind. */
const TURN = 0.02;
// a jump: the game motor's own curve (pistolLab.js pistolJumpClimb), the eye's climb on both sides

/** THE PAGE'S FRAME, as pistol-proto.html runs it: its pair, its hands, its order of calls - on the strip's own boxes. */
function pageRun(kind, dts) {
  const strip = readPng(readFileSync(new URL('../../../public/art/pistol-frames.png', import.meta.url)));
  const { boxes } = cutStrip(strip);
  const anchor = boxes[0], union = unionBox(boxes);
  // AUDIT PISTOL-PORT D7: THE PAGE'S OWN WIRING, from the state it opens on (pistolLab.js) - never a transcription of it
  const state = LAB.pistolPageState();
  state.trigger = kind === 'single' ? PAIR_TRIGGER.Single : PAIR_TRIGGER.Alternate;
  const pair = createPair({ fps: state.fps, cooldownMs: state.cool, hitFrame: state.hit });
  pair.trigger = state.trigger; pair.lead = state.lead;
  const hands = VM.createPistolHands();
  const art = { anchor, union }, canvas = { width: W, height: H };
  let vertical = null, look = [0, 0];
  const step = (dt) => {
    pair.step(dt);
    const drawn = pair.hands();
    LAB.pistolPageStep(hands, pair, state, dt, { drawn, screen: canvas, vertical, look });
    return VM.pistolDrawOrder(pair.order, drawn).map((h) => ({ h, frame: hands[h].frame, rect: LAB.pistolPageRect(hands, h, state, art, canvas).rect }));
  };
  for (const dt of dts.slice(0, WARM)) step(dt);
  const rows = [];
  let jumpT = -1;
  for (let f = 0; f < FRAMES; f++) {
    const e = SCRIPT.get(f);
    if (e === 'pull') for (const h of pair.pull(0)) VM.pistolHandFired(hands, h, state.kick);
    if (e === 'walk') state.walk = true;
    if (e === 'strafe') state.strafe = 1;
    if (e === 'stop') { state.walk = false; state.strafe = 0; }
    if (e === 'jump') jumpT = 0;
    if (e === 'turn') look = [TURN, 0];
    if (e === 'still') look = [0, 0];
    vertical = jumpT >= 0 ? LAB.pistolJumpClimb(jumpT) : null;
    if (vertical === null) jumpT = -1; else jumpT += dts[WARM + f];
    rows.push(step(dts[WARM + f]));
  }
  return rows;
}
/** THE GAME, its real rig: the same clock, the same script through the host's own doors. */
async function gameRun(kind, dts) {
  const { r, frame, walk } = await pistolRig({ right: createPistolet(), left: kind === 'pair' ? createPistolet() : null, size: [W, H], dts: dts.slice(0, WARM) });
  const rows = [];
  let jumpT = -1, turning = false;
  const head = new LookFilter();   // the camera's look, latched for the rig's reader as the hosts' mouse look latches it
  for (let f = 0; f < FRAMES; f++) {
    const e = SCRIPT.get(f);
    if (e === 'turn') turning = true;
    if (e === 'still') turning = false;
    if (turning) head.add(TURN, 0);
    if (e === 'pull') r.clickAttack();
    if (e === 'walk') walk.on = true;
    if (e === 'strafe') walk.strafe = 1;
    if (e === 'stop') { walk.on = false; walk.strafe = 0; }
    if (e === 'jump') jumpT = 0;
    walk.vertical = jumpT >= 0 ? LAB.pistolJumpClimb(jumpT) : null;
    if (walk.vertical === null) jumpT = -1; else jumpT += dts[WARM + f];
    const q = await frame(dts[WARM + f]);
    rows.push(q.map((x) => ({ h: x.uv ? 'L' : 'R', frame: Number(String(x.tex).split(':').pop()), rect: x.rect })));
  }
  return rows;
}
for (const kind of ['pair', 'single']) {
  test(`PISTOL-PORT THE GAME RUNS IT, ${kind === 'pair' ? 'A PAIR' : 'ONE PISTOL'}: the real rig and the page's own machines and frame, on one browser's clock and one script, draw every hand at the same rect, with the same picture, in the same order - 420 frames, a strafe, a jump and a turn of the head among them (mutants: the game feeding the frame a second way - its lane's motion, look, speed, spring or pose; its rig's order, picture or holster; one machine for the pair - and the page's own wiring, its guard, its dip, its look, its Inertia. A law INSIDE the frame both sides run moves both alike: those are 'THE PAGE'S FRAME, ITS LAWS', below, and the audit's)`, async () => {
    const dts = browserDts(WARM + FRAMES);
    const want = pageRun(kind, dts), got = await gameRun(kind, dts);
    let worst = 0, at = -1;
    for (let f = 0; f < FRAMES; f++) {
      assert.deepEqual(got[f].map((x) => `${x.h}${x.frame}`), want[f].map((x) => `${x.h}${x.frame}`), `frame ${f}: the hands drawn, their pictures and their order`);
      for (let i = 0; i < want[f].length; i++) {
        for (const k of ['x', 'y', 'w', 'h']) {
          const d = Math.abs(got[f][i].rect[k] - want[f][i].rect[k]);
          if (d > worst) { worst = d; at = f; }
        }
      }
    }
    assert.ok(worst < 1e-6, `the rects agree to the float (worst ${worst} px, frame ${at})`);
    assert.ok(want.some((row) => row.length && row.some((x) => x.frame > 0)), 'the script fired');
    const xOf = (row) => row.find((x) => x.h === (kind === 'pair' ? 'R' : want[0][0].h)).rect.x;
    assert.ok(Math.abs(xOf(want[325]) - xOf(want[305])) > 1, `the turn swayed the pistol (${(xOf(want[325]) - xOf(want[305])).toFixed(1)} px)`);
  });
}

test('PISTOL-PORT THE PAIR\'S TWO MACHINES: a pull while the first pistol is still mid-shot fires the other AT ONCE - both firing, each its own frame - and the second\'s hit is the off hand\'s: its weapon, its strike, its blow (mutants: the classic one-machine pair; the hit wearing the last pull\'s hand)', () => {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = createPistolet(); pw.currentLeftHandWeapon = createPistolet(); pw.usingRightHand = true; pw.sheathed = false;
  pw.applyWeapon();
  assert.ok(pw.clickAttack(() => 0.5));
  for (let i = 0; i < 3; i++) pw.update(1 / 60);
  assert.equal(pw.pistols.R.state, 'Firing');
  assert.ok(pw.clickAttack(() => 0.5), 'the second pull is not refused mid-shot');
  assert.deepEqual([pw.pistols.R.state, pw.pistols.L.state], ['Firing', 'Firing'], 'both pistols mid-shot, as on the page');
  assert.equal(pw.weapon, pw.currentLeftHandWeapon);
  const hits = [];
  for (let i = 0; i < 40; i++) for (const ev of pw.update(1 / 60)) if (ev === 'hit') hits.push({ hand: pw.strike.hand, weapon: pw.weapon, w: pw.blowWeight });
  assert.equal(hits.length, 2, 'each pistol its own hit');
  assert.deepEqual(hits.map((x) => x.hand), ['R', 'L']);
  assert.equal(hits[0].weapon, pw.currentRightHandWeapon, 'the right\'s hit fires the right\'s pistol, though the left was pulled since');
  assert.equal(hits[1].weapon, pw.currentLeftHandWeapon);
  assert.deepEqual(hits.map((x) => x.w), [1, OFF_HAND_BLOW.blowWeight], 'the left\'s hit is the off hand\'s blow');
});

test('PISTOL-PORT ONE PISTOL fires on the machine of the hand that HOLDS it - a pistol in the left hand alone keeps the left\'s reload - and refuses a pull mid-shot, the page\'s single (mutant: always the right\'s machine)', () => {
  const pw = new PlayerWeapon();
  pw.currentLeftHandWeapon = createPistolet(); pw.usingRightHand = false; pw.sheathed = false;
  pw.applyWeapon();
  assert.ok(pw.clickAttack(() => 0.5));
  assert.equal(pw.pistols.trigger, PAIR_TRIGGER.Single);
  assert.equal(pw.pistols.lead, 'L');
  assert.equal(pw.pistols.L.state, 'Firing');
  assert.equal(pw.clickAttack(() => 0.5), null, 'one pistol, one shot at a time');
});

test('PISTOL-PORT THE FLASH AS PAINTED: on its flash frame a Pistolet\'s quad rises toward WHITE - the strip\'s own flame keeps its colours, as on the page - never the orb\'s blue, which stays the Thunderlock\'s (mutant: the orb\'s colour)', async () => {
  resetOrbColour();
  noteOrbColour({ colors: Uint8ClampedArray.from([40, 90, 230, 255]) });   // a blue orb, as the shock orb's halo samples
  try {
    const { r, frame } = await pistolRig({ right: createPistolet() });
    r.clickAttack();
    let flash = null;
    for (let i = 0; i < 12 && !flash; i++) {
      const q = await frame();
      if (q[0] && q[0].tex === 'pistolet:1') flash = q[0].tint;
    }
    assert.ok(flash, 'the flash frame drawn');
    assert.ok(flash.every((v) => Math.abs(v - flash[0]) < 1e-9), `a grey lift, no hue (${flash.map((v) => v.toFixed(2))})`);
    assert.ok(flash[0] > 0.9, 'risen to white');
  } finally {
    resetOrbColour();
  }
});

test('PISTOL-PORT THE RELOAD\'S TWO CLACKS, hand by hand - the page\'s voice in the game: each pistol opens as its own reload starts and closes RELOAD_CLOSE_LEAD before it is loaded, one of each a reload; a pair\'s second pistol its own pair of clacks, a flurry\'s worth later (mutants: no open clack; the close at the end; one voice for the pair; the clacks never re-armed; the shot silent)', async () => {
  const { r, frame, audio } = await pistolRig({ right: createPistolet(), left: createPistolet() });
  audio.played.length = 0;
  const at = { open: [], close: [] };
  let t = 0;
  let fires = 0;
  r.clickAttack();
  for (let i = 0; i < 260; i++) {
    if (i === 8) r.clickAttack();   // the flurry: the left, mid-shot of the right
    if (i === 140) r.clickAttack();   // and the right again, loaded long since: its second reload
    const was = audio.played.length;
    await frame();
    t += 1 / 60;
    for (const k of audio.played.slice(was)) {
      if (k === 'pistolet:fire') fires++;
      if (k === 'pistolet:open' || k === 'pistolet:close') at[k.split(':')[1]].push(t);
    }
  }
  assert.equal(fires, 3, 'each shot its report');
  assert.equal(at.open.length, 3, `each reload opens once (${at.open.map((x) => x.toFixed(3))})`);
  assert.equal(at.close.length, 3, `and closes once (${at.close.map((x) => x.toFixed(3))})`);
  const fire = 6 / PISTOLET_FEEL.fps, closeAfter = PISTOLET_FEEL.reloadMs / 1000 - RELOAD_CLOSE_LEAD;
  assert.ok(Math.abs(at.open[0] - fire) <= 1 / 60 + 1e-9, `the right opens as its six frames end (${at.open[0].toFixed(3)} s)`);
  assert.ok(Math.abs(at.open[1] - at.open[0] - 8 / 60) <= 1 / 60 + 1e-9, 'the left a flurry\'s worth later - its own reload');
  assert.ok(Math.abs(at.open[2] - 140 / 60 - fire) <= 1 / 60 + 1e-9, `the right's second reload clacks again (${at.open[2].toFixed(3)} s)`);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(at.close[i] - at.open[i] - closeAfter) <= 1 / 60 + 1e-9, `close ${i}: 420 ms before loaded (${(at.close[i] - at.open[i]).toFixed(3)} s after its open)`);
  }
});

test('PISTOL-PORT THE PLAYER\'S BOB SWITCH IS THEIRS - every magnitude the page\'s panel, the Offset and Bob switches the player\'s own: with Bob off, a resting pistol carried on a walk does not bob; on, it does (mutants: the switches dropped, the panel\'s Bob forced on)', async () => {
  const travel = async (widget) => {
    const { frame, walk } = await pistolRig({ right: createPistolet(), widget });
    walk.on = true;
    const ys = [];
    for (let i = 0; i < 90; i++) ys.push((await frame())[0].rect.y);
    return Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(await travel({}) > 1, 'Bob on (the default): the walk bobs it');
  assert.ok(await travel({ 'Modules.Bob': false }) < 1e-9, 'Bob off: it holds still');
});

test('PISTOL-PORT A PISTOL PUT BY RELOADS ON (AUDIT PISTOLET A3, kept): drawn again from a sword inside its reload it is still reloading, and loaded once the reload has run - a reload is never skipped by a weapon swap, nor frozen by one (mutants: fresh pistols on the swap; the pistols put by never stepped)', () => {
  const pistol = createPistolet(), sword = { name: 'Longsword', group: 'Weapons', templateIndex: 120, material: 0 };
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = pistol; pw.usingRightHand = true; pw.sheathed = false;
  pw.applyWeapon();
  assert.ok(pw.clickAttack(() => 0.5));
  for (let i = 0; i < 40; i++) pw.update(1 / 60);   // past its six frames, into the reload
  assert.equal(pw.pistols.R.state, 'Cooling');
  const swap = (item) => { pw.currentRightHandWeapon = item; pw.applyWeapon(); pw.update(1 / 60); };
  swap(sword);
  assert.equal(pw.pistols, null, 'a sword in hand');
  for (let i = 0; i < 20; i++) pw.update(1 / 60);
  swap(pistol);
  assert.equal(pw.pistols.R.state, 'Cooling', 'drawn again inside its reload: still reloading');
  assert.equal(pw.clickAttack(() => 0.5), null, 'and it will not fire');
  swap(sword);
  for (let i = 0; i < 90; i++) pw.update(1 / 60);
  swap(pistol);
  assert.equal(pw.pistols.R.state, 'Idle', 'the reload ran on while it was put by');
  assert.ok(pw.clickAttack(() => 0.5), 'loaded, it fires');
});

// ── the page's laws, held - the identity pins above cannot see a change inside the frame both sides run ──────────────
/** The page's frame on its own: its pair, its hands, a walk, at 1280x800. */
function pageFrame(trigger = PAIR_TRIGGER.Alternate) {
  const pair = createPair({ trigger, fps: PISTOLET_FEEL.fps, cooldownMs: PISTOLET_FEEL.reloadMs, hitFrame: PISTOLET_FEEL.hitFrame });
  const hands = VM.createPistolHands(), settings = VM.pistolWidgetSettings();
  const step = (spring = PISTOLET_FEEL) => {
    pair.step(1 / 60);
    VM.pistolHandsStep(hands, 1 / 60, {
      machines: pair, drawn: pair.hands(), spring, settings, screenRect: { width: W, height: H },
      motion: gunMotion({ walking: true, liveSpeed: 50 }), hiddenTarget: [0, PISTOLET_FEEL.hiddenTarget[1]],
    });
  };
  const rect = (h) => VM.pistolHandRect(hands, h, {
    canvasW: W, canvasH: H, anchor: { x: 0, y: 0, w: 120, h: 90 }, union: { x: 0, y: 0, w: 120, h: 90 },
    widthPct: 0.4, offset: 0, raise: 0, heightPx: 90,
  }).rect;
  return { pair, hands, step, rect };
}

test('PISTOL-PORT THE PAGE\'S FRAME, ITS LAWS: a pistol bobs only while loaded - firing or reloading it holds still - and dips while it reloads; the resting hand alone lowers its guard while the other fires; the hand that fired last is drawn over (mutants: Bob through the shot or the reload; no dip; the guard on the firing hand, or never; the guard not drawn; the order fixed)', () => {
  const { pair, hands, step, rect } = pageFrame();
  let bobbed = false;
  for (let i = 0; i < 60; i++) { step(); bobbed ||= hands.R.rig.position[0] !== 0; }
  assert.ok(bobbed, 'a loaded pistol, walking: it bobs');
  assert.deepEqual(pair.pull(0), ['R']);
  assert.deepEqual(VM.pistolDrawOrder(pair.order, pair.hands()), ['L', 'R'], 'the right fired last: drawn over');
  let guardL = 0, dipped = 0, n = 0;
  while (n++ < 200) {
    step();
    if (pair.R.state === 'Idle') break;
    assert.deepEqual(hands.R.rig.position, [0, 0], `frame ${n}: the right ${pair.R.state} holds still`);
    assert.equal(hands.R.guard, 0, 'the firing hand never lowers its guard');
    if (pair.R.state === 'Firing' && hands.L.guard > 0) {
      guardL = Math.max(guardL, hands.L.guard);
      const lowered = rect('L').y, g = hands.L.guard;
      hands.L.guard = 0; const raised = rect('L').y; hands.L.guard = g;
      assert.ok(lowered > raised, 'the guard is drawn: the resting pistol lower');
    }
    dipped = Math.max(dipped, hands.R.rig.offsetCurrent[1]);
  }
  assert.ok(guardL > 0, 'the resting left lowered its guard while the right fired');
  assert.ok(dipped > 0.3, `the right dipped while it reloaded (${dipped.toFixed(2)})`);
  for (let i = 0; i < 60; i++) step();
  assert.deepEqual(pair.pull(0), ['R'], 'past the flurry window the lead opens again');
  for (let i = 0; i < 3; i++) step();
  assert.deepEqual(pair.pull(0), ['L'], 'and a pull mid-shot is the left\'s');
  assert.deepEqual(VM.pistolDrawOrder(pair.order, pair.hands()), ['R', 'L'], 'the left fired last: drawn over');
  let both = 0;
  for (; both < 60; both++) {
    step();
    if (pair.R.state !== 'Firing' || pair.L.state !== 'Firing') break;
    assert.equal(hands.R.guard, 0, 'both firing: neither is the resting hand - the right never lowers');
  }
  assert.ok(both > 2, `the two mid-shot together (${both} frames)`);
});

test('PISTOL-PORT THE PAGE\'S SPRING: each hand\'s recoil takes the gun\'s own terms every frame, and a shot punches at the gun\'s kick - never the spring\'s defaults (mutants: the recoil\'s default stiffness, damping, back or kick)', () => {
  const { hands, step } = pageFrame();
  step({ stiff: 123, damp: 7, back: 0.5 });
  assert.deepEqual([hands.R.recoil.stiff, hands.R.recoil.damp, hands.R.recoil.back], [123, 7, 0.5]);
  VM.pistolHandFired(hands, 'R', 0);
  assert.equal(hands.R.recoil.y, 0, 'a kick of nought moves nothing');
  VM.pistolHandFired(hands, 'L', PISTOLET_FEEL.kick);
  assert.equal(hands.L.recoil.y, PISTOLET_FEEL.kick);
});

test('PISTOL-PORT THE GAME\'S SIDE OF A PISTOL: a pair\'s left hand drawn on the left, a left-handed player\'s pair mirrored; ONE pistol on the Handedness side whichever hand holds it (mutants: one pistol mirrored by its hand; the handedness ignored)', () => {
  const lane = createPistolLane();
  const pair = createPair({ trigger: PAIR_TRIGGER.Alternate, fps: 12, cooldownMs: 1400, hitFrame: 1 });
  assert.deepEqual(['R', 'L'].map((h) => lane.flipOf(pair, h, false)), [false, true]);
  assert.deepEqual(['R', 'L'].map((h) => lane.flipOf(pair, h, true)), [true, false], 'a left-handed player\'s pair, the mirror');
  const one = createPair({ trigger: PAIR_TRIGGER.Single, lead: 'L', fps: 12, cooldownMs: 1400, hitFrame: 1 });
  assert.equal(lane.flipOf(one, 'L', false), false, 'one pistol in the left hand, a right-handed player: drawn on the right');
  assert.equal(lane.flipOf(one, 'L', true), true, 'left-handed: on the left');
});

test('PISTOL-PORT THE CLASSIC MACHINE AS THE PISTOLS\' MIRROR: in the latest firing pistol\'s strike and frame; loaded again as soon as either pistol is; a pistol\'s reload counts its frames still to play; the strike ends when the last pistol\'s frames do (mutants: the mirror on the first firing hand; waiting for both; the frames forgotten; no end)', () => {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = createPistolet(); pw.currentLeftHandWeapon = createPistolet(); pw.usingRightHand = true; pw.sheathed = false;
  pw.applyWeapon();
  pw.update(1 / 60);
  assert.ok(pw.clickAttack(() => 0.5));
  const whole = 6 / PISTOLET_FEEL.fps + PISTOLET_FEEL.reloadMs / 1000;
  assert.ok(Math.abs(pw.handReloadUntil('R') - pw.machine.now - whole) < 1e-9, 'its six frames and its reload');
  for (let i = 0; i < 8; i++) pw.update(1 / 60);
  assert.ok(pw.clickAttack(() => 0.5));
  pw.update(1 / 60);
  assert.notEqual(pw.pistols.R.frame, pw.pistols.L.frame, 'the two mid-shot on different frames');
  assert.equal(pw.machine.frame, pw.pistols.L.frame, 'the mirror is the latest pistol\'s');
  const evs = [];
  while (pw.pistols.R.state === 'Firing' || pw.pistols.L.state === 'Firing') evs.push(...pw.update(1 / 60));
  assert.equal(evs.filter((e) => e === 'done').length, 1, 'one end, when the last pistol\'s frames end');
  assert.equal(pw.strike, null);
  assert.equal(pw.machine.state, 'Idle');
  // the right loaded first; the left still reloading - the machine is loaded with it
  for (let n = 0; n < 200 && pw.pistols.R.state !== 'Idle'; n++) pw.update(1 / 60);
  assert.equal(pw.pistols.L.state, 'Cooling');
  assert.ok(pw.machine.cooldownUntil <= pw.machine.now, 'one pistol loaded: the machine is too');
});

test('PISTOL-PORT EACH PISTOL\'S MUZZLE: a pair\'s shot leaves the barrel of the pistol that fired it - the left\'s from the left of the screen (mutants: always the right\'s; one muzzle record for both)', async () => {
  const { r, frame } = await pistolRig({ right: createPistolet(), left: createPistolet() });
  r.clickAttack();
  for (let i = 0; i < 3; i++) await frame();
  const right = r.thunderlockMuzzle(Math.PI / 3);
  r.clickAttack();
  for (let i = 0; i < 20 && r.playerWeapon.activeHand !== 'L'; i++) await frame();   // the left's hit makes its strike the one in hand
  assert.equal(r.playerWeapon.activeHand, 'L');
  const left = r.thunderlockMuzzle(Math.PI / 3);
  assert.ok(right && left, 'each pistol its own record');
  assert.ok(JSON.stringify(left) !== JSON.stringify(right), 'two barrels');
});

test('PISTOL-PORT ONE PISTOL\'S RELOAD PUMPS THE MORROWIND ARM - the share of its own reload, as the Thunderlock\'s (mutant: no pump)', async () => {
  const poses = [];
  const was = fpArm.setGunFeel;
  fpArm.setGunFeel = (p) => { poses.push(p); return was?.call(fpArm, p); };
  try {
    const { r, frame } = await pistolRig({ right: createPistolet() });
    poses.length = 0;
    r.clickAttack();
    for (let i = 0; i < 90; i++) await frame();
    assert.ok(poses.some((p) => p && p.down > 0), 'the arm drops into the reload');
    assert.ok(poses.every((p) => !p || p.down <= armGunPose(0, 0.5).down + 1e-9), 'never past the pump\'s deepest');
  } finally {
    fpArm.setGunFeel = was;
  }
});
