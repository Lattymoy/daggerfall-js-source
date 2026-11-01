# Feud: blows with weight, revenants with memory

Two halves that lean on each other. **TELL** makes a foe's telegraphed blow a commitment for both sides: poise, a body
that winds up, iron blows that must be dodged, and a cost for missing. **RVN** gives a revenant a memory of how it was
beaten, a hidden weakness, a will to break, a last stand, a named blow, a band, a lair, and a reason not to leave it
alone. The telegraphed blows themselves are `12-Enhanced-AI/Tactics-Arc.md`; the revenants as a system are
`06-Systems/Revenants.md`.

## How it works

**The switches.** TELL reads the Enhanced AI switch (`src/ai/tactics.js` `tacticsSwitchOn`); RVN reads the Loot
rarity row (`src/systems/revenant/revenant.js` `revenantOn`). With Enhanced AI off no TELL rule runs and DFU's motor
is unchanged. With Loot rarity off no revenant exists. RVN rules that need a telegraph (the signature blow, the last
stand's burst) wait for Enhanced AI; the rest run without it.

### TELL (`src/ai/tells.js` `TELL`, shapes in `src/ai/blowShapes.js`)

- **Poise.** Damage landed during a wind-up fills a meter: a share of the kind's health by its weight (`POISE_W`,
  0.2 to 0.5, a massive foe never under `POISE_FLOOR_MASSIVE`), scaled up for elites, champions and revenant ranks. A
  blow fills it by its weapon class (blunt 1.5, axe 1.25, long blade 1.0, short 0.7, hands 0.6, arrow 0.5, spell
  0.75; two-handed x1.15), x1.5 from behind and x2 on a revenant's weakness. Full, the wind-up breaks and the foe is
  **staggered** (`STAGGER_S` 0.8 to 1.4 s by weight), taking x1.25, with no new stagger for 3 s.
- **The tell.** The wind-up is the foe's own swing held at the raised arm, released on the landing. A glint on the
  body pulses as it begins and rises in the last 0.2 s; a sound marks the start and a whoosh 0.25 s before the
  landing. The ground mark (`src/render/foeTelegraph.js`) uses the world boss's readable line, and a wind-up near the
  player never fades below 60% in fog.
- **Iron blows** (red, unbreakable): a heavy or massive body's slam and ring, one elite blow in three, a revenant's
  signature from rank 3. They run longer. Paralysis still stops them.
- **Missing costs.** A blow that finds no one leaves its foe overreached (`PUNISH_S`, 0.8 to 1.4 s by shape), taking
  x1.3, and the first blow landed staggers it. Leaving the shape in its last 0.25 s is a perfect dodge: a window x1.5.
- **Patterns.** Wind-up lengths vary; a lunge tracks for its first half; higher-tier blades feint (a feint never
  glints); brutes chain two blows.
- **Shapes.** Lunge, sweep and slam (`12-Enhanced-AI/Tactics-Arc.md`), plus the ring (safe at its feet), the charge, the leap and the archer's
  aimed shot. A landing pushes (lunge, charge), rattles, bleeds, and an iron slam knocks the player down.
- **Who and how often.** Level 10 and up, elites, champions and revenants. Elites, champions and revenants throw
  their family's whole set and wind up more often; cooldowns shorten by tier.
- **Online.** A wind-up rides the foe stream; peers see it, a foe can wind up at the peer it hunts, and each client
  judges its own feet. Poise filled by peers counts.
- **On screen.** The enhanced target bar shows poise and the stagger; hit words say what a blow did.

### RVN (`src/systems/revenant/revenantFeud.js`)

- **It remembers.** A ledger of wounds records how it was beaten; it comes back with up to three adaptations
  (`ADAPT_MAX`, never more than its rank), never immunity: mail against blades, warded against an element, arrow-wise,
  patient against dodging.
- **A weakness** (an element, a metal, a weapon class, the daylight), drawn from its id, hidden until struck, hinted
  by its flinches under half health and by rumour. Struck, x1.5 (daylight x1.25) and its poise fills twice as fast.
- **The will.** From `WILL_RANK` (2) a revenant kneels only if, in that fight, its weakness was struck or it was
  staggered or perfectly dodged once (`WILL_STAGGERS` 1). Otherwise at the killing blow it escapes, ranked up and
  adapted again.
- **The last stand.** From rank 3, once a stand, the blow that would end it brings it back to 30 / 35 / 40% health by
  rank (`LAST_STAND_HEALTH`) after a 1.2 s roar and a ring burst, then phase two: harder blows, faster, shorter
  wind-ups and cooldowns.
