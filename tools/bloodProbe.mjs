// MAC-BUG4 IN A REAL GL CONTEXT: is a blood splash black because of the
// RENDERER, or because of the texture it is handed?
//
// Mac, 2026-09-20: "Also blood is black."
//
// The splash is TEXTURE.380 through scenes/hitEffects.js - a one-shot
// animated billboard - and this container has no ARENA2, so the real
// archive cannot be decoded here. What CAN be settled is the half that
// does not need it: hand the port's OWN billboard path a texture whose
// colour is known, under the lighting a dungeon actually sets, and read
// the pixel back. Red in, red out means the plumbing is sound and the
// fault is in what the texture decodes to. Red in, BLACK out means the
// fault is here.
//
//     npx vite --port 5199 &
//     node tools/bloodProbe.mjs
//
// MAC-BUG W4 and W5 read the CLASSIC set. MAC-BUG W6 ("super dark
// coloring instead of red") added the LANE rows at the bottom: the port
// ships with Enhanced Lighting on, and every row above it was green
// while every mark a player saw was dark.
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// THE MODULE GRAPH IS ALL THIS NEEDS. The menu cannot come up in this
// container (no ARENA2), and it does not have to: the renderer and the
// effect pool are plain modules, and the page is only here to be an
// ORIGIN the dev server will serve them from with a real WebGL2 context
// behind it.
await page.goto(`${BASE}/gun-proto.html`, { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async () => {
  const { Renderer } = await import('/src/render/renderer.js');
  const { createHitEffects, BLOOD_ARCHIVE } = await import('/src/scenes/hitEffects.js');
  const { DUNGEON_AMBIENT } = await import('/src/world/dungeonLights.js');

  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  document.body.append(canvas);
  const r = new Renderer(canvas);

  // A KNOWN TEXTURE: 8x8 of a saturated blood red, fully opaque.
  //
  // AUDIT BLOOD3 F2: 209, AND THAT IS A REAL TEXEL, NOT A CHOSEN ONE.
  // The decal pass draws one thing in this game - the blood atlas,
  // whose alpha is coverage and whose ink is `255 * (1 - INK_DEPTH *
  // thickness)`. 209 is `255 * (1 - 0.18)`: the value the sheet itself
  // holds at the heart of every pool, a FULL-THICKNESS film, where the
  // law is anchored and `exp(ABSORB * 0) = 1` exactly. The LIGHTING
  // parity checks below are about light and not albedo, so they are
  // shot on that anchor and measure the one thing they are named for.
  // BLOOD3 shipped this at 255 - which is ink at ZERO thickness, the
  // film's MAXIMUM gain - and the checks passed only because the law
  // was inverted then too. The film's own magnitude is not tested here
  // by construction; it is tested on its own rows below, off the real
  // atlas, where the thickness varies across one mark.
  const W = 8, H = 8;
  const colors = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { colors[i * 4] = 209; colors[i * 4 + 1] = 16; colors[i * 4 + 2] = 16; colors[i * 4 + 3] = 255; }
  const red = { colors, width: W, height: H };

  // The pool's own door, driven exactly as a host drives it - so the
  // key the batch asks for is the key the pool uploads under, which is
  // half of what this probe is for.
  const uploaded = [];
  const fx = createHitEffects({
    renderer: r,
    getTexture: async () => ({ recordCount: 8, getFrameCount: () => 1, getSize: () => ({ width: W, height: H }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: (archive, record, frame) => {
      uploaded.push(`${archive}_${record}#${frame}`);
      r.uploadTexture(archive, `${record}#${frame}`, red);
    },
  });

  // BLOOD AUDIT 4: THE SUN AT AN ANGLE, and the torch a step OFF the
  // surface. The mark is lit as the SURFACE it lies on now (N.L, as the
  // mesh shader has it) and no longer as the flat beside it, so a sun
  // straight overhead would light a wall's mark not at all - true, and
  // not what this probe is for - and a torch AT the mark's own point
  // would have no direction to it. The sun comes in at 0.8 of the
  // mark's normal, the torch two units out; the mesh below takes both
  // the same way.
  const SUN = new Float32Array([0, 0.6, 0.8]);
  const TORCH = new Float32Array([0, 0, 2, 14]);
  const shot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, SUN);
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);   // a BLUE page: anything red or black came from the draw
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawBillboards(fx.batches(), [1, 0, 0], [0, 1, 0]);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };

  fx.showBloodSplash(0, [0, 0, 0]);
  await new Promise((res) => setTimeout(res, 50));   // the pool warms its archive async

  const frames = [];
  frames.push(shot('clockless (no setLighting - full bright)', () => {}));
  frames.push(shot('EXTERIOR noon', () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9])));
  const dungeon = () => r.setLighting([...(DUNGEON_AMBIENT ?? [0.12, 0.12, 0.12])], 0, [0, 0, 0]);
  frames.push(shot('DUNGEON ambient, no lights', dungeon));
  // ...and the same splash with a TORCH on it: the player's own light is
  // a point light like any other, and this is what says whether the
  // darkness above is the scene's or the splash's.
  frames.push(shot('DUNGEON ambient + a torch at the splash', dungeon, TORCH));
  // A FOE STANDS IN THE SAME PASS. If a splash is black where a sprite
  // beside it is not, the difference is not the lighting - so the
  // comparison is made rather than assumed.
  r.uploadTexture(199, '8#0', { colors: (() => { const c = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { c[i * 4] = 209; c[i * 4 + 1] = 16; c[i * 4 + 2] = 16; c[i * 4 + 3] = 255; } return c; })(), width: W, height: H });
  const foe = r.createBillboardBatch(199, 8, { w: 2, h: 2 }, [[0, 0, 0]]);
  foe.frame = 0;
  const foeShot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, SUN);
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawBillboards([foe], [1, 0, 0], [0, 1, 0]);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };
  frames.push(foeShot('a SPRITE (not the pool) in the same dungeon', dungeon));

  // ── BLOOD AUDIT 4: THE SURFACE THE MARK LIES ON ─────────────────
  // A wall of the same red, facing the eye exactly as the decal quad
  // below does, through the mesh pass - the comparison the mark has
  // to win now is against the surface under it, not the flat beside it.
  const wall = r.createMesh({
    positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]),   // the mesh pass draws UNSIGNED_INT and culls; both windings, so the probe's hand-written projection cannot cull the wall away
    subMeshes: [{ startIndex: 0, primitiveCount: 4, textureArchive: 199, textureRecord: '8#0' }],
  });
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const meshShot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, SUN);
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawMesh(wall, IDENT);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };

  // ── THE DECAL PASS (BLOOD1a) ────────────────────────────────────
  // The mark on the floor and the gib in the air above it are the same
  // blood from the same blow, and they go through DIFFERENT passes:
  // bloodMarks.draw calls drawDecals for the marks and drawBillboards
  // for the chunks. This reads the mark's pixel in the same light the
  // rows above read a sprite's.
  const { createDecalBatch: _mk } = r;
  const decalTex = r.uploadTexture(777, 'mark', red);
  const batch = r.createDecalBatch(1);
  {
    const quad = new Float32Array(4 * 10);   // BLOOD2f: ten floats a corner, the tenth the wet - zero here, a DRY mark, so the parity rows read the surface's light alone
    const corner = (i, x, y) => {
      const o = i * 10;
      quad[o] = x; quad[o + 1] = y; quad[o + 2] = 0;
      quad[o + 3] = i === 0 || i === 1 ? 0 : 1; quad[o + 4] = i === 0 || i === 3 ? 0 : 1;
      // AUDIT BLOOD3 F1: THE COLOUR IS THE TINT'S, and it has to be
      // here too. A real mark is a WHITE-INK sprite under a per-mark
      // tint (freshTint/driedTint) - the sheet carries shape and
      // thickness, never colour - so the decal shaders take their
      // albedo from vColor and the ink is the film's thickness alone.
      // This fixture used to lean on the TEXTURE for its red and tint
      // itself white, which no decal in the game does; the parity rows
      // then compared a white mark against a red wall. The tint is the
      // fixture's own colour now, and the texture's red 209 is what
      // makes it a full-thickness film, where the law is anchored.
      quad[o + 5] = 209 / 255; quad[o + 6] = 16 / 255; quad[o + 7] = 16 / 255; quad[o + 8] = 1; quad[o + 9] = 0;
    };
    corner(0, -1, -1); corner(1, -1, 1); corner(2, 1, 1); corner(3, 1, -1);
    r.writeDecalSlot(batch, 0, quad);
  }
  const decalShot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, SUN);
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawDecals(batch, decalTex);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };
  frames.push(decalShot('DECAL: dungeon ambient, no lights', dungeon));
  frames.push(decalShot('DECAL: dungeon ambient + a torch on it', dungeon, TORCH));
  frames.push(decalShot('DECAL: exterior noon', () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9])));
  frames.push(meshShot('MESH: dungeon ambient, no lights', dungeon));
  frames.push(meshShot('MESH: dungeon ambient + a torch on it', dungeon, TORCH));
  frames.push(meshShot('MESH: exterior noon', () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9])));

  // ── BLOOD AUDIT 4: THE MARK'S OWN COLOUR ────────────────────────
  // Everything above wears a flat red so the passes can be compared;
  // the shipped mark wears the ATLAS (white ink) under the blood's own
  // tint, fresh and dried. These rows read that - the "super dark
  // instead of red" Mac saw was the dried tint multiplying an already
  // red texel down to a black-red, and no row read the real art.
  const { bloodAtlas, pickCell, freshTint, driedTint, DRY_STAGES, BLOOD_ATLAS_ARCHIVE, BLOOD_ATLAS_RECORD } = await import('/src/combat/bloodArt.js');
  const atlas = bloodAtlas();
  const atlasTex = r.uploadTexture(BLOOD_ATLAS_ARCHIVE, BLOOD_ATLAS_RECORD, atlas, { smooth: true });
  const cell = pickCell(atlas, 'pool', () => 0);
  const own = r.createDecalBatch(1);
  const wear = (tint, wet = 0) => {
    const quad = new Float32Array(4 * 10);
    const corner = (i, x, y) => {
      const o = i * 10;
      quad[o] = x; quad[o + 1] = y; quad[o + 2] = 0;
      quad[o + 3] = i === 0 || i === 1 ? cell.u0 : cell.u1; quad[o + 4] = i === 0 || i === 3 ? cell.v0 : cell.v1;
      quad[o + 5] = tint[0]; quad[o + 6] = tint[1]; quad[o + 7] = tint[2]; quad[o + 8] = 1; quad[o + 9] = wet;
    };
    // a quad a little wider than the view, so the centre pixel is the cell's own centre texel
    corner(0, -1.2, -1.2); corner(1, -1.2, 1.2); corner(2, 1.2, 1.2); corner(3, 1.2, -1.2);
    r.writeDecalSlot(own, 0, quad);
  };
  const ownShot = (label, tint, setup, lights = null, wet = 0, clear = null) => {
    wear(tint, wet);
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, SUN);
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(...(clear ?? [0, 0, 1, 1]));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawDecals(own, atlasTex);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // BLOOD3: and the WHOLE frame, for the flatness question. A mark
    // that is one colour is a sticker; a film is deep where the blood
    // pools and brighter, warmer, where it ran thin. Over the mark's
    // WELL-COVERED pixels only - a rim pixel is blended with whatever is
    // behind it, so its colour is the background's as much as the
    // blood's, and the signature lives in the body, where the ink's
    // grain varies the density at full coverage. The film shot clears to
    // BLACK for the same reason: a blue clear leaks into every edge.
    const all = new Uint8Array(128 * 128 * 4);
    gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, all);
    // AUDIT BLOOD3 F4: BANDED BY RADIUS, NOT BY BRIGHTNESS. Banding the
    // frame by red sorts the mark's own ALPHA-FADED RIM into the "thin"
    // bucket - a rim pixel at a third coverage over a black clear is a
    // third of the body's colour before any film exists - so the old
    // check reported a 1.83 spread the film cannot produce at all (its
    // whole range on red is exp(0.5) = 1.65) and would have passed with
    // the film deleted. The cell drawn here is a POOL, radial, centred
    // on the quad, and the quad is centred on the viewport: so screen
    // radius IS thickness, and both bands below sit at full coverage,
    // well inside the silhouette, where alpha is 1 and only the film
    // can be making a difference.
    // The quad spans +/-1.2 at z = -3 under this projection, so it
    // covers about +/-25 px of the 128 px frame and the pool's alpha
    // edge lands near r = 21. The rings are sized to THAT: both inside
    // the silhouette at full coverage, one on the heart and one on the
    // shoulder, with the fading rim left out entirely.
    const ring = (lo, hi) => {
      const acc = [0, 0, 0]; let n = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const d = Math.hypot(x - 63.5, y - 63.5);
        if (d < lo || d >= hi) continue;
        const i = (y * 128 + x) * 4;
        if (!(all[i] > all[i + 2])) continue;   // the mark, not the page
        acc[0] += all[i]; acc[1] += all[i + 1]; acc[2] += all[i + 2]; n++;
      }
      if (!n) return null;
      const m = acc.map((v) => v / n);
      return { n, r: m[0], g: m[1], b: m[2], warm: m[0] > 0 ? (m[1] + m[2]) / 2 / m[0] : 0 };
    };
    return { label, px: [...px], film: { deep: ring(0, 5), thin: ring(12, 17) } };
  };
  // AUDIT BLOOD3 F10: THE MENISCUS, AT LAST IN A PICTURE. Every other
  // law in this slice is read off a colour; this one is read off a
  // NORMAL, and a normal only shows where the light grazes it. So: the
  // same mark twice under a sun almost in the quad's own plane, once
  // with the term live and once with the tilt forced flat, and the
  // difference between the two frames IS the term. The tilt is forced
  // by handing the shader a mark whose thickness does not vary - a
  // uniform-ink fixture, where the gradient is zero and the branch
  // leaves the normal alone - so nothing has to be recompiled and the
  // shipped shader is the one under test.
  const flatInk = (() => {
    const c = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 64; i++) { const ink = Math.round(255 * (1 - 0.18)); c[i*4] = ink; c[i*4+1] = ink; c[i*4+2] = ink; c[i*4+3] = 255; }
    return { colors: c, width: 8, height: 8 };
  })();
  const flatTex = r.uploadTexture(4242, 'flatink#0', flatInk, { smooth: true });
  const grazeLit = () => r.setLighting([0.06, 0.06, 0.07], 1.6, [1, 0.97, 0.92]);
  const grazeShot = (useAtlas) => {
    wear(fresh0, 0);
    grazeLit();
    r.setPointLights(new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, [0.945, 0.315, 0.087]);   // a sun almost in the mark's own plane
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0.06, 0.06, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawDecals(own, useAtlas ? atlasTex : flatTex);
    const all = new Uint8Array(128 * 128 * 4);
    gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, all);
    return all;
  };

  const fresh0 = freshTint(() => 0.5);
  const fresh = fresh0, dried = driedTint(fresh, DRY_STAGES);
  const noonLit = () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9]);
  const ownRows = [];
  const ownFilm = [];   // BLOOD3: the mark's own spread, per lane
  let meniscusOut = null;   // AUDIT BLOOD3 F10: the normal's tilt, differenced out of two frames
  for (const [laneName, enter, leave] of [['classic', () => {}, () => {}], ['lane', async () => { const { EL_LANE } = await import('/src/render/enhancedLighting.js'); r.setLightingLane(EL_LANE); r.setExposure(1.1); }, () => r.setLightingLane(null)]]) {
    await enter();
    ownRows.push({ lane: laneName, what: 'fresh at noon', px: ownShot('', fresh, noonLit).px });
    ownRows.push({ lane: laneName, what: 'dried at noon', px: ownShot('', dried, noonLit).px });
    ownRows.push({ lane: laneName, what: 'fresh, dungeon + torch', px: ownShot('', fresh, dungeon, TORCH).px });
    ownRows.push({ lane: laneName, what: 'dried, dungeon + torch', px: ownShot('', dried, dungeon, TORCH).px });
    // BLOOD2f: the same fresh mark WET - the lane glints it under the torch and in the sun; the classic set does not know the float
    ownRows.push({ lane: laneName, what: 'fresh WET, dungeon + torch', px: ownShot('', fresh, dungeon, TORCH, 1).px });
    ownRows.push({ lane: laneName, what: 'fresh WET at noon', px: ownShot('', fresh, noonLit, null, 1).px });
    ownFilm.push({ lane: laneName, ...ownShot('', fresh, noonLit, null, 0, [0, 0, 0, 1]).film });   // BLOOD3
    // AUDIT BLOOD3 F10: the meniscus, measured. A mark with a thickness
    // field against the same mark with a flat one, under a grazing sun:
    // the difference is the normal's tilt and nothing else. Banded by
    // radius so the row can say WHERE it lands, because the answer
    // turned out not to be the rim.
    if (laneName === 'lane') {
      const bumped = grazeShot(true), flat = grazeShot(false);
      let peak = 0, sIn = 0, nIn = 0, sOut = 0, nOut = 0;
      for (let i = 0; i < bumped.length; i += 4) {
        const d = Math.max(Math.abs(bumped[i] - flat[i]), Math.abs(bumped[i+1] - flat[i+1]), Math.abs(bumped[i+2] - flat[i+2]));
        if (d > peak) peak = d;
        const px = (i / 4) % 128, py = Math.floor((i / 4) / 128);
        const rad = Math.hypot(px - 63.5, py - 63.5) / 64;
        if (rad < 0.45) { sIn += d; nIn++; } else if (rad < 0.80) { sOut += d; nOut++; }
      }
      meniscusOut = { peak, body: sIn / Math.max(1, nIn), rim: sOut / Math.max(1, nOut) };
    }
    leave();
  }

  // ── MAC-BUG W6 (Mac: "super dark coloring instead of red") ──────
  // EVERYTHING ABOVE RAN ON THE CLASSIC SET, and the port ships with the
  // Enhanced Lighting lane ON. Under the lane the renderer decodes every
  // colour it uploads to linear and the lane's shaders encode at the
  // end; a classic program handed that light draws an undecoded texel
  // times a linear number with no exposure, tonemap or encode - which is
  // what the decal pass was. So the same rows again, under the lane, a
  // sprite and a mark side by side at four states of light.
  const { EL_LANE } = await import('/src/render/enhancedLighting.js');
  r.setLightingLane(EL_LANE);
  r.setExposure(1.1);
  const dusk = () => r.setLighting([0.25, 0.25, 0.3], 0.25, [0.9, 0.6, 0.4]);
  const lane = [];
  for (const [what, setup, lights] of [
    ['noon', () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9]), null],
    ['dusk', dusk, null],
    ['dungeon + a torch', dungeon, TORCH],
    ['dungeon, no lights', dungeon, null],
  ]) {
    lane.push({ what, sprite: foeShot(`LANE sprite: ${what}`, setup, lights).px, decal: decalShot(`LANE decal: ${what}`, setup, lights).px, mesh: meshShot(`LANE mesh: ${what}`, setup, lights).px });
  }
  r.setLightingLane(null);

  return {
    archive: BLOOD_ARCHIVE,
    uploaded,
    batches: fx.batches().length,
    textureKeys: [...r.textures.keys()].filter((k) => String(k).startsWith('380')),
    frames,
    lane,
    ownRows,
    ownFilm,   // BLOOD3
    meniscus: meniscusOut,   // AUDIT BLOOD3 F10
  };
});

