# FIELD BUGS 2026-10-03 - the HUD in the pillarbox, a moved toast fading where it stands, DFU's arrow, one ink a page, no pack in a rock, the Bodyguard closed, the mods' sway and kick, the hall's gold said

The Discord's bug reports and a Patreon-chat question of 2026-10-02/03, handed over as screenshots: *"Retro mode aspect
ratio doesn't include weapon sprite, UI etc etc"* (Skibbster; with the note "a lot of elements dont account for the
black bars"), *"Moved UI elements spawn at original location before warping to new spot"* (SylviaB), *"Classic mode
missing classic cursor"* (Skibbster), *"GPU Memory Leaks over-time"* (Swololo), *"Bounty packs can spawn inside rocks"*
(Flylight), *"The Bodyguard quest bugged"* (AverageDoggo), *"Inertia setting is not working with the Weapon and Shield
widget mods"* (SlipperyPeasant: "I think the recoil module isnt working either") and, from the Patreon chat, a guild
that could not buy its hall ("is this a glitch, or r we not putting gold in right place"). Every fix below is pinned
by tests that fail on the record's own code (7305011de), the new pins mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Retro mode aspect ratio doesn't include weapon sprite, UI etc etc" | DFU lays its whole UI out in CustomScreenRect, the pillarbox (ViewportChanger.cs :138-140); the port pillarboxed the world alone (RETRO1's recorded departure) - the vitals in the left bar, the compass and the weapon flush with the screen's right edge, the docked bar the canvas's width | RETRO-UI |
| 2 | "it momentarily spawns in its original location and slides in from the side" | the notice stack is rebuilt for every burst and HUD-MOVE placed it only on its 250 ms sweep, so its first panel was drawn at the sheet's place and warped; and a moved stack still slid in from the screen's right edge | MOVED-NOTICE |
| 3 | "the cursor stays as the system default instead of using the classic cursor like in DFU" | DFU's arrow is its own default cursor (Assets/Resources/Cursor2.png); the port read a CURSOR.IMG the usual game data does not carry, only once the data was in, and wore it inline where every panel's own `cursor:` beat it | CLASSIC-CURSOR |
| 4 | "GPU memory leaks that do not lower down even after closing the tab ... Related to play length" | every map opened in a dungeon or a building built a WebGL2 context of its own (30-40 MB at 1080p), never deleted, never lost; and no context was let go as the page went | GL-LEAK |
| 5 | "Bounty packs can spawn inside rocks" | the open-ground stand put its anchor on the terrain's floor - under a World of Daggerfall rock the terrain is still there - and its members' ring and open-space test cannot see a rock from inside it | BOUNTY-ROCK |
| 6 | "Assassins killed, gold rewarded thanked for my help but quest remains uncompleted" | A0C01Y01 pays and never closes; its one `end quest` is the start-up block's `_timer_`, which TIMEFREE froze online as a deadline - and kept frozen through the success, as start-up clocks were | BODYGUARD-CLOSE |
| 7 | "the sprites dont sway back and forth when you look around" / "the recoil module isnt working either" | the mods' Inertia was handed the camera's radians where it reads DFU's look axes - a fourteenth of its sway; and PCAAO (on by default) rolled its own struck body part, so the Shield Widget's "Attack On Shield" Recoil was handed -1 on every blow | WIDGET-LOOK, WIDGET-RECOIL |
| 8 | "we have the cash ... put it all in guild bank ... took all out and put in in bank thinking it meant it had to be within the realm" | not a fault in the path - the treasury was the place, and only the gold realm characters put in pays; both refusals read "needs N gold put in by realm characters", "the realm" read as a place, and nothing showed how much of the treasury counted | HALL-GOLD |

## RETRO-UI (1)

