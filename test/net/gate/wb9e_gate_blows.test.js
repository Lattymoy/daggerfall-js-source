// WB9e (2026-09-30, Mac: "Increase boss damage, further improve his telegraphs"): HIS BLOWS HEAVIER, AND READ BEFORE
// THEY LAND AND SEEN AS THEY DO.
//
//   the weight       net/gate/gateBrain.js ATTACKS - every share and base raised by about a third over WBX4's; two heavy
//                    landings end anyone who has not healed between them; still every one escaped by moving
//   the telegraph    render/gate/gateTelegraph.js - an edge that reads from anywhere (its width in screen space), a FUSE
//                    burning down its rim as the wind-up runs, the fill throbbing faster as the landing nears, the last
//                    moment burning at a landing's brightness, the grain of what lands (fire, frost, storm, venom, his
//                    weight, Dagon's), and a shockwave thrown out past its edge as it lands
//   the landing      render/gate/gateFx.js - sparks out of the stone where it lands, and the meteor seen falling
//
// Design: bible/11-Multiplayer/World-Bosses.md section 14 (WB9e).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ATTACKS, ATTACK_BY_ID, fightProfile, BASE_PROFILE, windupOf, COURTS } from '../../../src/net/gate/gateBrain.js';
import { strikeDamage } from '../../../src/net/gate/gateStrike.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import {
  telegraphShape, telegraphStyle, poolShapes, GateTelegraphRenderer, TELEGRAPH_STYLE, TELEGRAPH_FS, TELEGRAPH_WAVE_MPS, TELEGRAPH_WAVE_MS, TELEGRAPH_NOW_MS,
} from '../../../src/render/gate/gateTelegraph.js';
import {
  GateFxRenderer, fxBurstOf, meteorFall, sparkAt, sparkSeed, FX_KINDS, FX_BURST_MS, FX_SPARKS, FX_BURSTS_MAX, METEOR_FALL_MS, METEOR_FROM_M, METEOR_DIR, METEOR_ELEV_DEG, FX_SPARK_VS,
} from '../../../src/render/gate/gateFx.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { attackColor } from '../../../src/world/gate/gateBoss.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });

/** WBX4's weights, the ones WB9e raised from. */
const WBX4 = Object.freeze({ cleave: [0.35, 8], slam: [0.40, 10], charge: [0.30, 8], hellfire: [0.30, 6], nova: [0.45, 10], leap: [0.35, 8], meteor: [0.50, 12], spokes: [0.40, 10] });

test('WB9e the weight: every share and base raised by about a third over WBX4\'s; two of his heavy landings end anyone who has not healed between them, at any health; the Meteor or the Nova alone most of a body; the Wrath and the Reckoning past any health (mutants: a weight left where it was)', () => {
  const now = Object.fromEntries(Object.keys(WBX4).map((k) => [k, [ATTACKS[k].pct, ATTACKS[k].base]]));
  assert.deepEqual(now, { cleave: [0.45, 12], slam: [0.52, 14], charge: [0.40, 12], hellfire: [0.40, 9], nova: [0.58, 14], leap: [0.45, 12], meteor: [0.64, 16], spokes: [0.52, 14] });
  for (const [k, [pct, base]] of Object.entries(WBX4)) {
    assert.ok(ATTACKS[k].pct >= pct * 1.25 && ATTACKS[k].pct <= pct * 1.4, `${k}: ${pct} -> ${ATTACKS[k].pct}`);
    assert.ok(ATTACKS[k].base >= base * 1.3, `${k}'s base`);
  }
  for (const H of [30, 80, 200, 600]) {
    for (const k of ['slam', 'nova', 'meteor', 'spokes']) assert.ok(2 * strikeDamage(ATTACKS[k].pct, H, ATTACKS[k].base) >= H, `${k} twice ends ${H}`);
    assert.ok(strikeDamage(ATTACKS.meteor.pct, H, ATTACKS.meteor.base) >= 0.64 * H);
  }
  assert.ok(strikeDamage(ATTACKS.reckon.pct, 5000, 0) > 5000 && strikeDamage(ATTACKS.wrath.pct, 5000, 0) > 5000);
  assert.deepEqual([ATTACKS.cross.pct, ATTACKS.cross.base], [ATTACKS.leap.pct, ATTACKS.leap.base], 'the bound lands as his leap does');
  // no wind-up moved: escaping is as fast as it ever was (WBX5's word - "I dont think making mechanics faster is the play")
  const WINDUPS = { cleave: 1400, slam: 1600, charge: 1200, hellfire: 2000, nova: 2200, leap: 1500, meteor: 2800, spokes: 1800 };
  for (const [k, w] of Object.entries(WINDUPS)) assert.equal(ATTACKS[k].windup, w);
});

