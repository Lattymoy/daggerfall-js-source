// PROF-RETICLE (2026-10-01, Mac: "move away from the overcomplicated minigame visuals and instead use the mechanics on
// something that doesnt cover the screen"; asked, "Around the crosshair"): THE ACT ON THE CROSSHAIR. No box, no title,
// no picture: the marks built once an act and moved every frame, round the crosshair's middle (ui/worldPlaque.js
// reticleAnchor); the mine's points and the knife's line where they stand on the node, through the frame's own lens
// (focal * tan of the angle off the look, one focal length both ways); the ring, the hold's arc, the glint, the float
// and the haul's bar about the crosshair; the count's pips and one hint under it, fading once it has stood; still forms
// under reduced motion; every cue a sound (systems/professions/profSounds.js).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfHud } from '../../src/ui/professions/profHud.js';
import { buildActReticle, marksOf, offsetOf, reachPx, HINT_MS, FOCAL_FALLBACK, NOTCH_PX, BASKET_SPREAD } from '../../src/ui/professions/profReticle.js';
import { reticleAnchor } from '../../src/ui/worldPlaque.js';
import { PROF_CUES, profCue, setProfCueSink } from '../../src/systems/professions/profSounds.js';
import { PROF_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { PROF_ACT_CSS } from '../../src/ui/professions/profActStyle.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { createMineAct, MINE_POINTS } from '../../src/systems/mineAct.js';
import { createChopAct } from '../../src/systems/chopAct.js';
import { createHerbAct, BASKET_SPOTS } from '../../src/systems/herbAct.js';
import { createTraceAct } from '../../src/systems/traceAct.js';
import { createFishAct } from '../../src/systems/fishAct.js';
import { MINE_ACT, TRACE_ACT } from '../../src/net/professionLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A roll that walks on - the glint's re-roll asks until it moves, so a constant roll would never end. */
const cycle = () => { let r = 0.05; return () => { r = (r + 0.37) % 1; return r; }; };
const all = (root, cls) => root.querySelectorAll(`.${cls}`);
const px = (s) => Number(String(s).replace('px', ''));
const near = (a, b, eps = 0.06) => Math.abs(a - b) <= eps;
const deg = Math.PI / 180;

test('PROF-RETICLE: the marks stand round the crosshair - no box, no title; built ONCE an act and moved every frame; a new act builds anew; null takes them down (mutants: rebuilt each frame, the old panel back)', () => {
  const hud = createProfHud({ doc: document });
  try {
    const meter = document.body.querySelector('.prof-meter');
    const a = createMineAct({ tier: 2, rng: cycle() });
    hud.setMeter(a, '', { title: 'Iron Vein' });
    assert.ok(meter.className.split(' ').includes('prof-reticle'));
    assert.equal(meter.querySelector('.prof-acttitle'), null, 'no title');
    assert.ok(!meter.textContent.includes('Iron Vein') && !meter.textContent.includes('Mining'), 'the node is named by the menu, not the act');
    const face = meter.querySelector('.prof-face');
    assert.ok(meter.querySelector('.prof-rc'));
    a.tick(0.1, { attack: true, aim: { yaw: 0, pitch: 0 } });
    hud.setMeter(a);
    assert.equal(meter.querySelector('.prof-face'), face, 'the same marks, moved - never rebuilt');
    hud.setMeter(createChopAct({ tier: 1 }));
    assert.equal(meter.querySelector('.prof-face'), null, 'a new act: built anew');
    assert.ok(meter.querySelector('.prof-ring'));
    hud.setMeter(null);
    assert.equal(meter.hidden, true);
    assert.equal(meter.children.length, 0);
  } finally { hud.dispose(); }
});

test('PROF-RETICLE lens: an angle off the look stands focal x tan(angle) from the crosshair, yaw to the right and pitch up, one focal length both ways; the reticle\'s middle and focal off the canvas, a docked bar raising both (mutants: the axes crossed, the sign flipped, the bar unread)', () => {
  const [x, y] = offsetOf([5, 2.5], { yaw: 1, pitch: -1 }, 600);
  assert.ok(near(x, 600 * Math.tan(4 * deg), 1e-9) && near(y, -600 * Math.tan(3.5 * deg), 1e-9));
  assert.deepEqual(offsetOf([0, 0], null, 600), [0, -0]);
  assert.ok(near(reachPx(2.5, 600), 600 * Math.tan(2.5 * deg), 1e-9));
  assert.equal(reachPx(-3, 600), 0);
  const canvas = { width: 1600, height: 900, clientWidth: 800 };
  const fov = 2 * Math.atan(0.5);
  const r = reticleAnchor(canvas, fov);
  assert.equal(r.x, 400);
  assert.equal(r.y, 225, 'undocked, the middle is the middle');
  assert.ok(near(r.focal, 450, 1e-9), 'half the view\'s height over tan of half the field');
  assert.equal(reticleAnchor({ width: 0, height: 0 }, fov), null);
  assert.match(src('src/ui/worldPlaque.js'), /export function reticleAnchor\(canvas, fovRad\) \{\n {2}if \(!canvas\?\.width \|\| !canvas\?\.height\) return null;\n {2}const \{ largeHudHeight \} = hudReticle\(canvas\);/);
  assert.match(src('src/ui/worldPlaque.js'), /const viewH = Math\.max\(1, canvas\.height - largeHudHeight\) \/ dpr;\n[\s\S]{0,120}y: crosshairCentreY\(canvas\.height, largeHudHeight\) \/ dpr,/);
});

test('PROF-RETICLE mine: the five points where they stand on the rock, through the lens, moving as the look does; the glint lit with the reach a blow counts double in; a blow\'s flash on the crosshair (gold on the glint); the strikes as pips (mutants: points unmoved, the reach unsized, pips frozen)', () => {
  const root = document.createElement('div');
  const a = createMineAct({ tier: 2, rng: cycle() });
  const p = buildActReticle(document, root, a);
  a.tick(0.1, { aim: { yaw: 1, pitch: -1 } });
  p.update(a, { focal: 600 });
  const marks = [...all(root, 'prof-glint'), ...all(root, 'prof-point')];
  assert.equal(marks.length, 5);
  assert.equal(all(root, 'prof-glint').length, 1, 'one glints');
  const face = root.querySelector('.prof-face');
  face.children.forEach((n, i) => {
    const [x, y] = offsetOf(MINE_POINTS[i], { yaw: 1, pitch: -1 }, 600);
    assert.ok(near(px(n.style.left), x) && near(px(n.style.top), y), `point ${i} on the rock`);
  });
  const z = 2 * 600 * Math.tan(MINE_ACT.radiusDeg * deg);
  assert.ok(near(px(all(root, 'prof-zone')[0].style.width), z), 'the reach a blow counts double in');
  const x0 = face.children[0].style.left;
  a.tick(0.05, { aim: { yaw: -2, pitch: 0 } });
  p.update(a, { focal: 600 });
  assert.notEqual(face.children[0].style.left, x0, 'the marks move with the look');
  assert.equal(all(root, 'prof-pip').length, a.state.need);
  a.tick(0.1, { attack: true, aim: { yaw: -2, pitch: 0 } });
  p.update(a, { focal: 600 });
  assert.equal(all(root, 'prof-pip').filter((n) => n.className.includes('on')).length, a.state.points);
  const flash = root.querySelector('.prof-strike');
  assert.ok(flash.className.includes(' on '), 'the blow\'s flash');
  assert.deepEqual([flash.style.left, flash.style.top], ['0px', '0px'], 'on the crosshair');
  // a blow on the glint: gold
  const g = MINE_POINTS[a.state.glint];
  a.tick(0.6, { aim: { yaw: g[0], pitch: g[1] } });
  a.tick(0.05, { attack: true, aim: { yaw: g[0], pitch: g[1] } });
  p.update(a, { focal: 600 });
  assert.equal(a.state.last, 'glint');
  assert.ok(root.querySelector('.prof-strike').className.includes('gold'));
});

test('PROF-RETICLE chop: the notch round the crosshair, the band a Clean Cut stands in, the ring closing and lit in the band; the short still bar under reduced motion (mutants: the ring unmoved, the band unwidened, the still form lost)', () => {
  const root = document.createElement('div');
  const a = createChopAct({ tier: 2, rank: 50 });
  const p = buildActReticle(document, root, a);
  p.update(a, {});
  const svgAll = (cls) => root.querySelectorAll(`.${cls}`);
  const ring = svgAll('ring-line')[0];
  assert.ok(near(Number(ring.getAttribute('r')), a.ring * NOTCH_PX, 0.01), 'the ring at its radius');
  assert.ok(near(Number(svgAll('ring-band')[0].getAttribute('stroke-width')), 2 * a.state.band * NOTCH_PX, 0.01), 'the band its width');
  const r0 = ring.getAttribute('r');
  a.tick(0.3, {});
  p.update(a, {});
  assert.notEqual(ring.getAttribute('r'), r0, 'the ring closing');
  for (let i = 0; i < 200 && !a.inBand; i++) a.tick(0.01, {});
  p.update(a, {});
  assert.ok(ring.className.includes('in-band'), 'lit in the band');
  a.tick(0.01, { attack: true });
  p.update(a, {});
  assert.ok(root.querySelector('.prof-strike').className.includes('gold'), 'a Clean Cut flashes gold');
  assert.equal(all(root, 'prof-pip').filter((n) => n.className.includes('on')).length, a.state.points);
  p.update(a, { reduced: true });
  assert.deepEqual([root.querySelector('.prof-ring').style.display, root.querySelector('.prof-ringbar').style.display], ['none', ''], 'the still bar');
  assert.ok(root.querySelector('.prof-ringmark').style.left.endsWith('%'));
});

test('PROF-RETICLE hold, basket: the hand\'s hold an arc round the crosshair, a bruise turning it; Gentle acts the same arc; the Basket\'s glint at its spot about the crosshair, its time left an arc, the finds as pips (mutants: the arc unfilled, the bruise unshown, the finds uncounted)', () => {
  const root = document.createElement('div');
  const h = createHerbAct({ kind: 'steady' });
  let p = buildActReticle(document, root, h);
  for (let i = 0; i < 10; i++) h.tick(0.1, { held: true });
  p.update(h, { label: 'E' });
  assert.equal(root.querySelector('.arc-fill').getAttribute('stroke-dasharray'), '40 100');
  h.tick(0.1, { held: true, view: { yaw: 9, pitch: 0 } });
  p.update(h, { label: 'E' });
  assert.ok(root.querySelector('.prof-hold').className.includes('bruised'));
  assert.match(root.textContent, /bruised\. Keep E held to save what is left/);
  assert.equal(marksOf(createTraceAct({ tier: 1, gentle: true })), 'hold', 'Gentle acts: a hold');
  assert.equal(marksOf(createHerbAct({ kind: 'hand' })), 'hold');
  // the Basket
  let r = 0;
  const b = createHerbAct({ kind: 'basket', rng: () => ((r += 0.37) % 1) });
  p = buildActReticle(document, root, b);
  for (let i = 0; i < 5; i++) b.tick(0.1, {});
  p.update(b, {});
  const glint = root.querySelector('.prof-glint');
  assert.equal(glint.style.display, '');
  const [sx, sy] = BASKET_SPOTS[b.state.spot];
  assert.equal(glint.style.left, `calc(${Math.round((sx - 0.5) * BASKET_SPREAD[0] * 10) / 10}px * var(--hud-scale, 1))`);
  assert.equal(glint.style.top, `calc(${Math.round(((sy - 0.5) * BASKET_SPREAD[1] - BASKET_SPREAD[2]) * 10) / 10}px * var(--hud-scale, 1))`, 'lifted clear of the pips');
  assert.ok(Math.max(...BASKET_SPOTS.map(([, y]) => (y - 0.5) * BASKET_SPREAD[1] - BASKET_SPREAD[2])) + 9 < 20, 'the lowest glint above the pips (20 px under the middle)');
  b.tick(0.3, {});
  p.update(b, {});
  assert.ok(Number(root.querySelector('.prof-glintclock').querySelector('.arc-fill').getAttribute('stroke-dasharray').split(' ')[0]) < 100, 'its time running out');
  b.tick(0.01, { attack: true });
  p.update(b, {});
  assert.deepEqual(all(root, 'prof-slot').map((n) => n.className), ['prof-slot found', 'prof-slot next', 'prof-slot']);
  assert.ok(root.querySelector('.prof-strike').className.includes('gold'), 'a find\'s flash');
});

test('PROF-RETICLE trace: the line laid on the body through the lens, the scored line the first polyline, the tolerance a band under it, the first point\'s reach until the knife starts, the points passed lit, the line drawn behind the knife, a slip said (mutants: the line unlaid, the tolerance unsized, the line undrawn)', () => {
  const root = document.createElement('div');
  const t = createTraceAct({ tier: 1, rank: 60, rng: () => 0.5 });   // a rank's widened tolerance, not the Novice's
  const p = buildActReticle(document, root, t);
  p.update(t, { focal: 500 });
  assert.ok(t.state.tol > TRACE_ACT.tolDeg);
  const lines = root.querySelectorAll('POLYLINE');
  const pts = t.state.points;
  const laid = lines[0].getAttribute('points').split(' ').map((s) => s.split(',').map(Number));
  assert.equal(laid.length, pts.length);
  laid.forEach(([x, y], i) => assert.ok(near(x, 500 * Math.tan(pts[i][0] * deg)) && near(y, -500 * Math.tan(pts[i][1] * deg)), `point ${i}: a degree the same across as up`));
  assert.ok(near(Number(root.querySelector('.trace-tube').getAttribute('stroke-width')), 2 * 500 * Math.tan(t.state.tol * deg)), 'the tolerance\'s band');
  const zone = root.querySelector('.prof-zone');
  assert.ok(near(px(zone.style.width), 2 * 500 * Math.tan(TRACE_ACT.startDeg * deg)), 'the first point\'s reach');
  assert.equal(zone.style.display, '');
  t.tick(0.05, { held: true, aim: { yaw: pts[0][0], pitch: pts[0][1] } });
  t.tick(0.05, { held: true, aim: { yaw: pts[1][0], pitch: pts[1][1] } });
  p.update(t, { focal: 500 });
  assert.equal(zone.style.display, 'none', 'tracing: the reach goes');
  assert.ok(lines[1].getAttribute('points').length > 0, 'the line drawn behind the knife');
  assert.equal(all(root, 'prof-glint').length, t.state.reached + 1);
  const at1 = root.querySelectorAll('POLYLINE')[0].getAttribute('points').split(' ')[1].split(',').map(Number);
  assert.ok(near(at1[0], 0) && near(at1[1], 0), 'the knife on the second point: the line moved under the crosshair');
  t.tick(0.05, { held: false });
  p.update(t, { focal: 500, label: 'E' });
  assert.match(root.textContent, /slips 1/);
  assert.ok(root.querySelector('.prof-nick').className.includes(' on '));
});

test('PROF-RETICLE fish: the throw an arc while it winds, its metres beside it; the float under the crosshair while it waits, over a school marked; the tug\'s ring and the float\'s dip; the haul\'s band and weight on a bar beside the crosshair, slipping marked, the net\'s fill an arc (mutants: the gauge frozen, the dip lost, the haul unshown)', () => {
  const root = document.createElement('div');
  const a = createFishAct({ rng: () => 0.2, schoolAt: () => 0 });
  const p = buildActReticle(document, root, a);
  p.update(a, { label: 'E' });
  const windFill = root.querySelector('.prof-wind').querySelector('.arc-fill');
  const d0 = windFill.getAttribute('stroke-dasharray');
  for (let i = 0; i < 9; i++) a.tick(0.1, { held: true });
  p.update(a, { label: 'E' });
  assert.notEqual(windFill.getAttribute('stroke-dasharray'), d0, 'the throw winds');
  assert.match(root.querySelector('.prof-rlabel').textContent, /^\d+ m$/);
  a.tick(0.05, { held: false });
  p.update(a, { label: 'E' });
  assert.equal(root.querySelector('.prof-wind').style.display, 'none');
  for (let i = 0; i < 2000 && a.state.phase !== 'wait'; i++) a.tick(0.05, {});
  p.update(a, { label: 'E' });
  assert.equal(root.querySelector('.prof-float').style.display, '');
  assert.ok(root.querySelector('.prof-float').className.includes('school'), 'over a school');
  for (let i = 0; i < 2000 && a.state.phase !== 'tug'; i++) a.tick(0.05, {});
  p.update(a, { label: 'E' });
  assert.ok(root.querySelector('.prof-float').className.includes('dip'), 'the float dips');
  assert.equal(root.querySelector('.prof-tugring').style.display, '');
  a.tick(0.05, { attack: true });
  for (let i = 0; i < 10; i++) a.tick(0.1, { held: true });
  p.update(a, { label: 'E' });
  const st = a.state;
  assert.equal(root.querySelector('.prof-haulbar').style.display, '');
  assert.equal(root.querySelector('.prof-tugring').style.display, 'none');
  assert.equal(root.querySelector('.prof-haulband').style.bottom, `${Math.round(st.bandAt * 1000) / 10}%`);
  assert.equal(root.querySelector('.prof-haulweight').style.bottom, `${Math.round(st.weight * 1000) / 10}%`);
  const inside = st.weight >= st.bandAt && st.weight <= st.bandAt + st.bandW;
  assert.equal(root.querySelector('.prof-haulbar').className.includes('slipping'), !inside);
  assert.equal(root.querySelector('.prof-netfill').querySelector('.arc-fill').getAttribute('stroke-dasharray'), `${Math.round(st.fill * 1000) / 10} 100`);
});

test('PROF-RETICLE hint: one line under the crosshair, faded once it has stood HINT_MS unchanged - a number moving in it does not bring it back, a new line does; its words stay for the reader (mutants: never faded, the number restarting it)', () => {
  const root = document.createElement('div');
  const a = createFishAct({ rng: () => 0.5 });
  const p = buildActReticle(document, root, a);
  const hint = () => root.querySelector('.prof-hint');
  p.update(a, { label: 'E', now: 1000 });
  assert.equal(hint().className, 'prof-hint');
  for (let i = 0; i < 6; i++) a.tick(0.1, { held: true });
  p.update(a, { label: 'E', now: 1000 + HINT_MS - 1 });
  assert.equal(hint().className, 'prof-hint', 'still standing');
  for (let i = 0; i < 6; i++) a.tick(0.1, { held: true });
  p.update(a, { label: 'E', now: 1000 + HINT_MS + 1 });
  assert.equal(hint().className, 'prof-hint faded', 'the metres moved, the line did not come back');
  assert.match(hint().textContent, /hold E to wind the net, let go to throw it \(\d+ m\)/, 'its words stay');
  a.tick(0.05, { held: false });
  p.update(a, { label: 'E', now: 1000 + HINT_MS + 2 });
  assert.equal(hint().textContent, 'the net flies...');
  assert.equal(hint().className, 'prof-hint', 'a new line shows');
  assert.equal(FOCAL_FALLBACK, 500);
});

test('PROF-RETICLE cues (PIN MOVED, GATHER-FEEL): the HUD draws the act and says nothing aloud - its cues are the gathering\'s ear\'s now (systems/gatherSounds.js, test/systems/gatherfeel.test.js), which keeps DFU\'s own table for the classic skin (mutants: the table\'s hits cut to one)', () => {
  const heard = [];
  setProfCueSink((clip, vol) => heard.push([clip, vol]), () => 0);
  const hud = createProfHud({ doc: document });
  try {
    const a = createMineAct({ tier: 2, rng: cycle() });
    hud.setMeter(a);
    a.tick(0.1, { attack: true, aim: { yaw: 0, pitch: 0 } });
    hud.setMeter(a);
    assert.deepEqual(heard, [], 'a strike drawn, nothing said by the HUD');
    assert.equal(typeof hud.cue, 'undefined', 'no door to say a cue through');
  } finally { hud.dispose(); setProfCueSink(null, null); }
  assert.equal(profCue('nothing'), false);
  assert.deepEqual(PROF_CUES.strike.clips, [SOUND.Hit1, SOUND.Hit1 + 1, SOUND.Hit1 + 2, SOUND.Hit1 + 3, SOUND.Hit1 + 4], 'DFU\'s five hit clips');
  assert.deepEqual(PROF_CUES.clean.clips, [SOUND.ActivateLockUnlock]);
  assert.doesNotMatch(src('src/ui/professions/profHud.js'), /profCue|profSounds/, 'the HUD imports no voice');
});

test('PROF-RETICLE host: the marks stand round the crosshair\'s middle and read the frame\'s lens (the anchor\'s focal); the world gives it reticleAnchor through fieldOfView; the last frame drawn before the act ends, a clean finish rung; the sheet appended after the old meter\'s rules, no plate, still forms under reduced motion (mutants: each wire cut)', () => {
  const props = {};
  const hud = createProfHud({ doc: document, anchor: () => ({ x: 412.5, y: 300, focal: 640 }) });
  try {
    const meter = document.body.querySelector('.prof-meter');
    meter.style.setProperty = (k, v) => { props[k] = v; };
    const a = createMineAct({ tier: 2, rng: cycle() });
    a.tick(0.05, { aim: { yaw: 0, pitch: 0 } });
    hud.setMeter(a);
    assert.deepEqual(props, { '--rx': '412.5px', '--ry': '300.0px' });
    const second = meter.querySelector('.prof-face').children[1];
    assert.ok(near(px(second.style.left), offsetOf(MINE_POINTS[1], { yaw: 0, pitch: 0 }, 640)[0]), 'the anchor\'s focal');
  } finally { hud.dispose(); }
  const w = src('src/scenes/world.js');
  assert.match(w, /const hud = createProfHud\(\{ anchor: \(\) => reticleAnchor\(canvas, fieldOfView\(\)\) \}\);/);
  const g = src('src/scenes/gatherHost.js');
  assert.match(g, /else if \(act\.act\.state\.done\) \{ hud\.setMeter\(act\.act, act\.label \?\? '', \{ byUse: act\.heldByUse === true \}\); finish\(act\); \}/);
  assert.match(g, /if \(a\.clean\) ear\.say\('clean', null, \{ of: a\.act \}\);/);   // PIN MOVED (GATHER-FEEL): the clean finish the ear's, as its last blow lands - PIN MOVED again (AUDIT GATHER-FEEL LANDING): riding that blow's machine
  assert.ok(PROF_CSS.indexOf(PROF_ACT_CSS) > PROF_CSS.indexOf('.prof-meter { position: fixed; left: 50%; top: 50%;'), 'after the old meter\'s rules');
  assert.match(PROF_ACT_CSS, /\.prof-meter\.prof-reticle \{ position: fixed; left: var\(--rx, 50%\); top: var\(--ry, 50%\); transform: translate\(-50%, -50%\);/);
  assert.match(PROF_ACT_CSS, /padding: 0; margin: 0; background: none; border: 0; box-shadow: none;/, 'no plate');
  assert.match(PROF_ACT_CSS, /\.prof-meter\.prof-reticle \.prof-hint\.faded \{ opacity: 0; \}/);
  assert.match(PROF_ACT_CSS, /@media \(prefers-reduced-motion: reduce\) \{\n\s*\.prof-meter\.prof-reticle \.prof-glint::before, \.prof-meter\.prof-reticle \.prof-glint::after, \.prof-meter\.prof-reticle \.prof-float, \.prof-meter\.prof-reticle \.prof-tugring \{ animation: none; \}/);
});
