// @ts-check
// HUNTERS-MARK (2026-10-27; a player, handed on by the owner: "Add more horizontal progression please!"; bible/06-Systems/
// Bounty-Boards.md section 12): THE HUNTER'S RANK AND THE WEEK'S NAMED MARK, wired by scenes/bountyHost.js. Online alone:
// the rank is the account service's, kept by the hunt's book (net/huntBook.js).
//
// A NAMED MARK: one beast of the reader's tier a week, the same at every board (huntLaw.js huntMarkOf), on one of the
// board's own sites - an elite under its name with two boss traits off the week's seed. It pays gold and a mounted
// trophy, never kit; its clear is reported as a board's, one a week a character.
import { createHuntBook, setHuntBook } from '../net/huntBook.js';
import {
  huntWeekAt,
  huntMarkOf,
  huntMarkId,
  parseHuntMarkId,
  huntMarkSite,
  huntMarkGold,
  huntMarksOpen,
  huntRungOf,
  huntNextRung,
  HUNT_RUNGS,
  HUNT_MARK_NAMES,
} from '../net/huntLaw.js';
import { wallMsForClassicMinutes } from '../net/wire.js';
import { seatWeekStartMs, SEAT_WEEK_MS } from '../net/townSeatLaw.js';
import {
  compassWord,
  distanceWord,
  bountyTierLabel,
  bountyTierIndex,
  BOUNTY_MAP_LINE,
} from '../systems/bounty/bountyBoard.js';
import { BOUNTY_QUEST_PREFIX } from '../systems/bounty/bountyJournal.js';
import { giveBossTraits } from '../systems/bossTraits.js';
import { promoteEliteFoe, withdrawEliteLoot } from '../systems/eliteFoes.js';
import { huntMarkTraits } from '../systems/hunt/namedMark.js'; // HUNTERS-MARK-II: the week's traits, one home - a mate reads the mark off them
import { addGoldPieces } from '../systems/inventory.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { giveTrophy, trophyTitle, trophyItemName } from '../systems/hunt/trophies.js';
import { t } from '../systems/textManager.js';
import { accountHunt } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { characterIdOf } from '../systems/characterId.js';
import { BOUNTY_RING_R } from '../ui/bounty/bountyMapMark.js';
import { TITLE_RGBA, cssRgba } from '../ui/playerBadge.js';

export const HUNT_MARK_VENDOR = 'huntersMark';
export { HUNT_MARK_TRAITS, huntMarkTraits } from '../systems/hunt/namedMark.js';
/** How long after a failed stand the next try waits, and how often a far mark is asked again (s) - the board's own. */
const RETRY_S = 4,
  FAR_S = 1.5;

/** The online world's hunt deps, built here so the host's scope does not grow (HOST-SPLIT): the ledger's door and its
 *  store, the save told. Null offline: the rank and the marks are the service's alone. */
export function huntOnline(/** @type {boolean} */ online, /** @type {{ changed: () => void }} */ saveSoon) {
  if (!online) return null;
  return {
    door: accountHunt({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }),
    storage: appStorage(),
    saved: () => saveSoon.changed(),
  };
}

/**
 * @param {{ hunt?: { door: any, storage?: any, character?: () => (string|null), saved?: () => void } | null,
 *   now: () => number, level: () => number, entity: () => any, townName: (px: number, py: number) => string,
 *   regionAt?: (px: number, py: number) => number, sitesFor: (px: number, py: number) => Array<[number, number]>,
 *   playerPixel: () => ({x: number, y: number} | null), canStand: () => boolean, standPack: (o: any) => any,
 *   foePool?: () => any[], say: (line: string) => void, notice: (n: any) => void, repaint: () => void, wallNow?: () => number }} deps
 */