console.log('archive           ', out.archive);
console.log('uploaded keys     ', out.uploaded);
console.log('renderer tex keys ', out.textureKeys);
console.log('live batches      ', out.batches);
for (const f of out.frames) console.log(`  ${f.label.padEnd(38)} -> rgba ${f.px.join(',')}`);
for (const x of out.lane) console.log(`  LANE ${x.what.padEnd(20)} sprite ${x.sprite.join(',').padEnd(16)} mesh ${x.mesh.join(',').padEnd(16)} decal ${x.decal.join(',')}`);
for (const x of out.ownRows) console.log(`  OWN  ${x.lane.padEnd(8)} ${x.what.padEnd(24)} -> rgba ${x.px.join(',')}`);

check('the pool uploaded a texture for the splash', out.uploaded.length > 0, out.uploaded.join(' '));
check('the key the pool uploads is the key the billboard pass asks for',
  out.textureKeys.includes('380_0#0'), out.textureKeys.join(' '));
check('a batch reached the draw', out.batches === 1, String(out.batches));
const lit = out.frames[0]?.px ?? [];
check('full-bright: a RED texture comes back RED, not black',
  lit[0] > 100 && lit[0] > lit[2], `rgba ${lit.join(',')}`);
const noon = out.frames[1]?.px ?? [];
check('exterior noon: still red', noon[0] > 60 && noon[0] > noon[2], `rgba ${noon.join(',')}`);
const dark = out.frames[2]?.px ?? [];
const torch = out.frames[3]?.px ?? [];
const sprite = out.frames[4]?.px ?? [];
check('dungeon ambient with NO light: a splash is ambient x albedo, which reads BLACK',
  dark[0] < 40, `rgba ${dark.join(',')}`);
