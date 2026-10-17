// COME SAIL AWAY's HELM KEYS - the registry actions the helm reads, a LEAF (HUD-HELM, 2026-10-15). The enhanced helm
// panel (ui/enhanced/enhancedHelm.js) presses these by name, and HUD-HELM put the panel among HUD-MOVE's pieces: the editor's
// preview builds it while nobody is at a helm, so the HUD reaches the panel's module. Read from systems/comeSailAway/comeSailAway.js,
// the names carried the sea's whole law onto the HUD's graph with them - its map, the travel map window and, through
// the chargen art's biography, the quest machine's place.js, which AUDIT GUIDE O6 keeps off the HUD (the cycle GUIDE3
// met). The sea's module imports the table from here and re-exports it, so every other reader keeps its import.
// INT1's comeSailAwayHulls.js is the same cut for the same reason.

/** The mod's two helm keys this slice reads, as the port's registry actions (KB1: one key, one action). */
export const BOAT_ACTIONS = Object.freeze({
  disembark: 'BoatDisembark', toggleLight: 'BoatToggleLight',
  // CSA-E: the sails' and the trim's (Controls.ToggleSail, TrimRight, TrimLeft, TrimModifier)
  toggleSail: 'BoatToggleSail', trimRight: 'BoatTrimRight', trimLeft: 'BoatTrimLeft', trimModifier: 'BoatTrimModifier',
  // CSA-G: the time scale's three (Controls.IncreaseTimeScale, DecreaseTimeScale, ResetTimeScale)
  timeScaleUp: 'BoatTimeScaleUp', timeScaleDown: 'BoatTimeScaleDown', timeScaleReset: 'BoatTimeScaleReset',
  // HELM-KEYS (the port's, DECLARED): the arrows' more and less sail (MoreSail, LessSail)
  sailUp: 'BoatSailUp', sailDown: 'BoatSailDown',
});
