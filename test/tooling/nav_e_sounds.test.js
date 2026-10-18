// NAV-E (2026-09-28, Mac: "proper naval combat with a huge reference to assassins creed black flag ... extremely
// detailed, authentic") - THE SOUNDS: six clips synthesised and baked to DAGGER.SND's own format, registered on the
// audio bus once, and the distances every naval sound carries over open water (bible/03-World/Naval-Combat.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  NAVAL_SFX, NAVAL_SFX_FILES, NAVAL_CLASSIC, NAVAL_SOUND_RANGE, NAVAL_FIRE_LOOP, NAVAL_SINK_LOOP,
  navalSoundRange, navalSfxUrl, installNavalSounds, _resetNavalSounds,
} from '../../src/systems/naval/navalSounds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A WAV's header, read as DAGGER.SND's bake writes it. */
function wavHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(...bytes.subarray(o, o + 4));
  return {
    riff: tag(0), wave: tag(8), fmt: tag(12), format: dv.getUint16(20, true), channels: dv.getUint16(22, true),
    rate: dv.getUint32(24, true), bits: dv.getUint16(34, true), data: tag(36), dataLen: dv.getUint32(40, true),
  };
}

test('NAV-E the ten clips (AUDIT NAV1: the run-out the seventh, the ready the eighth, the sinking the ninth; COMBAT-FEEL: the whistle the tenth): one file a key, each shipped as DAGGER.SND\'s own - PCM, mono, 8-bit, 11025 Hz - whole, and on the provenance page (mutants: a key without a file, a file the bake did not make)', () => {
  const keys = Object.values(NAVAL_SFX);
  assert.deepEqual(Object.keys(NAVAL_SFX_FILES).sort(), keys.slice().sort());
  assert.equal(new Set(Object.values(NAVAL_SFX_FILES)).size, keys.length, 'one file a key');
  const sources = readFileSync(join(root, 'public/sfx/SOURCES.md'), 'utf8');
  for (const file of Object.values(NAVAL_SFX_FILES)) {
    const bytes = readFileSync(join(root, 'public/sfx', file));
    const h = wavHeader(bytes);
    assert.deepEqual([h.riff, h.wave, h.fmt, h.data], ['RIFF', 'WAVE', 'fmt ', 'data'], file);
    assert.deepEqual([h.format, h.channels, h.rate, h.bits], [1, 1, 11025, 8], `${file}: DAGGER.SND's format`);
    assert.equal(h.dataLen, bytes.length - 44, `${file}: whole`);
    assert.ok(h.dataLen > 11025 * 0.25, `${file}: a quarter second at least`);
    assert.ok(sources.includes(file), `${file}: its provenance row`);
  }
});

