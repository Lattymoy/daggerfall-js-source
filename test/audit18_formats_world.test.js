// AUDIT 18 - formats-world domain pins.
//
// Every assertion here is a MUTATION pin: reverting the fix it guards makes
// it fail. Where a corpus assertion could pass vacuously (a table row that
// is never reached, a seam that the data never exercises), the precondition
// is asserted alongside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BlocksFile } from '../src/formats/blocksFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { SkyFile } from '../src/formats/skyFile.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { FactionFile, FACTION_TYPES } from '../src/formats/factionFile.js';
import { readSpellsStd, spellsByIndexMap } from '../src/formats/spellsStd.js';
import { RULER_TITLES, rulerTitle, generateBuildingName, BUILDING_TYPES }
  from '../src/world/buildingNames.js';
import { collectCityLights } from '../src/world/cityLights.js';
import { scaledBillboardSize } from '../src/world/rmbFlats.js';
import { buildGroundTilemap } from '../src/world/rmbLayout.js';
import { convertTilemap } from '../src/world/terrainSurface.js';
import { buildDaySkyPanorama, buildNightSkyPanorama, buildFallbackSkyPanorama }
  from '../src/render/skyRenderer.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { mergeNamedBuildings } from '../src/systems/talkTopics.js';
import { getNameBankOfRegion, BANK_TYPES } from '../src/characters/nameHelper.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arena2 = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
const approx = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

let cachedBlocks = null;
const blocksFile = () => {
  if (!cachedBlocks) {
    cachedBlocks = new BlocksFile();
    cachedBlocks.load(arena2('BLOCKS.BSA'));
  }
  return cachedBlocks;
};

// ---------------------------------------------------------------------------
// F7/F10 - MacroHelper.GetRulerTitle cases 11 and 12.
// ---------------------------------------------------------------------------

test('audit18: ruler-title table is the whole GetRulerTitle switch', () => {
  // MacroHelper.cs:368-399, case for case.
  assert.deepEqual({ ...RULER_TITLES }, {
    1: 'King', 2: 'Queen', 3: 'Duke', 4: 'Duchess', 5: 'Marquis',
    6: 'Marquise', 7: 'Count', 8: 'Countess', 9: 'Baron', 10: 'Baroness',
    11: 'Lord', 12: 'Lady',
  });
  // 12 -> Lady is the row that was missing; 11/13/0 -> Lord is what stops
  // the wrong "fix" of flipping the default to Lady.
  assert.equal(rulerTitle(12), 'Lady');
  assert.equal(rulerTitle(11), 'Lord');
  assert.equal(rulerTitle(13), 'Lord');
  assert.equal(rulerTitle(0), 'Lord');
});

test('audit18: %rt expands through generateBuildingName for rulers 11 and 12', () => {
  const opts = (regentRuler) => ({
    locationName: 'Anticlere', regionName: 'Anticlere', nameBank: 0, regentRuler,
  });
  // Seed 63 rolls STORES_A[15] = "The %rt's" for both shop types.
  assert.equal(generateBuildingName(63, BUILDING_TYPES.WeaponSmith, opts(12)),
    "The Lady's Blacksmith");
  assert.equal(generateBuildingName(63, BUILDING_TYPES.GeneralStore, opts(12)),
    "The Lady's Market");
  assert.equal(generateBuildingName(63, BUILDING_TYPES.WeaponSmith, opts(11)),
    "The Lord's Blacksmith");
});

test('audit18: ruler 12 is live in FACTION.TXT, so the row is not dead',
  { skip: skipReal }, () => {
    const ff = new FactionFile();
    ff.load(arena2('FACTION.TXT'));
    const byRuler = new Map();
    for (const f of ff.factionDict.values()) {
      if (f.type !== FACTION_TYPES.Province) continue;
      if (!byRuler.has(f.ruler)) byRuler.set(f.ruler, []);
      byRuler.get(f.ruler).push(f.region);
    }
    // Anticlere 21, Koegria 35, Tigonus 48, Mournoth 52 all have ruler 12.
    assert.deepEqual(byRuler.get(12).slice().sort((a, b) => a - b), [21, 35, 48, 52]);
    assert.equal(byRuler.get(11).length, 6);
    // (This half passes before AND after the fix - it is the anti-dead-code
    // evidence, not the mutation pin. The two tests above are that.)
  });

