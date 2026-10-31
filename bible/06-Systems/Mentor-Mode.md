# Mentor Mode

Online, a much higher-level player partied with lower-level partners nearby is automatically mentored down: they fight
at a level close to the group's, with their build at a share, while the world stays built for the group. The partners
are pupils and train faster. There is no toggle. The player meets it as a Mentoring or Mentored tile on the enhanced
HUD, a line in the Party tab, and the `/mentor` command. Daggerfall Unity has no mentor system.

## How it works

**When it engages** (`src/systems/mentorMode.js`). The group's reference level is the harmonic mean of the partners
beside the player. Mentoring engages when that is at least 5 levels under the player's (`MENTOR_MIN_GAP`) and the
player's level is at least 1.5 times it (`MENTOR_MIN_RATIO`).

**The levels.** The mentor fights at the group's level plus 3 (`MENTOR_LEVEL_ALLOWANCE`) or plus a quarter
(`MENTOR_LEVEL_SHARE`), whichever is more, always under their own. The world is built one level over the group
(`MENTOR_WORLD_ALLOWANCE`), so the group's foes do not grow because a mentor came. A blow lands at most twice as hard
(`MENTOR_MAX_DAMAGE_MULT`).

| Me | Beside | Fight level | World level |
|---|---|---|---|
| 10 | 5 | 8 | 6 |
| 9 | 5 | none | none |
| 30 | 5 | 8 | 6 |
| 30 | 20 | 25 | 21 |
| 40 | 28 | none | none |

The profile keeps three levels apart: `effectiveLevel` for the world (spawns, foes' gear and items, threat),
`castingLevel` for spells cast, and `lootGateLevel`, always the real level. Skill, attribute, health and gear math read
the fight level (`mentorProfile`).

**Beside me** (`src/scenes/mentorHost.js`, `createMentorPresence`). A partner counts while drawn in the same room: a
dungeon or building is the room, outdoors 150 m (`MENTOR_NEAR_METRES`). A partner counts after 3 s beside the player
and for 30 s after leaving (`MENTOR_JOIN_MS`, `MENTOR_LEAVE_MS`), so a door or a load changes nothing. During a fight
the list holds for at most 30 s (`MENTOR_FIGHT_HOLD_MS`). Leaving the party ends the count at once.

**The build at a share.** No power sleeps while mentoring. The power scale is the gear scale (the square root of the
skill line at the fight level over the line at the real one, 0.5 to 1). The Firmament's combat channels act at it
(`firmamentLive.js` `firmamentStatsAt`), its life channels whole. Every number an arcane or martial path names acts at
it (`mentorScaled`), and a school's or weapon's climb past 100 reads the mentored skill (`fightingClimb`). The foes'
edge reads none while mentoring, and weapon gear past 200 stays off.

**What it pays.** Past 100, a foe teaches against the skill the mentor fights with (`skills.js` `tallySkill`), so a fair
group fight teaches. The loot rarity gate reads the real level, while items, their level and the world stay the
group's. A member far enough below a partner to be mentored by them is a pupil (`pupilMentorLevel`) and trains 1.2
times as fast below 100 (`MENTOR_PUPIL_TALLY`). None of this is saved.

**What it says** (`src/systems/mentorText.js`). The enhanced HUD's tile ("Mentoring" with the fight level, or
"Mentored" with +20%), the Party tab's member levels and line, a chat line once at the start and end, and `/mentor`.
The Firmament window and the Specialization page say the share.

## Rules

- **Higher-level players are automatically mentors for lower-level party members** (Mac).
- **Better without a toggle** (the owner): only nearby partners count, the build acts at a share, a group fight
  teaches, pupils train faster, and the HUD says it plainly.
- Offline there is no mentoring.

## Code and tests

- `src/systems/mentorMode.js` - the law, import-free
- `src/systems/mentorText.js` - the words, in every language
- `src/scenes/mentorHost.js` - the streaming host's wiring: the near list, presence, profiles, the Firmament's share,
  the chat
- `test/systems/mentor2.test.js` - every number, the presence, the host, the share, the pupil, the words

## Open

- The single-town bench (`src/scenes/exterior.js`) has no party frame and no mentoring.
