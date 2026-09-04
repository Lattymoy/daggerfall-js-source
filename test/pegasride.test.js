// PH1 - THE RIDING SCRIPT as a law module: every pin below is one arm
// of hr_horse_script (Madmax, 2004) with the script's own number, at
// the recorded frame rate (PEGAS_SCRIPT_HZ 30) and unit (69.99 to the
// metre). bible/13-Pegas/Pegas-Arc.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPegasRide, mountGate, mintSaddle, hasSaddle, takeSaddle, giveSaddle, isSaddle, regenStanding, quantiseDeg,
  riderHeightForRace, gravityScaleForSlowFall, unitsToMetres, perFrameToPerSecond,
  PEGAS_SCRIPT_HZ, TROT_UNITS_PER_FRAME, ENDURANCE_DRAIN_GALLOP, ENDURANCE_REGEN_RIDING, ENDURANCE_REGEN_DISMOUNTED,
  SNEAK_HOLD_SECONDS, SPECIAL_MOVE_SECONDS, SPECIAL_MOVE_BACK, SPECIAL_MOVE_UP, JUMP_SECONDS, JUMP_RISE_SECONDS,
  JUMP_RISE_PER_FRAME, JUMP_FORWARD_SPEED_DROP, JUMP_RIDER_UP, JUMP_ENDURANCE_COST, SLOPE_TROT_LIMIT, SLOPE_GALLOP_DROP,
  FRONTBACK_POSITION, MOUNT_LIFT, WATER_BELOW, MSG, PEGAS_SOUND, CLIP, SLOW_FALL_RIDING, SLOW_FALL_JUMP, LEVITATE_JUMP,
  SADDLE_TEMPLATE, PEGAS_ITEM_GROUP,
} from '../src/systems/pegasRide.js';
import { MW_UNITS_PER_METER } from '../src/formats/mwFirstPerson.js';
import { itemWeight } from '../src/systems/inventory.js';
import { itemLine } from '../src/ui/enhancedInventory.js';

const FRAME = 1 / PEGAS_SCRIPT_HZ;
const horse = (o = {}) => ({ speed: 20, endurance: 55, stamina: 55, ...o });
const base = { dt: FRAME, run: false, sneak: false, activate: false, firstPerson: true, riderFatigue: 100, yawDeg: 0 };
function saddled(h = horse()) { const r = createPegasRide(); r.mount({ race: 'Nord', horse: h }); return r; }
/** hold the RUN key one frame and release it: the script's toggle fires on the release */
function tapRun(r) { r.tick({ ...base, run: true }); return r.tick({ ...base, run: false }); }
function tapSneak(r) { r.tick({ ...base, sneak: true }); return r.tick({ ...base, sneak: false }); }

test('PH1: the conversions - a trot of 10 units a frame is a real trot at 30 Hz, and a metre is 69.99 units', () => {
  assert.equal(PEGAS_SCRIPT_HZ, 30);
  assert.equal(TROT_UNITS_PER_FRAME, 10);
  const trotMs = unitsToMetres(perFrameToPerSecond(TROT_UNITS_PER_FRAME));
  assert.ok(Math.abs(trotMs - 4.286) < 0.01, `trot ${trotMs.toFixed(3)} m/s`);
  assert.ok(Math.abs(unitsToMetres(MW_UNITS_PER_METER) - 1) < 1e-9);
  // OpenMW's fall law: SlowFall 300 is no fall, 50 is three quarters, Levitate is none
  assert.equal(gravityScaleForSlowFall(SLOW_FALL_RIDING), 0);
  assert.equal(gravityScaleForSlowFall(SLOW_FALL_JUMP), 0.75);
  assert.equal(gravityScaleForSlowFall(LEVITATE_JUMP), 0);
  assert.equal(quantiseDeg(47, 10), 50); assert.equal(quantiseDeg(-44, 10), -40); assert.equal(quantiseDeg(3.4, 1), 3);
});

