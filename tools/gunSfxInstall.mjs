// THE PICKS, INSTALLED (2026-09-19).
//
// tools/freesoundPick.mjs searched; this is the curated end of it - the
// sounds that actually go in, baked to DAGGER.SND's own 11025 Hz
// unsigned 8-bit mono (tools/sndify.mjs) and written to public/sfx/
// with their provenance beside them.
//
//     NODE_USE_ENV_PROXY=1 FREESOUND_TOKEN=... node tools/freesoundPick.mjs
//     node tools/gunSfxInstall.mjs
//
// WHY THESE, out of the 108 the search turned up. The weapon is a
// brass-and-iron break-action in a world of stone corridors, and the
// bake throws away everything above ~5kHz - so the choice is made on
// three things the numbers show and the tags do not:
//
//   - A TRANSIENT THAT SURVIVES. The bake keeps a 5ms attack and blunts
//     a 200ms one into a swell. Every pick either has the crack or is
//     here for the body under one that does.
//   - A TAIL THAT DOES NOT SMEAR. The lab's reload is 1.7s and a shot
//     can follow it immediately; anything whose own reverb runs past a
//     second is capped, with a 30ms fade so the cut is not a click.
//   - DARK OVER BRIGHT. A recording whose character lives at 6kHz
//     arrives thin, because that octave is not there any more. The
//     picks sit between 900Hz and 1.8kHz of centroid, which is where
//     the classic effects sit too.
//
// EVERY PICK IS CC0, which is the only license that clears
// public/README.md's bar for what ships out of public/ without an
// attribution trail to maintain. public/sfx/SOURCES.md is written from
// the search report, so the provenance ships with the files.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8 } from './sndify.mjs';
import { decodeAudio, withDecoder, measure, measureLine } from './sfxBake.mjs';

const SRC = 'scratch/gun-sounds';
const OUT = 'public/sfx';

/** slot -> the picks, best first (the lab's dropdown keeps this order
 *  and opens on the first). `max` caps a tail; `peak` is the level it
 *  normalises to, set per clip so the three slots sit together. */
export const PICKS = {
  fire: [
    { id: 473846, as: 'fire-shotgun', max: 0.95, peak: 0.92, why: 'a 6ms transient - the cleanest crack in the set, and the reason it is the default' },
    { id: 427595, as: 'fire-20gauge', max: 1.10, peak: 0.92, why: 'a real 20-gauge, and the most trusted file on the site (4.7 from 116 ratings, 12k downloads)' },
    { id: 244345, as: 'fire-musket', max: 1.30, peak: 0.90, why: 'black powder - the most Elder Scrolls thing here; slow, huge, and it wants the big room' },
    { id: 773873, as: 'fire-blast', max: 0.90, peak: 0.92, why: 'short tail and a 25dB crest: the one to use if the trigger is held' },
    { id: 564480, as: 'fire-dry', max: 0.80, peak: 0.90, why: 'drier and closer - no room on it at all, for when the lab\’s own room does the work' },
  ],
  'reload-open': [
    { id: 153560, as: 'open-winchester', max: 0.70, peak: 0.86, why: 'a lever cocking: two events, hard and wooden, and it ends' },
    { id: 449614, as: 'open-rack', max: 0.55, peak: 0.86, why: 'a clean shotgun rack, dark enough to survive the bake whole' },
    { id: 679878, as: 'open-gunrack', max: 0.65, peak: 0.86, why: 'the darkest of the racks (914Hz) - the most Daggerfall-sounding of them' },
    { id: 108793, as: 'open-shell', max: 0.40, peak: 0.86, why: 'the shell itself going in, if the break should be quieter than the lock-up' },
  ],
  'reload-close': [
    { id: 383933, as: 'close-ready', max: 0.45, peak: 0.88, why: '30ms of tail and a 26dB crest: it stops dead, which is what "ready" sounds like' },
    { id: 449613, as: 'close-rack2', max: 0.55, peak: 0.88, why: 'the rack\’s second half, for a pair that matches its opening' },
    { id: 449612, as: 'close-rack3', max: 0.55, peak: 0.88, why: 'the same, a shade brighter' },
    { id: 108793, as: 'close-shell', max: 0.40, peak: 0.88, why: 'the shell home, for a break-action that closes softly' },
  ],
};

