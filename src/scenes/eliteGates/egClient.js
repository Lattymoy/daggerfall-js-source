// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 5, 6, 7, 16, 21 and 23): AN
// ELITE BREACH ON THIS SCREEN - the world host's one piece for it (scenes/world.js builds it and hands it its seams):
//   THE KEY - a Weir Key used (systems/eliteGates/weirKey.js): one staked at the account service (`/v1/eg/open` - idempotent on its
//     request id), its signed order handed to the hub (`eg` `open` - net/online.js sendEg), which opens the breach and
//     calls the company; `/breach rehearse` opens the day's Rehearsal (no key). Every answer that carries the account's
//     balance restacks the pack's keys to it.
//   THE CALL - the hub's word (`call`), said in chat and on the tracker (ui/eliteGates/egHud.js) until the breach takes no more;
//     answered with `/breach` from open ground once it opens: the member's own admission (`/v1/eg/admit`), then the step
//     under the veil into the breach's first circle (scenes/worldModes.js enterEgHall). Inside, the admission goes to the
//     room once (`in`) - a member the room already counts is never asked again.
//   THE HALLS - the breach's room's word (net/eliteGates/egLink.js): the pull to the next hall's plate (the action teleport's
//     way, under a veil's flash), the step through an open door (`down`, believed by the room from my pose), a new circle
//     built as the first was (out under the veil and in again), the fight (scenes/eliteGates/egFight.js), the void's cost.
//   ONE LIFE - a death in the breach wakes where the member answered from, its fall the room's; the end, the way home at a
//     Redoubt, and a room that closes my socket all walk me out the same way.
//   THE RECEIPTS - every `e1` the room hands me kept on the device (EG_CLAIMS_KEY) and carried to the account service
//     (`/v1/eg/claim`) until it is recorded, refused for good, or out of date.
//
//   EG-FULL (2026-10-11, Mac: "I said I want everything"): THE WITNESS VIEW (section 16.5) - a death in the Spire is a
//     fall the death save turns aside (no death screen, no respawn, no DEATH-PENALTY): the body is put away under the hall,
//     no blow reaches it, and the camera orbits a living member (Q and E to change whom); THE RECALL's word stands me
//     where it calls me at its share of my health; the room's heals (a rest, a Rally, a Mending, the fray's lash); the
//     Vestige offer and the company's word on THE PANEL (ui/eliteGates/egHud.js - keys 1-6, Y and N, or `/breach pick`, `/breach
//     vote`); Cantrips, the Sutler, pings, forsaking and a Surplus in `/breach` words; THE POTION LAW's count; THE RECAP.
//
//   EG-H1 (EG8d, 2026-10-12; sections 21 and 10.8): WHAT THE RELAY JUDGES, this screen's half - THE SHARED CLOCK CORRECTED
//     (net/eliteGates/egClock.js: the room's `clk` pinged, the median of five half round trips, again every 30 s - the breach's link,
//     its fight and every time here read it: `sharedNow`); MY BODY in my own word (`vt`, net/bossBody.js bodySayer's pace)
//     to a relay that counts it, and THE RELAY'S COUNT'S FALL OF ME (`bd`) - in the Spire a fall, never a death: the
//     witness, as the Hour's bossCountFell is its one life; RIDDEN POSES - my pose's `pl` on a moving piece (`ridePl`,
//     net/online.js `poseRide`) and a peer's drawn on its piece at my clock (`rideDraw`, net/online.js `rideAt`).
//   EG-G1 (2026-10-12, sections 27 and 25.7): THE HUD, THE BEATS AND THE FIRST BREACH - the seams that feed them: the
//     Spire's HUD by form factor and its count chip (ui/eliteGates/egSpireHud.js), the arrival card, the door's marker, the beats'
//     sounds and lines and the first-time lines (ui/eliteGates/egBeats.js), the party rows (ui/eliteGates/egParty.js - the party panel's
//     `setSpire`), the pad's d-pad and the touch buttons for the panel and the witness, the haptics, the danger palette
//     and reduced motion (ui/eliteGates/egAccess.js), and THE RECAP whole (the last five kept).
//   EG-ZE (2026-10-12, Mac: "I said I want everything"; sections 7, 16.2, 16.4, 16.5, 27.3 and 27.5): THE STAIR, THE DOOR
//     AND THE LIGHTS - every step down drawn as THE STAIR (world/eliteGates/egLights.js egStairStep: the full fall into a band's
//     first hall, the band's veil at every other step and pull, a plain cut under reduced motion - the veil's own themes,
//     ui/gate/gateVeil.js), never slower than the veil it replaced; the door's beam, the closing's ring and its mark on the
//     enhanced compass (the arch's gold slot - the arch never stands in the Spire); the Redoubt's beacon, the recall's
//     blue pillar and the pings drawn (render/eliteGates/egLightPass.js through the look) and each ping's chime; the witness's sight
//     (the dormant Lurkers, the alcoves, the next hall's twist said) and a witness's ping at the member it watches.
//   EG-F (2026-10-12, Mac: "I said I want everything"; sections 5, 6.3 and 6.4): THE ARCH AND THE CALL - the key's
//     refusals in the page's order (scenes/eliteGates/egArch.js egKeyRefusal, over the host's facts), THE START WINDOW before any key
//     is staked (ui/eliteGates/egStartWindow.js - the preflight `/v1/eg/starts`, its choice and Wager carried by the open), THE ARCH
//     (scenes/eliteGates/egArch.js, the host's pool: the company's from the call, a stranger's from the cell - each fed here), THE
//     CALL's horn, its one line and its prompt (scenes/eliteGates/egCall.js), the answer's portal at my feet - stepping into it is the
//     admission - and the opener's step through the arch; the opener's landing before the arch; the late line.
//   EG-ZD (2026-10-12, Mac: "I said I want everything"; sections 22, 16.5, 10.8, 26 and 27.8): BACK INTO THE SPIRE, AND THE
//     FALL - THE WAY BACK (section 22, slice EG10): the breach I stood in kept on the device (EG_BACK_KEY - its seed, its
//     hall, whether the room counted me, my last island); once the account service's keys answer says it is still live
//     (`live`), *Return to the Spire* is offered (the call's strip, `/breach`, the key's use) - never refused as late, a
//     hello as an entrant (no new order: the room re-admits a counted member - net/eliteGates/egBrain.js egAdmitWord) - and I arrive
//     in the circle the company holds (a circle or a seed my record had wrong rebuilt in place, EG-H3's swap), resumed at
//     my last island in a trial and at the hall's arrival plate between trials. THE FALL (section 16.5): the camera sinks,
//     the colour drains, the FALLEN card and *Reliquaries lost*, then the witness view dithers in (ui/eliteGates/egSpireHud.js
//     egFallModel - reduced motion cuts). THE SPANS' CLOCK (section 10.8): the corrected shared clock as the host's
//     anchored seconds (`spanSeconds`) and its milliseconds (`breachNow`) while I stand in the breach. THE BEATS ON THE
//     CRITICAL BUS (section 26): every HUD beat's sound through THE SPIRE MIX (the fight's, over the host's music -
//     systems/eliteGates/egMix.js `beat`). THE PAD reaches the Surplus's two buttons after the cards (section 27.8).
//   EG-ZA (2026-10-12, Mac: "I said I want everything"; sections 22 and 23, "A key's loss"): A KEY IS NEVER LOST, this
//     screen's half - the stake an open took kept on the device (EG_STAKES_KEY) until a call or a receipt answers it, and
//     past EG_VOID_WAIT_MS with neither its void asked of the hub (`void`, again every EG_VOID_ASK_MS, across reloads); a
//     receipt the hub holds for me heard at my hello like any other; and each receipt the service has counted said to the
//     hub (`claimed`), which forgets its copy.
//   EG-ZF (2026-10-12, Mac: "I said I want everything"; sections 27.6 and 27.7): THE RECAP WHOLE AND THE ACCOUNT'S MEMORY -
//     THE DAMAGE CHART at a lord's fall (the gate's own, ui/gate/gateDamageChart.js, off the room's `dm`), what my companions'
//     spells healed in me said to the room (`heal`, for the chart's Healed column and each member's healing), the board's
//     line from my end's claim on the recap, and the first-time lines once an account (the service's bits over the device's).
//   EG-ZH (2026-10-12, sections 11.7-11.9, 27.8): THE HALL'S REVERB (systems/eliteGates/egReverb.js - held while I stand in the breach
//     and through a swap or a pull under way, the hall my feet stand in heard in its fragments' space, crossfaded at a
//     mouth, let go on every way out); THE FRAGMENT'S OWN CLAMP on my motor while I stand in one (world/eliteGates/egHall.js
//     egFragArena - `player.arena`, set where no other arena holds me); the cameras eased back out of the rock
//     (player/mwView.js setSpireCamera) and the touch layer's Spire branch (ui/touch/touch.js setTouchSpire), both told here.
//   EG-ZI (2026-10-12, Mac: "I said I want everything"; section 10.6): THE PULL'S TOLL - the room's `toll` paid beside the
//     void's cost (payToll: its quarters' share of my health through the hurt door, never the last of it) and said with the
//     pull, its share on the screen and its line in the chat.

//   EG-ZM (2026-10-12, section 22 - the EG-ZD departure it retires): THE RETURN'S SEED - a way back the device knows only
//     from the account service's word (no seed, no opening, no hall) holds its step under the veil until the room's first
//     word: a listener on my own identity (egSeedListen - no presence, no pose) says hello to the breach's room, and its
//     `st` is the circle built, never circle 1 of seed 0. A room that refuses the hello lets the way back go in its words;
//     no word within EG_BACK_SEED_WAIT_MS opens the veil on open ground and says so.

//   EG-ZN (2026-10-12, Mac: "I said I want everything"; sections 11.8 and 29): THE SHAFT'S CAMERA told - the way down a
//     shaft's ledge my feet stand on faces (world/eliteGates/egHall.js egShaftLedgeAt) and whether the screen stands still
//     (player/mwView.js setSpireShaft, which biases the pitch and lifts the camera there); and THE BAND TEXTURES' OWNER - the
//     mode machine's band dress let go at the breach's end (its egBandsDown), on the first frame out of the Spire that is no
//     swap's or answer's step under way: the way home, the tear, the last fall, forsaking, a void, a refused or lost socket,
//     and any other way out alike.

//   EG-ZP (2026-10-12, sections 15 and 21): LIFELINE, THE RECEIVER'S HALF - my heal word said with a Lifeline holder's heal
//     in it while I stood under 30% within the census's look back (`lowAt` - my body at a frame, or before the heal that
//     lifted me) opens that holder's window on my blows in the fight (scenes/eliteGates/egFight.js egLifelineOpen), at the word's
//     arrival at the room as my corrected clock reckons it: the census's own window (net/eliteGates/egBrain.js egHeal), so my body and
//     the room's count take the same blow.

//   EG-ZR (2026-10-12, section 15): THE VESTIGES ON THEIR HOLDER - my run's Vestiges handed to the holder's doors every frame
//     I stand alive in the breach, and taken back on every way out (systems/eliteGates/spireVestiges.js spireHolderStep); Featherstep's
//     cast-back cost, the census's own (net/eliteGates/egBrain.js egCastBackCost), said as it is; the room's shares of my body (the
//     void's, the toll's, the lash's) of the body without Stoneskin's cushion (systems/renownLayer.js spireBodyMax);
//     Immovable's push half (a push does nothing while the fight's `immovable` holds); SHIELD-HYMN's word (Rally's heal) to
//     the fight at the door's opening; and MENDER'S GRACE, the receiver's half (menderGrace - a caster's heal on me more).
//   EG-ZS (2026-10-12, section 15's resonance and Accords; EG-ZR's "Not built"): ROOTED's immunity to push (the whole push off
//     while I resonate in Stone, as Immovable's); RALLYING CRY handed to the holder (the door's instant and whether a living
//     member resonates in Fellowship - systems/eliteGates/spireVestiges.js refreshes my Second Wind); and LIVING WALL, the screen's half
//     (a heal on me, the room's or a companion's, its share more while I hold Stoneskin within 10 m of a companion holding
//     Mender's Grace where my screen draws them - scenes/eliteGates/egFight.js accordMates; the census counts the room's the same).
//   AUDIT EG III (2026-10-13, the client group): THE WITNESS never cast back, its eye critically damped (0.35 s) and kept
//     out of the rock (egWitnessDamp, egWitnessClear - section 16.5), applied in the dungeon arm through the world host's
//     `egWitnessEye`; THE LAW PIN's rebuild counted done once its step has run, and no worker's build under another law;
//     the look on the level standing; the swap's worker let go every way out; the refusal's one type; a receipt heard
//     mid-flush carried as the flush ends; the frame's lists kept; the key said while the start window asks; A SPIRE TONIC
//     drunk (`/breach tonic`, its magicka on this screen) and LONG STEP on my crumbles for one span (section 17).
//
//   AUDIT EG III (2026-10-13, lane 1 #7 / lane 3 #10; section 15): SPIREBRIDGE ASKED - while I hold it, alive in a trial or
//     its closing, unspent this span, with a gap ahead of my feet (net/eliteGates/egSpanLaw.js egBridgeAhead - the room's own law), the
//     ask is offered on the stage's line, the touch layer's button and the pad's up, and taken by B or `/breach bridge`
//     (`mast`); the room's word (`ebridge`) said on every screen, and its plank handed to the spans (`objs`' `br`).
//   AUDIT EG IV (2026-10-13, the net group; sections 5, 22 and 23): AN OPEN'S LOST ANSWER - the open's request id kept on
//     the device before it is asked (EG_OPENS_KEY) and asked again by it (`again`) until the service says, the stake it took
//     kept for its void; THE RECEIPTS COUNTED remembered (EG_COUNTED_KEY) and never claimed again, a re-claim's Marks never
//     handed on; THE BALANCE in its asks' order, and *The key turns to rust.* said; the answer's refusals asked again when
//     the admission lands, and a step under way refusing the call's in silence.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { createEgLink, egMemberOf, egRunOfMember, egCountAt } from '../../net/eliteGates/egLink.js';
import { egKeyRefusal } from './egArch.js';   // EG-F: the key's refusals, in the page's order
import { egCallPromptModel, soundEgHorn, EG_CALL_KEYS } from './egCall.js';   // EG-F: the call's prompt and horn
import { importPublicKeyB64, ORDER_TTL_S } from '../../net/identityToken.js';   // EG-F: the relay's public half, for a stranger's arch; AUDIT EG V: an order's life
import { egHallOf, egCircleOfHall, egSlotOfHall, egSlotAt, egLocalX, egAtDoor, egPhase, egTimes, egCountText, egBandOfCircle, EG_TEXT, EG_CAST_BACK_LOSS, EG_CAST_BACK_FLOOR, EG_BAND_LORDS, EG_VALKYNAZ } from '../../net/eliteGates/egLaw.js';
import { egOnFight, egSpecGive, egSpecDigest, egSpecForget, EG_SPEC } from '../../net/eliteGates/egLaw.js';   // EG-H2 (section 10.7): the fight floor, and off it the Spire's traversal ground; (section 22) a hall given, the law I draw
import { EG_TOLL_STEP } from '../../net/eliteGates/egLaw.js';   // EG-ZI (section 10.6): the pull's toll, a quarter's share
import { readEgReceipt } from '../../net/eliteGates/egReceipt.js';
import { EG_VOID_MAX_S } from '../../net/eliteGates/egDurable.js';   // EG-ZA: how long a stake's void may be asked
import { egRcId } from '../../net/eliteGates/egDurable.js';   // AUDIT EG IV (lane3 #2): a receipt's identity, for the counted ones
import { dungeonToRealm } from '../../net/superDungeon/sdBrain.js';
import { egToDungeon } from '../../world/eliteGates/egHall.js';
import { restackWeirKeys, setWeirKeyOpener, weirKeysHeld } from '../../systems/eliteGates/weirKey.js';   // AUDIT EG IV (lane3 #10): the keys the pack shows, for the rust's line
import { egHudModel, drawEgHud, egPanelModel, drawEgPanel, egRecapModel, EG_POTIONS_PER_HALL } from '../../ui/eliteGates/egHud.js';
import { EG_CANTRIPS } from '../../net/eliteGates/egRun.js';
import { egVOf } from '../../net/eliteGates/egVestige.js';
import { egResonance, EG_WALL_X } from '../../net/eliteGates/egVestige.js';   // EG-ZS: Rooted's and Rallying Cry's resonance; Living Wall's share
import { EG_SPIREBRIDGE_ID } from '../../net/eliteGates/egVestige.js';   // AUDIT EG III (section 15): Spirebridge, the Fellowship's Mastery
import { egBridgeAhead } from '../../net/eliteGates/egSpanLaw.js';   // AUDIT EG III: the gap ahead, the room's own law
import { fillVitalSigns, maxFatigue } from '../../systems/statMods.js';   // AUDIT EG V (c, L2-9): and a rest's share of fatigue
import { createPortalSet } from '../portalFx.js';
import { EG_ROLE } from '../../net/eliteGates/egBodies.js';
import { EG_OBJ } from '../../net/eliteGates/egLords.js';
import { EG_ANNALS } from '../../net/eliteGates/egAnnals.js';
import { EG_ENGINES, EG_ENGINE_REACH_M } from '../../net/eliteGates/egFragLaw.js';
import { EG_STONE_REACH_M } from '../../systems/eliteGates/spireOrrery.js';   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): the room's reach for a turn
import { SD_HALL_TEXT } from '../superDungeon/sdHall.js';   // ORRERY-SIGHT: "Stand closer to the stone.", the Hour's own
import { egClockNew, egClockDue, egClockHeard, egClockOffset, egClockHalfRtt } from '../../net/eliteGates/egClock.js';   // EG-H1: the shared clock, corrected
import { bodySayer } from '../../net/bossBody.js';   // EG-H1: my body, in my own word
import { egRideOf, egRideAt } from '../../net/eliteGates/egFair.js';   // EG-H1: RIDDEN POSES
import { EG_SWAP_WAIT_MS } from './egSwap.js';   // EG-H3 (EG10): how long a new circle's step waits on its build
// EG-G1: THE HUD, THE BEATS AND THE FIRST BREACH (bible/11-Multiplayer/Elite-Gates.md section 27)
import { egSpireHudModel, drawEgSpireHud, egArrivalCard, egArrivalLive, egArrivalShown, drawEgArrivalCard, egFormFactor, egGainText, egPressInForce, egChipWarnings, egDoorMarker, egPadUp, egPadAct, egPadPrompts, EG_PAD_DIRS, EG_GAIN_MS, EG_CHIP_WARNINGS } from '../../ui/eliteGates/egSpireHud.js';
import { egBeatMemo, egBeatWatch, egBeatPlan, egFirstDue, egRehearsalDue, egFirstRead, egFirstWrite, egBuzz, egBeatUnder, egPerilsNew, egRuneChime, EG_PRES_TEXT, EG_BEAT_SOUNDS } from '../../ui/eliteGates/egBeats.js';
import { egAbsentStep, egPartyRows, egPartyDeco, egRoadOf, EG_NUMERALS } from '../../ui/eliteGates/egParty.js';
import { egAccessNow, egAllyLookSet } from '../../ui/eliteGates/egAccess.js';
import { egRecapKeep, egAskText } from '../../ui/eliteGates/egHud.js';
import { EG_LORDS, EG_LAST_WORD_MS } from '../../net/eliteGates/egLaw.js';
import { isEnhanced } from '../../systems/uiSkin.js';
import { isTouchDevice } from '../../ui/touch/touchDevice.js';
import { getPref } from '../../systems/uiPrefs.js';
import { noteAct } from '../../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests
import { egValkRedoubt } from '../../net/eliteGates/egPay.js';   // QL11: a Valkynaz's Redoubt - the one law the service pays a `w` receipt by
import { createEgLookDraw } from './egLookDraw.js';   // EG-G2: the Spire's sky, mist and lines (section 25)
import { egQuietCompany } from '../../world/eliteGates/egLook.js';
import { egRibbonPush, egTrailSegs, EG_TRAIL } from '../../world/eliteGates/egLook.js';   // AUDIT EG V (h; section 8.2): THE TRAIL
import { CONCEAL_MODE } from '../../systems/combatVisuals.js';   // AUDIT EG V (h; section 8.2): an ally on traversal ground, ECV1's plain blend
import { egStairStep, egSpireLights, egDoorCompass, egWitnessTwist, EG_LIGHTS_TEXT } from '../../world/eliteGates/egLights.js';   // EG-ZE: the stair, the door and the lights
import { egReducedMotion } from '../../ui/eliteGates/egAccess.js';
import { egStartHall, egFirstHallOf } from '../../net/eliteGates/egLaw.js';
// EG-ZD: THE WAY BACK, THE FALL, THE SPANS' CLOCK, THE BEATS ON THE CRITICAL BUS
import { egFallModel, drawEgFall, EG_FALL_MS, EG_FALL_TEXT } from '../../ui/eliteGates/egSpireHud.js';
import { EG_DOWN_MS } from '../../net/eliteGates/egBrain.js';   // AUDIT WORLD-EVENTS L1-4: the room's window for a raise
import { egPingWait } from '../../ui/eliteGates/egSpireHud.js';   // AUDIT EG V (c, L7-7): a ping inside its cooldown, said
import { egSupportAt, EG_HOLD } from '../../net/eliteGates/egFair.js';
import { egFightFloorAt } from '../../net/eliteGates/egFair.js';   // AUDIT EG V (h): traversal ground is no fight floor
import { anchoredClock } from '../../render/deadlands.js';
import { createSpireMix } from '../../systems/eliteGates/egMix.js';
// EG-ZF (sections 27.6 and 27.7): the lord's fall's chart, the board's line, the heal word's bounds, the first bits over an account
import { damageChartModel, drawGateDamageChart, DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_MS } from '../../ui/gate/gateDamageChart.js';
import { egChartFell, egBoardLine, egRecapBoardKeep } from '../../ui/eliteGates/egHud.js';
import { egFirstOver } from '../../ui/eliteGates/egBeats.js';
import { GATE_HEAL_ROWS_MAX, GATE_HEAL_WIRE_MAX } from '../../net/wire.js';
import { createEgReverb } from '../../systems/eliteGates/egReverb.js';   // EG-ZH (section 11.9): the hall's reverb
import { createEgAir } from './egAir.js';   // EG-ROAR (section 26): the Spire's air
import { egFragArena } from '../../world/eliteGates/egHall.js';   // EG-ZH (sections 11.7-11.8): the fragment's own clamp
import { setSpireCamera } from '../../player/mwView.js';   // EG-ZH (section 11.8): the camera in rock
import { setTouchSpire } from '../../ui/touch/touch.js';   // EG-ZH (section 27.8): touch on the spans
// EG-ZM (section 22): the room's first word heard under the veil - a listener session on my own identity, its fold
import { OnlineSession, TOKEN_WAIT_MS } from '../../net/online.js';
import { foldEg, EG_STATE_EMPTY } from '../../net/eliteGates/egLink.js';
import { egRoomKey } from '../../net/eliteGates/egLaw.js';
import { egShaftLedgeAt } from '../../world/eliteGates/egHall.js';   // EG-ZN (section 11.8): the shaft's ledge the camera leans over
import { setSpireShaft } from '../../player/mwView.js';   // EG-ZN (section 11.8): the shaft's camera
import { EG_LIFELINE_UNDER, EG_LIFELINE_LOOK_MS } from '../../net/eliteGates/egBrain.js';
import { egLifelineMin } from '../../net/eliteGates/egBrain.js';   // AUDIT EG III: a heal worth a Lifeline window, the census's own   // EG-ZP (section 15): Lifeline's 30%, and how far back the census looks for it
import { egCastBackCost } from '../../net/eliteGates/egBrain.js';   // EG-ZR (section 15's Featherstep): a cast-back's cost, the census's own
import { spireHolderStep } from '../../systems/eliteGates/spireVestiges.js';   // EG-ZR: THE VESTIGES ON THEIR HOLDER
import { spireRallyingCry } from '../../systems/eliteGates/spireVestiges.js';   // AUDIT EG IV (lane10 #14): Rallying Cry at a Court's phase turn
import { spireBodyMax } from '../../systems/renownLayer.js';   // EG-ZR: the body the room's shares are of (Stoneskin's cushion over it)
import { healMine } from '../../systems/playerHeal.js';   // EG-ZR: Mender's Grace's heal, the one heal a power gives
import { spireVestigeNews, spireWeaveReady } from '../../systems/eliteGates/spireVestiges.js';   // AUDIT EG III (section 27.5): the holder's news, said; Spellweave's chip
import { egHolderNow, egHolderWatch, egHolderMemo } from '../../ui/eliteGates/egBeats.js';   // AUDIT EG III: the holder's chips and the beats they bring
import { CAMERA_OBSTACLE_LIMIT, MW_UNITS_PER_METER } from '../../player/mwCamera.js';   // AUDIT EG III (lane6 #1): the witness's orbit collides as the Morrowind body's camera does
import { EG_CRUMBLE_KINDS } from '../../net/eliteGates/egSpanLaw.js';   // AUDIT EG III (lane1 #5): the steps Long Step's span is a span of
import { t } from '../../systems/textManager.js';   // AUDIT EG V (c): the words this audit adds, in the player's language
import { REFUSALS, accountRefusalText } from '../../net/accountClient.js';   // AUDIT EG V (c, L7-11): the catalog's refusals, never a second copy
import { EG_PING_MS } from '../../net/eliteGates/egBrain.js';   // AUDIT EG V (c, L7-7): a ping's cooldown, the room's own
import { egFirstKey } from '../../ui/eliteGates/egBeats.js';   // AUDIT EG V (c, L7-23): the device's first-time bits, an account's own

/** Where the receipts wait on the device, how many at most, how often a kept one is asked again (ms). */
export const EG_CLAIMS_KEY = 'eg.claims';
export const EG_CLAIMS_MAX = 16;
export const EG_CLAIM_RETRY_MS = 60_000;
/** EG-ZA: where a stake no call has answered waits on the device (`{ b, z, at }` - its breach, its open's signed order,
 *  the second it was staked), the most kept, how long after its stake a void is first asked (the hub's own tries of the
 *  room's open and void are done by then - net/eliteGates/egDurable.js EG_OPEN_HUB_TRIES at ROOM_CALL_MS each) and how often again
 *  (ms); one is kept EG_VOID_MAX_S at most (the room refuses an older void). */
export const EG_STAKES_KEY = 'eg.stakes';
export const EG_STAKES_MAX = 4;
export const EG_VOID_WAIT_MS = 60_000;
export const EG_VOID_ASK_MS = 60_000;
/** EG-ZA: how often the frame looks at the kept stakes at most (ms) - never a parse of the device's store every frame. */
export const EG_STAKE_LOOK_MS = 5000;
/** AUDIT EG IV (lane3 #1; sections 22 and 23, "A key's loss"): where an open's ask is kept on the device BEFORE it goes
 *  (`{ rq, s, at }` - its request id, the account, the second it was asked), so an answer lost (the wait's end, a dropped
 *  connection, a reload mid-ask) is asked again by that id (`again` - the service never takes a key for it) until the
 *  service says: the stake it took, kept as a stake no call answered (its void asked - the key back), none, or settled.
 *  The most kept, how often one is asked again (ms), how long `none` is doubted after the ask (s - the first may still be
 *  landing), and the refusals that are no answer (the ask may have landed). */
