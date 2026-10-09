// SD16 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD16;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE BLOWS SEEN (scenes/sdFx.js) - the Hour's landings,
// turns and fall as bursts of sparks on the gate's own spark pass, the camera shaken by how near they fell, the floor
// lit. More kinds than the Warden's court throws and more shakes than his landings give; a fight first seen taken as it
// stands; each landing once, where the law puts it (the Stomp's ring's dust where its front rolls); the Hour's own blows
// shaking the whole arena, a broken Reset none; its Echoes and Hearts risen and broken (the last Heart's break and the
// stun in one word seen); the slip once; its fall a burst, a flash, a column and the way home's light where the way home
// rises; the bursts as the spark pass takes them, sixteen at most; forgotten as the Hour is left; wired in the world.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSdFx, SD_FX_KINDS, SD_FX_COLOR, SD_SHAKE, sdShake, SD_FX_LATE_MS, SD_FX_LAND_LATE_MS, SD_FX_COLUMN, SD_FX_FLASH_MS, SD_RING_DUST, SD_HAND_FLASH_OUT, SD_FX_FLOOR_Y,
} from '../src/scenes/sdFx.js';
import { SD_BLOWS, SD_BODY, SD_REM, SD_ECHO, stompFrontAt, handAngleAt } from '../src/net/sdRemnant.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { FX_KINDS, FX_BURST_MS, FX_BURSTS_MAX, FX_LIGHT_MS } from '../src/render/gateFx.js';
import { LAND_SHAKE } from '../src/world/gateBoss.js';
import { SD_REM_SINK_MS } from '../src/scenes/sdRemnant.js';
import { clearOfPillars } from '../src/scenes/sdSpoils.js';
import { SD_SLIP_FRAC } from '../src/scenes/sdRemnantVoice.js';

const T0 = 1_800_000_000_000;
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const at = (x, y, z) => realmToDungeon(SD_ARENA.x + x, y, SD_ARENA.z + z);
const near = (a, b, e = 1e-6) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= e);
/** The shakes felt, to the realm's round trip's rounding. */
const felt = (r, want) => assert.ok(near(r.shakes, want), `${r.shakes} for ${want}`);

/** A fight the test turns, a clock it moves, a camera that shakes; my feet in the arena's frame (null: out of it). */
function rig(over = {}) {
  let t = T0, feet = null;
  const s = { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ...over };
  const shakes = [];
  const fx = createSdFx({ link: { state: () => s, now: () => t }, feet: () => (feet ? at(feet[0], 0, feet[1]) : null), shake: (k) => shakes.push(k) });
  return { s, fx, shakes, step: (ms = 16) => { t += ms; fx.frame(); }, at: () => t, setFeet: (f) => { feet = f; } };
}
const kinds = (r) => r.fx.bursts(r.at()).map((b) => Object.keys(SD_FX_KINDS).find((k) => SD_FX_KINDS[k] === b.kind));
const blow = (A, i, landAt, more = {}) => ({ k: 'atk', b: SD_BODY.remnant, i, a: A.id, at: landAt, x: 0, z: 0, yw: 0, tg: [], ...more });

