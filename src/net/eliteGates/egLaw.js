// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 6, 7, 8, 9 and 23): THE
// ELITE BREACH'S LAW - its room, its clock and the count, the circle's rhythm and every hall's spec. Pure, and read
// alike by the relay (net/eliteGates/egBrain.js runs the halls off it) and every client (world/eliteGates/egHall.js builds them off it): one
// seed and one hall number give one hall on every machine.
//
// THE LAW DECIDES IN INTEGERS (section 9): every length is drawn in centimetres and every time in milliseconds off the
// port's seeded die (net/superDungeon/sdBrain.js sdRng), and its trigonometry is the table below (`lawSin`, `lawCos` - whole degrees
// in steps of 5, sines times 10,000). No transcendental runs here: V8's and JavaScriptCore's can differ in the last bit,
// and one flipped draw would give the relay and a phone different halls. A source sweep holds it
// (test/net/eliteGates/egplay_law.test.js).
//
// THE SPIRE'S FRAME is the gate's court frame (net/gate/gateBrain.js COURT_CENTRE, the made block's middle - the Hour's
// SD_REALM_ORIGIN too): metres, floors at y 0, the dungeon's own x and z less [25.6, 0, 25.6]. A circle is one made
// level: its five halls stand side by side, hall slot `s`'s origin at x `x0` = (s - 1) * EG_HALL_PITCH. Every position a
// spec says is in its HALL'S OWN FRAME - about that origin, laid along +z from its arrival plate at (0, 0) - so a hall's
// fight stands inside the gate's wire bounds (net/wire.js GATE_COURT_BOUND) and the gate's own client pieces (the
// legion's bodies, the blows' verdicts, the telegraph pass) read the Spire's fights about the hall's centre unchanged.
//
// EG-FULL (2026-10-11, Mac: "I said I want everything"): THE WHOLE DEPTH - the four bands (the Broken Galleries, the Soul
// Cairn, the Shade Perilous, the Havoc Wellhead without end), the circle law's weights and the variants' memory, every
// hall kind (the Rift-Yard and its five variants, the Span and its band's pieces, the Proving Walk and its champion's
// rank, the Rampart and its five variants, the Athenaeum, the Deepway, the Brink, the Scriptorium) and the twists; the
// lords' draw and every lord's own ground; the decrees' table, the Proclamation and the span decrees in the spec.
//
// EG-FULL, LAYER THREE (section 11): THE FRAGMENTS laid into the spec off their law (net/eliteGates/egFragLaw.js) - each passage of
// its band's library over its chasm and inner course, each chamber's play and signature, the set pieces (the Collapsing
// Tube, and the Brinks' Sinking Stair, Moon Path and Forge Line), THE FORK's High Road and Low Road (each its own course,
// both onto the end plate), and the ground after each run that the solver jumps.
//
// EG-ZC (2026-10-12, Mac: "I said I want everything"; sections 11.1, 11.2 and 22): SPEC LAW 5 - THE LAST FRAGMENTS. The
// Forge kit lays THE COOLING SLAG (net/eliteGates/egFragLaw.js - a crossing its two spouts pour in turn), and the Deepway goes down by a
// SHAFT of its band's kit in place of its three bare ledges (egFragShaft - the Caverns' throat, the Mist Stair's pit, THE
// HOLLOW TRUNK, THE SLAG CHUTE). THE LAW PIN keeps the law before: `egHallOf(seed, h, geo, law)` draws either law (law 4's
// halls byte for byte as they were - test/net/eliteGates/egz_frag.test.js), the relay a breach's own (`egv` - net/eliteGates/egDurable.js EG_LAWS).
//
// EG6a (2026-10-12; sections 9 and 10.1): THE SPAN GENERATOR - every course of a hall (its runs, its islands, a passage's
// inner course, a set piece's flights, THE FORK's two roads) is drawn by net/eliteGates/egSpanLaw.js egSpanOf off this hall's die and
// laid by courseOf, one course a road: layHall stands the hall about the generator's edge. Laws 4 and 5 lay byte for byte
// the halls they laid before (test/net/eliteGates/egz_frag.test.js, test/net/eliteGates/eg6a_span.test.js).
//
// AUDIT EG III (2026-10-13, lane 1 #14; sections 14 and 22): SPEC LAW 6 - THE SPAN DECREES ON EVERY SPAN. Gale-Swept and
// Crumbling Halls lay their sections on every span of a hall (EG_DECREE_LAW): a Span's road, both roads of THE FORK (the Low
// Road had none), and a Proving Walk's second span, the one to its door (it had none); at rank II each lays two sections, not
// one longer. A Gust section stands on an island of its own; a Crumble section is laid straight on from the ground before it
// and brings none (a section and no island: one island fewer than a section brings, two at rank II). Laws 4 and 5 are kept
// byte for byte (their 800 halls hashed whole - test/net/eliteGates/egz_frag.test.js, test/net/eliteGates/eg6a_span.test.js) and stay in EG_LAWS their days.
//
// EG-HERO-LAY (2026-10-13, the owner: "You have to author the fragments"; sections 11.4-11.6 and 22): SPEC LAW 7 - THE HEROES
// LAID. In each slot where law 6 lays a code-built fragment of kit K and class C (a passage, a chamber, a shaft - never a set
// piece), a hero fragment of (K, C) registered in net/eliteGates/egHeroFrags.js (the reference aside) may stand instead: the hall's own
// hero die (egSeed(seed, HERO_SALT + h)) tosses a fair coin a slot, in the slots' order, and the first heads whose hero FITS is
// laid - at most one hero a hall (heroHall). It fits when its mouth stands on the course's line at the slot's start, its
// course's exit meets what follows at the height the slot keeps, its box stands EG_FRAG_APART_CM from every other volume
// (joined fragments and pieces at its mouth and exit aside), a chamber's trial stands on its fight floors, the hall stays
// inside EG_HALL_LEN_MAX and its cap of four fragments, and THE TIMED SOLVER proves the whole hall (egHeroStatic, heroFit). Where
// none does, law 6's hall stands byte for byte but its number: the coin is the hero die's, never the hall's, and the code-built
// fragment that stands is the one law 6 laid. Everything the relay judges comes from the hero's LAW record, never its mesh:
// its fight floors in `fl` as polygons, its stairs in `ramps`, its course in `steps`, its hazards, anchors, alcoves, lights and
// engine in the spec's own fields, and its floors, ceilings, open edges, sockets and walk graph in `heroes` (the clamp, the
// fair trail's ground, the legion's graph). The registry is a seam (egHeroSeam), EG_HERO_FRAGS by default.
//
// AUDIT EG V (2026-10-15, the owner: "PERFECTION"; sections 7, 8, 9, 10.5, 11 and 13.3): SPEC LAW 8 - THE WAYS LAID
// (EG_WAYS_LAW). Every raised floor its way up: a Rampart's caster pillar and the Wyrm's perches each a stair from the floor its
// side span leaves (lane5 #15), Ilthys's Council Rotunda two stairs a balcony (lane5 #14); the Reliquary Vault on a forked
// span too, off the fork's island (lane3 #18); the passages a span carries by circle - a passage on the way to the fork from
// circle 3 one span in two, every span from circle 11, and deeper a second on the Low Road where the hall has room (lane5 #11);
// a twist one trial hall in four (lane3 #11 - the roll a third, never two running); the island after the Sinking Stair at the
// height its last flight is leapt from (lane5 #5); a code-built Eclipse chamber whose balcony its havens cannot reach lays no
// balcony (lane5 #9); THE TIMED SOLVER on THE LAW'S CLOCK, the set pieces proven with their margin and the Forge Line clear of
// its hammers (net/eliteGates/egSpanLaw.js - lane5 #2, #6); and THE LANDING ROOM excepting only a piece that moves along the course
// (lane5 #17). Laws 4-7 keep their halls byte for byte (their 800 halls hashed whole - test/net/eliteGates/egaudit5_f.test.js).
//
// THE ASCENT (2026-10-16, Mac: "I just feel like we could do more to utilizing climbing sections, different elevations.
// Something that isnt just a straight line from point A to point B. Like, I want it to feel like you're actually traverversing
// corridors, different rooms, etc."; bible/11-Multiplayer/Elite-Gates-Ascent.md sections 1, 3, 4, 5 and 7): SPEC LAW 9 - A HALL
// IS A WAY THROUGH THE TORN ACADEMY (EG_ASCENT_LAW). layHall hands its own laying to the route planner (net/eliteGates/egAscent.js
// egAscentLay): the kind's courses stand along a way that turns, climbs and falls 10-30 m and passes over itself, through
// the academy's ROOMS (net/eliteGates/egRoomLaw.js - code-built hero records, laid as a hero is: roomLay), over bridges, up stairs, round
// landings, with CLIMBS on the way and off it. The spec says its law (`law`), THE ROUTE (`route`), its `climbs`, its `voids`
// and its `rooms`; THE TIMED SOLVER proves every course it lays where it stands (egAscentProof), THE ROUTE'S SANITY its way.
// Laws 4-8 keep their halls byte for byte (their 800 halls hashed whole - test/net/eliteGates/egaudit5_f.test.js).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { sdSeed, sdRng } from '../superDungeon/sdBrain.js';
import { egSpanProof, egRoadCross, EG_MEDIAN_X, egJumpReach, EG_SPAN_RUN_MPS, EG_JUMP_MPS, EG_JUMP_FWD, EG_JUMP_G } from './egSpanLaw.js';   // EG-FULL: THE TIMED SOLVER - a course it refuses is laid again
import { EG_SINK_MPS, EG_SINK_ON_S } from './egSpanLaw.js';   // AUDIT EG V (spec law 8): the Sinking Stair's last leap's height
import { egSpanOf, egDieBetween, EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_BEAT_HALF_MS, EG_STEP_DOWN_CM, EG_DROP_CM } from './egSpanLaw.js';   // EG6a: THE SPAN GENERATOR - every course laid by it, through courseOf
import { egFragPassage, egFragChamber, egSetPiece, egSetPieceOf, EG_PASSAGE_KITS, EG_CHAMBER_KITS, EG_FRAGS } from './egFragLaw.js';   // EG-FULL LAYER THREE: the fragments
import { egFragShaft, EG_SHAFT_KITS, EG_SLAG_LAW, EG_SLAG_STEP } from './egFragLaw.js';   // EG-ZC: the shafts, the slag's law and its crust
import { egFragInPoly, egFragApart, egFragBoxAt, egFragSwept, EG_SET_PIECES, EG_FRAG_SOCKET_TOL_CM, EG_FRAG_HEADROOM_CM, EG_SHAFT_FLIGHT_CM, EG_SHAFT_DROP_CM } from './egFragLaw.js';   // EG-HERO-LAY: a hero's record, read where it is laid
import { EG_HERO_FRAGS, egHeroFragLaws } from './egHeroFrags.js';   // EG-HERO-LAY: the hero fragments' law halves (the relay's since spec law 7)
import { egPieceIn, egPolyIn, egPolyKeep } from './egShape.js';   // EG-HERO-LAY: a hero's fight floors are polygons
import { egInShape, shRing, shLane } from './egShape.js';   // AUDIT EG V (lane1 #21): THE MOLTEN RIM's magma and its ways across
import { gateTrialOf } from '../gate/gateMods.js';   // EG5: the gate's boss-general trials the lord family recasts (a leaf - it imports nothing)
import { egAscentLay, egAscentSane, egAscentNote, egTape, EG_ASCENT_FRAGS_MAX, EG_BROKEN_LAW } from './egAscent.js';   // THE ASCENT (spec law 9): the route planner
import { egRoomHero, EG_ROOM_NAMES } from './egRoomLaw.js';   // THE ASCENT: a room laid as a hero
import { egRouteInHall } from './egRoute.js';   // THE ASCENT (LAW 9): a hall's ground is its route's bound (a leaf - it imports nothing)
import { egByHeight, egFeetY, egBears, egOneStorey } from './egWalkGraph.js';   // THE ASCENT - HEIGHT: every floor test by the body's feet

/** The spec law's number - a change to any draw below changes it (and the relay's version with it). EG-ZC: 5, the last
 *  fragments (the law before kept - net/eliteGates/egDurable.js EG_LAWS). AUDIT EG III: 6, the span decrees on every span (laws 4 and 5
 *  kept beside it). EG-HERO-LAY: 7, the heroes laid (laws 4, 5 and 6 kept beside it). AUDIT EG V: 8, the ways laid (laws 4-7
 *  kept beside it). THE ASCENT: 9, a hall a way through the torn academy (laws 4-8 kept beside it). EG-PERFECT: 10, THE BROKEN WAY (laws 4-9 kept
 *  beside it - net/eliteGates/egAscent.js EG_BROKEN_LAW). */
export const EG_SPEC = 10;
export { EG_BROKEN_LAW };
/** THE ASCENT (Elite-Gates-Ascent.md): the spec law from which a hall is laid as a way - its courses along a route through
 *  rooms, over bridges, up stairs and climbs (net/eliteGates/egAscent.js) - and says its law, its route, its climbs, its voids and its
 *  rooms. The laws before lay as they laid. */
export const EG_ASCENT_LAW = 9;
/** A spec's law: its own `law` (spec law 9 says it), else its `v` - every spec law's number since spec law 4 (the side table the
 *  laws before keep it in: adding a field to their halls would move their bytes). */
export const egLawOf = (spec) => spec?.law ?? spec?.v ?? 0;
/** AUDIT EG V (sections 7-13): the spec law from which every raised floor has its way up, the Vault stands on a forked span,
 *  a span carries its circle's passages, a twist turns one trial hall in four, the Sinking Stair's island stands at its leap's
 *  height, an Eclipse chamber's balcony is one its havens reach, and THE TIMED SOLVER decides on THE LAW'S CLOCK with the set
 *  pieces' margin (net/eliteGates/egSpanLaw.js EG_SOLVE_LAW - pinned equal) - the laws before lay as they laid. */
export const EG_WAYS_LAW = 8;
/** EG-HERO-LAY (sections 11.4-11.6): the spec law from which a hall lays a registered hero fragment in place of a code-built
 *  one (heroHall) - the laws before lay as they laid. */
export const EG_HERO_LAW = 7;
/** AUDIT EG III (sections 14 and 22): the spec law from which Gale-Swept and Crumbling Halls lay their sections on every span
 *  (a Proving Walk's second span, THE FORK's Low Road) and two sections at rank II - the laws before lay as they laid. */
export const EG_DECREE_LAW = 6;
/** The most a company holds (the party's own PARTY_MAX, net/wire.js - pinned equal). */
export const EG_PARTY_MAX = 8;

// ── the room ──────────────────────────────────────────────────────────────────────────────────────────────
/** A breach's id: 16 hex, the service's draw at the open (the arena bout's shape). */
export const EG_BREACH_RE = /^[0-9a-f]{16}$/;
/** An order's id (`ez`), and the client's request id an open is idempotent on (`rq`). */
export const EG_ORDER_ID_RE = /^[a-z0-9]{16,32}$/;
/** The breach's room: `eg:<16hex>`. */
export const EG_ROOM = /^eg:[0-9a-f]{16}$/;
export const egRoomKey = (b) => `eg:${b}`;
export const isEgRoom = (key) => typeof key === 'string' && EG_ROOM.test(key);
export const egBreachOfRoom = (key) => (isEgRoom(key) ? key.slice(3) : null);

// ── the clock (section 6.2) ────────────────────────────────────────────────────────────────────────────────
/** A game minute in real ms (the shared clock's TimeScale 12 - net/wire.js sharedClassicMinutes). */
export const EG_GAME_MIN_MS = 5000;
/** The arch's climb out of the ground (the gate's GATE_RISE_MS). */
export const EG_RISE_MS = 20_000;
/** From the opening to the open: the sealed hour (60 game minutes). */
export const EG_RISE_MIN = 60;
export const EG_SEALED_MS = EG_RISE_MIN * EG_GAME_MIN_MS;
/** The open window: at most this long after the open for the first hall to wake. */
export const EG_ADMIT_MAX_MIN = 60;
export const EG_ADMIT_MAX_MS = EG_ADMIT_MAX_MIN * EG_GAME_MIN_MS;
/** The count: where it starts at the first wake, what a Redoubt adds, the most it holds. */
export const EG_COUNT_START_MIN = 360;
export const EG_REDOUBT_HOLD_MIN = 180;
export const EG_COUNT_CAP_MIN = 360;
export const EG_COUNT_START_MS = EG_COUNT_START_MIN * EG_GAME_MIN_MS;
export const EG_REDOUBT_HOLD_MS = EG_REDOUBT_HOLD_MIN * EG_GAME_MIN_MS;
export const EG_COUNT_CAP_MS = EG_COUNT_CAP_MIN * EG_GAME_MIN_MS;
/** The last word: no breach outlives its opening by more (36 game hours, three real ones). */
export const EG_LAST_WORD_MIN = 2160;
export const EG_LAST_WORD_MS = EG_LAST_WORD_MIN * EG_GAME_MIN_MS;
/** A Redoubt's rest (the count held). */
export const EG_REST_S = 90;
export const EG_REST_MS = EG_REST_S * 1000;
/** The closing runs the count its first seconds, then holds it. The pull to the next wake holds it too, and needs no bound
 *  of its own (AUDIT EG III, lane2 #18): the wait wakes the hall EG_ARRIVE_MAX_MS after the pull whoever is missing, and a
 *  gather begun before it runs its EG_GATHER_MS whole, so the hold lasts at most the two together (38 s). */
export const EG_CLOSING_COUNT_S = 15;
export const EG_CLOSING_COUNT_MS = EG_CLOSING_COUNT_S * 1000;
/** A hall's stages (section 7): the longest the gather waits after the pull, the gather after the last `here`, the
 *  closing after a fight and after a span, how near the door a step through is said and believed - AUDIT EG III (lane2
 *  #11): ONE NUMBER, the closing ring's radius (world/eliteGates/egLights.js EG_CLOSING_RING), the screen's `down` (scenes/eliteGates/egClient.js)
 *  and the relay's (net/eliteGates/egBrain.js egDown), never a pad; the screen says it again every second while it stands there, so
 *  a pose the relay holds a beat behind is heard at the next. */
export const EG_ARRIVE_MAX_MS = 30_000;
export const EG_GATHER_MS = 8000;
export const EG_CLOSING_FIGHT_MS = 20_000;
export const EG_CLOSING_SPAN_MS = 45_000;
export const EG_DOOR_REACH_M = 3;
/** EG-ZI - THE LATE WAKE (section 7): after this many halls in a row that a member woke late (the hall woke before its
 *  `here`), the gather waits only this long after the pull for them. */
export const EG_LATE_HALLS = 2;
export const EG_LATE_ARRIVE_MS = 10_000;
/** EG-ZI - THE PULL'S TOLL (section 10.6): a share of the body for each quarter of the road still ahead of a member's
 *  furthest fair point, at most this many quarters; waived for a member who reached new ground (an island, a fragment's
 *  floor) this long before the pull; the halls it is paid after - those whose closing is the span's, the road crossed in
 *  it (the Span, the Deepway, a Brink, the Proving Walk's second span). */
export const EG_TOLL_STEP = 0.05;
export const EG_TOLL_QUARTERS = 4;
export const EG_TOLL_WAIVE_MS = 15_000;
export const EG_TOLL_KINDS = Object.freeze(['span', 'deepway', 'brink', 'proving']);
/** The Court's wake ring: the lord wakes when every living member stands in it, or this long after the first does. */
export const EG_WAKE_RING_MS = 20_000;
/** The void's cost (section 8): a tenth of the body's health, never below a quarter of it. */
export const EG_CAST_BACK_LOSS = 0.1;
export const EG_CAST_BACK_FLOOR = 0.25;
/** Below this (the Spire's y) the void has a body - the Hour's SD_VOID_Y. */
export const EG_VOID_Y = -30;
/** Absent this long in a trial, a member is counted fallen (section 6.1). */
export const EG_ABSENT_TRIAL_MS = 180_000;

/**
 * A breach's instants, relay-clock ms, from its opening (the moment the room accepted the open): the arch risen, the
 * open, the open window's end, the last word.
 * @param {{ openedAt: number }} rec
 */
export function egTimes(rec) {
  const o = rec.openedAt;
  return { openedAt: o, risenAt: o + EG_RISE_MS, openAt: o + EG_SEALED_MS, admitUntil: o + EG_SEALED_MS + EG_ADMIT_MAX_MS, lastWordAt: o + EG_LAST_WORD_MS };
}
/**
 * The breach's phase at `now` (section 6.2): 'rising' | 'sealed' | 'open' | 'deep' | 'torn' | 'ended'. `wokeAt` the
 * first hall's wake (0 none yet), `endAt`/`why` its end (0 none) - a torn breach is 'torn' from its end on.
 * @param {{ openedAt: number, wokeAt?: number, endAt?: number, why?: string|null }} rec @param {number} now
 */
export function egPhase(rec, now) {
  if (rec.endAt > 0 && now >= rec.endAt) return rec.why === 'tear' ? 'torn' : 'ended';
  const T = egTimes(rec);
  if (now >= T.lastWordAt) return 'ended';
  if (rec.wokeAt > 0) return 'deep';
  if (now < T.risenAt) return 'rising';
  if (now < T.openAt) return 'sealed';
  return now < T.admitUntil ? 'open' : 'ended';
}
/** Does the breach still take members through its door at `now` (its open window, before the first wake)? */
export const egAdmits = (rec, now) => egPhase(rec, now) === 'open';
/** THE GOOD ENDS (section 16.3): a member's end that opens its Reliquaries - the way home, THE SEAL, the last word and a
 *  void (THE COVENANT'S PATIENCE ends a breach as the way home). A fall, the tear, a wipe and forsaking lose them. AUDIT
 *  EG III (lane2 #1): one list - the end receipt's `rl` (net/eliteGates/egBrain.js) and the recap's count (ui/eliteGates/egHud.js) read it. */
export const EG_OPEN_ENDS = Object.freeze(['home', 'seal', 'last', 'void']);

/**
 * THE COUNT (section 6.2) as the relay keeps it: what is `left` (ms) and, while it runs, the instant it last began to
 * (`at`; 0 while it holds). Every screen draws the same from the frames' `cl`/`ca`.
 */
export const egCountNew = () => ({ left: EG_COUNT_START_MS, at: 0 });
/** What is left at `now`. */
export const egCountLeft = (c, now) => (c.at > 0 ? Math.max(0, c.left - Math.max(0, now - c.at)) : c.left);
/** The count set running at `now` (one already running is unchanged). */
export const egCountRun = (c, now) => (c.at > 0 ? c : { left: c.left, at: now });
/** The count held at `now`, what is left kept. */
export const egCountHold = (c, now) => (c.at > 0 ? { left: egCountLeft(c, now), at: 0 } : c);
/** A Redoubt's hold under THE COVENANT'S PRESS at rank `press` (section 14): EG_REDOUBT_HOLD_MS (fifteen minutes), two
 *  thirds of it at rank I (ten), a third at rank II (five). Pure. */
export const egRedoubtHold = (press = 0) => (press >= 2 ? EG_REDOUBT_HOLD_MS / 3 : press ? (EG_REDOUBT_HOLD_MS * 2) / 3 : EG_REDOUBT_HOLD_MS);
/** A Redoubt taken at `now`: `hold` more (egRedoubtHold), never past the cap nor the last word (`lastWordLeft`, ms) -
 *  `remaining = min(remaining + hold, cap, lastWord - elapsed)`. It runs or holds as it did. AUDIT EG III (lane2 #2): THE
 *  ONE LAW - the director's Redoubt (net/eliteGates/egBrain.js redoubtGain) takes its time here; what the cap turns away is its
 *  Surplus's (egCountOver). */
export function egCountRedoubt(c, now, lastWordLeft, hold = EG_REDOUBT_HOLD_MS) {
  const left = Math.max(0, Math.min(egCountLeft(c, now) + hold, EG_COUNT_CAP_MS, lastWordLeft));
  return { left, at: c.at > 0 ? now : 0 };
}
/** What the cap turns away from `add` more on the count at `now` (ms) - THE SURPLUS's to bank (section 6.2). Pure. */
export const egCountOver = (c, now, add) => Math.max(0, egCountLeft(c, now) + add - EG_COUNT_CAP_MS);
/** The count as the chip says it: `m:ss`, the minutes uncapped (1:05:00 never - the cap is thirty). */
export function egCountText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── the halls and circles (section 7) ──────────────────────────────────────────────────────────────────────
/** Hall h's circle, its slot (1-5), and whether it is a Court. */
export const egCircleOfHall = (h) => Math.ceil(h / 5);
export const egSlotOfHall = (h) => ((h - 1) % 5) + 1;
export const egIsCourt = (h) => h % 5 === 0;
/** A circle's first hall. */
export const egFirstHallOf = (c) => 5 * (c - 1) + 1;
/** EG-F (section 16.6): THE FIRST HALL OF A BREACH THAT STARTS AT REDOUBT `ew` - the next circle's first (Hall 1 for 0). */
export const egStartHall = (ew) => (Number.isSafeInteger(ew) && ew > 0 ? egFirstHallOf(ew + 1) : 1);

