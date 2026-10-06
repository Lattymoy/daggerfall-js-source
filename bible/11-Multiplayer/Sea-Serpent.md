# The Sea Serpent - Sethrakul, the Old Coil (SERPENT1)

> Design page and record of the slice, written 2026-10-04 as it shipped and corrected the same day by its audit
> (`01-Overview/Audit-Sea-Serpent.md`, whose finding ids - S1, T3, E2 ... - the code's comments cite). The code's
> comments cite this page by section number; where the page and a pin disagree, the pin is what runs.

## What Mac asked for

Mac, 2026-10-04: *"I want to talk about developing a new world boss. The sea serpent. A new world event that
requires players with a ship to meet up and take on a large scale sea serpent in the ocean."* Then, handing over every
decision: *"You make the decisions and online only. I trust your instinct. Be as detailed as possible and make this
something truly special."*

So, as decided here:

- **Online only.** Like the gate, the serpent is a fact about the shared world: the relay keeps its fight, signs each
  fighter's kill and the account service pays for it. Offline there is no serpent.
- **A ship's fight.** It lives on the open sea and is fought from decks with the guns the naval fight already has
  (`03-World/Naval-Combat.md`). A player with no ship can still crew another player's ship and earn a share by
  standing the fight out near it (section 8).
- **One beast, named.** SETHRAKUL, the Shed-Skin of Satakal, whom the Bay's sailors call the Old Coil. The Redguards say
  Satakal, the World-Skin, sheds the world as a snake sheds its skin, and that not every skin he leaves behind is
  dead. The table (`SERPENT_BOSSES`) holds one serpent now, so a later slice can add more without a new mechanism (the
  gate's `GATE_BOSSES` law).
- **The gate's trust model, Option B** (`World-Bosses.md`): the relay's Durable Object is the authority over the
  boss. Its health, its swim, its attacks and its kill are the relay's. Each blow it lands is judged on the struck
  player's own machine.

Daggerfall has no other players and no sea serpent, so none of this is a DFU member. Its Ledger A row is SERPENT1.

## The shape, end to end

```
 the event clock ─► the SIGHTING (02:00) ─► it RISES (05:00) ─► the STORM closes its waters (08:00) ─► it DIVES (10:00)
   (no frame)        chat line, map ring     ships sail in, `in`    no newcomer; the fight goes on        unslain: gone
                     compass in the ring          │
                                                  ▼
                        the CELL ROOM its site stands in keeps the fight (brain on the cell's alarm)
                                                  │  every 250 ms: its swim, its attacks, its phases
   the account ◄── claim ◄── RECEIPT `l1` ◄── the KILL ──► the hub ──► everyone online hears it (their own site's)
   service (D1)     │        (signed)           │            and keeps each earner's receipt for its hello
                    └──► the HOARD (rolled from the receipt's seed) and RENOWN for the character that fought
                         SERPENT-SET: the hoard's Deadlands Ember (and a Coilscale piece), the kill's SILVER
```

## 1. The schedule - a function of the clock

The serpent runs on the gate's event clock (WORLD5's shared clock at TimeScale 12, a game day every two real hours;
`net/serpentLaw.js`). A serpent rises every `SERPENT_EVERY_DAYS` (2) game days, on the odd days (`SERPENT_DAY_PHASE`
1). That is once every four real hours, at the same six UTC times each day, so every timezone's evening holds one.
It takes the dawn watch, the gate's quiet half of the day, so the two never stand at once.

| game time | real time (UTC, every 4 h) | what |
|---|---|---|
| 02:00 | HH:02:30 | **the sighting**: the chat line, the map ring |
| 05:00 | HH:17:30 | **it rises**: its waters open to every ship, the fight begins (it surfaces over `SERPENT_SURFACE_MS`, 12 s) |
| 08:00 | HH:32:30 | **the storm closes its waters**: no newcomer joins, the ships already in it fight on |
| 10:00 | HH:42:30 | **it dives** (it *sounds*, in the code's word): unslain, it goes down over `SERPENT_DIVE_MS` (15 s) and is gone |

(HH is 03, 07, 11, 15, 19 and 23.) That gives fifteen real minutes from the sighting to the rising, fifteen to
reach it, and twenty-five minutes of fight at most. Every client and the relay compute the same instants with
nothing sent (`serpentTimes`, `serpentPhase`: quiet, omen, rising, hunt, late, slain, sounding, gone). A kill makes
the phase `slain` for `SERPENT_DIVE_MS` (its death throes), then `gone`.

## 2. The sighting - the chat, the ring, the compass

`systems/serpentOmen.js` (`createSerpentOmen`), one call a frame from the online frame. It says nothing until the
relay's clock is read and the hub has welcomed the player (AUDIT WB C4's law), then waits `SERPENT_OMEN_SETTLE_MS`
more. Each line is said once a day, in order. A player arriving late hears only the line for where it stands now:

- the sighting - *"Bells ring in the harbours: a great serpent is sighted off Sentinel. Sethrakul rises at 04:17 your
  time."* (the place is the nearer port, and its province where that is another name; the time is this machine's local
  time, as the gate's lines are);
- the rising - *"Sethrakul rises off Sentinel. The storm closes over its waters in 14m 48s."*;
- the storm closing - *"A storm closes over Sethrakul's waters off Sentinel - no ship can join the fight now. It dives
  at 04:42 your time."*;
- the dive - *"Sethrakul dives off Sentinel and is gone into the deep."* (never said of a serpent slain).

A time left is said as *14m 48s* and *9s*, never *14:48*, which reads as the hour beside lines that name the hour
(AUDIT SERPENT, the words); a countdown never reads *0s* with time left, and the rising counts to the storm, never
*"rises in 0s"* as it rises (B9).

The kill's line is the HUB's word (section 8): *"Sethrakul is slain off Sentinel by Ama, Bryn and Cass. Its hoard goes
to the ships that fought it."* Each client says it for its own site's serpent alone, naming the place from that site
(AUDIT SERPENT S1).

**The ring.** `mapMark()` gives a ring of radius `SERPENT_RING_PIXELS` (3) map pixels (about 2.5 km), its centre pulled up to
`SERPENT_RING_SHIFT_PIXELS` (1.2) off the site by the day's roll, so the ring marks the waters and not the spot. Its
label says the countdown, and its card names the serpent, the port it lies off and the packet lane it hunts. The held
map draws it with the gate's own reader and painter in the sea's colours (`ui/serpentMapMark.js`, `ui/inkMap.js`
`paintGateRing`'s `ink`, `ui/heldMap.js`: the legend's "Sea serpent", the card under the pointer). The classic region
page draws no serpent: a province's sheet shows little of the open sea it hunts.

**The compass.** Inside the ring, the enhanced HUD's strip carries a sea-green diamond where it hunts
(`ui/enhancedHud.js` `drawSerpentMark`, `scenes/world.js` `serpentCompassMark`).

## 3. Where it rises - the packet lanes

`systems/serpentSite.js` (`findSerpentSite`). The serpent hunts the Bay's packet lanes (`systems/naval/seaLanes.js`):
the lanes between the map's ports, the same list on every client, made from map files every client holds. The day
rolls a lane (`serpentLaneOf`) and a place along that lane's way (`serpentAlongOf`, inside `SERPENT_ALONG`, 0.3 to
0.7 of its length). A place is kept only where the sea is open all round it: every map pixel within `SITE_CLEAR_PX`
(1) must be the ocean's water (the lanes' own `open` law, never a lake). If not, the place slides along the way up to
`SITE_SLIDE` (0.16) each side. A lane shorter than `SITE_LANE_MIN_M` (six map pixels) is skipped. After
`SERPENT_LANE_TRIES` (24) lanes with no site, there is no serpent that day, and the omen stays silent rather than name
nowhere.

