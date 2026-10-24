// FIELD BUGS 2026-10-13e AOE-PERF - THE BOSS'S CIRCLES AND THE CROWD'S SPRITES, MEASURED ON A REAL GL.
//
// HellRay (Discord, "Performance issues with boss AoE attacks circles and player sprites"): "massive FPS drops when the
// boss performs AoE attacks and circles appear on the ground ... Player sprites also cause severe performance drops,
// especially when more than 10 players are gathered in one area." The record: bible/07-Rendering/Performance-Rig.md
// AOE-PERF.
//
// This runs the real renderer in Chromium (SwiftShader - software GL, whose time grows with the fragments and vertices
// it shades, so it MEASURES overdraw; it is not a GPU, and its milliseconds are only relative) on scenes that need no
// ARENA2:
//   1. THE BURNING COURT at a fighter's eye - its own mesh and art (world/gate/gateArena.js buildCourtModel, gateArt.js), lit
//      and fogged as the court is, on the enhanced lighting lane - with the boss's real shapes from their real producers
//      (render/gate/gateTelegraph.js telegraphShape, poolShapes, markShape; scenes/gate/gateHost.js hostShapes): each blow alone,
//      the mark, the burning ground, his host, and whole AoE frames of them, a pass a shape in their order as the court
//      draws them - and, with `--before <module>` (a copy of render/gate/gateTelegraph.js as it stood before AOE-PERF), as
//      that module drew them, in the same rounds.
//   2. THE LOOK (with `--before`) - his mark, his host and the AoE frames drawn both ways on the classic lane (straight
//      onto the canvas) and read back whole, against a CONTROL: the old pass against itself with the camera moved a
//      millimetre (its quads' corners land elsewhere on the pixel grid - what moving a quad's corners does, every frame
//      the camera or he moves). JUDGED: no more texels apart by more than 3/255 than twice the control's (and 16).
//   3. THE CROWD - 0 / 8 / 12 / 24 / 40 players standing near: the Morrowind lane's bodies through the one sprite batch
//      (renderer.js beginCharacterSpriteBatch; the committed 3D horse stands in for a body - the same skinned pass, the
//      same picture and quad - since a Morrowind person needs the player's own Data Files), at most BODIES_MAX of them as
//      net/peer/peerBodies.js stands them, every peer past the cap as their Eye Of The Beholder walker (net/peer/peerRiders.js
//      createPeerWalkers - the vendored art: the classic sprite lane a peer's walker takes, one billboard a peer, as the
//      class sprite and the paperdoll are); and that sprite lane alone, every peer a walker.
// THE CLOCK: the GL is synced (a 1x1 readPixels of the bound frame - gl.finish does not wait on SwiftShader in this
// Chromium) before and after the part a case draws - the telegraph pass, or the players - and that span is the case's
// time. Cases run in ROUNDS - every case once a round, FRAMES rounds after a warm one - and each case's median is taken,
// so a machine whose load moves (other work on its cores) moves every case alike. THE COUNT, which no load moves: the
// fragments each case rasterises for the telegraph (every quad it lays, projected through the frame's own lens and
// clipped to the screen - its pixels), and the GL draws.
//
// Usage: node tools/fb1013ePerfProbe.mjs [--w 960] [--h 540] [--frames 3] [--lane on|off] [--only court|crowd]
//          [--before src/render/<a copy of gateTelegraph.js as it stood before, 3f66ff064's>.js]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const W = Number(arg('w', 960)), H = Number(arg('h', 540)), FRAMES = Number(arg('frames', 3)), LANE = arg('lane', 'on') !== 'off', ONLY = arg('only', '');
const BEFORE = arg('before', null);
const PORT = 5251;

const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[probe]')) console.log(t); });
const fails = [];
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails.push(label); };