/** THE BANDS (section 7): every 25 halls the torn halls fall further down the legions' road - the Broken Galleries, the
 *  Soul Cairn, the Shade Perilous, and the Havoc Wellhead, which never ends. */
export const EG_BANDS = Object.freeze([
  Object.freeze({ key: 'galleries', name: 'The Broken Galleries', aspect: 'burning', el: 'fire' }),
  Object.freeze({ key: 'cairn', name: 'The Soul Cairn', aspect: 'venom', el: 'poison' }),
  Object.freeze({ key: 'shade', name: 'The Shade Perilous', aspect: 'rime', el: 'frost' }),
  Object.freeze({ key: 'wellhead', name: 'The Havoc Wellhead', aspect: 'burning', el: 'fire' }),
]);
export const EG_BAND_NAMES = Object.freeze(EG_BANDS.map((b) => b.name));
/** Hall h's band (0-3), and a circle's. */
export const egBandOfHall = (h) => (h <= 25 ? 0 : h <= 50 ? 1 : h <= 75 ? 2 : 3);
export const egBandOfCircle = (c) => egBandOfHall(egFirstHallOf(c));
/** The Brink halls: the first hall of each band below the first (section 8.9). */
export const EG_BRINK_HALLS = Object.freeze([26, 51, 76]);
/** EG-E3 (2026-10-12, Mac: "I said I want everything"; section 13.3, THE SEAL): how many bands this deploy opens, from the
 *  top - a band past them is sealed, and a deploy that raises the number lifts its seal (the herald says the first breach
 *  through it: net/eliteGates/egHerald.js, which keeps what the hub first saw open). EG-FULL laid all four bands, so all four are
 *  open and no breach ends at a seal today: the director's `'seal'` end is for a deploy that opens fewer. */
export const EG_OPEN = EG_BANDS.length;

/** The hall kinds (section 8) - the six, the Court, the Brink, and the Scriptorium (a twist in slot 3). */
export const EG_HALL_KINDS = Object.freeze(['yard', 'span', 'proving', 'rampart', 'court', 'athenaeum', 'deepway', 'brink', 'scriptorium']);
/** Each kind's variants, and the band each unlocks at (section 8.1, 8.3). */
export const EG_VARIANTS = Object.freeze({
  yard: Object.freeze(['riftyard', 'wellspring', 'muster', 'holdfast', 'wellmouth']),
  rampart: Object.freeze(['siege', 'fallingwall', 'winch', 'gauntlet', 'forgebridge']),
});
export const EG_VARIANT_BAND = Object.freeze([0, 0, 1, 2, 3]);
/** The variants a band has unlocked for a kind. */
export const egVariantsOf = (kind, band) => (EG_VARIANTS[kind] ?? []).filter((_, i) => EG_VARIANT_BAND[i] <= band);
export const EG_HALL_NAMES = Object.freeze({
  yard: 'The Rift-Yard', span: 'The Span', proving: 'The Proving Walk', rampart: 'The Rampart', court: 'The Court', athenaeum: 'The Athenaeum', deepway: 'The Deepway', brink: 'The Brink', scriptorium: 'The Scriptorium',
  riftyard: 'The Rift-Yard', wellspring: 'The Wellspring', muster: 'The Muster', holdfast: 'The Holdfast', wellmouth: 'The Wellmouth',
  siege: 'The Siege-Walk', fallingwall: 'The Falling Wall', winch: 'The Winch', gauntlet: 'The Gauntlet', forgebridge: 'The Forge Bridge',
});
/** What each hall asks (section 27.3's objective chip), by variant where it has one, else by kind. Each spec carries its
 *  hall's (`objective`), so these words are a hall's bytes (section 22's law pin - egSpecDigest, every law's halls hashed
 *  whole) and stay as laid. FIELD BUGS 2026-10-19f GAUNTLET-PLATES: the screen no longer shows the Gauntlet's - "Silence the
 *  casters." sent a company to kill them, and a slain Caster is not silenced (net/eliteGates/egBrain.js trialStep); it says
 *  ui/eliteGates/egHud.js egObjectiveText's, the plates named, in the player's language. */
export const EG_OBJECTIVES = Object.freeze({
  yard: 'Close the rifts.', riftyard: 'Close the rifts.', wellspring: 'Break the anchors, then the Wellspring.', muster: 'Fell the standard.', holdfast: 'Hold the relic.', wellmouth: 'Close the wandering rifts.',
  rampart: 'Break the wards at the portcullis.', siege: 'Break the wards at the portcullis.', fallingwall: 'Outrun the falling wall. Break the wards.', winch: 'Hold the winch plates.', gauntlet: 'Silence the casters.', forgebridge: 'Climb the forge bridge. Break the wards.',
  span: 'Cross.', proving: 'Fell the champion.', court: 'Fell the lord.', athenaeum: 'Turn the Orrery true.', deepway: 'Find the way down.', brink: 'Cross into the deep.', scriptorium: 'Rest a moment.',
});
/** The objective for a spec. */
export const egObjectiveOf = (spec) => EG_OBJECTIVES[spec?.variant] ?? EG_OBJECTIVES[spec?.kind] ?? '';

/** The circle law's weights (section 9): slots 1 and 4 draw the Rift-Yard against the Rampart, slot 3 the Proving Walk
 *  against the Athenaeum, by band. */
export const EG_KIND_WEIGHTS = Object.freeze([
  Object.freeze({ yard: 3, rampart: 2, proving: 3, athenaeum: 1 }),
  Object.freeze({ yard: 3, rampart: 3, proving: 2, athenaeum: 1 }),
  Object.freeze({ yard: 2, rampart: 3, proving: 3, athenaeum: 1 }),
  Object.freeze({ yard: 3, rampart: 3, proving: 3, athenaeum: 1 }),
]);

/** THE TWISTS (section 8.7), and the kinds each may turn. */
export const EG_TWISTS = Object.freeze(['vault', 'bargain', 'squad', 'scriptorium', 'ghost', 'deserter', 'mimic', 'captive', 'sutler']);
const TRIAL_KINDS = Object.freeze(['yard', 'span', 'proving', 'rampart', 'athenaeum', 'deepway']);
export const EG_TWIST_ON = Object.freeze({
  vault: Object.freeze(['span', 'proving']), bargain: TRIAL_KINDS, squad: Object.freeze(['yard', 'rampart']), scriptorium: Object.freeze(['proving', 'athenaeum']),
  ghost: TRIAL_KINDS, deserter: Object.freeze(['yard']), mimic: TRIAL_KINDS, captive: TRIAL_KINDS, sutler: TRIAL_KINDS,
});
export const EG_TWIST_NAMES = Object.freeze({
  vault: 'Reliquary Vault', bargain: "Dagon's Bargain", squad: 'Kynval Squad', scriptorium: 'The Scriptorium', ghost: "A Battlemage's Ghost",
  deserter: 'The Deserter', mimic: 'The Kyn Mimic', captive: 'The Captive Battlemage', sutler: 'The Sutler',
});
export const EG_TWIST_LINES = Object.freeze({
  vault: 'A side span leads to a vault with an extra Reliquary.', bargain: 'A shrine to Dagon offers a Reliquary for one more decree.', squad: 'A Kynval squad holds this hall.', scriptorium: 'A quiet hall. You heal, and the door opens in 30 s.',
  ghost: "A Battlemage's ghost fights beside you.", deserter: 'A Dremora deserter races you to close the rifts.', mimic: 'Some caches are Kyn Mimics. Their lids breathe red.', captive: 'A Battlemage hangs in chains. Break them for a Cantrip each.', sutler: 'The Sutler sells Cantrips, Tonics and shards for lumen.',
});

// ── the lords (section 13.3) ─────────────────────────────────────────────────────────────────────────────
/** EVERY LORD: its key, its card (name and epithet), its band, its body (a Daggerfall mobile drawn at `scale` - the
 *  gate's BOSS_LOOKS law), its aspect, its ground. The Valkynaz hold every fifth Court. */
export const EG_LORDS = Object.freeze({
  hound: Object.freeze({ key: 'hound', name: 'Grath', epithet: 'the Hound', band: 0, mobile: 27, scale: 3, el: 'fire', ground: 'isles', motif: 0 }),
  spellmaster: Object.freeze({ key: 'spellmaster', name: 'The Last Spellmaster', epithet: 'Raised by the Kyn', band: 0, mobile: 33, scale: 2.5, el: 'shock', ground: 'disc18', motif: 1 }),
  armsmaster: Object.freeze({ key: 'armsmaster', name: 'The Last Armsmaster', epithet: 'Raised by the Kyn', band: 0, mobile: 15, scale: 2.6, el: null, ground: 'disc20', motif: 2 }),
  ilthys: Object.freeze({ key: 'ilthys', name: 'Valkynaz Ilthys', epithet: 'of the Galleries', band: 0, mobile: 31, scale: 3.0, el: 'fire', ground: 'rotunda', valk: 1, motif: 3 }),
  cairnkeeper: Object.freeze({ key: 'cairnkeeper', name: 'The Cairn-Keeper', epithet: 'Warden of the Dead', band: 1, mobile: 32, scale: 3, el: 'poison', ground: 'crypt', motif: 4 }),
  twins: Object.freeze({ key: 'twins', name: 'The Twin Lords', epithet: 'Vael and Isk', band: 1, mobile: 26, scale: 2.6, el: 'fire', ground: 'twins', motif: 5 }),
  morvayn: Object.freeze({ key: 'morvayn', name: 'Valkynaz Morvayn', epithet: 'of the Cairn', band: 1, mobile: 31, scale: 3.3, el: 'poison', ground: 'soulbridge', valk: 1, motif: 6 }),
  dusk: Object.freeze({ key: 'dusk', name: 'The Mother of Dusk', epithet: 'Winged by Dagon', band: 2, mobile: 29, scale: 3, el: 'frost', ground: 'glade', fly: 1, motif: 7 }),
  stalker: Object.freeze({ key: 'stalker', name: 'The Night-Stalker', epithet: 'Who Drinks the Dark', band: 2, mobile: 30, scale: 2.5, el: null, ground: 'disc22', motif: 8 }),
  seyth: Object.freeze({ key: 'seyth', name: 'Valkynaz Seyth', epithet: 'of the Shade', band: 2, mobile: 31, scale: 3.6, el: 'frost', ground: 'vault', valk: 1, motif: 9 }),
  colossus: Object.freeze({ key: 'colossus', name: 'The Bound Colossus', epithet: "The Battlemages' Engine", band: 3, mobile: 36, scale: 4, el: 'shock', ground: 'forge', motif: 10 }),
  wyrm: Object.freeze({ key: 'wyrm', name: 'The Wellhead Wyrm', epithet: 'Of the Molten Deep', band: 3, mobile: 34, scale: 5, el: 'fire', ground: 'perches', fly: 1, motif: 11 }),
  garoth: Object.freeze({ key: 'garoth', name: 'Valkynaz Garoth', epithet: 'of the Wellhead', band: 3, mobile: 31, scale: 4.0, el: 'fire', ground: 'pit', valk: 1, motif: 12 }),
});
/** The Court lords by band (the Valkynaz aside). */
export const EG_BAND_LORDS = Object.freeze([
  Object.freeze(['hound', 'spellmaster', 'armsmaster']), Object.freeze(['cairnkeeper', 'twins']), Object.freeze(['dusk', 'stalker']), Object.freeze(['colossus', 'wyrm']),
]);
export const EG_VALKYNAZ = Object.freeze(['ilthys', 'morvayn', 'seyth', 'garoth']);
/** THE PROVING CHAMPIONS (section 8.5): one per Kyn rank, by band - and each rank's signature. */
export const EG_CHAMPIONS = Object.freeze([
  Object.freeze({ key: 'kynreeve', name: 'The Kynreeve', sig: 'shieldwall', title: 'Shield-Wall' }),
  Object.freeze({ key: 'kynmarcher', name: 'The Kynmarcher', sig: 'citadel', title: 'The Citadel' }),
  Object.freeze({ key: 'markynaz', name: 'The Markynaz', sig: 'decree', title: "The Grand Duke's Decree" }),
  Object.freeze({ key: 'markynaz', name: 'The Markynaz', sig: 'decree', title: "The Grand Duke's Decree" }),
]);

// ── the decrees (section 14) ─────────────────────────────────────────────────────────────────────────────
/** A decree law's numbers are thousandths: 1000 is x1 (an X-keyed law's), 850 a threat pick of 0.85. */
export const EG_LAW_UNIT = 1000;
/** A decree's law by rank - `[rank I's, rank II's]`, frozen. */
const lawRanks = (one, two) => Object.freeze([Object.freeze(one), Object.freeze(two)]);
/** EG5: a gate trial's numbers (net/gate/gateMods.js GATE_TRIALS - read, never copied), and a number in thousandths. */
const trial = (k) => /** @type {any} */ (gateTrialOf(k));
const milli = (v) => Math.round(v * EG_LAW_UNIT);
/** EVERY DECREE: its number, its family, its name, its line (and the lord family's `law` - section 14's merge). */
export const EG_DECREE_FAMILIES = Object.freeze(['blows', 'legion', 'ground', 'covenant', 'lord']);
export const EG_DECREES = Object.freeze([
  Object.freeze({ id: 0, key: 'chained', fam: 'blows', name: 'Chained Blows', line: 'Each legion blow is followed by a second.' }),
  Object.freeze({ id: 1, key: 'twincharge', fam: 'blows', name: 'Twin Charge', line: 'A Breaker\'s charge is followed by a second.' }),
  Object.freeze({ id: 2, key: 'pyre', fam: 'blows', name: 'Pyre-Bound', line: 'A slain add bursts into flame.' }),
  Object.freeze({ id: 3, key: 'shades', fam: 'blows', name: 'Vengeful Shades', line: 'A slain add\'s shade chases its slayer, then bursts.' }),
  Object.freeze({ id: 4, key: 'pack', fam: 'legion', name: 'Hunting Pack', line: 'Harriers hunt every hall.' }),
  Object.freeze({ id: 5, key: 'swarm', fam: 'legion', name: 'Swarm-Mother', line: 'Every wave carries a Binder.' }),
  Object.freeze({ id: 6, key: 'vigil', fam: 'legion', name: "Kyn's Vigil", line: 'A champion and its escort wait at the start of every hall.' }),
  Object.freeze({ id: 7, key: 'rally', fam: 'legion', name: "Kyn's Rally", line: 'A slain add makes the rest of its wave stronger.' }),
  Object.freeze({ id: 8, key: 'soulpools', fam: 'legion', name: 'Soul-Pools', line: 'A slain add leaves a pool that heals other adds unless you stand in it.' }),
  Object.freeze({ id: 9, key: 'ashfall', fam: 'ground', name: 'Ashfall', line: 'Meteors fall on the fight floors.' }),
  Object.freeze({ id: 10, key: 'gale', fam: 'ground', name: 'Gale-Swept', line: 'Gusts blow across every span.' }),
  Object.freeze({ id: 11, key: 'crumbling', fam: 'ground', name: 'Crumbling Halls', line: 'Part of every span crumbles away.' }),
  Object.freeze({ id: 12, key: 'sparks', fam: 'ground', name: 'Wellhead Sparks', line: 'Sparks rise and burst unless struck down.' }),
  Object.freeze({ id: 13, key: 'press', fam: 'covenant', name: "The Covenant's Press", line: 'The next Redoubt gives less time.' }),
  Object.freeze({ id: 14, key: 'ashen', fam: 'covenant', name: 'Ashen Vigil', line: 'The next rest heals less.' }),
  // EG5 (2026-10-12; section 14, THE MERGE): the lord family's four are the gate's boss-general trials (net/gate/gateMods.js
  // GATE_TRIALS) RECAST AS X-KEYED LAWS - `law` its rank I's (the trial's own numbers) and its rank II's (the page's), each
  // in thousandths (EG_LAW_UNIT: the law decides in integers); a key ending in X multiplies, any other is the last decree's
  // that names it (egLawFold). Colossal's radii are the page's 1.2 (the Slam 8.4 m, not the gate's 8.5); Unyielding's ward is
  // x2, the trial's 6 s over the gate's SHIELD_MS 3 s, in place of its `shieldMs`
  Object.freeze({ id: 15, key: 'colossal', fam: 'lord', name: 'Colossal', line: 'The lord is larger and tougher, with a wider reach.', law: lawRanks({ sizeX: milli(trial('colossal').size), hpX: milli(trial('colossal').hp), radiusX: 1200 }, { sizeX: 1400, hpX: 1400, radiusX: 1300 }) }),
  Object.freeze({ id: 16, key: 'unyielding', fam: 'lord', name: 'Unyielding', line: 'The lord takes less damage, and its ward holds longer.', law: lawRanks({ shieldX: 2000, hitX: milli(trial('unyielding').hit) }, { shieldX: 3000, hitX: 750 }) }),
  Object.freeze({ id: 17, key: 'vengeful', fam: 'lord', name: 'Vengeful', line: 'The lord strikes harder.', law: lawRanks({ dmgX: milli(trial('vengeful').dmg) }, { dmgX: 1400 }) }),
  Object.freeze({ id: 18, key: 'grudge', fam: 'lord', name: 'Grudge-Bearer', line: 'The lord hunts whoever hurts it most.', law: lawRanks({ threatPick: milli(trial('grudge').threatPick), threatDecay: milli(trial('grudge').threatDecay) }, { threatPick: 950, threatDecay: 0 }) }),
  // AUDIT EG V (L2-10; sections 8.4 and 14): THE FRAYING - the Hour's omen (net/superDungeon/sdMarks.js SD_OMENS) as a decree of the ground,
  // drawn only for a circle with an Athenaeum; its fray is net/eliteGates/egRun.js egFrayOf's, fed to the Orrery's draw (net/eliteGates/egBrain.js)
  Object.freeze({ id: 19, key: 'fraying', fam: 'ground', name: 'The Fraying', line: 'The Orrery snaps back sooner.' }),
]);
export const EG_DECREE_BY_KEY = Object.freeze(Object.fromEntries(EG_DECREES.map((d) => [d.key, d])));
/** How many families a circle draws (section 14): none in the first, then one more every second circle, four at most. */
export const egDecreeCount = (c) => (c <= 1 ? 0 : Math.min(4, 1 + Math.floor((c - 2) / 2)));
/** From circle 10, one decree a circle ranks up to II. */
export const egDecreeRanksUp = (c) => c >= 10;
/** THE PROCLAMATION'S EIGHT (section 20): the week's one rule, at rank I, for every breach that week. */
export const EG_PROCLAMATIONS = Object.freeze(['rally', 'sparks', 'soulpools', 'shades', 'pyre', 'crumbling', 'ashfall', 'pack']);
/** The week's Proclamation (a decree key), by the arena's week. */
export const egProclamationOf = (week) => EG_PROCLAMATIONS[((week % 8) + 8) % 8];
/** The decrees that change a span's course, folded into the spec's `geo` (Gale-Swept's rank and Crumbling Halls'). */
export const egGeoOf = (decrees) => {
  let g = 0, cr = 0;
  for (const [id, rank] of decrees ?? []) { if (id === EG_DECREE_BY_KEY.gale.id) g = Math.max(g, rank); if (id === EG_DECREE_BY_KEY.crumbling.id) cr = Math.max(cr, rank); }
  return g + 3 * cr;
};


/** EG5 (2026-10-12; section 14, THE PROFILE): the most decrees a circle bears - four drawn, a Bargain's, the Proclamation
 *  and three wagered (the frames' nine: net/wire.js `egDecreesW`). */
export const EG_DECREES_MAX = 9;
/** The X-keyed laws' keys (each x1 where no decree names it): the lord family's, from the table. */
export const EG_LAW_X_KEYS = Object.freeze([...new Set(EG_DECREES.flatMap((d) => (/** @type {any} */ (d).law ?? []).flatMap((L) => Object.keys(L))).filter((k) => k.endsWith('X')))]);
/**
 * THE PROFILE'S VALIDATOR: a circle's decrees as the state says them (`[[id, rank], ...]` - net/eliteGates/egRun.js egDecreesInForce) -
 * at most EG_DECREES_MAX, each a known decree at rank 1 or 2, none twice. Answers a fresh copy, or null.
 * @param {unknown} dc
 * @returns {Array<[number, number]>|null}
 */
export function validEgDecrees(dc) {
  if (!Array.isArray(dc) || dc.length > EG_DECREES_MAX) return null;
  const seen = new Set(), out = [];
  for (const p of dc) {
    if (!Array.isArray(p) || p.length !== 2 || !Number.isInteger(p[0]) || !EG_DECREES[p[0]] || (p[1] !== 1 && p[1] !== 2) || seen.has(p[0])) return null;
    seen.add(p[0]);
    out.push([p[0], p[1]]);
  }
  return out;
}
/** How many profiles are kept (the least recently asked dropped first): the Spire's decree sets are not a bounded few, as
 *  the gate's 185 and the Hour's 216 are. */
export const EG_PROFILE_CACHE_MAX = 256;
const _profiles = new Map();
/**
 * THE FOLD (section 14, "The merge" - net/superDungeon/sdMarks.js sdMarksLaw's rule): laws in thousandths, in their order - a key ending
 * in X multiplies (rounded to the thousandth), any other is the last law's that names it; each X-keyed number x1
 * (EG_LAW_UNIT) where none names it. Answers the folded law, in thousandths. Pure.
 * @param {ReadonlyArray<Readonly<Record<string, number>>|undefined|null>} laws
 */
export function egLawFold(laws) {
  /** @type {Record<string, number>} */
  const acc = {};
  for (const k of EG_LAW_X_KEYS) acc[k] = EG_LAW_UNIT;
  for (const L of laws) for (const [k, v] of Object.entries(L ?? {})) acc[k] = k.endsWith('X') ? Math.round(((acc[k] ?? EG_LAW_UNIT) * v) / EG_LAW_UNIT) : v;
  return acc;
}
/**
 * EG5 - THE FIGHT'S PROFILE (section 14): what a circle's decrees `dc` make of the fight its lords run by - net/superDungeon/sdRemnant.js
 * sdFightProfile's fold: every decree's law (egLawFold), in the order of its number. Answers `{ dc, key, law }`:
 * the decrees sorted (null for none), the cache's key (the sorted decree string, `id:rank,...`), and `law` - every
 * X-keyed number (x1 where none names it) and each other a decree named, as numbers (net/eliteGates/egLords.js egLordLaw reads it,
 * with the gate's own threat where none is named). An invalid list is the fight with no decree. Pure, frozen, and kept
 * (LRU, EG_PROFILE_CACHE_MAX) - only the lord family's four carry a law; the other families are read by rank where they
 * act (the legion, the director, the spans).
 * @param {unknown} dc
 */
export function egFightProfile(dc) {
  const ok = validEgDecrees(dc) ?? [];
  ok.sort((a, b) => a[0] - b[0]);
  const key = ok.map(([id, rank]) => `${id}:${rank}`).join(',');
  const had = _profiles.get(key);
  if (had) { _profiles.delete(key); _profiles.set(key, had); return had; }   // the most recently asked kept last
  const acc = egLawFold(ok.map(([id, rank]) => /** @type {any} */ (EG_DECREES[id]).law?.[rank - 1]));
  /** @type {Record<string, number>} */
  const law = {};
  for (const [k, v] of Object.entries(acc)) law[k] = v / EG_LAW_UNIT;
  const P = Object.freeze({ dc: ok.length ? Object.freeze(ok.map((p) => Object.freeze(p))) : null, key, law: Object.freeze(law) });
  if (_profiles.size >= EG_PROFILE_CACHE_MAX) _profiles.delete(_profiles.keys().next().value);
  _profiles.set(key, P);
  return P;
}
/** How many profiles the cache holds now (its bound's pin). */
export const egProfilesKept = () => _profiles.size;

/** Halls stand this far apart across x in a circle's level (m) - far past the fog, so a hall never sees the next. */
export const EG_HALL_PITCH = 500;

/** The breach's seed for a draw (the Hour's mix - net/superDungeon/sdBrain.js sdSeed). */
export const egSeed = (seed, salt) => sdSeed(seed >>> 0, salt >>> 0);
const CIRCLE_SALT = 0x0e6c1c;
const HALL_SALT = 0x0e6a11;
/** A course laid again (THE TIMED SOLVER's redraw) takes this far a sub-seed per try. */
const RELAY_SALT = 0x5a1d;
const LORD_SALT = 0x0e610d;
/** THE ASCENT (spec law 9): the planner's die's salt (egSeed(seed, ASCENT_SALT + h) - a try its own, as a hall's is). */
const ASCENT_SALT = 0x0e9a5c;

