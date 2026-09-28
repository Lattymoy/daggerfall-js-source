# AUDIT PRE-MERGE 0927 - the branch read before it merges, 2026-09-27

Mac: *"Audit before we merge"*. The branch (`claude/upbeat-curie-s7flpa`) carried 22 commits past main: QUEST-PARTY
phases 1-3c, OWN1 (the relay's own lane), INVIS-NET / INVIS-LOOK, HOUSE-DROP, PSCALE-OWN, SUMMON-SYNC, the sea's pacing
work (SEA-CAP, FOE-CATCHUP, QUEST-POPUP-PAUSE, FOE-SPACING, DEEP-SHARE, CAMP-SEA, QUEST-WAVE, WA-ALLIES) and seven small
field fixes (ROGUE-IMP, DEAD-CLOCK, ENCHANT-LOAD, NATURE-GROUND, SQUEEZE1, GATE-KEYS). Seven reviewer lenses read it,
each reproducing what it reported with the repo's own harnesses; every finding below was verified against the code
before it was fixed. Main (45 commits, to `71450b02`) was merged first (`75ef5389`): the relay is world118, OWN_RELAY_MIN
118 - the lens on OWN1 found world114 already taken on main, which the merge had renumbered.

## Fixed

Each fix is pinned by an executed test where the behaviour can be driven, and by source otherwise; every fix is
mutation-proven (`tools/mutants/auditqp.json` 38, `auditown.json` 7, `auditpace.json` 14, `auditinvis.json` 14,
`auditsqueeze.json` 5 - all dead).

**The own lane and the party's quest foes** (`scenes/dungeonContext.js`, `scenes/exteriorFoes.js`, `scenes/world.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | high | Dispel handed the removal door every live foe near the caster: a party member's puppet went dead with no batch, its owner's next record stood it up again with none, and the draw's `f.batch.conceal` threw - the game loop stopped. | `questPoolOps.removeFoe` refuses a puppet (a member's own foe, a room foe while another holds the seat), as the cell's door always did. |
| D2 | high | A handover named one heir, but a member it did not name kept the owner's puppet and adopted it too when the owner's leave was pruned (the orphan law's lowest id). The stale sweep also adopted from an owner gone quiet but still in the room (a hidden tab), and one whose socket came back under the same id streamed its foes again beside the adopter's. Two owners, two copies, every kill counted twice. | A record naming another heir marks the puppet (`_heirElse`) and the orphan law skips it; the orphan law runs only for an owner that LEFT (never on the stale branch); a foe I took is given back (`letGo`/`letGoOwn`, no death) when its owner streams it alive again. Both pools. |
| F3 | low | An heir whose puppet was still building when the owner's leave landed lost the foe: the build ended on arrival, and the owner had already let it go. | A pending build whose last record named me heir takes the foe on landing; a room change still ends it. Both pools. |
| D3 | med | The first sight of a partner's untouched quest foe fired the quest's `injured` trigger: the drop was measured from this copy's own health roll. | The injury is a drop from the last STREAMED health (the cell's law). |
| D4 | med | FOE-SPACING pushed a party member's own foes (QUEST-PARTY 3c, SUMMON-SYNC) against their eased poses - jitter, and the owner's real foes pushed around. | The dungeon's spacing skips `_ownFrom` puppets. |
| D5/F1 | med | A marker's foe that changed hands (adopt, or a save loaded indoors) lost its marker flag, so a member's or the returning owner's marker copy never stood down: two imps. The handover frame's own mark also stood the heir's new copy down. | `adopt`/`adoptOwn` keep the flag; the save and the restore carry it; a record naming an heir marks nothing. A taken foe's touched state is its owner's word (flag 2), not its health against my own roll. |
| D6 | low | My summoned ally rides the loose lane with no side, so the others stand it as a foe - and their blows landed on it. | `applyOwnHit` refuses a blow on a `PlayerAlly`. |
| D8 | low | A peer naming me heir on fresh records every frame had me adopt real foes without end (a taken foe leaves the owner's puppet count). | Adoption stops at the owners' own allowances (QUEST_PUPPETS_MAX + CELL_LOOSE_PUPPETS) live. |
| Q3 | med | An heir whose copy held no such quest took the foe as a plain one (the open air: strangers stood it and no member's copy counted its fall) or refused it (the dungeon: lost). | It keeps its partner's word (`_keptTag`): it rides to the party as that quest's foe, a party member's blow lands, a stranger's does not, and its heirs are the party. |
| Q4 | med | The owner's relevance cull ended a shared quest foe a party member was fighting 120 m away - off their screen with no fall, and their copy had counted the wave as placed. | A shared quest's foe past my relevance stands while a party member is within the cull distance of it. |
| Q5 | low | A quest foe's body advertised its pile, but its take arm answers the owner alone: a member's press asked again forever. | Its record offers no pile (`o: 0`), as a watchman's body does. |
| Q6 | low | `$CUREVAM` and `$CUREWER` - the cure quests - failed every reader's tag check, so everyone, strangers too, stood their foes as plain puppets. | The quest word takes `$`. |
| Q7 | low | The sharer map outlived the share: a later private instance of a repeatable quest counted every wave as placed while the old sharer stood near. | A partner stands the wave only for a quest I hold AS shared (`_liveSharer`). |

**OWN1** (`net/online.js`, `server/src/index.js`, `net/wire.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | med | world114 was main's; a branch client welcomed by a world117 relay would stream the own frame and be closed (1008, terminal). | The merge: world118, OWN_RELAY_MIN 118; own1 pins world117 as no own lane. The note said an older relay "counts it as junk" - it CLOSES on the first; corrected. |
| O2 | med | `ownOk` stood from the last socket's welcome: a reconnect to a relay rolled back behind the lane streamed its own foes before the new welcome, and was closed. | A new socket clears `ownOk` until its own welcome. |
| O3 | low | The fan's byte budget is charged the sent length, but the re-serialised frame can grow (`1e20` out as 21 digits): 4.4x the room's cap fanned. | `fanOut`: a frame that grows is junk (an honest one round-trips at exactly the charged length). The cell's foes arm and the hit arm too. |
| O4 | low | A frame nested deeper than stringify takes (JSON.parse accepts it) threw out of the socket's handler with the budget spent. | `fanOut` catches it: junk. |
| O5 | low | Two test titles claimed more than they held. | own1 now drives a host hearing an own blow, and a cell's own frame without the prefix. |

**The sea and the pacing** (`scenes/world.js`, `scenes/deepWatersHost.js`, `scenes/deepWatersEncounters.js`, the three foe pools)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | med | An heir took the deep's foes as plain foes nothing counted, then stood its own full sea beside them once elected - 64 round one player. | The handover never names an heir for a `managed` (the deep's) foe - they stay their stander's, released with their pixel. |
| P2 | med | The deep's election flipped at exactly 200 m with pose noise, and each flip's reserved foes stood after the flip back. | Hysteresis (kept until a lower id is within the radius, taken only past 1.25 radii); a lost election gives back the reservations not yet stood. |
| P4 | med | A player on the shore still rolled land camps whose anchor landed on the carved seabed, 100-150 m out. | No camp anchor or member over the deep's water (the bathymetry's column deeper than 0.25). |
| P5 | low | FOE-CATCHUP capped the motor alone: attacks, casts and the seducer ran on the frame's own dt, so a hitch still swung at once while the body crawled. | Every pool's attack, caster and seducer step on `foeFrameDt(dt)`. |
| P6 | low | Offline, an arrow already loosed flew on under the quest's box that held its archer. | The arrows step on the held clock (`foeDt`). |

**Invisibility and the house** (`scenes/world.js`, `scenes/worldModes.js`, `scenes/horseCartPool.js`, `systems/handheldTorches.js`, `net/remotePlayers.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| I-A | med | In a building the sheet's Pack door (and its F5 page's) opened the STREET's pack, whose drop put the pile in the street's pool: no visitor's refusal, and nobody inside saw it. | The world's sheet takes a host's own pack; the building hands its own (`interiorSheetDoors`). |
| I-B | med | An invisible player's horse and trailing or following wagon were drawn whole. | The cart pool takes each peer's look: the classic lane's hidden owner's horse and moving wagon stand nowhere (a parked wagon is a wagon in the world); the enhanced lane's horse wears the owner's look. |
| I-C | low | With OnStow = Drop, a full hand in a visitor's home tried the refused drop every frame: the light held, the refusal said forever. | A refused floor stows the light, as Unequip does. |
| I-D | low | The throw key's wind-up put the light out before the release was refused. | A refused throw keeps it lit; the release says why. |
| I-E | low | An invisible party member showed on the town, dungeon and building maps. | The maps mark the party drawn here (`partyOnMaps`); the roll's election, the party's size and the Renown share still count them. |
| I-F | low | The chat's Nearby list and the page's readers named a concealed player. | Both skip them - the F key's law. |
| I-G | low | The classic lane silenced a concealed player (the sprite pass drove the steps, swings and hooves off the drawn list); the enhanced lane did not. | Every peer is heard (sound is no renderer, DFU's own law); the hidden are drawn nowhere and named nowhere. |

**The seven small fixes** (`player/collider.js`, `characters/enemyMotor.js`, `.github/workflows/account-deploy.yml`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | med | SQUEEZE1's own giant, walked off a ledge under a flat ceiling, walked on through the air: held on its floor, its head's centre rose past the ceiling's plane and stood on the ceiling's top face. | A floor-keeping body's head is a wall, never a floor (as a mid-body contact is). |
| S2 | med | SQUEEZE1 kept only bodies past RIDE_HEIGHT on their floor; a 1.8-2.6 m foe under a lower ceiling still sank out of the level. | Every foe's move asks for it (`keepFloor`, `FOE_KEEPS_FLOOR`); the player never does. |
| S3 | low | GATE-KEYS' service check ended on its first network error under `set -e`, though its loop asks for a minute. | The ask (`claim`) answers `000` on a timeout or a reset, and is asked again (fixed at the merge, where main's HOME2 law also asked the call to sit inside its retry). |

## Found at the merge

- **INVIS-NET x PEERLIGHT2** - main's Light-spell candle (a sprite and its light) hung before every peer, so the classic
  lane's invisible player walked behind a floating candle. It hangs before the players drawn now (`Field-Bugs-2026-09-27b.md`).

## Not fixed, and why

- **The orphan law's edge (PLAUSIBLE).** Each member measures "the lowest id near the foe" on its own eased poses, so
  two members near the 100 m edge can disagree. Unconfirmed; D2's give-back heals the returning-owner case, not this.
- **A heir picked without the quest** is no longer lost (Q3 keeps the word); the owner still cannot know which member
  holds its quest, so the heir is the nearest party member as before.
- **Leaving the party mid-fight** still takes a partner's foe off a member whose copy counted the wave as placed; the
  wave is not re-queued. Q4 closes the common case (the owner walking away).
- **Older clients and the `qf` fourth word** - moot: no `qf` ever shipped (QUEST-PARTY is this branch's).
- **The cell's own adoption bound** (D8's twin in the open air, PDEATH-FOES's): unchanged - a dying owner may
  legitimately hand more than one allowance. Recorded.
- **The other relay-capability flags** (`gateOk`, `pageOk`, ...) share `ownOk`'s pattern, but none sends before a
  welcome unasked; only the own lane did.

## The deploy

The merge moves the relay to **world118** (the own lane, the pose's concealment bits, and this audit's fan guard) - a
relay deploy on the push to main, which drops every connected player once. The account service stays acct14, and its
deploy runs (the workflow and wire.js changed) and mints GATE-KEYS' receipt pair on its first run; it drops nobody.
