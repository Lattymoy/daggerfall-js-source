# AUDIT PORTAL1 - the Portal Stone audited, 2026-10-04

The owner, of PORTAL1 (`06-Systems/Portal-Stone.md`): *"Audit this. It needs to be perfect. Also every current player
should recieve x10 of these. They should stack."* Five lenses read the feature at `c1b554f2` (PORTAL1 and main's #602,
#603 merged in), each independently, read-only, verifying its own findings before reporting them (a node run for every
claim it could run):

- **the item and its laws** - `systems/portalStone.js`, the row in `gateSpoils.js`, every door a bound miscellany piece
  passes (the counters, the trade, customs, the wire's loot lists, the save, the cards, the hotbar);
- **the counter** - `scenes/worldModes.js` and the two shop popups on both skins;
- **the use and the portal** - `scenes/world.js`, `scenes/portalGates.js`, `scenes/portalFx.js`, the readers, both maps;
- **online** - the foes frame's `pg`, the relay's fan-out, the receivers;
- **the tests and the record** - the pins (43 extra mutants run against them: 39 survived), the bible.

Nothing was fixed while a lens was reading (Home.md, 17l). 33 findings; three lenses found the step-out-of-a-door bug
(U1 = T2) and two the units bug (O3 = T1), so 30 are distinct. Each fix carries an `AUDIT PORTAL1 <ID>` comment and is
pinned in `test/systems/portal1_stone.test.js` (12, three of them new); `tools/mutants/portal1.json` now holds **92 mutants, all
dead** - the record's first 40 re-aimed at the reworked code or retired with the code they mutated (the carry gate, the
straight-down spot), and one for every fix and every survivor the tests lens found.

## Fixed

**The item** (`systems/portalStone.js`, `systems/reforge.js`, `scenes/exteriorFoes.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| I1 | minor | The purse spent a WORN shard - a shard is a gem, a crystal a slot takes, and the split one is the pack's last record, which `spendShards` takes first: the equip table kept a record the pack no longer held (a ghost on the doll; the Reforge has carried it since LOOT9). | `reforge.js` `spendable`: a shard the purse draws on is unlocked AND unworn, for the Reforge and the counter alike; `shardsKept` counts the rest, and the counter's words name them. |
| I2 | minor | A stone in a companion's or a sworn revenant's storage (kind 'storage', where a bound piece may lie) opened the map and was refused only at the pick - the pick read the player's pack. | The door reads again the list the stone came from: the pack, the wagon, or that list itself. |
| I3 | nit | The counter's carry gate refused an over-burdened player the very sale that lightened the pack (`canHoldAmount` answers 0 over the limit). | No carry gate: the stone (0.25 kg) weighs less than its five shards (0.5 kg) - pinned on the rows, so a change of weight trips it. |
| I4 | minor (older) | A foe handed to me as its heir landed its list without the bound filter (exteriorFoes.js, 3f926259f) - a crafted peer could hand over bound pieces, and a forged stone is a free portal. | `unbound(validLootList(r.it))`, SS3's law at every other landing. |

**The counter** (`scenes/worldModes.js`, `ui/merchant*`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | minor | The plain shop's popup carried no U24 identity guard: dispatching the Portal Stone's question, it stayed in the slot done under the box, and the answered box popped back to it - the game paused a frame more, MENU-RELOCK never taking the mouse back. The test handed the window an `onClose` the host never did. | `onClose() { if (interiorOverlay?.hooks === this) ... }` - the popup is the one holding these hooks (both skins keep them as `hooks` and call `onClose` on them), so the construction stays inline (IT1's pin). Pinned against the host's own shape. |
| C4 | nit | A purse already short was asked first, then refused after the Yes; a player with every shard locked read "You carry 0." twice. | Short: told at once, the locked and worn shards named. |
| C5 | nit | Three comments said a window draws no text of its own / the classic skin has one port-drawn row; the hooks' JSDoc lacked `portal`; Ledger A's accelerators row did not name P; the row's dark was a second literal. | Re-worded; Ledger A's row names P; `REFORGE_ROW_BG` exported and imported - one dark. |

**The use and the portal** (`scenes/world.js`, `scenes/portalGates.js`, `systems/portalStone.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| U1 = T2 | MAJOR | Walking out of a building or a dungeon could teleport you. The frame returns before the portals indoors, so the step's last answer outlived the visit: a portal 1 m outside a shop's door (one opened 3 m from it, facing it) took whoever came out. The test's "tick(null)" was a call the host never made. | THE STEP IS FORGOTTEN across a gap: frames more than 250 ms apart or feet that jumped 1.5 m (`PORTAL_STEP_GAP_MS`, `PORTAL_STEP_JUMP`), and the host forgets it at every change of place (`forgetSteps`, on the torches' transition sweep). |
| U2 | minor | The pick re-asked only the mode and a move under way - open the map, let the ambush come, pick and leave; a death under the held map's lowering still spent a stone. | ONE door (`portalDoorRefusal`), asked at the Use and again at the pick. |
| U3 = O4 | minor | No hold on stepping in, and none for a duel or a siege at the door: a duellist walked out of the ring through anyone's portal (the duel ended 'left', no loss reported), the stone worked in a siege's room where Teleport and Recall do not, and an autopilot journey walked its traveller into a stranger's portal. | THE HOLDS (`portalHold`): dead or busy, a duel (an arena bout's hold with it), a siege's room, an enemy near, a journey (Travel Options' or the Overworld's) - one ladder for the door, the pick and the step; a step in a hold is said (busy in silence). |
| U4 | minor | Every pick on the held map flashed the screen black: the pick lifted a black only the classic box makes. | The black lifts only where it is. |
| U5 | minor | An arrival that threw left the screen black for good. | It lifts the black; a move already under way lifts it too. |
| U6 | minor | The arrival ran inside the frame, and the teleport's synchronous half freed batches the same frame then drew (GL errors under the black). | The teleport a microtask on - every other teleport's way. |
| U7 | minor | The following team (Horse Cart and Cargo) was not cached around the arrival. | `handlePreFastTravel` / `handlePostFastTravel` around it, as the online respawn's. |
| U8 | minor | The place probed straight down only: facing a wall within 2 m stood the portal inside it, out of reach, the stone spent; no ground stood it at the feet' height; on a boat it was sailed away from. | `portalPlace`: short of a wall (0.6 m, never nearer than 1.2 m - else 'room'), on the ground within 3 m (else 'ground'), nothing spent on a refusal; the water and a boat's deck refused at the door. |
| U9 | minor | Only one branch of one load cleared the portals (a dungeon's save, the online wake, the classic import kept them, and a load's own stone refused for 30 s). | A load ends every portal - asked at the one door every load passes (`save.js` `restoresSoFar`, read by the frame), so no branch is left. |
| U10 | nit | The standalone street said "under the open sky" while you stood under it. | Its own words (`PORTAL_TEXT.noStreet`). |

