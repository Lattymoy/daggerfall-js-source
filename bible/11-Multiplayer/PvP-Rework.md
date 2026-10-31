# The PvP rework

The owner's rework of every fight between players (2026-10-28): a duel, the Wild Zone and a siege. Daggerfall Unity has
no PvP, so all of it is a departure; the overhaul's armour (`pcaao.js:"export function pcaaoPartKept"`) is the one
reference it reads. It ships in stages; this page holds what is built.

## Stage 1: the fight's numbers (relay world280)

- **PVP-HEALTH.** The referee's pool is the player's real maximum health, reported on the `vit` frame (`x`) and held to
  `refereeHealthShare.js:"export const PVP_HEALTH_MAX"`. In a fight a rising maximum adds no health.
- **PVP-HIT** (the owner: "so let cap at 45%", "so its 3 hits"; the triangle's 34%, still three hits). One blow or cast
  takes at most 34% of the whole (`siegeRef.js:"export const PVP_HIT"`). BAL8's 180 in 5 s is retired; the swing law
  and `siegeRef.js:"export const PVP_CASTS"` pace a fight.
- **PVP-HEAL.** For 30 s after a player's blow, all heals together restore 25% of the whole a 15 s, plus 1% for each 20
  Restoration past 100, to 35%. A duel heals under that cap; a siege still blocks heals by report.
- **PVP-SCALE.** A player's blow scales with the weapon's climb and gear percent (`wp`), and skill reads to 1,100 (PVP-SKILL-TOP, 2026-10-30: past a full geared set; 1,000 cut one).
- **PVP-SPELLS.** A spell at a player uses its first effect: Damage, or a heal. Drain is off between players until it is balanced (PVP-NO-DRAIN).

## PVP-GUARD: armour against a player's blow

The striker rolls against a neutral stand-in, so the struck player reports what its armour lets through: the overhaul's
row for each kind of blow (edged, blunt, unarmed), its condition and the natural resistance, averaged over the body
parts as a blow picks them, a shield's block left out (`pvpGuard.js:"export function pvpArmorKept"`). The report
carries the three shares (`g`); the referee holds each to 10..150 and takes that share of the blow before PVP-HIT's cap
(`refereeHealthShare.js:"export function guardedBlow"`). Bare at 50s is 100; Daedric plate keeps 34, 40 and 30, and 14,
20 and 10 at 100s. The client is trusted for its own armour as it is for its health share. The loot ladder's guard
powers ride the same shares (PVP-GEAR, below); the sets' and the sky's are not read yet.

## PVP-GEAR: gear powers between players, capped

2026-10-30, the owner: gear was planned to count in PvP ("we have the cap", then "all imprint"). The striker's sheet
carries `gp`, a percent on its blow after PVP-SCALE, at most 40 (`pvpGearPowers.js:"export function pvpGearBlowPct"`):
the striking piece's damage lines and gems (a fist's own pair of Hand Wraps), Way of the Sword's stacks from blows on
players, Many Endings' chance as its mean, Open Hand on a bare fist, Hunter's Moon at night, Orc Rage when low, Sweet
Mother's Kiss on a foe whose bar is under 25%, and First Blood and Silent Death on a foe not struck in the lock's minute.
Serpent's Kiss adds its flat 8 to a landed blow, 16 on a foe under half (`gf`).

The struck player's guard powers take a share off each armour share it reports, at most 30 off
(`pvpGearPowers.js:"export function pvpGearKept"`): Dawnward's every sixth blow as its mean,
Last Stand under its line, Bedrock's stacks and Hex's window from player hits taken, Bulwark's 5 as 5%. Client only:
the relay reads the same `g`, and the client is trusted for its gear as for its armour. The Raven is not a
share: PVP-EVADE rolls it on the relay as a miss.

Not between players: a slayer, bane or foe-group line (the owner: "same as human"); the splash of Chain Lightning and
Earthshaker (one blow, one target). Vigil, Divine Grace, Hist-Sap, Unyielding and the kill effects need the relay to
keep a heal or a count.

## PVP-WARD: resistances against a player's spell

A cast carries its spell's element (`el`, DFU's 0-4: fire, frost, poison, shock, magic;
`siegeCombat.js:"export const pvpSpellElement"`). The struck player reports, per element, what its Resist
effects let through, then its own saving throw - race, Willpower and gear, as a monster's spell meets it - summed over
the dice (`spellcast.js:"export function savingLands"`; `pvpGuard.js:"export function pvpWardKept"`, the report's
`w`). The caster's stand-in rolls no save. The referee holds each share to at least 15 - the owner's "85% resist", immunity included - and
takes it before PVP-HIT's cap (`refereeHealthShare.js:"export function wardedCast"`).

## PVP-TRIANGLE: archer over mage, mage over warrior, warrior over archer

The owner's triangle (2026-10-29: "tune it to 55% win", "just barely"), from a sim of the PvE overhaul's builds and gear
by level, its bow on the swing law, with players landing 30-50% of their attacks: the favoured side wins 42-67% at
levels 30-45. A player's arrow at a player is 1.28x, a harmful spell 0.96x; from level 40, as the last gear tiers land,
1.67x and 0.81x (`pvpTriangle.js:"export const PVP_TRIANGLE"`). A live Shield spell on a player is
reported (`sh`, `pvpGuard.js:"export const pvpShielded"`), and the referee takes 25% off a swing and 35%
off a shaft (`refereeHealthShare.js:"export const PVP_SHIELD"`) - the plan's "Shields max 25%". Aim and
movement decide the rest; staff fights tune these numbers.


