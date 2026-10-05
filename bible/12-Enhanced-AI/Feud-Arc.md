# Feud - blows with weight, revenants with memory (FEUD, 2026-10-04 - TELL1-TELL9, AUDIT TELL, RVN1-RVN13, AUDIT FEUD, FEUD BALANCE, AUDIT FEUD 2, FEUD WIRE and FEUD HARNESS built; merged up to main 2026-10-05)

Mac, 2026-10-04: *"I want to improve the revenant system to be more complex, less easy to accomplish and more detailed.
Would love some ideas. I also want to improve the enemies telegraph/wind up attacks because player's can easily stun
these enemies and breath more depth into it"*; then, on the sixteen ideas offered: *"Let's do everything in a proper
detailed arc. I want this to be perfect and insanely detailed"*.

**Status: DESIGNED 2026-10-04 - Mac: "Go" on every call of section 31, each as recommended. Built slice by slice
(section 30's order; TELL7 before TELL6, TELL6 shape by shape) - TELL1 to TELL9 built (TELL6 in five parts), AUDIT
TELL, RVN1 to RVN6, RVN7 in four parts (RVN7a the lair, RVN7b the rumour, RVN7c the map and the journal, RVN7d the lair stand), RVN8, RVN9, RVN10, RVN11 in three parts (RVN11a loyalty, RVN11b desertion, RVN11c betrayal), RVN12 in two (RVN12a the words, RVN12b the page and the card), RVN13, AUDIT FEUD (its balance table measured three of RVN's targets missed - section 31's OPEN 22-24) FEUD BALANCE (Mac's calls on them, built), AUDIT FEUD 2 (both read again; the duel harness made faithful to the pools - every target of section 28 holds), FEUD WIRE (a revenant's blows - its rank's, wrath's, night's, last stand's and signature's - reach a peer; relay world165) and FEUD HARNESS (the harness fights its band and its flight - every target still holds; a fault it found fixed); THE MERGE OF MAIN (2026-10-05: one aim law with AUDIT ARENA-LADDER's bout-mates, the shapes' and TELL7's whole set's one home in the relay's leaf, the four wire changes one version - relay world170); each slice's record is at the foot.**
Two halves that lean on each other. **TELL** (TELL1-TELL9) gives a foe's telegraphed blow weight: poise, a body that
winds up, a cost for missing. **RVN** (RVN1-RVN13) gives a revenant a memory of how it was beaten, a secret, a last
stand, a name for its worst blow, a band, a lair, and a reason to fear leaving it alone. The predecessors are
`12-Enhanced-AI/Tactics-Arc.md` (TACT4, the telegraphed blows) and `06-Systems/Revenants.md` (the revenants as shipped
2026-10-02). Neither is rewritten here: each slice that changes a law they record edits that record in the same commit
(RETIRING A FLAG DELETES THE SENTENCE).

Every claim about today's code was read off the tree at `64f0a4ec` on 2026-10-04 - four read-only passes (the player's
blow and the foe's hurt; the foe's body, ear, ground and wire; the revenant's spawn, damage and fate; the revenant's
world, words and pages) and a spot check of each claim this page leans on - and is cited by module and function, never
by line, so it survives the next merge.

Marks: **FACT** (read in this tree), **MEASURED** (computed from the tree's own constants), **OPEN n** (a call in
section 31). Everything else is the proposal.

---

## 0. The change on one page

**TELL - a telegraphed blow is a commitment for both sides.**

- **Poise.** A foe winding up holds through light blows. Damage landed during the wind-up fills a poise meter sized by
  its weight and its kind's health; a heavy weapon, a blow at its back or its weakness fills it faster. Full, it
  BREAKS: the wind-up shatters and the foe is STAGGERED (about a second: helpless, taking 25% more). Today one landed
  hit of anything cancels any wind-up, for free.
- **The body tells.** The wind-up is the foe's own swing, held at the raised arm, the strike landing on the mark's
  flash; a glint on the body as it begins and again in its last 0.2 s; a sound as it begins and a whoosh just before it
  lands. The ground mark takes the world boss's readable line.
- **Iron blows.** Some blows (a giant's slam, an elite's third, a revenant's signature) are red, hatched and
  unbreakable: they must be dodged.
- **Missing costs the foe.** A blow that finds no one leaves its foe overreached for about a second - open, taking 30%
  more, and the first blow landed staggers it. Leaving the shape in its last quarter-second is a perfect dodge: a
  longer window.
- **Patterns.** Wind-ups vary in length, lunges track for their first half, blade-masters feint (a feint never glints:
  the glint is the honest tell), brutes chain two blows.
- **New shapes.** The ring (safe at its feet), the charge (a gap-closer from range), the leap (a disc at your feet), the
  archer's aimed shot (a line you can step off). Landings do something: a lunge pushes, a sweep bleeds, a slam rattles,
  an iron slam knocks you down.
- **Who and how often.** Champions and revenants telegraph at any level; elites and revenants more often.
- **Online.** A wind-up rides the foe stream; peers see it, and a foe can wind up at a peer, each player judging their
  own feet.

**RVN - a revenant remembers, hides something, and fights for its life.**

- **It remembers how it was beaten** and comes back adapted: mail against your blades, warded against your fire,
  arrow-wise against your bow, patient against your dodging - at most three, never immunity.
- **It has a weakness** (an element, a metal, a weapon, the daylight), hidden until struck, hinted by its own flinches
  and by rumour. Struck, it takes 50% more and staggers twice as easily.
- **Its will must be broken.** From rank 3 a revenant kneels only if, in that fight, its weakness was struck or it was
  staggered twice (FEUD BALANCE, OPEN 22: once - or a perfect dodge of its blow). Otherwise, at the killing blow, it
  escapes - ranked up, and adapted again.
- **The last stand.** From rank 3, the first killing blow instead brings it roaring back (35-55% health - FEUD BALANCE: 30-40%, a ring burst,
  faster, harder, ember-lit) - once a stand.
- **A signature blow** from rank 2, named for it ("Grushnak's Skullsplitter"), iron from rank 3.
- **A band** from rank 2: one to three of its kin, who scatter when it falls.
- **The hunt.** Each revenant has a lair - a named dungeon near where it was made. Townsfolk talk about it; heard of,
  the lair is marked on the map and in the journal; walk in and it is there, resting.
- **It takes something.** Online, the revenant that kills you takes one unlocked piece; kill it or spare it to get it
  back.
- **It festers.** Left past its due day, it grows; three times over, it ranks up on its own.
- **New deeds.** A special foe that knocks out your companion, or that you run from, becomes a revenant too.
- **The sworn have loyalty.** Kept well they are devoted; neglected, they desert; the worst of them, under ten, may turn
  on you when you are near death.
- **The page shows it all** - learned habits, weakness, will, signature, band, lair, what it took, its festering - and
  the card speaks every new moment in its own voice.

Off is as before: with the Enhanced AI switch off, no TELL rule runs (DFU's motor to the bit); with the Loot rarity row
off, no RVN rule runs (no revenant exists). The RVN rules that need a telegraph (the signature, the last stand's burst)
wait for the Enhanced AI switch; the rest work without it (section 2.1).

---

## 1. The problem, stated whole

### 1.1 The tells

1. **One landed hit cancels any wind-up, and costs the foe nothing but its cooldown.** FACT: `ai/tactics.js
   windupTurn` breaks a wind-up on `skipped || ai.canAct === false || ai.hurtKnock || ai.knockbackSpeed > 0`. Every
   landed weapon hit on a weighted monster, and on a class foe not already reeling (`formulas.weaponKnockbackApplies`),
   writes knockback in its pool's damage door (`exteriorFoes.js damageFoe`, `cityGuards.js damageGuard`,
   `dungeonContext.js damageFoe`), and `combat/formulas.js weaponKnockbackSpeed` floors at
   15 classic units, three times `KNOCKBACK_HURT_THRESHOLD` (5). Combat.md's C15 says it outright: "every landed player
   hit clears the 5-classic hurt threshold". The broken blow goes on its 8-15 s cooldown (`BLOW_COOLDOWN_MIN/MAX`) and
   the foe fights on.
2. **One swing always fits inside a wind-up.** MEASURED: the wind-ups are 0.7 / 0.8 / 0.9 s (`ai/blowShapes.js
   BLOW`); the player's melee blow lands at `HIT_FRAME_MELEE` (2), two frame ticks after the press, at
   `SWING_BASE_FRAME` (195/980, about 0.2 s a frame at Speed 50) - about 0.4 s. A player who swings when the mark
   appears always interrupts.
3. **The body does not tell.** FACT: through a wind-up `windupTurn` sets `ai._tacStrike = false; ai.moving = false`,
   and the sprite plays IDLE. The swing begins only at the landing (`characters/enemyAttack.js`, the forced
   `_blowSwing`), so the sprite's strike frame (the `-1` in its kind's `primaryAttackAnimFrames`) comes 0.2-0.3 s after
   the ground's flash. No sound marks the wind-up; the attack sound plays at the strike edge, and only half the time
   (`EnemySoundSource.attack`, `ATTACK_SOUND_THRESHOLD`). The only tell is the ground.
4. **The foe stands still and idle through it**: a free, stationary target.
5. **Dodging earns nothing.** A blow that misses is followed by TACT2's ordinary RECOVER beat, exactly as one that
   lands.
6. **Narrow patterns.** Three shapes, one fixed length each, no tracking, no feints, no follow-ups.
7. **Tier gaps.** FACT: `ai/foeBlows.js blowTier` is `level >= 10 || elite || eliteFoe`. A champion
   (`systems/champions.js`, `entity.champion`) never passes it below level 10; elites (`entity.eliteFoe`) are
   online-only (`eliteFoes.elitesAllowed`); and most revenants miss it - a monster revenant keeps its kind's level
   (Grizzly 4, Spider 4, Orc 5, Werewolf 6, Orc Sergeant 7, Wereboar 8, Skeletal Warrior 9), a class revenant stands at
   the player's level + 2 a rank. Meaner Monsters rewrites levels too (its Orc is 6).
8. **No defence but walking out.** FACT: the player has no block, parry or dodge - the Shield Widget's
   `blockCoroutine` runs after the damage is decided and changes nothing - so leaving the shape is the whole answer, and
   every shape is small. MEASURED: a lunge's lane is 1.2 m wide and a slam's disc 4 m across a metre ahead, against a
   walk of about 4.4 m/s at Speed 50 (`player/motor.js walkSpeed`).
9. **Online, nobody else sees it.** FACT: a wind-up never rides the foe stream, and a blow is only ever at the local
   player (`tactics.js`, the `key === LOCAL` gate; TACT4's record).

### 1.2 The revenants

1. **A rank is a stat stick.** FACT: `revenant.js applyRevenant` multiplies health by 1 + 0.25 a rank and blows by
   1 + 0.1 a rank. It fights the same way at rank 5 as at rank 1.
2. **Every one ends kneeling.** FACT: `revenantFate.js revenantMayYield` - any killing blow (but Disintegrate's) on a
   living, unsworn revenant of mine yields it. Every revenant ends at the kill-or-spare choice, and the trophy
   (Legendary 12% + 5% a rank above the first) is rolled at the yield.
3. **It never learns.** Nothing records how the player fought it; nothing it does depends on it.
4. **It finds you, never the reverse.** FACT: it returns only on an open-world encounter roll (`world.js
   runEncounterTick`, `revenantToReturn`, 50% of the hits), never in a dungeon (`dungeonContext.js buildFoeAt` has no
   revenant arm), and the player cannot seek it.
5. **Many cannot telegraph** (1.1.7), so the arc's best fights skip its best tool.
6. **It is alone.** One foe a return.
7. **Ignoring it is free.** A due revenant waits forever at the same rank.
8. **Two deeds only.** It kills you, or it runs and gets away (5%, 15% for a revenant already) - nothing about your
   companions, nothing about you running.
9. **The sworn are furniture.** A spared revenant's personality colours its words and nothing else.
10. **Two stale lines in its record**, corrected with this proposal (section 32): `Revenants.md` put its pages on the
    Stats rail (both moved to the Holdings tab with HOLDINGS, 2026-10-03 - `ui/enhancedMenu.js pauseHoldings`), and
    named its relay `world144` / `world152` (the branch-era numbers; it shipped as `world153`,
    `test/relayversion.test.js`).

---

## 2. Laws that bind every slice

### 2.1 The two switches

| | Enhanced AI off | Enhanced AI on |
|---|---|---|
| **Loot rarity off** | DFU: no telegraph, no revenant | TELL only (no revenant exists) |
| **Loot rarity on** | RVN without telegraphs: adaptations, the weakness, the will (broken by the weakness alone - there is no stagger), the last stand (its health and roar, no burst), the band, the hunt, the theft, festering, the deeds, loyalty. No signature (the page says "with Enhanced AI") | everything |

TELL reads `tactics.tacticsSwitchOn()`; RVN reads `revenant.revenantOn()`. Off, a slice's helpers answer the classic
value, as TACT4's do; TACT2's five-foe seeded pin and C15's knockback pins hold unchanged with the switch off.

### 2.2 DFU's laws kept

- Outside a wind-up, DFU's knockback is untouched: the speed, the floor, the gate (the weight-0 spectrals take none),
  the decay, CanAct and the Hurt it drives (Combat.md C15).
- Paralysis is DFU's CanAct, and it stops everything here, iron blows included (OPEN 4).
- The wind-up is the port's own beat. Its DFU analogue is an attack already begun, which DFU's MobileUnit will not let
  Hurt interrupt (`mobileUnit.js update`: hurt is refused while the state is attack; DFU's EnemyMotor gates Hurt on
  "state != PrimaryAttack"). Poise carries that rule one beat earlier, behind the switch.
- Everything in this arc is the port's own (Ledger A).

### 2.3 The house rules, applied

- **Four hosts.** Each slice's record names `scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js` and
  `scenes/dungeonContext.js`, wired or FLAGGED by name - and the pools they run (`exteriorFoes.js` for the streets and
  the buildings, `cityGuards.js` for the watch, the dungeon's own). The single-location host `scenes/exterior.js`
  builds its pool with no `fates` today, so its revenants die outright; FEUD flags it in every RVN slice rather than
  widening it (section 32).
- **One home per number.** The shapes' numbers in the leaf `ai/blowShapes.js` (the renderer imports it and the brain
  must not ride the boot graph - `test/boot2.test.js`); every other TELL number on one table in a new leaf beside it;
  every RVN number at the top of `systems/revenant.js` or its new sibling.
- **Two clocks.** Every TELL timer reads the brain's clock (`ai/tacticsClock.js tacticsNow`); every RVN day reads the
  character's (`worldTick.ownMinutes`, through `revenant.js nowMinutes`).
- **Draws.** A record's identity draws (its weakness, signature, band, lair bearing) run on its id's side stream
  exactly as its name does (`revenantGivenName`: DFRandom seeded by the id, the shared seed restored) - one id, one
  answer, on every client and every load. A fight's draws (a feint, a chain, a wind-up's length) are the brain's
  unseeded `Math.random`, as `BLOW_CHANCE` is.
- **The record's one gate.** `revenant.js sanitize` keeps only the fields it validates; a field not added there is lost
  on the next save, mirror read or merge. Every new field enters there with a validator and, where an older record
  lacks it, a value derived from its id (the `personality` precedent).
- **Fair by construction.** Nothing new deals harm without a tell; every telegraphed blow is dodgeable by moving; every
  adaptation has an answer (another weapon, another element, the weakness); nothing grants immunity.
- **Pins first.** Every slice lands its pins red and mutation-checked (A PIN MUST FAIL), built from the real producers
  (`spawnFoe`, `buildFoeAt`, `revenantDeed`) - TEST THE SHAPE THE PRODUCER MINTS.

---

## Part A - TELL: blows with weight

## 3. Poise and the stagger (TELL1)

### 3.1 The meter

- **Poise** `P` is set when a wind-up begins:

  `P = H0 x W(weight) x S(special)`

  - `H0`: the foe's maximum health as its kind stood it - after DFU's roll, Meaner Monsters and the strong-player
    scaling, before any special multiplier. Each multiplier that raises `maxHealth` (`eliteFoes.promoteEliteFoe`,
    `champions.applyChampion` and its Stalwart, `dungeonContext.applyEliteScaling`, `revenant.applyRevenant`) also
    multiplies a new `entity.healthMult` (absent = 1), so `H0 = maxHealth / healthMult` in every pool with no second
    record.
  - `W`, by DFU's weight (`formulas.enemyWeightClassicUnits`: the kind's `weight`, or 350 a man and 240 a woman for a
    class foe, plus kit):

    | Class | Weight | W | Examples (FACT, `enemyBasics.js`) |
    |---|---|---|---|
    | light | under 200 | 0.20 | Rat 2, Giant Bat 80, Skeletal Warrior 80 |
    | medium | 200-699 | 0.30 | Spider 400, Orc 600, Daedroth 400, Vampire 400, Lich 300, every class foe |
    | heavy | 700-1499 | 0.40 | Orc Warlord 700, Fire and Frost Daedra 800, Grizzly 1000, the atronachs 1000, Daedra Lord 1000 |
    | massive | 1500 and up | 0.50, and never under 60 (AUDIT TELL) | Giant 3000, Zombie 4000 |

  - `S`: an elite (`eliteFoe`) 1.5; an Elite Dungeon foe (`elite`) 1.25; a champion 1.25 (Stalwart 1.5); a revenant
    1 + 0.1 a rank (and its adaptations, 13.2).
  - AUDIT TELL (section 28's harness): a MASSIVE foe's `H0 x W` is at least `POISE_FLOOR_MASSIVE` 60, before `S`. A Giant
    rolls 18 to 74 health, so 0.5 of it left the weak rolls' poise at 9 - under the largest single front blow in the
    game (a daedric warhammer at Strength 100: 34 x 1.725 = 58.6), and under a reference player's steel one (31). The
    mass is the kind's, not the roll's: no single front blow breaks one now; two good ones, a party, the back or a
    weakness still do.

- **A blow's weight** `v` on the meter, for every blow that lands during the wind-up:

  `v = d x K(blow) x B(back) x X(weakness)`

  - `d`: the blow's final damage - after either core and the tail (`formulas.calculateAttackDamage`), so armour,
    crits and every mod are in it.
  - `K`: blunt 1.5, axe 1.25, long blade 1.0, short blade 0.7, hand-to-hand 0.6 (a werebeast's claws 1.0); a
    two-handed weapon x1.15 on top; an arrow 0.5; a spell's landing 0.75 (its later rounds 0); a companion's or a crew
    hand's blow by the same table from its weapon.
  - `B`: 1.5 when the striker stands more than 110 degrees off the foe's locked facing (TACT's `BACK_TURNED_DEG`).
  - `X`: 2 when the blow is the revenant's weakness (14.1).

- The meter fills from every source: my blows, arrows and spells; my companions and crew
  (`hostCombat.applyDamageToNonPlayer`); and peers' relayed blows (10.4). It is reset when a wind-up begins and spent
  at its landing. **Outside a wind-up there is no meter** - DFU's knockback, as today.
- **During a wind-up a landed blow** takes its health and flashes the foe red (`hitFlash.foeHitFlash`, driven by
  health) but writes **no knockback** and plays **no Hurt**: the damage door asks a new `windupHolds(ai)` before it
  writes `knockbackSpeed`, and keeps the speed it would have written for the break. A paralysis still breaks (2.2).
- Solo, one swing lands about once a wind-up (1.1.2), so in practice P decides **which single blows break**: a heavy
  blow, a blow at the back, a weakness. Accumulation is the party's and the fast weapon's: companions, peers, and a
  Speed-100 dagger (two swings in 0.9 s at `SWING_FRAME_MIN`).

### 3.2 The break

- At `sum v >= P` the wind-up is cancelled (`setLiveBlow(ai, null)`; the mark shatters - a white flash out over
  0.25 s), the blow's cooldown starts, the melee token is handed on, and the foe is **STAGGERED**:
  - for `STAGGER_S`: light 1.4 s, medium 1.2 s, heavy 1.0 s, massive 0.8 s;
  - the breaking blow's withheld knockback is written at x1.5 (the store cap, `KNOCKBACK_STORE_CAP`, still clamps it);
  - `canAct` false for the length (the motor's `_step`, beside paralysis); the brain's state `staggered` (no wind-up,
    no token, no swing), then TACT2's RECOVER;
  - the Hurt animation held and looped at its own 4 fps, the held swing cancelled (4.1);
  - every blow it takes x1.25 (`STAGGER_TAKEN`), through one new named registry - `registerBlowTakenMod(name,
    fn(attacker, target, weapon, info))` in the leaf `systems/blowTaken.js` - read at the tail of
    `calculateAttackDamage`, after `damageScale` and mentor mode and before the strike listeners (so they report what
    landed), and at a spell's landing in `hostMagic.applySpellToFoe`. The registry is new because
    `entityMods.registerWeaponBlowMod` sees weapon blows only, not hands or spells; a leaf because the brain registers
    into it and the formulas, which read it, import the motor, which imports the brain;
  - **no stunlock**: no new stagger for `STAGGER_IMMUNE` (3 s) after one ends; inside it, a broken wind-up just breaks.
- **The feedback.** A stagger: the Weapon Widget's clang spark at the chest (`hitEffects.showMissEffect('clang')`, at
  2.5 times its size), `SOUND.Hit2` and the foe's own bark at pitch 0.7 (a person's voice stays DFU's - the watch's
  alone speaks), a small camera kick for the player's own blow (the host's `shake`, 0.6); the hit number's tag
  "Stagger" is TELL9's. A blow that **holds** (lands, no break): the target bar's poise track fills
  (11.1), the tag "Holds", and the parry ring where its kind has `parrySounds`.

### 3.3 Where it is written