// ---------------------------------------------------------------------------
// F8 - city lantern lights: GetScaledBillboardSize is NATIVE units.
// ---------------------------------------------------------------------------

test('audit18: city lights add the billboard height at DFU scale', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(arena2('ART_PAL.COL'), 'ART_PAL.COL');
  const t210 = new TextureFile();
  t210.load(arena2('TEXTURE.210'), 'TEXTURE.210', pal);
  const size = (r) => scaledBillboardSize(t210.getSize(r), t210.getScale(r));
  const bf = blocksFile();

  // MISC-FLAT path. MAGEAA00.RMB record 29: native scaled height 160
  // (world 4), yPos -4 -> DFU (4 + 160) * 0.025 = 4.1.
  assert.deepEqual(size(29), { w: 0.525, h: 4 });
  const mage = collectCityLights(bf.getBlockByName('MAGEAA00.RMB'), size);
  assert.equal(mage.length, 3);
  for (const l of mage) approx(l.y, 4.1);
  // The identity that pins WHERE the scale lands: y - size.h == -yPos * 0.025.
  for (const l of mage) approx(l.y - size(29).h, 0.1);

  // SUBRECORD path - SENT7.RMB is the only block in BLOCKS.BSA with an
  // archive-210 exterior subrecord flat, so a one-branch fix cannot pass.
  const sent = collectCityLights(bf.getBlockByName('SENT7.RMB'), size);
  assert.equal(sent.length, 1);
  approx(size(0).h, 1.3);            // native 52
  approx(sent[0].y, 1.5);            // (8 + 52) * 0.025
  approx(sent[0].y - size(0).h, 0.2);
});

// ---------------------------------------------------------------------------
// F9 - the random-marker ground tile is tilemap INDEX 8 == texture RECORD 2.
// ---------------------------------------------------------------------------

test('audit18: marker ground tiles decode to grass record 2', () => {
  // Synthetic block: one marker tile (record >= 56), one ordinary tile.
  const groundTiles = [];
  for (let x = 0; x < 16; x++) {
    groundTiles.push([]);
    for (let y = 0; y < 16; y++) {
      groundTiles[x].push({ textureRecord: 7, isRotated: false, isFlipped: true, tileBitfield: 0 });
    }
  }
  groundTiles[3][15] = { textureRecord: 60, isRotated: true, isFlipped: true, tileBitfield: 0 };
  const tiles = buildGroundTilemap({ rmbBlock: { fldHeader: { groundData: { groundTiles } } } });
  assert.deepEqual(tiles[0][3], { record: 2, rotated: false, flipped: false });
  assert.deepEqual(tiles[0][4], { record: 7, rotated: false, flipped: true });
  // And the byte the shader eventually sees: record * 4 + variant == 8,
  // layer = byte >> 2 == 2 == TerrainTexturing's `const byte grass = 2`.
  assert.deepEqual([...convertTilemap(new Uint8Array([tiles[0][3].record]))], [8]);
  assert.equal(8 >> 2, 2);
});

test('audit18: WALLAA03 markers all land on grass', { skip: skipReal }, () => {
  const w3 = blocksFile().getBlockByName('WALLAA03.RMB');
  const src = w3.rmbBlock.fldHeader.groundData.groundTiles;
  const tiles = buildGroundTilemap(w3);
  let markers = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (src[x][15 - y].textureRecord < 56) continue;
      markers++;
      assert.equal(tiles[y][x].record, 2);
      assert.equal(convertTilemap(new Uint8Array([tiles[y][x].record]))[0], 8);
    }
  }
  // Precondition: the block really does carry markers, so the loop above
  // cannot pass vacuously.
  assert.equal(markers, 252);
});

// ---------------------------------------------------------------------------
// F0 - FileProxy.ReadCString's FIXED-LENGTH variant (UTF-8 + TrimEnd only).
// ---------------------------------------------------------------------------

