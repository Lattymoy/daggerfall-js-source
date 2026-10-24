# Revenants

**Status:** shipped 2026-10-02 (`src/systems/revenant/revenant.js`, `test/systems/revenant.test.js`).
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
Online, under **Renown 10**, a character's revenants are held (RENOWN-GATE, section 39): none is made, flees or returns.
**UNQUIET** (section 46): only a special foe carrying **the mark** (one in four - "Unquiet Elite Orc") rises, none while
three hunt the player, and a marked foe breaks at 35% on three rolls in four. The table below is the law as it began.

Two deeds make one:

| Deed | How | Seam |
|---|---|---|
| **Slew** | Its blow takes the player's last health (melee or an arrow) | The struck seam marks the attacker (`combat/formulas.js`), the damage door takes the mark, the hurt tells `registerPlayerBlowLanded` (`systems/sigil/sigilSetPowers.js`). Confirmed a microtask later, after `hurtPlayer` is done, so a death Stendarr's mercy (`setAvoidDeathHook`) undoes makes no revenant. |
| **Fled** | Under 20% of its health for the first time (35% for a revenant of rank 1 or 2), it wins a roll (5%; 80% for a revenant of rank 1 or 2, 15% from rank 3, where its will takes over - FLIGHT-FIRST, section 38) and runs, at twice its walk. Out of reach before its run ends, it has escaped. | `scenes/exteriorFoes.js` update: `revenantFleeHealth` and `rollRevenantFlee`, then `ai.flee(playerFeet, 8 s)` (`characters/enemy/enemyMotor.js`). While fleeing it does nothing else. At the end of its run or 45 m off, `escapeFoe` removes it with no corpse and no kill. |

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
nothing. A foe chased down, its run spent within 12 m (`REVENANT_ESCAPE_NEAR`; 20 m until FLIGHT-FIRST), is **cornered**: it turns and fights to
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
- On a due revenant, an open-world encounter roll (`scenes/world.js runEncounterTick`) stands it instead, 40% of the
  rolls (50% until RENOWN-GATE, section 39). Only one is out at a time, the highest rank first. This happens before the
  party's group-roll gate: a revenant is the player's own. Online, under Renown 10, no roll stands one (section 39).
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
`kills + escapes + returns`; a loyalty its personality's start). The law is `systems/revenant/revenantFeud.js feudFields`
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

`systems/revenant/revenantVoice.js` (a leaf) hands an event to the registered face, or speaks its line through the host's `say`.

The face is `ui/revenant/revenantCard.js`, on the enhanced skin only:

- **Placement and lifetime**: the notices' twin at the LEFT edge, sliding in and out. One card per revenant, two at most. The words are typed at 42 letters a second, then held 3.5 to 7.5 s.
- **Colours**: a blood edge for a taunt or a rise, amber for a flight or an escape, brass for a fall (the portrait grey and struck through).
- **Drawing**: drawn on drawHud's one call, behind the HUD's hide gate (hidden, its clock stops) and its hide door. The DISC29-D watchdog hides it when a host stops drawing. HUD-MOVE moves it (`'revenant'`, with a preview).
- **Plus dressing**: the kit dresses it by role: panel and accent edge, the portrait a well, the rank a chip, the name a header rule. Stone gets brighter words, as the stats card does.
- **Accessibility**: a screen reader gets the whole line at once; reduced motion types and slides nothing.
- **Classic skin**: the presenter declines and the line is said, as before.

## 7b. The page (REVENANT-PAGE)

`ui/revenant/revenantPage.js` is the **Revenants** page on the Enhanced pause menu's Holdings tab (the Stats rail until HOLDINGS,
2026-10-03), shown while revenants are made or any is remembered. The living come first, strongest first, each with:

- its portrait and rank;
- what it is;
- what it has done to you ("Killed you twice, escaped you once");
- when it will come (*Hunting*, *Biding*: "in about 2 days", or *Abroad*);
- its last deeds.

Then the **Fallen**, struck through, with when each fell. A character with none is told how one is made.

## 8. The numbers

Every number is a named constant at the top of `systems/revenant/revenant.js`:

