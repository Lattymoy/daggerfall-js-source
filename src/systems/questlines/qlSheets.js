// @ts-check
// QL1 (bible/06-Systems/Questlines-Arc.md section 2.2): THE OBJECTIVE SHEETS - one a quest, data the port writes, filed
// by family (sheets/<family>.json), and the law that checks a sheet against the shape and against its own script.
//
// A SHEET NAMES ONLY WHAT ITS SCRIPT HAS (section 2.5) - the law that checks it is the tools' (tools/qlSheetLaw.mjs
// sheetProblems: a binding of a kind the law does not read, a task, item, clock or foe the parsed quest does not hold, a
// journal step its script never writes, a choice task nothing in the script can set, an outcome that names a pay the
// rewards do not know). The game reads sheets the pins (test/systems/questlines/ql1_sheets.test.js) have already held to
// their scripts, so it never runs the check - and its words, a writer's and never a player's, stay out of the game.
//
// The sheets are quest text (decision 3: Daggerfall's words stay, the port's are added): their lines are English and
// read in a translation's words where a pack carries them (qlText's table, Internal_Questlines), as DFU's own quest
// messages read their -LOC files - not the Port_Strings catalog, which is the port's interface.
import { QL_FAMILY_NAMES } from './qlFamilies.js';
import FIGHTERS_GUILD from './sheets/fightersGuild.json' with { type: 'json' };
import KNIGHTLY_ORDERS from './sheets/knightlyOrders.json' with { type: 'json' };
import MAGES_GUILD from './sheets/magesGuild.json' with { type: 'json' };
import THIEVES_GUILD from './sheets/thievesGuild.json' with { type: 'json' };
import DARK_BROTHERHOOD from './sheets/darkBrotherhood.json' with { type: 'json' };
import HOLY_ORDERS from './sheets/holyOrders.json' with { type: 'json' };
import NOBILITY from './sheets/nobility.json' with { type: 'json' };
import MERCHANTS from './sheets/merchants.json' with { type: 'json' };
import COMMONERS from './sheets/commoners.json' with { type: 'json' };
import WITCHES from './sheets/witches.json' with { type: 'json' };
import VAMPIRES from './sheets/vampires.json' with { type: 'json' };
import DAEDRA from './sheets/daedra.json' with { type: 'json' };
import MAIN_QUEST from './sheets/mainQuest.json' with { type: 'json' };
import MODS from './sheets/mods.json' with { type: 'json' };
import QUESTLINES from './sheets/questlines.json' with { type: 'json' };

/** Every family's sheets, in the order the waves wrote them (Questlines-Arc.md section 9) - qlFamilies.js's order. */
export const SHEET_FAMILIES = Object.freeze([FIGHTERS_GUILD, KNIGHTLY_ORDERS, MAGES_GUILD, THIEVES_GUILD, DARK_BROTHERHOOD, HOLY_ORDERS, NOBILITY, MERCHANTS, COMMONERS, WITCHES, VAMPIRES, DAEDRA, MAIN_QUEST, MODS, QUESTLINES]);
if (SHEET_FAMILIES.map((f) => f.family).join() !== QL_FAMILY_NAMES.join()) throw new Error('qlSheets: the families\' files and QL_FAMILY_NAMES disagree');

/** The pay an outcome may name (systems/questlines/qlRewards.js PAY_PROFILES - written here so the law that checks a
 *  sheet never imports the rewards' makers). */
export const PAY_NAMES = Object.freeze(['standard', 'lesser', 'greater', 'double', 'betrayal', 'own', 'none']);

/** The quest names whose sheets stand: upper-case name -> the sheet, frozen. */
export const SHEETS = (() => {
  const map = new Map();
  for (const fam of SHEET_FAMILIES) {
    for (const s of fam.sheets ?? []) {
      const key = String(s.quest ?? '').toUpperCase();
      if (!key || map.has(key)) continue;   // sheetProblems names a duplicate; the first stands
      map.set(key, Object.freeze({ ...s, family: fam.family }));
    }
  }
  return map;
})();

/** The quest's sheet, or null (DFU's journal alone). */
export const sheetFor = (questName) => SHEETS.get(String(questName ?? '').toUpperCase()) ?? null;
