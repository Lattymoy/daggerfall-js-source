# Pegas Horse Ranch - the arc

Mac, 2026-08-31: "implement this mod 1 to 1 to replace the current
horses for the enhanced version." Mac, 2026-09-04, on what had shipped
(MW-D41/42/50 - the mod's horse mesh drawn under Daggerfall's own
mount): "this mod wasn't implemented 1:1 with what I gave you." Asked
which parts: "Everything needs to be 1:1."

This page is the mod's own logic, read out of its ESM (80 scripts,
761 dialogue infos, 53 creatures, 108 globals, 31 books, 20 cells)
and transcribed as LAWS with their constants, so that every slice
below ports a script, not a memory of one. The extraction lives in
the session scratchpad (`esmDump.mjs` over `Pegas Horse Ranch
v3.1.esm`); the vendor tree (`vendor/pegas-horse/`, MW-D50) carries
the files with the author's consent and grows per slice.

## The decisions, locked

1. **Enhanced skin only.** The classic lane keeps Daggerfall's horse:
   the general store's item, the T-key transport mode, the CFA sprite,
   byte-identical. The mod lives beside it, never over it.
2. **The mod's numbers are the law.** Every constant below is the
   script's - trot 10, endurance drain 0.03, the price polynomial, the
   3-day foal - with the script and line it came from. Where the port
   must convert (units, frames), the conversion is ONE named constant
   with the reasoning recorded, never a tuned feel.
3. **A horse is a CREATURE in the world**, not an inventory item. It
   stands where you left it, wanders, follows, can die, is saved with
   its position and its stats. That is the readme's whole point ("it
   uses a creature and not a static/activator").
4. **The port's motor moves the rider.** The script writes positions
   directly every frame (`setpos`); the port's PlayerMotor owns the
   feet and the collider owns the floor. So the ride is a MODE of the
   motor with the script's speeds and gates, and the horse is drawn at
   the rider - the same composition MW-D42 shipped - with one
   correction: the horse is now an entity that the ride ATTACHES to.
5. **Frames are 30 Hz.** The script moves per frame (`setpos x + 10 *
   xmul` every tick). Morrowind's script clock is the render clock, so
   the mod's feel depends on the frame rate it was balanced at. At 30
   Hz a trot of 10 units/frame is 300 units/s = 4.3 m/s (a real
   trot); a common horse's gallop of 15-30 is 6.4-12.9 m/s (a real
   canter to gallop). At 60 Hz every one of those doubles and the
   gallop reads as a car. `PEGAS_SCRIPT_HZ = 30` is the constant, and
   it is a recorded assumption, Mac's to adjust by eye.
6. **Units.** Morrowind: 69.99 units per metre (`MW_UNITS_PER_METER`,
   MW-D). Daggerfall: `GLOBAL_SCALE` 0.025 world units per classic
   unit; the port's world unit is the metre for the motor. So a script
   distance of D units is D / 69.99 m. Distances to the ranch's pens
   (220, 250, 500, 1000, 1500, 2000) convert the same way.

## The laws, by script

### The riding script (`hr_horse_script`, 951 lines)

The horse's per-frame script while it exists. Its states: not riding
(`ridingmode 0`), riding (`ridingmode 1`), and the transaction flags.

**Mounting** (`:223-312`). ACTIVATE the horse, not sneaking:
- dead horse: opens its inventory only (`:250`).
- horse below z -70 (in water): it follows the player out and says
  "The horse seems lost in the water. It seems to be following
  you......" (`:255-258`).
- already riding another: "You are not allowed to ride two horses at
  the same time....." (`:261-263`).
