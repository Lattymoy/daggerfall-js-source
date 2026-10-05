// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF8 (2026-09-30, Mac: "Continue the arc"; "XP follows your rank") -
// FISHING WITH THE NET IN THE STREAMING WORLD (bible/06-Systems/
// Professions-Arc.md 5.2, 6, 30). Fishing's KIND in the gathering host
// (scenes/gatherHost.js):
//
//   THE CAST. No node stands for it: while the pack holds a Fishing-Net
//   and the player stands in the net's water (Foraging's own test,
//   FORAGE0 6.4 - in water, swimming, or at sea), a cast stands just
//   ahead of the look, keyed `haul:<x>:<y>:<day>:<id>` - the pixel, the
//   UTC day, and twelve hex digits drawn here (net/nodeLaw.js haulKey).
//   A new key after each haul. Fishing is bounded, not witnessed: forty
//   hauls an account a day.
//   THE SCHOOLS. Two a pixel a day where the first water their spots find
//   is (nodeLaw schoolSpots), stood as the Fish item's own world picture
//   on the water (Foraging's Fish, 1605 - DFU's TEXTURE.211) -
//   never a target: a cast that lands within SCHOOL_R of one is a school's
//   haul (the act's report says which), and the prompt says where one
//   rises near.
//   THE PLAN. What E does - cast the net - or what it needs.
//   THE ACT. Foraging's checks for the net first, with its own lines; the
//   machine is systems/fishAct.js.
//   THE CATCH. The Stores keep Raw Fish; the toast names the species -
//   Deep Waters' own for the pixel's water (world/passiveFish.js
//   pickSpecies, its climate by climateToBiome), drawn from the haul's
//   key, so every answer to it names the same fish; a trophy is that
//   species' own item, into the pack once.
// ═══════════════════════════════════════════════════════════════════
import { haulKey, parseNodeKey, schoolSpots, SCHOOLS_PER_PIXEL, SCHOOL_R, pixelKey } from '../net/nodeLaw.js';
import { HAULS_PER_DAY, FISH_KEY, actBand, PEARL, storesFullIn, fullWordsIn } from '../net/professionLaw.js';
import { goodsWhere } from '../net/bagLaw.js';   // BAG1: where the haul went
import { createFishAct } from '../systems/fishAct.js';
import { FT, attributeAverage } from '../systems/foragingLaw.js';
import { foragingActRefusal, actChecksRefusal, foragingToolIn, foragingHost } from '../systems/foragingInstall.js';
import { materialCountLabel } from '../systems/profItems.js';
import { liveStat, maxFatigue } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { PASSIVE_FISH_SPECIES, pickSpecies } from '../world/passiveFish.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { groundAt } from '../world/terrainNature.js';
import { isOutdoorWaterTile } from '../world/terrainSurface.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';
import { TERRAIN_SIZE } from '../world/terrainSampler.js';

/** The cast stands this far ahead of the look (m), and is reached from this far. */
export const CAST_AHEAD_M = 3;
export const CAST_REACH_M = 6;
/** CAST-LOOK (FIELD BUGS 2026-10-01 audit): the cast stands where the look crosses CAST_AHEAD_M ahead, held within this
 *  many metres over or under the eye - it stood 0.6 m under it whatever the look, so it left the 12-degree cone a degree
 *  over the level: looking out over the water there was no prompt, E went to the door behind, and the net's Use told an
 *  angler in the water to "stand in it". */
export const CAST_RISE_M = 4.5;
/** The prompt says a school rises within this far of the angler (m). */
export const SCHOOL_SAID_M = 40;
/** A school's flats: three of its species' fish, small, a metre apart on the water. */
export const SCHOOL_FLATS = 3;
export const SCHOOL_SCALE = 0.5;
/** NODE-MARKS: a school's glow on the water about its first fish (m) - its three a metre apart, low. */
export const SCHOOL_MARK = Object.freeze({ w: 4.4, h: 0.8 });
/** A school's picture: Foraging's Fish item's own world picture (1605's template - DFU's TEXTURE.211, record 9), as an
 *  herb patch stands its plant's. FOUND: not Deep Waters' fish - the port draws those from the mod's own pictures, and
 *  their records in DFU's TEXTURE.216 are other things. */
export const SCHOOL_PICTURE = Object.freeze([211, 9]);
const schoolPicture = () => { const t = templateByIndex(FT.Fish); return t?.worldTextureArchive ? [t.worldTextureArchive, t.worldTextureRecord ?? 0] : SCHOOL_PICTURE; };
/** The net's own words where the cast stands but the ground refuses it (the prompt's; the act says Foraging's lines).
 *  ANY-HOUR (2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"): never the
 *  hour - the fish bite by night as by day (foragingInstall.js foragingActRefusal). */
