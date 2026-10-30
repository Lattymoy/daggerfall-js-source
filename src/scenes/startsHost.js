// @ts-check
// START2 (2026-10-24, bible/06-Systems/Alternate-Starts-Arc.md section 8): THE WORLD'S STARTS - where a new character's
// story begins, in the open world's host (src/scenes/fishHost.js is the shape: a module the host wires, owning its state).
//
// The boot of a new game stands the classic start first (world.js's U31 start cell, Privateer's Hold, the character
// made over it), and the character's last question is where their story begins (ui/startChoice.js, `startKey`).
//   - the Iliac Bay's: they are where the boot put them, and its quest starts there (_STARTIB);
//   - a province's: once the land past the Bay has its trace (or never will - TESA2's wait), its start dungeon is the
//     one its quest's Place names (questWorld.js startSiteOfId: the nearest of the kinds its story wants near its
//     capital, a quest item's marker in it - scenes/tamrielPlacesHost.js startLairAt), the character is moved into it
//     as a quest's teleport moves them (world.js _respawnAtSite - or to its door, StartInDungeon off), and its quest
//     starts there. Where none stands they wake where they are, said, and the Bay's start is theirs;
//   - a character born at no start (a family's heir at its seat, LEGACY1; a dev boot outside the classic start) is
//     handed the commission at once (HAND_START_QUEST).
// `then(questName)` is the host's own OnStartGame (world.js questInitAtGameStart: the quests, the welcome tour) - run
// once the character stands where their story begins, so its first popup is read there.
//
// THE WRIT (PASSAGE, bible/03-World/Passage.md "The writ"): a start's commission, opened, carries the Crown's writ of
// passage to the city of Daggerfall - a friendly master at any harbour sails its bearer there for nothing (`writ`).
import { BAY_START, HAND_START_QUEST, MAIN_QUEST_OPENER, STARTS, carriesWrit, isStartQuestName, startByKey, startSiteId } from '../systems/starts/starts.js';
import { gameStartQuests } from './quest/questBridge.js';   // AUDIT STARTS W5: a story never begun, begun at its load
import { Symbol as QuestSymbol } from '../systems/quest/symbol.js';   // AUDIT STARTS Q1: a task by the name the machine files it under
import { getBool } from '../systems/settings/settings.js';
import { REPOSITION } from '../systems/ship.js';   // AUDIT STARTS W6: the door's own landing, the death respawn's at a dungeon
import { longitudeLatitudeToMapPixel, REGION_NAMES } from '../formats/mapsFile.js';
import { t } from '../systems/textManager.js';
import { CYRODIIL_THEATRE } from '../systems/wild/cyrodiilZone.js';   // AUDIT STARTS W2: online, the open zone is the Imperial Province
import { PROVINCE_OF_ID } from '../world/tamriel/tamrielLand.js';

/** How long a province's start waits on the land past the Bay's trace. The trace's promise settles when it lands and
 *  when it fails (world.js arenaTraced), so this bounds only a fetch that hangs; a start that gives up names no dungeon
 *  (AUDIT STARTS Q6: one named on the authored shape stands no lair once the trace lands - six of the seven on the
 *  freeware - and a start's Place is fixed), and the Bay's start is theirs. */
export const START_LAND_WAIT_MS = 60000;
/** A province's move waits on the boot's world this often, this many times (a birth online's own wait, realmBirth). */
export const START_READY_MS = 250;
export const START_READY_TRIES = 240;
/** The city a commission sends its bearer to, and the port its writ is honoured for. */
export const WRIT_PORT = Object.freeze({ name: 'Daggerfall', region: 'Daggerfall' });
/** The task a start's commission sets when its seal is broken - asked as a Symbol, so by the name Quest files it under
 *  (quest.js getTask: the symbol's inner name; AUDIT STARTS Q1: a raw '_opened_' never matched one). */
const OPENED = new QuestSymbol('_opened_');
/** A province's start: its dungeon's Place, and the task the commission's finding sets (AUDIT STARTS W3). */
const LAIR = new QuestSymbol('_lair_'), FOUND = new QuestSymbol('_found_');
const PROVINCE_QUESTS = new Set(STARTS.filter((s) => s.site).map((s) => s.quest.toUpperCase()));

export const STARTS_TEXT = Object.freeze({
  /** A province's start that found no dungeon to stand in. */
  get noSite() { return t('start.noSite', 'No way to that province could be found. Your story begins in the Iliac Bay.'); },
  /** AUDIT STARTS W2: why the page shuts the Imperial Province's start to a character born online - its row's tag. */
  get openZone() { return t('start.openZone', 'the open zone online'); },
});

