// MW-IMPORT SLICE 2 LIVE PROOF: the whole path at once - fixture.bsa in
// through the picker, MwBsaFile -> parseNif -> flattenNif -> three.js,
// fixture.dds decoded and mapped - by asserting the four quadrant colors
// of the fixture texture actually reach pixels on screen. A green suite
// says every stage answers correctly in isolation; this says the wiring
// between them draws.
//
// Usage: node tools/mwViewerProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5219, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => {
  console.log(`${cond ? 'ok ' : 'FAIL'} ${label}`);
  if (!cond) fails.push(label);
};

await page.goto('http://localhost:5219/mw-viewer.html');
await page.setInputFiles('#file', 'test/fixtures/mw/fixture.bsa');
await page.waitForFunction(
  () => window.__mwviewer && (window.__mwviewer.loaded || window.__mwviewer.error),
  null,
  { timeout: 15000 },
);

// Deterministic pose for sampling: stop the spin, tip the pitch high so
// the up-facing quad fills the view.
await page.click('#spin');
// Straight down at the up-facing quad: four equal quadrants, even light.
await page.evaluate(() => window.__mwviewerView(0, 1.45));
const status1 = await page.textContent('#status');
console.log('status:', status1.replace('\n', ' | '));
ok(/1 batch, 2 tris, 1 textured/.test(status1), 'quad loads: 1 batch, 2 tris, textured');

// The pure texture path: plain.nif carries no vertex colors, so with
// apply mode 2 (MODULATE) the quadrants reach the screen unmixed.
await page.selectOption('#meshsel', 'meshes/fixture/plain.nif');
await page.evaluate(() => window.__mwviewerView(0, 1.45));
await page.waitForTimeout(600);
const shot = PNG.sync.read(await page.screenshot());
const counts = { red: 0, green: 0, blue: 0, white: 0 };
for (let i = 0; i < shot.data.length; i += 4) {
  const [r, g, b] = [shot.data[i], shot.data[i + 1], shot.data[i + 2]];
  if (r > 110 && g < 70 && b < 70) counts.red++;
  else if (g > 110 && r < 70 && b < 70) counts.green++;
  else if (b > 110 && r < 70 && g < 70) counts.blue++;
  else if (r > 165 && g > 165 && b > 165) counts.white++;
}
console.log('quadrant pixel counts:', counts);
for (const k of ['red', 'green', 'blue', 'white']) {
  ok(counts[k] > 200, `${k} quadrant of fixture.dds reaches the screen (${counts[k]}px)`);
}
writeFileSync('/tmp/mw-viewer-probe.png', PNG.sync.write(shot));
console.log('shot: /tmp/mw-viewer-probe.png');

// The skinned fixture: untextured path, bind-pose preview marker.
await page.selectOption('#meshsel', 'meshes/fixture/skinned.nif');
await page.waitForTimeout(300);
const status2 = await page.textContent('#status');
ok(/skinned \(bind-pose preview\)/.test(status2), 'skinned fixture loads as bind-pose preview');

// SLICE 3: skeleton + keyframes, the deterministic way - seek the Move
// group to its end and read the CPU-skinned verts back. Hand-computed:
// Bone1 slides z 1->2, Bone0 turns 90deg about Z; v1 (1,0,0) lands at
// (0,1,0), v3 (1,0,1) lands at (1,0,2), v2 blends to z=1.6.
await page.selectOption('#meshsel', 'meshes/fixture/animated.nif');
await page.waitForTimeout(200);
const status3 = await page.textContent('#status');
ok(/skinned \(bind-pose preview\)/.test(status3), 'animated fixture loads with skin');
// Bind pose is the default now - playing is a choice the probe makes.
await page.selectOption('#animsel', 'Move');
await page.evaluate(() => window.__mwviewerSetAnimTime(1.5));
await page.waitForTimeout(200);
const posed = await page.evaluate(() => window.__mwviewerSkinnedPositions());
const nearp = (i, e) => posed && Math.abs(posed[i] - e) < 1e-3;
ok(
  nearp(3, 0) && nearp(4, 1) && nearp(5, 0),
  `v1 rotated to (0,1,0), got (${posed && posed.slice(3, 6).map((v) => v.toFixed(3))})`,
);
ok(
  nearp(9, 1) && nearp(10, 0) && nearp(11, 2),
  `v3 translated to (1,0,2), got (${posed && posed.slice(9, 12).map((v) => v.toFixed(3))})`,
);
ok(nearp(8, 1.6), `v2 blended to z=1.6, got ${posed && posed[8].toFixed(3)}`);
await page.evaluate(() => window.__mwviewerSetAnimTime(0.5));
await page.waitForTimeout(200);
const rest = await page.evaluate(() => window.__mwviewerSkinnedPositions());
ok(rest && Math.abs(rest[11] - 1) < 1e-3, 'seek back to group start restores bind z');

