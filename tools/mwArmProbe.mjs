// MW-D8 LIVE PROOF: THE ARM'S GL PATH, IN A REAL BROWSER.
//
// The in-game probes in this tree (deedProbe, hudProbe, arrestProbe...)
// boot the actual game and therefore need ARENA2_PATH - the player's own
// Daggerfall data. This one deliberately does NOT, because the thing
// MW-D8 adds that has never executed anywhere is the GL path: pack an
// assembled Morrowind arm into the character vertex stream, run it
// through renderCharacterSprite's offscreen first-person pass, and
// composite it. That path is identical in the game and here, and here it
// can be measured on every run rather than only on Mac's machine.
//
// What this canNOT see, stated so nobody mistakes green for finished:
// weaponRig's branch, the four hosts' camera dep, and the enhanced-menu
// card are pinned in node (test/fparm.test.js, test/mwattach.test.js)
// and proven by Mac in the game. This probe proves the arm DRAWS.
//
// THE LESSONS IT IS BUILT AROUND:
//   MW-D6 - a lit-pixel count PASSED a one-handed arm (1116 px). So the
//           layers below include a per-piece signed readback and an
//           x-symmetry score, not a coverage number alone.
//   MW-D7 - every layer that drives the pose ITSELF passed a page frozen
//           on frame one. So L5 runs the module's own clip trace AND
//           compares two independently-driven frames.
//
// Usage: node tools/mwArmProbe.mjs
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

// ---- a REAL archive, so the whole chain below is the real one --------
// Only IndexedDB is stubbed (buildFpArm's `deps` seam). MwBsaFile,
// bodyParts, armReport, armMeshPaths, assembleFirstPersonArm, clipReport
// and the renderer are all the shipped code.
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
const body = (id, race, part, { female = false, model = 'b/x.nif' } = {}) => {
  const d = [...sub('NAME', zt(id)), ...sub('MODL', zt(model)), ...sub('FNAM', zt(race)),
    ...sub('BYDT', [PARTS.indexOf(part), 0, female ? 1 : 0, 0])];
  return [...ascii('BODY'), ...u32(d.length), ...u32(0), ...u32(0), ...d];
};
const loose = (n) => [...readFileSync(`test/fixtures/mw/${n}`)];

const BSA = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armfp.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armfpidle.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
]);
// The FOREIGN-clip archive for L6: same arm, but the .kf keys "Bone1",
// a bone this skeleton does not have. poseSkeleton then answers every
// bone with node.rest and draws a clean, static, entirely plausible arm.
const BSA_BLIND = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armfp.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('xfixture.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
]);
// MW-D9: a SECOND skeleton, the one that HAS the weapon bones. armskel
// deliberately lacks them (MW-D4 asserts a skeleton that lacks a bone
// SAYS so), so both halves of rule 8's attach-bone column stay reachable.
const BSA_WEAPON = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armfp.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armfpidle.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
  { name: 'meshes\\w\\blade.nif', data: loose('weapon.nif') },
]);
// The mesh IS here and the BONE is not - armskel omits Weapon Bone by
// design. Without this third archive the missing-bone path is
// unreachable, because the plain archive lacks the weapon mesh too and
// the build refuses one step earlier for a different reason.
const BSA_NO_WEAPON_BONE = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armfpnoweapon.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armfpidle.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
  { name: 'meshes\\w\\blade.nif', data: loose('weapon.nif') },
]);
// MW-D34: the THIRD-PERSON archive - the same skeleton/parts/clip
// fixtures published under the third-person names (base_anim.nif walks
// rule 18: xbase_anim.kf exists, so the x-form skeleton must too), plus
// the sword whose Weapon Bone seat (+X, the actor's right) is the one
// asymmetric witness a chirality question can lean on.
const BSA_THIRD = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armfp.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armfpidle.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
  { name: 'meshes\\w\\blade.nif', data: loose('weapon.nif') },
  { name: 'meshes\\Base_Anim.nif', data: loose('armfp.nif') },
  { name: 'meshes\\xBase_Anim.nif', data: loose('armfp.nif') },
  { name: 'meshes\\xBase_Anim.kf', data: loose('armfpidle.kf') },
]);
const wpdt = (type) => { const b = new Uint8Array(32); new DataView(b.buffer).setInt16(8, type, true); return [...b]; };   // MW-D22: mType at byte 8 (loadweap.hpp)
const weap = (id, model, type, name) => {
  const d = [...sub('NAME', zt(id)), ...sub('MODL', zt(model)), ...sub('FNAM', zt(name)), ...sub('WPDT', wpdt(type))];
  return [...ascii('WEAP'), ...u32(d.length), ...u32(0), ...u32(0), ...d];
};
const ESM_WEAPON = Uint8Array.from([
  ...body('b_n_nord_m_hands.1st', 'nord', 'hand', { model: 'b/H1.nif' }),
  ...body('b_n_nord_m_forearm', 'nord', 'forearm', { model: 'b/U.nif' }),
  // ONE mesh, and the two rows below are what put it in two different
  // hands: type 1 goes on Weapon Bone, type 9 (the bow) on Weapon Bone
  // Left. Same bytes, two bones - which is the whole of rule 8's column.
  ...weap('iron longsword', 'w/blade.nif', 1, 'Iron Longsword'),
  ...weap('long bow', 'w/blade.nif', 9, 'Long Bow'),
]);
// MW-D34: the third-person ESM adds the non-.1st records the body sweep
// resolves (the .1st rows serve only the first-person arm).
const ESM_THIRD = Uint8Array.from([
  ...ESM_WEAPON,
  ...body('b_n_nord_m_hand', 'nord', 'hand', { model: 'b/H1.nif' }),
]);

