// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 11.2, 25.2-25.6 and
// layer two's last tells): THE SPIRE'S LOOK AS LAW AND ITS PASSES (world/eliteGates/egLook.js; render/eliteGates/egLinePass.js, egMistPass.js,
// egSkyPass.js; render/gate/gateTelegraph.js TELEGRAPH_FS_SPIRE). THE EDGE LINE on every rim and open side and never a walled
// floor or a moving piece; the tracks under a Rail's whole travel; the Gust's streamers only from the breath's rise through
// the gust; the mist's sheets stopping 0.3 m under their landing; the line's shader - its gold at its luminance, never
// pulsing, a track dashed, a streamer under three beats a second, THE FOG FLOOR within 30 m and the world's fog past it;
// the stair; the skies (the Spire's underside smaller each band) and their shader; the danger palettes, the fill and the
// style bit through the Spire's telegraph stage (the gate's own stage unchanged); THE QUIET COMPANY; and THE LAB CHECK -
// the danger edge, the haven, the place's white and the band's own light told apart at 10 m and 30 m of each band's fog,
// in colour, in grey and under deuteranopia, protanopia and tritanopia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import {
  egCircleEdges, egGustSections, egStreamersAt, egMistSheets, egMistSheetsAt, buildEgLookModel, egStairOf, egSkyOf, egEdgeLinePx, egEdgeLineColor, egPaletteBits,
  egQuietCompany, egFogKept, egSeen, egThroughFog, egDeltaE, egLab, EG_EDGE_LINE, EG_LINE_KIND, EG_TRACK, EG_STREAMERS, EG_MIST, EG_STAIR, EG_SKIES,
  EG_LOOK_BIT, EG_FOG_FLOOR, EG_LAB, EG_WAYSTONE,
} from '../../../src/world/eliteGates/egLook.js';
import { EG_LINE_FS, egLineVertices, EG_LINE_FLOATS } from '../../../src/render/eliteGates/egLinePass.js';
import { EG_MIST_FS } from '../../../src/render/eliteGates/egMistPass.js';
import { EG_SKY_PAINT_FS } from '../../../src/render/eliteGates/egSkyMap.js';   // PIN MOVED (EG-LOOK): the sky painted, a painter a band
import { TELEGRAPH_FS, TELEGRAPH_FS_SPIRE, TELEGRAPH_KIND, TELEGRAPH_EDGE_DAGON, TELEGRAPH_EDGE_SAFE, TELEGRAPH_POOL, TELEGRAPH_POOL_HAVEN, spireTelegraphFs } from '../../../src/render/gate/gateTelegraph.js';
import { egCircleSpecs, egBandOfCircle, EG_BRINK_HALLS } from '../../../src/net/eliteGates/egLaw.js';
import { egToDungeon, egIsleDisc, EG_HALL_FOG } from '../../../src/world/eliteGates/egHall.js';
import { SD_ISLAND_SIDES } from '../../../src/world/superDungeon/sdRealm.js';
import { breathSeen } from '../../../src/world/superDungeon/sdSteps.js';
import { egMistAt } from '../../../src/net/eliteGates/egFragLaw.js';
import { egLookShapes, fillStamp } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_BAND_ARCHIVES } from '../../../src/world/eliteGates/pseudoArchives.js';
import { EG_ATMOS } from '../../../src/world/eliteGates/egAtmos.js';   // EG-LOOK: each band's own air
// MERGED WITH EG-G1: the palettes and the fill are the shelf's (ui/eliteGates/egAccess.js) - one home, read here
import { EG_DANGER_PALETTES, egPaletteOf, egFillOf } from '../../../src/ui/eliteGates/egAccess.js';