| Constant | Value |
|---|---|
| `REVENANT_MIN_LEVEL` | 3 |
| `REVENANT_MIN_RENOWN` | 10 (online - RENOWN-GATE, section 39) |
| `REVENANT_MAX` | 3 (UNQUIET, section 46: none rises while three hunt the player; it was 5) |
| `REVENANT_MAX_RANK` | 5 |
| `REVENANT_FLEE_HEALTH` / `_YOUNG` | 0.2 / 0.35 (FLIGHT-FIRST: under the will's rank; UNQUIET: a marked foe too) |
| `REVENANT_FLEE_CHANCE` / `_YOUNG` / `_REVENANT` | 0.75 (a marked foe - UNQUIET; it was 0.05) / 0.8 (rank 1) / 0.35 (rank 2 and up - the will's rank, UNQUIET; it was 0.15 from rank 3) |
| `REVENANT_FLEE_SECONDS` | 8 |
| `REVENANT_FLEE_PACE` | 2 (its run, a share of its walk - FLIGHT-FIRST) |
| `REVENANT_ESCAPE_NEAR` | 12 (20 until FLIGHT-FIRST) |
| `REVENANT_ESCAPE_DISTANCE` | 45 |
| `REVENANT_RETURN_MIN/MAX_MINUTES` | 2880 / 5760 (UNQUIET; it was 1440 / 4320 - vengeance 1440 / 2880, section 46) |
| `REVENANT_RETURN_CHANCE` | 0.4 (0.5 until RENOWN-GATE) |
| `REVENANT_LOST_MINUTES` | 360 |
| `REVENANT_HEALTH_PER_RANK` | 0.4 (UNQUIET; it was 0.25 - a sworn one keeps 0.25) |
| `REVENANT_DAMAGE_PER_RANK` | 0.15 (UNQUIET; it was 0.1 - a sworn one keeps 0.1) |
| `REVENANT_LEVEL_PER_RANK` | 3 (UNQUIET; it was 2) |
| `REVENANT_TAUNT_DISTANCE` | 25 |
| `REVENANT_LOOT` | see section 4 |
| UNQUIET's own | `revenantUnquiet.js` and `unquietMark.js` - section 46 |

## 9. Every host

The streaming world (`scenes/world.js`) and the single-location host (`scenes/exterior.js`) both:

- stand a due revenant on an open-world roll;
- read its presence;
- tell the player of a kill once alive again.

The open world's pool (`scenes/exteriorFoes.js`) and the dungeon (`scenes/dungeonContext.js`) both run a fleeing foe
and close a slain one. Returns stay in the open world: a dungeon's foes are its layout's.

## 10. Who it is (REVENANT-VOICE)

Mac: "They should have their own unique personalities that affect their speach. One could be humorous, or witty, etc."
`systems/revenant/revenantPersonality.js` (a leaf) holds ten personalities and every word they say:

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
  since RVN-OWNERS-CHOICE, section 15, no one else's whole blow is a kill, and since RVN-OWN-KNEEL, section 15, nor is the
  player's own Disintegrate - it passes the last stand and the will and kneels it here)
  leaves it at 1 health on its knees (`systems/revenant/revenantFate.js beginYield`): its fight and its run over, its hurt's
  last frame held with a breath now and then (`MobileUnit.heldPose`), no blow reaches it, no foe hunts it
  (`enemyTargets.js`), never in the save. Its plea is said in its voice; its record notes the deed. Its
  TROPHY is rolled now, so the choice shows it.
- **The choice** is the loot window's: activating it (at the treasure's reach, as a body - `mobileEnemyActivate.js`)
  opens the window with its FATE side (`ui/enhanced/enhancedInventory.js` + `ui/revenant/revenantFateView.js`): the loot frame's own head
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

The trophy (`systems/revenant/revenantTrophy.js`):

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
  It fights as a crew companion does, the foe fighting the player's side first (ASSIST, `01-Overview/bugs/Field-Bugs-2026-10-05c.md`).
- **The crew's own layer** (`scenes/crewAshore.js`) stands the sworn - every place, every door, the heel, the catch-up,
  health and spells carried - as a second party of the crew's shape (`systems/revenant/revenantCompanions.js revenantParty`), never
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
- **In the open zone (COMPANION-DROP, FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in
  zone")**: the one at my side there - `swornAtYourSide`, the first walking with me as the record lists it, the one the
  zone stands (PVPDUNGEONS; the rest wait outside the zone) - carries its pack and its kit at stake with mine: a death
  there drops them as it drops my bag (`11-Multiplayer/Wild-Zone.md` section 4,
  `wildDropLaw.js:"export function wildPacks"`). So it is never sent away nor on an errand from my side there
  (`revenantCompanions.js:"export const leaveRefusal = (r) =>"` - the roster says it, and the slots' hold sends
  another), nothing of mine is given as kit to one waiting outside the zone, and knocked out there it hands me its pack
  and its kit before it goes, said once (`revenantCompanions.js:"function leftWithYou(r)"`; one carrying nothing hands
  nothing and says nothing - AUDIT FB1019f B4): nothing it carries leaves the zone but at my side.

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

**REVENANT-HEIR** (Discord, 2026-10-07: "I got them to Elite Level V and I thought they'd kneel but they just keeled
over and died"): a revenant is never handed over at all. The handovers (the owner's death, a door out, OW6's walk-away;
underground, a joiner's own frame) name an heir for every other live foe and none for one carrying a revenant
(`exteriorFoes.js foesFrame`, `dungeonContext.js ownFrame`). Its record lives in its owner's save alone
(`revenantById`), so an heir's copy read a plain foe: no last stand, no will, no kneel, a corpse, and the owner's record
never told. It goes with its owner, as a watchman goes with his own. A party member's killing blow lands at the owner,
where the record is, and brings its last stand and then its fate there (`test/systems/revenant/revenant_fate.test.js`).

**RVN-OWNERS-CHOICE** (FIELD BUGS 2026-10-16b; Discord, "I erased a Revenant fro[m]...": "I believe it bypasses the
kill/spare on revenants. And it seems it does this to other players' revenants, too ... It probably shouldn't be doable
to other peoples revs"): **another player's revenant can never be closed by anyone but its owner.** A whole blow - a
Disintegrate, Mehrunes' Razor's whole-health strike, a stat drained to zero (the doors' `_whole`) - passes over a
revenant's last stand, its will and its kneel only when it is the OWNER's own: the player's blow at the door that holds
the record (`systems/revenant/revenantFate.js ownersWholeKill`; both damage doors, `exteriorFoes.js damageFoe` and
`dungeonContext.js damageFoe`). A party member's Disintegrate on my revenant reaches me as a kill (`z`, AUDIT PSCALE1
DOORS-1) and lands at my door as a PEER's blow: it is a killing blow like any - rank 3 and up its last stand, its will
unbroken it tears away, else it kneels - and the kill-or-spare is mine; no `slain` goes back, its record stays open. So
is a foe's whole blow, a companion's, and a stat drained to zero, whose tick names nobody (AUDIT 68's provenance): the
choice is offered, not taken. (The drain's tick returns every 0.2 s while the stat stays at zero, so at rank 3 and up the
first tick makes the last stand and the next tears it away unless its will is broken - it escapes, to come again; the
owner's own Disintegrate or a broken will still closes that fight. The audit of the branch, 2026-10-16.) My own
Disintegrate and my own Razor still kill outright, as sections 19 and 20 say (until RVN-OWN-KNEEL, below).
DEPARTURE from sections 11, 19 and 20 as written ("a Disintegrate kills it outright" - whosever it was): the rule they
recorded is the owner's alone now. Pinned by `test/systems/revenant/fb1016b_rvnownerschoice.test.js`.

**RVN-OWN-KNEEL** (FIELD BUGS 2026-10-17g; Discord #general, Dude7ox: "Disintegrate just outright kills your rev with no
option to hire"; the owner: "Hmm thought I fixed this"): **no blow skips the kill-or-spare.** The owner's own whole blow
- a Disintegrate, the Razor's whole-health strike - still passes over the last stand and the will, the Disintegrate's
edge (sections 19, 20), and then kneels it like any killing blow: alive at 1, its record open, Kill or Spare offered
(both doors' yield gate asks `revenantFate.js ownersWholeKill` of the will alone). A host that cannot open the choice
(`exterior.js`, no `fates`) lets it die as before. DEPARTURE from RVN-OWNERS-CHOICE's "my own Disintegrate and my own
Razor still kill outright" and from sections 19 and 20 as written. Pinned by
`test/systems/revenant/fb1017g_rvnownkneel.test.js`; the record, `01-Overview/bugs/Field-Bugs-2026-10-17g.md`.

## 16. The audit (2026-10-02, Mac: "Audit everything and ensure perfection")

Five audits - the records and their words, the kill-or-spare flow, the sworn, the UI, the burn and the portals - and
every finding fixed (`test/systems/revenant/revenant_audit.test.js`, `tools/mutants/revenantaudit.json`):

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
keeps its rank's worth (three at most), the oldest forgotten (`systems/revenant/revenantFeud.js lessonOf`, `withLesson`). What it
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
kneel - it tears away into the smoke, an escape that ranks it up. A Disintegrate - its owner's own - passes its will
and kneels it (RVN-OWN-KNEEL, section 15; until 2026-10-17 it killed it outright; RVN-OWNERS-CHOICE: anyone else's is a
killing blow like any). The page says its
weakness as known and the will's rule. The law: `bible/12-Enhanced-AI/Feud-Arc.md` section 14 and its RVN3 record.

## 20. The last stand (FEUD RVN4, 2026-10-04)

From rank 3, once a fight, the blow that would kneel or kill a revenant brings it back instead - to 35%, 45% or 55% of
its health by rank (since FEUD BALANCE, section 34: 30%, 35% or 40%) - roaring: for 1.2 seconds no blow reaches it, and (Enhanced AI on) an iron ring about its feet lands
as the roar ends; with the switch off it stands and roars. Then phase two for the rest of the fight: heavier and quicker
blows, more Speed, shorter wind-ups and cooldowns, chains of three, iron one in two, an ember rim and a tenth more size.
A Disintegrate - its owner's own - passes the last stand and kneels it (RVN-OWN-KNEEL, section 15; until 2026-10-17 it
killed it). The page names it from rank 3. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 15 and its RVN4 record.

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
town boards' bounties use - only one the player can go down into (LAIR-DOOR, FIELD BUGS 2026-10-22d: 28 graveyards
place no door). With none in reach it roams. A deed underground makes that dungeon its lair, and a lair a deed moves is
one the player must hear of again. A lair already held in a place nobody can enter moves to the enterable dungeon
nearest it within twenty map pixels, and stays known as it was. The page says what the player knows of it.

**The rumour (RVN7b).** Ask a townsperson for news within twenty map pixels of a living revenant's lair, or in its
lair's region, and one time in three or so the answer is of it - its kind, its name, its lair, how far and which way -
spending that person's one answer, and the player then knows its lair. One rumour in two carries its weakness, hinted by
its kind or, one time in three, named.

**The map and the journal (RVN7c).** A lair heard of is a blood-red circle with its name on the travel maps, and a hunt
in the quest log ("Hunt: Grushnak the Butcher" - the way there from where the player stands). Abandoning the hunt
forgets the lair until it is heard of again.

**The lair stand (RVN7d).** Enter its lair while it lives, unsworn, and is due or its lair known, and it is there - at
the dungeon's far end (LAIR-REACH and LAIR-WALK, 2026-10-19: the farthest a walk from the way in reaches on the
dungeon's navmesh - with no navmesh (the Enhanced AI off offline, a bake that failed) or nothing on its floor, the
farthest interior marker - never a border cap's pocket, where it once stood out of every player's reach; LAIR-HOME: and there even
when the road had stood it a moment before, unless that body is in a fight with you or kneels for your judgement - one
revenant, one body, the body it left withdrawn; `01-Overview/bugs/Field-Bugs-2026-10-19.md`), resting with its band (a first blow may be a backstab), its gold a quarter richer. Rest in its
lair while it is due and it wakes you, standing over you. Any rest underground may be a due revenant's return. The law:
`bible/12-Enhanced-AI/Feud-Arc.md` section 18 and its RVN7a-d records.

## 24. What it takes (FEUD RVN8, 2026-10-04)

Online, a revenant that kills the player takes one piece at the respawn - the equipped weapon or one of the pack's five
most valuable pieces, never a quest item, a summoned piece, the Materials Bag, gold or a locked piece; three at most,
after which it only gloats. The wake box says what it took. It carries what it took at every stand: kill it and it is in
the body, execute it and it is in the pile, spare it and it hands it back ("It's yours. It always was."); let it escape
and it keeps it. A revenant holding a piece is never forgotten to make room. The law: `bible/12-Enhanced-AI/Feud-Arc.md`
section 19 and its RVN8 record.

LETTERS-HOME (FIELD BUGS 2026-10-18b, `01-Overview/bugs/Field-Bugs-2026-10-18b.md`): a LETTER OF CREDIT is gold, and
it never takes one. "Gold" was read as the coin alone, so a letter - worth hundreds of thousands, by far the pack's most
valuable piece - was in every draw. A letter one took before is the player's again at the next load; a deserter's
letter comes back with its gold.

STEED-KEPT (FIELD BUGS 2026-10-19f, a player's private report - their horse gone after a death in a dungeon; the owner,
2026-10-19: "Exclude, and return taken ones"): it never takes what never changes hands, as the open zone's death reads
it - a horse or a cart (owning one is having it in the pack), a deed (Daggerfall's, and a ship's deed or her packed
parts) or the spellbook (`revenant.js:"export const revenantMayTake = (item) =>"`); a bound piece stays its own (AUDIT
625 W2). A stable's horse beside a worn longsword was drawn one death in six. One it took before comes home to the pack
at the next load, from the save's own copy, and is said once ("Grushnak the Butcher could not keep your Horse. It is
back in your pack."); a deserter's ship's deed comes back with the rest. The law: `12-Enhanced-AI/Feud-Arc.md` section 19.

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


## 38. Flight first (FLIGHT-FIRST, 2026-10-07)

Mac: "revenants often can easily be killed and recruited at rank 1 and player death advances their rank. Player death
shouldnt be the common way of revenant growth, it should be more common for revenants to flee instead of being easily
captured."

**Measured before** (`tools/tellDuel.mjs`, a Longsword, 300 fights a rank): ranks 1 and 2 knelt in every fight. One in
ten broke and ran, and every one of those was brought down as it ran - not one flight in the whole measure escaped, at
any rank. So the one deed that ranked a young revenant up was killing the player. Three causes:

- **Its roll**: 15% for a revenant already, at a fifth of its health - and one blow often carried it past the line
  without a roll at all.
- **Its run**: the flee walked it at its own walk (4.5-6 m/s), and a player runs at 8.1 m/s at Speed and Running 50. A
  chase always caught it.
- **A fault in the motor**: the flee kept the brain's last step (TACT2's ring, a back-step - `_tacDir`), and the walk
  reads that step before its own way, so a foe that broke while circling ran on round the ring at the ring's pace, in
  reach. Half of all flights ran that way.

**Now**:

- A revenant **under its will's rank** (ranks 1 and 2 - `revenantFeud.js WILL_RANK`; from rank 3 its will tears it away
  at the killing blow, section 19) breaks at **35%** of its health (`REVENANT_FLEE_HEALTH_YOUNG`) on an **80%** roll
  (`REVENANT_FLEE_CHANCE_YOUNG`). An elite or a champion not yet a revenant keeps Mac's "very small chance" (5% at a
  fifth); a revenant from rank 3, 15% at a fifth.
- Every run of the flee law is at **twice its walk** (`REVENANT_FLEE_PACE`; the motor's `flee(from, seconds, pace)` -
  the watch's fright and a scattered band still walk). An Orc runs 10 m/s: faster than a player at Speed and Running 50,
  slower than one at about 9.5 m/s and up.
- The flee **drops the brain's step**: it runs straight away.
- A run spent within **12 m** of the player (`REVENANT_ESCAPE_NEAR`, 20 before) is cornered; past it, it escaped. A
  run's lead on a chaser at Speed and Running 50 is about 17 m - a flight that got away, not one run down.

**Measured after** (the same, 1,000 fights a rank): rank 1 escapes in 70% of fights and kneels in 30%, rank 2 68% and
32%; against a Dagger about 80% escape, against a Warhammer about 60% (150 fights a rank). A fast runner (Speed and Running 90) runs every flight down;
a bow or a spell can bring it down as it runs. From rank 3 about one fight in eight now ends in a real flight.

**The balance targets** (`12-Enhanced-AI/Feud-Arc.md` section 28) all hold. The will's three now read the fights its
will decided - knelt of knelt and torn away; a flight that got away decided nothing - and a rank's weight is read off
ranks 1 and 5 fought never running (a young revenant's flight ends most of its fights, so its time to the end is no
measure of how hard it is to bring down): the will by its weakness 100%, by dodging 93.1%, by trading 11.5%; rank 5
over rank 1, 2.67 trading and 2.64 dodging.

Killing the player still ranks a revenant up; it is no longer nearly the only way. Pinned: `test/systems/revenant/flightfirst.test.js`
(6), `tools/mutants/flightfirst.json` (15 dead). PIN MOVED: `test/systems/revenant/feudharness.test.js` - its flight and rank 5's
rally chase as a fast runner, and a rank 3 run down is cornered (its last stand comes before a kneel mid-run);
`test/scenes/audittell.test.js` - the flee's signature.

## 39. The Renown gate (RENOWN-GATE, 2026-10-12)

The owner: "I want to gate elite/revenant spawns behind renown level and also slighty reduce the spawn rate of
revnants". Asked, the owner chose elites at Renown 5 and revenants at 10 ("Elites 5, revenants 10"), offline "Unchanged
offline", a shared dungeon's elites "Room's pick stands", and the rate "Return chance 50% → 40%".

**The door.** Renown is online's own (`Accounts-And-Cloud-Saves-Arc.md` RENOWN1: offline earns none), so the gate is
too. `systems/sigil/sigil.js renownOpens(min)` sits beside the door every Renown-woken power reads (the sigils', the sets',
RENOWN-LOOT's): offline it is always open; online it opens once the page's Renown reaches `min`, and never before the
page knows it (the moments before the first token) - RENOWN-LOOT's first-stage law, nothing ahead of the Renown behind
it. `scenes/world.js` sets the door; `scenes/exterior.js`, the offline bench, never does.

**Elites at Renown 5** (`eliteFoes.js ELITE_FOE_MIN_RENOWN`, `eliteRenownOpen`). The elites a player stands as its
own wait for it: the open world's one in twenty (`rollOverworldElite` - a street puppet reads its owner's word off
`z`) and a search's waking dead (`searchables.js rollSearchElite`). Each draws its roll first, so the dice are the
same held or not. A save's word on a foe stands whatever the Renown (it is never re-rolled), and a returning revenant
stands as what it was. Not a shared dungeon's pick (`pickDungeonElites`: a normal dungeon's one in five, an Elite
Dungeon's three or four, a Super dungeon's six). Every client builds that pick alike, and the room's memory carries no
elite word (`net/wire.js validSharedFoe`; adding one is a relay deploy), so one client's Renown would split the room:
a joiner's copy would take the host's x5 health off the record, with no glow and x1 blows. It stays the room's, as
ELITE-FLOOR's class level does online (`05-Combat/Balance-Arc.md` section 10). The arena's tier champions are their
bout's.

**Revenants at Renown 10** (`revenant.js REVENANT_MIN_RENOWN`, `revenantHeld`) - an evening's play past the
elites', so a returning elite always finds elites standing. Under it a character's revenants are HELD, and every door
that makes, stands, spreads or marks one answers as the Loot rarity row's off does:

- none is made, runs or keeps a fight's ledger (`revenantCandidate`) - a flight that could make no revenant would only
  rob the player of a kill;
- none returns on an encounter roll or a rest, none is at home in its lair, and none is claimed (`revenantToReturn`,
  `revenantForLair`); a sworn one at the edge of betrayal stays sworn (`revenantBetrays`: its turning stands a hostile
  revenant beside the player);
- the towns say nothing of one, the person's answer unspent (`revenantRumor`); the maps mark no lair and the log holds
  no hunt (`revenantMapMarks`, `revenantHuntEntries`);
- none festers (RVN9, section 25): one that cannot come is not left unfought, and its held days pass uncounted, so the
  gate's opening catches none up.

What is remembered stays. The page lists every one, each **Held** - "It will not come for you before Renown 10." - with
its lair named but promised on no map and by no town, and with none it says revenants come from Renown 10
(`ui/revenant/revenantPage.js` comeWords, lairWords). The sworn keep their days: loyalty moves and a desertion leaves, as it
stands nothing (a deserter's return is held like any).

**The rate.** A due revenant takes 40% of the encounter rolls (`REVENANT_RETURN_CHANCE`, 0.5 before) - a fifth fewer
returns, online and offline alike.

**Offline nothing is held**: elites stand as BAL4 has them, and revenants are made, flee and come as before - at the
new rate.

**The four hosts** (rule 17e). Every gate is read inside the shared laws, so no host carries one of its own (a sweep of
`src/scenes/` pins it):

- `scenes/world.js` WIRED: its wilds' roll (the `exteriorFoes.js` pool), its graveyards' searches, its returns,
  rumors, marks and hunts, all through the laws; it sets the door.
- `scenes/dungeonContext.js` WIRED: a search's elite, a lair's stand, a rest's return and a flight, through the laws;
  its layout pick the room's, untouched (the owner's choice).
- `scenes/worldModes.js` WIRED for its dungeon mode (the same context). FLAGGED for its buildings: they roll no elite
  (the one factory's `inLocation` defaults to a location's ground) and stand no return, and its arena stages' tier
  champions are their bout's - nothing to gate.
- `scenes/exterior.js` WIRED through `revenantToReturn`; its pool rolls no elite (a town's ground, as a building's),
  and the bench never goes online, so nothing is held there.

Pinned: `test/systems/renowngate.test.js` (14); `tools/mutants/renowngate.json` (30, all dead). No pin moved; two AUDIT BAL
records (`tools/mutants/bal.json` AUDIT-BAL-a-search-elite-anywhere and AUDIT-BAL-the-search-roll-skipped) were re-aimed
by content at the search's roll as it now reads, and both still die.

## 40. Its kit (RVN-GEAR, 2026-10-17)

The owner: "So I want to enhance the revenant system ... Add gear slots to revnants and the ability to customize with gear
(Must be balanced)".

A sworn revenant wears what the player gives it. `systems/revenant/revenantGear.js` is the law; the acts are
`revenantCompanions.js` (`giveSwornGear`, `takeSwornGear`, `giftablePieces`); the record keeps it as
`companion.gear` (a slot's key to the item).

- **Ten slots**: a weapon, a shield, a helm, two pauldrons, a cuirass, gauntlets, greaves, boots and a charm. A piece goes
  to the slot its own equip slot names (`gearKeyOf`); a charm is any piece of jewellery the player could wear (a wand is
  none - AUDIT RVN G2).
- **Who wears what is DFU's table** (`armedKind`, `combat/enemyEquipment.js equipmentVariantFor` - ItemHelper's own): the
  classes, the orcs and the centaur take a weapon and armour. Every kind takes a charm ("A bear wears it on a cord").
- **A melee weapon**, Dagger to War Axe. A foe's archery is its kind's flags (`enemyMotor.js hasBowAttack`), never its
  weapon, so a bow would only be swung.
- **Balanced by rank**. A sworn one bears what its rank has earned:

| Rank | Metal (`GEAR.METAL_CAP`) | Tier (`GEAR.RARITY_CAP`) |
|---|---|---|
| I | up to Silver | Magic |
| II | up to Dwarven | Rare |
| III | up to Adamantium | Rare |
| IV | up to Orcish | Legendary |
| V | up to Daedric | Legendary |

  A piece past it is refused, saying the rank that bears it whole, whichever cap binds (`gearRankNeeded` - "It must rise
  to Rank V to bear Daedric.", "It must rise to Rank IV to bear a Legendary piece of Mithril."). An artifact, an Aetheric
  or a Gilded piece answers to the player alone. A broken piece, a quest item or a summoned one is never given.
- **A shield wants a one-handed weapon given with it, and whole** (a rolled two-hander would hold it off; a broken blade
  holds nothing), and a two-hander is refused while a shield is worn. Taking back its weapon brings its shield back too.
- **It wears** (AUDIT RVN G7): a given piece is the record's own object on the body, and DFU's `damageEquipment` wears it
  down as any wearer's. A piece worn to nothing comes off (DFU's ItemBreaks; `equip.js lowerCondition` takes a broken
  blade out of a foe's hand as well - DFU's EnemyAttack reads the right hand's slot) and is worn by nobody until the
  player takes it back and has it mended. The page says each piece's condition and marks a broken one.
- **Its lines, not its spells** (AUDIT RVN G12): a piece's rarity lines fold; what DFU casts on a wearer's equipping (Cast
  When Held, a curse's drawbacks) and a Legendary's player-only powers stay the player's - DFU's own foes wear their kit
  the same way.
- **Worn over its own** (DEPARTURE from ItemHelper.AssignEnemyStartingEquipment for a sworn one; Port-Ledger A, RVN-GEAR):
  its stand still rolls its kit as DFU does, and every slot the player filled takes the player's piece in place of the
  rolled one, at every stand (`applySwornGear`, called by `applySwornStrength`). A two-hander frees the left hand. Its
  armour is then read again by DFU's own pass over what it wears (`enemyArmorValues`: the class clamp at 60, a monster's
  own hide where it is better), and its pieces' rarity lines fold as a wearer's do (`systems/entityMods.js
  computeEntityMods`). With nothing given, its stand is DFU's, untouched. A gift is worn at once by a body standing here;
  a piece taken back comes off it by identity (AUDIT RVN G4 - wherever the body holds that piece, never a rolled one in
  its place); it fights on with what is left until its next stand rolls its own again.
- **Its kit is inventory, as its pack is**: the save's copy says what it wears (`revenant.js ensureMirror` - the mirror
  never brings back a piece given after the save, nor loses one the save holds), the realm's walks count it - the save's
  item lists customs and the load's repairs read (`net/realm/realmGoldLaw.js stashedItemLists`, AUDIT RVN G10: customs
  itself moves gold and letters, never a piece) and the realm's own (`systems/item/possessedItems.js`) - a release hands
  it back with its pack, and a deserter or a betrayer weighs it with its pack (`splitPack` - it keeps the more valuable
  half). Abroad, its kit goes with it: nothing is given or taken back (AUDIT RVN F10). COMPANION-DROP (FIELD BUGS
  2026-10-19f, section 13): in the open zone the kit of the one at my side drops with my bag at a death there, as its pack
  does - DECIDED there, named: its pieces are mine, given from the pack and taken back at will, worn by it and never by me,
  so my own worn law is not theirs - and nothing of mine is given to one waiting outside the zone.
- **Its weight abroad** (`gearPower`, section 42): a twentieth of a point a piece worn, and its tier's share more (Magic
  0.1, Rare 0.2, Legendary 0.35), at most two (AUDIT RVN G8 - ten Common pieces weighed what three Legendaries did).