The site is the native point the fight is framed about (`sx`, `sz`). Its card names the nearer port, the port's
province and both ports the lane joins. A client with no map data yet asks again every `SITE_RETRY_MS` (5 s).

**The relay never reads a map.** Each `in` names the site it was said for (section 6). Its own cell must hold that
site (`cellRoomOfWire(sx, sz)` is the cell's key), so a correct client always says it in the right room. A site is
named to the whole native unit (`serpentSiteKey`); every honest client finds the same one, so they share one fight,
and a forged site stands a fight of its own that none of them folds as theirs: every word a fight says names its site,
and a client folds its own site's alone (AUDIT SERPENT S1, AUDIT SERPENT 2 F1). The account service's one row per
(day, account) bounds what a forged site could buy.

## 4. The body - a path, not a physics

`net/serpentBody.js`, shared by the relay and every client, so both draw the same serpent from the same words.

- **The head runs LEGS**: lines and arcs at a constant speed (`legAt`, `headAt`). An arc's centre lies `r` to its
  side (`sd` is +1 for a right turn, -1 for a left). A jump leg (`j`) starts a fresh track: its rising's alone - since
  SERPENT3 (section 15) every other leg is swum from where the last left its head.
- **The body follows the head's track** back by arclength (`spinePoint`). It has `SEG_N` (24) segments of `SEG_LEN`
  (7 m), 168 m in all, with radii tapering from the head to a tail fin (`radiusAt`).
- **How it rides the sea** is a mode, each change blended over `MODE_BLEND_MS` (1.5 s):
  - `deep`: under the sea, `DEEP_Y`.
  - `cruise`: humps break the surface, `HUMP_L` (46 m) waves along it, the head just over the sea.
  - `breach`: the head thrown up `BREACH_Y` (12 m), the neck arched out.
  - `rear`: the head high, `REAR_Y` (14 m - AUDIT SERPENT T4: at 24 m it stood over every broadside's arc).
  - `coil`: the track sinks to `DEEP_Y` and the body winds `COIL_TURN` (0.92) of a turn about the coiled ship at
    `COIL_R` (22 m), its head reared `COIL_HEAD_Y` over her.
  - `dying`: its throes.
- **What may be struck.** A segment more than `EXPOSED_M` (0.4 m) above the sea is a target (`segExposed`). Its
  oriented box (`segmentBox`) is a target among the naval shots' own (section 7). The head - its first two segments,
  the jaw and the crest behind it (AUDIT SERPENT T4) - counts as **thrown up** only while it breaches, rears, holds a
  coil (`coilWeight` past half) or is stunned (`headExposed`), and only then does a ball on it land `HEAD_X`.
- The relay keeps the legs and modes still to come, and of those past the ones the body still lies along: legs are
  pruned by time and capped at `LEGS_KEPT` × 2, modes capped at `MODES_KEPT`.
- **The timeline's one rule** (AUDIT SERPENT S2, `supersede`): a leg or a mode said at a moment removes every one
  still to come after it, on the relay as it pushes and in every client's fold. A kill during a Rising Maw's dash, or a
  sounding during a ram's run, is then one track everywhere, and the body every screen draws is the one the relay
  judges.

## 5. Its blows - judged on the struck ship

The brain says each attack's shape, its landing time and its target (`atk` words). Every client tests its own ship and
its own feet against it (`systems/serpentStrike.js`). The relay never learns a ship's hurts: this is co-op's victim's
law, which the naval fight already keeps.

| attack | phase | shape | wind-up | what it does |
|---|---|---|---|---|
| Tail Lash | 1 | sector, 85 m, 120 degrees | 2.6 s | 6% of her hull + 6, canvas, two men; a throw |
| Breaching Ram | 1 | lane, 18 m wide | 3.6 s | dives, then runs its lane at `RAM_V` (34 m/s); 14% + 12, three men; a throw across the lane - the heaviest, the one a helm can sail out of; chosen at a ship within 170 m, its lane's reach (`ramReach`, 171 m - AUDIT SERPENT 2 F7) |
| Rising Maw | 1 | disc, 20 m | 3.2 s | closed on at the surface, then dives and dashes under the sea for its mark (SERPENT3, section 15) and bursts up under it, running in on it the last `BREACH_LEAD_MS` (1.2 s); 7% + 8, two men; a throw |
| Venom Spit | 1 | disc, 13 m | 2.6 s | a glob flies `SPIT_FLIGHT_MS`; 1.5% + 2 and a man; a venom pool stays 9 s and bites anyone standing in it (2% of their health + 1, each second) |
| Constrict | 2 | ring, 36 m | 4.8 s | the coil (below) |
| Abyssal Roar | 3 | rings, 22 to 120 m | 2.8 s | safe close in under its jaws; 5% + 5, a man, and the canvas torn |
| Satakal's Call | the turn to 2 | none | 2.6 s | its cry as it turns |
| The Maelstrom | the turn to 3 | none | 5 s | the whirl forms (below) |

These are AUDIT SERPENT T1's numbers (Mac chose the validated rebalance). At the first numbers a ship it focused was
wrecked in 36-80 s and no fleet of eight won at the gunnery measured. At these, simulated against the relay's own brain
at `SERPENT_TTK_S` 180: at 38% of balls striking, five or eight ships win every time in about 13.5 minutes and three
ships half the time; at 60%, every fleet of three or more wins in six to seven minutes. One ship alone never wins - it
is a fight to meet up for. SERPENT3 (section 15) simulated it again on the brain as it then stood - with AUDIT SERPENT
F7's shorter ram, which these numbers were not re-simulated with (it left ships 170-240 m off to the breach and the
spit) - and found a pair never winning and three galleons one fight in twenty-four at 38%; it took away the
teleporting Rising Maw that did most of the hurt and gave a pair its share: at 38% a pair wins nine to twelve fights in twelve, a lone ship none.

**A blow's hurt is a share of HER whole hull and canvas, with points on top** (`shipHurt`, TOUGHER-SHIPS' law), so a
small boat feels the points more than a carrack does. Braced, her hull and canvas take `BRACE_TAKEN` (half) of it, as
of any ball (AUDIT SERPENT B6). A shape meets a ship at her bow, her middle or her stern, with her beam as slack
(`shipPoints`), because a carrack is fifty metres long. The ram meets her only once its head has run as far as she lies
(`shapeMeets` at `t`), but its **MOVE** is said for a ship anywhere down its lane as it winds (B2). The coil's ring,
laid where the relay saw her helm, meets her if any of her lies inside it (B5). A landing is judged on its own moment
or not at all: one this machine first sees (or comes back to) more than `LAND_JUDGE_MS` (500 ms) after it landed - a
ship sailing in on its recovery, a stalled frame - strikes nothing, its venom laid all the same (AUDIT SERPENT 2 F4).

