// SD9c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE TURNING HOUR - the
// Brass Remnant's aura, "a slow wheel of brass gears and gold light about the wearer", one kill in eight on its first
// write (server-account/src/sds.js, SD9b), held off the row (`sd_honours`) and worn as every aura is; drawn by the aura
// pass's seventh look (render/auraRing.js): a brass wheel at the feet stepping on the second, its spokes and hub, the
// Hour's dial outside it turning back, gold light at the feet; the wheel's edge on the strip and the light rising off it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { AURAS, mintToken, verifyToken } from '../src/net/identityToken.js';
import { AURA_TEXT, AURA_PAINT, TITLE_RGBA, badgeCss, cssRgba } from '../src/ui/playerBadge.js';
import { aurasHeld, auraWorn, auraRefusal, wardrobeOf } from '../server-account/src/titles.js';
import { SD_HONOUR_TITLE, SD_HONOUR_AURA } from '../server-account/src/sds.js';
import { readAura } from '../src/net/wire.js';
import {
  AURA_LOOK, auraLookOf, AURA_GROUND_R, AURA_LIFT_M, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS,
  TURNING_R, TURNING_RIM_M, TURNING_TEETH, TURNING_TOOTH_M, TURNING_SPOKES, TURNING_SPOKE_M, TURNING_HUB_R, TURNING_DIAL_R,
  TURNING_MARKS, TURNING_MARK_M, TURNING_H, TURNING_EDGE_M, TURNING_HZ, TURNING_STEP_S, TURNING_RGB, turningRatesWhole,
  turningWheelAngle, turningDialAngle,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';
import { lookAt, perspective, mirrorProjectionX, multiply } from '../src/world/mat4.js';

const { subtle } = webcrypto;
const TAU = Math.PI * 2;
const AFTER = 1_900_000_000;
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });

// ── the vocabulary and the grant ──────────────────────────────────────

test('SD9c THE TURNING HOUR, held and worn: AURAS gains it last; its word and its paint the Hourbreaker\'s; held off the row\'s second grant - a registered account\'s alone, never off the title\'s bit; worn through the aura\'s door and signed into the token; the wire keeps it (mutants: held off any bit; held by a guest; another title\'s paint)', async () => {
  assert.equal(AURAS.at(-1), 'turninghour', 'the vocabulary\'s newest');
  assert.equal(AURA_TEXT.turninghour, 'The Turning Hour');
  assert.equal(AURA_PAINT.turninghour, 'hourbreaker', 'in the Hourbreaker\'s paint');
  assert.ok(badgeCss().includes(`.card button.acttitle.actaura.aura-turninghour { color: ${cssRgba(TITLE_RGBA.hourbreaker)}; }`), 'its button in the Hourbreaker\'s gold');
  const none = row('Ann', { sd_honours: 0 }), title = row('Ann', { sd_honours: SD_HONOUR_TITLE }), aura = row('Ann', { sd_honours: SD_HONOUR_AURA }), both = row('Ann', { sd_honours: SD_HONOUR_TITLE | SD_HONOUR_AURA });
  assert.deepEqual([aurasHeld(none, {}), aurasHeld(title, {}), aurasHeld(aura, {}), aurasHeld(both, {})], [[], [], ['turninghour'], ['turninghour']], 'the second grant, never the title\'s');
  assert.deepEqual(aurasHeld({ ...aura, handle: null, registered_at: null }, {}), [], 'a guest row holds none');
  assert.equal(auraRefusal('turninghour', aura, {}), null, 'held: may be worn');
  assert.equal(auraRefusal('turninghour', title, {}), 'not-held');
  assert.equal(auraWorn({ ...aura, aura: 'turninghour' }, {}), 'turninghour');
  assert.equal(auraWorn({ ...title, aura: 'turninghour' }, {}), undefined, 'a stored choice not held is not worn');
  const w = wardrobeOf({ ...both, title: 'hourbreaker', aura: 'turninghour' }, {}, AFTER);
  assert.deepEqual([w.titles.includes('hourbreaker'), w.title, w.auras, w.aura], [true, 'hourbreaker', ['turninghour'], 'turninghour'], 'the account card\'s answer');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-ann', n: 'Ann', k: 'linked', t: 'hourbreaker', au: 'turninghour' }, kp.privateKey, { subtle, nowS: AFTER });
  const got = await verifyToken(tok, kp.publicKey, { subtle, nowS: AFTER + 1 });
  assert.equal(got.ok, true);
  assert.deepEqual([got.claims.t, got.claims.au], ['hourbreaker', 'turninghour'], 'signed into the token');
  assert.equal(readAura({ au: 'turninghour' }), 'turninghour', 'the wire keeps it');
});