test('WB9e the telegraph\'s grain: each landing in the grain of what it is - his weight\'s cracks for a blade, a slam, a charge, a leap and the bound; his element\'s for his fire (fire, frost, storm, venom by his aspect); Dagon\'s vortex for the Wrath and the Reckoning under every aspect; and each shape carries its own clock - since its word, its wind-up\'s length, since its landing (mutants: Dagon\'s in his aspect\'s grain)', () => {
  for (const k of ['cleave', 'slam', 'charge', 'leap', 'cross']) assert.equal(telegraphStyle(ATTACKS[k]), TELEGRAPH_STYLE.weight, k);
  assert.equal(telegraphStyle(ATTACKS.hellfire), TELEGRAPH_STYLE.fire);
  assert.equal(telegraphStyle(ATTACKS.hellfire, fightProfile(['rime'])), TELEGRAPH_STYLE.frost);
  assert.equal(telegraphStyle(ATTACKS.nova, fightProfile(['storm'])), TELEGRAPH_STYLE.shock);
  assert.equal(telegraphStyle(ATTACKS.spokes, fightProfile(['venom'])), TELEGRAPH_STYLE.poison);
  for (const md of [null, ['rime'], ['storm'], ['venom']]) for (const k of ['wrath', 'reckon']) assert.equal(telegraphStyle(ATTACKS[k], fightProfile(md)), TELEGRAPH_STYLE.dagon);
  const sh = telegraphShape(W('meteor', { tg: [[4, 4]] }), 2, 10000 - 1400, BASE_PROFILE);
  assert.ok(Math.abs(sh.since - 1.4) < 1e-9 && Math.abs(sh.span - windupOf(ATTACKS.meteor, 2) / 1000) < 1e-9 && sh.after === -1);
  const landed = telegraphShape(W('meteor', { tg: [[4, 4]] }), 2, 10150, BASE_PROFILE);
  assert.ok(Math.abs(landed.after - 0.15) < 1e-9, 'since its landing');
  assert.equal(poolShapes([{ x: 1, z: 1, r: 3, from: 0, until: 5000, pct: 0.1, base: 1, el: 'fire' }], 1000, [1, 0, 0])[0].style, TELEGRAPH_STYLE.fire);
});

test('WB9e the shader reads (WB13a: honed): the line two pixels wide however far off, read off the edge\'s own derivative, a soft glow outside it; no fuse - one line, whole; the throb on the line alone, quickening toward the landing on its own clock; the last moment brightening the line alone; a shockwave run out past the edge at TELEGRAPH_WAVE_MPS for TELEGRAPH_WAVE_MS, sized to its shape - never for the ground nor the whole arena\'s (mutants: the throb steady; the last moment flooding the shape)', () => {
  for (const re of [
    /float aa = max\(fwidth\(edge\), 1e-4\) \* uLineW;/,   // WB13a: the edge's own derivative - the cone's edge continuous now (AUDIT WB9 F1's jump gone)
    /float core = max\(1\.0 - smoothstep\(aa \* wid, 2\.2 \* aa \* wid, edge\), 1\.0 - smoothstep\(0\.05, 0\.08, edge\)\);/,
    /float glow = \(1\.0 - fin\) \* exp\(-edge \/ \(4\.0 \* aa \+ 0\.12\)\);/,
    /float hz = 1\.5 \+ 0\.5 \* T2;/,   // AUDIT WB9 (court F3); WB13a: three beats a second at the landing, at most
    /float throb = 0\.85 \+ 0\.15 \* cos\(6\.283185307179586 \* hz \* uSince\);/,
    /float now = uPool == 0 \? smoothstep\(uSpan - 0\.180, uSpan, uSince\) \* \(1\.0 - uFlash\) : 0\.0;/,
    /float line = \(core \* \(0\.95 \* throb \* pop \+ 0\.65 \* now\) \+ glow \* 0\.22\) \* \(1\.0 - 0\.3 \* safe\);/,   // the throb and the last moment on the line alone
    /float rw = min\(uAfter \* 22\.0, clamp\(0\.5 \* size, 1\.0, 3\.5\)\);/,
    /if \(uKind != 5\) rgb \+= hot \* wave \* 0\.9;/,
  ]) assert.match(TELEGRAPH_FS, re);
  assert.doesNotMatch(TELEGRAPH_FS, /fuse|spark/, 'WB13a: no fuse - it burned the line down as danger neared');
  assert.equal(TELEGRAPH_WAVE_MPS, 22); assert.equal(TELEGRAPH_WAVE_MS, 280); assert.equal(TELEGRAPH_NOW_MS, 180);
  for (let s = 0; s <= 5; s++) assert.match(TELEGRAPH_FS, new RegExp(s < 5 ? `if \\(uStyle == ${s + 1}\\)` : 'return 1\\.0 - smoothstep\\(0\\.0, 0\\.05, abs\\(vnoise\\(p \\* 0\\.55\\) - 0\\.5\\)\\);'), `the grain of style ${s}`);
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const pass = new GateTelegraphRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  pass.draw(telegraphShape(W('hellfire', { tg: [[1, 1]] }), 2, 9500, fightProfile(['rime'])), I, I, [0, 0, 0], 1);
  const u = (n) => calls.find((c) => c[1] === n)?.[2];
  assert.equal(u('uStyle'), TELEGRAPH_STYLE.frost); assert.equal(u('uPool'), 0);
  assert.ok(Math.abs(u('uSince') - 1.5) < 1e-9 && Math.abs(u('uSpan') - 2) < 1e-9 && u('uAfter') === -1);
  assert.match(read('tools/gateTelegraphProbe.mjs'), /extname\(f\) === '\.json' \? 'application\/json'/, 'the probe serves the court\'s JSON as JSON');
});

