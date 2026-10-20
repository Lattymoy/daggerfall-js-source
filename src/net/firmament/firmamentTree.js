// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIRM1 (2026-10-13; the lead dev, on Discord: "with the POE tree stuff, i would recommend almost 1to1 copy pasting its
// structure and then attach everything you can do in daggerfall online to it, Magic, Phys based attacks and skills,
// trading, gathering, hunting, ship controls/ocean stuff in general ... So ppl can be a awesome trader, or a better
// gatherer crafter etc ... guilds will also benefit from it ... make sure the tree looks awesome and investing points in
// there feels rewarding. Must suit DFO Grimoire and Enhanced plus ui"). bible/06-Systems/Firmament.md is the record.
//
// THE FIRMAMENT - THE TREE ITSELF: every star (node), where it stands and what it is joined to. Path of Exile's shape,
// one for one, laid on Tamriel's sky:
//
//   - SEVEN STARTS, as PoE's seven classes stand: the Mage at the top (the Witch's place, Intelligence), the Shadow
//     (Agility and Intelligence), the Thief (Agility, the Ranger's), the Steed at the foot (Speed and Strength, the
//     Duelist's), the Warrior (Strength and Endurance, the Marauder's), the Ritual (Willpower and Strength, the
//     Templar's) - each on the inner ring - and the Serpent in the middle, the Scion's place, who wanders to all six.
//   - THE INNER SKY (to r 800) is COMBAT: each sign's spoke of its attributes, the ring road at r 400, six wheels and
//     forks of small stars round named NOTABLES, and a KEYSTONE at the end of the sign's own radial - a rule that
//     costs as much as it gives.
//   - THE OUTER SKY (r 900 on) is the LIFE RING, Albion's destiny board laid round PoE's: each sign's wedge holds the
//     trades that sit with it (the Warrior's the mine, the forge, the mason's yard and the woods; the Ritual's the
//     herb, the still and the weather; the Mage's the runes; the Shadow's the market; the Thief's the hunt and the
//     tanner's bench; the Steed's the sea, the net and the road), and a life keystone of its own.
//   - THE WAYFARER'S ROADS run between the signs (at each sign's angle plus 30) from the inner ring out to the life
//     ring. They are LIFE stars, so a character who has earned Craft points and no Stars can still walk out to the
//     trades (firmamentLaw.js POINTS).
//
// PERSISTED DATA: a star is known by its KEY (`wr.c1.3`), and an allocation is a list of keys (the account service's
// firmament row). A key never changes once shipped and is never reused for another star; a star removed from this table
// is simply refunded (firmamentLaw.js cleanKeys drops a key no table holds). New stars take new keys.
//
// BAL10 (2026-10-17, bible/05-Combat/Balance-Arc.md section 16; the owner chose "Firmament weapon keystones"): EVERY WEAPON
// FAMILY TWO NOTABLES OF ITS OWN, each raising its skill - Blade Dancer and Iron Knuckles took the Long Blade's and the
// fist's second; Headsman and Bonebreaker the Axe's and the Blunt Weapon's (the thinnest two, one skill notable each, in the
// one sign); and Carnage (the Warrior's) and the Ritual's Templar's Mace (Battlemage's Focus until then)
// a third each. Stats moved, never a key nor a star: the layout, the keys' hash and every build code stand, and no channel
// of any sign passes its cap (test/net/firmament/firm2_balance.test.js). AUDIT MARTIAL L2 F9: the four skill notables keep
// every stat they had and gain the skill beside it - a skill line buys to-hit alone, which PCAAO clamps at 97 from about
// 65 (the arc's own section 2), so a stat traded for one was a stat lost to every fighter past it.
//
// PURE and import-free: the account Worker bundles it (account-deploy.yml's path filter) and the client draws it. The
// table is BUILT once at import from the authored spec below - deterministic, no randomness - and frozen.
// ═══════════════════════════════════════════════════════════════════

/** @typedef {Record<string, number>} Stats */
/** @typedef {'start'|'road'|'small'|'notable'|'keystone'} NodeKind */
/** @typedef {'combat'|'life'} Ring */
/**
 * @typedef {{ key: string, kind: NodeKind, ring: Ring, sector: string, cluster: string|null, name: string,
 *   stats: Readonly<Stats>, text?: string, x: number, y: number }} FirmNode
 */
/** @typedef {{ a: string, b: string, arc?: { cx: number, cy: number, r: number } }} FirmEdge */

// ─── THE SIGNS (PoE's classes, Tamriel's constellations) ─────────────

/** Every sign, in the sky's order clockwise from the top. `angle` in degrees, 0 up; `attrs` the sign's attributes; `lore`
 *  one line for its start's card. The Serpent stands in the middle. */
export const SIGNS = Object.freeze([
  Object.freeze({ id: 'mg', name: 'The Mage', angle: 0, attrs: Object.freeze(['intelligence']), lore: 'One of the three Guardians, whose charges are the Apprentice, the Atronach and the Ritual. Those born under the Mage are drawn to sorcery.' }),
  Object.freeze({ id: 'sh', name: 'The Shadow', angle: 60, attrs: Object.freeze(['agility', 'intelligence']), lore: 'Charge of the Thief. Those born under the Shadow move unseen and strike when least expected.' }),
  Object.freeze({ id: 'th', name: 'The Thief', angle: 120, attrs: Object.freeze(['agility']), lore: 'One of the three Guardians, and the luckiest. Its charges are the Lover, the Shadow and the Tower.' }),
  Object.freeze({ id: 'st', name: 'The Steed', angle: 180, attrs: Object.freeze(['speed', 'strength']), lore: 'Charge of the Warrior. Those born under the Steed are restless and quick, at home on the road and on the sea.' }),
  Object.freeze({ id: 'wr', name: 'The Warrior', angle: 240, attrs: Object.freeze(['strength', 'endurance']), lore: 'One of the three Guardians, whose charges are the Lady, the Steed and the Lord. Those born under the Warrior are skilled with every weapon.' }),
  Object.freeze({ id: 'rt', name: 'The Ritual', angle: 300, attrs: Object.freeze(['willpower', 'strength']), lore: 'Charge of the Mage. Those born under the Ritual are healers, and a terror to the undead.' }),
]);
/** The Serpent - the middle of the sky, the Scion's place. */
export const SERPENT = Object.freeze({ id: 'sp', name: 'The Serpent', lore: 'The Serpent wanders the heavens and serves no Guardian. From the center of the sky every road is open to it.' });
/** Every start's key: a sign's `<id>.start`, the Serpent's `sp.start`. */
export const START_KEYS = Object.freeze([SERPENT.id, ...SIGNS.map((s) => s.id)].map((id) => `${id}.start`));