// ── the look's law ─────────────────────────────────────────────────────

test('SD9c THE LOOK\'S LAW: the seventh kind, added whole (no shade, no mesh, no symbols), its strip at the teeth\'s tips to its height; the wheel a whole number of teeth and spokes round, the dial the Hour\'s twelve; every rate whole over the clock; the wheel steps on the second - a quarter-second\'s ease, then held - never back, two turns over the clock; the dial turns back, one; its colours the Hourbreaker\'s (mutants: the wheel smooth; the dial forward; a rate off the clock)', () => {
  const L = AURA_LOOK.turninghour;
  assert.deepEqual([L.kind, L.ringR, L.flameH, L.glyphs, !!L.shade, L.mesh ?? null], [6, TURNING_R + TURNING_TOOTH_M, TURNING_H, 0, false, null]);
  assert.equal(auraLookOf('turninghour'), L);
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `${a} has a look`);
  assert.ok(Number.isInteger(TURNING_TEETH) && Number.isInteger(TURNING_SPOKES) && TURNING_MARKS === 12);
  assert.ok(TURNING_HUB_R < TURNING_R - TURNING_RIM_M && TURNING_R + TURNING_TOOTH_M < TURNING_DIAL_R - 2 * TURNING_MARK_M && TURNING_DIAL_R < AURA_GROUND_R - 0.2, 'the hub, the wheel, the dial, the quad\'s edge, apart');
  assert.ok(turningRatesWhole(), 'every rate whole over the clock');
  assert.deepEqual([TURNING_HZ.wheel * AURA_CLOCK_PERIOD, TURNING_HZ.dial * AURA_CLOCK_PERIOD], [2, 1]);
  // the wheel: held through most of each second, stepping in its first quarter, never back
  for (const s of [0, 7, 59, 119]) {
    assert.equal(turningWheelAngle(s + TURNING_STEP_S), turningWheelAngle(s + 0.9), `held after its step (${s})`);
    assert.ok(turningWheelAngle(s + 0.1) > turningWheelAngle(s) && turningWheelAngle(s + 0.1) < turningWheelAngle(s + TURNING_STEP_S), 'stepping in its first quarter');
    assert.ok(Math.abs(turningWheelAngle(s + 1) - turningWheelAngle(s) - TAU * TURNING_HZ.wheel) < 1e-12, 'a step a second');
  }
  let last = -Infinity;
  for (let t = 0; t <= AURA_CLOCK_PERIOD; t += 0.05) { const a = turningWheelAngle(t); assert.ok(a >= last - 1e-12, `never back (${t})`); last = a; }
  assert.ok(Math.abs(turningWheelAngle(AURA_CLOCK_PERIOD) - 2 * TAU) < 1e-9, 'two turns over the clock: whole at the wrap');
  // AUDIT SD II (L2 F13 - PIN MOVED): BACK AS THE EYE SEES IT, never the math sign. Through the game's own camera
  // (world/mat4.js lookAt and its one mirror) a mark on the ground's dial - at (cos a, sin a) of (x, z) about the feet -
  // turns ANTICLOCKWISE on the screen, as the Hour's sky's hands do (render/sdSky.js: sin(back), cos(back) of (azimuth,
  // elevation), back falling); this pin read turningDialAngle < 0, and the dial turned clockwise - forward - on the screen
  const vp = multiply(mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.05, 500)), lookAt([0, 1.7, -1.2], [0, 0, 0], [0, 1, 0]));
  const onScreen = (p) => { const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]; return [(vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w]; };
  const feet = onScreen([0, 0, 0]);
  const screenAngle = (a) => { const s = onScreen([Math.cos(a) * TURNING_DIAL_R, 0, Math.sin(a) * TURNING_DIAL_R]); return Math.atan2(s[1] - feet[1], s[0] - feet[0]); };
  let turned = 0;
  for (let t = 0; t < 30; t += 1) { const d = screenAngle(turningDialAngle(t + 1)) - screenAngle(turningDialAngle(t)); turned += Math.atan2(Math.sin(d), Math.cos(d)); }
  assert.ok(turned > 0.5, `the dial turns back - anticlockwise on the screen (${turned.toFixed(3)} rad in 30 s)`);
  assert.ok(Math.abs(Math.abs(turningDialAngle(AURA_CLOCK_PERIOD)) - TAU) < 1e-9, 'one turn over the clock');
  assert.deepEqual(TURNING_RGB.gold, TITLE_RGBA.hourbreaker.slice(0, 3), 'the Hourbreaker\'s gold');
  assert.match(AURA_FS, /if \(uAura == 6\) \{ vec3 c = uKind == 0 \? turningGround\(vP\) : turningWall\(vP\);/);
});

