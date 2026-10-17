// PARTY-MAP (2026-09-30, Discord: "share map data between party members, possibly with a spell effect so that
// maintaining some kind of buff for it becomes part of the dungeoneering loop"; and, from another player, "makes a
// dedicated scout more viable and helps non-combat characters contribute"): SHARED CARTOGRAPHY.
//
// THE EFFECT. `Shared Cartography` (46,255 - the port's own; no classic key uses 46, RESURRECT1's 45 is the
// precedent) is a Mysticism duration buff, CasterOnly, a BUFF_KINDS row (systems/effects.js) - so it lands, stacks
// its rounds on a recast and runs out exactly as Detect or Light do. It is in the Spell Maker's list and, online,
// sold ready-made at the spell shop (worldModes `sharedCartographySpell`).
//
// THE SHARE. While the buff is live and its caster stands in a dungeon with a party, the automap rows THEY reveal
// (automap.js: the live record's visitedThisRun - the caster's own scan, never a mate's rows, so nothing echoes) go to
// the hub in batches - the new rows since the last send, at most AMAP_KEYS_MAX a frame, one frame every AMAP_SEND_MS
// at most (net/wire.js) - and the hub fans them to the party alone. A mate in the SAME dungeon marks them revealed
// and nothing else (automap.js mergePartyAutomap): they draw greyed, known but not walked. With the buff down nothing
// is sent (the rows wait - a recast sends what the caster mapped since this entry); outside a dungeon the sender
// forgets what it sent, so the next dungeon (or the same one entered again) starts whole.
//
// OFFLINE / SOLO: the buff lands and does nothing - there is no party to send to, and nothing else reads it.
import { buildCustomSpell } from '../spell/spellMaker.js';
import { hasActiveEffect } from '../effects.js';
import { AMAP_KEYS_MAX, AMAP_SEND_MS, validAmapRow } from '../../net/wire.js';

export const SHARED_CARTOGRAPHY_TYPE = 46;
export const SHARED_CARTOGRAPHY_SUBTYPE = 255;
export const SHARED_CARTOGRAPHY_KEY = '46,255';
/** The BUFF_KINDS name the entry carries - hasActiveEffect(entity, SHARED_CARTOGRAPHY_KIND) is the buff. */
export const SHARED_CARTOGRAPHY_KIND = 'sharedCartography';
/** The ready-made spell's index, in the custom (negative) space, fixed so a bought copy keys the same everywhere. */
export const SHARED_CARTOGRAPHY_SPELL_INDEX = -46001;
/** The ready-made spell's duration: 20 rounds + 2 a level (a round is 5 s) - about two minutes at level 1, a little
 *  over three at level 10. Short enough that keeping it up is part of the delve. */
export const SHARED_CARTOGRAPHY_DURATION = Object.freeze({ durationBase: 20, durationMod: 2, durationPerLevel: 1 });

/** Is the buff live on this entity? */
export const hasSharedCartography = (entity) => hasActiveEffect(entity, SHARED_CARTOGRAPHY_KIND);

/** The ready-made spell the spell shop sells online: Shared Cartography, on the caster, Magic. */
export function sharedCartographySpell() {
  return buildCustomSpell({ slots: [{ type: SHARED_CARTOGRAPHY_TYPE, subType: SHARED_CARTOGRAPHY_SUBTYPE, settings: { ...SHARED_CARTOGRAPHY_DURATION } }],
    rangeType: 0, element: 4, name: 'Shared Cartography', icon: 21, index: SHARED_CARTOGRAPHY_SPELL_INDEX });
}

/**
 * The sender's batcher. `next(...)` answers the frame body to send now ({k, r}) or null; `commit(frame, nowMs)` is
 * called only when the link really sent it, so a refused send loses nothing. Inputs:
 *  - `active`: the buff is live on the player;
 *  - `inDungeon`: the player stands in a dungeon, with `key` its automap key and `rec` its live record;
 *  - `partied`: the player is in a party (nobody to tell otherwise).
 */
/** AUDIT PARTY-MAP F2: how often the sender forgets what it sent and walks its map again - a mate who entered late,
 *  was loading, or reconnected keeps only what arrives while they stand in the dungeon, so a map sent once was a map
 *  they never got. The receiver's merge is idempotent (a Set), so a second pass costs bytes and nothing else. */
export const AMAP_RESYNC_MS = 60_000;
export function createPartyMapSender({ sendMs = AMAP_SEND_MS, max = AMAP_KEYS_MAX, resyncMs = AMAP_RESYNC_MS } = {}) {
  let key = null;
  let sent = new Set();
  let lastAt = -Infinity;
  let syncAt = -Infinity;
  return {
    next({ active, inDungeon, partied = true, key: k, rec, nowMs }) {
      if (!inDungeon || !k || !rec) { key = null; sent = new Set(); return null; }   // left: the next dungeon starts whole
      if (k !== key) { key = k; sent = new Set(); syncAt = nowMs; }
      if (!active || !partied) return null;
      if (nowMs - syncAt >= resyncMs) { sent = new Set(); syncAt = nowMs; }   // AUDIT PARTY-MAP F2: the whole map again
      if (nowMs - lastAt < sendMs) return null;
      const r = [];
      for (const row of rec.visitedThisRun ?? []) {
        if (sent.has(row) || !validAmapRow(row)) continue;
        r.push(row);
        if (r.length >= max) break;
      }
      return r.length ? { k, r } : null;
    },
    commit(frame, nowMs) {
      if (!frame || frame.k !== key) return;
      lastAt = nowMs;
      for (const row of frame.r) sent.add(row);
    },
    /** How many rows have gone for the dungeon now held (tests and the console). */
    get sentCount() { return sent.size; },
  };
}
