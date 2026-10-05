# Revenants

**Status:** shipped 2026-10-02 (`src/systems/revenant.js`, `test/revenant.test.js`).
**Next:** `12-Enhanced-AI/Feud-Arc.md` (FEUD, proposed 2026-10-04) - memory, a weakness, the will, a last stand, a
signature, a band, a lair, theft, festering, new deeds and loyalty. Nothing below changes until a FEUD slice ships.
Mac: "the ability for these enemies that kill you, or a very small chance to flee at low health. These enemies can
return at a later time stronger, with a new name, a chance of more loot and taunt the player. This is our own
[...] system."

**REVENANT-NAME** (2026-10-02, Mac: "Nothing should reference [the old name]. Should instead be something unique"):
the system, its files, its save slot (`Revenant`), its app-storage key (`dagger.revenant.<characterId>`), its HUD
piece and its words are the REVENANTS - a foe that returns. Nothing had shipped under the old name, so nothing is
migrated.

A special foe that kills you, or breaks and runs at low health and gets away, is remembered by your character. It
comes back later under a name of its own, stronger, carrying better loot, and it tells you it remembers.

## 1. Who becomes one

A **special** foe: an elite (`systems/eliteFoes.js`), a LOOT7 champion (`systems/champions.js`), or a revenant already.
It must be level 3 or more (LOOT7's floor), and never the city watch, an ally, or a quest's foe
(`revenantCandidate`). With the **Loot rarity** row off nothing here happens: no revenant is made, flees or returns.

Two deeds make one:

| Deed | How | Seam |
|---|---|---|
| **Slew** | Its blow takes the player's last health (melee or an arrow) | The struck seam marks the attacker (`combat/formulas.js`), the damage door takes the mark, the hurt tells `registerPlayerBlowLanded` (`systems/sigilSetPowers.js`). Confirmed a microtask later, after `hurtPlayer` is done, so a death Stendarr's mercy (`setAvoidDeathHook`) undoes makes no revenant. |
| **Fled** | Under 20% of its health for the first time, it wins a roll (5%; 15% for a revenant already) and runs. Out of reach before its run ends, it has escaped. | `scenes/exteriorFoes.js` update: `revenantFleeHealth` and `rollRevenantFlee`, then `ai.flee(playerFeet, 8 s)` (`characters/enemyMotor.js`). While fleeing it does nothing else. At the end of its run or 45 m off, `escapeFoe` removes it with no corpse and no kill. |

A kill no blow names (a spell's burn, a lingering effect's round, a poison's tick) goes to the foe whose harm last
reached the player (**REVENANT-HARM**, `systems/harmMark.js`, a leaf):

- a spell landing on the player marks its caster for 30 s (`scenes/hostMagic.js applySpellToPlayer`);
- a lingering effect's round marks its caster again as it lands (`systems/effects.js runEffectRound`);
- any foe's blow marks it for 120 s (the struck seam), since a poisoned weapon's dose rides that blow and its ticks come later.

A killing blow always outranks the mark.

**REVENANT-DUNGEON** applies the same flee law in a dungeon to a foe of the player's alone: offline, or past the room's
shared run online (a room's layout foe vanishing on one client would leave it standing on the rest). It aims at nothing
while running, its walk still drawn. It is retired through the quest pool's own door (`escapeDungeonFoe`). A slain
revenant closes there too.

**One flee law** for every pool: `revenantFleeStep` answers each frame with `start`, `run`, `escape`, `cornered` or
nothing. A foe chased down, its run spent within 20 m (`REVENANT_ESCAPE_NEAR`), is **cornered**: it turns and fights to
the end and never runs again ("Then I take you with me!"). Only out of reach does it escape. The step is asked only of a
foe running or under the line, so nothing is made per foe per frame.

**A slain foe is no one's revenant**: a death no blow names never goes to a foe already dead (a fall after the fight).

## 2. What it becomes

A record per character:

```
{ id, rev, mobileType, gender, given, epithet, name, rank 1..5, kills, escapes, returns,
  trait (a champion's id) | null, elite, born, dueAt, out, outAt, defeated, defeatedAt, notice, history[≤12] }
```

- **Given name**: DFU's own name banks (`characters/nameHelper.js`). A monster gets a Monster1 or Monster2 name; a
  class foe (a person) gets a first name from one of the eight races' banks. The draw runs on DFRandom **seeded by the
  revenant's id**, and the shared seed is restored afterwards: making a revenant moves nobody's dice, and one id always
  gives one name.
- **Epithet** by the deed: *the Butcher*, *Bane of Ayla* for a kill; *the Scarred*, *Who Ran* for an escape. From rank 3,
  whatever the deed, the risen ones: *the Thrice-Risen*, *Revenant of Ayla*. Every deed after the first ranks it up
  (to 5) and gives it a new epithet, never the one it wore.
- **Named at once**: the foe that killed you wears its new name where it stands (`entity.revenant`). Kill it there and
  it is slain.
- **Cap**: five living revenants. A sixth replaces the weakest, oldest, which is BURIED: its record becomes a tombstone (its
  id and a newer revision), which every merge keeps over an older copy, so an older save never raises it.
- **Bounded**: the page keeps the newest 12 slain (`REVENANT_FALLEN_MAX`); older ones are buried too. At most 200
  tombstones are kept (`REVENANT_TOMBS_MAX`).
- **Told once**: after a kill, the player is told once they stand alive again (online's respawn, or the next load
  offline): "The Orc that killed you lives on as Grushnak the Butcher. It will come for you again."

## 3. Its return

- **Due** one to three days later on the character's own clock (`worldTick.ownMinutes`).
- **Claimed by its roll**: the record is out from the roll that picks it, so no second copy stands while its stand loads. A stand that stood nobody frees it (`releaseRevenantStand`).
- On a due revenant, an open-world encounter roll (`scenes/world.js runEncounterTick`) stands it instead, 50% of the
  rolls. Only one is out at a time, the highest rank first. This happens before the party's group-roll gate: a revenant
  is the player's own.
- **Stood** by `spawnFoe(..., { revenant })` (`revenantSpawnOptions`):
  - an elite's glow again where elites stand (online), never a fresh roll;
  - its champion trait again, never a fresh roll;
  - then **its rank**: health ×(1 + 0.25·rank), blows ×(1 + 0.1·rank), over whatever its trait or glow gave;
  - a class foe at the player's level + 2·rank.
- **Taunt**: in sight, on me, within 25 m, once each return. The line knows its last deed and the player's name. A
  beast or a mindless thing (rats, bears, atronachs, zombies...) bares its teeth instead.
- **Out** from its stand until it dies, escapes, or leaves. Outrun past the cull, swept by a load, or the like, it is
  due again in six hours (`revenantPresence`, which looks in the open world's pool and in whichever host the player stands in, with a few seconds' grace for a stand still loading).
- **Slain**: its record is closed (`defeated`). It never returns: "Grushnak the Butcher has fallen. Your revenant is no
  more."

## 4. Its drop

This drop comes on top of its kind's own loot, from the elite's minting (`eliteFoes.tieredGear`):

- gold: level × rank × 15–40;
- a Magic piece 50% of the time;
- a Rare at 15% + 10% per rank, and always from rank 3;
- a Legendary at 3% + 3% per rank.

## 5. Its keeping

Two places, merged per record by `rev`:

1. **The save**: the per-mod slot `Revenant` (`systems/modSaveData.js`), which travels with an online character. A
   record is never saved as out: the foe that stood for it is not in a fresh world.
2. **The app's storage**: `dagger.revenant.<characterId>`. An offline death ends the run with nothing saved, and a death
   is exactly what makes a revenant.

A reload of an older save keeps every revenant made since, and never raises one already slain. Another character's
revenants are its own.

**FEUD's fields (RVN1, 2026-10-04).** The record carries `scars`, `learned`, `weak`, `weakKnown`, `sig`, `kin`, `lair`,
`lairKnown`, `took`, `wrath`, `fights` and a sworn one's `companion.loyalty` - each checked by its validator when read
back, and an older record's derived (its weakness, signature at rank 2 and up, and kin drawn on its id; its fights
`kills + escapes + returns`; a loyalty its personality's start). The law is `systems/revenantFeud.js feudFields`
(`bible/12-Enhanced-AI/Feud-Arc.md` section 26). The slot and the mirror also keep `lastDay` (RVN9's festering day),
read back a whole day or none, the later of the two kept.

## 6. Online

A revenant is its character's own memory. A returning one is my own foe, streamed as any: its kind, health, trait, glow
and (**REVENANT-WIRE**) its name. The foe record's `nm` is printable and at most `REVENANT_NAME_MAX` (64) characters,
validated in `net/wire.js validFoeRecord`; the relay is `world153` (`world144`, then `world152`, on its branch, until
main took both numbers). Every puppet is called what its owner calls it.

## 7. Names everywhere (FOE-TITLE)

`systems/foeTitle.js` is the one home for what a special foe is called. In order: a revenant's own name, then a
champion's trait before its kind, then "Elite" before its kind. The target bar, the hover (named even while hostile:
`foeTitled`), the death line and the body's title all ask it.

## 7a. The card (REVENANT-CARD, Enhanced Plus)

Everything a revenant says or does is an **event** (`revenantEvent` and the builders `revenantTauntEvent`, `revenantFleeEvent`,
`revenantEscapeEvent`, `revenantSlainEvent`, `revenantRiseEvent`). An event carries:

- a kicker: *Revenant*, *Fleeing*, *Escaped*, *Revenant slain* or *A revenant rises*;
- its name, and what it is (rank, kind, trait, elite);
- its **portrait**: the sprite it wore (a retextured kind's own), else its kind's by gender, at the front-facing record (the idle's, 15, else the walk's, 0);
- its **words** in its own voice: a taunt, "This isn't over!", an escape's promise, last words, a gloat;
- what happens in the narrator's voice (a beast never speaks: "Bares its teeth - it remembers you.");
- the one `line` a text surface says instead.

`systems/revenantVoice.js` (a leaf) hands an event to the registered face, or speaks its line through the host's `say`.

The face is `ui/revenantCard.js`, on the enhanced skin only:

- **Placement and lifetime**: the notices' twin at the LEFT edge, sliding in and out. One card per revenant, two at most. The words are typed at 42 letters a second, then held 3.5 to 7.5 s.
- **Colours**: a blood edge for a taunt or a rise, amber for a flight or an escape, brass for a fall (the portrait grey and struck through).
- **Drawing**: drawn on drawHud's one call, behind the HUD's hide gate (hidden, its clock stops) and its hide door. The DISC29-D watchdog hides it when a host stops drawing. HUD-MOVE moves it (`'revenant'`, with a preview).
- **Plus dressing**: the kit dresses it by role: panel and accent edge, the portrait a well, the rank a chip, the name a header rule. Stone gets brighter words, as the stats card does.
- **Accessibility**: a screen reader gets the whole line at once; reduced motion types and slides nothing.
- **Classic skin**: the presenter declines and the line is said, as before.

## 7b. The page (REVENANT-PAGE)

`ui/revenantPage.js` is the **Revenants** page on the Enhanced pause menu's Holdings tab (the Stats rail until HOLDINGS,
2026-10-03), shown while revenants are made or any is remembered. The living come first, strongest first, each with:

- its portrait and rank;
- what it is;
- what it has done to you ("Killed you twice, escaped you once");
- when it will come (*Hunting*, *Biding*: "in about 2 days", or *Abroad*);
- its last deeds.

Then the **Fallen**, struck through, with when each fell. A character with none is told how one is made.

## 8. The numbers

Every number is a named constant at the top of `systems/revenant.js`:

| Constant | Value |
|---|---|
| `REVENANT_MIN_LEVEL` | 3 |
| `REVENANT_MAX` | 5 |
| `REVENANT_MAX_RANK` | 5 |
| `REVENANT_FLEE_HEALTH` | 0.2 |
| `REVENANT_FLEE_CHANCE` / `_REVENANT` | 0.05 / 0.15 |
| `REVENANT_FLEE_SECONDS` | 8 |
| `REVENANT_ESCAPE_DISTANCE` | 45 |
| `REVENANT_RETURN_MIN/MAX_MINUTES` | 1440 / 4320 |
| `REVENANT_RETURN_CHANCE` | 0.5 |
| `REVENANT_LOST_MINUTES` | 360 |
| `REVENANT_HEALTH_PER_RANK` | 0.25 |
| `REVENANT_DAMAGE_PER_RANK` | 0.1 |
| `REVENANT_LEVEL_PER_RANK` | 2 |
| `REVENANT_TAUNT_DISTANCE` | 25 |
| `REVENANT_LOOT` | see section 4 |

## 9. Every host

The streaming world (`scenes/world.js`) and the single-location host (`scenes/exterior.js`) both:

- stand a due revenant on an open-world roll;
- read its presence;
- tell the player of a kill once alive again.

The open world's pool (`scenes/exteriorFoes.js`) and the dungeon (`scenes/dungeonContext.js`) both run a fleeing foe
and close a slain one. Returns stay in the open world: a dungeon's foes are its layout's.

## 10. Who it is (REVENANT-VOICE)

Mac: "They should have their own unique personalities that affect their speach. One could be humorous, or witty, etc."
`systems/revenantPersonality.js` (a leaf) holds ten personalities and every word they say:

| Personality | In a word | A beast's manner |
|---|---|---|
| Brutal | savage, blunt, hungry for blood | with a savage snarl |
| Witty | sharp-tongued, sardonic | with an almost knowing glint |
| Humorous | laughs at everything, your death included | with a playful yip |
| Arrogant | proud, certain it is your better | with its head held high |
| Cold | quiet, patient, merciless | in eerie silence |
| Zealous | sees the gods in every blow | with wild, burning eyes |
| Unhinged | manic, giggling | with a frenzied howl |
| Honourable | a duellist with a code | with a steady, measured gaze |
| Craven | all bluster and nerves | with a nervous whine |
| Weary | tired of the killing | with a tired, rumbling sigh |

- **One per revenant**, drawn from its id (`personalityFor`), so it is the same on every read, every load and every
  client, and **leaning by kind**: an orc leans brutal, a lich cold, a daedra arrogant; a beast is never a preacher or a
  wit; a person may be anyone. A record from before is given the one its id draws.
- **A voice before a name**: a special foe that breaks and runs is given an id to speak with there and then; if it gets
  away, the revenant it becomes keeps that id, and so that voice.
- **Every moment**: its returns (by its last deed: it killed you, it ran, it has risen three times), flight, cornering,
  escape, death, gloat, and REVENANT-FATE's and REVENANT-COMPANION's moments below - two lines or more in each, three
  for the returns, the yield, the execution and the oath; `{p}` the player's first name.
- **A beast never speaks**: the narrator says what it does, in its manner ("Sinks low before you with a playful yip,
  beaten.").
- The card and the page wear its personality as a chip.

## 11. Beaten, it yields (REVENANT-FATE)

Mac: "Players should have the option to kill or spare"; "the choice popup should reuse the loot menu".

- **The yield**: the blow that would kill one of the player's revenants (any blow - the revenant is the player's own;
  never a Disintegrate's kill) leaves it at 1 health on its knees (`systems/revenantFate.js beginYield`): its fight and
  its run over, its hurt's last frame held with a breath now and then (`MobileUnit.heldPose`), no blow reaches it, no foe
  hunts it (`enemyTargets.js`), never in the save. Its plea is said in its voice; its record notes the deed. Its
  TROPHY is rolled now, so the choice shows it.
- **The choice** is the loot window's: activating it (at the treasure's reach, as a body - `mobileEnemyActivate.js`)
  opens the window with its FATE side (`ui/enhancedInventory.js` + `ui/revenantFateView.js`): the loot frame's own head
  (its name, what it is, its personality), its plea, and two of the loot list's rows - KILL, drawn as the trophy weapon
  is drawn when looted (its tile, its rarity's colour), and SPARE, its portrait and where it would stand. A row is
  picked, then confirmed (a second press, the confirm button, Enter); K and S pick; Back steps out of a pick, then closes
  the window and leaves it kneeling. The classic skin asks with a keyed box.
- **Hesitate** past `REVENANT_YIELD_MS` (90 s of the world's own time - a window that pauses the game holds it), or walk
  `REVENANT_YIELD_REACH` (60 m) off, and it **slips away**: an escape, its rank up, its words about your hesitation.
- **Underground** the same, for a foe of the player's alone (REVENANT-DUNGEON's gate). A host that cannot open the
  choice (`fates` off) lets its revenants die as before.

## 12. Kill: the execution and the trophy (REVENANT-FATE, REVENANT-TROPHY)

Mac: "Killing should show a unique animation where you destroy your foe, which drops a unique weapon random rarity
weapon specific to the enemy, with their name included in the weapon name."

The execution (`EXECUTION_MS`): its last words in its voice and the blow (a heavy swing's sound, the camera kicked);
at 480 ms the BURST - blood thrown wide with gibs (the heaviest blow there is), a red flash, a harder kick, a burning
roar - and from there the body **burns away from the feet up** in embers (DISSOLVE, below) until, at 1.5 s, it is gone:
no body. Where it knelt drops a **pile** (the place's dropped loot, with its line of light): everything it carried and
its trophy. Its record closes for good, **executed** (the page's Fallen say so).

The trophy (`systems/revenantTrophy.js`):

- **Its weapon**: the best blade it carried, else its kind's (an orc's war axe or battle axe, a lich's staff, a vampire's
  saber or katana, a giant's warhammer, a bear's war axe...) or a person's by class (a Barbarian's claymore, an
  Assassin's tanto, an Archer's longbow...); one of a kind's two by its id.
- **Its name**: "<given>'s <noun>" - Grushnak's Reaver, Varis' Requiem - the noun the weapon's, by its id.
- **A random rarity, never Common**: Legendary 12% + 5% a rank above the first, Rare 33% + 4% a rank, else Magic.
- Its material the better of two rolls at the player's level.

## 13. Spare: the sworn (REVENANT-COMPANION, COMPANION-SLOTS, COMPANION-ROSTER)

Mac: "Spare should allow you to free the enemy, which then adds them as a companion, which you could keep send them away
or keep them with you. Reuse the crew companion system. Companion slots should still be limited and will need a new
enhanced plus UI feature."

- **Sworn**: spared, it rises, gathers into a portal where it knelt, and is sworn to the player for good - it hunts
  nobody, never returns as a foe, and its record keeps its place (`companion`: with the player, away, or resting).
- **The crew's own layer** (`scenes/crewAshore.js`) stands the sworn - every place, every door, the heel, the catch-up,
  health and spells carried - as a second party of the crew's shape (`systems/revenantCompanions.js revenantParty`), never
  under the naval arc's gate. Each stands at the player's level with its rank's strength (health once, its blows always),
  called by its own name; activated, it opens its pack (the crew's COMPANION-KIT storage); it has a card on the party
  panel and a green bar overhead.
- **Slots** (`systems/companionSlots.js`): **three** at the player's side, the crew's hands ashore and the sworn together -
  a hand is refused ashore when they are full ("no room at your side"), and a newly spared one waits **away**.
- **Six** sworn at most; with six, SPARE is refused until one is released.
- **Knocked out**, it is carried off through a portal to rest eight hours, then waits, fit again, to be called.
- **The Companions page** (`ui/companionRoster.js`, the pause menu's Holdings tab): the slot strip (who stands in each,
  a crew hand by name, the open ones), **At your side** (portrait, rank, personality, health; Send away), **Away**
  (Call - refused, and saying why, while the slots are full or it is still hurt; its rest), **Release** asked twice.
- **Its words**: as it arrives when called, as it is sent away or released, when it falls, now and then as it goes into
  a fight or over a kill (a minute between each one's, twenty seconds between any) - all in its voice.

## 14. The portals and the dissolve (COMPANION-PORTAL, DISSOLVE)

Mac: "Companions when playing catch up, spawning in, or spawning out should use a unique portal animation instead of
just popping in and out."

- **The portal** (`scenes/portalFx.js`): a violet vortex drawn here (twelve frames, an oval with spiral arms turning
  inward, a white-hot rim and a dark heart), self-lit and blended, standing a step behind the body from the eye. It tears
  open (360 ms), holds, and seals (420 ms) with the magic school's cast sound. Every place's pool owns its set and draws
  it with its foes (the street, a building, a dungeon).
- **Where**: a companion's **arrival** (it gathers out of the light), its **leaving** (sent away, knocked out - it burns
  into the light, and is taken out of the place only once the portal has it), a **catch-up** (a short pair: one where it
  was, one where it stands again), and a spared revenant's oath. A change of place lifts the party at once (the place is
  going) and it arrives through portals in the next.
- **The dissolve** (`systems/dissolve.js`, both billboard shaders): `batch.dissolve = [share gone, r, g, b]` - the
  sprite eaten in two-texel grains from the feet up, every grain blazing in its colour along the edge (ember for an
  execution, arcane violet for a portal). The renderer uploads it per batch on change (`uDissolve`).

## 15. Online (REVENANT-FATE)

The choice is the owner's (a revenant is its character's memory). The foe record carries `yd` (kneeling), `ex`
(being executed) and `sp` (spared, rising into its portal), so every puppet kneels, burns away and goes as its owner's
does; the hover says it is beaten (`world153`, with REVENANT-WIRE's `nm`). A foe adopted by a peer (the owner's
death) stands as itself - its owner's judgement goes with the owner - and a foe mid-judgement is never handed over.

## 16. The audit (2026-10-02, Mac: "Audit everything and ensure perfection")

Five audits - the records and their words, the kill-or-spare flow, the sworn, the UI, the burn and the portals - and
every finding fixed (`test/revenant_audit.test.js`, `tools/mutants/revenantaudit.json`):

- **Records.** A judged revenant (executed, released, sworn) does no deed - its poison finishing the player after it
  knelt raised it again under its own id, or ranked up a sworn companion. A kneeling one claims no kill and clears its
  harm mark; a load, a new game and an answered death clear it too. The cap never buries one standing in the world, and
  a forgotten id is never worn again. One standing as the save is made is left out of the street's save and comes due
  again after `REVENANT_LOST_MINUTES` (a nameless copy stood beside it).
- **A sworn one's pack is the save's.** The mirror outlives a load, but a pack is inventory: the save's copy says what
  is in it (a load duplicated or lost items). A release hands the pack back - gold to the purse.
- **Words.** The risen's tally taunt only with kills to count (two or more); a revenant's flight and cornering know the
  player's name, and the cornered line says its words; a beast's moment keeps what the moment says (a spared beast
  waiting away "fell in at your side"); a mute kind (a skeleton, a zombie, an atronach) leans as a beast does, never a
  wit; a `$` in a name is a letter; every personality has three risen taunts; one possessive for every title
  ("Varis' Shadow", "Varis' Rod").
- **The fate.** The window holds the wait (the foes' clock runs under a window - WINFOE1 - so a revenant slipped away
  behind its own choice); a choice on one gone is said. One held by its fate is no swing's, spell's or shaft's (its
  poison, its drain, its training and a Wabbajack all landed). The execution is the player's blow (Renown past the
  assist window) and takes the soul (the trap and Azura's Star). A flyer kneels on the ground and its pile lies there.
  The executed hand their pack to the pile once. Underground, a foe gone with no body (fled, executed, sworn) is saved
  bodiless (`noBody`) - a load laid its corpse, its pack lootable - and a same-dungeon load ends a judgement in flight.
  The dungeon's hover says "beaten".
- **The sworn.** Past the slots (a load standing the save's crew beside the mirror's sworn) the most lately sworn steps
  away. A rest never reads longer than a rest (an older save's clock). A spared one's companion waits for its portal
  (two of it stood for the oath's length). A fall, a sending-away, a release and a load end its member, and the spells
  it wore with it. Opposite acts in one pause cancel their words; a load forgets the words owed.
- **The UI.** Enter on a focused button is that button's; the window fits a phone (the rows had collapsed under the
  confirm) and brings the confirm into view; the judgement opens in beast form; the Classic box keys short with its
  details wrapped and a refused choice saying why; an armed Release never outlives the visit; Execute and Release are
  edged in blood; the rows are cards, not presses; the trophy has its item card on the hover; the companion's bar is the
  green it wears overhead, with its numbers.
- **The burn and the portals.** The frame's reset sends the zero (the last burning flat's share stayed live in GL under
  every flat after it - a dungeon's lone execution could take every flat away); no elite rim round a body dissolving;
  the burst's red flash on the hit flash's own clock; a body more gone than whole casts no shadow; the lane's edge
  decoded into its linear light; the portal's sound by its ID; the leave hand-offs wait for the foe loop (a splice under
  it skipped a foe for a frame).

## 17. Memory: the ledger of wounds (FEUD RVN1, 2026-10-04)

Mac: "I want to improve the revenant system to be more complex, less easy to accomplish and more detailed" - the arc is
`bible/12-Enhanced-AI/Feud-Arc.md` (Part B). A body that may become (or already is) a revenant (`revenantCandidate`)
keeps a **ledger** while the player fights it (`systems/feudLedger.js`, a leaf on `entity._feud`): what the player
dealt by weapon class (`blade`, `blunt`, `axe`, `h2h`, `arrow`) and element (`fire`, `frost`, `shock`, `poison`,
`magic`), silver apart; the staggers, the blows dodged (perfectly too), the blows at its back, a backstab; whether the
fight began by night, and where (`street`, `building`, `dungeon`). The deed (`revenantDeed`, the one home of the kill
and both escapes) folds it into the record's **scars** - the latest six: its leading source at 40% of the damage or
more, else `mixed`; staggered twice, three blows dodged, three at its back, a night fight, the deed - and counts the
fight. The page says them ("Scarred by arrows, fought by night."). What the scars teach a revenant is RVN2's.


## 18. What it learns: adaptations (FEUD RVN2, 2026-10-04)

At each deed it learns one lesson of the fight - the first of its scars that teaches something it does not hold - and
keeps its rank's worth (three at most), the oldest forgotten (`systems/revenantFeud.js lessonOf`, `withLesson`). What it
learned stands with it (`entity.revenant.edge`, `adaptEdge`): **Mailed**, **Hewn-hard**, **Braced**, **Unflinching** and
**Arrow-wise** take a weapon class less (x0.6 at the least); **Fireproof**, **Rimebound**, **Grounded**, **Venom-blooded**
and **Spell-scarred** +25 on the saving throw against their element (DFU's own Resistant - never immunity); a
**Silver-scarred** one loses its kind's silver double; **Steadfast** a heavier poise and one blow in two iron; **Patient**
longer tracking, more feints, wider wind-ups; **Watchful** never unaware (no backstab); **Arrow-wise** faster at range
and closing with its charge or leap; **Relentless** faster and never culled while it hunts; **Night-stalker** comes only
by night, its blows heavier. Nothing touches its weakness. The page lists what it learned. The law and every number:
`bible/12-Enhanced-AI/Feud-Arc.md` section 13 and its RVN2 record.

## 19. Its weakness and its will (FEUD RVN3, 2026-10-04)

Each revenant hides one weakness, drawn on its id from its kind's pool (an element, a metal, a weapon class, or the
daylight). A blow of it lands x1.5 (an element's at -50 on the saving throw; the daylight's x1.25 on every blow while the
sky reads day), weighs twice on a wind-up, and no adaptation takes from it. The first blow of it reveals it - the
"Weakness" word, a hiss, its card - and under half its health, unknown, it flinches from it (a hint). From rank 3 its
will must be broken in the fight: strike its weakness, or stagger it twice (since FEUD BALANCE, section 34: stagger it
once, or dodge one of its blows perfectly). Unbroken at the killing blow it does not
kneel - it tears away into the smoke, an escape that ranks it up. A Disintegrate kills it outright. The page says its
weakness as known and the will's rule. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 14 and its RVN3 record.

## 20. The last stand (FEUD RVN4, 2026-10-04)

From rank 3, once a fight, the blow that would kneel or kill a revenant brings it back instead - to 35%, 45% or 55% of
its health by rank (since FEUD BALANCE, section 34: 30%, 35% or 40%) - roaring: for 1.2 seconds no blow reaches it, and (Enhanced AI on) an iron ring about its feet lands
as the roar ends; with the switch off it stands and roars. Then phase two for the rest of the fight: heavier and quicker
blows, more Speed, shorter wind-ups and cooldowns, chains of three, iron one in two, an ember rim and a tenth more size.
A Disintegrate still kills. The page names it from rank 3. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 15 and its
RVN4 record.

## 21. Signature blows (FEUD RVN5, 2026-10-04)

From rank 2 a revenant has one signature, drawn on its id: a blade a slam or a charge, a beast a charge or a leap, a
brute a ring or a charge; a caster, a spectral, a small kind or a flyer the **pyre** - a disc at your feet that lands as
a blast of its element (an atronach's and an imp's fire, a lich's frost, vermin's poison, a harpy's shock, any other's
magic), a spell your saving throw and resistances answer. Twice its blow, its own cooldown of 12 to 18 seconds, iron
from rank 3, drawn in its ember, its wind-up's bark deeper, and called out the first time a fight it winds it up
("Grushnak readies Skullsplitter!"). It is named "<given>'s <noun>"; the page shows it from rank 2, and says "(with
Enhanced AI)" with that switch off - the signature is a telegraph, and only the Enhanced AI throws one. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 16 and its RVN5 record.

## 22. The band (FEUD RVN6, 2026-10-04)

From rank 2 a returning revenant brings its kin - one at rank 2, two at rank 3, three from rank 4 - drawn on its id and
kept on its record: an orc's orcs, the dead their own, a beast its own kind, a person its class's family (a solitary
kind - a giant, a daedra, a lich - rides alone). They stand beside it, ordinary (never a champion, an elite or a
revenant), never fight each other, and are named for it ("Orc of Grushnak's Warband"). When it kneels, runs, dies, is
executed or tears away they scatter - each runs and is gone ("The warband scatters."). At a rank-5 one's last stand its
survivors run to it, or two of its kin step out of a portal. The page lists who rides with it. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 17 and its RVN6 record.

## 23. The hunt (FEUD RVN7, 2026-10-04 - in parts)

**Its lair (RVN7a).** A revenant that wins a fight in the open world, or escapes one, goes to ground in a named
dungeon four to ten map pixels from where it happened - the one nearest a direction drawn on its id, the dungeons the
town boards' bounties use. With none in reach it roams. A deed underground makes that dungeon its lair, and a lair
moved is one the player must hear of again. The page says what the player knows of it.

**The rumour (RVN7b).** Ask a townsperson for news within twenty map pixels of a living revenant's lair, or in its
lair's region, and one time in three or so the answer is of it - its kind, its name, its lair, how far and which way -
spending that person's one answer, and the player then knows its lair. One rumour in two carries its weakness, hinted by
its kind or, one time in three, named.

**The map and the journal (RVN7c).** A lair heard of is a blood-red circle with its name on the travel maps, and a hunt
in the quest log ("Hunt: Grushnak the Butcher" - the way there from where the player stands). Abandoning the hunt
forgets the lair until it is heard of again.

**The lair stand (RVN7d).** Enter its lair while it lives, unsworn, and is due or its lair known, and it is there - at
the dungeon's far end, resting with its band (a first blow may be a backstab), its gold a quarter richer. Rest in its
lair while it is due and it wakes you, standing over you. Any rest underground may be a due revenant's return. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 18 and its RVN7a-d records.

## 24. What it takes (FEUD RVN8, 2026-10-04)

Online, a revenant that kills the player takes one piece at the respawn - the equipped weapon or one of the pack's five
most valuable pieces, never a quest item, a summoned piece, the Materials Bag, gold or a locked piece; three at most,
after which it only gloats. The wake box says what it took. It carries what it took at every stand: kill it and it is in
the body, execute it and it is in the pile, spare it and it hands it back ("It's yours. It always was."); let it escape
and it keeps it. A revenant holding a piece is never forgotten to make room. The law: `bible/12-Enhanced-AI/Feud-Arc.md`
section 19 and its RVN8 record.

## 25. Festering (FEUD RVN9, 2026-10-04)

A revenant left alone grows angry. Three days past the day it was due, and every three days after, it gains a wrath -
a tenth more health and a twentieth more force a wrath when it next stands, and facing it clears them. At three wraths
it ranks up on its own ("Grushnak grows bolder - it has waited too long."), never past rank 5. Days are the character's
own: online the clock stands while the player is away, so nothing festers between sessions. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 20 and its RVN9 record.

## 26. Felled and routed (FEUD RVN10, 2026-10-05)

Two new deeds. **Felled**: a special foe whose blow knocks out a companion - a sworn revenant or a crew hand ashore -
becomes a revenant (or ranks up) on the spot, the companion's name on its deed and often in its title ("Grushnak,
Bane of Borgakh"), its card saying so. **Routed**: a special foe on me that hurt me in the last 30 s, when I get 70 m
from it or a Recall or a teleport takes me out of its fight, after a hurt in that fight left me under half my health -
it is gone, a revenant (or a stronger one) that has learned to be Relentless ("Who Made Ayla Run"). Never after my
death, never by a load. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 21 and its RVN10 record.

## 27. Loyalty (FEUD RVN11a, 2026-10-05)

A sworn revenant's loyalty (0-100) starts by its personality and moves with how it is kept: up for a fight won at the
player's side, each day with the player and being called back after a rest; down for each day sent away, being knocked
out, being sent away twice in a day, and seeing one of its own kind executed. The Companions page shows it as a bar and a
word - Devoted, Loyal, Wavering or Restless. A Devoted one strikes harder and calls a warning when a foe winds up behind
the player ("Behind you, Ayla!"). The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 22 and its RVN11a record.

## 28. Desertion (FEUD RVN11b, 2026-10-05)

A sworn revenant whose loyalty falls under 20 may leave - one day in seven or so. It goes through its portal, a living
revenant again under its own rank, now called the Oathbreaker, and comes back within three days to fight. It keeps the
more valuable half of what was in its pack (killing, executing or sparing it again returns it) and leaves the rest, and
any gold, to the player. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 22.2 and its RVN11b record.

## 29. Betrayal (FEUD RVN11c, 2026-10-05)

An Unhinged, Craven or Brutal sworn revenant whose loyalty falls under 10 may turn on the player: when a blow leaves the
player under a quarter of their health, it turns where it stands - stronger by a rank, now called the Betrayer - and
fights. What it carried it keeps as a deserter does (kill it to take it back); the rest falls to the player. The others
never betray; they desert. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 22.3 and its RVN11c record.

## 30. Its words (FEUD RVN12a, 2026-10-05)

Every revenant now has words, in its own voice, for what FEUD gave it: what it learned of the player's fighting ("I know
your arrows now"), its signature blow by name, its last stand, the piece it took, its long wait, the companion it felled
("Where's Borgakh, Ayla?"), the player's flight, and - sworn - its desertion, its betrayal and a Devoted one's warning.
Its return speaks to its newest deed against the player. Beasts never speak: the narrator says what they do. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 23 and its RVN12a record.

## 31. The page and the card (FEUD RVN12b, 2026-10-05)

The Revenants page (Holdings) now shows, for each living revenant, what it learned as chips - each saying what it does
to the player - what it took, and how far it has festered (three pips), beside its weakness, will, last stand,
signature, band and lair; a sworn one's loyalty; and a fallen one that once tore away unbroken says so in its deeds. Its
cards wear FEUD's edges: a last stand blood with an ember rim, a signature iron red, a theft amber, a betrayal black.
The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 24 and its RVN12b record.

## 32. Online (FEUD RVN13, 2026-10-05)

A revenant's adaptations, its weakness and its last stand now ride the foe stream (relay world164), so another player
fighting your revenant hits it as you would - its learned resistances and its weakness count on their blows too - and
sees its last stand's ember rim; a follower is named for its band on every screen. A party member's blow of its weakness
reveals that weakness to you. What it took, its festering, its lair, the rumours and a sworn one's loyalty stay your
character's own. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 25 and its RVN13 record.

## 33. The audit (FEUD AUDIT FEUD, 2026-10-05)

Everything FEUD gave the revenants was read again whole and corrected: a party member's blow of your revenant's
weakness now really reveals it to you; a piece it took is named properly ("your Glenmoril Bow", never "your The
Glenmoril Bow") and no line says "your arrows is"; a deserter or betrayer that comes back speaks of its leaving, not of
what it did before it served you. A reload no longer loses a betrayer's pack, strands what it held on a record that has
since fallen, or counts festering and loyalty days twice; a deserter never rides off with a locked piece or a quest item;
a Resurrect or a load leaves no killer waiting to take something at a later death. A felling no longer mends a will you
broke, nor wipes the "it killed you" card; a kneeling or vanishing foe fells and routs nobody; a companion knocked out
cannot betray you; a foe that walked off is no fight won; a dungeon band breaks when its master runs; no lair lands on
the Burning Court or the Arena's sand. The duel harness now fights revenants too, and measures the arc's three balance
targets for them. The law: `bible/12-Enhanced-AI/Feud-Arc.md`, the AUDIT FEUD record.

## 34. The balance (FEUD BALANCE, 2026-10-05)

Measured against the arc's own targets, three of Mac's numbers were changed by Mac's call: a revenant's will (rank 3
and up) now breaks with its weakness, ONE stagger, or ONE perfect dodge of its blow - two staggers came about one fight
in nine, so a player who fought well rarely saw it kneel; its last stand rises to 30 / 35 / 40% of its health at ranks
3 / 4 / 5 (from 35 / 45 / 55%), so a rank 5 is about two and a half to three times a rank 1's fight, not more; and
dodging is promised what it really buys - the will, and the blows not taken - rather than a faster kill. Measured: a
player who dodges perfectly makes a rank-3 kneel nine fights in ten; one who only trades blows, about one in seven. The
law: `bible/12-Enhanced-AI/Feud-Arc.md` section 31's OPEN 22-24 and the FEUD BALANCE record.

## 35. The second audit (FEUD AUDIT FEUD 2, 2026-10-05)

The audit and the balance read again: a leap or a charge stopped short against a wall no longer counts as your perfect
dodge (and breaks no will); reloading an older save no longer bleeds into a newer one, nor loses a companion's pack
whose leaving has scrolled out of its history, nor a piece a since-forgotten revenant held; a revenant in its last stand
keeps its fury when it fells your companion; "It hands back your Glenmoril Bow"; online, only a party member's blow that
landed reveals a weakness (a miss did), and you no longer see a stray "Weakness" for theirs; a Recall no longer turns
another player's dungeon foe into your revenant; no lair in the Ocean Holes. The balance was measured again with the
duel harness made faithful to the game - every target holds: a perfect dodger makes a rank-3 kneel 19 fights in 20, a
trader about one in eight, and a rank 5 is about two and two-thirds times a rank 1's fight. The law:
`bible/12-Enhanced-AI/Feud-Arc.md`, the AUDIT FEUD 2 record.

## 36. Its blows online (FEUD WIRE, 2026-10-05)

A revenant now strikes the party members fighting it as hard as it strikes you: its rank's, its wrath's and a
Night-stalker's night blows, its last stand's fury, and its signature blow at double weight, in its ember with its deeper
wind-up sound - before, another player's copy of it hit with its kind's plain blows and a plain shape. Its called name
for the signature, and its pyre, stay yours alone. Relay world165. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section
25 and the FEUD WIRE record.

## 37. Its band and its flight, measured (FEUD HARNESS, 2026-10-05)

The arc's balance tool now fights a revenant as the game gives it - its band about it, and its chance to run - and every
balance target still holds: a perfect dodger makes a rank-3 kneel about nine fights in ten, a trader about one in nine,
and a rank 5 is about two and two-thirds times a rank 1's fight. Modelling the flight found a fault: a revenant that rose
in its last stand while running away kept running, untargeted, until its run was spent - it now turns and fights its
last stand where it rose. The law: `bible/12-Enhanced-AI/Feud-Arc.md`, the FEUD HARNESS record.