test('SD16 THE HOUR THROWS MORE THAN THE GATE: 17 kinds of burst to his court\'s 12, 9 shakes to his landings\' 7 - each kind a share, a power and the brass\'s grit or not, a light where it throws one; each shake fading with distance or the whole arena\'s', () => {
  assert.equal(Object.keys(SD_FX_KINDS).length, 17);
  assert.equal(Object.keys(FX_KINDS).length, 12, 'the gate\'s');
  assert.ok(Object.keys(SD_FX_KINDS).length > Object.keys(FX_KINDS).length);
  assert.equal(Object.keys(SD_SHAKE).length, 9);
  assert.ok(Object.keys(SD_SHAKE).length > Object.keys(LAND_SHAKE).length);
  for (const K of Object.values(SD_FX_KINDS)) {
    assert.ok(K.share > 0 && K.share <= 1 && K.power > 0 && typeof K.grit === 'boolean');
    if (K.light) assert.ok(K.light[0] > 0 && K.light[1] > 0);
  }
  assert.equal(Object.values(SD_FX_KINDS).filter((K) => K.light).length, 11);
  assert.ok(Object.values(SD_FX_COLOR).every((c) => c.length === 3 && c.every((v) => v >= 0 && v <= 1)));
  assert.equal(sdShake('stomp', 0), SD_SHAKE.stomp[0]);
  assert.equal(sdShake('stomp', SD_SHAKE.stomp[1] / 2), SD_SHAKE.stomp[0] / 2);
  assert.equal(sdShake('stomp', SD_SHAKE.stomp[1] + 1), 0);
  assert.equal(sdShake('end', 999), SD_SHAKE.end[0], 'the whole arena');
  assert.equal(sdShake('hand', 0), 0, 'the Hand\'s sweep shakes nothing - its sound does');
  assert.ok(SD_SHAKE.end[0] > SD_SHAKE.reset[0] && SD_SHAKE.reset[0] > SD_SHAKE.pulse[0], 'the End over the Reset over the Pulse');
});

test('SD16 A FIGHT FIRST SEEN IS TAKEN AS IT STANDS; a landing seen once, where the law puts it - the Stomp at its feet and its ring\'s dust where its front rolls, shaking me by how near; lit, the light fading over the gate\'s span', () => {
  const late = rig();
  late.s.rem.atk = blow(SD_BLOWS.stomp, 7, T0 - 100, { x: 3, z: 4 });
  late.setFeet([3, 4]);
  late.fx.frame(); late.step();
  assert.deepEqual(kinds(late), [], 'landed before I came');
  assert.deepEqual(late.shakes, []);
  const r = rig();
  r.fx.frame();
  r.setFeet([3 + 3.5, 4]);
  r.s.rem.atk = blow(SD_BLOWS.stomp, 8, T0 + 200, { x: 3, z: 4 });
  r.step(100);
  assert.deepEqual(kinds(r), [], 'still winding up');
  r.step(120);
  assert.deepEqual(kinds(r), ['stomp']);
  const b = r.fx.bursts(r.at())[0];
  assert.ok(near(b.at, at(3, 0.1, 4)));
  assert.ok(Math.abs(b.t - 0.02) < 1e-9, 'seconds since it landed');
  felt(r, [SD_SHAKE.stomp[0] * (1 - 3.5 / SD_SHAKE.stomp[1])]);
  r.step(SD_RING_DUST.after);
  const dust = r.fx.bursts(r.at()).filter((q) => q.kind === SD_FX_KINDS.ring);
  assert.equal(dust.length, SD_RING_DUST.n);
  const front = stompFrontAt(r.s.rem.atk, T0 + 200 + SD_RING_DUST.after);
  assert.ok(dust.every((q) => { const p = [q.at[0] - at(3, 0, 4)[0], q.at[2] - at(3, 0, 4)[2]]; return Math.abs(Math.hypot(...p) - front) < 1e-6; }), 'on its front');
  r.step(16);
  assert.equal(r.shakes.length, 1, 'once');
  // lit: the flash where it fell, fading
  const L = r.fx.lights(T0 + 200 + 100);
  const stompLight = L.find((l) => Math.abs(l.x - at(3, 0, 4)[0]) < 1e-6 && Math.abs(l.z - at(3, 0, 4)[2]) < 1e-6);
  assert.ok(stompLight && stompLight.range === SD_FX_KINDS.stomp.light[1]);
  assert.ok(Math.abs(stompLight.color[0] - SD_FX_COLOR.brass[0] * SD_FX_KINDS.stomp.light[0] * (1 - 100 / FX_LIGHT_MS)) < 1e-9);
  assert.equal(r.fx.lights(T0 + 200 + FX_LIGHT_MS + 1).filter((l) => l.range === SD_FX_KINDS.stomp.light[1]).length, 0, 'out');
  // far off: no shake
  const far = rig(); far.fx.frame(); far.setFeet([0, SD_SHAKE.stomp[1] + 1]);
  far.s.rem.atk = blow(SD_BLOWS.stomp, 9, T0 + 10); far.step(20);
  assert.deepEqual(far.shakes, []);
  // out of the Hour (no feet): seen, not felt
  const out = rig(); out.fx.frame();
  out.s.rem.atk = blow(SD_BLOWS.stomp, 9, T0 + 10); out.step(20);
  assert.deepEqual(kinds(out), ['stomp']); assert.deepEqual(out.shakes, []);
  // a landing come upon too late (a tab woken): none
  const slow = rig(); slow.fx.frame();
  slow.s.rem.atk = blow(SD_BLOWS.stomp, 9, T0 + 10); slow.step(10 + SD_FX_LAND_LATE_MS + 5);
  assert.deepEqual(kinds(slow), []);
});