test('WB9e the landing\'s bursts: sparks from the slam, the leap, the bound, Hellfire, the Meteor, the Nova and Dagon\'s own - the heavy ones throwing more, further; none from a blade, the charge\'s run or the spokes; each spark out along its bearing, up and falling to rest on the floor, spent within FX_BURST_MS (mutants: a spark falling through the floor; a burst living forever)', () => {
  for (const k of ['cleave', 'charge', 'spokes']) assert.equal(fxBurstOf(ATTACKS[k]), null, k);
  assert.equal(fxBurstOf(ATTACKS.wrath), FX_KINDS.dagon); assert.equal(fxBurstOf(ATTACKS.reckon), FX_KINDS.dagon);
  assert.ok(FX_KINDS.cross.power > FX_KINDS.slam.power && FX_KINDS.meteor.power > FX_KINDS.hellfire.power && FX_KINDS.dagon.power >= FX_KINDS.meteor.power);
  assert.ok(FX_KINDS.slam.grit && FX_KINDS.leap.grit && !FX_KINDS.meteor.grit, 'his weight throws grit, his fire flame');
  for (let i = 0; i < FX_SPARKS; i++) {
    const [a, b] = sparkSeed(i);
    assert.ok(a >= 0 && a < 1 && b >= 0 && b < 1);
    const early = sparkAt(i, 0.1), late = sparkAt(i, FX_BURST_MS / 1000);
    assert.ok(early.at[1] > 0.05 && Math.hypot(early.at[0], early.at[2]) > 0, 'out and up');
    assert.ok(late.at[1] >= 0.05, 'never through the floor');
    assert.equal(late.spent, 1, 'spent within the burst');
  }
  assert.ok(Math.hypot(sparkAt(3, 0.3, 1.6).at[0], sparkAt(3, 0.3, 1.6).at[2]) > Math.hypot(sparkAt(3, 0.3, 1).at[0], sparkAt(3, 0.3, 1).at[2]), 'further for the heavy');
  assert.match(FX_SPARK_VS, /max\(upv \* t - 7\.000 \* t \* t, uFloor - uAt\.y \+ 0\.05\)/, 'the shader\'s own rest on the floor (WB9f: the floor under it)');
});

test('WB9e the meteor seen falling: through the last METEOR_FALL_MS of its wind-up, out of the sky down its path onto its mark, gathering speed; none before, none after, none for any other attack (mutants: the stone at its mark all the wind-up)', () => {
  const atk = W('meteor', { tg: [[6, -4]] });
  assert.equal(meteorFall(atk, atk.at - METEOR_FALL_MS - 1), null);
  assert.equal(meteorFall(atk, atk.at), null, 'landed: the burst takes over');
  assert.equal(meteorFall(W('leap', { tg: [[6, -4]] }), atk.at - 100), null);
  const top = meteorFall(atk, atk.at - METEOR_FALL_MS), mid = meteorFall(atk, atk.at - METEOR_FALL_MS / 2), low = meteorFall(atk, atk.at - 10);
  assert.ok(Math.abs(Math.hypot(top.at[0] - 6, top.at[1], top.at[2] + 4) - METEOR_FROM_M) < 1e-9, 'from METEOR_FROM_M up its path');
  assert.ok(top.at[1] > mid.at[1] && mid.at[1] > low.at[1] && low.at[1] < 2, 'down onto the mark');
  assert.ok(METEOR_FROM_M - Math.hypot(mid.at[0] - 6, mid.at[1], mid.at[2] + 4) < METEOR_FROM_M / 2, 'gathering speed: slower in its first half');
  assert.ok(Math.abs(Math.hypot(...METEOR_DIR) - 1) < 1e-12 && Math.abs((Math.asin(METEOR_DIR[1]) * 180) / Math.PI - METEOR_ELEV_DEG) < 1e-9, 'out of the sky');
  assert.ok(METEOR_ELEV_DEG <= 40 && METEOR_FALL_MS >= 1700, 'WB13d: low enough and long enough to be seen by one looking at him');
});

