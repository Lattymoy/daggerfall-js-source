// PX24 - THE CHRONICLE'S ONE DOOR.
//
// Mac: "with the logbook and history, I want them as one detailed UI."
//
// TWO WINDOWS BECAME ONE BECAUSE THEY ARE ONE SUBJECT. The logbook
// (ui/questJournal.js) and the history (ui/playerHistory.js) are
// separate classic windows built at four sites between them:
//
//   ui/charSheetNav.js:53   the sheet's LOGBOOK button
//   ui/charSheetNav.js:61   the sheet's HISTORY button
//   scenes/world.js:3146    the world host's own logbook
//   scenes/dungeonContext.js the dungeon's
//
// The seam is the U52/U53/PX23 shape a sixth time. What is new is the
// SHAPE of what it opens on the enhanced skin: one window, because
// what these two hold is one thing - THE THINGS WRITTEN DOWN ABOUT
// YOU. Your own notes, the messages you were sent, and where you came
// from.
//
// QUESTS ARE IN IT, and MAC-K2 is why they had to be. This note used
// to read "QUESTS ARE NOT IN IT, and that is deliberate... the pause
// window's Quests tab has carried those since PX4... putting them here
// too would be the two character sheets again". The reasoning is
// sound about DUPLICATION and wrong about WHICH DOOR: the L key is
// InputManager's `LogBook`, this is the window it opens, and what it
// showed a player pressing it was their notebook. Mac, 2026-09-15:
// "Logbook not reflecting quests."
//
// Worse, the hosts had all four been handing `questMessages` in and
// `chronicleModel` never read it - a dep in, nothing out, which is the
// exact shape AUDIT-EOTB spent a day on.
//
// The duplication the old note feared is answered where it actually
// lives: the WALK is `scenes/questBridge.js`'s `questLog()` and the
// rail it builds is `ui/questRail.js`, both shared with the pause tab,
// so the two faces cannot disagree about which quests are live or what
// they say. What differs is the drawing, and two faces drawing one
// model differently is the whole point of having two skins.
import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhancedChunk.js';   // MENU1: the one lazy-chunk door
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab puts it away
import { QuestJournalWindow, questJournalArtLoaded } from './questJournal.js';
import { PlayerHistoryWindow, playerHistoryArtLoaded } from './playerHistory.js';

export { questJournalArtLoaded, playerHistoryArtLoaded };

/** The gate a host asks. On the enhanced skin the window reads no
 *  ARENA2 at all; on the classic one each half needs its own art, so
 *  a host that can open one and not the other still gets the one.
 *  Same law as charSheetDoor's and spellbookDoor's. */
export const chronicleDoorReady = () => isEnhanced() || questJournalArtLoaded();
export const historyDoorReady = () => isEnhanced() || playerHistoryArtLoaded();

/**
 * Open the chronicle. `deps` is what only the host knows:
 *   entity                the player (the history is their backStory)
 *   notebook              the PlayerNotebook, or null
 *   questMessages         every quest log message, for the classic modes
 *   questLog              MAC-K2: `{active, finished}` off the host's
 *                         own quest walk - the ENHANCED window's Quests
 *                         section. The classic skin keeps its flat
 *                         `questMessages`, which is the shape its own
 *                         two windows were written for; a host that
 *                         hands neither gets a section that says so
 *   mode                  which classic mode to open on ('notebook' etc)
 *   currentLocationName / canFindPlace / gotoPlace
 *                         the world questions only a host with a map
 *                         can answer; a host without one leaves them
 *                         unset, which is the same nothing a
 *                         CanFindPlace miss produces
 *   section               'quests' | 'notes' | 'messages' | 'history' - where the
 *                         ENHANCED window opens. The classic windows
 *                         are two, so this is also which of them the
 *                         classic skin gets.
 *   partyMembers          QUEST1, OURS not DFU's: the party's OTHER
 *                         accounts right now, or omitted/empty - the
 *                         enhanced Quests section's Share button draws
 *                         only when this is non-empty, and only the
 *                         enhanced skin ever asks (the classic logbook
 *                         is untouched). A host with no online layer
 *                         supplies nothing, which is silence, not a bug.
 *   shareQuest            QUEST1: (uid, questName, displayName) => void
 *                         - the Share button's own click, wired to
 *                         net/online.js's shareQuest through
 *                         systems/questShare.js's prepareQuestShare.
 *   pageShare             JOURNAL1, OURS not DFU's: () => null | {
 *                         readers, why, show, letter } - a NOTE's Share
 *                         in the enhanced Notes section. `readers` are
 *                         the players near enough to talk to, nearest
 *                         first ({id, name}); `why` says why there are
 *                         none; `show(id, page)` holds the page out to
 *                         one and answers the sentence that says what
 *                         happened; `letter(page)` (null with no
 *                         letters) answers true when the letters will
 *                         open on the page once this window is down, or
 *                         the sentence that says why not. Null - a host
 *                         with no online layer - draws no Share at all.
 */