## PVP-BUFFS: a buff runs a minute in a fight

The plan's "buffs last 1 min": each frame a refereed fight may hold the player (the health mirror's `active`), a spell
effect it cast for itself is cut to `pvpBuffs.js:"export const PVP_BUFF_ROUNDS"` magic rounds - a round is a game
minute, five seconds at DFU's 12x. A worn item's effect (`heldItem`) and a foe's harm are left whole
(`pvpBuffs.js:"export function capPvpBuffs"`). A departure: DFU has no PvP.

## PVP-POTIONS: one potion of a kind each 15 s in a fight

The plan's "potion timers 15 s, health / magicka / other": while a refereed fight may hold the player (the health mirror
sets `pvpPotions.js:"export function setPvpFight"`), each kind waits
`pvpPotions.js:"export const PVP_POTION_MS"` after the last of its kind, and the bottle is kept
(`pvpPotions.js:"export function pvpPotionRefusal"`). The kind is the first effect's: Heal Health, Heal Spell Points,
or other. A potion drunk in a fight lands its first effect alone (`pvpPotions.js:"export const pvpPotionBundle"`,
laid on at `hostMagic.js:"applySpellToPlayer(pvpPotionBundle(bundle)"`). A departure: DFU has no PvP and no potion clock.

## PVP-NO-DRAIN: Drain stays home

"remove drain till we can balance it": `siegeCombat.js:"export const PVP_SPELL_TYPES"` - Damage
alone, and a Heal Health, reach a player. Backstab was already off between players (BAL8).

## PVP-NO-POISON: no poison between players

"poison need diable in pvp": a Damage spell of DFU's poison element
(`siegeCombat.js:"export const PVP_POISON_ELEMENT"`) reaches no player. A weapon's poison never rode a PvP blow:
the striker's stub weapon carries none (`duelCombat.js:"weapon.poisonType"`).

## PVP-ARMOUR-CAST: plate and chain slow a caster in a fight

"do the plate cost and half its cost for chain": while a refereed fight may hold the player, each worn piece adds to a
spell's cost and takes off the cast rate by its own type
(`pvpArmourCasting.js:"export const PVP_ARMOUR_CAST ="`): plate 6% and 3%, chain half, leather nothing.
An RRI light set piece reads leather (`rriItems.js:"export function rriNativeMaterialValue"`). Full plate
costs 42% more and casts 21% slower. PvE is left whole. A departure: DFU has no such cost.

## PVP-SPELL-CRIT: a spell at a player crits