/** The Spire's haze (world/eliteGates/egHall.js EG_HALL_FOG - exponential) and a thick one, the floor's own stress. */
const EG_HALL_FOG_DENSITY = EG_HALL_FOG.density;
const segs = (f) => { const out = []; for (let i = 0; i < f.length; i += 6) out.push([[f[i], f[i + 1], f[i + 2]], [f[i + 3], f[i + 4], f[i + 5]]]); return out; };
const lumLin = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('EG-G2 THE EDGE LINE (section 25.3): every plate\'s, island\'s and court\'s rim on the drawn rim\'s own 48 sides, every bridge\'s, walkway\'s and lane\'s two sides; never a passage\'s walled floor, a Falling Wall\'s or a Collapsing Tube\'s moving segments or Grath\'s falling isles; two pixels, three on a phone, its gold at 0.38 display luminance; THE TRACKS under a Rail\'s and a Drum\'s whole travel (mutants: a rim on fewer sides; a cave\'s floor lined; a track short of the travel)', () => {
  let tracked = 0, walked = 0;
  for (const c of [1, 2, 3, 6, 8, 11, 16, 18]) {
    const specs = egCircleSpecs(7, c, 0), e = egCircleEdges(7, c, 0), edge = segs(e.edge), track = segs(e.track);
    for (const spec of specs) {
      for (const d of spec.discs) {
        const on = edge.filter(([a]) => Math.abs(Math.hypot(a[0] - egToDungeon(spec, d.x, 0, d.z)[0], a[2] - egToDungeon(spec, d.x, 0, d.z)[2]) - d.r) < 1e-3 && Math.abs(a[1] - (d.y ?? 0) - EG_EDGE_LINE.lift) < 1e-3);
        if (egIsleDisc(spec, d)) assert.ok(on.length < SD_ISLAND_SIDES, 'Grath\'s isles carry none');
        else assert.ok(on.length >= SD_ISLAND_SIDES, `hall ${spec.h} ${d.role}: its rim on every side`);
      }
      for (const b of spec.bands) {
        const x = egToDungeon(spec, b.x + b.halfW, 0, b.z0)[0], hit = edge.some(([a, q]) => Math.abs(a[0] - x) < 1e-3 && Math.abs(a[2] - egToDungeon(spec, 0, 0, b.z0)[2]) < 1e-3 && Math.abs(q[2] - egToDungeon(spec, 0, 0, b.z1)[2]) < 1e-3);
        const lined = b.role !== 'cave' && b.role !== 'tube' && !(spec.variant === 'fallingwall' && b.role === 'walk');
        assert.equal(hit, lined, `hall ${spec.h} ${b.role}: ${lined ? 'lined' : 'never lined'}`);
        if (b.role === 'walk' && lined) walked++;
      }
      for (const s of spec.steps.filter((q) => (q.kind === 'rail' || q.kind === 'drum') && q.amp > 0)) {
        const z0 = egToDungeon(spec, 0, 0, s.z - s.amp - s.d / 2)[2], z1 = egToDungeon(spec, 0, 0, s.z + s.amp + s.d / 2)[2];
        const mine = track.filter(([a, q]) => Math.abs(a[2] - z0) < 1e-3 && Math.abs(q[2] - z1) < 1e-3);
        assert.equal(mine.length, 2, `a ${s.kind}'s track under both its sides`);
        assert.ok(mine.every(([a]) => Math.abs(a[1] - (s.y - EG_TRACK.under)) < 1e-3), 'under its deck');
        tracked++;
      }
    }
  }
  assert.ok(tracked >= 2 && walked >= 1, `${tracked} tracks, ${walked} walkways lined`);
  assert.equal(egEdgeLinePx(1080), 2); assert.equal(egEdgeLinePx(1440), 2); assert.equal(egEdgeLinePx(720), 3); assert.equal(egEdgeLinePx(640), 3);
  assert.ok(Math.abs(lumLin(egEdgeLineColor()) - 0.38) < 1e-9 && EG_EDGE_LINE.luma >= 0.3 && EG_EDGE_LINE.luma <= 0.45, 'its luminance in 0.3-0.45');
});