export function createChronicleWindow(deps = {}) {
  const section = deps.section ?? 'notes';
  if (isEnhanced() && typeof document !== 'undefined') {
    if (!chronicleDoorReady()) return null;
    return enhancedChronicleOverlay(deps, section);
  }
  // THE CLASSIC SKIN KEEPS ITS TWO WINDOWS. They are different art,
  // different layouts and different laws; merging them is an ENHANCED
  // idea and the classic side does not get ideas.
  if (section === 'history') {
    return playerHistoryArtLoaded() ? new PlayerHistoryWindow(deps.entity) : null;
  }
  if (!questJournalArtLoaded()) return null;
  return new QuestJournalWindow({
    questMessages: deps.questMessages ?? (() => []),
    notebook: deps.notebook ?? (() => null),
    mode: deps.mode,
    currentLocationName: deps.currentLocationName,
    canFindPlace: deps.canFindPlace,
    gotoPlace: deps.gotoPlace,
  });
}

function enhancedChronicleOverlay(deps, section) {
  let host = null;
  let view = null;
  let done = false;
  let unregister = () => {};   // PX28
  const close = () => {
    if (done) return;
    done = true;
    unregister();
    try { view?.destroy?.(); } catch { /* already gone */ }
    try { host?.remove(); } catch { /* ditto */ }
    host = null; view = null;
    deps.onClose?.();
  };
  host = document.createElement('div');
  host.id = 'enhanced-chronicle';
  host.style.cssText = 'position:fixed;inset:0;z-index:11';
  document.body.append(host);
  unregister = registerOverlay(close);
  // MENU1: the ONE lazy-chunk door (ui/enhancedChunk.js).
  mountEnhancedChunk({
    load: () => import('./enhancedChronicle.js'),
    mount: ({ mountEnhancedChronicle }) => { view = mountEnhancedChronicle(host, { ...deps, section, onExit: close }); },
    alive: () => !done, host, onDismiss: close, label: 'chronicle',
  });
  return {
    // THE HOST CONTRACT, in the hosts' own words - `input`, not
    // `onKey`. The hosts dereference these unguarded (townTalk.js's
    // `overlay.input(a, e)`, dungeonContext's `activeOverlay.input`,
    // worldModes') and the DOM view only claims the keys it uses, so
    // every other key arrives here; a missing arm is a TypeError thrown
    // inside the host's keydown handler. Same arms as ui/pauseDoor.js,
    // ui/inventoryDoor.js, ui/charSheetDoor.js and ui/spellbookDoor.js.
    //
    // CRASH1 (2026-09-15, reported from live play: "opening the logbook
    // and pressing L reliably causes the errors ... as well as sometimes
    // randomly when trying to access the pause menu with escape"). This
    // window had `onKey`/`onPointer` - a contract NOTHING in the tree
    // reads - and no `input`. So every key `overlayAction` maps threw:
    // any letter, digit or space (it returns 'char:<k>' for those, which
    // is what L is) and Escape ('back'), which is the pause key. The
    // three sibling doors carry this comment BECAUSE they hit it first;
    // the rule was enforced by memory in three files and missed in the
    // fourth. test/crash1_overlay_contract.test.js derives it now.
    isChoiceWindow: true,
    get done() { return done; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    // `close`, `dispose` and `destroy` are the hosts' three words for
    // the same act - townTalk's showOverlay frees the OUTGOING window
    // with `dispose?.()`, and without it the div outlived the object:
    // a second logbook press left the first one's node in the body and
    // its Tab registration live.
    close,
    dispose: close,
    destroy: close,
  };
}
