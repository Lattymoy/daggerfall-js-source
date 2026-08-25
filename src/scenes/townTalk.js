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
// FLAGGED loud: Info mode opens the same talk window (DFU routes
// Info/Grab/Talk on mobiles identically); the TFAC portrait art is
// the one T3c piece still open (guards-on-pickpocket, topics and
// tones all SHIPPED - AUDIT 23 retired those clauses); pickpocket
// gold/nothing land as HUD lines where DFU raises a modal MessageBox
// ("not successful" IS a HUD popup in DFU too) - the box swap rides
// the U-arc message-box rollout to these hosts.

import { FactionFile } from '../formats/factionFile.js';
import { TextRsc } from '../formats/textRsc.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { TalkWindow } from '../ui/talkWindow.js';
import { hudScale } from '../ui/hud.js';
import { overlayAction } from '../ui/input.js';
import {
  getPeopleOfCurrentRegion, getReactionToPlayer, pickpocketTownsperson, findFactions,
  MOBILE_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE, PICKPOCKET_DISTANCE, FOUND_NOTHING_VALUABLE_TEXT_ID,
} from '../systems/talk.js';
import { startMobileTalk, expandMacros, expandAnswerRecord, oathTextId, honorificOf, raceDisplayName } from '../systems/talkSession.js';
import { REGION_RACES } from '../formats/mapsFile.js';
import { ChoiceWindow } from '../ui/talkWindow.js';
import { buildBuildingDirectory, TOPIC_CATEGORIES, whereIsAnswer, reactionTier012, buildingHint } from '../systems/talkTopics.js';
import { LIST_ITEM_TYPE, QUESTION_TYPE } from '../systems/topicTree.js';   // TK-vi: the window's rows are the tree's ListItems; B6: the Work question type
import { discoverBuilding } from '../systems/discovery.js';   // T4: %loc's mark side effect
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { FACTION_TYPES } from '../formats/factionFile.js';
import { skillValue, tallySkill, SKILLS } from '../systems/skills.js';
import { NativeTalkWindow, preloadTalkArt, talkArtLoaded } from '../ui/nativeTalk.js';   // U8b
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';   // U8b: pointer routing

export const TONE_NAMES = ['Polite', 'Normal', 'Blunt'];   // T3f: TalkTone -> index (DFU TalkToneToIndex)

// R1: the mode itself moved to player/interactionMode.js (DFU's
// currentMode is GLOBAL - the dungeon door ladder reads it too);
// townTalk keeps the keydown, the HUD line and these re-exports.
export { MODES, nextInteractionMode } from '../player/interactionMode.js';
import { MODES, getInteractionMode, setInteractionMode, nextInteractionMode } from '../player/interactionMode.js';
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