// ─── THE GEOMETRY ────────────────────────────────────────────────────

/** The radii the roads stand on (tree units; the sky is about 2,700 across). */
export const FIRM_RADII = Object.freeze({
  start: 150, spoke1: 245, spoke2: 330, ring: 400, rad1: 530, rad2: 660, keyApproach: 730, keystone: 800,
  way1: 275, way2: 560, way3: 720, life: 900, lifeRad1: 1000, lifeRad2: 1130, lifeApproach: 1210, lifeKeystone: 1290,
});
const toRad = (deg) => (deg * Math.PI) / 180;
/** A point at radius `r` and bearing `deg` (0 up, clockwise), rounded to a tenth. */
const at = (r, deg) => ({ x: Math.round(r * Math.sin(toRad(deg)) * 10) / 10, y: Math.round(-r * Math.cos(toRad(deg)) * 10) / 10 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ─── THE AUTHORED SKY ───────────────────────────────────────────────
//
// A cluster: `id`, `tpl` (wheel | fork | chain), `n` small stars, `small` the small stars' stats (an array cycles),
// `notables` [{ name, stats }]. WHERE it stands is its SLOT's (SLOTS, below - by its index in the list): a wheel's
// stars round a circle, its entry facing the star it hangs from and its notables across from it; a line's stars out
// from the star it hangs from along a bearing, a fork splitting into two notables, a chain ending in one. A slot that
// stands a line draws a fork or a chain; any other draws a wheel (a fork's three small stars and two notables make a
// small wheel of five).

const N = (name, stats) => Object.freeze({ name, stats: Object.freeze(stats) });
const K = (name, stats, text) => Object.freeze({ name, stats: Object.freeze(stats), text });

/** Each sign's own sky: its roads' stats, its six combat clusters and keystone, its life ring and four life clusters. */
const SKY = {
  // ══ THE MAGE - Intelligence: destruction, magicka, the price and pace of a spell, wards ══
  mg: {
    start: { intelligence: 2 },
    roads: { s1: { intelligence: 2 }, s2: { intelligence: 2 }, g: { intelligence: 3 }, r1: { mp: 9 }, r2: { spellPower: 2 }, k1: { castCost: 2 } },
    combat: [
      { id: 'c1', tpl: 'wheel', n: 5, small: { mp: 4 }, notables: [N('Deep Wells', { mp: 15, intelligence: 3 }), N('Font of Magnus', { mpRegen: 2, mp: 8 })] },
      { id: 'c2', tpl: 'fork', n: 3, small: { spellPower: 2 }, notables: [N('Searing Will', { spellPower: 5, 'skill.Destruction': 6 }), N('Sundering Word', { spellPower: 3, spellPierce: 4 })] },
      { id: 'c3', tpl: 'wheel', n: 5, small: { castCost: 2 }, notables: [N('Efficient Incantation', { castCost: 5 }), N('Synod Discipline', { 'castCost.Destruction': 6, 'skill.Destruction': 4 })] },
      { id: 'c4', tpl: 'chain', n: 4, small: { castSpeed: 2 }, notables: [N('Words Unspoken', { castSpeed: 5, intelligence: 3 })] },
      { id: 'c5', tpl: 'wheel', n: 6, small: [{ 'resist.fire': 3 }, { 'resist.frost': 3 }, { 'resist.shock': 3 }], notables: [N('Prismatic Skin', { 'resist.fire': 5, 'resist.frost': 5, 'resist.shock': 5 }), N('Sigil of Absorption', { absorb: 5 })] },
      { id: 'c6', tpl: 'fork', n: 3, small: [{ 'skill.Mysticism': 3 }, { 'skill.Thaumaturgy': 3 }], notables: [N('Soul Siphon', { killMana: 3, 'skill.Mysticism': 4 }), N('Unseen Geometry', { 'skill.Thaumaturgy': 6, 'resist.magic': 5 })] },
      { id: 'c7', tpl: 'wheel', n: 4, small: { intelligence: 2 }, notables: [N("Apprentice's Study", { intelligence: 4, 'skill.Destruction': 3, mp: 5 })] },
    ],
    keystone: K("Atronach's Pact", { spellPower: 12, castCost: 8, blowTaken: 7 }, 'Your spells strike harder and cost less, but blows strike you a little harder.'),
    life: { ring: [{ 'xp.enchanting': 1 }, { 'xp.provisioning': 2 }], lr1: { 'xp.enchanting': 1 }, lr2: { 'skill.Medical': 3 }, la: { 'xp.enchanting': 2 } },
    lifeClusters: [
      { id: 'l1', tpl: 'wheel', n: 5, small: { 'xp.enchanting': 2 }, notables: [N('Runic Fluency', { 'xp.enchanting': 5 }), N('Soul-Gem Cutter', { 'xp.enchanting': 3, 'xp.smithing': 3 })] },
      { id: 'l2', tpl: 'wheel', n: 5, small: { 'skill.Medical': 3 }, notables: [N("Physician's Hand", { 'skill.Medical': 8, fatigueLess: 4 }), N('Field Surgeon', { 'skill.Medical': 5, 'xp.provisioning': 3 })] },
      { id: 'l3', tpl: 'fork', n: 3, small: { 'xp.provisioning': 3 }, notables: [N('Alembic Master', { 'xp.provisioning': 8 }), N('Distilled Insight', { 'xp.provisioning': 4, 'xp.enchanting': 2 })] },
      { id: 'l4', tpl: 'chain', n: 4, small: [{ 'xp.smithing': 2, 'xp.outfitting': 2 }, { 'xp.building': 2, 'xp.enchanting': 1 }], notables: [N('Lorekeeper', { 'xp.smithing': 4, 'xp.building': 4, 'xp.outfitting': 4, 'xp.provisioning': 3, 'xp.enchanting': 2 })] },
    ],
    lifeKeystone: K("Scholar's Seclusion", { 'xp.smithing': 5, 'xp.building': 5, 'xp.outfitting': 5, 'xp.provisioning': 5, 'xp.enchanting': 5 }, 'Every craft of the workshop teaches you more.'),
  },
  // ══ THE SHADOW - Agility and Intelligence: stealth, the unseen blow, illusion, the short blade ══
  sh: {
    start: { agility: 1, intelligence: 1 },
    roads: { s1: { agility: 3 }, s2: { intelligence: 3 }, g: { agility: 2, intelligence: 2 }, r1: { 'skill.Stealth': 4 }, r2: { unawareDmg: 2 }, k1: { 'skill.Illusion': 4 } },
    combat: [
      { id: 'c1', tpl: 'wheel', n: 5, small: { 'skill.Stealth': 3 }, notables: [N('Shroud of Night', { 'skill.Stealth': 7, 'skill.Illusion': 4 }), N('Unheard', { 'skill.Stealth': 4, evade: 2 })] },
      { id: 'c2', tpl: 'fork', n: 3, small: { unawareDmg: 3 }, notables: [N('Throat-Cutter', { unawareDmg: 6, 'skill.Backstabbing': 6 }), N('Sacrament of Sithis', { unawareDmg: 4, killHeal: 2 })] },
      { id: 'c3', tpl: 'wheel', n: 5, small: { 'skill.Illusion': 3 }, notables: [N('Veil of Mirrors', { 'castCost.Illusion': 8, 'skill.Illusion': 5 }), N('Glamoured Blade', { spellPower: 4, 'skill.ShortBlade': 4 })] },
      { id: 'c4', tpl: 'chain', n: 4, small: { 'skill.CriticalStrike': 3 }, notables: [N('Exploit Weakness', { 'skill.CriticalStrike': 8, weaponDmg: 4 })] },
      { id: 'c5', tpl: 'wheel', n: 5, small: { shortDmg: 3 }, notables: [N('Dagger Dance', { shortDmg: 6, 'skill.ShortBlade': 5 }), N('Quick Fingers', { speed: 3, 'skill.ShortBlade': 4 })] },
      { id: 'c6', tpl: 'fork', n: 3, small: [{ mp: 5 }, { intelligence: 2 }], notables: [N('Siphon Will', { killMana: 3, mp: 8 }), N('Twilight Mind', { 'skill.Mysticism': 5, 'resist.magic': 6 })] },
      { id: 'c7', tpl: 'wheel', n: 4, small: [{ agility: 2 }, { intelligence: 2 }], notables: [N('Child of the Shadow', { 'skill.Stealth': 4, agility: 2, intelligence: 2 })] },
    ],
    keystone: K("Night Mother's Embrace", { unawareDmg: 19, weaponDmg: -5 }, 'Blows against the unwary are deadly. In open battle your weapons are a little weaker.'),
    life: { ring: [{ 'skill.Mercantile': 3 }, { 'skill.Streetwise': 3 }], lr1: { personality: 2 }, lr2: { carry: 3 }, la: { 'skill.Mercantile': 4 } },
    lifeClusters: [
      { id: 'l1', tpl: 'wheel', n: 5, small: { 'skill.Mercantile': 3 }, notables: [N('Silver Tongue', { 'skill.Mercantile': 4, personality: 3 }), N("Bargainer's Eye", { 'skill.Mercantile': 3, 'skill.Etiquette': 4 })] },
      { id: 'l2', tpl: 'wheel', n: 5, small: { carry: 3 }, notables: [N('Pack Mule', { carry: 8 }), N('Road-Hardened Trader', { carry: 5, fatigueLess: 8 })] },
      { id: 'l3', tpl: 'fork', n: 3, small: [{ 'skill.Streetwise': 3 }, { 'skill.Pickpocket': 3 }], notables: [N("Fence's Ledger", { 'skill.Streetwise': 8, 'skill.Mercantile': 2 }), N('Light Fingers', { 'skill.Pickpocket': 8, 'skill.Lockpicking': 5 })] },
      { id: 'l4', tpl: 'chain', n: 4, small: { 'skill.Etiquette': 3 }, notables: [N('Friend of Every Court', { standing: 4, 'skill.Etiquette': 6, personality: 3 })] },
    ],
    lifeKeystone: K('Merchant Prince', { 'skill.Mercantile': 11, 'skill.Etiquette': 6 }, 'Every merchant in the Iliac Bay knows your name, and every noble house your manners.'),
  },
  // ══ THE THIEF - Agility: the bow, the dodge, the run, the beast-hunter ══
  th: {
    start: { agility: 2 },
    roads: { s1: { agility: 2 }, s2: { agility: 2 }, g: { agility: 3 }, r1: { bowDmg: 1 }, r2: { 'skill.Dodging': 4 }, k1: { bowDmg: 3 } },
    combat: [
      { id: 'c1', tpl: 'wheel', n: 5, small: { bowDmg: 2 }, notables: [N('Deadeye', { bowDmg: 5, 'skill.Archery': 6 }), N('Long Shot', { bowDmg: 4, agility: 3 })] },
      { id: 'c2', tpl: 'fork', n: 3, small: { 'skill.Dodging': 3 }, notables: [N('Acrobat', { evade: 2, 'skill.Dodging': 5, 'skill.Jumping': 5 }), N("Wind's Grace", { evade: 2, speed: 3 })] },
      { id: 'c3', tpl: 'wheel', n: 5, small: [{ 'skill.Running': 3 }, { speed: 2 }], notables: [N('Quicksilver', { speed: 5, 'skill.Running': 5 }), N('Second Wind', { hpRegen: 2, endurance: 3 })] },
      { id: 'c4', tpl: 'chain', n: 4, small: { beastDmg: 4 }, notables: [N('Beastbane', { beastDmg: 10, bowDmg: 3 })] },
      { id: 'c5', tpl: 'wheel', n: 5, small: { 'skill.CriticalStrike': 3 }, notables: [N('Vital Shot', { bowDmg: 4, 'skill.CriticalStrike': 6 }), N('Steady Hands', { 'skill.Archery': 6, agility: 2 })] },
      { id: 'c6', tpl: 'fork', n: 3, small: { armor: 1 }, notables: [N('Leather and Luck', { armor: 2, luck: 4 }), N('Hard to Pin Down', { blowTaken: -3, agility: 2 })] },
      { id: 'c7', tpl: 'wheel', n: 4, small: { agility: 2 }, notables: [N("The Lover's Kiss", { agility: 3, luck: 3 })] },
    ],
    keystone: K('Wind Runner', { evade: 6, speed: 4, armor: -3 }, 'Blows often miss you entirely, but heavy armor sits poorly on you.'),
    life: { ring: [{ 'yield.hunting': 1 }, { 'xp.outfitting': 1 }], lr1: { 'xp.hunting': 3 }, lr2: { 'skill.Climbing': 3 }, la: { 'yield.hunting': 1 } },
    lifeClusters: [
      { id: 'l1', tpl: 'wheel', n: 5, small: { 'yield.hunting': 1 }, notables: [N('Clean Skinner', { 'yield.hunting': 4 }), N('Game Warden', { 'xp.hunting': 8 })] },
      { id: 'l2', tpl: 'wheel', n: 5, small: { 'xp.outfitting': 4 }, notables: [N('Master Tailor', { 'xp.outfitting': 9 }), N('Hidebinder', { 'xp.outfitting': 5, 'yield.hunting': 1 })] },
      { id: 'l3', tpl: 'fork', n: 3, small: { 'xp.hunting': 3 }, notables: [N('Trail Reader', { 'xp.hunting': 6, 'yield.hunting': 2 }), N('Stalker of the Wilds', { 'yield.hunting': 3, 'xp.hunting': 3 })] },
      { id: 'l4', tpl: 'chain', n: 4, small: [{ 'skill.Climbing': 3 }, { fallLess: 6 }], notables: [N("Cat's Landing", { fallLess: 15, 'skill.Climbing': 6 })] },
    ],
    lifeKeystone: K('Lord of the Hunt', { 'yield.hunting': 8, 'xp.hunting': 6 }, 'The finest hides are yours, and every kill teaches you more.'),
  },
  // ══ THE STEED - Speed and Strength: the long blade, the charge, the fist, the stamina; the sea and the road ══
  st: {
    start: { speed: 2 },
    roads: { s1: { speed: 2 }, s2: { strength: 3 }, g: { speed: 1, strength: 2 }, r1: { meleeDmg: 3 }, r2: { 'skill.LongBlade': 4 }, k1: { meleeDmg: 3 } },
    combat: [
      { id: 'c1', tpl: 'wheel', n: 5, small: { longDmg: 2 }, notables: [N('Riposte', { longDmg: 6, 'skill.LongBlade': 6 }), N('Blade Dancer', { longDmg: 4, speed: 2, 'skill.LongBlade': 4 })] },
      { id: 'c2', tpl: 'fork', n: 3, small: { meleeDmg: 2 }, notables: [N('Momentum', { meleeDmg: 5, speed: 2 }), N('Cavalier', { meleeDmg: 4, hp: 12 })] },
      { id: 'c3', tpl: 'wheel', n: 5, small: [{ endurance: 2 }, { hp: 5 }], notables: [N('Iron Lungs', { endurance: 5, hp: 10 }), N('Unflagging', { hpRegen: 2, endurance: 3 })] },
      { id: 'c4', tpl: 'chain', n: 4, small: { speed: 1 }, notables: [N('Lightning Reflexes', { speed: 3, evade: 2 })] },
      { id: 'c5', tpl: 'wheel', n: 5, small: { fistDmg: 3 }, notables: [N('Pankration', { fistDmg: 8, 'skill.HandToHand': 8 }), N('Iron Knuckles', { fistDmg: 5, strength: 3, 'skill.HandToHand': 4 })] },
      { id: 'c6', tpl: 'fork', n: 3, small: { 'skill.CriticalStrike': 3 }, notables: [N('Precision', { weaponDmg: 4, 'skill.CriticalStrike': 5 }), N("Fencer's Footwork", { 'skill.Dodging': 6, evade: 2 })] },
      { id: 'c7', tpl: 'wheel', n: 4, small: { speed: 1 }, notables: [N("The Steed's Stride", { speed: 3, 'skill.Running': 4 })] },
    ],
    keystone: K("Steed's Charge", { meleeDmg: 9, speed: 3, blowTaken: 5 }, 'You strike fast and hard, and leave yourself a little open.'),
    life: { ring: [{ sailSpeed: 1 }, { 'yield.fishing': 2 }], lr1: { fatigueLess: 4 }, lr2: { 'skill.Swimming': 3 }, la: { sailSpeed: 1 } },
    lifeClusters: [
      { id: 'l1', tpl: 'wheel', n: 5, small: { sailSpeed: 1 }, notables: [N('Fair Winds', { sailSpeed: 3 }), N('Old Salt', { sailSpeed: 1, 'skill.Swimming': 6 })] },
      { id: 'l2', tpl: 'wheel', n: 5, small: [{ 'yield.fishing': 3 }, { 'act.fishing': 5 }], notables: [N('Patient Line', { 'act.fishing': 15, 'xp.fishing': 5 }), N('Bountiful Nets', { 'yield.fishing': 8 })] },
      { id: 'l3', tpl: 'fork', n: 3, small: { fatigueLess: 4 }, notables: [N('Road Legs', { fatigueLess: 12 }), N('Sure Stride', { fallLess: 10, fatigueLess: 4 })] },
      { id: 'l4', tpl: 'chain', n: 4, small: { 'skill.Swimming': 3 }, notables: [N('Child of Kynareth', { 'skill.Swimming': 8, sailSpeed: 1, 'xp.fishing': 4 })] },
    ],
    lifeKeystone: K('Master and Commander', { sailSpeed: 3, 'xp.fishing': 3 }, 'Your ship answers the wind as no other, and the sea gives up its fish to you.'),
  },
  // ══ THE WARRIOR - Strength and Endurance: the axe, the hammer, armour, health, the fury ══
  wr: {
    start: { strength: 1, endurance: 1 },
    roads: { s1: { strength: 3 }, s2: { endurance: 3 }, g: { strength: 2, endurance: 2 }, r1: { hp: 2 }, r2: { blowTaken: -1 }, k1: { armor: 1 } },
    combat: [
      { id: 'c1', tpl: 'wheel', n: 5, small: { axeDmg: 2 }, notables: [N('Cleaver', { axeDmg: 6, 'skill.Axe': 6 }), N('Headsman', { axeDmg: 4, strength: 3, 'skill.Axe': 5 })] },
      { id: 'c2', tpl: 'fork', n: 3, small: { armor: 1 }, notables: [N('Walking Fortress', { armor: 3, blowTaken: -3 }), N('Shield Wall', { blowTaken: -2, hp: 10 })] },
      { id: 'c3', tpl: 'wheel', n: 5, small: { bluntDmg: 2 }, notables: [N('Crushing Blows', { bluntDmg: 6, 'skill.BluntWeapon': 6 }), N('Bonebreaker', { bluntDmg: 4, meleeDmg: 2, 'skill.BluntWeapon': 5 })] },
      { id: 'c4', tpl: 'chain', n: 4, small: { meleeDmg: 2 }, notables: [N('Warlord', { meleeDmg: 5, strength: 4 })] },
      { id: 'c5', tpl: 'wheel', n: 5, small: { hp: 4 }, notables: [N("Troll's Blood", { hpRegen: 3, hp: 8 }), N("Giant's Heart", { hp: 18, endurance: 3 })] },
      { id: 'c6', tpl: 'fork', n: 3, small: { killHeal: 1 }, notables: [N('Carnage', { killHeal: 2, axeDmg: 4 }), N('Reaver', { rageDmg: 7, strength: 2 })] },
      { id: 'c7', tpl: 'wheel', n: 4, small: { strength: 2 }, notables: [N("The Lady's Favor", { endurance: 4, hp: 8 })] },
    ],
    keystone: K("Berserker's Fury", { rageDmg: 18, armor: -2 }, 'Below half Health you strike far harder, though your armor guards you a little less.'),
    life: { ring: [{ 'yield.mining': 1 }, { 'xp.smithing': 2 }], lr1: { 'xp.mining': 4 }, lr2: { 'yield.logging': 1 }, la: { 'xp.building': 4 } },
    lifeClusters: [
      { id: 'l1', tpl: 'wheel', n: 5, small: { 'yield.mining': 2 }, notables: [N('Motherlode Instinct', { 'yield.mining': 6 }), N('Deep Seams', { 'xp.mining': 8, 'yield.mining': 2 })] },
      { id: 'l2', tpl: 'wheel', n: 5, small: { 'xp.smithing': 3 }, notables: [N("Anvil's Song", { 'xp.smithing': 8 }), N('Quench and Temper', { 'xp.smithing': 5, carry: 4 })] },
      { id: 'l3', tpl: 'fork', n: 3, small: { 'xp.building': 4 }, notables: [N('Master Builder', { 'xp.building': 10 }), N('Hall-Raiser', { 'xp.building': 6, 'xp.smithing': 3 })] },
      { id: 'l4', tpl: 'chain', n: 4, small: { 'yield.logging': 3 }, notables: [N('Feller of Giants', { 'yield.logging': 8, 'xp.logging': 6 })] },
    ],
    lifeKeystone: K("Stonebreaker's Oath", { 'yield.mining': 9, 'yield.logging': 9 }, 'Stone and timber yield more to your pick and axe.'),
  },
  // ══ THE RITUAL - Willpower and Strength: restoration, the undead and the daedra, the spellsword, wards ══
  rt: {
    start: { willpower: 2 },
    roads: { s1: { willpower: 2 }, s2: { strength: 3 }, g: { willpower: 1, strength: 2 }, r1: { 'skill.Restoration': 4 }, r2: { hpRegen: 1 }, k1: { undeadDmg: 4 } },
    combat: [
      { id: 'c1', tpl: 'wheel', n: 5, small: { 'skill.Restoration': 3 }, notables: [N('Laying of Hands', { 'skill.Restoration': 6, hpRegen: 2 }), N("Mara's Grace", { 'castCost.Restoration': 10, willpower: 3 })] },
      { id: 'c2', tpl: 'fork', n: 3, small: [{ undeadDmg: 4 }, { daedraDmg: 4 }], notables: [N('Purifier', { undeadDmg: 10, daedraDmg: 5 }), N('Daedra-Bane', { daedraDmg: 10, undeadDmg: 5 })] },
      { id: 'c3', tpl: 'wheel', n: 5, small: [{ meleeDmg: 2 }, { spellPower: 2 }], notables: [N("Templar's Mace", { bluntDmg: 5, spellPower: 4 }), N('Runed Blade', { longDmg: 4, 'skill.Alteration': 5 })] },
      { id: 'c4', tpl: 'chain', n: 4, small: { 'skill.Alteration': 3 }, notables: [N('Stoneskin', { armor: 3, 'skill.Alteration': 5 })] },
      { id: 'c5', tpl: 'wheel', n: 5, small: { willpower: 1 }, notables: [N('Unbreakable Will', { willpower: 5, 'resist.magic': 6 }), N('Clarity', { mpRegen: 2, mp: 8 })] },
      { id: 'c6', tpl: 'fork', n: 3, small: [{ 'resist.poison': 3 }, { 'resist.magic': 3 }], notables: [N('Antidote Blood', { 'resist.poison': 10 }), N('Spell Turning', { spellTaken: -4, 'resist.magic': 4 })] },
      { id: 'c7', tpl: 'wheel', n: 4, small: { willpower: 1 }, notables: [N("The Lord's Mail", { willpower: 3, hpRegen: 1, 'resist.magic': 3 })] },
    ],
    keystone: K("Martyr's Vow", { hpRegen: 6, weaponDmg: -4, spellPower: -4 }, 'Your wounds close of their own accord, but your weapons and spells are a little weaker.'),
    life: { ring: [{ 'yield.herbalism': 1 }, { coldDegrees: 1 }], lr1: { 'xp.herbalism': 4 }, lr2: { 'xp.provisioning': 2 }, la: { 'act.herbalism': 5 } },
    lifeClusters: [
      { id: 'l1', tpl: 'wheel', n: 5, small: [{ 'yield.herbalism': 2 }, { 'act.herbalism': 5 }], notables: [N('Green Thumb', { 'yield.herbalism': 6 }), N('Gentle Hands', { 'act.herbalism': 15, 'xp.herbalism': 4 })] },
      { id: 'l2', tpl: 'wheel', n: 5, small: { 'xp.provisioning': 3 }, notables: [N('Master Brewer', { 'xp.provisioning': 8 }), N('Camp Cook', { 'xp.provisioning': 4, fatigueLess: 6 })] },
      { id: 'l3', tpl: 'fork', n: 3, small: [{ coldDegrees: 2 }, { heatDegrees: 2 }], notables: [N('Child of Winter', { coldDegrees: 5, warmth: 2 }), N('Sun-Walker', { heatDegrees: 6, dry: 10 })] },
      { id: 'l4', tpl: 'chain', n: 4, small: { 'xp.herbalism': 4 }, notables: [N("Druid's Path", { 'xp.herbalism': 10, 'yield.herbalism': 3 })] },
    ],
    lifeKeystone: K("Hermit's Covenant", { 'yield.herbalism': 10, 'xp.provisioning': 5 }, 'The wilds give up every leaf to you, and your kitchen makes the most of them.'),
  },
};

/** The Wayfarer's Road's stars, inner to outer: between the signs on the inner ring, then out to the life ring. */
const WAYFARER = Object.freeze({ bt: { carry: 2 }, w: { fatigueLess: 3 }, x: { carry: 3 }, xr1: { fallLess: 5 }, xr2: { fatigueLess: 4 } });
/**
 * WHERE EACH CLUSTER STANDS, by its index in its list. A wheel: `at` [bearing offset, radius] and `rad`; a line: `dir`
 * (bearing offset) out of the star it hangs from. `from` the star it hangs from - a road of the sign's (`g`, `r1`,
 * `lg0`...) or another cluster (`c3`: that cluster's star nearest this one's centre; for a line, its outermost). The
 * signs at odd places in the sky (the Shadow, the Steed, the Ritual) stand their clusters mirrored, so no two
 * neighbours' skies are the same shape.
 */
const SLOTS = Object.freeze({
  combat: Object.freeze([
    Object.freeze({ at: [-14, 485], rad: 50, from: 'g' }),
    Object.freeze({ line: true, dir: 40, from: 'r1' }),
    Object.freeze({ at: [-13, 640], rad: 55, from: 'r2' }),
    Object.freeze({ line: true, dir: 50, from: 'g' }),
    Object.freeze({ at: [-22, 790], rad: 50, from: 'c3' }),
    Object.freeze({ at: [24, 800], rad: 50, from: 'c4' }),
    Object.freeze({ at: [15, 300], rad: 34, from: 's2' }),   // the sign's own small wheel, by its spoke
  ]),
  life: Object.freeze([
    Object.freeze({ at: [-20, 990], rad: 55, from: 'lg0' }),
    Object.freeze({ at: [20, 990], rad: 55, from: 'lg1' }),
    Object.freeze({ line: true, dir: -12, from: 'l1' }),
    Object.freeze({ line: true, dir: 12, from: 'l2' }),
  ]),
});
/** The distance between two stars on a line. */
const LINE_STEP = 56;

/** The road stars' names (a road star is a small star in all but where it stands). */
const ROAD_NAMES = Object.freeze({ s1: 'Path of the Sign', s2: 'Path of the Sign', g: 'Gate of the Sign', r1: 'Starway', r2: 'Starway', k1: 'Threshold',
  bt: 'Crossing', w: "Wayfarer's Road", x: 'Crossroads', xr1: "Wayfarer's Road", xr2: "Wayfarer's Road", lg: 'Gate of the Crafts', lr1: 'Path of the Hand', lr2: 'Path of the Hand', la: 'Threshold of Craft' });

// ─── THE BUILD ───────────────────────────────────────────────────────

/** THE ATTRIBUTES a star may raise (firmamentLaw.js ATTRIBUTES, pinned equal - this table imports nothing). */
const ATTRS = Object.freeze(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']);
/**
 * RAW ON THE KEY STARS, PERCENT ON THE SMALL (the lead dev, 2026-10-13: "combined with the ascend system you will get
 * waaay to many stat points just add stats with raw numbers to the key nodes and percentages to the smaller ones"). The
 * starts, the notables and the keystones keep their raw points; a small star or a road's are said as a share of what
 * the character has - an attribute's or a skill's points as a percent of its own (FIRM2: one for one - +2 Strength is +2%
 * of the character's Strength; FIRM1 doubled them and a sign's stars summed to twice the cap), Health and Spell Points half over as a percent of the maximum (+10 Health is +5%), a point of
 * Armor Rating a percent less damage from blows.
 * @param {Record<string, number>} stats
 */
export function smallStats(stats) {
  /** @type {Record<string, number>} */
  const out = {};
  const put = (k, v) => { out[k] = (out[k] ?? 0) + v; };
  for (const [k, v] of Object.entries(stats)) {
    if (ATTRS.includes(k)) put(`pct.${k}`, v);
    else if (k.startsWith('skill.')) put(`skillPct.${k.slice(6)}`, v);
    else if (k === 'hp') put('hpPct', Math.max(1, Math.round(v / 2)));
    else if (k === 'mp') put('mpPct', Math.max(1, Math.round(v / 2)));
    else if (k === 'armor') put('blowTaken', -v);
    else put(k, v);
  }
  return out;
}

function build() {
  /** @type {Map<string, FirmNode>} */
  const nodes = new Map();
  /** @type {FirmEdge[]} */
  const edges = [];
  const edgeKeys = new Set();
  const add = (/** @type {FirmNode} */ n) => { if (nodes.has(n.key)) throw new Error(`firmament: duplicate key ${n.key}`); nodes.set(n.key, n); return n; };
  const link = (a, b, arc = undefined) => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (a === b || edgeKeys.has(k)) return;
    edgeKeys.add(k);
    edges.push(arc ? { a, b, arc } : { a, b });
  };
  const node = (key, kind, ring, sector, cluster, name, stats, p, text = undefined) =>
    add(/** @type {FirmNode} */ ({ key, kind, ring, sector, cluster, name, stats: Object.freeze(kind === 'small' || kind === 'road' ? smallStats(stats) : { ...stats }), ...(text ? { text } : {}), x: p.x, y: p.y }));

  // the middle, the starts and the inner ring
  node('sp.start', 'start', 'combat', 'sp', null, SERPENT.name, { luck: 2 }, { x: 0, y: 0 });
  for (const s of SIGNS) {
    const sky = SKY[s.id];
    node(`${s.id}.start`, 'start', 'combat', s.id, null, s.name, sky.start, at(FIRM_RADII.start, s.angle));
    node(`${s.id}.bt`, 'road', 'life', s.id, null, ROAD_NAMES.bt, WAYFARER.bt, at(FIRM_RADII.start, s.angle + 30));
  }
  SIGNS.forEach((s, i) => {
    const next = SIGNS[(i + 1) % SIGNS.length];
    const C = { cx: 0, cy: 0, r: FIRM_RADII.start };
    link(`${s.id}.start`, `${s.id}.bt`, C);
    link(`${s.id}.bt`, `${next.id}.start`, C);
    link('sp.start', `${s.id}.bt`);
  });
  // each sign's spoke, radial and keystone; the wayfarer's road beside it; the ring road at r 400
  for (const s of SIGNS) {
    const sky = SKY[s.id], a = s.angle, b = s.angle + 30;
    const road = (id, r, deg, ring = 'combat', stats = sky.roads[id]) => node(`${s.id}.${id}`, 'road', ring, s.id, null, ROAD_NAMES[id], stats, at(r, deg));
    road('s1', FIRM_RADII.spoke1, a); road('s2', FIRM_RADII.spoke2, a); road('g', FIRM_RADII.ring, a);
    road('r1', FIRM_RADII.rad1, a); road('r2', FIRM_RADII.rad2, a); road('k1', FIRM_RADII.keyApproach, a);
    node(`${s.id}.k`, 'keystone', 'combat', s.id, null, sky.keystone.name, sky.keystone.stats, at(FIRM_RADII.keystone, a), sky.keystone.text);
    for (const [p, q] of [['start', 's1'], ['s1', 's2'], ['s2', 'g'], ['g', 'r1'], ['r1', 'r2'], ['r2', 'k1'], ['k1', 'k']]) link(`${s.id}.${p}`, `${s.id}.${q}`);
    road('w', FIRM_RADII.way1, b, 'life', WAYFARER.w); road('x', FIRM_RADII.ring, b, 'life', WAYFARER.x);
    road('xr1', FIRM_RADII.way2, b, 'life', WAYFARER.xr1); road('xr2', FIRM_RADII.way3, b, 'life', WAYFARER.xr2);
    for (const [p, q] of [['bt', 'w'], ['w', 'x'], ['x', 'xr1'], ['xr1', 'xr2']]) link(`${s.id}.${p}`, `${s.id}.${q}`);
    // the life ring's two gates in this sign's sky (at its bearing less and plus 15) and its radial to the life keystone
    const ring = sky.life.ring;
    node(`${s.id}.lg0`, 'road', 'life', s.id, null, ROAD_NAMES.lg, ring[0], at(FIRM_RADII.life, a - 15));
    node(`${s.id}.lg1`, 'road', 'life', s.id, null, ROAD_NAMES.lg, ring[1], at(FIRM_RADII.life, a + 15));
    // FIRM1c: the Wayfarer's own gate, on the life ring where its road meets it (bearing plus 30) - the road runs straight
    // out along its own line, so it never crosses the outer wheels beside it
    node(`${s.id}.lgx`, 'road', 'life', s.id, null, ROAD_NAMES.lg, WAYFARER.x, at(FIRM_RADII.life, b));
    road('lr1', FIRM_RADII.lifeRad1, a, 'life', sky.life.lr1); road('lr2', FIRM_RADII.lifeRad2, a, 'life', sky.life.lr2);
    road('la', FIRM_RADII.lifeApproach, a, 'life', sky.life.la);
    node(`${s.id}.lk`, 'keystone', 'life', s.id, null, sky.lifeKeystone.name, sky.lifeKeystone.stats, at(FIRM_RADII.lifeKeystone, a), sky.lifeKeystone.text);
    for (const [p, q] of [['lg0', 'lr1'], ['lg1', 'lr1'], ['lr1', 'lr2'], ['lr2', 'la'], ['la', 'lk']]) link(`${s.id}.${p}`, `${s.id}.${q}`);
  }
  SIGNS.forEach((s, i) => {
    const next = SIGNS[(i + 1) % SIGNS.length];
    const R = { cx: 0, cy: 0, r: FIRM_RADII.ring }, L = { cx: 0, cy: 0, r: FIRM_RADII.life };
    link(`${s.id}.g`, `${s.id}.x`, R);
    link(`${s.id}.x`, `${next.id}.g`, R);
    link(`${s.id}.lg0`, `${s.id}.lg1`, L);
    link(`${s.id}.lg1`, `${s.id}.lgx`, L);
    link(`${s.id}.lgx`, `${next.id}.lg0`, L);
    // the wayfarer's road meets the life ring at its own gate
    link(`${s.id}.xr2`, `${s.id}.lgx`);
  });

  // the clusters, inner to outer, each hung from the nearest star of its own ring already placed
  SIGNS.forEach((s, si) => {
    const sky = SKY[s.id];
    const flip = si % 2 === 1 ? -1 : 1;
    sky.combat.forEach((c, i) => placeCluster(s, 'combat', c, SLOTS.combat[i], flip));
    sky.lifeClusters.forEach((c, i) => placeCluster(s, 'life', c, SLOTS.life[i], flip));
  });
  /** The star a slot hangs from: a road of the sign's, or a placed cluster's star nearest `p` (outermost for a line). */
  function anchorFor(s, from, p, line, flip) {
    // a mirrored sky's gates are mirrored with it: its first life cluster hangs from the gate on its other side
    const gate = flip < 0 && (from === 'lg0' || from === 'lg1') ? (from === 'lg0' ? 'lg1' : 'lg0') : from;
    const road = nodes.get(`${s.id}.${gate}`);
    if (road && !road.cluster) return road;
    let best = null, bestD = Infinity;
    for (const n of nodes.values()) {
      if (n.cluster !== `${s.id}.${from}` || n.kind !== 'small') continue;
      const d = line ? -Math.hypot(n.x, n.y) : dist(n, p);
      if (d < bestD) { best = n; bestD = d; }
    }
    if (!best) throw new Error(`firmament: ${s.id} has no star ${from} to hang a cluster from`);
    return /** @type {FirmNode} */ (best);
  }
  /** FIRM1c: no line runs through a star. A star's drawn radius and a breath round it. */
  function R(k) { return ({ start: 30, keystone: 25, notable: 16 })[k] ?? 9; }
  function clears(p, q, skip) {
    const dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1;
    for (const m of nodes.values()) {
      if (skip.has(m.key)) continue;
      const t = ((m.x - p.x) * dx + (m.y - p.y) * dy) / L2;
      if (t <= 0 || t >= 1) continue;
      if (Math.hypot(m.x - (p.x + t * dx), m.y - (p.y + t * dy)) < R(m.kind) + 8) return false;
    }
    return true;
  }
  /** A wheel's anchor: a road of the sign's as before; from a cluster, its nearest star whose line to the wheel's entry
   *  passes no other star (the nearest of all where none is clear). */
  function clearAnchor(s, from, centre, rad, flip) {
    const first = anchorFor(s, from, centre, false, flip);
    if (!first.cluster) return first;
    const pool = [...nodes.values()].filter((m) => m.cluster === first.cluster && m.kind !== 'keystone').sort((a, b) => dist(a, centre) - dist(b, centre));
    for (const m of pool) {
      const f = Math.atan2(m.x - centre.x, -(m.y - centre.y));
      const entry = { x: centre.x + rad * Math.sin(f), y: centre.y - rad * Math.cos(f) };
      if (clears(m, entry, new Set([m.key]))) return m;
    }
    return first;
  }
  function placeCluster(s, ring, c, slot, flip) {
    const cid = `${s.id}.${c.id}`;
    const smallOf = (i) => (Array.isArray(c.small) ? c.small[i % c.small.length] : c.small);
    const keys = [];
    const put = (i, kind, name, stats, p) => { keys.push(node(`${cid}.${i}`, kind, ring, s.id, cid, name, stats, p).key); };
    const smallName = ring === 'combat' ? 'Star' : 'Mote';
    if (!slot.line) {
      // A WHEEL: a fork's or a chain's small stars and notables stand round a circle all the same
      const centre = at(slot.at[1], s.angle + flip * slot.at[0]);
      const n = c.tpl === 'wheel' ? c.n : Math.max(4, c.n + 1);
      const total = n + c.notables.length;
      const anchor = clearAnchor(s, slot.from, centre, slot.rad, flip);
      const face = Math.atan2(anchor.x - centre.x, -(anchor.y - centre.y));   // the bearing from the centre to the anchor
      // the notables stand across from the entry: one opposite it, a second a step round from it
      const spots = new Map();
      const opposite = Math.round(total / 2);
      spots.set(opposite, 0);
      if (c.notables.length > 1) spots.set(opposite - 2 * flip, 1);
      let small = 0;
      for (let i = 0; i < total; i++) {
        const ang = face + (2 * Math.PI * i) / total;
        const p = { x: Math.round((centre.x + slot.rad * Math.sin(ang)) * 10) / 10, y: Math.round((centre.y - slot.rad * Math.cos(ang)) * 10) / 10 };
        if (spots.has(i)) { const nb = c.notables[spots.get(i)]; put(i, 'notable', nb.name, nb.stats, p); } else put(i, 'small', smallName, smallOf(small++), p);
      }
      const arc = { cx: centre.x, cy: centre.y, r: slot.rad };
      for (let i = 0; i < total; i++) link(keys[i], keys[(i + 1) % total], arc);
      link(anchor.key, keys[0]);
      return;
    }
    // A LINE out of the anchor along its bearing, a star every LINE_STEP: a fork splits into two notables at its end, a
    // chain ends in one (a wheel's two notables in a line slot make a fork)
    const anchor = anchorFor(s, slot.from, null, true, flip);
    const bearing = toRad(s.angle + flip * slot.dir);
    const ux = Math.sin(bearing), uy = -Math.cos(bearing);
    const pt = (k, side = 0) => {
      const along = (k + 1) * LINE_STEP, off = side * LINE_STEP * 0.8;
      return { x: Math.round((anchor.x + ux * along - uy * off) * 10) / 10, y: Math.round((anchor.y + uy * along + ux * off) * 10) / 10 };
    };
    const n = c.tpl === 'wheel' ? Math.max(3, c.n - 2) : c.n;
    for (let i = 0; i < n; i++) put(i, 'small', smallName, smallOf(i), pt(i));
    link(anchor.key, keys[0]);
    for (let i = 1; i < n; i++) link(keys[i - 1], keys[i]);
    const last = keys[n - 1];
    if (c.notables.length === 1) {
      put(n, 'notable', c.notables[0].name, c.notables[0].stats, pt(n));
      link(last, keys[n]);
    } else {
      put(n, 'notable', c.notables[0].name, c.notables[0].stats, pt(n - 0.3, -1));
      put(n + 1, 'notable', c.notables[1].name, c.notables[1].stats, pt(n - 0.3, 1));
      link(last, keys[n]);
      link(last, keys[n + 1]);
    }
  }
  for (const n of nodes.values()) Object.freeze(n);
  for (const e of edges) { if (e.arc) Object.freeze(e.arc); Object.freeze(e); }
  return { nodes, edges };
}

const BUILT = build();
/** Every star by key. */
export const FIRM_NODES = /** @type {ReadonlyMap<string, FirmNode>} */ (BUILT.nodes);
/** Every line between two stars (undirected), with the arc a wheel's or a ring's line is drawn along. */
export const FIRM_EDGES = Object.freeze(BUILT.edges);
/** Each star's neighbours, by key. */
export const FIRM_ADJ = (() => {
  /** @type {Map<string, string[]>} */
  const m = new Map([...FIRM_NODES.keys()].map((k) => [k, []]));
  for (const e of FIRM_EDGES) { m.get(e.a)?.push(e.b); m.get(e.b)?.push(e.a); }
  for (const v of m.values()) Object.freeze(v.sort());
  return /** @type {ReadonlyMap<string, readonly string[]>} */ (m);
})();
/** A star's record, or null. */
export const firmNode = (key) => (typeof key === 'string' ? FIRM_NODES.get(key) ?? null : null);
/** The sky's bounds, for a viewer's first frame. */
export const FIRM_BOUNDS = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of FIRM_NODES.values()) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
  return Object.freeze({ x0, y0, x1, y1 });
})();
/** A sign's record by id ('sp' the Serpent), or null. */
export const signById = (id) => (id === SERPENT.id ? SERPENT : SIGNS.find((s) => s.id === id) ?? null);
