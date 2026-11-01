#!/usr/bin/env node
// DELVE II CENSUS (bible/03-World/Delve-II.md section 4): where the site law stands a dungeon's encounters, on the real
// game files - the host's models (seams patched), the host's collider buckets and the fire plan the host stands first, so
// the sites it reports are the ones the game would. Gated on the game data, as every real-data check is:
//
//   ARENA2_PATH=/path/to/arena2 node tools/delveSiteProbe.mjs "Daggerfall" "Castle Kingwing"   one dungeon, its sites
//   ARENA2_PATH=/path/to/arena2 node tools/delveSiteProbe.mjs --all [--shard 0/4] [--json out.json]   every dungeon
// The census: the dungeons read, the sites wanted and stood (and how many in a small room), how many stood none, and every
// refused spot's broken rule, each pass's.
import { writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { loadData } from './climbDungeonProbe.mjs';
import { hostModelReader, hostFireCollider, layoutHearths, hostFlatSize } from './dungeonFireProbe.mjs';
import { layoutDungeon } from '../src/world/dungeon/dungeonLayout.js';
import { colliderFireProbe, dungeonFirePlan, fireLayoutInputs } from '../src/world/dungeon/dungeonFires.js';
import { colliderSiteProbe, delveSitePlan, delveSiteCount } from '../src/world/dungeon/delveSites.js';

/** The Hold stands no site (the tutorial - Delve-II.md section 11); the caller's word, as the host's will be. */
export const NO_SITES = Object.freeze(["Privateer's Hold"]);

/** One dungeon: its fires as the host stands them (its hearths' feet off the classic record - `sizeOf`, hostFlatSize), then
 *  its sites. `tally` gathers the refused spots' rules. */
export function probeSites(blocks, getModel, { seed = 0, name = '', tally = null, sizeOf = () => null } = {}) {
  const col = hostFireCollider(blocks, getModel);
  const { doors, existing } = fireLayoutInputs(blocks, layoutHearths(blocks, sizeOf));
  const firePlan = dungeonFirePlan({ blocks, probe: colliderFireProbe(col), doors, existing, seed });
  const fires = [...existing, ...firePlan.fires, ...(firePlan.doorFire ? [firePlan.doorFire] : [])];
  const none = NO_SITES.includes(name);
  const plan = delveSitePlan({ blocks, probe: colliderSiteProbe(col), doors, fires, seed, none, tally });
  return { wanted: none ? 0 : delveSiteCount(blocks), ...plan };
}

/** Every dungeon of the game's own locations: `[region, location, name]`, in MAPS order. */
export function everyDungeon(maps) {
  const out = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    const base = maps.baseLocationCount(r);
    for (let l = 0; l < Math.min(base, region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (loc?.hasDungeon) out.push([r, l, loc.name ?? '']);
    }
  }
  return out;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) {
    console.error('ARENA2_PATH is not set');
    process.exit(2);
  }
  const data = loadData(arena2);
  const getModel = hostModelReader(data.arch);
  const sizeOf = hostFlatSize(arena2);
  const shardArg = argv[argv.indexOf('--shard') + 1];
  const [si, sn] = argv.includes('--shard') ? shardArg.split('/').map(Number) : [0, 1];
  const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
  const list = argv.includes('--all')
    ? everyDungeon(data.maps).filter((_, k) => k % sn === si)
    : [[data.maps.getRegionIndex(argv[0]), null, argv[1]]];
  const tally = {},
    rows = [];
  const t0 = Date.now();
  let wanted = 0,
    stood = 0,
    small = 0,
    short = 0,
    empty = 0;
  for (const [r, l, name] of list) {
    const loc = l == null ? data.maps.getLocationByName(argv[0], name) : data.maps.getLocation(r, l);
    if (!loc?.hasDungeon) {
      console.log(`${name}: no dungeon`);
      continue;
    }
    let out;
    try {
      const { blocks } = layoutDungeon(loc, data.blocks, getModel);
      out = probeSites(blocks, getModel, {
        seed: loc.dungeon.recordElement.header.locationId,
        name: loc.name,
        tally,
        sizeOf,
      });
    } catch (e) {
      console.log(`${data.maps.getRegionName(loc.regionIndex)} / ${loc.name}: not measured - ${e?.message ?? e}`);
      continue;
    }
    wanted += out.wanted;
    stood += out.sites.length;
    small += out.small;
    if (out.sites.length < out.wanted) short++;
    if (out.wanted && !out.sites.length) empty++;
    rows.push({
      region: data.maps.getRegionName(loc.regionIndex),
      name: loc.name,
      wanted: out.wanted,
      candidates: out.candidates,
      valid: out.valid,
      small: out.small,
      sites: out.sites,
    });
    if (list.length === 1) {
      console.log(
        `${rows[0].region} / ${loc.name}: wanted ${out.wanted}, candidates ${out.candidates}, valid ${out.valid}, sites ${out.sites.length} (${out.small} in a small room)`,
      );
      for (const s of out.sites)
        console.log(`  ${s.i} ${s.kind} [${s.x}, ${s.y}, ${s.z}] r ${s.r} vault [${s.vault.join(', ')}]`);
    }
  }
  if (list.length > 1) {
    const rules = (t) =>
      Object.entries(t ?? {})
        .filter(([k]) => k !== 'small')
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
    console.log(
      `${rows.length} dungeons in ${((Date.now() - t0) / 1000).toFixed(0)} s: sites wanted ${wanted}, stood ${stood} (${small} in a small room); ${short} short, ${empty} with none`,
    );
    console.log(`refused spots by rule: ${rules(tally)}`);
    console.log(`refused in the small pass: ${rules(tally.small)}`);
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ rows, tally }));
}
