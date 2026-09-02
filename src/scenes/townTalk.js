// T3b: the town interaction seam (DFU PlayerActivate + TalkManager,
// MIT Daggerfall Workshop), shared by BOTH exterior motor hosts (the
// standing host rule). One module owns: the interaction modes
// (Steal/Grab/Info/Talk on the classic F1-F4 binds, "Interaction is
// now in %s mode."), the activation ray against live townsfolk
// (mobile NPC distance 256 units = 6.4; pickpocket 128 = 3.2 with
// "You are too far away" beyond it), the reaction roll through the
// region's People faction, the mobile talk session (greeting window
// or the 7205 refusal box as a HUD line), and pickpocketing.
//
// The hosts supply live persons (world-space feet + billboard size)
// and call keydown/tryActivate/frame; the seam lazily loads
// FACTION.TXT + TEXT.RSC + FONT0003 through the host's fetchBytes.
// Overlay active = the motor holds (the U3 seam shape).
//
// ROAD-D D10 closed the last of this header's open clauses, and each
// deserves its record:
//   - Info mode opening the same talk window was never a gap:
//     PlayerActivate.cs:775-783 falls Info, Grab and Talk on a mobile
//     through to the same TalkToMobileNPC call.
//   - THE TFAC PORTRAIT SHIPPED. SetNPCPortrait
//     (DaggerfallTalkWindow.cs:360-385) is called from SetTargetNPC,
//     before the push, so it rides openTalkWindow's `portrait` option
//     below - CommonFaces (TFAC00I0.RCI) at SetPerson's minted record
//     for a mobile (TalkManager.cs:817, systems/townPopulation.js's
//     _setFaceRecord), and GetPortraitIndexFromStaticNPCBillboard's
//     archive/record pair for a static NPC (:849, the law in
//     systems/npcSession.js, wired at scenes/worldModes.js).
//   - THE PICKPOCKET BOX SWAPPED. Pickpocket (PlayerActivate.cs:
//     1611-1660) raises a real MessageBox for both success arms and
//     leaves only the failure on the HUD, which systems/talk.js now
//     reports as `modal` and the steal arm below routes on.

import { FactionFile } from '../formats/factionFile.js';
import { racialSuppressTalk } from '../systems/lycanthropy.js';   // V4: the transformed talk refusal
import { TextRsc } from '../formats/textRsc.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { TalkWindow } from '../ui/talkWindow.js';
import { hudScale } from '../ui/hud.js';
import { overlayAction } from '../ui/input.js';
import { makeWindowStack } from '../ui/windowStack.js';   // ROAD-B B1: UserInterfaceManager's stack, under this host's one slot
import { hudFade } from '../ui/fadeLayer.js';   // D4: PushWindow's ClearFade
import {
  getPeopleOfCurrentRegion, getReactionToPlayer, pickpocketTownsperson, findFactions,
  MOBILE_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE, PICKPOCKET_DISTANCE, FOUND_NOTHING_VALUABLE_TEXT_ID,
} from '../systems/talk.js';
import { startMobileTalk, expandMacros, expandAnswerRecord, oathTextId, honorificOf, raceDisplayName } from '../systems/talkSession.js';
import { REGION_RACES } from '../formats/mapsFile.js';
import { ChoiceWindow } from '../ui/talkWindow.js';
import { buildBuildingDirectory, questorCandidateBuildings, TOPIC_CATEGORIES, whereIsAnswer, reactionTier012, buildingHint } from '../systems/talkTopics.js';
import { LIST_ITEM_TYPE, QUESTION_TYPE } from '../systems/topicTree.js';   // TK-vi: the window's rows are the tree's ListItems; B6: the Work question type
import { discoverBuilding } from '../systems/discovery.js';   // T4: %loc's mark side effect
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { FACTION_TYPES } from '../formats/factionFile.js';
import { skillValue, tallySkill, SKILLS } from '../systems/skills.js';
import { ActionTextBox } from '../ui/actionText.js';   // ROAD-D D10: DaggerfallUI.MessageBox, the port's parchment
import { NativeTalkWindow, preloadTalkArt, talkArtLoaded, setNpcPortrait, clearNpcPortrait } from '../ui/nativeTalk.js';   // U8b   // ROAD-D D10: SetNPCPortrait
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';   // U8b: pointer routing
import { preloadExteriorAutomapArt } from '../ui/exteriorAutomapWindow.js';   // ROAD-C c2/S10: the town map's native art

export const TONE_NAMES = ['Polite', 'Normal', 'Blunt'];   // T3f: TalkTone -> index (DFU TalkToneToIndex)

// R1: the mode itself moved to player/interactionMode.js (DFU's
// currentMode is GLOBAL - the dungeon door ladder reads it too);
// townTalk keeps the keydown, the HUD line and these re-exports.
export { MODES, nextInteractionMode } from '../player/interactionMode.js';
import { MODES, getInteractionMode, setInteractionMode, nextInteractionMode } from '../player/interactionMode.js';
import { getClassicQuestionIndex } from '../systems/answerPipeline.js';   // F042
const MODE_KEYS = { F1: 'steal', F2: 'grab', F3: 'info', F4: 'dialogue' };
export const PERSON_HIT_RADIUS = 0.45;   // MobilePersonNPC controller radius
export const PERSON_HIT_HEIGHT = 1.8;

/** Ray vs a vertical cylinder at feet (the person's controller):
 *  returns the along-ray distance or Infinity. */
export function rayPersonDistance(camPos, fwd, feet) {
  const cx = feet[0] - camPos[0], cz = feet[2] - camPos[2];
  // closest approach in XZ
  const fl = Math.hypot(fwd[0], fwd[2]) || 1e-6;
  const dx = fwd[0] / fl, dz = fwd[2] / fl;
  const t = cx * dx + cz * dz;
  if (t <= 0) return Infinity;
  const px = cx - dx * t, pz = cz - dz * t;
  if (Math.hypot(px, pz) > PERSON_HIT_RADIUS) return Infinity;
  // height gate at the hit point
  const y = camPos[1] + fwd[1] * (t / fl);
  if (y < feet[1] - 0.1 || y > feet[1] + PERSON_HIT_HEIGHT + 0.1) return Infinity;
  return t / fl * Math.hypot(fwd[0], fwd[1], fwd[2]);
}