test('SD16 THE HAND\'S LIGHT OUT OF ITS CHEST, the Volley\'s gears where each lands (the nearest shaking me), an Echo\'s blows in its own colour; the Hour\'s own blows over the arena\'s heart shaking it all - a Reset broken by the Hearts none', () => {
  const r = rig(); r.fx.frame(); r.setFeet([10, 0]);
  r.s.rem = { x: 2, z: -3, yw: 0, mv: null, atk: blow(SD_BLOWS.hand, 1, T0 + 10, { x: 2, z: -3 }) };
  r.step(20);
  let b = r.fx.bursts(r.at());
  // AUDIT SD III (V3, PIN MOVED): out of its chest along the beam's first bearing, past its body - never in its heart crystal
  const g = handAngleAt(r.s.rem.atk, r.s.rem.atk.at), out = SD_REM.r + SD_HAND_FLASH_OUT;
  assert.equal(b.length, 1); assert.ok(near(b[0].at, at(2 + Math.sin(g) * out, SD_REM.h * 0.55, -3 + Math.cos(g) * out))); assert.equal(b[0].color, SD_FX_COLOR.gold);
  assert.deepEqual(r.shakes, []);
  // an Echo's Volley: silver, at each mark; the nearest to my feet shakes me
  const tg = [[-5, -5], [10, 1], [0, 12]];
  r.s.ec = [{ h: 0, m: 100, x: 0, z: 0, mv: null, atk: null }, { h: 100, m: 100, x: 0, z: 0, mv: null, atk: { ...blow(SD_BLOWS.volley, 2, r.at() + 10), b: SD_BODY.silver, tg } }];
  r.step(5);   // the Echoes first seen: one rose
  r.step(10);
  b = r.fx.bursts(r.at()).filter((q) => q.kind === SD_FX_KINDS.volley);
  assert.equal(b.length, 3);
  assert.ok(b.every((q) => q.color === SD_FX_COLOR.silver));
  assert.ok(tg.every(([x, z]) => b.some((q) => near(q.at, at(x, 0.1, z)))));
  felt(r, [SD_SHAKE.volley[0] * (1 - 1 / SD_SHAKE.volley[1])]);   // the nearest mark, a metre off
  // the Pulse and the End: the arena's heart, everyone shaken wherever they stand
  const c = rig(); c.fx.frame(); c.setFeet([20, 0]);
  c.s.clk = { ...blow(SD_BLOWS.pulse, 3, T0 + 10), b: SD_BODY.hour }; c.step(20);
  assert.deepEqual(kinds(c), ['pulse']); assert.ok(near(c.fx.bursts(c.at())[0].at, at(0, 2, 0))); assert.equal(c.fx.bursts(c.at())[0].color, SD_FX_COLOR.mantella);
  assert.deepEqual(c.shakes, [SD_SHAKE.pulse[0]]);
  c.s.clk = { ...blow(SD_BLOWS.end, 4, c.at() + 10), b: SD_BODY.hour }; c.step(20);
  assert.equal(c.fx.bursts(c.at()).at(-1).color, SD_FX_COLOR.end);
  assert.deepEqual(c.shakes, [SD_SHAKE.pulse[0], SD_SHAKE.end[0]]);
  // the Reset: landed, white-green; broken (stunned past it): nothing
  const z = rig({ ph: 3 }); z.fx.frame(); z.setFeet([5, 5]);
  z.s.rem.atk = blow(SD_BLOWS.reset, 5, T0 + 10); z.step(20);
  assert.deepEqual(kinds(z), ['reset']); assert.deepEqual(z.shakes, [SD_SHAKE.reset[0]]);
  const n = rig({ ph: 3 }); n.fx.frame(); n.setFeet([5, 5]);
  n.s.rem.atk = blow(SD_BLOWS.reset, 5, T0 + 10); n.s.su = T0 + 9000; n.step(20);
  assert.ok(!kinds(n).includes('reset')); assert.ok(!n.shakes.includes(SD_SHAKE.reset[0]));
});

