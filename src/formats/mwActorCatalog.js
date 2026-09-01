// NPC1: THE ACTOR CATALOG - the Morrowind records every actor build
// reads, in ONE home, walked once per attached data set.
//
// WHY IT EXISTS. buildFpArm carried this preamble inline because the
// player was the only actor that had a Morrowind body. The enhanced
// NPC lane changes that: a town is thirty actors, and thirty copies of
// "open the archives, walk every .esm five ways" is the shape of a
// port that stops running. The records do not differ between actors -
// only which of them an actor uses does - so the walk belongs to the
// DATA, and the choosing belongs to the actor.
//
// It is also the MW7 law. Two ports of one rule drift apart; the beast
// flag, the load order and the memo gate are rules, and they now have
// one home instead of one per caller.
//
// WHAT IS PER-DATA (here): the archives, the .esm bytes, and the five
// record walks - body parts, armor, clothing, weapons, races - plus
// rule 32(a)'s GMST.
// WHAT IS PER-ACTOR (not here): which race, which sex, which outfit,
// which skeleton. Those compose against this, per actor, in
// characters/mwActorBody.js.
import {
  bodyParts, weaponRecords, gmstValue, GMST_SNEAK_DELTA,
  raceRecords, armorRecords, clothingRecords,
} from './mwFirstPerson.js';

/**
 * THE ESM WALK MEMO, moved here with the walks it serves (IG2).
 *
 * Keyed on the store's generation stamp, so a re-attached archive is a
 * fresh walk and never a stale one. IG2 routed the race, GMST and
 * weapon scans through it too: with the body following the equip
 * table, every swap re-walked tens of megabytes of .esm five ways.
 */
export const ESM_WALK_CACHE = new Map();

/** The built catalogs, one per data generation. A null generation (a
 *  test's deps) is NEVER cached - see the memo gate below. */
const CATALOG_CACHE = new Map();

/**
 * The walk memo's gate, stated once.
 *
 * No generation (a test's deps) = no memo: two fixtures of the same
 * name AND length but different bytes are an everyday test
 * arrangement, and the byteLength fingerprint cannot tell them apart -
 * the mSpeed pin proved it the day the weapon walk joined this memo.
 */
export function memoWalk(gen, e, kind, fn) {
  if (gen === null) return fn(e.bytes);
  const key = `${gen}:${e.name}:${e.bytes.byteLength}:${kind}`;
  let hit = ESM_WALK_CACHE.get(key);
  if (hit === undefined) { hit = fn(e.bytes); ESM_WALK_CACHE.set(key, hit); }
  return hit;
}

/**
 * Open the attached data and walk every record set an actor build
 * needs. Refuses in words with a named stage, exactly as buildFpArm
 * does - a caller that cannot read the data must be able to say which
 * door was shut.
 *
 * @returns {Promise<{ok:true, gen, archives, esmBytes, esmNames, find,
 *   parts, armors, clothes, weapons, sneakDelta}
 *   | {ok:false, stage:string, error:string}>}
 */
export async function mwActorCatalog(deps = null) {
  const d = deps || await import('../scenes/dataSource.js');
  const gen = typeof d.morrowindDataGeneration === 'function' ? d.morrowindDataGeneration() : null;
  if (gen !== null) {
    const hit = CATALOG_CACHE.get(gen);
    if (hit) return hit;
  }

  const archives = await d.loadMorrowindArchives();
  if (!archives.length) return { ok: false, stage: 'data', error: 'no Morrowind .bsa attached' };

  // EVERY .esm, not the first one. An expansion carries no base-race
  // BODY records, so if Tribunal.esm or Bloodmoon.esm sorted ahead of
  // Morrowind.esm every slot came back "no record for this actor".
  // Reading all of them is also what the engine does - later masters
  // add to and override earlier ones - so this is the load order
  // rather than a workaround for it.
  const esmNames = (await d.storedMorrowindNames()).filter((n) => /\.esm$/i.test(n));
  if (!esmNames.length) {
    return { ok: false, stage: 'data', error: 'no Morrowind .esm attached - the body records live there, not in the .bsa' };
  }
  const esmBytes = [];
  for (const n of esmNames) esmBytes.push({ name: n, bytes: await d.loadMorrowindFile(n) });

  const walk = (e, kind, fn) => memoWalk(gen, e, kind, fn);
  // bodyParts(), not loadMorrowindEsm(). The store's parseEsm door
  // returns mwEsmFile's body shape; armReport wants bodyParts' shape;
  // there is no adapter and writing one by guess is how MW7 died.
  const parts = esmBytes.flatMap((e) => walk(e, 'parts', bodyParts));
  // MW-D29/D30: ARMO and CLOT ride the same walk, load order and all.
  const armors = esmBytes.flatMap((e) => walk(e, 'armors', armorRecords));
  const clothes = esmBytes.flatMap((e) => walk(e, 'clothes', clothingRecords));
  const weapons = esmBytes.flatMap((e) => walk(e, 'weapons', weaponRecords));
  // RULE 32(a)'s GMST, read from the player's own data. Later masters
  // override earlier ones, so the LAST .esm that carries it wins -
  // which is the load order, not a preference.
  let sneakDelta = null;
  for (const e of esmBytes) {
    const g = walk(e, 'gmst-sneak', (b) => ({ v: gmstValue(b, GMST_SNEAK_DELTA) }));
    if (typeof g.v === 'number') sneakDelta = g.v;
  }

  const out = {
    ok: true, gen, archives, esmBytes, esmNames,
    find: (p) => archives.find((a) => a.has(p)),
    parts, armors, clothes, weapons, sneakDelta,
  };
  if (gen !== null) CATALOG_CACHE.set(gen, out);
  return out;
}

/**
 * The RACE record's two answers, both read off the memoised walk.
 *
 * AUDIT MW-A F1: BEAST COMES FROM THE DATA. The skeleton switch and
 * the tail row both read this flag, and no production caller ever set
 * it - an Argonian built on the human skeleton with the tail silently
 * skipped. The RACE record's own RADT bit decides, last esm wins (load
 * order); an explicit override still wins over both, which is what the
 * fixtures use.
 *
 * MW-D34: Npc::adjustScale (npc.cpp:1102-1136) - the RADT carries
 * per-gender height and weight, and the rendered body scales x,y by
 * WEIGHT and z by HEIGHT (:1124-1135). Last .esm wins, the load order
 * as everywhere else.
 */
export function catalogRace(catalog, race, female, beastOverride = null) {
  const raceKey = String(race || '').toLowerCase();
  let beast = beastOverride === null ? false : beastOverride;
  let raceScale = { weight: 1, height: 1 };
  for (const e of catalog.esmBytes) {
    const rrec = memoWalk(catalog.gen, e, 'races', raceRecords).get(raceKey);
    if (!rrec || !rrec.radt) continue;
    if (beastOverride === null) beast = rrec.beast;   // raceBeastFlag's own rule, off the memo
    raceScale = { weight: rrec.weight[female ? 1 : 0], height: rrec.height[female ? 1 : 0] };
  }
  return { beast, raceScale };
}

/** Test seam: forget every walked catalog so the next call re-reads. */
export function _resetActorCatalogForTests() {
  CATALOG_CACHE.clear();
  ESM_WALK_CACHE.clear();
}
