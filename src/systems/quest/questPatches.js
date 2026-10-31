// @ts-check
// SHAM-TRAIL (FIELD BUGS 2026-10-17b, the Discord's #bug-reports, "The Possessed Child": "I complete the possessed child
// by giving the child the scarab to help exorcise the demon from her. The woman who gave me the scarab said the daedra
// would appear somewhere in the home to fight after, but no daedra spawned" - "Quest is now unable to be completed"):
// THE PORT'S PATCHES OVER DFU'S OWN QUESTS, applied as the pack is read (scenes/quest/questData.js). Not a DFU member -
// each patch is a departure, named in Port-Ledger A.
//
// The vendored quests stay verbatim (vendor/dfu-quests/README.md); a patch is an exact old text with how many times it
// must occur, and one that finds its text any other number of times throws, so a changed file is never patched silently
// wrong (FORAGE-FIX's law, which is this file's applyTextPatches now - one home for both tables).
//
// C0B00Y02, The Possessed Child. `pick one of _sham_ _real_` at the start: half the quests are a guardian's scam. The
// priest's 1019 promises the Daedroth in both ("When the exorcism is complete, it will leave her and appear elsewhere
// in _house_"), and in the sham the child takes the relic, says 1016 ("I'll keep this _item_ for protection.
// Goodbye!") and is gone - `_revealsham_` moves the guardian to `_house2_` and stands a prostitute at `_tavern_`, who
// alone will say where he went (`_bribe_`, 50 gold). The task files no journal entry: the latest still sends the player
// to the priest (1020), the Town tier rings the priest's house, and neither the priest nor the questor answers until
// the relic is back (`_victory_`). Nothing the player is shown leads to the tavern, so the quest read as broken - in DFU
// too, which ships the same script. The patch files one entry at the reveal (1027, step 4 - the script's 0-3 and 6
// are taken) that says what the player saw and sends them back to the tavern, the place it names (ui/quest/questLens.js
// entryTarget); the rest of the trail is DFU's. A quest saved past the reveal keeps the actions it was saved with
// (task.js restoreSaveData restores them whole) - the entry reaches a quest begun after the deploy.

import { t } from '../textManager.js'; // the entry is the port's own words

/** @typedef {{ old: string, new: string, count: number }} TextPatch */

/** The text with `patches` applied, each found exactly `count` times (`label` names the table in the throw). Line
 *  endings are read as LF first - a checkout that turned the files to CRLF patches the same. Throws on a mismatch. */
export function applyTextPatches(label, name, patches, text) {
  let out = text.replace(/\r\n?/g, '\n');
  for (const p of patches) {
    const found = out.split(p.old).length - 1;
    if (found !== p.count) throw new Error(`${label}: ${name} holds "${p.old.trim()}" ${found} times, not ${p.count}`);
    out = out.split(p.old).join(p.new);
  }
  return out;
}

/** SHAM-TRAIL's entry - the journal's voice (1013, 1020, 1026): no pronoun macro (%g reads the last person named, and
 *  this names two), and no `=child_` (a Person's details macro is its race - "a Nord named ..."). The port's own words,
 *  so the text core's (`quest.possessedChild.shamTrail`, drafted in the whole languages - a translation keeps the four
 *  `_symbol_` names, which the quest expands), read as a quest is read: the player's language when it starts. */
export const SHAM_TRAIL_MESSAGE = 1027;
export const SHAM_TRAIL_STEP = 4;
const SHAM_TRAIL_EN =
  'No daedra came out of _child_ when I brought the _item_. _child_ just thanked me and ran off with it. Something is not right here. _guardian_ was staying at _tavern_, and someone there may know more.';
/** A journal message's source width - the script's own lines run about this long (1013, 1020, 1026). */
export const ENTRY_WIDTH = 34;

/** `text` as a message's lines: words greedily to ENTRY_WIDTH, each line led by the script's one space; never an empty
 *  line (an empty line ends a message - parser.js _parseQRC), a word longer than the width on a line of its own. */
export function entryLines(text, width = ENTRY_WIDTH) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(` ${line}`);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(` ${line}`);
  return lines;
}

/** The patches by quest name, each built as it is asked for (the entry's words in the language of that moment).
 *
 *  A0C00Y10 (The Duel), QUEST-AUDIT III DUEL-TOWN (Quest-Audit-II's "Recorded, not changed"): the journal said the duel
 *  was "at _inn_ in ___giver_" - the questor's town - and where the town mods took the town's tavern away the inn is the
 *  nearest town's (place.js NEAR-SITE): Glaghton Court's duel is at Moriribia's inn, and the journal sent the player to
 *  Glaghton Court. The inn's own town (`___inn_`) is the questor's wherever the inn is in it, so DFU's words stand there. */