"spell cit is for this", "otherwise maghes fall off": a harmful spell at a player crits as a blow does under the overhaul
(`combat/combatStats.js` criticalModel's damage arm): `pvpSpellCrit.js:"export function pvpSpellCrit(caster) {"` -
Critical Strike / (4 - the Luck term) per cent, x(1 + 5% for each 5 points). Rolled once a cast on the caster's machine
(`siegeCombat.js:"harm: Math.round"`), before PVP-TRIANGLE's scale; the referee clips.
PvE is left whole. A departure: DFU's spells never crit.

PVP-CAST-SKILL (2026-10-30: "it was ment to scale with skill"): before the crit, a harmful spell at a player lands at most
0.15 x the caster's live Destruction, gear counted and no ceiling, as PvE's PVE-CAST holds it
(`pvpSpellCrit.js:"export const pvpCastHold = (caster) =>"`). The bar's Damage is that size, no level dice
(`pvpKit.js:"case 'damage':"`). Destruction
870 and Critical Strike 860 land about 1,250 before the triangle and PVP-HIT. A departure: DFU sizes a spell by level.

## PVP-FLAG: in the open zone only a flagged player strikes

"u flag and un flag instanly", "we changed it to 1m", "u cant flag on a party member": Caps Lock or the button at the right edge
(`pvpFlagHost.js:"export function createPvpFlagHost"`) puts the flag up at once from level 30, and takes it down at once
unless a PvP blow fell in the last minute (`pvpFlag.js:"export const PVP_FLAG"`).
The zone word carries it; the referee holds the lock and says each flag to the room
(`server/src/index.js:"_wildFlagSay(st, a, x, flagWas, wasIn, fl) {"`).

"flaggin is so yu dont hit a player when ur trying to kill a monster": an unflagged striker touches no player
(`wildRef.js:"if (!a.flag) return"`), and the flag never shields its bearer; party, duel and guild kin stay unhittable as before. The Portal Stone
works anywhere in the zone, flagged or not (PVP-PORTAL, below; `portalStoneHost.js:"const teleportRefused = (to) =>"`), its
arrival too (`portalStoneHost.js:"teleportTo(g.dest, { zoneFree: true })"`, AUDIT TAMRIEL-WIDE III F1). Chat types no
capitals under the flag's Caps Lock (`capsFix.js:"export function capsFixKey"`). Skulls overhead
come next. A departure: DFU has no flag.

"or i can flag anywerte": the flag is the zone's alone (PVP-FLAG-ZONE). Out of Cyrodiil, the open sea and their halls
the key and the button do nothing and the button is hidden (`pvpFlagHost.js:"const here = () =>"`);
a flag carried out comes down once the lock and a villain's meter let it (`pvpFlagHost.js:"const leave = ()"`).
"left center or right center" (PVP-FLAG-SPOT): the button stands at the screen's right edge, just over its middle, clear of the Decorate button
centred there ("fix this"), and PVP-HUD's ring and seconds follow it (`pvpHud.js:"export const PVP_FLAG_SPOT"`); flag down,
it shows a dim skull, never a green ring (PVP-FLAG-LOOK, "The green one looks bad the other r perfect").

## PVP-SKULL: the mark over a flagged player

"no skull when not", "when you agro skull turns gold", "make the gold and red glow sloightly": a 16-pixel skull
(`pvpSkull.js:"export const SKULL_ROWS"`) over the name (`nameLayer.js:"'skullOf', p.skull"`)
and on the flag button - none unflagged, white flagged, gold in aggro, red a villain. The referee says a flagged fighter's
aggro to the room on a blow, its ms left in the flag word's `a`, once each ten seconds
(`wildRef.js:"export function wildAggroWord"`). "overwold should show skulls": the Overworld's player marks
carry it over the name too (`travelViewMarks.js:"skull: pvpSkullOf(t.id) });"`). A departure: DFU has no PvP mark.


## PVP-30: no PvP under level 30

"add a are you sure to the 29 to 30 levleing", "explain this make u able to die in pvp zones": the referee reads the
character level the token signs (`cl`) and refuses every blow given or taken under 30, and any flag asked up
(`wildRef.js:"if (pvpYoung(a.cl) || pvpYoung(t.cl))"`). A token with no level is left to the game's own flag
refusal. Online, the level up from 29 to 30 asks first, Yes or Not yet; Not yet keeps the level owed
(`pvp30Ask.js:"export const pvp30Asks"`), on the sheet's door and the Growth tab alike. A departure: DFU has no PvP.

## PVP-DEATH: no safe passage after a death

"when u die u need to take away player protection form ebing killed again", "they go to town in a safe zone when dead": a
rise from a fall, or a return after a foe's kill, grants no safe passage (`wildRef.js:"const rose = z &&"`). This
replaces ZONE-GRACE's rise arm (`Wild-Zone.md`); an entry from outside, away and quiet, still grants it.

## PVP-EDGE: safe passage only for a walk in

"only from ebterin from the edge", "if u tp in no safe passage": the game says the zone word's `ed` only when its last
step outside was close and just now (`zoneEdge.js:"export const ZONE_EDGE"`), and
the referee grants an entry's safe passage on it alone (`wildRef.js:"if (!x.down && x.diedAt > -Infinity)".."!x.down &&"`). A
teleport, a dungeon or a building left, a town's streets left (they are in the zone, PVP-SAFE-HIT's `sf`) and a rise
grant none: the edge reads the zone's pixel alone (`world.js:"zoneEdgeSee(wildHere(), player.pos, Date.now())"`, AUDIT
TAMRIEL-WIDE III P2 - a shop's door had read as the edge). The relay has
no map, so the word is the client's own, as the streets' peace is.

## PVP-BAR: health over a flagged player

"How does the health and shield bar look", then "Perfect" to its mockup: a red health bar with a thin blue Shield strip
on top, between the skull and the name (`nameLayer.js:"const paintBar ="`), on flagged players alone. The
referee says each flagged fighter's bar to the room when it moves, in whole per cent, at most once each half second
(`wildRef.js:"export function wildBarWords"`), off the zone's beat
(`server/src/index.js:"_wildBarSay(st, now) {"`), and every bar to one entering. The referee knows a Shield spell as on
or off, never its amount, so the strip is whole or gone. A flagged stranger, nameless in the 3D scene, still shows its
skull and bar (`pvpFlagHost.js:"const shown = k &&"`).

"So a hidden player u only see the skull and hp bar", "They always have some body just fiant": a Chameleon or
Invisible player whose skull is gold is drawn faint, with skull and bar and no name
(`pvpFlagHost.js:"export const PVP_FIGHT_VEIL"`). A departure: DFU has no PvP.

## PVP-CONE: names near the crosshair

"Was thinking we needed to make them not visible less u look within a angle", and "Yes" to everywhere: another player's
tag - its skull, its bars and its bubble with it - shows only within about 20 degrees of the crosshair, full inside 17
and gone past 23 (`nameCone.js:"export const NAME_CONE"`). Each name
point carries its angle off the camera's forward (`remotePlayers.js:"off: nameOffDeg(view, head)"`), and the DOM layer
eases the whole tag toward the cone's answer over 250 ms, so a tag never pops (`nameLayer.js:"tag.cone = nameConeStep"`).

My party and my foe - a peer I struck or was struck by within the flag's lock - always show
(`pvpFlagHost.js:"const foeOf = (id)"`), passed through the name mask the host already wore. The client draws it;
the relay sends every name as before. The classic bitmap face, which only headless probes draw, keeps every name. The
Overworld's travel marks are left as they were. A departure: DFU has no player names.

## PVP-VILLAIN: the villain meter

