# FIELD BUGS 2026-10-18f - seven threads from the bug-reports channel, handed over as the day's second (numbered 18f past main's 18b to 18e at the merge)

Seven more threads from the Discord's #bug-reports, handed over as screenshots after FIELD BUGS 2026-10-18 merged (pull
request #1012), under the same order: "No band aid fixes". Read on main at `138604baa` (#1012's merge). Each thread was
traced by a lane of its own on the real modules; a fix lands only where the cause is proven, and where it is not, the
record says so and what would prove it. The pins are `fb1018f_*`, the mutants `tools/mutants/fb1018f_*.json`.

AUDIT FB1018f (`01-Overview/audits/Audit-Field-Bugs-2026-10-18f.md`, Mac: "Audit everything first") read the whole
batch cold; each of its findings is written in below where it lands, marked with its id.

| | Report | What it was | Done |
|---|---|---|---|
| T1 | SuperDaddy, "Leaping effect on store bought magic items": "Says it enhances dragonish, but appears on things you can't equip like wands ... Same case with magic items for sale that have the suffix "Venom spitting" but cast levitation" | The two names are crossed: Leaping casts Levitate and Venom Spitting enhances Dragonish (the language skill), both classic's own MAGIC.DEF. The defect is the base: a power that works only worn was drawn onto a base no slot takes | fixed (HELD-BASE); Leaping's and Venom Spitting's powers kept, classic's |
| T2 | cmagoun, "Minor: Spellbook -- Clicking a spell returns you to the top of a spell list" (BioGud: "same with magic items salvaging") | The enhanced book drew every press from nothing, past the house's one repaint, and its list and page shared one scroll; the Chronicle the same. Every salvage window checked keeps its place | fixed (SPELL-SCROLL); the salvage case not reproduced |
| T3 | Jigglehimmer, "Night Mothers Embrace Legendary does not function": "Imprint: Sweet Mother's Kiss (of The Night Mother's Embrace) - +50% to foes under 25%" | It works on an ordinary foe and always did. On every body the relay runs (the Warden, an Elite Breach's foes, the Remnant, the serpent) the stand-in's placeholder health read as whole | fixed (RELAY-SHARE); where the player tried it is not known |
| T4 | Aspidichelon, "Usable items hotkeys do not function in dungeons": "1-9 works outside, but not in dungeons" | The hotbar takes the digits ahead of every window unless the HUD's last frame said paused; underground no frame says so while a window stands | fixed (DUNGEON-DIGITS) |
| T5 | Low_Poly_Gaming, "Weir Key Generated Elite Breach bugs": imps that won't die, a vampiric heal off them; a gate's keeper unseen while its AOE showed | The imps are a span's Harriers, which the relay refuses to be struck from a platform (by design); the screen showed the blow and healed off a stand-in nothing empties | fixed (TURNED-BLOW, VAMPIRIC-WARD); the unseen keeper not proven (UNSEEN-KEEPER) |
| T6 | æther, "Collection: Broken world objects": the sea north-east of Tlactrn Manor, Tunmont docks, a bush in a house wall at Penwall Derry, a rock in Ipsmoth | Two found in our own code; the sea's a mod's dead refusal; the docks not found | fixed (HOUSE-BUSH, ROCK-SMEAR, WOD-SEA-TEST - Mac: "Yes fix WOD"); the docks open |
| T7 | CC/Astro, "Smithing stuck at 50": "literally 1xp off of levelling up but everything I craft gives me 0xp" | The crafter's limit (Professions-Arc 3.2, Mac's decision): two crafts past Journeyman stop every other one XP short of 51. No word said it, and the station's XP line was another law than the service's credit | the limit said, the line the service's (CRAFT-LIMIT-SAID); a craft is not let go back |

## HELD-BASE: a held power is minted on a piece a slot takes (T1)