test('WB9e the court throws them: each landing its bursts at its own moment (his feet for his own, where it lands for a leap, a bound or a meteor, under each mark for Hellfire), in its colour under his profile, the slots reused past FX_BURSTS_MAX; the meteor\'s fall through its last moments; the pass draws them after the telegraph, depth tested and never written (mutants: bursts at his feet for a meteor; a burst a frame)', () => {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const c = createGateCourt({ link, now: () => clock.t, feet: () => courtToDungeon(30, 0, 30), player: () => ({ health: 100, maxHealth: 100 }) });
  const st = (atk) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 2, hp: 900, max: 1000, wrathAt: 1e9, x: 0, z: 0, atk });
  const hf = W('hellfire', { i: 3, at: 10000, tg: [[1, 1], [5, -2], [-4, 6]] });
  link.st = st(hf); clock.t = 9990; c.frame();
  assert.deepEqual(c.state().bursts, []);
  clock.t = 10010; c.frame();
  const b = c.state().bursts;
  assert.deepEqual(b.map((x) => x.at.map((v) => Math.round(v * 10) / 10)), [[1, 1], [5, -2], [-4, 6]].map(([x, z]) => courtToDungeon(x, 0.1, z).map((v) => Math.round(v * 10) / 10)));
  assert.ok(b.every((x) => Math.abs(x.t - 0.01) < 1e-9 && x.kind === FX_KINDS.hellfire && x.color === attackColor(ATTACKS.hellfire, BASE_PROFILE)));
  clock.t = 10500; c.frame();
  assert.equal(c.state().bursts.length, 3, 'once, flying on');
  clock.t = 10000 + FX_BURST_MS + 10; c.frame();
  assert.deepEqual(c.state().bursts, [], 'spent');
  const met = W('meteor', { i: 4, at: 20000, tg: [[-3, 7]] });
  link.st = st(met); clock.t = 20000 - METEOR_FALL_MS + 300; c.frame();
  assert.ok(c.state().meteor && c.state().meteor.at[1] > 10, 'seen falling');
  clock.t = 20003; c.frame();
  assert.equal(c.state().meteor, null);
  assert.deepEqual(c.state().bursts.map((x) => [x.at[0], x.at[2]].map((v) => Math.round(v * 10) / 10)), [[courtToDungeon(-3, 0, 7)[0], courtToDungeon(-3, 0, 7)[2]].map((v) => Math.round(v * 10) / 10)], 'where it fell, never at his feet');
  // the pass
  const calls = [];
  const gl = new Proxy({ BLEND: 9, ONE: 10, CULL_FACE: 11, POINTS: 0, TRIANGLES: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const fx = new GateFxRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  fx.draw([], null, I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw touches nothing');
  const many = Array.from({ length: FX_BURSTS_MAX + 5 }, (_, i) => ({ at: [i, 0, 0], t: 0.2, kind: FX_KINDS.slam, color: [1, 1, 1] }));
  fx.draw(many, { at: [0, 30, 0], color: [1, 0.5, 0] }, I, I, [0, 0, 0], 1);
  assert.equal(fx.bursts, FX_BURSTS_MAX); assert.equal(fx.meteors, 1);
  assert.ok(calls.some((c) => c[0] === 'depthMask' && c[1] === false) && !calls.some((c) => c[0] === 'depthMask' && c[1] === true && calls.indexOf(c) < calls.length - 3), 'never written while it draws');
  assert.deepEqual(calls.slice(-3).map((c) => c[0]), ['enable', 'depthMask', 'disable'], 'the state put back');
  assert.equal(calls.filter((c) => c[0] === 'drawArrays' && c[1] === 0).length, FX_BURSTS_MAX, 'a draw of points a burst');
  assert.equal(calls.find((c) => c[0] === 'drawArrays' && c[1] === 0)[3], Math.round(FX_SPARKS * FX_KINDS.slam.share));
  const gc = read('src/scenes/gate/gateCourt.js');
  const tel = gc.indexOf('if (shape) { pass.draw(shape'), fxAt = gc.indexOf('fxPass.draw(_fxLive, meteorNow, proj, view, eye, seconds, fog);');
  assert.ok(tel > 0 && fxAt > tel, 'over the telegraph');
  assert.ok(COURTS.length === 6 && ATTACK_BY_ID.length === 19);   // WB14b: the portents' floors in the one table; WB14a: the new arsenal's six; PIN MOVED (WB14d): the Sundering and the Rejoining
});