"if u get attacked first u dont gain any villany to kill htem", "as well as if somoe attack your party", "so u cant get
pushed in becoming a villian its a CHOICES": each character has a meter from 0 to 10,000
(`villainLaw.js:"export const VILLAIN"`). A kill of a flagged player adds 100 for each level the
victim is under the killer, from 5 under; an unflagged victim adds the same and 2,000. Hits add nothing. A kill adds
nothing where the victim struck the killer, or one of its party, first in this fight - a blow between the two inside the
aggro's minute (`wildRef.js:"two inside PVP_FLAG.lockMs".."/** @type {any} */ st,"`; the party is the hub's word, `server/src/index.js:"async _wildVillainy(st, fall, now) {"`).
No clock, no gold and no death lower it.

At 5,000 the killer is a villain: a red skull (`pvpFlagHost.js:"const skullOf = (id)"`) and a flag the referee holds
up (`wildRef.js:"else if (isVillain(x.vi))"`). The referee counts a fall's points
(`wildRef.js:"const vp = villainKillPoints"`), keeps the meter on the fighter and in its carry, marks the flag word `v`,
tells the killer its meter (`wref` `vil`) and signs the points into the fall's receipt (`vp`). The top of the pause menu's
Standing page ("top of standings") shows "Villainy 3,240 / 5,000" on a bar to 10,000 with a red mark at 5,000
(`pvpVillainBar.js:"export function statsVillainy"`), always: out of the zone the last meter this browser heard, else 0
(`pvpVillainBar.js:"export function villainyKept"`).

PVP-VILLAIN-KEEP, below, keeps the meter on the character and lowers it. A departure: DFU has no PvP.

## PVP-VILLAIN-KEEP: the meter kept

The meter lived in the relay's memory alone, so a new relay instance forgot it. Now the character keeps it
(`realm_characters.villainy`, migration 0192). The account service adds a fall's signed `vp` to the killer's character in
the fall's own batch (`server-account/src/villainy.js:"export function villainFallSteps"`, wired in `wildFall` and in
REPEAT-SHIELD's `wildShielded`: a shielded kill is still a kill the killer chose). The batch writes the fall's remains id,
so a fall asked twice adds once. The meter is held to 10,000.

The mint signs it as `vl` beside the realm's yes (`realm.js:"vl: villainClamp"`, checked at
`identityToken.js:"if (c.vl !== undefined && !(c.rc === 1 && villainyIssuable(c.vl)))"`). The relay puts it
on the socket (`wildRef.js:"export const wildTokenAtt"`) and the referee takes the larger of it and the carried meter
(`wildRef.js:"if (villainClamp(vl) > villainClamp(x.vi))"`). A villain by its token is red at its
first step into the zone. The hello's token body is 928 now: a house beside every other claim and `vl` is 899.

What lowers it. A raid's claim takes 500, once by its own row, none while red
(`server-account/src/villainy.js:"export function villainRaidStep"`). A monster at or above my level
less 1 takes 1 and a quest done 200: the page adds them to its next Renown report as `vd`
(`renownTracker.js:"const vd = Math.min"`). The service takes no more than the XP that report credited, the
hour's progress bound, and never below 0 (`server-account/src/villainy.js:"export function villainReportDown"`). The monster's level and the
quest are the page's word, as the Renown they pay is. A departure: DFU has no PvP.

## PVP-RULES: a flagged fighter's limits

"when u get aggroed or flag up change speed levciataion all that jazz", "sleep need disable", "sleep spell as well": while
my flag is up in the open zone (aggro is a flag up, its skull gold), the law holds me
(`pvpRules.js:"export const pvpLimited"`, wired by `pvpRulesHost.js:"export function createPvpRulesHost"`).
Levitate lifts nothing and is not cast; the fall it ends costs no health, once
(`pvpRules.js:"export function pvpLevitateBarred"`, spent at `shared.js:"if (inOutdoorWater || takePvpFallSpare()) return;"`).
The flag going up ends every PvE buff - Fortify, Shield, the Resists, the concealments, Jumping, Climbing, Slowfall, Free
Action, Water Walking, Regenerate - a curse's and a duel's left whole
(`pvpRules.js:"export function stripPvpBuffs"`).

"Item buff no": a worn item's buff goes at each poll too, and the worn set is recast once the flag drops (`pvpRulesHost.js:"} else if (takePvpHeldTaken())"`). While it is up none is cast on myself but Shield, the
fight's own (`pvpRules.js:"export function pvpSpellRefusal"`), and the rest window stays shut.

The pace on foot and the jump are held to an unbuffed best, Speed and Running 100 and Jumping 100 with Athleticism
(`pvpRules.js:"export const PVP_LIMITS"`, read at
`motor.js:"export function registerMoveCap(name, fn) {"`). "No horse u demoibt", "Demount": a rider is set on foot and
the saddle refused (`mountRig.js:"const barred = isRiding(mode) ? rideBarred() : null;"`). Paralyze never reaches a player:
PVP-SPELLS lands a Damage or a Heal Health alone. A beast's change raises no flag - the flag host's own `set` alone sends
it. All of it is the client's: the relay refs only blows. A departure: DFU has no PvP.

## PVP-KIT: the PvP spell bar

