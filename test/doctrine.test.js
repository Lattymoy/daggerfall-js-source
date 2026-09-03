// PORT-DOCTRINE, ENFORCED.
//
// The doctrine's first non-negotiable is that ARENA2 never enters the repo,
// and it says `.gitignore` blocks it. `.gitignore` blocks `ARENA2/`, `*.BSA`
// and `*.SND` - it cannot recognise a PNG of the same art.
//
// AUDIT 21 (doctrine lane, F1) found the gap being walked through. Fourteen
// before/after gallery frames sat under `public/visual-changes/`, twelve of
// them the port's framebuffer with classic WEAPON*.CIF sprites drawn into it
// and upscaled. `public/` is Vite's STATIC ROOT, so `npm run build` copied
// every one of them into `dist/`, and `.github/workflows/deploy.yml` - whose
// own header says "The build contains NO game data" - uploaded `dist` to
// GitHub Pages. The one thing the project cannot get wrong, published.
//
// So the rule is a test now: A RENDER OF GAME DATA IS GAME DATA, and nothing
// ships out of `public/` that is not on the allow-list below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: root, encoding: 'utf8' })
  .split('\n').filter(Boolean);

/** Everything the port may ship out of public/, and WHY it is ours.
 *  Adding a row here is a doctrine decision, not a chore - the question to
 *  answer is "did these pixels come from ARENA2?", and a re-shaded sprite
 *  that keeps the original silhouette answers yes. */
const PUBLIC_ALLOWLIST = new Map([
  ['public/README.md', 'documentation'],
  // THE INTRO'S FOUR ASSETS (U65) WENT WITH THE INTRO at 1c62e11
  // (U65f): two marks, a title card and the one recorded piece of
  // music this port ever shipped. The rows went with the files; this
  // sentence replaces the rationale that outlived them, because a
  // licensing position stated over an empty list tells a reader the
  // repo publishes a music recording and two third-party trademarks,
  // and it publishes neither. Every note is synthesised from the
  // player's own MIDI.BSA again (systems/songPlayer.js, the A5 arc).
  // THE SITE'S PICTURES (U60c) WERE RETIRED with the DA site cleanup
  // (Mac, 2026-08-31): the landing page carries no raster at all now -
  // landing.test.js pins <img> absent - so the three menu screens,
  // their OURS rows and tools/siteShots.mjs went together. The both-
  // ways check below is why removing them is safe: a row cannot
  // outlive its file, and a returning picture must re-earn its row.
  // THE BAKED SKIN (tools/skin/). These pixels never touched ARENA2: the
  // source is our own generated eight-direction turnaround, projected onto
  // buildNeutralBody, which is a from-scratch DESIGNED figure and not a trace
  // of any classic sprite. No classic silhouette survives in them, which is
  // the question this list exists to ask. They are the first character
  // texture in the project that ships rather than loading through the data
  // door, and the reason viewer.html no longer needs ARENA2 for its skin.
  ['public/skin/skin-intensity.png', 'OURS - intensity baked from our own generated turnaround'],
  ['public/skin/skin-uv.json', "OURS - UVs over our own rig's geometry, no pixels at all"],
  ['public/skin/skin-layout.json', 'OURS - atlas cell rectangles, no pixels at all'],
  ['public/skin/skin-intensity-beast.png', 'OURS - the same map, smoothed for fur and scales'],
  ['public/skin/breton-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/redguard-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/nord-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/darkelf-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/highelf-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/woodelf-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/argonian-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/khajiit-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/heads/khajiit-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/khajiit-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/argonian-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/woodelf-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/highelf-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/darkelf-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/nord-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/redguard-9.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-0.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-1.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-2.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-3.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-4.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-5.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-6.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-7.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-8.png', 'OURS - baked from our own generated head turnaround'],
  ['public/skin/heads/breton-9.png', 'OURS - baked from our own generated head turnaround'],
]);

test('doctrine: nothing ships out of public/ that is not provably ours', () => {
  const unexplained = tracked('public').filter((f) => !PUBLIC_ALLOWLIST.has(f));
  assert.deepEqual(unexplained, [],
    'these files are tracked under public/, which Vite copies verbatim into dist/ and\n'
    + 'deploy.yml uploads to GitHub Pages. Every one of them is PUBLISHED. If the pixels\n'
    + 'came from ARENA2 - including a screenshot, a gallery frame, or a re-shaded sprite\n'
    + 'that keeps the original silhouette - it may not be here at all. If it is genuinely\n'
    + "the port's own artwork, add it to PUBLIC_ALLOWLIST with the reason:\n"
    + unexplained.join('\n'));
});

