// @ts-check
// SHARED-HEALTH (2026-10-26, bible/06-Systems/Integrity-Arc.md section 5): THE CLIENT'S HALF OF ONE HEALTH POOL. While a
// refereed fight may be held for me (`frame(active)`), my health as a share of my maximum goes to the relay when it moves, at
// most every HEALTH_REPORT_MS, with the last word I applied from each pool; the relay's `ask` sends one at once. The relay's
// word on my pool sets my health to the same share of my maximum plus what my health did since the report that word includes.
// My share is kept exact across the integer health: after a word it is the word's share plus my own movement since, so round
// trips do not wear the count down. Pure of the game: the host hands in the health to read, the door that writes it, and the
// socket's send (net/siege/refereeHealthShare.js is the relay's half).

import { HEALTH_SHARE_WHOLE, PVP_RESTORATION_MAX } from './refereeHealthShare.js';
import { SKILLS, skillValue } from '../../systems/skills.js';
import { pvpArmorKept, pvpWardKept, pvpShieldShare } from '../../combat/pvpGuard.js';
import { pvpDodging, pvpGearEvade } from '../../combat/pvpEvade.js'; // PVP-EVADE
import { pvpGuardWithGear } from '../../combat/pvpGearPowers.js'; // PVP-GEAR: the guard powers' share
import { capPvpBuffs } from '../../combat/pvpBuffs.js';
import { setPvpFight } from '../../combat/pvpPotions.js';
import { pendingDeclares, declaresSent } from '../../combat/pvpDeclare.js'; // PVP-VITALS: what I drank and cast on myself
import { maxFatigue } from '../../systems/statMods.js';
import '../../combat/pvpArmourCasting.js'; // PVP-ARMOUR-CAST: its doors, registered where the fight flag is set

/** The fewest milliseconds between two reports: four a second, well under the relay's gate for this frame. */
export const HEALTH_REPORT_MS = 250;
/** How many pools' last words a report carries, and how many past reports a word can name. */
const SEEN_POOLS_MAX = 4;
const SENT_REPORTS_MAX = 16;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** @typedef {{ n: number, s: number, seen: Array<[number, number]>, x?: number, r?: number, g?: number[], w?: number[], sh?: number, dg?: number, pe?: number, m?: number, f?: number, u?: number[] }} VitReport */
/** PVP-VITALS: how far my magicka or fatigue share moves, in parts, before a report says it. */
const VITALS_STEP = 100;
/** @typedef {{ read: () => { health: number, maxHealth: number }, write: (health: number) => void, send: (report: VitReport) => boolean, now?: () => number, restoration?: () => number, guard?: () => number[] | null, ward?: () => number[] | null, shield?: () => boolean | number, evasion?: () => { dg: number, pe: number } | null, spends?: () => { m: number, f: number } | null }} MirrorOptions
 *  `read` my health now; `write` sets it (the host's door - never a death: at least 1); `send` true when it left; `now` a
 *  monotonic clock, ms; `restoration` (PVP-HEALTH) my skill + gear; `guard` and `ward` (PVP-GUARD, PVP-WARD) my armour's
 *  and resistances' shares (combat/pvpGuard.js); `shield` (PVP-SHIELD) a Shield on me - PVP-KIT: its share, per cent, or true for the strongest;
 *  `evasion` (PVP-EVADE) my live Dodging and a gear power's evade; `spends` (PVP-VITALS) my magicka's and fatigue's shares, in HEALTH_SHARE_WHOLE parts. */
