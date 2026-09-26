// WB6c (2026-09-25, Mac: "the transition and the arena needs to be an oblivion masterpiece"): THE STEP THROUGH THE
// GATE, DRIVEN. The veil's law (the front closing past the centre and opening past the corners by all its raggedness,
// the cover and the eye's heat); the veil on a fake page (the canvas made once, the fire closed and the promise
// answered, held shut for the new place's first frames, opened, hidden; closed again from where it stood; the force's
// flash; the watchdog; no WebGL2 - the step unveiled; the sounds); and the seams by source. tools/gateVeilProbe.mjs
// draws it in a real WebGL2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  veilAt, GATE_VEIL_FS, VEIL_CLOSE_S, VEIL_OPEN_S, VEIL_HOLD_MAX_S, VEIL_FRONT_OUT, VEIL_FRONT_IN, VEIL_RAG_BODY,
  VEIL_RAG_TONGUE, VEIL_SOFT, VEIL_HEAT,
} from '../src/render/gateVeil.js';
import { createGateVeil, VEIL_CSS, VEIL_OPEN_WAIT_TICKS, VEIL_CUES } from '../src/ui/gateVeil.js';
import { FIRE_CAST_ID } from '../src/world/gateBoss.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WB6c the veil\'s law: closing, the front falls from past the corners to past the centre - by all its raggedness either way, so the screen is clear before and all fire after; shut, the eye breathes; opening, it rises from where it stood past the corners, slowing; the cover follows the front (mutants: the corners never clear; the centre never taken; the opening from the wrong end)', () => {
  const rag = 0.5 * VEIL_RAG_BODY + 0.5 * VEIL_RAG_TONGUE;   // the noise in [0, 1) about its half, both terms
  assert.ok(VEIL_FRONT_OUT - rag - VEIL_SOFT[0] >= 1, 'at its outer end the fire\'s ragged edge is past the corners');
  assert.ok(VEIL_FRONT_IN + rag + VEIL_SOFT[1] <= 0, 'at its inner end the fire covers the very centre');
  assert.match(GATE_VEIL_FS, new RegExp(`float edge = uFront \\+ \\(f1 - 0\\.5\\) \\* ${VEIL_RAG_BODY.toFixed(2).replace('.', '\\.')} \\+ \\(tongue - 0\\.5\\) \\* ${VEIL_RAG_TONGUE.toFixed(2).replace('.', '\\.')};`), 'the shader\'s raggedness is the law\'s');
  let prev = Infinity;
  for (let s = 0; s <= VEIL_CLOSE_S + 1e-9; s += VEIL_CLOSE_S / 40) {
    const v = veilAt('closing', s);
    assert.ok(v.front <= prev + 1e-12, 'closing, never backing off');
    prev = v.front;
  }
  assert.equal(veilAt('closing', 0).front, VEIL_FRONT_OUT);
  assert.equal(veilAt('closing', 0).cover, 0);
  assert.equal(veilAt('closing', VEIL_CLOSE_S).front, VEIL_FRONT_IN);
  assert.equal(veilAt('closing', VEIL_CLOSE_S).cover, 1);
  assert.ok(veilAt('closing', VEIL_CLOSE_S * 0.25).front - VEIL_FRONT_OUT > (VEIL_FRONT_IN - VEIL_FRONT_OUT) * 0.25, 'rushing in, faster as it closes');
  assert.equal(veilAt('closing', VEIL_CLOSE_S * 0.3).heat, 0, 'the eye lights late');
  for (let s = 0; s < 5; s += 0.05) {
    const v = veilAt('shut', s);
    assert.ok(v.front === VEIL_FRONT_IN && v.cover === 1 && v.heat <= VEIL_HEAT + 1e-12 && v.heat >= VEIL_HEAT * 0.7 - 1e-12, 'shut: all fire, the eye breathing');
  }
  prev = -Infinity;
  for (let s = 0; s <= VEIL_OPEN_S + 1e-9; s += VEIL_OPEN_S / 40) {
    const v = veilAt('opening', s);
    assert.ok(v.front >= prev - 1e-12, 'opening, never closing back');
    prev = v.front;
  }
  assert.equal(veilAt('opening', 0).front, VEIL_FRONT_IN);
  assert.equal(veilAt('opening', VEIL_OPEN_S).front, VEIL_FRONT_OUT);
  assert.equal(veilAt('opening', VEIL_OPEN_S).cover, 0);
  assert.equal(veilAt('opening', 0, 0.4).front, 0.4, 'from where it stood');
  assert.ok(veilAt('opening', VEIL_OPEN_S * 0.25).front - VEIL_FRONT_IN > (VEIL_FRONT_OUT - VEIL_FRONT_IN) * 0.4, 'the eye widening fast, slowing as the fire leaves');
  assert.deepEqual(veilAt('idle', 3), { front: VEIL_FRONT_OUT, cover: 0, heat: 0 });
  assert.equal(veilAt('opening', 0, NaN).front, VEIL_FRONT_IN, 'a broken start opens from shut');
});