export function createTownTalk({ renderer, canvas, fetchBytes, playerEntity, regionIndex, onCrime = null, topics = null, palette = null, rolls = Math.random, talkEngine = null, onBuildingList = null }) {
  // RP1 - THE REGION IS READ LIVE, NOT CAPTURED AT BOOT.
  //
  // This took a plain number, and the world host had no choice but to
  // hand it `startLoc.regionIndex` - so every region-keyed answer in
  // this module stayed the BOOT region's for the whole session, however
  // far the player streamed. Three things went stale together: the
  // wandering NPC race (computed once, right below), the People faction
  // the reaction law reads (resolved once inside ensureLoaded), and -
  // worst - the map-discovery KEY, which files a building under
  // `${region}:${city}`. A building discovered in Daggerfall after
  // walking out of Betony was filed under Betony.
  //
  // `regionIndex` now takes a NUMBER or a GETTER. The dev hosts, which
  // each build exactly one location and cannot stream out of it, keep
  // passing their number; the world host passes its live
  // PlayerGPS.CurrentRegionIndex read.
  const regionNow = typeof regionIndex === 'function' ? regionIndex : () => regionIndex;
  /** TK-v: the talk engine, or null before it is built / with no
   *  game data. A getter, because world.js wires the four modules to
   *  each other and can only hand them over once all four exist. */
  const engine = () => (typeof talkEngine === 'function' ? talkEngine() : talkEngine);
  const hud = new HudText();
  let font = null, factions = null, textRsc = null, people = null;
  // RP1: which region `people` was resolved for. FACTION.TXT is parsed
  // once and kept; only the per-region LOOKUP re-runs, and only when
  // the region actually changes - a border crossing, not every frame.
  let _peopleRegion = null;
  const peopleNow = () => {
    if (!factions) return people;
    const r = regionNow();
    if (r !== _peopleRegion) { _peopleRegion = r; people = getPeopleOfCurrentRegion(factions.factionDict, r); }
    return people;
  };
  let overlay = null;
  /** ROAD-B B1: the DEPTH under this host's one slot. `overlay` is the
   *  live top - every draw, key, click and drain in this file already
   *  reads it - and the stack (UserInterfaceManager.cs, ported in
   *  ui/windowStack.js) carries what is suspended beneath.
   *
   *  showOverlay stays a REPLACEMENT, deliberately: this host's windows
   *  dispatch to one another (a talk window hands over to a choice
   *  window, the arrest flow walks a chain of boxes) and DFU's own
   *  dispatch is `CloseWindow(); PushWindow(next);` - a pop and a push
   *  that net to a replacement, not to depth. pushOverlay is the other
   *  door: a genuine PushWindow, for a box that lands OVER whatever is
   *  open and must hand the screen back when it closes. That is the
   *  quest popup's case, and the reason a rest taken in the street can
   *  now be paused and resumed like DFU's. */
  const windows = makeWindowStack({ onTop: (w) => { overlay = w; } });
  /** The close callbacks of the windows currently SUSPENDED, deepest
   *  first - `_onOverlayClosed` belongs to the top window alone, and a
   *  push must not clobber the covered window's. */
  const _suspendedCallbacks = [];
  let loaded = false, loading = null;
  let directory = [];   // T3c: the location's named buildings
  // T3f: the talk tone (persists across sessions, as DFU's window
  // selection does). Everything else that used to live here is the
  // ENGINE's: TK-iv's session owns toneReactionForTalkSession and
  // TK-iii's pipeline owns lastToneIndex and numQuestionsAsked, both
  // because C# keeps them on TalkManager and resets them from inside
  // its own methods. A host copy of any of them is a law left with
  // the host - this arc's first standing law, learned by breaking it
  // three times. The locals below are the pre-engine fallbacks, used
  // only when no talkEngine is mounted (no game data, no window).
  let tone = 1;                      // 0 Polite / 1 Normal / 2 Blunt
  let toneSession = [0, 0, 0];
  let lastToneIndex = -1;
  let currentTier = 1;
  let _questionsAsked = 0;           // TalkManager.numQuestionsAsked

  /** RP1: was a `const` computed at construction. The race of the
   *  people you meet is the CURRENT region's, and it is what picks the
   *  oath pool (%oth) below. */
  const npcRaceNow = () => (REGION_RACES[regionNow()] === 1 ? 'Redguard' : 'Breton');

  async function ensureLoaded() {
    if (loaded || loading) return loading;
    loading = (async () => {
      try { font = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003'); }
      catch { console.warn('[town] FONT0003.FNT unavailable; talk UI text disabled'); }
      if (palette) preloadTalkArt({ renderer, fetchBytes, palette });   // U8b: TALK01I0 (art-less keeps the text chain)
      // ROAD-C c2/S10: the town map's native art (AMAP00I0 + TOWN00I0).
      // ONE preload for BOTH exterior hosts, because this is the one
      // seam both of them already share - and it is fire-and-forget for
      // the same reason the talk art is: an art-less boot keeps the
      // window's keyed fallback.
      if (palette) {
        preloadExteriorAutomapArt({ renderer, fetchBytes, palette })
          .catch(() => console.warn('[town] AMAP00I0/TOWN00I0 unavailable; the town map keeps its keyed shell'));
      }
      try {
        factions = new FactionFile();
        factions.load(await fetchBytes('FACTION.TXT'));
        _peopleRegion = regionNow();
        people = getPeopleOfCurrentRegion(factions.factionDict, _peopleRegion);
      } catch (e) { console.warn('[town] FACTION.TXT unavailable:', e.message); }
      try { textRsc = new TextRsc().load(await fetchBytes('TEXT.RSC')); }
      catch { console.warn('[town] TEXT.RSC unavailable; classic strings fall back'); }
      // T3c: the named-building directory (the pool merge + the
      // classic seed names; guild/temple names resolve through the
      // faction tree, palaces through TEXT.RSC 475/476/477).
      rebuildDirectory();
      loaded = true;
    })();
    return loading;
  }

  // T3d: the directory follows the CURRENT topics - static in the
  // fixed exterior host, swapped per location pixel in the streaming
  // host (DFU's TalkManager rebuilds for PlayerGPS.CurrentLocation).
  // Names ride the topics' OWN region (bank names, the name bank, the
  // province ruler); the People faction/greetings stay on the boot
  // region until travel lands (the recorded cross-region flag).
  // IH1: the ONE name bag, extracted so the quest world's
  // buildingNameOpts hook and the directory build cannot drift - a
  // second copy of "which bank, whose regent, what the palace is
  // called" is how %cbd and the talk directory come to disagree about
  // the same building. Null while no topics/factions stand (the quest
  // hook answers {} through it and generateBuildingName falls to its
  // own defaults, DFU's own out-of-location posture).
  function nameOpts() {
    if (!topics || !factions) return null;
    const region = topics.regionIndex ?? regionNow();
    const province = findFactions(factions.factionDict, { type: FACTION_TYPES.Province, region })[0];
    return {
      locationName: topics.locationName, regionName: topics.regionName,
      nameBank: getNameBankOfRegion(region),
      regentRuler: province?.ruler ?? 0,
      factionName: (id) => factions.getFaction(id)?.name ?? '',
      templeName: (id) => {
        const f = factions.getFaction(id);
        return (f?.children?.length ? factions.getFaction(f.children[0])?.name : f?.name) ?? '';
      },
      palaceName: (locName) => {
        const id = { Daggerfall: 475, Wayrest: 476, Sentinel: 477 }[locName];
        const v = id ? textRsc?.plainText(id) : null;
        return v?.[0] ? v[0].replace(/\.$/, '') : 'Palace';
      },
    };
  }

  function rebuildDirectory() {
    directory = [];
    if (!topics || !factions) return;
    try {
      const opts = nameOpts();
      if (!opts) return;
      directory = buildBuildingDirectory(topics.exteriorBuildings, topics.blocks, opts);
      // QP1: GetBuildingList's questor half rides the SAME rebuild -
      // C# populates npcsWithWork inside the one building walk
      // (TalkManager.cs:2807-2874). The candidates go out through the
      // host's door because the pool (npcSession) is the host's to
      // hold; the pool's own locationIndex guard makes re-entry a
      // no-op, so calling on every rebuild is C#'s own shape.
      onBuildingList?.(questorCandidateBuildings(topics.exteriorBuildings, topics.blocks, {
        locationIndex: topics.locationIndex ?? 0,
        mapId: topics.mapId ?? 0,
        nameOpts: opts,
        getFaction: (id) => factions?.factionDict?.get(id) ?? null,
        // PlayerGPS.GetRaceOfCurrentRegion's numeric read, the same
        // REGION_RACES+1 the quest world's currentRegionRace makes
        raceOfCurrentRegion: () => (REGION_RACES[topics.regionIndex ?? regionNow()] ?? 0) + 1,
      }));
    } catch (e) { console.warn('[town] building directory failed:', e.message); }
  }

  function setTopics(t) {
    topics = t;
    if (loaded) rebuildDirectory();   // pre-load swaps build at load's tail
  }

  const textVariants = (id) => textRsc?.plainText(id) ?? [''];
  /** MacroHelper.CityName (%cn): the current location, falling back to
   *  the region when the player is off-location. */
  const cityName = () => topics?.locationName ?? topics?.regionName ?? '';
  /** One record through the greeting/question macro set: the oath is
   *  drawn ONLY when the record carries %oth (DFU expands lazily). */
  const expandRecord = (raw) => expandMacros(raw, {
    playerName: playerEntity.name ?? '',
    oath: raw.includes('%oth') ? randomPooledText(oathTextId(npcRaceNow()), '') : '',   // F047: GetRandomText(201 + oathId)
    cityName: cityName(),
  });
  const randomVariant = (id, fallback) => {
    const v = textRsc?.plainText(id);
    return v?.length ? v[Math.floor(rolls() * v.length)] : fallback;
  };
  /** AUDIT 26 F046/F047: TextProvider.GetRandomText (:250-269) pools
   *  every Text TOKEN of a record and picks among them, where
   *  randomVariant above picks a whole SUBRECORD variant. The two
   *  diverge exactly where a record holds several one-line entries -
   *  which is the shape of the oath records (textRsc.js:131-134) and
   *  of 8999 - so a multi-line variant printed all its lines fused. */
  const randomPooledText = (id, fallback) => {
    const t = textRsc?.randomTextById(id, rolls);
    return t?.length ? t : fallback;
  };

  function setMode(m) {
    if (m === getInteractionMode()) return;   // ChangeInteractionMode: no-op on the same mode
    setInteractionMode(m);
    hud.add(`Interaction is now in ${m} mode.`);
  }

  function keydown(e) {
    const m = MODE_KEYS[e.code];
    if (m) {
      e.preventDefault();
      setMode(m);
      return true;
    }
    if (overlay) {
      e.preventDefault();
      // E says goodbye too - the touch layer's E button opens AND
      // closes talk (desktop-consistent; Esc/Enter unchanged). Choice
      // windows (G2) receive the raw code for their keyed options.
      // U20a: the EVENT rides along with the code. Without it the
      // chargen window fell back to codeToKey, which lowercases every
      // letter ('KeyS' -> 's'), so a typed character NAME - and now a
      // typed CLASS name - could never carry a capital in this host.
      // The dungeon host never had the bug: routeKey passes the real
      // event to overlayAction. The live probe caught it typing
      // "Scout" and reading back "scout".
      //
      // AUDIT 21 (hosts lane, F3): the FULL action map for anything that is
      // not a ChoiceWindow. This used to understand Escape and Enter/E and
      // nothing else, which is fine for a talk window and useless for a
      // LevelUpScreen - it needs up/down to move the cursor and plus/minus to
      // spend the pool. That is why levelling outside a dungeon could not
      // open a screen here, and silently auto-spent into your LOWEST stats
      // instead. overlayAction is the same map routeKey feeds the dungeon
      // host's overlays, so both hosts drive an overlay identically now.
      if (overlay.isChoiceWindow) overlay.input(e.code, e);
      else {
        const a = overlayAction(e);
        if (a) overlay.input(a, e);
        else if (e.code === 'KeyE') overlay.input('confirm');   // this host's own alias
      }
      // S40: OPTIONAL. A window may clear this slot from inside its
      // own input - RestWindow calls closeOverlay() so the slot is
      // free before RaiseSkills can want it for a level-up screen -
      // and the unguarded re-read threw on the key that closes it.
      if (overlay?.done) dropOverlay();
      return true;
    }
    return false;
  }

  /** D4 - THE OVERLAY'S KEY-UP EDGE. Every host binds `keyup` on the
   *  window already (it is how the movement key Set is drained) and
   *  none of them forwarded it here, so an overlay could only ever see
   *  a press. DFU's UI sees both: a Button with an OnKeyboardEvent
   *  handler is raised on KeyDown AND KeyUp (Button.cs:79-92), and the
   *  travel popup's EXIT is the deferral that needs the release
   *  (DaggerfallTravelPopUp.cs:482-495). OPTIONAL by design - a window
   *  that does not define `keyup` is a window whose buttons subscribe
   *  no keyboard handler, which is nearly all of them. Answers whether
   *  the overlay consumed it, the way `keydown` does; a host that
   *  drains its own key Set on the same event does that first. */
  function keyup(e) {
    if (!overlay) return false;
    if (typeof overlay.keyup !== 'function') return true;
    overlay.keyup(e.code, e);
    if (overlay?.done) dropOverlay();
    return true;
  }

  // G2: the arrest/court flows push their own windows through the
  // same overlay slot (one motor-holding seam).
  let _onOverlayClosed = null;

  /** THE SLOT IS EMPTIED BEFORE THE WINDOW IS TOLD (crash report,
   *  2026-08-29: "InternalError: too much recursion", fifty frames of
   *  closeOverlay -> onClose -> _close -> dispose -> closeOverlay).
   *
   *  Every drain here used to dispose the occupant and clear the slot
   *  AFTER, which reads fine until you notice that `dispose()` can run
   *  arbitrary host code. S40 made that reachable on purpose: a window
   *  may vacate this slot from inside its own close, because DFU's
   *  PopToHUD runs before RaiseSkills and the level-up screen needs the
   *  slot free. RestWindow takes that door - its `onClose` is the two
   *  exterior hosts' `if (townTalk.overlay?.isRestWindow)
   *  townTalk.closeOverlay()`. So closing a rest window re-entered
   *  closeOverlay while `overlay` STILL POINTED AT THE WINDOW BEING
   *  DISPOSED, the guard read a live slot, and it disposed it again,
   *  for ever. Every close path did it: the ended page on a key or a
   *  click, the refusal page, backing out of the selection page, and a
   *  host closing the slot itself.
   *
   *  The law is one line and it is the ORDER: null the slot, THEN tell
   *  the window. A re-entrant close then finds an empty slot and
   *  returns false, which is the truth - the slot really is free by
   *  the time the window hears about it, which is the whole point of
   *  the door S40 opened.
   *
   *  Why the other two hosts never crashed: worldModes (:4640) and
   *  dungeonContext (:1223) answer the same onClose by nulling their
   *  slot and never disposing, so there was nothing to re-enter. Only
   *  the two hosts that come through here dispose.
   *
   *  @param fireCallback - false for the font-less bail below, which
   *  drops the window to keep the motor running and was never a close. */
  function dropOverlay(fireCallback = true) {
    const win = overlay;
    if (!win) return false;
    // AUDIT 2026-08-17c: clear the close-callback BEFORE firing - a
    // stale G2 callback (e.g. the court verdict) must never re-fire
    // when a LATER unrelated window closes.
    const cb = _onOverlayClosed;
    overlay = null;
    _onOverlayClosed = null;
    win.dispose?.();   // A2: a window holding GL resources frees them (idempotent)
    if (fireCallback) cb?.();
    // ROAD-B B1: this is PopWindow (UserInterfaceManager.cs:99-104),
    // and it happens LAST, after the window has been told - the whole
    // point of the ordering above is that the slot is empty while the
    // outgoing window runs, so a re-entrant close finds nothing to
    // dispose twice. Only then does the window it was laid over come
    // back, with its own close callback.
    //
    // If the dispose or the callback opened a SUCCESSOR instead, the
    // slot is not empty and reconcile reads that as a one-level
    // replacement - the successor sits over the same suspended window,
    // which is what a dispatch mid-chain means.
    //
    // ROAD-B B5 FIXED THE RESTORE'S GUARD. It read `if (overlay)
    // _onOverlayClosed = _suspendedCallbacks.pop() ?? null;` and could
    // not tell the two cases apart, because BOTH leave the slot full:
    // a real pop (the uncovered window, whose callback must come back)
    // and a SUCCESSOR the callback just opened (whose callback was
    // written two lines ago and must NOT be thrown away). It threw it
    // away - `pop()` on an empty list is undefined, `?? null` makes
    // that a null, and the successor's own close callback was gone.
    //
    // That is arrestFlow's live shape, not a hypothetical: the guilty
    // verdict shows its box with `() => finish(...)` as the close
    // callback, and `finish` opens the prison screen with `() =>
    // release()` as ITS close callback. The release is ReleaseFromPrison
    // (DaggerfallCourtWindow.cs:482-491) - the crime clearing, the four
    // hours, the reposition and ClearEnemies - so a player who was
    // found guilty and served their days walked out of the courthouse
    // still arrested, still wanted, still standing where they were,
    // with the court music playing. A pre-B1 dropOverlay had no restore
    // at all and did not have this.
    //
    // The successor is "the slot is already full BEFORE the pop" - it
    // was nulled at the top of this function, so only the dispose or
    // the callback can have filled it. Either door may have: a
    // showOverlay replaces at this level and owes no entry, and a
    // pushOverlay reached from here pops this window first and so owes
    // none either (see pushOverlay - it is the one that decides).
    const successor = overlay;
    windows.reconcile(overlay);
    if (successor) return true;
    if (overlay) _onOverlayClosed = _suspendedCallbacks.pop() ?? null;
    else _suspendedCallbacks.length = 0;
    return true;
  }
  /** PushWindow (UserInterfaceManager.cs:79-91) - the OTHER door.
   *  showOverlay replaces because this host's windows dispatch; a box
   *  that is genuinely laid OVER an open window (the quest popup) comes
   *  through here, and the window beneath is suspended with its
   *  callback rather than disposed. Returns true when it went up. */
  function pushOverlay(win, onClosed = null) {
    if (!win) return false;
    if (hudFade.fadeInProgress) hudFade.clearFade();   // D4: UserInterfaceManager.PushWindow (:88-89), gate and all
    // ROAD review-p: WHAT THIS PUSH COVERS, read before reconcile can
    // move the stack. A full slot is a live window, and its callback
    // rides down with it. An EMPTY slot is one of two things - nothing
    // is open, or dropOverlay is running and the window that was here
    // is about to be popped by the reconcile below - and neither owes
    // a suspended entry. Pushing one unconditionally (which is what
    // this did) left the list one deeper than the stack whenever a
    // close callback pushed rather than replaced, so the NEXT close
    // popped a stray null and threw the uncovered window's real
    // callback away: the very loss B5's successor guard closed, moved
    // one window along.
    const covered = overlay;
    windows.reconcile(overlay);
    if (windows.containsWindow(win)) return true;
    if (covered) _suspendedCallbacks.push(_onOverlayClosed);   // the covered window's callback rides down with it
    windows.pushWindow(win);                      // `onTop` puts it in the slot
    _onOverlayClosed = onClosed;
    return true;
  }
  // A2 (the A1 death-presenter lesson, applied to THIS slot): every
  // point that drops the occupant must free its GL resources - the
  // automap windows own uploaded textures and billboard batches, and
  // uploadTexture memoizes forever, so a silent replace both leaks
  // and leaves a live cache key behind.
  function showOverlay(win, onClosed = null) {
    // D4 - "Clear fade in progress when any UI window is pushed"
    // (UserInterfaceManager.cs:86-89). Both doors into this slot are
    // PushWindow, so both clear it: a half-finished fade under a window
    // the player just opened would go on lerping the HUD's parent panel
    // for the rest of its duration. THE GATE IS THE CALLER'S AND IT
    // MATTERS: ClearFade itself sets the panel to clear
    // unconditionally, so a push made while the screen is SMASHED to
    // black - which raises no fadeInProgress - must not reach it, or
    // the level-up box the fast-travel arrival raises would tear the
    // black off a frame before performFastTravel fades it.
    if (hudFade.fadeInProgress) hudFade.clearFade();
    // Same order as dropOverlay, for the same reason: the slot holds
    // the SUCCESSOR before the outgoing window is disposed, so an
    // outgoing window that closes this slot from inside its dispose
    // finds the new occupant and its identity guard leaves it alone.
    const outgoing = (overlay && overlay !== win) ? overlay : null;
    overlay = win;
    _onOverlayClosed = onClosed;
    // ROAD-B B1: ...and the stack follows the slot. With nothing
    // suspended this is just "the stack now holds this one window";
    // with a window suspended under the outgoing one it is a ONE-LEVEL
    // replacement (DFU's CloseWindow-then-Push), so the depth beneath
    // survives the dispatch and still returns when the chain ends.
    windows.reconcile(overlay);
    outgoing?.dispose?.();
  }

  /** NextInteractionMode (the touch cycle button); returns the new mode. */
  function nextMode() { setMode(nextInteractionMode(getInteractionMode())); return getInteractionMode(); }

  /** The activation ray (the host's E/use edge). persons =
   *  [{ person, pos }] world feet of LIVE townsfolk. Returns true if
   *  a person consumed the activation. */
  function tryActivate(camPos, fwd, persons) {
    if (overlay) return true;
    let best = null, bestDist = Infinity;
    for (const p of persons) {
      const d = rayPersonDistance(camPos, fwd, p.pos);
      if (d < bestDist) { best = p; bestDist = d; }
    }
    // AUDIT 23 (ui-native-3) - PlayerActivate.cs:76/:771-798: the ray
    // itself reaches RayDistance (76.8); each MODE's distance gates
    // inside with "You are too far away." (Info/Grab/Talk 6.4, Steal
    // 3.2 alone). The old 6.4 pre-gate answered a person down a long
    // street with SILENCE and let E fall through to a door behind them.
    if (!best || bestDist > RAY_DISTANCE) return false;
    if (getInteractionMode() !== 'steal' && bestDist > MOBILE_NPC_ACTIVATION_DISTANCE) { hud.add('You are too far away.'); return true; }
    // AUDIT 26 F048: ActivateMobileNPC NESTS the steal distance test
    // inside `if (!mobileNpc.PickpocketByPlayerAttempted)`
    // (PlayerActivate.cs:785-795), so an already-attempted townsperson
    // produces NO output at any range - the port gated distance first
    // and printed a line DFU never shows.
    if (getInteractionMode() === 'steal' && !best.person?.pickpocketAttempted
        && bestDist > PICKPOCKET_DISTANCE) { hud.add('You are too far away.'); return true; }
    ensureLoaded().then(() => activate(best, bestDist));
    return true;
  }

  function activate(target, dist) {
    if (getInteractionMode() === 'steal') {
      // PlayerActivate: pickpocket once per person, 3.2 max - and
      // F048's nesting, so the already-attempted arm is SILENT here
      // too, whatever the range.
      if (target.person.pickpocketAttempted) return;
      if (dist > PICKPOCKET_DISTANCE) { hud.add('You are too far away.'); return; }
      target.person.pickpocketAttempted = true;
      const r = pickpocketTownsperson(playerEntity, {
        rolls,
        nothingText: () => randomPooledText(FOUND_NOTHING_VALUABLE_TEXT_ID, 'You found nothing valuable.'),   // F046: GetRandomText(8999)
      });
      // ROAD-D D10: the box swap the header pended. Pickpocket
      // (PlayerActivate.cs:1611-1660) raises a MESSAGE BOX for both
      // success arms - the pinched purse (:1630) and the 8999
      // nothing-valuable record (:1645) - and leaves only the failure
      // on the HUD (`PopupMessage`, :1650), which is right: the
      // failure is the arm that spawns the watch behind it.
      if (r.modal) showOverlay(new ActionTextBox(String(r.message).split('\n')));
      else hud.add(r.message);
      // G1: the caught pickpocket IS the crime - SpawnCityGuards(true)
      if (!r.success) onCrime?.();
      return;
    }
    // Info / Grab / Talk all talk to a mobile NPC (DFU verbatim)
    // AUDIT 26 (talk): PlayerActivate.cs:783 hands the click to
    // TalkManager.TalkToMobileNPC (:726-744), and that arm is not just
    // a greeting - it rebuilds npcData as a COMMONER of the region's
    // People faction (SetTargetNPC's mobile overload, :805-831, which
    // also clears alreadyRejectedOnce), zeroes
    // numAnswersGivenTellMeAboutOrRumors "so even if NPC is the same
    // as previous talk session PC will give one correct answer"
    // (:742), and reaches TalkToNpc's ResetNPCKnowledge (:2652-2654)
    // for a new target. This host ran the LOCAL greeting ladder only,
    // so the engine's npcData still carried whatever static NPC last
    // set it: every walker answered with that NPC's social group and
    // isSpyMaster, over an answer counter that was already spent.
    const eng0 = engine();
    if (eng0?.session) {
      // T3c: the NPC keeps a stable per-person seed for the
      // reaction-tier roll (DFU seeds by the NPC object hash -
      // engine-dependent, so a lazily-assigned uniform seed stands in,
      // Ledger A).
      target.person._talkSeed ??= Math.floor(rolls() * 0x7fffffff);
      const talk = eng0.session.talkToMobileNPC(target.person);
      // the three doors that close before a conversation (a racial
      // override, a reaction below -20, a standing rejection) - each
      // has already said its piece through the session's messageBox
      if (talk?.kind !== 'talk') return;
      _talkNpc = target.person;
      // the local mirrors of the tone half TalkToNpc just reset
      toneSession = [0, 0, 0];
      lastToneIndex = -1;
      // StartNewConversation (:867-878) is the WINDOW's reset, which
      // DaggerfallTalkWindow.OnPush runs through SetStartConversation
      // (:654) on every push - the question counter, the deferred
      // topic-list rebuild and the mill setup.
      eng0.session.startNewConversation();
      _questionsAsked = 0;
      openTalkWindow(talk.greeting, {
        npcSeed: target.person._talkSeed, npcName: target.person.nameNPC ?? '',
        // TalkManager.cs:817 - a mobile ALWAYS portraits from
        // TFAC00I0.RCI, at the record SetPerson minted for it.
        portrait: { archive: 'CommonFaces', record: target.person.personFaceRecordId ?? 0 },
      });
      return;
    }
    // The pre-engine fallback (a host with no talk engine mounted -
    // exterior.js): the reaction-threshold greeting ladder alone.
    const reaction = peopleNow() ? getReactionToPlayer(peopleNow(), playerEntity) : 0;
    const t = startMobileTalk({
      reaction, textVariants, playerName: playerEntity.name ?? '', npcRace: npcRaceNow(), rolls, cityName: cityName(),
    });
    if (t.refused) { hud.add(t.text || 'You get no response.'); return; }
    // AUDIT 39 (#46): through the slot's own door, like every other
    // mount here - a raw assignment leaks the outgoing window's GL
    // resources and leaves a previous mount's close-callback armed.
    if (!directory.length) { showOverlay(new TalkWindow(t)); return; }
    // T3c: the greeting carries the Where-is entry; the NPC keeps a
    // stable per-person seed for the reaction-tier roll (DFU seeds by
    // the NPC object hash - engine-dependent, so a lazily-assigned
    // uniform seed stands in, Ledger A).
    target.person._talkSeed ??= Math.floor(rolls() * 0x7fffffff);
    _talkNpc = target.person;
    // TK-v: TalkToNpc's session reset is the ENGINE's - both halves of
    // it - so a host cannot clear one and forget the other. With no
    // engine mounted these local mirrors are the whole of it.
    toneSession = [0, 0, 0];   // T3f: per talk session (DFU TalkToNpc)
    lastToneIndex = -1;
    // AUDIT 18 F4 - StartNewConversation (TalkManager.cs:867-871),
    // which DaggerfallTalkWindow.OnPush runs through
    // SetStartConversation (:654) on EVERY window push. Without the
    // reset the counter only ever climbed, so 7215+tone (the greeting
    // opening) was reachable at most ONCE per play session and every
    // later conversation opened on the follow-up (7218+tone).
    _questionsAsked = 0;
    // U8b: the native TALK01I0 window when the art is up (clicks/taps
    // through the verbatim hit rects; the keyed chain is the fallback)
    openTalkWindow(t.text, {
      npcSeed: _talkNpc?._talkSeed ?? 0, npcName: _talkNpc?.nameNPC ?? '',
      portrait: { archive: 'CommonFaces', record: _talkNpc?.personFaceRecordId ?? 0 },
    });
  }

  /** B7: THE ONE WINDOW-OPENER. The mobile path above and
   *  TalkToStaticNPC's fall-through (the worldModes static-NPC click,
   *  the guild popup's TALK button) both land here - DFU has one
   *  DaggerfallTalkWindow and every conversation pushes it
   *  (TalkManager.cs:2616-2663 ends in pushTalkWindow). The session
   *  resets are NOT here: the mobile path runs its own above, and
   *  talkToStaticNPC runs the C# ones inside the engine. Art-less or
   *  building-less sessions keep the keyed greeting chain. */
  function openTalkWindow(greeting, { npcSeed = 0, npcName = '', portrait = null } = {}) {
    // ROAD-D D10: SetNPCPortrait (DaggerfallTalkWindow.cs:360-385).
    // DFU sets it from SetTargetNPC, BEFORE the push (TalkManager.cs
    // :817 for a mobile, :849 for a static NPC), so it lands here -
    // the port's one window door. A caller with no portrait clears
    // the last one rather than inheriting a stranger's face.
    if (portrait) setNpcPortrait(portrait.archive, portrait.record);
    else clearNpcPortrait();
    _talkSeed = npcSeed;   // F043: whoever we are talking to now
    // V4: GetSuppressTalk (LycanthropyEffect.cs:423-437) - every
    // conversation door lands here (B7's one-opener law), so the
    // transformed refusal gates them all at once.
    const sup = racialSuppressTalk(playerEntity);
    if (sup) { hud.add(sup.text); return; }
    const eng = engine();
    if (talkArtLoaded() && directory.length) {
      showOverlay(new NativeTalkWindow(greeting, {
        categories: () => treeCategories() ?? localCategories(),
        // B5-6: the OTHER pages, off the engine's own lists - the
        // whole reason they were blockers is that the tree computed
        // all of this and the window threw it away. Null when no
        // engine is mounted: the window keeps the consumed no-op.
        tellMeAboutTopics: () => treeFlatTopics(engine()?.tree?.listTopicTellMeAbout),
        peopleTopics: () => treeFlatTopics(engine()?.tree?.listTopicPerson),
        thingsTopics: () => treeFlatTopics(engine()?.tree?.listTopicThing),
        workQuestion: () => (eng?.pipeline ? eng.pipeline.getQuestionText(workListItem(), tone) : null),
        askWork: () => eng.pipeline.getAnswerText(workListItem(), {
          npcSeed,
          // TalkManager.WorkAvailable - the town's npcsWithWork pool
          // (TK-iv owns it); no work in town = record 8078 verbatim
          workAvailable: eng.session?.workAvailable ?? false,
        }),
        answer: (row) => {
          if (row.listItem) return eng.pipeline.getAnswerText(row.listItem, { npcSeed });
          const a = answerText(row); _questionsAsked++; return a;   // AUDIT 17e F13, moved to DFU's own site
        },
        // ROAD-D D10: the counter climbs in the ANSWER, not here.
        // UpdateQuestion now runs on every SELECTION (the window's
        // shipped selection model), and DFU's GetQuestionText has
        // never touched numQuestionsAsked - GetAnswerText does, which
        // is where the engine path already had it.
        question: (row) => (row.listItem
          ? eng.pipeline.getQuestionText(row.listItem, tone)
          : questionText(row)),
        tone: () => tone,
        setTone: (t2) => { tone = t2; },
        npcName,   // AUDIT 18 F5: the NPC's OWN name, not the People faction
      }));
      return;
    }
    showGreeting(greeting);
  }

  /** TK-vi: THE WINDOW ON THE TREE. DaggerfallTalkWindow's Where-is
   *  page IS TalkManager.listTopicLocation - the list
   *  AssembleTopicListLocation (:3200-3353) built - and its rows are
   *  ListItems the question and the answer both take. That grouping is
   *  DFU's own and the T3c category list never was it: the building
   *  types walk in ENUM order behind CheckBuildingTypeInSkipList, the
   *  quest-residence General section and the palace arm ride a shared
   *  group variable, and a Regional group is appended ALWAYS, whether
   *  or not the town has one of anything. Each group opens with a
   *  NavigationBack row, which is the window's own back button here
   *  rather than a topic, so it is dropped.
   *
   *  Null when no engine is mounted (no game data): the T3c directory
   *  below is the fallback, and it answers through the host ladder as
   *  it always did. */
  function treeCategories() {
    const tree = engine()?.tree;
    if (!tree || !engine()?.pipeline) return null;
    return (tree.listTopicLocation ?? [])
      .map((group) => ({
        label: group.caption,
        buildings: (group.listChildItems ?? [])
          .filter((child) => child.type !== LIST_ITEM_TYPE.NavigationBack)
          .map((child) => ({ label: child.caption, listItem: child })),
      }))
      .filter((group) => group.buildings.length);
  }

  /** B5-6: a FLAT tree list (Tell me about, People, Things) as window
   *  rows. Null when no engine stands (the window keeps its no-op);
   *  NavigationBack rows drop exactly as the location groups drop
   *  theirs. An EMPTY list opens an empty listbox - DFU's own Things
   *  page, verbatim (classic never implemented it). */
  function treeFlatTopics(list) {
    if (!engine()?.pipeline || !list) return null;
    return list
      .filter((child) => child.type !== LIST_ITEM_TYPE.NavigationBack)
      .map((child) => ({ label: child.caption, listItem: child }));
  }

  /** SetTalkCategoryWork's fake list item (DaggerfallTalkWindow.cs:
   *  1097-1099): "create fake list item so that we can call function
   *  and set its questionType to QuestionType.Work". */
  const workListItem = () => ({ type: LIST_ITEM_TYPE.Item, questionType: QUESTION_TYPE.Work, caption: '' });

  /** The pre-engine fallback: T3c's flat category directory. */
  function localCategories() {
    return TOPIC_CATEGORIES
      .map((c) => ({ label: c.caption, buildings: directory.filter((b) => b.buildingType === c.type) }))
      .filter((c) => c.buildings.length)
      .map((c) => ({ label: c.label, buildings: c.buildings.map((b) => ({ label: b.name, ...b })) }));
  }

  let _talkNpc = null;
  // AUDIT 26 F043: the CURRENT partner's reaction seed. DFU seeds the
  // roll from whichever NPC is being spoken to - `DFRandom.Seed =
  // lastTargetMobileNPC.GetHashCode()` or `lastTargetStaticNPC`'s
  // (TalkManager.cs:669-673) - so it is stable per person. The port
  // read it off `_talkNpc`, which ONLY the mobile activate path
  // assigns, so every guild, temple and questor conversation ran on
  // seed 0 on a fresh boot and then inherited whichever townsperson
  // was spoken to last. openTalkWindow is the one door both paths
  // come through, and both already hand it the seed.
  let _talkSeed = 0;

  /** GetReactionToPlayer_0_1_2 (:632-690) for the CURRENT tone and
   *  question. TK-iii's pipeline owns the gate that decides WHEN this
   *  runs (`lastToneIndex`) and TK-iv's session owns the per-session
   *  cache it fills - so this is the tier computation alone, handed
   *  to the pipeline as its `reactionTier` seam. */
  function computeTier(questionType, socialGroup) {
    return reactionTier012({
      personality: playerEntity.stats?.personality ?? 50,
      npcSeed: _talkSeed,   // F043: the door's seed - the static path has one too
      socialGroup: socialGroup ?? 0,
      // AUDIT 26 F042/F096: the reaction adds
      // `questionTypeReactionMods[GetClassicQuestionIndex(qt)]`
      // (TalkManager.cs:663-667) - +5 for LocalBuilding/Regional and
      // QuestLocation/OrganizationInfo, 0 for the rest. This seam took
      // the type and VOIDED it, hardcoding index 0, so every question
      // took the +5 and a Work question banded to 8076/8077 where DFU
      // refuses with 8075 - and the inflated value was then CACHED in
      // the session's tone. The mapper and the table both already
      // existed; only this call dropped them on the floor.
      questionIndex: getClassicQuestionIndex(questionType), toneIndex: tone,
      skillValue: tone === 0 ? skillValue(playerEntity, SKILLS.Etiquette)
        : tone === 2 ? skillValue(playerEntity, SKILLS.Streetwise) : 0,
      session: engine()?.session?.toneReactionForTalkSession ?? toneSession,
      rolls,
      onTally: (sk) => tallySkill(playerEntity, SKILLS[sk], 1),
    });
  }

  // The pre-engine fallback: the same gate, kept locally, for a host
  // with no engine mounted.
  function tierNow() {
    const e = engine();
    if (e?.pipeline) return e.pipeline.reactionToPlayer012;
    if (lastToneIndex !== tone) {
      currentTier = computeTier(null, 0);
      lastToneIndex = tone;
    }
    return currentTier;
  }

  // The T button cycles Polite > Normal > Blunt and re-shows the
  // current window with the live label (our keyed-window idiom for
  // DFU's three tone buttons).
  const toneOption = (reshow) => ({
    code: 'KeyT', label: `T - tone: ${TONE_NAMES[tone]}`,
    action: () => { tone = (tone + 1) % 3; reshow(); },
  });

  function showGreeting(text) {
    showOverlay(new ChoiceWindow({
      lines: [text],
      options: [
        { code: 'KeyW', label: 'W - where is...', action: () => openCategories() },
        toneOption(() => showGreeting(text)),
        { code: 'Escape', label: 'Esc - goodbye', action: () => {} },
        { code: 'KeyE', label: '', action: () => {} },
        { code: 'Enter', label: '', action: () => {} },
      ],
    }));
  }

  function pagedList(lines, items, onPick, page = 0) {
    const per = 8;
    const slice = items.slice(page * per, (page + 1) * per);
    const options = slice.map((it, i) => ({ code: `Digit${i + 1}`, label: `${i + 1} - ${it.label}`, action: () => onPick(it) }));
    if ((page + 1) * per < items.length) options.push({ code: 'KeyN', label: 'N - more', action: () => pagedList(lines, items, onPick, page + 1) });
    options.push({ code: 'Escape', label: 'Esc - goodbye', action: () => {} });
    showOverlay(new ChoiceWindow({ lines, options }));
  }

  function openCategories() {
    const cats = TOPIC_CATEGORIES
      .map((c) => ({ ...c, buildings: directory.filter((b) => b.buildingType === c.type) }))
      .filter((c) => c.buildings.length)
      .map((c) => ({ label: c.caption, buildings: c.buildings }));
    pagedList(['Where is...'], cats, (cat) => {
      pagedList([cat.label], cat.buildings.map((b) => ({ label: b.name, building: b })), (it) => answerWhereIs(it.building));
    });
  }

  function answerWhereIs(building) {
    // GetAnswerWhereIs (the seed-stable knowledge roll picks the
    // knows/doesn't-know table half) + the %hnt hint chain: the T4
    // fork - a 7333 direction variant (%loc + the %di compass) or the
    // 7332 map reveal that discovers the building.
    showAnswer(answerText(building));
  }

  // AUDIT 17e F13 - the PLAYER'S QUESTION, verbatim
  // (TalkManager.cs:1324 question = ExpandRandomTextRecord(7225 +
  // toneIndex), with %1com -> GetPCGreetingOrFollowUpText
  // (:1149-1156): the FIRST question opens with a greeting
  // (7215 + tone), later ones with a follow-up (7218 + tone); %n /
  // greetingNameNPC is "friend"/"stranger" (7221 + tone) when the
  // reaction is <= 0, else the NPC's name (:1133-1142)).
  // U8b shipped a hardcoded English literal ("Where is X?") that no
  // tone or record could reach - the three tone records carry real
  // classic flavour ("Where the hell is %key?" at Blunt).
  function questionText(building) {
    const asked = engine()?.pipeline?.numQuestionsAsked ?? _questionsAsked;
    const opening = randomVariant((asked === 0 ? 7215 : 7218) + tone, 'Hail to thee');
    const rp = peopleNow() ? getReactionToPlayer(peopleNow(), playerEntity) : 0;
    const npcName = (rp <= 0 ? randomVariant(7221 + tone, 'stranger') : (_talkNpc?.nameNPC || 'stranger'));
    const q = randomVariant(7225 + tone, '%1com. Where can I find %key?');
    return expandRecord(q)
      .replaceAll('%1com', expandRecord(opening).replaceAll('%n', npcName))
      .replaceAll('%key', building.name ?? building.label ?? '');
  }

  // U8b: the answer STRING, shared by the native talk window and the
  // fallback chain (the T3c-T3f pipeline unchanged).
  function answerText(building) {
    const a = whereIsAnswer(topics.playerPos(), building, playerEntity.stats?.personality ?? 50, _talkNpc?._talkSeed ?? 0, 0, { tier: tierNow() });
    const raw = randomVariant(a.textId, '%hnt');
    // T4: %hnt is WHERE DFU rolls the reveal (GetKeySubjectBuildingHint
    // rides MacroHelper's %hnt), so the fork runs only when the record
    // carries the macro - lazily, like %oth below: a rude refusal
    // never rolls and never marks the map. The mobile-talk hosts are
    // the two exteriors, so isInside is false; %loc's mark side effect
    // (MacroHelper.cs:1085-1090) is the discoverBuilding call, keyed
    // region:location until the automap arc brings the map pixel id.
    let hint = '';
    if (raw.includes('%hnt')) {
      const h = buildingHint(rolls, false);
      hint = randomVariant(h.textId, h.reveal ? '... Let me just mark %loc here on your map' : '%loc is %di of here')
        .replaceAll('%loc', building.name).replaceAll('%di', a.direction);
      // RP1: the discovery key is the CURRENT region's. This read the
      // boot region, so a building revealed after streaming across a
      // border was filed under the region the session started in and
      // the map never showed it where the player actually was.
      if (h.reveal) discoverBuilding(`${regionNow()}:${cityName()}`, building);
    }
    // AUDIT 18 F1: ExpandRandomTextRecord (TalkManager.cs:3580-3587)
    // runs the FULL MacroHelper over the answer record - %oth and %cn
    // resolve here exactly as they do in the greeting.
    return expandAnswerRecord(raw, {
      playerName: playerEntity.name ?? '',
      oath: raw.includes('%oth') ? randomPooledText(oathTextId(npcRaceNow()), '') : '',   // F047: GetRandomText(201 + oathId)
      cityName: cityName(),
      hint, key: building.name,
      honorific: honorificOf(playerEntity.gender),   // T4: the real %hnr/%ra
      race: raceDisplayName(playerEntity.race),
    });
  }

  function showAnswer(text) {
    showOverlay(new ChoiceWindow({
      lines: [text],
      options: [
        { code: 'KeyW', label: 'W - ask another', action: () => openCategories() },
        toneOption(() => showAnswer(text)),
        { code: 'Escape', label: 'Esc - goodbye', action: () => {} },
        { code: 'KeyE', label: '', action: () => {} },
      ],
    }));
  }

  function frame(dt) {
    hud.tick(dt);
    overlay?.tick?.(dt);   // D1: the death sequence's clock (any overlay may want one)
    // U41: a window may FINISH inside its own tick - the travel
    // popup's day countdown departs on a clock, not on a key - and
    // this seam had no done check, so such a window stayed painted
    // over the world until the next keypress. The dungeon host's
    // tickOverlay (dungeonContext:2692-2696) has always had one.
    if (overlay?.done) dropOverlay();
    const s = hudScale(canvas.width, canvas.height);
    if (font) hud.draw(renderer, canvas, font, s);
    // ROAD close-P: THE STACK IS PAINTED, NOT JUST ITS TOP.
    // DaggerfallPopupWindow.Draw (:77-86) runs `previousWindow.Draw()`
    // before its own, and every box DaggerfallUI.MessageBox opens
    // carries the then-top as its previousWindow (DaggerfallUI.cs:1330)
    // - so a pushed box is drawn OVER a live window, not instead of
    // it. This slot painted the top alone, which is why the courtroom
    // CORT01I0 stood under every plea box of a trial and was never
    // once rendered. Deepest first, then the slot's own occupant.
    if (overlay && font) {
      windows.eachCoveredWindow((w) => w.draw(renderer, canvas, font, s));
      overlay.draw(renderer, canvas, font, s);
    } else if (overlay && !font) dropOverlay(false);   // font-less: never trap the motor
  }

  // U8b: pointer routing for native windows (phone taps + mouse) -
  // the hosts call this BEFORE requestLook; a consumed click never
  // grabs pointer lock. Canvas CSS size maps to backing pixels first.
  function pointerdown(e) {
    // U47 (AUDIT 18, routed 62): THE GUARD IS ON THE WINDOW, not on
    // its click method. This tested `overlay?.click` and so let a
    // click FALL THROUGH whenever the open window had no click
    // handler - straight to the host's requestLook, which grabs
    // pointer lock out from under the menu the player is reading. DFU
    // has no such hole: its top window consumes the click whatever it
    // does with it. worldModes.js carries the corrected shape with
    // this reasoning spelled out beside it; this host was the copy
    // that never got it.
    if (!overlay) return false;
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    const m = nativeMetrics(canvas);
    const v = pointToNative(m, px, py);
    // BOTH lanes optional-chained this line for different reasons and
    // both stand: a window may have no `click` at all (V5/U48's rest
    // window has none), and a window that HAS one may clear this slot
    // from inside it (S40's does, through the PopToHUD door), so the
    // `.done` read below is optional too.
    // ROAD-C c2/S10: a window with the THREE-PHASE seam takes the press
    // through it and never through `click` as well - two 'down's would
    // arm the automap chrome's press-hold machine twice.
    if (v) {
      if (overlay.pointer) overlay.pointer('down', v[0], v[1], e.button ?? 0);
      else overlay.click?.(v[0], v[1], e.button === 2);   // I4: the remove gesture rides the button
    }
    if (overlay?.done) dropOverlay();
    return true;   // an open native window owns the pointer either way
  }

  /**
   * ROAD-C c2/S10: THE OTHER TWO POINTER PHASES, on this slot.
   * dungeonContext has carried `overlayPointer` since c2/S4 because the
   * automap's chrome is press-HOLD and drag driven; the town map is the
   * same machine (ui/automapChrome.js, EXTERIOR_ACTIONS) in the
   * exterior hosts' slot, and a host that delivers `down` alone latches
   * a drag that spins the map forever - with nothing to error on.
   *
   * A window that has no `pointer` is untouched: every window on this
   * slot before S10 keeps the click-only seam above.
   *
   * The RELEASE is delivered WHEREVER it lands, including outside the
   * canvas (the listener is on the window, not the canvas) - the
   * chrome's own header records why that is deliberate.
   */
  function pointer(phase, e) {
    if (!overlay?.pointer) return false;
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    const v = pointToNative(nativeMetrics(canvas), px, py);
    overlay.pointer(phase, v ? v[0] : -1, v ? v[1] : -1, e.button ?? 0);
    if (overlay?.done) dropOverlay();
    return true;
  }

  /** U37: THE HOVER SEAM - native coords to whatever window is up.
   *  Hovering never closes a window, so no done check. */
  function hover(e) {
    if (!overlay?.hover) return false;
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    const v = pointToNative(nativeMetrics(canvas), px, py);
    // U41: the EVENT rides along, the way U20a's keydown seam does -
    // the travel map's zoomed pan is a SHIFT-move, and modifier state
    // reaches a window no other way.
    overlay.hover(v ? v[0] : -1, v ? v[1] : -1, e);
    return true;
  }

  /** The wheel seam (U-scroll): an open window owns the wheel; the
   *  ones with overflow implement wheel(dir). */
  function wheel(e) {
    if (!overlay) return false;
    overlay.wheel?.(Math.sign(e.deltaY));
    return true;
  }

  return {
    keydown, keyup, tryActivate, frame, ensureLoaded, nextMode, setMode, showOverlay, pushOverlay, setTopics, pointerdown, pointer, wheel, hover,   // ROAD-B B1: pushOverlay is the stacking door beside the replacing one   // U45: setMode is the large HUD's mode panel, whose cycle is not nextMode's   // c2/S10: `pointer` is the RELEASE route (down rides pointerdown, move rides hover)
    openTalkWindow,   // B7: TalkToStaticNPC's window push routes here (worldModes' click + the guild popup's TALK)
    /** TK-v: the two halves of the tone the ENGINE asks the host for -
     *  which tone button is selected, and the tier computation for a
     *  given question. The GATE that decides when to recompute is the
     *  pipeline's, exactly as C# keeps it inside GetAnswerText. */
    toneIndex: () => tone,
    computeTier,
    texts: (id) => textVariants(id),
    // U23: the interior host's static-NPC seam needs both of these -
    // FACTION.TXT to route a click (PlayerActivate.StaticNPCClick reads
    // the NPC's and the building's faction records) and TEXT.RSC rows
    // for the parchment boxes the guild popup stacks. Both are already
    // loaded here, once, so worldModes borrows them rather than opening
    // a second copy of each file.
    get factionDict() { return factions?.factionDict ?? null; },
    // IH1: the quest world's two reads - the ONE name bag, and the
    // named-building directory the %nt tavern pick draws from
    nameOpts,
    get buildingDirectory() { return directory; },
    // AUDIT 22 F2: a RANDOM variant, because DFU shows nearly every
    // one of these with GetRandomTokens - the rank refusal alone has
    // eight, and the port drew the same one forever.
    // ROAD-A7: the reader takes a PICK. GetRandomTokens has two draws
    // (TextProvider.cs:228) and the painting macros are the dfRand one;
    // an omitted pick keeps this host's own `rolls`.
    lines: (id, pick = rolls) => textRsc?.variantLinesById(id, pick) ?? [],
    /** U40: MacroHelper.CityName (%cn). The reader has existed since
     *  T3 and only expandRecord could see it; the trade window's
     *  records quote it too ("the lowest prices in %cn"), so the
     *  accessor is exposed rather than a second locationName lookup
     *  being written in the host. */
    cityName: () => cityName(),
    /** TK-i: GetRandomTokens for the rumor mill (a random variant as
     *  TOKENS - AddNonQuestRumor freezes one per add). */
    variantTokens: (id) => textRsc?.variantTokensById(id, rolls) ?? [],
    /** AUDIT 24: TextProvider.GetRandomText - a flat pool of every Text
     *  token in the record, NOT a variant pick. %oth's seam. */
    randomText: (id) => textRsc?.randomTextById(id, rolls) ?? '',
    ensureFactions: () => ensureLoaded(),
    say: (line, delayInSeconds = undefined) => hud.add(line, delayInSeconds),   // AUDIT 28 W6: AddHUDText's delay arg rides through (ShopQualityHUDDelay)
    /** AUDIT 24 (wave 22): PopupText.AddText files every line it queues
     *  in the notebook's message ring (:123). The notebook is built by
     *  the quest bridge, which is built after this host, so the host
     *  hands the sink back down once it exists. */
    set hudMessageSink(fn) { hud.onMessage = fn; },
    get hudMessageSink() { return hud.onMessage; },
    /** MERGE AUDIT: the HUD TEXT LAYER on its own, for a host whose
     *  frame is not this one. worldModes' interior arm consumes the
     *  frame and returns, so a line said inside a building was queued
     *  into a HudText nothing ticked or drew - invisible where it was
     *  said, and then popping in the street on the first non-modal
     *  frame after the player walked out. It drives this directly. */
    hudFrame: (dt, font_ = font) => {
      hud.tick(dt);
      if (font_) hud.draw(renderer, canvas, font_, hudScale(canvas.width, canvas.height));
    },
    get overlayActive() { return !!overlay; },
    /** U38: the loaded HUD font, for the components drawHud draws
     *  (the crosshair's mode label). This module already owns the ONE
     *  FONT0003 both exterior hosts use; handing it out beats a second
     *  load per host. */
    get font() { return font; },
    /** AUDIT 21 (hosts lane, F6): the live overlay, so a death presenter can
     *  refuse to stack a second death screen on the first. */
    get overlay() { return overlay; },
    /** S40: PopToHUD. A window that must VACATE the slot before it
     *  hands control on - the rest window does, because DFU pops to
     *  the HUD before RaiseSkills and the level-up screen it can raise
     *  needs this slot free - has had no door to do it through. The
     *  identity guard is the caller's: pass the window that is
     *  closing, and a slot already holding something else is left
     *  alone. Runs the same drain `frame` does, callback included. */
    closeOverlay(win = null) {
      // The IDENTITY guard is this door's; the EMPTY-SLOT guard is
      // dropOverlay's, and asking twice would leave that one
      // unreachable - a guard no mutation can kill is a guard no
      // reader can trust (A PIN MUST FAIL, applied to the code).
      if (win && overlay !== win) return false;
      return dropOverlay();
    },
    get mode() { return getInteractionMode(); },
    get directory() { return directory; },   // E2: the hosts name shops for the browse window by buildingKey
    get locationName() { return cityName(); },   // G2: %cn for the court boxes (MacroHelper.CityName)
    _debug: () => ({
      mode: getInteractionMode(), overlay: !!overlay, people: peopleNow()?.name ?? null,
      buildings: directory.length, tone: TONE_NAMES[tone], toneSession: [...toneSession],
      native: !!overlay?.conversation, topicMode: overlay?.topicMode ?? null,
      topicCount: overlay?.topics?.length ?? null,
      overlayText: overlay?.conversation?.at(-1) ?? overlay?.lines?.[0] ?? overlay?.text ?? null,
      overlayOptions: overlay?.options?.filter((o) => o.label).map((o) => o.label) ?? null,
      overlayFlow: overlay?.flow ?? null,   // U10: the chargen probe reads the live flow
      npcName: overlay?.hooks?.npcName ?? null,   // U8b: the native window's name plate
      hooks: overlay?.hooks ?? null,              // the live session seam (question/answer)
      // U25: the inventory's box queue replaced the interim popup, so
      // the probe surface follows it - the equip refusal that S23
      // watched here is now a real TEXT.RSC box in this queue.
      overlayBox: (overlay?.boxes?.[0]?.rows ?? []).map((r) => r.text ?? r).join(' | ') || null,
      overlayRest: !!overlay?.isRestWindow,   // U48: the rest probe, in BOTH hosts that draw here
    }),
  };
}
