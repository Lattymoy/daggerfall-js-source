# FIELD BUGS 2026-09-29g - ! OG's list: the raid's walkers, the beast's levy, the Warden's strike, the hold on enemies

Two screenshots from the Discord (! OG, through Mac), one list. The rule for a batch like it: every report root-caused
on the real modules, the port's own faults fixed and pinned, and what is Daggerfall's own, or a design call, said
plainly and left to Mac.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Protect bystanders ... Hit a guard killed him in a raid", "u can totaly kill citizens now, just fucked my rep in a raid" | RAID-GUARDS spared the raid's defenders, not the town's WALKING guard: one swing was Assault, minted a watchman from him, and the crime turned every defender into the crime watch | fixed (RAID-GUARDS-NPC): the guard, and the townsperson at Mac's word |
| 2 | "Then changed ... Now all guards wont leave me alone" | the passive Criminal_Conspiracy levy went through SuppressCrime, which DFU's never does: a transformed beast drew the watch with no crime to answer | fixed (WERE-LEVY) |
| 3 | "Serving time doesnt fix rep. Tried 8 times" | DFU's own arithmetic, ported exactly | for Mac |
| 4 | "Rep in were form is separated from normal form" / "Were form rep transfer to non were form" | DFU's SuppressCrime, as the port has it: nothing done in beast form is a crime; a crime done as a man is still owed as a beast | Daggerfall's own; said |
| 5 | "Rep need a reset function for guilds / citys" | nothing like it exists | a feature, for Mac |
| 6 | "reduce the encounter speed slowing distance by like 40%" | the port's own OW6 governor (not DFU's) | fixed (OW6-NEAR) |
| 7 | running, jumping, climbing past 100; "all bonus for skills should scale" | no port clamp on the skills; Speed stops at 100 and the climb chance at 95, both DFU's | for Mac |
| 8 | "jumping and running and climbing spells seem to have 0 effect" | Jumping and Climbing land on the real motor; DFU has no running spell | nothing to fix found; said |
| 9 | "Magic enchantments on strike from weapons broke" | no regression; the Warden's strike went nowhere in the real game (a port fault), and online only a strike's DAMAGE crosses to a foe another player owns | the Warden: fixed (WARDEN-STRIKE). Shared foes: fixed at Mac's word (STRIKE-SHARED). Duels: for Mac |
| 10 | "Quest timer is fucked ... loitering around for hours nothing" | online a loiter moves the character's clock, and quest time reads the world's | Lived-Time OPEN 1, Mac's |

## RAID-GUARDS-NPC: the town's walkers are spared in a raid (1)

**Reproduced first**, on the real `cityGuards` pool: a raid on, Protect Bystanders on, the raider out of reach, the
two defenders off the look ray and a walking guard on it at 1.5 m. The watch's pass and the monsters' missed; the
civilian arm (`resolveCivilianHit`) answered `{crime: 'assault', carriedHit: true}`, crime 4; after one `update` both
defenders read `defender: false`, team CityWatch, hostile - `update`'s enlist turns every defender into the crime
watch the frame a crime stands - and a blow on one killed him and set Murder. The watch's first blow opens the Halt
box, and `lowerRepForCrime` takes the region's legal reputation (-20 for Murder, -8 for Assault) and its People.

**Why.** RAID-GUARDS (Mac: *"Raids shouldnt let you damage the guards"*) asked one question, `playerSpares`, of the
watch - a DEFENDER - and held the damage door for a defender. The town's own walking guard is no watchman: he is a
MobilePersonNPC with `guard`, DFU's mobile-NPC branch (WeaponManager.cs:499-531), where a strike is Assault and makes
him a watchman on the spot. The swing's third pass and the riding trample (EnhancedRiding.cs:135-165) both reached him.

