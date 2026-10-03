// @ts-check
// BOUNTY1 (2026-09-28): THE BOUNTY BOARD IN THE WORLD - the ledger held, the packs stood and counted, the purse paid.
//
// The law is systems/bountyBoard.js (what a board posts, what it pays) and systems/bountyReward.js (the piece); the
// windows are ui/bountyWindow.js through ui/bountyDoor.js. This file is the host's half, and it reaches the world only
// through the deps the world host (scenes/world.js) hands it - so it can be driven headless by a test.
//
// A HUNT, START TO END:
//   - taken at the board (`openBoard` -> the window's Take), up to four at once, each lapsing 24 game hours after it
//     was taken;
//   - its pixel marked on both maps with a black circle (`mapMarks`);
//   - its pack stood the first time the hunter stands on that pixel in the open (`tick`) - the REMAINING beasts, so a
//     pack that was culled (the hunter walked 200 m off) or lost to a reload comes back as many as were left;
//   - each kill counted as its corpse falls (a foe culled has no corpse and is not a kill);
//   - the last kill pays at once: gold and the piece into the pack, and a notice that holds the game until it is
//     read (`notice`) - queued while another window is up, never dropped.
//
// THE PARTY (online): my pose carries my bounties (`poseField` -> net/wire.js validPartyPose `bq`). A bounty I SHARE
// is taken up by every mate with room for it; a bounty any of us clears pays every one of us who held it BEFORE the
// clear (AUDIT 28 B1: a row's `t`); and one of us stands the pack (bountyPackOwner) - whoever's pack already stands,
// else the lowest account on its pixel (AUDIT 28 B3: a row's `a`) - the rest fight the owner's beasts as the puppets
// every other foe of theirs already is. The hunt's kills are the party's (AUDIT 28 B4: a row's `k`): an owner who
// falls or walks off hands on a hunt part done.

import {
  BOUNTY_VENDOR, bountyDay, bountySites, boardPostings, postingFromId, parseBountyId, postingState,
  bountyDungeons, newBountyLedger, readBountyLedger, takeBounty, dropBounty, payBounty, lapseBounties, pruneBountyLedger,
  bountyPoseField, bountyPackOwner, bountyHuntKey, bountyTierFits, bountyMinutesLeft, rewardStory, BOUNTY_REWARD_TITLE, BOUNTY_ACTIVE_MAX,
  MINUTES_PER_DAY, bountyIdAtLevel, bountyPartyKills, bountyClearPays,
} from '../systems/bountyBoard.js';
import { mintBountyItem, bountyItemName, bountyRewardRows } from '../systems/bountyReward.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { addGoldPieces, addItem } from '../systems/inventory.js';
import { BOUNTY_RING_R } from '../ui/bountyMapMark.js';
import { setBountyJournal, BOUNTY_QUEST_PREFIX } from '../systems/bountyJournal.js';
import { rewardContract } from '../systems/standing.js';   // REP4: a contract finished, the region's law two points better

/** How often the host looks at the world, seconds. */
export const BOUNTY_TICK_S = 0.5;
/** After a pack failed to stand (no ground under the anchor), how long before the next try, seconds. */
export const BOUNTY_RETRY_S = 4;
/** BOUNTY-TRAIL (Mac, 2026-09-28: "if its 6 to 8 monster you gotta kill, can you make 2 groups out of it and give
 *  another clue where the group is when the first group is killed?"): an open-ground pack this big or bigger is TWO
 *  groups - the first half (rounded up) where the hunt begins, the rest at a spot of their own on the same pixel,
 *  stood once the first is dead and the hunter has followed the clue close. Which group stands is read off the kills
 *  alone, so a load, a party mate's machine and the wire need nothing new. A dungeon's pack (2-4) is never split. */
export const BOUNTY_SPLIT_MIN = 6;
/** The groups a posting is hunted in: [first, second] or [all]. Which group stands is read off the hunt's kills - the
 *  party's, since AUDIT 28 B4 (each holder's pose carries its `k`, and a holder takes the most any of them reports). */