/** @param {MirrorOptions} o */
export function createRefereeHealthMirror({
  read,
  write,
  send,
  now = () => Date.now(),
  restoration = () => 0,
  guard = () => null,
  ward = () => null,
  shield = () => false,
  evasion = () => null,
  spends = () => null,
}) {
  /** PVP-KIT: the report's `sh` - 0 none, 1 the strongest (a plain true), else the share (net/wire.js VIT_SHIELD_MIN..MAX). */
  const shieldWord = () => {
    const v = shield();
    return v === true ? 1 : Math.max(0, Math.round(Number(v) || 0));
  };
  /** PVP-EVADE: the report's `dg` and `pe`, or nothing. */
  const evasionWord = () => {
    const e = evasion();
    return e ? { dg: e.dg, pe: e.pe } : {};
  };
  /** My share after the last word, exact, and my health right after that word wrote it. Null before any word. */
  let base = /** @type {{ share: number, health: number } | null} */ (null);
  /** The last word applied from each pool: epoch to word number. */
  const seen = new Map();
  /** My health's own movement (never a word's), summed in parts since the mirror began, and the health it last saw. */
  let ownMovement = 0;
  let lastHealth = /** @type {number | null} */ (null);
  /** The own movement each recent report included, by report number. */
  const sentMovement = new Map();
  let reportNumber = 0;
  let lastSentShare = /** @type {number | null} */ (null);
  let lastSentAt = -Infinity;
  let asked = false;
  let lastMax = /** @type {number | null} */ (null);
  let lastSentMax = /** @type {number | null} */ (null);
  let lastSentGuard = '';
  let lastSentEvasion = '';
  let lastSentSpends = /** @type {{ m: number, f: number } | null} */ (null);
  /** PVP-VITALS: my magicka or fatigue moved past VITALS_STEP since the last report, or a declaration waits. */
  const spendsMoved = () => {
    if (pendingDeclares().length > 0) return true;
    const v = spends();
    return (
      !!v &&
      (!lastSentSpends ||
        Math.abs(v.m - lastSentSpends.m) >= VITALS_STEP ||
        Math.abs(v.f - lastSentSpends.f) >= VITALS_STEP)
    );
  };

  /** Counts what my health did since the mirror last looked: a foe's blow, a potion - never the mirror's own write. */
  const observe = () => {
    const { health, maxHealth } = read();
    if (lastHealth !== null && maxHealth > 0) ownMovement += ((health - lastHealth) / maxHealth) * HEALTH_SHARE_WHOLE;
    lastHealth = health;
  };

  /** My health as a share of my maximum, in parts. */
  const localShare = () => {
    const { health, maxHealth } = read();
    if (!(maxHealth > 0)) return 0;
    if (!base) return (health / maxHealth) * HEALTH_SHARE_WHOLE;
    return base.share + ((health - base.health) / maxHealth) * HEALTH_SHARE_WHOLE;
  };

  const report = (share) => {
    const number = reportNumber + 1;
    const rounded = Math.round(share);
    // PVP-HEALTH: my real maximum and Restoration ride every report - the referee's pool is that whole
    const x = Math.max(1, Math.round(read().maxHealth || 1));
    const r = Math.max(0, Math.min(PVP_RESTORATION_MAX, Math.round(Number(restoration()) || 0)));
    const g = guard(),
      w = ward(),
      sh = shieldWord(),
      ev = evasionWord();
    const v = spends(),
      u = pendingDeclares(); // PVP-VITALS
    const vit = {
      ...(v
        ? { m: clamp(Math.round(v.m), 0, HEALTH_SHARE_WHOLE), f: clamp(Math.round(v.f), 0, HEALTH_SHARE_WHOLE) }
        : {}),
      ...(u.length ? { u } : {}),
    };
    if (
      !send({
        n: number,
        s: rounded,
        seen: [...seen.entries()],
        x,
        r,
        ...(Array.isArray(g) ? { g } : {}),
        ...(Array.isArray(w) ? { w } : {}),
        sh,
        ...ev,
        ...vit,
      })
    )
      return;
    if (u.length) declaresSent(u.length);
    lastSentSpends = v;
    lastSentMax = x;
    lastSentGuard = `${g}|${w}|${sh}`;
    lastSentEvasion = JSON.stringify(ev);
    reportNumber = number;
    sentMovement.set(number, ownMovement);
    if (sentMovement.size > SENT_REPORTS_MAX) sentMovement.delete(sentMovement.keys().next().value);
    lastSentShare = rounded;
    lastSentAt = now();
    asked = false;
  };

  const mirror = {
    /** The host's frame: a report when one is owed. `active` - a refereed fight may hold me now. */
    frame(active) {
      const { maxHealth } = read();
      if (maxHealth !== lastMax) {
        base = null;
        lastMax = maxHealth;
      } // a new maximum (a level-up, a spell) makes the old share baseline wrong
      if (!active && !asked) return;
      if (now() - lastSentAt < HEALTH_REPORT_MS) return;
      observe();
      const share = clamp(localShare(), 0, HEALTH_SHARE_WHOLE);
      const moved =
        lastSentShare === null ||
        Math.abs(share - lastSentShare) >= 1 ||
        Math.round(maxHealth || 1) !== lastSentMax ||
        `${guard()}|${ward()}|${shieldWord()}` !== lastSentGuard || // PVP-GUARD, PVP-WARD, PVP-SHIELD: armour, a resistance or a Shield on or off
        JSON.stringify(evasionWord()) !== lastSentEvasion || // PVP-EVADE: my Dodging or a gear power's evade
        spendsMoved(); // PVP-VITALS
      if (asked || moved) report(share);
    },
    /** The relay's ask: a pool of mine was made or reset and waits for my share. */
    ask() {
      asked = true;
      base = null; // a pool made or started again: my share is my own health again, not the last pool's word
    },
    /**
     * The referee's word on my pool (net/wire.js validVitOut `k: 'h'`).
     * @param {{ health: number, max: number, epoch: number, word: number, report: number }} w
     */
    onWord(w) {
      if (!(w.max > 0)) return;
      seen.delete(w.epoch);
      seen.set(w.epoch, w.word);
      if (seen.size > SEEN_POOLS_MAX) seen.delete(seen.keys().next().value);
      // What my health did on its own after the report this word includes - a report it does not name (another
      // session's) adds none.
      observe();
      const included = sentMovement.get(w.report);
      const sinceIncluded = included === undefined ? 0 : ownMovement - included;
      const share = clamp((w.health / w.max) * HEALTH_SHARE_WHOLE + sinceIncluded, 0, HEALTH_SHARE_WHOLE);
      const { maxHealth } = read();
      if (!(maxHealth > 0)) return;
      const health = clamp(Math.round((share * maxHealth) / HEALTH_SHARE_WHOLE), 1, maxHealth);
      write(health);
      lastHealth = read().health;
      base = { share, health: lastHealth };
      // The referee now holds the word's share: a report is owed only where my own movement since differs from it.
      lastSentShare = (w.health / w.max) * HEALTH_SHARE_WHOLE;
    },
    /** A referee's word in (net/wire.js validVitOut): its ask, or its count on my pool. */
    onVit(word) {
      if (word.k === 'ask') mirror.ask();
      else mirror.onWord(word);
    },
    /** The player left the online world: nothing of a pool is kept. */
    reset() {
      base = null;
      seen.clear();
      sentMovement.clear();
      ownMovement = 0;
      lastHealth = null;
      lastSentShare = null;
      lastSentMax = null;
      lastSentGuard = '';
      lastSentSpends = null;
      lastSentAt = -Infinity;
      asked = false;
    },
  };
  return mirror;
}

