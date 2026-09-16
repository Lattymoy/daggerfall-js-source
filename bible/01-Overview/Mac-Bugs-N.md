# MAC-N — three bug reports, 2026-09-16

Verbatim:

> 1. Weapon and Armorsmiths dont want to pay for loot
> 2. Classic inventory issues in shops. Item inventory is very large,
>    scrollbar not working correctly, submersible are completely
>    unclickable
> 3. Chat UI not visable with classic in online mode

All three are fixed. None of the three roots is where the report points,
and two of them are the same shape MAC-K and MAC-L kept finding: **the
law was right and a connection to it was missing.** "submersible" in the
second report is read as *submenus* — the four tab pages painted across
the top of the shop screen — and the fix below is built on that reading;
if it meant something else, the page under it is still owed.

---

## N1 — the smith offered nothing because one item in the deal was worth `undefined`

**What a player saw.** At an armorer or a weaponsmith, stage a piece of
loot for sale and the cost strip reads `NaN`; press Sell and the offer is
for 0 gold. At a general store the same loot sells. So: "Weapon and
Armorsmiths dont want to pay for loot."

**Why those two shops.** `storeBuysItemType` gives Armor to exactly three
storefronts — the armorer, the weaponsmith and the pawn shop — and the
first two are where a player sells a dead knight's cuirass. A weapon off
the same corpse sells anywhere that buys weapons, because a weapon has a
value.

**The root.** DFU mints every item through `DaggerfallUnityItem.SetItem`
(:555 `shortName = itemTemplate.name`, :563 `value =
itemTemplate.basePrice`) and `CreateArmor` runs it first
(`ItemBuilder.cs:301`). AUDIT 39 F103 had already found this class —
"looted gear sold for nothing and was taken" — and fixed it at the loot
factories with a private `named` helper. That helper was then copied:
`loot.js`, `unleveledLoot.js`, `startingGear.js`, twice in
`shopStock.js`, and a sixth hand-written pair in `createItem.js`. **The
corpse's armor was minted by none of them.** `equipmentItems` in
`combat/enemyEquipment.js` wrote `mintCondition({ group: 'Armor',
templateIndex, material })` — AUDIT 58 gave it a condition, nobody gave
it a value — so `tradeCost` summed `undefined` to `NaN`,
`CalculateTradePrice`'s `>> 8` collapsed the NaN to 0, and one cuirass
in a lot zeroed the whole lot. The knightly order's gift armor
(`worldModes.js`, G6) and the test room's armor rows had the same shape.

*A law kept in six private copies is a law the seventh minter does not
know about.* `itemTemplates.setItemFields` is the one export now — SetItem's
two readable writes, filling only what is absent, answering a copy as
the copies did — and every minter reads it. ONE DFU MEMBER, ONE EXPORT.

**And the arrow.** The shaft a bow hit leaves in its target
(`EnemyAttack.cs:145-147`, `WeaponManager.cs:555-557`) is
`ItemBuilder.CreateWeapon(Weapons.Arrow, None)` with `stackCount = 1`.
Seven sites in six host files spelt it as a bare `{ group, name,
templateIndex, material, stackCount }` literal — no value, no condition —
so a quiver *begun* by a recovered shaft priced at NaN too.
`bowDamageArrow()` beside `createWeapon` is the one minter; the seven
sites call it.

Not touched, and recorded: `validLootItem` (the wire's clamp) floors a
peer's value at `itemBaseValue` already, so a corpse shared over the
relay came out priced; the local kill did not. That asymmetry is what
made this a single-player-shaped report from an online player.

---

## N2 — the shop screen was the inventory window with its inherited half missing

`DaggerfallTradeWindow` **extends** `DaggerfallInventoryWindow`. Its
`Setup` (:193-268) calls the parent's `SetupTabPageButtons` (:228) and
`SelectTabPage` (:253), and its `FilterLocalItems` (:672-703) hands every
local item — the basket's and the pack's — through the parent's
`AddLocalItem` (:914-944), which is the tab's filter. The port's
`ui/nativeTrade.js` was written as a composition over the inventory
window's *geometry* and took none of the inherited *behaviour*. Three
consequences, and Mac named all three:

- **"Item inventory is very large."** The local list was the whole pack
  in one column. At a weaponsmith in Buy mode: every ingredient, potion,
  book and shirt the player carried. DFU shows the Weapons & Armor page.
- **"submenus are completely unclickable."** The four tabs are painted
  in INVE00I0, so they were on screen; a click on them fell through to
  the "consumed action panel" arm and did nothing.
- **"scrollbar not working correctly."** The window had no `wheel`
  method at all — the U-scroll seam reached it and found nothing — and
  neither item window could drag the thumb. AUDIT 64 F52's own record
  had flagged the first half: "Adjacent and NOT taken here:
  `ui/nativeTrade.js` has no `wheel` either ... it wants its own
  finding." This is that finding.

**What ships.** The four tab pages, with `tabAccepts` split out of
`nativeInventory.filterByTab` so the shop reads the one AddLocalItem
rather than a copy; the initial page (WeaponsAndArmor, MagicItems for
Identify — :253); a tab change resetting the local scroll (:820) and
clicking (:1209-1227); the parent's four tab hotkeys, and the hotkey
order corrected to DFU's add order (tabs, action panel, exit — the port
had exit first); the selected tab's INVE01I0 cutout, which meant the
trade art now loads `goldTexture` (:757); the wheel, one row a notch
over either list or its rail (`ItemListScroller.cs:314-316, :606-616`;
`VerticalScrollBar.cs:152-162`), silent, with the tip re-read under it;
and the thumb drag (`VerticalScrollBar.Update :101-130`) — latched on
the press, following the held button wherever the cursor goes, dropped
the frame it reads up or on the hosts' release edge — on BOTH item
windows, through two small helpers in `itemScroller.js` beside the
paging law ROAD-A7 put there.

