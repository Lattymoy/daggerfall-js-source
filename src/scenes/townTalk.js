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
// Info/Grab/Talk on mobiles identically); guards on failed
// pickpocket pend the crime slice; topics/tones/portrait pend T3c;
// pickpocket gold/nothing land as HUD lines where DFU raises a
// modal MessageBox ("not successful" IS a HUD popup in DFU too) -
// the box swap rides the U-arc message-box rollout to these hosts.

import { FactionFile } from '../formats/factionFile.js';
import { TextRsc } from '../formats/textRsc.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { TalkWindow } from '../ui/talkWindow.js';
import { hudScale } from '../ui/hud.js';
import {
  getPeopleOfCurrentRegion, getReactionToPlayer, pickpocketTownsperson, findFactions,
  MOBILE_NPC_ACTIVATION_DISTANCE, PICKPOCKET_DISTANCE, FOUND_NOTHING_VALUABLE_TEXT_ID,
} from '../systems/talk.js';
import { startMobileTalk, expandMacros } from '../systems/talkSession.js';
import { REGION_RACES } from '../formats/mapsFile.js';
import { ChoiceWindow } from '../ui/talkWindow.js';
import { buildBuildingDirectory, TOPIC_CATEGORIES, whereIsAnswer } from '../systems/talkTopics.js';
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { FACTION_TYPES } from '../formats/factionFile.js';

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

export function createTownTalk({ renderer, canvas, fetchBytes, playerEntity, regionIndex, onCrime = null, topics = null, rolls = Math.random }) {
  const hud = new HudText();
  let font = null, factions = null, textRsc = null, people = null;
  let mode = 'grab';   // PlayerActivate default
  let overlay = null;
  let loaded = false, loading = null;
  let directory = [];   // T3c: the location's named buildings

  const npcRace = REGION_RACES[regionIndex] === 1 ? 'Redguard' : 'Breton';

  async function ensureLoaded() {
    if (loaded || loading) return loading;
    loading = (async () => {
      try { font = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003'); }
      catch { console.warn('[town] FONT0003.FNT unavailable; talk UI text disabled'); }
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
      if (overlay.isChoiceWindow) overlay.input(e.code);
      else if (e.code === 'Escape') overlay.input('back');
      else if (e.code === 'Enter' || e.code === 'KeyE') overlay.input('confirm');
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
    if (!best || bestDist > MOBILE_NPC_ACTIVATION_DISTANCE) return false;
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
      reaction, textVariants, playerName: playerEntity.name ?? '', npcRace, rolls,
    });
    if (t.refused) { hud.add(t.text || 'You get no response.'); return; }
    if (!directory.length) { overlay = new TalkWindow(t); return; }
    // T3c: the greeting carries the Where-is entry; the NPC keeps a
    // stable per-person seed for the reaction-tier roll (DFU seeds by
    // the NPC object hash - engine-dependent, so a lazily-assigned
    // uniform seed stands in, Ledger A).
    target.person._talkSeed ??= Math.floor(rolls() * 0x7fffffff);
    _talkNpc = target.person;
    showOverlay(new ChoiceWindow({
      lines: [t.text],
      options: [
        { code: 'KeyW', label: 'W - where is...', action: () => openCategories() },
        { code: 'Escape', label: 'Esc - goodbye', action: () => {} },
        { code: 'KeyE', label: '', action: () => {} },
        { code: 'Enter', label: '', action: () => {} },
      ],
    }));
  }

  let _talkNpc = null;

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
    // knows/doesn't-know table half) + the %hnt hint chain: a 7333
    // variant with %loc = the building, %di = the compass hint.
    const a = whereIsAnswer(topics.playerPos(), building, playerEntity.stats?.personality ?? 50, _talkNpc?._talkSeed ?? 0);
    const hint = randomVariant(7333, '%loc is %di of here')
      .replaceAll('%loc', building.name).replaceAll('%di', a.direction);
    let text = randomVariant(a.textId, '%hnt');
    text = expandMacros(text, { playerName: playerEntity.name ?? '' })
      .replaceAll('%hnt', hint).replaceAll('%key', building.name)
      .replaceAll('%hnr', 'Sir').replaceAll('%ra', 'Breton');   // honorific/race macros FLAGGED interim
    showOverlay(new ChoiceWindow({
      lines: [text],
      options: [
        { code: 'KeyW', label: 'W - ask another', action: () => openCategories() },
        { code: 'Escape', label: 'Esc - goodbye', action: () => {} },
        { code: 'KeyE', label: '', action: () => {} },
      ],
    }));
  }

  function frame(dt) {
    hud.tick(dt);
    const s = hudScale(canvas.width, canvas.height);
    if (font) hud.draw(renderer, canvas, font, s);
    if (overlay && font) overlay.draw(renderer, canvas, font, s);
    else if (overlay && !font) overlay = null;   // font-less: never trap the motor
  }

  return {
    keydown, tryActivate, frame, ensureLoaded, nextMode, showOverlay, setTopics,
    texts: (id) => textVariants(id),
    say: (line) => hud.add(line),
    get overlayActive() { return !!overlay; },
    get mode() { return mode; },
    _debug: () => ({
      mode, overlay: !!overlay, people: people?.name ?? null,
      buildings: directory.length,
      overlayText: overlay?.lines?.[0] ?? overlay?.text ?? null,
      overlayOptions: overlay?.options?.filter((o) => o.label).map((o) => o.label) ?? null,
    }),
  };
}