`ui/uiScreen.js` (new): `uiCanvas`, `onUiScreen`, `toUiPoint`, `fromUiPoint`; `ui/hud/hud.js` drawHud; `combat/weapon/weaponRig.js`
(`cv`, `draw`, drawThunderlock's `_tlDrawn`); `player/mountRig.js`; `ui/hud/hudLarge.js` routeLargeHudClick,
trackLargeHudPointer; `ui/hud/hudActiveSpells.js` trackHudPointer; `ui/enhanced/enhancedHud.js` wearUiPillar;
`ui/enhanced/enhancedStyle.js`, `ui/revenant/revenantCard.js` (`--ui-pillar`). With retro mode's aspect correction on, DFU's 2D layer
lays out in CustomScreenRect (BaseScreenComponent.cs :1135-1137; FPSWeapon.cs :128-129; FPSSpellCasting.cs :88-89;
TransportManager.cs :290-291). The port's canvas 2D layer now lays out on a canvas of `retroScreenRect`'s size - the
world rect's own pillar (`retroPillarWidth`) - and draws through the renderer's screen offset (the overlay letterbox
seam, `setScreenOffset`) at its place: drawHud re-enters itself once with the UI canvas, the weapon rig's canvas getter
answers it (the classic sprite, the Weapon and Shield Widgets' screen rect, the casting hands, the climbing hands, the
torch hand, the Thunderlock) and its draw is bracketed, the mount rig the same. The client size stays the screen's (a
swing's gesture reads the screen). Clicks and hovers on the large HUD and the spell icons come back through
`toUiPoint`; the Thunderlock's muzzle is measured back on the real canvas (`fromUiPoint`), so the shot still leaves the
barrel (FIELD-GUN19). The docked bar is drawn the picture's width, and since the world rect reads the drawn bar
(`dockedLargeHudHeight`), the strip above it is DFU's too: 207 px at 1920x1080 in 4:3 (AUDIT RETRO1 A2, closed). The
enhanced skin: the HUD's root inset to the pillars as the held map's (DISC25-B), and the notices, the quest tracker, the
status line and the revenant's cards read `--ui-pillar`. `07-Rendering/Retro-Mode.md`'s departure and Port-Ledger's
RETRO1 row narrowed. All four hosts take it through the shared modules; no host changed.

**Said, not fixed.** The classic native windows (inventory, the character sheet, the pause menu...) keep their own
320x200 letterbox on the whole canvas - integer-scaled and centred, never DFU's free scale into CustomScreenRect - and
at 1920x1080 their box reaches 80 px into each bar; the video and the Morrowind arm's lane (AUDIT RETRO1 C2) keep the
canvas too - so with the arms and the Weapon Widget both on, the widget's Position and Scale for the arm are reckoned on
the picture's width while the arm is drawn over the canvas's. `test/systems/fb1003_retroui.test.js`; `test/systems/hudlarge.test.js` and `test/systems/thunderlock.test.js` read the new shapes.

## MOVED-NOTICE (2)

`ui/enhanced/enhancedNotice.js` buildStack; `ui/hud/hudPlacer.js` (new); `ui/hud/hudLayout.js` paint, its sheet. The stack is placed as
it is built - before its first panel's resting style is flushed - as revenantCard's `ensure()` places its own; through
a leaf seat (`placeHudPieces`, which hudLayout fills with its sweep) because the notice module is on the quest
herald's light path, which must not reach the quest machine through hudLayout's previews (`test/ui/quest/guide3_herald.test.js`
THE HUD STAYS LIGHT went red on a direct import). A piece the player MOVED wears `data-hm-moved`, and a moved notice
stack's panels - and a moved revenant stack's cards - take no transform: they fade in and out where they stand on the
sheets' own opacity transitions, which end inside the time the node stands (NOTICE_SLIDE_MS, REVENANT_SLIDE_MS). A
stack left where its sheet stands it still slides from its edge (ENH-NOTICE1, Mac's), and one only scaled is not
moved. `test/ui/enhanced/fb1003_movednotice.test.js`.

**Said, not fixed.** Under the Overworld the notice stack's base place moves (OW-NOTICES: over the block), so a saved
offset lands on a different base there; and a moved stack keeps its right edge (shrink-to-fit, `align-items:
flex-end`), so a wider notice grows leftward rather than about its centre.

## CLASSIC-CURSOR (3)

`ui/cursor.js` (rewritten); `public/art/dfu-cursor/Cursor2.png`, `vendor/dfu-cursor/`; `main.js`; `ui/gamepadInput.js`;
`ui/credits.js`; `test/tooling/doctrine.test.js`'s row. DFU reads no cursor out of ARENA2: SetCursor
(DaggerfallUnitySetupGameWizard.cs :743-771) takes a mod's "Cursor" replacement, else `Cursor.SetCursor(null, ...)` -
Unity's default, ProjectSettings' `defaultCursor` (guid 887ec86c..., hotspot 0,0): Assets/Resources/Cursor2.png, the
32x32 three-blue arrow of the report's picture. It is DFU-authored art (MIT), vendored byte for byte at the commit
vendor/dfu-icons pins, its listing the doctrine gate's authority. On the classic skin (GrimoireUI is the classic skin
under a pack, and ships no cursor) it is laid at boot - no data asked, so the front menu wears it - as a rule over
every element, `!important` as Plus's gauntlet is: the inline cursor on `<html>` lost to every panel's own `cursor:
pointer`. A text field keeps its caret, a canvas a controller hid the pointer on stays hidden; the scrollbar dress
(CURSOR-EDGE UI1) comes with it. The pad's arrow is the same art - DFU's `controllerCursorImage` (InputManager :40,
:569) is that texture - in place of a white SVG arrow of the port's own. CURSOR.IMG is no longer read.
`test/ui/fb1003_classiccursor.test.js`; `test/ui/fb1001_uiaudit.test.js` UI1/UI3 and `test/ui/enhanced/fb1001_cursoredge.test.js` read
the rule now.

## GL-LEAK (4)

`ui/ink/inkDungeonGL.js` dungeonInkFor, disposeDungeonInk, the ink's `dispose`, `program`; `ui/automap/automapSheet.js`;
`render/glRelease.js` (new); `main.js`; `ui/gate/gateVeil.js`; `ui/intro/introLandscape.js`. Measured in the source: the held map
builds a sheet per open, and each sheet built its own ink - `createDungeonInk`'s WebGL2 context, a paper-sized drawing
buffer with its depth and preserve copy and three paper-sized textures, 30-40 MB at 1080p and past 150 at 4K - on every
M in a dungeon or a building; nothing deleted it, nothing lost it, and its canvas, off the page, was freed only when a
collection came, which GPU memory pressure never asks for. Now the page keeps ONE ink and every sheet draws with it, its
rows keyed by the sheet (`setMesh`'s `owner`: two reveals that count the same are never taken for each other); a lost
one is built anew and the old let go; `dispose` deletes every object and loses the context; the shaders are deleted once
linked; a context whose programs would not link is lost before the null. And as the page goes (`pagehide`, not a page the
browser keeps for back-forward), every context is let go at once through `render/glRelease.js` - a leaf, so the entry's
reach is unchanged (BOOT2) - the game's own (the context-lost banner stays down for it), the ink's, the gate veil's
(whose `destroy` now loses it too) and the intro's (likewise its `dispose`). On Firefox a context lives in the GPU
process; `WEBGL_lose_context` frees it there now, not when the tab's collector reaches it. `test/ui/ink/fb1003_glleak.test.js`.

**Said, not fixed.** The world's GPU caches never evict: `renderer.textures`, `emissionTextures`, `tileArrays` and the
pipeline's `gpuMeshes` keep every archive record, climate set and model a session has met - bounded by the game's own
data, but growing with travel and fights, and multiplied by texture mods. An eviction needs a re-upload on a cache miss
in the draw path (the hosts upload at build time only), which is its own slice. A save slot's screenshot texture in a
dungeon (saveWindow's `saveshot`, dropped without its `dispose`) is one texture a slot, bounded.

## BOUNTY-ROCK (5)

`player/collider.js` insideSolid; `scenes/world.js` `_inRock`, _standCampEncounter, _bountyTrailSpot, the farm pool's
`spotOk`. The open-ground stand - a bounty's pack, a camp, an Overworld band - pitched its anchor on the terrain's floor
(`campAnchorSpot` over `collider.heightAt`); a World of Daggerfall rock field or mountain stands on that floor, and from
inside one the members' ring meets its inner walls (the collider reads both faces) and its open-space test
(`sphereOverlaps`) finds no face within 0.65 m. Now a spot inside static solid is refused - the collider's own
point-in-solid, ROCK-FREE's `partsHolding` (an odd count of crossings of one part's skin straight up, half a metre off
the ground), exact where the nodes' `insideRocks` is a footprint's box (a mountain's box would refuse whole valleys and
a pack would never stand): the anchor rolls again, a member takes the next spot, the split hunt's trail spot takes the
next of its eight (a spot in rock stood nobody, on every retry), and no bounty farmstead is raised in one. The deep-water
guards' lines are unchanged (tools/mutants/auditpace.json quotes them). `test/systems/party/fb1003_bountyrock.test.js`;
`test/systems/auditbounty1.test.js` and `test/systems/auditpscale1.test.js` mount the stand with `_inRock` in its scope.

## BODYGUARD-CLOSE (6)

[RAVEN-CLOSE, FIELD BUGS 2026-10-21d: the start-up closing is read as the quest stands, at run time - the clock's own task
and every `when` its end sets off alone with what is set now: this reading saw the clock's own task alone, and B0B81Y02's
`_2dung_` closes through a `when` - `01-Overview/bugs/Field-Bugs-2026-10-21d.md`.]

`systems/quest/clock.js` closesStartUp, QUIET_CLOSE, `isDeadline`. A0C01Y01 (The Bodyguard): `_questdone_` pays on
`when _clickqgiver_ and _slain_`, and the script's one `end quest` is `_timer_` (1.03:00), started by the start-up block
- offline (and in DFU) the paid quest stands in the journal until that day and three hours run out. TIMEFREE reads
`_timer_` as a deadline (its end loses the quest), and T1's run-time half - a success turns a deadline into the
script's close - skipped clocks the start-up block started, for A0C41Y18, whose start-up block pays and whose 1001 days
are its lifetime. So online the paid Bodyguard never closed. Now a START-UP CLOSING closes on the short wait once the
quest is a success: the start-up block settles nothing (the success is a later task's) and the clock's end is a quiet
close - `end quest`, a kept item made permanent, the questor dropped, nothing said or sent and no standing lowered.
R0C10Y01's `_queston_` (-20 with the questgiver, beside its own `_delay_` close) and A0C10Y05's `_traveltime_` (a "too
late" line) stayed frozen after a success under TIMEFREE (a deadline runs on played time since REST8); A0C41Y18 keeps its lifetime. Read over the whole corpus: of the start-up
deadlines it turns, every other quest closes in the reward's own reach or by another close first, but A0C00Y10, which
closed when the player left the inn and now closes on the short wait if they stay. A stuck save closes on its next tick
(`questSuccess` is saved). `test/systems/quest/fb1003_bodyguard.test.js` runs the real machine: online, a hundred unpaid hours leave it
running and the pay closes it within the short wait; offline, DFU's day and three hours.

## WIDGET-LOOK, WIDGET-RECOIL (7)

`ui/lookSettings.js` dfuLookAxes; `combat/weapon/weaponRig.js`; `player/lookFilter.js` (its doc); `combat/pcaao.js`
pcaaoAttackDamage's `onStruck`; `combat/formulas.js`. INERTIA: Weapon Widget's, Shield Widget's and Handheld Torches'
Inertia read InputManager.LookX/LookY - the axis PlayerMouseLook.ApplyLook (:126-132) turns into degrees at
`sensitivity` (the serialized 2, gamepad.js LOOK_SENSITIVITY_FIELD) times MouseLookSensitivity, InvertMouseVertical
applied after it. The rig handed them the frame latch's radians (pitch inverted): at the default 2.0 a fourteenth of
their sway (180/pi over 4), while a strafe - the mods' own units - swayed them whole, which is the report. `dfuLookAxes`
converts (degrees over 2 x the setting, the invert undone) and the three mods take it; the Thunderlock keeps the
radians its lab (gun-proto.html) is tuned on, FIELD-GUN8's "1:1". RECOIL: Weapon Widget's Recoil was wired (resolveHit
-> onAttackResult) and needs its module on; the Shield Widget's default condition, "Attack On Shield", asks whether the
shield covers the struck part, and PCAAO's core (`armorHitFormulaRedone`, on by default) rolls its own part, which the
tail's struck hook never saw - -1 on every blow, so the kick never came. The core hands its part back (`onStruck`).
`test/combat/weapon/fb1003_widgetlook.test.js`; the rig's pins in `test/combat/weapon/ww1_weaponwidget.test.js`, `test/combat/sw1_shield_widget.test.js`
and `test/systems/ht1_handheldtorches.test.js` read the new feed.

**Said, not fixed.** `Step.Condition` (the mods' "Sheathe/Attack Only" against "All Transforms") is read and never used:
with Step on (off by default; on in the Diverse Weapons preset) every transform snaps, Inertia and Recoil included, as
"All Transforms" would. The mod's own code (its IL) is not here to port the condition from; with the axes fixed a
moderate turn sways about 48 px at 1080p, past the preset's 17 px grid. A pad's look is converted at the mouse's ratio
(DFU's controller arm scales by its own joystick sensitivity and the frame's time).

## HALL-GOLD (8)

`systems/online/onlineHomes.js` hallShortLine, hallOldGoldLine; `scenes/worldModes.js` buyHallAt; `ui/socialPanel.js`
guildHallGoldText, the treasury's buttons; `server-account/src/guilds.js` viewOf (`hallGold`). The purchase path is
whole: the door's "Buy it for <guild>: N gold from the treasury" pays from the guild's gold treasury - only the gold
realm characters put in (`realm_gold`, halls.js buyHall), never a bank account - at the price and half again
(GUILD_HALL_PRICE_MULT, decided). What failed the guild was the words: the two refusals - `guild-treasury-short` and
`guild-treasury-old` - read one line, "The treasury needs N gold put in by realm characters", which says neither which
guard held nor where gold goes, and "the realm" read as a place. Now each is its own line, grouped digits: short of
the price says to put it in at the Guild tab's Treasury, at most 1,000,000 a move, and that a bank account does not pay;
short of counted gold says which gold counts. The Guild tab's Hall section, with no hall, says how much of the treasury
can buy one (`hallGold`, a field the service now sends; an older service's answer says nothing). And Deposit and
Withdraw are held at the button past GUILD_MOVE_MAX with the cap said, where the service refused it after the press (a
1,274,880 hall takes two deposits). `test/ui/fb1003_hallgold.test.js` (the view through the real service).

**Said, not fixed.** A refused buy still spends one of the hour's twenty home claims (`overRate` before the treasury's
guard); a treasury from before the realm (`realm_gold` 0 since 0020) stays uncountable - OPEN, Mac's call, as
0020_realm_audit.sql records. `hallGold` needs the account service deployed to show; the refusal lines are the client's.

Mutation list: `tools/mutants/fb1003.json`.
