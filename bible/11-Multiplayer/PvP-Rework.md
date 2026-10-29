# The PvP rework

The owner's rework of every fight between players (2026-10-28): a duel, the Wild Zone and a siege. Daggerfall Unity has
no PvP, so all of it is a departure; the overhaul's armour (`pcaao.js:"export function pcaaoPartKept("`) is the one
reference it reads. It ships in stages; this page holds what is built.

## Stage 1: the fight's numbers (relay world280)

- **PVP-HEALTH.** The referee's pool is the player's real maximum health, reported on the `vit` frame (`x`) and held to
  `refereeHealthShare.js:"export const PVP_HEALTH_MAX = 3000;"`. In a fight a rising maximum adds no health.
- **PVP-HIT** (the owner: "so let cap at 45%", "so its 3 hits"; the triangle's 34%, still three hits). One blow or cast
  takes at most 34% of the whole (`siegeRef.js:"export const PVP_HIT = Object.freeze({ share: 0.34 });"`). BAL8's 180 in 5 s is retired; the swing law
  and `siegeRef.js:"export const PVP_CASTS = Object.freeze({ max: 19, windowMs: 10_000 });"` pace a fight.
- **PVP-HEAL.** For 30 s after a player's blow, all heals together restore 25% of the whole a 15 s, plus 1% for each 20
  Restoration past 100, to 35%. A duel heals under that cap; a siege still blocks heals by report.
- **PVP-SCALE.** A player's blow scales with the weapon's climb and gear percent (`wp`), and skill reads to 1,000.
- **PVP-SPELLS.** A spell at a player uses its first effect: Damage, or a heal. Drain is off between players until it is balanced (PVP-NO-DRAIN).

## PVP-GUARD: armour against a player's blow

The striker rolls against a neutral stand-in, so the struck player reports what its armour lets through: the overhaul's
row for each kind of blow (edged, blunt, unarmed), its condition and the natural resistance, averaged over the body
parts as a blow picks them, a shield's block left out (`pvpGuard.js:"export function pvpArmorKept("`). The report
carries the three shares (`g`); the referee holds each to 10..150 and takes that share of the blow before PVP-HIT's cap
(`refereeHealthShare.js:"export function guardedBlow("`). Bare at 50s is 100; Daedric plate keeps 34, 40 and 30, and 14,
20 and 10 at 100s. The client is trusted for its own armour as it is for its health share. Guard powers (loot, sets,
the sky) are not read yet.

## PVP-WARD: resistances against a player's spell

A cast carries its spell's element (`el`, DFU's 0-4: fire, frost, poison, shock, magic;
`siegeCombat.js:"export const pvpSpellElement = (sp) =>"`). The struck player reports, per element, what its Resist
effects let through, then its own saving throw - race, Willpower and gear, as a monster's spell meets it - summed over
the dice (`spellcast.js:"export function savingLands("`; `pvpGuard.js:"export function pvpWardKept("`, the report's
`w`). The caster's stand-in rolls no save. The referee holds each share to at least 15 - the owner's "85% resist", immunity included - and
takes it before PVP-HIT's cap (`refereeHealthShare.js:"export function wardedCast("`).

## PVP-TRIANGLE: archer over mage, mage over warrior, warrior over archer

The owner's triangle (2026-10-29: "tune it to 55% win", "just barely"), from a sim of the PvE overhaul's builds and gear
by level, its bow on the swing law, with players landing 30-50% of their attacks: the favoured side wins 42-67% at
levels 30-45. A player's arrow at a player is 1.28x, a harmful spell 0.96x; from level 40, as the last gear tiers land,
1.67x and 0.81x (`pvpTriangle.js:"export const PVP_TRIANGLE = Object.freeze("`). A live Shield spell on a player is
reported (`sh`, `pvpGuard.js:"export const pvpShielded = (entity) =>"`), and the referee takes 25% off a swing and 35%
off a shaft (`refereeHealthShare.js:"export const PVP_SHIELD = Object.freeze("`) - the plan's "Shields max 25%". Aim and
movement decide the rest; staff fights tune these numbers.


