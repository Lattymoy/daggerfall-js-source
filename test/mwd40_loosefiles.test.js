// MW-D40 - LOOSE MORROWIND FILES + THE EXTERNAL-SOUND DOOR, pinned
// with no browser and no game data. A mod like Pegas Horse Ranch
// ships meshes/textures/sounds OUTSIDE any .bsa; the engine's own law
// is that loose data files override archived ones. The store learns
// to keep them by canonical relative path, one {has, get} duck ranks
// ahead of every archive through the exact seam fpArm already speaks,
// and the audio engine takes a registered string key anywhere it took
// a DAGGERFALL.SND index.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mwLoosePath, makeLooseArchive } from '../src/scenes/dataSource.js';
import { AudioEngine } from '../src/systems/audio.js';

test('MW-D40: mwLoosePath - canonical relative paths from whatever the picker hands over', () => {
  // the mod's own layout, picked from ABOVE Data Files
  assert.equal(mwLoosePath('Pegas Horse Ranch/morrowind/Data Files/Meshes/maxhorse/Xhorse1.nif'),
    'meshes/maxhorse/xhorse1.nif');
  // picked AT Data Files
  assert.equal(mwLoosePath('Data Files/Textures/Cait_horse1x.dds'), 'textures/cait_horse1x.dds');
  // picked at the asset root itself
  assert.equal(mwLoosePath('Meshes/maxhorse/Xhorse1.kf'), 'meshes/maxhorse/xhorse1.kf');
  // backslashes normalize (a zip extracted on Windows)
  assert.equal(mwLoosePath('Data Files\\Sound\\Cr\\maxhorse\\horse_trot.wav'),
    'sound/cr/maxhorse/horse_trot.wav');
  // no known root: the basename (a file picked alone)
  assert.equal(mwLoosePath('somewhere/else/horse1.NIF'), 'horse1.nif');
});

test('MW-D40: makeLooseArchive speaks the archive duck - case- and slash-insensitive', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const arc = makeLooseArchive(new Map([['meshes/maxhorse/xhorse1.nif', bytes]]));
  assert.equal(arc.loose, true);
  assert.equal(arc.has('meshes/maxhorse/xhorse1.nif'), true);
  assert.equal(arc.has('Meshes\\maxhorse\\Xhorse1.NIF'), true, 'lookups normalize like BSA paths do');
  assert.equal(arc.get('MESHES/maxhorse/XHORSE1.nif'), bytes);
  assert.equal(arc.has('meshes/absent.nif'), false);
  assert.equal(arc.get('meshes/absent.nif'), null);
});

test('MW-D40: the store keeps archives by basename and loose files by canonical path, loose first', () => {
  const src = readFileSync('src/scenes/dataSource.js', 'utf8');
  // the widened accept: archives, plugins, and the loose set
  assert.match(src, /\\\.\(bsa\|esm\|esp\)\$\/i\.test\(n\) \|\| MW_LOOSE_EXT\.test\(n\)/,
    'bsa/esm/esp plus loose extensions');
  assert.match(src, /MW_LOOSE_EXT = \/\\\.\(nif\|kf\|dds\|tga\|wav\)\$\/i/, 'the loose set is exactly the mod asset kinds');
  // loose files key by the canonical path the engine asks in; archives
  // keep their basename keys so existing attaches stay valid
  assert.ok(src.includes('MW_LOOSE_EXT.test(base) ? mwLoosePath(f.webkitRelativePath || f.name) : base'),
    'the key law');
  // and the loose duck ranks BEFORE every .bsa in loadMorrowindArchives
  const load = src.slice(src.indexOf('export async function loadMorrowindArchives'));
  const looseAt = load.indexOf('makeLooseArchive(loose)');
  const bsaAt = load.indexOf('new MwBsaFile(');
  assert.ok(looseAt > 0 && bsaAt > looseAt, 'loose data files override archives - the engine\'s own load law');
});

test('MW-D40: _buffer answers registered string keys and never sends a string to the SND file', () => {
  const fake = { buffers: new Map(), snd: { getSound: () => { throw new Error('a string reached the SND reader'); } } };
  assert.equal(AudioEngine.prototype._buffer.call(fake, 'pegas:trot'), null, 'unregistered string is a missing clip');
  const buf = { duration: 1.5 };
  fake.buffers.set('pegas:trot', buf);
  assert.equal(AudioEngine.prototype._buffer.call(fake, 'pegas:trot'), buf, 'a registered buffer answers by key');
  // and with no SND mounted at all, strings still answer
  const noSnd = { buffers: new Map([['k', buf]]), snd: null };
  assert.equal(AudioEngine.prototype._buffer.call(noSnd, 'k'), buf);
  assert.equal(AudioEngine.prototype._buffer.call(noSnd, 3), null, 'integers without SND stay null');
});

test('MW-D40: registerSound decodes once, caches, and a rejected clip registers nothing', async () => {
  const calls = [];
  const fake = {
    buffers: new Map(),
    _ensureCtx() {},
    ctx: { decodeAudioData: async (ab) => { calls.push(ab.byteLength); return { duration: 2 }; } },
  };
  const bytes = new Uint8Array([82, 73, 70, 70, 0, 0]);
  assert.equal(await AudioEngine.prototype.registerSound.call(fake, 'k', bytes), true);
  assert.equal(fake.buffers.get('k').duration, 2);
  assert.equal(await AudioEngine.prototype.registerSound.call(fake, 'k', bytes), true, 'second call rides the cache');
  assert.equal(calls.length, 1, 'decoded once');
  const bad = {
    buffers: new Map(), _ensureCtx() {},
    ctx: { decodeAudioData: async () => { throw new Error('not audio'); } },
  };
  assert.equal(await AudioEngine.prototype.registerSound.call(bad, 'x', bytes), false);
  assert.equal(bad.buffers.has('x'), false, 'a rejected clip leaves no tombstone - the classic fallback stands');
});