/**
 * THE CIRCLE'S PLAN (section 7's rhythm, section 9's circle law, section 8.7's twists): its five slots, each
 * `{ kind, variant, twist }` - a fight, the traverse, the mixed, a fight drawn apart from the first, the Court. The
 * first circle is fixed (a Rift-Yard, a Span through an Oblivion Caverns passage, a Proving Walk, a Siege-Walk, Grath's
 * Court); circles 6, 11 and 16 open on a Brink; from circle 3 the traverse is the Deepway one time in three; the
 * Athenaeum takes slot 3 at its weight, never in the first circle; a variant is never one of its kind's last
 * min(2, unlocked - 1) draws; from circle 2 about one trial hall in four carries a twist, never the Court, never two running
 * (AUDIT EG V - spec law 8: a slot's roll a third, so one in four of the trial halls the rule leaves turns; the laws before
 * rolled a quarter, one in five). Each circle's draw depends on the ones before it (the variants' memory), so plans are laid in
 * order and kept - a law's apart from another's (`law`, this build's EG_SPEC unless named).
 * @param {number} seed @param {number} c @param {number} [law]
 * @returns {ReadonlyArray<{kind: string, variant: string|null, twist: string|null}>}
 */
export function egCirclePlan(seed, c, law = EG_SPEC) {
  const s = seed >>> 0, key = `${s}:${law >= EG_WAYS_LAW ? 1 : 0}`;
  let rec = _plans.get(key);
  if (!rec) { rec = { plans: [null, FIRST_PLAN], last: { yard: ['riftyard'], rampart: ['siege'] } }; if (_plans.size >= 16) _plans.delete(_plans.keys().next().value); _plans.set(key, rec); }
  for (let k = rec.plans.length; k <= c; k++) rec.plans.push(layPlan(s, k, rec.last, law));
  return rec.plans[Math.max(1, c)];
}
const _plans = new Map();
const FIRST_PLAN = Object.freeze([
  Object.freeze({ kind: 'yard', variant: 'riftyard', twist: null }), Object.freeze({ kind: 'span', variant: null, twist: null }),
  Object.freeze({ kind: 'proving', variant: null, twist: null }), Object.freeze({ kind: 'rampart', variant: 'siege', twist: null }),
  Object.freeze({ kind: 'court', variant: null, twist: null }),
]);
function layPlan(seed, c, last, law) {
  const r = sdRng(egSeed(seed, CIRCLE_SALT + c)), band = egBandOfCircle(c), W = EG_KIND_WEIGHTS[band];
  const weighed = (a, b) => (r() * (W[a] + W[b]) < W[a] ? a : b);
  const variant = (kind, not = null) => {
    const open = egVariantsOf(kind, band), mem = Math.min(2, open.length - 1);
    const recent = (last[kind] ?? []).slice(-mem);
    let pool = open.filter((v) => !recent.includes(v) && v !== not);
    if (!pool.length) pool = open.filter((v) => v !== not);
    if (!pool.length) pool = open;
    const v = pool[Math.floor(r() * pool.length)];
    last[kind] = [...(last[kind] ?? []), v].slice(-4);
    return v;
  };
  const slots = [];
  const brink = c === 6 || c === 11 || c === 16;
  const k1 = brink ? 'brink' : weighed('yard', 'rampart');
  const v1 = brink ? null : variant(k1);
  slots.push({ kind: k1, variant: v1, twist: null });
  slots.push({ kind: c >= 3 && r() * 3 < 1 ? 'deepway' : 'span', variant: null, twist: null });
  slots.push({ kind: weighed('proving', 'athenaeum'), variant: null, twist: null });
  const k4 = weighed('yard', 'rampart');
  slots.push({ kind: k4, variant: variant(k4, k4 === k1 ? v1 : null), twist: null });
  slots.push({ kind: 'court', variant: null, twist: null });
  // THE TWISTS: about one trial hall in four, never the Court or a Brink, never two running; a Bargain at most once a circle.
  // AUDIT EG V (lane3 #11) - LAW 8: a slot rolls a third (never two running leaves a quarter of the slots turning - p / (1 + p));
  // the laws before rolled a quarter (one trial hall in five)
  let prev = false, bargain = false;
  for (let i = 0; i < 4; i++) {
    const sl = slots[i];
    const roll = r(), pickAt = r();
    if (prev || sl.kind === 'brink' || (law >= EG_WAYS_LAW ? roll * 3 >= 1 : roll >= 0.25)) { prev = false; continue; }
    const can = EG_TWISTS.filter((t) => EG_TWIST_ON[t].includes(sl.kind) && !(t === 'bargain' && bargain) && !(t === 'scriptorium' && i !== 2) && !(t === 'deserter' && !['riftyard', 'wellmouth'].includes(sl.variant)));
    if (!can.length) { prev = false; continue; }
    const t = can[Math.floor(pickAt * can.length)];
    sl.twist = t;
    if (t === 'bargain') bargain = true;
    if (t === 'scriptorium') { sl.kind = 'scriptorium'; sl.variant = null; }
    prev = true;
  }
  return Object.freeze(slots.map((sl) => Object.freeze(sl)));
}
/** THE CIRCLE's five kinds (the plan's, read alone - AUDIT EG V: under spec law `law`, this build's unless named). */
export const egCircleOf = (seed, c, law = EG_SPEC) => Object.freeze(egCirclePlan(seed, c, law).map((p) => p.kind));

/**
 * THE COURT'S LORD (section 13.3) for circle c: every fifth Court a Valkynaz's (Ilthys at Redoubt 5, Morvayn at 10, Seyth
 * at 15, Garoth at 20 and every fifth after); the first circle's Grath; else drawn - the band's own lords at weight 2,
 * every earlier band's at weight 1, never one of the last min(2, pool - 1) Courts'. Laid in order and kept.
 */
export function egBossOf(seed, c) {
  if (c % 5 === 0) return EG_VALKYNAZ[Math.min(3, c / 5 - 1)];
  if (c <= 1) return 'hound';
  const s = seed >>> 0;
  let rec = _lords.get(s);
  if (!rec) { rec = ['', 'hound']; if (_lords.size >= 16) _lords.delete(_lords.keys().next().value); _lords.set(s, rec); }
  for (let k = rec.length; k <= c; k++) {
    if (k % 5 === 0) { rec.push(EG_VALKYNAZ[Math.min(3, k / 5 - 1)]); continue; }
    const band = egBandOfCircle(k), pool = [];
    for (let b = 0; b <= band; b++) for (const l of EG_BAND_LORDS[b]) pool.push([l, b === band ? 2 : 1]);
    const drawn = rec.slice(1).filter((l, i) => (i + 1) % 5 !== 0);
    const mem = Math.min(2, pool.length - 1), recent = drawn.slice(-mem);
    const open = pool.filter(([l]) => !recent.includes(l));
    const r = sdRng(egSeed(s, LORD_SALT + k));
    let x = r() * open.reduce((m, [, w]) => m + w, 0), pick = open[open.length - 1][0];
    for (const [l, w] of open) { x -= w; if (x < 0) { pick = l; break; } }
    rec.push(pick);
  }
  return rec[c];
}
const _lords = new Map();
/** A lord's card: its name and epithet. */
export const egLordCard = (key) => EG_LORDS[key] ? { name: EG_LORDS[key].name, epithet: EG_LORDS[key].epithet } : { name: 'The Lord', epithet: '' };

// ── the law's trigonometry: whole degrees in steps of 5, sines times 10,000 ────────────────────────────────
const SIN_Q = Object.freeze([0, 872, 1736, 2588, 3420, 4226, 5000, 5736, 6428, 7071, 7660, 8192, 8660, 9063, 9397, 9659, 9848, 9962, 10000]);
/** The sine of `deg` (a multiple of 5) times 10,000, exact in integers. */
export function lawSin(deg) {
  const d = (((deg | 0) % 360) + 360) % 360;
  if (d % 5 !== 0) throw new Error(`lawSin: ${deg} is not a multiple of 5`);
  const q = d / 5;
  if (q <= 18) return SIN_Q[q];
  if (q <= 36) return SIN_Q[36 - q];
  if (q <= 54) return -SIN_Q[q - 36];
  return -SIN_Q[72 - q];
}
export const lawCos = (deg) => lawSin((deg | 0) + 90);
/** The integer square root of a whole number (the largest q with q*q <= n) - Newton's, in integers alone. */
export function lawIsqrt(n) {
  const m = Math.trunc(n);
  if (!(m > 0)) return 0;
  let q = m, r = Math.trunc((q + 1) / 2);
  while (r < q) { q = r; r = Math.trunc((q + Math.trunc(m / q)) / 2); }
  return q;
}
/** A point `r` cm from (x, z) at bearing `deg` (the court frame's: 0 along +z, 90 along +x), whole centimetres. */
const polar = (x, z, r, deg) => [x + Math.trunc((r * lawSin(deg)) / 10000), z + Math.trunc((r * lawCos(deg)) / 10000)];

// ── the hall spec (section 9) ──────────────────────────────────────────────────────────────────────────────
/** A die's whole number from lo to hi, both in. */
const between = egDieBetween;
const m = (cm) => cm / 100;
/** The span's pieces, the Steps' sizes and clocks (world/superDungeon/sdSteps.js - pinned equal), in cm and ms. */
export const EG_STEP = Object.freeze({
  drift: Object.freeze({ w: 300, d: 240 }), beat: Object.freeze({ w: 300, d: 260 }), riser: Object.freeze({ w: 300, d: 260 }),
  crumble: Object.freeze({ w: 260, d: 260 }), still: Object.freeze({ w: 300, d: 260 }), ledge: Object.freeze({ w: 240, d: 200 }),
  gust: Object.freeze({ w: 300, d: 260 }), rail: Object.freeze({ w: 300, d: 300 }), pend: Object.freeze({ w: 300, d: 260 }),
  vent: Object.freeze({ w: 420, d: 420 }), drop: Object.freeze({ w: 600, d: 600 }),
  // EG-FULL LAYER THREE: the fragments' own pieces (net/eliteGates/egSpanLaw.js) - a moon-bound branch, a rolling drum, a bone bridge
  // (the Crumble's depth), a flight of the Sinking Stair
  moon: Object.freeze({ w: 280, d: 220 }), drum: Object.freeze({ w: 300, d: 300 }), bone: Object.freeze({ w: 260, d: 260 }), sink: Object.freeze({ w: 300, d: 260 }),
  // EG-ZC: a slag crossing's crust, each spout's lane (net/eliteGates/egFragLaw.js EG_SLAG_STEP - its one home)
  slag: EG_SLAG_STEP,
});
/** EG-HERO-LAY: the narrowest a hero's mouth and its course's exit may be (cm) - the narrowest top a course asks a body to
 *  land on, a ledge's. */
export const EG_HERO_WAY_CM = EG_STEP.ledge.w;
/** Which pieces each band unlocks (section 10.3) - the Galleries' five, the Cairn's Gust and Rail, the Shade's Pendulum,
 *  the Wellhead's Vent. */
export const EG_BAND_PIECES = Object.freeze([
  Object.freeze(['drift', 'beat', 'riser', 'crumble', 'drop']),
  Object.freeze(['drift', 'beat', 'riser', 'crumble', 'drop', 'gust', 'rail']),
  Object.freeze(['drift', 'beat', 'riser', 'crumble', 'drop', 'gust', 'rail', 'pend']),
  Object.freeze(['drift', 'beat', 'riser', 'crumble', 'drop', 'gust', 'rail', 'pend', 'vent']),
]);
/** THE ENVELOPE (section 10.4): a riser's rise, the Beat's half, a gap's range, a step down within a run (under a metre), a
 *  Drop (at most 4.5 m) - EG6a: the span generator's own (net/eliteGates/egSpanLaw.js), said here as they always were. */
export { EG_RISER_CM, EG_BEAT_HALF_MS, EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_STEP_DOWN_CM, EG_DROP_CM } from './egSpanLaw.js';
/** No hall runs longer than this (m): its fight's every point stays inside the gate's wire bound (net/wire.js
 *  GATE_COURT_BOUND, 160 - pinned under it). */
export const EG_HALL_LEN_MAX = 158;
/** A plate's radius, an island's, a bridge's half-width (cm). */
const PLATE_R = 500, ISLE_R = 300, BRIDGE_HALF = 200;
/** A Rampart's caster pillar's top and the Wyrm's perches' over the floor their side spans leave (cm - sections 8.3, 13.3). */
export const EG_PILLAR_UP_CM = 200;
export const EG_PERCH_UP_CM = 300;
/** AUDIT EG V - LAW 8 (section 11.3, lane5 #5): how far under the Sinking Stair's last flight the island after it stands (cm) -
 *  where the flight's top has sunk to when THE TIMED SOLVER takes its leap (net/eliteGates/egSpanLaw.js EG_SINK_MPS x EG_SINK_ON_S). */
export const EG_SINK_LOW_CM = Math.round(EG_SINK_MPS * EG_SINK_ON_S * 100);
/** The Oblivion Caverns passage (section 11's first fragment): its floor's half-width, its length, the chasm in it and
 *  the ledges that cross it, its height (cm). */
export const EG_CAVE = Object.freeze({ halfW: 300, len: 2800, chasm: 1000, height: 520 });
/** The fragment kits by band (section 11.2): the passage each band's Brinks are torn from (the rest draw from the band's
 *  whole library - net/eliteGates/egFragLaw.js EG_PASSAGE_KITS). */
export const EG_FRAG_KITS = Object.freeze(['caverns', 'ossuary', 'gloam', 'forge']);
/** THE FORK (section 11.4): from circle 2 every span forks at an island - the High Road over the void, the Low Road this
 *  far across (cm, the hall's x) and a Drop down, through a passage beneath; the High Road meets its height by a Drop. */
export const EG_FORK_FROM_C = 2;
export const EG_LOW_X_CM = 1500;
export const EG_FORK_DROP_CM = 450;
/** AUDIT EG V - LAW 8: a forked span's Reliquary Vault stands this far across from the fork's island (cm - the side opposite the
 *  Low Road's), and the most a Low Road's second passage asks of the hall past where it begins (cm - the longest passage kit, the
 *  Forge Gut's with its crust; the High Road's still ground carried past it by a step at most; the plate's gap and the plate:
 *  the hall stays inside EG_HALL_LEN_MAX). */
export const EG_FORK_VAULT_CM = 1000;
export const EG_FORK_THIRD_CM = 3100 + 500 + 320 + 1000;
/** THE BROKEN WAY (spec law 10): the longest THE FORK's course may run before its Low Road's second passage is left out (cm,
 *  from its course's start to the Low Road's end) - a course whose foot stands at the plate's port (5 m) still ends
 *  EG_ASCENT_ROOM_ON_CM short of the hall's far bound (net/eliteGates/egAscent.js EG_ASCENT_BOUND). Law 9 laid it always, and its
 *  deep forks found no foot: 89% of spans from circle 11 laid plainest. */
export const EG_FORK_COURSE_CM = 12500;
/** The roads: the one course (and the High Road), the Low Road, and an alcove's side way (optional - never proven). */
export const EG_ROAD = Object.freeze({ high: 0, low: 1, side: 2 });
/** The Rampart's waystones (m apart), a Falling Wall's start and pace, a Forge Bridge's belt (section 8.3). */
export const EG_WAYSTONE_EVERY_M = 30;
export const EG_WALL_FALL_AFTER_MS = 20_000;
export const EG_WALL_FALL_MPS = 1.5;
export const EG_BELT_MPS = 1.0;

/**
 * HALL h's SPEC (`geo` the circle's span decrees - net/eliteGates/egLaw.js egGeoOf; EG-ZC: `law` the spec law it is drawn under, this
 * build's EG_SPEC unless a breach of the law before asks its own - net/eliteGates/egBrain.js): its kind, variant, twist, band, circle, slot,
 * name and objective; its geometry in its own frame (metres): the plates (`arrive`, `end`), the walkable discs and bands
 * and lanes (`discs`, `bands`, `lanes`), a span's steps and islands (the Steps' record: `{i, kind, span, x, y, z, w, d,
 * amp, period, phase, beat}`, period and phase in seconds), the fragments' passages (`caves`, each its band's kit), and
 * the trial's own: THE FIGHT FLOOR (`fl` - discs `{t:'d', x, z, r, y}` and lanes `{t:'l', ax, az, bx, bz, hw, y}`, and its
 * bounding disc `fight`), its spots by role (`spots` - rifts, anchors, rally points, the relic, runes, gems, pillars,
 * plates, balconies, braziers...), a Rampart's vents and gate and walkway and waystones, a champion's or a lord's spot
 * (`foe`), the Court's wake ring (`ring`) and its lord (`lord`). Frozen, and cached.
 * @param {number} seed @param {number} h @param {number} [geo]
 */
export function egHallOf(seed, h, geo = 0, law = _lawUnnamed) {
  const key = `${seed >>> 0}:${h}:${geo | 0}`;
  const given = _given.get(key);   // EG-H2: a hall the relay drew under the breach's own law (egSpecGive, below)
  if (given) return given;
  const lawKey = law === EG_SPEC ? key : `${key}:${law}`;   // EG-ZC: the law before drawn apart
  const had = _specs.get(lawKey);
  if (had) return had;
  let spec, tries = 0, at = 0;
  if (law >= EG_ASCENT_LAW) {
    // THE ASCENT (spec law 9): a hall whose plan finds no way, or whose courses THE TIMED SOLVER refuses where they stand, or
    // whose way THE ROUTE'S SANITY refuses, is laid again from the next try's dies - the last its plainest
    ({ spec, at } = ascentLaid(seed >>> 0, h, geo | 0, law));
    tries = at;
  } else {
    // THE TIMED SOLVER (section 10.5, net/eliteGates/egSpanLaw.js): a course it refuses is laid again from the next sub-seed, at most
    // EG_RELAY_MAX times, then from the band's first two pieces alone
    spec = layHall(seed >>> 0, h, geo | 0, 0, law);
    while (spec.steps.length && !egSpanProof(spec).ok && tries < EG_RELAY_MAX) spec = layHall(seed >>> 0, h, geo | 0, at = ++tries, law);
    if (spec.steps.length && !egSpanProof(spec).ok) spec = layHall(seed >>> 0, h, geo | 0, at = EG_RELAY_MAX + 1, law);
  }
  // EG-HERO-LAY - SPEC LAW 7: THE HEROES LAID, on the try law 6's hall was laid on (heroHall - law 6's hall where none fits)
  if (law >= EG_HERO_LAW) { const hx = { at }; spec = heroHall(seed >>> 0, h, geo | 0, law, at, spec, null, hx); if (law >= EG_ASCENT_LAW) tries = hx.at; }   // THE ASCENT: the try its hero stands on
  // THE FORK's two roads' fastest crossings at THE SPAN BUILD (s; the Low Road's bridges across and back run too) - the
  // Low Road's closing reads their difference (section 11.4). THE ASCENT: the fork's own course alone (a spec law 9 hall's
  // other courses stand elsewhere along its way)
  if (spec.fork) { const F = law >= EG_ASCENT_LAW ? forkCourse(spec) : spec; spec.fork = { ...spec.fork, hi: Math.round(egRoadCross(F, 0, spec.fork.z).fast * 10) / 10, lo: Math.round((egRoadCross(F, 1).fast + (2 * (spec.fork.lowX - spec.fork.x)) / EG_SPAN_RUN_MPS) * 10) / 10 }; }
  spec = deepFreeze({ ...spec, laid: tries });
  if (_specs.size >= 48) _specs.delete(_specs.keys().next().value);
  _specs.set(lawKey, spec);
  return spec;
}
const _specs = new Map();
/** THE LAW A HALL IS DRAWN UNDER WHERE NONE IS NAMED (egHallOf's and egCircleSpecs' `law` left out): EG_SPEC, the build's. */
let _lawUnnamed = EG_SPEC;
/**
 * THE SEAM (THE ASCENT - THE ROOMS, LAW 9): the law a hall is drawn under where none is named - `law` (one this build draws,
 * net/eliteGates/egDurable.js EG_LAWS) or EG_SPEC. Answers the law it replaced. For a test pinned to a law's ground (the dress, the
 * camera, a swap measured over law 8's halls) and a tool's sweep, and nothing that runs a breach: a breach draws its own law
 * (its `egv`) always.
 * @param {number} [law]
 */
export function egLawSeam(law = EG_SPEC) {
  const was = _lawUnnamed;
  _lawUnnamed = law;
  return was;
}
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
// EG-H2 (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 22, THE LAW PIN): A HALL GIVEN. A client whose law is not
// its breach's (`st`'s `egv` - net/eliteGates/egDurable.js EG_LAWS) asks the room `{k:'spec'}` and takes the relay's own bytes: given,
// a hall is read before any draw, so every reader (world/eliteGates/egHall.js, scenes/eliteGates/egSpan.js, scenes/eliteGates/egFight.js, the breach's
// client) builds the breach's own halls. The relay never gives one. A few circles' worth are kept.
const _given = new Map();
/** A hall the relay drew, taken as given - answers whether it was one (its seed, hall and ground whole numbers). */
export function egSpecGive(spec) {
  if (!spec || typeof spec !== 'object' || !Number.isSafeInteger(spec.seed) || !Number.isSafeInteger(spec.h) || spec.h < 1 || !Number.isSafeInteger(spec.geo ?? 0)) return false;
  const key = `${spec.seed >>> 0}:${spec.h}:${(spec.geo ?? 0) | 0}`;
  if (!_given.has(key) && _given.size >= 32) _given.delete(_given.keys().next().value);
  _given.set(key, deepFreeze(JSON.parse(JSON.stringify(spec))));
  return true;
}
/** Every given hall forgotten (out of the breach). */
export function egSpecForget() { _given.clear(); }

/** How often a course the solver refuses is laid again before the band's first two pieces stand alone (section 10.5). */
export const EG_RELAY_MAX = 8;

// ── THE ASCENT (spec law 9): the hall laid as a way, its courses proven where they stand ──────────────────────────────────
/** A spec law 9 hall laid: the first try whose plan stands, whose courses and way are proven (egAscentProof) and whose spec
 *  is said whole on the wire (EG_SPEC_SAID_MAX) - else the last, its plainest (the band's first two pieces, the fewest rooms,
 *  the plan's longest search). `{ spec, at }`. */
function ascentLaid(seed, h, geo, law) {
  let spec = null, at = 0;
  const said = (q) => JSON.stringify(q).length <= EG_SPEC_SAID_MAX, own = law >= EG_BROKEN_LAW ? EG_BROKEN_TRIES : 0;   // THE BROKEN WAY: the plan's own tries
  // (THE AUDIT - THE BROKEN WAY: a try whose way asks no jump at all is laid again - a Rift-Yard's 284 m and a Rampart's 320 m
  // walked whole, every bridge too short to break)
  const leaps = (q) => law < EG_BROKEN_LAW || (q.route?.links ?? []).some((l) => l.kind === 'span');
  for (; at <= EG_RELAY_MAX + own + 1; at++) {
    spec = layHall(seed, h, geo, at, law);
    if (spec) { const pr = egAscentProof(spec); if (pr.ok && said(spec) && leaps(spec)) return { spec, at }; egAscentNote(`try ${at}: ${!pr.ok ? pr.why.slice(0, 3).join('; ') : !said(spec) ? 'past the wire\'s bound' : 'jumpless'}`); }
  }
  // past every try: the plainest that stands at all (test/net/eliteGates/law9_rooms.test.js holds that none is wanting)
  for (at = EG_RELAY_MAX + own + 1; at < EG_RELAY_MAX + own + 1 + EG_ASCENT_LAST_TRIES; at++) { spec = layHall(seed, h, geo, at, law); if (spec && egAscentProof(spec).ok && said(spec)) return { spec, at }; }
  throw new Error(`net/eliteGates/egLaw.js: spec law ${law} lays no way for seed ${seed} hall ${h} ground ${geo}`);
}
/** A hall laid on one try, unproven and unkept (spec law 9: null where its plan finds no way) - for a tool and a test asking
 *  why a try did not stand. */
export const egHallTry = (seed, h, geo = 0, at = 0, law = _lawUnnamed) => layHall(seed >>> 0, h, geo | 0, at, law);   // (EG-PERFECT: the law unnamed - the seam's, as egHallOf's)
/** How many plainest tries a spec law 9 hall is given past EG_RELAY_MAX before the law says it has none (never met: pinned). */
export const EG_ASCENT_LAST_TRIES = 24;
/** THE BROKEN WAY (spec law 10): the plan's own tries - a hall whose way the planner (not THE TIMED SOLVER) refused is laid
 *  again this many more times from its own dies, its band's whole pieces, its fork and its set piece, before the plainest. Law
 *  9 shared EG_RELAY_MAX between the two and laid 7% of its spans (12.8% from circle 11, 89-98% under the Gale) plainest; law 8
 *  none. */