## PVP-BUFFS: a buff runs a minute in a fight

The plan's "buffs last 1 min": each frame a refereed fight may hold the player (the health mirror's `active`), a spell
effect it cast for itself is cut to `pvpBuffs.js:"export const PVP_BUFF_ROUNDS = 12;"` magic rounds - a round is a game
minute, five seconds at DFU's 12x. A worn item's effect (`heldItem`) and a foe's harm are left whole
(`pvpBuffs.js:"export function capPvpBuffs("`). A departure: DFU has no PvP.

## PVP-POTIONS: one potion of a kind each 15 s in a fight

The plan's "potion timers 15 s, health / magicka / other": while a refereed fight may hold the player (the health mirror
sets `pvpPotions.js:"export function setPvpFight(active)"`), each kind waits
`pvpPotions.js:"export const PVP_POTION_MS = 15_000;"` after the last of its kind, and the bottle is kept
(`pvpPotions.js:"export function pvpPotionRefusal("`). The kind is the first effect's: Heal Health, Heal Spell Points,
or other. A potion drunk in a fight lands its first effect alone (`pvpPotions.js:"export const pvpPotionBundle ="`,
laid on at `hostMagic.js:"applySpellToPlayer(pvpPotionBundle(bundle)"`). A departure: DFU has no PvP and no potion clock.

## PVP-NO-DRAIN: Drain stays home

"remove drain till we can balance it": `siegeCombat.js:"export const PVP_SPELL_TYPES = Object.freeze([4]);"` - Damage
alone, and a Heal Health, reach a player. Backstab was already off between players (BAL8).

## PVP-NO-POISON: no poison between players

"poison need diable in pvp": a Damage spell of DFU's poison element
(`siegeCombat.js:"export const PVP_POISON_ELEMENT = 2;"`) reaches no player. A weapon's poison never rode a PvP blow:
the striker's stub weapon carries none (`duelCombat.js:"weapon.poisonType = -1;"`).

## PVP-ARMOUR-CAST: plate and chain slow a caster in a fight

"do the plate cost and half its cost for chain": while a refereed fight may hold the player, each worn piece adds to a
spell's cost and takes off the cast rate by its own type
(`pvpArmourCasting.js:"export const PVP_ARMOUR_CAST = Object.freeze({"`): plate 6% and 3%, chain half, leather nothing.
An RRI light set piece reads leather (`rriItems.js:"export function rriNativeMaterialValue(item) {"`). Full plate
costs 42% more and casts 21% slower. PvE is left whole. A departure: DFU has no such cost.

## PVP-SPELL-CRIT: a spell at a player crits

