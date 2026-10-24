// DEX3 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 7) - PLAYERGPS'S EVENTS, for a module that listens
// to them as a mod's handler does (Daggerfall Enemy Expansion picks its climate tables on them, BestiaryMod.cs:1784-1871).
// PlayerGPS.Update raises OnClimateIndexChanged (RaiseEvents, PlayerGPS.cs:561-576), then OnEnterLocationRect or
// OnExitLocationRect (PlayerLocationRectCheck, :669-716), each on an edge of the player's own reading. The port's
// reading of the player's place is the encounter law's (systems/encounters.js intermittentEnemySpawn and the camps'
// rolls, every minute they run out of doors), so those raise these - no host polls a second copy of it.
// The trackers start where PlayerGPS's do: the climate at 0 (Start reads CurrentClimateIndex before the first
// UpdateWorldInfo has set it, :315-320 - so the first reading raises its climate) and the rect flag false (so the first
// reading inside a rect raises its entry). A handler is handed the climate it would read off PlayerGPS
// (CurrentClimateIndex - already the reading's, RaiseEvents running first).
// A LEAF.

const _listeners = [];
let _climate, _inRect;
/** Where PlayerGPS.Start leaves its trackers. */
const start = () => { _climate = 0; _inRect = false; };
start();

/** Listen: `{ climateIndexChanged?(climateIndex), enterLocationRect?(climateIndex), exitLocationRect?(climateIndex) }`. */
export function onPlayerGpsEvents(listener) {
  if (!listener || typeof listener !== 'object') throw new Error('onPlayerGpsEvents: { climateIndexChanged, enterLocationRect, exitLocationRect }');
  _listeners.push(listener);
}

/** The player's reading - its climate index and whether it stands in a location's rect (PlayerGPS.IsPlayerInLocationRect,
 *  the widened rect) - raising each event its edge is, in PlayerGPS.Update's order. A field the reading lacks raises nothing. */
export function readPlayerGps({ climateIndex, inLocationRect }) {
  if (Number.isInteger(climateIndex) && climateIndex !== _climate) {
    _climate = climateIndex;
    for (const l of _listeners) l.climateIndexChanged?.(_climate);
  }
  if (typeof inLocationRect !== 'boolean' || inLocationRect === _inRect) return;
  _inRect = inLocationRect;
  for (const l of _listeners) (_inRect ? l.enterLocationRect : l.exitLocationRect)?.(_climate);
}

/** The jumps PlayerGPS resets on, as the port's jump core names them (scenes/world.js `_teleportToPixel`'s `modEvent`):
 *  a load's start (SaveLoadManager.OnStartLoad) and a fast travel's end (DaggerfallTravelPopUp.OnPostFastTravel) - its
 *  constructor's subscriptions (:301-303). OnNewGame, the third, is the page's boot, where the trackers start. */
const RESET_ON = new Set(['load', 'travel']);

/** PlayerGPS.ResetState (:398-401) on a jump that raises it: the rect flag false, raising nothing - so a reading inside a
 *  town after it raises that town's entry, the one it left included. The climate tracker stays (ResetState leaves
 *  lastClimateIndex). A jump that names neither (a Recall, a guild's teleport, a respawn) keeps the flag, as DFU does.
 *  AUDIT DEX C1: the port's jump core hands every jump's kind here, where the host's own rect flag drops; which of them
 *  reset is this module's, so the host plays the event and holds no rule of PlayerGPS's (HOST-SPLIT). */
export function resetPlayerGpsState(jump) { if (RESET_ON.has(jump)) _inRect = false; }

/** The test seam: no listener, and the trackers where PlayerGPS.Start leaves them. */
export function _resetPlayerGps() { _listeners.length = 0; start(); }
