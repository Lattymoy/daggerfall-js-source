// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8, 12, 13 and 25) and EG-FULL
// (2026-10-11, Mac: "I said I want everything"): AN ELITE BREACH'S FIGHTS ON THIS SCREEN - the hall's fight as the relay
// says it in the Spire's own words (net/eliteGates/egLink.js's fold of net/eliteGates/egBodies.js's frames), its frame the hall's own:
//   THE BODIES - every lord and champion (its own look: world/egLaw.js EG_LORDS, net/eliteGates/egLords.js egBossLook - a Daggerfall
//     mobile at its scale), every add of the legion (net/eliteGates/egLegion.js egKindLook, by the band), each acting what it does
//     (rising, walking, winding up, striking, flinching, falling); the errands' objects - the struck ones (rifts, anchors,
//     banners, hearts, seals, braziers, standards, chains, pillars, sparks) as the Reckoning's crystals in their colours
//     (render/courtCrystals.js), the stood-on ones (runes with their numerals, soul-gems, havens, the relic, the engine,
//     the Orrery's stones' rings - each stone stands over its own, scenes/eliteGates/egOrrery.js - umbral discs) on the floor;
//   THE BLOWS - each FULL shape stamp drawn by the telegraph pass (render/gate/gateTelegraph.js) in THE SPIRE DANGER EDGE,
//     the TELEGRAPH BUDGET's order (net/eliteGates/egShape.js egShapeOrder), a CHECK's havens gold; each judged against MY OWN FEET at
//     its landing (co-op's law - net/eliteGates/egShape.js egBlowVerdict), its share of my health through my saving throw, its push;
//   THE ZONES - burning ground ticking, the floor gone (a cast-back), a Soul-Pool, a haven;
//   THE TETHERS - a Wraith's drain on me ticking, a Blood Tether, a chain (the stay-close grammar), a challenge's ring;
//   THE PLACE - a gust's push, the Gutterdark, the Colossus's Rails; EG-FULL LAYER THREE: every fragment's hazard on the
//     shared clock (net/eliteGates/egFragLaw.js) drawn and judged on my own feet - a fire fall, a surge, the basalt, the cascade, the
//     hammers, the tide, the Eclipse, a soul-wisp's drain.
// Nothing is sent but my blows (`hit` on a body by its number - the relay's caps decide what lands).
// EG-G2 (2026-10-12, sections 25 and 26): the Spire's own telegraph stage (render/gate/gateTelegraph.js TELEGRAPH_FS_SPIRE - the
// fog floor, the fill, the style bit), each shape in the shelf's danger palette and fill (ui/eliteGates/egAccess.js egAccessNow), a
// shape aimed at another member filled at THE QUIET COMPANY's 0.55 and mine drawn last with a brighter rim; THE SPIRE MIX
// (systems/eliteGates/egMix.js): a personal sting for a lord's blow or a CHECK on my feet (an add's at most one each 1.5 s), the score
// ducked under the critical bus, the legion's wind-up barks capped four a kind, nearest first.
// EG-ZD (2026-10-12, Mac: "I said I want everything"; section 13.2, an EG-H1 departure retired): THE FEINT'S DASHED FADE - a cut
// blow's fill frozen where the cut found it and its whole mark dashed as it fades over TELL_FEINT_FADE (ai/blowShapes.js -
// Feud-Arc section 7.3's own number), the Spire stage's `uLook` 4 (world/eliteGates/egLook.js EG_LOOK_BIT.dash); and the mix handed to
// the breach's client (`mix`), so the HUD's beats ride its critical bus (section 26).
// EG-ZG (2026-10-12, sections 11.7, 25.2, 25.4-25.6 and 25.8 - world/eliteGates/egTelegraph.js the law): THE TELEGRAPHS AS WRITTEN -
// each shape on every fight floor it covers, clipped to that floor at its own height (at most 32 shape-floor draws a
// frame, THE TELEGRAPH BUDGET's order); the peril arrow under the crosshair (the gate's own readout, ui/gate/gateGroundView.js);
// the tethers' two grammars, a Spire pool on the band's ramp with its dashed rim, the Eclipse's darkening, wind and toll;
// the marks as sigils over heads; a Vestige aura's blue ring at its holder's feet; the Shade's rim light on every foe;
// the heavy blows' shakes, allies' hits flashing at 0.4, a Drop's thud and dust.
// EG-ZH (2026-10-12, sections 11.6, 25.8 and 26): THE SPIRE MIX's last two - every peer's sound 4 dB down while a hall's
// fight runs (systems/eliteGates/egMix.js `peers`), WATCHFIRE'S TELL at pitch 1.4 where each told blow will land, once a blow (`tell`);
// and THE CAVERNS' FIRE FALLS in Daggerfall's own TEXTURE.356 (world/eliteGates/egHall.js egFireFallFlames) while each burns, its
// frames at the billboards' rate (render/flatAnimation.js GENERAL_FPS).
// EG-ZJ (2026-10-12, sections 11.7, 22 and 23): EVERY BODY ON ITS OWN FEET - each drawn, struck at and heard at the height the
// room says it stands (net/eliteGates/egLink.js egBodyHeight - a span's Harrier beside its member down a course, a Deepway's Lurker on
// the floor past its shaft, a Court laid above the hall's own height), never the hall's; and the Cooling Slag's spill and
// its crust's last second told on the crust's own surface (world/eliteGates/egTelegraph.js egHazardSurface).

// EG-ZP (2026-10-12, sections 15 and 21): THE RECEIVER'S VESTIGES - a blow on me spared what the relay's census spares it
// (net/eliteGates/egBrain.js egCensusDr, called on what this screen holds - egShieldDr): Bastion near me, my Steadfast Line, my
// Lifeline windows (egLifelineOpen, opened by scenes/eliteGates/egClient.js as my heal word goes), my Challenger's Oath and my
// Immovable, together never past 30% - so my body and the room's count of it take the same blow.
// EG-ZR (2026-10-12, section 15): THE VESTIGES ON THEIR HOLDER - my blows on a Spire body carry Searing Edge, Momentum,
// Bloodied Fury and Overcharge (systems/eliteGates/spireVestiges.js egHolderBlow) and an Arcane Echo's repeat (hostHit); SHIELD-HYMN on
// my screen (`rally` - net/eliteGates/egVestige.js egHymnOf on where the screen draws the company, read by egShieldDr with the census's
// law); Immovable's push half (`immovable` - the census's own stillness on my trail); a blow's share of the body without
// Stoneskin's cushion (systems/renownLayer.js spireBodyMax).
// AUDIT EG III (2026-10-13, the client group; sections 13.3 and 13.4): THE TWINS' TOUCHED on my screen (egTouchedX - Vael's
// blow on the Fire-touched, Isk's on the Frost-touched, +25%) and MORVAYN'S CHAINING (egChainMates - a blow on any of my
// chain split over it, a mate's judged at their drawn feet); the title card only ever this fight's own, and a leave that
// holds nothing touches nothing (the Burning Court's card stands).
// EG-LOOK (2026-10-15, Mac: "Bosses should also be oversized sprites. Not modeled like the abyss dungeon"; bible/11-Multiplayer/
// Elite-Gates-Look.md section 9): THE LORDS, OVERSIZED - every lord and champion still Daggerfall's own sprite, drawn at its
// PRESENCE (egPresenceOf - world/eliteGates/egKit.js EG_LORD_PRESENCE: a Court's lord 1.6, a Valkynaz 1.8, a champion 1.4, a twin and a
// mirror their own lord's) over its body's scale (egLookOf `drawn` beside `scale`, which stays the body's): the billboard grows up
// from its feet on the body's place (the renderer's quad is base-anchored), a flyer's hover rises with it, the grown sprite casts
// no shadow (OW-BIG's law), and an errand's numerals stand over the drawn head (egGivenAt). The hit target's reach (its
// radius - the relay's bodyR), every sound, the telegraphs and the wire are the body's as before; the target's HEIGHT is the
// drawn sprite's (the relay judges no height - a shot at the head you see meets him): the drawn size is this screen's alone.
// FB1018D (2026-10-18, FIELD BUGS 2026-10-18d; Boar, #bug-reports): THE CHALLENGE'S RING OF FIRE drawn where the room stands it
// (duelRing - only the motor was kept to it), A WINCH'S PLATES marked as the stood-on errands are (winchPlates), the open duel
// said as one at n = 1, the Conquest's word saying what its banners do, and every beat's word past the fold's twelve (beats).
// FIELD BUGS 2026-10-19f GAUNTLET-PLATES (2026-10-19, a player's private report): A GAUNTLET'S PLATES marked as the Winch's are,
// on their pillars' tops, each dimmed once its Caster is silenced (gauntletPlates, egPlateY).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { HIT_KINDS, CRYSTAL_R, CRYSTAL_H } from '../../net/gate/gateBrain.js';
import { strikeDamage, savedShare } from '../../net/gate/gateStrike.js';
import { bossFrame, crystalStandIn, hostStandIn, hostCue, BOSS_CUES, CRYSTAL_CLIPS } from '../../world/gate/gateBoss.js';
import { wordShare } from '../../combat/healthShare.js';   // FIELD BUGS 2026-10-18f RELAY-SHARE: a body's health's share, the relay's word
import { GateTelegraphRenderer, telegraphPrograms, TELEGRAPH_KIND, TELEGRAPH_STYLE, TELEGRAPH_EDGE_DAGON, TELEGRAPH_EDGE_SAFE, TELEGRAPH_POOL, TELEGRAPH_POOL_HAVEN, TELEGRAPH_POOL_SPIRE } from '../../render/gate/gateTelegraph.js';
import { CourtCrystalRenderer, CRYSTAL_PROGRAMS } from '../../render/courtCrystals.js';
import { compiledPass } from '../../render/glProgram.js';   // SHADER-STALL: the breach's passes built once their programs are done
import { titleCardModel, drawGateTitleCard, TITLE_HOLD_MS } from '../../ui/gate/gateTitleCard.js';
import { setBatchHitFlash, setBatchGlint } from '../../systems/hitFlash.js';
import { groundViewModel, drawGateGround } from '../../ui/gate/gateGroundView.js';   // EG-ZG: the peril arrow and the chain's words, the gate's own readout
import { screenBearing } from '../gate/gateCourt.js';   // EG-ZG: the way out as the screen turns it
import { PHASE_NUMERALS } from '../gate/gateCourt.js';   // AUDIT EG V (lane1 #14): the gate's phase card's numerals
import { egFightFloors, egFloorPlan, egFloorPlanKeep, egHazardSurface, egPerilOf, egTetherKind, egTetherBreak, egPullLook, egChainLook, egChainWords, egPoolRgb, egEclipseAt, egEclipseDark, egEclipseOfBlows, egSigilsOf, egScreenAt, egViewYaw, egAuraHolders, egRimOf, egHeavyShake, egShakeMotion, egBodyFlash, egDropUnder,
  EG_CHECK_ORDER, EG_ECLIPSE_LOOK, EG_SIGIL_UP_M, EG_AURA_RING, EG_DROP_THUD, EG_TETHER, EG_GUARD_SOUND, EG_GUST_TELL_MS, EG_GUST_SOUND } from '../../world/eliteGates/egTelegraph.js';   // EG-ZG: THE TELEGRAPHS AS WRITTEN, the law
import { EG_SHADE_BAND } from '../../world/eliteGates/egTelegraph.js';   // AUDIT EG V (lane1 #13): in the dark every foe keeps the Shade's rim light
import { drawEgSigils } from '../../ui/eliteGates/egSpireHud.js';   // EG-ZG: the marks over heads
import { spireStoneWords } from '../../systems/eliteGates/spireOrrery.js';   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): a stone's name and hour, over it
import { EG_STONE_TOP_M } from './egOrrery.js';   // FIELD BUGS 2026-10-20f (ORRERY-STONES): a stone stands, its words over its crown
import { reportPlayerAttack } from '../../combat/formulas.js';   // FIELD BUGS 2026-10-20f (LANDED-WORD): the number, at the room's word
import { EG_NUMERALS } from '../../ui/eliteGates/egParty.js';   // AUDIT EG IV (lane1 #15): the company's numerals, an errand's member drawn by its
import { egMemberOf } from '../../net/eliteGates/egLink.js';
import { multiply } from '../../world/mat4.js';
import { getPref } from '../../systems/uiPrefs.js';
import { betterAmbience } from '../../systems/betterAmbience.js';   // EG-ZG: the heavy blows' shakes - the port's one shaker, under the player's own maxShake
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { stateAnims, FLY_ANIM_SPEED, PRIMARY_ATTACK_ANIM_SPEED, HURT_ANIM_SPEED } from '../../characters/mobile/mobileUnit.js';
import { setSpireStruck } from '../../systems/sigil/sigilSetPowers.js';   // AUDIT EG V (L8-1): a body's blow, marked for the Spire's two hurt saves
import { mobileBillboardSize } from '../../world/rmbFlats.js';
import { egHallOf, egCountText, egVentAt, egInVent, EG_LORDS, EG_BANDS, EG_VENT_PCT, EG_VENT_WARN_MS, EG_VENT_FIRE_MS } from '../../net/eliteGates/egLaw.js';
import { egRimCastsBack } from '../../net/eliteGates/egLaw.js';   // AUDIT EG V (lane1 #21): the magma casts back only off every causeway
import { EG_CHAMPIONS } from '../../net/eliteGates/egLaw.js';   // EG-LOOK (section 9): which bosses are champions - drawn at a champion's presence
import { EG_LORD_PRESENCE } from '../../world/eliteGates/egKit.js';   // EG-LOOK (section 9): THE LORDS' PRESENCE
import { egVentState, egInVentDisc, egPendAt, EG_VENT_R, EG_VENT_TELL_S, EG_PEND_REACH, EG_PEND_HALF, EG_PEND_CLEAR_MIN } from '../../net/eliteGates/egSpanLaw.js';
import { egSlagState, egSlagX, EG_SLAG_SPOUTS, EG_SLAG_CRUST_S, EG_SLAG_WARN_S } from '../../net/eliteGates/egSpanLaw.js';   // EG-ZC: a slag crust's break told
import { egBodyPlace, egBodyHeight } from '../../net/eliteGates/egLink.js';   // EG-ZJ: a body's feet
import { egBlowVerdict, egInShape, egShapeOrder, coneInscribed } from '../../net/eliteGates/egShape.js';
import { EG_ROLE, EG_FL, EG_FEINT_AT } from '../../net/eliteGates/egBodies.js';
import { egStruckOff, egStrikeTurned } from '../../net/eliteGates/egBodies.js';   // FIELD BUGS 2026-10-18f TURNED-BLOW: a blow the relay will refuse, by its own law
import { EG_BEAT_TRIAL_MS } from '../../net/eliteGates/egDurable.js';   // EG-PERFECT: the relay's beat, which a feint's cut can pass FEINT_AT by
import { t } from '../../systems/textManager.js';   // EG-PERFECT: the words this pass adds, in the player's language; FB1018D DUEL-RING: the open duel's; FIELD BUGS 2026-10-18f TURNED-BLOW: the ground's word
import { egKindLook, EG_LEGION_KINDS } from '../../net/eliteGates/egLegion.js';
import { EG_BOSS_KEYS, EG_OBJ, egBossLook, egBossName } from '../../net/eliteGates/egLords.js';
import { EG_MARK_FIRE, EG_MARK_FROST, EG_TOUCH_X } from '../../net/eliteGates/egLords.js';   // AUDIT EG III (lane1 #4): the Touched marks and their weight - the lords' one home
import { egLordPhase, moonShafts } from '../../net/eliteGates/egLords.js';   // AUDIT EG V (lane1 #13, #14): the phase cards; the Long Night's moon-shafts kept lit
import { EG_DUEL_OPEN } from '../../net/eliteGates/egLords.js';   // FB1018D DUEL-RING: a Challenge met in the open (n = 1), said as one
import { shRing } from '../../net/eliteGates/egShape.js';   // FB1018D DUEL-RING: the ring of fire's band
import { egHallCentre, egFireFallFlames, EG_FIRE_FALL } from '../../world/eliteGates/egHall.js';   // EG-ZH: the fire falls' flames
import { GENERAL_FPS } from '../../render/flatAnimation.js';   // EG-ZH: DaggerfallBillboard's framesPerSecond - the fire falls' frames
import { egHazardParts, egHazardBites, egWispAt, EG_HAZARDS } from '../../net/eliteGates/egFragLaw.js';   // EG-FULL LAYER THREE: the fragments' hazards
import { egAccessNow, egPaletteOf, egReducedMotion } from '../../ui/eliteGates/egAccess.js';   // EG-G1 (section 25.7): the shelf's danger palette and fill - their one home
import { egPaletteBits, egQuietCompany, EG_FOG_FLOOR } from '../../world/eliteGates/egLook.js';   // EG-G2: the palette's style bit, the quiet company, the fog floor
import { createSpireMix } from '../../systems/eliteGates/egMix.js';   // EG-G2: THE SPIRE MIX - personal stings, the critical bus, the barks' cap
import { EG_LOOK_BIT } from '../../world/eliteGates/egLook.js';   // EG-ZD: a cut feint's dashed fade
import { TELL_FEINT_FADE } from '../../ai/blowShapes.js';   // EG-ZD (section 13.2): the feint's fade - Feud-Arc section 7.3's one number
import { egCensusDr, EG_HEAL_WORD_MS, EG_LIFELINE_MS } from '../../net/eliteGates/egBrain.js';   // EG-ZP (sections 15 and 21): THE CENSUS'S VESTIGES, the relay's own law; Lifeline's window
import { EG_TOUCH_M } from '../../net/eliteGates/egBrain.js';   // FB1018D WINCH-PLATES: the reach the room counts a member on a winch plate within (FIELD BUGS 2026-10-19f GAUNTLET-PLATES: and on a Gauntlet's)
import { EG_TRAIL_MS } from '../../net/eliteGates/egFair.js';   // EG-ZP: how long the census keeps a trail - and a Lifeline window
import { egBlowLandsOn } from '../../net/eliteGates/egFair.js';   // THE ASCENT - HEIGHT: a blow lands on its own storey, on every screen as on the relay
import { egFightView } from '../../net/eliteGates/egWalkGraph.js';   // EG-ZP: the hall's fight ground, the census's floor
import { egFeetY, egBears, egByHeight, egOneStorey, egStoreyY } from '../../net/eliteGates/egWalkGraph.js';   // THE ASCENT - HEIGHT: a zone lies on its own floor, a blow is mine on my storey alone
import { egRunOfMember } from '../../net/eliteGates/egLink.js';   // EG-ZP: each member's Vestiges and Mastery
import { egVOf, egHymnOf, egDeclaredX, EG_BLOODIED_UNDER, EG_HYMN_MS } from '../../net/eliteGates/egVestige.js';   // EG-ZR (section 15): the holder's Vestiges, Shield-Hymn's pair
import { egAccordMates, EG_ECHO_Q } from '../../net/eliteGates/egVestige.js';   // EG-ZS (section 15): the pair law; an Echo's number
import { EG_MASTERIES } from '../../net/eliteGates/egVestige.js';   // AUDIT EG III (lane4 #10): Immovable's number - the census asked only for its holder
import { egHolderBlow } from '../../systems/eliteGates/spireVestiges.js';   // EG-ZR: a blow of mine with the Vestiges I hold
import { spireBodyMax } from '../../systems/renownLayer.js';   // EG-ZR: Stoneskin's cushion over the body a share is of
import { createEgLordFall, egLordFallAct } from './egLordFall.js';   // EG-FALL: a lord's fall, the gate's

