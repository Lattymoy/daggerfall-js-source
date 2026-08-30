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
const wpdt = (type) => { const b = new Uint8Array(32); new DataView(b.buffer).setInt16(10, type, true); return [...b]; };
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
    arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: window.__yaw }));
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
const swordShot = await shoot(0.016);
ok(swordShot.lit > 20, `and the weapon frame DRAWS (${swordShot.lit} lit texels)`);

// HANDEDNESS, ON SCREEN. The pin in test/fparm.test.js proves the lens
// agrees with the world's; this proves the pixels do. Driven at t=3.0,
// where the clip has the arms UNCROSSED - at the clip's start they
// legitimately swing across each other and either answer looks right.
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
  `and the arm has ink on both halves of the screen (${handed.left} left, ${handed.right} right)`);

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

await boot(FIX.bsa);   // back to the armed-with-nothing baseline for L6/L7

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
