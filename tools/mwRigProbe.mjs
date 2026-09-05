// MW-D9g: THE SEAM NOTHING HAS EVER RUN.
//
// mwArmProbe proves the ARM draws: it builds one and calls update/draw
// itself. test/fparm.test.js proves the ENGINE's arithmetic. Both of them
// drive fpArm DIRECTLY, and its own header says what that leaves out:
// "weaponRig's branch, the four hosts' camera dep, and the enhanced-menu
// card are pinned in node and proven by Mac in the game".
//
// Mac has now reported twice that a BUILT arm does not appear. The first
// cause was exactly in that gap (the rig gated update() on active(),
// which update() is the only thing that can make true). This probe closes
// the gap for good: it constructs the REAL createWeaponRig against a REAL
// WebGL2 renderer and drives rig.frame()/rig.draw() the way a host does,
// then reads the DEFAULT FRAMEBUFFER - the pixels a player would see -
// rather than the offscreen target the arm probe reads.
//
// Usage: node tools/mwRigProbe.mjs
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const zt = (s) => [...ascii(s), 0];
function buildBsa(entries) {
  const n = entries.length;
  const names = []; const nameOffsets = [];
  let no = 0;
  for (const e of entries) { nameOffsets.push(no); names.push(...zt(e.name)); no += e.name.length + 1; }
  const dirsize = 12 * n + names.length;
  const table = []; let off = 0;
  for (const e of entries) { table.push(...u32(e.data.length), ...u32(off)); off += e.data.length; }
  for (const o of nameOffsets) table.push(...u32(o));
  return Uint8Array.from([...u32(0x100), ...u32(dirsize), ...u32(n), ...table, ...names,
    ...new Array(8 * n).fill(0xcd), ...entries.flatMap((e) => [...e.data])]);
}
const sub = (name, data) => [...ascii(name), ...u32(data.length), ...data];
const PARTS = ['head', 'hair', 'neck', 'chest', 'groin', 'hand', 'wrist', 'forearm', 'upperarm'];
const body = (id, race, part, model) => {
  const d = [...sub('NAME', zt(id)), ...sub('MODL', zt(model)), ...sub('FNAM', zt(race)),
    ...sub('BYDT', [PARTS.indexOf(part), 0, 0, 0])];
  return [...ascii('BODY'), ...u32(d.length), ...u32(0), ...u32(0), ...d];
};
const loose = (n) => [...readFileSync(`test/fixtures/mw/${n}`)];
// The FIRST-PERSON-SHAPED fixtures (MW-D10). armskel's arms hang
// straight down like a T-pose and armidle swings them 90 degrees, which
// is right for the clip laws they were built for and useless for
// measuring where an arm lands on screen. These have an eye, arms
// forward of and below it, and a quiet sway.
const BSA = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armfp.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armfpidle.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
]);
const ESM = Uint8Array.from([
  ...body('b_fp_hand_1st', 'fprace', 'hand', 'b/H1.nif'),
  ...body('b_fp_forearm_1st', 'fprace', 'forearm', 'b/U.nif'),
]);