export const QUEST_PATCHES = Object.freeze({
  // _BRISIEN (the main quest's opener), START1 (bible/06-Systems/Alternate-Starts-Arc.md section 4): its start-up's
  // `say 1025` is the classic start's waking - "You wake and look around the room ... Once free of the cave, you can
  // begin the Emperor's quest" - shown the moment DFU's StartGameBehaviour started it on a new character. No new
  // character starts it now: a start's commission does, in the city of Daggerfall, days or months after the cave
  // (systems/starts/starts.js), and the start's own quest has told the wreck. The line goes; the rest of the script is
  // DFU's. A quest saved past its start-up keeps the actions it was saved with (task.js restoreSaveData).
  // AUDIT STARTS Q3: and the two places the script tells the wreck as the player's own - its journal's first entry (1010:
  // "Before landing in Daggerfall, a sudden storm capsized the ship. I barely made it into this cave.", logged where it
  // starts, in Daggerfall's streets now) and Lady Brisienna's first letter (1020: "I heard about your accident at sea")
  // - are words for the shipwreck alone: a province's start and the commission in hand never went to sea. The entry's
  // last paragraph goes (the start's own journal has told the way here); the letter's first is said true of every start,
  // and of a save from before the starts.
  _BRISIEN: () => [
    {
      old: '\tpc at PiratesHold set _exitstarter_ \n\tsay 1025 \n',
      new: '\tpc at PiratesHold set _exitstarter_ \n',
      count: 1,
    },
    {
      old: ' most appreciative.\n    Before landing in Daggerfall, a sudden storm\n capsized the ship. I barely made it into this cave.\n',
      new: ' most appreciative.\n',
      count: 1,
    },
    {
      old: "     I heard about your accident at sea, and feared the\n worst. Now that I've heard you're alive and well, I\n would like the opportunity to meet with you and discuss\n our beloved Emperor's mission in the Iliac Bay.\n",
      new: "     Word has reached me that you are in the Iliac Bay\n at last, and alive and well. I would like the\n opportunity to meet with you and discuss our beloved\n Emperor's mission here.\n",
      count: 1,
    },
  ],
  A0C00Y10: () => [{ old: ' _inn_ in ___giver_ in six hours.', new: ' _inn_ in ___inn_ in six hours.', count: 1 }],
  // M0B11Y18 (Lord K'avar), AUDIT QA3 C3: `_S.10_`'s `pc at _L.00_ set _S.12_` stops K'avar's archers (`_S.12_ task: clear
  // _conhouse_`) once the player reaches his hideout - read at last (QUEST-AUDIT III DOTTED-SYMBOLS: C# never read
  // `_L.00_`), its `set` cleared `_S.12_` again on the way out, and `_conhouse_`'s five waves began anew at every exit
  // (twenty over four trips, where the unread line had given five). The place sets a task of its own (PcAt's `do` arm
  // toggles as `set` does), and that task starts `_S.12_`, which nothing clears: reached once, the waves stop for good.
  M0B11Y18: () => [
    { old: 'pc at _L.00_ set _S.12_', new: 'pc at _L.00_ set _atL00_', count: 1 },
    {
      old: '_S.12_ task:\n\tclear _conhouse_ \n',
      new: '_atL00_ task:\n\tstart task _S.12_ \n\n_S.12_ task:\n\tclear _conhouse_ \n',
      count: 1,
    },
  ],
  C0B00Y02: () => {
    const entry = [
      `Message:  ${SHAM_TRAIL_MESSAGE}`,
      '%qdt:',
      ...entryLines(t('quest.possessedChild.shamTrail', SHAM_TRAIL_EN)),
    ].join('\n');
    return [
      // the entry, after the last of the script's messages
      {
        old: ' _qgiver_ will want the _item_ back.\n\n\n-- Symbols used in the QRC file:',
        new: ` _qgiver_ will want the _item_ back.\n\n${entry}\n\n\n-- Symbols used in the QRC file:`,
        count: 1,
      },
      // filed by the reveal, after its own actions
      {
        old: '\tplace npc _hooker_ at _tavern_ \n\tclear _talkguardian_\n',
        new: `\tplace npc _hooker_ at _tavern_ \n\tclear _talkguardian_\n\tlog ${SHAM_TRAIL_MESSAGE} step ${SHAM_TRAIL_STEP}\n`,
        count: 1,
      },
    ];
  },
});

/** A vendored DFU quest's text with its patches applied (unchanged when it has none). Throws on a mismatch. */
export function applyQuestPatches(questName, text) {
  const patches = QUEST_PATCHES[questName];
  return patches ? applyTextPatches('QUEST-PATCH', questName, patches(), text) : text;
}
