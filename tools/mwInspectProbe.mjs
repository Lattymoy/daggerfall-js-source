// MW-D LIVE PROOF. The reverted arc's node tests were green through three
// broken releases; what caught the real defects every time was a probe that
// drove the actual page. So this one builds a Morrowind archive and record
// file BY HAND, hands them to mw-inspect.html through the REAL file input,
// and reads the verdicts back out of the rendered DOM.
//
// The headline assertion is the one the whole arc turned on: an archive
// WITHOUT meshes/base_anim.1st.nif - the name the reverted rig hardcoded -
// must say so, in words, on screen.
//
// Usage: node tools/mwInspectProbe.mjs
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';

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
const nif = (line, ver) => Uint8Array.from([...ascii(line), 0x0a, ...u32(ver), ...new Array(64).fill(0)]);
const sub = (name, data) => [...ascii(name), ...u32(data.length), ...data];
const PARTS = ['head', 'hair', 'neck', 'chest', 'groin', 'hand', 'wrist', 'forearm', 'upperarm'];
const body = (id, race, part, { female = false, model = 'b/x.nif' } = {}) => {
  const d = [...sub('NAME', zt(id)), ...sub('MODL', zt(model)), ...sub('FNAM', zt(race)),
    ...sub('BYDT', [PARTS.indexOf(part), 0, female ? 1 : 0, 0])];
  return [...ascii('BODY'), ...u32(d.length), ...u32(0), ...u32(0), ...d];
};

const server = await createServer({ server: { port: 5223, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

await page.goto('http://localhost:5223/mw-inspect.html');

// An archive shaped like RETAIL: it has xbase_anim.1st.nif and does NOT
// have base_anim.1st.nif - exactly the situation the reverted rig died on.
// MW-D2: the two arm meshes differ ON PURPOSE - the hand carries a
// NiSkinInstance and the wrist does not - because a page that reports one
// verdict for everything would pass a fixture where they agree.
// The fixture archive is the source for the real files below - a loose
// base_anim.nif does not exist on disk, it lives inside it.
const fixtureBsa = new MwBsaFile(new Uint8Array(readFileSync('test/fixtures/mw/fixture.bsa')));
const nifRecs = (types) => {
  const out = [...ascii('NetImmerse File Format, Version 4.0.0.2'), 0x0a, ...u32(0x04000002)];
  for (const t of types) out.push(...u32(t.length), ...ascii(t), ...[7, 0, 0, 0, 1, 2, 3]);
  return Uint8Array.from(out);
};
//
// MW-D6 REBUILT THIS FIXTURE. Until now the skeleton was the generic
// test rig (SkinRoot/Bone0/Bone1), whose vocabulary is not Morrowind's,
// so assembleFirstPersonArm could bind NOTHING and a probe could only
// ever prove the failure path. armskel.nif carries rule 5's own bone
// names for both sides, and armhand/armcuff are shaped like retail parts
// - so the ASSEMBLY's success path is now measured here, on a page, in
// pixels, which is this lane's whole standing rule.
//
// armskel deliberately omits Weapon Bone, Weapon Bone Left, the spine and
// the clavicles, so MW-D4's MISSING half stays exercised too.
const loose = (n) => new Uint8Array(readFileSync(`test/fixtures/mw/${n}`));
const bsa = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armskel.nif') },
  { name: 'meshes\\Base_Anim_Female.1st.nif', data: nif('NetImmerse File Format, Version 4.0.0.2', 0x04000002) },
  // The HAND: one real file carrying BOTH sides as separately named
  // shapes - the retail shape rule 15's filter exists for.
  { name: 'meshes\\b\\H1.nif', data: loose('armhand.nif') },
  // The WRIST: a record-name STUB the strict reader must refuse, so the
  // draw panel's "name your failure stage" behaviour stays proven. Its
  // scan still reads rigid, which is what MW-D2 asserts.
  { name: 'meshes\\b\\W.nif', data: nifRecs(['NiNode', 'NiTriShape']) },
  // The UPPER ARM: a real RIGID part, asymmetric in x, which is what
  // makes rule 13's mirror measurable off the pixels.
  { name: 'meshes\\b\\U.nif', data: loose('armcuff.nif') },
  // MW-D7: THE IDLE CLIP, at rule 6's own path. Until now this archive
  // carried no animation source at all, so the page printed ABSENT for it
  // and the assembly could only ever be drawn at rest.
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('armidle.kf') },
]);
const esm = Uint8Array.from([
  ...body('b_n_nord_m_hand.1st', 'nord', 'hand', { model: 'b/H1.nif' }),
  ...body('b_n_nord_m_wrist', 'nord', 'wrist', { model: 'b/W.nif' }),   // third-person only
  // Part VI found `b_n_nord_m_upper arm` on retail - the id carries a
  // SPACE, and any lookup assuming record ids are token-safe breaks on
  // this slot specifically. The fixture keeps the space.
  ...body('b_n_nord_m_upper arm', 'nord', 'upperarm', { model: 'b/U.nif' }),
  ...body('b_n_nord_m_chest', 'nord', 'chest'),                          // not an arm
]);