**The throw** (`shoveOf`) pushes her away from the blow (across the ram's lane) and dies away over `SHOVE_S` (2.5 s).
It is carried by Come Sail Away's new `drift` seam (section 7).

### The coil

At 66% the serpent turns (section 6) and winds about a ship - the most hated `SERPENT_THREAT_PICK` (60%) of the time,
otherwise any; always a ship, never a hand aboard one (AUDIT SERPENT S10). Her own machine judges whether she was inside
the ring at the landing:

- **Inside**: she says `held` with her hull's middle. The coil closes onto her, and the warp seam holds her where it
  took her (kept in the site's frame, so a scene that moves its origin never carries her off - L1), her way off and her
  helm dead.
- **Outside**: she says `esc` within `COIL_ESC_MS` (3 s), and it closes on empty sea.

Her word is said at the landing on her own clock, which may come before the relay's beat that winds the coil; the
relay keeps a word said up to `COIL_WORD_EARLY_MS` (1 s) early on the attack and hears it as the coil winds (S3).

The coil has its own health: `COIL_TEAM_S` (4) seconds of the broadsides of the ships fighting it (afloat, and with
some threat on it - T3), at least `COIL_HP_MIN` (60). While it holds, it grips her every second (`gripHurt`: 0.8% of
her hull + 1, and 0.15 men, the fractions carried so 3.4 a second is 3.4). A blow on it takes `SERPENT_COIL_PASS`
(half) of itself off the serpent's own health too, so the fire a coil draws is never wasted. Then one of three things
happens:

- **The ships' fire breaks it**: blows on a coil segment go to the coil's health. It lets go and lies **stunned** for
  `SERPENT_STUN_MS` (9 s), with no attack, its head thrown up and every blow `STUN_X` (1.5) heavier. The ball that
  breaks it is named: *"Ama breaks the coil! Sethrakul reels, stunned - strike its head!"*
- **Left whole for `COIL_MS` (24 s), it CRUSHES her** (`crushHurt`: 25% + 15, a fifth of her canvas, four men).
- **It dies or dives** with her held: it lets her go, and says so (`cx` - S4).

The client holds her on its own judgement until the relay's word of the coil arrives (`COIL_WORD_WAIT_MS`, 2.5 s, the
next beat and the wire), and lets her go if it never does. A coil whose end is never heard lets her go
`COIL_LOST_MS` (4 s) past its time, so a lost socket never holds a ship forever.

### The maelstrom

At 33% the whirl forms where it swims (SERPENT3, section 15 - at its waters' heart before): its eye `MAEL_ORBIT_R` to
its left, drawn in so its round lies inside its waters, said in its word (`maelPull` pulls about it). Its waters are
laid on the sea where its eye forms as it winds up, five seconds' warning (T8). Over `MAEL_GROW_MS` (4 s) it grows to pull every ship within `MAEL_R` (230 m) toward its heart,
at 1 m/s at its edge rising to 3.8 m/s near the eye, and round it at up to `MAEL_SWIRL` (4 m/s). In the eye
(`MAEL_EYE_R`, 40 m) it grinds her hull (1.2% + 1 a second). The serpent circles the eye reared, at `MAEL_ORBIT_R`
(85 m), and roars from it. The pull rides the `drift` seam. Her own helm still answers: at the first pull a rowboat or a
Large Boat in it never sailed out (T8), at this one every hull can.

## 6. The relay's arm - the fight in the cell of its site

**Where it lives.** The fight lives in the CELL ROOM (`world:x,y`, a 16-pixel shard) its site stands in. It is not
a room of its own, because naval sync and the halo are already there: a ship within `ADMIT_R` (1500 m, under two map
pixels) of the site always holds that cell, as its own room or as a halo (`RANGE_PIXELS` 3). Words go out on whichever
socket reaches it (`net/online.js` `sendSerpent(word, cell)`, `serpentReady(cell)`).

**One fight a site** (AUDIT SERPENT S1). The site is the client's word, so a cell keeps a fight for each site named to
it (`serpentFightId`: `day@site`), at most `SERPENT_SITES_MAX` (3) a day, each under its own storage key
(`serpent:<id>`, the ids under `serpents`). An account fights at one site a day in a cell. A fourth site stands only in
the place of one sounded, or of one nobody has a part in and nobody keeps about its waters; otherwise it is refused
*the waters are full*. A slain serpent is never let go while its waters stand open, so an `in` that missed the hub's
word finds it slain, never a new one at full health (AUDIT SERPENT 2 F6). A socket whose `in` named a site hears that
site's fight alone (a ship refused a seat still watches it); a fighter hears its own; any other socket hears every
fight within `FAN_R`. AUDIT SERPENT 2 F1: **every word a fight fans names its site** (`sx`/`sz`), and a client folds
its own site's alone (`net/serpentLink.js`) - so a socket of a client's in another cell (a halo), hearing a forged
site's fight by its pose there, never folds it into the client's own; S1's "no other fight about the pose", which could
not see another cell, is gone.

**The brain** (`net/serpentBrain.js`) is pure law: no clock of its own, an `rng` handed in, no I/O. The relay
(`server/src/index.js`) owns the sockets, the alarm, the storage and the receipts:

- **The beat** steps it every `SERPENT_TICK_MS` (250 ms) on the cell's alarm. The cell's own duties (the raids, the
  rite, the world's memory) still run every `SERPENT_REST_MS` (5 s) and on their own firings. The alarm is the
  sooner of the two (`_alarmRest`), and a cell with no serpent keeps its alarm as before.
- **The checkpoint** goes to storage every `SERPENT_CHECKPOINT_MS` (2 s) while the fight is stepped (at once on a join,
  the kill, the hub's answer and the sounding; a slain or sounded fight is still and not written again - AUDIT
  SERPENT 2 F8) as plain numbers and strings, so a woken
  object steps on as the one that slept. Its attack numbers are carried `SERPENT_WAKE_SEQ` (50) past the checkpoint's
  (`serpentWoke` - S9), so no client takes a new attack for one it already lived through. The fight is forgotten
  `SERPENT_KEEP_MS` (2 h) after its dive.
- **Its words** reach the sockets that hear it (above) - its fighters and a watcher on a headland within `FAN_R`
  (3000 m).
  The words are: the whole state `st` (to a joiner), a swim leg `sw`, a depth `dv`, an attack `atk`, health `hp`, a
  phase `ph`, the coil's `coil`/`ch`/`cb`/`cr`/`cx`, the maelstrom `mael`, the kill `fell` (with its damage chart
  `dm`), the sounding `gone`, a refusal `no`, and a receipt `rcpt`.

**The join** (`in`: the day, the client's brain law `bv`, its level, the hull of its own ship, at her helm or on her
deck (`hl`, -1 aboard none of its own - B4/H2), and the site). The level is never above the token's own character
level (`cl` - E4). A later `in` claiming a bigger hull takes the old share out and brings the new one in at the
fraction it stands at, its bucket empty; the level stays the first claim's. Only an `in` from within `ENGAGE_R` counts
as being at the fight (S8) - a newcomer's too: one whose first `in` is from farther joins with her share out of its
health, and the first beat that finds her at the fight brings it in (AUDIT SERPENT 2 F5). The relay refuses:

- an older law, with `reload`;
- another day, with *the serpent is gone*;
- a pose past `ADMIT_R`, with *too far from its waters*;
- after 08:00, with *the storm has closed its waters* (a newcomer is shown the fight and refused; a site with no fight
  yet stands none);
- a serpent already slain, with *it is already slain* (B8);
- a full fight (`SERPENT_FIGHTERS_MAX` 128) that frees no idle seat, a fourth site, or an account already at another
  site this day, with *the waters are full*;
- a site in another cell, as junk.

Every other word (`hit`, `wr`, `held`, `esc`) goes to the fight its account fights in here; from an account no fight
counts (a ship refused a seat, her volleys already in the air) it is not heard - never junk (S7). The client never
bars itself on a refusal: the relay's hearing is the one bar, so a ship let in by her next `in` fires and is heard
(AUDIT SERPENT 2 F3 - `SERPENT_BARS` held 'the serpent is gone', said also to an `in` a moment before the rising, and
muted that ship for the day).

**The wreck** (`wr`, T2). Her machine says when her ship wrecks, and when she floats again. A wreck's share leaves its
health; it no longer goes at her; her stood time still counts.

**What a fighter brings and may deal.** Each fighter's hull claim sets both (the gate's law at sea). The hull's
reference broadside a second (`SHIP_REF`: rowboat 0, Large Boat 3.6 - she has no crew to her guns, T6 - Small Ship 10,
Large Galley 13, Carrack 12) sets:

- the health it brings: `SERPENT_TTK_S` (180) seconds of it, at the fight's current fraction for a late ship;
- its damage bucket: refilled at `SERPENT_BUCKET_RATE_X` (1.5) times the reference a second (honest fire measures
  0.25-0.4 of it; at 3 a forged claim had a 12-20 times ceiling - T5), 20 deep, no one blow over 14;
- `SERPENT_HIT_HZ_MAX` (6) words a second.

A share stays in its health only while its ship is at the fight: seen within `ENGAGE_R` in the last
`SERPENT_ABSENT_RETIRE_MS` (45 s), afloat, and - a ship - firing in the last `SERPENT_IDLE_RETIRE_MS` (90 s)
(`serpentShareWanted` - E2/E3). A claim never backed by fire no longer makes it tougher for everyone; it comes back, at
the fraction it stands at, with her next blow.

A blow is believed only from where the socket's own pose stands: within `ENGAGE_R` (900 m) plus slack, and within a
gun's reach (`GUN_REACH_M` 300 m) of something of it above the sea. A hand aboard another's ship brings and deals
nothing with guns it does not have.

**Its mind.**
- It surfaces and circles for `SERPENT_OPENING_MS` (10 s) before it strikes.
- It goes at the ship with the most threat `SERPENT_THREAT_PICK` (60%) of the time, otherwise a random one. A ship is
  always picked over a hand. It goes only at what it can reach - within `SERPENT_TARGET_R` (600 m) of its waters - and
  never at a wreck (E1/T2).
- It orbits its target, its aim kept within `ARENA_R` (420 m) of its waters (its head swims on past that, up to about
  550 m out). A Rising Maw or a coil chosen at a ship beyond the dash its own wind-up swims is closed on at the surface
  first, and a fight whose room slept is taken up circling where it was (SERPENT3, section 15 - it surfaced, leapt,
  once).
- It never uses an attack more than twice running, and leaves out the last one while another is open.
- At 66% and 33% it stands warded for `SERPENT_SHIELD_MS` (4 s) and takes its turn (`SERPENT_PHASE_TURN`), once an
  attack in flight has landed as every screen was told it would (S2):
  - Phase II, The Coil: the Call, then a coil.
  - Phase III, The Maelstrom: the whirl, then the Roar from the eye.

## 7. The client's half - the serpent host

`scenes/serpentHost.js` (`createSerpentHost`). Every seam it touches is in its `deps`, so the whole of it runs in Node
under the pins. Its job:

- **The `in`** is sent once my ship is within `ADMIT_R` of the site, to the cell of its site - never with the sea
  fight switched off, which has no ship to bring (M4). It is sent again every `IN_RESEND_MS` (20 s), or every
  `IN_RETRY_MS` (3 s) while unanswered. A fight alive whose cell says nothing for `SERPENT_HEARD_MS` (12 s) is left and
  asked for again (M5).
- **My balls on it.** The naval host (`scenes/navalHost.js`) adds its exposed segments to the shots' targets as
  `serpent:<segment>`. A ball or barrel of MINE that strikes one gives its gun's own harm (my Guns refit's with it) to
  `struck`. The targets are made once a frame, at the frame's moment (AUDIT SERPENT 2 F9). The host gathers them for
  `HIT_GATHER_MS` (500 ms) into one `hit` word per zone: the head while it is
  thrown up, a coil while one holds, otherwise the body; a word the socket would not take is said with the next (L3).
  Anyone else's balls are their own machine's to say. Its segments carry their way (`v`, scene m/s), so the guns lead
  it as they lead a ship (T4); they redden the broadside's aim, count as hits in the volley's tally (L2), and count as
  a hostile near, so no rest, no time scale and no yard in its waters.
