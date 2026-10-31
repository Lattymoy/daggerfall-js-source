# The Arena of Daggerfall

A colosseum in the middle of Daggerfall city, built on Kamer's *Daggerfall Arena* mod. At its gate the Herald opens the
Arena window: watch the hour's exhibition, join the Red or Blue Banner and climb a ten-tier ladder of AI opponents, or
queue for a refereed bout against another player. A living crowd cheers and boos. Grand Champion is a title for good;
the season's PvP #1 wears the Arena Champion title and the laurel glyph. The same colosseum stands in the Imperial
City's Arena District.

## How it works

**The building** (`src/world/arena/arenaCity.js`, `src/world/arena/arenaModel.js`). Daggerfall's cell (4,3) lays the
port's own block ARENADAG.RMB, cut from Kamer's block (`tools/daggerfallArenaExtract.mjs`): his colosseum model 864102,
drawn in the player's own ARENA2 textures, his props and lights, and the gate's people. The location's building list
loses exactly the old block's named buildings; homes that stood there move once to other houses of the city, with a
letter. Both town maps draw the bowl and an "Arena" landmark. A stair inside leads down to the undercroft, Kamer's 32
blocks (`src/world/arena/arenaUndercroft.js`), kept off the travel map, with a training pit and the Hall of Champions'
plaques. Any place whose grid lays the block stands the arena (`standsArena`), which is how the Imperial City has it.

**The gate.** The Herald of the Arena (the Arena window and every bout's voice), the Red and Blue recruiters, the
bookmaker (gold wagers on the bout on the floor), and two wardens of the city watch.

**A bout** (`src/systems/arena/arenaBout.js`, pure, clock injected). Fought on a made level of the floor
(`src/world/arena/arenaFloor.js`), its own instance, entered from the gate. The Herald's call, the walk, a countdown,
the fight, then a verdict and healing to full. A bout ends by a yield (a fighter may yield at `YIELD_SHARE`, 15%), a
fall (nobody dies on the sand: a 1 HP floor), a ring-out, or the time limit (`BOUT_LIMIT_MS`, 3 minutes) and the
judges. AI fighters are Daggerfall's own class enemies and monsters on a bout team of their own, with no loot.

**The ladder** (`ARENA_LADDER_SPEC` in `src/net/arena/arenaLaw.js`). `ARENA_TIERS` (10) tiers of `ARENA_TIER_BOUTS`
(3) bouts and a Tier Champion who fights as an elite foe. Losing a bout breaks the tier's run back to its first bout;
beating its champion moves the player up for good. Opponents scale with the tier, never with the player. Tier 6 is
beasts; tier 10 ends with the Grand Champion. Purses are gold, raised by the crowd's favour; online, Renown too.

**Teams and seasons.** Joining Red or Blue is free; changing waits for the next season. Team points
(`ARENA_TEAM_POINTS`) come from ladder wins, champions, a Grand Champion and refereed PvP wins. A season is
`ARENA_SEASON_S` (8 weeks) online; offline, the in-game year. The winning banner's fighters wear its laurel next
season.

**The crowd** (`src/systems/arena/arenaCrowd.js`, `src/systems/arena/arenaSound.js`). Daggerfall's own people as
billboards on the tiers, tinted by banner halves. Its sound is built at runtime from Daggerfall's crowd voices. Its mood
rises with big hits, crits and comebacks and falls with stalling (`STALL_MS`), fleeing and early yields; each fighter
has a favour. Its words are one table (`src/systems/arena/arenaText.js`).

**The Arena window** (enhanced UI plus). Tabs: Bouts, Ladder, Team, Leaderboards, Records, Rules. In a bout the HUD
shows the versus bar, the crowd meter, the timer and the Herald's lines.

**Online** (`src/net/arena/arenaBrain.js`, `src/net/arena/arenaLink.js`; relay rooms `arena:hall`, `arena:b<id>`,
`arena:x<hour>`, `arena:p<code>`).

- The hour's exhibition runs on the relay (`src/net/arena/arenaExhibition.js`), one bout every client sees, opened by
  the first watcher inside its window.
- A ladder bout's opponent is relay-run and its result relay-signed (`src/net/arena/arenaReceipt.js`). A ladder bout
  waits at the Herald while the last one's receipt is still being recorded.
- Rated PvP runs under the relay's refereed blow: health held by the relay, every blow checked for reach, rate and a
  damage bucket from DFU's weapon tables. Matchmaking queues by Elo (`ARENA_ELO_START` 1,000, `ARENA_ELO_K` 32), the
  band widening every `MATCH_WIDEN_MS`; both accept within `MATCH_ACCEPT_MS`. A casual queue stands beside it.
- Up to `ARENA_SPECTATORS_MAX` (60) watch a bout from the stands.
- Records live in the account service (`server-account/src/arena.js`): one row a tier won, one a rated bout; boards
  from rows (`/v1/arena/board`).
- **Private sessions**: a registered host opens `arena:p<code>` with a six-character code. Members join by the code;
  the host picks Red and Blue and calls their bout, every fighter equally whole; registered accounts fight, guests watch.

**Titles.** Grand Champion (`grandchampion` online, from a relay-signed tier-10 result) and tier titles on the arena
card. Arena Champion (`arenachampion`) and the laurel glyph go to the season's #1 with `ARENA_CHAMPION_MIN_BOUTS` rated
bouts against `ARENA_CHAMPION_MIN_FOES` accounts, a pair counted at most `ARENA_PAIR_SEASON_MAX` times a season. They
are derived at the token's mint, so they pass to whoever takes the top.

## Rules

- The arena is a centrepiece of Daggerfall city, in cell (4,3); the displaced house moves to a new house with
  everything in it; Kamer's dungeon is the undercroft; the project has Kamer's permission (Mac).
- Watch AI fights and player fights, join Red or Blue, climb escalating tiers, or matchmake for a real opponent (Mac).
- Team play has its own enhanced UI plus window with rankings and leaderboards (Mac).
- The crowd cheers and boos (Mac).
- A top PvE fighter has a title for good; the #1 PvP player a temporary title and glyph (Mac).
- Losing a ladder bout loses the tier's run; tier champions are elite foes (the owner).
- Private sessions: every fighter equally whole; registered accounts fight, guests watch (the owner).
- The Imperial City's colosseum is Daggerfall's arena; Daggerfall keeps its own (Mac).
- Results that award a title are refereed by the relay.

## Daggerfall Unity

DFU has no arena; Kamer's mod adds one. Departures: the mod's model is drawn in the player's own textures (as DFU's
`RuntimeMaterials` does), and its 25 classic dungeon placements are rebuilt from the player's ARCH3D, never carried.
Fighters are Daggerfall's own class enemies and monsters; the crowd's sound is built from Daggerfall's own unused crowd
voices.

