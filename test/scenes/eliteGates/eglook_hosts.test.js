// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 25, 26 and 28 - THE
// FOUR HOSTS): THE LOOK AND THE SOUND WIRED. The look's screen half (scenes/eliteGates/egLookDraw.js): a circle's edges, gusts and
// mists made once a circle, nothing drawn and nothing thrown with no GL, every pass released. The breach client
// (scenes/eliteGates/egClient.js): the mist under the fight's pass and the lines over it, the sky in the host's sky slot, THE SCORE's
// view of the breach, THE QUIET COMPANY's auras, the look freed on every way out. The world host (scenes/world.js): the
// Spire's sky beside the fight's pass, the auras quiet in a trial, the music handed to the fight for THE SPIRE MIX. The
// dungeon arm (scenes/worldModes.js): the Spire's sky where the Hour's stood, the waystones' mesh among the draws. The lab
// (spire.html, src/tools/spireLab.js) registered with Vite and probed frame-synced (tools/spireLabProbe.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgLookDraw } from '../../../src/scenes/eliteGates/egLookDraw.js';
import { egCircleEdges, egGustSections, egMistSheets } from '../../../src/world/eliteGates/egLook.js';
import { egCircleSpecs, egBandOfCircle } from '../../../src/net/eliteGates/egLaw.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('EG-G2 THE LOOK\'S SCREEN HALF (scenes/eliteGates/egLookDraw.js): a circle told once - its edges, its tracks, its Gust sections and its mists counted as the law makes them, its band - again only for another circle; with no GL nothing is drawn and nothing thrown; released, every pass and the circle let go (mutants: the circle re-made every frame; a draw with no circle)', () => {
  const L = createEgLookDraw({ gl: null });
  assert.equal(L.drawSky(null, null, 0), false, 'no circle: nothing');
  assert.equal(L.setCircle(12345, 6, 0), true);
  assert.equal(L.setCircle(12345, 6, 0), false, 'the same circle: nothing re-made');
  const e = egCircleEdges(12345, 6, 0), specs = egCircleSpecs(12345, 6, 0), st = L.state();
  assert.deepEqual({ ...st, passes: undefined }, { key: '12345:6:0', band: egBandOfCircle(6), edges: e.edge.length / 6, tracks: e.track.length / 6, gusts: egGustSections(specs).length, mists: egMistSheets(specs).length, passes: undefined });
  assert.deepEqual(st.passes, { lines: false, mist: false, sky: false }, 'no GL, no pass');
  assert.equal(L.drawSky([], [], 1), false); assert.equal(L.drawUnder([], [], [0, 0, 0], 1), false); assert.equal(L.drawOver([], [], [0, 0, 0], 1), false);
  assert.equal(L.setCircle(12345, 7, 0), true, 'another circle');
  L.release();
  assert.equal(L.state().key, '');
});

