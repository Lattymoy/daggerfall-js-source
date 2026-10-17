// TV1 - THE TRAVEL VIEW, IN A REAL BROWSER (bible/06-Systems/Travel-View.md).
//
// The node pins drive the camera's law and the host's machine against fakes. What only a real GL and a real DOM can
// say, this says - on a SYNTHETIC valley (CI has no ARENA2 and never will), through the real renderer:
//
//   1. THE FOG IS THE TRAVELLER'S. From 260 m up in a rain fog (exp 0.003), the ground at the traveller's feet is
//      drawn as the traveller sees it - nearly clear - with the focus set, and fogged as the camera's 330 m of air
//      would fog it without. Read off the pixel under the projected feet against the fog colour.
//   2. THE SUN'S SHADOWS FALL ABOUT THE TRAVELLER. A block beside the feet casts onto the ground under the raised
//      eye with the focus set; without it every cascade stands about a point in the sky and the ground is lit.
//   3. THE FLATS LEAN. A standing sprite seen from 52 degrees down covers more screen rows leaned (the view's up)
//      than upright - and still stands on its own foot.
//   4. THE INPUT IS THE VIEW'S. scenes/travelView.js on a real canvas, real pointer events from the browser: a click
//      is a pick, a drag turns the view and picks nothing, the wheel zooms, and a listener the "host" put on the
//      window's bubble phase hears none of it; the readout's Return button brings the view down. Two screenshots.
//   6. TV4: THE CURTAINS FROM ABOVE. A falling cell's veil 500 m north of the traveller, drawn through the real
//      renderer's frame as the world host draws it (a foreign pass after the world): the picture greys where the veil
//      stands, most through its middle (the chord) and least at its rim, and nothing where it does not.
//   5. TV2: THE PLACES AND THE WAY. A place's plate is drawn on the readout's canvas (PERF-TV) and found where it
//      landed - a click on it is the place's journey (onMark) and never a pick; the route line is drawn as an SVG path
//      through the projected points; the trip's line is in the bar; the travel panel reads "x20 / x40" while the
//      governor holds the clock. TV5: a far place held at the right edge, its plate on the screen, a click its journey.
//   7. EDGE-FURNITURE + AUDIT DEEP2 E1: with the game HUD's own vitals standing (drawEnhancedHud), the Overworld's bar
//      stands clear of them, Return is on top where it is drawn, and a mark off the foot stands over the bar.
//
// Usage: node tools/travelViewProbe.mjs [outDir]   (PNGs land in outDir, default scratch/tv1/)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const OUT = process.argv[2] || 'scratch/tv1';
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(Uint8Array.from(rgba.slice(src, src + w * 4))).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const W = 640, H = 400;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5231/play/');

  // ── 1-3: THE RENDER ─────────────────────────────────────────────────────────────────────────────────────────────
  const r = await page.evaluate(async ({ W, H }) => {
    const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
    const { EL_LANE } = await import('/src/render/enhancedLighting.js');
    const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
    const { eyeFor, leanedUp, rightOf, TV_TILT_DEFAULT } = await import('/src/player/travelCamera.js');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    document.body.appendChild(canvas);
    const rr = new Renderer(canvas);
    const gl = rr.gl;
    const tex = (w, h, f) => { const colors = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const [a, b, c, d] = f(x, y); colors[i] = a; colors[i + 1] = b; colors[i + 2] = c; colors[i + 3] = d; } return { width: w, height: h, colors }; };
    rr.uploadTexture(1, 1, tex(16, 16, () => [200, 200, 200, 255]));          // the ground: flat light grey, so fog and shadow read clean
    rr.uploadTexture(1, 2, tex(16, 16, () => [150, 120, 90, 255]));           // the block
    rr.uploadTexture(210, 1, tex(16, 32, (x, y) => [40, 140, 50, (x > 3 && x < 12) ? 255 : 0]));   // a "tree": a green bar
    const P = [], N = [], UV = [], IDX = [], subs = [];
    const quad = (a, b, c, d, n, s = 1) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, s, 0, s, s, 0, s); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
    const box = (x0, y0, z0, x1, y1, z1) => {
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    };
    const sub = (rec, build) => { const start = IDX.length; build(); subs.push({ textureArchive: 1, textureRecord: rec, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
    sub(1, () => quad([-1500, 0, 1500], [1500, 0, 1500], [1500, 0, -1500], [-1500, 0, -1500], [0, 1, 0], 100));
    sub(2, () => box(6, 0, -4, 14, 12, 4));   // a block 10 m east of the feet: its shadow falls on the ground about them
    const mesh = rr.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    const tree = rr.createBillboardBatch(210, 1, { w: 6, h: 18 }, [[-20, 9, 20]]);   // centres stand at half height, as the world's flats do
    const feet = [0, 0, 0], head = [0, 1.7, 0];
    const yaw = 0, tilt = TV_TILT_DEFAULT, height = 260;
    const { eye, fwd } = eyeFor(feet, yaw, tilt, height);
    const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.2, 6000));
    const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
    const I = identity();
    const project = (p) => { const v = [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14], 1];
      const c = [proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12], proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13], 0, proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15]];
      return [Math.round((c[0] / c[3] * 0.5 + 0.5) * W), Math.round((c[1] / c[3] * 0.5 + 0.5) * H)]; };
    const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const at = (px, [x, y]) => { const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    const FOG = new Float32Array([0.35, 0.4, 0.5]);
    const frame = ({ focus, lane, fog, up = [0, 1, 0], sun = 0.9 }) => {
      rr.setLightingLane(lane ? EL_LANE : null);
      rr.setAir(false);
      rr.setClearColor([0.35, 0.4, 0.5, 1]);
      rr.setLighting(new Float32Array([0.35, 0.35, 0.4]), sun, new Float32Array([1, 0.95, 0.85]));
      if (fog) rr.setFog('exp', 0.003, 0, 0, FOG); else rr.setFog('off', 0, 0, 0, FOG);
      rr.setPointLights(new Float32Array(0), new Float32Array(0));
      let px = null;
      for (let f = 0; f < 4; f++) {   // the shadow maps draw from the last frame's records
        if (focus !== undefined) rr.setFocus(focus);   // undefined: a host that never sets it (an interior, a dungeon)
        rr.beginFrame(proj, view, new Float32Array([0.6, 0.55, 0.2]), WORLD_FRAME);
        rr.drawMesh(mesh, I, null);
        rr.drawBillboards([tree], new Float32Array(rightOf(yaw)), new Float32Array(up));
        rr.resolveFrame();
        px = read();
      }
      return px;
    };
    const feetPx = project(feet);
    // 2. the shadow: the ground just by the block, where the sun throws its shadow; 1. is read off open ground clear of it
    const shadowPt = project([2, 0, -2]);
    const litPt = project([-12, 0, -12]);
    // 1. the fog - read on open ground a few metres from the feet, clear of the block's shadow
    const fogOff = frame({ focus: null, lane: true, fog: true });
    const fogOn = frame({ focus: head, lane: true, fog: true });
    const clear = frame({ focus: head, lane: true, fog: false });
    // AUDIT TV B1: the view's frames, then a host that never sets the focus (a door taken with the view up)
    frame({ focus: head, lane: true, fog: true });
    const fogAfter = frame({ focus: undefined, lane: true, fog: true });
    const shOff = frame({ focus: null, lane: true, fog: false });
    const shOn = frame({ focus: head, lane: true, fog: false });
    // 3. the flats: count the tree's green rows upright and leaned
    const green = (px) => { let rows = 0; let foot = -1; for (let y = 0; y < H; y++) { let hit = false; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (px[i + 1] - px[i] > 35 && px[i + 1] - px[i + 2] > 35) { hit = true; break; } } if (hit) { rows++; if (foot < 0) foot = y; } } return { rows, foot }; };
    const upright = frame({ focus: head, lane: true, fog: false, up: [0, 1, 0] });
    const leaned = frame({ focus: head, lane: true, fog: false, up: leanedUp(yaw, tilt) });
    // 6. TV4: the curtains - the same frame, the pass drawn after the world as the host draws it
    const { RainCurtainsRenderer, curtainsOf } = await import('/src/render/rainCurtains.js');
    const rc = new RainCurtainsRenderer(gl);
    const cells = [{ x: 0, z: 500, r: 250 / 0.55, base: 600, top: 2600, fall: 1, fallKind: 0 }];   // R 250 m, its near face 250 m north - inside the picture's lower half
    const curtains = curtainsOf(cells, { focus: head, eye, ground: 0 });
    const withCurtain = (on, v = view, e = eye) => {
      rr.setLightingLane(EL_LANE); rr.setAir(false); rr.setClearColor([0.35, 0.4, 0.5, 1]);
      rr.setLighting(new Float32Array([0.35, 0.35, 0.4]), 0.9, new Float32Array([1, 0.95, 0.85]));
      rr.setFog('off', 0, 0, 0, FOG);
      rr.setPointLights(new Float32Array(0), new Float32Array(0));
      rr.setFocus(head);
      rr.beginFrame(proj, v, new Float32Array([0.6, 0.55, 0.2]), WORLD_FRAME);
      rr.drawMesh(mesh, I, null);
      if (on) { rc.draw(curtainsOf(cells, { focus: head, eye: e, ground: 0 }), proj, v, e, 1, { light: 0, fog: null }); rr.markForeignPass(); }   // black: the change IS the veil's alpha over the ground
      rr.resolveFrame();
      return read();
    };
    const cOff = withCurtain(false), cOn = withCurtain(true);
    // THE CHORD, read from a level eye 600 m south at 60 m (the view's lowest tilt looks much like it): the picture's
    // middle row crosses the veil from rim to rim against the sky, so along it the veil ends where the line of sight
    // grazes it - dense through its middle, thin at its rims
    const eye2 = [0, 60, -600], view2 = lookAt(eye2, [0, 60, 500], [0, 1, 0]);
    const lOff = withCurtain(false, view2, eye2), lOn = withCurtain(true, view2, eye2);
    const midPx = project([0, 20, 250]), besidePx = project([-420, 0, 150]);
    return {
      feetPx, shadowPt, litPt,
      fog: { off: at(fogOff, litPt), on: at(fogOn, litPt), clear: at(clear, litPt), after: at(fogAfter, litPt), fog: [...FOG].map((v) => Math.round(v * 255)) },
      shadow: { offShadow: at(shOff, shadowPt), offLit: at(shOff, litPt), onShadow: at(shOn, shadowPt), onLit: at(shOn, litPt) },
      tree: { upright: green(upright), leaned: green(leaned) },
      curtain: { row: (() => { const y = Math.round(H / 2); const d = []; for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; d.push(Math.abs(lOn[k] - lOff[k]) + Math.abs(lOn[k + 1] - lOff[k + 1]) + Math.abs(lOn[k + 2] - lOff[k + 2])); } const on = d.map((v, x) => (v > 2 ? x : -1)).filter((x) => x >= 0); const x0 = on[0], x1 = on.at(-1), mid = Math.round((x0 + x1) / 2), w = x1 - x0; return { x0, x1, atMid: d[mid], nearRim: Math.max(d[x0 + Math.round(w * 0.06)], d[x1 - Math.round(w * 0.06)]), prof: Array.from({ length: 11 }, (_, i) => d[x0 + Math.round(w * i / 10)]) }; })(), n: curtains.length, drawn: rc.drawn, midOff: at(cOff, midPx), midOn: at(cOn, midPx), besideOff: at(cOff, besidePx), besideOn: at(cOn, besidePx), midPx },
      shots: { fogOff: Array.from(fogOff), fogOn: Array.from(fogOn), shadowOn: Array.from(shOn), leaned: Array.from(leaned), curtain: Array.from(cOn) },
      glError: gl.getError(),
    };
  }, { W, H });
  for (const [k, px] of Object.entries(r.shots)) writeFileSync(join(OUT, `tv1-${k}.png`), png(W, H, px));
  const lum = (c) => (c[0] + c[1] + c[2]) / 3;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  console.log('feet at', r.feetPx, 'fog', JSON.stringify(r.fog));
  check(r.glError === 0, `no GL error (${r.glError})`);
  check(dist(r.fog.on, r.fog.clear) < dist(r.fog.off, r.fog.clear) / 3, `the ground by the feet is the traveller's clear ground with the focus (${r.fog.on} vs clear ${r.fog.clear}), and fogged by the camera's air without it (${r.fog.off})`);
  check(dist(r.fog.off, r.fog.fog) < dist(r.fog.clear, r.fog.fog), 'without the focus the feet sit deep in the fog - the case the focus exists for');
  check(dist(r.fog.after, r.fog.off) <= 2, `AUDIT TV B1: a host that never sets the focus draws the camera's fog, not the last view's (${r.fog.after} vs ${r.fog.off})`);
  console.log('shadow', JSON.stringify(r.shadow));
  check(lum(r.shadow.onShadow) < lum(r.shadow.onLit) - 12, `with the focus the block's shadow lies on the ground by the feet (${lum(r.shadow.onShadow).toFixed(0)} vs lit ${lum(r.shadow.onLit).toFixed(0)})`);
  check(Math.abs(lum(r.shadow.offShadow) - lum(r.shadow.offLit)) < 8, `without it no cascade reaches the ground from 330 m (${lum(r.shadow.offShadow).toFixed(0)} vs ${lum(r.shadow.offLit).toFixed(0)})`);
  console.log('tree', JSON.stringify(r.tree));
  check(r.tree.leaned.rows > r.tree.upright.rows * 1.25, `the leaned flat stands taller on screen (${r.tree.leaned.rows} rows against ${r.tree.upright.rows})`);
  check(r.tree.upright.rows > 0 && Math.abs(r.tree.leaned.foot - r.tree.upright.foot) <= 2, `and keeps its foot where it stood (row ${r.tree.leaned.foot} against ${r.tree.upright.foot})`);
  console.log('curtain', JSON.stringify(r.curtain));
  const cd = (a, b) => dist(a, b);
  check(r.curtain.n === 1 && r.curtain.drawn === 1, `TV4: the falling cell is one curtain, drawn (${r.curtain.n}/${r.curtain.drawn})`);
  check(cd(r.curtain.midOn, r.curtain.midOff) > 20, `TV4: the veil greys the picture through its middle (${r.curtain.midOff} -> ${r.curtain.midOn})`);
  check(r.curtain.row.atMid > r.curtain.row.nearRim * 1.5, `TV4: denser through its middle than near its rim, across its row - the chord (${r.curtain.row.atMid} against ${r.curtain.row.nearRim}, the veil ${r.curtain.row.x0}..${r.curtain.row.x1})`);
  check(cd(r.curtain.besideOn, r.curtain.besideOff) < 2, `TV4: and nothing where it does not stand (${r.curtain.besideOff} -> ${r.curtain.besideOn})`);

  // ── 4: THE INPUT ────────────────────────────────────────────────────────────────────────────────────────────────
  const page2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page2.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page2.goto('http://localhost:5231/play/');
  await page2.evaluate(async () => {
    const { createTravelView } = await import('/src/scenes/travelView.js');
    const hud = await import('/src/ui/travel/travelViewHud.js');
    const { forwardOf } = await import('/src/player/travelCamera.js');
    document.body.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#223';
    document.body.append(canvas);
    // AUDIT DEEP2 E1: the game HUD's own vitals stand, as they do under the view in the game
    const { drawEnhancedHud } = await import('/src/ui/enhanced/enhancedHud.js');
    const vitals = { health: 96, maxHealth: 118, fatigue: 104 * 64, maxFatigue: 120 * 64, magicka: 40, maxMagicka: 80, currentBreath: 0 };
    for (let i = 0; i < 3; i++) drawEnhancedHud(vitals, 0.1, 16, { hidden: false, reticleHidden: true });
    // the page's own title screen boots behind this set-up (the awaited import gives it time) - never under the view
    const noIntro = document.createElement('style'); noIntro.textContent = '#intro { display: none !important; }'; document.head.append(noIntro);
    const log = window.__tv = { picks: [], hostHeard: [], cursor: [], marked: [] };
    for (const t of ['pointerdown', 'mousedown', 'wheel', 'contextmenu']) window.addEventListener(t, (e) => { if (e.target === canvas) log.hostHeard.push(t); });   // the host's own ladders: the bubble phase
    let yaw = 0;
    const tv = createTravelView({
      canvas, feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(yaw, 0) }), yaw: () => yaw, setYaw: (y) => { yaw = y; },
      allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: (e) => (e.code === 'Escape' ? ['Escape'] : []),
      freeCursor: (f) => log.cursor.push(f), where: () => 'Near Daggerfall, Daggerfall',
      project: (p) => (p ? { x: innerWidth / 2 + p[0] * 4, y: innerHeight / 2 - p[2] * 4, front: true } : null),
      onPick: (x, y) => log.picks.push([Math.round(x), Math.round(y)]),
      onMark: (k) => log.marked.push(k),   // TV2: a plate's click
      marks: () => [{ key: 'place:7', at: [60, 0, 40], label: 'Ripwych', kind: 'place', pick: true },
        { key: 'far:9', at: [2000, 0, 10], label: 'Daggerfall', sub: '12 km', kind: 'far', pick: true, edge: true },   // TV5: a far place off the picture's right
        { key: 'far:foot', at: [0, 0, -2000], label: 'Glenpoint', sub: '18 km', kind: 'far', pick: true, edge: true }],   // EDGE-FURNITURE: one off the foot
      route: () => [[0, 0, 0], [20, 0, 10], [40, 0, 30], [60, 0, 40]],
      trip: () => 'To Ripwych, by the road',
      hud: { show: hud.showTravelViewHud, hide: hud.hideTravelViewHud, update: hud.updateTravelViewHud, pickAt: hud.travelViewHudPickAt },
    });
    window.__tvObj = tv;
    window.__tvHud = hud;
    tv.enter();
    let last = performance.now();
    const loop = (now) => { tv.frame(Math.min(0.1, (now - last) / 1000)); tv.drawHud(); last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page2.waitForFunction(() => window.__tvObj.state === 'up', null, { timeout: 10000 });
  await page2.mouse.click(700, 400);
  await page2.mouse.move(300, 300); await page2.mouse.down(); await page2.mouse.move(420, 320, { steps: 6 }); await page2.mouse.up();
  const yawAfterDrag = await page2.evaluate(() => window.__tvObj.camera.yaw);
  const h0 = await page2.evaluate(() => window.__tvObj.camera.heightTarget);
  await page2.mouse.move(600, 400); await page2.mouse.wheel(0, -200);
  await page2.mouse.click(600, 400, { button: 'right' });
  const st = await page2.evaluate(() => ({ ...window.__tv, h: window.__tvObj.camera.heightTarget }));
  await page2.screenshot({ path: join(OUT, 'tv1-hud-1366.png') });
  check(st.picks.length === 1 && Math.abs(st.picks[0][0] - 700) <= 1 && Math.abs(st.picks[0][1] - 400) <= 1, `a click is one pick where it landed (${JSON.stringify(st.picks)})`);
  check(Math.abs(yawAfterDrag) > 0.3, `a drag turned the view (yaw ${yawAfterDrag.toFixed(3)})`);
  check(st.h < h0, `the wheel zoomed in (${h0.toFixed(0)} -> ${st.h.toFixed(0)})`);
  check(st.hostHeard.length === 0, `the host's own listeners heard nothing (${JSON.stringify(st.hostHeard)})`);
  check(JSON.stringify(st.cursor) === '[true]', 'the cursor freed once');
  // TV2: the plate takes a click - the place's journey, never a pick. PERF-TV: the plate is DRAWN on the readout's
  // canvas, so the click lands on the world's canvas and the view finds the plate by where it landed
  const picksBefore = st.picks.length;
  const plate = await page2.evaluate(() => window.__tvHud.travelViewHudState().hits.find((h) => h.key === 'place:7') ?? null);
  check(!!plate, `the plate is drawn and takes a click (${JSON.stringify(plate)})`);
  if (plate) await page2.mouse.click((plate.x0 + plate.x1) / 2, plate.y0 + 6);
  const lit = await page2.waitForFunction(() => document.body.style.cursor === 'pointer', null, { timeout: 2000 }).then(() => 'pointer', () => page2.evaluate(() => document.body.style.cursor));   // the hover is the next frame's
  const tv2 = await page2.evaluate(() => ({ marked: window.__tv.marked, picks: window.__tv.picks.length,
    d: document.querySelector('.tview-route-line')?.getAttribute('d') ?? '', trip: document.querySelector('.tview-trip')?.textContent ?? '' }));
  check(JSON.stringify(tv2.marked) === '["place:7"]' && tv2.picks === picksBefore, `a plate's click is the place's journey, not a pick (${JSON.stringify(tv2)})`);
  check(lit === 'pointer', `the pointer over a plate says it takes a click (cursor ${lit})`);
  // TV5: the far place, held at the right edge with its plate on the screen, is a journey too
  const farBox = await page2.evaluate(() => window.__tvHud.travelViewHudState().hits.find((h) => h.key === 'far:9') ?? null);
  check(!!farBox && farBox.x1 <= 1366 && farBox.x0 > 1000, `TV5: the far place is held at the right edge, its plate on the screen (${JSON.stringify(farBox)})`);
  if (farBox) await page2.mouse.click((farBox.x0 + farBox.x1) / 2, (farBox.y0 + farBox.y1) / 2);
  const farMarked = await page2.evaluate(() => window.__tv.marked.slice());
  check(JSON.stringify(farMarked) === '["place:7","far:9"]', `TV5: a far place's click is its journey (${JSON.stringify(farMarked)})`);
  // PERF-TV: the marks are painted - the plate's brass is on the canvas where the hit box says
  const painted = await page2.evaluate(({ x, y }) => { const c = document.querySelector('.tview-canvas'); const g = c.getContext('2d'); const d = devicePixelRatio || 1; const px = g.getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data; return [...px]; }, { x: plate ? (plate.x0 + plate.x1) / 2 : 0, y: plate ? plate.y1 - 8 : 0 });
  check(painted[3] > 0, `the plate's dot is painted on the canvas (${painted})`);
  check(/^M\d+ \d+ L/.test(tv2.d), `the route line is drawn (${tv2.d.slice(0, 40)})`);
  check(tv2.trip === 'To Ripwych, by the road', `the trip is in the bar (${tv2.trip})`);
  const barBox = await page2.locator('.tview-bar').boundingBox();
  check(!!barBox && barBox.x >= 0 && barBox.x + barBox.width <= 1366 && barBox.y + barBox.height <= 768, `the readout's bar is on screen (${JSON.stringify(barBox)})`);
  // EDGE-FURNITURE: a far place off the foot stands ABOVE the real bar, its name over its arrow, where a click finds it
  const footBox = await page2.evaluate(() => window.__tvHud.travelViewHudState().hits.find((h) => h.key === 'far:foot') ?? null);
  check(!!footBox && !!barBox && footBox.y1 <= barBox.y && footBox.y0 > barBox.y - 90, `EDGE-FURNITURE: the mark off the foot stands just above the bar (${JSON.stringify(footBox)}, the bar from ${barBox?.y})`);
  const footTop = footBox ? await page2.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? '', { x: (footBox.x0 + footBox.x1) / 2, y: footBox.y0 + 14 }) : '';
  check(!/tview-bar|tview-back/.test(String(footTop)), `EDGE-FURNITURE: nothing of the bar over its plate (${footTop})`);   // the bar takes pointers since AUDIT DEEP2 E13, so this can fail
  // AUDIT DEEP2 E1: the bar clear of the HUD's vitals; Return on top where it is drawn
  const e1 = await page2.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    const bar = r('.tview-bar'), vit = r('.hud-bottom'), back = r('.tview-back');
    const hit = back ? document.elementFromPoint((back.l + back.r) / 2, (back.t + back.b) / 2)?.className ?? '' : '';
    return { bar, vit, hit, overlap: !!(bar && vit && bar.l < vit.r && vit.l < bar.r && bar.t < vit.b && vit.t < bar.b) };
  });
  check(!!e1.vit && !e1.overlap, `AUDIT DEEP2 E1: the Overworld's bar stands clear of the HUD's vitals (${JSON.stringify(e1)})`);
  check(/tview-back/.test(String(e1.hit)), `AUDIT DEEP2 E1: Return is on top where it is drawn (${e1.hit})`);
  const you = await page2.locator('.tview-you').boundingBox();
  check(!!you, 'the traveller\'s mark is drawn');
  await page2.locator('.tview-back').click();
  await page2.waitForFunction(() => window.__tvObj.state === 'off', null, { timeout: 5000 });
  const end = await page2.evaluate(() => ({ cursor: window.__tv.cursor, shown: getComputedStyle(document.getElementById('travel-view')).display }));
  check(JSON.stringify(end.cursor) === '[true,false]' && end.shown === 'none', `Return brought it down and put everything back (${JSON.stringify(end)})`);
  // the phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:5231/play/');
  await phone.evaluate(async () => {
    const hud = await import('/src/ui/travel/travelViewHud.js');
    document.body.innerHTML = '';
    hud.showTravelViewHud({});
    hud.updateTravelViewHud({ feet: { x: 195, y: 420, front: true }, heading: 30, yaw: 0.5, where: 'The wilds of the Wrothgarian Mountains', touch: true });
  });
  const pb = await phone.locator('.tview-bar').boundingBox();
  // TV2: the travel panel says when the governor holds the clock under the spinner
  const held = await phone.evaluate(async () => {
    const { drawEnhancedTravelControl, hideEnhancedTravelControl } = await import('/src/ui/enhanced/enhancedTravelControl.js');
    drawEnhancedTravelControl({ showing: true, destination: 'Ripwych', accel: 40, held: 20 });
    const a = document.querySelector('.travelpanel-accel');
    const out = { text: a?.textContent, cls: a?.className };
    drawEnhancedTravelControl({ showing: true, destination: 'Ripwych', accel: 40, held: null });
    out.free = document.querySelector('.travelpanel-accel')?.textContent;
    hideEnhancedTravelControl();
    return out;
  });
  check(held.text === '×20 / ×40' && /held/.test(held.cls) && held.free === '×40', `the panel reads the held clock (${JSON.stringify(held)})`);
  check(!!pb && pb.x >= 0 && pb.x + pb.width <= 390, `the bar fits a phone (${JSON.stringify(pb)})`);
  await phone.screenshot({ path: join(OUT, 'tv1-hud-phone.png') });
  check(pageErrors.length === 0, `no page errors (${pageErrors.slice(0, 3).join(' | ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nOK');
process.exit(failures.length ? 1 : 0);