The law: `ai/tells.js` (the table, the weight classes, poise, a blow's class and weight). The brain: `ai/tactics.js`
(`windupHolds`, `windupStruck` - the meter, the break, the stagger - and the `staggered` state's exit to RECOVER). The
doors: the three damage doors ask one law, `scenes/hostCombat.js windupDoor`, where each writes DFU's knockback, and the
foe-vs-foe payload (`applyDamageToNonPlayer`) writes no knockback on a foe winding up. The motor:
`characters/enemyMotor.js _step` (the stagger's CanAct). The tail: `combat/formulas.js`, through `systems/blowTaken.js`.
Four hosts: all four run these pools (the interior's foes are the street's pool, `worldModes.js makeInteriorFoes`);
nothing is host-local but the routes into the watch's door (the arrows' kind, the spell sinks' rounds).

## 4. The tell: body, ear and ground (TELL2)

### 4.1 The held swing

- **The wind-up is the swing, held.** At the wind-up's start the brain raises the forced swing it raises at the landing
  today (`enemyAttack.js`, the `_blowSwing` path), with a new `ai._blowHold = true`. The sprite enters its attack,
  plays its frames up to the frame before its first `-1`, and **holds there** - the raised arm - while the hold stands:
  `MobileUnit._stepFrame`'s attack branch does not consume a `-1` while the host passes `hold`. At the landing the
  brain clears it; the next frame step (0.1 s at the attack's 10 fps) consumes the `-1`, `doMeleeDamage` is raised,
  and the host resolves it against the verdict as today (`blowConnects`, within `BLOW_VERDICT_LIFE`).
- The attack variant is rolled once, at the start (`rollAttackFrames` in `_change('attack')`), so the held frames and
  the struck frames are one variant. A list whose first entry is `-1` holds frame 0.
- Two strikes in one list (the Giant's `[0,1,-1,2,3,4,-1,5]`, the Daedra Lord's, a class foe's): the verdict and the
  weight ride the first `-1`; the second is a plain DFU blow with DFU's reach test (`blowConnects` spends the verdict
  once - unchanged).
- **Cancelled** by a break (to Hurt) or a paralysis (to idle) through the hold's third word, `'cancel'` (as built: the
  host passes it, `MobileUnit.update` drops the held swing to idle - the Hurt gate refuses to override an attack, so a
  cancel must be explicit) - and the attack component's one-shot state reset with it.
- The swing's strike edge moves to the start with the swing, and its sound is the WIND there (4.3); the landing keeps
  the verdict, the `-1`, the damage and the LAND.
- **Puppets** (TELL8): the held frame is drawn host-side, `MobileUnit.heldPose('attack', k)` over `f._mout` beside the
  puppet's other held poses, `k` the frame before the first `-1`.

### 4.2 The glint

- A new per-batch `uGlint` (a colour and a strength) in both billboard programs (`render/renderer.js` `BB_FS` and
  `render/enhancedLighting.js` `EL_BB_FS`), uploaded on change in `drawOne` beside `uHitFlash` and reset with the
  frame's other batch uniforms; `batch.glint` written where each pool writes its batch state (`exteriorFoes.js
  batches`, the dungeon's, the watch's). Not `batch.tint`: a multiply cannot lift a black texel, and the Enhanced
  Lighting lane decodes it.
- It lights the sprite's outline with the elite rim's texel test (`hitFlash.ELITE_GLOW_GLSL`), so the pad that widens
  the quad must upload for a glint as well as for an elite (today `drawOne` sends it only when `eliteGlow != 0`).
- **The curve**: a pulse to 0.9 over 0.15 s at the start; a steady 0.2 rim through the wind-up; a rise to 1.0 through
  its last `TELL_NOW` (0.2 s) - "now". The colour is the blow's: amber, iron red, a revenant's ember for its signature.
- **Reduced motion** (the system's `prefers-reduced-motion`, read as `ui/revenantCard.js` reads it): a steady 0.45 rim
  through the whole wind-up, no pulses.
- **A feint never glints** (7.3).

### 4.3 The ear

The world boss's cue order (`world/gateBoss.js` `BOSS_CUES` and `hostCue`; `gateCourt.js cue`), each once a wind-up,
through `hostCombat.playEnemyClip` so DFU's hearing distance holds:

- **WIND** at the start: the kind's `barkSound` at pitch 0.85; a class foe (muted by DFU's `ignoreHumanSounds`) a
  quiet `SOUND.SwingMediumPitch` at pitch 0.6.
- **RELEASE** `TELL_RELEASE_LEAD` (0.25 s) before the landing: `SOUND.SwingLowPitch` at pitch 0.45 (the boss's
  release, at 350 ms, scaled to a foe's shorter wind-up).
- **LAND**: the kind's `attackSound` at the `-1`, always, for a telegraphed blow (DFU's 50% roll stays on its plain
  swings).
- A feint plays no WIND (7.3).

### 4.4 The ground

- The mark keeps its law (`render/foeTelegraph.js`, the shapes pinned to `inBlow` point for point) and takes the world
  boss's readable style (`render/gateTelegraph.js`): a 2-px line with a dark keyline (screen-space `fwidth`), the fill
  growing through the wind-up, a brighten in the last 0.2 s, a white-hot landing fading out. The styling moves into an
  import-free GLSL leaf that the foe's pass composes (OPEN 20 asks whether the boss's pass adopts it too);
  `gateTelegraph.js` imports the boss's brain, so it is never imported whole.
- **The blend** moves from additive (ONE, ONE) to the boss's (ONE, ONE_MINUS_SRC_ALPHA): additive cannot draw a dark
  keyline, and a pale fill vanishes on snow and sand (OPEN 20).
- **Near is never lost.** Fog dims the mark as it dims the ground (AUDIT TACT D9), but a wind-up aimed at me within
  6 m draws at no less than 60% (`TELL_NEAR_FLOOR`) - a dungeon's black fog swallows a mark a step away.
- `tools/foeTelegraphProbe.mjs` gains the keyline, the brighten and the near floor.

## 5. Iron blows (TELL3)

- Every blow has a **guard**: `poise` (amber, `BLOW_COLOR`) or `iron` (red, `[1.0, 0.12, 0.08]`).
- **Iron takes no poise.** Blows land; nothing breaks it but a paralysis (OPEN 4). Its knockback stays withheld, as
  under poise.
- **Who throws iron**: the slam and the ring of heavy and massive brutes; a revenant's signature from rank 3 (16.1);
  one blow in three from an elite; one in two in a last stand (15.2) and from a Steadfast revenant (13.2).
- **Never by colour alone**: the iron mark has a second rim 0.25 m inside the first and a diagonal hatch in its fill;
  its glint is red; the target bar says "Iron" (11.1).
- **Longer, and costlier to miss**: an iron wind-up is `TELL_IRON_EXTRA` (0.2 s) longer, and its missed landing opens a
  window 0.3 s longer (6.1).

## 6. The punish window and the perfect dodge (TELL4)

### 6.1 Overreach

- A telegraphed blow whose verdict is **false** - the feet outside the shape at the landing - leaves its foe
  **OVERREACHED** for `PUNISH_S`: lunge 1.0 s, sweep 0.8, slam 1.2, ring 1.0, charge 1.4, leap 1.2; iron +0.3.
- Overreached: `canAct` false (the stagger's lock); the attack's last frame held (the world boss's `SPENT_FRAME`
  precedent); every blow it takes x1.3 (`PUNISH_TAKEN`, the same registry); and **the first blow that lands staggers
  it** (3.2's law, `STAGGER_IMMUNE` respected) - the dodge-and-answer loop. It keeps its melee token through the
  window; then TACT2's RECOVER hands it on.
- Bounded: the longest lock one missed blow buys is `PUNISH_S` + `STAGGER_S` (an iron charge's 1.7 s and a light
  foe's 1.4 s: 3.1 s), then 3 s of `STAGGER_IMMUNE` and the blow's cooldown.
- A blow that **lands** recovers as today.

### 6.2 The perfect dodge

- The brain samples the target's feet once, `TELL_LATE` (0.25 s) before the landing (the first classic tick, at 16 Hz,
  to pass the moment). **Inside then and outside at the landing** is a perfect dodge: the window x1.5, the tag
  "Perfect", a bright parry ring (`SOUND.Parry6`).
- No skill tally beyond DFU's own (the Dodging tally on every resolved foe attack, unchanged).

### 6.3 At a peer

The owner cannot see a peer's verdict (10.3); it overreaches by its own view of the peer's feet at the landing. A
disagreement opens or withholds a window - never damage, which is the struck peer's own judgement.

## 7. Patterns: length, tracking, feints, chains (TELL5)

### 7.1 Length

Each wind-up's length is its shape's x U(0.9, 1.25), drawn at its start; an elite's x0.9; a revenant's
x(1 - 0.03 a rank); a last stand's x0.85; iron's +0.2 s after; never under `TELL_MIN_WINDUP` (0.55 s). The fill runs on
the drawn length, so the mark always tells the truth.

### 7.2 Tracking

A lunge and a charge turn toward the target's feet at up to `TRACK_RATE` (120 degrees a second) through the first
`TRACK_SHARE` (0.5) of the wind-up, then lock; the mark turns with them (a Patient revenant tracks to 0.7). A sweep, a
slam and a ring lock at their start; a leap's point locks at its start. A sidestep the moment the mark appears no
longer beats a lunge.

### 7.3 Feints

- **Who**: the blade family (TACT4's `BLADE`) of the higher tier - an elite, a champion, a revenant of rank 2 or more;
  never an ordinary level-10 foe.
- **How often**: one wind-up in five (`FEINT_CHANCE`; a Patient revenant one in three); never two feints within three
  wind-ups.
- **What**: the mark fills to `FEINT_AT` (0.55), then the foe cuts it and swings a plain DFU blow at once - DFU's
  damage, DFU's reach test, no weight - and the mark fades out dashed over 0.15 s.
- **Readable**: a feint has no glint and no WIND. The glint and the cue are the honest tell; a player who watches the
  body is never fooled.

### 7.4 Chains

- **Who**: brutes and elites of the higher tier; revenants of rank 3 or more.
- **How**: at a landing (hit or miss), with `CHAIN_CHANCE` (0.35), a second blow winds up at once from the new facing,
  `CHAIN_WINDUP` (0.5 s, floor 0.45) long, a different shape of the foe's own (a sweep then a lunge; a slam then a
  sweep; a ring then a slam). A last stand chains up to three.
- The punish window opens only after the chain's last blow; a break ends the chain. One chain is one blow for the
  cooldown, and for "one wind-up near the player at a time".

## 8. New shapes, and what a landing does (TELL6)

### 8.1 The shapes (all in `ai/blowShapes.js`)

| Shape | Geometry | Wind-up | x damage | Thrown by | Its point |
|---|---|---|---|---|---|
| lunge | lane 4.5 m x 1.2 m ahead | 0.7 s | 1.5 | beasts, blades | tracks (7.2) |
| sweep | cone r 3.2 m, +-65 degrees | 0.8 s | 1.25 | blades, brutes | |
| slam | disc r 2 m, 1 m ahead | 0.9 s | 1.75 | brutes | iron on heavy and massive |
| **ring** | annulus 1.6-4.0 m about its feet | 1.0 s | 1.5 | massive brutes, the atronachs, the Daedra Lord | **safe at its feet**: the hug answers it |
| **charge** | lane 9 m x 1.6 m; the foe crosses it in 0.45 s | 0.9 s | 1.5 | Grizzly, Sabertooth, Wereboar, Centaur, Orc Warlord | from 5-12 m: the gap-closer |
| **leap** | disc r 1.8 m at the target's feet, up to 9 m off | 1.0 s | 1.6 | Spider, Werewolf, Sabertooth, Vampire | needs a clear line and ground under the point |
| **aimed** | a line from the shooter to the target, 0.5 m wide | 0.6 s | 1.4 on the arrow | class archers holding a ranged token | the arrow's own flight decides |

- **The ring** answers the player who backs off: its safe ground is the foe's own feet.
- **The charge** answers the archer and the kiter. Begun only out of reach, by a foe holding a melee token, its lane
  free of the collider and of cover (`ai/cover.js`). At the landing the foe crosses the lane in its 0.45 s on a new
  motor drive (`_tacDash`: the collider's walk; a wall ends it in a skid); the verdict is swept between frames, once
  (`net/gateStrike.js chargeStrikes`'s law). A brain change: TACT4 only ever winds up in reach.
- **The leap**: the wind-up a crouch (the held frame), the landing an arc over 0.35 s to the point. Never a flyer.
- **The aimed shot**: one shot in three from a tier archer at the local player. The line locks at the start, and the
  arrow leaves along it at x1.3 speed and x1.4 damage (a new scale on the foe's missile). No `blowConnects`: stepping
  off the line is the dodge.
- Every new shape's field is mirrored in `render/foeTelegraph.js blowField` and pinned to `inBlow`; `uHalf` moves into
  the draw loop (a charge's lane would otherwise enlarge every quad); the probe gains each.

### 8.2 What a landing does to you

Only on a hit (a dodged blow does nothing), and only to the local player (each client applies its own, 10.3):

- **PUSH** (lunge 3 m/s, charge 5 m/s, decaying at 12 m/s/s): a new collision-respecting impulse on the player's motor
  (`player/motor.js`; its `carryBy` moves without collision, for decks). It stops at an edge with a drop of more than
  2 m - a push never throws anyone off a cliff.
- **RATTLE** (slam, ring, leap): 0.6 s at 60% of the walk, and a camera dip (the damage shake).
- **BLEED** (sweep): 30% of the blow's damage again over 3 s, in three ticks through `hurtPlayer` (the harm mark names
  the foe, so REVENANT-HARM credits a death to it); shown as an active effect with its icon; ended by any healing (a
  spell, a potion, a bandage) or a rest. `combat/bloodBleed.js`'s drips (cosmetic today) follow it.
- **KNOCKDOWN** (an iron slam, ring or charge - OPEN 6): 0.9 s down (the camera drops 0.6 m and rises), no move, swing
  or cast; 5 s before another.

## 9. Who telegraphs, and how often (TELL7)

- **The tier** (`blowTier`): level 10 and up, an elite (`elite`, `eliteFoe`), **a champion** (new), **a revenant at
  any level** (new).
- **The shapes by tier** (OPEN 8): an ordinary foe of the tier keeps TACT4's one or two (Mac's call, 2026-10-02); an
  elite, a champion or a revenant throws its family's whole set:

  | Family | Ordinary tier | Elite, champion, revenant |
  |---|---|---|
  | beast | lunge | lunge; charge (the chargers); leap (the leapers) |
  | brute | slam, sweep | slam, sweep; ring (massive brutes, atronachs, the Daedra Lord); charge (the Orc Warlord) |
  | blade | sweep, lunge | sweep, lunge; feints (7.3) |
  | archer | - | the aimed shot |
  | caster, spectral, small, flyer | - | a revenant's signature only (16.1) |

- **The cooldowns**: an ordinary foe 8-15 s; a champion 7-13; an elite 6-11; a revenant 8-15 x (1 - 0.08 a rank)
  (rank 5: 4.8-9); a last stand x0.7.
- **Still one at a time**: no wind-up while another foe's is live within `BLOW_NEAR` (20 m) of the player; a chain is
  one.
- **Meaner Monsters**: the tier reads the entity's live level, after its row.

## 10. Online (TELL8)

### 10.1 The record

- New optional fields on the foe record, each validated in `net/wire.js validFoeRecord`:
  - `wk`: the shape (0-6), +8 for iron, +16 for a feint;
  - `wy`: its yaw (as `y`);
  - `wl`: milliseconds to its landing (0-3000) - relative, because the brain's clock is each client's own;
  - `wo`: its origin (bounded as `f`); `wp`: a leap's point;
  - `ws`: 1 staggered, 2 overreached (the puppet's pose, and the peers' tail multipliers, 10.4).
- Written in `exteriorFoes.js foesFrame`'s record and its dedupe key, and in the dungeon's `roomRecord` and its key
  (the dungeon stream carries none of `z`, `nm`, `yd`, `ex`, `sp` today - FEUD adds only its own and FLAGS that gap,
  section 32).
- Read in `applyPuppetRecord` (and the dungeon's `applyFoeRecord`): `setLiveBlow(puppetAi, makeBlow(kind, wo, wy,
  tacticsNow() - (windup - wl / 1000)))`, fitted to the local collider, and **cleared when the field is gone** (a
  puppet has no `_tac.seen`, so `drawableBlows`' stale test never fires for it). The held pose and the glint come from
  the same fields.
- At `FOES_MS` (200 ms) a record arrives up to 200 ms late; `wl` absorbs it, and the mark starts part-filled.
- The relay fans foe frames unparsed, but `wire.js` is in its bundle: `RELAY_VERSION` bumps, with a new row in
  `test/relayversion.test.js` (one bump for TELL8 and RVN13 if they ship together).

### 10.2 Blows at peers

A brain change (OPEN 9): the owner's foe may wind up at a peer it targets (`key !== LOCAL`). TACT4 said "a blow is
only ever at the local player".

### 10.3 Each judges their own feet

The world boss's law (`net/gateStrike.js`): the struck client judges its own feet at the landing. A puppet whose
wind-up is at me sets its `_blowVerdict` and `_blowMult` from my feet at the landing, and its swing resolves through
`resolveFoeMeleeVsPlayer` -> `blowConnects` as a local foe's does. The landing's effects (8.2) are applied on the struck
client.

### 10.4 Poise from peers

- A peer's blow on my foe arrives as a number (`damageFoe(..., {peer: true})`). The relayed hit gains its blow's class
  (`wc`: its K row, the back flag and the weakness flag, judged on the peer's machine against the puppet), so the
  owner's meter weighs it; a hit without one weighs K = 1.
- `ws` carries the stagger and the overreach to peers, whose rolls against my foe (on their machine, against their
  puppet) take the same x1.25 and x1.3.

## 11. On screen (TELL9)

### 11.1 The target bar (Enhanced)

- A foe that winds up at me becomes the bar's foe (`ui/hudFoeTarget.js`, a new `markFoeThreat` beside
  `markFoeStruck`) unless I struck another in the last 2 s; today the bar follows only foes I struck.
- A **poise track** under the health: empty outside a wind-up; amber, filling toward P, during one; red with "Iron" for
  an iron blow; a white flash and "Staggered" at a break; "Open" through an overreach.

### 11.2 Words on the hit

`ui/hitNumbers.js` tags: "Stagger", "Holds", "Open", "Perfect", "Weakness" (14.1).

### 11.3 Reading it

- A **Telegraph contrast** preference beside the Enhanced AI switch: thicker lines, a white keyline, a pattern for every
  guard.
- Reduced motion honoured (4.2); the iron hatch always (5).
- The Enhanced AI switch's Features note gains its line.

---

## Part B - RVN: revenants with memory

## 12. The ledger of wounds (RVN1)

- **A fight's ledger**, `entity._feud` (RVN1, as built: on the foe's ENTITY - every seam that writes it holds the
  entity, and the brain and the effects hold nothing else; `systems/feudLedger.js`, a leaf), opened on a revenant
  candidate (`revenantCandidate`) the first time anything is written for it:
  - `dmg`: what the player dealt, by `blade`, `blunt`, `axe`, `h2h`, `arrow`, `fire`, `frost`, `shock`, `poison`,
    `magic`, `other`;
  - `silver`: what the player dealt with silver;
  - `staggers`, `dodged`, `perfect`, `backHits`, `weak` (blows of its weakness) - from TELL1, TELL4 and 14;
  - `night` (begun at night: `worldClock.isNight` on the sky's minute), `place` (`street`, `building`, `dungeon`),
    `start`.
- **Written from**:
  - `formulas.registerPlayerStrikeListener` - every landed melee blow and arrow, with its final damage and its weapon
    (`weapons.weaponSkillUsed` for the class, `material` for silver, a bow for archery, none for hands);
  - `hostMagic.applySpellToFoe` (`spell.element`), and the later rounds - written in `effects.js runEffectRound`
    itself (RVN1, as built: the entry carries `element` and its caster, so the round notes it once for every host; no
    sink's options change);
  - the brain's overreach at me (`dodged`, `perfect`) and the poise door's word on my blow (`staggers`, `backHits`).
- **Folded at the deed** (`revenantDeed`, the one home the kill and both escape paths reach): the fight's leading
  source - 40% or more of the damage dealt (`SCAR_SHARE`) - is a **scar** (`scars`, the latest six, `{k, at}`); with
  none leading, `mixed`. `staggers >= 2`, `dodged >= 3`, `backHits >= 3`, a night fight and the deed itself add their
  own scars.
- The ledger dies with the fight; only the scars live on the record.

## 13. Adaptations (RVN2)

### 13.1 Learning

At each deed, the fight's leading scar becomes an **adaptation**, if it is not held already (RVN2, as built: one it
holds passes the lesson to the next of the fight's scars - `revenantFeud.lessonOf`). A revenant holds
`min(rank, ADAPT_MAX)` (`ADAPT_MAX` 3); past that, the oldest is forgotten. Never more than one learned a deed.

### 13.2 The table

| Adaptation | Learned from | What it does |
|---|---|---|
| Mailed | blades | blades x0.7 on it |
| Braced | blunt | blunt x0.75; poise x1.4 |
| Hewn-hard | axes | axes x0.7 |
| Unflinching | hand-to-hand | hands x0.6 |
| Arrow-wise | archery | arrows x0.7; +20 Speed while its target is past 8 m; the charge or the leap if its kind has one |
| Fireproof, Rimebound, Grounded, Venom-blooded, Spell-scarred | an element (never one its career already resists or is immune to) | +25 resistance to it (`entityMods.registerEntityFold`, read by `spellcast.savingThrow`) - RVN2, as built: +50 was immunity (the throw starts at 50 and answers 0 at 100, before its 95 cap); +25 is DFU's own Resistant |
| Silver-scarred | silver (40%) | its kind's silver double gone (only a kind that has one: DFU's Skeletal Warrior, PCAAO's six) |
| Steadfast | staggered twice in a fight | poise x1.5; one blow in two iron |
| Patient | three blows dodged in a fight | tracks to 0.7; feints one in three (a blade); wind-ups x U(0.85, 1.35) |
| Watchful | three back hits, or a backstab | never unaware (no backstab); no back multiplier on its poise |
| Relentless | you ran from it (21.2) | +25 Speed; never culled while it hunts the player |
| Night-stalker | it killed you by night | returns only by night; blows x1.15 by night |

- **Never immunity**: the least a weapon class falls to is x0.6, an element +25 (RVN2: +50 was immunity - see the
  table); nothing touches its weakness (14).
- **Where**: weapon classes through `registerBlowTakenMod('revenant')` (3.2's registry, keyed on `entity.revenant`);
  elements through `registerEntityFold('revenant')`; Speed on `stats.speed` at the stand (`applyRevenant`); the rest in
  the brain, read through `ai.vitals?.().revenant`.
- **Online**: a peer's blow on my revenant is rolled on the peer's machine against the puppet, so the puppet must carry
  them (`ad`, section 25).
- **Said**: its return's taunt names one ("I remember your arrows, {p}." - section 23's `{how}`).

## 14. The weakness and the will (RVN3)

### 14.1 The weakness

- **One a revenant**, drawn on its id's side stream from its kind's pool when its record is made (weights):

  | Kind | Element | Metal | Weapon | Daylight |
  |---|---|---|---|---|
  | undead | fire 3, magic 1 | silver 2 | blunt 2 | 2 |
  | daedra | its opposite 3 (a fire daedra frost, a frost daedra fire), shock 1, magic 1 | - | - | - |
  | atronachs | its opposite 3, shock 1 | - | blunt 1 | - |
  | werebeasts, vampires | fire 1 | dwarven 2 (silver is already their law) | - | vampires 2 |
  | beasts | fire 2, frost 1 | - | axe 1, arrow 1 | - |
  | orcs, giants | fire 1, shock 1 | elven 1 | arrow 1, blade 1 | - |
  | people | any element 1 | silver 1, dwarven 1 | blunt 1, axe 1, blade 1, arrow 1, hands 1 | - |

  Never an element its career resists or is immune to.
- **Struck**: x1.5 (a weapon class or a metal through `registerBlowTakenMod`; an element through the fold, at -50); its
  poise weight x2 (`X`, 3.1). A daylight weakness: x1.25 from every source while the sky reads day
  (`gameDate.DAWN_HOUR` to `DUSK_HOUR`).
- **Known** - `weakKnown`: 0 unknown; 1 hinted ("an element", "a metal", "a weapon", "the sun"); 2 known. Learned by:
  - **striking it**: the first blow of its weakness reveals it (the "Weakness" tag, a hiss; 2);
  - **its flinch**: under half its health with its weakness unknown, the card's narrator says what it shies from, once
    a stand ("It keeps its eyes on your torch." / "It flinches from the glint of silver.") - a table of fourteen lines,
    one a weakness, in no personality (1);
  - **rumour** (18.2): 1, or 2 one time in three.

### 14.2 The will

- **From rank 3 (`WILL_RANK`) its will must be broken.** It is broken in a stand when its weakness has been struck, or
  when it has been staggered `WILL_STAGGERS` (2) times (TELL1 or TELL4). FEUD BALANCE (OPEN 22, Mac 2026-10-05):
  `WILL_STAGGERS` 1, and a perfect dodge of its blow at me (TELL4's, the ledger's `perfect`) counts as a stagger.
- At the killing blow (after its last stand, 15), a revenant whose will is **unbroken does not kneel**. At 1 health it
  tears away - ash and smoke on the dissolve's ember lane (`systems/dissolve.js`) - through `escapeFoe` with the `fled`
  deed: it ranks up and learns from this fight. The card: "Grushnak staggers into the smoke, unbroken."
- Broken, it kneels as today: the choice, the trophy.
- Disintegrate's whole kill still kills (`_whole`).
- With the Enhanced AI switch off there is no stagger, so its weakness alone breaks it (2.1).
- The page tells the player the rule (24.1). OPEN 11.

## 15. The last stand (RVN4)

### 15.1 When

**Rank 3 and up, once a stand**: the first blow that would kneel or kill it brings it back instead. The seam is the line
before the yield in both damage doors (`exteriorFoes.js damageFoe`, `dungeonContext.js damageFoe`): a new
`revenantLastStand(f)`, ahead of the soul trap, so no soul is taken by that blow.

### 15.2 What

- **Health** to `LAST_STAND_HEALTH` of its maximum: 0.35 at rank 3, 0.45 at 4, 0.55 at 5 (FEUD BALANCE, OPEN 23: 0.30,
  0.35, 0.40).
- **The roar** (`LAST_STAND_ROAR`, 1.2 s): no blow reaches it (the held refusal the yield uses); the attack frame held;
  with Enhanced AI, an iron ring about its feet lands as the roar ends (8.1: push and rattle - AUDIT FEUD 2: as built, an
  iron ring rattles and knocks down, and pushes nothing: BLOW_EFFECT.PUSH is the lunge's and the charge's). Without it,
  the roar alone.
- **Phase two** for the rest of the stand: blows x1.2, +20 Speed, wind-ups x0.85, cooldowns x0.7, chains to three, iron
  one in two; lit by the elite lane's rim in an ember red (`eliteFoes.setBatchEliteGlow` with a revenant colour) and
  stood x1.1 (`eliteSize`'s precedent).
- **Rank 5**: its band's survivors run to it; with none left, two of its kin step out of a portal (`scenes/portalFx.js`)
  - within the pool's cap.
- **The card**: *Last stand*, and its words (23).
- **Online**: `p2` (25) - the glow and the size on puppets; FEUD WIRE: and phase two's x1.2 on a puppet's blows.
- **Risen as it runs** (FEUD HARNESS, the record at the foot): its run is over (`beginLastStand` ends the motor's
  `fleeLeft`, as a kneel and a tear-away do) - before, it ran on untargeted for the rest of its run, neither cornered nor
  escaped.

## 16. Signature blows (RVN5)

### 16.1 The blow

- **From rank 2** (`SIG_RANK`), each revenant has one **signature**, drawn on its id from the shapes its family reaches
  past its ordinary set: a blade a slam or a charge; a beast a charge or a leap; a brute a ring or a charge. A caster, a
  spectral, a small kind or a flyer gets **pyre** - a disc r 2.2 m at the target's feet, a 1.2 s wind-up, landing as a
  blast of the foe's own element (its career's school: a lich's frost, a fire daedra's fire) through
  `hostMagic.applySpellToPlayer` as a strike spell, so the player's saving throw and resistances answer it. It is the
  casters' first tell.
- **x2.0**; its own cooldown, 12-18 s; iron from rank 3; drawn in the revenant's ember with the iron pattern.
- **Called out** the first time a stand: the card's *Signature* kicker ("Grushnak readies Skullsplitter!") and a deeper
  WIND (pitch 0.7).
- **Needs** the Enhanced AI switch; off, the page says "(with Enhanced AI)".
- **As built (RVN5; the record at the foot)**: the pyre's element by its KIND, not its career (DFU's spell lists index
  SPELLS.STD, data read at run time, and the name the page draws with no body standing must be the one its stand calls
  out) - an atronach's own and an imp's fire, a lich's frost, the vermin's, a bat's, a spriggan's, the dead's and a
  fish's poison, a harpy's shock, any other's magic (a fire daedra and a frost daedra are blades: their signature is a
  slam or a charge). The blast goes through `hostMagic.strikePlayerFrom` (`applySpellToPlayer` with the foe's caster
  wrapper, so a reflection goes back at it). x2.0 is the signature's multiplier on its blow, in the shapes' own units
  (it replaces the shape's: a slam's x1.75 becomes x2.0). The ember lies between TELL's amber and its iron red, and is
  hatched only where it IS iron (rank 3 up) - the hatch is TELL3's word for "no stagger", and a rank-2 signature
  staggers. The pyre is wound up only at me (a peer's or a foe's is RVN13's - off the wire).

### 16.2 Its name

`<given>'s <noun>` (`revenantPersonality.possessive`), the noun drawn on its id from its shape's bank:

- slam: Skullsplitter, Gravefall, Anvil, Hammerfall, Bonebreaker, Mountainfall
- sweep: Widowmaker, Red Harvest, Reaping, Crescent, Scythe-Wind
- lunge: Heartseeker, Viper's Kiss, Spite, Last Word
- charge: Bloodrush, Stampede, Bull's Folly, Avalanche
- leap: Skyfall, Raptor's Drop, Pounce of Ruin
- ring: Earthbreaker, Quake, Ruin-Circle
- pyre, by element: Pyre, Rimefall, Stormcall, Blight, Unmaking

## 17. The band (RVN6)

- **From rank 2**: `RETINUE` followers by rank - none at 1, then 1, 2, 3, 3.
- **Its kin**, drawn on its id and kept on the record (`kin`): of its faction (`characters/mobileFactions.js
  factionOf` - orcs bring orcs, the undead their own, a beast its own kind); a person its class's family (a Barbarian
  brings Warriors and Barbarians; a Thief, Rogues and Burglars). A follower stands at its kind's level; a class
  follower at the player's level - 2.
- **Stood with it** in the camp pattern (`world.js _standCampEncounter`: placed about the anchor, one shared `campId`,
  so the band never fights itself), each marked `retinueOf = id`, within `MAX_ACTIVE_ENCOUNTER_FOES` (8; followers are
  trimmed first).
- **Ordinary**: never a champion or an elite (`champion: null`, `eliteFoe: false`); never a revenant
  (`revenantCandidate` refuses `retinueOf`); DFU's loot only.
- **Named** on the hover: "Grushnak's Warband" (by faction: Warband, Pack, Coven, Host, Crew, Brood).
- **Scatters**: when the revenant kneels, flees, dies or is executed, each follower breaks and runs (DFU's flee, 8 s)
  and is culled ("The warband scatters.").
- The tokens (2 melee, 2 ranged) keep the crowd readable. OPEN 13.
- **As built (RVN6; the record at the foot)**: stood by the street pool itself, beside its master - a camp member's
  ring about it (PlaceFoeFreely, 1 to 6 m, any bearing), not `_standCampEncounter`'s anchor 100-150 m out; the camp it
  shares is the entity's `campId` alone (the infighting exemption - no Overworld camp mark, no camp cull distance);
  transient (no save carries a follower, as none carries its master). The words: an orc's Warband, a beast's or a
  werebeast's Pack, the dead's and the fae's Host, vermin's and a fish's Brood; a person's by its family - a fighter's
  Warband, a thief's or an archer's Crew, a caster's Coven. The title "Orc of Grushnak's Warband" (`foeTitle`: the
  target bar and the body - HOVER-PLAIN names no hostile foe on the hover). The scatter runs from its master's feet,
  said by the narrator once a break ("The warband scatters.").

## 18. The hunt (RVN7)

### 18.1 The lair

At a deed in the open world, the lair is a **named dungeon in the 4-10 px ring** about the deed's map pixel - the bounty
boards' ring (`systems/bountyBoard.js bountyDungeons`, over the world host's named-dungeon index), the one nearest a
bearing drawn on its id - kept as `lair: {px, py, name, region}`. With none in the ring there is no lair: it roams. A
deed underground makes that dungeon its lair.

- **As built (RVN7a; the record at the foot)**: built in four parts (a the lair, b the rumour, c the map and the
  journal, d the lair stand). The host says where a deed is done through the player's door (`lairHere`). A lair once
  chosen is kept by a deed in the open world (the hunt the player was told of stays true); a deed underground moves it,
  and a lair moved is one the player has not heard of (`lairKnown` false). A graveyard's crypt may be a lair (its stand
  is underground).

### 18.2 Rumour

