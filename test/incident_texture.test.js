// THE 2026-09-01 TEXTURE INCIDENT, pinned. Two independent defects
// rode Wave A onto the live site and broke it visually while 5,600
// tests stayed green - both in surfaces with no oracle:
//
//   1. PRIS00I0.IMG (A3's prison screen) is one of the SIX palettized
//      IMGs, and its preload handed the loader the HOST's shared
//      ART_PAL - ImgFile._readPalette writes INTO the palette it is
//      given, so one boot-time preload repainted every texture decoded
//      after it. Weapons gold, caves and exteriors off, all session.
//   2. The terrain ground tileset was selected by the ground-plane
//      member (DaggerfallGroundPlane.cs:83) instead of the terrain's
//      (TerrainMaterialProvider.cs:120-134) - invisible while the port
//      hardcoded Summer, and wrong in three climates the moment A1
//      made the classic winter boot real: snow under every desert.
//
// ROAD close-P REBUILT THE PALETTE HALF. It was a source-text pin and
// a "sweep" of three hand-typed filenames, both vacuous: the
// behavioural test asserted a variable nothing ever wrote, and the
// sweep asked only whether the string `new DFPalette()` appeared
// anywhere in three named files - so re-injecting the incident at its
// own site left it green, and the fourth live consumer (chargenArt's
// CHGN00I0) was never opened at all. Worse, its name list was not the
// six: it invented DAGGER and STRT00I0 and omitted DIE_00I0 and
// PICK02I0. It now walks every .js under src/, reads the names from
// imgFile.js's exported PALETTIZED_FILENAMES, judges each LOAD SITE
// rather than the file, and sweeps BOTH directions - because a fresh
// DFPalette handed to a NON-palettized IMG is the mirror defect: the
// constructor fills all 256 entries with (255,0,0) (dfPalette.js:4)
// and nothing ever writes it, so that art draws solid red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTerrainGroundArchive, getGroundArchive, SEASON } from '../src/world/climateSwaps.js';
import { getWorldClimateSettings, CLIMATES } from '../src/formats/mapsFile.js';
import { PALETTIZED_FILENAMES } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

test('incident: the terrain ground archive is DFU\'s own truth table, all ten climates, both seasons', () => {
  // TerrainMaterialProvider.GetClimateInfo executed against every world
  // climate - the DFU column of the incident's forensic table.
  const DFU = {
    [CLIMATES.Ocean]: [402, 403], [CLIMATES.Desert]: [2, 2], [CLIMATES.Desert2]: [2, 2],
    [CLIMATES.Mountain]: [102, 103], [CLIMATES.Rainforest]: [402, 403], [CLIMATES.Swamp]: [402, 403],
    [CLIMATES.Subtropical]: [2, 2], [CLIMATES.MountainWoods]: [102, 103],
    [CLIMATES.Woodlands]: [302, 303], [CLIMATES.HauntedWoodlands]: [302, 303],
  };
  for (const [climate, [summer, winter]] of Object.entries(DFU)) {
    const s = getWorldClimateSettings(Number(climate));
    assert.equal(getTerrainGroundArchive(s, SEASON.Summer), summer, `climate ${climate} summer`);
    assert.equal(getTerrainGroundArchive(s, SEASON.Winter), winter,
      `climate ${climate} winter - Desert-base climates REFUSE the +1 (archive 3 is not a 56-record terrain tileset; TextureReader.cs:757-766)`);
  }
  // The ground-plane member is a DIFFERENT law and stays: Desert winter
  // DOES bump there (DaggerfallGroundPlane has no such guard).
  assert.equal(getGroundArchive(0, SEASON.Winter), 3, 'the RMB ground plane keeps its own law');
});

