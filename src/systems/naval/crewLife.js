// @ts-check
// LIVING CREW (2026-09-29, Mac: "Crew members shouldnt be the static sprites and instead the enemy type sprites with
// multiple animations, they should navigate the deck, talk with each other, blurb, sing chantys, etc") - ONE SHIP'S
// CREW AT THEIR WORK: who stands on her deck, where each walks, who talks to whom, the lines over their heads and the
// chanty they sing, and - her guns out or a boarding at hand - the rail they muster at. Stepped by its host
// (scenes/naval/navalCrew.js draws them) on her deck (navalDeck.js), in her deck's frame. Pure: a draw seeded by the ship
// (her `seed` - a player's boat by whose and which, AUDIT NAV2 F9), so every player in a room sees the same crew at the
// same kind of work, and no world.
//
// WHO THEY ARE. A ship of the sea's crew is her muster (navalBoarding.js musterOf, by what her crew has left): her
// captain and her men, the first CREW_SHOWN of them standing - and in a boarding the ones standing are the ones who
// fight, where they stand (scenes/naval/navalHost.js takes them). A crewed boat of a player's is a hand's mix (PLAYER_CREW,
// a Bard among them to lead the song), CREW_PER_HAND of her crew a man.
//
// WHERE THEY STAND. The mod's own people flats are where a hull's crew stood (their places at rest, handed in as
// `places`): one on her walkable deck starts a walker there; one off it (the helmsman at her wheel on the poop) is a
// STATION - a man who stays at his post, turning and talking but never walking off it. The rest start spread across
// her deck (`deck.spots`).
//
// SHIP-WATCH (2026-10-01, Mac: "Do #3" - life aboard between fights; shipWatch.js): BY NIGHT (`ctx.asleep`) her crew
// turns in but its watch (shipWatch.js watchCount - her stations, her lookout, then the roster's first): the rest walk
// to her HATCH (her main deck's middle) and go below, off her deck but still hers (`below` - never `gone`: the count
// stands whole and the guns' trim and the mending's restore read them as they were) - at once, never a walk, when she
// first stands by night; the guns, a muster or her colours struck call every hand up at once ("All hands on deck!"),
// and the morning one at a time out of her hatch - never two on one point; a repair order keeps every hand at the work.
// HER LOOKOUT (one walker - never her Bard, nor her captain at his post; her card's Lookout when he can, `ctx.lookout`)
// keeps the bow from the moment she stands, another the moment he is gone, facing out and talking to nobody, and the
// host gives him the calls (`ctx.call`: "Sail ho! Off the starboard bow!"). AT WORK (`ctx.work`, 0..1 - what a fight
// left to mend): an idle man takes up a job at a free spot more often the more there is, swinging at it (his sprite's
// attack, `swing`) - the night watch too - and now and then a chore at peace and by day (CHORE_SHARE), swabbing and
// hauling; the guns or her colours end it.

import { musterOf, MOBILE, CREW_PER_HAND, MUSTER_MIN, MUSTER_MAX } from './navalBoarding.js';
import { seededRng } from '../wind/wind.js';
import { mainLevel, DECK_STEP, FLIGHT_OVER } from './navalDeck.js';
import { watchCount } from './shipWatch.js';

/** A walker's pace on deck (m/s) - an amble, a hurry under fire or to a muster. */
export const CREW_WALK = 1.2;
export const CREW_HURRY = 2.4;
/** How fast a man turns to face (rad/s). */
export const CREW_TURN = 5;
/** How long a man stands before he does something else (s), and how far apart two stand to talk (m). */
export const CREW_IDLE_S = Object.freeze([4, 11]);
export const CREW_TALK_REACH = 1.6;
/** How far a man looks for someone to talk to (m), and how long he waits on someone in his way before he goes
 *  elsewhere (s). */
export const CREW_TALK_SEEK = 14;
export const CREW_BLOCKED_S = 2;
/** How long a line stays over a head (s), and the quiet between one man's blurbs (s). */
export const CREW_LINE_S = 3.4;
export const CREW_BLURB_S = Object.freeze([22, 70]);
/** The quiet between a ship's chanties (s), and the first one's wait. */
export const CHANTY_S = Object.freeze([75, 150]);
export const CHANTY_FIRST_S = Object.freeze([20, 55]);
/** How many of a hull's crew stand on her deck: Rowboat, Large Boat, Small Ship, Large Galley, Carrack. */
export const CREW_SHOWN = Object.freeze([0, 2, 6, 8, 8]);
/** AUDIT NAV2 F40: a boarding imminent calls a crew to the rail within this of the other ship (m, centre to centre) - a
 *  ship closing on her to board (her 'board' course): measured over the real host, a brig, a flagship or a sloop
 *  throws her grapples 15 to 70 s after, a galley under her sweeps 9 to 14 s - time for the muster to stand. */
export const CREW_MUSTER_M = 115;
/** SHIP-WATCH: a job's length (s), the time between a worker's swings (s), the share of a calm man's choices that is a
 *  chore, and the share that is work when a fight left her everything to mend (`ctx.work` 1). */
export const WORK_S = Object.freeze([7, 16]);
export const WORK_SWING_S = Object.freeze([0.9, 1.8]);
export const CHORE_SHARE = 0.15;
export const WORK_SHARE = 0.75;
/** SHIP-WATCH: how far back from her stem the lookout stands (m). */
export const LOOKOUT_BACK = 0.75;
/**
 * HOLDINGS (bible/03-World/Holdings.md, Mac: "Named crew companions should be able to be assigned to certain roles, and
 * be positioned accordingly to their role"): A HAND'S POST BY HIS ROLE (shipCrew.js CREW_ROLES), on her main deck - her
 * First Mate aft by her helm, her Bosun before her mainmast, her Carpenter by her hatch, her Cook forward at her galley's
 * stove, her Gunners at her guns along her waist, starboard and port in turn; her Lookout keeps her bow (SHIP-WATCH), her
 * Deckhands and her Bard go where they will. A second holder of one post stands beside the first.
 */
export const ROLE_POSTS = Object.freeze(['First Mate', 'Bosun', 'Carpenter', 'Cook', 'Gunner']);
/** AUDIT HOLDINGS C2: with none named Lookout, the order a posted hand gives his post up to keep her bow (a hand with
 *  no post first) - her First Mate never. */
export const LOOKOUT_YIELD = Object.freeze(['Gunner', 'Cook', 'Carpenter', 'Bosun']);
/** HOLDINGS: the share of an idle hand's choices that take him back to his post (the rest are his own - a job, a talk, a
 *  walk), and how far off it he stands at it (m). */
export const POST_SHARE = 0.8;
export const POST_REACH = 0.6;
/** HOLDINGS: how much longer a man stands at his post than an idle man stands anywhere. */
export const POST_STAND = 2.5;
/** HOLDINGS: how far apart two posts stand (m), and the ring of places round a post asked for that a taken one moves to
 *  (her frame's metres, nearest first). */
export const POST_APART = 1.0;
const POST_RING = Object.freeze([[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2], [2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]].map((v) => Object.freeze(v)));
/** A player's crew, round and round: the hands' Warriors with the rest of a ship's company - a Bard leads the song. */
export const PLAYER_CREW = Object.freeze([MOBILE.Warrior, MOBILE.Barbarian, MOBILE.Bard, MOBILE.Archer, MOBILE.Warrior, MOBILE.Monk, MOBILE.Rogue, MOBILE.Warrior]);
/** A player's crewed boat stands a man for every CREW_PER_HAND of her crew (at least one while any are aboard). */
export const playerCrewCount = (hull, crew) => (crew > 0 ? Math.min(CREW_SHOWN[hull] ?? 0, Math.max(1, Math.round(crew / CREW_PER_HAND))) : 0);

/** How many of a crew stand on her deck - `crewRoster`'s length, without making one (the world asks it every frame). */
export function crewCount({ hull, shipClass = null, crewShare = 1, crew = 0 }) {
  if (!shipClass) return playerCrewCount(hull, crew);
  const n = Math.min(MUSTER_MAX, Math.max(MUSTER_MIN, Math.round(shipClass.boarders * Math.min(1, Math.max(0, crewShare)))));
  return Math.min(CREW_SHOWN[hull] ?? 0, n);
}