export const EG_OPENS_KEY = 'eg.opens';
export const EG_OPENS_MAX = 4;
export const EG_OPEN_AGAIN_MS = 30_000;
export const EG_OPEN_SURE_S = 120;
export const EG_OPEN_LOST = Object.freeze(['offline', 'server']);
/** AUDIT EG IV (lane3 #2): where the receipts the service has counted are remembered on the device (`{ id, s, e }` -
 *  net/eliteGates/egDurable.js egRcId, the account, the receipt's own end), the most kept: one handed again (the hub's held copy,
 *  before its `claimed` landed) is never claimed again - its `claimed` is said again instead. */
export const EG_COUNTED_KEY = 'eg.counted';
export const EG_COUNTED_MAX = 64;
/** EG-ZA: a stake handed back (its void claimed) - the words. */
export const EG_VOID_TEXT = 'The Spire did not open. Your key is returned.';
/** AUDIT EG V (lane4 L4-3; sections 6.1 and 23): an admit order lives ORDER_TTL_S from its signing, so one kept past this
 *  long (ms - half its life: the portal's PORTAL_OPEN_MS and a slow step under the veil still to come) is asked of the
 *  service again before it goes to the room; and the most asks my hall makes for one breach (a refused order, a stale one). */
export const EG_ADMIT_FRESH_MS = (ORDER_TTL_S / 2) * 1000;
export const EG_ADMIT_ASKS = 3;
/** How often a step through the door is said again while I stand in it, how long the end's words stand before the walk
 *  out, how often the balance is asked while online, how often a hub that has not taken an open is asked again. */
export const EG_DOWN_EVERY_MS = 1000;
export const EG_END_WALK_MS = 4000;
export const EG_KEYS_EVERY_MS = 10 * 60_000;
export const EG_OPEN_RETRY_MS = 2500;
export const EG_OPEN_TRIES = 4;
/** EG-H1: THE RELAY'S COUNT HAS FALLEN ME (`bd`) - its words in the Spire (the gate's and the Hour's say the fight's). */
export const EG_COUNT_FELL_TEXT = 'The Spire counts you fallen.';
/** A second press of the way home within this long walks (ms). */
export const EG_HOME_CONFIRM_MS = 6000;
/** EG-ZF: what my companions healed in me goes to the room at most this often (ms - the gate court's HEAL_SEND_MS). */
export const EG_HEAL_SEND_MS = 1000;
/** EG-ZF: the breaches whose board's line this screen holds for a recap still to be made. */
const EG_RECAPS_BOARDS = 8;
/** AUDIT EG V (c, L2-14; section 17.4): where THE POTION LAW's count is kept on the device - `{ k, n }`, its breach, hall and
 *  stage (`b:h:t` a trial's, `b:h:r` a rest's) and the potions left there. */
export const EG_POTIONS_KEY = 'eg.potions';
/** AUDIT EG V (c, L7-8; section 27.6): where THE RECAP's log is kept on the device - `{ b, l, f }`, its breach, its halls
 *  (`[h, falls]`) and each member's falls counted into them. */
export const EG_LOG_KEY = 'eg.log';
/** The most halls the log keeps (forty circles). */
export const EG_LOG_MAX = 200;
/** EG-H2 (section 22, THE LAW PIN): how often a hall of the breach's own law is asked again while unanswered (ms), and
 *  what a member whose law is not the breach's is told, once a breach. */
export const EG_SPEC_ASK_MS = 3000;
export const EG_LAW_TEXT = 'The Spire sends you this breach\'s halls.';
/** EG-ZD (section 22): THE WAY BACK - where the device keeps the breach I stood in, how often my last island is written
 *  there at most (ms), and its words. */
export const EG_BACK_KEY = 'eg.back';
export const EG_BACK_WRITE_MS = 1000;
export const EG_BACK_TEXT = Object.freeze({
  offer: 'Your breach still stands. Return to the Spire from the prompt.',   // AUDIT EG V (c, L7-20): the prompt answers by Enter, the pad's A, a tap - or `/breach`
  prompt: 'Your breach still stands - return to the Spire',
  button: 'Return',
  back: 'You return to the Spire.',
  silent: 'The Spire does not answer. Try the return again.',   // EG-ZM: no word from the room under the veil (AUDIT EG III: in no one input's words)
  spire: 'The Spire',   // AUDIT EG III: the stair's label for a way back that knows no hall
});
/** EG-ZM (section 22): how long a way back that knows no seed holds its step under the veil for the room's first word
 *  (ms) - the listener's own wait for its token (net/online.js TOKEN_WAIT_MS, past which its hello goes without one and is
 *  refused), and four seconds for the socket, the hello and the room's answer. */
export const EG_BACK_SEED_WAIT_MS = TOKEN_WAIT_MS + 4000;
/** Whether a closed socket's word is the breach room's own refusal of me (net/wire.js EG_NO_WORDS - the order, the
 *  company, the fallen, home, a breach closed), as against the relay's or the socket's - and that word as a sentence. */
const roomRefused = (w) => typeof w === 'string' && /breach|order|fallen|home|company/i.test(w);
const sentenceOf = (w) => `${w.charAt(0).toUpperCase()}${w.slice(1).replace(/\.$/, '')}.`;
/**
 * EG-ZM (section 22): THE ROOM'S FIRST WORD, HEARD UNDER THE VEIL - a listener on my primary session's own identity
 * (`main`: its url, id, secret, name, look and token minter - net/caravanVisitLink.js's way), joined to breach `b`'s room
 * with no presence: no pose, so it stands no body in the breach and sends nothing but its hello and its heartbeat. The room answers that hello with the breach's state (`st` - server/src/index.js _egHello) or refuses it in
 * words (net/eliteGates/egBrain.js egAdmitWord). `frame(nowMs)` answers null while it waits, then once: `{ st }` (the room's state,
 * folded as the link folds it - net/eliteGates/egLink.js foldEg), `{ no }` (the session's terminal word: the room's refusal, or the
 * relay's), or `{ silent: true }` (no word by `at + waitMs`) - and the listener is left at its answer, before the circle is
 * built and my own session says hello there (the relay keeps one socket an account in a breach's room). `close()` leaves
 * it, once.
 * @param {{ main: any, b: string, at: number, Session?: any, waitMs?: number }} o
 */
export function egSeedListen({ main, b, at, Session = OnlineSession, waitMs = EG_BACK_SEED_WAIT_MS }) {
  const room = egRoomKey(b);
  let st = null, done = false;
  const link = new Session({ url: main.url, id: main.id, secret: main.secret, name: main.name, look: main.look, mintToken: main.mintToken, presence: false });
  link.onEg = (w, r) => { if (r === room && w?.k === 'st' && w.b === b) st ??= foldEg(EG_STATE_EMPTY, w, at); };
  link.join(room, null);
  const close = () => { if (done) return; done = true; link.onEg = null; link.leave(); };
  return {
    frame(nowMs) {
      if (done) return null;
      link.tick();
      const a = st ? { st } : link.terminal ? { no: String(link.error ?? '') } : nowMs - at >= waitMs ? { silent: true } : null;
      if (a) close();
      return a;
    },
    close,
  };
}
/** EG-ZD (section 10.8): the spans' anchored seconds are taken again when the corrected offset moves more than this (ms) -
 *  a burst's median that wanders a millisecond never steps a platform. */
export const EG_SPAN_REANCHOR_MS = 5;
/**
 * EG-ZD: a way back read off the device, or null when it is none (pure): `{ b, seed, op, geo, ew, rh, h, in, li, wf }` -
 * the breach (16 hex), its seed, its opening, its geometry, its start, a Rehearsal, the hall last stood in, whether the
 * room counted me (`in`), my last island (`[h, x, y, z]`, the hall's frame) and the falls whose screen I have seen. A
 * breach marked over (`{ b, x: 1 }`) is none.
 */
export function egBackOf(v) {
  let r = v;
  if (typeof v === 'string') { try { r = JSON.parse(v); } catch { return null; } }
  if (!r || typeof r !== 'object' || typeof r.b !== 'string' || !/^[0-9a-f]{16}$/.test(r.b) || r.x === 1) return null;   // `x` a breach over for me
  const n = (x) => (Number.isSafeInteger(x) && x >= 0 ? x : 0);
  const li = Array.isArray(r.li) && r.li.length === 4 && Number.isSafeInteger(r.li[0]) && r.li[0] > 0 && r.li.slice(1).every(Number.isFinite) ? r.li.slice(0, 4) : null;
  return { b: r.b, seed: n(r.seed) >>> 0, op: Number.isFinite(r.op) ? r.op : 0, geo: n(r.geo), ew: n(r.ew), rh: r.rh === 1 ? 1 : 0, h: n(r.h), in: r.in === 1 ? 1 : 0, li, wf: n(r.wf) };
}
/** AUDIT EG V (c, L2-9; section 16.3): A REST THAT HEALS LESS THAN WHOLE gives magicka and fatigue back by its share `p` too
 *  (Ashen Vigil's half, its rank II's quarter, the Hungering Dark's half): each its share of its whole more, never past it.
 *  In place on `entity`. */
export function egRestVitals(entity, p) {
  if (!entity || !(p > 0)) return;
  if (entity.maxMagicka > 0) entity.magicka = Math.min(entity.maxMagicka, (entity.magicka ?? 0) + Math.round(p * entity.maxMagicka));
  const fm = maxFatigue(entity);
  if (fm > 0) entity.fatigue = Math.min(fm, (entity.fatigue ?? 0) + Math.round(p * fm));
}
/** The end's words, by why it ended. */
export const EG_END_TEXT = Object.freeze({
  fall: EG_TEXT.fallen, home: 'You walk home. The Redoubts you took are kept.', tear: EG_TEXT.torn,
  wipe: 'The company has fallen. The breach closes.', last: EG_PRES_TEXT.lastWord,   // EG-G1: the beats' own words (section 27.5)
  empty: 'Nobody answered the call. The breach closes.', gone: 'Nobody stayed. The breach closes.',
  rehearsal: EG_TEXT.rehearsalDone, void: 'The breach failed to hold. Your key is returned.', forsake: 'You forsake the breach.',
  seal: 'The way down is sealed. The halls are yours.',
});
/** EG-F: no arch's clearing (one empty list, so the host's memo of the clearing set holds). */
const NO_CLEARS = Object.freeze([]);
/** AUDIT EG III (lane4 #12): the key turned while the start window still asks (or its preflight is out). */
export const EG_START_ASKING_TEXT = 'The start window is already open.';
/** AUDIT EG V (c, L7-21): THE WORDS `/breach` takes, said whole - in the breach, and outside it (`/breach help` too). */
export const egBreachUsage = () => t('eg.cmd.inside', 'In the breach: /breach pick N, vote yes|no|N, respite [no], cant N, tonic, buy cant|tonic|shard, surplus [reroll], use, bridge, annals [N], ping [danger|mine|cache], watch, bequest N, forsake, home, board.');
export const egBreachUsageOut = () => t('eg.cmd.outside', 'Outside the breach: /breach answers your company\'s call, or opens the start window; /breach rehearse, /breach board, /breach annals [N].');
/** AUDIT EG V (c, L7-2): the company's word with nothing open; a yes or a no while only the respite asks - its word is its own. */
const NO_CHOICE_TEXT = 'No choice is open.';
/** AUDIT EG V (c, L7-3): the yes-or-no choices (their options No and Yes - net/egHud.js egAskText), which the pad's down
 *  answers no. */
const YES_NO_ASKS = Object.freeze(['ready', 'respite', 'bargain']);
/** AUDIT EG V (c, L7-7; section 16.5 - "cycle with Q and E, the pad's shoulders"): the classic skin's pad's shoulders,
 *  LB and RB (systems/inputActions.js DEFAULT_SECONDARY_BINDINGS) - a witness has no body to crouch or jump. */
export const EG_PAD_SHOULDERS = Object.freeze({ JoystickButton4: -1, JoystickButton5: 1 });
export const egRespiteHow = () => t('eg.vote.respiteHow', 'Answer a respite with R or /breach respite.');
export const egRespiteNone = () => t('eg.vote.respiteNone', 'Nobody has asked for a respite.');
/** No call of mine stands (a host with no start window). */
const NO_CALL_TEXT = 'No breach is calling you. A Weir Key opens one, and /breach rehearse opens the day\'s Rehearsal.';
/** AUDIT EG III (lane1 #5): A SPIRE TONIC's refusals on this screen (`/breach tonic` - section 17.1). */
export const EG_TONIC_TEXT = Object.freeze({ none: 'You hold no Spire Tonic.', fallen: 'The fallen drink nothing.' });
/** A gift's words (`egot`). */
/** EG-FULL LAYER THREE: the relay's object types by number (net/eliteGates/egLords.js EG_OBJ) - the spans read Grath's islands and
 *  the false walls by name (systems/eliteGates/spireKit.js spireObjs). */
const OBJ_NAME = Object.freeze(Object.fromEntries(Object.entries(EG_OBJ).map(([k, v]) => [v, k])));
export const EG_GOT_TEXT = Object.freeze({ shard: 'You take a Vestige shard.', tonic: 'You take a Spire Tonic.', cant: 'You take a Cantrip.', lumen: 'You take 10 lumen.', rel: 'A Reliquary is sealed for you.', longstep: 'Long Step: crumbling ground holds half a second longer this span.' });
/** FIELD BUGS 2026-10-20f DOOR-WORD: why the door will not take me (`efair` - net/eliteGates/egBrain.js doorWord): a break of the
 *  Spire's law since my last island (net/eliteGates/egFair.js - its reason), or a crossing it saw too little of. A break clears on
 *  the last island stood on; a crossing seen too little is seen whole as I stand at the door (egStillGap). */
export const EG_FAIR_TEXT = Object.freeze({
  blind: () => t('eg.fair.blind', 'The Spire lost sight of part of your crossing. Stay at the door - it opens for you once the Spire has seen you there.'),
  speed: () => t('eg.fair.speed', 'You crossed faster than the Spire allows. Go back to the last island you stood on and cross again.'),
  air: () => t('eg.fair.air', 'You stayed in the air longer than the Spire allows. Go back to the last island you stood on and cross again.'),
  void: () => t('eg.fair.void', 'You fell into the void. Go back to the last island you stood on and cross again.'),
});
/** A hall's glyph on THE RECAP's strip. */
const KIND_GLYPH = Object.freeze({ yard: 'Y', span: 'S', proving: 'P', rampart: 'R', court: 'C', athenaeum: 'A', deepway: 'D', brink: 'B', scriptorium: 's' });
/** A push's pace (the Steps' breath's, sdSteps.js SD_GUST_SPEED), the longest frame it is carried for (s), the most one
 *  push carries (m); a ring's rim kept this far in or out (m). */
export const EG_PUSH_MPS = 3;
export const EG_PUSH_DT_MAX = 0.1;
export const EG_PUSH_MAX_M = 8;
export const EG_RING_PAD = 0.3;
/** EG-E: a Redoubt's spoils leave the Court's heart this high over its floor, and rest this far inside its ring (m). */
export const EG_BEACON_SPEW_UP = 2.2;
export const EG_BEACON_RIM_M = 1.5;
/** AUDIT EG III (lane1 #5): how many halls on from the one it is used in Long Step looks for its span (a crumble's hall). */
export const EG_LONG_STEP_LOOK = 10;
/** The witness's camera: behind and over the watched member (m). */
export const EG_WITNESS_BACK = 4;
export const EG_WITNESS_UP = 1.5;
/** AUDIT EG III (lane6 #1, section 16.5: "critically damped (0.35 s), colliding as the Morrowind body's camera does"): the
 *  orbit's smoothing time (s), and how far the eye may have to go in a frame before it stands there at once instead (m - the
 *  watched member pulled to another plate: the stair's veil covers that step, never a sweep across the void). */
export const EG_WITNESS_DAMP_S = 0.35;
export const EG_WITNESS_SNAP_M = 8;
/** AUDIT EG III (lane6 #1): THE WITNESS'S ORBIT POINT - EG_WITNESS_BACK behind the watched member's relayed pose `p` (its
 *  eye, the camera's yaw `yaw`) and over it. Pure. @param {number[]} p @param {number} yaw */
export const egWitnessOrbit = (p, yaw) => [p[0] - Math.sin(yaw) * EG_WITNESS_BACK, p[1] + EG_WITNESS_UP + 1.6, p[2] - Math.cos(yaw) * EG_WITNESS_BACK];
/**
 * AUDIT EG III (lane6 #1): THE WITNESS'S EYE KEPT OUT OF THE ROCK, as the Morrowind body's camera keeps its own (player/
 * mwCamera.js eye): eye `e` pulled in along the way out from the watched member's pose `p` to where the swept sphere of the
 * camera's clearance (CAMERA_OBSTACLE_LIMIT) first meets the hall (`cast`, the host's sphere cast - its distance is the
 * sphere's centre's, nothing taken off). No cast, no hit short of it: `e` itself. Pure.
 * @param {number[]} p @param {number[]} e @param {((o: number[], r: number, d: number[], m: number) => (number|null)) | null} [cast]
 */
export function egWitnessClear(p, e, cast = null) {
  const dx = e[0] - p[0], dy = e[1] - p[1], dz = e[2] - p[2], len = Math.hypot(dx, dy, dz);
  if (typeof cast !== 'function' || !(len > 1e-6)) return [e[0], e[1], e[2]];
  const hit = cast([p[0], p[1], p[2]], CAMERA_OBSTACLE_LIMIT / MW_UNITS_PER_METER, [dx / len, dy / len, dz / len], len);
  const k = Number.isFinite(hit) && hit < len ? Math.max(0, hit) / len : 1;
  return [p[0] + dx * k, p[1] + dy * k, p[2] + dz * k];
}
/**
 * AUDIT EG III (lane6 #1): THE WITNESS'S EYE DAMPED - `cur` (`{ p, v, who }`, the eye and its velocity, or null) carried
 * toward `want` over `dt` (s) by a critically damped spring of smoothing time EG_WITNESS_DAMP_S (Unity's SmoothDamp, its
 * Pade approximation); no eye yet, no time, or `want` past EG_WITNESS_SNAP_M away, and it stands at `want` still. `who` the
 * member it watches. In place where `cur` is given; answers the eye.
 * @param {{ p: number[], v: number[], who: string } | null} cur @param {number[]} want @param {number} dt @param {string} who
 */
export function egWitnessDamp(cur, want, dt, who) {
  const e = cur ?? { p: [want[0], want[1], want[2]], v: [0, 0, 0], who };
  e.who = who;
  if (!cur || !(dt > 0) || Math.hypot(want[0] - e.p[0], want[1] - e.p[1], want[2] - e.p[2]) > EG_WITNESS_SNAP_M) {
    for (let a = 0; a < 3; a++) { e.p[a] = want[a]; e.v[a] = 0; }
    return e;
  }
  const w = 2 / EG_WITNESS_DAMP_S, x = w * dt, f = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (let a = 0; a < 3; a++) {
    const ch = e.p[a] - want[a], tmp = (e.v[a] + w * ch) * dt;
    e.v[a] = (e.v[a] - w * tmp) * f;
    e.p[a] = want[a] + (ch + tmp) * f;
  }
  return e;
}
/** The account service's refusals in the Spire's words where its own differ (a key's balance, a guest, a breach held, a road
 *  shut); AUDIT EG V (c, L7-11): every other word the catalog holds is said as net/accountClient.js REFUSALS says it, in the
 *  player's language - never a second English copy of its sentence - and a word it does not know is a shut road. */
const REFUSED = Object.freeze({
  short: EG_TEXT.noKeys, guest: EG_TEXT.guest, 'no-session': EG_TEXT.guest, live: EG_TEXT.held, offline: EG_TEXT.shut, server: EG_TEXT.shut,
  'no-signing-key': EG_TEXT.shut,
});
export const egRefusalText = (error) => REFUSED[error] ?? (typeof error === 'string' && Object.hasOwn(REFUSALS, error) ? accountRefusalText(error) : EG_TEXT.shut);

/**
 * Whether a kept receipt is done with (recorded, already counted, refused for good) - false keeps it for the next try.
 * Pure.
 * @param {{ ok: boolean, data?: any, error?: string }} a
 */
export function egClaimDone(a) {
  if (a?.ok) return true;
  return a?.error === 'receipt' || a?.error === 'not-yours';
}

/**
 * QL11: THE REDOUBT'S ACTS, off a claim's answer `a` for its receipt `c` - a Redoubt taken, its e1 receipt counted once
 * (`recorded`; a Rehearsal's is practice), and a Valkynaz's besides: every fifth Court (egLaw.js egBossOf), the receipt's
 * own `w` (egPay.js egValkRedoubt - the one law the service pays a `w` receipt by). AUDIT QUESTLINES ACTS-8: here, out of
 * createEgClient's scope, which the host ceiling holds (test/scenes/hostceiling.test.js) - its claim loop calls it, one line.
 * @param {any} a @param {any} c
 */
function redoubtActs(a, c) {
  if (!a?.ok || !a.data?.recorded || a.data.q !== 'w' || c?.rh === 1) return;
  noteAct('redoubt-taken');
  if (egValkRedoubt(c.w)) noteAct('valkynaz-felled');
}

/** A request id the service takes (server-account/src/eg.js EG_RQ_RE). */
function requestId() {
  const b = new Uint8Array(12);
  try { globalThis.crypto.getRandomValues(b); } catch { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); }
  return [...b].map((v) => v.toString(36).padStart(2, '0')).join('').slice(0, 24);
}

/** EG-ZP (section 15's Lifeline): the strongest Lifeline among a heal word's healers (`subs`, their accounts - null for a
 *  peer this screen cannot name) by the runs the room says (`ms` - the members it counts in the breach alone), never mine
 *  (the census believes no member's own heal - net/eliteGates/egTally.js egTallyHeal); 0 for none. Pure.
 * @param {any} E @param {string|null} me @param {Array<string|null>} subs */
export function egLifelineOf(E, me, subs) {
  let v = 0;
  for (const s of subs) if (s !== me) v = Math.max(v, egVOf(egRunOfMember(E, s).vs, 'lifeline'));
  return v;
}

/** EG-ZR (section 15's Mender's Grace, "the receiver's client, from the room's word"): the share more a heal of `sub`'s on me
 *  heals - its Mender's Grace by the run the room says (`ms` - members it counts in the breach alone), never mine; 0 for
 *  none, for a caster this screen cannot name. Pure.
 * @param {any} E @param {string|null} me @param {string|null} sub */
export const egMenderOf = (E, me, sub) => (sub && sub !== me ? egVOf(egRunOfMember(E, sub).vs, 'mender') : 0);

/**
 * @param {{ modes: () => any, online: () => any, hub: () => any, account: any, now: () => number, entity: any, player: any, cam: any,
 *   say: (text: string) => void, mid?: (text: string) => void, veil?: () => any, site: () => any, wire: () => any, landAt: (l: any) => boolean,
 *   hurt: (n: number) => void, store?: any, saved?: () => void, hudHidden?: () => boolean, fight?: (link: any) => any, renderer?: any, audio?: any,
 *   peers?: () => { sub: string, pos: number[] }[], heal?: ((p: number, why: string) => void) | null,
 *   paid?: ((c: any, data: any) => void) | null, win?: any, redoubt?: ((rd: number) => void) | null, board?: (() => any) | null,
 *   keyFacts?: (() => any) | null, startWindow?: ((o: any) => any) | null, party?: () => { sub: string, name: string, h?: number, hm?: number }[], questDue?: () => boolean,
 *   callPortal?: any, arches?: any, prompt?: any, windowUp?: () => boolean, feet?: () => (number[]|null), probes?: () => any, Session?: any,
 *   accountOf?: (peer: string) => (string|null) }} deps
 *   EG-F: `keyFacts` the host's facts for the key's refusals (scenes/eliteGates/egArch.js egKeyRefusal - `site` the arch's site on the
 *   wire where it would stand, null with no room); `startWindow` opens the start window (ui/eliteGates/egStartWindow.js; none: Hall 1
 *   at once); `party` my party's members; `questDue` whether a quest falls due inside the last word; `callPortal` the
 *   call's portal (scenes/eliteGates/egCall.js createEgCallPortal; none: the answer steps in at once); `arches` the arch pool
 *   (scenes/eliteGates/egArch.js); `prompt` the call's strip; `windowUp` a window over the screen; `feet` my feet in the scene;
 *   `probes` the ground and wall probes a portal's place asks. EG-ZM: `Session` the session class a way back's listener is
 *   made of (net/online.js OnlineSession - egSeedListen). EG-ZP: `accountOf` a peer's account by its id in the room (the
 *   company is my party - net/social.js accountOfPeer), a heal word's healer's.
 */
