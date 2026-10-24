// @ts-check
// QL4/QL5-QL10 (bible/06-Systems/Questlines-Arc.md decision 3, section 2.3): THE FLAGSHIP QUESTS' BRANCHES, AS PATCHES.
// A flagship quest (section 3) that has no branch of its own is given one as SHAM-TRAIL gives its entry
// (systems/quest/questPatches.js applyTextPatches): an exact old text, how many times it must occur, the new - applied as
// the script is READ, never an edit of the vendored file, and a patch that no longer finds its text throws (here) or
// loads the quest as shipped (the pack's reader), so a changed file is never patched silently wrong.
//
// ONLY WHILE THE SWITCH IS ON. A quest begun with the switch off is DFU's to its end (decision 1), so its script is read
// as DFU's: the branch is patched in only when the layer is on as the script is read, and the stamp is decided at the
// start that follows the read (machine.js startQuestImmediate) - the two agree. A quest already running keeps the tasks it
// was parsed with whatever the switch says later (a load restores them, a share carries them).
//
// THE WORDS a branch adds are QUEST TEXT - QRC messages of the quest's own, numbered from QL_MESSAGE_BASE so no
// script's own id is taken - read in a translation's words by the -LOC route DFU's quest messages already read
// (quest/localizedQuest.js: Internal_Quests, `QUEST.messageId`). A patch's tasks are named `_ql..._`, so none shadows
// a script's own. Filed by family (patches/<family>.json), as the sheets are.
import { applyTextPatches } from '../quest/questPatches.js';
import { questlinesOn } from './qlLaw.js';
import { QL_FAMILY_NAMES } from './qlFamilies.js';
import FIGHTERS_GUILD from './patches/fightersGuild.json' with { type: 'json' };
import KNIGHTLY_ORDERS from './patches/knightlyOrders.json' with { type: 'json' };
import MAGES_GUILD from './patches/magesGuild.json' with { type: 'json' };
import THIEVES_GUILD from './patches/thievesGuild.json' with { type: 'json' };
import DARK_BROTHERHOOD from './patches/darkBrotherhood.json' with { type: 'json' };
import HOLY_ORDERS from './patches/holyOrders.json' with { type: 'json' };
import NOBILITY from './patches/nobility.json' with { type: 'json' };
import MERCHANTS from './patches/merchants.json' with { type: 'json' };
import COMMONERS from './patches/commoners.json' with { type: 'json' };
import WITCHES from './patches/witches.json' with { type: 'json' };
import VAMPIRES from './patches/vampires.json' with { type: 'json' };

/** The first message id a branch's own words may take. DFU's scripts number theirs from 1000; none uses an id from 1900 to
 *  1999 (the highest below is 1161 - A0C01Y13 alone goes past, to 2000, 2001 and 2005). AUDIT QUESTLINES BRANCH-18: the
 *  pins hold a patch's words to the band - from 1900, and never an id its script already has (ql1_sheets.test.js). */
export const QL_MESSAGE_BASE = 1900;

/** Every family's patches, by family name. */
export const QL_PATCH_FAMILIES = Object.freeze([FIGHTERS_GUILD, KNIGHTLY_ORDERS, MAGES_GUILD, THIEVES_GUILD, DARK_BROTHERHOOD, HOLY_ORDERS, NOBILITY, MERCHANTS, COMMONERS, WITCHES, VAMPIRES]);

/** The quests a branch is patched into: upper-case name -> its patches ({ old, new, count }), frozen. */
export const QL_PATCHES = (() => {
  const map = new Map();
  for (const fam of QL_PATCH_FAMILIES) {
    if (!QL_FAMILY_NAMES.includes(fam.family)) throw new Error(`qlPatches: ${fam.family} is no family`);
    for (const [name, list] of Object.entries(fam.patches ?? {})) {
      const key = name.toUpperCase();
      if (map.has(key)) throw new Error(`qlPatches: ${name} is patched by two families`);
      map.set(key, Object.freeze(list.map((p) => Object.freeze({ old: p.old, new: p.new, count: p.count }))));
    }
  }
  return map;
})();

/** Whether a quest's branch is patched in. */
export const hasQuestlinePatch = (name) => QL_PATCHES.has(String(name ?? '').toUpperCase());

/** The script's text with its branch patched in (`text` already carries the port's own patches - SHAM-TRAIL, FORAGE-FIX).
 *  Throws where a patch does not find its text exactly `count` times. */
export function applyQuestlinePatches(name, text) {
  const patches = QL_PATCHES.get(String(name ?? '').toUpperCase());
  return patches ? applyTextPatches('QL-PATCH', name, patches, text) : text;
}

const _warned = new Set();
/**
 * The lines a quest is read with NOW: its branch patched in while the switch is on (`on`), else as given. A patch that
 * no longer finds its text warns once and the script is read as given - one patch never takes a quest down.
 * @param {string} name @param {string[]|null} lines @param {boolean} [on]
 */
export function questlineLines(name, lines, on = questlinesOn()) {
  if (!lines || !on || !hasQuestlinePatch(name)) return lines;
  try {
    return applyQuestlinePatches(name, lines.join('\n')).split('\n');
  } catch (e) {
    if (!_warned.has(name)) { _warned.add(name); console.warn(`[questlines] ${e?.message ?? e} - ${name} read without its branch`); }
    return lines;
  }
}
