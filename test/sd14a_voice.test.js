// SD14a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD14a;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE BRASS REMNANT'S VOICE (scenes/sdRemnantVoice.js) -
// its body and its Echoes heard off the fight this page holds. A fight first seen is taken as it stands; its wake and
// its fall heard live alone; its turns to the Dragon Break and the Last Moment; out of time and back; stunned and up
// again; a grunt for each share of its health lost, spaced, and a heal moving the count; the gears slipping once under
// a fifth; its strides by the distance walked (a body put somewhere is no stride); its growl on a seeded beat while it
// does not strike; its Echoes risen, striding, hurt and broken at their own pitches; each blow's release before it
// lands, once, never for a blow seen past it; the ground's shock under the Stomp; a Volley's mark at my feet stinging;
// the lost fight's bell; forgotten as the Hour is left. Its voice is Daggerfall's Iron Atronach's, pitched for a
// colossus.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSdRemnantVoice, SD_VOICE_CUES, SD_IRON, SD_STRIDE_M, SD_ECHO_STRIDE_M, SD_GROWL_MS, SD_GROWL_MORE_MS, SD_HURT_GAP_MS,
  SD_RELEASE_MS, SD_TURN_LATE_MS, SD_SLIP_FRAC, SD_STING_M,
} from '../src/scenes/sdRemnantVoice.js';
import { SD_BLOW_CUES } from '../src/scenes/sdRemnantBlows.js';
import { SD_BLOWS } from '../src/net/sdRemnant.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const T0 = 1_800_000_000_000;
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');

/** A fight the test turns, a clock it moves, an engine that hears. */
function rig(over = {}) {
  let t = T0;
  const s = { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, fell: null, lost: 0, ...over };
  const heard = [];
  const audio = { play3d: (clip, at, volume, o) => heard.push({ clip, at, volume, pitch: o.pitch, reach: o.maxDistance }) };
  let feet = null;
  const v = createSdRemnantVoice({ audio, link: { state: () => s, now: () => t }, feet: () => feet });
  return { s, heard, v, step: (ms = 16) => { t += ms; v.frame(); }, at: () => t, setFeet: (f) => { feet = f; } };
}
const is = (h, c) => h.clip === c.clip && h.pitch === c.pitch;
const count = (heard, c) => heard.filter((h) => is(h, c)).length;

test('SD14a ITS VOICE IS THE IRON ATRONACH\'S, for a colossus: Daggerfall\'s own (its move, bark and attack), pitched down - the Remnant\'s under its Echoes\', gold\'s under silver\'s; every cue a clip, a pitch, a volume and a reach; with the blows\' own, the Orrery\'s, the Steps\' and the Hearts\' over sixty cues the arc speaks in (mutants: a borrowed voice; the Echoes at the Remnant\'s pitch)', () => {
  const iron = ENEMY_BASICS.find ? ENEMY_BASICS.find((e) => e.id === 36) : ENEMY_BASICS[36];
  assert.deepEqual([iron.moveSound, iron.barkSound, iron.attackSound], [SD_IRON.move, SD_IRON.bark, SD_IRON.attack]);
  const C = SD_VOICE_CUES;
  const flat = Object.values(C).flatMap((c) => (Array.isArray(c) ? c : c.clip !== undefined ? [c] : Object.values(c)));
  assert.equal(flat.length, 32);
  assert.ok(flat.every((c) => Number.isInteger(c.clip) && c.pitch > 0 && c.pitch < 3 && c.volume > 0 && c.reach > 0));
  assert.ok(C.step.pitch < C.echoStep[0].pitch && C.echoStep[0].pitch < C.echoStep[1].pitch, 'the Remnant under gold under silver');
  assert.ok(C.hurt.pitch < C.echoHurt[0].pitch && C.echoHurt[0].pitch < C.echoHurt[1].pitch);
  assert.ok(C.echoRise[0].pitch < C.echoRise[1].pitch && C.echoFall[0].pitch < C.echoFall[1].pitch);
  assert.ok(C.last.pitch < C.wake.pitch && C.fallCry.pitch < C.last.pitch, 'deeper as it turns, deepest as it falls');
  assert.deepEqual(Object.keys(C.release).sort(), Object.keys(SD_BLOWS).sort(), 'a release for every blow');
  const blows = Object.keys(SD_BLOW_CUES.windup).length + Object.keys(SD_BLOW_CUES.land).length + 2;
  assert.ok(flat.length + blows + 4 + 4 + 4 + 2 >= 60, 'the voice, the blows, the Orrery\'s, the Steps\', the Hearts\', the Rift\'s bell and the way home\'s toll');
});