test('AUDIT 27: the allow-list is checked BOTH ways - no row outlives its file', () => {
  // The sweep found a row for public/logo.png, a file that exists
  // nowhere in the tree's history. The list was only ever read one way -
  // a tracked file must have a row - so a row could be written for a
  // file that never landed, or outlive one that was deleted, and the
  // list would still pass while meaning less than it claims.
  // The list is public-only again: it briefly reached into src/assets
  // for the intro (Vite emits those into the build, so they are just
  // as PUBLISHED as public/), and 1c62e11 took the intro out. The
  // reverse check still reads each row's OWN directory rather than
  // assuming public/, so the next published-but-not-public row needs
  // no new machinery.
  const stale = [...PUBLIC_ALLOWLIST.keys()]
    .filter((f) => !tracked(f.split('/')[0]).includes(f));
  assert.deepEqual(stale, [],
    'these rows name files that are not tracked. A row is a CLAIM that a published\n'
    + 'file is ours; a claim about a file that does not exist is not a claim.');
});

test('doctrine: no raster of game data is tracked anywhere in the repo', () => {
  // The wider rule. `public/` is where it SHIPS, but a committed screenshot is
  // a redistribution wherever it sits - the repo itself is public.
  const RASTER = /\.(png|jpg|jpeg|gif|bmp|webp|tga|ico)$/i;
  const rasters = tracked('.').filter((f) => RASTER.test(f));
  const allowed = new Set([...PUBLIC_ALLOWLIST.keys()]);
  const unexplained = rasters.filter((f) => !allowed.has(f));
  assert.deepEqual(unexplained, [],
    `tracked raster images outside the doctrine allow-list:\n${unexplained.join('\n')}`);
});

test('doctrine: no DERIVED raster is tracked either, whatever it is wearing', () => {
  // AUDIT 21 (doctrine lane, F10) found the same rule broken in a shape no
  // extension filter catches: src/characters/backs/*.json held flat arrays of
  // ART_PAL indices whose opaque mask was IDENTICAL to the mirrored BODY00I0
  // sprite - 5237/5237 texels, 100.00% silhouette agreement. Re-shaded, but
  // the SHAPE and the ramps are the source art's, and the front sprite they
  // were derived from is the user's ARENA2 file, not ours.
  //
  // A raster does not stop being a raster by being spelled as JSON, so the
  // rule is on the SHAPE: a tracked file carrying a width/height and a flat
  // pixel array is a raster, and none may be committed.
  const suspects = [];
  for (const f of tracked('src').concat(tracked('public'), tracked('bible'))) {
    if (!f.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(readFileSync(join(root, f), 'utf8')); } catch { continue; }
    if (j && typeof j === 'object' && Number.isFinite(j.width) && Number.isFinite(j.height)
        && Array.isArray(j.data) && j.data.length >= j.width * j.height) {
      suspects.push(`${f} (${j.width}x${j.height}, ${j.data.length} texels)`);
    }
  }
  assert.deepEqual(suspects, [],
    'these tracked files are RASTERS - a width, a height and a pixel array. If the\n'
    + 'pixels were derived from ARENA2 (including a re-shade that keeps the original\n'
    + 'silhouette) they may not be committed; regenerate them locally instead:\n'
    + suspects.join('\n'));
});

test('doctrine: .gitignore still blocks the game data it claims to block', () => {
  // The doctrine names `.gitignore` as the mechanism for the FILE half of the
  // rule, so the claim is checked rather than trusted.
  const ig = readFileSync(join(root, '.gitignore'), 'utf8');
  for (const pat of ['ARENA2', '*.BSA', '*.SND', 'public/visual-changes/']) {
    assert.ok(ig.includes(pat), `.gitignore no longer blocks ${pat}`);
  }
});

// ---------------------------------------------------------------------------
// THE LEDGER'S CHARTER, ENFORCED.
//
// "If a departure or gap is not on this page, it does not exist." AUDIT 21
// (doctrine lane, F7/F8) found that claim false in two directions at once:
// eleven `src/` sites cited a "Ledger A engine-PRNG rule" that had no row, and
// four files declared "this is a deliberate departure" with no row either.
// Both are the AUDIT 17m shape - a comment pointing at an approval that does
// not exist - and the second one had been repeated four times.
// ---------------------------------------------------------------------------