test('audit18: fixed-length ReadCString keeps embedded NULs', { skip: skipReal }, () => {
  const bf = blocksFile();
  // Each anchor carries an embedded NUL followed by live bytes, so
  // stop-at-first-NUL cannot produce any of them.
  assert.equal(bf.getBlockByName('WAY1.RMB').rmbBlock.fldHeader.name,
    'WAY1.RMB   B');
  assert.equal(bf.getBlockByName('WALLAA11.RMB').rmbBlock.fldHeader.otherNames[17],
    'T2.HS2 0.HS2');
  assert.equal(bf.getBlockByName('TVRNBM04.RMB').rmbBlock.fldHeader.otherNames[19],
    'WEAPON.HS2 2');
  // NUL-padded fields are unchanged (TrimEnd('\0') strips the padding).
  assert.equal(bf.getBlockByName('MAGEAA00.RMB').rmbBlock.fldHeader.name, 'MAGEAA00.RMB');
  // UTF-8, not latin1: the 8 RDBs whose dagr is four 0xff bytes decode to
  // four U+FFFD, exactly as Encoding.UTF8.GetString does.
  const bad = [];
  for (let i = 0; i < bf.count; i++) {
    const n = bf.getBlockName(i);
    if (!/\.RDB$/.test(n)) continue;
    const d = bf.getBlock(i).rdbBlock.objectHeader.dagr;
    if (d !== 'DAGR') bad.push(d);
  }
  assert.equal(bad.length, 8);
  for (const d of bad) assert.equal(d, '����');
  // Downstream invariant the fix must not disturb: FixRdbData block 1025
  // finds its free slot by scanning for modelIdNum === 0, and the raw
  // non-numeric "REF_C" at slot 0 is what makes slot 0 free. UTF-8 decoding
  // must not change any modelId's parse.
  const w9 = bf.getBlockByName('W0000009.RDB');
  assert.equal(w9.rdbBlock.modelReferenceList[0].modelIdNum, 72100);
  assert.equal(w9.rdbBlock.modelReferenceList[0].description, 'DOR');
});

// ---------------------------------------------------------------------------
// F2/F5 - clearColor is DFU's west[0] (horizon); fillColor is ours (zenith).
// ---------------------------------------------------------------------------

test('audit18: sky clearColor is the horizon, fillColor the zenith', { skip: skipReal }, () => {
  const sf = new SkyFile();
  sf.load(arena2('SKY16.DAT'), 'SKY16.DAT');
  const to255 = (c) => c.map((v) => Math.round(v * 255));

  // DaggerfallSky.cs:554 `colors.clearColor = colors.west[0]`, and
  // BaseImageFile.cs:246-250 emits bottom-up, so element 0 is the source
  // image's LAST (horizon) row.
  const p31 = buildDaySkyPanorama(sf, 31);
  assert.deepEqual(to255(p31.clearColor), [229, 255, 255]);
  assert.deepEqual(to255(p31.fillColor), [173, 198, 253]);   // the old value
  const p0 = buildDaySkyPanorama(sf, 0);
  assert.deepEqual(to255(p0.clearColor), [80, 8, 9]);
  assert.deepEqual(to255(p0.fillColor), [30, 6, 6]);
  // Both must be asserted: a pin on fillColor alone would pass either way.
  assert.notDeepEqual(p31.clearColor, p31.fillColor);

  // The fallback gradient obeys the same split: clearColor at the horizon
  // end, fillColor at the zenith end.
  const fb = buildFallbackSkyPanorama();
  assert.deepEqual(to255(fb.clearColor), [196, 205, 224]);
  assert.deepEqual(to255(fb.fillColor), [86, 116, 170]);
});

// ---------------------------------------------------------------------------
// F3 (seam half) - LoadVanillaNightSky's right-edge column fix.
// ---------------------------------------------------------------------------

