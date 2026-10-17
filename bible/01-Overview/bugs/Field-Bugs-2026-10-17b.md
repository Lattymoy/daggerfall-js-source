# FIELD BUGS 2026-10-17b - The Possessed Child

One thread from the Discord's bug-reports channel, handed over as a screenshot, read on the code as it stands at main's
`dcac4e4ff`. The fix departs from Daggerfall Unity's own quest script and rides the owner's standing word on a
player's dead end - "I dont care about DFU. We're our own thing now." (`01-Overview/bugs/Field-Bugs-2026-09-30b.md`) -
and is a Ledger A row.

(Main's #974 took `Field-Bugs-2026-10-17.md` meanwhile, for REFORGE-STACK, so this record is `-17b`, its pin
`fb1017b_shamtrail` and its mutants `tools/mutants/fb1017b.json` - renamed at the merge.)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Baffle, "The Possessed Child": "I complete the possessed child by giving the child the scarab to help exorcise the demon from her. The woman who gave me the scarab said the daedra would appear somewhere in the home to fight after, but no daedra spawned. This is from the arkay temple in Uplech." - "Quest is now unable to be completed" (TheBard: "Did loitering in the house help?") | The quest's SHAM branch, as DFU ships it: half the quests draw a guardian's scam, where no Daedroth ever comes though the priest promised one, the child keeps the relic, and the reveal files no journal entry - the guidance still points at the priest, and neither she nor the questor answers. The real branch's Daedroth stands, read and run | fixed (SHAM-TRAIL), a departure |

## SHAM-TRAIL: the sham reveal says what the player saw, and where to go

`src/systems/quest/questPatches.js` (QUEST_PATCHES, applyQuestPatches, applyTextPatches); `src/scenes/quest/questData.js`
(loadQuestPack); `src/systems/foraging/foragingLaw.js` applyForageFix.

FOUND. C0B00Y02 (`vendor/dfu-quests/Quests/C0B00Y02.txt`, "Edited for Daggerfall Unity by Jay_H") starts with `pick one
of _sham_ _real_`. Both branches send the player to the guardian at `_tavern_`, to the child at `_house_`, and to the
priest at `_house3_` in another town, whose 1019 hands over the relic (a `religious` item - the report's scarab) and
warns, in both branches alike: "When the exorcism is complete, it will leave her and appear elsewhere in _house_. Be
ready for a battle when it does." Then, with the relic, the child:

- REAL (`_exorcise_`): 1015 ("... is out of me ... but ... it's still here." The child runs away) and `place foe
  _daedra_ at _house_` - the Daedroth. `_victory_` wants only the questor's (or the priest's) click after it.
