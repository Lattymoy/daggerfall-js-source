# INTEGRATION 2026-10-04 - Steady shadows balanced, Nearby quests, Loiter anywhere, Endless provisions

Three handoff downloads, integrated at the owner's word ("Get these integrated"):
`steady-shadows-balance-patch`, `daggerfall-patch-quests-loiter-shadows` (it carries the first whole: "Apply it on its
own, or over either earlier download") and `Plenty-Rations-Campfirekits` (Endless Provisions v2). Their patch notes
ride the pull request's description (CLAUDE.md), never the tree.

| | Change | How it landed |
|---|---|---|
| 1 | STEADY-BALANCE - the player's silhouette from the two nearest lamps again; Calmer eye its own switch, off | as delivered |
| 2 | NEARBY-QUESTS - a remote quest site within a reach that grows with level (a row, on by default) | as delivered, its registry pins merged |
| 3 | LOITER-ANYWHERE - online, Loiter wherever the rest window cannot rest, and at a fire instead of sleeping | as delivered, `restWindow.js` three-way merged |
| 4 | ENDLESS PROVISIONS - a Campfire Kit and 99 Rations at every General Store and Pawn Shop, every tier; the Off meal; a camp every tier's | PORTED onto ENDLESS-STOCK and REST2 |

## How each file was taken

Each delivered source file was compared with the main commit it was built on (the closest of its file's history).
Where that base was main's current file, it was copied as delivered: `render/airPass.js`, `render/shadowPass.js`,
`ui/enhanced/enhancedRest.js`, `systems/quest/place.js`, the new `systems/quest/questReach.js`, and the delivered tests. Where
main had moved since, the change was three-way merged against its base: `systems/features.js` (base 7d3ebfdb1) and
`ui/restWindow.js` (966e8041e), both clean. `test/systems/features.test.js` was delivered on a base before IT1's Immersive Travel
row, so it is main's file with the handoff's two changes (the `nearby-quests` id, the ceiling raised by its row's 289
characters - 15945); `ft18_features` and `ft8_combatvisuals` count the new row (73, 31). Every line a copied file
removed from main was read: each is the delivered change itself (the old self-silhouette, the old hours box, the old
region-wide draw).

Endless Provisions was built on 2026-10-01 to -03 files, up to 105 commits behind main (`scenes/worldModes.js`), and
its patch did not apply; it was ported by hand, keeping what main had decided since:

- **The restock is main's ENDLESS-STOCK** (`shopStock.js restockEndless`, called by both purchases), not the handoff's
  refill on every read of the shelf (`keepEndlessStocked`) - a row taken from a closed shop is stolen and stays gone.
  Rations join its rows (`isEndlessStock`): a stack bought whole or in part is filled back to `ENDLESS_RATIONS_STACK`
  (99), or stood again.
- **Online alone**, the owner's call (2026-10-04, asked: "Online only"): ENDLESS-STOCK F4 kept - offline the kit and
  the rations sell out until the day's restock, as the rest of the shelf does. Online no shop buys either back (F1/F2).
- **The shelf**: `survival/items.js ensureEndlessProvisions`, on a General Store's and a Pawn Shop's counter shelf
  (`shelfIndex 0`, AUDIT REST II H8's container law) in every tier, after DFU's draws and before the healing supply,
  from no roll - one fresh kit (a worn one sold back is a used kit) and the rations stack topped to 99.
  `provisionsStock` is unchanged (its draws stay each shelf's own); the handoff's removal of its kits and rations was not
  taken.
- **The Off meal** (`survival/items.js eatFood`'s `offMeal`, through `useSurvivalItem`; `useItem.js` hands it when
  `survivalRules()` is null): eaten whatever the hunger, a putrid one refused, never sickening, stamina back by
  satiety / `OFF_MEAL_FULL_MINUTES` (960) of the pool. A dish was already eaten Off (`cookItems.js dishUse`).
- **A camp is every tier's** (`scenes/camps.js`): `seen` is every camp; the placing's arc gate is gone (a kit, a tent
  or an Ember Jar stands offline with the arc Off); the plate's rows and the click's menu are every tier's; a camp's
  rest tends its fire in every tier. What stays the arc's offline is the warmth - `shown` (byFire) and a world
  hearth's rows - as the handoff kept it. SURV-OFFSIGHT's "Off sees, never uses" is superseded.

## The pins and the records it moved

- The handoff's own rewrites of `auditsurv`, `survtiers` and `survtiers3` applied cleanly; their name plates now carry
  REST2's rows (Rest, Cook; a tent of one's own Packs; one's own fire its fuel).
- `rest2_campfire` (offline with the arc Off a Campfire stands), `shopstock` (the General Store's counter shelf gains
  541 and 531 before the healing supply), `surv2_items` (useItem's line hands `offMeal`) - each marked PIN MOVED.
- Mutation records re-aimed at the moved code: `auditrest3` H12, `disc29` E (the new self-lamp rank), four
  `fb1004_endless` records (`isEndlessStock` with Rations), `surv2`'s ladder; SURV-OFFSIGHT's and SURV-TIERS' Off-camp
  records turned round to mutate the superseded law back in (`ENDLESS-off-sees-no-camp`,
  `ENDLESS-off-sees-only-others-the-superseded-offsight`, `ENDLESS-off-sees-only-its-own`,
  `ENDLESS-off-refuses-a-camp-again`, `ENDLESS-off-opens-no-menu-again`, `ENDLESS-off-tends-no-fire-again`).
  `SURVTIERS-off-eats-at-hard` is recorded equivalent: the Off meal never reads the tier's rules.

Pins: `test/render/steady_balance.test.js` (4), `test/systems/quest/nearby_quests.test.js` (6), `test/systems/rest/loiter_anywhere.test.js` (8),
`test/systems/endless_provisions.test.js` (5); the delivered changes to `features`, `sc1_shadowcache` and
`el1_enhancedlighting`.
