// FREESOUND, FOR THE GUN LAB (Mac, 2026-09-19: "comprehensively find
// some great sounds to fit in for shooting and reloading. Needs to
// match the daggerfall aesthetic").
//
// THE AESTHETIC IS NOT A SEARCH TERM. Daggerfall's effects are raw
// unsigned 8-bit mono at 11025 Hz (src/formats/sndFile.js:3) and that
// is what the ear reads as this game - so the search looks for a good
// RECORDING and tools/sndify.mjs makes it Daggerfall's. What the
// queries below are tuned for is the weapon in the art: a big
// brass-and-iron break-action in a world of stone corridors, which
// wants black powder and a wooden mechanism, not a modern tactical
// 12-gauge.
//
// CC0 ONLY by default. Everything this finds may end up committed and
// published, and public/README.md's rule for what ships out of public/
// is that it is OURS - a CC0 sound is nobody's to be owed, which is
// the only license that clears that bar without an attribution trail.
// `--license=any` widens it for auditioning; the report always carries
// the license and the uploader so nothing ships unattributed by
// accident.
//
//     FREESOUND_TOKEN=... node tools/freesoundPick.mjs [--slot=fire]
//                                     [--license=any] [--per=12] [--no-download]
//
// The token is read from the environment and never written anywhere -
// not into the report, not into a cache file.
//
// Writes scratch/gun-sounds/<slot>/<id>-<name>.mp3 (the HQ preview,
// which is what token auth may fetch; the original needs OAuth2) and
// scratch/gun-sounds/report.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN = process.env.FREESOUND_TOKEN;
if (!TOKEN) { console.error('FREESOUND_TOKEN is not set'); process.exit(2); }

// Node's fetch (undici) ignores HTTPS_PROXY unless told to, and behind
// an egress proxy the direct attempt comes back 403 "Host not in
// allowlist" - which reads like a token problem and is not one. Said
// out loud here rather than debugged again in six months.
if (process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== '1') {
  console.error('HTTPS_PROXY is set but NODE_USE_ENV_PROXY is not - fetch would bypass the proxy and 403.');
  console.error('Re-run as:  NODE_USE_ENV_PROXY=1 FREESOUND_TOKEN=... node tools/freesoundPick.mjs');
  process.exit(2);
}

const API = 'https://freesound.org/apiv2';
const OUT = 'scratch/gun-sounds';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const flag = (k) => process.argv.includes(`--${k}`);

/** The slots the lab has, and what each one is listening for. The
 *  duration windows are the real filter: a "shotgun" search is full of
 *  eight-second montages and two-minute range sessions, and what a
 *  weapon needs is one event. */
