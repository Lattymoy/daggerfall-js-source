# FIELD BUGS 2026-09-27 — the attribute rows on a phone, a newer backup that could not come back, and the drains

*Committed as "FIELD 2026-09-27c" (`08db3b3c`). Main took 27c (PR 403, the death screen and the rest) and then 27d
(PR 406, the curse's ghosts) for its own batches while this branch was open, so this page is named for what it holds.*

Relayed by Mac after the pre-merge audit merged (two Discord reports, and a balance ask):

1. michelle!!, *"unable to add attributes (mobile)"*: *"i'm having issues adding attributes on create a character. i
   can't see the different options. i've tried safari and firefox and switching to landscape."* Her screenshot: the
   Strength description, "What these buy you", "12 left to spend", Roll again, Back, and a red *"CRASH (2) / unknown
   error"* box - no attribute rows anywhere.
2. Masta_Fu, *"Save backup not working"*: *"When I installed to my MAC i was able to instantly recover my backup and
   start playing. When I switch to my pc no matter how many times I back up it will not recover on the PC side."*
3. Mac: *"I want to adjust fatigue drain and durability drain. Just needs some balancing. Currently things drain a
   little too fast."*

## CHARGEN-PHONE: the stats and review stages are one scrolling column on a phone (report 1)

Reproduced with the real wizard mounted in Chromium at her sizes (an iPhone's 390x664 with Safari's toolbar, 390x844,
844x390, 844x340, 932x430, 430x740, an iPad's 1180x820 and a 1280x720 desk).

- **The rows were built and had no room.** The wizard's phone block sets `.stagebody { grid-template-rows: 1fr auto }`
  so the race MAP keeps its height - but it applies to every two-part stage. On the stats stage the `1fr` row is the
  attribute LIST and the `auto` row the ~454px card under it ("What these buy you", Roll again), sized first: the list
  got 5px at 390x664, 81px at 430x740 and 0px in landscape, each part scrolling inside its own box on a page that
  cannot scroll. The Review stage the same (0px at 390x664). At 390x844 (DevTools' iPhone, no browser chrome) about
  two rows showed, which is why emulation never caught it.
- **The fix:** the stats and review stages are `stagebody stacked`, and on a phone a stacked body is ONE column that
  scrolls as one (`display: block; overflow-y: auto`, the parts `overflow: visible`); the points bar stays pinned at
  its top. The race and class stages keep the map's rows on a tall phone; where the screen is short (a phone on its
  side) they are one column too (`stagebody stacked-short`), and the review's header stops pinning there - both from
  the pre-merge audit (`Audit-PreMerge-0927b.md`), which found the map and the class list with 0-30px in landscape.
- **A second arm, found beside it:** the MENU turns every `.detail` into a closed bottom sheet under
  `(max-width: 860px), (pointer: coarse)` (AUDIT UI's "a thumb is not a screen width"), and the wizard undid that only
  under the width - so a touch screen wider than 860px (an iPhone Pro Max or an iPad on its side) had the stats card's
  Continue and the review's Begin pushed below the screen. The reset now answers the rule's own query.
- **The CRASH box was neither.** It did not break the paint (the wizard builds the whole screen before attaching it,
  and the box takes no taps), and the wizard threw nothing at any size. It said "unknown error" because an error
  event with NO error object - a cross-origin "Script error.", a worker's error bubbling to the page - had its own
  message thrown away (`crashText`; main.js's `|| e.message` could never fire). It says the event's message now, so
  the next such report names what failed.

Re-measured with the fix at all eight sizes and both stages: every attribute's stepper and the primary are reachable,
and a tap lands (77 to 78). Pinned by `test/chargenphone.test.js` (5); `tools/mutants/chargenphone.json` (17 dead);
measured again by `tools/chargenPhoneProbe.mjs` (`npm run chargenphone`, the pre-merge audit's).

## BACKUP-NEWER: a newer backup is named, and the Load pane can restore it (report 2)

Reproduced through the real account service (`test/cloudsaves.test.js` runs the Worker in-process).

- **Why the PC never recovered it.** A download was offered only for a backup with NO local slot of the same identity
  (character, save name) - the cloud-only grid. The Mac was a fresh install, so its backup was a tile with Download.
  The PC held an OLDER QuickSave of that character, so the backup matched the PC's slot, the slot's line read
  **"Backed up · 12 minutes ago"**, and its only upload button - *Back up again* - pushed the PC's older save over the
  Mac's newer one. Nothing ever compared the two (bible ACC2 D5 refused an automatic "take the newer" sync, rightly).
- **The fix** (`Accounts-And-Cloud-Saves-Arc.md` D5b): the line says **"Newer backup · 12 minutes ago"** when the
  backup is a different save of the slot (another game minute, SP1's identity) saved later. On the Load pane it offers
  **Restore backup**, which asks twice (*Replace with backup?*): the backup arrives by SP1's import law unchanged - its
  own number, never over a slot - and only then is the older local copy removed, through the store's own delete, and
  only when it is that slot at another game minute. A failed download removes nothing. *Back up again* asks twice
  there too (*Replace newer backup?*). Nothing is automatic.
- **Tell the player:** until this ships, do not press *Back up again* on the PC; if it was pressed after the Mac's
  backup, the cloud holds the PC's older save - back up from the Mac again first.

Pinned by `test/cloudsaves.test.js` (his round trip PC -> Mac -> PC through the real service, what a restore never
removes, the menu's wiring) and `test/savetile.test.js`; `tools/mutants/backupnewer.json` (16 dead).

## BALANCE1: exertion costs a quarter less, a blow wears gear 40% less (Mac's ask)

Measured before anything was changed:

- **Fatigue:** the port's losses are DFU's to the unit (PlayerEntity's 11 / 22 / 88 / 44 a minute, 11 a jump,
  WeaponManager's 11 a swing, the x64 units, one drain per minute-change). A full bar at STR/END 50 walks 48.5 real
  minutes and runs 6.1 - DFU's own numbers. What drains faster is the mods on by default: Roleplay Realism's overload
  (1-90 more a minute past 75% load), its gallop (the running rate on horseback) and its riding charge (165 a foe),
  survival's needs, and the deep's swim stroke.
- **Wear:** DFU's DamageEquipment is ported verbatim, but the default game wears through the combat overhaul (PCAAO,
  on by default and forced online): ~2.8x DFU's wear on a weapon per landed hit (and more swings land, ~4.8x per
  swing) and ~15x on armour, which monsters now wear too. An iron longsword lasted ~333 landed hits against DFU's ~946;
  a leather cuirass ~327 chest hits against ~4,800.

The change (a departure, Ledger A):

- `FATIGUE_DRAIN_SCALE = 0.75` (`systems/statMods.js`), applied where exertion is CHARGED, inside the truncation DFU
  gives its own multiplier: the minute's walk, climb, run and failed swim and a jump (`systems/worldTick.js`), a swing
  (`SWING_FATIGUE_COST`, 8, in every host), Roleplay Realism's overload (its fraction CARRIED on the entity, so a light
  overload's 1 a minute still costs 3 in 4) and Enhanced Riding's charge (165 -> 123; both from the pre-merge audit,
  `Audit-PreMerge-0927b.md`). A full bar now walks 66.7 real minutes and runs 8.1. NOT scaled: fatigue damage (spells, poisons, diseases), training's fixed cost, survival's needs (their own
  tier setting) and the swim stroke (a burst bought on purpose).
- `CONDITION_WEAR_SCALE = 0.6` (`systems/equip.js`, `blowWear`), on every blow's wear path: DFU's, the overhaul's
  weapon, armour and fist arms, Roleplay Realism's armour x5 and a duel's blade. DFU's amount on a blade is 0-2 a hit
  (the overhaul's 5-20), so the fraction is rolled, not rounded - the average is the scale's exactly, and a whole
  amount rolls nothing. The
  longsword now lasts ~555 landed hits, the cuirass ~545 chest hits. NOT scaled: an enchantment's charge, a torch's
  burn, survival's rust.
- DFU's constants and formulas stay verbatim and stay pinned where they were; the parity files run the wear scale at
  1 through a test seam (`_wearScaleForTests`), and `test/balance1.test.js` (5) pins the scales;
  `tools/mutants/balance1.json` (24 dead). Both are one constant each; a further turn is that constant and its own
  pins in `test/balance1.test.js` - every other pin reads the scale (the pre-merge audit made that true).
