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
  ['public/logo.png', "OUR artwork - the title screen brand (U21c), the port's own"],
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
  ['public/skin/breton-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
  ['public/skin/redguard-skin-ramps.json', 'OURS - ramps derived from our own generated heads'],
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
    if (!/\bDEPARTURE\b/.test(text) && !/deliberate departure/i.test(text)) continue;
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
