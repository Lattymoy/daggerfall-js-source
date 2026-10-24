// @ts-check
// EG-FULL, LAYER THREE (2026-10-11, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11):
// THE FRAGMENTS' LAW - the law half of every modelled area a course passes through. The torn halls did not fall as
// stepping stones: they fell in fragments, and a fragment is a place with a mouth and an exit, its own floors, walls and
// ceiling, its own hazard, its own inner course, and room for the legion. One law for the relay (net/eliteGates/egLaw.js lays each
// fragment into the hall spec as it lays the hall; net/eliteGates/egBrain.js runs its engines, alcoves and niches) and every screen
// (world/eliteGates/egHall.js models it, scenes/eliteGates/egSpan.js stands its pieces, scenes/eliteGates/egFight.js draws and judges its hazards).
//
// THE TEN (section 11.2), band by band, each with its signature - the one thing it asks that no other place asks:
//   the Broken Galleries  the Oblivion Caverns (fire falls, magma surges, falling basalt), the Fallen Stacks (the
//                         cascade), the Broken Colonnade (the rolling drums);
//   the Soul Cairn        the Ossuary (bone bridges that crumble, soul-wisps), the Mist Stair (mist surges);
//   the Shade Perilous    the Gloam Thicket (moon-bound branches), the Eclipse Vault (the Eclipse);
//   the Havoc Wellhead    the Forge Gut (hammer drops, conveyors, slag that cools), the Clan Pit (the Honour Horn), the
//                         Oblivion Caverns, deep (the magma tide).
// Three classes: a PASSAGE (in place of a span section - entered at its mouth, left at its exit, a chasm in it crossed on
// its inner course), a CHAMBER (in place of a court disc - a fight floor in walls that names its `play`), a SHAFT (down).
//
// THE HAZARDS are on the shared clock (net/eliteGates/egSpanLaw.js's), each screen judging its own feet, as a span's Vent is. Every
// one keeps THE WIND-UP FLOOR and THE WIDTH RULE (net/eliteGates/egShape.js - pinned by test/net/eliteGates/egfrag_law.test.js): the surges' and
// shelves' lanes 4 m, the basalt's disc r 2.5, the hammer's r 3. NOTHING GETS FASTER: depth adds fragments, never shorter
// cycles. A fire fall is a timed traversal hazard (the place's own, like the Pendulum - judged wherever a body stands in
// it); every other aimed hazard lands on the fragment's fight floors alone.
//
// THE SET PIECES (section 11.3): one a band, each a normal law record on the shared clock - the Collapsing Tube (the
// Galleries' third circle), the Sinking Stair, the Moon Path and the Forge Line (the Brinks into the Cairn, the Shade and
// the Wellhead - section 8.9: "built from them").
//
// EG-ZC (2026-10-12, Mac: "I said I want everything"; sections 11.1, 11.2 and 11.10): THE LAST FRAGMENTS - from spec law
// EG_SLAG_LAW the Forge kit lays THE COOLING SLAG (a crossing two spouts pour in turn - net/eliteGates/egSpanLaw.js `slag`, its molten
// lanes the place's hazard), and THE SHAFTS are planned (egFragShaft): every band's way down through ledges and a Drop - the
// Caverns' throat, the Mist Stair's pit, THE HOLLOW TRUNK of the Gloam Thicket on its moon-bound branches, THE SLAG CHUTE of
// the Forge Gut onto its crusts, the deep Caverns' throat - laid as the Deepway's third fragment. And the engines as the page
// wrote them: the Sluice floods its lane EG_ENGINES.sluice.flood, the Moon-Mirror lights a branch EG_ENGINES.mirror.lit.
//
// The generator half is integer-exact (centimetres and milliseconds, the hall's own die - net/eliteGates/egLaw.js): one seed, one
// fragment, on every machine. Pure. Not a DFU member. Ledger A (ELITE-GATES).
import { shDisc, shLane, egWindupFloorMs, egWidthOk, egInShape } from './egShape.js';
import { EG_MOON_EVERY_S, EG_DRUM_MPS, EG_SPAN_RUN_MPS, EG_SLAG_TELL_S, EG_SLAG_MOLTEN_S, EG_SLAG_CRUST_S, EG_SLAG_CYCLE_S, EG_SLAG_SPOUTS } from './egSpanLaw.js';
import { EG_PEND_REACH, EG_PEND_HALF, EG_SINK_GONE_M } from './egSpanLaw.js';   // EG6c: an inner piece's travel (egFragSwept)
import { EG_SET_MARGIN, EG_HAMMER_LINE, EG_SOLVE_LAW, EG_GAP_MIN_CM, EG_GAP_MAX_CM } from './egSpanLaw.js';   // AUDIT EG V (spec law 8): the set pieces' margin, the Forge Line's hammers' one home

/** The fragment record's version (a change to a fragment's law is a relay version - section 11.5). */
export const EG_FRAG_V = 1;

/**
 * THE LIBRARY (section 11.2): each fragment's band, its classes, its name, its reverb preset (systems/reverbPresets.js),
 * its light (the band's own colour - the cap is spent on gold and on this, magma glowing by emission), its engine
 * (section 11.10) and its signature's words.
 */
export const EG_FRAGS = Object.freeze({
  caverns: Object.freeze({ band: 0, name: 'the Oblivion Caverns', classes: Object.freeze(['passage', 'chamber', 'shaft']), reverb: 'cave', light: Object.freeze([1.0, 0.45, 0.12]), engine: 'sluice', sign: 'Fire falls across the passage. Run between the burnings.' }),
  stacks: Object.freeze({ band: 0, name: 'the Fallen Stacks', classes: Object.freeze(['passage', 'chamber']), reverb: 'stoneroom', light: Object.freeze([1.0, 0.82, 0.5]), engine: 'shelf', sign: 'The shelves topple one after another. Run the gap between the falls.' }),
  colonnade: Object.freeze({ band: 0, name: 'the Broken Colonnade', classes: Object.freeze(['passage']), reverb: 'quarry', light: Object.freeze([1.0, 0.85, 0.6]), engine: null, sign: 'The drums roll along the course. Ride them.' }),
  ossuary: Object.freeze({ band: 1, name: 'the Ossuary', classes: Object.freeze(['passage', 'chamber']), reverb: 'stoneroom', light: Object.freeze([0.6, 0.75, 1.0]), engine: 'soulbell', sign: 'The bone bridges crumble underfoot. Soul-wisps drain anyone who stands still.' }),
  mist: Object.freeze({ band: 1, name: 'the Mist Stair', classes: Object.freeze(['shaft', 'passage']), reverb: 'cave', light: Object.freeze([0.7, 0.8, 0.95]), engine: null, sign: 'The mist rises. Your footing never hides.' }),
  gloam: Object.freeze({ band: 2, name: 'the Gloam Thicket', classes: Object.freeze(['passage', 'chamber', 'shaft']), reverb: 'quarry', light: Object.freeze([0.62, 0.7, 1.0]), engine: 'mirror', sign: 'The branches hold only under the moon. Follow the light.' }),
  eclipse: Object.freeze({ band: 2, name: 'the Eclipse Vault', classes: Object.freeze(['chamber']), reverb: 'stoneroom', light: Object.freeze([0.55, 0.6, 1.0]), engine: 'mirror', sign: 'The Eclipse comes. Stand in the moonlight.' }),
  forge: Object.freeze({ band: 3, name: 'the Forge Gut', classes: Object.freeze(['passage', 'chamber', 'shaft']), reverb: 'cave', light: Object.freeze([1.0, 0.5, 0.15]), engine: 'hammer', sign: 'The hammers fall where they are told. The belts carry you.' }),
  clanpit: Object.freeze({ band: 3, name: 'the Clan Pit', classes: Object.freeze(['chamber']), reverb: 'quarry', light: Object.freeze([1.0, 0.55, 0.2]), engine: null, sign: 'The Honor Horn calls one of you. Answer alone.' }),
  deep: Object.freeze({ band: 3, name: 'the Oblivion Caverns, deep', classes: Object.freeze(['passage', 'chamber', 'shaft']), reverb: 'cave', light: Object.freeze([1.0, 0.4, 0.1]), engine: 'sluice', sign: 'The magma tide rises. Take the high floors.' }),
});
/** The passages each band's spans and Deepways run through, and the chambers its yards, proving courts and Deepways
 *  stand in (section 11.2's classes). */
export const EG_PASSAGE_KITS = Object.freeze([Object.freeze(['caverns', 'stacks', 'colonnade']), Object.freeze(['ossuary', 'mist']), Object.freeze(['gloam']), Object.freeze(['forge', 'deep'])]);
export const EG_CHAMBER_KITS = Object.freeze([Object.freeze(['caverns', 'stacks']), Object.freeze(['ossuary']), Object.freeze(['gloam', 'eclipse']), Object.freeze(['forge', 'clanpit', 'deep'])]);
/** The set pieces by band (section 11.3). */
export const EG_SET_PIECES = Object.freeze(['tube', 'sinking', 'moonpath', 'forgeline']);
export const EG_SET_PIECE_NAMES = Object.freeze({ tube: 'the Collapsing Tube', sinking: 'the Sinking Stair', moonpath: 'the Moon Path', forgeline: 'the Forge Line' });
/** The pieces each fragment's inner course and each set piece lays (net/eliteGates/egSpanLaw.js's kinds - its law, its dress). */
export const EG_FRAG_PIECES = Object.freeze({
  caverns: Object.freeze(['ledge']), stacks: Object.freeze(['ledge']), colonnade: Object.freeze(['still', 'drum']), ossuary: Object.freeze(['bone']), mist: Object.freeze(['ledge']),
  gloam: Object.freeze(['moon']), forge: Object.freeze(['rail', 'slag']), deep: Object.freeze(['ledge']), sinking: Object.freeze(['sink']), moonpath: Object.freeze(['moon']), forgeline: Object.freeze(['rail']),
});
/** A chamber's play (section 11.4 - "a chamber is never a disc with walls"): a second fight floor on two stairs, a
 *  chokepoint arch, a moving hazard, an engine. */
export const EG_PLAYS = Object.freeze(['balcony', 'arch', 'surge', 'engine']);
/** A chamber's balcony (cm): its centre this far past the court's rim, its radius. */
export const EG_BALCONY_OUT_CM = 250;
export const EG_BALCONY_R_CM = 450;

/**
 * THE HAZARDS (section 11.2), each on the shared clock: its shape's kind, its tell and its live time (ms), its cycle
 * (ms), its share and element, and where it lands (`trav` anywhere a body stands in it, `fight` on the fight floors).
 * The Eclipse is a CHECK (its havens the moon-shafts); the tide floods a chamber's low floor and ticks; the mist and the
 * moonbeam are sight, never harm.
 */
