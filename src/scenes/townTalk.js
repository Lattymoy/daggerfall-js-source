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
import { discoverBuilding } from '../systems/discovery.js';   // T4: %loc's mark side effect
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { FACTION_TYPES } from '../formats/factionFile.js';
import { skillValue, tallySkill, SKILLS } from '../systems/skills.js';
import { NativeTalkWindow, preloadTalkArt, talkArtLoaded } from '../ui/nativeTalk.js';   // U8b
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';   // U8b: pointer routing

export const TONE_NAMES = ['Polite', 'Normal', 'Blunt'];   // T3f: TalkTone -> index (DFU TalkToneToIndex)

export const MODES = ['steal', 'grab', 'info', 'dialogue'];
const MODE_KEYS = { F1: 'steal', F2: 'grab', F3: 'info', F4: 'dialogue' };

/** NextInteractionMode, verbatim: Steal > Grab > Info > Talk > wrap. */
export function nextInteractionMode(mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}
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

export function createTownTalk({ renderer, canvas, fetchBytes, playerEntity, regionIndex, onCrime = null, topics = null, palette = null, rolls = Math.random }) {
  const hud = new HudText();
  let font = null, factions = null, textRsc = null, people = null;
  let mode = 'grab';   // PlayerActivate default
  let overlay = null;
  let loaded = false, loading = null;
  let directory = [];   // T3c: the location's named buildings
  // T3f: the talk tone (persists across sessions, as DFU's window
  // selection does); the reaction cache + tier recompute-on-change
  // reset per session (TalkToNpc's toneReactionForTalkSession).
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
    if (m === mode) return;   // ChangeInteractionMode: no-op on the same mode
    mode = m;
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
  function showOverlay(win, onClosed = null) { overlay = win; _onOverlayClosed = onClosed; }

  /** NextInteractionMode (the touch cycle button); returns the new mode. */
  function nextMode() { setMode(nextInteractionMode(mode)); return mode; }

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
    if (mode !== 'steal' && bestDist > MOBILE_NPC_ACTIVATION_DISTANCE) { hud.add('You are too far away.'); return true; }
    if (mode === 'steal' && bestDist > PICKPOCKET_DISTANCE) { hud.add('You are too far away.'); return true; }
    ensureLoaded().then(() => activate(best, bestDist));
    return true;
  }

  function activate(target, dist) {
    if (mode === 'steal') {
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
    if (talkArtLoaded() && directory.length) {
      showOverlay(new NativeTalkWindow(t.text, {
        categories: () => TOPIC_CATEGORIES
          .map((c) => ({ label: c.caption, buildings: directory.filter((b) => b.buildingType === c.type) }))
          .filter((c) => c.buildings.length)
          .map((c) => ({ label: c.label, buildings: c.buildings.map((b) => ({ label: b.name, ...b })) })),
        answer: (b) => answerText(b),
        question: (b) => { const q = questionText(b); _questionsAsked++; return q; },   // AUDIT 17e F13
        tone: () => tone,
        setTone: (t2) => { tone = t2; },
        npcName: _talkNpc?.nameNPC ?? '',   // AUDIT 18 F5: the NPC's OWN name, not the People faction
      }));
      return;
    }
    showGreeting(t.text);
  }

  let _talkNpc = null;

  // T3f: GetAnswerText's gate - the tier recomputes only when the
  // tone CHANGED since the last question (lastToneIndex); the
  // session cache keeps each tone's reaction (skill roll included)
  // fixed for the whole conversation.
  function tierNow() {
    if (lastToneIndex !== tone) {
      currentTier = reactionTier012({
        personality: playerEntity.stats?.personality ?? 50,
        npcSeed: _talkNpc?._talkSeed ?? 0,
        socialGroup: 0, questionIndex: 0, toneIndex: tone,
        skillValue: tone === 0 ? skillValue(playerEntity, SKILLS.Etiquette)
          : tone === 2 ? skillValue(playerEntity, SKILLS.Streetwise) : 0,
        session: toneSession, rolls,
        onTally: (s) => tallySkill(playerEntity, SKILLS[s], 1),
      });
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
    const opening = randomVariant((_questionsAsked === 0 ? 7215 : 7218) + tone, 'Hail to thee');
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
    const s = hudScale(canvas.width, canvas.height);
    if (font) hud.draw(renderer, canvas, font, s);
    if (overlay && font) overlay.draw(renderer, canvas, font, s);
    else if (overlay && !font) overlay = null;   // font-less: never trap the motor
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
    if (v) overlay.click(v[0], v[1]);
    if (overlay.done) {
      const cb = _onOverlayClosed; _onOverlayClosed = null; overlay = null; cb?.();
    }
    return true;   // an open native window owns the pointer either way
  }

  /** The wheel seam (U-scroll): an open window owns the wheel; the
   *  ones with overflow implement wheel(dir). */
  function wheel(e) {
    if (!overlay) return false;
    overlay.wheel?.(Math.sign(e.deltaY));
    return true;
  }

  return {
    keydown, tryActivate, frame, ensureLoaded, nextMode, showOverlay, setTopics, pointerdown, wheel,
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
    ensureFactions: () => ensureLoaded(),
    say: (line) => hud.add(line),
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
    /** AUDIT 21 (hosts lane, F6): the live overlay, so a death presenter can
     *  refuse to stack a second death screen on the first. */
    get overlay() { return overlay; },
    get mode() { return mode; },
    get directory() { return directory; },   // E2: the hosts name shops for the browse window by buildingKey
    get locationName() { return cityName(); },   // G2: %cn for the court boxes (MacroHelper.CityName)
    _debug: () => ({
      mode, overlay: !!overlay, people: people?.name ?? null,
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