test('NAV-E the bake is deterministic and the gun lab\'s kit moved whole: tools/navalSfx.mjs writes the ten shipped files byte for byte, and tools/gunSfx.mjs - on the shared tools/sfxSynth.mjs now - its three as they were (mutants: an unseeded noise, the kit changed under the guns)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'navsfx-'));
  try {
    execFileSync(process.execPath, [join(root, 'tools/navalSfx.mjs')], { cwd: dir, stdio: 'pipe' });
    execFileSync(process.execPath, [join(root, 'tools/gunSfx.mjs')], { cwd: dir, stdio: 'pipe' });
    const files = [...Object.values(NAVAL_SFX_FILES), 'gun-fire-synth.wav', 'gun-reload-open-synth.wav', 'gun-reload-close-synth.wav'];
    for (const f of files) {
      assert.ok(readFileSync(join(dir, 'public/sfx', f)).equals(readFileSync(join(root, 'public/sfx', f))), `${f}: the bake's bytes`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('NAV-E the distances are a sea\'s: every naval key and every DAGGER.SND clip the host plays once carries its own range - a long gun heard across the bay, a broadside far off further, a grapnel only alongside; the fire a linear loop close by, and (AUDIT NAV1) a ship going down a linear loop heard across a fight (mutants: a range dropped to the footstep\'s, ref past max)', () => {
  const loops = [NAVAL_SFX.sinking];
  for (const key of [...Object.values(NAVAL_SFX).filter((k) => !loops.includes(k)), NAVAL_CLASSIC.splashLarge, NAVAL_CLASSIC.splashSmall, NAVAL_CLASSIC.bell, NAVAL_CLASSIC.bubbles]) {
    const r = navalSoundRange(key);
    assert.ok(r, `${key}: a range of its own`);
    assert.ok(r.refDistance > 1 && r.refDistance < r.maxDistance, `${key}: ${r.refDistance} < ${r.maxDistance}`);
  }
  const R = (k) => NAVAL_SOUND_RANGE[k];
  assert.ok(R(NAVAL_SFX.cannon).maxDistance >= 2000, 'a broadside across the bay');
  assert.ok(R(NAVAL_SFX.cannonFar).maxDistance > R(NAVAL_SFX.cannon).maxDistance);
  assert.ok(R(NAVAL_SFX.cannonFar).refDistance > R(NAVAL_SFX.cannon).refDistance);
  assert.ok(R(NAVAL_SFX.cannon).maxDistance > R(NAVAL_SFX.hit).maxDistance);
  assert.ok(R(NAVAL_SFX.grapple).maxDistance < 300, 'the hooks only alongside');
  assert.ok(R(NAVAL_SFX.ready).maxDistance <= 100, 'the gun captain\'s word at my own helm');
  assert.equal(navalSoundRange(NAVAL_CLASSIC.burning), null, 'the fire is its loop\'s own profile');
  assert.deepEqual({ ...NAVAL_FIRE_LOOP }, { refDistance: 6, maxDistance: 90, distanceModel: 'linear' });
  assert.equal(navalSoundRange(NAVAL_SFX.sinking), null, 'her going down is its loop\'s own profile');
  assert.deepEqual({ ...NAVAL_SINK_LOOP }, { refDistance: 18, maxDistance: 420, distanceModel: 'linear' });
  assert.ok(NAVAL_SINK_LOOP.maxDistance > NAVAL_FIRE_LOOP.maxDistance && NAVAL_SINK_LOOP.maxDistance < R(NAVAL_SFX.hit).maxDistance, 'a hull\'s groan: further than her fire, not a ball\'s crack');
  assert.equal(navalSoundRange('footstep'), null, 'anything else: the bus\'s default');
  assert.deepEqual(NAVAL_CLASSIC, { splashLarge: 342, splashSmall: 346, bell: 107, bubbles: 114, burning: 420 });
  assert.match(navalSfxUrl('naval-cannon.wav'), /\/sfx\/naval-cannon\.wav$/);
});

test('NAV-E the clips go on the bus once: the first sea registers all ten under their keys; a second ask is the same promise; a clip that will not load is silence, never a stopped fight; a bus without the door takes none (mutants: registered every ship, a failure thrown)', async () => {
  _resetNavalSounds();
  const registered = [];
  const audio = { registerSound: async (key, bytes) => { registered.push([key, bytes.length]); return true; } };
  const fetched = [];
  const fetchBytes = async (file) => { fetched.push(file); return new Uint8Array(file.length); };
  const p = installNavalSounds(audio, { fetchBytes });
  assert.equal(installNavalSounds(audio, { fetchBytes }), p, 'once');
  assert.equal(await p, 10);   // PIN MOVED (COMBAT-FEEL: the whistle the tenth)
  assert.deepEqual(registered.map(([k]) => k), Object.keys(NAVAL_SFX_FILES));
  assert.deepEqual(fetched, Object.values(NAVAL_SFX_FILES));
  assert.deepEqual(registered.map(([, n]) => n), Object.values(NAVAL_SFX_FILES).map((f) => f.length), 'the file\'s own bytes');
  _resetNavalSounds();
  const half = await installNavalSounds(audio, { fetchBytes: async (file) => { if (file.includes('far')) throw new Error('404'); return new Uint8Array(4); } });
  assert.equal(half, 9, 'the far broadside silent, the rest heard');   // PIN MOVED (COMBAT-FEEL)
  _resetNavalSounds();
  assert.equal(await installNavalSounds({ registerSound: async () => false }, { fetchBytes }), 0, 'refused by the bus');
  _resetNavalSounds();
  assert.equal(await installNavalSounds({}, { fetchBytes }), 0);
  assert.equal(await installNavalSounds(null), 0);
  _resetNavalSounds();
});