**Online** (`scenes/portalGates.js`, `scenes/world.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | MAJOR | A crafted peer could stand a portal anywhere - a fresh id every frame, 1.2 m ahead of a walking player - and send them across the map (a node run took a walker in 100 ms). The first peer word that moves the receiver's own body. | A peer's portal is believed only within 40 m of the peer's own feet (`PORTAL_PEER_REACH`, the pose the session eases), one an opener (another id while the first stands is refused). |
| O2 | MAJOR | The same id said again pushed the time on, past the vortex's own life: a portal kept open for ever, unseen. | Said again: never longer than first said. |
| O3 = T1 | minor | `PORTAL_SAY_REACH` was 256 in the wire's units - Daggerfall's, 40 to the metre: 6.4 m, read as 256 m. A metre-sized test fixture hid it. | Every distance in the scene's metres; the opener says it within 32 m; the tests run the host's own x40 frame. |
| O5 | minor | A peer's portal stood at the opener's height, never on the receiver's ground (two grounds can part - DISC20-C). | Stood on this player's ground when it is found within 4 m of the opener's height (`PORTAL_REGROUND`). |

**The tests and the record**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T3 | major | The door and the pick had no pin: every refusal, teleport mode, the map shown, the black lifted, the place, the frame owed full - each survived. | The door, the pick and the arrival mounted from world.js's own source over a stand-in scope (csa_together's idiom) and run. |
| T4-T9 | minor | The price's boundary, every number the record states, the wire's z bound, `d[1] < 0`, an empty id, the probe's direction, the floating origin, the vortex's life, the refresh, the seal, the cards on both skins, the row drawn, the export, the question - unpinned. | Each pinned; each has its mutant. |
| T10 | minor | Portal-Stone.md misstated the mutant records re-aimed; a JSON re-dump had rewritten a curly apostrophe as an escape. | Corrected; the records edited as text. |
| T11-T13 | nit | A pin read the unreachable null arm; the relay check; the pack door matched anywhere; fixtures built by hand. | The pack door read inside `packDoors`; the wire's fixtures are the producer's own records. |

## Stood, and why

- **The row is shown with Loot Rarity off** (C2). Offline with the ladder off nothing salvages, so the row asks and
  refuses; online the ladder is the room's and on. The owner's words were "always readily available": the row stands.
- **No row where a shop's popup has no art** (C3) - a session with no ARENA2, the never-trap fallbacks; the record says
  "a keeper's popup carries the row when its art stands".
- **An honest portal in a doorway is walked into** - it is a violet vortex a metre and a half wide, and walking into it
  is the act. The holds keep it shut to a fight, a duel, a siege and a journey.
- **The classic row is NOT SEEN on screen** (C6) - no ARENA2 in this container; the native-window rule's eyeball is owed.
- **Welkynd Shards and Deadlands Embers are gems** - worn as crystals, and in the Item Maker's Ingredients - older than
  PORTAL1 (I1 closed what it cost the purse).

## The gift (the owner's second ask)

PORTAL-GIFT: every character that already exists is given ten Portal Stones, once, onto its own unlocked stack - the
LOAN-AMNESTY shape (`06-Systems/Portal-Stone.md` "The gift"). `test/systems/portal1_gift.test.js` (3); its eight mutants in
`tools/mutants/portal1.json`.