export const NET_WHERE = Object.freeze(['inside', 'town']);
export const NET_WHERE_WORDS = Object.freeze({ inside: 'not in here', town: 'not in a settlement' });
/** FISH-TIRED (FIELD BUGS 2026-09-30b: "you can get instakilled when fishing"). The minute's band charges an angler
 *  treading water the swim's price, 8 or 33 fatigue every five real seconds (systems/worldTick.js; FATIGUE-IDLE spares
 *  dry ground only), and in the water a collapse was DFU's death whatever the health - now a tenth of the health a game
 *  minute (SWIM-SPENT, systems/rest.js exhaustionOutcome). Either way no net is cast in the water on the last quarter of
 *  the fatigue bar, and an act there ends when the bar falls into it: the prompt says why, with minutes left to swim out
 *  and rest. */
export const NET_TIRED_SHARE = 0.25;
export const NET_TIRED_WORDS = 'too tired to fish in the water - get out and rest';
/** Whether the angler swims (the collapse's own test, PlayerEnterExit.IsPlayerSwimming, as Foraging's world answers it)
 *  on the last quarter of the fatigue pool. */
export function tooTiredForTheWater(entity) {
  if (!entity || !foragingHost()?.world?.()?.swimming) return false;
  return (entity.fatigue ?? 0) < maxFatigue(entity) * NET_TIRED_SHARE;
}

/** Twelve hex digits for a haul's key (the service reads them as the haul's name, nothing more). */
export function haulId(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}
/** A seeded draw from a key: the same key, the same fish (mulberry32 over the key's FNV-1a). */
export function keyRng(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** THE SPECIES a haul names: Deep Waters' draw for the pixel's water (its climate by climateToBiome), half-way down the
 *  water column, from the haul's own key. */
export const speciesOfHaul = (key, climate) => pickSpecies(PASSIVE_FISH_SPECIES, Number(climate) || 0, 0.5, keyRng(String(key)));

/** A haul's goods in one line (GATHER-SAID): the species named, as Raw Fish - "+2 Largemouth Bass, as Raw Fish, a Pearl
 *  and Slaughterfish Scales to your Stores". */
export function haulLine(d, species) {
  const n = Number(d.qty) || 1;
  // a fish's name is its plural too ("2 Largemouth Bass", "2 Mackerel"), as Raw Fish's is
  const fish = species ? `${n} ${species.itemName}, as ${materialCountLabel(FISH_KEY, n)}` : `${n} ${materialCountLabel(FISH_KEY, n)}`;
  const goods = [fish];
  if (d.gem) goods.push(d.gem === PEARL.key ? 'a Pearl' : `a ${materialCountLabel(d.gem, 1)}`);
  if (d.extra) goods.push(materialCountLabel(d.extra, Number(d.extraQty) || 1));
  const said = goods.length > 1 ? `${goods.slice(0, -1).join(', ')} and ${goods[goods.length - 1]}` : goods[0];
  return `+${said} ${goodsWhere(d)}`;   // BAG1: the bag, the pack, or an older book's Stores
}

/**
 * WHAT E DOES AT THE WATER, and the prompt that says it: `{ harvest, verb, rest, ready }` - `ready` false with `rest`
 * naming what is missing (the ground the net never works, the account's day, the Stores' room). `school` - a school's
 * words (where one rises near), said beside a ready cast.
 * @param {{ taken: boolean, counting: boolean, hauls: number, cap?: number, rank: number, storesFull: boolean,
 *   where?: string|null, school?: string, fullWords?: string }} o
 */
export function fishPlan({ taken, counting, hauls, cap = HAULS_PER_DAY, rank, storesFull, where = null, school = '', fullWords = 'Stores full' }) {   // BAG1: `fullWords` the book's (professionLaw fullWordsIn)
  const harvest = 'fish';
  const verb = 'Cast the net';
  if (taken || counting) return { harvest, verb, rest: 'being counted', ready: false };
  if (where) return { harvest, verb, rest: where, ready: false };
  if (hauls >= cap) return { harvest, verb, rest: `Fishing ${rank} - ${hauls} of ${cap} hauls today`, ready: false, full: true };
  if (storesFull) return { harvest, verb, rest: `${fullWords} - ${materialCountLabel(FISH_KEY, 2)}`, ready: false };
  return { harvest, verb, rest: `Fishing ${rank}${school ? ` - ${school}` : ''}`, ready: true };
}

/** CAST-LOOK: where the cast stands for an eye - CAST_AHEAD_M ahead along the look's bearing, at the height the look
 *  crosses there (held within CAST_RISE_M of the eye). @param {{ pos: ArrayLike<number>, dir: ArrayLike<number> }} eye */
export function castAt({ pos, dir }) {
  const l = Math.hypot(dir[0], dir[2]);
  if (!(l > 1e-6)) return [pos[0], pos[1] + (dir[1] > 0 ? CAST_RISE_M : -CAST_RISE_M), pos[2]];   // straight up or down: no bearing, on the look
  const rise = Math.max(-CAST_RISE_M, Math.min(CAST_RISE_M, (dir[1] / l) * CAST_AHEAD_M));
  return [pos[0] + (dir[0] / l) * CAST_AHEAD_M, pos[1] + rise, pos[2] + (dir[2] / l) * CAST_AHEAD_M];
}

/** A bearing's word, from the angler to a school (scene XZ: +x east, +z north). */
export function bearingWord(dx, dz) {
  const words = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = (Math.atan2(dx, dz) * 180) / Math.PI;
  return words[((Math.round(a / 45) % 8) + 8) % 8];
}

/**
 * A PIXEL'S SCHOOLS AS THE CLIENT STANDS THEM: each of the day's two at the first of its spots on a water tile -
 * `{ key, k, local }`, `local` pixel-local metres on the ground there (the water's own floor, as the tile is laid).
 * @param {{ px: number, py: number, day: number, samples: Float32Array, tilemap: Uint8Array }} p
 */
export function standSchools({ px, py, day, samples, tilemap }) {
  const out = [];
  if (!samples || !tilemap) return out;
  const scale = TERRAIN_SIZE / WORLD_MAP_TILE_DIM;
  for (let k = 0; k < SCHOOLS_PER_PIXEL; k++) {
    for (const { u, v } of schoolSpots(px, py, day, k)) {
      const tx = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(u * WORLD_MAP_TILE_DIM));
      const ty = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(v * WORLD_MAP_TILE_DIM));
      if (!isOutdoorWaterTile(tilemap[ty * WORLD_MAP_TILE_DIM + tx])) continue;
      const x = (tx + 0.5) * scale, z = (ty + 0.5) * scale;
      out.push({ key: `school:${px}:${py}:${day}:${k}`, k, school: true, local: [x, groundAt(samples, x, z), z] });
      break;
    }
  }
  return out;
}

