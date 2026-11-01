// A ground set asked while the texture store's registration is under way waits for it: asked before the shipped packs
// are in the door, a set is Daggerfall's own, and the host keeps it for the session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dfmodGroundLayers, DFMOD_OFF_PREF, DFMOD_SHIPPED_PREF, _resetDfmodForTests } from '../../src/systems/dfmodTextures.js';
import { installVanillaEnhancedPack, _setVePackIoForTests } from '../../src/systems/vanillaEnhanced/vanillaEnhancedPack.js';
import { noteTextureStoreRegistering, textureStoreRegistering } from '../../src/systems/textureStoreGate.js';
import { clearTextureReplacements } from '../../src/systems/textureReplacement.js';
import { setValue } from '../../src/systems/settings/settings.js';
import { setPref } from '../../src/systems/uiPrefs.js';

/** A classic TEXTURE file's surface, as the hosts hand it: record r is 1x1, opaque, black. */
const classicTex = (n) => ({ recordCount: n, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: Uint8Array.of(0, 0, 0, 255) }) });

test('the swamp\'s ground set waits for the store\'s registration: asked before the shipped packs are in the door it answers the Base\'s set once they are, never Daggerfall\'s own; with no registration under way it answers at once; the data source notes each registration (mutants: the wait dropped; the registration unnoted)', async () => {
  _resetDfmodForTests();
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});
  clearTextureReplacements();
  _setVePackIoForTests({ build: async (spec) => ({ width: 2, height: 2, data: new Uint8Array(16).fill(spec.from[1] + 1) }) });
  assert.equal(await dfmodGroundLayers(402, classicTex(56)), null, 'nothing in the door: Daggerfall\'s own');
  _resetDfmodForTests();
  let land;
  const registration = new Promise((resolve) => (land = resolve));
  noteTextureStoreRegistering(registration);
  const asked = dfmodGroundLayers(402, classicTex(56));
  installVanillaEnhancedPack();
  land(1);
  const layers = await asked;
  assert.deepEqual([layers?.length, layers?.[0].width, layers?.[7].colors[0]], [56, 2, 8], 'the Base\'s set, record 7 its own');
  assert.equal(textureStoreRegistering(), null, 'forgotten once it settles');
  const source = readFileSync(new URL('../../src/scenes/dataSource.js', import.meta.url), 'utf8');
  assert.match(source, /const p = registerTextureStoreNow\(\{ warm \}\);\n {2}noteTextureStoreRegistering\(p\);/);
  _setVePackIoForTests();
});
