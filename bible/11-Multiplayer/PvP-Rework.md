# The PvP Rework

How every fight between players works: a duel, the open zone (Cyrodiil, the open sea and their halls) and a siege. The
relay referees each blow on its own vitality ledger; the client reports its armour, wards and gear. In the open zone a
player raises a flag to fight, wears a skull, may become a villain, and fights from a separate PvP spell bar.

## How it works

**The numbers** (`src/net/siege/refereeHealthShare.js`, `src/net/siege/siegeRef.js`).

- The referee's pool is the player's real maximum health, held to `PVP_HEALTH_MAX`; in a fight a rising maximum adds no
  health.
- One blow or cast takes at most `PVP_HIT` (34%) of the whole: three hits. `PVP_CASTS` paces casts.
- For `PVP_HEAL_BLOCK_MS` after a player's blow, all heals together restore at most `PVP_HEAL`'s share each window,
  rising with Restoration past 100 to its top. A siege blocks heals by report.
- A player's blow scales with the weapon's climb and gear percent; skill reads to 1,100.
- A spell at a player uses its first effect: Damage or a heal (`PVP_SPELL_TYPES`, `src/combat/siegeCombat.js`). Drain
  and poison-element Damage reach no player (`PVP_POISON_ELEMENT`); a weapon's poison never rides a PvP blow.

**Armour, wards and gear** (`src/combat/pvpGuard.js`, `src/combat/pvpGearPowers.js`). The struck player reports what
its armour lets through for edged, blunt and unarmed blows (`pvpArmorKept`), averaged over the body parts; the referee
holds each share to `PVP_GUARD` and takes it before the hit cap (`guardedBlow`). Per element, it reports what its Resist
effects and saving throw let through (`pvpWardKept`); the referee holds each to at least `PVP_WARD.min` (`wardedCast`).
The striker's gear powers add at most `PVP_GEAR.attack` percent (`pvpGearBlowPct`); the struck player's guard powers
take at most `PVP_GEAR.guard` off (`pvpGearKept`). Slayer and bane lines and splash powers do not count between players.
A live Shield takes 25% off a swing and 35% off a shaft (`PVP_SHIELD`).

**The triangle** (`src/combat/pvpTriangle.js` `PVP_TRIANGLE`). Archer over mage, mage over warrior, warrior over
archer: a player's arrow at a player is scaled up and a harmful spell down, more so from level 40.

**In a fight** - while a refereed fight may hold the player:

- a self-cast buff runs `PVP_BUFF_ROUNDS` rounds, a minute (`src/combat/pvpBuffs.js` `capPvpBuffs`);
- each potion kind (health, magicka, other) waits `PVP_POTION_MS` after the last, and lands its first effect alone
  (`src/combat/pvpPotions.js`);
- each worn plate or chain piece raises spell cost and slows casting (`src/combat/pvpArmourCasting.js`
  `PVP_ARMOUR_CAST`), chain half of plate, leather nothing;
- a harmful spell at a player is held to 0.15 x the caster's live Destruction, then crits as a blow does under the
  overhaul (`src/combat/pvpSpellCrit.js` `pvpCastHold`, `pvpSpellCrit`).

**The flag** (`src/systems/wild/pvpFlag.js` `PVP_FLAG`, `src/scenes/pvpFlagHost.js`). In the open zone only a flagged
player strikes another. The `PvpFlag` key (Caps Lock by default, rebindable in Controls) or the button at the screen's
right edge raises it at once from level `PVP_FLAG.level`, and drops it at once unless a PvP blow fell within
`PVP_FLAG.lockMs`. Out of the zone the button is hidden. Party, duel and guild kin stay unhittable. Under level 30 the
referee refuses every blow given or taken; online, the level up from 29 asks first (`src/ui/levelUp/pvp30Ask.js`).

**What others see.** A 16-pixel skull (`src/ui/pvpSkull.js`) over a flagged player's name: white flagged, gold in aggro,
red a villain. A red health bar with a blue Shield strip shows over flagged players (`src/ui/nameLayer.js`); the
referee says bars in whole percent. Names show only near the crosshair (`src/ui/nameCone.js` `NAME_CONE`), except my
party and my foes. A gold-skulled concealed player is drawn faint with skull and bar.

**The villain meter** (`src/systems/wild/villainLaw.js` `VILLAIN`). A kill adds points for each level the victim is
under the killer past a margin, and more for an unflagged victim; a kill in self-defence (the victim or its party
struck first in this fight) adds nothing. At `VILLAIN.red` the killer is a villain: red skull, flag held up. The
character keeps the meter (`server-account/src/villainy.js`); the token signs it as `vl`. Raids, quests and monsters
near the player's level lower it; no clock, gold or death does. A villain holds no insurance.

**The watch hunts a villain** (`src/systems/wild/villainHunt.js` `VILLAIN_HUNT`, `src/scenes/pvpGuardsHost.js`). Red in
a zone settlement's streets, guards come in waves, mirroring the villain's best skills, and take
`VILLAIN_HUNT.taken` of every hit. In the streets a non-villain is at peace and may strike a villain alone
(`wildStreetsBar`); a villain may be struck there by anyone.

**Flagged limits** (`src/systems/wild/pvpRules.js`, `src/scenes/pvpRulesHost.js`). With the flag up: no Levitate, PvE
buffs and worn-item buffs stripped (recast when it drops), no self-cast but Shield, no rest, no horse, and foot pace
and jump held to `PVP_LIMITS`.

