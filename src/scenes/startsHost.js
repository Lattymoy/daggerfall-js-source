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
import { BAY_START, HAND_START_QUEST, isStartQuestName, startByKey, startSiteId } from '../systems/starts/starts.js';
import { getBool } from '../systems/settings/settings.js';
import { longitudeLatitudeToMapPixel, REGION_NAMES } from '../formats/mapsFile.js';
import { t } from '../systems/textManager.js';

/** How long a province's start waits on the land past the Bay's trace before it stands on the authored shape (TESA2's
 *  ARENA_LOAD_WAIT_MS: the boot's load waits as long for the same trace). */
export const START_LAND_WAIT_MS = 8000;
/** A province's move waits on the boot's world this often, this many times (a birth online's own wait, realmBirth). */
export const START_READY_MS = 250;
export const START_READY_TRIES = 240;
/** The city a commission sends its bearer to, and the port its writ is honoured for. */
export const WRIT_PORT = Object.freeze({ name: 'Daggerfall', region: 'Daggerfall' });

export const STARTS_TEXT = Object.freeze({
  /** A province's start that found no dungeon to stand in. */
  get noSite() { return t('start.noSite', 'No way to that province could be found. Your story begins in the Iliac Bay.'); },
});

/**
 * @param {{ params: URLSearchParams, pastBay: boolean, questSite: (id: number) => any,
 *   respawnAt: (loc: any) => Promise<void>, teleport: (px: number, py: number) => Promise<void>,
 *   landReady: Promise<void>, talk: { say: (text: string) => void }, machine: () => any, ready?: () => boolean }} host
 *   `pastBay` - the land past the Bay stands its lairs (world.js _lairTemplates); `questSite` - the quest layer's site
 *   for a start's site id (questWorld.js startSiteOfId); `respawnAt` / `teleport` - the world's moves (_respawnAtSite,
 *   _teleportToPixel); `landReady` - the trace landed or never will (world.js arenaTraced); `talk` - the street's
 *   voice (townTalk); `machine` - the quest machine; `ready` - the boot's world stands (its classic start's own entry
 *   done: world.js playerSpawned and _bootLoaded, no load under way), which a province's move waits on
 */
export function createStartsHost(host) {
  const { params, pastBay, questSite, respawnAt, teleport, landReady, talk, machine, ready = () => true } = host;
  let chosen = null;
  /** Can the world stand `start`? The Bay's always; a province's where the land past the Bay stands its lairs. */
  const open = (start) => start === BAY_START || (!!pastBay && !!start?.province);
  /** The page's answer, else the boot's `?start=` (a dev door for a headless character), else the Bay's. */
  const startNow = () => startByKey(chosen) ?? startByKey(params.get('start')) ?? BAY_START;
  /** The Bay's start is Privateer's Hold's: a character the boot stood anywhere else is handed the commission. */
  const bayQuest = () => (params.has('classic') ? BAY_START.quest : HAND_START_QUEST);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** The page's answer (a start's key; anything else is none). */
  const choose = (key) => { if (startByKey(key)) chosen = key; };

  /** Into the start dungeon - as a quest's teleport moves the player (inside, its start), or to its door. */
  async function moveInto(loc) {
    if (getBool('Startup', 'StartInDungeon')) { await respawnAt(loc); return; }
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    await teleport(p.x, p.y);
  }

  /** Settled once the story has begun (`then` has run) - what a birth online waits on before its first save (world.js
   *  realmBirth: the realm's first checkpoint is the character where their story begins, its quest running). */
  /** @type {(v?: any) => void} */
  let settle = () => {};
  const settled = new Promise((r) => { settle = r; });
  /** Where the story begins (`key` the page's answer, when it has one), then `then(questName)`. Once a character; the
   *  move's failure is said, never a trap. */
  let begun = false;
  async function begin(then, key = null) {
    if (begun) return;
    begun = true;
    choose(key);
    try { await beginNow(then); } finally { settle(); }
  }
  /** The boot's world stands - a province's move waits on it, never racing the classic start's own entry (at most
   *  START_READY_TRIES waits of START_READY_MS, as a birth online waits for the world). */
  async function worldStands() {
    for (let i = 0; !ready() && i < START_READY_TRIES; i++) await wait(START_READY_MS);
  }
  async function beginNow(then) {
    const start = startNow();
    if (start.province && open(start)) {
      await Promise.race([landReady, wait(START_LAND_WAIT_MS)]);
      await worldStands();
      const loc = questSite(startSiteId(start));
      if (loc) {
        try {
          await moveInto(loc);
          then(start.quest);
          return;
        } catch (e) { console.warn('[starts] the move into the start dungeon failed', e); }
      }
      talk.say(STARTS_TEXT.noSite);
    }
    then(bayQuest());   // the Bay's - chosen, or the province's that found no dungeon
  }

  /** THE WRIT: is `port` the one an opened start's commission sends its bearer to? (passageHost.js `writ`) */
  function writ(port) {
    if (port?.name !== WRIT_PORT.name || REGION_NAMES[port.region] !== WRIT_PORT.region) return false;
    for (const q of machine?.()?.quests?.values?.() ?? []) {
      if (isStartQuestName(q.questName) && q.tasks?.get('_opened_')?.getTriggerValue?.()) return true;
    }
    return false;
  }

  return {
    /** The chargen door's start question (systems/chargenSession.js `startChoice`). */
    page: Object.freeze({ open }),
    open,
    /** The page's answer (a start's key). */
    choose,
    begin,
    settled,
    writ,
    /** Which start this character takes (tests, the probes). */
    get start() { return startNow(); },
  };
}
