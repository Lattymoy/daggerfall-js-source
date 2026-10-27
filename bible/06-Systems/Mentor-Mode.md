# Mentor Mode

MENTOR2, 2026-10-27. The owner: "People really hate the mentor system. How can we make this better without implementing
a toggle?", and on the proposal: "Do everything". Mentoring stays automatic (SOFTCAP1, Mac, 2026-09-29: "higher level
players will be automatically a mentor for lower level players when partying up"). This page is the record of what
MENTOR2 changed and why. Daggerfall Unity has no mentor system, so all of it is the port's own (Port-Ledger section A,
MENTOR2).

## 1. What players hit

SOFTCAP1 read every online party member, wherever they stood, so a level 30 grouped with a friend across the map was
lowered in their own dungeon. It took the build away whole: the Firmament, both specialisation paths, the school's and
the weapon's climb past 100. It paid nothing: the skill tallies past 100 read the real skill, so the group's foes taught
nothing, and the loot gate read the lowered level. It engaged at a three-level gap, put the mentor one level over the
group, and let a blow land five times harder. Each start, end and level change said a line in the chat.

## 2. The numbers

Mentoring engages when the group's reference level (the harmonic mean of the partners beside me, SOFTCAP1's own) is at
least MENTOR_MIN_GAP (5) levels under mine and mine is at least MENTOR_MIN_RATIO (1.5) times it. The mentor fights at the
group's level plus MENTOR_LEVEL_ALLOWANCE (3) or plus MENTOR_LEVEL_SHARE (a quarter), whichever is more, and always
under their own. The world is built one level over the group (MENTOR_WORLD_ALLOWANCE), as SOFTCAP1 built it, so the
group's foes do not grow because a mentor came. A blow lands at most MENTOR_MAX_DAMAGE_MULT (2) times harder.

| Me | Beside | Fight level | World level |
|---|---|---|---|
| 10 | 5 | 8 | 6 |
| 9 | 5 | none | none |
| 30 | 5 | 8 | 6 |
| 30 | 20 | 25 | 21 |
| 29 | 20 | none | none |
| 40 | 28 | none | none |

The profile splits the two levels. `effectiveLevel` is the world's (spawns, a foe's gear and items, the foes' threat);
`castingLevel` is the fight level a spell of mine is cast at (`scenes/hostMagic.js`, the ally cast in `world.js`);
`lootGateLevel` is always the real one. The skill, attribute, health and gear math is SOFTCAP1's, read at the fight
level (`mentorMode.js` mentorProfile).

## 3. Beside me, steadied

A partner counts while their body is drawn in my room (`world.js` partyNear, the list the party's roll and Renown share
already read): in a dungeon or a building the room is the bound, outdoors MENTOR_NEAR_METRES (150) on the ground.
`createMentorPresence` steadies the list. A partner counts after MENTOR_JOIN_MS (3 s) beside me and for MENTOR_LEAVE_MS
(30 s) after they go, so a door or a load moves nothing. While I fight (`encounters.js` areEnemiesNearby over the mode's
foes) the list stands as it was for at most MENTOR_FIGHT_HOLD_MS (30 s). Leaving the party, or a member leaving it, ends
their count the same frame.

## 4. The build at a share

No power of the build sleeps on mentoring any more. The power scale is the gear scale (sqrt of the skill line at the fight level over
the line at the real one, 0.5 to 1), one number the player is told. The Firmament's combat channels act at it, rounded
to whole points, and its life channels act whole (`firmamentLive.js` firmamentStatsAt; the gathering windows and the sail
are no fight). Every number an arcane or a martial path's power names acts at it - a percent, a chance, a heal, a
rider's share - and a window's seconds stay whole (`mentorMode.js` mentorScaled). A school's potency and a weapon's climb
past 100 read the mentored skill (`spell/spellPower.js` fightingClimb). The foes' edge and veteran still read none while
mentoring: they size the group's foes. WEAPON-GEAR's gear past 200 (`weaponMastery.js` weaponGearPct) stays off for a mentor, as its own arc decided.

## 5. What it pays

Past 100 a foe is weighed against the skill the mentor fights with (`skills.js` tallySkill), so a fair group fight
teaches. A foe of the mentor's own level still teaches more, and a group far below teaches nothing. The loot's rarity
gate reads the real level (LOOT-GATE holds back a young character; a mentor is none), while the items, their level and
the world stay the group's. A member far enough below a partner to be mentored by them is that partner's pupil
(`pupilMentorLevel`) and trains MENTOR_PUPIL_TALLY (1.2) times as fast below 100, the fraction carried on `_pupilFrac`.
Neither `_mentor`, `_pupil` nor `_pupilFrac` is saved.

## 6. What it says

The enhanced HUD carries a tile while mentoring ("Mentoring", the fight level at its foot) and beside a mentor
("Mentored", +20%), its glyph a tall figure with an arm on a smaller one's shoulder (`hudStatus.js` STATUS_GLYPHS
`mentor`); its card says the fight level, the real one and the share. The Party tab shows each member's level and a
line on what mentoring does for me now. The chat says a start and an end once each, and a pupil's start; a level that
moves says nothing. `/mentor` says it all. The Firmament window and the Specialization page say the share. Every word
is in `mentorText.js`, through the text core, in every language.

## 7. Where it lives

`systems/mentorMode.js` (the law, import-free), `systems/mentorText.js` (the words), `scenes/mentorHost.js` (the
streaming host's wiring: the near list, the presence, the profiles, the Firmament's share, the chat). The four hosts:
`scenes/world.js` WIRED (the mentor host built once and framed from the party frame). `scenes/worldModes.js` and
`scenes/dungeonContext.js` run inside it and read the profile through `effectiveLevel`. `scenes/exterior.js` FLAGGED:
the fixed city has no party frame.

## 8. Pins

`test/systems/mentor2.test.js` pins every number on both sides of its line, the presence, the host (faked doors), the
wiring, the share, the pupil, the mentor's tally, the save and the words; every mutant listed in its titles was run and
fails it. The tests that pinned the old sleep now pin the share: `firm1_powers`, `firm_status`, `audit_uicalm_firm1`,
`schools_arcane`, `audit_schools`, `martial_paths`, `audit_martial`, `bal9_destruction`, `bal11_hero`,
`audit_update_gate` and `growth1_tab`.