/** AUDIT EG III (lane4 #10): Immovable's number (the Mastery's id - net/eliteGates/egVestige.js EG_MASTERIES, as net/eliteGates/egBrain.js reads it). */
const IMMOVABLE_ID = EG_MASTERIES.find((M) => M.key === 'immovable')?.id ?? -1;
/** The objects' types by number (net/eliteGates/egLords.js EG_OBJ), and which are struck (drawn as crystals) - the rest are stood on. */
const OBJ_KEY = Object.freeze(Object.fromEntries(Object.entries(EG_OBJ).map(([k, v]) => [v, k])));
const STRUCK = new Set(['rift', 'anchor', 'banner', 'heart', 'seal', 'brazier', 'standard', 'chain', 'pillar', 'spark', 'fwall']);   // LAYER THREE: `fwall` an alcove's false wall - one blow
/** The struck objects' colours (display-encoded): the rifts Dagon's, the wards' red-bronze, a heart's storm, a pillar's
 *  basalt glow. */
export const EG_OBJ_COLORS = Object.freeze({
  rift: [1.0, 0.18, 0.34], anchor: [0.95, 0.3, 0.2], banner: [0.9, 0.22, 0.18], heart: [0.4, 0.75, 1.0], seal: [0.75, 0.5, 1.0], brazier: [1.0, 0.5, 0.12],
  standard: [0.85, 0.3, 0.2], chain: [0.75, 0.7, 0.6], pillar: [1.0, 0.45, 0.1], spark: [1.0, 0.9, 0.4], fwall: [1.0, 0.82, 0.38],
});
/** The stood-on objects' colours: gold for the way and the havens (THE FIVE LIGHTS), violet for a soul-gem. */
const GOLD = Object.freeze([1.0, 0.82, 0.38]);
const GROUND_COLORS = Object.freeze({ rune: GOLD, gem: [0.65, 0.5, 1.0], haven: GOLD, relic: GOLD, engine: [0.7, 0.8, 1.0], stone: GOLD, umbra: [0.25, 0.15, 0.35], isle: [1.0, 0.3, 0.1], vault: GOLD, plate: GOLD });
/** A zone's colour: burning ground the band's, a fallen floor black-red, a Soul-Pool violet, a haven gold. */
const ZONE_COLORS = Object.freeze({ burn: [1.0, 0.42, 0.12], void: [0.35, 0.02, 0.04], soul: [0.6, 0.35, 0.9], haven: GOLD });
/** A tether's colour (THE FIVE LIGHTS: Dagon red on what binds you). */
const TETHER_COLOR = Object.freeze([1.0, 0.24, 0.28]);
/** THE PLACE's colour - section 25.2's white, "the place's own timed hazard" (SD-LOOK: what moves next is told in white):
 *  a vent ringing (a Rampart's and a span's), a Pendulum's lane, a slag crust's last seconds and every fragment hazard,
 *  told and landing - the one colour the danger palette's hazard takes (egLookShapes), its element in its grain (the
 *  style). AUDIT EG V (L5-3): a vent's and a fragment hazard's were the band's fire orange and a red, which no palette
 *  read. */
const PEND_COLOR = Object.freeze([0.95, 0.95, 1.0]);
/** EG-FULL LAYER THREE: a soul-wisp's violet (it drifts - its hold on me is a tether's red); the moon-shafts are gold (a
 *  CHECK's havens). */
const HAZ_SOUL = Object.freeze([0.6, 0.35, 0.9]);
/** A soul-wisp's tether (section 11.2): its drain's tick (ms), how soon one wisp binds again after it lets go (ms). */
const WISP_TICK_MS = 1000;
const WISP_AGAIN_MS = 6000;
/** EG-H1 (section 13.2): a blow's WIND sounds once it is past EG_FEINT_AT of its wind-up and still uncut, this long more
 *  for the cut's way here (ms) - a feint, cut at FEINT_AT on the relay, never glints in the ear (no frame flags it early).
 *  EG-PERFECT: the relay cuts on its beat (net/eliteGates/egDurable.js EG_BEAT_TRIAL_MS), so a cut leaves it up to a beat past
 *  FEINT_AT - the grace is the beat and the way here (150 ms) together: at 150 ms alone every feint's WIND sounded on every honest
 *  screen 25 ms before its cut came (the audit's 114 image feints, each cut at 0.667 of its wind-up). */
export const EG_WIND_GRACE_MS = EG_BEAT_TRIAL_MS + 150;
/** THE AUDIT: an honest body's grace - the way here alone (ms). Only a Spellmaster's images feint (EG_FL.mirror on the wire), so
 *  the beat's own grace is theirs: at the beat's grace on every body a blow under 0.89 s never sounded its WIND at all. */
export const EG_WIND_WAY_MS = 150;
/** A body's WIND grace (ms): the beat's for a Spellmaster's image (EG_FL.mirror - its blows feint), the way here for every other. */
export const egWindGraceMs = (fl) => ((fl & EG_FL.mirror) !== 0 ? EG_WIND_GRACE_MS : EG_WIND_WAY_MS);
/** EG-H1 (section 15): Watchfire's early outline - a PULSING solid red line (a dashed line is a feint's), its pulse (ms). */
const TOLD_PULSE_MS = 180;
/** AUDIT EG V (lane1 #18): a chained shape's dim outline before its fill (its alpha). */
export const EG_OUTLINE_DIM = 0.4;
/** EG-ZD (section 13.2): a cut feint's mark fades out dashed over this (ms - Feud-Arc section 7.3's TELL_FEINT_FADE). */
export const EG_FEINT_FADE_MS = Math.round(TELL_FEINT_FADE * 1000);
/** EG-ZH (section 26): where WATCHFIRE'S TELL is heard - the told blow's first stamp that has an origin (a disc's, a lane's,
 *  a cone's, a ring's), else `feet` (a blow over the whole floor lands where I stand); `[x, z]` in the hall's frame, or
 *  null. Pure. */
export function egToldAt(bl, feet = null) {
  for (const s of bl?.s ?? []) if (s && (s[0] === 'd' || s[0] === 'l' || s[0] === 'c' || s[0] === 'r') && Number.isFinite(s[1]) && Number.isFinite(s[2])) return [s[1], s[2]];
  return feet ? [feet[0], feet[1]] : null;
}
/** EG-ZR: an Arcane Echo is a blow of its own on the relay (its own hand), numbered EG_ECHO_Q past the cast it repeats - the
 *  bodies one cast meets share their echo's number as they share the cast's. EG-ZS: the number is the law's (net/eliteGates/egVestige.js -
 *  the relay knows an Echo by it), said here as before. */
export { EG_ECHO_Q };
/** FB1018D DUEL-RING (section 13.3): THE RING OF FIRE's band, this far either side of its rim (m) - the rim the challenged is
 *  kept inside and the company out of (scenes/eliteGates/egClient.js ringKeep, EG_RING_PAD in). */
export const EG_DUEL_RING_HALF_M = 0.5;
/** A zone's and a drain's tick (ms); a body's fall's length; how long after its landing a blow's shape lingers. */
export const EG_TICK_MS = 1000;
const FALL_MS = 1200;
const LINGER_MS = 350;
/** AUDIT EG IV (lane1 #15; section 13.2): how high over an errand (an object's feet, a lord's) its members' numerals stand (m). */
export const EG_GIVEN_UP_M = 2.4;
export const EG_GIVEN_UP_LORD_M = 5;
/** AUDIT EG IV (lane1 #15): an errand's words over it - one member's numeral and name (*III - Mira*), several members' numerals
 *  (*I II*); `co` the company's rows (`[sub, name, n, ...]`). Pure. */
export const egGivenWords = (ns, co = []) => (ns.length === 1 ? `${EG_NUMERALS[ns[0]] ?? ns[0]} - ${(co.find((c) => c[2] === ns[0]) ?? [])[1] ?? ''}`.replace(/ - $/, '') : ns.map((n) => EG_NUMERALS[n] ?? n).join(' '));
/** The beats' words (net/wire.js EG_SAY_KEYS), by key - `n` a name, `t` a word the room adds. */
export const EG_SAY = Object.freeze({
  wake: () => '', fury: (n) => `${n || 'The lord'} rages!`, covenant: () => 'The Covenant presses.', covenantrest: () => 'The Covenant has spoken. This Redoubt is the last.',
  stunned: (n) => `${n || 'The lord'} is laid bare!`, scent: () => 'Hunted. Run!', scorched: () => 'Grath is scorched!', phase: (n, t) => t, images: () => 'Mirror images! Only one is true.',
  examination: () => 'The Examination: stand on the runes in order!', cage: () => 'The Final Examination: break the seals!', passed: () => 'The Examination is passed.', failed: () => 'The Examination is failed.',
  // FB1018D DUEL-RING: at n = 1 no ring rises nor falls (section 13.3) - the open duel's own words
  challenge: (n, w) => (w === EG_DUEL_OPEN ? t('eg.say.duelOpen', 'A challenge in the open! Deal him a tenth of his health within 15 s.') : 'A challenge! The ring of fire rises.'),
  challengewon: () => 'The challenge is met.', challengeend: (n, w) => (w === EG_DUEL_OPEN ? t('eg.say.duelUnmet', 'The challenge goes unmet.') : 'The ring falls.'),
  conquest: () => 'Banners claim the floor, and it burns. Two standing ward the lord. Break them!',   // FB1018D WARD-BAR: what they do, said (section 13.4)
  muster: () => 'The Muster-Call! The balconies fill.', tithe: () => 'The Soul Tithe: lay your soul in a gem!', bare: () => 'The gems are full. The Cairn-Keeper is laid bare!',
  twinfell: (n) => `${n} falls. Bring down the other within 15 seconds!`, twinraised: (n) => `${n} rises again.`, crossing: () => 'The Twins cross the walkway!',
  chaining: () => 'Soul-chains bind you. Stay close!', grounded: () => 'The Mother of Dusk is dragged down!', anchors: () => 'The anchors rise again.', vanish: () => 'The Night-Stalker vanishes.',
  tether: () => 'Blood Tether! Stand apart.', tetherbroken: () => 'The tether snaps.', eclipse: () => 'The Eclipse comes. Stand in the light!', mirrors: () => 'Mirror lords rise. Only the true lord casts a mark.',
  relit: () => 'A heart relights!', landed: () => 'The Wyrm lands!', perches: () => t('eg.say.perches', 'The perches rise again, molten!'), broken: (n, t) => `${n || 'Someone'} breaks a ${t || 'ward'}.`, stirs: () => 'Something stirs.', raised: () => 'A Binder raises the fallen.',
  raisebroken: () => 'The raising is broken.', door: () => 'The way down opens.', recalled: (n) => `${n} is called back.`, home: (n) => `${n} walks home.`, goldrun: () => 'Gold run. +1:00',
  mimic: () => 'The cache is a Kyn Mimic!', memento: (n, t) => `${n} carries ${t}'s Memento.`, relicbroken: () => 'The relic breaks! The hold falls back.', silenced: () => 'A caster is silenced.',
  orrerytrue: () => 'The Orrery turns true. A Vestige waits.', chamberdone: () => 'The chamber is cleared. Find the way down.', freed: () => 'The Battlemage is freed. Each of you gains a Cantrip.',
  desertertook: () => 'The Deserter takes the cache.', sapperfed: () => 'A Sapper reaches its lord and heals it.', reopened: () => 'A Sapper tears a rift open again!', cantrip: (n, t) => `${n} uses ${t}.`,
  bargain: (n, t) => `Dagon's Bargain is struck: ${t}.`, respite: (n, t) => `A respite: ${t} seconds.`, ready: () => 'The company is ready.',
  gateheld: () => 'The march holds the gate. Break it, or the Ward-Bearers stay warded.',   // AUDIT EG IV (section 8.3)
  // EG-FULL LAYER THREE: the fragments' beats
  seam: (n) => `${n || 'Someone'} breaks a false wall. An alcove opens.`, engine: (n, t) => `${n || 'Someone'} works the ${t || 'engine'}!`,
  horn: (n) => `The Honor Horn calls ${n || 'one of you'} into the ring. Answer alone!`, hornwon: (n) => `${n || 'The challenger'} fought with honor. The crowd throws Reliquaries!`,
  hornfoul: () => 'Another steps into the ring. The crowd throws fire! Ash falls in the Pit.', niche: (n) => `${n || 'Someone'} rests at the Battlemage's niche.`,
  hcache: (n) => `${n || 'Someone'} takes a Reliquary from the High Road's cache.`, lowroad: () => 'Something stirs on the Low Road.',
});

/**
 * FIELD BUGS 2026-10-19f GAUNTLET-PLATES: the height (m) of the ground under a Gauntlet's plate - `q` a pillar's spot, its plate
 * `[x, z]` in the hall's frame (net/eliteGates/egLaw.js rampartWalk): the top of the pillar it stands on (from spec law 10,
 * THE BROKEN WAY, beside its stair's head), else its stair's height under it (laws 8 and 9 laid it 3 m up the stair - a flat
 * mark there crosses the slope at its middle), else the walkway's floor (the laws before laid the side span flat, and every
 * Rampart's walkway lies at the hall's floor). Pure.
 * @param {any} spec @param {any} q
 */
export function egPlateY(spec, q) {
  const [x, z] = q.plate;
  const top = (spec.discs ?? []).find((d) => d.role === 'pillar' && Math.hypot(x - d.x, z - d.z) <= d.r);
  if (top) return top.y ?? 0;
  for (const r of spec.ramps ?? []) {
    const dx = r.bx - r.ax, dz = r.bz - r.az, u = ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz || 1);
    if (u >= 0 && u <= 1 && Math.hypot(x - r.ax - u * dx, z - r.az - u * dz) <= r.hw) return r.y0 + (r.y1 - r.y0) * u;   // along its run, within its width
  }
  return 0;
}

/**
 * EG-G2 (sections 25.2, 25.4 and 25.7): THE LOOK LAID ON a frame's shapes - every danger line in the shelf's palette's
 * edge (THE SPIRE DANGER EDGE in the Standard), its fill at the shelf's light and the palette's style bit; a shape
 * aimed at another member filled at THE QUIET COMPANY's share during a trial, mine with a brighter rim; a haven in the
 * palette's safety and THE HAVEN GRAMMAR (render/gate/gateTelegraph.js TELEGRAPH_POOL_HAVEN); the place's white in its hazard
 * colour; every one keeping THE FOG FLOOR. `acc` the shelf as ui/eliteGates/egAccess.js egAccessNow reads it (`palette`, `fill`),
 * `stage` the hall's. EG-ZD: a blow cut as a feint (`cut`) dashed as it fades (EG_LOOK_BIT.dash). In place. Pure.
 */
export function egLookShapes(shapes, acc, stage) {
  const pal = acc?.palette ?? egPaletteOf('standard'), fill = acc?.fill ?? 1, bits = egPaletteBits(pal), quiet = egQuietCompany(stage);
  for (const sh of shapes) {
    sh.fogFloor = EG_FOG_FLOOR_ARR;
    if (sh.edge === TELEGRAPH_EDGE_DAGON) {
      sh.edge = sh.mine ? brighter(pal.danger) : pal.danger; sh.look = bits | (sh.cut ? EG_LOOK_BIT.dash : 0);   // EG-ZD: a cut feint dashed as it fades
      sh.fillK = fill * (sh.pool === TELEGRAPH_POOL.blow && !sh.mine ? quiet.aimedOther : 1);
    } else if (sh.edge === TELEGRAPH_EDGE_SAFE) {
      sh.edge = pal.safety; sh.look = 0; sh.fillK = 1; sh.pool = TELEGRAPH_POOL_HAVEN;   // THE HAVEN GRAMMAR (section 25.5)
      if (sameRgb(sh.color, GOLD)) sh.color = pal.safety;
    }
    if (sameRgb(sh.color, PEND_COLOR)) sh.color = pal.hazard;
  }
  return shapes;
}
/** A shape slot of the telegraph pass's own shape (render/gate/gateTelegraph.js), refilled. */
const slot = () => ({ kind: 0, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0,
  t: 0, flash: 0, alpha: 0, color: GOLD, edge: TELEGRAPH_EDGE_DAGON, court: 0, style: TELEGRAPH_STYLE.weight, since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow,
  mine: false, fillK: 1, look: 0, fogFloor: EG_FOG_FLOOR_ARR, cut: false,   // EG-G2: aimed at me, the fill, the style bit, the fog floor; EG-ZD: a cut feint
  y: NaN, order: Infinity, by: NaN });   // EG-ZG: its own surface's height (none: the fight floors it covers), its rank in THE TELEGRAPH BUDGET - both cleared each frame; THE ASCENT: the height its blow or zone lands at (none: every floor under it in plan)
/** EG-ZG: the Eclipse's darkening's line (none - it is the floor's dark, never a warning's line) and a Drop's dust. */
const DARK_EDGE = Object.freeze([0, 0, 0]);
const DUST_COLOR = Object.freeze([0.62, 0.58, 0.52]);
/** EG-ZG: a companion's pose stands at their eye (scenes/world.js egPeers - the online pose), this far over their feet (m);
 *  feet this near a Drop's top stand on it (m); the least shake worth a kick (the gate's - scenes/gate/gateCourt.js
 *  feltLanding); a pull-apart's snap - the crystals' shatter (world/gate/gateBoss.js CRYSTAL_CLIPS), high and short. */
const PEER_EYE_M = 1.6;
const DROP_STOOD_M = 0.25;
const SHAKE_MIN = 0.05;
const GLASS_CUE = Object.freeze({ clip: CRYSTAL_CLIPS.shatter, pitch: 2.2, volume: 0.9, reach: 30 });
/** FIELD BUGS 2026-10-18f TURNED-BLOW: what a blow from off the fight ground says where its number pops (ui/hitNumbers.js) - the
 *  ground turns it, not a ward (a ward's blow says the ward's own word), in the player's language (L10N4). */
export const egNoFooting = () => t('eg.hit.noFooting', 'No footing');
/** EG-G2: THE FOG FLOOR as the Spire's stage takes it (world/eliteGates/egLook.js EG_FOG_FLOOR). */
const EG_FOG_FLOOR_ARR = Object.freeze([EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease]);
/** EG-G2: two colours the same (a shape's colour is a table's - read by value, so a copy reads as its table's). */
const sameRgb = (a, b) => !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** AUDIT EG V (L6-4): no feet - THE TELEGRAPH BUDGET's order read from the hall's origin (kept, never made a frame). */
const NO_FEET = /** @type {number[]} */ (Object.freeze([0, 0]));   // read, never written (egShapeOrder)
/** EG-G2: a rim brightened for the shape aimed at me (section 25.4). */
const brighter = (c) => [c[0] + (1 - c[0]) * 0.3, c[1] + (1 - c[1]) * 0.3, c[2] + (1 - c[2]) * 0.3];
const STYLE_OF = Object.freeze({ fire: TELEGRAPH_STYLE.fire, frost: TELEGRAPH_STYLE.frost, shock: TELEGRAPH_STYLE.shock, poison: TELEGRAPH_STYLE.poison });
const COLOR_OF = Object.freeze({ fire: [1.0, 0.45, 0.1], frost: [0.62, 0.78, 0.82], shock: [0.6, 0.7, 1.0], poison: [0.55, 0.85, 0.3], null: [1.0, 0.3, 0.2] });