// External .kf overrides inline tracks: Bone1 rides to z=3 at its end.
await page.setInputFiles('#file', 'test/fixtures/mw/xfixture.kf');
await page.waitForTimeout(300);
await page.selectOption('#animsel', 'Move');
await page.evaluate(() => window.__mwviewerSetAnimTime(1.0));
await page.waitForTimeout(200);
const kfPosed = await page.evaluate(() => window.__mwviewerSkinnedPositions());
ok(
  kfPosed && Math.abs(kfPosed[11] - 3) < 1e-3,
  `dropped .kf drives Bone1 to z=3, got ${kfPosed && kfPosed[11].toFixed(3)}`,
);

// SLICE 4: assembly - load the animated base, add part.nif in add-part
// mode with the Hat on Bone1, seek the pose, and read BOTH the part's
// rebound skin and the attachment matrix back. Hand-computed: part v0/v1
// swing with Bone0's quarter turn, v2 rides Bone1 to z=2, and the Hat's
// attach translation IS Bone1's posed position (0,0,2).
await page.selectOption('#meshsel', 'meshes/fixture/animated.nif');
await page.waitForTimeout(200);
await page.click('#addpart');
await page.selectOption('#attachsel', 'Bone1');
await page.selectOption('#meshsel', 'meshes/fixture/part.nif');
await page.waitForTimeout(200);
await page.selectOption('#animsel', 'Move');
const status4 = await page.textContent('#status');
ok(/1 part \(meshes\/fixture\/part\.nif: 1 skinned, 1 attached\)/.test(status4),
  `part binds: ${status4.replace('\n', ' | ')}`);
await page.evaluate(() => window.__mwviewerSetAnimTime(1.5));
await page.waitForTimeout(200);
const partPosed = await page.evaluate(() => window.__mwviewerSkinnedPositions(1));
const nearq = (arr, i, e) => arr && Math.abs(arr[i] - e) < 1e-3;
ok(
  nearq(partPosed, 0, 0) && nearq(partPosed, 1, 0.5) && nearq(partPosed, 4, 1.5) && nearq(partPosed, 8, 2),
  `part skin follows the base pose, got (${partPosed && partPosed.map((v) => v.toFixed(2)).join(',')})`,
);
const attachT = await page.evaluate(() => window.__mwviewerAttachT(0));
ok(
  attachT && Math.abs(attachT[0]) < 1e-3 && Math.abs(attachT[1]) < 1e-3 && Math.abs(attachT[2] - 2) < 1e-3,
  `Hat rides Bone1 to (0,0,2), got (${attachT && attachT.map((v) => v.toFixed(3))})`,
);