export function createHuntersMark(deps) {
  const book = deps.hunt?.door
    ? createHuntBook({
        door: deps.hunt.door,
        storage: deps.hunt.storage ?? null,
        character: deps.hunt.character ?? (() => characterIdOf(deps.entity())),
        now: () => wallNow(),
      })
    : null;
  setHuntBook(book);
  book?.onChange(() => deps.repaint()); // the service's word redraws an open board's header
  /** The online world's wall clock: the event clock's own instant (a mark's week is the seats'). */
  const wallNow = () => deps.wallNow?.() ?? wallMsForClassicMinutes(deps.now());
  let held = /** @type {{ id: string, takenAt: number } | null} */ (null);
  let done = new Set(); // the weeks this character's mark was paid here (the service's word joins it - markDone)
  let pack = /** @type {{ foes: any[] | null } | null} */ (null);
  let retryAt = 0,
    clock = 0;
  registerModSaveData(HUNT_MARK_VENDOR, {
    newSaveData: () => ({ held: null, done: [] }),
    getSaveData: () => ({ held, done: [...done] }),
    restoreSaveData: (rec) => {
      held =
        parseHuntMarkId(rec?.held?.id) && Number.isFinite(rec?.held?.takenAt)
          ? { id: rec.held.id, takenAt: rec.held.takenAt }
          : null;
      done = new Set((Array.isArray(rec?.done) ? rec.done : []).filter((w) => Number.isSafeInteger(w)));
      pack = null;
    },
  });
  const clears = () => book?.state?.clears ?? null;
  const week = () => huntWeekAt(wallNow());
  const doneThisWeek = () => done.has(week()) || book?.state?.markDone === true;

  /** A mark's posting, the board's shape (systems/bounty/bountyBoard.js bountyPosting), from its id - or null. */
  function postingOf(/** @type {string} */ id) {
    const m = parseHuntMarkId(id);
    if (!m) return null;
    const site = huntMarkSite(m.week, m.px, m.py, deps.sitesFor(m.px, m.py));
    if (!site) return null;
    const { foe, name, tier } = huntMarkOf(m.week, m.level);
    const nameIndex = HUNT_MARK_NAMES.indexOf(name);
    const town = deps.townName(m.px, m.py) || t('hunt.mark.town', 'town');
    const dir = compassWord(site[0] - m.px, site[1] - m.py);
    const far = distanceWord(Math.max(Math.abs(site[0] - m.px), Math.abs(site[1] - m.py)));
    const title = trophyTitle(foe, nameIndex);
    return {
      id,
      slotKey: `m.${m.week}`,
      week: m.week,
      level: m.level,
      mark: true,
      foe,
      nameIndex,
      mobileType: foe,
      count: 1,
      foes: title,
      town: { px: m.px, py: m.py, name: town },
      target: { px: site[0], py: site[1] },
      kind: 'field',
      place: null,
      graveyard: false,
      farm: false,
      tier: tier + 1,
      tierLabel: bountyTierLabel(m.level),
      title,
      dir,
      far,
      story: t(
        'hunt.mark.story',
        '{title} has been seen {far} {dir} of {town}. It has killed hunters before. Bring it down this week.',
        { title, far, dir, town },
      ),
      poster: t('hunt.mark.poster', 'the hunters of {town}', { town }),
      mapLine: BOUNTY_MAP_LINE,
      gold: huntMarkGold(m.level),
      traits: huntMarkTraits(m.week, tier),
    };
  }
  /** This board's mark for its reader: `{ posting, state }` - 'open', 'held' (this week's, from any board), 'paid' - or
   *  null below the marks' rung, offline, or on a board with no ground for it. */
  function boardMark(/** @type {{ px: number, py: number }} */ town) {
    const n = clears();
    if (n == null || !huntMarksOpen(n)) return null;
    const w = week();
    const heldNow = held && parseHuntMarkId(held.id)?.week === w ? held : null;
    const posting = postingOf(heldNow?.id ?? huntMarkId(w, town.px, town.py, deps.level()));
    if (!posting) return null;
    return { posting, state: heldNow ? 'held' : doneThisWeek() ? 'paid' : 'open' };
  }
  /** The board's header: the rung, the clears and this region's, the next rung, the reports still kept - or, for an
   *  account that keeps no rank (a guest's - AUDIT HORIZONTAL F4), that said once instead of a read that never ends. */
  function boardRank(/** @type {{ px: number, py: number }} */ town) {
    const n = clears();
    if (n == null) return book ? (book.closed ? { closed: true } : { reading: true }) : null;
    const region = deps.regionAt?.(town.px, town.py);
    return {
      rung: HUNT_RUNGS[huntRungOf(n)].id,
      clears: n,
      next: huntNextRung(n),
      from: HUNT_RUNGS[huntRungOf(n)].at,
      region: Number.isInteger(region) ? Number(book?.state?.regions?.[/** @type {number} */ (region)] ?? 0) : null,
      waiting: book?.kept().length ?? 0,
    };
  }

  function take(/** @type {string} */ id) {
    const p = postingOf(id);
    if (!p || p.week !== week()) return { ok: false, text: t('hunt.mark.gone', 'That notice has been taken down.') };
    if (held) return { ok: false, text: t('hunt.mark.heldAlready', 'You are already hunting a named beast.') };
    if (doneThisWeek()) return { ok: false, text: t('hunt.mark.doneWeek', "You have slain this week's named beast.") };
    if (!huntMarksOpen(clears() ?? 0))
      return { ok: false, text: t('hunt.mark.rung', 'Named beasts are posted to Stalkers and above.') };
    held = { id, takenAt: wallNow() };
    pack = null;
    deps.say(t('hunt.mark.taken', 'You took the hunt for {title}. It is marked on your map.', { title: p.title }));
    deps.repaint();
    return { ok: true };
  }
  function drop(/** @type {string} */ id = held?.id ?? '') {
    if (!held || held.id !== id) return { ok: false };
    const p = postingOf(held.id);
    held = null;
    pack = null;
    if (p) deps.say(t('hunt.mark.dropped', 'You gave up the hunt for {title}.', { title: p.title }));
    deps.repaint();
    return { ok: true };
  }

  const killedOf = (/** @type {any} */ f) => !!f?.dead && (!!f.corpse || (Number(f.entity?.health) || 0) <= 0);
  /** The beast stood: an elite under its name, its two traits - its drop is the kind's own, the elite's never laid on. */
  function crown(/** @type {any} */ f, /** @type {any} */ p) {
    const e = f?.entity;
    if (!e) return;
    promoteEliteFoe(e, { own: true, checkLevel: false });
    e.raidLeader = { name: p.title }; // its name over it (systems/foeTitle.js) and a leader's size
    withdrawEliteLoot(e); // HUNTERS-MARK-II: an elite its stand rolled keeps no elite's pieces - a mark is never kit
    e.bossTraits = undefined;
    e.bossWard = undefined; // HUNTERS-MARK-II: the week's two in place of any its stand drew as an elite (RAID5's leader's law) - a mate's screen reads the mark off them
    giveBossTraits(e, p.traits);
    f.huntMark = p.id;
  }
  function pay(/** @type {any} */ p) {
    const entity = deps.entity();
    addGoldPieces(entity, p.gold);
    giveTrophy(entity, p.foe, { nameIndex: p.nameIndex, day: Math.floor(wallNow() / 86_400_000) });
    deps.hunt?.saved?.();
    const region = deps.regionAt?.(p.town.px, p.town.py);
    book?.report(p.id, Number.isInteger(region) ? region : null);
    done.add(p.week);
    held = null;
    pack = null;
    deps.notice({
      title: t('hunt.mark.paidTitle', 'Named Beast Slain'),
      heading: p.title,
      byMate: null,
      story: t(
        'hunt.mark.paidStory',
        "Word of {title}'s death reaches {town} before you do. The hunters send a heavy purse, and the beast is yours to mount.",
        { title: p.title, town: p.town.name },
      ),
      reward: {
        gold: t('hunt.mark.gold', '{gold} gold pieces', { gold: p.gold }),
        item: trophyItemName(p.foe, p.nameIndex),
        tier: t('hunt.mark.trophy', 'A mounted trophy'),
        colour: cssRgba(TITLE_RGBA.huntlegend),
        condition: '',
      },
    });
    deps.say(
      t('hunt.mark.paidLine', 'Named beast slain: {title}. +{gold} gold and its trophy.', {
        title: p.title,
        gold: p.gold,
      }),
    );
    deps.repaint();
  }

  function packTick() {
    if (!held) return;
    const p = postingOf(held.id);
    if (!p || p.week < week()) {
      if (p) deps.say(t('hunt.mark.lapsed', 'The week is over. {title} has gone to ground.', { title: p.title }));
      held = null;
      pack = null;
      deps.repaint();
      return;
    }
    if (pack?.foes) {
      if (pack.foes.some(killedOf)) {
        pay(p);
        return;
      }
      const pool = deps.foePool?.() ?? null;
      if (pack.foes.every((f) => f.dead || (pool && !pool.includes(f)))) pack = null; // culled or lost to a load: it stands again
    }
    if (pack || retryAt > clock) return;
    const here = deps.playerPixel();
    if (!here || here.x !== p.target.px || here.y !== p.target.py || !deps.canStand()) return;
    const stood = deps.standPack({
      id: p.id,
      mobileType: p.foe,
      count: 1,
      stage: 0,
      farm: false,
      target: p.target,
      farmKey: p.id,
      huntKey: p.id,
    });
    if (!stood) {
      retryAt = clock + RETRY_S;
      return;
    }
    if ('far' in stood) {
      retryAt = clock + FAR_S;
      return;
    }
    const entry = { foes: /** @type {any[]|null} */ (null) };
    pack = entry;
    deps.say(
      t('hunt.mark.spotted', 'You find the tracks of {title}, {m} meters away. It knows you are here.', {
        title: p.title,
        m: Math.round(Math.hypot(stood.dx, stood.dz)),
      }),
    );
    Promise.resolve(stood.foes)
      .then((foes) => {
        const list = (foes ?? []).filter(Boolean);
        if (pack !== entry) return;
        if (!list.length) {
          pack = null;
          retryAt = clock + RETRY_S;
          return;
        }
        for (const f of list) crown(f, p);
        entry.foes = list;
      })
      .catch(() => {
        if (pack === entry) pack = null;
      });
  }

  return {
    book,
    boardMark,
    boardRank,
    take,
    drop,
    postingOf,
    /** Whether an id is a named mark's (the journal's door, the host's routing). */
    isMark: (/** @type {string} */ id) => !!parseHuntMarkId(id),
    /** A board bounty paid: reported, with its board's region. */
    cleared(/** @type {string} */ id, /** @type {number|null} */ region) {
      book?.report(id, Number.isInteger(region) ? region : null);
    },
    tick(/** @type {number} */ dt) {
      clock += dt;
      book?.tick();
      packTick();
    },
    mapMarks: () => {
      const p = held ? postingOf(held.id) : null;
      return p
        ? [
            {
              cx: p.target.px + 0.5,
              cy: p.target.py + 0.5,
              r: BOUNTY_RING_R,
              label: p.title,
              id: p.id,
              place: false,
              farmKey: null,
            },
          ]
        : [];
    },
    questLogEntries: () => {
      const p = held ? postingOf(held.id) : null;
      if (!p) return [];
      const left = Math.max(0, seatWeekStartMs(p.week) + SEAT_WEEK_MS - wallNow());
      const lines = [
        p.tierLabel,
        p.story,
        '',
        t('hunt.mark.where', 'Where: {far} {dir} of {town}. Marked on your map with a black circle.', {
          far: p.far,
          dir: p.dir,
          town: p.town.name,
        }),
        t('hunt.mark.rewardLine', 'Reward: {gold} gold pieces and its mounted trophy.', { gold: p.gold }),
      ];
      return [
        {
          id: `${BOUNTY_QUEST_PREFIX}${p.id}`,
          name: t('hunt.mark.quest', 'Named beast: {title}', { title: p.title }),
          questName: 'BOUNTY',
          bounty: true,
          clockSeconds: Math.floor(left / 1000),
          messages: [lines.map((text) => ({ formatting: 'text', text }))],
        },
      ];
    },
    /** Test seams. */
    _held: () => held,
    _pack: () => pack,
    _done: () => done,
  };
}
/** The tier a mark's level hunts, for a page that names it. */
export const huntMarkTier = (/** @type {number} */ level) => bountyTierIndex(level) + 1;
