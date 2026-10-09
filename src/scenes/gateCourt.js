// @ts-check
// WB4 (2026-09-25, Mac: "a large boss arena with an oversized enemy with telegraphed attacks (like wind ups, etc)"):
// THE FIGHT IN THE COURT, ON THIS SCREEN - the boss's body where the relay says he stands, doing what it says he is
// doing, three times a Daedra Lord's size; his glow; the telegraph of the attack he is winding up; his voice at the
// word, at the landing, at a phase and at his fall; the bar over the screen; and THE PLAYER'S OWN SIDE of every attack -
// the landing tested against this player's feet, and the blow taken through the host's own door. Design:
// bible/11-Multiplayer/World-Bosses.md section 5.
//
// ONE SOURCE: the court's link (net/gateLink.js - the relay's words, folded). Nothing here is sent: a strike's verdict
// is this machine's own (co-op's law - "an enemy's strike on a client is applied by that client", net/gateStrike.js),
// and it lands through `strike` - the dungeon context's door (hurt, flash, cry), the same as any foe's blow.
//
// THE PARTS, each pure where it can be: the look (world/gateBoss.js bossAct/bossFrame/bossGlow/BOSS_CUES), the ground
// (render/gateTelegraph.js telegraphShape and its pass), the verdict (net/gateStrike.js strikeVerdict), the bar
// (ui/gateBossBar.js bossBarModel). This file is their driver: it holds the sprite's texture and batch, the attacks it
// has already cued, landed and judged, and the host's doors.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, COURT_CENTRE, COURTS, COURT_R, HIT_KINDS, POOL_TICK_MS, PHASE_NAMES, profileOf, nearestCourt, windupOf, CRYSTAL_R, CRYSTAL_H, inCourt, POSE_SLACK, RECKON_CLOSE_MS, WALKS, walkFormed, HOST_BLOWS, hostBlowUnder } from '../net/gateBrain.js';
import { strikeVerdict, blowOf, strikeDamage, savedShare, landingPools, poolUnder, inAttack, chargeHead, segmentDistance } from '../net/gateStrike.js';
import { GATE_BOSSES, gateBossOf } from '../net/gateLaw.js';
import { bossAct, bossFrame, bossGlow, bossPlace, bossHop, bossLookOf, bossStandIn, bossCue, BOSS_CUES, BOSS_STRIDE_M, GROWL_EVERY_MS, HURT_GAP_MS, HURT_SHARE, QUAKE_ON, THUD_AT_MS, WARD_COLOR, EMBER_COLOR, poolColor, emberColor, attackColor, crystalStandIn, crystalColor, groundStepCue, hostPulseColor, gateHitFlash, GATE_FLASH_SHARE, RELEASE_LEAD_MS, landShake, LANDING_LIGHT_Y, CORPSE_SCALE, WAKE_LEAD_MS, LOW_HEALTH } from '../world/gateBoss.js';
import { courtToDungeon, portalDoor, PORTAL_AFTER_MS, PORTAL_RISE_MS, PORTAL_DROP, COURT_TEXT } from '../world/gateArena.js';
import { GateTelegraphRenderer, telegraphShape, markShape, poolShapes, telegraphEdge, TELEGRAPH_STYLE, TELEGRAPH_EDGE, TELEGRAPH_NOW_MS } from '../render/gateTelegraph.js';
import { CourtCrystalRenderer, crystalGrowth, CRYSTAL_GROW_MS, CRYSTAL_SHATTER_MS, CRYSTAL_FLASH_MS, CRYSTALS_DRAW_MAX } from '../render/courtCrystals.js';   // WB9c: the crystals of Oblivion, drawn
import { GateFxRenderer, fxBurstOf, meteorFall, FX_BURST_MS, FX_BURSTS_MAX, FX_KINDS, FX_LIGHT_MS } from '../render/gateFx.js';   // WB9e: his blows seen landing
import { setBatchHitFlash } from '../systems/hitFlash.js';   // WB13d: his body struck flashes, as every foe's does
import { tierColour } from '../render/spoilsGlow.js';   // WB9f: a piece's landing sparks in its tier's colour
import { RARITIES } from '../systems/lootRarity.js';
import { GatePassRenderer, gateSpinRate } from '../render/gatePass.js';   // WBX2: the portal's fire is the gate's own
import { gateArchProfile } from '../world/gateModel.js';
import { ONLINE_MINUTES_PER_MS, GATE_HEAL_ROWS_MAX, GATE_HEAL_WIRE_MAX } from '../net/wire.js';   // WBX7: a soul trap's rounds on the shared world's clock; GATE-HEAL: the heal word's bounds
import { spoilsLevel } from './spoilsPool.js';   // AUDIT WBX S2: the spoils never rolled past the level the fight admitted
import { bossBarModel, drawGateBossBar, BOSS_BAR_TEXT } from '../ui/gateBossBar.js';
import { titleCardModel, drawGateTitleCard, TITLE_HOLD_MS } from '../ui/gateTitleCard.js';   // WB13e: the fight's beats, large
import { marksCardModel, drawGateMarksCard } from '../ui/gateMarksView.js';   // WB9a: the night's marks over the screen as a fighter steps in
import { groundViewModel, drawGateGround } from '../ui/gateGroundView.js';   // WB9d: his ground and his element, felt
import { damageChartModel, drawGateDamageChart } from '../ui/gateDamageChart.js';   // GATE-UX: every challenger's damage, ranked, once he has fallen
import { readReceipt } from '../net/gateReceipt.js';
import { createGateHost } from './gateHost.js';   // WB11c: the Legion-Lord's host - its bodies, blows, words and sounds
import { createPopulationLane } from '../characters/npcBodies.js'; import { creatureLook } from '../characters/creatureBodies.js'; import { rosterActor } from '../characters/rosterBodies.js';   // MWNPC10: the court's creatures in their Morrowind bodies
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize, billboardSize } from '../world/rmbFlats.js';

/** The words a strike says that the hurt itself does not; and the fall's, to a player the receipt never came for.
 *  WB13b: the event and stop - "Frost Nova resisted." */
export const COURT_STRIKE_TEXT = Object.freeze({
  resisted: (name) => `${name} resisted.`,   // WB8b: its name under his aspect - "Frost Nova"
  noSpoils: () => 'No spoils. Your part in the fight was too small.',
  // WBX3 (Swololo on Discord: "loot was not distributed, was instantly pillaged by others"): said at the burst - every
  // fighter's spoils are their own, on their own screen, and nobody else can see or take them
  spilled: () => 'Your spoils spill across the floor.',
  // AUDIT WB12d (D20): a receipt of the faithful's rite alone spills its one ember
  spilledRite: () => 'Your ember from the broken rite falls to the floor.',
  burning: 'burning ground',
});
/** WBX5: THE TURN OF A PHASE, as he leaps into the court's heart - each phase by its name (net/gateBrain.js PHASE_NAMES)
 *  and what it asks. WB13e (2026-10-01, Mac: "AAA grade polish"): a title card (ui/gateTitleCard.js) - its numeral, its
 *  name, and its one order under it until he lands (WB9b/c: the turn crosses to the next court); nothing said beside it. */
export const PHASE_NUMERALS = Object.freeze(['I', 'II', 'III']);
export const courtPhaseOrder = (n) => (n === 2 ? 'Follow him over the walkway.' : n === 3 ? 'Follow him to the last court.' : null);
export const courtPhaseCard = (n) => { const sub = courtPhaseOrder(n); return sub ? { kicker: PHASE_NUMERALS[n - 1], main: PHASE_NAMES[n - 1], sub } : null; };
/** WB13e: DAGON'S WRATH, said - a minute out (WRATH_WARN_AT_MS, said only while news), and as it gathers. */
export const COURT_WRATH_TEXT = Object.freeze({ minute: "Dagon's Wrath in 1:00. Bring him down!", windup: "Dagon's Wrath!" });
export const WRATH_WARN_AT_MS = 60_000;
/** WB13e: A LINE OVER THE MIDDLE OF THE SCREEN STANDS FOR ITS LENGTH (DFU's label stood 1.5 s whatever it said) - its
 *  words at COURT_READ_WPS a second, between COURT_READ_S. Pure. */
export const COURT_READ_WPS = 3.5;
export const COURT_READ_S = Object.freeze([1.5, 6]);
export const courtSaySeconds = (text) => Math.max(COURT_READ_S[0], Math.min(COURT_READ_S[1], String(text ?? '').split(/\s+/).filter(Boolean).length / COURT_READ_WPS));
/** WB13e: a phase's turn - his roar comes this long after the bound's bark (they were one sound over the other). */
export const ROAR_AFTER_MS = 600;
/** WB13e: HIS FALL, AN EVENT - at the kill a burst of Dagon's own size, the court's light white for FALL_FLASH_MS and the
 *  camera shaken FALL_SHAKE; as his body meets the floor (world/gateBoss.js THUD_AT_MS) a column of embers, COLUMN_BURSTS
 *  bursts COLUMN_STEP_MS apart; over his spoils the card, FALL_CARD_MS. His wake is said only this late into it. */
export const FALL_FLASH_MS = 400;
export const FALL_SHAKE = 4;
export const COLUMN_BURSTS = 3;
export const COLUMN_STEP_MS = 250;
export const FALL_CARD_MS = 3000;
export const WAKE_LATE_MS = 1000;
/** WB13e: under his low health (world/gateBoss.js LOW_HEALTH) an ember's spark is shed this often. */
export const SPUTTER_EVERY_MS = 500;
/** WB13e: the Wrath gathering - the court reddening over its wind-up, then white at its landing (FALL_FLASH_MS): its light
 *  this high over his court's heart, this far. */
export const WRATH_LIGHT_Y = 6;
export const WRATH_LIGHT_RANGE = 60;
const WHITE = Object.freeze([1, 0.96, 0.9]), WRATH_RED = Object.freeze([1, 0.08, 0.04]);
/** WB9c (2026-09-30, Mac: "a detailed wipe mechanic on the final phase that should require players to destroy oblivion
 *  crystaline formations ... which then stuns his wipe mechanic"): DAGON'S RECKONING, said - its call (how many crystals
 *  there are to break), each crystal broken (by whom, and how many stand), and the Reckoning broken (he is stunned). */
export const COURT_RECKON_TEXT = Object.freeze({
  call: (n) => `Dagon's Reckoning! Shatter all ${n} crystals!`,   // WB13b: the bar counts it down
  shattered: (who, left) => (left > 0 ? `${who || 'A challenger'} shatters a crystal. ${left} ${left === 1 ? 'remains' : 'remain'}.` : `${who || 'A challenger'} shatters the last crystal!`),
  broken: () => 'The Reckoning breaks! Strike now!',   // the bar says "Stunned - 5s"
});
/** WB9c: a crystal's word, or the stun's, heard later than this after it happened is neither said nor sounded
 *  (FED_LATE_MS's law - heard live, never a stale one). */
export const RECKON_LATE_MS = 2000;
/** WB9c: a crystal is a target once it has grown this far out of the stone; each standing one lights the floor about it
 *  (its light's reach, m, and its heart's height). */