`src/systems/loot/loot.js` (createRegularMagicItem's redraw, magicItemBase, powersNeedWearing, MAGIC_BASE_DRAWS),
`src/systems/enchantments.js` (worksUnworn).

FOUND, on the real producer over DFU's table (`test/dfuMagicItems.mjs` through readMagicDef) and the real guild shelf.
- **The report's two names are crossed.** A store's magic item takes its name, group byte, rows and uses from ONE
  MAGIC.DEF record (`shopStock.js` stockGuildMagicItems -> `loot.js` createRegularMagicItem; the pawn shelves, loot and
  quests mint through the same call). Every regular row mints its own. "Leaping %it" is Cast When Used, spell 4,
  Levitate. "%it of Venom Spitting" is Enhances Skill, param 7, Dragonish (the language skill - not an autocorrect). Both
  are classic's: DFU's first dump of MAGIC.DEF (c4fa0b1, 2017: raw words with each record's stream position) decodes to
  today's table in every kind, param, group, uses and value; DFU's fixes were names. Venom Spitting's one word, 0x070A,
  is 1802, its record's own position (the only row of 59): a slot that reads as never authored - strong evidence, not
  proof.
- **The base.** ItemBuilder.CreateRegularMagicItem (ItemBuilder.cs:555-582) draws it off the group byte alone. Group 0
  holds the religious items and the Jewellery, group 1 the Jewellery, and no slot takes a religious item or the Wand
  (`equip.js` wearableItem). Enhances Skill, Cast When Held and Absorbs Spells are read on worn pieces alone, so Venom
  Spitting landed where it could never apply 9 draws in 56, and the ten group-1 held rows 1 in 40. Over 600 days of a
  quality-10 shelf, 52 of 4,200 pieces.

FIXED. A piece whose powers need wearing (`powersNeedWearing`: live rows, none answering the Used payload,
`enchantments.js` worksUnworn) has its base drawn again in DFU's order, as DFU draws again over an Arrow, up to
MAGIC_BASE_DRAWS (64), then armour. A wearable first draw is the draw it was, and a Used cast keeps any base (a Leaping
Wand, a Silent Holy Tome). An artifact, a quest's piece, a made Wand and a frozen record stay as they are, and so does
a piece already held: AUDIT FB1018f L1-1 took out the load's repair this fix first carried (a save's such piece moved to
the Amulet), because a held piece's print is its `templateIndex:material` (`server-account/src/judge.js` ledgerPrintOf)
and the realm ledger reads a print that moved as forged (`server-account/src/ledger.js` ledgerStep) - a law hold on
every character that held one. The mint alone is mended. A departure (`01-Overview/Port-Ledger.md` section A, HELD-BASE), kept (DECIDED, below). THE
FOUR HOSTS: none touched; every host mints through createRegularMagicItem.

DECIDED (Mac, 2026-10-19: "Stop with the decisions for me", of every call this batch and its audit left open):
- **The departure stands** as built, and HOUSE-BUSH's with it.
- **The realm ledger takes the one move a load's repair makes.** RARITY-WEAR's repair (a rolled Wand to the Amulet, in
  `save.js` repairItemLists) moved a print the same way: a Wand the service held through it - a guild vault's, a
  market's - came back on its old print, the taker's load moved it, and the next checkpoint read the honest piece as
  forged. `lootRarity.js:"export function rehomedPrint(was, now) {"` says whether a print moved as the repair moves it
  (the group's base no slot takes to its home, the material kept), and `ledger.js` ledgerStep takes it as the piece and
  reprints its row; every other print on a key is forged, as ever.
- **The pieces already held are not mended.** They keep their price, and sell; moving them on load needs the ledger to
  take a religious item's move too, deployed before any client makes it - the client and the service deploy side by
  side on a merge.
- **A mixed piece takes a wearable base**: a piece with a Used cast and a worn power is redrawn as a held power's is
  (`loot.js` powersNeedWearing: any row worn), losing neither half. No regular MAGIC.DEF row is mixed, so no draw moves.
- **Leaping's Levitate and Venom Spitting's Dragonish stay classic's** (4 -> 38 would be Jumping; no spell in SPELLS.STD
  spits venom): the report's two names were crossed, not wrong.

The item maker still lets a player put a held power
on a Wand, as DFU's does. The "Holy Tome of Venom Spitting" in a usable list (T4's screenshot) did not reproduce: the U
window lists only a Cast When Used piece. What would prove it: that window and the piece's "Item powers:" line or saved
`enchantments`.

Why no test saw it: `magicitems.test.js` pinned the group routing verbatim, and RARITY-WEAR's pins took "DFU's own
wands, Use a cast" on trust.