test('SD16 ITS TURNS SEEN: its wake (live alone), the stun, the slip once under a fifth; its Echoes risen and broken in gold or silver; its Hearts risen and each broken - the last one\'s break in the stun\'s word seen', () => {
  const r = rig({ op: T0 + 300 }); r.fx.frame(); r.setFeet([1, 0]);
  r.step(400);
  assert.deepEqual(kinds(r), ['wake']); assert.deepEqual(r.shakes, [SD_SHAKE.wake[0]]);
  const w = rig({ op: T0 + 100 }); w.fx.frame(); w.setFeet([1, 0]); w.step(100 + SD_FX_LATE_MS + 10);
  assert.deepEqual(kinds(w), [], 'a wake come upon late');
  assert.deepEqual(w.shakes, [], 'and not felt');
  // the Echoes
  const e = rig({ ph: 2 }); e.fx.frame(); e.setFeet([4, 0]);
  e.s.ec = [{ h: 100, m: 100, x: 4, z: 0, mv: null, atk: null }, { h: 100, m: 100, x: -4, z: 0, mv: null, atk: null }];
  e.step();
  const risen = e.fx.bursts(e.at());
  assert.deepEqual(risen.map((q) => q.color), [SD_FX_COLOR.gold, SD_FX_COLOR.silver]);
  assert.ok(near(risen[0].at, at(4, SD_ECHO.h * 0.5, 0)));
  e.s.ec = [{ ...e.s.ec[0], h: 0 }, e.s.ec[1]]; e.step();
  assert.equal(kinds(e).filter((k) => k === 'echoFall').length, 1);
  felt(e, [SD_SHAKE.echoFall[0]]);   // at my feet
  e.s.ec = [{ ...e.s.ec[0], h: 100 }, e.s.ec[1]]; e.step();
  assert.equal(kinds(e).filter((k) => k === 'echoRise').length, 3, 'risen again, unpaired');
  // the Hearts: risen, one broken, then the last with the stun in one word
  const h = rig({ ph: 3 }); h.fx.frame(); h.setFeet([0, 0]);
  h.s.cx = { i: 40, m: 50, c: [[6, 0, 50], [-6, 0, 50], [0, 6, 50]] }; h.step();
  assert.deepEqual(kinds(h), ['heartRise', 'heartRise', 'heartRise']);
  h.s.cx = { ...h.s.cx, c: [[6, 0, 0], [-6, 0, 20], [0, 6, 50]] }; h.step();
  assert.equal(kinds(h).filter((k) => k === 'heartBreak').length, 1);
  h.s.cx = null; h.s.su = h.at() + 8000; h.step();
  const broke = h.fx.bursts(h.at()).filter((q) => q.kind === SD_FX_KINDS.heartBreak);
  assert.equal(broke.length, 3, 'the last two in the stun\'s word');
  assert.ok(near(broke[2].at, at(0, 1.2, 6)));
  assert.equal(kinds(h).filter((k) => k === 'stun').length, 1);
  assert.ok(h.shakes.some((k) => Math.abs(k - SD_SHAKE.stun[0]) < 1e-6), 'stunned at my feet');
  // the Reset landed instead: the Hearts gone unbroken
  const g = rig({ ph: 3 }); g.fx.frame();
  g.s.cx = { i: 41, m: 50, c: [[6, 0, 50]] }; g.step();
  g.s.cx = null; g.step();
  assert.equal(kinds(g).filter((k) => k === 'heartBreak').length, 1, 'spent by its landing: a burst as it goes');   // AUDIT SD III (V10, PIN MOVED): it went from the air with nothing to show for it
  // the slip, once
  const sl = rig(); sl.fx.frame();
  sl.s.h = sl.s.m * SD_SLIP_FRAC - 1; sl.step(); sl.step();
  assert.deepEqual(kinds(sl), ['slip']);
  const sl2 = rig({ h: 10 }); sl2.fx.frame(); sl2.step();
  assert.deepEqual(kinds(sl2), [], 'come upon slipped');
});