- **My wreck** is said as it comes and as she floats again (`wr`).
- **Its blows on MY ship and MY feet** (section 5). The hurt goes through the naval host's `serpentStrike` (the deck's
  shake, the line, the hull's mending as any hit's). The spray and the sound of every landing play for everyone.
- **Come Sail Away's two seams:**
  - `warp`, which QUAYS gave the harbour: the naval host's warp answers the coil's hold first.
  - `drift`, new: a world-space velocity added to the sea's current under her, which carries the whirl's pull and a
    blow's throw (`systems/comeSailAway.js` `lateUpdateSailing`).
- **Leaving**: going offline forgets the fight and lets my ship go (`leave`), and the omen stands nothing - no ring,
  no compass mark - until it is ready again (L4). A new serpent day forgets the last fight's attacks, numbered from one
  again (H3); the phase a ship sails in on is not said as if it turned.

**THE FOUR HOSTS RULE.**
- `scenes/world.js` wires it whole.
- `scenes/exterior.js` (the `?exterior` bench: no relay, no packet lanes, no naval host) carries none of it, by
  design.
- `scenes/worldModes.js` (a building's interior: no sea) carries none of it, by design.
- `scenes/dungeonContext.js` (a dungeon's water is no ocean, and no ship sails it) carries none of it, by design.

A player who steps into a building mid-fight keeps their ship's hold; the bar and the blows wait for the street. The
pin `test/serpent1_client.test.js` reads the three and finds no serpent in them.

## 8. The kill - receipts, the books, the hoard

**Who earned it** (`serpentEarned`; AUDIT SERPENT E1/E2, Mac: *"Must be in the fight"*): a ship that dealt
`SERPENT_RECEIPT_SHARE` (10%) of its own share, or anyone who stood within `SERPENT_STAND_R` (450 m) of its body for
`SERPENT_STOOD_SHARE` (half) of the fight. At 2% one volley bought a dealer's hoard, and a boat parked 900 m off, where
nothing of it reaches, stood. The kill is stamped once, with its three best dealers and the damage chart.

**The receipt** (`net/serpentReceipt.js`, version `l1`). Ed25519, signed by the relay's one key (`GATE_SIGNING_KEY`),
the version inside the signed bytes. It is refused by the gate's (`r1`) and the raid's (`w1`) verifiers, and theirs by
this one. Its claims are:

- `d` the day, `b` the serpent, `s` the account;
- `c` the hoard's seed (32 bits of the relay's CSPRNG);
- `x` how it was earned: `dealt` or `stood`;
- `h` the hull it fought from, `l` the level it was admitted at;
- `i` issued, `e` expiry: a week.

It goes to each earner's socket at the kill, and again at their next `in` while the cell keeps the fight. The relay
then tells the hub (`/internal/serpent/fell`, retried every 5 s until it answers) the kill, its site and every receipt.
The hub keeps each account's latest receipt (`serpentrc:<account>`, never over a newer day's, forgotten once expired -
by its hello or the sweep) and hands it at once to the newest socket of every earner its cell did not hand it to, and
to the account's every hello while it is good (AUDIT SERPENT S5: a fighter away from the cell at the kill had lost it).
It keeps the day's kills one a site (`serpentfells`, `SERPENT_FELLS_MAX` 8) and says each to every socket online and
to every hello while its day holds - never an older day's than it keeps, never once its day is over (S12). A client
hears its own site's.

**The books** (`server-account/src/serpents.js`, migration `0081_serpent_kills.sql`, `ACCOUNT_VERSION` acct78,
route `/v1/serpent/claim`):
- The session is the claimant, never the body.
- Each kill is one row per (day, account) in `serpent_kills`, paying the character that fought it
  `RENOWN_SERPENT_QUESTS` (6) quests' Renown at the top quest level, twice a town defended - a receipt earned by
  standing, `SERPENT_STOOD_RENOWN` (half) of it.