await page.setInputFiles('#file', [
  { name: 'Morrowind.bsa', mimeType: 'application/octet-stream', buffer: Buffer.from(bsa) },
  { name: 'Morrowind.esm', mimeType: 'application/octet-stream', buffer: Buffer.from(esm) },
]);
await page.waitForSelector('#out table', { timeout: 10000 });
const text = await page.textContent('#out');

ok(/6 files/.test(text), 'the archive is read and its file count shown');
ok(/xbase_anim\.1st\.nif[\s\S]{0,80}present/.test(text), 'the REAL first-person skeleton is reported present');
ok(/base_anim\.1st\.nif[\s\S]{0,120}ABSENT/.test(text),
  'and the name the reverted rig hardcoded is reported ABSENT');
ok(/not in this archive[\s\S]{0,200}never drew anything/.test(text),
  'the page SAYS WHY IN WORDS, which is the whole point of it');
ok(/4\.0\.0\.2/.test(text), 'the NIF header is parsed and its version shown');
ok(/bool = 4 bytes/.test(text), 'and the version-derived bool width is reported');
ok(/4 body records/.test(text) && /1 of them are first-person/.test(text),
  'the ESM body records are counted, first-person ones separately');
ok(/hand[\s\S]{0,120}first-person record found/.test(text), 'the hand slot finds its .1st record');
ok(/wrist[\s\S]{0,160}falls back to the third-person mesh/.test(text),
  'the wrist has no .1st record and the fallback is named as such');
ok(/forearm[\s\S]{0,120}NOTHING for this slot/.test(text), 'a slot with no data says so plainly');

ok(/SKINNED/.test(text), 'the skinned hand mesh is reported SKINNED');
ok(/rigid/.test(text), 'and the unskinned wrist mesh is reported rigid');
ok(/Both kinds are present here, so the rig must handle both/.test(text),
  'and when the two disagree the page says so, instead of picking one');
ok(/scan<\/b>, not a parse/.test(text) || /scan.{0,12}not a parse/.test(text),
  'the verdict carries its own uncertainty on screen');

// MW-D3: the fixture arm meshes are NOT real NIFs (they are record-name
// stubs for the scan), so the reader must REFUSE them and print the stage
// and message rather than leaving an empty box. That is the behaviour
// under test: a failure that says why.
await page.waitForSelector('#draws .draw', { timeout: 10000 });
const drawText = await page.textContent('#draws');
ok(/hand/.test(drawText) && /wrist/.test(drawText), 'each arm slot with a mesh gets its own panel');
const pixels = await page.evaluate(() => {
  const cvs = [...document.querySelectorAll('#draws canvas')];
  return cvs.map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });
});
ok(pixels.length >= 1, 'a real NIF gets a canvas, not just a message');
ok(pixels.some((n) => n > 200), `and the wireframe actually DRAWS (${pixels.join(', ')} lit pixels)`);
ok(/parse:|flatten:|geometry:/.test(drawText),
  `a mesh the strict reader refuses names its STAGE (got: ${drawText.replace(/\s+/g, ' ').slice(0, 120)})`);