- **The page**: the Companions page's **Gear** opens a sheet under its card - a well a slot it may fill (a beast's the
  charm alone), what it wears (its condition, or why it is not worn) with **Take back**, and the player's own pieces with
  **Give**: those it can wear first, each slot in order, the dearest first; those it cannot after, refused and saying why;
  twelve at first and the rest a press away (**Show N more** - AUDIT RVN G1). A piece the player wears, a quest's, a
  summoned one or one past Legendary is never offered. The release's confirm counts its kit with its pack.

THE FOUR HOSTS (rule 17e): the gear rides the sworn's one layer - `scenes/world.js`'s companion layer (`crewAshore.js`),
which stands them in the street, in buildings (`scenes/worldModes.js`) and underground (`scenes/dungeonContext.js`) through
`applySwornStrength`; no host line. `scenes/exterior.js` (the bench) stands no sworn one - FLAGGED, as REVENANT-COMPANION is.

Pinned: `test/systems/revenant/rvngear.test.js` (11); `tools/mutants/rvngear.json` (all dead - section 43).

## 41. Its art (RVN-ARTS, 2026-10-17)

The owner: "Give revenants the chance to have unique telegraphed abilities, magic abilities like healing or other buffs,
etc (Must be balanced)".

One revenant in three (`ARTS_CHANCE`, 0.35) is born with an **art**, drawn on its id from its family's pool
(`revenantFeud.js signatureFamily`), so it is the same on every read, every load and every client. An older record has the
one its id draws. The law is `systems/revenant/revenantArts.js`. Every art has two halves: what it does to the player while
it hunts them, and what it does for them once it is sworn.