export const EG_HAZARDS = Object.freeze({
  fall: Object.freeze({ tell: 1000, live: 2000, period: 5000, pct: 0.15, el: 'fire', aim: 'trav', name: 'Fire Fall' }),
  surge: Object.freeze({ tell: 1000, live: 1000, period: 8000, pct: 0.2, el: 'fire', aim: 'fight', name: 'Magma Surge' }),
  basalt: Object.freeze({ tell: 1200, live: 300, period: 7000, pct: 0.2, el: null, aim: 'fight', name: 'Falling Basalt' }),
  cascade: Object.freeze({ tell: 1200, live: 400, period: 0, every: 1500, rest: 4000, pct: 0.2, el: null, aim: 'fight', name: 'The Cascade' }),
  wisp: Object.freeze({ tell: 0, live: 4000, period: 0, pct: 0.03, el: null, aim: 'fight', name: 'Soul-Wisp', r: 3, brk: 6 }),
  mist: Object.freeze({ tell: 1000, live: 3000, period: 12000, pct: 0, el: null, aim: 'sight', name: 'Mist Surge' }),
  hammer: Object.freeze({ tell: 1400, live: 300, period: 6000, pct: 0.2, el: null, aim: 'fight', name: 'Hammer Drop' }),
  slag: Object.freeze({ tell: EG_SLAG_TELL_S * 1000, live: EG_SLAG_MOLTEN_S * 1000, period: EG_SLAG_CYCLE_S * 1000, crust: EG_SLAG_CRUST_S * 1000, pct: 0.2, el: 'fire', aim: 'fight', name: 'Slag Spill' }),   // EG-ZC: its numbers' one home is the crust's (net/eliteGates/egSpanLaw.js)
  tide: Object.freeze({ tell: 5000, live: 15000, period: 60000, pct: 0.1, el: 'fire', aim: 'fight', name: 'Magma Tide' }),
  eclipse: Object.freeze({ tell: 6000, live: 500, period: 40000, pct: 0.3, el: 'shock', aim: 'check', name: 'The Eclipse', r: 3, mps: 1.5 }),
  hammerline: Object.freeze({ tell: EG_HAMMER_LINE.tell, live: EG_HAMMER_LINE.live, period: EG_HAMMER_LINE.period, pct: 0.2, el: null, aim: 'trav', name: 'Forge Hammer' }),   // AUDIT EG V: its clock's one home is the solver's (net/eliteGates/egSpanLaw.js - spec law 8 proves the Forge Line clear of it)
});
/** The Eclipse's moon-shafts: r 3 havens walking a ring at a fixed 1.5 m/s, the nearest never more than 20 m away. */
export const EG_ECLIPSE_RING_M = 9;
/** AUDIT EG V (lane5 #9; section 11.2's "the nearest is never more than 20 m away"): the Eclipse's reach (cm) - from spec law
 *  8 (net/eliteGates/egSpanLaw.js EG_SOLVE_LAW) a code-built Eclipse chamber stands no fight floor farther from its nearest moon-shaft's edge, at the
 *  shafts' worst moment (egEclipseHolds), and lays no balcony past it (egFragChamber): its havens never cross a 9 m ring to a
 *  balcony beyond a wide Rift-Yard's rim. */
export const EG_ECLIPSE_REACH_CM = 2000;
/** Does every point within `D` cm of a code-built Eclipse chamber's centre stand within EG_ECLIPSE_REACH_CM of its nearest
 *  moon-shaft's edge, whenever the shafts stand? Three shafts a third of a turn apart on a ring of `ring` cm leave a point `D`
 *  out at most 60 degrees from one - sqrt(D^2 + ring^2 - D x ring) from its centre, the haven EG_HAZARDS.eclipse.r m in from
 *  that. Whole centimetres, squared: the law's integers. */
export const egEclipseHolds = (D, ring = EG_ECLIPSE_RING_M * 100) => {
  const reach = EG_ECLIPSE_REACH_CM + EG_HAZARDS.eclipse.r * 100;
  return D * D + ring * ring - D * ring <= reach * reach;
};
/** The Collapsing Tube (section 11.3): its fall's pace (m/s - the span build runs 5.47), its length (m), and when it
 *  begins (ms after the hall's wake - the slowest fair arrival at its mouth). */
export const EG_TUBE_MPS = 4.0;
export const EG_TUBE_LEN_CM = Object.freeze([6000, 8000]);
export const EG_TUBE_START_MS = 18_000;
/** The Battlemage's niche on a Low Road (section 11.4): it heals this share once a member, and holds a Vestige shard. */
export const EG_NICHE_HEAL = 0.15;
/** An engine (section 11.10): worked within 2 m, once in 30 s; a member caught takes the place's 20%. */
export const EG_ENGINE_REACH_M = 2;
export const EG_ENGINE_CD_MS = 30_000;
export const EG_ENGINE_PCT = 0.2;
export const EG_ENGINE_TELL_MS = 1500;
export const EG_ENGINES = Object.freeze({
  sluice: Object.freeze({ name: 'the Sluice', what: 'floods a channel for 6 s, and lesser foes caught in it lose 40% of their health', sh: 'lane', pct: 0.4, flood: 6000 }),   // EG-ZC: the channel flooded 6 s
  shelf: Object.freeze({ name: 'the Shelf', what: 'topples once onto the lesser foes', sh: 'lane', pct: 0.5, once: true }),
  soulbell: Object.freeze({ name: 'the Soul-Bell', what: 'stuns Wraiths and Binders for 4 s', sh: 'disc', pct: 0, stun: 4000 }),
  mirror: Object.freeze({ name: 'the Moon-Mirror', what: 'lights a branch for 6 s and blinds the Divers for 4 s', sh: 'disc', pct: 0, stun: 4000, lit: 6000 }),   // EG-ZC: a branch lit 6 s
  hammer: Object.freeze({ name: 'the Drop-Hammer', what: 'crushes lesser foes within 3 m, and stuns the lord once each phase', sh: 'disc', pct: 0.5, lordStun: 2000 }),
});
/** EG-ZC - THE COOLING SLAG laid (section 11.2): the spec law it is laid from (net/eliteGates/egLaw.js EG_SPEC - the law before keeps
 *  its halls byte for byte), a crust's top (cm - a spout's lane 4 m wide, THE WIDTH RULE's least, 3 m along the course),
 *  how far each spout's lane stands either side of the crossing's line (cm - the two lanes 10 cm apart), and the molten
 *  lane's reach onto the floor it pours toward (cm - where a waiting member stands aside). */
export const EG_SLAG_LAW = 5;
/** EG-PERFECT - SPEC LAW 10, THE BROKEN WAY (net/eliteGates/egAscent.js EG_BROKEN_LAW - pinned equal; this module stands below it):
 *  the spec law from which a passage's chasm is as wide as its pieces at THE ENVELOPE's gaps (egFragPassage), a chamber's
 *  balcony stands 4 m up and its alcove at its court's rim (egFragChamber) - named by the hall law (`o.law`), never the newest
 *  unnamed: a hero record's envelope is read unnamed. */
export const EG_FRAG_BROKEN_LAW = 10;
export const EG_SLAG_STEP = Object.freeze({ w: 400, d: 300 });
export const EG_SLAG_LANE_CM = 205;
export const EG_SLAG_LIP_CM = 150;
/** EG-ZC - THE SHAFTS (sections 11.1-11.2): each band's shaft kits (the Deepway's way down), their names where the page
 *  names one (the rest are their fragment's), and the pieces each lays. */
export const EG_SHAFT_KITS = Object.freeze([Object.freeze(['caverns']), Object.freeze(['mist']), Object.freeze(['gloam']), Object.freeze(['forge', 'deep'])]);
export const EG_SHAFT_NAMES = Object.freeze({ gloam: 'the Hollow Trunk', forge: 'the Slag Chute' });
export const EG_SHAFT_PIECES = Object.freeze({
  caverns: Object.freeze(['ledge', 'drop']), mist: Object.freeze(['ledge', 'drop']), gloam: Object.freeze(['moon', 'drop']), forge: Object.freeze(['ledge', 'drop', 'slag']), deep: Object.freeze(['ledge', 'drop']),
});
/** A shaft's mouth (its rim's floor, cm), its foot (the floor it lands on), a flight's fall (cm - THE ENVELOPE's step down
 *  under a metre), its Drop's (at most the Drop's 4.5 m), its headroom over its mouth (cm). */
export const EG_SHAFT_RIM_CM = 300;
export const EG_SHAFT_FOOT_CM = 300;
export const EG_SHAFT_FLIGHT_CM = 90;
export const EG_SHAFT_DROP_CM = Object.freeze([300, 450]);
export const EG_SHAFT_HEIGHT_CM = 650;
/** The spouts' lanes of a slag crossing whose crust stands `zS` to `zE` (cm, the plan's frame) about `x`, its top `y`: each
 *  spout's molten lane from the crust's near edge onto EG_SLAG_LIP_CM of the floor past it, its clock the crossing's, each
 *  spout half a cycle behind the last (net/eliteGates/egSpanLaw.js egSlagState). */
const slagLanes = (x, zS, zE, y, phase) => Array.from({ length: EG_SLAG_SPOUTS }, (_, k) => {
  const lx = x + (k === 0 ? -EG_SLAG_LANE_CM : EG_SLAG_LANE_CM);
  return { kind: 'slag', sh: [lx, zS, lx, zE + EG_SLAG_LIP_CM], w: EG_SLAG_STEP.w, y, phase: phase + (k * EG_SLAG_CYCLE_S * 1000) / EG_SLAG_SPOUTS, period: 0 };
});
/** A slag crossing's course item (net/eliteGates/egLaw.js lays it): `gap` before it, its clock's phase (ms). */
const slagItem = (gap, phase) => ({ k: 'slag', gap, x: 0, dy: 0, amp: EG_SLAG_LANE_CM, period: EG_SLAG_CYCLE_S * 1000, phase });
/** EG-ZC (section 11.10): the Moon-Mirror's reach (m - the nearest Moon branch within it is the one it lights), and the
 *  lit branch's gold ring (m - a haven over its top, THE HAVEN GRAMMAR: gold on what you stand on means it holds). */