export function bountyGroups(p) {
  if (!p || p.kind === 'dungeon' || p.count < BOUNTY_SPLIT_MIN) return [p?.count ?? 0];
  const first = Math.ceil(p.count / 2);
  return [first, p.count - first];
}
/** Which group a held bounty is on, by its kills: 0 the first, 1 the second. */
export const bountyStage = (p, killed) => { const g = bountyGroups(p); return g.length > 1 && killed >= g[0] ? 1 : 0; };
/** How long to wait before asking the world again about a pack that is still far off, seconds. */
const FAR_RECHECK_S = 1.5;

/** A shared bounty older than this many days is not taken up - its board is gone. */
const SHARE_MAX_AGE_DAYS = 1;

/** The refusals the board's Take speaks. */
export const BOUNTY_REFUSALS = Object.freeze({
  held: 'You have already taken this bounty.',
  paid: 'You have already claimed this bounty today.',
  full: `You can hold no more than ${BOUNTY_ACTIVE_MAX} bounties at once.`,
  bad: 'That notice is too faded to read.',
  party: 'Your party has already claimed this bounty today.',   // AUDIT 28 B1: a hunt a mate cleared is done
});

/**
 * @param {{
 *   now: () => number,                       // classic minutes, the world's clock
 *   level: () => number,                     // the player's level
 *   entity: () => any,                       // the player entity (gold, items)
 *   townName: (px:number, py:number) => string,
 *   regionAt?: (px:number, py:number) => number,   // REP4: the board's region, for the law's thanks
 *   siteOk: (x:number, y:number) => boolean, // may a pack stand on this map pixel
 *   dungeonAt?: (x:number, y:number) => (string|null),   // the game's own dungeon on this pixel, by name
 *   graveyardAt?: (x:number, y:number) => (string|null),   // GRAVEYARD-BOUNTY: the graveyard on this pixel, by name - its hunt stands outside it
 *   playerPixel: () => ({x:number, y:number} | null),     // outdoors: my pixel; elsewhere null
 *   dungeonPixel?: () => ({x:number, y:number} | null),   // in a dungeon: its entrance's pixel; elsewhere null
 *   canStand: () => boolean,                 // outdoors, awake, not on a journey, not in the water
 *   canStandDungeon?: () => boolean,         // underground, awake, no window up
 *   standPack: (o:{id:string, mobileType:number, count:number, stage:number, farm:boolean, target?:{px:number, py:number},
 *     farmKey?:string, huntKey?:string}) => ({ foes: Promise<any[]>, dx:number, dz:number } | { far:true, dx:number, dz:number } | null),
 *   standDungeonPack?: (o:{id:string, mobileType:number, count:number}) => ({ foes: Promise<any[]>, dx:number, dz:number } | null),
 *   foePool?: () => any[],                   // the exterior pool's live list - a pack member gone from it is gone
 *   say: (line:string) => void,
 *   showNotice: (n:any) => boolean,          // raise the reward notice; false while another window holds the screen
 *   openBoardWindow: (deps:any) => void,     // raise the board's window
 *   social?: () => ({ acct:string|null, inParty:boolean, mates:Array<{acct:string, name:string, p:any, online?:boolean}> } | null),
 *   posePixel?: () => ({x:number, y:number} | null),   // the pixel my party pose says I stand on (AUDIT 28 B8)
 *   rolls?: () => number,
 * }} deps `standPack` answers `far` when the group waits at its spot (the farm, the second group's): the host names
 *   the way and asks again as the hunter closes in
 */
