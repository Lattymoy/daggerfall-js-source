# AUDIT PI1 - Physical Items audited, 2026-10-07

Mac, of PI1 (`06-Systems/Physical-Items.md`, demifiend000's Physical Items 0.1.29 ported off its IL, PR #680): *"Lets
do a conprehensive audit and ensure this is perfection"*. Five lenses read the integration at `c8ff1fda`, each
independently, and each verified its own findings (a node probe, the IL, or the host's code) before reporting them:

- **the rendering** (R): the pictures, their textures and their dress, on both picture paths;
- **the IL** (I): `systems/physicalItems.js` and the layer's law against the assembly, method by method;
- **the hosts** (H): the four hosts' halves, the online room, the saves and the windows;
- **the layer** (L): `scenes/physicalItemsLayer.js` and the pool, as code (lifetimes, races, the frame);
- **the record** (D): the page, the README, the settings' words, the tests' and the comments' claims.

43 findings were fixed and 13 recorded as departures or notes. Every finding was re-read here before a line moved; where two lenses found the same fault the IDs are joined (R1 = H1
= L1). Each fix carries an `AUDIT PI1 <ID>` comment and is pinned in `test/audit_pi1.test.js` (20) - the shoulder's in
`test/pi1_physicalitems.test.js`, whose three pins the fixes moved say so where they stand - and is mutated in
`tools/mutants/audit_pi1.json`: **52 mutants, 52 dead**; PI1's own `tools/mutants/pi1.json` (47, five re-aimed at the
code the fixes rewrote) **all dead**.

## Fixed

**The pictures** (`src/scenes/physicalItemsLayer.js`, `src/systems/physicalItems.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 = H1 = L1 | high | Every pool's layer uploads under the one archive into the renderer's one texture cache, and each layer freed what IT had asked for: a dungeon's teardown freed the street's pictures with its own, and every Longsword in town stood invisible but pressable. | A picture is held by the proxies standing in it, counted per renderer across every layer (`holdTexture` / `letTexture`, `heldTextureCount`), uploaded when the cache lacks it and freed with its last holder. |
| R2 | medium | The Morrowind picture was rendered at `mountPicture`'s 256 texels, where the tier rim (two texels of the silhouette) is a hair. | Asked at 64 (`PI_MW_PX`), the classic icons' density. |
| R3 | low | The picture's clear texels were black, and the mips bled a dark fringe round every item. | The cut's clear edge is bled from its shown texels, alpha untouched (`bleedEdges`). |
| R4 | low | The rim and the size were set once, at the dress: a slider moved changed nothing until the item was re-made. | A settings change re-dresses what stands; the rim is set every frame. |
| R5 = L8 | medium | An item was presented (`isPresented`) at its mint, before its picture came: its pile's bag and press and its body's line went at once, and a picture that never came left an item with no picture, no bag and no line. | Presented only once a batch stands; `presents` asks for the batch. |
| R6 = L9 | low | A re-ask (a build landing) that came back empty dropped the picture already standing. | A failed re-ask keeps it and asks again later. |
| R7 | low | A Morrowind render with nothing in it (a mesh whose textures drew clear) was stood as the picture, cut to the whole frame: an invisible item. | A picture with nothing at alpha 128 is a miss (`hasVisible`); the classic picture stands. |
| R9 = L7 | low | A Morrowind miss while a build stood, and a picture that did not come at all, were never asked again (a lazy archive's first miss is not the item's for good). | Asked again 5, 10 and 20 s on (`PI_RETRY_MS`, `PI_RETRY_MAX`). |
| R11 = L12 | low | Every proxy asked for and cut its picture, though a hundred arrows share one. | Cut once per layer by its source's key; the pack's key asked before its picture. |

**The law against the IL** (`src/systems/physicalItems.js`, the layer, `src/systems/quickLoot.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| I1 = L5 | medium | A body's item started at its scatter point outright; the mod sets it 0.65 m over the body and moves it out through `ConstrainItemMovement` (`[IL_4fdc]`). A body against a wall threw its items through it. | `constrainMove`: the move stopped short by the item's half-width and slid along the face; the launch is taken from where it ends. |
| I2 | medium | The press took what fitted of a stack; the mod's `CanCarryWholeStack` (`[IL_858c]`) takes the whole stack or says "cannotCarryAnymore". | `takeOneItem(..., { wholeStack: true })`; quick loot keeps its part. |
| I3 | low | Every shift-drop's footprint was 0.2 m; `FlushPendingDrops` makes it max(0.2, 0.6 x the item's size). | `dropRadius`. |
| I4 = L3 | medium | The shoulder pushed bodies in the air (the mod asks `TryFindGround` within 0.15 m, `[IL_1edd]`), ignored height (its `OverlapBoxNonAlloc` box is grown 0.08 m on every axis, `[IL_1f4a]`, so a body over another was pushed), searched every pair, and reset the settle clock, which the mod's never does. | By the ground only (`nearGround`), settled neighbours included, the height gate, a 1 m grid, the settle clock untouched. |
| I5 | low | The spiral's floor was the first face straight down from the feet's height, and its path check was a bare ray. | `TryProjectBatchPointToFloor` (`[IL_4104]`): 2 m over the feet, 5 m down, a face at least 0.5 up, the one nearest the feet's height (`nearestFloor`); `HasClearBatchPath` (`[IL_4248]`): lifted 0.2 m, a 0.05 m skin. |
| I6 | low | An item was pressed from the pool's treasure reach, not the mod's 3 m (`RaycastPhysicalItem [IL_5b54]`). | `PI_REACH`. (The press box's minimum stays: departure 7.) |
| I10 | low | An infinite Impulse Strength read as the shipped 200. | Clamped to 0..400 percent. |
| I11 | low | A summoned item was refused only after the map arm: a summoned map was read. The mod refuses it first, aloud (`[IL_8494]`). | The summoned refusal first, "You cannot remove this item."; the map arm after it. |
| I12 | low | Two bodies on one spot parted the wrong way round: the mod sends the lower instance id left (`[IL_2088]`), the port sent it right. | The lower index goes to -x. |
| L6 | low | The floor was asked from 0.5 m (and a step's rise) over the item's foot, so an item rolling under a table was stood on its top; and a rising item went through a ceiling. | Asked from 0.05 m (`PI_PROBE_LIFT`); a ceiling turns a rising item back at the bounce. |

**The hosts** (`src/scenes/world.js`, `exterior.js`, `worldModes.js`, `dungeonContext.js`, `droppedLoot.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H2 | low | The online room was told of a take only when the whole item left: a part of a stack moved and no peer heard. | Moot under I2 (no part is taken); `taken` is told of any press that moved anything. |
| H3 = L2 | medium | P or J armed over an item was never spent by the press, so the next E on a pile took all of it (WB9's spoils bug, again). | `quickLootSpend()` on every press. |
| H4 | medium | The fate window (a body's pack opened from the street host) offered the shift-drop indoors and underground, onto the street's pool. | `physicalDropOn: () => false` there. |
| H5 = L11 | low | A body that moved (a ship's deck) left its items where they lay. | A moved body carries its items. |
| H6 | medium | The dungeon's own save wrote its piles without the `physical` flag: a shift-drop came back a bag. | The flag saved; restored lying. |
| H7 | medium | A dungeon body whose room word the build could not read stood its items (its window refuses it); a body's silver was never rolled on a press; a transformed lycanthrope's paws took items. | The unreadable gate; `silverFindAt` at the first take (by the room's name in the dungeon); `racialSuppressInventory`. |
| H8 | low | An emptied shift-drop called `releaseEmptied`, which deactivates every emptied container in the pool (an unopened, empty scene chest too); and a picture landing after a teardown was dressed. | That pile removed alone; a retired proxy drops its late picture. |
| L4 | low | A body's list replaced with equal items (the dungeon room's word, a restore) threw every item out again. | Each picture handed to its look-alike (`itemLook`) where it lies. |
| L10 | low | The flights ran under a window; the mod's `FixedUpdate` returns on `IsGamePaused` (`[IL_1eb6]`). | `paused` from each host's own pause answer. |
| L15 | low | A corpse feed that threw was read as "no bodies" and retired everything; a plaque named an item already gone from its list. | A throw keeps what stands; `contents` checks the list. |
| D1f | low | The watch called into a building stood no items for its dead. | The interior feed lists `interiorGuards` too. |

**The record** (`bible/06-Systems/Physical-Items.md`, `vendor/physical-items/README.md`, `src/systems/modSettings.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | medium | The page recorded six departures; the port departs in fifteen places. | Fifteen, each named (the press box, the body's own press, every searchable body, no Control split, laid per click, the 4 s window, a restored drop settled, words not boxes, the load's re-throw, and the rest). |
| D2 | low | The page called the rim the world boss's; the boss's spoils wear none. | The line is the boss's; the rim is the port's own. |
| D4 | low | "An item never found by a floor stands after 8 s (the gate spoils' rule)": every flight stops at 8 s, and the spoils' rule is 6. | Rewritten. |
| D5 | low | "TryPickup is DFU's own rules": it is the mod's own order, which differs (the whole stack). | Rewritten, in its order. |
| D6, D7, D8, D10, D11, D12 | low | The host table (the watch indoors, the unreadable gate), the Testing row's "the room told", the Enabled key's words, the README's pickup and persistence lines, the layer's header, an import comment. | Each corrected. |
| IL8 | low | The nudge read as distances. | 0.08 m/s along the bearing and up - the body's start velocity (`StartDynamic`). |

## Recorded, not changed

Each is a departure on the page (`06-Systems/Physical-Items.md`, "Recorded departures"):

- I6: the press box's minimum (departure 7).
- I7: a press on a body opens it rather than taking its nearest item (8).
- I8: every searchable body stands its items (9).
- I9: no Control split (10).
- Laid per click (11).
- D1g: the 4 s window (12).
- I13: a restored drop lies settled (13).
- I14: words, not boxes (14).
- R10: the load's visible re-throw (15).
- R8: the Morrowind framing on the ground needs an in-game look.
- R12: `exterior.js` draws no loot lines (before this mod too).
- R13: the rim's pad is not in `batchSphere`, and each Rare item takes one of LOOT11's eight line slots (6).
- The wilderness's `revealLocation` has nothing to name, and says "readMapFail" as Use does (5).

## Not verified here

A live browser run: the container has no ARENA2 data, so nothing was seen in-game, in either picture mode.
