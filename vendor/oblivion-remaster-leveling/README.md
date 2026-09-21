# OblivionRemasterLikeLeveling 0.5.3 - ported 1:1, its whole source vendored

**OblivionRemasterLikeLeveling 0.5.3**, an OpenMW 0.49 mod for
**Morrowind** (Nexus Morrowind 56569). Its own description: "A mod
for Open Morrowind 0.49 that simulates the new leveling system
implemented in Oblivion Remastered."

THIS IS THE FIRST MORROWIND MOD IN THIS TREE. Every vendored MOD before
it is a Daggerfall Unity mod: a `.dfmod` bundle, a manifest, C# read off
its IL or its repository. (Some rows are not mods at all - Daggerfall
Unity's own shipped data, a font, a road table - so they have no
manifest either.) This one is OpenMW Lua against OpenMW's own API, so
there is no `.dfmod.json` here and the registry's manifest check skips
it. What replaces the manifest is that the mod is SMALL AND WHOLLY
READABLE - 1,314 lines of Lua, 72 more of l10n yaml and a 487-byte data
file - so the port is read off the author's own source, not off a
decompile, and every one of its laws is cited to a line of it.

(That figure was written as "1,384 lines of Lua", which is `wc -l` of the
Lua and of the yaml added together and called Lua: 1,313 + 71. The real
line counts above are two higher, because `templates.lua` and `fr.yaml`
each end without a newline and `wc -l` does not count a last line that
has none. The bible page carried the same
error and was corrected; this file was missed, and ORL1's deep audit
found it still standing here.)

Mac (Lattymoy) handed the shipped zip
(`OblivionRemasterLikeLeveling_0.5.3-56569-v0-5-3-1748644502`) over on
2026-09-17: "So I've been analyzing morrowind mods to integrate and the
first one I'd like to add is this."

**Licence: NONE STATED.** The archive carries no LICENCE file, and no
Lua header, yaml, README line or record in the `.omwaddon` states one.

**Author: NOT NAMED IN THE SHIPPED FILES.** The author's name appears
nowhere in the ten files - not in a script header, not in the
`.omwaddon`'s author field (which is empty), not in the mod's own
README. The Nexus Morrowind 56569 page carries it; this note does not
invent it.

**Permission: [Mac: record the author's permission, or the link to it,
here - and their NAME, which no shipped file carries. The earlier mod
records carry theirs in this line.]**

## What is here

The whole mod, verbatim - all ten files of the shipped archive:

- `OblivionRemasterLikeLeveling.omwaddon` - 487 bytes, and the entire
  data layer. It carries exactly ONE record: `GMST` `NAME`
  `"iLevelupTotal"` `INTV` `100`. That single number is the size of the
  level bar every law below is measured against.
- `OblivionRemasterLikeLeveling.omwscripts` - the manifest: `settings.lua`
  on the MENU context, `player.lua` on the PLAYER context.
- `scripts/player.lua` (718 lines) - the mod. The skill-level-up
  handler that feeds the bar, the virtue purse and its clamp, the
  level-up window and every one of its buttons, the commit, and the
  two save handlers.
- `scripts/helper.lua` (292 lines) - the progress and roll-over
  arithmetic, the health raise, the skill-tier tests, the level-up art
  picker (the author's own comment records that it is adapted from
  OpenMW's `levelupdialog.cpp:265` and "may behave strangely with the
  implemented level up mechanics"), and the UI helpers.
- `scripts/settings.lua` (108 lines) - the seven player settings in
  their two groups, with their defaults and their minimums.
- `scripts/constants.lua` (88 lines) - the two caps (attribute 100,
  per-attribute increase 5), the colours, the textures, the attribute
  table with its GMST tooltip keys, and the per-level message heights.
- `scripts/templates.lua` (108 lines; `wc -l` says 107 because the file
  ends without a newline) - the bordered-button template.
- `l10n/en.yaml`, `l10n/fr.yaml` - the mod's own strings, English and
  French, including the setting names and descriptions the port's Mods
  pane restates.
- `README.upstream.md` - the author's own README, carried because its
  changelog is the record of what 0.5.1, 0.5.2 and 0.5.3 each fixed,
  and all four of those fixes are laws the port keeps: 0.5.1's two (no
  extra point on a major or minor raise; a roll-over bigger than one
  level is carried rather than dropped), 0.5.2's (health does rise on a
  level-up) and 0.5.3's (the handler reads the value the skill is
  LEAVING). The page names each one against the port's own line.
- This note.

## What is NOT here, and why

**Nothing of the mod.** Unlike every other mod row, there is no
compiled artefact to leave out: OpenMW runs the Lua as shipped, so the
source above IS the mod.

**Morrowind's own assets.** The mod draws Morrowind textures
(`icons/gold.dds`, `icons/k/attribute_*.dds`, `textures/levelup/*.dds`),
plays `Music/Special/MW_Triumph.mp3` and reads Morrowind GMSTs
(`sStrDesc`, `sAttributeStrength`, `Level_Up_Level1..20`,
`fLevelUpHealthEndMult`, `sOK`). None of those exist in Daggerfall and
none is carried. The port draws Daggerfall's own art and reads
Daggerfall's own strings in their place - see the page's
"What Morrowind has that Daggerfall does not" table.

## The port

`bible/06-Systems/Oblivion-Remaster-Leveling.md` is the record: the law
table against this source line by line, the Morrowind-to-Daggerfall
mapping and every decision in it, the seams, and what the port
deliberately does differently (Daggerfall's own hit-points-per-level
formula in place of the mod's `Endurance * fLevelUpHealthEndMult`,
which is Morrowind's engine rule and not a thing the mod invented).

The port is `src/systems/oblivionLeveling.js` and
`src/ui/virtueLevelUp.js`; every function there names the Lua member it
restates and the line it was read at.