const ESM = Uint8Array.from([
  ...body('b_n_nord_m_hands.1st', 'nord', 'hand', { model: 'b/H1.nif' }),
  ...body('b_n_nord_m_upper arm', 'nord', 'upperarm', { model: 'b/U.nif' }),
]);

const server = await createServer({ server: { port: 5224, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

await page.goto('http://localhost:5224/mw-inspect.html');

const b64 = (u8) => Buffer.from(u8).toString('base64');
const FIX = {
  bsa: b64(BSA), blind: b64(BSA_BLIND), esm: b64(ESM),
  weaponBsa: b64(BSA_WEAPON), weaponEsm: b64(ESM_WEAPON), noBoneBsa: b64(BSA_NO_WEAPON_BONE),
  thirdBsa: b64(BSA_THIRD), thirdEsm: b64(ESM_THIRD),
};
// The port's own template indices, so the probe drives the SAME mapping
// the game does rather than a second copy of it.
const T = { Longsword: 120, Long_Bow: 130, Dagger: 113 };

/** Boot the REAL fpArm through its deps seam and drive it. Everything
 *  inside is shipped code; only IndexedDB is replaced. */
async function boot(bsaB64, { esm = FIX.esm, weapon = null } = {}) {
  return page.evaluate(async ({ bsa, esm, weapon }) => {
    const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const [{ Renderer }, { MwBsaFile }, fp] = await Promise.all([
      import('/src/render/renderer.js'),
      import('/src/formats/mwBsaFile.js'),
      import('/src/combat/fpArm.js'),
    ]);
    let cv = document.getElementById('armcv');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'armcv';
      cv.style.width = '960px'; cv.style.height = '720px';
      document.body.append(cv);
    }
    window.__r = window.__r || new Renderer(cv);
    const renderer = window.__r;

    const arm = fp.createFpArm();
    // Yaw is LIVE, because two different layers need two different
    // values: x-symmetry is only meaningful looking straight down the
    // arm's own axis (yaw 0), while a sign error in the x placement is
    // INVISIBLE there, since sin(0) is 0 and the whole term vanishes.
    // The mutation campaign found exactly that hole, so L3b sweeps.
    window.__yaw = 0;
    window.__pitch = 0;   // IG1: the look, driven live like the yaw
    window.__bob = [0, 0]; // IG1: the head bob pair the hosts feed
    arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: window.__yaw, pitch: window.__pitch, bob: window.__bob }));
    const archive = new MwBsaFile(bytes(bsa));
    const deps = {
      loadMorrowindArchives: async () => [archive],
      storedMorrowindNames: async () => ['Morrowind.esm'],
      loadMorrowindFile: async () => bytes(esm),
    };
    const built = await arm.build({ race: 'nord', female: false, weapon, deps });
    window.__arm = arm;
    window.__armRaw = built.ok ? built.arm : null;
    window.__cv = cv;
    window.__frame = () => {
      // A neutral frame so drawCharacter's light caches are populated.
      const I = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
      renderer.beginFrame(I, I, new Float32Array([0.3, -0.9, 0.2]));
    };
    return { built: { ok: built.ok, stage: built.stage, error: built.error }, status: arm.status() };
  }, { bsa: bsaB64, esm, weapon });
}

/** Alpha readback off the OFFSCREEN first-person target. It is cleared to
 *  (0,0,0,0) before the arm draws (renderer.js:764), so alpha != 0 IS the
 *  arm - nothing else can put ink there. */
async function shoot(t) {
  return page.evaluate((time) => {
    const arm = window.__arm;
    window.__frame();
    arm.update(time.dt);
    const drew = arm.draw(window.__cv);
    const wantW = window.__cv.clientWidth / 9; const wantH = window.__cv.clientHeight / 9;
    const sc = Math.min(1, 512 / wantW, 512 / wantH);
    window.__vp = { pw: Math.max(2, Math.round(wantW * sc)), ph: Math.max(2, Math.round(wantH * sc)) };
    const gl = window.__r.gl;
    const cs = window.__r._charSpriteRT();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    // READ THE VIEWPORT, NOT THE WHOLE TARGET. renderCharacterSprite
    // draws into a pw x ph corner of a fixed 512 x 512 RT
    // (renderer.js:759 then :764), so coverage measured over the whole
    // texture is bounded by (pw*ph)/512^2 - about 3% here - and a
    // threshold set against the texture would be measuring the padding.
    const vp = window.__vp;
    const S = vp.pw; const SH = vp.ph;
    const px = new Uint8Array(S * SH * 4);
    gl.readPixels(0, 0, S, SH, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const B = 2; const W = Math.ceil(S / B);
    const cell = new Uint8Array(W * W);
    let lit = 0; let minX = 1e9; let maxX = -1e9; let minY = 1e9; let maxY = -1e9;
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < S; x++) {
        if (px[(y * S + x) * 4 + 3] > 8) {
          lit++;
          cell[((y / B) | 0) * W + ((x / B) | 0)] = 1;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    let hit = 0; let tot = 0;
    const H = Math.ceil(SH / B);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (cell[j * W + i]) { tot++; if (cell[j * W + (W - 1 - i)]) hit++; }
      }
    }
    return {
      drew,
      lit,
      viewport: [S, SH],
      coveredFrac: lit / (S * SH),
      bbox: lit ? { x0: minX / S, x1: maxX / S, y0: minY / SH, y1: maxY / SH } : null,
      sym: tot ? hit / tot : 0,
      cells: tot,
      hash: [...cell].reduce((a, c) => (a * 31 + c) | 0, 7),
      frames: arm.frames,
    };
  }, { dt: t });
}