## Code and tests

- `src/net/arena/arenaLaw.js` - rooms, seasons, Elo, ladder spec, the refereed blow's limits, titles
- `src/net/arena/arenaBrain.js`, `src/net/arena/arenaExhibition.js`, `src/net/arena/arenaReceipt.js`, `src/net/arena/arenaClaims.js` - the relay's bouts, receipts, claims
- `src/systems/arena/arenaBout.js`, `src/systems/arena/arenaLadder.js`, `src/systems/arena/arenaCrowd.js`, `src/systems/arena/arenaFighters.js` - a bout, the ladder, the crowd, fighters
- `src/world/arena/arenaCity.js`, `src/world/arena/arenaFloor.js`, `src/world/arena/arenaUndercroft.js`, `src/world/arena/arenaPlaques.js` - the building, the floor, the undercroft, plaques
- `server-account/src/arena.js` - records and boards
- `test/systems/arena/arena2_hud.test.js`, `test/systems/arena/arena3_teams.test.js`, `test/systems/arena/arena3_titles.test.js` - bouts, teams, titles
- `test/net/arena/arena4_relay.test.js`, `test/net/arena/arena4b_exhibition.test.js`, `test/systems/arena/arena6_private.test.js` - online, the exhibition, private sessions
- `test/world/icgrand_arena.test.js` - the arena in the Imperial City

## Open

- The relay's arena rooms are not keyed by city: Daggerfall's and the Imperial City's arenas share the hall, the hour's
  exhibition and bout rooms.
- The gate's people are Daggerfall's factions in the Imperial City too; an Imperial Herald is the owner's call.
- Team battles (5v5), wagers on player bouts in Silver, and a mounted joust are not built.