export function createEgClient({ modes, online, hub, account, now: hostNow, entity, player, cam, say, mid = () => {}, veil = () => null, site, wire, landAt, hurt,
  store = null, saved = () => {}, hudHidden = () => false, fight: makeFight = () => null, renderer = null, audio = null, peers = () => [], heal = null, paid = null, win = globalThis.window, redoubt = null, board = null,
  keyFacts = null, startWindow = null, party = () => [], questDue = () => false, callPortal = null, arches = null, prompt = null, windowUp = () => false,
  feet = () => null, probes = () => ({}), Session = OnlineSession, accountOf = () => null }) {
  // EG-H1: THE SHARED CLOCK, CORRECTED (section 10.8; net/eliteGates/egClock.js) - the host's clock until the room has answered a ping,
  // then this machine's wall clock plus the median offset; the breach's link, its fight and every time here read it
  const clock = egClockNew();
  const now = () => { const off = egClockOffset(clock); return off == null ? hostNow() : Date.now() + off; };
  const sayBody = bodySayer((v) => !!online()?.sendEg?.('vt', { v }));
  const link = createEgLink({ now, say, onReceipt: (r) => claimAdd(r), onRefused: (w) => refused(w) });
  let fight = null;
  /** an open in flight: its request id, the service's order, whether the hub took it */
  let opening = null;
  /** my admission to the breach I answered: `{ b, z, at }` (AUDIT EG V: `at` when it came, this device's clock); the welcome
   *  it went to the room under; AUDIT EG V (lane4 L4-3): the asks my hall made of the service, and one in flight - (D NEW-4)
   *  the one breach's count (`b`, `n`), begun again by the next breach: a session held an entry for every breach it stood in */
  let admit = null, inFor = -1, admitAsking = false;
  const admitAsks = { b: '', n: 0 };
  const admitAsked = (b) => (admitAsks.b === b ? admitAsks.n : 0);
  /** AUDIT EG V (lane4 L4-3): do I hold an admit order for breach `b` young enough to go to its room (EG_ADMIT_FRESH_MS)? */
  const admitFresh = (b) => admit?.b === b && !!admit.z && Date.now() - admit.at < EG_ADMIT_FRESH_MS;
  let answering = false, swapping = false, leaving = false;
  /** EG-H3 (EG10): when the step into a new circle began waiting on its build still in flight (0: not waiting) */
  let swapWaitAt = 0;
  let downAt = -Infinity, downH = 0, placedH = 0, endSeen = null, endAt = 0, homeAskAt = -Infinity;
  /** FIELD BUGS 2026-10-20f DOOR-WORD: the door's last word on why it will not take me - the hall and the reason (EG_FAIR_TEXT) */
  let unfair = { h: 0, w: '' };
  let keysAt = -Infinity, claimAt = -Infinity, rdSeen = 0, callSaid = '';
  let door = null, doorH = 0, portal = null;
  /** THE WITNESS VIEW: my fall's place, whom I watch; THE POTION LAW's count this hall; THE RECAP's log; my answers to
   *  the company's word; a recap standing; a forsake asked once. */
  let witness = null, potions = EG_POTIONS_PER_HALL, potionHall = '', recap = null, recapUntil = 0, forsakeAskAt = -Infinity, logH = 0;
  /** EG-FULL LAYER THREE: the pages of the Annals this breach has given me (the account keeps them - EG-E). AUDIT EG V (c,
   *  L7-5): and the pages the account keeps (`/v1/eg/keys` `annals`, a bit a page), read at each answer - so every page ever
   *  found is read anywhere, a reload or another breach later. */
  const annals = new Set();
  let annalsKept = 0;
  /** THE RECAP's log: each hall the company stood in (`{ h, glyph, lord, lordName, fall, falls }`). AUDIT EG V (c, L7-8): kept
   *  on the device with its breach (EG_LOG_KEY), so a reload's recap still has the circles before it, and its falls are the
   *  room's - each member's fall heard in the hall the company stood in, and a fall the screen missed (a reload's gap) read
   *  off the company's own count. */
  const log = [];
  let logB = '', logFalls = /** @type {Record<string, number>} */ ({});
  const voted = {};
  /** AUDIT EG V (c, L2-14; section 17.4): THE POTION LAW's count kept on the device with its breach and hall (EG_POTIONS_KEY),
   *  so a reload never refills the hall's two. */
  try { const v = JSON.parse(store?.getItem?.(EG_POTIONS_KEY) ?? 'null'); if (v && typeof v.k === 'string' && Number.isSafeInteger(v.n) && v.n >= 0 && v.n <= EG_POTIONS_PER_HALL) { potionHall = v.k; potions = v.n; } } catch { /* none kept */ }
  const potionsKeep = () => { try { store?.setItem?.(EG_POTIONS_KEY, JSON.stringify({ k: potionHall, n: potions })); } catch { /* the session's alone */ } };
  /** AUDIT EG V (c, L7-7): when my last ping went (the shared clock) - its cooldown shown. */
  let pingAt = -Infinity;
  const me = () => account?.me?.() ?? null;
  /** the way home's portal (scenes/portalFx.js - the Portal Stone's own) */
  let portalSet = null;
  const portals = () => (portalSet ??= renderer?.createBillboardBatch ? createPortalSet({ renderer, audio }) : null);
  const inSpire = () => modes()?.egHallBreach?.() != null;
  // EG-ZG (Elite-Gates.md section 25.4): THE QUIET COMPANY's allies - another player's spell effects at 60% with no light of
  // their own during a trial, read by the spell engine every host shares (scenes/hostMagic.js through ui/eliteGates/egAccess.js)
  egAllyLookSet(() => { if (!inSpire()) return null; const q = egQuietCompany(link.state()?.sg); return { alpha: q.allyAlpha, glow: q.allyGlow }; });
  /** EG-F: the call heard (its horn sounded once a breach), my answer under way (the portal open for it, or the step), the
   *  start window standing, the relay's public half (base64url) and its import. */
  let hornFor = '', answeredFor = '', startWin = null, rk = null, rkKey = null;
  // EG-G2 (2026-10-12, Elite-Gates.md sections 25 and 26): THE LOOK (scenes/eliteGates/egLookDraw.js - built the first time a hall is
  // drawn, released on every way out) and THE SCORE's view of this breach (systems/eliteGates/egScore.js - world.js plays it)
  let look = null;
  const lookOf = () => (look ??= renderer?.gl ? createEgLookDraw({ gl: renderer.gl }) : null);
  // EG-ZD (section 22): THE WAY BACK - the record (the device's, EG_BACK_KEY), the breach the service last said is live
  // (undefined until it has answered), the breach the offer was said for, when the record was last written, a return in
  // flight (its breach), the seed the circle standing was built from, my Reliquaries while I stood (a fall's cost)
  let wayBack = null, backLive = /** @type {string|null|undefined} */ (undefined), backSaid = '', backWroteAt = -Infinity, backDirty = false, returning = /** @type {string|null} */ (null), circleSeed = /** @type {number|null} */ (null), relHeld = 0;
  /** the breach the room will not take me back into (its end, my way home, forsaking, its refusal) - kept on the device as
   *  `{ b, x: 1 }`, so the service's `live` (held until my end receipt is claimed or it lapses) never offers it again */
  let backOver = '';
  try { const raw = JSON.parse(store?.getItem?.(EG_BACK_KEY) || 'null'); wayBack = egBackOf(raw); backOver = raw?.x === 1 && typeof raw.b === 'string' ? raw.b : ''; } catch { wayBack = null; }
  /** The record to the device - at once (`force`), else at most each EG_BACK_WRITE_MS. */
  function backKeep(force = false) {
    if (!wayBack) return;
    if (!force && Date.now() - backWroteAt < EG_BACK_WRITE_MS) { backDirty = true; return; }
    backWroteAt = Date.now(); backDirty = false;
    try { store?.setItem?.(EG_BACK_KEY, JSON.stringify(wayBack)); } catch { /* the session's alone */ }
  }
  /** The breach is over for me (its end, my way home, forsaking, a room that will not take me back): the record let go, the
   *  breach marked over on the device. */
  function backDrop(b = wayBack?.b ?? returning ?? '') {
    wayBack = null; returning = null;
    if (b) backOver = b;
    try { store?.setItem?.(EG_BACK_KEY, backOver ? JSON.stringify({ b: backOver, x: 1 }) : ''); } catch { /* the session's alone */ }
  }
  /** The account service's word on my live breach (`/v1/eg/keys` `live`): a record of another breach, or of none, is over;
   *  a live breach this device holds no record of is kept as one (its seed the room's word once I stand in it). */
  function backHeard(live) {
    backLive = live && typeof live.b === 'string' ? live.b : null;
    if (inSpire()) return;
    if (wayBack && wayBack.b !== backLive) backDrop();
    if (!wayBack && backLive && backLive !== backOver && /^[0-9a-f]{16}$/.test(backLive)) wayBack = { b: backLive, seed: 0, op: 0, geo: 0, ew: 0, rh: 0, h: 0, in: 0, li: null, wf: 0 };
  }
  // EG-ZM (section 22): a way back held under the veil for the room's first word - its listener (egSeedListen) and the
  // step that waits on it
  let seedWait = null;
  /** The room's first word, asked of breach `b`'s room by a listener on my own identity; the frame settles it (seedFrame). */
  function seedHeard(b) {
    const main = online();
    if (!main?.url) return Promise.resolve({ silent: true });
    return new Promise((resolve) => { seedWait = { L: egSeedListen({ main, b, at: Date.now(), Session }), resolve }; });
  }
  /** The listener asked each frame, and its answer handed to the step that waits - the slot emptied before the step is told.
   *  `end` an answer the screen gives it instead (its online frame gone - away). */
  function seedFrame(end = null) {
    if (!seedWait) return;
    const a = end ?? seedWait.L.frame(Date.now());
    if (!a) return;
    const { L, resolve } = seedWait;
    seedWait = null;
    L.close();
    resolve(a);
  }
  /** May I go back into my breach now: outside it, the service saying it lives, and either counted by its room or with no
   *  call of it still open to answer (the call's own answer is its door while it stands). */
  function returnable() {
    if (!wayBack || backLive !== wayBack.b || inSpire() || returning || leaving) return false;
    const E = link.state(), c = E.call;
    return !!wayBack.in || !(c?.b === wayBack.b && egPhase({ openedAt: c.op, wokeAt: E.b === c.b ? E.wk : 0 }, now()) === 'open');
  }
  /** EG-ZD (section 10.8): THE SPANS' ANCHORED SECONDS on the corrected clock - render/deadlands.js anchoredClock's law (never
   *  stepping back between anchors), taken again when the offset moves past EG_SPAN_REANCHOR_MS. */
  let spanClock = null, spanOff = 0;
  /** EG-ZD (section 26): THE SPIRE MIX the beats ride - the fight's (over the host's music), else this screen's own. */
  let ownMix = null;
  const bus = () => fight?.mix?.() ?? (ownMix ??= createSpireMix({ audio, now }));
  /** The circle this screen stands in, told to the look. AUDIT EG III (lane4 #6): the level standing - the mode machine's
   *  circle and the seed it was built from - never the company's word, which runs ahead of it through the veil's closing
   *  and a swap's wait. */
  const lookCircle = (E) => { const L = lookOf(), c = modes()?.egHallCircle?.(); if (L && E.b && c > 0) L.setCircle(circleSeed ?? E.seed, c, E.geo ?? 0); return L; };
  /** EG-ZE: reduced motion now (the port's row or the system's) - the stair's cut, the lights still. */
  const stillNow = () => egReducedMotion(win);
  // EG-ZH: THE HALL'S REVERB over this screen's engine (systems/eliteGates/egReverb.js); the arena my motor was given (mine to take
  // back, never another's)
  const reverb = createEgReverb({ audio });
  let fragArena = null;
  /** EG-ROAR (section 26): THE SPIRE'S AIR over this screen's engine (scenes/eliteGates/egAir.js) - played from the score's
   *  own place each frame I stand in the breach, let go on every way out the reverb is */
  const air = createEgAir(audio);

  // ── the keys ────────────────────────────────────────────────────────────────────────────────────────
  /** AUDIT EG IV (lane3 #10; section 5): THE BALANCE'S ANSWERS IN THE ORDER THEIR ASKS WENT - each ask that answers the balance
   *  (the keys, the open, the start window's preflight, a claim) takes a number as it goes, and an answer that lands after a
   *  later ask's was applied is never applied over it: answers landing out of order left a stale count on the pack. */
  let keysAsked = 0, keysSaid = 0;
  const keysAsk = () => ++keysAsked;
  /** The pack's keys set to the account's balance (a face, never the count) - `seq` its ask's number (keysAsk), `spent` the
   *  keys this answer's own open staked. AUDIT EG IV (lane3 #10; section 5 - *The key turns to rust.*): an answer that takes a
   *  key the pack showed, past those its open staked and those the device's lost opens took unseen (EG_OPENS_KEY), says so -
   *  a key the service does not count does nothing. */
  function restack(n, seq = keysAsk(), spent = 0) {
    if (!Number.isSafeInteger(n) || n < 0 || !entity?.items || seq < keysSaid) return;
    keysSaid = seq;
    if (weirKeysHeld(entity.items) - spent - opensKept().filter((p) => p.s === me()).length > n) say(EG_TEXT.rust);
    if (restackWeirKeys(entity.items, n)) saved();
  }
  async function askKeys() {
    if (!me() || account?.guest?.()) return;   // EG-ZD: asked once signed in (a reloaded page signs in after its first frame)
    keysAt = Date.now();
    const seq = keysAsk(), a = await account.keys();
    if (a?.ok) restack(a.data?.keys, seq);
    if (a?.ok && typeof a.data?.rk === 'string') rk = a.data.rk;   // EG-F: the relay's public half
    if (a?.ok) backHeard(a.data?.live ?? null);   // EG-ZD (section 22): the account's live breach - THE WAY BACK
    // EG-ZF (section 27.7): the first-time lines the account has heard - read over the device's; a line this screen showed
    // that the account has not heard yet is told it again
    // AUDIT EG V (c, L7-23): and a line the device kept for this account (its word to the service lost before a reload) is
    // read in, and told the account
    if (a?.ok && Number.isSafeInteger(a.data?.first) && a.data.first >= 0) { pres.acct = a.data.first; if ((pres.shown | firstDevice()) & ~pres.acct) tellFirst(); }
    if (a?.ok && Number.isSafeInteger(a.data?.annals) && a.data.annals >= 0) annalsKept = a.data.annals;   // AUDIT EG V (c, L7-5): the pages the account keeps
  }
  /** EG-F: THE RELAY'S PUBLIC HALF, imported once it is heard (a stranger's arch is believed only when the hub's signature
   *  over it verifies - net/eliteGates/egCallSig.js). Null until then. */
  async function relayKey() {
    if (!rk) return null;
    if (rkKey?.b64 !== rk) rkKey = { b64: rk, key: importPublicKeyB64(rk, { subtle: globalThis.crypto.subtle }).catch(() => null) };
    return rkKey.key;
  }
  /** Why the key will not turn here, or null - EG-F: the page's eight in its order (scenes/eliteGates/egArch.js egKeyRefusal), over
   *  the host's facts (the holds, the water, a boat, a location's footprint, a Dagon's Breach near, the arch's room) and
   *  this client's own (online, a guest, a breach held, an open in flight, the hub's road, an arch near). */
  function openRefusal() {
    const M = modes(), E = link.state(), f = keyFacts?.() ?? null;
    const callHeld = !!E.call && egPhase({ openedAt: E.call.op }, now()) !== 'ended' && E.call.co.some((r) => r[0] === me());
    return egKeyRefusal({ ...(f ?? {}), online: !!online(), guest: !me() || !!account?.guest?.(), exterior: (M?.mode ?? 'exterior') === 'exterior' && !inSpire(),
      held: inSpire() || callHeld, opening: !!opening, shut: !hub()?.egOk, nearArch: !!arches?.near?.(feet()), room: f ? !!f.site : true });
  }
  /** THE OPEN: a key staked (or the Rehearsal taken) and its order handed to the hub. EG-F: from the start window's
   *  choice - its start Redoubt `ew` and its Wager `wg` - and the arch's site where it will stand (the host's facts). */
  async function open(rh, { ew = 0, wg = [] } = {}) {
    const rq = requestId(), seq = keysAsk();
    opening = { rq, rh, z: null, site: null, tries: 0, sentAt: -Infinity };
    opensKeep([...opensKept().filter((p) => p.rq !== rq), { rq, s: me(), at: Math.floor(Date.now() / 1000) }]);   // AUDIT EG IV (lane3 #1): kept before it is asked
    const a = await account.open(rq, rh, { ew, wg });
    // AUDIT EG IV (lane3 #1): an answer that never came is no answer - the ask stays kept and is asked again by its own id
    // (openAgainFrame); any word the service said settles it
    if (a?.ok || !EG_OPEN_LOST.includes(a?.error)) opensDrop(rq);
    else openAgainAt = Date.now();
    if (!a?.ok) { opening = null; if (a?.error === 'live') openAgainAt = -Infinity; say(a?.error === 'start' ? EG_TEXT.notStart(ew) : egRefusalText(a?.error)); return false; }   // a breach held: a lost open of mine is asked at once
    restack(a.data?.keys, seq, rh ? 0 : 1);
    opening.z = a.data?.order ?? null; opening.b = a.data?.b ?? null;
    if (opening.z && opening.b) stakeKeep({ b: opening.b, z: opening.z, at: Math.floor(Date.now() / 1000) });   // EG-ZA: kept until a call or a receipt answers it
    opening.site = keyFacts?.()?.site ?? wire();
    if (!opening.z || !opening.site) { opening = null; say(EG_TEXT.shut); return false; }
    sendOpen();
    return true;
  }
  function sendOpen() {
    if (!opening?.z || opening.tries >= EG_OPEN_TRIES) return;
    if (Date.now() - opening.sentAt < EG_OPEN_RETRY_MS) return;
    if (hub()?.sendEg?.('open', { z: opening.z, site: opening.site })) { opening.tries++; opening.sentAt = Date.now(); }
  }
  /** The key's use (systems/eliteGates/weirKey.js's opener): the line it shows; the open started. A call standing for me is
   *  answered instead. */
  function useKey() {
    const E = link.state();
    if (returnable()) { answer(); return EG_BACK_TEXT.back; }   // EG-ZD: my breach still stands - the key takes me back
    if (E.call && E.call.co.some((r) => r[0] === me()) && egPhase({ openedAt: E.call.op }, now()) === 'open' && !inSpire()) { answer(); return EG_TEXT.opens; }
    const no = openRefusal();
    if (no) return no;
    if (startWindow && startWin) return EG_START_ASKING_TEXT;   // AUDIT EG III (lane4 #12): a start window already asking - said, never a silent press
    if (startWindow) { askStart(); return ''; }   // EG-F: the start window asks where first (its preflight's answer opens it)
    open(false);
    return EG_TEXT.opening;
  }
  /** EG-F: THE START WINDOW (section 5) - the preflight (`/v1/eg/starts`: each member of my party's starts, my keys, the
   *  day's Rehearsal), then the window; its choice is the open, every refusal asked again when it lands. */
  async function askStart() {
    if (startWin) return;
    // AUDIT EG V (c, L6-6; section 29 - "every refusal is checked again when its async answer lands"): the ask's own token in
    // the slot - a preflight that lands after the screen let it go (away), or after another ask took the slot, opens nothing
    const ask = { asking: true };
    startWin = ask;
    const members = [{ sub: me(), name: '' }, ...(party() ?? []).filter((m) => m && m.sub !== me())].slice(0, 8);
    let a = null;
    const seq = keysAsk();   // AUDIT EG IV (lane3 #10): its balance in its ask's order
    try { a = await account.starts?.(members.map((m) => m.sub)); } catch { a = null; }
    if (startWin !== ask) { if (a?.ok) restack(a.data?.keys, seq); return; }   // let go meanwhile: its balance stands, no window
    if (!a?.ok) { startWin = null; say(egRefusalText(a?.error)); return; }
    if (typeof a.data?.rk === 'string') rk = a.data.rk;
    restack(a.data?.keys, seq);
    const no = openRefusal();   // AUDIT EG V (c, L6-6): a refusal come to stand meanwhile (a step indoors, a call) - said, no window
    if (no) { startWin = null; say(no); return; }
    const mine = (party() ?? []).find((m) => m.sub === me());
    if (mine) members[0].name = mine.name;
    startWin = startWindow({ keys: a.data?.keys ?? 0, me: me(), members, starts: a.data?.starts ?? {}, rehearsal: !!a.data?.rehearsal, questDue: !!questDue(), say,
      onChoose: (c) => { startWin = null; const no2 = openRefusal(); if (no2) { say(no2); return; } open(!!c.rh, { ew: c.ew | 0, wg: c.wg ?? [] }); say(EG_TEXT.opening); },
      onCancel: () => { startWin = null; } }) ?? null;
  }
  /** AUDIT EG V (c, L7-14): whether a call of my company's stands for me (any phase the link still holds - answered late, it
   *  says the late line). */
  const callMine = (E) => !!E.call && E.call.co.some((r) => r[0] === me());
  /** AUDIT EG V (c, L7-14; sections 5 and 27.7): THE START WINDOW WITHOUT A KEY - `/breach` with no call standing asks where
   *  in the Spire as the key does (its refusals first); a keyless player is offered the day's Rehearsal there. */
  function startOpen() {
    const no = openRefusal();
    if (no) { say(no); return; }
    if (!startWindow) { say(NO_CALL_TEXT); return; }
    if (startWin) { say(EG_START_ASKING_TEXT); return; }
    askStart();
  }
  /** AUDIT EG V (c, L7-5; section 11.10): THE ANNALS READ - the pages the account keeps and this breach has given, anywhere:
   *  page `b` (its number in the list), else the list. */
  function annalsSay(b) {
    const n = (Number(b) | 0) - 1, have = annalsHeld();
    if (!have.length) say('No page of the Annals is yours yet. Look behind the halls\' false walls.');
    else if (n >= 0 && have[n] != null) say(`${EG_ANNALS[have[n]][0]}: ${EG_ANNALS[have[n]][1]}`);
    else say(`Your pages of the Annals: ${have.map((p, j) => `${j + 1}. ${EG_ANNALS[p][0]}`).join(', ')}. /breach annals N to read one.`);
  }
  /** The pages held, in their order: the account's bits and this breach's gifts. */
  const annalsHeld = () => EG_ANNALS.map((_, p) => p).filter((p) => annals.has(p) || (p < 31 && (annalsKept & (1 << p)) !== 0));
  /** AUDIT EG V (c, L7-2): THE RESPITE'S OWN WORD - yes (R, `/breach respite`) or no, on its ask while it is open. */
  function respiteVote(word = 'yes') {
    const q = (link.state().as ?? []).find((a) => a[0] === 'respite' && a[2] > now());
    if (!q) { say(egRespiteNone()); return false; }
    const y = word === 'no' || word === 'n' ? 0 : 1;
    voted.respite = y;
    return !!online()?.sendEg?.('vote', { q: 'respite', y });
  }
  /** A ping said where I stand (a witness: where the member it watches stands) - `w` its kind (0 here, 1 danger, 2 mine or
   *  a cache). AUDIT EG V (c, L7-7): its cooldown kept, the room's own (EG_PING_MS) - a press inside it is told the seconds. */
  function pingSay(w = 0) {
    const E = link.state(), at = pingPlace(E), left = pingLeft();
    if (left > 0) { say(egPingWait(Math.ceil(left / 1000))); return false; }
    if (!at || !online()?.sendEg?.(witness ? 'ping' : 'lping', { x: Math.round(at.x * 100) / 100, z: Math.round(at.z * 100) / 100, w })) return false;
    pingAt = now();
    return true;
  }
  /** What is left of my ping's cooldown (ms, 0 ready). */
  const pingLeft = () => Math.max(0, EG_PING_MS - (now() - pingAt));

  // ── the call and the answer ───────────────────────────────────────────────────────────────────────────
  /** THE ANSWER: my admission, and the step under the veil into the first circle. EG-F: `viaArch` the arch stepped through
   *  (the opener's door, and any of the company's who walked to it) - no portal asked. */
  async function answer(viaArch = false) {
    const E = link.state(), c = E.call, M = modes(), t = now();
    if (returnable() && (!c || c.b === wayBack.b)) return returnIn();   // EG-ZD (section 22): THE WAY BACK - never refused as late
    if (!c) { say(NO_CALL_TEXT); return false; }
    if (!c.co.some((r) => r[0] === me())) { say(EG_TEXT.outside(c.o)); return false; }
    const no = answerNo(c, t, M);
    if (no !== null) { if (no) say(no); return false; }
    if (answering || M?.stepping) return false;
    answering = true;
    try {
      if (!admitFresh(c.b)) {   // AUDIT EG V (lane4 L4-3): an order past half its life, or refused, asked again - never reused
        const a = await account.admit(c.b);
        if (!a?.ok) { say(a?.error === 'start' ? EG_TEXT.notStart(c.ew ?? 0) : egRefusalText(a?.error)); return false; }   // EG-F: no carries
        admit = { b: c.b, z: a.data?.order ?? null, at: Date.now() };
        inFor = -1;
        // AUDIT EG IV (lane4 #14; section 29 - "every refusal is checked again when its async answer lands"): a step indoors,
        // the open window's end or the Spire entered while the admission was asked - each said in its own words, never as
        // "no room" or a shut Spire; the admission is kept for the answer asked again
        const again = answerNo(c, now(), modes());
        if (again !== null) { if (again) say(again); return false; }
      }
      if (!admit.z) { say(EG_TEXT.shut); return false; }
      // EG-F (section 6.4): THE PORTAL AT MY FEET - stepping into it is the admission (the arch's own step is one already)
      if (callPortal && !viaArch) {
        const f = feet();
        const p = f ? callPortal.open(f, cam?.yaw ?? 0, probes()) : { refused: 'ground' };
        if (!p.at) { say(EG_TEXT.room); return false; }
        answeredFor = c.b;
        return true;
      }
      return await stepIn(c, E);
    } finally { answering = false; }
  }
  /** AUDIT EG IV (lane4 #14): why my answer to call `c` will not go now (`t` my clock, `M` the mode machine) - its words, ''
   *  for a refusal said elsewhere (I stand in the Spire), or null when it may: the window's phase, then open ground. */
  function answerNo(c, t, M) {
    if (inSpire()) return '';
    const phase = egPhase({ openedAt: c.op }, t), T = egTimes({ openedAt: c.op });
    if (phase === 'rising' || phase === 'sealed') return EG_TEXT.sealed(egCountText(T.openAt - t));
    if (phase !== 'open') return EG_TEXT.late(c.o);
    if ((M?.mode ?? 'exterior') !== 'exterior') return EG_TEXT.indoors;
    return null;
  }
  /** THE STEP IN: under the veil into the breach's first circle (EG-F: the start's - a deeper start's own), the opener
   *  landed before the arch when they come out (section 6.4), everyone else where they answered from. AUDIT EG IV (lane4
   *  #14): a step already under way (the mode machine's) refuses this one in silence - it is no shut Spire. */
  async function stepIn(c, E = link.state()) {
    if (modes()?.stepping) return false;
    placedH = 0; downH = 0; endSeen = null; rdSeen = 0; leaving = false;
    answeredFor = c.b;
    const landing = c.os === me() ? arches?.landing?.(c.b) ?? null : null;
    const step = egStairStep(egStartHall(c.ew ?? 0), stillNow());   // EG-ZE: THE STAIR into the breach's first hall - Hall 1's (and a Brink start's) the full fall
    const went = await modes()?.stepThroughFire?.(() => modes()?.enterEgHall?.({ b: c.b, seed: c.seed, c: (c.ew ?? 0) + 1, geo: E.geo ?? 0, site: site(), ...(landing ? { landing } : {}) }), step.look, step.opts);
    if (!went) { answeredFor = ''; say(EG_TEXT.shut); }
    else {
      // EG-ZD (section 22): THE WAY BACK kept from the first step - the room's count of me, my hall and my last island follow
      circleSeed = c.seed >>> 0;
      if (wayBack?.b !== c.b) wayBack = { b: c.b, seed: c.seed >>> 0, op: c.op, geo: E.geo ?? 0, ew: c.ew ?? 0, rh: c.rh ? 1 : 0, h: 0, in: 0, li: null, wf: 0 };
      backOver = ''; backKeep(true);
    }
    return !!went;
  }
  /** EG-ZD (section 22): THE WAY BACK - a hello as an entrant (no new order: the room re-admits a member it counts), under the
   *  veil into the circle of the hall my record last stood in (the start's, before any); the room's word on where the company
   *  stands puts me there (spireFrame). EG-ZM: a record the device knows only from the account service's word (no opening -
   *  so no seed and no hall) waits under the veil for the room's first word and stands the circle that word says; the room's
   *  refusal lets the way back go in its words, and silence opens the veil where I stood. */
  async function returnIn() {
    const M = modes(), R = wayBack;
    if (!R) return false;
    if ((M?.mode ?? 'exterior') !== 'exterior') { say(EG_TEXT.indoors); return false; }
    if (answering || M?.stepping || !(entity.health > 0)) return false;
    answering = true;
    try {
      placedH = 0; downH = 0; endSeen = null; rdSeen = 0; leaving = false;
      answeredFor = R.b; returning = R.b;
      const step = egStairStep(R.h > 0 ? R.h : egStartHall(R.ew ?? 0), stillNow(), !(R.op > 0));   // EG-ZE (merged): the way back under the stair, as every step into the Spire
      if (!(R.op > 0)) step.opts.label = EG_BACK_TEXT.spire;   // AUDIT EG III: no record of the hall - the plain veil, never Hall 1's fall or its name
      let heard = null;
      const went = await M?.stepThroughFire?.(async () => {
        if (!(R.op > 0)) {   // EG-ZM: no seed known - the room's first word first, under the veil
          heard = await seedHeard(R.b);
          if (!heard.st) return false;
          backFrame(heard.st, egMemberOf(heard.st, me()));   // the record kept as the room says it (its seed, its opening, its geometry, its hall) - the circle stood from it
        }
        return M?.enterEgHall?.({ b: R.b, seed: R.seed, c: R.h > 0 ? egCircleOfHall(R.h) : R.ew + 1, geo: R.geo, site: site() });
      }, step.look, step.opts);
      if (!went) {
        returning = null; answeredFor = '';
        if (roomRefused(heard?.no)) { backDrop(R.b); say(sentenceOf(heard.no)); }   // EG-ZM: the room will not take me back - said, and the way back let go
        else say(heard?.silent ? EG_BACK_TEXT.silent : EG_TEXT.shut);
        return false;
      }
      circleSeed = R.seed >>> 0;
      say(EG_BACK_TEXT.back);
      return true;
    } finally { answering = false; }
  }
  /** EG-F: the call's portal stepped into - my admission, the step under the veil. AUDIT EG IV (lane4 #14): not while another
   *  step or an answer is under way - the portal stands for the step after it. */
  function portalEntered() {
    const c = link.state().call;
    if (answering || modes()?.stepping) return false;
    callPortal?.clear?.();
    if (!c || c.b !== admit?.b || inSpire()) return false;
    stepIn(c);
    return true;
  }
  /** A refusal the hub or the room said. AUDIT EG III (lane4 #8, THE MODAL CONTRACT): answers a boolean from every exit -
   *  true where the refusal is said here or is a background ask's (the link says nothing), false where the link says it. */
  function refused(w) {
    if (opening && w === 'the road is shut') { opening = null; return false; }   // EG-H2 (section 22): THE DRAIN - the hub handed the stake back (its void receipt), no retry; said
    if (w === 'the breach took the key' || w === 'the void is too old') { if (voidFor) stakeDrop((s) => s.z === voidFor); voidFor = ''; return true; }   // EG-ZA: the breach's own receipts settle it, or it is past asking - a background ask, said nothing
    if (opening && !inSpire() && w === 'the breach is closed' && opening.tries < EG_OPEN_TRIES) { opening.sentAt = Date.now() - EG_OPEN_RETRY_MS + 1000; return true; }   // AUDIT EG III (lane4 #8): the open asked again - nothing said while it retries
    if (w === 'the breach is closed' && answeredFor && link.state().call?.b === answeredFor) { say(EG_TEXT.late(link.state().call.o)); answeredFor = ''; callPortal?.clear?.(); return true; }   // EG-F: answered after the first hall woke - the late line, said instead
    if (w === 'the order is spent' || w === 'the order is not yours') {
      // AUDIT EG V (lane4 L4-3): the order let go whole - the next answer asks the service again (a refused order kept its
      // breach, and every later answer said a shut Spire); in my hall it is asked again at once, nothing said meanwhile
      const b = admit?.b ?? link.state().b;
      admit = null; inFor = -1;
      return inSpire() && !!b && admitAsked(b) < EG_ADMIT_ASKS;
    }
    return false;
  }
  /**
   * AUDIT EG V (lane4 L4-3; section 6.1 - "The member's hello to eg:<b> carries the order"): MY ADMISSION SAID TO THE ROOM
   * I stand in, while it does not count me - the order I hold, once a welcome, while it is young (admitFresh); else asked of
   * the service again, one ask at a time and EG_ADMIT_ASKS a breach at most (ASYNC NEVER DROPS: the frames meanwhile wait
   * on that one), and the answer goes on the welcome I stand under. An order lives a minute, and a slow step under the veil
   * - or a portal stepped into half a minute on - carried a dead one, which the room refused as not mine.
   */
  function admitIn(b, o) {
    if (admitFresh(b)) { if (o?.welcomes !== inFor && o?.sendEg?.('in', { z: admit.z, lv: Math.max(1, entity.level | 0) })) inFor = o.welcomes; return; }
    if (admitAsking || admitAsked(b) >= EG_ADMIT_ASKS) return;
    admitAsking = true;
    admitAsks.n = admitAsked(b) + 1; admitAsks.b = b;
    (async () => {
      let a = null;
      try { a = await account.admit(b); } catch { a = null; }
      if (a?.ok && a.data?.order) { admit = { b, z: a.data.order, at: Date.now() }; inFor = -1; }
      else if (a && !a.ok && admitAsked(b) >= EG_ADMIT_ASKS) say(egRefusalText(a.error));
    })().finally(() => { admitAsking = false; });
  }

  // ── the receipts ──────────────────────────────────────────────────────────────────────────────────────
  const kept = () => { try { const v = JSON.parse(store?.getItem?.(EG_CLAIMS_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((r) => typeof r === 'string') : []; } catch { return []; } };
  const keep = (list) => { try { store?.setItem?.(EG_CLAIMS_KEY, JSON.stringify(list.slice(-EG_CLAIMS_MAX))); } catch { /* the session's alone */ } };
  let memo = [];
  function claimAdd(r) {
    // AUDIT EG IV (lane3 #2): A RECEIPT THE SERVICE HAS COUNTED, HANDED AGAIN (the hub's held copy, its `claimed` not yet
    // landed) - never claimed again: a re-claim's `again` showed the Redoubt's Marks and haul once more at every hello. Its
    // `claimed` is said again, so the hub lets its copy go.
    const rc = readEgReceipt(r);
    if (rc && countedOf(rc)) { hub()?.sendEg?.('claimed', { b: rc.b, q: rc.q, w: rc.q === 'w' ? rc.w : 0 }); return; }
    const list = store ? kept() : memo;
    if (!list.includes(r)) list.push(r);
    if (store) keep(list); else memo = list.slice(-EG_CLAIMS_MAX);
    // EG-ZA: a receipt naming a stake I hold answers it - a void hands it back, any other is the breach's own
    const c = readEgReceipt(r);
    if (c?.s === me()) {
      if (stakeDrop((s) => s.b === c.b) && c.q === 'v') say(EG_VOID_TEXT);
      if (c.q === 'v' && opening?.b === c.b) opening = null;
    }
    flush();
  }
  /** AUDIT EG III (lane4 #9, ASYNC NEVER DROPS): a flush asked while one is in flight is run again as it ends (`again`) -
   *  a receipt heard mid-flush never waits on EG_CLAIM_RETRY_MS. */
  let flushing = false, again = false;
  async function flush() {
    if (flushing) { again = true; return; }
    if (!me() || account?.guest?.()) return;
    flushing = true; again = false;
    claimAt = Date.now();
    try {
      const nowS = Math.floor(now() / 1000);
      for (const r of store ? kept() : [...memo]) {
        const c = readEgReceipt(r);
        const drop = () => { if (store) keep(kept().filter((x) => x !== r)); else memo = memo.filter((x) => x !== r); };
        if (!c || !(c.e > nowS)) { drop(); continue; }
        if (c.s !== me()) continue;
        const seq = keysAsk(), a = await account.claim(r);   // AUDIT EG IV (lane3 #10): its balance in its ask's order
        if (a?.ok && Number.isSafeInteger(a.data?.keys)) restack(a.data.keys, seq);
        if (a?.ok && a.data?.recorded && a.data.q === 'w') say(`Redoubt ${a.data.w} is yours.`);
        redoubtActs(a, c);   // QL11: a Redoubt taken, and a Valkynaz's (AUDIT QUESTLINES ACTS-8: said at module scope, below egClaimDone)
        // EG-E (section 19): WHAT IT PAID - the service's word on a Redoubt's receipt (the week's pay, the pity's passes,
        // the Marks, the deed, the embers), and the spoils it rolls; a re-claim answers the same (`again`), a guest's its
        // gold alone. Never for a Rehearsal (the service pays none).
        // AUDIT EG IV (lane3 #2): the Marks and the deed handed on with the claim that struck them alone (`recorded`) - a
        // receipt carried again answers its pay again (`again`), and the host showed its Marks' card and lines once more for
        // every re-claim; its spoils go on (the host's pool takes each once)
        if (a?.ok && c.q === 'w' && c.rh !== 1 && (a.data?.recorded || a.data?.again || a.data?.why === 'guest')) paid?.(c, a.data?.recorded ? a.data : { ...a.data, marks: null, deed: null });
        if (a?.ok && c.q === 'x' && a.data?.board) boardHeard(c.b, a.data.board);   // EG-ZF (section 27.6): the board's line on the recap
        // AUDIT EG III (section 16.3): an end's Reliquaries - those the service opens (`rl`) rolled and given (`paid`, the host's
        // pool), the recap's count theirs; a Redoubt the service paid already this week (`paid` false) told the room, whose
        // circle's Reliquaries then give 20 lumen each (net/eliteGates/egBrain.js `wkpaid`)
        if (a?.ok && c.q === 'x' && Array.isArray(a.data?.rl)) { openedHeard(c.b, a.data.rl.length); if (a.data.rl.length) paid?.(c, a.data); }
        if (a?.ok && c.q === 'w' && a.data?.paid === false && (a.data.recorded || a.data.again) && link.state().b === c.b && !link.state().end) online()?.sendEg?.('wkpaid', { w: c.w });
        if (egClaimDone(a)) { drop(); countedAdd(c); hub()?.sendEg?.('claimed', { b: c.b, q: c.q, w: c.q === 'w' ? c.w : 0 }); }   // EG-ZA: the hub forgets its held copy; AUDIT EG IV (lane3 #2): and this device remembers it counted
      }
    } finally { flushing = false; }
    if (again) await flush();   // AUDIT EG III (lane4 #9): the receipt heard meanwhile, carried now
  }

  // ── EG-ZA: the stakes (sections 22 and 23, "A key's loss") ───────────────────────────────────────────────────
  /** the stakes kept on the device (`{ b, z, at }`), those past EG_VOID_MAX_S let go; the memo without a store */
  let stakesMemo = [], voidAt = -Infinity, voidFor = '', stakeLookAt = -Infinity;
  const stakesKept = () => {
    let v = stakesMemo;
    if (store) { try { v = JSON.parse(store.getItem?.(EG_STAKES_KEY) ?? '[]'); } catch { v = []; } }
    const nowS = Math.floor(Date.now() / 1000);
    return Array.isArray(v) ? v.filter((s) => s && typeof s.b === 'string' && typeof s.z === 'string' && Number.isSafeInteger(s.at) && nowS - s.at <= EG_VOID_MAX_S) : [];
  };
  const stakesKeep = (list) => {
    stakesMemo = list.slice(-EG_STAKES_MAX);
    if (store) { try { store.setItem?.(EG_STAKES_KEY, JSON.stringify(stakesMemo)); } catch { /* the session's alone */ } }
  };
  /** A stake an open took, kept until a call or a receipt answers it. */
  function stakeKeep(st) { stakesKeep([...stakesKept().filter((s) => s.b !== st.b), st]); }
  /** The stakes `pred` names let go - answers whether any was. */
  function stakeDrop(pred) {
    const list = stakesKept(), left = list.filter((s) => !pred(s));
    if (left.length !== list.length) stakesKeep(left);
    return left.length !== list.length;
  }
  /** A STAKE NO CALL HAS ANSWERED (its open never took, the page reloaded mid-open, the hub's own void unanswered): past
   *  EG_VOID_WAIT_MS its void asked of the hub - one at a time, every EG_VOID_ASK_MS - and never while its open still tries. */
  function stakeFrame() {
    if (!store && !stakesMemo.length) return;
    const t = Date.now();
    if (t - voidAt < EG_VOID_ASK_MS || t - stakeLookAt < EG_STAKE_LOOK_MS) return;
    stakeLookAt = t;
    const st = stakesKept().find((s) => t - s.at * 1000 >= EG_VOID_WAIT_MS && s.b !== opening?.b && s.b !== link.state().call?.b);
    if (!st) return;
    voidAt = t;
    if (hub()?.sendEg?.('void', { z: st.z })) voidFor = st.z;
  }

  // ── AUDIT EG IV (lane3 #1): THE OPENS ASKED, KEPT UNTIL ANSWERED (sections 22 and 23, "A key's loss") ───────────────────
  /** the opens kept on the device (`{ rq, s, at }`), those past EG_VOID_MAX_S let go; the memo without a store */
  let opensMemo = [], openAgainAt = -Infinity, openAgainBusy = false;
  function opensKept() {
    let v = opensMemo;
    if (store) { try { v = JSON.parse(store.getItem?.(EG_OPENS_KEY) ?? '[]'); } catch { v = []; } }
    const nowS = Math.floor(Date.now() / 1000);
    return Array.isArray(v) ? v.filter((p) => p && typeof p.rq === 'string' && typeof p.s === 'string' && Number.isSafeInteger(p.at) && nowS - p.at <= EG_VOID_MAX_S) : [];
  }
  function opensKeep(list) {
    opensMemo = list.slice(-EG_OPENS_MAX);
    if (store) { try { store.setItem?.(EG_OPENS_KEY, JSON.stringify(opensMemo)); } catch { /* the session's alone */ } }
  }
  function opensDrop(rq) { const list = opensKept(); if (list.some((p) => p.rq === rq)) opensKeep(list.filter((p) => p.rq !== rq)); }
  /**
   * AN OPEN WHOSE ANSWER WAS LOST, ASKED AGAIN by its own request id (`again` - the service answers the stake that request
   * took and never takes a key for it), one at a time, every EG_OPEN_AGAIN_MS, under the account that asked it - across
   * reloads, and never the open still in flight here: the stake it took is kept as a stake no call answered, so
   * its void is asked and the key comes back (stakeFrame - the order lived a minute, and opens nothing now); `none` is let
   * go once EG_OPEN_SURE_S past the ask (the request never reached the service - no key was taken), a settled stake at once.
   */
  async function openAgainFrame() {
    if (openAgainBusy || Date.now() - openAgainAt < EG_OPEN_AGAIN_MS || !me() || account?.guest?.()) return;
    if (!store && !opensMemo.length) return;
    const p = opensKept().find((q) => q.s === me() && q.rq !== opening?.rq);
    if (!p) return;
    openAgainAt = Date.now(); openAgainBusy = true;
    try {
      const seq = keysAsk(), a = await account.open(p.rq, false, { again: true });
      if (a?.ok && typeof a.data?.order === 'string' && typeof a.data?.b === 'string') {
        stakeKeep({ b: a.data.b, z: a.data.order, at: Number.isSafeInteger(a.data.at) ? a.data.at : p.at });
        restack(a.data.keys, seq);   // the pack still shows the key the lost answer took (opensKept counts it, so no rust)
        opensDrop(p.rq);
      } else if (a?.error === 'none' ? Math.floor(Date.now() / 1000) - p.at >= EG_OPEN_SURE_S : !EG_OPEN_LOST.includes(a?.error) && a?.error !== 'no-session') opensDrop(p.rq);
    } finally { openAgainBusy = false; }
  }

  // ── AUDIT EG IV (lane3 #2): THE RECEIPTS COUNTED, REMEMBERED ──────────────────────────────────────────────────────────
  let countedMemo = [];
  function countedKept() {
    let v = countedMemo;
    if (store) { try { v = JSON.parse(store.getItem?.(EG_COUNTED_KEY) ?? '[]'); } catch { v = []; } }
    const nowS = Math.floor(Date.now() / 1000);
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.s === 'string' && Number.isSafeInteger(x.e) && x.e > nowS) : [];
  }
  /** Receipt claims `c` counted by the service (or refused for good) - remembered until the receipt's own end. */
  function countedAdd(c) {
    const id = egRcId(c), list = countedKept().filter((x) => !(x.id === id && x.s === c.s));
    countedMemo = [...list, { id, s: c.s, e: c.e }].slice(-EG_COUNTED_MAX);
    if (store) { try { store.setItem?.(EG_COUNTED_KEY, JSON.stringify(countedMemo)); } catch { /* the session's alone */ } }
  }
  /** Has the service counted receipt claims `c` (its identity, its account)? */
  const countedOf = (c) => { const id = egRcId(c); return countedKept().some((x) => x.id === id && x.s === c.s); };

  // ── the halls ─────────────────────────────────────────────────────────────────────────────────────────
  /** Where my feet stand in the circle: the hall slot, and the hall frame's x and z (null outside every hall) - THE ASCENT
   *  (Elite-Gates-Ascent.md section 2): and their height (`y`, the hall frame's - every hall's the same). */
  function standing() {
    const p = player?.pos;
    if (!p) return null;
    const [sx, y, z] = dungeonToRealm(p[0], p[1], p[2]);
    return { slot: egSlotAt(sx), sx, y, z };
  }
  /** Stood on hall `h`'s arrival plate, facing down its course - under the veil's flash, unless a closed veil is over the
   *  step already (`flash` false - EG-H3's swap). */
  function placeOn(h, E, flash = true) {
    const spec = egHallOf(E.seed, h, E.geo ?? 0);
    if (!spec.arrive) return false;
    const at = egToDungeon(spec, spec.arrive.x, spec.arrive.y + 0.1, spec.arrive.z);
    if (flash) { const step = egStairStep(h, stillNow()); veil()?.flash?.(step.look, step.opts); }   // EG-ZE: THE PULL under the stair's veil - the band's, the hall held
    return !!modes()?.egPlace?.(at, 0);
  }
  /** EG-ZD (section 22): stood back on my last island (`li` - `[h, x, y, z]`, the hall's frame) under the veil's flash. */
  function placeAt(E, li) {
    const spec = egHallOf(E.seed, li[0], E.geo ?? 0), step = egStairStep(li[0], stillNow());
    veil()?.flash?.(step.look, step.opts);   // EG-ZE (merged): the stair's veil, the hall held
    return !!modes()?.egPlace?.(egToDungeon(spec, li[1], li[2] + 0.1, li[3]), 0);
  }
  /** The Redoubt's way home: its door at the Court's heart (an exit door - the dungeon's own press and name). */
  function standDoor(E) {
    if (door && doorH === E.h) return;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0), f = spec.fight ?? spec.end ?? spec.arrive;
    if (!f) return;
    const [x, y, z] = egToDungeon(spec, f.x, f.y ?? 0, f.z);
    door = { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1], centre: { x: 0, y: 1.6, z: 0 }, size: { x: 3.2, y: 3.2, z: 3.2 }, normal: { x: 0, y: 0, z: -1 } };
    doorH = E.h;
    modes()?.dungeonCtx?.exitDoors?.push?.(door);
    try { portal = portals()?.open?.([x, y, z], { fixed: true, holdMs: 120_000 }) ?? null; } catch { portal = null; }
  }
  function dropDoor() {
    if (door) { const list = modes()?.dungeonCtx?.exitDoors; const i = list?.indexOf?.(door) ?? -1; if (i >= 0) list.splice(i, 1); }
    if (portal) { try { portals()?.remove?.(portal); } catch { /* gone */ } }
    door = null; doorH = 0; portal = null;
  }
  /** Out of the breach the dungeon's own way: to where I answered from, under the veil's flash. */
  function walkOut(text) {
    if (leaving) return;
    leaving = true; returning = null;   // EG-ZD: a return in flight ends with the walk out
    // AUDIT EG V (c, L6-1; section 16.5): THE WITNESS ENDS AT THE DOOR - every way out takes this one, so none can leave a
    // witness standing in the open world (no blow landing, the camera held on a companion): the slot emptied first, the
    // body given back its health as the end's way does
    if (witness) { witness = null; entity.health = Math.max(1, entity.health); }
    dropDoor();
    reverb.release(); clampAway();   // EG-ZH: the hall's reverb let go, the fragment's clamp off my motor
    swapWaitAt = 0; modes()?.egSwapDrop?.();   // EG-H3: the swap's build forgotten with the breach
    lawForget();   // AUDIT EG V (h): and the halls given
    veil()?.flash?.('hourHome');
    if (text) say(text);
    if (!modes()?.egLeave?.()) leaving = false;
  }
  /** A new circle. EG-H3 (EG10's THE SWAP): stood in place under the veil from the level its rest built (the mode
   *  machine's egSwapCircle - no exterior, no landing), waiting at most EG_SWAP_WAIT_MS on a build still in flight; a
   *  build not ready by then, or none offered, and it is the old step: out under the veil and into the next, built as
   *  the first was. */
  async function swapTo(E, c) {
    if (swapping || answering) return false;
    const r = { b: E.b, seed: E.seed, c, geo: E.geo ?? 0 };
    const built = prebuild(E, c);   // AUDIT EG V (E NEW-2): under another law the worker's build from the halls the room gave, once all five are given - else the old step, from the halls this thread holds
    if (built === 'building') { if (!swapWaitAt) swapWaitAt = now(); if (now() - swapWaitAt < EG_SWAP_WAIT_MS) return false; }
    swapWaitAt = 0;
    swapping = true;
    // EG-ZE: THE STAIR the swap shows - the full fall into a band's first hall, the veil else (the circle standing built
    // again under the breach's law veils: the company has not moved), the cut under reduced motion; 0.8 s each way
    const step = egStairStep(E.h, stillNow(), c === modes()?.egHallCircle?.());
    let went = false;
    try {
      const back = modes()?.egHallReturn?.() ?? null;
      placedH = 0; downH = 0; dropDoor();
      went = !!await modes()?.stepThroughFire?.(async () => {
        if (built === 'ready' && modes()?.egSwapCircle?.(r)) { if (!witness && placeOn(E.h, E, false)) placedH = E.h; return true; }   // EG-H3: THE SWAP - the built level stood in place, my feet on its first plate (a witness's body stays held)
        modes()?.forceExitToExterior?.();
        if (back) landAt(back);
        return modes()?.enterEgHall?.({ b: E.b, seed: E.seed, c, geo: E.geo ?? 0, site: site() });
      }, step.look, step.opts);
      if (modes()?.egHallCircle?.() === c) circleSeed = E.seed >>> 0;   // EG-ZD: the circle standing is the breach's own now
    } finally { swapping = false; }
    if (went && lawForeign(E) && lawGiven(E, c)) lawBuilt = `${E.b}:${c}`;   // AUDIT EG V (E NEW-2): stood from the five halls the room gave - the breach's own, never built again
    return went;   // AUDIT EG III (lane4 #3): whether the step ran - THE LAW PIN's rebuild is done only then
  }
  /** One frame in the Spire. */
  function spireFrame(E, t) {
    const M = modes(), o = online();
    if (o?.terminal) {
      if (!leaving && entity.health > 0 && !M?.deathUp?.()) {
        const said = roomRefused(o.error);
        if (said) backDrop(M?.egHallBreach?.() ?? undefined); else keysAt = -Infinity;   // EG-ZD (section 22): a room that refused me lets the way back go; a socket lost asks the service again
        walkOut(said ? sentenceOf(o.error) : EG_TEXT.shut);
      }
      return;
    }
    if (!E.b || E.b !== M?.egHallBreach?.()) return;
    // my admission, once: a member the room already counts is never asked again
    const mine = egMemberOf(E, me());
    if (mine && !mine.in) admitIn(E.b, o);   // AUDIT EG V (lane4 L4-3): a young order, or one asked again
    backFrame(E, mine);   // EG-ZD (section 22): THE WAY BACK kept as the room says it
    if (mine?.alive) relHeld = egRunOfMember(E, me()).rel;   // EG-ZD (section 16.5): what a fall would cost
    if (mine && mine.forsaken) { if (!leaving) { witness = null; backDrop(E.b); walkOut(EG_END_TEXT.forsake); } return; }
    if (mine && !mine.alive && !witness && !leaving) enterWitness(t, false);
    if (mine && mine.home) { witness = null; backDrop(E.b); if (!leaving && endSeen !== 'home') { endSeen = 'home'; recap = egRecapModel(E, me(), log, t, { whyText: EG_END_TEXT.home, why: 'home', board: boards.get(E.b) ?? '' }); recapUntil = Date.now() + 30_000; recapOpened(); } walkOut(null); return; }   // EG-G1: a member who walks home reads the recap too (section 27.6)
    if (E.end) {
      if (endSeen !== E.end) { endSeen = E.end; endAt = t; backDrop(E.b); mid(EG_END_TEXT[E.end] ?? EG_TEXT.ended); recap = egRecapModel(E, me(), log, t, { whyText: EG_END_TEXT[E.end] ?? '', board: boards.get(E.b) ?? '' }); recapUntil = Date.now() + 30_000; recapOpened(); }
      if (t - endAt >= EG_END_WALK_MS) { if (witness) { witness = null; entity.health = Math.max(1, entity.health); } walkOut(null); }
      return;
    }
    if (!(E.h > 0)) return;
    lawFrame(E);   // EG-H2 (section 22): the halls of a breach of another law, asked
    // THE RECAP's log: each hall the company stood in, its glyph and its falls (AUDIT EG V, c, L7-8: the room's, kept)
    logFrame(E);
    // THE POTION LAW: two restoring potions a hall, refilled at each wake and at the rest. AUDIT EG V (c, L2-14): the count kept
    // on the device by its breach, hall and stage - a reload refills nothing; another breach's count is its own
    const pk = `${E.b}:${E.h}:${E.sg === 'rest' ? 'r' : 't'}`;
    if (!potionHall.startsWith(`${E.b}:`)) { potionHall = `${E.b}:0:t`; potions = EG_POTIONS_PER_HALL; potionsKeep(); }
    if ((E.sg === 'trial' || E.sg === 'rest') && potionHall !== pk) { potionHall = pk; potions = EG_POTIONS_PER_HALL; potionsKeep(); }
    const c = egCircleOfHall(E.h);
    if (E.sg === 'rest' && c === M.egHallCircle?.()) prebuild(E, c + 1);   // EG-H3 (EG10): THE SWAP'S BUILD - the next circle's level made while the Court rests (AUDIT EG V, E NEW-2: under another law from the halls the room gave)
    // EG-ZD (section 22): a circle - or a seed - my record had wrong is rebuilt in place on a return, as a new circle is
    if (c !== M.egHallCircle?.() || (circleSeed != null && circleSeed !== E.seed >>> 0)) { if (E.sg === 'arrive' || returning === E.b) swapTo(E, c); return; }
    // EG-ZD (section 22): BACK IN - resumed at my last island in a trial (the dropped socket's rule), at the hall's arrival
    // plate between trials (a reload's); a witness's body is held as it was
    if (returning === E.b) {
      returning = null;
      const li = wayBack?.li;
      if (!witness && mine?.alive && (E.sg === 'trial' && li && li[0] === E.h ? placeAt(E, li) : placeOn(E.h, E))) placedH = E.h;
    }
    if (witness) { witnessFrame(E); return; }
    const at = standing();
    if (!at) return;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
    // THE PULL: the hall the company stands in is not the one my feet are in - to its plate
    if ((E.sg === 'arrive' || E.sg === 'trial') && placedH !== E.h && at.slot !== egSlotOfHall(E.h)) { if (placeOn(E.h, E)) { placedH = E.h; say(EG_TEXT.pulled); } }
    else if (at.slot === egSlotOfHall(E.h)) placedH = E.h;
    if (E.sg === 'trial') islandFrame(E, t);   // EG-ZD (section 22): my last island, for a return
    // THE DOOR: the closing's step through it, said while I stand in it
    // AUDIT EG III (section 7): within EG_DOOR_REACH_M, the ring's - the relay's one number; said again each second while I stand in it
    if (E.sg === 'closing' && at.slot === egSlotOfHall(E.h) && downH !== E.h && egAtDoor(spec, egLocalX(spec, at.sx), at.z, at.y) && t - downAt >= EG_DOWN_EVERY_MS) {
      downAt = t;
      if (o?.sendEg?.('down', { h: E.h })) mid(unfair.h === E.h ? EG_FAIR_TEXT[unfair.w]() : 'You wait at the door for your company.');   // DOOR-WORD: never "you wait" while the door says why it will not take me
    }
    if (E.sg !== 'closing') downAt = -Infinity;
    // THE REDOUBT: the company healed once, the way home stood at the Court's heart through the rest
    if (E.sg === 'rest') { if (rdSeen !== E.h) { rdSeen = E.h; redoubt?.(E.rd); say(`${EG_TEXT.redoubt(E.rd)} taken. Choose a Vestige. The way home stands at the Court's center, and the stair down opens when the rest ends.`); } standDoor(E); }
    else if (door) dropDoor();
  }

  // ── AUDIT EG V (c, L7-8; section 27.6 - "a strip per circle: the hall kinds' glyphs, the lord, the falls marked"): THE
  // RECAP'S LOG, THE ROOM'S ─────────────────────────────────────────────────────────────────────────────────────────────
  /** A hall's entry on the strip: its glyph, its lord, its falls. */
  function logEntry(E, h, falls = 0) {
    const sp = egHallOf(E.seed, h, E.geo ?? 0);
    return { h, glyph: KIND_GLYPH[sp.kind] ?? '?', lord: sp.lord, lordName: sp.kind === 'court' ? EG_LORDS[sp.lord]?.name ?? '' : '', fall: falls > 0, falls };
  }
  function logKeep() { try { store?.setItem?.(EG_LOG_KEY, JSON.stringify({ b: logB, l: log.map((x) => [x.h, x.falls]), f: logFalls })); } catch { /* the session's alone */ } }
  /** The log for breach `E`: the device's record of it read once (another breach's let go), each hall the company stands in
   *  added - a reload's gap filled from the last kept, or from the breach's first hall where the call says it (else the
   *  circle's first: every hall of a circle the company stands in was crossed) - and each member's falls past those counted,
   *  off the company's own row (the room's `co`, a fall's own word), marked on the hall the company stands in. */
  function logFrame(E) {
    let moved = false;
    if (logB !== E.b) {
      logB = E.b; log.length = 0; logFalls = {}; logH = 0;
      let kept = null;
      try { kept = JSON.parse(store?.getItem?.(EG_LOG_KEY) ?? 'null'); } catch { kept = null; }
      if (kept?.b === E.b && Array.isArray(kept.l)) {
        for (const x of kept.l) if (Array.isArray(x) && Number.isSafeInteger(x[0]) && x[0] > 0 && x[0] <= E.h) log.push(logEntry(E, x[0], Number.isSafeInteger(x[1]) && x[1] > 0 ? x[1] : 0));
        for (const [sub, n] of Object.entries(kept.f ?? {})) if (Number.isSafeInteger(n) && n > 0) logFalls[sub] = n;
        logH = log.at(-1)?.h ?? 0;
      }
    }
    if (E.h !== logH) {
      const first = logH > 0 ? (logH < E.h ? logH + 1 : E.h) : E.call?.b === E.b ? egStartHall(E.call.ew ?? 0) : egFirstHallOf(egCircleOfHall(E.h));
      for (let h = Math.max(first, E.h - EG_LOG_MAX + 1); h <= E.h; h++) log.push(logEntry(E, h));
      if (log.length > EG_LOG_MAX) log.splice(0, log.length - EG_LOG_MAX);
      logH = E.h; moved = true;
    }
    for (const c of E.co ?? []) {
      const n = c[8] ?? 0, was = logFalls[c[0]] ?? 0;
      if (n > was && log.length) { const cur = log[log.length - 1]; cur.falls += n - was; cur.fall = true; logFalls[c[0]] = n; moved = true; }
    }
    if (moved) logKeep();
  }
  /** EG-ZD (section 22): THE WAY BACK kept as the room says it - its seed, its opening, whether it counts me, the hall the
   *  company stands in (written when any of them moves); a breach stood in with no record of it kept from here; a breach over
   *  for me (ended, walked home from, forsaken, refused) never kept again. */
  function backFrame(E, mine) {
    if (E.b === backOver) return;   // over for me (its end, my way home, forsaking, a refusal): never kept again
    if (!mine?.in && wayBack?.b !== E.b) return;
    if (wayBack?.b !== E.b) wayBack = { b: E.b, seed: E.seed >>> 0, op: E.op, geo: E.geo ?? 0, ew: 0, rh: E.rh ? 1 : 0, h: 0, in: 0, li: null, wf: 0 };
    const was = `${wayBack.seed}:${wayBack.op}:${wayBack.geo}:${wayBack.in}:${wayBack.h}`;
    wayBack.seed = E.seed >>> 0; wayBack.op = E.op; wayBack.geo = E.geo ?? 0;
    if (mine?.in) wayBack.in = 1;
    if (E.h > 0) wayBack.h = E.h;
    if (`${wayBack.seed}:${wayBack.op}:${wayBack.geo}:${wayBack.in}:${wayBack.h}` !== was) backKeep(true);
    else if (backDirty) backKeep();
  }
  /** EG-ZD (section 22): MY LAST ISLAND in a trial - still ground under my feet in the company's hall (net/eliteGates/egFair.js egSupportAt,
   *  EG_HOLD.island: a plate, an island, a passage's floor, a bridge, a ramp, a fight floor), never a piece or the end plate;
   *  kept on the record at most each EG_BACK_WRITE_MS. */
  function islandFrame(E, t) {
    if (wayBack?.b !== E.b) return;
    const F = feetInHall(E);
    if (!F || egSupportAt(F.spec, F.x, F.y, F.z, t / 1000) !== EG_HOLD.island) return;
    const L = wayBack.li, r2 = (v) => Math.round(v * 100) / 100;
    if (L && L[0] === E.h && Math.hypot(L[1] - F.x, L[3] - F.z) < 0.5) return;
    wayBack.li = [E.h, r2(F.x), r2(F.y), r2(F.z)];
    backKeep(!L || L[0] !== E.h);
  }
  // ── EG-ZH: the hall's sound and the fragment's clamp (sections 11.7-11.9) ───────────────────────────────────────
  /** The hall my feet stand in, in the circle the level is: its number and spec, or null (between the halls, no circle). */
  function feetHall(E) {
    const at = standing(), c = modes()?.egHallCircle?.() ?? egCircleOfHall(E.h);
    if (!at?.slot || !E.seed || !(c > 0)) return null;
    const h = (c - 1) * 5 + at.slot;
    return { h, spec: egHallOf(E.seed, h, E.geo ?? 0), at };
  }
  /** THE HALL'S REVERB: held while I stand in the breach; the hall my feet stand in made behind the veil as it changes (a
   *  swap, a pull), and turned at a fragment's mouth as I walk. */
  function reverbFrame(E) {
    reverb.hold();
    const H = feetHall(E);
    if (!H) return;
    reverb.hall(`${E.b}:${H.h}`, H.spec);
    reverb.at(egLocalX(H.spec, H.at.sx), H.at.z);
  }
  /** THE FRAGMENT'S OWN CLAMP (section 11.7): while I stand in a fragment and no other arena holds my motor (a duel's ring,
   *  a court's floor - the world host sets those first each frame), its zone is my arena: its walls hold my feet, its
   *  ceiling my head, its open edges let me go. A witness's body is held elsewhere and takes none. */
  function clampFrame(E) {
    if (!player || (player.arena && player.arena !== fragArena)) { fragArena = null; return; }
    const H = witness ? null : feetHall(E);
    fragArena = H && player.pos ? egFragArena(H.spec, player.pos) : null;
    player.arena = fragArena;
  }
  /** The fragment's clamp taken back off my motor - only my own (another's arena is never mine to clear). */
  function clampAway() {
    if (player && fragArena && player.arena === fragArena) player.arena = null;
    fragArena = null;
  }
  /** EG-ZN - THE SHAFT'S LEDGE (section 11.8): the way down a shaft faces while my feet stand on its rim or a flight above
   *  its Drop's landing (world/eliteGates/egHall.js egShaftLedgeAt), else null. The camera judges the facing (player/mwView.js). */
  function shaftWay(E) {
    const H = feetHall(E);
    return H && player?.pos ? egShaftLedgeAt(H.spec, player.pos) : null;
  }

  // ── the witness (section 16.5) ──────────────────────────────────────────────────────────────────────────
  /** THE FALL: the body put away under the hall (no blow reaches it, the void never casts it back), the room told, the
   *  camera handed to a living member. EG-ZD (section 16.5): THE FALL, my own screen (ui/eliteGates/egSpireHud.js egFallModel - the eye
   *  sinking where I fell, the colour drained, the card with whether a Redoubt can call me back and the Reliquaries lost,
   *  the witness view dithered in), once a fall: a fall whose screen this device saw (a reload's return) is not shown again.
   *  `fin` the room's word that it is final (its `fall`), else read off my row. */
  function enterWitness(t, said, fin = null) {
    const E = link.state();
    if (witness || !inSpire()) return;
    const mine = egMemberOf(E, me());
    const counted = !!mine && !mine.alive, falls = mine?.falls ?? 0, n = counted ? falls : falls + 1;
    const final = fin != null ? !!fin : !mine?.recall || n >= 2;
    const seen = wayBack?.b === E.b && wayBack.wf >= n;
    witness = { at: t, idx: 0, watched: null, hold: null, fell: seen ? -Infinity : t, fall: seen ? null : { at: t, final, lost: relHeld, eye: Array.isArray(cam?.pos) ? [...cam.pos] : null } };   // AUDIT EG V (c, L7-13): `fell` the fall the score ends on - a fall this device saw already (a return) none
    if (wayBack?.b === E.b && n > wayBack.wf) { wayBack.wf = n; backKeep(true); }
    // AUDIT WORLD-EVENTS L1-4 - RAISE BEFORE THE FALL (net/eliteGates/egBrain.js egLayDown): my body lies where I fell while the
    // room keeps me down (`downPose` - every screen's corpse, a party member's Resurrect's mark), the witness's eye mine
    // meanwhile; a death of my own with a companion standing is down at once, the room's word deciding (`down`, its `fall`)
    const lastPose = online()?._pose ?? null;   // the frame my pose speaks in (the world host's `_deadMark`'s)
    witness.spot = lastPose && Number.isFinite(lastPose.x) ? [lastPose.x, lastPose.y ?? 0, lastPose.z] : null;
    if (!said && mine?.alive && witness.spot && E.co.some((c) => c[0] !== me() && c[3] === 1 && c[4] === 0 && c[5] === 1)) lieDown(t + EG_DOWN_MS);
    if (mine?.alive && !said) online()?.sendEg?.('fell');
    entity.health = Math.max(1, entity.maxHealth ?? 1);
    const spec = E.h > 0 ? egHallOf(E.seed, E.h, E.geo ?? 0) : null;
    if (spec?.arrive) { const p = egToDungeon(spec, spec.arrive.x, spec.arrive.y - 60, spec.arrive.z); witness.hold = p; }
    pres.live = `${EG_FALL_TEXT.main}. ${final ? EG_FALL_TEXT.final : EG_FALL_TEXT.first}`;   // EG-ZD: the card's words for a screen reader (the card itself is aria-hidden)
    // AUDIT EG V (c, L7-8): the recap's strip marks this fall as it marks every member's - off the room's own count (logFrame)
  }
  /** AUDIT WORLD-EVENTS L1-4: lying down until `until` (the shared clock) - the fall's card says a party member can raise me,
   *  and how to give it up. */
  function lieDown(until) {
    if (!witness) return;
    witness.down = until;
    if (witness.fall) witness.fall.down = until;
    mid(t('eg.down', 'You are down. A party member can raise you within {s} seconds. Enter: give up.', { s: Math.max(1, Math.round((until - now()) / 1000)) }));
  }
  /** AUDIT WORLD-EVENTS L1-4: where my body lies while I am down, for my pose (net/online.js `poseDown`), else null. */
  const downPose = () => (witness?.down && witness.spot ? witness.spot : null);
  /** EG-H1 - THE RELAY'S COUNT HAS FALLEN ME (`bd`, net/bossBody.js - enforced in the Spire, section 21): in the Spire a fall,
   *  never a death - the witness begins (the room made it the breach's fall: its `fall` word follows, so nothing is said back),
   *  as the Hour's bossCountFell is its one life. Heard outside the Spire, nothing. */
  function countFell() {
    if (!inSpire() || witness) return;
    mid(EG_COUNT_FELL_TEXT);
    enterWitness(now(), true);
  }
  /** EG-H1 - RIDDEN POSES (section 10.8): my pose's `pl` while my feet stand on a moving piece of the hall I am in (net/eliteGates/egFair.js
   *  egRideOf, at the shared clock), else null - net/online.js sendPose lays it on the pose (`poseRide`). */
  function ridePl() {
    const E = link.state();
    if (!inSpire() || witness || !(E.h > 0) || !player?.pos) return null;
    const at = standing();
    if (!at || at.slot !== egSlotOfHall(E.h)) return null;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0), y = dungeonToRealm(player.pos[0], player.pos[1], player.pos[2])[1];
    return egRideOf(spec, egLocalX(spec, at.sx), y, at.z, now() / 1000);
  }
  /** EG-H1 - A PEER'S RIDDEN POSE drawn on its piece at MY shared clock plus its offset (net/online.js `rideAt`, on the peer's
   *  drawn place, moved in place) - a rider never floats beside a swinging platform. A peer in another hall is left alone.
   *  EG-ZL (section 10.8): a peer on no ride is told to the spans, never moved - standing on a Crumble I have seen fall, it
   *  is drawn on a ghost slab (scenes/eliteGates/egSpan.js peerOn). */
  function rideDraw(q) {
    const E = link.state();
    if (!inSpire() || !(E.h > 0) || !q) return;
    if (!Array.isArray(q.pl)) { modes()?.dungeonCtx?.egSpanPeer?.(q.x, q.y ?? 0, q.z); return; }
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
    if (egSlotAt(dungeonToRealm(q.x, q.y ?? 0, q.z)[0]) !== egSlotOfHall(E.h)) return;
    const r = egRideAt(spec, q.pl, now() / 1000);
    if (!r) return;
    const [x, y, z] = egToDungeon(spec, r[0], r[1], r[2]);
    q.x = x; q.y = y; q.z = z;
  }
  /** A witness's frame: the body held where it is put away; whom it watches kept to a living member. */
  function witnessFrame(E) {
    if (witness.hold && player?.pos) { player.pos[0] = witness.hold[0]; player.pos[1] = witness.hold[1]; player.pos[2] = witness.hold[2]; player.velY = 0; player._airVelX = 0; player._airVelZ = 0; player.falling = false; player.fallStart = player.pos[1]; }
    const living = E.co.filter((c) => c[0] !== me() && c[3] === 1 && c[4] === 0 && c[5] === 1);
    if (!living.length) { witness.watched = null; return; }
    if (!living.some((c) => c[0] === witness.watched)) witness.watched = living[witness.idx % living.length][0];
  }
  /** THE RECALL's word for me: stood where it calls me, at its share of my health. */
  function riseAt(w) {
    const E = link.state();
    witness = null;
    const spec = egHallOf(E.seed, w.h, E.geo ?? 0);
    const at = egToDungeon(spec, w.x, 0.2, w.z);
    modes()?.egPlace?.(at, 0);
    entity.health = Math.max(1, Math.round((entity.maxHealth ?? 1) * w.p));
    mid(w.by ? t('eg.raised', '{name} raises you.', { name: w.by }) : w.p >= 1 ? 'The Redoubt calls you back.' : 'A Memento calls you back.');   // AUDIT WORLD-EVENTS L1-4: a party member's Resurrect
  }
  /** The room's heal (a rest, a Rally, a Mending, the Scriptorium; the fray's lash negative): its share of my health, and
   *  at a rest my magicka and fatigue too. A lash is a setback through the hurt door, never a death. EG-ZS: LIVING WALL - a
   *  heal its share more while I stand in it on my screen (wall), as the census counts it (net/eliteGates/egBrain.js egWallOf). */
  function applyHeal(p, why) {
    if (witness || !(entity.health > 0) || !inSpire()) return;
    if (why === 'rest' && p >= 1) { fillVitalSigns(entity); return; }
    // AUDIT EG V (c, L2-9; section 16.3 - "health, magicka and fatigue restored ... half under Ashen Vigil"): a rest that heals
    // less than whole (Ashen Vigil, its rank II, the Hungering Dark) gives magicka and fatigue back by the same share, the
    // health by the heal's own way below
    if (why === 'rest' && p > 0) egRestVitals(entity, p);
    if (why === 'tonic' && p > 0 && entity.maxMagicka > 0) entity.magicka = Math.min(entity.maxMagicka, (entity.magicka ?? 0) + Math.round(p * entity.maxMagicka));   // AUDIT EG III (lane1 #5): A SPIRE TONIC restores its share of magicka too (section 17.1)
    if (p > 0 && wall()) p *= 1 + EG_WALL_X;
    if (heal) { heal(p, why); return; }
    const max = entity.maxHealth ?? 0;
    if (p < 0) { const cut = Math.min(Math.round(-p * spireBodyMax(entity)), entity.health - 1); if (cut > 0) hurt(cut); return; }   // EG-ZR: of the body without Stoneskin's cushion
    entity.health = Math.max(1, Math.min(max, Math.round(entity.health + p * max)));
  }

  /** EG-ZR (section 15): THE HOLDER on this screen - my run's Vestiges and Mastery, the breach and its hall - while I stand
   *  alive in the breach the room counts me in (systems/eliteGates/spireVestiges.js spireHolderStep); null otherwise: out of the
   *  Spire, a witness, gone home, the breach ended. */
  function holderNow() {
    if (!inSpire() || witness) return null;
    const E = link.state();
    // AUDIT EG III (lane4 #10): the holder made again only when the room's word, or Long Step's, moved - never every frame
    if (holderMade.E === E && holderMade.ls === lsSeq) return holderMade.h;
    holderMade.E = E; holderMade.ls = lsSeq; holderMade.h = null;
    const m = egMemberOf(E, me());
    if (!E.b || E.end || !m?.in || !m.alive || m.home) return null;
    const run = egRunOfMember(E, me());
    // EG-ZS: RALLYING CRY - the hall's door's instant (the room's `dn`, 0 before it opens) and whether a living member of the
    // company resonates in Fellowship
    const cry = (E.co ?? []).some((c) => { const q = egMemberOf(E, c[0]); return !!q?.in && q.alive && !q.home && egResonance(egRunOfMember(E, c[0]).vs).includes('fellowship'); });
    return (holderMade.h = { vs: run.vs, mast: run.mast, b: E.b, h: E.h | 0, dn: E.dn ?? 0, cry, ls: longStepOn(E) });   // AUDIT EG III (lane1 #5): and Long Step's half second
  }
  /** AUDIT EG III (lane4 #10): the holder as last made, and the room's state and Long Step's word it was made from. */
  const holderMade = { E: null, ls: -1, h: /** @type {any} */ (null) };
  /** AUDIT EG III (lane1 #5) - LONG STEP (section 17.2: "your crumbles wait +0.5 s for one span (private, as crumbles are)"):
   *  the Cantrip's word to me (`egot` `longstep`) holds for one span - the hall the company stands in when it is used if that
   *  hall lays a crumble, else the next of the breach that does (`{ b, h }`); `lsSeq` counts its words (the holder's memo). */
  let longStep = /** @type {{ b: string, h: number } | null} */ (null), lsSeq = 0;
  function longStepHeard(E) {
    if (!E.b || !(E.h > 0)) return;
    let h = E.h;
    for (let k = E.h; k < E.h + EG_LONG_STEP_LOOK; k++) if (egHallOf(E.seed, k, E.geo ?? 0).steps?.some((s) => EG_CRUMBLE_KINDS.includes(s.kind) || s.kind === 'sink')) { h = k; break; }
    longStep = { b: E.b, h }; lsSeq++;
  }
  /** Whether Long Step holds in breach `E` now: its span not yet behind the company. */
  const longStepOn = (E) => !!longStep && longStep.b === E.b && E.h <= longStep.h;
  /** EG-ZS - LIVING WALL on my screen (section 15's Accord, Stoneskin with Mender's Grace: "heals on the Stoneskin holder +10%"):
   *  I hold Stoneskin within 10 m of a living companion holding Mender's Grace where my screen draws us (scenes/eliteGates/egFight.js
   *  accordMates - the pair law, net/eliteGates/egVestige.js egAccordMates). */
  const wall = () => (fight?.accordMates?.('livingwall', 'a')?.length ?? 0) > 0;

  // ── THE PUSH, THE CAGE AND THE RING (section 9.3: "applied by the struck client as the Steps' gust is") ────────────
  /** a push owed: its unit way in the hall's frame (the dungeon's axes - world/eliteGates/egHall.js egToDungeon) and metres left */
  let pushX = 0, pushZ = 0, pushLeft = 0, pushAt = 0;
  /** Iron Footing's share off a push (net/eliteGates/egVestige.js - by: 'client'). EG-ZR: the whole of it while I stand Immovable
   *  (section 15: "pushes do nothing until you move" - the fight's `immovable`, the census's own stillness). EG-ZS: and while I
   *  resonate in Stone - ROOTED, "immune to push" (Stone's capstone; its threat is the relay's - net/eliteGates/egRun.js egThreatX). */
  const footing = () => { const vs = egRunOfMember(link.state(), me()).vs; return fight?.immovable?.() || egResonance(vs).includes('stone') ? 1 : egVOf(vs, 'ironfooting'); };
  /** A push of `m` metres along (dx, dz), carried out at the Steps' breath's speed by the collider's own move (scenes/
   *  sdSteps.js's - no edge stops it: near one it is a cast-back). */
  function pushBy(dx, dz, m) {
    if (witness || !inSpire() || !(m > 0) || !Number.isFinite(dx) || !Number.isFinite(dz)) return;
    const L = Math.hypot(dx, dz);
    if (!(L > 1e-6)) return;
    const take = Math.max(0, 1 - footing());
    pushX = dx / L; pushZ = dz / L; pushLeft = Math.min(EG_PUSH_MAX_M, m * take); pushAt = now();
  }
  function pushStep() {
    if (!(pushLeft > 0) || !player?.collider?.move || !player.pos) { pushLeft = 0; return; }
    const t = now(), dt = Math.min(EG_PUSH_DT_MAX, Math.max(0, (t - pushAt) / 1000));
    pushAt = t;
    const step = Math.min(pushLeft, EG_PUSH_MPS * dt);
    if (!(step > 0)) return;
    player.collider.move(player.pos, pushX * step, 0, pushZ * step, player.height, !!player.grounded && !player.jumping);
    pushLeft -= step;
  }
  /** A cage holds me (the motor's own settle - no move, no fall, for `ms`). */
  function holdFor(ms) {
    if (witness || !inSpire() || !player) return;
    player.freezeMotor = Math.max(player.freezeMotor || 0, Math.min(1, ms / 1000));
  }
  /** A challenge's ring (the hall's frame): the challenged kept inside its rim, everyone else kept out of it. */
  function ringKeep(x, z, r, inside) {
    if (witness || !inSpire() || !player?.pos) return;
    const E = link.state(), at = standing();
    if (!at || !(E.h > 0) || !(r > 0)) return;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0), lx = egLocalX(spec, at.sx), d = Math.hypot(lx - x, at.z - z);
    const rim = inside ? r - EG_RING_PAD : r + EG_RING_PAD;
    if (inside ? d <= rim : d >= rim) return;
    const ux = d > 1e-6 ? (lx - x) / d : 1, uz = d > 1e-6 ? (at.z - z) / d : 0;
    const q = egToDungeon(spec, x + ux * rim, 0, z + uz * rim);
    player.pos[0] = q[0]; player.pos[2] = q[2]; player._airVelX = 0; player._airVelZ = 0;
  }

  // ── EG-G1: THE HUD, THE BEATS AND THE FIRST BREACH (section 27) ────────────────────────────────────────────
  /** the beats' watch, the device's first-time bits, the warnings said this breach, who is unseen, the perils and the
   *  Beat already pulsed, a gain in flight, a teaching line, the live line, the arrival card, the pad's choice, the
   *  folded decrees, the recap's Reliquaries opened so far */
  const pres = { memo: egBeatMemo(), acct: /** @type {number|null} */ (null), shown: 0, said: new Set(), b: null, absent: new Map(), perils: new Set(), perilH: 0, beatCycle: -1,
    gain: null, first: '', firstAt: 0, live: '', card: null, cardH: 0, cardAt: 0, cardFirst: true, prevSp: -1, focus: 0, foldOpen: false, rel: 0, relAt: 0, touch: /** @type {boolean|null} */ (null),
    pingAt: 0, sightH: 0,   // EG-ZE: the newest ping heard, the hall the witness's sight was said for
    restP: /** @type {{ b: string, h: number, p: number }|null} */ (null) };   // AUDIT EG V (c, L2-9): the rest's heal share, the room's word
  /** How long a teaching line stands under the objective (ms). */
  const FIRST_SHOW_MS = 9000;
  /** AUDIT EG III: the holder's watch (ui/eliteGates/egBeats.js egHolderWatch). */
  const holdMemo = egHolderMemo();
  const playSound = (S) => { if (!S?.rec && S?.rec !== 0) return; try { bus().beat(S); } catch { /* a sound is never the breach */ } };   // EG-ZD (section 26): on THE SPIRE MIX's critical bus
  /** One beat (section 27.5): its sound, its line on the screen and in the chat where nobody says it already. */
  function beatNow(k, w = {}) {
    const plan = egBeatPlan(k, w);
    playSound(plan.sound);
    if (plan.screen) mid(plan.screen);
    if (plan.chat) say(plan.chat);
    const words = plan.screen ?? plan.chat;
    if (words) pres.live = words;
    return plan;
  }
  /** EG-ZF (section 27.7): THE FIRST-TIME BITS IN FORCE - the account's over the device's, with what this screen showed. */
  /** AUDIT EG V (c, L7-23): the device's bits for the account signed in (its own key - another account on this device never
   *  silences mine), with the device's own (the lines shown with no account, and every line before the accounts' keys). */
  const firstDevice = () => egFirstRead(store, egFirstKey(me())) | egFirstRead(store);
  const firstBits = () => egFirstOver(firstDevice(), pres.acct, pres.shown);
  /** EG-ZF: lines newly shown - kept on the device, and told the account (signed in: the service ORs them, so a word lost
   *  is carried by the next, or by the next balance's answer - AUDIT EG V (c, L7-23): or, past a reload, by the device's). */
  function firstShown(fresh) {
    pres.shown |= fresh;
    egFirstWrite(store, firstDevice() | fresh, egFirstKey(me()));
    tellFirst();
  }
  async function tellFirst() {
    if (!me() || account?.guest?.() || typeof account?.first !== 'function') return;
    try { const a = await account.first(firstBits()); if (a?.ok && Number.isSafeInteger(a.data?.first) && a.data.first >= 0) pres.acct = a.data.first; } catch { /* told again with the next line */ }
  }
  /** THE FIRST BREACH: each line due, once an account (EG-ZF - once a device where no account answers) - in the chat and
   *  under the objective. */
  function teach(keys) {
    if (!keys.length) return;
    const before = firstBits(), { due, bits } = egFirstDue(before, keys);
    if (!due.length) return;
    firstShown(bits & ~before);
    for (const line of due) say(line);
    pres.first = due.at(-1); pres.firstAt = now(); pres.live = pres.first;
  }
  function castBackBeat(cost, share = EG_CAST_BACK_LOSS) {
    if (cost) beatNow('castBack', { t: EG_PRES_TEXT.castBackCost(share) }); else playSound(EG_BEAT_SOUNDS.rewind);   // EG-ZR: Featherstep's cost said as it is
    teach(['void']);
  }
  /** EG-ZI (section 10.6): THE PULL'S TOLL, paid as the void's cost is (castBack): `q` quarters of the road I did not cross,
   *  EG_TOLL_STEP of my health each, through the hurt door and never the last of it; said with the pull (section 27.5's
   *  row: *The Spire pulls you down.* and the toll) - its share on the screen and its line in the chat, once a hall. */
  let tollH = 0;
  function payToll(q, h) {
    if (witness || !(entity.health > 0) || !inSpire() || h === tollH) return;
    tollH = h;
    const cut = Math.min(Math.round(q * EG_TOLL_STEP * spireBodyMax(entity)), entity.health - 1);   // EG-ZR: of the body without Stoneskin's cushion
    if (!(cut > 0)) return;   // AUDIT EG III: nothing taken, nothing said
    hurt(cut);
    playSound(EG_BEAT_SOUNDS.toll);   // AUDIT EG V (c, L7-16; the PR's "the toll" has its sound): the bell's toll, as the count's warnings ring it
    const took = cut / (entity.maxHealth || 1);   // AUDIT EG III: said as what it took of the health bar
    mid(EG_PRES_TEXT.toll(took));
    say(EG_PRES_TEXT.tollLine(took));
    pres.live = EG_PRES_TEXT.tollLine(took);
  }
  /** The recap's Reliquaries open one each 400 ms, each with the Rare chime (section 27.6); the run kept. */
  function recapOpened() { pres.rel = 0; pres.relAt = Date.now(); egRecapKeep(store, recap); }
  /** My feet in the hall's frame, or null. */
  function feetInHall(E) {
    const at = standing();
    if (!at || !(E.h > 0) || at.slot !== egSlotOfHall(E.h)) return null;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0), y = dungeonToRealm(...player.pos)[1];
    return { spec, x: egLocalX(spec, at.sx), y, z: at.z };
  }
  /** EG-ZE: THE LIGHTS this frame (world/eliteGates/egLights.js egSpireLights - none outside the halls) in the shelf's palette and
   *  reduced motion, with each pinger's own height in the hall's frame (mine, and the company's poses) so a ping stands
   *  on the floor it was said from. Asked by the draw alone, in the Spire. */
  function lightsNow() {
    const E = link.state();
    let ys = null;
    if (E.pings?.length) {
      ys = new Map();
      if (player?.pos && !witness) ys.set(me(), dungeonToRealm(player.pos[0], player.pos[1], player.pos[2])[1]);
      for (const q of peers()) if (q?.pos) ys.set(q.sub, dungeonToRealm(q.pos[0], q.pos[1], q.pos[2])[1]);
    }
    return egSpireLights(E, now(), { witness: !!witness, still: stillNow(), palette: egAccessNow(win).palette, ys });
  }
  /** EG-ZE: where a ping is said from, in the hall's frame - my feet; a witness's at the member it watches (its own body
   *  is held under the hall, so its ping stood on the arrival plate whatever it watched), or the plate with nobody to
   *  watch. */
  function pingPlace(E) {
    if (!(E.h > 0)) return null;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
    const q = witness?.watched ? peers().find((p) => p.sub === witness.watched) : null;
    if (q?.pos) { const [sx, , z] = dungeonToRealm(q.pos[0], q.pos[1], q.pos[2]); return { x: egLocalX(spec, sx), z }; }
    const at = standing();
    return at ? { x: egLocalX(spec, at.sx), z: at.z } : null;
  }
  /** The choices the pad moves among. AUDIT EG V (c, L7-3; section 27.8 - "the panel, the votes and the Surplus work on touch
   *  and gamepad"): EVERY choice the panel shows, in its order - the offer's cards and a Surplus's two buttons (EG-ZD), then
   *  each open choice's options (the decrees, the Ready, the respite, a Bargain): the director opens the offer and every ask
   *  of a rest in one beat, and the pad reached only the cards, then only the newest ask. `items` each `{ k: 'card', v }`,
   *  `{ k: 'surplus', use }` or `{ k: 'opt', q, y }`. */
  function choices(E) {
    const items = [];
    const cards = E.offer?.v?.length ? E.offer.v.length : 0;
    if (cards) { for (const v of E.offer.v) items.push({ k: 'card', v }); if ((E.sp ?? 0) > 0) items.push({ k: 'surplus', use: 0 }, { k: 'surplus', use: 1 }); }
    for (const a of (E.as ?? []).filter((q) => q[2] > now())) egAskText(a[0], a[1]).opts.forEach((_, y) => items.push({ k: 'opt', q: a[0], y }));
    return { n: items.length, cards, items };
  }
  const padCtx = () => { const E = link.state(); return { recap: !!recap, panel: inSpire() && !E.end && choices(E).n > 0, witness: inSpire() && !!witness, bridge: bridgeGap() >= 0 }; };
  const hudScaleNow = () => { try { return /** @type {any} */ (globalThis.document?.querySelector?.('.hud'))?.style?.getPropertyValue?.('--hud-scale') || ''; } catch { return ''; } };
  const rgbCss = (c) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
  /** AUDIT EG V (c, L7-7; section 16.5): the member a witness watches - their numeral and name (the room's row) and their
   *  health's share (the party's pose of them - `party`'s `h` and `hm`), or null. */
  function watchedOf(E) {
    const m = witness?.watched ? egMemberOf(E, witness.watched) : null;
    if (!m) return null;
    const p = (party() ?? []).find((q) => q?.sub === witness.watched);
    return { numeral: EG_NUMERALS[m.n] ?? '', name: m.name, pct: p && p.hm > 0 && Number.isFinite(p.h) ? Math.max(0, Math.min(100, (p.h / p.hm) * 100)) : null };
  }
  /** One frame of the Spire's presentation (after the halls' and the fight's). */
  function presFrame(E, t) {
    if (pres.b !== E.b) { pres.b = E.b; pres.said = new Set(); pres.cardFirst = true; pres.cardH = 0; pres.prevSp = -1; pres.absent = new Map(); }
    // THE BEATS and the first-time lines they bring due
    const { beats, firsts, runes } = egBeatWatch(pres.memo, E, me());
    for (const pt of runes) { playSound(egRuneChime(pt)); pres.live = `Rune ${EG_NUMERALS[pt] ?? pt}`; }   // THE EXAMINATION HEARD (section 25.7)
    for (const b of beats) {
      beatNow(b.k, b);
      if (b.k === 'redoubt' && E.redoubt) { const text = egGainText(E.redoubt, { press: egPressInForce(E), leftAfter: E.redoubt.cl ?? 0, lastWordLeft: E.op + EG_LAST_WORD_MS - (E.redoubt.at ?? t) }); if (text) pres.gain = { text, at: t }; }
      if (b.k === 'goldRun') pres.gain = { text: EG_PRES_TEXT.gain('1:00', ''), at: t };
    }
    teach(firsts);
    // EG-ZE: THE COMPANY'S WORD HEARD - a chime as a ping is newly said (sections 16.4 and 16.5); THE WITNESS'S SIGHT - the
    // next hall's twist, said once a hall to a witness
    let pinged = false;
    for (const q of E.pings ?? []) if (q.at > pres.pingAt) { pres.pingAt = q.at; pinged = true; }
    if (pinged) playSound(EG_BEAT_SOUNDS.chime);
    if (witness && E.h > 0 && pres.sightH !== E.h) { pres.sightH = E.h; const line = egWitnessTwist(E); if (line) { say(EG_LIGHTS_TEXT.sight(line)); pres.live = EG_LIGHTS_TEXT.sight(line); } }
    if (pres.prevSp >= 0 && (E.sp ?? 0) > pres.prevSp) pres.gain = { text: EG_PRES_TEXT.surplus, blue: true, at: t };
    pres.prevSp = E.sp ?? 0;
    // THE REHEARSAL's teaching, once an account (EG-ZF - a device where none answers)
    if (E.rh && E.wk > 0 && E.sg === 'trial') {
      const before = firstBits(), r = egRehearsalDue(before);
      if (r.line) { firstShown(r.bits & ~before); say(r.line); pres.first = r.line; pres.firstAt = t; }
    }
    // THE COUNT CHIP's warnings, each once a count
    for (const k of egChipWarnings(pres.said, E, t)) {
      const W = EG_CHIP_WARNINGS[k];
      if (W.toll) playSound(EG_BEAT_SOUNDS.toll);
      if (W.words) { const line = W.words(); mid(line); say(line); pres.live = line; }
    }
    // THE ARRIVAL CARD
    if (E.h > 0 && E.h !== pres.cardH && (E.sg === 'arrive' || E.sg === 'trial')) { pres.cardH = E.h; pres.cardAt = t; pres.card = egArrivalCard(E, { first: pres.cardFirst }); pres.cardFirst = false; if (pres.card) pres.live = egArrivalLive(pres.card); }   // EG-ZS: the card's words, the Markynaz's decree with them
    const acc = egAccessNow(win);
    drawEgArrivalCard(egArrivalShown(pres.card, pres.cardAt, t), { hidden: hudHidden(), still: acc.still });
    // EG-ZD (section 16.5): THE FALL, my own screen - until the witness view stands
    if (witness?.fall && t - witness.fall.at >= EG_FALL_MS) witness.fall = null;
    drawEgFall(witness?.fall ? egFallModel(witness.fall, t, { still: acc.still }) : null, { hidden: hudHidden(), danger: rgbCss(acc.palette.danger) });
    // THE PARTY ROWS' absent ring: who of the company this screen holds no pose of
    pres.absent = egAbsentStep(pres.absent, E, me(), new Set(peers().map((q) => q.sub)), t);
    // THE TOUCH OF IT: the Beat underfoot in its last 0.4 s, a blow newly aimed at my feet
    const F = feetInHall(E);
    const buzzOn = !!getPref('touchHaptics');
    if (pres.perilH !== E.h) { pres.perilH = E.h; pres.perils.clear(); }
    if (F && !witness) {
      const cyc = egBeatUnder(F.spec, F.x, F.y, F.z, t / 1000);
      if (cyc >= 0 && cyc !== pres.beatCycle) { pres.beatCycle = cyc; egBuzz('beat', { on: buzzOn }); }
      if (E.fight?.h === E.h && egPerilsNew(E.fight.blows, F.x, F.z, pres.perils, t).length) egBuzz('peril', { on: buzzOn });
    }
    // THE DOOR's marker, while the way down stands open
    const door = F && E.sg === 'closing' && F.spec.end && !witness ? egDoorMarker({ x: F.x, z: F.z }, F.spec.end, cam?.yaw ?? 0) : null;
    // THE HUD
    const ff = egFormFactor({ w: win?.innerWidth ?? 1280, h: win?.innerHeight ?? 720 });
    const P = choices(E);
    pres.focus = P.n > 0 ? Math.min(pres.focus, P.n - 1) : 0;
    // AUDIT EG III (sections 15 and 27.5): THE VESTIGES SEEN, HEARD AND SAID - the holder's news (Second Wind, Spellweave's free
    // spell, Rallying Cry's refresh), and the holder's chips with the beats they bring (a window opened, an Accord formed or lapsed)
    for (const n of spireVestigeNews()) beatNow(n.k, n);
    const held = egHolderWatch(holdMemo, egHolderNow(witness ? null : fight, E, me(), spireWeaveReady()), t, E.h);
    for (const b of held.beats) beatNow(b.k, b);
    const model = egSpireHudModel(E, me(), t, { ff, witness: !!witness, potions, gain: pres.gain && t - pres.gain.at < EG_GAIN_MS ? pres.gain : null,
      first: pres.first && t - pres.firstAt < FIRST_SHOW_MS ? pres.first : '', door, live: pres.live, touch: pres.touch ??= isTouchDevice(win), foldOpen: pres.foldOpen, held: held.chips, bridge: bridgeGap() >= 0,   // AUDIT EG III: Spirebridge offered
      watch: witness ? watchedOf(E) : null, ping: witness ? pingLeft() : 0, restP: pres.restP?.b === E.b && pres.restP.h === E.h ? pres.restP.p : 1 });   // AUDIT EG V (c, L7-7, L2-9): the witness's seat; the rest's heal
    drawEgSpireHud(model, { hidden: hudHidden(), skin: isEnhanced() ? 'enhanced' : 'classic', still: acc.still, danger: rgbCss(acc.palette.danger), scale: hudScaleNow(),
      onTouch: (id) => touchAct(id), onFold: () => { pres.foldOpen = !pres.foldOpen; } });
  }
  /** Out of the halls: the HUD and the card put away. */
  function presAway() { drawEgSpireHud(null); drawEgArrivalCard(null); drawEgFall(null); }   // EG-ZD: and THE FALL
  /** A d-pad press while it is the Spire's (the pad's own codes on the classic skin, the prompt bar's gestures on Plus). */
  function padGesture(dir, kind) {
    const ctx = padCtx(), act = egPadAct(dir, kind, ctx);
    if (!act) return false;
    const E = link.state(), o = online();
    if (act.k === 'close') { recap = null; drawEgPanel(null); return true; }
    if (act.k === 'watch') { watchStep(act.d); return true; }
    if (act.k === 'forsake') { api.command('forsake'); return true; }
    if (act.k === 'ping') { pingSay(0); return true; }   // AUDIT EG V (c, L7-7): a witness's ping, the pad's up
    if (act.k === 'bridge') return bridgeAsk();   // AUDIT EG III: Spirebridge, the pad's up
    const P = choices(E), it = P.items[pres.focus];
    if (act.k === 'focus' && P.n > 0) { pres.focus = (pres.focus + act.d + P.n) % P.n; return true; }
    if (act.k === 'take' && it?.k === 'surplus') { o?.sendEg?.('surplus', { use: it.use }); return true; }   // EG-ZD: a fourth card (0) or a reroll (1)
    if (act.k === 'take' && it?.k === 'card') { o?.sendEg?.('pick', { v: it.v }); return true; }
    if (act.k === 'take' && it?.k === 'opt') { voted[it.q] = it.y; o?.sendEg?.('vote', { q: it.q, y: it.y }); return true; }   // AUDIT EG V (c, L7-3): the choice the focus stands on
    if (act.k === 'no' && it?.k === 'opt' && YES_NO_ASKS.includes(it.q)) { voted[it.q] = 0; o?.sendEg?.('vote', { q: it.q, y: 0 }); return true; }   // the focused yes-or-no answered no
    if (act.k === 'no') return api.vote('no');
    return false;
  }
  /** AUDIT EG V (c, L7-7): the witness's eye moved `d` along the living (Q and E, the pad's shoulders and its left and
   *  right, the touch layer's two). */
  function watchStep(d) { if (witness) { witness.idx += d; if (witness.idx < 0) witness.idx += 8; witness.watched = null; } }
  /** A touch button (section 27.8): the witness's eye, forsaking, the way home. AUDIT EG V (c, L7-7): and a witness's ping. */
  function touchAct(id) {
    if (id === 'prev' || id === 'next') { watchStep(id === 'next' ? 1 : -1); return true; }
    if (id === 'ping') { pingSay(0); return true; }
    if (id === 'forsake') { api.command('forsake'); return true; }
    if (id === 'home') return api.wayHome();
    if (id === 'bridge') return bridgeAsk();   // AUDIT EG III
    return false;
  }
  // ── AUDIT EG III (section 15): SPIREBRIDGE ASKED ──────────────────────────────────────────────────────────────────
  /** When I last asked it (my clock - an answer is a round trip away; a refusal lets me ask again after it). */
  let bridgeAskedAt = -Infinity;
  /** Why my Spirebridge may not be asked now ('' it may): not held, spent this span, no gap ahead. */
  function bridgeWhy() {
    const E = link.state();
    if (!inSpire() || witness || E.end || !(E.h > 0) || egRunOfMember(E, me()).mast !== EG_SPIREBRIDGE_ID) return EG_PRES_TEXT.bridgeNot;
    if (E.sg !== 'trial' && E.sg !== 'closing') return EG_PRES_TEXT.bridgeNone;
    if ((E.fight?.bridges ?? []).some((q) => q.h === E.h && q.s === me())) return EG_PRES_TEXT.bridgeSpent;
    return '';
  }
  /** The gap my Spirebridge would span now (its number in the hall's chain - the room's own reading of my feet), or -1. */
  function bridgeGap() {
    if (bridgeWhy() || Date.now() - bridgeAskedAt < 1000) return -1;
    const F = feetInHall(link.state());
    return F ? egBridgeAhead(F.spec, F.x, F.z) : -1;
  }
  /** Ask it (`mast`): the room picks the gap from my pose and says the plank to the company. */
  function bridgeAsk() {
    const why = bridgeWhy();
    if (why) { say(why); return true; }
    if (Date.now() - bridgeAskedAt < 1000) return true;
    if (bridgeGap() < 0) { say(EG_PRES_TEXT.bridgeNone); return true; }
    bridgeAskedAt = Date.now();
    return !!online()?.sendEg?.('mast');
  }

  // ── EG-ZF (section 27.6): THE RECAP WHOLE - the lord's fall's chart, the healing, the board's line ──────────────────
  /** THE DAMAGE CHART AT A LORD'S FALL - the gate's own (ui/gate/gateDamageChart.js), its crystals' column the lord's part, from
   *  a beat after the fall for DAMAGE_CHART_MS, a readout to the side; the next fall's in its place; put away when its time
   *  is up, or with the breach. Drawn from the online frame in every mode (an end's chart outlives the walk out). */
  let chart = null, chartFor = null;
  function chartFrame(E) {
    const C = E.chart;   // a new fall's chart is a new word (net/eliteGates/egLink.js folds each `rd` and end into its own)
    if (C && C !== chartFor) {
      chartFor = C;
      const spec = egHallOf(E.seed, C.h, E.geo ?? 0), L = EG_LORDS[spec.lord];
      chart = { at: Date.now(), fell: egChartFell(E), lord: L?.name ?? EG_TEXT.name, plural: spec.lord === 'twins', me: egMemberOf(E, me())?.name ?? null };
    }
    if (!chart) return;
    const model = damageChartModel(chart.fell, { boss: chart.lord, me: chart.me, since: chart.at, now: Date.now(), crystals: EG_PRES_TEXT.chartLord });
    if (model) model.sub = EG_PRES_TEXT.chartSub(chart.lord, chart.fell?.n ?? 0, chart.plural);
    drawGateDamageChart(model, { hidden: hudHidden() });
    if (!model && Date.now() - chart.at >= DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS) { chart = null; drawGateDamageChart(null); }
  }
  function chartAway() { if (chart) { chart = null; drawGateDamageChart(null); } }
  /** WHAT MY COMPANIONS' SPELLS HEALED IN ME, owed to each caster by peer id since my last word to the room (the gate
   *  court's GATE-HEAL way): whole points, each caster once, the fractions kept for the next. */
  const healOwed = new Map();
  let healSentAt = -Infinity;
  function healSend(t) {
    healSentAt = t;
    const h = [];
    for (const [by, n] of healOwed) if (n >= 1 && h.length < GATE_HEAL_ROWS_MAX) h.push([by, Math.min(Math.floor(n), GATE_HEAL_WIRE_MAX)]);
    if (!h.length || !online()?.sendEg?.('heal', { h })) return;
    for (const [by, n] of h) { const left = healOwed.get(by) - n; if (left > 0) healOwed.set(by, left); else healOwed.delete(by); }
    lifelineSaid(h);   // EG-ZP
  }
  /** EG-ZP: when my body last stood under EG_LIFELINE_UNDER (the shared clock) - noted each frame in the Spire and at a
   *  companion's heal that found me so: the census's `lowAt` (net/eliteGates/egBrain.js), off my own body. */
  let lowAt = -Infinity;
  /** EG-ZP - LIFELINE, THE RECEIVER'S HALF (section 15; the census's own rule - net/eliteGates/egBrain.js egHeal): the heal word just
   *  said (`h`, `[peer, points]`) opens the strongest Lifeline among its healers on my blows (the fight's - scenes/
   *  egFight.js egLifelineOpen) when I stood under EG_LIFELINE_UNDER within EG_LIFELINE_LOOK_MS (`lowAt` - this frame's
   *  body among them), at the word's arrival at the room as my corrected clock reckons it (the shared clock and the half
   *  round trip it measured). */
  function lifelineSaid(h) {
    const min = egLifelineMin(Math.max(1, entity.level | 0));   // AUDIT EG III: a heal worth a window, as the census asks it (my level, as my hello says it)
    const t = now(), v = egLifelineOf(link.state(), me(), h.filter(([, n]) => n >= min).map(([by]) => accountOf(by)));
    if (v > 0 && t - lowAt <= EG_LIFELINE_LOOK_MS) fight?.lifeline?.(v, t + egClockHalfRtt(clock));
  }
  /** AUDIT EG III (section 16.3): the Reliquaries my end's claim opened, on that breach's recap - the service's count over
   *  the room's, the one-by-one count held to it. */
  function openedHeard(b, n) {
    if (recap?.b !== b || recap.opened === n) return;
    recap = { ...recap, opened: n, reliquaries: n };
    pres.rel = Math.min(pres.rel, n);
  }
  /** THE BOARD'S LINE from my end's claim (server-account/src/egHonours.js egStandingOf), on that breach's recap - the one
   *  standing, the one kept, and one still to be made. */
  const boards = new Map();
  function boardHeard(b, board) {
    const line = egBoardLine(board);
    if (!line) return;
    boards.set(b, line);
    if (boards.size > EG_RECAPS_BOARDS) boards.delete(boards.keys().next().value);
    if (recap?.b === b && recap.board !== line) recap = { ...recap, board: line };
    egRecapBoardKeep(store, b, line);
  }

  // ── EG-H2 (section 22, THE LAW PIN): a breach opened under another law than mine ─────────────────────────────
  /** the halls asked (`b:h:geo` -> when), the halls given (AUDIT EG V, E NEW-2: by their ground too - the next circle's are
   *  asked while the Court rests, under the ground then in force), the breach told, the circle built again from its given
   *  halls; a circle's five given, as the swap's worker is handed them (lawGiven) */
  const lawAsked = new Map(), lawGot = new Set();
  let lawSaid = '', lawBuilt = '';
  const givenMemo = { k: '', v: /** @type {any[] | null} */ (null) };
  /** AUDIT EG V (h, E NEW-1; section 22, THE LAW PIN: "A few circles' worth are kept") - THE HALLS GIVEN FORGOTTEN WITH THE BREACH,
   *  on every way out (walkOut, the frame's way out, away): the halls the room gave and the swap's build gave (net/eliteGates/egLaw.js
   *  egSpecForget - kept for the session before, up to 32, against its own doc) and what I asked and was given of them, so a
   *  way back into the breach asks again what it is not given. */
  function lawForget() { egSpecForget(); lawGot.clear(); lawAsked.clear(); lawBuilt = ''; givenMemo.k = ''; givenMemo.v = null; digestSeen.k = ''; trailForget(); }

  // ── AUDIT EG V (h; lane3 L3-10 (b) and (c), section 8.2) - THE TRAIL, AND THE ALLIES ON TRAVERSAL GROUND ─────────────────
  /** each living member's route through the span or Brink I stand in (`routes`: sub -> its points, world/eliteGates/egLook.js egRibbonPush,
   *  mine among them), the breach and hall they are of, the first across the room named as its door opened (`esay` door's
   *  `s`), and THE TRAIL's segments this frame (one buffer, kept) */
  const trail = { b: '', h: 0, first: '', routes: new Map(), segs: new Float32Array(EG_TRAIL.max * 6), n: 0 };
  function trailForget() { trail.b = ''; trail.h = 0; trail.first = ''; trail.routes.clear(); trail.n = 0; }
  /** THE TRAIL's frame: every living member's route through a span or a Brink kept while its trial and closing run (each one a
   *  point a metre at most, a ridden one on its piece); once the room names the first across, its route drawn as a faint gold
   *  ribbon for the others (drawPass) - from the poses this screen hears, never its own route to itself. A new hall forgets
   *  the last one's. */
  function trailFrame(E) {
    if (trail.b !== E.b || trail.h !== E.h) { trailForget(); trail.b = E.b; trail.h = E.h; }
    trail.n = 0;
    if (!(E.h > 0) || (E.sg !== 'trial' && E.sg !== 'closing')) return;
    const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
    if (spec.kind !== 'span' && spec.kind !== 'brink') return;
    const tS = now() / 1000, slot = egSlotOfHall(E.h);
    if (player?.pos && !witness) trailKeep(spec, slot, me(), player.pos, tS);
    for (const q of peers()) if (q?.pos && livingOf(E, q.sub)) trailKeep(spec, slot, q.sub, q.pos, tS);
    if (E.sg === 'closing' && trail.first && trail.first !== me()) trail.n = egTrailSegs(trail.routes.get(trail.first), spec, tS, trail.segs);
  }
  /** The realm's frame less the dungeon's (net/superDungeon/sdBrain.js dungeonToRealm's offset), read once. */
  const R0 = dungeonToRealm(0, 0, 0);
  /** Member `sub`'s feet at dungeon-frame `p` kept on its route through the hall in slot `slot` (spec `spec`). */
  function trailKeep(spec, slot, sub, p, tS) {
    const sx = p[0] + R0[0];
    if (egSlotAt(sx) !== slot) return;
    let route = trail.routes.get(sub);
    if (!route) trail.routes.set(sub, (route = []));
    egRibbonPush(route, spec, egLocalX(spec, sx), p[1] + R0[1], p[2] + R0[2], tS);
  }
  /** Is `sub` a living, entered member of breach `E` (its company row)? */
  function livingOf(E, sub) { for (const c of E.co ?? []) if (c[0] === sub) return c[3] === 1 && c[5] === 1; return false; }
  /** AUDIT EG V (h; section 8.2: "Allies draw at 60% opacity on traversal ground, so an ally never hides an edge line") - an
   *  ally's body on the Spire's traversal ground: ECV1's plain blend (CONCEAL_MODE.reveal - the opacity alone, no shimmer, no
   *  shade) at 60%, its name still drawn (`named`, net/remotePlayers.js). One record, never made a frame. */
  const ALLY_VEIL = Object.freeze({ mode: CONCEAL_MODE.reveal, alpha: 0.6, t: 0, phase: 0, named: true });
  /** AUDIT EG V (L3-12; section 9's safety net): the breaches a hall of which my own law drew otherwise than the room's
   *  digest says (`st`'s `dg`) - asked and built from the room's bytes for the rest of the breach, as another law's are */
  const lawOff = new Set();
  const digestSeen = { k: '', off: false };
  /** Whether breach `E` keeps another law than mine (`st`'s `egv`) - or one of its halls came out otherwise under mine. */
  function lawForeign(E) { return (E.egv > 0 && E.egv !== EG_SPEC) || lawOff.has(E.b); }
  /** AUDIT EG V (L3-12): does the hall I stand in, drawn by my own law, disagree with the room's digest of it (`dg`, the digest
   *  of the hall `h` the link holds - a new hall's stage lets the last one's go)? Asked once a hall and digest. */
  function digestOff(E) {
    if (!(E.dg > 0)) return false;
    const k = `${E.b}:${E.h}:${E.geo ?? 0}:${E.dg}`;
    if (digestSeen.k !== k) {
      digestSeen.k = k;
      const mine = egSpecDigest(egHallOf(E.seed, E.h, E.geo ?? 0));
      digestSeen.off = mine !== E.dg;
      if (digestSeen.off) console.warn(`[eg] hall ${E.h} drawn otherwise than the room's (${mine} against ${E.dg}) - its halls asked of the room`);
    }
    return digestSeen.off;
  }
  /** Each hall of my circle the room has not given me asked (`{k:'spec'}`), EG_SPEC_ASK_MS apart - once my law is not the
   *  breach's (`st`'s `egv`), or a hall of it came out otherwise under mine (digestOff). Said once a breach of another law.
   *  AUDIT EG V (E NEW-2): while the Court rests, the next circle's too (the room gives this circle's or the next's), so the
   *  swap's worker builds it from them as it builds a circle of my own law. */
  function lawFrame(E) {
    if (!E.b || !(E.h > 0) || E.end) return;
    if (!lawForeign(E) && digestOff(E)) lawOff.add(E.b);
    if (!lawForeign(E)) return;
    if (lawSaid !== E.b) { lawSaid = E.b; if (!lawOff.has(E.b)) say(EG_LAW_TEXT); }
    const c = egCircleOfHall(E.h), o = online(), geo = (E.geo ?? 0) | 0;
    for (let h = (c - 1) * 5 + 1, last = (E.sg === 'rest' ? c + 1 : c) * 5; h <= last; h++) {
      const k = `${E.b}:${h}:${geo}`;
      if (lawGot.has(k) || Date.now() - (lawAsked.get(k) ?? -Infinity) < EG_SPEC_ASK_MS) continue;
      if (o?.sendEg?.('spec', { h })) lawAsked.set(k, Date.now());
    }
    lawRebuild(E);   // AUDIT EG III (lane4 #3): asked again every frame until the step has run
  }
  /** A hall the room gave (net/eliteGates/egLaw.js egSpecGive - read before any draw). Once all five of my circle are given, the
   *  circle standing (drawn by my own law before they came) is built again from them, under the veil (lawRebuild). */
  function lawTook(w) {
    const E = link.state();
    if (!E.b || w.egv !== E.egv || w.sp?.seed !== E.seed || !egSpecGive(w.sp)) return;
    lawGot.add(`${E.b}:${w.h}:${(w.sp.geo ?? 0) | 0}`);
    lawRebuild(E);
  }
  /** AUDIT EG III (lane4 #3): THE LAW PIN'S REBUILD - the circle standing, once all five of its halls are given, built again
   *  from them under the veil; counted done (`lawBuilt`) only once that step has run, so a step held behind a swap or an
   *  answer under way, or one that did not go, is asked again by the next frame (lawFrame). */
  async function lawRebuild(E) {
    const c = egCircleOfHall(E.h), key = `${E.b}:${c}`;
    if (lawBuilt === key || !inSpire() || modes()?.egHallCircle?.() !== c || swapping || answering) return;
    if (!lawGiven(E, c)) return;
    if (await swapTo(E, c)) lawBuilt = key;
  }
  /** AUDIT EG V (E NEW-2): circle `c`'s five halls as breach `E`'s room gave them (under the ground in force), or null while
   *  any is not given - kept once whole, so a frame of the rest makes nothing. */
  function lawGiven(E, c) {
    const geo = (E.geo ?? 0) | 0;
    for (let h = (c - 1) * 5 + 1; h <= c * 5; h++) if (!lawGot.has(`${E.b}:${h}:${geo}`)) return null;
    const k = `${E.b}:${c}:${geo}`;
    if (givenMemo.k !== k) { givenMemo.k = k; givenMemo.v = []; for (let h = (c - 1) * 5 + 1; h <= c * 5; h++) givenMemo.v.push(egHallOf(E.seed, h, geo)); }
    return givenMemo.v;
  }
  /** EG-H3 (EG10): circle `c`'s level asked of the swap's build - its state, or null (none offered: the old step). AUDIT EG
   *  V (E NEW-2): under another law only once the room has given its five halls, handed over with the ask - the worker's
   *  module holds no hall this thread was given. */
  function prebuild(E, c) {
    const given = lawForeign(E) ? lawGiven(E, c) : undefined;
    return given === null ? null : modes()?.egPrebuild?.({ b: E.b, seed: E.seed, c, geo: E.geo ?? 0, given }) ?? null;
  }

  /** AUDIT EG III (lane4 #10): the frame's batch list (batches), and the errand objects as last made with the state they
   *  were made from (objs). */
  const _batchList = [];
  const objsMemo = { E: null, here: false, v: /** @type {any} */ (null) };
  const api = {
    link,
    /** A word of the hub or my breach's room (net/online.js onEg). */
    word(w, room) {
      if (!w) return;
      if (w.k === 'clk') { egClockHeard(clock, w.c, w.now, Date.now()); return; }   // EG-H1: a sample of the shared clock
      if (w.k === 'bd') { countFell(); return; }   // EG-H1: the relay's count's fall of me - the Spire's one life
      link.word(w);
      if (w.k === 'spec') { lawTook(w); return; }   // EG-H2: a hall of the breach's own law
      if (w.k === 'esay' && w.w === 'door' && w.s?.[0]) { const E = link.state(); if (trail.b === E.b && trail.h === E.h) trail.first = w.s[0]; }   // AUDIT EG V (h): THE TRAIL's first across
      if (w.k === 'call') {
        if (opening && w.os === me()) opening = null;
        if (w.os === me()) stakeDrop((s) => s.b === w.b);   // EG-ZA: the room took it - its own receipts settle the stake
        const key = `${w.b}`;
        if (callSaid !== key && w.co.some((r) => r[0] === me())) {
          callSaid = key;
          // EG-F (section 6.4): the horn, and ONE line - "<opener> opens an Elite Breach." (the prompt says the rest)
          if (hornFor !== key) { hornFor = key; soundEgHorn(audio); }
          say(w.os === me() ? `Your ${w.rh ? 'Rehearsal' : 'Elite Breach'} rises and opens in ${egCountText(egTimes({ openedAt: w.op }).openAt - now())}. Step through the arch, or answer the call where you stand.` : EG_TEXT.call(w.o || 'Your company'));   // AUDIT EG V (c, L7-20): in no one input's words
        }
      }
      if (w.k === 'fall' && w.s !== me()) say(`${EG_TEXT.falls(w.n || 'A companion')}${w.fin ? ' The Spire will not take them back.' : ''}`);
      if (w.k === 'down' && w.s !== me()) say(t('eg.downOther', '{name} is down. Raise them before they fall!', { name: w.n || 'A companion' }));   // AUDIT WORLD-EVENTS L1-4
      if (w.k === 'down' && w.s === me() && witness) lieDown(w.until);
      if (w.k === 'fall' && w.s === me() && witness?.down) { witness.down = 0; witness.fall = { at: now(), final: !!w.fin, lost: relHeld, eye: null }; }   // AUDIT WORLD-EVENTS L1-4: the window passed, or given in to - the fall's own card now
      if (w.k === 'fall' && w.s === me() && witness?.fall) witness.fall.final = !!w.fin;   // EG-ZD: the room's word on whether it was the last
      if (w.k === 'fall' && w.s === me() && !witness) enterWitness(now(), true, w.fin);
      if (w.k === 'rise' && w.s === me()) riseAt(w);
      if (w.k === 'eheal') applyHeal(w.p, w.why);
      if (w.k === 'eheal' && w.why === 'rest') { const S = link.state(); pres.restP = { b: S.b ?? '', h: S.h | 0, p: Number(w.p) || 1 }; }   // AUDIT EG V (c, L2-9): the rest card says a heal less than whole
      if (w.k === 'eheal' && (w.why === 'rally' || (w.why === 'cry' && w.p > 0))) fight?.rally?.(now() - egClockHalfRtt(clock));   // EG-ZR: SHIELD-HYMN - at the door's opening, the word's way here taken off (AUDIT EG IV: and at Rallying Cry's)
      if (w.k === 'eheal' && (w.why === 'rally' || w.why === 'cry') && w.p > 0 && !witness && entity.health > 0 && inSpire()) beatNow('rally', { t: w.p });   // AUDIT EG III (section 27.5): Rally's heal seen, heard and said
      if (w.k === 'eheal' && w.why === 'cry' && !witness && entity.health > 0 && inSpire()) spireRallyingCry();   // AUDIT EG IV (lane10 #14): a Court's phase turn gives back a spent Second Wind
      if (w.k === 'toll') payToll(w.q, w.h);   // EG-ZI: the pull's toll (section 10.6)
      if (w.k === 'eland') fight?.landed?.(w.i, w.d);   // FIELD BUGS 2026-10-20f LANDED-WORD: what my blow landed - its number
      if (w.k === 'efair' && EG_FAIR_TEXT[w.w]) { unfair = { h: link.state().h | 0, w: w.w }; mid(EG_FAIR_TEXT[w.w]()); say(EG_FAIR_TEXT[w.w]()); }   // DOOR-WORD
      if (w.k === 'ebridge') say(w.s === me() ? EG_PRES_TEXT.bridgeMine : EG_PRES_TEXT.bridgeRaised(w.n || 'A companion'));   // AUDIT EG III: Spirebridge, said to the company
      if (w.k === 'egot' && w.w === 'page' && EG_ANNALS[w.p]) { annals.add(w.p); say(`A page of the Annals of 3E 398 - ${EG_ANNALS[w.p][0]}: ${EG_ANNALS[w.p][1]}`); }
      else if (w.k === 'egot' && EG_GOT_TEXT[w.w]) say(EG_GOT_TEXT[w.w]);
      if (w.k === 'egot' && w.w === 'longstep') longStepHeard(link.state());   // AUDIT EG III (lane1 #5): LONG STEP on my crumbles, for one span
      if (w.k === 'rd') say(w.cov ? `${EG_TEXT.redoubt(w.w)}: the Covenant has spoken. This Redoubt is the last.` : `${EG_TEXT.redoubt(w.w)}: the count gains ${egCountText(Math.max(0, w.g ?? 0))}.`);
      void room;
    },
    /** `/breach` (answer the call - AUDIT EG V (c, L7-14): with no call of mine standing, the start window, where a keyless
     *  player finds the Rehearsal; `rehearse` - the day's Rehearsal; `home` - the way home at a Redoubt; `board`; `annals`
     *  - anywhere; `help`). AUDIT EG V (c, L7-21): a word it does not know is told the words, never taken for an answer. */
    command(arg = '') {
      const parts = String(arg).trim().toLowerCase().split(/\s+/).filter(Boolean), a = parts[0] ?? '', b = parts[1] ?? '';
      if (a === 'rehearse' || a === 'rehearsal') { const no = openRefusal(); if (no) { say(no); return; } open(true); say(EG_TEXT.opening); return; }
      if (a === 'home') { this.wayHome(); return; }
      if (a === 'board' || a === 'boards') { if (!board?.()) say('The boards cannot be read just now.'); return; }   // EG-E2: the three boards (ui/eliteGates/egBoardWindow.js)
      if (a === 'annals') { annalsSay(b); return; }   // AUDIT EG V (c, L7-5): the pages the account keeps, anywhere
      if (a === 'help' || a === '?') { say(inSpire() ? egBreachUsage() : egBreachUsageOut()); return; }
      const o = online(), E = link.state();
      if (inSpire()) {
        if (a === 'pick') { const n = Number(b) | 0, card = E.offer?.v?.[n - 1]; if (card == null) say('No Vestige waits for that number.'); else o?.sendEg?.('pick', { v: card }); return; }
        if (a === 'vote') { if (b === 'respite') respiteVote(parts[2] ?? 'yes'); else this.vote(b); return; }
        if (a === 'respite') { respiteVote(b || 'yes'); return; }   // AUDIT EG V (c, L7-2): the respite's own word
        if (a === 'cant' || a === 'cantrip') { const run = egRunOfMember(E, me()), n = (Number(b) | 0) - 1; if (n < 0 || n >= run.cant.length) say(run.cant.length ? `Your Cantrips: ${run.cant.map((c, j) => `${j + 1}. ${EG_CANTRIPS[c]?.name}`).join(', ')}.` : 'You hold no Cantrip.'); else o?.sendEg?.('cant', { i: n }); return; }
        if (a === 'tonic') { if (!(egRunOfMember(E, me()).tonics > 0)) say(EG_TONIC_TEXT.none); else if (witness) say(EG_TONIC_TEXT.fallen); else o?.sendEg?.('tonic'); return; }   // AUDIT EG III (lane1 #5): A SPIRE TONIC drunk - the room heals it (section 17.1)
        if (a === 'buy') { const i = { cant: 0, cantrip: 0, tonic: 1, shard: 2 }[b]; if (i == null) say('The Sutler sells a Cantrip (20 lumen), a Spire Tonic (15) or a Vestige shard (30): /breach buy cant|tonic|shard.'); else o?.sendEg?.('buy', { i }); return; }
        if (a === 'surplus') { o?.sendEg?.('surplus', { use: b === 'reroll' ? 1 : 0 }); return; }
        if (a === 'ping') { pingSay({ danger: 1, mine: 2, cache: 2 }[b] ?? 0); return; }   // EG-ZE: a witness pings where the member it watches stands
        if (a === 'watch') { if (witness) { witness.idx++; witness.watched = null; } return; }
        if (a === 'forsake') {
          if (!witness) { say('Only the fallen may forsake the breach.'); return; }
          if (Date.now() - forsakeAskAt > EG_HOME_CONFIRM_MS) { forsakeAskAt = Date.now(); mid('Forsake the breach? Your recall is lost. Forsake again to go.'); return; }   // AUDIT EG V (c, L7-20): in no one input's words
          forsakeAskAt = -Infinity; o?.sendEg?.('forsake'); return;
        }
        if (a === 'use' || a === 'engine') { this.useEngine(); return; }
        if (a === 'bridge' || a === 'spirebridge') { bridgeAsk(); return; }   // AUDIT EG III (section 15)
        if (a === 'bequest') { const run = egRunOfMember(E, me()), n = (Number(b) | 0) - 1, v = run.vs[n]?.[0]; if (!witness || v == null) say('The fallen may pass on one Vestige: /breach bequest N.'); else o?.sendEg?.('bequest', { v }); return; }
        say(egBreachUsage());   // AUDIT EG V (c, L7-21): every word
        return;
      }
      // AUDIT EG V (c, L7-14): `/breach` with no call of mine standing opens the start window (its refusals first) - the
      // keyless player's door to the Rehearsal; with one, it answers; AUDIT EG V (c, L7-21): any other word is told the words
      if (a === '') { if (callMine(E) || returnable()) answer(); else startOpen(); return; }
      say(egBreachUsageOut());
    },
    /** The company's word answered (`y` yes/no or an option's number): the newest choice open, or the one named. AUDIT EG V
     *  (c, L7-2; section 16.2): yes or no names THE READY VOTE while a rest asks it (the director asks the decrees, the Ready
     *  and the respite in one beat, the respite newest), then any other yes-or-no choice - never the respite, whose word is
     *  its own (R, `/breach respite`); a number names the first decree unanswered, then the newest choice but the respite. */
    vote(y) {
      const E = link.state(), o = online(), open = (E.as ?? []).filter((q) => q[2] > now());
      if (!open.length) { say(NO_CHOICE_TEXT); return false; }
      const yn = y === 'yes' || y === 'y' ? 1 : y === 'no' || y === 'n' ? 0 : null;
      const n = Number(y) | 0;
      const resp = (q) => q[0] === 'respite', dec = (q) => q[0].startsWith('dec:');
      const ask = yn != null
        ? open.find((q) => q[0] === 'ready') ?? [...open].reverse().find((q) => !dec(q) && !resp(q)) ?? (open.some(resp) ? null : open[open.length - 1])
        : open.find((q) => dec(q) && voted[q[0]] == null) ?? [...open].reverse().find((q) => !resp(q)) ?? open[open.length - 1];
      if (!ask) { say(egRespiteHow()); return false; }
      const val = yn != null ? yn : Math.max(0, n - 1);
      voted[ask[0]] = val;
      return !!o?.sendEg?.('vote', { q: ask[0], y: val });
    },
    /** AUDIT EG V (c, L7-2): the respite's own word (`yes`, `no`) - its ask, while it is open. */
    respite: (word = 'yes') => respiteVote(word),
    /** A key while the Spire's panel stands (1-6 a card or an option, Y/N a yes-or-no choice - the Ready at a rest - and R the
     *  respite while it is asked, Enter closes the recap) or while I watch (Q and E change whom, the pad's shoulders too).
     *  Answers whether it took the key. */
    key(e) {
      const code = e?.code ?? '';
      if (!inSpire() && EG_CALL_KEYS.includes(code) && this.promptModel()?.answerable) { answer(); return true; }   // EG-F: the call's prompt - Enter, the pad's A
      if (!inSpire() && !recap) return false;
      if (recap && (code === 'Enter' || code === 'Escape' || EG_PAD_DIRS[code] === 'up')) { recap = null; drawEgPanel(null); return true; }
      if (!inSpire()) return false;
      const E = link.state(), o = online(), m = /^Digit([1-6])$/.exec(code);
      if (witness?.down && code === 'Enter') { o?.sendEg?.('yield'); return true; }   // AUDIT WORLD-EVENTS L1-4: lying down, the fall given in to
      if (witness && (code === 'KeyQ' || code === 'KeyE')) { watchStep(code === 'KeyE' ? 1 : -1); return true; }
      if (witness && EG_PAD_SHOULDERS[code]) { watchStep(EG_PAD_SHOULDERS[code]); return true; }   // AUDIT EG V (c, L7-7): the pad's shoulders
      const dir = EG_PAD_DIRS[code];   // EG-G1 (section 27.8): the pad's d-pad, its own codes (the classic skin's pad)
      if (dir && egPadUp(padCtx())) return padGesture(dir, dir === 'down' && witness ? 'hold' : 'tap');
      if (m && E.offer?.v?.length) { const card = E.offer.v[Number(m[1]) - 1]; if (card != null) { o?.sendEg?.('pick', { v: card }); return true; } }
      const open = (E.as ?? []).filter((q) => q[2] > now());
      if (code === 'KeyR' && open.some((q) => q[0] === 'respite')) return respiteVote('yes');   // AUDIT EG V (c, L7-2): R, the respite's own key (the Spire refuses a rest)
      if (open.length && (code === 'KeyY' || code === 'KeyN')) return this.vote(code === 'KeyY' ? 'yes' : 'no');
      if (open.length && m) return this.vote(m[1]);
      if (code === 'KeyB' && bridgeGap() >= 0) return bridgeAsk();   // AUDIT EG III: Spirebridge - B while a gap lies ahead (the shoulder's own key otherwise)
      return false;
    },
    /** THE DEATH SAVE (characters/playerEntity.js registerPlayerDeathSave): a blow that would kill me in the Spire is a
     *  fall instead - the witness begins. */
    fallSave() { if (!inSpire() || witness) return false; enterWitness(now(), false); return true; },
    /** A witness takes no blow (the damage door's mod). */
    witnessing: () => !!witness,
    /** The witness's eye: behind and over the member watched (the camera's override). Answers whether it took the eye.
     *  AUDIT EG III (lane6 #1, section 16.5): `dt` the frame's (s) - the orbit critically damped over EG_WITNESS_DAMP_S
     *  (egWitnessDamp; none, or a new member watched, and it stands at once) - and `cast` the host's sphere cast
     *  (`(origin, radius, dir, maxDist) -> dist|null`, the Morrowind body's camera's seam), which pulls the damped eye in
     *  off the hall's rock at once (egWitnessClear - never damped into the wall). */
    witnessEye(c, yaw = 0, { dt = 0, cast = null } = {}) {
      // EG-ZD (section 16.5): THE FALL's own eye - where I fell, sinking - until the witness view dithers in
      const F = witness?.fall?.eye ? egFallModel(witness.fall, now(), { still: egReducedMotion(win) }) : null;
      if (F?.eye === 'fall') { const e = witness.fall.eye; c.pos = [e[0], e[1] - F.sink, e[2]]; return true; }
      if (!witness?.watched) return false;
      const p = peers().find((q) => q.sub === witness.watched);
      if (!p?.pos) return false;
      witness.eye = egWitnessDamp(witness.eye?.who === witness.watched ? witness.eye : null, egWitnessOrbit(p.pos, yaw), dt, witness.watched);
      c.pos = egWitnessClear(p.pos, witness.eye.p, cast);
      return true;
    },
    /** THE POTION LAW: may I drink a restoring potion now (two a hall), and one drunk. */
    potionAllowed: () => !inSpire() || potions > 0,
    potionUsed() { if (inSpire()) { potions = Math.max(0, potions - 1); potionsKeep(); } },   // AUDIT EG V (c, L2-14): kept
    push: (dx, dz, m) => pushBy(dx, dz, m),
    /** Iron Footing's share off a push (the spans' Gust and Pendulum read it - systems/eliteGates/spireKit.js spireFooting). */
    footing: () => (inSpire() ? footing() : 0),
    hold: (ms) => holdFor(ms),
    ring: (x, z, r, inside) => ringKeep(x, z, r, inside),
    useKey,
    /** One frame (the online frame, every mode). */
    frame() {
      const t = now(), E = link.state();
      spireHolderStep(entity, holderNow());   // EG-ZR: the Vestiges I hold on their doors, or let go
      seedFrame();   // EG-ZM: a way back waiting under the veil for the room's first word
      if (Date.now() - keysAt >= EG_KEYS_EVERY_MS) askKeys();
      if (Date.now() - claimAt >= EG_CLAIM_RETRY_MS) flush();
      stakeFrame();   // EG-ZA: a stake no call answered, its void asked
      openAgainFrame();   // AUDIT EG IV (lane3 #1): an open whose answer was lost, asked again by its own id
      if (opening?.z) sendOpen();
      if (opening && opening.tries >= EG_OPEN_TRIES && Date.now() - opening.sentAt > EG_OPEN_RETRY_MS * 2) { opening = null; say(EG_TEXT.shut); }
      if (E.call && !inSpire() && egPhase({ openedAt: E.call.op }, t) === 'ended' && !E.wk) link.forget();
      portalSet?.tick(cam?.pos ?? null);
      // EG-H1: the shared clock's ping while the breach's room holds me; my body's word while I stand alive in it; the ride's
      // two hooks on the presence link (net/online.js `poseRide`, `rideAt`)
      const o = online();
      if (o) { o.poseRide = inSpire() ? ridePl : null; o.rideAt = inSpire() ? rideDraw : null; o.poseDown = inSpire() ? downPose : null; }   // AUDIT WORLD-EVENTS L1-4: and my body lying down
      if (inSpire()) {
        const c = egClockDue(clock, Date.now());
        if (c != null && !o?.sendEg?.('clk', { c, h: egClockHalfRtt(clock) })) clock.sent.delete(c);
        if (!witness && entity.health > 0 && entity.maxHealth > 0 && egMemberOf(E, me())?.in) sayBody(entity.health / entity.maxHealth, Date.now());
        if (entity.health < entity.maxHealth * EG_LIFELINE_UNDER) lowAt = t;   // EG-ZP: my body seen under 30%, for Lifeline (lifelineSaid)
      }
      if (returnable() && backSaid !== wayBack.b) { backSaid = wayBack.b; say(EG_BACK_TEXT.offer); }   // EG-ZD (section 22): THE WAY BACK offered, once
      this.callFrame(t);   // EG-F: the arch, the call's prompt and portal, the sight lines
      if (inSpire()) {
        spireFrame(E, t);
        trailFrame(E);   // AUDIT EG V (h; section 8.2): THE TRAIL
        pushStep();
        fight ??= makeFight(link);
        fight?.landsWord?.(!!online()?.egLandOk);   // FIELD BUGS 2026-10-20f LANDED-WORD: my relay says what my blows land - the number is its word
        fight?.frame();
        presFrame(link.state(), t);   // EG-G1
        if (healOwed.size && Date.now() - healSentAt >= EG_HEAL_SEND_MS) healSend(Date.now());   // EG-ZF: what my companions healed in me, out
        if (!leaving) { reverbFrame(link.state()); clampFrame(link.state()); }   // EG-ZH (sections 11.7-11.9)
        air.frame(api.scoreView()?.place ?? null, t / 1000, cam?.pos ?? null, E.seed);   // EG-ROAR: the Spire's air, from the score's place, on the breach's clock
      } else {
        presAway();   // EG-G1
        if (fight) { fight.leave(); }
        if (look) { look.release(); look = null; }   // EG-G2: the look's passes, freed on every way out
        if (!swapping && !answering) reverb.release();   // EG-ZH: let go on every way out - held through a swap or an answer's step under way
        if (!swapping && !answering) air.stop();   // EG-ROAR: and the Spire's air with it
        if (!swapping && !answering) modes()?.egBandsDown?.();   // EG-ZN (section 29): the band textures freed at the breach's end, every way out - never under a swap's or an answer's step (the next circle's stand uploads nothing)
        if (!swapping && !answering) { swapWaitAt = 0; modes()?.egSwapDrop?.(); lawForget(); }   // AUDIT EG III (lane4 #7): and the swap's build and its worker with them, every way out (walkOut's alone did); AUDIT EG V (h): and the halls given
        clampAway();   // EG-ZH
        if (leaving || (E.end && E.b)) { leaving = false; link.forget(); }
        if (door || portal) dropDoor();
      }
      drawEgHud(inSpire() ? null : egHudModel(link.state(), me(), t, { inSpire: false, witness: !!witness, potions }), { hidden: hudHidden() });   // EG-G1: inside, the Spire's HUD
      chartFrame(link.state());   // EG-ZF (section 27.6): the lord's fall's chart
      if (recap && Date.now() > recapUntil) recap = null;
      if (recap && pres.rel < (recap.opened ?? 0) && Date.now() - pres.relAt >= 400) { pres.rel++; pres.relAt = Date.now(); playSound(EG_BEAT_SOUNDS.rare); }   // EG-G1: one each 400 ms, the Rare chime
      const panelModel = inSpire() ? egPanelModel(link.state(), me(), t, voted) : null;
      drawEgPanel(panelModel, { hidden: hudHidden() && !recap, recap, focus: pres.focus, relShown: pres.rel, words: EG_PRES_TEXT, onPick: (card) => online()?.sendEg?.('pick', { v: card }), onVote: (q, y) => { voted[q] = y; online()?.sendEg?.('vote', { q, y }); }, onSurplus: (use) => online()?.sendEg?.('surplus', { use }),
        touch: pres.touch ??= isTouchDevice(win), onClose: () => { recap = null; drawEgPanel(null); } });   // AUDIT EG V (c, L7-9): the recap closed by a tap; the panel's words per the input in hand
    },
    /** The hall's fight driver (the dungeon host's seams), or null outside the Spire. */
    fight: () => (inSpire() ? fight : null),
    /** AUDIT EG V (h): THE TRAIL drawn this frame - its first across and its segments (tests, stats). */
    trail: () => ({ first: trail.first, n: trail.n, segs: trail.segs.subarray(0, trail.n * 6) }),
    /**
     * AUDIT EG V (h; lane3 L3-10 (c), section 8.2) - AN ALLY ON TRAVERSAL GROUND, DRAWN AT 60%: the draw for peer account `sub`'s
     * body by its pose `shown` (its feet, the scene's frame through the host's `toScene` - asked only here, in the Spire; the
     * host's every-peer veil, scenes/world.js `_veils`): ALLY_VEIL while it is a living member of my breach, in the hall I stand
     * in, on no fight floor (net/eliteGates/egFair.js egFightFloorAt - a span's pieces, a passage, a ledge: the ground no blow is aimed at),
     * else null.
     * @param {string|null|undefined} sub @param {any} shown @param {(p: any) => number[]} toScene
     */
    allyVeil(sub, shown, toScene) {
      if (!sub || !shown || sub === me() || !inSpire()) return null;
      const E = link.state();
      if (!(E.h > 0) || !livingOf(E, sub)) return null;
      const pos = toScene(shown);
      const sx = pos[0] + R0[0];
      if (egSlotAt(sx) !== egSlotOfHall(E.h)) return null;
      const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
      return egFightFloorAt(spec, egLocalX(spec, sx), pos[1] + R0[1], pos[2] + R0[2]) ? null : ALLY_VEIL;
    },
    lights: () => (inSpire() ? fight?.lights() ?? [] : []),
    /** AUDIT EG III (lane4 #10): one list, refilled a frame (the host reads it at once), never a new one. */
    batches() {
      _batchList.length = 0;
      if (!inSpire()) return _batchList;
      for (const b of fight?.batches() ?? NO_CLEARS) _batchList.push(b);
      for (const b of portalSet?.batches() ?? NO_CLEARS) _batchList.push(b);
      return _batchList;
    },
    drawPass(proj, view, eye, seconds, fog) {
      if (!inSpire()) return false;
      // EG-G2 (section 25.6): the mist first, the hall's fight over it, THE EDGE LINE and the tells last - on the shared clock
      const L = lookCircle(link.state()), ts = now() / 1000, vp = renderer?._worldViewportPx ?? null, lane = !!renderer?.lightingLane, still = stillNow(), shining = lightsNow();
      const painted = !!L?.paintSky(vp, lane, ts);   // EG-LOOK (Elite-Gates-Look.md section 6): the band's sky map's next quadrant, for the sky slot's fetch
      const under = !!L?.drawUnder(proj, view, eye, ts, fog);
      const air = !!L?.drawAir(proj, view, eye, ts, fog, lane, still, shining, vp?.[3] ?? 0);   // EG-LOOK (section 5): THE AIR - the band's motes about the eye's hall (held under reduced motion) and the halos of the lamps and the way's beams
      const drew = !!fight?.drawPass(proj, view, eye, seconds, fog);
      const ghosts = !!modes()?.dungeonCtx?.egSpanDraw?.(proj, view, fog);   // EG-ZL (sections 10.3 and 10.8): the spans' ghosts and a peer's ghost slab (scenes/eliteGates/egSpan.js drawPass), under the lines
      const over = !!L?.drawOver(proj, view, eye, ts, fog, egAccessNow(win).palette, renderer?._worldViewportPx, trail.n ? trail.segs : null, trail.n);   // AUDIT EG III (lane4 #5): THE EDGE LINE in the danger palette's safety; AUDIT EG V (L6-3): sized in the world image's pixels; (h) THE TRAIL with them
      const lit = !!L?.drawLights(proj, view, eye, ts, fog, shining, still);   // EG-ZE: THE LIGHTS, added over the lines
      return painted || under || air || drew || ghosts || over || lit;
    },
    /** EG-G2: THE SPIRE'S SKY (render/eliteGates/egSkyPass.js) in the host's sky slot - the band's void and the Spire's underside. */
    drawSky(proj, view, eye, seconds, fog, gain = 1) { return inSpire() ? !!lookCircle(link.state())?.drawSky(proj, view, seconds, fog, gain) : false; },
    /** EG-G2: THE SCORE's view of this breach (systems/eliteGates/egScore.js createSpireScoreHost) - `{ place, ctx }`, or null outside
     *  the Spire: the hall's stage and kind, its lord and its phase, THE COUNT while it runs, a set piece, the end. */
    scoreView() {
      if (!inSpire()) return null;
      const E = link.state(), t = now();
      if (!E.b || !(E.h > 0)) return null;
      const spec = egHallOf(E.seed, E.h, E.geo ?? 0), band = egBandOfCircle(egCircleOfHall(E.h)), lord = spec.kind === 'court' ? EG_LORDS[spec.lord] ?? null : null;
      const F = E.fight?.h === E.h ? E.fight : null, phase = F ? Math.max(1, ...F.phases.map((p) => p.ph | 0)) : 1;
      const valkKey = EG_VALKYNAZ[band], bandLord = lord ?? EG_LORDS[EG_BAND_LORDS[band]?.[0]];
      // AUDIT EG V (c, L7-12; section 26 - "a lord's wake is a 2-bar drum swell before SPIRLRD1"): a Court's wake is its LORD's
      // (the room's `wake` line - net/eliteGates/egLords.js egLordsWake - or its lord seen awake), never the hall's: the lord sleeps
      // until the company steps into its ring, and the band's ambience holds until it wakes
      const wakeSay = spec.kind === 'court' ? (F?.says ?? []).filter((s) => s.w === 'wake').at(-1) : null;
      const asleep = spec.kind === 'court' && !wakeSay && !(F?.bodies ?? []).some((b) => b.role === EG_ROLE.lord && b.ph > 0);
      const sinceWake = spec.kind === 'court' ? (wakeSay ? t - wakeSay.at : Infinity) : E.hw > 0 ? t - E.hw : Infinity;
      return {
        place: { band, sg: E.sg, kind: spec.kind, lord: spec.lord ?? null, valk: !!lord?.valk, phase, countLeft: E.ca > 0 ? egCountAt(E, t) : NaN, set: !!spec.tube || spec.kind === 'brink', sinceWake, asleep, end: !!E.end,
          sinceFall: witness ? t - witness.fell : Infinity },   // AUDIT EG V (c, L7-13; section 26 - SPIREEND for "the tear, a fall, the end"): my own fall
        ctx: { band, motif: bandLord?.motif ?? 0, valk: EG_LORDS[valkKey]?.motif ?? 3, seed: E.seed >>> 0 },
      };
    },
    /** THE VOID'S COST (section 8): a tenth of my health, never below a quarter of it. EG-ZR: Featherstep's 8, 6 or 4% by
     *  its rank (the census's own law - net/eliteGates/egBrain.js egCastBackCost), of the body without Stoneskin's cushion. */
    castBack() {
      if (witness || !inSpire()) return;   // AUDIT EG III (lane4 #1): a witness's body, held under the hall, owes the void nothing
      const share = egCastBackCost(egRunOfMember(link.state(), me()).vs), max = spireBodyMax(entity), cut = Math.min(share * max, Math.max(0, entity.health - EG_CAST_BACK_FLOOR * max));
      if (cut > 0) hurt(Math.round(cut));
      castBackBeat(cut > 0, Math.round(cut) / (entity.maxHealth || 1));   // EG-G1: -10% on the screen, the Steps' rewind, and the first time its line; AUDIT EG III: what it took of the health bar
    },
    /** THE WAY HOME (a Redoubt's rest): pressed once, asked; pressed again, walked. */
    wayHome() {
      const E = link.state(), o = online();
      if (!inSpire() || E.sg !== 'rest') { say('The way home opens at a Redoubt.'); return false; }
      if (Date.now() - homeAskAt > EG_HOME_CONFIRM_MS) { homeAskAt = Date.now(); mid(`${EG_TEXT.walkHome} Press again to go.`); return false; }
      homeAskAt = -Infinity;
      return !!o?.sendEg?.('home');
    },
    /** Whether a Rampart's portcullis in hall `h` stands open (its door open, or the company past it). */
    gateOpen(h) {
      const E = link.state();
      return E.h > h || (E.h === h && (E.sg === 'closing' || E.sg === 'rest' || E.sg === 'end'));
    },
    /** A death in the Spire is one (the respawn's branch): read before the respawn leaves. */
    diedHere: () => inSpire(),
    /** EG-H2 (section 10.7): do my feet stand on the Spire's TRAVERSAL GROUND - in a hall of the circle and off its fight
     *  floor (a span, a Deepway, a Brink's course, a plate), or over the void between the halls? A witness stands on none.
     *  The made level's law refuses a technique's flight there (systems/madeLevel.js madeOnTraverse). */
    onTraverse() {
      const E = link.state(), at = standing();
      if (!inSpire() || witness || !at || !(E.h > 0)) return false;
      if (!at.slot) return true;
      const spec = egHallOf(E.seed, (egCircleOfHall(E.h) - 1) * 5 + at.slot, E.geo ?? 0);
      return !egOnFight(spec, egLocalX(spec, at.sx), at.z, 0, at.y);   // THE ASCENT: the floor under my feet (a hall that judges by height)
    },
    /** The breach as held (tests). */
    state: () => link.state(),
    /** EG-E2/EG-G2 (section 25.4), THE QUIET COMPANY: during a trial in the Spire the cosmetic auras draw at nothing - the
     *  host's aura gather asks it, by the look's own law (world/eliteGates/egLook.js egQuietCompany); back on the plates, at the
     *  rests and in the recap. Every light on the floor is the fight's. */
    quiet: () => inSpire() && egQuietCompany(link.state()?.sg, true).auras === 0,
    /** EG-E: where a Redoubt's spoils leave from - the Court's heart of hall `h`, over its floor, and the floor they are
     *  kept to (world/gate/gateSpew.js keepLaunch's `{ centre, r, floorY }`) - while I stand in that hall; null anywhere else
     *  (the spoils go straight into the pack). */
    beaconAt(h) {
      const E = link.state(), at = inSpire() ? standing() : null;
      if (!E?.seed || !at || at.slot !== egSlotOfHall(h)) return null;
      const spec = egHallOf(E.seed, h, E.geo ?? 0), r = spec.ring, f = spec.fight ?? spec.end;
      if (!r || !f) return null;
      const floor = egToDungeon(spec, r.x, f.y ?? 0, r.z);
      return { at: [floor[0], floor[1] + EG_BEACON_SPEW_UP, floor[2]], keep: { centre: floor, r: Math.max(2, r.r - EG_BEACON_RIM_M), floorY: floor[1] } };
    },
    /** EG-FULL LAYER THREE: the hall's errand objects as the relay keeps them (systems/eliteGates/spireKit.js spireObjs - the spans
     *  stand Grath's islands and the false walls by them). EG-ZC (section 11.10): and the havens the Moon-Mirror lays over the
     *  branches it lights (`lit` - each zone's stamp and its run, relay ms), by which the spans stand a lit branch. */
    objs() {
      const E = link.state(), F = E.fight, here = inSpire();
      if (objsMemo.E === E && objsMemo.here === here) return objsMemo.v;   // AUDIT EG III (lane4 #10): made again only when the room's word moved - the spans ask it up to three times a frame
      objsMemo.E = E; objsMemo.here = here;
      const br = here ? (F?.bridges ?? []).filter((q) => q.h === E.h).map((q) => ({ g: q.g, from: q.at, until: q.until })) : [];   // AUDIT EG III: the hall's Spirebridges
      if (!here || !F || F.h !== E.h) return (objsMemo.v = { h: E.h | 0, objs: [], lit: [], br });
      return (objsMemo.v = { h: E.h | 0, objs: F.bodies.filter((b) => b.role === EG_ROLE.obj).map((b) => ({ t: OBJ_NAME[b.k] ?? '', i: b.i, x: b.x, z: b.z, st: b.st ?? 0, stAt: b.stAt ?? 0, pt: b.pt ?? 0 })),
        lit: (F.zones ?? []).filter((z) => z.kind === 'haven').map((z) => ({ s: z.s, from: z.from, until: z.until })), br,
        orr: F.pg?.obj === 'orrery' && Array.isArray(F.pg.st) ? F.pg.st : null });   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): an Athenaeum's stones' hours, the room's word
    },
    /** A press on a span's own target (systems/eliteGates/spireKit.js spireAct): an Orrery stone's handle (`pz` - a turn forward or
     *  back) or an engine (`use`), in the hall I stand in. */
    act(key) {
      const E = link.state(), o = online();
      if (!inSpire()) return false;
      const st = /^egstone:(\d+):(\d):([fb])$/.exec(key ?? '');
      if (st) {
        if (Number(st[1]) !== E.h || E.sg !== 'trial') { say('The Orrery is still.'); return true; }
        // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): the room takes a turn only from within EG_STONE_REACH_M of the stone, in plan,
        // and the ray offers its handle from past that - a press from there went and was dropped without a word
        const at = standing(), spec = at ? egHallOf(E.seed, E.h, E.geo ?? 0) : null, q = spec?.spots?.stone?.[Number(st[2])];
        if (q && Math.hypot(q.x - egLocalX(spec, at.sx), q.z - at.z) > EG_STONE_REACH_M) { say(SD_HALL_TEXT.closer); return true; }
        return !!o?.sendEg?.('pz', { i: Number(st[2]), a: st[3] === 'f' ? 1 : -1 });
      }
      const en = /^egengine:(\d+):(\d+)$/.exec(key ?? '');
      if (en) { if (Number(en[1]) !== E.h || E.sg !== 'trial') { say('The engine is cold.'); return true; } const ok = !!o?.sendEg?.('use', { i: Number(en[2]) }); if (ok) mid('You work the engine.'); return ok; }
      return false;
    },
    /** `/breach use`: the engine within reach, worked. */
    useEngine() {
      const E = link.state(), at = standing();
      if (!inSpire() || !at) return false;
      const spec = egHallOf(E.seed, E.h, E.geo ?? 0), x = egLocalX(spec, at.sx);
      const e = (spec.engines ?? []).find((q) => Math.hypot(q.x - x, q.z - at.z) <= EG_ENGINE_REACH_M + 0.5);
      if (!e) { say((spec.engines ?? []).length ? `Stand at ${EG_ENGINES[spec.engines[0].kind].name} to work it.` : 'No engine stands in this hall.'); return false; }
      return this.act(`egengine:${E.h}:${e.i}`);
    },
    /** The pages of the Annals this breach has given me (their numbers). */
    annals: () => [...annals].sort((a, b) => a - b),
    /** Online gone: every piece put away (the call kept - it is the hub's). */
    away() { fight?.leave(); if (look) { look.release(); look = null; } lawForget(); chartAway(); air.stop(); healOwed.clear(); dropDoor(); drawEgHud(null); drawEgPanel(null); presAway(); witness = null; const o = online(); if (o) { o.poseRide = null; o.rideAt = null; } callPortal?.clear?.(); prompt?.draw?.(null); const sw = startWin; startWin = null; sw?.close?.(); seedFrame({ silent: true }); spireHolderStep(entity, null); },   // EG-F: and the call's portal, its prompt, the start window; EG-G2: the look released; EG-ZM: a way back's wait for the room's word given up; EG-ZR: the Vestiges I held let go; AUDIT EG V (c, L6-6): the start window's slot emptied before it is closed; EG-ROAR: the Spire's air let go
    /** EG-H1: the breach's shared clock (relay ms) and its offset to this machine's wall clock (null before the room has
     *  answered a ping) - the host's spans and its fight read it (scenes/world.js's `egNow`, the spans' anchored clock). */
    sharedNow: () => now(),
    clockOffset: () => egClockOffset(clock),
    /** EG-ZD (section 10.8): THE BREACH'S CLOCK for the host (scenes/world.js `egNow`) - the corrected shared clock (relay ms)
     *  while I stand in the breach and the room has answered a ping, else null (the host's welcome-offset clock stands). */
    breachNow() { const off = egClockOffset(clock); return inSpire() && off != null ? Date.now() + off : null; },
    /** EG-ZD (section 10.8): THE SPANS' ANCHORED SECONDS for the host (scenes/world.js `deadlandsSeconds`, the spans' and the
     *  sky's clock) on the corrected shared clock while I stand in the breach, else null - render/deadlands.js anchoredClock,
     *  taken again when the offset moves past EG_SPAN_REANCHOR_MS. */
    spanSeconds() {
      const off = egClockOffset(clock);
      if (!inSpire() || off == null) return null;
      if (!spanClock || Math.abs(off - spanOff) > EG_SPAN_REANCHOR_MS) { spanOff = off; spanClock = anchoredClock({ perf: () => performance.now(), wall: () => Date.now() + spanOff }); }
      return spanClock();
    },
    /** EG-ZD (section 22): THE WAY BACK as this screen holds it (tests), and whether it is offered now. */
    backRecord: () => wayBack,
    returnable: () => returnable(),
    /** EG-H1: my ride's `pl` now (tests; net/online.js reads it through `poseRide`). */
    ridePl: () => ridePl(),
    /** Registered as the key's opener (systems/eliteGates/weirKey.js). */
    claimKeys() { setWeirKeyOpener(() => useKey()); },
    // ── EG-F: THE ARCH AND THE CALL (sections 5, 6.3, 6.4) ──────────────────────────────────────────────────────────
    /** The call's prompt as it stands now (scenes/eliteGates/egCall.js egCallPromptModel), or null. */
    promptModel() {
      const E = link.state();
      // EG-ZD (section 22): THE WAY BACK on the call's strip - its own words and button, answered as the call is
      if (returnable()) { if (windowUp()) return null; return (modes()?.mode ?? 'exterior') === 'exterior' ? { text: EG_BACK_TEXT.prompt, answerable: true, button: EG_BACK_TEXT.button, left: 0 } : { text: EG_TEXT.indoors, answerable: false, left: 0 }; }
      return egCallPromptModel({ call: E.call, me: me(), now: now(), inSpire: inSpire(), answered: !!answeredFor && answeredFor === E.call?.b && (!!callPortal?.standing?.() || answering || inSpire()),
        exterior: (modes()?.mode ?? 'exterior') === 'exterior', windowUp: !!windowUp(), wk: E.b === E.call?.b ? E.wk : 0 });
    },
    /** One frame of the door: the company's arch fed from the call (to its wake and end), the call's portal stepped into
     *  or not, the prompt drawn, the arches' sight lines said. */
    callFrame(t = now()) {
      const E = link.state();
      if (answeredFor && E.call?.b !== answeredFor && !inSpire()) answeredFor = '';
      arches?.call?.(E.call, { wk: E.b === E.call?.b ? E.wk : 0, end: E.end && E.b === E.call?.b ? t : 0 });   // the pool keeps it to its life
      if (callPortal) {
        const f = !inSpire() && (modes()?.mode ?? 'exterior') === 'exterior' ? feet() : null;
        callPortal.tick(f);   // a portal closed unused leaves the prompt to stand again (promptModel's `answered` asks it)
      }
      for (const line of arches?.sights?.(feet()) ?? []) say(line);
      prompt?.draw?.(this.promptModel());
    },
    /** The arch's door for the company (scenes/eliteGates/egArch.js onStep): its open fire stepped through, or pressed. */
    archStep(b) { const c = link.state().call; if (c && c.b === b && !inSpire()) answer(true); },
    /** The call's portal stepped into (scenes/eliteGates/egCall.js createEgCallPortal onEnter). */
    portalEntered,
    /** The relay's public half, imported (the arch pool's `verifyKey`). */
    relayKey,
    /** THE TIMERS ROW (systems/eventTimers.js `elite`): the call I hold - its opening, a Rehearsal's, the hall the company
     *  stands in and the count's end (held: now plus what is left) - or null. */
    timers() {
      const E = link.state(), c = E.call;
      if (!c || !c.co.some((r) => r[0] === me())) return null;
      const deep = E.b === c.b && E.h > 0;
      return { op: c.op, rh: c.rh, h: deep ? E.h : 0, until: deep ? (E.ca > 0 ? E.ca + E.cl : now() + E.cl) : null, end: E.b === c.b ? E.end : null };
    },
    /** The arches' clearings (world/gate/gateClearance.js gateClearSet's members). */
    archClears: () => arches?.clears?.() ?? NO_CLEARS,
    /** My arch on the compass, and on the held map. EG-ZE (section 27.3): in the Spire the compass's gold slot is the door's
     *  while it stands open (world/eliteGates/egLights.js egDoorCompass) - the arch stands in the open world alone. */
    archCompass: () => (inSpire() ? egDoorCompass(link.state(), !!witness) : arches?.compass?.() ?? null),
    archMapMark: () => arches?.mapMark?.() ?? null,
    /** My arch for my foes frame (`ea`), and a stranger's heard on theirs. */
    archWord: (near) => arches?.word?.(near) ?? null,
    archHeard: (peer, raw, from) => arches?.heard?.(peer, raw, from) ?? Promise.resolve(false),
    /** A balance this screen did not ask for (a gate's claim's key - scenes/world.js weirHeard): as new as its landing, and
     *  the balance asked again after it (AUDIT EG IV, lane3 #10: its ask's order is not this screen's to know). */
    restack: (n) => { restack(n); askKeys(); },
    // EG-G1 (section 27): the seams the host reads
    /** The party rows in the party panel's terms (ui/eliteGates/egParty.js egPartyDeco), or null outside a breach. */
    partyRows() {
      if (!inSpire()) return null;
      const E = link.state(), t = now(), roads = new Map();
      const spec = E.h > 0 ? egHallOf(E.seed, E.h, E.geo ?? 0) : null;
      if (spec?.fork) {
        for (const q of peers()) { const [sx, y, z] = dungeonToRealm(q.pos[0], q.pos[1] - 1.6, q.pos[2]); roads.set(q.sub, egRoadOf(spec, egLocalX(spec, sx), y, z)); }
        const F = feetInHall(E);
        if (F) roads.set(me(), egRoadOf(spec, F.x, F.y, F.z));
      }
      // AUDIT EG V (c, L7-7): a witness's living companions' rows tapped watch them
      const tap = witness ? new Set((E.co ?? []).filter((c) => c[0] !== me() && c[3] === 1 && c[4] === 0 && c[5] === 1).map((c) => c[0])) : null;
      return egPartyDeco(egPartyRows(E, t, { absent: pres.absent, roads }), { tap });
    },
    /** AUDIT EG V (c, L7-7; section 16.5 - "a tap on a party row"): the witness's eye on member `sub` (a living companion the
     *  room counts in the breach); answers whether it took. */
    watchMember(sub) {
      if (!witness || !inSpire() || sub === me()) return false;
      const living = (link.state().co ?? []).filter((c) => c[0] !== me() && c[3] === 1 && c[4] === 0 && c[5] === 1);
      const i = living.findIndex((c) => c[0] === sub);
      if (i < 0) return false;
      witness.idx = i; witness.watched = sub;
      return true;
    },
    /** Whether the pad's d-pad is the Spire's now (the recap, the panel, the witness's eye). */
    padUp: () => egPadUp(padCtx()),
    /** A d-pad gesture while it is the Spire's (`dir` up | down | left | right, `kind` tap | hold | release). */
    padGesture: (dir, kind) => padGesture(dir, kind),
    /** The prompt bar's rows while the d-pad is the Spire's. */
    padPrompts: () => egPadPrompts(padCtx()),
    /** A touch button's press. */
    touchAct: (id) => touchAct(id),
    /** A beat said from outside the breach's words (a Weir Key found - section 27.5). */
    beat: (k) => beatNow(k),
    /** EG-ZF (section 27.6): ANOTHER'S SPELL HEALED ME `n` points (the host's ally cast - the health that moved; scenes/world.js
     *  onCast, as the gate court's healedBy), `id` the caster's peer id in the room: owed to them, said to the room. False
     *  outside the Spire, as a witness, or for nothing. */
    healedBy(id, n) {
      if (!inSpire() || witness || !(n > 0) || typeof id !== 'string' || !id) return false;
      healOwed.set(id, (healOwed.get(id) ?? 0) + n);
      if (entity.health - n < entity.maxHealth * EG_LIFELINE_UNDER) lowAt = now();   // EG-ZP: the heal found me under 30% (it has landed: my body less it)
      return true;
    },
    /** EG-ZR - MENDER'S GRACE, THE RECEIVER'S HALF (section 15: "heals you cast on allies +15 / 25 / 35%" - "the receiver's
     *  client, from the room's word (ALLY-CAST's law)"): another's heal of `n` points just landed on me (scenes/world.js
     *  onCast - the health that moved), `id` its caster's peer id in the room: its Mender's Grace, as the room says the
     *  caster's run, heals me its share of it more (egMenderOf). Answers the points added - none outside the Spire, as a
     *  witness, or of a caster the room counts no run of. EG-ZS: and LIVING WALL's share of the whole heal more while I stand in
     *  it (`wall`) - any companion's heal, the heal word carrying it to the census as it carries Mender's Grace. */
    menderGrace(id, n) {
      if (!inSpire() || witness || !(n > 0) || !(entity.health > 0) || typeof id !== 'string') return 0;
      const who = accountOf(id), v = egMenderOf(link.state(), me(), who);
      const k = who && who !== me() && wall() ? (1 + v) * (1 + EG_WALL_X) - 1 : v;   // EG-ZS: LIVING WALL - its share of a companion's heal, Mender's Grace in it, more
      return k > 0 ? healMine(entity, n * k) : 0;
    },
    /** EG-ZH: the hall's reverb as held (tests). */
    reverbState: () => reverb.state(),
    /** AUDIT EG III (lane4 #6): the look as it stands (tests) - the circle it draws, or null before any. */
    lookState: () => look?.state() ?? null,
  };
  // EG-ZH: THE CAMERA IN ROCK and TOUCH ON THE SPANS told by this screen - the Spire's while I stand alive in it (a witness's
  // eye is the witness's), nothing anywhere else
  setSpireCamera(() => inSpire() && !witness);
  setTouchSpire(() => (inSpire() && !witness ? { span: api.onTraverse() } : null));
  // EG-ZN (section 11.8): THE SHAFT'S CAMERA told by this screen - the way down the shaft's ledge my feet stand on (null off
  // every ledge) and whether the screen stands still, while I stand alive in the Spire; nothing anywhere else
  setSpireShaft(() => (inSpire() && !witness ? { way: shaftWay(link.state()), still: stillNow() } : null));
  return api;
}