// ── L0: A BUILD THAT CANNOT REACH ITS DATA IS NOT A BROKEN SCREEN ──
const nodata = await page.evaluate(async () => {
  const fp = await import('/src/combat/fpArm.js');
  const arm = fp.createFpArm();
  const res = await arm.build({ race: 'nord', deps: { loadMorrowindArchives: async () => [] } });
  return { ok: res.ok, stage: res.stage, error: res.error, active: arm.active(), drew: arm.draw({ clientWidth: 100, clientHeight: 100 }) };
});
ok(nodata.ok === false && nodata.stage === 'data', `no archives attached is a NAMED refusal, not a throw (${nodata.stage}: ${nodata.error})`);
ok(nodata.active === false, 'and active() answers false, so weaponRig falls through to the classic sprite');
ok(nodata.drew === false, 'and draw() is a no-op rather than a half-drawn frame');

// ── L1: THE BUILD IS HONEST ABOUT ITS INPUT ─────────────────────────
const boot1 = await boot(FIX.bsa);
ok(boot1.built.ok, `the arm BUILDS from a real archive${boot1.built.ok ? '' : ` (${boot1.built.stage}: ${boot1.built.error})`}`);
ok(boot1.status.skeletonPath === 'meshes/xbase_anim.1st.nif',
  `and it took rule 6's male non-beast skeleton, not the name the reverted rig hardcoded (${boot1.status.skeletonPath})`);
ok(boot1.status.pieces === 4, `four pieces bound - a skinned hand per side, a rigid cuff per side (${boot1.status.pieces})`);
ok(boot1.status.binding && boot1.status.binding.matched.length === 4,
  `and all four clip tracks bind to a bone (${boot1.status.binding ? boot1.status.binding.matched.length : 'none'})`);
// MW-D10: rule 54 is no longer "measured, not assumed" - it is the
// placement. The rig has to carry the node the camera tracks, and a rig
// that does not is REFUSED by name rather than framed by invention.
ok(boot1.status.cameraBone === 'Camera',
  `the rig carries the node rule 54 tracks (${boot1.status.cameraBone})`);
const bootNoCam = await boot(b64(buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armskel.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armfphand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armfparm.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armfpidle.kf') },
  { name: 'textures\\tx_fixture.dds', data: loose('fixture.dds') },
])));
ok(bootNoCam.built.ok === false && bootNoCam.built.stage === 'camera',
  `and a rig with neither Camera nor Head REFUSES by stage (${bootNoCam.built.stage}: ${bootNoCam.built.error})`);
// boot() REPLACES the page's live arm, so the refusal above has to be
// undone before the layers below measure one - found by watching every
// later layer report zero.
await boot(FIX.bsa);

// ── L2: IT DRAWS, INTO THE FIRST-PERSON TARGET ──────────────────────
const s1 = await shoot(0.016);
console.log('    MEASURED:', JSON.stringify({ vp: s1.viewport, lit: s1.lit, cover: +(s1.coveredFrac * 100).toFixed(2), bbox: s1.bbox, sym: +s1.sym.toFixed(2), cells: s1.cells }));
ok(s1.drew === true, 'draw() reports it ran the first-person pass');
ok(s1.lit > 20, `and the first-person target has ink in it (${s1.lit} lit texels in a ${s1.viewport.join('x')} viewport)`);


// ── L3b: THE ARM IS IN FRONT OF THE PLAYER AT EVERY HEADING ─────────
// The placement is built from sin/cos of the yaw, and at yaw 0 the sine
// term is zero - so an x-axis sign error draws perfectly at the only
// heading a single-shot probe would ever test, and puts the arm behind
// the player at every other. Sweep.
const sweep = [];
for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 3]) {
  await page.evaluate((y) => { window.__yaw = y; }, yaw);
  // dt ZERO. Every shoot() advances the clip, so a sweep at a live dt
  // measures five different POSES and calls the variance a heading
  // effect. Hold time still and yaw is the only thing that moves.
  const sh = await shoot(0);
  sweep.push({ yaw: +(yaw * 180 / Math.PI).toFixed(0), lit: sh.lit });
}
await page.evaluate(() => { window.__yaw = 0; });
ok(sweep.every((x) => x.lit > 20),
  `the arm is in front of the player at EVERY heading (${sweep.map((x) => `${x.yaw}deg:${x.lit}`).join(' ')})`);

// ── L4: TWO HANDS, NOT ONE - MW-D6's DEFECT ─────────────────────────
// A lit-pixel count PASSED a one-handed arm. Three independent signals.
const rows = await page.evaluate(() => window.__arm.rows());
ok(rows && rows.length === 4, `four pieces in the live game assembly (${rows ? rows.length : 'none'})`);
const by = (b) => rows.find((r) => r.bone === b);
ok(by('left hand') && by('right hand'),
  'BOTH hands bound - a latch that stops after the first bone gives one');
