# Morrowind NPCs

With Morrowind's data attached, the game draws its non-player actors in Morrowind bodies, as it draws the player and
the other players: foes, the watch, townsfolk, the people in buildings and dungeons, quest people, creatures, crews,
road parties, the siege's fighters and the gate court. The nearest ones take a body; the rest keep the classic sprite.
The player turns it on and sizes it under Settings, Combat > With Morrowind data.

## How it works

- **One lane per population.** Each host wires its actors through `createHostNpcBodies` or `createPopulationLane`
  (`src/characters/npcBodies.js`). A lane is a `PeerBodies` of its own (`src/net/peer/peerBodies.js`): the NPCs ride
  as synthetic peers (`npcPeerId`), built from a look and posed from the actor's state (`npcShown`). The host asks
  `has(lane, id)` and draws its own billboard for every actor that answers false: out of the cap, out of range,
  still building, or refused.
- **The pose is the actor's state.** `npcShown` maps feet, facing, gait, a drawn weapon, swings, casts, hits and death
  onto the pose fields the peer rig plays. Hit recoil and death are `hurt` and `die` in `src/combat/fpArm.js`.
- **Looks.** Each population has an adapter that turns an actor into a look: foes `foeLook`
  (`src/characters/foeBodies.js`), walkers `folkLook` (`src/characters/folkBodies.js`), standing people `personLook`
  and placed figures `figureLook` (`src/characters/peopleBodies.js`), rosters and residents
  (`src/characters/rosterBodies.js`), creatures `creatureLook` (`src/characters/creatureBodies.js`).
- **The wardrobe.** `dressPerson` (`src/characters/wardrobe.js`) dresses a person from a role (commoner, tradesman,
  noble, priest, knight and others) off the person's own seed: a silhouette, Daggerfall garments, dyes, a cloak chance,
  armour kits for martial roles, and a wealth tier on Morrowind's clothing ladder. The look carries an `npc` hint so
  the build picks each garment's record and walks the head and hair off the seed. It is pure: every machine dresses
  the same person the same way.
- **Creatures.** `CREATURE_MATCH` names every creature mobile: a list of Morrowind creature ids (the first the
  attached masters carry wins) or a declared miss with its reason, which keeps the sprite. Flyers stand only in a
  record that flies. Spectral foes draw translucent under `SPECTRAL_VEIL`. A mod's monsters register their own rows
  with `registerCreatureMatches`.
- **Special foes.** Orc mobiles stand in Morrowind's Orc body (`ORC_MOBILES`), vampire foes take their race's vampire
  head (`VAMPIRE_MOBILES`), and the werewolf stands in Bloodmoon's wolf (`WOLF_MOBILE`).
- **Standing flats.** A person's flat that no StaticNPC holds, a boat crew's billboard and a town's standing horse
  count as standing flats (`isStandFlat`, `src/world/standFlats.js`). People stand in bodies; horses take the 3D horse
  (`createStandingHorses`, `src/world/standingHorses.js`).
- **Rendering.** The third-person skin runs in the vertex shader (`src/formats/morrowind/mwGpuSkin.js`): the stream
  uploads once, a pose sends one palette. Every seen body draws into tiles of one sprite target in one bind.
  `drawBodyPicture` (`src/render/characterSprite.js`) takes each body's picture through the main camera, cut to its
  window (`cropPicture`, `cropQuad`), so a body near the eye clips at the near plane rather than distorting. A body
  casts its own shadow shape and the billboard under it casts none.
- **Marks.** Over a standing person whose click leads somewhere other than talk, a small icon bobs: a yellow "!" for a
  live quest, an amber coin for a merchant, a blue gem for a guild service or an arena officer
  (`src/scenes/npcMarksHost.js`, `src/render/npcMarkPass.js`). The mark reads the click's own route
  (`staticNpcRouteIn`), so it never promises a door the click does not open. A quest mark wins over the others.

## Rules