test('SD14a A FIGHT FIRST SEEN IS TAKEN AS IT STANDS, and its turns heard as they happen: the wake (its bark and the Hour\'s bell) heard live alone, the Dragon Break (the chime, low) and the Last Moment (its deepest bark, the roll), out of time and back (the gears), stunned (its bark, the ring) and up again, the fall\'s cry heard live alone, the lost fight\'s bell; after its end nothing more (mutants: a late join sounding every turn; the wake heard late; no turn; no stun; the fall heard late)', () => {
  // a late join: the fight in its third phase, stunned - nothing at once
  const late = rig({ ph: 3, su: T0 + 5000 });
  late.v.frame();
  late.step();
  assert.deepEqual(late.heard, [], 'taken as it stands');
  // the wake, live
  const r = rig({ op: T0 + 500 });
  r.v.frame();
  r.step(600);
  assert.equal(count(r.heard, SD_VOICE_CUES.wake), 1); assert.equal(count(r.heard, SD_VOICE_CUES.wakeToll), 1);
  const wakeAt = r.heard.find((h) => is(h, SD_VOICE_CUES.wakeToll)).at;
  assert.deepEqual(wakeAt, realmToDungeon(SD_ARENA.x, 4, SD_ARENA.z), 'the bell over the arena');
  // a wake seen too late
  const w2 = rig({ op: T0 + 100 });
  w2.v.frame(); w2.step(100 + SD_TURN_LATE_MS + 50);
  assert.equal(count(w2.heard, SD_VOICE_CUES.wake), 0, 'never late');
  // the turns
  r.s.ph = 2; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.outside), 1);
  r.s.ph = 3; r.s.ou = r.at() + 2500; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.last), 1); assert.equal(count(r.heard, SD_VOICE_CUES.lastRoll), 1);
  assert.equal(count(r.heard, SD_VOICE_CUES.back), 1, 'back from outside time');
  r.step(3000);
  assert.equal(count(r.heard, SD_VOICE_CUES.back), 1, 'once');
  r.s.su = r.at() + 2000; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.stunned), 1); assert.equal(count(r.heard, SD_VOICE_CUES.stunRing), 1);
  r.step(2100);
  assert.equal(count(r.heard, SD_VOICE_CUES.recover), 1, 'up again');
  // the fall, live; then nothing
  r.s.fell = { at: r.at() + 10, top: ['A'], n: 1 }; r.step(20);
  assert.equal(count(r.heard, SD_VOICE_CUES.fallCry), 1);
  const n = r.heard.length;
  r.s.ph = 1; r.s.su = r.at() + 9000; r.step(); r.step(5000);
  assert.equal(r.heard.length, n, 'after its end: nothing');
  // a fall heard late: no cry
  const f2 = rig(); f2.v.frame(); f2.s.fell = { at: f2.at() - SD_TURN_LATE_MS - 1, top: [], n: 1 }; f2.step();
  assert.equal(count(f2.heard, SD_VOICE_CUES.fallCry), 0);
  // a lost fight: the bell, lowest
  const l = rig(); l.v.frame(); l.s.lost = l.at(); l.step();
  assert.equal(count(l.heard, SD_VOICE_CUES.lost), 1);
  assert.ok(SD_VOICE_CUES.lost.pitch < SD_VOICE_CUES.wakeToll.pitch);
});

test('SD14a HURT, AND THE GEARS SLIPPING: a grunt for each share of its health lost, never closer than SD_HURT_GAP_MS; a heal (a fighter\'s share joined) moving the count; the gears slipping once as it falls under a fifth, never again (mutants: a grunt each blow; never a grunt; the slip every frame)', () => {
  const r = rig();
  r.v.frame();
  r.s.h = 990; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 1, '1% lost: a grunt');
  r.s.h = 980; r.step(100);
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 1, 'too soon');
  r.step(SD_HURT_GAP_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 2, 'and after the gap');
  r.s.h = 979; r.step(SD_HURT_GAP_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 2, 'a scratch: nothing');
  r.s.m = 2000; r.s.h = 1980; r.step(SD_HURT_GAP_MS);   // a fighter's share joined: the fraction rose
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 2, 'a heal: no grunt');
  r.s.h = 1970; r.step(SD_HURT_GAP_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 3, 'counted from where it stands now - half a share under the heal');
  r.s.h = 0.19 * 2000; r.step(SD_HURT_GAP_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.slip), 1); assert.equal(count(r.heard, SD_VOICE_CUES.slipBark), 1);
  r.s.h = 0.1 * 2000; r.step(SD_HURT_GAP_MS); r.step(SD_HURT_GAP_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.slip), 1, 'once');
  assert.ok(SD_SLIP_FRAC === 0.2);
});