export function createBountyHost(deps) {
  const rolls = deps.rolls ?? Math.random;
  let ledger = newBountyLedger();
  /** slotKey -> the id I was paid for (today's), for the pose's `c` rows */
  let paidIds = new Map();
  /** id -> { foes: any[] | null, pending: boolean, retryAt: number, told: boolean } - the pack standing now */
  const packs = new Map();
  /** notices waiting for the screen */
  const notices = [];
  /** the sites of each town's board, by "px,py" - the map does not change under a session */
  const sitesCache = new Map();
  let clock = 0, acc = 0;
  let boardView = null;   // the open board window's { repaint } - so a kill or a lapse redraws it
  /** the bounties I have been told a party mate is standing the pack of (said once) */
  const toldOwner = new Set();
  /** BOUNTY-TRAIL: the ways already named - `${id}:${stage}` -> the words (the quest log repeats the latest) */
  const clues = new Map();
  /** BOUNTY-TIER: the shares across tiers already told (said once) */
  const tierRefused = new Set();
  /** AUDIT 28 B2: a pack whose bounty was given up, by its notice - taken again, its live beasts are the hunt's again */
  const orphans = new Map();

  const sitesFor = (px, py) => {
    const k = `${px},${py}`;
    let s = sitesCache.get(k);
    if (!s) sitesCache.set(k, s = bountySites(px, py, deps.siteOk));
    return s;
  };
  /** the dungeons in each town's reach, by "px,py" - the game's own, so the same on every client */
  const dungeonsCache = new Map();
  const dungeonsFor = (px, py) => {
    const k = `${px},${py}`;
    let d = dungeonsCache.get(k);
    if (!d) dungeonsCache.set(k, d = bountyDungeons(px, py, deps.dungeonAt, deps.graveyardAt));
    return d;
  };
  const postingOf = (id) => {
    const b = parseBountyId(id);
    if (!b) return null;
    return postingFromId(id, { name: deps.townName(b.px, b.py), sites: sitesFor(b.px, b.py), dungeons: dungeonsFor(b.px, b.py) });
  };
  const social = () => { try { return deps.social?.() ?? null; } catch { return null; } };
  const repaint = () => { try { boardView?.repaint?.(); } catch { /* the window's own problem */ } };

  // ── save ──────────────────────────────────────────────────────────
  const reset = (rec) => {
    ledger = readBountyLedger(rec);
    paidIds = new Map();
    for (const id of Array.isArray(rec?.paidIds) ? rec.paidIds : []) {
      const b = parseBountyId(id);
      if (b && ledger.paid.includes(b.slotKey)) paidIds.set(b.slotKey, id);
    }
    // AUDIT 28 B6: a pack whose bounty the load still holds keeps its beasts - a same-dungeon load patches them in place
    // (the dungeon's save carried them), and a second pack stood beside them doubled the hunt; a pack whose beasts the
    // load took away is found empty by the next tick, and what is left stands again. The kills are on the row.
    for (const k of [...packs.keys()]) if (k.startsWith('retry:') || !ledger.held.some((h) => h.id === k)) packs.delete(k);
    orphans.clear();
    notices.length = 0;
    clues.clear(); toldOwner.clear(); tierRefused.clear();   // AUDIT 28 B9: the ways named are this session's - named again
  };
  registerModSaveData(BOUNTY_VENDOR, {
    newSaveData: () => newBountyLedger(),
    getSaveData: () => ({ ...ledger, paidIds: [...paidIds.values()] }),
    restoreSaveData: (rec) => reset(rec),
  });

  // ── the journal (Mac: "i also dont see the bounty in my questlog means i cant abandon it?") ──
  setBountyJournal({
    abandon: (id) => drop(id).ok,
    share: (id) => share(id).ok,
    canShare: (id) => !!social()?.inParty && ledger.held.some((h) => h.id === id && !h.shared),
  });
  const line = (text) => ({ formatting: 'text', text });
  /** My bounties as the quest log's active quests (scenes/questBridge.js questLog's own shape): filed as side quests,
   *  the notice as the entry, the kills, the place and the purse under it, and the time left as the quest's clock. */
  function questLogEntries() {
    const now = deps.now();
    return ledger.held.map((h) => {
      const p = postingOf(h.id);
      if (!p) return null;
      const where = p.kind === 'dungeon' && !p.graveyard
        ? `Where: ${p.place}, ${p.dir} of ${p.town.name} - marked on your map with a black circle.`
        : `Where: ${p.far} ${p.dir} of ${p.town.name} - marked on your map with a black circle.`;
      const lines = [p.tierLabel, p.story, '', `Slain: ${h.killed} of ${p.count} ${p.foes}.`, where, `Reward: ${p.gold} gold pieces and a piece of kit.`];
      // BOUNTY-TRAIL: where the hunt stands in its two groups, and the last way named
      const groups = bountyGroups(p);
      if (groups.length > 1) {
        const stage = bountyStage(p, h.killed);
        lines.push(stage === 0
          ? `They move in two groups: ${groups[0]} first, then ${groups[1]} more.`
          : `The first group is dead. ${p.count - h.killed} ${p.foes} fled - follow their trail.`);
        const clue = clues.get(`${h.id}:${stage}`);
        if (clue) lines.push(clue);
      }
      if (h.from) lines.push(`Shared with you by ${h.from}.`);
      return {
        id: `${BOUNTY_QUEST_PREFIX}${h.id}`, name: `Bounty: ${p.title}`, questName: 'BOUNTY', bounty: true,
        clockSeconds: bountyMinutesLeft(h, now) * 60,
        messages: [lines.map(line)],
      };
    }).filter(Boolean);
  }

  // ── the board ─────────────────────────────────────────────────────
  /** What a mate is hunting from this board: slotKey -> [{ id, name }]. */
  const matesOnBoard = () => {
    const out = new Map();
    const s = social();
    if (!s?.inParty) return out;
    for (const m of s.mates ?? []) {
      for (const r of Array.isArray(m?.p?.bq) ? m.p.bq : []) {
        if (r.c) continue;
        const b = parseBountyId(r.i);
        if (!b || !bountyTierFits(r.i, deps.level())) continue;   // BOUNTY-TIER: only a hunt I could join shows as one
        const list = out.get(b.slotKey) ?? [];
        list.push({ id: r.i, name: String(m.name ?? 'A companion') });
        out.set(b.slotKey, list);
      }
    }
    return out;
  };

  /** The board's rows for a town, as I read them now. */
  function boardRows(town) {
    const now = deps.now();
    const day = bountyDay(now);
    const posts = boardPostings({ day, px: town.px, py: town.py, name: town.name, level: deps.level(), sites: sitesFor(town.px, town.py), dungeons: dungeonsFor(town.px, town.py) });
    const mates = matesOnBoard();
    return posts.map((p) => {
      const held = ledger.held.find((h) => parseBountyId(h.id)?.slotKey === p.slotKey) ?? null;
      const joined = mates.get(p.slotKey) ?? [];
      // a mate's copy wins what the row SHOWS when I have not taken it: joining their hunt is joining their pack
      const shown = held ? (postingOf(held.id) ?? p) : (joined.length ? (postingOf(joined[0].id) ?? p) : p);
      return {
        posting: shown,
        state: postingState(ledger, p),
        mates: joined.map((j) => j.name),
        held: held ? { killed: held.killed, left: bountyMinutesLeft(held, now), shared: !!held.shared } : null,
      };
    });
  }

  /** The bounties I hold, for the window's list. */
  const heldRows = () => {
    const now = deps.now();
    return ledger.held.map((h) => ({ id: h.id, posting: postingOf(h.id), killed: h.killed, left: bountyMinutesLeft(h, now), shared: !!h.shared, from: h.from ?? null }))
      .filter((r) => r.posting);
  };

  /** AUDIT 28 B1: a mate's cleared row for this hunt, if any - the hunt is done for the party today. */
  const mateCleared = (huntKey) => {
    const s = social();
    if (!s?.inParty) return null;
    for (const m of s.mates ?? []) for (const r of Array.isArray(m?.p?.bq) ? m.p.bq : []) if (r.c && bountyHuntKey(r.i) === huntKey) return r;
    return null;
  };
  /** AUDIT 28 B12: a notice taken as MY bounty - a mate's copy (Join the hunt, a share) rebuilt at my level where its tier
   *  is mine, so the piece it pays is minted for me; the hunt (slot and tier) is the same. */
  const mine = (id) => { const lv = deps.level(); return bountyTierFits(id, lv) ? (bountyIdAtLevel(id, lv) ?? id) : id; };
  /** AUDIT 28 B2: a pack given up and taken again - its live beasts are the hunt's again, never a second pack. */
  const adopt = (slotKey, id) => {
    const o = orphans.get(slotKey);
    orphans.delete(slotKey);
    if (!o?.foes) return;
    const pool = deps.foePool?.() ?? null;
    const alive = o.foes.filter((f) => !f._bountyCounted && !f.dead && (!pool || pool.includes(f)));
    if (!alive.length) return;
    for (const f of o.foes) f.bountyId = id;
    packs.set(id, o);
  };
  function take(given) {
    const id = mine(given);
    if (mateCleared(bountyHuntKey(id))) return { ok: false, text: BOUNTY_REFUSALS.party };
    const done = takeBounty(ledger, id, deps.now());
    if (!done.ok) return { ok: false, text: BOUNTY_REFUSALS[done.reason] ?? BOUNTY_REFUSALS.bad };
    const b = parseBountyId(id);
    if (b) adopt(b.slotKey, id);
    const p = postingOf(id);
    if (p) deps.say(`Bounty taken: ${p.title}. It is marked on your map.`);
    repaint();
    return { ok: true };
  }
  function drop(id) {
    const p = postingOf(id);
    if (!dropBounty(ledger, id)) return { ok: false };
    const pack = packs.get(id);
    packs.delete(id);
    if (pack && p) orphans.set(p.slotKey, pack);   // AUDIT 28 B2: kept for a retake, with its kills (dropBounty)
    if (p) deps.say(`You gave up the bounty on the ${p.foes}.`);
    repaint();
    return { ok: true };
  }
  function share(id) {
    const row = ledger.held.find((h) => h.id === id);
    const s = social();
    if (!row || !s?.inParty) return { ok: false };
    row.shared = true;
    const p = postingOf(id);
    if (p) deps.say(`You shared the bounty on the ${p.foes} with your party.`);
    // BOUNTY-TIER (Mac: "he prob gets a notifiaction that the one he wants to share to is too low level"): name every
    // mate whose tier shuts them out - from their pose's level (a mate on an older client, with none, is not named)
    const shut = [];
    for (const m of s.mates ?? []) {
      const lv = m?.p?.lv;
      if (!Number.isSafeInteger(lv) || bountyTierFits(id, lv)) continue;
      shut.push({ name: String(m.name ?? 'A companion'), lv, low: lv < (parseBountyId(id)?.level ?? lv) });
    }
    for (const m of shut) deps.say(`${m.name} (level ${m.lv}) is too ${m.low ? 'low' : 'high'} level to take this bounty, but can still help you hunt.`);
    repaint();
    return { ok: true, shut };
  }

  /** The board's press: the window, over the town's notices. */
  function openBoard(town) {
    if (!town || !Number.isFinite(town.px) || !Number.isFinite(town.py)) return false;
    const t = { px: town.px, py: town.py, name: town.name || deps.townName(town.px, town.py) || 'Town' };
    deps.openBoardWindow({
      town: t,
      rows: () => boardRows(t),
      held: () => heldRows(),
      now: () => deps.now(),
      nextDayIn: () => MINUTES_PER_DAY - (deps.now() % MINUTES_PER_DAY),
      inParty: () => !!social()?.inParty,
      take, drop, share,
      attach: (view) => { boardView = view; },
      detach: () => { boardView = null; },
    });
    return true;
  }

  // ── paying ────────────────────────────────────────────────────────
  function pay(id, { byMate = null } = {}) {
    const posting = postingOf(id);
    const row = payBounty(ledger, id, deps.now());
    if (!row || !posting) return false;
    paidIds.set(posting.slotKey, id);
    packs.delete(id);
    const entity = deps.entity();
    const item = mintBountyItem(posting.level, { rolls });
    addGoldPieces(entity, posting.gold);
    if (Array.isArray(entity?.items)) addItem(entity.items, item);
    // REP4 (Mac: "Earn it + faster drift" - regional contracts): the board's region thinks better of the hunter who
    // cleared its road - two points of its law (standing.js rewardContract), said by the law's own notice
    const region = deps.regionAt?.(posting.town.px, posting.town.py);
    if (Number.isInteger(region) && region >= 0 && entity) rewardContract(entity, region);
    const reward = bountyRewardRows(posting.gold, item);
    notices.push({
      title: BOUNTY_REWARD_TITLE,
      heading: posting.title,
      story: rewardStory({ town: posting.town.name, gold: posting.gold, itemName: bountyItemName(item) }, Math.floor(rolls() * 1e9)),
      byMate,
      reward,
    });
    deps.say(`Bounty fulfilled: ${posting.title}. +${posting.gold} gold, ${reward.item}.`);
    repaint();
    return true;
  }

  // ── the party's word ──────────────────────────────────────────────
  function partyTick(now) {
    const s = social();
    if (!s?.inParty) return;
    const today = bountyDay(now);
    for (const m of s.mates ?? []) {
      for (const r of Array.isArray(m?.p?.bq) ? m.p.bq : []) {
        const b = parseBountyId(r.i);
        if (!b) continue;
        // BOUNTY-TIER: the same HUNT is the same slot in the same tier - a mate's clear in another tier is theirs alone
        const hunt = bountyHuntKey(r.i);
        const held = ledger.held.find((h) => bountyHuntKey(h.id) === hunt);
        if (r.c) {   // a mate cleared it: whoever of us held that hunt BEFORE the clear is paid (AUDIT 28 B1)
          if (held && bountyClearPays(r, held.takenAt)) pay(held.id, { byMate: String(m.name ?? 'A companion') });
          continue;
        }
        if (!r.s || today - b.day > SHARE_MAX_AGE_DAYS) continue;
        if (ledger.held.some((h) => parseBountyId(h.id)?.slotKey === b.slotKey)) continue;   // I hold that notice already
        if (!bountyTierFits(r.i, deps.level())) {
          // a share across tiers is not taken up - but the hunter may still help (they see its farm and its beasts)
          if (!tierRefused.has(r.i)) {
            tierRefused.add(r.i);
            const p = postingOf(r.i);
            if (p) deps.say(`${m.name ?? 'A companion'} shared a bounty meant for ${b.level > deps.level() ? 'stronger' : 'weaker'} hunters (${p.title}). You cannot take it, but you can help them hunt.`);
          }
          continue;
        }
        if (ledger.paid.includes(b.slotKey) || ledger.dropped.includes(b.slotKey) || ledger.held.length >= BOUNTY_ACTIVE_MAX) continue;
        if (mateCleared(hunt)) continue;   // AUDIT 28 B1: a share of a hunt the party already cleared is done
        const id = mine(r.i);   // AUDIT 28 B12: at my level
        const done = takeBounty(ledger, id, now, { shared: true, from: String(m.name ?? '') });
        const p = done.ok ? postingOf(id) : null;
        if (p) { deps.say(`${m.name ?? 'A companion'} shared a bounty with you: ${p.title}. It is marked on your map.`); repaint(); }
      }
    }
    // AUDIT 28 B4: the hunt's kills are the party's - the most any holder of it reports
    for (const h of ledger.held) {
      const p = postingOf(h.id);
      const k = Math.min(p?.count ?? 0, bountyPartyKills(s.mates, bountyHuntKey(h.id)));
      if (k > h.killed) { h.killed = k; repaint(); }
    }
  }

  // ── packs ─────────────────────────────────────────────────────────
  const killedOf = (f) => !!f?.dead && (!!f.corpse || (Number(f.entity?.health) || 0) <= 0);

  function packTick(now) {
    const outside = deps.playerPixel();
    const below = deps.dungeonPixel?.() ?? null;
    const s = social();
    for (const row of [...ledger.held]) {
      const p = postingOf(row.id);
      if (!p) continue;
      let pack = packs.get(row.id);
      // the kills, as their corpses fall
      if (pack?.foes) {
        for (const f of pack.foes) {
          if (f._bountyCounted || !killedOf(f)) continue;
          f._bountyCounted = true;
          const before = bountyStage(p, row.killed);
          row.killed = Math.min(p.count, row.killed + 1);
          if (before === 0 && bountyStage(p, row.killed) === 1 && row.killed < p.count) {
            deps.say(`The first group is dead - but ${p.count - row.killed} ${p.foes} got away. Look for their trail.`);
          }
          repaint();
        }
        if (row.killed >= p.count) { pay(row.id); continue; }
        // every beast either dead or gone (culled, cleared by a load): the pack is over - what is left stands again
        const pool = deps.foePool?.() ?? null;
        if (pack.foes.every((f) => f._bountyCounted || f.dead || (pool && !pool.includes(f)))) { packs.delete(row.id); pack = null; }
      }
      if (pack) continue;
      // WHERE the pack stands: the open-ground hunt on its pixel in the open air, the dungeon hunt inside its dungeon
      // (a dungeon holds the player's pixel at its entrance, which is the dungeon's own pixel)
      // GRAVEYARD: the pack stands in the open air outside it (the open-ground stand), never down in the crypt
      const underground = p.kind === 'dungeon' && !p.graveyard;
      const here = underground ? below : outside;
      if (!here || here.x !== p.target.px || here.y !== p.target.py) continue;
      if (underground ? !(deps.canStandDungeon?.() ?? false) : !deps.canStand()) continue;
      // one pack for the party: the owner stands it, the others fight its puppets - the place as the POSES say it (AUDIT
      // 28 B8: underground my pose's pixel, which is what my mates' poses carry, never the dungeon's map-table one)
      const pose = deps.posePixel?.() ?? null;
      const owner = bountyPackOwner(s?.inParty ? s.acct : null, s?.inParty ? s.mates : [], bountyHuntKey(row.id), pose ? { px: pose.x, py: pose.y } : p.target, underground ? 1 : 0);
      if (owner && s?.acct && owner !== s.acct) {
        if (!toldOwner.has(row.id)) { toldOwner.add(row.id); deps.say(`Your party is already on the trail of the ${p.foes} here.`); }
        continue;
      }
      const retry = packs.get(`retry:${row.id}`);
      if (retry && retry.at > clock) continue;
      // BOUNTY-TRAIL: only the group the kills say is next - the first group, then the rest
      const groups = bountyGroups(p);
      const stage = bountyStage(p, row.killed);
      const remaining = Math.max(1, stage === 0 ? groups[0] - row.killed : p.count - row.killed);
      const stood = underground
        ? (deps.standDungeonPack?.({ id: row.id, mobileType: p.mobileType, count: remaining }) ?? null)
        : deps.standPack({ id: row.id, mobileType: p.mobileType, count: remaining, stage, farm: !!p.farm && stage === 0, target: p.target, farmKey: p.slotKey, huntKey: bountyHuntKey(row.id) });
      if (!stood) { packs.set(`retry:${row.id}`, { at: clock + BOUNTY_RETRY_S }); continue; }
      if ('far' in stood) {
        // the group waits at its spot: name the way once, then ask again as the hunter closes in
        const key = `${row.id}:${stage}`;
        if (!clues.has(key)) {
          const m = Math.max(10, Math.round(Math.hypot(stood.dx, stood.dz) / 10) * 10);
          const way = compass8(stood.dx, stood.dz);
          const words = stage === 1
            ? `You find tracks leading away from the bodies: the rest of the ${p.foes} fled ${m} metres to the ${way}.`
            : `The farmstead lies ${m} metres to the ${way}.`;
          clues.set(key, words);
          deps.say(words);
          repaint();
        }
        packs.set(`retry:${row.id}`, { at: clock + FAR_RECHECK_S });
        continue;
      }
      packs.delete(`retry:${row.id}`);
      const entry = { foes: /** @type {any[]|null} */ (null) };
      packs.set(row.id, entry);
      const metres = Math.round(Math.hypot(stood.dx, stood.dz));
      deps.say(underground
        ? `You hear ${p.foes} somewhere deeper in ${p.place} - ${remaining} of them, about ${metres} metres away.`
        : `You spot ${remaining} ${p.foes}, ${metres} metres to the ${compass8(stood.dx, stood.dz)}!`);
      Promise.resolve(stood.foes).then((foes) => {
        const list = (foes ?? []).filter(Boolean);
        if (packs.get(row.id) !== entry) return;
        if (!list.length) { packs.delete(row.id); packs.set(`retry:${row.id}`, { at: clock + BOUNTY_RETRY_S }); return; }
        for (const f of list) f.bountyId = row.id;
        entry.foes = list;
      }).catch(() => { if (packs.get(row.id) === entry) packs.delete(row.id); });
    }
  }

  // ── the tick ──────────────────────────────────────────────────────
  function tick(dt) {
    clock += dt;
    acc += dt;
    if (acc < BOUNTY_TICK_S) { showNextNotice(); return; }
    acc = 0;
    const now = deps.now();
    // AUDIT 28 B10: a bounty taken "later" than now was taken on another clock (an offline save played online): it
    // runs from now, never for days, and never lapses before it began
    for (const h of ledger.held) if (h.takenAt > now) h.takenAt = now;
    for (const gone of lapseBounties(ledger, now)) {
      const p = postingOf(gone.id);
      packs.delete(gone.id);
      if (p) deps.say(`The bounty on the ${p.foes} has lapsed.`);
      repaint();
    }
    const today = bountyDay(now);
    pruneBountyLedger(ledger, today);
    for (const [k, id] of paidIds) if (!ledger.paid.includes(k)) paidIds.delete(k);
    partyTick(now);
    packTick(now);
    showNextNotice();
  }

  function showNextNotice() {
    if (!notices.length) return;
    if (deps.showNotice(notices[0])) notices.shift();
  }

  return {
    openBoard, tick, take, drop, share,
    /** The black circles, for both maps. */
    mapMarks: () => ledger.held.map((h) => {
      const p = postingOf(h.id);
      return p ? { cx: p.target.px + 0.5, cy: p.target.py + 0.5, r: BOUNTY_RING_R, label: p.place ? `${p.foes} - ${p.place}` : p.foes, id: h.id,
        place: p.kind === 'dungeon', farmKey: p.farm ? p.slotKey : null } : null;   // BOUNTY-SNAP: what the Overworld's click walks to
    }).filter(Boolean),
    /** The quest log's rows for my bounties (the world host folds them into questBridge.questLog). */
    questLogEntries,
    /** BOUNTY-FARM: the farm bounties I hold - their farms stand while I do (scenes/bountyFarms.js). */
    // BOUNTY-TIER: and my party's - a helper who cannot hold a bounty of another tier still sees the farm they hunt at
    farmsWanted: () => {
      const ids = new Set(ledger.held.map((h) => h.id));
      const s = social();
      if (s?.inParty) for (const m of s.mates ?? []) for (const r of Array.isArray(m?.p?.bq) ? m.p.bq : []) if (!r.c && parseBountyId(r.i)) ids.add(r.i);
      // one farm a NOTICE (keyed by its slot, not by an id - two holders at two levels see one farm, in one place)
      const out = new Map();
      for (const p of [...ids].map((id) => postingOf(id))) if (p?.farm && !out.has(p.slotKey)) out.set(p.slotKey, { id: p.slotKey, px: p.target.px, py: p.target.py });
      return [...out.values()];
    },
    /** My pose's `bq` - a row's `a` while its pack stands here. */
    poseField: () => bountyPoseField(ledger, paidIds, { standing: (id) => packs.has(id) }),
    held: () => heldRows(),
    pendingNotices: () => notices.length,
    /** AUDIT 28 H12: a notice taken down unread goes back to the front of the queue - never dropped. */
    requeue: (n) => { if (n && !notices.includes(n)) notices.unshift(n); },
    /** Test seams. */
    _ledger: () => ledger,
    _packs: () => packs,
    _reset: reset,
  };
}

/** Scene east/north metres to an eight-point word. */
export function compass8(dx, dz) {
  if (!dx && !dz) return 'north';
  const a = (Math.atan2(dz, dx) * 180) / Math.PI;
  const words = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return words[((Math.round(a / 45) % 8) + 8) % 8];
}