/**
 * @param {{ params: URLSearchParams, pastBay: boolean, quests: () => any,
 *   teleport: (px: number, py: number, localPos?: any, opts?: any) => Promise<void>,
 *   landReady: Promise<void>, talk: { say: (text: string) => void }, machine: () => any, ready?: () => boolean,
 *   landWaitMs?: number }} host
 *   `pastBay` - the land past the Bay stands its lairs (world.js _lairTemplates); `quests` - the quest layer's world
 *   (scenes/questWorld.js: startSiteOfId, a start's site; respawnLatched, the quest's own move into it); `teleport` - the
 *   world's move to a pixel (_teleportToPixel); `landReady` - the trace landed or never will (world.js arenaTraced);
 *   `talk` - the street's voice (townTalk); `machine` - the quest machine; `ready` - the boot's world stands (its
 *   classic start's own entry done: world.js playerSpawned and _bootLoaded, no load under way), which a province's move
 *   waits on; `landWaitMs` - the longest the land's trace is waited on (a test's)
 */
export function createStartsHost(host) {
  const { params, pastBay, quests, teleport, landReady, talk, machine, ready = () => true, landWaitMs = START_LAND_WAIT_MS } = host;
  let chosen = null;
  /** AUDIT STARTS W2: online the Imperial Province is the open zone (systems/wild/cyrodiilZone.js, WW-C2), and every
   *  dungeon in it is sealed but the day's halls (bible/11-Multiplayer/Wild-Zone.md) - a start there wakes in a dungeon
   *  the character could never enter again once the realm's page reloads online. A character born online is not
   *  offered it; offline the province is no zone, and the start stands. */
  const zoneShut = (start) => params.has('online') && !!start?.province && start.province === PROVINCE_OF_ID[CYRODIIL_THEATRE];
  /** Can the world stand `start`? The Bay's always; a province's where the land past the Bay stands its lairs, and online
   *  never inside the open zone. */
  const open = (start) => start === BAY_START || (!!pastBay && !!start?.province && !zoneShut(start));
  /** Why a start the host cannot stand is shut - the page's tag for it (null: the page's own word). */
  const why = (start) => (zoneShut(start) ? STARTS_TEXT.openZone : null);
  /** The page's answer, else the boot's `?start=` (a dev door for a headless character), else the Bay's. */
  const startNow = () => startByKey(chosen) ?? startByKey(params.get('start')) ?? BAY_START;
  /** The Bay's start is Privateer's Hold's: a character the boot stood anywhere else is handed the commission. */
  const bayQuest = () => (params.has('classic') ? BAY_START.quest : HAND_START_QUEST);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** The page's answer (a start's key; anything else is none). */
  const choose = (key) => { if (startByKey(key)) chosen = key; };

  /** Into the start dungeon - as a quest's teleport moves the player, latched as it is (AUDIT STARTS W5: no load, save,
   *  journey or Recall lands while its dungeon builds) - inside, its start; or to its door (W6: on the pixel's start
   *  marker, the death respawn's landing at a dungeon's door - never the pixel's middle, inside a model). */
  async function moveInto(loc) {
    if (getBool('Startup', 'StartInDungeon')) { await quests().respawnLatched(loc); return; }
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    await teleport(p.x, p.y, null, { reposition: REPOSITION.RandomStartMarker });
  }
  /** Is a start quest of this name running? (AUDIT STARTS Q6: its Place may still refuse a site the host named.) */
  const running = (name) => [...(machine?.()?.quests?.values?.() ?? [])].some((q) => q?.questName === name && !q.questComplete && !q.questTombstoned);

  /** Settled once the story has begun (`then` has run) - what a birth online waits on before its first save (world.js
   *  realmBirth: the realm's first checkpoint is the character where their story begins, its quest running). */
  /** @type {(v?: any) => void} */
  let settle = () => {};
  const settled = new Promise((r) => { settle = r; });
  /** Where the story begins (`key` the page's answer, when it has one), then `then(questName)`. Once a character; the
   *  move's failure is never a trap. AUDIT STARTS Q5/W5: a load that lands while the start is on its way (the machine
   *  restored: quest/machine.js `restores`) is the game now, its own story - the new character's start is dropped,
   *  never moved or begun over it. */
  let begun = false;
  async function begin(then, key = null) {
    if (begun) return;
    begun = true;
    choose(key);
    const restores = machine?.()?.restores ?? 0;
    try { await beginNow(then, () => (machine?.()?.restores ?? 0) === restores); } finally { settle(); }
  }
  /** The boot's world stands - a province's move waits on it, never racing the classic start's own entry (at most
   *  START_READY_TRIES waits of START_READY_MS, as a birth online waits for the world). */
  async function worldStands() {
    for (let i = 0; !ready() && i < START_READY_TRIES; i++) await wait(START_READY_MS);
  }
  async function beginNow(then, live) {
    const start = startNow();
    if (start.province && open(start)) {
      const landed = await Promise.race([Promise.resolve(landReady).then(() => true, () => true), wait(landWaitMs).then(() => false)]);
      await worldStands();
      if (!live()) return;
      const loc = landed ? quests()?.startSiteOfId?.(startSiteId(start)) ?? null : null;
      if (loc) {
        // AUDIT STARTS W4: the move alone is caught - `then` and what it starts throw as they would anywhere - and a move
        // that failed may have left the player anywhere (its teleport landed, the dungeon refused): the commission in
        // hand is true wherever they stand, where the Bay's would sit in Privateer's Hold
        let moved = false;
        try { await moveInto(loc); moved = true; } catch (e) { console.warn('[starts] the move into the start dungeon failed', e); }
        if (!live()) return;
        then(moved ? start.quest : HAND_START_QUEST);
        // AUDIT STARTS Q6: and a start its Place refused after all is no start - the commission handed over in its place
        if (!running(moved ? start.quest : HAND_START_QUEST)) machine?.()?.startQuestByName?.(HAND_START_QUEST);
        return;
      }
      talk.say(STARTS_TEXT.noSite);
    }
    then(bayQuest());   // the Bay's - chosen, or the province's that found no dungeon (the player still where the boot stood them)
  }

  /** THE WRIT: is `port` the one an opened start's commission sends its bearer to? (passageHost.js `writ`) While the start
   *  runs: an ended start stays a week among the machine's quests, tombstoned, its seal still broken (AUDIT STARTS V2);
   *  and only a commission that is a writ (starts.js carriesWrit - not the Bay's, V3). */
  function writ(port) {
    if (port?.name !== WRIT_PORT.name || REGION_NAMES[port.region] !== WRIT_PORT.region) return false;
    for (const q of machine?.()?.quests?.values?.() ?? []) {
      if (!q || q.questComplete || q.questTombstoned || !carriesWrit(q.questName)) continue;
      if (q.getTask?.(OPENED)?.getTriggerValue?.()) return true;
    }
    return false;
  }

  /** AUDIT STARTS W3: does a load at dungeon pixel `px` land in a running province start's own dungeon, its commission
   *  still in it (not yet found)? A birth online's first checkpoint is the character there (`settled`, world.js
   *  realmBirth), and the page reloads into that save online - where a load never puts a character back inside a dungeon
   *  but the Hold (world.js ONLINE-UNDERGROUND-LOAD1): it woke them at the door, told they had slept underground, and
   *  re-entered the public room, which online is laid at the world's size and holds none of a quest's things. Such a
   *  load stands inside, through the quest's own entry (scenes/instanceDoor.js entryFor: its instance, whole). */
  function resumesAt(px) {
    return !!px && commissionIn((sd) => sd.worldPixel?.x === px.x && sd.worldPixel?.y === px.y);
  }
  /** START-INSTANCE (FIELD BUGS 2026-10-30g): is dungeon `mapId` a running province start's own, its commission still in
   *  it? Its door offers no Public row then (scenes/instanceDoor.js): that room is laid smaller and stands none of it. */
  function lairOpen(mapId) {
    return Number.isFinite(mapId) && commissionIn((sd) => (Number(sd.mapId) >>> 0) === (mapId >>> 0));
  }
  function commissionIn(lairIs) {
    for (const q of machine?.()?.quests?.values?.() ?? []) {
      if (!q || q.questComplete || q.questTombstoned || !PROVINCE_QUESTS.has(String(q.questName).toUpperCase())) continue;
      const sd = q.getPlace?.(LAIR)?.siteDetails;
      if (sd && lairIs(sd) && !q.getTask?.(FOUND)?.getTriggerValue?.()) return true;
    }
    return false;
  }

  /** AUDIT STARTS W5: a load restored the machine (world.js, its two load doors). A character saved before their story
   *  began - a save in the seconds a start waits on the land's trace and the world, or a page closed then - holds no
   *  story at all: no start, no _BRISIEN, nothing of the main story ever begun (quest/machine.js storyStarted: a new
   *  character's curse is among it from the first tick). Loaded, it is handed the commission (the curse beside it, as
   *  every new game's), never left without a way into the story. A save from before the story was kept says nothing of
   *  it (storyLegacy) and is left alone. Answers true: the game's start is the save's now (world.js _questStarted). */
  function restored() {
    const m = machine?.();
    const begun = !m || m.storyLegacy || (m.storyStarted?.size ?? 0) > 0
      || [...(m.quests?.values?.() ?? [])].some((q) => isStartQuestName(q?.questName) || String(q?.questName ?? '').toUpperCase() === MAIN_QUEST_OPENER);
    if (!begun) for (const name of gameStartQuests(HAND_START_QUEST)) m.startQuestByName(name);
    return true;
  }

  return {
    /** The chargen door's start question (systems/chargenSession.js `startChoice`). */
    page: Object.freeze({ open, why }),
    open,
    /** The page's answer (a start's key). */
    choose,
    begin,
    settled,
    writ,
    resumesAt,
    lairOpen,
    restored,
    /** Which start this character takes (tests, the probes). */
    get start() { return startNow(); },
  };
}
