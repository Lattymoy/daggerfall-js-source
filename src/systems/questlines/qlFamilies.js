// @ts-check
// QL5-QL10 (bible/06-Systems/Questlines-Arc.md sections 3 and 9): THE FAMILIES the sheets and the branches are filed by
// - one file of each a family (sheets/<family>.json, patches/<family>.json) - and which quests each holds. A leaf: the
// sheets' and the patches' registries read it, and the pins (test/systems/questlines/ql1_sheets.test.js) hold every
// quest a player can be given to exactly one family's sheet.

/** The families, in the order the waves write them. */
export const QL_FAMILY_NAMES = Object.freeze([
  'FightersGuild', 'KnightlyOrders', 'MagesGuild', 'ThievesGuild', 'DarkBrotherhood', 'HolyOrders',
  'Nobility', 'Merchants', 'Commoners', 'Witches', 'Vampires', 'Daedra', 'MainQuest', 'Mods',
  'Questlines',   // QL12-QL16: the questlines' own quests (qlLines.js), written by the port
]);

/** A QuestList-Classic.txt group's family (the Thieves Guild is DFU's GeneralPopulace). */
export const LIST_GROUP_FAMILY = Object.freeze({
  FightersGuild: 'FightersGuild', KnightlyOrder: 'KnightlyOrders', MagesGuild: 'MagesGuild', GeneralPopulace: 'ThievesGuild',
  DarkBrotherHood: 'DarkBrotherhood', HolyOrder: 'HolyOrders', Nobility: 'Nobility', Merchants: 'Merchants',
  Commoners: 'Commoners', Witches: 'Witches', Vampires: 'Vampires',
});

/** The quests no classic list offers, by family: the sixteen Princes' summonings (systems/daedraSummoning.js), the two
 *  cures (systems/racialQuests.js), the main quest (34 S0000 scripts and _BRISIEN - quest/machine.js isMainQuestName's
 *  set), DFU's own custom list's one, and the mods' (vendored with their authors' permission). */
export const UNLISTED_FAMILY = Object.freeze({
  Daedra: Object.freeze(['10C00Y00', '20C00Y00', '30C00Y00', '40C00Y00', '50C00Y00', '60C00Y00', '70C00Y00', '80C0XY00', '90C00Y00',
    'T0C00Y00', 'U0C00Y00', 'V0C00Y00', 'W0C00Y00', 'X0C00Y00', 'Y0C00Y00', 'Z0C00Y00']),
  Vampires: Object.freeze(['$CUREVAM', '$CUREWER']),
});