- "Any news?" (the world host's talk deps, `getNewsOrRumors`) is wrapped. In a living, unsworn revenant's lair region,
  or within 20 px of its lair, with `RUMOR_CHANCE` (0.35), the answer is about it, built from the record - "They say a
  scarred orc called Grushnak the Butcher has been seen near the Tomb of Vaness, a day's walk to the northeast."
  (`bountyBoard.compassWord`, `distanceWord`) - and it spends the person's one answer
  (`numAnswersGivenTellMeAboutOrRumors`), as the mill does. Nothing is written into the mill or the save.
- One rumour in two carries its weakness: hinted (1), or one time in three named (2) - "Folk say it can't abide fire."
- Hearing of its lair marks `lairKnown`.
- **As built (RVN7b; the record at the foot)**: the person's answer is the mill's own gate first (a person with no news
  left has none of it either; a spymaster always has); the distance is the boards' (the longer side, `distanceWord`),
  the way `compassWord`'s; a town on its lair's very pixel says "in the Tomb of Vaness, close by". The weakness hinted by
  its kind: "some element is its bane", "a metal bites it deep", "one kind of weapon hurts it more than the rest", "it
  shuns the sun"; named, "it can't abide fire". What the player knows of its weakness never goes back.

### 18.3 The map and the journal

- A known lair is drawn on the travel maps: a new `revenants` mark list beside `bounties` in the world host's map deps,
  read where the bounty circle is read (`ui/heldMap.js`, `ui/travelMapWindow.js`, `ui/inkMap.js`) - a blood-red ring
  with its name, in `ui/bountyMapMark.js`'s shape.
- A known lair is a journal row ("Hunt: Grushnak the Butcher - near the Tomb of Vaness, northeast") in the quest log's
  port-own fold (`scenes/bountyHost.js questLogEntries`'s precedent). Abandoning it forgets `lairKnown`.
- **As built (RVN7c; the record at the foot)**: the circle is the bounty's, its radius and its reader
  (`readBountyMarks`, with the lair's own fallback label) shared, in blood red (`#7a0a0a`); the classic region page
  plots its texels as it plots a bounty's. The hunt's row: "Hunt: Grushnak the Butcher", "Orc, rank II.", "Its lair: Tomb
  of Vaness, a long walk to the east - marked on your map with a red circle.", no clock; its Abandon (twice, as a
  bounty's) through a leaf of its own, `systems/huntJournal.js` (the faces are lazy chunks, BOUNTY1's reason). A hunt
  is never shared (the lair is the character's own).

### 18.4 The lair stand

- Entering the lair while it is living, unsworn and not out, and **due or known**, stands it at the layout marker
  farthest from the entrance once the layout has stood (`dungeonContext.js spawnLooseFoe`), with a new revenant arm in
  `buildFoeAt` (`applyRevenant`, `grantRevenantLoot`, its taunt) and its band about it.
- **Found resting**: unaware (idle, not hunting) until it sees or hears the player, so a first blow may be a backstab
  (not on a Watchful one). Its drop's gold x1.25 (`LAIR_GOLD`).
- **Gates**: REVENANT-DUNGEON's - a foe of the player's alone (offline; online, a loose foe of mine on the SUMMON-SYNC
  lane, never a room's layout foe).
- **A load**: the dungeon save patches by index and cuts its tail, so a loose revenant does not survive one;
  `revenantPresence` (which already reads `playerDoor().foes()`) makes it due again.
- **Rest**: the dungeon's rest roll (`dungeonContext.js _restAdvance` -> `restEncounter`) gains the open world's
  revenant arm; in its own lair, a due revenant answers the rest's first roll ("You wake to Grushnak standing over
  you.").
- No purse (OPEN 15): the drop is the reward.
- **As built (RVN7d; the record at the foot)**: the stand is asked once a visit, on the first frame the player stands
  there (every seam the dungeon builds made); its place is PlaceFoeFreely's ring about the farthest marker (the marker
  itself when none stands). Decided here: a Night-stalker is at home at any hour. Its band stands about it and rests
  with it. A rest's roll that hits may be a due revenant's return anywhere underground (the open world's
  `revenantToReturn`), its band about it; in its own lair a DUE one (not merely known) answers the rest's first roll and
  stands over the player, waking them. Both are the player's own: online a rest's encounter is the room's (REST-SYNC).
  The dungeon has no encounter cap, so its band and a rank-5 portal stand whole.

## 19. What it takes (RVN8)

- **Online only.** Offline, a death ends the run with nothing saved, and the app mirror (`dagger.revenant.<id>`)
  outlives the save - a piece taken offline would come back twice.
- **When**: at the respawn (`world.js respawnOnlinePlayer`, beside `applyDeathPenalty`; once a death by its
  `_respawning` guard), when this death's deed was a revenant's `slew`.
- **What**: one piece - the most valuable of the equipped weapon and the pack's five most valuable pieces, drawn on its
  id and its kill count. Never a quest item, a summoned piece, the Materials Bag or gold, and **never a locked piece**
  (LOCK1's promise, "A LOCKED PIECE STAYS YOURS" - OPEN 16). At most three held (`TOOK_MAX`); past that it only gloats.
- **Moved**: `equip.unequipItem`, out of `entity.items`, onto the record's `took` (items are plain objects - the sworn
  pack's precedent). **The save's copy wins** (REVENANT-FATE's audit rule for a pack): the mirror never brings back a
  piece the save holds.
- **Told**: the wake box's line ("Grushnak the Butcher took your Ebony Longsword.") and its next taunt (23).
- **Carried**: in its pack at every stand.
- **Back**: slain - in its body; executed - in the pile (`revenantFate.finishExecution` hands over everything carried);
  spared - handed back at the oath ("It's yours. It always was."); escaped - kept. **The cap never buries one holding a
  piece.**
- **As built (RVN8; the record at the foot)**: "the most valuable of the equipped weapon and the pack's five most
  valuable pieces, drawn on its id and its kill count" is read as a DRAW among those six (the equipped weapon and the
  five most valuable takeable pack pieces), on its id's side stream salted by its kill count - so one id and count
  always takes one piece, and a kill more draws anew. The killer still standing over the body (the host's door's foes)
  carries the piece at once; a body carrying its pieces hands them over at its death (the record lets them go), one
  that never carried them leaves the record keeping them. The save's copy of what it took wins at the mirror's merge as
  a sworn one's pack does.

## 20. Festering (RVN9)

- **The day**: `revenantPresence`'s step in the encounter tick compares the character's day with a new `lastDay` on the
  store's state, and catches up whole days (at most seven).
- **The wrath**: a living, unsworn, not-out revenant `FESTER_DAYS` (3) past its due day gains a wrath, and another every
  three days more: health +10% and blows +5% a wrath, at its stand.
- **At three**: it ranks up on its own (the `festered` deed, a new epithet) and its wrath goes back to none. The card:
  "Grushnak grows bolder - it has waited too long."
- **Never** past rank 5 (its wrath stops at three); facing it (any stand) clears its wrath. Online, the character's
  clock stands while the player is away (`worldTick.skipDeadMinutes` and the own clock), so nothing festers between
  sessions. OPEN 17.
- **As built (RVN9; the record at the foot)**: the day's count rides the notice's step (`takeRevenantNotice` - the
  encounter tick asks it beside `revenantPresence`, and it knows the player); the first count only sets the day; a clock
  wound back counts no day and starts again from it (AUDIT FEUD corrected it: a clock behind the last counted day - an
  older save's - counts nothing until it passes it, so no day festers twice). A wrath falls on the days three, six, nine... past its due day
  (`festersOn`), each caught-up day in turn. Its wrath is applied at the stand over its rank's health and blows, then
  cleared.

## 21. New deeds (RVN10)

### 21.1 Felled - it knocked out your companion

- A special foe that knocks out a sworn revenant or a crew hand ashore. The knock-out arm of both damage doors notes
  `f._knockedBy = striker` (in scope there today, unused); `scenes/crewAshore.js` hands it to `onKnocked`; the world
  host makes the deed `felled` on the striker. `revenantDeed` marks `out` only for `slew` today - a felled foe still
  stands, so `felled` marks it out too.
- Epithets: "Bane of <the companion's name>", "the Companion-Killer", "Breaker of Oaths". Its return taunts with the
  companion's name.
- Spells pass no striker (the world host's foe sinks), so a spell's knock-out makes no deed - FLAGGED.

### 21.2 Routed - you ran from it

- A special foe, hostile and detecting me, whose harm reached me in the last 30 s (`harmMark.playerHarmMark`), when (a)
  I get `ROUT_DISTANCE` (70 m) from it, or (b) a Recall or a teleport takes me out of its pool mid-fight - **and** my
  health fell under half in that fight. The deed is `routed`, the foe culled; epithets "Who Made {p} Run", "the
  Pursuer"; it learns Relentless.
- Seams: the street pool's per-foe update, before its cull (a foe still detecting me is never culled today); the
  teleport sweep (`world.js _teleportToPixel` -> `clearLive`) asks the engaged specials first.

### 21.3 The words for both

The deed union (`RevenantDeed` in `revenant.js`), the epithet pools (`REVENANT_EPITHETS`), and
`ui/revenantPage.js DEED_WORDS`.

- **As built (RVN10; the record at the foot)**: the knock-out arm notes the striker of the blow that knocked him DOWN
  (a later blow on the body down names nobody); a striker dead or down by the layer's next frame fells nobody. "Its
  harm reached me in the last 30 s" is read per foe, not off the one mark: `harmMark.js` keeps each foe's FIGHT (its
  first harm, carried on by each harm within 30 s of its last) and the last hurt that left me under half; a rout needs
  that hurt inside the foe's fight. My death ends every fight (no rout after it - the respawn's jump is no flight), as
  a load does. Being run from is the lesson before any other (`lessonOf` asks `routed` first). A felled companion's
  name rides the deed's history entry (`ally`, at most 40 characters), the page saying it ("felled Borgakh"). A
  routed foe kneeling or running itself routs nobody; a jump's sweep is the host's door's pool, and a Recall within one
  room leaves none. Felling and routing count neither a kill nor an escape.

## 22. The sworn: loyalty, desertion, betrayal (RVN11)

### 22.1 Loyalty

- `companion.loyalty`, 0-100. It starts by personality: Honourable 80, Weary 70, Humorous 65, Cold 65, Witty 60,
  Zealous 60, Arrogant 55, Brutal 55, Craven 45, Unhinged 40.
- **Moves**: +3 a fight won at your side; +2 a day with you; +10 called back after its rest; -1 a day sent away (not
  resting); -8 knocked out; -10 sent away twice in a day; -15 if you execute a revenant of its own faction in its sight.
- **Labels**: 90 and up Devoted; 50-89 Loyal; 20-49 Wavering; under 20 Restless.
- **Devoted**: blows x1.1, and it calls a warning when a wind-up at you comes from behind ("Behind you, {p}!") - TELL
  meeting RVN.

### 22.2 Desertion

Under `DESERT_AT` (20), once a day, a 15% roll: it leaves through its portal. Its record is no longer sworn - a living
revenant again (rank kept, the `deserted` deed, "the Oathbreaker"), due in 1-3 days. **Its pack**: it keeps the better
half by value and leaves the rest, gold to your purse (OPEN 18).

- **As built (RVN11b; the record at the foot)**: the roll rides RVN9's day walk, after the day's loyalty move (a day
  with me first lifts it +2), once a day for each sworn one under 20 whatever its place (a resting one too); never on the
  first count. "The Oathbreaker" is its name whatever its rank (the risen bank passed over). "The better half" keeps the
  more valuable half of its pack, an odd one its way, on its record as RVN8's `took` (carried at its stands, given back
  as a theft is: slain, executed, spared) - so at most TOOK_MAX less what it took already; the rest comes back to my pack
  and its gold to my purse. A living one again, it holds the cap as a new one does (`trimLiving`, never itself). A save
  that held it sworn with a pack, reloaded after it deserted, stands it as the save had it (the release's own rule).

### 22.3 Betrayal

Under `BETRAY_AT` (10), and only an Unhinged, Craven or Brutal one: once, in a fight where your health falls under 25%,
it turns - out of the party first (`crewAshore.js` forces its body's team to the player's every frame), then a hostile
revenant standing where it stood (the `betrayed` deed, "the Betrayer", rank +1). The rest never betray; they desert.

- **As built (RVN11c; the record at the foot)**: the moment is a hurt that leaves me alive under a quarter (my death turns
  nobody); one turns a hurt - the first at my side whose body stands here and who may. It turns where it stood: its body
  lifted at once (no portal), and its record stood hostile at its feet through the place's own spawn (`turned`: no
  return counted, no band), set on me. Its rank +1 (its signature drawn at 2), "the Betrayer" whatever its rank, the
  `betrayed` deed, due should it get away. Its pack is decided here as a deserter's: what it may hold it carries (taken
  back when it falls), the rest and its gold to me.

### 22.4 Shown

The Companions page (`ui/companionRoster.js`): a loyalty bar beside its health, and its label.

- **As built (RVN11a; the record at the foot)**: RVN11 is built in three parts - RVN11a loyalty (22.1, 22.4), RVN11b
  desertion (22.2), RVN11c betrayal (22.3). "A fight won at your side" is read on its body: a fight begun when it takes a
  live target, won on the frame it stands with none and the last it fought is down (one that walked off is no win). "A
  day" is the character's, counted by RVN9's day walk (seven caught up at most; the first count only sets the day). "Called
  back after its rest" needs the record to remember the rest: `companion.rested` (set at its wake, spent by the call) and
  "sent away twice in a day" the day it was last sent: `companion.sentDay` - two companion fields RVN1 did not foresee
  (an older record reads them false and none). The slots' own hold sends one away without the player's choice, and costs
  nothing. "In its sight" is decided as its body standing here at my side (the layer keeps it at my heel); "its own
  faction" as one kind, or one faction (`mobileFactions.js` - the orcs, the dead, people). A Devoted one's warning waits
  15 s between (decided here); the back is the duel's own test (`isBackFacing`).

## 23. Words (RVN12)

- **New moments** (`revenantPersonality.js VOICE_EVENTS`): `learned`, `signature`, `laststand`, `stole`, `festered`,
  `felled_return`, `routed_return`, `deserted`, `betrayed`, `devoted_warn` - every personality two lines or more,
  three for `laststand` and `betrayed` (into the voice pin's `KEY_MOMENTS`), and a beast's body line each.
- **Narrator only**: the fourteen flinches (14.1) and the band's scatter (17).
- **Placeholders**: `{p}` today. FEUD widens the bank's law, deliberately and pinned exactly, to `{p}`, `{how}` (a
  learned habit: "blade", "arrows", "fire"...), `{item}`, `{move}` and `{ally}` (the companion felled).
  `test/revenant_voice.test.js`'s pin moves to the new list, and each placeholder is filled on every path (a line said
  with a `{` left in it is a failure).
- About 260 new lines; every one at most 96 characters, none twice.
- **As built (RVN12a; the record at the foot)**: RVN12 in two parts - RVN12a the words, RVN12b the page and the card.
  220 lines (two a moment, three for the last stand and the betrayal) and a beast's deed for each moment. A line needing
  a placeholder its caller did not hand is passed over (`voiceLine` never says a `{`); each moment's own word (`{how}`,
  `{move}`, `{item}`, `{ally}`) is in every one of its lines. The return's moment (`tauntMoment`): its newest deed against
  me first - a felling (by the companion's name), my flight, its long wait; after a kill, the newest piece it took (its
  card's kicker *It took* - section 24.2's, built here); every other return what it learned (its newest habit, in
  `ADAPT_HOW`'s words); else as ever. Voiced: the signature (its move named), the last stand (its own, no longer the
  cornering's), the deserter, the betrayer, a Devoted one's warning.

## 24. The page and the card (RVN12)

### 24.1 The Revenants page (`ui/revenantPage.js`, on the Holdings tab)

For the living, under what it is:

- **Learned**: its adaptations as chips, each with its effect ("Arrow-wise - your arrows bite less; it closes fast").
- **Weakness**: "Unknown" / "An element" / "Fire (learned)".
- **Will** (rank 3 and up): "Must be broken - strike its weakness, or stagger it twice." (FEUD BALANCE: "...strike
  its weakness, stagger it, or dodge its blow perfectly.")
- **Last stand** (rank 3 and up); **Signature** (its name and its shape's glyph); **Band** ("Rides with two Orcs -
  Grushnak's Warband"); **Took** (the pieces); **Lair** ("Near the Tomb of Vaness - on your map" / "Rumoured near
  Daggerfall" / "Roams"); **Festering** (three pips); **Scars** (its last fights' leading ways).
- For the sworn: loyalty. For the fallen: "Escaped unbroken" among the deeds.

### 24.2 The card (`ui/revenantCard.js`)

- Kickers: *Last stand*, *Signature*, *Grows bolder*, *It took*, *Oathbreaker*, *Betrayed*, *Weakness*.
- Edges: blood with an ember rim for a last stand; iron red for a signature; amber for a theft; black for a betrayal.

- **As built (RVN12b; the record at the foot)**: most of 24.1's rows came with their slices (RVN3's weakness - its words
  as RVN3 built them, "Weakness: unknown." / its kind / its name - RVN3-RVN7's will, last stand, signature, band, lair,
  RVN1's scars); RVN12b adds the learned chips (each its effect, on its title and in a line under them), *Took*,
  *Festering*'s three pips (shown with a wrath), a sworn one's loyalty, and "escaped unbroken" (the record's `fled` deed
  now remembers RVN3's tear-away: `unbroken` on its history entry). The kickers were each built with their moment
  (*It took* with RVN12a); FEUD's other kinds take edges by their kin (decided here: a felling, a festering, its lair, a
  weakness blood; a rout, an unbroken escape, a desertion amber; a warning the companion's violet).

## 25. Online (RVN13)

- New foe record fields: `ad` (its adaptations, a 12-bit mask), `wq` (its weakness), `p2` (its last stand), `rt` (a
  follower's master's `i`, for its name). Puppets apply `ad` and `wq`, so a peer's roll against them sees what mine
  would; the owner never applies them twice (a relayed blow is a final number).
- A peer's blow of its weakness on my revenant reveals it to me (the relayed hit's `wc`, 10.4).
- The theft, loyalty, festering, the lair and the rumours are the character's own: no wire.
- One relay bump with TELL8.
- **As built (RVN13; the record at the foot)**: `ad` is a sixteen-bit mask (sixteen adaptations were built, not
  twelve), refused with more than three set (ADAPT_MAX); `wq` the weakness's index in `WEAKNESSES`. The wire names
  none of them (`FOE_ADAPT_MASK_MAX`, `FOE_ADAPT_MAX`, `FOE_WEAK_MAX` - the tests hold them in step). TELL8's relay had
  shipped, so RVN13 bumps its own: **world164**. Both streams carry `ad`, `wq` and `p2` (FEUD's own fields - the
  dungeon's gap stays FLAGGED); `rt` rides the street's alone, since no name rides the dungeon's. A puppet stands with
  them only when they change; a follower is named for its master's band from the master's puppet (its given name, the
  first word of what its owner calls it, and its kind's word). A peer's blow of my revenant's weakness reveals it
  through the reveal's own door (`feudLedger.feudRevealWeak`).
- **AUDIT FEUD**: that reveal never fired (no sender set the class's weakness bit; a class rode only in a wind-up) -
  both senders now pass it, winding up or not; an heir's stream keeps writing the fields (the record at the foot).
- **FEUD WIRE (Mac, 2026-10-05: "Take care of both gaps"; the record at the foot)**: a revenant's blows at a PEER were
  its kind's plain ones. Now both streams carry `rb` - its stand's blows over its kind's (its rank's, its wrath's, a
  Night-stalker's night: `entity.revenant.blows`, written at `applyRevenant`), per mille - and a wind-up's signature
  (`wk` +64). A puppet folds `rb` and phase two's x1.2 (from `p2`) onto its own `damageScale` (its kind's, its elite's,
  its champion's) when they change - the factor it stood with last taken out first, so never twice - and strikes a
  signature at x2.0 in its ember, its WIND deeper. An heir writes `rb` back from the puppet's stamp. Relay **world165**.

## 26. The record, whole

Every new field enters `revenant.js sanitize` (or `sanitizeCompanion`) with its validator; an older record without it
gets the value in the last column.

| Field | Type | An older record |
|---|---|---|
| `scars` | `{k, at}[]`, at most 6, `k` from the scar list | `[]` |
| `learned` | adaptation ids, at most 3 | `[]` |
| `weak` | a weakness id | drawn on its id and kind |
| `weakKnown` | 0, 1 or 2 | 0 |
| `sig` | a shape id, or null | drawn on its id (rank 2 and up) |
| `kin` | mobile types | drawn on its id |
| `lair` | `{px, py, name, region}`, or null | null (set at its next deed) |
| `lairKnown` | boolean | false |
| `took` | items, at most 3, each through the save's item validation | `[]` |
| `wrath` | 0-3 | 0 |
| `fights` | a count | `kills + escapes + returns` |
| `companion.loyalty` | 0-100 | its personality's start |
| `companion.rested` (RVN11a) | boolean - fit after a rest, not yet called; only while away | false |
| `companion.sentDay` (RVN11a) | the character's day it was last sent away, or null | null |

- The store's state gains `lastDay`. The signature's name, the band's name and the epithets are derived, never stored.
- The deed union gains `felled`, `routed`, `festered`, `deserted`, `betrayed` and `laststand`.

---

## 27. Numbers in one place

| Constant | Value | Section |
|---|---|---|
| `POISE_W` light / medium / heavy / massive | 0.20 / 0.30 / 0.40 / 0.50 | 3.1 |
| the weight bounds | 200 / 700 / 1500 | 3.1 |
| `POISE_FLOOR_MASSIVE` (AUDIT TELL, the duel harness) | 60 | 3.1, 28 |
| `POISE_S` elite / Elite Dungeon / champion / Stalwart / revenant a rank | 1.5 / 1.25 / 1.25 / 1.5 / +0.1 | 3.1 |
| `POISE_K` blunt / axe / long / short / hands / claws / two-handed / arrow / spell | 1.5 / 1.25 / 1.0 / 0.7 / 0.6 / 1.0 / x1.15 / 0.5 / 0.75 | 3.1 |
| `POISE_BACK` / `POISE_WEAK` | 1.5 / 2 | 3.1 |
| `STAGGER_S` light / medium / heavy / massive | 1.4 / 1.2 / 1.0 / 0.8 s | 3.2 |
| `STAGGER_KNOCK` / `STAGGER_TAKEN` / `STAGGER_IMMUNE` | x1.5 / x1.25 / 3 s | 3.2 |
| `TELL_NOW` / `TELL_RELEASE_LEAD` | 0.2 / 0.25 s | 4.2, 4.3 |
| `TELL_NEAR_FLOOR` | 60% within 6 m | 4.4 |
| `IRON_COLOR` / `TELL_IRON_EXTRA` | [1.0, 0.12, 0.08] / 0.2 s | 5 |
| `PUNISH_S` lunge / sweep / slam / ring / charge / leap; iron | 1.0 / 0.8 / 1.2 / 1.0 / 1.4 / 1.2; +0.3 s | 6.1 |
| `PUNISH_TAKEN` | x1.3 | 6.1 |
| `TELL_LATE` / `PERFECT_WINDOW` | 0.25 s / x1.5 | 6.2 |
| `WINDUP_VARY` / `TELL_MIN_WINDUP` | U(0.9, 1.25) / 0.55 s | 7.1 |
| `TRACK_RATE` / `TRACK_SHARE` | 120 degrees a second / 0.5 | 7.2 |
| `FEINT_CHANCE` / `FEINT_AT` | 1 in 5 / 0.55 | 7.3 |
| `CHAIN_CHANCE` / `CHAIN_WINDUP` | 0.35 / 0.5 s | 7.4 |
| the ring, the charge, the leap, the aimed shot | section 8.1's table | 8.1 |
| PUSH lunge / charge; its decay | 3 / 5 m/s; 12 m/s/s | 8.2 |
| RATTLE | 0.6 s at 60% | 8.2 |
| BLEED | 30% over 3 s | 8.2 |
| KNOCKDOWN / its guard | 0.9 s / 5 s | 8.2 |
| cooldowns: ordinary / champion / elite / revenant a rank / last stand | 8-15 / 7-13 / 6-11 s / -8% / x0.7 | 9 |
| `SCAR_SHARE` | 0.4 | 12 |
| `ADAPT_MAX` | 3 (at most the rank) | 13.1 |
| the adaptations (`revenantFeud.js ADAPT`) | section 13.2's table; an element +25 (RVN2) | 13.2 |
| the weakness / daylight | x1.5 / x1.25 | 14.1 |
| `WILL_RANK` / `WILL_STAGGERS` | 3 / 2 (FEUD BALANCE: 1, a perfect dodge counted) | 14.2 |
| `LAST_STAND_HEALTH` rank 3 / 4 / 5 | 0.35 / 0.45 / 0.55 (FEUD BALANCE: 0.30 / 0.35 / 0.40) | 15.2 |
| `LAST_STAND_ROAR` | 1.2 s | 15.2 |
| phase two | blows x1.2, +20 Speed, wind-ups x0.85, cooldowns x0.7 | 15.2 |
| `SIG_RANK` / its damage / its cooldown | 2 / x2.0 / 12-18 s | 16.1 |
| `RETINUE` by rank | 0 / 1 / 2 / 3 / 3 | 17 |
| `RUMOR_CHANCE` | 0.35 | 18.2 |
| `LAIR_GOLD` | x1.25 | 18.4 |
| `TOOK_MAX` | 3 | 19 |
| `FESTER_DAYS` / a wrath / the rank-up | 3 / +10% health, +5% blows / at 3 | 20 |
| `ROUT_DISTANCE` / the harm window / the health line | 70 m / 30 s / 50% | 21.2 |
| loyalty's starts and moves | section 22.1 | 22.1 |
| `DESERT_AT` / its roll / `BETRAY_AT` | 20 / 15% a day / 10 | 22 |

Unchanged: `BLOW_CHANCE`, `BLOW_NEAR`, `BLOW_FLASH`, `BLOW_VERDICT_LIFE`, the tokens, the ring, every other TACT
number, and every DFU constant.

## 28. The balance targets, and the harness that measures them

The numbers above are a first guess. They are tuned against a **duel harness** (a tool beside
`tools/foeTelegraphProbe.mjs`): the real motor, brain and attack component in a real collider room (the TACT pins'
rig); a scripted player - standing, trading blows, dodging late, dodging perfectly - with a dagger, a longsword, a
warhammer, a bow or a fire spell; against an Orc, a Giant, a Daedra Lord and a class Warrior, ordinary, elite, and a
revenant at each rank; a thousand seeded fights a cell. It prints a table, and the record keeps it.

| Target | Measured as |
|---|---|
| A light weapon rarely breaks alone | a dagger, solo, at a medium foe's front: 15% of the wind-ups its blows land on or fewer |
| A heavy weapon usually does | a warhammer, the same: 60% or more (of the wind-ups it lands on - AUDIT TELL: one swing at most comes in a wind-up, and DFU's hit roll on it, so a miss or a late swing breaks nothing whatever the weapon) |
| Massive means massive | no single blow of a non-weakness weapon at a giant's front breaks it |
| Dodging pays | a perfect dodger takes a tenth of the telegraphed blows a trader does or fewer, and is no slower to bring a rank-3 revenant to its end - what dodging buys: the will (below), and the blows not taken (FEUD BALANCE, OPEN 24; it read "kills a rank-3 revenant at least 25% faster than one who trades blows") |
| The will is learnable | a rank-3 revenant fought with its weakness kneels 90% of the time or more; without it, but dodging, 70% or more; by trading blows alone, 20% or less (measured with the reference longsword - a heavy weapon's poise breaks are its own way to the will) |
| A rank means something | a rank-5 revenant takes about 2.5 times a rank-1's time to kill |
| Fair | no telegraphed blow lands on a player who leaves its shape inside its first 70% |

**Measured (AUDIT TELL, AUDIT FEUD - the records at the foot; `tools/tellDuel.mjs`).** TELL's four hold. Of RVN's, the
will by its weakness (100%) and the trader's will (0.3%) hold; three miss as built - **the will by dodging** (11.6%: a
rank-3 fight lasts about 11 s and holds two or three telegraphed blows, so two staggers come one fight in nine),
**dodging pays** (90.5%: a dodger swings no faster, and the fight holds few windows) and **a rank's weight** (rank 5
over rank 1: 3.25 trading, 2.98 dodging - the last stand's share grows with the rank). Each is a number Mac called (OPEN 11,
12, 5), so AUDIT FEUD tuned none: OPEN 22-24 below put them to him, each measured. **FEUD BALANCE** built his calls
(each as recommended): the will by dodging 89.7%, by its weakness 100%, by trading 13.9%; a perfect dodger struck by
5.6% of a trader's telegraphed blows, in 90.4% of its time; rank 5 over rank 1, 2.95 trading and 2.70 dodging - every
target holds. **AUDIT FEUD 2** made the harness faithful to the pools (the AUDIT FEUD 2 record) and measured again: the will
by dodging 94.6%, by its weakness 100%, by trading 12.7%; a perfect dodger struck by 0.2% of a trader's telegraphed blows,
in 98.4% of its time; rank 5 over rank 1, 2.66 trading and 2.63 dodging; TELL's four hold (LIGHT 0.5%, HEAVY 91.0%,
MASSIVE 97.7% of the floor, FAIR 0) - every target holds, each with room. **FEUD HARNESS** fought the rest of the fight
the pools give a revenant - its band and its flight (the FEUD HARNESS record) - and measured again: the will by dodging
88.0%, by its weakness 100%, by trading 11.4%; a perfect dodger struck by none of a trader's telegraphed blows (0 in a
thousand fights), in 99.2% of its time; rank 5 over rank 1, 2.69 trading and 2.62 dodging - every target holds. The
duel alone and never running, measured beside them, is AUDIT FEUD 2's to the fight (12.7% and 94.6%).

## 29. Tests, mutants and probes

Each slice lands its pins red first, and a mutation list (`tools/mutants/`, run by `tools/mutate.mjs`), all dead. Named
here so the plan is checkable:

- **TELL1**: P from a real `spawnFoe` and `buildFoeAt` foe of each weight class, and an elite, a champion and a
  revenant through their own producers (`healthMult`); K, B and X each moving v; a hold writes no knockback and no Hurt;
  a break at exactly P; the stagger's lock, Hurt, x1.25 and its 3 s guard; a paralysis still breaks; outside a wind-up,
  DFU's knockback to the bit (the C15 pin); switch off, TACT2's five-foe seeded run unchanged.
- **TELL2**: the held frame is the one before the first `-1` of the rolled variant; the `-1` on the step after the
  landing; a two-strike list's second blow plain; a break and a paralysis cancel the swing; the glint's curve and the
  reduced-motion rim; the three cues once each, and a feint without WIND; the probe's keyline, brighten and near floor.
- **TELL3**: iron takes no meter; only a paralysis stops it; the hatch and the second rim in the shader text and the
  probe.
- **TELL4**: a miss overreaches by shape, iron +0.3; the first landed blow staggers; x1.3; a perfect dodge sampled at
  `TELL_LATE`; the lock's bound.
- **TELL5**: the drawn length in its band and above its floor; tracking to 0.5, then locked; a feint at 0.55 with no
  glint or WIND, never two in three; a chain's second shape differs, and the window waits for it.
- **TELL6**: each new shape's field pinned to `inBlow` point for point; the charge's swept verdict; the leap refused
  without a line or ground; the aimed shot's locked line; a push stopped by a wall and by a 2 m edge; the bleed's three
  ticks and its cures; the knockdown's guard.
- **TELL7**: the tier table (a champion and a level-4 revenant now pass); shapes by tier; the cooldowns.
- **TELL8**: `validFoeRecord` accepts and refuses each field; a puppet's mark from `wl`, cleared when the field goes; a
  peer judging its own feet; the relay row.
- **TELL9**: the bar's foe on a threat; the poise track's states; the tags.
- **RVN1**: the ledger from the real strike listener and `applySpellToFoe`; the scar at 40%; `mixed`.
- **RVN2**: one learned a deed, `min(rank, 3)`, the oldest forgotten; each adaptation's effect through its real seam;
  never under x0.6.
- **RVN3**: the weakness drawn the same for one id on two runs, the shared DFRandom unmoved; each way it is revealed;
  the will - kneels broken, escapes unbroken, ranks up and learns; Disintegrate kills.
- **RVN4**: the last stand once, at rank 3 and up, health by rank, the roar's refusal, phase two's numbers, rank 5's
  band; never at rank 2.
- **RVN5**: the signature drawn on the id, iron from rank 3, the name bank, pyre's element by its kind (16.1 as built).
- **RVN6**: the band's count by rank, its kin by faction, the cap trimming followers first, no infighting, the scatter;
  a follower never a candidate.
- **RVN7**: the lair from the ring for a fixed id and pixel; the rumour's odds and its answer counter; the map mark and
  the journal row; the lair stand's gates (offline, and a room foe online refused) and its unaware start.
- **RVN8**: online only; the pick's exclusions (a locked piece never taken); the save's copy winning over the mirror;
  each way back; the cap never burying a holder.
- **RVN9**: catch-up days, a wrath every three, the rank-up deed, the clear on a stand.
- **RVN10**: felled from a real knock-out, out marked; routed by distance and by a Recall, refused above half health.
- **RVN11**: loyalty's starts and moves; desertion's roll and its pack split; betrayal only for the three, under 10;
  Devoted's warning.
- **RVN12**: the voice bank's counts and the widened placeholder list (exactly); every `{...}` filled on every path; the
  page's rows from real records.
- **RVN13**: `ad`, `wq`, `p2`, `rt` validated; a peer's roll against a puppet sees its adaptations.
- **Live**: a Playwright probe of a duel in a real dungeon, frame-synced on the shot-mode `__frame` counter (Home.md:
  never sleep) - the glint, the held frame, the mark, a break, an overreach.

## 30. Slices

Each one: pins first, the four hosts named in its record, a mutation list, an audit before its merge, patch notes in its
pull request.

1. **TELL1** - poise and the stagger.
2. **TELL2** - the held swing, the glint, the cues, the ground's style.
3. **TELL3** - iron blows.
4. **TELL4** - overreach and the perfect dodge.
5. **TELL5** - lengths, tracking, feints, chains.
6. **TELL6** - the ring, the charge, the leap, the aimed shot; push, rattle, bleed, knockdown.
7. **TELL7** - the tier and the cooldowns.
8. **TELL9** - the target bar, the tags, the contrast preference.
9. **TELL8** - online (last of TELL, because it carries everything above).
10. **AUDIT TELL.**
11. **RVN1** - the ledger, and every new record field of section 26 at once, so the save changes once.
12. **RVN2** - adaptations.
13. **RVN3** - the weakness and the will.
14. **RVN4** - the last stand.
15. **RVN5** - signatures.
16. **RVN6** - the band.
17. **RVN7** - the hunt.
18. **RVN8** - the theft.
19. **RVN9** - festering.
20. **RVN10** - felled and routed.
21. **RVN11** - loyalty.
22. **RVN12** - the words, the page, the card (each earlier slice brings its own minimum; this one completes them).
23. **RVN13** - online.
24. **AUDIT FEUD** - every lens: the tells, the wire, the record and its merge, the words, the pages, the four hosts,
    and the balance table measured again.

Suggested pull requests: TELL1-TELL4 (the fix the field asked for); TELL5-TELL7 with TELL9; TELL8; RVN1-RVN4;
RVN5-RVN7; RVN8-RVN11; RVN12 and RVN13 with the audit.

## 31. OPEN - Mac's calls (each with the recommendation)

**ANSWERED 2026-10-04: Mac, "Go" - all twenty-one as recommended.**

1. **The poise model.** Recommended: **a meter filled through the wind-up**, sized as a share of the kind's health by
   its weight (3.1). The alternative, a flat number of hits, ignores the weapon.
2. **Poise's numbers.** Recommended: **section 27's first guess**, tuned to section 28's targets.
3. **The stagger.** Recommended: **0.8-1.4 s by weight, x1.25 taken, 3 s before another**.
4. **Does a paralysis stop an iron blow?** Recommended: **yes** - the spell is the answer to iron, and DFU's CanAct is
   kept everywhere.
5. **The punish window.** Recommended: **0.8-1.4 s by shape, x1.3, the first blow landed staggers; a perfect dodge
   x1.5**.
6. **What a landing does to the player.** Recommended: **push, rattle and bleed on every telegraphed hit; knockdown on
   iron only**.
7. **Feints.** Recommended: **yes - blades of the higher tier only, and never with a glint**.
8. **The new shapes, and the "one or two" of 2026-10-02.** Recommended: **all four new shapes; an ordinary foe of the
   tier keeps its one or two; elites, champions and revenants throw their family's whole set**.
9. **Wind-ups at peers.** Recommended: **yes**, each client judging its own feet (the world boss's law).
10. **Adaptations.** Recommended: **x0.6-0.75 by kind, +50 an element, up to three, never immunity**.
11. **The will.** Recommended: **from rank 3, broken by its weakness or two staggers; unbroken, it escapes and comes back
    stronger**. The alternative: an unbroken will only lowers the trophy's rarity.
12. **The last stand.** Recommended: **rank 3 and up, 35 / 45 / 55% health, once a stand**.
13. **The band.** Recommended: **0 / 1 / 2 / 3 / 3 by rank, of its own kin, scattering when it falls**.
14. **The lair.** Recommended: **a named dungeon in the bounty ring; once known it is always home; found resting; gold
    x1.25**.
15. **A purse for a revenant.** Recommended: **none** - the drop, the trophy and the piece it took are the reward.
16. **The theft.** Recommended: **online only, one piece a death, at most three, never a locked piece**.
17. **Festering.** Recommended: **a wrath every three days past due, a rank at three wraths**.
18. **A deserter's pack.** Recommended: **it keeps the better half; the rest, and its gold, come back**.
19. **Betrayal.** Recommended: **only the Unhinged, the Craven and the Brutal, under 10, once, below a quarter of your
    health**.
20. **The ground mark's look.** Recommended: **the world boss's line and blend for foes; the boss's own pass adopts the
    shared leaf in AUDIT TELL**.
21. **Rumours.** Recommended: **0.35 an "Any news?" in its region; one in two carries its weakness**.

**OPEN after AUDIT FEUD (2026-10-05) - the balance, measured (section 28; an Orc revenant, a longsword, 1000 fights a
cell; each alternative measured at 300).**

**ANSWERED 2026-10-05: Mac - all three as recommended. Built as FEUD BALANCE (its record at the foot).**

22. **The will.** As built (OPEN 11: its weakness, or two staggers): with its weakness 100%, dodging 11.6%, trading
    0.3% - the dodging target (70%) missed. Recommended: **broken by its weakness, or by one stagger or one perfect
    dodge** (`WILL_STAGGERS` 1, a perfect dodge counted with the staggers): 100% / 91% / 12% - all three held.
    Alternatives: one stagger alone (100 / 55 / 12); two of a stagger or a perfect dodge (100 / 56 / 0.3); as built, the
    target rewritten.
23. **A rank's weight.** As built (OPEN 12: the last stand 35 / 45 / 55%): rank 5 takes 3.25 times rank 1's time
    trading, 2.98 dodging (target about 2.5). Recommended: **the last stand at 30 / 35 / 40%**: 2.96 / 2.64.
    Alternative: a revenant's health +15% a rank (REVENANT's +25%): 2.72 / 2.53, but every rank-3 fight shorter and its
    will harder to break by dodging (3%).
24. **Dodging pays.** As built: a perfect dodger ends a rank-3 in 90.5% of a trader's time (target 75%). No lever
    measured reaches it: the punish window's blows x1.6 (OPEN 5's x1.3): 89%; x2 and a stagger's x1.5: 86% - shorter
    fights, and fewer wills broken (4%). Recommended: **the target rewritten to what dodging buys - the will (22) and the
    blows not taken (a perfect dodger took 0.12 telegraphed blows a fight, a trader 1.96)**. Alternative: a revenant's
    telegraphed blows more often (TELL7's cooldowns), measured in a further pass.

With 22 and 23 as recommended together (measured): the will 100 / 90 / 12%, the ranks 2.96 / 2.64, dodging pays 91%.

## 32. Not in this arc, and corrections made with it

- **A player block or parry.** The port has none (the Shield Widget is drawn after the blow is decided). A brace would
  change every fight, not only the telegraphed ones: its own arc.
- **A party's shared revenant.** A revenant stays its character's memory (REVENANT's own law); a peer helps fight it,
  and nothing more.
- **The dungeon stream's gaps.** `roomRecord` carries no `z`, `nm`, `yd`, `ex` or `sp` today; FEUD adds only its own
  fields there and leaves the gap FLAGGED (RVN13: with no `nm` there, no band follower's `rt` either - a follower in a
  dungeon stands unnamed on a joiner's screen; the same flag names it).
- **A revenant puppet's blows at a peer** (AUDIT FEUD) - closed by FEUD WIRE (section 25): `rb` and the signature's
  flag ride both streams.
- **The single-location host.** `scenes/exterior.js` builds its pool without `fates`, so its revenants die outright;
  and it builds no location index, so they roam (no lair - RVN7a). FLAGGED in every RVN slice's record.
- **RVN11a's fields.** RVN1 changed the record once for every field FEUD foresaw; loyalty's own moves needed two more on
  the companion (`rested`, `sentDay` - section 26), each read back to none for an older record.
- **RVN10's edges.** A spell's knock-out of a companion names no striker (the world host's foe sinks), and a foe on
  another's machine that knocks out mine (the wire's `fb`) is theirs - neither fells. A dungeon never culls by
  distance, so no rout by distance underground (a jump's is there); a door walked through mid-fight is no rout (the
  arc names the distance and the jump). `scenes/exterior.js` stands no companions, so nothing is felled there. FLAGGED.
- **Corrected now in `06-Systems/Revenants.md`**: both of its pages are on the **Holdings** tab (HOLDINGS moved them on
  2026-10-03), and REVENANT-WIRE shipped as relay **`world153`** (its sections 6 and 15 named the branch's `world144`
  and `world152`, which are SEAT1b's and GLYPH-WEAR's today).

## Record

### TELL1 - BUILT 2026-10-04 (the Enhanced AI switch on, every host)

- **The law** - `ai/tells.js`: the `TELL` table (section 27's TELL1 rows, pinned whole); `weightClass` over DFU's weight
  in classic units (200 / 700 / 1500); `kindHealth` (`maxHealth / healthMult`); `poiseSpecial` (elite 1.5, Elite
  Dungeon 1.25, champion 1.25, Stalwart 1.5, a revenant +0.1 a rank); `poiseOf`; `staggerSeconds`; `blowK` (the
  weapon's skill through `weapons.weaponSkillUsed`, two-handed by DFU's own hands table, `equipTable.getItemHands` -
  so a Battle Axe is one-handed and a Flail and a War Axe two; an arrow, a spell's landing, a later round 0, a peer's 1,
  claws 1); `behind` (more than 110 degrees off the locked facing); `blowWeight`.
- **What was stood** - every multiplier of a foe's maximum health multiplies `entity.healthMult`:
  `eliteFoes.promoteEliteFoe` (its own, never a puppet's), `champions.applyChampion`, the dungeon's Elite Dungeon
  doubling (`applyEliteScaling`), `revenant.applyRevenant`, a rite's summoner (`scenes/riteHost.js`), a sworn one
  (`revenantCompanions.js`). The strong-player scaling (`enemyEntity.js`) is the kind's own and stays in `H0`.
- **The brain** - `ai/tactics.js`: `windupHolds`, `windupStruck` (the meter set at the first blow, the break - mark
  gone, cooldown begun, token handed to the longest waiter - and the stagger: state `staggered`, `ai.staggerUntil` and
  `entity.staggerUntil` on the brain's clock, `staggerReady` 3 s past its end); a break inside the guard is a plain
  break (state `wait`, DFU's knock for the blow). The stagger's end goes to RECOVER (its hop and its beat). The fold
  `tell-stagger` registers at import.
- **The motor** - `characters/enemyMotor.js _step`: `staggered` joins CanAct, the stop of the walk latch, the detour
  timers and the follow, as a knock does; `ai.staggered` per step. A paralysis still breaks a wind-up (the brain's next
  turn hears `_tacSkipped`) and staggers nothing.
- **The doors** - `scenes/hostCombat.js windupDoor` (the class from the door's `kind`, the player's `weapon`, a
  striker's own weapon or a monster striker's body, the `round`, `peer`, `from` for the back test, the weight read only
  when winding up) and `windupFeedback` (the clang, the hit, the bark, the kick; the parry ring on a hold of a kind DFU
  gives one). Asked in `exteriorFoes.js damageFoe`, `cityGuards.js damageGuard` and the dungeon's `damageFoe`, where
  each writes knockback: 'hold' returns before it, 'stagger' writes it x1.5. Each door gained `weapon` and `round` (the
  watch's `kind` and `striker` too - it had neither); each pool's `resolvePlayerHit` passes the striking weapon; the
  watch's `hurtFromFoe` takes the striker and its foe-vs-foe swing passes it. `applyDamageToNonPlayer` writes no
  knockback on a foe winding up.
- **The Hurt** - the three live mobile updates pass `hurting: ai.hurtKnock || ai.staggered`: a stagger's Hurt held.
- **Spells** - `effects.js runEffectRound` says `round: true`; every foe sink forwards it (the street's, the dungeon's,
  `world.js`, `exterior.js` and `worldModes.js` for the encounter pool and the watch); `hostMagic.applySpellToFoe`
  takes a landing's damage through `blowTaken` (a kill and a round as they come).
- **Arrows into the watch** - `world.js`, `exterior.js` and `worldModes.js` pass `kind: 'arrow'` to `hurtGuard`.
- **Four hosts** - `scenes/world.js` WIRED (its pools; the watch's arrows and spell sinks); `scenes/exterior.js`
  WIRED (the same); `scenes/worldModes.js` WIRED (the interior's encounter pool and watch; their arrows and sinks);
  `scenes/dungeonContext.js` WIRED (its door, sinks and swing; `scenes/dungeon.js` hosts it).
- **Not built here** - a peer's relayed blow weighs K = 1 and a puppet carries no stagger (TELL8); the target bar's
  poise track and the tags (TELL9); the weakness's X (RVN3).
- Pins `test/tell1_poise.test.js` (15): the table whole; the classes on DFU's weights; poise; every multiplier's
  `healthMult` through its producer (and the three not exported by their source); the classes and the back; on the real
  motor a hold that lands, a break and a stagger (its length, its token, its cooldown, nothing decided, standing, then
  the beat), no stunlock, the weight's length and an elite's poise, a paralysis and the switch off; a staggered foe's x1.25
  end to end through `calculateAttackDamage`; THE REAL STREET POOL (DFU's knock to the bit off a wind-up, a mace's hold
  with its parry, the stagger's shove x1.5, the clang and the kick, the Hurt held every frame); the foe-vs-foe payload
  and a monster striker's weight; every door, Hurt, round and arrow route by source.
- Mutants `tools/mutants/tell1.json` (39), all dead.
- Pins moved (each marked `PIN MOVED (TELL1: ...)`): `audit24_lifetimes`, `audit26_combat`, `audit39_worldstate`,
  `audit39_worldmodes`, `audit68_review`, `audit68_worldjs`, `auditworld6biii`, `world2`, `disc10_lycan`, `enchantpool`,
  `exteriorfoes`, `hostmagic_wiring` (source lines the doors and the sinks changed), `roadg_pools` (a cite); mutant
  records re-aimed in `disc10`, `duel`, `loot7` and `tact5`.

### TELL2 - BUILT 2026-10-04 (the Enhanced AI switch on, every host)

- **The held swing** - `ai/tactics.js`: the wind-up's start raises `ai._blowHold = true` and `ai._blowWind`; the
  landing at me writes `_blowHold = false` (and stamps `ai._blowLandedAt`); a break, a paralysis, a landing on no one
  here and a lost place (`releaseTactics`) drop it (`dropSwing`: `'cancel'`). `characters/enemyAttack.js`: `_blowWind`
  begins the one swing at the wind-up (the strike edge, `swingSeq`, `_held`); the landing's `_blowSwing` releases a held
  swing - the brain's count (`_tacSwung`) then, no second swing - and restarts the machine on the strike it rolled at
  the start (no new draw): its own swing ran out under the hold, and a swing in flight holds the bow roll as the forced
  swing's did; `'cancel'` resets the machine. A landing the attack
  component cannot take in time is spent as before. `characters/mobileUnit.js`: `update`'s `hold` - a swing that BEGAN
  under it (`_underHold`) stands before its first `-1` (the raised arm; a list that starts with `-1` holds frame 0); the
  release strikes on the next frame step; `'cancel'` drops it to idle, so a stagger's Hurt takes the same frame (section
  4.1's `cancelAttack()` is this word, not a method). The first `-1` releases the hold - a list's second strike is
  DFU's, unheld. `meleeSeq` counts the strikes. A DFU swing in flight is never held or dropped; a wind-up's own swing
  replaces one (the attack machine's restart at `_blowWind` does the same).
- **The glint** - `ai/tells.js glintStrength` (the flare 0.9 over 0.15 s, the 0.2 rim, the rise to 1 through the last
  `TELL_NOW`; reduced motion 0.45 steady); `ai/tactics.js foeGlint` (the blow's colour, `BLOW_COLOR` without one; none
  for a feint, none out of a wind-up). `systems/hitFlash.js`: `GLINT_GLSL` (`glintRimColor`, `glintLit`),
  `TELL_GLINT_PAD`, `setBatchGlint` (written on change), `prefersReducedMotion` (read at most once a second). Both
  billboard shaders (`renderer.js BB_FS`, `enhancedLighting.js EL_BB_FS` - its colour decoded into the lane's light, its
  rim in display colour as the elite's): the outline by the elite rim's texel test, over an elite's halo while it lasts,
  never round a concealed or burning body; the body lifted under the hit's red. `drawOne` uploads it on change, the
  frame resets it, and the pad widens the quad for it as for an elite. `render/contract.js` types `batch.glint`.
- **The ear** - `scenes/hostCombat.js tellCues`, once a frame per live foe after its sprite: WIND (the bark at 0.85; a
  person, muted by DFU, `SwingMediumPitch` at 0.6 and volume 0.6; none for a feint), RELEASE (`SwingLowPitch` at 0.45,
  0.25 s before the landing), LAND (the attack sound at the strike after a landing - `meleeSeq` past the count it held;
  a person's silent). Through `play3d` at the foes' own device settings (a metre over the feet, linear to the attract
  radius times acute hearing). A break plays neither RELEASE nor LAND. The pools hold their strike-edge attack clip
  while `_blowHold` is true: the start's sound is the WIND (section 4.1's "the attack sound moves to the start" is the
  WIND; the attack sound is the LAND, as 4.3 says).
- **The ground** - `render/telegraphStyle.js` (a leaf of GLSL; the line, the keyline, the glow past it, the fill, "now",
  the landing), composed by `render/foeTelegraph.js` over an unsigned distance to the outline per shape (drawn 0.5 m
  past it for the keyline and the glow); `uNow` (`nowShare`, 0 at the flash), `uNearFloor`; the blend premultiplied
  (ONE, ONE_MINUS_SRC_ALPHA). `ai/foeBlows.js drawableBlows` hands each mark its near floor (0.6 within 6 m of the
  player). `ai/blowShapes.js` homes `TELL_NOW`, `TELL_NEAR_M` and `TELL_NEAR_FLOOR` (the TELL table takes them).
  `tools/foeTelegraphProbe.mjs` gains the keyline, the brighten and the near floor (17 held, Chromium WebGL2).
- **Three pools** - `exteriorFoes.js`, `dungeonContext.js` (a puppet passes no hold and plays no cues: its owner's) and
  `cityGuards.js`: the hold into the sprite, the strike clip held, `tellCues` after the sprite, `setBatchGlint` beside
  the hit flash. Every host that runs them is wired with them (`world.js`, `exterior.js`, `worldModes.js`, the dungeon).
- **Not built here** - the puppet's held pose (TELL8); a feint (TELL5) - its no-glint and no-WIND are in place.
- Pins `test/tell2_tell.test.js` (20): the held swing on the real frame lists (the stand, the release, the cancel and
  its Hurt, the head `-1`, a DFU swing never held, the replace); on the real motor (begun once, released once, dropped on
  a break and a lost place); end to end on the real sprite and in the ear; the cues; the glint's curve, colour and batch,
  the reduced-motion read; the shaders and the renderer; the ground; the three pools. Pins moved (each marked
  `PIN MOVED (TELL2 ...)`): `tact4` (the swing begins with the wind-up, released at the landing); `audittact` A4/D5 (the
  archer's held swing released, no second), D9 (the fog into the line as `fogK`) and the ground pass's blend;
  `combatVisuals` ECV1 (the glint's frame reset beside the dissolve's); `dwf_audit` E-1 (the glint's declarations
  before the burn's); `hard3_types` (49 fields minted); `la_cost` (the billboards' first call 104, `_bbGlintOn` a GL-state
  shadow); three cites by hand (`roadg_pools`, `chargenSession.js`, `Port-Ledger.md`). Mutant records re-aimed by
  content: `audit0928_render`, `audittact` (three), `perfextb`, `tact2`, `tact4`, `tell1`.
- Mutants `tools/mutants/tell2.json` (54), all dead.

### TELL3 - BUILT 2026-10-04 (the Enhanced AI switch on, every host)

- **The guard** - `ai/foeBlows.js makeBlow(kind, origin, yaw, now, color, guard)`: every blow says `guard` 'poise' or
  'iron' (anything else is poise); an iron wind-up runs `TELL_IRON_EXTRA` (0.2 s, `ai/blowShapes.js`) longer.
  `IRON_COLOR` [1.0, 0.12, 0.08] beside `BLOW_COLOR`.
- **Who throws iron** - `ai/tells.js blowGuard(kind, weight, ent, roll)`: the slam and the ring (`TELL.IRON_SHAPES`; the
  ring is TELL6's) of a heavy or massive body by DFU's own weight - the Giant, the Orc Warlord (700, heavy at the
  bound), the Daedra Lord and the Iron and Flesh Atronachs; the Daedroth's, the Gargoyle's and the Dreugh's slams stay
  poise - and one blow in three (`TELL.IRON_ELITE`) from an elite (first read as the ELITE FOES gold alone; read again at
  TELL5 by section 9's "an elite (`elite`, `eliteFoe`)" - an Elite Dungeon's foe too); the roll drawn only for an elite
  whose shape has not decided. The brain
  (`ai/tactics.js`) asks it as it winds up, with the kind's own weight (no class throws an iron shape), and colours the
  blow by it. The revenant's iron (its signature from rank 3, a last stand, a Steadfast one) joins with RVN2, RVN4 and
  RVN5, in `blowGuard`.
- **Iron takes no poise** - `windupStruck` answers 'hold' to every blow on an iron wind-up and weighs none: the doors
  write no knockback (TELL1's hold), the meter is never set. A paralysis still breaks it (OPEN 4, `windupTurn`, its held
  swing dropped). A charging horse's shove - no blow's door - still breaks it as it breaks any wind-up: a body moved off
  its mark cannot land it there.
- **Never by colour alone** - `render/telegraphStyle.js telegraphIron` over the style: a second line `IRON_INSET`
  (0.25 m) inside the outline and a diagonal hatch every `IRON_HATCH` (0.35 m) across the fill inside it;
  `render/foeTelegraph.js` sets `uIron` per blow. Its glint is red (the blow's colour, TELL2). The target bar's "Iron"
  is TELL9's. `tools/foeTelegraphProbe.mjs` reads the second rim and the hatch off a real frame (19 held).
- **Not built here** - an iron miss's longer window (TELL4); the target bar's word (TELL9); a revenant's iron (RVN).
- Pins `test/tell3_iron.test.js` (9): the numbers; the guard by shape and weight, every brute by its own; an elite's
  third (and an Elite Dungeon's foe not one; the roll's draw); the blow's length and guard; ON THE REAL MOTOR a giant's
  slam iron - every blow held, none weighed, its mark standing, landing where aimed at its longer landing, red on its
  body - a paralysis still stopping it, an elite orc's sweep iron where a plain orc's breaks; the door's hold; the
  ground's rim, hatch and uniform. Pin moved: `tell1_poise` (its giant's and elite's wind-ups pinned poise - a giant's
  slam is iron now; the table grew).
- Mutants `tools/mutants/tell3.json` (24), all dead.

### TELL4 - BUILT 2026-10-04 (the Enhanced AI switch on, every host)

- **The law** - `ai/tells.js`: `PUNISH_S` (lunge 1.0, sweep 0.8, slam 1.2, ring 1.0, charge 1.4, leap 1.2 s),
  `PUNISH_IRON` 0.3, `PUNISH_TAKEN` 1.3, `TELL_LATE` 0.25, `PERFECT_WINDOW` 1.5, `PERFECT_PITCH` 1.25;
  `punishSeconds(kind, guard, perfect)` (a shape with no row takes the lunge's).
- **Overreach** - `ai/tactics.js windupTurn`: a landing at me whose verdict is false begins the window
  (`beginOverreach`): state `overreach` for `punishSeconds`, `ai.overreachUntil` and `entity.overreachUntil` on the
  brain's clock, the swing released to strike and then stand (`_blowHold = 'spent'`), its melee token kept. The
  window's end (the brain's next turn past it) is TACT2's RECOVER - its hop, its beat, its token handed on. Its place
  gone (`releaseTactics`) ends it. `characters/enemyMotor.js _step`: `overreached` joins the stagger's lock as `locked`
  (CanAct, the walk latch, the detour timers, the follow) - its Hurt is not asked.
- **The spent pose** - `characters/mobileUnit.js`: a held swing's strike is `_struck`; under `'spent'` its
  follow-through - the frame after its strike - STANDS. Read for section 6.1's "the attack's last frame": a list's last
  entries are its second strike and its rest pose (the orc's `[..., -1, 5, 0]`), so the frame the world boss's
  SPENT_FRAME stands for is the one after the blow. When the word goes the swing is over (to idle); a list's second
  strike is never played out of an overreach. The window's end and a stagger drop the swing (`'cancel'`) - a stagger
  in the frame step between the landing and the strike strikes nothing.
- **The answer** - `windupStruck` asks `overreachOpen` first: the first blow that lands staggers (`punishStruck`: its
  weight's `STAGGER_S`, the window shut, the token on, `STAGGER_IMMUNE` begun); inside the guard it is a plain blow
  (null: DFU's knockback). `scenes/hostCombat.js windupDoor` opens to an overreached foe (no meter: the first blow
  staggers it, with TELL1's clang and the x1.5 shove); the three doors' fast path asks for `'overreach'` beside
  `'windup'`. The fold `tell-overreach` (x1.3) rides the TELL1 registry the formulas' tail and a spell's landing read.
- **The perfect dodge** - the brain samples my feet once, the first turn inside `TELL_LATE` of the landing
  (`blow.lateIn`); inside then and out at the landing: the window x1.5 and `ai._perfectAt` stamped (TELL9's tag).
  `tellCues` rings `SOUND.Parry6` at `PERFECT_PITCH` at the landing, once; a miss still LANDs in the ear at its strike.
- **The bound** - one missed blow buys at most a perfect dodge of an iron charge's window, (1.4 + 0.3) x 1.5 = 2.55 s,
  then a light foe's 1.4 s stagger: 3.95 s (section 6.1's 3.1 s left the perfect window out), then 3 s of
  `STAGGER_IMMUNE` and the blow's cooldown.
- **Not built here** - a peer's (6.3, TELL8); the "Perfect" tag on the target bar (TELL9); the charge, the leap and the
  ring's windows ride their shapes in TELL6.
- Pins `test/tell4_punish.test.js` (11): the windows and the bound; ON THE REAL MOTOR a miss overreaching (its window,
  the lock, the token kept, the stand, then RECOVER and the token on, the pose let go), a landing opening none, a late
  dodge perfect and an early one plain, the first blow staggering (its length, the window shut, the token, its Hurt)
  and inside the guard not, its place gone and the switch off; the x1.3; the spent pose on three real lists (and its
  Hurt, and a DFU swing never spent); END TO END one strike and the pose through the window; the door; the ear. Pins
  moved: `tell1_poise` (the doors' fast path, the motor's `locked`, the table); `tell2_tell`'s end-to-end bound read
  from the brain's landing (its 16 Hz tick, then a frame step - the old bound off the blow's own time was too tight).
  The stagger's law and the token's hand-on are one helper each (`stagger`, `handOn`), shared by a broken wind-up and an
  answered overreach. Mutant records re-aimed by content: `audittact` D6, `tact4` (two), `tell1` (seven), `tell2`
  (four).
- Mutants `tools/mutants/tell4.json` (40), all dead.

### TELL5 - BUILT 2026-10-04 (the Enhanced AI switch on, every host)

- **The law** - `ai/tells.js`: `WINDUP_VARY` [0.9, 1.25], `WINDUP_ELITE` 0.9, `WINDUP_RANK` 0.03, `TELL_MIN_WINDUP`
  0.55; `TRACKERS` (lunge, charge), `TRACK_RATE` 120 degrees a second, `TRACK_SHARE` 0.5; `FEINT_CHANCE` 1/5,
  `FEINT_AT` 0.55, `FEINT_GAP` 3, `FEINT_FADE` 0.15 (homed in `ai/blowShapes.js`, the ground reads it); `CHAIN_CHANCE`
  0.35, `CHAIN_WINDUP` 0.5, `CHAIN_FLOOR` 0.45, `CHAIN_GAP` 0.15, `CHAIN_NEXT` (a sweep then a lunge, a lunge then a
  sweep, a slam then a sweep, a ring then a slam). `isElite` (either flag - section 9's reading; TELL3's iron read
  again by it), `revenantRank`, `higherTier` (an elite, a champion, a revenant of rank 2), `windupSeconds`, `feints`,
  `chains`, `chainShape`, `trackYaw`. `ai/foeBlows.js blowFamily`; `makeBlow`'s drawn `windup`.
- **Length** - every wind-up's drawn at its start (`beginWindup`, `ai/tactics.js`): the shape's x U(0.9, 1.25), an
  elite's x0.9, a revenant's x(1 - 0.03 a rank), iron's 0.2 s after, never under 0.55 s; the fill runs on it. A last
  stand's x0.85 joins with RVN4.
- **Tracking** - a lunge turns its mark after my feet at up to 120 degrees a second through the first half of its
  wind-up, the foe facing it, then locks; a sweep and a slam lock at their start. The charge tracks when TELL6 brings
  it. A Patient revenant's 0.7 joins with RVN2.
- **Feints** - a blade of the higher tier, one wind-up in five (never two within three; never a chain's blow): the mark
  fills to 0.55 of its drawn length, then (the brain's next turn past it) the foe cuts it and its held swing goes at
  once as a plain DFU blow - no verdict (`blowConnects` answers DFU's reach), no weight, no overreach. The mark freezes
  and fades out dashed over 0.15 s (`blowPhase`'s `cut`; `render/foeTelegraph.js uCut`); a cut feint is no wind-up near
  the player. No glint and no WIND (TELL2); the plain blow's strike sounds as a LAND. A Patient revenant's one in three
  joins with RVN2.
- **Chains** - a brute of the higher tier, an elite (any family) or a revenant of rank 3, with two shapes or more: at a
  landing at me, hit or miss, one in `CHAIN_CHANCE` holds `CHAIN_GAP` (its strike drawn - the sprite's frame step - and
  its token kept) and winds up its law's next shape from the new facing, `CHAIN_WINDUP` long (an elite's and a
  revenant's quicker, never under `CHAIN_FLOOR`; iron's extra after). The landed blow stays its foe's one wind-up near
  me through the gap (`windupNear`'s `chainUntil`); the punish window opens only after the chain's last blow; a break
  ends it; a knock, a paralysis or a target turned away in the gap spends it. A chain is two blows; a last stand's three
  join with RVN4.
- **Not built here** - the charge's tracking and its chain (TELL6); a revenant's Patient and last-stand numbers (RVN2,
  RVN4); a peer's (TELL8).
- Pins `test/tell5_patterns.test.js` (10): the lengths; the tiers and the families; the turn; ON THE MOTOR a drawn
  length (an elite's quicker), a lunge tracking then locking with its foe turning, a sweep never turning, a feint cut
  into a plain blow (no verdict, no weight, no overreach, its fade, no wind-up near, none from an ordinary orc), a chain
  (its gap, its law's shape from the new facing, quick, the window after its last) and a break ending it, none from an
  ordinary giant; the ground's dashed fade; the ear. Pins moved: `tact4` (a lunge's sidestep after its lock),
  `tell3_iron` (the giant's drawn length; an Elite Dungeon's foe an elite), `tell1_poise` (the table). Mutant records
  re-aimed by content: `audittact` D4, `tact4`, `tell2` (two), `tell3` (five and three for the elite), `tell4`.
- Mutants `tools/mutants/tell5.json` (45), all dead.

### TELL7 - BUILT 2026-10-04 (the Enhanced AI switch on, every host) - before TELL6

- **The order** - built ahead of TELL6: the new shapes need "who throws what" to reach the motor, and this slice is
  that law; each TELL6 shape joins the whole set the moment it exists.
- **The tier** - `ai/foeBlows.js blowTier`: level 10 and up (the entity's live level - Meaner Monsters' after its row),
  an elite (either flag), a champion, a revenant at any level.
- **The whole set** - `blowShapesOf(mobileType, entity)`: an elite, a champion or a revenant (`ai/tells.js wholeSet`)
  adds its kind's ring (the Giant, the Iron and Flesh Atronachs, the Daedra Lord), charge (the Grizzly, the Sabertooth,
  the Wereboar, the Centaur, the Orc Warlord) and leap (the Spider, the Werewolf, the Sabertooth, the Vampire) -
  `extraShapesOf` - each only once it exists in `BLOW`; an ordinary foe of the tier keeps TACT4's one or two. The
  archers' aimed shot rides a ranged token, not a family (TELL6). The brain asks it for a wind-up and for a chain.
- **The cooldowns** - `ai/tells.js blowCooldown`: an ordinary foe 8-15 s, a champion 7-13, an elite 6-11 (the best of
  its tiers), a revenant less 8% a rank (rank 5: 4.8-9); an elite revenant the elite's less its rank. A last stand's
  x0.7 joins with RVN4. `BLOW_COOLDOWN_MIN`/`MAX` read the ordinary range from the table, its one home.
- **Still one at a time** - unchanged (`windupNear`, a chain one).
- Pins `test/tell7_tier.test.js` (5): the tier (the live level); the whole set and what it adds, existing shapes
  only; the cooldowns; ON THE MOTOR a level-1 revenant telegraphing where an ordinary level-1 orc never does, each
  tier's cooldown on the pinned roll. Pin moved: `tell1_poise` (the table). Mutant records re-aimed by content:
  `tact4` (two), `tell1`.
- Mutants `tools/mutants/tell7.json` (16): 14 dead at the slice; 2 recorded equivalent until TELL6's ring existed (a
  family's shapes were its whole set until then) - answered at TELL6a, all 16 dead.

### TELL6a - BUILT 2026-10-04 (the Enhanced AI switch on, every host): the ring

- **The order** - TELL6 is built shape by shape: the ring (6a), the charge (6b), the leap (6c), the aimed shot (6d),
  then what a landing does (6e).
- **The shape** - `ai/blowShapes.js BLOW.ring` (1.0 s, 1.6-4.0 m about its feet, x1.5); `ai/foeBlows.js inBlow`: the
  annulus, all round, safe at its feet and past its edge.
- **The ground** - `render/foeTelegraph.js`: `BLOW_KIND.ring` 3, `blowField`'s mirror of the verdict, the shader's
  annulus (filling outward from its inner edge, its unsigned distance to both edges for the line), `uP` its two radii.
  Each blow its own quad (`quadHalf`: its reach and room for the glow - TELL2 draws 0.5 m out; `uHalf` in the draw
  loop, so the charge's lane will not enlarge every quad); `BLOW_QUAD_HALF` still holds every shape.
  `tools/foeTelegraphProbe.mjs` gains the ring (lit all round, dark at its feet and past its edge: 22 held).
- **Who** - TELL7's whole set: an elite, a champion or a revenant Giant, Iron or Flesh Atronach, or Daedra Lord.
  Heavy and massive bodies all, so iron (TELL3's `IRON_SHAPES`); it never turns (TELL5); it chains into a slam; its
  miss leaves a second's window (TELL4), iron's 0.3 s more.
- Pins `test/tell6a_ring.test.js` (5): the numbers and the verdict all round; every shape's mirror inside its own
  quad with its glow's room; who throws it (and who never does), its iron, its chain and its window; ON THE MOTOR an
  elite giant's ring landing on a player in its annulus, and missing one who hugs its feet - its iron window.
- Mutants `tools/mutants/tell6a.json` (11), all dead; TELL7's two waiting records answered (16 dead).

### TELL6b - BUILT 2026-10-04 (the Enhanced AI switch on, every host): the charge

- **The shape** - `BLOW.charge` (0.9 s, a lane 9 m by 1.6 m, x1.5, run in 0.45 s, begun 5-12 m out); `inBlow`'s lane
  (the lunge's law, its own numbers); the ground draws it on the lunge's branch with its own `uP` and quad; it tracks
  (TELL5); its miss leaves 1.4 s (TELL4).
- **The brain change** - TACT4 only ever wound up in reach. `ai/tactics.js blowPool`: in reach a foe's blows of
  reach; out of it the gap-closers (`GAP_CLOSERS`) whose lane is free - `gapCloses`: 5-12 m, no wall (the collider's
  ray at the chest) and no cover (`ai/cover.js coverDistance`) to the target and a metre past. Who: TELL7's whole set
  of the chargers.
- **The run** - at its landing at me the foe RUNS its lane (`beginDash`, state `dash`): the brain's walk (`_tacDir`) at
  the lane's speed, along the collider - a wall ends it in a skid (`_tacBlocked`); `characters/enemyMotor.js` never
  hands a run to the detour. The verdict is swept between the brain's turns, once (`dashTurn`; the world boss's
  `chargeStrikes` law): my feet within its half-width of the stretch it ran - a hit, and it stops where it met me;
  its time out or a wall - a miss, and it overreaches at the lane's end. Its held swing stands until the verdict;
  `resolveLanding` (the landing's one law, now shared) releases it. Its run is its foe's one wind-up near me
  (`windupNear`'s `dashUntil`). It never chains (its foe ends its lane past its target). Its RELEASE comes before the
  run, its LAND at the strike the run decides (`tellCues` reads a run as a landing still to come).
- `tools/foeTelegraphProbe.mjs` gains the charge's lane (past the lunge's reach and wider: 23 held).
- **Not built here** - the push (TELL6e); an iron charge's knockdown (OPEN 6, TELL6e); a peer's (TELL8).
- Pins `test/tell6b_charge.test.js` (5): the numbers, the lane, the ground's mirror and branch; who and when (the
  band, a wall, cover, the pool in reach and out); ON THE MOTOR an elite grizzly's charge from 6.5 m running into a
  player who stands - a hit where it meets them, stopping short of the lane's end - and an elite Orc Warlord's past one
  who steps out after its aim locks, overreaching at the lane's end and never chaining; the ear. Pin moved: `tact2`
  (the motor never hands a run to the detour). Mutant records re-aimed by content (the landing's one law and the
  pool): `audittact` A6, `tact2`, `tact4` (three), `tell2`, `tell4` (two), `tell5` (four), `tell6a`, `tell7`.
- Mutants `tools/mutants/tell6b.json` (24), all dead.

### TELL6c - BUILT 2026-10-04 (the Enhanced AI switch on, every host): the leap

- **The shape** - `BLOW.leap` (1.0 s, a disc 1.8 m at its point, x1.6, 3-9 m off, its last `arc` 0.35 s the jump);
  `inBlow`: the disc at the blow's `ahead` - its point, my feet at its start, locked. The ground draws it on the slam's
  disc branch with `uP` (r, ahead) and a quad by its own point (`quadHalf(kind, ahead)`); `blowField` takes the
  point.
- **Who and when** - TELL7's whole set of the leapers; a gap-closer beside the charge (`GAP_CLOSERS`): `gapCloses` -
  3-9 m, a clear line to the target (no wall, no cover), ground under its point, never a flyer. A sabertooth (a charger
  and a leaper) chooses between them where both bands meet (5-9 m).
- **The jump** - the wind-up a crouch (the held swing, standing); its last 0.35 s (`jumpAt`) the brain walks it to its
  point at the speed that lands it there on time, a hop on the motor's own gravity (`velY` up, the arc of
  `player/motor.js GRAVITY`); the verdict at its landing, at its point - on me, or on the empty ground I left (its 1.2 s
  window there). It never chains.
- **The ground under a mark, outdoors** - building the leap's fit found TACT4's (AUDIT TACT D8) sampled the ground with
  a ray of meshes alone, which met nothing outdoors, where the ground is the collider's height field: every outdoor
  mark lay flat at the foe's feet on a hillside. `fitBlowToGround` now asks `Collider.surfaceHit` (the nearer of a mesh
  and the ground), and a leap samples the slope out to its point.
- `tools/foeTelegraphProbe.mjs` gains the leap (a disc at its point, nothing at its foe's feet: 24 held).
- Pins `test/tell6c_leap.test.js` (5): the numbers, the disc at its point, its mirror and quad; who and when (the band,
  the line, the ground, a flyer, the pool beside the charge); the mark on the ground at its point and an outdoor lunge
  on its hillside; ON THE MOTOR an elite spider's crouch, its arc and its landing on the player who stood at its point,
  and on the ground a player left - its window there. Pins moved: `tell6a_ring` (a leap's quad by its point),
  `tell6b_charge` (the leap joins the gap-closers). Mutant records re-aimed by content: `audittact` D8, `tell6a`
  (three), `tell6b` (four).
- Mutants `tools/mutants/tell6c.json` (20), all dead.

### TELL6d - BUILT 2026-10-04 (the Enhanced AI switch on, every host): the aimed shot

- **Who** - a class archer (a bow) of the whole set (`aimsShots`): an elite, a champion, a revenant. Section 8.1 says
  "a tier archer"; section 9's table gives an ordinary archer of the tier "-" and the whole set "the aimed shot", and
  TELL7's law (an ordinary foe keeps what TACT4 gave it) agrees - read so.
- **The shape** - `BLOW.aimed` (0.6 s, a line 0.5 m wide from the archer to its target, x1.4, its flight x1.3 as fast);
  `inBlow` and the ground's mirror run its line to its target and no further (`ahead` its length, locked at its start);
  drawn on the lane's branch in a quad its own length. It never tracks, never feints, never chains, opens no window
  (the arrow's flight decides - stepping off the line is the dodge).
- **One shot in three** - the attack component's bow roll, when it comes and the brain said the archer may aim this
  turn (`_aimReady`: its ranged token, its cooldown, no wind-up near me), is aimed one time in `TELL.AIMED_SHARE`
  (`_wantAimed`, drawn on its own `rolls` - never with the switch off); the brain winds it up instead of the shot. No
  held swing (a shot draws none). At its landing `ai._blowShot` (its locked yaw): the attack component draws the bow
  (the ranged token spent as a shot), and the sprite's loose takes it once (`hostCombat.takeAimedShot`) - the arrow's
  heading the line's, its pitch DFU's aim at the live target (`aimedDirection`), its record `{ aimed, speedScale }`
  (`aimedArrowMeta`). A shot never loosed goes stale as a verdict does.
- **In flight and where it strikes** - `combat/arrowFlight.js` and the dungeon's missiles step at `speedScale`; the
  four hosts' arrow hits pass `blowInfo: aimedBlowInfo(m)` to `calculateAttackDamage`, whose tail hands it to the
  `blowTaken` registry; the fold `tell-aimed` weighs it x1.4. The exterior pool's and the dungeon's loose arms, and the
  street hosts' `onArrow` (`world.js`, `exterior.js`, `worldModes.js`), carry it. The ear: no LAND (a shot strikes
  nothing).
- `tools/foeTelegraphProbe.mjs` gains the line (to its target, thin, stopping there: 25 held).
- Pins `test/tell6d_aimed.test.js` (5): the numbers, the line and its mirror; the loose (its bearing and pitch, the
  shot taken once and never before its draw, its flight x1.3 as fast, its weight end to end through the
  formulas); ON THE MOTOR an elite archer's shot wound up instead of loosed - its line to me locked, no held swing, its
  glint, its draw at the landing, no window - and an ordinary archer's never; the pools, the hosts and the ear wired.
  Mutant records re-aimed by content: `audittact` A2, `tell2` (two), `tell4`, `tell5` (two), `tell6a` (two), `tell6c`
  (two). Cites re-resolved (`tools/citeShift.mjs`), two by hand (`chargenSession.js`, `Port-Ledger.md`). Pins moved:
  `exteriorfoes` and `roadh_tail` (three: the shaft's word, `fireArrow`'s eighth argument, the hosts' `onArrow`);
  `tell1_poise` (the table's `AIMED_SHARE`). The
  hosts name `aimedBlowInfo` only for an aimed arrow (`m.aimed ? ... : null`) - `auditpscale1` lifts the dungeon's
  arrow hit into a bare function, which must not meet a name it never needs.
- Mutants `tools/mutants/tell6d.json` (33), all dead.

### TELL6e - BUILT 2026-10-04 (the Enhanced AI switch on, every host): what a landing does to you

- **The law** - `systems/blowEffects.js` (new): `BLOW_EFFECT` and `blowEffectOf(kind, iron)` - the lunge and the
  charge PUSH (3 and 5 m/s), the slam, the ring and the leap RATTLE (0.6 s at 60% of the walk, the camera's dip), the
  sweep BLEEDS (30% of the blow's damage again over 3 s in three ticks), an iron slam, ring or charge KNOCKS DOWN (OPEN
  6: 0.9 s, the eye 0.6 m down and up, no move, no swing, no cast; 5 s before another). A leap never knocks down; the
  aimed shot does nothing but its arrow's damage. A knockdown takes a push with it.
- **The word** - the brain stamps a landing that hit (`resolveLanding`: `ai._blowFx`, its shape and guard - a miss
  none); each pool, where its blow's damage on me is decided, asks `hostCombat.landBlowEffect` (the street pool, the
  dungeon's, the watch's): a fresh telegraphed landing that did damage queues its effect along the blow, from its foe
  toward me; a stale one, a roll of nothing or a plain swing spend the word and do nothing.
- **The body** - `player/motor.js`: `blowPush` (decaying at `BLOW_PUSH_DECAY` 12 m/s/s, stepped after the motor's own
  move along the collider, stopped where the ground ahead drops more than `BLOW_PUSH_EDGE` 2 m - read through
  `surfaceHit`, the terrain too), `blowRattle` (the walk's speed at its share), `blowKnockDown` (no move - the step's
  input emptied - and `eyeAt` down over its first 0.15 s, up over its last 0.3 s), `isDown`.
- **The frame** - `hostCombat.playerBlowFrame`, before the motor's update in all four hosts (`world.js`, `exterior.js`,
  `worldModes.js`, `dungeon.js`): the queue drained (`drainBlowEffects`, the dip on `betterAmbience.weaponKick`) and the
  bleed ticked (`tickBleed`) through the host's own door (`hurtPlayer`, the flash, the surface). The swing is barred
  while down at every host's weapon rig (`knockedDown()` beside the paralysis) and the cast at `hostMagic.castInput`
  (the spell stays readied).
- **The bleed** - `startBleed`/`tickBleed`: a tick a second, its foe's mark on each (REVENANT-HARM's struck mark - a
  death it brings is its foe's); any rise in health ends it (a spell, a potion, a bandage, a rest); a second adds what
  the first had left; a death ends it. Shown with the debuffs (`ui/hudActiveSpells.js`: "Bleeding", its last tick
  blinking) under `BLEED_ICON` - the atlas's first icon, as every bundle that names none draws; a bleed's own icon is
  TELL9's to choose.
- **Not built here** - a peer's (each client applies its own, TELL8); the bleed's own icon (TELL9).
- Pins `test/tell6e_landing.test.js` (10): the law by shape; THE REAL PLAYER MOTOR's push (its v^2/2a, its edge), its
  rattle and its knockdown (no move, the eye down and up); the frame (the push along the blow, the dip, a bleed begun, a
  knockdown taking the push, its 5 s guard); the bleed (its ticks, its mark, a heal ending it, a second adding the
  first's remainder, its HUD row); the pools' word (fresh, damaging, spent either way); the helper's tick through the
  host's door; ON THE MOTOR the brain's stamp for a hit and none for a miss; the hosts, the pools and the gates wired.
  Pins moved: `audittact` D (the watch's weighed blow asks for its landing); `audit39_worldmodes` #34,
  `audit39_worldstate` #59 and 39r, `interiorfoes` IF and `perfrig1` (the rigs' flag takes the knockdown); `duel_wall` DUEL1 (the step's emptied input, the push before the ring's
  clamp). Mutant records re-aimed by content: `duel` (the motor's step), `survtiers` (one cite) and `survtiers3` (three
  cites) - the hosts' cites the shift moved. Cites re-resolved (`tools/citeShift.mjs`) and 24 by hand, aligned by their
  HEAD lines' content; the open flags regenerated (`tools/regenOpenFlags.mjs`).
- Mutants `tools/mutants/tell6e.json` (32), all dead.

### TELL9 - BUILT 2026-10-04 (the Enhanced AI switch on; the enhanced HUD, the ground, both skins' debuffs): on screen

- **The bar's foe on a threat** - `ui/hudFoeTarget.js markFoeThreat`: a foe whose wind-up at me begins (the cues'
  start, `hostCombat.tellCues`, its blow's board the local player's) takes the target bar unless I struck another in
  the last `THREAT_YIELD_S` (2 s - `markFoeStruck` stamps it, the bar's frame tick counts it); its own next wind-up
  refreshes its welcome; a bout's fighter (the versus bar's), a dead foe or a record with no entity never.
- **The poise track** - `ai/tactics.js poiseTrack(ai)`: null for a foe with no brain or with the switch off (no track
  drawn); else 'empty' outside a wind-up, 'windup' (its meter's share of its poise, clamped; 0 before the first blow
  sets the poise), 'iron' ("Iron", full), 'staggered' ("Staggered", full), 'open' ("Open") through an overreach. A
  charge's run reads as its wind-up; a feint as any wind-up (the bar tells no more than the ground); a cut one is gone.
  The HUD's leaf imports no brain: `scenes/hostCombat.js` registers the reading (`setFoePoiseReader`) and `foeTarget()`
  carries it. `ui/enhancedHud.js` draws it under the health (`.hud-foepoise`, its state a class, its fill, its word
  beside it): amber; red and HATCHED for iron (never by colour alone); a white flash at a break (none under reduced
  motion); "Open" with a gold rim. The quest card clears the taller bar (+12 px at the HUD's scale).
- **The words on the hit** - `ui/hitNumbers.js HIT_TAGS`, `tagHit`, `showWord`: the door decides after the formula
  reports, so the door's word joins the number my last HIT raised on that same foe inside `TAG_JOIN_MS` (250 ms),
  beside a backstab's own; none such (a spell's landing raised no number, a miss is no blow) and it rises alone.
  `hostCombat.windupTag`, asked by `windupDoor` for my own blow alone (no `peer`, no `striker`): "Stagger" at a break
  that staggers (an overreached foe's first blow too), "Holds" on a wind-up it does not break, "Open" on an overreached
  foe it could not stagger (inside STAGGER_IMMUNE). DECIDED HERE: a break inside the stagger guard says nothing - the
  mark going out says it, and a fifth word for it would teach a distinction the player cannot act on. A perfect dodge
  says "Perfect" at its landing with its ring (`tellCues`), a little under the reticle where no blow of mine rises.
  "Weakness" is in the table for RVN3 to say. Nothing without the enhanced HUD (the numbers are its own).
- **Telegraph contrast** - a part of the Enhanced AI row (`also`/`parts`: `telegraphContrast`, off, the player's online
  - it is what this screen draws), read each draw (`render/foeTelegraph.js telegraphContrastOn`, `uContrast`):
  `render/telegraphStyle.js telegraphContrast` over the style and iron's mark - the line twice as thick, a WHITE
  keyline outside it, and a poise mark's fill dotted every `CONTRAST_DOTS` (0.3 m, `CONTRAST_DOT_R` 0.06 m); iron keeps
  its hatch alone (no dots on iron), so every guard wears a pattern. A cut feint dashes the bold mark too.
- **The Features note** - one sentence on the blows ("Wound-up blows are marked on the ground: hit hard to stagger,
  dodge to punish; red, hatched iron cannot be stopped."); the rest said shorter to stay inside FT15's 450 (449).
- **The bleed's own icon** - `ui/hudStatus.js STATUS_GLYPHS.bleed`: two drops of blood on the kit's 16 px grid,
  outlined 8-way (the kit's law), seen in Chromium over dark and light. Both skins: the enhanced widget's tile
  (`afflictionRows` - "Bleeding", its ticks at its foot, the last blinking; TELL6e had shown the bleed on the classic
  row alone, and the enhanced widget, which reads the bundles, never) and the classic row (`hudActiveSpells.js`, its
  index still the atlas's first for DFU's shape, drawn from the glyph - `statusGlyphColor32` uploaded once a name).
- **Not built here** - the peers' side of every word and track (TELL8); "Weakness" said (RVN3); a revenant's ember on
  the track (RVN).
- Pins `test/tell9_screen.test.js` (9): the track's law (every state, the clamp, the switch); the bar's foe on a threat
  (the 2 s yield, the refresh, a bout, the dead, the poise riding the target); ON THE REAL BRAIN a wind-up taking the
  bar through its cues, the track filling as my blows hold and "Staggered" at the break, a blow at another target
  marking nothing; the words (the join, its window and target, a miss, the door's mine-only gate, "Open" and "Stagger"
  on an overreached foe, unmounted nothing); "Perfect" once; the contrast part and the pass's upload (the pref, a
  caller's word); the bleed's glyph, tile and classic texture; the note; the HUD's track and the sheet. Pins moved:
  `enhancedHud` PX30 (the read carries `poise`), `ft5_enhancedai` (the row's part), `ui3_status` (twelve glyphs),
  `foebar1_blade` (the track under both faces). `tools/foeTelegraphProbe.mjs` reads the contrast off a real frame (29
  held): the line where the dark keyline was, a white keyline lit in blue as in red, the poise fill dotted, iron's hatch
  unchanged. Mutant records re-aimed by content: `audit1003_ui` U3 (two - markFoeThreat holds the same guard), `tell4`
  (the ring shares the word's line).
- Mutants `tools/mutants/tell9.json` (50), all dead.

### TELL8 - BUILT 2026-10-04 (the Enhanced AI switch on - forced on for everyone online; both streams): online

- **The owner's word** - `ai/puppetBlows.js blowWire` (new module): each live foe record carries its wind-up - `wk`
  its shape (0-6, `WIRE_KINDS`) +8 iron +16 a feint, `wy` its yaw, `wl` ms to its landing (clamped to 3000), `wo` its
  origin through the record's own projection, `wp` a leap's or a shot's point - and `ws` 1 staggered, 2 overreached.
  None for a cut feint, a landed blow (a charge's run is its landing) or a puppet. Written in both streams
  (`exteriorFoes.js foesFrame` - the watch rides it too - and the dungeon's `roomRecord`); the dedupe key carries the
  blow and its state (`blowWireKey`), never `wl` (it runs down every frame; the landing it names is fixed).
- **The law** - `net/wire.js validFoeRecord`: the four wind-up fields together or none, each bounded (`FOE_WINDUP_MS`
  3000, `wo` as `f`, `FOE_WINDUP_REACH` 64 m for `wp`), `ws` 1 or 2. The relay forwards both unread; its bundle
  carries wire.js, so **`RELAY_VERSION` world162** (`test/relayversion.test.js`'s row; 25 pins moved with it).
- **The puppet** - `applyBlowRecord` (both readers, the exterior's `applyPuppetRecord` and the dungeon's
  `applyFoeRecord`) keeps a SYNTHETIC brain state on the puppet's `ai._tac` (`puppet: true`), so every reader of a
  wind-up reads a peer's foe as its own: the ground (the mark from `wl`, part-filled by the shape's nominal length), the
  glint (none for a feint), the cues (WIND, RELEASE, LAND - `tellCues` now runs for puppets in both pools), the target
  bar (the threat, the track). A re-sent record of the same blow turns it (a lunge's tracking); a record written before
  its landing and read after it is no new blow. The field gone before the landing: a feint's cut (its mark dashes, its
  swing goes on as a plain blow) or a break (the mark gone, the held arm cancelled once). `puppetBlowTurn` each frame:
  the state kept seen, the sprite's hold (true through the wind-up, 'cancel', 'spent' through an overreach), the
  stagger's Hurt. `ws` stands on the puppet's entity (`staggerUntil`/`overreachUntil` at `PUPPET_HELD_UNTIL`, finite so
  the fold reads it) - my roll against it takes x1.25 and x1.3, cleared when its owner says it ended.
- **Each judges their own feet (10.3)** - a puppet's wind-up AT ME (the exterior: the blow's own recipient `b`; the
  dungeon: its `g`) lands on my feet at its landing: the verdict, the shape's weight and its effect on the puppet's `ai`
  exactly as a local landing leaves them, so its swing resolves through the host's own door (`resolveFoeMeleeVsPlayer`
  -> `blowConnects`, `blowScaled`, `landBlowEffect` - the push, the rattle, the bleed, the knockdown, on my machine);
  the late sample makes a perfect dodge mine (the ring, "Perfect"). The leap gate (AUDIT WORLD6b-iii(a) B7) lets a
  charge's or a leap's blow through inside a verdict's life (`puppetGapLanded`).
- **The owner's brain (10.2, OPEN 9)** - `ai/tactics.js targetFeet`: a foe winds up at the peer it hunts as at me (the
  engage branch, the chain, tracking, the late sample, the charge's run) - one wind-up near each target. At its landing
  the owner's view of the peer's feet decides its window (6.3) and its chain - never the damage: `resolveLanding`'s
  `atMe` leaves no verdict, weight or effect to land on anyone here. A puppet handed to me (its owner gone) drops its
  synthetic state at its first step.
- **Poise from peers (10.4)** - `blowClassOf` judges my blow on a puppet winding up on my machine (its K by kind and
  weapon, my feet behind its facing, the weakness flag for RVN3) and the hit carries it as `wc` (`net/wire.js
  hitClassField`/`hitClassOf` - K x100 +1000 back +2000 weak, one bounded integer) - the exterior divert, the dungeon's
  two lanes, the watch's door (world.js); the owner's `windupDoor` weighs a peer's blow by it. Without one, K_PEER and
  never from behind - before it the back flag was judged from the OWNER's feet, a latent fault.
- **Decided here** - `wp` is the point's distance along `wy` (a number, not a vector: the leap's disc and the shot's
  line both lie along the yaw). The puppet's held frame is the owner's own mechanism (`hold` into `MobileUnit.update`),
  not a host-side `heldPose`: the same machine strikes the same frame after the landing. A charge at a peer is judged
  at its landing by its lane, not swept along a run the peer sees through a 200 ms stream. An aimed shot is never wound
  up at a peer (its arrow is its owner's flight); onlookers see its line. A puppet's poise track shows its state, not
  its meter (`taken` is the owner's and not on the wire - it reads empty until it breaks).
- **Not built here** - RVN13's fields (`ad`, `wq`, `p2`, `rt`); a revenant's ember on a puppet's mark (RVN5).
- Pins `test/tell8_online.test.js` (10): the record's law field by field; the owner's word (the flags, the clamp, the
  projection, the key without `wl`); the puppet's state (the part-filled mark, its colour and glint, its tracking, kept
  seen, the late record); the field gone (a feint's cut, a break's cancel), the stagger and the overreach on its entity
  through the real fold; each judging their own feet (the verdict, the weight, the effect, the perfect dodge, an
  onlooker, the aimed shot, the gap-closers' gate); ON A REAL SPRITE the held arm and the strike after the landing; THE
  OWNER'S REAL BRAIN at a peer (a miss opening the window, a hit leaving nothing to land); a handed-over puppet; the
  class's round trip and the door weighing it; both hosts by source. Pins moved: `audittact` (the opportunist's gate),
  `auditworld6b` B1, `auditworld6biii` B7, `tell1_poise` (the dungeon's Hurt), `tell2_tell` (the pools' cues), `watch1`,
  `world2`, `world3`, `world6b`, `world6biiie`, `auditpscale1`, `staffTeleport` (world162 supported), and the relay's 25
  pins. Mutant records re-aimed by content (19): `auditpscale1` (two), `audittact` D6, `soc1` S38, `tact4` (two),
  `tell2`, `tell4` (two), `tell5` (three), `tell6b` (two), `tell6e`, `watch1` (four).
  Cites re-resolved (`tools/citeShift.mjs`, 91) and two by hand, by their HEAD lines' content.
- Mutants `tools/mutants/tell8.json` (58), all dead.


### AUDIT TELL - 2026-10-04 (Mac: "Let's do a comprehensive audit over everything ensuring perfection")

TELL1-TELL9 read again whole - the brain, the wire, the landing on the player, the four hosts and three pools, the screen
and the ground - every finding verified against the code before it was fixed. "Every host" in the records above is the
four by name: `scenes/world.js`, `scenes/exterior.js`, `scenes/worldModes.js` (a building and a dungeon under either)
and `scenes/dungeon.js`; the pools are `exteriorFoes.js` (the street, a building's foes), `cityGuards.js` (the watch)
and `dungeonContext.js`.

- **The brain (B1-B11)** - a wind-up, a charge's run or a chain's gap is BROKEN where the brain was not asked
  (`tactics.breakWindup`): the motor's CanAct (a paralysis, a knock, a Calm), a flight, a step the foes' own clock did
  not take past `BLOW_STALE` (a pool not stepped, a held window) - before, it held every blow, glinted and landed
  untold; `windupHolds`, `foeGlint` and `poiseTrack` say nothing of a state nobody stepped (B1). The run breaks as the
  wind-up does - a skipped step, CanAct, a knock, its foe turned on another (B2). A leap lands on its disc only where
  its foe got to (B3). A released place takes the archer's aimed shot (B4). A puppet handed to me drops its owner's held
  swing, verdict, effect and the stagger or overreach it said stood (B5). No feint on a gap closer (B6). The engage
  branch aims at its TARGET's feet, not the motor's destination (B7). A blow knows whom it is aimed at (`b.key`): a foe
  that turns on another breaks it, and a chain fires only at its own target (B8). A chain waits for the first blow's
  verdict to be spent, at most `CHAIN_SPEND_MAX` 0.6 s (B9). A recentre moves a run's head (B10). A plain shot drops a
  stale aimed one (B11).
- **Online (O2-O7, relay `world163`)** - the owner SAYS its landing: for `WIRE_LANDED_S` 0.5 s after it the record
  carries the blow with `wk` +`WIRE_LANDED` 32 and `wl` 0, and every blow its serial `wn` (its foe's own count, mod
  256) - a receiver whose clock runs behind lands it on that word instead of reading the field gone as a break; a new
  serial lands the live one first (a chain), the same serial after its landing is nothing new, an overreach record lands
  it (O2). A brain that was mine gives up its tokens when its record makes it a puppet (O4). A perfect dodge is the
  dodger's own - the owner stamps none at a peer (O5). A puppet's gap-closer lets its one blow through at me alone, once
  (O6). `HIT_CLASS_K_MAX` 175 - a two-handed blunt weapon's K (1.725) rode the wire clamped (O7). `wire.js` moved, so
  `RELAY_VERSION` **world163** and its `relayversion` row.
- **The landing on the player (L1-L9)** - a dead body takes nothing: no bleed begun, a running one ends, the queue
  dropped (L1: a bleed's tick on a corpse was a second death, two revenants for one). A load forgets the last game's
  landings (`resetBlowEffects`, `save.restorePlayer`), and a placement (`motor.spawn`) stands the body up and stills it
  (L2, L7). No push on a body the motor or the hands hold (a teleport's settle, a climb, a hold, a mantle) - dropped,
  never stored for the let-go - and a push snaps to the ground only from it (L3). Nothing knocks down a climber, a
  hold, a mantle, a swimmer or a levitator: the motor refuses, the guard stands unspent and the blow pushes instead
  (L4). The bleed deals its whole and no more - a bleed of 1 was three ticks of 1 (L5). The pools ask with what reached
  health, after the hurt - the court's interception, a shield, `/god` - never the roll (L8). `knockedDown()` follows
  the body the knockdown took (L9). The hosts: the foes' clock held under a dungeon's window in all three that host one
  (H1); the building's blow frame runs under a window as the street's do (L6/H5 - its foes keep their clock there); the
  stagger's camera kick reaches the watch, the exterior route's street pool and its modes, and the standalone dungeon,
  for my own blow alone (H6); a peer's blow on a building's watch carries its class and kind (P1); the dungeon's back
  flag judged from the blow's own feet, as the local door judges it.
- **The screen and the ground (U1-U10)** - every band of the mark metres-capped (`TELEGRAPH_BAND_CAP` 0.1,
  `CONTRAST_BAND_CAP` 0.0625), so a grazing look no longer cut the keyline and the glow off at the 0.5 m the pass draws
  (U1); the contrast keeps a dark band between its line and its white keyline (U2); the poise word centred under the
  track and the quest card clearing it (U3); the flash on THIS foe's break alone, never on a bar turned onto a
  staggered one (U4); the card re-measured when the track comes or goes (U5); a foe's own spell or a SetHealth(0) raises
  no word of mine (U6); no foe's wind-up takes the bar from my duel's opponent (U7); the sweep's rear disc outlined (U8);
  nothing allocated a frame for a foe with nothing telegraphed or a glint that changes (U9); nothing past 0.5 m is
  dropped ahead of the derivatives - drawn as nothing instead (U10).
- **The arc's promises, built at last** - THE SHATTER (3.2): a wind-up its poise broke (or a puppet's its owner
  staggered) is drawn `BLOW_SHATTER` 0.25 s more - white, whole-filled, cracked into shards, going out (`uShatter`),
  never the landing's whole white flash and never live (`foeBlows.shatterBlow`). THE BLEED'S DRIPS (8.2):
  `bloodBleed`'s ledger drips a sweep's wound whatever the health - at least `WOUND_SHARE` 0.5 of the drops every
  `WOUND_WAIT` 1 s (the hosts' view says `wound`). The dungeon stream's gap is FLAGGED where FEUD writes its fields
  (10.1, 32).
- **The duel harness (section 28)** - `tools/tellDuel.mjs`: the real brain, motor and attack component on a real
  collider's floor, the real foe (`makeEnemyEntity`, `promoteEliteFoe`), the real roll (`calculateAttackDamage`) and
  swing tempo (the weapon in the hand), a seeded player at the foe's front who trades blows or dodges; armed with the
  least metal that bites (a werewolf silver, a Daedra Lord mithril). A thousand fights a cell, 30 s each (243 s):

  | Weapon | Foe | wind-ups at me | struck | broken | of struck |
  |---|---|---|---|---|---|
  | Dagger | Orc | 2087 | 1036 | 11 | 1.1% |
  | Dagger | Orc (elite) | 2133 | 817 | 1 | 0.1% |
  | Dagger | Werewolf (silver) | 2102 | 793 | 0 | 0% |
  | Dagger | Giant | 1048 | 332 | 0 | 0% |
  | Longsword | Orc | 2095 | 871 | 570 | 65.4% |
  | Longsword | Orc (elite) | 2061 | 710 | 287 | 40.4% |
  | Longsword | Werewolf (silver) | 2106 | 693 | 213 | 30.7% |
  | Longsword | Giant | 1048 | 272 | 0 | 0% |
  | Warhammer | Orc | 2088 | 699 | 632 | 90.4% |
  | Warhammer | Orc (elite) | 2033 | 502 | 373 | 74.3% |
  | Warhammer | Werewolf (silver) | 2082 | 556 | 400 | 71.9% |
  | Warhammer | Daedra Lord (mithril) | 1054 | 25 | 3 | 12.0% |
  | Warhammer | Giant | 1081 | 232 | 0 | 0% |

  (A Daedra Lord's wind-ups are iron one in two, and DFU's hit roll lands 3.3% of a level-10 player's swings on the
  level-20 lord - 64% on an orc, 36% on a giant; an elite's iron is about a third of all its wind-ups.) LIGHT holds (1.1% <= 15%), HEAVY holds (90.4% >= 60%), FAIR holds (out of the shape by 70%
  of its wind-up, 0 of 11 483 wind-ups landed), and MASSIVE held only once TUNED: at `POISE_W.massive` 0.5 alone a
  Giant's poise followed its 18-74 health roll down to 9, and a reference player's steel warhammer (31) or longsword
  (16) broke the weak rolls in one blow - `POISE_FLOOR_MASSIVE` 60 now stands above the largest single front blow in
  the game (a daedric warhammer at Strength 100: 34 x 1.725 = 58.6, 97.7% of it). Section 28's two break targets read
  "of the wind-ups its blows land on": one swing at most comes in a wind-up, and DFU's hit roll on it - a miss breaks
  nothing whatever the weapon. The revenant's targets (dodging pays, the will, the ranks) are RVN's, measured when it
  lands; a class Warrior needs its CLASS*.CFG (ARENA2's data, not in the repository).
- `tools/foeTelegraphProbe.mjs` gains the contrast's dark band, the rear disc and the shatter (white, cracked, going
  out): **34 held** in Chromium.
- **Not built here** - the live Playwright run of a real fight (no ARENA2 in this tree); RVN's harness rows.
- Pins `test/audittell.test.js` (25), and two in `test/tell8_online.test.js` (O2; B8, O4, O6). Pins moved (each
  marked): `tell5_patterns` (the rig spends the verdict a frame step after its landing; B9), `tell9_screen` (a charge's
  run reads empty, an unseen state; the word and the flash, U3/U4), `tell8_online` (`wn` on every record; P1),
  `audittact` (H1 in three hosts; the watch's L8), `tell6e_landing` (the building's frame, L6; the pools' word, L8),
  `watch1` (P1, two), `tell2_tell` (the glint in place, U9), `tell1_poise` (the floor in the table and the law, the
  giant's hold; a test's name that named a light foe it never staggered), `tell6d_aimed` (its flight x1.3, not "half
  again"), `world2` (the dungeon stream's FLAGGED gap above its wind-up), `world6b`, `world6biiid` and `world6biiie`
  (the watch's door with a blow's kind, P1), `relayversion` (the world163 row) and the relay's 25 pins
  (`staffTeleport` lists world163).
- Mutants `tools/mutants/audittell.json` (78), all dead. Mutant records re-aimed by content (58): `tell8` (25), `tell9`
  (7), `tell6e` (5), `tell4` (4), `watch1` (4), `tell5`, `tell6b`, `tell2`, `tact4` and `audittact` (two each),
  `tell6d`, `blood1` and `soc1` (one each) - every one judged again, all dead (`TELL8-gap-forever` survived its first
  re-judging and has its pin now); and `survtiers` and `survtiers3` (one each: the hosts' cites the shift moved).
  Cites re-resolved (`tools/citeShift.mjs`, 310) and 21 by hand, aligned by their HEAD lines' content; Port-Status's
  section-2 identifiers and prose ledger cites moved for the new section-A row (271 rows, 256 standing); the open
  flags regenerated (nine - this record's) and every page that counts them; an edit of this audit's own that split
  `exterior.js`'s `climbFeel` from its comment put back.

### RVN1 - BUILT 2026-10-04 (the loot-rarity row on - the revenants' switch; every host)

- **The ledger** - `systems/feudLedger.js`, a LEAF (it imports nothing: the brain, the effects and the doors write it,
  and none may bring the revenant system). It lives on the foe's ENTITY (`entity._feud` - section 12 named the pool
  record; every seam that writes it holds the entity, and the brain and the effects hold nothing else), opened the
  first time anything is written for a body the gate passes: `dmg` by `FEUD_CLASSES`, `silver`, `staggers`, `dodged`,
  `perfect`, `backHits`, `backstab`, `weak` (RVN3 writes it), `night` (the sky's minute when it opens), `place` (the
  pool's `_feudPlace`, else `street`) and `start` (the character's minute). `revenant.js` hands it the gate
  (`revenantCandidate`) and the clock (`ownMinutes`, `worldClock.isNight(skyMinutes())`) once, at import. Never the
  player's, whatever a gate says.
- **Written from** - the formulas' tail: `registerPlayerStrikeListener('feud')` (the blow's final damage; its class by
  `revenantFeud.weaponFeudClass` - the skill through `weapons.weaponSkillUsed`, a bow's shaft an arrow, none
  hand-to-hand; silver by `WEAPON_MATERIALS.Silver`), and the tail now hands every strike listener a fifth argument,
  `{ backstab }` (the formula's own note). `hostMagic.applySpellToFoe`'s landing (my spell alone - its striker the
  player, never a peer's stand-in or a foe - by `elementFeudClass(spell.element)`, the amount as the target took it
  after `blowTaken`; a round left to the round). `effects.js runEffectRound` (my round on a foe - no caster, or the
  player and no peer - by `a.element`; the sinks unchanged). `ai/tactics.js beginOverreach` (at me: `dodged`, and
  `perfect` on TELL4's late sample). `scenes/hostCombat.js windupDoor` (my blow alone - `fromPlayer`, no peer, no
  striker - one `mine` for the tag and the ledger: `staggers` on a stagger, `backHits` on a blow behind the wind-up's
  own facing, judged as the poise judges it).
- **The place** - `scenes/exteriorFoes.js spawnFoe` tags `street`, or `building` where its host says the player is
  inside (`worldModes.js`'s interior pool); both of `scenes/dungeonContext.js buildFoeAt`'s builds (a person, a monster)
  tag `dungeon`. A snapshot copies named fields only: a ledger never rides a save.
- **The fold** - `revenantDeed` takes the ledger first (whatever its answer - a judged one's, a plain foe's) and, for
  the record it writes, adds `feudScars(ledger, deed)` at the deed's minute (`withScars`, the latest six) and counts the
  fight; `applyRevenant` counts a return. A rank-up to 2 or more draws the signature on the id.
- **The record** - `systems/revenantFeud.js` (every RVN number at its top, section 27's): `feudFields` - section 26's
  table, each field's validator and an older record's value - spread into `sanitize`; `newFeudFields` for a record born
  now (its weakness drawn against its career's tolerance flags, `entity.career`); `sanitizeCompanion(c, personality)`
  adds `loyalty` (`LOYALTY_START`, else 60); the store's `lastDay` (`sanitizeDay`; the mirror's and the save's merged
  by `laterDay`) in the slot, the mirror, the restore and a new game. The deed union gains `felled`, `routed`,
  `festered`, `deserted`, `betrayed`, `laststand`, and `ui/revenantPage.js DEED_WORDS` words them.
- **The draws** - on the id's own stream (`idStream`: FNV-1a, then mulberry32; `revenant.js` takes `hashStr` from
  here), never the shared DFRandom: the weakness from section 14.1's pool by kind (`weaknessPool`; decided here: an
  OPPOSITE only for the fire and frost daedra and atronachs - the Daedroth, a Seducer, the Daedra Lord and the iron and
  flesh atronachs have no element; a monster the table does not name is a beast), never an element its career resists
  or shrugs off; the signature by family (`signatureFamily` - the brain's `blowFamily` table read without the brain; a
  caster, a spectral, a small kind and a flyer the pyre); the kin (`kinPool` - a person its class's family, an orc its
  faction's, the undead theirs, a beast, a vermin or a fish its own kind; decided here: a solitary kind - a giant, a
  daedra, a lich, an atronach, `mobileFactions.SOLITARY_TYPES` - rides alone), three drawn (`RETINUE`'s most).
- **The page** - a living revenant's scars in words under its due line (`scarWords`, newest first, each once - a deed's
  scar is its history's); RVN12 completes the rest.
- **Four hosts** - `scenes/world.js` WIRED (the street pool's tag and doors; the seams are the formulas', the cast
  engine's, the effects' and the brain's, host-blind); `scenes/exterior.js` WIRED the same - FLAGGED, as section 32
  says: it builds its pool without `fates`, so its revenants die outright; `scenes/worldModes.js` WIRED (its interior
  pool, `building`); `scenes/dungeonContext.js` WIRED (both builds `dungeon`; `scenes/dungeon.js` hosts it).
- **Online** - the ledger is mine: a peer's blow, spell and round write nothing in it, and my blow on a peer's puppet
  writes one that no deed folds (a puppet's deeds are its owner's - RVN13's to carry).
- **Section 32's corrections** - `06-Systems/Revenants.md` already said the Holdings tab and `world153` (read
  again); it gains the fields (section 5) and the ledger (section 17).
- Pins `test/rvn1_ledger.test.js` (16). Pins moved (each marked `PIN MOVED (RVN1: ...)`): `tell1_poise` (the landing
  notes between the take and the sink), `audittell` (one `mine` for U6's tag and the ledger).
- Mutants `tools/mutants/rvn1.json` (85), all dead: three survived their first run - the player under an always-open
  gate and an older record whose draw was the mutant's own `fire` (each pinned now), and the beast row in `kinPool`,
  equivalent to its fallback (the row deleted, the fallback commented and its mutant recorded). Mutant records
  re-aimed by content (8): `tell9` (3), `audittell`, `tell8`, `set2`, `revenant` and `revenantvoice` (one each) - all
  judged again, all dead.

### RVN2 - BUILT 2026-10-04 (the loot-rarity row on; the brain's parts with the Enhanced AI switch; every host)

- **Learning** - `revenantFeud.lessonOf(kinds, learned, mobileType, career)`: the first of the fight's scars
  (`feudScars`' order - its leading source first) that teaches an adaptation it does not hold; decided here: one it
  holds passes the lesson on (it learns the next thing you lean on), `mixed`, `other` and a plain deed teach nothing, a
  kill begun by night (`night` with `slew`) teaches the Night-stalker and RVN10's `routed` the Relentless, silver only a
  kind silver doubles against (`SILVER_DOUBLED_KINDS`: DFU's Skeletal Warrior, PCAAO's six), an element only where its
  career has no tolerance of it (stacked on DFU's own it was immunity). `withLesson`: at most `min(rank, ADAPT_MAX)`, the
  oldest forgotten; `feudFields` holds a record read back to its rank's. `revenantDeed` learns one a deed, after its scars.
- **The edge** - `revenantFeud.adaptEdge(learned, weak)`, frozen, every number `ADAPT`'s; `revenant.js revenantStamp` puts
  it on the entity with the name, rank, learned and weakness at the deed (the foe that did it, at once) and at the stand
  (`applyRevenant`). The brain, the motor, the doors and the formulas read `entity.revenant.edge`. A sworn one's stamp
  (`revenantCompanions.js`) carries none - decided here: what it learned it learned against the player.
- **Weapon classes** - `registerBlowTakenMod('revenant')` (the formulas' tail and a spell's landing): Mailed blades
  x0.7, Hewn-hard axes x0.7, Braced blunt x0.75, Unflinching bare hands x0.6, Arrow-wise arrows x0.7 (`adaptBlowClass`: a
  bow's shaft an arrow, a weapon its class, bare hands a person's - decided here: a monster's own body is none of them).
  Nothing touches its weakness: its class is left out of `taken`, and a blow of its metal is untouched.
- **Elements** - `registerEntityFold('revenant')`: `resist[element]` +25 (the correction above), folded at the stand and
  the deed (`computeEntityMods`) and on every magic round after; never its weakness's element.
- **Silver-scarred** - `formulas.registerSilverDoubleVeto` / `silverDoubles(target)`, asked by both cores where they
  double silver (`weaponAttackDamage`'s Skeletal Warrior; `pcaaoWeaponAttackDamage`'s seven); a silver weakness keeps it.
- **The brain's table** (`ai/tells.js`) - `poiseSpecial` x `edge.poise` (Braced 1.4, Steadfast 1.5); `blowGuard` iron on
  the larger of an elite's third and Steadfast's half, one roll, drawn only where either is; `windupSeconds` on Patient's
  U(0.85, 1.35); `feintChance` (Patient's one in three) and `trackShare` (Patient's 0.7), which `ai/tactics.js` reads.
- **The brain** - `beginWindup` draws its feint against `feintChance`; `windupTurn` tracks through `trackShare`; an
  Arrow-wise revenant out of reach winds up its charge or leap with no `BLOW_CHANCE` roll whenever its lane is free
  (decided here: "the charge or the leap if its kind has one" read as it always closes).
- **The motor** - `characters/enemyMotor.js speed` adds `_edgeSpeed()`: Arrow-wise +20 while its target is past 8 m.
- **The doors** - `hostCombat.backstabChanceOf(player, facing, foe)` answers 0 for a Watchful one (no tally), every door
  handing the foe in (`arrowFlight.js`, the dungeon's swing, the street's, the watch's); `playerWeapon.foeUnaware`
  false; `windupDoor` weighs no back multiplier on its poise (the ledger still counts the back hit).
- **The stand** - Relentless +25 on `stats.speed`; a Night-stalker's blows x1.15 (decided here: at its stand - it comes
  only by night, `revenantToReturn`); `exteriorFoes.js` never culls a Relentless one hunting me (`_relentless`).
- **The page** - "Learned: Arrow-wise, Mailed." (`learnedWords`); RVN12 adds each one's effect.
- **Four hosts** - `scenes/world.js` WIRED (the street pool's cull and backstab door; the rest is host-blind: the
  formulas, both cores, the brain, the motor, the fold); `scenes/exterior.js` WIRED the same - FLAGGED (section 32): no
  `fates`; `scenes/worldModes.js` WIRED (its interior pool and the watch's door); `scenes/dungeonContext.js` WIRED (its
  swing's backstab; `scenes/dungeon.js` hosts it).
- **Not built here** - a peer's blow on my revenant rolls against its puppet, which carries no adaptations until
  RVN13's `ad`; the taunt that names one (RVN12's `{how}`).
- Pins `test/rvn2_adapt.test.js` (11; the fold's revenant on a fixed id - a drawn weakness among the fights' had made
  it flaky, which the gate caught). Pins moved (each marked `PIN MOVED (RVN2: ...)`): `rvn1_ledger` (a record holds
  its rank's), `audit18_hosts_dungeon` (the shaft hands its foe to the backstab), `auditworld6bii` and `questparty2` (the
  cull's A2 and Q4). The edge's class reader is `adaptBlowClass` (the gate's one-name law: `ai/puppetBlows.js` owns
  `blowClassOf`).
- Mutants `tools/mutants/rvn2.json` (62), all dead: five survived the first runs (the sanitize cap, a monster's claws -
  a rat's bite too small to weigh, the career at the real deed, the shaft's backstab door and its three siblings, the
  page's row) and each has its pin. Mutant records re-aimed by content (12): `tell3` (4), `tell5` (2), `rvn1` (2),
  `auditqp`, `revenant`, `set2` and `tell6b` (one each) - all judged again, all dead.

### RVN3 - BUILT 2026-10-04 (the loot-rarity row on; the staggers with the Enhanced AI switch; every host)

- **The law** - `systems/revenantFeud.js`: `WEAK` (x1.5 struck, x1.25 the daylight's, -50 an element's), `isWeakBlow`
  (its class, its metal - `metalOf`: silver, elven, dwarven - or, for the daylight, every blow while the sky reads day),
  `willMatters` (rank 3 and up), `willBroken` (the fight's ledger: `weak` struck, or `staggers` 2), `FLINCH_HEALTH` 0.5,
  `FLINCH_LINES` (fourteen, one a weakness, the narrator's), `WEAK_NAMES`, `WEAK_HINTS`.
- **One test of a weak blow** - `feudLedger.setFeudWeakTest` (registered by `revenant.js`; the leaf asks it): the ledger's
  writers with `{ cls, metal }`, a door with `{ kind, weapon, element, attacker }`. `noteFeudHarm` counts `weak` and
  tells the reveal. The strike listener passes the weapon's metal.
- **Struck** - `registerBlowTakenMod('revenant')`: the daylight's x1.25 by day on every blow (a spell's landing too),
  a class's or a metal's x1.5 - and no adaptation takes from a blow of it; an element's -50 on the fold (beside its
  adaptations', never touching it). On a wind-up `hostCombat.windupDoor` weighs it x `POISE_WEAK` - mine by my weapon,
  a striker's by its own, a spell's by its ELEMENT, now threaded: `hostMagic`'s landing hands `element` to the sinks,
  every host's player spell sink (`world.js`, `exterior.js`, `worldModes.js`, the dungeon's) hands it to its pool's
  door, and both doors (`damageFoe`) to the poise door.
- **Revealed** - my first blow of it in a stand (`revealWeakness`): the "Weakness" word on its number each blow (after
  the number, a microtask), the hiss (`SOUND.Burning`) where it stands through the player's door (`playerDoor`'s new
  optional `sfx` and `say`, published by the cast engine), and - the first time - the record's `weakKnown` 2 and its card
  (*Weakness*: "Blades - its weakness, laid bare."). A daylight weakness is struck by any blow of mine by day (decided
  here: the sun is on it).
- **The flinch** - `revenantFlinch(f)`, asked beside the taunt in both pools: under half its health, its weakness
  unknown, once a stand - the narrator's line (no voice), `weakKnown` 1.
- **The will** - `revenantFate.revenantWillHolds(f)` at both yield seams (`exteriorFoes.js`, the dungeon's, a room's
  shared foe online still never): unbroken, it does not kneel - `beginTearAway(f, done)`: held at 1, its run over, its
  body ashing out on the ember lane (`portalFx` with a `tint` - `fateDissolve` reads it; a portal's stays arcane) inside
  the pools' leaving hold (`f.leaving`, 900 ms; decided here: the companion portal's hold, already fate-held everywhere,
  and both damage doors now refuse a body leaving), whose hand-off is the escape - `escapeFoe` / `escapeDungeonFoe` with
  `unbroken`: the `fled` deed (it ranks up and learns from the fight) and its card (*Unbroken*: "Grushnak staggers into
  the smoke, unbroken.", its escape words). Broken, it kneels as ever; rank 2, it kneels; a Disintegrate's whole kills -
  and `exterior.js` and `worldModes.js`'s encounter spell sinks, which dropped `whole` (world.js's and the dungeon's
  passed it), pass it now: there, a Disintegrate on a revenant made it kneel.
- **The page** - "Weakness: unknown." / "Weakness: An element." / "Weakness: Fire."; from rank 3 "Its will must be
  broken - strike its weakness, or stagger it twice." (`weaknessWords`, `willWords`).
- **Four hosts** - `scenes/world.js` WIRED (its spell sink's element; the street pool's seam, flinch and tear-away);
  `scenes/exterior.js` WIRED (its sink's element and `whole`) - FLAGGED (section 32): no `fates`, so its revenants die
  outright and the will never asks; `scenes/worldModes.js` WIRED (its sink's element and `whole`; its interior pool);
  `scenes/dungeonContext.js` WIRED (its seam, flinch, tear-away, sink; `scenes/dungeon.js` hosts it).
- **Not built here** - rumour's hint (RVN7); the will on a peer's screen (RVN13); a voice for the flinch and the will
  (RVN12).
- Pins `test/rvn3_weak.test.js` (9). Pins moved (each marked `PIN MOVED (RVN3: ...)`): `revenant` and `revenant_card`
  (the escapes' `unbroken`), `revenant_fate` (the dungeon's seam), `rvn2_adapt` (its weakness now x1.5 and -50), `tell1_poise`, `exteriorfoes`,
  `hostmagic_wiring`, `audit26_combat`, `audit68_review`, `audit68_worldjs`, `auditworld6biii`, `enchantpool` and `world2`
  (the sinks', the doors' signatures' and the landing's `element`; exterior.js's and worldModes.js's `whole`; world2's
  fate-held refusal), `audit24_lifetimes` (the death gap's bound, the will in it).
- Mutants `tools/mutants/rvn3.json` (54): 53 dead, 1 recorded equivalent (the flinch's once-a-stand flag - the record's
  own `weakKnown` refuses a second line); two survived the first run (the strike's metal; the tear-away's refusal) and
  have pins. Mutant records re-aimed by content (6): `revenantfate` (3), `audittell`, `rvn1`, `rvn2` (one each); one
  retired with its line - `rvn2`'s `RVN2-a-metal-weakness-touched` (61 now): the mod's metal check is unreachable, a
  blow of a metal weakness being x1.5 ahead of every adaptation.

### RVN4 - BUILT 2026-10-04 (the loot-rarity row on; the roar's ring and phase two's brain with the Enhanced AI switch; every host)

- **The law** - `systems/revenantFeud.js`: `LAST_STAND_RANK` 3, `LAST_STAND_HEALTH` (0.35 / 0.45 / 0.55), `LAST_STAND_ROAR`
  1.2 s, `PHASE_TWO` (blows x1.2, +20 Speed, wind-ups x0.85, cooldowns x0.7, two chained blows - three in all, iron
  one in two, x1.1, its rim's colour); `lastStandHealth`, `phaseTwo()` (the numbers the brain reads, frozen),
  `lastStandGlint`, `lastStandSize`.
- **The seam** - both damage doors, ahead of the will and the yield and of the soul trap (no soul taken by that blow):
  `revenantFate.revenantLastStandDue(f)` - one of my own revenants (never a puppet, a companion, one held by its fate),
  rank 3 and up, not stood this stand (`f._lastStood`); never against a Disintegrate's whole; underground never a
  room's shared foe online (the yield's gate). Its record's id is asked first - a plain foe's death never reaches the
  online test (the gate caught the dungeon's lifted door: its harness stubs no `onlineRoom`, as nothing before asked it). Decided here: it asks no `fates` - `exterior.js`'s pool, which has none,
  stands it too (its revenants then die outright, as section 32 FLAGS).
- **The stand** - `beginLastStand`: its rank's share of its health; `f.roaring` for the roar - every door refuses it
  (both pools', a spell's landing, a shaft); its card (*Last stand*: "Grushnak rises again - its last stand.", the
  cornered's words) and its deed (`revenantLastStand`: `laststand` in its history). The pools' `lastStand` plays its
  bark low, the camera's kick; `roarStep` ends the roar.
- **The roar** - the switch on: `ai/tactics.js beginRoar` winds an IRON RING about its feet whatever its kind's shapes
  (TELL6a's shape, its wind-up the roar - the brain stands it and its held swing; it lands as the roar ends, TELL6e's
  push and rattle); the switch off: the motor held (`enemyMotor.roarUntil`, a lock beside the stagger's, on the brain's
  clock - every host ticks it) and its swing raised, let go striking nothing when the roar is spent.
- **Phase two** - stamped on the entity (`revenant.p2`): the brain's table reads it (`windupSeconds`, `blowCooldown`,
  `blowGuard` - the largest iron share of an elite's, Steadfast's and phase two's, one roll - and `chainMax`, which
  `resolveLanding` chains to); its blows (`damageScale`) and Speed (`stats.speed`) at the stand. Decided here: its rim is
  TELL2's outline lane in ember red, steady, where no wind-up glints (`setBatchGlint(..., foeGlint(...) ??
  lastStandGlint(...))`) - the elite lane's rim is blue in its shader, and a second colour there was a shader change for
  one state; its size multiplies the elite's in both pools.
- **The page** - from rank 3, "Last stand: once a fight it rises again, at 35% of its health." (`lastStandWords`).
- **Four hosts** - `scenes/world.js` WIRED (the street pool's seam, roar, rim and size; the spell's refusal through the
  cast engine); `scenes/exterior.js` WIRED the same (the stand asks no fates) - FLAGGED (section 32): no `fates`;
  `scenes/worldModes.js` WIRED (its interior pool); `scenes/dungeonContext.js` WIRED (its seam - never a room's shared
  foe - roar, rim and size; `scenes/dungeon.js` hosts it).
- **Not built here** - rank 5's band running to it, and its kin stepping out of a portal: the band is RVN6's, and is
  built with it; `p2` on the wire (RVN13); the last stand's own words (RVN12 - the cornered's stand in).
- Pins `test/rvn4_stand.test.js` (8). Pins moved (each marked `PIN MOVED (RVN4: ...)`): `tell1_poise` (the motor's
  lock), `tell2_tell` (the pools' glint, its rim after it), `revenant_audit` (the spell's and the shaft's refusals),
  `rvn3_weak` (a rank-3 one's last stand comes first - the will's pins stand it already; the dungeon's refusal).
- Mutants `tools/mutants/rvn4.json` (49): 48 dead, 1 recorded equivalent (the ring's own iron wind-up is the roar's
  1.2 s; the roar's own mutant is killed). Mutant records re-aimed by content (9): `tell5` (2), `rvn3` (2),
  `revenantfate`, `rvn2`, `tell4`, `tell6b`, `tell7` (one each) - all judged again: dead, but `tell7`'s
  `TELL7-unbuilt-shapes`, recorded equivalent (since TELL6 every shape of the whole set has its row; not this slice's).

### RVN5 - BUILT 2026-10-04 (the loot-rarity row on and the Enhanced AI switch; every host)

- **The law** - `systems/revenantFeud.js`: `SIG` (x2.0, its cooldown 12-18 s, iron from rank 3, its ember, its WIND
  0.7, the pyre's magnitude 3-6 plus 1 a level), `SIG_NOUNS` and `PYRE_NOUNS` (16.2, whole), `pyreElement` (by kind -
  16.1 as built), `signatureName` (`<given>'s <noun>` - `revenantPersonality.possessive`; the noun drawn on its id's
  side stream, the shared DFRandom unmoved - `signatureNoun`; derived, never stored; no given name, the noun alone),
  `signatureStamp` (what its stand carries, frozen: null under rank 2), `pyreSpell` (one Damage Health (4, 0) of its element at range -
  never CasterOnly, so DFU's saving throw answers it - x its mult). The draw itself (`drawSignature`) is RVN1's.
- **The shape** - the PYRE (`ai/blowShapes.js`: a 2.2 m disc, its point locked at its target's feet out to 12 m, 1.2 s):
  the brain's verdict (`ai/foeBlows.js inBlow`), the ground's field, quad and shader branch (`render/foeTelegraph.js` -
  the leap's disc, its own radius).
- **The brain** - `ai/tactics.js`: the stand's `revenant.sigBlow` (`revenant.js revenantStamp`, at the deed and the
  return). With its melee token, its signature AHEAD of every other blow whenever its cooldown (`s.sigReady`) is spent
  and its shape reaches (`signatureReaches`: a gap-closer out of reach with its lane free, the pyre in range and in sight
  at me, any other in reach) - on BLOW_CHANCE's roll, as every blow. A caster that fights at range winds its pyre as
  its shot would go, with its ranged token - the casters' first tell. `beginWindup(..., sig)`: iron from rank 3, x2.0,
  its ember, its WIND pitch, its cooldown drawn, `_sigCall` for the pools; a signature never feints. The pyre draws no
  held swing; its landing on my feet asks the pool for its blast (`_blowPyre`) and the foe waits - its landing was its
  blow; off them, nothing, and it overreaches (TELL4).
- **The pools** - `scenes/exteriorFoes.js signatureFrame` and the dungeon's `signatureDungeonFrame`: the callout once a
  stand (the card's *Signature* kicker: "Grushnak readies Skullsplitter!" - `revenantSignatureEvent`, its stamp's `noun`), and a
  pyre's blast - its element's cast sound at its feet (`SPELL_CAST_SOUND`, the ID space) and `pyreSpell` through the
  host's door. A signature of reach casts nothing whatever is asked.
- **The cues** - `scenes/hostCombat.js tellCues`: a signature's WIND at 0.7 (a person's low swing as deep, by the same
  share); a pyre plays no LAND - its blast is its cast's sound.
- **The page** - from rank 2, "Signature: Grushnak's Skullsplitter - an overhead slam." (", unstoppable" where iron; a
  pyre "a blast of frost at your feet"; " (with Enhanced AI)" with the switch off) - `revenantPage.signatureWords`.
- **Four hosts** - `scenes/world.js` WIRED (its pool's `magicHooks.strikePlayer`, `fireMissile`'s gate: walking and
  spawned); `scenes/exterior.js` WIRED (the gate: walking) - FLAGGED (section 32): no `fates`; `scenes/worldModes.js`
  WIRED (its interior pool); `scenes/dungeonContext.js` WIRED (its own engine's `strikePlayerFrom`; `scenes/dungeon.js`
  hosts it). The ONE cast engine gains `strikePlayerFrom(spell, level, foe)` - a missile's caster wrapper (its entity,
  its sinks), so my Spell Reflection sends the pyre back at its body.
- **Not built here** - the signature on the wire: a signature of reach rides as its shape and its iron, at its shape's
  multiplier on a peer's machine; the pyre not at all, and so it is wound up only at me (RVN13); the card's iron-red
  edge and the *signature* voice moment (RVN12). **FEUD WIRE** carried it: a signature of reach rides flagged (`wk`
  +64) and a peer's puppet strikes it at x2.0, in its ember, its WIND deeper; the pyre still rides nowhere (a spell,
  wound up only at me), and its called name stays its owner's (its voice reads the owner's record).
- Pins `test/rvn5_sig.test.js` (13). Pins moved (each marked `PIN MOVED (RVN5: ...)`): `tell6c_leap` (the shader's
  disc uniforms shared with the pyre), `audittell` (B6: the feint's guard reads the signature and the pyre too).
- Mutants `tools/mutants/rvn5.json` (91): 91 dead. Mutant records re-aimed by content (16): `tell2` (2), `tell3` (2),
  `tell4`, `tell5` (2), `tell6a` (2), `tell6c` (4), `tell6d` (3), and the cite shift's two (`survtiers`,
  `survtiers3` - a citation their mutant reads moved) - all judged again: dead.

### RVN6 - BUILT 2026-10-04 (the loot-rarity row on; the street pool - both open-world hosts)

- **The law** - `systems/revenantFeud.js`: `RETINUE` (RVN1's), `retinueCount`, `BAND_SCATTER_S` 8, `BAND_SPACING` 6,
  `RALLY_KIN` 2; `bandWord` (17 as built), `bandName` ("Grushnak's Warband" - from rank 2 with kin; derived, never
  stored), `bandMembers` (its first `retinueCount` kin: a monster at its kind's level, a person at the player's level - 2,
  never under 1). The kin themselves (`kinPool`, `drawKin`, the record's `kin`) are RVN1's.
- **The stand** - `scenes/exteriorFoes.js standBand`: a revenant of mine stood (never a puppet's, never an ally) brings
  its band once its own slot is let go - each placed by PlaceFoeFreely's ring about it, in the room the pool has left
  (followers trimmed first, `encounterRoom`), stood ordinary (`champion: null`, `eliteFoe: false`), `transient`, marked
  `retinueOf` (the record and its entity), in its master's camp (`entity.campId` - the target machine's infighting
  exemption, so a band of mixed combat teams never fights itself) and named (`entity.bandName` - `foeTitle`'s "Orc of
  Grushnak's Warband"). `revenant.revenantCandidate` refuses a follower whatever it wears.
- **The scatter** - `scatterBand`: its master kneels (`yieldFoe`), runs (the flee's start), dies, is executed or tears
  away (and its escape): each follower not already running breaks and runs from its feet (`ai.flee`, 8 s) and is gone
  when its run is spent (the frame: no corpse, no kill); the narrator says it once a break. Decided here: no
  once-a-stand latch - a rank-5 one's kin stepped out of a portal after an earlier break break with it too.
- **RVN4's rank 5** - `rallyBand` at its last stand: its band's survivors set on me from its feet (the motor's pursuit
  takes them to it); none left, `RALLY_KIN` of its kin step out of a portal about it (`portals.open`, COMPANION-PORTAL's
  arrival), in the room the pool has - never a portal for a stand the cap would refuse.
- **The page** - from rank 2, "Band: rides with two Orcs and an Orc Shaman - Grushnak's Warband." (`bandWords`,
  `pluralKind`).
- **Four hosts** - `scenes/world.js` WIRED and `scenes/exterior.js` WIRED: each stands a returning revenant through
  its street pool's `spawnFoe` (REVENANT's `revenantSpawnOptions`), which stands its band - FLAGGED (section 32):
  `exterior.js` has no `fates`, so its revenants die outright and the kneel's scatter is the death's;
  `scenes/worldModes.js` and `scenes/dungeonContext.js` (`scenes/dungeon.js`): no revenant returns there - no band
  stands.
- **Not built here** - `rt` on the wire (RVN13): a peer sees the followers as ordinary foes, and their scatter as a
  run; the scatter's own voice (narrator only, 23).
- Pins `test/rvn6_band.test.js` (7). Pin moved (marked `PIN MOVED (RVN6: ...)`): `revenant` (its escape's door - the
  band scatters first).
- Mutants `tools/mutants/rvn6.json` (52): 52 dead.

### RVN7a - BUILT 2026-10-04 (the loot-rarity row on; the world host and the dungeon)

- **The law** - `systems/revenantFeud.js`: `RUMOR_CHANCE` 0.35, `RUMOR_PX` 20, `LAIR_GOLD` x1.25 (their slices' to read);
  `pickLair(id, px, py, dungeons)` - of the named dungeons about the deed (the bounty boards' 4-10 px ring,
  `bountyBoard.bountyDungeons`), the one nearest a bearing drawn on its id's side stream (east 0, north a quarter turn,
  `compassWord`'s; the turn wraps), the nearer of two as near, sanitized `{px, py, name, region}`; none in reach, null
  (it roams); `lairAfter(r, here)` (18.1 as built); `sameLair` (by its pixel).
- **The deed** - `revenant.revenantDeed` reads `playerDoor().lairHere()` once its record is found or made, and a lair
  moved forgets that the player knew it. Both deeds read it - the flight (the pools) and the kill (the death's check,
  a microtask after the blow, while the host that ran it still holds the door).
- **The door** - `systems/playerDoor.js` gains `lairHere()`; the ONE cast engine publishes it
  (`hostMagic.createPlayerMagic({ lairHere })`).
- **The page** - "Lair: none - it roams." / "Lair: unknown - the towns about it may have heard." / "Lair: Tomb of
  Vaness." (`lairWords`; RVN7c adds the map).
- **Four hosts** - `scenes/world.js` WIRED (my travel pixel - its interiors' too, the town's - and the game's own
  named dungeons in the ring, with their regions: `_dungeonRegionPixels` beside the boards' index);
  `scenes/dungeonContext.js` WIRED (`scenes/dungeon.js` hosts it: the dungeon names itself, its pixel and region);
  `scenes/worldModes.js` - its interiors run the world host's engine, so its door; `scenes/exterior.js` - FLAGGED
  (section 32): the single-location host builds no location index, so its revenants roam.
- **Not built here** - the rumour (RVN7b), the map's mark and the journal's row (RVN7c), the lair stand and the rest
  (RVN7d).
- Pins `test/rvn7a_lair.test.js` (6). Mutants `tools/mutants/rvn7a.json` (24): 24 dead. Mutant records re-aimed by
  content (2): `survtiers3`'s two cite mutants (a citation they read moved) - judged again: dead.

### RVN7b - BUILT 2026-10-04 (the loot-rarity row on; the world host's talk)

- **The law** - `systems/revenantFeud.js`: `RUMOR_WEAK` 0.5, `RUMOR_NAMED` 1/3, `RUMOR_HINTS` (18.2 as built);
  RVN7a's `RUMOR_CHANCE` 0.35 and `RUMOR_PX` 20.
- **The rumour** - `revenant.revenantRumor(here, session)`: `here` my map pixel and region; among the living, unsworn
  revenants with a lair within RUMOR_PX or in my region (an unknown region matches none), one time in RUMOR_CHANCE the
  roll's pick: "They say a scarred orc called Grushnak the Butcher has been seen near Tomb of Vaness, a long walk to the
  east." - its kind scarred when it carries a scar; one time in RUMOR_WEAK its weakness, hinted or (RUMOR_NAMED) named,
  `weakKnown` raised and never lowered. It spends the person's answer (`numAnswersGivenTellMeAboutOrRumors`, the mill's
  `MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS`), marks `lairKnown`, saves. Nothing is written into the mill.
- **The host** - `scenes/world.js`: the talk's `getNewsOrRumors` asks the revenants first (`rumorHere`: my travel pixel
  and `_questRegionIndex`), then the mill. The town's talk is the world host's alone: `scenes/exterior.js` (FLAGGED,
  section 32 - no index, its revenants roam), `scenes/worldModes.js` (its interiors talk through the world host's
  pipeline) and `scenes/dungeonContext.js` (no town) have nothing more to wire.
- **Not built here** - the map's mark and the journal's row (RVN7c), the lair stand (RVN7d); the rumour's own voice
  lines (RVN12).
- Pins `test/rvn7b_rumor.test.js` (5). Mutants `tools/mutants/rvn7b.json` (28): 28 dead.

### RVN7c - BUILT 2026-10-04 (the loot-rarity row on; the world host's maps and journal)

- **The marks** - `revenant.revenantMapMarks()`: a circle at each living, unsworn revenant's lair the player has heard
  of, at its pixel's middle, `LAIR_RING_R` (a bounty's 1.5), named for it. `ui/bountyMapMark.js` gains the lair's ink
  (`REVENANT_RING_CSS` blood red, its wash, its texel, its legend "Revenant lair") and the reader's fallback label.
- **The maps** - the world host's map deps gain `revenants`; the held map (`ui/heldMap.js`) reads it on the bounty
  circle's poll, hands it to the sheet and adds its legend; the ink sheet (`ui/inkMap.js paintInkOverlay`) paints it
  with `paintBountyRing`'s new ink; the classic region page (`ui/travelMapWindow.js`) plots its ring's texels and
  repaints when it changes.
- **The journal** - `revenant.revenantHuntEntries(here)`: each lair heard of as an active side quest, `hunt:<id>`, the
  way there from my map pixel (the boards' words), no clock; the world host folds them into `questBridge.questLog`
  beside the bounties (the dungeon reads the same bridge). `systems/huntJournal.js` (a new leaf: 396 systems modules)
  carries the Abandon - the pause window's Quests tab (`ui/enhancedMenu.js`) and the chronicle
  (`ui/enhancedChronicle.js`) give a hunt its press (twice), never a share; `revenant.forgetRevenantLair` forgets the
  lair and saves (heard again, it comes back).
- **The page** - "Lair: Tomb of Vaness - on your map." once heard of.
- **Four hosts** - `scenes/world.js` WIRED (the maps' dep, the quest log's fold); `scenes/worldModes.js` and
  `scenes/dungeonContext.js` (`scenes/dungeon.js`) read the world host's maps and quest log; `scenes/exterior.js` -
  FLAGGED (section 32): its revenants roam, so no lair is marked there.
- **Not built here** - the lair stand (RVN7d).
- Pins `test/rvn7c_map.test.js` (7). Pin moved (marked `PIN MOVED (RVN7c: ...)`): `rvn7a_lair` (the page's lair line,
  now marked on the map). Mutants `tools/mutants/rvn7c.json` (35): 35 dead; `rvn7a`'s page mutant re-aimed by content
  - judged again: dead.

### RVN7d - BUILT 2026-10-04 (the loot-rarity row on; the dungeon)

- **Who is at home** - `revenant.revenantForLair(player, here, { dueOnly })`: the living, unsworn revenant whose lair is
  `here` (this dungeon's map pixel), not out, and due or its lair known (`dueOnly`: due alone - a rest's ask) - the
  higher rank, then the longer due; CLAIMED as a return is (`out`), freed by `releaseRevenantStand` when it stands
  nobody. `revenantLoot`/`grantRevenantLoot` take a gold multiplier (`LAIR_GOLD`); `revenantWakeEvent` - the *Its lair*
  kicker, "You wake to Grushnak standing over you."
- **The build** - `scenes/dungeonContext.js buildFoeAt`, both builds (a person's, a monster's): a record carrying
  `revenant` has it stood on the body before its loot (`applyRevenant`) and its drop after (`grantRevenantLoot`, its gold
  x LAIR_GOLD when `lairStand`); `spawnLooseFoe` and `_spawnEncounter` carry the record (a returning person's gender and
  level - `revenantSpawnOptions`).
- **The stand** - `standLairRevenant`, asked once a visit on the first frame (`_lairAsked`): at the layout marker
  farthest from the entrance (`dungeon.enterMarker`, else the start marker), a loose foe of mine (online on the room's
  SUMMON-SYNC lane, never a room's layout foe), FOUND RESTING (`detected` false, no target - a first blow may be a
  backstab, never on a Watchful one: RVN2's door), its band about it.
- **Its band underground** - RVN6's law in the dungeon's pool: `standDungeonBand` (PlaceFoeFreely's ring, loose - the
  dungeon's save carries no loose foe, nor its master - marked, in its camp, named, resting with it),
  `scatterDungeonBand` (its kneel, tear-away, escape, death and execution; said once a break; a scattering follower
  retired through the quest pool's door when its run is spent), `rallyDungeonBand` (RVN4's rank 5).
- **Its taunt** - once roused (in sight, detected, within `REVENANT_TAUNT_DISTANCE`), once a stand.
- **The rest** - `restInLair` (the first roll, its lair, due alone: it stands over me, its card, its band) and
  `restReturn` (`restEncounter`'s offline arm: a roll that hits may be a due one's return, its band about it).
- **A load** - the dungeon's save cuts its loose tail, so a revenant stood here does not survive one; its record stays
  out until `revenantPresence` (the world host's tick, reading the door's foes beside its own pool) finds it gone and
  frees it to come again later (`REVENANT_LOST_MINUTES` - REVENANT's own law).
- **Four hosts** - `scenes/dungeonContext.js` WIRED (`scenes/dungeon.js` hosts it); `scenes/world.js`,
  `scenes/worldModes.js`, `scenes/exterior.js`: no lair stands above ground (the open world's return is REVENANT's and
  RVN6's) - `exterior.js` FLAGGED (section 32): its revenants roam.
- **Not built here** - the lair stand on the wire beyond SUMMON-SYNC's loose lane (`rt`, RVN13); its own voice lines
  (RVN12 - the taunt's bank stands in).
- Pins `test/rvn7d_stand.test.js` (6). Pins moved (each marked `PIN MOVED (RVN7d: ...)`): `audit68_dungeonctx` (the
  rest's harness asks after a revenant at home), `restsync` (the offline arm's harness), `encounterplace` (the
  encounter door's signature and a returning person's gender), `loosefoespawn` (the loose door's signature and record),
  `revenant_card` (the escape's door scatters its band first). Mutants `tools/mutants/rvn7d.json` (40): 40 dead. Mutant
  records re-aimed by content (3): `rvn1` (2 - the dungeon's tag now stands above the record's arm), `rvn5` (the kicker
  line now carries the lair's) - judged again: dead.

### RVN8 - BUILT 2026-10-04 (the loot-rarity row on; online alone)

- **The law** - `systems/revenant.js`: `revenantMayTake` (never a quest item, a summoned piece, the Materials Bag -
  `net/bagLaw.js isBagItem` - gold or a locked piece, `systems/itemLock.js`'s LOCK1 promise); `pickTaken(id, kills,
  weapon, items)` (19 as built); `TOOK_MAX` 3 (RVN1's).
- **The take** - `revenantTakes(player, { online })`: this death's killer (`revenantDeed`'s slew remembers it, taken
  once), online alone; at TOOK_MAX it only gloats (`{ item: null }`); else the piece off the hand that held it
  (`equip.unequipItem`), out of the pack, onto the record's `took`, into the standing killer's pack; the wake box's line
  "Grushnak the Butcher took your Ebony Longsword." (`itemInfo.itemLongName`).
- **Carried** - `grantRevenantLoot` puts what it took in every stand's pack (each piece once, `entity._tookCarried`).
- **Back** - `revenantSlain`: a body that carried them hands its pieces over (the record lets them go; executed, they
  are in `finishExecution`'s pile); `revenantHandBack` at the oath (`revenantFate.beginSpare`'s words: "It hands back
  your Ebony Longsword: "It's yours. It always was.""); escaped, kept.
- **The cap** - never buries one holding a piece. **The save** - the mirror's merge takes the save's copy of `took`
  (no save copy: none).
- **Four hosts** - `scenes/world.js` WIRED (`respawnOnlinePlayer`, after the death penalty and the chase's end - AUDIT
  REP's pin holds the chase's clear right under the price - once a death by its `_respawning` guard; the wake box, its
  line after the price's: pins moved (3) `deathpenalty`, `donline1_respawn`, `risestuck`, each box's regex taking
  `took?.line`); the pools' and the dungeon's bodies carry it by `grantRevenantLoot` (RVN7d's arm
  underground); `scenes/worldModes.js` and `scenes/dungeonContext.js` die through the world host's respawn;
  `scenes/exterior.js` - FLAGGED (section 32): no online respawn there.
- **Not built here** - its next taunt's word on it (RVN12, `{item}`); the page's *Took* (RVN12).
- Pins `test/rvn8_took.test.js` (6). Mutants `tools/mutants/rvn8.json` (34): 34 dead. Mutant record re-aimed by
  content (1): `revenantaudit`'s A6 (the cap's filter now spares a holder too) - judged again: dead.

### RVN9 - BUILT 2026-10-04 (the loot-rarity row on; every host's encounter tick)

- **The law** - `systems/revenantFeud.js`: `FESTER` (3 days, every 3, seven caught up, +10% health and +5% blows a
  wrath), `festersOn(dueDay, day)`; RVN1's `WRATH_MAX` 3 and the record's `wrath` and the store's `lastDay`.
- **The days** - `revenant.revenantFester(player, { now })`: the character's day (`MINUTES_PER_DAY`) against `lastDay`,
  whole days caught up; the living, unsworn, not-out revenants fester on their days; at three a rank (the `festered`
  deed at that day, a new epithet - the risen bank from rank 3, the slew bank's below until RVN12's words - a signature
  drawn at rank 2, its notice), its wrath to none; at rank 5 its wrath stops at three. The notice's card:
  `revenantFesterEvent` - *Grows bolder*, "Grushnak grows bolder - it has waited too long."
- **The stand** - `applyRevenant`: health x(1 + 0.10 a wrath) and blows x(1 + 0.05 a wrath) over its rank's, then its
  wrath cleared.
- **Four hosts** - `scenes/world.js` and `scenes/exterior.js` WIRED through their encounter tick's
  `takeRevenantNotice` (unchanged - the notice's step counts the days); `scenes/worldModes.js` and
  `scenes/dungeonContext.js` run under the world host's tick; online the character's own clock stands while away
  (TIME1), so nothing festers between sessions.
- **Not built here** - the page's pips (RVN12); a festered epithet bank of its own (RVN12).
- Pins `test/rvn9_fester.test.js` (6). Mutants `tools/mutants/rvn9.json` (29): 28 dead, 1 recorded equivalent (the
  tick's fast path for a day already counted: without it the loop counts no day and sets the day to itself). Mutant
  record re-aimed by content (1): `rvn1`'s rank-2 signature (the festering's rank-up draws one too, so its line named two
  sites) - judged again: dead.

### RVN10 - BUILT 2026-10-05 (the loot-rarity row on; every pool, the world host's companions and jumps)

- **The law** - `systems/revenantFeud.js`: `ROUT` (70 m, under half); `lessonOf` asks `routed` before the fight's
  other scars (the Relentless). `systems/harmMark.js`: `HARM_FIGHT_MS` 30 s, each foe's fight (`markPlayerHarm` opens
  or carries it; `harmFightSince`), the low (`markPlayerLow`, `playerLowSince`), `endPlayerFights` (a death, a load, a
  new game, the online respawn); a judged foe's fight ends with its mark (`clearPlayerHarm(entity)`).
- **Felled** - `revenant.revenantFelled(player, striker, ally)`: the deed `felled` on the striker (a candidate, alive),
  the companion's name on its history entry and in its epithet (`REVENANT_EPITHETS.felled`: "Bane of {a}", "the
  Companion-Killer", "Breaker of Oaths" - `{a}` the companion; one naming him passed over without a name), out (it
  still stands). `revenantFelledEvent` - *Felled*, "Grushnak felled Borgakh. It will remember this."
- **Routed** - `revenantRoutable(f)` (a candidate, alive, hostile, detecting me and on me, neither kneeling nor running
  itself, not routed already, its fight live and a hurt in it leaving me under half); `revenantRouted` (the deed,
  marked); `revenantRoutSweep(player, foes)` (a jump's: the door's pool by default); `REVENANT_EPITHETS.routed` ("Who
  Made {p} Run", "the Pursuer"); `revenantRoutedEvent` - *Routed*, "You ran from Grushnak. It will remember this."
- **The record** - `revenantDeed` takes `ally`; `felled` marks out as `slew` does; an escape is counted for `fled`
  alone; a history entry read back keeps its `ally` (trimmed to 40, a bad one dropped). The page: `historyWords`.
- **Four hosts** - the knock-out arm of both damage doors (`scenes/exteriorFoes.js`, `scenes/dungeonContext.js`)
  notes `_knockedBy`; `scenes/crewAshore.js` hands it to `onKnocked(c, by)`; `scenes/world.js` WIRED - both parties
  (the crew's hand by his name, the sworn by its given name) make the deed and its card (`felledBy`); the street pool
  (`exteriorFoes.js`, the world's, `scenes/exterior.js`'s and `scenes/worldModes.js`'s interiors) routs past 70 m
  before its cull (`routFoe`: gone as the cull takes a foe, its band scattered, told); `world.js _teleportToPixel` routs
  before its sweep (never a load's) and `recallToAnchor` before a mode's teardown (`routByJump`), the online respawn
  ending every fight first; `scenes/exterior.js` WIRED - its Recall's mode exit routs (its street stays: the distance
  judges a jump in it); `scenes/dungeonContext.js` - routed by the world's jump (no cull underground); FLAGGED
  (section 32): a spell's knock-out, a peer's foe's, a door walked through, `exterior.js`'s companions (none).
- **Not built here** - the return's taunt naming the companion (`felled_return`, `routed_return` - RVN12's words, the
  history's `ally`); felled and routed epithet banks past rank 3 (the risen, as every deed's).
- Pins `test/rvn10_deeds.test.js` (11). Mutants `tools/mutants/rvn10.json` (65): 65 dead. Pins moved (4):
  `crewcompanions` (the knock-out arm's two strings and the crew's `onKnocked`), `audit26_dungeonfoes` F212 (the
  teleport core's window 6800 -> 7000: the jump's rout above its needles), `qx1_exterior_host`'s lifted Recall (the
  sweep's three names stubbed - none engaged). Mutant records re-aimed by content (9):
  `rvn2`'s lesson-skips-the-lead (the loop's head), `revenant`'s escape-leaves-a-corpse (`f.escaped = true;` is
  `routFoe`'s too), `crewcompanions`' two companion-killed (the knock-out arms), `revenantaudit`'s A2 (the restore's
  line), `survtiers` (1) and `survtiers3` (3) (the cites the shift moved) - each judged again: dead.

### RVN11a - BUILT 2026-10-05 (the loot-rarity row on; the world host's sworn, every pool's cues)

- **The law** - `systems/revenantFeud.js`: `LOYALTY` (+3 won, +2 a day with me, +10 called after a rest; -1 a day
  away, -8 knocked out, -10 sent away again in a day, -15 its kind executed in its sight), `DEVOTED` (90, blows x1.1,
  15 s between warnings), `LOYALTY_LABELS` and `loyaltyLabel` (Devoted 90+, Loyal 50, Wavering 20, Restless),
  `movedLoyalty` (0-100), `isDevoted`, `sameKin` (one kind or one faction); RVN1's `LOYALTY_START`.
- **The moves** - `revenant.revenantFester`'s day walk: each sworn one's day (with me +2, away -1, resting nothing).
  `systems/revenantCompanions.js`: its wake marks it `rested`, `callRevenant` spends it (+10); `sendRevenantAway(id, {
  now, byYou })` costs -10 on a second sending the same day (`sentDay`; the slots' hold, `byYou: false`, costs and notes
  nothing); the party's `knock` -8; `swornFightStep(rec)` and `swornFightWon(id)` (+3); `swornWitness(mobileType)`
  (-15, `revenantFate.finishExecution`'s). `revenant.js sanitizeCompanion`: `rested` (only while away), `sentDay`.
- **Devoted** - `applySwornStrength`: blows x1.1 over its rank's; `devotedWithYou()`; `scenes/hostCombat.js
  setWindupAtMeListener` - `tellCues` tells the host a wind-up at me as it begins (once a blow, every pool's cues);
  `revenant.revenantWarnEvent` - "Behind you, Ayla!" (a beast's: "Grushnak snarls a warning - behind you!").
- **Shown** - `ui/companionRoster.js loyaltyRow`: a bar of 100 (the kit's bone tone) and its word, at my side and away,
  its number on the bar's title.
- **Four hosts** - `scenes/world.js` WIRED: the sworn's frame (`revenantAshoreTick` - every mode) counts a fight won,
  the slots' hold sends away `byYou: false`, the warning's listener (the duel's `isBackFacing`, `DEVOTED.WARN_S`
  between); `scenes/worldModes.js` and `scenes/dungeonContext.js` - the sworn stand there by the world's layer, and
  their pools' `tellCues` tell the one listener; `scenes/exterior.js` - FLAGGED (section 32): no companions there.
- **Not built here** - desertion (RVN11b), betrayal (RVN11c); the warning's and the witness's own voice lines (RVN12's
  `devoted_warn`).
- Pins `test/rvn11a_loyalty.test.js` (10). Mutants `tools/mutants/rvn11a.json` (52): 52 dead. Pin moved (1):
  `revenant_audit` C3/C7 (the slots' hold passes `byYou: false`). Mutant records re-aimed by content (5): `tell9`'s two
  (the wind-up line now tells the host too), `revenantaudit`'s C5 (the knock's line moves loyalty), `survtiers3`'s two
  (the cites the shift moved) - each judged again: dead.

### RVN11b - BUILT 2026-10-05 (the loot-rarity row on; every host's encounter tick)

- **The law** - `systems/revenantFeud.js`: `DESERT` (under 20, 0.15), `deserterSplit(items, { value, isGold, room })`
  (the more valuable half, an odd one its way, at most its room, never gold - OPEN 18).
- **The roll** - `revenant.revenantFester`'s day walk: after the sworn's day, each sworn one under `DESERT.AT` rolls
  once (`rolls() < DESERT.CHANCE`).
- **The deserter** - `revenant.revenantDeserts(player, r)`: not sworn (`fate` none, `companion` none), its rank kept,
  "the Oathbreaker" (`REVENANT_EPITHETS.deserted`), the `deserted` deed at that day, due in one to three days, its notice;
  its pack split - the kept half onto `took` (room `TOOK_MAX` less what it took), the rest into my pack (`addItem`) and
  gold into my purse (`addGoldPieces`); the cap held (`trimLiving` - the cap's law, now one function for a new one and a
  deserter); the party told (`setSwornLeftListener` - `revenantCompanions.js` forgets its member). Its card:
  `revenantDesertEvent` - *Oathbreaker*, "Grushnak broke its oath and left you. It kept your Ebony Longsword. It left the
  rest of its pack to you." (through `takeRevenantNotice`).
- **The save** - `ensureMirror`: a deserter the save holds sworn with a pack comes back as the save had it.
- **Four hosts** - `scenes/world.js` and `scenes/exterior.js` WIRED through their encounter tick's `takeRevenantNotice`
  (the day walk; its card); a body at my side leaves through its portal by the companion layer (no longer the party's),
  in every mode (`scenes/worldModes.js`, `scenes/dungeonContext.js`); `exterior.js` stands no companions (FLAGGED,
  section 32) - a record there deserts all the same.
- **Not built here** - its voice (`deserted`, RVN12); betrayal (RVN11c).
- Pins `test/rvn11b_desert.test.js` (7). Mutants `tools/mutants/rvn11b.json` (30): 30 dead. Mutant records re-aimed by
  content (4): `revenantaudit`'s A6 and `revenant`'s no-cap (the cap's lines now `trimLiving`'s), `rvn11a`'s
  warn-kicker and `rvn9`'s card-unsaid (their lines carry the deserter's too) - each judged again: dead.

### RVN11c - BUILT 2026-10-05 (the loot-rarity row on; the world host's sworn, every place's spawn)

- **The law** - `systems/revenantFeud.js`: `BETRAY` (under 10, a quarter of my health, the Unhinged, the Craven, the
  Brutal - OPEN 19), `mayBetray(r)`.
- **The moment** - `systems/revenantCompanions.js betrayalStep(entity, after)`, on the player's hurt
  (`registerPlayerHurtListener('sworn-betrayal')`): alive and under a quarter, the first sworn one at my side that may
  and whose body stands here turns - its record (`revenant.revenantBetrays`), then the host told (`'betray'`).
- **The turn** - `revenantBetrays(player, r)`: not sworn, rank +1 (never past 5; its signature at 2), "the Betrayer"
  (`REVENANT_EPITHETS.betrayed`), the `betrayed` deed, due should it get away; its pack as a deserter's (`splitPack` -
  RVN11b's split, now one function for both); the cap held; its member forgotten. `revenantBetrayEvent` - *Betrayed*,
  "Grushnak turns on you!". `applyRevenant(entity, r, { turned })`: a turning counts no return and writes no `returned`.
- **Four hosts** - `scenes/world.js` WIRED: the retinue listener queues it; `turnSworn` (before the layer's frame) says
  its card, lifts its body (no portal - the layer finds it swept) and stands it hostile through the place's `turn` -
  the street's and a building's `spawnFoe(... { feetGiven, loose, band: false, turned })` (`scenes/exteriorFoes.js`:
  `turned`, `band`), the dungeon's `spawnLooseFoe(... { revenant, turned })` (`scenes/dungeonContext.js`: both builds
  pass `turned`); `scenes/worldModes.js` - its interiors are the street pool's kind (`interiorPool`); `scenes/exterior.js`
  - FLAGGED (section 32): no companions there.
- **Not built here** - its voice (`betrayed`, three lines - RVN12).
- Pins `test/rvn11c_betray.test.js` (7). Mutants `tools/mutants/rvn11c.json` (37): 37 dead. Pins moved (6):
  `loosefoespawn` SD1, `rvn7d_stand` (the loose stand's signature and record, both builds' stand), `loot7_champions`,
  `revenant` THE HOSTS, `rvn6_band` THE CAP (the band's arm), `revenant_companions` the world's wiring (the places'
  `turn`). Mutant records re-aimed by content (10): `rvn1`'s two dungeon tags, `rvn7d`'s build-unapplied and
  record-dropped, `rvn6`'s band-unstood and puppet-band (each line now carries the turning), `rvn11b`'s four on the
  split (now `splitPack`'s one site) - each judged again: dead.

### RVN12a - BUILT 2026-10-05 (the loot-rarity row on; every host's cards)

- **The bank** - `systems/revenantPersonality.js`: `VOICE_EVENTS` gains `learned`, `signature`, `laststand`, `stole`,
  `festered`, `felled_return`, `routed_return`, `deserted`, `betrayed`, `devoted_warn` - 220 lines in ten voices, a
  beast's deed each; `VOICE_PLACEHOLDERS` (`p`, `how`, `item`, `move`, `ally` - exactly); `voiceLine(... { how, item,
  move, ally })` passes over a line it cannot fill.
- **The moments** - `systems/revenant.js`: `voiceParts(..., vars)`; `tauntMoment(r)` (the return's moment by its
  newest deed) and its card (`stole` - *It took*); `revenantSignatureEvent(r, noun, { playerName })` (its words, its
  line), `revenantLastStandEvent` (`laststand`), `revenantWarnEvent` (`devoted_warn`), `revenantDesertEvent(r, {
  playerName })` (`deserted`), `revenantBetrayEvent(r, { playerName })` (`betrayed`). `systems/revenantFeud.js
  ADAPT_HOW` - a habit's word for each adaptation.
- **Four hosts** - `scenes/exteriorFoes.js` and `scenes/dungeonContext.js` hand my name to the signature's card;
  `scenes/world.js` to the betrayer's; the deserter's through `takeRevenantNotice` (both hosts' encounter tick);
  `scenes/worldModes.js` - its interiors are the street pool's kind; `scenes/exterior.js` - its pool's signature, as the
  street's (FLAGGED as ever, section 32: no companions, no fates).
- **Not built here** - the page and the card (RVN12b).
- Pins `test/rvn12a_words.test.js` (5). Mutants `tools/mutants/rvn12a.json` (33): 33 dead. Pins moved (5):
  `revenant_voice` (the key moments with the last stand and the betrayal; the placeholders widened), `rvn11a_loyalty`
  (the warning's own voice), `rvn5_sig` (the dungeon's call hands my name), `rvn11c_betray` (the betrayer's card hands
  it). Mutant records re-aimed by content (9): `revenantaudit`'s A11 and `revenantvoice`'s name-unfilled (the fill
  widened), `rvn11a`'s warn-mute-speaks (the warning through the voice), `rvn11b`'s card-missing, `rvn11c`'s kicker and
  turn-untold, `rvn5`'s three street calls (each line now hands my name) - each judged again: dead.

### RVN12b - BUILT 2026-10-05 (the Enhanced Plus page and card)

- **The page** - `ui/revenantPage.js`: `ADAPT_EFFECTS` (13.2's table in a chip's words), `learnedChips(r)` (drawn as
  `rvn-chip`s, each its effect on its title, and an `rvn-effects` line), `tookWords(r)` (RVN8's pieces by their pack
  names), `festerPips(r)` (RVN9's wrath of WRATH_MAX, three pips and their words), `swornLoyaltyWords(r)` (RVN11's), and
  `historyWords` saying "escaped unbroken".
- **The record** - `revenant.js`: `revenantDeed(..., { unbroken })` writes `unbroken` on a `fled` entry (a history entry
  now takes its extra fields whole - `deed(r, d, at, extra)`); `historyOf` keeps it for a `fled` alone. The tear-aways
  (`scenes/exteriorFoes.js escapeFoe`, `scenes/dungeonContext.js escapeDungeonFoe`) pass it.
- **The card** - `ui/revenantCard.js`: the edges for every FEUD kind (24.2's four, and the rest by their kin).
- **Four hosts** - the page and the card are the Enhanced Plus menu's and HUD's, every host's; the record's `unbroken`
  is written by the street's and the dungeon's tear-away (`scenes/worldModes.js`'s interiors the street pool's kind;
  `scenes/exterior.js` - no `fates`, so no tear-away there: FLAGGED as ever, section 32).
- Pins `test/rvn12b_page.test.js` (5). Mutants `tools/mutants/rvn12b.json` (25): 25 dead. Pin moved (1): `rvn2_adapt`
  (the page's learned row is chips now). Mutant records re-aimed by content (4): `rvn10`'s ally-unsaved,
  history-ally-dropped and page-name-dropped (the history's extra fields), `rvn2`'s page-unnamed (the chips) - each
  judged again: dead.

### RVN13 - BUILT 2026-10-05 (the loot-rarity row on; both foe streams; relay world164)

- **The law** - `systems/revenantFeud.js`: `adaptMask`/`maskAdapt` (a bit for each of ADAPTATIONS, read back at most
  ADAPT_MAX), `weakIndex`/`weakAt`, `feudWire(stamp)` (`ad`, `wq`, `p2`), `feudFromWire(stamp, record)` (its learned,
  its weakness, their `adaptEdge`, its phase two), `puppetBandName(masterName, masterType)`.
- **The wire** - `net/wire.js validFoeRecord`: `ad` (1..FOE_ADAPT_MASK_MAX, at most FOE_ADAPT_MAX set), `wq`
  (0..FOE_WEAK_MAX), `p2` (1), `rt` (0..FOE_SEQ_MAX) - each refused whole outside its law. `RELAY_VERSION` **world164**
  and its `relayversion` row; the tests that name the relay moved with it.
- **Four hosts** - `scenes/exteriorFoes.js` (the world's street, `scenes/exterior.js`'s and `scenes/worldModes.js`'s
  interiors): its record writes the four (a follower's master by its number) and keys them; its puppet stands with
  them when they change, a follower named for its master's band; a peer's blow of my revenant's weakness reveals it.
  `scenes/dungeonContext.js`: its room record writes `ad`, `wq`, `p2` and keys them; a joiner's copy stands with them;
  a joiner's weak blow reveals it to the host. `scenes/world.js` - carries both pools' streams unchanged.
- **Not on the wire** - the theft, loyalty, festering, the lair and the rumours: the character's own.
- **The dungeon stream's gap** - no `nm` rides the room record, so no follower's `rt` either: AUDIT TELL's flag on
  that stream names it (one gap, one flag - the open flags stay nine), and section 32 says so.
- Pins `test/rvn13_wire.test.js` (6). Mutants `tools/mutants/rvn13.json` (35): 35 dead. Pins moved (9):
  `audit68_dungeonctx` (the name rides the key, its fields after), `revenant_card` (the key; the puppet's name stood
  again), `tell8_online` (both keys), `world2` (the room record's line), `world3` (its key), `world6biiie` (the peer's
  hit's reveal after it), `audittell` (the flag's words); and the relay's name in 27 tests (world163 -> world164,
  `relayversion` excluded as its own law asks, its world164 row added). Mutant records re-aimed by content (2): `revenant`'s puppet-unnamed (the name's line now forgets the wire's),
  `soc1`'s S38 (the version) - each judged again: dead.

### AUDIT FEUD - 2026-10-05 (Mac: "Let's do a comprehensive audit over everything ensuring perfection")

RVN1-RVN13 read again whole by four lenses - the record and its merge, the deeds and their flows, the four hosts, and
the words, the page and the wire - every finding reproduced against the code (most through the real modules) before it
was fixed. "Every host" is the four by name: `scenes/world.js`, `scenes/exterior.js`, `scenes/worldModes.js` and
`scenes/dungeon.js`; the pools `exteriorFoes.js` (the street, a building's foes) and `dungeonContext.js`.

- **The wire (W1-W2)** - RVN13's reveal never fired: no sender set the blow class's weakness bit (`blowClassOf`'s fourth
  argument was never passed), and a class rode only while the puppet wound up. Both senders now ask the blow's own
  weakness test of the puppet's wire-stood record (`feudLedger.feudWeakBlow`, the attacker the player, an element a
  spell's), and a blow of its weakness carries its class winding up or not (no facing outside one, so never from
  behind) - the owner's reveal and its poise meter read it (W1). No new field: the relay is unchanged. An heir (a foe
  adopted after its owner left) and a room's new authority keep writing `ad`, `wq` and `p2` - the writers gated on the
  owner's own id, which an adopted foe's record never has (W2).
- **The words (V1-V3)** - a piece it took is named after "your", "my" or "lovely" without its article
  (`revenant.takenName`): a legendary's "The Glenmoril Bow" read "Your The Glenmoril Bow drinks blood just fine in my
  hand" - the theft's line, the taunt, the deserter's card and the page (V1). Twenty lines took a number from
  `{how}` or `{item}` ("Your arrows is beneath me now", "Your Leather Gauntlets is consecrated now") or named it back as
  "it" - each reworded so either number reads (V2). A return speaks only of what came after its oath: a deserter or a
  betrayer with nothing since speaks its leaving (`deserted`, `betrayed`), never a felling it did before it served me
  (V3).
- **The record and its merge (R1-R6)** - a betrayal splits a pack as a desertion does, so the merge restores the save's
  sworn copy for it too: a betrayal reloaded lost the whole pack (R1). What the save's living, unsworn copy held, on a
  record the mirror has since seen fall or sworn, is handed to me - it was stranded on a record nothing hands out (R2).
  A record forgotten since (the cap, the fallen's prune) that the save held sworn with a pack comes back as the save had
  it - the tombstone was asked first (R3). No day counts twice: a clock behind the last counted day (an older save's)
  counts nothing until it passes it - it wound `lastDay` back, and the mirror's festered and loyal days were counted
  again; RVN9's "a wound clock starts again from there" is corrected (R4). A deserter or a betrayer keeps only what RVN8
  lets it take - a locked piece (LOCK1), a quest item, a summoned one and the Materials Bag come back with its gold (R5).
  A load, a new game and a party member's Resurrect forget this death's killer (`forgetLastSlew`) - its theft fired at a
  later, unrelated death (R6).
- **The deeds (D1-D3)** - a felling is no end: it leaves the fight's ledger open, so a will I broke stays broken (it took
  the ledger, and the revenant tore away unbroken), and it leaves a kill's card waiting (it wiped the notice); a striker
  held by its fate - kneeling at 1, burning, sparing, tearing away - fells nobody (it ranked up kneeling) (D1). No rout
  from one tearing away, burning or sparing, nor from a peer's puppet (a Recall's sweep minted me a revenant from another
  player's foe) (D2). A fight won is a foe killed: one that escaped, was culled or scattered is `dead` with its health,
  and counted +3 (D3).
- **The hosts (H1-H4)** - the world host: a knocked-out sworn one (held at 1, not dead) stands for nothing - no turning,
  no Devoted warning, no witness (`setRetinueBodies` and `turnSworn`); a load clears a turning queued under a window; a
  turning stands nowhere a respawn's sweep took (the place's `has`, AUDIT CC-A1) (H1). Privateer's Hold's in-place online
  respawn (`worldModes.js`) ends the fights and takes the theft and says it, as the world host's respawn does (H2). The
  dungeon: a band breaks when its master starts to run (the street's law, Feud-Arc.md 17); no lair on the Burning Court,
  the Arena's floor or a spawned dungeon ("dungeon 0" at the map's corner; a borrowed template's pixel - profIdentity's
  own guard, `lairable`) (H3). Nine trailing comments FEUD's edits had moved onto a neighbouring line put back (TELL6d,
  TELL6e three times, RVN7c twice, RVN9, RVN12b, and NEMESIS-CARD's ELITE FOES on a line RVN13 edited), and RVN10's
  `routByJump` above the AUDIT 39 block, not inside it (H4).
- **Not fixed - named** - a revenant puppet's blows at a peer: its owner's `damageScale` (rank, wrath, a Night-stalker's
  night, phase two) rides no wire, so a peer is struck with its kind's plain blows - REVENANT-WIRE's law before FEUD
  (section 32 names it).
- **The duel harness (section 28)** - `tools/tellDuel.mjs` fights revenants now (`revenantFight`, `measureFeud`): an Orc
  revenant at a rank (`applyRevenant` on the real foe), fought to its end through the pools' own law
  (`revenantFate.revenantLastStandDue`, `beginLastStand` with the brain's roar, `revenantWillHolds`), the real door's
  poise and ledger (`hostCombat.windupDoor`), its weakness through the real strike listener; a player who trades blows,
  or dodges PERFECTLY - in the shape at the brain's late sample (its 16 Hz turn), out half `TELL_LATE` before the landing
  - both closing back into reach at DFU's walk; an iron slam, ring or charge that lands knocks the trader down for
  `KNOCKDOWN_S`. Never modelled: a flight, the player's own health. `--tell` and `--feud` run either half.

  Each fight now seeds DFU's own stream (`formats/dfRandom.js` - the hit roll, the attack's reflex gate) as well as
  `Math.random`: a fight's result was the order it ran in, not its seed (TELL's cells measured first in every run, so
  AUDIT TELL's table was reproducible, but no cell alone was). A thousand fights a cell (535 s). TELL's, measured again:
  LIGHT 1.6% (AUDIT TELL 1.1%), HEAVY 90.5% (90.4%), MASSIVE 97.7% of the floor, FAIR 0 of 11 378 - all four hold.
  RVN's, an Orc revenant (its weakness `blade` where it is struck, else `fire`, which no blade strikes):

  | Weapon | Rank 3 | knelt | time to its end (mean) | staggers | perfect dodges | telegraphed blows on me |
  |---|---|---|---|---|---|---|
  | Dagger | trading | 0% | 23.8 s | 0 | 0 | 3.04 |
  | Dagger | dodging | 47.2% | 22.9 s | 1.44 | 1.92 | 0.16 |
  | Dagger | its weakness | 100% | 16.1 s | 0.22 | 0 | 2.16 |
  | Longsword | trading | 0.3% | 12.4 s | 0.15 | 0 | 1.96 |
  | Longsword | dodging | 11.6% | 11.3 s | 0.66 | 1.13 | 0.12 |
  | Longsword | its weakness | 100% | 8.9 s | 0.22 | 0 | 1.58 |
  | Warhammer | trading | 0.5% | 13.1 s | 0.30 | 0 | 1.90 |
  | Warhammer | dodging | 12.1% | 11.8 s | 0.69 | 1.15 | 0.16 |
  | Warhammer | its weakness | 100% | 9.4 s | 0.25 | 0 | 1.62 |

  | A longsword | rank 1 | rank 2 | rank 3 | rank 4 | rank 5 | rank 5 / rank 1 |
  |---|---|---|---|---|---|---|
  | trading | 5.5 s | 6.6 s | 12.4 s | 14.9 s | 17.8 s | 3.25 |
  | dodging | 5.4 s | 6.5 s | 11.3 s | 13.3 s | 16.0 s | 2.98 |

  THE WILL BY ITS WEAKNESS holds (100% >= 90%), THE TRADER'S WILL holds (0.3% <= 20%); THE WILL BY DODGING misses
  (11.6% < 70%), DODGING PAYS misses (90.5% > 75%), A RANK'S WEIGHT misses (3.25 trading outside 2-3). Each turns on a
  number Mac called (OPEN 11, 12, 5), so none was tuned here: section 31's OPEN 22-24 put them to him, each alternative
  measured (300 fights a cell).

- Pins `test/auditfeud.test.js` (19). Pins moved (each marked): `rvn9_fester` (the wound clock: nothing until it passes
  the last counted day, R4), `rvn12a_words` (the cold theft's line, V2), `rvn13_wire` (both writers without the id, W2),
  `revenant_audit` (the load's clear, H1), `rvn7d_stand` (`lairable`, H3), `tell8_online` (the street's sender, W1), `audittell` (the dungeon's sender, its weakness after its feet, W1),
  `world2` (the room record's writer, W2); the lifted harnesses of `audit68_dungeonctx`, `loot7check` and `restsync` hold the
  hit door's two new free names, `auditdisc28_time` the Resurrect's `forgetLastSlew`.
- Mutants `tools/mutants/auditfeud.json` (51), all dead. Mutant records re-aimed by content (23): `rvn10` (9), `rvn11a`
  (2), `rvn12a` (2), `rvn13` (2), `audittell`, `revenantaudit`, `rvn1`, `rvn11b`, `rvn12b`, `rvn8`, `rvn9`, `tell8`
  (one each) - each judged again, all dead; `rvn9`'s day-twice, recorded equivalent, dies now (R4's pin) and is
  recorded so.

### FEUD BALANCE - BUILT 2026-10-05 (Mac, on AUDIT FEUD's OPEN 22-24: each as recommended)

- **The will (OPEN 22)** - `revenantFeud.WILL_STAGGERS` 1, and `willBroken` counts a perfect dodge of its blow with its
  staggers: the ledger's `perfect`, written by the brain at a blow that missed ME with my feet inside it at its late
  sample (TELL4, `tactics.beginOverreach` - a peer's perfect dodge is the peer's fight). Its weakness breaks it as ever;
  so does one stagger (a poise break, an overreach's first blow) or one perfect dodge. With the Enhanced AI switch off
  there is neither, and its weakness alone breaks it (14.2's law kept). The page: "Its will must be broken - strike its
  weakness, stagger it, or dodge its blow perfectly."
- **The last stand (OPEN 23)** - `LAST_STAND_HEALTH` 0.30 / 0.35 / 0.40 at ranks 3 / 4 / 5 (from 0.35 / 0.45 / 0.55);
  the page says its share ("at 30% of its health").
- **Dodging pays (OPEN 24)** - section 28's row rewritten to what dodging buys: a perfect dodger is struck by a tenth of
  the telegraphed blows a trader takes or fewer, and is no slower to bring a rank-3 to its end (the will is the other
  half, its own target). `tools/tellDuel.mjs`: `FEUD_TARGETS.DODGE_SPARES` 0.1 for the time share `DODGE_PAYS` 0.75;
  its verdict reads both.
- **Measured** (`node tools/tellDuel.mjs --feud`, 1000 fights a cell; TELL's cells unaffected):

  | A rank-3 Orc revenant | knelt | time to its end (mean) | telegraphed blows on me |
  |---|---|---|---|
  | Longsword, trading | 13.9% | 12.1 s | 1.95 |
  | Longsword, dodging | 89.7% | 10.9 s | 0.11 |
  | Longsword, its weakness | 100% | 8.8 s | 1.57 |
  | Dagger, trading / dodging | 0.1% / 98.9% | 23.0 / 22.1 s | 2.98 / 0.15 |
  | Warhammer, trading / dodging | 29.4% / 92.2% | 12.7 / 11.5 s | 1.88 / 0.16 |

  Rank 5 over rank 1: 2.95 trading (16.2 / 5.5 s), 2.70 dodging (14.5 / 5.4 s). Every RVN target holds: the will by
  its weakness 100%, by dodging 89.7%, by trading 13.9% (the reference longsword - a warhammer's poise breaks stagger a
  trader's foe one fight in three: 29.4%, the heavy weapon's own way to its will), dodging pays (struck 5.6%, time
  90.4%), the ranks (2.95 / 2.70).
- **Hosts** - none: the will, the stand and the page are read where they were (`revenantFate.revenantWillHolds` and
  `beginLastStand` in both pools' damage doors, `revenantPage`); the wire carries no number of these.
- Pins `test/feudbalance.test.js` (4). Pins moved (each marked): `rvn3_weak` (the law's breaking, the page's words),
  `rvn4_stand` (the shares, four places, and the page), `auditfeud` (the duel's seeds and the target). Mutants
  `tools/mutants/feudbalance.json` (8), all dead; re-aimed by content (4): `rvn3` (2), `rvn4` (1), `auditfeud`'s target
  (1) - each judged again, all dead.

### AUDIT FEUD 2 - 2026-10-05 (Mac: "Let's audit this and ensure perfection")

AUDIT FEUD and FEUD BALANCE read again by four lenses - the record and its flows, the hosts and the wire, the duel
harness's fidelity to the pools, the pins and the docs - every finding reproduced (most through the real modules) before
it was fixed.

- **The brain (B1)** - FEUD BALANCE made a perfect dodge break the will, and a "perfect dodge" was any miss whose target
  was inside at the late sample: a leap a ledge stopped short, a charge a wall stopped, "missed" a player who never left
  its shape - and broke the will for nothing. A perfect dodge is now inside at the late sample AND out of its shape at
  the landing (`tactics.resolveLanding`, judged there).
- **The record (R1-R6)** - a restore of an older save's sworn copy took a bumped revision, so it leaked into a NEWER save
  loaded after it (a betrayer slain there came back sworn; a forgotten one past the retinue's cap): restored at the
  save's own revision now (R1). It reads no history - its twelve deeds scroll a leaving off: the save holding it sworn
  with a pack and the mirror not, it left by some road (R2). What the save's living copy held is handed to me for a
  record since forgotten too, not only fallen or sworn (R3). A felling in its last stand keeps phase two - the re-stamp
  dropped its iron share, its chains and its quicker wind-ups mid-stand (R4). The oath's hand-back line names a piece
  without its article ("your Glenmoril Bow"), and `takenName` takes an article only at the start ("Amulet of the Nine")
  (R5). A rout keeps a kill's waiting card as a felling does - AUDIT FEUD changed both, its record named the felling
  alone (R6).
- **The wire and the hosts (W1-W5)** - a peer's blow rode its weakness's class whatever it did: a miss (a zero blow, no
  weapon - "bare hands" to the test) revealed an h2h weakness, a daylight one every blow by day; only a blow that landed
  now (`damage > 0`, both senders) (W1). A peer's reveal raised the "Weakness" word on the OWNER's screen with no number
  under it - the peer's screen says it; the owner's reveal keeps its card and its found, no word (W2). A Recall routed
  a dungeon room's puppet (it carries no `puppet`) and minted a revenant of mine from another player's foe: the player
  door says which foes another client runs (`isPuppet`, the dungeon hands `isPuppetFoe`), and the sweep passes them (W3).
  No lair in the Ocean Holes abyss - it borrows its template's map table, its pixel another dungeon's; a spawned
  dungeon's reason corrected (it comes and goes) (W4). Every player's shaft carries its bow, so a metal weakness rides
  to a puppet's owner; a duplicated comment in `hostCombat.js` given its own words (W5).
- **The duel harness, made faithful** - its knocked-down trader swung on (the swing machine stands while `paralyzed`);
  a knockdown came of every landing (the pools queue it only for a blow that did damage - the foe's hit roll on me now
  rolled); the foe was never shoved (DFU's knockback on every landed blow the poise did not hold, a stagger's half
  again); a swing's hit frame out of reach waited for the foe instead of missing; the foe's Speed was a fixed 50 (its
  live Speed now - phase two's +20); the revenant bore no signature (drawn from rank 2, as a deed draws it) and its id
  was random (the seed's now - its draws are the seed's); the dodger walked back at the landing itself and into it (it
  waits the brain's next turn). Both halves take the pools' steps (TELL's cells measured again), the verdict is its own
  function on the cells' unrounded means, and `--tell --feud` runs both. Measured, a thousand fights a cell:

  | A rank-3 Orc revenant | knelt | time to its end (mean) | telegraphed blows on me |
  |---|---|---|---|
  | Longsword, trading | 12.7% | 12.6 s | 1.97 |
  | Longsword, dodging | 94.6% | 12.4 s | 0.00 |
  | Longsword, its weakness | 100% | 9.2 s | 1.60 |
  | Dagger, trading / dodging | 0% / 94.4% | 23.3 / 23.0 s | 2.52 / 0.00 |
  | Warhammer, trading / dodging | 21.5% / 97.7% | 12.6 / 13.8 s | 1.82 / 0.04 |

  Rank 5 over rank 1: 2.66 trading (16.5 / 6.2 s), 2.63 dodging (16.1 / 6.1 s). Every RVN target holds - the will
  100 / 94.6 / 12.7% (the warhammer trader's 21.5% its heavy blows' own way), dodging pays (struck 0.2%, time 98.4%),
  the ranks 2.66 / 2.63 - with room; FEUD BALANCE's calls stand as Mac made them. TELL's: LIGHT 0.5%, HEAVY 91.0%,
  MASSIVE 97.7% of the floor, FAIR 0 of 11 378 - all four hold.
- **The pins and the docs** - the harness's own steps and its seeds pinned (the hits counted, the knockdown, the shove,
  the frozen swing, the dodger's wait, the stream, the signature); the routed card, the article's anchor, the new game
  through `newGameModSaveRecords`, the heir's frame and the peer's weak blow through the real street pool; the verdict
  through its function on synthetic cells. Stale words of the old law put right: section 0's last stand, RVN9's wound
  clock (as built), section 28's two rows, Revenants.md 20, Testing.md's rvn3, rvn4, auditfeud and feudbalance rows,
  `rvn3_weak`'s header and title (its pool test now breaks the will with ONE stagger, telling the laws apart), the roar's
  "push" (an iron ring rattles and knocks down). FEUD BALANCE's two duplicate mutants dropped (FB-will-unread was
  `rvn3`'s; FB-stand-rank4 `rvn4`'s): six there now.
- **Not changed** - a revenant puppet's blows at a peer (section 32); the band and the flight in the harness (disclosed).
- Pins `test/auditfeud2.test.js` (14). Pins moved (each marked): `auditfeud` (both senders' `damage > 0`, the abyss, the
  duel's seeds), `feudbalance` (the verdict through `feudVerdict`), `rvn3_weak` (one stagger), `rvn4_stand` (a marker),
  `audittell` and `tell8_online` (the senders' `damage > 0`), `world2`, `waveD_dungeonHost`, `world6biiie` (two) and
  `audit39_worldmodes` (every shaft carries its bow); the lifted harnesses unchanged.
  Mutants `tools/mutants/auditfeud2.json` (29), all dead. Re-aimed by content (17): `auditfeud` (7), `tell4` (3), and
  `audittell`, `feudbalance`, `revenantaudit`, `rvn10`, `rvn11b`, `rvn13`, `rvn8` (one each) - each judged again, all
  dead.

### FEUD WIRE - BUILT 2026-10-05 (Mac: "Take care of both gaps"; the loot-rarity row on; both foe streams; relay world165)

AUDIT FEUD's named gap (section 32): online, a revenant puppet struck a peer with its kind's plain blows - its owner's
`damageScale` (its rank's x1.1 a rank, its wrath's x1.05 a wrath, a Night-stalker's x1.15 by night, phase two's x1.2)
rode no wire, and a signature of reach landed at its shape's multiplier (a slam's x1.75, not x2.0).

- **The owner** - `systems/revenant.js applyRevenant` keeps its stand's blows over its kind's on its stamp
  (`entity.revenant.blows` - the scale it stood with over the one before it, so an elite's or a champion's never counts);
  a deed that stamps it again (a killer over my body, a felling) keeps them, as it keeps phase two.
- **The law** - `systems/revenantFeud.js`: `BLOWS_WIRE` (per mille, x1 to x4); `feudWire` writes `rb` (none at x1;
  clamped to the law, so a record is never refused whole for it); `feudFromWire` reads it onto the puppet's stamp as
  `blows`, so an heir writes it back; `puppetRevenantBlows(entity, record)` folds `rb` and phase two's x1.2 (`p2`) onto
  the puppet's own `damageScale` - the factor it stood with last (`entity._revBlows`) taken out first, so a record said
  again never doubles it, one changed refolds it, one that says none gives its own back. `ai/puppetBlows.js`: `WIRE_SIG`
  (`wk` +64) - `blowWire` flags a signature; `applyBlowRecord` takes the host's signature numbers (`sig`, the brain
  bringing no revenant system) and strikes a flagged one at `SIG.MULT`, in `SIG.COLOR`, its WIND at `SIG.WIND_PITCH`.
- **The wire** - `net/wire.js validFoeRecord`: `rb` (a whole FOE_BLOWS_MIN..FOE_BLOWS_MAX), `wk` bounded at 127 - each
  refused whole outside its law. `RELAY_VERSION` **world165** and its `relayversion` row; the tests naming the relay
  moved with it.
- **The hosts** - `scenes/exteriorFoes.js` (the street, both interiors) and `scenes/dungeonContext.js` (the room
  stream): each writes `rb` through `feudWire` and keys it; each folds a puppet's blows when its feud fields change (the
  dungeon's also when the record says none); each passes `SIG` to the puppet's blow. A peer's blow lands through the host's
  own door (`calculateAttackDamage`'s `damageScale` tail, then `blowScaled`'s multiplier), so the peer is struck as the
  owner is.
- **Not on the wire** - the pyre (a spell, wound up only at me - RVN13) and the signature's called name (its voice reads
  the owner's record).
- Pins `test/feudwire.test.js` (8 - one through the real street pool). Pins moved (each marked): `tell8_online` (the law's flag bound, both keys, both
  applies), `rvn13_wire` (the street's reader; the relay), `revenant_card` (the street's key), `world3` (the room's
  key); and the relay's name in 28 tests (world164 -> world165,
  `relayversion` excluded as its own law asks, its world165 row added). Mutants `tools/mutants/feudwire.json` (35): 35
  dead. Re-aimed by content (14): `rvn13` (9), `tell8` (4), `soc1`'s S38 - each judged again: dead.

### FEUD HARNESS - 2026-10-05 (Mac: "Take care of both gaps"; the duel harness, and one fault in the game it found)

AUDIT FEUD 2's disclosed gap: the duel harness (`tools/tellDuel.mjs`) fought a revenant alone and never let it run.

- **Its band** - `standKin`: its kin as the street pool stands them (`standBand`): `bandMembers` by rank (RETINUE's -
  none at 1, then 1, 2, 3, 3), each its kind's foe at its own level (a person at mine - 2), ordinary, `retinueOf` its
  master, in the ring out to BAND_SPACING about it; each with its own motor, attack component and brain - the brain's
  tokens shared with its master's, a kin of the tier winding up at me (its iron landings knocking me down; the dodger
  out of its blows as of its master's).
- **Rank 5's rally** - at its stand its band's survivors to it (they are on me already: counted); none standing,
  RALLY_KIN of its kin through a portal (`rallyBand`). **Its scatter** - it runs: its band runs from it for
  BAND_SCATTER_S and is gone when the run is spent (`scatterBand`). No band (`band: false`): no rally.
- **Its flight** - `revenantFleeStep`, the pools' one law, asked of it running or under the line and not yet rolled:
  running, its attack is not stepped (the pools' `continue`); escaped, the fight is over (`fled`); run down, cornered,
  it fights on. I chase it at DFU's run (Speed 50, Running 50: 8.10 m/s), or (`chase: false`) let it go.
- **Whom I strike** - its master first (`order` 'master'), or its band first ('band', the nearest standing kin).
- **The fault it found** - a revenant risen in its last stand as it ran ran on: `beginLastStand` set `f.fleeing` false
  but left the motor's run (`ai.fleeLeft`) going, so it ran untargeted for the rest of its run, and the flee law - asked
  no more - never cornered it nor let it escape. `systems/revenantFate.js beginLastStand` ends the run, as `beginYield`
  and `beginTearAway` do. In the measure below about one rank-3 fight in ten rises in its stand as it runs.
- **Held as it was** - the walk back into reach aims where the foe stood as I stepped (my step before the foes', the
  frame's order), as AUDIT FEUD 2's did: the duel alone and never running reproduces its numbers to the fight.
- **Never modelled** - the player's own health (so the band's plain blows - its kin under the tier - land on nobody),
  a kin's spells (an Orc Shaman's), the foes' bodies against each other, the pools' placement probes (flat ground).

Measured, a thousand fights a cell, an Orc revenant (its kin Orcs, Orc Sergeants and Orc Shamans - none winds up: the
first two are under the tier, the Shaman has no melee shape):

| A rank-3 Orc revenant, its band and its flight | knelt | time to its end (mean) | telegraphed blows on me |
|---|---|---|---|
| Longsword, trading | 11.4% | 12.4 s | 1.73 |
| Longsword, dodging | 88.0% | 12.3 s | 0.00 |
| Longsword, its weakness | 100% | 9.2 s | 1.43 |
| Dagger, trading / dodging | 0% / 87.8% | 23.3 / 22.9 s | 2.04 / 0.00 |
| Warhammer, trading / dodging | 20.0% / 93.7% | 12.7 / 13.7 s | 1.58 / 0.04 |

Rank 5 over rank 1: 2.69 trading (16.6 / 6.2 s), 2.62 dodging (16.1 / 6.1 s). It runs in 8 to 17% of fights (one
roll, under a fifth of its health) and is run down every time (none escaped a chaser; a few in a thousand cornered); its band swings at me about
9 times a rank-3 fight and 18 a rank-5. At rank 5 its band stands with it at its stand in seven fights in eight; in
the rest a flight had scattered it, and two kin step out of a portal. Its band first: a rank 3 takes 29 s, a rank 5
58 s (its band slain, the portal every time). Alone and never running: 12.7% and 94.6% - AUDIT FEUD 2's. Every RVN
target holds (the will 100 / 88.0 / 11.4%, dodging struck 0% in 99.2% of the time, the ranks 2.69 / 2.62), so no call
goes to Mac. TELL's half is unchanged (its fights stand no band).
- Pins `test/feudharness.test.js` (7). Pins moved (each marked): `auditfeud` (the duel's laws on its seeds, alone and
  never running), `auditfeud2` (the dodger waits on every wind-up at me). Mutants `tools/mutants/feudharness.json` (25):
  25 dead. Re-aimed by content (2): `auditfeud`'s AF-S28-dodge-early and `auditfeud2`'s AF2-S1-dodger-early; every
  record on the harness (16) judged again: all dead.

### THE MERGE OF MAIN - 2026-10-05 (the owner: "pick up the revenant PR and get it merged and deployed")

The arc was built on `claude/gracious-noether-8qvhzz` off main's `64f0a4ec` and never opened as a pull request; main had
moved 232 commits (#586-#622) when it was picked up. `origin/main` `cc7585cb` merged in:

- **The conflicts** - 208 files, 487 hunks. 404 were numbers-only: a cite taken from main and mapped by
  `tools/citeMerge.mjs` (543 cites moved; the struck rows held, as the tool holds them), any other number from the side
  that changed it, a count both changed counted again. 83 were real, resolved by hand, below. By content after the
  tool: Port-Status section 2's fourteen row identifiers, its loose row cites and section C's bounds (THE TELEGRAPHED
  FIGHT's row moved sections B, C and D down a line), citedrift's CD4 cites (25, their file and number on separate
  comment lines, and three range ends by their blocks' unchanged length).
- **One aim law** (`ai/tactics.js`). Main's AUDIT ARENA-LADDER taught the brain to wind up at a BOUT-MATE on the
  arena's sand (`blowAim`, the blow's `tg` and `sand`, `_blowFor` its verdict's mark); TELL8 taught it to wind up at a
  PEER it hunts (`targetFeet`, the blow's `key`). They are one law now: `targetFeet` answers my feet, a hunted peer's,
  or a bout-mate's (main's arm, whole), and `judgedHere` says whose landing this client decides - mine and a
  bout-mate's here, a peer's on the peer's own screen (10.3). `resolveLanding` writes the verdict, its weight and
  `_blowFor` for a judged one, and what a landing does to ME (TELL6e), the dodge's tag and the feud's ledger for mine
  alone (`atMe`); the charge's run lands the same way. `b.key` is the one record of whom a blow was wound up at (main's
  `tg` folded into it: AUDIT TELL B8 already breaks a wind-up whose foe turned, which main's landing check asked
  again), and a wind-up at a bout-mate is drawn for the stands (`b.sand`, set in `beginWindup`; no other mark is begun
  at). Every TELL law now reaches a bout-mate as it reaches me - the patterns, the shapes of its tier, the overreach of
  a miss - since the mark is one; a bout fighter is never a revenant (AUDIT ARENA-LADDER 2's `revenantCandidate`), so
  no RVN law does. AUDIT TELL's shards are drawn to the sand's range as the live marks are (`drawableBlows`).
- **One home for the shapes** (`ai/blowShapes.js`). Main moved the families and `inBlow` into the leaf the relay
  reads; TELL6's and RVN5's verdicts (the ring, the charge's lane, the leap's disc, the aimed line, the pyre's disc),
  TELL5's `blowFamily` and TELL7's whole set - `extraShapesOf` (its kinds by MobileTypes number, as the families are),
  `isElite`, `wholeSet` and `blowShapesOf(mobileType, entity)` - join them there, beside TELL2's numbers. All of it is
  field tests and tables, so the leaf still imports nothing; `ai/foeBlows.js` and `ai/tells.js` hand the leaf's own
  functions on (audit24's ratchet: a second `blowShapesOf` in the brain was a duplicate declaration). The relay's
  ladder brain asks a kind's family alone (no entity), so its fighters throw and are judged as before - the lunge,
  sweep and slam numbers are unchanged - and the arena's wire still takes exactly the shapes a family throws
  (`ARENA_BLOW_SHAPES`; `arenaladder_audit` T5's pin moved from all of `BLOW` to the families').
- **The relay is world170.** The branch's world162 (TELL8), world163 (AUDIT TELL), world164 (RVN13) and world165 (FEUD
  WIRE) were all taken by main (PRIMARCH, SUNBABY1, PARTY-LEAD, SERPENT1 - main stands at AUDIT ARENA-LADDER's world169).
  The four wire changes are one version past it: `RELAY_VERSION` world170, its `relayversion` row the merged bundle's
  hash (the branch's four rows recorded beside it as unpublished), every live-version pin moved and composed (34
  files). FEUD's new foe-record fields gate on no version - a relay before it drops them - so no `*_RELAY_MIN` moved.
- **Unions** - the map marks (RVN7c's lairs beside SERPENT1's ring and HOME-VENDOR's trader, on both maps and in the
  legend), the HUD's return (TELL9's poise track beside SERPENT1's mark), the hosts' imports and swing sounds (TELL8's
  wind-up gate beside main's companion barks), the GL-state shadows and the minted batch fields (TELL2's glint beside
  LPT1's handover and tree fields), the motor's recentre (AUDIT TELL B10's charge head beside COMPANION-TRAIL),
  `revenantCandidate` (RVN6's band follower beside AUDIT ARENA-LADDER 2's bout fighter), the exterior host's Recall
  harness (RVN10's three beside the arena's hold).
- **The records** - Port-Ledger section A: THE TELEGRAPHED FIGHT is the 279th row (the 271st on the branch), under main's
  LPT1; Systems.md: 415 modules; Testing.md: the suite counted again.
- **Pins moved** (each marked): the 34 live-version pins; `arenaladder_audit` (T2's mark is `b.key`; T3's three landings
  and ARENA-LADDER 2 T1's are STEPPED at 16 Hz - AUDIT TELL B1 breaks a wind-up the brain was not asked about for
  BLOW_STALE, and main's tests jumped the clock to the landing; T5 the families' shapes), `audittact` (the token
  holder's wind-up line, TELL8's), `combatVisuals` (the glint's reset filtered beside LPT1's), `hard3_types` (52 minted
  fields), `la_cost` (106 billboard uploads; the glint's and LPT1's shadows), `qx1_exterior_host` (both sides' names),
  `fb1004e_overworld` (the legend's stub carries the lairs), `rvn7c_map` (the lairs' clause, the trader asked after
  it), `tell8_online` (TELL8's wire is world170's row), `travelmap` (U41's window to 10800 - the last needle at 10563 on
  main, 10533 on the branch, 10685 merged).
- **New** - `test/feudmerge.test.js` (FM1 a sand shard drawn for the stands; FM2 one mark, two judges, through the real
  brain) and `tools/mutants/feudmerge.json` (5). Mutant records re-aimed by content (35): `arenaladder` (5), `tell7`
  (7), `rvn5` (3), `tell8` (3), `tact4` (3), `survtiers3` (3), `tell6a` (2), `tell5` (2), `audittact`, `rvn7c`, `soc1`,
  `survtiers`, `tell6b`, `tell6c`, `tell6d` (one each). The 40 records the merge re-aimed or added, judged again (`node tools/mutate.mjs`): 39 dead, 1 equivalent as
  recorded (`TELL7-unbuilt-shapes`).
- **Verified** - lint and the types clean; the whole suite on the merged tree (21,372 tests, 303 skipped without the game's data):
  the 19 it failed were the pins moved above and the duplicate `blowShapesOf`, each fixed at its cause and its file
  run again; the bible's five gates (manifest, citedrift, mutantdrift, audit18_bible_docs, ledger) green; CI's verify
  on the pull request.