export const CRYSTAL_STRIKE_GROWN = 0.5;
export const CRYSTAL_LIGHT_RANGE = 9;
export const CRYSTAL_LIGHT_Y = 1.6;
/** WB8c: a Soul-Hungry Warden's feeding on a fallen challenger - by their name (the relay's `fed`), or none it may say.
 *  WB13b: the line his marks were said in as a fighter stepped in is gone - the marks' card stands at that moment. */
export const COURT_MARKS_TEXT = Object.freeze({
  // AUDIT PRE-MERGE 0929 W1-3: the beat's feedings, every name - "on Ann's soul", "on the souls of Ann and Bran"
  fed: (boss, names) => {
    const ns = (Array.isArray(names) ? names : [names]).filter(Boolean);
    if (ns.length <= 1) return `${boss} feeds on ${ns.length ? `${ns[0]}'s` : 'a fallen challenger\'s'} soul.`;
    return `${boss} feeds on the souls of ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}.`;
  },
});
/** WBX7: a magic round on the shared world's clock, ms - one game minute (net/wire.js ONLINE_MINUTES_PER_MS: TimeScale
 *  12, five seconds) - so a soul trap laid on him lasts its rounds as it would on any foe in the same world. */
export const COURT_ROUND_MS = Math.round(1 / ONLINE_MINUTES_PER_MS);
/** WBX4: his mark's ember, a little brighter than his glow's, so the floor under him reads at a glance - WB8b: his
 *  aspect's ember (MARK_COLOR the Burning Warden's). */
export const markColorOf = (ember) => Object.freeze(ember.map((c) => Math.min(1, c * 1.1)));
export const MARK_COLOR = markColorOf(EMBER_COLOR);
/** WB9f: his spoils rest no nearer the court's edge than this (m) - the throw is softened until they do
 *  (world/gateSpew.js keepLaunch) - and the gold his chest bursts in as they leave it. */
export const SPEW_RIM_M = 2;
export const SPOILS_BURST_COLOR = Object.freeze([1, 0.78, 0.28]);
/** WB9f: the court floor his spoils must come to rest on - the court he fell in, SPEW_RIM_M in from its edge, in the
 *  dungeon's frame (the burst's `keep`). Pure. */
export function spoilsKeep(x, z) {
  const C = COURTS[nearestCourt(x, z)], centre = courtToDungeon(C[0], 0, C[1]);
  return { centre, r: COURT_R - SPEW_RIM_M, floorY: centre[1] };
}
/** WB5: his body bursts this long into his fall, and the spoils leave it (world/gateBoss.js FALL_MS is the whole fall);
 *  a receipt not come this long after it never will. WB13e: after his body meets the floor (THUD_AT_MS), under the card. */
export const SPEW_AT_MS = 1700;
export const RECEIPT_WAIT_MS = 4000;
/** AUDIT WB B7: his death cry is heard only this near his fall - a player who comes to the court (or back to it) after
 *  he fell hears the thud's own late rule, not a cry from minutes ago. */
export const FALL_CRY_LATE_MS = 1500;
/** WB8c: a Soul-Hungry feeding heard later than this after it happened is not said (nor growled) - heard live, never a
 *  stale one (AUDIT PRE-MERGE 0929 W2-3: for every feeding, not the entry's first alone). */
export const FED_LATE_MS = 2000;

/** AUDIT WB B4: AN ATTACK IS ITS NUMBER AND ITS MOMENT. The relay numbers a fight's attacks, and a room woken from its
 *  checkpoint numbers them from there again - the next attack would wear the number of one this screen already judged,
 *  cued and landed, and pass unheard and unfelt. */
const noMark = () => ({ i: -1, at: NaN });
const marked = (m, atk) => m.i === atk.i && m.at === atk.at;
const setMark = (m, atk) => { m.i = atk.i; m.at = atk.at; };
const NONE = Object.freeze([]);

/** The boss by his id (the relay's word), or the day's (net/gateLaw.js). */
export const bossOf = (s) => GATE_BOSSES.find((b) => b.id === s?.boss) ?? gateBossOf(s?.day ?? 0);

/** WB13a: the way out of a blow is sought along this many bearings, in steps this long, this far at most (m), and never
 *  nearer the floor's rim than PERIL_RIM_M. */
export const PERIL_BEARINGS = 24;
export const PERIL_STEP_M = 0.25;
export const PERIL_REACH_M = 20;
export const PERIL_RIM_M = 0.4;
/**
 * WB13a: THE NEAREST WAY OUT of a shape (`inside(x, z)`, the court's frame) from my feet at (fx, fz), over the floor of
 * court `court`: the bearing (a unit [dx, dz]) and how far, or null when none is in reach. Pure.
 */
export function wayOut(inside, fx, fz, court) {
  const C = COURTS[court] ?? COURTS[0], R = COURT_R - PERIL_RIM_M;
  let best = null;
  for (let b = 0; b < PERIL_BEARINGS; b++) {
    const a = (b / PERIL_BEARINGS) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    for (let m = PERIL_STEP_M; m <= PERIL_REACH_M && (!best || m < best.m); m += PERIL_STEP_M) {
      const x = fx + dx * m, z = fz + dz * m;
      if (Math.hypot(x - C[0], z - C[1]) > R) break;
      if (!inside(x, z)) { best = { dx, dz, m }; break; }
    }
  }
  return best ? { dir: [best.dx, best.dz], m: best.m } : null;
}
/** WB13a: a bearing in the court's frame as the screen turns it, degrees - 0 ahead, 90 to the right - for a camera of
 *  `yaw` (scenes/world.js cam.yaw: ahead [sin, cos], right [cos, -sin]). */
export const screenBearing = (dir, yaw) => (Math.atan2(dir[0] * Math.cos(yaw) - dir[1] * Math.sin(yaw), dir[0] * Math.sin(yaw) + dir[1] * Math.cos(yaw)) * 180) / Math.PI;
/**
 * WB13a (2026-10-01, Mac: "hone in telegraphs"): A BLOW STILL TO COME ON MY FEET - in first person at sword reach the
 * ground under me is out of sight (his Cleave's shape is none of the frame). The one landing soonest of his blow in
 * flight (never the whole floor's: no step escapes the Wrath or the Reckoning) and his host's: its name, its wind-up's
 * share `t`, `now` in its last TELEGRAPH_NOW_MS, its line's colour, and the nearest way out as the screen turns it
 * (`arrow`, degrees; none without a camera's `yaw`) - or null. (fx, fz) my feet in the court's frame. Pure.
 */
export function perilAt(s, t, P, fx, fz, yaw = null) {
  if (!s || s.day === null || s.fell || s.wrath != null || !Number.isFinite(fx) || !Number.isFinite(fz)) return null;
  let best = null, inside = null;
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  if (A && A.shape !== 'all' && Number.isFinite(atk.at)) {
    const w = windupOf(A, s.phase), run = A === ATTACKS.charge ? Math.max(A.active, 1) : 0, end = atk.tg?.[0];
    if (t >= atk.at - w && t < atk.at + run) {
      // the charge's run: the lane ahead of his head - the ground behind him is safe once he has passed
      const head = run && t >= atk.at ? chargeHead(atk, t) : null;
      const on = head && end ? segmentDistance(fx, fz, head[0], head[1], end[0], end[1]) <= Math.max(ATTACKS.charge.width / 2, P.bossR) : inAttack(atk, fx, fz, P);
      if (on) { best = { at: atk.at, name: P.atk[A.key].name, t: w > 0 ? Math.max(0, Math.min(1, (t - (atk.at - w)) / w)) : 1, color: telegraphEdge(A) }; inside = (x, z) => inAttack(atk, x, z, P); }
    }
  }
  for (const a of s.lg?.ads ?? NONE) {
    const B = HOST_BLOWS[a.k], h = a.atk;
    if (!B || !h || !Number.isFinite(h.at) || !(t < h.at) || t < h.at - B.windup || (best && best.at <= h.at)) continue;
    if (Math.hypot(fx - h.x, fz - h.z) > B.r) continue;
    best = { at: h.at, name: hostBlowUnder(a.k, P).name, t: Math.max(0, Math.min(1, (t - (h.at - B.windup)) / B.windup)), color: TELEGRAPH_EDGE };
    inside = (x, z) => Math.hypot(x - h.x, z - h.z) <= B.r;
  }
  if (!best) return null;
  const out = Number.isFinite(yaw) ? wayOut(inside, fx, fz, nearestCourt(fx, fz)) : null;
  return { name: best.name, t: best.t, now: best.at - t <= TELEGRAPH_NOW_MS, color: best.color, arrow: out ? screenBearing(out.dir, /** @type {number} */ (yaw)) : null, way: out };
}

/** GATE-HEAL (2026-10-01, Mac: "Can we add a line on the damage round up showing the amount healed?" - each challenger's;
 *  "Like for healers" - allies only): what my mates' spells healed in me goes to the relay at most this often (a word for
 *  every caster since the last). */
export const HEAL_SEND_MS = 1000;

/**
 * @param {{
 *   renderer?: any, gl?: any,
 *   getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   audio?: any,
 *   link: { state: () => any, receipt?: (day: number) => string|null },
 *   spoils?: any,
 *   now: () => number,
 *   cam?: () => number[]|null,
 *   feet?: () => number[]|null,
 *   player?: () => any,
 *   save?: (entity: any, el?: string) => number,
 *   strike?: (dmg: number, how: { fire: boolean, el?: string|null, name: string }) => void,
 *   say?: (text: string) => void,
 *   hudHidden?: () => boolean,
 *   veiled?: () => boolean,
 *   send?: (hit: { q: number, d: number, r: number }) => boolean,
 *   sendCrystal?: (hit: { c: number, q: number, d: number, r: number }) => boolean,
 *   sendHost?: (hit: { i: number, q: number, d: number, r: number }) => boolean,
 *   sendHeal?: (heal: { h: Array<[string, number]> }) => boolean,
 *   rng?: () => number,
 *   portalDoor?: (door: any) => void,
 *   soulTrap?: (trap: { chance: number, mobile: number, name: string }) => void,
 *   me?: () => (string|null),
 *   yaw?: () => (number|null),
 *   shake?: (amount: number) => void,
 *   wantBodies?: () => boolean,
 *   makeBodies?: (() => any) | null,
 * }} deps
 *   WB13d: `shake` the camera's (systems/betterAmbience.js weaponKick, under the player's own maxShake) - his landings near
 *   me felt.
 *   WB9a: `veiled` - the step's fire is over the screen (ui/gateVeil.js): the marks' card waits under it. WB9c:
 *   `sendCrystal` - a blow of mine on a crystal of Oblivion, to the court's room (the wire's `xhit`). WB11c: `sendHost` -
 *   a blow of mine on one of his host, to the court's room (the wire's `ahit`). GATE-HEAL: `sendHeal` - what my mates'
 *   spells healed in me, and whose, to the court's room (the wire's `heal`).
 *   WB8b: `save` answers the saving throw against `el` (his aspect's element - fire, frost, shock, poison) and `strike`
 *   is told the element it landed with. WBX2: `portalDoor` lays the risen portal's door into the court's exit doors, once, so the exit's own ray, name and
 *   press take it - the way home, the bridge membrane's own (SS3: the court no longer takes a way home of its own - the
 *   portal is never walked through). WBX7:
 *   `soulTrap` rolls a soul trap of mine still on him at his fall (the host's attemptSoulTrap - a gem filled with his soul,
 *   and its words). GATE-UX: `me` my name on the relay (net/online.js `name`) - my row of the damage chart is marked.
 */
export function createGateCourt({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  link, spoils = null, now, cam = () => null, feet = () => null, player = () => null, save = () => 100,
  strike = () => {}, say = () => {}, hudHidden = () => false, veiled = () => false, send = () => false, sendCrystal = () => false, sendHost = () => false, sendHeal = () => false, rng = Math.random,
  portalDoor: layPortalDoor = () => {}, soulTrap = () => {}, me = () => null, yaw = () => null, shake = () => {},
  wantBodies = undefined, makeBodies = null,   // MWNPC10: the body lane's seams (a test's own)
}) {
  // MWNPC10 (bible/04-Characters/Morrowind-NPCs.md section 15a): HIM AND HIS HOST IN THEIR MORROWIND BODIES, on a lane of
  // the court's own (drawBodies) - the host's billboard pass draws after it
  const bodiesLane = createPopulationLane({ laneName: 'gate', renderer, ...(wantBodies ? { want: wantBodies } : {}), make: makeBodies });
  const bossRec = {};
  let pass = null;
  try { if (gl) pass = new GateTelegraphRenderer(gl); } catch (e) { console.warn('[gate] the telegraph would not build', e?.message ?? e); pass = null; }
  /** WB11c: HIS HOST (scenes/gateHost.js) - its blows land on me through the door his own do (`land`), each its share,
   *  its base and its element through my saving throw; a Ward-Bearer's Pulse flares the rim in his element's colour */
  const host = createGateHost({
    renderer, getTexture, uploadRecordFrame, audio, cam, feet, player, say, send: sendHost, blowQ: (who) => blowQ(who),   // AUDIT WB11 W3: my blows' one sequence
    land: (B) => { const P = profileOf(link.state()); land(null, P, { pct: B.pct, base: B.base, el: B.el, name: B.name, saved: B.el != null }, B.el ? hostPulseColor(P) : null); },
  });
  /** the sprite: its texture once loaded (or the promise, or a failure), its batch while drawn */
  let body = null, loading = null, batch = null;
  let batchShown = false;   // PERF-EXT10: the body's shown-or-not is the court's own, never a field the batch was not born with
  /** the fight this driver is on (its day), and what it has done with its attacks */
  let day = null, judged = noMark(), cued = noMark(), landed = noMark(), phaseHeard = 0, fellCued = false, wrathLanded = false;
  let prevT = -Infinity, hurtAt = -Infinity, shape = null;
  /** WB4b: his stand-in for the formulas (made once a fight), and my blows' sequence (the wire's `q`) */
  let standIn = null, blowSeq = 0;
  /** AUDIT WB11 W3: ONE SEQUENCE A BLOW - every frame one swing, shaft or blast of mine sends between two of my frames
   *  carries the same `q` (the relay's hand charges a blow once, whatever it met: him, a crystal, his host - a token a body
   *  met starved my blows); a second frame on a body already met is a blow of its own. `who` the body: 'b' him, `x<c>`
   *  a crystal, `a<i>` one of his host. */
  const blowMet = new Set();
  // GATE-HEAL: WHAT MY MATES HEALED IN ME - allies only (Mac: "Like for healers"): owed to each caster, by peer id, since
  // my last word to the relay, and when that word went. My own spells, potions and items are no one's.
  let healSentAt = -Infinity;
  const healOwed = new Map();
  const healLive = (s) => !!s && s.day !== null && !s.fell && s.wrath == null;
  /** What my mates healed in me, out as the wire's `heal`: whole points (the fractions kept for the next), each caster once. */
  function sendOwed(t) {
    healSentAt = t;
    const h = [];
    for (const [by, n] of healOwed) if (n >= 1 && h.length < GATE_HEAL_ROWS_MAX) h.push([by, Math.min(Math.floor(n), GATE_HEAL_WIRE_MAX)]);
    if (!h.length || !sendHeal({ h })) return;
    for (const [by, n] of h) { const left = healOwed.get(by) - n; if (left > 0) healOwed.set(by, left); else healOwed.delete(by); }
  }
  function blowQ(who) {
    if (!blowMet.size || blowMet.has(who)) { blowSeq++; blowMet.clear(); }
    blowMet.add(who);
    return blowSeq;
  }
  /** WB5: whether this fight's spoils have left him, and whether their absence has been said */
  let spewed = false, spoilsSaid = false;
  /** WB7: his body's sounds - where he stood last frame and how far he has come since his last step, when he growls
   *  next, the health last heard and his last grunt, the landing that shook the ground, the phase the thunder has
   *  answered, and whether his body has met the floor */
  let stepFrom = null, strideRun = 0, growlAt = null, hpHeard = null, gruntAt = -Infinity, quaked = noMark(), thunderPhase = 0, thudCued = false;
  /** WB13d: each blow's release heard once; when the court's blows were last seen in his health (and where it stood) */
  let released = noMark(), courtFlashAt = -Infinity, hpFlashSeen = null;
  /** WB13e: the card over the court (its beat), his wake heard, his roar still to come after a turn's bark, the Wrath's
   *  words said (1 a minute out, 2 as it gathers), the last spark of his sputter, each Meteor and Leap stung once, his fall
   *  seen (its light's moment, the embers' bursts, its card) and his body left on the floor (its sprite, once read) */
  let beat = null, wakeHeard = false, roarAt = null, wrathSaid = 0, sputterAt = -Infinity, stung = noMark();
  let fellSeen = false, fallFlashAt = -Infinity, columnN = 0, fallCardSet = false, corpse = null, corpseTex = null, corpseTried = false;
  /** WBX5: the burning ground the landings this screen saw have left (net/gateStrike.js landingPools), the attack whose
   *  pools were laid last, and when the fire under my feet last bit; WBX4: his mark on the floor, and the pools' shapes */
  let pools = [], pooled = noMark(), burnAt = -Infinity, inFire = false, outAt = -Infinity, mark = null;
  /** @type {ReadonlyArray<any>} */
  let poolDraw = NONE;
  let _mark = markShape([0, 0], 0, MARK_COLOR), _markOf = null, markEmber = MARK_COLOR;   // WB8b: his mark and its ember, remade when his profile is another
  /** WB8c: whether his marks have been said to me on this entry, and the last feeding heard; WB9a: when they were (the
   *  marks' card stands from then - ui/gateMarksView.js MARKS_CARD_ARRIVE_MS) */
  let marksSaid = false, fedHeard = null, marksAt = null;
  /** GATE-UX: when this screen first saw his fall (the relay's clock) - the damage chart stands from then */
  let chartAt = null;
  /** WBX2: the portal home once he has fallen - where it stands (the court's frame) and how far it has risen, its fire's
   *  pass and the arch's opening (made the first time one stands), its fire's turn, and whether its door is laid and its
   *  rising said */
  let portal = null, portalPass = null, portalTried = false, profile = null, spin = 0, portalLaid = false, portalSaid = false;
  /** WBX7: my soul trap on him - its chance (frozen at the cast) and when it runs out on the relay's clock - and whether
   *  his fall has rolled it */
  let trapMark = null, trapJudged = null;   // AUDIT WBX F6: the day whose fall rolled it - once a fight, across a walk out and back
  /** AUDIT WB D10: the frame's lists, refilled rather than made - the host asks for them every frame */
  const _batches = [], _lights = [];
  /** WB9c: THE RECKONING'S CRYSTALS as this screen holds them (crystalsOf - made at its word): its number and first spot
   *  (its identity - AUDIT WB B4's law: a room woken from its checkpoint numbers again), each crystal's foot in the
   *  dungeon's frame and its body as a target, when they grew (the relay's clock), each one's health share, when it broke
   *  (null standing) and when I last struck it, its turn and seed, when its Reckoning lands; `ended` once the relay has
   *  done with it (broken or landed) - kept until the last shard has flown. The last one ended (never seen again as new),
   *  the stun last heard, the stand-in every crystal shares (made once a fight), and the pass. */
  let rk = null, rkDone = null, stunHeard = 0, crystalPass = null, crystalTried = false;
  /** AUDIT WB11 W1: the crystals' stand-ins, one a crystal, each naming its own (world/gateBoss.js crystalStandIn) */
  const crystalIns = [];
  const _targets = [], _crystalDraw = [], _crystalSlots = [], _crystalLights = [], _chest = [0, 0, 0];
  /** AUDIT WB9 (court F4): how far each walkway is laid this frame (net/gateBrain.js walkFormed) - refilled, never made */
  const _walked = WALKS.map(() => 0);
  /** WB9d: his ground and his element, felt - the ground I stand in (its name and colour) and the last bite or elemental
   *  blow that landed on me (when, and its colour) */
  let groundName = '', groundColor = null, biteAt = -Infinity, biteColor = null;
  /** WB9e: his blows seen landing - the bursts' slots (each where it landed in the dungeon's frame, its moment on the
   *  relay's clock, its kind and colour), the frame's live ones and the meteor's fall; the pass (made the first time) */
  const _bursts = [], _fxLive = [], _meteor = { at: [0, 0, 0], color: null }, _landLights = [];   // WB13d: a light a burst's slot
  /** WB13e: the fall's white and the Wrath's light - one each, refilled (AUDIT WB D10's law) */
  const _fallLight = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] }, _wrathLight = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] };
  const flash = (L, at, c, k, range) => { L.x = at[0]; L.y = at[1]; L.z = at[2]; L.range = range; L.color[0] = c[0] * k; L.color[1] = c[1] * k; L.color[2] = c[2] * k; return L; };
  let meteorNow = null, fxPass = null, fxTried = false;

  function reset(d) {
    day = d; judged = noMark(); cued = noMark(); landed = noMark(); phaseHeard = 0; fellCued = false; wrathLanded = false;
    prevT = -Infinity; hurtAt = -Infinity; shape = null; standIn = null; spewed = false; spoilsSaid = false;
    stepFrom = null; strideRun = 0; growlAt = null; hpHeard = null; gruntAt = -Infinity; quaked = noMark(); thunderPhase = 0; thudCued = false;
    released = noMark(); courtFlashAt = -Infinity; hpFlashSeen = null;   // WB13d
    beat = null; wakeHeard = false; roarAt = null; wrathSaid = 0; sputterAt = -Infinity; stung = noMark();   // WB13e
    fellSeen = false; fallFlashAt = -Infinity; columnN = 0; fallCardSet = false;
    if (corpse) { renderer?.destroyBillboardBatch?.(corpse); corpse = null; }
    pools = []; pooled = noMark(); burnAt = -Infinity; inFire = false; outAt = -Infinity; mark = null; poolDraw = [];
    marksSaid = false; fedHeard = null; marksAt = null; chartAt = null;   // GATE-UX
    healOwed.clear();   // GATE-HEAL
    portal = null; spin = 0; portalLaid = false; portalSaid = false;
    rk = null; rkDone = null; stunHeard = 0; crystalIns.length = 0; _targets.length = 0; _crystalDraw.length = 0;   // WB9c
    _bursts.length = 0; _fxLive.length = 0; meteorNow = null;   // WB9e
    groundName = ''; groundColor = null; biteAt = -Infinity; biteColor = null;   // WB9d
    if (d !== null && trapMark?.day !== d) trapMark = null;   // AUDIT WBX F6: a trap of this day's fight outlives a cast-out and a walk back in
  }

  /** WBX7: HIS FALL ROLLS MY TRAP, once - a trap of mine still running at the moment he fell (the relay's `fell.at`, not
   *  when this screen heard of it) goes to the host's roll with his mobile, the soul a gem takes. */
  function judgeTrap(s) {
    if (!s.fell || trapJudged === s.day) return;
    trapJudged = s.day;
    if (trapMark && s.fell.at < trapMark.until) soulTrap({ chance: trapMark.chance, mobile: bossLookOf(s.boss).mobile, name: bossOf(s).name });
  }

  /** WBX2: THE PORTAL HOME - PORTAL_AFTER_MS into his fall it stands where he fell and rises; its door is laid into the
   *  court's exit doors once (the ray, the plaque's name and the PRESS - the bridge membrane's own way home), and the
   *  rising is said once. SS3 (2026-09-27, a player through Mac, "Oblivion gate exit on touch prevents looting": "I was
   *  close to the guy when he died, got zoned out by touching the gate before I could pick up loot"): it is never WALKED
   *  through. It stands where he fell - where his spoils leave him and land - so a player going for them stepped through
   *  its fire and out of the court with the floor still full (gathered into the pack on the way out, never seen fall). */
  function portalFrame(s, t, dt) {
    if (!s.fell || t < s.fell.at + PORTAL_AFTER_MS) { portal = null; return; }
    const at = bossPlace(s, s.fell.at);
    portal = { at, rise: Math.min(1, (t - s.fell.at - PORTAL_AFTER_MS) / PORTAL_RISE_MS), origin: courtToDungeon(at[0], -PORTAL_DROP, at[1]) };
    profile ??= gateArchProfile();   // the arch's opening - the fire's shape and the step's bound, with or without a GL
    if (!portalTried && gl) {
      portalTried = true;
      try { portalPass = new GatePassRenderer(gl, profile); } catch (e) { console.warn('[gate] the portal would not build', e?.message ?? e); portalPass = null; }
    }
    spin = (spin + gateSpinRate(1) * Math.max(0, dt)) % 1;
    if (!portalLaid) { portalLaid = true; layPortalDoor(portalDoor(at)); }
    if (!portalSaid) { portalSaid = true; if (t < s.fell.at + PORTAL_AFTER_MS + PORTAL_RISE_MS + 1000) say(COURT_TEXT.portal); }   // said as it rises, never long after
  }

  function sound(cue, s, t, atk, point = null) {
    if (!cue || !audio) return;
    const where = cue.at === 'point' && point ? [point]   // WB9c: a crystal's own place (the dungeon's frame)
      : cue.at === 'targets' && atk?.tg?.length ? atk.tg.map((p) => courtToDungeon(p[0], 0.5, p[1]))
      : [(() => { const [x, z] = bossPlace(s, t); return courtToDungeon(x, 2.5, z); })()];
    const opts = { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch };
    for (const p of where) {
      try { if (cue.id != null) audio.play3dId?.(cue.id, p, cue.volume, opts); else audio.play3d?.(cue.clip, p, cue.volume, opts); } catch { /* a sound is never the fight */ }
    }
  }

  /** A strike on me: its share of my own health and its base (WBX4), an element through my saving throw against it (the
   *  Wrath through nothing) - WB8b: all under his profile (his aspect's element and names, Vengeful's weight). WB11c: or
   *  one of his host's blows (`so` - its own, `color` the rim's flare for an element). */
  function land(atk, P, so = blowOf(atk, P), color = null) {
    const e = player();
    if (!e || !so || !(e.health > 0)) return;
    let dmg = strikeDamage(so.pct, e.maxHealth, so.base);
    if (so.saved) dmg = savedShare(dmg, save(e, so.el));
    if (dmg <= 0) { say(COURT_STRIKE_TEXT.resisted(so.name)); return; }
    strike(dmg, { fire: so.el === 'fire', el: so.el, name: so.name });
    if (so.el) { biteAt = now(); biteColor = color ?? attackColor(ATTACK_BY_ID[atk.a], P); }   // WB9d: an elemental blow flares the screen's rim in its colour (DFU's red flash is a blow's alone)
  }

  /** WBX5: THE BURNING GROUND - a landing that leaves fire lays its pools the frame this screen sees it land (never one
   *  it did not see: the pools are this screen's, as the verdict is); STAYING in one bites every POOL_TICK_MS - the first
   *  bite a tick after I stepped in (or it fell under me: the landing has already struck), so a step out in time is
   *  free - fire, through my saving throw. The burnt-out go. */
  function burn(s, t, P) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && P.atk[A.key].pool && !marked(pooled, atk) && t >= atk.at) {   // WB8b: the ground his profile gives the landing (Scarring's too)
      setMark(pooled, atk);
      if (t < atk.at + Math.max(A.active, 1) + 400) for (const p of landingPools(atk, P)) pools.push(p);   // AUDIT WB B7's law: a landing long past is not laid now
    }
    if (pools.length) pools = pools.filter((p) => t < p.until);
    const f = feet(), e = player();
    if (!pools.length || !f || !e || !(e.health > 0) || s.fell || s.wrath != null) { inFire = false; return; }
    const p = poolUnder(pools, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t);
    if (!p) { if (inFire) { inFire = false; outAt = t; } return; }
    // WB9d: the ground I stand in, named and coloured for the rim and the warning (ui/gateGroundView.js); a step in
    // hisses under my feet at once - the bite is a tick off, the warning is not
    groundName = P.aspect.ground; groundColor = poolColor(P);
    if (!inFire && t - outAt >= POOL_TICK_MS) sound(groundStepCue(P), s, t, null, f);
    // AUDIT WBX F8: a step in starts the fire's count a tick off - unless the step out was shorter than a tick, which
    // keeps the count it had (a frame out of the fire each second was never bitten)
    if (!inFire) { inFire = true; if (t - outAt >= POOL_TICK_MS) { burnAt = t; return; } }
    if (t - burnAt < POOL_TICK_MS) return;
    burnAt = t;
    const el = p.el ?? 'fire';   // WB8b: his aspect's ground
    const dmg = savedShare(strikeDamage(p.pct, e.maxHealth, p.base), save(e, el));
    if (dmg > 0) {
      strike(dmg, { fire: el === 'fire', el, name: el === 'fire' ? COURT_STRIKE_TEXT.burning : P.aspect.ground.toLowerCase() });
      biteAt = t; biteColor = groundColor;   // WB9d: the bite flares the rim
    }
  }

  function judge(s, t, P) {
    const atk = s.atk;
    const f = feet(), e = player();
    const standing = !!f && !!e && e.health > 0;
    if (atk && !marked(judged, atk) && standing) {
      const v = strikeVerdict(atk, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t, prevT, P);
      if (v !== 'wait') {
        setMark(judged, atk);
        if (v === 'hit') { if (ATTACK_BY_ID[atk.a] === ATTACKS.wrath) wrathLanded = true; land(atk, P); }
      }
    }
    // the Wrath's own word, when it overtook its attack's landing on this screen: it lands all the same
    if (s.wrath != null && !wrathLanded) { wrathLanded = true; if (standing) land({ a: ATTACKS.wrath.id }, P); }
  }

  function cue(s, t, P) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && !marked(cued, atk)) { setMark(cued, atk); if (t < atk.at) sound(bossCue('windup', A, P), s, t, atk); }   // WB8b: in his aspect's voice
    // WB13d: THE RELEASE - RELEASE_LEAD_MS before it lands, the sound of it coming (the bark said what; this says now)
    if (A && !marked(released, atk) && t >= atk.at - RELEASE_LEAD_MS) { setMark(released, atk); if (t < atk.at) sound(bossCue('release', A, P), s, t, atk); }
    if (A && !marked(landed, atk) && t >= atk.at) { setMark(landed, atk); if (t < atk.at + Math.max(A.active, 1) + 400) { sound(bossCue('land', A, P), s, t, atk); burstsOf(atk, A, P); feltLanding(s, t, A, atk); } }   // WB9e: and seen landing; WB13d: and felt
    if (A && !marked(quaked, atk) && t >= atk.at && QUAKE_ON.includes(A.key)) { setMark(quaked, atk); if (t < atk.at + Math.max(A.active, 1) + 400) sound(BOSS_CUES.quake, s, t, atk); }   // WB7: the ground's shock under a heavy landing
    if (s.phase > thunderPhase) { if (thunderPhase > 0) sound(BOSS_CUES.thunder, s, t, null); thunderPhase = s.phase; }   // WB7: thunder over his roar as a phase turns
    // WB13e: HIS WAKE - as the opening ends (the relay's `op`): his roar, his flare (world/gateBoss.js bossGlow), his name
    if (!wakeHeard && (s.openUntil ?? 0) > 0 && t >= s.openUntil - WAKE_LEAD_MS) {
      wakeHeard = true;
      if (t < s.openUntil + WAKE_LATE_MS && !s.fell && s.wrath == null) {
        const b = bossOf(s), ep = P.md ? P.aspect.epithet : '';
        sound(BOSS_CUES.roar, s, t, null);
        beat = { kind: 'wake', at: t, until: t + TITLE_HOLD_MS, kicker: b.title, main: b.name, sub: ep ? `${ep.charAt(0).toUpperCase()}${ep.slice(1)}` : '' };
      }
    }
    // WBX5: the turn, by its name - WB13e: its card (its numeral, its name and its one order) held until he lands, and his
    // roar a moment after the bound's bark
    if (s.phase > phaseHeard) { if (phaseHeard > 0) { roarAt = t + ROAR_AFTER_MS; const c = courtPhaseCard(s.phase); if (c) beat = { kind: 'phase', at: t, until: t + TITLE_HOLD_MS, ...c }; } phaseHeard = s.phase; }
    if (roarAt !== null && t >= roarAt) { roarAt = null; sound(BOSS_CUES.roar, s, t, null); }
    if (beat?.kind === 'phase' && A === ATTACKS.cross) beat.until = Math.max(beat.until, atk.at + Math.max(A.active, 1) + 400);
    // WB13e: DAGON'S WRATH, said - a minute out (while it is news), and as it gathers
    if (!(wrathSaid & 1) && Number.isFinite(s.wrathAt) && !s.fell && s.wrath == null && t >= s.wrathAt - WRATH_WARN_AT_MS) { wrathSaid |= 1; if (t < s.wrathAt - WRATH_WARN_AT_MS + 5000) say(COURT_WRATH_TEXT.minute); }
    if (!(wrathSaid & 2) && A === ATTACKS.wrath && t < atk.at) { wrathSaid |= 2; say(COURT_WRATH_TEXT.windup); }
    // WB13e: AIMED AT ME - a Meteor or a Leap called on the ground I stand on says so at its word, with a sting
    if ((A === ATTACKS.meteor || A === ATTACKS.leap) && !marked(stung, atk) && t < atk.at) {
      setMark(stung, atk);
      const f = feet(), e = player();
      if (f && e && e.health > 0 && inAttack(atk, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], P)) sound(BOSS_CUES.sting, s, t, atk, f);
    }
    // WB9a: his marks' card from the moment I step into his court (never a court whose Warden has already gone); WB13b:
    // the card alone (the line said beside it is gone); and a feeding said
    if (!marksSaid) { marksSaid = true; if (P.md && !s.fell && s.wrath == null) marksAt = t; }   // an unmarked Warden (an older relay's) shows no card
    // AUDIT PRE-MERGE 0929 W2-3: a feeding is said while it is news, judged by its age alone - "the first of this
    // entry" stood in for "stale", and a tab hidden through a second feeding said it, and growled, a minute late
    if (s.fed && s.fed.at !== fedHeard) { fedHeard = s.fed.at; if (t - s.fed.at <= FED_LATE_MS) { say(COURT_MARKS_TEXT.fed(bossOf(s).name, s.fed.ns)); sound(BOSS_CUES.growl, s, t, null); } }
    if (s.fell && !fellCued) { fellCued = true; if (t < s.fell.at + FALL_CRY_LATE_MS) sound(BOSS_CUES.fall, s, t, null); }   // AUDIT WB B7: never a cry from long ago
    bodySounds(s, t, A);
  }

  /** WB7: HIS BODY, heard - a step each stride he walks or charges; a growl now and then while he is not striking; a
   *  grunt when a share of his health goes (no closer together than HURT_GAP_MS); his body meeting the floor. */
  function bodySounds(s, t, A) {
    if (s.fell) {
      if (!thudCued && t >= s.fell.at + THUD_AT_MS) { thudCued = true; if (t < s.fell.at + THUD_AT_MS + 1000) sound(BOSS_CUES.thud, s, t, null); }
      return;
    }
    const [x, z] = bossPlace(s, t);
    // AUDIT WBX F9: no step on the stone while a leap carries him through the air - his feet find it again where it lands
    if (bossHop(s, t) > 0) { stepFrom = null; strideRun = 0; }
    else {
      if (stepFrom) {
        strideRun += Math.hypot(x - stepFrom[0], z - stepFrom[1]);
        if (strideRun >= BOSS_STRIDE_M) { strideRun %= BOSS_STRIDE_M; sound(BOSS_CUES.step, s, t, null); }
      }
      stepFrom = [x, z];
    }
    const striking = !!A && t < s.atk.at + Math.max(A.active, 1) + 1500;
    const nextGrowl = () => t + GROWL_EVERY_MS[0] + rng() * (GROWL_EVERY_MS[1] - GROWL_EVERY_MS[0]);
    if (growlAt === null) growlAt = nextGrowl();
    else if (striking) growlAt = Math.max(growlAt, t + 3000);
    else if (t >= growlAt) { sound(BOSS_CUES.growl, s, t, null); growlAt = nextGrowl(); }
    // AUDIT WB D3: the loss is counted from his last grunt, not from the last word - the relay says his health in small
    // steps, and in a big fight no one step was ever a share, so he never grunted at all; a heal (a newcomer's share)
    // starts the count again from where he stands
    if (hpHeard === null || s.hp > hpHeard) hpHeard = s.hp;
    else if (s.max > 0 && hpHeard - s.hp >= s.max * HURT_SHARE && t - gruntAt >= HURT_GAP_MS) { gruntAt = t; hpHeard = s.hp; sound(BOSS_CUES.hurt, s, t, null); }
  }

  /** WB5: THE BURST - SPEW_AT_MS into his fall, this player's spoils leave his chest toward them, off the seed of the
   *  receipt the relay signed for them (net/gateReceipt.js `c`); no receipt by RECEIPT_WAIT_MS, and none is coming - said
   *  once. */
  function burst(s, t) {
    if (!spoils || !s.fell || spewed || t < s.fell.at + SPEW_AT_MS) return;
    const r = link.receipt?.(s.day) ?? null, claims = r ? readReceipt(r) : null;
    if (!claims) {
      if (!spoilsSaid && t >= s.fell.at + RECEIPT_WAIT_MS) { spoilsSaid = true; say(COURT_STRIKE_TEXT.noSpoils()); }
      return;
    }
    spewed = true;
    const [x, z] = bossPlace(s, s.fell.at);
    const at = courtToDungeon(x, profileOf(s).bossH * 0.55, z), f = feet();   // his chest - WB8b: Colossal's stands higher
    const bearing = f ? Math.atan2(f[0] - at[0], f[2] - at[2]) : s.yaw;
    const keep = spoilsKeep(x, z);   // WB9f: on the floor of the court he fell in, never off its edge into the fire
    if (spoils.spew({ day: s.day, seed: claims.c, level: spoilsLevel(player()?.level ?? 1, claims.l), at, bearing, acct: claims.s, keep, claims })) {   // WB12d: and the rite's ember   // AUDIT WBX S2: never past the level the fight admitted   // AUDIT WB A9: once a receipt - its day and account
      say(claims.x === 'rite' ? COURT_STRIKE_TEXT.spilledRite() : COURT_STRIKE_TEXT.spilled());   // WBX3: and said to be theirs; AUDIT WB12d (D20): the rite's ember by its own
      addBurst(at, t, FX_KINDS.spoils, SPOILS_BURST_COLOR, keep.floorY);   // WB9f: his chest bursts in gold as they leave it
    }
  }

  /** WB9e: THE BURSTS A LANDING THROWS (render/gateFx.js fxBurstOf) - at his feet for his own (the slam, the nova,
   *  Dagon's), where it lands for a leap, a bound or a meteor, under each mark for Hellfire - from its moment on the
   *  relay's clock, in its colour under his profile; a slot reused, the oldest given up past FX_BURSTS_MAX. */
  /** A burst at `p` (the dungeon's frame) from `at0` (the relay's clock) - a slot reused, the oldest given up past
   *  FX_BURSTS_MAX; `floor` the floor's height under it (WB9f: his spoils' gold bursts out of his chest), else its own. */
  function addBurst(p, at0, kind, color, floor = NaN) {
    let b = _bursts.length < FX_BURSTS_MAX ? null : _bursts.reduce((o, q) => (q.at0 < o.at0 ? q : o));
    if (!b) { b = { at: [0, 0, 0], at0: 0, t: 0, kind, color, floor: NaN }; _bursts.push(b); }
    b.at[0] = p[0]; b.at[1] = p[1]; b.at[2] = p[2]; b.at0 = at0; b.kind = kind; b.color = color; b.floor = floor;
  }
  /** WB9f: A PIECE OF HIS SPOILS CAME TO REST (scenes/spoilsPool.js frame's `onRest`): its tier's sparks where it lies,
   *  a Rare-or-better's brighter. Made once, handed every frame. */
  const onSpoilRest = (pos, tier) => {
    const rare = (RARITIES[tier]?.rank ?? 0) >= RARITIES.rare.rank;
    addBurst(pos, now(), rare ? FX_KINDS.spoilRestRare : FX_KINDS.spoilRest, tierColour(tier));
  };
  /** WB13e: HIS FALL, AN EVENT - at the kill a burst of Dagon's own size, the court's light white and the camera shaken;
   *  as his body meets the floor a column of embers; over his spoils the card. Each once, and each only while news (a
   *  screen that comes to the court after he fell sees his body on the floor, and nothing played again). */
  function fallEvent(s, t, P) {
    if (!s.fell) return;
    const since = t - s.fell.at, [x, z] = bossPlace(s, s.fell.at);
    if (!fellSeen) {
      fellSeen = true;
      if (since < FALL_CRY_LATE_MS) { addBurst(courtToDungeon(x, P.bossH * 0.5, z), s.fell.at, FX_KINDS.dagon, emberColor(P)); fallFlashAt = s.fell.at; shake(FALL_SHAKE); }
    }
    for (; columnN < COLUMN_BURSTS && since >= THUD_AT_MS + columnN * COLUMN_STEP_MS; columnN++) {
      if (since < THUD_AT_MS + columnN * COLUMN_STEP_MS + 1000) addBurst(courtToDungeon(x, 0.1, z), s.fell.at + THUD_AT_MS + columnN * COLUMN_STEP_MS, FX_KINDS.embers, emberColor(P));
    }
    if (!fallCardSet && since >= SPEW_AT_MS) {
      fallCardSet = true;
      const at = s.fell.at + SPEW_AT_MS;
      if (t < at + FALL_CARD_MS) beat = { kind: 'fall', at, until: at + FALL_CARD_MS, kicker: bossOf(s).name, main: BOSS_BAR_TEXT.fallen, sub: '' };
    }
  }
  /** WB13e: UNDER HIS LOW HEALTH his ember sputters (world/gateBoss.js bossGlow) and sheds a spark every SPUTTER_EVERY_MS. */
  function sputterSparks(s, t, P) {
    if (s.fell || s.wrath != null || !(s.max > 0) || s.hp / s.max >= LOW_HEALTH || t - sputterAt < SPUTTER_EVERY_MS) return;
    sputterAt = t;
    const [x, z] = bossPlace(s, t);
    addBurst(courtToDungeon(x, P.bossH * 0.55, z), t, FX_KINDS.sputter, emberColor(P));
  }
  /** WB13e: HIS BODY LEFT where he fell - his mobile's own corpse (characters/enemyBasics.js corpseTexture) at
   *  CORPSE_SCALE on the floor, once he has sunk; put away with the court. */
  function drawCorpse(s) {
    const ct = ENEMY_BASICS[bossLookOf(s.boss).mobile]?.corpseTexture;
    if (!ct || !renderer?.createBillboardBatch || !getTexture) return;
    if (!corpseTried) { corpseTried = true; Promise.resolve(getTexture(ct.archive)).then((tx) => { corpseTex = tx ?? null; }).catch(() => {}); }
    if (!corpseTex || corpse) return;
    const sz = billboardSize(corpseTex, ct.record), w = (sz?.w ?? 1.6) * CORPSE_SCALE, h = (sz?.h ?? 0.6) * CORPSE_SCALE;
    const rkey = `${ct.record}#0`;
    if (!renderer.textures?.has?.(`${ct.archive}_${rkey}`)) uploadRecordFrame?.(ct.archive, ct.record, 0);
    corpse = renderer.createBillboardBatch(ct.archive, rkey, { w, h }, [[0, 0, 0]]);
    const [x, z] = bossPlace(s, s.fell.at);
    corpse.origin = courtToDungeon(x, 0, z);
    corpse.record = rkey;
    corpse.size = { w, h };
  }
  /** WB13d: A LANDING FELT - the camera shaken by how near it fell to my feet (world/gateBoss.js LAND_SHAKE: the nearest
   *  of its landings; one the whole arena feels, wherever I stand), as his blow on me shakes it. */
  function feltLanding(s, t, A, atk) {
    const f = feet();
    if (!f) return;
    const fx = f[0] - COURT_CENTRE[0], fz = f[2] - COURT_CENTRE[2];
    const away = A.aim === 'players' ? atk.tg ?? NONE : A === ATTACKS.meteor ? (atk.tg?.length ? [atk.tg[0]] : NONE) : null;
    let k = 0;
    if (away) for (const p of away) k = Math.max(k, landShake(A, Math.hypot(fx - p[0], fz - p[1])));
    else { const [x, z] = bossPlace(s, t); k = landShake(A, Math.hypot(fx - x, fz - z)); }   // his own: where he stands as it lands
    if (k >= 0.05) shake(k);
  }
  function burstsOf(atk, A, P) {
    const kind = fxBurstOf(A);
    if (!kind) return;
    const color = attackColor(A, P);
    const add = (x, z) => addBurst(courtToDungeon(x, 0.1, z), atk.at, kind, color);
    if (A.aim === 'self') add(atk.x, atk.z);
    else if (A.aim === 'point') { const p = atk.tg?.[0]; if (p) add(p[0], p[1]); }
    else if (A.aim === 'players') for (const p of atk.tg ?? NONE) add(p[0], p[1]);
  }
  /** WB9e: the frame's live bursts (their sparks still flying) and the meteor's fall, refilled. */
  function fxFrame(s, t, P) {
    _fxLive.length = 0;
    for (const b of _bursts) { b.t = (t - b.at0) / 1000; if (b.t >= 0 && b.t < FX_BURST_MS / 1000) _fxLive.push(b); }
    const mf = s.fell ? null : meteorFall(s.atk, t);
    if (mf) {
      const p = courtToDungeon(mf.at[0], mf.at[1], mf.at[2]);
      _meteor.at[0] = p[0]; _meteor.at[1] = p[1]; _meteor.at[2] = p[2]; _meteor.color = attackColor(ATTACKS.meteor, P);
      meteorNow = _meteor;
    } else meteorNow = null;
  }

  /** AUDIT WB9 (brain F1): do my feet stand in the court he fights in (the relay's POSE_SLACK past its rim)? The relay takes
   *  a blow - on him, on a crystal - from nowhere else. */
  const fromHisCourt = (s, t) => {
    const f = feet();
    if (!f) return false;
    const [bx, bz] = bossPlace(s, t);
    return inCourt(f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], nearestCourt(bx, bz), POSE_SLACK);
  };

  /** WB9c: is `X` (the state's crystals) the Reckoning `r` this screen holds (or ended) - its number and its first spot? */
  const sameCx = (r, X) => !!r && !!X && r.i === X.i && r.x0 === X.c[0][0] && r.z0 === X.c[0][1];

  /** WB9c: A RECKONING'S CRYSTALS, FIRST SEEN - grown from its word (its attack's moment less its wind-up, the relay's
   *  clock) when its attack is the one in flight, else already whole (a screen come in late sees them standing). */
  function crystalsOf(X, s, t) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null, mine = A === ATTACKS.reckon && atk.i === X.i;
    const n = Math.min(X.c.length, CRYSTALS_DRAW_MAX);
    const r = { i: X.i, x0: X.c[0][0], z0: X.c[0][1], n, grewAt: mine ? atk.at - windupOf(A, s.phase) : -Infinity, landAt: mine ? atk.at : null, ended: false, endAt: 0,
      feet: [], hp: [], brokeAt: [], flashAt: [], yaw: [], seed: [], targets: [] };
    for (let k = 0; k < n; k++) {
      const q = X.c[k], feet = courtToDungeon(q[0], 0, q[1]);
      const seed = (((X.i * 7919 + k * 104729) % 997) + 997) % 997 / 997;
      r.feet.push(feet);
      r.hp.push(X.m > 0 ? Math.max(0, q[2] / X.m) : 1);
      r.brokeAt.push(q[2] > 0 ? null : -Infinity);   // one broken before this screen saw it: gone, no shards
      r.flashAt.push(-Infinity);
      r.seed.push(seed);
      r.yaw.push(seed * Math.PI * 2);
      r.targets.push({ c: k, feet, height: CRYSTAL_H, radius: CRYSTAL_R, entity: null });
    }
    return r;
  }

  /** WB9c: a crystal broken at `at` (the relay's clock) - its shards fly from then; its crash heard, and who broke it and
   *  how many stand said, while it is news (RECKON_LATE_MS). `spent`: the Reckoning's own landing took it (no name). */
  function breakCrystal(s, k, at, t, who, spent = false) {
    rk.brokeAt[k] = at;
    rk.hp[k] = 0;
    if (!(t - at <= RECKON_LATE_MS)) return;
    sound(BOSS_CUES.crystalBreak, s, t, null, rk.feet[k]);
    if (spent) return;
    sound(BOSS_CUES.crystalRing, s, t, null, rk.feet[k]);
    let left = 0;
    for (let j = 0; j < rk.n; j++) if (rk.brokeAt[j] === null) left++;
    say(COURT_RECKON_TEXT.shattered(who, left));
  }

  /**
   * WB9c: THE CRYSTALS, EACH FRAME - a Reckoning's crystals taken at its word (its call said, each one heard grinding up
   * out of the stone), each one's health from the relay's word, each one broken as the relay says (its shards, its crash,
   * who broke it), and the Reckoning done with - its word gone (broken: the stun; or landed and the relay moved on), its
   * landing seen here, the Wrath or his fall: every crystal still standing bursts - and its shards kept flying out. The
   * stun said and heard once. The targets my blows meet and the draw list refilled.
   */
  function crystals(s, t, P) {
    const X = s.cx;
    if (X && X.c.length && !sameCx(rk, X) && !(rkDone && rkDone.i === X.i && rkDone.x0 === X.c[0][0] && rkDone.z0 === X.c[0][1])) {
      rk = crystalsOf(X, s, t);
      for (const q of rk.targets) q.entity = (crystalIns[q.c] ??= crystalStandIn(bossLookOf(s.boss), q.c));
      // its call said while it is still to land (news to a fighter come in late through the wind-up too); each crystal
      // heard grinding up out of the stone as it grows, never long after
      let left = 0;
      for (let k = 0; k < rk.n; k++) if (X.c[k][2] > 0) left++;
      if (rk.landAt !== null && t < rk.landAt && left > 0 && !s.fell && s.wrath == null) say(COURT_RECKON_TEXT.call(left));
      if (t - rk.grewAt <= RECKON_LATE_MS && !s.fell && s.wrath == null) for (let k = 0; k < rk.n; k++) sound(BOSS_CUES.crystalRise, s, t, null, rk.feet[k]);
    }
    _targets.length = 0;
    _crystalDraw.length = 0;
    if (rk && !rk.ended) {
      const live = sameCx(rk, X);
      if (live) {
        for (let k = 0; k < rk.n; k++) {
          const h = X.c[k][2];
          rk.hp[k] = X.m > 0 ? Math.max(0, h / X.m) : 0;
          if (rk.brokeAt[k] === null && !(h > 0)) {
            let b = null;
            for (const e of X.broke) if (e.c === k) b = e;
            breakCrystal(s, k, b ? b.at : t, t, b ? b.n : null);
          }
        }
      }
      if (!live || (rk.landAt !== null && t >= rk.landAt) || s.fell || s.wrath != null) {
        rk.ended = true; rk.endAt = t;
        rkDone = { i: rk.i, x0: rk.x0, z0: rk.z0 };
        for (let k = 0; k < rk.n; k++) if (rk.brokeAt[k] === null) breakCrystal(s, k, t, t, null, true);
      }
    }
    // THE STUN, said once as it comes (the Reckoning broken) - AUDIT WB9 (court F2): AFTER the last crystal's word, which
    // the same beat carries (the relay's cxb and stun, folded before this frame): said before it, the shatter's line took
    // the screen's one label and the stun's was never read
    if (s.stunAt && s.stunAt !== stunHeard && t < s.stunUntil) {
      stunHeard = s.stunAt;
      if (t - s.stunAt <= RECKON_LATE_MS) { say(COURT_RECKON_TEXT.broken()); sound(BOSS_CUES.stunned, s, t, null); }
    }
    if (!rk) return;
    if (rk.ended && t - rk.endAt > CRYSTAL_SHATTER_MS + 250) { rk = null; return; }
    const grow = crystalGrowth(t - rk.grewAt);
    // the targets my blows meet: the crystals standing, grown far enough out of the stone
    if (!rk.ended && grow >= CRYSTAL_STRIKE_GROWN && !(rk.landAt !== null && t >= rk.landAt - RECKON_CLOSE_MS) && fromHisCourt(s, t)) for (let k = 0; k < rk.n; k++) if (rk.brokeAt[k] === null) _targets.push(rk.targets[k]);   // AUDIT WB9 (brain F1, F2): from his court, and never in the Reckoning's last breath - the relay takes no blow then
    // the draw: each crystal's slot refilled - growing, standing, cracking as its health goes, flashing as I strike it,
    // flying apart once broken; a beam from each one standing into his chest while the Reckoning winds up
    const atk = s.atk, winding = !!atk && ATTACK_BY_ID[atk.a] === ATTACKS.reckon && t < atk.at;
    if (winding) { const [bx, bz] = bossPlace(s, t); _chest[0] = COURT_CENTRE[0] + bx; _chest[1] = COURT_CENTRE[1] + P.bossH * 0.62; _chest[2] = COURT_CENTRE[2] + bz; }
    const color = crystalColor(P);
    for (let k = 0; k < rk.n; k++) {
      const d = (_crystalSlots[k] ??= { at: null, yaw: 0, seed: 0, grow: 0, broke: -1, hp: 1, flash: 0, color: null, beam: null });
      const b = rk.brokeAt[k];
      d.at = rk.feet[k]; d.yaw = rk.yaw[k]; d.seed = rk.seed[k]; d.grow = grow;
      d.broke = b === null ? -1 : Number.isFinite(b) ? Math.max(0, (t - b) / 1000) : Infinity;
      d.hp = rk.hp[k];
      d.flash = Math.max(0, 1 - (t - rk.flashAt[k]) / CRYSTAL_FLASH_MS);
      d.color = color;
      d.beam = winding && b === null ? _chest : null;
      _crystalDraw.push(d);
    }
  }

  function loadBody(s) {
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch) return;
    const look = bossLookOf(s.boss), basics = ENEMY_BASICS[look.mobile];
    const archive = basics?.maleTexture;
    if (!archive) return;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      body = tex ? { tex, archive, scale: look.scale } : { failed: true };
      if (!tex) console.warn(`[gate] the boss's sprite (archive ${archive}) would not load`);
    }, (e) => { body = { failed: true }; console.warn('[gate] the boss\'s sprite', e?.message ?? e); });
  }

  function drawBody(s, t, P) {
    loadBody(s);
    const act = bossAct(s, t, hurtAt);
    if (s.fell && act.act === 'gone') drawCorpse(s);   // WB13e: his body left where he fell
    if (!body?.tex || act.act === 'gone') { batchShown = false; return; }
    const [x, z] = bossPlace(s, t);
    const at = courtToDungeon(x, bossHop(s, t) - (act.sink ?? 0), z);   // WBX5: high over the floor through a leap's arc; WB13e: sinking as he falls
    const eye = cam() ?? at;
    const fr = bossFrame(act, s.yaw, at, eye, (rec) => body.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${body.archive}_${rkey}`)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);   // a shared, cached object: read, never written
    const w = sz.w * body.scale * P.size, h = sz.h * body.scale * P.size;   // WB8b: Colossal stands a quarter larger
    const size = { w: fr.flip ? -w : w, h };
    if (!batch) {
      batch = renderer.createBillboardBatch(body.archive, rkey, { w, h }, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
    }
    batchShown = true;
    // WB13d: HIS BODY STRUCK - my blow flashes him whole, the court's (a share of his health gone, as the relay says it)
    // lightly; his fall is its own
    if (hpFlashSeen === null || s.hp > hpFlashSeen) hpFlashSeen = s.hp;
    else if (s.max > 0 && hpFlashSeen - s.hp >= s.max * GATE_FLASH_SHARE) { courtFlashAt = t; hpFlashSeen = s.hp; }
    setBatchHitFlash(batch, s.fell ? 0 : gateHitFlash(hurtAt, courtFlashAt, t));
    batch.record = rkey;
    batch.size = size;
    if (batch.bounds) batch.bounds[3] = Math.hypot(w, h) * 0.5;   // the cull sphere follows the frame's own size
    batch.origin[0] = at[0]; batch.origin[1] = at[1]; batch.origin[2] = at[2];
  }

  return {
    /** One frame of the court: the verdicts, the voice, the body, the ground's shape and the bar. */
    frame() {
      blowMet.clear();   // AUDIT WB11 W3: a frame ends my blow
      const s = link.state(), t = now();
      if (!s || s.day === null) { if (day !== null) this.leave(); return; }
      if (s.day !== day) reset(s.day);
      const P = profileOf(s);   // WB8b: the fight's marks, as law - the relay's word of them
      judge(s, t, P);
      judgeTrap(s);   // WBX7: a soul trap of mine on him, rolled at his fall
      burn(s, t, P);   // WBX5: the ground his landings left burning
      cue(s, t, P);
      crystals(s, t, P);   // WB9c: the Reckoning's crystals - seen, struck, broken, drawn
      host.frame(s, t, P, bossOf(s).name);   // WB11c: his host - seen, heard, struck, its blows judged on me
      fallEvent(s, t, P);   // WB13e: his fall, an event
      sputterSparks(s, t, P);   // WB13e: his ember sputtering under his low health
      fxFrame(s, t, P);   // WB9e: the sparks of his landings and the meteor's fall
      drawBody(s, t, P);
      burst(s, t);
      spoils?.frame(onSpoilRest);   // WB9f: each piece's landing sparks
      portalFrame(s, t, Number.isFinite(prevT) ? Math.max(0, t - prevT) / 1000 : 0);   // WBX2: the way home, once he has fallen
      shape = s.fell ? null : telegraphShape(s.atk, s.phase, t, P);
      // WBX4: his mark under him, while he stands; WBX5: the burning ground (WB8b: his aspect's)
      if (_markOf !== P) { _markOf = P; const ember = emberColor(P); markEmber = ember === EMBER_COLOR ? MARK_COLOR : markColorOf(ember); _mark = markShape([0, 0], 0, markEmber, P.bossR); }
      if (s.fell || s.wrath != null || bossAct(s, t, hurtAt).act === 'gone') mark = null;
      else { const [mx, mz] = bossPlace(s, t); _mark.origin[0] = mx; _mark.origin[1] = mz; _mark.yaw = s.yaw; _mark.color = t < s.shieldUntil ? WARD_COLOR : markEmber; _mark.court = nearestCourt(mx, mz); mark = _mark; }   // AUDIT WB D10's law: one shape, refilled; WB9b: over the court he stands in
      poolDraw = pools.length ? poolShapes(pools, t, poolColor(P), TELEGRAPH_STYLE[P.el] ?? TELEGRAPH_STYLE.fire) : NONE;   // WB9e: his ground in its own grain
      for (const w of WALKS) _walked[w.k] = walkFormed(s.xa, w.k, t);   // AUDIT WB9 (court F4): how far each walkway is laid - his shapes go on over it
      // WB13a: a blow still to come on my feet (WB13c: the bar says MOVE by its name; never over the step's fire)
      const fp = feet(), alive = !!fp && (player()?.health ?? 0) > 0;
      const peril = alive ? perilAt(s, t, P, fp[0] - COURT_CENTRE[0], fp[2] - COURT_CENTRE[2], yaw()) : null;
      drawGateBossBar(bossBarModel(s, t, bossOf(s), peril?.name ?? null), { hidden: hudHidden() || veiled() });
      // WB9a (Mac: "Allow people to see the modifers/trial as a popup before it starts"): THE MARKS' CARD as I step in -
      // his aspect and his trials, each with its sign, its line and how to meet it, while he stands to be read
      // (net/gateBrain.js OPENING_MS); gone once he has fallen, and never over the step's fire
      if (marksAt !== null && s.fell) marksAt = null;
      drawGateMarksCard(marksAt !== null ? marksCardModel(s.md, bossOf(s), { mode: 'arrive', since: marksAt, now: t }) : null, { hidden: hudHidden() || veiled() });
      drawGateTitleCard(titleCardModel(beat, t), { hidden: hudHidden() || veiled() });   // WB13e: his wake, a phase's turn, his fall
      // GATE-UX (Mac: "a detailed damage chart after the boss kill, showing and ranking everyone's damage"): THE DAMAGE
      // CHART once he has fallen - the relay's own count of every challenger's part, to the side, never over the step's fire
      if (s.fell && chartAt === null) chartAt = t;
      drawGateDamageChart(chartAt !== null ? damageChartModel(s.fell, { boss: bossOf(s).name, me: me(), since: chartAt, now: t }) : null, { hidden: hudHidden() || veiled() });
      // WB9d: his ground under me and his element on me, felt - the screen's rim in its colour, the warning while I stand in
      // it; WB13a: and a blow still to come on my feet, over all of it, with the way out
      drawGateGround(groundViewModel({ inside: inFire, ground: groundName, color: groundColor, biteAt, biteColor, now: t, peril }), { hidden: hudHidden() });
      if (healOwed.size && t - healSentAt >= HEAL_SEND_MS) sendOwed(t);   // GATE-HEAL: what my mates healed in me, out
      prevT = t;
    },
    /**
     * GATE-HEAL: ANOTHER'S SPELL HEALED ME `n` points (scenes/world.js onCast - the health that moved; the door turns the
     * fallen away and never hears my own), `id` the caster's peer id in the room: owed to them. False outside a live fight.
     */
    healedBy(id, n) {
      if (!healLive(link.state()) || !(n > 0) || typeof id !== 'string' || !id) return false;
      healOwed.set(id, (healOwed.get(id) ?? 0) + n);
      return true;
    },
    /**
     * WB4b: HIM AS A BODY MY BLOWS MEET, or null (no fight, or he has fallen): his feet in the dungeon's frame, his
     * facing, his height and radius (net/gateBrain.js - the relay measures a melee blow from the same body), whether
     * his ward stands, and his stand-in for the formulas (world/gateBoss.js bossStandIn).
     */
    target() {
      const s = link.state(), t = now();
      // AUDIT WB B6: nor once the Wrath has come - the relay judges no blow after it, and he is no one's to strike
      if (!s || s.day === null || s.fell || s.wrath != null || bossAct(s, t).act === 'gone') return null;
      standIn ??= bossStandIn(bossLookOf(s.boss), bossOf(s).name);
      const [x, z] = bossPlace(s, t), P = profileOf(s);
      return { feet: courtToDungeon(x, 0, z), yaw: s.yaw, height: P.bossH, radius: P.bossR, warded: t < s.shieldUntil, entity: standIn, mobile: bossLookOf(s.boss).mobile };   // WB8b: his profile's body - the relay measures a blow from the same
    },
    /**
     * WB4b: A BLOW OF MINE MET HIM - `d` the formula's number on this machine, `r` its kind (net/gateBrain.js
     * HIT_KINDS). Out to the relay as the wire's hit (whole points, my blow's sequence - blowQ), and he flinches. The ward
     * turns it (nothing sent - the relay would refuse it); a blow under one point is none. Answers whether it went.
     */
    hit({ d, r }) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !Object.values(HIT_KINDS).includes(r)) return false;   // AUDIT WB B6
      if (t < s.shieldUntil) return false;
      if (!fromHisCourt(s, t)) return false;   // AUDIT WB9 (brain F1): the relay takes no blow from outside the court he fights in
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      hurtAt = t;
      return !!send({ q: blowQ('b'), d: dmg, r });
    },
    /** A blow of mine landed on him: he flinches. */
    struck() { hurtAt = now(); },
    /**
     * WB9c: THE CRYSTALS OF OBLIVION AS BODIES MY BLOWS MEET - each standing one's number (the wire's `c`), its foot in the
     * dungeon's frame, its body (net/gateBrain.js CRYSTAL_R, CRYSTAL_H - the relay measures a melee blow to the same) and
     * the stand-in a blow on it is computed against (world/gateBoss.js crystalStandIn); none outside a Reckoning, and
     * none still low in the stone. One list, refilled each frame (AUDIT WB D10's law) - read, never written.
     */
    crystalTargets() {
      const s = link.state();
      return !s || s.day === null || s.fell || s.wrath != null ? NONE : _targets;
    },
    /**
     * WB9c: A BLOW OF MINE MET A CRYSTAL - `c` its number, `d` the formula's number on this machine, `r` its kind. It
     * flashes and rings here at once, and the number goes out as the wire's `xhit` (whole points, my blow's
     * sequence - blowQ); the relay's caps decide what lands and say its health back. A blow under one point is none. Answers
     * whether it went.
     */
    crystalHit({ c, d, r } = /** @type {any} */ ({})) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !rk || rk.ended || !Object.values(HIT_KINDS).includes(r)) return false;
      if (!Number.isInteger(c) || c < 0 || c >= rk.n || rk.brokeAt[c] !== null) return false;
      if ((rk.landAt !== null && t >= rk.landAt - RECKON_CLOSE_MS) || !fromHisCourt(s, t)) return false;   // AUDIT WB9 (brain F1, F2)
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      rk.flashAt[c] = t;
      sound(BOSS_CUES.crystalHit, s, t, null, rk.feet[c]);
      return !!sendCrystal({ c, q: blowQ(`x${c}`), d: dmg, r });
    },
    /**
     * WBX7: A SOUL TRAP OF MINE LAID ON HIM (the dungeon context's spell door - scenes/dungeonContext.js spellOnBoss): its
     * chance and its rounds, kept on the relay's clock until his fall rolls it. A trap already running takes the new
     * rounds and keeps its own chance (AddState, SoulTrap.cs:94-97 - systems/effects.js's own law). Answers whether it
     * was kept (no fight, a fight over: nothing to keep it for).
     * @param {{ chance?: number, rounds?: number }} [trap]
     */
    trapped({ chance, rounds } = {}) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !Number.isFinite(chance) || !(rounds > 0)) return false;
      if (trapMark && t < trapMark.until) trapMark.until += rounds * COURT_ROUND_MS;
      else trapMark = { chance, until: t + rounds * COURT_ROUND_MS, day: s.day };
      return true;
    },
    /**
     * WB11c: HIS HOST AS BODIES MY BLOWS MEET - each one standing: its number (the wire's `i`), its feet in the dungeon's
     * frame, its body (net/gateBrain.js HOST_KINDS - the relay measures a melee blow to the same), its stand-in and its
     * name (world/gateBoss.js hostStandIn); none but from the court he fights in (the relay takes no blow from elsewhere).
     * One list, refilled each frame - read, never written.
     */
    hostTargets() {
      const s = link.state(), t = now();
      return !s || s.day === null || s.fell || s.wrath != null || !s.lg || !fromHisCourt(s, t) ? NONE : host.targets();
    },
    /**
     * WB11c: A BLOW OF MINE MET ONE OF HIS HOST - `i` its number, `d` the formula's number on this machine, `r` its kind:
     * it flinches here at once and the number goes out as the wire's `ahit` (scenes/gateHost.js hit). Answers whether it
     * went.
     */
    hostHit({ i, d, r } = /** @type {any} */ ({})) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !s.lg || !Object.values(HIT_KINDS).includes(r) || !fromHisCourt(s, t)) return false;
      return host.hit({ i, d, r }, t);
    },
    /** AUDIT WBX F6: my soul trap on him while it runs (`{chance}`), or null - a recast stacks onto it as it would on any
     *  foe (effects.js AddState: its rounds, no new save), where his stand-in forgets every trap between casts. */
    trapNow() { const t = now(); return trapMark && t < trapMark.until ? { chance: trapMark.chance } : null; },
    /** The body and the spoils, for the host's billboard pass (AUDIT WB D10: one list, refilled each frame). */
    batches() {
      _batches.length = 0;
      if (batch && batchShown) _batches.push(batch);
      if (corpse) _batches.push(corpse);   // WB13e: his body left where he fell
      for (const b of host.batches()) _batches.push(b);   // WB11c: his host
      for (const b of spoils?.batches() ?? NONE) _batches.push(b);
      return _batches;
    },
    /** The glow on him and on the spoils, for the court's light channel (world/gateArena.js withCourtLights). */
    lights() {
      const s = link.state(), t = now(); const g = s && s.day !== null ? bossGlow(s, t) : null;
      _lights.length = 0;
      if (g) _lights.push(g);
      if (s && s.day !== null) {
        const [hx, hz] = bossPlace(s, t);
        // WB13e: his fall - the court's light white at the kill
        if (t >= fallFlashAt && t - fallFlashAt < FALL_FLASH_MS) _lights.push(flash(_fallLight, courtToDungeon(hx, 3, hz), WHITE, 4 * (1 - (t - fallFlashAt) / FALL_FLASH_MS), 40));
        // WB13e: the Wrath - his court reddening as it gathers, then white as it lands
        const atk = s.atk;
        if (atk && atk.a === ATTACKS.wrath.id) {
          const C = COURTS[nearestCourt(hx, hz)], w = windupOf(ATTACKS.wrath, s.phase), k = (t - (atk.at - w)) / w, at = courtToDungeon(C[0], WRATH_LIGHT_Y, C[1]);
          if (k >= 0 && k < 1) _lights.push(flash(_wrathLight, at, WRATH_RED, 3 * k * k, WRATH_LIGHT_RANGE));
          else if (k >= 1 && t - atk.at < FALL_FLASH_MS) _lights.push(flash(_wrathLight, at, WHITE, 5 * (1 - (t - atk.at) / FALL_FLASH_MS), WRATH_LIGHT_RANGE));
        }
      }
      // WB9c: each crystal standing lights the floor about it, breathing - one light a crystal, refilled
      for (let k = 0; k < _crystalDraw.length; k++) {
        const d = _crystalDraw[k];
        if (!(d.broke < 0) || !(d.grow > 0.05)) continue;
        const L = (_crystalLights[k] ??= { x: 0, y: 0, z: 0, range: CRYSTAL_LIGHT_RANGE, color: [0, 0, 0] });
        const kk = d.grow * (0.55 + 0.45 * d.hp) * (1.1 + 0.25 * Math.sin(t / 240 + d.seed * 6) + 0.8 * d.flash);
        L.x = d.at[0]; L.y = d.at[1] + CRYSTAL_LIGHT_Y; L.z = d.at[2];
        L.color[0] = d.color[0] * kk; L.color[1] = d.color[1] * kk; L.color[2] = d.color[2] * kk;
        _lights.push(L);
      }
      // WB13d: a landing away from him lights the floor where it fell (the meteor's, the hellfire's), fading
      for (let k = 0; k < _bursts.length; k++) {
        const b = _bursts[k], L0 = b.kind?.light, age = t - b.at0;
        if (!L0 || !(age >= 0) || age >= FX_LIGHT_MS) continue;
        const L = (_landLights[k] ??= { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] }), kk = L0[0] * (1 - age / FX_LIGHT_MS);
        L.x = b.at[0]; L.y = b.at[1] + LANDING_LIGHT_Y; L.z = b.at[2]; L.range = L0[1];
        L.color[0] = b.color[0] * kk; L.color[1] = b.color[1] * kk; L.color[2] = b.color[2] * kk;
        _lights.push(L);
      }
      for (const l of host.lights()) _lights.push(l);   // WB11c: a Ward-Bearer holding his ward glows in its gold
      for (const l of spoils?.lights() ?? NONE) _lights.push(l);
      return _lights;
    },
    /** The telegraph and the spoils' glow, in the host's world pass (after the court and the billboards, before the
     *  foes' screen quads). Answers whether either drew (the host marks the foreign pass). */
    drawPass(proj, view, eye, seconds, fog = null) {
      let drew = false;
      if (_crystalDraw.length) {   // WB9c: the crystals first - opaque, their depth written, so his ground's glow sits behind them
        if (!crystalTried && gl) { crystalTried = true; try { crystalPass = new CourtCrystalRenderer(gl); } catch (e) { console.warn('[gate] the crystals would not build', e?.message ?? e); crystalPass = null; } }
        if (crystalPass) { crystalPass.draw(_crystalDraw, proj, view, eye, seconds, fog); drew = drew || crystalPass.drawn > 0; }
      }
      if (pass) {
        for (const ps of poolDraw) { pass.draw(ps, proj, view, eye, seconds, fog, COURT_CENTRE, _walked); drew = true; }   // WBX5: the burning ground under all
        if (mark) { pass.draw(mark, proj, view, eye, seconds, fog); drew = true; }   // WBX4: where he stands and faces
        if (shape) { pass.draw(shape, proj, view, eye, seconds, fog, COURT_CENTRE, _walked); drew = true; }   // AUDIT WB9 (court F4): and over the laid walkways
        for (const hs of host.shapes()) { pass.draw(hs, proj, view, eye, seconds, fog, COURT_CENTRE, _walked); drew = true; }   // WB11c: his host's blows, its paths and its tethers
      }
      if (_fxLive.length || meteorNow) {   // WB9e: his blows landing - the sparks and the meteor's fall, over the telegraph
        if (!fxTried && gl) { fxTried = true; try { fxPass = new GateFxRenderer(gl); } catch (e) { console.warn('[gate] his effects would not build', e?.message ?? e); fxPass = null; } }
        if (fxPass) { fxPass.draw(_fxLive, meteorNow, proj, view, eye, seconds, fog); drew = drew || fxPass.bursts > 0 || fxPass.meteors > 0; }
      }
      if (portal && portalPass) {   // WBX2: the portal home's fire and its beacon, rising where he fell
        portalPass.draw([{ origin: portal.origin, yaw: 0, open: 1, fade: portal.rise, spin }], proj, view, eye, seconds, fog);
        drew = drew || portalPass.drawn > 0;
      }
      const lit = !!spoils?.drawPass(proj, view, eye, seconds, fog);
      return drew || lit;
    },
    /** What the driver holds, for the tests and the stats. */
    state: () => ({
      day, judgedI: judged.i, cuedI: cued.i, landedI: landed.i, phaseHeard, fellCued, wrathLanded, body: !!body?.tex, batch: !!batch && batchShown, shape, mark, pools: pools.map((p) => ({ ...p })), portal: portal ? { at: [...portal.at], rise: portal.rise, laid: portalLaid } : null,
      // WB9c: the crystals as this screen holds them; WB9d: the ground I stand in and the last bite's moment
      crystals: rk ? { i: rk.i, n: rk.n, ended: rk.ended, brokeAt: [...rk.brokeAt], hp: [...rk.hp], grewAt: rk.grewAt } : null, drawn: _crystalDraw.map((d) => ({ ...d })), inFire, biteAt,
      // WB9e: the sparks flying and the meteor falling
      bursts: _fxLive.map((b) => ({ at: [...b.at], t: b.t, kind: b.kind, color: b.color })), meteor: meteorNow ? { at: [...meteorNow.at] } : null,
      host: host.state(),   // WB11c: his host as this screen holds it
      marksAt,   // WB13b: when the marks' card stood up (the step into the court) - held, never moved by a frame
      beat: beat ? { ...beat } : null, corpse: !!corpse,   // WB13e: the card over the court, and his body left on the floor
    }),
    /** WBX2: the portal home, while it stands - where (the court's frame) and how far it has risen - or null. */
    portal: () => (portal ? { at: [...portal.at], rise: portal.rise } : null),
    /**
     * MWNPC10: THE BODIES, before the billboard pass the court's batches draw in (worldModes.js's dungeon pass): him -
     * standing, his blow a swing as the relay's attack changes, struck a recoil, three times a man as his sprite is; fallen,
     * dead on his corpse's flat - and his host (gateHost.js offerBodies). A billboard whose body stands casts alone.
     */
    drawBodies(canvas, proj, view, eye, dt) {
      bodiesLane.frame();
      const s = link.state();
      if (s && s.day !== null && body?.tex) {
        const look = creatureLook({ mobileType: bossLookOf(s.boss).mobile });
        const shown = batch && batchShown ? batch : (s.fell && corpse ? corpse : null);
        if (shown && look) {
          const t = now(), act = bossAct(s, t, hurtAt);
          bodiesLane.offer(rosterActor(bossRec, { id: 'boss', look, feet: shown.origin, yaw: s.yaw, moving: act.act === 'walk' || act.act === 'run', running: act.act === 'run',
            swingKey: s.fell ? null : (s.atk?.at ?? null), hitKey: s.fell ? null : Math.max(hurtAt, courtFlashAt), dead: s.fell ? 2 : 0,
            scale: (body.scale ?? 1) * (profileOf(s).size ?? 1) }), shown);
        }
        host.offerBodies(bodiesLane);
      }
      bodiesLane.draw(canvas, proj, view, eye, dt);
    },
    /** Out of the court: the body put away, the bar hidden, the fight forgotten (the texture is kept - the next court wears it). */
    leave() {
      bodiesLane.destroy();   // MWNPC10: and the bodies
      if (healOwed.size) sendOwed(now());   // GATE-HEAL: what my mates healed in me goes before the court is put away
      spoils?.gather();   // WB5: whatever is still on the floor goes into the pack - never lost to a door, a death or the day's end
      if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; batchShown = false; }
      drawGateBossBar(null);
      drawGateMarksCard(null);   // WB9a
      drawGateDamageChart(null);   // GATE-UX
      drawGateGround(null);   // WB9d
      drawGateTitleCard(null);   // WB13e
      host.leave();   // WB11c: his host's bodies put away
      reset(null);
    },
  };
}
