# Breach Portents - the Vanguard, the Sundering and the Warden's new arsenal (WB14)

> Design page, written 2026-10-19 before the arc's first slice. The gate it builds on is `World-Bosses.md` (Dagon's
> Breach - the Burning Court, Valkynaz Ruhn, his marks, his host, his Reckoning); this page names only what it adds and
> what it moves. Where the page and a shipped slice disagree, the slice's own record (section 12) is what runs. A path
> under `src/` is written without it (`net/gate/gateBrain.js`), as `World-Bosses.md` writes them; the relay's and the
> account service's from the repository root (`server/src/index.js`). AUDIT WB14 (2026-10-20,
> `01-Overview/audits/Audit-Breach-Portents.md`): six cold lanes read the arc whole; what they changed is written into
> each section below, marked `AUDIT WB14` with the finding's id.

## What Mac asked for

Mac, 2026-10-19:

> *"I want to talk about enhancing the oblivion gate structure, adding the chance of a gate to spawn with platforms of
> wave based adds that need to be defeated before encountering the boss. More diabolical boss movesets. More unique,
> but not super hard mechanics. Like the boss splitting and players having to split and navigate to beat both sides and
> then merging at the end for its final stand (chance based encounter modifer). And whatever else you can cook up"*

Offered a sketch - portents beside the marks, the Vanguard, the Sundering, seven new moves, three extras - and six
questions (the odds; announced or a surprise; the Wrath's clock; the Sundering's failure; one blow answered by turning;
which extras and what they pay), Mac answered: *"This is all yours to take on. Be as detailed as possible and treat
this like your baby. Take your time and be thorough"*. Every decision below is this page's, argued where it is made.

## The six answers

1. **The odds - a shuffle bag, over the nights that can carry one.** Every other such night carries a portent, drawn
   from a round of six: the Vanguard twice, the Sundering twice, the Captive once, the Dire Breach (the Vanguard and the
   Sundering together) once. A bag, not dice: dice leave a portent dry for a day and stack three in a row, and the
   province bag (`gateLaw.js pickGateRegion`) already taught the gate that a player who waits should see each one come
   round. The bag is drawn over the gates that are NOT a Legion-Lord night (section 3), so no portent is lost to the
   trial that excludes it: about two gates in five carry one (the Vanguard alone and the Sundering alone each about one
   in eight, the Captive and the Dire Breach each about one in fifteen - measured over 20,000 days), a round spans about fifteen gates - a real day and a quarter -
   and no two gates running both carry one, so a company that just fought one fights a plain night next.
2. **Announced, always.** The omen says the night's portent beside its marks (the chat, the map's card, the marks'
   card, Discord). Mac's own WB9a ask - *"Allow people to see the modifers/trial as a popup before it starts"* - is the
   gate's rule: a fight is read before it is fought. A Sundering said in advance is one a company can plan to split
   for; said nowhere, it would only be a wipe nobody saw coming. The one surprise is the Tithe-Imp (section 9), which
   costs nobody anything when it comes.
3. **The Wrath keeps its clock.** The Covenant seals the breach ten minutes after it opens and tears it shut twenty
   minutes after (`World-Bosses.md` section 19) on every screen, the herald and the omen alike. The Vanguard is sized to
   about two and a half minutes of a court fighting at half its reference damage, the Warden's own fight is unchanged
   in length, and no night is made later - a later Wrath for one kind of night would be one more thing a player has to
   remember, and the slack is there. AUDIT WB14 (PLAY-4): and his health on a Vanguard night is less its Vanguard's (the
   waves' 61 team seconds off his 240 - section 4), so the night costs no more of the clock than a plain one.
4. **The Sundering forgives.** A half brought down KNEELS, and the other has twenty seconds to follow it (the Elite
   Breach's Twin Lords' law, `Elite-Gates.md` 13.3, at its own court-of-one window `EG_TWIN_ONE_MS` - the Twins' fifteen
   is for a company of eight that chose this). A half left kneeling past it rises - AUDIT WB14 (PLAY-1) - level with the
   other, three tenths of its share at most. *"Not super hard"*: the fight asks a court to split; it does not punish one
   that splits badly once.