- SHAM (`_revealsham_`): 1016 ("Oh thank you, kind %pct. I'll keep this _item_ for protection. Goodbye!"), the child
  hidden, the guardian moved to `_house2_` and a prostitute stood at `_tavern_`, who alone says where he went (`_bribe_`:
  50 gold, then 1023's Yes files 1026 - "The possession was obviously a scam"). `_victory_` wants the relic back
  (`_rescueitem_`).

The report's words are the sham's: the scarab given to the child, who kept it; no Daedroth; the quest unable to close.
The sham files no journal entry, so the latest stays 1020 ("It may be a good time to see the exorcist ... in
_house3_"), the quest lens and the Town tier send the player to the priest's house, and there nothing answers -
`_rebuff_` is for a player who has not seen the child, and neither the priest nor the questor closes the quest until
the relic is back. Nothing the
player is shown leads to the tavern. DFU ships the same script, and stands in the same place.

THE REAL BRANCH, READ AND RUN (not the report's). Through the real parser and machine
(`test/systems/quest/fb1017b_shamtrail.test.js`): the exorcism's `place foe` hot-places the Daedroth
(Place.AssignQuestResource's isPlayerHere tail, `world.mountCurrentSiteQuestResources`) in the house the player stands
in - a quest foe of a real building pool (`scenes/exteriorFoes.js`, as worldModes.js's interior adapter stands it),
MobileTypes 27 - and the questor closes the quest. Read on the live wiring: world.js's and exterior.js's seam both route
to worldModes.js mountQuestResources, the interior adapter's standFoe hands the foe to the building's pool, and a
Daedroth stands in that pool with INDOOR-WATCH's navmesh as without it. Nothing found that would stand none.

FIXED. THE PORT'S PATCHES OVER DFU'S OWN QUESTS. The vendored quests stay verbatim (`vendor/dfu-quests/README.md`); a
patch is an exact old text and how many times it must occur, applied as the browser's pack reads the quest
(`questData.js`) - FORAGE-FIX's law (`06-Systems/Foraging.md`), which is `applyTextPatches` now, one home for both
tables (applyForageFix calls it). A patch that no longer finds its text warns and the quest loads as shipped. The account
Worker bundles `foragingLaw.js`, so `questPatches.js` joins its bundle and its deploy's path filter
(`.github/workflows/account-deploy.yml`, held by `test/server/accountdeploy.test.js` ACC1-CI); the Worker's behaviour is
unchanged.

C0B00Y02's: the reveal files 1027 at step 4 (the script's messages end at 1026; its steps are 0-3 and 6), after its own
actions -

> No daedra came out of _child_ when I brought the _item_. _child_ just thanked me and ran off with it. Something is
> not right here. _guardian_ was staying at _tavern_, and someone there may know more.

- what the player saw, and the place it names, which the quest lens's latest entry points at (ui/quest/questLens.js
entryTarget: the tavern, by its town and key - the Town tier's ring and the compass). No pronoun macro (`%g` reads the
last person named, and the entry names two) and no `=child_` (a Person's details macro is its race: "The Nord just
thanked me"). The trail from the tavern is the script's own: the prostitute, the bribe, the house she names, the
guardian, the relic, the questor.

THE WORDS ARE THE PORT'S OWN, so they are the text core's (L10N4's ratchet - `test/systems/l10n4_hardcoded.test.js` -
failed them written into the patch): `t('quest.possessedChild.shamTrail', ...)`, drafted in the thirteen whole
languages (`tools/l10nInSession.mjs`, recorded as the machine's), each keeping the four `_symbol_` names the quest
expands, and phrased where a language would agree a verb with the child's or the guardian's sex so that it need not.
The pack keeps the quest as shipped and patches it each time it is read (`questData.js` patchedLines), so the entry is
in the player's language when the quest starts; `entryLines` lays it in the script's own journal lines (ENTRY_WIDTH,
never an empty line, which would end the message). A mod's quest of the same name stays the mod's, unpatched.

NOT CHANGED. The priest's 1019 still promises the Daedroth in the sham - she does not know it is one, and the entry
answers it. A quest saved past the reveal keeps the actions and messages it was saved with (task.js restoreSaveData,
Quest's `messages`), so the entry reaches a quest begun after the deploy; the reporter's quest is still completable -
the prostitute at the tavern, for 50 gold, says where the guardian went - and its clock (`_queston_`, 5 to 10 days) ends
it otherwise. A No to the prostitute (`_refuseconfess_`: the 50 back) is final, as DFU's: its No does something, so
NO-ASKS-AGAIN leaves it (`test/systems/quest/fb1013e_noasks.test.js` lists it among the click-asked prompts it does not
re-arm), and the guardian's house is then found only by search - open to Mac. An installed translation pack's
-LOC file for C0B00Y02 carries no 1027, so the entry is the text core's draft beside the pack's own messages
(localizedQuest.js reads a message the pack has, the parsed one otherwise). A party sharing the quest across the deploy -
one copy patched, one not - differs in the reveal's actions, and the share's shape check (questShare.js shapeMismatch)
refuses it until both have reloaded.

`test/systems/quest/fb1017b_shamtrail.test.js` (6): the report, through DFU's own script (no Daedroth, nothing filed, the
priest's house the guidance's, no click closing it); the patched sham's entry, its words expanded, the lens's tavern, and
the trail down it to `_victory_`; the real branch's Daedroth in the building's pool, and the questor's close; the patch
law (every patch found as often as it says, CRLF the same, a quest with none untouched, a moved text throws, FORAGE-FIX's
throw still its own); the words (French read as the quest is read, the journal lines, the whole languages' names); the
pack's wiring. `tools/mutants/fb1017b.json`: 10 mutants, 10 dead. FORAGE1's two records on the moved law re-aimed by
content (`tools/mutants/forage1.json`, both still dead).