ok(!/^\s*$/.test(drawText), 'and never an empty box - the reverted rig\'s defining behaviour');

// ── MW-D6: THE ASSEMBLED ARM, DRAWN ───────────────────────────────
//
// Three layers, because each is blind to what the next catches:
//   1. lit pixels     - something was drawn at all
//   2. x-symmetry     - blind to "two identical right hands", which is
//                       EXACTLY the defect MW8 shipped, so layer 1 alone
//                       would have passed it
//   3. signed readback- which piece, which bone, which side, mirrored or
//                       not; the only layer that can name what went wrong
await page.waitForSelector('#assembly canvas', { timeout: 10000 });
const armText = await page.textContent('#assembly');

const armCanvases = await page.evaluate(() => document.querySelectorAll('#assembly canvas').length);
ok(armCanvases === 1, `ONE frame for the whole arm, not one per piece (${armCanvases})`);

const armPixels = await page.evaluate(() => {
  const c = document.querySelector('#assembly canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return n;
});
ok(armPixels > 200, `the assembled arm actually DRAWS (${armPixels} lit pixels)`);

// LAYER 2. Every part in this fixture is x-symmetric by construction -
// two mirrored hand shapes, one cuff placed at both upper arms with the
// left mirrored - and frontViewMapper centres on (minX+maxX)/2 = 0. So a
// correct drawing is symmetric about the vertical centre line. Drop rule
// 13's mirror and the left cuff lands on top of the right one instead of
// opposite it, and the score collapses. Block-downsampled to absorb
// antialiasing and the even-width off-by-one.
const sym = await page.evaluate(() => {
  const c = document.querySelector('#assembly canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const B = 4; const W = Math.ceil(c.width / B); const H = Math.ceil(c.height / B);
  const cell = new Uint8Array(W * H);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 8) cell[((y / B) | 0) * W + ((x / B) | 0)] = 1;
    }
  }
  let hit = 0; let tot = 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (cell[j * W + i]) { tot++; if (cell[j * W + (W - 1 - i)]) hit++; }
    }
  }
  return { score: tot ? hit / tot : 0, tot };
});
ok(sym.tot > 20 && sym.score >= 0.9,
  `and it is SYMMETRIC about x=0 - two identical hands would not be (${sym.score.toFixed(2)} over ${sym.tot} cells)`);

// LAYER 3. The signed numbers, off the same rows the page's table shows.
const arm = await page.evaluate(() => window.__mwArm);
ok(Array.isArray(arm) && arm.length === 4,
  `four pieces: a skinned hand per side and a rigid upper arm per side (${arm ? arm.length : 'none'})`);
if (Array.isArray(arm)) {
  const skinned = arm.filter((r) => r.kind === 'skinned');
  const rigid = arm.filter((r) => r.kind === 'rigid');
  ok(skinned.map((r) => r.bone).join() === 'left hand,right hand',
    `BOTH hands bind - a latch that stops after the first bone gives one (${skinned.map((r) => r.bone).join() || 'none'})`);
  ok(rigid.map((r) => r.mirrored).join() === 'true,false', 'and the LEFT upper arm is the mirrored one');
  const by = (b) => arm.find((r) => r.bone === b);
  const L = by('left upper arm'); const R = by('right upper arm');
  ok(L && R && Math.abs(L.bounds.minX + R.bounds.maxX) < 1e-3 && Math.abs(L.bounds.maxX + R.bounds.minX) < 1e-3,
    'the left rigid piece is the right one with X negated, exactly');
  ok(by('left hand').bounds.maxX < 0 && by('right hand').bounds.minX > 0,
    'and rule 15 put each SKINNED side on its own side of x=0');
}
ok(/MIRRORED/.test(armText), 'the table names the mirrored piece as such');
ok(/skinned/.test(armText) && /rigid/.test(armText), 'and both kinds by name');
ok(/Not in the picture/.test(armText) && /forearm/.test(armText),
  'a slot with no data is listed WITH ITS REASON, never silently absent');

