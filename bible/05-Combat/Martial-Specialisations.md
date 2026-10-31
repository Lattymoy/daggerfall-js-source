# Martial Specialisations

A fighter's counterpart of the arcane paths: a player who masters two of the six weapon skills (Long Blade, Short
Blade, Axe, Blunt Weapon, Archery, Hand-to-Hand) may choose one of fifteen martial paths, each with a passive and a
signature technique. Online, every weapon skill also pays past 100. The player meets it in a prompt after the second
mastery and on the pause window's Growth tab.

## How it works

- **Who** (`src/systems/martialPaths.js`). A player with Master Skills in force (online always; offline the switch)
  and two of the six weapon skills mastered. `martialPossible` hides paths from a class that can never master two.
- **The choice.** A pair of mastered weapon skills names one path (`martialOfPair`); with three mastered, the player
  picks among their pairs. It is asked once on the first quiet pass after the second weapon mastery
  (`raisePlayerSkills`, `src/scenes/shared.js`), and can be chosen later on the Growth tab's guide
  (`src/ui/growth/specGuide.js`) or the classic sheet's W row (`src/ui/charsheet.js`). Saved as `martialPath`.
- **Held and awake.** A path is held (`martialHeld`) by the player's own entity with Master Skills in force and both
  masteries; it is awake (`martialAwake`) while held and not in a refereed fight or beast form. A spellsword may hold
  an arcane and a martial path together.
- **The paths** (`MARTIAL_PATHS`, numbers in `MARTIAL_NUMBERS`, powers in `src/systems/martialPowers.js`):

  | Path | Skills | Passive | Signature |
  | --- | --- | --- | --- |
  | Blademaster | Long + Short Blade | Flowing Steel: each landed blow +3% for 4 s, up to 5 stacks | Thousand Cuts |
  | Warblade | Long Blade + Axe | War Rhythm: a kill quickens swings 15% for 10 s | Rallying Cleave |
  | Vanguard | Long Blade + Blunt | Iron Discipline: foes' blows 10% lighter | Judgement |
  | Ranger | Long Blade + Archery | Hunter's Instinct: +20% against beasts | Mark of the Hunt |
  | Skirmisher | Long Blade + Hand-to-Hand | Dancer's Step: one foe blow in 10 misses | Cyclone |
  | Bloodletter | Short Blade + Axe | Bloodlust: a kill restores 5% health | Gutting Lunge |
  | Cutthroat | Short Blade + Blunt | Cheap Shot: +25% on a foe unaware of me | Blackjack |
  | Assassin | Short Blade + Archery | Opening Strike: first landed blow on each foe +30% | Vanishing Strike |
  | Shadowdancer | Short Blade + Hand-to-Hand | Light Step: +10 Agility, +15 Dodging | Phantom Strike |
  | Juggernaut | Axe + Blunt | Stand Firm: a hurt past 30% health heals 20% of it, every 3 minutes | Earthsplitter |
  | Woodsman | Axe + Archery | Tireless: a kill restores 15% fatigue | Felling Strike |
  | Berserker | Axe + Hand-to-Hand | Frenzy: below half health, +20% and swings 10% quicker | Savage Whirl |
  | Crusader | Blunt + Archery | Purge: +20% against undead and daedra | Hallowed Strike |
  | Brawler | Blunt + Hand-to-Hand | Grit: 1% health and 2% fatigue back each magic round | Knockout |
  | Strider | Archery + Hand-to-Hand | Windborne: +10 Speed, +15 Running, +15 Jumping | Windstrike |

  The Skirmisher's id is `bladedancer` and the Strider's `windrunner`; ids never move.
- **Signature techniques** (`SIGNATURE_TECHNIQUES`): forms of the technique roster's own mechanics (rain, pierce, leap,
  dash, swing) with one form for each weapon family of the pair, sharing one cooldown a path. Each has a rider that acts
  only for its own path's holder. They stand outside the roster, so no loot door draws one and the item law names none.
  The Weapon technique key answers the path's signature when the weapon carries no line; the Martial technique key
  always does (`Weapon-Techniques.md`). Never the beast's claws or the Thunderlock.
- **Weapons past 100** (`src/systems/weaponMastery.js`). Online, each point of a weapon skill's climb past 100 pays, to
  effective 140 at 200: Long Blade and Archery every blow 1% harder (x1.4); Axe 2% harder on a foe under half health,
  Blunt 2% on a foe at half or more (x1.8 there); Short Blade every swing 1% quicker through the swing pace
  (`registerSwingPaceMod`, at most `SWING_PACE_MOST` 50%, never past the swing law's floor); Hand-to-Hand's formula
  already reads the climb. Gear on a weapon skill adds 0.44% a point to its blow (`WEAPON_GEAR_PER_POINT`), up to
  `WEAPON_GEAR_PCT_MOST` (320), added to the climb's. On a body the relay runs, health is read from the relay's word
  (`healthShare`, `src/combat/healthShare.js`).

## Rules

- The same treatment the mages got, for the weapon skills: the six weapon skills, a signature on the technique key when
  free, one arcane and one martial path together, and the balance pass (the owner).
- A path is held until given up for 200,000 gold (`SPEC_RESET_GOLD`); a mastery is never undone.
- Every percent a path lays on a blow is at most `MARTIAL_BLOW_MOST` (40) together. A heal never passes the maximum.
- Never at a player: no blow modifier, strike or rider applies to a player target or the Warden's ward. Attributes and
  swing pace are the player's own and ride open PvP sheets; a duel or arena bout puts them to sleep.
- Offline, weapons past 100 stay Daggerfall's; the paths themselves work offline with Master Skills on. Gear's share
  is also online only.
- The beast takes no path power, no past-100 bonus and no fist modifier.
- No account-service finding for a path: a path acts only with both masteries, which the client reads at every ask.

## Daggerfall Unity

DFU has no specialisation and no weapon perk past 100, and its weapon damage reads no skill. All of this is the
port's own departure. The swing pace divides even a mod's overridden answer, so no arm escapes it.

## Code and tests

- `src/systems/martialPaths.js` - the paths, numbers, forms, choice, held and awake
- `src/systems/martialPowers.js` - what the paths do, through the shared seams
- `src/systems/weaponMastery.js` - weapons past 100, gear's share
- `src/combat/techniques.js`, `src/combat/technique/techniqueBlow.js` - the signature in hand, riders
- `test/systems/martial_paths.test.js` - the law, the paths, the keys
- `test/combat/weapon_gear.test.js` - gear's share

## Open

- The Short Blade's pace meets the swing floor at the top of Speed (x1.19 at Speed 100).
- The rogue's set (Backstabbing, Critical Strike, Dodging, Stealth, Lockpicking, Pickpocket) and spellsword hybrids
  are left for later arcs.
- A forged save listing every weapon mastered at 200 judges clean and takes every weapon's past-100 bonus in PvE; the
  owner's call.