test('SD14a ITS STRIDES AND ITS GROWL: a step heard for each SD_STRIDE_M it walks, where it stands (a body put somewhere far is no stride; none outside time); a growl while it does not strike, SD_GROWL_MS and a seeded part more apart, none while it strikes (mutants: a step every frame; steps outside time; the growl while striking; the growl every frame)', () => {
  const r = rig();
  r.s.rem = { x: 0, z: -6, yw: 0, mv: { x: 0, z: -6, tx: 0, tz: 6, v: 4, at: T0 }, atk: null };
  r.v.frame();
  for (let i = 0; i < 200; i++) r.step(20);   // 4 s at 4 m/s, held at 12 m
  assert.equal(count(r.heard, SD_VOICE_CUES.step), Math.floor(12 / SD_STRIDE_M), `${count(r.heard, SD_VOICE_CUES.step)} strides in 12 m`);
  const last = r.heard.filter((h) => is(h, SD_VOICE_CUES.step)).at(-1);
  assert.ok(Math.abs(last.at[2] - realmToDungeon(0, 0, SD_ARENA.z + 6)[2]) < SD_STRIDE_M + 0.1, 'where it stands');
  // put somewhere else: no stride
  const n = count(r.heard, SD_VOICE_CUES.step);
  r.s.rem = { x: 0, z: -15, yw: 0, mv: null, atk: null }; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.step), n);
  // outside time: no strides
  r.s.ph = 2; r.s.rem = { x: 0, z: -15, yw: 0, mv: { x: 0, z: -15, tx: 0, tz: 5, v: 4, at: r.at() }, atk: null };
  for (let i = 0; i < 100; i++) r.step(20);
  assert.equal(count(r.heard, SD_VOICE_CUES.step), n, 'outside time it does not walk the floor');
  // the growl: idle, awake
  const g = rig();
  g.v.frame();
  for (let i = 0; i < 400; i++) g.step(100);   // 40 s
  const growls = g.heard.filter((h) => is(h, SD_VOICE_CUES.growl)).length;
  assert.ok(growls >= Math.floor(40_000 / (SD_GROWL_MS + SD_GROWL_MORE_MS)) && growls <= Math.ceil(40_000 / SD_GROWL_MS), `${growls} growls in 40 s`);
  // a growl due as a blow begins: held for the blow
  const d = rig();
  d.v.frame();
  d.step(SD_GROWL_MS - 20);
  assert.equal(count(d.heard, SD_VOICE_CUES.growl), 0);
  d.s.rem.atk = { i: 50, a: SD_BLOWS.hand.id, at: d.at() + 1600, x: 0, z: 0, yw: 0, tg: [] };
  d.step(40);
  assert.equal(count(d.heard, SD_VOICE_CUES.growl), 0, 'due, but it strikes');
  // striking: none
  const k = rig();
  k.v.frame();
  for (let i = 0; i < 300; i++) { k.s.rem.atk = { i: 100 + Math.floor(i / 20), a: SD_BLOWS.stomp.id, at: k.at() + 1000, x: 0, z: 0, yw: 0, tg: [] }; k.step(100); }
  assert.equal(count(k.heard, SD_VOICE_CUES.growl), 0, 'never while it strikes');
});

test('SD14a ITS ECHOES: each risen (the chime), striding, hurt and broken (the shatter) at its own pitch - gold under silver; the second one\'s own (mutants: the Echoes silent; both at gold\'s pitch)', () => {
  const r = rig({ ph: 2, ec: [{ h: 0, m: 100, x: -6, z: 0, mv: null, atk: null }, { h: 0, m: 100, x: 6, z: 0, mv: null, atk: null }] });
  r.v.frame();
  r.s.ec[0].h = 100; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.echoRise[0]), 1); assert.equal(count(r.heard, SD_VOICE_CUES.echoRise[1]), 0);
  r.s.ec[1].h = 100; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.echoRise[1]), 1);
  r.s.ec[1].h = 90; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.echoHurt[1]), 1, 'silver hurt');
  r.s.ec[0].mv = { x: -6, z: 0, tx: -6, tz: 10, v: 4, at: r.at() };
  for (let i = 0; i < 160; i++) r.step(20);   // 12.8 m at 4 m/s, held at 10
  assert.equal(count(r.heard, SD_VOICE_CUES.echoStep[0]), Math.floor(10 / SD_ECHO_STRIDE_M));
  assert.equal(count(r.heard, SD_VOICE_CUES.echoStep[1]), 0, 'silver stood still');
  r.s.ec[0].h = 0; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.echoFall[0]), 1, 'gold broken');
  assert.equal(count(r.heard, SD_VOICE_CUES.echoFall[1]), 0);
  r.s.ec[1].h = 0; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.echoFall[1]), 1, 'silver broken, at its own pitch');
  const at = r.heard.find((h) => is(h, SD_VOICE_CUES.echoFall[0])).at;
  assert.ok(Math.abs(at[0] - realmToDungeon(SD_ARENA.x - 6, 0, 0)[0]) < 0.01, 'where it stood');
});