// AT REST each side sits on its own side of x=0 (rule 15's filter). Under
// the CLIP they legitimately swing across each other - MW-D7 measured the
// right hand at maxX -0.286 at t=1.0 - so this is asserted at rest, where
// it is a statement about the binding, and not mid-animation, where it
// would be a statement about the pose and simply false.
const restRows = await page.evaluate(async () => {
  const [mwfp, mwanim] = await Promise.all([
    import('/src/formats/mwFirstPerson.js'), import('/src/formats/mwAnim.js')]);
  const arm = window.__armRaw;
  mwfp.poseAssembly(arm, {});            // rest pose: no tracks, t=0
  return mwfp.armPieceRows(arm.pieces).map((r) => ({ bone: r.bone, minX: r.bounds.minX, maxX: r.bounds.maxX }));
});
const rb = (b) => restRows.find((r) => r.bone === b);
ok(rb('left hand').maxX <= 0 && rb('right hand').minX >= 0,
  'and AT REST rule 15 put each SKINNED side on its own side of x=0');
const lc = by('left upper arm'); const rc = by('right upper arm');
ok(lc.mirrored === true && rc.mirrored === false, 'the LEFT rigid piece is the mirrored one (rule 13)');
ok(Math.abs(lc.bounds.minX + rc.bounds.maxX) < 1e-3,
  'and it is the right one with X negated, exactly');

// ── L5: ANIMATING, NOT FROZEN - MW-D7's DEFECT ──────────────────────
// Every layer above drives the pose itself, so all of them pass a page
// frozen on frame one. These two do not.
const shots = [];
for (let i = 0; i < 14; i++) shots.push(await shoot(0.2));
const hashes = new Set(shots.map((x) => x.hash));
ok(hashes.size >= 5,
  `the drawn picture CHANGES across the clip - a clip that bound nothing gives 1 (${hashes.size} distinct of ${shots.length})`);
const framesAdvanced = shots[shots.length - 1].frames - shots[0].frames;
ok(framesAdvanced === shots.length - 1,
  `and the module's own frame counter advanced with it (${framesAdvanced})`);
const widest = shots.reduce((a, b) => (b.bbox && (!a.bbox || (b.bbox.x1 - b.bbox.x0) > (a.bbox.x1 - a.bbox.x0)) ? b : a));
console.log('    WIDEST FRAME:', JSON.stringify({ cover: +(widest.coveredFrac * 100).toFixed(2), bbox: widest.bbox, sym: +widest.sym.toFixed(2) }));
ok(widest.coveredFrac > 0.004 && widest.coveredFrac < 0.75,
  `at its widest the arm is neither a degenerate point nor a wall of geometry (${(widest.coveredFrac * 100).toFixed(2)}% of the frame)`);
ok(widest.bbox.x1 - widest.bbox.x0 > 0.35,
  `and it opens across the frame as the clip swings it out (${((widest.bbox.x1 - widest.bbox.x0) * 100).toFixed(0)}% of the width)`);
ok(widest.sym >= 0.85, `staying x-symmetric while it does (${widest.sym.toFixed(2)})`);
// THE MAPPER IS FIXED ONCE, and this is the only layer that can tell.
// Recomputed per frame from the live bounds it renormalises the picture:
// the arm then subtends the SAME width at every instant, the shape still
// changes, and every other layer above stays green. So measure the RANGE
// of the on-screen width, not just its maximum.
const widths = shots.filter((x) => x.bbox).map((x) => x.bbox.x1 - x.bbox.x0);
const wRange = Math.max(...widths) - Math.min(...widths);
ok(wRange > 0.15,
  `and the arm's on-screen WIDTH varies across the clip (${(wRange * 100).toFixed(0)} points) - a mapper `
  + 'recomputed per frame renormalises that to a constant and hides the motion');

// THE LOOP LAW, through the module's own trace. A `% span` player moves,
// stays symmetric and draws - and replays the clip's INTRO on every wrap.
// Only a trace tells the two apart.
const trace = await page.evaluate(() => window.__arm.trace({ dt: 0.2, steps: 40, loopCount: 2 }));
ok(trace && trace.length > 6 && Math.abs(trace[0].time - 1.2) < 1e-3,
  `the clip starts at 1.0, not 0 - a forward scan takes the decoy block (first step ${trace && trace[0] && trace[0].time})`);
const stopIdx = trace.findIndex((r) => r.loopStopTime === 2.5);
ok(stopIdx > 0, 'the loop window is DISCOVERED by crossing its key, not read at load');
ok(trace.slice(stopIdx + 1).every((r) => r.time >= 1.5 - 1e-6),
  'and after the first wrap the playhead never re-enters the clip intro');
ok(new Set(trace.map((r) => Math.round(r.rightHandMaxX * 100))).size >= 3,
  'the pose moves through at least three distinct positions, measured on the piece itself');

// ── L5b: THE WEAPON - RIGHT BONE, RIGHT HAND, AND IT DRAWS ──────────
// The thing the arms exist to hold. One mesh, two records, two types -
// so a port that ignores rule 8's attach-bone column puts the bow in the
// sword's hand and every pixel still looks plausible.
const sword = await boot(FIX.weaponBsa, { esm: FIX.weaponEsm, weapon: { templateIndex: T.Longsword } });
ok(sword.built.ok, `the arm builds with a weapon in it${sword.built.ok ? '' : ` (${sword.built.stage}: ${sword.built.error})`}`);
ok(sword.status.weapon && sword.status.weapon.id === 'iron longsword',
  `a Daggerfall Longsword resolves to a Morrowind LongBladeOneHand record (${sword.status.weapon && sword.status.weapon.id})`);
