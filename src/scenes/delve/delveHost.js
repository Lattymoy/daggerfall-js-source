// @ts-check
// DELVE II (bible/03-World/Delve-II.md, DLV2 and DLV4; the owner, 2026-10-28: "coming upon a wave based encounter, or
// puzzle solving like you find in some of our world events"): A DUNGEON'S ENCOUNTERS, STOOD. The site law's plan made once
// as the dungeon is built (world/dungeon/delveSites.js), each site's ledger run on the player's own words, blows and acts
// (net/delve/delveLaw.js - offline the player is the whole party and the machine that stands the foes), the foes
// (delveHold.js), the plates (delveLitany.js), the pieces struck, guarded and carried (delveBodies.js), the marks and the
// chest (delvePieces.js), the new kinds' looks (delveProps.js) and the vault. scenes/dungeonContext.js wires it in a few
// lines (HOST-SPLIT). Offline alone until DLV3: online it stands nothing. Not a DFU member (Ledger A: DELVE II).
import { delveSitePlan, colliderSiteProbe } from '../../world/dungeon/delveSites.js';
import { fireLayoutInputs } from '../../world/dungeon/dungeonFires.js';
import {
  newDelveLedger, foldDelveWord, foldDelveHit, foldDelveAct, inWard, plateAt, delvePlates, delvePlanHash, DP, FLAME, WEIGHT,
  HOLD_WAVES, DELVE_WARD_PAD_M, DELVE_KIND_NAMES, DELVE_REACH_M, SPRING_POUR_MS, SPRING_ALIVE, DRIFT_MAX, DRIFT_EVERY_MS,
  VIGIL_LIGHT, isWaveKind, springSpots, springCount, brazierSpots, weightSpots, weighPlates, holdGates,
} from '../../net/delve/delveLaw.js';
import { createHoldFoes, HOLD_RANK_STEP_M } from './delveHold.js';
import { plateLooks, shownPlate, createPlateSteps, DELVE_SOUNDS } from './delveLitany.js';
import { createDelvePieces, siteShapes, DELVE_DRAW_M } from './delvePieces.js';
import { createDelveProps, pieceCrystals, siteFlames, weightPlaces, sourceLook, DELVE_PEDESTAL_MODEL, DELVE_WEIGHT_MODEL } from './delveProps.js';
import { breakTargets, createStandIns, makeRelic, createDelveCarry, delveCrystalOf, delveHuntSite } from './delveBodies.js';
import {
  DELVE_NEAR_TEXT, DELVE_HOLD_TEXT, DELVE_LITANY_TEXT, DELVE_VAULT_TEXT, DELVE_SPRINGS_TEXT, DELVE_VIGIL_TEXT, DELVE_BRAZIER_TEXT,
  DELVE_WEIGHING_TEXT, DELVE_SEALS_TEXT, DELVE_CARRY_TEXT, DELVE_PIECE_TEXT, DELVE_SAY_S, DELVE_SAY_LONG_S,
} from '../../systems/delve/delveWords.js';
import { rollVault } from '../../systems/delve/delveVault.js';
import { dungeonTier } from '../../systems/dungeon/dungeonTier.js';
import { madeLevelOf } from '../../systems/madeLevel.js';
import { isPrivateersHold } from '../../systems/startDungeon.js';
import { isArenaFloor } from '../../world/arena/arenaFloor.js';
import { chooseRandomEnemy, resolveEncounterTableIndex } from '../../systems/encounters.js';
import { encounterTableChoices } from '../../characters/encounterTableDoor.js';
import { dungeonPlace } from '../../characters/dungeonEnemies.js';
import { effectiveLevel } from '../../systems/mentorMode.js';
import { elitesAllowed } from '../../systems/eliteFoes.js';
import { getPref } from '../../systems/uiPrefs.js';
import { setMidScreenText } from '../../ui/midScreenText.js';
import { quickLootTake } from '../../systems/quickLoot.js';
import { showPickups } from '../../ui/pickupFeed.js';
import { audio } from '../../systems/audio.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../../player/activate.js';

/** The Enhanced Features row's key (systems/features.js `dungeon-encounters`); read as the dungeon is built. */
export const DELVE_PREF = 'dungeonEncounters';
/** A site's own key prefix on the ray (scenes/worldModes.js and scenes/dungeon.js send it to the context's takeLoot). */
export const DELVE_KEY = 'delve:';
/** The near line is said this far past the ward (m). */
export const DELVE_NEAR_M = 6;
/** Out of a running Hold's ward this long, the player is told to go back (ms). */
export const DELVE_AWAY_SAY_MS = 2_000;
/** A carried flame or weight is held this far before its carrier and this high (m). */
export const DELVE_CARRY_AHEAD_M = 0.55;
export const DELVE_CARRY_UP_M = 0.95;
/** The player's own account in the ledger offline. */
const ME = 'me';
const ONLY_DUNGEON = Object.freeze({ only: Object.freeze(['dungeon']) });