test('doctrine: every DEPARTURE declared in src/ has a Ledger row naming its file', () => {
  const ledger = readFileSync(join(root, 'bible/01-Overview/Port-Ledger.md'), 'utf8');
  const unrecorded = [];
  for (const f of tracked('src')) {
    if (!f.endsWith('.js')) continue;
    const text = readFileSync(join(root, f), 'utf8');
    // Both spellings: the shouted convention, and the prose one that let
    // messageBox.js's row go unenforced when this pin first landed.
    // ROAD-E fix-D: and the PLURAL. `\bDEPARTURE\b` is false on
    // "RECORDED DEPARTURES", so nine files that shout the plural - the
    // spell maker among them, which cited a Ledger A row that did not
    // exist - were never scanned at all. The trailing S is now optional.
    if (!/\bDEPARTURES?\b/.test(text) && !/deliberate departure/i.test(text)) continue;
    // The LEDGER must name the file. Citing the Ledger from the source side is
    // NOT enough and deliberately does not count here: F7's eleven sites all
    // cited "the Ledger A engine-PRNG rule" and no such row existed. A claim
    // of approval is not an approval.
    const base = f.split('/').pop();
    if (ledger.includes(f) || ledger.includes(base)) continue;
    unrecorded.push(f);
  }
  assert.deepEqual(unrecorded, [],
    'these files declare a DEPARTURE and no Ledger row names them. The Ledger says\n'
    + '"if a departure or gap is not on this page, it does not exist", which is only\n'
    + 'usable as a gate while it is true - a later audit greps the Ledger to decide\n'
    + '"approved or bug?" and gets the wrong answer:\n'
    + unrecorded.join('\n'));
});

// ═══ AUDIT 58 (f3/render): a gate knob that reads nothing is a door
// that can neither fail nor act ═════════════════════════════════════
test('AUDIT 58: every URL knob the world render gate hands the page has a live reader in src/', () => {
  const g = readFileSync(join(root, 'tools/worldRenderGate.mjs'), 'utf8');
  // EE3's --ground survived the ground arc's REVERT (8256ae2, "no
  // reader of tileArrayFor, enhancedGround or groundMode remains
  // anywhere"): the gate went on appending &ground=<mode> to a URL
  // nothing parsed and printing "ground=<mode>" in its PASS line, so a
  // run could claim it had gated a mode that no longer exists.
  const line = g.split('\n').find((l) => l.startsWith('const dials = '));
  assert.ok(line, 'the gate builds its extra query knobs in one place');
  const knobs = [...line.matchAll(/&(\w+)=\$\{/g)].map((m) => m[1]);
  assert.ok(knobs.length >= 4, `the knobs are still here: ${knobs.join(', ')}`);
  const src = tracked('src').filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
  for (const k of knobs) {
    assert.ok(src.includes(`get('${k}')`) || src.includes(`get("${k}")`),
      `--${k} hands the page ?${k}=<v> and nothing in src/ reads it: a knob with no reader `
      + 'gates nothing, and the gate\u2019s own pass line then claims it did');
  }
  assert.ok(!/ground=/.test(line) && !/GROUND/.test(g), 'the reverted ground knob is gone from the URL and the pass line');
  assert.match(g, /world render gate ok \(\$\{MODE\}, \$\{MINUTES\} min\)/,
    'the pass line names only what the run actually set');
});

// ═══ EE0: the world render gate exists, and reads the compositor's frame ═══
test('EE0: the world render gate boots the real exterior and judges real pixels', () => {
  const g = readFileSync('tools/worldRenderGate.mjs', 'utf8');
  // it boots the GAME, against data, into the exterior
  // AUDIT 48 F1: the classic mode must open the SKIN's door, ?skin=classic.
  // A bare ?classic is the classic start-location door, and every
  // classic-mode run before this rendered the enhanced skin.
  assert.match(g, /const skin = MODE === 'classic' \? '&skin=classic' : '';/);
  assert.ok(!/'&classic'/.test(g), 'the start-location door is not the skin door');
  // EE7: the gate can boot either host - ?exterior by default, ?world
  // with --world, where the grass lives
  assert.match(g, /\/play\/\?\$\{WORLD \? 'world' : 'exterior'\}&shot&novideo&nofoes/);
  assert.match(g, /window\.__frame/, 'it must wait for frames, not for load');
  // it judges the COMPOSITOR'S frame: a readPixels outside the game's
  // rAF returns a cleared buffer, which reads as "everything is black"
  assert.match(g, /canvas\.screenshot\(\{ type: 'png'/);
  assert.ok(!/readPixels\(/.test(g), 'a read-back of the default framebuffer lies here');
  // and it fails on the three things a black world has
  // EE3 sharpened these: the lower half is judged, and then the TERRAIN
  // itself by a median band, because a lit building beside a void
  // ground passed the lower-half check
  assert.match(g, /the lower half is lit/);
  assert.match(g, /the lower half has detail/);
  assert.match(g, /the TERRAIN is lit \(street band median/);
  assert.match(g, /the sky is drawn/);
  // the arc plan names it as every slice's gate
  const plan = readFileSync('bible/07-Rendering/Enhanced-Environments-Arc.md', 'utf8');
  assert.match(plan, /tools\/worldRenderGate\.mjs/);
  assert.match(plan, /an upload may create, fill and\s+parameterise an object\. It may not draw/,
    'the law the texture incident taught must be in the plan');
});