- **A signature blow** from rank 2 (`SIG_RANK`), named for it ("Grushnak's Skullsplitter"), iron from rank 3.
- **A band** of its own kin by rank (`RETINUE`: 0, 0, 1, 2, 3, 3), who scatter when it falls.
- **The hunt.** Each revenant has a lair, a named dungeon near where it was made. Townsfolk talk of it
  (`RUMOR_CHANCE` 0.35 an "Any news?" in its region); once heard of, the lair is on the map and in the journal; it is
  found resting there, with `LAIR_GOLD` x1.25.
- **It takes something.** Online, the revenant that kills you takes one unlocked piece, at most `TOOK_MAX` (3); kill
  or spare it to get it back.
- **It festers.** Left past its due day, every three days it grows (`FESTER`: +10% health, +5% blows), and at three
  wraths it ranks up.
- **New deeds.** A special foe that knocks out your companion, or that you flee from past 70 m while hurt below half
  (`ROUT`), becomes a revenant.
- **The sworn have loyalty.** Kept well they are devoted; below `DESERT.AT` (20) they may desert (15% a day); an
  Unhinged, Craven or Brutal one under `BETRAY.AT` (10) may turn on you below a quarter of your health, once.
- **Shown.** The Revenants page on the Holdings tab (`src/ui/revenant/revenantPage.js`) and the card
  (`src/ui/revenant/revenantCard.js`) show learned habits, weakness, will, signature, band, lair, what it took and its
  festering.

## Rules

- Make revenants more complex and harder to finish, and give telegraphed blows depth so foes are not easily stunned
  (Mac). Every design call was taken as recommended, and the balance set: one stagger or a perfect dodge breaks the
  will, and the last stand is 30 / 35 / 40% (Mac).
- Fair by construction: nothing new deals harm without a tell, every telegraphed blow is dodgeable by moving, every
  adaptation has an answer, nothing grants immunity.
- DFU's knockback, CanAct and Hurt are untouched outside a wind-up; paralysis stops everything, iron included.
- The shapes' numbers live in `src/ai/blowShapes.js` (a leaf the renderer imports); every other TELL number in
  `src/ai/tells.js`; every RVN number in `src/systems/revenant/revenantFeud.js`.
- TELL timers read the brain's clock (`src/ai/tacticsClock.js`); RVN days read the character's own clock.
- A revenant's identity draws (weakness, signature, band, lair) are seeded by its id, the same on every client and
  load. A fight's draws are unseeded.
- A record field survives only through `revenant.js` `sanitize`; a new field enters there with a validator.
- No purse for a revenant: the drop, the trophy and the piece it took are the reward.

## Daggerfall Unity

DFU has no telegraphed blows, poise or revenants. The nearest DFU law is that Hurt cannot interrupt an attack already
begun (`MobileUnit`, `EnemyMotor`); poise carries that rule one beat earlier, behind the switch. Everything else here is
DFO's own.

## Code and tests

- `src/ai/tells.js`, `src/ai/blowShapes.js`, `src/ai/foeBlows.js`, `src/ai/tactics.js` - TELL
- `src/render/foeTelegraph.js` - the ground mark
- `src/systems/revenant/revenantFeud.js`, `src/systems/revenant/revenant.js`, `src/systems/revenant/revenantFate.js` - RVN
- `src/ui/revenant/revenantPage.js`, `src/ui/revenant/revenantCard.js` - the page and card
- `test/characters/enemy/tact4.test.js` - the blows TELL builds on
- `test/characters/enemy/tell2_tell.test.js` through `test/characters/enemy/tell7_tier.test.js` - the tell, iron,
  punish, patterns, the four new shapes and the tiers
- `test/systems/revenant/feudbalance.test.js`, `test/systems/revenant/feudwire.test.js`,
  `test/systems/revenant/feudharness.test.js` - the balance, both foe streams, the harness
- `test/systems/revenant/rvn4_stand.test.js`, `test/systems/revenant/rvn7a_lair.test.js`,
  `test/systems/revenant/rvn11a_loyalty.test.js`, `test/systems/revenant/rvn12b_page.test.js` - the last stand, the
  lair, loyalty, the page
- `tools/tellDuel.mjs` - the duel harness that measures the balance targets
- `tools/foeTelegraphProbe.mjs` - the ground mark drawn in a real WebGL2 context

## Open

- `src/scenes/dungeonContext.js` FLAGGED: the dungeon's foe stream carries none of the street record's z, nm, yd, ex
  or sp; FEUD adds its own fields alone, so a band follower in a dungeon stands unnamed on a joiner's screen.
- The single-location host `src/scenes/exterior.js` builds its pool without fates and no location index: its revenants
  die outright and have no lair, and it stands no companions.
- A spell's knock-out of a companion names no striker, so it fells no revenant; a dungeon never routs by distance.
- The player has no block or parry; a brace would change every fight and is its own work.