test('audit18: night panorama applies the right-edge seam fix', { skip: skipReal }, () => {
  const img = new ImgFile();
  img.load(arena2('NITE02I0.IMG'), 'NITE02I0.IMG');
  const pal = new DFPalette();
  pal.load(arena2(img.paletteName), img.paletteName);
  img.palette = pal;
  const c32 = img.getColor32(img.getDFBitmap(0, 0), -1);
  const { width: w, height: h, colors: src } = c32;
  assert.deepEqual([w, h], [512, 219]);

  // PRECONDITION: the raw image really has a seam, so the equality below
  // cannot pass vacuously.
  let seamRows = 0;
  for (let y = 0; y < h; y++) {
    const a = (y * w + w - 2) * 4, b = (y * w + w - 1) * 4;
    if (src[a] !== src[b] || src[a + 1] !== src[b + 1] || src[a + 2] !== src[b + 2]) seamRows++;
  }
  assert.equal(seamRows, 132);

  // After the fix, column 511 equals column 510 in BOTH copies of the half.
  const pano = buildNightSkyPanorama(c32);
  const W = pano.width;
  for (let y = 0; y < h; y++) {
    for (const half of [0, 1]) {
      const a = (y * W + half * w + w - 2) * 4;
      const b = (y * W + half * w + w - 1) * 4;
      for (let k = 0; k < 3; k++) {
        assert.equal(pano.colors[b + k], pano.colors[a + k], `seam y=${y} half=${half}`);
      }
    }
  }
  // clearColor is still west[0] and is NOT touched by the seam fix.
  assert.deepEqual(pano.clearColor,
    [src[0] / 255, src[1] / 255, src[2] / 255]);
});

// ---------------------------------------------------------------------------
// F6 - RebuildClassicSpellsDict keeps the FIRST duplicate index.
// ---------------------------------------------------------------------------

test('audit18: spellsByIndexMap keeps the first duplicate, not the last', () => {
  const m = spellsByIndexMap([
    { index: 58, name: 'Holy Word', rangeType: 3 },
    { index: 58, name: 'Holy Touch', rangeType: 1 },
    { index: 7, name: 'Other', rangeType: 0 },
  ]);
  assert.equal(m.size, 2);
  assert.equal(m.get(58).name, 'Holy Word');
  assert.equal(m.get(58).rangeType, 3);
  // Insertion order is the first occurrence's slot (values() scan order).
  assert.deepEqual([...m.keys()], [58, 7]);
});

test('audit18: SPELLS.STD index 58 is Holy Word', { skip: skipReal }, () => {
  const list = readSpellsStd(arena2('SPELLS.STD'));
  assert.equal(list.length, 89);
  const m = spellsByIndexMap(list);
  // 88, not 89: a dedup really happened, so the assert below is not just
  // reading a file with no duplicates.
  assert.equal(m.size, 88);
  assert.equal(m.get(58).name, 'Holy Word');
  assert.equal(m.get(58).rangeType, 3);
  // The record the JS Map constructor would have kept.
  assert.equal(list.filter((s) => s.index === 58).at(-1).name, 'Holy Touch');
});

// ---------------------------------------------------------------------------
// KRAVE01.HS2 - RMBLayout.cs:677-683 Order-of-the-Raven override.
// ---------------------------------------------------------------------------