"spell cit is for this", "otherwise maghes fall off": a harmful spell at a player crits as a blow does under the overhaul
(`combat/combatStats.js` criticalModel's damage arm): `pvpSpellCrit.js:"export function pvpSpellCrit(caster) {"` -
Critical Strike / (4 - the Luck term) per cent, x(1 + 5% for each 5 points). Rolled once a cast on the caster's machine
(`siegeCombat.js:"harm: Math.round(pvpCritHarm(harm, caster, rolls)"`), before PVP-TRIANGLE's scale; the referee clips.
PvE is left whole. A departure: DFU's spells never crit.

## PVP-FLAG: in the open zone only a flagged player strikes

"u flag and un flag instanly", "we changed it to 1m", "u cant flag on a party member": Caps Lock or the top-right button
(`pvpFlagHost.js:"export function createPvpFlagHost("`) puts the flag up at once from level 30, and takes it down at once
unless a PvP blow fell in the last minute (`pvpFlag.js:"export const PVP_FLAG = Object.freeze({ lockMs: 60_000, level: 30,"`).
The zone word carries it; the referee holds the lock and says each flag to the room
(`server/src/index.js:"_wildFlagSay(st, a, x, flagWas, wasIn, fl) {"`).

"flaggin is so yu dont hit a player when ur trying to kill a monster": an unflagged striker touches no player
(`wildRef.js:"if (!a.flag) return"`), and the flag never shields its bearer; party, duel and guild kin stay unhittable as before. While the flag is down
the Portal Stone works anywhere in the zone (`portalStoneHost.js:"const zoneRefused = (to = null) =>"`). Chat types no
capitals under the flag's Caps Lock (`capsFix.js:"export function capsFixKey(e, field) {"`). Skulls overhead
come next. A departure: DFU has no flag.

## PVP-SKULL: the mark over a flagged player

"no skull when not", "when you agro skull turns gold", "make the gold and red glow sloightly": a 16-pixel skull
(`pvpSkull.js:"export const SKULL_ROWS = Object.freeze(["`) over the name (`nameLayer.js:"put(tag, 'skullOf', p.skull ?? '',"`)
and on the flag button - none unflagged, white flagged, gold in aggro, red a villain. The referee says a flagged fighter's
aggro to the room on a blow, its ms left in the flag word's `a`, once each ten seconds
(`wildRef.js:"export function wildAggroWord(x, now) {"`). "overwold should show skulls": the Overworld's player marks
carry it over the name too (`travelViewMarks.js:"skull: pvpSkullOf(t.id) });"`). A departure: DFU has no PvP mark.


## PVP-30: no PvP under level 30

"add a are you sure to the 29 to 30 levleing", "explain this make u able to die in pvp zones": the referee reads the
character level the token signs (`cl`) and refuses every blow given or taken under 30, and any flag asked up
(`wildRef.js:"if (pvpYoung(a.cl) || pvpYoung(t.cl)) return"`). A token with no level is left to the game's own flag
refusal. Online, the level up from 29 to 30 asks first, Yes or Not yet; Not yet keeps the level owed
(`pvp30Ask.js:"export const pvp30Asks = (e) =>"`), on the sheet's door and the Growth tab alike. A departure: DFU has no PvP.

## PVP-DEATH: no safe passage after a death

"when u die u need to take away player protection form ebing killed again", "they go to town in a safe zone when dead": a
rise from a fall, or a return after a foe's kill, grants no safe passage (`wildRef.js:"const rose = z && x.down"`). This
replaces ZONE-GRACE's rise arm (`Wild-Zone.md`); an entry from outside, away and quiet, still grants it.

## PVP-EDGE: safe passage only for a walk in

"only from ebterin from the edge", "if u tp in no safe passage": the game says the zone word's `ed` only when its last
step outside was close and just now (`zoneEdge.js:"export const ZONE_EDGE = Object.freeze({ m: 60, ms: 5_000,"`), and
the referee grants an entry's safe passage on it alone (`wildRef.js:"else if (!x.down && !rose && ed && now"`). A
teleport, a dungeon left, a town's streets left (the streets say 0 to the referee) and a rise grant none. The relay has
no map, so the word is the client's own, as the streets' peace is.

## PVP-BAR: health over a flagged player

"How does the health and shield bar look", then "Perfect" to its mockup: a red health bar with a thin blue Shield strip
on top, between the skull and the name (`nameLayer.js:"const paintBar = (tag, b) => {"`), on flagged players alone. The
referee says each flagged fighter's bar to the room when it moves, in whole per cent, at most once each half second
(`wildRef.js:"export function wildBarWords(st, now) {"`), off the zone's beat
(`server/src/index.js:"_wildBarSay(st, now) {"`), and every bar to one entering. The referee knows a Shield spell as on
or off, never its amount, so the strip is whole or gone. A flagged stranger, nameless in the 3D scene, still shows its
skull and bar (`pvpFlagHost.js:"const shown = !q ||"`).

"So a hidden player u only see the skull and hp bar", "They always have some body just fiant": a Chameleon or
Invisible player whose skull is gold is drawn faint, with skull and bar and no name
(`pvpFlagHost.js:"export const PVP_FIGHT_VEIL = Object.freeze({"`). A departure: DFU has no PvP.

## PVP-CONE: names near the crosshair

"Was thinking we needed to make them not visible less u look within a angle", and "Yes" to everywhere: another player's
tag - its skull, its bars and its bubble with it - shows only within about 20 degrees of the crosshair, full inside 17
and gone past 23 (`nameCone.js:"export const NAME_CONE = Object.freeze({ deg: 20, band: 6, fadeMs: 250 });"`). Each name
point carries its angle off the camera's forward (`remotePlayers.js:"off: nameOffDeg(view, head)"`), and the DOM layer
eases the whole tag toward the cone's answer over 250 ms, so a tag never pops (`nameLayer.js:"tag.cone = nameConeStep("`).

My party and my foe - a peer I struck or was struck by within the flag's lock - always show
(`pvpFlagHost.js:"const foeOf = (id) =>"`), passed through the name mask the host already wore. The client draws it;
the relay sends every name as before. The classic bitmap face, which only headless probes draw, keeps every name. The
Overworld's travel marks are left as they were. A departure: DFU has no player names.

## PVP-VILLAIN: the villain meter

"if u get attacked first u dont gain any villany to kill htem", "as well as if somoe attack your party", "so u cant get
pushed in becoming a villian its a CHOICES": each character has a meter from 0 to 10,000
(`villainLaw.js:"export const VILLAIN = Object.freeze({"`). A kill of a flagged player adds 100 for each level the
victim is under the killer, from 5 under; an unflagged victim adds the same and 2,000. Hits add nothing. A kill adds
nothing where the victim struck the killer, or one of its party, first in this fight - a blow between the two inside the
aggro's minute (`wildRef.js:"export function wildOpen("`; the party is the hub's word, `server/src/index.js:"async _wildVillainy(st, fall, now) {"`).
No clock, no gold and no death lower it.

