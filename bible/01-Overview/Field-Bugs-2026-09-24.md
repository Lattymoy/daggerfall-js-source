# FIELD BUGS 2026-09-24 — DISC16, six from Discord and the city watch

Mac, with the Discord screenshots: *"I want to fix these issues + enhance
guard interaction"*.

1. *"leaving the game undoes your lycanthropy/vampirism"* - "i became a
   werewolf, tried joining into online (made a backup save beforehand) and
   when i loaded in, i had my old stats. i went back into the regular game
   and on both save files (new and old) i had my old stats" / "ive still
   got the spell in my inventory it just doesnt do anything"
2. *"Playing online makes my vampire character human again"* - "i turned
   my character into vampire twice now and it keeps reverting it"
3. *"rested while poisoned put me into an infinite death loop"* - "trying
   to respawn just loads me in and kills me instantly. it overwrote all my
   saves as i respawned too"
4. *"Light spell does not work in dungeons"*
5. *"In a dungeon that I cant hurt enemy's"* - "Ruin of tower yeomham"
6. *"Cant enter Mannimarcos room"* - "I went to scourg barrow but the door
   to his room wont open in online, offline and even if i bash it doesnt
   make a sound" (a second player: "Same problem here")
7. *"Guards are lazy..."* - "guards will arrest and attack me for resting
   within city limits but will not protect me from 5 angry centaur
   invaders who wanna beat me to death in town?"

Every report was reproduced in node before it was touched, except where a
section says it could not be. The pins are `test/disc16.test.js`, and the
mutant set is `tools/mutants/disc16.json`.

---

## DISC16-A: the curse that a load took away (reports 1 and 2)

**Cause.** DFU keeps a racial override alive with
`forcedRoundsRemaining = 1`: `RoundsRemaining` always answers it and
`RemoveRound` never counts it down (RacialOverrideEffect.cs:28, :71-80). A
cure sets it to 0 (LycanthropyEffect.cs:485, VampirismEffect.cs:306), and
the next `DoMagicRound` removes the bundle (EntityEffectManager.cs:1727-1759).
`DiseaseEffect` does the same (DiseaseEffect.cs:32, :67-77), and the two
infections inherit it.

The port's word for that is `permanent: true`, which every disease and
poison entry carries. The two curse entries (`createLycanthropyCurse`,
`createVampirismCurse`) and the infection entry (`createInfection`) carried
neither `permanent` nor a round count. So `tickActiveEffects` ran them as
timed effects:
- Each live round took the absent `roundsRemaining` to `NaN`. `NaN <= 0` is
  false, so the curse lived on in the session and nothing looked wrong.
- The save's JSON wrote the `NaN` as `null`.
- The first magic round after ANY load read `null <= 0` and dropped the
  entry. A werewolf or a vampire came back human, and the spell stayed in
  the book with nothing behind it.

Going online is a load (the online door boots `?load`), which is why both
reports name it. The same path cured a bite that had not yet turned.

The node repro: a werewolf and a vampire, a few rounds, snapshot, JSON,
restore, three rounds. Before the fix both curses were gone after the first
round. After it both stand, offline and after the online arrival's clock
shift.

**Fix.**
- The three constructors mint `permanent: true`, DFU's forcedRoundsRemaining.
  The cure's `ended` is its `forcedRoundsRemaining = 0`, and the entry
  leaves the list at the next round, as DFU's bundle does.
- `restorePlayer` sets the flag on every racial-override and infection entry
  it restores. The entries were saved whole, so a save written before this
  fix (the reporters' own) gives the player the curse back.

This is a 1:1 correction; no departure.

## DISC16-B: the Light spell underground (report 4)

**Cause.** DFU's `LightNormal.StartLight` hangs a MagicCandle 1.4 units in
front of the player (LightNormal.cs:80-103, with DFU's own comment that the
short distance is for dungeons), wherever the player stands. The port gives
every casting host its own engine and candle. The dungeon context builds its
own (`dungeonContext.js`), and the casts underground (the spellbook and the
click) go through it, which is why the candle's flame is drawn.

The world host's dungeon frame (`worldModes.js`, the `mode === 'dungeon'`
branch) built its point-light list with `magic?.candleLight()`. That is the
WORLD host's engine, and nothing updates it underground:
- the branch returns before any `magic.update`;
- the host's own update runs only in exterior mode.

So a Light cast in a dungeon drew its flame and lit nothing. A Light cast
outdoors before going down stood lit at the street's coordinates for the
whole visit. The standalone `?dungeon` host read the context's candle and
was correct. That host is the only one the X11 probe loads, which is how
this shipped.

**Fix.** The dungeon frame reads `dungeonCtx.candleLight()`, the accessor
the standalone host already used. The note on it that said "?world reads
magic.candleLight() directly off its own engine" is corrected.

This is a 1:1 correction. Not seen on a GPU. The node repro (two real
engines, a Light cast through the dungeon's, the branch's light list
replayed) put the candle in slot 0 after the fix and nowhere before it.