check('...and a TORCH on it brings it back', torch[0] > dark[0] * 3, `rgba ${torch.join(',')}`);
check('A SPRITE IN THE SAME LIGHT IS EXACTLY AS DARK - the pool is not the difference',
  Math.abs(sprite[0] - dark[0]) <= 1, `splash ${dark.join(',')} vs sprite ${sprite.join(',')}`);
// MAC-BUG W4 read the mark against the CHUNK; BLOOD AUDIT 4 reads it
// against the SURFACE IT LIES ON. A mark is a stain on a wall or a
// floor, and it has to be exactly as lit as that wall or floor - N.L on
// the sun, N.L on the torch - or blood is one brightness on every
// surface of a world that is not (the outdoor inconsistency Mac saw).
const dDark = out.frames[5]?.px ?? [];
const dTorch = out.frames[6]?.px ?? [];
const dNoon = out.frames[7]?.px ?? [];
const mDark = out.frames[8]?.px ?? [];
const mTorch = out.frames[9]?.px ?? [];
const mNoon = out.frames[10]?.px ?? [];
const same = (a, b) => Math.abs(a[0] - b[0]) <= 2 && Math.abs(a[1] - b[1]) <= 2 && Math.abs(a[2] - b[2]) <= 2;
check('DECAL in a dark dungeon is as dark as the WALL it lies on - no darker',
  same(dDark, mDark), `decal ${dDark.join(',')} vs mesh ${mDark.join(',')}`);