test('incident: both terrain hosts key the tileset on the TERRAIN member, not the ground plane\'s', () => {
  assert.match(src('src/scenes/world.js'), /const groundArchive = getTerrainGroundArchive\(climate, season\);/);
  assert.match(src('src/scenes/exterior.js'), /const groundArchive = getTerrainGroundArchive\(dfLocation\.climate, season\);/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.ok(!/const groundArchive = getGroundArchive\(/.test(src(f)),
      `${f}: the ground-plane member no longer feeds the terrain`);
  }
});

// ---------------------------------------------------------------------
// THE BEHAVIOURAL PIN - it observes the palette the loader is handed
// ---------------------------------------------------------------------

/** A synthetic palettized IMG: 64768 bytes is the headerless 320x200
 *  case (imgFile.js's dimension table), which is image data followed by
 *  the 768 palette bytes `_readPalette` reads. Every pixel is index 1
 *  (index 0 is bitmapToColor32's alphaIndex and is skipped), and the
 *  embedded palette gives index 1 (10,20,30) - x4 on load, so (40,80,120)
 *  is the ONLY colour this file can paint out of its own palette. */
function palettizedImgBytes() {
  const bytes = new Uint8Array(64768);
  bytes.fill(1, 0, 64000);
  bytes[64000 + 3] = 10; bytes[64000 + 4] = 20; bytes[64000 + 5] = 30;
  return bytes;
}

/** The session ART_PAL, marked: a colour no palettized file can produce. */
function markedSessionPalette() {
  const p = new DFPalette();
  p.fill(7, 11, 13);
  return p;
}

test('incident: the prison preload paints PRIS00I0 out of a palette of its OWN - the loader is never handed the session ART_PAL', async () => {
  const { preloadPrisonScreenArt, _setPrisonScreenArtForTests } = await import('../src/ui/prisonScreen.js');
  _setPrisonScreenArtForTests(null);
  const sharedPalette = markedSessionPalette();
  const before = Array.from(sharedPalette.paletteBuffer);
  let painted = null;
  await preloadPrisonScreenArt({
    renderer: { uploadTexture: (_kind, _name, color32) => { painted = color32; return {}; }, createTexture: () => ({}) },
    fetchBytes: async () => palettizedImgBytes(),
    palette: sharedPalette,
  });

  // THE OBSERVATION, and it is of the palette OBJECT the loader got.
  // ImgFile._readPalette (imgFile.js:203-217) writes the embedded
  // palette INTO whatever instance it was handed: had the preload
  // forwarded `deps.palette`, this buffer would now hold PRIS00I0's
  // colours. It is byte-identical, so the object handed down was a
  // different one - which is the whole of the 2026-09-01 incident.
  assert.deepEqual(Array.from(sharedPalette.paletteBuffer), before,
    'the session ART_PAL was repainted by a palettized preload - the 2026-09-01 incident');
  assert.deepEqual(
    [sharedPalette.getRed(1), sharedPalette.getGreen(1), sharedPalette.getBlue(1)], [7, 11, 13],
    'and index 1 still carries the host\'s own colour');

  // ...and the art itself still decoded, on PRIS00I0's embedded palette
  // (x4), not on the marked one: the mint is a real palette, not a hole.
  assert.ok(painted, 'the preload uploaded a texture');
  const rgba = Array.from(new Uint8Array(painted.colors.buffer, 0, 4));
  assert.deepEqual(rgba, [40, 80, 120, 255],
    'PRIS00I0 paints from its OWN embedded palette, multiplied by 4 (ImgFile.cs:491-499)');
  _setPrisonScreenArtForTests(null);
});

// ---------------------------------------------------------------------
// THE SWEEP - all of src/, per load site, both directions
// ---------------------------------------------------------------------

/** Every .js under src/, repo-relative. */
function srcFiles() {
  return readdirSync(join(root, 'src'), { recursive: true })
    .map((p) => `src/${String(p).split('\\').join('/')}`)
    .filter((p) => p.endsWith('.js'))
    .sort();
}

/** The balanced argument list of the call whose `(` is at `open`, split
 *  on top-level commas. Null when the parentheses do not close. */
function callArgs(text, open) {
  const args = [];
  let depth = 0, quote = null, start = open + 1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { args.push(text.slice(start, i)); return args; }
      continue;
    }
    if (ch === ',' && depth === 1) { args.push(text.slice(start, i)); start = i + 1; }
  }
  return null;
}

/** The value of an object literal's `palette:` key, or null when the
 *  expression names no palette at all (`deps`, `{ ...deps }`) - which is
 *  a palette PASSED THROUGH from the caller. */
function paletteArg(expr) {
  const k = expr.indexOf('palette:');
  if (k < 0) return null;
  let depth = 0;
  for (let i = k + 8; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === '}') { if (depth === 0) return expr.slice(k + 8, i).trim(); depth--; }
    else if (ch === ',' && depth === 0) return expr.slice(k + 8, i).trim();
  }
  return expr.slice(k + 8).trim();
}