ok(sword.status.weapon && sword.status.weapon.bone === 'Weapon Bone',
  `and hangs on the generic bone (${sword.status.weapon && sword.status.weapon.bone})`);
ok(sword.status.pieces === 5, `five pieces now - four arm, one weapon (${sword.status.pieces})`);
const swordRows = await page.evaluate(() => window.__arm.rows());
const swordW = swordRows.find((r) => r.slot === 'weapon');
ok(!!swordW, 'the weapon is a piece in the assembly, through the same rigid path as the cuff');
ok(swordW && swordW.kind === 'rigid', `and it is RIGID, not skinned (${swordW && swordW.kind})`);
ok(swordW && swordW.mirrored === false, 'and NOT mirrored, because "Weapon Bone" carries no "Left"');
ok(swordW && swordW.bounds.maxX > 0, `it is on the RIGHT of centre (maxX ${swordW && swordW.bounds.maxX.toFixed(2)})`);
// RULE 57, ON SCREEN AND BOTH WAYS. An EQUIPPED weapon is not a DRAWN
// one: fpArm boots sheathed and showWeapons keeps the range hidden
// until the draw crosses the equip-attach key (or the .kf carries no
// equip group, as this fixture's does, and it shows at once). The old
// gate here counted lit texels of the WHOLE frame - the arm alone
// satisfied it, and a sword that never rasterized passed as "draws".
const sheathedShot = await shoot(0.016);
ok(sheathedShot.lit > 20, `the sheathed frame draws the ARM (${sheathedShot.lit} lit texels)`);
const drawn = await page.evaluate(() => {
  const arm = window.__arm;
  arm.setSheathed(false);
  let guard = 0;
  while (guard++ < 200 && !arm.status().weaponShown) { window.__frame(); arm.update(0.05); }
  return { shown: arm.status().weaponShown };
});
ok(drawn.shown === true, 'setSheathed(false) SHOWS the weapon - rule 57\'s other half');
const drawnShot = await shoot(0.016);
ok(drawnShot.lit > sheathedShot.lit,
  `and the sword's ink ARRIVES only once drawn (${sheathedShot.lit} sheathed vs ${drawnShot.lit} drawn texels)`);

// HANDEDNESS, ON SCREEN - and CHIRAL this time. MW-D23's lesson: this
// layer used to assert only "ink on both halves", which is symmetric
// under a mirror, and the node pin it leaned on had built its probe
// camera backwards - so a mirrored pass sailed through every layer and
// only Mac's sword could say so. The pixel question now matches the
// model question: at an UNCROSSED pose where the RIGHT hand extends
// far right while the left stays near centre, the ink itself must lean
// RIGHT. A mirrored pass leans it left and dies here. Driven at t=3.0
// because at the clip's start the arms legitimately swing across each
// other and either answer looks right.
const handed = await page.evaluate(() => {
  const arm = window.__arm;
  // Step the live clip to an UNCROSSED pose. At the clip's start the
  // arms swing across each other by design, and either handedness looks
  // right there - the question is only fair once they are apart.
  let rows = arm.rows(); let guard = 0;
  while (guard++ < 200) {
    const rh0 = rows.find((r) => r.bone === 'right hand');
    if (rh0 && rh0.bounds.maxX > 0.5) break;
    window.__frame();
    arm.update(0.05);
    rows = arm.rows();
  }
  arm.draw(window.__cv);
  const rh = rows.find((r) => r.bone === 'right hand');
  const lh = rows.find((r) => r.bone === 'left hand');
  const gl = window.__r.gl;
  const cs = window.__r._charSpriteRT();
  gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
  const { pw, ph } = window.__vp;
  const px = new Uint8Array(pw * ph * 4);
  gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let left = 0; let right = 0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (px[(y * pw + x) * 4 + 3] > 8) { if (x < pw / 2) left++; else right++; }
    }
  }
  return { rhMaxX: rh.bounds.maxX, lhMinX: lh.bounds.minX, left, right };
});
ok(handed.rhMaxX > 0 && handed.lhMinX < 0,
  `at t=3.0 the hands are UNCROSSED, so the sides are a fair question (R ${handed.rhMaxX.toFixed(2)}, L ${handed.lhMinX.toFixed(2)})`);
ok(handed.left > 0 && handed.right > 0,
  `the arm has ink on both halves of the screen (${handed.left} left, ${handed.right} right)`);
// THE CHIRAL WITNESS. The fixture arms are x-symmetric by construction
// (R 0.51 / L -0.51 above), so arm ink alone cannot see a mirror - the
// same blindness that let MW-D9's flip ship. The SWORD is asymmetric:
// it hangs at Weapon Bone (+X, asserted right-of-centre above), so with
// it shown the total ink MUST lean right. A mirrored pass leans it left
// and dies here - which is exactly what Mac's screen showed.
ok(handed.right > handed.left,
  `the INK leans RIGHT with the sword in hand (${handed.right} right vs ${handed.left} left) - a mirrored pass dies here`);

// THE BOW: the SAME mesh bytes, a different WEAP type, and rule 8 sends
// it to the other hand. If the attach-bone column is ignored this lands
// identically to the sword and nothing on screen says otherwise.
const bow = await boot(FIX.weaponBsa, { esm: FIX.weaponEsm, weapon: { templateIndex: T.Long_Bow } });
ok(bow.status.weapon && bow.status.weapon.bone === 'Weapon Bone Left',
  `a BOW goes to the left bone, and only a bow does (${bow.status.weapon && bow.status.weapon.bone})`);