export const EG_MIRROR_REACH_M = 30;
export const EG_MIRROR_LIT_R = 1.8;
/** An alcove's reach (m - a member within it takes what it holds, once), what one may hold. */
export const EG_ALCOVE_REACH_M = 2;
export const EG_ALCOVE_HOLDS = Object.freeze(['lumen', 'shard', 'page']);
export const EG_ALCOVE_LUMEN = 40;
/** A vignette (section 11.10 - the lore told by the halls): what each kit may set. */
export const EG_VIGNETTES = Object.freeze({
  caverns: Object.freeze(['barricade', 'staves']), stacks: Object.freeze(['barricade', 'shelf']), colonnade: Object.freeze(['staves', 'shrine']),
  ossuary: Object.freeze(['shrine', 'barricade']), mist: Object.freeze(['staves']), gloam: Object.freeze(['shrine', 'staves']), eclipse: Object.freeze(['shrine']),
  forge: Object.freeze(['rack', 'barricade']), clanpit: Object.freeze(['shrine', 'rack']), deep: Object.freeze(['barricade', 'rack']),
});

const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
/** The integer square root (Newton's - the law's integers; net/eliteGates/egRoomLaw.js egIsqrt's, this module standing below it). */
const isqrt = (n) => { const m = Math.trunc(n); if (!(m > 0)) return 0; let q = m, r = Math.trunc((q + 1) / 2); while (r < q) { q = r; r = Math.trunc((q + Math.trunc(m / q)) / 2); } return q; };
const wrapT = (t, p) => ((t % p) + p) % p;

/**
 * A FRAGMENT'S PASSAGE, PLANNED (section 11.6 - the law half; centimetres and milliseconds, its entry socket at z 0 and
 * its exit facing +Z, its floor at y 0): `{ kit, cls, halfW, height, len, zA, zB, yB, open, course, hazards, anchors,
 * alcoves, vignettes, lights, engine }` - the chasm from `zA` to `zB` crossed on `course` (each `{ k, gap, x, dy, ... }`
 * laid one after another from `zA`, the Steps' records - net/eliteGates/egLaw.js lays them), the far floor `yB` from the near one.
 * @param {string} kit @param {() => number} r the hall's stream @param {{ c?: number, deep?: number, law?: number }} [o] (EG-ZC: `law` the spec law - the newest when none)
 */
export function egFragPassage(kit, r, o = {}) {
  const F = EG_FRAGS[kit] ?? EG_FRAGS.caverns, H = EG_HAZARDS;
  /** @type {any[]} */
  const course = [], hazards = [], alcoves = [], vignettes = [], lights = [];
  const anchors = { lurker: [], caster: [], niche: [] };
  let halfW = 300, height = 520, len = 2800, chasm = 1000, yB = 0, open = 0;
  const lava = 'lava', lamp = 'band';
  // EG-PERFECT - SPEC LAW 10 (THE BROKEN WAY, `o.law` named 10 or more): THE ENVELOPE IN THE PASSAGES. The laws before spread a
  // chasm's pieces evenly over its fixed span - the Caverns', the Stacks' and the deep Caverns' ledges 1.0 m apart, the
  // Ossuary's bones 0.55 m, the Mist Stair's 0.80 m - and the real motor ran straight through five of the eight kits without
  // a jump. From spec law 10 a chasm is as wide as its pieces at a gap of THE ENVELOPE (one gap a passage, off its die -
  // EG_GAP_MIN_CM to EG_GAP_MAX_CM; the Mist Stair's four flights at the least, so its floors keep 4 m), its floors what the
  // passage's length leaves (the envelope a hero record is baked to - `len`, `halfW` - unmoved)
  const env = (n, d, lo = EG_GAP_MIN_CM, hi = EG_GAP_MAX_CM) => { if ((o.law ?? 0) >= EG_FRAG_BROKEN_LAW) chasm = n * d + (n + 1) * between(r, lo, hi); };
  /** lay `n` pieces of kind `k` across the chasm, evenly (each `d` deep), their gaps what the chasm leaves */
  const across = (k, n, d, extra = /** @type {(q: number, g: number) => any} */ ((q, g) => ({}))) => {
    const g = Math.floor((chasm - n * d) / (n + 1));
    for (let q = 0; q < n; q++) course.push({ k, gap: g, x: 0, dy: 0, ...extra(q, g) });
    return g;
  };
  if (kit === 'stacks') {
    halfW = 350; height = 600; chasm = 1000;
    env(3, 200);
    across('ledge', 3, 200, (q) => ({ x: (q % 2 === 0 ? -1 : 1) * 80 }));
    // THE CASCADE: shelves topple across each floor one after another (lanes 4 m deep, told 1.2 s, 1.5 s apart)
    const zA0 = Math.floor((len - chasm) / 2);
    hazards.push({ kind: 'cascade', lanes: [[-halfW, 250, halfW, 250], [-halfW, zA0 - 250, halfW, zA0 - 250]].map((q) => [...q]), w: 400, y: 0, phase: between(r, 0, 29) * 100 });
    hazards.push({ kind: 'cascade', lanes: [[-halfW, zA0 + chasm + 250, halfW, zA0 + chasm + 250], [-halfW, len - 250, halfW, len - 250]].map((q) => [...q]), w: 400, y: 0, phase: between(r, 0, 29) * 100 });
    lights.push([0, 300, 400, lamp], [0, 300, len - 400, lamp]);
  } else if (kit === 'colonnade') {
    // toppled across the void: no walls, no vault - drums as steps, arches to run along; THE ROLLING DRUMS ride as Rails
    halfW = 250; height = 0; open = 1; chasm = 1400;
    const g = 320, amp = 150, period = Math.trunc((4 * amp * 1000) / (EG_DRUM_MPS * 100));
    course.push({ k: 'still', gap: 260, x: 0, dy: 0 });
    course.push({ k: 'drum', gap: g, x: 0, dy: 0, amp: Math.min(amp, g - 40), period, phase: between(r, 0, 9) * 100 });
    course.push({ k: 'drum', gap: g, x: 0, dy: 0, amp: Math.min(amp, g - 40), period, phase: between(r, 0, 9) * 100 + 1500 });
    chasm = 260 + 260 + 2 * (g + 300) + 260;
    lights.push([0, 250, 300, lamp], [0, 250, len - 300, lamp]);
  } else if (kit === 'ossuary') {
    halfW = 300; height = 560; chasm = 1000;
    env(3, 260);
    across('bone', 3, 260);
    // SOUL-WISPS drifting a fixed path over each floor: a member within 3 m on a fight floor is drained (the Wraith's
    // drain) until 6 m apart or 4 s
    const zA0 = Math.floor((len - chasm) / 2);
    hazards.push({ kind: 'wisp', path: [0, Math.floor(zA0 / 2), halfW - 100, Math.floor(zA0 / 2) - 150], y: 120, period: 9000, phase: between(r, 0, 89) * 100 });
    hazards.push({ kind: 'wisp', path: [0, zA0 + chasm + Math.floor((len - zA0 - chasm) / 2), halfW - 100, 150], y: 120, period: 11000, phase: between(r, 0, 109) * 100 });
    lights.push([0, 260, 300, lamp], [0, 260, len - 300, lamp]);
  } else if (kit === 'mist') {
    // THE MIST STAIR: stairs wound down a pit of mist - each flight under a metre down (THE ENVELOPE)
    halfW = 300; height = 700; chasm = 1200;
    env(4, 200, EG_GAP_MIN_CM, EG_GAP_MIN_CM);
    let y = 0;
    const g = Math.floor((chasm - 4 * 200) / 5);
    for (let q = 0; q < 4; q++) { y -= 90; course.push({ k: 'ledge', gap: g, x: (q % 2 === 0 ? -1 : 1) * 70, dy: -90 }); }
    yB = y;
    hazards.push({ kind: 'mist', y: yB - 300, phase: between(r, 0, 119) * 100 });
    lights.push([0, 300, 300, lamp], [0, 300 + yB, len - 300, lamp]);
  } else if (kit === 'gloam') {
    // MOON-BOUND BRANCHES: solid while the walking moonbeam lies on them (net/eliteGates/egSpanLaw.js - the Beat's law, driven)
    halfW = 350; height = 650; chasm = 1300;
    const n = 4, d = 220, g = Math.floor((chasm - n * d) / (n + 1));
    const zA0 = Math.floor((len - chasm) / 2), period = EG_MOON_EVERY_S * 1000, phase = between(r, 0, period / 100 - 1) * 100;
    for (let q = 0; q < n; q++) course.push({ k: 'moon', gap: g, x: (q % 2 === 0 ? -1 : 1) * 60, dy: 0, amp: 0, period, phase, beat: zA0 });
    lights.push([0, 400, zA0 + Math.floor(chasm / 2), 'moon']);
  } else if (kit === 'forge') {
    // THE FORGE GUT: conveyors (Rails) across the chasm; hammer drops on the floors; EG-ZC: from EG_SLAG_LAW THE COOLING SLAG
    // - the chasm's last stretch crossed only on a crust its two spouts pour in turn, left onto the far floor (the walls wider
    // for the spouts' two lanes, the passage longer by the crust, so its floors and hammers stand where they stood)
    const slag = (o.law ?? Infinity) >= EG_SLAG_LAW;
    halfW = slag ? 420 : 350; height = 650; chasm = 1300; len = slag ? len + EG_SLAG_STEP.d : len;
    const g = 320;
    // (EG-PERFECT - SPEC LAW 10: its two conveyors one belt - one period, one phase - never through each other; law 9's met in
    // 88 of 135 Guts)
    if ((o.law ?? 0) >= EG_FRAG_BROKEN_LAW) { const P = between(r, 60, 80) * 100, ph = between(r, 0, 9) * 100; for (let q = 0; q < 2; q++) course.push({ k: 'rail', gap: g, x: 0, dy: 0, amp: 200, period: P, phase: ph }); }
    else {
      course.push({ k: 'rail', gap: g, x: 0, dy: 0, amp: 200, period: between(r, 60, 80) * 100, phase: between(r, 0, 9) * 100 });
      course.push({ k: 'rail', gap: g, x: 0, dy: 0, amp: 200, period: between(r, 60, 80) * 100, phase: between(r, 0, 9) * 100 + 2000 });
    }
    chasm = 3 * g + 2 * 300;
    if (slag) {
      const ph = between(r, 0, 199) * 100;
      course.push(slagItem(g, ph));
      chasm += EG_SLAG_STEP.d;
      const zE = Math.floor((len - chasm) / 2) + chasm;
      hazards.push(...slagLanes(0, zE - EG_SLAG_STEP.d, zE, 0, ph));
    }
    const zA0 = Math.floor((len - chasm) / 2);
    hazards.push({ kind: 'hammer', spots: [[-100, 300], [150, 650], [-50, zA0 - 250]], r: 300, y: 0, phase: between(r, 0, 59) * 100 });
    hazards.push({ kind: 'hammer', spots: [[100, zA0 + chasm + 300], [-150, len - 650], [50, len - 300]], r: 300, y: 0, phase: between(r, 0, 59) * 100 });
    lights.push([0, 200, 300, lava], [0, 200, len - 300, lava]);
  } else if (kit === 'deep') {
    // THE OBLIVION CAVERNS, DEEP: wider, brighter, the magma higher - the Caverns' falls and surges, more of them
    halfW = 400; height = 600; chasm = 1000;
    env(3, 200);
    across('ledge', 3, 200, (q) => ({ x: (q % 2 === 0 ? -1 : 1) * 90 }));
    const zA0 = Math.floor((len - chasm) / 2);
    hazards.push({ kind: 'fall', sh: [-halfW, zA0 - 120, halfW, zA0 - 120], w: 120, y: 0, phase: between(r, 0, 49) * 100 });
    hazards.push({ kind: 'fall', sh: [-halfW, zA0 + chasm + 120, halfW, zA0 + chasm + 120], w: 120, y: 0, phase: between(r, 0, 49) * 100 });
    hazards.push({ kind: 'surge', sh: [-200, 150, -200, zA0 - 300], w: 400, y: 0, phase: between(r, 0, 79) * 100 });
    hazards.push({ kind: 'surge', sh: [200, zA0 + chasm + 300, 200, len - 150], w: 400, y: 0, phase: between(r, 0, 79) * 100 });
    lights.push([0, 160, 300, lava], [0, 160, zA0 - 120, lava], [0, 160, len - 300, lava]);
  } else {
    // THE OBLIVION CAVERNS: a lava tube - its fire fall at the chasm's lip, a surge along the far floor, basalt falling on
    // the near one
    env(3, 200);
    const zA0 = Math.floor((len - chasm) / 2);
    across('ledge', 3, 200, (q) => ({ x: (q % 2 === 0 ? -1 : 1) * 60 }));
    hazards.push({ kind: 'fall', sh: [-halfW, zA0 - 120, halfW, zA0 - 120], w: 120, y: 0, phase: between(r, 0, 49) * 100 });
    hazards.push({ kind: 'surge', sh: [-100, zA0 + chasm + 150, -100, len - 150], w: 400, y: 0, phase: between(r, 0, 79) * 100 });
    hazards.push({ kind: 'basalt', spots: [[100, 300], [-100, 650]], r: 250, y: 0, phase: between(r, 0, 69) * 100 });
    lights.push([0, 160, 300, lava], [0, 160, zA0 - 120, lava], [0, 160, len - 300, lava]);
  }
  const zA = Math.floor((len - chasm) / 2), zB = zA + chasm;
  // THE LEGION'S PLACES (section 11.7): Lurkers wait in the walls' shadow on each floor
  anchors.lurker.push([halfW - 80, Math.floor(zA / 2)], [-(halfW - 80), zB + Math.floor((len - zB) / 2)]);
  // ALCOVES (section 11.10): zero to two - behind a false wall (one blow; a gold seam within 4 m)
  const nAlc = (o.deep ?? 0) > 0 ? between(r, 0, 2) : between(r, 0, 1);
  if (!open) for (let q = 0; q < nAlc; q++) {
    const side = q % 2 === 0 ? 1 : -1, z = q === 0 ? Math.floor(zA / 2) + 100 : zB + Math.floor((len - zB) / 2) - 100;
    alcoves.push({ seal: 'seam', side, x: side * (halfW + 120), z, y: q === 0 ? 0 : yB, holds: pick(r, EG_ALCOVE_HOLDS) });
  }
  // VIGNETTES: one to three - the lore told by the halls
  const vs = EG_VIGNETTES[kit] ?? EG_VIGNETTES.caverns;
  for (let q = 0, n = between(r, 1, 2); q < n; q++) vignettes.push({ t: vs[q % vs.length], x: (q % 2 === 0 ? -1 : 1) * (halfW - 90), z: q === 0 ? 200 : len - 200, y: q === 0 ? 0 : yB, yaw: q % 2 === 0 ? 90 : 270 });
  return { kit, cls: 'passage', name: F.name, halfW, height, len, zA, zB, yB, open, course, hazards, anchors, alcoves, vignettes, lights, reverb: F.reverb, engine: null };
}