test('incident: every palettized-IMG load site in src/ mints its own palette - and no other load site does', () => {
  // The names come from the law itself (imgFile.js's exported
  // PALETTIZED_FILENAMES = ImgFile.ReadPalette's switch, ImgFile.cs:
  // 477-489), never retyped here: the old hand-typed list had drifted
  // to four right names and two invented ones.
  assert.equal(PALETTIZED_FILENAMES.length, 6, 'ReadPalette\'s switch has six cases');
  const palettized = new Set(PALETTIZED_FILENAMES);
  const short = (n) => n.replace(/\.IMG$/, '');

  const sites = [];
  for (const f of srcFiles()) {
    if (f === 'src/formats/imgFile.js') continue;   // the declaration site, not a consumer
    const s = src(f);

    // `const COURT_IMG = 'CORT01I0.IMG'` - the indirection every native
    // window uses, resolved so the sweep can read the call.
    const names = new Map();
    for (const m of s.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*'([A-Z0-9_]+\.IMG)'/g)) names.set(m[1], m[2]);
    // A FRESH palette is one minted here and never loaded from a file:
    // `new DFPalette()` alone is the all-red constructor fill.
    const fresh = new Set();
    for (const m of s.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*new DFPalette\(\)/g)) {
      if (!s.includes(`${m[1]}.load(`)) fresh.add(m[1]);
    }
    const isFresh = (e) => e === 'new DFPalette()' || fresh.has(e);
    const resolve = (e) => {
      const t = e.trim();
      const lit = /^'([A-Z0-9_]+\.IMG)'$/.exec(t);
      return lit ? lit[1] : (names.get(t) ?? null);
    };

    const record = (i, name, paletteExpr, call) => {
      if (!name) return;
      // A call whose text names a palettized IMG anywhere counts as one,
      // even when the argument itself is a variable.
      const hit = PALETTIZED_FILENAMES.find((n) => call.includes(n)) ?? null;
      const isPal = palettized.has(name) || !!hit;
      sites.push({ f, name: hit ?? name, isPal, fresh: paletteExpr !== null && isFresh(paletteExpr), line: s.slice(0, i).split('\n').length });
    };

    for (const m of s.matchAll(/\bloadImg\(/g)) {
      const args = callArgs(s, m.index + m[0].length - 1);
      if (!args || args.length < 2) continue;
      record(m.index, resolve(args[1]), paletteArg(args[0]), args.join(','));
    }
    for (const m of s.matchAll(/\.load\(/g)) {
      const args = callArgs(s, m.index + m[0].length - 1);
      if (!args || args.length < 3) continue;
      record(m.index, resolve(args[1]), args[2].trim(), args.join(','));
    }
  }

  // The sweep must have SEEN the tree: four palettized consumers ship
  // today, and chargenArt is the one the old three-file list missed.
  const palSites = sites.filter((x) => x.isPal);
  const seen = new Set(palSites.map((x) => `${x.f} ${short(x.name)}`));
  for (const expected of [
    'src/ui/prisonScreen.js PRIS00I0', 'src/ui/titleScreen.js TITL00I0',
    'src/ui/startWindow.js PICK03I0', 'src/ui/chargenArt.js CHGN00I0',
  ]) {
    assert.ok(seen.has(expected), `the walk no longer reaches ${expected} - it found [${[...seen].join(', ')}]`);
  }

  // DIRECTION 1 - a palettized IMG is decoded on a palette of its own.
  // _readPalette writes INTO the instance it is handed, so a shared one
  // is destroyed by the load (the 2026-09-01 incident).
  for (const x of palSites) {
    assert.ok(x.fresh,
      `${x.f}:${x.line} loads ${x.name}, one of the SIX palettized IMGs, without minting its own DFPalette - _readPalette would repaint the palette it is handed (the 2026-09-01 incident)`);
  }

  // DIRECTION 2, the complement - and it is not symmetry for its own
  // sake. Every other IMG carries a real `paletteName` (ART_PAL.COL and
  // friends, imgFile.js:79-90) that the host has already loaded, and
  // `_readPalette` early-returns for it: a fresh DFPalette substituted
  // there is never written by anything, so all 256 entries stay at the
  // constructor's (255,0,0) and the art draws as a solid red panel.
  // That is exactly what CORT01I0 did under the false analogy to
  // PRIS00I0 one function above it.
  for (const x of sites.filter((y) => !y.isPal)) {
    assert.ok(!x.fresh,
      `${x.f}:${x.line} loads ${x.name}, which is NOT one of the six palettized IMGs, on a freshly minted DFPalette - nothing ever writes it, so the art paints all-red (dfPalette.js:11-17). It takes the host's shared palette, as DFU's LoadPalette(imgFile.PaletteName) does`);
  }
});