test('SD14a EACH BLOW\'S RELEASE, THE GROUND\'S SHOCK, AND A VOLLEY AIMED AT ME: SD_RELEASE_MS before it lands, once, never for a blow first seen past it; the Stomp\'s landing shaking the ground under the Remnant; a Volley\'s mark within SD_STING_M of my feet stinging at its word, at my feet - one far off, nothing (mutants: no release; a release every frame; a late blow released; no quake; the sting for every Volley)', () => {
  const r = rig();
  r.v.frame();
  r.s.rem.atk = { i: 7, a: SD_BLOWS.stomp.id, at: r.at() + 1000, x: 0, z: 0, yw: 0, tg: [] };
  r.step(16);
  assert.equal(count(r.heard, SD_VOICE_CUES.release.stomp), 0, 'not yet');
  r.step(1000 - SD_RELEASE_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.release.stomp), 1, 'its release');
  r.step(100); r.step(100);
  assert.equal(count(r.heard, SD_VOICE_CUES.release.stomp), 1, 'once');
  r.step(200);
  assert.equal(count(r.heard, SD_VOICE_CUES.quake), 1, 'the ground\'s shock');
  // a blow first seen past its release: nothing
  r.s.rem.atk = { i: 8, a: SD_BLOWS.hand.id, at: r.at() + 100, x: 0, z: 0, yw: 0, tg: [] };
  r.step(16); r.step(200);
  assert.equal(count(r.heard, SD_VOICE_CUES.release.hand), 0);
  // the Hour's own blow: its release over the arena
  r.s.clk = { i: 9, a: SD_BLOWS.pulse.id, at: r.at() + 1000, x: 0, z: 0, yw: 0, tg: [] };
  r.step(16); r.step(1000 - SD_RELEASE_MS);
  const p = r.heard.find((h) => is(h, SD_VOICE_CUES.release.pulse));
  assert.deepEqual(p?.at, realmToDungeon(SD_ARENA.x, 4, SD_ARENA.z));
  // a Volley: a mark at my feet
  const v = rig();
  v.setFeet(realmToDungeon(SD_ARENA.x + 3, 0, SD_ARENA.z - 4));
  v.v.frame();
  v.s.rem.atk = { i: 3, a: SD_BLOWS.volley.id, at: v.at() + 2000, x: 0, z: 0, yw: 0, tg: [[10, 10], [3 + SD_STING_M * 0.7, -4]] };
  v.step(); v.step();
  const sting = v.heard.filter((h) => is(h, SD_VOICE_CUES.sting));
  assert.equal(sting.length, 1, 'aimed at me: once');
  assert.ok(Math.abs(sting[0].at[0] - realmToDungeon(SD_ARENA.x + 3, 0, 0)[0]) < 0.01, 'at my feet');
  v.s.rem.atk = { i: 4, a: SD_BLOWS.volley.id, at: v.at() + 2000, x: 0, z: 0, yw: 0, tg: [[10, 10], [-8, 2]] };
  v.step();
  assert.equal(count(v.heard, SD_VOICE_CUES.sting), 1, 'its marks far off: nothing');
});

test('SD14a FORGOTTEN AS THE HOUR IS LEFT, and the world host\'s: made beside the fight\'s link, framed with its blows in the Hour, let go with the link out of it (mutants: never framed; never let go)', () => {
  const r = rig({ op: T0 + 200 });
  r.v.frame();
  r.v.leave();
  r.step(300);
  assert.equal(count(r.heard, SD_VOICE_CUES.wake), 0, 'left: the next fight seen is taken as it stands');
  assert.match(W, /const sdRemVoice = sdFightLink \? createSdRemnantVoice\(\{ audio, link: sdFightLink, feet: \(\) => \(playerSpawned && modes\?\.sdRealmSlot\?\.\(\) != null \? player\.feetAt\(\) : null\) \}\) : null;/);
  assert.match(W, /if \(inRealm\) \{ try \{ sdRemVoice\?\.frame\(\); \} catch \(e\) \{ console\.warn\('\[sd\] voice', e\?\.message \?\? e\); \} \}/);
  assert.match(W, /if \(!inRealm && _sdFightHeld\) \{ sdFightLink\.leave\(\); sdBlows\?\.leave\(\); sdRemVoice\?\.leave\(\); sdFx\?\.leave\(\); _sdFightHeld = false; \}/);   // SD16 (PIN MOVED): its sparks forgotten with it
});