// ── the shader, run ────────────────────────────────────────────────────

const at = (kind, vP, { t = 30.5, kindle = 1, world = [0, 0, 0], fog = null, eye = [0, 1.2, 5], px = 0.001 } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: world, uKind: kind, uAura: 6, uTime: t, uSeed: 0, uKindle: kindle, uRingR: AURA_LOOK.turninghour.ringR, uGroundR: AURA_GROUND_R,
    uFlameH: TURNING_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: eye, uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uResLit: Array(48).fill(0), dFdx: () => [px, 0, 0], dFdy: () => [0, px, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
/** The world angle of tooth `k`'s middle, or of the gap after it, at `t`. */
const toothAt = (k, t, gap = false) => turningWheelAngle(t) + ((k + (gap ? 0.85 : 0.45)) / TURNING_TEETH) * TAU;

test('SD9c THE WHEEL, the shader RUN: brass where its teeth stand at the clock\'s own turn and nothing between them past the rim; the rim whole round; its spokes and its hub, nothing between the spokes but the light; after a second\'s step the teeth stand a step on, held through the second; unkindled nothing; the quad\'s corners round (mutants: the teeth fixed; the step dropped; the spokes off the wheel)', () => {
  const tipR = TURNING_R + TURNING_TOOTH_M / 2;
  const base = lum(at(0, polar(tipR, toothAt(3, 30.5, true))));
  for (const t of [30.5, 31.9, 77.3]) {
    for (const k of [0, 5, 11, 17, 23]) {
      const on = lum(at(0, polar(tipR, toothAt(k, t)), { t }));
      const off = lum(at(0, polar(tipR, toothAt(k, t, true)), { t }));
      assert.ok(on > off + 0.3, `tooth ${k} brass at ${t} (${on.toFixed(3)} vs the gap's ${off.toFixed(3)})`);
    }
  }
  assert.ok(base < 0.25, 'a gap holds only the light');
  // the rim: whole round
  for (let i = 0; i < 16; i++) assert.ok(lum(at(0, polar(TURNING_R - TURNING_RIM_M / 2, (i / 16) * TAU))) > 0.4, `the rim at ${i}/16`);
  // the spokes, and the light between them
  const spokeR = (TURNING_HUB_R + TURNING_R - TURNING_RIM_M) / 2, w = turningWheelAngle(30.5);
  for (let s = 0; s < TURNING_SPOKES; s++) {
    const on = lum(at(0, polar(spokeR, w + (s / TURNING_SPOKES) * TAU))), off = lum(at(0, polar(spokeR, w + ((s + 0.5) / TURNING_SPOKES) * TAU)));
    assert.ok(on > off + 0.3, `spoke ${s} (${on.toFixed(3)} vs ${off.toFixed(3)})`);
  }
  // held: every tooth where it was from a quarter-second on to the next second's step - the shader's own clock, never smooth
  let still = 0;
  for (let i = 0; i < 96; i++) { const p = polar(tipR, (i / 96) * TAU); if (Math.abs(lum(at(0, p, { t: 30.3 })) - lum(at(0, p, { t: 30.95 }))) < 0.02) still++; }
  assert.equal(still, 96, `the wheel holds between its steps (${still} of 96 still)`);
  // the step: the wheel a step on after a second, held through it
  const k = 7, a0 = toothAt(k, 30.5);
  assert.ok(lum(at(0, polar(tipR, a0), { t: 30.9 })) > 0.5, 'held through the second');
  assert.ok(lum(at(0, polar(tipR, a0 + (TAU * TURNING_HZ.wheel)), { t: 31.5 })) > 0.5, 'a step on, the next second');
  assert.ok(lum(at(0, polar(tipR, a0 + 0.42 * TAU / TURNING_TEETH), { t: 30.5 })) < base + 0.05, 'the gap beside it, empty');
  // kindling, the middle, the corners
  assert.equal(lum(at(0, polar(tipR, a0), { kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(at(0, [0, 0]).every((x) => Number.isFinite(x)), 'the middle, never a NaN');
  assert.throws(() => at(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
});

test('SD9c THE DIAL AND THE LIGHT, the shader RUN: the Hour\'s twelve marks on the dial at its own turn - turning back - the Hour\'s own the longer, nothing between them; the gold light at the feet, breathing; the strip: the wheel\'s edge passing round with its teeth at the foot, gold light rising off it, nothing over the knee but the motes, kindled up from the feet; the vertex half stands it at the teeth\'s tips (mutants: the dial forward; the Hour\'s mark lost; the edge fixed)', () => {
  const t = 30.5, d = turningDialAngle(t);
  const markR = TURNING_DIAL_R - TURNING_MARK_M / 2;
  for (let h = 0; h < TURNING_MARKS; h++) {
    const on = lum(at(0, polar(markR, d + (h / TURNING_MARKS) * TAU), { t })), off = lum(at(0, polar(markR, d + ((h + 0.5) / TURNING_MARKS) * TAU), { t }));
    assert.ok(on > off + 0.3, `mark ${h} (${on.toFixed(3)} vs ${off.toFixed(3)})`);
  }
  const deep = TURNING_DIAL_R - TURNING_MARK_M * 1.5;
  assert.ok(lum(at(0, polar(deep, d), { t })) > lum(at(0, polar(deep, d + TAU / TURNING_MARKS), { t })) + 0.3, 'the Hour\'s own mark the longer');
  const d3 = turningDialAngle(t + 3), on3 = d - (d3 - d);   // AUDIT SD II (L2 F13 - PIN MOVED): where its law stands it, and where the other way would
  assert.ok(lum(at(0, polar(markR, d3), { t: t + 3 })) > 0.5 && lum(at(0, polar(markR, on3), { t: t + 3 })) < 0.3, 'it turned back, not on');
  // the light at the feet, breathing
  const feet = [0.02, 0.02];
  assert.ok(lum(at(0, feet)) > 0.3 && lum(at(0, feet)) > lum(at(0, [0.45, 0])) , 'brightest at the feet');
  assert.notEqual(lum(at(0, feet, { t: 30 })), lum(at(0, feet, { t: 31 })), 'breathing');
  // the strip
  const tooth = (t2) => ((turningWheelAngle(t2) / TAU + 0.45 / TURNING_TEETH) % 1 + 1) % 1, gap = (t2) => ((turningWheelAngle(t2) / TAU + 0.85 / TURNING_TEETH) % 1 + 1) % 1;
  const footV = (TURNING_EDGE_M / 2) / TURNING_H;
  assert.ok(lum(at(1, [tooth(t), footV], { t })) > lum(at(1, [gap(t), footV], { t })) + 0.3, 'the wheel\'s edge: a tooth\'s face, then a gap');
  assert.ok(lum(at(1, [tooth(t), 0.95], { t })) < 0.2, 'nothing over the knee but a mote');
  let mote = 0;
  for (let i = 0; i < 240; i++) for (const v of [0.55, 0.7, 0.85]) mote = Math.max(mote, lum(at(1, [i / 240, v], { t })));
  assert.ok(mote > 0.1, `the motes rising over the knee (${mote.toFixed(3)})`);
  assert.equal(lum(at(1, [tooth(t), footV], { t, kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(lum(at(1, [tooth(t), footV], { t, kindle: 0.1 })) > 0 && lum(at(1, [tooth(t), 0.6], { t, kindle: 0.1 })) === 0, 'kindled up from the feet');
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAura: 6, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: AURA_LOOK.turninghour.ringR, uFlameH: TURNING_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const near = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(near(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + TURNING_R + TURNING_TOOTH_M]), 'the strip\'s foot at the teeth\'s tips');
  assert.ok(near(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + TURNING_H, -4 + TURNING_R + TURNING_TOOTH_M]), 'to its height');
});