/**
 * EG-ZC - A SHAFT, PLANNED (sections 11.1-11.2: the class that goes "down through ledges and drops", the Deepway's way down;
 * centimetres and milliseconds, its rim at z 0 and y 0, its foot facing +Z): `{ kit, cls, name, halfW, height, len, zA, zB,
 * yB, open, course, hazards, anchors, alcoves, vignettes, lights, reverb, engine }` - its rim (0 to `zA`), three or four
 * flights down (three in the Slag Chute) (each EG_SHAFT_FLIGHT_CM - THE ENVELOPE's step down under a metre), its Drop (EG_SHAFT_DROP_CM, onto the Drop's
 * walled landing), and its foot (`zB` to `len`, `yB` under the rim). Blows land on none of it - its floors are traversal
 * ground - and its walls run down past its foot. By kit:
 *   the Oblivion Caverns (and deep)  basalt flights down a lava tube's throat, a fire fall across its rim;
 *   the Mist Stair                   flights wound down a pit of mist, the mist surging under its foot;
 *   THE HOLLOW TRUNK (the Gloam)     black-glass branches down a hollow trunk open to the moon, solid while the beam walking
 *                                    down it lies on them (the Moon's law);
 *   THE SLAG CHUTE (the Forge)       iron ledges down a chute, its Drop, then a slag crossing its two spouts pour, left onto
 *                                    the foot (net/eliteGates/egSpanLaw.js `slag`).
 * Proven by THE TIMED SOLVER with the hall, its own crossing inside EG_SHAFT_MAX_S (net/eliteGates/egSpanLaw.js egSpanProof).
 * @param {string} kit @param {() => number} r the hall's stream
 */
export function egFragShaft(kit, r) {
  const F = EG_FRAGS[kit] ?? EG_FRAGS.caverns, moon = kit === 'gloam';
  /** @type {any[]} */
  const course = [], hazards = [], lights = [];
  const halfW = kit === 'forge' ? 420 : kit === 'deep' ? 450 : 400, zA = EG_SHAFT_RIM_CM, n = kit === 'forge' ? 3 : between(r, 3, 4);   // the Chute's crust takes a flight's room: a Deepway stays inside EG_HALL_LEN_MAX
  const period = EG_MOON_EVERY_S * 1000, mph = moon ? between(r, 0, period / 100 - 1) * 100 : 0;
  let y = 0, run = 0;
  for (let q = 0; q < n; q++) {
    const side = q % 2 === 0 ? -1 : 1;
    y -= EG_SHAFT_FLIGHT_CM;
    if (moon) { const gap = between(r, 180, 240); course.push({ k: 'moon', gap, x: side * 60, dy: -EG_SHAFT_FLIGHT_CM, amp: 0, period, phase: mph, beat: zA }); run += gap + 220; }
    else { const gap = between(r, 240, 280); course.push({ k: 'ledge', gap, x: side * between(r, 7, 10) * 10, dy: -EG_SHAFT_FLIGHT_CM }); run += gap + 200; }
  }
  const fall = between(r, EG_SHAFT_DROP_CM[0] / 10, EG_SHAFT_DROP_CM[1] / 10) * 10, dg = between(r, 240, 280);
  y -= fall;
  course.push({ k: 'drop', gap: dg, x: 0, dy: -fall });
  run += dg + 600;
  if (kit === 'forge') {
    // THE SLAG CHUTE's crossing: from its Drop's landing over the chute's last gap onto the foot, on its spouts' crusts
    const ph = between(r, 0, 199) * 100, sg = between(r, 240, 280);
    course.push(slagItem(sg, ph));
    run += sg + EG_SLAG_STEP.d;
    hazards.push(...slagLanes(0, zA + run - EG_SLAG_STEP.d, zA + run, y, ph));
  }
  const zB = zA + run, len = zB + EG_SHAFT_FOOT_CM, yB = y;
  if (kit === 'caverns' || kit === 'deep') hazards.push({ kind: 'fall', sh: [-halfW, zA - 120, halfW, zA - 120], w: 120, y: 0, phase: between(r, 0, 49) * 100 });
  else if (kit === 'mist') hazards.push({ kind: 'mist', y: yB - 300, phase: between(r, 0, 119) * 100 });
  const glow = moon ? 'moon' : kit === 'mist' ? 'band' : 'lava';
  lights.push([0, 300, Math.floor(zA / 2), glow], [0, yB + 300, zB + Math.floor(EG_SHAFT_FOOT_CM / 2), glow]);
  return { kit, cls: 'shaft', name: EG_SHAFT_NAMES[kit] ?? F.name, halfW, height: EG_SHAFT_HEIGHT_CM, len, zA, zB, yB, open: 0, course, hazards, anchors: {}, alcoves: [], vignettes: [], lights, reverb: F.reverb, engine: null };
}

/**
 * A SET PIECE, PLANNED (section 11.3; centimetres and milliseconds, its mouth at z 0): `{ kind, name, len, course,
 * hazards, open, halfW, height, yB, tube }` - the course laid from the mouth, each piece the Steps' record; `tube` the
 * Collapsing Tube's fall (its start, ms after the wake, and its pace).
 * @param {string} kind @param {() => number} r @param {{ short?: boolean, law?: number }} [o] `short` the Tube at its least (a span
 *  that carries its decrees' sections too - the hall stays under its length)
 */
