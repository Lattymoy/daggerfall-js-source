# AUDIT IT1 - Immersive Travel audited, 2026-10-04

The owner, of IT1 (`06-Systems/Immersive-Travel.md`, kkgobkk's Immersive Travel 1.5 ported 1:1, PR #589): *"Lets
audit this"*. Five lenses read the integration at `3ef8bc53b`, each independently and each verifying its own findings
before reporting them (a node probe or a transliteration of the IL for every claim):

- **the laws** - `systems/immersiveTravel.js` and its tables against the IL, line for line (a 200,000-case fuzz of both
  calculators against a transliteration of IL_1d44-1e46 and IL_1cb8-1d2e: no mismatch; every `IT_TEXT` line a verbatim
  `ldstr`; the three tables once each, byte for byte, in the DLL);
- **the classic window** - `ui/travel/travelMapWindow.js`, `ui/travel/travelPopUp.js`, against the IL and DFU's two windows;
- **the enhanced sheet** - `ui/heldMap.js`;
- **the host and the online lane** - `scenes/world.js`, `scenes/worldModes.js`, `systems/online/onlineLane.js`, the menu;
- **the gate world data** - the four patches, the tool, the layer, against the mod's own files out of the bundle and
  Beautiful Cities' pack (built against a real BSA).

26 findings. Every one was re-read here before a line moved; three lenses found the same popup bug (C2 = L2 = H-M1),
so 24 are distinct. Each fix carries an `AUDIT IT1 <ID>` comment, is pinned in `test/systems/auditit1.test.js` (16) and is
mutated in `tools/mutants/auditit1.json`: **30 mutants, 30 dead.** The pins the fixes moved say `(PIN MOVED)` where they
stand.

## Fixed

**The laws** (`src/systems/immersiveTravel.js`, `src/scenes/world.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| L1 | medium | `itHere` answered the region as the raw politic index - 128, not PlayerGPS.CurrentRegionIndex (PlayerGPS.cs:165-186): on the High Rock sea coast (politic 64) the ship rule's IsPlayerInTown, which asks for region 31 (IL_18f2-18f9), could never answer yes, and a captain with LimitedRangeInSmallDocks refused a voyage the mod sails. | `maps.getRegionIndexAt` - the port's PlayerGPS law, already in MapsFile. |
| L2 | medium | = C2 below. | |
| L3 | low | Init registers its services only once BOTH factions went in (IL_047a-04ff, the second asked only after the first; else IL_0501's error and no service). The port registered them whatever the factions did. | The services after `registerCustomFaction(drivers) && registerCustomFaction(sailors)`; else the mod's own line, logged. |
| L4 | low (doc) | Departure 3 said the static constructors read "four" settings once a session - they read nine - and that "the fees are read as they bill, as the mod reads them" - the port bills from the read the map takes as it opens. | Departure 3 rewritten. |
| L5 | low (doc) | The calculator's comment said "a sea leg on the ship toggle" pays the ship. The mod has no ocean guard (IL_1dfb) where DFU has one: any trip on the ship toggle pays a sea day. | Named as CARRIED, in the code and on the page. |

**The classic window** (`src/ui/travel/travelMapWindow.js`, `src/ui/travel/travelPopUp.js`, `src/systems/travel/travelMapState.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | medium | A driver's map shared the player's own persistent filters and Travel Options' mark. The mod's is a NEW CarriageMap (`newobj`, CarriageTravelService IL_05a2), whose filters start shown and whose class has no middle-click handler: a player who hid Towns saw no town on the driver's map and could pick none, a flip there flipped their own map and the save, and a middle click set TO's mark. | A driver's or a captain's map takes `freshTravelMapFilters()`; `_markLocationHandler` returns on the mod's maps. |
| C2 | medium | With the mod on and Travel Options off, the player's own map is CarriageMap, whose CreatePopUpWindow nulls the persistent popup before every pick (IL_0870-0885), so DFU's base builds a new one on Cautious / By ship / At inns (DaggerfallTravelPopUp.cs:85-87). The port restored the remembered toggles - every player who never met a driver. | No restore on the CarriageMap; what the popup chose is still remembered (GetTravelMapSaveData reads the last popup). |
| C3 | low | The popup's countdown ran on under the mod's OK box (and TO's ship boxes, and the diseased question): the trip fired and paid with the box up. DFU updates the top window alone (DaggerfallUI.cs:433). | `tick` waits while a box is up. |
| C4 | low | On a captain's map ShowOnlyDocks hid a place's dot but not the place: it was hovered, clicked and found. SeafarersMap.checkLocationDiscovered (IL_17a0-17ee) is the virtual all four ask. | The instance `checkLocationDiscovered` answers the captain's rule (and no ports filter on the mod's maps). |
| C5 | low | I over a popup opened Travel Options' location-info box on the mod's popups and on DFU's own with TO off (an AUDIT-TO1 I5 gap the mod's popups inherited). TravelOptionsPopUp's Update alone polls I. | Gated on the popup's Travel Options. |
| C6 | low | A middle click reached the map under an open popup and re-aimed `locationSummary`: a trip to Copperfield arrived as "Daggerfall". The map is not the top window while its popup is pushed. | The middle button is heard only when no sub-window or box is up. |
| C7 | low | The mod's boxes' clicks: a toggle box's OK played none (DFU's message-box button plays its click) and OnPush's played one where the mod plays two (the button's, then PlayOneShot 360 at IL_1bbb-1bc5). | One click on every OK, a second on OnPush's. |