/** Whether a dungeon stands no site: the row off, a made level, an arena's sand, an Abyss Hollow, Privateer's Hold
 *  (section 4's None in; a palace the law's own). Pure but for the pref. */
export function delveStandsNone(location) {
  if (getPref(DELVE_PREF) === false) return true;
  return !location?.hasDungeon || madeLevelOf(location) != null || isArenaFloor(location) || dungeonTier(location) === 'super' || isPrivateersHold(location);
}

/** The kinds a dungeon can stand: a kind fought in waves only where its encounter table has foes to stand (every client
 *  reads the same choices - characters/encounterTableDoor.js). Pure but for the table door. */
export function delveKindsFor(location) {
  const idx = resolveEncounterTableIndex({ dungeonType: location?.mapTableData?.dungeonType });
  return idx != null && encounterTableChoices(idx).some((t) => t?.length) ? DELVE_KIND_NAMES : DELVE_KIND_NAMES.filter((k) => !isWaveKind(k));
}

/** A press's site, off its key (`delve:vault:<i>`), or -1. Pure. */
export const delveKeySite = (key) => {
  const m = /^delve:vault:(\d+)$/.exec(String(key ?? ''));
  return m ? Number(m[1]) : -1;
};
/** A press's weight, off its key (`delve:weight:<i>:<j>`), as `{ i, j }`, or null. Pure. */
export const delveKeyWeight = (key) => {
  const m = /^delve:weight:(\d+):(\d)$/.exec(String(key ?? ''));
  return m ? { i: Number(m[1]), j: Number(m[2]) } : null;
};

/** The line a site says as the player first comes near it (`k` its plates or sources, `look` the sources'). */
function nearLine(site, k, look) {
  switch (site.kind) {
    case 'hold': return DELVE_NEAR_TEXT.hold();
    case 'litany': return DELVE_NEAR_TEXT.litany(k);
    case 'wellsprings': return DELVE_NEAR_TEXT.springs(look, k);
    case 'vigil': return DELVE_NEAR_TEXT.vigil();
    case 'brazier': return DELVE_NEAR_TEXT.brazier();
    case 'weighing': return DELVE_NEAR_TEXT.weighing();
    default: return DELVE_NEAR_TEXT.seals();
  }
}
/** What opens a sealed vault, said on its plaque. */
function sealedLine(kind) {
  switch (kind) {
    case 'hold': return DELVE_VAULT_TEXT.sealedHold();
    case 'litany': return DELVE_VAULT_TEXT.sealedLitany();
    case 'wellsprings': return DELVE_VAULT_TEXT.sealedSprings();
    case 'vigil': return DELVE_VAULT_TEXT.sealedVigil();
    case 'brazier': return DELVE_VAULT_TEXT.sealedBrazier();
    case 'weighing': return DELVE_VAULT_TEXT.sealedWeighing();
    default: return DELVE_VAULT_TEXT.sealedSeals();
  }
}
/** The line a win says, by kind. */
function wonLine(kind) {
  switch (kind) {
    case 'hold': return DELVE_HOLD_TEXT.won();
    case 'litany': return DELVE_LITANY_TEXT.won();
    case 'wellsprings': return DELVE_SPRINGS_TEXT.won();
    case 'vigil': return DELVE_VIGIL_TEXT.won();
    case 'brazier': return DELVE_BRAZIER_TEXT.won();
    case 'weighing': return DELVE_WEIGHING_TEXT.won();
    default: return DELVE_SEALS_TEXT.won();
  }
}
/** The line an ended attempt says: the relic's light out, the sources' or the captain's time run, nobody left holding. */
function failedLine(kind, ev) {
  if (ev.dark) return DELVE_VIGIL_TEXT.dark();
  if (ev.springs) return DELVE_SPRINGS_TEXT.outlasted();
  if (ev.outlasted) return DELVE_HOLD_TEXT.outlasted();
  return kind === 'vigil' ? DELVE_VIGIL_TEXT.failed() : DELVE_HOLD_TEXT.failed();
}
/** How many bits a mask holds. Pure. */
const bits = (m) => { let n = 0; for (let v = m; v; v &= v - 1) n++; return n; };
/** A spot `m` from `p` toward the heart (a poured foe stands clear of its source). Pure. */
const toward = (site, p, m) => { const dx = site.x - p[0], dz = site.z - p[2], d = Math.hypot(dx, dz) || 1; return [p[0] + (dx / d) * m, p[1], p[2] + (dz / d) * m]; };