export const EG_BROKEN_TRIES = 8;
/** A spec law 9 hall's COURSES (cm-free - its said metres): each stretch of steps along +z the plan laid in one leg - the steps
 *  of one road whose line (x) and run hold together - as the hall the solver proves alone: `[{ steps, ... }]`, its route
 *  dropped (a course is proven as a course - by z, THE PROOFS' egRouted false - never as the hall's way). */
export function egAscentCourses(spec) {
  const steps = spec.steps ?? [], out = [], { route: _way, ...bare } = spec, G = spec.route?.courses ?? [];
  // (THE BROKEN WAY - spec law 10: a piece is the least course's that holds it - a broken bridge's plan may stand inside a
  // course's bounding plan at its height; the law before laid none so)
  const one = egLawOf(spec) >= EG_BROKEN_LAW ? steps.map((s) => egCourseHolding(G, s.x, s.y, s.z, 0.5, 0.01)) : null;
  for (const g of G) {
    const inG = (x, z) => x >= g.x0 - 0.01 && x <= g.x1 + 0.01 && z >= g.z0 - 0.01 && z <= g.z1 + 0.01;
    const own = one ? steps.filter((s, i) => one[i] === g) : steps.filter((s) => inG(s.x, s.z) && s.y >= g.y0 - 0.5 && s.y <= g.y1 + 0.5);
    out.push({ ...bare, steps: own.map((s, i) => ({ ...s, i })), frags: (spec.frags ?? []).filter((f) => !f.room && inG(f.x, f.z0) && inG(f.x, f.z1)), fork: spec.fork && inG(spec.fork.x, spec.fork.z) ? spec.fork : null });
  }
  return out;
}
/** THE BROKEN WAY (spec law 10): the course ground of `G` (each `{ x0, x1, z0, z1, y0, y1 }`) that holds the point (x, y, z) -
 *  in plan (within `pad`), its height within `dy` of its floors' - the least in plan of those that do; undefined where none. */
export function egCourseHolding(G, x, y, z, dy, pad = 0) {
  let best, area = Infinity;
  for (const g of G) {
    if (!(x >= g.x0 - pad && x <= g.x1 + pad && z >= g.z0 - pad && z <= g.z1 + pad && y >= g.y0 - dy && y <= g.y1 + dy)) continue;
    const a = (g.x1 - g.x0) * (g.z1 - g.z0);
    if (a < area) { area = a; best = g; }
  }
  return best;
}
/** THE FORK's course alone (its High Road and its Low Road): the course of a spec law 9 hall that holds the fork. */
const forkCourse = (spec) => egAscentCourses(spec).find((q) => q.fork) ?? spec;
/**
 * THE ASCENT'S PROOF (spec law 9): `{ ok, why }` - every course the plan laid proven where it stands by THE TIMED SOLVER
 * (net/eliteGates/egSpanLaw.js egSpanProof over its own steps, its route dropped: its pieces, its pairs' windows and waits, its set
 * pieces' margin, its shafts - THE MEDIAN left to the way), every piece in a course, THE ROUTE'S SANITY (net/eliteGates/egAscent.js
 * egAscentSane: the way walkable link by link, the main way from the plate to the door, its crossings, its length and its
 * time at THE SPAN BUILD bounded) - and then the whole hall proven once as THE PROOFS prove a routed hall (egSpanProof: every
 * link of its proven roads by its kind's law - net/eliteGates/egRouteProof.js - and THE MEDIAN over THE ROUTE, egRouteCross). Pure.
 * @param {any} spec
 */
export function egAscentProof(spec) {
  const why = [], courses = egAscentCourses(spec);
  let n = 0;
  for (const C of courses) { const p = egSpanProof(C, false); n += C.steps.length; if (!p.ok) why.push(...p.why.map((w) => `course at ${C.steps[0]?.z ?? '?'} m: ${w}`)); }
  if (n !== (spec.steps ?? []).length) why.push(`${(spec.steps ?? []).length - n} pieces stand in no course`);
  const sane = why.length ? '' : egAscentSane(spec);
  if (sane) why.push(sane);
  if (!why.length) { const p = egSpanProof(spec); if (!p.ok) why.push(...p.why.map((w) => `the way: ${w}`)); }
  return { ok: why.length === 0, why };
}

// ── EG-HERO-LAY (2026-10-13; sections 11.4-11.6 and 22): SPEC LAW 7, THE HEROES LAID ─────────────────────────────────────
/** The hall's cap of fragments (section 11.4 - a fork's Low Road counted). */
export const EG_FRAGS_MAX = 4;
/** The hanging underside under every piece of a course (cm - section 11.5's "a hanging underside's depth, SD_ROOT_DEPTH
 *  22 m": world/superDungeon/sdRealm.js SD_ROOT_DEPTH, pinned equal - the relay's bundle carries no world module). */
export const EG_HANG_CM = 2200;
/** A Low Road's vault stands at least this far (cm) below the lowest underside above it (section 11.5). */
export const EG_VAULT_UNDER_CM = 300;
/** The most characters a hall's spec may run to, said whole on the wire (net/wire.js EG_SPEC_WIRE_MAX - pinned equal): a
 *  hero's floors, ceilings and walk graph ride in its spec, and a law-foreign client builds from the relay's bytes. */
export const EG_SPEC_SAID_MAX = 32_768;
/** The hero die's salt (egSeed(seed, HERO_SALT + h)): a die of its own, so the hall's own stream never feels the coin. */
const HERO_SALT = 0x0e6e40;
/** The hero registry the law lays from (egHeroSeam) - EG_HERO_FRAGS, the relay's and every client's. */
let _heroFrags = EG_HERO_FRAGS;
/**
 * THE SEAM: the hero registry the hall law lays from - `frags` (a registry of law halves, net/eliteGates/egHeroFrags.js
 * egHeroFragRegistry's shape) or EG_HERO_FRAGS. Every hall kept is forgotten (a hall is the registry's). Answers the registry
 * it replaced. For a test, a tool's sweep, and nothing that runs a breach.
 * @param {Readonly<Record<string, any>>} [frags]
 */
export function egHeroSeam(frags = EG_HERO_FRAGS) {
  const was = _heroFrags;
  _heroFrags = frags;
  _specs.clear();
  return was;
}
/** The heroes a slot of kit `kit` and class `cls` may lay (net/eliteGates/egHeroFrags.js egHeroFragLaws - the reference never). */
export const egHeroCands = (kit, cls, frags = _heroFrags) => egHeroFragLaws(kit, frags).filter((L) => L.class === cls);
/**
 * THE HERO A HALL LAYS (spec law 7): law 6's hall `spec` (laid on try `at`) - or, where a hero stands, the hall laid again on
 * that try with it. Each of its code-built fragments (a passage, a chamber, a shaft; never a set piece) with a hero of its
 * kit and class registered is a slot; the hall's own hero die tosses a fair coin a slot, in their order, and the first heads
 * whose hero fits (egHeroStatic at its slot, heroFit over the hall laid, THE TIMED SOLVER over its whole course) is laid. Of a
 * slot's heroes, the coin's own draw picks (heads below one half: the hero at u x 2 x their count). At most one a hall.
 * @param {number} seed @param {number} h @param {number} geo @param {number} law @param {number} at @param {any} spec
 */
function heroHall(seed, h, geo, law, at, spec, log = /** @type {any[]|null} */ (null), out = /** @type {{ at: number }|null} */ (null)) {
  const slots = [];
  // THE ASCENT: a room is no hero's slot, and a slot is its fragment's number among the hall's own (its rooms aside - a try's
  // rooms are its plan's, the course's fragments its law's)
  let k = 0;
  spec.frags.forEach((f, n) => { if (f.room) return; if (!EG_SET_PIECES.includes(f.play)) { const c = egHeroCands(f.kit, f.cls); if (c.length) slots.push({ n, k, c }); } k++; });
  if (!slots.length) return spec;
  const hr = sdRng(egSeed(seed, HERO_SALT + h));
  for (const { n, k: slot, c } of slots) {
    const u = hr(), rec = c[Math.min(c.length - 1, Math.floor(u * 2 * c.length))];
    if (u >= 0.5) { log?.push({ n, kit: spec.frags[n].kit, cls: spec.frags[n].cls, u, id: null, why: 'tails' }); continue; }
    const proof = law >= EG_ASCENT_LAW ? egAscentProof : egSpanProof;   // THE ASCENT: its courses proven where they stand
    // THE ASCENT: a hero changes its course's shape, and the way to it is planned again - on its own try and the next
    // EG_ASCENT_HERO_TRIES - 1 (the hall's own law: the first whose plan stands about the hero, its fragment the same kit)
    let why = '';
    for (let t = at; t < at + (law >= EG_ASCENT_LAW ? EG_ASCENT_HERO_TRIES : 1); t++) {
      const fit = { ok: false, why: '' };
      const H = layHall(seed, h, geo, t, law, { n: slot, rec }, fit);
      why = !H ? 'no way laid about it' : !fit.ok ? fit.why || 'not laid' : !proof(H).ok ? `THE TIMED SOLVER refuses the hall: ${proof(H).why.join('; ')}` : JSON.stringify(H).length > EG_SPEC_SAID_MAX ? `its spec runs past ${EG_SPEC_SAID_MAX} characters` : '';
      if (!why) { if (out) out.at = t; log?.push({ n, kit: spec.frags[n].kit, cls: spec.frags[n].cls, u, id: rec.id, why }); return H; }
    }
    log?.push({ n, kit: spec.frags[n].kit, cls: spec.frags[n].cls, u, id: rec.id, why });
  }
  return spec;
}
/** THE ASCENT (spec law 9): how many tries a hero's hall is planned on - its hall's own and the next (heroHall). */
export const EG_ASCENT_HERO_TRIES = 4;
/**
 * EVERY SLOT OF HALL `h` AND ITS COIN (spec law 7), as heroHall tosses them - `[{ n, kit, cls, u, id, why }]`: each slot's
 * fragment, the hero die's draw, the hero the coin picked (null on tails) and why it did not stand ('' - it stands; 'tails').
 * Pure (it lays the hall again); for a test, a tool, and a hero's author asking where theirs would stand.
 * @param {number} seed @param {number} h @param {number} [geo] @param {number} [law]
 */
export function egHeroTrials(seed, h, geo = 0, law = EG_SPEC) {
  let spec, at = 0;
  if (law >= EG_ASCENT_LAW) ({ spec, at } = ascentLaid(seed >>> 0, h, geo | 0, law));
  else {
    spec = layHall(seed >>> 0, h, geo | 0, 0, law);
    while (spec.steps.length && !egSpanProof(spec).ok && at < EG_RELAY_MAX) spec = layHall(seed >>> 0, h, geo | 0, ++at, law);
    if (spec.steps.length && !egSpanProof(spec).ok) spec = layHall(seed >>> 0, h, geo | 0, at = EG_RELAY_MAX + 1, law);
  }
  const log = [];
  if (law >= EG_HERO_LAW) heroHall(seed >>> 0, h, geo | 0, law, at, spec, log);
  return log;
}
/** A hero record's course's exit (section 11.5's sockets): the lowest of its exits the course's line passes through (its
 *  middle within half its width of x 0) at least EG_HERO_WAY_CM wide - the nearest the line of those, then the first - or -1. */
export function egHeroExit(rec) {
  let k = -1;
  (rec?.sockets?.out ?? []).forEach((o, i) => {
    if (!(o.w >= EG_HERO_WAY_CM) || Math.abs(o.x) * 2 > o.w) return;
    const b = rec.sockets.out[k];
    if (k < 0 || o.y < b.y || (o.y === b.y && Math.abs(o.x) < Math.abs(b.x))) k = i;
  });
  return k;
}
/** The lowest a passage's course exit may stand under its mouth (cm, <= 0): its kit's own code-built passage's descent (the
 *  Mist Stair's flights; every other kit leaves at its mouth's height) - read off the kit's planner. */
const kitDescent = (kit) => Math.min(0, egFragPassage(kit, () => 0).yB);
/** The lowest a shaft's course exit may stand under its mouth (cm): the code-built shaft's deepest - four flights and the
 *  deepest Drop. */
export const EG_HERO_SHAFT_CM = 4 * EG_SHAFT_FLIGHT_CM + EG_SHAFT_DROP_CM[1];
/** THE LANDING ROOM (cm - EG-HERO-LAY at the merge of the ten heroes): the least a hero's inner course may leave between where
 *  THE SPAN BUILD's running jump, pressed at a launch edge, lands and the far edge of the piece it lands on. The motor jumps
 *  again only after a body has stood GROUNDED_JUMP_GATE_S (player/motor.js), so the slowest build lands, runs on and leaps
 *  again only with room before the edge. Measured by the real motor (tools/egSpanSolve.mjs's pilot, 200 seeds): a landing
 *  32 cm short of the edge left it standing on the lip in 5 of 37 crossings, 42 cm in none. Every code-built landing a piece
 *  launches onto leaves at least 0.44 m (test/net/eliteGates/eghero_lay.test.js measures it over the law pin's halls); only a landing
 *  launched from still ground, after its run-up, leaves less (0.24 m). A piece that moves along the course, and a step down
 *  run off rather than leapt, are judged by the solver alone. */
export const EG_HERO_LAND_ROOM_CM = 40;
/** AUDIT EG V - LAW 8 (lane5 #17): the pieces THE LANDING ROOM excepts - those that move ALONG the course (a Rail, a Drum: a
 *  landing's room along it is the piece's motion's to give); a Drift swings across it and a Pendulum's step stands still, so
 *  each is judged as still ground. The laws before excepted a Drift and a Pendulum too. */
export const EG_HERO_ALONG = Object.freeze(['rail', 'drum']);
/**
 * A HERO'S INNER COURSE LANDED (spec law 7, THE LANDING ROOM): why record `rec`'s course leaves THE SPAN BUILD no room to land
 * and leap again - '' when every landing leaves EG_HERO_LAND_ROOM_CM. Each piece in order is landed on from the one before
 * (the first from the floor at its gap's start, its height the highest floor holding that edge): where a running jump pressed
 * at the edge comes down (the span build's run and the jump's forward push over its time in the air, the height between) is
 * held against the piece's far edge - unless the piece moves along the course, or a step down of more than 30 cm is run off
 * onto it at the build's run (the sweep's pilot's own way down a stair). `law` the spec law (EG_HERO_ALONG from law 8).
 * @param {any} rec @param {number} [law]
 */
export function egHeroLanding(rec, law = EG_SPEC) {
  let prev = null;
  for (const [i, q] of (rec.course ?? []).entries()) {
    const lz = prev ? prev.z + prev.d / 2 : q.z - q.d / 2 - q.gap;
    const ay = prev ? prev.y : Math.max(0, ...rec.floors.filter((f) => egFragInPoly(f.poly, q.x, lz - 1)).map((f) => f.y)), dy = q.y - ay;
    prev = q;
    if (q.amp > 0 && (law >= EG_WAYS_LAW ? EG_HERO_ALONG : ['drift', 'rail', 'drum', 'pend']).includes(q.kind)) continue;
    const air = egJumpReach(dy / 100).air, land = lz + Math.floor(100 * (EG_SPAN_RUN_MPS + EG_JUMP_MPS * EG_JUMP_FWD) * air);
    const off = dy < -30 ? Math.floor((EG_SPAN_RUN_MPS * lawIsqrt(Math.floor((-dy * 20000) / EG_JUMP_G))) / 10) : -1;   // the fall's time in ms, the law's root
    if (off >= q.gap + 40 && off <= q.gap + q.d - 50) continue;   // run off it, as a stair is
    const room = q.z + q.d / 2 - land;
    if (room < EG_HERO_LAND_ROOM_CM) return `its course's piece ${i} (${q.kind}) leaves the span build's landing ${room} cm before its far edge, under ${EG_HERO_LAND_ROOM_CM}`;
  }
  return '';
}
/**
 * A HERO'S FIT AT ITS SLOT (spec law 7, before it is laid): why record `rec` cannot stand in a slot of its class - '' when it
 * can. Its box runs from its mouth along +Z; its mouth is at least EG_HERO_WAY_CM wide with a floor at its foot; its course
 * leaves by an exit on the course's line (egHeroExit) with a floor under it, at the height the slot keeps: a chamber's at its
 * mouth's, a passage's at its mouth's or as far under it as its kit's own passage goes down (never on the Low Road, whose
 * bridge to the end plate stands at the fork's low height), a shaft's under its mouth, no deeper than EG_HERO_SHAFT_CM.
 * A chamber's middle (half its length along the course, on the line) stands on a fight floor at its mouth's height. Its inner
 * course leaves the span build room to land and leap again (egHeroLanding, EG_HERO_LAND_ROOM_CM).
 * @param {any} rec @param {boolean} [low] on the Low Road @param {number} [law] the spec law (THE LANDING ROOM's - egHeroLanding)
 */
export function egHeroStatic(rec, low = false, law = EG_SPEC) {
  const S = rec.sockets, B = rec.box;
  if (!(B[5] > 0) || B[2] < -EG_FRAG_SOCKET_TOL_CM) return 'its box does not run along +Z from its mouth';
  if (!(S.in.w >= EG_HERO_WAY_CM) || !rec.floors.some((f) => f.y === 0 && egFragInPoly(f.poly, 0, 0))) return `its mouth is under ${EG_HERO_WAY_CM} cm wide or has no floor at its foot`;
  const k = egHeroExit(rec);
  if (k < 0) return 'no exit on the course\'s line';
  const o = S.out[k];
  const [lo, hi] = rec.class === 'shaft' ? [-EG_HERO_SHAFT_CM, -1] : rec.class === 'chamber' || low ? [0, 0] : [kitDescent(rec.kit), 0];
  if (o.y < lo || o.y > hi) return `its course's exit stands at ${o.y} cm, outside ${lo} to ${hi}`;
  if (!rec.floors.some((f) => f.y === o.y && egFragInPoly(f.poly, o.x, o.z))) return 'no floor reaches its course\'s exit';
  if (rec.class === 'chamber' && !egHeroCourtOf(rec)) return 'no fight floor at its mouth\'s height holds its middle';
  return egHeroLanding(rec, law);
}
/** The squared distance (cm, floored) from (px, pz) to the segment a-b - the law's integers. */
function segD2(px, pz, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez, ax = px - a[0], az = pz - a[1], t = ax * ex + az * ez;
  if (t <= 0 || L2 === 0) return ax * ax + az * az;
  if (t >= L2) { const bx = px - b[0], bz = pz - b[1]; return bx * bx + bz * bz; }
  return Math.max(0, Math.floor(ax * ax + az * az - (t * t) / L2));
}
/** A HERO CHAMBER'S COURT (spec law 7): its middle `cz` (half its length along the course, on the line) and `R` - how far the
 *  fight floor at its mouth's height that holds the middle reaches from it before its first edge (cm) - the court the hall's
 *  trial is laid on in place of the code-built disc; null where none holds the middle, or it reaches no further than a
 *  rift's 3 m inset. */
export function egHeroCourtOf(rec) {
  const cz = Math.floor(rec.box[5] / 2), main = rec.floors.find((f) => f.fight && f.y === 0 && egFragInPoly(f.poly, 0, cz));
  if (!main) return null;
  let d2 = Infinity;
  for (let i = 0; i < main.poly.length; i++) d2 = Math.min(d2, segD2(0, cz, main.poly[i], main.poly[(i + 1) % main.poly.length]));
  const R = lawIsqrt(d2);
  return R > 300 ? { cz, R } : null;
}
/** Two boxes ([x0, y0, z0, x1, y1, z1], cm) apart (egFragApart) - or JOINED: one meeting the other's mouth or exit face, their
 *  overlap along the course no more than the socket's tolerance (a code-built passage after a hero shaft, a Drop's landing
 *  before a hero passage). */
const apartOrJoined = (a, b) => egFragApart(a, b) || (Math.min(a[5], b[5]) - Math.max(a[2], b[2]) <= EG_FRAG_SOCKET_TOL_CM && (Math.abs(b[5] - a[2]) <= EG_FRAG_SOCKET_TOL_CM || Math.abs(b[2] - a[5]) <= EG_FRAG_SOCKET_TOL_CM));