test('audit18: KRAVE01.HS2 buildings become GuildHall / faction 414',
  { skip: skipReal }, () => {
    const mf = new MapsFile();
    mf.load(arena2('MAPS.BSA'), arena2('CLIMATE.PAK'), arena2('POLITIC.PAK'));
    const bf = blocksFile();

    // Precondition: the raw block data really names KRAVE01.HS2 at these
    // slots, and the RAW type there is Temple(14) - so the assertions
    // below cannot be satisfied by the pool merge alone.
    const kraval00 = bf.getBlockByName('KRAVAL00.RMB');
    assert.equal(kraval00.rmbBlock.fldHeader.otherNames[18], 'KRAVE01.HS2');
    assert.equal(kraval00.rmbBlock.fldHeader.buildingDataList[18].buildingType,
      BUILDING_TYPES.Temple);
    assert.equal(kraval00.rmbBlock.subRecords.length, 19);   // 18 < 19, in range

    // FILLAA03.RMB also names KRAVE01.HS2, at slot 16 - but it has ZERO
    // subrecords, so DFU's `for (i < SubRecords.Length)` never reaches it
    // and neither may we. That block is the over-application guard below.
    const fill = bf.getBlockByName('FILLAA03.RMB');
    assert.equal(fill.rmbBlock.fldHeader.otherNames[16], 'KRAVE01.HS2');
    assert.equal(fill.rmbBlock.subRecords.length, 0);

    const dwynnen = mf.getRegionIndex('Dwynnen');
    const region = mf.getRegion(dwynnen);
    const hits = [];
    for (let l = 0; l < region.locationCount; l++) {
      const loc = mf.getLocation(dwynnen, l);
      const layout = layoutLocation(loc, mf, bf);
      const merged = mergeNamedBuildings(loc.exterior.buildings, layout.blocks);
      for (const b of layout.blocks) {
        const otherNames = b.dfBlock.rmbBlock.fldHeader.otherNames;
        const list = merged.get(b);
        for (let i = 0; i < list.length; i++) {
          if (otherNames[i] !== 'KRAVE01.HS2') continue;
          hits.push(`${loc.name}/${b.blockName}#${i} ` +
            `type=${list[i].buildingType} faction=${list[i].factionId}`);
        }
      }
    }
    // Whole-region deepEqual, not a spot check: 16 buildings take the
    // override (10 on KRAVAL00, whose raw type is Temple, and 6 on
    // KRAVAL01), and Tuntry's FILLAA03 slot 16 must NOT, because the
    // block has no subrecords for DFU's loop to reach.
    const G = BUILDING_TYPES.GuildHall;
    assert.deepEqual(hits.slice().sort(), [
      `Aldton/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Baelwood/KRAVAL01.RMB#2 type=${G} faction=414`,
      `Burghead/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Charengate/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Crossbrugh/KRAVAL01.RMB#2 type=${G} faction=414`,
      `Deerwood/KRAVAL01.RMB#2 type=${G} faction=414`,
      `Dwynnen/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Eastville Derry/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Gallomore/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Oxborne/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Tunhead/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Tuntry/FILLAA03.RMB#16 type=${BUILDING_TYPES.Temple} faction=0`,
      `Upbridge/KRAVAL01.RMB#2 type=${G} faction=414`,
      `Whitewold/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Wildercroft/KRAVAL00.RMB#18 type=${G} faction=414`,
      `Wildertower/KRAVAL01.RMB#2 type=${G} faction=414`,
    ].sort());
  });

// ---------------------------------------------------------------------------
// F1 - the retired "GetNameBankOfRegion is not ported" claim.
// ---------------------------------------------------------------------------

test('audit18: GetNameBankOfRegion ships, so no doc may call it unported', () => {
  // It is implemented, verbatim MapsFile.cs:329-335 ...
  assert.equal(typeof getNameBankOfRegion, 'function');
  assert.equal(getNameBankOfRegion(-1), BANK_TYPES.Breton);
  assert.equal(getNameBankOfRegion(0), BANK_TYPES.Redguard);   // REGION_RACES[0] === 1
  assert.equal(getNameBankOfRegion(17), BANK_TYPES.Breton);
  // ... and it is LIVE.
  const townTalk = readFileSync(join(ROOT, 'src/scenes/townTalk.js'), 'utf8');
  assert.ok(townTalk.includes('getNameBankOfRegion('));

  // ... therefore no "Not ported" sentence may still name it.
  const arc = readFileSync(join(ROOT, 'bible/02-Formats/Readers-Arc.md'), 'utf8');
  const maps = readFileSync(join(ROOT, 'src/formats/mapsFile.js'), 'utf8');
  const header = maps.slice(0, maps.indexOf('import '));
  for (const [name, text] of [['Readers-Arc.md', arc], ['mapsFile.js header', header]]) {
    for (const m of text.matchAll(/Not ported[^.]*\./g)) {
      assert.ok(!/GetNameBankOfRegion/i.test(m[0]),
        `${name}: a "Not ported" sentence still lists GetNameBankOfRegion, ` +
        'which ships in characters/nameHelper.js and is called by scenes/townTalk.js');
    }
  }
});