const report = existsSync(join(SRC, 'report.json'))
  ? JSON.parse(readFileSync(join(SRC, 'report.json'), 'utf8'))
  : { slots: {} };

const sourceFor = (slot, id) => {
  for (const dir of [slot, ...Object.keys(PICKS)]) {
    const d = join(SRC, dir);
    if (!existsSync(d)) continue;
    const hit = readdirSync(d).find((f) => f.startsWith(`${id}-`) && !f.endsWith('.wav'));
    if (hit) return join(d, hit);
  }
  return null;
};

const metaFor = (id) => {
  for (const list of Object.values(report.slots ?? {})) {
    const hit = list.find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
};

mkdirSync(OUT, { recursive: true });
const installed = [];
console.log('clip'.padEnd(52), 'secs'.padStart(6), 'attack'.padStart(8), 'crest'.padStart(7), 'tail'.padStart(7), 'bright'.padStart(8));
await withDecoder(async (page) => {
  for (const [slot, picks] of Object.entries(PICKS)) {
    for (const p of picks) {
      const src = sourceFor(slot, p.id);
      if (!src) { console.error(`  ! no download for ${p.id} - run tools/freesoundPick.mjs first`); continue; }
      const { rate, mono } = await decodeAudio(page, src);
      const pcm = bake(mono, rate, { peak: p.peak, maxSeconds: p.max });
      const name = `${p.as}.wav`;
      writeFileSync(join(OUT, name), writeWav8(pcm));
      const m = measure(pcm);
      console.log(measureLine(name, m));
      installed.push({ slot, name, ...p, meta: metaFor(p.id), ...m });
    }
  }
});

// The provenance ships WITH the files: a CC0 sound owes nobody an
// attribution, and a repository that cannot say where a file came from
// owes its next reader one anyway.
const lines = [
  '# public/sfx — where these came from',
  '',
  'The gun lab’s shooting and reloading sounds. Every file here is',
  '**CC0** (public domain) from [Freesound](https://freesound.org), found with',
  '`tools/freesoundPick.mjs` and baked to Daggerfall’s own format —',
  '11025 Hz unsigned 8-bit mono, DAGGER.SND’s parameters',
  '(`src/formats/sndFile.js`) — by `tools/sndify.mjs`. Re-run',
  '`tools/gunSfxInstall.mjs` to rebuild them from the same sources.',
  '',
  'The `*-synth.wav` files are ours outright: `tools/gunSfx.mjs` builds them',
  'from noise and sine through the same bake, deterministically.',
  '',
  '| file | slot | source | by | license | why |',
  '| --- | --- | --- | --- | --- | --- |',
];
for (const i of installed) {
  const m = i.meta;
  lines.push(`| \`${i.name}\` | ${i.slot} | [${m?.name ?? i.id}](${m?.url ?? `https://freesound.org/s/${i.id}/`}) | ${m?.username ?? '?'} | CC0 | ${i.why} |`);
}
// OURS, in the same table - the lab offers them in the same dropdowns,
// so a reader asking "where did this file come from" must find every
// file here, not only the ones with a link
for (const [name, slot] of [
  ['gun-fire-synth.wav', 'fire'],
  ['gun-reload-open-synth.wav', 'reload-open'],
  ['gun-reload-close-synth.wav', 'reload-close'],
]) {
  lines.push(`| \`${name}\` | ${slot} | \`tools/gunSfx.mjs\` | ours | n/a | synthesised from noise and sine, deterministically - nothing recorded, nothing to attribute |`);
}
writeFileSync(join(OUT, 'SOURCES.md'), `${lines.join('\n')}\n`);
console.log(`\n${installed.length} clips -> ${OUT}/ (+ SOURCES.md)`);