const bowRows = await page.evaluate(() => window.__arm.rows());
const bowW = bowRows.find((r) => r.slot === 'weapon');
ok(bowW && bowW.mirrored === true,
  'and it comes out MIRRORED - rule 13 is a substring test on the bone name, and "Weapon Bone Left" contains "Left"');
ok(bowW && bowW.bounds.minX < 0, `so it is on the LEFT of centre (minX ${bowW && bowW.bounds.minX.toFixed(2)})`);
ok(swordW && bowW && Math.abs(bowW.bounds.minX + swordW.bounds.maxX) < 1e-3,
  'and it is the sword\'s own mesh with X negated, exactly - one mesh, two hands');

// A weapon the archives cannot serve is a NAMED note, and the arms still
// draw. Empty hands with a reason beats no arms at all.
const noWeap = await boot(FIX.weaponBsa, { esm: FIX.weaponEsm, weapon: { templateIndex: T.Dagger } });
ok(noWeap.built.ok === true, 'a weapon type your archives lack does NOT fail the arm');
ok(noWeap.status.weapon === null, 'the hand is simply empty');
ok((noWeap.status.notes || []).some((n) => /^weapon:/.test(n)),
  `and the card says why (${(noWeap.status.notes || []).find((n) => /^weapon:/.test(n))})`);

// And the skeleton that LACKS the weapon bones reports it rather than
// dropping the weapon on the floor of the model origin.
const noBone = await boot(FIX.noBoneBsa, { esm: FIX.weaponEsm, weapon: { templateIndex: T.Longsword } });
ok(noBone.built.ok === true, 'a skeleton without Weapon Bone still builds the arms');
ok((noBone.status.notes || []).some((n) => /no bone "Weapon Bone"/.test(n)),
  `and NAMES the missing bone (${(noBone.status.notes || []).find((n) => /no bone/.test(n)) || 'no note'})`);

// ── L5b: THIRD-PERSON CHIRALITY, THROUGH THE WORLD'S OWN LENS ───────
// MW-D34, and MW-D23's law obeyed this time: the question is MEASURED
// through the REAL composite - drawThird -> drawRigSpriteBox -> the
// mini ortho pass -> the world quad under the HOST's mirrorProjectionX
// (dungeon.js:494's exact lens) - never deduced from one matrix alone.
// The ground truth is the port's own motor law (motor.js:573: the
// player's RIGHT at yaw 0 is +X), anchored per-shot by projecting a
// +X point through this very lens and requiring it screen-RIGHT. The
// witness is the sword: the fixture arms are x-symmetric (ink alone is
// mirror-blind - MW-D9's lesson), so the ink DIFFERENCE between an
// armed and an unarmed boot is the sword, and it must land on the same
// screen side as the motor's right hand.
const thirdShot = async (weapon) => {
  await boot(FIX.thirdBsa, { esm: FIX.thirdEsm, weapon });
  return page.evaluate(async () => {
    const { perspective, lookAt, mirrorProjectionX } = await import('/src/world/mat4.js');
    const arm = window.__arm, r = window.__r, cv = window.__cv;
    const gl = r.gl;
    // Draw the weapon (a fixed pump so armed and unarmed boots share
    // the exact same clip time), then cross into third person.
    arm.setSheathed(false);
    for (let i = 0; i < 120; i++) { window.__frame(); arm.update(0.05); }
    const crossed = arm.setViewMode('third');
    // Fit the camera to the FIXTURE's own measured box (the rig is
    // doll-sized - at retail distances it rasterizes sub-pixel). The
    // lens's SHAPE is the host's law verbatim - mirrorProjectionX over
    // a standard perspective (dungeon.js:494) - only near/far/distance
    // are fitted, and a mirror does not care about metres.
    const { MW_UNITS_PER_METER } = await import('/src/formats/mwFirstPerson.js');
    const u = 1 / MW_UNITS_PER_METER;
    let mnZ = Infinity, mxZ = -Infinity, mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    for (const row of arm.rows()) {
      const b = row.bounds; if (!b) continue;
      mnZ = Math.min(mnZ, b.minZ); mxZ = Math.max(mxZ, b.maxZ);
      mnX = Math.min(mnX, b.minX); mxX = Math.max(mxX, b.maxX);
      mnY = Math.min(mnY, b.minY); mxY = Math.max(mxY, b.maxY);
    }
    const midH = ((mnZ + mxZ) / 2) * u;                       // MW z is world up
    const size = Math.max(mxZ - mnZ, mxX - mnX, mxY - mnY) * u;
    const dist = Math.max(size * 3, 0.02);
    const proj = mirrorProjectionX(perspective(Math.PI / 3, cv.clientWidth / cv.clientHeight, dist / 50, 800));
    const feet = [0, 0, 0]; const yaw = 0;
    const eye = [0, midH, -dist];
    const view = lookAt(eye, [0, midH, 0], [0, 1, 0]);
    // The anchor: one unit toward the MOTOR'S RIGHT (+X at yaw 0).
    const mul = (m, v) => [
      m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12]*v[3],
      m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13]*v[3],
      m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
      m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3],
    ];
    const clip = mul(proj, mul(view, [dist, midH, 0, 1]));
    const anchorNdcX = clip[0] / clip[3];
    gl.clearColor(1, 0, 1, 1);   // a magenta sentinel ground: any DRAWN pixel differs, however dark the lighting
    r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
    arm.update(0.016);
    const drew = arm.drawThird(cv, { proj, view, eye, feet, yaw });
    const w = cv.width, h = cv.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let left = 0, right = 0;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const drawn2 = Math.abs(px[o] - 255) + px[o + 1] + Math.abs(px[o + 2] - 255) > 24;
      if (drawn2) { if ((i % w) < w / 2) left++; else right++; }
    }
    return { crossed, drew, left, right, anchorNdcX, shown: arm.status().weaponShown, viewMode: arm.viewMode() };
  });
};
const bare3p = await thirdShot(null);
ok(bare3p.crossed === true && bare3p.viewMode === 'third',
  `the third-person body builds from the same archives and the view crosses (${bare3p.viewMode})`);