test('SD16 ITS FALL: a burst out of its chest, the arena flashed white-gold and shaken; a column of brass as its body sinks; the way home\'s pale light where the way home rises, as it rises; nothing more of the fight; forgotten as the Hour is left', () => {
  const r = rig(); r.fx.frame(); r.setFeet([20, 0]);   // AUDIT SD III (V4, PIN MOVED): in the arena - the whole arena's shakes are its own
  r.s.rem = { x: 11.3, z: 11.3, yw: 0, mv: null, atk: null };   // against a pillar (SD_PILLAR_R on the diagonal)
  r.s.fell = { at: r.at() + 5, top: [], n: 1 };
  r.step(10);
  assert.deepEqual(kinds(r), ['fall']);
  assert.ok(near(r.fx.bursts(r.at())[0].at, at(11.3, SD_REM.h * 0.5, 11.3)));
  assert.deepEqual(r.shakes, [SD_SHAKE.fall[0]]);
  const fl = r.fx.lights(r.at()).find((l) => l.range === 40);
  assert.ok(fl && Math.abs(fl.color[0] - 4 * (1 - 5 / SD_FX_FLASH_MS)) < 1e-9);
  assert.equal(r.fx.lights(T0 + 5 + SD_FX_FLASH_MS + 1).filter((l) => l.range === 40).length, 0);
  r.step(SD_FX_COLUMN.at);
  assert.equal(kinds(r).filter((k) => k === 'column').length, 1);
  r.step(SD_FX_COLUMN.step * SD_FX_COLUMN.n);
  const column = r.fx.bursts(r.at()).filter((q) => q.kind === SD_FX_KINDS.column);
  assert.equal(column.length, SD_FX_COLUMN.n);
  assert.deepEqual(column.map((q) => q.at0 - (T0 + 5)), [0, 1, 2].map((k) => SD_FX_COLUMN.at + k * SD_FX_COLUMN.step), 'on the beat, a frame late or not');
  r.s.rem.atk = blow(SD_BLOWS.stomp, 50, r.at() + 1); r.step(5);
  assert.ok(!kinds(r).includes('stomp'), 'nothing more of the fight');
  r.step(T0 + 5 + SD_REM_SINK_MS + 10 - r.at());
  const home = r.fx.bursts(r.at()).find((q) => q.kind === SD_FX_KINDS.home);
  const [hx, hz] = clearOfPillars(11.3, 11.3);
  assert.ok(home && near(home.at, at(hx, 0.1, hz)) && home.at0 === T0 + 5 + SD_REM_SINK_MS, 'where the way home rises, as it rises');
  assert.notDeepEqual([hx, hz], [11.3, 11.3], 'clear of the pillar it fell by');
  // a fall come upon late: nothing of it
  const late = rig(); late.fx.frame();
  late.s.fell = { at: T0 - SD_FX_LATE_MS - 10, top: [], n: 1 }; late.step();
  assert.deepEqual(kinds(late), []);
  // left
  r.fx.leave();
  assert.deepEqual(r.fx.bursts(r.at()), []); assert.deepEqual(r.fx.lights(r.at()), []);
});