/** A page: a canvas with a recording GL, a frame clock we step by hand, a clock we set. */
function fakePage({ webgl = true } = {}) {
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, COLOR_BUFFER_BIT: 5, VERTEX_SHADER: 6, FRAGMENT_SHADER: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const canvases = [];
  const doc = {
    body: { appendChild: (c) => { c.inPage = true; } },
    createElement: (tag) => {
      const c = { tag, style: {}, width: 0, height: 0, attrs: {}, inPage: false, setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.inPage = false; }, getContext: (kind, opts) => { c.kind = kind; c.opts = opts; return webgl ? gl : null; } };
      canvases.push(c);
      return c;
    },
  };
  let frames = [];
  const raf = (f) => { frames.push(f); };
  let t = 1000;
  const sounds = [];
  const engine = { soundIndexForId: (id) => (id === FIRE_CAST_ID ? 77 : -1), playOneShot: (...a) => sounds.push(a) };
  const step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); };
  return { doc, raf, now: () => t, engine, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 }, calls, canvases, sounds, step, pending: () => frames.length };
}

test('WB6c the step, on a fake page: the canvas made once, over the world and under the chat, never a pointer; the fire closes (the close\'s sounds) and the promise answers when it has; held shut for the new place\'s first frames, then open (the open\'s sounds) and hidden; its loop runs only while it stands (mutants: the promise before the fire has closed; no hold for the first frames; the loop left running)', async () => {
  const p = fakePage();
  const veil = createGateVeil(p);
  assert.equal(veil.phase, 'idle');
  let shut = null;
  veil.cover().then((ok) => { shut = ok; });
  assert.equal(p.canvases.length, 1, 'a canvas of its own');
  const c = p.canvases[0];
  assert.ok(c.inPage && c.kind === 'webgl2' && c.opts.premultipliedAlpha === true && c.opts.alpha === true);
  assert.ok(c.style.cssText.startsWith(VEIL_CSS) && /z-index:4;/.test(VEIL_CSS) && /pointer-events:none;/.test(VEIL_CSS));
  assert.equal(c.style.display, 'block', 'shown as it closes');
  assert.deepEqual(p.sounds, [[77, VEIL_CUES.close[0].volume, VEIL_CUES.close[0].pitch], [VEIL_CUES.close[1].clip, VEIL_CUES.close[1].volume, VEIL_CUES.close[1].pitch]], 'the fire\'s roar and the deep wind');
  assert.equal(veil.phase, 'closing');
  for (let i = 0; i < 60; i++) { p.step(16); await Promise.resolve(); }   // 0.96 s
  assert.equal(shut, null, 'not before the fire has closed');
  for (let i = 0; i < 20; i++) { p.step(16); await Promise.resolve(); }
  assert.equal(shut, true, 'answered once it has');
  assert.equal(veil.phase, 'shut');
  assert.equal(c.width, 1280, 'half the page\'s pixels, at its device ratio');
  assert.equal(c.height, 720);
  p.sounds.length = 0;
  veil.reveal();
  for (let i = 0; i < VEIL_OPEN_WAIT_TICKS - 1; i++) { p.step(400); assert.equal(veil.phase, 'shut', 'held shut for the new place\'s first frames, however long they take'); }
  p.step(16);
  assert.equal(veil.phase, 'opening');
  assert.deepEqual(p.sounds.map((s) => s[0]), [VEIL_CUES.open[0].clip, VEIL_CUES.open[1].clip], 'the thunder and the fire');
  for (let i = 0; i < 120 && veil.phase !== 'idle'; i++) p.step(16);
  assert.equal(veil.phase, 'idle');
  assert.equal(c.style.display, 'none', 'hidden when it is done');
  assert.equal(p.pending(), 0, 'and its loop stopped');
  // a second step: the same canvas
  veil.cover();
  assert.equal(p.canvases.length, 1, 'made once');
  const draws = p.calls.filter((k) => k[0] === 'drawArrays');
  assert.ok(draws.length > 50, 'one triangle a tick');
});