Pins: `test/systems/loot/fb1018f_heldbase.test.js` (8; two pin the ledger's word on a load). Mutants:
`tools/mutants/fb1018f_heldbase.json` (23, all dead).

## SPELL-SCROLL: a pick keeps the book's list where it was, and the list scrolls in its own column (T2)

`src/ui/enhanced/enhancedSpellbook.js` (drawn through the repaint; the page names its spell), `src/ui/enhanced/enhancedStyle.js`
(the book's two columns), `src/ui/domRepaint.js` (`data-scroll-key`), `src/ui/enhanced/enhancedChronicle.js` (the same).

FOUND. Reproduced in Chromium on the real modules and sheets (`tools/spellScrollProbe.mjs`): forty Spell Maker spells, the
list at 600 px, a mouse click on Spell 15 - the list at 0, Spell 01 lit under the pointer. Two defects together:
- **The book wrote its repaint straight.** Every press drew the window from nothing (`host.innerHTML = ''`), past
  `ui/domRepaint.js`, the house's one repaint ("A REPAINT MUST NOT MOVE THE PAGE UNDER THE PLAYER"), so every pane stood
  at its top.
- **The list and the spell's page were one scroll.** The journal grows with its rows (`.px-journal`'s min-height: 100%),
  so the window's body scrolled; kept by the repaint alone (measured) the list stays at 600 and the picked spell's page
  and Ready stand out of view, desktop and phone (on a phone the page stood 1,991 px down, under every row).
DFU's book never moves on a pick: ListBox.MouseClick (ListBox.cs:465-504) only selects, and UpdateSelection
(DaggerfallSpellBookWindow.cs:507-512) reads the list's own ScrollIndex. The classic book keeps that
(`spellbookWindow.js:"this.selectedIndex = index;          // MouseClick"`); the fault was the enhanced skin's.

FIXED. The book draws through the repaint (`enhancedSpellbook.js:"if (host) repaintKeepingScroll(host, paint);"`); the
list and the page scroll each in their own column (`.sb-shell .px-body` holds them and scrolls neither - the grimoire
dress's book, worn plain); and a pane names what it shows (`domRepaint.js:"const key = n.getAttribute?.('data-scroll-key');"`),
so another spell's page starts at its top while the list keeps its place. AUDIT FB1018f L2-2: the page is named by its
spell (its `index`, the port's name for a spell, the quickslot's and the hotbar's), not its row - a delete kept the row,
and the spell after a deleted one opened at the deleted one's offset; a rename keeps the page. L2-1: a key also names
the panes inside its pane (the grimoire dress's Chronicle scrolls its `.px-qdetail` inside the keyed `.px-body`).
L2-4: the repaint finds a saved pane by walking down its own path, never by mapping the rebuilt tree - one fold in a
Chronicle of 500 notes, scrolled, cost ~400 ms in Chromium (1,000 notes ~1.4 s), now 69 ms (121 ms), the unscrolled
press's own cost.

THE SIBLINGS. The Chronicle (the same bones) lost its page on every fold, remove, share, abandon and run-out deadline
(measured 900 -> 0); drawn the same way, its page named by its section
(`enhancedChronicle.js:"body.setAttribute('data-scroll-key', section);"`). BioGud's "same with magic items salvaging" is NOT
REPRODUCED: the Reforge's Salvage page keeps one scroller and replaces only its rows (measured 900 -> 900 through Salvage
and Break it), the pack's Salvage repaints through domRepaint with PX22's memo (measured holding), the Stores page's
Disenchant draws in the pause window (domRepaint). What would find it: which window (its title, a screenshot), the skin
and dress, phone or desktop.

THE FOUR HOSTS: none touched - both windows are one door's (`spellbookDoor.js`, `chronicleDoor.js`) for all four.

Found and left: the arrow keys move the pick past the list's visible rows without bringing it into view (DFU's
SelectNext nudges a row, ListBox.cs:709-741); before this the same keys threw the list to the top. The pause window's
journal pages share one scroll for rail and page, the book's old shape, for a long rail.

Why no test saw it: nothing mounted the book, scrolled its list and pressed a row, and domRepaint's behaviour was held
"not pinnable here" - but the suite's DOM keeps a node's scrollTop and starts a new node at 0, which is all it needs (the
mutation of domRepaint that records nothing, a survivor only `tools/enhancedScrollProbe.mjs` killed, now dies in the suite).

Pins: `test/ui/enhanced/fb1018f_spellscroll.test.js` (8; AUDIT FB1018f L2-3: the book's column rules are the only word on
them in every sheet). Mutants: `tools/mutants/fb1018f_spellscroll.json` (22, all dead).
Four tests that build their own node stand-ins gained `querySelectorAll: () => []` (journal1, questreset1, questshelfmain,
discord5), no assertion changed.

## RELAY-SHARE: Sweet Mother's Kiss reads the relay's word of a boss's health (T3)

`src/combat/healthShare.js` (new: healthShare, wordShare - the one share law), `src/world/gate/gateBoss.js` (the three
stand-ins take their owner's reader), `src/scenes/gate/gateCourt.js`, `src/scenes/gate/gateHost.js`,
`src/scenes/eliteGates/egFight.js`, `src/scenes/superDungeon/sdRemnant.js`, `src/scenes/serpentHost.js`,
`src/scenes/world.js` (the serpent's stand-in: one line changed, none added). The six readers: `lootPowers.js`,
`weaponMastery.js`, `martialPowers.js`, `arcanePowers.js`, `sigil/sigilSetPowers.js`, and (AUDIT FB1018f L3-5)
`combat/technique/techniqueBlow.js` - Headsman's Chop kept its own share and read the placeholder (a lord at a fifth
got x1.20 for x2.00).

FOUND, on a body the relay runs. On every other foe the power works and always did.
- **What the power is.** The Night Mother's Embrace (a Cuirass) carries Sweet Mother's Kiss: `kind: 'execute', below:
  25, pct: 50`, "Your weapon blows deal +50% damage to a foe under a quarter of its health"; a Rare takes it at the
  Reforge (`lootCodex.js` imprintPiece). It rides every weapon blow of mine, worn in any slot, never a spell, never a
  player (it sleeps in a duel and a refereed bout).
- **The law** (`lootPowers.js:"      case 'execute': if (share(target) < p.below / 100) pct += p.pct; break;"`): the share
  is the struck entity's health of its whole. An orc from makeEnemyEntity takes 8 whole and 12 under a fifth, before and
  after. But every body the relay runs is struck against a stand-in whose health is a placeholder nothing empties
  (`gateBoss.js:"e.maxHealth = e.health = STAND_IN_WHOLE;"`), and the share read it as whole: the Warden at 200 of 1000 took 8.
  Every screen holds the relay's word of the real health - the boss bar draws it - and nothing handed it to the
  stand-in. So the power never fired on the Warden, his crystals or host, the Remnant, its Echoes or Hearts, the
  serpent, or any foe of an Elite Breach.
- **The family.** Serpent's Kiss's double under half had the same defect, and so did four readers outside the loot: the
  masteries' halves, Gutting Lunge, Blood Boil and Run Them Down (AUDIT MARTIAL had KEPT Gutting Lunge's as "its share
  unread" - it was never unreadable, only never handed over). The Firmament keystone of the same name reads no health.

FIXED. `healthShare` answers an entity's own share, and for a stand-in its owner's reader of the relay's word, clamped,
or null where none is heard (a body unheard reads whole, as before). The six readers read it and keep no copy (swept).
Every owner hands its stand-ins the word: the court (his `hp` of `max`, at the blow; each crystal its Reckoning's
share), his host, an Elite Breach (each body's `hp` of `max`, refilled each frame; a struck object the share it is drawn
at), the Remnant, its Echoes and Hearts, and the serpent. RECORDED: Blood Boil's second burn has no record to land on at
a stand-in, and the arena's PvP rival has no reader (the powers sleep in a bout). Online, the relay takes the client's
number under the fight's own caps; the account service rolls no blow. Where Jigglehimmer tried it is not known: on an
ordinary foe this was not the cause, and they would settle it.

THE FOUR HOSTS: `world.js` (the serpent's line, none added). `dungeonContext.js`, where the other relay bodies are
struck, hands the formula the owner's target, which now carries its reader. `worldModes.js` and `exterior.js` stand no
relay body.

Pins: `test/systems/loot/fb1018f_relayshare.test.js` (9; AUDIT FB1018f: the Chop, a struck object's word read as it
falls, the serpent's word the fight I stand in - L3-9 - and standing nowhere turns every blow, L6-7; the breach fixture's
bodies stand on the fight ground under them, as the relay stands them - L3-6 turned the ones it had left at y 0 under an
18 m disc). Mutants: `tools/mutants/fb1018f_relayshare.json` (35, all dead); three older records whose anchors moved were re-aimed by content (`audit_martial.json` L3F2, `audit_wb11.json`
W1, `set3.json`'s half line).

## DUNGEON-DIGITS: a dungeon window gets its digits (T4)

`src/ui/enhanced/enhancedHud.js` (hideEnhancedHud), `src/ui/hud/hud.js` (hideHudTextSurfaces).

FOUND. Reproduced in Node on the real modules (the real drawHud and enhanced HUD over a page, the hotbar's own listener,
the use-magic-item window in the dungeon's slot, `routeKey`, `useQuickslot`): under the window underground, Digit1 was
stopped by the hotbar, the list never heard it, and the bar's slot 1 (a Potion of Healing) was drunk behind the paused
game.
- **The list was never it.** `listPicker.js:"if (d) this._pick(this.scrollIndex + Number(d[1]) - 1);"` in every host, and
  a native window is handed the raw code (`input.js:"if (ctx.overlayIsNative) { ctx.overlayInput(e.code, e); return true; }"`).
- **The bar takes the digits first.** The hotbar (the default quickbar since HB-LYCFREE) listens on the window's
  capture phase, ahead of every host's ladder, takes a key whose action is one of its ten slots and stops it
  (`enhancedHotbar.js:"function onKey(e) {"`). It stands down only while the HUD's last frame said the game is paused
  (`hud.js:"paused: !!cursorActive,"`).
- **Underground no frame said so.** Both dungeon hosts return above `drawFoes` while a window pauses the game
  (`worldModes.js:"if (dungeonCtx.uiOverlayActive) { dungeonCtx.hideHudText?.();"`, `dungeon.js:"ctx.hideHudText?.(); hideWorldPlaque(); ctx.tickOverlay(dt); ctx.drawOverlay(canvas);"`),
  and `drawFoes` is their only drawHud. For the life of a window the bar kept the last frame of play's word; the
  enhanced HUD also stayed painted under every dungeon window.

FIXED. The hide door both branches already call (`dungeonContext.js:"hideHudText: () => hideHudTextSurfaces(hudText),"`)
now tells the enhanced HUD what drawHud tells it under a window (`enhancedHud.js:"export function hideEnhancedHud() {"`),
so the HUD and its bar hide and the keys belong to the window; the next frame of play gives them back. The pad's
crossbar already stood down under every dungeon window (`gamepadInput.js:"    const xbOn = !overlay && crossbarInForce();"`,
the dungeon's `overlayActive`); the bar's own gate now agrees with it (AUDIT FB1018f L2-7). THE FOUR HOSTS: `world.js`, `exterior.js` and worldModes' building arm draw the HUD every frame with the
game's pause; the dungeon arm's window branch already calls the door (no line added); `dungeon.js` mounts the same
context. Our own feature: DFU does not Update its HUD under a window (DaggerfallUI.cs:429-433).

AUDIT FB1018f L2-5, L2-6: the two this section first left are fixed. The bar asked the HUD's last frame, so a digit
between a key that opens a window and the next frame was the bar's (reproduced: the use-magic-item list put in the
dungeon's slot, then Digit1 - slot 1's potion drunk, the list never heard it); and a window in the street's slot over
?world's dungeon arm (Recall's prompt), which no dungeon frame sees, left the bar its digits while the pad's crossbar
stood down. Now the bar's keys, its mouse slot and the crossbar ask the host's own pause at the press - the hooks object
every host hands the finger and the pad (`input.js:"export function hostPaused() {"`, noted by `attachTouch` and
`attachGamepad`), the HUD's last frame only where no host handed one; keyboard and pad agree. Under the dungeon's
status readout, which pauses nothing, the keys are the player's, as STATUS-LIVE has them in the street. Left: the
enhanced HUD itself still paints under a street-slot window over ?world's dungeon arm (drawFoes knows only the
dungeon's own slot; the door it would need adds a host line).

Why no test saw it: the bar's pins drove `drawEnhancedHotbar` with a `paused` they chose, and the hide door's asked
about the text surfaces alone.

Pins: `test/ui/hud/fb1018f_dungeondigits.test.js` (5), `test/ui/plus/fb1004e_padarrange.test.js`'s one pause (AUDIT
FB1018f L2-5/L2-6); `test/systems/auditcontrib.test.js`'s source pin reads the new gate. Mutants:
`tools/mutants/fb1018f_dungeondigits.json` (19, all dead).

## TURNED-BLOW: a blow the relay refuses is refused on the screen too (T5)

`src/net/eliteGates/egBodies.js` (egStruckOff, EG_TURNS_FL, egLordAsleep, egStrikeTurned), `src/net/eliteGates/egBrain.js`,
`src/scenes/eliteGates/egFight.js` (turnStandIn, hostHit), `src/scenes/dungeonContext.js`, `src/ui/hitNumbers.js`.

FOUND. The imps are the legion's Harriers (`egLegion.js:"Object.freeze({ id: 0, key: 'harrier'"`), which on a span follow
the company along its platforms. They are meant to die (3 s of the company's mean reference damage, 135 health at level
30 in circle 1), and did not because the relay refuses every blow struck from traversal ground (EG-ZB, section 11.7) -
and a span's platforms are traversal ground. Reproduced on the real relay: ten 40-point blows from a platform landed
nothing; from an island four killed one. The refusal is the design; the screen was the defect. It offered the Harrier,
bled it, flashed it, popped a number and sent the blow, which resolves against a stand-in nothing can empty
(`gateBoss.js:"e.maxHealth = e.health = STAND_IN_WHOLE;"`), so every heal of a landed blow answered the claim: 20 blows of a
Vampiric Effect blade with a 10% leech line healed 264 for 240 claimed, the relay landing 0. The same hole stood
wherever the relay lands nothing: a Vengeful Shade (warded from its rise), a held Ward-Bearer, a lord's ward, and a
Court lord asleep in its ring.

FIXED. One law: the relay's strike rule is `egBodies.js:"export function egStruckOff(view, b, x, y, z) {"`, called by
`egBrain.js:"if (egStruckOff(view, body, p.x, p.y, p.z)) return land(0);"`, and the screen asks the same rule plus the
flags the relay takes nothing through and a lord asleep (`egBodies.js:"export function egStrikeTurned(view, b, x, y, z, now = 0, spec = null) {"`).
Each frame `egFight.js:"function turnStandIn(t, b) {"` marks a target's stand-in `warded` when the relay would refuse a
blow from my feet; every heal and power already refuses a warded target, and Vampiric Effect now does too
(VAMPIRIC-WARD). Nothing is sent, nothing bleeds, the swing and the shaft ring off as off the Warden's ward, and the hit
number says "No footing" or "Warded". THE FOUR HOSTS: `dungeonContext.js` (the one door a blow on a Spire body leaves
through); `world.js`, `exterior.js` and `worldModes.js` unchanged.

AUDIT FB1018f L3 found the screen and the relay still apart, and closed each:
- **A woken lord** (L3-1): the screen held a Court lord asleep until the fight's next whole word, up to 2 s after its
  wake, and turned every blow the relay landed meanwhile. The wake now says its first phase in the beat that wakes it
  (`eph`, `egLords.js` egLordsWake), which the link takes as a wake, no phase turn.
- **The storey** (L3-6): the relay lands nothing on a body a storey over or under me (`egOneStorey`), and the screen did
  not ask - a Harrier on an island 14 m up was offered, and a leech healed the claim. One law now,
  `egBodies.js:"export function egStoreyApart(view, x, y, z, bx, by, bz, melee = true) {"`, which egHitBody and
  `egBodies.js:"export function egStrikeTurned(view, b, x, y, z, now = 0, spec = null) {"` both call, the screen judging the body
  where its walk has carried it.
- **Merged with FB1018D BANNER-SHAFT**: the storey law is one (a swing refused by the storey alone, a shaft or a spell only
  through a floor), and the screen asks the shaft's rule - no swing reaches a body a storey away. Found at that merge: from
  off the hall's own fight floor (a span's island or plate) the relay lands a blow only within reach, and the screen never
  asked - a shaft at a Harrier on another island was offered and leeched; one law now, `egBodies.js` egOutOfReach, which
  egHitBody and egStrikeTurned both call.
- **An object's radius** (L3-4): the screen judged a struck object at 1 m; the relay's are their own (a spark 0.6, a
  rift 1.3, the Wellspring's spring - a rift - 2.2). Each body's radius now rides beside its row (`ead` and `efs` `r`,
  egRadiusWire; wire.js egRadii), outside the row, so a build before it drops the field and keeps the word.
- **What still answered a turned blow** (L3-2, L3-3): a spell (arcanePowers.js pathLanded: Siphon Life healed 380 of ten
  casts on a turned Harrier, Conflux stacked), Cast When Strikes, and the sets' strike (Battlemage's Panoply returned
  200 magicka, Coilscale built its coil). Each refuses a warded target now, and the spell doors pop their number by the
  body met. **Every door says its word** (L3-7): a turned shaft rang silently; it says "No footing" or "Warded" too, and
  so does a shaft into the Warden's ward.
- **Pose lag** (L3-8, RECORDED): the screen judges this frame's feet, the relay the socket's last pose (up to a tenth of a
  second old, POSE_HZ 10, and the transit) - at a platform's edge, for about 100 ms, the two can differ. The 1.5 m pad
  narrows it; only the relay's word of each blow would close it.
The relay is at `world219` (`test/net/relayversion.test.js`): TURNED-BLOW's rule and these moved its bundle. Either end
may deploy first.

Found and left (AUDIT FB1018f L6-8): `tools/mutants/egz_legion.json`'s EGZ-the-divers-dont-wait survives, on main's
2c98d9554a too - the span AI these imps belong to, older than this slice.

RECORDED, not fixed: the heal is still the claim's wherever the relay lands only part of a blow (the purse clips it, a
Shield-Wall or Shielded front turns it, a flier is out of reach) - closing that needs the relay to tell each striker
what landed, per blow.

Pins: `test/net/eliteGates/fb1018f_turnedblow.test.js` (9). Mutants: `tools/mutants/fb1018f_turnedblow.json` (44, all
dead). Moved with the strike rule: two records in `tools/mutants/egz_legion.json`, one in `tools/mutants/wb13d.json`,
and one call site in `test/net/eliteGates/law9_height.test.js`.

## VAMPIRIC-WARD: Vampiric Effect heals what a blow deals (T5)

`src/systems/enchantments.js`. FOUND: Vampiric Effect was the only heal of a landed blow that ignored the ward - it
healed the whole claim of blows into the Warden's ward and into the Brass Remnant while shut; Gortwog's Cleaver, as the
loot maker mints it, healed every point of 20 blows into the Warden's ward. FIXED
(`enchantments.js:"if (param !== 1 || target?.warded) return null;"`): VampiricEffect.cs's own law told what the blow
dealt, not a departure. AUDIT FB1018f L1: the Mace of Molag Bal's drain had the same hole and gives nothing off a ward
or a blow of none (`artifactEffects.js:"if (!entity || !target || damage === 0 || target.warded) return null;"`). AUDIT FB1018f L3-2,
L3-3: a spell into a ward, Cast When Strikes and the sets' strike refuse it too (TURNED-BLOW). Pins:
`test/systems/fb1018f_vampiricward.test.js` (6). Mutants: `tools/mutants/fb1018f_vampiricward.json` (6, all dead).

## UNSEEN-KEEPER: the gate keeper drawn nowhere - not proven (T5)

NOT PROVEN. The real relay's fights, run through the real link into the real fight driver over a stub renderer, draw
every keeper a door waits on once its art lands - a Proving Walk's champion and escort, a Court lord, a Rampart's
Ward-Bearers - at its place, on its floor, at a size, in its own art, offered as a target (pinned). Ruled out: a stuck
vanish (a hidden lord throws no blow, and the full state every 2 s resets the flags), culling, a Morrowind body, missing
art (all 96 looks have it). What can hide one body while its attack markers (their own pass) still draw: its art never
loaded - the driver keeps a failed texture for the session, every body of that mobile stands undrawn and untargetable,
and nothing said so; it now logs once (`egFight.js:"const failed = (why) =>"`), behaviour unchanged - or an animation
frame never uploaded (a texture pack missing a record). What would prove it, from the player: could they hit it; did a
companion see it; the console then; their texture or sprite mods; the hall, the foe's card, a screenshot with the AOE.
Pins: `test/scenes/eliteGates/fb1018f_unseenkeeper.test.js` (2). Mutants: `tools/mutants/fb1018f_unseenkeeper.json` (2,
all dead).

## HOUSE-BUSH: a bush its author left under a house is not stood (T6)

`src/world/rmbFlats.js` (sceneryUnderRoof, collectBlockFlats' scenery walk).

FOUND. All four of æther's places are rebuilt by the town mods online forces on: Penwall Derry is Beautiful Cities'
`location-23-591`, Tunmont `location-23-850`, Ipsmoth Beautiful Villages' `location-36-183`, Tlactrn Manor
`location-44-27`. Penwall Derry's east gate is the composite WALLAA09.TVRNAS01 (the city wall on its west side, a tavern
block outside the gate). Its ground scenery is written whole, and cell (row 4, column 15), record 4, stands where all
four automap cells round its foot are a House2's footprint. DFU's `RMBLayout.AddNatureFlats` reads no building, so DFU
stands the bush there too, and the port did, verbatim. Across the blocks the two packs carry whole there are 18 such
cells (10 in Cities, 8 in Villages). The author removed the same class by hand elsewhere: TVRNAL01's edit sets cells
165 and 214 to -1, both on a House2 - data evidence, read off the pack, which passes on either code.

FIXED, a departure (`01-Overview/Port-Ledger.md` section A, HOUSE-BUSH): a scenery cell whose four automap cells are all
buildings by the town map's own ladder (`townQuarters.js` quarterOf), in a footprint a building of the block stands on
(heldFootprints: a subrecord's origin, automap column xPos / 64 and row zPos / 64, falls in it), is not stood; a cell on
a footprint's edge or corner, or on the block's rim, stands as authored. AUDIT FB1018f L4-1: the automap alone took 26,
and 8 of them were Beautiful Villages' TEMPBSE0 and TEMPBSC0, whose automaps draw houses the blocks do not have - their
authors planted that open ground; the first sweep built its blocks with no subrecords, so it could not see one (L4-2). Classic blocks fall under the same law; how many of BLOCKS.BSA's
cells it takes was not measured (no ARENA2 here). THE FOUR HOSTS: `world.js` and `exterior.js` get it through
collectBlockFlats; `worldModes.js` and `dungeonContext.js` lay out no town block.

Pins: `test/world/fb1018f_housebush.test.js` (5). Mutants: `tools/mutants/fb1018f_housebush.json` (16: 14 dead, 2 equivalent as recorded - AUDIT FB1018f L4-7).

## ROCK-SMEAR: the pack's rocks drawn outside in, their texture box-mapped (T6)

`src/world/townStandIns.js` (boulderMesh, boulderUv, prismZ).

FOUND. Ipsmoth's four blocks stand 16 RMB Resource Pack rocks, nine of them on water tiles (the stream along its west
side and RESIAS06's pond), each our own stand-in boulder. Its `face` took whatever normal the corners' order gave, and
40 of its 48 faces looked into the rock; MeshBuilder winds a face to look along its normal and the world pass culls back
faces, so each rock drew as the inside of its far half - a hollow grey "arch" with whatever stood behind it (the pole)
seen through it. TEMPLE-STEPS had just scaled the rocks to their prefab's 2-8x, so these were shells up to 9 m across.
Their texture used one side-view plan for every face: 25 to 75 per cent of each rock's surface stretched past four to
one, "the flat grey smear".

FIXED. Every face looks out of the boulder and is box-mapped (no face stretches past 1 : 1/√3, the rows level on the
sides). Found beside it: prismZ took its corners as counter-clockwise on trust, and both its callers hand it clockwise
lists, so the dock ramp (53143) and the steps' stringers (53144) were drawn inside out too; prismZ now winds by the
corners' own area. AUDIT FB1018f L4-6: the pack's rocks stand near their origins and its prisms wind one way, so a
boulder off its origin and a prism in each winding and quadrant are pinned too. Ipsmoth's count (16 rocks, nine wet) is
data evidence, read off the pack. The collider reads no winding. THE FOUR HOSTS: as HOUSE-BUSH's. `03-World/Beautiful-Towns.md`'s two
stand-in rows corrected.

Pins: `test/world/fb1018f_rocksmear.test.js` (5). Mutants: `tools/mutants/fb1018f_rocksmear.json` (13: 10 dead, 3 equivalent as recorded).

## CRAFT-LIMIT-SAID: the crafter's limit said where it acts, and a station's XP the service's own (T7)

`src/net/professionLaw.js` (craftLimit, craftLimitOf, creditedXp), `src/net/profBook.js` (limit), `src/ui/craftXpWords.js`
(paidXp, capLine, limitRuleLine), `src/ui/professions/profPages.js` (craftPayOf, every station's XP line, the tab),
`src/scenes/world.js` (one line edited, none added), `locales/*`.

FOUND. Reproduced in Node on the real Worker, book and Stores page: Smithing at 26,009 behind Building 60 and
Provisioning 55, the anvil's Silver Dagger box read word for word as the screenshot, and the Worker answered `xp: 0,
first: true`.
- **The crafter's limit** (`06-Systems/Professions-Arc.md` 3.2, DECIDED; Mac kept it at CAP-OFF): two crafts past
  Journeyman, every other stopped at `professionLaw.js:"return past >= CRAFTS_ABOVE_JOURNEYMAN ? xpForRank(JOURNEYMAN_RANK + 1) - 1 : PROF_XP_MAX;"` -
  one XP short of 51, the report's "1xp off". The service credits each act through its own INSERT,
  `professions.js:"MAX(0, MIN(?10 + f * p * ?13, ${cap} - COALESCE("` (the smelt's, temper's, brew's and disenchant's
  alike), so at that ceiling every act pays none, its first's 500 too. With Provisioning at 50 the same craft paid 60
  and 500. Nothing else pays a rank-50 craft none (the Firmament's XP floors at -30%). The player's other two crafts are
  not in the screenshot, but only the limit makes that exact figure.
- **The line was another law.** `craftXpLine` read `craftXp` alone - not the limit, not the Firmament's percent (FIRM1
  `scaleXp`), not a Master's full track. The tab read "26,009 / 26,010 XP" and never said what "2 of 2" does; the
  craft's word said "(+0 Smithing XP, with the first-time bonus)" where the limit ate the bonus.
- **Nothing unlocks it on that character**: no write lowers a track; only deleting the character removes one.

FIXED. The limit stands and is said; a station's figure is the Worker's credit, one law. Every station (anvil,
workbench, loom, jeweller's, mason's works and carvings, fire, alchemy, enchanting, temper) reads
`profPages.js:"export const craftPayOf = (book, id) =>"` and says "No Smithing XP: Building and Provisioning stand above
Journeyman, and the crafter's limit holds Smithing at rank 50." in place of a line the track cannot take ("At most 9
..." with a little room; "Smithing is at Master." at the top). The fire drops its pans' XP where none is paid; temper and
enchant rows say "+0". The craft's word says the limit, never a bonus the limit ate. The tab: "26,009 / 26,009 XP - the
crafter's limit holds it at rank 50", and "A character raises only 2 crafts past Journeyman: yours are Building and
Provisioning, so your other crafts stop at rank 50. No craft's rank is ever lowered." (before the second: "once 2 of
yours pass rank 50, the others stop there"). The six new strings in the thirteen whole languages and each glossary.
AUDIT FB1018f L5-1: the service's limit was not one decision. Each act bound `craftXpCap` of a track read several
awaits before its batch as a literal, so two acts at once on two tracks at 50, with one other craft past, each read one
past, each bound Master's ceiling, and both crossed - three past, and every one of the three then held at 26,009 for
good (reproduced at all five stations on the real Worker). Each decision and its track's write now count the other
crafts past Journeyman in their own statement (`professions.js:"export function craftCapSql(p, c, profession) {"`; a D1
batch is one transaction): the anvil, the forge's smelt and works, the temper, the brew and the disenchant. No wire or
account version moves. L5-2: for a character already there, a craft held past its ceiling is said at its own rank ("holds
Smithing at rank 60"), never at 50 (`craftLimit` answers the rank it holds). L5-3: a third craft below 50 reads its next
rank's figure ("1,005 / 1,210 XP"), the ceiling line only at the rank it is held at. L5-4: a Master's craft word is the
top's, "(+200 Smithing XP - Smithing is at Master)" (`prof.craft.xpTop`, in the thirteen whole languages) - it fell
through to "with the first-time bonus", and at 99,800 a first the top ate was said as paid. AUDIT FB1018f L6-6: five
languages named a craft "a made item" in the rule (bg, cs, it, ro, ru) and de "Arbeiten" in the count; each now the
house's word for a craft.

DECIDED (Mac, 2026-10-19: "Stop with the decisions for me"): a craft is not let go back to 50 - 3.2's limit stands, and the tab says it before a second craft
passes 50.

THE FOUR HOSTS: `world.js` wired (`world.js:"profBook.limit(rec?.profession)"`, the line edited, bootWorld at its
ceiling). `worldModes.js`, `exterior.js` and `dungeonContext.js` build no station or craft word. Left: the brew's,
temper's and disenchant's words ("(+0 ...)" - their stations say it first; they claim no bonus); the forge, which states
no figure. Our own feature: no DFU member moves.

AUDIT FB1018f L5-5: `tools/mutants/prof12.json`'s `PROF12-book-dis-unapplied` was misaimed, not a gap - its text ran on
into the reforge's, which `craft4.json` already holds; re-aimed at the disenchant, it dies on `prof12_client`.

Why no test saw it: the limit was pinned on the Worker and the lines on the page, never on one character; five tests
certified a Master's figures the Worker never pays.

Pins: `test/net/fb1018f_craftlimit.test.js` (13; AUDIT FB1018f L5-6 to L5-8: the Firmament's percent at the fire,
alchemy, enchanting, the works and the held lines; the "At most" rooms between an act's XP and its first's 500; the rows
in German and Russian). PIN MOVED: `fb1015f_firstcraft`, `craft1_chain`, `prof9_client`, `prof12_client`;
`craft3_five`'s two bind pins (L5-1). Mutants: `tools/mutants/fb1018f_craftlimit.json` (79, all dead); 20 older records
re-aimed by content, all dead.

## T6's other two: the sea off Tlactrn Manor - WOD-SEA-TEST fixed; Tunmont's docks - not found

**The sea north-east of Tlactrn Manor.** Beautiful Villages lays the manor out as 3x3 farm blocks; the blocks to its
north and east are FARMBA06 (two pack rocks and a hill - ROCK-SMEAR's inside-out stand-ins) and FARMBA13 (crop fields).
Found beside it (WOD-SEA-TEST): World of Daggerfall's sea refusal (`LocationLoader.cs` 117-121) reads `mapRegionIndex`,
which DFU's `GetMapPixelData` fills only on a pixel that holds a location - and such a pixel has left at step 1 - so the
refusal never fired, in DFU or here, and a WoD site stood on any sea pixel its lists name (Mac's "world of daggerfall
ocean rocks", 2026-10-02, whose fix let a ship meet them rightly and left them standing). Which of the two stood off
Tlactrn Manor is still not proven - the reporter's map pixel would say. The WoD half is closed for the low sea (a WOODS
height of 2 or less); a sea pixel at 3 to 5, which the port's water still reads as sea (its line is 5, the sea floor 3.4),
keeps its sites as the mod's own test does - not measured here (WOODS is ARENA2's). DECIDED (Mac, 2026-10-19: "Stop with the decisions for me"): the mod's line
is kept; no report shows a site there.

**WOD-SEA-TEST** (`src/world/worldOfDaggerfall/wodLocationLoader.js` pickState, `src/scenes/pixelBuild.js`; Mac, given the
choice: "Yes fix WOD"). FIXED, a departure (`01-Overview/Port-Ledger.md` section A): the arm asks the region the PIXEL
answers (`mapsFile.js` getRegionIndexAt - the sea's politic 64 is region 31, PlayerGPS's own reading), and the streaming
build hands the pick that region (`pixelBuild.js:"regionIndex: maps.getRegionIndexAt(px, py),"`) in place of
GetMapPixelData's mapRegionIndex, which nothing else read. So a pixel of the sea, or a low pixel of the four coastal
regions (3, 29, 28, 30), at a WOODS height of 2 or less, stands none of the mod's sites - and the mod ships only type-2
instances, the type the arm skips: every one of its 227,938 (rocks 209,436, shrines, camps, ruins, mountains and forts).
How many of them named a sea pixel was not counted: the WOODS and MAPS data are ARENA2's, not in the tree. Online every
client builds the same pick, so the room's world moves together with the release. The account service's camp claims
(`seatHolding.js` claimBounty, `seatInfluence.js` claimOrcCamp) take a WoD camp's site id and read only its form and
pixel (AUDIT FB1018f L4-4) - they list no site, so a camp the pick no longer stands is one no client clears, and a
modified client's claim is bounded as before. THE FOUR HOSTS: `world.js` through its streaming build (`pixelBuild.js`,
no bootWorld line); `exterior.js` stands only Privateer's Hold's camp, no pick; `worldModes.js` and `dungeonContext.js`
build no WoD site. `03-World/World-Of-Daggerfall.md` step 2 names the departure. Pins: `test/world/worldOfDaggerfall/fb1018f_wodsea.test.js` (3; one is data evidence and passes
on either code). PIN MOVED: `test/world/terrain/wod2_loader.test.js`'s sea-arm test ("the sea arm is dead code") and its
host wiring line; `tools/mutants/wod2.json`'s record that held the host to the location's region is re-aimed as the old
read; AUDIT FB1018f L4-3: `test/systems/flow2_fast_tests.test.js`'s sea tiles named the dead field, so the pixel walk's
sea arm was never compared with the scan's - they name the pixel's region now. Mutants:
`tools/mutants/fb1018f_wodsea.json` (8: 7 dead, 1 equivalent as recorded).

**Tunmont's docks.** Tunmont's grid has no dock blocks, so the railed pier is our own QUAYS jetty (`quayModel.js` railX).
The real planQuay and buildQuayModel on made shores of 12, 60 and 195 m face every closed part out, and the jetty and
ramp land as planned. What would find it: the reporter's position on it, the berth plans the quay pool's `standing()`
returns for Tunmont with `surfaceAt` read along the jetty, and a shot from the land end.
