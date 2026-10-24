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
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studioListing, STUDIO_TREE } from '../../scripts/studioArtIndex.mjs';   // STUDIO1
import { writePng } from '../../tools/pngIO.mjs';   // AUDIT STUDIO1 C12: the studio arm's own pictures

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tracked = (dir) => execFileSync('git', ['ls-files', '-z', dir], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })   // RRI1: 13,000 tracked sprites outgrew the 1 MB default (ENOBUFS)
  .split('\0').filter(Boolean);   // AUDIT STUDIO1 C5: -z - git quotes a path with a byte past ASCII in its lines, and the sweep could not find it

/** Everything the port may ship out of public/, and WHY it is ours.
 *  Adding a row here is a doctrine decision, not a chore - the question to
 *  answer is "did these pixels come from ARENA2?", and a re-shaded sprite
 *  that keeps the original silhouette answers yes. */
const PUBLIC_ALLOWLIST = new Map([
  ['public/README.md', 'documentation'],
  // STUDIO1 (2026-10-17): the studio's guide and its roster - text, the port's own. Its pictures answer to the roster
  // (studioArt below), not to rows here.
  ['public/art/studio/README.md', "STUDIO1: the studio's guide for the game's artists - documentation"],
  ['public/art/studio/artists.json', "STUDIO1: the studio's roster - each artist's folder, name and the word that approved them"],
  // TI2 (2026-09-11): THE HOME-SCREEN APP. The manifest is text; the
  // three icons are drawn by scripts/makeIcons.mjs from the enhanced
  // skin's own colour tokens (a block-letter D over a seeded star
  // field) - no ARENA2 pixel, no screenshot, nothing derived. Re-run
  // the script and the same bytes come out.
  ['public/manifest.webmanifest', 'TI2: the web app manifest - text, the port\'s own'],
  ['public/icons/icon-192.png', 'TI2: home-screen icon, drawn by scripts/makeIcons.mjs from the skin\'s tokens'],
  ['public/icons/icon-512.png', 'TI2: home-screen icon, drawn by scripts/makeIcons.mjs from the skin\'s tokens'],
  ['public/icons/icon-512-maskable.png', 'TI2: home-screen icon (maskable), drawn by scripts/makeIcons.mjs from the skin\'s tokens'],
  // INTRO2 (2026-09-18): restored at Mac's explicit request. The credit
  // marks and score are the identical U65 assets, not ARENA2-derived data.
  // Credit marks identify their respective projects; no new rights claimed.
  ['src/assets/intro/interkarma.webp', 'U65 credit artwork identifying Interkarma / Daggerfall Unity; recovered unchanged'],
  ['src/assets/intro/nexus.webp', 'U65 credit artwork identifying Nexus Mods; recovered unchanged'],
  ['src/assets/intro/theme.mp3', 'U65 original theme recording; recovered unchanged at Mac\'s request'],
  ['src/assets/branding/dfo-online.png', 'BR5: Mac\'s supplied DFO Online logo, 2026-10-11, his own file with alpha, cut to its painted bounds with every pixel inside unchanged; no ARENA2 data'],
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
  // MAP0 (2026-09-18): THE HELD MAP'S SPRITE. Mac's own painting - two
  // gauntleted hands holding a blank parchment, 1448x1086 - and the
  // only picture the enhanced map will ship; the map itself is drawn
  // onto the paper at runtime from MAPS and WOODS data (10-UI/Held-Map-Arc.md).
  ['public/art/climb-grip.png', "OURS - Mac's own painting of the climbing fist, drawn for the right hand and mirrored for the left (CLIMB-HANDS, 2026-10-02); no ARENA2 pixel in it"],
  ['public/art/climb-reach.png', "OURS - Mac's own painting of the arm reaching for a hold, mirrored for the left (CLIMB-HANDS, 2026-10-02); no ARENA2 pixel in it"],
  ['public/art/held-map.png', "OURS - Mac's own painting of the held parchment (MAP0, 2026-09-18; the fourth painting, MAP-FIELD8, 2026-09-22); no ARENA2 pixel in it"],
  // DISC22-C (2026-09-24): THE GRIMOIRE LOOT SHEET. Mac's own parchment for the classic skins' quick-loot panel under
  // the GrimoireUI pack ("The screenshot of the parchment is a spritesheet to be used for the loot menu (grimoire
  // UI)"), 106x180, cut at its two gold rules by ui/classicLootPanel.js.
  ['public/art/grimoire-loot-parchment.png', "OURS - Mac's own parchment for the GrimoireUI loot panel (DISC22-C, 2026-09-24); no ARENA2 pixel in it"],
  ['public/art/grimoire-wood.jpg', "WOOD-HD (2026-10-10): the DFO Grimoire boards' wood, cut from the empty desk beside the book in Mac's own screenshot of the DFO Grimoire character sheet, its light flattened and made seamless; [Mac: record where that build's desk painting came from and its permission here]"],
  ['public/art/grimoire-desk.jpg', "DESK-HD (2026-10-10): the DFO Grimoire front door's desk as an earlier build drew it, lifted from Mac's own screenshot of that build (\"it looks way better use this one\"), its doors' words and the wordmark taken off; [Mac: record where that build's desk painting came from and its permission here]"],
  ['public/art/grimoire-dial-chest.png', "GRIM7 (2026-10-10): the treasure chest Dudey supplied for the DFO Grimoire dial's Items door (made with ChatGPT, handed over in the GRIM pass), cut from its dark ground along its outline; no ARENA2 pixel in it"],
  // TEXT-FONT (2026-10-11): the Dyslexic choice of the enhanced skin's Text font (ui/textFont.js) - not art, a typeface
  ['public/fonts/opendyslexic/opendyslexic-latin-400-normal.woff2', "TEXT-FONT: OpenDyslexic (Abbie Gonzalez), SIL Open Font License 1.1 - its latin regular, as @fontsource/opendyslexic 5.3.0 ships it; no ARENA2 pixel in it"],
  ['public/fonts/opendyslexic/opendyslexic-latin-700-normal.woff2', "TEXT-FONT: OpenDyslexic's latin bold, the same package and licence"],
  ['public/fonts/opendyslexic/OFL.txt', 'TEXT-FONT: the font\'s SIL Open Font License, which travels with it'],
  ['public/art/gun-idle.png', "OURS - Mac's own weapon art for the gun lab (2026-09-19); no ARENA2 pixel in it"],
  ['public/art/gun-fire-sheet.webp', "OURS - Mac's own six-frame fire sheet for the gun lab (2026-09-19); no ARENA2 pixel in it"],
  ['public/art/pistol-frames.png', "OURS - the owner's own six fire frames for the pistol lab (2026-10-21), laid side by side with their pixels unchanged; no ARENA2 pixel in it"],
  ['public/art/pistolet-icon.png', "OURS - the owner's own Dwarven Pistolet sprite (PISTOLET, 2026-10-21), its 24x17 pixels recovered from the owner's screenshot; the inventory picture as it is; no ARENA2 pixel in it"],
  ['public/art/pistolet-paperdoll.png', "OURS - pistolet-icon.png with the fist's gap cut across its grip, flipped left to right and tilted barrel-down toward the other hand (RotSprite, no new colour) by tools/pistoletArt.mjs (the right hand's doll layer); no ARENA2 pixel in it"],
  ['public/art/pistolet-paperdoll-left.png', "OURS - pistolet-icon.png with the fist's gap cut across its grip and tilted barrel-down (RotSprite, no new colour) by tools/pistoletArt.mjs (the left hand's doll layer); no ARENA2 pixel in it"],
  ['public/art/pistolet-icon-gilded.png', "OURS - pistolet-icon.png laid on the gold-leaf ramp by tools/pistoletArt.mjs (tools/gunIcons.mjs gild - the Sunken Sovereign's); no ARENA2 pixel in it"],
  ['public/art/pistolet-paperdoll-gilded.png', "OURS - pistolet-paperdoll.png in gold leaf by tools/pistoletArt.mjs; no ARENA2 pixel in it"],
  ['public/art/pistolet-paperdoll-left-gilded.png', "OURS - pistolet-paperdoll-left.png in gold leaf by tools/pistoletArt.mjs; no ARENA2 pixel in it"],
  ['public/art/gun-paperdoll.png', "OURS - Mac's own weapon art for the gun lab (2026-09-19), baked down and cut for the doll's hand by tools/gunPaperdoll.mjs; no ARENA2 pixel in it"],
  ['public/art/gun-ammo.png', "OURS - Mac's own ammunition art for the gun lab (2026-09-19), baked down by tools/gunPaperdoll.mjs; no ARENA2 pixel in it"],
  // THUNDERLOCK-ART + GILDED1 (2026-10-07): the gun's list picture and the Hourlock's gold pair, each DERIVED from the
  // doll layer above by tools/gunIcons.mjs (test/systems/thunderlockart.test.js re-runs it and holds them pixel for pixel)
  ['public/art/gun-icon.png', "OURS - gun-paperdoll.png (Mac's own art) with the fist's gap healed from its own pixels and trimmed, by tools/gunIcons.mjs; no ARENA2 pixel in it"],
  ['public/art/gun-icon-gilded.png', 'OURS - gun-icon.png laid on a gold-leaf ramp by tools/gunIcons.mjs (the Hourlock\'s list picture); no ARENA2 pixel in it'],
  ['public/art/gun-paperdoll-gilded.png', 'OURS - gun-paperdoll.png laid on a gold-leaf ramp by tools/gunIcons.mjs (the Hourlock\'s doll layer); no ARENA2 pixel in it'],
  ['public/sfx/SOURCES.md', 'documentation - where every sound in this folder came from, with its license'],
  ['public/sfx/spell-heal.wav', "IMPACTFX HEAL-FILE: the owner's chosen heal sound (02_Heal_02.wav, 2026-10-05), softened; 22050Hz 16-bit mono - SOURCE/LICENSE TO BE CONFIRMED in public/sfx/SOURCES.md"],
  ['public/sfx/fire-shotgun.wav', 'CC0 (Freesound 473846, LilMati), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/fire-20gauge.wav', 'CC0 (Freesound 427595, michorvath), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/fire-musket.wav', 'CC0 (Freesound 244345, Willlewis), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/fire-blast.wav', 'CC0 (Freesound 773873, MrGungus), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/fire-dry.wav', 'CC0 (Freesound 564480, lumikon), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/open-winchester.wav', 'CC0 (Freesound 153560, SpliceSound), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/open-rack.wav', 'CC0 (Freesound 449614, dasBUTCHER84), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/open-gunrack.wav', 'CC0 (Freesound 679878, AKkingStudio), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/open-shell.wav', 'CC0 (Freesound 108793, CeebFrack), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/close-ready.wav', 'CC0 (Freesound 383933, LilMati), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/close-rack2.wav', 'CC0 (Freesound 449613, dasBUTCHER84), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/close-rack3.wav', 'CC0 (Freesound 449612, dasBUTCHER84), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/close-shell.wav', 'CC0 (Freesound 108793, CeebFrack), public domain - baked to DAGGER.SND\'s 11025Hz 8-bit by tools/sndify.mjs; see public/sfx/SOURCES.md'],
  ['public/sfx/gun-fire-synth.wav', 'OURS - synthesised from noise and sine by tools/gunSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gun-reload-open-synth.wav', 'OURS - synthesised from noise and sine by tools/gunSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gun-reload-close-synth.wav', 'OURS - synthesised from noise and sine by tools/gunSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-cannon.wav', 'OURS - NAV-E: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-cannon-far.wav', 'OURS - NAV-E: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-swivel.wav', 'OURS - NAV-E: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-hit.wav', 'OURS - NAV-E: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-blast.wav', 'OURS - NAV-E: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-grapple.wav', 'OURS - NAV-E: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-runout.wav', 'OURS - AUDIT NAV1: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-ready.wav', 'OURS - AUDIT NAV1: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-sinking.wav', 'OURS - AUDIT NAV1: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/naval-whistle.wav', 'OURS - COMBAT-FEEL: synthesised from noise and sine by tools/navalSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-swing-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-swing-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-chop-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-chop-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-chop-3.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-chop-clean.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-creak.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-fall.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-logs.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-pick-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-pick-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-pick-3.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-pick-glint.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-rubble.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-rustle-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-rustle-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-pluck.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-bruise.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-find.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-sparkle.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-slice-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-slice-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-slice-3.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-tear.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-peel.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-throw.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-net-land.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-plip-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-plip-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-tug.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-thrash-1.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-thrash-2.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-net-out.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-clean.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-haul.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/gather-rank.wav', 'OURS - GATHER-FEEL: synthesised from noise and sine by tools/gatherSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-grab-1.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-grab-2.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-catch.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-step-1.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-step-2.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-step-3.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-scrape-1.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-scrape-2.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-pull.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-whoosh.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
  ['public/sfx/climb-crumble.wav', 'OURS - CLIMB4: synthesised from noise and sine by tools/climbSfx.mjs, deterministically; no recording in it at all'],
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
  // DYNAMIC SKIES (DS1, vendor/dynamic-skies/Textures/). The first rows on
  // this list that are NOT ours: nineteen textures of a third-party mod,
  // vendored whole with its authors' permission, and PUBLISHED - Vite emits
  // them into the build through import.meta.glob, so they are as public as
  // public/. The question this list asks - did the pixels come from ARENA2? -
  // has two answers here. Ten are the mod's own art beyond doubt (a normal
  // map, pixel-art moons, masks, noise, a snowflake, a flat black field).
  // Nine cannot be settled from a container with no ARENA2 in it: the
  // `CdM*` cloud sheets, which the mod's Nexus page says were "created with
  // Daggerfall's vanilla skies and palettes", and the `VanillaStars` pair.
  // The evidence for re-creation rather than export is recorded in the
  // vendor README (2048x2048 star fields and 512x512 grayscale cloud
  // cutouts with 500-1600 colours, where the classic files are 320x200 /
  // 512x220 and paletted to 256), and it is evidence, not proof. The
  // windmills precedent (vendor/windmills-kamer/README.md) left textures
  // OUT when they were provably classic exports; these are carried on the
  // mod's permission as it ships them, with the question flagged for Mac.
  // Dropping a family is a preset edit (the file names), not a code change.
  ['vendor/dynamic-skies/Textures/CdMCloudsNormal.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own normal map (Unity import of its grayscale source)"],
  ['vendor/dynamic-skies/Textures/DefaultStars.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own star field"],
  ['vendor/dynamic-skies/Textures/DefaultStarsTwinkleMask.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own twinkle mask"],
  ['vendor/dynamic-skies/Textures/DefaultStarsTwinkleNoise.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own twinkle noise"],
  ['vendor/dynamic-skies/Textures/NLStarsBlack.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; a single flat black texel field"],
  ['vendor/dynamic-skies/Textures/NLStarsThiefTwinkleMask.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own twinkle mask"],
  ['vendor/dynamic-skies/Textures/NLstarsHighlight.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own highlight sheet"],
  ['vendor/dynamic-skies/Textures/PixelEnceladus.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own pixel-art moon"],
  ['vendor/dynamic-skies/Textures/PixelMars.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; the mod's own pixel-art moon"],
  ['vendor/dynamic-skies/Textures/PixelSnow.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; a two-colour 64x64 snowflake"],
  ['vendor/dynamic-skies/Textures/CdMCloudy.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/CdMOvercast2.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/CdMRain.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/CdMSnow.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/CdMSunny.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/CdMSunny2.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/CdMThunder.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/VanillaStars.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  ['vendor/dynamic-skies/Textures/VanillaStarsTwinkleMask.png', "THIRD-PARTY - Dynamic Skies 2.3.4 (BadLuckBurt, carademono), carried on the authors' permission; PROVENANCE OPEN, Mac's ruling pending - see vendor/dynamic-skies/README.md"],
  // HORSE CART AND CARGO (HCC, vendor/horse-cart-and-cargo/Textures/). Forty-five
  // PNGs of a third-party mod - demifiend000's own horse art, a saddled
  // horse from five sides standing and walking, drawn in Daggerfall's idiom
  // and cut from no ARENA2 file. They are not a Unity texture the bundle's
  // manifest names (so BUNDLE_ART below cannot derive them): the mod EMBEDS
  // them in its assembly as .NET manifest resources, and
  // formats/dotnetResources.js reads them out; test/tooling/hcc_assets.test.js pins
  // every vendored file byte for byte against the vendored assembly. The
  // permission line is RECORD OPEN in vendor/horse-cart-and-cargo/README.md
  // (the registry row says so), as Dynamic Skies' PROVENANCE OPEN rows are.
  ['vendor/horse-cart-and-cargo/Textures/horse1.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/horse2.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/horse3.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/horse4.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/horse5.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-1.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-2.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-3.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-4.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-5.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-6.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-7.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.0-8.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-1.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-2.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-3.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-4.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-5.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-6.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-7.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.1-8.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-1.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-2.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-3.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-4.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-5.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-6.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-7.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.2-8.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-1.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-2.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-3.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-4.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-5.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-6.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-7.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.3-8.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-1.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-2.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-3.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-4.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-5.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-6.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-7.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  ['vendor/horse-cart-and-cargo/Textures/Walk.4-8.png', "THIRD-PARTY - Horse Cart and Cargo 1.0.0-rc12 (demifiend000); the author's own horse art, embedded in the mod's assembly as manifest resources (formats/dotnetResources.js reads them, test/tooling/hcc_assets.test.js pins them); permission RECORD OPEN - see vendor/horse-cart-and-cargo/README.md"],
  // HANDHELD TORCHES (HT1, vendor/handheld-torches/Textures/). Thirty-nine
  // textures of a third-party mod, vendored whole with the author's
  // permission (the line in vendor/handheld-torches/README.md) and
  // published the same way. The pixels are the author's own: no ARENA2
  // file shows a hand holding a torch or a torch lying on a floor - the
  // 112359 sheets are a first-person hand holding a lit torch (90x205)
  // or a lantern (110x138), the 112358 sheets are dropped lights with
  // their emission twins and three doused frames, all drawn in
  // Daggerfall's idiom rather than cut from it (the account:
  // bible/06-Systems/Handheld-Torches.md, 'The textures, and the doctrine').
  ['vendor/handheld-torches/Textures/112359_0-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit torch, frame 0"],
  ['vendor/handheld-torches/Textures/112359_0-1.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit torch, frame 1"],
  ['vendor/handheld-torches/Textures/112359_0-2.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit torch, frame 2"],
  ['vendor/handheld-torches/Textures/112359_0-3.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit torch, frame 3"],
  ['vendor/handheld-torches/Textures/112359_1-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit lantern, frame 0"],
  ['vendor/handheld-torches/Textures/112359_1-1.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit lantern, frame 1"],
  ['vendor/handheld-torches/Textures/112359_1-2.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit lantern, frame 2"],
  ['vendor/handheld-torches/Textures/112359_1-3.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the first-person hand holding a lit lantern, frame 3"],
  ['vendor/handheld-torches/Textures/112358_0-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped torch, frame 0"],
  ['vendor/handheld-torches/Textures/112358_0-0_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped torch's emission mask, frame 0"],
  ['vendor/handheld-torches/Textures/112358_0-1.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped torch, frame 1"],
  ['vendor/handheld-torches/Textures/112358_0-1_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped torch's emission mask, frame 1"],
  ['vendor/handheld-torches/Textures/112358_0-2.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped torch, frame 2"],
  ['vendor/handheld-torches/Textures/112358_0-2_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped torch's emission mask, frame 2"],
  ['vendor/handheld-torches/Textures/112358_0-3.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped torch, frame 3"],
  ['vendor/handheld-torches/Textures/112358_0-3_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped torch's emission mask, frame 3"],
  ['vendor/handheld-torches/Textures/112358_1-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped candle, frame 0"],
  ['vendor/handheld-torches/Textures/112358_1-0_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped candle's emission mask, frame 0"],
  ['vendor/handheld-torches/Textures/112358_1-1.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped candle, frame 1"],
  ['vendor/handheld-torches/Textures/112358_1-1_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped candle's emission mask, frame 1"],
  ['vendor/handheld-torches/Textures/112358_1-2.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped candle, frame 2"],
  ['vendor/handheld-torches/Textures/112358_1-2_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped candle's emission mask, frame 2"],
  ['vendor/handheld-torches/Textures/112358_1-3.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped candle, frame 3"],
  ['vendor/handheld-torches/Textures/112358_1-3_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped candle's emission mask, frame 3"],
  ['vendor/handheld-torches/Textures/112358_1-4.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped candle, frame 4"],
  ['vendor/handheld-torches/Textures/112358_1-4_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped candle's emission mask, frame 4"],
  ['vendor/handheld-torches/Textures/112358_2-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped holy candle, frame 0"],
  ['vendor/handheld-torches/Textures/112358_2-0_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped holy candle's emission mask, frame 0"],
  ['vendor/handheld-torches/Textures/112358_2-1.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped holy candle, frame 1"],
  ['vendor/handheld-torches/Textures/112358_2-1_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped holy candle's emission mask, frame 1"],
  ['vendor/handheld-torches/Textures/112358_2-2.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped holy candle, frame 2"],
  ['vendor/handheld-torches/Textures/112358_2-2_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped holy candle's emission mask, frame 2"],
  ['vendor/handheld-torches/Textures/112358_2-3.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped holy candle, frame 3"],
  ['vendor/handheld-torches/Textures/112358_2-3_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped holy candle's emission mask, frame 3"],
  ['vendor/handheld-torches/Textures/112358_2-4.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a dropped holy candle, frame 4"],
  ['vendor/handheld-torches/Textures/112358_2-4_Emission.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - the dropped holy candle's emission mask, frame 4"],
  ['vendor/handheld-torches/Textures/112358_10-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a doused torch, one frame, no emission"],
  ['vendor/handheld-torches/Textures/112358_11-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a doused candle, one frame, no emission"],
  ['vendor/handheld-torches/Textures/112358_12-0.png', "THIRD-PARTY - Handheld Torches 1.4.1 (RedRoryOTheGlen), carried on the author's permission; the mod's own pixel art - a doused holy candle, one frame, no emission"],
  // CLIMATES & CALORIES (SURV2, vendor/climates-calories/Textures/).
  // Sixteen of the mod's eighteen PNGs, carried on the author's
  // permission (vendor/climates-calories/README.md): the spoiled face
  // of each food, raw meat's three, the waterskin. Archives 532-539 are
  // the mod's own (its template indices), with no ARENA2 file behind
  // them - the pipeline stands a vendor archive in for them.
  ['vendor/climates-calories/Textures/532_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a mouldy apple"],
  ['vendor/climates-calories/Textures/532_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a rotten apple"],
  ['vendor/climates-calories/Textures/533_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a mouldy orange"],
  ['vendor/climates-calories/Textures/533_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a rotten orange"],
  ['vendor/climates-calories/Textures/534_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a mouldy bread"],
  ['vendor/climates-calories/Textures/534_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a rotten bread"],
  ['vendor/climates-calories/Textures/535_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a mouldy raw fish"],
  ['vendor/climates-calories/Textures/535_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a rotten raw fish"],
  ['vendor/climates-calories/Textures/536_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a mouldy cooked fish"],
  ['vendor/climates-calories/Textures/536_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a rotten cooked fish"],
  ['vendor/climates-calories/Textures/537_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a mouldy meat"],
  ['vendor/climates-calories/Textures/537_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - a rotten meat"],
  ['vendor/climates-calories/Textures/538_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - mouldy raw meat"],
  ['vendor/climates-calories/Textures/538_1-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - rotten raw meat"],
  ['vendor/climates-calories/Textures/538_2-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - raw meat, fresh"],
  ['vendor/climates-calories/Textures/539_0-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - the waterskin"],
  ['vendor/climates-calories/Textures/50_7-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - the tent's canvas (SURV-TENT)"],
  ['vendor/climates-calories/Textures/67_10-0.png', "THIRD-PARTY - Climates & Calories 1.7.1 (Ralzar), carried on the author's permission (relayed by Mac); the mod's own pixel art - the tent's pole (SURV-TENT)"],
  // DS1 (2026-09-25): DETAILED SHIPS 1.0.0 (Cliffworms) - the four of its
  // thirteen pictures that NO classic record is, measured against every
  // record of every TEXTURE file at every offset (tools/detailedShipsAssets.mjs);
  // the nine that are classic records ship as specs over the player's
  // own (Textures/derived.json), never as pixels.
  ['vendor/detailed-ships/Textures/1210_10-0.png', "THIRD-PARTY - Detailed Ships 1.0.0 (Cliffworms), carried under the author's readme ('may be distributed ... as long as I am credited'); the author's own 7x15 drawing - a green bottle"],
  ['vendor/detailed-ships/Textures/1210_11-0.png', "THIRD-PARTY - Detailed Ships 1.0.0 (Cliffworms), carried under the author's readme ('may be distributed ... as long as I am credited'); the author's own 7x15 drawing - a blue bottle"],
  ['vendor/detailed-ships/Textures/1210_12-0.png', "THIRD-PARTY - Detailed Ships 1.0.0 (Cliffworms), carried under the author's readme ('may be distributed ... as long as I am credited'); the author's own 7x15 drawing - an amber bottle"],
  ['vendor/detailed-ships/Textures/1230_30-0.png', "THIRD-PARTY - Detailed Ships 1.0.0 (Cliffworms), carried under the author's readme; the Kynareth statue the readme credits to King of Worms and Zoran ('for the deity statues'), credited beside him"],
  // FOEBAR1 (2026-09-17): THE TARGET BAR'S BLADE FACE. Two pictures a
  // friend of Mac's drew for this port and sent through him to be its
  // alternate enemy health bar - a twin-bladed shape with a skull hub,
  // the dark one the empty bar, the red one the fill. Original art on
  // the author's say-so, no ARENA2 pixel, no screenshot; both are one
  // crop (the union alpha box, 981x130) of the 1000x1000 originals so
  // they register. They sit under src/ui/assets/ rather than public/
  // because the game runs at /play/ and public/ is served at the root
  // alone; Vite bundles them with the page (the workers' pattern).
  ['src/ui/assets/foe-blade-empty.png', "FOEBAR1: the blade face's empty bar - a friend's original art, given for the port, cropped by us"],
  ['src/ui/assets/foe-blade-full.png', "FOEBAR1: the blade face's fill - a friend's original art, given for the port, cropped by us"],
  // FIELD-GUN-MW2 (2026-09-20): THE PORT'S OWN MORROWIND ASSETS. Both
  // are in Bethesda FORMATS and neither contains one byte of Bethesda
  // DATA - which is the distinction this list is for. The mesh is
  // Mac's own Blender model, baked to a 4.0.0.2 NIF by
  // tools/fbxMesh.mjs -> tools/meshUnwrap.mjs -> tools/nifWrite.mjs;
  // the texture is generated from that mesh's own geometry by
  // tools/meshTexture.mjs, deterministically, with no image input at
  // all. Re-run the chain on the same .fbx and the same bytes come out.
  // They ship because Morrowind has no firearm: no player's archives
  // can carry a model for the port's own weapon.
  ['src/assets/mw/source/Pellet_Shot.fbx', "OURS - Mac's own Blender export of the Dwarven Thunderlock, committed so the two files below are a DERIVATION the gate can re-run rather than a blob"],
  ['src/assets/mw/meshes/thunderlock.nif', "OURS - Mac's own Dwarven Thunderlock model, baked to a Morrowind NIF by tools/nifWrite.mjs; a Bethesda format, no Bethesda data"],
  ['src/assets/mw/textures/thunderlock.dds', 'OURS - generated from that mesh\'s own geometry by tools/meshTexture.mjs (position, normal and cast occlusion); no image input, no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/meshes/pistolet.nif', "OURS - the Dwarven Pistolet modelled part by part by tools/modelPistolet.mjs and written by tools/nifWrite.mjs (PISTOLET-MODEL); a Bethesda format, no Bethesda data"],
  ['src/assets/mw/textures/pistolet.dds', "OURS - that model's atlas, painted from its own surface by tools/modelPistolet.mjs; no ARENA2 or Morrowind pixel in it"],
  ['src/assets/mw/meshes/pistolet_gilded.nif', "OURS - the same model as pistolet.nif (the Sunken Sovereign's twin), naming its own texture, by tools/bakePistolet.mjs; a Bethesda format, no Bethesda data"],
  ['src/assets/mw/textures/pistolet_gilded.dds', "OURS - that model's atlas painted in gold leaf by tools/modelPistolet.mjs; no ARENA2 or Morrowind pixel in it"],
  ['src/assets/mw/meshes/thunderlock_gilded.nif', "OURS - the same baked mesh as thunderlock.nif (GILDED1, the Hourlock's twin), naming its own texture, by tools/bakeThunderlock.mjs; a Bethesda format, no Bethesda data"],
  ['src/assets/mw/textures/thunderlock_gilded.dds', 'OURS - generated from that mesh\'s own geometry by tools/meshTexture.mjs on its gold-leaf bands (GILDED_BANDS); no image input, no ARENA2 or Morrowind pixel in it'],
  // MW-BRIG1 (2026-09-29): the Steel Brigandine, the port's own worn
  // model, supplied by Mac for the Morrowind body. Unlike the
  // Thunderlock it carries a PAINTED texture (the FBX names it
  // Steel.png), so the DDS is that image mip-chained rather than grown
  // from geometry. tools/bakeBrigandine.mjs re-makes the three shipped
  // files from the two sources, and test/mwbrig1.test.js holds it to
  // the bytes.
  ['src/assets/mw/source/Brigandine_Steel.fbx', "SUPPLIED - Mac's Blender export of the steel brigandine, fitted on the Morrowind body in his scene (2026-09-29), committed so the files below are a DERIVATION the gate can re-run"],
  ['src/assets/mw/source/Brigandine_Steel.png', "SUPPLIED - the brigandine's texture as Mac supplied it with the mesh (the FBX's Steel.png), committed as the DDS's source"],
  ['src/assets/mw/meshes/brigandine_steel.nif', 'SUPPLIED - the brigandine, baked to a Morrowind NIF by tools/bakeBrigandine.mjs (skinned from the body at bind time, MW-BRIG2); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_steel.dds', 'SUPPLIED - Brigandine_Steel.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  // MW-BRIG4 (2026-10-09): Mac's nine paintings of the brigandine's unwrap, one per metal the jerkin is a brigandine in
  ['src/assets/mw/source/Brigandine_Iron.png', "SUPPLIED - the Iron brigandine's painting as Mac sent it (2026-10-09, his 1 of nine - tan with dark rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_iron.nif', 'SUPPLIED - the brigandine mesh written naming the Iron painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_iron.dds', 'SUPPLIED - Brigandine_Iron.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Silver.png', "SUPPLIED - the Silver brigandine's painting as Mac sent it (2026-10-09, his 7 of nine - deep blue with silver rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_silver.nif', 'SUPPLIED - the brigandine mesh written naming the Silver painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_silver.dds', 'SUPPLIED - Brigandine_Silver.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Elven.png', "SUPPLIED - the Elven brigandine's painting as Mac sent it (2026-10-09, his 6 of nine - green with white rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_elven.nif', 'SUPPLIED - the brigandine mesh written naming the Elven painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_elven.dds', 'SUPPLIED - Brigandine_Elven.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Dwarven.png', "SUPPLIED - the Dwarven brigandine's painting as Mac sent it (2026-10-09, his 9 of nine - deep blue with gold rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_dwarven.nif', 'SUPPLIED - the brigandine mesh written naming the Dwarven painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_dwarven.dds', 'SUPPLIED - Brigandine_Dwarven.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Mithril.png', "SUPPLIED - the Mithril brigandine's painting as Mac sent it (2026-10-09, his 3 of nine - light blue with teal rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_mithril.nif', 'SUPPLIED - the brigandine mesh written naming the Mithril painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_mithril.dds', 'SUPPLIED - Brigandine_Mithril.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Adamantium.png', "SUPPLIED - the Adamantium brigandine's painting as Mac sent it (2026-10-09, his 2 of nine - tan with red rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_adamantium.nif', 'SUPPLIED - the brigandine mesh written naming the Adamantium painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_adamantium.dds', 'SUPPLIED - Brigandine_Adamantium.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Ebony.png', "SUPPLIED - the Ebony brigandine's painting as Mac sent it (2026-10-09, his 8 of nine - red with light rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_ebony.nif', 'SUPPLIED - the brigandine mesh written naming the Ebony painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_ebony.dds', 'SUPPLIED - Brigandine_Ebony.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Orcish.png', "SUPPLIED - the Orcish brigandine's painting as Mac sent it (2026-10-09, his 5 of nine - green with dark rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_orcish.nif', 'SUPPLIED - the brigandine mesh written naming the Orcish painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_orcish.dds', 'SUPPLIED - Brigandine_Orcish.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Brigandine_Daedric.png', "SUPPLIED - the Daedric brigandine's painting as Mac sent it (2026-10-09, his 4 of nine - red with dark rivets), committed as its DDS's source"],
  ['src/assets/mw/meshes/brigandine_daedric.nif', 'SUPPLIED - the brigandine mesh written naming the Daedric painting by tools/bakeBrigandine.mjs (MW-BRIG4); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/brigandine_daedric.dds', 'SUPPLIED - Brigandine_Daedric.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  // MW-STEEL1 (2026-10-06): Mac's steel plate, the whole classic set for the Morrowind body, supplied as two Blender
  // exports of one scene (New_Ship.fbx, the open helm; New_Ship1.fbx, the closed). His scene also carried the body it
  // was fitted on - Morrowind's own Breton head and neck, out of a "Morrowind_TPose_Models" pack - and those are
  // Bethesda's meshes, so they are NOT committed: tools/fbxStrip.mjs took them out, every other record byte for byte,
  // and only their bounds are kept (tools/bakeSteelPlate.mjs SCENE_BODY). MW-STEEL2 (2026-10-07): the plate
  // skirt under the breastplate, stripped with them while its painting was missing, is kept since Mac sent the picture
  // ("This is the missing texture for the morrowind steel armor's skirt"), and baked like the rest. The armour itself is Mac's export
  // as given; three of its objects are named for the meshes they were modelled from (Imperial_Silver_Cuirass_67_Male,
  // Imperial_Steel_Left_Gauntlet_20_Male, Breton_Male), so whether the geometry and the paintings are his own work or
  // carry a licence of their own is Mac's to confirm (bible/04-Characters/Steel-Plate.md). tools/bakeSteelPlate.mjs
  // re-makes every mesh and texture below from these sources, and test/tooling/mwsteel1.test.js holds it to the bytes. MW-STEEL4
  // (2026-10-07): every mesh is skinned at the bake to Morrowind's Bip01 bones, its inverse binds the bind of the vendored
  // retail skeleton (vendor/weapon-sheathing, Greatness7's, credited) - numbers of a skeleton, no Bethesda geometry.
  ['src/assets/mw/source/Steel_Plate.fbx', "SUPPLIED - Mac's Blender export of the steel plate with the closed helm (steel_armor.fbx, 2026-10-09 - MW-STEEL5), committed as it came: it carries no Morrowind head or neck; committed so the files below are a DERIVATION the gate can re-run"],
  ['src/assets/mw/source/Steel_Plate_Open_Helm.fbx', "SUPPLIED - the open helm alone out of Mac's first export (New_Ship.fbx, 2026-10-06), every other object - and the Morrowind Breton head and neck it was fitted on - stripped by tools/fbxStrip.mjs (MW-STEEL5); a DERIVATION's source"],
  ['src/assets/mw/source/Steel_Plate_Cuirass.png', "SUPPLIED - the breastplate's painting as Mac sent it (his steelbreastplate texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Pauldron.png', "SUPPLIED - the pauldrons' painting as Mac sent it (his steelpauldrons texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Gauntlet.png', "SUPPLIED - the gauntlets' painting as Mac sent it (his newgloves texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Greave.png', "SUPPLIED - the greaves' painting as Mac sent it (his steelpants texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Boot.png', "SUPPLIED - the boots' painting as Mac sent it (his BOOTS texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Helm.png', "SUPPLIED - the helm's painting as Mac sent it (his helmet texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Visor.png', "SUPPLIED - the closed helm's visor and plume, painted as Mac sent it (his helmetface texture), committed as its DDS's source"],
  ['src/assets/mw/source/Steel_Plate_Skirt.png', "SUPPLIED - the plate skirt's painting as Mac sent it (the steelpelvis texture, 2026-10-07 - MW-STEEL2), committed as its DDS's source"],
  ['src/assets/mw/meshes/steel_plate_cuirass.nif', 'SUPPLIED - the steel plate\'s breastplate, baked to a Morrowind NIF by tools/bakeSteelPlate.mjs (skinned at the bake in retail\'s bind - MW-STEEL4); a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_skirt.nif', 'SUPPLIED - the steel plate\'s skirt of plates under the breastplate, baked by tools/bakeSteelPlate.mjs (MW-STEEL2; skinned at the bake in retail\'s bind - MW-STEEL4); a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_pauldron_right.nif', 'SUPPLIED - the steel plate\'s right pauldron, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_pauldron_left.nif', 'SUPPLIED - the steel plate\'s left pauldron, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_gauntlet_right.nif', 'SUPPLIED - the steel plate\'s right gauntlet, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_gauntlet_left.nif', 'SUPPLIED - the steel plate\'s left gauntlet, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_greave_right.nif', 'SUPPLIED - the steel plate\'s right greave, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_greave_left.nif', 'SUPPLIED - the steel plate\'s left greave, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_boot_right.nif', 'SUPPLIED - the steel plate\'s right boot, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_boot_left.nif', 'SUPPLIED - the steel plate\'s left boot, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_helm_open.nif', 'SUPPLIED - the steel plate\'s open helm, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/meshes/steel_plate_helm_closed.nif', 'SUPPLIED - the steel plate\'s closed helm, its shell and its visor two shapes of one part, baked by tools/bakeSteelPlate.mjs; a Bethesda format - the geometry Mac\'s export as given'],
  ['src/assets/mw/textures/steel_plate_cuirass.dds', 'SUPPLIED - Steel_Plate_Cuirass.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_pauldron.dds', 'SUPPLIED - Steel_Plate_Pauldron.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_gauntlet.dds', 'SUPPLIED - Steel_Plate_Gauntlet.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_greave.dds', 'SUPPLIED - Steel_Plate_Greave.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_boot.dds', 'SUPPLIED - Steel_Plate_Boot.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_helm.dds', 'SUPPLIED - Steel_Plate_Helm.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_visor.dds', 'SUPPLIED - Steel_Plate_Visor.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/steel_plate_skirt.dds', 'SUPPLIED - Steel_Plate_Skirt.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  // MW-EBONY1 (2026-10-09): Mac's ebony plate - one Blender export with nothing of Bethesda's in it, seven paintings
  ['src/assets/mw/source/Ebony_Plate.fbx', "SUPPLIED - Mac's Blender export of the ebony plate (ebony_armor.fbx, 2026-10-09), committed as it came: it carries no Morrowind head or neck; committed so the files below are a DERIVATION the gate can re-run"],
  ['src/assets/mw/source/Ebony_Plate_Cuirass.png', "SUPPLIED - the ebony cuirass's painting as Mac sent it (his ebonybreastplate texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/source/Ebony_Plate_Skirt.png', "SUPPLIED - the ebony skirt's painting as Mac sent it (his EBONYPELVIS texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/source/Ebony_Plate_Pauldron.png', "SUPPLIED - the ebony pauldron's painting as Mac sent it (his ebonyshoulders texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/source/Ebony_Plate_Gauntlet.png', "SUPPLIED - the ebony gauntlet's painting as Mac sent it (his ebonygauntlets texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/source/Ebony_Plate_Greave.png', "SUPPLIED - the ebony greave's painting as Mac sent it (his ebonypants texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/source/Ebony_Plate_Boot.png', "SUPPLIED - the ebony boot's painting as Mac sent it (his ebonyboots texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/source/Ebony_Plate_Helm.png', "SUPPLIED - the ebony helm's painting as Mac sent it (his ebony helmet texture, matched to its piece by the UV islands it traces), committed as its DDS's source"],
  ['src/assets/mw/meshes/ebony_plate_cuirass.nif', 'SUPPLIED - the ebony cuirass, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_skirt.nif', 'SUPPLIED - the ebony skirt, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_pauldron_right.nif', 'SUPPLIED - the ebony pauldron right, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_pauldron_left.nif', 'SUPPLIED - the ebony pauldron left, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_gauntlet_right.nif', 'SUPPLIED - the ebony gauntlet right, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_gauntlet_left.nif', 'SUPPLIED - the ebony gauntlet left, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_greave_right.nif', 'SUPPLIED - the ebony greave right, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_greave_left.nif', 'SUPPLIED - the ebony greave left, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_boot_right.nif', 'SUPPLIED - the ebony boot right, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_boot_left.nif', 'SUPPLIED - the ebony boot left, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/ebony_plate_helm.nif', 'SUPPLIED - the ebony helm, baked from Ebony_Plate.fbx by tools/bakeEbonyPlate.mjs, skinned to the retail bind (MW-EBONY1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/ebony_plate_cuirass.dds', 'SUPPLIED - Ebony_Plate_Cuirass.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/ebony_plate_skirt.dds', 'SUPPLIED - Ebony_Plate_Skirt.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/ebony_plate_pauldron.dds', 'SUPPLIED - Ebony_Plate_Pauldron.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/ebony_plate_gauntlet.dds', 'SUPPLIED - Ebony_Plate_Gauntlet.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/ebony_plate_greave.dds', 'SUPPLIED - Ebony_Plate_Greave.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/ebony_plate_boot.dds', 'SUPPLIED - Ebony_Plate_Boot.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/ebony_plate_helm.dds', 'SUPPLIED - Ebony_Plate_Helm.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/source/Cloak.fbx', "SUPPLIED - Mac's Blender export of the cloak (New_Ship-1.fbx, 2026-10-09 - MW-CLOAK1), committed as it came: the cloak alone, no Morrowind body; committed so the files below are a DERIVATION the gate can re-run"],
  ['src/assets/mw/source/Cloak_Blue.png', "SUPPLIED - Mac's blue painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_Grey.png', "SUPPLIED - Mac's grey painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_Red.png', "SUPPLIED - Mac's red painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_Dark_Brown.png', "SUPPLIED - Mac's dark brown painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_Purple.png', "SUPPLIED - Mac's purple painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_Light_Brown.png', "SUPPLIED - Mac's light brown painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_White.png', "SUPPLIED - Mac's white painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/source/Cloak_Green.png', "SUPPLIED - Mac's green painting of the cloak (2026-10-09 - MW-CLOAK1), committed as it came"],
  ['src/assets/mw/meshes/cloak_blue.nif', 'SUPPLIED - the cloak in its blue painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_grey.nif', 'SUPPLIED - the cloak in its grey painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_red.nif', 'SUPPLIED - the cloak in its red painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_dark_brown.nif', 'SUPPLIED - the cloak in its dark brown painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_purple.nif', 'SUPPLIED - the cloak in its purple painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_light_brown.nif', 'SUPPLIED - the cloak in its light brown painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_white.nif', 'SUPPLIED - the cloak in its white painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/meshes/cloak_green.nif', 'SUPPLIED - the cloak in its green painting, baked from Cloak.fbx by tools/bakeCloak.mjs, skinned to the retail bind (MW-CLOAK1); a Bethesda format, no Bethesda data'],
  ['src/assets/mw/textures/cloak_blue.dds', 'SUPPLIED - Cloak_Blue.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_grey.dds', 'SUPPLIED - Cloak_Grey.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_red.dds', 'SUPPLIED - Cloak_Red.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_dark_brown.dds', 'SUPPLIED - Cloak_Dark_Brown.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_purple.dds', 'SUPPLIED - Cloak_Purple.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_light_brown.dds', 'SUPPLIED - Cloak_Light_Brown.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_white.dds', 'SUPPLIED - Cloak_White.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  ['src/assets/mw/textures/cloak_green.dds', 'SUPPLIED - Cloak_Green.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds; no ARENA2 or Morrowind pixel in it'],
  // MW-HEADS1 (2026-10-13): the Breton men's three heads and three hairs, the port's own in place of Morrowind's for every
  // Breton man, supplied by the owner as one Blender export of three objects (each a face and a hair, two paintings) and
  // six paintings sent as nameless attachments, each matched to the material the export names it on. The objects are
  // named for the Morrowind head they were modelled from (b_n_breton_m_head_05), so whether the geometry is the owner's
  // own work or carries a licence of its own is the owner's to confirm, as the steel plate's is
  // (bible/04-Characters/Own-Heads.md). tools/bakeHeads.mjs re-makes every mesh and texture below from these sources and
  // test/tooling/mwheads1.test.js holds it to the bytes. Rigid parts: no skeleton's numbers in them.
  ['src/assets/mw/source/Breton_Heads.fbx', "SUPPLIED - the owner's Blender export of the Breton men's three heads and hairs (daggerwind.fbx, 2026-10-13 - MW-HEADS1), committed as it came so the files below are a DERIVATION the gate can re-run; its objects are named for the Morrowind head they were modelled from, so the geometry's provenance is the owner's to confirm"],
  ['src/assets/mw/source/Breton_Head_H04.png', "SUPPLIED - the h04 face's painting as the owner sent it (the export's tx_b_n_breton_m_h04.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for a Morrowind head's UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Breton_Head_H0411.png', "SUPPLIED - the h0411 face, the eyepatch's painting as the owner sent it (the export's tx_b_n_breton_m_h0411.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for a Morrowind head's UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Breton_Head_H0423.png', "SUPPLIED - the h0423 face's painting as the owner sent it (the export's tx_b_n_breton_m_h0423.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for a Morrowind head's UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Breton_Hair_Widow.png', "SUPPLIED - the widow's-peak hair's painting as the owner sent it (the export's tx_b_n_breton_m_hair_widow.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for a Morrowind head's UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Breton_Hair_01.png', "SUPPLIED - the 01 hair's painting as the owner sent it (the export's tx_b_n_breton_m_hair01.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for a Morrowind head's UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Breton_Hair_0111.png', "SUPPLIED - the 0111 hair, the red headband's painting as the owner sent it (the export's tx_b_n_breton_m_hair0111.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for a Morrowind head's UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/meshes/breton_m_head_h04.nif', "SUPPLIED - the h04 face, baked from Breton_Heads.fbx by tools/bakeHeads.mjs - a rigid part in the head's own frame (MW-HEADS1); a Bethesda format - the geometry the owner's export as given - named for the Morrowind head it was modelled from, its provenance the owner's to confirm"],
  ['src/assets/mw/meshes/breton_m_head_h0411.nif', "SUPPLIED - the h0411 face, the eyepatch, baked from Breton_Heads.fbx by tools/bakeHeads.mjs - a rigid part in the head's own frame (MW-HEADS1); a Bethesda format - the geometry the owner's export as given - named for the Morrowind head it was modelled from, its provenance the owner's to confirm"],
  ['src/assets/mw/meshes/breton_m_head_h0423.nif', "SUPPLIED - the h0423 face, baked from Breton_Heads.fbx by tools/bakeHeads.mjs - a rigid part in the head's own frame (MW-HEADS1); a Bethesda format - the geometry the owner's export as given - named for the Morrowind head it was modelled from, its provenance the owner's to confirm"],
  ['src/assets/mw/meshes/breton_m_hair_widow.nif', "SUPPLIED - the widow's-peak hair, baked from Breton_Heads.fbx by tools/bakeHeads.mjs - a rigid part in the head's own frame (MW-HEADS1); a Bethesda format - the geometry the owner's export as given - named for the Morrowind head it was modelled from, its provenance the owner's to confirm"],
  ['src/assets/mw/meshes/breton_m_hair_01.nif', "SUPPLIED - the 01 hair, baked from Breton_Heads.fbx by tools/bakeHeads.mjs - a rigid part in the head's own frame (MW-HEADS1); a Bethesda format - the geometry the owner's export as given - named for the Morrowind head it was modelled from, its provenance the owner's to confirm"],
  ['src/assets/mw/meshes/breton_m_hair_0111.nif', "SUPPLIED - the 0111 hair, the red headband, baked from Breton_Heads.fbx by tools/bakeHeads.mjs - a rigid part in the head's own frame (MW-HEADS1); a Bethesda format - the geometry the owner's export as given - named for the Morrowind head it was modelled from, its provenance the owner's to confirm"],
  ['src/assets/mw/textures/breton_m_head_h04.dds', 'SUPPLIED - Breton_Head_H04.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/breton_m_head_h0411.dds', 'SUPPLIED - Breton_Head_H0411.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/breton_m_head_h0423.dds', 'SUPPLIED - Breton_Head_H0423.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/breton_m_hair_widow.dds', 'SUPPLIED - Breton_Hair_Widow.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/breton_m_hair_01.dds', 'SUPPLIED - Breton_Hair_01.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/breton_m_hair_0111.dds', 'SUPPLIED - Breton_Hair_0111.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  // MW-FOLK1 (2026-10-13): the townsfolk's outfits - each walker sprite's own outfit made for the Morrowind body (all four
  // Redguard men's and all four Nord men's, the Bretons' 385 and 386, the hooded Redguard woman's 398), supplied by the
  // owner as one Blender export of nine objects (clothes.fbx) and fourteen paintings sent as nameless attachments, each
  // matched to the material the export names it on (two outfits wear another of them - bakeTownsfolk.mjs RECOLOURS).
  // The export carried, joined into the 385 outfit, 61 polygons of Morrowind's own groin under the tunic, painted with
  // Morrowind's tx_b_n_generic_m_g00 - Bethesda's mesh: tools/fbxStrip.mjs cut them out before the export was
  // committed, every other record byte for byte (MW-STEEL1's law). The outfits were made on a Morrowind body - 385's
  // hose is that body's leg repainted - so whether every piece's geometry is the owner's own work is the owner's to
  // confirm, as the heads' is (bible/04-Characters/Townsfolk-Outfits.md). tools/bakeTownsfolk.mjs re-makes every mesh
  // and texture below from these sources and retail's skeleton, and test/tooling/mwfolk1.test.js holds it to the bytes.
  ['src/assets/mw/source/Townsfolk.fbx', "SUPPLIED - the owner's Blender export of the townsfolk's outfits (clothes.fbx, 2026-10-13 - MW-FOLK1), committed less the 61 polygons of Morrowind's own groin one object carried (tools/fbxStrip.mjs --cut=Breton_Male.018:6), so the files below are a DERIVATION the gate can re-run; made on a Morrowind body, its geometry's provenance is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Tunic_Bretonnpc.png', "SUPPLIED - the painting of 385's tunic, as the owner sent it (the export's bretonnpc/Material.019, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Hose_Bretonnpc.png', "SUPPLIED - the painting of the striped hose 385, 388 and 389 wear, as the owner sent it (the export's bretonnpc/Material.020, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Sleeves_Bretonnpc.png', "SUPPLIED - the painting of 385's long sleeves, as the owner sent it (the export's bretonnpc/Material.018, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Tunic_Nord1.png', "SUPPLIED - the painting of 386's and 390's tunic - and 389's hooded one in its teal (a recolour), as the owner sent it (the export's nord1/Material.019, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Breeches_Nord1.png', "SUPPLIED - the painting of 386's and 390's breeches, as the owner sent it (the export's nord1/Material.020, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Tunic_Nord2.png', "SUPPLIED - the painting of 388's green hood and orange tunic, as the owner sent it (the export's nord2/Material.019, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Tunic_Nord3.png', "SUPPLIED - the painting of 387's green vest, as the owner sent it (the export's NORD3/Material.019, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Shoulders_Nord3.png', "SUPPLIED - the painting of 387's shoulder pieces, as the owner sent it (the export's NORD3/Material.018, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Kit_Redguard1.png', "SUPPLIED - the painting of the kit - belts, cuffs, sandals, a pouch - several outfits wear, as the owner sent it (the export's redguard1/DefaultMaterial, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Skirt_Redguard2.png', "SUPPLIED - the painting of 384's striped skirt and boots and 387's skirt and boots - and 390's boots (a recolour), as the owner sent it (the export's Redguard2/Material.007, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Boots_Redguard2.png', "SUPPLIED - the painting of 386's boots, as the owner sent it (the export's Redguard2/14124.png, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Robe_Redguard3.png', "SUPPLIED - the painting of 381's grey robe with the red hem, as the owner sent it (the export's redguard3/tunic, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Robe_Redguard4.png', "SUPPLIED - the painting of 383's teal robe with the yellow hem, as the owner sent it (the export's redguard4/tunic, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/source/Townsfolk_Dress_Redguardwoman1.png', "SUPPLIED - the painting of 398's hooded dress, as the owner sent it (the export's redguardwoman1/DefaultMaterial, matched to its material by what it is drawn for), committed as its DDS's source; a painting for the outfit's own UV layout, no ARENA2 pixel in it - whether it is wholly the owner's own work is the owner's to confirm"],
  ['src/assets/mw/meshes/townsfolk_381.nif', "SUPPLIED - the Redguard 381's: the grey robe with the red hem, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_382.nif', "SUPPLIED - the Redguard 382's: the kilt, the wrist cuffs, the sandals, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_383.nif', "SUPPLIED - the Redguard 383's: the teal robe with the yellow hem, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_384.nif', "SUPPLIED - the Redguard 384's: the striped skirt and the boots, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its boots' lower legs that body's, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_385.nif', "SUPPLIED - the Breton 385's: the tunic, the long sleeves, the striped hose, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its hose that body's leg repainted, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_386.nif', "SUPPLIED - the Breton 386's: the tunic, the wraps, the breeches, the boots, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its breeches and its boots' lower legs parts of that body's leg, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_387.nif', "SUPPLIED - the Nord 387's: the green vest, the wraps, the striped skirt, the boots, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its boots' lower legs that body's, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_388.nif', "SUPPLIED - the Nord 388's: the green hood, the orange tunic, the striped hose, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its hose that body's leg repainted, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_389.nif', "SUPPLIED - the Nord 389's: 388's hooded tunic in teal, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its hose that body's leg repainted, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_390.nif', "SUPPLIED - the Nord 390's: 386's outfit with the striped boots, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its breeches and its boots' lower legs parts of that body's leg, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/meshes/townsfolk_398.nif', "SUPPLIED - the hooded Redguard woman 398's dress, baked from Townsfolk.fbx by tools/bakeTownsfolk.mjs - one skinned part, bound in the pose the outfits were made in (MW-FOLK1); a Bethesda format - the geometry the owner's export as given - made on a Morrowind body, its provenance the owner's to confirm (AUDIT MW-FOLK1 L1-F3)"],
  ['src/assets/mw/textures/townsfolk_tunic_bretonnpc.dds', 'SUPPLIED - Townsfolk_Tunic_Bretonnpc.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_hose_bretonnpc.dds', 'SUPPLIED - Townsfolk_Hose_Bretonnpc.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_sleeves_bretonnpc.dds', 'SUPPLIED - Townsfolk_Sleeves_Bretonnpc.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_tunic_nord1.dds', 'SUPPLIED - Townsfolk_Tunic_Nord1.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_breeches_nord1.dds', 'SUPPLIED - Townsfolk_Breeches_Nord1.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_tunic_nord2.dds', 'SUPPLIED - Townsfolk_Tunic_Nord2.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_tunic_nord3.dds', 'SUPPLIED - Townsfolk_Tunic_Nord3.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_shoulders_nord3.dds', 'SUPPLIED - Townsfolk_Shoulders_Nord3.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_kit_redguard1.dds', 'SUPPLIED - Townsfolk_Kit_Redguard1.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_skirt_redguard2.dds', 'SUPPLIED - Townsfolk_Skirt_Redguard2.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_boots_redguard2.dds', 'SUPPLIED - Townsfolk_Boots_Redguard2.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_robe_redguard3.dds', 'SUPPLIED - Townsfolk_Robe_Redguard3.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_robe_redguard4.dds', 'SUPPLIED - Townsfolk_Robe_Redguard4.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  ['src/assets/mw/textures/townsfolk_dress_redguardwoman1.dds', 'SUPPLIED - Townsfolk_Dress_Redguardwoman1.png mip-chained to an uncompressed DDS by tools/meshTexture.mjs writeDds'],
  // GALLEON (2026-10-01): the new galleon, Mac's own model of hull 2 (the
  // Small Ship), supplied as three Blender exports of one scene - the same
  // geometry, only their creation stamps differ, so one is committed. The
  // FBX is the source; tools/bakeGalleon.mjs re-makes galleon.json from it
  // (its parts in the boat's frame, triangulated), and
  // test/world/ships/galleon_model.test.js holds the bake to the bytes. Her pictures
  // carry no file at all: world/ships/galleonArt.js paints them at load, from
  // nothing but numbers - no ARENA2 pixel.
  ['src/assets/galleon/source/New_Ship.fbx', "SUPPLIED - Mac's Blender export of the new galleon (2026-10-01; his second, New_Ship_Even_EVEN_newer.fbx, over it 2026-10-02), committed so galleon.json is a DERIVATION the gate can re-run"],
  ['src/assets/galleon/galleon.json', 'SUPPLIED - New_Ship.fbx baked to the boat\'s frame by tools/bakeGalleon.mjs; geometry only, no ARENA2 or Come Sail Away data'],
  // SHIPS-2 (2026-10-07, Mac: "implement both of these new ship placement models"): MAC'S CARRACK AND HIS TINY SHIP,
  // supplied as three Blender exports - New_Ship_2.fbx, New_Ship_2_Shutter.fbx and Tiny_Ship.fbx, the newest holding
  // both ships and the shutter in their places, so it alone is committed. tools/bakeCarrack.mjs and
  // tools/bakeLargeBoat.mjs re-make their JSON from it (tools/shipBake.mjs), and test/tooling/ships2_bake.test.js holds both
  // to the bytes. Their pictures carry no file: world/ships/carrackArt.js and world/ships/largeBoatArt.js paint them at load.
  ['src/assets/ships/source/Tiny_Ship.fbx', "SUPPLIED - Mac's Blender export of the new carrack and the new large boat in one scene (2026-10-07; the newest of the three he sent), committed so carrack.json and largeBoat.json are DERIVATIONS the gate can re-run"],
  ['src/assets/ships/carrack.json', 'SUPPLIED - Tiny_Ship.fbx\'s carrack baked to the boat\'s frame by tools/bakeCarrack.mjs; geometry only, no ARENA2 or Come Sail Away data'],
  ['src/assets/ships/largeBoat.json', 'SUPPLIED - Tiny_Ship.fbx\'s large boat baked to the boat\'s frame by tools/bakeLargeBoat.mjs; geometry only, no ARENA2 or Come Sail Away data'],  ['src/assets/sunbaby/todd.jpg', 'SUPPLIED - a photograph of Todd Howard that Mac supplied for the sun baby event (SUNBABY3, 2026-10-04), cropped to the face and recompressed by ImageMagick; no ARENA2 pixel in it - a third-party photo, not the port own art, kept at his explicit request'],
  // GATE-FBX (2026-10-09, Mac: "replace the oblivion gate model with this handcrafted model which also needs texturing"):
  // MAC'S OBLIVION GATE, supplied as one Blender export of his whole "Oblivion Models" scene - the gate one object of
  // it, committed whole as the ships' scenes are. tools/bakeGate.mjs re-makes the JSON from it (tools/shipBake.mjs), and
  // test/tooling/gatefbx.test.js holds it to the bytes. Its pictures carry no file: world/gate/gateArt.js paints them at load.
  ['src/assets/gate/source/Oblivion_Gate.fbx', "SUPPLIED - Mac's Blender export of his Oblivion models' scene, the gate (Cube.1688) among them (2026-10-09), committed so oblivionGate.json is a DERIVATION the gate can re-run"],
  ['src/assets/gate/oblivionGate.json', 'SUPPLIED - Oblivion_Gate.fbx\'s gate baked to the gate\'s frame by tools/bakeGate.mjs; geometry only, no ARENA2 data'],
  // EG6c (2026-10-12, Elite-Gates.md section 11.6): THE REFERENCE HERO FRAGMENT - the port's own stand-in for Mac's
  // authored fragments, a scene written from numbers alone by tools/egRefFragScene.mjs (no image, no game data, no
  // third-party art) and committed as the .fbx tools/fragBake.mjs bakes; tools/bakeEgRefFrag.mjs re-makes its two halves,
  // and test/tooling/eg6c_bake.test.js holds the scene and both halves to their bytes.
  ['src/assets/egfrags/source/egRefFrag.fbx', 'OURS - the reference hero fragment\'s scene, written by tools/egRefFragScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egRefFrag.law.json', 'OURS - egRefFrag.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgRefFrag.mjs; numbers only'],
  ['src/assets/egfrags/egRefFrag.mesh.json', 'OURS - egRefFrag.fbx\'s mesh half baked by tools/bakeEgRefFrag.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  // EG-HERO (the Soul Cairn, 2026-10-13, the owner: "You have to author the fragments"): THE OSSUARY AND THE MIST STAIR, the
  // Cairn's hero fragments, each a scene written from numbers alone by its tools/egHero*Scene.mjs (no image, no game data,
  // no third-party art) and baked by its tools/bakeEgHero*.mjs; test/tooling/eghero_cairn.test.js holds each scene and both halves
  // to their bytes.
  ['src/assets/egfrags/source/egheroOssuary.fbx', 'OURS - the Ossuary\'s scene, written by tools/egHeroOssuaryScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroOssuary.law.json', 'OURS - egheroOssuary.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroOssuary.mjs; numbers only'],
  ['src/assets/egfrags/egheroOssuary.mesh.json', 'OURS - egheroOssuary.fbx\'s mesh half baked by tools/bakeEgHeroOssuary.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  ['src/assets/egfrags/source/egheroMistStair.fbx', 'OURS - the Mist Stair\'s scene, written by tools/egHeroMistStairScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroMistStair.law.json', 'OURS - egheroMistStair.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroMistStair.mjs; numbers only'],
  ['src/assets/egfrags/egheroMistStair.mesh.json', 'OURS - egheroMistStair.fbx\'s mesh half baked by tools/bakeEgHeroMistStair.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  // EG-HERO (2026-10-13, the owner: "You have to author the fragments"): THE SHADE'S TWO HEROES - the Gloam Thicket's
  // passage and the Eclipse Vault's chamber, each a scene written from numbers alone by its tools/egHero*Scene.mjs and
  // baked by its tools/bakeEgHero*.mjs; test/tooling/eghero_shade.test.js holds each scene and both its halves to their bytes.
  ['src/assets/egfrags/source/egheroGloam.fbx', 'OURS - the Gloam Thicket hero passage\'s scene, written by tools/egHeroGloamScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroGloam.law.json', 'OURS - egheroGloam.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroGloam.mjs; numbers only'],
  ['src/assets/egfrags/egheroGloam.mesh.json', 'OURS - egheroGloam.fbx\'s mesh half baked by tools/bakeEgHeroGloam.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  ['src/assets/egfrags/source/egheroEclipse.fbx', 'OURS - the Eclipse Vault hero chamber\'s scene, written by tools/egHeroEclipseScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroEclipse.law.json', 'OURS - egheroEclipse.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroEclipse.mjs; numbers only'],
  ['src/assets/egfrags/egheroEclipse.mesh.json', 'OURS - egheroEclipse.fbx\'s mesh half baked by tools/bakeEgHeroEclipse.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  // EG-HERO (2026-10-13, Mac: "You have to author the fragments"; Elite-Gates.md section 31, EG-HERO (the Broken
  // Galleries)): THE GALLERIES' THREE HERO FRAGMENTS - scenes the port writes from numbers alone (tools/egHeroCavernsScene.mjs,
  // egHeroStacksScene.mjs, egHeroColonnadeScene.mjs - no image, no game data, no third-party art), committed as the .fbx
  // tools/fragBake.mjs bakes; each its own bake script re-makes its two halves, and test/tooling/eghero_galleries.test.js holds every
  // scene and half to its bytes.
  ['src/assets/egfrags/source/egheroCaverns.fbx', 'OURS - the Oblivion Caverns hero passage\'s scene, written by tools/egHeroCavernsScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroCaverns.law.json', 'OURS - egheroCaverns.fbx\'s law half baked by tools/bakeEgHeroCaverns.mjs; numbers only'],
  ['src/assets/egfrags/egheroCaverns.mesh.json', 'OURS - egheroCaverns.fbx\'s mesh half baked by tools/bakeEgHeroCaverns.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  ['src/assets/egfrags/source/egheroStacks.fbx', 'OURS - the Fallen Stacks hero chamber\'s scene, written by tools/egHeroStacksScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroStacks.law.json', 'OURS - egheroStacks.fbx\'s law half baked by tools/bakeEgHeroStacks.mjs; numbers only'],
  ['src/assets/egfrags/egheroStacks.mesh.json', 'OURS - egheroStacks.fbx\'s mesh half baked by tools/bakeEgHeroStacks.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  ['src/assets/egfrags/source/egheroColonnade.fbx', 'OURS - the Broken Colonnade hero passage\'s scene, written by tools/egHeroColonnadeScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroColonnade.law.json', 'OURS - egheroColonnade.fbx\'s law half baked by tools/bakeEgHeroColonnade.mjs; numbers only'],
  ['src/assets/egfrags/egheroColonnade.mesh.json', 'OURS - egheroColonnade.fbx\'s mesh half baked by tools/bakeEgHeroColonnade.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  // EG-HERO (2026-10-13, the owner: "You have to author the fragments"): THE HAVOC WELLHEAD'S HERO FRAGMENTS - the Forge Gut,
  // the Clan Pit and the Oblivion Caverns, deep, each a scene written from numbers alone by its tools/egHero*Scene.mjs (no
  // image, no game data, no third-party art), committed as the .fbx tools/fragBake.mjs bakes; each tools/bakeEgHero*.mjs
  // re-makes its two halves, and test/tooling/eghero_wellhead.test.js holds each scene and both halves to their bytes.
  ['src/assets/egfrags/source/egheroForgeGut.fbx', 'OURS - a Wellhead hero fragment\'s scene, written by tools/egHeroForgeGutScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroForgeGut.law.json', 'OURS - egheroForgeGut.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroForgeGut.mjs; numbers only'],
  ['src/assets/egfrags/egheroForgeGut.mesh.json', 'OURS - egheroForgeGut.fbx\'s mesh half baked by tools/bakeEgHeroForgeGut.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  ['src/assets/egfrags/source/egheroClanPit.fbx', 'OURS - a Wellhead hero fragment\'s scene, written by tools/egHeroClanPitScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroClanPit.law.json', 'OURS - egheroClanPit.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroClanPit.mjs; numbers only'],
  ['src/assets/egfrags/egheroClanPit.mesh.json', 'OURS - egheroClanPit.fbx\'s mesh half baked by tools/bakeEgHeroClanPit.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  ['src/assets/egfrags/source/egheroDeepCaverns.fbx', 'OURS - a Wellhead hero fragment\'s scene, written by tools/egHeroDeepCavernsScene.mjs from numbers alone; no ARENA2 data, no third-party art'],
  ['src/assets/egfrags/egheroDeepCaverns.law.json', 'OURS - egheroDeepCaverns.fbx\'s law half (its markers, section 11.5\'s record) baked by tools/bakeEgHeroDeepCaverns.mjs; numbers only'],
  ['src/assets/egfrags/egheroDeepCaverns.mesh.json', 'OURS - egheroDeepCaverns.fbx\'s mesh half baked by tools/bakeEgHeroDeepCaverns.mjs; geometry only, its pictures the band\'s painted dress, no ARENA2 data'],
  // WAGONS1 (2026-10-09, Mac: "Here are 3 new models that will need to be textured"): MAC'S THREE WAGONS, supplied as
  // four saves of one Blender scene ("wagons.blend") - the newest committed whole, as the ships' scenes are.
  // tools/bakeWagons.mjs re-makes the three JSONs from it (tools/shipBake.mjs), and test/tooling/wagons1_bake.test.js holds them
  // to the bytes. Their pictures carry no file: world/wagonArt.js paints them at load.
  ['src/assets/wagons/source/Wagon_Cart_Tiny_1.fbx', "SUPPLIED - Mac's Blender export of his wagons' scene, the Wagon Cart, the Open Wagon and the Caravan among its stations (2026-10-09; the newest of the four he sent), committed so the three wagon JSONs are DERIVATIONS the gate can re-run"],
  ['src/assets/wagons/cart.json', "SUPPLIED - Wagon_Cart_Tiny_1.fbx's Wagon Cart baked to the wagon's frame by tools/bakeWagons.mjs; geometry only, no ARENA2 or Horse Cart and Cargo data"],
  ['src/assets/wagons/openWagon.json', "SUPPLIED - Wagon_Cart_Tiny_1.fbx's Open Wagon baked to the wagon's frame by tools/bakeWagons.mjs; geometry only, no ARENA2 or Horse Cart and Cargo data"],
  ['src/assets/wagons/caravan.json', "SUPPLIED - Wagon_Cart_Tiny_1.fbx's Caravan baked to the wagon's frame by tools/bakeWagons.mjs; geometry only, no ARENA2 or Horse Cart and Cargo data"],
  // MEADOW1 (2026-10-06, Mac: "These are 4 textures I want to blend into our grass system", then a bush): THE
  // MEADOW'S FIVE SPRITES, supplied by Mac as indexed PNGs and committed as he supplied them. Nothing ships them:
  // tools/bakeMeadow.mjs bakes them into render/meadowArt.js, and test/render/grassmeadow.test.js holds that module to
  // them texel for texel. Their colours are not looked up in any palette at runtime - the sprites carry their own.
  ['src/assets/grass/source/tuft-tall.png', "SUPPLIED - Mac's tall grass tuft for the meadow grass (MEADOW1, 2026-10-06), 32x32 indexed, his own PNG bytes - his own pixel art, no ARENA2 pixel in it (his word, AUDIT MEADOW1 2026-10-06)"],
  ['src/assets/grass/source/tuft-short.png', "SUPPLIED - Mac's short grass tuft for the meadow grass (MEADOW1, 2026-10-06), 32x32 indexed, his own PNG bytes - his own pixel art, no ARENA2 pixel in it (his word, AUDIT MEADOW1 2026-10-06)"],
  ['src/assets/grass/source/flowers.png', "SUPPLIED - Mac's flower tuft for the meadow grass (MEADOW1, 2026-10-06), 32x32 indexed, his own PNG bytes - his own pixel art, no ARENA2 pixel in it (his word, AUDIT MEADOW1 2026-10-06)"],
  ['src/assets/grass/source/tuft-dry.png', "SUPPLIED - Mac's dry grass tuft for the meadow grass (MEADOW1, 2026-10-06), 32x32 indexed, his own PNG bytes - his own pixel art, no ARENA2 pixel in it (his word, AUDIT MEADOW1 2026-10-06)"],
  ['src/assets/grass/source/bush.png', "SUPPLIED - Mac's bush for the meadow grass (MEADOW1, 2026-10-06), 64x64 indexed, his own PNG bytes - his own pixel art, no ARENA2 pixel in it (his word, AUDIT MEADOW1 2026-10-06)"],
  // BANTHA1 (2026-10-18, the owner: "Using the attached file, populate the area in a dense jungle like format"): THE
  // JUNGLE'S FIVE TREES, supplied as jungle_trees.zip - each a Blender 5.2 OBJ, its MTL and its one 252x164 picture -
  // committed as the owner handed them over, byte for byte. They ship as they are: systems/jungleTreesAssets.js fetches
  // them and world/jungle/jungleModels.js reads them at run time (no bake), and test/world/bantha1_jungle.test.js reads
  // the same bytes. The owner's own art for their biome - the pictures included, recorded 2026-10-18 at the audit's
  // opening (the owner: "These textures are ours"; bible/03-World/Bantha-Jungle.md): no pixel of them is ARENA2's.
  ['src/assets/jungle/source/jungle_tree.obj', "SUPPLIED - the owner's banyan for the Jungle of Bantha (BANTHA1, 2026-10-18), the owner's Blender 5.2 OBJ export as handed over - geometry only, read at run time by world/jungle/jungleModels.js"],
  ['src/assets/jungle/source/jungle_tree.mtl', "SUPPLIED - the owner's banyan's material (BANTHA1, 2026-10-18), as handed over - it names the picture its tree is cut from"],
  ['src/assets/jungle/source/jungle_tree_252w.png', "SUPPLIED - the owner's banyan picture for the Jungle of Bantha (BANTHA1, 2026-10-18), 252x164 RGBA cut by its alpha, the owner's own PNG bytes as handed over - the owner's art (the owner, 2026-10-18: \"These textures are ours\" - no ARENA2 pixel)"],
  ['src/assets/jungle/source/jungle_tree2.obj', "SUPPLIED - the owner's kapok for the Jungle of Bantha (BANTHA1, 2026-10-18), the owner's Blender 5.2 OBJ export as handed over - geometry only, read at run time by world/jungle/jungleModels.js"],
  ['src/assets/jungle/source/jungle_tree2.mtl', "SUPPLIED - the owner's kapok's material (BANTHA1, 2026-10-18), as handed over - it names the picture its tree is cut from"],
  ['src/assets/jungle/source/jungle_tree2_252w.png', "SUPPLIED - the owner's kapok picture for the Jungle of Bantha (BANTHA1, 2026-10-18), 252x164 RGBA cut by its alpha, the owner's own PNG bytes as handed over - the owner's art (the owner, 2026-10-18: \"These textures are ours\" - no ARENA2 pixel)"],
  ['src/assets/jungle/source/jungle_tree3.obj', "SUPPLIED - the owner's fig for the Jungle of Bantha (BANTHA1, 2026-10-18), the owner's Blender 5.2 OBJ export as handed over - geometry only, read at run time by world/jungle/jungleModels.js"],
  ['src/assets/jungle/source/jungle_tree3.mtl', "SUPPLIED - the owner's fig's material (BANTHA1, 2026-10-18), as handed over - it names the picture its tree is cut from"],
  ['src/assets/jungle/source/jungle_tree3_252w.png', "SUPPLIED - the owner's fig picture for the Jungle of Bantha (BANTHA1, 2026-10-18), 252x164 RGBA cut by its alpha, the owner's own PNG bytes as handed over - the owner's art (the owner, 2026-10-18: \"These textures are ours\" - no ARENA2 pixel)"],
  ['src/assets/jungle/source/jungle_tree4.obj', "SUPPLIED - the owner's flame tree for the Jungle of Bantha (BANTHA1, 2026-10-18), the owner's Blender 5.2 OBJ export as handed over - geometry only, read at run time by world/jungle/jungleModels.js"],
  ['src/assets/jungle/source/jungle_tree4.mtl', "SUPPLIED - the owner's flame tree's material (BANTHA1, 2026-10-18), as handed over - it names the picture its tree is cut from"],
  ['src/assets/jungle/source/jungle_tree4_252w.png', "SUPPLIED - the owner's flame tree picture for the Jungle of Bantha (BANTHA1, 2026-10-18), 252x164 RGBA cut by its alpha, the owner's own PNG bytes as handed over - the owner's art (the owner, 2026-10-18: \"These textures are ours\" - no ARENA2 pixel)"],
  ['src/assets/jungle/source/jungle_tree5.obj', "SUPPLIED - the owner's mahogany for the Jungle of Bantha (BANTHA1, 2026-10-18), the owner's Blender 5.2 OBJ export as handed over - geometry only, read at run time by world/jungle/jungleModels.js"],
  ['src/assets/jungle/source/jungle_tree5.mtl', "SUPPLIED - the owner's mahogany's material (BANTHA1, 2026-10-18), as handed over - it names the picture its tree is cut from"],
  ['src/assets/jungle/source/jungle_tree5_252w.png', "SUPPLIED - the owner's mahogany picture for the Jungle of Bantha (BANTHA1, 2026-10-18), 252x164 RGBA cut by its alpha, the owner's own PNG bytes as handed over - the owner's art (the owner, 2026-10-18: \"These textures are ours\" - no ARENA2 pixel)"],
  // JUNGLE-ROADSIDE (2026-10-23, the owner, through Mac: "These trees are meant for the jungle biome and roadside. Making
  // it more like a jungle with the vines stringing across the roads"): THE ROADSIDE PAIRS, three Blender 5.2 OBJs and
  // their MTLs committed as handed over, byte for byte (their own names - Blender's file was pine.blend). Each is two of
  // the trees above and lianas between them, and wears only the pictures above - no picture of their own. They ship as
  // they are: systems/jungleTreesAssets.js fetches them and world/jungle/jungleRoadside.js reads them at run time (no
  // bake); test/world/jungleroadside.test.js reads the same bytes.
  ['src/assets/jungle/source/pine.obj', "SUPPLIED - the owner's roadside pair for the Jungle of Bantha (JUNGLE-ROADSIDE, 2026-10-23): the mahogany and a kapok leant over the road, lianas strung between them - the owner's Blender 5.2 OBJ export as handed over, geometry only, read at run time by world/jungle/jungleRoadside.js"],
  ['src/assets/jungle/source/pine.mtl', "SUPPLIED - the leaning pair's materials (JUNGLE-ROADSIDE, 2026-10-23), as handed over - they name the kapok's, the fig's and the mahogany's pictures above"],
  ['src/assets/jungle/source/pine-1.obj', "SUPPLIED - the owner's roadside pair for the Jungle of Bantha (JUNGLE-ROADSIDE, 2026-10-23): the mahogany and a fig, lianas strung between them - the owner's Blender 5.2 OBJ export as handed over, geometry only, read at run time by world/jungle/jungleRoadside.js"],
  ['src/assets/jungle/source/pine-1.mtl', "SUPPLIED - the fig pair's materials (JUNGLE-ROADSIDE, 2026-10-23), as handed over - they name the fig's and the mahogany's pictures above"],
  ['src/assets/jungle/source/pine2.obj', "SUPPLIED - the owner's roadside pair for the Jungle of Bantha (JUNGLE-ROADSIDE, 2026-10-23): the mahogany and a kapok sunk 2 m into its ground, lianas strung between them - the owner's Blender 5.2 OBJ export as handed over, geometry only, read at run time by world/jungle/jungleRoadside.js"],
  ['src/assets/jungle/source/pine2.mtl', "SUPPLIED - the sunk pair's materials (JUNGLE-ROADSIDE, 2026-10-23), as handed over - they name the kapok's, the fig's and the mahogany's pictures above"],
  // COATS3D (2026-10-11, the owner: "The first image is for the horse itself and the second is for the tail"): THE
  // COURSER, a rigged horse supplied as five saves of one Blender rig and two pictures painted for its own UV layout -
  // the newest whole save committed, as the ships' and the wagons' scenes are. tools/bakeHorse.mjs re-makes
  // courser.json from it, and test/formats/morrowind/coats3d_horse3d.test.js holds it to the bytes. The pictures ship as supplied: the
  // runtime dyes them per look (world/horseRig.js) and writes nothing back.
  ['src/assets/horse/source/courser.fbx', "SUPPLIED - the owner's Blender export of the Courser horse rig (idle.fbx, 2026-10-11; idle-1.fbx the same bytes, walk/trot/gallop.fbx subsets of it), committed so courser.json is a DERIVATION the gate can re-run"],
  ['src/assets/horse/courser.json', "SUPPLIED - courser.fbx baked to the armature's frame by tools/bakeHorse.mjs; geometry, skin and gaits only, no ARENA2 data"],
  ['src/assets/horse/body.png', "SUPPLIED - the owner's body picture for the Courser (COATS3D, 2026-10-11), 256x256 indexed, as sent - a hide painted for the 3D model's own UV islands, no ARENA2 pixel in it (Daggerfall's horse is a sprite; this painting has no sprite's silhouette)"],
  ['src/assets/horse/hair.png', "SUPPLIED - the owner's mane and tail picture for the Courser's nine alpha cards (COATS3D, 2026-10-11), 512x512 RGBA, as sent - no ARENA2 pixel in it"],
]);

test('doctrine: nothing ships out of public/ or src/assets/ that is not provably ours', () => {
  // FIELD-GUN-MW2: `src/assets/` IS THE OTHER HALF, and it was only
  // ever checked one way. AUDIT 27 below added the reverse read
  // precisely because "the list was only ever read one way" makes it
  // mean less than it claims - and its own comment says the intro
  // "ships from src/assets through Vite. Read each row's own directory
  // so bundled art has the same ownership check as public/". The
  // reverse read did; this one did not, so a NEW file bundled out of
  // src/assets needed no row at all and nobody would have noticed.
  const unexplained = [...tracked('public'), ...tracked('src/assets')].filter((f) => !PUBLIC_ALLOWLIST.has(f) && !bundleArt(f) && !studioArt(f));   // DW2: a vendored bundle's art under public/ answers to its manifest (BUNDLE_ART below); STUDIO1: an artist's to the roster (studioArt)
  assert.deepEqual(unexplained, [],
    'these files are tracked under public/ or src/assets/, which Vite copies into dist/ and\n'
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
  // The intro also ships from src/assets through Vite. Read each row's
  // own directory so bundled art has the same ownership check as public/.
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
  const unexplained = rasters.filter((f) => !allowed.has(f) && !bundleArt(f) && !studioArt(f));
  assert.deepEqual(unexplained, [],
    `tracked raster images outside the doctrine allow-list:\n${unexplained.join('\n')}`);
});

// ── EOTB0: A BUNDLE'S OWN ART ANSWERS TO THE BUNDLE'S OWN MANIFEST ──
//
// Eye Of The Beholder ships 3035 sprites. Three thousand rows typed
// into the list above would be a rule enforced by memory - the exact
// thing this file exists to stop - and the list's value is that a
// human wrote a REASON beside each picture, which does not survive
// being written three thousand times.
//
// So a vendored mod's art carries ONE row, on its directory, and the
// membership question is DERIVED: a file under that directory is the
// mod's iff the mod's own shipped manifest names it. The manifest is
// vendored verbatim for exactly this reason - it is the authority on
// what the bundle contained, and it is not something the port can
// quietly widen.
//
// Checked BOTH WAYS (AUDIT 27 F302's lesson: a row is a CLAIM, and a
// claim about a file that is not there is not one) - see the pins
// below.
/** VE4: the mark a row carries when its pixels ARE a render of game data - Port-Doctrine's one exception. */
const VE4_DERIVED = "Port-Doctrine's one exception (Mac, 2026-10-05): Daggerfall's own textures, repainted by the mod's author, carried on Mac's approval";
/** ALIKR1 / SNOWFALL1: the second exception's mark - the desert's and the winter's ground, its own approval. */
const ENVIRONS_DERIVED = "Port-Doctrine's second exception (Mac, 2026-10-08): Daggerfall's own desert and winter ground tiles, repainted by the packs' authors, carried on Mac's approval";
/** LAYERED-GEAR: the third exception's mark - the game's own worn armor, drawn from Daggerfall's sprites, its own approval. */
const LAYERED_DERIVED = "Port-Doctrine's third exception (the owner, 2026-10-19): the Layered Gearing look's armor, drawn for the game from Daggerfall's own class and enemy sprites, carried on the owner's approval";
/** DEX0: the fourth exception's mark (the third on its branch, renumbered past LAYERED-GEAR's at the merge) - Daggerfall's own enemy and class sprites under the authors' paint, its own approval. */
const DEX_DERIVED = "Port-Doctrine's fourth exception (Mac, 2026-10-19): Daggerfall's own enemy and enemy-class sprites, repainted by the mods' authors, carried on Mac's approval";
const BUNDLE_ART = new Map([
  // FORAGE1 (2026-09-28): Foraging's seven pictures - the author's own
  // pixel art (tools, a wood bundle, an egg), no Daggerfall record - taken
  // out of the bundle's Texture2D objects. A directory row: membership is
  // derived from the shipped manifest's Files, so it cannot widen.
  ['vendor/foraging/Textures/',
    { manifest: 'vendor/foraging/foraging.dfmod.json',
      why: "THIRD-PARTY - Foraging 1.7 (Harbinger451), carried on Mac's word of the author's permission; the mod's own pixel art - the Wood-Axe, Pick-Axe, Sickle, Fishing-Net, Wood Bundle, Egg and Spade - written as PNG from the bundle's Texture2D objects (see vendor/foraging/README.md)" }],
  ['vendor/eye-of-the-beholder/Textures/',
    { manifest: 'vendor/eye-of-the-beholder/eyeofthebeholder.dfmod.json',
      why: "THIRD-PARTY - Eye Of The Beholder 2.1 (RedRoryOTheGlen); the mod's own player sprites, re-encoded as indexed PNG (lossless for every drawn pixel - see the vendor README)" }],
  // AUDIT-TO1 F3: TO1 vendored three pictures and never came here, and
  // the gate did not say so on the day - `tracked()` reads git's index,
  // the slice ran its suite BEFORE `git add`, and three untracked files
  // are invisible to a rule written about tracked ones. It reddened on
  // the very next run. The art itself is fine and always was: these are
  // the mod's own UI chrome - a control strip and two filter buttons -
  // NOT a render of ARENA2, which is the thing Port-Doctrine forbids.
  // The row is a directory row for the same reason Eye Of The
  // Beholder's is: membership is DERIVED from the bundle's own
  // manifest, so the port cannot quietly widen it.
  ['vendor/travel-options/Textures/',
    { manifest: 'vendor/travel-options/travel-options.dfmod.json',
      why: "THIRD-PARTY - Travel Options 1.11 (Hazelnut, MIT); the mod's own UI chrome - the 320x27 control strip and the two ports-filter buttons - re-encoded from the bundle's Texture2D objects by tools/travelOptionsAssets.mjs (see the vendor README: these are the PIXELS, not the author's file bytes)" }],
  // SW1b (2026-09-19, the deep audit): the 600 shield sprites landed and
  // this row did not, so the wider raster rule reddened on 600 files the
  // moment they were tracked. The art itself is fine and is WHY they are
  // vendored at all rather than read from the player's own .dfmod the way
  // Weapon Widget's are: classic Daggerfall draws NO first-person shield,
  // so there is no ARENA2 original for these to be a render of - they are
  // the modder's own pixel art, not repainted game data, and
  // Port-Doctrine's rule is about renders of game data.
  ['vendor/shield-widget/Textures/',
    { manifest: 'vendor/shield-widget/shield-widget.dfmod.json',
      why: "THIRD-PARTY - Shield Widget 1.6 (RedRoryOTheGlen, animation art by WilhelmBlack); the mod's own first-person shield sprites - four shield shapes x twelve materials x three condition tiers x five animation frames - re-encoded from the bundle's Texture2D objects as indexed PNG (lossless for every drawn pixel; see the vendor README)" }],
  // DW2 (2026-09-23, Mac: "this needs to be in the codebase, not an
  // attachable file"): the 12,624 Diverse Weapons sprites. Under public/
  // rather than vendor/ because that many files through the bundler's
  // `new URL` glob is a 12,624-entry map in a chunk - public/ is served
  // as it is - so the public sweep below accepts a derived row too. The
  // same authority: the mod's own manifest names what may be here.
  // RRI1: Roleplay & Realism: Items' 280 sprites, the same way and for the
  // same reasons - the mod's own inventory and paper-doll art for items
  // classic Daggerfall does not have (there is no ARENA2 original of a
  // hauberk or an archer's axe).
  ['public/art/roleplay-realism-items/',
    { manifest: 'vendor/roleplay-realism-items/roleplay-realism-items.dfmod.json',
      why: "THIRD-PARTY - Roleplay & Realism: Items 1.3 (Hazelnut & Ralzar); the mod's own inventory and paper-doll sprites for its fourteen custom items in every metal, and the helmet's masks - re-encoded from the bundle's Texture2D objects by tools/rriExtract.mjs as indexed PNG where the picture fits one (lossless for every drawn pixel; see the vendor README)" }],
  ['public/art/roleplay-realism/',
    { manifest: 'vendor/roleplay-realism/roleplay-realism.dfmod.json',
      why: "THIRD-PARTY - Roleplay & Realism 1.8 (Hazelnut); the mod's own seven variant shop and tavern keeper sprites (197_0-0 .. 197_6-0, the XML scale beside each under vendor/) and its seventeen BUTTONS.RCI records 21-37 (the training window's '5 Days' and the rest of its index) - the PNGs the mod ships in its Textures/ folder, byte for byte (see the vendor README)" }],
  // OVH2 (2026-09-24, Mac: "Our first overhaul option will be the file attached"): GrimoireUI's 139 pictures - the
  // mod's own hand-drawn UI (parchment, wood and new lettering over Daggerfall's screen layouts), vendored byte for
  // byte the way Roleplay & Realism's BUTTONS.RCI repaints are. A LOOSE-FILE pack ships no .dfmod, so its authority is
  // the archive's own listing, generated from the zip (sha256 recorded beside it) - the same both-ways derivation.
  ['public/art/grimoire-ui/',
    { manifest: 'vendor/grimoire-ui/grimoire-ui.files.json',
      why: "THIRD-PARTY - GrimoireUI 1.2 (LordSquacquerone, Nexus Daggerfall Unity mod 1222); the pack's own StreamingAssets pictures - 93 redrawn IMG screens, BUTTONS.RCI 0-37 and the save window's eight panel and button textures - byte for byte from the archive Mac supplied (see vendor/grimoire-ui/README.md)" }],
  // HUD-ICON1 (2026-09-24): Daggerfall Unity's OWN interaction-mode icons - DFU-authored art out of Unity's
  // Resources folder (Assets/Resources/Icons), MIT like the C# the port translates, never ARENA2 data. The listing
  // is generated from the pinned commit, not written by hand.
  ['public/art/dfu-icons/',
    { manifest: 'vendor/dfu-icons/dfu-icons.files.json',
      why: "THIRD-PARTY - Daggerfall Unity (Daggerfall Workshop, MIT); HUDInteractionModeIcon's four icon sets (icon, classic, colour, mono - steal, grab, info, talk), byte for byte from Assets/Resources/Icons at the commit the listing pins (see vendor/dfu-icons/README.md)" }],
  // CLASSIC-CURSOR (FIELD BUGS 2026-10-03): Daggerfall Unity's OWN default cursor - DFU-authored art out of Unity's
  // Resources folder, MIT, never ARENA2 data (DFU reads no cursor from the game's files). Generated from the pinned commit.
  ['public/art/dfu-cursor/',
    { manifest: 'vendor/dfu-cursor/dfu-cursor.files.json',
      why: "THIRD-PARTY - Daggerfall Unity (Daggerfall Workshop, MIT); the defaultCursor ProjectSettings names, Assets/Resources/Cursor2.png, byte for byte at the commit the listing pins (see vendor/dfu-cursor/README.md)" }],
  // SKIN2 (2026-09-25, Mac: "Implement these as new skin options"): Mac's ExistingClasses archive, twenty redrawn
  // enemy-class sheets worn as on-foot skins. A LOOSE-FILE pack (no .dfmod), so GrimoireUI's way: the listing
  // generated from the archive is the authority - and these names were changed on the way in (three port archive
  // numbers, a gap renumbered, a stray underscore), so the listing maps each file to its archive path and
  // tools/classSkinsListing.mjs proves the bytes. The first cut of this slice ran the suite BEFORE `git add` and
  // shipped without this row - AUDIT-TO1 F3's trap again; the art is not ARENA2's (redrawn at twice the size, under
  // archive numbers past TEXTURE.511 that the mods' art uses).
  // DEX0 (2026-10-19, Mac: "Bring under 3rd exception"): the row above said these were redrawn at twice the size and not
  // ARENA2's. Measured silhouette for silhouette against every TEXTURE record (the way tools/dexExtract.mjs measures the
  // enemy mod's), most of them are Daggerfall's own enemy-class sprites (TEXTURE.477-490) at their own size, under the
  // artists' paint - the bounty hunter (1504) is the very sheet Daggerfall Enemy Expansion ships. So the row says what
  // the pack is, and Port-Doctrine's fourth exception names its directory.
  ['vendor/class-skins/Textures/',
    { manifest: 'vendor/class-skins/class-skins.files.json', derived: DEX_DERIVED,
      why: "THIRD-PARTY - Daggerfall class skins (Mac's ExistingClasses archive; the artists unnamed but the bounty hunter's, Kamer), carried on Mac's word of the artists' permission; twenty enemy-class sprite sheets, most of them Daggerfall's own class sprites under the artists' paint, byte for byte from the archive under the names class-skins.files.json maps (see vendor/class-skins/README.md for the open permission record)" }],
  ['public/art/diverse-weapons/',
    { manifest: 'vendor/diverse-weapons/diverse-weapons.dfmod.json',
      why: "THIRD-PARTY - Diverse Weapons 1.7.3 (RealAKP); the mod's own first-person weapon sprites - eighteen weapons x ten metals, plain and enchanted, every record and frame, Weapon Widget's double-scale idles and the icons - re-encoded from the bundle's Texture2D objects by tools/diverseWeaponsExtract.mjs as indexed PNG where the picture fits one (lossless for every drawn pixel; see the vendor README)" }],
  // CSA-A (2026-09-27): Come Sail Away's pictures - AUDIT-TO1 F3's trap a third time: the slice ran its suite BEFORE
  // `git add`, pushed, and the next gate reddened on 27 files. The bundle's own manifest cannot be the authority here,
  // because the port carries LESS than it names and under other names for part: record 3 is Daggerfall's travel map
  // (never carried), the 32 wave frames are Daggerfall's snow under the author's paint and ride as two paints with
  // the snow taken out. So the authority is the extractor's own listing - generated beside the pictures from the
  // bundle, which it hashes - the same both-ways derivation the loose-file packs use.
  ['vendor/come-sail-away/Textures/',
    { manifest: 'vendor/come-sail-away/come-sail-away.files.json',
      why: "THIRD-PARTY - Come Sail Away 2.1 (RedRoryOTheGlen); the mod's own splash and wind-widget frames and the waves' two paints (the author's pixels, the Daggerfall snow under the crests taken out and rebuilt from the player's own TEXTURE.303), re-encoded as indexed PNG by tools/comeSailAwayExtract.mjs after measuring each against every TEXTURE record (see the vendor README)" }],
  // DW-E3: Iliac Puddle No More's seven fish - the author's own pictures (no classic record covers any: the
  // extractor measures each against every TEXTURE file, DS1's search, and refuses one a record covers).
  ['vendor/iliac-puddle-no-more/Flats/',
    { manifest: 'vendor/iliac-puddle-no-more/iliac-puddle-no-more.dfmod.json',
      why: "THIRD-PARTY - Iliac Puddle No More 1.2.2 (jet082); the mod's own seven fish, decoded from the bundle's Texture2D objects (DXT5, the first mip - the pixels the game samples) by tools/iliacPuddleAssets.mjs (see the vendor README)" }],
  // VE4 (2026-10-05, Mac: "Approved and yes", then "Put it in the codebase"): VANILLA ENHANCED - THE ONE DERIVED PACK.
  // Every row above carries a modder's OWN art, and several say so against this very rule. These carry Daggerfall's
  // textures repainted, which A RENDER OF GAME DATA IS GAME DATA forbids - and which Mac approved: Port-Doctrine records
  // the exception and names its directory. So each row says it is derived, and the pins below hold the mark to the
  // directories that paragraph names. Each directory answers to its own generated listing (tools/vanillaEnhancedVendor.mjs
  // writes it from the mod's repository at the pinned commit, every file's source path and sha256 beside it), so the
  // both-ways derivation above holds for it as for every other bundle.
  ['public/art/vanilla-enhanced/base/',
    { manifest: 'vendor/vanilla-enhanced/base.files.json', derived: VE4_DERIVED,
      why: "THIRD-PARTY - Vanilla Enhanced - Base 3.4.7 (carademono), carried on Mac's word of the author's permission; Daggerfall's own textures remastered - the terrain's tile sets, the nature flats, the city walls and the dungeons - the 1,246 PNGs its manifest names, byte for byte from github.com/drcarademono/vanilla-enhanced at the commit the listing pins (see vendor/vanilla-enhanced/README.md for the open permission record)" }],
  ['public/art/vanilla-enhanced/masked-roads/',
    { manifest: 'vendor/vanilla-enhanced/masked-roads.files.json', derived: VE4_DERIVED,
      why: "THIRD-PARTY - Vanilla Enhanced - Masked Roads 3.4.7 (carademono & Kokey), carried on Mac's word of the author's permission; the road tiles - its own nine PNGs, and the 21 slices of its texture arrays no PNG it or the Base ships draws, each the repository's source picture for the slice, proved within BC7's error of it (see vendor/vanilla-enhanced/README.md)" }],
  ['public/art/vanilla-enhanced/snowless-swamps-and-jungles/',
    { manifest: 'vendor/vanilla-enhanced/snowless-swamps-and-jungles.files.json', derived: VE4_DERIVED,
      why: "THIRD-PARTY - Vanilla Enhanced - Snowless Swamps and Jungles 3.4.7 (carademono), carried on Mac's word of the author's permission; the swamps' and jungles' ground and buildings without snow - the 160 PNGs its manifest names, byte for byte (see vendor/vanilla-enhanced/README.md)" }],
  // ALIKR1 / SNOWFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These
  // should be on by default and integrate into our enhanced environments seamlessly"): THE SECOND EXCEPTION - two more
  // packs of Daggerfall's ground repainted, each directory answering to the listing tools/environmentModsExtract.mjs
  // writes from the archive (every file and its sha256), each row carrying the second exception's own mark.
  ['public/art/sands-of-the-alikr/',
    { manifest: 'vendor/sands-of-the-alikr/sands-of-the-alikr.files.json', derived: ENVIRONS_DERIVED,
      why: "THIRD-PARTY - Sands of the Alik'r 2 (Nexus mod 1390; its archive names no author), carried on Mac's word of the author's permission; Daggerfall's desert ground under the author's sand - the pack's 47 loose TEXTURE.002 records, byte for byte (see vendor/sands-of-the-alikr/README.md for the open permission record)" }],
  ['public/art/snowfall/',
    { manifest: 'vendor/snowfall/snowfall.files.json', derived: ENVIRONS_DERIVED,
      why: "THIRD-PARTY - Snowfall 1.0.5 (demifiend000), carried on Mac's word of the author's permission; the 168 winter ground records its bundle packages (TEXTURE.103, .303, .403 - Daggerfall's winter tiles under the author's snow), its snow albedo and its three surface masks, decoded losslessly from the bundle's Texture2D and TextAsset objects (see vendor/snowfall/README.md)" }],
  // LAYERED-GEAR (2026-10-19, the owner: "Approve as an exception"): THE THIRD EXCEPTION - the worn-armor strips, the
  // cloak layer and the hood fixes, DFO's own work but drawn from Daggerfall's sprites, so derived. No bundle ships a
  // manifest for them: the folder answers to the listing tools/layered-armor/listing.mjs writes (every picture, its sha256).
  ['vendor/layered-armor/',
    { manifest: 'vendor/layered-armor/layered-armor.files.json', derived: LAYERED_DERIVED,
      why: "OURS - Layered Gearing (DFO, made for the game), carried under the owner's third exception; the worn-armor strips of both bodies, the cloak layer and the hood fixes, drawn from Daggerfall's class sprites 1540/1541 and the enemy frames of TEXTURE.475-490 - the 7,369 PNGs its listing names (see vendor/layered-armor/README.md)" }],
  // DEX0 (2026-10-19, Mac: "I want to implement this as our next mod 1:1"): DAGGERFALL ENEMY EXPANSION's pictures, in two
  // directories by what they are, each answering to the listing tools/dexExtract.mjs writes (every name and its sha256)
  // after measuring every picture against every TEXTURE record: the authors' own renders, and the repaints the fourth
  // exception carries. The 858 that ARE Daggerfall's records are in neither - the player's own files rebuild them.
  ['public/art/daggerfall-enemy-expansion/',
    { manifest: 'vendor/daggerfall-enemy-expansion/daggerfall-enemy-expansion.files.json',
      why: "THIRD-PARTY - Daggerfall Enemy Expansion 1.3.4 (Kamer & Kab), carried on Mac's word of the authors' permission; the authors' own enemy sprites and emission maps (Kamer's renders and his own drawings, Kab's classes, the 1995 demo's four), re-encoded from the bundle's Texture2D objects by tools/dexExtract.mjs as indexed PNG where the picture fits one, none of them a picture any TEXTURE record covers, and none of their archives one that follows Daggerfall's sprites' outlines but the demo's Bat (the extractor's silhouette guard; see vendor/daggerfall-enemy-expansion/README.md)" }],
  ['public/art/daggerfall-enemy-expansion-repainted/',
    { manifest: 'vendor/daggerfall-enemy-expansion/repainted.files.json', derived: DEX_DERIVED,
      why: "THIRD-PARTY - Daggerfall Enemy Expansion 1.3.4 (Kamer & Kab), carried on Mac's word of the authors' permission; Daggerfall's own sprites under the authors' paint - the Bounty Hunter, the Royal Knight, the Druid, the Necromancer Acolyte, the Rogue Druid, the four riders' new sets and King Lysandus - byte for byte from the bundle (see vendor/daggerfall-enemy-expansion/README.md)" }],
  // WINDFALL1: the mod's own three pictures - leaves and a snowflake, the author's pixels (no Daggerfall record).
  ['vendor/windfall/Textures/',
    { manifest: 'vendor/windfall/windfall.files.json',
      why: "THIRD-PARTY - Windfall 1.0.0 (demifiend000), carried on Mac's word of the author's permission; the mod's own leaf sheets and snowflake, RGBA32 with one mip in the bundle - each PNG is the texture exactly (see vendor/windfall/README.md)" }],
]);
/** The basenames each bundle manifest names, lowercased. Memoised: the
 *  membership test runs once per tracked raster and the manifest is
 *  386 KB, so re-parsing it per file turned a 1-second file into an
 *  8-second one. */
const _bundleNames = new Map();
const bundleNames = (dir) => {
  if (!_bundleNames.has(dir)) {
    const files = JSON.parse(readFileSync(join(root, BUNDLE_ART.get(dir).manifest), 'utf8')).Files ?? [];
    _bundleNames.set(dir, new Set(files.map((f) => f.split('/').pop().toLowerCase())));
  }
  return _bundleNames.get(dir);
};
// ── STUDIO1: THE GAME'S OWN ARTISTS' PICTURES ANSWER TO THE STUDIO'S ROSTER ──
//
// public/art/studio/ (bible/07-Rendering/Studio-Art.md) is where the game's artists paint. It is no vendored bundle - no
// manifest names its pictures, and it grows as they paint, with nobody keeping a list (that is its point) - so its
// membership is the studio's own rule, the one the build serves by (scripts/studioArtIndex.mjs studioListing): a PNG
// under the folder of an artist the roster (artists.json) names, named for what it replaces, within the studio's limits.
// The roster's row is the doctrine decision - who may paint here, approved by whom - and an artist's committing a picture
// to their folder is their word that it is their own drawing, no pixel of ARENA2's (the roster and the guide say so).
// A picture the listing refuses - an artist not on the roster, a file that is no picture of the game's - is not ours by
// this rule and stays unexplained.
/** The studio's members under a tree: the pictures its listing serves, by their paths in the repository. */
const studioMembers = (at) => new Set(studioListing(at).files.map((f) => `${STUDIO_TREE}/${f}`));
const STUDIO_WORN = studioMembers(root);
/** Is this tracked file a picture the studio wears? */
const studioArt = (f) => STUDIO_WORN.has(f);
/** AUDIT STUDIO1 E5: the arm admits only what the studio wears - never a stranger's picture, the guide, a working file,
 *  a picture named for nothing, one outside an artist's folder, or art outside the studio (whatever the folder holds). */
test('doctrine STUDIO1: the studio arm admits only what the studio wears (AUDIT STUDIO1 E5)', () => {
  for (const f of ['public/art/studio/stranger/38181_2-0.png', 'public/art/studio/README.md', 'public/art/studio/trashBattery/wip.psd', 'public/art/studio/trashBattery/notes.png', 'public/art/studio/38181_1-0.png', 'public/art/held-map.png']) assert.equal(studioArt(f), false, f);
  for (const f of STUDIO_WORN) assert.match(f, /^public\/art\/studio\/[^/]+\/.+\.png$/i);
});

/** Is this tracked raster a vendored bundle's own art? */
function bundleArt(f) {
  for (const dir of BUNDLE_ART.keys()) {
    if (f.startsWith(dir)) return bundleNames(dir).has(f.split('/').pop().toLowerCase());
  }
  return false;
}

test('doctrine EOTB0: a vendored bundle\u2019s art is the art its own manifest names - derived, not listed', () => {
  for (const [dir, rec] of BUNDLE_ART) {
    const names = bundleNames(dir);
    const here = tracked('.').filter((f) => f.startsWith(dir));
    assert.ok(here.length > 0, `${dir} has a row and no files - a claim about art that is not there`);
    assert.match(rec.why, /^(THIRD-PARTY|OURS) - /, `${dir} must say whose art it is`);   // LAYERED-GEAR: the game's own, derived

    // Nothing under the directory that the bundle did not ship. This is
    // the arm that makes the directory row safe: it is not "anything
    // here is fine", it is "anything here came out of that bundle".
    const strangers = here.filter((f) => !names.has(f.split('/').pop().toLowerCase()));
    assert.deepEqual(strangers, [],
      `files under ${dir} that the bundle's own manifest does not name:\n${strangers.join('\n')}`);

    // ...AND THE OTHER WAY. A raster the manifest names and the tree
    // does not carry means the vendoring dropped art on the floor,
    // which a one-way check would never say.
    const carried = new Set(here.map((f) => f.split('/').pop().toLowerCase()));
    const dropped = [...names].filter((n) => /\.(png|jpg|jpeg|gif|bmp|webp|tga)$/i.test(n) && !carried.has(n));
    assert.deepEqual(dropped, [],
      `${dir}: the manifest names ${dropped.length} pictures the tree does not carry`);
  }
});

test('doctrine EOTB0: the derivation is not vacuous - a stranger and a loss both redden', () => {
  // A PIN MUST FAIL. Both arms are driven against the real manifest
  // with one name moved, because a membership test that cannot reject
  // is a rule that is not enforced.
  const dir = 'vendor/eye-of-the-beholder/Textures/';
  const names = bundleNames(dir);
  assert.ok(names.size > 3000, `the manifest resolved to ${names.size} names - the gate is reading nothing`);
  assert.equal(names.has('112364_0-0.png'), true, 'a sprite the bundle really ships');
  assert.equal(names.has('112364_0-0.png.png'), false, 'and a name it does not');
  // the stranger arm, in the shape it would really arrive: our own
  // artwork dropped into the mod's folder
  assert.equal(bundleArt(`${dir}112364/logo.png`), false, 'a file the manifest never named must not pass as the mod\u2019s');
  assert.equal(bundleArt(`${dir}112364/112364_0-0.png`), true, 'and one it did must pass');
});

// \u2500\u2500 VE4: A DERIVED ROW IS THE EXCEPTION PORT-DOCTRINE RECORDS, AND ONLY IT \u2500\u2500
//
// Every other row is a CLAIM that the art is the modder's own. Vanilla
// Enhanced's rows say the opposite - it IS Daggerfall's art, repainted -
// and stand on Mac's approval alone. An approval is bounded by what it
// approved: the doctrine's exception paragraph names the directory, and a
// derived row anywhere else, or a named directory with no row, reddens.
const DOCTRINE = 'bible/01-Overview/Port-Doctrine.md';
/** The directories Port-Doctrine's exception paragraphs name - every backticked `public/` or `vendor/` path on their lines. */
function exceptionDirs() {
  // ALIKR1/SNOWFALL1: every exception paragraph's line - THE ONE EXCEPTION (Vanilla Enhanced) and THE SECOND EXCEPTION;
  // LAYERED-GEAR: and THE THIRD, whose art sits under vendor/ (the build reaches it through a glob, as Eye of the Beholder's)
  // DEX0: and THE FOURTH, whose class skins live under vendor/ (the player body's sprite index reads them there)
  const lines = readFileSync(join(root, DOCTRINE), 'utf8').split('\n').filter((l) => /^\s+\*\*THE (?:ONE|SECOND|THIRD|FOURTH) EXCEPTION\b/.test(l));
  return lines.flatMap((line) => [...line.matchAll(/`((?:public|vendor)\/[^`]+\/)`/g)].map((m) => m[1]));
}
/** The mark each directory's approval gave it: Vanilla Enhanced's rows the first exception's, the environment packs' the
 *  second's, Layered Gearing's the third's, the enemies' and the class skins' the fourth's - a row in one exception
 *  wearing another's mark is a row approved by the wrong approval. */
const markFor = (dir) => (dir.startsWith('public/art/vanilla-enhanced/') ? VE4_DERIVED
  : dir.startsWith('vendor/layered-armor/') ? LAYERED_DERIVED
  : dir.startsWith('public/art/daggerfall-enemy-expansion-repainted/') || dir.startsWith('vendor/class-skins/') ? DEX_DERIVED : ENVIRONS_DERIVED);
/** The derived rows standing outside every directory the exception names. */
const derivedOutside = (rows, dirs) => [...rows].filter(([dir, r]) => r.derived && !dirs.some((d) => dir.startsWith(d))).map(([dir]) => dir);

test('doctrine VE4: a derived row stands inside the exception Port-Doctrine records, and every row inside it says it is derived', () => {
  const dirs = exceptionDirs();
  assert.deepEqual(dirs, ['public/art/vanilla-enhanced/', 'public/art/sands-of-the-alikr/', 'public/art/snowfall/', 'vendor/layered-armor/', 'public/art/daggerfall-enemy-expansion-repainted/', 'vendor/class-skins/Textures/'], 'the doctrine names six directories, under four approvals');
  assert.deepEqual(derivedOutside(BUNDLE_ART, dirs), [], 'repainted game data outside the approved directory');
  for (const d of dirs) assert.ok([...BUNDLE_ART].some(([dir, r]) => r.derived && dir.startsWith(d)), `${d} is approved and no row carries it`);
  // and inside it nothing passes as the port's own: every row there says what it is
  for (const [dir, r] of BUNDLE_ART) if (dirs.some((d) => dir.startsWith(d))) assert.equal(r.derived, markFor(dir), `${dir} sits in the exception and does not say so - in its own approval's words`);
  for (const f of PUBLIC_ALLOWLIST.keys()) assert.ok(!dirs.some((d) => f.startsWith(d)), `${f}: an allow-list row inside the exception`);
});

test('doctrine STUDIO1: a picture is the studio\'s own by its roster and its listing alone - a stranger\'s, a file that is no picture and a link are not (AUDIT STUDIO1 C12: the arm is not vacuous)', () => {
  const at = mkdtempSync(join(tmpdir(), 'doctrine-studio-'));
  try {
    const dir = join(at, STUDIO_TREE);
    for (const f of ['Redclaw', 'stranger']) mkdirSync(join(dir, f), { recursive: true });
    writeFileSync(join(dir, 'artists.json'), JSON.stringify({ artists: [{ folder: 'Redclaw', name: 'Redclaw', approved: 'the test' }] }));
    const png = writePng({ width: 1, height: 1, data: new Uint8Array(4).fill(200) });
    writeFileSync(join(dir, 'Redclaw', '38181_1-0.png'), png);
    writeFileSync(join(dir, 'stranger', '38181_2-0.png'), png);
    writeFileSync(join(dir, 'Redclaw', '38181_4-0.psd'), 'layers');
    symlinkSync(join(dir, 'Redclaw', '38181_1-0.png'), join(dir, 'Redclaw', '38181_3-0.png'));
    assert.deepEqual([...studioMembers(at)], [`${STUDIO_TREE}/Redclaw/38181_1-0.png`]);
  } finally { rmSync(at, { recursive: true, force: true }); }
});

test('doctrine VE4: the bound is not vacuous - a derived row outside the named directory reddens, and with no approval every one does', () => {
  const rogue = new Map([...BUNDLE_ART, ['public/art/someone-elses-repaint/', { manifest: 'x', derived: VE4_DERIVED, why: 'THIRD-PARTY - x' }]]);
  assert.deepEqual(derivedOutside(rogue, exceptionDirs()), ['public/art/someone-elses-repaint/']);
  assert.deepEqual(derivedOutside(rogue, []), [...rogue].filter(([, r]) => r.derived).map(([d]) => d));
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
//
// ROAD-G G7 (records sweep, 2026-09-04) WIDENED THE POPULATION TO THE CITE
// ITSELF. F7's eleven sites were caught because they happened to shout
// DEPARTURE; the gate then scanned only that token, so the OTHER half of F7's
// finding - "a `src/` site cites Ledger A and no row on that page names the
// file" - went on recurring in silence. Seventeen files were in exactly that
// state at HEAD: `characters/dungeonEnemies.js`, `world/dungeon/dungeonTextures.js`,
// `player/cameraRecoiler.js`, `player/moveScanner.js`, `scenes/menu.js`,
// `systems/repairService.js`, `systems/riding.js`, seven of
// `systems/quest/*` (clock, foe, message, parser, person, quest, questLists),
// `ui/enhanced/enhancedCharSheet.js`, `ui/merchant/merchantServiceWindow.js` and
// `ui/transportWindow.js`. Each was adjudicated one of three ways and none
// was waved through: the ROW EXISTED and the cite was silent about it (the
// engine-PRNG rule, which now carries its live roster; the dungeon-seed
// bullet; the main-menu EXIT row) - the row was OWED and was written (the
// `AdvancedClimbing` scaffolding, the merchant popup's accelerators, the
// port's scalar clock) - or the COMMENT WAS WRONG: `transportWindow.js`
// claimed "the port's own letters (Ledger A - DFU reads its keybind table)"
// when DaggerfallTransportWindow.cs:100-137 binds all five buttons out of
// `DialogShortcuts.txt`, which A8 ported whole, so the letters were wired to
// the table and the departure ceased to exist.
//
// The RESOLUTION here stays the loose one - the Ledger names the file
// SOMEWHERE - deliberately, and the AUDIT 58 gate below is the strict tier.
// A class rule (the engine-PRNG rule, the settings surface) covers a
// population rather than a path, so a per-file section-A row would be the
// wrong shape for it; what the widened gate demands instead is that the class
// row keep a ROSTER, which is the one line a new site has to touch.
// ---------------------------------------------------------------------------

test('doctrine: every DEPARTURE or Ledger A cite in src/ has a Ledger row naming its file', () => {
  const ledger = readFileSync(join(root, 'bible/01-Overview/Port-Ledger.md'), 'utf8');
  const unrecorded = [];
  let scanned = 0;
  for (const f of tracked('src')) {
    if (!f.endsWith('.js')) continue;
    const text = readFileSync(join(root, f), 'utf8');
    // Both spellings: the shouted convention, and the prose one that let
    // messageBox.js's row go unenforced when this pin first landed.
    // ROAD-E fix-D: and the PLURAL. `\bDEPARTURE\b` is false on
    // "RECORDED DEPARTURES", so nine files that shout the plural - the
    // spell maker among them, which cited a Ledger A row that did not
    // exist - were never scanned at all. The trailing S is now optional.
    // ROAD-G G7: `Ledger A` joins the two DEPARTURE spellings. A file that
    // names section A is claiming an approval just as loudly as one that
    // shouts the word, and that half of F7's finding was never gated.
    if (!/\bDEPARTURES?\b/.test(text) && !/deliberate departure/i.test(text)
      && !/Ledger A/.test(text)) continue;
    // The LEDGER must name the file. Citing the Ledger from the source side is
    // NOT enough and deliberately does not count here: F7's eleven sites all
    // cited "the Ledger A engine-PRNG rule" and no such row existed. A claim
    // of approval is not an approval.
    scanned++;
    const base = f.split('/').pop();
    if (ledger.includes(f) || ledger.includes(base)) continue;
    unrecorded.push(f);
  }
  // ...and the population itself, so a rewording cannot quietly empty the
  // gate the way `\bDEPARTURE\b` emptied it against the plural.
  assert.ok(scanned >= 100,
    `only ${scanned} files match the DEPARTURE / Ledger A claim - the shapes moved and this gate went quiet`);
  assert.deepEqual(unrecorded, [],
    'these files declare a DEPARTURE, or cite Ledger A, and no Ledger row names\n'
    + 'them. The Ledger says\n'
    + '"if a departure or gap is not on this page, it does not exist", which is only\n'
    + 'usable as a gate while it is true - a later audit greps the Ledger to decide\n'
    + '"approved or bug?" and gets the wrong answer:\n'
    + unrecorded.join('\n'));
});

// ═══ AUDIT 58 (seams): a RECORDED departure resolves against a
// section-A row that NAMES THE FILE ════════════════════════════════
//
// The gate above asks only whether Port-Ledger.md mentions the file
// ANYWHERE. That is the whole 922-line page, struck rows included, and
// it is how nine files went on declaring an approval nobody had
// written: `musicReplacement.js` was satisfied by a live section-C mod
// row, `weatherSim.js` by the STRUCK "~~THE WEATHER ODDS TABLE~~"
// row, `colorPicker.js` and `nativeTalk.js` by struck CLOSED rows,
// `input.js` by the struck C2 hotkey row that retires a blocker and
// approves nothing. test/scenes/citedrift.test.js named this vacuity in its
// own header when CD1 closed it for the TB1 family and the pause
// window; the other eight were left standing.
//
// The two tiers are deliberate. THE PLAIN TOKEN keeps the loose test,
// because dozens of files say "DEPARTURE" while citing a RULE row that
// covers a class rather than a path - the engine-PRNG rule, the
// settings-surface row - and narrowing that population would redden
// working citations. THE CLAIM - a file that shouts its departure is
// already RECORDED - is what must resolve, and it resolves the way an
// approval has to: an UNSTRUCK row inside section A that names the
// file. A claim of approval is not an approval; a struck row is not
// one either.
const A_BOUNDS = ['## A. Approved departures from DFU', '## A-note (H1)'];
/** The claim shapes: "RECORDED DEPARTURE(S)", "DEPARTURE (recorded",
 *  "DEPARTURE (Ledger A shape)", "DEPARTURES, both recorded". */
const RECORDED_CLAIM =
  /\bRECORDED DEPARTURES?\b|\bDEPARTURES?\b[^.\n]{0,40}\((?:recorded|Ledger A shape)|\bDEPARTURES?, both recorded\b/;

test('AUDIT 58: a file claiming a RECORDED departure has an unstruck section-A row naming it', () => {
  const doc = readFileSync(join(root, 'bible/01-Overview/Port-Ledger.md'), 'utf8').split('\n');
  const lo = doc.findIndex((l) => l.startsWith(A_BOUNDS[0]));
  const hi = doc.findIndex((l) => l.startsWith(A_BOUNDS[1]));
  assert.ok(lo >= 0 && hi > lo, 'Port-Ledger has no section A');
  // section A's table rows, minus the header and the struck ones -
  // citedrift's own `awk '/^\|/ && !/^\|---/'` and `struck` helpers.
  const approved = doc.slice(lo, hi)
    .filter((l) => /^\|/.test(l) && !/^\|---/.test(l) && !/^\| What \|/.test(l))
    .filter((l) => !/^\|\s*(\*\*)?~~/.test(l))
    .join('\n');
  assert.ok(approved.length > 1000, 'section A resolved to nothing - the bounds moved');

  const claimed = [];
  const unrowed = [];
  for (const f of tracked('src')) {
    if (!f.endsWith('.js')) continue;
    // comments WRAP, so the claim is read off the unwrapped prose
    const flat = readFileSync(join(root, f), 'utf8')
      .replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
    if (!RECORDED_CLAIM.test(flat)) continue;
    claimed.push(f);
    const base = f.split('/').pop();
    if (!approved.includes(f) && !approved.includes(base)) unrowed.push(f);
  }
  // FD1 (2026-09-11): 18 -> 17, a deliberate edit - colorPicker.js and its
  // keyed settings window were DELETED with the launcher, and the row is struck.
  assert.ok(claimed.length >= 17,
    `only ${claimed.length} files match the RECORDED-departure claim - the shapes moved and this gate went quiet`);
  assert.deepEqual(unrowed, [],
    'these files say their departure is already RECORDED and no unstruck section-A row\n'
    + 'names them. "If a departure or gap is not on this page, it does not exist" is only\n'
    + 'usable while it is true, and a STRUCK section-C row is not an approval:\n'
    + unrowed.join('\n'));
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
    // PERF-URL (2026-09-29): a door reads the page through systems/pageQuery.js's one parse - `pageParam('k'` is a reader.
    // AUDIT PERF-URL A8: and `pageHas('k'` is NOT - every knob here hands a VALUE (`&k=${v}`), and a presence test
    // would turn the door on for any value, `?water=on` included; the first cut accepted it
    assert.ok(src.includes(`get('${k}')`) || src.includes(`get("${k}")`) || src.includes(`pageParam('${k}'`),
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