test('SD16 THE BURSTS AS THE SPARK PASS TAKES THEM: sixteen at most, the oldest given up for the newest, each spent after the gate\'s span - and wired in the world: framed in the fight\'s frame, left with it, its sparks in the Hour\'s world pass, its flashes in the Hour\'s light', () => {
  const r = rig(); r.fx.frame();
  r.s.ec = [{ h: 100, m: 100, x: 0, z: 0, mv: null, atk: null }, { h: 100, m: 100, x: 0, z: 0, mv: null, atk: null }]; r.step();
  for (let i = 0; i < 4; i++) { r.s.rem.atk = blow(SD_BLOWS.volley, 60 + i, r.at() + 1, { tg: [[i, 0], [i, 2], [i, 4], [i, 6], [i, 8]] }); r.step(2); }
  const b = r.fx.bursts(r.at());
  assert.equal(b.length, FX_BURSTS_MAX);
  assert.ok(!b.some((q) => q.kind === SD_FX_KINDS.echoRise), 'the oldest given up');
  r.step(FX_BURST_MS);
  assert.deepEqual(r.fx.bursts(r.at()), [], 'spent');
  // the draw: nothing to draw, no pass made
  assert.equal(r.fx.draw(null, null, null, [0, 0, 0], r.at()), false);
  // the world
  assert.match(W, /import \{ createSdFx \} from '\.\/sdFx\.js';/);
  assert.match(W, /const sdFx = sdFightLink \? createSdFx\(\{\n\s+link: sdFightLink,\n\s+feet: \(\) => \(playerSpawned && modes\?\.sdRealmSlot\?\.\(\) != null \? player\.feetAt\(\) : null\),\n\s+shake: \(k\) => betterAmbience\.weaponKick\(k\),/);
  assert.match(W, /if \(inRealm\) \{ try \{ sdFx\?\.frame\(\); \} catch/);
  assert.match(W, /sdRemVoice\?\.leave\(\); sdFx\?\.leave\(\); _sdFightHeld = false;/);
  assert.match(W, /const sparks = !!\(sdFx && sdFightLink && sdFx\.draw\(renderer\.gl, proj, view, eye, sdFightLink\.now\(\), fog, renderer\.worldViewportPx\?\.\[3\]\)\); const beams = [^\n]*; const beam = [^\n]*; const reads = drawSdArenaReads\(proj, view, fog\); if \(blows \|\| lines \|\| motes \|\| sparks \|\| beam \|\| reads\) renderer\.markForeignPass\(\);/);   // SD17 (PIN MOVED): the Hour-Hand's beam after the sparks   // SD-LOOK S7/S8 (PIN MOVED): the arena's reads in the same pass, the sky told the fight, the hearts' lights first
  assert.match(W, /fx = sdFx && sdFightLink \? sdFx\.lights\(sdFightLink\.now\(\)\) : NO_SD_LIGHTS;\n[^\n]*\n[^\n]*\n\s+if \(!fx\.length && !stone && !hearts\.length\) return lit;[\s\S]*?for \(let i = 0; i < fx\.length; i\+\+\) _sdHourLights\.push\(fx\[i\]\);/);   // SD18b (PIN MOVED): and the Ending's stone   // AUDIT SD III (V5, PIN MOVED): into one kept list   // SD-LOOK S7/S8 (PIN MOVED): the arena's reads in the same pass, the sky told the fight, the hearts' lights first
});