function layHall(seed, h, geo, attempt = 0, law = EG_SPEC, hero = /** @type {{ n: number, rec: any }|null} */ (null), fit = /** @type {{ ok: boolean, why: string }|null} */ (null)) {
  const c = egCircleOfHall(h), slot = egSlotOfHall(h), plan = egCirclePlan(seed, c, law)[slot - 1];
  const kind = plan.kind, variant = plan.variant, twist = plan.twist, bnd = egBandOfHall(h);
  const L9 = law >= EG_ASCENT_LAW;   // THE ASCENT: a hall a way through the torn academy
  const r0 = sdRng(egSeed(seed, HALL_SALT + h + attempt * RELAY_SALT)), r = L9 ? egTape(r0) : r0;   // THE ASCENT: the hall's die a tape (a course measured, then laid with the same draws)
  const plain = attempt > EG_RELAY_MAX + (law >= EG_BROKEN_LAW ? EG_BROKEN_TRIES : 0);   // the last resort: the band's first two pieces alone (THE BROKEN WAY: past the plan's own tries)
  const gale = geo % 3, crumbling = Math.floor(geo / 3) % 3;
  const L6 = law >= EG_DECREE_LAW;   // AUDIT EG III: the span decrees on every span, a section a rank
  const L8 = law >= EG_WAYS_LAW;   // AUDIT EG V: THE WAYS LAID
  let X = 0;   // THE ASCENT: each course's line (0 - the plate's - for every law before)
  /** the hall's parts in cm, said in metres at the end */
  const P = { discs: [], bands: [], lanes: [], steps: [], islands: [], caves: [], rifts: [], vents: [], fl: [], spots: {}, deco: [], gate: null, foe: null, arrive: null, end: null, ring: null, walk: null, waystones: [], chamber: 0,
    // EG-FULL LAYER THREE: the fragments' law halves (net/eliteGates/egFragLaw.js) - each fragment's record, its hazards on the shared
    // clock, its ramps (support, never fight floors), its engines, alcoves, vignettes and lights; the Collapsing Tube; THE FORK
    frags: [], hazards: [], ramps: [], engines: [], alcoves: [], vignettes: [], lights: [], tube: null, fork: null,
    // EG-HERO-LAY: the hero laid (at most one - its record and where its origin stands, said in `heroes` at the end)
    heroes: /** @type {Array<{ rec: any, f: number, x: number, y: number, z: number, exit: number, road: number }>} */ ([]) };
  const disc = (x, z, rad, role, y = 0) => { const d = { x, y, z, r: rad, role }; P.discs.push(d); return d; };
  const band = (z0, z1, half, role, y = 0, x = X) => { const b = { x, y, z0, z1, halfW: half, role }; P.bands.push(b); return b; };
  const lane = (ax, az, bx, bz, half, role, y = 0) => { const l = { ax, az, bx, bz, hw: half, role, y }; P.lanes.push(l); return l; };
  const flD = (x, z, rad, y = 0) => P.fl.push({ t: 'd', x, z, r: rad, y });
  const flL = (ax, az, bx, bz, half, y = 0) => P.fl.push({ t: 'l', ax, az, bx, bz, hw: half, y });
  // EG-ZQ (section 9): A SPOT'S HEIGHT IS IN CENTIMETRES. Where a spot carries a `y` (a fragment's anchors, a balcony, the
  // Low Road's niche) it is the law's own centimetres, and the spec says it so: its `x` and `z` are said in metres below and
  // its `y` is not (Seed 1's Hall 22: Lurker spots at y -760 over floors at -7.6 m). Nothing reads it - every body's feet are
  // the fight ground's (net/eliteGates/egWalkGraph.js egFeetAt) - and saying it in metres is a spec law of its own (EG_SPEC, section 22),
  // the change of the first slice that reads it; until then a reader divides by 100. THE ASCENT (spec law 9, section 2): every
  // spot says its height - the floor's it stands on (the hall's height where it is laid, unless it names its own) - so a reader
  // judging by the feet finds it on its own storey (net/eliteGates/egWalkGraph.js egByHeight), never the lowest floor under it
  const spot = (role, x, z, extra = {}) => { (P.spots[role] ??= []).push(L9 ? { x, z, y, ...extra } : { x, z, ...extra }); };
  let edge = 0, y = 0, road = 0, kitNow = '', xRoad = 0;
  const pieces = plain ? EG_BAND_PIECES[bnd].slice(0, 2) : EG_BAND_PIECES[bnd];
  // EG6a - THE SPAN GENERATOR (net/eliteGates/egSpanLaw.js egSpanOf): every course of this hall, one a road, drawn off this hall's die
  // and laid by courseOf. The hall stands about its edge and tells it where the hall stands before each piece it asks for.
  const S = egSpanOf(seed, h, bnd, { r, sizes: EG_STEP, start: { x: X, y: 0, z: 0, r: PLATE_R }, checkR: ISLE_R, floors: L9, broken: law >= EG_BROKEN_LAW });
  /** a step laid `gap` past the edge (its unused fields nought, one shape for every step - the Steps' law): its place */
  const step = (k, gap, o = {}) => { S.at(edge, y); const at = S.step(k, gap, { ...o, x: X + (o.x ?? xRoad), kit: kitNow }); edge = S.edge; stepEdge = edge; return at; };
  const gap = () => S.gap();
  // THE ASCENT (spec law 9): an island a gap past still ground (a passage's end, a court's, the way's port - no step's leap
  // before it, which THE TIMED SOLVER would time) is joined to it by a bridge: THE ROUTE walks from ground to ground (net/
  // egRouteProof.js - a walk is a walk), and the real motor walks it (tools/egSpanSolve.mjs's sweep)
  const island = (g = gap(), x = X) => { if (L9 && edge !== stepEdge) lane(x, edge - 50, x, edge + g + 50, BRIDGE_HALF, 'bridge', y); S.at(edge, y); const z = S.check(g); P.islands.push({ x, y, z, r: ISLE_R, road }); disc(x, z, ISLE_R, 'island', y); edge = S.edge; isleEdge = edge; return z; };
  /** THE ASCENT: the edge the last step left (an island there is a leap's landing, its gap timed) */
  let stepEdge = NaN;
  /** LAW 6: the edge the last island left (a Gust section begun there stands on it - never a second island beside it) */
  let isleEdge = -1;
  /** a run of `n` steps of one piece (section 10.3 - every piece at the Steps' own timing, at every depth) */
  const run = (k, n) => { S.at(edge, y); S.run(k, n, X + xRoad, kitNow); edge = S.edge; y = S.y; if (n > 0) stepEdge = edge; };
  /** A fragment's law half laid into the hall (net/eliteGates/egFragLaw.js's plan, in its own frame about (x0, z0, y0)): its hazards,
   *  anchors, alcoves, vignettes and lights, every point moved into the hall's frame. The far floor's (`zB` on) stand at
   *  `yB`. */
  const lay = (Q, x0, z0, y0) => {
    const yAt = (zr) => y0 + (Q.cls === 'passage' && zr >= (Q.zB ?? Infinity) ? Q.yB ?? 0 : 0);
    const at = (q) => [x0 + q[0], z0 + q[1]];
    for (const h of Q.hazards) {
      const z1 = h.sh ? h.sh[1] : h.spots ? h.spots[0][1] : h.lanes ? h.lanes[0][1] : h.path ? h.path[1] : 0;
      const o = { kind: h.kind, i: P.hazards.length, x: x0, z: z0, y: (h.kind === 'mist' ? y0 : yAt(z1)) + (h.kind === 'mist' ? h.y : (h.y ?? 0)), period: h.period ?? 0, phase: h.phase ?? 0, w: h.w ?? 0, r: h.r ?? 0, ring: h.ring ?? 0, sh: null, spots: null, lanes: null, path: null };
      if (h.sh) o.sh = [x0 + h.sh[0], z0 + h.sh[1], x0 + h.sh[2], z0 + h.sh[3]];
      if (h.spots) o.spots = h.spots.map(at);
      if (h.lanes) o.lanes = h.lanes.map((q) => [x0 + q[0], z0 + q[1], x0 + q[2], z0 + q[3]]);
      if (h.path) o.path = [x0 + h.path[0], z0 + h.path[1], h.path[2], h.path[3]];
      P.hazards.push(o);
    }
    for (const [k, list] of Object.entries(Q.anchors ?? {})) for (const q of list) { const [ax, az] = at(q); spot(k, ax, az, { y: yAt(q[1]), road, f: P.frags.length - 1 }); }   // `f` its fragment (P.frags)
    for (const q of Q.alcoves ?? []) P.alcoves.push({ i: P.alcoves.length, x: x0 + q.x, z: z0 + q.z, y: y0 + (q.y ?? 0), seal: q.seal, side: q.side ?? 1, holds: q.holds });
    for (const q of Q.vignettes ?? []) P.vignettes.push({ t: q.t, x: x0 + q.x, z: z0 + q.z, y: y0 + (q.y ?? 0), yaw: q.yaw ?? 0 });
    for (const q of Q.lights ?? []) P.lights.push([x0 + q[0], y0 + q[1], z0 + q[2], q[3]]);
  };
  // ── EG-HERO-LAY - SPEC LAW 7: a hero fragment laid at its slot (heroHall's `hero`: the slot's number among the hall's
  // fragments and the record) ─────────────────────────────────────────────────────────────────────────────────────────
  /** the edge a hero's exit left (the next bridge begins there, never half a metre back over its floor - a code-built
   *  fragment's own lap) */
  let heroEnd = -1;
  const back = () => (edge === heroEnd ? 0 : 50);
  /** a hero chamber's court, once its slot is reached: its record, its mouth's z, its middle, its reach, its length */
  let hc = /** @type {{ rec: any, z0: number, zc: number, R: number, L: number, laid: number }|null} */ (null);
  /** why the hero was refused (heroHall's fit) */
  const refuse = (why) => { if (fit && !fit.why) fit.why = why; return null; };
  /** THE HERO AT THIS SLOT: heroHall's record when this is its slot (the hall's next fragment is its number) and it fits the
   *  slot (egHeroStatic - `low` on the Low Road), else null - a refused hero leaves the code-built fragment law 6 lays. */
  const heroAt = (cls, low = false, kit = '') => {
    // THE ASCENT: its number among the hall's own fragments (a room is none), a room laid before it no hero, and its kit the
    // slot's (a hero planned on a later try - heroHall)
    if (!hero || hero.rec.class !== cls || P.frags.filter((f) => !f.room).length !== hero.n || P.heroes.some((q) => !q.rec.room) || (kit && hero.rec.kit !== kit)) return null;
    const why = egHeroStatic(hero.rec, low, law);
    return why ? refuse(why) : hero.rec;
  };
  /** A HERO CHAMBER'S COURT at the court's slot, its mouth at `z0`: the court laid at the hero's own size (egHeroCourtOf) - or
   *  null (no hero here; a Proving Walk's Reliquary Vault, whose side span leaves the court through its wall). */
  const heroCourtAt = (z0) => {
    const rec = heroAt('chamber');
    if (!rec) return null;
    if (kind === 'proving' && twist === 'vault') return refuse('a Reliquary Vault\'s side span leaves its court');
    const C = /** @type {{ cz: number, R: number }} */ (egHeroCourtOf(rec));
    hc = { rec, z0, zc: z0 + C.cz, R: C.R, L: rec.box[5], laid: 0 };
    return hc;
  };
  /** A hero's stair (its record's ramp - a slope's corners, each at its height) as the hall's ramp: from the middle of its
   *  low corners to the middle of its high ones, half its widest low or high side across (cm, laid at the origin). */
  const heroRamp = (q, x0, y0, z0) => {
    const lo = q.poly.filter((p) => p[1] === q.y0), hi = q.poly.filter((p) => p[1] === q.y1);
    const mid = (ps) => [Math.round(ps.reduce((s, p) => s + p[0], 0) / ps.length), Math.round(ps.reduce((s, p) => s + p[2], 0) / ps.length)];
    let w2 = 0;
    for (const s of [lo, hi]) for (const p of s) for (const o of s) w2 = Math.max(w2, (p[0] - o[0]) * (p[0] - o[0]) + (p[2] - o[2]) * (p[2] - o[2]));
    const a = mid(lo), b = mid(hi);
    return { ax: x0 + a[0], az: z0 + a[1], bx: x0 + b[0], bz: z0 + b[1], hw: Math.floor(lawIsqrt(w2) / 2), y0: y0 + q.y0, y1: y0 + q.y1 };
  };
  /**
   * A HERO LAID: record `rec`'s law half at its origin (x0, y0, z0) (cm - the foot of its mouth; `xOff` its offset across the
   * hall, the Low Road's): its fight floors into the fight floor as polygons, its stairs into the ramps, its hazards, its
   * legion's places (an engine anchor its kit's engine), its alcoves and lights; its inner course through the span generator
   * at its authored places and sizes; its fragment; and the course on from its exit, at the exit's height.
   */
  const heroLay = (rec, x0, z0, y0, xOff) => {
    const k = egHeroExit(rec), o = rec.sockets.out[k], L = rec.box[5];
    const at = (q) => [x0 + q[0], z0 + q[1]];
    P.frags.push({ kit: rec.kit, cls: rec.class, name: EG_FRAGS[rec.kit].name, x: x0, y: y0, z0, z1: z0 + L, play: rec.play.join(','), reverb: rec.reverb, road, hero: rec.id });
    const f = P.frags.length - 1;
    P.heroes.push({ rec, f, x: x0, y: y0, z: z0, exit: k, road });
    for (const g of rec.floors) if (g.fight) P.fl.push({ t: 'p', poly: g.poly.map(at), y: y0 + g.y });
    for (const q of rec.ramps) P.ramps.push(heroRamp(q, x0, y0, z0));
    for (const hz of rec.hazards) {
      P.hazards.push({ kind: hz.kind, i: P.hazards.length, x: x0 + hz.x, z: z0 + hz.z, y: y0 + hz.y, period: hz.period, phase: hz.phase, w: hz.w, r: hz.r, ring: hz.ring,
        sh: hz.sh ? [...at([hz.sh[0], hz.sh[1]]), ...at([hz.sh[2], hz.sh[3]])] : null, spots: hz.spots ? hz.spots.map(at) : null,
        lanes: hz.lanes ? hz.lanes.map((q) => [...at([q[0], q[1]]), ...at([q[2], q[3]])]) : null, path: hz.path ? [...at([hz.path[0], hz.path[1]]), hz.path[2], hz.path[3]] : null });
    }
    const engine = EG_FRAGS[rec.kit].engine;
    for (const [kk, list] of Object.entries(rec.anchors)) for (const q of list) {
      if (kk === 'engine') { if (engine) P.engines.push({ i: P.engines.length, kind: engine, x: x0 + q[0], z: z0 + q[2], y: y0 + q[1] }); continue; }
      spot(kk, x0 + q[0], z0 + q[2], { y: y0 + q[1], road, f });
    }
    for (const a of rec.alcoves) P.alcoves.push({ i: P.alcoves.length, x: x0 + a.x, z: z0 + a.z, y: y0 + a.y, seal: a.seal, side: a.side, holds: a.holds });
    for (const l of rec.lights) P.lights.push([x0 + l[0], y0 + l[1], z0 + l[2], l[3]]);
    kitNow = rec.kit;
    for (const q of rec.course) {
      edge = z0 + q.z - q.d / 2 - q.gap; y = y0 + q.y;
      step(q.kind, q.gap, { x: xOff + q.x, amp: q.amp, period: q.period, phase: q.phase, beat: q.kind === 'moon' ? z0 + q.beat : q.beat, size: { w: q.w, d: q.d } });
    }
    kitNow = '';
    edge = heroEnd = z0 + L; y = y0 + o.y;
  };
  /** THE ASCENT (spec law 9): A ROOM LAID - placed room `R` (net/eliteGates/egRoomLaw.js egRoomTurned's, its way in at (x0, y0, z0), its way
   *  out socket `outI`) as a hero: its record (egRoomHero) into the hall's heroes and fragments, its stairs into the ramps, its
   *  alcoves and lights; no inner course, and its floors no fight floor (the kind's trial stands on the kind's own). Answers its
   *  hero's number. */
  const roomLay = (R, outI, x0, y0, z0, id) => {
    const rec = egRoomHero(R, outI, [], id), B = rec.box;
    P.frags.push({ kit: rec.kit, cls: rec.class, name: EG_ROOM_NAMES[R.k], x: x0, y: y0, z0: z0 + B[2], z1: z0 + B[5], play: '', reverb: rec.reverb, road: 0, hero: id, room: R.k });
    P.heroes.push({ rec, f: P.frags.length - 1, x: x0, y: y0, z: z0, exit: 0, road: 0 });
    for (const q of rec.ramps) P.ramps.push(heroRamp(q, x0, y0, z0));
    for (const a of rec.alcoves) P.alcoves.push({ i: P.alcoves.length, x: x0 + a.x, z: z0 + a.z, y: y0 + a.y, seal: a.seal, side: a.side, holds: a.holds });
    for (const l of rec.lights) P.lights.push([x0 + l[0], y0 + l[1], z0 + l[2], l[3]]);
    return P.heroes.length - 1;
  };
  /** A hero chamber's rifts (section 8.1, "its rifts set in the walls"): its record's rift anchors laid, the first `n`, where it
   *  names `n` or more (`a` - its own place, never held to its fight floor) - else null, and the hall law sets its own. */
  const heroRifts = (n) => {
    const H = hc?.laid ? P.heroes.find((q) => !q.rec.room) : null, list = H?.rec.anchors.rift ?? [];   // THE ASCENT: the hero, never a room laid before it
    return H && list.length >= n ? list.slice(0, n).map((q) => ({ x: H.x + q[0], z: H.z + q[2], a: 1, ...(L9 ? { y: H.y + q[1] } : {}) })) : null;   // THE ASCENT: its height
  };
  /** The band's passage kit for this hall (the hall's die - the band's library, section 11.2). */
  const passageKit = () => { const L = EG_PASSAGE_KITS[bnd]; return L[between(r, 0, L.length - 1)]; };
  /** A FRAGMENT'S PASSAGE (section 11): a tunnel of its kit over the course (net/eliteGates/egFragLaw.js egFragPassage - the
   *  Oblivion Caverns' lava tube, the Fallen Stacks, the Broken Colonnade, the Ossuary, the Mist Stair, the Gloam Thicket,
   *  the Forge Gut, the deep Caverns), its floor broken by a chasm crossed on its inner course; its floors its landings
   *  (fight floors - section 11.1), its hazards on the shared clock. `x` its offset across the hall (the Low Road's). */
  const cave = (kit = passageKit(), x = 0) => {
    const H = heroAt('passage', x !== 0, kit);   // EG-HERO-LAY: the hero in its place (on the Low Road at the mouth's height)
    if (H) { heroLay(H, X + x, edge, y, x); return; }
    const Q = egFragPassage(kit, r, { c, deep: bnd, law });
    const X0 = X + x, z0 = edge, zA = z0 + Q.zA, zB = z0 + Q.zB, z1 = z0 + Q.len, y0 = y, role = Q.open ? 'colonnade' : 'cave';
    band(z0, zA, Q.halfW, role, y, X0); flL(X0, z0, X0, zA, Q.halfW, y);
    edge = zA; kitNow = kit;
    for (const it of Q.course) { y += it.dy ?? 0; step(it.k, it.gap, { x: x + (it.x ?? 0), amp: it.amp, period: it.period, phase: it.phase, beat: it.beat != null ? z0 + it.beat : 0 }); }
    kitNow = '';
    band(zB, z1, Q.halfW, role, y, X0); flL(X0, zB, X0, z1, Q.halfW, y);
    P.caves.push({ x: X0, y: y0, yB: y, z0, z1, zA, zB, halfW: Q.halfW, height: Q.height, kit, open: Q.open, road });
    P.frags.push({ kit, cls: 'passage', name: Q.name, x: X0, y: y0, z0, z1, play: '', reverb: Q.reverb, road });
    lay(Q, X0, z0, y0);
    edge = z1;
  };
  /** EG-ZC - A SHAFT (sections 11.1-11.2): the band's way down (net/eliteGates/egFragLaw.js egFragShaft) - its rim and its foot still
   *  ground that is no fight floor (blows land on none of it), its flights, its Drop and the Slag Chute's crust its course;
   *  its walls the passages' (world/eliteGates/egHall.js - running down past its foot), marked `shaft`. */
  const shaft = (kit = EG_SHAFT_KITS[bnd][between(r, 0, EG_SHAFT_KITS[bnd].length - 1)]) => {
    const H = heroAt('shaft', false, kit);   // EG-HERO-LAY: the hero in its place

    if (H) { heroLay(H, X, edge, y, 0); return; }
    const Q = egFragShaft(kit, r);
    const z0 = edge, zA = z0 + Q.zA, zB = z0 + Q.zB, z1 = z0 + Q.len, y0 = y;
    band(z0, zA, Q.halfW, 'cave', y);
    edge = zA; kitNow = kit;
    for (const it of Q.course) { y += it.dy ?? 0; step(it.k, it.gap, { x: it.x ?? 0, amp: it.amp, period: it.period, phase: it.phase, beat: it.beat != null ? z0 + it.beat : 0 }); }
    kitNow = '';
    band(zB, z1, Q.halfW, 'cave', y);
    P.caves.push({ x: X, y: y0, yB: y, z0, z1, zA, zB, halfW: Q.halfW, height: Q.height, kit, open: 0, road, shaft: 1 });
    P.frags.push({ kit, cls: 'shaft', name: Q.name, x: X, y: y0, z0, z1, play: '', reverb: Q.reverb, road });
    lay(Q, X, z0, y0);
    edge = z1;
  };
  /** A SET PIECE (section 11.3): the band's own passage on the shared clock, proven by the solver like any other - the
   *  Collapsing Tube a passage whose floor falls behind the company; the Sinking Stair's, the Moon Path's and the Forge
   *  Line's flights laid as the course. */
  const setPiece = (kind, short = false) => {
    const Q = egSetPiece(kind, r, { short, law });
    if (kind === 'tube') {
      const z0 = edge, z1 = z0 + Q.len;
      band(z0, z1, Q.halfW, 'tube', y); flL(X, z0, X, z1, Q.halfW, y);
      P.caves.push({ x: X, y, yB: y, z0, z1, zA: z1, zB: z1, halfW: Q.halfW, height: Q.height, kit: 'caverns', open: 0, road, tube: 1 });
      P.frags.push({ kit: 'caverns', cls: 'passage', name: Q.name, x: X, y, z0, z1, play: 'tube', reverb: 'cave', road });
      P.tube = { x: X, y, z0, z1, halfW: Q.halfW, start: Q.tube.start, mps: Q.tube.mps };
      P.lights.push([X, y + 160, z0 + 300, 'lava'], [X, y + 160, Math.floor((z0 + z1) / 2), 'lava'], [X, y + 160, z1 - 300, 'lava']);
      edge = z1;
      return;
    }
    const z0 = edge, y0 = y;
    kitNow = kind;
    for (const it of Q.course) {
      y += it.dy ?? 0;
      const s0 = step(it.k, it.gap, { x: it.x ?? 0, amp: it.amp, period: it.period, phase: it.phase, beat: it.beatRel != null ? z0 + it.beatRel : 0 });
      // the Forge Line's hammers: one over each conveyor's middle, told 1.4 s (the place's own - judged wherever it lands)
      if (it.hammer) { P.hazards.push({ kind: 'hammerline', i: P.hazards.length, x: X, z: s0.z, y, period: 0, phase: between(r, 0, 49) * 100, w: 0, r: 300, ring: 0, sh: null, spots: [[s0.x, s0.z]], lanes: null, path: null }); }
    }
    kitNow = '';
    P.frags.push({ kit: kind, cls: 'passage', name: Q.name, x: X, y: y0, z0, z1: edge, play: kind, reverb: kind === 'forgeline' ? 'cave' : 'quarry', road });
    for (const h of Q.hazards) P.hazards.push({ kind: h.kind, i: P.hazards.length, x: X, z: z0, y: y0 + h.y, period: 0, phase: h.phase ?? 0, w: 0, r: 0, ring: 0, sh: null, spots: null, lanes: null, path: null });
  };
  /** A chamber (section 11.4): a fight floor in walls - its kit's play (a second floor on its stairs, a chokepoint arch,
   *  its channels surging, an engine) and its signature (net/eliteGates/egFragLaw.js egFragChamber); `kit` null for the trials' own
   *  walled floors (the Athenaeum's, the Scriptorium's: never a fragment). */
  const chamberAt = (zc, R, kit = /** @type {string|null} */ (EG_CHAMBER_KITS[bnd][between(r, 0, EG_CHAMBER_KITS[bnd].length - 1)])) => {
    P.chamber = 1;
    if (!kit) { P.deco.push({ t: 'wall', x: X, z: zc, r: R + 150, h: 900, y }); return; }
    // EG-HERO-LAY: the hero chamber its court was laid for (heroCourtAt) - and its kit's own call (the Clan Pit's Honour Horn)
    if (hc && !hc.laid) { hc.laid = 1; heroLay(hc.rec, X, hc.z0, y, 0); if (egFragChamber(kit, () => 0, R).horn) spot('horn', X, zc, { r: 600 }); return; }
    const Q = egFragChamber(kit, r, R, { law });   // AUDIT EG V - LAW 8: an Eclipse's balcony within its havens' reach
    const rim = Q.floors.length ? R + 900 : R + 150;
    P.deco.push({ t: 'wall', x: X, z: zc, r: rim, h: kit === 'clanpit' ? 600 : 900, y, kit });
    for (const f of Q.floors) { disc(X + f.x, zc + f.z, f.r, 'balcony', y + f.y); flD(X + f.x, zc + f.z, f.r, y + f.y); spot('balcony', X + f.x, zc + f.z, { y: y + f.y }); }
    for (const q of Q.ramps) P.ramps.push({ ax: X + q.ax, az: zc + q.az, bx: X + q.bx, bz: zc + q.bz, hw: q.hw, y0: y + q.y0, y1: y + q.y1 });
    if (Q.arch) P.deco.push({ t: 'arch', x: X, z: zc + Q.arch.z, w: Q.arch.w, h: Q.arch.h, r: R, y });
    if (Q.engine) P.engines.push({ i: P.engines.length, kind: Q.engine.kind, x: X + Q.engine.x, z: zc + Q.engine.z, y });
    if (Q.horn) spot('horn', X, zc, { r: 600 });
    P.frags.push({ kit, cls: 'chamber', name: Q.name, x: X, y, z0: zc - R, z1: zc + R, play: Q.play, reverb: Q.reverb, road });
    lay(Q, X, zc, y);
  };
  /** The court disc of a fight hall, at z centre `zc`, radius R. */
  const court = (R, role = 'court', H = /** @type {typeof hc} */ (null)) => {
    if (H) { band(edge - back(), H.z0, BRIDGE_HALF, 'bridge', y); edge = H.z0 + H.L; return H.zc; }   // EG-HERO-LAY: a hero chamber's - its own floors, the bridge to its mouth
    const zc = edge + 400 + R; band(edge - back(), edge + 450, BRIDGE_HALF, 'bridge', y); disc(X, zc, R, role, y); flD(X, zc, R, y); edge = zc + R; return zc;
  };
  const downToPlate = () => { if (y > 0) { island(); run('crumble', Math.max(2, Math.ceil(y / EG_STEP_DOWN_CM))); } };
  /** The span decrees' sections (section 14) - never dropped for room ("every span carries a gust"), at least two pieces
   *  each. AUDIT EG III - LAW 6 (EG_DECREE_LAW): each rank its own section - a Gust section on its island (on the road's own
   *  line, `xRoad` - the Low Road's too), a Crumble section laid straight on from the ground before it (no island of its own);
   *  rank I's of three pieces (room allowing, two at least), rank II's two of two each - the second Crumble section stands
   *  elsewhere on the road (crumbleTwo). */
  function decreeSections() {
    if (!L6) {
      if (gale > 0) { island(); run('gust', Math.max(2, Math.min(2 + gale, Math.floor((10200 - edge) / 560)))); }
      if (crumbling > 0) { if (crumbling < 2) island(); run('crumble', Math.max(2, Math.min(2 + crumbling, Math.floor((10200 - edge) / 560)))); }
      return;
    }
    for (let k = 0; k < gale; k++) { if (edge !== isleEdge) island(gap(), X + xRoad); run('gust', sectionOf(gale)); }
    if (crumbling > 0) run('crumble', sectionOf(crumbling));
  }
  /** LAW 6: a decree section's pieces at its decree's rank - rank I three (two at least, as the room past 102 m allows),
   *  rank II two (it lays two sections). */
  const sectionOf = (rank) => (rank >= 2 ? 2 : L9 ? 3 : Math.max(2, Math.min(3, Math.floor((10200 - edge) / 560))));   // THE ASCENT: a course's shape is its own, wherever it stands
  /** LAW 6: Crumbling Halls II's second Crumble section, laid straight on from the ground before it, apart from the first by
   *  the road between them (a run, an island, a passage). */
  const crumbleTwo = () => { if (L6 && crumbling >= 2) run('crumble', 2); };
  /**
   * THE FORK (section 11.4): the course forks at an island. THE HIGH ROAD stays over the void - harder (two sections, each
   * at the Steps' own timing), shorter, its cache of Reliquaries at its hardest point - and meets the end plate's height by
   * a Drop. THE LOW ROAD bridges across EG_LOW_X_CM and drops into the deep, through a passage of the band's kit, past its
   * Battlemage's niche (the one niche that heals - and a Memento niche), with fewer falls and more foes. Each road its own
   * course (the Steps' records carry their `road`), proven road by road; both end on the end plate, at the Low Road's height.
   * AUDIT EG V - LAW 8 (section 11.4's "how many", lane5 #11): from circle 3 the way to the fork runs through a passage of the
   * band's library in place of its run - one span in two, every span from circle 11 - so both roads pass through a fragment and
   * the hall keeps inside EG_HALL_LEN_MAX (never under three ranks of the span decrees, whose sections take its room); from circle 11, one span in two, the Low Road's still ground is a second passage where the hall
   * has room (EG_FORK_THIRD_CM); and a Reliquary Vault (section 8.7, lane3 #18) stands off the fork's island, across from the
   * Low Road's bridge, where either road's company reaches it.
   */
  function fork(two, extra) {
    const zStart = edge;   // THE BROKEN WAY: where its course began (its length held inside the hall's bound)
    const trunk = L8 && c >= 3 && extra <= (law >= EG_BROKEN_LAW ? 1 : 2) && (c >= 11 || r() < 0.5);   // (THE BROKEN WAY: under one rank of the decrees at most - two ranks' sections and a trunk ran a deep fork's course 141 m, past the bound)
    if (trunk) cave(); else run(two[0], extra > 0 ? 2 : between(r, 3, 4));
    const zc = island(trunk ? between(r, 200, 260) : gap()), yF = y, zF = edge;
    spot('fork', X, zc);
    if (L8 && twist === 'vault') { lane(X - ISLE_R + 50, zc, X - EG_FORK_VAULT_CM + 350, zc, BRIDGE_HALF, 'side', yF); disc(X - EG_FORK_VAULT_CM, zc, 350, 'vault', yF); spot('vault', X - EG_FORK_VAULT_CM, zc); }
    // THE HIGH ROAD (road 0)
    road = EG_ROAD.high;
    // (THE AUDIT - THE BROKEN WAY: no Drop of its own before its Drop - law 10 lays a Drop under its road's floor, and the
    // High Road's own Drop, laid at the fork's height less EG_FORK_DROP_CM, then fell 0-0.3 m, or rose)
    const hiNot = (k) => law >= EG_BROKEN_LAW && k === 'drop', hiPieces = law >= EG_BROKEN_LAW ? pieces.filter((k) => !hiNot(k)) : pieces;
    run(hiNot(two[1]) ? hiPieces.find((k) => k !== two[0]) ?? hiPieces[0] : two[1], 3);
    decreeSections();
    const zCache = island();
    spot('hcache', X, zCache);
    run(hiPieces[between(r, 0, hiPieces.length - 1)], extra > 0 ? 2 : 3);
    crumbleTwo();   // LAW 6: Crumbling Halls II's second section, before the High Road's Drop
    y = yF - EG_FORK_DROP_CM;
    step('drop', gap());
    const zHi = edge, yLow = y;
    // THE LOW ROAD (road 1): across, down its Drop, through its passage, past its niche - its own course, from its island
    road = EG_ROAD.low;
    const LX = X + EG_LOW_X_CM;
    S.road(road, { x: LX, y: yF, z: zc, r: ISLE_R });
    lane(X + ISLE_R - 50, zc, LX - ISLE_R + 50, zc, BRIDGE_HALF, 'bridge', yF);
    edge = zc - ISLE_R; y = yF;
    disc(LX, zc, ISLE_R, 'island', yF); P.islands.push({ x: LX, y: yF, z: zc, r: ISLE_R, road });
    edge = zc + ISLE_R;
    y = yLow;
    step('drop', gap(), { x: EG_LOW_X_CM });
    xRoad = EG_LOW_X_CM; crumbleTwo(); xRoad = 0;   // LAW 6: the Low Road's second Crumble section, off its Drop's landing
    cave(EG_PASSAGE_KITS[bnd][0], EG_LOW_X_CM);
    // the Battlemage's niche on a landing past the passage: heals 15% once a member, holds a shard each, takes a Memento
    const zN = edge + 400;
    band(edge, zN + 300, BRIDGE_HALF + 100, 'cave', y, LX); flL(LX, edge, LX, zN + 300, BRIDGE_HALF + 100, y);
    spot('lniche', LX + BRIDGE_HALF, zN, { y });
    spot('niche', LX + BRIDGE_HALF, zN);
    edge = zN + 300;
    for (const g of ['harrier', 'harrier']) spot('lowfoe', LX, zN - 600, { k: g });
    // fewer falls: still ground the rest of the way, then across to the end plate - LAW 6: the span decrees' sections in its
    // place (the Low Road is a span's road: it carries them as the High Road does). LAW 8: deeper, a second passage in the
    // still ground's place where the hall has room for it, its run and the plate
    const third = L8 && c >= 11 && r() < 0.5;
    xRoad = EG_LOW_X_CM;
    if (L6 && extra > 0) decreeSections();
    else if (third && (law >= EG_BROKEN_LAW ? edge - zStart + EG_FORK_THIRD_CM <= EG_FORK_COURSE_CM : L9 || edge + EG_FORK_THIRD_CM <= EG_HALL_LEN_MAX * 100)) cave(passageKit(), EG_LOW_X_CM);   // THE ASCENT: the plan holds the bound (THE BROKEN WAY: the fork's course its own)
    else run('still', 2);
    xRoad = 0;
    const zLo = edge;
    // the roads meet at the end plate (at the Low Road's height): a High Road that ends first is carried on by still
    // ground; a Low Road by its bridge across to the plate
    road = EG_ROAD.high;
    S.road(road);
    edge = zHi; y = yLow;
    // (THE BROKEN WAY - spec law 10: carried on by Beats, alternate a half cycle apart - the High Road's padding timed; law 9
    // padded half its High Roads with one to six still slabs)
    for (let b = 0; edge < zLo; b++) step(law >= EG_BROKEN_LAW ? 'beat' : 'still', EG_GAP_MIN_CM, law >= EG_BROKEN_LAW ? { beat: (b % 2) * EG_BEAT_HALF_MS } : {});
    const zPlate = edge + gap() + PLATE_R;
    lane(LX, zLo, X + PLATE_R - 100, zPlate, BRIDGE_HALF, 'bridge', yLow);
    P.fork = { x: X, z: zF, lowX: LX, y: yF, yLow, plate: zPlate, hi: 0, lo: 0 };
    edge = zPlate - PLATE_R;
  }
  P.arrive = disc(X, 0, PLATE_R, 'arrive');
  edge = PLATE_R;

  /** THE ASCENT (spec law 9): the plan's record (net/eliteGates/egAscent.js egAscentLay) */
  let asc = null;
  if (L9) {
    // THE HALL'S OWN LAYING handed to the route planner: its closures, its places, its die (a tape) and the planner's own die
    // (a die of its own - the plan never moves a course's draws), and how to take back a course laid only to be measured
    const keys = Object.keys(P), tape = /** @type {ReturnType<typeof egTape>} */ (r);
    const snap = () => {
      const o = { X, y, edge, road, kitNow, xRoad, isleEdge, heroEnd, hc: hc ? { ...hc } : null, S: S.save(), tape: tape.mark(), P: {} };
      for (const k of keys) o.P[k] = Array.isArray(P[k]) ? P[k].length : k === 'spots' ? Object.fromEntries(Object.entries(P.spots).map(([q, v]) => [q, v.length])) : P[k];
      return o;
    };
    const back = (o) => {
      ({ X, y, edge, road, kitNow, xRoad, isleEdge, heroEnd } = o); hc = o.hc; S.load(o.S); tape.rewind(o.tape);
      for (const k of keys) {
        if (Array.isArray(P[k])) P[k].length = o.P[k];
        else if (k === 'spots') { for (const q of Object.keys(P.spots)) { if (!(q in o.P.spots)) delete P.spots[q]; else P.spots[q].length = o.P.spots[q]; } }
        else P[k] = o.P[k];
      }
    };
    asc = egAscentLay({
      seed, h, c, slot, kind, variant, twist, bnd, plain, gale, crumbling, law, r, P, S, pieces, between, lean: law >= EG_BROKEN_LAW && attempt > EG_RELAY_MAX,
      rp: sdRng(egSeed(seed, ASCENT_SALT + h + attempt * RELAY_SALT)),
      get: () => ({ X, y, edge, road, xRoad }), set: (o) => { ({ X = X, y = y, edge = edge, road = road, xRoad = xRoad } = o); if (o.edge != null) stepEdge = NaN; }, snap, undo: back,
      disc, band, lane, flD, flL, spot, island, run, gap, step, cave, shaft, setPiece, chamberAt, court, layGround, decreeSections, crumbleTwo, fork, polar, heroCourtAt, heroRifts, roomLay,
      back: () => (edge === heroEnd ? 0 : 50), setPieceOf: (cc, k, b) => egSetPieceOf(cc, k, b, egTubeCircle(seed)), lordGround: () => EG_LORDS[egBossOf(seed, c)].ground,
      meet: () => { const z = edge + PLATE_R; disc(X, z, PLATE_R, 'landing', y); edge = z + PLATE_R; },
      rampart: () => rampartWalk(), BRIDGE_HALF, ISLE_R, FRAG_KITS: EG_FRAG_KITS, SINK_LOW: EG_SINK_LOW_CM,
      // THE BROKEN WAY (spec law 10): the pieces' tops, THE ENVELOPE's gaps and the Beat's half a broken bridge is laid by
      sizes: EG_STEP, gapMin: EG_GAP_MIN_CM, gapMax: EG_GAP_MAX_CM, beatHalf: EG_BEAT_HALF_MS,
    });
    if (!asc) return null;
    X = 0; road = 0; xRoad = 0;
  } else if (kind === 'yard') {
    const R0 = between(r, 22, 26) * 100, H = heroCourtAt(edge + 400), R = H ? H.R : R0;   // EG-HERO-LAY: a hero chamber's court at its own size
    const zc = court(R, 'court', H);
    if (c >= 2 && r() * 3 < 1) chamberAt(zc, R);
    const turn = between(r, -1, 1) * 5;
    if (variant === 'riftyard' || variant === 'wellmouth') {
      const ra = variant === 'riftyard' ? heroRifts(5) : null;   // EG-HERO-LAY: a hero's rifts set in its walls, where it names enough
      if (ra) P.rifts.push(...ra);
      else for (const deg of [60, 240, 120, 300, 90]) { const [x, z] = polar(X, zc, R - 300, deg + turn); P.rifts.push({ x, z }); }
      if (variant === 'wellmouth') for (let k = 0; k < 5; k++) for (const off of [-35, 0, 35]) { const [x, z] = polar(X, zc, R - 300, [60, 240, 120, 300, 90][k] + turn + off); spot('socket', x, z, { k }); }
    } else if (variant === 'wellspring') {
      const [gx, gz] = polar(X, zc, Math.floor(R / 3), 0);
      P.rifts.push({ x: gx, z: gz });
      for (const deg of [60, 180, 300]) { const [x, z] = polar(X, zc, R - 400, deg + turn); spot('anchor', x, z); }
    } else if (variant === 'muster') {
      for (const deg of [0, 120, 240]) { const [x, z] = polar(X, zc, R - 500, deg + turn); spot('rally', x, z); }
    } else if (variant === 'holdfast') {
      spot('relic', X, zc, { r: 600 });
      const ra = heroRifts(5);
      if (ra) P.rifts.push(...ra);
      else for (const deg of [60, 180, 300, 120, 240]) { const [x, z] = polar(X, zc, R - 300, deg + turn); P.rifts.push({ x, z }); }
    }
    band(edge - back(), edge + 600, BRIDGE_HALF, 'bridge', y);
    edge += 600;
  } else if (kind === 'span' || kind === 'brink') {
    const extra = gale + crumbling;
    const two = c <= 1 ? ['drift', 'beat'] : [pieces[between(r, 0, pieces.length - 1)], pieces[between(r, 0, pieces.length - 1)]];
    const set = plain ? null : egSetPieceOf(c, kind, bnd, egTubeCircle(seed));
    if (kind === 'brink') {
      // the hall tears loose from one realm into the next (section 8.9): the last band's passage, then the new band's set piece
      run('still', 2); island(); cave(EG_FRAG_KITS[Math.max(0, bnd - 1)]); island(between(r, 200, 260)); run(two[0], 3); island();
      if (set) setPiece(set); else cave(EG_FRAG_KITS[bnd]);
      if (L8 && set === 'sinking') y -= EG_SINK_LOW_CM;   // AUDIT EG V - LAW 8 (lane5 #5): the island where the last flight is leapt from
      island(between(r, 200, 260)); run(two[1], 2);
    } else if (c >= EG_FORK_FROM_C && !plain && !set) fork(two, extra);
    else {
      // the span decrees' sections take the room of the runs before them; a set piece takes most of the hall
      // LAW 6: under two ranks of the decrees their sections take more of the runs' room - two pieces a run, none with a set piece
      const runN = L6 && extra >= 2 ? 2 : 3;
      if (!(L6 && set && extra >= 2)) run(two[0], set ? 2 : extra > 0 ? runN : c <= 1 ? 6 : between(r, 4, 5));
      if (L6) { crumbleTwo(); island(); }   // LAW 6: Crumbling Halls II's second section, and no island taken for it
      else if (crumbling < 1 || set) island();
      if (set) { setPiece(set, extra > 0); island(between(r, 200, 260)); }
      else if (c <= 2 || r() < 0.5) { cave(); island(between(r, 200, 260)); }   // in circles 1 and 2 every span carries a passage (section 7)
      if (!(set && extra > 0)) run(two[1], set ? 2 : extra > 0 ? runN : c <= 1 ? 6 : between(r, 4, 5));
      decreeSections();
      if (c >= 3 && extra < 2 && edge < 9000 && !set) { island(); run(pieces[between(r, 0, pieces.length - 1)], between(r, 3, 4)); }
      if (twist === 'vault') { const [vx, vz] = [X + 900, edge - 300]; lane(X, edge - 300, vx, vz, BRIDGE_HALF, 'side', y); disc(vx, vz, 350, 'vault', y); spot('vault', vx, vz); }
    }
    if (!P.fork) { downToPlate(); edge += gap(); }   // THE FORK lays its own way onto the plate
  } else if (kind === 'proving') {
    // LAW 6: under the span decrees the first span runs short (four pieces, three under two decrees' ranks) and the second -
    // the one to the door - is the decrees' own, their sections in place of its run: the hall stays inside EG_HALL_LEN_MAX.
    // Crumbling Halls II's second Crumble section ends the first span, apart from the first by the court
    const extra = L6 ? gale + crumbling : 0;
    run(c <= 1 ? 'still' : pieces[between(r, 0, 1)], extra >= 2 ? 3 : extra > 0 ? 4 : between(r, 5, 7));
    if (extra > 0) crumbleTwo();
    const g = gap(), H = heroCourtAt(edge + g), R = H ? H.R : 1400, zc = H ? H.zc : edge + g + R;   // EG-HERO-LAY: a hero chamber's court at its own size
    if (!H) { disc(X, zc, R, 'court', y); flD(X, zc, R, y); }
    if (c >= 2 && r() * 3 < 1) chamberAt(zc, R);   // one proving court in three a chamber (section 11.4) - its play its own
    P.foe = { x: X, z: zc + 400 };
    for (const deg of [0, 120, 240]) { const [x, z] = polar(X, zc, 900, deg + 60); spot('standard', x, z); }
    edge = H ? H.z0 + H.L : zc + R;
    if (twist === 'vault') { const [vx, vz] = [X - 900, zc]; lane(X - R, zc, vx - 350, vz, BRIDGE_HALF, 'side', y); disc(vx - 700, vz, 350, 'vault', y); spot('vault', vx - 700, vz); }
    if (extra > 0) decreeSections();   // LAW 6: the second span the decrees' (section 14 - "a Proving Walk's")
    else run(c <= 1 ? 'drift' : pieces[between(r, 0, 2)], between(r, 4, 6));
    downToPlate();
    edge += gap();
  } else if (kind === 'rampart') {
    rampartWalk();
  } else if (kind === 'athenaeum') {
    run(c <= 1 ? 'still' : pieces[between(r, 0, 1)], between(r, 3, 5));
    const R = 1600, zc = edge + gap() + R;
    disc(X, zc, R, 'court', y); flD(X, zc, R, y);
    chamberAt(zc, R, null);   // never a fragment in the Athenaeum: the lock is the hall (section 11.4)
    spot('orrery', X, zc);
    for (const deg of [30, 90, 150, 210, 270, 330]) { const [x, z] = polar(X, zc, 1100, deg); spot('stone', x, z); }
    edge = zc + R;
    run('still', 2);
    edge += gap();
  } else if (kind === 'deepway') {
    // four fragments end to end (section 8.8): a passage, a chamber, a shaft down, a passage
    cave();
    const H = heroCourtAt(edge + 400), R = H ? H.R : 1600, zc = H ? H.zc : edge + 400 + R;   // EG-HERO-LAY: a hero chamber's court at its own size
    band(edge - back(), H ? H.z0 : edge + 450, BRIDGE_HALF, 'bridge', y);
    if (!H) { disc(X, zc, R, 'court', y); flD(X, zc, R, y); }
    chamberAt(zc, R);
    const obj = between(r, 0, 2);
    spot('chamber', X, zc, { obj });
    const ra = obj === 0 ? heroRifts(3) : null;   // EG-HERO-LAY: a hero's rifts set in its walls, where it names enough
    if (ra) P.rifts.push(...ra);
    else if (obj === 0) for (const deg of [60, 180, 300]) { const [x, z] = polar(X, zc, R - 300, deg); P.rifts.push({ x, z }); }
    else if (obj === 1) P.foe = { x: X, z: zc + 400 };
    else spot('engine', X, zc);
    spot('niche', X + R - 200, zc);
    edge = H ? H.z0 + H.L : zc + R;
    // the shaft down - or the Galleries' set piece (section 8.8's third fragment)
    band(edge - back(), edge + 300, BRIDGE_HALF, 'bridge', y);
    edge += 300;
    const set = plain ? null : egSetPieceOf(c, kind, bnd, egTubeCircle(seed));
    if (set) { setPiece(set); island(between(r, 200, 260)); }
    else if (law >= EG_SLAG_LAW) shaft();   // EG-ZC: a shaft of its band's kit - the Hollow Trunk, the Slag Chute
    else for (let q = 0; q < 3; q++) { y -= 150; step('ledge', 150, { x: (q % 2 ? 1 : -1) * 80 }); }   // the law before: down on three ledges
    cave();
    edge += gap();
  } else if (kind === 'scriptorium') {
    run('still', 3);
    const R = 1200, zc = edge + gap() + R;
    disc(X, zc, R, 'court', y); chamberAt(zc, R, null);
    spot('niche', X, zc);
    edge = zc + R;
    run('still', 2);
    edge += gap();
  } else {
    // THE COURT: a short approach of the band's first two pieces, and the lord's own ground
    const lord = egBossOf(seed, c);
    run(c <= 1 ? 'still' : pieces[between(r, 0, 1)], between(r, 3, 5));
    edge += gap();
    layGround(EG_LORDS[lord].ground);
  }
  /** THE RAMPART'S WALK (section 8.3) from where the hall stands - its bastions, waystones, vents, casters' pillars and their
   *  stairs, its portcullis (THE ASCENT: the same walk, a course of spec law 9's way). */
  function rampartWalk() {
    const L = between(r, 9, 12) * 1000, half = 250;
    const w = band(edge - 50, edge + L, half, variant === 'forgebridge' ? 'belt' : 'walk');
    flL(X, edge - 50, X, edge + L, half);
    P.walk = { x: X, z0: w.z0, z1: w.z1, halfW: half };
    // bastions every 35-45 m, off its sides by turns: the back of the line's fight floors
    let side = r() < 0.5 ? -1 : 1;
    const bastions = [];
    for (let z = edge + between(r, 30, 40) * 100; z < edge + L - 1500; z += between(r, 35, 45) * 100, side = -side) { disc(X + side * (half + 550), z, 600, 'bastion'); flD(X + side * (half + 550), z, 600); bastions.push([side, z]); }
    // waystones every 30 m (a push off the edge returns a member to the nearest one behind)
    for (let z = edge + EG_WAYSTONE_EVERY_M * 100; z < edge + L; z += EG_WAYSTONE_EVERY_M * 100) P.waystones.push({ x: X, z });
    // vent lanes across it from 20 m in, every 16-22 m, each its own cycle: 1.0 s warned, 0.5 s erupting (none on the Gauntlet)
    if (variant !== 'gauntlet') for (let z = edge + 2000; z < edge + L - 1400; z += between(r, 16, 22) * 100) P.vents.push({ x: X, z, d: 400, halfW: half + 100, cycle: between(r, 40, 60) * 100, phase: between(r, 0, 39) * 100 });
    // caster pillars beside it, 10-18 m out, each reached by a short side span with its plate (six laid; the brain stands
    // as many as the company asks). AUDIT EG V - LAW 8 (section 8.3, lane5 #15): the side span climbs from the walkway's edge
    // onto the pillar's top (a stair - the laws before laid it flat at the walkway's height, under a pillar 2 m up)
    // EG-PERFECT - THE BROKEN WAY (spec law 10): a pillar stands on the side no bastion holds within its reach of it (law 9
    // stood a pillar's top over a bastion's floor in 56% of its Ramparts, 1.5 m under its lip, its stair laid across it), its
    // Gauntlet plate on its top beside its stair's head (law 9's stood 5.5 m out, 3 m up its stair, never on the pillar)
    const L10 = law >= EG_BROKEN_LAW, held = (sd, z) => bastions.some(([bs, bz]) => bs === sd && Math.abs(bz - z) < 600 + 300 + 200);
    for (let k = 0; k < 6; k++) {
      const s0 = k % 2 === 0 ? 1 : -1, z = edge + Math.floor(((k + 1) * L) / 7), out = between(r, 10, 18) * 100;
      const s = L10 && held(s0, z) && !held(-s0, z) ? -s0 : s0;
      disc(X + s * out, z, 300, 'pillar', EG_PILLAR_UP_CM);
      if (L8) P.ramps.push({ ax: X + s * half, az: z, bx: X + s * (out - 300), bz: z, hw: 150, y0: 0, y1: EG_PILLAR_UP_CM });
      else lane(X + s * half, z, X + s * (out - 300), z, 150, 'side');
      spot('pillar', X + s * out, z, { plate: L10 ? [X + s * (out - 150), z] : [X + s * (half + 300), z] });
    }
    const zg = edge + L - 300;
    P.gate = { x: X, z: zg, halfW: half, bearers: [{ x: X - 150, z: zg - 350 }, { x: X + 150, z: zg - 350 }] };
    // (THE BROKEN WAY - spec law 10: the winch plates against the walkway's edges - law 9's stood 1.5 m of void off it)
    if (variant === 'winch') for (const s of [-1, 1]) { const wx = X + s * (half + (law >= EG_BROKEN_LAW ? 250 : 400)); disc(wx, zg - 600, 250, 'winch'); spot('winch', wx, zg - 600); }
    edge += L;
  }
  /** THE LORDS' GROUNDS (section 13.3) - each lord's own, laid past the approach's edge. */
  function layGround(g) {
    const flat = (R) => { const zc = edge + R; disc(X, zc, R, 'court', y); flD(X, zc, R, y); P.foe = { x: X, z: zc }; P.ring = { x: X, z: zc, r: R - 100 }; edge = zc + R; return zc; };
    if (g === 'isles') {
      // Grath's magma chamber: three basalt islands (r 11) joined by bridges 6 m wide over the magma
      const zc = edge + 3100, isles = [[X, zc - 2000], polar(X, zc, 2000, 60), polar(X, zc, 2000, 300)];
      for (const [x, z] of isles) { disc(x, z, 1100, 'isle', y); flD(x, z, 1100, y); spot('isle', x, z); }
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const [ax, az] = isles[a], [bx, bz] = isles[b], d = lawIsqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
        const ox = Math.trunc(((bx - ax) * 1000) / d), oz = Math.trunc(((bz - az) * 1000) / d);
        const p0 = [ax + ox, az + oz], p1 = [bx - ox, bz - oz];
        lane(p0[0], p0[1], p1[0], p1[1], 300, 'bridge', y); flL(p0[0], p0[1], p1[0], p1[1], 300, y); spot('bridge', p0[0], p0[1], { bx: p1[0], bz: p1[1] });
      }
      P.deco.push({ t: 'magma', x: X, z: zc, r: 3600, y: y - 150 });
      P.foe = { x: isles[1][0], z: isles[1][1] }; P.ring = { x: isles[0][0], z: isles[0][1], r: 1000 };
      edge = zc + 2000 + 1100;
    } else if (g === 'disc18' || g === 'disc20' || g === 'disc22') {
      const R = g === 'disc18' ? 1800 : g === 'disc20' ? 2000 : 2200, zc = flat(R);
      if (g === 'disc18') {
        for (const deg of [45, 135, 225, 315]) { const [x, z] = polar(X, zc, R - 150, deg); spot('rune', x, z); }
        for (const deg of [0, 90, 180, 270]) { const [x, z] = polar(X, zc, 1300, deg); spot('haven', x, z); }
      }
      if (g === 'disc20') for (const deg of [0, 120, 240]) { const [x, z] = polar(X, zc, 900, deg + 30); spot('brazier', x, z); }
    } else if (g === 'rotunda') {
      // AUDIT EG V - LAW 8 (section 13.4, lane5 #14): "three balconies 4 m up, two stairs each" - each stair from the floor up onto
      // its balcony, either side of its middle (the laws before laid none)
      const R = 2400, zc = flat(R);
      for (const deg of [0, 120, 240]) {
        const [x, z] = polar(X, zc, R + 300, deg); disc(x, z, 500, 'balcony', y + 400); flD(x, z, 500, y + 400); spot('balcony', x, z, L9 ? { y: y + 400 } : {});
        if (L8) for (const sd of [-1, 1]) {
          const [ax, az] = polar(X, zc, R - 600, deg), [bx, bz] = polar(X, zc, R + 50, deg), tx = sd * Math.trunc((250 * lawCos(deg)) / 10000), tz = -sd * Math.trunc((250 * lawSin(deg)) / 10000);
          P.ramps.push({ ax: ax + tx, az: az + tz, bx: bx + tx, bz: bz + tz, hw: 150, y0: y, y1: y + 400 });
        }
      }
      P.deco.push({ t: 'wall', x: X, z: zc, r: R + 900, h: 1200, y });
      edge = zc + R + 900;
    } else if (g === 'crypt') {
      const R = 1400, zc = flat(R);
      for (const deg of [45, 135, 225, 315]) { const [x, z] = polar(X, zc, R - 150, deg); spot('gem', x, z); }
      P.deco.push({ t: 'wall', x: X, z: zc, r: R + 150, h: 800, y });
    } else if (g === 'twins') {
      const zA = edge + 1400, zB = zA + 1400 + 2400 + 1400;
      disc(X, zA, 1400, 'court', y); flD(X, zA, 1400, y); disc(X, zB, 1400, 'court', y); flD(X, zB, 1400, y);
      band(zA + 1400, zB - 1400, 300, 'bridge', y); flL(X, zA + 1400, X, zB - 1400, 300, y);
      spot('court', X, zA); spot('court', X, zB);
      P.foe = { x: X, z: zA + 500 }; P.ring = { x: X, z: zA, r: 1300 };
      edge = zB + 1400;
    } else if (g === 'soulbridge') {
      const zA = edge + 1400, zB = zA + 1400 + 3000 + 1400;
      disc(X, zA, 1400, 'court', y); flD(X, zA, 1400, y); disc(X, zB, 1400, 'court', y); flD(X, zB, 1400, y);
      band(zA + 1400, zB - 1400, 300, 'bridge', y); flL(X, zA + 1400, X, zB - 1400, 300, y);
      spot('court', X, zA); spot('court', X, zB);
      P.foe = { x: X, z: (zA + zB) / 2 }; P.ring = { x: X, z: zA, r: 1300 };
      edge = zB + 1400;
    } else if (g === 'glade') {
      const R = 2200, zc = flat(R);
      for (const deg of [0, 120, 240]) { const [x, z] = polar(X, zc, R - 200, deg); spot('anchor', x, z); }
      for (const deg of [30, 90, 150, 210, 270, 330]) { const [x, z] = polar(X, zc, law >= EG_BROKEN_LAW ? R - 100 : R + 100, deg); spot('brazier', x, z); }   // (THE BROKEN WAY: on its ground's rim - law 9's stood a metre off it)
    } else if (g === 'vault') {
      const R = 2200, zc = flat(R);
      spot('shafts', X, zc, { r: 1200 });
      P.deco.push({ t: 'wall', x: X, z: zc, r: R + 150, h: 1100, y });
    } else if (g === 'forge') {
      // the Forge Gut's long chamber: 55 m, the Colossus's route along it
      const z0 = edge, z1 = z0 + 5500;   // EG-FULL LAYER THREE: from the approach's own gap (the solver now jumps the real gap - 3 m more was unreachable)
      band(z0, z1, 1000, 'court', y); flL(X, z0, X, z1, 1000, y);
      P.foe = { x: X, z: z0 + 800 }; P.ring = { x: X, z: z0 + 600, r: 900 };
      spot('route', X, z0 + 800, { z1: z1 - 800 });
      P.deco.push({ t: 'hall', x: X, z0, z1, hw: 1150, h: 1200, y });
      edge = z1;
    } else if (g === 'perches') {
      // AUDIT EG V - LAW 8 (section 13.3, lane5 #15): each perch's side span a stair from the court up onto its top (the laws
      // before laid it flat at the court's height, under the perch 3 m up)
      const R = 2200, zc = flat(R);
      for (const deg of [0, 120, 240]) {
        const [px, pz] = polar(X, zc, R + 800, deg), [ex, ez] = polar(X, zc, R - 50, deg), [fx, fz] = polar(X, zc, R + 450, deg);
        disc(px, pz, 350, 'perch', y + EG_PERCH_UP_CM); flD(px, pz, 350, y + EG_PERCH_UP_CM);
        if (L8) P.ramps.push({ ax: ex, az: ez, bx: fx, bz: fz, hw: 200, y0: y, y1: y + EG_PERCH_UP_CM });
        else { lane(ex, ez, fx, fz, 200, 'side', y); flL(ex, ez, fx, fz, 200, y); }
        spot('pillar', px, pz, L9 ? { y: y + EG_PERCH_UP_CM } : {});   // THE ASCENT: on its perch's top
      }
      edge = zc + R + 1200;
    } else {
      const R = 2200, zc = flat(R);
      P.deco.push({ t: 'tiers', x: X, z: zc, r: R + 200, h: 600, y });
      spot('pit', X, zc);
    }
  }
  if (!L9 && !['court'].includes(kind)) { const z = edge + PLATE_R; P.end = disc(X, z, PLATE_R, 'end', y); edge = z + PLATE_R; }   // THE ASCENT: the plan laid the door at the way's end
  // (THE ASCENT: the arrival plate's spots at the plate's height, the end plate's at its own, the chains at their floor's)
  const yPlate = L9 ? { y: 0 } : {};
  if (twist === 'sutler') spot('sutler', X + 300, 0, yPlate);
  if (twist === 'bargain') spot('shrine', X - 300, 0, yPlate);
  if (twist === 'captive') {
    const f0 = hc?.laid ? { t: 'd', x: law >= EG_BROKEN_LAW ? P.heroes.find((q) => !q.rec.room).x : X, z: hc.zc, r: hc.R } : P.fl[0];   // EG-HERO-LAY: a hero chamber's court, the chains about its middle (THE BROKEN WAY: at its hero's own line - THE ASCENT's planner has set X back to 0 by now)
    const yF0 = L9 ? { y: f0?.y ?? (hc?.laid ? P.heroes.find((q) => !q.rec.room).y : y) } : {};
    if (f0?.t === 'd') for (const deg of [0, 120, 240]) { const [x, z] = polar(f0.x, f0.z, Math.floor(f0.r / 2), deg); spot('chain', x, z, yF0); } else if (L9 && f0?.t === 'l') spot('chain', f0.ax, Math.floor((f0.az + f0.bz) / 2), yF0); else spot('chain', X, Math.floor(edge / 2), yF0);   // THE ASCENT: on its walkway's middle
  }
  if (slot === 3 || kind === 'scriptorium') spot('niche', X - 350, 0, yPlate);
  // the cache on every trial hall's end plate (section 17.1)
  if (P.end && kind !== 'brink') spot('cache', P.end.x, P.end.z - 200, L9 ? { y: P.end.y } : {});
  // EG6a: THE HALL'S STEPS ARE ITS COURSES, laid by courseOf (net/eliteGates/egSpanLaw.js) - one a road, in the hall's one count
  P.steps = S.lay();
  // THE GROUND AFTER EACH RUN (net/eliteGates/egSpanLaw.js egSpanPairs): each step no step of its road follows knows how far on its
  // road's next still ground begins - an island, a plate, a passage's floor - so the solver jumps the real gap. AUDIT EG V - LAW
  // 8 (lane5 #5): and how high that ground stands (`ya` - the Sinking Stair's island below its last flight), so the solver leaps
  // to the real height; the laws before took it at the step's own
  // THE ASCENT (spec law 9): a run's ground after it is its own course's (each course stands elsewhere along the way)
  // (THE BROKEN WAY - spec law 10: by height too, and the least of those that hold it - a broken bridge's ground stands in
  // plan inside another course's, a way 4.5 m and more over a course inside its plan; law 9 took a bridge 18.8 m over a
  // shaft's last ledge for the ground after it)
  const L10 = law >= EG_BROKEN_LAW;
  const courseOf = (x, z, gy = 0) => (asc ? (L10 ? egCourseHolding(asc.segs, x, gy, z, 50) : asc.segs.find((g) => x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1)) ?? null : null);
  for (const s of P.steps) {
    if (s.hd) continue;   // THE BROKEN WAY: a turned piece knows its ground after (its bridge's far foot, along its heading)
    const far = s.z + s.d / 2, next = P.steps.find((q) => q.road === s.road && q.i > s.i);
    if (next && !next.hd && Math.abs(next.z - next.d / 2 - next.gap - far) < 1) continue;
    let best = Infinity, bestY = s.y;
    const own = courseOf(s.x, s.z, s.y);
    const take = (dz, gy, gx = s.x, gz = far + dz) => { if (asc && courseOf(gx, gz, gy) !== own) return; if (dz < best) { best = dz; bestY = gy; } };
    for (const d of P.discs) if (Math.abs(d.x - s.x) <= d.r + s.w && d.z - d.r >= far - 1) take(d.z - d.r - far, d.y, d.x, d.z);
    for (const b of P.bands) if (Math.abs(b.x - s.x) <= b.halfW + s.w && b.z0 >= far - 1) take(b.z0 - far, b.y, b.x, b.z0 + 1);
    for (const l of P.lanes) { const lz = Math.min(l.az, l.bz); if (Math.abs(l.ax - s.x) <= l.hw + s.w && lz >= far - 1) take(lz - far, l.y, l.ax, lz + 1); }
    // EG-HERO-LAY: a hero's floors are still ground too (each its outline's box across the step and along the road)
    for (const q of P.heroes) for (const g of q.rec.floors) {
      const xs = g.poly.map((p) => q.x + p[0]), z0 = q.z + Math.min(...g.poly.map((p) => p[1]));
      if (Math.min(...xs) - s.w <= s.x && s.x <= Math.max(...xs) + s.w && z0 >= far - 1 && !q.rec.room) take(z0 - far, q.y + g.y, s.x, z0 + 1);   // THE ASCENT: a room is no course's ground
    }
    s.after = Number.isFinite(best) ? Math.max(0, best) : 0;
    if (L8) s.ya = bestY;
  }
  // EG-HERO-LAY: THE HERO'S FIT over the hall laid (heroHall reads it; THE TIMED SOLVER is asked after)
  if (fit && P.heroes.some((q) => !q.rec.room)) fit.ok = !fit.why && heroFit(P, edge, kind, fit, L9);
  // the fight's bounding disc (the telegraph pass's floor, the wire's bound)
  let fight = null;
  if (P.fl.length) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const f of P.fl) {
      if (f.t === 'd') { x0 = Math.min(x0, f.x - f.r); x1 = Math.max(x1, f.x + f.r); z0 = Math.min(z0, f.z - f.r); z1 = Math.max(z1, f.z + f.r); }
      else if (f.t === 'p') for (const [px, pz] of f.poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }   // EG-HERO-LAY: a hero's fight floor
      else { x0 = Math.min(x0, f.ax - f.hw, f.bx - f.hw); x1 = Math.max(x1, f.ax + f.hw, f.bx + f.hw); z0 = Math.min(z0, f.az, f.bz); z1 = Math.max(z1, f.az, f.bz); }
    }
    const cx = Math.round((x0 + x1) / 2), cz = Math.round((z0 + z1) / 2);
    fight = { x: cx, y: L9 ? P.fl[0].y ?? 0 : 0, z: cz, r: Math.ceil((lawIsqrt((x1 - x0) * (x1 - x0) + (z1 - z0) * (z1 - z0)) + 1) / 2), role: kind === 'rampart' ? 'walk' : 'court' };   // THE ASCENT: at its floor's height
  }
  // said in metres
  const pt = (q) => (q ? { ...q, x: m(q.x), y: m(q.y ?? 0), z: m(q.z), ...(q.r != null ? { r: m(q.r) } : {}) } : null);
  const spots = {};   // EG-ZQ: a spot's `y` stays in centimetres (the law's - see `spot`, above)
  for (const [k, v] of Object.entries(P.spots)) spots[k] = v.map((q) => { const o = { ...q, x: m(q.x), z: m(q.z) }; if (q.r != null) o.r = m(q.r); if (q.plate) o.plate = [m(q.plate[0]), m(q.plate[1])]; if (q.bx != null) { o.bx = m(q.bx); o.bz = m(q.bz); } if (q.z1 != null) o.z1 = m(q.z1); return o; });
  const lord = kind === 'court' ? egBossOf(seed, c) : null;
  return {
    v: law, ...(L9 ? { law } : {}), seed, h, c, slot, kind, variant, twist, band: bnd, geo, lord,   // THE ASCENT: the spec says its law
    champ: kind === 'proving' || (kind === 'deepway' && P.foe) ? EG_CHAMPIONS[bnd].key : null,
    name: kind === 'court' ? `${EG_LORDS[lord].name}, ${EG_LORDS[lord].epithet}` : EG_HALL_NAMES[variant ?? kind], objective: EG_OBJECTIVES[variant ?? kind],
    x0: (slot - 1) * EG_HALL_PITCH, len: L9 ? m(Math.max(...asc.vols.map((q) => q.b[5]))) : m(edge),   // THE ASCENT: as far along +z as the way's ground stands
    arrive: pt(P.arrive), end: pt(P.end),
    discs: P.discs.map(pt),
    bands: P.bands.map((b) => ({ x: m(b.x), y: m(b.y), z0: m(b.z0), z1: m(b.z1), halfW: m(b.halfW), role: b.role })),
    lanes: P.lanes.map((l) => ({ ax: m(l.ax), az: m(l.az), bx: m(l.bx), bz: m(l.bz), hw: m(l.hw), role: l.role, y: m(l.y) })),
    steps: P.steps.map((s) => ({ i: s.i, kind: s.kind, span: s.span, x: m(s.x), y: m(s.y), z: m(s.z), w: m(s.w), d: m(s.d), amp: m(s.amp), period: s.period / 1000, phase: s.phase / 1000, beat: s.kind === 'moon' ? m(s.beat) : s.beat / 1000, gap: m(s.gap), road: s.road, kit: s.kit, after: m(s.after), ...(s.ya != null ? { ya: m(s.ya) } : {}), ...(s.hd ? { hd: s.hd } : {}) })),   // AUDIT EG V - LAW 8: the ground after's height (THE BROKEN WAY: a turned piece's heading)
    islands: P.islands.map(pt),
    caves: P.caves.map((q) => ({ x: m(q.x), y: m(q.y), yB: m(q.yB), z0: m(q.z0), z1: m(q.z1), zA: m(q.zA), zB: m(q.zB), halfW: m(q.halfW), height: m(q.height), kit: q.kit, open: q.open, road: q.road, tube: q.tube ?? 0, ...(q.shaft ? { shaft: 1 } : {}) })),   // EG-ZC: a shaft's walls marked
    // EG-FULL LAYER THREE: the fragments (net/eliteGates/egFragLaw.js) - metres and seconds, the hall's frame
    frags: P.frags.map((q) => ({ ...q, x: m(q.x), y: m(q.y), z0: m(q.z0), z1: m(q.z1) })),
    hazards: P.hazards.map((q) => ({ kind: q.kind, i: q.i, x: m(q.x), z: m(q.z), y: m(q.y), period: q.period / 1000, phase: q.phase / 1000, w: m(q.w), r: m(q.r), ring: m(q.ring),
      sh: q.sh ? q.sh.map(m) : null, spots: q.spots ? q.spots.map((p) => p.map(m)) : null, lanes: q.lanes ? q.lanes.map((p) => p.map(m)) : null, path: q.path ? q.path.map(m) : null })),
    ramps: P.ramps.map((q) => ({ ax: m(q.ax), az: m(q.az), bx: m(q.bx), bz: m(q.bz), hw: m(q.hw), y0: m(q.y0), y1: m(q.y1) })),
    engines: P.engines.map((q) => ({ i: q.i, kind: q.kind, x: m(q.x), z: m(q.z), y: m(q.y) })),
    alcoves: P.alcoves.map((q) => ({ i: q.i, x: m(q.x), z: m(q.z), y: m(q.y), seal: q.seal, side: q.side, holds: q.holds })),
    vignettes: P.vignettes.map((q) => ({ t: q.t, x: m(q.x), z: m(q.z), y: m(q.y), yaw: q.yaw })),
    lights: P.lights.map((q) => [m(q[0]), m(q[1]), m(q[2]), q[3]]),
    tube: P.tube ? { x: m(P.tube.x), y: m(P.tube.y), z0: m(P.tube.z0), z1: m(P.tube.z1), halfW: m(P.tube.halfW), start: P.tube.start / 1000, mps: P.tube.mps } : null,
    fork: P.fork ? { x: m(P.fork.x), z: m(P.fork.z), lowX: m(P.fork.lowX), y: m(P.fork.y), yLow: m(P.fork.yLow), plate: m(P.fork.plate), hi: 0, lo: 0 } : null,
    fl: P.fl.map((f) => (f.t === 'd' ? { t: 'd', x: m(f.x), z: m(f.z), r: m(f.r), y: m(f.y) } : f.t === 'p' ? { t: 'p', poly: f.poly.map((p) => [m(p[0]), m(p[1])]), y: m(f.y) } : { t: 'l', ax: m(f.ax), az: m(f.az), bx: m(f.bx), bz: m(f.bz), hw: m(f.hw), y: m(f.y) })),
    fight: pt(fight), foe: P.foe ? { x: m(P.foe.x), z: m(P.foe.z), ...(L9 ? { y: m(P.foe.y ?? 0) } : {}) } : null, ring: pt(P.ring), spots, chamber: P.chamber,   // THE ASCENT: the foe's height (metres)
    deco: P.deco.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'number' ? m(v) : v]))),
    rifts: P.rifts.map((q) => ({ x: m(q.x), z: m(q.z), ...(L9 ? { y: m(q.y ?? 0) } : {}) })),   // THE ASCENT: each rift's height (metres)
    vents: P.vents.map((q) => ({ x: m(q.x), z: m(q.z), d: m(q.d), halfW: m(q.halfW), cycle: q.cycle, phase: q.phase })),
    gate: P.gate ? { x: m(P.gate.x), z: m(P.gate.z), halfW: m(P.gate.halfW), bearers: P.gate.bearers.map((q) => ({ x: m(q.x), z: m(q.z) })) } : null,
    walk: P.walk ? { x: m(P.walk.x), z0: m(P.walk.z0), z1: m(P.walk.z1), halfW: m(P.walk.halfW) } : null,
    waystones: P.waystones.map((q) => ({ x: m(q.x), z: m(q.z) })),
    // EG-HERO-LAY - SPEC LAW 7: the hero laid, its law in the hall's frame (metres) - none in a hall that lays none, which is
    // law 6's hall but its number
    ...(P.heroes.length ? { heroes: P.heroes.map(heroSaid) } : {}),
    // THE ASCENT - SPEC LAW 9: THE ROUTE (section 1 - its nodes and links in metres, a link's `len` its walked length, `main` the
    // arrival plate's node to the door's; `courses` each course's own ground, where THE TIMED SOLVER proves it), THE CLIMBS
    // (section 4), THE VOIDS (section 2) and THE ROOMS (section 3 - each its archetype and its hero's number)
    ...(L9 ? {
      route: {
        nodes: asc.nodes.map((q) => [m(q[0]), m(q[1]), m(q[2])]),
        links: asc.links.map((l) => ({ a: l.a, b: l.b, kind: l.kind, road: l.road, len: m(l.len), ...(l.one ? { one: 1 } : {}), ...(l.climb != null ? { climb: l.climb } : {}) })),
        main: asc.main,
        courses: asc.segs.map((g) => ({ x0: m(g.x0), x1: m(g.x1), z0: m(g.z0), z1: m(g.z1), y0: m(g.y0), y1: m(g.y1), ...(g.broken ? { b: 1 } : {}) })),   // (THE BROKEN WAY: a broken bridge's ground marked)
      },
      climbs: asc.climbs.map((q) => ({ x0: m(q.x0), z0: m(q.z0), x1: m(q.x1), z1: m(q.z1), y0: m(q.y0), y1: m(q.y1), ledges: q.ledges.map(m), face: q.face, d: m(q.d), road: q.road })),
      voids: asc.voids.map((q) => ({ poly: q.poly.map((p) => [m(p[0]), m(p[1])]), y0: m(q.y0), y1: m(q.y1) })),
      rooms: asc.rooms.map((q) => ({ k: q.k, h: q.hero })),
    } : {}),
  };
}
/**
 * A HERO AS ITS HALL SAYS IT (metres, the hall's frame - its origin `x, y, z`, the foot of its mouth): its id, kit and class,
 * its fragment's number (`f`, the spec's `frags`), its road, its course's exit (`exit`, a socket of `sockets.out`), its box,
 * its sockets, its floors (each a polygon at its height, `fight` where blows land), its stairs (each corner at its height),
 * its open edges (`[floor, edge]`), its ceilings (null: open to the sky) and its walk graph - the record's own law, laid.
 * What the relay and every screen read of it but its fight floors, stairs, course, hazards, places, alcoves and lights,
 * which stand in the spec's own fields.
 */
