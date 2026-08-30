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
  // ── THE INTRO (U65) ────────────────────────────────────────────
  // The doctrine's question is "did these pixels come from ARENA2?",
  // and for all four the answer is no - none of them was read out of a
  // .BSA, rendered from one, or traced off one. The flyover the intro
  // plays them over is GENERATED (ui/introMap.js), which is the whole
  // reason it can run before the folder pick.
  //
  // A SECOND QUESTION APPLIES TO TWO OF THEM AND THIS LIST DOES NOT
  // ANSWER IT. The Workshop and Nexus marks are third-party
  // TRADEMARKS. Port-Doctrine requires that anything public-facing
  // credit Daggerfall Unity, so Interkarma's mark is attribution the
  // doctrine actively asks for; the Nexus mark is a distribution mark
  // and its owners may have a view. That is a licensing decision, it
  // is Mac's, it was made deliberately when he supplied the files, and
  // it is recorded here rather than buried so the next person reading
  // this list knows it was asked.
  ['src/assets/intro/interkarma.webp', "OURS TO SHIP - Interkarma's Daggerfall Workshop mark, credit for the project this port follows. Not ARENA2 data; a third-party trademark used as attribution"],
  ['src/assets/intro/nexus.webp', 'OURS TO SHIP - the Nexus Mods mark, where the port is distributed. Not ARENA2 data; a third-party trademark, supplied by Mac'],
  ['src/assets/intro/title.webp', 'OURS - the Daggerfall JavaScript wordmark, the project logo, same standing as public/logo.png'],
  // THE ONE PIECE OF MUSIC THIS PORT SHIPS, and a real departure:
  // every other note is synthesised from the player's own MIDI.BSA
  // (systems/songPlayer.js, the A5 arc) precisely so nothing has to
  // ship. This is an original recording of the main theme, Mac's, and
  // it can ship for the same reason it can play before the ARENA2
  // pick - it is not game data. Ledger A.
  ['src/assets/intro/theme.mp3', "OURS - an original recording of the main theme; the intro's clock, and the only audio the port ships"],
  // THE SITE'S PICTURES (U60c). Screens of the ENHANCED skin - type and
  // layout - taken by tools/siteShots.mjs with NO ARENA2 anywhere: the
  // tool boots its own vite with no data folder, proves the game's own
  // data fetch 404s, and aborts if the folder pick appears. Not one
  // pixel on them came from the game.
  ['public/site/menu-settings.png', 'OURS - the enhanced settings shell, no game data loaded (tools/siteShots.mjs)'],
  ['public/site/menu-phone.png', 'OURS - the enhanced menu on a phone, no game data loaded (tools/siteShots.mjs)'],
  ['public/site/menu-home.png', 'OURS - the enhanced pixel home, no game data loaded (tools/siteShots.mjs)'],
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
  // The list stopped being public-only when the intro's assets moved
  // into src/assets - Vite emits them into the build, so they are just
  // as PUBLISHED as public/ and their rows stay. The reverse check now
  // reads each row's own directory rather than assuming public/.
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