/** The DFU classes whose sprites are human, male or female (all the musters' are). */
const HUMAN = new Set(Object.values(MOBILE));

/**
 * A crew's roster, in the order they stand and fight: a ship of the sea's her captain then her men (`shipClass`, what
 * her crew has left), a player's the hands' mix (`crew`, her crew's count). Each a class and a sex, off the seed.
 * @param {{ hull: number, seed: number, shipClass?: any, crewShare?: number, crew?: number }} o
 * @returns {{ mobile: number, gender: 'male'|'female' }[]}
 */
export function crewRoster({ hull, seed, shipClass = null, crewShare = 1, crew = 0 }) {
  const rng = seededRng(((seed >>> 0) ^ 0x6c1e5ea) >>> 0);
  let mobiles;
  if (shipClass) {
    const m = musterOf(shipClass, crewShare);
    mobiles = [m.captain, ...m.men].slice(0, CREW_SHOWN[hull] ?? 0);
  } else {
    const n = playerCrewCount(hull, crew);
    const start = Math.floor(rng() * PLAYER_CREW.length);
    const round = PLAYER_CREW.map((_, i) => PLAYER_CREW[(start + i) % PLAYER_CREW.length]);
    // AUDIT NAV2 F51: a Bard among any two to lead the song - second in line when the round would come to her later (half
    // the Small Ships had none); a longer roster still begins as the shorter one does
    const bard = round.indexOf(MOBILE.Bard);
    if (bard > 1) round.splice(1, 0, ...round.splice(bard, 1));
    mobiles = Array.from({ length: n }, (_, i) => round[i % round.length]);
  }
  return mobiles.map((mobile) => ({ mobile, gender: HUMAN.has(mobile) && rng() < 0.35 ? 'female' : 'male' }));
}

// ── what they say ────────────────────────────────────────────────────────────────────────────────────────────────

/** A man's own words, by what the ship is about, and by her trade where it colours them. */
export const CREW_BLURBS = Object.freeze({
  calm: Object.freeze([
    'Fair wind today.', 'Mind that line!', 'Smell that salt air.', 'Another day on the Iliac Bay.', 'Steady as we go.',
    'Anyone seen my pipe?', 'Wind\'s backing westerly.', 'Coil it proper, or the bosun\'ll have you.', 'Land\'s near. I can smell it.',
    'Gulls off the bow!', 'Sentinel spice fetches a fine price.', 'Wayrest by week\'s end, mark me.', 'My back\'s not what it was.',
    'Who\'s on the next watch?', 'Swab that, you lubber.', 'Calm as a Wayrest pond.', 'I\'d trade my ration for a dry bunk.',
    'Ever seen the lights of Daggerfall from the water?', 'Haul away!', 'Good ship, this one.',
  ]),
  battle: Object.freeze([
    'Run out the guns!', 'Fire when ready!', 'Reload! Reload!', 'Keep your heads down!', 'Hold fast!',
    'Coming about!', 'Powder, more powder!', 'Mind the rigging!', 'Put the fire out!', 'Steady, lads, steady!',
  ]),
  // CREW-MUSTER (FIELD BUGS 2026-10-14, "Crew Attacking Me"; Mac's call, 2026-10-14: "Both"): A MUSTER'S WORDS ARE ITS
  // SIDE OF THE BOARDING (`ctx.way`, step) - the crew going over the rail cries the boarding's, the crew being boarded
  // the repel's. One list said both, so a crew mustered to board a struck ship cried "Here they come!" and "Nobody sets
  // foot on our deck!" at nobody - the player, at her helm, the only one there to come
  board: Object.freeze(['Grapples - make ready!', 'Over the rail!', 'Blades out, lads!', 'For the ship!']),
  repel: Object.freeze(['Stand by to repel boarders!', 'Here they come!', 'Hold the rail!', 'Nobody sets foot on our deck!']),
  pirate: Object.freeze([
    'Plunder waits for no one.', 'A fat merchant\'d suit me fine.', 'The captain\'s share, the captain\'s share...',
    'Keep a weather eye for the navy.', 'Gold, lads. Think of the gold.',
  ]),
  navy: Object.freeze([
    'For the crown.', 'Eyes sharp. Pirates about.', 'The captain wants everything shipshape.', 'Steady, men.',
  ]),
  merchant: Object.freeze([
    'Mind the cargo!', 'Every crate counted.', 'Pray we meet no pirates.', 'Wine for Sentinel, wool for Wayrest.',
  ]),
  // SHIP-WATCH: the night watch's words, low; a crew at its work; and the call that wakes them
  night: Object.freeze([
    'Quiet watch tonight.', 'Stars are out.', 'Keep it down - the lads are sleeping.', 'Two bells. Long way to dawn.',
    'Mind the lantern.', 'Cold one, this.', 'Hear that? Just the swell.', 'Eyes open, now.',
  ]),
  work: Object.freeze([
    'Swab that deck!', 'Splice that line.', 'Hand me the mallet.', 'Plug that hole, quick!', 'Mind the splinters.',
    'Haul away!', 'Fresh canvas here!', 'Keep the pumps going, lads.', 'Who\'s got the tar?', 'Coil it proper.',
  ]),
  chore: Object.freeze([
    'Swab that deck!', 'Haul away!', 'Coil it proper.', 'Mind that line!', 'Tar\'s gone thin on this rail.',
    'Bosun wants it shipshape.',
  ]),
  // AUDIT NAV2 F46: her colours struck, or her going down - a surrender's few words, never a calm day's
  struck: Object.freeze([
    'We yield! We yield!', 'Hold your fire!', 'Quarter! Give us quarter!', 'It\'s over, lads.', 'Gods preserve us.',
  ]),
});

/** SHIP-WATCH: the call that brings every hand up. */
export const ALL_HANDS = 'All hands on deck!';

/** Two men at their talk - the first says the first line, then each in turn. */
export const CREW_TALKS = Object.freeze([
  Object.freeze(['Heard the court at Daggerfall\'s hiring blades.', 'Aye, and paying in promises.']),
  Object.freeze(['What\'s for supper?', 'Hardtack and regret.', 'Again?']),
  Object.freeze(['You ever seen a sea serpent?', 'Once. Off Anticlere. Never again.']),
  Object.freeze(['Captain\'s in a mood.', 'Captain\'s always in a mood.', 'Fair point.']),
  Object.freeze(['Storm\'s brewing to the west.', 'Then we\'d best make port before it breaks.']),
  Object.freeze(['First round\'s on me when we make port.', 'You said that last time.', 'And I meant it last time too.']),
  Object.freeze(['They say the Orsinium lot are building ships now.', 'Orcs at sea? Gods help us all.']),
  Object.freeze(['How long have you sailed?', 'Since I could walk. Longer, some days.']),
  Object.freeze(['Sentinel or Wayrest?', 'Sentinel. Better wine.', 'Wayrest. Better company.']),
  Object.freeze(['Did you hear that?', 'Just the timbers.', '...I hope.']),
  Object.freeze(['My old mother wanted me a smith.', 'And here you are, hauling rope.', 'She\'d still say I chose wrong.']),
  Object.freeze(['Think we\'ll see a fight this voyage?', 'Pray not. I just mended this shirt.']),
]);

