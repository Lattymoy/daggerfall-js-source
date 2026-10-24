// @ts-check
// SHIP-CREW (2026-09-30, Mac: "Let's do #1" - named crew with morale, and deck orders the crew follow) - THE PLAYER'S
// OWN CREW AS PEOPLE: who they are, how their spirits stand, and what they were last told to do. Pure: the host
// (scenes/naval/navalHost.js) keeps one per boat of the player's, steps it and tells it what happened; the save keeps it
// (`snapshot` / `restore`). DECLARED - Daggerfall has no ships, and Come Sail Away's crew is a count.
//
// WHO THEY ARE. The hands a crewed boat stands on her deck (crewLife.js playerCrewCount) each have a name - DFU's own
// NameHelper.FullName over the waters' bank (navalShips.js names a captain the same way), drawn off the boat's seed
// and the hire's number, so a name never changes while its hand lives - and a ROLE by where they stand in the roster:
// the first her First Mate, a Bard her Bard, the rest Bosun, Gunner, Carpenter, Lookout, Cook, Deckhand in turn. Each
// remembers the FIGHTS won and the BOARDINGS stood with this ship. A hand the guns take (the roster shorter) FALLS,
// named - the last to join first, her First Mate last; a hand hired joins with a new name.
//
// THEIR SPIRITS (Mac: "Gentle" - no wages, no desertion). MORALE 0-100, MORALE_START a new crew's. A win, a prize, a
// hold filled and a round of grog raise it; a hand lost and a wreck lower it; the sea wears it down a point every
// SEA_DECAY_S away from port, and a port lifts it a point every PORT_RISE_S, as far as PORT_CAP. It NUDGES: the guns'
// reload (`reloadScaleOf`, MORALE_RELOAD either way), the mending (`mendScaleOf`, MORALE_MEND either way), a boarding's
// hands (`handsBonusOf`, one more in high spirits, one fewer in low), what they say (`moraleLine`) and whether they sing
// (none below SING_MIN).
//
// THE CREW_ORDERS. CREW_ORDERS - her guns manned (a quicker reload, GUNS_RELOAD; the crew at the guns), all hands to the rail (one
// more hand to a boarding; the crew at the rail), repairs (the carpenter's stores spent - navalYard.js seaRepair), and
// stand down (their own work again). An order stands until another is given, or the work it was is done.
//
// CAPT-CREW (2026-10-11, the owner: "make the decisions and completely make this as detailed as possible, providing depth
// without overcomplicating systems" - bible/03-World/Captains-Sea.md) - A HAND'S SERVICE, AND WHAT HIS POST IS WORTH. Every
// hand already counted the fights won and the boardings stood with her; now they count. His SERVICE (`serviceOf`) is his
// fights and twice his boardings, and it ranks him (VETERANCY): Green, Seasoned, Veteran, Old Salt. A POST is worth
// something now, and more in a seasoned hand (POST_WORTH, `crewWorth`): her Gunner quickens the guns' reload, her
// Carpenter the mending, her Lookout's eye reaches further (the glass, the hail - navalHost.js), her Cook keeps the sea's
// wear off their spirits, her Bosun gets a little more way out of her canvas, and a First Mate who has stood boardings
// brings a hand or two more over the rail. Only a post's best holder aboard counts - a hand ashore with the captain
// (CREW-COMPANIONS) works no post at sea - so a veteran lost is a loss, and the plain law holds: no post, no worth.
import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { fullName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { MOBILE } from './navalBoarding.js';

/** A new crew's spirits, and the range. */
export const MORALE_START = 60;
export const MORALE_MAX = 100;
/** What lifts them, and what wears them (points). A hand lost costs HAND_LOST, a fight's losses at most LOSSES_CAP. */
export const MORALE_EVENT = Object.freeze({ win: 10, prize: 6, plunder: 3, grog: 15, handLost: -3, wrecked: -15, knocked: -4 });   // CREW-COMPANIONS: one of theirs carried back aboard (crewCompanions.js)
export const LOSSES_CAP = -15;
/** AUDIT CC-D4: a fight's losses are counted as one while each comes within this of the last (s) - a boarding's dead,
 *  lost after the colours came down, spent the NEXT fight's cap, and a hostile at the edge of reach handed out new ones. */
export const LOSSES_WINDOW_S = 60;
/** The sea wears a point off every SEA_DECAY_S away from port (sea seconds); a port lifts one every PORT_RISE_S up to
 *  PORT_CAP (above it, only a win or a round lifts them). */
export const SEA_DECAY_S = 150;
export const PORT_RISE_S = 20;
export const PORT_CAP = 75;
/** High spirits and low: a hand more to a boarding at HIGH_SPIRITS and over, a hand fewer at LOW_SPIRITS and under; no
 *  song under SING_MIN. */
export const HIGH_SPIRITS = 80;
export const LOW_SPIRITS = 20;
export const SING_MIN = 30;
/** How far spirits move the reload and the mending at their ends (a share, either way). */
export const MORALE_RELOAD = 0.12;
export const MORALE_MEND = 0.25;
/** Her guns manned: their reload this much quicker. */
export const GUNS_RELOAD = 0.88;

/** The orders a captain gives from her deck. */
export const CREW_ORDERS = Object.freeze({ guns: 'guns', rail: 'rail', repair: 'repair', stand: 'stand' });
/** Each order's words - the list's row, and what the crew answers. */
export const ORDER_TEXT = Object.freeze({
  guns: Object.freeze({ label: 'Man the guns', said: 'Guns manned, Captain!' }),
  rail: Object.freeze({ label: 'All hands to the rail', said: 'All hands to the rail!' }),
  repair: Object.freeze({ label: 'Make repairs', said: 'Carpenter\'s crew to work!' }),
  stand: Object.freeze({ label: 'Stand down', said: 'Aye, Captain. Standing down.' }),
});

/** The roles after her First Mate (and a Bard her Bard), dealt in turn. */
export const ROLES = Object.freeze(['Bosun', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Deckhand']);
/** SHIP-WATCH: the role whose hand keeps her bow (AUDIT WK-W10: the card's Lookout is her lookout). */
export const LOOKOUT_ROLE = 'Lookout';
/** The role of the hand who answers for her (the roster's first, dealt; HOLDINGS: given). */
export const FIRST_MATE = 'First Mate';
/** HOLDINGS (bible/03-World/Holdings.md, Mac: "Named crew companions should be able to be assigned to certain roles, and
 *  be positioned accordingly to their role"): the posts a captain gives her hands - her First Mate and the roles dealt.
 *  A Bard keeps his calling until given another, and is given it back; one First Mate to a ship. */
export const CREW_ROLES = Object.freeze([FIRST_MATE, ...ROLES]);

/** The spirits, in words, by the lowest morale each begins at. */
export const SPIRITS = Object.freeze([
  Object.freeze({ at: 85, key: 'roaring', label: 'Roaring' }),
  Object.freeze({ at: 65, key: 'high', label: 'High' }),
  Object.freeze({ at: 45, key: 'steady', label: 'Steady' }),
  Object.freeze({ at: 25, key: 'low', label: 'Low' }),
  Object.freeze({ at: 0, key: 'grim', label: 'Grim' }),
]);
/** @param {number} m */
export const spiritsOf = (m) => SPIRITS.find((s) => m >= s.at) ?? SPIRITS[SPIRITS.length - 1];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Spirits as a share either way of steady: -1 at none, 0 at 50, +1 at the top. */
export const moraleFactor = (m) => clamp((m - 50) / 50, -1, 1);
/** The guns' reload scaled by spirits and her guns manned (lower is quicker). */
export const reloadScaleOf = (m, order = null) => (1 - MORALE_RELOAD * moraleFactor(m)) * (order === CREW_ORDERS.guns ? GUNS_RELOAD : 1);
/** Her hands' mending scaled by spirits. */
export const mendScaleOf = (m) => 1 + MORALE_MEND * moraleFactor(m);
/** A boarding's hands more or fewer: spirits, and all hands to the rail. */
export const handsBonusOf = (m, order = null) => (m >= HIGH_SPIRITS ? 1 : 0) - (m <= LOW_SPIRITS ? 1 : 0) + (order === CREW_ORDERS.rail ? 1 : 0);

/** What a crew says of their spirits and their work - high, low, a veteran's, the repairs'. */
export const MORALE_LINES = Object.freeze({
  high: Object.freeze([
    'Best crew on the Iliac Bay, and don\'t you forget it!', 'Captain\'s luck is holding.', 'I\'d follow this ship to Oblivion.',
    'A fine voyage, this.', 'Another prize like the last and I\'ll buy a farm.', 'Sing up, lads!',
  ]),
  low: Object.freeze([
    'How long since we saw port?', 'My bones ache for a tavern bench.', 'Hardtack again...', 'This voyage will be the death of us.',
    'Hope the captain knows what they\'re doing.', 'I miss dry land.',
  ]),
  repair: Object.freeze([
    'Pitch here!', 'Hand me that plank.', 'Mind the caulking iron!', 'It\'ll hold, give it time.', 'More oakum!', 'Patch that sail!',
  ]),
  guns: Object.freeze(['Guns manned!', 'Powder ready!', 'Shot in, rammed home!', 'Waiting on your word, Captain!']),
  rail: Object.freeze(['All hands to the rail!', 'Blades out, lads!', 'Nobody sets foot on our deck!']),
});

// ── CAPT-CREW: service, veterancy and the posts' worth ────────────────────────────────────────────────────────────────
/** A hand's service: his fights won and twice his boardings stood (a boarding is the harder school) - and the service he
 *  brought aboard (`prior`: a Seasoned hire's, AUDIT CAPTAIN'S SEA C8 - kept apart, never told as fights he won with her). */
export const serviceOf = (h) => Math.max(0, (h?.fights ?? 0) | 0) + 2 * Math.max(0, (h?.boardings ?? 0) | 0) + Math.max(0, (h?.prior ?? 0) | 0);
/** The ranks of service, by the least service each begins at - lowest first. */
export const VETERANCY = Object.freeze([
  Object.freeze({ tier: 0, at: 0, key: 'green', label: 'Green' }),
  Object.freeze({ tier: 1, at: 4, key: 'seasoned', label: 'Seasoned' }),
  Object.freeze({ tier: 2, at: 12, key: 'veteran', label: 'Veteran' }),
  Object.freeze({ tier: 3, at: 30, key: 'oldsalt', label: 'Old Salt' }),
]);
/** A hand's rank of service (VETERANCY's row). */
export function veteranOf(h) {
  const s = serviceOf(h);
  let v = VETERANCY[0];
  for (const r of VETERANCY) if (s >= r.at) v = r;
  return v;
}
/** The service a hand hired as Seasoned starts with (the Admiralty's hires - navalHost.js, a Commodore's harbour). */
export const SEASONED_HIRE = VETERANCY[1].at;
/**
 * What each post is worth, by its best holder's rank of service: `base` a Green hand's, `per` each rank more. The kinds:
 *   reload - her guns' reload times (1 - worth)            Gunner: 4% quicker Green, 13% an Old Salt
 *   mend   - her hands' mending and repairs times (1 + worth)  Carpenter: 15% to 45%
 *   sight  - her lookout's reach times (1 + worth)          Lookout: 10% to 40% (the glass, the hail, a colour called)
 *   wear   - the sea's wear on spirits over (1 + worth)     Cook: spirits last 25% to 100% longer at sea
 *   way    - her way under sail times (1 + worth)           Bosun: 1% to 4%
 *   hands  - a boarding's hands more, by rank (`hands`)     First Mate: one more a Veteran, two an Old Salt
 */
export const POST_WORTH = Object.freeze({
  Gunner: Object.freeze({ kind: 'reload', base: 0.04, per: 0.03 }),
  Carpenter: Object.freeze({ kind: 'mend', base: 0.15, per: 0.1 }),
  Lookout: Object.freeze({ kind: 'sight', base: 0.1, per: 0.1 }),
  Cook: Object.freeze({ kind: 'wear', base: 0.25, per: 0.25 }),
  Bosun: Object.freeze({ kind: 'way', base: 0.01, per: 0.01 }),
  'First Mate': Object.freeze({ kind: 'hands', hands: Object.freeze([0, 0, 1, 2]) }),
});
/** A post's worth at a rank of service (0..3): a share, or a First Mate's hands. */
export const postWorth = (role, tier) => {
  const p = /** @type {Record<string, any>} */ (POST_WORTH)[role];
  if (!p) return 0;
  const t = Math.max(0, Math.min(VETERANCY.length - 1, tier | 0));
  return p.kind === 'hands' ? p.hands[t] : Math.round((p.base + p.per * t) * 10000) / 10000;
};
/**
 * Her posts as they stand aboard: each post of POST_WORTH's held by a hand aboard (none of `away`'s names) - its best
 * holder, by his rank of service (the first in her roster where two stand level) - `{ [role]: { name, tier, label } }`.
 * @param {{ name: string, role: string, fights?: number, boardings?: number }[]} hands @param {Set<string>|null} [away]
 */
export function postsOf(hands, away = null) {
  /** @type {Record<string, { name: string, tier: number, label: string }>} */
  const out = {};
  for (const h of hands ?? []) {
    if (!h || !POST_WORTH[h.role] || away?.has(h.name)) continue;
    const v = veteranOf(h);
    if (!out[h.role] || v.tier > out[h.role].tier) out[h.role] = { name: h.name, tier: v.tier, label: v.label };
  }
  return out;
}
/**
 * WHAT HER POSTS ARE WORTH, as the sea reads them: `reload` (the guns' reload times this), `mend` (the mending's),
 * `sight` (her lookout's reach), `wear` (the sea's wear on spirits is divided by this), `way` (her way under sail),
 * `hands` (a boarding's hands more) - and `posts`, postsOf's. A crew with no posts aboard: every one 1, and no hands.
 * @param {{ name: string, role: string, fights?: number, boardings?: number }[]} hands @param {Set<string>|null} [away]
 */
export function crewWorth(hands, away = null) {
  const posts = postsOf(hands, away);
  const w = (role) => (posts[role] ? postWorth(role, posts[role].tier) : 0);
  return {
    reload: 1 - w('Gunner'), mend: 1 + w('Carpenter'), sight: 1 + w('Lookout'), wear: 1 + w('Cook'), way: 1 + w('Bosun'),
    hands: w('First Mate'), posts,
  };
}
/** A crew with no posts' worth - what a boat with no crew, or none aboard, reads. */
export const NO_WORTH = Object.freeze({ reload: 1, mend: 1, sight: 1, wear: 1, way: 1, hands: 0, posts: Object.freeze({}) });
/** What a post at a rank of service does, in a captain's words (the Fleet page's crew panel) - '' for a post worth
 *  nothing at that rank (a Green or Seasoned First Mate) or no post of POST_WORTH's. */
export function postWords(role, tier) {
  const w = postWorth(role, tier), pc = (x) => `${Math.round(x * 100)}%`;
  if (!w) return '';
  if (role === 'Gunner') return `the guns reload ${pc(w)} quicker`;
  if (role === 'Carpenter') return `the crew repairs ${pc(w)} faster`;
  if (role === 'Lookout') return `the lookout sees ${pc(w)} further`;
  if (role === 'Cook') return `spirits last ${pc(w)} longer at sea`;
  if (role === 'Bosun') return `${pc(w)} more way under sail`;
  if (role === 'First Mate') return `${w} more ${w === 1 ? 'hand' : 'hands'} over the rail`;
  return '';
}

/** A hand's role by where he stands in her roster (`i`), his class and how many of her hands hold each post already
 *  (`held`): her First Mate first, a Bard her Bard, the rest the first of ROLES held by the fewest - every post once, then
 *  each a second time, as the roster has always been dealt; AUDIT CAPTAIN'S SEA C7: a hand who joins fills the post a
 *  fallen or reassigned hand left (it was dealt by count - a third Bosun while her Cook's post stood empty).
 *  @param {number} i @param {number} mobile @param {Map<string, number>} held */
const roleOf = (i, mobile, held) => (i === 0 ? FIRST_MATE : mobile === MOBILE.Bard ? 'Bard' : ROLES.reduce((best, r) => ((held.get(r) ?? 0) < (held.get(best) ?? 0) ? r : best), ROLES[0]));

/**
 * A hand's name: NameHelper.FullName over the waters' bank, on the boat's seed and the hire's number (DFU's own global
 * stream put back as it stood).
 * @param {number} seed @param {number} hire @param {'male'|'female'} gender @param {number} regionIndex
 */
export function handName(seed, hire, gender, regionIndex = 17) {
  const s = (Math.imul((seed >>> 0) ^ 0x7a3d, 0x9e3779b1) + Math.imul(hire + 1, 0x85ebca6b)) >>> 0;
  const saved = getSeed();
  try {
    srand(s || 1);
    const bank = getNameBankOfRegion(regionIndex >= 0 && regionIndex < REGION_NAMES.length ? regionIndex : 17);
    return fullName(bank, gender === 'female' ? GENDERS.Female : GENDERS.Male);
  } finally { setSeed(saved); }
}

/**
 * One boat's crew as people.
 * @param {{ seed: number, regionIndex?: number, record?: any }} o - `record` a save's (`snapshot()`), or none: a new crew
 */
export function createShipCrew({ seed, regionIndex = 17, record = null }) {
  /** @type {{ name: string, role: string, mobile: number, gender: 'male'|'female', fights: number, boardings: number, prior: number, hall?: string, lift?: number }[]} */
  let hands = [];
  let morale = MORALE_START, hires = 0, seaT = 0, portT = 0, losses = 0, lossT = 0;
  /** AUDIT CC-D5: the world's day her crew last drank the yard's round (one a port day). */
  let grogDay = null;
  /** @type {string} */
  let order = CREW_ORDERS.stand;
  // AUDIT CC-D3: the standing order rides the save (one not CREW_ORDERS' own stands down); the grog's day with it
  if (record && typeof record === 'object') {
    const m = Number(record.morale);
    morale = Number.isFinite(m) ? clamp(m, 0, MORALE_MAX) : MORALE_START;
    hires = Number.isInteger(record.hires) && record.hires >= 0 ? record.hires : 0;
    if (Array.isArray(record.hands)) {
      hands = record.hands.filter((h) => h && typeof h.name === 'string').slice(0, 64).map((h) => ({
        name: h.name, role: typeof h.role === 'string' ? h.role : 'Deckhand', mobile: Number.isInteger(h.mobile) ? h.mobile : MOBILE.Warrior,
        gender: h.gender === 'female' ? 'female' : 'male', fights: Math.max(0, h.fights | 0), boardings: Math.max(0, h.boardings | 0),
        prior: clamp(h.prior | 0, 0, VETERANCY[VETERANCY.length - 1].at),   // AUDIT CAPTAIN'S SEA C8: a hire's service, kept apart
        // AUDIT SHIPYARDS: a hall's recruit keeps his hall id (the roster's exclusion) and the spirits he lifted (given back
        // when he is paid off) - each only where the save carries it
        ...(typeof h.hall === 'string' && h.hall ? { hall: h.hall } : {}),
        ...(Number.isFinite(h.lift) && h.lift > 0 ? { lift: Math.min(MORALE_MAX, h.lift) } : {}),
      }));
    }
    hires = Math.max(hires, hands.length);
    if (typeof record.order === 'string' && /** @type {string[]} */ (Object.values(CREW_ORDERS)).includes(record.order)) order = record.order;
    if (Number.isFinite(record.grogDay)) grogDay = record.grogDay;
  }
  const rng = mulberry32(((seed >>> 0) ^ 0x3c7e11) >>> 0);
  const bump = (d) => { morale = clamp(morale + d, 0, MORALE_MAX); };

  return {
    get morale() { return morale; },
    get order() { return order; },
    get hands() { return hands; },
    spirits: () => spiritsOf(morale),
    /**
     * Her roster as it stands on her deck now (crewLife.js crewRoster: each a class and a sex): the named hands made to
     * match it - more joining with new names, fewer falling (the last to join first). Answers who fell and who joined.
     * CAPT-CREW: `service` the service a hand joining now brings aboard (SEASONED_HIRE - a Commodore's harbour's hires), none
     * else - his `prior`, never told as fights he won with her (AUDIT CAPTAIN'S SEA C8).
     * @param {{ mobile: number, gender: string }[]} roster @param {{ service?: number }} [o]
     */
    sync(roster, { service = 0 } = {}) {
      const fell = [], joined = [];
      const start = Math.max(0, Math.min(VETERANCY[VETERANCY.length - 1].at, service | 0));
      while (hands.length > roster.length) fell.push(hands.pop());
      for (let i = hands.length; i < roster.length; i++) {
        const r = roster[i];
        /** @type {'male'|'female'} */
        const gender = r.gender === 'female' ? 'female' : 'male';
        const held = new Map();
        for (const x of hands) held.set(x.role, (held.get(x.role) ?? 0) + 1);
        const h = { name: handName(seed, hires++, gender, regionIndex), role: roleOf(i, r.mobile, held), mobile: r.mobile, gender, fights: 0, boardings: 0, prior: start };
        hands.push(h);
        joined.push(h);
      }
      return { fell, joined };
    },
    /** A hand's name by where he stands (null past the roster). @param {number} i */
    nameOf: (i) => hands[i]?.name ?? null,
    /**
     * HOLDINGS: a hand given a post - one of CREW_ROLES, or a Bard's own calling back. She has one First Mate: the one she
     * had stands down to Deckhand. Answers `{ ok, text }`.
     * @param {string} name @param {string} role
     */
    assign(name, role) {
      const h = hands.find((x) => x.name === name);
      if (!h) return { ok: false, text: 'There\'s no crew member by that name aboard.' };
      const bard = role === 'Bard' && h.mobile === MOBILE.Bard;
      if (!/** @type {readonly string[]} */ (CREW_ROLES).includes(role) && !bard) return { ok: false, text: 'There\'s no such post on this ship.' };
      if (role === LOOKOUT_ROLE && h.mobile === MOBILE.Bard) return { ok: false, text: `${h.name} leads the songs and doesn't keep lookout.` };   // AUDIT HOLDINGS C3: her bow is never a Bard's (crewLife.js canLook)
      if (h.role === role) return { ok: true, text: `${h.name} is already the ${role}.` };
      if (role === FIRST_MATE) for (const o of hands) if (o !== h && o.role === FIRST_MATE) o.role = 'Deckhand';
      h.role = role;
      return { ok: true, text: `${h.name} is now the ${role}.` };
    },
    /**
     * SHIPYARDS (systems/crewHall.js): A RECRUIT SIGNED ON BY NAME - he joins her roster's end (the last to join, the
     * first the guns take, as every hire), at his trade's post (a First Mate: the one she had stands down to Deckhand,
     * assign's law), his record with him; `lift` her crew's spirits (a seasoned man steadies them). A name already
     * aboard her is refused. The host raises her crew to stand him on her deck (crewHall.js enlistPlan), so the next
     * sync finds her roster whole. His hall id (`r.hall`) and the spirits he actually lifted ride him - AUDIT SHIPYARDS
     * L2-4: paid off, he takes them with him, so signing a man on and off again pumps nothing. Answers the hand, or null.
     * @param {{ name: string, role: string, mobile: number, gender: string, fights?: number, boardings?: number, hall?: string }} r
     * @param {number} [lift]
     */
    enlist(r, lift = 0) {
      if (!r || typeof r.name !== 'string' || !r.name || hands.some((h) => h.name === r.name)) return null;
      const bard = r.role === 'Bard' && r.mobile === MOBILE.Bard;
      const role = /** @type {readonly string[]} */ (CREW_ROLES).includes(r.role) || bard ? r.role : 'Deckhand';
      if (role === FIRST_MATE) for (const o of hands) if (o.role === FIRST_MATE) o.role = 'Deckhand';
      /** @type {'male'|'female'} */
      const gender = r.gender === 'female' ? 'female' : 'male';
      // AUDIT CAPTAIN'S SEA C8 (at the merge of SHIPYARDS): a hall's recruit brings his record as his deeds - the fights and
      // boardings he has stood, SHIPYARDS' law - and none kept apart (`prior` is a sign-on's service, which no hall gives)
      /** @type {{ name: string, role: string, mobile: number, gender: 'male'|'female', fights: number, boardings: number, prior: number, hall?: string, lift?: number }} */
      const h = { name: r.name, role, mobile: Number.isInteger(r.mobile) ? r.mobile : MOBILE.Warrior, gender, fights: Math.max(0, r.fights | 0), boardings: Math.max(0, r.boardings | 0), prior: 0 };
      if (typeof r.hall === 'string' && r.hall) h.hall = r.hall;
      hands.push(h);
      hires = Math.max(hires + 1, hands.length);
      if (Number.isFinite(lift) && lift > 0) {
        const was = morale;
        bump(lift);
        if (morale > was) h.lift = morale - was;
      }
      return h;
    },
    /** SHIPYARDS: a named hand paid off - out of her roster wherever he stood in it (the host lowers her crew by his share
     *  - crewHall.js releasePlan). Answers the hand, or null. @param {string} name */
    release(name) {
      const i = hands.findIndex((h) => h.name === name);
      if (i < 0) return null;
      const h = hands.splice(i, 1)[0];
      if (Number.isFinite(h.lift) && h.lift > 0) bump(-h.lift);   // AUDIT SHIPYARDS L2-4: the spirits he brought leave with him
      return h;
    },
    /** A hand's name and role, as he is called: "Aldric Wayrest, Bosun". @param {number} i */
    calledOf: (i) => (hands[i] ? `${hands[i].name}, ${hands[i].role}` : null),
    /**
     * What happened: 'win' (a ship struck to her), 'prize' (one taken), 'plunder' (her hold filled), 'grog' (a round),
     * 'handLost' (`n` of her crew's points lost - a fight's losses at most LOSSES_CAP until `fightOver`), 'wrecked', and
     * 'boarding' (a boarding stood - each hand's count).
     * @param {string} kind @param {number} [n]
     */
    event(kind, n = 1) {
      if (kind === 'handLost') {
        if (!Number.isFinite(n)) return;   // AUDIT CC-D4: a NaN loss saved as null and loaded as no spirits at all
        if (lossT > LOSSES_WINDOW_S) losses = 0;
        lossT = 0;
        const d = Math.max(LOSSES_CAP - losses, MORALE_EVENT.handLost * Math.max(0, n));
        losses += d;
        bump(d);
        return;
      }
      if (kind === 'win') for (const h of hands) h.fights++;
      if (kind === 'boarding') { for (const h of hands) h.boardings++; return; }
      const d = MORALE_EVENT[kind];
      if (typeof d === 'number') bump(d);
    },
    /** A fight over: the next one's losses counted afresh. */
    fightOver() { losses = 0; },
    /**
     * The spirits' clock: `atSea` away from port wears them down a point every SEA_DECAY_S; `inPort` lifts them a point
     * every PORT_RISE_S as far as PORT_CAP. CAPT-CREW: `wear` her Cook's worth (crewWorth) - the sea's clock runs that
     * many times slower on them.
     * @param {number} dt @param {{ atSea?: boolean, inPort?: boolean, wear?: number }} where
     */
    tick(dt, { atSea = false, inPort = false, wear = 1 } = {}) {
      if (!(dt > 0)) return;
      lossT += dt;
      if (inPort) {
        seaT = 0;
        // AUDIT CC-D4: a long step spent at once (a backlog drained a point a frame after it)
        if (morale < PORT_CAP) { portT += dt; const k = Math.floor(portT / PORT_RISE_S); if (k > 0) { portT -= k * PORT_RISE_S; morale = Math.min(PORT_CAP, morale + k); } } else portT = 0;
      } else if (atSea) {
        portT = 0;
        seaT += dt / (Number(wear) > 1 ? Number(wear) : 1); const k = Math.floor(seaT / SEA_DECAY_S); if (k > 0) { seaT -= k * SEA_DECAY_S; bump(-k); }   // AUDIT CAPTAIN'S SEA C10: a NaN wear reads none
      }
    },
    /** The order given - CREW_ORDERS' own words; answers whether it was one. @param {string} o */
    give(o) {
      if (!/** @type {string[]} */ (Object.values(CREW_ORDERS)).includes(o)) return false;
      order = o;
      return true;
    },
    /**
     * A line of theirs by their spirits or their order - or null for the crew's own (crewLife.js's calm words). The
     * order's work first; then high spirits or low, a third of the time.
     */
    line() {
      /** @type {readonly string[] | undefined} */
      const work = order !== CREW_ORDERS.stand ? /** @type {Record<string, readonly string[]>} */ (MORALE_LINES)[order] : undefined;
      if (work) return work[Math.floor(rng() * work.length)];
      const s = morale >= 70 ? MORALE_LINES.high : morale <= 35 ? MORALE_LINES.low : null;
      if (!s || rng() >= 1 / 3) return null;
      return s[Math.floor(rng() * s.length)];
    },
    /** Whether they sing (low spirits sing no chanties). */
    sings: () => morale >= SING_MIN,
    /** The crew as the save keeps them. */
    /** AUDIT CC-D5: whether her crew drank the yard's round on the world's day `day`, and the round drunk. */
    grogOn: (day) => day != null && grogDay === day,
    drankGrog(day) { if (Number.isFinite(day)) grogDay = day; },
    snapshot: () => ({ morale: Math.round(morale * 10) / 10, hires, hands: hands.map((h) => ({ ...h })), order, grogDay }),
  };
}

/**
 * The crew's card - the roster's lines as a captain reads them: her spirits, then each hand, his role, and what he
 * has stood with her.
 * @param {{ morale: number, hands: { name: string, role: string, fights: number, boardings: number }[] }} crew
 * @param {{ ship?: string, order?: string, ashore?: Set<string>|null }} [o]
 */
export function crewCard(crew, { ship = 'Your ship', order = CREW_ORDERS.stand, ashore = null } = {}) {
  const s = spiritsOf(crew.morale);
  const lines = [`${ship}'s crew - spirits ${s.label} (${Math.round(crew.morale)} of ${MORALE_MAX}).`];
  if (order && order !== CREW_ORDERS.stand) lines.push(`Standing order: ${ORDER_TEXT[order].label}.`);
  if (!crew.hands.length) lines.push('No hands aboard.');
  for (const h of crew.hands) {
    const deeds = [h.fights ? `${h.fights} ${h.fights === 1 ? 'fight' : 'fights'}` : '', h.boardings ? `${h.boardings} ${h.boardings === 1 ? 'boarding' : 'boardings'}` : ''].filter(Boolean).join(', ');
    const v = veteranOf(h);   // CAPT-CREW: a hand's rank of service, from Seasoned up
    lines.push(`${h.name}, ${h.role}${deeds ? ` - ${deeds}` : ''}${v.tier > 0 ? ` - ${v.label}` : ''}${ashore?.has(h.name) ? ' - ashore with you' : ''}`);   // AUDIT CC-D8: a hand ashore said so
  }
  return lines;
}

/**
 * The orders list a captain picks from (the helm panel's Orders, the boat's menu): a crewed boat's four, a boat with no
 * crew its repairs and standing down (she has no hands to man her guns or her rail); the order standing marked.
 * @param {{ crewed: boolean, order?: string }} o
 * @returns {{ id: string, label: string }[]}
 */
export function orderRows({ crewed, order = CREW_ORDERS.stand }) {
  const ids = crewed ? [CREW_ORDERS.guns, CREW_ORDERS.rail, CREW_ORDERS.repair, CREW_ORDERS.stand] : [CREW_ORDERS.repair, CREW_ORDERS.stand];
  return ids.map((id) => ({ id, label: id === order && id !== CREW_ORDERS.stand ? `${ORDER_TEXT[id].label} (standing)` : ORDER_TEXT[id].label }));
}