test('PH1: the saddle - hr_ridinggear as an item, one taken to mount, one given back to dismount', () => {
  const s = mintSaddle();
  assert.equal(s.group, PEGAS_ITEM_GROUP); assert.equal(s.templateIndex, SADDLE_TEMPLATE);
  assert.equal(s.name, 'Horse Saddle'); assert.equal(s.weight, 5); assert.equal(s.value, 1000);
  assert.equal(itemWeight(s), 5, 'the pack weighs it at the MISC record\'s 5 - a template-less item carries its own weight, as DFU\'s weightInKg does');
  const line = itemLine(s);
  assert.equal(line.name, 'Horse Saddle'); assert.equal(line.weight, 5); assert.equal(line.image, null, 'no Daggerfall image for it');
  const items = [{ group: 'Weapons', templateIndex: 0 }];
  assert.equal(hasSaddle(items), false);
  assert.equal(takeSaddle(items), false, 'nothing to take');
  giveSaddle(items);
  assert.equal(hasSaddle(items), true);
  giveSaddle(items);
  assert.equal(items.filter(isSaddle).length, 1, 'stacks');
  assert.equal(items.find(isSaddle).stackCount, 2);
  assert.equal(takeSaddle(items), true); assert.equal(items.find(isSaddle).stackCount, 1);
  assert.equal(takeSaddle(items), true); assert.equal(hasSaddle(items), false, 'the last one leaves the pack');
});

test('PH1: the mount gates, in the script\'s order - menu, dead, water, two horses, no saddle, else mount', () => {
  assert.deepEqual(mountGate({ sneaking: true }), { menu: true });
  assert.deepEqual(mountGate({ horseDead: true }), { inventory: true });
  assert.deepEqual(mountGate({ horseUnderwater: true }), { follow: true, message: MSG.lostInWater });
  assert.deepEqual(mountGate({ ridingAnother: true }), { message: MSG.twoHorses });
  assert.deepEqual(mountGate({ items: [] }), { message: MSG.noSaddle });
  assert.equal(mountGate({ items: [mintSaddle()] }), null);
  // the rider's seat by race (hr_wear_ridinggear), the mod's else arm for the rest
  assert.equal(riderHeightForRace('WoodElf'), 75); assert.equal(riderHeightForRace('Argonian'), 60);
  assert.equal(riderHeightForRace('Nord'), 65); assert.equal(riderHeightForRace('Breton'), 67); assert.equal(riderHeightForRace('nope'), 68);
  const r = createPegasRide();
  const m = r.mount({ race: 'WoodElf', horse: horse() });
  assert.deepEqual(m.play, [PEGAS_SOUND.idle2]);
  assert.ok(Math.abs(m.riderUp - unitsToMetres(75 + MOUNT_LIFT)) < 1e-9, ':311 the rider set pheight + 80 up');
  assert.equal(m.fallDamage, false, 'hr_ridingspell (Slow Fall 300 on the RIDER): no fall damage in the saddle - the horse itself falls under its own physics');
  assert.equal(r.riding, true); assert.equal(r.pheight, 75);
});

test('PH1: RUN press-and-release toggles the horse moving; a trot is 10 a frame along the rider\'s facing', () => {
  const r = saddled();
  let o = r.tick({ ...base });
  assert.equal(o.moving, false); assert.equal(o.clip, CLIP.idle); assert.equal(o.loop, null);
  o = r.tick({ ...base, run: true });
  assert.equal(o.moving, false, 'the PRESS does nothing (pressed2 arms)');
  o = r.tick({ ...base, run: false });
  assert.equal(o.moving, true, 'the RELEASE toggles');
  assert.equal(o.gait, 'trot'); assert.equal(o.clip, CLIP.trot); assert.equal(o.loop, 'trot');
  assert.equal(o.forwardUnitsPerFrame, TROT_UNITS_PER_FRAME);
  assert.ok(Math.abs(o.speed - 4.286) < 0.01);
  assert.ok(Math.abs(o.riderForward - unitsToMetres(FRONTBACK_POSITION)) < 1e-9, 'the rider sits 20 units forward');
  o = tapRun(r);
  assert.equal(o.moving, false, 'and toggles back');
});