// ── MW-D7: THE IDLE CLIP, PLAYED ──────────────────────────────────
//
// MW-D6's lesson, applied. A lit-pixel count passed a ONE-HANDED arm; it
// will pass a rest-pose arm just as happily, and a rest pose is exactly
// what an unbound clip produces. So the layers here have to separate
// three outcomes that a picture cannot:
//
//   NOT ANIMATING  - poseSkeleton fell through to node.rest for every
//                    bone. Clean, plausible, static. Layer 2 kills it.
//   ANIMATING WRONGLY - a `% span` player replays the clip's intro on
//                    every wrap instead of the loop segment. It moves,
//                    it is symmetric, it draws. Only layer 5 kills it.
//   ANIMATING CORRECTLY - the recorded law.
await page.waitForSelector('#clip canvas', { timeout: 10000 });
const clipText = await page.textContent('#clip');

// L1 - it draws.
const clipPixels = await page.evaluate(() => {
  const c = document.querySelector('#clip canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return n;
});
ok(clipPixels > 200, `the clip panel draws the arm (${clipPixels} lit pixels)`);

// L1b - IT ANIMATES ON ITS OWN. Every layer below drives the pose through
// __mwArmAt, which answers perfectly well with the rAF loop dead - a page
// frozen on its first frame passes all of them. So watch the LIVE canvas
// across real frames and nothing else.
const live = await page.evaluate(async () => {
  const c = document.querySelector('#clip canvas');
  const g = c.getContext('2d');
  const hash = () => {
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let h = 7;
    for (let i = 3; i < d.length; i += 4) h = (h * 31 + (d[i] > 8 ? 1 : 0)) | 0;
    return h;
  };
  const before = hash();
  const start = window.__mwClipFrames;
  await new Promise((r) => setTimeout(r, 400));
  return { before, after: hash(), frames: window.__mwClipFrames - start };
});
ok(live.frames > 5, `the clip's own frame loop is running (${live.frames} frames in 400ms)`);
ok(live.before !== live.after,
  'and the picture changes WITHOUT being driven - a page frozen on frame one passes every layer below');

const CLIP_TIMES = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

// L2 - THE PICTURE CHANGES. This is the layer that kills "bound nothing,
// fell back to rest", which no pixel count and no symmetry score can see.
const shots = await page.evaluate((times) => {
  const c = document.querySelector('#clip canvas');
  const g = c.getContext('2d');
  const B = 4; const W = Math.ceil(c.width / B); const H = Math.ceil(c.height / B);
  const out = [];
  for (const t of times) {
    window.__mwArmAt(t);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const cell = new Uint8Array(W * H);
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 8) cell[((y / B) | 0) * W + ((x / B) | 0)] = 1;
      }
    }
    let hit = 0; let tot = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (cell[j * W + i]) { tot++; if (cell[j * W + (W - 1 - i)]) hit++; }
      }
    }
    out.push({ t, hash: cell.join(''), sym: tot ? hit / tot : 0, tot });
  }
  return out.map((r) => ({ ...r, hash: [...r.hash].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7) }));
}, CLIP_TIMES);
const distinct = new Set(shots.map((s2) => s2.hash)).size;
ok(distinct >= 5,
  `the picture CHANGES across the clip - a clip that bound nothing gives 1 (${distinct} distinct of ${shots.length})`);

// L3 - symmetry at EVERY time, not once. The fixture's left arm track is
// the right's negated about Y, which the x-mirror conjugates exactly, so
// the assembly is x-symmetric at every instant. A one-sided binding or a
// mirror lost under animation collapses this.
const worst = shots.reduce((a, b) => (b.sym < a.sym ? b : a));
ok(shots.every((s2) => s2.tot > 20 && s2.sym >= 0.9),
  `and stays SYMMETRIC at every time (worst ${worst.sym.toFixed(2)} at t=${worst.t})`);