- A level that rose comes back with a signed order for the rooms.
- A guest is not counted, but is given its hoard once.
- The account card and the inspect answer say `serpents: { slain }`, and the game says it: the account card's
  *Serpents slain* row, and the inspect card's line (D4).
- **SERPENT-SET (2026-10-05, acct84).** The row says the embers its hoard paid (`stones`, migration
  `0083_serpent_embers.sql` - `SERPENT_EMBERS`, `net/serpentHoardLaw.js`; 0 for every row before it, whose hoard paid
  none), and the insignia's purse and its sale read ONE sum of a breach's and a serpent's (`accounts.js`
  `EMBERS_EARNED_SQL`), so an ember won at sea buys at the Broker's insignia counter as a breach's does. And the kill
  strikes its SILVER - a combat faucet now (`server-account/src/marks.js` `serpentStrikeStatement`, in the row's own
  batch and only while THIS claim's row stands): 40 silver, a ship that stood half of it (the serpent's own Renown law),
  under the day's one combat cap of 150 with the gates and the raids (`src/net/marksLaw.js` MARKS_COMBAT), its line
  `serpent:<day>`; the route answers it as `marks` where it recorded, and the game says it as a raid's is (the claim's
  `onMarks`, the haul card's "Serpent slain"). The hoard's law is a file of its own because the relay bundles
  `net/serpentLaw.js` and hashes its graph: a constant written there would have been a relay deploy. AUDIT 625 P4: the
  row's embers are what the CLAIM says its build's hoard mints (`stones` - every row had counted SERPENT_EMBERS, so a
  build from before the embers, whose pack was given none, put one in the purse), and the answer says the row's, a
  repeat's too, as a gate's does (section 11).

**The hoard** (`systems/serpentSpoils.js`, rolled on the receipt's seed so every crew's is its own):
- gold: `SERPENT_SPOILS_GOLD_PER_LEVEL` (160) a level, the seed varying it a fifth either way;
- a ship that **dealt** also gets one piece Rare or better (Legendary 15% of the time) and one Magic or better;
- a ship that **stood** gets the Magic-or-better piece alone and `STOOD_GOLD` (60%) of the gold;
- SERPENT-SET (Mac: *"The serpent boss needs to use the currency from oblivion gate and have its own equipment
  rewards"*): every hoard, dealt or stood, carries the gate's currency - `SERPENT_EMBERS` (one) Deadlands Ember, minted
  as a breach's (`systems/gateSpoils.js` sigilStone) and taken by the ember's own door, so a first ember won at sea
  brings *On the Burning Doors* as a breach's does; and a ship that dealt finds a piece of **Sethrakul's Coilscale** -
  the serpent's own Aetheric set (`Sigil-Sets.md` section 6c) - a quarter of the time, rolled after everything above so
  every earlier hoard is what it was for its seed.

Every piece is known, and the ladder's last pass is applied (LOOT2). It is rolled at the level the fight admitted (the
receipt's `l`), never past the standing character's own (D2). It is given when the service says this claim's device
holds the (day, account)'s hoard row (`serpent_spoils`, the raids' AUDIT RAID R4 law), so a second browser or a phone
is answered no. It goes straight into the pack through a spoils pool under its own keys, and rides the crash's records
until a save holds it (a slot loaded lets them go - D5). The device carries the receipt (`net/serpentClaims.js`) with
the character that fought it - at most `SERPENT_CLAIMS_MAX` (24), fewer than the pool remembers spent (D3) - until the
service settles it, and settles it only once its hoard's grant has resolved (D6).

## 9. What a player sees and hears

**The body** (`render/serpentRender.js`, `SerpentRenderer`). Two foreign passes on the world host:

- **The body**, with the opaque world before the sea's top. A tube swept along the 25 spine points (Catmull-Rom,
  parallel-transport frames, four sub-rings a segment, a flattened twelve-sided section), with the snout's cap, a
  dorsal sail, horns, eyes and the venom's glob. Its hide is banded, with a darker skull and a pale belly. It is lit as
  the frame is and fogged by `FOG_GLSL`, with the travel view's focus and the deep's fog. The sea's surface over it
  hides what lies under.
- **The sea's marks**, after the sea, premultiplied: each attack's shape filling toward its landing, the maelstrom's
  spiral, and the venom's pools.

The naval host's spray answers its landings (`serpentFx`): the breach's column, the lash's sheet, the ram's bow wave
and the venom's spatter.

**The bar** (`ui/serpentBar.js` `serpentBarModel`) is the gate's boss bar in the sea's colours:

- its name over its title, its health with the two phase marks cut in it, the phase's name, the ward;
- the attack it winds up, named in its colour with a line filling to the landing, and **MOVE** when it is laid on my
  ship; its stun, counting down (*"Stunned - strike its head! 9s"*);
- the coil's health (*"Its coils hold YOUR ship"* on the coiled ship);
- the ships in its waters - afloat and at the fight now (B7);
- the countdown to its dive inside its last five minutes (*"It dives in 4m 59s"*), pulsing in the last one.

After the kill the bar holds a moment and fades.

**Its voice** (`systems/serpentSounds.js`). DAGGER.SND's own records, with no new clip and no game data in the repo
(Port-Doctrine):
- the Dreugh's bark (the Bay's own sea-thing) pitched down an octave and more, for its roar (heard 3.2 km off) and
  its death cry (4.2 km);
- the Lamia's hiss for the spit and the coil;
- the sea's large splash and bubbles (`NAVAL_CLASSIC`), deep and loud, for the breach, the lash and its dives.

## 10. Trust and its bounds

- The relay believes a blow only as far as the fighter's claimed hull allows (the bucket, the cap, the rate), and only
  from where its own pose stands. A hull claim can be a lie: the health it brings grows with it, and its bucket fills
  at 1.5 times its reference, so a forged claim buys a kill some three to six times faster than honest fire, never the
  twelve to twenty of the first numbers (T5). A claim never backed by fire leaves the health after 90 s (E3).
- A forged site stands a fight of its own (one a site, three a day in a cell), folded by no honest client - every
  word names its site (AUDIT SERPENT 2 F1); its kill is said for its own site alone. A squat of all three sites, each
  kept by a ship about its waters or a part, refuses a fourth that day in that cell - the bound left (F6 chose it over
  a lone honest fight torn down and reborn). The account service counts one serpent per (day, account) whatever site it was
  fought at.
- A level claim is never above the token's character level.
- The struck ship's hurts never leave its machine. A client that ignores a blow cheats only itself (co-op's law).
- A receipt is signed. The service verifies it and keys it on the day and the account, never on its seed.

## 11. Versions and deploy order

- **SERPENT3's relay: `world172`** (section 15; `world171` on its branch, renumbered past main's CRYSTAL-FIST at the
  merge). The brain swims every leg it shows and judges a blow where the body lay when it struck; its law's version is 2
  (`SERPENT_BRAIN_MIN`), so a game before it is told to reload. No frame changes shape, and nothing else in the order
  moves: deploy the relay with the client.
- **SERPENT2's relay: `world166`** (section 14). The `serpent` frame's `site` word, said to the hub alone, and
  `net/serpentHerald.js` in the bundle. A relay before it closes the socket on the kind, so a client says it only to a
  relay that welcomed it with 166 or later (`serpentSiteOk`). Nothing else in the order moves: the service is untouched.