export const SLOTS = {
  fire: {
    seconds: [0.25, 3.0],
    queries: [
      'shotgun blast', 'shotgun shot', 'double barrel shotgun', 'shotgun fire',
      '12 gauge shot', 'musket shot', 'blunderbuss', 'black powder gunshot',
      'flintlock shot', 'gunshot close', 'rifle shot echo', 'cannon small shot',
    ],
  },
  'reload-open': {
    seconds: [0.15, 2.5],
    queries: [
      'shotgun break open', 'shotgun pump', 'shotgun cock', 'break action shotgun',
      'shotgun shell eject', 'gun cocking metal', 'rifle bolt open', 'lever action',
    ],
  },
  'reload-close': {
    seconds: [0.15, 2.5],
    queries: [
      'shotgun close', 'shotgun breech close', 'shotgun shell insert', 'shotgun load shell',
      'rifle bolt close', 'gun lock metal clack', 'shotgun pump forward',
    ],
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, params) {
  const q = new URLSearchParams({ ...params, token: TOKEN });
  const res = await fetch(`${API}${path}?${q}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json();
}

const FIELDS = 'id,name,license,duration,samplerate,channels,filesize,type,username,tags,description,avg_rating,num_ratings,num_downloads,previews,url';

async function search(query, { seconds, license, per }) {
  const filters = [`duration:[${seconds[0]} TO ${seconds[1]}]`];
  if (license !== 'any') filters.push('license:"Creative Commons 0"');
  const r = await api('/search/text/', {
    query,
    filter: filters.join(' '),
    fields: FIELDS,
    sort: 'rating_desc',
    page_size: String(per),
  });
  return (r.results ?? []).map((s) => ({ ...s, query }));
}

/** What a weapon sound needs, scored off what the API already knows:
 *  people liked it, people used it, and it is one event rather than a
 *  performance. Rating is weighted by HOW MANY rated it - a lone 5 is
 *  not evidence - and short wins, because a tail can be trimmed and a
 *  missing transient cannot be put back. */
export function score(s, slot) {
  const ratings = s.num_ratings ?? 0;
  const rating = (s.avg_rating ?? 0) / 5;
  const confidence = ratings / (ratings + 6);            // a Bayesian-ish damp
  const downloads = Math.log10(1 + (s.num_downloads ?? 0)) / 5;
  const [lo, hi] = SLOTS[slot].seconds;
  const mid = lo + (hi - lo) * 0.25;                      // short end of the window
  const brevity = 1 - Math.min(1, Math.abs((s.duration ?? 0) - mid) / (hi - lo));
  const clean = /loop|music|song|ambient|montage|compilation|pack/i.test(`${s.name} ${(s.tags ?? []).join(' ')}`) ? 0.45 : 1;
  return (rating * confidence * 2.2 + downloads * 1.4 + brevity * 1.0) * clean;
}

async function run() {
  const license = arg('license', 'cc0');
  const per = Number(arg('per', 12));
  const only = arg('slot', null);
  const slots = only ? [only] : Object.keys(SLOTS);
  const report = { generated: new Date().toISOString(), license, slots: {} };

  for (const slot of slots) {
    const spec = SLOTS[slot];
    if (!spec) throw new Error(`no slot ${slot}`);
    const byId = new Map();
    for (const q of spec.queries) {
      try {
        for (const s of await search(q, { ...spec, license, per })) {
          if (!byId.has(s.id)) byId.set(s.id, s);
        }
      } catch (e) { console.error(`  ! "${q}": ${e.message}`); }
      await sleep(120);   // the API is rate limited; be a good guest
    }
    const ranked = [...byId.values()]
      .map((s) => ({ ...s, score: score(s, slot) }))
      .sort((a, b) => b.score - a.score);
    console.log(`\n${slot}: ${byId.size} distinct sounds from ${spec.queries.length} queries`);
    for (const s of ranked.slice(0, 10)) {
      console.log(`  ${String(s.score.toFixed(2)).padStart(5)}  ${String(s.id).padStart(7)}  ${s.duration.toFixed(2)}s  ${(s.avg_rating ?? 0).toFixed(1)}/${s.num_ratings ?? 0}  ${s.num_downloads} dl  ${s.name}`);
    }
    report.slots[slot] = ranked.map(({ previews, description, ...rest }) => ({
      ...rest,
      preview: previews?.['preview-hq-mp3'] ?? null,
      description: (description ?? '').slice(0, 300),
    }));

    if (!flag('no-download')) {
      const dir = join(OUT, slot);
      mkdirSync(dir, { recursive: true });
      for (const s of ranked.slice(0, Number(arg('keep', 8)))) {
        const url = s.previews?.['preview-hq-mp3'];
        if (!url) continue;
        const safe = s.name.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 48).toLowerCase();
        const res = await fetch(`${url}?token=${TOKEN}`);
        if (!res.ok) { console.error(`  ! download ${s.id}: ${res.status}`); continue; }
        writeFileSync(join(dir, `${s.id}-${safe}.mp3`), Buffer.from(await res.arrayBuffer()));
      }
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`\nreport: ${OUT}/report.json`);
}

run().catch((e) => { console.error(e); process.exit(1); });
