# FIELD BUGS 2026-10-18d - eight threads from the bug-reports channel, each read to its root

Eight threads from the Discord's #bug-reports, handed over as nine screenshots (Boar's spires thread ran to two).
Read on the code as it stands at main's `1ec80616f`. Each was traced on the real modules first, and a fix lands only
where the cause is proven ("No band aid fixes", the owner's standing word on these threads); where it is not, the
record says so and what would prove it. The pins are `fb1018d_*`, the mutants `tools/mutants/fb1018d_*.json`.

AUDITED the same day: `01-Overview/audits/Audit-Field-Bugs-2026-10-18d.md` (AUDIT FB1018D, five cold lanes on the
slice's head). Each section below says what the audit changed in it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | MoonGeneral, "No clue how to start cr[afting]": "for the crafting side of this mechanic i have no clue on how to start it ... when it comes to the crafting skills you no explanation there" | The Professions page explained every gathering profession and two of the crafts. Smithing, Building and Outfitting drew their perk cards with nothing above them, Provisioning never named Cooking, and no tutorial page said where a station stands | written (CRAFT-HOWTO) |
| 2 | Awesomenout, "Help! Severe and rando[m FPS drops]": "Normally, my game runs at a stable 144 FPS, but sometimes my FPS suddenly drops dramatically, going as low as 30 FPS or even 0 FPS ... I've also tried changing the graphics settings, but it doesn't seem to make any difference" | Not proven. Every main-thread candidate measured stays under a hitch of this size at a realistic size, or keeps a fixed cadence. The counter could not show a hitch past its own second, and read "0 fps" after the page was hidden | counter fixed (HITCH-KEEP); the cause open, below |
| 3 | Cruor, "Can't use own craft stat[ions]": "shared account homes don't let other characters access their craft benches. Pls fix. I wanna enchant thingies!" | The door asks whether the ACCOUNT owns the home; the stations asked whether THIS CHARACTER does | fixed (HOME-BENCH) |
| 4 | Boar, "Big bugs of the spires", seven items | 6, the Twins: a Sapper fed a fallen Twin, which stood on the relay un-hittable on every screen. 1, the ring was never drawn; 4, THE ASCENT refused a shaft at the balconies' banners, and the ward was never shown; 7, the plates were never drawn. 2 and 4.1 are the hall's look, not built. 3 is the record's law, and said. 5's windows are the record's; a key clash found on the way is the owner's call | 6, 1, 4 and 7 fixed (TWIN-REKINDLE, DUEL-RING, BANNER-SHAFT, WARD-BAR, WINCH-PLATES; SAYS-PAST-TWELVE found on the way); 2 and 4.1 open, below |
| 5 | kvassdrit, "L opens chronicles instead of Quest tab": "Function does not match description in keybinding menu" | What L opens is a recorded decision (PX24d, MAC-K2); the Controls row, written later by KB1, kept DFU's word | fixed (KEY-LOGBOOK) |
| 6 | Warrgrim, "Please Fix Leaping Strike Weapon Techniques. items": "leaping strikes/ any weapon ability that allows you to leap and perform an aoe attack have been completely disabled/broken ... "you cannot leap from here" ... extends to the unarmed versions of this technique as well, such as flying kick" | A piece that casts Slowfalling while held (a Rare armour flavour, The Raven's Wings) refused every leap and dash on flat ground: the gate read the spell, not the air | changed (LEAP-SLOW), a departure, for Mac's review |
| 7 | FloopZe, "Castle Daggerfall guards loot duping": "the guards aggro automatically and after killing them I am able to able to continuously enter/exit the castle and the loot/corpses respawn, duping the items/gold upon re-entering the castle. (This fixed itself after a few exits ...)" | Not proven for this report. One path that fits every clause reproduced: a room's host gone silent (a hidden tab) kept the relay's pen while a joiner ran the foes, so the joiner's kills and takes were never kept and every walk back in was welcomed with full bodies - 2280, 4560, 6840 gold | the dupe fixed (SEAT-LIVE, relay world220); the auto-aggro the owner's call, below |
| 8 | Tibbnak, "Quest: A danngerous wizard, Theodyval laboratory, can complete quest offline but not online" | Not proven. The instance and the offline game stand the quest's Mage on the same marker; public stands nothing, by INSTANCES' law | open: what would find it, below |

## CRAFT-HOWTO: every crafting profession says where it is worked (1)

`src/ui/professions/profPages.js` (CRAFT_HOW), `src/systems/tutorialCatalogue.js` (the Crafting page),
`src/scenes/gatherHost.js` (its seam), the locales.

FOUND. `drawProfessionsPage` has a how-to for each gatherer
(`profPages.js:"    if (GATHER_HOW[_sel]) pane.append(el('p', 'px-note', gatherHow(_sel)));   // TOOL-SAID"`, Hunting's line,
FISHING_HOW). Of the crafts only Enchanting (ENCHANTING_HOW) and Provisioning's brew (ALCHEMY_HOW) had one. Smithing,
Building and Outfitting fell through to their specialisation cards with nothing above them - the player's screenshot.
Provisioning has been Alchemy and Cooking since CRAFT3 and never named Cooking. No tutorial page said where a station
stands.

WRITTEN. Each craft's how-to is a row of `CRAFT_HOW`, read through `t()` as UNLOCKS is. Every claim in it is the
code's: the shops are the ones the host's station questions answer (`worldModes.js:"    forgeHere() {"` through
`enchantHere`), the home's own station, a joinery's bench (CARP-YARD), any lit fire (COOK_FIRE), the Stores page as
the place a station is worked, and what pays its XP - smelting and every piece pay Smithing; sawing and curing pay
nothing. The Tutorials gain a Crafting page in Professions & Survival, after Professions, which pops on the first
gather beside it and lists which shop holds which station. Found on the way and fixed: the tutorial's Professions page
said its key opens the Stores (since HOLDINGS it opens the Professions page alone - AUDIT HOLDINGS C7 fixed the same
claim in the gather line), and ALCHEMY_HOW said "with what your Stores hold", stale since BAG-CRAFT. The eleven new
strings are drafted in the thirteen whole languages; the twelve drafting languages wait as every new key does.

AUDIT FB1018D. "Menu > Holdings > Stores" was the Enhanced menu's path alone: on the Classic skin Escape is DFU's pause,
which has no tabs, and the Professions key is the one door to the Stores on either skin
(`pauseDoor.js:"  if (profPageAt(hooks.at)) {"`). Both pages say the key now - "stand at one, press {Professions} and
open Holdings > Stores", and "{Professions} opens them, and your stored goods are under Holdings > Stores in the same
window" - and the Crafting body is redrafted in the thirteen whole languages (L1-6). The key's own Controls row kept
the claim the tutorial dropped ("Open your Professions and Stores") and reads "Open your Professions page (online)"
(L1-7). Each XP clause is pinned whole (L1-5). fi, ja and pl's drafts of ALCHEMY_HOW, stale once this slice moved its
English, are redrafted (L1-11). Linen is a furnisher's counter's too (FURNISHER_STOCK): the comments said the Weavers'
alone and are corrected; the page's words leave the furnisher out, which is incomplete, not false (L1-9).

Left: the how-to texts name no fee (each station's own section says it); a shop has no object to press, so the player
opens the Stores page there themselves. The first gather now pops three tutorial pages together (four with the
Materials Bag's) - one line makes the Crafting page menu-only, the owner's call.

Pins: `test/ui/professions/fb1018d_crafthowto.test.js` (4: the real page for all ten professions; the words against
the station questions, the joinery, the fire and the XP law; the tutorial page, its seam and search; the locales).
Mutants: `tools/mutants/fb1018d_crafthowto.json` (30, all dead).

## HITCH-KEEP: the counter keeps the minute's worst frame (2)

`src/ui/fpsCounter.js`, `src/systems/frameClock.js`.

NOT PROVEN. Measured in Node over the real modules, on a 4-core container one and a half to two times slower than a
gaming desktop (scripts, not committed):
- the online realm checkpoint, every 120 s (`world.js:"if (checkpointDue(now, _checkpointAt)) {"`): at 4.37 MB (the
  size of the largest field save we hold) about 48 ms in one frame and another 33 ms in a later task once the put
  lands; about 9 ms at a typical 600 KB. A known hitch that grows with the save (Performance-Next.md), but its cadence
  is fixed, and the report's is not;
- the checkpoint's landform lift fields (`world.js:"const LIFT_FIELDS_KEPT = 32;"`): about 37 ms a town pixel the
  memo misses, on synthetic bytes;
- an offline save, 13.6 ms at 4.37 MB, only when the player saves;
- the desktop file store's atomic write, 9-28 ms for a 4.3 MB save on this disk (Windows under antivirus is
  unmeasured);
- every timer: none heavy (the 1 s heartbeat and the play beat are network calls; the HUD layout sweep is measured at
  1.4 ms a second).
Not measurable here: the streaming builds on a cell crossing, first sight of a peer's body, GC.

What the counter could not do. It showed the worst frame of its own second and no more, so a 500 ms stall was gone
before it could be read. And after the page was hidden it read "0 fps" - the first second back counted the hidden
seconds' gap as one frame (on HEAD, hidden 9 s: "8 fps ... worst 9007", or "0 fps 9006.9 ms" hidden early in a
second). That last is possibly the report's "0 FPS" (AUDIT FB1018D L2-6: nothing shows an alt-tab hid the page,
and the player describes the drops during play).

FIXED. A `visibilitychange` starts the counter's second again at the first frame shown. The counter keeps every second
that held a frame of HITCH_MS (50 ms) or more for HITCH_KEEP_MS (60 s), and while the minute holds one prints its
worst, how long ago and how many, and the frame clock's split of the frame that opened that gap, asked by the rAF
stamp it began at (`frameClock.js:"export function frameSampleAt(stamp) {"`: script, `frame` the game's callback,
`before` a timer, message or collection, `stream` the world's build). A hitch with
little script under it is the GPU, the compositor or untimed work; one that is nearly all script is the game's.
`window.__fpsStats().hitch` carries the same.

AUDIT FB1018D. The split was first `frameCpu`'s worst sample when the second closed - the second's heaviest script,
which is another frame's whenever a heavy frame that was no hitch shares the second: a 60 ms hitch with 3 ms of script
printed "script 45" off its neighbour, and by this record's own rule read as the game's (L2-1). The clock's samples
carry their frame's stamp, and the counter asks for the frame before the second's longest gap. The pins now hold a
50-99 ms hitch, the minute's edge (kept at 58 s, gone at 61), and the draws line after a hide (L2-4, L5-9); the script
line's claimed indent, which a right-aligned box cannot show, is gone (L2-5).

What would name it, from the player: the counter's `hitch` lines just after a stutter (Settings > Interface > FPS
counter); online or not, browser or desktop, VSync and the Frame Rate Cap; what they were doing (riding, crossing
cells, others arriving, a town); on the desktop, a performance trace (View > Toggle Developer Tools).

Pins: `test/ui/fb1018d_hitchkeep.test.js` (4: the real counter over a page that can be hidden, and the real frame
clock; the hitch's own frame among a heavier one). Mutants: `tools/mutants/fb1018d_hitchkeep.json` (27, all dead).

## HOME-BENCH: a home's stations serve its owner's account, as its door does (3)

`src/systems/online/onlineHomes.js` (homeStationsServe), `src/scenes/worldModes.js` (stationOwnerHere).

FOUND, in Node over the real account service on node:sqlite, the real client registry on `/v1/homes/town` and the
host's own gates: character A of an account claims a home; the town read as the account's character B. The door lets
B in, every station refuses, and the enchanting station says "This belongs to <the account's own handle>." Two owner
questions disagreed (THE ONE CONSTRUCTION SEAM):
- the door asks the ACCOUNT (`mine`: `homes.js:"      const mine = h.player === player.id;"` on the service,
  `homeLaw.js:"  if (home.mine) return true;"`);
- the stations asked THIS CHARACTER (`own`: `onlineHomes.js` homeAt's `row.mine && typeof me === 'string' && row.character === me` - since
  ACCOUNT-HOMES, `onlineHomes.js:"    const own = row.mine && !row.deed;"`, the account's too),
  through decorOwnerHere at the press and the seven station questions.

FIXED. `onlineHomes.js:"export const homeStationsServe = (home) => home?.mine === true;"`, wired by the host's one line
`worldModes.js:"  const stationOwnerHere = () => decorOwnerHere() || (!privateVisitRoom && homeStationsServe(interiorHome));"`
at the press and all seven questions (forge, workbench, loom, mason's bench, jeweller's bench, alchemy, enchanting).
decorOwnerHere is unchanged, so the storage, the bed, the decorator and the sale stay the buying character's: the
items live in that character's save. A visitor the door admits is still refused; a hall stays its members'.
createWorldModes stands one code line under its ceiling after it.

Online-Arc's HOME1 said "the account's other characters may always walk in, but a home is not theirs", and
HOME-STATIONS said a station serves "its owner"; both now say the account works its stations. That reading is the
slice's, backed by WAGONS2-VISIT (Mac on caravans: "use the interior just like houses, like crafting"), and the
owner's to veto. Left, each the owner's call: the bed (`homeBedIsMine`, still the buyer's alone); HOME-MAGIC and
HOUSE-DROP refuse the account's other characters on purpose (Field-Bugs-2026-09-27g); the door's title names the
account's handle to its own other characters; a home's admitted visitors (party, public, guild) cannot craft while a
caravan's can. SylviaBun's and bag boy's "transfer houses between same-account characters" is a feature request,
not built.

AUDIT FB1018D. "A visitor the door admits is refused" was pinned for a home open to anyone alone; a guildmate the door
lets in (entry 'guild') and a tenant are pinned refused too, every accessor null (L1-3). A knight's house still
refuses the account's other character (L1-4): the service hands B the deed row
(`homes.js:"homes: results.filter((h) => !(h.deed === 1 && h.player === player.id && h.char_id === me)).map((h) => {"`),
which reads `mine` and so would serve its stations - but the house's pieces are A's save's and the service lists none,
so B finds no station to press. Cruor's report still stands in a knight's house; closing it needs a deed house's
pieces on the service. Left.

Pins: `test/scenes/fb1018d_homebench.test.js` (3: the rule for A, B and a stranger; the host's gate - every station
serves B with no fee and no refusal, the cupboard stays A's, a visitor and a private visit get none, a hall serves its
member; a guildmate and a tenant refused). Mutants: `tools/mutants/fb1018d_homebench.json` (17, all dead). Seven source pins and two mutant records
re-aimed (PIN MOVED).

## Report 4: Boar's spires

### DUEL-RING: the Challenge's ring is drawn (item 1)

`src/scenes/eliteGates/egFight.js` (duelRing), `src/net/eliteGates/egLords.js` (EG_DUEL_OPEN), the locales.

FOUND, on the Armsmaster's court (seed 1, hall 10, two members) through the real director and the client's fold and
draw plan: the ring reaches every screen as `pg.ring` (`egLords.js:"if (!open) { kitPlace(F, L, cx + 2, cz, now); F.pg.ring = [cx, cz, 6]; }"`),
and the client read it only to hold the player's movement at the rim. Nothing drew it: the line was said, the frame
had no shape at the ring.

FIXED. `egFight.js:"  function duelRing(R, t) {"` draws a band of fire half a metre either side of the rim, burning
ground on the floor. And a second false line: at n = 1 the record stands no ring and no braziers, yet the words said
"The ring of fire rises." and "The ring falls." The relay's `challenge` and `challengeend` carry `t: 'open'`
(`egLords.js:"export const EG_DUEL_OPEN = 'open';"`), and the screen says "A challenge in the open! Deal him a tenth
of his health within 15 s." and "The challenge goes unmet." - drafted in every language. A client before it reads the
ring's words, as ever.

AUDIT FB1018D. A company of one that killed the Armsmaster mid-duel was told "The challenge goes unmet." at the
killing blow: the fall ends the duel, and the end said the open duel's word (L3-1). A duel the lord's fall ends says
nothing of its own now (`egLords.js:"  if (fell && !(ch.r > 0)) return;"`); the fall is told. Pinned with it: Garoth's
ring (a ring of 6, no braziers) is called and ended as a ring, never as the open duel (L3-M1, in `egaudit5_b`); a
member with no feet in the fight sees the ring (L3-M2); the band's half-metre as a literal (L5-9).

Pins: `test/scenes/eliteGates/fb1018d_duelring.test.js` (4). Mutants: `tools/mutants/fb1018d_duelring.json` (12, all
dead).

### Item 2, the puzzle's stones: the hall's look, recorded and not built

Each Orrery stone stands as a body on the floor (`egBrain.js:"for (const [j, st] of (spec.spots.stone ?? []).entries()) egRaiseObj(F, 'stone',"`)
and is drawn a gold disc; across ten Athenaeums all six discs reached the draws every time. The handles a player
turns are hit boxes with no model - "stones that can be clicked but not seen". Both records already say so
(Field-Bugs-2026-10-17c, ORRERY-HEIGHT: "the stones are still a disc on the floor with their handles unseen until the
crosshair names one"; 10-17e, ORRERY-SIGHT: "A stone with its dial and hand, and plaques standing in the court, are a
question for the hall's look"). What closes it: a look slice that stands the Hour's dial and hand at each
`spots.stone`, its handles drawn where egSpan puts their boxes.

### BANNER-SHAFT, WARD-BAR: a shaft breaks a banner, and the ward is shown (item 4)

`src/net/eliteGates/egBodies.js`, `src/net/eliteGates/egWalkGraph.js` (egStacked), `src/ui/eliteGates/egSpireHud.js`.

FOUND. THE ASCENT refused a member's blow of ANY kind on a body one storey up, and the Rotunda's balconies stand
exactly 4 m over the court - EG_STACK_M - so each is another storey. On seed 1, hall 25 (the court at -11, a balcony
at -7, read at main's `1ec80616f`; -14 and -10 on the merged tree, AUDIT FB1018D L3-4), shafts and spells from the court 8 and 12 m from a banner did nothing; from the balcony they did 20. The
record wants them shot: 13.4 calls the banner "an errand's object, struck", AUDIT EG V lane5 #14 added the stairs
because the banners "stood out of every melee reach", and 8.3 answers an off-floor errand "with arrows and spells".
The ward was real (`egLords.js:"const held = !!C && banners.length >= 2 && now < C.wardUntil;"`, the Conquest's own since main's EG-PERFECT) and no
lord bar showed it, though 25.2 promises "the cage on the lord's bar is red-bronze and hatched".

FIXED. A swing still reaches its own storey alone; a shaft or a spell is refused only where the two stand stacked
(`egWalkGraph.js:"export const egStacked = (view, ax, ay, az, bx, by, bz) =>"`), so it flies through the open air
between a court and its balcony. The lord bar carries `ward`: it reads "... - Warded" over a caged track, and the
Conquest's line says what the banners do: "Banners claim the floor - it burns, and two standing ward the lord. Break
them!" The banners standing in every phase was the record's when this was read (13.4: the Conquest her signature); main's EG-PERFECT, merged after, makes the Conquest her second phase's, a banner planted in turn (13.2), and both pins turn her there. For Mac's eye: the
same rule lets a shaft reach a lord or an add on an open storey (lords still throw at their own storey and walk the
stairs, as under law 8); egFloorBetween's stair test is coarse, so a shot from a stair's foot is refused.

AUDIT FB1018D. egStacked is a column test, not a line of sight: it refuses a shot only where the two stand in one
column, and the relay has no line-of-sight test on any storey. That a shot crosses the open air is the honest
client's - its collider holds the balcony's deck (`egCircleColliderTris`) and its missiles raycast against it; a
crafted hit through a deck lands, as a crafted shot through a wall on one storey always has (L3-5). "Warded" (the gate
bar's BOSS_BAR_TEXT) and the Conquest's new line are English literals: they wait on EG-L10N with the Spire's other
words (L3-3). The bar's ward is its own flag - a lord in fury, stunned or flying draws no cage - pinned (L5-6).

FOUND ON THE WAY, SAYS-PAST-TWELVE: the fold keeps a hall's last EG_SAYS_KEPT (12) lines, and the screen counted lines
to find the new ones, so after twelve the count stood still and nothing more was said that hall (16 folded, 11 said, in
the probe). It now finds the new lines by the last one said; and when more than twelve fold between two frames, so the
last one said is folded out, it says the twelve kept (AUDIT FB1018D L5-5, pinned).

Pins: `test/net/eliteGates/fb1018d_bannershaft.test.js` (1), `test/ui/eliteGates/fb1018d_wardbar.test.js` (2),
`test/scenes/eliteGates/fb1018d_saystwelve.test.js` (2). Mutants: `tools/mutants/fb1018d_bannershaft.json` (4),
`fb1018d_wardbar.json` (6), `fb1018d_saystwelve.json` (4), all dead; law9_height's 70 still dead (AUDIT FB1018D L5-10:
the 27 first written were its egWalkGraph and egBodies share).
`egpres_hud.test.js` re-aimed (PIN MOVED: the bar's `ward: false`).

### Item 4.1, the floor greyed: the law lands, the fall is not built

The Last Charge warns a cone for 5 s, lands a 10% blow, and leaves the third a "floor gone" zone
(`egLords.js:"zoneOut(F, 'void', shCone(f.x, f.z, yaw, f.r + 1, 118)"`) drawn in the void's grey - Boar's "gray out
floor". Standing in it costs 10% every 1.5 s (never under 25%); in the probe it fired twice in two seconds. But the
court's mesh never drops and no body is moved, so to a member who left the third, as the phase card says, nothing
happens. What closes it: the Rotunda's court cut into thirds with their own buckets and collider, as Grath's isles are,
the fallen third sunk while its zone stands. Recorded with it: a void zone's cast-back is a cost, not the glossary's
"returning a member to their last island or plate".

### WINCH-PLATES: the plates are marked (item 7)

`src/scenes/eliteGates/egFight.js` (winchPlates).

FOUND. The plates are spots the relay counts (`egBrain.js:"const plates = spec.spots.winch ?? [], need = Math.min(2, living(B).length);"`),
laid as plain discs off the fight floor (`egLaw.js:"if (variant === 'winch') for (const s of [-1, 1]) {"`). They are
no body of the fight, so the stood-on errands' draw never marked them, and `GROUND_COLORS.plate` was unused: in three
Winch halls the screen drew nothing at either plate.

FIXED. `egFight.js:"  function winchPlates(F, t) {"` draws each plate gold, sized to EG_TOUCH_M (the 2.5 m reach the
relay counts), on its own surface during the trial. Left: the Gauntlet's plates are unmarked for the same reason, on
sloped stairs where a flat quad would cut the slope; the Conquest's thirds (3.5 s) and Both Courts Burn (3.0 s) are
counted ahead on the relay and drawn only as they start. AUDIT FB1018D L3-M3: none before the trial either - the
fight's state stands through the arrival, and the pin now asks it there. Pins:
`test/scenes/eliteGates/fb1018d_winchplates.test.js` (1). Mutants: `tools/mutants/fb1018d_winchplates.json` (5, all
dead).


### TWIN-REKINDLE: a Sapper burns out against a fallen lord (item 6)

`src/net/eliteGates/egBrain.js` (sapperReach). Relay world220.

FOUND, by running the real director (`egBreachNew`, `egStep`, `egBlow`) on seed 1, hall 35, solo, with every frame
folded into the client's state:
- The escort fixes a Sapper's lord when it stands (`egBrain.js:"if (s) s.lordGoal = L0.i;"`), and the Sapper walks to
  that lord's body whatever its state. A Twin stays a body after its first fall, through its pair's window.
- `sapperReach` fed the corpse without asking whether it stood: 2% a feeding, its fall's flag still on.
- On the relay, health alone makes a lord (`egLords.js:"export const egLordsOf = (F) => egBodiesOf(F, EG_ROLE.lord);"`),
  so it walked and threw blows - "he ressurected without timer ... he still could use skills and do damage".
- On every screen, the fall's flag keeps `fellAt`, and a body with `fellAt` is no blow's target
  (`egFight.js:"    if (!b.fellAt && b.hp > 0 && (b.fl & (EG_FL.friend | EG_FL.hidden)) === 0) {"`) - "intangible" -
  while the lord bar reads health alone - "his lifebar was about 15%".
- The pair's raise lifts only a mate at nought (`egLords.js:"  if (dead && !(dead.hp > 0)) {"`), so it never came; and
  killing Isk counted the fed corpse as the survivor, said "fell the other within fifteen seconds!" over an
  un-hittable Vael, and twenty seconds on Vael raised Isk. The fight could not be won.

FIXED. Only a lord standing drinks:
`egBrain.js:"  const L = a.lordGoal ? egBodyById(F, a.lordGoal) : null, feeds = !!L && L.hp > 0 && (F.mem.fed ?? 0) < SAP_FEEDS_MAX;"`.
A Sapper that reaches a fallen lord burns out against the body and spends no feeding. The same holds for every fight
of two lords (the Twin Court, the Old Masters, the Clan Feud). With it, the Sapper crumbles at the body and Vael is
raised at half 20.25 s after his fall, hittable. Elite-Gates.md section 12's Sapper row says so.

THE RELAY. egBrain.js rides the relay's bundle, so the relay is world220, with BANNER-SHAFT, DUEL-RING and SEAT-LIVE. The slice first re-hashed world218 in place,
reading wire.js's "NOT YET DEPLOYED"; `/health` serves world218 (GRANT2 deployed with #1018's merge), and a re-hash
would have left the relay deploy reading "already current" with the fix never shipped. It took world219, which main's
EG-PERFECT took first; merged, this is world220. world218's and world219's rows stand as recorded; the version's pins
moved to world220 and soc1's version mutant was re-aimed by content (AUDIT FB1018D L3-2, L4-1, L5-1: this paragraph,
SEAT-LIVE's gate and three comments still said world219).

Left: the line says "fifteen seconds" in a court of two or fewer, whose window is twenty (EG_TWIN_ONE_MS); it
understates, so it is harmless, and saying the seconds means carrying them on the `esay`. The record promises no
countdown for the window, and none is drawn.

Pins: `test/net/eliteGates/fb1018d_twinrekindle.test.js` (2). Mutants: `tools/mutants/fb1018d_twinrekindle.json` (3,
all dead); AUDIT EG IV's `EGA4L-sapper-feeds-uncapped` re-aimed by content.

### Item 3, the loot after a boss: the record's law, and said

A lord is a relay body, never a world entity with items, and once fallen no crosshair meets it. The spoils are the
Redoubt's: Elite-Gates.md 16.1 ("the week's spoils ... thrown at the beacon like the gate's spew"), 16.2's 3.5 s row,
and the words table's Reliquary. The player is told each time: "The Redoubt's spoils spill from the beacon."
(`world.js:"chatNotice(goldOnly ? text : EG_SPOILS_TEXT.spilled);"`), or that a Redoubt taken this week gives its gold
alone. Left: the spoils are thrown when the account service answers the claim, not on 16.2's fixed beat.

### Item 5, the rest's short timer: the record's windows - and a key clash, the owner's call

Measured on the real director, solo: the rest opens 6 s after the fall (EG_RD_WINDOW_MS) with the Vestige offer, the
decrees, Ready and the respite together; each question was open 10 s (`egRun.js:"export const EG_ASK_MS = 30_000;"`, 30 s since FIELD BUGS 2026-10-25 ASK-LONGER);
a decree no one votes takes the first shown, the offer's first card is taken at the next circle (96 s), and one yes to
Ready ends a solo rest about 12 s later. All of it is the record's (16.2-16.4, 14, 15).

FOUND ON THE WAY, NOT FIXED. One key does two things there (Controls.md KB1 law 3, "No default code ships twice", and
law 5, no raw read of a bound key):
- Y is the default FreeMouse (`inputActions.js:"  ['KeyY', 'FreeMouse'],"`), heard first by the capture-phase toggle
  (`pointerLock.js:"  addEventListener('keydown', onKey, true);"`), which does not stop the key. The world's handler
  then hands the same press to the Spire (`world.js:"if ((!e.repeat && !gamePaused() && egClient?.key(e)) || (!gamePaused() && staffView.key(e))) { e.preventDefault(); return; }"`),
  which reads Y as a Ready vote (`egClient.js:"if (open.length && (code === 'KeyY' || code === 'KeyN')) return this.vote("`).
  A solo player who frees the mouse to read the panel votes Ready, sees it marked - "the option is selected to
  continue" - and is pulled to the next circle about 12 s later with the first card and decrees taken.
- 1-6 pick a card while the offer is up (`egClient.js:"if (m && E.offer?.v?.length) { const card = E.offer.v[Number(m[1]) - 1];"`),
  and with no offer or decree open a digit votes Ready - while 1-4 are the quickslots, the keys a player reaches for to
  heal after a lord.
- N, the default NoteBook, is read raw the same way
  (`egClient.js:"if (open.length && (code === 'KeyY' || code === 'KeyN')) return this.vote(code === 'KeyY' ? 'yes' : 'no');"`):
  at a rest it votes no on Ready, or with only a decree open votes the decree's first option - and N's Controls row
  (KEY-LOGBOOK) is false there. Whether the Notes window opens as well is unproven (AUDIT FB1018D L1-1).
KB1's sweep misses it because the Spire writes `code === 'KeyY'`, not `e.code === 'KeyY'`. Elite-Gates.md 27.8 gives
the panel those keys and its hint says "Y: the Ready vote", while KB1 gives Y to the mouse. Which wins changes the
Spire's controls, so it is Mac's: (a) the Spire never takes a key the world has bound (Y, N and the digits alike) (Ready by click, pad or
`/breach vote yes`), rewording 27.8 and the hint; or (b) the panel's keys become rebindable actions on free codes. Ten
seconds for a decree, read beside the cards, is tight for a solo reader; lengthening EG_ASK_MS is the record's law to
change, also the owner's (the owner handed over the players' ask on 2026-10-25: ASK-LONGER, 30 s). What would prove it was Boar's path: whether he pressed Y or a number at the rest, or a
relay `vote` with q `ready` from his account.

## KEY-LOGBOOK: the journal keys' rows name the window each skin opens (5)

`src/systems/inputActions.js` (journalKeyLabel), `src/ui/plus/plusPad.js`, Controls.md's generated rows.

FOUND. On Enhanced Plus L and N open the Chronicle (PX24d, a66c269a: both journal doors through
`ui/chronicleDoor.js`), L on its Quests page and N on its Notes (MAC-K2, 2dbf7ff1, in all four hosts). KB1
(970ed491) wrote the Controls rows a week later in DFU's words alone - "Quest log", "Notebook" - so L's row read
"Quest log" over a window headed Chronicle.

FIXED. The rows say both skins, because the same Controls pane is the Classic boot Settings' too:
`inputActions.js:"const journalKeyLabel = (page, classic) =>"`
- "Chronicle: Quests (Enhanced Plus) / logbook (Classic)" and "Chronicle: Notes (Enhanced Plus) / notebook
(Classic)". The Controller bindings window (Enhanced Plus only) says "Chronicle: Quests" for the d-pad. No host
changed: a key rebound gets what the row says (LogBook moved to K: K opened and closed the Chronicle, L did nothing).
The pause window's Quests tab is one click from Escape's System tab; a key straight to it would be a feature.
Left: the touch button's "Journal" (still true) and two comments that say "quest log".

AUDIT FB1018D. The rows' "(Classic)" half was held as a literal alone: a door that opened classic N on the logbook's
Active Quests passed. The pin opens the classic logbook through each host's own call and the real door, and reads the
page it opened on (L1-2). The label reads awkwardly inside the held-key prompt ("L is already Chronicle: Quests
(Enhanced Plus) / logbook (Classic)'s primary key.") and may overflow the classic replace box - unproven, it needs
FONT0003's widths, and QuickSpell's row already does: Left (L1-8). The L10N4 count for plusPad.js fell 19 -> 18
because the scanner does not read "Chronicle: Quests" as prose (its colon), not because the words go through `t()` -
they do not, as no Controls row does (L1-10). At a Spire rest N is the Spire's (item 5, L1-1).

Pins: `test/systems/fb1018d_keylogbook.test.js` (2: every scenes host's L and N, each building host's page mapping
run, the real Chronicle opened under the minimal DOM; the rows carry its heading and page). Mutants:
`tools/mutants/fb1018d_keylogbook.json` (17, all dead). The L10N4 ratchet written down (plusPad.js 19 -> 18).

## LEAP-SLOW: a Slowfall spell refuses a technique's flight in the air alone (6)

`src/combat/techniques.js` (refusal), `src/player/motor.js` (techniqueLaunch, ApplyGravity's slow-fall arm).

FOUND, end to end on the real runner, motor and collider. No host regressed: all four hand the runner the one
PlayerMotor, and Leap Strike and Flying Kick launched and landed on flat and hilly ground, a dungeon's mesh floor,
60/81/144 Hz, mods on and off. The one way a body on flat ground meets the line is wearing a piece that casts
Slowfalling while held - a Rare armour flavour (`lootRarity.js:"    { type: T.CastWhenHeld, param: 37 },      // Slowfalling"`)
or the Legendary The Raven's Wings (`lootRarity.js:"    enchantment: { type: T.CastWhenHeld, param: 37 },   // Slowfalling"`).
Every host writes the motor's `slowFalling` from that effect on the ground too, and the gate read it before asking
whether the body was in the air. A legendary Leap Strike, rolled from its record and worn with the Wings through the
real `equipItem`, said "You cannot leap from here." on flat ground; without them it launched.

TECH1 refused "slow-falling" from day one, and JUMP-SLOW (Field-Bugs-2026-10-11b) recorded that "the techniques'
leaps stay refused under the spell" - carried, not chosen: the owner was offered the glide's air control there and
chose the jump alone. What made it feel broken "in the past several days": LEGEND-HELD (10-11b) made a Legendary held
piece free to wear, JUMP-SLOW gave the jump back, and MEND-TIERS keeps a self-wearing piece mended - so the Wings went
on and stayed on, and the leaps were the one thing still refused. The 2026-10-14 kick report's "flat ground ...
nothing works" (KICK-AIR) fits the same cause; its record's "on flat ground the kick launched" was run without the
spell.

CHANGED, a departure carried from JUMP-SLOW's, for Mac's review. The gate and the launch refuse the spell only off the
ground (`(m.slowFalling && !m.grounded)`), so the Flying Kick from the air stays refused under it (KICK-AIR). A
technique's flight under the spell stays on plain gravity while it is the jump it launched, the fall's start still
re-anchored each step so no fall is billed; the swim/levitate branch ends it, and the ground, a parkour catch or a
wall grab (`_parkourBegin`, `_wallBegin`), a climb and a placement clear it, so an ordinary fall glides again. Measured with the runner's `launchTo`: a 9 m Leap
Strike lands 8.81 m out after 0.78 s of its arc's 0.80 s, with the spell or without; launched under the old glide it
reached 12.9 m after 1.15 s. The parkour's running leap stays refused under the spell (`_pkMayLeap`): it has no aim,
and lifting it would be a glide across a gap. Port-Ledger A: JUMP-SLOW's row widened. This supersedes 10-11b's
sentence on the techniques' leaps.

Left: the slow fall's "held against a wall" arm still runs in a flight (it differs only where a wall props the body
more than a step); after a catch the Jump spell's air control stays off until the ground (older than this). The one
line still says eleven causes; with the spell lifted on the ground none of the others is invisible there.

AUDIT FB1018D. The flight was first cleared at `_pkLaunch`, so a flight caught in a hang kept it, and a clamber's exit
sets Jumping again: the drop after it fell at full gravity under the spell (L2-2). It is cleared where a catch and a
wall grab begin, and a direct mantle glides. The pins now hold the fall a flight bills - a Leap Strike down 3 m bills
under 0.3 m, the whole 3 m with the re-anchor gone - and a kick pressed while gliding off an edge refused (L2-3).

Pins: `test/combat/fb1018d_leapslow.test.js` (9, the first five red on the old code: the Wings from their record through
`equipItem`; a grounded Leap Strike lands on its aim and strikes; it pays once; the kick from the air and the motor's
own launch refused; a jump's descent and a ledge after the landing glide and bill nothing; a flight cut short glides
again; the walk-off kick, the leap down, the catch, the grab and the mantle). Mutants:
`tools/mutants/fb1018d_leapslow.json` (14, all dead); four KICK-AIR and TECH1 records re-aimed by content.

## SEAT-LIVE: a dungeon room's seat is a live socket's (7)

`src/net/seatLive.js` (new, in the relay's bundle), `server/src/index.js` (the Room's `_hostOf`, `_hostWalk`,
`_leads`, `_leaveMovesSeat`, `_seatStale`, `_seatHeard`, `_seatAfter`, `_seatKeep`), `src/net/online.js` (`_askSeat`), `src/net/wire.js`
(FOES_FULL_MS and FOES_STALE_MS, their one home), `src/scenes/world.js` (the seat clock, wiring). Relay world220.

NOT PROVEN FOR THIS REPORT; ONE PATH FITS EVERY CLAUSE, REPRODUCED. Offline, a dungeon left is destroyed and rebuilt
(`worldModes.js:"function exitDungeonNow() {"`), never cached, as DFU's: the guards come back alive with a fresh
roll, never as corpses. Alone online, the farewell is kept and the bodies stay emptied. A live host refuses a re-take.
But two seats had grown apart. The relay named a room's host as the socket in it longest (WORLD1) and kept the room's
memory from that socket alone (`server/src/index.js:"if (!isWorldRoom(a.key) || a.id !== this._hostOf()) return;"`);
the page handed the foes - and PARTY-LOOT's arbitration with them - to a joiner once that host had gone FOES_STALE_MS
unheard (SEAT-HEAL). A host whose tab was hidden kept the relay's seat while its frame loop said nothing. The joiner
minted the bodies' terms and granted its own takes, and none of it was kept: every walk back in was welcomed with the
silent host's last memory, the bodies full and the dead standing, carrying that memory's `hostile`
(`dungeonContext.js:"if (sf.hostile != null) f.ai.isHostile = !!sf.hostile;"`). Over the dungeon's real doors in Node,
Knight bodies: 2280, 4560, 6840 gold in three visits. "Fixed itself after a few exits" is the silent socket leaving
(the joiner becomes the relay's host and its farewell is kept) or the memory's kills passing WORLD8's hour.

FIXED, so the seat and the memory's writer are one. In a dungeon room the relay's host is the eldest socket that has
said a frame - its hello, a pose, its foes, its own lane, its memory, never a ping - within FOES_STALE_MS of another
being there to hear it (`seatLive.js:"export function seatOf("`); alone it owes nothing; the change is said to the room
as a leave's is. A socket back from silence is a joiner: stamped after the seat and told whose it is, its frozen memory
refused until the relay names it. The page asks for the seat it runs (`_askSeat`: its pose every FOES_FULL_MS while
the named host is unheard), and its own hidden spell spends none of the named seat's patience (`createSeatClock`), so
SEAT-HEAL never hands a page the seat on its first frame back while the relay names another. A building's room keeps the
eldest: its host streams no foes. No DFU member moves (DFU has no rooms).

Left: the window between a host going silent and the relay hearing the joiner (up to FOES_STALE_MS plus FOES_FULL_MS);
a host coming back to an empty room whose socket died republishes its own frozen foes (kills undone, items taken stay
taken); a building's silent host keeps the pen; re-stamping a quiet joiner sends a redundant host frame.

THE AUTO-AGGRO, the owner's call. Not a defect by either law that could make it: online, the castle's hostility is the
room's - one player's trespass, door or blow turns every guard on everyone
(`hostCombat.js:"export function makeEnemiesHostile(foes) {"`) and the memory keeps it for later visitors while those
guards live; online or off, DFU's DoorText trespass (a private door tried twice, or a trespass floor like
Orsinium's, Field-Bugs-2026-09-28f) - Castle Daggerfall's RDB needs ARENA2 to read (`tools/castleProbe.mjs`). Whether a
castle's anger should be each player's own is Mac's. What would prove the report's path: whether anyone else was in the
castle (AFK or minimised), or the relay's `world:meta.by` and `.at` for its room.

AUDIT FB1018D. A silent host whose socket closed with no farewell - after the relay's bound on its last frame, before
the room's next frame - left the room never told (L4-2): the leave asked `_leads`, false by the live law, and the next
frame found the told host gone and moved the seat in silence, so the joiner kept the gone socket as its host and never
streamed - the dupe again, until it left. The leave says the seat now when the leaver is the host last told
(`server/src/index.js:"  _leaveMovesSeat(a, ws) {"`). The page's gate read SEAT_RELAY_MIN 219, main's EG-PERFECT
relay, which has no seat law, so a page there sent 28 unmoved poses a minute: it is 220, pinned against world219 (L4-1,
L5-1). The frames that count - a foes stream, its own lane, never a ping, not every frame - are pinned on the real
Room (L4-3, L5-2). The building pins ran on an attachment with no `at`, a shape the runtime never mints; they stamp it,
and the building law is pinned at its five sites (L5-3). A returner is stamped now, and a host named counts as heard
(L5-4). AUDIT ATTACH's widest socket is measured in a dungeon instance room too (`hd`, `hi`: 1086 bytes, under the
pin's 1100; L4-4).

Pins: `test/net/fb1018d_seatlive.test.js` (11, on the real Room, session and clock: a silent host loses the seat and its
write is refused, the joiner's kept, the host back a joiner; a live host keeps it, a reconnect, a building, a leave, a
tie, the ask, the wiring) and `test/scenes/fb1018d_seatloop.test.js` (1: the report's loop through the real doors and
Room - the bodies stay empty three visits running, the gold flat). Mutants: `tools/mutants/fb1018d_seatlive.json` (31:
30 dead, one recorded equivalent - the told host's presence guard, which nothing reaches since the leave says the
seat: the told host leaves the index only through `_leave`). Re-aimed with PIN MOVED: seatheal, world1, world2, auditworld34, oncrash1, world6biiid, auditworld6a and
auditworld6b (`seatClock` for `_foesInAt`), and slam11 (the host poses through its hellos).

## Report 8: Theodyval Laboratory - not proven

The quest is N0B20Y05; its target `Foe _monster_ is Mage`, placed by `place foe _monster_ at _mondung_` on a random
quest marker of `remote dungeon9`. Every link from the door to the foe standing answers yes in the instance:
- the popup's "Your instance" enters the dungeon whole (`instanceDoor.js:"if (row.kind === 'public') return PUBLIC;"`,
  `smallerDungeons.js:"if (online) return whole ? 'full' : onlineDungeonSize(dfLocation);"`), and the mount's gate
  lets it through (`instancePlaces.js:"export const questMountsHere = ({ online, builtSize }) => !online || builtSize === 'full';"`);
- a quest taken online is stamped whole (`smallerDungeons.js:"if (online) return SMALLER_DUNGEONS_STATE.Disabled;"`),
  and an older stamp is re-laid onto the whole dungeon at the next online load (`questRepair.js` relayQuestOnline).
Reproduced in Node with the real QuestMachine, Place, sceneMount, questRepair and smallerDungeons over N0B20Y05's own
lines - taken online, entered public, saved and reloaded, the instance twice, copied offline and entered: the instance
and the offline copy stand the Mage on the same marker; public stands nothing. That is INSTANCES' law
(`worldModes.js:"if (!questMountsHere({ online: !!host.dungeonOnline?.(), builtSize: builtDungeonSize(dungeonLoc) }))"`),
and the line the player read as "your quest is in here" is QUEST-ELSEWHERE's:
`instanceDoor.js:"questHere: () => t('instance.door.questHere',"` - "Your quest's business here waits in your instance.".
It was read the other way, and public was searched twice for it.

Ruled out: the layout (the instance and the offline game build the same blocks and markers); the party (two members
offline add no partner rows and send nothing, and every hand-over needs a member in the room); the room's simulation
(the seat, the memory's restore, the surplus pass touch only the layout's run, and a quest foe stands past it); the
mount's key (the entrance pixel); the mods; the spawn grants (not enforced).

What would find it: the two first runs' dungeon name on entry (a spawned dungeon is a clone named
`Theodyval Laboratory (x,y)` and offers no popup - unproven, and nothing points a quest at it), whether the popup came
on those entries, the Exact quest guidance inside the instance, Settings > Repair active quests' answer, or the
console's `[quest] foe 128 failed to stand in dungeon`. Edges recorded: once GRANT6 enforces, a refused 'quest' grant
drops a dungeon quest target for the whole visit and marks it standing
(`dungeonContext.js:"if (ask && !gm && grants?.()?.enforcing()) return null;"`) - to settle before the enforce flip;
QUEST-ELSEWHERE's line could say "not here" first (thirteen drafts, the owner's word).