**The PvP spell bar** (`src/systems/wild/pvpKit.js` `PVP_KIT`, `src/ui/pvpSpellMenu.js`, `src/systems/wild/pvpSet.js`).
A second set of the hotbar's slots, in force while flagged in the zone or while its menu is open. Only toolkit spells
reach a player: Damage (the classic Fireball's area record in a picked element), Poison, and caster gifts - heals,
Regenerate, Resist, Reflect, Absorb, Shield, Speed - given to the party member under the crosshair within
`PVP_KIT.reachM`, else to me. Resurrect raises a fallen party member's body. Each costs a share of maximum magicka.
The set is locked during the combat lock.

**The reward** (`src/systems/wild/pvpReward.js`, `server-account/src/wild.js`). A kill in the open zone gives its killer
one random uninsured worn piece, rolled by the account service on the fallen's record. If every piece is insured, the
killer gets one random policy's premium and that policy is spent. With no piece and no policy, the last roll pays a
tenth of the fallen's coin and letters (`takeWildLastRoll`, `src/systems/wild/wildDropLaw.js`). Gold is paid as coin
where it fits, else as a letter of credit. No bag, purse or letter tenth drops otherwise.

**Death and rise.** Online, Enter rises at once and the screen rises by itself at `DEATH_AUTO_RISE_S`
(`src/ui/deathScreen.js`); the referee keeps a fallen down `WILD_REF.riseMs`. A zone death rises at the nearest town or
temple outside it. A rise grants no safe passage; only a walk in from the zone's edge does (`src/systems/wild/zoneEdge.js`
`ZONE_EDGE`).

**Linger** (`src/net/wild/wildLinger.js`, `server/src/pvpLinger.js`). A fighter who leaves inside the combat lock leaves
their body standing until the lock ends; it may be killed as normal. A body slain while away is kept a week; the
player's next zone word wakes them to the death screen and a rise in town.

**The HUD** (`src/ui/pvpHud.js`). A red ring round the flag button empties over the lock; an "In combat" banner with its
seconds; my three newest PvP blows bottom right; "You slew" and "Slain by" lines. A Portal Stone works anywhere in the
zone, held only by the combat lock or a monster alerted to me.

**Vitals** (`src/net/wild/pvpVitals.js`, `src/combat/pvpDeclare.js`). With the flag up, health rises by report only out of
a credit the relay grants: slow regen, a declared potion on the relay's clock, or a heal it saw paid for. Magicka and
fatigue are the relay's ledgers; each cast and swing pays the bar's cheapest price or lands nothing. Arrows come no
sooner than 0.25 s, swings no sooner than 0.45 s per target, and fast follow-up shafts are cut (`bowFastCut`).

## Rules

- Every PvP rule here is the owner's; numbers tuned in staff fights. A blow is three hits from full (the owner).
- Flagging is a choice: flag and unflag at once outside the lock, never on a party member; no one is pushed into
  villainy by defending (the owner).
- PvP is the zone's alone: the flag does nothing outside Cyrodiil, the open sea and their halls (the owner).
- No PvP under level 30 (the owner).
- Gear counts between players, capped; slayer and bane lines do not (the owner).
- Drain and poison stay out until balanced (the owner).
- The kill reward is one random uninsured piece, else one policy's gold, else the last roll; no bag drop (the owner).
- Insurance costs a fifth of a piece's worth (`WILD_INSURE_DIVISOR`, `src/systems/wild/wildInsureLaw.js`) (the owner).
- A death waits 10 s, PvE and PvP alike (the owner).
- Players must not be able to cheat health, magicka or fatigue in PvP (the owner): the relay owns a flagged fighter's
  pools.

## Daggerfall Unity

DFU has no PvP; every rule here is a departure. Armour reads the overhaul's (`src/combat/pcaao.js` `pcaaoPartKept`).
The watch hunt departs from `PlayerEntity.SpawnCityGuards`, which sends 2-5 guards once for a crime and resists
nothing. DFU's spells never crit and its rise comes after three seconds.

## Code and tests

- `src/net/siege/refereeHealthShare.js`, `src/net/siege/siegeRef.js` - the referee's caps and shares
- `src/net/wild/wildRef.js` - the open zone's referee: flags, aggro, villainy, streets, rises
- `src/net/wild/pvpVitals.js` - the relay's pools and rate floors
- `src/combat/` `pvpGuard.js`, `pvpGearPowers.js`, `pvpTriangle.js`, `pvpBuffs.js`, `pvpPotions.js`,
  `pvpArmourCasting.js`, `pvpSpellCrit.js`, `pvpDeclare.js` - the client's reports and fight rules
- `src/systems/wild/` `pvpFlag.js`, `villainLaw.js`, `villainHunt.js`, `pvpRules.js`, `pvpKit.js`, `pvpReward.js`,
  `zoneEdge.js` - the zone's laws
- `src/scenes/pvpFlagHost.js`, `src/scenes/pvpRulesHost.js`, `src/scenes/pvpGuardsHost.js` - wiring
- `src/ui/pvpHud.js`, `src/ui/pvpSkull.js`, `src/ui/nameCone.js`, `src/ui/pvpVillainBar.js` - what the player sees
- `server-account/src/villainy.js`, `server-account/src/wild.js` - the kept meter and the reward
- `test/net/pvpvitals.test.js`, `test/ui/pvphud.test.js`, `test/net/pvpkey.test.js`

## Open

- Set and sky guard powers are not read between players; Vigil, Divine Grace, Hist-Sap, Unyielding and kill effects
  need the relay to keep a heal or count.
- Armour and resistances are still the client's word, not the relay's.
- A villain's guards are this client's NPCs; the hunt is not shared.