test('EG-G2 THE LAST TELLS (layer two\'s "still owed"): the Gust\'s streamers blow the way the breath will, from its rise through the gust and never between, inside their section; the waystones lit - a post beside each walkway\'s waystone, off the walk, its cap the edge line\'s gold, in the band\'s dress (mutants: streamers between gusts; a streamer blowing the wrong way; a waystone on the walk)', () => {
  let found = null;
  for (let c = 6; c <= 20 && !found; c++) { const sec = egGustSections(egCircleSpecs(12345, c, 0)); if (sec.length) found = { c, sec }; }
  assert.ok(found, 'a circle with a Gust');
  const out = new Float32Array(EG_STREAMERS.n * 6 * found.sec.length + 12), al = new Float32Array(out.length / 6);
  let blew = 0, quiet = 0;
  for (let t = 0; t < 30; t += 0.05) {
    const b = breathSeen(t, { dir: 0, k: 0 }), n = egStreamersAt(found.sec, t, out, al);
    if (!b.dir) { assert.equal(n, 0, 'no streamer between gusts'); quiet++; continue; }
    assert.equal(n, EG_STREAMERS.n * found.sec.length);
    blew++;
    for (let i = 0; i < n; i++) {
      const g = found.sec[Math.floor(i / EG_STREAMERS.n)], A = [out[i * 6], out[i * 6 + 1], out[i * 6 + 2]], B = [out[i * 6 + 3], out[i * 6 + 4], out[i * 6 + 5]];
      const za = egToDungeon(g.spec, 0, 0, g.z0)[2], zb = egToDungeon(g.spec, 0, 0, g.z1)[2];
      assert.ok(A[2] >= Math.min(za, zb) - 1e-6 && A[2] <= Math.max(za, zb) + 1e-6, 'inside its section');
      const dx = egToDungeon(g.spec, 1, 0, 0)[0] - egToDungeon(g.spec, 0, 0, 0)[0];
      assert.ok(Math.sign((B[0] - A[0]) * dx) === b.dir, 'blowing the breath\'s way');
      assert.ok(al[i] >= 0 && al[i] <= 1);
    }
  }
  assert.ok(blew > 10 && quiet > 10);
  // the waystones
  let ways = 0;
  for (const c of [1, 3, 6]) {
    const m = buildEgLookModel(7, c, 0), specs = egCircleSpecs(7, c, 0), stones = specs.flatMap((s) => (s.waystones ?? []).map((w) => ({ s, w })));
    if (!stones.length) { assert.equal(m, null); continue; }
    assert.ok(m.subMeshes.every((sm) => sm.textureArchive === EG_BAND_ARCHIVES[egBandOfCircle(c)]));
    assert.ok(m.subMeshes.some((sm) => sm.textureRecord === 32), 'its gold cap');
    for (const { s, w } of stones) {
      const walkEdge = egToDungeon(s, w.x + s.walk.halfW, 0, w.z)[0], post = egToDungeon(s, w.x + s.walk.halfW + EG_WAYSTONE.off + EG_WAYSTONE.side / 2, 0, w.z);
      let near = false;
      for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i + 2] - post[2]) < 0.4 && Math.abs(m.positions[i] - post[0]) < 0.4) near = true;
      assert.ok(near, 'a post at its waystone');
      for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i + 2] - w.z - (post[2] - w.z)) < 0.3) assert.ok(Math.abs(m.positions[i] - post[0]) <= EG_WAYSTONE.cap, 'off the walk');
      assert.ok(Math.abs(post[0] - walkEdge) > EG_WAYSTONE.off, 'beside the walkway\'s edge');
      ways++;
    }
  }
  assert.ok(ways >= 3, `${ways} waystones lit`);
});

test('EG-G2 THE MIST, DRAWN (section 11.2; layer three\'s "the mist is not drawn"): each Mist Stair\'s and Sinking Stair\'s surge a sheet over what it covers, rising with the law\'s own line and stopping EG_MIST.below under the landing it serves, none while it lies low; its shader drifting, posterized and fogged (mutants: the sheet past its cap; drawn while the mist lies low)', () => {
  let sheets = [];
  for (const seed of [1, 2, 3, 4, 5, 7]) for (let c = 6; c <= 10 && !sheets.length; c++) sheets = egMistSheets(egCircleSpecs(seed, c, 0));
  assert.ok(sheets.length, 'a circle with a mist');
  const m = sheets[0];
  assert.ok(m.x1 > m.x0 && m.z1 > m.z0);
  let risen = 0, low = 0;
  for (let t = 0; t < 30; t += 0.1) {
    const line = egMistAt(m.hz, t), at = egMistSheetsAt([m], t);
    if (!(line > 0.05)) { assert.equal(at.length, 0); low++; continue; }
    const top = at[0].y - egToDungeon(m.spec, 0, m.hz.y, 0)[1];
    assert.ok(top <= EG_MIST.rise - EG_MIST.below + 1e-9, `0.3 m under its landing (${top.toFixed(2)})`);
    assert.ok(Math.abs(top - Math.min(line, EG_MIST.rise - EG_MIST.below)) < 1e-9, 'the law\'s own line');
    risen++;
  }
  assert.ok(risen > 5 && low > 5);
  const f = glslFunctions(EG_MIST_FS, { vWorld: [3, 0, 4], vQ: [0.5, 0.5], uColor: [0.5, 0.5, 0.58], uAlpha: 1, uTime: 2, uSteps: 10, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], gl_FragCoord: [5, 6, 0, 1], o: [0, 0, 0, 0] });
  f.main();
  assert.ok(f.globals.o[3] > 0.5 && f.globals.o[3] <= 1, 'it hides what lies under it');
  const edge = glslFunctions(EG_MIST_FS, { vWorld: [3, 0, 4], vQ: [0.0, 0.5], uColor: [0.5, 0.5, 0.58], uAlpha: 1, uTime: 2, uSteps: 10, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], gl_FragCoord: [5, 6, 0, 1], o: [0, 0, 0, 0] });
  assert.throws(() => edge.main(), GlslDiscard, 'its rim feathered to nothing');
});