- Performance is not traded for bodies (Mac). The NPC lanes share one frame budget, `NPC_FRAME_TIERS`: 24 bodies and
  8 skins a frame at Near, 48 and 16 at All, nearest first across every lane (`createFrameBudget`,
  `NPC_FRAME_BUDGET`). A body holds its place `NPC_BUDGET_HYSTERESIS` past the cut so the edge does not flicker.
- Each lane has its own caps under the tier (`NPC_BODY_TIERS`, `WATCH_BODY_TIERS`). NPCs never take a body from a
  player: the peers keep their own cap (`BODIES_MAX` in `src/net/peer/peerBodies.js`).
- One build queue serves every lane (`BODY_BUILD_GATE`).
- The setting `mwNpcBodies` (Off, Near, All) defaults to Near (`NPC_BODIES_DEFAULT`; `mw-npc-bodies` in
  `src/systems/features.js`).
- Barely any two NPCs look alike: people are dressed procedurally by role and seed (Mac).
- Morrowind Model Detail (`mwModelDetail`): Pixelated, the default and the owner's look, draws a Morrowind texel
  `MW_ARM_PIXEL` (3) screen pixels; Sharp draws one. The sprite target grows on demand up to `CHAR_SPRITE_RT_MAX`
  (`src/render/renderer.js`).
- The Billboard Look (`mwBillboardLook`) stands bodies as flat upright pictures, taken along the level ray so a body
  keeps its true height.
- Marks are on by default (`npcMarks`) and show only with Morrowind people on (the owner).
- Children keep their sprite (no Morrowind body is a child's), and so do a vampire clan's standing people and the
  Daedra Princes (`DAEDRA_PRINCES_ARCHIVE`). The arena crowd stays flats. Click and talk boxes keep the billboard's
  size.
- "No weapon" is `MW_WEAPON_TYPE.None` (-1), never 0.
- Every memo stands down when the Morrowind data generation moves, and a pooled actor re-rolled in place keys its body
  by identity, not by object.

## Tamriel

Past the Bay, walkers, residents, keepers and foes take the province's own races (`PROVINCE_FOLK`,
`src/characters/provinceFolk.js`). Inside the Bay, a standing person whose host names no race is a Breton.

## Daggerfall Unity

DFU draws every NPC and foe as a billboard (`MobilePersonBillboard`, `DaggerfallMobileUnit`). The bodies are our
departure, made possible by Morrowind's data the player attaches. Without it, or past a lane's caps, the actor is
DFU's billboard. The marks have no DFU counterpart: DFU's billboards show who a person is by their picture, and a
wardrobe-dressed body does not.

## Code and tests

- `src/characters/npcBodies.js` - lanes, tiers, frame budget, `npcShown`
- `src/characters/foeBodies.js`, `folkBodies.js`, `peopleBodies.js`, `rosterBodies.js`, `creatureBodies.js` - looks
- `src/characters/wardrobe.js` - who wears what
- `src/net/peer/peerBodies.js` - the shared body layer and build gate
- `src/formats/morrowind/mwGpuSkin.js` - GPU skin stream and palette
- `src/render/characterSprite.js` - body pictures and the crop
- `src/scenes/npcMarksHost.js`, `src/render/npcMarkPass.js` - marks
- `src/world/standFlats.js`, `src/world/standingHorses.js` - flats that stand
- `test/characters/` (`mwnpc*`) - each population, the budget, wardrobe, orcs, spectral, vampires, werewolf
- `test/formats/morrowind/mwnpc1_gpuskin.test.js`, `test/render/mwnpc2_onepass.test.js`,
  `test/render/mwnpc16_bodyshadow.test.js` - skin, one pass, shadows
- `test/render/bodycrop.test.js`, `test/systems/bodycard.test.js` - crop and billboard look
- `test/scenes/npcmarks.test.js`, `test/world/standflats.test.js` - marks and standing flats
- `tools/mwNpcLaneProbe.mjs` - counts skins, uploads, binds and builds a frame across the lanes

## Open

- Water creatures (the dreugh) keep their sprite: the swimming groups are not driven (`CREATURE_MATCH`).
- Not checked here: the game itself with Morrowind's data, frame by frame.
