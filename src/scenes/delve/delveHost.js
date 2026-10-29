// @ts-check
// DELVE II (bible/03-World/Delve-II.md, DLV2; the owner, 2026-10-28: "coming upon a wave based encounter, or puzzle
// solving like you find in some of our world events"): A DUNGEON'S ENCOUNTERS, STOOD. The site law's plan made once as the
// dungeon is built (world/dungeon/delveSites.js, on the host's collider, doors and fires), each site's ledger run on the
// player's own words (net/delve/delveLaw.js - offline the player is the whole party and the machine that stands the
// foes), the Hold's foes (delveHold.js), the Litany's plates (delveLitany.js), the marks and the chest (delvePieces.js) and
// the vault (systems/delve/delveVault.js). scenes/dungeonContext.js wires it in a few lines (HOST-SPLIT). Offline alone
// until DLV3: online it stands nothing. Not a DFU member (Ledger A: DELVE II).
import { delveSitePlan, colliderSiteProbe } from '../../world/dungeon/delveSites.js';
import { fireLayoutInputs } from '../../world/dungeon/dungeonFires.js';
import { newDelveLedger, foldDelveWord, inWard, plateAt, litanyPlates, delvePlanHash, DP, HOLD_WAVES, DELVE_WARD_PAD_M, DELVE_KIND_NAMES } from '../../net/delve/delveLaw.js';
import { createHoldFoes } from './delveHold.js';
import { plateLooks, shownPlate, createPlateSteps, DELVE_SOUNDS } from './delveLitany.js';
import { createDelvePieces, siteShapes, DELVE_DRAW_M } from './delvePieces.js';
import { DELVE_NEAR_TEXT, DELVE_HOLD_TEXT, DELVE_LITANY_TEXT, DELVE_VAULT_TEXT, DELVE_SAY_S, DELVE_SAY_LONG_S } from '../../systems/delve/delveWords.js';
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
/** The player's own account in the ledger offline. */
const ME = 'me';

/** Whether a dungeon stands no site: the row off, a made level, an arena's sand, an Abyss Hollow, Privateer's Hold
 *  (section 4's None in; a palace the law's own). Pure but for the pref. */
export function delveStandsNone(location) {
  if (getPref(DELVE_PREF) === false) return true;
  return !location?.hasDungeon || madeLevelOf(location) != null || isArenaFloor(location) || dungeonTier(location) === 'super' || isPrivateersHold(location);
}

/** The kinds a dungeon can stand: a Hold only where its encounter table has foes to stand (every client reads the same
 *  choices - characters/encounterTableDoor.js). Pure but for the table door. */
export function delveKindsFor(location) {
  const idx = resolveEncounterTableIndex({ dungeonType: location?.mapTableData?.dungeonType });
  return idx != null && encounterTableChoices(idx).some((t) => t?.length) ? DELVE_KIND_NAMES : DELVE_KIND_NAMES.filter((k) => k !== 'hold');
}

/** A press's site, off its key (`delve:vault:<i>`), or -1. Pure. */
export const delveKeySite = (key) => {
  const m = /^delve:vault:(\d+)$/.exec(String(key ?? ''));
  return m ? Number(m[1]) : -1;
};

