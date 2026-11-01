// A picture rebuilt from the player's own files through systems/classicArt.js needs no
// world pipeline, so the texture door builds a `selfBuilt` entry before one is up (the paper doll on the menu draws
// Roleplay & Realism: Items' helmets before any world). An entry built from the pipeline's own context still waits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addVendorTextures, clearVendorTextures, setTextureDeriveContext, preloadTextureRecord } from '../../src/systems/textureReplacement.js';
import { readFileSync } from 'node:fs';

const picture = () => ({ width: 2, height: 1, data: new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]) });

test('NO-BETHESDA2: with no pipeline up, a selfBuilt entry is built and a pipeline entry is refused', async () => {
  clearVendorTextures();
  setTextureDeriveContext(null);
  const warn = console.warn; console.warn = () => {};
  try {
    addVendorTextures([
      { archive: 98101, record: 0, frame: 0, standIn: true, fileName: 'own', build: async () => picture(), selfBuilt: true },
      { archive: 98102, record: 0, frame: 0, standIn: true, fileName: 'pipeline', build: async (ctx) => ctx.classicRgba(1, 0, 0) },
    ]);
    const own = await preloadTextureRecord(98101, 0, 0);
    assert.ok(own, 'built with no pipeline');
    assert.equal(own.width, 2);
    assert.equal(await preloadTextureRecord(98102, 0, 0), null, 'refused until a pipeline is up');
  } finally {
    console.warn = warn;
    clearVendorTextures();
  }
});

test('NO-BETHESDA2: every registrant that builds through classicArt says so', () => {
  const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  // Every survival picture is built - rebuilt or ours - so every entry says so once, for both
  assert.match(rd('src/systems/survival/itemIcons.js'), /fileName: f, standIn, selfBuilt: true \};\n\s*return \{ \.\.\.at, build: ownIconSpec\(f\) \? \(\) => ownIconPicture\(f, art\) : \(\) => rebuiltPicture\(spec, art\) \};/);
  assert.match(rd('src/systems/roleplayRealismItems/rriInstall.js'), /build: \(\) => rriOwnPicture\(e\.name, art \?\? classicArt\(\)\), selfBuilt: true/, 'OWN-WORK4: every picture ours');
  assert.match(rd('src/systems/roleplayRealism/rrVariants.js'), /selfBuilt: true,\n\s*build: RR_DERIVED\[fileName\] \? \(\) => built\(fileName\) : \(\) => rrKeeperPicture\(record, art \?\? classicArt\(\)\),/, 'OWN-WORK4: and our keepers, over the player\'s own people (OWN-WORK4 AUDIT)');
});