**The fix.** `scenes/cityGuards.js` `playerSparesPerson`: every walker while a raid is on here - the walking guard,
and the townsperson at Mac's word on the first draft (*"Spare townspeople in raid"*; a townsperson struck in a raid was
still DFU's Murder, and still turned the defenders). The civilian arm passes them by - and the first on the look ray
stops the swing, as a spared defender does (the body DFU's SphereCast meets first); the world host's trample list is
filtered by the same rule. No raid, DFU's Assault and Murder stand, whatever the setting.
`test/scenes/fb0929_raidguards.test.js` (+1, failing on the code before it), `tools/mutants/fb0929g_raidguardnpc.json` (9, 9
dead, the audit's five among them).

**AUDIT 29g (Mac: "audit this").** A code review of the batch found one fault, in this fix: `resolveCivilianHit`
answered `false` when a spared body stopped the swing, and both hosts read `false` as a swing that met NOBODY - they
handed it to the static door behind him (`attemptExteriorDoorBash`: a bash, and in town a break-in). FB0929's defender
on the ray, whose parity this fix claims, carried the same fault since it landed. A stopped swing answers
`{spared: true}` now; the hosts' tail whooshes it and bashes nothing, a swing that met nobody is still the door's, and a
crime still surfaces. Pinned by running each host's own tail lifted off its source, both failing on the code before it.
The review's other findings are all outside this batch (its local base was two days stale).

## WERE-LEVY: the passive levy writes the field, as DFU's does (2)

A region that hates the player (legal reputation under -10: 5% a game minute) or has banished them (10%) levies
Criminal_Conspiracy and calls the watch (PlayerEntity.cs:498-511). DFU writes the FIELD there
(`crimeCommitted = Crimes.Criminal_Conspiracy`, :502 and :509) - the one crime write in DFU that SetCrimeCommitted's
SuppressCrime (:2345-2355) is never asked of. V4 routed every write through the setter, this one too, so a transformed
lycanthrope with a hated name drew the watch with NO crime: never halted, never charged, and the watch never stood down
while he stayed a beast (EnemyEntity keeps guards while transformed). Both hosts (`world.js`, `exterior.js`) write the
field now. `test/systems/beastform.test.js`'s V4 pin allows that one write and no other; `audit26_dungeonfoes` and
`exteriorfoes` pin the field. `tools/mutants/fb0929g_werelevy.json` (2, 2 dead).

## WARDEN-STRIKE: a Cast When Strikes spell on the Gate's Warden reaches him (9)

**No regression.** On the real modules - the real PlayerWeapon, cast engine and enchant ctx, a Wizard's Fire blade -
ten damaging swings on a foe the player owns landed the spell ten times, in every host, the combat overhaul on or off;
the strike path's recent history (FB0929, RAID-GUARDS, the swing law, the sea fight, home magic, the Warden, the
featherweight tooltip) touches none of it.

**The port's fault found on the way.** AUDIT WBX F2 routed a strike spell on the Warden's stand-in (`spareGear`) to the
court's own spell door through the enchant ctx's `bossSpell` - which only the dungeon context's OWN mount passes, and the
hosted court never mounts one (`worldModes` builds it with `enchantCtx: false`: the outer host's ctx is the live one).
The world host's and the fixed-city host's mounts passed none, so in the real game the spell went nowhere. They hand it
to the live court's door now (`modes.dungeonCtx.spellOnBoss`, on the dungeon api, shut outside a court).
`test/scenes/fb0929g_wardenstrike.test.js` (3; all fail on the code before it), `tools/mutants/fb0929g_wardenstrike.json` (4,
4 dead).

**What online does to a strike (For Mac 4).** A foe another player spawned - a shared dungeon's, a cell's encounter,
the Curse's ghosts since CURSE-SYNC - is a puppet here. A strike spell's DAMAGE crosses to its owner as a hit
(`exteriorFoes.js` hit relay); every other effect (paralysis, sleep, soul trap, drains, a pacify) lands on the local
copy only and is overwritten by the owner's next word. Hand of Sleep, one of the weapon rarity flavours, does nothing to
a shared foe. And a duel's weapon crosses the wire as template, material and condition (`duelWeaponOf`), so no strike
enchantment fires in a duel. Both recorded limits (Online-Arc; Community-Arc's fresh weapon), neither new; for a player
who fights in company it is most of his fights, which fits "doesn't work at all".

## STRIKE-SHARED: a strike spell reaches a foe another player runs (For Mac 4, first half)

Mac: *"Do #1"* - the shared-foe half of For Mac 4. The duel half stands as recorded.

**The strike goes to the foe's owner, whole.** The enchant ctx's `applySpellToTarget` asks a new host door,
`spellToOwner(foe, record, level)`, before it lands a player's strike on a foe. Each pool answers only for a foe another
player runs: the cell's puppet (`exteriorFoes.js`), and underground the room's foe on a joiner, a party member's quest
foe or loose stand (`_ownFrom`, `dungeonContext.js`). The spell rides a hit of no damage (kind `spell`, so the owner's
foe turns on the striker as any connect does) through the one divert each pool's blows already take: `sp` is the
record through the cast frame's own projection (`castSpellOf`: five elements, at most three classic effects, byte
components; the icon rides as 0), with any of the five range types, and `lv` is the striker's level, clamped to
CAST_LEVEL_MAX. A record the wire refuses lands locally as before. The owner lands it on its real foe through the
cast engine's own foe door (`applySpellToFoe`): its saving throw, its pacify, its absorb and resist gauntlet against a
caster that stands in at the striker's level. Every point of its damage is the striker's blow (the fighters' count,
`slain` above ground, `v` below). The relay reads no hit, and an older owner reads past the fields.

**A peer's soul trap is its caster's.** `attemptSoulTrap` fills the pack of the player who cast the trap, and the owner
holds no such pack. So the cast engine marks a peer's new trap with its caster (`ctx.peerCaster` -> `by`) and says
nothing (the owner is not the caster). Whoever kills the foe, the owner's kill door reads no gem of its own for that trap
and names the caster on the body's record (`j`, with `q` the trap's chance; the wire admits both on a dead record
only). The caster rolls it against its own pack, as the Gate court's WBX7 arm already does: once, only for a puppet it
sent a trap to, and with no tether, since the foe fell on the owner's machine.

**Left as it is.** A peer's watchman stays on the watch's own door (WATCH1: a peer's blow and nothing else), so a strike
on one lands on the copy as before and its damage crosses as a blow. A foe that reflects a peer's strike has no body to
send it back to (the stand-in caster), so the reflected bundle lands nowhere. A lingering damage effect's later ticks
are nobody's blow at the owner (the stand-in is no player), as a fall's are, so a kill by a tick pays no one. The
striker hears no "Trap active." line, because the save is rolled at the owner.
`test/scenes/strikeshared.test.js` (7), `tools/mutants/strikeshared.json` (16, 16 dead).

## OW6-NEAR: the journey's hold on enemies begins 40% nearer (6)

The slowdown is the port's own (OW6, `06-Systems/Travel-View.md`): while fast-travelling, the time scale is held so the
traveller has THREAT_WARN_S real seconds before the nearest enemy's reach. DFU and Travel Options only STOP a journey
for enemies nearby. The lead-in is reach + THREAT_WARN_S x (own pace + the enemy's chase) x the scale, so the one knob
that shortens it by exactly the asked 40% - for every threat, with no band's, raider's or camp's sight or chase moved,
which would also change when they spot the traveller - is the warning: 2 -> 1.2. A rider at x40 is held from 768 m
short of a band's sight, not 1280; on foot 168 m, not 280. The second "too early" after OW6-LATE's 5 -> 2.
`test/systems/travel/ow6_slowdown.test.js` re-derived; `tools/mutants/ow6s.json` (27, 27 dead).

## What is Daggerfall's own (3, 4, 7, 8)

- **Serving time (3).** The Halt costs the crime's whole loss (PlayerEntity.cs:2284-2299) and serving gives back half
  less one (:2301-2311): Murder nets -11, and a Criminal Conspiracy (loss 2) gives back nothing. Under -10 the region
  levies Conspiracy at 5% a game minute, banished at 10% for ever (the banish bit is only ever cleared by a new game).
  Online the clock runs 12x, so a hated name meets the watch every couple of real minutes, and each arrest is -2 more.
  On the real modules: one Murder arrest to -11, eight Conspiracy arrests after to -27. Field-Bugs-2026-09-28 left the
  roll to Mac; unanswered (For Mac 2).
- **Beast form (4).** DFU keeps one legal reputation per region and none per form; what it has is SuppressCrime -
  nothing done transformed is a crime (LycanthropyEffect.cs:121-124), which the port matches. A crime done as a man
  stands when he changes, and the watch's blow on the beast still opens the Halt and lowers the reputation - the
  "transfer" the report describes. DFU's own quirk, left as it is: a crime write while transformed clears a standing
  crime to None (the setter writes None).
- **Past 100 (7).** The port clamps no skill: Running, Jumping and Climbing are read live and unbounded, as
  GetLiveSkillValue reads them. What stops is DFU's: Speed at 100 (GetLiveStatValue; the curses' +40 and +20 Speed
  and Fortify Speed fill only to 100), the climb chance at 95 (CalculateClimbingChance; certain from about 94), and
  climb speed never reads the skill. Running does scale past 100 - 11.7 m a second at 100, 12.2 at 115, 12.7 at 130 -
  but half a percent a point is hard to feel. The online duel card is the one port-made cap (`DUEL_SKILL_MAX` 100).
- **The spells (8).** Jumping lifts the apex 1.08 m -> 2.15 m at Jumping 100 on the real motor; Climbing doubles climb
  speed (1.47 -> 2.95 m a second). Its chance half is DFU's x2 before the clamp to 95, nothing from Climbing 48 up.
  DFU has no running spell; Fortify Speed is the Speed clamp. On horseback a jump is a flat 1.75, and a cart, Slowfall
  or wading water cancels it (AcrobatMotor).

## For Mac

1. **A townsperson in a raid.** [ANSWERED: *"Spare townspeople in raid"* - RAID-GUARDS-NPC spares every walker while a
   raid is on. Outside a raid Protect Bystanders stays DFU's box-pass rule.]
2. **Serving time, the levy, banishment.** A refund of at least a Conspiracy's loss, a grace after release, no levy on
   the online clock, a way to lift the banish bit - any, or DFU's? [ANSWERED by the reputation overhaul (REP1-REP3,
   2026-09-29, `06-Systems/Standing-Arc.md`; Mac: *"The charge, with a mark"*, *"Challenged on sight"*, *"Timed or
   pardoned"*): a sentence gives the charge back (a Conspiracy's whole 2), a day's grace after the law is answered, no
   levy at all - a guard who sees a known criminal stops them - and a banishment lifts after 30 days or with a pardon.]
3. **A reputation reset (5).** Its reach (a region's legal reputation and People, the banish bit, a guild's standing),
   where it is sold (a temple, the court, a guild), the price and its rise per use (a count kept per character, the
   server's online). [ANSWERED by REP3/REP4 (Mac: *"Earn it + faster drift"*): a temple's penance buys five points of a
   region's law (200 gold, a step more each time there) and its pardon lifts a banishment (2,500, a step more each
   time), both counted per character in the save; a guild's standing mends by its quests and the weekly drift, under
   REP6's probation. The count lives in the character's save, as every standing does - the server holds none.]
4. **Strikes on shared foes and in duels.** Carry a strike spell's whole effect to the owner (the cast lane's
   `castSpellOf` frame), and a duel weapon's enchantments across the wire - or leave both recorded limits?
   [ANSWERED for shared foes: *"Do #1"* - STRIKE-SHARED. Duels still open.]
5. **Past 100.** Movement past the Speed clamp, climb speed from the Climbing skill, a steeper Running slope, the duel
   card's cap - against Realm-Arc's planned online cap of 100. Offline, as MERC-CAP, DFU's reads stand unless you say.
6. **Quest clocks (10)** are Lived-Time's OPEN 1: countdowns on the character's clock (a loiter spends them, as DFU),
   and a time-of-day window either on the character's clock, opened on arrival as GUARD-ONLINE's, or on the sky with
   the rest window saying when. Seventeen vendored quests wait on a window (the vampire cure, the Curse among them).

Also noted, not changed: a weapon whose material cannot hurt the foe returns before the strike payloads
(`formulas.js`), where DFU runs them on every connect (WeaponManager.cs:617-624) - Cast When Strikes stops at 0 damage
either way; PotentVs's +5 and HealthLeech's use stamp differ.
