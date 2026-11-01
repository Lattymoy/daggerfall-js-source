// OUR WEAPON FRAMES, A FAILED BUILD ASKED AGAIN. A frame the player's files would not build this time (a read refused
// mid-load) is not kept as a miss: a later ask builds it again, a bounded number of times; a frame the files lack is
// a miss at once and for good.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diverseWeaponsImage, setDiverseWeaponsArt, OWN_BUILD_TRIES } from '../../../src/combat/diverseWeapons/diverseWeaponsAssets.js';

const PIC = { width: 1, height: 1, data: new Uint8Array([4, 5, 6, 255]) };
const quiet = async (fn) => {
  const warn = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = warn; }
};

test('a build that threw is asked again on a later ask, up to OWN_BUILD_TRIES builds; one that answered none is not', async () => {
  const name = 'LONGSWORD.CIF_0-0_Iron';
  let calls = 0;
  setDiverseWeaponsArt({ frame: async () => { calls++; if (calls === 1) throw new Error('the file is still being read'); return PIC; } });
  try {
    await quiet(async () => {
      assert.equal(await diverseWeaponsImage(name, { enabled: true }), null, 'the first build failed: the classic frame draws');
      assert.deepEqual([...(await diverseWeaponsImage(name, { enabled: true })).colors], [4, 5, 6, 255], 'asked again: built');
      assert.deepEqual([...(await diverseWeaponsImage(name, { enabled: true })).colors], [4, 5, 6, 255]);
    });
    assert.equal(calls, 2, 'built, then kept');
    calls = 0;
    setDiverseWeaponsArt({ frame: async () => { calls++; throw new Error('refused'); } });
    await quiet(async () => { for (let i = 0; i < OWN_BUILD_TRIES + 3; i++) assert.equal(await diverseWeaponsImage(name, { enabled: true }), null); });
    assert.equal(calls, OWN_BUILD_TRIES, 'a frame that never builds is given up after its tries');
    assert.ok(OWN_BUILD_TRIES >= 2);
    calls = 0;
    setDiverseWeaponsArt({ frame: async () => { calls++; return null; } });
    for (let i = 0; i < 3; i++) assert.equal(await diverseWeaponsImage(name, { enabled: true }), null);
    assert.equal(calls, 1, 'none in the files: a miss kept');
  } finally { setDiverseWeaponsArt(null); }
});