At 5,000 the killer is a villain: a red skull (`pvpFlagHost.js:"const skullOf = (id) =>"`) and a flag the referee holds
up (`wildRef.js:"else if (isVillain(x.vi)) x.flag = true;"`). The referee counts a fall's points
(`wildRef.js:"const vp = villainKillPoints("`), keeps the meter on the fighter and in its carry, marks the flag word `v`,
tells the killer its meter (`wref` `vil`) and signs the points into the fall's receipt (`vp`). The pause menu's Stats page
shows "Villainy 3,240 / 5,000" on a bar to 10,000 with a red mark at 5,000 (`pvpVillainBar.js:"export function statsVillainy("`).

PVP-VILLAIN-KEEP, below, keeps the meter on the character and lowers it. A departure: DFU has no PvP.

## PVP-VILLAIN-KEEP: the meter kept

The meter lived in the relay's memory alone, so a new relay instance forgot it. Now the character keeps it
(`realm_characters.villainy`, migration 0192). The account service adds a fall's signed `vp` to the killer's character in
the fall's own batch (`server-account/src/villainy.js:"export function villainFallSteps(db, claims) {"`, wired in `wildFall` and in
REPEAT-SHIELD's `wildShielded`: a shielded kill is still a kill the killer chose). The batch writes the fall's remains id,
so a fall asked twice adds once. The meter is held to 10,000.

The mint signs it as `vl` beside the realm's yes (`realm.js:"vl: villainClamp(row.villainy),"`, checked at
`identityToken.js:"if (c.vl !== undefined && !(c.rc === 1 && villainyIssuable(c.vl))) return false;"`). The relay puts it
on the socket (`wildRef.js:"export const wildTokenAtt = "`) and the referee takes the larger of it and the carried meter
(`wildRef.js:"if (villainClamp(vl) > villainClamp(x.vi)) x.vi = villainClamp(vl);"`). A villain by its token is red at its
first step into the zone. The hello's token body is 928 now: a house beside every other claim and `vl` is 899.

What lowers it. A raid's claim takes 500, once by its own row, none while red
(`server-account/src/villainy.js:"export function villainRaidStep(db, playerId, character, raid, nonce) {"`). A monster at or above my level
less 1 takes 1 and a quest done 200: the page adds them to its next Renown report as `vd`
(`renownTracker.js:"const vd = Math.min(vdPend, xp);"`). The service takes no more than the XP that report credited, the
hour's progress bound, and never below 0 (`server-account/src/villainy.js:"export function villainReportDown("`). The monster's level and the
quest are the page's word, as the Renown they pay is. A departure: DFU has no PvP.

## PVP-RULES: a flagged fighter's limits

