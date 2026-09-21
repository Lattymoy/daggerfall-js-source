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

  // A KNOWN TEXTURE: 8x8 of Daggerfall's own blood red, fully opaque.
  const W = 8, H = 8;
  const colors = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { colors[i * 4] = 168; colors[i * 4 + 1] = 16; colors[i * 4 + 2] = 16; colors[i * 4 + 3] = 255; }
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
  r.uploadTexture(199, '8#0', { colors: (() => { const c = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { c[i * 4] = 168; c[i * 4 + 1] = 16; c[i * 4 + 2] = 16; c[i * 4 + 3] = 255; } return c; })(), width: W, height: H });
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
    const quad = new Float32Array(4 * 9);
    const corner = (i, x, y) => {
      const o = i * 9;
      quad[o] = x; quad[o + 1] = y; quad[o + 2] = 0;
      quad[o + 3] = i === 0 || i === 1 ? 0 : 1; quad[o + 4] = i === 0 || i === 3 ? 0 : 1;
      quad[o + 5] = 1; quad[o + 6] = 1; quad[o + 7] = 1; quad[o + 8] = 1;
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
  const wear = (tint) => {
    const quad = new Float32Array(4 * 9);
    const corner = (i, x, y) => {
      const o = i * 9;
      quad[o] = x; quad[o + 1] = y; quad[o + 2] = 0;
      quad[o + 3] = i === 0 || i === 1 ? cell.u0 : cell.u1; quad[o + 4] = i === 0 || i === 3 ? cell.v0 : cell.v1;
      quad[o + 5] = tint[0]; quad[o + 6] = tint[1]; quad[o + 7] = tint[2]; quad[o + 8] = 1;
    };
    // a quad a little wider than the view, so the centre pixel is the cell's own centre texel
    corner(0, -1.2, -1.2); corner(1, -1.2, 1.2); corner(2, 1.2, 1.2); corner(3, 1.2, -1.2);
    r.writeDecalSlot(own, 0, quad);
  };
  const ownShot = (label, tint, setup, lights = null) => {
    wear(tint);
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
    r.drawDecals(own, atlasTex);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };
  const fresh = freshTint(() => 0.5), dried = driedTint(fresh, DRY_STAGES);
  const noonLit = () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9]);
  const ownRows = [];
  for (const [laneName, enter, leave] of [['classic', () => {}, () => {}], ['lane', async () => { const { EL_LANE } = await import('/src/render/enhancedLighting.js'); r.setLightingLane(EL_LANE); r.setExposure(1.1); }, () => r.setLightingLane(null)]]) {
    await enter();
    ownRows.push({ lane: laneName, what: 'fresh at noon', px: ownShot('', fresh, noonLit).px });
    ownRows.push({ lane: laneName, what: 'dried at noon', px: ownShot('', dried, noonLit).px });
    ownRows.push({ lane: laneName, what: 'fresh, dungeon + torch', px: ownShot('', fresh, dungeon, TORCH).px });
    ownRows.push({ lane: laneName, what: 'dried, dungeon + torch', px: ownShot('', dried, dungeon, TORCH).px });
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
}
const laneDusk = out.lane.find((x) => x.what === 'dusk');
check('LANE dusk: the mark is RED, not the near-black the classic program drew under the lane', (laneDusk?.decal[0] ?? 0) > 50, `rgba ${laneDusk?.decal.join(',')}`);
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