/**
 * Fill a slot from a stamp (net/eliteGates/egShape.js) - its kind, its numbers; `none` for a stamp the pass does not draw alone
 * (an outside-the-havens CHECK draws as the whole floor, its havens drawn gold beside it).
 */
export function fillStamp(sh, s) {
  sh.points.length = 0; sh.n = 0;
  switch (s[0]) {
    case 'd': sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = s[1]; sh.origin[1] = s[2]; sh.r = s[3]; return true;
    case 'l': sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = s[1]; sh.origin[1] = s[2]; sh.end[0] = s[3]; sh.end[1] = s[4]; sh.halfW = s[5] / 2; return true;
    case 'c': sh.kind = TELEGRAPH_KIND.cone; sh.origin[0] = s[1]; sh.origin[1] = s[2]; sh.yaw = s[3]; sh.r = s[4]; sh.halfArc = ((s[5] / 2) * Math.PI) / 180; sh.body = Math.min(1, coneInscribed(s[4], s[5])); return true;
    case 'r': sh.kind = TELEGRAPH_KIND.ring; sh.origin[0] = s[1]; sh.origin[1] = s[2]; sh.r0 = s[3]; sh.r1 = s[4]; return true;
    case 'a': case 'h': sh.kind = TELEGRAPH_KIND.all; return true;
    default: return false;
  }
}

/** What a body is doing at `now`, as a mobile's animation (the port's own tables - characters/mobile/mobileUnit.js stateAnims):
 *  rising, winding up, striking, flinching, walking, idling, falling. EG-FALL: a fallen lord falls as the gate's Warden does
 *  (scenes/eliteGates/egLordFall.js egLordFallAct - to the floor, sunk, gone), grown by `drawn`, its drawn size. Pure. */
export function egBodyAct(b, now, mobile, blow, hover = 0, drawn = undefined) {
  const winged = mobile === 29 && hover > 0;
  const tab = (state) => stateAnims(state, mobile, !!ENEMY_BASICS[mobile]?.hasIdle, false, false, true, false, winged);
  if (b.goneAt) { const since = now - b.goneAt; return since >= FALL_MS ? { act: 'gone', anims: tab('hurt'), frame: 0, loop: false, sink: 0 } : { act: 'fall', anims: tab('hurt'), frame: Math.floor((since / FALL_MS) * 4), loop: false, sink: b.w === 2 ? (since / FALL_MS) * 2 : 0 }; }
  if (b.fellAt && now >= b.fellAt) return egLordFallAct(now - b.fellAt, tab('hurt'), drawn, winged);   // EG-FALL: it held its fourth hurt frame, standing, for the hall's life
  const since = now - (b.born ?? 0);
  if (since >= 0 && since < 900 && b.role === EG_ROLE.add) return { act: 'rise', anims: tab('idle'), frame: 0, loop: true, sink: 2 * (1 - since / 900) };
  if (blow && now < blow.at) { const t = (now - (blow.at - blow.wu)) / Math.max(1, blow.wu); return { act: 'windup', anims: tab('attack'), frame: t >= 0.5 ? 1 : 0, loop: false, sink: 0 }; }
  if (blow && now - blow.at < 600) return { act: 'strike', anims: tab('attack'), frame: 2 + Math.floor(((now - blow.at) / 1000) * PRIMARY_ATTACK_ANIM_SPEED), loop: winged, sink: 0 };
  if (b.hurtAt && now - b.hurtAt < 350) return { act: 'flinch', anims: tab('hurt'), frame: Math.floor(((now - b.hurtAt) / 1000) * HURT_ANIM_SPEED), loop: false, sink: 0 };
  const m = b.mv;
  if (m && m.v > 0) { const [x, z] = egBodyPlace(b, now); if (Math.hypot(m.tx - x, m.tz - z) > 0.05) { const T = tab('move'); return { act: 'walk', anims: T, frame: Math.floor((now / 1000) * (hover > 0 ? FLY_ANIM_SPEED : T[0].fps ?? 6)), loop: true, sink: 0 }; } }
  const T = tab('idle');
  return { act: 'idle', anims: T, frame: Math.floor((now / 1000) * (hover > 0 ? FLY_ANIM_SPEED : T[0].fps ?? 4)), loop: true, sink: 0 };
}
/** EG-LOOK (section 9): the champions' keys (net/eliteGates/egLaw.js EG_CHAMPIONS - the Proving Walks' Kyn ranks, and Clan Feud's beside a
 *  Court's lord). */
const CHAMPION_KEYS = /** @type {Set<string>} */ (new Set(EG_CHAMPIONS.map((C) => C.key)));
/** EG-LOOK (section 9) - A BOSS'S PRESENCE: how many times its body's scale its sprite is drawn (world/eliteGates/egKit.js
 *  EG_LORD_PRESENCE) - a champion's, a Valkynaz's (net/eliteGates/egLaw.js EG_LORDS `valk`), else a Court lord's; the Twins are a Court's
 *  lords and a mirror wears its own lord's key, so each takes its lord's. Pure. @param {string} key */
export function egPresenceOf(key) {
  if (CHAMPION_KEYS.has(key)) return EG_LORD_PRESENCE.champion;
  return EG_LORDS[key]?.valk ? EG_LORD_PRESENCE.valkynaz : EG_LORD_PRESENCE.lord;
}
/** A flying lord's hover over the ground it keeps at its body's size (m) - drawn at its presence times this, so the grown
 *  sprite's feet clear the company's heads by as much of its own height as the body's did. */
export const EG_LORD_HOVER_M = 6;
/** A flyer's bob about its hover (m, at its body's size - a lord's drawn at its presence times this). */
const HOVER_BOB_M = 0.15;
/** EG-LOOK (section 9): how far over a lord's DRAWN head an errand's numerals stand (m) - EG_GIVEN_UP_LORD_M over its feet is
 *  the law's word while no sprite of it stands on this screen (no ARENA2 picture yet, a vanished lord). */
export const EG_GIVEN_OVER_HEAD_M = 0.6;
/** AUDIT EG IV (lane1 #15) and EG-LOOK (section 9): where an errand's numerals stand over body `b` at `t`, the dungeon's frame
 *  (`centre` the hall's): over its sprite's drawn head (`top`, the world height drawBody last stood it to - a lord grown to its
 *  presence, a flyer at its hover) when it stands on this screen, else the law's height over its feet (EG_GIVEN_UP_LORD_M a
 *  lord's, EG_GIVEN_UP_M any other's). Pure. @param {any} b @param {number[]} centre @param {number} t @param {number} [top] */
export function egGivenAt(b, centre, t, top = NaN) {
  const [x, z] = egBodyPlace(b, t);
  const y = Number.isFinite(top) ? top + EG_GIVEN_OVER_HEAD_M : centre[1] + egBodyHeight(b, t) + (b.role === EG_ROLE.lord ? EG_GIVEN_UP_LORD_M : EG_GIVEN_UP_M);
  return [centre[0] + x, y, centre[2] + z];
}
/** A body's look: a lord's its own (scaled, flying high), an add's its kind's by the band, an object's none (drawn
 *  otherwise). EG-LOOK (section 9): `scale` is the BODY's - the relay's bodyR and the hit target's reach are read off it - and `drawn`
 *  the sprite's, its `presence` times it (an add's its own scale); `hover` how high over its feet it is drawn flying. */
export function egLookOf(b, band) {
  if (b.role === EG_ROLE.lord) {
    const key = EG_BOSS_KEYS[b.k] ?? 'kynreeve', L = egBossLook(key, b.pt), lord = EG_LORDS[key];
    const fly = (b.fl & EG_FL.fly) !== 0 && (b.fl & EG_FL.grounded) === 0;
    const scale = L.scale * (b.sz ?? 1) * ((b.fl & EG_FL.mirror) !== 0 ? 0.95 : 1), presence = egPresenceOf(key);   // EG-ZQ: `sz` the room's size (net/eliteGates/egLink.js - Colossal's)
    return { mobile: L.mobile, scale, presence, drawn: scale * presence, hover: fly ? EG_LORD_HOVER_M * presence : 0, name: egBossName(key, b.pt), lord: true, epithet: lord?.epithet ?? '' };
  }
  if (b.role === EG_ROLE.add) { const L = egKindLook(b.k, band); return { ...L, presence: 1, drawn: L.scale, hover: (b.fl & EG_FL.fly) !== 0 ? L.hover : Math.min(L.hover, 0.9) }; }
  return null;
}

// ── EG-ZP (2026-10-12, sections 15 and 21): THE RECEIVER'S VESTIGES - a blow on me spared as the relay's census spares it ──
/**
 * EG-ZP: THE BREACH THE CENSUS READS, AS THIS SCREEN HOLDS IT - the record net/eliteGates/egBrain.js egCensusDr asks (`{ h, mem }`):
 * the hall, and each member of the company the room says (`co`) as its row stands (in, alive, gone home), with the
 * Vestiges and the Mastery its run says (`ms`), and on mine `ll`, my Lifeline windows (egLifelineOpen). EG-ZR: and `hy`,
 * Shield-Hymn's window on this screen (`rally`), when one was opened. Pure.
 * @param {any} E the breach's state (net/eliteGates/egLink.js) @param {string|null} me @param {number[][]} ll @param {any[]|null} [hy]
 */
export function egShieldBreach(E, me, ll, hy = null) {
  /** @type {Record<string, any>} */
  const mem = {};
  for (const c of E?.co ?? []) {
    const m = egMemberOf(E, c[0]), run = egRunOfMember(E, c[0]);
    mem[c[0]] = { in: m?.in, alive: m?.alive, home: m?.home, vs: run.vs, mast: run.mast, ...(c[0] === me ? { ll } : {}) };
  }
  return { h: E?.h ?? 0, mem, ...(hy ? { hy } : {}) };
}
/**
 * EG-ZP - THE RECEIVER'S VESTIGES (section 15; section 21's census): the share of blow `bl` on me the company's Vestiges
 * spare - Challenger's Oath, Bastion, Steadfast Line, Immovable and Lifeline, together never past 30% - by the relay's
 * census's own law (net/eliteGates/egBrain.js egCensusDr, called, never copied) over what this screen holds: the breach and its runs
 * (`E`), the hall's fight (`F` - its lords) and spec (its fight floors), my trail (`tr`, the census's own
 * `[t, x, y, z, h]` in the hall's frame) and each companion where it stands at the blow's landing (`at(sub)` - `[x, y, z]`
 * in the hall's frame, or null: unseen, as the census counts no member it holds no pose of), and my Lifeline windows
 * (`ll`). EG-ZR: and Shield-Hymn's window (`hy`). Pure.
 * @param {any} E @param {any} F @param {any} spec @param {{at: number, o?: number}} bl @param {string|null} me
 * @param {number[][]} tr @param {(sub: string) => (number[]|null)} at @param {number[][]} ll @param {any[]|null} [hy]
 */
export function egShieldDr(E, F, spec, bl, me, tr, at, ll, hy = null) {
  const B = egShieldBreach(E, me, ll, hy), bodies = [{ sub: me ?? '', tr }];   // mine first: the census reads a member's first trail
  for (const sub of Object.keys(B.mem)) {
    const p = at(sub);
    if (p) bodies.push({ sub, tr: [[bl.at, p[0], p[1], p[2], B.h]] });
  }
  return egCensusDr(B, F, egFightView(spec), { sub: me ?? '', at: bl.at, o: bl.o ?? 0 }, bodies);
}
/**
 * EG-ZP - LIFELINE'S WINDOW ON MY BLOWS (section 15; the census's own - net/eliteGates/egBrain.js egHeal): my heal word said with a
 * Lifeline holder's heal in it while I stood under 30% (scenes/eliteGates/egClient.js) opens `[from, until, share]` - from the
 * word's second back (EG_HEAL_WORD_MS) to EG_LIFELINE_MS past it, `at` the word's arrival at the room as my corrected
 * clock reckons it - at the healer's rank's share. Windows no blow can still be judged in (EG_TRAIL_MS) are let go and
 * the last four kept, as the census keeps them. Pure.
 * @param {number[][]} ll @param {number} v @param {number} at
 */
export const egLifelineOpen = (ll, v, at) => [...ll.filter((w) => w[1] >= at - EG_TRAIL_MS), [at - EG_HEAL_WORD_MS, at + EG_LIFELINE_MS, v]].slice(-4);

// ── AUDIT EG III (2026-10-13, lane1 #4 and #12): THE SOUL CAIRN'S TWO LAWS ON THE STRUCK SCREEN ─────────────────────────
/**
 * AUDIT EG III (lane1 #4) - THE TWINS' TOUCHED: the weight blow `bl` lands on member `me` with in fight `F` (its bodies, its
 * marks `mk` - `[sub, mark, until, n]`) at `t`: net/eliteGates/egLords.js EG_TOUCH_X (section 13.3: "They deal +25% to Isk and take +25%
 * from Vael" - the relay weighs the dealt half, egLordHitX; this is the taken half) when the twin it leaves is the one whose
 * mark `me` bears live (Vael of the Fire Clan, `pt` 0, lays EG_MARK_FIRE; Isk of the Frost Clan, `pt` 1, EG_MARK_FROST - net/eliteGates/egLords.js
 * egLordsStep's), else 1. Pure.
 * @param {any} F @param {{ o?: number }} bl @param {string|null} me @param {number} t
 */
export function egTouchedX(F, bl, me, t) {
  if (!me || !Number.isInteger(bl?.o)) return 1;
  const L = (F?.bodies ?? []).find((b) => b.i === bl.o);
  if (!L || L.role !== EG_ROLE.lord || EG_BOSS_KEYS[L.k] !== 'twins') return 1;
  const mark = L.pt === 1 ? EG_MARK_FROST : EG_MARK_FIRE;
  return (F.mk ?? []).some((m) => m[0] === me && m[1] === mark && m[2] > t) ? EG_TOUCH_X : 1;
}
/**
 * AUDIT EG III (lane1 #12) - MORVAYN'S CHAINING, "a blow on one is shared with the other" (section 13.4): the members bound
 * to `me` by soul-chains in tethers `tx` (`[a, b, kind, cm]` - kind 2 the stay-close chain, net/eliteGates/egLords.js; a chain of three
 * is two links on its first member), every member its links reach - never a Wraith an odd member is chained to (a body,
 * not a member: killing it breaks the chain, it shares nothing). A blow on any of the chain is split evenly over all of it,
 * so each takes its share of the blow (1 / (mates + 1)) for every one of them it lands on. Pure.
 * @param {any[]} tx @param {string|null} me
 */
export function egChainMates(tx, me) {
  const out = [];
  if (!me || !tx?.length) return out;
  const seen = new Set([me]);
  for (let grew = true; grew;) {
    grew = false;
    for (const t of tx) {
      if (t?.[2] !== 2 || typeof t[0] !== 'string' || typeof t[1] !== 'string') continue;
      const a = seen.has(t[0]), b = seen.has(t[1]);
      if (a !== b) { const n = a ? t[1] : t[0]; seen.add(n); out.push(n); grew = true; }
    }
  }
  return out;
}

/**
 * AUDIT EG V (lane1 #14; sections 13.2 and 27.5) - A LORD'S PHASE CARD, the gate's (scenes/gate/gateCourt.js courtPhaseCard): its
 * numeral, the phase's name and its one order (net/eliteGates/egLords.js egLordPhase - Garoth's third the signature he borrows at circle
 * `c`), or null (a first phase, a champion). Pure.
 * @param {string} key @param {number} ph @param {number} c
 */
export function egPhaseCard(key, ph, c) {
  const P = egLordPhase(key, ph, c);
  return P ? { kicker: PHASE_NUMERALS[ph - 1], main: P.name, sub: P.order } : null;
}
/** AUDIT EG V (lane1 #13; sections 13.3 and 25.6): how deep the place's dark lies (Gutterdark, the Long Night - `edark` until
 *  `until`) at `t`: the Eclipse's depth, eased in and out over EG_DARK_EASE_MS. Pure. */
export const EG_DARK_EASE_MS = 600;
export const egDarkAt = (until, t, from = -Infinity) => EG_ECLIPSE_LOOK.deep * Math.max(0, Math.min(1, (until - t) / EG_DARK_EASE_MS, (t - from) / EG_DARK_EASE_MS));
/** AUDIT EG V (lane1 #13; section 13.3, the Bound Colossus): THE RAILS while they stand - two gold lanes along its flanks, its
 *  hearts' sides, `[ax, az, bx, bz]` each (the hall's frame) about its feet (x, z). Pure. */
export const EG_RAIL_SIDE_M = 3.6;
export const EG_RAIL_HALF_M = 5;
export const egRailsAt = (x, z) => [-1, 1].map((k) => [x + k * EG_RAIL_SIDE_M, z - EG_RAIL_HALF_M, x + k * EG_RAIL_SIDE_M, z + EG_RAIL_HALF_M]);
/** AUDIT EG V (lane1 #12): the Night-Stalker's look, whose WIND the true umbra glints with. */
const STALKER_MOBILE = egBossLook('stalker').mobile;

/**
 * @param {{ renderer?: any, gl?: any, getTexture?: any, uploadRecordFrame?: any, audio?: any, link: any, now: () => number,
 *   cam?: () => number[]|null, feet?: () => number[]|null, player?: () => any, me?: () => string|null, save?: (e: any, el: string) => number,
 *   strike?: (dmg: number, o: { fire?: boolean, el?: string|null, name?: string }) => void, say?: (t: string) => void,
 *   hudHidden?: () => boolean, sendHit?: (f: any) => boolean, push?: (dx: number, dz: number, m: number) => void, castBack?: () => void,
 *   peerAt?: (sub: string) => number[]|null, ring?: (x: number, z: number, r: number, inside: boolean) => void, hold?: (ms: number) => void, music?: any,
 *   shake?: (k: number) => void, yaw?: () => number|null, rand?: () => number }} deps
 *   EG-ZG: `shake` the camera's (the port's one shaker by default - systems/betterAmbience.js weaponKick, under the player's own
 *   maxShake); `yaw` the camera's (none: read off the view the world pass hands drawPass). EG-ZR: `rand` an Arcane Echo's roll.
 */