try {
  await page.goto(`http://localhost:${PORT}/mw-inspect.html`);
  const out = await page.evaluate(async ({ W, H, FRAMES, LANE, ONLY, BEFORE }) => {
    const [{ Renderer, WORLD_FRAME }, m, el, ga, gart, gt, gb, gh, hr, pr, dl, old] = await Promise.all([
      import('/src/render/renderer.js'), import('/src/world/mat4.js'), import('/src/render/enhancedLighting.js'), import('/src/world/gate/gateArena.js'),
      import('/src/world/gate/gateArt.js'), import('/src/render/gate/gateTelegraph.js'), import('/src/net/gate/gateBrain.js'), import('/src/scenes/gate/gateHost.js'),
      import('/src/world/horseRig.js'), import('/src/net/peer/peerRiders.js'), import('/src/render/deadlands.js'), BEFORE ? import(`/${BEFORE}`) : null,
    ]);
    const cv = document.createElement('canvas');
    cv.style.width = `${W}px`; cv.style.height = `${H}px`; cv.width = W; cv.height = H;
    document.body.innerHTML = ''; document.body.append(cv);
    const r = new Renderer(cv);
    const gl = r.gl;
    if (LANE) r.setLightingLane(el.EL_LANE);
    for (const [rec, art] of gart.courtArt()) { r.uploadTexture(ga.COURT_ARCHIVE, rec, art.albedo); r.uploadEmissionTexture?.(ga.COURT_ARCHIVE, rec, art.emission, { white: true }); }
    const court = r.createMesh(ga.buildCourtModel());
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const pass = new gt.GateTelegraphRenderer(gl);
    const passOld = old ? new old.GateTelegraphRenderer(gl) : null;
    const C = gb.COURT_CENTRE;
    // A FIGHTER'S EYE: eight metres south of him (he stands at the court's heart) - the third-person camera over the
    // shoulder (the Morrowind body's: 2.6 m up, 3.5 m back, looking at his chest) and the first-person eye (1.62 m)
    const lens = m.mirrorProjectionX(m.perspective(60 * Math.PI / 180, W / H, 0.05, 500));
    const eyes = {
      third: { eye: [C[0], C[1] + 2.6, C[2] + 11.5], at: [C[0], C[1] + 1.6, C[2]] },
      first: { eye: [C[0], C[1] + 1.62, C[2] + 8], at: [C[0], C[1] + 1.2, C[2]] },
    };
    for (const e of Object.values(eyes)) e.view = m.lookAt(e.eye, e.at, [0, 1, 0]);
    const cl = dl.courtLighting(null);
    const fogNow = () => ({ mode: r._fogMode, density: r._fogDensity, range: r._fogRange, color: r._fogColor, camPos: r._camPos });
    /** the bound frame read back, one texel - every command before it done (gl.finish is no wait here) */
    const sync = () => {
      const fmt = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT), type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
      const buf = type === gl.FLOAT ? new Float32Array(4) : type === gl.HALF_FLOAT ? new Uint16Array(4) : type === gl.UNSIGNED_INT || type === gl.INT ? new Uint32Array(4) : new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, fmt, type, buf);
    };
    const frameAt = (cam, draw, lane = LANE) => {
      const t0 = performance.now();
      r.setLightingLane(lane ? el.EL_LANE : null);
      const fog = el.dungeonFog(lane, ga.COURT_FOG);
      r.setLighting(new Float32Array(cl.tri.equator), 0, undefined, lane ? cl.tri : null);
      r.setMoonlight?.(cl.key);
      const lit = ga.withCourtLights({ data: new Float32Array(0), colors: new Float32Array(0) }, ga.courtLightsNear(cam.eye).slice(0, 8));   // the eight nearest braziers
      r.setPointLights(lit.data, null, lit.colors);
      if (fog) r.setFog(fog.mode, fog.density, fog.start ?? 0, fog.end ?? 0, new Float32Array(fog.color));
      r.setClearColor([0.05, 0.01, 0.01, 1]);
      r.beginFrame(lens, cam.view, new Float32Array([0.2, -0.9, 0.3]), WORLD_FRAME);
      r.drawMesh(court, I, null);
      sync();
      const t1 = performance.now();
      const extra = draw({ proj: lens, view: cam.view, eye: new Float32Array(cam.eye) }) | 0;
      const t2 = performance.now();
      sync();
      const t3 = performance.now();
      r.resolveFrame?.();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      return { ms: t3 - t1, cpu: t2 - t1, frame: performance.now() - t0, draws: r.stats.draws + extra, tdraws: extra };
    };
    const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    /** every case once a round, FRAMES rounds after a warm one; each case's median */
    const rounds = (label, cases) => {
      const runs = cases.map(() => []);
      for (let k = -1; k < FRAMES; k++) {
        const t = performance.now();
        cases.forEach((c, i) => { const x = frameAt(c.cam, c.draw); if (k >= 0) runs[i].push(x); });
        console.log(`[probe] ${label}: round ${k < 0 ? 'warm' : k + 1}/${FRAMES} (${((performance.now() - t) / 1000).toFixed(1)} s)`);
      }
      return cases.map((c, i) => ({ ...c.row, ms: median(runs[i].map((x) => x.ms)), frame: median(runs[i].map((x) => x.frame)), cpu: median(runs[i].map((x) => x.cpu)), draws: runs[i][runs[i].length - 1].draws, tdraws: runs[i][runs[i].length - 1].tdraws }));
    };
    // THE COUNT: a quad over the court frame (its corners [x, z]) at the pass's lift, projected and clipped - its pixels
    const pv = new Float32Array(16);
    const polyPx = (pts, vp) => {
      const corner = ([x, z]) => { const p = [C[0] + x, C[1] + gt.TELEGRAPH_LIFT, C[2] + z, 1]; return [0, 1, 2, 3].map((row) => vp[row] * p[0] + vp[4 + row] * p[1] + vp[8 + row] * p[2] + vp[12 + row] * p[3]); };
      let poly = pts.map(corner);
      for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1]]) {   // w+x, w-x, w+y, w-y, w+z >= 0
        const d = (v) => v[3] + sg * v[ax];
        const next = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length], da = d(a), db = d(b);
          if (da >= 0) next.push(a);
          if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); next.push(a.map((v, j) => v + (b[j] - v) * t)); }
        }
        poly = next;
        if (!poly.length) return 0;
      }
      const s = poly.map((v) => [(v[0] / v[3] * 0.5 + 0.5) * W, (v[1] / v[3] * 0.5 + 0.5) * H]);
      let a = 0; for (let i = 0; i < s.length; i++) { const p = s[i], n = s[(i + 1) % s.length]; a += p[0] * n[1] - n[0] * p[1]; }
      return Math.abs(a) / 2;
    };
    const courtsOf = (sh) => (Number.isInteger(sh.court) && sh.court >= 0 ? [sh.court] : gb.COURTS.map((_, k) => k));
    /** the quads module `mod`'s pass lays for `shapes` - each shape's over each court it is drawn over: its box
     *  (telegraphQuadOver), or (AOE-PERF) a path's own strip (telegraphStrip, where the module has it) */
    const shapesPx = (mod, shapes, vp) => shapes.reduce((a, sh) => a + (sh.alpha > 0.001 ? courtsOf(sh).reduce((b, k) => {
      const q = mod.telegraphQuadOver(sh, k);
      if (!q) return b;
      const st = mod.telegraphStrip?.(sh);
      if (!st) return b + polyPx([[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]], vp);
      const n = [st.u[1], -st.u[0]], e = [st.a[0] + st.u[0] * st.len, st.a[1] + st.u[1] * st.len];
      return b + polyPx([[st.a[0] - n[0] * st.w, st.a[1] - n[1] * st.w], [e[0] - n[0] * st.w, e[1] - n[1] * st.w], [e[0] + n[0] * st.w, e[1] + n[1] * st.w], [st.a[0] + n[0] * st.w, st.a[1] + n[1] * st.w]], vp);
    }, 0) : 0), 0);
    const results = { court: [], crowd: [], look: [], err: 0 };

    // THE BOSS'S SHAPES, from their producers: his attack 60% through its wind-up, the fighters about him
    const P = gb.BASE_PROFILE;
    const now = 1_000_000;
    const fighters = [[3, 8], [-6, 6], [8, -2], [-9, -5], [1, -11], [12, 6], [-13, 2], [5, 14], [-4, -15], [10, -10]];
    const atkOf = (key, phase, over = {}) => { const A = gb.ATTACKS[key]; const w = gb.windupOf(A, phase); return { i: 1, a: A.id, at: now + w * 0.4, x: 0, z: 0, yw: 0, tg: [], ...over }; };
    const blow = (key, phase, over) => gt.telegraphShape(atkOf(key, phase, over), phase, now, P);
    const mark = (() => { const s = gt.markShape([0, 0], 0, [1, 0.5, 0.1], P.bossR); s.court = 0; return s; })();
    const poolsAt = (pts, rad) => pts.map(([x, z]) => ({ x, z, r: rad, from: now - 2000, until: now + 4000 }));
    const pools = [...gt.poolShapes(poolsAt(fighters, gb.POOLS.hellfire.r), now, [1, 0.4, 0.1]), ...gt.poolShapes(poolsAt(fighters.slice(0, 3).map(([x, z]) => [x * 0.7, z * 0.7]), gb.POOLS.meteor.r), now, [1, 0.4, 0.1])];
    // his host (the Legion-Lord's trial): bites and pulses in flight, the bearers' tethers while his ward stands, the Sappers' paths
    const ads = [
      { i: 1, k: gb.HOST.harrier, x: 4, z: 7, yaw: 0, atk: { at: now + 300, x: 4, z: 7 } },
      { i: 2, k: gb.HOST.harrier, x: -7, z: 4, yaw: 0, atk: { at: now + 400, x: -7, z: 4 } },
      { i: 3, k: gb.HOST.bearer, x: 9, z: -6, yaw: 0, atk: { at: now + 500, x: 9, z: -6 } },
      { i: 4, k: gb.HOST.bearer, x: -10, z: -8, yaw: 0, atk: { at: now + 600, x: -10, z: -8 } },
      { i: 5, k: gb.HOST.sapper, x: 15, z: 10, yaw: 0, mv: { x: 15, z: 10, tx: 0, tz: 0, v: 2, at: now - 500 } },
      { i: 6, k: gb.HOST.sapper, x: -16, z: 9, yaw: 0, mv: { x: -16, z: 9, tx: 0, tz: 0, v: 2, at: now - 500 } },
    ];
    const host = gh.hostShapes({ x: 0, z: 0, yaw: 0, atk: null, fell: false, wrath: null, shieldUntil: now + 5000, lg: { ads } }, now, P, []).map((s) => ({ ...s, origin: [...s.origin], end: [...s.end] }));
    const sets = [
      ['his mark', [mark]],
      ['Ground Slam', [blow('slam', 1)]],
      ['Hellfire (10, phase 3)', [blow('hellfire', 3, { tg: fighters })]],
      ['Flame Nova', [blow('nova', 2)]],
      ['Spokes of Dagon', [blow('spokes', 3)]],
      ["Dagon's Wrath", [blow('wrath', 3)]],
      [`burning ground (${pools.length} groups)`, pools],
      [`his host (${host.length} shapes)`, host],
      ['AoE: mark + Hellfire(5) + ground', [...pools, mark, blow('hellfire', 2, { tg: fighters.slice(0, 5) })]],
      ['AoE: mark + Nova + ground + host', [...pools, mark, blow('nova', 2), ...host]],
      ['AoE: mark + Spokes + ground + host', [...pools, mark, blow('spokes', 3), ...host]],
    ];
    /** the shapes drawn as the court draws them - a pass each, in their order (scenes/gate/gateCourt.js drawPass) */
    const drawWith = (p, shapes) => ({ proj, view, eye }) => {
      let n = 0;
      const f = fogNow();
      for (const s of shapes) { p.draw(s, proj, view, eye, 3.5, f, C, null); n += p.drawn; }
      if (shapes.length) r.markForeignPass();
      return n;
    };

    if (ONLY !== 'crowd') {
      for (const [camName, cam] of Object.entries(eyes)) {
        m.multiply(lens, cam.view, pv);
        const list = camName === 'third' ? sets : sets.filter(([name]) => name.startsWith('AoE'));
        const cases = [{ cam, draw: () => 0, row: { cam: camName, name: 'none', how: 'now', shapes: 0, px: 0, passes: 0 } }];
        for (const [name, shapes] of list) {
          if (passOld) cases.push({ cam, draw: drawWith(passOld, shapes), row: { cam: camName, name, how: 'before', shapes: shapes.length, px: shapesPx(old, shapes, pv) } });
          cases.push({ cam, draw: drawWith(pass, shapes), row: { cam: camName, name, how: 'now', shapes: shapes.length, px: shapesPx(gt, shapes, pv) } });
        }
        results.court.push(...rounds(`court, ${camName}-person eye`, cases));
      }
      // THE LOOK, on the classic lane (the canvas itself, 8 bits a channel, no image of the frame's own between)
      const frameImage = (cam, draw) => {
        frameAt(cam, draw, false);
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px;
      };
      // THE CONTROL: the old pass against itself, its camera moved a millimetre - the quad's corners land elsewhere on the
      // pixel grid, which is all that moving them does: a texel on a hard edge (the chevron's, a dash's end, a lane's
      // side) can flip, and a smooth ramp move a unit or two
      const cam = eyes.third, nudged = { eye: [cam.eye[0] + 0.001, cam.eye[1], cam.eye[2]], at: [cam.at[0] + 0.001, cam.at[1], cam.at[2]] };
      nudged.view = m.lookAt(nudged.eye, nudged.at, [0, 1, 0]);
      const apart = (a, b) => { let n = 0, big = 0, maxd = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 0) n++; if (d > 3) big++; if (d > maxd) maxd = d; } return { n, big, maxd }; };
      const none = frameImage(cam, () => 0);
      for (const [name, shapes] of passOld ? sets.filter(([n]) => n.startsWith('AoE') || n.startsWith('his')) : []) {
        const now = frameImage(cam, drawWith(pass, shapes)), was = frameImage(cam, drawWith(passOld, shapes)), wasNudged = frameImage(nudged, drawWith(passOld, shapes));
        let lit = 0;
        for (let i = 0; i < now.length; i += 4) if (Math.abs(now[i] - none[i]) + Math.abs(now[i + 1] - none[i + 1]) + Math.abs(now[i + 2] - none[i + 2]) > 6) lit++;
        results.look.push({ name, shapes: shapes.length, lit, d: apart(now, was), control: apart(wasNudged, was) });
      }
    }

    if (ONLY !== 'court') {
      // THE CROWD - the 3D horse rig (a real skinned body through the same sprite batch) for the Morrowind lane's bodies,
      // the vendored Eye Of The Beholder walkers for every peer past the cap
      const rig = hr.horseRigFor(r);
      await rig.load();
      if (!rig.ready()) return { error: rig.failure() ?? 'the horse rig did not load' };
      for (let i = 0; i < 64 && rig.kept().length < 1; i++) rig.tick();
      const walkers = pr.createPeerWalkers({ renderer: r });
      const N_MAX = 40, BODIES_MAX = 8;
      const spots = Array.from({ length: N_MAX }, (_, i) => { const a = i * 2.39996, d = 3 + (i % 10) * 1.3; return [Math.sin(a) * d * 0.8, 0, -Math.abs(Math.cos(a)) * d - 1]; });
      const horses = Array.from({ length: BODIES_MAX }, (_, i) => rig.horse(i + 1));
      const peerOf = (i) => ({ id: `p${i}`, look: { eo: i % 4 }, shown: { x: spots[i][0] + C[0], y: C[1], z: spots[i][2] + C[2] + 8, yw: (i * 0.7) % 6.28, mv: 0, wd: 0, an: 0, ar: 0, cn: 0 } });
      const toScene = (p) => [p.x, p.y, p.z];
      const cam = eyes.third;
      const right = [1, 0, 0];
      const all = Array.from({ length: N_MAX }, (_, i) => peerOf(i));
      for (let k = 0; k < 400; k++) {   // the walkers' art lands
        walkers.sync(all, toScene, { eye: cam.eye, right, dt: 0 });
        if (all.every((p) => walkers.isWalking(p.id))) break;
        await new Promise((res) => setTimeout(res, 25));
      }
      results.walking = all.filter((p) => walkers.isWalking(p.id)).length;
      results.horseCorners = horses[0]?.mesh?.count ?? null;
      const cases = [];
      for (const [lane, cap] of [['Morrowind bodies (cap 8) + walkers past it', BODIES_MAX], ['walkers only (the sprite lane)', 0]]) {
        for (const n of [0, 8, 12, 24, 40]) {
          const bodies = Math.min(n, cap), peers = all.slice(bodies, n);
          cases.push({ cam, row: { lane, n, bodies, sprites: n - bodies }, draw: ({ proj, view, eye }) => {
            r.beginCharacterSpriteBatch();
            try {
              for (let i = 0; i < bodies; i++) { const h = horses[i]; rig.step(h, { feet: [spots[i][0] + C[0], C[1], spots[i][2] + C[2] + 8], yaw: i * 0.8, speed: 0, dt: 1 / 60, look: 0 }); rig.draw(h, cv, { proj, view, eye }); }
            } finally { r.flushCharacterSpriteBatch(); }
            walkers.sync(peers, toScene, { eye, right, dt: 1 / 60 });
            const bb = walkers.batches();
            if (bb.length) r.drawBillboards(bb, right, [0, 1, 0]);
            return 0;
          } });
        }
      }
      results.crowd.push(...rounds('crowd', cases));
    }
    results.err = gl.getError();
    return results;
  }, { W, H, FRAMES, LANE, ONLY, BEFORE });
  if (out.error) throw new Error(out.error);
  const f = (x, d = 1) => Number(x).toFixed(d).padStart(7);
  console.log(`\nAOE-PERF probe - ${W}x${H} (${(W * H / 1e6).toFixed(2)} Mpx), SwiftShader, lane ${LANE ? 'on' : 'off'}, median of ${FRAMES} synced rounds`);
  for (const camName of ['third', 'first']) {
    const rows = out.court.filter((x) => x.cam === camName);
    if (!rows.length) continue;
    console.log(`\nTHE COURT, ${camName}-person eye          shapes   telegraph draws   its fragments, Mpx (x frame)   its ms (cpu)   frame ms`);
    for (const x of rows) console.log(`  ${x.name.padEnd(36)} ${String(x.shapes).padStart(3)}  ${x.how.padEnd(7)} ${String(x.tdraws).padStart(4)}       ${f(x.px / 1e6, 2)} (${(x.px / (W * H)).toFixed(2)}x)        ${f(x.ms)} (${x.cpu.toFixed(2)})  ${f(x.frame)}`);
  }
  if (out.crowd.length) {
    console.log(`\nTHE CROWD, third-person eye (${out.walking} of 40 walkers' art up; a body ${out.horseCorners} corners)    their ms (cpu)   draws   frame ms`);
    for (const lane of [...new Set(out.crowd.map((x) => x.lane))]) {
      console.log(`  ${lane}`);
      for (const x of out.crowd.filter((y) => y.lane === lane)) console.log(`    ${String(x.n).padStart(2)} players (${x.bodies} bodies, ${String(x.sprites).padStart(2)} sprites)          ${f(x.ms)} (${x.cpu.toFixed(2)})   ${String(x.draws).padStart(5)}  ${f(x.frame)}`);
    }
  }
  if (out.look.length) console.log('\nTHE LOOK (classic lane, the canvas read back whole)');
  for (const x of out.look) {
    // no more texels flipped than moving the old quad's corners a millimetre flips
    check(x.lit > 1000 && x.d.big <= 2 * x.control.big + 16, `${x.name}: drawn now against before - ${x.d.n} texels apart (${x.d.big} by more than 3/255, at most ${x.d.maxd}); the old pass against itself a millimetre over: ${x.control.n} (${x.control.big}, at most ${x.control.maxd}); ${x.lit} texels lit`);
  }
  check(out.err === 0, `no GL error (${out.err})`);
} catch (e) {
  check(false, String(e?.message ?? e));
} finally {
  if (crashes.length) check(false, `page errors: ${crashes.join(' | ')}`);
  await browser.close();
  await server.close();
}
process.exit(fails.length ? 1 : 0);
