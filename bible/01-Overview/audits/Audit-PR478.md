# AUDIT PR478 - ship life, the boat menu, plunder kept, before the merge, 2026-09-30

Mac: *"let's audit everything before we merge"*, of PR #478 as it stood: SHIP-LIFE (slice E), SEA-TRAFFIC, HELM-ZOOM,
BOAT-MENU, KEEP-PLUNDER and KEEP-BOATS, and the merge of main that carried them (`03-World/Naval-Combat.md`,
`03-World/Come-Sail-Away.md`). Six lenses read it on the arc's own harnesses: the ship-life module and its captains, the
naval host's harbours online, the boat menu, the plunder and the kept boats as exploits, the helm's zoom, and the
merge's integrity with the tests' honesty and the docs' truth.

Every finding was re-run on its probe before it was fixed and is pinned by a test that fails on the code as the PR
stood: `test/systems/naval/auditshiplife.test.js` (5), `test/scenes/naval/auditshiplife_host.test.js` (5), and new pins in `keepplunder` (2),
`boatmenu` (1), `fbsea_zoom` (1) and `seatraffic_online` (its second half, made honest). Mutation-proven:
`tools/mutants/auditshiplife.json` (11) and `tools/mutants/auditpr478.json` (21, one recorded equivalent), all dead,
and every older record the fixes moved re-aimed and killed again. Each fix carries an `AUDIT SHIP-LIFE`,
`AUDIT BOAT-MENU`, `AUDIT KEEP-PLUNDER`, `AUDIT KEEP-BOATS` or `AUDIT HELM-ZOOM` comment. The relay law holds and the
merge lost nothing of main's (every both-sides file re-merged digits-stripped matched the result).

## Fixed

### Ship life (`systems/naval/shipLife.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | High | **A hulk across a berthing's last leg held her for good.** The stall only counted with half sail set, and a berthing's last 110 m and a captain boxed in by the land both shorten it; her way was planned through the hulk again after each detour. | The stall counts whatever sail she carries; past `DETOUR_GIVEUP` detours an arriving ship takes another free berth, else out; any other keeps her own cruise. |
| A2 | High | **No way through the water was a straight line over the land.** A headland past `PATH_NODES` left her the line, sailed at the shore for good, and never planned again. | A way the grid cannot plan gives the errand up; she keeps her own cruise. |
| A3 | Medium | **A way's first and last legs crossed a spit.** The nearest open cell was any within three rings; the berthing leg sails with no swing off the shore. | The nearest open cell is one the water joins to the point; a leg's water sampled every quarter cell (`CLEAR_STEP`). |
| A4 | Medium | **Lurking places and patrol rings lay on the land** - 78 of 200 lurking places, half the rings' chords. | The lurking place a bearing the water from the mouth reaches; ring points the water from the hub reaches; a chord the land lies across goes by the hub (`ringOver`). |
| A5 | Medium | **A town on an isthmus lost its harbour, or kept berths the mouth could not reach.** Shores facing apart cancel the berths' mean normal. | Below `MOUTH_AGREE` the mouth lies off the nearest berth's own normal; a berth that cannot reach the mouth through the water is dropped. |

### The harbours online (`scenes/naval/navalHost.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | High | **Another player's moored ships were the sea's traffic** - a lower id ashore standing the port, the player sailing out met an empty sea again (SEA-TRAFFIC's own bug, back by another door). | Another's ship lying still at a berth I know is `berthed` (`atBerth`). |
| B2 | High | **Sailed 1.9-2.6 km off and back, the port was empty.** The director dropped its moored ships; the harbour never stood them again. | A harbour's moored ship is the harbour's to drop - engaged to the director. |
| B3 | Med-High | **The player's level drew the port's fleet** - two clients, two fleets, two hulls in one berth after a stander change. | The port's level (`HARBOUR_LEVEL`); a seed anyone's already is not stood again. |
| B4 | Medium | **The roller was elected among the players near me**, so one too far off to roll barred the one in the port. | Elected among the players within `HARBOUR_STAND` of the mouth (`rollsHarbour`). |
| B5 | Low-Med | **A moored ship taken over lost the harbour's hold on her.** | `adopt` marks a moored errand's ship the harbour's. |
| B6 | Low | **A door stood a ship that had sailed today at her berth again.** | The day's sailings kept apart from the harbours (`departedByPort`), across the sea's clear. |
| B7 | Low | **A port sounded before its water was built stayed harbourless.** | A null harbour is sounded again after `HARBOUR_RETRY_S`. |

### The boat menu (`scenes/world.js`, `systems/comeSailAway/csaBoatMenu.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | High | **At a helm the pad's d-pad stopped steering** while the crosshair lay on her own deck - the list took it; and another boat of mine's helm was a press away, unleft. | No list at a helm; no picker either. |
| C2 | Medium | **A mode switched at the helm's box kept the old verb lit** - a switch to Grab to sail, and the press packed her. | The helm's box under Steal is a key of its own. |
| C3 | Medium | (C1's second half.) | As C1. |
| C4 | Medium | **A plain click on the deck took the helm** - the hull's top row lit. | The hull's list starts unlit (a player's does); the wheel's first step lights the top row. |
| C5 | Low | **Indoors no list** - the interior plaque races no boat. | A building's or a dungeon's hull press opens the picker. |
| C6 | Low | **The far ladder aimed at boarded at the near one.** | The box aimed at, where it is the verb's (`boatVerbNode`'s `aimed`). |

### Plunder and kept boats

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Low-Med | **Off the helm the stow went to the pack, and what did not fit was let go unsaid.** | My boat nearest me before the pack; what will not fit is said. |
| D2 | Low | **A boat kept in a dungeon stood in a building on its pixel** - the mod's inside test is any interior, which its own default never met. | Stood in a dungeon alone (`isPlayerInsideDungeon`, DECLARED). |
| D3 | Low | **Naval combat switched off took the plunder unstowed.** | `setEnabled(false)` stows first. |

### The helm's zoom

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Medium | **Pinned by her own rig, zooming in spent four to seven notches unseen.** | In from where the camera stands (camera.lua:151's debt). |
| E2 | Medium | **A trackpad's swipe crossed the whole range** - a burst of clicks summed into one frame's ratio. | One notch a frame at a helm. |
| E3 | Low | **Eye of the Beholder out from below its base leapt to it.** | The mod's own 0.2 ladder below the base both ways. |

### Tests and docs

| ID | Finding | Fix |
|---|---|---|
| F1 | `seatraffic_online`'s second half passed whatever the code did (the director's count never falls). | From the lower id's swim on, the other launches none. |
| F2 | The patch notes said plunder is stowed if you sail off. It is not: a door, a jump, a fast travel. | Said as it is. |
| F3 | Come-Sail-Away said the ships list chest, status and position; only the Small Ship lists all three. | Said as it is. |
| F5 | The detour's other side was suspected unpinned. | Mutation-proven (`SHIPLIFE-detour-other-side-gone`, dead). |

On-foot zoom is unchanged by construction - every E fix is inside the helm's branch - and the reviewer's 2000 random
sequences against main before the fixes found none.