test('PH1: SNEAK release toggles TROT/GALLOP only while running, with the messagebox; a gallop is horsespeed a frame', () => {
  const r = saddled(horse({ speed: 25 }));
  let o = tapSneak(r);
  assert.deepEqual(o.messages, [], 'standing: no toggle');
  tapRun(r);
  o = tapSneak(r);
  assert.deepEqual(o.messages, [MSG.gallop]);
  o = r.tick({ ...base });
  assert.equal(o.gait, 'gallop'); assert.equal(o.clip, CLIP.gallop); assert.equal(o.loop, 'gallop');
  assert.equal(o.forwardUnitsPerFrame, 25);
  assert.ok(Math.abs(o.speed - unitsToMetres(25 * 30)) < 1e-9);
  o = tapSneak(r);
  assert.deepEqual(o.messages, [MSG.trot]);
  assert.equal(r.tick({ ...base }).gait, 'trot');
});

test('PH1: the tired law - 0.03 endurance a frame at a gallop, at zero "The horse is getting tired" and a trot; 0.02 back a frame standing', () => {
  const h = horse({ speed: 20, endurance: 1, stamina: 1 });
  const r = saddled(h);
  tapRun(r); tapSneak(r);   // gallop
  let frames = 0, o;
  do { o = r.tick({ ...base }); frames++; } while (o.gait === 'gallop' && frames < 100);
  assert.equal(o.gait, 'stand', 'the tired frame answers no movement');
  assert.deepEqual(o.messages, [MSG.tired]);
  assert.ok(frames >= 33 && frames <= 35, `1 / 0.03 = 33.3 frames of gallop (${frames})`);
  assert.equal(h.stamina, 0);
  assert.equal(r.gallop, false, 'dropped to trot');
  assert.equal(r.tick({ ...base }).gait, 'trot', 'still running, now trotting');
  // standing in the saddle regenerates 0.02 a frame - the tap's release
  // frame already stands (the toggle fires before the movement arm)
  tapRun(r);
  assert.ok(Math.abs(h.stamina - ENDURANCE_REGEN_RIDING) < 1e-9, `one standing frame: ${h.stamina}`);
  r.tick({ ...base });
  assert.ok(Math.abs(h.stamina - 2 * ENDURANCE_REGEN_RIDING) < 1e-9);
  // and a horse nobody rides, 0.05 a frame (:315)
  const free = horse({ endurance: 10, stamina: 0 });
  regenStanding(free, FRAME);
  assert.ok(Math.abs(free.stamina - ENDURANCE_REGEN_DISMOUNTED) < 1e-9);
  regenStanding(free, 100);
  assert.equal(free.stamina, 10, 'never past the max');
  assert.equal(ENDURANCE_DRAIN_GALLOP, 0.03);
});

test('PH1: SNEAK held a second at a trot is the SPECIAL MOVE - 1.5 s with the rider 55 behind and 25 up, then idle', () => {
  const r = saddled();
  tapRun(r);
  let o;
  for (let t = 0; t < SNEAK_HOLD_SECONDS + FRAME; t += FRAME) o = r.tick({ ...base, sneak: true });
  assert.equal(r.running, false, 'the move stops the horse');
  assert.ok(o.play.some((p) => p && p.clipOnce === CLIP.special), 'idle7 plays once');
  o = r.tick({ ...base, sneak: true });
  assert.equal(o.gait, 'special'); assert.equal(o.clip, CLIP.special);
  assert.ok(Math.abs(o.riderForward + unitsToMetres(SPECIAL_MOVE_BACK)) < 1e-9, 'the rear');
  assert.ok(Math.abs(o.riderUp - unitsToMetres(65 + SPECIAL_MOVE_UP)) < 1e-9);
  for (let t = 0; t < SPECIAL_MOVE_SECONDS; t += FRAME) o = r.tick({ ...base, sneak: true });
  assert.equal(o.clip, CLIP.idle, 'after 1.5 s the horse idles, the rider seated');
  assert.ok(Math.abs(o.riderForward - unitsToMetres(FRONTBACK_POSITION)) < 1e-9);
  r.tick({ ...base, sneak: false });
  assert.equal(r._state.pressed, 0, 'released: the machine is free again');
});