- **The relay: `world165`** (world162 on its branch, renumbered past main's PRIMARCH (world162) and SUNBABY1 (world163), then past PARTY-LEAD (world164), at the merges). The `serpent` frame (`net/wire.js` `validSerpentIn`, `validSerpentOut`,
  `SERPENT_RELAY_MIN`). `serpentLaw.js`, `serpentBrain.js`, `serpentBody.js` and `serpentReceipt.js` join the bundle.
  A relay before it closes the socket on the frame, so a client sends one only to a relay that welcomed it with 165
  or later (`serpentOk`).
- **The account service: `acct78`** (acct75, acct76 then acct77 on its branch, renumbered past main's HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges). Apply migration `0081_serpent_kills.sql` (0078 then 0079 on its branch, past main's FOUNDER4 `0078_founder_links.sql`, KNIGHT-HOUSE `0079_home_deed.sql` and HOME-VENDOR `0080_home_vendors.sql`), then deploy (the deploy's path filter
  carries `src/net/serpentReceipt.js`). Before acct78 the route answers nothing and a receipt waits on the device for
  its week.
- **SERPENT-SET's account service: `acct84`** (with SILVER-FINDS; `acct83` on its branch, renumbered past CRYSTAL-FIST's acct83 at its merge of main). Apply migration `0083_serpent_embers.sql` (a
  serpent's row's `stones`, the embers its hoard paid, which the insignia's purse counts with a breach's), then deploy -
  the deploy's path filter carries `src/net/serpentHoardLaw.js` (SERPENT_EMBERS) as it carries the receipt. The relay
  is untouched: it never reads the hoard's law, and its version stands (`world166`). AUDIT 625 P4: the row counts the
  embers the CLAIM says its build's hoard mints (`stones`, at most SERPENT_EMBERS - `net/accountClient.js`
  claimSerpentReceipt), so a build from before them, saying none, is counted none; the answer says the row's embers,
  as a gate's claim does (AUDIT WB12d A1).
- **The order:** the relay first (it signs), then the service (it counts), then the client. A client on an older
  relay sees the omen and no fight. SERPENT-SET: the service's migration and acct84 before the client too - a client
  of SERPENT-SET's claiming of a service before acct84 would mint an ember into the pack that no purse counts.

## 12. Not done, and why

- **The classic region page draws no ring**: the held map, the chat and the compass carry it.
- **No new audio file**: its voice is the game's own records, pitched and placed.
- **Seen in Node, not in a browser.** The renderer's builders, the host, the brain and the relay are pinned in Node;
  the passes have not been looked at in Chromium. Its first sighting on the live relay is its first look.
- **The audit's accepted residuals** (`01-Overview/Audit-Sea-Serpent.md`): the first site's lane walk may hitch one
  frame at the sighting; a video that holds the frame leaves the boss bar as it was (the court's own gap).

## 13. Records

- `test/serpent1_law.test.js` (22): the schedule and its words, the body, the brain - every refusal, the bucket and the
  one-blow cap, the phases, the coil, the end, the checkpoint, the swim.
- `test/serpent1_relay.test.js` (10): the receipt, the wire, the relay's join, refusals, blows and kill, the hub's word
  at a hello, the cell's other duties under its beat, the books and the Worker.
- `test/serpent1_client.test.js` (16): the site, the link, the strike, the sighting, a kill its site's, the host end to
  end against the relay's own brain (the `in`, the volleys, a blow, the coil held, broken, lost and slipped, the whirl,
  the venom, the bar and the draw), the renderer's builders, the bar, the voice, the hoard, the map's ring, and the
  four hosts' wiring.
