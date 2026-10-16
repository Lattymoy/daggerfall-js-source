# AUDIT MW-TORCH - the held torch, the sneak idle, the arm's identity, the body's feet (2026-09-16)

Mac: "Lets do an audit on this."

The slice under audit: MWA3 (the arm stands FOR the entity), MW-D51
(the held torch - the first blend mask this port has ever had), MW-D52
(the sneak idle), the uploaded WEAPON-VIS1/2 + MWA2 follow-up patch
set, and - from play, in the same message - EOTB-FEET (the Eye of the
Beholder body hovering).

## The method

An independent adversarial read of the three commits by a reviewer
given the code and the reference's laws but NOT the author's
conclusions, asked for concrete failure scenarios rather than style;
every finding verified against the code (and, for F1, against the
reference's own source) before a line moved; the fixes pinned by
tests that EXECUTE the path where the fixture can reach it, and by
source pins where it cannot; the pins that would have passed on the
broken code named as such.

## The findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| F1 | medium, behaviour | `torchVisible` paired the TwoHanded bit with the class ("a real weapon"), so a readied spell or drawn fists KEPT the torch up and its clip playing over the spellcast stance. The reference (`NpcAnimation::updateCarriedLeftVisible`) is one line: `!(flags & TwoHanded)` - and its flag table gives Spell and HandToHand the bit for exactly that (vanilla hides the shield when you ready magic). The pin locked the wrong rule in verbatim. | `carriedLeftVisible(type)`, the reference's line, exported and EXECUTED over the whole type table. |
| F2 | medium | The "torch" clip and the left-arm overlay gated on `torchLit` alone, never on a light actually resolved on THIS rig - a master with LIGH records but the mesh unattached, or a skeleton without Shield Bone, raised an empty left arm for as long as the DF torch was lit; and the arm and the body resolve independently, so one could raise empty while the other held. | `torchVisible` asks `rig().torch`, per rig. |
| F3 | low-medium, hitch | The fast path remembered nothing about a bind that FAILED: a LIGH record present but its mesh missing or the bone absent meant every light-up reopened the archives and repacked both meshes for the same refusal, with any worn/hand swap queued behind `busy`. | `torchTried` on the rig, set by the slow path whatever its answer; the fast path reads it. EXECUTED (one reopen, then none). |
| F4 | low-medium, contract | With a torch lit and its clip found, every frame allocated a track-map wrapper, its `get` closure, a sampler closure and one wrapper per masked bone - against update()'s "no allocation after the first pack". | `overlayTracks` builds ONE merged Map, memoised per (base, overlay, mask) and rebuilt only when a slot or the view changes; one sampler for the rig's life reads the torch's clock through a variable. |
| F5 | low | `setTorch` never wrote `lastBuildOpts.torch`, so `setWorn`'s equip-follow rebuild spread the BUILD's stale flag: lit after a doused build, every armour change rebuilt without the torch and the next frame ran the slow path again; doused after a lit build, the torch showed for a frame. `setWeapon` had the same hole for the hand. | Both write what is in hand into `lastBuildOpts`. EXECUTED (the doused flag survives a rebuild). |
| F6 | low-medium | MWA3's door: a load landing while the last load's build still ran (seconds) found `ready()` false, went on to `build()` and was REFUSED with no queue - the new character wore the old one's body until the next door. Mac's report by another road. | `build()` queues a build that arrives mid-build and runs it when the in-flight one settles, superseding what was queued for the replaced rig; autoBuildArms does not warn on a queued build; `builtFor()` is null when nothing stands. EXECUTED (the queued identity stands). |
| F7 | low | `fpArm.unload()` did not consult `busy`, and `build()` installed its result unconditionally - the pack's Off or Remove data pressed during the build was overtaken by the build landing after it. | A generation bumped by `unload()`; a build that lands after it is discarded. EXECUTED. |
| F8 | low | MWA2's "Remove data" cleared the stores and left the COUNT standing - the card kept saying "N archives attached", the On/Off row and Remove stayed, and autoBuildArms's data gate still passed. | `clearStoredMorrowind` zeroes the count, drops the print and the names, bumps the generation. |
| F9 | note | The reference plays the sneak idle on the LOWER body (Priority_SneakIdleLowerBody), so the legs stay crouched under an upper-body weapon clip; the port's single winner stands the sneaking body up for an attack's length. Inherent to the no-mask design. | Recorded in MW-D52 as a divergence, not claimed as parity. |
| EOTB-FEET | from play | "the sprite not connected to the floor. Like you walk hovering." The mod's three placement arms compute the quad's CENTRE (Unity's centred billboard); the port's renderer is BOTTOM-anchored and every other caller hands it the base. The body stood half its height - a metre - in the air, and the pin asserted the centre at `size/2` and called it "the bottom at the feet". | `place()` hands over the base; the pin asserts the base AT the feet; the shader's anchoring line and the conversion pinned together. |

## Checked and found sound

WEAPON-VIS2 (`POLLED_ACTIONS` is `{ReadyWeapon, SwitchHand}`; routeAction
has no SwitchHand arm; the per-frame edge poll is ReadyWeapon's one
other consumer in both hosts and stands - now pinned beside the
decline); WEAPON-VIS1's counter under every toggle path; MWA3's
identity compare (both sides through `mwRaceId`, `!!female`,
`faceIndex|0`, never per frame); the LHDT layout against
loadligh.hpp, the version bump and `isArmRecords`; `blendMaskBones`
against detectBlendMask on mwSkin's node shape; `overlayTracks`'
fall-through for an unkeyed mask bone; `poseSkeleton` asking only
`get` and `sampleTrack`; the torch state's lifecycle across build,
unload and the view switch; `flushPending`'s order; the sneak idle's
inputs and the plain idle's loop dice.

## The pins that were not pins

Three of the reviewer's findings (F1, F2, F5) sat behind pins that
would have passed on the broken code: a verbatim regex of the wrong
rule, a machine test whose fixture master carries no LIGH record (so
the slow path, the overlay branch and the two-handed rule never ran),
and nothing exercising `lastBuildOpts` after a rebuild. The fixture
gap is closed as far as the fixture allows - a LIGH record is APPENDED
to the fixture master in the test and the torch mesh mapped, which
runs the slow path to its "no Shield Bone" refusal and everything
around it; the rule runs as a function over the type table. Still
unreached by execution, recorded: the overlay branch itself (the
fixture rig has no clavicle and its .kf no "torch" group) and the
sneak idle's composition (no "idlesneak" in the fixture .kf). Both are
source-pinned; the next fixture pass should give armfp.nif a clavicle
chain and armfpidle.kf the two groups.

## The lesson

The reviewer found F1 by reading the reference, not the port - the
comment beside the wrong rule said "as every reference use pairs it",
and the pin quoted the comment's code back to itself. A pin that
restates the implementation is a pin on the typing, not the law; the
law's pin is the reference's line, run over the inputs.

## TORCH-VIS (2026-09-18) - a sheathed stance is not a stowed light

Mac, playing the Morrowind lane:

> If you only have the torch equipped and no weapon, it doesn't show you
> holding it in first person (morrowind)

Pre-existing, and **one clause too wide**. The weapon rig's draw ladder
opens on `shown()`, and `shown()` is the **weapon's** visibility - the
file says so itself a few lines above, where the classic spellcasting
hands were hoisted out from under it: *"NOT under shown() - the weapon is
the thing shown() hides"*. One leg of `shown()` is
`playerWeapon.sheathed`, and a player walking around with a torch and
nothing drawn is sheathed by definition. So the ladder returned before
either lane could draw the light: the Morrowind arm never reached
`fpArm.draw(c)`, and HT1's classic torch hand never reached its screen
quad. **The one state a carried light exists for was the one state it
never drew in.**

The fix is not a new rule; it is the two references' existing rule,
finally reachable.

- **The Morrowind rig already answered it.** MW-D51's
  `carriedLeftVisible` is `NpcAnimation::updateCarriedLeftVisible`
  verbatim - visible unless the stance's flags say two-handed - and
  `animWeaponType(owned, sheathed, spellReady)` idles a sheathed player
  in `None` whatever they own. `None` is not two-handed, so **the
  reference draws the torch for a weaponless player**. The same law
  answers FALSE for a readied spell, which is exactly why that leg of
  `shown()` must keep hiding it.
- **Handheld Torches already answered it too.** HT7's hand law leaves
  "an empty hand you are not swinging with" free *precisely so a
  weaponless player can carry a light*.

So the ladder gained one exception, computed from the legs it does NOT
relax: `torchOnly` is true only when `shown()` is false, no spell is
armed, no cast is playing, no equip countdown is running, and
`isHeldLight(entity.lightSource)` - the mod's own two templates, now
exported so the ladder asks the question in the mod's words rather than
inventing a second spelling of it. Paralysis, third person and the EOTB
body still take everything, above.

**And the lane that will draw it has a veto.** This is the half the first
cut got wrong, and it is worth writing down because it is the same
mistake this page already records once: *the entity knowing a light is
equipped is not the same question as "will anything actually appear".*
The Morrowind held-light art is the **torch alone** - `isLitTorch`, with
the classic lane's hand sprite covering the lantern as it always has -
and a rig can resolve no light at all (no LIGH record, no attached mesh,
no Shield Bone: AUDIT MW-TORCH F2's own case). Opening the gate on those
would have painted a sheathed idle **holding nothing** where the screen
used to be blank: a pose nobody has ever seen, offered as a fix. So the
arm answers for itself - `fpArm.torchShown()` is its own `torchVisible()`,
the reference's three conditions at once - and the exception defers to it
on that lane. The classic lane needs no veto: `handheld.draw` asks the
same question itself and returns false.

**What comes back with the torch, said accurately.** On the CLASSIC lane,
nothing: `if (torchOnly) return;` sits between the lit hand and the
widget's clone, so a sheathed player draws a light and no weapon, clone
or sprite. On the MORROWIND lane the arm returns above that line and
paints its own stance, which hides the weapon in the settled sheathed
state - but **not** during the unequip transient, where the rig
deliberately keeps the blade in hand until the detach key. So sheathing
with a torch lit now plays the sheathe animation out instead of cutting
to nothing. That is the reference's own behaviour, and the note in the
code says so rather than claiming a blanket "no weapon", which would have
been false on the lane the report came from.

**A thing worth knowing before the next change here:** this fix puts the
Morrowind *sheathed* first-person idle on screen for the first time. The
gate had hidden it since the lane shipped, so that pose is art this port
has never exercised.

One rig, four hosts: the change is inside `createWeaponRig`, which
`world.js`, `exterior.js`, `worldModes.js` and `dungeonContext.js` all
build their viewmodel through, so no host was touched.

**Campaign:** 2 pins (the law driven over the real reference for every
owned type and the two light tests' deliberate divergence; the ladder and
the veto by source), 9 mutants, 9 killed. Four standing
ladder pins re-aimed by content (HT1's order, MW-ATTACH's fall-through,
WW1's order, FPSSpellCasting's gate index).

**Not seen on a GPU.** Nobody has stood in a cave holding only a torch.
Worth a pass: equip a torch with no weapon, first person, both lanes;
then ready a spell (the torch should go), then draw a weapon (the weapon
should come back).