test('PH1: SNEAK held a second at a gallop is the JUMP - half a second rising 10 a frame with no gravity, then Slow Fall 50 to 1.8 s, forward at speed - 5, one endurance', () => {
  const h = horse({ speed: 30, endurance: 50, stamina: 50 });
  const r = saddled(h);
  tapRun(r); tapSneak(r);
  let o;
  for (let t = 0; t < SNEAK_HOLD_SECONDS + FRAME; t += FRAME) o = r.tick({ ...base, sneak: true });
  // the frame the hold trips still galloped (the movement arm runs
  // before the SNEAK arm, :623 before :707); the jump's first frame is
  // the next one (:809-817)
  assert.equal(o.gait, 'gallop');
  const before = h.stamina;
  o = r.tick({ ...base });
  assert.equal(o.gait, 'jump'); assert.equal(o.gravityScale, 0, 'Levitate');
  assert.ok(Math.abs(o.verticalVelocity - unitsToMetres(perFrameToPerSecond(JUMP_RISE_PER_FRAME))) < 1e-9);
  assert.ok(Math.abs(o.jumpStart - unitsToMetres(30)) < 1e-9, ':812 30 up on the first frame');
  assert.equal(o.forwardUnitsPerFrame, 30 - JUMP_FORWARD_SPEED_DROP);
  assert.ok(Math.abs(o.riderUp - unitsToMetres(65 + JUMP_RIDER_UP)) < 1e-9);
  // the rise: 14 more frames (timer2 to 0.467) with no gravity
  for (let i = 0; i < 14; i++) o = r.tick({ ...base });
  assert.equal(o.gravityScale, 0, 'still rising under 0.5 s');
  assert.equal(o.gait, 'jump');
  // frames 15-16: past 0.5 s - Slow Fall 50
  o = r.tick({ ...base }); o = r.tick({ ...base });
  assert.equal(o.gravityScale, 0.75, 'then Slow Fall 50');
  assert.equal(o.verticalVelocity, null);
  assert.equal(o.gait, 'jump');
  assert.equal(o.forwardUnitsPerFrame, 30 - JUMP_FORWARD_SPEED_DROP, 'forward at speed - 5 through the whole jump');
  // to 1.8 s: 54 frames from the pressed-5 start; a few past it and the jump is over
  for (let i = 0; i < 40; i++) o = r.tick({ ...base });
  assert.notEqual(o.gait, 'jump', 'over past 1.8 s');
  // one endurance for the jump itself; the few gallop frames after the
  // landing drain their 0.03 each, nothing drains in the air
  const spent = before - h.stamina;
  assert.ok(spent >= JUMP_ENDURANCE_COST - 1e-9 && spent <= JUMP_ENDURANCE_COST + 5 * ENDURANCE_DRAIN_GALLOP + 1e-9,
    `one endurance for the jump (+ a few landing frames): ${spent.toFixed(3)}`);
  assert.equal(o.gravityScale, 1, 'ridingspell3 gone: the horse falls under its own physics again');
  assert.equal(o.fallDamage, false, 'and the rider still takes none');
  assert.equal(o.gait, 'gallop', 'lands back into the gallop it left');
  assert.equal(JUMP_SECONDS, 1.8); assert.equal(JUMP_RISE_SECONDS, 0.5);
});