"when u get aggroed or flag up change speed levciataion all that jazz", "sleep need disable", "sleep spell as well": while
my flag is up in the open zone (aggro is a flag up, its skull gold), the law holds me
(`pvpRules.js:"export const pvpLimited = () =>"`, wired by `pvpRulesHost.js:"export function createPvpRulesHost("`).
Levitate lifts nothing and is not cast; the fall it ends costs no health, once
(`pvpRules.js:"export function pvpLevitateBarred() {"`, spent at `shared.js:"if (inOutdoorWater || takePvpFallSpare()) return;"`).
The flag going up ends every PvE buff - Fortify, Shield, the Resists, the concealments, Jumping, Climbing, Slowfall, Free
Action, Water Walking, Regenerate - a curse's and a duel's left whole
(`pvpRules.js:"export function stripPvpBuffs(entity, edge) {"`).

"Item buff no": a worn item's buff goes at each poll too, and the worn set is recast once the flag drops (`pvpRulesHost.js:"} else if (takePvpHeldTaken()) restartHeldEnchantments(entity);"`). While it is up none is cast on myself but Shield, the
fight's own (`pvpRules.js:"export function pvpSpellRefusal(sp, limited = pvpLimited()) {"`), and the rest window stays shut.

The pace on foot and the jump are held to an unbuffed best, Speed and Running 100 and Jumping 100 with Athleticism
(`pvpRules.js:"export const PVP_LIMITS = Object.freeze({ mps: 11.71, jump: 1.6 });"`, read at
`motor.js:"export function registerMoveCap(name, fn) {"`). "No horse u demoibt", "Demount": a rider is set on foot and
the saddle refused (`mountRig.js:"const barred = isRiding(mode) ? rideBarred() : null;"`). Paralyze never reaches a player:
PVP-SPELLS lands a Damage or a Heal Health alone. A beast's change raises no flag - the flag host's own `set` alone sends
it. All of it is the client's: the relay refs only blows. A departure: DFU has no PvP.

## PVP-KIT: the PvP spell bar

"they only get to tool kit we give", "flagged has a seperate hot barr": while my flag is up in the open zone, keys 3 to 0
are eight slots of the toolkit (`pvpKit.js:"export const PVP_KIT = Object.freeze({ slots: 8, reachM: 15, rounds: 12, lo: 100, hi: 300 });"`),
pressed the hotbar's way (`pvpKitBar.js:"export function castKitSlot("`). Keys 1 and 2 stay the potions'. Every other
spell is refused under the flag, and only the bar's spells reach a player (`world.js:"if (!wildFair(peerId) || !sp?.pvpKit) return false;"`).
"Let them set the icons for these spells": with the mouse free, a click on a slot picks its spell, its element or
attribute and its icon, kept in the browser. Outside PvP the spell keys work as before.

"They get to pick damage and its a aoe", "Just our damage formula": Damage is the classic Fireball's record at Area at
Range in the picked element (`pvpKit.js:"const FIREBALL = Object.freeze({"`), its harm the referee's path as before
(siegeSpellNumbers, the crit, the triangle, the ward, PVP-HIT); the bar's Poison is the one poison spell that reaches a
player. Each cast costs its share of maximum magicka (`pvpKit.js:"export const KIT_SPELLS = Object.freeze({"`,
`spellcost.js:"if (spell.pvpKitCost > 0) sp = Math.trunc(spell.pvpKitCost);"`), and PVP-ARMOUR-CAST still adds to it.

The rest are CasterOnly gifts, a minute long, scaled with the governing school from 100 to 300. "Goo choose make it
15m": the party member under the crosshair within 15 m takes one, else I do
(`hostMagic.js:"const allyReach = sp.pvpReach ?? allyReachFor(sp.rangeType);"`); a stranger never does. A heal lands as
its receiver's own rise, so PVP-HEAL's window still caps it. Resist rides PVP-WARD's report; Reflect and Absorb take
their chance off it, never bouncing (`pvpGuard.js:"const turned = (100 - pvpReflectChance(entity))"`). A Shield
reports its pool's share of my health, 10 to 25 (`pvpGuard.js:"export function pvpShieldShare(entity) {"`), and the
referee takes that part of PVP-SHIELD's 25% and 35% off (the `vit` report's `sh`). Speed is Fortify Speed on Fortify's
numbers. Inside a zone dungeon the bar is off. A departure: DFU has no PvP.