/** The chanties - original to the port: a verse the leader sings, each followed by its chorus the whole crew sings. */
export const CHANTIES = Object.freeze([
  Object.freeze({
    name: 'The Iliac Bay',
    chorus: 'Heave away, haul away, bound for the Iliac Bay!',
    verses: Object.freeze([
      'Oh, we sailed out of Daggerfall under a gray sky,',
      'With a hold full of wool and a keg running dry,',
      'The bosun he swore by Stendarr and by Kyne,',
      'We\'d be drinking in Sentinel ere the next bell\'s chime!',
    ]),
  }),
  Object.freeze({
    name: 'Haul the Line',
    chorus: 'So haul, boys, haul the line!',
    verses: Object.freeze([
      'There\'s a lass in Wayrest with eyes like the sea,',
      'She\'s promised her heart to a sailor like me,',
      'But the wind\'s in the west and the tide\'s running strong,',
      'So I\'ll sing her my love in a hauling song!',
    ]),
  }),
  Object.freeze({
    name: 'The Captain\'s Gold',
    chorus: 'Yo-ho, and away we go!',
    verses: Object.freeze([
      'The captain keeps his gold in a chest by his bed,',
      'He counts it by lantern and sleeps on its head,',
      'But the gold of the sea is the wind and the spray,',
      'And we spend it like kings every day, every day!',
    ]),
  }),
]);

/** A leader's verse or the crew's chorus, sung: the song's own marks round it. */
export const sung = (text) => `♪ ${text} ♪`;