"they only get to tool kit we give", "flagged has a seperate hot barr": while my flag is up in the open zone, the
hotbar's PvP set (PVP-SET, below) holds the toolkit's spells, each pressed the hotbar's way
(`pvpSpellMenu.js:"export function castKitSlot"`). Every other spell is refused under the flag, and only the toolkit's
spells reach a player (`world.js:"if (!wildFair(peerId) || !sp?.pvpKit) return false;"`). The first bar's eight slots
(`pvpKit.js:"export const PVP_KIT"`) are carried
into the set. Outside PvP the spell keys work as before.

PVP-SET (the owner, 2026-10-29: "player should get a whole second hot bar of the one we have", "hot bar need to use
exsistning one u stack one on top", "need a menu to make spells for thr hot bar small easy"): the hotbar has two sets of
the same slots (`quickslots.js:"export function useHotbarSet"`). The PvP set is in force while my flag is up in
the zone or the PvP menu is open (`pvpSpellMenu.js:"const inForce = ()"`): the same bar and
place, keys 1 to 0, held up whatever the bar's style (`uiSkin.js:"export function forceHotbar"`). It takes toolkit
spells and items, never a book spell; the save keeps the normal set alone. It lives in the browser; an old bar
(`dfo.pvpKitBar.v1`) lands on keys 3 to 0 with the normal set's potions on 1 and 2
(`pvpSet.js:"export function pvpStoreFromV1"`).

The menu (the PvP spells button on the bar, or the spellbook's) makes a spell from its kind, its element or attribute
and its icon, and lists it with its cost and where it lands. A row is dragged onto a slot, or clicked and then a slot
clicked (`enhancedHotbar.js:"export function hotbarDropKit(i, kit, name = '') {"`); a slot dragged off or right-clicked
clears.

Each slot shows its key, the cost a cast charges now, armour and all (`pvpSpellMenu.js:"export const kitCastCost"`),
a gold edge on the last cast, a shade that drains with the cast clock, grey when magicka is short, and a padlock while
the PvP combat lock runs (`pvpFlagHost.js:"fightLeft: () =>"`): the set cannot change then
(`quickslots.js:"if (!kept || frozen())"`). The classic skin has no hotbar: there a key whose slot holds a
toolkit spell casts it. A departure: DFU has no PvP.

"They get to pick damage and its a aoe", "Just our damage formula": Damage is the classic Fireball's record at Area at
Range in the picked element (`pvpKit.js:"const FIREBALL ="`), its harm the referee's path as before
(siegeSpellNumbers, the crit, the triangle, the ward, PVP-HIT); the bar's Poison is the one poison spell that reaches a
player. Each cast costs its share of maximum magicka (`pvpKit.js:"export const KIT_SPELLS"`,
`spellcost.js:"if (spell.pvpKitCost > 0)"`), and PVP-ARMOUR-CAST still adds to it.

The rest are CasterOnly gifts, a minute long, scaled with the governing school from 100 to 300. "Goo choose make it
15m": the party member under the crosshair within 15 m takes one, else I do
(`hostMagic.js:"const allyReach = sp.pvpReach ?? allyReachFor(sp.rangeType);"`); a stranger never does. A heal lands as
its receiver's own rise, so PVP-HEAL's window still caps it. Resist rides PVP-WARD's report; Reflect and Absorb take
their chance off it, never bouncing (`pvpGuard.js:"= ((100 - pvpReflectChance(entity)) * (100 - pvpAbsorbChance(entity)))"`). A Shield
reports its pool's share of my health, 10 to 25 (`pvpGuard.js:"export function pvpShieldShare"`), and the
referee takes that part of PVP-SHIELD's 25% and 35% off (the `vit` report's `sh`). Speed is Fortify Speed on Fortify's
numbers. Inside a zone dungeon the bar is off. A departure: DFU has no PvP.

PVP-KIT-REGEN (2026-10-30: "cure is worthless in pvp"): Regenerate takes Cure's slot, the classic Regenerate at
2% to 4% of the receiver's health each round for a minute, 10% of maximum magicka
(`pvpKit.js:"regen: Object.freeze"`). Each round is its receiver's own
rise, so PVP-HEAL's window caps it with every other heal. The relay prices it in Cure's place and banks its rounds
as health credit for the minute, at most `regenKit` (4%) a second (`pvpVitals.js:"else if (id === 'regen')"`). A
saved Cure slot loads as Regenerate
(`pvpKit.js:"if (raw?.id === 'cure')"`). A departure: DFU has no PvP.

PVP-KIT-REZ (the owner, 2026-10-29: "Add resurrection to the. Mages tool belt"): Resurrect is a slot spell at 25% of
maximum magicka (`pvpKit.js:"resurrect: Object.freeze"`). It is the shop's own Resurrection,
by touch (`pvpKit.js:"case 'resurrect':"`), with no 15 m gift: it goes
through RESURRECT1's path, a fallen party member's body within RESURRECT_REACH
(`hostMagic.js:"try { bodies = fallenTarget(eye, dir, RESURRECT_REACH) ?? null; } catch { return null; }"`). The host
hands only party members' bodies (`world.js:"const mate = cAcct ? social.others().find((m) => m.acct === cAcct) : null; if (!mate) continue;"`),
and the fallen player's own client rises only on its party's call. A departure: DFU has no raise-dead effect.

## PVP-REWARD: one random piece, or one policy's gold

"they only get a piece that isnt insured", "random roll on uninsure peices": a kill in the open zone gives its killer one
worn piece, rolled by the account service on the fallen's record, never chosen and never rolled on a game
(`pvpReward.js:"export function pvpRewardRoll"`, called at
`server-account/src/wild.js:"const roll = burnt"`).
The roll skips a piece a policy in force or a ledger hold keeps. The pick and the worn offer are gone: the relay signs
a fall after `wildRef.js:"pickMs: 10_000,"`, so the fallen's first dead frame lays its body first, and the service reads
no `w`. The piece reaches the killer through the escrow and the collect. A hall's kill rolls too.

"random policy gold": when every worn piece is insured, the killer gets the premium of one random policy, and that
policy is spent; the piece stays. The gold lies in the remains as the killer's alone, held in escrow (a room that signs no
collect pays none and spends none). It is never the fallen's: no reclaim, and no listing for her tab. "if gold will
ovrweight a player u get a letter of credit": the killer's collect says its free weight (`free`), and the service pays
coin where it fits, else a letter of credit for the whole - the trade window's own rule
(`pvpReward.js:"export const pvpGoldPaid"`). A tab that says no weight gets the letter.