**The enhanced sheet** (`src/ui/heldMap.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H-M1 | medium | = C2, on the sheet. | The same: DFU's new popup's three on the player's own CarriageMap. |
| H-L1 | low | A refusal the sheet showed stuck: `_itRefusal` was cleared only by a new pick, so a later press that opened the panel kept the mod's box over a live Begin. | Cleared at every press, before the mod is asked. |
| H-L2 | low | = C1, on the sheet: the shared filters (and the player's road and track chips, where the mod draws by DrawRoads / DrawTracks), the mark drawn and set. | A driver's sheet takes fresh filters with its roads and tracks the mod's (`itMapPaths`); no mark drawn or set. A chip flipped on it is its own (departure 7). |

**The host and the online lane** (`src/scenes/world.js`, `src/ui/merchant/merchantServiceDoor.js`, `src/systems/online/onlineLane.js`,
`src/ui/enhanced/enhancedMenu.js`, `src/systems/features.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1 | medium | On the enhanced skin - the default, and every online player's - the driver's popup button read **"Sell"**: the overlay ignored `hooks.label` (RR3's fault, which IT1 made the main road). | `hooks.label ?? merchantServiceLabel(...)`, as the classic window draws it. |
| W2 | medium | Online a sun-averse character could ride a carriage by day and arrive in daylight. Offline DFU's arrival clamp lands them after dark (DaggerfallTravelPopUp.cs:350), so the mod asks nothing; online the port skips that clamp and relies on the travel map's door, which the driver's map is pushed past. | Online (the clamp's own condition, `sharedClockOn()`), the driver's map refuses as the door does, with the hour night falls. Recorded: departure 11. |
| W3 | low | The online floor's `&& !opts?.immersive` was never reached - a driver's map has its own `onTravel` straight to `fastTravelTo` - and the one popup that could set it was the player's own under Disable Normal Travel, the trip that switch exists to refuse. The docs described a mechanism that did not exist. | The floor back as TRAVEL-ONLINE wrote it, its pins and mutant with it, and `it1.json`'s IT1-26 (which guarded the exception) retired - AUDIT-IT1-W3 now mutates the exception back in; the page and Travel-Options item 9 say how a driver's trip really goes. |
| W4 | medium | The Features row said "takes effect when the game next loads", but the factions went in once a page while the services, the gates and the maps read the switch live: off at the start and switched on, carriages stood whose drivers only talked; switched off, towns kept or lost them by the block cache. | The mod is LOADED FOR THE GAME (AUDIT PRE-MERGE 0928 S4): latched as Init runs, and every door asks `immersiveTravelLoaded()`. The row: "Takes effect when the game is next started (an in-game Load keeps what it started with)". |
| W5 | low | The menu and the lane said a driver's fare is "the one fast travel there is" online - a port's ship passage is too (TRAVEL-ONLINE item 9). | "fast travel over land", and the Mods line names the room's hold on the fares and rules. |
| W6 | low | A driver's map that did not open said nothing (a click landing after the player stepped indoors, the classic art not loaded). | `openImmersiveMap` says the travel map door's own lines. |

**The gate world data** (`tools/immersiveTravelPatches.mjs`, `vendor/immersive-travel/WorldDataPatches/`,
`src/world/immersiveTravelGates.js`, `src/scenes/modWorldData.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| G1 | high | The header-count patches could rebuild the author's files on no BLOCKS.BSA: the editor writes BuildingDataList at NumBlockDataRecords (4) where the classic block reads 32 slots, and a scale of 1 on the classic models, whose records carry none - both on the files themselves, and Warm Ashes' patches (diffed against a real BSA) remove the same slots. The ARENA2 test would have failed all four, and its documented remedy - WD1's own diff - would have been refused by the layer. | The tool carries both (28 `r`, 6 `s` per block; the four patches regenerated, byte-identical inserts). The layer lays only a patch's inserts past the classic counts, so WD1's diff can ship. Pinned on an editor block rebuilt sha256 for sha256. |
| G2 | medium | One op the layer could not lay threw inside `loadModWorldData`, which every host awaits - no world would load for anyone, the mod on or off. | Other ops are passed over, never refused; the install is guarded. |
| G3 | medium | = W4, on the gates: the patch's and the layer's `isOn` read the switch at every ask. | Both ask `immersiveTravelLoaded()`. |
| G5 | low | The 52 composites are 24 farm, 24 tavern and 4 road, not "wall-and-farm"; the test named a farm only. | The page corrected; all three kinds pinned. |

## Recorded, not changed

- **G4** (low): Beautiful Cities' two gate props (models 42520, 45181) stand 23 to 49 units - under a metre and a
  quarter - from the mod's team or horses at all four gates and every composite on them. Clipping is likely and
  unproven without the models' sizes; it sharpens the page's NOT SEEN for the owner's eyes.
- **G5's second half**: the rule that `registerWorldDataPatch` hands `onServed` the very object it registered is
  pinned by source (`test/formats/worldData/it1_worlddata.test.js`); a refactor that registered a copy would lay the carriages twice on
  the gates with no town mod. No behavioural pin: the door needs a bound BLOCKS.BSA.
- **The sheet's chips on a driver's map** (H-L2): the mod has no path buttons; the sheet keeps its chips, local to that
  sheet - departure 7.

## Not verified here

No ARENA2 and no GPU in this container. The four patches now carry every round-trip change the files themselves show;
any other (an automap byte) only `ARENA2_PATH=... node --test test/formats/worldData/it1_worlddata.test.js` can say, and
`node tools/immersiveTravelPatches.mjs <immersivetravel.dfmod> <arena2>` writes WD1's checked diff, which the layer now
takes. Nothing was seen in a browser.