export function egSetPiece(kind, r, o = {}) {
  /** @type {any[]} */
  const course = [], hazards = [];
  if (kind === 'tube') {
    // THE COLLAPSING TUBE: the vault falls behind the company at a fixed 4.0 m/s for 60-80 m, ending on the burning sky
    const len = between(r, EG_TUBE_LEN_CM[0] / 100, (o.short ? EG_TUBE_LEN_CM[0] : EG_TUBE_LEN_CM[1]) / 100) * 100;
    return { kind, name: EG_SET_PIECE_NAMES.tube, len, course, hazards, open: 0, halfW: 300, height: 520, yB: 0, tube: { start: EG_TUBE_START_MS, mps: EG_TUBE_MPS } };
  }
  if (kind === 'sinking') {
    // THE SINKING STAIR: each flight sinks into the mist at 0.5 m/s after a foot (net/eliteGates/egSpanLaw.js `sink`)
    let y = 0;
    for (let q = 0; q < 6; q++) { y -= 60; course.push({ k: 'sink', gap: between(r, 240, 280), x: (q % 2 === 0 ? -1 : 1) * 40, dy: -60 }); }
    hazards.push({ kind: 'mist', y: y - 300, phase: between(r, 0, 119) * 100 });
    return { kind, name: EG_SET_PIECE_NAMES.sinking, len: 0, course, hazards, open: 1, halfW: 0, height: 0, yB: y, tube: null };
  }
  if (kind === 'moonpath') {
    // THE MOON PATH: the beams walk the Thicket at 2.5 m/s and the branches stand only under them - follow the light
    const n = 6, period = EG_MOON_EVERY_S * 1000, phase = between(r, 0, period / 100 - 1) * 100;
    for (let q = 0; q < n; q++) course.push({ k: 'moon', gap: between(r, 140, 200), x: (q % 2 === 0 ? -1 : 1) * 50, dy: 0, amp: 0, period, phase, beatRel: 0 });
    return { kind, name: EG_SET_PIECE_NAMES.moonpath, len: 0, course, hazards, open: 1, halfW: 0, height: 0, yB: 0, tube: null };
  }
  // THE FORGE LINE: three conveyors through hammer drops into the forge's mouth. AUDIT EG V (lane5 #6) - from spec law 8 they
  // stand THE ENVELOPE's least gap apart, so each conveyor's window keeps the set piece's margin (a conveyor 3.2 m out closes on
  // the leap half its cycle: waits of 3.5-4 s, past EG_WAIT_MAX / EG_SET_MARGIN)
  const g = (o.law ?? 0) >= EG_SOLVE_LAW ? EG_GAP_MIN_CM : 320;
  // EG-PERFECT - SPEC LAW 10 (THE BROKEN WAY): one line - the three conveyors on one belt's period and phase, their travels
  // together, never through each other (law 9's, each its own period, met in 78 of 80 lines; its hammers the line's danger)
  if ((o.law ?? 0) >= EG_FRAG_BROKEN_LAW) { const P = between(r, 60, 80) * 100, ph = between(r, 0, 9) * 100; for (let q = 0; q < 3; q++) course.push({ k: 'rail', gap: g, x: 0, dy: 0, amp: 200, period: P, phase: ph, hammer: 1 }); }
  else for (let q = 0; q < 3; q++) course.push({ k: 'rail', gap: g, x: 0, dy: 0, amp: 200, period: between(r, 60, 80) * 100, phase: q * 2000 + between(r, 0, 9) * 100, hammer: 1 });
  return { kind: 'forgeline', name: EG_SET_PIECE_NAMES.forgeline, len: 0, course, hazards, open: 1, halfW: 0, height: 0, yB: 0, tube: null };
}

/**
 * A FRAGMENT'S CHAMBER, PLANNED (section 11.4; centimetres, about the chamber's centre at (0, 0), its floor r `R`):
 * `{ kit, cls, play, hazards, floors, ramps, arch, engine, anchors, alcoves, vignettes, lights, wall }` - its play (a second
 * fight floor 3-4 m up on two stairs where Casters stand, a chokepoint arch 6 m wide, the channels surging in thirds every
 * 20 s, an engine), its kit's signature over that.
 * AUDIT EG V (lane5 #9) - from spec law 8 (`o.law`): an Eclipse chamber whose balcony would stand past its
 * havens' reach (egEclipseHolds - a Rift-Yard's court of 20 m and more) takes the arch in the balcony's place.
 * @param {string} kit @param {() => number} r @param {number} R @param {{ play?: string, law?: number }} [o]
 */
export function egFragChamber(kit, r, R, o = {}) {
  const F = EG_FRAGS[kit] ?? EG_FRAGS.caverns;
  /** @type {any[]} */
  const hazards = [], floors = [], ramps = [], alcoves = [], vignettes = [], lights = [];
  const anchors = { caster: [], lurker: [], rift: [] };
  let play = o.play ?? pick(r, kit === 'stacks' ? ['balcony'] : kit === 'deep' ? ['balcony'] : EG_PLAYS);
  if (kit === 'deep') play = 'balcony';   // the tide's two dry floors are its balconies
  if (kit === 'eclipse' && play === 'balcony' && (o.law ?? 0) >= EG_SOLVE_LAW && !egEclipseHolds(R + EG_BALCONY_OUT_CM + EG_BALCONY_R_CM)) play = 'arch';
  let arch = null, engine = null;
  /** `n` second floors `up` high at the chamber's rim, evenly round from its +x side (bearings 90, 270; or 90, 210, 330 -
   *  sines and cosines times 10,000, the law's integers), each with its stair - a ramp from the floor up to its rim. */
  const BEAR = [[[10000, 0]], [[10000, 0], [-10000, 0]], [[10000, 0], [-5000, -8660], [-5000, 8660]]];
  // EG-PERFECT - SPEC LAW 10 (THE BROKEN WAY, `o.law` named): a balcony 4 m up and more - the court under its overhang a body's
  // height and a floor below it (THE ASCENT's stacking, section 2; law 9's stood 2.5-4 m over the court's rim), its stair from
  // 9.5 m in so it climbs no steeper than three in five; and an alcove at the court's rim, its false wall in the ring there
  // (law 9's stood 2.5-4 m past the rim, behind the ring's wall - out of every reach)
  const L10 = (o.law ?? 0) >= EG_FRAG_BROKEN_LAW;
  const balconies = (n, up) => {
    for (const [sn, cs] of BEAR[n - 1]) {
      const at = (rr) => [Math.trunc((rr * sn) / 10000), Math.trunc((rr * cs) / 10000)];
      const [bx, bz] = at(R + EG_BALCONY_OUT_CM), br = EG_BALCONY_R_CM;
      floors.push({ x: bx, z: bz, r: br, y: up, fight: 1 });
      const [x0, z0] = at(L10 ? R - 950 : R - 750), [x1, z1] = at(R - 200);
      ramps.push({ ax: x0, az: z0, bx: x1, bz: z1, hw: 150, y0: 0, y1: up });
      anchors.caster.push([bx, bz]);
    }
  };
  // the Fallen Stacks' broken dome its two balconies; the deep tide's three dry floors (no point of the low floor more
  // than 24 m from a stair: 24/6.975 + 1.5 = 4.95 s, inside its 5 s tell)
  if (play === 'balcony') balconies(kit === 'stacks' ? 2 : kit === 'deep' ? 3 : 1, kit === 'deep' ? (L10 ? 400 : 250) : between(r, L10 ? 40 : 30, L10 ? 45 : 40) * 10);
  else if (play === 'arch') arch = { z: 0, w: 600, h: 650 };
  else if (play === 'surge') {
    // the channels surge across the floor in thirds every 20 s (lanes 4 m wide)
    for (let k = 0; k < 3; k++) hazards.push({ kind: 'surge', sh: [-R, Math.floor(((k - 1) * R * 2) / 3), R, Math.floor(((k - 1) * R * 2) / 3)], w: 400, y: 0, phase: k * 6000, period: 20000 });
  } else if (F.engine) engine = { kind: F.engine, x: 0, z: Math.floor(R / 2) };
  else play = 'arch', arch = { z: 0, w: 600, h: 650 };
  // the kit's signature on its floor
  if (kit === 'caverns') hazards.push({ kind: 'basalt', spots: [[Math.floor(R / 3), Math.floor(R / 3)], [-Math.floor(R / 3), -Math.floor(R / 4)], [0, -Math.floor(R / 2)]], r: 250, y: 0, phase: between(r, 0, 69) * 100 });
  else if (kit === 'ossuary') hazards.push({ kind: 'wisp', path: [0, 0, R - 300, R - 300], y: 120, period: 14000, phase: between(r, 0, 139) * 100 });
  else if (kit === 'forge') hazards.push({ kind: 'hammer', spots: [[Math.floor(R / 2), 0], [-Math.floor(R / 2), Math.floor(R / 3)], [0, -Math.floor(R / 2)]], r: 300, y: 0, phase: between(r, 0, 59) * 100 });
  else if (kit === 'eclipse') hazards.push({ kind: 'eclipse', ring: EG_ECLIPSE_RING_M * 100, y: 0, phase: between(r, 0, 399) * 100 });
  else if (kit === 'deep') hazards.push({ kind: 'tide', r: R, y: 0, phase: between(r, 0, 599) * 100 });
  else if (kit === 'stacks') engine ??= { kind: 'shelf', x: 0, z: -Math.floor(R / 2) };
  else if (kit === 'gloam') engine ??= { kind: 'mirror', x: 0, z: -Math.floor(R / 2) };
  // rifts set in the walls (section 11.4) and Lurkers in their shadow
  // (sin, cos) of 60, 180 and 300 degrees times 10,000 - the law decides in integers (net/eliteGates/egLaw.js)
  for (const [sn, cs] of [[8660, 5000], [0, -10000], [-8660, 5000]]) anchors.lurker.push([Math.trunc(((R - 150) * sn) / 10000), Math.trunc(((R - 150) * cs) / 10000)]);
  if (between(r, 0, 1)) { const side = between(r, 0, 1) ? 1 : -1, z = -Math.floor(R / 3); alcoves.push({ seal: 'seam', side, x: side * (L10 ? isqrt(R * R - z * z) + 120 : R + 280), z, y: 0, holds: pick(r, EG_ALCOVE_HOLDS) }); }
  const vs = EG_VIGNETTES[kit] ?? EG_VIGNETTES.caverns;
  vignettes.push({ t: vs[0], x: -Math.floor(R * 0.7), z: Math.floor(R * 0.55), y: 0, yaw: 135 });
  lights.push([0, 500, 0, kit === 'eclipse' || kit === 'gloam' ? 'moon' : kit === 'caverns' || kit === 'forge' || kit === 'deep' || kit === 'clanpit' ? 'lava' : 'band']);
  return { kit, cls: 'chamber', name: F.name, play, hazards, floors, ramps, arch, engine, anchors, alcoves, vignettes, lights, reverb: F.reverb, horn: kit === 'clanpit' ? 1 : 0 };
}

/** A circle's set piece (section 11.3: one a band, at most one a circle): the Brink into a band carries the band's own;
 *  the Galleries' first span from its third circle (`tubeC` - net/eliteGates/egLaw.js egTubeCircle) carries the Collapsing Tube.
 *  Null where none. */
export function egSetPieceOf(c, kind, band, tubeC = 3) {
  if (kind === 'brink' && band >= 1) return EG_SET_PIECES[band];
  if (band === 0 && c === tubeC && kind === 'span') return 'tube';
  return null;
}

// ── the shared clock: where a hazard stands and what it does ──────────────────────────────────────────────────────

/** A hazard's stamp at its place (metres; net/eliteGates/egShape.js's stamps): a lane `['l', ax, az, bx, bz, w]`, a disc `['d', x,
 *  z, r]`. */