## PVP-REWARD: one random piece, or one policy's gold

"they only get a piece that isnt insured", "random roll on uninsure peices": a kill in the open zone gives its killer one
worn piece, rolled by the account service on the fallen's record, never chosen and never rolled on a game
(`pvpReward.js:"export function pvpRewardRoll(items, { insured = () => false, keep = () => false, pick }) {"`, called at
`server-account/src/wild.js:"const roll = burnt ? null : pvpRewardRoll(stored.items, { insured, keep, pick: (n) => pvpRollIndex(ctx.rand, n) });"`).
The roll skips a piece a policy in force or a ledger hold keeps. The pick and the worn offer are gone: the relay signs
a fall after `wildRef.js:"pickMs: 10_000"`, so the fallen's first dead frame lays its body first, and the service reads
no `w`. The piece reaches the killer through the escrow and the collect. A hall's kill rolls too.

"random policy gold": when every worn piece is insured, the killer gets the premium of one random policy, and that
policy is spent; the piece stays. The gold lies in the remains as the killer's alone, held in escrow (a room that signs no
collect pays none and spends none). It is never the fallen's: no reclaim, and no listing for her tab. "if gold will
ovrweight a player u get a letter of credit": the killer's collect says its free weight (`free`), and the service pays
coin where it fits, else a letter of credit for the whole - the trade window's own rule
(`pvpReward.js:"export const pvpGoldPaid ="`). A tab that says no weight gets the letter.

"get rid of the bag drop": no bag piece drops at a kill
(`server-account/src/wild.js:"drop = takeWildDeath(save, w, keep, wt, { insured, bag: false, purse: false });"`). The purse's
tenth and the letters' tenth went to the remains until PVP-NO-TENTH, below; the cart and the packs stay storage. A villain has no insurance:
`pvpReward.js:"export const pvpInsuredFor ="` takes `villain`: "villian lose insurance" - a fallen whose kept meter is red holds no policy
(`wild.js:"{ villain: isVillain(Number(row.villainy)) }"`). "Insurance cost 20%": a
premium stays a fifth of `itemWorth` (`wildInsureLaw.js:"export const WILD_INSURE_DIVISOR = 5;"`), which counts the
piece's price and its lines' worth. The service is acct214 (acct211 on its branch). A departure: DFU has no PvP.

## PVP-NO-TENTH: no tenth at a kill, gold as the last roll

"No gold dropped on death pvp detached gives gold as a last roll if no item or insurance", "No only the insurance": a
player kill takes no tenth of the purse and lowers no letter, and nothing lies in the remains for anyone
(`server-account/src/wild.js:"drop = takeWildDeath(save, w, keep, wt, { insured, bag: false, purse: false });"`). The roll
is a worn piece, else one policy's gold, else THE LAST ROLL - only with no worn piece to take and no policy to pay
(`wild.js:"const lastRoll = !burnt && collect && roll === null;"`). "Only give them some of their total or letter of
credit or gold what ever =10%", "Letter only pay out 10% if they have not enough gold": a tenth of the coin and the
letters together, the purse first, the letters (bag order) paying only what it cannot
(`wildDropLaw.js:"export function takeWildLastRoll("`).

The gold goes to the killer the way a policy's gold does: escrowed, his alone in the remains, never the fallen's to take
back, collected as coin where it fits his free weight, else one letter of credit for the whole. The collect says it is
the last roll (`wild.js:"return parse(fall?.tk)?.last ? { ...paid, last: true } : paid;"`), and so does each side's text
(`wildZone.js:"lastGold: (n) =>"`, `wildZone.js:"deathLast: (name, gold) =>"`). A held record, a REPEAT-SHIELD kill
and a room that signs no collect take nothing. A foe's death keeps everything, as FOE-KEEPS says. The service is
acct215. A departure: DFU has no PvP.