"get rid of the bag drop": no bag piece drops at a kill
(`server-account/src/wild.js:"drop = takeWildDeath"`). The purse's
tenth and the letters' tenth went to the remains until PVP-NO-TENTH, below; the cart and the packs stay storage. A villain has no insurance:
`pvpReward.js:"export const pvpInsuredFor"` takes `villain`: "villian lose insurance" - a fallen whose kept meter is red holds no policy
(`wild.js:"{ villain: isVillain"`). "Insurance cost 20%": a
premium stays a fifth of `itemWorth` (`wildInsureLaw.js:"export const WILD_INSURE_DIVISOR"`), which counts the
piece's price and its lines' worth - and, since INSURE-ALL (`Wild-Zone.md` 4b), the item maker's gold, on every piece of
gear. The service is acct214 (acct211 on its branch). A departure: DFU has no PvP.

## PVP-RISE: a death's wait like PvE's

"Need to have to eake up im nearest town", "Jist like pve deaths": a death in the zone rises at the nearest town or temple
outside it (Wild-Zone.md THE RISE, as before), after the online PvE wait of 60 s
(`WILD_DEATH_HOLD_S`, 60 s then; DEATH-10 below), not two minutes. The referee keeps the fighter down as long
(`WILD_REF.riseMs`, the wire's `down` word at most `WILD_DOWN_MS_MAX`). A departure: DFU has no PvP.

DEATH-15 ("Change that to 15 second on death", "For both"; the owner chose to keep the Resurrect minute): online, in
the zone or out of it, Enter rose once 15 s of `DEATH_RISE_MIN_S` had passed (DEATH-10 below; a rejoin's
served time counts, `canRise`); until then the screen says only the count. The rest of the minute is for a party
member's Resurrect, and the body still lies the minute. The raise window is the longest screen and half a minute,
`revived.js:"export const REZ_HOLD_S"` (150 while the zone held two minutes). Relay world282. A departure: DFU
rises after its three seconds.

DEATH-10 (2026-10-30, the owner: "give death a 10 second timer let them click respawn now but at 10 auto respawn
them", "for pve and pvp"): online, Enter rises at once (`deathScreen.js:"export const DEATH_RISE_MIN_S"`) and the
screen rises by itself at `deathScreen.js:"export const DEATH_AUTO_RISE_S"`, in the zone
`wildZone.js:"export const WILD_DEATH_HOLD_S"`. The referee keeps a fallen down 10 s
(`wildRef.js:"riseMs: 10_000,"`, the wire's word at most `wire.js:"export const WILD_DOWN_MS_MAX = 10_000;"`). A step
out of the zone still heals whole only after the minute (`awayMs`). A party Resurrect has those 10 s, and the body
still lies the minute. Relay world293. A departure: DFU rises after its three seconds.

## PVP-NO-TENTH: no tenth at a kill, gold as the last roll

"No gold dropped on death pvp detached gives gold as a last roll if no item or insurance", "No only the insurance": a
player kill takes no tenth of the purse and lowers no letter, and nothing lies in the remains for anyone
(`server-account/src/wild.js:"drop = takeWildDeath"`). The roll
is a worn piece, else one policy's gold, else THE LAST ROLL - only with no worn piece to take and no policy to pay
(`wild.js:"const lastRoll ="`). "Only give them some of their total or letter of
credit or gold what ever =10%", "Letter only pay out 10% if they have not enough gold": a tenth of the coin and the
letters together, the purse first, the letters (bag order) paying only what it cannot
(`wildDropLaw.js:"export function takeWildLastRoll"`).

The gold goes to the killer the way a policy's gold does: escrowed, his alone in the remains, never the fallen's to take
back, collected as coin where it fits his free weight, else one letter of credit for the whole. The collect says it is
the last roll (`wild.js:"return parse(fall?.tk)"`), and so does each side's text
(`wildZone.js:"lastGold: (n) =>"`, `wildZone.js:"deathLast: (name, gold)"`). A held record, a REPEAT-SHIELD kill
and a room that signs no collect take nothing. A foe's death keeps everything, as FOE-KEEPS says. The service is
acct215. A departure: DFU has no PvP.

## PVP-GUARDS: the watch hunts a villain in town

"Guards constantly come after a villain", "like my self coming for me": while I am red on the villain meter in a
settlement's streets of the open zone, the watch sends two guards at once, one more each 30 s, six at most
(`villainHunt.js:"export const VILLAIN_HUNT"`). Each comes on
the watch's ring at my level, my mirror turned to a guard's use (`villainHunt.js:"export function villainMirror"`):
every weapon skill my best attack skill (any weapon, Hand-to-Hand, Archery or Destruction), my Critical Strike, and
Dodging the best of my Dodging, Restoration and Alteration, since a guard casts nothing. DFU has no Block skill: a
shield's block reads six attributes, and each of mine that beats the guard's own is its. It keeps its own kit.

"they have 95 % resistance": a hunter takes 5% of every hit, at least 1, at the watch's one damage door
(`cityGuards.js:"damage = hunterTaken(g.entity, damage);"`). It is no crime's watch, so the crime's clearing does not
send it away; once I leave the streets, fall or am red no more, every hunter walks away
(`pvpGuardsHost.js:"export function createPvpGuardsHost"`), as DFU's watch does at the location's edge.

"a villain can always take damage in a town": the streets keep no peace for a villain
(`villainHunt.js:"export const peaceFor"`). Red, my word on the zone stays 1 there, and a red body there is fair to
every door of mine. A player in the streets is at peace, and strikes a villain alone (PVP-SAFE-HIT, below). Guards are
this client's NPCs, so the hunt is the client's, on the meter the relay already says (`wref` `vil`); a villain who
enters the zone in a town is hunted from its first step out of the streets. THE FOUR HOSTS: `world.js` wired;
`exterior.js`, `worldModes.js` (a building) and `dungeonContext.js` hunt no one. A departure from
PlayerEntity.SpawnCityGuards (`PlayerEntity.cs:625-694`): DFU sends 2-5 once for a crime, at my level plus 3-6, every
skill level x 5 + 30, and its watch resists nothing.

## PVP-SAFE-HIT: from the streets, a villain alone

"Let them hit them jit ge that back in safezone": in a settlement's streets of the open zone, a player who is no villain
may strike a red villain, and nobody may strike that player there. My word on the zone is 2 there
(`world.js:"online?.setWildZone?.(wildCan() ? 1 : wildCan(true) ? 2 : 0, playerEntity.health <= 0,"`), said as 1 with
`sf` (`online.js:"const sf = zone === 1 && this._wildStreets"`). The referee holds both sides
(`wildRef.js:"export function wildStreetsBar"`): no blow lands on a fighter in the streets who is no villain on
the meter it keeps, and one from there lands on a villain alone. A villain who says the streets is struck all the same.
The sea's guns read the same bar (`seaRef.js:"if (wildStreetsBar(a, x))"`).

My doors agree: from the streets a red body alone is fair
(`world.js:"&& streetsStrike(zoneSafe(), pvpFlag.skullOf(peerId) === 'red');"`), and a blow there calls no watch
(`world.js:"if (!inTown || !wildHere() || zoneSafe()) return;"`). The safe line says so (`zoneSafe.js:"get enter()"`).
A relay before world283 does not read `sf`, so it hears 0 there, as before
(`wire.js:"export const WILD_STREETS_RELAY_MIN = 283;"`). Relay world283. A departure: DFU has no PvP.

## PVP-LINGER: a body stays out its lock

"keep their body in game if they login in the window of cooldown": a fighter whose last socket in a room closes inside
the lock of a PvP blow given or taken leaves its body in the zone until the lock runs out
(`wildLinger.js:"export function lingerUntil"`). Peers keep its last pose, said again before their silence law hides it,
and one who enters is shown it (`pvpLinger.js:"export async function lingerHello("`). Flagged players strike it by the
referee's law (`server/src/index.js:"const target = this._idFirst(d.to) ?? lingerTarget(this, d.to);"`); it moves and
casts nothing, and a blow on it renews its lock, never past three minutes from the close. A kill is a normal PvP kill: the
villain points, and a fall signed with its fallen away (`g` 1), so its killer carries the receipt at once and the
account service rolls the reward as for any kill. No account change was needed.

The body goes as a normal leave when its lock runs out or its fall is signed (`wildLinger.js:"export function lingerOver"`).
Its account's hello in that room takes it back, with the health the referee kept and no safe passage
(`pvpLinger.js:"function lingerTaken("`); a hello in another room ends it at the room's next ask of the hub. A villain
stays only when a blow fell in the lock. A close outside the lock, a hidden socket, or the room's last socket leaves at
once. Relay world290. A departure: DFU has no PvP.

PVP-LINGER-RISE ("So u respawn in town if u get killed and log back in?"): yes. A body slain while its player is away
is kept in its room's storage for a week (`pvpLinger.js:"export async function lingerSlain("`). The player's next word
that it stands in the zone is a `down` word with `aw` 1 and its killer's name
(`wildLinger.js:"export function lingerAwayWord"`): ten seconds on the death screen, or the referee's own wait if it is
still down, then the zone's rise in the nearest town outside it, with no safe passage (PVP-DEATH). The screen says who
killed it (`wildZone.js:"deathAway: (/** @type {string | null | undefined} */ name)"`). A log-in in another room, or after a week, hears nothing, and the player stands
where the save left it. The relay says it, not the account service: no account change.

## PVP-HUD: the combat lock, shown

"do we show comag timer rong and cooldown flkag rinf?", "was in mock up": the approved mockup, client only
(`pvpHud.js:"export function createPvpHud"`, wired by `pvpFlagHost.js:"if (doc.body && typeof doc.createElementNS === 'function')"`).
The lock is PVP_FLAG.lockMs, 60 s for all. A red SVG ring round the flag button empties over it and fills again at each
PvP blow, its seconds under it; a villain's ring is full (`pvpHud.js:"export function pvpRing"`). While the lock runs
the next frame is asked, so the ring moves smoothly; out of it nothing runs. A small bronze banner top-centre says "In
combat" and the seconds. There is no "turning off" ring: the flag drops at once outside the lock.

The lock's lines are said mid-screen 3 s (`pvpHud.js:"export const PVP_SAY_S"`): the flag's own drop, a Portal
Stone (`portalStoneHost.js:"const lockRefused = () => {"` - a hold: in the lock the door and the pick refuse, flagged or
not, PVP-PORTAL), rest (`pvpRulesHost.js:"const restLock ="`,
asked before the flag's own line) and the end, "You are out of combat." (`pvpFlagHost.js:"const beat = () =>"`).
Log out in combat is the relay's, built apart.

**PVP-PORTAL** (2026-10-30, the owner: "they need to work all over", held only by "agro or flag time cool down"): a
Portal Stone asks none of the zone's teleport law, flagged or not - its door, its pick and its step go into, out of and
across Cyrodiil (`portalStoneHost.js:"const teleportRefused = (to) =>"`). Two holds stand in the zone: the combat lock
after a PvP blow, whatever the flag (`portalStoneHost.js:"const lockRefused = () => {"`), and a monster alerted to me -
the owner's pick, "Only one attacking me" - never one merely near
(`portalStoneHost.js:"enemies: wildHere() ? exteriorFoes.foes.some(foeAlerted) :"`). Out of the zone the stone keeps
its holds. The guild's teleport, Recall and a party's journey keep the zone's law.

"Last hits", bottom right: my three newest PvP blows, flagged in the zone while the lock runs
(`pvpHud.js:"export function pvpHitLine"`). The referee's `hp` word carries who, on whom and what was dealt, so a Shield's
share and a resist are not shown. A name is the one my name layer shows; a stranger's is "a player". My party wears its
green name and bar, no skull, and a bar under 20% flashes (`nameLayer.js:"export const pvpBarLow"`).

My kill says "You slew" (`pvpHud.js:"export const pvpSlewText"`); the fallen's screen heads its lines "Slain by"
(`wildZone.js:"export const wildDeathSlain"`). A villain the room says is red is marked on the Overworld where the
law would hide it, nameless (`travelViewMarks.js:"const villainMark = (id, at, dropped) => {"`); one in no room of mine
is unknown to this client. The owed level 29 reads "Level 29 · 1 level owed", its button "Go to 30"
(`pvp30Ask.js:"export const pvp30Owed"`). Tests: `test/ui/pvphud.test.js`. A departure: DFU has no PvP.

## PVP-VITALS: the relay owns a flagged fighter's pools

"we need to make sure players cant cheat health in pvp", "cheat health mana or fatigue": a game could freeze or set its
own bars, and the relay believed its reports. While a fighter's flag is up in the open zone, its health rises by report
only out of a credit the relay grants: a slow regen, a declared potion on the relay's own 15 s clock, or a heal it saw
paid for (`refereeHealthShare.js:"const got = Math.min"`).

Magicka and fatigue are the relay's own ledgers, anchored at the game's word while the flag is down. Each refereed cast
and swing pays the PvP bar's cheapest price, or lands nothing (`wildRef.js:"? !castPaid(a.f, c, to, now)"`).
A party member's gift is paid where the relay passes it (`server/src/index.js:"async _wildCastPaid(a, tb, data, now) {"`).
A Shield counts only while a paid one runs. The health whole is held to the signed level's.

The game declares its potions and self-cast bar spells in its report (`pvpDeclare.js:"export function declarePotion"`).
A harmful cast carries its number, so one area cast is one price. Not yet the relay's: armour and
resistances. Relay world293. Tests: `test/net/pvpvitals.test.js`. A departure: DFU has no PvP.

BOW-RATE: an arrow comes no sooner than the fastest honest bow, its four-tick loose with no reload, so 0.25 s. Two may
arrive together over a late network. A sooner one lands nothing (`wildRef.js:"=== SIEGE_HIT.Shaft ?"`).
The relay cannot trust a Speed, so it holds every build to that floor. A slower bow law can raise it.

SWING-RATE: a melee blow on one player comes no sooner than the quickest swing, five frames at the 0.09 s floor, so
0.45 s, two deep. It is counted per target, because a Cleave lands on each player in its arc.

BOW-FAST: the relay cuts a shaft it judges by a fifth for each arrow within its bow's window of the last (a Short Bow 0.75 s, a Long Bow 1.25 s, else 1 s), four at most
(`pvpVitals.js:"export function bowFastCut"`). The game sends that claim uncut, so it cannot skip the cut. The zone strike is marked `relayCut`, and the game keeps
only the bow's pull (`duelCombat.js:"const scaled = geared".."const n ="`).