- no `hr_ridinggear` (Horse Saddle) in the pack: "You do not have a
  saddle." (`:266-268`); else one saddle is consumed and the saddle
  outfit is worn (`hr_wear_ridinggear`: race sets the rider's height
  `hr_pheight` - Argonian 60, Breton 67, Dark Elf 68, High Elf 60,
  Imperial 67, Khajiit 60, Nord 65, Orc 65, Redguard 65, Wood Elf 75,
  else 68 - once per session (`doOnce`), the saddle pants/feet are
  equipped and cannot be removed while riding: "You cannot remove the
  saddle now").
- then: `hr_riding 1`, the horse's position recorded, wander stopped,
  the rider's levitation and teleporting disabled, the ability
  `hr_ridingspell` (Slow Fall 300 - no fall damage while mounted),
  sound `hr_horse_idle2`, the rider lifted to horse z + pheight + 80,
  free view off, `frontbackposition` 20 (the rider sits 20 units
  forward of the horse's origin along its facing).
- while not riding, endurance regenerates 0.05/frame up to its max
  (`:314-316`); on a cell change it refills whole (`:219-221`).

**Facing** (`:324-600`). While riding without free view, the horse
faces the RIDER'S yaw, quantised to 10 degrees, re-issued every 0.1 s
(`face` table). The rider's forward vector (xmul, ymul) is the same
yaw, quantised to 1 degree (the 45-row sine table, mirrored by
quadrant). With free view on (first person only, `:753-762`), the
horse keeps its last facing and the rider looks around.

**Movement** (`:607-702`). RUN press-and-release toggles `running`
(the horse moves or stands); `walkrunmode` 0 is TROT, 1 is GALLOP:
- trot: `walkforward` clip, +10 units/frame along facing, loop sound
  `hr_horse_trot`.
- gallop: `runforward` clip, +`horsespeed` units/frame, loop sound
  `hr_horse_runforward` (`horse_gallop.wav`), endurance -0.03/frame;
  at 0: "The horse is getting tired", drops to trot (`:642-649`).
- standing: `idle` clip, endurance +0.02/frame, both loops stopped;
  coming to a stand from a gallop plays `hr_horse_idle3` (`:675-679`).
- every moving frame the rider is placed at the horse + 20 forward, z
  + pheight; the horse's position is recorded for the load fix
  (`:196-212`: on load, a horse more than 500 units from its recorded
  spot is put back there).
- water: rider z below pheight - 70 dismounts with "You cannot ride a
  horse underwater" (`:670-672`, `:940-944`).

**SNEAK** (`:707-859`), press-and-release while running toggles
TROT/GALLOP with the messagebox "GALLOP" / "TROT"; while standing it
does nothing. Held over 1 s:
- at trot: the SPECIAL MOVE - `running` off, clip `idle7`, for 1.5 s
  the rider is set 55 units BEHIND the horse and 25 up (the rear),
  then `idle` (`:738-741`, `:774-793`).
- at gallop and running: the JUMP - levitation enabled, `hr_ridingspell2`
  (Levitate 1000) then `hr_ridingspell3` (Slow Fall 50), the horse
  rises 30 then +10/frame for 0.5 s, moves forward at `horsespeed - 5`
  per frame for the whole 1.8 s, the rider 20 above pheight; at 1.8 s
  the spells go, levitation is disabled, endurance -1 (`:809-848`).
- SNEAK + ACTIVATE: in first person toggles FREE VIEW ("Free View
  ON/OFF"); in third person while standing opens "Position Your
  Height" Higher / Lower / Cancel (pheight +-1) (`:753-771`, `:849-858`).

**Slope** (`:864-892`). The horse's vertical change per frame is
watched: over +8 (trot) or +(horsespeed - 5) (gallop) three frames
running: "The horse stops as the slope is too steep to climb";
under -8 / -(horsespeed - 5): "...too steep to go down"; either stops
`running`.

**Dismount** (`:897-949`). ACTIVATE not sneaking, or the rider's
fatigue at 0 (`:92-96`), or the horse's death (`:67-90`), or water:
loops stopped, `hr_horse_idle2`, `idle` clip, `running` and gallop
off, combat stopped, the saddle outfit removed and the Horse Saddle
returned to the pack (`hr_remove_ridinggear`), levitation and
teleporting re-enabled, "Dismount", the horse wanders (`AiWander 60
20 10`). Pen flags are read here: standing in the selling pen with
`hr_sell_flag` sets `sellflag`; the training pen `trainflag`; either
breeding pen `breedflag`.

**Death** (`:67-90`). The Horse Registration Paper leaves the pack,
the owned count drops, riding ends, companion riding / breeding /
training / selling in progress are cancelled with their messages.

**The dialog menu** (SNEAK + ACTIVATE while not riding, `:225-247`)
copies the stats into the `hstats_*` globals and opens dialogue on
the horse: topics Follow Me, Stay Put, Feed Horse, Show Statistics,
Sell Horse, Train Horse, Breed Horse, Change Saddles, Companion
Riding (added at the horse's first frame, `:120-128`).

### The horse record

Attributes: strength, endurance, intelligence, speed, health, sex,
breed. `countendure` is the LIVE endurance (stamina), `countstrength`
etc. the live copies shown as "current / max".
- **Show Statistics**: "Sex : Male|Female  Breed : <name>  Strength :
  cur / max  Endurance : cur / max  Intelligence : cur / max  Speed :
  cur / max  Health : cur / max".
- **Feed Horse**: Carrot / Hay / Grass; carrot +20 health, hay +10,
  grass +5, never past max; "You do not have any carrot|hay|grass."
  and the three eating lines; sound `hr_horse_idle2`.
- **Follow Me**: `AiFollow player`, "The horse obediently follows
  you..."; **Stay Put**: `AiWander 0 10 5 3`, "The horse stands
  firm...".
- **Change Saddles**: Saddle A / B / C (`hr_saddle_sel`), a choice
  only when `hr_saddle_num` allows.
- Health = 3 x strength + endurance (`hr_horse_stat_01:30`,
  `hr_trainer_script`, `hr_foal_act_script`).

### The breeds

Twenty-one: common 1-10 (Banchao, Cerali, Isrian, Skyrim, Ryn'di,
Taiatan, Tamrielic, Vvarenor, Rothvanner, Say'ldi), cross 11-16
(Ashlandi, Zafir, Chamordan, Malinoor, Emperator, Ascadian), ultimate
17-20 (Azuralia, Melathian, Fyr Marre, Zeshtopali), 21 the Unicorn.
Each breed is `xhorse<N>.nif/.kf` with coat `Cait_horse<N>x.dds`; the
unicorn `db_unicorn.nif` with its own coat, mane and horn. Stat caps
by class (`hr_trainer_script:105-150`): common str 100 / end 80 / int
100 / spd 30; cross 120 / 100 / 120 / 40; ultimate 150 / 120 / 150 /
50. The ultimates carry abilities while ridden (`hr_horse_azuralia`
etc.): Azuralia a Lightning Shield 100, Melathian a Frost Shield 100,
Fyr Marre a Fire Shield 100, Zeshtopali Night-Eye 100; the unicorn
rides 35 units BEHIND its origin (`frontbackposition -35`), can fly
(the wings, `hr_wear_ridingwing01/02`, toggled by SNEAK + ACTIVATE
while flying), toggles night-eye the same way, and runs `Slow Fall
100` (`hr_ridingspell4`).

### The pen (`hr_horse_stat_01..10`, `hr_random_horse`)

Ten common horses stand in the ranch's cattle pen; each day (`Day`
changes, no purchase pending) they are re-placed at their ten spots
and re-rolled: each shown with probability 5/11 (`Random 11 < 5`),
strength 50 + Random 11, endurance 50 + Random 11, intelligence 50 +
Random 11, speed 15 + Random 9, sex Random 2, health 3 x str + end,
PRICE = p^2 + 1000 where p = 2(str-50) + (end-50) + 2(int-50) +
4(spd-15). ACTIVATE a pen horse: "Select Option?" Show Statistics /
Buy Horse / Cancel; buying sets the transaction (`hr_horse_buy 5`)
and sends you to Dirdayvin. When the ranch sees a purchase pending
before 8am-6pm, three in ten days the ranch music plays
(`maxhorse/Fellowship.mp3`); the pen plays it once when the player
first comes within 2000 units.

### Buying and selling (Dirdayvin, Greeting 5; `hr_dirdayvin_01`)

- Buy: "For the horse you wish to purchase, the costs is <price>
  gold. Do you want to buy the horse?" - gold taken, `hr_horse_buy
  10`, owned count +1, a Horse Registration Paper (`hr_bk_01`) given;
  "Excellent. Now go see the Main Groomer Maksimlan on the second
  floor and present your registration papers to complete the
  purchase of the horse." Maksimlan sets `hr_horse_buy 100` and the
  pen script places the bought horse (`hr_horse_<N>_buy`) in the first
  free of FIVE stables (`hr_stable_01..05`), else "You have run out of
  stables." and it stands outside them. Not enough gold: `hr_no_gold`.
- Sell: ride the horse into the selling pen, dismount (sets
  `sellflag`), SNEAK + ACTIVATE -> Sell Horse; the horse computes its
  price: p = 2(str-50) + (end-40) + 2(int-50) + 4(spd-20); common:
  (0.7 p^2 + 500) x disposition x 0.004; cross/ultimate: (0.5 p^2 +
  1000) x disposition x 0.004; the unicorn: (p^2 + 1000) x disposition
  x 0.008. Dirdayvin pays it in 65534-gold instalments (Morrowind's
  short limit), takes the registration paper, the horse is disabled
  and deleted on the next cell change. "You have sold the horse." A
  horse without its paper: "You have no registration paper on the
  given horse. Unfortunately, we do not render services for horses
  that we do not sell."
- Owning five or more: the no-stables warning.

### Training (`hr_trainer_script`, `hr_trainer_gm_script`, the trainer dialogue)

Ten trainers in nine tavern bars (Balmora, Vivec, Pelagiad, Caldera,
Ald-ruhn, Suran, Gnisis, Ebonheart, Sadrith Mora) plus one
`hr_trainer_11` who charges more; each rolls a hidden group at first
sight - POOR (max 3 of them; caps str 80 / end 60 / int 80 / spd 25;
daily multiplier from {-1, 0, 0.5, 1, 1.5}), MEDIOCRE (max 6; caps
100 / 80 / 100 / 30; {0, 0.5, 1, 1.5, 2}), GOOD (max 4; caps 120 /
100 / 120 / 40; {0, 1, 1.5, 2, 3}). HIRE: 2000 gp (trainer 11:
10000), one at a time ("You already have a trainer..."); the hired
one moves to the ranch's trainer shack. SACK: "Are you absolutely
sure...?" -> "Please, I beg you to reconsider....." -> free again.
TRAIN: ride into the training pen, dismount, SNEAK + ACTIVATE ->
Train Horse; the session costs 500 gp common / 1000 cross / 1500
ultimate (trainer 11: 1000 / 1500 / 2000; a grandmaster session
5000); "Ok. This may approximately one full day." The next day at or
after 8am the trainer applies, in order, str += m, end += m, int +=
m, spd += m/2 where m = multiplier x horse intelligence / 50, each
clamped to the trainer's cap above and to 50 (speed 15) below, then
to the BREED's cap; health re-derived. The horse then re-initialises
with the new stats (`hr_trainer 200`). Cancelling mid-training
refunds nothing. THE GRANDMASTER (`hr_trainer_gm_script`): appears
after a cross-breed foal (`hr_gm_flag`), caps 150 / 120 / 150 / 50,
multiplier {1..5}, adds the "Unicorn" topic; a horse trained by him
more than ten times unlocks the unicorn arm (`traintime > 10`).

### Breeding (`hr_liokys_01`, `hr_breed_timer`, `hr_foal_*`)

Two horses of opposite sex in the two breeding pens by Liokys's
shack, each set to "Breed Horse"; same sex: "Think I don't know the
difference between a male and a male?"; one horse: "You cannot breed
with only one horse." Fee 2000 gp (5000 when both are cross or
ultimate). Next day at or after 8am: foal sex Random 2; str/end/int/
spd = the parents' averages; breed: a coin flip - either one
parent's breed (50%), or the COMBINATION table (50%): 1+2 -> 11,
3+4 -> 12, 5+6 -> 13, 7+8 -> 14, 9+10 -> 15, 2+4 -> 16; 11+12 -> 17,
13+14 -> 18, 15+16 -> 19, 14+15 -> 20 (each of these sets the
grandmaster flag); 17+20 -> 21 THE UNICORN, once ever
(`hr_unicorn_flag`), a second time answers 20 or 17. The foal appears
in the breeding pen at scale 0.73 (day 0-1), 0.86 (day 2), 1 (day 3);
"You cannot ride the horse yet." with the day count; "Your foal has
grown up!!" after three full days, when it becomes a bought horse
with the foal's stats, a registration paper, and the owned count +1.
A foal can be sold on the spot for 500 (common), 500/1000 (cross by
value), 500/1000/2000 (ultimate by value); the pen is one foal at a
time: "Sorry the breed pen is already occupied with a foal."

### Companion riding (`hr_companion_NPC`, `hr_companion_horse`, `hr_npchorse_script01`)

Any companion-share NPC takes the "Companion Riding" topic; one at a
time; they ride with you on your horse or on a second horse of yours,
positioned each second off your horse's heading by the arcsine table
(`hr_comp_angle`, "Simple ArcSin by Matt (Simpleton) Edlefsen") at
`hr_comp_offset` (-25 standing, -8 trot, speed-10 gallop). Combat:
the rider dismounts before the NPC fights; the companion horse fights.
Reload loses the attachment; the topic resets it. The Horse Companion
Paper (`hr_bk_03`).

### The ranch (cells `Pegas Ranch`, four exteriors at grid 11-12,
12-13 near Vos, four shacks, the trainer shack)

594 references in the ranch interior, 254 + 127 + 77 + 43 in the
exteriors: the office (Dirdayvin, Tolkamor the guide, Irhilida,
Maksimlan the groom on the second floor, a room to rent, the lift),
the cattle pen with the ten daily horses, the selling pen, the
training pen, the two breeding pens, five stables, the shacks of
Erinderhel, Sigonryp, Menaltvarn and Liokys, the trainer's shack, the
banners, the catalogues and manuals (31 books). The geometry is the
mod's own models (`hr_building_01`, `stables_*`, `hr_bar_*`, the
desk, the banners, hay and carrots) standing on Morrowind's ground
and among Morrowind's statics - Bethesda's, which the port reads only
from the player's own attached data, never vendors.

## The slices

- **PH1 - the horse in the world, and the riding script.** A horse
  entity in the streaming world: the vendored mesh and clips drawn
  through the character pass at its own position, idle wander,
  saved with the world. The Horse Saddle item. ACTIVATE to mount
  with every gate above; the ride as a motor mode with the script's
  speeds at `PEGAS_SCRIPT_HZ`: RUN toggles moving, SNEAK toggles
  trot/gallop, the tired law, the stand, the slope stop, the special
  move, the jump, free view, the height menu, the four dismount
  doors, every message and sound. The Ride out door of the test room
  spawns one saddled horse beside the player until the ranch exists.
- **PH2 - the record.** The seven attributes with live copies, Show
  Statistics, Feed Horse with the three foods as items, Follow Me and
  Stay Put, death, the registration paper, Change Saddles, the twenty
  breeds' files vendored and the coat chosen by breed, save/load of
  every horse the player owns.
- **PH3 - the economy.** The pen's daily roll and its Show/Buy menu,
  Dirdayvin's buy and sell with the price laws and the instalments,
  five stables, the trainers with their groups, hiring, sacking and
  the day-long session, the grandmaster, Liokys's breeding with the
  combination table, the foal's growth and sale.
- **PH4 - the ranch, in the world.** The mod's cells rendered from
  the player's attached Morrowind data plus the vendored models, with
  the NPCs, the dialogue and the books - standing somewhere in the
  Iliac Bay. WHERE is the one decision this arc cannot make alone
  (the mod's site is Grazeland south of Vos, a place Daggerfall does
  not have) and it is put to Mac at PH3's close.
- **PH5 - the extras.** Companion riding, the unicorn's flight and
  wings and night-eye, the ultimate breeds' shields, the ranch
  music, the room to rent.

Each slice lands with its own pins over the script's constants, and
nothing is tuned by feel: a number that differs from the script is a
recorded departure with the reason.

## PH1 - shipped (2026-09-04)

The horse in the world and the riding script, in four modules and a
motor override, enhanced-only throughout:

- **`src/systems/pegasRide.js` - the law.** The script's machine as a
  pure module: every constant by its line (`TROT_UNITS_PER_FRAME` 10,
  `FRONTBACK_POSITION` 20, `MOUNT_LIFT` 80, the three drains, the jump's
  six numbers, the slope law, `WATER_BELOW` 70, the 10-degree facing on
  a 0.1 s clock), the seat by race, the messages verbatim, the sound
  keys (`pegas:idle|idle3|trot|gallop|scream` through MW-D42's door),
  the clip names, the saddle as an item of its own group
  (`PegasItems`, template 1001 - no Daggerfall row is it), the mount
  gates in the script's order, `createPegasRide()` with `mount`, `tick`,
  `dismount`, `heightButton`, and `regenStanding` for the pool.
  `PEGAS_SOUND` is the export's name (AUDIT 24's one-home ratchet holds
  `SOUND` for soundClips.js).
- **`src/systems/pegasHorses.js` - the horses.** The world records:
  spawn (art through the MW-D50 composition, async, a failure recorded
  never thrown), the idle law (AiWander 60/20/10 on a 4 s clock - the
  roll recorded in `idleRoll`, the clip taken only when the .kf carries
  the group, and the lookup case-blind because a .kf keeps `Idle2` as
  written while the script says `idle2`), `horseRecord()` - the ONE
  view of a record both halves read (the pool's regen and the rider's
  machine; the first cut gave the pool the raw record and the regen
  read an `endurance` that was not there), activation boxes, the origin
  shift, the save shape in natives.
- **`src/systems/pegasRider.js` - the host's half.** The activation
  arm, the mount with its gates and its saddle, the per-frame tick that
  hands the machine the keys and the motor the answer, the sounds and
  lines, the record following the rider 20 units behind, the clip
  falling back to Idle on a .kf without the gait (never a frozen rig),
  the dismount. The height menu has no three-button box yet: it
  cancels with the script's line (PH2 draws it).
- **`src/player/motor.js` - the body.** `this.pegas` overrides the eye
  height, the input bag, the speed and the vertical law; a landing in
  the saddle reports no distance (`hr_ridingspell`'s Slow Fall 300 is on
  the RIDER, so the horse falls under its own physics and the rider
  takes no damage - the host's landing law is untouched).
- **`src/scenes/world.js` - the wiring.** The ladder's arm ahead of the
  townsfolk, the tick ahead of the motor it drives, the draw through the
  character pass, the origin shift, the save envelope, and the travel
  carry as two one-line calls (`pegasCarryOut()` on the OLD frame after
  the pixel teardown, `pegasCarryIn()` once the destination stands -
  the helpers stand outside the core so AUDIT 39's teardown windows
  hold). Ride out (TSR4) spawns one saddled horse at the player on the
  enhanced skin; the classic skin keeps Daggerfall's own mount.

Pinned by `test/pegasride.test.js` (12) and `test/pegashorses.test.js`
(7). Recorded gaps for PH2: the height box, the standing horse's water
arm (no water level for a standing record yet), horse collision, and a
save taken mid-ride restores on foot beside the horse.
