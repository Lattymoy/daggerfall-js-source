// THE SOUNDSCAPE'S RECORDINGS, INSTALLED (SOUNDSCAPE, 2026-10-24 - bible/08-Audio/Audio.md SOUNDSCAPE).
//
// The sea's and the wild's sounds that a synthesiser does badly - a gull, a crow, a frog, a hammer on an anvil - are
// recordings: each CC0 (public domain), from OpenGameArt.org, fetched from its own page's file, decoded in Chromium
// (tools/sfxBake.mjs decodeAudio - the gun lab's door) and baked to DAGGER.SND's own 11025 Hz unsigned 8-bit mono by
// tools/sndify.mjs, as the gun lab's picks are (tools/gunSfxInstall.mjs). The rest of the soundscape is made in code
// (tools/soundscapeSfx.mjs, systems/soundscape/soundBeds.js).
//
//     node tools/soundscapeSfxInstall.mjs     # fetches into scratch/soundscape-sounds/ (gitignored), writes public/sfx/
//
// WHY THESE. Every pick is CC0 - the only license public/README.md lets ship out of public/ without an attribution
// trail - and short, dry and close: the soundscape places each in the world itself (a gull 25 to 70 m off over the
// water, a frog at the reeds), so a recording's own room or distance would be twice over. Freesound is the gun lab's
// source, and this session's network reaches OpenGameArt alone; each pick's page states CC0 and its author.
// The provenance is public/sfx/SOURCES.md's table (kept by hand: tools/gunSfxInstall.mjs's rewrite of that file is the
// gun lab's alone), and the doctrine allow-list (test/tooling/doctrine.test.js) carries a row for each file.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8 } from './sndify.mjs';
import { decodeAudio, withDecoder, measure, measureLine } from './sfxBake.mjs';
import { isMain } from './lib/isMain.mjs';

const SRC = 'scratch/soundscape-sounds';
const OUT = 'public/sfx';
const OGA = 'https://opengameart.org/sites/default/files/';

/** The pages the picks are taken from: their author and license, as each page states them. */
export const PAGES = Object.freeze({
  gulls: { url: 'https://opengameart.org/content/solo-seagull-sound-effects', title: 'Solo Seagull Sound Effects', by: 'Rango Mango', license: 'CC0' },
  crow: { url: 'https://opengameart.org/content/crow', title: 'Crow', by: 'fvcalderan', license: 'CC0' },
  frogs: { url: 'https://opengameart.org/content/frog-croaks', title: 'Frog Croaks', by: 'EZduzziteh', license: 'CC0' },
  hammer: { url: 'https://opengameart.org/content/blacksmiths-hammer', title: "Blacksmith's Hammer", by: 'VishwaJai', license: 'CC0' },
  anvil: { url: 'https://opengameart.org/content/hammer-on-anvil', title: 'Hammer on anvil', by: 'themightyglider', license: 'CC0' },
});

/** The picks: `as` the shipped name, `file` the page's file, `max` a tail's cap (s), `peak` the level baked to. */
/** AUDIT SOUNDSCAPE W12: the croaks are cut out of their takes mid-sound - each eased in over 4 ms and out over 15. */
export const FROG_EDGES = Object.freeze([0.004, 0.015]);
export const PICKS = Object.freeze([
  { as: 'sea-gull-1', page: 'gulls', file: 'Seagull%20Ambient%201.wav', max: 3.9, peak: 0.86, why: 'a herring gull\'s long call, three falling cries - the coast\'s own sound' },
  { as: 'sea-gull-2', page: 'gulls', file: 'Seagull%20Ambient%202.wav', max: 1.6, peak: 0.86, why: 'two short cries, a bird passing' },
  { as: 'sea-gull-3', page: 'gulls', file: 'Seagull%20Ambient%203.wav', max: 1.2, peak: 0.86, why: 'one cry, higher' },
  { as: 'sea-gull-4', page: 'gulls', file: 'Seagull%20Ambient%205.wav', max: 1.5, peak: 0.86, why: 'a laughing call, the one a harbour is full of' },
  { as: 'sea-gull-5', page: 'gulls', file: 'Seagull%20Ambient%206.wav', max: 1.1, peak: 0.86, why: 'a single mew' },
  { as: 'sea-gull-6', page: 'gulls', file: 'Seagull%20Big%20Ambient.wav', max: 0.6, peak: 0.86, why: 'a bigger bird\'s bark, low among the others' },
  { as: 'wild-crow-1', page: 'crow', file: 'crow_0.ogg', max: 0.7, peak: 0.84, why: 'a crow\'s caw, dry: the hills and the woods by day' },
  { as: 'wild-frog-1', page: 'frogs', file: 'croak_01_0.mp3', max: 1.1, peak: 0.82, edges: FROG_EDGES, why: 'a frog\'s croak, a marsh\'s night' },
  { as: 'wild-frog-2', page: 'frogs', file: 'croak_02.mp3', max: 0.3, peak: 0.82, edges: FROG_EDGES, why: 'a short one, for a chorus' },
  { as: 'wild-frog-3', page: 'frogs', file: 'croak_03.mp3', max: 1.35, peak: 0.82, edges: FROG_EDGES, why: 'a long rattling croak' },
  { as: 'wild-frog-4', page: 'frogs', file: 'croak_04.mp3', max: 0.65, peak: 0.82, edges: FROG_EDGES, why: 'a deeper one' },
  { as: 'town-anvil-1', page: 'hammer', file: 'blacksmithhammer.wav', max: 0.5, peak: 0.84, why: 'one hammer blow on an anvil, ringing - a smithy at work' },
  { as: 'town-anvil-2', page: 'anvil', file: 'forger_0.ogg', max: 2.5, peak: 0.84, why: 'a run of blows on an anvil, a smith\'s rhythm' },
]);

if (isMain(import.meta.url)) {
  mkdirSync(SRC, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  for (const p of PICKS) {
    const local = join(SRC, decodeURIComponent(p.file));
    if (existsSync(local)) continue;
    const r = await fetch(OGA + p.file, { headers: { 'user-agent': 'DFO-Online-sfx/1.0' } });
    if (!r.ok) throw new Error(`${p.file}: ${r.status}`);
    writeFileSync(local, new Uint8Array(await r.arrayBuffer()));
  }
  console.log('clip'.padEnd(52), 'secs'.padStart(6), 'attack'.padStart(8), 'crest'.padStart(7), 'tail'.padStart(7), 'bright'.padStart(8));
  await withDecoder(async (page) => {
    for (const p of PICKS) {
      const { rate, mono } = await decodeAudio(page, join(SRC, decodeURIComponent(p.file)));
      const pcm = bake(mono, rate, { peak: p.peak, maxSeconds: p.max, edges: p.edges ?? null });
      writeFileSync(join(OUT, `${p.as}.wav`), writeWav8(pcm));
      console.log(measureLine(`${p.as}.wav`, measure(pcm)));
    }
  });
}