check('A TORCH LIGHTS THE MARK exactly as it lights the wall under it (N.L)',
  same(dTorch, mTorch) && dTorch[0] > dDark[0] * 3, `decal ${dTorch.join(',')} vs mesh ${mTorch.join(',')}`);
check('and at noon the mark takes the SUN as the wall does (N.L), not the flat’s half',
  same(dNoon, mNoon) && dNoon[0] > dDark[0] * 3, `decal ${dNoon.join(',')} vs mesh ${mNoon.join(',')}`);
// MAC-BUG W6: and under the LANE the mark and the surface still agree,
// to the unit, at every state.
for (const x of out.lane) {
  check(`LANE ${x.what}: the mark is lit as the wall it lies on is`,
    same(x.decal, x.mesh), `decal ${x.decal.join(',')} vs mesh ${x.mesh.join(',')} (sprite ${x.sprite.join(',')})`);
}
// BLOOD AUDIT 4: THE MARK'S OWN COLOUR - the atlas under the blood's
// tint. Fresh is RED; dried is a rust, BROWNER than fresh (green and
// blue up against red) and about as bright - never the black-red the
// old multiply landed on.
for (const lane of ['classic', 'lane']) {
  const at = (what) => out.ownRows.find((x) => x.lane === lane && x.what === what)?.px ?? [0, 0, 0, 0];
  const fN = at('fresh at noon'), dN = at('dried at noon'), fT = at('fresh, dungeon + torch'), dT = at('dried, dungeon + torch');
  check(`OWN ${lane}: fresh blood at noon is RED - red well over the rest, and bright`,
    fN[0] > 80 && fN[0] > fN[1] * 4 && fN[0] > fN[2] * 4, `rgba ${fN.join(',')}`);
  check(`OWN ${lane}: dried blood at noon is a RUST, browner than fresh and about as bright`,
    dN[1] / Math.max(1, dN[0]) > 2 * (fN[1] / Math.max(1, fN[0])) && dN[0] > fN[0] * 0.4 && dN[0] > 40, `dried ${dN.join(',')} vs fresh ${fN.join(',')}`);
  check(`OWN ${lane}: under a torch in a dungeon, fresh is red and dried is a visible rust - not black`,
    fT[0] > 30 && dT[0] > 15 && dT[1] > 4, `fresh ${fT.join(',')} dried ${dT.join(',')}`);
  // BLOOD2f: the wet sheen - the lane's glint, the classic set's nothing
  const wT = at('fresh WET, dungeon + torch'), wN = at('fresh WET at noon');
  if (lane === 'lane') {
    // BLOOD3 (Mac: "the blood is too shiny and flat"): THE SHEEN IS AN
    // ANGLE NOW. It used to be nine tenths of the light wherever the
    // half-vector lined up, at ANY angle - the look of wet plastic. A
    // liquid film is Schlick: about two per cent head-on, most of the
    // light at a graze. The ANGLE itself is pinned where it can be
    // isolated - the pure `wetSheen` in test/blood1_decals.test.js -
    // because it cannot be isolated HERE: the glint is a Blinn-Phong
    // lobe as well as a Fresnel term, and turning the quad to a grazing
    // angle walks the normal out of the lobe, so the picture would
    // answer about the lobe and be read as the angle. What a picture CAN
    // settle is the thing Mac reported - that a wet mark was a white
    // patch - and this view is the worst case for it: dead-on, where
    // Fresnel is at its weakest and the lobe at its peak.
    // AUDIT BLOOD3 F5: A WET MARK IS TWO THINGS NOW, AND THE ROW SAYS
    // BOTH. The glint is the lamp's white arriving in the channels
    // blood does not carry - and it is the LAMP's colour, so it lands
    // in green and blue. The other half is the one you can see standing
    // up: a wet film is DARKER, because the light goes into it before
    // it comes back, so the red falls. BLOOD3 had only the glint, at
    // every angle, which is why a wet mark read as a white patch; this
    // row would have caught that too, since it now demands the red go
    // the other way.
    check('OWN lane: a WET mark under a torch glints in the lamp\'s colour AND darkens in its own',
      wT[1] >= fT[1] + 6 && wT[2] >= fT[2] + 6 && wT[0] < fT[0], `wet ${wT.join(',')} vs dry ${fT.join(',')}`);
    check('OWN lane: ...but it is still BLOOD, not a white highlight - the red keeps a clear lead over the glint',
      wT[0] > wT[1] * 2.2 && wT[0] > wT[2] * 2.2, `wet ${wT.join(',')} (r/g ${(wT[0] / Math.max(1, wT[1])).toFixed(2)})`);
    // ...and AT NOON, HEAD ON, THE GLINT IS ALMOST NOTHING - which is
    // the whole of AUDIT BLOOD3 F5. Schlick gives a water film about
    // two per cent looking straight down it, so what is left to read as
    // wet is the darkening alone. BLOOD3 shipped 0.9 of the light here
    // at every angle; the row that let that through demanded a LIFT in
    // this case, so it is the row as much as the shader that was wrong.
    check('OWN lane: and in the sun, head on, a wet mark is not a highlight - it is DARKER, and still blood',
      wN[0] < fN[0] && wN[0] > wN[1] * 2.2 && wN[1] <= fN[1] + 2, `wet ${wN.join(',')} vs dry ${fN.join(',')}`);
  } else {
    check('OWN classic: the wet float means nothing to the classic set - the same mark, wet or dry',
      wT.join(',') === fT.join(',') && wN.join(',') === fN.join(','), `wet ${wT.join(',')} vs dry ${fT.join(',')}`);
  }
}
// BLOOD3: THE MARK IS NOT ONE COLOUR. The albedo was ink x tint, and
// the ink is white, so every texel of a pool came out the same red - a
// sticker. The ink's grain is a DENSITY, and blood absorbs green and
// blue far harder than red, so where the smear ran thin it has to come
// out warmer as well as lighter in the body of the mark.
// AUDIT BLOOD3 F1/F4: THE FILM, OFF A REAL POOL, AT FULL COVERAGE.
// Both rings sit inside the mark's silhouette where alpha is 1, so the
// only thing that can differ between them is the film - and the SIGN is
// the whole point. BLOOD3 read the sheet's ink as a density when the
// art paints it as a darkening, so the film ran backwards over every
// shape and brightened exactly what the art had darkened. A heart is
// DEEPER than a mid-radius ring, so a heart must come back DARKER and
// MORE saturated. Inverted, this check reads the other way round.
for (const f of out.ownFilm ?? []) {
  const d = f.deep, t = f.thin;
  console.log(`  FILM ${f.lane}: deep ${d?.n}px ${d?.r.toFixed(0)},${d?.g.toFixed(0)},${d?.b.toFixed(0)} | thin ${t?.n}px ${t?.r.toFixed(0)},${t?.g.toFixed(0)},${t?.b.toFixed(0)} (g+b over r: ${d?.warm.toFixed(3)} -> ${t?.warm.toFixed(3)})`);
  // This row settles the SIGN and nothing else - the magnitude is the
  // gain check below, and asking both questions with one ratio meant
  // two thresholds for one quantity. Four units of 255 is well past
  // quantisation, and the direction is what the audit was about: with
  // the ink read as a density this comes back the other way round.
  check(`FILM ${f.lane}: a mark is not ONE red - a pool's heart is a DEEPER film than its shoulder, so it comes back darker`,
    !!d && !!t && t.r > d.r + 4, `heart ${d?.r.toFixed(0)} against shoulder ${t?.r.toFixed(0)} - inverted, the heart is the brighter one`);
  check(`FILM ${f.lane}: ...and the thinner blood is DESATURATED - green and blue pass a thinning film, which is the whole of reading it as depth`,
    !!d && !!t && t.warm > d.warm * 1.06, `g+b over r, heart ${d?.warm.toFixed(3)} -> shoulder ${t?.warm.toFixed(3)}`);
  // AUDIT BLOOD3 F2: and the SIZE of it. No probe row constrained
  // BLOOD_ABSORB at all after BLOOD3 - the parity rows were shot on a
  // fixture where the film is a no-op, and the band check above was
  // measuring alpha. A ring at radius 30-40 of a pool whose edge is at
  // ~50px is roughly a third of full thickness, so the red gain between
  // the two rings should land in the band the law allows and nowhere
  // near 1 (no film) or its 1.65 ceiling (a film with no anchor).
  const gain = d && t ? t.r / d.r : 0;
  // The band holds on both sets, but they do not read alike and should
  // not: the classic set works in display space and shows the gain
  // straight (1.16 here), while the lane applies it in linear and then
  // tonemaps and encodes, which compresses it (1.12). That is the same
  // fact AUDIT BLOOD3 F3 is about, seen from the other side - and it is
  // why the two lanes carry different absorption constants. What both
  // must clear is the floor: 1.0 is a film that is not there at all.
  check(`FILM ${f.lane}: ...and by an amount the law allows - not a no-op, not unbounded`,
    gain > 1.08 && gain < 1.65, `red gain heart -> shoulder ${gain.toFixed(3)} (1.0 would be no film; exp(ABSORB.r) = 1.649 is the ceiling, at zero thickness)`);
}
const laneDusk = out.lane.find((x) => x.what === 'dusk');
check('LANE dusk: the mark is RED, not the near-black the classic program drew under the lane', (laneDusk?.decal[0] ?? 0) > 50, `rgba ${laneDusk?.decal.join(',')}`);
// AUDIT BLOOD3 F10: THE MENISCUS HAS A PICTURE NOW. This is the one law
// in the slice that is read off a NORMAL rather than a colour, and it
// went to main with nothing drawing it. The mark's own thickness is a
// height field; switching that height field flat changes how a grazing
// sun lands on it, and these rows say by how much and WHERE.
if (out.meniscus) {
  const m = out.meniscus;
  console.log(`  MENISCUS lane: peak ${m.peak}/255 | body (r<0.45) mean ${m.body.toFixed(2)} | rim band (0.45-0.80) mean ${m.rim.toFixed(2)}`);
  check('MENISCUS lane: the mark is lit as a RELIEF - flatten its thickness and a grazing sun lands differently',
    m.peak >= 12, `peak change ${m.peak}/255 between a real mark and a uniform-thickness one`);
  check('MENISCUS lane: ...and it is the WHOLE mark, not a rim lip - a pool\'s thickness is a smoothstep, and a smoothstep is steepest in the MIDDLE',
    m.body > m.rim, `body ${m.body.toFixed(2)} against rim band ${m.rim.toFixed(2)} - the record said "raised edge" until this row was written`);
}
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