const laneSh = (q, w) => shLane(q[0], q[1], q[2], q[3], w);
/**
 * A HAZARD'S PARTS AT `t` (shared seconds; the hazard as the spec says it - metres and seconds, the hall's frame):
 * `[{ sh, st, k, key, pct, el, aim }]` - each part's stamp, its state (`tell` its ring closing, `live` it bites), how far
 * through its tell (0 to 1), and the key a screen judges it under once (a burning, a fall, a tick). Quiet parts are left
 * out.
 * @param {any} hz @param {number} t
 * @returns {{ sh: any[], st: 'tell'|'live', k: number, key: string, pct: number, el: string|null, aim: string }[]}
 */
export function egHazardParts(hz, t) {
  const L = EG_HAZARDS[hz.kind];
  if (!L) return [];
  const out = [], ms = t * 1000, ph = (hz.phase ?? 0) * 1000;
  const cyc = (period, tell, live) => {
    const u = wrapT(ms + ph, period), n = Math.floor((ms + ph) / period);
    if (u >= period - live) return { st: 'live', k: 1, n, u };
    if (u >= period - live - tell) return { st: 'tell', k: (u - (period - live - tell)) / tell, n, u };
    return null;
  };
  const part = (sh, c, key) => out.push({ sh, st: c.st, k: c.k, key, pct: L.pct, el: L.el, aim: L.aim });
  const period = (hz.period ?? 0) > 0 ? hz.period * 1000 : L.period;
  if (hz.kind === 'cascade') {
    // the shelves topple one after another: shelf j told from j x `every` into the cycle, then falling
    const lanes = hz.lanes ?? [], P = lanes.length * L.every + L.rest, u = wrapT(ms + ph, P), n = Math.floor((ms + ph) / P);
    for (let j = 0; j < lanes.length; j++) {
      const s0 = j * L.every;
      if (u >= s0 && u < s0 + L.tell) part(laneSh(lanes[j], hz.w), { st: 'tell', k: (u - s0) / L.tell }, `${hz.i}:${j}:${n}`);
      else if (u >= s0 + L.tell && u < s0 + L.tell + L.live) part(laneSh(lanes[j], hz.w), { st: 'live', k: 1 }, `${hz.i}:${j}:${n}`);
    }
    return out;
  }
  if (hz.kind === 'wisp') {
    const p = egWispAt(hz, t);
    out.push({ sh: shDisc(p[0], p[1], L.r), st: 'live', k: 1, key: `${hz.i}`, pct: L.pct, el: L.el, aim: L.aim });
    return out;
  }
  if (hz.kind === 'eclipse') {
    const c = cyc(period, L.tell, L.live);
    if (c) { const hv = egEclipseShafts(hz, t); part(['h', ...hv.flatMap((q) => [q[0], q[1], L.r])], c, `${hz.i}:${c.n}`); }
    return out;
  }
  if (hz.kind === 'tide') {
    const c = cyc(period, L.tell, L.live);
    if (c) part(shDisc(hz.x, hz.z, hz.r), c, c.st === 'live' ? `${hz.i}:${c.n}:${Math.floor((c.u - (period - L.live)) / 1000)}` : `${hz.i}:${c.n}`);
    return out;
  }
  if (hz.kind === 'slag') {
    // told, then molten for its live time, then a crust for `crust` (the crust is a step's - net/eliteGates/egSpanLaw.js `slag`)
    const u = wrapT(ms + ph, period), n = Math.floor((ms + ph) / period);
    if (u < L.tell) part(laneSh(hz.sh, hz.w), { st: 'tell', k: u / L.tell }, `${hz.i}:${n}`);
    else if (u < L.tell + L.live) part(laneSh(hz.sh, hz.w), { st: 'live', k: 1 }, `${hz.i}:${n}:${Math.floor((u - L.tell) / 1000)}`);
    return out;
  }
  const c = cyc(period, L.tell, L.live);
  if (!c) return out;
  if (hz.spots?.length) { const s = hz.spots[c.n % hz.spots.length]; part(shDisc(s[0], s[1], hz.r), c, `${hz.i}:${c.n}`); }
  else if (hz.sh) part(laneSh(hz.sh, hz.w), c, `${hz.i}:${c.n}`);
  return out;
}
/** Is a body at (x, z), its feet `y`, bitten by a live part of hazard `hz` (its height within the hazard's band)? */
export function egHazardBites(hz, part, x, y, z) {
  if (part.st !== 'live' || !(part.pct > 0)) return false;
  if (hz.kind !== 'eclipse' && Math.abs(y - (hz.y ?? 0)) > (hz.kind === 'fall' ? 2.5 : 1.5)) return false;
  return egInShape(part.sh, x, z);
}
/** A soul-wisp's place at `t`: its path's centre `[x, z]` swung `ax` across and `az` along over its period (m). */
export function egWispAt(hz, t) {
  const [cx, cz, ax, az] = hz.path, w = (2 * Math.PI * (t + (hz.phase ?? 0))) / (hz.period || 10);
  return [cx + ax * Math.sin(w), cz + az * Math.sin(2 * w)];
}
/** The Eclipse's moon-shafts at `t`: three r 3 havens walking a ring of EG_ECLIPSE_RING_M at a fixed 1.5 m/s. */
export function egEclipseShafts(hz, t) {
  const R = hz.ring ?? EG_ECLIPSE_RING_M, w = EG_HAZARDS.eclipse.mps / R;
  return [0, 1, 2].map((k) => [hz.x + R * Math.sin(t * w + (k * 2 * Math.PI) / 3), hz.z + R * Math.cos(t * w + (k * 2 * Math.PI) / 3)]);
}
/** A mist surge's line at `t`: how high the mist stands over its floor (m, 0 when it lies low) - sight only, never footing. */
export function egMistAt(hz, t) {
  const L = EG_HAZARDS.mist, u = wrapT(t * 1000 + (hz.phase ?? 0) * 1000, L.period);
  if (u < L.tell) return 3 * (u / L.tell);
  if (u < L.tell + L.live) return 3;
  if (u < 2 * L.tell + L.live) return 3 * (1 - (u - L.tell - L.live) / L.tell);
  return 0;
}
/** THE COLLAPSING TUBE's fallen edge (m along the hall) at `wokeMs` + `ms` - -Infinity before it begins. */
export function egTubeEdge(tube, sinceWakeMs) {
  if (!tube || sinceWakeMs < tube.start * 1000) return -Infinity;
  return tube.z0 + tube.mps * (sinceWakeMs / 1000 - tube.start);
}
/** Can THE SPAN BUILD outrun the Collapsing Tube with its 25% margin (section 11.3 - net/eliteGates/egSpanLaw.js EG_SET_MARGIN; AUDIT EG V:
 *  from spec law 8 THE TIMED SOLVER refuses a tube that cannot, egSpanProof)? */
export const egTubeFair = (tube) => !!tube && EG_SPAN_RUN_MPS >= EG_SET_MARGIN * tube.mps;

/**
 * THE HAZARD LAW (section 11.2's last paragraph): every aimed part a hazard can say keeps THE WIDTH RULE and its tell
 * THE WIND-UP FLOOR - `{ ok, why }`.
 * @param {any} hz the hazard as the spec says it (metres)
 */
export function egHazardLawful(hz) {
  const L = EG_HAZARDS[hz.kind], why = [];
  if (!L) return { ok: false, why: [`${hz.kind}: no such hazard`] };
  if (L.aim === 'fight' && hz.kind !== 'wisp' && hz.kind !== 'tide') {
    const shapes = hz.kind === 'cascade' ? (hz.lanes ?? []).map((q) => laneSh(q, hz.w)) : hz.spots?.length ? hz.spots.map((s) => shDisc(s[0], s[1], hz.r)) : hz.sh ? [laneSh(hz.sh, hz.w)] : [];
    for (const sh of shapes) {
      if (!egWidthOk(sh)) why.push(`${hz.kind}: narrower than 4 m`);
      if (L.tell < egWindupFloorMs(sh)) why.push(`${hz.kind}: told ${L.tell} ms under its floor ${egWindupFloorMs(sh)} ms`);
    }
  }
  return { ok: why.length === 0, why };
}

// ── EG6c: A BAKED FRAGMENT'S RECORD (section 11.5), READ ─────────────────────────────────────────────────────────────
// EG6c (2026-10-12, sections 10.5, 11.5 and 11.6 - "Authored hero fragments ... modelled in Blender"): the record an
// AUTHORED fragment's bake writes (tools/fragBake.mjs - the named markers of Mac's scene baked to the law half), and the
// reader every holder of one keeps it to: the bake before it writes, the registry at its import (net/eliteGates/egHeroFrags.js), the
// laying when one is laid. Section 11.5's record in whole centimetres and milliseconds, in the fragment's own frame - the
// foot of its mouth at the origin, its exits toward +Z, y up:
//   { v, id, kit, band, class, variant, play, sockets: { in: { x, y, z, yaw, w, h }, out: [...] }, floors: [{ y, poly,
//     fight }], ramps: [{ poly, y0, y1 }] (a slope's corners each `[x, y, z]`, at its own height), open: [[floor, edge]],
//     ceil: [{ y, poly }] or null (open to the sky), graph: { nodes: [[x, y, z, r]], edges: [[a, b]] }, anchors: { rift,
//     caster, lurker, niche, engine, hazard } (each `[[x, y, z], ...]`), hazards: [{ kind, x, y, z, w, r, ring, period,
//     phase, sh, spots, lanes, path }] (the spec's own fields, in the shape its kind is said in - EG_HAZARD_SHAPES; the
//     wind-up, the share and the element are the kind's law, EG_HAZARDS, never copied into a record that could disagree),
//     course: [{ kind, x, y, z, w, d, amp, period, phase, beat, gap, after }] (the Steps' records), alcoves: [{ x, y, z,
//     seal, side, holds }], proof: { crossFast, crossSlow, moves }, cost: { tris, collider, lights, draws }, reverb,
//     lights: [[x, y, z, kind]], box: [x0, y0, z0, x1, y1, z1] }
// THE CEILING CLAMP (sections 10.5, 11.7 and 11.8): a floor stands wholly under a ceiling or wholly open to the sky (the
// clamp extrudes each floor to ONE ceiling), that ceiling at least its class's EG_FRAG_HEADROOM_CM over it; a ramp keeps a
// passage's headroom; and the ceiling over every inner piece keeps THE FAST BUILD's flight from it clear (4.5 m - its
// 2.68 m apex and the capsule's 1.8 m, section 11.8), so the clamp never cuts a proven flight short.
// VOLUMES STAND APART (section 11.5): `box` holds every drawn vertex, every marker and every inner piece's travel - the
// reader refuses a record whose law stands outside it - so a laying that keeps boxes EG_FRAG_APART_CM apart (egFragApart)
// keeps the whole fragment apart. Its mouth is the box's -Z face and its exits its +Z face: the course meets it there.
// Integer-exact, no transcendental (test/net/eliteGates/eg6c_law.test.js sweeps this section).