| Pool | Arts |
|---|---|
| A blade (people, orcs, the armed dead) | Ward, War Cry, Siphon, Mending |
| A beast | War Cry, Mending, Nova |
| A brute | War Cry, Nova, Ward |
| The casters and the rest (the pyre's kinds) | Mending, Ward, Barrage, Siphon, Nova |

**Hunting the player** (from Rank II, `ART_RANK`, the signature's; the Enhanced AI switch on - an art is a telegraph):

- **The ground's language**: a disc in an art's colour about **its own** feet says it is **channelling** - strike it. A mark
  at or about **the player's** feet says **move**. The colours are never a blow's ember or iron red.
- **Mending**: under half its health, once a fight, a 2 s channel; whole, it heals a fifth of its health.
- **Ward**: under three quarters, once a fight, a 1.5 s channel; whole, for 10 s every blow class is taken at x0.65 (never
  past an adaptation's own lower figure, and never its weakness - section 19's law).
- **War Cry**: as it joins the fight (in sight, within 20 m), once, a 1 s roar; whole, it and its band strike x1.2 for 12 s.
- **Any harm that lands on it while it channels breaks the channel** - a blow, a spell, a poison's round, since the last
  frame (a heal between never hides a blow - AUDIT RVN B10): its disc shatters, "Grushnak's Mending is broken!", and the
  art is spent for the fight. The disc goes where its feet go (AUDIT RVN B9).
- **Siphon**: a lane at the player (the charge's shape); caught, a blast of magic at the pyre's weight, and it drinks what
  the blast took from the player - at most the pyre's mean, nothing from a blast saved, resisted, absorbed or turned back.
- **Barrage**: three discs at the player's feet, 0.45 s apart, each aimed as it is cast; each caught, a blast of its
  element at x0.6.
- **Nova**: a ring where it stands as it casts (the ring's shape: safe at its heart, for the one who backs off); caught, a
  blast of its element at x1.2.
- The thrown three come 14 to 20 s apart, the first 3 to 6 s into the fight. Each is a spell through the host's own door
  (`strikePlayer`, the pyre's), so the player's saving throw and resistances answer it, its magnitude its multiple of the
  pyre's mean exactly (`artSpell` - AUDIT RVN B3: the pyre's own spell rounded a level's x0.6 up to x1, so a barrage's
  three outweighed the signature). A Siphon or a Nova, and a barrage's three together, are lighter than the signature's
  x2 at every level (at level 30: 34.5, 41.4 and 63 against 69).
- **Its marks lie on the ground they mark** (`foeBlows.js fitBlowToGround` - AUDIT RVN B1, the brain's AUDIT TACT D8): a
  stair's, a hill's.
- **One wind-up near the player at a time** (TACT4's law) holds for arts too: an art waits on any wind-up near the player,
  and while one is live no foe winds another. Its marks are drawn by the ground's own pass, as a wind-up's are
  (`ai/foeBlows.js liveBlows`, its own key kept fresh while its foe lives).
- It is called out once a stand (its card: "Grushnak calls on its Mending! Strike it to break the spell!").
- Never from one running, kneeling, judged, roaring or scattering, nor another client's puppet; never from one that
  cannot act (paralysed, held - the motor's CanAct, AUDIT RVN B2), one silenced (every art but the cry, which is no spell),
  nor one at peace with the player (AUDIT RVN B11). A live art is cut when it can throw no more, and at the next frame of a
  foe the pool stopped stepping (`BLOW_STALE` - AUDIT RVN B4: never landed late, unseen). The open world's pool steps it
  before a run's or a scatter's own frame, so a running one's ward and cry run out on time.
- Owner-side, as the pyre is: a peer fighting the player's revenant sees its marks only in the owner's game (FEUD WIRE
  carries none), and its ward and its cry are the owner's game's alone - the wire's `rb` carries its blows' standing
  weight, never a cry's.

**Sworn, for the player** (any rank; no switch - none is a telegraph):

| Art | When | What |
|---|---|---|
| Mending | a hurt leaves the player under 40% | heals 12% + 2% a rank of the player's health; every 120 s, and the side once in 60 s however many mend (section 45 S7) |
| Ward | it goes into a fight | a Shield (Alteration's, 35/255) of 6 + 3 a rank, 6 rounds; every 90 s |
| War Cry | it goes into a fight | Fortify Strength (9/0) 4 + 2 a rank, 6 rounds; every 90 s |
| Siphon | in a fight | its foe struck at the pyre's weight (the player's level), a quarter of it to the player (a third until section 45 S7) |
| Barrage | in a fight | its foe struck at x1.5 |
| Nova | in a fight | every hostile foe within 5 m of it struck at x0.8 |

The three strikes come 16 to 22 s apart, the first 3 to 6 s into the fight, each x(0.5 + 0.1 a rank) - rank V the whole
(`SWORN_STRIKE.RANK`, AUDIT RVN E8). They land through the scene's door (`systems/playerDoor.js hurtFoe`), so they are the
player's own harm: only a foe that harm may reach (never a town's defender), hostile, never an ally of the player's (a
summon at their side, a foe their tongue has calmed - AUDIT RVN B5), within 12 m (`SWORN_STRIKE.REACH`) and in sight (the
door's `clear` - AUDIT RVN B7); the foe struck may turn on the player, and its kill is the player's (renown, a set's "each
kill" powers), as every power the door lands. Mending answers the player's hurt (`registerPlayerHurtListener('sworn-mending')`),
and only from one whose body stands here. A Ward's and a War Cry's words are said ("Grushnak wards you." - AUDIT RVN B6:
a local named `t` threw them away).

**The words**: the Revenants page and the Companions page say what its art does - to the player while it hunts ("from Rank
II", "with Enhanced AI" where they apply), for the player once sworn (`artWords`).

THE FOUR HOSTS (rule 17e): the hostile half is stepped by both pools beside the signature - `scenes/exteriorFoes.js`
(`artFrame`; the pool `scenes/world.js`, `scenes/worldModes.js`'s buildings and `scenes/exterior.js` each create, each with
its `strikePlayer`) WIRED, and `scenes/dungeonContext.js` WIRED for a foe of the player's alone (REVENANT-DUNGEON's gate:
offline, or past the room's shared run). The sworn half rides `swornFightStep`, the companion layer's frame
(`scenes/world.js` alone stands the sworn; `scenes/exterior.js` FLAGGED, as section 40).

Pinned: `test/systems/revenant/rvnarts.test.js` (18); `tools/mutants/rvnarts.json` (all dead - section 43).

## 42. Abroad (RVN-ERRAND, 2026-10-17)

The owner: "Add the ability to send revnants off on timed missions to anywhere within tamriel (They disappear and come back
brining rewards like loot, crafting materials, currency, etc)".

From the Companions page a sworn revenant (with the player, or waiting) is sent on an **errand** to one of Tamriel's nine
provinces (`world/tamriel/tamrielGeography.js PROVINCES`; a city of it named, drawn on the errand's seed). It goes for a
**venture**:

- **Plunder**: loot first.
- **Forage**: crafting materials first.
- **Sell-sword**: gold first.

It leaves through its portal (the layer reads the party), is gone the place's days, and comes back at the party's frame
(`revenantParty().wake`). **Online it keeps the world's time** (OFFLINE-ROAD, FIELD BUGS 2026-10-21,
`01-Overview/bugs/Field-Bugs-2026-10-21.md` - `errandOnWorld`, `chargeErrands`): its `due` is the world's minute it is
back (`worldTick.js worldMinutes`, the event clock, which runs on the wall whoever plays), so time away carries it on and a
day abroad is two real hours, played or not. A rest, a Loiter or a journey raises the character's own clock alone
(`worldTick.js raisedMinutes`), never the world's, so a raise still carries it on not a minute - AUDIT RVN F1's faucet
(QCLOCK-WORLD's law, `quest/clock.js chargeSeconds`, "the lived step, never the raise": a raise that paid was a faucet the
world pays for, Lived-Time.md - measured, a road journey's x100 raised 906k of wealth an hour at level 30 against the
band's 200k) stays shut. Until the relay's clock is heard (`trustedWorldMinutes`) the lived step carries it as AUDIT RVN F1
built it (`errandStep`: a raise pushes every errand's minute back by as much, and a step past `ERRAND.STEP_MAX` - 30
minutes, a quest clock's played step - by the rest); an errand sent then takes its minutes left onto the world's clock at
the first trusted wake, from its minute charged by that wake's lived step (AUDIT FB1021 L3-2: a raise across the first
trusted wake was paid on it). The world's minute an errand reads is held to the time this session lived (AUDIT FB1021
L3-1, `errandWorldMinute`): the client's world clock is the machine's clock plus the relay's offset, read once a welcome,
so a machine clock set forward mid-session moved it and returned every errand at once (fourteen returns for ten +8 h
moves, where the lived step held each wake to its thirty minutes); each primary welcome marks the world's minute with
`performance.now()` (`worldTick.js hearSharedClock`), and a wake reads no more than that minute plus the monotonic time
since at the wire's rate, plus a minute. A load hears the relay again, so time away still counts. Offline the one clock
carries it, DFU's own. Online the page says so, and its times left are real minutes and hours at the wire's rate (AUDIT
FB1021 L3-5: "back in about 24 hours" was two real hours, and the sky clock passes 48 in them). The law is
`systems/revenant/revenantErrands.js`; the acts are `revenantCompanions.js` (`sendOnErrand`, `recallFromErrand`,
`returnFromErrand`).

| Place | Days | Danger | Its goods |
|---|---|---|---|
| High Rock | 1 | I | oak, iron, steel, wool, bear hide, jade |
| Hammerfell | 1 | II | copper, sulphur, amber, scorpion hide, linen, gold |
| Imperial Province | 2 | II | silver, gold, silk, cherry, emerald, steel |
| Skyrim | 2 | III | iron, orichalcum ore, bear and tiger hide, pine, sapphire |
| Valenwood | 2 | III | spider hide, heartwood, venom, bat hide, resin, jade |
| Sumurset Isle | 3 | III | moonstone ore and ingot, pearl, malachite, silk, mithril |
| Elsweyr | 3 | III | silk, amber, tiger hide, gold, turquoise, tooth |
| Morrowind | 3 | IV | ebony ore, dwarven ore and ingot, dreugh hide, diamond, silk |
| Black Marsh | 4 | V | slaughterfish hide, venom, stinger, resin, ghostwood, pearl |

**Its odds** (`errandOdds`): 0.55 + 0.1 for each point of its strength over the danger. Its strength is its rank plus its
kit (section 40). The odds stay within 0.3 to 0.95, and a Devoted one gets 0.05 more. The page shows Good, Fair or Grim
odds with the share.

- **Won**: it comes back with the whole haul, waiting to be called, and 4 more loyal - once an errand (`paid`, its seed:
  AUDIT RVN F7 - a reload of a save made abroad brings the haul back again, never the loyalty).
- **Hard-won**: it comes back with half (a lone piece kept) and hurt, resting for a rest's length (8 hours) - worn from the
  road, so no RVN11 call bonus after it (`worn` - AUDIT RVN F6: a hard road out-paid a won one, +10 against +4).
- **Never lost**: an errand is no way to lose a companion. Abroad, no day's desertion is rolled (AUDIT RVN F9); RVN11b's
  roll waits for it, and its loyalty stands while it is gone.

**The haul** (`errandHaul`) is drawn on the errand's own seed when it comes back, so one seed is always one haul:

- **Gold**: the player's level x the days x 10-18, x(1 + 0.25 a danger past the first), x(1 + 0.1 a rank past the first),
  x the venture's lean (Sell-sword 1, Plunder 0.4, Forage 0.15). A Black Marsh Sell-sword errand at level 30 and rank V
  brings about 5,000 - about one revenant's own drop at that level and rank (section 4: level x rank x 15-40).
- **Goods**: (3 + 2 a danger) x the days units of the place's goods, the cheaper more often, x the lean (Forage 1, Plunder
  0.35, Sell-sword none); at most one a day of tier 5 and up (`UNITS.FINE_TIER`, `FINE_A_DAY` - AUDIT RVN F4: a Morrowind
  forage brought eleven of ebony, diamond and dreugh, past the hunt's and the mine's own bounds), the draws past them the
  cheaper goods.
- **Pieces**: Plunder brings one a day (AUDIT RVN F3 - one and one more for every three of the days and the danger made the
  nearer Hammerfell twice any far shore a day). Forage brings one 20% of the time and Sell-sword 25%. Each is minted as an
  elite's is (`eliteFoes.js tieredGear`) at a tier drawn by the danger and its rank: Legendary 0.5% + 0.4% a danger + 0.3% a
  rank past the first (at most 3.7%, under the loot ladder's own 4.5% - AUDIT RVN F2: it was 13.5%); Rare 6% + 3% a danger
  + 2% a rank; Magic 50%; else Common. With Loot rarity off, all Common.
- **Measured** (lane E's probe, 1,500 seeds a cell, two abroad, rank V and its best kit, on lived time): at level 30 the
  best route brings about 990 gold a real hour (Black Marsh, Sell-sword) or 4,200 of item worth (`itemLaw.itemWorth`) -
  0.5% and 2% of the wealth budget's 200k band (`server-account/src/budget.js`) - and 0.03 Legendaries an hour; at level
  10, 330 gold and 1,400 of worth an hour. Per character (AUDIT FB1021 L3-4): online, since OFFLINE-ROAD, every one of an
  account's realm characters keeps its errands on the world's clock while another is played, so an account of six
  (`realm.js REALM_CHARACTERS_MAX`) may have twelve abroad - six times the hour at most, still 3% and 12% of the band.

It is handed over at its return: gold to the purse, pieces to the pack, goods to the Materials Bag (then the pack, any
overflow forced in - `materialsBag.js giveCarried`; units minted on the client are loose, as a find's are -
`Materials-Bag.md`; an unsaved return is drawn again from the save, so none is lost). Its words: as it leaves, its own
("Off I go...", "It sets out for Solitude, in Skyrim - back in about 2 days."), and as it comes back ("Back from Skyrim with
412 gold, 6 Orichalcum Ore and a piece of gear." - the Materials Bag's own names, counted: AUDIT RVN D5). Both are said at
the party's next frame, never under the menu, on its card (a Mission's sky edge, a Returned's green - AUDIT RVN D7; the
return in no portal's voice: it waits away) or the line every skin draws (`notify.js popupMessage`). The provinces' names
are the player's language's (`PLACE_NAMES` - AUDIT RVN D6).

**The bounds**:

- At most **two abroad** at once (`ERRAND.MAX`).
- Not while it recovers.
- Abroad, it cannot be called ("Abroad - back in about 23 hours.") or released, and its kit went with it.
- **Recall** (asked first, as a release is - AUDIT RVN D9) brings it back at once, empty-handed and worn from the road:
  resting a rest's length (AUDIT RVN F8 - a free recall re-rolled an errand's seed, which a save holds in the clear).
- An errand's day moves no loyalty (RVN11a's days count only with the player or waiting).

**An errand is the save's**, as its haul will be (`revenant.js ensureMirror`). A save made while it was abroad sends it
abroad again on a reload, to come back on the same minute with the same dice (its odds and the haul's scale read at the
return) - and a record that has since left the player (released after the save) comes back as the save had it, as one
with a pack does (AUDIT RVN F9). One begun since the save was never begun: it is back where the save had it. An older
clock never stretches its days: the wake writes `errandUntil`'s clamp back (AUDIT RVN F5, as `restUntil` does - the
clamp was read and never kept).

THE FOUR HOSTS (rule 17e): an errand is the sworn's record and the companion layer's frame - `scenes/world.js` stands the
layer for its street, `scenes/worldModes.js`'s buildings and `scenes/dungeonContext.js`'s dungeons alike, so an errand
returns wherever the player is; no host line. `scenes/exterior.js` stands no sworn one - FLAGGED, as section 40.

Pinned: `test/systems/revenant/rvnerrand.test.js` (10); `tools/mutants/rvnerrand.json` (all dead - section 43).
OFFLINE-ROAD and its audit: `test/systems/revenant/fb1021_offlineroad.test.js` (8); `tools/mutants/fb1021_offlineroad.json`
(19, all dead).

## 43. AUDIT RVN - the kit, the arts and the errands audited (2026-10-17)

The owner: "Please audit everything and ensure perfection" - sections 40-42 (PR #988), read cold by five lanes on the
frozen branch (DO NOT FIX WHILE THE VERIFIER IS READING held: no edit until every lane had reported): A the kit, B the
arts, C the errands, D the page, the words in 13 languages and the record, E the balance, measured. 60-odd findings, the
same defect often found twice; every one fixed, pinned or decided below. Each lane's probes are kept in its session's
scratchpad, not the tree.

**The blocker (C1, E1) - raised time paid.** An errand ran on `ownMinutes`, and online a rest, a Loiter or a journey
raises that clock (`advanceOwnMinutes`, WALK-CLOCK's x100 on a road). Lane C stood the shared clock still and raised ten
days: twenty errands back, 5,442 gold and 38 pieces at level 30 with no minute lived. Lane E measured 906k of wealth a real
hour on the road (the band is 200k) and 41 Legendaries. The repo's own law already said no (Lived-Time.md: "the
character's clock opens no faucet the world pays for"; QCLOCK-WORLD's quest clock charges "the lived step, never the
raise"). Fixed: section 42's lived step (`errandStep`, `chargeErrands` - a raise and time away push the errand's minute
back; the clock sampled at the send, so a raise before the next wake counts too). The same probe now brings back nothing.

| # | Lane | Finding | Done |
|---|---|---|---|
| F1 | C, E | errands paid on raised time online | the lived step (above) |
| F2 | E | a Legendary 13.5% a piece (rank V, Black Marsh) - 3x the loot ladder's cap, 45x a plain foe's | 0.5% + 0.4% a danger + 0.3% a rank, at most 3.7%; Rare 6/3/2% |
| F3 | C, E | Plunder's pieces `1 + (days + danger) / 3`: Hammerfell two a day, every far shore one | a piece a day |
| F4 | E | a Morrowind forage brought eleven of tier 5-6 (ebony, diamond, dreugh) | at most one a day of tier 5 and up |
| F5 | C, D | `errandUntil`'s clamp was read, never kept - a stretched errand returned days late | the wake writes it back |
| F6 | C | a hard-won rest earned RVN11's +10 call bonus, past a won errand's +4 | `worn`: no bonus after a road's rest |
| F7 | C | each reload of a save made abroad paid +4 loyalty again | `paid`: once an errand's seed |
| F8 | C | a free Recall re-rolled the seed a save holds in the clear | a recall rests a rest's length |
| F9 | C | the daily desertion roll ran abroad; a save abroad over a record released since was lost | no roll abroad; the save's copy restored whole |
| F10 | C, A | the kit could be given or taken abroad, and the odds read the kit at the return | refused abroad (`gearRefusal`, `takeSwornGear`) |
| F11 | C, D | `KICKERS.errand`/`errand_back` unread (the card overrode them), English; `_errandWordsForTests` unused | the kickers through `t()` and read (`revenantMomentEvent`'s `as`); the export gone |
| F12 | C | `deliverHaul` asks no save | decided: an unsaved return is drawn again from the save (the errand is the save's), so nothing is lost or doubled |
| F13 | C | ten behaviours no test pinned (lane C's surviving extra mutants) | pinned where they carry the law (section 42's mutants) |
| G1 | A, D | the Give list cut at twelve, the refused first - a looter's twelve blades hid every helm and charm | wearable first; quest, summoned and past-Legendary pieces never listed; **Show N more** |
| G2 | A | a Wand (jewellery nobody wears) took the charm slot and added to its odds | a charm is jewellery the player could wear |
| G3 | A | a broken given weapon still "held" a shield beside a rolled two-hander | a shield wants a whole one-handed weapon |
| G4 | A | a take-back cleared slots by key (a rolled blade stripped; the taken blade still swung); a broken blade swung on and broke at every blow | by identity; `equip.js lowerCondition` takes a broken blade out of a foe's hand (DFU's EnemyAttack reads the right hand) |
| G5 | A, D | a refusal named too low a rank for a piece over both caps | `gearRankNeeded`'s rank; both caps said |
| G6 | A, D | the Release confirm counted the pack, not the kit | both counted |
| G7 | D | given kit wears out and breaks; neither page nor doc said so | its condition and a broken mark on the page; section 40 |
| G8 | E | `gearPower` saturated on junk: ten Common pieces weighed what three Legendaries did | 0.05 a piece, tiers 0.1/0.2/0.35 |
| G9 | A | the kit-only restore, the gift's refit of a live body, `sanitizeGear`'s template test, the charm's take-back unpinned | pinned |
| G10 | A | "customs counts its kit": customs moves gold and letters; the line feeds the save's item lists | the words corrected; the detached list is latent (no splice reaches it), noted |
| G11 | A, D | `METAL_NAMES` unused, a dead guard, a misplaced import comment | removed, moved |
| G12 | A | a piece's equip-time spells and a Legendary's player-only powers never reach a sworn one, yet its tier counted | decided: DFU's own foes wear their kit the same way (section 40); G8's weights |
| B1 | B | art marks never fitted to the ground - on a hill the telegraph hid while the blast landed | `fitBlowToGround`, as the brain's own |
| B2 | B | a paralysed revenant healed and threw; a silenced one cast | the motor's CanAct; silence holds every art but the cry |
| B3 | B, E | `pyreSpell` rounded a level's x0.6 up to x1: a barrage's three outweighed the signature (99 against 69 at level 30) | `artSpell` - the magnitude whole at the level; pinned on the spells the door casts |
| B4 | B | the street's pool skipped a running revenant's art frame: its ward and cry ran on, its marks stood, a lane landed unseen when it was cornered | the call before the run's exits; a foe not stepped past `BLOW_STALE` has its marks cut |
| B5 | B | a sworn Nova struck foes at peace and the player's own summons (turning them) | hostile foes alone, never an ally or itself |
| B6 | B, D, E | `const t = rec.ai?.target` shadowed `t()`: a sworn Ward's and War Cry's words threw, swallowed | renamed; the words pinned |
| B7 | B | sworn strikes reached through walls and at any range, as the player's own harm | 12 m and the door's `clear`; the player's harm documented (section 41) |
| B8 | B | a ward wrote its old edge onto a stamp made since | the edge back on the stamp it warded alone |
| B9 | B | a channel's disc stayed where it was cast; the Nova's words said "its feet" | the disc follows its feet; the ring "where it stands" |
| B10 | B | a heal mid-channel hid a blow; the siphon drank its mean from a blast saved or turned back | broken by any harm since the last frame; it drinks what it took |
| B11 | B | no hostility gate; online ward and cry unsaid | gated; documented owner-side |
| B12 | B, D | `isArt` unused; `forgetSwornArt(id)` never called; `SWORN_GIFT_SECONDS` read by its test alone; `ART` in the ledger; a door built per foe per frame | removed; called at a release; the ledger corrected; the door made once a stand |
| B13 | B | tests that passed for the wrong reason (the words never checked, "lighter" on constants, a frame no pool reaches) | rewritten; the arts' tests step the pool's frames as a pool does |
| E8 | E | sworn strikes ignored its rank | x(0.5 + 0.1 a rank), rank V the whole |
| D4 | D | the branch conflicted with main - no CI | main merged |
| D5 | D | the haul's goods named apart from the Materials Bag, unpluralised | the bag's own `materialCountLabel` |
| D6 | D | the provinces' names never translated | `PLACE_NAMES` through `t()`, each language's Elder Scrolls form |
| D7 | D | the new cards had no edge; the return spoke in a portal's voice | their edges (`rvn12b`'s loop); the return in no voice |
| D9 | D | Recall forfeited a haul on one press; no focus keys | asked first; `data-focus` keys on the sheets' buttons |
| D11-D16 | D | "48 hours" for two days; `ART` traces; numbers typed, not read; a refusal said twice; no `aria-expanded`; "never lost" in the notes | each corrected |
| T1 | the run | `rvn11c_betray.test.js`'s "through the real hurt" failed about one run in three: its sworn ones' ids are the deeds' random ones, and a Mender among them healed the hurt the betrayal reads (a whole local `test:changed` run caught it; CI's run on the same head had passed by luck) | its helper draws no Mender - the interplay is the game's (a Mender's heal keeps a player over the line), and section 41's own tests pin it |

**The measure after** (lane E's probe on the audited law, two abroad, rank V and its best kit, on lived time): at level
30, at most about 990 gold or 4,200 of item worth a real hour (0.5% and 2% of the band), 0.03 Legendaries an hour; at
level 10, 330 gold and 1,400 of worth. **Left open, said plainly**: offline a rest still carries an errand on (DFU's one
clock; `raisedMinutes` counts nothing offline) - its pieces reach the realm only through customs, which charges the
budget.

THE FOUR HOSTS (rule 17e): unchanged from sections 40-42 - the exterior pool's art call moved within
`scenes/exteriorFoes.js` (`scenes/world.js`, `scenes/worldModes.js` and `scenes/exterior.js` each create it), WIRED;
`scenes/dungeonContext.js`'s one line WIRED (its door made once a stand); no host grew.

Pinned: `test/systems/revenant/rvngear.test.js` (11), `rvnarts.test.js` (18), `rvnerrand.test.js` (10), and
`rvn12b_page.test.js`'s card edges; `tools/mutants/rvngear.json` (47), `rvnarts.json` (64), `rvnerrand.json` (61) - 172,
all dead (one more, the siphon's `took > 0` read as `>= 0`, is equivalent - a draught of none adds nothing - and is not
recorded). Two older records named lines this audit moved and were re-aimed at them, each still dead:
`rvn11a.json` RVN11a-wake-unmarked (the rest's end now `c.rested = !c.worn`) and `rvn11b.json` RVN11b-rolled-before-move (the
roll now after the errand's skip).

## 44. Its stars (RVN-STARS, 2026-10-17)

The owner: "So next up, I think we should develop a firnanament style tree for revnants. Just like we did for ships and
characters".

Each sworn revenant grows **a sky of its own** - the Firmament's shape (`06-Systems/Firmament.md`) as CAPTAIN-TREE made it a
sky of its own (`03-World/Naval-Refit.md` CAPTAIN-TREE): a start in the middle, paths of small stars to notables and on to
keystones, a star bought only beside one held. The law is `systems/revenant/revenantStars.js` (pure); the acts are
`revenantCompanions.js` (`setSwornStars`, `swornStarsBook`); the window is `ui/revenantStarsWindow.js`, drawn in the one sky
window (`ui/skyWindow.js`).

**Its level** is earned at the player's side and kept on its oath (`companion.xp`):

- a fight won beside the player (RVN11's win - `swornFightStep`, `swornFightWon`): 5 XP and 1 a level of the foe it fought, to
  level 30 (`RVN_XP`, `rvnXpWon`: 6 to 35);
- an errand come home (section 42): 15 a day of its own road a danger, half for a hard road (`rvnXpErrand`: a Black Marsh
  errand 300, 255 on Far-Walker's road; a High Rock one 15) - once an errand, as its loyalty is (`paid`, the last 16 errands'
  seeds: a reload of a save made abroad brings the haul back again, never the XP), and only while it is under level 10
  (`RVN_XP.ERRAND_LEVEL_MOST` - the road teaches only so much: offline a rest carries an errand on, and its XP was a farm,
  section 45 S11).

It climbs 75 x (L - 1)^1.7 (`rvnXpForLevel`: level 2 at 75, 5 at 792, 10 at 3,142, 15 at 6,660, 20 at 11,193 - the most a
record keeps, `RVN_XP_MOST`) to level 20. **A point a level past the first, and one for each rank past the first** it was
sworn at (`rvnStarPoints`, a whole number): a rank V revenant comes to the oath with four, and has 23 at the top. A level
reached is said, after the words of the errand that brought it ("Grushnak reaches level 2 - a star to set on the Companions
page."). Twenty levels is about 660 fights won at level-12 foes, or 320 at level-30 foes; errands carry it to level 10 and no
further.

**The sky** (`RVN_STARS`, 31 stars, `RVN_STAR_EDGES`): **THE OATH** in the middle, held by every sworn one, and three aspects
about it, ten stars each. Each path runs small stars to a notable and on (but the Rite) to a keystone that gives much and
costs a little. The six notables are joined in a ring (`RVN_STAR_CROSS`), the Grave's two through Awakened Art. 30 stars past
the Oath and 23 points at the top: a revenant chooses.

| Aspect | Path | Small stars | Notable | Keystone |
|---|---|---|---|---|
| **The Blade** (above) - its body | Flesh | +5% health x3 | Iron Sinew +10% health | Deathless: +25% health, -10% damage |
| | Fury | +4% damage x3 | Relentless +8% damage | Bloodrage: +20% damage, -10% health |
| **The Grave** (right) - its art | Power | +5% art strength x3 | Dark Focus +10% | Grave Pact: +15% art strength, -10% health |
| | Rite | its art 5% quicker x3 | Swift Rite 10% quicker | - |
| | (between their notables) | | **Awakened Art**: an art of its kind for one born without | |
| **The Road** (left) - its missions and its oath | Road | +3% odds, +5% haul, +5% haul | Far-Walker: missions 15% shorter, +2% odds | Fortune's Road: +30% haul, a hard road brings back nothing |
| | Oath | loyalty losses 10% smaller, rests 10% shorter, 10% shorter | Oathbound: losses 20% smaller | Undying Vigil: rests 30% shorter, losses 20% smaller, missions 10% longer |

**Holding stars** (`rvnHeldStars`, the door every sky comes in by - CAPTAIN-TREE's `heldStars`): the Oath, known stars once
each, each joined to the Oath through held stars, no more than its points, in an order it could have set them. A star given
back takes with it every star joined to the Oath only through it (`rvnTakesBack` - the ring keeps the rest); the way to one
further is its shortest (`rvnWayTo`: Awakened Art is four from the Oath). Giving back is **free, at any time but abroad** -
CAPTAIN-TREE's law, not the Firmament's silver and gold: the sky is the oath's, kept in the save and the mirror as its
loyalty is (`sanitizeCompanion` reads it back through the law, its level and its rank - a hand-made sky is cut to what it
may hold), and a deserter or a betrayer leaves with no oath and no sky. Every reading of its stars - its stats, Awakened Art -
comes through the same door at its record's points (`rvnStatsOf`, `rvnAwakened`). Set abroad, the oath refuses ("It's away on a
mission. Set its stars when it returns." - `swornStarsRefusal`), as its kit's acts do (AUDIT RVN F10).

**What the stars do** (`rvnStarStats`, each a share, each sum kept within `RVN_STAR_LEAST`..`RVN_STAR_MOST`) is read where
the revenant's own numbers are read:

- **health and damage** (`applySwornStrength`): over its rank's, at its every stand - `maxHealth` and the poise's `healthMult`
  (TELL1) x(1 + health), `damageScale` x(1 + damage). A sky changed strikes with its new damage at once, and its health too:
  `setSwornStars` rescales the whole its oath carries between stands (`maxHealth`, `health` - crewAshore stands every body
  after the first on them) and a body standing here by its health's new share over its old, so a keystone's price is paid
  and a sky stood and given back keeps nothing of it (section 45 S1).
- **its art** (`revenantArts.js swornArtNumbers` - the steps and the page's words read the same): Mending's share, Ward's and
  War Cry's points and its strikes' weight x(1 + art strength); every cooldown x(1 - quicker). **Awakened Art**: one born
  without an art learns one of its family's pool, drawn on its id (`taughtArt` - its own stream, so the same on every read)
  for as long as its sky holds the star (`artOf`), at `ART_LAW.SWORN_TAUGHT` (75%) of a born art's weight; one born with an
  art keeps its own. However many at the side mend, the side mends once in half a Mending's cooldown (`SWORN_MEND.SIDE`),
  and a Siphon gives a quarter of what it draws (section 45 S7). The first strike's wait is no cooldown and the Rite never
  shortens it. A hostile revenant has no oath, so none.
- **abroad** (`revenantErrands.js`), each errand on **the sky it set out with** (`e.sky`, `rvnErrandSky` - its odds, haul,
  road and Fortune's price, kept in the save; a sky set at home after a save made abroad moves none of them - section 45
  S2, S3): odds in its strength (`errandPower` - 0.1 a point), the road off the place's days (`errandMinutes`; the clamp
  holds an errand to its own road, `errandUntil`, so the Vigil's longer road is kept), the haul a share more of the gold and
  the goods - never the pieces, the more goods drawn after the pieces so a star never moves a piece's dice - and a piece and
  a fine good a day of its own road (a part day's by its share, drawn on a stream of its own; S14). Under Fortune's Road a
  hard road brings back nothing (`bold`, S5).
- **its oath**: every loss of loyalty less by its share, the fraction carried on its oath to the next (`rvnLoyaltyMove`,
  `lossCarry` - a fall, a day away, a second sending in a day, its kin executed in its sight; a gain whole; S6), every rest
  shorter (`rvnRestMinutes` - a fall, a hard road, a recall, and the clamp an older clock's rest is held to, S27), and the
  call after a rest less by the same share (a shorter rest is a shorter bonus, S15).

**Balanced, measured** (the whole sky's sums, `test/systems/revenant/rvnstars.test.js`):

- Its body: the Blade's best is +50% health (Deathless's path, -10% damage) or +40% damage (Bloodrage's, -10% health); the
  whole Blade +40% health and +30% damage. A rank's own is +25% health and +10% damage, so rank V stands at +125% and +50%:
  a whole Blade on a rank I revenant (x1.25 x1.4 = x1.75 health) is still under a bare rank V's (x2.25).
- Its art: at most +40% strength and 25% quicker (nine points of the Grave). A rank V Mending heals 30.8% of my health every
  90 s at the most (22% every 120 s bare), only under 40% of my health - about twice the heal a minute, for most of a sky;
  the side mends once in 45 s however many mend, and a taught Mending is 75% of a born one's.
- Abroad: at most +5% odds, 15% shorter roads (Far-Walker; the Vigil 10% longer) and +40% gold and goods. Lane E's probe
  (section 43's: two abroad, rank V, its best kit, on lived time) on the audited law, at level 30: bare 1,004 gold a real
  hour, the Road without Fortune 1,330, with it 1,483 - 0.74% of the wealth band's 200k; item worth 3,928, 4,109 and 3,996;
  Legendaries 0.031, 0.033 and 0.029 an hour; fine goods at most one a day abroad. At level 10, 335 bare and 496 at most.
  Fortune's Road is a choice, not a step: over the Road without it, x1.24 the gold where its odds are 0.95 (rank V, High
  Rock) and x0.59 where they are 0.3 (rank I, Black Marsh).
- Every sum is within `RVN_STAR_LEAST`..`RVN_STAR_MOST` - at the most health 0.5, blows 0.4, art 0.4, quicker 0.25, odds 0.5
  points, haul 0.4, road 0.15, losses 0.5, rest 0.5; at the least health -0.2, blows -0.1, road -0.1, the keystones' prices
  together. Each most is its best path's or its aspect's whole sum exactly: the law's guard for a star a later sky adds.

**The window** (`ui/revenantStarsWindow.js`): "{name}'s Stars", in the one sky window (`ui/skyWindow.js` - CAPTAIN-TREE's
window taken out whole when this second sky came, so the captain's and the revenant's are one home; the Firmament's sheet,
palettes and stars' sizes): the Blade in the battle ring's brass, the Road in the life ring's verdigris, the Grave in a
grave-light violet of its own (a mulberry ink under DFO Grimoire, its tips' names too), the Oath drawn as a bond - a ring and
its three ties. Its level and XP (in the player's own figures), its points left; a star hovered reads its name, aspect and
kind, its stats and what a press would do; pressed, the whole way is set while its points pay (refused, it says why);
right-pressed (or held), taken back with those joined only through it; Accept gives the oath the sky - refused abroad, the
sky stays pending and the window says why. The side panel, under the bar wherever a long name ends it, says what its stars
do, each aspect, and its art: its own, awakened, or what Awakened Art would teach it. The window takes the focus as it opens
and gives it back to the Stars button as it closes; while it stands it is on the overlays' stack, so the QuickDial's key
asks it first, and so do the F5 sheet's own keys (`10-UI/Growth.md` section 6, AUDIT GROWTH LANE4-1) - an unaccepted sky is
never dropped unasked (section 45 S8, S21, S22).

**The doors**: the Companions page (`ui/companionRoster.js`) says each sworn one's level and the stars it has to set ("Level
3 · 2 stars to set", gold while any wait) and gives it **Stars** (none abroad). Its sky is laid over the pause window as the
Firmament was over the Stats page - `ui/firmamentOver.js revenantStarsOver`, the door the Firmament had, built once (`overPage`)
for both (GROWTH3 drew the Firmament in the pause window's Growth tab and its door went; this one stays - the owner, of a
Growth-tab page for it: "Keep it on the companion page", `10-UI/Growth.md` section 1) - from either door that draws the page (`ui/pauseDoor.js`, `ui/charSheetDoor.js`), and the page is put back on
Companions when it closes (`enhancedMenu.js` lands on `at: 'companions'`). Offline and online alike: the sky is the save's.
The mission sheet's days are its own road's ("Black Marsh - 82 hours, danger V").

**HOST-SPLIT**: no host function grew (`hostceiling.test.js`). The fight's XP rides `swornFightWon`, which `world.js` already
calls; the strength, the arts, the errands and the losses are each module's own seam. **Not seen in a live frame**: no
ARENA2 data in the session - the window was exercised through a fake document, its canvas drawing nothing.

Pinned: `test/systems/revenant/rvnstars.test.js` (16); `tools/mutants/rvnstars.json` (99, all dead - section 45). The
captain's stars' window mutants (`captaintree.json` CT-win, re-aimed at `ui/skyWindow.js`) die on both skies' tests.

## 45. AUDIT RVN-STARS - its stars audited (2026-10-17)

The owner: "Do a comprehensive audit on this and ensure perfection" - section 44 (PR #999), read cold by five lanes on the
frozen branch (DO NOT FIX WHILE THE VERIFIER IS READING held: no edit until every lane had reported): A the law and the
record, B the seams (the body, the arts, the errands, the oath), C the window and its doors, D the words in 13 languages, the
comments and the docs, E the balance, measured. 50-odd findings, the same defect often found twice; every one fixed, pinned
or decided below. Each lane's probes are kept in its session's scratchpad, not the tree.

**The worst (S1) - the Blade's health was sticky.** A sworn one's whole rides its oath between stands (crewAshore stands
every body after the first on the carried `maxHealth`, never fresh), and `applySwornStrength` multiplied health only on a
fresh stand. So the Blade's health reached a body once, and stayed: a sky stood with Deathless and then given back for
Bloodrage kept Deathless's +25% under Bloodrage's +20% damage, and no keystone's health price was ever paid. Fixed: a sky
set rescales the carried whole and a standing body by its health's new share over its old; the poise (TELL1's
`healthMult`) is told what a carried stand stands on, once a body.

| # | Lane | Finding | Done |
|---|---|---|---|
| S1 | A, B, D, E | the Blade's health sticky after a sworn one's first stand; a keystone's price never paid; a respec kept it | `setSwornStars` rescales the carried whole and a standing body; the poise told once (`_swornWhole`) |
| S2 | B, D, E | the Vigil's 10% longer road cut back to the place's days by `errandUntil`'s clamp at the first wake | an errand's sky taken as it sets out (`e.sky`); the clamp its own road |
| S3 | A, B | a sky set at home after a save made abroad set the errand's odds and haul at its return | odds, haul and road read from the errand's own sky (`rvnErrandSkyOf` in the save) |
| S4 | A | `paid` held one seed: one more errand between a save made abroad and its return paid its XP and loyalty twice | the last 16 errands' seeds (`PAID_KEEP`) |
| S5 | E | Fortune's Road strictly better than the path without it (+25% haul for -5% odds was never a loss) | +30% haul, a hard road brings back nothing (`bold`): x1.24 to x0.59 by its odds - a choice |
| S6 | E, D | a share of a loss rounded each time: every share under a half did nothing to a day away, and a half made it cost nothing | the fraction carried on its oath (`lossCarry`) |
| S7 | E | Awakened Art and the whole Grave lifted three companions' arts about five times over | a taught art at 75% (`SWORN_TAUGHT`); the side mends once in half a Mending's cooldown (`SWORN_MEND.SIDE`); a Siphon gives a quarter (`SIPHON_HEAL` 1/4) |
| S8 | C | the QuickDial's key on the F5 sheet shut the sheet under the sky and threw away an unaccepted sky unasked | the door on the overlays' stack while it stands, the key asking it first |
| S9 | D | Mending's cooldown in fractional minutes ("every 1.5 minutes") misread in da, nb and pt-BR, a decimal dot | in seconds, as the Ward's and the War Cry's (`rvn.art.sworn.mendingSecs`) |
| S10 | A, D, E | the whole Blade's figures wrong in section 44 and the notes (+30% health; x1.63) | +40% health, +30% damage; x1.75 against x2.25 |
| S11 | B, E | offline a rest carries an errand on (DFU's one clock), so a rest farmed errand XP to the top | errand XP only under level 10 (`RVN_XP.ERRAND_LEVEL_MOST`) |
| S12 | A | XP unbounded: a hand-made 3e9 wrapped past 2^31 at the next win (`\| 0`) | clamped at level 20's XP (`RVN_XP_MOST`), added without `\| 0` |
| S13 | E | the level came fast against CAPTAIN-TREE's pace | 75 x (L - 1)^1.7: level 20 at 11,193 |
| S14 | E | a fine good and a Plunder's piece a day were the place's days, so a shorter road raised them a day | a day of its own road, a part day's by its share on a stream of its own (the first fix rounded, and the probe re-run found Morrowind still at 1.16 fine goods a day) |
| S15 | B | a fall and a call net +6 every four hours on the Oath's path - three times the bare +2 every eight | the call's bonus less by its `rest` share |
| S16 | B | errand XP paid on the place's days, not its road's; a level's words said before the errand's back card | its own road's days; the level's words after the card |
| S17 | A | `rvnStatsOf` read a stored sky past its points; `rvnAwakened` skipped the door; points could be a fraction | both through the door at the record's points; a point whole |
| S18 | A, E | `RVN_STAR_MOST` had no health or blows bound | health 0.5, blows 0.4, and `RVN_STAR_LEAST` (the keystones' prices) |
| S19 | C | under DFO Grimoire a Grave star's tip name was inked the Road's green (`.nm.life`) | the class the life tone's alone; a sky's own tone set over the dress |
| S20 | C | the window opened for an id no longer sworn and offered its rank's points | no oath, no points; the side says why |
| S21 | C | the window never took the focus, and gave none back as it closed | the first enabled button; back to its Stars button (keyboard star picking decided: pointer-first, as the captain's) |
| S22 | C | a long name wrapped the bar, and the side panel stood over it | the side under the bar's foot |
| S23 | D | the Companions rail's label was English, and a level's words name "the Companions page" | through `t()` |
| S24 | D | "the 1 stars after it" | an ICU plural, in both skies |
| S25 | D | XP grouped as en-US in every language | `formatNumber`, in both skies |
| S26 | D | "faster" for a share of time off a rest and a cooldown | "{n} shorter" |
| S27 | B | `restUntil`'s clamp held an older clock's rest to the bare eight hours | to its own starred rest |
| S28 | C, D | comments; "Level 1 · 0 of 0 stars set"; the no-points words; the notes; the Grave's path drawn in the Road's tone; the phone's label; the gold line on a sworn one abroad | each corrected |
| S29 | A | a fight's XP survives a reload through the mirror | decided: time-equivalent - a fight won is a fight won, as its loyalty is |
| S30 | B | a fight's XP is not by its share of the fight; a class foe stands at the player's level | decided: a fight won at its side; bounded by the cap and the slower curve (S13) |
| S31 | E | a rest runs on the character's raised clock online | decided: RVN11's own design - a rest is the character's time |
| S32 | B | the Rite never shortens the first strike's wait | decided: the wait is no cooldown; section 44 says so |

**The measure after**: section 44's numbers, re-measured on the audited law (lane E's probe, the records at level 20 - the
first re-run held its records at their rank's four points, so S17's door cut its Fortune build and the two builds read alike).

THE FOUR HOSTS (rule 17e): unchanged from section 44 - no host function grew (`hostceiling.test.js`).

Pinned: `test/systems/revenant/rvnstars.test.js` (16) and `rvnarts.test.js` (18 - the side's gap, the taught weight, a
Siphon's quarter, the seconds); `tools/mutants/rvnstars.json` (99: section 44's 64 and 35 new), all dead. 39 records named
lines this audit moved and were re-aimed by content, each still dead - 25 of section 44's and 14 older ones
(`revenantaudit.json` 1, `revenantfate.json` 1, `rvn11a.json` 3, `rvnarts.json` 2, `rvnerrand.json` 7); the seven touched
lists, with `captaintree.json`, 419 dead, 0 survived. One record, RVN-STARS-hard-rest-whole, survived the first sweep: S27's clamp in the same wake cut a whole
rest to the starred one, so the pin read the clamp, not the return - the return's rest is now pinned on `returnFromErrand`
itself.

## 46. The Unquiet (UNQUIET, 2026-10-17)

The owner: "With revenants becoming a full fledge game loop. They need to become harder, rarer, revenants need more of a
chance to flee instead of relying on player death, we need to go deeper on the experience and make it something insanely
deep."

Revenants are the port's own system; Daggerfall and DFU have none. The DFU members this section reads are named where it
reads them, and each departure is named there too. The law is `src/systems/revenant/revenantUnquiet.js` (UNQUIET's
numbers and pure laws; the flight's own numbers, `REVENANT_FLEE_*`, stay `revenant.js`'s) and
`src/systems/revenant/unquietMark.js` (the mark, a leaf). `revenant.js` keeps the record, its deeds and its doors.
AUDIT UNQUIET (section 49) corrected this section where the audit found it untrue; each correction is named there.

### 46.1 Rarer - the mark, the cap of three, the days

- **THE MARK.** One special foe in four (`UNQUIET_MARK`, 0.25) is **Unquiet**, and only a marked foe can rise. A
  revenant already is no newcomer and needs no mark. Every other elite and champion dies where it falls, whatever it
  does. The mark is drawn on the foe's voice id (`_voiceId`, `characterId.js mintCharacterId` - the id its name and its
  voice are drawn on) by an FNV hash, so no die moves. It is drawn once, as the foe is made its own (`promoteEliteFoe`
  and `applyChampion` with `own`; never a puppet, whose owner's word stands - the dungeon's builders clear a puppet's,
  each client having drawn its own), and it is kept on the body. Its title says so: "Unquiet Elite Orc", "Unquiet Mighty
  Orc" (`foeTitle.js`). A foe of the open zone or the sand never wears it (`isUnquiet`), though its promotion drew it
  before its tag.
- **THE GATE.** The mark is drawn only with the arc on and not held (the Loot rarity row, RENOWN-GATE), only while fewer
  than three hunt the player (`huntingRevenants` - the Dread is not counted), and only on a foe that could ever rise:
  never the watch, an ally, a band's follower, a zone foe, a bout's fighter, one under level 3, or a revenant. A closed
  gate stores nothing. A mark drawn before the third rose stays: that foe rises only if one of the three is gone by then.
- **THREE AT MOST.** `REVENANT_MAX` is 3 (it was 5). While three hunt the player **none rises** (`revenantCandidate`,
  and the deed asks again of the body itself - `revenantDeed`). It used to bury the weakest, oldest to make room; now
  none is buried and no nemesis is lost to a newcomer. A deserter or a betrayer coming back past the cap still buries the
  weakest, oldest, as before - never one standing, one holding a piece of mine, or the Dread. A kinsman's killer handed
  to an heir (LEGACY6) joins the heir's three past the cap and buries none.
- **THE DAYS.** It comes back in **two to four days** (`REVENANT_RETURN_MIN/MAX_MINUTES`, 2880 / 5760; it was one to
  three). A revenant of vengeance comes sooner (46.6).

### 46.2 Born of flight, ranked by surviving

- **A MARKED FOE BREAKS.** A marked foe breaks at the young line, **35%** of its health, on **one roll in two**
  (`REVENANT_FLEE_CHANCE` 0.5), and runs as a bolt does (`REVENANT_FLEE_PACE_MARKED` 2.5). It was 5% at a fifth, so
  nearly every revenant was born of the player's death. An unmarked one never runs. (AUDIT UNQUIET: it shipped at three
  rolls in four at a revenant's pace, 2 - a runner at Speed and Running 62 cornered every flight, a slow one let three and
  a half times as many be born.) A flight that can no longer make a revenant - the cap filled behind it, the page held -
  turns and fights (`cornered`).
- **THE WILL FROM RANK II.** `revenantFeud.js WILL_RANK` is 2 (it was 3). A rank-I revenant runs as FLIGHT-FIRST made
  it (35% on 80%). From rank II its will takes over: it tears away at the killing blow unless its will is broken
  (section 19), and it runs at a fifth on **35%** (`REVENANT_FLEE_CHANCE_REVENANT`; it was 15%).
- **RANKED BY SURVIVING.** A revenant ranks up each time it survives the fight: **every escape or slip** from the
  choice (the `fled` deed) and every time the **player runs** from it (`routed`). Its will's **tear-away** (a `fled`
  deed too, unbroken) ranks it only **every second time** (`TEAR_RANK` 2, its `tears`), and a kill of the player or a
  companion felled only **every second time** (`BLOOD_RANK` 2, its `blood`). Each count rides the save, and any rank-up
  - by a deed, a festering or a betrayal - spends both. It used to be every deed after the first. The page says when one
  more kill, or one more tear-away, will rank it. (AUDIT UNQUIET: a tear-away ranked it every time, so a player who won
  every fight by trading blows ranked a revenant from rank II at almost every meeting - 44% of such revenants became the
  Dread.)

### 46.3 Harder

Each rank weighs more. Health is **+40%** a rank, blows **+15%**, and a class foe's level **+3** a rank
(`REVENANT_HEALTH_PER_RANK` / `_DAMAGE_` / `_LEVEL_`; they were 0.25, 0.1 and 2). A sworn one keeps the old weight
(`revenantCompanions.js SWORN_HEALTH_PER_RANK` 0.25, `SWORN_DAMAGE_PER_RANK` 0.1): the oath is the player's reward,
already weighed by RVN-STARS (section 44), and the new weight is a foe's alone. With the will from rank II and a flight
that gets away (46.4), a revenant is hard to bring down in more ways than its health.

**Measured** (`tools/tellDuel.mjs --feud`, 150 fights a cell, a Longsword):

- A rank-1 revenant fought never running takes 6.5 s to its end, up from 5.9 s (the same run on the law before UNQUIET).
  A rank-5 one takes 21.0 s, up from 16.1 s.
- Rank 5 over rank 1 is **3.24** trading and **3.22** dodging (it was 2.73 / 2.69). The rank's target band moved with the
  ask, from 2-3 to 2.5-3.5 ("about three times" - `12-Enhanced-AI/Feud-Arc.md` section 28).
- The will's targets hold. By its weakness 100%, by dodging 92.2%, by trading 12.6%. A perfect dodger is struck by none
  of a trader's telegraphed blows, in 97.9% of its time.
- From rank III, about a third of the fights now end in a real flight: 47, 45 and 57 of 150 at ranks III-V (they were
  29, 24 and 24).
- At rank II, a trader's fight ends in a kneel 16% of the time (it was 37%). The rest end in a tear-away or a flight:
  its will holds from rank II.
- AUDIT UNQUIET re-ran it on the audited law: every cell the same, to the hundredth (its changes move no single fight -
  the harness fights a revenant, never a marked foe, and an Orc bolts).

### 46.4 Its flight craft

From rank II (`CRAFT.RANK`) a revenant breaks away **in its own way**, chosen by its kind (`fleeCraftOf`). The page
says which, and how to answer it.

| Craft | Who | What it does | The answer |
|---|---|---|---|
| **Smoke** | any other person (a class foe) | DFU's Chameleon (`chameleonNormal`) on it for two magic rounds (`SMOKE_ROUNDS` - its first round runs as it lands, AssignBundle's), the door's `vanish` puff where it stood, and it runs; lost to sight - the Enhanced skin draws it faint, the classic not at all | a blow still finds it (and the Enhanced skin shows it a moment at one that lands - `combatVisuals.js`'s reveal) |
| **Blink** | a caster, a spirit, a lich, a nymph, an orc shaman, every daedra and atronach (never the imp: under level 3, it never rises) | it stands to its rift at **half its walk** (`BLINK_PACE` 0.5), and **0.8 s** on (`BLINK_DELAY`) the rift opens: its body dissolves in the arcane violet over **600 ms** (`BLINK_MS`), and it is gone - an escape however near | silence it or hold it before the rift opens and it only runs this flight; a blow as it fades closes the rift and it runs on, at a run's pace |
| **Sink** | the walking dead (skeleton, zombie, mummy, vampire) and the spriggan | it stands (`SINK_PACE` 0.05 - the motor's flee takes no pace of none) and goes into the ground over **200 + 1,400 ms** in the earth's tint - an escape however near | a blow as it sinks breaks it: it rises **cornered** and runs no more - its will may still tear it away at the killing blow (from rank II) |
| **Bolt** | everything else (beasts, monsters) | it runs at **2.5 times its walk** (`BOLT_PACE`; every other run is FLIGHT-FIRST's 2) | bring it down from range - and break its will before the killing blow, or it tears away - or be very fast: only a Speed-and-Running-100 runner corners it, measured below |

- **WHERE IT RUNS.** The craft lives inside the one flee law, `revenant.js revenantFleeStep`, which both pools ask
  each frame. `beginCraft` starts it with `start`. `craftStep` answers `gone` (the pool's escape), `broken` (cornered)
  or nothing. While a blink fades or a sink goes under, the distance's verdicts wait. A last stand, a kneel or a
  tear-away mid-flight puts the craft down (`endCraft`, in `revenantFate.js`), and lifts its smoke. The look is the pools'
  own dissolve (`f.portalFx`, as the tear-away's), and the puff is the scene's door (`playerDoor.js fx`, `hostMagic.js` -
  the magic engine's `vanish` technique).
- **ITS CLOCK.** The craft runs on the pool's frame (`dt`, the foe's own - `foeFrameDt`), and its dissolve is drawn on
  the same time. AUDIT UNQUIET: it ran on the wall's, so a pool held still (a window over the game, a hidden tab) let a
  blink or a sink finish unseen.
- **DFU.** The Chameleon is DFU's own effect and kind, run as an AssignBundle runs a bundle. A Normal concealment ends
  at its bearer's own blow (EntityEffectManager.BreakNormalPowerConcealmentEffects, `systems/concealment.js`), and a
  runner strikes none. DEPARTURE: DFU's EnemyMotor flee is a walk away and nothing more. The blink, the sink and the
  bolt are the port's own, on the port's flee (FLIGHT-FIRST).
- **MEASURED** (the flight probe: a rank-3 Orc bolting from 4 m, a chaser holding its line at the player's run speed,
  31 flights each): a runner at Speed and Running 50 (8.1 m/s) lets every flight get away; at 90/90 (10.94 m/s), every
  flight; at 100/100 (11.71 m/s), 28 of 31 are cornered. At 2.6 nobody could catch one, and at 2.3 a 90/90 runner
  cornered most, so 2.5 holds.

### 46.5 Its wounds

The blow that broke it leaves **a wound** on its record (`woundOf`). The class is the ledger's `last`
(`feudLedger.js noteFeudHarm` - the class of the last harm that reached it). A wound is taken at every escape (the
`fled` deed) - never by a kill or by the player's flight, since it was never broken then. It keeps **three**
(`WOUND.MAX`): a fourth pushes the oldest out, and a wound taken again is the newest. Left alone, its oldest heals
(section 48.2). The escape's card says it, as do the tear-away's and the slip's: "It bears the wound you left: Lamed."
(AUDIT UNQUIET: "your mark" read as THE MARK's word.)

| Wound | From | At its stand |
|---|---|---|
| Bled | a blade | 90% health |
| Cracked | a blunt weapon or a fist | 70% poise (it staggers more easily - its edge's `poise`) |
| Maimed | an axe | 90% blows |
| Lamed | an arrow | Speed -15 |
| Burned, Frostbitten, Stormstruck, Blighted, Hexed | fire, frost, shock, poison, magic | -15 on its saving throw against that element (its edge's `resist`, over a learned resistance) |

The player's blows make its weaknesses: the next fight with it is shaped by how the last one ended.

### 46.6 Its ambition

What it does while it is away follows who it is (`ambitionOf`, by REVENANT-VOICE's personality - derived, never
stored):

| Ambition | Who | While it waits |
|---|---|---|
| **Vengeance** | brutal, zealous, unhinged | due in **one to two days** (`AMBITION.VENGEANCE_DUE`), and it takes **55%** of the encounter rolls (`VENGEANCE_RETURN`; another takes `REVENANT_RETURN_CHANCE`'s 40%) |
| **Mastery** | honourable, arrogant, cold | it trains: a wrath **two** days past its due day and every **two** more (`FESTER_DAYS` / `FESTER_EVERY`; RVN9's three and three), so it grows bolder every two days, not three - "Grushnak grows bolder - it has been training." (AUDIT UNQUIET: it said "twice as fast"; it is half as fast again) |
| **Plunder** | witty, humorous, craven, weary | it raids the roads: its hoard is **+25%** gold for each whole day past its due day, at most **3x** (`PLUNDER_PER_DAY`, `PLUNDER_MOST`) - the longer you leave it, the richer it is |

A town's rumour of it says what it does ("Word is it asks after you by name.").

### 46.7 The Dread

A rank-V revenant that **gets away once more**, with a lair to go to, **ascends** (`mayAscend`) - by an escape or its
will's tear-away (whose card is the ascension's), never by a slip from the choice: the player held it beaten. **One
Dread at a time** (`DREAD.MAX` 1): another rank-V one waits at rank V while it lives. It takes the epithet
"the Dread" (now the ascended's alone - the risen epithets no longer carry it), the `ascended` deed and
its card ("Grushnak will run no more. It has gone to ground in the Tomb of Vaness - the Dread now - and waits for you
there."), and its lair is known.

- **AT HOME.** It never comes on the road again (`revenantToReturn`). It is always at home in its lair, known or due or
  not (`revenantForLair`). It festers no more. Every town knows where it is, however far ("They say Grushnak the Dread
  has gone to ground in the Tomb of Vaness, and that nobody who goes in comes out."). Its hunt in the log says: "The
  Dread will not come to you again. Go to it."
- **ITS STAND.** It has half again its health (`DREAD.HEALTH` 1.5) and **two last stands**: its rank's, then a quarter
  of its health (`STANDS`, `SECOND_STAND`). Phase two comes once - the second stand rises in the fury it already has.
  It **never runs** and its **will never holds**: at home it has nowhere to tear away to, so it kneels at the end, and
  the player chooses. Destroyed, its **trophy is a Legendary** always (section 47.3); its drop is its rank's, and
  its gold **three times** over (`DREAD.GOLD`) - or a plunderer's own hoard where that is more (`hoardOf`), never the two
  multiplied. (AUDIT UNQUIET: it dropped a Legendary as well as its trophy, and its gold was x3 times a plunderer's x3
  times the lair's x1.25 - up to x11.25.)
- **KEPT.** It does **not** count among the three that hunt the player - it hunts no one - and the cap never buries it.
  (AUDIT UNQUIET: it counted, and never coming back, three of them shut the arc for good.) Read back, only a rank-V,
  unsworn record is the Dread. Sworn, it is home no longer. An older save's living, unascended record wearing "the
  Dread" (a risen name before UNQUIET) is given a risen name again, drawn from its id.

The way to stop it is the will: a rank-V revenant whose will is broken kneels, and one whose will holds tears away at
the killing blow - an escape, and it becomes the Dread.

### 46.8 What was not built

- **Trails.** An escape leaving a trail to a refuge, catchable for a while, needed a world position stood by a host -
  built in section 47 on the doors the hosts already had.
- **No hierarchy.** Revenants do not rank among themselves, lead one another, or fight over places. Each is the player's
  own memory, alone. A warband (RVN6) is its master's kin, not other revenants.

### 46.9 Words, hosts, pins

**The words.** Every new line goes through `t()` (`rvn.unq.*`, `rvn.kicker.ascended`), drafted in the 13 drafting
languages. The page (`revenantPage.js`) adds four lines to a living one's row - its flight, the wounds you left, its
ambition, its blood - and for the Dread its home, its two stands and no will line. The empty page says who rises ("An
elite or a champion marked Unquiet that kills you - or, far likelier, breaks, runs and gets away"). The card gains the
`ascended` kind (`revenantCard.js`, a deep red edge).

THE FOUR HOSTS (rule 17e): the craft runs inside `revenantFleeStep`, the flee law both pools ask - `scenes/exteriorFoes.js`
(the pool `scenes/world.js`, `scenes/worldModes.js`'s buildings and `scenes/exterior.js` each create) WIRED, and
`scenes/dungeonContext.js` WIRED for a foe of the player's alone (REVENANT-DUNGEON's gate). The mark rides the pools'
own promotion and champion draw: the street pool hands a puppet's champion `own: false`. The puff is the scene's door
(`hostMagic.js`, which every host's magic engine sets). No host function grew (`hostceiling.test.js`).

PIN MOVED: about forty revenant test files mark their fixture foes `unquiet: true` (the mark is drawn on a random id) and
make room for the cap of three. `test/systems/revenant.test.js` (DEEDS AND RANKS - the blood rule, the cap; the due days
by ambition), `flightfirst.test.js` (the roll and the line: 0.75, WILL_RANK 2), `rvn3_weak.test.js` and
`feudbalance.test.js` (the will at rank II), `rvn4_stand.test.js` and `rvn6_band.test.js` (a rank-II master's will),
`rvn7b_rumor.test.js` (the ambition's sentence), `rvn9_fester.test.js` and `auditfeud.test.js` (no revenant of mastery),
`rvn10_deeds.test.js` (the third felling ranks it), `rvn11c_betray.test.js` (a brutal betrayer due by vengeance's days),
`rvn2_adapt.test.js` (its wounds on its edge), `feudwire.test.js`, `feudharness.test.js` (only a 100/100 runner corners a
bolt), `renowngate.test.js` (the return's share by ambition; the page's words), `loot7_champions.test.js` (`own`),
`rvn11b_desert.test.js` (a deserter due by its ambition's days), `tell1_poise.test.js` (a rank's 40%; the sworn one's own
weight), `fb1012d_allyrace.test.js` (the stamp carries the Dread after its person), `foeforge.test.js` (FOE-FORGE's
`PEER_REVENANT_PUPPETS_MAX` is three kept and six sworn - 9, it was 11), and the arena ladder's, `itemwalk`'s and
audit544's fixtures, marked. 23 older mutant records named lines this slice moved and were re-aimed by content.

Pinned: `test/systems/revenant/unquiet.test.js` (25); `tools/mutants/unquiet.json` (137, all dead). Every revenant list was
swept again on the slice (44 lists, 1,731 records - 1,729 to be killed and two recorded equivalents): nine mutants lived where the cap of three, the will at rank II and the
bolt had taken their pins' ground. The burials A6 and RVN8 guard, and REVENANT-no-cap, never happened now that none rises
past the cap; they are pinned through a deserter coming back past it. RVN9's one out was the one slain to make room. A
sink close enough to have been cornered anyway. Vengeance's days read at the roll's bottom. RVN3's will mutant was rank 2,
the law now (re-aimed at 3). FEUD HARNESS's stand mid-run and its rally mid-scatter were never reached by a runner a bolt
outruns; a chaser past any player's run now reads them. Each pin was rewritten, and all nine now die - 1,729 dead, the two
equivalents as recorded.

## 47. The hunt (UNQUIET II, 2026-10-18)

The owner: "Keep building" - UNQUIET (section 46) asked "we need to go deeper on the experience". Section 46 made a
revenant live by getting away. This section makes the getting away the start of a hunt, warns of its coming, and pays
for the Dread. Every piece runs through doors the hosts already have, so no host grew. The law is
`src/systems/revenant/revenantUnquiet.js` (`HUNT`, `trailWarm`, `trailHours`, `trailWords`, `omenWords`); the record,
its deeds and its doors are `revenant.js`'s.

### 47.1 The trail

- **AN ESCAPE LEAVES ONE.** A getting-away **in the open** - an escape, the will's tear-away, or a slip from the choice
  (the `fled` deed) - goes to ground in the nearest den in reach (section 48.3) and leaves a **trail** to it. Its lair is
  **known at once** - the map's red circle and the hunt in the quest log. The trail stays warm for **twelve hours** of
  the character's clock (`HUNT.MINUTES` 720, the record's `trail`, saved), and the page and the hunt never say more than
  twelve (a trail is held within them of the character's clock, should a reload under a newer mirror set it further).
- **NO TRAIL.** A kill, the player's flight, or a getting-away with no den in reach (its old lair stands - no trail to it)
  leaves none. Nor does one underground: its lair is the dungeon it is in, and AUDIT UNQUIET found that re-entering it at
  once stood it weakened again and again, a Dread in five re-entries. Neither does the Dread, nor its ascent: it is at
  home for good. A hunt given up (the log's Abandon) cools its trail with its lair.
- **THE ESCAPE'S CARD** ends with where it leads: "Its trail leads to the Tomb of Vaness. It has gone to ground there to
  recover - catch it before it is whole again." The tear-away's and the slip's cards end so too.
- **FOUND ON IT.** Entering its lair finds it there, since a known lair is enough (RVN7d's `revenantForLair`). Found
  while the trail is warm, it stands at **60%** of its health (`HUNT.HEALTH`): it went to ground to recover, and has
  not. Whatever comes of the fight, the trail is followed (`trail` 0). Found after it cools, it stands whole.
- **THE HUNT AND THE PAGE.** While the trail is warm, the hunt in the quest log adds "Weakened - it went to ground here
  to recover. 11 hours before it is whole again." The Revenants page tags it **Weakened** - "Gone to ground in the Tomb
  of Vaness to recover - 11 hours before it is whole again. Find it there." Held (RENOWN-GATE) it says held, since no
  lair stands one then. ("Weakened", "recover": AUDIT UNQUIET - "wounded" and "heal" are its wounds' words, on their own
  law, section 48.2.)

So a flight is no longer only a loss of the fight. The player who follows it at once meets it wounded, in a place of the
game's choosing - the loop the owner asked for: harder, rarer, and fled from rather than killed by.

### 47.2 Omens

- **ITS COMING, FORETOLD.** The day a revenant falls due, the notice step - the encounter tick's own question - answers
  with an **omen** card ("An omen", a dusk-blue edge) in its ambition's words:
  - vengeance: "You feel eyes on your back. Grushnak is hunting you again."
  - mastery: "Word reaches you that Grushnak is ready to face you again."
  - plunder: "Travellers speak of Grushnak on the roads again. It is coming for you."
- **ONCE AN ABSENCE.** The record's `omen` holds the due minute it was foretold for, and it rides the save. A stand gone
  unfought (`revenantPresence`'s pushback) is the same absence: its omen moves with its due minute, and is not said
  again. An older record with no omen kept reads as foretold, so a load is no burst of them. A card already waiting (a
  kill's, a festering's, a deserter's) is said first, the omen at the next tick.
- **NEVER** for one out in the world, the Dread (at home), the sworn, the held, with the switch off, or a Night-stalker's
  by day (it comes only by night).

### 47.3 The Dread's trophy

Destroying the Dread (REVENANT-FATE's kill) drops its trophy as a **Legendary** always (`revenantTrophy.js`): its
tier's roll is drawn first all the same, and its name and kind are still its own. It is the Dread's one Legendary:
AUDIT UNQUIET took the Legendary its drop also carried (section 46.7) - two from one fight, and a pump.

### 47.4 Hosts and pins

THE FOUR HOSTS (rule 17e): no host line. The trail is the deed's (`revenantDeed`, which every pool's doors call), and its
stand is the lair's: `scenes/dungeonContext.js`'s `standLairRevenant`, already WIRED (RVN7d), through `revenantForLair`
and `applyRevenant`. The omen rides `takeRevenantNotice`, which the encounter tick of `scenes/world.js` (`runEncounterTick`)
and `scenes/exterior.js` already asks. `scenes/worldModes.js` and `scenes/dungeonContext.js` ask no notice of their own -
FLAGGED, unchanged: an omen waits for the open world's next tick. `scenes/exterior.js` (the bench) has no `lairHere` on
its door - FLAGGED, unchanged: an escape there goes to ground by the lair's own law and leaves no trail. The page, the
card and the trophy are the UI's and the fate's.

PIN MOVED: `test/systems/revenant/rvn7a_lair.test.js` reads the lair's own law through deeds that leave no trail (a kill,
my flight). `unquiet.test.js`'s escape card carries the trail after the wound.

Pinned: `test/systems/revenant/unquiet2_hunt.test.js` (8); `tools/mutants/unquiet2.json` (29, all dead). The neighbouring
lists were re-swept on it (`rvn7a`, `rvn7c`, `rvn9`, `rvn12b`, `revenantfate`, `unquiet`, `rvn1`, `revenant`): 418 dead.

## 48. Training, healing, the nearest den (UNQUIET III, 2026-10-18)

The owner: "Do it", of the three next steps put to them after section 47. The first gives a revenant of mastery a counter to the
player's own habit. The second puts a cost on leaving a revenant unhunted: its wounds heal. The third makes a flight's
den the nearest one, so the hunt starts close by. The law is `src/systems/revenant/revenantUnquiet.js` (`trainLesson`,
`trainedHow`, `WOUND.HEAL_DAYS`, `healsOn`, `daysToHeal`, `nearestLair`). Its record, its deeds and its day loop are
`revenant.js`'s.

### 48.1 It trains against you

- **WHEN.** A revenant of **mastery** (section 46.6) trains on its training days, the same days its festering counts
  (two days past its due day and every two more).
- **WHAT.** It learns the adaptation (RVN2's, `revenantFeud.js lessonOf`) answering the habit its scars name most - its
  scars are the record of how the player has fought it (RVN1). Among equals, the latest counts. My running and the
  night teach no training: they are lessons a fight teaches (RVN10, RVN2), not ones a dummy does. Nor does an element:
  a resistance is learned in a fight, where RVN2 never stacks one on what its career already resists - the record keeps
  no career, so training drills weapons and habits alone (AUDIT UNQUIET: it trained a resistance into an immunity).
  One lesson a catch-up: days caught up at once teach one, as the one card says.
- **ROOM.** It trains only into a lesson's room - fewer than its rank's lessons, ADAPT_MAX at most - so training never
  trades a lesson away. One it already holds passes the lesson to the next habit.
- **THE CARD.** "Grushnak has been training - it has learned to answer your blade." The kicker is **Trained**, with an
  old-gold edge. A rank won the same day takes the card instead (mastery's festering card already says "it has been
  training"), and a card already waiting is said first. The habit's word is its own key in the text core, so it reads in
  the player's language.
- **NEVER** a revenant of vengeance or plunder. Their days are spent hunting or on the roads.

### 48.2 Its wounds heal

- **LEFT ALONE.** A revenant's oldest wound heals every **five days** (`WOUND.HEAL_DAYS`; AUDIT UNQUIET - at three,
  94.5% of wounds healed before a road's return found them), counted from the day it took its last (`woundDay`, saved; a
  new wound starts the count again). Healing runs in the character's own day loop (RVN9's), caught up as festering is.
  A wound's day is held to the character's (no later than today); a kinsman's killer handed to an heir heals from the
  heir's day, and a deserter's or a betrayer's from the day it left (an oath stood the count).
- **NEVER** for one out in the world, nor the Dread: it keeps what it has, as it keeps its home. Nor while held.
- **THE PAGE** says when, where it heals: "Wounds you left: Lamed (a lamed leg - it runs slower). The oldest heals in 4
  days unless you find it first." Never of the Dread, one out, or while held.

The hunt (section 47) is now a choice with a cost on both sides: follow its trail at once and find it wounded, or leave
it, and it heals - and, if it trains, learns.

### 48.3 The nearest den

A revenant that gets away **in the open** goes to ground in the **nearest dungeon in reach** of where it fled (the door's
map pixel and its dungeons - RVN7a's `lairHere`; the boards' measure, the longer side; the earlier listed among equals).
Its trail (section 47) leads there, so the hunt starts close by - and only there. A kill, my flight and a betrayal keep
the lair's own law (RVN7a's pick by its id's bearing). Underground there is no map pixel, so its lair is that dungeon,
as before, and no trail. A rank-V revenant that ascends from an escape goes to ground for good in the den nearest its
last flight.

### 48.4 Hosts and pins

THE FOUR HOSTS (rule 17e): no host line. Training and healing ride `revenantFester`, the notice step's own day count,
which `scenes/world.js` and `scenes/exterior.js` ask (`scenes/worldModes.js` and `scenes/dungeonContext.js` FLAGGED, as
section 47). The nearest den reads the door's `lairHere` (`scenes/world.js` names the dungeons in reach), and
`scenes/dungeonContext.js`'s names itself underground - both already WIRED (RVN7a). `scenes/exterior.js` (the bench)
has none - FLAGGED, as section 47.4.

PIN MOVED: `rvn7a_lair.test.js`'s source pin reads the nearest den before the lair's own law. `unquiet.test.js`
gains the wound's healing days.

Pinned: `test/systems/revenant/unquiet3_train.test.js` (6); `tools/mutants/unquiet3.json` (28, all dead). Five mutants
lived on the first sweep:

- Two named code that changed nothing. The underground check is redundant, because `nearestLair` answers none without a
  map pixel, so it was dropped. A habit missing its own key fell back to the same English word, so the fallback is now
  none.
- Three wanted sharper cases: a wound day unknown, an unnamed dungeon nearest, and a den farther on one side.

The neighbouring lists were re-swept (`rvn7a`, `rvn9`, `rvn2`, `rvn11b`, `rvn12b`, `unquiet`, `unquiet2`): 335 dead.

## 49. AUDIT UNQUIET - the Unquiet audited (2026-10-18)

The owner: "Audit everything and ensure absolute perfection" - sections 46 to 48 (PR #1008), read cold by five lanes on
the frozen branch (DO NOT FIX WHILE THE VERIFIER IS READING held: no edit until every lane had reported): A the law and the
record, B the pools and the flight, C the words in 14 languages, the comments and the docs, D the balance, measured, E
online and the saves. About eighty findings, many found twice, and the lanes' open questions (Q); every one fixed,
pinned or decided below. Each lane's probes are kept
in its session's scratchpad, not the tree.

**The worst (S2).** A peer's puppet wears its owner's revenant's name with no id of mine, so `revenantCandidate` read it as
"a revenant already" and asked neither the mark nor the cap: its kill of me made a fourth past the cap, and the cap
buried one of mine for it. A marked foe running when the cap filled behind it escaped into nothing - no kill, no loot. And
the Dread was a lock and a pump at once: counted among the three and never coming back, three of them shut the arc, and
each dropped two Legendaries and up to x11.25 gold, a lair loop making one in five re-entries.

| # | Lane | Finding | Done |
|---|---|---|---|
| U1 | A | a peer's puppet (its owner's name, no id of mine) skipped the mark and the cap - a fourth born, one of mine buried | the birth asks the mark and the cap of the body itself (`revenantDeed`); another client's foe is no candidate (`rec.puppet`) |
| U2 | B | the cap's race: a marked foe running when the cap filled vanished into nothing | a flight that can make no revenant turns and fights (`cornered`) |
| U3 | A, E | an heir's inherited killer kept the fallen's clocks: its wounds never healed, the page said "3 days" forever; a reload stretched a trail | the heir's clocks (its wounds' day today, no trail, no omen); every clock held to the character's at the day's ask; the hours never past twelve |
| U4 | B, D | the craft ran on the wall's clock: a pool held still (a window over the game, a hidden tab) let a blink or a sink finish unseen | the pool's frame (`dt`, `foeFrameDt`), its dissolve drawn on the same time |
| U5 | A | training skipped RVN2's career guard: a lesson could stack a resistance into an immunity | training drills no element (the record keeps no career) |
| U6 | C | "grows bolder twice as fast" - it is every two days, not three | the words in 14 languages, the comments, 46.6 |
| U7 | C | a struck sinker "fights to the end" - its will still tears it away | "rises, cornered, and runs no more" |
| U8 | C, A, E | the page said the Dread's oldest wound heals (and an out or a held one's) | said only where they heal; a held Dread says held |
| U9 | D | a birth by flight was the chaser's Speed: at pace 2 a 62/62 runner cornered every flight, a slow one let 3.5 times as many be born | a marked foe bolts (`REVENANT_FLEE_PACE_MARKED` 2.5) on one roll in two (`REVENANT_FLEE_CHANCE` 0.5) |
| U10 | D | the Dread counted toward the cap and never came back: a passive player held 2.78 of 3 at 40 hours, the cap shut 80% of them | not counted (`huntingRevenants`); one at a time (`DREAD.MAX` 1) |
| U11 | D | the Dread a pump: two Legendaries a kill, gold to x11.25; the lair loop (an escape underground, re-entered at once, stood weakened) a Dread in five re-entries; a slip ascended | its drop its rank's (its trophy the Legendary); its hoard the Dread's or a plunderer's, the more (`hoardOf`); a slip never ascends; the trail only to the den an open escape chose |
| U12 | A | a rank won by festering or betrayal kept the blood it counted | every rank spends blood and tear-aways |
| U13 | A, D | an ascension by the will's tear-away was never announced; the tear-away's and the slip's cards dropped the wound and the trail | the unbroken card gives way to the ascension's; every getting-away's card ends as the escape's (`revenantEscapeTail`) |
| U14 | A, B, E | the zone's foes and the sand's fighters were marked (the draw comes before their tag) - "Unquiet" on a foe that never rises | `isUnquiet` and `foeTitle` refuse them |
| U15 | B, E | the dungeon marked a host's puppets on each client, each its own draw (157 of 400 rooms disagreed) | the builders clear a puppet's mark |
| U16 | A | a hunt given up kept its trail warm - "find it there" of a lair no longer named | the trail cools with the lair |
| U17 | B | a craft put down left its smoke on a kneeling one (the classic skin drew it not at all) | `endCraft` lifts the smoke |
| U18 | B, C | "each blow that lands shows it" - not on the classic skin | "lost to sight - a blow still finds it", true on both |
| U19 | C | card bodies mixed languages - an English base, a translated tail | the escape's, the tear-away's and the slip's bodies and the escape line through `t()` (5 keys) |
| U20 | C | "a kill of a companion" - a companion is felled | "one more companion felled" |
| U21 | C | "heal" named two laws (the trail's twelve hours, a wound's days); the trail's tag said "Wounded" | the trail "recovers", "whole again"; the tag **Weakened** |
| U22 | C | 48.1's card order was wrong | a rank won the same day takes the card |
| U23 | C | the omen's held case was untested, its mutant too broad | pinned; re-aimed at the held gate alone |
| U24 | B, C | no craft pin through a pool; the HOST-SPLIT pin read a file that is not there (`exteriorBoot.js`) and never `exterior.js` | the craft through the real street pool, held by a still pool; the four hosts read |
| U25 | D | the tear-away a getting-away: a trader ranked a revenant at almost every meeting from rank II, and 44% became the Dread | `TEAR_RANK` 2 (its `tears`, saved; the page says one more) |
| U26 | D | at three days 94.5% of wounds healed before a road's return found them | `WOUND.HEAL_DAYS` 5 |
| U27 | D | a blinker was out of a blade's reach before its rift opened (0 of 47 answered in melee) | it stands to its rift at half its walk (`CRAFT.BLINK_PACE` 0.5), runs plain once put down |
| U28 | E | an heir's due days by ambition unpinned | pinned (vengeance's) |
| U29 | E | the cap's paths disagreed: an heir's killer was trimmed loaded and not otherwise | it joins past the cap on both paths, burying none |
| U30 | E | an omen again after a stand's pushback; a burst of them loading an older save | the pushback keeps it; an older record reads as foretold |
| U31 | E | three pins branched on a random personality | each sets one |
| U32 | A | the cap counted before the mirror was read in | the mirror first (and the birth counts after it) |
| U33 | A | an older escape's wound named on a later card | none left, none told |
| U34 | A | two training days caught up taught two lessons and told one | one a catch-up |
| U35 | A, C, E | an older save's "the Dread" on a record never ascended | a risen name again, drawn from its id |
| U36 | B | the imp a blinker, and never a revenant (level 2) | dropped |
| U37 | B | 47.4 and 48.4 silent on the bench (`exterior.js` has no `lairHere`) | FLAGGED there |
| U38 | C | English nits: "staggers easier", "never closed", "your mark" (THE MARK's word) | "more easily", "will not close", "the wound you left" |
| U39 | C | drafts: ko "두 번 다시" reads "never again"; ru "При Известности от"; da and nb "Synk" a verb | "두 차례 다시"; "Начиная с Известности"; "Synkning", "Synking" (and their glossaries) |
| U40 | C | comments and docs: 46.1's cross-reference, 48's lead, 46.8's trails, the stale comments (a deserter's days, the will's rank, the candidate, the flee pace), `woundedEdge` "never below none", "every number in one place", "ends with", 46.3's baseline, 46.9's count, Feud-Arc 28's cell and the harness's doc, test titles, `Systems.md`, the ledger's list, "getting away" | each corrected |
| U41 | E | `wounded` on the stamp, never read | removed |
| U42 | A, Q | a rite's faithful markable: an escaped Summoner left its rite unbroken for good | never a candidate (`rec.riteRole`) |
| U43 | B, E | online: a peer sees no craft, no "Unquiet", and a puppet stands without its wounds' poise and resistance | decided: the mark is its owner's (only the owner's revenant rises from it - "Unquiet" on a peer's screen would promise what is not theirs); the craft's look and the wounds on the wire are a field and a relay version of their own, owed - a peer's blow on a wounded puppet lands as on an unwounded one |
| U44 | E | BAL11's hero threat over UNQUIET's weights (a rank-5 elite warlord at level 30, Renown 50: lane E's estimate 7.1 lives, the old weights' 4.6) | decided: both multiply a rank 1 and a rank 5 alike, so the rank's weight (UNQUIET's ask, 3.24) holds; the curve is BAL11's (`05-Combat/Balance-Arc.md` section 17) |
| U45 | B | "Unquiet" stays on a foe after the cap fills | decided: the mark is what the foe is; it rises if one of the three is gone by then (`unquietMark.js`'s header) |
| U46 | E | a deserter or a betrayer coming back past the cap still buries the weakest, oldest | decided: RVN11b's law - its leaving is the player's neglect's story |
| U47 | Q | its wounds through an heir, an oath, a desertion | decided: the heir's killer keeps the fallen's blows, healing from the heir's day; a deserter's or a betrayer's heal from the day it left (an oath stood the count) |
| U48 | Q | a poison's tick or a companion's blow breaks a sink or a blink | decided: any harm that reaches it breaks it |
| U49 | Q | two revenants with one den | decided: the stronger stands first (RVN7d's order); the other waits |
| U50 | D, Q | the mark drawn again on a reload (9 of 40 loads) | decided: the mark is its stand's (`unquietMark.js`); with the Dread's purse cut, nothing pays for redrawing it |
| U51 | Q | an unmarked special under 35% asks the flee law each frame | decided: the cheap tests first, and nothing made per frame |

Outside the arc, two mutant records answered on the sweep: `LEGACY6-death-untold` named `decideDeath`'s line (the online
window's), which its offline test never reaches - re-aimed at the door's own; and `AF-D2-rout-puppet` and
`UNQUIET-dread-buried` guarded what U1 and U10 now hold, so the redundant lines went with their records.

**The measure after** (lane D's probes re-run on the audited law):

- The duel harness (`tools/tellDuel.mjs --feud`, 150 fights a cell): every cell the same, to the hundredth - the audit
  moves no single fight. Every target holds (rank 5 over rank 1, 3.24 trading and 3.22 dodging).
- A marked elite breaks and gets away in 51% of its fights for every chaser up to Speed and Running 90 (it was 75% for a
  slow one and 0% for a 90/90); only a 100/100 runner corners it. A revenant born per special foe met: 0.127 to 0.152 by
  how often it kills the player (it was 0.187 to 0.200; before UNQUIET 0.053 to 0.242).
- A blinker at Speed and Running 50: the chaser is within 0.2 m as the rift opens (it was 6.2 m).
- Wounds kept to a road's return: 65.9%, and a revenant of vengeance's 95.9% (they were 5.5% and 63.6%).
- Forty hours, simulated (lane D's model, the harness's outcomes): a passive trader's fights hold at 0.95 an hour to the
  end (they fell to 0.16 as Dreads filled the cap), one Dread at most (it was 2.78), the cap binding 62% of hours (80%).
  A trader who hunts makes 4.8 Dreads (9.4) and 5.5 Legendaries from them (18.6); a dodger who hunts, 0.24 (0.51).
  The lair loop no longer stands a Dread at all. The Dread's purse at a level-20 lair: 10,285 gold, a plunderer's 10,348
  (30,831), and one Legendary an execution - its trophy - with its rank's own chance beside it.

THE FOUR HOSTS (rule 17e): `scenes/exteriorFoes.js` and `scenes/dungeonContext.js` hand the flee law the foe's own frame
(`dt`) and the escape its `slip`, each on its own line; the dungeon's two builders clear a puppet's mark on theirs.
`scenes/world.js`, `scenes/worldModes.js` and `scenes/exterior.js` unchanged. No host function grew (`hostceiling.test.js`).

PIN MOVED: `unquiet.test.js` (the flight's 0.5; `CRAFT.BLINK_PACE`; the smoke's and the sink's and the bolt's words; five
heal days; "the wound you left"; `DREAD.MAX`; the Dread's drop its rank's; the Dread kept and uncounted; the imp; the
four hosts read), `unquiet2_hunt.test.js` (recover, whole again, Weakened; no `wounded` flag), `unquiet3_train.test.js`
(five days), `flightfirst.test.js` (0.5), `rvn3_weak.test.js` (a first tear-away counts, the second ranks),
`revenant.test.js` (the pool's `dt`; a fixed id), `rvn12b_page.test.js` (the pools' `slip`), `rvn7a_lair.test.js` (the
den named apart), `revenant_audit.test.js` (room made before a forgotten id's birth), `rvn6_band.test.js` (its mirror
cleared with its list - the deed reads it in first), `renowngate.test.js` and `rvn11b_desert.test.js` (a set
personality), `l10n4_hardcoded.test.js` (`revenant.js` 77 to 73, `revenantFate.js` 15 to 14).

Pinned: `test/systems/revenant/auditunquiet.test.js` (27); `tools/mutants/auditunquiet.json` (77), all dead. 55 records
named lines this audit moved and were re-aimed by content (`unquiet.json` 22, `unquiet2.json` 11, `unquiet3.json` 7,
`rvn11c.json` 2, `rvn12b.json` 2, `auditfeud.json`, `flightfirst.json`, `revenantaudit.json`, `rvn10.json`,
`rvn11b.json`, `rvn3.json`, `rvn7c.json`, `rvn7d.json`, `rvn8.json`, `rvn9.json` and `legacy6.json` 1 each), each still
dead; five whose law went with U11 or became redundant were dropped. Every
revenant list was swept on the audited law (42 lists, 1,755 records): 1,749 dead, the two equivalents as recorded, and the
four survivors above, each answered and dead or gone.
