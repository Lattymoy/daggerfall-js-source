// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md sections 4 and 5): THE EFFECTS' OWN SOUNDS - eight clips of ours
// (tools/storefrontSfx.mjs), in DAGGER.SND's own format, the tool writing the shipped bytes; a key on the bus each, loaded
// once and played where the effect stands, a late one never; and the windows' preview sound picking the slot's clip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { CLIPS, bakeClip } from '../../tools/storefrontSfx.mjs';
import { readWav } from '../../tools/sndify.mjs';
import { STOREFRONT_SFX, loadStorefrontSound, playStorefrontSound, STOREFRONT_SFX_LATE_MS } from '../../src/systems/storefrontSounds.js';
import { previewSoundKey } from '../../src/ui/effectPreviewSound.js';
import { KILL_EFFECTS, PORTAL_SKINS } from '../../src/net/effectLaw.js';

const file = (f) => new URL(`../../public/sfx/${f}`, import.meta.url);

test('STOREFRONT the clips: a kill effect\'s and a portal skin\'s each, the season\'s tremor and hum, a key and a file of ours in DAGGER.SND\'s 11025 Hz unsigned 8-bit mono, the tool writing the shipped bytes; each between a second and two (mutants: a clip unlisted; a file the tool would not write)', () => {
  assert.deepEqual(Object.keys(STOREFRONT_SFX), [...KILL_EFFECTS.map((k) => `storefront:kill-${k}`), ...PORTAL_SKINS.map((k) => `storefront:portal-${k}`), 'storefront:season-tremor', 'storefront:season-hum']);
  assert.deepEqual(Object.values(STOREFRONT_SFX).sort(), CLIPS.map(([n]) => `${n}.wav`).sort(), 'the tool bakes what the runtime asks for');
  for (const [name] of CLIPS) {
    assert.ok(existsSync(file(`${name}.wav`)), name);
    const bytes = readFileSync(file(`${name}.wav`));
    const w = readWav(new Uint8Array(bytes));
    assert.equal(w.rate, 11025, name);
    assert.equal(w.data.length, 1, `${name}: mono`);
    assert.equal(bytes.readUInt16LE(34), 8, `${name}: 8-bit`);
    const s = w.data[0].length / 11025;
    assert.ok(s > 0.9 && s < 2.2, `${name}: ${s.toFixed(2)} s`);
    assert.deepEqual(bakeClip(name), new Uint8Array(bytes).subarray(44), `${name}: the tool writes the shipped bytes`);
  }
  const src = readFileSync(new URL('../../public/sfx/SOURCES.md', import.meta.url), 'utf8');
  for (const [name] of CLIPS) assert.ok(src.includes(`| \`${name}.wav\` |`), `${name}: its provenance row`);
});

test('STOREFRONT the bus: a clip loaded once a bus, under its key; played where the effect stands when it is loaded, when it lands if that is soon, never late; a key with no clip nothing (mutants: a clip loaded twice; a late sound played)', async () => {
  const played = [], registered = [];
  const audio = { buffers: new Map(), registerSound: async (k) => { registered.push(k); audio.buffers.set(k, {}); return true; }, play3d: (k, at) => played.push([k, at]) };
  const fetchBytes = async () => new Uint8Array(8);
  assert.equal(await loadStorefrontSound(audio, 'storefront:kill-pyre', { fetchBytes }), true);
  assert.equal(await loadStorefrontSound(audio, 'storefront:kill-pyre', { fetchBytes }), true);
  assert.deepEqual(registered, ['storefront:kill-pyre'], 'once');
  playStorefrontSound(audio, 'storefront:kill-pyre', [1, 2, 3]);
  assert.deepEqual(played, [['storefront:kill-pyre', [1, 2, 3]]]);
  assert.equal(await loadStorefrontSound(audio, 'storefront:nothing'), false);
  assert.ok(STOREFRONT_SFX_LATE_MS > 0 && STOREFRONT_SFX_LATE_MS <= 500, 'a late sound is a wrong one');
});

test('STOREFRONT the preview\'s clip: a kill effect\'s and a portal skin\'s, none for a mount look or the violet vortex (mutants: a mount ringing a kill\'s clip)', () => {
  assert.equal(previewSoundKey('kill', 'tonal'), 'storefront:kill-tonal');
  assert.equal(previewSoundKey('portal', 'aetheric'), 'storefront:portal-aetheric');
  assert.equal(previewSoundKey('portal', null), null);
  assert.equal(previewSoundKey('mount', 'warhorse'), null);
});