/** Section 11.5: a fragment's box plus this (cm) is disjoint from every other volume of its hall. */
export const EG_FRAG_APART_CM = 200;
/** Section 11.8: the headroom (cm) a class keeps over its floors - a passage 3.5 m, a chamber 6 m, a shaft a passage's -
 *  and over an inner course (`course`) the fast build's apex and the capsule, 4.5 m. */
export const EG_FRAG_HEADROOM_CM = Object.freeze({ passage: 350, chamber: 600, shaft: 350, course: 450 });
/** How far (cm) a socket may stand off its face of the box. */
export const EG_FRAG_SOCKET_TOL_CM = 10;
/** A graph node stands on a floor within this (cm) of its height. */
export const EG_FRAG_NODE_ON_CM = 50;
/** Section 11.9's starting bounds for one fragment: drawn triangles, collider triangles, lights, draws. */
export const EG_FRAG_BUDGET = Object.freeze({ tris: 12000, collider: 3000, lights: 4, draws: 12 });
/** The legion's places a fragment names (section 11.5's `anchors`), its lights' kinds (world/eliteGates/egHall.js egCircleLights: the
 *  kit's own colour, the lava's, the moon's) and its alcoves' seals (section 11.10: a false wall, an optional hard jump). */
export const EG_FRAG_ANCHORS = Object.freeze(['rift', 'caster', 'lurker', 'niche', 'engine', 'hazard']);
export const EG_FRAG_LIGHTS = Object.freeze(['band', 'lava', 'moon']);
export const EG_FRAG_SEALS = Object.freeze(['seam', 'jump']);
/** The shape each hazard kind is said in (the generator's own: a fire fall's, a surge's and a spill's lane `sh`; the
 *  basalt's, the hammers' and the Forge Line's `spots`; the cascade's `lanes`; a wisp's `path`; the mist's line alone; the
 *  tide's disc and the Eclipse's `ring` about their `x, z`). */
export const EG_HAZARD_SHAPES = Object.freeze({ fall: 'sh', surge: 'sh', slag: 'sh', basalt: 'spots', hammer: 'spots', hammerline: 'spots', cascade: 'lanes', wisp: 'path', mist: 'level', tide: 'disc', eclipse: 'ring' });

/** Twice polygon `poly`'s signed area ([[x, z], ...] - positive when it winds counter-clockwise, x right and z up). */
export function egFragArea2(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a;
}
/** Does polygon `poly` ([[x, z], ...]) hold (x, z) - its edges and corners its own? */
export function egFragInPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1];
    if ((bx - ax) * (z - az) - (bz - az) * (x - ax) === 0 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && z >= Math.min(az, bz) && z <= Math.max(az, bz)) return true;
    if ((az > z) !== (bz > z) && x < ax + ((bx - ax) * (z - az)) / (bz - az)) inside = !inside;
  }
  return inside;
}
/** THE CEILING OVER (x, z) above a height `y`: the lowest of the record's ceilings over it standing higher, or null - open
 *  to the sky (the motor's arena ring's `ceilAbove`, section 11.7). */
export function egFragCeilAt(rec, x, z, y) {
  let best = null;
  for (const c of rec.ceil ?? []) if (c.y > y && (best === null || c.y < best) && egFragInPoly(c.poly, x, z)) best = c.y;
  return best;
}
/** VOLUMES STAND APART (section 11.5): are boxes `a` and `b` ([x0, y0, z0, x1, y1, z1], cm) at least `margin` apart? */
export const egFragApart = (a, b, margin = EG_FRAG_APART_CM) =>
  a[3] + margin <= b[0] || b[3] + margin <= a[0] || a[4] + margin <= b[1] || b[4] + margin <= a[1] || a[5] + margin <= b[2] || b[5] + margin <= a[2];
/** A record's box laid with its origin at (x, y, z) (cm). */
export const egFragBoxAt = (rec, x, y, z) => [rec.box[0] + x, rec.box[1] + y, rec.box[2] + z, rec.box[3] + x, rec.box[4] + y, rec.box[5] + z];
/** An inner piece's swept box (cm): its top over its travel - a Drift's and a spill's across, a Rail's and a Drum's along,
 *  a Pendulum's weight over the gap before it, a Sink's fall. */
export function egFragSwept(c) {
  const ax = c.kind === 'drift' || c.kind === 'slag' ? c.amp : c.kind === 'pend' ? Math.round((EG_PEND_REACH + EG_PEND_HALF) * 100) : 0;
  const az = c.kind === 'rail' || c.kind === 'drum' ? c.amp : 0;
  return [c.x - c.w / 2 - ax, c.y - (c.kind === 'sink' ? EG_SINK_GONE_M * 100 : 0), c.z - c.d / 2 - az - (c.kind === 'pend' ? c.gap : 0), c.x + c.w / 2 + ax, c.y, c.z + c.d / 2 + az];
}
/** A hazard's extent in plan (cm, `[x0, z0, x1, z1]`), or null for the mist's line. */
export function egFragHazardPlan(h) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const take = (x, z, r) => { box[0] = Math.min(box[0], x - r); box[1] = Math.min(box[1], z - r); box[2] = Math.max(box[2], x + r); box[3] = Math.max(box[3], z + r); };
  if (h.sh) { take(h.sh[0], h.sh[1], h.w / 2); take(h.sh[2], h.sh[3], h.w / 2); }
  for (const s of h.spots ?? []) take(s[0], s[1], h.r);
  for (const q of h.lanes ?? []) { take(q[0], q[1], h.w / 2); take(q[2], q[3], h.w / 2); }
  if (h.path) { take(h.path[0] - h.path[2], h.path[1] - h.path[3], 0); take(h.path[0] + h.path[2], h.path[1] + h.path[3], 0); }
  if (h.kind === 'tide') take(h.x, h.z, h.r);
  if (h.kind === 'eclipse') take(h.x, h.z, h.ring + EG_HAZARDS.eclipse.r * 100);
  return box[0] === Infinity ? null : box;
}
/** A record's inner course as a hall spec's steps (metres and seconds - net/eliteGates/egLaw.js's own conversion: a Moon's `beat` the
 *  beams' origin along the hall), laid with the fragment's origin at (x0, y0, z0) (m); the solver's input (section 10.5). */
export function egFragSteps(rec, x0 = 0, y0 = 0, z0 = 0) {
  return (rec.course ?? []).map((c, i) => ({ i, kind: c.kind, span: 0, x: x0 + c.x / 100, y: y0 + c.y / 100, z: z0 + c.z / 100, w: c.w / 100, d: c.d / 100, amp: c.amp / 100, period: c.period / 1000, phase: c.phase / 1000,
    beat: c.kind === 'moon' ? z0 + c.beat / 100 : c.beat / 1000, gap: c.gap / 100, road: 0, kit: rec.kit, after: c.after / 100 }));
}
/** A record's hazards as a hall spec's (metres and seconds, net/eliteGates/egLaw.js's fields), laid with the fragment's origin at
 *  (x0, y0, z0) (m): what egHazardParts and egHazardLawful read. */
export function egFragHazards(rec, x0 = 0, y0 = 0, z0 = 0) {
  const at = (p) => [x0 + p[0] / 100, z0 + p[1] / 100];
  return (rec.hazards ?? []).map((h, i) => ({ kind: h.kind, i, x: x0 + h.x / 100, z: z0 + h.z / 100, y: y0 + h.y / 100, period: h.period / 1000, phase: h.phase / 1000, w: h.w / 100, r: h.r / 100, ring: h.ring / 100,
    sh: h.sh ? [...at([h.sh[0], h.sh[1]]), ...at([h.sh[2], h.sh[3]])] : null, spots: h.spots ? h.spots.map(at) : null,
    lanes: h.lanes ? h.lanes.map((q) => [...at([q[0], q[1]]), ...at([q[2], q[3]])]) : null, path: h.path ? [...at([h.path[0], h.path[1]]), h.path[2] / 100, h.path[3] / 100] : null }));
}

/**
 * THE READER: what is wrong with fragment record `rec` (section 11.5), in words - none when it is sound. Every number
 * whole; its kit's band, class and reverb; a chamber's play; its sockets on the faces of its box; its floors, ramps and
 * open edges; THE CEILING CLAMP; its walk graph on its ground; its anchors, hazards (each said in its kind's shape, and
 * lawful - THE WIDTH RULE and THE WIND-UP FLOOR, egHazardLawful), course, alcoves and lights; everything inside its box
 * (VOLUMES STAND APART); its cost inside the budget; its proof. Pure.
 * @param {any} rec @returns {string[]}
 */