5. **One blow is answered by turning: the Burning Gaze.** Every blow the gate has is escaped by moving (`World-Bosses.md`
   section 5, "Its attacks - every one telegraphed"). The Gaze is the arc's one departure, named here: it lands on whoever
   is LOOKING at him as it lands, so it is answered by turning the camera away - a different skill, readable at once
   (his eyes blaze white, the screen's rim pulses, "Look away!"), and nothing a step can do. It is never counted by the
   relay (section 10: the relay does not hold a camera).
6. **All three extras, and every portent pays.** The Captive (a knight of the Covenant to free, section 7), the Tithe-Imp
   (section 9) and the Dire Breach (the Vanguard and the Sundering on one night, section 8). A portent night's receipt
   says its portents (`p`), and the spoils roll one more piece of Magic or better for each - two on a Dire Breach - and
   the account service rolls the Weir Key at the rite's odds, a quarter, where a plain kill rolls a sixth (section 11).

## The laws kept

What the gate promises every player, and this arc keeps:

- **The ground shows what lands.** Every new shape is drawn where it lands (`render/gate/gateTelegraph.js`), its fill
  reaching its far edge at the landing, its line in the danger edge (`TELEGRAPH_EDGE`); the pins hold the shader's own
  reading (`telegraphField`) to the strike's law (`net/gate/gateStrike.js`) point for point.
- **Every wind-up outruns its shape from its middle at a run (7.6 m/s), in phase three too** - but the Gaze (answer 5).
  AUDIT WB14 (PLAY-5): the Chains keep their wind-up in phase three (`windupOf`), so a fighter at the rim behind him at
  the rune ring outruns their hold with a reaction's 400 ms too.
  NOTHING GETS FASTER (Mac, WBX: *"I dont think making mechanics faster is the play"*): no existing wind-up, pace or
  cadence moves.
- **The relay runs the fight, the struck screen judges its own feet** (co-op's law, `World-Bosses.md` section 5). What the
  relay can test from the poses it holds it counts (INT11, `net/bossRef.js judgeGate`); what it cannot - a facing, a
  shared blow's count, a pull - is the client's, never counted, in the struck player's favour.
- **The caps stand.** Every blow on any body of the fight - the halves, the Vanguard, the gaolers, the Tithe-Imp - goes
  through the one hand and purse (`spendBlow`, `spendPurse`): the fastest kill is still 75 s of the whole room at the cap.
- **One law, both ends.** The floor, the shapes, the waves' rules and the halves' are pure law in the relay's bundle, read
  by every screen.
- **The hosts do not grow** (HOST-SPLIT). New behaviour is in modules the hosts wire; a host line that changes is edited
  in place.

## 1. Portents - the draw (WB14b)

`net/gate/gateMods.js` gains the third kind of mark beside the aspect and the trials - GATE_PORTENTS, names and numbers:

| id | name | line (the omen's, the card's) | tip (the card's) |
|---|---|---|---|
| `vanguard` | The Vanguard | His vanguard holds the approach. | Clear both platforms to open the way to him. |
| `sunder` | The Sundering | He tears in two at the second phase. | Bring both halves down within 20 seconds of each other. |
| `captive` | The Captive | A knight of the Covenant lies chained in the Pen. | Free the knight to ward off one Reckoning. |

The Dire Breach is no table row: it is the Vanguard and the Sundering together, said as *"Dagon's Breach runs deep."*
before the two lines. AUDIT WB14 (TEXT-2, -3, -5, -10, -12, -13): each tip one order of 60 characters at most, held to the
marks' tips' law and WB13b's scan (the knight's ward no longer "his" - half the Covenant's knights are Dames; "Split up"
was false under four; the Dire line's "tonight" said once, by the marks' line before it).

**The bag** (`net/gate/gateLaw.js gatePortentsOf(day)`): the gates that are not a Legion-Lord night are counted from the
epoch (`gateIndex`, the cycle of marks known for every gate - `gateModsOf`; `carriersBefore` the count before each place
of the cycle, made once). The n-th of them carries none when n is odd; when n is even it takes slot `k mod 6` of round
`floor(k / 6)` of PORTENT_BAG (`k = n / 2`) - `vanguard, vanguard, sunder, sunder, captive, dire` - shuffled on the
round's own rolls (stream PORTENT_BAG_KEY 16, the marks' streams being 12-15). The alternation is the spacing law: two
portent nights always have a plain carrier between them, so no seam check is needed (a round may close on the Vanguard
and the next open on it - two portent nights apart, never two gates). A Legion-Lord night carries none. Pure, the relay's
and every screen's.

**Why never on a Legion-Lord night.** His host (`World-Bosses.md` section 17) is tied to his courts and phases: Harriers
in the first, Sappers walking at him in the second, Ward-Bearers rising wherever he lands. The Vanguard would put two
hosts in one fight and the Sundering two of him for the Sappers to walk at. Either can be argued; neither reads well.

**The fight keeps its portents.** The relay's draw at the fight's birth is kept on it (`f.pt`, an array of ids) and said in
every state (`pt`), as the marks are (`md`) - every screen fights the fight's own, whatever the day's draw would say.

**Said.** The omen's chat line gains the portent's line after the marks' (`systems/gate/gateOmen.js`); the map's card
(`gateTip`) names it in a line of its own under the marks (*The Vanguard · The Sundering* - AUDIT WB14 TEXT-16); the marks' card stands a row for it with its sign, name, line and tip; the
herald's omen post says it (`net/gate/gateHerald.js omenPost`). One sentence each, WB13b's rule.

## 2. The floor plan - every floor the night may stand (WB14b)

The court's floors are one table (`net/gate/gateBrain.js COURTS`, metres in the court frame, all of COURT_R) and the
walkways between them another (`WALKS`, each `{k, a, b}` - its index, the floor it leaves and the floor it reaches):

| floor | where | what | night |
|---|---|---|---|
| 0 | (0, 0) | the first court - the Warden's | every |
| 1 | (-68, -22) | the second court - the Burning Court | every |
| 2 | (-74, -94) | the third court - Dagon's Champion's | every |
| 3 | (-40, 60) | **the Muster** - the Vanguard's second platform | the Vanguard |
| 4 | (-20, 128) | **the Bridgehead** - the Vanguard's first, where its fighters arrive | the Vanguard |
| 5 | (70, -10) | **the Pen** - where the Captive is chained | the Captive |

| walkway | from | to | laid by | night |
|---|---|---|---|---|
| 0 | 0 | 1 | his bound to the second court (WB9b) | every |
| 1 | 1 | 2 | his bound to the third (WB9b) | every but the Sundering |
| 2 | 0 | 2 | the Flame's bound (section 5) - the Rift Way, 76 m | the Sundering |
| 3 | 4 | 3 | the Bridgehead cleared (section 4) | the Vanguard |
| 4 | 3 | 0 | the Markynaz's fall (section 4) | the Vanguard |
| 5 | 0 | 5 | the Warden's wake (section 7) | the Captive |

A night's PLAN is the floors and walkways its portents stand (`nightPlan(pt)`): the first two rows of each table always,
walkway 1 unless the night sunders, and each portent's own. The plan's ROOT is where its fighters arrive - the
Bridgehead on a Vanguard night, the first court on every other.

**One law of the floor, both ends, generalised** (`onFloor`, `clampToFloor`, WB9b's): the root always; each walkway of
the plan as far as it is laid, from a floor that is floor; each floor a walkway laid whole reaches. The walkways' laid
moments are one array (`xa`, by walkway index - WB9b's two and four more; a hole is a walkway not laid), said whole in
every state. A plain night's floor is WB9b's exactly; the pins hold the old answers under the new law.

**Where they stand.** The Muster and the Bridgehead lie south of the first court, off its bridge's line, so the stones
of walkway 4 meet the first court's rim beside the broken bridge and never over it; the Pen lies east; the Rift Way runs
from the first court's north-west to the third's south-east and passes the second court 16 m clear of its rim and 7 m
of its spires' feet. Every one is out of the great tower's window (`world/deadlandsLand.js TOWER_WINDOW` about
`render/deadlands.js SIGIL_TOWER`'s bearing). All inside the wire's GATE_COURT_BOUND (160 m: the Bridgehead's arrival
stands 149.3 m out, its way in 152.7 m).

**What is built.** The court's model, its collider and its braziers are the night's plan's (`buildCourtModel(pt)`,
`courtFloorTris(pt)`, `courtLights(pt)` - a plain night's are WB9b's byte for byte); the Vanguard's platforms keep no rune
ring (that ring is the Warden's, and he never stands there), and their spires and braziers keep clear of their walkways'
openings as his courts' do - AUDIT WB14 (SCREEN-11): and of the night's arrival (`courtOpenings`: the bridge's clearing
at its root, so no brazier stands behind the Bridgehead's way in). The Deadlands' islands keep clear of
every floor of every plan (`floorGap`), so the land is one land whatever the night; its hanging shards stay about the
three courts.

## 3. The Warden's new arsenal (WB14a) - every night

Eight new attacks in ATTACKS (ids 11-18): six of them his to choose in the fight (WB14a), and two his turns' own (the
Sundering's, WB14d). Each chosen one waits a cooldown of its own (`cd`) from its last use - the first from his wake
(OPENING_MS after the fight began: he never opens on one) - needs a court of at least `nMin` living challengers where it
says so, and is weighed in his choice with the old (`w`). None of the eleven before has a cooldown, and `attacksFor`
offers none of the new six without the fight's word (`ctx` - `now`, `used`, `woke`, `n`), so every older pin's answer
holds. The names are read through the text core (L10N4).

| id | attack | phase | the ground | wind-up | lands for | what to do |
|---|---|---|---|---|---|---|
| 11 | **Chains of the Warden** | 1+ | a burning chain from him to one fighter within 14 m of his body, following them | 3.0 s | the chained, 15% + 4, reeled to his feet - then a Ground Slam | run: past CHAIN_HOLD_M (16 m) from him as it lands and the chain breaks |
| 12 | **Dagon's Brand** | 2+ | a 5 m ring under 1-3 fighters (brandCountFor: one for two or fewer, two to five, three from six), following each | 5.0 s | everyone else within 5 m of a branded one, 40% + 10 of his element; the branded, 15% + 4 | the branded run clear of everyone; everyone keeps clear of them |
| 13 | **Shared Torment** | 2+ | a gold 4 m ring under one fighter, following them | 5.0 s | 80% + 20 of his element, SHARED among everyone inside: one takes it all, four take a quarter each | stand together on the marked one |
| 14 | **Scything Wheel** | 3 | two blades from his feet, 16 m long and 3.5 m wide, turning about him 0.36 rad a second for 6 s | 2.2 s | 40% + 12 of his weight, once, to whoever a blade passes over | keep ahead of the blades, or past their reach |
| 15 | **The Burning Gaze** | 3 | none - the screen's rim pulses white | 3.0 s | whoever's view holds him (within 50 degrees of the camera's heading, 60 m): 35% + 10, blinded 2 s | look away from him |
| 16 | **The Unmaking** | 3 | every other one of the court's eight wedges about its heart; then the other half | 3.0 s each | 45% + 12 of his weight | step into a dark wedge; then back |
| 17 | **The Sundering** | his turn (section 5) | an 8 m disc about him | 2.6 s | 45% + 12 | step out of it |
| 18 | **The Rejoining** | his turn (section 5) | a 9 m disc at the first court's heart, where the halves fall back together | 3.2 s | 50% + 14 | keep off the heart |

AUDIT WB14 (RECORD-4, PLAY-8): the last two rows' shares are as built (they said 30% + 8 and 45% + 12, never the code's),
pinned now; and the Brand is *Dagon's Brand* everywhere it is said (TEXT-7 - its orders, the bar, every language).

| attack | cooldown | needs | weight | the relay counts it |
|---|---|---|---|---|
| Chains | 22 s | a fighter within 14 m of his body | 1 | no - a pull (`relay: false`) |
| Brand | 28 s | 2 in his court | 1 | no - his element |
| Torment | 28 s | 3 in his court (AUDIT WB14 PLAY-3) | 1 | no - his element, and a count it does not hold |
| Wheel | 30 s | - | 1 | yes - down its turn, as the charge down its lane |
| Gaze | 35 s | - | 1 | no - a camera (`relay: false`) |
| Unmaking | 45 s | - | 1 | yes - its lit wedges |

AUDIT WB14 (PLAY-3): the Torment asks three. Shared between two it was 43% of a fighter's health each at level 30 (48% at
10), unanswerable, and a pair died more than any court of another size - 1.6 deaths a fighter in a fight against 0.5 for
four (the PLAY lane's bots, dodging); at three a duo's deaths fell to 0.4 and no other size moved. AUDIT WB14 (LAW-10):
the Chains are never begun at a fighter past their hold from his centre (Colossal's larger body reached 16.25 m with a
range measured past it); (LAW-11) the Unmaking's cooldown counts from its first cast, its echo the same Unmaking; (LAW-6)
a half's kit is its choice before the run's law, so a half repeats an attack as he does.

**The phases now.** The Warden - blade and weight: the Cleave, the Slam, the Charge and the Chains. The Burning Court -
fire and reach: the Leap, Hellfire, the Meteor, the Nova, and the Brand and the Torment, which are the fire's own
questions of a court (spread out; gather in). Dagon's Champion: the Spokes, the Wheel, the Gaze and the Unmaking beside
the Reckoning. Dagon's Favoured (WB8b) brings the Brand and the Torment a phase early as it brings Hellfire
(FAVOURED_PHASE).

**Chains.** A path from him to the chained (the telegraph's `path` pool - dashes flowing to him), drawn to where this
screen sees them now, in his blow's colour while they stand inside CHAIN_HOLD_M and the safe edge's past it. At the
landing the RELAY reads the chained fighter's pose (the attack's `who`): inside CHAIN_HOLD_M and POSE_SLACK (3 m - the
relay errs toward the Slam, which strikes at his feet, never at theirs), a Ground Slam is queued; past it the chain
breaks and nothing follows. The chained player's own screen judges its own feet against the hold: inside it lands the
15% + 4 and pulls its body toward him (the motor's blow push, `player/motor.js blowPush`, the TELL6e law) - a push of
`sqrt(2 * BLOW_PUSH_DECAY * d)` carries it `d` = to CHAIN_PULL_TO_M (4 m) of him, CHAIN_PULL_MAX_M (12 m) at most, in
1.4 s at the most. The Chains' span and recovery (150 ms and 1.0 s) and a turn's breath put the Slam's word 1.3 s after
the landing and its landing 2.9 s after (phase three: 2.58 s), so a reeled fighter has a second and more to run the 3 m
out of its 7.

**Brand and Torment follow their fighter.** Their rings stand where the marked fighter stands NOW on each screen (the
online frame's own places of the others - `scenes/gate/gateCourt.js stepsIn` fills them each frame), and at the landing
each screen judges its own feet against them (`net/gate/gateStrike.js` brandOn, tormentShare): the Brand's burst within
5 m of any OTHER branded fighter, the Torment's share by the count inside its ring as that screen sees it (itself
included). The relay names the marked by their peer id (the atk word's `pk` - the relay's bodies carry it, `id`) beside
where they stood at the word (`tg` - the ring a screen draws for one it cannot see). Both are his element's, so the
saving throw answers them.

**The Wheel** is the Spokes' grammar with two lanes, turning: the ground draws the blades where they are at every frame,
lit through their whole turn; a blade's verdict is the charge's (`wheelStrikes` - it strikes as it passes, between the
frame before and this one; a slow frame still sweeps what it missed) and the relay counts it the same way. Which way it
turns is the attack's own number's (`i` odd, sunwise): nothing more on the wire. The blades sweep 124 degrees each; at
their tips (16 m) they move 5.8 m/s, under a run. AUDIT WB14 (SCREEN-6): a blade strikes the capsule it is drawn as -
its side to its length, its round tip past it (`wheelSlack`; the side's slack reached 0.68 m past the drawn tip), and no
body disc at his feet past the blades' roots (Colossal's was struck and never drawn); (SCREEN-7) the callout on my feet
stands the whole of its turn - a spot a blade sweeps within WHEEL_PERIL_MS - not its wind-up alone; (SCREEN-2) a court I
step into is judged from my first frame in it, never the sweep of a blade that passed where I stand before I stood there.

**The Unmaking** is new ground - a telegraph kind of its own (TELEGRAPH_KIND.wedges, the shader's and `telegraphField`'s
one reading, held point for point to the strike's `inWedges`): EIGHT wedges about his court's heart (`tg[0]`, wherever he
stands), alternate wedges lit, then - his recovery and a breath later - the other four (its `echo`: a second cast turned
one wedge, the Spokes' own trick, and never a third). From the middle of a wedge at the rim the dark wedge beside it is
9.2 m: 1.2 s at a run, under its wind-up's 2.4 s in phase three. AUDIT WB14 (SCREEN-13): its fill meets the floor's rim
as it is seen (the Nova's and the Spokes' law), not its reach a metre past it.

**The Gaze** has no ground. While it winds up every fighter's rim pulses white and the order stands under the crosshair
(*Look away!*, its arrow the way to turn while they face him); as it lands, a screen whose camera holds him within
GAZE_HALF_DEG of its heading and GAZE_RANGE_M of him is struck and washed white for GAZE_BLIND_MS (the ground view's
blinding). The arc's one blow a step does not answer (answer 5). AUDIT WB14 (SCREEN-5): a watcher (COURT-WATCH) is never
blinded and never told to look away; (SCREEN-14) the white washes the screen through the HUD's hide - it is the eye's,
not the HUD's; (SCREEN-9) the arsenal knows an attack by its number and its moment (AUDIT WB B4's law), as the court does.

## 4. The Vanguard (WB14c)

The fighters arrive on **the Bridgehead** (the night's plan's root - `world/gate/gateArena.js arrivalOf`). Across the fire
to the north the Warden stands in the first court - seen, never reached (no walkway is laid to him, and the relay takes
no blow on him from another floor): he waits there, his opening not begun (`openedAt` is null, and the state says no
`op` - no wake on any screen) until the Vanguard breaks and a challenger stands before him.

**The waves.** Six seconds after the first fighter stands on the Bridgehead (VG_OPEN_MS) the first wave rises from the
fire at its rim; each next wave rises when a quarter of the one before or fewer still stand (VG_WAVE_LEFT - three
risen, all of them down), or VG_WAVE_MAX_MS (30 s) after it rose. A wave's health is its TEAM SECONDS of the platform's living challengers' whole reference damage (the crystals'
law: a crowd breaks it in the same time as a few), shared over its bodies by kind (VG_KIND_W: an Imp 1, a Brute 2.5, a Caster 1.5, the Markynaz 6); its bodies number
`clamp(2 + ceil(n / 2), 3, 10)` (vanguardCountFor) for `n` living challengers on the platform, the wave's kinds dealt
round them in turn, at most VG_STANDING_MAX (12) of the Vanguard standing. A wave due with nobody on its platform waits
for somebody. Each rising is the host's own word (`ad`), and every stage of it a `vgw` word (VG_WORD).

| platform | wave | its bodies | team seconds |
|---|---|---|---|
| the Bridgehead | 1 | Imps | 7 |
| | 2 | Imps and Brutes | 9 |
| | 3 | Brutes and Casters | 10 |
| the Muster | 1 | Casters and Imps | 10 |
| | 2 | Brutes, Casters and Imps | 11 |
| | 3 | **the Markynaz**, and Imps | 14 |

Sixty-one team seconds in all: about two minutes of a court striking at half its reference, and two crossings.
AUDIT WB14 (PLAY-4): and they come off his health on the night (`VG_TEAM_S`, `VG_SHARE_X` - each share (240 - 61) / 240
of a plain night's): the Vanguard took a lone fighter at half the reference 188 s, and with his health whole two such
nights in six ran out of the clock before he fell (three Dire Breaches in six); with it every one fell, the last at 1,025 s
of the 1,200.

**The platform cleared.** The last body of the Bridgehead's last wave down, walkway 3 rises to the Muster (WB9b's slabs,
its law of the laid floor) - *"The Bridgehead is clear."* - the `vgw` word carrying the walkway and its moment, so every
screen lays it at once (the state follows in the same beat); the Muster's waves begin VG_OPEN_MS after a fighter stands
on it. The Markynaz down, his Imps crumble; the Muster empty - a Brute of its second wave may outlive him - walkway 4 rises
to the Warden: *"The Vanguard is broken. The way to the Warden opens."* (AUDIT WB14 TEXT-4: it said "The Markynaz falls"
at the last Brute's death). The Warden's opening (OPENING_MS) begins as the first fighter stands in his court (`vgw` open; `openAt`, the
state's `op` said at once): his wake, his fight and the new arsenal's cooldowns all count from it, as on any night from
the fight's birth.

**The kinds** (`net/gate/gateBrain.js HOST_KINDS`, new ids beside WB11's three - Daggerfall's own bodies):

| id | kind | body | moves | its blow |
|---|---|---|---|---|
| 0 | **Imp** (WB11's Harrier) | r 0.5, h 1.5, hovers | 5.0 m/s at the fighter on its platform standing farthest from the Warden (WB11's own law) | Bite: disc r 2 about itself, 0.9 s, 12% + 4 |
| 3 | **Brute** - a Daedroth | r 0.8, h 2.4 | 2.8 m/s at the nearest fighter | Smash: disc r 3 about itself, 1.3 s, 28% + 9 |
| 4 | **Caster** - a Fire Daedra (Burning), Frost Daedra (Rime), Daedra Seducer (Storm), Lich (Venom) | r 0.6, h 2.2 | 2.0 m/s, keeping 10-16 m from the nearest fighter | Bolt: disc r 3 at a fighter's feet within 22 m (where they stand at its word), every 5 s, 1.6 s, 22% + 7 of his element |
| 5 | **the Markynaz** - the Warden's lieutenant, a Daedra Lord, as he is | r 0.9, h 3.0 | 3.0 m/s at the nearest fighter | Rend: disc r 4.5 about itself, 1.3 s, 38% + 11; and every 15 s he calls two Imps out of the fire |

Departures from the sketch, named: the Bolt leaves no burning ground (a host blow's disc is judged by `hostVerdict`, and
the pools are his own landings' - `landingPools`; a Caster's ground would be a second law of the ground for one kind),
and the Markynaz stands at a Daedra Lord's own size (his host's bodies are drawn at their mobiles' sizes - the Tithe-Imp
alone is scaled, to be seen). Blows on the Vanguard are taken from the platform its body stands on (`applyHostHit` reads the
floor under the body, not his court), the relay counts its Smash and Rend as it counts every plain blow, never the Bolt
(his element's), and the gate's frame bucket rises to GATE_HZ_MAX 28 so two swings a second through all twelve and him
still pass.

A Dremora rank: a markynaz serves a valkynaz (*Oblivion*'s Kyn ranks, the Warden's own title among them).

**His patience** (VG_PATIENCE_MS, 4 minutes after the first wave): a Vanguard still standing then, he throws a Meteor of
Oblivion from his court onto a living fighter on the platforms every 15 s - his own Meteor, its wind-up, its ground,
laid on the platform it is called at (`begin` keeps a point Meteor to the floor of its point): a clock that keeps a
stalled court moving, never a wipe. *"Valkynaz Ruhn tires of waiting."* - said once, with the first that falls (AUDIT WB14
RECORD-9: it was said only at its first moment, and lost if nobody stood out on the platforms then). AUDIT WB14 (LAW-7):
under Echoing each falls twice, as every meteor of his does - its echo a breath on, on the one it fell for where they
stand on the platforms, else where the first fell.

**Late, and cast out.** A fighter who steps in later arrives on the Bridgehead too, the walkways laid behind the court
standing: a run of about 18 s (136 m) to the Warden. A death is cast out as on any night.

**Never in a Legion-Lord night** (section 1). The Vanguard's host and his run on the same bodies' law
(`stepHost`'s - each a point, a health, a walk said once, a disc wound up), in a beat of their own (`stepVanguard`), in
the fight's one host (`f.lg`): every screen draws, hears and judges them as his host (`scenes/gate/gateHost.js` - its
waves never said as his host's, `waveLine`), the bar says the Vanguard's platform and wave in his host's line
(*The Vanguard - Bridgehead, wave 2 of 3*; *The Vanguard - Bridgehead* before its first wave has risen - AUDIT WB14 TEXT-15),
and its stages' lines are `scenes/gate/gateVanguard.js`'s. AUDIT WB14 (SCREEN-3): the host's ground draws its blows
nearest my feet first - HOST_SHAPES_MAX of the twelve winding up, so the one that lands on me is always drawn; (RECORD-3)
at most VG_STANDING_MAX stand, pinned over sixteen fighters on the Bridgehead with every state read whole by the wire.

**AUDIT, found in WB14f.** As WB14c shipped, the court offered the Vanguard's bodies to my blows on its platforms but sent
none of those blows: `scenes/gate/gateCourt.js hostHit` still asked WB11's question, whether I stood in the court *he*
fights in, while the relay (`applyHostHit`) takes a blow from the floor the struck body stands on. Every blow from the
Bridgehead and the Muster went nowhere, and WB14c's pin was a pin on the line that offered the targets. Both now ask the
relay's question (`myFloor`, `fromItsFloor`): a body is offered, and a blow on it sent, from the floor it stands on and no
other - his court, a platform, the Captive's Pen. Pinned on the court itself, a Brute struck from its platform
(`test/net/gate/wb14f_captive.test.js`).

## 5. The Sundering (WB14d)

At the second phase's turn (66%) he does not bound: he calls **the Sundering** at his court's heart (2.6 s, a disc of
8 m) and tears in two - **Ruhn's Blade**, his body, and **Ruhn's Flame**, his aspect's fire made flesh (Ruhn's Rime,
Ruhn's Storm, Ruhn's Venom under the others - `aspect.stuff`).

**The split.** With SUNDER_SPLIT_MIN (4) or more living challengers in the room, the Blade bounds to the second court
(walkway 0) and the Flame to the third over **the Rift Way** (walkway 2, 76 m of stone rising out of the fire from the
first court's north-west) - each under its own ward, each waiting for a challenger in its court (WB9b's wait), each
casting a signature as its ward breaks: the Blade a Ground Slam, the Flame a Flame Nova. With fewer, both bound to the
second court and fight there together - nothing asks two people to split.

**Their health.** At the split, what he has left above SUNDER_LAST (26% of his whole) is shared between them: each half's
pool is half of it, and his bar is the two pools and the last stand's share. A blow names the half it lands on (the
`hit` word's `b`: 0 the Blade, 1 the Flame), and the hand and the purse are the fight's one each - no claim buys a faster
kill by striking two bodies.

**The kits.** The Blade: the Cleave, the Slam, the Charge, the Leap and the Chains. The Flame: Hellfire, the Meteor, the
Nova and the Brand. Each chooses, aims at and waits for the challengers in its own court alone; each keeps its own threat.
The Blade stands 0.85 of his size, the Flame 0.75 and burns in his aspect's ember.

**The pair law.** A half whose pool is spent KNEELS: no step, no blow, no blow taken, its bar *Kneels - 20s*. The other
brought down within SUNDER_PAIR_MS (20 s) and they rejoin; past it, the kneeling half rises - *"Ruhn's Blade rises."* - and
the court tries again. AUDIT WB14 (PLAY-1): it rises LEVEL WITH THE OTHER - SUNDER_RISE (30%) of its pool at most, the
other's pool at least SUNDER_RISE_MIN (5%) - so two sides out of step even out. Risen with 30% whatever the other held,
a court whose sides struck out of step knelt and rose for ever (at even rates, one side 24-28 s late never rejoined once
the Blade's kneel stopped lending the Flame its stun - LAW-1); level, every offset from 0 to 80 s rejoins with two risings
at most - within 190 s at the reference, 286 s at half. Either half's kneel is said to the whole court, and the bar
says the other's seconds.

**A half alone mends.** A half with no living challenger in its court for SUNDER_LONE_MS (10 s) - a court that went all
to one side - mends SUNDER_MEND (1% of its pool a second, never past its pool), its bar tagged *Alone*. Never in the
together layout.

**The Rejoining.** Both knelt, both bound back to the first court's heart (the Rejoining - a disc of 9 m where they meet,
3.2 s), and he stands there WHOLE at SUNDER_LAST: Dagon's Champion, the last phase, fought in the first court - its
signature (the Spokes, then the four between), its arsenal, and Dagon's Reckoning armed there. The court runs back over
the walkways it came by.

**AUDIT WB14.** (LAW-1, PLAY-2) A kneeling Blade's stun is his own: a blow on the Flame is never the heavier for it
(STUN_HIT_X is the Reckoning's, his whole's). (LAW-3) With every share out of the fight (nobody seen ABSENT_RETIRE_MS -
a watcher's socket keeps the beat), the halves' mending is kept in what he stands at, no blow lands where there is no
whole to strike (a half's pool went NaN, and the fight with it), and he never falls sundered. (LAW-4) A Blade kneeling in
the Wrath's wind-up keeps the Wrath - the clock's, never his to drop. (WIRE-3, WIRE-5) The Rejoining and a half's mending
begun or ended are said with the state in their beat, each half's ward in it (a screen that heard every word drew both
halves unwarded for up to 4.5 s).

**Under his marks.** Colossal's size and health, Unyielding's ward and Vengeful's weight are each half's as they were
his. Soul-Hungry's feeding heals both standing halves by half its share each (never past their pools). Grudge-Bearer's
threat is each half's own. Echoing's second meteor is the Flame's.

**As built (WB14d).** The turn is SUNDER_TURN: the Crushing Leap to his court's heart, then the Sundering (attack 17,
a disc of 8 m about his feet, 2.6 s); he tears in two at its END (its recovery done - `sunder`), the layout counted then.
The Flame is a body of its own on the fight (`f.sd.fl`), stepped by the SAME beat as his (`bodyBeat` - the stun, the
blow in flight and its end, the turn's waits and entries, the choice) through a view of the fight (`flameView`: the
fight underneath, the Flame's body over it, the count of attack numbers and the walkways laid read through to the fight),
its words named for it (`b` 1 on its `atk`, `mv`, `ph`). Each half's kit is SUNDER_KITS; a turn's entries are his
turn's (the bounds, the waits, the signatures), never a kit's. A half's pool is a fraction of his whole, so a share in or
out moves the pools with his health. A kneel is the half's stun (the Blade's is his own `stunUntil`, said in the state's
`su`; the Flame's its own), its blow and walk dropped where it stood; `kn` says it the next beat. The Rejoining (attack 18,
a disc of 9 m, 3.2 s) is called by the Blade at the first court's heart, the Flame landing SUNDER_SIDE_M beside it; at
its end he stands whole (`whole`) and the last phase begins there with its wait and its signature. In the together layout
the halves land SUNDER_SIDE_M either side of the second court's heart. While the halves go to rejoin neither chooses, and
a feeding then heals him whole.

**Departures from the sketch, named:**
- The Flame is drawn as his aspect's Atronach (Fire, Ice, Iron under the storm, Flesh under the venom - the Sapper's own
  sprites, `world/gate/gateBoss.js FLAME_LOOKS`) at his scale and three quarters of his height, not his own sprite tinted:
  two of his sprite across the fire read as one Warden seen twice.
- The bar keeps his whole health on its track (the halves' pools and his last stand's share, as the relay says it) and
  puts the halves on a row of their own beneath the bar (each its name, its pool and its line), so every older part of
  the bar keeps its place; a Sundering night's second mark is cut at SUNDER_LAST, where his last stand begins.
- The callout under the bar is the blow of the half whose court I stand in - the Flame's while I stand in its court and
  not the Blade's.
- The Rejoining's card (*III - Dagon's Champion - Back to the first court.*) is shown as the halves go to rejoin (`rj`),
  when the court must run, not at the last phase's word a few seconds later; it is never shown twice.

## 6. The words and the bar (WB14a-d)

- **The bar** keeps one track while he is whole. Sundered it is two, side by side - each half's name, its pool, its ward
  and its state (*Warded*, *Kneels - 14s*, *Alone*). On a Vanguard night it says the Vanguard's progress under his
  health (*The Vanguard - Bridgehead, wave 2 of 3*).
- **The title cards** (WB13e): the Sundering's turn - *II · The Sundering · Bring both halves down together.*; the
  Rejoining - *III · Dagon's Champion · Back to the first court.*
- **On me** (WB14a, `scenes/gate/gateArsenal.js` ARSENAL_TEXT): *Chained! Run from him!*; *Dagon's Brand is on you.
  Keep clear of the others!* (and *Dagon's Brand! Keep clear!* to one standing by a branded fighter); *Shared Torment on
  you. Gather the others!*; *Shared Torment! Stand with Ann!* (*Stand in the gold!* for a marked fighter this screen
  cannot name); *Look away!* - each in the ground view's warning (`ui/gate/gateGroundView.js` - `peril.order` in its
  place) while it winds up, its arrow the way out (away from him, from the nearest other, toward the marked; for the
  Gaze, the way to turn), and a sting as a blow names me. Never in the chat: the chat keeps the gate's moments (WB13b),
  and an order said there would scroll past the fight it is for.

## 7. The Captive (WB14f)

On a Captive night the Pen stands east of the first court, and in it, on his knees, **a knight of the Covenant** (the day's
own name - Sir Evrard, Dame Lysandre, ... - `net/gate/gateMods.js CAPTIVE_NAMES`), chained to his gaolers. As the Warden
wakes, walkway 5 rises to the Pen - *"Sir Evrard of the Covenant lies chained in the Pen. Free him!"*

**The gaolers** are WB11's Ward-Bearers' body and Pulse under another name (kind 7 - a Ward-Bearer is the Legion-Lord's,
and never on this night): `bearerCountFor` of the fight's challengers (AUDIT WB14 LAW-8: as the first of them stands in
the Pen) on a ring about the Pen's heart, BEARER_TEAM_S of
their reference damage shared, each a chain to the knight (WB11c's tether, drawn in Dagon's crimson). The last one down,
the knight is free - *"Sir Evrard is free! The Covenant's ward stands over the court."*

**The Covenant's ward.** The next Dagon's Reckoning to land lands on the ward and on no fighter (its crystals still to
break for the stun - the ward spares the court, it does not break the Reckoning). Spent once. The knight stands in the
Pen in gold until it is spent, then is gone - back through the breach the Covenant holds.

Lore: section 19 of `World-Bosses.md` - *the Covenant fights every one*. Its knights are taken. The caged prisoners of
*Oblivion*'s gates are the precedent.

**As built (WB14f).** A Captive night's fight carries its captive from its birth (`net/gate/gateBrain.js newCaptive`,
newFight's `cp`: when his gaolers rose and how many, when he went free, the Reckoning his ward takes, when it landed on it -
each 0 until it comes). At his wake (`stepCaptive`) walkway 5 is laid to the Pen (`cp`'s `at`, the knight shown chained),
and as the first living challenger stands in the Pen **the gaolers** rise - host kind 7, a Ward-Bearer's body, Pulse and
rising (HOST_KINDS, HOST_BLOWS, HOST_RISE_MS), `bearerCountFor` of the fight's living challengers then on a ring
CAPTIVE_RING_R (7 m) about the Pen's heart, BEARER_TEAM_S of their reference damage shared over them (`cp`'s `n`).
AUDIT WB14 (LAW-8): they rose at his wake, sized for whoever had come by then - eight seconds after the first `in`, the
first few: twelve who came later fought two gaolers of 140 where they were owed four of 840, and an empty wake raised two
of 20. (FIX-1, found fixing it) A gaoler's first Pulse is a Ward-Bearer's, BEARER_PULSE_FIRST_MS after its rising and
staggered, where it had Pulsed as it rose.
Each Pulses at whoever comes near in the Pen (`bearerBeat`; his element's, so the struck screen's alone), and a blow on one
is taken from the Pen alone (the floor its body stands on, `applyHostHit`). They outlive his phases' turns (`notGaoler`:
the Pen is no court of his) and crumble only with the Wrath. The beat after the last is cut down he is free (`cpf`), and
the Covenant's ward is given to the next Reckoning at its word (`cpw`, its attack's number - `captiveWard` from `begin`), or
at once to one still winding up as he goes free, never in its last RECKON_CLOSE_MS (the crystals' law: no screen could hear
it in time). The Reckoning the ward takes lands on nobody: the relay's judge marks it judged (`net/bossRef.js judgeGate`,
`wardTakes`) and every screen's court spares its fighter (`scenes/gate/gateCourt.js judge`); its crystals still grow and
still break for the stun. A Reckoning broken before it lands gives the ward back (`applyCrystalHit`), and the next one takes
it. The ward is spent as the Reckoning it takes lands (`cp`'s `s`), once.

On the screen (`scenes/gate/gateCaptive.js`): the knight kneels at the Pen's heart as Daggerfall's Knight (mobile 145; a
Dame by Daggerfall's woman knight, archive 487 - `net/gate/gateMods.js CAPTIVE_DAMES`, `world/gate/gateBoss.js
knightLookOf`), bowed in a hurt frame while chained, a chain in Dagon's crimson from each gaoler to him on the floor
(`captiveChains`); free, he stands in his idle in the ward's gold light, and the Reckoning his ward takes is drawn in the
ward's gold with the safe edge (`dress`; the bar's callout in the same gold). He is gone CAPTIVE_GONE_MS (1.5 s) after it
lands on the ward, with a gold burst at his going as at his freeing. The bar's host line says *Gaolers: 3*, then *The
Covenant's ward* until it is spent; the gaolers are never counted his host. The words (`CAPTIVE_TEXT`, through the text
core): *"Sir Evrard of the Covenant lies chained in the Pen. Cut down the gaolers!"*, *"Ann cuts down a gaoler. 2 stand."*,
*"Sir Evrard is free! The Covenant's ward stands over the court."*, *"Sir Evrard raises the Covenant's ward against Dagon's
Reckoning!"*, *"Dagon's Reckoning breaks on the Covenant's ward. Sir Evrard goes back through the breach."*

**Departures from the sketch, named:**
- The rising's order is *"Cut down the gaolers!"*, not *"Free him!"*: half the Covenant's knights are Dames, and the order
  names the work.
- A Reckoning broken by its crystals before it lands does not spend the ward. The sketch says the ward takes "the next
  Dagon's Reckoning to land"; one broken never landed.
- Freed while a Reckoning still winds up, the ward takes that one: it is the next to land.
- The gaolers ring the knight at 7 m, not the Ward-Bearers' 9: their chains reach him across the Pen, not across its rim.
- AUDIT WB14 (LAW-8): the gaolers rise as the first challenger stands in the Pen, not with the walkway at his wake.

AUDIT WB14 (SCREEN-4, SCREEN-10): leaving the court hands nothing of his on (his batch, his gold light and his chains were
handed to the host's pass every frame after, the batch destroyed); his chains are their slots, refilled each frame. The
portents' card names him *the knight* (TEXT-2), and his Pen is *the Pen* in every line (TEXT-3).

## 8. The Dire Breach (WB14b)

The Vanguard and the Sundering on one night, said *"Dagon's Breach runs deep."* Nothing else changes: each is
fought as its own section says, the Vanguard first. Its receipt says both (section 11).

## 9. The Tithe-Imp (WB14e) - any night, unannounced

One night in five (`gateRoll(day, 21)`), somewhere between 50 s and 150 s after his wake, while he is in his first or
second phase, **a Tithe-Imp** - an Imp at 1.3 times its size, burning gold, carrying the coven's tithe to its master -
rises at his court's rim farthest from him and runs. It flees the nearest challenger at 6.8 m/s (HOST_KINDS' - under a
run), strikes nobody, and dives into the fire TITHE_LIFE_MS (22 s) after it rose. Its health is TITHE_S - ten seconds - of
the court's mean reference damage. AUDIT WB14 (PLAY-6): at 6.2 m/s and four seconds it was a formality - a lone chaser
caught it 5 s into its 22, four in 3 s; now a lone fighter's chase is about 12 s, four chasers' 5, and every one of the
lane's chases still caught it.

Caught, every challenger who landed a blow on it is handed **the tithe** - gold and a gem off a seed of the relay's own
(`{k: 'tithe', c}`), theirs alone: *"Ann catches the Tithe-Imp! Its tithe goes to all who struck it."* (AUDIT WB14
TEXT-11: nothing spills - it goes into their packs); escaped,
*"The Tithe-Imp escapes into the fire."* It is not in the omen: the one surprise of the arc, and it costs nobody
anything.

**As built (WB14e).** The night's moment is the fight's from its birth (`net/gate/gateLaw.js gateTitheOf`, newFight's
`ti`, the relay's `gateTitheOf(day)`), on any night - a Legion-Lord's too, where it runs beside his host and is no host of
his. It rises (`stepTithe`, `net/gate/gateBrain.js`) the beat after its moment that finds a challenger before him in his
first or second phase - never in his last, never to an empty court - at his court's rim about the bearing away from him.
It runs (`titheBeat`) TITHE_FLEE_M straight from the nearest challenger, along the rim when the rim stops it. It dives into
the fire (`adie`'s `w` 3, HOST_GONE.fled) TITHE_LIFE_MS after it rose, or as he leaves the court it rose in (`tt`'s `ct`:
his phase's turn, the Sundering's halves bounding to their courts, the Rejoining's bound - AUDIT WB14 LAW-2/RECORD-1: it
ran after him over the open fire, struck from no floor); it never rises while he is in the air between two courts; the
Wrath crumbles it with the rest. Caught, every challenger whose blow landed on it (`applyHostHit` keeps them - a blow
that lands for nothing makes no part of it) is handed its tithe AT THE CATCH (AUDIT WB14 LAW-5/WIRE-4: `applyHostHit` given
the relay's dice - `payTithe`; a catch in the last beat before the kill or the Wrath was never paid, the beat that would
have paid it never coming): `{k: 'tithe', c, at}`, a seed of the relay's dice each, to that fighter's sockets alone (the
frame's `to`, `server/src/index.js _gateFan`), once - the fight KEPT BEFORE IT IS SAID (AUDIT WB14 WIRE-2,
`_gateFanKept`: AUDIT WB A10's law for the receipts; said first, an eviction before the next checkpoint woke an Imp
standing again, and caught again it paid a fresh seed). A catch the dice did not see (a fight without them) is paid first
thing the next beat, before the kill's or the Wrath's return. It is never
said again at a later `in`: a tithe is a surprise, and nothing on any ledger counts it.

On the screen the tithe goes straight into the pack through the spoils' own door (`scenes/spoilsPool.js` take, the host's
`scenes/world.js takeGateSpoil`; the court is handed the pool alone): gold at TITHE_GOLD_PER_LEVEL (60) a level, a fifth either way, and one gem of the classic eight
(ItemBuilder's own CreateRandomGem) - `systems/gate/gateSpoils.js titheList`, the seed's own - with a gold burst where it
fell and *"You take its tithe of 594 gold and a Ruby."* (AUDIT WB14 TEXT-1: the gem with its article, the gold formatted -
it said *"594 gold and Ruby"*). It is drawn as an Imp at TITHE_SCALE (1.3) burning gold (a light of
its own), named the Tithe-Imp; its rising, its catching and its escape are said (`scenes/gate/gateHost.js COURT_HOST_TEXT`).

**Departure from the sketch, named:** the tithe is not spilled on the court's floor. The spoils' pool keeps one spew at a
time and one record a day (`scenes/spoilsPool.js`), so a tithe thrown there would take the place of the kill's own spoils;
a burst of its gold where it fell stands for the spill.

AUDIT WB14 (SCREEN-1): sundered, a Tithe-Imp risen in the Blade's court is offered to my blows there beside his Flame (the
court offered the Flame alone, and the tithe was lost).

## 10. The wire, and what the relay judges (WB14a-f)

GATE_BRAIN_V and GATE_BRAIN_MIN go to 6: a game that knows none of this would stand in a Brand it cannot see, strike a
half it cannot name and walk onto a platform the floor law refuses - it is refused at its `in` and told to reload
(GATE-RELOAD's words). The bump redeploys the relay and drops every connected player once, so the arc ships as one relay
version.

AUDIT WB14 (WIRE-1, SCREEN-8): A SCREEN BUILDS A NIGHT'S COURT BY ITS DAY (`world/gate/gateArena.js planOfDay` - the
model, the collider, the arrival, the motor's floor), so a fight fought plain on a portent night stranded it: a relay from
before the arc admits a new client (its GATE_BRAIN_MIN is 5) and fights the night plain - the screen arrives on the
Vanguard's Bridgehead, a floor that relay never lays a walkway from, held there till midnight - and a new relay waking a
fight it checkpointed before the deploy fights it plain the same way. Both closed: the gate's door refuses a portent night
on a relay older than GATE_PORTENTS_RELAY_MIN (`net/wire.js relaySupportsPortents`, the session's `portentsOk`,
`scenes/world.js gateRefusal` - *"not yet"*; a plain night is fought as ever), pinned to the relay version that says WB14b;
and the relay lets go unfallen a fight from before the portents it wakes on a portent night (`server/src/index.js
_gateFightOf` - one with no `pt` at all), so the next `in` begins the night's own. A fallen one keeps its receipts.

| word | way | what |
|---|---|---|
| the state's `pt` | room -> one, all | the fight's portents |
| the state's `xa` | room -> one, all | WB9b's crossings, by walkway (six, `null` for one not laid) |
| `atk`'s `pk` | room -> all | the peer ids of the fighters a Chain, a Brand or a Torment marks (beside `tg`, where they stood) |
| `atk`'s, `mv`'s, `ph`'s `b` | room -> all | the Flame's (1) - none, the Blade's or his whole |
| `hit`'s `b` | client -> room | the half a blow lands on |
| the state's `sd` | room -> one, all | the Sundering: each half's pool and whole, its kneel, and the Flame's body (place, walk, attack, ward, court) |
| `sdh` | room -> all | the halves' pools, at most every HP_SEND_MS |
| `kn` / `kr` / `rj` | room -> all | a half knelt; a half rose; the halves rejoined |
| the state's `vg` | room -> one, all | the Vanguard's stage: the platform, the wave, done |
| `vgw` | room -> all | a Vanguard stage begun: a wave risen, a platform cleared, the Markynaz risen, the Vanguard broken |
| the state's `cp` | room -> one, all | the Captive: laid in the Pen, his gaolers risen, freed, the Reckoning his ward takes, spent |
| `cpf` / `cpw` | room -> all | the knight freed; his ward taking a Reckoning |
| `tithe` | room -> one account's sockets | its tithe's seed |
| `ad` ... `adie` | room -> all | WB11b's host words, carrying the new kinds; `adie`'s `w` gains 3, FLED (the Tithe-Imp) |

**What the relay counts** (INT11, `net/bossRef.js judgeGate`): the Wheel down its sweep, the Unmaking's wedges, the
Sundering's and the Rejoining's discs, every new kind's plain blow - his weight's. Never: the Chain (a pull the relay does
not hold), the Brand and the Torment (his element's, and a count the relay does not hold), the Gaze (a camera), and the
Covenant's ward spares the Reckoning it takes. AUDIT WB14 (SCREEN-6): the Wheel is judged as it is drawn, on both ends -
the strike law is one (`wheelStrikes`).

## 11. What it pays (WB14g)

The receipt (`net/gate/gateReceipt.js`) gains `p`, the night's portents a bit each - 1 the Vanguard, 2 the Sundering, 4 the
Captive freed (a Captive night whose knight stayed chained says none) - optional, so a receipt minted before it reads as
plain. The spoils (`systems/gate/gateSpoils.js`) roll one more piece of Magic or better for each bit, after every draw
they made before (the Dragonfire Oath's law: every spoils rolled before is what it was for its seed). The account service
rolls the Weir Key at EG_KEY_ODDS_PORTENT (a quarter, the rite's) for a receipt with `p` (`server-account/src/eg.js`).

The tithe (section 9) is the Tithe-Imp's alone, on its own seed, beside the receipt and never on it.

**As built (WB14g).** The relay mints `p` on every receipt a fighter earns (`server/src/index.js _gateFallOnce`, from
`net/gate/gateBrain.js receiptPortents`: the night's portents' bits, `net/gate/gateMods.js portentBits`, the Captive's only
where `cp`'s `f` says he went free) and never on the rite's own receipt, whose ember is all it pays. `net/gate/gateReceipt.js
receiptValid` takes `p` as a whole number from 1 to RECEIPT_PORTENTS_MAX (7, every bit) and refuses it on a rite's receipt;
a receipt without it reads as plain, so neither the relay nor the account service has to deploy first. The spoils
(`systems/gate/gateSpoils.js rollSpoils`'s `p`) roll one more piece of Magic or better for each bit, in SPOILS_PORTENT_BITS'
order (the Vanguard's, the Sundering's, the Captive's), after the Dragonfire Oath, and say how many (`portent`); the floor
(`scenes/spoilsPool.js spoilsList`) throws them among the pieces and draws each one's picture after every other's, as the
Oath's is (AUDIT WORLD-REWARDS A1's law), so every other picture of a portent receipt is the plain receipt's. The account
service (`server-account/src/eg.js egGateWeir`) rolls the Weir Key at EG_KEY_ODDS_PORTENT (a quarter, the rite's) for a
receipt with `p`; ACCOUNT_VERSION acct160 (acct159 on its branch, renumbered past the acct159 of QL12 at the merge).

AUDIT WB14 (PLAY-7): a portent's pieces go through every pass the others had - the ladder's last (an Exalted), the
sockets', the weapons' and the technique's - over them alone, after them (they had none: 0% socketed against 13.4%, no
Legendary ever Exalted); nothing drawn before them moves. (WIRE-6) The wealth budget's fill for a signed win grows by
SPOILS_GRANT_PIECE (10,000) for each portent its receipt pays (`server-account/src/budget.js portentPieces`, the claim
carrying its portents to the fill and never in its answer) - acct160, before it shipped. The tithe stays off it, named:
its gold (60 a level) and its one gem sit inside the grant's room past the mean and an hour's rate.

## 12. The slices and their records

| slice | what |
|---|---|
| WB14a | the Warden's new arsenal: the six he chooses, their ground, their verdicts, their words and sounds |
| WB14b | the portents' table and bag, the floor plan, the words; the Dire Breach |
| WB14c | the Vanguard |
| WB14d | the Sundering |
| WB14e | the Tithe-Imp |
| WB14f | the Captive |
| WB14g | what it pays |

Each slice's record is written below as it ships.

**WB14b (2026-10-19) - shipped.** `net/gate/gateMods.js` GATE_PORTENTS (each row's words read through the text core -
the relay's bundle gains `systems/textManager.js`, which imports nothing), gateDireLine, CAPTIVE_NAMES (each a reader);
`net/gate/gateLaw.js` gatePortentsOf (the bag: every other carrier, a round of six), portentsLine, gateTitheOf,
captiveNameOf; `net/gate/gateBrain.js` COURTS (six), WALKS (six), nightPlan, liveFloors, plan-aware onFloor and
clampToFloor, newFight's `pt`, xaWire; `world/gate/gateArena.js` planOfDay, arrivalOf and the plan's model, collider,
slabs and lights; `scenes/gate/gateStand.js` (the court's builders out of `scenes/worldModes.js`, HOST-SPLIT); the
words in the chat, the map's card, the marks card's rows (made the first night that has one) and the herald's omen
post. GATE_BRAIN_V/MIN 6; RELAY_VERSION world229 (world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS and GRANT-DOOR's world223, LAYERED-GEAR and VOICE2's world224, GAUNTLET-SLAIN's world225, LORD-SHARES's world226, PLAIN-SWEEP's world227 and QL12's world228 at the merges).
Pins: `test/net/gate/wb14b_portents.test.js` (13); mutants: `tools/mutants/wb14b.json` (18, all dead). Found in it and
fixed in WB14a's push: the court's `reset` had lost its first line of resets behind the night's arrival (a comment
swallowed them) - a new night's attacks numbered as the last night's were never judged; pinned by a Slam that must land
on both nights (WB14b-the-resets-lost-behind-the-arrival).

**WB14c (2026-10-19) - shipped.** `net/gate/gateBrain.js` HOST_KINDS 3-5 (the Brute, the Caster, the Markynaz) and their
blows (the Smash, the Bolt, the Rend - names through the text core), VG_* and VG_STAGES, vanguardCountFor, newVanguard,
openedAt, vanguardHolds, stepVanguard (the waves, the clearings and their walkways, the Markynaz and his Imps, his
patience, his opening), newFight's `vg` and `openAt`, the state's `vg` and its `op` (none while the Vanguard holds),
applyHostHit from the floor under the body, a point Meteor kept to its own floor; `net/wire.js` the state's `vg`, the
`vgw` word, GATE_HOST_KINDS 6, GATE_HZ_MAX 28; `net/gate/gateLink.js` the fold of both (a clearing's walkway laid at its
moment, the last word kept across a state); `scenes/gate/gateVanguard.js` (new: the Vanguard's lines); `scenes/gate/gateHost.js`
waveLine (its waves never said as his host's) and a Bolt in his element's colour; `scenes/gate/gateCourt.js` its lines said
while news, my blows on its bodies from its platforms; `ui/gate/gateBossBar.js` its line in his host's; `world/gate/gateBoss.js`
its looks and names. Pins: `test/net/gate/wb14c_vanguard.test.js` (13) and WB11's and WB3's tables (the kinds, the blows,
the standing cap, the out kinds); mutants: `tools/mutants/wb14c.json` (30, all dead), and the re-aimed WB11, AUDIT WB11,
WB13e and WB8c records.

**WB14g (2026-10-19) - shipped.** `net/gate/gateBrain.js` receiptPortents; `net/gate/gateReceipt.js` `p` (RECEIPT_PORTENTS_MAX,
optional, never on the rite's receipt, minted only above 0); `server/src/index.js` the mint's `p`; `systems/gate/gateSpoils.js`
rollSpoils's `p` and `portent`, SPOILS_PORTENT_BITS; `scenes/spoilsPool.js` spoilsList (the claims' `p`, the portents' pictures
last); `server-account/src/eg.js` EG_KEY_ODDS_PORTENT and egGateWeir's odds; `server-account/src/service.js` and
`wrangler.toml` ACCOUNT_VERSION acct160 (acct159 on its branch; every version pin moved with its note). Pins: `test/net/gate/wb14g_pays.test.js` (5);
mutants: `tools/mutants/wb14g.json`, and the re-aimed version records (hackedgold, bal9, crafthold, nameas, br5,
fb1004d_knight_house, tech1, gatekeys). RELAY_VERSION's LAW hash recomputed (world229 now). The arc is whole.

**WB14f (2026-10-19) - shipped.** `net/gate/gateBrain.js` HOST_KINDS 7 (the gaoler), HOST.gaoler, HOST_BLOWS 7 (its Pulse,
the Ward-Bearer's), its rising's span, CAPTIVE_RING_R, newCaptive and newFight's `cp`, stepCaptive (the gaolers and the
walkway at his wake, their Pulses, the freeing, the ward spent), captiveWard (from `begin`'s Reckoning, and at the freeing),
wardTakes, captiveSpent, notGaoler (the turn's crumble spares them), applyCrystalHit (a broken Reckoning gives the ward
back), stateOf's `cp`; `net/bossRef.js` judgeGate (the warded Reckoning counts nobody); `net/gate/gateLaw.js`
captiveIndexOf; `net/gate/gateMods.js` CAPTIVE_DAMES; `net/wire.js` GATE_HOST_KINDS 8, the state's `cp`, `cpf` and `cpw`;
`net/gate/gateLink.js` captiveOfState and the two words' folds; `scenes/gate/gateCaptive.js` (new: the knight, his chains, his
glow, the ward's gold, the words); `scenes/gate/gateCourt.js` the warded Reckoning spares me, the Captive wired into the
court's frame, passes, lights and leave, and THE AUDIT OF WB14c (section 4): his host offered, and a blow on it sent, from
the floor its body stands on (`myFloor`, `fromItsFloor`); `ui/gate/gateBossBar.js` the gaolers' line, then the ward's, and
the warded Reckoning's callout in gold; `world/gate/gateBoss.js` the gaoler's look and name, KNIGHT_MOBILE, knightLookOf,
knightAct. Pins: `test/net/gate/wb14f_captive.test.js` (12), WB13b's style law over CAPTIVE_TEXT, and the older ones it
moved (WB3's out kinds, WB11's kinds and blows, WB14e's wire counts, WB8c's telegraph line, WB14c's targets line);
mutants: `tools/mutants/wb14f.json` (33, all dead), and the re-aimed WB11, AUDIT WB11 and GATE-FBX records.

**WB14e (2026-10-19) - shipped.** `net/gate/gateBrain.js` HOST_KINDS 6 (the Tithe-Imp), HOST.tithe, its rising's span,
HOST_GONE.fled, TITHE_LIFE_MS, TITHE_S, TITHE_FLEE_M, TITHE_CORNER_M, titheHpFor, stepTithe and titheBeat, newFight's
`ti` and its record (`tt`), applyHostHit's strikers and the catch, his host's beat stepping only its own kinds, the
phase's turn sending it into the fire before his host crumbles; `net/bossSeam.js` the birth's `ti`; `server/src/index.js`
the night's moment at the fight's birth and `_gateFan`'s `to`; `net/wire.js` GATE_HOST_KINDS 7, GATE_HOST_GONE 4, the
`tithe` word; `net/gate/gateLink.js` the tithe on the state, kept through the fight; `systems/gate/gateSpoils.js`
titheList, TITHE_GOLD_PER_LEVEL; `scenes/gate/gateCourt.js` the tithe into the pack once (the court's `takeSpoil` door,
the spoils pool's own `take` - the host's takeGateSpoil), its gold burst, COURT_TITHE_TEXT; `scenes/gate/gateHost.js` its
words, its size and its gold; `world/gate/gateBoss.js` its look (TITHE_SCALE, TITHE_GOLD) and a fled body sinking;
`ui/gate/gateBossBar.js` never counted his host. And the arc's own lines held to WB13b's style law (its scan now reads
the Vanguard's, the arsenal's, the Sundering's and the tithe's tables): *Dagon's Brand! Keep clear!*, *The halves rejoin
in the first court. Run back!*. Pins: `test/net/gate/wb14e_tithe.test.js` (13), and the older ones it moved (WB3's out
kinds, WB11's kinds, blows and ways of going, WB14b's and WB8c's birth, WB14c's tables); mutants: `tools/mutants/wb14e.json`
(36, all dead), and the re-aimed AUDIT WB11, EGSEAM, GATE-FBX, MWNPC10a and WB8b records.

**WB14d (2026-10-19) - shipped.** `net/gate/gateBrain.js` ATTACKS 17 and 18 (the Sundering, the Rejoining - names
through the text core), SUNDER_* (SPLIT_MIN, LAST, PAIR_MS, RISE, LONE_MS, MEND, SIZE, KITS, SIDE_M, TURN), HALF, sunders,
turnOf (a Sundering night's second turn; its last phase never by his health), halfProfile and flameProfileOf (profileOf
reads a sundered fight's Blade and a view's Flame), bodyBeat (his body's beat, out of stepBrain whole - the frames the
caller's; the golden frames unmoved), inKit, flameView and keepFlame, sunder, whole, kneel, rise, rejoin, sunderFed,
stepSunder, sdFrame and sunderState (the state's `sd`), applyHit's `b` (its half's ward, court, size and pool, and its
kneel), the Wrath stilling the Flame; `net/bossRef.js` judgeGate's bodyBlow (his blow and the Flame's, each by its own
profile); `server/src/index.js` the hit's `b` through the seam; `net/wire.js` the state's `sd`, `sdh`, `kn`, `kr`, `rj`,
`b` on a hit and on the Flame's `atk`, `mv`, `ph`; `net/gate/gateLink.js` foldSunder (the Flame's words into its body,
its Rift Way laid at its word, the kneels and the risings, the Rejoining, the Wrath's stilling), the state's halves
(GateSunder); `scenes/gate/gateFlame.js` (new: flameOf - the state with the Flame in his place - its blows judged on my
feet and its Brand by an arsenal of its own, its cues, bursts, shake and burning ground, its sprite and Morrowind body,
its glow, mark and telegraph, its body offered to my blows from its own court as FLAME_I, the Sundering's lines);
`scenes/gate/gateCourt.js` its wiring (the frame, the peril on my feet his or the Flame's - `onMe`, the targets and the
`hit` word's `b`, the lights, the batches, the pass, the bodies, a kneeling Blade turning a blow), the cards
(courtPhaseCard's Sundering night, the Rejoining's carded once at `rj`) and no Reckoning's stun line for a kneel;
`ui/gate/gateBossBar.js` the halves' row (halfState: Kneels and its seconds, Warded, Alone), the night's last mark, the
callout of the court I stand in; `world/gate/gateBoss.js` FLAME_LOOKS, flameLookOf, HALF_NAMES, halfName, the two
attacks' colours and cues, `render/gate/gateFx.js` their bursts. Pins: `test/net/gate/wb14d_sundering.test.js` (21), and
the older ones it moved (WB3's and WB14a's attack ids and out kinds, WB9e's count, the court's and the bar's source and
parts - GATE-UX 2, WB13a, WB13c, WB14a's wiring, PLUS-DRESS's parts, the two body censuses); mutants:
`tools/mutants/wb14d.json` (61, all dead), and the re-aimed AUDIT 0929, AUDIT WB9, AUDIT WBX, GATE-FBX, INT11, WB3, WB4b,
WB8b, WB8c, WB9b, WB9c, WB11, WB13c, WB14a and WBX records (26: 25 dead, 1 recorded equivalent).

**WB14a (2026-10-19) - shipped.** `net/gate/gateBrain.js` ATTACKS 11-16 (their names read through the text core),
CHAIN_*, GAZE_*, attacksFor's `ctx` (the cooldowns from his wake, `nMin`), brandCountFor, the marked in `begin` (`tg`,
`pk`), the Chains' hold read at its landing and its Slam, the Unmaking's second cast, screenJudged; `net/gate/gateStrike.js`
wheelSpin, wheelAngle, wheelBlades, wheelStrikes, inWedges, markedOf, markedAt, markedMe, chainHolds, chainPull, brandOn,
tormentShare, gazeHolds, markedVerdict; `net/bossRef.js` judgeGate (the Wheel's sweep; never the Chains or the Gaze);
`net/wire.js` gateAtk's `pk` and GATE_ATK_ID_MAX (31); `server/src/index.js` the relay's bodies carry their peer id;
`render/gate/gateTelegraph.js` the chain's path, the marked rings where they are seen, the turning blades, the wedges
(TELEGRAPH_KIND.wedges - the shader and its JS mirror); `scenes/gate/gateArsenal.js` (new: the marked blows and the Gaze
on my feet and my camera, the orders, the pull, the blinding), wired by `scenes/gate/gateCourt.js` (the others' places
from stepsIn, `orderPeril`) and `scenes/world.js` (my peer id, the motor's push and its decay - one line);
`ui/gate/gateGroundView.js` `peril.order` and the Gaze's white; `world/gate/gateBoss.js` each new attack's cues (pitched
down, four semitones from the rest of their clip) and colours. Pins: `test/net/gate/wb14a_arsenal.test.js` (15) and the
older ones the arsenal moved (WB3's ids, WB8b's FAVOURED_PHASE, WB8c's, WB9d's and WB13c's court lines, WB9e's count,
WB13a's one edge - the Torment's gold and the Gaze's none); mutants: `tools/mutants/wb14a.json` (38: 36 dead, 2 recorded
equivalent - the guards that keep the relay from counting a marked blow should one ever gain a ground). Found after its
first push and fixed: the client's fold of an atk word dropped its `pk` (`net/gate/gateLink.js`), so a marked screen
never knew it was marked - pinned through the fold (WB14a-the-fold-forgets-the-marked).

**AUDIT WB14 (2026-10-20) - the arc read whole.** `01-Overview/audits/Audit-Breach-Portents.md`: six cold lanes (LAW, PLAY,
WIRE, SCREEN, TEXT, RECORD) over the frozen head 5c3a69498; every finding verified, then fixed or named (the sections above,
marked `AUDIT WB14`). Pins: `test/net/gate/audit_wb14.test.js` (21) and `audit_wb14_screen.test.js` (12), and the older
ones it moved (each a PIN MOVED note); mutants: `tools/mutants/audit_wb14.json`, the RECORD lane's records of what the
slices' titles claimed (`AUDIT-WB14-RECORD-6-*` in wb14a-f's lists), and the records the fixes moved, re-aimed by content.

## 13. What it does not do, said so

- No portent offline - there is no gate offline.
- The Vanguard's host does not path: its platforms are open discs, as his courts are.
- The halves never merge early, and a Wrath overtakes them as it overtakes him whole.
- The Gaze is the one blow a step does not answer; nothing else departs from the escape law.
- No new art from outside the tree: every body is Daggerfall's own, every floor the court's own stone.
- The marks' words (WB8b's aspects and trials, the herald's and the chat's marks line, the old attacks' names - *Dagon's
  Reckoning* among them) are English in every language, as they were; the portents and every line of this arc beside them
  are the player's (AUDIT WB14 TEXT-9 - a slice of their own).