ok(bare3p.drew === true && bare3p.left + bare3p.right > 50,
  `and it COMPOSITES into the world frame (${bare3p.left + bare3p.right} lit px)`);
const sword3p = await thirdShot({ templateIndex: T.Longsword });
ok(sword3p.shown === true && sword3p.drew === true, 'the armed boot shows the sword in third person');
ok(sword3p.anchorNdcX > 0,
  `the lens really is the world's: the motor's RIGHT (+X) projects screen-RIGHT (ndc ${sword3p.anchorNdcX.toFixed(3)})`);
const dLeft = sword3p.left - bare3p.left;
const dRight = sword3p.right - bare3p.right;
ok(dRight > dLeft,
  `THE CHIRAL WITNESS: the sword's ink lands SCREEN-RIGHT - the actor's right hand on the motor's right (Δright ${dRight}, Δleft ${dLeft}) - a mirrored composite dies here`);

await boot(FIX.bsa);   // back to the armed-with-nothing baseline for L6/L7

// (L5b leaves the rig in THIRD person, where draw() correctly no-ops -
// the fresh boot below is the first-person baseline L5c measures.)
// ── L5c: THE LOOK FOLLOWS - PITCH THROUGH THE REAL PASS ─────────────
// IG1 (Mac: "the first person view should follow the camera when up or
// down, which it currently doesn't"). Rule 54's composition: the neck
// takes neckRotateFactor (0.75) of the look, the lens takes all of it,
// so the arms SLIDE by only the remaining quarter and stay in frame.
// Measured, not trusted: drive the camera dep's pitch and read the
// sprite target's ink - the arms must survive a hard look both ways,
// and the ink's centroid must move WITH the look direction on screen
// (look up, arms sit lower in frame; look down, higher - the quarter
// they lag by).
// IG4: THE LAG IS NOW A MODE, and the law layers measure the LAW - so
// the flag goes OFF here (L5c/L5d read the reference's quarter-lag and
// offset slide) and L5e below reads the shipped default's glue.
const followDefault = await page.evaluate(() => {
  const def = window.__arm.followCamera();
  window.__arm.setFollowCamera(false);
  return def;
});
ok(followDefault === true, 'follow-camera is the SHIPPED default (Mac\'s ask; the law path is the toggle)');
const pitchShot = async (pitch) => page.evaluate((p) => {
  const arm = window.__arm;
  window.__pitch = p;
  window.__frame();
  arm.update(0.016);
  const drew = arm.draw(window.__cv);
  if (!drew) return { n: -1, cy: -1 };   // a stale RT must never pass as a measurement
  const gl = window.__r.gl;
  const cs = window.__r._charSpriteRT();
  gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
  const { pw, ph } = window.__vp;
  const px = new Uint8Array(pw * ph * 4);
  gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let n = 0, sy = 0;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    if (px[(y * pw + x) * 4 + 3] > 8) { n++; sy += y; }
  }
  return { n, cy: n ? sy / n / ph : -1 };   // cy in [0,1], 0 = GL bottom row
}, pitch);
await page.evaluate(() => { window.__arm.update(0.05); });
const lookLevel = await pitchShot(0);
const lookUp = await pitchShot(0.5);
const lookDown = await pitchShot(-0.5);
await page.evaluate(() => { window.__pitch = 0; });
ok(lookLevel.n > 20, `level look draws the arms (${lookLevel.n} texels)`);
ok(lookUp.n > 20, `a 0.5 rad look UP keeps the arms in frame (${lookUp.n} texels)`);
ok(lookDown.n > 20, `a 0.5 rad look DOWN keeps the arms in frame (${lookDown.n} texels)`);
// The direction: GL row 0 is the frame's BOTTOM. Looking up, the lens
// out-pitches the 0.75 neck, so the arms sit LOWER on screen (smaller
// cy); looking down, higher (larger cy).
ok(lookUp.cy < lookLevel.cy && lookLevel.cy < lookDown.cy,
  `the arms track the look, lagging the quarter the reference lags (cy up ${lookUp.cy.toFixed(3)} / level ${lookLevel.cy.toFixed(3)} / down ${lookDown.cy.toFixed(3)})`);