export function egFragRecordFault(rec) {
  if (!rec || rec.v !== EG_FRAG_V) return [`not a fragment record of version ${EG_FRAG_V}`];
  /** @type {string[]} */
  const why = [];
  const whole = (v, at) => {
    if (typeof v === 'number') { if (!Number.isInteger(v)) why.push(`${at}: ${v} is not whole`); } else if (Array.isArray(v)) v.forEach((x, i) => whole(x, `${at}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) whole(x, `${at}.${k}`);
  };
  whole(rec, 'record');
  const F = EG_FRAGS[rec.kit];
  if (!F) why.push(`kit ${rec.kit}: no such fragment`);
  else {
    if (rec.band !== F.band) why.push(`band ${rec.band}: ${rec.kit} is band ${F.band}'s`);
    if (!F.classes.includes(rec.class)) why.push(`class ${rec.class}: ${rec.kit} is ${F.classes.join(', ')}`);
    if (rec.reverb !== F.reverb) why.push(`reverb ${rec.reverb}: ${rec.kit}'s is ${F.reverb}`);
  }
  if (!Array.isArray(rec.play) || rec.play.some((p) => !EG_PLAYS.includes(p))) why.push(`play ${JSON.stringify(rec.play)}: not among ${EG_PLAYS.join(', ')}`);
  else if (rec.class === 'chamber' && !rec.play.length) why.push('a chamber names its play (section 11.4 - never a disc with walls)');
  const B = rec.box;
  if (!Array.isArray(B) || B.length !== 6 || !(B[0] < B[3] && B[1] < B[4] && B[2] < B[5])) return [...why, 'box: not a volume'];
  const holds = (x, y, z, at) => { if (x < B[0] || x > B[3] || y < B[1] || y > B[4] || z < B[2] || z > B[5]) why.push(`${at} stands outside the fragment's box`); };
  // ── the sockets: the mouth at the origin on the box's -Z face, each exit on its +Z face
  const S = rec.sockets ?? {};
  if (!S.in || S.in.x !== 0 || S.in.y !== 0 || S.in.z !== 0 || S.in.yaw !== 180) why.push('sockets.in: the mouth stands at the origin facing -Z');
  if (B[2] < -EG_FRAG_SOCKET_TOL_CM) why.push(`the mouth is not the box's -Z face (the box runs ${-B[2]} cm behind it)`);
  if (!Array.isArray(S.out) || !S.out.length) why.push('sockets.out: no exit');
  for (const [k, o] of (S.out ?? []).entries()) {
    if (o.yaw !== 0) why.push(`sockets.out[${k}]: an exit faces +Z`);
    if (Math.abs(o.z - B[5]) > EG_FRAG_SOCKET_TOL_CM) why.push(`sockets.out[${k}]: not on the box's +Z face (${B[5] - o.z} cm short of it)`);
  }
  for (const [k, o] of [['in', S.in], ...(S.out ?? []).map((o, i) => [`out[${i}]`, o])]) {
    if (!o) continue;
    if (!(o.w > 0) || !(o.h >= EG_FRAG_HEADROOM_CM.passage)) why.push(`sockets.${k}: ${o.w} by ${o.h} cm - an opening at least ${EG_FRAG_HEADROOM_CM.passage} cm high (no fragment asks for a crouch)`);
    holds(o.x - o.w / 2, o.y, o.z, `sockets.${k}`); holds(o.x + o.w / 2, o.y + o.h, o.z, `sockets.${k}`);
  }
  // ── the floors, the ramps, the open edges
  const floors = rec.floors ?? [], ramps = rec.ramps ?? [];
  if (!floors.length) why.push('no floor');
  if (rec.class === 'chamber' && !floors.some((f) => f.fight)) why.push('a chamber with no fight floor');
  for (const [i, f] of floors.entries()) {
    if (!(f.poly?.length >= 3) || !(egFragArea2(f.poly) > 0)) why.push(`floors[${i}]: not a counter-clockwise polygon`);
    for (const p of f.poly ?? []) holds(p[0], f.y, p[1], `floors[${i}]`);
  }
  for (const [i, q] of ramps.entries()) {
    if (!(q.poly?.length >= 3) || !(egFragArea2(q.poly.map((p) => [p[0], p[2]])) > 0)) why.push(`ramps[${i}]: not a counter-clockwise polygon`);
    else if (!(q.y1 > q.y0) || Math.min(...q.poly.map((p) => p[1])) !== q.y0 || Math.max(...q.poly.map((p) => p[1])) !== q.y1) why.push(`ramps[${i}]: rises from ${q.y0} to ${q.y1} over corners that say otherwise`);
    for (const p of q.poly ?? []) holds(p[0], p[1], p[2], `ramps[${i}]`);
  }
  for (const [i, oe] of (rec.open ?? []).entries()) if (!floors[oe[0]] || !(oe[1] >= 0 && oe[1] < floors[oe[0]].poly.length)) why.push(`open[${i}]: floor ${oe[0]} has no edge ${oe[1]}`);
  // ── THE CEILING CLAMP
  for (const c of rec.ceil ?? []) { if (!(c.poly?.length >= 3) || !(egFragArea2(c.poly) > 0)) why.push('a ceiling is not a counter-clockwise polygon'); for (const p of c.poly ?? []) holds(p[0], c.y, p[1], 'a ceiling'); }
  const room = EG_FRAG_HEADROOM_CM[rec.class] ?? EG_FRAG_HEADROOM_CM.passage;
  for (const [i, f] of floors.entries()) {
    const n = f.poly?.length ?? 0, pts = [];
    for (let k = 0; k < n; k++) { const p = f.poly[k], q = f.poly[(k + 1) % n]; pts.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); }
    const over = pts.map((p) => egFragCeilAt(rec, p[0], p[1], f.y)), under = over.filter((c) => c !== null);
    if (under.length && under.length < over.length) why.push(`floors[${i}] stands half under a ceiling - a floor is clamped to one ceiling or open to the sky`);
    else if (under.length && Math.min(...under) - f.y < room) why.push(`floors[${i}]: ${Math.min(...under) - f.y} cm of headroom where a ${rec.class} keeps ${room}`);
  }
  for (const [i, q] of ramps.entries()) for (const p of q.poly ?? []) {
    const c = egFragCeilAt(rec, p[0], p[2], p[1]);
    if (c !== null && c - p[1] < EG_FRAG_HEADROOM_CM.passage) { why.push(`ramps[${i}]: ${c - p[1]} cm of headroom at a corner, under ${EG_FRAG_HEADROOM_CM.passage}`); break; }
  }
  for (const [i, c] of (rec.course ?? []).entries()) {
    const s = egFragSwept(c), low = [[s[0], s[2]], [s[3], s[2]], [s[3], s[5]], [s[0], s[5]], [c.x, c.z]].map((p) => egFragCeilAt(rec, p[0], p[1], c.y)).filter((y) => y !== null);
    if (low.length && Math.min(...low) - c.y < EG_FRAG_HEADROOM_CM.course) why.push(`course[${i}] (${c.kind}): the ceiling ${Math.min(...low) - c.y} cm over its top - the clamp would cut a proven flight short (sections 10.5, 11.8)`);
  }
  // ── the walk graph: its nodes on the ground, its edges between them
  const nodes = rec.graph?.nodes ?? [], edges = rec.graph?.edges ?? [];
  for (const [i, nd] of nodes.entries()) {
    const [x, y, z, r] = nd;
    if (!(r > 0)) why.push(`graph.nodes[${i}]: no reach`);
    const on = floors.some((f) => Math.abs(y - f.y) <= EG_FRAG_NODE_ON_CM && egFragInPoly(f.poly, x, z)) || ramps.some((q) => egFragInPoly(q.poly.map((p) => [p[0], p[2]]), x, z) && y >= q.y0 - EG_FRAG_NODE_ON_CM && y <= q.y1 + EG_FRAG_NODE_ON_CM);
    if (!on) why.push(`graph.nodes[${i}] stands on no floor and no ramp - the legion walks the ground (section 11.7)`);
    holds(x, y, z, `graph.nodes[${i}]`);
  }
  const seen = new Set();
  for (const [i, e] of edges.entries()) {
    if (!(e[0] < e[1]) || !nodes[e[0]] || !nodes[e[1]]) why.push(`graph.edges[${i}]: ${JSON.stringify(e)} is not two nodes, lowest first`);
    else if (seen.has(`${e[0]}:${e[1]}`)) why.push(`graph.edges[${i}]: twice`);
    seen.add(`${e[0]}:${e[1]}`);
  }
  // ── the legion's places, the hazards, the course, the alcoves, the lights
  for (const [k, list] of Object.entries(rec.anchors ?? {})) {
    if (!EG_FRAG_ANCHORS.includes(k)) why.push(`anchors.${k}: no such place`);
    for (const p of list) holds(p[0], p[1], p[2], `anchors.${k}`);
  }
  const laid = egFragHazards(rec);
  for (const [i, h] of (rec.hazards ?? []).entries()) {
    const shape = EG_HAZARD_SHAPES[h.kind];
    if (!shape) { why.push(`hazards[${i}]: no hazard ${h.kind}`); continue; }
    const says = { sh: !!h.sh, spots: !!h.spots?.length, lanes: !!h.lanes?.length, path: !!h.path };
    if (Object.entries(says).some(([k, v]) => v !== (k === shape)) || (shape === 'disc' && !(h.r > 0)) || (shape === 'ring' && !(h.ring > 0))) why.push(`hazards[${i}] (${h.kind}): not said as its ${shape}`);
    const L = egHazardLawful(laid[i]);
    if (!L.ok) why.push(`hazards[${i}]: ${L.why.join(', ')}`);
    const plan = egFragHazardPlan(h);
    if (plan) { holds(plan[0], h.y, plan[1], `hazards[${i}] (${h.kind})`); holds(plan[2], h.y, plan[3], `hazards[${i}] (${h.kind})`); } else holds(B[0], h.y, B[2], `hazards[${i}] (${h.kind})`);
  }
  let edge = -Infinity;
  for (const [i, c] of (rec.course ?? []).entries()) {
    if (!(c.w > 0 && c.d > 0) || !(c.gap >= 0) || !(c.after >= 0)) why.push(`course[${i}] (${c.kind}): its size, gap or ground after it`);
    if (c.z - c.d / 2 < edge) why.push(`course[${i}] (${c.kind}): stands over the piece before it - the course runs along +Z`);
    edge = c.z + c.d / 2;
    const s = egFragSwept(c);
    holds(s[0], s[1], s[2], `course[${i}] (${c.kind})`); holds(s[3], s[4], s[5], `course[${i}] (${c.kind})`);
  }
  for (const [i, a] of (rec.alcoves ?? []).entries()) {
    if (!EG_FRAG_SEALS.includes(a.seal) || !EG_ALCOVE_HOLDS.includes(a.holds) || (a.side !== 1 && a.side !== -1)) why.push(`alcoves[${i}]: a ${a.seal} seal holding ${a.holds} on side ${a.side}`);
    holds(a.x, a.y, a.z, `alcoves[${i}]`);
  }
  for (const [i, l] of (rec.lights ?? []).entries()) {
    if (!EG_FRAG_LIGHTS.includes(l[3])) why.push(`lights[${i}]: no light ${l[3]}`);
    holds(l[0], l[1], l[2], `lights[${i}]`);
  }
  // ── the cost (section 11.9) and the proof (section 10.5)
  for (const [k, max] of Object.entries(EG_FRAG_BUDGET)) if (!(rec.cost?.[k] >= 0) || rec.cost[k] > max) why.push(`cost.${k}: ${rec.cost?.[k]} past the fragment's budget of ${max}`);
  if (rec.cost && rec.cost.lights !== (rec.lights ?? []).length) why.push(`cost.lights: ${rec.cost.lights} where it carries ${(rec.lights ?? []).length}`);
  const P = rec.proof;
  if (!P || !(P.moves >= 0) || !(P.crossFast >= 0) || !(P.crossSlow >= P.crossFast) || (P.moves === 0) !== !(rec.course ?? []).length) why.push(`proof: ${JSON.stringify(P)} is not a crossing's bounds`);
  return why;
}