export function createTownTalk({ renderer, canvas, fetchBytes, playerEntity, regionIndex, onCrime = null, topics = null, palette = null, rolls = Math.random, talkEngine = null }) {
  /** TK-v: the talk engine, or null before it is built / with no
   *  game data. A getter, because world.js wires the four modules to
   *  each other and can only hand them over once all four exist. */
  const engine = () => (typeof talkEngine === 'function' ? talkEngine() : talkEngine);
  const hud = new HudText();
  let font = null, factions = null, textRsc = null, people = null;
  let overlay = null;
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

  const npcRace = REGION_RACES[regionIndex] === 1 ? 'Redguard' : 'Breton';

  async function ensureLoaded() {
    if (loaded || loading) return loading;
    loading = (async () => {
      try { font = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003'); }
      catch { console.warn('[town] FONT0003.FNT unavailable; talk UI text disabled'); }
      if (palette) preloadTalkArt({ renderer, fetchBytes, palette });   // U8b: TALK01I0 (art-less keeps the text chain)
      try {
        factions = new FactionFile();
        factions.load(await fetchBytes('FACTION.TXT'));
        people = getPeopleOfCurrentRegion(factions.factionDict, regionIndex);
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
  function rebuildDirectory() {
    directory = [];
    if (!topics || !factions) return;
    try {
      const region = topics.regionIndex ?? regionIndex;
      const province = findFactions(factions.factionDict, { type: FACTION_TYPES.Province, region })[0];
      directory = buildBuildingDirectory(topics.exteriorBuildings, topics.blocks, topics.doors, {
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
      });
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
    oath: raw.includes('%oth') ? randomVariant(oathTextId(npcRace), '') : '',
    cityName: cityName(),
  });
  const randomVariant = (id, fallback) => {
    const v = textRsc?.plainText(id);
    return v?.length ? v[Math.floor(rolls() * v.length)] : fallback;
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
      if (overlay.done) {
        // AUDIT 2026-08-17c: clear the close-callback BEFORE firing -
        // a stale G2 callback (e.g. the court verdict) must never
        // re-fire when a LATER unrelated window closes.
        const cb = _onOverlayClosed;
        _onOverlayClosed = null;
        overlay.dispose?.();   // A2: a window holding GL resources frees them (idempotent)
        overlay = null;
        cb?.();
      }
      return true;
    }
    return false;
  }

  // G2: the arrest/court flows push their own windows through the
  // same overlay slot (one motor-holding seam).
  let _onOverlayClosed = null;
  // A2 (the A1 death-presenter lesson, applied to THIS slot): every
  // point that drops the occupant must free its GL resources - the
  // automap windows own uploaded textures and billboard batches, and
  // uploadTexture memoizes forever, so a silent replace both leaks
  // and leaves a live cache key behind.
  function showOverlay(win, onClosed = null) {
    if (overlay && overlay !== win) overlay.dispose?.();
    overlay = win;
    _onOverlayClosed = onClosed;
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
    if (getInteractionMode() === 'steal' && bestDist > PICKPOCKET_DISTANCE) { hud.add('You are too far away.'); return true; }
    ensureLoaded().then(() => activate(best, bestDist));
    return true;
  }

  function activate(target, dist) {
    if (getInteractionMode() === 'steal') {
      // PlayerActivate: pickpocket once per person, 3.2 max
      if (dist > PICKPOCKET_DISTANCE) { hud.add('You are too far away.'); return; }
      if (target.person.pickpocketAttempted) return;
      target.person.pickpocketAttempted = true;
      const r = pickpocketTownsperson(playerEntity, {
        rolls,
        nothingText: () => randomVariant(FOUND_NOTHING_VALUABLE_TEXT_ID, 'You found nothing valuable.'),
      });
      hud.add(r.message);
      // G1: the caught pickpocket IS the crime - SpawnCityGuards(true)
      if (!r.success) onCrime?.();
      return;
    }
    // Info / Grab / Talk all talk to a mobile NPC (DFU verbatim)
    const reaction = people ? getReactionToPlayer(people, playerEntity) : 0;
    const t = startMobileTalk({
      reaction, textVariants, playerName: playerEntity.name ?? '', npcRace, rolls, cityName: cityName(),
    });
    if (t.refused) { hud.add(t.text || 'You get no response.'); return; }
    if (!directory.length) { overlay = new TalkWindow(t); return; }
    // T3c: the greeting carries the Where-is entry; the NPC keeps a
    // stable per-person seed for the reaction-tier roll (DFU seeds by
    // the NPC object hash - engine-dependent, so a lazily-assigned
    // uniform seed stands in, Ledger A).
    target.person._talkSeed ??= Math.floor(rolls() * 0x7fffffff);
    _talkNpc = target.person;
    // TK-v: TalkToNpc's session reset is the ENGINE's - both halves of
    // it - so a host cannot clear one and forget the other. Without an
    // engine the local fallbacks stand in.
    const eng = engine();
    if (eng?.session) {
      eng.session.toneReactionForTalkSession[0] = 0;
      eng.session.toneReactionForTalkSession[1] = 0;
      eng.session.toneReactionForTalkSession[2] = 0;
      eng.pipeline?.resetToneSession();
    }
    toneSession = [0, 0, 0];   // T3f: per talk session (DFU TalkToNpc)
    lastToneIndex = -1;
    // AUDIT 18 F4 - StartNewConversation (TalkManager.cs:867-871),
    // which DaggerfallTalkWindow.OnPush runs through
    // SetStartConversation (:654) on EVERY window push. Without the
    // reset the counter only ever climbed, so 7215+tone (the greeting
    // opening) was reachable at most ONCE per play session and every
    // later conversation opened on the follow-up (7218+tone).
    // TK-v: the counter is the PIPELINE's now, and the whole of
    // StartNewConversation is the SESSION's - the deferred topic-list
    // rebuild and the mill setup ride with it, which the local
    // fallback never had.
    engine()?.session?.startNewConversation();
    _questionsAsked = 0;
    // U8b: the native TALK01I0 window when the art is up (clicks/taps
    // through the verbatim hit rects; the keyed chain is the fallback)
    openTalkWindow(t.text, { npcSeed: _talkNpc?._talkSeed ?? 0, npcName: _talkNpc?.nameNPC ?? '' });
  }

  /** B7: THE ONE WINDOW-OPENER. The mobile path above and
   *  TalkToStaticNPC's fall-through (the worldModes static-NPC click,
   *  the guild popup's TALK button) both land here - DFU has one
   *  DaggerfallTalkWindow and every conversation pushes it
   *  (TalkManager.cs:2616-2663 ends in pushTalkWindow). The session
   *  resets are NOT here: the mobile path runs its own above, and
   *  talkToStaticNPC runs the C# ones inside the engine. Art-less or
   *  building-less sessions keep the keyed greeting chain. */
  function openTalkWindow(greeting, { npcSeed = 0, npcName = '' } = {}) {
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
        answer: (row) => (row.listItem
          ? eng.pipeline.getAnswerText(row.listItem, { npcSeed })
          : answerText(row)),
        question: (row) => {
          if (row.listItem) return eng.pipeline.getQuestionText(row.listItem, tone);
          const q = questionText(row); _questionsAsked++; return q;   // AUDIT 17e F13 (the engine's counter climbs in getAnswerText)
        },
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

  /** GetReactionToPlayer_0_1_2 (:632-690) for the CURRENT tone and
   *  question. TK-iii's pipeline owns the gate that decides WHEN this
   *  runs (`lastToneIndex`) and TK-iv's session owns the per-session
   *  cache it fills - so this is the tier computation alone, handed
   *  to the pipeline as its `reactionTier` seam. */
  function computeTier(questionType, socialGroup) {
    void questionType;
    return reactionTier012({
      personality: playerEntity.stats?.personality ?? 50,
      npcSeed: _talkNpc?._talkSeed ?? 0,
      socialGroup: socialGroup ?? 0,
      questionIndex: 0, toneIndex: tone,
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
    const rp = people ? getReactionToPlayer(people, playerEntity) : 0;
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
      if (h.reveal) discoverBuilding(`${regionIndex}:${cityName()}`, building);
    }
    // AUDIT 18 F1: ExpandRandomTextRecord (TalkManager.cs:3580-3587)
    // runs the FULL MacroHelper over the answer record - %oth and %cn
    // resolve here exactly as they do in the greeting.
    return expandAnswerRecord(raw, {
      playerName: playerEntity.name ?? '',
      oath: raw.includes('%oth') ? randomVariant(oathTextId(npcRace), '') : '',
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
    if (overlay?.done) {
      const cb = _onOverlayClosed;
      _onOverlayClosed = null;
      overlay.dispose?.();
      overlay = null;
      cb?.();
    }
    const s = hudScale(canvas.width, canvas.height);
    if (font) hud.draw(renderer, canvas, font, s);
    if (overlay && font) overlay.draw(renderer, canvas, font, s);
    else if (overlay && !font) { overlay.dispose?.(); overlay = null; }   // font-less: never trap the motor
  }

  // U8b: pointer routing for native windows (phone taps + mouse) -
  // the hosts call this BEFORE requestLook; a consumed click never
  // grabs pointer lock. Canvas CSS size maps to backing pixels first.
  function pointerdown(e) {
    if (!overlay?.click) return false;
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    const m = nativeMetrics(canvas);
    const v = pointToNative(m, px, py);
    if (v) overlay.click(v[0], v[1], e.button === 2);   // I4: the remove gesture rides the button
    if (overlay.done) {
      const cb = _onOverlayClosed; _onOverlayClosed = null; overlay.dispose?.(); overlay = null; cb?.();
    }
    return true;   // an open native window owns the pointer either way
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
    keydown, tryActivate, frame, ensureLoaded, nextMode, setMode, showOverlay, setTopics, pointerdown, wheel, hover,   // U45: setMode is the large HUD's mode panel, whose cycle is not nextMode's
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
    // AUDIT 22 F2: a RANDOM variant, because DFU shows nearly every
    // one of these with GetRandomTokens - the rank refusal alone has
    // eight, and the port drew the same one forever.
    lines: (id) => textRsc?.variantLinesById(id, rolls) ?? [],
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
    say: (line) => hud.add(line),
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
      if (!overlay || (win && overlay !== win)) return false;
      const cb = _onOverlayClosed;
      _onOverlayClosed = null;
      overlay.dispose?.();
      overlay = null;
      cb?.();
      return true;
    },
    get mode() { return getInteractionMode(); },
    get directory() { return directory; },   // E2: the hosts name shops for the browse window by buildingKey
    get locationName() { return cityName(); },   // G2: %cn for the court boxes (MacroHelper.CityName)
    _debug: () => ({
      mode: getInteractionMode(), overlay: !!overlay, people: people?.name ?? null,
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
    }),
  };
}
