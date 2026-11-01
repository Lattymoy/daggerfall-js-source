// Not a count - a picture. Roleplay & Realism's variant keepers re-materialise a shop or tavern keeper onto
// archive 197, and the mod's seven 197 sprites are registered LAZY (nothing fetched at install). A lazy record is
// decoded only when something asks for it, and getTexture's archive preload skips lazy entries by design - so
// nothing asked, and the person's billboard uploaded the CLASSIC TEXTURE.197 record in the mod's place. Record 6
// of that "Kludge Town" archive is a street lamp (the mod's own XML stretches it 3 x 0.8 into a person's frame),
// so every 182_2 keeper of a quality-13-plus shop or tavern stood as a lamp post - and a click on the lamp opened
// the shop. The person's stand asks for its draw record's replacement before the upload now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { installRoleplayRealismArt, _resetRoleplayRealismArt, rrShopTavernRecord, RR_NPC_ARCHIVE } from '../../src/systems/roleplayRealism/rrVariants.js';
import { hasTextureReplacement, clearVendorTextures, decodedTexture, preloadTextureRecord } from '../../src/systems/textureReplacement.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const V = 'roleplay-realism';
// The keepers are composed from the player's own townspeople (rrKeepers.js), so the ask
// that paints one reads ARENA2 through the session's classic reader
const ARENA2 = process.env.ARENA2_PATH && existsSync(join(process.env.ARENA2_PATH, 'TEXTURE.182')) ? process.env.ARENA2_PATH : null;

test('LAMP-KEEPER: the 182_2 keeper of a good shop is drawn from 197 record 6 - the record whose classic picture is a lamp', () => {
  assert.equal(rrShopTavernRecord(182, 2, BUILDING_TYPES.Tavern, 13), 6);
  assert.equal(rrShopTavernRecord(182, 2, BUILDING_TYPES.Tavern, 12), -1, 'twelve and under keep the classic keeper');
  assert.equal(RR_NPC_ARCHIVE, 197);
});

test('LAMP-KEEPER: the keeper is on the door but not painted until asked - and the ask the person\'s stand makes paints it', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismArt();
  setModSetting(V, 'Enabled', true); setModSetting(V, 'variantNpcs', true);
  installRoleplayRealismArt({ art: createClassicPictures(async (n) => readFileSync(join(ARENA2, n))) });
  assert.equal(hasTextureReplacement(197, 6), true, 'registered');
  assert.equal(decodedTexture(197, 6), null, 'lazy: the upload path would draw the classic record - the lamp');
  const got = await preloadTextureRecord(197, 6, 0, 'Albedo', null, { decode: async () => assert.fail('OWN-WORK4: our keeper is no file') });
  assert.ok(got, 'the ask paints the keeper');
  const pic = decodedTexture(197, 6);
  assert.deepEqual([pic.width, pic.height], [71, 128], 'OWN-WORK4: our keeper, at the 182_2 keeper\'s size the scale is read against');
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismArt();
});

test('LAMP-KEEPER: the interior person\'s stand asks for its DRAW record\'s art before it uploads it', () => {
  const src = rd('src/scenes/interiorContext.js');
  const at = src.indexOf('const standPerson = (pn) => {');
  const body = src.slice(at, src.indexOf('\n  };\n', at));
  const ask = body.indexOf('if (pn.drawArchive != null) await preloadTextureRecord(pn.drawArchive, pn.drawRecord ?? pn.textureRecord)');
  assert.ok(ask > 0, 'the stand asks for a re-materialised person\'s art');
  assert.ok(ask < body.indexOf('uploadRecord(pn.drawArchive ?? pn.textureArchive'), '...before the upload reads it');
  assert.match(src, /import \{ preloadTextureRecord \} from '\.\.\/systems\/textureReplacement\.js';/);
});