// SLICE 6: the ESM path - drop fixture.esm, pick an NPC, and the whole
// character assembles: base skeleton from the archive, the chest skin
// rebound, head+hair attached at the Head bone, sex matching live.
await page.setInputFiles('#file', 'test/fixtures/mw/fixture.esm');
await page.waitForTimeout(300);
const esmStatus = await page.textContent('#status');
ok(/2 NPCs, 4 body parts, 1 races/.test(esmStatus), `esm parses: ${esmStatus}`);
await page.selectOption('#npcsel', 'test npc');
await page.waitForTimeout(400);
const npcStatus = await page.textContent('#status');
ok(/Test NPC \(Test Race\) - 3\/3 parts bound/.test(npcStatus), `npc assembles: ${npcStatus}`);
ok(/11 slots without skins/.test(npcStatus), 'the honest missing-slots census reaches the status line');
const npcParts = await page.evaluate(() => ({
  skins: window.__mwviewer.loaded.skinnedMeshes.length,
  parts: window.__mwviewer.loaded.parts.length,
  attach: window.__mwviewerAttachT(0),
}));
ok(npcParts.skins === 2, `base + chest skin both skinned (${npcParts.skins})`);
ok(npcParts.parts === 3, `three parts bound (${npcParts.parts})`);
ok(Array.isArray(npcParts.attach), 'head attaches with a live matrix');
// The female NPC swaps in the female chest - read the bound part ids.
await page.selectOption('#npcsel', 'test npc f');
await page.waitForTimeout(400);
const fStatus = await page.textContent('#status');
ok(/Test NPC F/.test(fStatus), `female npc assembles: ${fStatus}`);
const fBound = await page.evaluate(() => window.__mwviewer.loaded.npcBound);
ok(fBound && fBound.includes('b_test_chest_f') && !fBound.includes('b_test_chest'),
  `sex matching bound the female chest (${fBound})`);

// MW-D17: THE CLIP LAW IS THE VIEWER'S ONE HOME FOR TIME. The retired
// player - start + (elapsed modulo span) - looped EVERY group forever
// and replayed the intro on each wrap, so "does it stop" is the one
// question that separates the law from the modulo. Both layers discover
// their answer by CROSSING (waitForFunction polls on the page's own
// frames), never by sleeping against SwiftShader's clock.
await page.selectOption('#meshsel', 'meshes/fixture/animated.nif');
await page.waitForTimeout(200);
await page.selectOption('#animsel', 'Move');
// "move" is in no hardcoded set and the fixture has no loop keys: rule
// 51 answers loopFallback FALSE, so the clip plays once to its stop key
// and freezes there. The modulo player can never satisfy this wait.
await page.waitForFunction(
  () => { const c = window.__mwviewerClip(); return c && c.playing === false; },
  null, { timeout: 20000 },
);
const moveClip = await page.evaluate(() => window.__mwviewerClip());
ok(moveClip && Math.abs(moveClip.time - 1.5) < 1e-6,
  `"move" plays ONCE and freezes on its stop key (t=${moveClip && moveClip.time})`);
ok(moveClip && moveClip.loopStopFinite === false,
  'no loop keys, no fallback: the loop window never closes (rule 49\'s +Infinity)');
const frozen = await page.evaluate(() => window.__mwviewerSkinnedPositions());
ok(frozen && Math.abs(frozen[11] - 2) < 1e-3,
  `and the POSE holds the stop key - v3 stays at z=2, got ${frozen && frozen[11].toFixed(3)}`);

// "idle" IS rule 51's hardcoded set: same file, same absence of loop
// keys, and it loops for ever. The wrap is observed, not assumed: the
// playhead must approach the stop and then come back down.
await page.selectOption('#animsel', 'Idle');
await page.evaluate(() => { window.__probeMaxT = 0; });
await page.waitForFunction(
  () => {
    const c = window.__mwviewerClip();
    if (!c) return false;
    if (c.time > window.__probeMaxT) window.__probeMaxT = c.time;
    return window.__probeMaxT > 0.4 && c.time < window.__probeMaxT - 0.2;
  },
  null, { timeout: 20000 },
);
const idleClip = await page.evaluate(() => window.__mwviewerClip());
ok(idleClip && idleClip.playing === true,
  'rule 51: "idle" loops with NO loop keys - the hardcoded set is the fallback');
ok(idleClip && idleClip.loopStopFinite === true && Math.abs(idleClip.loopStopTime - 0.5) < 1e-6,
  `loopFallback closes the window at the stop key (${idleClip && idleClip.loopStopTime})`);
ok(idleClip && idleClip.time >= -1e-6 && idleClip.time <= 0.5 + 1e-6,
  `and the playhead lives inside the group (t=${idleClip && idleClip.time})`);

ok(crashes.length === 0, `no pageerrors${crashes.length ? `: ${crashes[0]}` : ''}`);

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