function heroSaid({ rec, f, x, y, z, exit, road }) {
  const at = (q) => [m(x + q[0]), m(z + q[1])], so = (s) => ({ x: m(x + s.x), y: m(y + s.y), z: m(z + s.z), w: m(s.w), h: m(s.h) });
  return {
    id: rec.id, kit: rec.kit, cls: rec.class, f, road, x: m(x), y: m(y), z: m(z), exit, box: egFragBoxAt(rec, x, y, z).map(m),
    sockets: { in: so(rec.sockets.in), out: rec.sockets.out.map(so) },
    floors: rec.floors.map((g) => ({ y: m(y + g.y), poly: g.poly.map(at), fight: g.fight ? 1 : 0 })),
    ramps: rec.ramps.map((q) => ({ poly: q.poly.map((p) => [m(x + p[0]), m(y + p[1]), m(z + p[2])]) })),
    open: rec.open.map((e) => [e[0], e[1]]),
    ceil: rec.ceil ? rec.ceil.map((c) => ({ y: m(y + c.y), poly: c.poly.map(at) })) : null,
    graph: { nodes: rec.graph.nodes.map((n) => [m(x + n[0]), m(y + n[1]), m(z + n[2]), m(n[3])]), edges: rec.graph.edges.map((e) => [e[0], e[1]]) },
    ...(rec.room ? { room: rec.room } : {}),   // THE ASCENT: a room's archetype, numbers, sockets used and turn - its walls built from them (world/eliteGates/egRoomModel.js)
  };
}
/**
 * THE HERO'S FIT OVER THE HALL LAID (spec law 7; cm, the hall's parts `P` before they are said - `edge` the hall's length):
 * the hall inside EG_HALL_LEN_MAX and its cap of fragments; the hero's box EG_FRAG_APART_CM from every other fragment's
 * volume and every other piece's swept box with its hanging underside (EG_HANG_CM) - one joined at its mouth or exit aside
 * (apartOrJoined) - and a Low Road's vault EG_VAULT_UNDER_CM under any underside over it; a chamber's trial on its fight
 * floors (every place the hall set inside its box - a rift, a spot, the foe - on one of them, its own anchors aside). Says why
 * not into `fit`. Pure.
 * @param {any} P @param {number} edge @param {string} kind @param {{ ok: boolean, why: string }} fit
 */