test('PH1: SNEAK + ACTIVATE - free view in first person; the height menu in third person while standing; neither dismounts', () => {
  const r = saddled();
  let o = r.tick({ ...base, sneak: true });
  o = r.tick({ ...base, sneak: true, activate: true });
  assert.deepEqual(o.messages, [MSG.freeViewOn]); assert.equal(r.freeView, true); assert.equal(o.dismount, null);
  r.tick({ ...base, sneak: false });
  r.tick({ ...base, sneak: true }); o = r.tick({ ...base, sneak: true, activate: true });
  assert.deepEqual(o.messages, [MSG.freeViewOff]);
  r.tick({ ...base, sneak: false });
  // third person, standing: the height menu; higher/lower move pheight by one
  o = r.tick({ ...base, firstPerson: false, sneak: true });
  o = r.tick({ ...base, firstPerson: false, sneak: true, activate: true });
  assert.equal(o.heightMenu, true); assert.equal(r.freeView, false, 'third person cancels free view');
  assert.equal(r.heightButton(0), 66); assert.equal(r.heightButton(0), 66, 'the menu answers once');
  r.tick({ ...base, firstPerson: false, sneak: false });
  r.tick({ ...base, firstPerson: false, sneak: true }); r.tick({ ...base, firstPerson: false, sneak: true, activate: true });
  assert.equal(r.heightButton(1), 65);
});

test('PH1: the slope watch - three frames over 8 units (trot) or horsespeed - 5 (gallop) stops the horse with its message', () => {
  const r = saddled(horse({ speed: 20 }));
  tapRun(r);
  let y = 0, o;
  const climb = unitsToMetres(SLOPE_TROT_LIMIT + 1);
  o = r.tick({ ...base, horseY: y });
  for (let i = 0; i < 3; i++) { y += climb; o = r.tick({ ...base, horseY: y }); }
  assert.deepEqual(o.messages, [MSG.tooSteepUp]); assert.equal(r.running, false);
  tapRun(r);
  const drop = unitsToMetres(20 - SLOPE_GALLOP_DROP + 1);
  tapSneak(r);   // gallop: the limit is speed - 5 = 15
  o = r.tick({ ...base, horseY: y });
  for (let i = 0; i < 3; i++) { y -= drop; o = r.tick({ ...base, horseY: y }); }
  assert.deepEqual(o.messages, [MSG.tooSteepDown]); assert.equal(r.running, false);
  // a gentle rise never trips it
  tapRun(r);
  r.tick({ ...base, horseY: y });
  for (let i = 0; i < 10; i++) { y += unitsToMetres(3); o = r.tick({ ...base, horseY: y }); }
  assert.deepEqual(o.messages, []); assert.equal(r.running, true);
});

test('PH1: the four dismount doors - ACTIVATE (not sneaking), the rider\'s fatigue at zero, seventy units under water, the horse\'s death', () => {
  let r = saddled();
  let o = r.tick({ ...base, activate: true });
  assert.equal(o.dismount, 'activate');
  assert.equal(r.tick({ ...base, sneak: true, activate: true }).dismount, null, 'sneaking: not a dismount');
  const d = r.dismount('activate');
  assert.deepEqual(d.messages, [MSG.dismount]); assert.deepEqual(d.play, [PEGAS_SOUND.idle2]); assert.equal(d.loop, null); assert.equal(r.riding, false);
  r = saddled();
  assert.equal(r.tick({ ...base, riderFatigue: 0 }).dismount, 'fatigue');
  r = saddled();
  tapRun(r);
  o = r.tick({ ...base, horseY: -unitsToMetres(WATER_BELOW + 1), waterY: 0 });
  assert.equal(o.dismount, 'water');
  assert.deepEqual(r.dismount('water').messages, [MSG.underwater]);
  r = saddled();
  assert.equal(r.tick({ ...base, horseDead: true }).dismount, 'dead');
});

test('PH1: the horse faces the rider in tens of degrees every tenth of a second, and holds under free view', () => {
  const r = saddled();
  r.tick({ ...base, yawDeg: 0 });
  let o;
  for (let t = 0; t <= 0.11; t += FRAME) o = r.tick({ ...base, yawDeg: 47 });
  assert.equal(o.faceDeg, 50);
  r.tick({ ...base, sneak: true }); r.tick({ ...base, sneak: true, activate: true });   // free view on
  for (let t = 0; t <= 0.3; t += FRAME) o = r.tick({ ...base, sneak: false, yawDeg: 120 });
  assert.equal(o.faceDeg, 50, 'free view: the horse keeps its facing');
});
