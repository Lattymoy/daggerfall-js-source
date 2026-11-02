// RPT1026-ITEMS DEX-CORPSE - a private report (written in Portuguese): the new Dremora's bodies disappear at death, leaving
// a pool of blood (BLOOD2c's corpse pool, combat/blood/bloodBleed.js) and their loot, which can still be searched. The new
// Dremora are Daggerfall Enemy Expansion's Dremora Churl (DEX, 2026-10-20). Checked here, lane by lane, through the real
// install and the real texture door:
//   - THE CLASSIC LANE: its row's corpse (MonsterBase.mdb.csv CorpseTextureArchive/Record - 1708, record 25, the
//     authors' own picture of the Dremora lying) is what the death reads (corpseMarker.js corpseTextureOf), the archive's
//     stand-in carries that record, its picture is measured and sized as a billboard, and it goes up to the GPU;
//   - THE MORROWIND LANE: the row is matched to Morrowind's dremora (DEX7, dexBodies.js), so on that lane the dead lie in
//     that body's death pose and the corpse flat under it casts only its shadow (dungeonContext.js drawFoes, MWNPC5b);
//     where the body has no death to pose, thirdActive answers false, the lane lets it go and the flat draws
//     (combat/fpArm.js die, peerBodies.js _standing - MWNPC4's audit).
// Neither lane is missing a body for it here. What the report shows - the pool and the loot with no body - matches the
// Morrowind lane only if its body stands and draws nothing, which needs Morrowind's own files to run: none in this tree.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installEnemyExpansion, _resetEnemyExpansion } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { installDexSprites, _resetDexSprites } from '../../../src/systems/enemyExpansion/dexSprites.js';
import { DEX_ART } from '../../../src/systems/enemyExpansion/dexArt.js';
import { clearVendorTextures } from '../../../src/systems/textureReplacement.js';
import { unregisterBillboardXml } from '../../../src/world/billboardXml.js';
import { corpseTextureOf } from '../../../src/scenes/corpseMarker.js';
import { billboardSize } from '../../../src/world/rmbFlats.js';
import { creatureLook } from '../../../src/characters/creatureBodies.js';
import { readPng } from '../../../tools/pngIO.mjs';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetModSettings } from '../../../src/systems/modSettings.js';
import { _resetDexBodies } from '../../../src/systems/enemyExpansion/dexBodies.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DREMORA_CHURL = 285;
const shipped = (url) => /art\/daggerfall-enemy-expansion(?:-repainted)?\/[^/]+\.png$/.exec(url)[0];
function uploadRenderer(Renderer) {
  let made = 0;
  const gl = new Proxy({}, { get: (_, k) => (k === 'createTexture' ? () => ({ id: ++made }) : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => {}) });
  const r = Object.create(Renderer.prototype);
  Object.assign(r, { gl, textures: new Map(), emissionTextures: new Map(), emissionWhite: new Set(), _texKeysByBase: new Map(), _texBaseOf: new Map(), _replacements: new Set(), _placeholders: new Set(), _texGen: 0, _retroMips: false });
  return r;
}

test('DEX-CORPSE: the Dremora Churl dies into its own corpse picture on the classic lane - its row names it, the stand-in carries it, it is sized and goes up to the GPU - and on the Morrowind lane it is Morrowind\'s dremora, laid in that body (mutant: the row\'s corpse left unread)', async (t) => {
  const was = { cib: globalThis.createImageBitmap, oc: globalThis.OffscreenCanvas };
  globalThis.createImageBitmap = async (blob) => ({ ...readPng(new Uint8Array(await blob.arrayBuffer())), close() {} });
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { let bmp = null; return { drawImage: (b) => { bmp = b; }, getImageData: () => ({ width: bmp.width, height: bmp.height, data: new Uint8ClampedArray(bmp.data) }) }; }
  };
  t.after(() => {
    globalThis.createImageBitmap = was.cib; globalThis.OffscreenCanvas = was.oc;
    clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion');
    _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetDexBodies(); _resetModSettings();
  });
  installEnemyExpansion({ on: true, log: () => {} });
  clearVendorTextures(); _resetDexSprites();   // the install registered the pictures by URL; here they are read off the tree
  installDexSprites({ fetchBytes: async (url) => new Uint8Array(readFileSync(join(root, 'public', shipped(url)))) });
  // the death reads the row's corpse - the mod's own
  const ct = corpseTextureOf({ mobileType: DREMORA_CHURL, gender: 'male' });
  assert.deepEqual(ct, { archive: 1708, record: 25 }, 'MonsterBase.mdb.csv\'s CorpseTextureArchive and CorpseTextureRecord');
  assert.deepEqual(corpseTextureOf({ mobileType: DREMORA_CHURL, gender: 'female' }), ct, 'one body for either');
  assert.ok(DEX_ART[1708].frames[25] >= 1, 'the index imports the record (one frame)');
  // through the real texture door, as spawnCorpseNow asks it: the archive, the record's size, the billboard, the upload
  const { Renderer } = await import('../../../src/render/renderer.js');
  const { createDataPipeline } = await import('../../../src/scenes/dataPipeline.js');
  const r = uploadRenderer(Renderer);
  const pipe = createDataPipeline({ renderer: r, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const tex = await pipe.getTexture(ct.archive);
  assert.ok(tex && ct.record < tex.recordCount, `the stand-in carries the record (${tex?.recordCount} records)`);
  const px = tex.getSize(ct.record);
  assert.ok(px.width > 1 && px.height > 1, `measured off its picture (${px.width} x ${px.height})`);
  assert.ok(px.width > px.height, 'a body lying down, wider than it is tall');
  const size = billboardSize(tex, ct.record);
  assert.ok(size.w > 0 && size.h > 0, `a billboard with a size (${size.w} x ${size.h})`);
  pipe.uploadRecordFrame(ct.archive, ct.record, 0);
  for (let i = 0; i < 20 && !r.textures.has('1708_25#0'); i++) await new Promise((res) => setTimeout(res, 5));
  assert.ok(r.textures.has('1708_25#0'), 'and it goes up to the GPU');
  // the Morrowind lane: the row's body is Morrowind's dremora, so the dead lie in it
  assert.deepEqual(creatureLook({ mobileType: DREMORA_CHURL })?.creature, ['dremora'], 'DEX7\'s match');
});