/**
 * FISHING'S KIND in the gathering host.
 * @param {{ book: any, host: {
 *   pixel: () => ({ x: number, y: number }|null), ground: () => ({ climate: number, region: number }|null),
 *   eye: () => ({ pos: number[], dir: number[] }), feet: () => number[], hour: () => number, storm: () => boolean,
 *   climateAt: (x: number, y: number) => number|null, trophy: (species: any) => boolean,
 *   day: () => number, rand?: () => number, tug?: () => void, busy?: () => boolean,
 *   waterAt?: (pos: ArrayLike<number>) => boolean|null } }} deps `tug` - the floats dip (the
 *   touch layer's buzz); `busy` - the hands are the ship's (HELM-NET: at a helm, the guns laid, a boarding): no cast;
 *   `waterAt` - whether a scene point is over water the feet would swim in, null where the ground is not built
 *   (FIELD BUGS 2026-10-05 SHORE-CAST)
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function fishKind({ book, host }) {
  const rand = host.rand ?? Math.random;
  /** the cast's key now: minted anew at a new pixel, a new day, or once its haul is asked */
  let cast = /** @type {{ key: string, x: number, y: number, day: number }|null} */ (null);
  /** pixel key -> { entry, nodes } - the schools as the host stood them; and the host's translation, each frame */
  const schools = new Map();
  let translation = /** @type {((e: any) => number[]|null)|null} */ (null);
  /** the trophies put in the pack, by haul - once each, however many answers say it */
  const trophied = new Set();
  /** the climate each cast was made on, by key - its species' water */
  const climates = new Map();
  /** FISH-TIRED: the act this kind started and its angler - ended when the pool falls under the line in the water */
  let live = /** @type {{ act: any, entity: any }|null} */ (null);

  function castNow() {
    const px = host.pixel();
    const day = host.day();
    if (!px) return null;
    if (!cast || cast.x !== px.x || cast.y !== px.y || cast.day !== day || book.taken(cast.key, 'fish') || book.counting(cast.key, 'fish')) {
      const id = haulId(rand);
      cast = { key: haulKey({ x: px.x, y: px.y, day, id }), x: px.x, y: px.y, day };
    }
    return cast;
  }
  const inWater = () => actChecksRefusal(['water'], { water: 'no water' }) === null;
  /** The day's schools where they stand now (scene XZ), each with its pixel's own key. */
  function schoolPlaces() {
    const out = [];
    if (!translation) return out;
    for (const { entry, nodes } of schools.values()) {
      const tr = translation(entry);
      if (!tr) continue;
      for (const n of nodes) out.push({ k: n.k, x: n.local[0] + tr[0], z: n.local[2] + tr[2] });
    }
    return out;
  }
  /** Which school a cast of `m` metres along the look lands in, or null. */
  function schoolAt(m) {
    const { pos, dir } = host.eye();
    const l = Math.hypot(dir[0], dir[2]) || 1;
    const at = [pos[0] + (dir[0] / l) * m, pos[2] + (dir[2] / l) * m];
    for (const s of schoolPlaces()) if (Math.hypot(s.x - at[0], s.z - at[1]) <= SCHOOL_R) return /** @type {0|1} */ (s.k);
    return null;
  }
  /** Where a school rises near the angler, in words, or ''. */
  function schoolWords() {
    const f = host.feet();
    let best = null, bestD = SCHOOL_SAID_M;
    for (const s of schoolPlaces()) {
      const d = Math.hypot(s.x - f[0], s.z - f[2]);
      if (d <= bestD) { bestD = d; best = s; }
    }
    return best ? `a school rises ${Math.round(bestD)} m ${bearingWord(best.x - f[0], best.z - f[2])}` : '';
  }
  /** The climate a haul was cast on (its key's pixel's, where this client did not cast it). */
  const climateOf = (key) => climates.get(key) ?? (() => { const n = parseNodeKey(key); return n?.kind === 'haul' ? host.climateAt(n.x, n.y) : null; })();

  return {
    id: 'haul',
    professions: Object.freeze(['fishing']),
    /** The day's schools: the fish's own flats, never a target (gone to the look, stood by goneFlatsOf). */
    nodesOf: ({ entry, px, py, day }) => standSchools({ px, py, day, samples: entry.samples, tilemap: entry.tilemap }),
    stood(entry, nodes) { schools.set(pixelKey(entry.px, entry.py), { entry, nodes }); },
    flatsOf: () => [],
    goneFlatsOf: (n) => (n.school ? [{
      archive: schoolPicture()[0], record: schoolPicture()[1], scale: SCHOOL_SCALE,
      centers: Array.from({ length: SCHOOL_FLATS }, (_, i) => [n.local[0] + Math.cos(i * 2.1 + n.k) * i, n.local[1] + 0.3, n.local[2] + Math.sin(i * 2.1 + n.k) * i]),
    }] : []),
    /** The cast: one, just ahead of the look, while the pack holds a net and the player stands in the net's water. */
    looseNodesOf: ({ entity, dungeon }) => {
      // HELM-NET (FIELD BUGS 2026-10-02, "New fishing context pop up clashes with come sail away!"): at sea the net's
      // water is everywhere, so the cast stood under the crosshair at the helm and over the guns' aim; while the hands
      // are the ship's (the helm, the guns laid, a boarding) there is no cast - a deck stood on still fishes
      if (dungeon || host.busy?.() || !foragingToolIn(entity, FT.FishingNet) || !inWater()) return [];
      // SHORE-CAST (FIELD BUGS 2026-10-05, Discord: "The sea level hitbox is too high in some places", Westhead Moor's
      // beach - "Open Water" under a crosshair on the sand): the net's law above is the ANGLER's - the Ocean's region
      // (31, a whole 819 m pixel, POLITIC.PAK never dilated) or a shore record's whole tile - so its cast stood on dry
      // beach 10 m and more from the water. The cast's own point must be over water the player would swim in
      // (`host.waterAt`: true, false, or null for ground not built - unknown is not refused). Not once the net is
      // thrown: the gather host ends the act when its node goes, and a look swung onto the bank is no reason to lose
      // the haul - but while E is held to WIND the net is not yet thrown, and a look turned onto the sand is a cast
      // onto the sand (AUDIT FB1005 W3).
      const acting = !!live && !live.act.state.done && !live.act.state.cancelled && live.act.state.phase !== 'wind';
      if (!acting && host.waterAt?.(castAt(host.eye())) === false) return [];
      const c = castNow();
      if (!c) return [];
      // CAST-LOOK: on the look at its distance ahead, at any pitch to CAST_RISE_M - and the look itself, so a node in the
      // cone (an herb on the bank) is the target before it
      return [{ key: c.key, at: () => castAt(host.eye()), lift: 0, reach: CAST_REACH_M, yields: true }];
    },
    /** A school is never a target; the cast is gone once its haul is asked (a new one stands). */
    gone: (n) => !!n.school || book.taken(n.key, 'fish'),
    /** NODE-MARKS: the day's schools are Fishing's marks - where the fish are; the cast (the look itself) none. */
    mark: (n) => (n.school ? SCHOOL_MARK : null),
    /** TOOL-USE: the Fishing-Net's Use at the cast is E there - a tap of it: no wind held, the net flies its shortest,
     *  and E (or attack) takes the tug. */
    tools: Object.freeze([FT.FishingNet]),
    frame(_dt, { translation: t }) {
      translation = t;
      if (live && !live.act.state.done && tooTiredForTheWater(live.entity)) { live.act.cancel(); live = null; }   // FISH-TIRED
    },
    /** PROF-MENU: the menu's title - the water the net is cast on. */
    nodeName: () => 'Open Water',
    plan(n, { rank, entity }) {
      const plan = fishPlan({
        taken: book.taken(n.key, 'fish'), counting: book.counting(n.key, 'fish'), hauls: book.state.hauls ?? 0, cap: book.state.caps?.hauls ?? HAULS_PER_DAY,
        rank: rank('fishing'), storesFull: storesFullIn(book, FISH_KEY) /* STORES-ROOM: every origin, as the service counts */, fullWords: fullWordsIn(book), where: actChecksRefusal(NET_WHERE, NET_WHERE_WORDS) ?? (tooTiredForTheWater(entity) ? NET_TIRED_WORDS : null), school: schoolWords(),
      });
      return { ...plan, profession: 'fishing' };
    },
    start(n, plan, { entity, rank, specs, keyLabel }) {
      const refusal = foragingActRefusal(FT.FishingNet);
      if (refusal) return { refused: refusal };
      const g = host.ground();
      const parsed = parseNodeKey(n.key);
      if (!g || parsed?.kind !== 'haul') return { refused: 'There is no water here to fish.' };
      climates.set(n.key, g.climate);
      const act = createFishAct({
        rank: rank('fishing'), angler: specs('fishing')[50] === 'angler', hour: host.hour(), storm: host.storm(),
        band: actBand(attributeAverage(liveStat(entity, 'intelligence'), liveStat(entity, 'agility'))),   // FORAGE0 14.4: the net's pair (fishingCount's)
        gentle: getPref('gentleActs') === true, schoolAt, onTug: host.tug ?? null,
      });
      live = { act, entity };   // FISH-TIRED
      return {
        act,
        harvest: plan.harvest, tool: foragingToolIn(entity, FT.FishingNet), profession: 'fishing', label: keyLabel('Interact'),
        ask: { climate: g.climate, region: g.region },   // the cast's own ground: a loose node names none (AUDIT 32 H9)
        material: FISH_KEY,   // AUDIT BAG1 B4: a haul is fish, for the held count
        hand: () => null,
      };
    },
    /** The account's day, as the chip says it: its hauls against the day's forty. */
    tally: () => ({ n: book.state.hauls ?? 0, cap: book.state.caps?.hauls ?? HAULS_PER_DAY }),
    cleanNote: () => ' (a full net)',
    actNote: (rep) => {
      if (!rep) return '';
      if (rep.clean) return ' (a full net)';
      if (rep.why === 'missed') return ' (the tug missed - a plain haul)';
      if (rep.why === 'slipped') return ' (the net slipped - a plain haul)';
      if (rep.why === 'slow') return ' (hauled in slowly - a plain haul)';
      return '';
    },
    /** The goods, the species named. */
    storesLine: (d) => haulLine(d, speciesOfHaul(d.node, climateOf(d.node))),
    haulName: (d) => speciesOfHaul(d.node, climateOf(d.node))?.itemName ?? null,   // HAUL-CARDS: the catch's species on its card, the Raw Fish its sub
    /** A trophy: the species' own item, into the pack once (every answer to the haul says it). */
    answered(d, toast) {
      if (!d?.trophy || trophied.has(d.node)) return;
      trophied.add(d.node);
      const species = speciesOfHaul(d.node, climateOf(d.node));
      if (species && host.trophy(species)) toast(`A trophy ${species.itemName} - it is in your pack.`);
    },
    title: () => 'Angler',
  };
}