/**
 * The world host's mirror: the player entity's health read and written, the reports on the online session's own room
 * socket. A word never kills - a player at none stays at none, and the zone's fall is its own word (forcePlayerDeath).
 * PVP-BUFFS: each frame a fight may hold me, my own buffs are cut to a minute (combat/pvpBuffs.js).
 * @param {any} player   the player entity
 * @param {() => { sendVit?: (report: any) => boolean } | null | undefined} onlineOf   the session now, if any
 */
export function createPlayerHealthMirror(player, onlineOf) {
  const mirror = createRefereeHealthMirror({
    read: () => player,
    write: (health) => {
      if (player.health > 0) player.health = health;
    },
    send: (report) => onlineOf()?.sendVit?.(report) === true,
    restoration: () => skillValue(player, SKILLS.Restoration),
    guard: () => pvpGuardWithGear(pvpArmorKept(player), player),
    ward: () => pvpWardKept(player),
    shield: () => pvpShieldShare(player), // PVP-KIT: the Shield's share
    evasion: () => ({ dg: pvpDodging(player), pe: pvpGearEvade(player) }), // PVP-EVADE
    spends: () => {
      // PVP-VITALS: magicka and fatigue, as shares
      const mm = Number(player.maxMagicka) || 0,
        mf = maxFatigue(player) || 0;
      return {
        m: mm > 0 ? ((Number(player.magicka) || 0) / mm) * HEALTH_SHARE_WHOLE : 0,
        f: mf > 0 ? ((Number(player.fatigue) || 0) / mf) * HEALTH_SHARE_WHOLE : 0,
      };
    },
  });
  const frame = mirror.frame;
  mirror.frame = (active) => {
    if (active) capPvpBuffs(player);
    setPvpFight(active); // PVP-POTIONS: the potion clocks run only in a fight
    frame(active);
  };
  return mirror;
}