const server = await createServer({ server: { port: 5231, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') crashes.push(`console: ${m.text()}`); });
await page.goto('http://localhost:5231/mw-inspect.html');

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? `  ${extra}` : ''}`);
  if (!cond) fails.push(label);
};

const out = await page.evaluate(async ({ bsa, esm }) => {
  const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const [{ Renderer }, { MwBsaFile }, fp, rig] = await Promise.all([
    import('/src/render/renderer.js'),
    import('/src/formats/mwBsaFile.js'),
    import('/src/combat/fpArm.js'),
    import('/src/combat/weaponRig.js'),
  ]);
  const cv = document.createElement('canvas');
  cv.style.width = '960px'; cv.style.height = '720px';
  document.body.append(cv);
  const renderer = new Renderer(cv);

  // THE HOST'S OWN CONSTRUCTION, as world.js:1307 writes it.
  const entity = { items: [], equipCountdown: 0 };
  const log = [];
  const weaponRig = rig.createWeaponRig({
    renderer,
    canvas: cv,
    fetchBytes: async () => { throw new Error('no ARENA2 in this probe'); },
    palette: null,
    audio: { playOneShot() {}, ensure() {} },
    entity,
    camera: () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: window.__pitch || 0 }),
    say: (s) => log.push(s),
    bindWorn: false,
  });

  // The card's build: the SHIPPED singleton, which is what the rig holds.
  const archive = new MwBsaFile(bytes(bsa));
  const built = await fp.fpArm.build({
    race: 'fprace',
    female: false,
    deps: {
      loadMorrowindArchives: async () => [archive],
      storedMorrowindNames: async () => ['Morrowind.esm'],
      loadMorrowindFile: async () => bytes(esm),
    },
  });

  // A LIT-PIXEL COUNT CANNOT FAIL HERE: the canvas is opaque, so every
  // pixel is "lit" whether the arm drew or not - the first run of this
  // probe answered 691200 out of 960x720, which is the whole screen.
  // What can fail is a DIFFERENCE against the same frame with the arm
  // unloaded, which is the picture the player has been getting.
  const grab = () => {
    const gl = renderer.gl;
    const w = gl.drawingBufferWidth; const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { px, w, h };
  };
  // WHERE, not just whether. MW-D8's framing put the arms adrift at the
  // horizon and every measurement in this tree still passed, because all
  // of them asked "are there lit pixels" or "is the model symmetric" -
  // questions a mis-framed arm answers yes to. This one asks where on
  // the screen the ink landed.
  const diff = (a, b) => {
    let n = 0; let sx = 0; let sy = 0;
    let minY = 1e9; let maxY = -1e9;
    // MW-D11: the fixture texture is four solid quadrants - RED, GREEN,
    // BLUE and white - so a TEXTURED arm puts strongly-hued pixels on the
    // screen and an untextured one (white lit by a white sun) cannot.
    // "Is there ink" passed a flat arm for three slices; this asks what
    // COLOUR the ink is.
    let hued = 0;
    for (let i = 0, p = 0; i < a.px.length; i += 4, p++) {
      if (Math.abs(a.px[i] - b.px[i]) > 6 || Math.abs(a.px[i + 1] - b.px[i + 1]) > 6
        || Math.abs(a.px[i + 2] - b.px[i + 2]) > 6) {
        const x = p % a.w; const y = (p / a.w) | 0;
        n++; sx += x; sy += y;
        const r = a.px[i]; const g = a.px[i + 1]; const bl = a.px[i + 2];
        const mx = Math.max(r, g, bl); const mn = Math.min(r, g, bl);
        if (mx > 40 && mx - mn > 60) hued++;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    // readPixels puts y = 0 at the BOTTOM, so a small y is low on screen.
    return n ? {
      n,
      hued,
      cx: sx / n / a.w,
      cy: sy / n / a.h,
      lowest: minY / a.h,
      highest: maxY / a.h,
    } : { n: 0 };
  };

  // A neutral world frame, then the host's two calls, in the host's order.
  const I = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const beforeToggle = { sheathed: weaponRig.playerWeapon.sheathed };
  weaponRig.toggleSheath();
  const runFrames = (n) => {
    for (let i = 0; i < n; i++) {
      renderer.beginFrame(I, I, new Float32Array([0.3, -0.9, 0.2]));
      weaponRig.frame(1 / 60);
      weaponRig.draw();
    }
  };
  window.__pitch = 0;
  runFrames(4);
  const withArm = grab();
  const armFrames = fp.fpArm.frames;
  const activeWhenDrawn = fp.fpArm.active();
  // Look UP. The arms are attached to the rig, not the lens, so they
  // must slide DOWN the frame - the neck takes 0.75 of the pitch and
  // the lens all of it, which is the lag rule 54 produces.
  window.__pitch = 0.5;
  runFrames(1);
  const pitchedUp = grab();

  // THE CONTROL: the same host, the same frames, no arm. Whatever this
  // leaves on the screen is what Mac has been looking at.
  fp.fpArm.unload();
  runFrames(4);
  const withoutArm = grab();

  // ---- THE BOOT ORDER, which is the order a player actually hits.
  //
  // scenes/shared.js starts registerMorrowindData() when a host boots and
  // does not wait for it; createWeaponRig latches the generation
  // SYNCHRONOUSLY, during the same host setup. So the rig's latch is
  // taken BEFORE the count lands. If that first count counts as a
  // generation change, the rig's very first frame calls fpArm.unload()
  // and throws away whatever the player built.
  const ds = await import('/src/scenes/dataSource.js');
  const rebuilt = await fp.fpArm.build({
    race: 'fprace',
    female: false,
    deps: {
      loadMorrowindArchives: async () => [archive],
      storedMorrowindNames: async () => ['Morrowind.esm'],
      loadMorrowindFile: async () => bytes(esm),
    },
  });
  const rig2 = rig.createWeaponRig({
    renderer,
    canvas: cv,
    fetchBytes: async () => { throw new Error('no ARENA2 in this probe'); },
    palette: null,
    audio: { playOneShot() {}, ensure() {} },
    entity: { items: [], equipCountdown: 0 },
    camera: () => ({ pos: [0, 1.6, 0], yaw: 0 }),
    say: () => {},
    bindWorn: false,
  });
  rig2.toggleSheath();
  const genBefore = ds.morrowindDataGeneration();
  await ds.registerMorrowindData().catch(() => 0);     // the boot arm landing
  const genAfter = ds.morrowindDataGeneration();
  renderer.beginFrame(I, I, new Float32Array([0.3, -0.9, 0.2]));
  rig2.frame(1 / 60);
  rig2.draw();

  return {
    built: { ok: built.ok, stage: built.stage, error: built.error, notes: built.notes },
    beforeToggle,
    sheathedAfter: weaponRig.playerWeapon.sheathed,
    armFrames,
    activeWhenDrawn,
    changed: diff(withArm, withoutArm),
    pitched: diff(pitchedUp, withoutArm),
    total: withArm.w * withArm.h,
    log,
    boot: {
      rebuiltOk: rebuilt.ok,
      genBefore,
      genAfter,
      survives: fp.fpArm.status().reason !== 'unloaded',
      reason: fp.fpArm.status().reason,
    },
  };
}, { bsa: Buffer.from(BSA).toString('base64'), esm: Buffer.from(ESM).toString('base64') });

console.log(JSON.stringify(out, null, 1).slice(0, 1200));
ok(out.built.ok, 'the arm builds through the shipped singleton', out.built.error || '');
ok(out.sheathedAfter === false, 'the rig unsheathes on toggleSheath');
ok(out.armFrames >= 4, 'the RIG steps the arm every frame', `frames=${out.armFrames}`);
ok(out.activeWhenDrawn, 'and the arm is drawable after the rig has stepped it');
ok(out.changed.n > 500, 'AND THE ARM CHANGES THE SCREEN vs the same frame without it',
  `changed=${out.changed.n} of ${out.total}`);
ok(out.changed.cy < 0.5, 'THE ARMS HANG IN THE LOWER FRAME, where hands are',
  `centroid y=${out.changed.cy && out.changed.cy.toFixed(3)} (0 = bottom)`);
ok(out.changed.n / out.total > 0.02, 'and they are ARM-SIZED, not a distant speck',
  `coverage=${(out.changed.n / out.total * 100).toFixed(1)}%`);
ok(out.changed.hued > out.changed.n * 0.3,
  'AND THE ARM IS TEXTURED - the fixture texture\'s red/green/blue quadrants reach the screen',
  `hued=${out.changed.hued} of ${out.changed.n}`);
ok(out.pitched.n > 500 && out.pitched.cy < out.changed.cy,
  'looking UP slides them DOWN the frame - they ride the rig, not the lens',
  `cy ${out.changed.cy && out.changed.cy.toFixed(3)} -> ${out.pitched.cy && out.pitched.cy.toFixed(3)}`);
ok(out.boot.rebuiltOk, 'the arm rebuilds for the boot-order case');
ok(out.boot.genAfter === out.boot.genBefore,
  'the FIRST count is not a data change - an empty store changed nothing',
  `gen ${out.boot.genBefore} -> ${out.boot.genAfter}`);
ok(out.boot.survives,
  'AND A BUILT ARM SURVIVES THE HOST BOOT', `reason=${out.boot.reason}`);
if (crashes.length) console.log('page errors:', crashes.slice(0, 5));

await browser.close();
await server.close();
process.exit(fails.length ? 1 : 0);