**A cost worth naming.** An alchemist's Sell window now opens on the
Weapons & Armor page and shows nothing until the player clicks
Ingredients. That is DFU's behaviour exactly (:253 does not vary by
shop) and it is kept; it is not a bug, but it will look like one to a
player who has never seen classic, and the report of it will come.

**Not taken.** The trade window's `Setup` also calls `SetupPaperdoll`
and `SetupAccessoryElements` (:204, :231) — the doll and the twelve
accessory buttons draw on the shop screen in DFU and let a player equip
out of the basket. The port's screen still draws neither. Same missing
inheritance, its own slice.

---

## N3 — the online lane was never told the page was online

**What a player saw.** Skin set to Classic, Play Online: the classic
HUD, and no chat.

**What OL1 says should happen.** Online is the enhanced lane, whole —
the skin is forced enhanced over the stored choice (Mac's call,
2026-09-14). The chat is a DOM panel the enhanced skin mounts
(`world.js chatStart`, "classic has no place for it yet"). So under
OL1 the reported state cannot exist; that it did means OL1 was not in
force.

**The root.** `main.js` builds `params = new URLSearchParams(location.search)`,
and the front door SETS `online` on it for Play Online — on that
in-memory copy. Nothing wrote the copy back to the URL. The lane's one
read, `onlineLane.isOnlinePage`, reads `location.search` — as the skin
override does, as `uiSkin`, `getPref` and `modSetting` all do through
it — and so answered *false* on every real online session. OL1's own
record says "`?online` is the fact (main.js sets it for Play Online and
deletes it on every other door), read off the URL"; main.js set it on
something that was not the URL. The relay worked because the world host
reads `params.has('online')` off the copy. The lane was live for a URL
typed by hand and for the probes, and dead for the button — every
forced enhancement and every forced mod with it, not only the skin.

*Two copies of the page's parameters is two truths, and the reader
picks one.* `publishBootParams` writes the decided params to the URL
through `history.replaceState` before either world boot the front door
reaches, and before the menu runs it clears the six keys the menu
decides (`BOOT_DOOR_KEYS`) off both copies — otherwise a reload after an
online session would show the Mods pane locked for a player who has not
chosen yet. A history that refuses is warned about, loudly, and not
fatal. The desktop shell's `dagger://` scheme is registered standard,
and `switchSkin` already navigates it with a query, so the write holds
there too — unverified on a packaged build, and said so.

**What this does NOT do.** It does not mount the chat under the classic
skin. Under OL1 there is no classic online; if Mac wants classic online
back, that is OL1 reopened, and the chat would then need a classic
surface — a decision, not a fix.

---

## The pins — `test/macn_bugs.test.js`, 19 tests

Aimed at producers and populations. N1: `setItemFields` fills and never
overwrites; `equipmentItems`' seven records all carry a name and
`itemBaseValue`; the smith's Sell window over a real corpse totals a
finite price and offers gold — and the pre-fix shape, driven through
the same window, totals NaN and offers 0, so the pin fails on the fix's
removal; no `mintCondition({ group: 'Armor'` stands anywhere in `src/`
without `setItemFields` in front of it, the value law has one home, and
the bare arrow literal is gone from all seven sites. N2: the rects, the
initial page per mode, the pack and the basket filtered per page with
the basket first, the scroll reset and the click, the four hotkeys and
their order, the wheel on each list and rail and nowhere else, the drag
arithmetic against `dragScrollIndex` with the clamp, the release edge,
the pack's own latch and its right-button refusal, the INVE01I0 cutout
at the tab's rect over the base, and every host's `hover(vx, vy, e)` /
`release()` seam. N3: the written search, the bare-value spelling, the
kept hash, the no-write on an equal URL, the warned refusal, the lane
reading online and `uiSkin` answering enhanced over a stored Classic
off the string it wrote, and `BOOT_DOOR_KEYS` derived from main.js's
own `params.set`/`delete` calls rather than listed twice.

**Campaign: 14 mutants, 14 killed.** The corpse armor minted bare
again; the arrow as the literal; `setItemFields` not filling the value;
the pack ignoring the tab; the basket ignoring the tab; a tab change
keeping the scroll; the rail not carrying the wheel; the latch outliving
the button; the thumb never latching; the pack's thumb latching on a
right press; the tab cutout not drawn; the URL never written; the front
door booting without publishing; the menu reading a stale URL.

The four trade-window fixtures that were books moved onto the Weapons &
Armor page (daggers) — a book sits on Clothing & Misc in DFU, and the
page pins drive that page. `arrowfoes.test.js`'s AR1 source pin now
matches the minter rather than the literal.

NOT SEEN ON A GPU: the tab cutout and the drag are pinned through a
spy renderer and driven hover events, not a screenshot.