// ── L5d: THE BOB MOVES THE VIEW AGAINST THE ARMS ────────────────────
// IG1's other half (Mac: the FP view should follow the camera when up
// or down). The reference's first-person offset is applied TWICE to
// the lens (once through the neck the tracked bone hangs from, again
// by calculateFirstPersonPosition, camera.cpp:149-157) and ONCE to the
// arms (npcanimation.cpp:723) - so a bob UP shows the arms LOWER in
// frame by exactly one offset. head_bobbing.lua:57 drives the same
// channel. Measured with a doll-scale bob (the fixture rig is ~1 MW
// unit tall; the offset converts at MW_UNITS_PER_METER).
const bobShot = async (v) => page.evaluate(async (bv) => {
  window.__bob = [0, bv];
  window.__frame();
  window.__arm.update(0.016);
  const drew = window.__arm.draw(window.__cv);
  if (!drew) return { n: -1, cy: -1 };
  const gl = window.__r.gl;
  const cs = window.__r._charSpriteRT();
  gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
  const { pw, ph } = window.__vp;
  const px = new Uint8Array(pw * ph * 4);
  gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let n = 0, sy = 0;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    if (px[(y * pw + x) * 4 + 3] > 8) { n++; sy += y; }
  }
  return { n, cy: n ? sy / n / ph : -1 };
}, v);
const bobRest = await bobShot(0);
const bobUp = await bobShot(0.0012);   // ~0.084 rig units through the 70/m bridge
await page.evaluate(() => { window.__bob = [0, 0]; });
ok(bobRest.n > 20 && bobUp.n > 20, `the arms draw through the bob (${bobRest.n} / ${bobUp.n} texels)`);
ok(bobUp.cy < bobRest.cy - 0.005,
  `a bob UP shows the arms LOWER - the offset hits the lens twice and the neck once (cy ${bobRest.cy.toFixed(3)} -> ${bobUp.cy.toFixed(3)})`);

// ── L5e: FIXED TO THE SCREEN - THE SHIPPED DEFAULT, MEASURED ────────
// IG6 (Mac's final call: "just make it where it follows the screen.
// Just like classic daggerfall"). With the flag back ON, the neck
// takes the WHOLE look (neckAim 1), the offset is zero at both
// applications, and the lens takes the whole look too - a rigid
// ensemble seen by a lens that rotates with it, so the picture must
// NOT move: not under a hard look either way, not under the bob.
// Exactly the classic sprite's screen-fixed behaviour.
await page.evaluate(() => { window.__arm.setFollowCamera(true); });
const fixLevel = await pitchShot(0);
const fixUp = await pitchShot(0.5);
const fixDown = await pitchShot(-0.5);
const fixHardUp = await pitchShot(1.4);
const fixHardDown = await pitchShot(-1.4);
await page.evaluate(() => { window.__pitch = 0; });
ok(fixLevel.n > 20 && fixUp.n > 20 && fixDown.n > 20 && fixHardUp.n > 20 && fixHardDown.n > 20,
  `fixed arms draw at every look, clamp-hard included (${fixLevel.n} / ${fixUp.n} / ${fixDown.n} / ${fixHardUp.n} / ${fixHardDown.n} texels)`);
ok(Math.abs(fixUp.cy - fixLevel.cy) < 0.02 && Math.abs(fixDown.cy - fixLevel.cy) < 0.02
  && Math.abs(fixHardUp.cy - fixLevel.cy) < 0.02 && Math.abs(fixHardDown.cy - fixLevel.cy) < 0.02,
  `and they hold their place through every look (cy ${fixHardDown.cy.toFixed(3)} / ${fixDown.cy.toFixed(3)} / ${fixLevel.cy.toFixed(3)} / ${fixUp.cy.toFixed(3)} / ${fixHardUp.cy.toFixed(3)})`);
const fixBobRest = await bobShot(0);
const fixBobUp = await bobShot(0.0012);
await page.evaluate(() => { window.__bob = [0, 0]; });
ok(Math.abs(fixBobUp.cy - fixBobRest.cy) < 0.005,
  `and the bob does not slide them against the view (cy ${fixBobRest.cy.toFixed(3)} -> ${fixBobUp.cy.toFixed(3)})`);


// ── L6: THE SILENT FAILURE, REFUSED RATHER THAN DRAWN ───────────────
// A .kf keyed to bones this skeleton lacks poses NOTHING: poseSkeleton
// answers every bone with node.rest and draws a clean, static, entirely
// plausible arm. It must not reach the screen at all.
const blind = await boot(FIX.blind);
ok(blind.built.ok === false && blind.built.stage === 'clip',
  `a .kf that names no Idle group REFUSES at the clip stage (${blind.built.stage}: ${blind.built.error})`);
const blindActive = await page.evaluate(() => ({ active: window.__arm.active(), drew: window.__arm.draw(window.__cv) }));
ok(blindActive.active === false && blindActive.drew === false,
  'active() is false and nothing draws - so weaponRig shows the classic sprite instead of a frozen arm');

// ── L7: THE SPRITE SURVIVES - UNLOAD RETURNS THE GAME ───────────────
const reboot = await boot(FIX.bsa);
ok(reboot.built.ok === true, 'the arm REBUILDS from good data after a refusal - a refusal is not a dead end');
const unloaded = await page.evaluate(() => {
  window.__arm.unload();
  return { active: window.__arm.active(), drew: window.__arm.draw(window.__cv), reason: window.__arm.status().reason };
});
ok(unloaded.active === false && unloaded.drew === false && unloaded.reason === 'unloaded',
  'and Unload puts it back to inactive, which is the classic sprite');

ok(crashes.length === 0, `no pageerrors${crashes.length ? ': ' + crashes.join(' | ') : ''}`);

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
