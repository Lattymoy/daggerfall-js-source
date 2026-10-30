// @ts-check
// DELVE II (bible/03-World/Delve-II.md, DLV2 to DLV4; the owner, 2026-10-28: "coming upon a wave based encounter, or
// puzzle solving like you find in some of our world events"): A DUNGEON'S ENCOUNTERS, STOOD. The site law's plan made as
// the dungeon is built (world/dungeon/delveSites.js); offline each ledger run here on my own words, blows and acts
// (net/delve/delveLaw.js), online the room's (server/src/delveRoom.js), its state read as a ledger (delveOnline.js) and my
// words said to it (net/delve/delveLink.js) - the foes stood only while the room names my machine. The foes (delveHold.js),
// plates (delveLitany.js), pieces (delveBodies.js), marks and chest (delvePieces.js), looks (delveProps.js) and the vault;
// scenes/dungeonContext.js wires it in a few lines (HOST-SPLIT). Not a DFU member (Ledger A: DELVE II).
import { delveSitePlan, colliderSiteProbe, landDelveSites, siteCandidates, DSITE, DSITE_SMALL } from '../../world/dungeon/delveSites.js';
import { fireLayoutInputs, enemyMarks, itemMarks, blockWaterY } from '../../world/dungeon/dungeonFires.js';
import { RDB_SIDE } from '../../world/rdbLayout.js';
import {
  newDelveLedger, foldDelveWord, foldDelveHit, foldDelveAct, inWard, plateAt, delvePlates, delvePlanHash, DP, FLAME, WEIGHT,
  HOLD_WAVES, DELVE_WARD_PAD_M, DELVE_KIND_NAMES, DELVE_REACH_M, DELVE_WEIGHT_HALF_M, SPRING_POUR_MS, SPRING_ALIVE, DRIFT_MAX, DRIFT_EVERY_MS,
  VIGIL_LIGHT, isWaveKind, springSpots, springCount, brazierSpots, weightSpots, weighPlates, driftSpots, holdCaptainTraits,
} from '../../net/delve/delveLaw.js';
import { createHoldFoes, HOLD_RANK_STEP_M } from './delveHold.js';
import { plateLooks, shownPlate, createPlateSteps, DELVE_SOUNDS } from './delveLitany.js';
import { createDelvePieces, siteShapes, DELVE_DRAW_M } from './delvePieces.js';
import { createDelveProps, pieceCrystals, siteFlames, weightPlaces, sourceLook, DELVE_PEDESTAL_MODEL, DELVE_WEIGHT_MODEL } from './delveProps.js';
import { breakTargets, createStandIns, makeRelic, createDelveCarry, delveCrystalOf, delveHuntSite } from './delveBodies.js';
import {
  DELVE_NEAR_TEXT, DELVE_HOLD_TEXT, DELVE_LITANY_TEXT, DELVE_VAULT_TEXT, DELVE_SPRINGS_TEXT, DELVE_VIGIL_TEXT, DELVE_BRAZIER_TEXT,
  DELVE_WEIGHING_TEXT, DELVE_SEALS_TEXT, DELVE_CARRY_TEXT, DELVE_PIECE_TEXT, DELVE_ROOM_TEXT, DELVE_SAY_S, DELVE_SAY_LONG_S,
} from '../../systems/delve/delveWords.js';
import { rollVault } from '../../systems/delve/delveVault.js';
import { delveWireReady, sendDelveWord, attachDelveHearer } from '../../net/delve/delveLink.js';
import { DELVE_ACTS, DELVE_NO, DELVE_HIT_MAX } from '../../net/wire.js';
import { delvePlanWire, delveView, delveWordKey, DELVE_WORD_MS, DELVE_ACT_AGAIN_MS, DELVE_PLAN_AGAIN_MS, DELVE_HELD_SAY_MS } from './delveOnline.js';
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
/** DLV6: how far past a ward's edge the lab stands a player (firstFloor). */
const LAB_STEP_M = 1;
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
  const probe = none ? null : colliderSiteProbe(api.collider);
  const plan = none ? { sites: [] } : delveSitePlan({ blocks, probe, doors, fires: [...existing, ...fires], seed, tier, kinds: delveKindsFor(location) });
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
  const myFeet = [0, 0, 0];
  /** WEIGH-POSE: where the room hears me stand - last frame's feet. The world says my pose before the dungeon moves me
   *  (scenes/world.js onlineFrame runs before modes.frame), so an act said on the frame I reach a plate was judged a
   *  step short of it, and the weight fell to the floor beside it. */
  const heardFeet = [0, 0, 0];
  // DLV3: online, the room's - the plan said until it answers, a refusal of it (another plan stands) standing all down
  let planSaidAt = -Infinity, planHeard = false, refused = false;
  /** Online at a relay that keeps the encounters: the room's ledgers, read and said. */
  const linked = () => online() && !refused && delveWireReady();
  /** Nothing stands: torn down, no site, or online at a relay that keeps none. */
  const down = () => dead || none || (online() && !linked());
  /** My machine stands this site's foes: offline always, online while the room names it. */
  const foesMine = (r) => !online() || !!r.me?.fm;
  const lv = () => effectiveLevel(player());
  const foeHost = {
    spawn: (type, at, opts) => api.spawnLooseFoe(type, at, linked() ? { ...opts, delve: true } : opts),   // DLV3: online, the encounter's own grant kind
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
      // DLV4: the relic, a flame let fall that I have not stepped off yet, the plate my weight came off, the relic's blows
      // this attempt, each piece's breaking (s), the seals' rising (s), the pours done, the last drift, the light's warning
      // said, the crystals' list kept
      relic: /** @type {any} */ (null), byFall: false, offPlate: -1, hb: 0, broke: /** @type {number[]} */ ([]), rose: 0, poured: /** @type {number[]} */ ([]), driftAt: 0, lowSaid: false,
      crystals: /** @type {any[]} */ ([]),
      // DLV3: online, the room's last state of it and my part (`me`), my word's key and moment, my last act's, the step
      // said while the room's pose catches up, and whether my machine stood its foes
      st: /** @type {any} */ (null), me: /** @type {any} */ (null), wordKey: '', wordAt: -Infinity, actKey: '', actAt: -Infinity,
      step: { p: -1, until: 0 }, fm: false, apart: /** @type {any} */ (null), heldAt: -Infinity, knBase: 0, knWave: 0, clearWave: 0,
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
      case 'wave': r.knBase = 0; r.knWave = 0; r.clearWave = 0; if (foesMine(r)) r.foes?.on(ev); say(DELVE_HOLD_TEXT.wave(ev.w, HOLD_WAVES)); break;
      case 'breath': say(kind === 'vigil' ? DELVE_VIGIL_TEXT.breath() : DELVE_HOLD_TEXT.breath()); break;
      case 'captain': if (foesMine(r)) r.foes?.on(ev); say(DELVE_HOLD_TEXT.captain()); sound(DELVE_SOUNDS.wake, site); break;
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
      case 'wrong': r.wrong = { j: ev.j, at: now }; sound(DELVE_SOUNDS.wrong, site); say(DELVE_LITANY_TEXT.wrong()); break;   // on my clock: a room's state re-anchors its own
      case 'wake': say(DELVE_LITANY_TEXT.wake()); if (foesMine(r)) r.wakers?.on({ k: 'wave', w: (r.led?.shows ?? 0) + 1, wz: ev.n }); break;
      case 'take': say(kind === 'brazier' ? DELVE_BRAZIER_TEXT.take() : DELVE_WEIGHING_TEXT.take()); break;
      case 'light': {
        sound(DELVE_SOUNDS.ignite, site);
        const n = (r.led?.k ?? 0) - bits(r.led?.lb ?? 0);
        if (n > 0) say(DELVE_BRAZIER_TEXT.light(n));
        break;
      }
      case 'drop': r.byFall = true; say(DELVE_BRAZIER_TEXT.drop()); break;
      case 'gutter': say(DELVE_BRAZIER_TEXT.gutter()); break;
      case 'set': case 'back': sound(DELVE_SOUNDS.thud, site); break;
      case 'held': say(DELVE_WEIGHING_TEXT.held()); sound(DELVE_SOUNDS.chime(3), site); break;
      case 'unheld': say(DELVE_WEIGHING_TEXT.unheld()); break;
      case 'won':   // online the share is rolled when the room says it is mine to open (hear: `v`)
        r.foes?.on(ev); r.wakers?.crumble(); r.won = true; r.vault = online() ? null : rollVault(rollPile, lv()); carry.set(false);
        say(wonLine(kind), DELVE_SAY_LONG_S); sound(DELVE_SOUNDS.won, site);
        break;
      default: break;
    }
  }
  const fold = (r, evs) => { for (const ev of evs) onEvent(r, ev); };
  /** An act of mine at a site (take, light, drop, set), at my feet - online said to the room, once, and again after
   *  DELVE_ACT_AGAIN_MS while its state has not moved. Answers whether it went. */
  const act = (r, a, j = -1, feet = lastFeet) => {
    if (!r.led || !feet) return false;
    if (!online()) { fold(r, foldDelveAct(r.led, r.site, ME, { a, j }, { party: true, inWard: holds(r.site, feet), pose: feet, nowMs: now })); return true; }
    const key = `${a}|${j}`;
    if (key === r.actKey && now - r.actAt < DELVE_ACT_AGAIN_MS) return true;
    r.actKey = key; r.actAt = now;
    return sendDelveWord({ k: 'a', h: hash, i: r.site.i, a: DELVE_ACTS.indexOf(a), j });
  };

  /** Whether I am near a site (its near line's reach), and its near line said once. */
  function nearSite(r, feet) {
    const { site } = r;
    const dx = feet[0] - site.x, dz = feet[2] - site.z, near = site.r + DELVE_WARD_PAD_M + DELVE_NEAR_M;
    const is = dx * dx + dz * dz <= near * near && Math.abs(feet[1] - site.y) <= 3;
    if (is && !r.said && !r.won) {
      r.said = true;
      say(nearLine(site, site.kind === 'wellsprings' ? r.led?.k || springCount(seed, site.i) : r.plates?.length ?? 0, look), DELVE_SAY_LONG_S);
    }
    return is;
  }
  function frameSite(r, feet) {
    const { site } = r;
    if (online()) { frameSiteOnline(r, feet); return; }
    nearSite(r, feet);
    if (r.won) return;
    const iw = holds(site, feet);
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
    if (r.led) siteTail(r, iw);
  }
  /** Both ways' frame's end: an order's plate chimed as it is shown, and a defender out of a running ward told once. */
  function siteTail(r, iw) {
    const { site, led } = r;
    const sp = shownPlate(led);
    if (sp >= 0 && sp !== r.shown) sound(DELVE_SOUNDS.chime(led.order.indexOf(sp) + 1), site);
    r.shown = sp;
    const running = isWaveKind(site.kind) && led.p !== DP.idle && led.p !== DP.won;
    if (running && !iw && now - led.inAt >= DELVE_AWAY_SAY_MS && !r.away) { r.away = true; say(DELVE_HOLD_TEXT.away()); }
    if (iw) r.away = false;
  }
  /** DLV3: A SITE A FRAME, ONLINE - the room's ledger read (its view, r.led), my machine taking up the foes the room names
   *  it for (the rest of a running wave, the captain) or letting its own go, and my word said: every DELVE_WORD_MS while I
   *  am near, stand its foes or carry its piece, at once when it changes. A step on a plate is said a second, while the
   *  room's pose of me catches up. With no foes' machine heard, a word from the ward offers mine. */
  function frameSiteOnline(r, feet) {
    const { site } = r;
    const near = nearSite(r, feet);
    const led = r.led, iw = holds(site, feet), plate = r.plates ? plateAt(r.plates, feet[0], feet[1], feet[2]) : -1;
    const fm = !!r.me?.fm;
    if (fm && !r.fm) takeFoes(r); else if (!fm && r.fm) { r.foes?.crumble(); r.wakers?.crumble(); }
    r.fm = fm;
    if (led && iw) led.inAt = now;
    if (fm) { r.foes?.frame(); r.wakers?.frame(); }
    const w = r.word;
    w.lv = lv(); w.hb = Math.min(r.hb, 9999); w.iw = iw ? 1 : 0; w.o = 0; w.kw = 0; w.kn = 0; w.wc = 0; w.cf = 0;
    const stepped = r.steps ? r.steps.at(iw ? plate : -1) : -1;
    if (stepped >= 0) r.step = { p: stepped, until: now + 1_000 };
    w.st = r.step.p >= 0 && now < r.step.until && plate === r.step.p ? r.step.p : -1;
    if (fm) { if (r.foes) handedWord(r, w); else w.o = 1; }   // named: kept - a puzzle's machine has no foes host to say it (AUDIT DLV3 4)
    else if (iw && !r.won && (!led || !led.fo)) w.o = 1;   // the waking word offers it too: the first to speak keeps them, as offline
    if ((near || fm || mine()?.r === r) && !r.apart) {
      const key = delveWordKey({ i: site.i, ...w });
      if (key !== r.wordKey || now - r.wordAt >= DELVE_WORD_MS) { if (sendDelveWord({ k: 'w', h: hash, i: site.i, ...w })) { r.wordKey = key; r.wordAt = now; } }
    }
    if (!led || r.won) return;
    kindFrame(r, heardFeet, holds(site, heardFeet), r.plates ? plateAt(r.plates, heardFeet[0], heardFeet[1], heardFeet[2]) : -1);   // my acts judged where the room hears me (WEIGH-POSE)
    siteTail(r, iw);
  }
  /** DLV3: my machine named for a site's foes mid-attempt: the rest of its running wave stood (the room counted the
   *  others' downed), or its captain - the pours and the drift go on from now. A wave with no rest is clear (AUDIT DLV3
   *  P2: the machine before me left before it said so). */
  function takeFoes(r) {
    const led = r.led;
    r.poured = []; r.driftAt = now; r.knBase = 0; r.knWave = 0; r.clearWave = 0;
    if (!led || !r.foes) return;
    if (led.p === DP.wave) {
      const rest = Math.max(0, led.wz - led.kn);
      r.knBase = led.kn; r.knWave = led.w;
      if (rest > 0) r.foes.on({ k: 'wave', w: led.w, wz: rest }); else r.clearWave = led.w;
    } else if (led.p === DP.captain) r.foes.on({ k: 'captain', traits: holdCaptainTraits(r.site.tier) });
  }
  /** My machine's word: its own count, on from the room's when it took the wave over mid-way. */
  function handedWord(r, w) {
    r.foes.word(w);
    const led = r.led;
    if (led?.p !== DP.wave || led.w !== r.knWave) return;
    if (r.clearWave === led.w) { w.kw = led.w; w.kn = led.wz; w.wc = led.w; return; }
    if (w.kw === led.w) w.kn = Math.min(led.wz, w.kn + r.knBase);
  }
  /** DLV4's kinds, a frame: the sources' pours, the relic's light, the rite's drift and its flame taken and set to the
   *  braziers as I walk to them, a weight set on a free plate I step onto. */
  function kindFrame(r, feet, iw, plate) {
    const { site, led } = r;
    if (site.kind === 'wellsprings' && led.p === DP.spring) {
      if (!foesMine(r)) return;
      const due = Math.floor((led.ec - led.ss) / SPRING_POUR_MS) + 1;
      springSpots(site, led.k).forEach((p, j) => {
        if (!(led.hp[j] > 0) || (r.poured[j] ?? 0) >= due) return;
        r.poured[j] = due;
        if (r.foes.sourceLive(j) < SPRING_ALIVE) r.foes.pour(j, toward(site, p, HOLD_RANK_STEP_M));
      });
    } else if (site.kind === 'vigil' && led.p !== DP.idle && !r.lowSaid && led.lt <= VIGIL_LIGHT / 4) {
      r.lowSaid = true; say(DELVE_VIGIL_TEXT.low());
    } else if (site.kind === 'brazier' && led.p === DP.work) {
      if (r.foes && foesMine(r) && now - r.driftAt >= DRIFT_EVERY_MS && r.foes.driftLive() < DRIFT_MAX && foeHost.pick() >= 0) {
        r.driftAt = now;
        const spots = driftSpots(site);
        r.foes.drift(spots[Math.floor(Math.random() * spots.length)]);
      }
      if (iw && led.fl !== FLAME.carried && !mine()) {
        const at = led.fl === FLAME.lying ? led.fx : [site.x, site.y, site.z], d = Math.hypot(feet[0] - at[0], feet[2] - at[2]);
        if (led.fl === FLAME.lying && r.byFall && d > DELVE_REACH_M) r.byFall = false;   // a flame let fall is taken up only once I have stepped off it
        if (d <= DELVE_REACH_M && !(led.fl === FLAME.lying && r.byFall)) act(r, 'take', -1, feet);
      } else if (led.fl === FLAME.carried && led.fc === ME) {
        const j = brazierSpots(site, led.k).findIndex((b, k) => !(led.lb & (1 << k)) && Math.hypot(feet[0] - b[0], feet[2] - b[2]) <= DELVE_REACH_M);
        if (j >= 0) act(r, 'light', j, feet);
      }
    } else if (site.kind === 'weighing' && led.p === DP.work) {
      const j = led.wt.findIndex((t) => t.s === WEIGHT.carried && t.by === ME);
      if (plate !== r.offPlate) r.offPlate = -1;   // a weight taken off a plate is set back on it only once I have stepped off it
      if (j >= 0 && plate >= 0 && plate !== r.offPlate && !led.wt.some((t) => t.s === WEIGHT.plate && t.p === plate)) act(r, 'set', j, feet);
    }
  }

  /** In the ward is in its room: on the disc, or with nothing of the dungeon's between the player and the heart at the
   *  waist (the ward reaches 2 m past the disc, and a corridor behind its wall is no part of it). */
  /** Whether I stand in a site's ward - the disc and its pad, and past the disc a clear line to the heart: one reading for
   *  my words, my acts and my blows alike. */
  function holds(site, feet) { return inWard(site, feet[0], feet[1], feet[2]) && seesHeart(site, feet); }
  function seesHeart(site, feet) {
    const dx = feet[0] - site.x, dz = feet[2] - site.z, d = Math.hypot(dx, dz);
    if (d <= site.r || !api.collider) return true;
    return !(api.collider.raycast([site.x, site.y + 1, site.z], [dx / d, 0, dz / d], d, ONLY_DUNGEON) < d);
  }

  /** The pieces' looks a frame - the flames where they stand (mine in my hands), the pedestals, the weights - and my
   *  hands' burden, a blow or a readied weapon letting the piece go where I stand. */
  const want = new Set();
  /** My carried piece let go where I stand (a blow on me, a readied weapon): answers whether it went. */
  const dropMine = () => { const h = mine(); if (!h) return false; const went = act(h.r, h.j < 0 ? 'drop' : 'set', h.j, lastFeet); return online() ? went : !mine(); };   // online: the word left, the room's state follows
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
    if (down()) return [];
    const out = [];
    for (const r of runs) {
      const aabb = pieces.chest(r.site.i);
      if (aabb) out.push({ key: `${DELVE_KEY}vault:${r.site.i}`, aabb, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
      if (r.site.kind !== 'weighing' || r.won) continue;
      weightPlaces(r.site, r.led).forEach((at, j) => {
        if (at) out.push({ key: `${DELVE_KEY}weight:${r.site.i}:${j}`, aabb: { min: [at[0] - DELVE_WEIGHT_HALF_M, at[1], at[2] - DELVE_WEIGHT_HALF_M], max: [at[0] + DELVE_WEIGHT_HALF_M, at[1] + 0.5, at[2] + DELVE_WEIGHT_HALF_M] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
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
      const standing = !!feet && plateAt([plates[j]], feet[0], feet[1], feet[2]) === 0 && holds(r.site, feet);
      out[j] = r.led && (standing || r.led.wt.some((t) => t.s === WEIGHT.plate && t.p === j)) ? 1 : 0;
    }
    return out;
  }

  /** DLV3: THE ROOM'S WORD (net/wire.js validDelveOut): a site's state made its view, what moved it, a vault's answer -
   *  my plan's alone - the plan asked for again, or a refusal. */
  function hear(w) {
    if (dead || none || !online()) return;
    if (w.k === 'pl?') { planHeard = false; planSaidAt = -Infinity; return; }
    if (w.k === 'no') { refusal(w); return; }
    if (w.ph !== hash) return;   // another plan's (a page of another build): nothing of it is mine
    const r = runs[w.i];
    if (!r) return;
    if (w.k === 'dl') {
      planHeard = true; refused = false;
      if (r.apart && w.p !== r.apart.p) r.apart = null;   // the site's state moved: my word may count again
      r.st = w; r.me = w.me;
      const was = r.led;
      r.led = delveView(r.site, w, r.led);
      if (!was && r.led) { r.away = false; r.hb = 0; r.lowSaid = false; }   // a fresh attempt: my counts from nothing, as offline's (AUDIT DLV3 3)
      r.won = w.p === DP.won;
      if (!r.won) r.vault = null;
      r.rest = w.p === DP.idle && w.rs > 0 ? now + w.rs : 0;
    } else if (w.k === 'ev') { for (const e of w.ev) onEvent(r, e); }
    else if (w.k === 'v') {
      if (!w.ok) { api.hudSay?.(DELVE_VAULT_TEXT.notYours()); return; }
      r.vault = rollVault(rollPile, lv());   // my share: the pile's own roll, on my machine (PARTY-LOOT's base)
      if (!quickLootTake(`${DELVE_KEY}vault:${r.site.i}`, { items: () => r.vault }, player(), setMidScreenText, { took: showPickups })) api.openLootList?.(r.vault);
    }
  }
  /** A refusal: no room yet for my plan (every site stands down here, and the plan is said again in DELVE_PLAN_AGAIN_MS
   *  - AUDIT DLV3 2: never for good), a site another party holds or my own attempt at another (said once, and my word
   *  there held back until its state moves - AUDIT DLV3 6), the hub silent (the next word asks again). */
  function refusal(w) {
    if (w.m === DELVE_NO.plan) { standDown(); planHeard = false; planSaidAt = now; return; }
    const r = runs[w.i];
    if (!r) return;
    if (w.m === DELVE_NO.party && !r.apart) { r.apart = { p: r.led?.p ?? DP.idle }; say(DELVE_ROOM_TEXT.others()); }
    else if (w.m === DELVE_NO.held && now - r.heldAt >= DELVE_HELD_SAY_MS) { r.heldAt = now; say(DELVE_ROOM_TEXT.held()); }   // my word goes on: the other may end any time
  }
  /** No room for my plan: every site stands down here, its foes and pieces gone, until the room keeps it. */
  function standDown() {
    refused = true;
    for (const r of runs) { r.foes?.crumble(); r.wakers?.crumble(); r.led = null; }
    carry.set(false);
  }
  const unHear = none ? null : attachDelveHearer(hear);

  return {
    /** The plan's sites (the probes' and the tests'). */
    sites: plan.sites,
    /** The encounters' clock and every site's ledger, once a frame (scenes/dungeonContext.js drawFoes - both dungeon hosts).
     *  `dt` seconds; `feet` the player's; `yaw` their facing (radians - a carried piece is held before them); `pw` their
     *  weapon (a carry puts it up). Under a window offline drawFoes is not called and the encounters wait; online the
     *  world runs on under it (WINDOW-ONLINE, scenes/windowWorld.js) and so do they. The chests stand on the first frame
     *  offline, online once the room keeps the plan. */
    frame(dt, feet, yaw = 0, pw = null) {
      if (dead || none || !feet) return;
      const ms = Number.isFinite(dt) ? Math.min(Math.max(0, dt), 1) * 1000 : 0;
      now += ms;
      // DLV3: the plan said until the room answers - while it has no room for it too, so a page stood down stands again
      if (online() && delveWireReady() && !planHeard && now - planSaidAt >= DELVE_PLAN_AGAIN_MS && plan.sites.length) { planSaidAt = now; sendDelveWord(delvePlanWire(plan.sites, hash, tier)); }
      if (down()) return;
      if (!chestsStood && (!online() || planHeard)) { chestsStood = true; for (const r of runs) pieces.standChest(r.site.i, r.site.vault, chestYaw(r.site)); }   // online: once the room keeps the plan
      if (online()) for (const r of runs) if (r.led && r.led.p !== DP.won) r.led.ec += ms;   // each view's clock run on between its states
      const was = lastFeet ?? feet;
      heardFeet[0] = was[0]; heardFeet[1] = was[1]; heardFeet[2] = was[2];
      myFeet[0] = feet[0]; myFeet[1] = feet[1]; myFeet[2] = feet[2];   // my own copy: the motor's feet are its live Float32Array
      lastFeet = myFeet; lastYaw = Number.isFinite(yaw) ? yaw : 0; weapon = pw;
      for (const r of runs) frameSite(r, myFeet);
      frameProps(myFeet);
      carry.frame(now);
    },
    /** The marks on the floors near the eye and the pieces' crystals, after the last opaque flat (drawFoes' late slot).
     *  Nothing made a frame. */
    drawPass(proj, view, eye) {
      if (down() || !eye) return false;
      list.length = 0; crystalList.length = 0;
      for (const r of runs) {
        const { site } = r, dx = eye[0] - site.x, dz = eye[2] - site.z;
        if (dx * dx + dz * dz > DELVE_DRAW_M * DELVE_DRAW_M) continue;
        const looks = site.kind === 'litany' ? plateLooks(r.led, r.plates.length, r.wrong, r.looks, now) : site.kind === 'weighing' ? weighLooks(r) : r.looks;
        siteShapes(site, r.led, looks, { won: r.won, sealed: !r.won, s: now / 1000, seed }, r.shapes);
        list.push(r.entry);
        for (const q of pieceCrystals(site, r.led, { look, seed, s: now / 1000, broke: r.broke, rose: r.rose, won: r.won }, r.crystals)) crystalList.push(q);
      }
      const marks = pieces.draw(list, proj, view, eye, now / 1000);
      return props.draw(crystalList, proj, view, eye, now / 1000) || marks;
    },
    /** DLV4: the pieces a blow can break now, as the context's crystal seam reads them (gateCrystalBodies). */
    breakables() {
      if (down()) return [];
      const out = [];
      for (const r of runs) if (!r.won && r.led) breakTargets(r.site, r.led, standIns, out);
      return out;
    },
    /** DLV4: a blow of mine on a piece (`c` its seam number, `d` its damage, `kind` the blow's) - the ledger's caps decide
     *  what lands. Answers whether it landed. */
    hit(c, d, kind) {
      const at = delveCrystalOf(c), run = at ? runs[at.i] : null;
      if (!run?.led || down() || !lastFeet || !(d > 0)) return false;
      if (online()) return sendDelveWord({ k: 'x', h: hash, i: at.i, j: at.j, d: Math.min(DELVE_HIT_MAX, d), r: kind, q: (++hitQ) & 0x7fffffff });   // the room's caps decide: it went
      const led = run.led, was = led.hp[at.j];
      fold(run, foldDelveHit(led, run.site, ME, { j: at.j, d, r: kind, q: ++hitQ }, { party: true, inWard: holds(run.site, lastFeet), pose: lastFeet, nowMs: now }));
      return led.hp[at.j] < was;   // whether it landed (AUDIT DLV4 F12: a refused blow keeps no spell's rounds on the piece)
    },
    /** DLV4: the bodies the dungeon's foes may hunt beside the party - a Vigil's relic while it runs. */
    wards() {
      if (down()) return [];
      return runs.filter((r) => r.relic && r.led && r.led.p !== DP.idle && r.led.p !== DP.won && foesMine(r)).map((r) => r.relic);   // online: hunted by my machine's foes alone
    },
    /** A press on a vault or a weight (the context's takeLoot, `delve:`): in Info mode its name; a weight taken up (a press
     *  with one in my hands sets it down where I stand); a sealed vault said so; a won one quick loot's take
     *  (systems/quickLoot.js - the plaque's row, or the lot) or its list opened. Answers 1 handled. */
    press(key, mode = 'grab') {
      const wk = delveKeyWeight(key);
      if (wk) {
        const r = runs[wk.i];
        if (!r || down()) return 0;
        if (mode === 'info') { api.hudSay?.(DELVE_PIECE_TEXT.weight()); return 1; }
        const h = mine();
        if (h && h.r === r && h.j >= 0) act(r, 'set', h.j);
        else if (!h) {
          const t = r.led?.wt[wk.j], from = t?.s === WEIGHT.plate ? t.p : -1;
          act(r, 'take', wk.j);
          if (from >= 0 && r.led?.wt[wk.j]?.s === WEIGHT.carried) r.offPlate = from;   // AUDIT DLV4 F8: off its plate, not set straight back on it
        }
        return 1;
      }
      const r = runs[delveKeySite(key)];
      if (!r || down()) return 0;
      if (mode === 'info') { api.hudSay?.(nameOf(key)?.title ?? ''); return 1; }
      if (online() && r.won && !r.vault) {   // DLV3: my share asked of the room - an earner's, once
        if (r.me?.ea) sendDelveWord({ k: 'v', h: hash, i: r.site.i }); else api.hudSay?.(DELVE_VAULT_TEXT.notYours());
        return 1;
      }
      if (!r.won || !r.vault) { api.hudSay?.(DELVE_VAULT_TEXT.locked()); return 1; }
      if (quickLootTake(key, { items: () => r.vault }, player(), setMidScreenText, { took: showPickups })) return 1;
      api.openLootList?.(r.vault);
      return 1;
    },
    /** What a won vault holds, for the plaque (the context's lootContents, `delve:`); a sealed one names, never lists. */
    contents(key) {
      const r = runs[delveKeySite(key)];
      return r?.won && !down() ? r.vault ?? [] : null;
    },
    /** What a save keeps (in the world record - the dungeon's, kept only while in it): the plan's hash and each won
     *  site's vault. A running attempt is never saved. */
    snapshot: () => ({ h: hash, won: online() ? [] : runs.filter((r) => r.won).map((r) => ({ i: r.site.i, items: (r.vault ?? []).map((it) => ({ ...it })) })) }),   // online the room keeps them
    /** A save's word laid back - under the same plan alone. Every running attempt ends first, and every living foe one
     *  stood goes - a foe the save held alive stood up again by the world record's own restore among them. */
    restore(s) {
      for (const r of runs) { r.foes?.crumble(); r.wakers?.crumble(); r.led = null; r.won = false; r.vault = null; r.said = false; r.away = false; r.dark = false; r.steps?.reset(); r.wrong = null; r.shown = -1; r.rest = 0; r.broke = []; r.hb = 0; r.byFall = false; r.offPlate = -1; }
      carry.set(false);
      if (!s || s.h !== hash || !Array.isArray(s.won) || online()) return;
      for (const w of s.won) { const r = runs[w?.i]; if (r) { r.won = true; r.vault = Array.isArray(w.items) ? w.items.map((it) => ({ ...it })) : []; } }
    },
    /** The ledgers, for the tests and the probes. */
    state: () => runs.map((r) => ({
      i: r.site.i, kind: r.site.kind, won: r.won, p: r.led?.p ?? DP.idle, w: r.led?.w ?? 0, next: r.led?.next ?? 0, order: [...(r.led?.order ?? [])], vault: r.vault?.length ?? 0, chest: !!pieces.chest(r.site.i), hold: r.foes?.state() ?? null,
      k: r.led?.k ?? 0, hp: [...(r.led?.hp ?? [])], lt: r.led?.lt ?? VIGIL_LIGHT, lb: r.led?.lb ?? 0, fl: r.led?.fl ?? FLAME.heart, wt: (r.led?.wt ?? []).map((t) => t.s), hs: r.led?.hs ?? -1, rest: r.rest > now,
    })),
    /** A site's ledger as it stands, for the probes to read (never to write). */
    ledger: (i) => runs[i]?.led ?? null,
    /** DLV5: the site law's landing at `at` for a ward of `r` - as the plan judged every spot it found, the start's rule
     *  aside (a curated block is never the start): `{ ok }` or the rule broken (the lab's check, delve.html). */
    landing(at, r) {
      if (!probe) return { ok: false, rule: 'none' };
      const tally = {}, b = blocks.find((x) => at[0] >= x.originX && at[0] < x.originX + RDB_SIDE && at[2] >= x.originZ && at[2] < x.originZ + RDB_SIDE);
      const got = landDelveSites([{ pos: at, water: b ? blockWaterY(b.layout) : -Infinity }], { probe, doors, enemies: enemyMarks(blocks), items: itemMarks(blocks), fires: [...existing, ...fires], start: null, tally, law: r === DSITE.r ? DSITE : DSITE_SMALL, tier });
      return got.length ? { ok: true, y: got[0].pos[1] } : { ok: false, rule: Object.keys(tally)[0] ?? 'floor' };
    },
    /** DLV6: where the lab stands a player its link names no spot for (scenes/dungeon.js, `?dungeon=lab`) - the site law's
     *  grid's floor nearest the first site, on its storey and a step past every ward (`inWard`: its heart would wake it at
     *  the boot), else the grid's first floor. Null with no probe or no floor. */
    firstFloor() {
      const floors = [];
      for (const c of probe ? siteCandidates(blocks, DSITE_SMALL.gridM) : []) { const f = probe.floor(c.pos); if (f && Number.isFinite(f.y)) floors.push([c.pos[0], f.y + 0.05, c.pos[2]]); }
      const s0 = plan.sites[0], past = (p) => plan.sites.every((s) => !inWard({ ...s, r: s.r + LAB_STEP_M }, p[0], p[1], p[2]));
      const off = (p) => Math.hypot(p[0] - s0.x, p[2] - s0.z);
      const near = s0 ? floors.filter((p) => past(p) && Math.abs(p[1] - s0.y) < 1).sort((a, b) => off(a) - off(b)) : [];
      return near[0] ?? floors[0] ?? null;
    },
    /** Where a site's weights' homes, plates and braziers stand (the probes'). */
    spots: (i) => { const s = plan.sites[i]; return s ? { weights: weightSpots(s), plates: weighPlates(s), braziers: brazierSpots(s, runs[i].led?.k || 3) } : null; },
    destroy() {
      dead = true;
      unTargets?.(); unNamer?.(); unHear?.();
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