test('WB6c asked again mid-way: to close while it opens, it closes from where it stands (no jump); to open while it closes, it opens from where it stands and the closing\'s promise answers false; the force\'s flash is the fire at once, then open; shut past VEIL_HOLD_MAX_S it opens on whatever stands; no WebGL2, the step goes on unveiled (mutants: the re-close from the edge; the watchdog dropped)', async () => {
  const p = fakePage();
  const veil = createGateVeil(p);
  veil.cover();
  for (let i = 0; i < 90; i++) p.step(16);
  veil.reveal();
  for (let i = 0; i < VEIL_OPEN_WAIT_TICKS + 30; i++) p.step(16);
  assert.equal(veil.phase, 'opening');
  const frontAt = () => { const u = p.calls.filter((k) => k[0] === 'uniform1f' && k[1] === 'uFront'); return u[u.length - 1][2]; };
  const before = frontAt();
  veil.cover();
  p.step(0);
  assert.ok(Math.abs(frontAt() - before) < 0.02, `closed again from where it stood: ${before} -> ${frontAt()}`);
  assert.equal(veil.phase, 'closing');
  // open while it closes
  let answer = null;
  veil.cover().then((ok) => { answer = ok; });
  veil.reveal();
  await Promise.resolve();
  assert.equal(answer, false, 'it never shut');
  assert.equal(veil.phase, 'opening');
  for (let i = 0; i < 200 && veil.phase !== 'idle'; i++) p.step(16);
  // the flash
  veil.flash();
  assert.equal(veil.phase, 'shut', 'the fire at once');
  for (let i = 0; i < VEIL_OPEN_WAIT_TICKS; i++) p.step(16);
  assert.equal(veil.phase, 'opening', 'then open');
  for (let i = 0; i < 200 && veil.phase !== 'idle'; i++) p.step(16);
  // the watchdog
  veil.cover();
  for (let i = 0; i < 100; i++) p.step(16);
  assert.equal(veil.phase, 'shut');
  p.step(VEIL_HOLD_MAX_S * 1000 + 1);
  assert.equal(veil.phase, 'opening', 'a build that never answered: open on what stands');
  // no WebGL2
  const q = fakePage({ webgl: false });
  const bare = createGateVeil(q);
  assert.equal(await bare.cover(), false, 'no veil: answered at once');
  assert.equal(bare.phase, 'idle');
  assert.ok(!q.canvases[0].inPage, 'the canvas it could not use taken away');
  assert.doesNotThrow(() => { bare.reveal(); bare.flash(); });
  assert.equal(await bare.cover(), false, 'and never tried again');
  assert.equal(q.canvases.length, 1);
});

test('WB6c the seams, by source: the gate\'s door closes the fire before the world is left and opens it on the court; the way home is through the fire too, and offers no wagon (it waits in Tamriel); one step at a time; a forced exit clears the exit it defers; the world host makes the veil online, hands it to the mode machine, and flashes it when the court is taken by force - come apart, offline, a death cast out (mutants: each seam removed)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /async function stepThroughFire\(go\) \{\n\s+const veil = host\.gateVeil\?\.\(\) \?\? null;\n\s+if \(_stepping\) return false;\n\s+_stepping = true;\n\s+try \{\n\s+if \(veil\) await veil\.cover\(\);\n\s+return await go\(\);\n\s+\} finally \{\n\s+_stepping = false;\n\s+veil\?\.reveal\(\);\n\s+\}\n\s+\}/);
  assert.match(wm, /return stepThroughFire\(async \(\) => \{\n\s+if \(mode !== 'exterior' \|\| !\(playerEntity\.health > 0\)\) return false;/, 'the door: through the fire, the world checked again after it has closed (AUDIT WB B3: and the player alive)');
  // WBX2: the way home is ONE door - the bridge's membrane and the portal where he fell both take gateWayHome, through the fire
  assert.match(wm, /function gateWayHome\(\) \{\n\s+if \(mode !== 'dungeon' \|\| !isGateArena\(dungeonLoc\)\) return false;\n\s+stepThroughFire\(async \(\) => \{ if \(mode === 'dungeon' && isGateArena\(dungeonLoc\) && aliveUnder\(\)\) pendingDungeonExit = true; return true; \}\);/, 'through the fire, never walked by the dead (AUDIT WB B2)');
  const exit = wm.indexOf("\n    if (isGateArena(dungeonLoc)) { gateWayHome(); return true; }");
  const wagon = wm.indexOf("if (hasCart(playerEntity.items ?? []) && getBool('GUI', 'DungeonExitWagonPrompt')) {");
  assert.ok(exit > 0 && exit < wagon, 'the way home through the fire, before the wagon\'s prompt');
  // the exit it defers never outlives a forced exit (a death, a collapse or a load overtaking it)
  assert.match(wm, /pendingDungeonWagonOpen = false;   \/\/ DISC21-B: nor a loaded or teleported player's next dungeon's\n\s+\}\n\s+pendingDungeonExit = false;/);
  const w = src('src/scenes/world.js');
  assert.match(w, /const gateVeil = gateOmen \? createGateVeil\(\) : null;/);
  assert.match(w, /\n    gateVeil: \(\) => gateVeil,/);
  assert.match(w, /function ejectFromCourt\(words\) \{\n\s+const g = modes\?\.gateArenaGate\?\.\(\) \?\? null;\n\s+if \(!g\) return;\n(?:\s*\/\/[^\n]*\n)*\s+if \(!\(playerEntity\.health > 0\) \|\| modes\?\.deathUp\?\.\(\)\) \{ respawnOnlinePlayer\(\); return; \}\n\s+gateVeil\?\.flash\(\);/, 'come apart in fire (AUDIT WB B1: the dead cast out by the death\'s own door, which flashes it too)');
  assert.match(w, /if \(landBeforeGate\(courtGate\)\) \{ gateVeil\?\.flash\(\); townTalk\.showOverlay/);
});