function heroFit(P, edge, kind, fit, l9 = false) {
  const no = (why) => { fit.why = why; return false; };
  const H = P.heroes.find((q) => !q.rec.room), rec = H.rec, hb = egFragBoxAt(rec, H.x, H.y, H.z);   // THE ASCENT: the hero, never a room
  if (!l9 && edge > EG_HALL_LEN_MAX * 100) return no(`the hall runs ${edge} cm, past ${EG_HALL_LEN_MAX} m`);   // THE ASCENT: the plan holds the bound
  if (P.frags.length > (l9 ? EG_ASCENT_FRAGS_MAX : EG_FRAGS_MAX)) return no(`${P.frags.length} fragments, past the hall's cap`);
  // VOLUMES STAND APART (section 11.5): every other fragment's volume - a code-built one's floors and vault, a chamber's court
  for (const [i, g] of P.frags.entries()) {
    if (i === H.f) continue;
    const room = g.room ? P.heroes.find((q) => q.f === i) : null;   // THE ASCENT: a room's own box
    if (room) { if (!apartOrJoined(hb, egFragBoxAt(room.rec, room.x, room.y, room.z))) return no(`its box meets room ${i}'s`); continue; }
    const q = P.caves.find((cv) => cv.z0 === g.z0 && cv.x === g.x);
    const gb = q ? [q.x - q.halfW, Math.min(q.y, q.yB), q.z0, q.x + q.halfW, Math.max(q.y, q.yB) + q.height, q.z1]
      : g.cls === 'chamber' ? [g.x - Math.floor((g.z1 - g.z0) / 2), g.y, g.z0, g.x + Math.floor((g.z1 - g.z0) / 2), g.y + EG_FRAG_HEADROOM_CM.chamber, g.z1]
        : [g.x - EG_STEP.still.w, g.y - EG_DROP_CM, g.z0, g.x + EG_STEP.still.w, g.y + EG_FRAG_HEADROOM_CM.passage, g.z1];   // a set piece's flights
    if (!apartOrJoined(hb, gb)) return no(`its box meets fragment ${i}'s`);
  }
  // ...and every piece's swept box but its own inner course's, its hanging underside under it
  for (const s of P.steps) {
    if (s.road === H.road && s.z >= hb[2] && s.z <= hb[5] && s.kit === rec.kit) continue;
    const sw = egFragSwept(s), sb = [sw[0], sw[1] - EG_HANG_CM, sw[2], sw[3], sw[4], sw[5]];
    if (!apartOrJoined(hb, sb)) return no(`its box meets step ${s.i}'s swept box`);
    if (sb[0] < hb[3] && hb[0] < sb[3] && sb[2] < hb[5] && hb[2] < sb[5] && sb[1] - hb[4] < EG_VAULT_UNDER_CM && sb[4] > hb[4]) return no(`its vault under step ${s.i}'s underside by under ${EG_VAULT_UNDER_CM} cm`);
  }
  // a chamber's trial on its fight floors
  if (rec.class === 'chamber') {
    const floors = P.fl.filter((g) => g.t === 'p');   // the hero's (the hall lays no other polygon)
    const inBox = (x, z) => x >= hb[0] && x <= hb[3] && z >= hb[2] && z <= hb[5];
    const on = (x, z) => floors.some((g) => egFragInPoly(g.poly, x, z));
    const places = [...Object.values(P.spots).flat().filter((q) => q.f !== H.f), ...P.rifts.filter((q) => !q.a), ...(P.foe ? [P.foe] : [])];
    for (const q of places) if (inBox(q.x, q.z) && !on(q.x, q.z)) return no(`its ${kind}'s place at (${q.x}, ${q.z}) stands on none of its fight floors`);
  }
  return true;
}