- The audit's pins: `test/serpent1_audit.test.js` (12, the brain), `test/serpent1_auditrelay.test.js` (6, the relay and
  the hub), `test/serpent1_auditclient.test.js` (7, the host, the omen, the render, the claims, the cards, the words and
  the wiring) and `test/serpent1_auditbooks.test.js` (6, the books lens's own); AUDIT SERPENT 2's
  `test/serpent1_audit2.test.js` (9 - the site on every word, one timeline, no bar, a landing on its moment, a far
  newcomer, the slain and the lone ship kept, the ram's reach, the still fight unwritten, the targets once a frame).
- Mutants: `tools/mutants/serpent1.json` (43), `tools/mutants/serpent1_audit.json` (149 - eleven re-aimed by AUDIT
  SERPENT 2, six retired with the code or law it changed) and `tools/mutants/serpent1_audit2.json` (14), all dead.
- SERPENT2's: `test/serpent2_herald.test.js` (13 - the herald's law, the `site` word, the hub with Discord stubbed, the
  client's word, the Timers rows) and `tools/mutants/serpent2.json` (49), all dead.
- SERPENT-SET's: `test/serpentset.test.js` (12 - the Coilscale's law, records, drop and powers, the hoard's embers and
  piece, the one heal, the host's doors and the claim's silver lines) and `test/serpentset_service.test.js` (8 - the
  row's embers, the insignia's purse and sale, the serpent's silver under the combat cap, the switch and the guest, the
  deploy; AUDIT 625 P4, the embers the claim says, and P5, the claim in production's shape);
  `tools/mutants/serpentset.json` (48), all dead.
- AUDIT 625's (`01-Overview/Audit-625.md`): `test/audit625_serpent.test.js` (6 - Shed Skin and a saved death, the duel's
  one word and an arena bout between players, a coil per foe, the claim's embers, the powers on minted pieces, the
  card's source and the embers' tier) and the AUDIT 625 records of `tools/mutants/audit625.json`, all dead.
- SERPENT3's: `test/serpent3.test.js` (12 - section 15) and `tools/mutants/serpent3.json` (46), all dead; five records of
  `serpent1.json` and `serpent1_audit.json` re-aimed by content (the stray's once is the resume's now).

## 14. The herald and the timers (SERPENT2, 2026-10-04)

The owner, once SERPENT1 was live: *"So this also shows in the pause menu timer?"* - it did not - and then *"This needs
to happen, the discord integration needs to happen"*. Both are the gate's own features, given to the serpent.

**The Timers window** (`systems/eventTimers.js`, `ui/enhancedTimers.js`). The serpent has its own kind, `serpent`, after
the gate's, marked in its ring's colour (`SERPENT_RING_MAP_CSS`). Its row follows its day:

| Phase | Row | Counts to |
|---|---|---|
| quiet | *Sethrakul rises* - "The harbour bells ring 15 minutes before" | the rising |
| omen | *Sethrakul rises*, off its port - "The harbour bells are ringing - its waters are ringed on your map" | the rising |
| rising, hunt | *Sethrakul hunts* (live), off its port - "A storm closes its waters when this runs out - sail out to join" | the storm |
| late | *Sethrakul's waters are closed* (live), off its port - "It dives when this runs out" | the dive |

Once it is under way, *Next sea serpent rises* stands beside it. A kill ends its row early (the host hands the kill
of this machine's own site). The port is named from the bells on, as the chat names it (the omen's `site.near`).

**The herald** (`net/serpentHerald.js`, the hub's `_serpentHeraldBeat` in `server/src/index.js`). DISCORD-GATES' law
at sea (`World-Bosses.md`, the herald), posted to the gate's channel through the gate's webhook
(`GATE_DISCORD_WEBHOOK`, a Worker secret). Two posts:

- **The bells**, at their instant - fifteen real minutes before it rises - or late while it has not risen yet, never
  after and never twice. They ping `SERPENT_DISCORD_ROLE` when the operator names one (a var in
  `server/wrangler.toml`, empty by default), else the gate's role; that role is the only mention Discord may make.
  *"**Bells ring in the harbours: a great serpent is sighted off Sentinel.** Sethrakul, the Old Coil, rises in 15
  minutes (15:17). A storm closes over its waters at 15:32 - no ship can join after. One ship alone cannot bring it
  down: sail out together."* The times are Discord's stamps, drawn in each reader's own clock.
- **The kill**, once a serpent day while it is news (until fifteen minutes after its last dive). It names its port,
  its top dealers and how many more fought, and pings nobody.

**Where it lies, and which kill.** The relay holds no map, so the site is the players' word, as the gate's is. Each
online game finds the site of the serpent the clock is about from its quiet on (`serpentOmen.ahead`) and says it to
the hub once a socket and day: a `serpent` `site` word with its day, its native point to the whole unit and the port
it lies off (`net/online.js` `sendSerpentSite`). The hub keeps the accounts' vote by the gate's law (`foldGateSite`:
one word an account a day). A site is named once two accounts agree (`GATE_SITE_AGREE`), and the most accounts win.

A cell keeps a fight for every site named to it, a forged one too (AUDIT SERPENT S1). So the channel hears the kill
**at the agreed site alone**, read off the hub's own kept kills (one a site). A forged site's fight never reaches
it, however it ends. Until a site is agreed, the bells say "on the packet lanes" and a kill waits, looked at again
every `HERALD_RETRY_MS`. A post Discord does not take is posted again `HERALD_RETRY_MS` on; one it refuses for good
(a 4xx but 429) is given up, as the gate's is.

The bells arm the hub's alarm from the first hello (`_serpentHeraldArm`). The alarm's beat runs the gate's herald,
then the serpent's. Each keeps its own state (`herald`, `sherald`) and its own site record (`gatesite`,
`serpentsite`). With no webhook nothing is posted and nothing of the herald's is kept.

## 15. It never leaps (SERPENT3, 2026-10-05)

Mac: *"the serpent world boss teleports. Nobody has beat it yet."* Mac's call for who can beat it: *"Two or more ships"* -
its blows ease when fewer than three ships fight it, so a pair has a real chance; one ship alone still cannot.

**It teleported, on purpose.** Four moves of the brain placed its head somewhere new and laid the whole 168 m body
behind it in one frame, seen through the water (the submerged body is drawn darkened, not hidden): the Rising Maw (a
median 195 m), the coil's winding (120-180 m, up to a kilometre), the Maelstrom's turn (230-480 m, onto its round at the
waters' heart) and the stray's surfacing (a median 384 m, whenever its head passed 620 m out - ships fighting from the
edge of its waters did it). In twenty simulated fights, 2.3 a minute; a client a wire's time behind saw them as its only
great snaps, beside the ram's run said a beat late (8.7 m). (Those counts are SERPENT3's own scratch harness, which never
reached the tree. AUDIT SHIPS D12 re-ran the S1 pin's harness on the base and found the same order: 1.55 leaps a minute,
a Maw's median 259 m, a coil's up to 869 m.)

**Why nobody beat it.** The teleporting Maw was the fight: a breach under a 42 m hull 3.2 s after it was cast, wherever
she was within 320 m, cannot be sailed out of. In a combat simulation against the relay's own brain (galleons circling
its waters and firing, every attack judged by the struck machine's own law - `tools/serpentFleetSim.mjs`, run with
`--root` on the base, 4ceb14a6) it did most of the hurt, and fleets of three or fewer won none of 144 fights at the
gunnery measured (25-38% of balls striking), at the old ways and the new (8 and 13.3 m/s). SERPENT3's scratch copy of
that harness had found one win in the 144, three galleons at 38% (AUDIT SERPENT T1's "three ships half the time"
predates F7's shorter ram - section 5). Its jumps wasted volleys in flight too, and the relay judged a blow by the body
at its word's arrival - a gathering and a wire after the ball struck.

**The law** (`net/serpentBrain.js` - DECLARED; `net/serpentBody.js`'s legs unchanged):
- **No leap.** Every leg is swum from where the last left its head (`legFrom`); the rising's first leg is its only `j`.
- **The dash.** A Rising Maw dashes for its mark under the sea and a coil for the round it closes about her - a turn of
  `HUNT_TURN_R` (30 m) and a straight (`wayOnto`, Dubins's), at `DASH_V` (the ram's run, 34 m/s) at most: the Maw's last
  `BREACH_LEAD_MS` swum up at `CRUISE_V`, bursting where its word says - a way its wind-up could swim at a cruise is swum
  at the one pace that fills the wind-up, rise and all (AUDIT SHIPS B4: risen early, its head rode on past her mark, and
  a Maw at a ship 8 m ahead burst 27 m past her); the coil meeting its round tangent and going round her
  counter-clockwise at `DRIFT_V`, as the coil lies, its bearing its head's at the landing, and the coil drawn turning
  with its head (`serpentBody.js` `coilAngleAt`), held where it lets go (AUDIT SHIPS B6: going round clockwise, its body
  lay across the ring from the coil's and swept over her ship as the coil wound on, and again as it let go).
- **It leads its marks** (AUDIT SHIPS A1 - `serpentWayOf`, `serpentLeadOf`). Each ship's way and turn are read off her
  own poses' send times (the pose's `ts`, which the relay hands on - never the wire's timing), eased over
  `SERPENT_WAY_EASE_MS`, at rest past `SERPENT_WAY_STALE_MS` without a pose or past `SERPENT_WAY_MAX_V` (a warp). A
  Rising Maw, a coil, a spit and the tail's sweep are aimed where she will be as they land, along the round she sails,
  never led past `SERPENT_LEAD_MAX_MS` (9 s); the ram's lane where its run will meet her (led again by its run's own
  time, `RAM_LEAD_STEPS`). Aimed where she stood, a ship under SAIL-FREE's full sail had sailed out of every mark before
  it landed, and a lone galleon won every fight from 15.5 m/s. A helm that turns or slows as the telegraph shows still
  sails out of it: that is a telegraph's use.
- **Closing.** A Maw or a coil chosen at a ship beyond the dash its own wind-up swims (`dashFits`) is not begun: it surges
  at her ON THE SURFACE at `closeV` - `CLOSE_GAIN_V` (8 m/s) over her own way, `CLOSE_V` (20 m/s) at the least and
  `DASH_V` at most - on `HUNT_TURN_R`, where the guns reach it, aimed where its surge will meet her, and begins it the
  beat she lies within it, its telegraph its own length; she outsails it `SERPENT_CLOSE_MS` (12 s) and it chooses again.
  (AUDIT SHIPS A1/D5: at a fixed 20 m/s - "the galleon's best is 16", true in the rated wind alone - SAIL-FREE's ships
  outsailed every surge: a Carrack circles at 21.2 m/s in a 2 m/s wind, and in a storm a ship makes twice her rated
  best.) A ship inside the round it would turn on to face her is run past, straight, until she can be turned onto
  (`closeAim`) - on its cruising turn it circled a still ship and never faced her. A wind-up left to wait for a long dash
  gave every moving ship ten seconds to sail clear: in the simulation a lone galleon won ten fights in twelve.
- **A wind-up stretched, never shortened.** A swim longer than its attack's wind-up (the whirl's, its eye drawn in from
  far out) makes it wait - swum on the surface; it sounds for its own wind-up alone.
- **The Maelstrom forms where it swims** - its eye `MAEL_ORBIT_R` to its left, as the whirl turns, drawn in so its round
  lies inside its waters - and it swims onto that round and circles it, rearing as it forms. Drawn in so near that no
  turn and straight meets it, it turns on `HUNT_TURN_R`, to whichever side turns it less, until the round to its left
  lies in its waters (`maelTurnToFit` - AUDIT SHIPS B3: the round about its head where it stood lay out of them on a
  seventh of the third phase's turns, its eye up to 437 m out).
- **Said ahead.** Every attack's whole swim and ride are said in the beat that begins it - the ram's turn, crawl, run
  and rising, the Maw's dash and burst, the coil's dash and round, the whirl's round and rearing - and a dash or the
  ram's turn begins `SERPENT_SAY_AHEAD_MS` (500 ms) after it is said, its head keeping its way meanwhile, so every screen
  holds the word before the head takes it. AUDIT SHIPS B5/D2: so is every other turn of its own - a change of pace, the
  cry's and the roar's rearing, an attack's ride, the coil's winding on (the coil frame's `w`) and its letting go
  (`off`), the kill's throes and the sounding's dive. Said at the beat, they snapped a screen 150 ms behind: 3.6 m on a
  kill mid-dash, 1.4 m on a closing surge, 8.5 m up or down on a ride. AUDIT SHIPS 2 (2026-10-06): and every leg of its
  steering, judged from where its head will be then; its closing surge is swum as its dashes are (`closeOn` - a turn of
  `HUNT_TURN_R` and a straight at where it meets her, laid again only when its straight no longer runs at her, where
  steered as it cruises it swung 30 degrees each side of her every 1.25 s); and an end (the throes, the dive, a coil's
  letting go) is laid from its own moment alone - nothing said before it unsaid, since a blow is judged between beats
  (B5's `holdNow` held the swim from the blow and unsaid a dash a lagging screen had begun, 3.2 m at 250 ms). A screen
  any wire's time short of `SERPENT_SAY_AHEAD_MS` behind the relay draws its head where the relay does, to the
  millimetre (measured at 150, 250 and 450 ms over whole fights, ships at 26.5 m/s).
- **One centre** (AUDIT SHIPS 2). Her word `held` moves a coil onto her hull's middle; its head's round is laid again
  about that centre where the coil drawn has gone round to (`coilRound`), from once the coil holds the whole body, so
  its track moves out of sight - and so is an older law's coil across the relay's deploy. Kept round the mark, the
  body lurched up to 42 m as it unwound.
- **Kept before it is said** (AUDIT SHIPS 2). The relay checkpoints a fight before it says any word that lays its track
  (`serpentSaysTrack`), so a relay restarted wakes it no earlier than its screens hold it (it snapped heads up to 106 m).
- **A slept fight taken up** (`serpentResume`). A fight not stepped for `SERPENT_SLEEP_MS` (5 s) - the relay beats one
  only while someone hears it - circles where its head was from its last beat (a round of `ORBIT_R` toward its waters'
  heart), cruising; the attack it had in flight landed on empty waters; a coil holding a ship keeps its round and its
  clock. Every beat asks it first, and the relay before a joiner's state (`_serpentIn`) and before a word is judged
  (`_serpentFrame`). AUDIT SHIPS B1: a sleep no longer than `SERPENT_DRAWN_MS` (12 s - every screen keeps a fight it no
  longer hears that long) stands as it was said - its attack lands as told and its track is untouched, and a head swum
  out of its waters meanwhile turns home from when its word can reach them. Taken up from its last beat, a dropped
  socket's return threw every screen still drawing it back by up to 148 m. A socket's hello beats its fight again (the
  beat was armed by a serpent word alone). AUDIT SHIPS B7: a fight checkpointed by an older law (a relay deployed
  mid-fight) is stamped (`bv`) and taken up at once, as one long asleep.
- **A blow judged when it struck** (`SERPENT_HIT_LOOKBACK_MS`: 0, 500 and 1000): the body asked at the word's moment and
  back as far as a second - a volley's gathering (`HIT_GATHER_MS`) and the wire - at the latest some of it stood above
  the sea within her guns' reach; its stun and its head's rearing read there too. The relay keeps that second more of
  its track.
- **A pair's share** (`systems/serpentStrike.js` `fleetShare`, `SERPENT_PAIR_SHARE` 2/3): with exactly two ships
  fighting it (the state's `n`) every blow, crush, grip, grind and venom bite lands at two thirds on the struck machine -
  each of a pair takes what each of three would - carried blow to blow in whole points (AUDIT SHIPS C3: rounded a blow at
  a time, a one-man spit took its man every time; carried, thirty spits take twenty). A lone ship, and three or more,
  take the whole: a lone ship eased too (the option's "fewer than three") wins eleven fights in twelve at 50% gunnery on
  a galleon at 17.7 m/s, where Mac's "one ship alone still can't" holds it to none. AUDIT SHIPS C1: the ships fighting it
  are the shares in its health (`serpentShipsFighting` - a warship's share: afloat, at the fight, her guns heard and her
  captain aboard her). It counted every account at the fight whose hull claim, which only grows, was a hull: a lone
  galleon with a rowboat by, or with a friend riding her deck who had sighted it from their own ship, was "a pair" and
  took two thirds, and a true pair with a rowboat by was three and lost its share. A hand off her own ship is no ship and
  is never coiled (`serpentOnShip` - the hull her latest `in` says), a rowboat's wreck is a wreck, and the client says its
  `in` the moment the ship it stands on changes.
- **On the client** the whirl's waters are laid where its word says it forms, and a bow wave rides over its head while it
  dashes under the sea (`dashWake`: sounded, faster than it cruises - the ram's run down its lane among them, running on
  past a ship it struck), a splash at most every `WAKE_MS` (150 ms) of the fight's clock (AUDIT SHIPS C4: one a frame
  held the particle budget full, and the guns' spray was evicted first).
- **Its law's version 2** (`net/serpentLaw.js` `SERPENT_BRAIN_V`, `SERPENT_BRAIN_MIN`): a game before it - one that draws
  the whirl at the heart and takes a pair's blows whole - is told to reload, and is not heard, nor gone at, until it has
  (AUDIT SHIPS C2: told, it fought on).

**Measured after** (AUDIT SHIPS: the balance by `node tools/serpentFleetSim.mjs --grid`, twelve seeded fights a cell;
the rest held by `test/serpent3.test.js` and `test/auditships.test.js`): no leap in any fight; every Maw and coil cast at
its own wind-up, bursting on its mark and closing on its round. SAIL-FREE's ships circle at 0.819 of their best: a
galleon at 13.3 m/s in the rated wind and 17.7 in a 2 m/s one, a Carrack at 15.9 and 21.2, and in the sea's strongest
wind a galleon at 26.5 and a Carrack at 31.8. At 38% of balls striking (AUDIT SERPENT's measured gunnery) a lone galleon
never wins at any way up to 26.5 m/s, and wins two fights in twelve at a Carrack's 31.8 in a storm. A pair wins six in
twelve at the old 8 m/s, ten at 13.3 (two without its share), eleven at 15.9 and every one from 17.7. Three and five
win every time, in ten to eleven and a half minutes. At 50% a lone ship wins from 21.2 m/s: two in twelve, four at
26.5, nine at 31.8 (Mac's call, open - `01-Overview/Audit-Ships.md`). At 25% a lone ship never wins, a pair at most
three in twelve, three up to six and five six to eleven.

**The relay:** `world172` (section 11). **Pins:** `test/serpent3.test.js` (12) and the SERPENT1 and AUDIT SERPENT pins it
moved - the stray's surfacing for the resume's, the Maelstrom at the heart, a late ship's words, the first strike's
time; `tools/mutants/serpent3.json` (45, all dead - its ram's-doubled-wake record went with the ram's own wake, AUDIT
SHIPS C4). AUDIT SHIPS (`01-Overview/Audit-Ships.md`): `test/auditships.test.js` (20) and
`tools/mutants/auditships.json` (73, all dead).

See also: `World-Bosses.md` (the gate, whose law this follows at sea), `03-World/Naval-Combat.md` (the guns, the
hull and the seams it reaches).