// L4 - the signed readback, per piece, per time.
const poses = await page.evaluate((times) => times.map((t) => {
  const rows = window.__mwArmAt(t);
  const pick = (b) => rows.find((r) => r.bone === b);
  return {
    t,
    rh: pick('right hand').bounds,
    lh: pick('left hand').bounds,
    rc: pick('right upper arm').bounds,
    lc: pick('left upper arm').bounds,
  };
}), CLIP_TIMES);
const at = (t) => poses.find((p) => p.t === t);
// ANTI-VACUITY: the intro pose must be REACHABLE, or L5's "never returns
// to it" could pass by never arriving in the first place.
ok(at(1.0).rh.maxX < 0,
  `at the clip's start the right hand is still LEFT of centre (${at(1.0).rh.maxX.toFixed(3)})`);
ok(at(2.0).rh.maxX > 2.4, `and by t=2.0 it has swung across (${at(2.0).rh.maxX.toFixed(3)})`);
ok(poses.every((p) => Math.abs(p.lh.minX + p.rh.maxX) < 1e-3 && Math.abs(p.lc.minX + p.rc.maxX) < 1e-3),
  'the two sides stay exact mirrors of each other at every time, hands and cuffs alike');
ok(poses.some((p) => Math.abs(p.rc.maxX - at(1.0).rc.maxX) > 1e-3),
  'and the RIGID pieces move too - a pose that re-skins and leaves the cuffs at rest is half a rig');

// L5 - THE LOOP LAW, as a sequence. The one measurement that separates a
// correct player from a plausible one, asserted in time-space AND in
// pose-space so a time-bookkeeping fake cannot pass it.
const trace = await page.evaluate(() => window.__mwClipTrace({ dt: 0.2, steps: 40, loopCount: 2 }));
ok(trace.length > 6 && Math.abs(trace[0].time - 1.2) < 1e-3,
  `the clip starts at 1.0, not 0 - a forward scan takes the decoy block (first step t=${trace[0] && trace[0].time})`);
const stopIdx = trace.findIndex((r) => r.firedKeys.includes('idle: loop stop'));
ok(stopIdx > 0, 'the loop-stop key is crossed at all');
const after = trace.slice(stopIdx + 1);
ok(after.length > 0 && after.every((r) => r.time >= 1.5 - 1e-6),
  'and after it the playhead never re-enters the clip INTRO - a % span player replays it every wrap');
ok(after.every((r) => r.rightHandMaxX == null || r.rightHandMaxX > 1.4),
  'measured in the POSE too, not just the clock - the intro reaches x < 0 and the loop never does');
ok(trace[trace.length - 1].loopStartTime === 1.5 && trace[trace.length - 1].loopStopTime === 2.5,
  'the loop window ends at 1.5..2.5 - DISCOVERED by crossing the keys, not read at load');
// loopCount is a count of ADDITIONAL passes, so a count of 2 CROSSES the
// loop-stop key three times and WRAPS twice - the third crossing finds
// the count exhausted and runs on to the stop key. Both numbers are
// asserted, because an off-by-one in either direction moves exactly one
// of them.
const wraps = trace.filter((r, i) => i > 0 && r.loopCount < trace[i - 1].loopCount).length;
ok(wraps === 2 && trace[trace.length - 1].loopCount === 0,
  `two wraps for a loop count of 2 (${wraps}, ending at ${trace[trace.length - 1].loopCount})`);
ok(trace.flatMap((r) => r.firedKeys).filter((k) => k === 'idle: loop stop').length === 3,
  'and the loop SEGMENT plays three times - loops are ADDITIONAL passes, not total');
const tail = trace[trace.length - 1];
ok(!tail.playing && Math.abs(tail.time - 3.0) < 1e-6,
  `then it runs on to the stop key and finishes (t=${tail.time}, playing=${tail.playing})`);
const allFired = trace.flatMap((r) => r.firedKeys);
ok(allFired.includes('idle: chop hit'), 'a key with no handler is still CROSSED and logged (rule 24)');
ok(allFired.includes('soundgen: left'),
  'and rule 47 lets a soundgen key through even though its group is not the playing one');
ok(!allFired.some((k) => k.startsWith('idle1h:') || k.startsWith('sneak')),
  'while another group\'s ordinary keys are dropped - "idle" must not swallow "idle1h"');