test('EG-G2 THE BREACH CLIENT (scenes/eliteGates/egClient.js): the mist first, the hall\'s fight over it, THE EDGE LINE and the tells last, on the shared clock; the sky in the host\'s sky slot; THE SCORE\'s view - the band, the stage, the hall\'s kind, its lord and phase, THE COUNT while it runs, a set piece, the end, and the context\'s motifs; the auras quiet in a trial; the look freed on every way out (mutants: the lines under the fight; the look kept past the breach)', () => {
  const C = read('src/scenes/eliteGates/egClient.js');
  const at = C.indexOf('    drawPass(proj, view, eye, seconds, fog) {');
  assert.ok(at > 0);
  const body = C.slice(at, C.indexOf('\n    },', at));
  const u = body.indexOf('L?.drawUnder('), f = body.indexOf('fight?.drawPass('), o = body.indexOf('L?.drawOver(');
  assert.ok(u > 0 && f > u && o > f, 'under, the fight, over');
  assert.match(body, /ts = now\(\) \/ 1000/, 'the shared clock');
  assert.match(C, /drawSky\(proj, view, eye, seconds, fog, gain = 1\) \{ return inSpire\(\) \? !!lookCircle\(link\.state\(\)\)\?\.drawSky\(proj, view, seconds, fog, gain\) : false; \}/);
  for (const k of ['band', 'sg: E.sg', 'kind: spec.kind', 'valk: !!lord?.valk', 'phase', 'countLeft: E.ca > 0 ? egCountAt(E, t) : NaN', "set: !!spec.tube || spec.kind === 'brink'", 'sinceWake', 'end: !!E.end']) assert.ok(C.includes(k), `the score's view carries ${k}`);
  assert.match(C, /ctx: \{ band, motif: bandLord\?\.motif \?\? 0, valk: EG_LORDS\[valkKey\]\?\.motif \?\? 3, seed: E\.seed >>> 0 \}/);
  // PIN MOVED (merged with EG-E2's seam - one, not two): the client's `quiet` asks the look's law
  assert.match(C, /quiet: \(\) => inSpire\(\) && egQuietCompany\(link\.state\(\)\?\.sg, true\)\.auras === 0,/);
  assert.ok(!C.includes('quietAuras'), 'one seam for the quiet company');
  assert.match(C, /away\(\) \{ fight\?\.leave\(\); if \(look\) \{ look\.release\(\); look = null; \}/, 'freed when online goes');
  assert.match(C, /if \(look\) \{ look\.release\(\); look = null; \}   \/\/ EG-G2: the look's passes, freed on every way out/, 'freed out of the Spire');
});

test('EG-G2 THE WORLD HOST AND THE DUNGEON ARM (scenes/world.js, scenes/worldModes.js): the Spire\'s sky host beside the fight\'s, in the Spire\'s haze; the auras quiet in a trial; the music handed to the fight; the dungeon arm\'s sky slot the Spire\'s own (the Hour\'s no more); the waystones\' mesh among the circle\'s draws, casting nothing; the world host\'s frame unchanged by any of it (mutants: the Hour\'s sky over the Spire; the auras drawn in a trial)', () => {
  const W = read('src/scenes/world.js');
  assert.match(W, /drawEgSky: \(\{ proj, view, eye \}\) => \{ if \(egClient\?\.drawSky\(proj, view, eye, deadlandsSeconds\(\), courtFogNow\(\), skyGain\(renderer\._fogColor, egHallFog\(modes\?\.egHallCircle\?\.\(\)\)\.color\)\)\) renderer\.markForeignPass\(\); \},/);
  assert.match(W, /function auraFrame\(seen\) \{\n    _auraWearers\.length = 0;\n    if \(!online \|\| travelView\?\.active\) return;\n    if \(egClient\?\.quiet\?\.\(\)\) return;/, 'the auras quiet in a trial - gathered for none, so neither drawn nor lit');
  assert.match(W, /renderer, gl: renderer\.gl, getTexture, uploadRecordFrame, audio, music, link, now: \(\) => \(egClient \? egClient\.sharedNow\(\) : egNow\(\)\)/);   // PIN MOVED (EG-H1, merged): the fight on the breach's corrected clock
  const frameAt = W.indexOf('\n  function frame(now) {\n'), frameEnd = W.indexOf('\n  }\n', frameAt);
  const frame = W.slice(frameAt, frameEnd);
  for (const k of ['_spireScore', 'drawEgSky', 'egScore']) assert.ok(!frame.includes(k), `the host's frame holds no ${k} (PERF-V8)`);
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /if \(isEgHall\(dungeonLoc\)\) host\.drawEgSky\?\.\(\{ proj, view, eye: mwv\.eye \}\);/);
  assert.ok(!/if \(isEgHall\(dungeonLoc\)\) host\.drawSdSky/.test(M), 'the Hour\'s sky no more over the Spire');
  const EC = read('src/scenes/eliteGates/egCircleHost.js');   // PIN MOVED (HOST-SPLIT, EG-LOOK): the circle's own module
  // PIN MOVED (AUDIT EG V, e: L6-9 - a band's dress goes up a record at a time, the swap's worker painting it; once a
  // breach a record, painted here only for a band not whole - egBandRec, egBandWhole)
  assert.match(EC, /if \(egBandWhole\(band\) \|\| !renderer\?\.uploadTexture\) return;\n    try \{ for \(const \[rec, art\] of egBandArt\(band\)\) egBandRec\(band, rec, art\);/, 'a band\'s art painted and uploaded once a session');
  assert.match(EC, /if \(up\.has\(rec\) \|\| !renderer\?\.uploadTexture\) return;\n    _egBands\.add\(band\); up\.add\(rec\);/, 'each record once');
  // EG-H3 (merged): THE SWAP stands a new circle in place - its band's dress and its waystones go up with it
  assert.match(EC, /egBandUp\(r\.c\); _egLookMesh = egLookBuild\(r\.seed >>> 0, r\.c, \(r\.geo \?\? 0\) \| 0\);/);
  assert.match(EC, /gone = new Set\(\[mesh, _egLookMesh, \.\.\.gates\.map/, 'the old circle\'s waystones freed with it');
  assert.match(EC, /if \(_egLookMesh\) ctx\.dynamicDraws\.push\(\{ gpu: _egLookMesh, object: \{ matrix: identity\(\) \}, noShadow: true \}\);/);
});

test('EG-G2 THE LAB AND ITS PROBES (EG16\'s "the lab checks, frame-synced probes"): spire.html registered with Vite and loading src/tools/spireLab.js; the lab counts its frames for the probe and draws the dungeon arm\'s calls in the arm\'s order (the cull before the draws, the sky, the mist, the telegraphs, the lines); tools/spireLabProbe.mjs waits on the frame counter, never a sleep; tools/egScoreProbe.mjs measures the songs through the real player (mutants: the lab unregistered; the probe sleeping)', () => {
  assert.match(read('vite.config.js'), /spire: 'spire\.html',/);
  assert.match(read('spire.html'), /<script type="module" src="\/src\/tools\/spireLab\.js"><\/script>/);
  const L = read('src/tools/spireLab.js');
  assert.match(L, /window\.__frame\+\+;/);
  const order = ['span.cull(proj, view);', 'for (const d of dynamicDraws) if (!d.hidden && !d.culled)', 'look.drawSky(', 'look.drawUnder(', 'telegraph.draw(sh,', 'look.drawOver('].map((k) => L.indexOf(k));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), `the arm's order: ${order.join(', ')}`);
  const P = read('tools/spireLabProbe.mjs');
  assert.match(P, /waitForFunction\(\(\) => \(window\.__frame \?\? 0\) >= 4/);
  assert.ok(!/setTimeout|waitForTimeout/.test(P), 'never a sleep');
  assert.match(read('tools/egScoreProbe.mjs'), /new SongPlayer\(ctx, real\.destination\)/);
});
