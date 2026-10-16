# FIELD BUGS 2026-09-27 - seven from the Discord, the Escape first

Mac, with screenshots from the bug-reports channel and a DM: *"Some bugs."* And on the
pause: *"So when you hit esc to leave a menu, your cursor remains on the screen instead
of returning to the game."*

1. *"acrobat (female) skin bug - acrobat sprite is super short on certain angles, (i am
   not crouching)"* (Skeptikali)
2. *"Retaining criminal status even after going to prison and serving sentence - Guards
   will still chase you down and kill you, even if you have already been to prison for
   the crime committed"* (Hulk Hogan)
3. *"Can't see all items in cart - My resolution is 1366 x 768. I tried setting the HUD
   to %50, but I still can't see all the items"* (Malarkey)
4. *"... even if I have all my gear on and a max of 502 encumbrance it sees me as
   overweight when I hit past whatever my base is ... as soon as I hit 105 it's giving
   me full weight penalties"* (名無しの人)
5. *"In the Mantellan Crux (final MQ dungeon) when reaching entrance to the Fire Skull
   Room after touching the big crystal, it will not go there, instead it leads back to
   outside."* (Seanobi)
6. *"Lanxus can't cast spells on other players, even during party"* - Lanxus: *"we both
   are high level (My character is at lvl 34) and that is when i notice can't cast
   beneficial spell on others"* (Seanobi, Mohg)
7. A tester in a DM: *"the pause thing i told u broke the pause menu totally. U have to
   hit escape 2 times to get pause menu up now"*, and Mac's clarification above.

The same DM carried ideas, not bugs: an owner's option to let friends drop things in a
house, a cost for teleporting into a locked house (*"Tested that"* - it works today), and
a name, "DaggerfallOnline" - taken the same day as BR4's rebrand to Daggerfall Online
(`10-UI/UI-Arc.md` BR4). The two house ideas are Mac's to decide; nothing here touches
them.

Each fix below is written up on its owning page; this page is the index and what is
left for Mac.

## ESC-LOCK: one Escape opens the pause; the app takes the look back (7)

Two browser rules, not a regression. A locked pointer's Escape is the browser's - it
ends the lock and the page never sees the key - so the first press only freed the
cursor. And Escape is no user activation, so once the player has ended a lock every
relock inside an Escape close was refused. A lock loss the page did not ask for is now
delivered as that press, so the pause opens on one Escape; a refused relock is re-run
by the desktop app's shell as a user gesture. **A browser tab cannot relock on Escape**
- the next click or key does, as before. `10-UI/UI-Arc.md` ESC-LOCK; Ledger A
(continued) "THE BROWSER KEEPS ESCAPE".

## JAIL-HIT: the trial is a paused window offline too (2)

The release clears the crime, as DFU's does. What was wrong: DFU's surrender box and
court stop the world, and here the watch keeps WINFOE1's clock under any window.
ARREST-SHIELD withheld its blows online only, so offline a guard's blow on the
surrender's 1 health killed the player inside the court, or forced a second trial that
threw the prison screen's release away - the crime never cleared and the watch hunted
on. The shield holds in both modes, one trial at a time, and an unanswered surrender
box another window replaces ends its question. `06-Systems/Systems-Arc.md` under
WINFOE1.

DFU's and kept: a sentence restores only half the region's legal reputation less one,
and below -10 the watch can be called at random (PlayerEntity.cs:498-504). A player
with a bad name in a region is hunted there after the sentence in Daggerfall too.

## CART-FIT: the pack and the wagon share one screen (3)

The pack and a side window beside it (the wagon, the player's own storage) were each
clamped to the viewport alone, so side by side they wanted 1738 px and the wagon ran
off the edge. The HUD scale never reached this window. Paired, the side window is one
column and the pack takes the rest; from 1770 px the two-column window returns.
`10-UI/UI-Arc.md` CART-FIT.

## ENC-CEIL: the penalty reads the pack's ceiling (4)

Roleplay & Realism's encumbrance penalty divided by the bare strength formula (105);
the mod divides by `PlayerEntity.MaxEncumbrance`, the pack's own ceiling with the
weight allowance (502). The horse and cart were never part of it.
`06-Systems/Roleplay-Realism.md` ENC-CEIL.

## CRUX-DOOR: a door in the Crux is not a way out (5)

A dungeon block's door list is every door face its models carry - DFU's misnomer - and
the host took every one as an exit. Only a DungeonExit door leaves; the rest are the
model's, and the Crux's own teleport answers them again. `06-Systems/Quest-Arc.md`
CRUX-DOOR. Not verified without ARENA2 - see below.

## PEER-CAST: a caster past level 30 casts on a mate at 30 (6)

The cast frame's level bound is 30 and the port caps no level, so a caster past it
minted a frame the caster's own door refused: nothing left, and a CasterOnly heal fell
back onto the caster. The sender clamps to the bound, the duel's law.
`06-Systems/Online-Arc.md` PEER-CAST.

## ACRO-SHORT: one picture drawn small (1)

The female acrobat's front three-quarter idle is a whole figure 81 pixels tall where
the group's other views are 110. The pack carries no XML to size it, so `skins.json`
carries the scale DFU's XML would. A sweep of every view of every sheet found no
other. `06-Systems/Eye-Of-The-Beholder.md` ACRO-SHORT.

## For Mac

- **Escape in a browser tab.** An Escape close cannot take the mouse back in a tab;
  the desktop app can. Two ways past it: Chrome's Keyboard Lock (only in a page
  fullscreen, which the port offers on phones alone), or a "click to resume" hint.
- **The cast level bound.** Casters past 30 cast on a mate at 30 (about 12% short on
  the per-level terms at 34). Raising the bound is a relay version and a larger
  crafted gift.
- **The paired side window scrolls** below 1770 px when it outgrows its frame -
  PX21e's no-scroll call was made of the loot window alone, which keeps it.
- **The Crux door** is fixed by type; if the reporter's door is a baked exit face
  (DFU's model-58051 kind), DFU exits there too and it is another bug. An ARENA2-gated
  pin laying out the Crux's doors would settle it.
- **Guards after a sentence** at a low regional reputation are DFU's rule, kept.

## Verification

Suite green at every commit (`node tools/testChanged.mjs`, then `npm run check`);
new pins `jailhit` (3), `cartfit` (2), `crux_door` (2), `esclock` (5), and ACRO-SHORT,
ENC-CEIL and PEER-CAST in `skin2_class_skins`, `rr1_realism` and `allycast`. Mutants:
`jail_hit` 6, `cart_fit` 4, `crux_door` 4, `esc_lock` 8, `enc_ceil` 3, `peer_cast` 3,
`skin2` +5 - all dead. CART-FIT measured in Chromium; ESC-LOCK and CRUX-DOOR not
proven in a real browser or on real data.