// The page has to SAY the things a picture cannot.
ok(/1\.00\s*…\s*3\.00s|1\.00 &hellip; 3\.00s|1\.00.{0,10}3\.00s/.test(clipText),
  `the resolved clip range is printed (got: ${clipText.replace(/\s+/g, ' ').slice(0, 200)})`);
ok(/5 of 5/.test(clipText), 'the binding count is printed - the answer to the silent failure');
ok(/runs backwards/.test(clipText),
  'and the group LISTING\'s divergent answer is shown beside it, not hidden');
ok(/Right Hand|Left Hand/.test(clipText),
  'bones the clip does not drive are named, since they are indistinguishable from an unbound clip');

// MW-D4: the bone table. The fixture skeleton is a TEST RIG, not
// Morrowind's, so the retail bone names are expected to be MISSING - and
// the assertion is that the page SAYS so, in the row, rather than
// shortening the list or defaulting to cheerful.
await page.waitForSelector('#bones table', { timeout: 10000 });
const boneText = await page.textContent('#bones');
ok(/Left Hand/.test(boneText) && /Weapon Bone Left/.test(boneText),
  'every required bone gets a row, including the bow-only one');
ok(/MISSING/.test(boneText), 'and a bone this skeleton lacks is named MISSING');
ok(/are missing[\s\S]{0,300}before a rig is written against them/.test(boneText),
  'with the consequence spelled out, not left for the reader to infer');

// L6 - THE SILENT FAILURE, MADE VISIBLE. Swap in a .kf that keys bones
// this skeleton does not have. The arm still draws, still symmetric,
// still plausible - and the page must say so in words.
const blindBsa = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: loose('armskel.nif') },
  { name: 'meshes\\b\\H1.nif', data: loose('armhand.nif') },
  { name: 'meshes\\b\\U.nif', data: loose('armcuff.nif') },
  { name: 'meshes\\XBase_Anim.1st.kf', data: loose('xfixture.kf') },
]);
await page.setInputFiles('#file', [
  { name: 'Morrowind.bsa', mimeType: 'application/octet-stream', buffer: Buffer.from(blindBsa) },
  { name: 'Morrowind.esm', mimeType: 'application/octet-stream', buffer: Buffer.from(esm) },
]);
await page.waitForFunction(() => {
  const el = document.getElementById('clip');
  return el && /holds its rest pose|names no such animation/.test(el.textContent);
}, { timeout: 10000 }).catch(() => {});
const blindText = await page.textContent('#clip');
const blindClip = await page.evaluate(() => window.__mwClip);
ok(blindClip && blindClip.binding && blindClip.binding.matched.length === 0
  && blindClip.binding.unmatched.join() === 'bone1',
  `a .kf keyed to foreign bones binds NOTHING (${blindClip && blindClip.binding
    ? blindClip.binding.matched.length + ' matched' : 'no report'})`);
ok(blindClip && /names no such animation/.test(blindClip.refusal || ''),
  'and the refusal itself is readable, not only the success path');
// BOTH sentences, not either. The clip refusal and the empty binding are
// two different failures of the same file, and an OR lets one stand in for
// the other - which is how a page stops reporting the binding at all and
// nothing notices.
ok(/names no such animation/.test(blindText),
  `the refused clip is named (got: ${blindText.replace(/\s+/g, ' ').slice(0, 160)})`);
ok(/holds its rest pose/.test(blindText),
  'AND the unmatched track is named, with the consequence spelled out - the failure a picture cannot show');

// a corrupt archive must be named, not swallowed
const bad = Uint8Array.from([...u32(0x102), ...u32(0), ...u32(0)]);
await page.setInputFiles('#file', [
  { name: 'Broken.bsa', mimeType: 'application/octet-stream', buffer: Buffer.from(bad) },
]);
await page.waitForSelector('.err', { timeout: 5000 }).catch(() => {});
ok(/not a Morrowind BSA/.test(await page.textContent('#out')), 'a wrong magic is reported, not swallowed');

ok(crashes.length === 0, `no pageerrors${crashes.length ? ': ' + crashes.join(' | ') : ''}`);

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