/** THE COLLAPSING TUBE's circle (section 11.3 - the Galleries' set piece): the first circle from the third whose
 *  traversal is a span. */
export function egTubeCircle(seed) {
  for (let c = 3; c <= 5; c++) if (egCirclePlan(seed, c)[1]?.kind === 'span') return c;
  return 0;
}
/** A circle's five specs, in slot order (`geo` its span decrees; EG-ZC: `law` the spec law, this build's unless named). */
export const egCircleSpecs = (seed, c, geo = 0, law = _lawUnnamed) => [1, 2, 3, 4, 5].map((s) => egHallOf(seed, egFirstHallOf(c) + s - 1, geo, law));

/** The spec's digest (section 9's `sd`): FNV-1a over its JSON - one seed, one digest, on every machine. */
export function egSpecDigest(spec) {
  const s = JSON.stringify(spec);
  let hsh = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { hsh ^= s.charCodeAt(i); hsh = Math.imul(hsh, 0x01000193); }
  return hsh >>> 0;
}

// ── where a body stands (the relay's judgements and the motor's edge) ─────────────────────────────────────
const segD = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), x: ax + dx * t, z: az + dz * t };
};
/** Is (x, z) (the hall's own frame, as every helper below) on one of the spec's floors - its discs, its bands, its lanes,
 *  its steps at rest - within `pad` m? THE ASCENT (section 2): `y` the body's feet - in a hall that judges by height
 *  (net/eliteGates/egWalkGraph.js egByHeight), only a floor that bears them (egBears - a stair's whole rise); not known, any. */
export function egOnFloor(spec, x, z, pad = 0, y = NaN) {
  const H = egFeetY(spec, y), on = (fy) => egBears(fy ?? 0, H);
  for (const d of spec.discs) if (on(d.y) && Math.hypot(x - d.x, z - d.z) <= d.r + pad) return true;
  for (const b of spec.bands) if (on(b.y) && z >= b.z0 - pad && z <= b.z1 + pad && Math.abs(x - b.x) <= b.halfW + pad) return true;
  for (const l of spec.lanes ?? []) if (on(l.y) && segD(x, z, l.ax, l.az, l.bx, l.bz).d <= l.hw + pad) return true;
  for (const s of spec.steps) if (on(s.y) && Math.abs(z - s.z) <= s.d / 2 + pad && Math.abs(x - s.x) <= s.w / 2 + s.amp + pad) return true;
  // EG-HERO-LAY: a hero's floors and stairs (its law's own outlines)
  for (const q of spec.heroes ?? []) for (const g of [...q.floors, ...q.ramps]) {
    // a stair bears the feet anywhere along its rise (its corners' heights)
    if (Number.isFinite(H) && !(g.y != null ? on(g.y) : on(Math.min(...g.poly.map((p) => p[1]))) || on(Math.max(...g.poly.map((p) => p[1]))) || (H >= Math.min(...g.poly.map((p) => p[1])) && H <= Math.max(...g.poly.map((p) => p[1]))))) continue;
    if (egPolyIn(g.poly.map((p) => (p.length > 2 ? [p[0], p[2]] : p)), x, z, pad)) return true;
  }
  return false;
}
/** Is the Spire-frame point (sx, z) within hall `spec`'s ground at all (`pad` m about) - a member is in a hall when their
 *  pose is. THE ASCENT: the route's own (net/eliteGates/egRoute.js egRouteInHall - laws 4-8 their x strip about their origin and their
 *  length, as ever; LAW 9 its bound, section 7). */
export const egInHall = (spec, sx, z, pad = 40) => egRouteInHall(spec, sx, z, pad);
/** A Spire-frame x in a hall's own frame, and back. */
export const egLocalX = (spec, sx) => sx - spec.x0;
export const egSpireX = (spec, x) => x + spec.x0;
/** Which slot's hall (1-5) of a circle a pose stands in, by its x; 0 none. */
export function egSlotAt(x) {
  const s = Math.round(x / EG_HALL_PITCH) + 1;
  return s >= 1 && s <= 5 && Math.abs(x - (s - 1) * EG_HALL_PITCH) <= EG_HALL_PITCH / 2 ? s : 0;
}
/** Is (x, z) on the hall's arrival plate (pad m about)? On its end plate, at its door? THE ASCENT (section 2): `y` the body's
 *  feet - in a hall that judges by height, on the plate's own floor (egBears); not known, as before. The door's law takes no
 *  pad from any caller (AUDIT EG III #11), so its feet come before it. */
export const egOnArrive = (spec, x, z, pad = 1, y = NaN) => !!spec.arrive && Math.hypot(x - spec.arrive.x, z - spec.arrive.z) <= spec.arrive.r + pad && egBears(spec.arrive.y ?? 0, egFeetY(spec, y));
export const egAtDoor = (spec, x, z, y = NaN, pad = 0) => !!spec.end && Math.hypot(x - spec.end.x, z - spec.end.z) <= EG_DOOR_REACH_M + pad && egBears(spec.end.y ?? 0, egFeetY(spec, y));
/** Does fight floor piece `f` (a disc, a lane's capsule; EG-HERO-LAY: a hero's polygon) hold (x, z) in plan, `pad` m about? */
const onPiece = (f, x, z, pad) => (f.t === 'p' ? egPieceIn(f, x, z, pad) : f.t === 'd' ? Math.hypot(x - f.x, z - f.z) <= f.r + pad : segD(x, z, f.ax, f.az, f.bx, f.bz).d <= f.hw + pad);
/** Is (x, z) on THE FIGHT FLOOR (its discs and lanes - section 11.7; EG-HERO-LAY: a hero's polygons), `pad` m about? A
 *  negative pad asks that far inside its edge. THE ASCENT (section 2): `y` the body's feet - in a hall that judges by height
 *  (net/eliteGates/egWalkGraph.js egByHeight), only a piece that bears them (egBears, the walk graph's band: a body on a floor stacked over
 *  another is never on the one under it, nor one under a floor on the floor over it); not known, any (the laws before). */
export function egOnFight(spec, x, z, pad = 0, y = NaN) {
  const H = egFeetY(spec, y);
  for (const f of spec.fl ?? []) if (egBears(f.y ?? 0, H) && onPiece(f, x, z, pad)) return true;
  return false;
}
/** The fight floor's piece under (x, z) (pad m about), or null. THE ASCENT (section 2): `y` the body's feet - in a hall that
 *  judges by height, the highest piece that bears them (egGroundAt's); not known, the first (as before). */
export function egFightPieceAt(spec, x, z, pad = 0, y = NaN) {
  const H = egFeetY(spec, y);
  if (!Number.isFinite(H)) return (spec.fl ?? []).find((f) => onPiece(f, x, z, pad)) ?? null;
  let best = null;
  for (const f of spec.fl ?? []) if (egBears(f.y ?? 0, H) && onPiece(f, x, z, pad) && (!best || (f.y ?? 0) > (best.y ?? 0))) best = f;
  return best;
}
/** The nearest point of the fight floor to (x, z), `inset` m inside its edge (the legion and the lord keep to it). THE ASCENT
 *  (section 2): `y` the walker's feet - in a hall that judges by height, kept to the pieces that bear them (a spot, a charge's
 *  end, a blink never set on a floor over or under the one it stands on; none bearing them, every piece), and answered with the
 *  kept piece's height (`[x, z, y]` - a body stood there stands on it); not known, `[x, z]` as before. */
export function egKeepOnFight(spec, x, z, inset = 0, y = NaN) {
  if (!spec.fl?.length) return [x, z];
  const H = egFeetY(spec, y), fl = Number.isFinite(H) && spec.fl.some((f) => egBears(f.y ?? 0, H)) ? spec.fl.filter((f) => egBears(f.y ?? 0, H)) : spec.fl;
  if (Number.isFinite(H)) {
    let on = null;
    for (const f of fl) if (onPiece(f, x, z, -inset) && (!on || (f.y ?? 0) > (on.y ?? 0))) on = f;
    if (on) return [x, z, on.y ?? 0];
  } else if (egOnFight(spec, x, z, -inset)) return [x, z];
  let best = null, bd = Infinity;
  for (const f of fl) {
    let px, pz, d;
    if (f.t === 'p') { [px, pz] = egPolyKeep(f.poly, x, z, inset); d = Math.hypot(px - x, pz - z); }   // EG-HERO-LAY: a hero's fight floor
    else if (f.t === 'd') {
      const dx = x - f.x, dz = z - f.z, dd = Math.hypot(dx, dz), R = Math.max(0, f.r - inset);
      px = dd <= R ? x : f.x + (dx / (dd || 1)) * R; pz = dd <= R ? z : f.z + (dz / (dd || 1)) * R; d = Math.max(0, dd - R);
    } else {
      const s = segD(x, z, f.ax, f.az, f.bx, f.bz), W = Math.max(0, f.hw - inset);
      if (s.d <= W) { px = x; pz = z; d = 0; } else { px = s.x + ((x - s.x) / (s.d || 1)) * W; pz = s.z + ((z - s.z) / (s.d || 1)) * W; d = s.d - W; }
    }
    if (d < bd) { bd = d; best = Number.isFinite(H) ? [px, pz, f.y ?? 0] : [px, pz]; }
  }
  return best ?? [x, z];
}
// ── AUDIT EG V (lane1 #21; section 18's strata): THE MOLTEN RIM AND ITS WAYS ACROSS ───────────────────────────────────
/** The Molten Rim (section 18): the outer EG_RIM_IN_M of every Court disc wider than EG_RIM_DISC_M is magma, EG_RIM_OUT_M past its
 *  edge too; each way across it - where a course's last leap lands on the disc, a bridge or a side span meets it, a stair rises
 *  from it - keeps its edge: a gold causeway EG_RIM_WAY_PAD_M wider than its way, from EG_RIM_WAY_IN_M inside the magma's inner
 *  edge to as far past its outer one (a haven - THE HAVEN GRAMMAR, gold on what you stand on means it holds). */
export const EG_RIM_DISC_M = 8;
export const EG_RIM_IN_M = 3;
export const EG_RIM_OUT_M = 2;
export const EG_RIM_WAY_PAD_M = 1;
export const EG_RIM_WAY_IN_M = 0.5;
/**
 * THE MOLTEN RIM of Court `spec` (section 18 - "a fight hall's way in and out keeps its edge"): `{ rings, ways }` - the magma,
 * a ring stamp a disc, and the causeways over it, a lane stamp each (net/eliteGates/egShape.js stamps): for every disc of the fight floor
 * wider than EG_RIM_DISC_M, every way whose end meets its rim band - the course's landing (a step whose ground after it is the
 * disc: its `after`), a lane's end (Grath's bridges, a side span), a band's end (the Twin Lords' bridge), a stair's foot or top
 * (the Wyrm's perches' - spec law 8) - laid along the line from the disc's heart through that end, across the band and
 * EG_RIM_WAY_IN_M past it either side. The director zones them (net/eliteGates/egBrain.js - `void` and `haven`); a screen casts back on
 * the magma only off every causeway (egRimCastsBack). THE ASCENT (section 2): in a hall that judges by height (net/eliteGates/egWalkGraph.js
 * egByHeight) the rim is the disc's own floor's - a way counts only where its end stands at the disc's height (egBears: a bridge
 * passing over the rim a storey up keeps no causeway there), and each ring and way says its floor's height (`ys` - `{ rings,
 * ways }`, the zones' `y`). Pure.
 * @param {any} spec
 */
export function egMoltenRim(spec) {
  const rings = [], ways = [], ends = [], byH = egByHeight(spec), ry = [], wy = [];
  for (const q of spec?.steps ?? []) if ((q.road ?? 0) === 0 && q.after > 0 && !q.hd) ends.push([q.x, q.z + q.d / 2 + q.after, q.w / 2, q.ya ?? NaN]);   // (THE AUDIT: a turned piece's landing is its broken bridge's lane end, pushed below)
  for (const l of spec?.lanes ?? []) ends.push([l.ax, l.az, l.hw, l.y ?? 0], [l.bx, l.bz, l.hw, l.y ?? 0]);
  for (const b of spec?.bands ?? []) ends.push([b.x, b.z0, b.halfW, b.y ?? 0], [b.x, b.z1, b.halfW, b.y ?? 0]);
  for (const q of spec?.ramps ?? []) ends.push([q.ax, q.az, q.hw, q.y0], [q.bx, q.bz, q.hw, q.y1]);
  for (const f of spec?.fl ?? []) {
    if (f.t !== 'd' || !(f.r > EG_RIM_DISC_M)) continue;
    const r0 = f.r - EG_RIM_IN_M, r1 = f.r + EG_RIM_OUT_M;
    rings.push(shRing(f.x, f.z, r0, r1));
    ry.push(f.y ?? 0);
    for (const [x, z, hw, ey] of ends) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (!(d > 0) || d < r0 - EG_RIM_WAY_IN_M || d > r1 + EG_RIM_WAY_IN_M) continue;
      if (byH && !egBears(f.y ?? 0, ey)) continue;   // THE ASCENT: a way at another storey crosses no rim of this floor
      const ux = (x - f.x) / d, uz = (z - f.z) / d, a = r0 - EG_RIM_WAY_IN_M, b = r1 + EG_RIM_WAY_IN_M;
      ways.push(shLane(f.x + ux * a, f.z + uz * a, f.x + ux * b, f.z + uz * b, 2 * hw + EG_RIM_WAY_PAD_M));
      wy.push(f.y ?? 0);
    }
  }
  return byH ? { rings, ways, ys: { rings: ry, ways: wy } } : { rings, ways };
}
/** Does a screen cast a member back at (x, z) at relay ms `t` (section 18's magma - net/eliteGates/egBrain.js's zones, `void` and `haven`)?
 *  A live `void` zone holds the feet and no live `haven` does (a causeway across the Molten Rim, the Moon-Mirror's lit branch:
 *  gold on what you stand on means it holds). One law for the screens (scenes/eliteGates/egFight.js) and the pins. Pure. THE ASCENT
 *  (section 2): `y` the feet - a zone that says its floor's height (`y`, a hall that judges by height) holds only feet its floor
 *  bears (net/eliteGates/egWalkGraph.js egBears); not known, any. */
export function egRimCastsBack(zones, x, z, t, y = NaN) {
  let magma = false;
  for (const q of zones ?? []) {
    if (!(t >= q.from && t < q.until) || !egInShape(q.s, x, z)) continue;
    if (Number.isFinite(q.y) && !egBears(q.y, y)) continue;
    if (q.kind === 'haven') return false;
    if (q.kind === 'void') magma = true;
  }
  return magma;
}
/** Hall `spec`'s fight floor as a test (net/eliteGates/egFloor.js egUnionHolds' `onFloor` - EG-H1 moved it there). THE ASCENT (section 2):
 *  `y` the member's feet - in a hall that judges by height, the floor that bears them (a member's union floor is its own
 *  storey's); not known, every piece. */
export const egFloorTest = (spec, y = NaN) => (x, z) => egOnFight(spec, x, z, 0, y);
/**
 * THE ASCENT (section 2) - THE FLOORS A STAMP LANDS ON: the heights of the fight floors (`spec.fl`) whose plan holds stamp `s`'s
 * anchor within `pad` m (net/bossRef.js floorsUnder's rule - a CHECK's, every floor: null), and in a hall that judges by height
 * (net/eliteGates/egWalkGraph.js egByHeight) only those in the storey of the blow's own height `y` (egOneStorey: under EG_STACK_M from it -
 * never the floor stacked over or under it); none holding it, null (any floor of its storey). Pure.
 * @param {any} spec @param {any} s @param {number} [y] @param {number} [pad]
 */
export function egStampFloors(spec, s, y = NaN, pad = 1) {
  if (!s || s[0] === 'a' || s[0] === 'h') return null;
  const H = egFeetY(spec, y);
  const ys = (spec?.fl ?? []).filter((f) => egOneStorey(f.y ?? 0, H) && onPiece(f, s[1], s[2], pad)).map((f) => f.y ?? 0);
  return ys.length ? ys : null;
}
/** A FALLING WALL's fallen edge at `now` (section 8.3): the walkway behind it is gone - 20 s after the wake, 1.5 m/s. */
export const egWallFallenZ = (spec, wokeAt, now) => (spec.variant === 'fallingwall' && spec.walk && wokeAt > 0 ? spec.walk.z0 + Math.max(0, now - wokeAt - EG_WALL_FALL_AFTER_MS) * (EG_WALL_FALL_MPS / 1000) : -Infinity);
/** The waystone a member pushed off the walkway returns to: the nearest behind (z) - else the arrival plate. */
export const egWaystoneFor = (spec, z) => { let w = null; for (const s of spec.waystones ?? []) if (s.z <= z && (!w || s.z > w.z)) w = s; return w; };

// ── the Rampart's vents, on the relay's clock from the hall's wake ────────────────────────────────────────
/** A vent's warning and its eruption (ms) - 1.0 s told, half a second of fire. */
export const EG_VENT_WARN_MS = 1000;
export const EG_VENT_FIRE_MS = 500;
/** A vent's stroke: 20% of the struck body's health, fire. */
export const EG_VENT_PCT = 0.2;
/** Where vent `v`'s cycle stands at `now` from the hall's wake `wokeAt`: 'quiet' | 'warn' | 'fire', and the eruption
 *  this cycle is (its instant - one verdict a stroke). */
export function egVentAt(v, wokeAt, now) {
  if (!(wokeAt > 0) || now < wokeAt) return { st: 'quiet', at: 0, k: 0 };
  const t = now - wokeAt + v.phase, n = Math.floor(t / v.cycle), u = t - n * v.cycle;
  const fireAt = v.cycle - EG_VENT_FIRE_MS;
  const at = wokeAt - v.phase + n * v.cycle + fireAt;
  if (u >= fireAt) return { st: 'fire', at, k: (u - fireAt) / EG_VENT_FIRE_MS };
  if (u >= fireAt - EG_VENT_WARN_MS) return { st: 'warn', at, k: (u - (fireAt - EG_VENT_WARN_MS)) / EG_VENT_WARN_MS };
  return { st: 'quiet', at, k: 0 };
}
/** Is (x, z) in vent `v`'s lane? */
export const egInVent = (v, x, z) => Math.abs(z - v.z) <= v.d / 2 && Math.abs(x - v.x) <= v.halfW;

// ── the words ──────────────────────────────────────────────────────────────────────────────────────────────
export const EG_TEXT = Object.freeze({
  name: 'Elite Breach',
  keyName: 'Weir Key',
  keyLine: "One of the Spire's portal keys, surrendered to the Kyn in 3E 398. Use it under open sky to open an Elite Breach.",
  cold: 'The key is cold. Go online to turn it.',
  sky: 'The key wants open sky.',
  near: 'Another breach stands near.',
  held: 'You hold a breach already.',
  shut: "The Spire's road is shut. Try again soon.",
  // ── EG-F (2026-10-12; section 5): the key's refusals EG-PLAY's arm lacked (3, 4 and 8, in the page's order), the start
  // window's words, the arch's plaque - scenes/eliteGates/egArch.js, ui/eliteGates/egStartWindow.js, scenes/eliteGates/egCall.js ──
  holds: Object.freeze({ busy: 'You cannot turn the key right now.', duel: 'You cannot open a breach in a duel.', siege: 'The wards of this battle hold the key cold.',
    enemies: 'You cannot open a breach with enemies nearby.', journey: 'You cannot open a breach while you travel.' }),
  water: 'The key will not turn in the water.',
  aboard: 'The key will not turn aboard a boat.',
  within: (place) => `You cannot open a breach within ${place}.`,
  room: 'There is no room for it here.',
  startHall: 'Hall 1',
  startRedoubt: (w, band) => `Redoubt ${w} - ${band}`,
  stake: (n) => `Weir Keys: ${n}. One will be staked.`,
  without: (names) => `Go without ${names}?`,
  questDue: 'A quest falls due before the breach can close.',
  notStart: (w) => `You have not taken Redoubt ${w} this season.`,
  wager: (names) => (names ? `The Wager: ${names}` : 'The Wager: none'),
  wagerDone: 'Done',
  wagerFamily: 'The Wager takes one decree from each family.',
  wagerFull: 'The Wager takes three decrees at most.',
  plaqueSub: 'The Battlespire',
  company: (opener) => `${opener}'s company`,
  sight: 'an Elite Breach',
  // ── end EG-F ──
  rust: 'The key turns to rust.',
  noKeys: 'You hold no Weir Key.',
  guest: 'Sign in to open an Elite Breach.',
  opening: 'The Weir Key turns. The Spire answers.',
  call: (opener) => `${opener} opens an Elite Breach.`,
  answer: (left) => `Answer the call - ${left}`,
  sealed: (left) => `The breach opens in ${left}.`,
  opens: 'The breach is open. Step through.',
  late: (opener) => `The breach has closed behind ${opener}'s company.`,
  outside: (opener) => `The breach answers only to ${opener}'s company.`,
  indoors: 'Answer from open ground.',
  gather: (k, n) => `${k} of ${n} here`,
  wakes: 'The hall wakes.',
  door: 'The way down opens.',
  pulled: 'The Spire pulls you down.',
  count: (left) => `The count: ${left}`,
  torn: 'The Covenant tears the breach shut.',
  falls: (who) => `${who} falls.`,
  fallen: 'The Spire will not take you back.',
  castBack: 'The void casts you back.',
  redoubt: (w) => `Redoubt ${w}`,
  redoubtSub: (band) => band,
  rest: 'The Redoubt holds the count.',
  descend: 'The stair down opens.',
  wayHome: 'The way home',
  walkHome: 'Walk home? The Redoubts you took are kept.',
  ended: 'The breach is over.',
  rehearsal: 'Rehearse: Halls 1-5, no key',
  rehearsalDone: 'The Rehearsal is over. The Spire waits for a key.',
  noSave: 'The Spire keeps no saves.',
  noMap: 'The Spire keeps no map.',
  noRest: 'You can rest only at a Redoubt.',
  noRecall: 'The Spire holds you.',
  noCompanions: 'Your companions cannot follow you into the Spire.',
});