/**
 * THE HOST. `api` the dungeon context's own (spawnLooseFoe, removeLooseFoe, foes, collider, dynamicDraws, billboardBatches,
 * flatAnims, hudSay, openLootList, addActivationTargets, addActivationNamer); `deps` the build's (renderer, getGpuMesh,
 * cpuModels, getTexture, uploadRecord, uploadRecordFrame); `location` the dungeon's; `blocks` its layout's; `hearths` and
 * `fires` the fire plan's; `player()` the entity; `rollPile()` the dungeon's pile roll; `online()` whether it is a room's.
 * @param {{ api: any, deps?: any, location: any, blocks: any[], hearths?: any[], fires?: number[][], player?: () => any,
 *   rollPile?: () => any[], online?: () => boolean }} o
 */
export function createDelveHost({ api, deps = {}, location, blocks, hearths = [], fires = [], player = () => null, rollPile = () => [], online = () => false }) {
  const none = delveStandsNone(location);
  const seed = (location?.dungeon?.recordElement?.header?.locationId ?? 0) >>> 0;
  const tier = location?.elite === true ? 'elite' : 'regular';
  const { doors, existing } = none ? { doors: [], existing: [] } : fireLayoutInputs(blocks, hearths);
  const plan = none ? { sites: [] } : delveSitePlan({ blocks, probe: colliderSiteProbe(api.collider), doors, fires: [...existing, ...fires], seed, tier, kinds: delveKindsFor(location) });
  const hash = delvePlanHash(plan.sites);
  const pieces = createDelvePieces({ renderer: deps.renderer ?? null, meshes: deps, draws: api.dynamicDraws, collider: api.collider });
  const props = createDelveProps({
    renderer: deps.renderer ?? null, meshes: deps, draws: api.dynamicDraws, collider: api.collider,
    flats: deps.getTexture ? { getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, uploadRecordFrame: deps.uploadRecordFrame, batches: api.billboardBatches, anims: api.flatAnims } : null,
  });
  const place = location?.dungeon?.recordElement?.header ? dungeonPlace(location) : {};   // DEX3: the dungeon's own table, as its foes were rolled
  const look = sourceLook(location?.mapTableData?.dungeonType);
  const standIns = createStandIns();
  let now = 0, dead = false, chestsStood = false, hitQ = 0, lastFeet = /** @type {number[]|null} */ (null), lastYaw = 0, weapon = /** @type {any} */ (null);
  const lv = () => effectiveLevel(player());
  const foeHost = {
    spawn: (type, at, opts) => api.spawnLooseFoe(type, at, opts),
    remove: (f) => api.removeLooseFoe(f),
    pick: () => chooseRandomEnemy({ ...place, dungeonType: location?.mapTableData?.dungeonType, playerLevel: lv(), local: true }),
    elites: () => elitesAllowed({ inRoom: online() }),
    alive: () => !dead,
    foes: () => api.foes ?? [],
    now: () => now,
  };
  /** The Vigil's foes hunt their own relic before the party (huntsStar): its mark on each as it stands. */
  const hunting = (site) => ({ ...foeHost, mark: (f) => { f.starSite = delveHuntSite(site.i); } });
  const runs = plan.sites.map((site) => {
    const r = {
      site, led: /** @type {any} */ (null), won: false, vault: /** @type {any[]|null} */ (null), said: false, away: false, dark: false, rest: 0,
      foes: isWaveKind(site.kind) || site.kind === 'brazier' ? createHoldFoes(site, site.kind === 'vigil' ? hunting(site) : foeHost) : null,
      wakers: site.kind === 'litany' ? createHoldFoes(site, foeHost) : null,
      plates: site.kind === 'litany' || site.kind === 'weighing' ? delvePlates(site) : null,
      steps: site.kind === 'litany' ? createPlateSteps() : null,
      wrong: /** @type {{ j: number, at: number }|null} */ (null), shown: -1,
      // kept for the frame: the word, the fold's context, the looks, the marks and the pass's entry, filled in place
      word: /** @type {any} */ ({ lv: 1, o: 0, kw: 0, kn: 0, wc: 0, cf: 0, st: -1, hb: 0 }), ctx: { party: true, inWard: false, plate: -1, nowMs: 0 },
      looks: /** @type {number[]} */ ([]), shapes: /** @type {any[]} */ ([]), entry: /** @type {any} */ (null),
      // DLV4: the relic and its blows this attempt, each piece's breaking (s), the seals' rising (s), the pours done, the
      // last drift, the light's warning said, the crystals' list kept
      relic: /** @type {any} */ (null), hb: 0, broke: /** @type {number[]} */ ([]), rose: 0, poured: /** @type {number[]} */ ([]), driftAt: 0, lowSaid: false,
      crystals: /** @type {any[]} */ ([]),
    };
    if (site.kind === 'vigil') r.relic = makeRelic(site, () => { if (r.led && r.led.p !== DP.idle) r.hb++; });
    return r;
  });
  for (const r of runs) r.entry = { site: r.site, shapes: r.shapes };
  const list = /** @type {any[]} */ ([]), crystalList = /** @type {any[]} */ ([]);
  const say = (text, s = DELVE_SAY_S) => setMidScreenText(text, s);
  const sound = (S, site) => { try { audio.play3d?.(S.rec, [site.x, site.y + 1, site.z], S.vol, { pitch: S.pitch }); } catch { /* a sound is never the encounter's problem */ } };
  const carry = createDelveCarry({ player, weapon: () => weapon, say: (k) => { if (k === 'letGo') say(DELVE_CARRY_TEXT.letGo()); } });
  /** The piece I carry now: the flame (`j` -1) or a weight, and its run; null when my hands are empty. */
  const mine = () => {
    for (const r of runs) {
      if (!r.led || r.led.p !== DP.work) continue;
      if (r.site.kind === 'brazier' && r.led.fl === FLAME.carried && r.led.fc === ME) return { r, j: -1 };
      if (r.site.kind === 'weighing') { const j = r.led.wt.findIndex((t) => t.s === WEIGHT.carried && t.by === ME); if (j >= 0) return { r, j }; }
    }
    return null;
  };

  function onEvent(r, ev) {
    const { site } = r, kind = site.kind, left = () => (r.led?.hp ?? []).filter((h) => h > 0).length;
    switch (ev.k) {
      case 'gather':
        say(kind === 'vigil' ? DELVE_VIGIL_TEXT.gather() : kind === 'brazier' ? DELVE_BRAZIER_TEXT.gather() : kind === 'seals' ? DELVE_SEALS_TEXT.gather() : DELVE_HOLD_TEXT.gather());
        sound(DELVE_SOUNDS.wake, site); break;
      case 'wave': r.foes?.on(ev); say(DELVE_HOLD_TEXT.wave(ev.w, HOLD_WAVES)); break;
      case 'breath': say(kind === 'vigil' ? DELVE_VIGIL_TEXT.breath() : DELVE_HOLD_TEXT.breath()); break;
      case 'captain': r.foes?.on(ev); say(DELVE_HOLD_TEXT.captain()); sound(DELVE_SOUNDS.wake, site); break;
      case 'spring': r.poured = []; r.broke = []; say(DELVE_SPRINGS_TEXT.spring()); sound(DELVE_SOUNDS.rise, site); break;
      case 'seals': r.rose = now / 1000; r.broke = []; say(DELVE_SEALS_TEXT.seals(ev.n)); sound(DELVE_SOUNDS.rise, site); break;
      case 'broke':
        r.broke[ev.j] = now / 1000; sound(DELVE_SOUNDS.shatter, site);
        if (left() > 0) say(kind === 'seals' ? DELVE_SEALS_TEXT.broke(left()) : DELVE_SPRINGS_TEXT.broke(left()));
        break;
      case 'sink': say(DELVE_SEALS_TEXT.sink()); sound(DELVE_SOUNDS.wrong, site); break;
      case 'failed': r.foes?.on(ev); r.led = null; r.dark = true; r.rest = ev.rest ? now + ev.rest : 0; carry.set(false); say(failedLine(kind, ev), DELVE_SAY_LONG_S); break;
      case 'let': r.wakers?.crumble(); r.foes?.crumble(); r.led = null; r.steps?.reset(); r.wrong = null; carry.set(false); break;
      case 'show': if (!r.wrong) say(DELVE_LITANY_TEXT.show()); r.shown = -1; break;   // after a wrong plate its own line said it
      case 'work':
        if (kind === 'brazier') { r.driftAt = now; say(DELVE_BRAZIER_TEXT.work(ev.n)); } else if (kind === 'weighing') say(DELVE_WEIGHING_TEXT.work()); else say(DELVE_LITANY_TEXT.work());
        break;
      case 'lit': sound(DELVE_SOUNDS.chime(ev.next), site); break;
      case 'wrong': r.wrong = { j: ev.j, at: r.led?.ec ?? 0 }; sound(DELVE_SOUNDS.wrong, site); say(DELVE_LITANY_TEXT.wrong()); break;
      case 'wake': say(DELVE_LITANY_TEXT.wake()); r.wakers?.on({ k: 'wave', w: (r.led?.shows ?? 0) + 1, wz: ev.n }); break;
      case 'take': say(kind === 'brazier' ? DELVE_BRAZIER_TEXT.take() : DELVE_WEIGHING_TEXT.take()); break;
      case 'light': {
        sound(DELVE_SOUNDS.ignite, site);
        const n = (r.led?.k ?? 0) - bits(r.led?.lb ?? 0);
        if (n > 0) say(DELVE_BRAZIER_TEXT.light(n));
        break;
      }
      case 'drop': say(DELVE_BRAZIER_TEXT.drop()); break;
      case 'gutter': say(DELVE_BRAZIER_TEXT.gutter()); break;
      case 'set': sound(DELVE_SOUNDS.thud, site); break;
      case 'held': say(DELVE_WEIGHING_TEXT.held()); sound(DELVE_SOUNDS.chime(3), site); break;
      case 'unheld': say(DELVE_WEIGHING_TEXT.unheld()); break;
      case 'won':
        r.foes?.on(ev); r.wakers?.crumble(); r.won = true; r.vault = rollVault(rollPile, lv()); carry.set(false);
        say(wonLine(kind), DELVE_SAY_LONG_S); sound(DELVE_SOUNDS.won, site);
        break;
      default: break;
    }
  }
  const fold = (r, evs) => { for (const ev of evs) onEvent(r, ev); };
  /** An act of mine at a site (take, light, drop, set), at my feet. */
  const act = (r, a, j = -1, feet = lastFeet) => {
    if (r.led && feet) fold(r, foldDelveAct(r.led, r.site, ME, { a, j }, { party: true, inWard: inWard(r.site, feet[0], feet[1], feet[2]), pose: feet, nowMs: now }));
  };

  function frameSite(r, feet) {
    const { site } = r;
    const dx = feet[0] - site.x, dz = feet[2] - site.z, near = site.r + DELVE_WARD_PAD_M + DELVE_NEAR_M;
    if (!r.said && !r.won && dx * dx + dz * dz <= near * near && Math.abs(feet[1] - site.y) <= 3) {
      r.said = true;
      say(nearLine(site, site.kind === 'wellsprings' ? springCount(seed, site.i) : r.plates?.length ?? 0, look), DELVE_SAY_LONG_S);
    }
    if (r.won) return;
    const iw = inWard(site, feet[0], feet[1], feet[2]) && seesHeart(site, feet);
    if (r.dark && !iw) r.dark = false;   // a ward gone dark wakes again only to a step back in
    if (!r.led) { if (!iw || r.dark || now < r.rest) return; r.led = newDelveLedger(site, ME, seed, now); r.away = false; r.hb = 0; r.lowSaid = false; }
    const plate = r.plates ? plateAt(r.plates, feet[0], feet[1], feet[2]) : -1;
    const w = r.word;
    w.lv = lv(); w.st = r.steps ? r.steps.at(iw ? plate : -1) : -1; w.hb = r.hb;
    r.foes?.frame(); r.wakers?.frame();
    if (r.foes) r.foes.word(w);
    r.ctx.inWard = iw; r.ctx.plate = plate; r.ctx.nowMs = now;
    fold(r, foldDelveWord(r.led, ME, '', w, r.ctx));
    if (!r.led) return;
    kindFrame(r, feet, iw, plate);
    if (!r.led) return;
    const sp = shownPlate(r.led);
    if (sp >= 0 && sp !== r.shown) sound(DELVE_SOUNDS.chime(r.led.order.indexOf(sp) + 1), site);
    r.shown = sp;
    const running = isWaveKind(site.kind) && r.led.p !== DP.idle && r.led.p !== DP.won;
    if (running && !iw && now - r.led.inAt >= DELVE_AWAY_SAY_MS && !r.away) { r.away = true; say(DELVE_HOLD_TEXT.away()); }
    if (iw) r.away = false;
  }
  /** DLV4's kinds, a frame: the sources' pours, the relic's light, the rite's drift and its flame taken and set to the
   *  braziers as I walk to them, a weight set on a free plate I step onto. */
  function kindFrame(r, feet, iw, plate) {
    const { site, led } = r;
    if (site.kind === 'wellsprings' && led.p === DP.spring) {
      const due = Math.floor((led.ec - led.ss) / SPRING_POUR_MS) + 1;
      springSpots(site, led.k).forEach((p, j) => {
        if (!(led.hp[j] > 0) || (r.poured[j] ?? 0) >= due) return;
        r.poured[j] = due;
        if (r.foes.sourceLive(j) < SPRING_ALIVE) r.foes.pour(j, toward(site, p, HOLD_RANK_STEP_M));
      });
    } else if (site.kind === 'vigil' && led.p !== DP.idle && !r.lowSaid && led.lt <= VIGIL_LIGHT / 4) {
      r.lowSaid = true; say(DELVE_VIGIL_TEXT.low());
    } else if (site.kind === 'brazier' && led.p === DP.work) {
      if (r.foes && now - r.driftAt >= DRIFT_EVERY_MS && r.foes.driftLive() < DRIFT_MAX && foeHost.pick() >= 0) {
        r.driftAt = now;
        const gates = holdGates(site);
        r.foes.drift(gates[Math.floor(Math.random() * gates.length)]);
      }
      if (iw && led.fl !== FLAME.carried && !mine()) {
        const at = led.fl === FLAME.lying ? led.fx : [site.x, site.y, site.z];
        if (Math.hypot(feet[0] - at[0], feet[2] - at[2]) <= DELVE_REACH_M) act(r, 'take', -1, feet);
      } else if (led.fl === FLAME.carried && led.fc === ME) {
        const j = brazierSpots(site, led.k).findIndex((b, k) => !(led.lb & (1 << k)) && Math.hypot(feet[0] - b[0], feet[2] - b[2]) <= DELVE_REACH_M);
        if (j >= 0) act(r, 'light', j, feet);
      }
    } else if (site.kind === 'weighing' && led.p === DP.work) {
      const j = led.wt.findIndex((t) => t.s === WEIGHT.carried && t.by === ME);
      if (j >= 0 && plate >= 0 && !led.wt.some((t) => t.s === WEIGHT.plate && t.p === plate)) act(r, 'set', j, feet);
    }
  }

  /** In the ward is in its room: on the disc, or with nothing of the dungeon's between the player and the heart at the
   *  waist (the ward reaches 2 m past the disc, and a corridor behind its wall is no part of it). */
  function seesHeart(site, feet) {
    const dx = feet[0] - site.x, dz = feet[2] - site.z, d = Math.hypot(dx, dz);
    if (d <= site.r || !api.collider) return true;
    return !(api.collider.raycast([site.x, site.y + 1, site.z], [dx / d, 0, dz / d], d, ONLY_DUNGEON) < d);
  }

  /** The pieces' looks a frame - the flames where they stand (mine in my hands), the pedestals, the weights - and my
   *  hands' burden, a blow or a readied weapon letting the piece go where I stand. */
  const want = new Set();
  /** My carried piece let go where I stand (a blow on me, a readied weapon): answers whether it went. */
  const dropMine = () => { const h = mine(); if (!h) return false; act(h.r, h.j < 0 ? 'drop' : 'set', h.j, lastFeet); return !mine(); };
  function frameProps(feet) {
    const held = mine();
    want.clear();
    for (const r of runs) {
      const { site } = r, dx = feet[0] - site.x, dz = feet[2] - site.z;
      if (dx * dx + dz * dz > DELVE_DRAW_M * DELVE_DRAW_M) continue;
      if (site.kind === 'brazier') {
        for (const [key, at] of siteFlames(site, r.led, r.won)) { props.flame(`${site.i}:${key}`, at); want.add(`${site.i}:${key}`); }
        brazierSpots(site, r.led?.k || 3).forEach((b, j) => props.model(`${site.i}:ped${j}`, DELVE_PEDESTAL_MODEL, b, 45 + 90 * j, true));
      } else if (site.kind === 'weighing') {
        weightPlaces(site, r.led).forEach((at, j) => { if (at) props.model(`${site.i}:w${j}`, DELVE_WEIGHT_MODEL, at, 30 * j); else if (held?.r !== r || held.j !== j) props.unmodel(`${site.i}:w${j}`); });
      }
    }
    if (held && lastFeet) {
      const at = [lastFeet[0] + Math.sin(lastYaw) * DELVE_CARRY_AHEAD_M, lastFeet[1] + DELVE_CARRY_UP_M, lastFeet[2] + Math.cos(lastYaw) * DELVE_CARRY_AHEAD_M];
      if (held.j < 0) { props.flame('mine', at); want.add('mine'); } else props.model(`${held.r.site.i}:w${held.j}`, DELVE_WEIGHT_MODEL, [at[0], at[1] - 0.4, at[2]], (lastYaw * 180) / Math.PI);
    }
    for (const key of props.flameKeys()) if (!want.has(key)) props.unflame(key);
    carry.set(!!held, dropMine);
  }

  const unTargets = none ? null : api.addActivationTargets?.(() => targets());
  const unNamer = none ? null : api.addActivationNamer?.((key) => nameOf(key));
  function targets() {
    if (dead || online()) return [];
    const out = [];
    for (const r of runs) {
      const aabb = pieces.chest(r.site.i);
      if (aabb) out.push({ key: `${DELVE_KEY}vault:${r.site.i}`, aabb, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
      if (r.site.kind !== 'weighing' || r.won) continue;
      weightPlaces(r.site, r.led).forEach((at, j) => {
        if (at) out.push({ key: `${DELVE_KEY}weight:${r.site.i}:${j}`, aabb: { min: [at[0] - 0.45, at[1], at[2] - 0.45], max: [at[0] + 0.45, at[1] + 0.5, at[2] + 0.45] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
      });
    }
    return out;
  }
  /** The plaque's word: a sealed vault named with what opens it (a name, never a list - `unlisted`); a won one a vault
   *  whose list the plaque reads (contents); a weight its own name. */
  function nameOf(key) {
    if (delveKeyWeight(key)) return { title: DELVE_PIECE_TEXT.weight(), unlisted: true };
    const r = runs[delveKeySite(key)];
    if (!r) return null;
    if (r.won) return { title: DELVE_VAULT_TEXT.open() };
    return { title: DELVE_VAULT_TEXT.sealed(), subs: [sealedLine(r.site.kind)], unlisted: true };
  }
  /** The Weighing's plates' looks: lit where held - a weight on it, or me standing on it in the ward. */
  function weighLooks(r) {
    const out = r.looks, plates = r.plates ?? [], feet = lastFeet;
    out.length = plates.length;
    for (let j = 0; j < plates.length; j++) {
      const standing = !!feet && plateAt([plates[j]], feet[0], feet[1], feet[2]) === 0 && inWard(r.site, feet[0], feet[1], feet[2]);
      out[j] = r.led && (standing || r.led.wt.some((t) => t.s === WEIGHT.plate && t.p === j)) ? 1 : 0;
    }
    return out;
  }

  return {
    /** The plan's sites (the probes' and the tests'). */
    sites: plan.sites,
    /** The encounters' clock and every site's ledger, once a frame (scenes/dungeonContext.js drawFoes - both dungeon hosts).
     *  `dt` seconds; `feet` the player's; `yaw` their facing (radians - a carried piece is held before them); `pw` their
     *  weapon (a carry puts it up). Under a window drawFoes is not called, and the encounters wait. The chests stand on
     *  the first frame offline (online stands nothing). */
    frame(dt, feet, yaw = 0, pw = null) {
      if (dead || none || online() || !feet) return;
      if (!chestsStood) { chestsStood = true; for (const r of runs) pieces.standChest(r.site.i, r.site.vault, chestYaw(r.site)); }
      now += Number.isFinite(dt) ? Math.min(Math.max(0, dt), 1) * 1000 : 0;
      lastFeet = feet; lastYaw = Number.isFinite(yaw) ? yaw : 0; weapon = pw;
      for (const r of runs) frameSite(r, feet);
      frameProps(feet);
      carry.frame(now);
    },
    /** The marks on the floors near the eye and the pieces' crystals, after the last opaque flat (drawFoes' late slot).
     *  Nothing made a frame. */
    drawPass(proj, view, eye) {
      if (dead || none || online() || !eye) return false;
      list.length = 0; crystalList.length = 0;
      for (const r of runs) {
        const { site } = r, dx = eye[0] - site.x, dz = eye[2] - site.z;
        if (dx * dx + dz * dz > DELVE_DRAW_M * DELVE_DRAW_M) continue;
        const looks = site.kind === 'litany' ? plateLooks(r.led, r.plates.length, r.wrong, r.looks) : site.kind === 'weighing' ? weighLooks(r) : r.looks;
        siteShapes(site, r.led, looks, { won: r.won, sealed: !r.won, s: now / 1000, seed }, r.shapes);
        list.push(r.entry);
        for (const q of pieceCrystals(site, r.led, { look, seed, s: now / 1000, broke: r.broke, rose: r.rose, won: r.won }, r.crystals)) crystalList.push(q);
      }
      const marks = pieces.draw(list, proj, view, eye, now / 1000);
      return props.draw(crystalList, proj, view, eye, now / 1000) || marks;
    },
    /** DLV4: the pieces a blow can break now, as the context's crystal seam reads them (gateCrystalBodies). */
    breakables() {
      if (dead || none || online()) return [];
      const out = [];
      for (const r of runs) if (!r.won && r.led) breakTargets(r.site, r.led, standIns, out);
      return out;
    },
    /** DLV4: a blow of mine on a piece (`c` its seam number, `d` its damage, `kind` the blow's) - the ledger's caps decide
     *  what lands. Answers whether it went. */
    hit(c, d, kind) {
      const at = delveCrystalOf(c), run = at ? runs[at.i] : null;
      if (!run?.led || dead || online() || !lastFeet) return false;
      fold(run, foldDelveHit(run.led, run.site, ME, { j: at.j, d, r: kind, q: ++hitQ }, { party: true, inWard: inWard(run.site, lastFeet[0], lastFeet[1], lastFeet[2]), pose: lastFeet, nowMs: now }));
      return true;
    },
    /** DLV4: the bodies the dungeon's foes may hunt beside the party - a Vigil's relic while it runs. */
    wards() {
      if (dead || none || online()) return [];
      return runs.filter((r) => r.relic && r.led && r.led.p !== DP.idle && r.led.p !== DP.won).map((r) => r.relic);
    },
    /** A press on a vault or a weight (the context's takeLoot, `delve:`): in Info mode its name; a weight taken up (a press
     *  with one in my hands sets it down where I stand); a sealed vault said so; a won one quick loot's take
     *  (systems/quickLoot.js - the plaque's row, or the lot) or its list opened. Answers 1 handled. */
    press(key, mode = 'grab') {
      const wk = delveKeyWeight(key);
      if (wk) {
        const r = runs[wk.i];
        if (!r || dead || online()) return 0;
        if (mode === 'info') { api.hudSay?.(DELVE_PIECE_TEXT.weight()); return 1; }
        const h = mine();
        if (h && h.r === r && h.j >= 0) act(r, 'set', h.j); else if (!h) act(r, 'take', wk.j);
        return 1;
      }
      const r = runs[delveKeySite(key)];
      if (!r || dead || online()) return 0;
      if (mode === 'info') { api.hudSay?.(nameOf(key)?.title ?? ''); return 1; }
      if (!r.won || !r.vault) { api.hudSay?.(DELVE_VAULT_TEXT.locked()); return 1; }
      if (quickLootTake(key, { items: () => r.vault }, player(), setMidScreenText, { took: showPickups })) return 1;
      api.openLootList?.(r.vault);
      return 1;
    },
    /** What a won vault holds, for the plaque (the context's lootContents, `delve:`); a sealed one names, never lists. */
    contents(key) {
      const r = runs[delveKeySite(key)];
      return r?.won && !dead && !online() ? r.vault ?? [] : null;
    },
    /** What a save keeps (in the world record - the dungeon's, kept only while in it): the plan's hash and each won
     *  site's vault. A running attempt is never saved. */
    snapshot: () => ({ h: hash, won: runs.filter((r) => r.won).map((r) => ({ i: r.site.i, items: (r.vault ?? []).map((it) => ({ ...it })) })) }),
    /** A save's word laid back - under the same plan alone. Every running attempt ends first, and every living foe one
     *  stood goes - a foe the save held alive stood up again by the world record's own restore among them. */
    restore(s) {
      for (const r of runs) { r.foes?.crumble(); r.wakers?.crumble(); r.led = null; r.won = false; r.vault = null; r.said = false; r.away = false; r.dark = false; r.steps?.reset(); r.wrong = null; r.shown = -1; r.rest = 0; r.broke = []; r.hb = 0; }
      carry.set(false);
      if (!s || s.h !== hash || !Array.isArray(s.won)) return;
      for (const w of s.won) { const r = runs[w?.i]; if (r) { r.won = true; r.vault = Array.isArray(w.items) ? w.items.map((it) => ({ ...it })) : []; } }
    },
    /** The ledgers, for the tests and the probes. */
    state: () => runs.map((r) => ({
      i: r.site.i, kind: r.site.kind, won: r.won, p: r.led?.p ?? DP.idle, w: r.led?.w ?? 0, next: r.led?.next ?? 0, order: [...(r.led?.order ?? [])], vault: r.vault?.length ?? 0, chest: !!pieces.chest(r.site.i), hold: r.foes?.state() ?? null,
      k: r.led?.k ?? 0, hp: [...(r.led?.hp ?? [])], lt: r.led?.lt ?? VIGIL_LIGHT, lb: r.led?.lb ?? 0, fl: r.led?.fl ?? FLAME.heart, wt: (r.led?.wt ?? []).map((t) => t.s), hs: r.led?.hs ?? -1, rest: r.rest > now,
    })),
    /** Where a site's weights' homes, plates and braziers stand (the probes'). */
    spots: (i) => { const s = plan.sites[i]; return s ? { weights: weightSpots(s), plates: weighPlates(s), braziers: brazierSpots(s, runs[i].led?.k || 3) } : null; },
    destroy() {
      dead = true;
      unTargets?.(); unNamer?.();
      carry.destroy();
      pieces.destroy();
      props.destroy();
    },
  };
}

/** The chest faces the site's heart (degrees about up). Pure. */
export function chestYaw(site) {
  const v = site.vault ?? [site.x, site.y, site.z];
  return (Math.atan2(site.x - v[0], site.z - v[2]) * 180) / Math.PI;
}