test('EG-G2 THE LINES\' SHADER (sections 25.3 and 25.6): the edge line its gold, opaque and never pulsing; a track dashed EG_TRACK.dash on and off; a streamer white, throbbing under three beats a second; within 30 m every line keeps at least 0.85 of its colour through the fog, past 34 m the world\'s fog alone - the same numbers as egFogKept; the vertices six a segment, kind and alpha on each (mutants: the edge pulsing; the floor dropped; the dash off)', () => {
  const frag = (kind, along, d, t = 0, density = 0.06) => {
    const f = glslFunctions(EG_LINE_FS, { vWorld: [0, 0, d], vAlong: along, vKind: kind, vAlpha: 1, uGold: egEdgeLineColor(), uWhite: [0.95, 0.95, 1], uFogColor: [0, 0, 0], uFogFloor: [EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease], uTime: t, uFogMode: 2, uFogDensity: density, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], o: [0, 0, 0, 0] });
    try { f.main(); return [...f.globals.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
  };
  const g = egEdgeLineColor();
  const e0 = frag(EG_LINE_KIND.edge, 0.3, 1, 0, 0), e1 = frag(EG_LINE_KIND.edge, 0.3, 1, 0.37, 0);
  assert.deepEqual(e0, e1, 'never pulsing');
  assert.ok(Math.abs(e0[0] - g[0]) < 1e-9 && e0[3] === 1, 'its gold, opaque');
  for (const d of [5, 20, 29.9]) { const o = frag(EG_LINE_KIND.edge, 0, d); const k = o[1] / g[1]; assert.ok(k >= EG_FOG_FLOOR.floor - 1e-9, `${d} m: kept ${k.toFixed(3)}`); assert.ok(Math.abs(k - egFogKept(Math.exp(-0.06 * d), d)) < 1e-6, 'egFogKept\'s number'); }
  const far = frag(EG_LINE_KIND.edge, 0, 40), kf = far[1] / g[1];
  assert.ok(Math.abs(kf - Math.exp(-0.06 * 40)) < 1e-6, 'past the floor\'s reach: the world\'s fog');
  assert.ok(Math.abs(egFogKept(0.1, 32) - Math.max(0.1, 0.85 * 0.5)) < 1e-9, 'eased over its four metres');
  const dash = [];
  for (let s = 0; s < 2 * EG_TRACK.dash; s += 0.05) dash.push(frag(EG_LINE_KIND.track, s + 0.001, 1, 0, 0) !== null);
  assert.equal(dash.filter(Boolean).length, dash.length / 2, 'a track: half on, half off');
  assert.ok(dash[0] && !dash.at(-1));
  const s0 = frag(EG_LINE_KIND.streamer, 0, 1, 0, 0), s1 = frag(EG_LINE_KIND.streamer, 0, 1, 0.25, 0);
  assert.ok(s0[2] > s0[0] * 0.99 && s0[0] > 0.6, 'a streamer white');
  assert.notDeepEqual(s0, s1, 'a streamer throbs');
  assert.match(EG_LINE_FS, /cos\(6\.283185307179586 \* 2\.0 \* uTime\)/, 'two beats a second - under WCAG\'s three');
  const v = egLineVertices(new Float32Array([0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), EG_LINE_KIND.track, new Float32Array([0.5, 1]));
  assert.equal(v.length, 2 * 6 * EG_LINE_FLOATS);
  assert.deepEqual([...v.subarray(0, EG_LINE_FLOATS)], [0, 0, 0, 1, 2, 3, -1, 0, EG_LINE_KIND.track, 0.5]);
  assert.deepEqual([...v.subarray(6 * EG_LINE_FLOATS + 6, 6 * EG_LINE_FLOATS + 10)], [-1, 0, EG_LINE_KIND.track, 1]);
});

test('EG-G2 THE STAIR AND THE SKIES (section 7; EG16\'s "the Spire\'s underside in every sky, smaller each band"): the full fall at each band\'s first hall, the veil elsewhere, a plain cut under reduced motion; the dither 0.8 s; each band\'s sky its own and the underside smaller each band; the sky\'s painters\' void overhead (EG-LOOK, PIN MOVED: the underside the wreck\'s model, never painted), the deep below the horizon lit, the Shade\'s moon (mutants: the fall every hall; the underside growing; the deep unlit)', () => {
  assert.deepEqual([...EG_STAIR.bandFirst], [1, ...EG_BRINK_HALLS]);
  assert.equal(egStairOf(1), 'fall'); assert.equal(egStairOf(26), 'fall'); assert.equal(egStairOf(2), 'veil'); assert.equal(egStairOf(27), 'veil');
  assert.equal(egStairOf(26, true), 'cut'); assert.equal(egStairOf(2, true), 'cut');
  assert.equal(EG_STAIR.dither, 0.8);
  for (let i = 1; i < 4; i++) assert.ok(EG_SKIES[i].underside < EG_SKIES[i - 1].underside, `band ${i}: smaller`);
  assert.equal(egSkyOf(1), EG_SKIES[0]); assert.equal(egSkyOf(6), EG_SKIES[1]); assert.equal(egSkyOf(16), EG_SKIES[3]);
  // PIN MOVED (EG-LOOK, Elite-Gates-Look.md sections 4 and 6): the sky is painted a band at a time (render/eliteGates/egSkyMap.js) and
  // the Spire's underside is the wreck's model at EG_SKIES' size, never painted (one underside, never two) - so the zenith
  // is the band's void (its own test: test/render/eliteGates/eglook_sky.test.js), the deep below lit, the Shade's moon on its key's bearing
  const sky = (band, ray) => { const n = Math.hypot(...ray), f = glslFunctions(EG_SKY_PAINT_FS[band], { uTime: 3 }); const t = f.skyAt(ray.map((v) => v / n), [3, 4]); return [t[0], t[1], t[2]]; };
  for (let b = 0; b < 4; b++) {
    const zen = sky(b, [0, 1, 0.05]), deep = Math.max(...Array.from({ length: 24 }, (_, k) => lumLin(sky(b, [Math.sin(k * 0.26), -0.6, Math.cos(k * 0.26)]))));   // the realm's light somewhere below
    if (b !== 2) assert.ok(deep > lumLin(zen) + 0.05, `band ${b}: the deep lit below`);
    assert.ok(zen.every(Number.isFinite) && lumLin(zen) < 0.04, `band ${b}: the void overhead`);
  }
  const moon = sky(2, [-0.55, 0.3, 0.7]);
  assert.ok(lumLin(moon) > 0.15, 'the Shade\'s moon');
});

test('EG-G2 THE SPIRE\'S TELEGRAPH (sections 25.6 and 25.7): the gate\'s own stage the same text, the Spire\'s made from it with every needle found; THE FOG FLOOR keeps a shape 0.85 within 30 m (the gate\'s fades it); the fill at the shelf\'s opacity, the line never thinned; the high-contrast palette\'s double keyline outside the first and its hatch through the fill (mutants: the floor dropped; the fill thinning the line; the hatch on every shape)', () => {
  assert.ok(TELEGRAPH_FS_SPIRE !== TELEGRAPH_FS && TELEGRAPH_FS_SPIRE.startsWith(TELEGRAPH_FS.slice(0, 200)));
  assert.throws(() => spireTelegraphFs(TELEGRAPH_FS.replace('uniform vec3 uCamPos;', 'uniform vec3 uCam;')), /lost/, 'a needle the gate\'s stage lost is said');
  const disc = { kind: TELEGRAPH_KIND.disc, origin: [0, 0], r: 4 };
  const frag = (src, p, extra = {}, fw = 0.04) => {
    const fns = glslFunctions(src, {
      uKind: disc.kind, uOrigin: disc.origin, uYaw: 0, uR: disc.r, uHalfArc: 0, uBody: 0, uEnd: [0, 0], uHalfW: 0, uR0: 0, uR1: 0, uPts: Array.from({ length: 10 }, () => [0, 0]), uCount: 0,
      uT: 0.6, uFlash: 0, uAlpha: 1, uColor: [1, 0.4, 0.1], uEdgeCol: [...TELEGRAPH_EDGE_DAGON], uCourt: [0, 0], uFloorR: 40, uStyle: 0, uSince: 1, uSpan: 2, uAfter: -1, uPool: 0, uRunS: 0, uLineW: 1,
      uFogMode: 2, uFogDensity: 0.06, uFogRange: [0, 1], uCamPos: [0, 20, 20], uFocus: [0, 0, 0, 0], uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0],
      uFogFloor: [0, 0, 1], uFillK: 1, uLook: 0, vCourt: p, vWorld: [p[0], 0.05, p[1]], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => fw) : fw), ...extra,
    });
    try { fns.main(); return [...fns.globals.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
  };
  const sum = (o) => (o ? o[0] + o[1] + o[2] : 0);
  const inside = [1, 0], line = [4, 0];
  const gate = frag(TELEGRAPH_FS, inside), plain = frag(TELEGRAPH_FS_SPIRE, inside);
  assert.ok(Math.abs(sum(gate) - sum(plain)) < 1e-9, 'with nothing set the Spire\'s draws the gate\'s');
  const kept = frag(TELEGRAPH_FS_SPIRE, inside, { uFogFloor: [0.85, 30, 4] });
  assert.ok(sum(kept) / sum(plain) > 0.85 / Math.exp(-0.06 * Math.hypot(1, 19.95, 20)) * 0.99, 'kept 0.85 within 30 m');
  const far = frag(TELEGRAPH_FS_SPIRE, inside, { uFogFloor: [0.85, 30, 4], uCamPos: [0, 40, 40] }), farGate = frag(TELEGRAPH_FS_SPIRE, inside, { uCamPos: [0, 40, 40] });
  assert.ok(Math.abs(sum(far) - sum(farGate)) < 1e-9, 'past its reach, the world\'s fog');
  const half = frag(TELEGRAPH_FS_SPIRE, inside, { uFillK: 0.5 }), lineFull = frag(TELEGRAPH_FS_SPIRE, line), lineHalf = frag(TELEGRAPH_FS_SPIRE, line, { uFillK: 0.5 });
  assert.ok(sum(half) < sum(plain) * 0.6 && sum(half) > sum(plain) * 0.4, 'the fill at half');
  assert.ok(sum(lineHalf) > sum(lineFull) * 0.9, 'the line never thinned');
  const outside = [4.45, 0];
  const key1 = frag(TELEGRAPH_FS_SPIRE, outside, { uFogMode: 0 }), key2 = frag(TELEGRAPH_FS_SPIRE, outside, { uFogMode: 0, uLook: EG_LOOK_BIT.keyline2 });
  assert.ok(key2[3] > key1[3] + 0.2, 'a second dark keyline outside the first');
  const hatched = [];
  for (let x = -2; x <= 2; x += 0.1) hatched.push(sum(frag(TELEGRAPH_FS_SPIRE, [x, 0.3], { uLook: EG_LOOK_BIT.hatch })));
  const plainRow = [];
  for (let x = -2; x <= 2; x += 0.1) plainRow.push(sum(frag(TELEGRAPH_FS_SPIRE, [x, 0.3])));
  assert.ok(Math.max(...hatched) - Math.min(...hatched) > (Math.max(...plainRow) - Math.min(...plainRow)) + 0.05, 'the hatch\'s stripes through the fill');
  // THE HAVEN GRAMMAR (section 25.5): gold and lit - never the darkened floor burning ground is - its chevrons flowing in, a dark keyline outside
  const gold = [1.0, 0.82, 0.38], H = (p, extra = {}) => frag(TELEGRAPH_FS_SPIRE, p, { uPool: TELEGRAPH_POOL_HAVEN, uColor: gold, uEdgeCol: gold, uFogMode: 0, ...extra });
  const burn = frag(TELEGRAPH_FS_SPIRE, [1, 0], { uPool: TELEGRAPH_POOL.ground, uColor: gold, uFogMode: 0 }), hv = H([1, 0]);
  assert.ok(sum(hv) > sum(burn) && hv[3] < burn[3], 'lit where burning ground is darkened');
  const ray = []; for (let r = 0.2; r < 3.8; r += 0.1) ray.push(sum(H([r, 0])));
  assert.ok(Math.max(...ray) > Math.min(...ray) * 1.5, 'chevrons along its radius');
  const later = []; for (let r = 0.2; r < 3.8; r += 0.1) later.push(sum(H([r, 0], { uSince: 1.3 })));
  assert.notDeepEqual(ray, later, 'flowing');
  assert.ok(H([4.15, 0])[3] > 0.3 && sum(H([4.15, 0])) < sum(H([4.0, 0])), 'a dark keyline outside its line');
});

test('EG-G2 THE DANGER PALETTES, THE FILL AND THE QUIET COMPANY (sections 25.4 and 25.7): four palettes by the shelf\'s word (Standard the SPIRE DANGER EDGE itself), anything unknown Standard; the fill clamped to 50-100%; laid on a frame\'s shapes - the danger edge the palette\'s and its bits, a shape aimed at another member filled at 0.55 in a trial and mine with a brighter rim, a haven the palette\'s safety, the place\'s white the palette\'s hazard, every one THE FOG FLOOR; the quiet company\'s numbers in a trial and on a plate (mutants: the quiet share outside a trial; mine not brightened)', () => {
  assert.deepEqual(Object.keys(EG_DANGER_PALETTES), ['standard', 'contrast', 'deutan', 'tritan']);
  assert.deepEqual(Object.values(EG_DANGER_PALETTES).map((P) => P.name), ['Standard', 'High contrast', 'Deutan-Protan', 'Tritan']);
  assert.deepEqual([...EG_DANGER_PALETTES.standard.danger], [...TELEGRAPH_EDGE_DAGON], 'THE SPIRE DANGER EDGE');
  assert.deepEqual([...EG_DANGER_PALETTES.contrast.danger], [1.0, 0.15, 0.75], 'magenta');
  assert.equal(egPaletteBits(EG_DANGER_PALETTES.contrast), EG_LOOK_BIT.keyline2 | EG_LOOK_BIT.hatch, 'High contrast: the double keyline and the hatch');
  assert.equal(egPaletteBits(EG_DANGER_PALETTES.standard), 0);
  assert.equal(egPaletteOf('nonsense'), EG_DANGER_PALETTES.standard, 'anything unknown Standard');
  assert.deepEqual([egFillOf(undefined), egFillOf(0.2), egFillOf(0.75), egFillOf(5), egFillOf('x')], [1, 0.5, 0.75, 1, 1], 'the fill clamped to 50-100%');
  const acc = (o = {}) => ({ palette: EG_DANGER_PALETTES.standard, fill: 1, ...o });
  const T = egQuietCompany('trial', false), P = egQuietCompany('rest', false);
  assert.deepEqual([T.auras, T.allyAlpha, T.allyGlow, T.allyNumbers, T.vestigeRing, T.aimedOther, T.watchfireM], [0, 0.6, 0, false, 0.6, 0.55, 12]);
  assert.equal(egQuietCompany('trial', true).allyNumbers, true, 'Full keeps the numbers');
  assert.deepEqual([P.auras, P.allyAlpha, P.aimedOther], [1, 1, 1], 'back on the plates and at the rests');
  const mk = (o) => ({ kind: 1, origin: [0, 0], r: 3, color: [1, 0.4, 0.1], edge: TELEGRAPH_EDGE_DAGON, pool: TELEGRAPH_POOL.blow, mine: false, fillK: 1, look: 0, fogFloor: null, ...o });
  const other = mk({}), mine = mk({ mine: true }), haven = mk({ edge: TELEGRAPH_EDGE_SAFE, color: [1.0, 0.82, 0.38], pool: TELEGRAPH_POOL.ground }), white = mk({ color: [0.95, 0.95, 1.0], pool: TELEGRAPH_POOL.ground });
  egLookShapes([other, mine, haven, white], acc({ palette: EG_DANGER_PALETTES.contrast, fill: 0.8 }), 'trial');
  assert.deepEqual([...other.edge], [...EG_DANGER_PALETTES.contrast.danger], 'the line whole at any fill'); assert.equal(other.look, egPaletteBits(EG_DANGER_PALETTES.contrast));
  assert.ok(Math.abs(other.fillK - 0.8 * 0.55) < 1e-9, 'aimed at another: the quiet share of the shelf\'s fill');
  assert.equal(mine.fillK, 0.8); assert.ok(mine.edge.every((v, i) => v >= EG_DANGER_PALETTES.contrast.danger[i]) && mine.edge[1] > EG_DANGER_PALETTES.contrast.danger[1], 'mine brighter');
  assert.deepEqual([...haven.edge], [...EG_DANGER_PALETTES.contrast.safety]); assert.deepEqual([...haven.color], [...EG_DANGER_PALETTES.contrast.safety], 'safety never danger, never dimmed'); assert.equal(haven.look, 0); assert.equal(haven.pool, TELEGRAPH_POOL_HAVEN, 'THE HAVEN GRAMMAR');
  assert.deepEqual([...white.color], [...EG_DANGER_PALETTES.contrast.hazard]);
  assert.ok([other, mine, haven, white].every((s) => s.fogFloor[0] === EG_FOG_FLOOR.floor && s.fogFloor[1] === EG_FOG_FLOOR.within));
  const calm = mk({}); egLookShapes([calm], acc(), 'closing');
  assert.equal(calm.fillK, 1, 'outside a trial, no quiet share');
  const sh = { points: [], origin: [0, 0], end: [0, 0] }; assert.ok(fillStamp(sh, ['d', 1, 2, 3]) && sh.r === 3);
  // the fight's pass is the Spire's stage, never the gate's
  // PIN MOVED (SHADER-STALL, render/glProgram.js compiledPass): built through the door once the Spire's program is done
  assert.match(readFileSync(new URL('../../../src/scenes/eliteGates/egFight.js', import.meta.url), 'utf8'), /compiledPass\(gl, telegraphPrograms\(true\), \(\) => new GateTelegraphRenderer\(gl, \{ spire: true \}\)/);
});

test('EG-G2 THE LAB CHECK (section 25.2): the danger edge against the magma and against a burning pool, a haven against a danger fill, the place\'s white against solid gold and against the gone - each pair told apart (CIE ΔE at least 12) at 10 m and 30 m of every band\'s fog, in colour, and under deuteranopia, protanopia and tritanopia with the palette meant for it; in ?grey the white against the danger edge by luminance alone; the colour-blind presets separate under their own simulation where the Standard\'s red against gold would not (mutants: the deutan preset\'s safety moved onto its edge; the floor dropped from the fog)', () => {
  const magma = [1.0, 0.47, 0.12], pool = [0.45, 0.18, 0.06], fill = [0.4, 0.08, 0.06], gone = [0.01, 0.01, 0.012];
  // PIN MOVED (EG-LOOK, Elite-Gates-Look.md section 7): each band's own fog, its colour at its own density (world/eliteGates/egAtmos.js),
  // then the old stresses at the Galleries' - [colour, density]
  const fogs = [...EG_ATMOS.map((a) => [a.fog.color, a.fog.density]), ...[[0.16, 0.15, 0.22], [0.03, 0.032, 0.05], [0.3, 0.07, 0.02]].map((c) => [c, EG_HALL_FOG_DENSITY])];
  const pairs = (P) => [['edge/magma', P.danger, magma], ['edge/pool', P.danger, pool], ['haven/fill', P.safety, fill], ['white/gold', P.hazard, P.safety], ['white/gone', P.hazard, gone]];
  const views = { standard: [null], contrast: [null], deutan: ['deutan', 'protan'], tritan: ['tritan'] };
  for (const [name, hows] of Object.entries(views)) {
    const P = EG_DANGER_PALETTES[name];
    for (const [fog, rho] of fogs) for (const d of [10, 30]) for (const how of hows) for (const [what, a, b] of pairs(P)) {
      if (name === 'standard' && what === 'edge/magma') continue;   // the Standard's: THE SPIRE DANGER EDGE against the Hour's magma is the next check's
      const A = egSeen(egThroughFog(a, d, rho, fog, true), how), B = egSeen(egThroughFog(b, d, rho, fog, true), how);
      assert.ok(egDeltaE(A, B) >= EG_LAB.deltaE, `${name} ${how ?? 'colour'} ${what} at ${d} m in fog ${fog}: ΔE ${egDeltaE(A, B).toFixed(1)}`);
    }
  }
  // the Standard: the crimson edge against the molten orange the Galleries\' and the Wellhead's magma wears, in colour
  for (const [fog, rho] of [fogs[0], fogs[3]]) for (const d of [10, 30]) assert.ok(egDeltaE(egThroughFog(EG_DANGER_PALETTES.standard.danger, d, rho, fog, true), egThroughFog(magma, d, rho, fog, true)) >= EG_LAB.deltaE, 'crimson is never the magma\'s orange');   // the Galleries' fog and the Wellhead's
  // ?grey: the place's white against the danger edge by luminance alone
  const [shade, shadeRho] = fogs[2];   // the Shade's near-black
  for (const d of [10, 30]) { const a = egLab(egSeen(egThroughFog(EG_DANGER_PALETTES.standard.hazard, d, shadeRho, shade, true), 'grey')), b = egLab(egSeen(egThroughFog(EG_DANGER_PALETTES.standard.danger, d, shadeRho, shade, true), 'grey')); assert.ok(Math.abs(a[0] - b[0]) >= EG_LAB.greyL, `grey at ${d} m`); }
  // the presets earn their place: under deuteranopia the Standard's haven against its edge reads closer than the deutan preset's
  const std = EG_DANGER_PALETTES.standard, du = EG_DANGER_PALETTES.deutan;
  assert.ok(egDeltaE(egSeen(du.safety, 'deutan'), egSeen(du.danger, 'deutan')) > egDeltaE(egSeen(std.safety, 'deutan'), egSeen(std.danger, 'deutan')) + 10, 'the deutan preset separates where the Standard does not');
  // the floor matters: without it, the Shade's fog at 30 m brings the white and the gone together
  const noFloor = egDeltaE(egThroughFog(std.hazard, 30, 0.08, shade, false), egThroughFog(gone, 30, 0.08, shade, false)), floor = egDeltaE(egThroughFog(std.hazard, 30, 0.08, shade, true), egThroughFog(gone, 30, 0.08, shade, true));
  assert.ok(floor > noFloor * 2, `the fog floor keeps the read: ${floor.toFixed(1)} against ${noFloor.toFixed(1)}`);
});