// ── the crew at their work ───────────────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
/** A talk's place round the man he talks to: the side he comes from, then turned a sixth at a time either way. */
const TALK_TURNS = Object.freeze([0, 1, -1, 2, -2, 3].map((k) => k * TAU / 6));
const angleTo = (from, to) => { let d = (to - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
/** A draw in `range` ([lo, hi]). @param {() => number} rng @param {readonly number[]} range */
const within = (rng, range) => range[0] + rng() * (range[1] - range[0]);

/**
 * One ship's crew at their work, in her deck's frame.
 * @param {{
 *   deck: any,
 *   roster: { mobile: number, gender: string }[],
 *   seed: number,
 *   places?: number[][],
 *   faction?: string | null,
 * }} o - `deck` navalDeck.js's; `places` where her own people flats stood (her deck's frame), each a walker's start
 *   on her deck or a station off it
 */
export function createCrewLife({ deck, roster, seed, places = [], faction = null }) {
  const rng = seededRng(((seed >>> 0) ^ 0x51ce11fe) >>> 0);
  // GALLEON (2026-10-01): her hands' work her MAIN deck's - a raised deck her walk joins up its flights (the new
  // galleon's castle, the Carrack's forecastle) is her officers' and her walk's, never where her hands idle: a muster
  // called from her castle's roof was 20 m of walk from the rail, past her grapples' flight
  const main = deck?.y && deck.count ? mainLevel(deck) : NaN;
  const spots = deck?.count ? deck.spots(Math.max(16, roster.length * 3), Number.isNaN(main) ? undefined : main) : [];
  // a flat on her walkable deck starts a walker; one off it (her wheel, her poop) is a station - GALLEON: and one on a
  // raised deck of hers (her castle's: her officer and her coxswain at her helm)
  const onDeck = [], stations = [];
  for (const p of places) (deck?.walkable(p[0], p[2]) && !(p[1] > main + FLIGHT_OVER) ? onDeck : stations).push(p);
  const starts = [...stations.map((p) => ({ p, station: true })), ...onDeck.map((p) => ({ p, station: false })), ...spots.map((p) => ({ p, station: false }))];
  /** The `i`th of her roster, standing at his start. */
  const member = (r, i) => {
    const start = starts[i] ?? { p: deck?.nearest?.(0, 0) ?? [0, 0, 0], station: false };
    return {
      i, mobile: r.mobile, gender: r.gender, station: start.station, post: [...start.p], pos: [...start.p],
      yaw: rng() * TAU, face: null, state: 'idle', t: within(rng, CREW_IDLE_S) * rng(), path: null, leg: 0, speed: CREW_WALK,
      mate: null, talk: null, line: null, blurbT: within(rng, CREW_BLURB_S) * (0.4 + rng()), moving: false, gone: false, taken: false,
      below: false, swing: false, swingT: 0,   // SHIP-WATCH: turned in below; a worker's swing this step
    };
  };
  /** @type {any[]} */
  const members = roster.map(member);
  let chantyT = within(rng, CHANTY_FIRST_S), chanty = null;
  let musterKey = '', quiet = false;
  // SHIP-WATCH: her bow (the lookout's post) and her hatch (where the watch below goes down and comes up), off her deck;
  // her lookout; whether her crew is turned in; the work she has (0..1)
  // GALLEON (2026-10-01): her hatch amidships of her MAIN deck - a raised deck her walk joins (the new galleon's castle
  // up its two flights, the Carrack's forecastle) drew the middle of her whole deck off it, the galleon's onto her
  // mainmast's drum. AUDIT GN-D7: her hatchways are no deck now (their covers open), so the galleon's stands on her
  // deck beside her fore hatchway (1.6 m to port of its middle), never on its cover over the hole - the Carrack's at
  // her cargo hatch's fore end (her main deck's middle lies on her main deck on every hull: its nearest cell is hers)
  const mainExt = deck?.y && deck.count ? deckExtentZ(deck, main) : null;
  // AUDIT GN-D4: her bow her MAIN deck's too, LOOKOUT_BACK from its stem and a cell of it (`nearest` at its level) -
  // her whole deck's ran up the Carrack's forecastle stair, and her lookout kept his watch up there 1460 s of every
  // 1740 (never where her hands idle); her main deck's stem's nearest cell at any level is her stair's, 5.59 m up
  const bow = mainExt && deck?.nearest ? deck.nearest(0, mainExt[1] - LOOKOUT_BACK, main) : null;
  const hatch = deck?.count ? deck.nearest?.(0, mainExt ? (mainExt[0] + mainExt[1]) / 2 : 0) ?? null : null;
  /** @type {any} */ let lookout = null;
  let asleep = false, work = 0;
  // AUDIT WK-W10: the roster place of the hand her card names Lookout (`ctx.lookout`), -1 for none; AUDIT WK-W7: whether
  // she has taken a step; AUDIT WK-W8: whether hands wait below to come up
  let named = -1, stood = false, rising = false;
  // HOLDINGS: her hands' roles by roster place (`ctx.roles`), and the posts on her main deck they keep - made once
  /** @type {readonly (string | null)[]} */ let roles = [];
  /** @type {any} */ let posts;
  /** HOLDINGS: her posts - each role's base place and facing on her main deck, her guns' places along her waist. */
  function rolePosts() {
    if (posts !== undefined) return posts;
    const main = deck?.count ? mainLevel(deck) : NaN;
    const e = deck?.count ? deckExtentZ(deck, main) ?? mainExt : null;   // GALLEON: her whole deck's extent is no longer kept - her main deck's is
    if (!e || !deck?.nearest) return (posts = null);
    const mid = (e[0] + e[1]) / 2, len = Math.max(1, e[1] - e[0]);
    // each post a place of its own: the deck point nearest the one asked for, else the nearest of a ring round it that
    // stands POST_APART from every post taken (her hatch, where the watch goes below, among them)
    const taken = hatch ? [hatch] : [];
    const at = (x, z) => {
      for (const [dx, dz] of POST_RING) {
        const q = deck.nearest(x + dx, z + dz);
        if (q && !taken.some((t) => Math.hypot(t[0] - q[0], t[2] - q[2]) < POST_APART)) { taken.push(q); return q; }
      }
      return null;
    };
    // GALLEON-HOLDINGS: to port of her hatch where her deck lies there and not to starboard - Mac's galleon's hatch
    // stands to port of her open fore hatchway (AUDIT GN-D7), and a post asked in the hole found her deck across it,
    // 3.5 m off
    const cx = hatch && !deck.walkable?.(hatch[0] + 1.1, hatch[2]) && deck.walkable?.(hatch[0] - 1.1, hatch[2]) ? -1.1 : 1.1;
    const carpenter = hatch ? { at: at(hatch[0] + cx, hatch[2]), face: cx > 0 ? -Math.PI / 2 : Math.PI / 2 } : null;
    const guns = [];
    for (let k = 0; k < 6; k++) {
      const side = k % 2 === 0 ? 1 : -1, z = mid + (Math.floor(k / 2) - 1) * Math.min(3, len * 0.15);
      const r = deck.rail?.(side, z, [0, 0, 0], main);
      const p = r ? at(r[0] - side * 0.5, r[2]) : null;
      if (p) guns.push({ at: p, face: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
    return (posts = {
      'First Mate': { at: at(0.8, e[0] + Math.min(2, len * 0.15)), face: 0 },
      Bosun: { at: at(0, mid + Math.min(2.5, len * 0.12)), face: 0 },
      Carpenter: carpenter,
      Cook: { at: at(-0.8, e[1] - Math.min(4, len * 0.25)), face: Math.PI },
      Gunner: guns,
      at,
    });
  }
  /** HOLDINGS: whether `m` stands at his post. */
  const atPost = (m) => { const p = postOf(m); return !!p && Math.hypot(m.pos[0] - p.at[0], m.pos[2] - p.at[2]) <= POST_REACH; };
  /** HOLDINGS: the post `m` keeps by his role - `{ at, face }` - or null: none for his role, a station's man (his own),
   *  her lookout (her bow), or a deck with no room for it. The n-th holder of a post stands beside the first; her n-th
   *  Gunner at her n-th gun. */
  function postOf(m) {
    const role = roles[m.i];
    if (!role || m.station || m === lookout || !ROLE_POSTS.includes(role)) return null;
    const p = rolePosts();
    if (!p) return null;
    let n = 0;
    // AUDIT HOLDINGS C8: a holder gone (ashore, fallen) holds no place - the next stands at the post, not beside it
    for (const o of members) { if (o === m) break; if (roles[o.i] === role && !o.station && o !== lookout && !o.gone) n++; }
    if (role === 'Gunner') {
      if (n < p.Gunner.length) return p.Gunner[n] ?? null;
      if (!p.Gunner.length) return null;
      // AUDIT HOLDINGS C8: a Gunner past her guns (a galley's eight hands) beside one of them, never on its man's spot
      const gun = p.Gunner[n % p.Gunner.length];
      gun.more ??= [];
      const k = Math.floor(n / p.Gunner.length) - 1;
      while (gun.more.length <= k) { const q = p.at(gun.at[0], gun.at[2]); gun.more.push(q ? { at: q, face: gun.face } : null); }
      return gun.more[k] ?? gun;
    }
    const base = p[role];
    if (!base?.at) return null;
    if (!n) return base;
    // the n-th holder of a post: a place of his own beside the first's, made once
    base.more ??= [];
    while (base.more.length < n) { const q = p.at(base.at[0], base.at[2]); base.more.push(q ? { at: q, face: base.face } : null); }
    return base.more[n - 1] ?? base;
  }
  /** SHIP-WATCH: whether `m` can keep her bow - a walker standing, never her Bard (she leads the song); AUDIT WK-W1: nor
   *  a man on his way below. */
  const canLook = (m) => !!m && !m.gone && !m.below && !m.station && m.mobile !== MOBILE.Bard && m.state !== 'turnIn';
  /** SHIP-WATCH: her lookout - never her first man if another will do (her captain); kept while he stands. AUDIT WK-W1:
   *  asked at every step from her first (a loop, no list made), so her bow is kept by day too and another takes it the
   *  step he falls or goes ashore. AUDIT WK-W10: the hand her card names Lookout whenever he can keep it - the one who
   *  kept it for him sent off it (never two at her bow). */
  function pickLookout() {
    const want = members[named];
    if (want !== lookout && canLook(want)) {
      if (lookout && (lookout.state === 'watch' || lookout.state === 'walk')) { lookout.path = null; lookout.state = 'idle'; lookout.t = 0; }
      lookout = want;
    }
    if (lookout && !lookout.gone && !lookout.below) return lookout;
    let first = null, best = null, bestRank = Infinity;
    lookout = null;
    for (let k = 0; k < members.length; k++) {
      const m = members[k];
      if (!canLook(m)) continue;
      if (m.i === 0) { first = first ?? m; continue; }
      // AUDIT HOLDINGS C2: with none named Lookout, a hand with no post keeps her bow - else the one whose post matters
      // least (LOOKOUT_YIELD: a Gunner, her Cook, her Carpenter, her Bosun), never the Bosun the Small Ship's and the
      // Carrack's rosters are dealt while a Gunner stands by; no roles at all, her first hand past her captain as ever
      const role = roles[m.i] ?? '', rank = LOOKOUT_YIELD.indexOf(role);
      const r = role === 'First Mate' ? LOOKOUT_YIELD.length : rank < 0 ? -1 : rank;
      if (r < bestRank) { best = m; bestRank = r; if (r < 0) break; }
    }
    return (lookout = best ?? first);
  }

  const live = () => members.filter((m) => !m.gone && !m.below);
  /** AUDIT GN-D10: whether `m` - a hand, never a station - stands off her main deck (up a flight, on her castle's roof,
   *  on the Carrack's forecastle): her officers' and her walk's, never where her hands idle. A hand gone up to talk
   *  with her officer at the helm comes back down the moment the talk ends, and none waits or is sought there - the
   *  new galleon's eight hands idled, waited and talked among themselves on her castle 380 s of every 1740. */
  const offMain = (m) => !m.station && Math.abs(m.pos[1] - main) > DECK_STEP;
  /** AUDIT GN-T2 (AUDIT NAV2 F41's law): whether another man stands within 0.3 m of `m` - a walk's end free when it was
   *  chosen, taken while he walked (a man whose talk ended on his way stopped beside it: the Carrack's two stood merged
   *  2.5 s once her cargo hatch changed her spots). */
  const onAMan = (m) => members.some((o) => o !== m && !o.gone && !o.below && Math.hypot(o.pos[0] - m.pos[0], o.pos[2] - m.pos[2]) < 0.3);
  const say = (m, text, kind = 'talk') => { m.line = { text, kind, t: CREW_LINE_S }; };
  /** The song dropped with its leader gone - AUDIT NAV2 F47: and the next one CHANTY_S off (it began 0.03 s later). */
  const dropLeader = (m) => { if (chanty?.leader === m) { chanty = null; chantyT = within(rng, CHANTY_S); } };
  /** A walk for `m` to `to` (her deck's frame) - the deck's own path, or none for a station. */
  function walkTo(m, to, speed = CREW_WALK) {
    if (m.station) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S); return false; }
    const path = deck?.path?.([m.pos[0], m.pos[2]], [to[0], to[2]]);
    if (!path || path.length < 2) return false;
    m.path = path; m.leg = 0; m.state = 'walk'; m.speed = speed;   // AUDIT NAV2 F48: from where he stands to its first corner too - straight at the second crossed a cell of no deck
    return true;
  }
  /** Whether `o` stands, or is walking to (his path's end), within `r` of `s`. */
  const claims = (o, s, r = 1.2) => Math.hypot(o.pos[0] - s[0], o.pos[2] - s[2]) < r || (!!o.path && Math.hypot(o.path[o.path.length - 1][0] - s[0], o.path[o.path.length - 1][2] - s[2]) < r);
  /** A spot no other man stands at or is walking to - AUDIT NAV2 F41: his walk's end read too (two picked one spot and
   *  stood merged in one sprite up to a minute). */
  function freeSpot() {
    for (let tries = 0; tries < 8 && spots.length; tries++) {
      const s = spots[Math.floor(rng() * spots.length) % spots.length];
      if (!members.some((o) => !o.gone && !o.below && claims(o, s))) return s;
    }
    return null;
  }
  /** Start a talk: `m` walks over to `o`, who turns to him - to a place of his own at `o`'s side, CREW_TALK_REACH off on
   *  the side he comes from (fore, the two on one spot), or turned round `o` a sixth at a time. AUDIT NAV2 F41: never
   *  within a metre of `o` (two on one spot talked in place, merged; a place clamped back off a hole stood him on `o`'s
   *  toes) nor on a third man's place or walk's end (one stood on a shipmate); none free, no talk. */
  function startTalk(m, o) {
    const from = Math.atan2(m.pos[0] - o.pos[0], m.pos[2] - o.pos[2]);
    let to = null;
    for (const turn of TALK_TURNS) {
      const a = from + turn;
      // AUDIT GN-D-wall: his place on her main deck when `o` stands on it (a hand on a flight's foot tread too), else on
      // the floor `o` stands on (her officer on her castle) - the nearest cell at any level stood a hand two and three
      // treads up a flight to talk with one at its foot (the Carrack's forecastle stair, 7-13 s a run once her stair's
      // kept file lay beside her hands' spots); off every floor of hers (a station's post), the nearest as before
      const tx = o.pos[0] + Math.sin(a) * CREW_TALK_REACH, tz = o.pos[2] + Math.cos(a) * CREW_TALK_REACH;
      const p = deck?.clamp?.(tx, tz, undefined, 0, o.station || offMain(o) ? o.pos[1] : main) ?? deck?.clamp?.(tx, tz);
      if (!p) { to = o.pos; break; }
      if (Math.hypot(p[0] - o.pos[0], p[2] - o.pos[2]) >= 1 && !members.some((x) => x !== m && x !== o && !x.gone && claims(x, p, 0.6))) { to = p; break; }
    }
    if (!to) return false;
    const script = pick(rng, CREW_TALKS);
    m.mate = o; o.mate = m;
    m.talk = { script, line: -1, t: 0, lead: true }; o.talk = { script, line: -1, t: 0, lead: false };
    o.state = 'wait'; o.path = null;
    if (Math.hypot(m.pos[0] - to[0], m.pos[2] - to[2]) < 0.3 || !walkTo(m, to)) m.state = 'talk';
    else m.state = 'toTalk';
    return true;
  }
  function endTalk(m) {
    for (const x of [m, m.mate]) {
      if (!x) continue;
      x.mate = null; x.talk = null; x.state = 'idle'; x.t = within(rng, CREW_IDLE_S); x.face = null; x.path = null;   // a walk to it given up with it (AUDIT NAV2 F46, F48)
      // AUDIT GN-D10: off her main deck - back down at once; AUDIT GN-D-wall (F41's law): on a man - on at once (a talk
      // the chanty ended while one walked past his mate to his place left the Carrack's two merged 5.8 s)
      if (offMain(x) || onAMan(x)) x.t = 0;
    }
  }
  /** SHIP-WATCH: a man at a job where he stands, for WORK_S, facing his work. */
  function startWork(m) { m.state = 'work'; m.t = within(rng, WORK_S); m.swingT = within(rng, WORK_SWING_S) * rng(); m.face = rng() * TAU; }
  /** SHIP-WATCH: the crew turns in but its watch - her stations, her lookout, then the roster's first - the rest to
   *  her hatch and below. AUDIT WK-W7: below at once (`now`) when she stands for the first time in the night - a ship
   *  coming in range, a load, my hands home from a fight never walk to her hatch before the eye. */
  function turnIn(now) {
    const crew = live();
    const keep = new Set(crew.filter((m) => m.station));
    const lk = pickLookout();
    if (lk) keep.add(lk);
    // the watch: a third of them - its first places already the stations' and the lookout's; AUDIT WK-W8: a third of
    // her whole crew, the hands still waiting below to come up counted (a night falling on the morning's)
    let n = 0;
    for (const m of members) if (!m.gone) n++;
    const want = watchCount(n);
    for (const m of crew) { if (keep.size >= want) break; keep.add(m); }
    for (const m of crew) {
      if (keep.has(m)) continue;
      if (m.mate) endTalk(m);
      dropLeader(m);
      m.line = null; m.swing = false;
      if (!now && hatch && walkTo(m, hatch)) m.state = 'turnIn';
      else { m.below = true; m.state = 'below'; m.path = null; }
    }
  }
  /** SHIP-WATCH: every hand up - out of her hatch to a free spot of her deck; `alarm` a fight's call, said by the first
   *  of the watch. AUDIT WK-W8: the ones below wait their turn at her hatch (`rise`, `bringUp`) - all stood up on its
   *  one point, they stood merged there up to five seconds. */
  function allUp(alarm) {
    let woke = false;
    for (const m of members) {
      if (m.gone || (!m.below && m.state !== 'turnIn')) continue;
      woke = true;
      if (m.below) { m.state = 'rise'; rising = true; continue; }
      m.path = null; m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * (alarm ? 0.1 : 0.5); m.face = null;   // on his way down: up where he stands
    }
    if (woke && alarm) { const caller = live()[0]; if (caller) say(caller, ALL_HANDS, 'shout'); }
  }
  /** AUDIT WK-W8: whether nobody stands within 0.6 m of `p` - no shipmate on her deck, nor the one to avoid (the player). */
  function clearAt(p, avoid) {
    if (avoid && Math.hypot(avoid[0] - p[0], avoid[2] - p[2]) < 0.6) return false;
    for (let k = 0; k < members.length; k++) {
      const o = members[k];
      if (!o.gone && !o.below && Math.hypot(o.pos[0] - p[0], o.pos[2] - p[2]) < 0.6) return false;
    }
    return true;
  }
  /** AUDIT WK-W8: the hands waiting below come up, never two on one point: the morning's one at a time, each once
   *  nobody stands at her hatch; the alarm's (`all`) at once, each at her hatch or beside it where nobody stands - rings
   *  of six round it, 0.8 m apart - else a free spot. Each goes straight off to a free spot, at a run to an alarm. */
  function bringUp(all, avoid) {
    rising = false;
    for (const m of members) {
      if (m.gone || !m.below || m.state !== 'rise') continue;
      const from = hatch ?? m.post;
      let at = clearAt(from, avoid) ? from : null;
      if (!at && !all) { rising = true; return; }   // the morning: he waits his turn
      for (let r = 0.8; r < 2.5 && !at; r += 0.8) {
        for (const turn of TALK_TURNS) {
          const q = deck?.clamp?.(from[0] + Math.sin(turn) * r, from[2] + Math.cos(turn) * r);
          if (q && clearAt(q, avoid)) { at = q; break; }
        }
      }
      at = at ?? freeSpot() ?? from;
      m.below = false; m.pos = [...at]; m.path = null; m.face = null; m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * (all ? 0.1 : 0.5);
      const s = freeSpot();
      if (s) walkTo(m, s, all ? CREW_HURRY : CREW_WALK);
    }
  }
  /** What an idle man does next. */
  function decide(m) {
    if (m.station) { m.face = m.face ?? m.yaw; m.t = within(rng, CREW_IDLE_S); if (rng() < 0.3) m.face = rng() * TAU; return; }
    // SHIP-WATCH: the lookout to the bow, and there he keeps it, facing out over her stem
    if (m === lookout && bow) {
      if (Math.hypot(m.pos[0] - bow[0], m.pos[2] - bow[2]) > 0.6) {
        // AUDIT GN-D4: never onto a man standing at her bow - her main deck's now, where a hand's spot can lie (the
        // Carrack's lookout stood on one 2.9 s): he waits his turn
        if (members.some((o) => o !== m && !o.gone && !o.below && Math.hypot(o.pos[0] - bow[0], o.pos[2] - bow[2]) < 0.6)) { m.t = within(rng, CREW_IDLE_S) * 0.25; return; }
        if (walkTo(m, bow)) return;
      }
      m.state = 'watch'; m.face = 0; m.t = within(rng, CREW_IDLE_S) * 2;
      return;
    }
    // AUDIT GN-D10: a hand off her main deck goes back down to it before anything else - no job, no talk up there
    if (offMain(m)) { const s = freeSpot(); if (s && walkTo(m, s)) return; }
    // HOLDINGS: a hand with a post keeps to it - most of his idle choices take him back to it, facing his work there; the
    // rest are his own (a job, a talk, a walk). A struck crew keeps none (AUDIT NAV2 F46's quiet)
    const post = quiet ? null : postOf(m);
    if (post && rng() < POST_SHARE) {
      if (Math.hypot(m.pos[0] - post.at[0], m.pos[2] - post.at[2]) > POST_REACH && walkTo(m, post.at)) return;
      m.face = post.face; m.t = within(rng, CREW_IDLE_S) * POST_STAND;
      return;
    }
    // SHIP-WATCH: a job of work - the more a fight left her to mend, the likelier; a chore now and then at peace. AUDIT
    // WK-W3: the night watch takes up the work, never a chore (nobody mended by night); AUDIT WK-W4: a struck crew
    // neither (AUDIT NAV2 F46's quiet - they swabbed and swung after she struck)
    const share = quiet ? 0 : (work > 0 ? WORK_SHARE * Math.min(1, work) : 0) + (asleep ? 0 : CHORE_SHARE);
    if (share > 0 && rng() < share) {
      const s = freeSpot();
      if (s && walkTo(m, s)) { m.state = 'toWork'; return; }
      if (s || !deck?.count) { startWork(m); return; }
    }
    // AUDIT NAV2 F46, F47: no talk begun by a struck crew, nor by her song's leader or with him while he sings; AUDIT
    // WK-W1: nor with her lookout - he talks to nobody, on his way to his post too (one chosen as she stood was talked
    // into two talks before he reached it)
    if (rng() < 0.35 && !quiet && m !== chanty?.leader) {
      let best = null, bestD = CREW_TALK_SEEK;
      for (const o of members) {
        if (o === m || o.gone || o.below || o.state !== 'idle' || o.mate || o === chanty?.leader || o === lookout || offMain(o) || atPost(o)) continue;   // AUDIT GN-D10: never a hand off her main deck; HOLDINGS: nor a man at his post
        const d = Math.hypot(o.pos[0] - m.pos[0], o.pos[2] - m.pos[2]);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best && startTalk(m, best)) return;
    }
    const s = freeSpot();
    if (!s || !walkTo(m, s)) { m.t = within(rng, CREW_IDLE_S); m.face = rng() * TAU; }
  }

  /**
   * The crew's step. `ctx.battle` - her guns out: no song, no talk, the battle's words and a hurry; `ctx.struck` - her
   * colours down (or her going down): no song, no talk, a surrender's few words; `ctx.muster` - a boarding at hand (a
   * grapple thrown, or a ship closing to board): the side of her deck (her frame's x sign, +1 or -1) the other ship lies
   * on, every man to that rail, facing out; `ctx.way` - CREW-MUSTER: which side of that boarding she is on, the
   * boarding's own `kind` as her deck reads it (navalBoarding.js createBoarding): 'board' her men go over the other's
   * rail, 'repel' the other's come over hers - the muster's words (CREW_BLURBS.board, .repel), none but the battle's
   * without one (her captain's rail order, no boarding at hand); `ctx.avoid` - a point (her frame) no walker steps within 0.8 m of (the
   * player on her deck). SHIP-CREW (a player's crew): `ctx.order` her captain's standing order - 'guns' her crew at the
   * guns as in a fight, 'rail' every man to the rail (the side a boarding lies on, else her starboard), 'repair' and
   * 'stand' their own work; `ctx.sings` false - their spirits too low for a song; `ctx.line()` a line of theirs by
   * their spirits or their order (shipCrew.js line), or null for the crew's own. SHIP-WATCH: `ctx.asleep` the night's
   * sleeping hours (all but the watch below); `ctx.work` what a fight left to mend (0..1); `ctx.call` a lookout's call
   * to shout this step (his, or the first man's); AUDIT WK-W10: `ctx.lookout` the roster place of the hand her card
   * names Lookout (shipCrew.js ROLES), who keeps her bow whenever he can. HOLDINGS: `ctx.roles` her hands' roles by roster
   * place (shipCrew.js CREW_ROLES) - each keeps his role's post (ROLE_POSTS), her Gunners their guns under fire.
   * @param {number} dt
   * @param {{ battle?: boolean, struck?: boolean, muster?: number, way?: 'board' | 'repel' | null, avoid?: number[] | null, order?: string | null, sings?: boolean, line?: (() => string | null) | null, asleep?: boolean, work?: number, call?: string | null, lookout?: number, roles?: readonly (string | null)[] | null }} [ctx]
   */
  function step(dt, ctx = {}) {
    // AUDIT WK-W7: her first step is taken in a frame of no time too (stood under a pause or a window) - nothing moves in
    // it, but the night's sleepers are below before she is ever drawn; a frame of none after it changes nothing
    if (!(dt > 0)) { if (stood) return; dt = 0; }
    const fresh = !stood;
    stood = true;
    const muster = ctx.muster === 1 || ctx.muster === -1 ? ctx.muster : ctx.order === 'rail' ? 1 : 0;
    // CREW-MUSTER: her side of the boarding at hand, read with its muster (the host names none for a rail order alone)
    const way = muster && (ctx.way === 'board' || ctx.way === 'repel') ? ctx.way : null;
    const battle = !!ctx.battle || !!muster || ctx.order === 'guns';
    const struck = !!ctx.struck && !muster;
    // AUDIT NAV2 F46: the guns out, or her colours down - every talk ends at once (5 to 13 talk lines a run were said
    // under the guns, only the muster ended one)
    if ((battle || struck) && !quiet) for (const m of members) if (m.mate && !m.gone) endTalk(m);
    quiet = battle || struck;
    // AUDIT WK-W1: her lookout every step - by day as by night, another the step he is gone (AUDIT WK-W10: her card's)
    roles = Array.isArray(ctx.roles) ? ctx.roles : [];   // HOLDINGS: her hands' roles, by roster place
    named = Number.isInteger(ctx.lookout) ? /** @type {number} */ (ctx.lookout) : -1;
    pickLookout();
    // SHIP-WATCH: the night - turned in but the watch; the guns, a muster or her colours down call every hand up. AUDIT
    // WK-W3: and a repair order keeps every hand at the work (nobody worked by night under one)
    work = Number.isFinite(ctx.work) ? Math.max(0, ctx.work) : 0;
    const sleep = !!ctx.asleep && !battle && !struck && ctx.order !== 'repair';
    if (sleep !== asleep) {
      asleep = sleep;
      if (asleep) turnIn(fresh); else allUp(battle || struck);
    } else if (rising && quiet && !asleep) allUp(true);   // the guns while the morning's hands come up
    if (rising && !asleep) bringUp(quiet, ctx.avoid ?? null);   // AUDIT WK-W8
    if (ctx.call) { const by = pickLookout() ?? live()[0]; if (by) { if (by.mate) endTalk(by); say(by, ctx.call, 'shout'); by.blurbT = Math.max(by.blurbT, CREW_LINE_S * 2); } }
    // a muster: every man to the rail on that side, spread along it
    const key = muster ? String(muster) : '';
    if (key !== musterKey) {
      musterKey = key;
      const crew = live();
      if (muster) {
        for (const m of crew) { if (m.mate) endTalk(m); }
        // AUDIT NAV2 F40: the rail's places dealt to her walkers fore to aft by where they stand, a station ready at his
        // post (by the roster's order, stations and all, they ran the whole deck - 190.9 m a muster on the galley, 1.5
        // to 1.9 ms of its walks in one step)
        const walkers = crew.filter((m) => !m.station);
        const zs = walkers.map((m) => walkers.reduce((k, o) => k + (o.pos[2] < m.pos[2] || (o.pos[2] === m.pos[2] && o.i < m.i) ? 1 : 0), 0));
        // her main deck's rail, fore to aft along it - never a raised deck's edge (F34's forecastle stair)
        const level = deck?.count ? mainLevel(deck) : NaN;
        const ext = deckExtentZ(deck, level);
        for (const m of crew) if (m.station) { m.face = muster > 0 ? Math.PI / 2 : -Math.PI / 2; m.state = 'ready'; }
        walkers.forEach((m, n) => {
          const z = ext ? ext[0] + (ext[1] - ext[0]) * ((zs[n] + 0.5) / walkers.length) : m.pos[2];
          const at = deck?.rail?.(muster, z, undefined, level) ?? m.pos;
          m.post = [...at];
          m.face = muster > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (!walkTo(m, at, CREW_HURRY)) { m.state = 'ready'; }
          else m.state = 'toMuster';
        });
      } else {
        for (const m of crew) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * 0.5; m.face = null; m.path = null; }
      }
    }
    // the song - AUDIT NAV2 F46: never a struck crew's; F47: one the muster drops is dropped below, the next CHANTY_S off
    // (the muster's own drop left its wait spent, and the next began as it ended)
    if (!battle && !muster && !struck && !asleep) {   // SHIP-WATCH: no song in the night watch
      if (chanty) {
        chanty.t -= dt;
        if (chanty.t <= 0) {
          chanty.line++;
          const song = chanty.song, n = song.verses.length * 2;
          if (chanty.line >= n) { chanty = null; chantyT = within(rng, CHANTY_S); }
          else {
            chanty.t = CREW_LINE_S;
            const verse = chanty.line % 2 === 0;
            if (verse) { if (!chanty.leader.gone) say(chanty.leader, sung(song.verses[chanty.line / 2]), 'sing'); }
            else for (const m of live()) if (!m.mate) say(m, sung(song.chorus), 'sing');
          }
        }
      } else if ((chantyT -= dt) <= 0) {
        const crew = live();
        if (crew.length >= 2 && ctx.sings !== false) {   // SHIP-CREW: no song in low spirits
          const bard = crew.find((m) => m.mobile === MOBILE.Bard);
          chanty = { song: pick(rng, CHANTIES), line: -1, t: 0, leader: bard ?? pick(rng, crew) };
          if (chanty.leader.mate) endTalk(chanty.leader);   // AUDIT NAV2 F47: her leader leaves his talk to sing - a verse was said over it
        } else chantyT = within(rng, CHANTY_S);
      }
    } else if (chanty) { chanty = null; chantyT = within(rng, CHANTY_S); }

    for (const m of members) {
      if (m.gone || m.below) continue;
      if (m.line && (m.line.t -= dt) <= 0) m.line = null;
      m.moving = false;
      m.swing = false;
      switch (m.state) {
        case 'idle':
          if ((m.t -= dt) > 0) break;
          if (!battle) decide(m);
          else if (!m.station) {
            // HOLDINGS: her Gunners at their own guns, facing out; the rest from post to post at a run
            const gun = roles[m.i] === 'Gunner' ? postOf(m) : null;
            if (gun && Math.hypot(m.pos[0] - gun.at[0], m.pos[2] - gun.at[2]) <= POST_REACH) { m.face = gun.face; m.t = within(rng, CREW_IDLE_S) * 0.5; break; }
            const s = gun?.at ?? freeSpot();
            if (!s || !walkTo(m, s, CREW_HURRY)) m.t = within(rng, CREW_IDLE_S) * 0.5;
          }   // at the guns: from post to post at a run
          else m.t = within(rng, CREW_IDLE_S);
          break;
        case 'watch':   // SHIP-WATCH: the lookout at the bow, facing out over her stem
          if (battle) { m.state = 'idle'; m.t = 0; break; }   // AUDIT WK-W5: at the guns at once, a gunner like the rest (he kept his watch up to 22 s)
          m.face = 0;
          if ((m.t -= dt) > 0) break;
          decide(m);
          break;
        case 'work':   // SHIP-WATCH: at a job - a swing at it now and then; the guns end it - AUDIT WK-W4: her colours
          // struck too; AUDIT WK-W3: the night a chore, never the work
          if (quiet || asleep && !(work > 0)) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * 0.3; break; }
          if ((m.swingT -= dt) <= 0) { m.swing = true; m.swingT = within(rng, WORK_SWING_S); }
          if ((m.t -= dt) <= 0) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * 0.5; }
          break;
        case 'walk': case 'toTalk': case 'toMuster': case 'toWork': case 'turnIn':
          // AUDIT WK-W5: the guns (or her colours) end a walk to a job as they end the job (he ambled on up to 58 s)
          if (quiet && m.state === 'toWork') { m.path = null; m.state = 'idle'; m.t = 0; break; }
          // someone in his way too long: somewhere else - AUDIT NAV2 F48: a talk given up, a muster stood to where he is
          // (only a plain walk gave up: the other two waited on the player 23 to 29 s)
          if (advance(m, dt, ctx.avoid ?? null)) { m.blockT = 0; } else if ((m.blockT = (m.blockT ?? 0) + dt) > CREW_BLOCKED_S) { m.path = null; m.blockT = 0; if (m.state === 'toTalk') endTalk(m); }
          if (m.state === 'walk' && !m.path) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * (m === lookout && !battle || offMain(m) || onAMan(m) ? 0 : 1); }   // SHIP-WATCH: the lookout at his post at once - AUDIT WK-D5: at the guns he stands at each as the rest do (he ran post to post without a stop); AUDIT GN-D10: a walk given up off her main deck, down again at once; AUDIT GN-T2: one ended on a man standing, on again at once
          else if (m.state === 'toWork' && !m.path) { if (asleep && !(work > 0)) { m.state = 'idle'; m.t = 0; } else startWork(m); }
          else if (m.state === 'turnIn' && !m.path) { m.below = true; m.state = 'below'; m.line = null; continue; }
          else if (m.state === 'toTalk' && !m.path) m.state = 'talk';
          else if (m.state === 'toMuster' && !m.path) m.state = 'ready';
          break;
        case 'wait':   // his mate is coming over to talk
          if (m.mate) m.face = Math.atan2(m.mate.pos[0] - m.pos[0], m.mate.pos[2] - m.pos[2]);
          if (!m.mate || m.mate.gone || m.mate.state !== 'toTalk' && m.mate.state !== 'talk') endTalk(m);
          break;
        case 'talk': {
          const o = m.mate;
          if (!o || o.gone) { endTalk(m); break; }
          m.face = Math.atan2(o.pos[0] - m.pos[0], o.pos[2] - m.pos[2]);
          o.face = Math.atan2(m.pos[0] - o.pos[0], m.pos[2] - o.pos[2]);
          if (o.state === 'wait') o.state = 'talk';
          if (!m.talk?.lead) break;   // the one who came over keeps the talk's clock
          if ((m.talk.t -= dt) > 0) break;
          m.talk.line++;
          const lines = m.talk.script;
          if (m.talk.line >= lines.length) { endTalk(m); break; }
          say(m.talk.line % 2 === 0 ? m : o, lines[m.talk.line]);
          m.talk.t = CREW_LINE_S;
          break;
        }
        case 'ready':
          m.face = muster > 0 ? Math.PI / 2 : muster < 0 ? -Math.PI / 2 : m.face;
          break;
        default: break;
      }
      // a word of his own, now and then - never over a talk or a song; AUDIT NAV2 F46: a struck crew's a surrender's
      // few, never a calm day's nor her trade's ("Gold, lads" after she struck)
      if (!m.mate && !chanty && (m.blurbT -= dt) <= 0) {
        m.blurbT = within(rng, CREW_BLURB_S) * (battle ? 0.35 : struck ? 2 : 1);
        if (!m.line) {
          // SHIP-CREW: a player's crew's own line first - their order's work, or their spirits - never under real fire
          const theirs = !struck && !ctx.battle && !ctx.muster ? ctx.line?.() ?? null : null;
          const own = !battle && !struck && !asleep && faction && CREW_BLURBS[faction] && rng() < 0.3 ? CREW_BLURBS[faction] : null;
          // SHIP-WATCH: a man at a job says his work's words, the night watch its own, low
          const job = m.state === 'work' ? (work > 0 ? CREW_BLURBS.work : CREW_BLURBS.chore) : null;
          if (theirs && !asleep) say(m, theirs, muster || battle ? 'shout' : 'talk');
          else say(m, pick(rng, job ?? own ?? (way ? CREW_BLURBS[way] : battle ? CREW_BLURBS.battle : struck ? CREW_BLURBS.struck : asleep ? CREW_BLURBS.night : CREW_BLURBS.calm)), muster || battle ? 'shout' : 'talk');
        }
      }
      // turn toward his face (a walker faces his way)
      if (m.face != null && !m.moving) {
        const d = angleTo(m.yaw, m.face), s = CREW_TURN * dt;
        m.yaw += Math.abs(d) <= s ? d : Math.sign(d) * s;
      }
    }
  }

  /** AUDIT NAV2 F41: whether a shipmate walking before him in the roster stands in his next step (`ux, uz` his way) -
   *  the player's own check, run against the walkers (they walked through each other); the roster's order says who
   *  lets whom by, so two never wait on each other; and never while he passes over a man standing (he would stand on
   *  him). */
  function yields(m, ux, uz) {
    const px = m.pos[0] + ux * 0.8, pz = m.pos[2] + uz * 0.8;
    let wait = false;
    for (const o of members) {
      if (o === m || o.gone) continue;
      if (Math.hypot(o.pos[0] - m.pos[0], o.pos[2] - m.pos[2]) < 0.3) return false;
      if (o.i < m.i && o.path && o !== m.mate && Math.hypot(o.pos[0] - px, o.pos[2] - pz) < 0.8) wait = true;
    }
    return wait;
  }
  /** A walker along his path: toward its next corner at his pace, facing his way; waiting while the one to avoid
   *  stands in his next step, and letting a shipmate by. Answers false while the one to avoid holds him. */
  function advance(m, dt, avoid) {
    const p = m.path;
    if (!p) return true;
    let left = m.speed * dt;
    while (left > 0 && m.path) {
      const to = p[m.leg];
      const dx = to[0] - m.pos[0], dz = to[2] - m.pos[2], d = Math.hypot(dx, dz);
      if (avoid && Math.hypot(m.pos[0] + dx / (d || 1) * 0.8 - avoid[0], m.pos[2] + dz / (d || 1) * 0.8 - avoid[2]) < 0.8) return false;   // someone in the way: wait
      if (d > 1e-6 && yields(m, dx / d, dz / d)) return true;   // a shipmate crossing: he lets him by (it passes - never a give-up)
      m.yaw = Math.atan2(dx, dz);
      m.moving = true;
      if (d <= left) {
        m.pos[0] = to[0]; m.pos[1] = to[1]; m.pos[2] = to[2];
        left -= d;
        if (++m.leg >= p.length) { m.path = null; break; }
      } else {
        const k = left / d;
        m.pos[0] += dx * k; m.pos[2] += dz * k;
        m.pos[1] = deck?.heightAt?.(m.pos[0], m.pos[2]) ?? m.pos[1];
        if (Number.isNaN(m.pos[1])) m.pos[1] = to[1];
        left = 0;
      }
    }
    return true;
  }

  return {
    members,
    step,
    /** The lines over their heads now: [{ member, text, kind }] ('talk', 'sing', 'shout'). */
    speech() { const out = []; for (const m of members) if (!m.gone && m.line) out.push({ member: m, text: m.line.text, kind: m.line.kind }); return out; },
    /** Her crew fewer, to `n` standing (the guns took the rest): the last of the roster first, her first man last -
     *  AUDIT NAV2 F42: to nobody at all (a boat with every hand down still showed one); a sea ship's count never falls
     *  under two, so her captain stands to the end. */
    trim(n) {
      let alive = members.filter((m) => !m.gone).length;
      for (let i = members.length - 1; i >= 0 && alive > n; i--) {
        const m = members[i];
        if (m.gone) continue;
        if (m.mate) endTalk(m);
        dropLeader(m);
        m.gone = true; m.below = false; m.line = null; alive--;   // AUDIT WK-W9: gone is never below - mended back, he stood unseen till the morning
      }
    },
    /**
     * AUDIT NAV2 F42: her crew more, to `n` standing (mended in range, hands pressed from a prize - my crew never grew
     * back): the men the guns took back first, in the roster's order, at a free spot of her deck, then new hands off
     * `roster` (her roster now) - never a man a fight took (the fight's end brings those home, `reset`).
     * @param {number} n @param {{ mobile: number, gender: string }[]} [roster]
     */
    restore(n, roster = []) {
      let alive = members.reduce((a, m) => a + (m.gone ? 0 : 1), 0);
      for (const m of members) {
        if (alive >= n) return;
        if (!m.gone || m.taken || m.ashore) continue;
        const at = m.station ? m.post : freeSpot() ?? m.post;
        m.pos = [...at]; m.gone = false; m.state = 'idle'; m.t = within(rng, CREW_IDLE_S); m.path = null; m.face = null;
        alive++;
      }
      for (let i = members.length; alive < n && i < roster.length; i++, alive++) {
        const m = member(roster[i], i), at = m.station ? null : freeSpot();
        if (at) { m.pos = [...at]; m.post = [...at]; }
        members.push(m);
      }
    },
    /**
     * CREW-COMPANIONS: the hands ashore with the player (`ids`, roster places) off her deck, and the ones home again back
     * on it where they left it (a free spot when another stands there). Answers how many are off.
     * @param {Set<number>} ids
     */
    away(ids) {
      let off = 0;
      for (const m of members) {
        const out = ids.has(m.i);
        if (out && !m.ashore) {
          if (!m.gone) { if (m.mate) endTalk(m); dropLeader(m); m.gone = true; m.line = null; }
          m.ashore = true; m.below = false;   // SHIP-WATCH: comes home on her deck, not in his hammock
        } else if (!out && m.ashore) {
          m.ashore = false;
          if (!m.taken) {
            const at = m.station ? m.post : freeSpot() ?? m.post;
            m.pos = [...at]; m.gone = false; m.state = 'idle'; m.t = within(rng, CREW_IDLE_S); m.path = null; m.face = null;
          }
        }
        if (m.ashore) off++;
      }
      return off;
    },
    /** How many stand. */
    standing: () => members.reduce((a, m) => a + (m.gone ? 0 : 1), 0),
    /** Whether a chanty is being sung. */
    singing: () => !!chanty,
    /** SHIP-WATCH: her lookout (a member, or null); whether her crew is turned in; how many are below; her hatch and
     *  her bow (her frame), or null. */
    lookout: () => pickLookout(),
    /** HOLDINGS: the post the `i`th of her roster keeps by his role (`{ at, face }`), or null. */
    postOf: (i) => (members[i] ? postOf(members[i]) : null),
    asleep: () => asleep,
    belowCount: () => members.reduce((a, m) => a + (!m.gone && m.below ? 1 : 0), 0),
    hatch, bow,
    /**
     * Up to `n` of the crew taken off her deck, in the roster's order (a boarding's muster, a party over the rail, my
     * hands going over) - `from` standing men passed over first (a party leaves her captain aboard): each as it stands,
     * its class, its sex, where (her frame, his feet on her deck) and which way it faces.
     * @param {number} n @param {{ from?: number }} [o]
     */
    take(n, { from = 0 } = {}) {
      const out = [];
      let skip = from;
      for (const m of members) {
        if (out.length >= n) break;
        if (m.gone) continue;
        if (skip > 0) { skip--; continue; }
        if (m.mate) endTalk(m);
        if (m.below) { m.below = false; m.pos = [...(hatch ?? m.post)]; }   // SHIP-WATCH: up out of her hatch
        m.gone = true; m.taken = true; m.line = null;
        dropLeader(m);
        // AUDIT NAV2 F35: his feet on her deck - a station's post is off it (her captain at the Small Ship's wheel, on her
        // poop), and the leash snapped him 7 m onto her main deck at the fight's start
        out.push({ mobile: m.mobile, gender: m.gender, pos: deck?.clamp?.(m.pos[0], m.pos[2]) ?? [...m.pos], yaw: m.yaw });
      }
      return out;
    },
  };
}

/** Her deck's fore-and-aft extent (her frame's z), off its cells: [aft, fore], or null for no deck. AUDIT NAV2 F40: at
 *  `level` when asked - the cells within DECK_STEP of it (her main deck's, the muster's). */
export function deckExtentZ(deck, level = NaN) {
  if (!deck?.count) return null;
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < deck.y.length; j++) {
    if (Number.isNaN(deck.y[j]) || Math.abs(deck.y[j] - level) > DECK_STEP) continue;
    const k = Math.floor(j / deck.nx), z = deck.minZ + (k + 0.5) * deck.cell;
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  return [lo, hi];
}