export function createEgFight({ renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null, music = null, link, now, cam = () => null, feet = () => null, player = () => null, me = () => null,
  save = () => 100, strike = () => {}, say = () => {}, hudHidden = () => false, sendHit = () => false, push = () => {}, castBack = () => {}, peerAt = () => null, ring = () => {}, hold = () => {},
  shake = (k) => betterAmbience.weaponKick(k), yaw = () => null, rand = Math.random }) {
  // EG-H1: the fight runs on the breach's link's clock where it keeps one (scenes/eliteGates/egClient.js - the shared clock, corrected)
  if (typeof link?.now === 'function') now = link.now;
  let hall = 0, spec = null, centre = null, floor = null, band = 0;
  let beat = null, beatNext = /** @type {any[]} */ ([]), lastSay = /** @type {any} */ (null), wokeSeen = 0, fellSeen = new Set(), phaseSeen = new Set(), gustSeen = 0, darkFrom = -Infinity, darkUntil = 0;
  let darkNow = 0;   // AUDIT EG V (lane1 #13): the place's dark this frame (egDarkAt)
  let blowSeq = 0;
  const blowMet = new Set();
  /** AUDIT WB11 W3's law: a blow is one sequence over every body it meets in a frame. */
  function blowQ(who) {
    if (!blowMet.size || blowMet.has(who)) { blowSeq++; blowMet.clear(); }
    blowMet.add(who);
    return blowSeq;
  }
  // SHADER-STALL (render/glProgram.js compiledPass): the telegraphs and the crystals built the first frame a breach draws
  // them AND their programs are done - never a frame frozen on a compile; their doors made again for each breach (leave).
  // AUDIT SHADER-STALL: and the first frame a blow's telegraph or a crystal must be SEEN, built then whatever the driver
  // says (`get(true)`) - a blow a player cannot see coming is the fight's own fault, never a compile's; started at the
  // boot's idle where the driver compiles beside the frames (render/playPrograms.js), so that build waits on nothing
  const telegraphDoor = () => compiledPass(gl, telegraphPrograms(true), () => new GateTelegraphRenderer(gl, { spire: true }), (e) => console.warn('[eg] the telegraphs would not build', e?.message ?? e));
  const crystalDoor = () => compiledPass(gl, CRYSTAL_PROGRAMS, () => new CourtCrystalRenderer(gl), (e) => console.warn('[eg] the crystals would not build', e?.message ?? e));
  let pass = null, telegraphOf = telegraphDoor(), crystalPass = null, crystalsOf = crystalDoor();
  /** EG-G2: THE SPIRE MIX over this screen's engine and the music; the blows I was stung for; the frame's barks */
  const mix = createSpireMix({ audio, music, now });
  const stung = new Set(), _barks = [];
  /** EG-ZH: the told blows Watchfire's tell has sounded for (this hall's); the fire falls' flames - TEXTURE.356 loaded once
   *  (`fire` its state), each fall's batch by its hazard's number */
  const toldHeard = new Set();
  let fire = null;
  const fireBatches = new Map();
  let stageNow = 'wait';
  const textures = new Map(), drawn = new Map();
  const judged = new Set(), cued = new Set(), landedSet = new Set(), guardHeard = new Set();   // EG-PERFECT: a guard's ring heard once a rising
  const zoneTick = new Map();
  let drainAt = 0, voidAt = 0;
  const _batches = [], _lights = [], _targets = [], _crystals = [], _shapes = [], _slots = [];
  /** THE PLACE's eruptions already judged (a Rampart vent's by its instant, a span Vent's by its cycle) */
  const ventJudged = new Map();
  /** LAYER THREE: the fragment hazards' bites taken on my own feet (each part's key once), the soul-wisps' holds on me */
  const hazHit = new Map(), wispHold = new Map();
  const crystalSlots = new Map();
  /** EG-ZG: the hall's fight floors (triangulated once a hall), the floor budget's kept buffer and its last plan; the frame's
   *  pending blows and told hazards (the peril arrow's), the camera's yaw off the last view, the readouts up (the ground's
   *  words, the sigils), the Eclipse's cycles heard (its wind and toll), the pull-apart tethers on me last frame (a snap's
   *  glass), the Drop I am falling onto, a Drop's dust */
  /** AUDIT EG V (L6-4): the floor plan's own slots (world/eliteGates/egTelegraph.js egFloorPlanKeep), kept for the fight */
  const planKeep = egFloorPlanKeep();
  let floors = [], floorBuf = null, lastPlan = null, lastPeril = null, lastGround = null, viewYaw = null, groundUp = false, sigilsUp = false, dropFrom = null, dropOn = null;
  /** AUDIT EG III (lane4 #2): whether this fight's title card stands - the card is the gate's own (ui/gate/gateTitleCard.js), and
   *  the Burning Court's frame draws it before the breach's: only a card this fight drew is ever put away here */
  let cardUp = false;
  /** One frame's title card (a wake, a fall), drawn while this fight holds one, put away once when it goes. */
  function titleFrame(t) {
    const m = titleCardModel(beat, t);
    if (m || cardUp) { drawGateTitleCard(m, { hidden: hudHidden() }); cardUp = !!m; }
  }
  const _pending = [], _sigils = [], _vp = new Float32Array(16), eclipseHeard = new Set(), dusts = [];
  /** AUDIT EG V (L6-4; section 11.9, "The frame's lists"): the frame's own collections, kept - each body's newest blow,
   *  the bodies drawn, the lords, the blows the budget orders and its options, the marked companions, the errands given by
   *  numeral (each body's list kept) */
  const _blowBy = new Map(), _live = new Set(), _lordIds = new Set(), _orderIn = [], _subs = new Set(), _given = new Map();
  const _orderOpts = { lords: _lordIds, aimedAt: (bl) => namesMe(bl) };
  let pullsWas = new Map(), pullsNow = new Map();
  /** EG-ZP (sections 15 and 21): my trail in the hall's frame (the census's own `[t, x, y, z, h]`, its last EG_TRAIL_MS) and
   *  my Lifeline windows (egLifelineOpen) - THE RECEIVER'S VESTIGES read both at a blow on me */
  const trail = [];
  /** @type {number[][]} */
  let ll = [];
  /** EG-ZR (section 15): Shield-Hymn's window on my blows (`[from, until, subs]` - `rally`, the census's `B.hy`); Momentum's
   *  body and stacks (`q` the blow that last built them); an Arcane Echo's roll for the cast `q` */
  let hymn = /** @type {any[]|null} */ (null), mom = { i: -1, n: 0, q: -1 }, echo = { q: -1, on: false };
  /** FIELD BUGS 2026-10-18f TURNED-BLOW: where my blows are struck from this frame - my feet in the hall's frame, the relay's own
   *  pose shape (`[x, y, z]`; null while I stand nowhere on this screen) - and each body's stand-in told whether the relay will
   *  take nothing from a blow struck there (net/eliteGates/egBodies.js egStrikeTurned): `warded`, the word every heal and power
   *  of a landed blow already refuses (systems/loot/lootPowers.js lootStrike, systems/enchantments.js VampiricEffect, the
   *  sets' and the martial powers), the door that sends it (hostHit) and the swing's ring (scenes/dungeonContext.js swingOnHost). */
  let strikeAt = /** @type {number[]|null} */ (null);
  const _strikeAt = [0, 0, 0];
  /** FIELD BUGS 2026-10-20f (LANDED-WORD): whether my relay says what each of my blows landed (`eland` - net/wire.js
   *  relaySupportsEgLand, told each frame by the breach client) - then a blow's number is the room's word, never the claim */
  let landWord = false;
  function turnStandIn(t, b) {
    const e = t.entity, view = egFightView(spec), at = strikeAt;
    const off = !at || egStruckOff(view, b, at[0], at[1], at[2]);
    e.warded = off || egStrikeTurned(view, b, at[0], at[1], at[2], now(), spec);   // AUDIT FB1018f L3-6: the body where it stands now (its storey); and the reach off the hall's own floor
    e.wardText = off && at ? egNoFooting() : null;   // ui/hitNumbers.js: the ground's word, else the ward's
    e.landsByWord = landWord;   // LANDED-WORD (ui/hitNumbers.js numberFor): a hit's number waits for the room's word of what landed
  }

  const play3 = (cue, at) => { if (!cue || !audio || !at) return; try { if (cue.id != null) audio.play3dId?.(cue.id, at, cue.volume, { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch }); else audio.play3d?.(cue.clip, at, cue.volume, { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch }); } catch { /* a sound is never the fight */ } };
  /** EG-ZG: a sound of my own (a Drop's thud, the Eclipse's wind and toll) - `{ rec, vol, pitch }`, the engine's one-shot. */
  const playOne = (S) => { try { audio?.playOneShot?.(S.rec, S.vol, S.pitch); } catch { /* a sound is never the fight */ } };
  /** EG-FALL: THE LORDS' FALLS, the gate's - each one's beats, its bursts and its body left (scenes/eliteGates/egLordFall.js), its
   *  corpses and lights in the frame's own lists, its shake under the Spire's motion law (section 25.7) */
  const lordFall = createEgLordFall({ renderer, gl, getTexture, uploadRecordFrame, now, play3, shake, motion: () => egShakeMotion(egReducedMotion(), getPref('techniqueMotion')), band: () => band, batches: _batches, lights: _lights });
  const toDungeon = (x, y, z) => [centre[0] + x, centre[1] + y, centre[2] + z];
  const myFeet = () => { const f = feet(); return f && centre ? [f[0] - centre[0], f[2] - centre[2]] : null; };
  /** EG-ZR: a companion's feet in the hall's frame where this screen draws it (its pose stands at the eye), or null. */
  const peerFeet = (sub) => { const p = peerAt(sub); return p && centre ? [p[0] - centre[0], p[1] - PEER_EYE_M - centre[1], p[2] - centre[2]] : null; };
  /** AUDIT EG V (L6-4): THE BODIES - one body standing or still falling, drawn as its role is, counted live this frame. */
  function liveBody(b, t) {
    _live.add(b.i);
    if (b.role === EG_ROLE.obj) { const key = OBJ_KEY[b.k] ?? 'rift'; if (STRUCK.has(key)) drawStruck(b, t, key); else drawGround(b, t, key); return; }
    drawBody(b, t, _blowBy.get(b.i));
  }
  /** EG-ZG: a tether's end `x` (a member's sub or a body's number) where this screen stands it, the hall's frame `[x, z]` -
   *  my feet `f`, a companion as drawn, a body at its place - or null. AUDIT EG V (L6-4): one function, never a closure a
   *  tether a frame. */
  function tetherEnd(x, F, t, f, meSub) {
    if (typeof x === 'string') { if (x === meSub && f) return f; const p = peerAt(x); return p ? [p[0] - centre[0], p[2] - centre[2]] : null; }
    const b = F.bodies.find((q) => q.i === x);
    return b ? egBodyPlace(b, t) : null;
  }
  /** AUDIT EG V (L6-4): the company where this screen stands it, worked out once a frame - the holder's chips ask every
   *  Accord of it twice a frame (ui/eliteGates/egBeats.js egHolderNow), and each ask stood the whole company again. */
  let companyAt = NaN, companyFrame = -1, companyState = null, companyMemo = null, frameNo = 0;
  /** EG-ZR (Shield-Hymn's `rally`), shared by EG-ZS's `accordMates`: the living company the room counts where this screen
   *  stands it - me at my feet, each companion where it is drawn - as the pair laws read it (`{ sub, vs, x, z }`). AUDIT EG V
   *  (L6-4): the same list for the same frame (the fight's frame, its clock and the room's word unchanged). */
  function companyHere() {
    const E0 = link.state(), t0 = now();
    if (companyMemo && t0 === companyAt && frameNo === companyFrame && E0 === companyState) return companyMemo;
    companyAt = t0; companyFrame = frameNo; companyState = E0;
    return (companyMemo = companyStood());
  }
  function companyStood() {
    const E = link.state(), sub = me(), ms = [];
    for (const c of E.co ?? []) {
      const m = egMemberOf(E, c[0]), q = c[0] === sub ? null : peerFeet(c[0]), p = c[0] === sub ? myFeet() : q && [q[0], q[2]];
      if (m?.in && m.alive && !m.home && p) ms.push({ sub: c[0], vs: egRunOfMember(E, c[0]).vs, x: p[0], z: p[1] });
    }
    return ms;
  }

  function texture(mobile) {
    const archive = ENEMY_BASICS[mobile]?.maleTexture;
    if (!archive || !getTexture) return null;
    const had = textures.get(archive);
    if (had && !(had instanceof Promise)) return had.failed ? null : had;
    if (!had) {
      // FIELD BUGS 2026-10-18f UNSEEN-KEEPER (not proven - the record says what would prove it): art that will not load is held
      // failed for the fight's whole life (one driver a session - scenes/eliteGates/egClient.js), and every body of its mobile then
      // stands undrawn and unoffered while its blows still draw; it said so nowhere. It says so once now, on the console
      const failed = (why) => { textures.set(archive, { failed: true }); console.warn(`[eg] the art of mobile ${mobile} (TEXTURE.${archive}) would not load - its bodies stand undrawn and unstruck`, why ?? ''); };
      const p = Promise.resolve().then(() => getTexture(archive)).then((tex) => { if (tex) textures.set(archive, { tex, archive }); else failed('no texture'); }, (e) => failed(e?.message ?? e));
      textures.set(archive, p);
    }
    return null;
  }
  function destroy(d) { if (d?.batch) { renderer?.destroyBillboardBatch?.(d.batch); d.batch = null; } }
  /** EG-ZH: TEXTURE.356 asked once (the player's own - none in a build without ARENA2: then no flames, the telegraph still
   *  tells the fall), answered `{ tex }` once it lands, or null while it is on its way or failed. */
  function fireTexture() {
    if (fire && !(fire instanceof Promise)) return fire.failed ? null : fire;
    if (!fire && getTexture) fire = Promise.resolve().then(() => getTexture(EG_FIRE_FALL.archive)).then((tex) => { fire = tex && tex.recordCount > EG_FIRE_FALL.record ? { tex } : { failed: true }; }, () => { fire = { failed: true }; });
    return null;
  }
  function dropFire() { for (const b of fireBatches.values()) renderer?.destroyBillboardBatch?.(b); fireBatches.clear(); }
  /** EG-ZH: a fire fall burning - its flames in Daggerfall's own fire, the frame the clock says, among the frame's batches. */
  function drawFireFall(hz, t) {
    const T = fireTexture();
    if (!T || !renderer?.createBillboardBatch || !centre) return;
    const F = egFireFallFlames(spec, hz);
    if (!F) return;
    const n = Math.max(1, T.tex.getFrameCount?.(EG_FIRE_FALL.record) ?? 1), frame = Math.floor((t / 1000) * GENERAL_FPS) % n;
    const rkey = `${EG_FIRE_FALL.record}#${frame}`;
    if (!renderer.textures?.has?.(`${EG_FIRE_FALL.archive}_${rkey}`)) uploadRecordFrame?.(EG_FIRE_FALL.archive, EG_FIRE_FALL.record, frame);
    let b = fireBatches.get(hz.i);
    if (!b) { b = renderer.createBillboardBatch(EG_FIRE_FALL.archive, rkey, { w: F.w, h: F.h }, F.at); if (!b) return; b.origin = [centre[0], centre[1], centre[2]]; fireBatches.set(hz.i, b); }
    b.record = rkey;
    _batches.push(b);
  }
  /** A new hall: its frame, its floor for the telegraph pass. */
  function reset(E) {
    for (const d of drawn.values()) destroy(d);
    drawn.clear(); judged.clear(); cued.clear(); landedSet.clear(); zoneTick.clear(); fellSeen = new Set(); phaseSeen = new Set(); crystalSlots.clear(); ventJudged.clear(); hazHit.clear(); wispHold.clear(); stung.clear();
    guardHeard.clear();   // EG-PERFECT
    toldHeard.clear(); dropFire();   // EG-ZH
    lordFall.leave();   // EG-FALL: the last hall's fallen put away
    mom = { i: -1, n: 0, q: -1 }; echo = { q: -1, on: false };   // EG-ZR: a new hall's bodies build no stacks of the last's
    hall = E.h; respec(E);
    eclipseHeard.clear(); dusts.length = 0; dropFrom = null; dropOn = null; pullsWas = new Map();
    beat = null; beatNext = []; lastSay = E.fight.says.at(-1) ?? null; wokeSeen = 0; gustSeen = 0; darkFrom = -Infinity; darkUntil = 0;
  }
  /** The hall's spec and what is made of it: its frame, its band, its floor and fight floors. AUDIT EG V (L3-7; section 22, THE
   *  LAW PIN): read again in the hall when the room gives it in the breach's own law after my own law drew it (egHallOf answers
   *  the given hall from then - frame): the bodies and the blows judged kept, the fire falls' flames made again at its frame. */
  function respec(E) {
    dropFire();
    spec = egHallOf(E.seed, E.h, E.geo ?? 0); centre = egHallCentre(spec); band = spec.band ?? 0;
    floor = spec.fight ? { r: spec.fight.r + 6, courts: [[spec.fight.x, spec.fight.z]] } : { r: 40, courts: [[0, spec.len / 2]] };
    floors = egFightFloors(spec);   // EG-ZG (section 11.7): each fight floor triangulated once
  }
  /** A blow on me landed - its share of my health and its base, through my saving throw against its element. EG-ZP: less
   *  the share `dr` my company's Vestiges spare a blow (spared). EG-ZR: its share of my body without Stoneskin's points.
   *  AUDIT EG III: `x` its weight on me - a twin's Touched (egTouchedX), my part of a chained blow (egChainMates). AUDIT
   *  EG V (lane8 L8-1): `foe` - a body's blow (a lord's, the legion's), marked as a foe's as it lands
   *  (systems/sigil/sigilSetPowers.js setSpireStruck), so Shed Skin and the Reprieve answer it; a hazard, a zone or a drain is none. */
  function landShare(pct, base, el, name, dr = 0, x = 1, foe = false) {
    const e = player();
    if (!e || !(e.health > 0) || !(pct > 0)) return;
    const k = (1 - dr) * x, raw = strikeDamage(pct * k, spireBodyMax(e), base * k), dmg = el ? savedShare(raw, save(e, el)) : raw;
    if (dmg > 0 && foe) setSpireStruck();
    if (dmg > 0) strike(dmg, { fire: el === 'fire', el, name });
  }
  /** AUDIT EG IV (lane1 #5): a member's feet in the hall's frame where this screen stands them (mine, or a companion's as drawn),
   *  `[x, z]`, or null - where a failure blow that names them is drawn. */
  const targetFeet = (sub) => { if (sub === me()) return myFeet(); const q = peerFeet(sub); return q ? [q[0], q[2]] : null; };
  const namesMe = (bl) => !!bl.on && bl.on.includes(me());
  /** EG-ZP: the share of blow `bl` on me my company's Vestiges spare (egShieldDr - the census's own law) - each companion
   *  where this screen draws them, at their feet (the pose stands at the eye). */
  const spared = (E, F, bl) => egShieldDr(E, F, spec, bl, me(), trail, peerFeet, ll, hymn);
  /** THE ASCENT (Elite-Gates-Ascent.md section 2): a blow's verdict `v` on feet at (x, y, z) held to its own storey - a hit off
   *  the floors it lands on (net/eliteGates/egFair.js egBlowLandsOn - the relay's rule) waits while its span lasts, then misses. A hall
   *  that judges in plan alone keeps the verdict as it was. */
  const onStorey = (v, bl, x, y, z, t) => (v !== 'hit' || egBlowLandsOn(egFightView(spec), bl, x, y, z) ? v : t >= bl.at + Math.max(1, bl.sp ?? 0) ? 'miss' : 'wait');
  /** FIELD BUGS 2026-10-19f STAND-IN-WHOLE: the factor the relay grows my bucket by here (THE TRUST LAW: my Vestiges'
   *  declared factor - net/eliteGates/egRun.js egVestigeX's `bx`), read by what one blow of mine can land on a stand-in of
   *  this hall (world/gate/gateBoss.js standInBlowCap). */
  const myBlowX = () => { const E = link.state(); return E?.ms ? egDeclaredX(egRunOfMember(E, me()).vs) : 1; };
  /** One body drawn: its look's sprite at its act's frame, at its place. EG-LOOK (section 9): at its DRAWN size (a lord's
   *  presence over its body's scale), its feet on the body's place - the quad stands up from its base - a flyer's hover its
   *  drawn one; a grown sprite casts no shadow; `top` its drawn head this frame (NaN while it stands nowhere on this screen). */
  function drawBody(b, t, blow) {
    const look = egLookOf(b, band);
    if (!look) return;
    const d = drawn.get(b.i) ?? { batch: null, look, at: [0, 0, 0], top: NaN };
    drawn.set(b.i, d);
    d.look = look; d.top = NaN;
    if (b.fellAt > 0 && b.role === EG_ROLE.lord) lordFall.see(b, t, look, centre);   // EG-FALL: its fall's beats, its dying glow, its body left - its pictures or none
    const T = texture(look.mobile);
    if (!T || !renderer?.createBillboardBatch) return;
    const act = egBodyAct(b, t, look.mobile, blow, look.hover, look.drawn);
    if (act.act === 'gone' || ((b.fl & EG_FL.hidden) !== 0 && b.role === EG_ROLE.lord)) return;
    const held = b.fellAt > 0 ? lordFall.placeOf(b.i) : null;   // EG-FALL; AUDIT EG-FALL (L1-2, L2-2): a fallen lord where it fell, held - never on along a walk, nor moved by the next whole fight
    const [x, z] = held ?? egBodyPlace(b, t), bodyY = held ? held[2] : egBodyHeight(b, t);   // EG-ZJ (section 11.7): on its own feet, the room's word - never the hall's height
    const y = bodyY + (act.sink > 0 ? -act.sink : 0) + (look.hover > 0 ? ('aloft' in act ? act.aloft : 1) * (look.hover + HOVER_BOB_M * look.presence * Math.sin(t / 260 + b.i)) : 0);   // EG-LOOK: a flyer's hover and bob its drawn ones; EG-FALL: dropping out of them as it falls
    d.at[0] = centre[0] + x; d.at[1] = centre[1] + y; d.at[2] = centre[2] + z;
    const eye = cam() ?? d.at;
    const fr = bossFrame(/** @type {any} */ (act), b.yaw ?? (b.mv ? Math.atan2(b.mv.tx - b.mv.x, b.mv.tz - b.mv.z) : Math.PI), d.at, eye, (rec) => T.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${T.archive}_${rkey}`)) uploadRecordFrame?.(T.archive, fr.record, fr.frame);   // EG-LOOK: one picture a frame at every size - its key and its sampling (NEAREST) never the size's
    const sz = mobileBillboardSize(T.tex, fr.record), w = sz.w * look.drawn, h = sz.h * look.drawn;   // EG-LOOK (section 9): the sprite at its presence
    if (!d.batch) {
      d.batch = renderer.createBillboardBatch(T.archive, rkey, { w, h }, [[0, 0, 0]]); d.batch.origin = [0, 0, 0];
      if (look.presence > 1) d.batch.noShadow = true;   // EG-LOOK: OW-BIG's law - a grown figure casts no giant's shadow (render/shadowPass.js)
    }
    d.top = d.at[1] + h;
    setBatchHitFlash(d.batch, egBodyFlash(b, t));   // EG-ZG (section 25.8): my blows flash it fully, anyone else's at 0.4
    const lord = b.role === EG_ROLE.lord;   // (THE AUDIT: the guard's glint and ring a lord's alone - a Binder's raise is lit too, and is to be struck)
    setBatchGlint(d.batch, b.fellAt ? null : egRimOf(darkNow > 0 ? EG_SHADE_BAND : band, b.fl | 0, lord));   // EG-ZG (section 25.6): THE SHADE'S RIM LIGHT - AUDIT EG V (lane1 #13): every foe's in the place's dark; EG-PERFECT: a raised guard's glint
    if (lord && (b.fl & EG_FL.lit) !== 0) { if (!guardHeard.has(b.i)) { guardHeard.add(b.i); playOne(EG_GUARD_SOUND); } } else guardHeard.delete(b.i);   // EG-PERFECT: and its ring, once a rising
    d.batch.record = rkey; d.batch.size = { w: fr.flip ? -w : w, h };
    if (d.batch.bounds) d.batch.bounds[3] = Math.hypot(w, h) * 0.5;
    d.batch.origin[0] = d.at[0]; d.batch.origin[1] = d.at[1]; d.batch.origin[2] = d.at[2];
    _batches.push(d.batch);
    // the body my blows meet (never a friend, a ward's, a vanished lord). EG-LOOK (section 9): its RADIUS the body's (the relay's
    // bodyR - the reach the law judges), its HEIGHT the drawn sprite's (the relay judges no height: a blow or a bolt at the head
    // you see meets him, never passes through it); it stands where the sprite's feet are drawn
    if (!b.fellAt && b.hp > 0 && (b.fl & (EG_FL.friend | EG_FL.hidden)) === 0) {
      // FIELD BUGS 2026-10-18f RELAY-SHARE: its stand-in reads its health as the relay says it - `hp` of its whole, refilled below
      d.target ??= { i: b.i, feet: [0, 0, 0], height: 2, radius: 0.6, entity: hostStandIn({ mobile: look.mobile, name: look.name }, b.i, () => wordShare(d.target?.hp, d.target?.m), myBlowX), mobile: look.mobile, name: look.name, lord: !!look.lord, m: b.max, hp: b.hp };   // AUDIT WORLD-EVENTS L5-4: `lord` - a Spire lord carries its traits (scenes/foeTraitsHost.js hostLordTraits)
      d.target.feet[0] = d.at[0]; d.target.feet[1] = centre[1] + y; d.target.feet[2] = d.at[2];
      d.target.height = (look.lord ? 2.2 : EG_LEGION_KINDS[b.k]?.h ?? 2) * (look.lord ? look.drawn / 1.2 : 1); d.target.radius = look.lord ? Math.max(0.8, (1.8 * look.scale) / 3) : EG_LEGION_KINDS[b.k]?.r ?? 0.6; d.target.m = b.max; d.target.hp = b.hp;
      turnStandIn(d.target, b);   // FIELD BUGS 2026-10-18f TURNED-BLOW: a blow from where I stand, on it as it stands, that the relay will refuse is turned here too
      _targets.push(d.target);
    }
    // EG-H1: the WIND once the wind-up is past FEINT_AT and the blow still stands - a feint's cut comes first, so it never glints
    if (blow && !cued.has(blow.i) && !blow.cut && t < blow.at && t >= blow.at - blow.wu + blow.wu * EG_FEINT_AT + egWindGraceMs(b.fl | 0)) { cued.add(blow.i); _barks.push({ kind: look.mobile, at: [d.at[0], d.at[1], d.at[2]], cue: hostCue('windup', look.mobile), critical: !!look.lord }); }   // EG-G2: capped by THE SPIRE MIX after the bodies
  }
  /** A struck object: a crystal in its colour, cracking as it falls, and a body my blows meet. */
  function drawStruck(b, t, key) {
    const color = EG_OBJ_COLORS[key] ?? EG_OBJ_COLORS.rift;
    const c = crystalSlots.get(b.i) ?? { at: [0, 0, 0], yaw: 0, seed: ((b.i * 7919) % 997) / 997, grow: 1, broke: -1, hp: 1, flash: 0, color, beam: null };
    crystalSlots.set(b.i, c);
    const [x, z] = egBodyPlace(b, t), bodyY = egBodyHeight(b, t);   // EG-ZJ: where it stands (a false wall on its alcove's floor)
    c.at[0] = centre[0] + x; c.at[1] = centre[1] + bodyY + (key === 'pillar' ? 3 : 0); c.at[2] = centre[2] + z;
    c.yaw = c.seed * Math.PI * 2; c.hp = b.max > 0 ? Math.max(0, b.hp / b.max) : 0; c.color = color; c.broke = b.goneAt ? Math.max(0, (t - b.goneAt) / 1000) : -1;
    c.flash = Math.max(0, 1 - (t - (b.hurtAt ?? -Infinity)) / 180);
    c.grow = (b.fl & EG_FL.ward) !== 0 ? 0.6 : 1;
    _crystals.push(c);
    if (!b.goneAt && (b.fl & EG_FL.ward) === 0) {
      c.target ??= { i: b.i, feet: [0, 0, 0], height: CRYSTAL_H, radius: CRYSTAL_R, entity: crystalStandIn({ mobile: 31, scale: 1 }, b.i, () => c.hp, myBlowX), mobile: 31, name: key, m: b.max };   // FIELD BUGS 2026-10-18f RELAY-SHARE: its health as the relay says it (`c.hp`, the share it is drawn at)
      c.target.feet[0] = c.at[0]; c.target.feet[1] = c.at[1]; c.target.feet[2] = c.at[2]; c.target.m = b.max;
      turnStandIn(c.target, b);   // FIELD BUGS 2026-10-18f TURNED-BLOW: an errand's object struck from traversal ground (but one standing off the floor, struck from beside it)
      _targets.push(c.target);
    }
    const L = (c.light ??= { x: 0, y: 0, z: 0, range: 6, color: [0, 0, 0] }), k = 0.8 + 0.25 * Math.sin(t / 240 + c.seed * 6);
    L.x = c.at[0]; L.y = c.at[1] + 2; L.z = c.at[2]; L.color[0] = color[0] * k; L.color[1] = color[1] * k; L.color[2] = color[2] * k;
    _lights.push(L);
  }
  /** FB1018D DUEL-RING (section 13.3, the Last Armsmaster's Challenge and Garoth's Clan Muster: "a ring of fire (r 6) rises
   *  around the two"): the ring the room stands (`pg.ring` - `[x, z, r]`) drawn on the fight floor under it as burning ground
   *  is, a band of fire EG_DUEL_RING_HALF_M either side of the rim, its line THE SPIRE DANGER EDGE - where the challenged are
   *  kept in and the company out (ringKeep). Before it, the room's word kept the motor to an unseen rim. */
  function duelRing(R, t) {
    const sh = (_slots[_shapes.length] ??= slot());
    if (!fillStamp(sh, shRing(R[0], R[1], Math.max(0, R[2] - EG_DUEL_RING_HALF_M), R[2] + EG_DUEL_RING_HALF_M))) return;
    sh.t = 1; sh.flash = 0; sh.alpha = 1; sh.color = COLOR_OF.fire; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.ground; sh.style = TELEGRAPH_STYLE.fire;
    sh.since = (t % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
    _shapes.push(sh);
  }
  /** FB1018D WINCH-PLATES (section 8.3, the Winch: "the portcullis rises only while `min(2, n)` members stand on its winch
   *  plates"): each winch plate the room counts (net/eliteGates/egBrain.js - `spots.winch`, a member within EG_TOUCH_M; section
   *  16.1's errand marks) drawn as a stood-on errand is (drawGround - gold, it holds) while the winch is still to raise, on its
   *  own disc's surface (the plates stand off the walkway's fight floor, so no floor's clip carries them). The objective named
   *  them, and they were two of the walkway's plain discs by the gate. */
  function winchPlates(F, t) {
    if (stageNow !== 'trial') return;
    for (const q of spec.spots?.winch ?? []) {
      const sh = (_slots[_shapes.length] ??= slot());
      sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = q.x; sh.origin[1] = q.z; sh.r = EG_TOUCH_M; sh.points.length = 0; sh.n = 0;
      sh.color = GROUND_COLORS.plate; sh.edge = TELEGRAPH_EDGE_SAFE; sh.pool = TELEGRAPH_POOL.ground; sh.t = 1; sh.flash = 0; sh.alpha = 0.85;
      sh.style = TELEGRAPH_STYLE.weight; sh.since = (t % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
      sh.y = Number.isFinite(q.y) ? q.y / 100 : 0;   // the spot's height in centimetres, as the law lays it
      _shapes.push(sh);
    }
  }
  /** FIELD BUGS 2026-10-19f GAUNTLET-PLATES (section 8.3, the Gauntlet: "each silenced by standing 3 s on its plate"): each
   *  caster's plate the room counts (net/eliteGates/egBrain.js trialStep's Gauntlet - a member within EG_TOUCH_M of
   *  `spots.pillar[j].plate`, EG_SILENCE_MS unbroken) drawn as the winch's are (winchPlates - gold, EG_TOUCH_M, its own surface)
   *  through the trial, at its ground's height (egPlateY); one whose Caster is silenced (the room's `pg.silenced[j]`) dimmed as
   *  an unlit rune is - done, by its plate held or by its Caster slain (GAUNTLET-SLAIN, the same trialStep: a blow or a spell
   *  that kills a Caster silences it). A relay before world232 (world231 or older) says no plate's word: every plate the hall
   *  lays is drawn while a Caster is left (`pg.left`). Before it the plates the objective now names were marked by nothing. */
  function gauntletPlates(F, t) {
    if (stageNow !== 'trial' || F.pg?.obj !== 'gauntlet') return;
    const pillars = spec.spots?.pillar ?? [], said = Array.isArray(F.pg.silenced) ? F.pg.silenced : null;
    if (!said && !(F.pg.left > 0)) return;
    for (let j = 0; j < (said ? Math.min(said.length, pillars.length) : pillars.length); j++) {
      const q = pillars[j], sh = (_slots[_shapes.length] ??= slot());
      sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = q.plate[0]; sh.origin[1] = q.plate[1]; sh.r = EG_TOUCH_M; sh.points.length = 0; sh.n = 0;
      sh.color = GROUND_COLORS.plate; sh.edge = TELEGRAPH_EDGE_SAFE; sh.pool = TELEGRAPH_POOL.ground; sh.t = 1; sh.flash = 0; sh.alpha = said?.[j] ? 0.35 : 0.85;
      sh.style = TELEGRAPH_STYLE.weight; sh.since = (t % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
      sh.y = egPlateY(spec, q);
      _shapes.push(sh);
    }
  }
  /** A stood-on object on the floor: its disc in its colour (a rune lit, a gem's souls). */
  /** EG-PERFECT (section 13.3, Wingbeat "told 1 s"): a gust's tell on my feet - the lane it will push me along, as far as it
   *  pushes, filling to its landing and pulsing in its last half; its wind heard once a gust. */
  function gustTell(g, f, t) {
    const sh = (_slots[_shapes.length] ??= slot()), len = Math.max(1, (g.v ?? 3) * ((g.ms ?? 1000) / 1000)), k = Math.max(0, Math.min(1, 1 - (g.at - t) / EG_GUST_TELL_MS));
    sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = f[0]; sh.origin[1] = f[1]; sh.end[0] = f[0] + g.dx * len; sh.end[1] = f[1] + g.dz * len; sh.halfW = 0.6; sh.r = 0;
    sh.t = k; sh.flash = k > 0.5 ? 0.5 + 0.5 * Math.sin(t / 70) : 0; sh.alpha = 1; sh.color = PEND_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.style = TELEGRAPH_STYLE.weight;
    sh.since = (k * EG_GUST_TELL_MS) / 1000; sh.span = EG_GUST_TELL_MS / 1000; sh.after = -1; sh.court = 0;
    _shapes.push(sh);
    if (!cued.has(`g${g.at}`)) { cued.add(`g${g.at}`); playOne(EG_GUST_SOUND); }
  }
  function drawGround(b, t, key) {
    const sh = (_slots[_shapes.length] ??= slot());
    sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = b.x; sh.origin[1] = b.z; sh.r = key === 'isle' ? 0 : Math.max(1, b.r ?? 1.5);
    if (key === 'isle') { if (!b.st) return; sh.r = 11; }
    sh.color = GROUND_COLORS[key] ?? GOLD; sh.edge = key === 'umbra' || key === 'isle' ? TELEGRAPH_EDGE_DAGON : TELEGRAPH_EDGE_SAFE;
    sh.pool = TELEGRAPH_POOL.ground; sh.t = 1; sh.flash = 0; sh.alpha = key === 'rune' && !(b.st & 1) ? 0.35 : key === 'isle' ? (b.st === 1 ? 0.9 : 0.6) : 0.85;
    sh.style = key === 'isle' ? TELEGRAPH_STYLE.fire : TELEGRAPH_STYLE.weight; sh.since = (t % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
    // AUDIT EG V (lane1 #12; section 13.3, "the true one glints with its WIND"): the umbra the room says glints (`st` 1) - lit and
    // pulsing, and the Night-Stalker's WIND heard from it once
    if (key === 'umbra' && b.st === 1) {
      sh.color = brighter(sh.color); sh.flash = 0.65 + 0.35 * Math.sin(t / 90); sh.alpha = 1;
      if (!cued.has(`u${b.i}`)) { cued.add(`u${b.i}`); _barks.push({ kind: STALKER_MOBILE, at: toDungeon(b.x, 1, b.z), cue: hostCue('windup', STALKER_MOBILE), critical: true }); }
    }
    _shapes.push(sh);
  }
  /** AUDIT EG V (lane1 #13; sections 13.3 and 25.6) - THE PLACE'S DARK: Gutterdark (the Mother of Dusk's) and the Long Night
   *  (Seyth's) lay the telegraph pass's dark pool over every fight floor (the Eclipse's own, egDarkAt's depth) - every telegraph
   *  keeps its light above it, every foe its rim (drawBody) - and the Long Night keeps the moon-shafts lit; and THE RAILS along
   *  the Colossus's flanks stand gold while they rise (`erail` - its hearts open to blows meanwhile). */
  function placeDark(F, t) {
    if (F.dark !== darkUntil) { darkUntil = F.dark; darkFrom = t; }
    darkNow = egDarkAt(darkUntil, t, darkFrom);
    if (darkNow > 0) {
      const sh = (_slots[_shapes.length] ??= slot()), S = spec.lord === 'seyth' ? spec.spots?.shafts?.[0] : null;
      sh.kind = TELEGRAPH_KIND.all; sh.points.length = 0; sh.n = 0; sh.r = S ? 3 : 0;
      if (S) for (const q of moonShafts(S, t)) sh.points.push([q[0], q[1]]);
      sh.t = darkNow; sh.flash = 0; sh.alpha = 1; sh.color = DARK_EDGE; sh.edge = DARK_EDGE; sh.pool = TELEGRAPH_POOL_SPIRE.dark; sh.style = TELEGRAPH_STYLE.weight; sh.since = 0; sh.span = 1; sh.after = -1; sh.court = 0;
      _shapes.push(sh);
    }
    const C = F.rail > t ? F.bodies.find((b) => b.role === EG_ROLE.lord && EG_BOSS_KEYS[b.k] === 'colossus' && !b.fellAt) : null;
    if (C) {
      const [x, z] = egBodyPlace(C, t);
      for (const [ax, az, bx, bz] of egRailsAt(x, z)) {
        const sh = (_slots[_shapes.length] ??= slot());
        sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = ax; sh.origin[1] = az; sh.end[0] = bx; sh.end[1] = bz; sh.halfW = 0.6; sh.r = Math.hypot(bx - ax, bz - az) / 2; sh.r1 = 0;
        sh.color = GOLD; sh.edge = TELEGRAPH_EDGE_SAFE; sh.pool = TELEGRAPH_POOL.ground; sh.t = 1; sh.flash = 0; sh.alpha = Math.min(1, (F.rail - t) / 400); sh.style = TELEGRAPH_STYLE.weight; sh.since = (t % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
        _shapes.push(sh);
      }
    }
  }
  /** A blow's shape, refilled into a slot: its line in THE SPIRE DANGER EDGE, its fill climbing through its wind-up. EG-ZG:
   *  `rank` its place in THE TELEGRAPH BUDGET (net/eliteGates/egShape.js egShapeOrder's), its CHECK's havens beside it. */
  function drawBlow(bl, t, aimedAtMe, rank = Infinity) {
    const from = bl.at - bl.wu, span = Math.max(1, bl.sp ?? 0);
    if (t < from - (bl.ol ?? 0) || t > bl.at + span + LINGER_MS) return;   // AUDIT EG V (lane1 #18): a chained shape's dim outline from the first's word
    for (let j = 0; j < bl.s.length; j++) {
      const s = bl.s[j], sh = (_slots[_shapes.length] ??= slot());
      if (!fillStamp(sh, s)) continue;
      if (bl.on && s[0] === 'd') { const at = targetFeet(bl.on[j] ?? bl.on[0]); if (at) { sh.origin[0] = at[0]; sh.origin[1] = at[1]; } }   // AUDIT EG IV (lane1 #5): a failure blow's mark rides the member it names
      sh.order = rank;
      sh.t = Math.max(0, Math.min(1, ((bl.cut ? Math.min(t, bl.cut) : t) - from) / Math.max(1, bl.wu))); sh.flash = t >= bl.at ? 1 : 0;   // EG-ZD: a feint's fill frozen where it was cut
      sh.alpha = bl.cut ? Math.max(0, 1 - (t - bl.cut) / EG_FEINT_FADE_MS) : t > bl.at + span ? 1 - (t - bl.at - span) / LINGER_MS : t < from ? EG_OUTLINE_DIM : aimedAtMe ? 1 : 0.85;
      sh.cut = !!bl.cut;   // EG-ZD (section 13.2): dashed as it fades
      sh.color = COLOR_OF[bl.el] ?? COLOR_OF.null; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.court = 0; sh.mine = aimedAtMe;
      sh.style = bl.ch ? TELEGRAPH_STYLE.dagon : STYLE_OF[bl.el] ?? TELEGRAPH_STYLE.weight;
      sh.since = Math.max(0, (t - from) / 1000); sh.span = Math.max(0.001, bl.wu / 1000); sh.after = t >= bl.at ? (t - bl.at) / 1000 : -1; sh.runS = (bl.sp ?? 0) / 1000;
      sh.by = Number.isFinite(bl.y) ? bl.y : NaN;   // THE ASCENT (Elite-Gates-Ascent.md section 2): drawn on its own storey's floors
      _shapes.push(sh);
      // a CHECK's havens, gold and safe
      if (s[0] === 'h') for (let i = 1; i + 2 < s.length; i += 3) { const hv = (_slots[_shapes.length] ??= slot()); hv.mine = false; hv.kind = TELEGRAPH_KIND.disc; hv.origin[0] = s[i]; hv.origin[1] = s[i + 1]; hv.r = s[i + 2]; hv.color = GOLD; hv.edge = TELEGRAPH_EDGE_SAFE; hv.pool = TELEGRAPH_POOL.ground; hv.t = 1; hv.flash = 0; hv.alpha = 1; hv.style = TELEGRAPH_STYLE.weight; hv.since = 0; hv.span = 1; hv.after = -1; hv.court = 0; hv.order = rank; hv.by = sh.by; _shapes.push(hv); }
    }
  }
  /** EG-H1 - WATCHFIRE'S EARLY OUTLINE (section 15): a told blow's stamps as a PULSING solid red line - no fill, never blue -
   *  from its lead (`sh`) before its wind-up (or its hearing) until its word (`eb`) takes it over or its `untell` takes it off. */
  function drawTold(bl, t) {
    const from = Math.max(bl.heard ?? -Infinity, bl.at - bl.wu - (bl.ol ?? 0) - (bl.sh ?? 0));
    if (t < from || t >= bl.at) return;
    for (const s of bl.s) {
      const sh = (_slots[_shapes.length] ??= slot());
      if (!fillStamp(sh, s)) continue;
      sh.t = 0; sh.flash = 0; sh.alpha = 0.65 + 0.35 * Math.sin((t / TOLD_PULSE_MS) * Math.PI);
      sh.color = COLOR_OF.null; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.court = 0; sh.style = TELEGRAPH_STYLE.weight; sh.by = Number.isFinite(bl.y) ? bl.y : NaN;
      sh.since = 0; sh.span = Math.max(0.001, bl.wu / 1000); sh.after = -1; sh.runS = 0;
      _shapes.push(sh);
    }
  }
  /** THE PLACE (sections 8.3 and 10.3), on every screen alike: a Rampart's vents (told EG_VENT_WARN_MS and erupting
   *  EG_VENT_FIRE_MS on the relay's clock from the hall's wake - net/eliteGates/egLaw.js egVentAt) and a span's Vents and Pendulums
   *  (the shared clock - net/eliteGates/egSpanLaw.js): each drawn in the telegraph pass, a vent's eruption judged on my feet once. A
   *  Pendulum's touch is the span's own cast-back (scenes/eliteGates/egSpan.js); its lane here brightens over its last EG_PEND_CLEAR_MIN.
   *  EG-ZC: a slag crust's last EG_SLAG_WARN_S told in white over its lane - it breaks next (the spill's own molten lanes are
   *  the fragments' hazards, fragHazards). */
  function place(E, t) {
    if (!spec || (E.sg !== 'trial' && E.sg !== 'closing')) return;
    const f = myFeet(), d = feet(), e = player(), standing = !!f && !!e && e.health > 0, fy = d && centre ? d[1] - centre[1] : 0;
    if (spec.vents?.length && E.sg === 'trial' && E.hw > 0) {
      for (let i = 0; i < spec.vents.length; i++) {
        const v = spec.vents[i], st = egVentAt(v, E.hw, t);
        if (st.st === 'quiet') continue;
        const sh = (_slots[_shapes.length] ??= slot());
        sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = v.x - v.halfW; sh.origin[1] = v.z; sh.end[0] = v.x + v.halfW; sh.end[1] = v.z; sh.halfW = v.d / 2; sh.r = 0;
        sh.t = st.st === 'warn' ? st.k : 1; sh.flash = st.st === 'fire' ? 1 : 0; sh.alpha = 1; sh.color = PEND_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.style = TELEGRAPH_STYLE.fire;
        sh.since = st.st === 'warn' ? (st.k * EG_VENT_WARN_MS) / 1000 : EG_VENT_WARN_MS / 1000; sh.span = EG_VENT_WARN_MS / 1000; sh.after = st.st === 'fire' ? (st.k * EG_VENT_FIRE_MS) / 1000 : -1; sh.court = 0;
        _shapes.push(sh);
        if (st.st === 'warn') _pending.push({ s: [['l', sh.origin[0], sh.origin[1], sh.end[0], sh.end[1], v.d]], at: t + (1 - st.k) * EG_VENT_WARN_MS, wu: EG_VENT_WARN_MS, nm: 'Fire Vent', ch: 0 });   // EG-ZG: the peril arrow's
        if (st.st === 'fire' && ventJudged.get(`r${i}`) !== st.at) { ventJudged.set(`r${i}`, st.at); play3(BOSS_CUES.quake, toDungeon(v.x, 1, v.z)); }
        // EG-PERFECT (2026-10-18): THE BITE THROUGH THE WHOLE FIRE - feet in it at any frame of the eruption, once an eruption (it
        // was judged on the fire's first frame alone: a body that walked in a beat later stood in the flame unhurt)
        if (st.st === 'fire' && standing && ventJudged.get(`rb${i}`) !== st.at && egInVent(v, f[0], f[1])) { ventJudged.set(`rb${i}`, st.at); landShare(EG_VENT_PCT, 0, 'fire', 'Fire Vent'); }
      }
    }
    const ts = t / 1000;
    for (const s of spec.steps ?? []) {
      if (s.kind === 'vent') {
        const st = egVentState(s, ts);
        if (!(st.tell > 0) && !st.fire) continue;
        const sh = (_slots[_shapes.length] ??= slot());
        sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = s.x; sh.origin[1] = s.z; sh.r = EG_VENT_R;
        sh.t = st.fire ? 1 : st.tell; sh.flash = st.fire ? 1 : 0; sh.alpha = 1; sh.color = PEND_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.style = TELEGRAPH_STYLE.fire;
        sh.since = st.tell * EG_VENT_TELL_S; sh.span = EG_VENT_TELL_S; sh.after = st.fire ? 0 : -1; sh.court = 0;
        sh.y = s.y;   // EG-ZG (section 11.7): traversal ground - drawn on its own surface, never a fight floor's
        _shapes.push(sh);
        const cycle = `v${s.i}:${Math.floor((ts + s.phase) / s.period)}`;
        // EG-PERFECT: judged through the whole fire - feet entering its disc at any frame of the eruption, once an eruption
        if (st.fire && !ventJudged.has(cycle) && standing && Math.abs(fy - s.y) < 1.5 && egInVentDisc(s, f[0], f[1])) {
          ventJudged.set(cycle, 1);
          if (ventJudged.size > 256) ventJudged.delete(ventJudged.keys().next().value);
          landShare(EG_VENT_PCT, 0, 'fire', 'Vent');
        }
      } else if (s.kind === 'pend' && s.period > 0) {
        const w = egPendAt(s, ts), theta = (2 * Math.PI * ts) / s.period + s.phase;
        const toCentre = ((Math.PI - (((theta % Math.PI) + Math.PI) % Math.PI)) / (2 * Math.PI)) * s.period;   // until the weight next crosses the course
        const sh = (_slots[_shapes.length] ??= slot());
        sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = s.x - EG_PEND_REACH - EG_PEND_HALF; sh.origin[1] = w.z; sh.end[0] = s.x + EG_PEND_REACH + EG_PEND_HALF; sh.end[1] = w.z; sh.halfW = EG_PEND_HALF; sh.r = 0;
        sh.t = toCentre < EG_PEND_CLEAR_MIN ? 1 - toCentre / EG_PEND_CLEAR_MIN : 0; sh.flash = 0; sh.alpha = toCentre < EG_PEND_CLEAR_MIN ? 1 : 0.4;
        sh.color = PEND_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.ground; sh.style = TELEGRAPH_STYLE.weight; sh.since = 0; sh.span = EG_PEND_CLEAR_MIN; sh.after = -1; sh.court = 0;
        sh.y = s.y;   // EG-ZG: on its own surface
        _shapes.push(sh);
      } else if (s.kind === 'slag') {
        for (let k = 0; k < EG_SLAG_SPOUTS; k++) {
          const S = egSlagState(s, k, ts), left = (1 - S.k) * EG_SLAG_CRUST_S;
          if (S.st !== 'crust' || left >= EG_SLAG_WARN_S) continue;
          const sh = (_slots[_shapes.length] ??= slot()), lx = egSlagX(s, k);
          sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = lx; sh.origin[1] = s.z - s.d / 2; sh.end[0] = lx; sh.end[1] = s.z + s.d / 2; sh.halfW = s.w / 2; sh.r = 0;
          sh.t = 1 - left / EG_SLAG_WARN_S; sh.flash = 0; sh.alpha = 1; sh.color = PEND_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.ground; sh.style = TELEGRAPH_STYLE.weight;
          sh.since = EG_SLAG_WARN_S - left; sh.span = EG_SLAG_WARN_S; sh.after = -1; sh.court = 0;
          sh.y = s.y;   // EG-ZJ (section 11.7): on the crust's own surface - a step of the course, never a fight floor's
          _shapes.push(sh);
        }
      }
    }
    fragHazards(E, ts, f, fy, standing);
  }
  /**
   * EG-FULL LAYER THREE - THE FRAGMENTS' HAZARDS (section 11.2; net/eliteGates/egFragLaw.js egHazardParts): each told and live part
   * drawn in the telegraph pass - a fire fall's white shimmer then its burning, a surge's and a cascade's lanes, the basalt's
   * and the hammers' discs, a slag spill (EG-ZC: the Forge kit's spouts now pour it), the tide over a chamber's low floor, the Eclipse's moon-shafts gold - and each
   * live part judged on my own feet once (its key), within its height. A soul-wisp binds a member within 3 m and drains them
   * until 6 m apart or 4 s, then lets go a while. The mist is sight alone, never harm (not drawn here).
   */
  function fragHazards(E, ts, f, fy, standing) {
    if (!spec.hazards?.length) return;
    const t = ts * 1000;
    for (const hz of spec.hazards) {
      if (hz.kind === 'mist') continue;
      if (hz.kind === 'wisp') { wispStep(hz, ts, t, f, fy, standing); continue; }
      for (const p of egHazardParts(hz, ts)) {
        const H = EG_HAZARDS[hz.kind];
        if (p.st === 'tell' && H.aim !== 'trav') _pending.push({ s: [p.sh], at: t + (1 - p.k) * H.tell, wu: H.tell, nm: H.name, ch: H.aim === 'check' ? 1 : 0 });   // EG-ZG: the peril arrow's
        if (p.sh[0] === 'h') {
          // a CHECK (the Eclipse): its moon-shafts drawn gold - the havens; everything outside them is struck at its landing
          for (let k = 1; k + 2 < p.sh.length; k += 3) {
            const sh = (_slots[_shapes.length] ??= slot());
            sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = p.sh[k]; sh.origin[1] = p.sh[k + 1]; sh.r = p.sh[k + 2];
            sh.t = p.k; sh.flash = 0; sh.alpha = 1; sh.color = GOLD; sh.edge = TELEGRAPH_EDGE_SAFE; sh.pool = TELEGRAPH_POOL.ground; sh.style = TELEGRAPH_STYLE.weight; sh.since = p.k * 6; sh.span = 6; sh.after = -1; sh.court = 0;
            _shapes.push(sh);
          }
          if (hz.kind === 'eclipse') eclipseLook(hz, ts, t);
        } else {
          const sh = (_slots[_shapes.length] ??= slot());
          if (!fillStamp(sh, p.sh)) continue;
          const told = EG_HAZARDS[hz.kind].tell / 1000;
          sh.t = p.st === 'tell' ? p.k : 1; sh.flash = p.st === 'live' ? 1 : 0; sh.alpha = 1;
          sh.color = PEND_COLOR;   // AUDIT EG V (L5-3): the place's white, told and landing - the palette's hazard
          sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.style = p.el === 'fire' ? TELEGRAPH_STYLE.fire : TELEGRAPH_STYLE.weight;
          sh.since = p.st === 'tell' ? p.k * told : told; sh.span = told; sh.after = p.st === 'live' ? 0 : -1; sh.court = 0;
          sh.y = egHazardSurface(hz);   // EG-ZG (section 11.7): a hazard of the traversal ground on its own surface; EG-ZJ: and the slag's spill, over its crust
          _shapes.push(sh);
        }
        if (p.st === 'live' && hz.kind === 'fall') drawFireFall(hz, t);   // EG-ZH: the fall burning in Daggerfall's own fire
        if (p.st === 'live' && standing && !hazHit.has(p.key) && egHazardBites(hz, p, f[0], fy, f[1])) {
          hazHit.set(p.key, 1);
          if (hazHit.size > 512) hazHit.delete(hazHit.keys().next().value);
          landShare(p.pct, 0, p.el, EG_HAZARDS[hz.kind].name);
        }
      }
    }
  }
  /** A soul-wisp: drawn where it drifts; it binds me within its reach on its floor, drains me a tick a second, and lets
   *  go at 6 m or after 4 s - then not again for WISP_AGAIN_MS. */
  function wispStep(hz, ts, t, f, fy, standing) {
    const L = EG_HAZARDS.wisp, [wx, wz] = egWispAt(hz, ts);
    const sh = (_slots[_shapes.length] ??= slot());
    sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = wx; sh.origin[1] = wz; sh.r = 0.6;
    sh.t = 1; sh.flash = 0; sh.alpha = 0.7; sh.color = HAZ_SOUL; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.ground; sh.style = TELEGRAPH_STYLE.weight; sh.since = 0; sh.span = 1; sh.after = -1; sh.court = 0;
    _shapes.push(sh);
    const hold = wispHold.get(hz.i) ?? { from: 0, tick: 0, free: 0 };
    wispHold.set(hz.i, hold);
    const d = standing && Math.abs(fy - hz.y) < 3 ? Math.hypot(f[0] - wx, f[1] - wz) : Infinity;
    if (!hold.from) { if (d <= L.r && t >= hold.free) { hold.from = t; hold.tick = t + WISP_TICK_MS; } return; }
    if (d > L.brk || t - hold.from >= L.live) { hold.from = 0; hold.free = t + WISP_AGAIN_MS; return; }
    if (t >= hold.tick) { hold.tick += WISP_TICK_MS; landShare(L.pct, 0, null, L.name); }
    pullTether([wx, wz], f, L.brk, `w${hz.i}`, true);   // EG-ZG (section 25.5): its hold on me, the pull-apart grammar
  }
  /** EG-ZG - A PULL-APART TETHER (section 25.5) between `a` and `b` (the hall's frame), breaking at `brk` m: a red line with
   *  chevrons pointing out from its middle and a tick at the break, thinning as the pair nears it. `key` and `mine` for the
   *  snap's glass (one of mine gone at its break). */
  function pullTether(a, b, brk, key, mine) {
    const P = egPullLook(a, b, brk), sh = (_slots[_shapes.length] ??= slot());
    sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = P.origin[0]; sh.origin[1] = P.origin[1]; sh.end[0] = P.end[0]; sh.end[1] = P.end[1]; sh.halfW = P.halfW; sh.r = P.r; sh.r1 = P.r1;
    sh.color = TETHER_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL_SPIRE.pull; sh.t = 1; sh.flash = 0; sh.alpha = 1; sh.style = TELEGRAPH_STYLE.dagon; sh.since = (now() % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
    _shapes.push(sh);
    if (mine) pullsNow.set(key, P.d / Math.max(brk, 1e-3));
  }
  /** EG-ZG - THE ECLIPSE (section 25.5): the floor darkened over its last 2 s, every moon-shaft kept (the telegraph pass's
   *  dark pool over every fight floor); a wind rising from 3 s out and a toll at the strike, each once a cycle. The bar's
   *  chip is the HUD's (ui/eliteGates/egSpireHud.js). */
  function eclipseLook(hz, ts, t, e = egEclipseAt(spec, ts)) {   // EG-PERFECT: or a lord's own Eclipse (`e` given - egEclipseOfBlows)
    if (!e) return;
    const dark = egEclipseDark(e);
    if (dark > 0) {
      const sh = (_slots[_shapes.length] ??= slot());
      sh.kind = TELEGRAPH_KIND.all; sh.points.length = 0; for (const q of e.havens.slice(0, 10)) sh.points.push([q[0], q[1]]); sh.r = e.r; sh.n = 0;
      sh.t = dark * EG_ECLIPSE_LOOK.deep; sh.flash = 0; sh.alpha = 1; sh.color = DARK_EDGE; sh.edge = DARK_EDGE; sh.pool = TELEGRAPH_POOL_SPIRE.dark; sh.style = TELEGRAPH_STYLE.weight; sh.since = 0; sh.span = 1; sh.after = -1; sh.court = 0;
      _shapes.push(sh);
    }
    const wind = `${e.key}:w`, toll = `${e.key}:t`;
    if (!e.live && e.secs <= EG_ECLIPSE_LOOK.wind && !eclipseHeard.has(wind)) { eclipseHeard.add(wind); playOne(EG_ECLIPSE_LOOK.windSound); }
    if (e.live && !eclipseHeard.has(toll)) { eclipseHeard.add(toll); playOne(EG_ECLIPSE_LOOK.tollSound); }
    if (eclipseHeard.size > 64) eclipseHeard.delete(eclipseHeard.keys().next().value);
  }
  /** The beats' words and cards: a lord's wake (its card), its phases, its fall, the room's beats. */
  function beats(E, t, F) {
    const lords = F.bodies.filter((b) => b.role === EG_ROLE.lord && (b.fl & EG_FL.mirror) === 0);
    const L0 = lords[0];
    // (THE AUDIT: a burst past both lines turns two phases in one beat - the second's card waits for the first's, never over it)
    if (beat && t >= beat.until && beatNext.length) { const q = beatNext.shift(); beat = { ...q, at: t, until: t + TITLE_HOLD_MS }; }
    if (L0 && wokeSeen !== E.h && (F.says.some((s) => s.w === 'wake') || spec.kind === 'proving')) {
      wokeSeen = E.h;
      const look = egLookOf(L0, band);
      beat = { kind: 'wake', at: t, until: t + TITLE_HOLD_MS, kicker: look.lord ? look.epithet || EG_BANDS[band].name : '', main: look.name, sub: '' };
      play3(BOSS_CUES.roar, toDungeon(L0.x, (L0.y ?? 0) + 3, L0.z));
    }
    for (const f of F.fells) if (!fellSeen.has(f.i)) { fellSeen.add(f.i); const b = F.bodies.find((x) => x.i === f.i) ?? F.gone.find((x) => x.i === f.i); beat = { kind: 'fall', at: t, until: t + TITLE_HOLD_MS, kicker: b ? egLookOf(b, band)?.name ?? '' : '', main: 'FELLED', sub: '' }; }
    // AUDIT EG V (lane1 #14; section 13.2, "turns each phase with the gate's phase card"): each lord's turn its card (egPhaseCard -
    // the numeral, the phase's name, its order), once a fight for a lord's key and phase (the Twins turn each their own), its growl
    for (const p of F.phases) {
      const L = F.bodies.find((b) => b.i === p.i), key = L ? `${EG_BOSS_KEYS[L.k]}:${p.ph}` : `${p.i}:${p.ph}`;
      if (phaseSeen.has(key)) continue;
      phaseSeen.add(key);
      const card = L && (L.fl & EG_FL.mirror) === 0 ? egPhaseCard(EG_BOSS_KEYS[L.k] ?? '', p.ph, spec.c ?? 1) : null;
      if (card && beat?.kind === 'phase' && t < beat.until) beatNext.push({ kind: 'phase', ...card });
      else if (card) beat = { kind: 'phase', at: t, until: t + TITLE_HOLD_MS, ...card };
      const at = L ?? L0;
      play3(BOSS_CUES.growl, at ? toDungeon(at.x, (at.y ?? 0) + 3, at.z) : null);
    }
    // FB1018D SAYS-PAST-TWELVE: the words after the last one said, found by the word itself - the fold keeps EG_SAYS_KEPT and
    // drops the oldest as each comes, so a count of them stood at twelve and nothing more was said for the rest of the hall
    // (one the fold has dropped: every word it keeps came after it)
    for (let k = lastSay ? F.says.indexOf(lastSay) + 1 : 0; k < F.says.length; k++) { const s = F.says[k], fn = EG_SAY[s.w]; const text = fn ? fn(s.n, s.t) : ''; if (s.w === 'scent' && !s.s?.includes(me())) continue; if (text) say(text); }
    lastSay = F.says.at(-1) ?? lastSay;
  }
  /** EG-ZG: a body's or a member's name (a tether's far end). */
  const nameOf = (x, F, E) => (typeof x === 'string' ? egMemberOf(E, x)?.name ?? '' : (() => { const b = F.bodies.find((q) => q.i === x); return b ? egLookOf(b, band)?.name ?? '' : ''; })());
  /** EG-ZG - A VESTIGE AURA (sections 15 and 25.4): one thin blue ring (0.6 m) at each living holder's feet, on the ground
   *  they stand on - never a cloud over the floor the telegraphs live on. */
  function auraRings(E) {
    const holders = egAuraHolders(E);
    if (!holders.length || !centre) return;
    const meSub = me();
    for (const sub of holders) {
      const m = egMemberOf(E, sub);
      if (!m || !m.alive || m.home || !m.in || m.wit) continue;
      const p = sub === meSub ? feet() : peerAt(sub), up = sub === meSub ? 0 : PEER_EYE_M;
      if (!p) continue;
      const sh = (_slots[_shapes.length] ??= slot());
      sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = p[0] - centre[0]; sh.origin[1] = p[2] - centre[2]; sh.r = EG_AURA_RING.r; sh.points.length = 0; sh.n = 0;
      sh.t = 1; sh.flash = 0; sh.alpha = 1; sh.color = EG_AURA_RING.color; sh.edge = EG_AURA_RING.color; sh.pool = TELEGRAPH_POOL_SPIRE.ring; sh.style = TELEGRAPH_STYLE.weight; sh.since = 0; sh.span = 1; sh.after = -1; sh.court = 0;
      sh.y = p[1] - up - centre[1];
      _shapes.push(sh);
    }
  }
  /** EG-ZG - A DROP'S LANDING (section 25.8): falling onto a Drop the course asked for (never a hop on its landing), the
   *  landing plays a designed thud and throws dust out across it - the dungeon arm keeps DFU's hard-landing grunt for every
   *  other fall (scenes/eliteGates/egSpan.js overDrop). */
  function dropStep(t) {
    const d = feet();
    if (!d || !centre || !spec) { dropFrom = null; dropOn = null; }
    else {
      const x = d[0] - centre[0], y = d[1] - centre[1], z = d[2] - centre[2], s = egDropUnder(spec, x, y, z);
      if (s && y - s.y < DROP_STOOD_M) {
        if (s === dropFrom) { for (const S of EG_DROP_THUD.sounds) playOne(S); dusts.push({ x, z, y: s.y, at: t }); if (dusts.length > 4) dusts.shift(); }
        dropFrom = null; dropOn = s;
      } else if (s && y - s.y >= EG_DROP_THUD.min && dropOn !== s) dropFrom = s;
      else if (!s) { dropFrom = null; dropOn = null; }
    }
    for (let i = dusts.length - 1; i >= 0; i--) {
      const u = dusts[i], k = (t - u.at) / EG_DROP_THUD.ms;
      if (k >= 1 || k < 0) { dusts.splice(i, 1); continue; }
      const sh = (_slots[_shapes.length] ??= slot());
      sh.kind = TELEGRAPH_KIND.discs; sh.points.length = 0; sh.points.push([u.x, u.z]); sh.n = 0; sh.r = EG_DROP_THUD.r0 + (EG_DROP_THUD.r1 - EG_DROP_THUD.r0) * Math.sqrt(k);
      sh.t = 1; sh.flash = 0; sh.alpha = 0.8 * (1 - k); sh.color = DUST_COLOR; sh.edge = DUST_COLOR; sh.pool = TELEGRAPH_POOL.ground; sh.style = TELEGRAPH_STYLE.weight; sh.since = k; sh.span = 1; sh.after = -1; sh.court = 0;
      sh.y = u.y;
      _shapes.push(sh);
    }
  }
  /** EG-ZG - THE GROUND'S WORDS under the crosshair (the gate's own readout, ui/gate/gateGroundView.js): THE PERIL ARROW (section
   *  25.5 - the blow's name and *move!*, the rim rising in the palette's danger, the way out as the screen turns it; a CHECK
   *  with no light in reach its order), else my chain's (*Chained to Mira - 6.8/8 m*). */
  function groundFrame(t, f, fy, chained) {
    const pal = egAccessNow().palette;
    const peril = (lastPeril = f && spec ? egPerilOf(_pending, f, fy, spec, t) : null);
    const y = yaw() ?? viewYaw;
    let g = null;
    if (peril) {
      g = groundViewModel({ now: t, peril: { name: peril.name, t: peril.t, now: peril.now, color: pal.danger, arrow: peril.dir && Number.isFinite(y) ? screenBearing(peril.dir, /** @type {number} */ (y)) : null } });
      if (g && peril.check && !peril.dir) g = { ...g, warn: EG_CHECK_ORDER };
    } else if (chained) {
      const m = groundViewModel({ now: t, inside: true, color: pal.danger });
      g = m ? { ...m, edge: 0, warn: egChainWords(chained.name, chained.d) } : null;
    }
    lastGround = g;
    if (g || groundUp) { drawGateGround(g, { hidden: hudHidden() }); groundUp = !!g; }
  }
  /** EG-ZG: a pull-apart tether of mine gone at its break snaps - a glass's sound (section 25.5). */
  function snapFrame() {
    for (const [k, share] of pullsWas) if (!pullsNow.has(k) && share >= EG_TETHER.snap) { const d = feet(); if (d) play3(GLASS_CUE, [d[0], d[1] + 1, d[2]]); }
  }
  /** EG-ZG - THE MARKS OVER HEADS (sections 13.2 and 25.5): each marked companion's sigils, Dagon red, over their head
   *  where the camera (`vp` its view-projection) sees it; mine stand on my HUD (ui/eliteGates/egSpireHud.js). */
  function sigilsFrame(vp) {
    _sigils.length = 0;
    const E = link.state(), F = E?.fight?.h === hall ? E.fight : null, meSub = me();
    if (F && centre) {
      // AUDIT EG IV (lane1 #15; section 13.2): ERRANDS BY NUMERAL - over each errand the room gave (`pg.as`), its member's numeral
      // and name (*III - Mira*), or the numerals of several (a gem's group, a twin's)
      const given = _given, tg = now();   // AUDIT EG V (L6-4): each body's numerals in its kept list
      if (given.size > 64) given.clear();
      for (const ns of given.values()) ns.length = 0;
      for (const [i, n] of F.pg?.as ?? []) { let ns = given.get(i); if (!ns) given.set(i, (ns = [])); ns.push(n); }
      for (const [i, ns] of given) {
        if (!ns.length) continue;
        const b = F.bodies.find((x) => x.i === i);
        if (!b || !(b.hp > 0) || b.goneAt) continue;
        const at = egScreenAt(vp, egGivenAt(b, centre, tg, b.role === EG_ROLE.lord ? drawn.get(i)?.top : NaN));   // EG-LOOK (section 9): over a lord's drawn head
        if (at) _sigils.push({ key: `e${i}`, x: at[0], y: at[1], marks: [{ sigil: 'given', text: egGivenWords(ns, E.co) }] });
      }
      // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): over each Orrery stone its name and the hour its hand stands at, as the room
      // last said them (`pg.st`, the stone's `pt` its place in it) - the riddles name the stones and their hours, and the
      // disc said neither. Which stand true stays the dial's count (how many, never which: net/superDungeon/sdBrain.js orreryLit)
      const orr = F.pg?.obj === 'orrery' && Array.isArray(F.pg.st) ? F.pg.st : null;
      if (orr) for (const b of F.bodies) {
        if (b.role !== EG_ROLE.obj || OBJ_KEY[b.k] !== 'stone' || b.goneAt || !Number.isFinite(orr[b.pt])) continue;
        const at = egScreenAt(vp, egGivenAt(b, centre, tg, centre[1] + egBodyHeight(b, tg) + EG_STONE_TOP_M));   // ORRERY-STONES: over its crown gear, never across its sign
        if (at) _sigils.push({ key: `orr${b.i}`, x: at[0], y: at[1], marks: [{ sigil: 'stone', text: spireStoneWords(b.pt, orr[b.pt]) }] });
      }
      const subs = _subs;
      subs.clear();
      for (const m of F.mk ?? []) if (m[0] !== meSub && typeof m[0] === 'string') subs.add(m[0]);
      const t = now();
      for (const sub of subs) {
        const marks = egSigilsOf(F.mk, sub, t), p = marks.length ? peerAt(sub) : null;
        const at = p ? egScreenAt(vp, [p[0], p[1] + EG_SIGIL_UP_M, p[2]]) : null;
        if (at) _sigils.push({ key: sub, x: at[0], y: at[1], marks });
      }
    }
    if (_sigils.length || sigilsUp) { drawEgSigils(_sigils.length ? _sigils : null, { hidden: hudHidden(), danger: egAccessNow().palette.danger }); sigilsUp = _sigils.length > 0; }
  }

  return {
    /** One frame of the hall's fight. */
    frame() {
      frameNo++;   // AUDIT EG V (L6-4): the company's memo is a frame's
      blowMet.clear();
      const E = link.state(), t = now();
      if (!E.b || !(E.h > 0) || E.end) { if (hall) this.leave(); return; }
      if (E.h !== hall) reset(E);
      else if (egHallOf(E.seed, E.h, E.geo ?? 0) !== spec) respec(E);   // AUDIT EG V (L3-7): the breach's own hall, given
      mix.peers(true);   // EG-ZH (section 26): every peer's sound 4 dB down while a hall's fight runs
      const F = E.fight.h === E.h ? E.fight : null;
      _batches.length = 0; _lights.length = 0; _targets.length = 0; _crystals.length = 0; _shapes.length = 0; _barks.length = 0; _pending.length = 0;
      for (const sl of _slots) { sl.mine = false; sl.cut = false; sl.y = NaN; sl.order = Infinity; sl.by = NaN; }   // EG-G2: a slot is mine only when this frame's blow says so; EG-ZD: a cut feint's the same; EG-ZG: its own surface and its rank this frame's
      { const pw = pullsWas; pullsWas = pullsNow; pullsNow = pw; pullsNow.clear(); }   // AUDIT EG V (L6-4): swapped in place, no pair made a frame
      stageNow = E.sg;
      place(E, t);
      auraRings(E);   // EG-ZG (section 25.4)
      dropStep(t);   // EG-ZG (section 25.8)
      const f = myFeet(), e = player(), standing = !!f && !!e && e.health > 0, d0f = feet(), fy = d0f && centre ? d0f[1] - centre[1] : 0;
      if (standing) { trail.push([t, f[0], fy, f[1], hall]); while (trail.length > 1 && trail[1][0] <= t - EG_TRAIL_MS) trail.shift(); }   // EG-ZP: my trail, the census's shape
      if (standing) { _strikeAt[0] = f[0]; _strikeAt[1] = fy; _strikeAt[2] = f[1]; }
      strikeAt = standing ? _strikeAt : null;   // FIELD BUGS 2026-10-18f TURNED-BLOW: where this frame's blows are struck from, as the relay reads my pose
      if (!F) { groundFrame(t, standing ? f : null, fy, null); snapFrame(); titleFrame(t); return; }
      placeDark(F, t);   // AUDIT EG V (lane1 #13): Gutterdark, the Long Night and the Rails
      const blowBy = _blowBy;
      blowBy.clear();
      for (const bl of F.blows) if (bl.o && (!blowBy.has(bl.o) || blowBy.get(bl.o).at < bl.at) && t < bl.at + 700) blowBy.set(bl.o, bl);
      // THE BODIES - the standing, then the gone still falling (AUDIT EG V L6-4: no list joined a frame)
      const live = _live;
      live.clear();
      for (const b of F.bodies) liveBody(b, t);
      for (const g of F.gone) if (t - g.goneAt < FALL_MS) liveBody(g, t);
      winchPlates(F, t);   // FB1018D WINCH-PLATES: the stood-on plates that are no body
      gauntletPlates(F, t);   // FIELD BUGS 2026-10-19f GAUNTLET-PLATES: and the Gauntlet's, each caster's
      for (const [i, d] of drawn) if (!live.has(i)) { destroy(d); drawn.delete(i); }
      lordFall.sweep();   // EG-FALL: a lord raised, or gone from the fight, has its body put away
      for (const i of crystalSlots.keys()) if (!live.has(i)) crystalSlots.delete(i);
      mix.barks(_barks, cam(), (b) => play3(b.cue, b.at));   // EG-G2: the legion's barks, four a kind, nearest first
      // THE BLOWS - drawn in the budget's order, each judged on my feet at its landing
      const lordIds = _lordIds;
      lordIds.clear();
      for (const b of F.bodies) if (b.role === EG_ROLE.lord) lordIds.add(b.i);
      if (lordIds.size) lordFall.warm();   // AUDIT EG-FALL (L1-6): a lord stands - its fall's sparks built before the kill
      _orderIn.length = 0;
      for (const bl of F.blows) if (!bl.cut || t - bl.cut < EG_FEINT_FADE_MS) _orderIn.push(bl);
      const st = f && egByHeight(spec) ? egStoreyY(egFightView(spec), f[0], fy, f[1]) : NaN;   // THE ASCENT (Elite-Gates-Ascent.md section 2): my storey (none known in a hall that judges in plan)
      const order = egShapeOrder(_orderIn, f ?? NO_FEET, t, _orderOpts);   // AUDIT EG IV (lane1 #5): a failure blow naming me is aimed at me (namesMe's own law, kept in _orderOpts)
      for (let k = 0; k < order.length; k++) {
        const bl = order[k], mine = bl.on ? bl.on.includes(me()) : !!f && egOneStorey(st, bl.y) && bl.s.some((s) => egInShape(s, f[0], f[1]));   // AUDIT EG IV (lane1 #5): a failure blow is mine when it names me; THE ASCENT: never one of another storey over my plan
        drawBlow(bl, t, mine, k);   // EG-ZG: its rank, THE TELEGRAPH BUDGET's order for the floors' draws
        // EG-G2 - THE SPIRE MIX: a personal sting at its word for a lord's blow or a CHECK on my feet; an add's at most one each 1.5 s
        if (mine && standing && !stung.has(bl.i) && t < bl.at) { stung.add(bl.i); const d0 = feet(); mix.sting(bl.ch ? 'check' : lordIds.has(bl.o) ? 'lord' : 'add', d0 ? [d0[0], d0[1], d0[2]] : null); }
      }
      for (const bl of F.told ?? []) {
        drawTold(bl, t);   // EG-H1: Watchfire's early outlines
        // EG-ZH (section 26): WATCHFIRE'S TELL - heard once a blow, as its outline first shows, where it will land
        if (!toldHeard.has(bl.i) && t >= Math.max(bl.heard ?? -Infinity, bl.at - bl.wu - (bl.ol ?? 0) - (bl.sh ?? 0)) && t < bl.at) { toldHeard.add(bl.i); const at = egToldAt(bl, f); if (at) mix.tell(toDungeon(at[0], 1, at[1])); }
      }
      const motion = egShakeMotion(egReducedMotion(), getPref('techniqueMotion'));   // EG-ZG (section 25.7): the shakes under reduced motion and Technique camera motion
      // AUDIT EG III (lane1 #12): MORVAYN'S CHAINING - a blow on any of my chain split over all of it (egChainMates; none: mine whole)
      const mates = egChainMates(F.tx, me()), part = 1 / (mates.length + 1);
      for (const bl of F.blows) {
        if (!bl.cut && t < bl.at) _pending.push(bl);   // EG-ZG: the peril arrow's
        if (!judged.has(bl.i) && !bl.cut && standing) {
          const v = onStorey(egBlowVerdict(bl, f[0], f[1], t, 400, me()), bl, f[0], fy, f[1], t);   // AUDIT EG IV (lane1 #5): a failure blow that names me lands wherever I stand; THE ASCENT: on its own storey
          if (v !== 'wait') { judged.add(bl.i); if (v === 'hit') { landShare(bl.p, bl.b, bl.el, bl.nm, spared(E, F, bl), part * egTouchedX(F, bl, me(), t), true); if (bl.pu > 0) { const s = bl.s[0]; const ox = s[0] === 'l' ? s[3] - s[1] : f[0] - s[1], oz = s[0] === 'l' ? s[4] - s[2] : f[1] - s[2], d = Math.hypot(ox, oz) || 1; push(ox / d, oz / d, bl.pu); } } }   // AUDIT EG III (lane1 #4): THE TWINS' TOUCHED, on my own blow
        }
        if (mates.length && !bl.cut && standing) for (const sub of mates) {   // AUDIT EG III (lane1 #12): my part of a blow on a chained mate, at their feet where this screen draws them
          const key = `${bl.i}:${sub}`, q = judged.has(key) ? null : peerFeet(sub);
          if (!q) continue;
          const v = onStorey(egBlowVerdict(bl, q[0], q[2], t, 400, sub), bl, q[0], q[1], q[2], t);
          if (v !== 'wait') { judged.add(key); if (v === 'hit') landShare(bl.p, bl.b, bl.el, bl.nm, spared(E, F, bl), part, true); }   // AUDIT EG V (L8-1): a body's blow
        }
        if (!landedSet.has(bl.i) && t >= bl.at && t - bl.at < 1500) {
          landedSet.add(bl.i); const s = bl.s[0]; if (s && s.length >= 3) play3(BOSS_CUES.quake, toDungeon(s[1], 1, s[2]));
          if (!bl.cut && standing) { const k = egHeavyShake(bl, f[0], f[1], motion); if (k >= SHAKE_MIN) shake(k); }   // EG-ZG (section 25.8): WEIGHT - a heavy blow's landing near me shakes the screen
        }
      }
      // THE ZONES - burning ground's tick, the floor gone
      for (const z of F.zones) {
        if (!(t >= z.from && t < z.until)) continue;
        const sh = (_slots[_shapes.length] ??= slot());
        if (fillStamp(sh, z.s)) { sh.t = 1; sh.flash = 0; sh.alpha = Math.min(1, (t - z.from) / 200, (z.until - t) / 1000); sh.color = ZONE_COLORS[z.kind] ?? ZONE_COLORS.burn; sh.edge = z.kind === 'haven' ? TELEGRAPH_EDGE_SAFE : TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.ground; sh.style = z.kind === 'burn' ? STYLE_OF[z.el] ?? TELEGRAPH_STYLE.fire : TELEGRAPH_STYLE.weight; sh.since = (t - z.from) / 1000; sh.span = 1; sh.after = -1; sh.court = 0; _shapes.push(sh); }
        if (z.kind === 'burn') { sh.color = egPoolRgb(band); sh.pool = TELEGRAPH_POOL_SPIRE.pool; }   // EG-ZG (section 25.2): A SPIRE POOL - the band's ramp darkened, its rim dashed
        sh.by = Number.isFinite(z.y) ? z.y : NaN;   // THE ASCENT (section 2): drawn on its own floor
        if (!standing || !egInShape(z.s, f[0], f[1]) || (Number.isFinite(z.y) && !egBears(z.y, egFeetY(spec, fy)))) continue;   // THE ASCENT: it holds only feet its floor bears
        if (z.kind === 'burn' && t - (zoneTick.get(z.i) ?? 0) >= EG_TICK_MS) { zoneTick.set(z.i, t); landShare(z.p, z.b, z.el, 'Burning ground'); }
        if (z.kind === 'void' && t - voidAt >= 1500 && egRimCastsBack(F.zones, f[0], f[1], t, egFeetY(spec, fy))) { voidAt = t; castBack(); }   // AUDIT EG V: never on a haven (a Molten Rim's causeway)
      }
      // THE TETHERS (EG-ZG, section 25.5): the pull-apart grammar for a drain and a Blood Tether, the stay-close for a chain; a Wraith's drain on me ticks
      const meSub = me();
      let chained = null;
      for (const tx of F.tx) {
        const a = tetherEnd(tx[0], F, t, f, meSub), b = tetherEnd(tx[1], F, t, f, meSub);
        if (!a || !b) continue;
        const mineTx = tx[0] === meSub || tx[1] === meSub, d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (egTetherKind(tx) === 'pull') pullTether(a, b, egTetherBreak(tx), `${tx[0]}|${tx[1]}|${tx[2]}`, mineTx);
        else {
          const C = egChainLook(d), sh = (_slots[_shapes.length] ??= slot());
          sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = a[0]; sh.origin[1] = a[1]; sh.end[0] = b[0]; sh.end[1] = b[1]; sh.halfW = EG_TETHER.chainHalf; sh.r = d / 2; sh.r1 = 0;
          sh.color = TETHER_COLOR; sh.edge = TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL_SPIRE.chain; sh.t = C.taut; sh.flash = 0; sh.alpha = 1; sh.style = TELEGRAPH_STYLE.dagon; sh.since = (t % 60_000) / 1000; sh.span = 1; sh.after = -1; sh.court = 0;
          _shapes.push(sh);
          if (mineTx && (!chained || d > chained.d)) chained = { name: nameOf(tx[0] === meSub ? tx[1] : tx[0], F, E), d };
        }
        if (tx[2] === 0 && tx[1] === meSub && standing && t - drainAt >= EG_TICK_MS && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 8) { drainAt = t; landShare(0.03, 0, null, 'Drain'); }
      }
      // MY MARKS - a challenge's ring kept, a cage held (AUDIT EG V L6-4: read in place, no list made)
      let challenged = false, caged = false;
      for (const m of F.mk) if (m[0] === meSub && m[2] > t) { if (m[1] === 6) challenged = true; if (m[1] === 5) caged = true; }
      const R = F.pg.ring;
      if (R && f) ring(R[0], R[1], R[2], challenged);
      if (R) duelRing(R, t);   // FB1018D DUEL-RING: and drawn - the keep alone stood, unseen
      if (caged) hold(250);
      if (!spec?.hazards?.some((h) => h.kind === 'eclipse')) eclipseLook(null, 0, t, egEclipseOfBlows(F.blows, t));   // EG-PERFECT: a lord's own Eclipse - its dark, its wind and its toll
      // EG-PERFECT: THE GUST TOLD its second before (EG_GUST_TELL_MS - the lane it pushes me along, the wind rising)
      if (F.gust && f && t >= F.gust.at - EG_GUST_TELL_MS && t < F.gust.at) gustTell(F.gust, f, t);
      // THE PLACE - a gust's push
      if (F.gust && F.gust.at !== gustSeen && t >= F.gust.at) { gustSeen = F.gust.at; if (standing) push(F.gust.dx, F.gust.dz, F.gust.v * (F.gust.ms / 1000)); }
      groundFrame(t, standing ? f : null, fy, chained);   // EG-ZG: the peril arrow, the chain's words
      snapFrame();
      beats(E, t, F);
      titleFrame(t);
    },
    /** No one body stands for the gate's boss seam: every body is the legion's seam's (`hostTargets`). */
    target: () => null,
    hit: () => false,
    /** Every body my blows meet - lords, the legion, the struck objects - and a blow of mine on one (`hit` by number). */
    hostTargets: () => _targets,
    /** FIELD BUGS 2026-10-20f (LANDED-WORD): whether my relay says what my blows land (the breach client, each frame). */
    landsWord(on) { landWord = !!on; },
    /** LANDED-WORD: the room's word that a blow of mine on body `i` landed `d` - its number (HN1's seam), the duel's law (INT8:
     *  a miss said at once, a hit at the referee's word). A blow the room refused or the purse emptied lands 0, and says so. */
    landed(i, d) {
      if (!landWord || !Number.isInteger(i) || !Number.isFinite(d)) return false;
      reportPlayerAttack({ hit: true, damage: d });
      return true;
    },
    hostHit({ i, d, r, tick = false } = /** @type {any} */ ({})) {
      if (!Number.isInteger(i) || !(Math.round(d) >= 1) || !Object.values(HIT_KINDS).includes(r)) return false;
      const E = link.state(), b = E.fight.bodies.find((q) => q.i === i);
      if (!b || (drawn.get(i)?.target ?? crystalSlots.get(i)?.target)?.entity?.warded) return false;   // FIELD BUGS 2026-10-18f TURNED-BLOW: a blow the relay will refuse is never sent, nor flashes it
      b.hurtAt = b.mineAt = now();   // EG-ZG: mine - its flash full (an ally's is 0.4)
      // EG-ZR (section 15): THE VESTIGES I HOLD ON THE BLOW - Searing Edge's fire on a melee blow, Momentum's stacks on
      // this body, Bloodied Fury under half my health, Overcharge on a spell (egHolderBlow); the relay's bucket grown by
      // their declared factor takes the claim
      const vs = egRunOfMember(E, me()).vs, e = player(), q = blowQ(`e${i}`);
      const dmg = Math.round(egHolderBlow(vs, d, r, { stacks: !tick && mom.i === i ? mom.n : 0, low: !!e && e.health < e.maxHealth * EG_BLOODIED_UNDER }));
      if (!sendHit({ i, q, d: dmg, r })) return false;
      if (tick) return true;   // FIELD BUGS 2026-10-19f BOSS-DOT: a round of my lasting harm (`tick`) is no blow - it takes no Momentum, builds none and rolls no Echo
      if (q !== mom.q) mom = { i, n: mom.i === i ? mom.n + 1 : 1, q };   // a blow builds one stack, on the first body it met
      // ARCANE ECHO: a damage spell repeats, its share of casts - one roll a cast, a blow of its own on each body. EG-ZS: claimed
      // at the cast's whole; the relay takes its share - half, or the whole in War-Chorus (net/eliteGates/egRun.js egEchoShare)
      if (r === HIT_KINDS.Spell) {
        if (q !== echo.q) { const v = egVOf(vs, 'echo'); echo = { q, on: v > 0 && rand() < v }; }
        if (echo.on) sendHit({ i, q: q + EG_ECHO_Q, d: dmg, r });
      }
      return true;
    },
    riftTargets: () => [],
    riftHit: () => false,
    batches: () => _batches,
    lights: () => _lights,
    /** The telegraphs, the zones, the tethers and the objects, in the host's world pass. Answers whether anything drew.
     *  EG-ZG (section 11.7): every shape on each fight floor it covers (world/eliteGates/egTelegraph.js egFloorPlan - THE TELEGRAPH
     *  BUDGET's 32 shape-floor draws, mine last), the camera's yaw read off the view, the marks' sigils placed over heads. */
    drawPass(proj, view, eye, seconds, fog = null) {
      if (!centre) return false;
      let drew = false;
      if (_crystals.length) {
        crystalPass = crystalsOf(true);
        if (crystalPass) { crystalPass.draw(_crystals, proj, view, eye, seconds, fog); drew = drew || crystalPass.drawn > 0; }
      }
      pass = telegraphOf(_shapes.length > 0);
      if (view) viewYaw = egViewYaw(view);
      if (proj && view) sigilsFrame(multiply(proj, view, _vp));
      egLookShapes(_shapes, egAccessNow(), stageNow);   // EG-G1/EG-G2: each shape in the shelf's palette, fill and style bit
      const plan = (lastPlan = egFloorPlan(_shapes, floors, myFeet(), floorBuf, undefined, planKeep));   // AUDIT EG V (L6-4): its slots kept
      floorBuf = plan.buf; plan.over = floor;
      if (pass) { pass.drawFloors(plan, proj, view, eye, seconds, fog, centre); drew = drew || pass.floorDraws > 0; }   // section 25.4: mine on top
      return lordFall.draw(proj, view, eye, seconds, fog) || drew;   // EG-FALL: a lord's fall - its burst and its column of embers, over the floors
    },
    /** What the driver holds (tests, stats). */
    state: () => ({ hall, bodies: drawn.size, crystals: _crystals.length, shapes: _shapes.length, targets: _targets.length, judged: judged.size, mix: mix.stats(), stung: stung.size,
      floors: floors.length, draws: lastPlan?.draws.length ?? 0, heard: mix.heard(), fires: fireBatches.size }),   // EG-ZG: the hall's fight floors, the last frame's shape-floor draws; EG-ZH: the mix's heard, the fire falls' batches
    /** EG-G2: the frame's shapes as the pass will draw them (tests): each one's look laid on. */
    shapes: () => _shapes,
    /** AUDIT EG V (lane1 #14): the title card the frame shows (tests) - a lord's wake, its phase card, its fall. */
    card: () => titleCardModel(beat, now()),
    /** EG-ZD (section 26): THE SPIRE MIX this fight holds (over the host's music) - the breach's client plays the HUD's beats
     *  on its critical bus (scenes/eliteGates/egClient.js). */
    mix: () => mix,
    /** EG-FALL (tests): the lords' falls this fight holds (scenes/eliteGates/egLordFall.js). */
    fall: () => lordFall,
    /** EG-ZG (tests): the last floor plan, the peril arrow, the ground's words, the sigils over heads. */
    plan: () => lastPlan,
    peril: () => lastPeril,
    ground: () => lastGround,
    sigils: () => _sigils,
    /** EG-ZP (section 15's Lifeline, this screen's half): a Lifeline holder's heal said for me while I stood under 30%
     *  (scenes/eliteGates/egClient.js) - its window opened on my blows at share `v`, `at` the word's arrival at the room. */
    lifeline(v, at) { if (v > 0 && Number.isFinite(at)) ll = egLifelineOpen(ll, v, at); },
    /** EG-ZP (tests): my Lifeline windows and my trail's length. */
    shield: () => ({ ll: ll.map((w) => [...w]), trail: trail.length }),
    /**
     * EG-ZR - SHIELD-HYMN, THIS SCREEN'S HALF (section 15's Accord; the census's - net/eliteGates/egBrain.js egHymnStep): Rally's heal
     * said (`at` the door's opening on the shared clock - the word's arrival less its way here) with a Bastion holder within
     * EG_ACCORD_M of another member holding Rally, where this screen stands them - me at my feet, each companion where it is
     * drawn, the living company the room counts (net/eliteGates/egVestige.js egHymnOf) - gives me those holders' Bastion for
     * EG_HYMN_MS, which egShieldDr reads with the census's own law. A door with no such pair leaves the last to lapse.
     */
    rally(at) {
      if (!Number.isFinite(at) || !centre) return;
      const hy = egHymnOf(companyHere());
      if (hy.length) hymn = [at, at + EG_HYMN_MS, hy];
    },
    /** EG-ZS - THE PAIR LAW ON THIS SCREEN (section 15's Accords; net/eliteGates/egVestige.js egAccordMates): the living companions within
     *  10 m of me holding Accord `key` with me (`as` my side of it) where this screen stands us - the screen's half of Living
     *  Wall (scenes/eliteGates/egClient.js). None before the hall stands.
     * @param {string} key @param {'a'|'b'} [as] */
    accordMates(key, as = 'a') { return centre ? egAccordMates(companyHere(), me() ?? '', key, as) : []; },
    /** EG-ZR (tests): Shield-Hymn's window on this screen, or null. */
    hymn: () => (hymn ? [hymn[0], hymn[1], [...hymn[2]]] : null),
    /** EG-ZR - IMMOVABLE'S OTHER HALF (section 15: "pushes do nothing until you move"): do I stand still EG_IMMOVABLE_MS on a
     *  fight floor now, holding it - the census's own judgment of my trail (net/eliteGates/egBrain.js egCensusDr, asked of my Mastery
     *  alone: its Immovable is the only share it can answer). */
    immovable() {
      const E = link.state(), sub = me();
      if (!spec || !sub || hall !== E.h || !trail.length) return false;
      const mast = egRunOfMember(E, sub).mast;
      if (mast !== IMMOVABLE_ID) return false;   // AUDIT EG III (lane4 #10): the census asked (its arrays made) only for Immovable's holder - the spans read this every frame
      return egCensusDr({ h: hall, mem: { [sub]: { mast } } }, null, egFightView(spec), { sub, at: now() }, [{ sub, tr: trail }]) > 0;
    },
    /** The count's words for a tracker that asks. */
    countText: (ms) => egCountText(ms),
    /** Out of the breach: everything put away - once (AUDIT EG III lane4 #2: again it is nothing). AUDIT EG V (L6-5): the
     *  telegraph and crystal passes freed with it (built again the first frame of the next breach's draw). */
    leave() {
      if (!hall && !centre && !cardUp && !groundUp && !sigilsUp && !drawn.size && !fireBatches.size && !ll.length && !trail.length && !hymn) return;   // AUDIT EG III (lane4 #2): nothing held - asked every frame out of the Spire, it touches nothing (never the Burning Court's card)
      // AUDIT EG V (L6-5; sections 11.9 and 29, EVERY ALLOCATION HAS AN OWNER): the passes' slots emptied before they are freed
      const p0 = pass, c0 = crystalPass;
      pass = null; crystalPass = null; telegraphOf = telegraphDoor(); crystalsOf = crystalDoor(); floorBuf = null;
      try { p0?.destroy(); } catch { /* gone with its context */ }
      try { c0?.destroy(); } catch { /* gone with its context */ }
      for (const d of drawn.values()) destroy(d);
      drawn.clear(); crystalSlots.clear();
      dropFire(); toldHeard.clear(); mix.peers(false);   // EG-ZH: the flames freed, the peers as they were
      lordFall.dispose();   // EG-FALL: the fallen's bodies freed; AUDIT EG-FALL (L1-6): and the spark pass with them
      if (cardUp) { drawGateTitleCard(null); cardUp = false; }   // AUDIT EG III (lane4 #2): only a card this fight drew
      if (groundUp) { drawGateGround(null); groundUp = false; }   // EG-ZG: the peril arrow's readout
      if (sigilsUp) { drawEgSigils(null); sigilsUp = false; }
      hall = 0; spec = null; centre = null; beat = null; beatNext = [];
      trail.length = 0; ll = [];   // EG-ZP
      hymn = null; mom = { i: -1, n: 0, q: -1 }; echo = { q: -1, on: false };   // EG-ZR
      _batches.length = 0; _lights.length = 0; _targets.length = 0; _crystals.length = 0; _shapes.length = 0;
      floors = []; lastPlan = null; lastPeril = null; lastGround = null; _sigils.length = 0; dusts.length = 0;
    },
  };
}