/**
 * THE HOST. `api` the dungeon context's own (spawnLooseFoe, removeLooseFoe, foes, collider, dynamicDraws, hudSay,
 * openLootList, addActivationTargets, addActivationNamer); `deps` the build's (renderer, getGpuMesh, cpuModels);
 * `location` the dungeon's; `blocks` its layout's; `hearths` and `fires` the fire plan's inputs and fires; `player()` the
 * entity; `rollPile()` the dungeon's own pile roll; `online()` whether it is a room's.
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
  const place = location?.dungeon?.recordElement?.header ? dungeonPlace(location) : {};   // DEX3: the dungeon's own table, as its foes were rolled
  let now = 0, dead = false, chestsStood = false;
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
  const runs = plan.sites.map((site) => ({
    site, led: /** @type {any} */ (null), won: false, vault: /** @type {any[]|null} */ (null), said: false, away: false,
    foes: site.kind === 'hold' ? createHoldFoes(site, foeHost) : null,
    wakers: site.kind === 'litany' ? createHoldFoes(site, foeHost) : null,
    plates: site.kind === 'litany' ? litanyPlates(site) : null,
    steps: site.kind === 'litany' ? createPlateSteps() : null,
    wrong: /** @type {{ j: number, at: number }|null} */ (null), shown: -1,
    // kept for the frame: the word, the fold's context, the looks, the marks and the pass's entry, filled in place
    word: /** @type {any} */ ({ lv: 1, o: 0, kw: 0, kn: 0, wc: 0, cf: 0, st: -1 }), ctx: { party: true, inWard: false, plate: -1, nowMs: 0 },
    looks: /** @type {number[]} */ ([]), shapes: /** @type {any[]} */ ([]), entry: /** @type {any} */ (null),
  }));
  for (const r of runs) r.entry = { site: r.site, shapes: r.shapes };
  const list = /** @type {any[]} */ ([]);
  const say = (text, s = DELVE_SAY_S) => setMidScreenText(text, s);
  const sound = (S, site) => { try { audio.play3d?.(S.rec, [site.x, site.y + 1, site.z], S.vol, { pitch: S.pitch }); } catch { /* a sound is never the encounter's problem */ } };

  function onEvent(r, ev) {
    const { site } = r;
    switch (ev.k) {
      case 'gather': say(DELVE_HOLD_TEXT.gather()); sound(DELVE_SOUNDS.wake, site); break;
      case 'wave': r.foes?.on(ev); say(DELVE_HOLD_TEXT.wave(ev.w, HOLD_WAVES)); break;
      case 'breath': say(DELVE_HOLD_TEXT.breath()); break;
      case 'captain': r.foes?.on(ev); say(DELVE_HOLD_TEXT.captain()); sound(DELVE_SOUNDS.wake, site); break;
      case 'failed': r.foes?.on(ev); r.led = null; say(DELVE_HOLD_TEXT.failed(), DELVE_SAY_LONG_S); break;
      case 'let': r.wakers?.crumble(); r.led = null; r.steps?.reset(); r.wrong = null; break;
      case 'show': if (!r.wrong) say(DELVE_LITANY_TEXT.show()); r.shown = -1; break;   // after a wrong plate its own line said it
      case 'work': say(DELVE_LITANY_TEXT.work()); break;
      case 'lit': sound(DELVE_SOUNDS.chime(ev.next), site); break;
      case 'wrong': r.wrong = { j: ev.j, at: r.led?.ec ?? 0 }; sound(DELVE_SOUNDS.wrong, site); say(DELVE_LITANY_TEXT.wrong()); break;
      case 'wake': say(DELVE_LITANY_TEXT.wake()); r.wakers?.on({ k: 'wave', w: (r.led?.shows ?? 0) + 1, wz: ev.n }); break;
      case 'won':
        r.foes?.on(ev); r.wakers?.crumble(); r.won = true; r.vault = rollVault(rollPile, lv());
        say(site.kind === 'hold' ? DELVE_HOLD_TEXT.won() : DELVE_LITANY_TEXT.won(), DELVE_SAY_LONG_S); sound(DELVE_SOUNDS.won, site);
        break;
      default: break;
    }
  }

  function frameSite(r, feet) {
    const { site } = r;
    const dx = feet[0] - site.x, dz = feet[2] - site.z, near = site.r + DELVE_WARD_PAD_M + DELVE_NEAR_M;
    if (!r.said && !r.won && dx * dx + dz * dz <= near * near && Math.abs(feet[1] - site.y) <= 3) {
      r.said = true;
      say(site.kind === 'hold' ? DELVE_NEAR_TEXT.hold() : DELVE_NEAR_TEXT.litany(r.plates?.length ?? 0), DELVE_SAY_LONG_S);
    }
    if (r.won) return;
    const iw = inWard(site, feet[0], feet[1], feet[2]);
    if (!r.led) { if (!iw) return; r.led = newDelveLedger(site, ME, seed, now); r.away = false; }
    const plate = r.plates ? plateAt(r.plates, feet[0], feet[1], feet[2]) : -1;
    const w = r.word;
    w.lv = lv(); w.st = r.steps ? r.steps.at(iw ? plate : -1) : -1;
    r.foes?.frame(); r.wakers?.frame();
    if (r.foes) r.foes.word(w);
    r.ctx.inWard = iw; r.ctx.plate = plate; r.ctx.nowMs = now;
    for (const ev of foldDelveWord(r.led, ME, '', w, r.ctx)) onEvent(r, ev);
    if (!r.led) return;
    const sp = shownPlate(r.led);
    if (sp >= 0 && sp !== r.shown) sound(DELVE_SOUNDS.chime(r.led.order.indexOf(sp) + 1), site);
    r.shown = sp;
    const running = r.foes && r.led.p !== DP.idle && r.led.p !== DP.won;
    if (running && !iw && now - r.led.inAt >= DELVE_AWAY_SAY_MS && !r.away) { r.away = true; say(DELVE_HOLD_TEXT.away()); }
    if (iw) r.away = false;
  }

  const unTargets = none ? null : api.addActivationTargets?.(() => targets());
  const unNamer = none ? null : api.addActivationNamer?.((key) => nameOf(key));
  function targets() {
    if (dead || online()) return [];
    const out = [];
    for (const r of runs) {
      const aabb = pieces.chest(r.site.i);
      if (aabb) out.push({ key: `${DELVE_KEY}vault:${r.site.i}`, aabb, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
    }
    return out;
  }
  /** The plaque's word: a sealed vault named with what opens it (a name, never a list - `unlisted`); a won one a vault
   *  whose list the plaque reads (contents). */
  function nameOf(key) {
    const r = runs[delveKeySite(key)];
    if (!r) return null;
    if (r.won) return { title: DELVE_VAULT_TEXT.open() };
    return { title: DELVE_VAULT_TEXT.sealed(), subs: [r.site.kind === 'hold' ? DELVE_VAULT_TEXT.sealedHold() : DELVE_VAULT_TEXT.sealedLitany()], unlisted: true };
  }

  return {
    /** The plan's sites (the probes' and the tests'). */
    sites: plan.sites,
    /** The encounters' clock and every site's ledger, once a frame (scenes/dungeonContext.js drawFoes - both dungeon hosts).
     *  `dt` seconds; `feet` the player's. Under a window drawFoes is not called, and the encounters wait. The chests
     *  stand on the first frame offline (online stands nothing). */
    frame(dt, feet) {
      if (dead || none || online() || !feet) return;
      if (!chestsStood) { chestsStood = true; for (const r of runs) pieces.standChest(r.site.i, r.site.vault, chestYaw(r.site)); }
      now += Math.min(Math.max(0, dt), 1) * 1000;
      for (const r of runs) frameSite(r, feet);
    },
    /** The marks on the floors near the eye, after the last opaque flat (drawFoes' late slot). Nothing made a frame. */
    drawPass(proj, view, eye) {
      if (dead || none || online() || !eye) return false;
      list.length = 0;
      for (const r of runs) {
        const { site } = r, dx = eye[0] - site.x, dz = eye[2] - site.z;
        if (dx * dx + dz * dz > DELVE_DRAW_M * DELVE_DRAW_M) continue;
        siteShapes(site, r.led, r.plates ? plateLooks(r.led, r.plates.length, r.wrong, r.looks) : r.looks, { won: r.won, sealed: !r.won, s: now / 1000 }, r.shapes);
        list.push(r.entry);
      }
      return pieces.draw(list, proj, view, eye, now / 1000);
    },
    /** A press on a vault (the context's takeLoot, `delve:`): in Info mode its name; sealed, said so; won, quick loot's
     *  take (systems/quickLoot.js - the plaque's row, or the lot) or its list opened. Answers 1 handled. */
    press(key, mode = 'grab') {
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
      for (const r of runs) { r.foes?.crumble(); r.wakers?.crumble(); r.led = null; r.won = false; r.vault = null; r.said = false; r.away = false; r.steps?.reset(); r.wrong = null; r.shown = -1; }
      if (!s || s.h !== hash || !Array.isArray(s.won)) return;
      for (const w of s.won) { const r = runs[w?.i]; if (r) { r.won = true; r.vault = Array.isArray(w.items) ? w.items.map((it) => ({ ...it })) : []; } }
    },
    /** The ledgers, for the tests and the probes. */
    state: () => runs.map((r) => ({ i: r.site.i, kind: r.site.kind, won: r.won, p: r.led?.p ?? DP.idle, w: r.led?.w ?? 0, next: r.led?.next ?? 0, order: [...(r.led?.order ?? [])], vault: r.vault?.length ?? 0, chest: !!pieces.chest(r.site.i), hold: r.foes?.state() ?? null })),
    destroy() {
      dead = true;
      unTargets?.(); unNamer?.();
      pieces.destroy();
    },
  };
}

/** The chest faces the site's heart (degrees about up). Pure. */
export function chestYaw(site) {
  const v = site.vault ?? [site.x, site.y, site.z];
  return (Math.atan2(site.x - v[0], site.z - v[2]) * 180) / Math.PI;
}
