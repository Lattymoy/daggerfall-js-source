# AUDIT 36 - THE SPELLCAST LANE (2026-08-31)

Mac's call: a comprehensive audit on everything so far, the hour
MW-D39 landed. Method: the slice read against the three hosts that
actually cast, and against the ENGINE'S OWN CALL ORDER rather than
the shape the wiring assumed.

## Findings

**F1 - ONLY TWO OF THE THREE HOSTS CAST.** D39 wired the arm's
spellcast release into `dungeonContext` and `world` and missed
`exterior` - the standalone above-ground page, which has its own
`createPlayerMagic` and its own weapon rig. A spell cast there took
the stance and never played the cast. Wired on the same moment,
through the same one door, and pinned as ALL THREE by name so the
next host cannot be missed silently.

**F2 (severe) - EVERY INSTANT SELF-CAST WAS SILENT.** `castSpell`
required `spellReady` to already be latched, and `spellReady` is the
rig's per-frame read of `spellArmed()`. A CasterOnly spell is readied
and cast in ONE synchronous call - `hostMagic.readySpell` runs
`castInput(null, null)` immediately for rangeType 0 - so no frame
ticked between them, the read had never happened, and the cast
refused. That is the healing and buff half of a player's spellbook.
Worse than the refusal: had the gate not caught it, `playAction`
would have played `"self start"` in the SWORD's group, because
`weaponGroup` is composed from the stance. The cast is proof enough
that a spell is going, so it now latches the stance and re-composes
the group before it plays. 3 mutants dead (refused again; latched
without composing; the exterior host silent).

## Verified

- **The cast fires while the spell is still readied**
  (hostMagic:302 - `onCastReadySpell` precedes `readiedSpell = null`),
  so the normal ranged path finds the stance already latched and the
  latch in F2 is a no-op there.
- **The range reaches the door** in all three hosts (`sp?.rangeType`),
  and `spellAttackType` folds Daggerfall's five onto the reference's
  three.
- **Neither door gates the magic**: `castSpell` returns false on a
  missing clip and the caller ignores the return; the spell flies.
- **`readySpell` is idempotent** - the rig calls it every frame - and
  an un-ready abandons a cast in flight (an aborted spell).
- **The enum order** matches character.hpp exactly, so
  `accurateAiming`'s `> WeaponEquipped` comparison makes a cast aim,
  which is the reference's behaviour and is pinned.

## Not covered, said plainly

The clips themselves are the player's: whether a given Morrowind
animation set carries `self`/`touch`/`target` keys in the `spellcast`
group is a data question this repo cannot answer, and a set that does
not gets a note on the card. The VISUALS - the hand glow keyed to the
spell's school, then the projectile and impact particles - are
slices two and three and are not begun.
