// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC3 — WHAT A TITLE AND A GLYPH LOOK LIKE. One home, both faces.
//
// Mac (2026-09-22): "Player titles appear above a player name... 1st
// title is Founder with a gold color, 2nd title is Developer with a
// red color", and "name glyphs... appear on the right side of the
// player name. Sprouting green plant. Attached to new accounts for 2
// weeks. Developer glyph specifficaly for developers."
//
// ═══ WHY THIS IS NOT IN identityToken.js ═══════════════════════════
//
// That module holds the VOCABULARY - which titles and glyphs exist -
// and it is in the RELAY BUNDLE: SLAM8 hashes its raw bytes, so a word
// of presentation added there costs a RELAY_VERSION bump and drops
// every connected player. The relay has no opinion about gold. So the
// vocabulary is imported FROM there and the appearance lives here,
// where it can be changed for nothing.
//
// AND THE TABLES ARE DERIVED FROM THAT VOCABULARY RATHER THAN BESIDE
// IT: a pin walks TITLES and GLYPHS and requires every member to have
// an entry here, so a third title added to the token cannot reach a
// screen as a blank. That is this repo's DERIVED OVER ENUMERATED with
// the enumeration kept honest by a walk.
//
// ═══ TWO FACES, ONE LAW ════════════════════════════════════════════
//
// The enhanced DOM layer (ui/nameLayer.js) is what an online player
// sees - online forces that lane (OL1) - and it can draw a real shape
// in a real colour. The classic bitmap pass (net/remotePlayers.js
// drawNames) is what a host with no `document` draws, which is every
// Node probe and every suite in test/, and it draws through a
// DAGGERFALL FONT: `drawText` puts NOTHING on screen for a glyph that
// font has no record for.
//
// So a glyph has TWO spellings and it is written down rather than
// discovered: `svg` for the face that can draw a sprouting plant, and
// `mark` - one character inside FONT0003's own range - for the face
// that cannot. ACC1d-MARK learned this the hard way one slice ago: a
// tick is the obvious badge and is not in that font, so it would have
// been invisible in the classic face while the DOM face showed it.
// THE LIMIT, SAID RATHER THAN LEFT TO BE FOUND: this container has no
// ARENA2, so the real FONT0003 is not read by any pin here - the range
// is held instead.
//
// A TITLE HAS ONE SPELLING, because it is a WORD, and a word is ASCII
// and both faces draw it. Only the colour differs in how it is spelled
// (an RGBA array here, `cssRgba` for the DOM), which is exactly how
// SOC4's party green already crosses that seam.
// ═══════════════════════════════════════════════════════════════════

import { TITLES, GLYPHS, SEAT_TITLES } from '../net/identityToken.js';
import { seatTitleText } from '../net/townSeatLaw.js';   // SEAT1c: a seat title in words, off its claim

/** SEAT1c: THE PLACE A SEAT TITLE NAMES - the client's own seat by key (`{ name, region }`), or null. The host sets it
 *  once its seats are derived (scenes/world.js); until then, and offline, a seat title reads its plain word. */
let _seatPlace = () => null;
export function setSeatTitlePlaces(fn) { _seatPlace = typeof fn === 'function' ? fn : () => null; }

/** An RGBA 0..1 array as CSS. ONE HOME, and it is here rather than in
 *  ui/nameLayer.js (which re-exports it, so SOC4's pin that the party
 *  green survives the trip is untouched) because THREE surfaces now
 *  cross this seam: the name over a head, the chat roster and the
 *  account card's own sheet - and the sheet may not import a layer
 *  that pulls the whole remote-player pass in behind it. */
export function cssRgba(rgba) {
  if (!Array.isArray(rgba) || rgba.length < 3) return null;
  const hex = (v) => Math.max(0, Math.min(255, Math.round(Number(v) * 255))).toString(16).padStart(2, '0');
  return `#${hex(rgba[0])}${hex(rgba[1])}${hex(rgba[2])}`;
}

/** A title's word, as a player reads it. Capitalised because it is a
 *  title and not an identifier; the wire's own spelling is lower-case
 *  and is what everything else keys by. */
export const TITLE_TEXT = Object.freeze({
  founder: 'Founder',
  developer: 'Developer',
  dungeonmaster: 'Dungeon Master',   // TITLE-N (2026-09-24, Mac)
  disciple: 'Disciple',              // TITLE-N: the Patreon tiers, lowest first
  apostle: 'Apostle',
  hierophant: 'Hierophant',
  shadowfang: 'Shadow Fang',         // SHADOW-FANG (2026-09-26, Mac): SirMcMobdon's own
  penitent: 'Penitent',              // PENITENT (2026-09-29, Mac): Diggleborf's own
  gatebreaker: 'Gatebreaker',        // WB9g (2026-09-30, Mac): the Sigil Broker's, bought
  herald: 'Herald',                  // HERALD (2026-10-01, Mac): the Patreon tier between Disciple and Hierophant
  // SEAT1c (Seats-Arc 7.4): the seats' five - each worded off its claim where this client knows the place
  // (townSeatLaw.js seatTitleText: "Warden of Anticlere"), and these words alone where it does not
  warden: 'Warden',
  protector: 'Protector',
  crowned: 'Crowned',
  keeper: 'Keeper',
  champion: 'Champion',
  grandchampion: 'Grand Champion',   // ARENA4 (2026-10-02, Mac: "Being a top rank PvE fighter comes with it's own title")
  arenachampion: 'Arena Champion',   // ARENA4: "Being the #1 pvp arena player comes with it's own temporary title/glyph"
  aegis: 'Aegis of Oblivion',        // AEGIS (2026-10-03, the owner): Sureme's own
  primarch: 'Primarch',              // PRIMARCH (2026-10-04, GA00250: "the title will be Primarch"): GA00250's own
});

/** WB9g (2026-09-30, Mac: "an animated burning ground aura that circles the ground where your character stands"): AN
 *  AURA'S WORD, as a player reads it - the Broker's offer and the account card's button. */
export const AURA_TEXT = Object.freeze({
  dagonfire: "Dagon's Fire",
  oblivionward: 'Oblivion Ward',   // AEGIS: the Aegis of Oblivion's ring of runes, granted with the title
  radiance: 'Golden Radiance',     // PRIMARCH: the Primarch's column of golden light about the body, granted with the title
  shadowcloak: 'Holo Shadow Cloak',   // SHADOW-CLOAK: the Shadow Fang's hooded cloak of shadow and crimson light, granted with the title
  seraphwings: 'Seraph Wings',   // SERAPH-WINGS: wings of flowing golden light, the developers' own
});

/** SHADOW-FANG (2026-09-26, Mac): "SirMcMobdon gets a brand new
 *  title/glyph... Black and crimson graident for the title/glyph with the
 *  title name being Shadow Fang", and the glyph "like the reference
 *  shown" - a snarling wolf's head in profile, black, with a red eye.
 *  The two ends of that gradient, named once: every table below that
 *  paints Shadow Fang reads them from here. */
const SHADOW_BLACK = Object.freeze([0.051, 0.027, 0.035, 1]);    // #0d0709 - black, a breath of blood in it
const SHADOW_CRIMSON = Object.freeze([0.827, 0.098, 0.235, 1]);  // #d3193c
/** The wolf's eye, the one red that is not the gradient's (the reference's). */
const SHADOW_EYE = Object.freeze([1, 0.133, 0.18, 1]);           // #ff222e

/** PENITENT (2026-09-29, Mac: "This new custom title/glyph is for the user
 *  Diggleborf"). Diggleborf's own ask: "Looking to do a Trinimac themed one,
 *  so maybe "Penitent" for the title starting gold and ending a sky blue",
 *  and a sketch for the glyph - a tall lozenge with a sword in it, point
 *  down. The two ends, named as the web names them: `gold` and `skyblue`. */
const PENITENT_GOLD = Object.freeze([1, 0.843, 0, 1]);          // #ffd700
const PENITENT_SKY = Object.freeze([0.529, 0.808, 0.922, 1]);   // #87ceeb
/** THE LIGHT BETWEEN THEM. A gold and a sky blue both lean green, so a
 *  straight mix of the two is sage: with two stops the word read gold, lime,
 *  blue. A warm pale stop at the middle keeps it gold into light into sky -
 *  still starting gold and ending sky blue. */
const PENITENT_LIGHT = Object.freeze([1, 0.953, 0.839, 1]);     // #fff3d6

/** WB9g (2026-09-30, Mac: "a brand new title to the broker ... expensive and sought after"): THE GATEBREAKER, the
 *  Oblivion Gate's own fire - a coal's crimson, burning through the fire's orange into an ember's gold. */
const GATEBREAKER_CRIMSON = Object.freeze([0.62, 0.05, 0.07, 1]);  // #9e0d12
const GATEBREAKER_FIRE = Object.freeze([1, 0.42, 0.08, 1]);        // #ff6b14
const GATEBREAKER_EMBER = Object.freeze([1, 0.82, 0.32, 1]);       // #ffd152

/** AEGIS (2026-10-03, the owner: "For the account named Sureme ... a title, glyph and new custom aura for this user.
 *  Title: Aegis of Oblivion. Theme: Purple"). Three violets out of the void into the ward's light - the void's deep
 *  violet, the ward's own (the Oblivion Ward's glow, render/auraRing.js WARD_RGB), and the light at the aegis's edge.
 *  Chosen in Chromium over a night sky, a day sky, stone, grass and snow at 13 to 64 px beside the Apostle's and the
 *  Protector's: the reverse (light into the void) read as a bare name over a night sky and was lost on snow; a paler
 *  run (#8b3dff to #f0e2ff) lost its light end on snow; this one reads violet on all five. */
const OBLIVION_VOID = Object.freeze([0.439, 0.188, 0.878, 1]);    // #7030e0
const OBLIVION_VIOLET = Object.freeze([0.698, 0.302, 1, 1]);      // #b24dff
const OBLIVION_LILAC = Object.freeze([0.925, 0.863, 1, 1]);       // #ecdcff
/** The abyss under the aegis - the glyph's tendrils, darker than any stop of the word (Sureme's reference: the black
 *  splash the pillars and the ring stand out of). */
const OBLIVION_ABYSS = Object.freeze([0.302, 0.102, 0.580, 1]);   // #4d1a94

/** PRIMARCH (2026-10-04, GA00250, relayed by the owner: "the title will be Primarch, the color will be that light gold
 *  color that you guys use in some places in the game menu", over a screenshot of their own name in the pause menu's
 *  pixel face - "that color"). That is #d8cfae: the pixel menu's text (ui/enhancedStyle.js `.px-mname`, the name in
 *  the screenshot, and the menu's rows and the talk window's), sampled off the screenshot's letters at #d4ccb0 through
 *  its JPEG. ONE colour, as asked - no gradient; a one-colour title wears every face's black text shadow, and it read
 *  on all five grounds in Chromium at 13 to 64 px, snow included. A pin holds it to the menu's own rule. */
const PRIMARCH_GOLD = Object.freeze([0.847, 0.812, 0.682, 1]);   // #d8cfae

/** A title's colour, RGBA 0..1 - the same shape SOC4's PARTY_GREEN is
 *  in, so `nameLayer.cssRgba` turns it into CSS and `drawText` takes it
 *  as a tint, and neither face writes a colour down a second time.
 *  Mac: Founder gold, Developer red, Dungeon Master orange (TITLE-N). The
 *  three Patreon tiers had no colour named: a colour each, none near
 *  another title's, rising from teal to violet to rose - this table is
 *  the one place to change them, and costs no relay. */
export const TITLE_RGBA = Object.freeze({
  founder: Object.freeze([1, 0.784, 0.29, 1]),      // #ffc84a
  developer: Object.freeze([0.886, 0.271, 0.227, 1]), // #e2453a
  dungeonmaster: Object.freeze([1, 0.549, 0.102, 1]), // #ff8c1a
  disciple: Object.freeze([0.369, 0.784, 0.722, 1]),  // #5ec8b8
  apostle: Object.freeze([0.616, 0.486, 0.941, 1]),   // #9d7cf0
  hierophant: Object.freeze([0.910, 0.451, 0.749, 1]), // #e873bf
  // SHADOW-FANG: the gradient's crimson end - the colour a face that cannot draw a gradient uses (the account
  // card's button, the classic face's edge), and the glyph's outline
  shadowfang: SHADOW_CRIMSON,
  // PENITENT: the gradient's gold end - the account card's button, and the glyph's lozenge
  penitent: PENITENT_GOLD,
  // WB9g: the fire at the gradient's middle - the colour a face that cannot draw a gradient uses
  gatebreaker: GATEBREAKER_FIRE,
  // HERALD (2026-10-01, Mac: "you'll need to develop the herald title/glyph"; no colour named): AZURE, heraldry's own
  // blue - a herald wears the arms he cries. Between the Disciple's teal and the Apostle's violet on the tiers' rise,
  // and brighter and bluer-violet than the moderator's shield, which is a shield and never a trumpet. Chosen over a
  // periwinkle (lost on a day sky), a silver (read as a bare name) and a purple (the Apostle's) on five grounds.
  herald: Object.freeze([0.31, 0.49, 1, 1]),          // #4f7dff
  // SEAT1c: the seats' - a Warden's bronze, a Protector's royal purple, the Crowned's pale gold, a Keeper's
  // weathered green, a Champion's silver; none another title's
  warden: Object.freeze([0.769, 0.549, 0.290, 1]),    // #c48c4a
  protector: Object.freeze([0.580, 0.365, 0.851, 1]), // #945dd9
  crowned: Object.freeze([1, 0.886, 0.541, 1]),       // #ffe28a
  keeper: Object.freeze([0.471, 0.706, 0.443, 1]),    // #78b471
  champion: Object.freeze([0.851, 0.867, 0.890, 1]),  // #d9dde3
  // ARENA4 (2026-10-02; no colour named): the GRAND CHAMPION in a champion's BRONZE - the cup on the Hall of Champions'
  // wall, darker and browner than the Dungeon Master's bright orange and the Gatebreaker's fire, and no gold (the
  // Founder's); the ARENA CHAMPION in the LAUREL's own green - the wreath the season's #1 wears, the glyph's colour too
  grandchampion: Object.freeze([0.804, 0.498, 0.196, 1]),   // #cd7f32
  arenachampion: Object.freeze([0.557, 0.776, 0.247, 1]),   // #8ec63f
  // AEGIS: the gradient's middle, the ward's violet - the colour a face that cannot draw a gradient uses (the account
  // card's button, the classic face's tint), and the glyph's. Bluer than the Hierophant's rose, brighter and redder than
  // the Apostle's periwinkle and the Protector's royal purple
  aegis: OBLIVION_VIOLET,
  // PRIMARCH: the menu's light gold, as GA00250 asked - paler and greyer than the Founder's gold and the Crowned's, warmer
  // than the Champion's silver
  primarch: PRIMARCH_GOLD,
});

/** SHADOW-FANG: A TITLE DRAWN AS A GRADIENT - its stops, RGBA 0..1, left
 *  to right along the word. A title named here is painted by `titlePaint`
 *  on every DOM face and a letter at a time by the classic one; a title
 *  that is not keeps its one colour above. "Shadow" in the black, "Fang"
 *  in the crimson; "Penitent" gold into the light into the sky. */
export const TITLE_GRADIENT = Object.freeze({
  shadowfang: Object.freeze([SHADOW_BLACK, SHADOW_CRIMSON]),
  penitent: Object.freeze([PENITENT_GOLD, PENITENT_LIGHT, PENITENT_SKY]),
  gatebreaker: Object.freeze([GATEBREAKER_CRIMSON, GATEBREAKER_FIRE, GATEBREAKER_EMBER]),   // WB9g: coal, fire, ember
  aegis: Object.freeze([OBLIVION_VOID, OBLIVION_VIOLET, OBLIVION_LILAC]),   // AEGIS: out of the void into the ward's light
});

/** PENITENT: THE EDGE A GRADIENT TITLE WEARS, where it is not the title's
 *  own colour. The edge is what the letters are read against (titlePaint,
 *  and the classic face's edge run): Shadow Fang's is its own crimson,
 *  because its black half needs a bright edge over a night sky. Penitent's
 *  ends are both bright, and edged in its own gold the sky half was lost -
 *  the word read gold on every ground. So it is edged in black, as every
 *  one-colour title's text shadow is. */
export const TITLE_EDGE = Object.freeze({
  penitent: Object.freeze([0, 0, 0, 1]),
  gatebreaker: Object.freeze([0, 0, 0, 1]),   // WB9g: its ember end is bright - edged in black, as Penitent's
  aegis: Object.freeze([0, 0, 0, 1]),   // AEGIS: its lilac end is bright - edged in black, as Penitent's and the Gatebreaker's
});

/** A glyph's colour. The sprout is green because Mac said green; the
 *  dev glyph takes the Developer title's own red, read from it rather
 *  than repeated, so the two halves of one grant cannot drift apart;
 *  the moderator's shield is blue because Mac picked the blue shield
 *  (MOD1). */
export const GLYPH_RGBA = Object.freeze({
  sprout: Object.freeze([0.42, 0.82, 0.36, 1]),   // #6bd15c
  dev: TITLE_RGBA.developer,
  mod: Object.freeze([0.29, 0.565, 0.886, 1]),   // #4a90e2
  // TITLE-N: each new glyph wears its own title's colour, read from it - the two halves of one grant cannot drift
  dm: TITLE_RGBA.dungeonmaster,
  disciple: TITLE_RGBA.disciple,
  apostle: TITLE_RGBA.apostle,
  hierophant: TITLE_RGBA.hierophant,
  shadowfang: TITLE_RGBA.shadowfang,   // SHADOW-FANG: the outline's crimson - the fill is the gradient below
  penitent: TITLE_RGBA.penitent,       // PENITENT: the lozenge in the title's gold - the sword in it is its detail, below
  herald: TITLE_RGBA.herald,           // HERALD: the trumpet in the title's azure
  // SEAT1c: a palace seat's tower in the Warden's bronze (the token carries no guild's colours - Seats-Arc 7.4 asked
  // the guild's first colour), and each crown in its kingdom's metal (townSeatLaw.js KINGDOM_METALS)
  tower: TITLE_RGBA.warden,
  crownDF: Object.freeze([0.231, 0.435, 0.847, 1]),   // #3b6fd8
  crownWR: Object.freeze([0.702, 0.149, 0.180, 1]),   // #b3262e
  crownSN: Object.freeze([0.831, 0.627, 0.090, 1]),   // #d4a017
  laurel: TITLE_RGBA.arenachampion,    // ARENA4: the wreath in the Arena Champion's own green - one grant's two halves
  aegis: TITLE_RGBA.aegis,             // AEGIS: the pillars and the ring in the title's violet - the tendrils are its detail, below
  primarch: TITLE_RGBA.primarch,       // PRIMARCH: the cross in the title's light gold - GA00250: "with the same color of the name"
});

/** SHADOW-FANG: A GLYPH FILLED WITH A GRADIENT - its title's two stops,
 *  read from it and turned round, left to right across the 16x16 box. The
 *  wolf faces right, so its mane takes the crimson and its face the black
 *  its red eye burns in, as the reference's does. A glyph named here is
 *  drawn filled, outlined in its own colour (GLYPH_RGBA) at GLYPH_EDGE_W so
 *  the black half still reads over a night sky. */
export const GLYPH_GRADIENT = Object.freeze({
  shadowfang: Object.freeze([...TITLE_GRADIENT.shadowfang].reverse()),
});
/** The outline a gradient glyph wears, in the 16x16 box's units. */
export const GLYPH_EDGE_W = 0.55;

/** SHADOW-FANG: A SECOND SHAPE ON A GLYPH, in a colour of its own - the
 *  wolf's eye, an angry red slit over the black. Filled, on top.
 *  PENITENT: the sword inside the lozenge, in the title's sky - the grant's
 *  two ends, the gold round the blue. Point down, the arms reversed, as a
 *  penitent carries them: a small diamond pommel, the grip, the guard, and
 *  a long blade tapering to the lozenge's lowest point, where the sketch's
 *  meets it. */
export const GLYPH_DETAIL = Object.freeze({
  shadowfang: Object.freeze({ path: 'M9.3 4.7L11.8 5.5L9.8 6.2Z', rgba: SHADOW_EYE }),
  penitent: Object.freeze({ path: 'M8 3.2L8.65 3.85L8 4.5L7.35 3.85ZM7.45 4.5H8.55V6.3H7.45ZM5.9 6.3H10.1V7.3H5.9ZM7.25 7.3H8.75L8 14Z', rgba: PENITENT_SKY }),
  // AEGIS: THE VOID'S TENDRILS under the aegis, in the abyss's violet - Sureme's reference stands its pillars and ring
  // out of a black splash. One filled mass hung from the ring's foot: five tendrils, the outer two swept out wide and
  // low, the inner two curling down, the middle one straight down, each tapering to a point. A skirt of straight spikes
  // read as an upside-down crown and a jellyfish; in the title's lilac it read as a crown again.
  aegis: Object.freeze({ path: 'M4.4 12.9Q2.2 13.2 0.3 14.6Q2.8 14.3 5 14.3Q4 15 3 15.8Q5.4 15.3 6.6 14.5L8 15.95L9.4 14.5Q10.6 15.3 13 15.8Q12 15 11 14.3Q13.2 14.3 15.7 14.6Q13.8 13.2 11.6 12.9Q8 14 4.4 12.9Z', rgba: OBLIVION_ABYSS }),
});

/** THE CLASSIC FACE'S STAND-IN: one character, and it must be one the
 *  Daggerfall font actually has a record for or it draws as nothing at
 *  all. Held inside FONT0003's printable range by a pin. */
export const GLYPH_MARK = Object.freeze({
  sprout: '+',
  dev: '*',
  mod: '#',   // MOD1: the classic face has no shield; a hash reads as a badge at that size
  dm: '&',            // TITLE-N: one character each, inside the font's range and none another glyph's
  disciple: '~',
  apostle: '^',
  hierophant: '!',
  shadowfang: '>',    // SHADOW-FANG: the wolf's muzzle, facing the way the glyph's does
  penitent: '|',      // PENITENT: the sword's blade, one upright stroke
  herald: '<',        // HERALD: the trumpet's bell, flaring the way the glyph's does
  tower: '=',         // SEAT1c: a tower's battlement
  crownDF: 'D',       // SEAT1c: each crown its kingdom's initial
  crownWR: 'W',
  crownSN: 'S',
  laurel: '@',        // ARENA4: the wreath, a ring round the name's end
  aegis: 'O',         // AEGIS: the ring the pillars stand through - and Oblivion's initial
  primarch: 't',      // PRIMARCH: a cross with its foot turned, as the reference's footrest
});

/** The printable range the classic font covers. ACC1d-MARK's own bound,
 *  restated here because it is this table that has to stay inside it. */
export const FONT_GLYPH_MIN = 33;
export const FONT_GLYPH_MAX = 126;

/** THE DOM FACE'S REAL SHAPE, an inline SVG path on a 16x16 box, drawn
 *  in `currentColor` so the colour above is the only place a colour is
 *  decided. Paths rather than an emoji: an emoji is a font lottery -
 *  it resolves to whatever colour font the machine happens to have,
 *  at whatever weight, beside a pixel face that has neither. */
export const GLYPH_PATH = Object.freeze({
  // a sprout: a stem from the soil, one leaf each side
  sprout: 'M8 15V7M8 9C8 9 5 9 3.5 7.5S2 3 2 3s3 0 4.5 1.5S8 9 8 9zM8 8c0 0 3 0 4.5-1.5S14 2 14 2s-3 0-4.5 1.5S8 8 8 8z',
  // a developer's angle brackets
  dev: 'M5.5 4L1.5 8l4 4M10.5 4l4 4-4 4',
  // MOD1: a moderator's shield - a flat top, straight sides, a point below
  mod: 'M8 1.5L2.5 3.5v4c0 3.5 2.4 6 5.5 7 3.1-1 5.5-3.5 5.5-7v-4z',
  // TITLE-N: the Dungeon Master's twenty-sided die - the hexagon's outline, the face turned to the eye, its edges out
  dm: 'M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5zM8 4.5L4.5 10.5h7zM8 1.5v3M2.4 11.25l2.1-.75M13.6 11.25l-2.1-.75',
  // the Disciple's candle flame
  disciple: 'M8 1.5c1.6 2.6 3.5 4.1 3.5 6.8a3.5 3.5 0 0 1-7 0C4.5 5.6 6.4 4.1 8 1.5zM8 9.2c.7.9 1.2 1.6 1.2 2.4a1.2 1.2 0 0 1-2.4 0c0-.8.5-1.5 1.2-2.4z',
  // the Apostle's open book
  apostle: 'M8 4.5C6.5 3.5 4.5 3 1.5 3v9.5c3 0 5 .5 6.5 1.5 1.5-1 3.5-1.5 6.5-1.5V3c-3 0-5 .5-6.5 1.5zM8 4.5V14',
  // the Hierophant's crown
  hierophant: 'M2 13h12M2.5 13L1.8 5l3.6 3L8 2.5 10.6 8l3.6-3-.7 8',
  // SHADOW-FANG: the reference's wolf, in profile facing right - the ear raised, the brow down, the jaws open on
  // three fangs, the mane swept back in six blades and the ruff under the throat
  shadowfang: 'M15.9 6.3Q15.8 5.5 15 5.3L11.4 4.1L9.9 3.3L8.7 0.3L6.9 3.2Q4.9 2.1 2.5 2.4Q4.2 3.2 5 4.5Q2.8 4.8 1 6.3Q3.2 6.6 4.3 7.6Q2.3 8.7 1.1 10.5Q3.2 10 4.8 10.2Q3.6 11.7 3.2 13.8Q5.2 12.2 6.8 11.9Q6.3 13.4 6.5 15.3Q7.8 13.2 9.2 12.7Q9.6 14 10.4 15.2Q10.5 12.9 11.6 12L12.9 11.3L15.1 10.7L14 10.4L13.8 9.4L13.3 10.3L9.8 8.8L11.7 8.3L12.1 9.5L12.6 8.1L14.4 7.6L14.8 8.7L15.2 7.4L15.9 7Z',
  // PENITENT: Diggleborf's sketch - a tall lozenge, point up and point down, the widest a little below the middle (its
  // sword is GLYPH_DETAIL's)
  penitent: 'M8 .8L13 8.2L8 15.2L3 8.2Z',
  // HERALD: the herald's trumpet, level, its bell flaring right, and the swallowtail banner hanging from it - a
  // mouthpiece, the tube, the bell, the banner. A raised trumpet read as a pick at a name's size, and a trumpet alone
  // as a megaphone; the banner is what makes it a herald's.
  herald: 'M1.2 3.6V6.4M1.2 5H8.6M8.6 5L14.8 1.8V8.2ZM3 5V13.6L5.2 11.6L7.4 13.6V5',
  // SEAT1c: a palace seat's tower - three merlons over a shaft, a door at its foot
  tower: 'M3.5 15V6.5H2.5V2.5h2.2v1.8h1.6V2.5h3.4v1.8h1.6V2.5h2.2v4h-1V15h-3.2v-3.2a1.3 1.3 0 0 0-2.6 0V15z',
  // SEAT1c: a crown seat's crown - a jewelled band and five points, its kingdom's metal
  crownDF: 'M1.5 12.5h13V14h-13zM1.5 11.5L1 4.5l3.2 3L5.6 2.8 8 6.6l2.4-3.8 1.4 4.7 3.2-3-.5 7z',
  crownWR: 'M1.5 12.5h13V14h-13zM1.5 11.5L1 4.5l3.2 3L5.6 2.8 8 6.6l2.4-3.8 1.4 4.7 3.2-3-.5 7z',
  crownSN: 'M1.5 12.5h13V14h-13zM1.5 11.5L1 4.5l3.2 3L5.6 2.8 8 6.6l2.4-3.8 1.4 4.7 3.2-3-.5 7z',
  // ARENA4: THE LAUREL - two branches rising from a tie at the foot and curving up and out, open at the top as a
  // victor's wreath is, three leaves on each and a bud at each tip
  laurel: 'M8 14.5C4.5 13 2.5 10 3 5M8 14.5C11.5 13 13.5 10 13 5M3.2 7L1.6 6M3.6 9.6L1.8 9.4M5 12L3.4 12.6M12.8 7L14.4 6M12.4 9.6L14.2 9.4M11 12L12.6 12.6M3 5L2.4 3.2M13 5L13.6 3.2',
  // AEGIS: SUREME'S REFERENCE (the Path of Exile sigil they sent), drawn after it and not traced - a tall pillar up the
  // middle, a short pillar each side, and a wide ring lying across all three below the middle, the side pillars
  // standing at its two ends: "I O I" with the middle risen. The squared spiral the reference curls at its top right
  // read as a flag at a name's size and is left out; its black splash is GLYPH_DETAIL's tendrils.
  aegis: 'M8 0.9V10.9M3 7.2V12.8M13 7.2V12.8M3 10.2A5 2.6 0 1 0 13 10.2A5 2.6 0 1 0 3 10.2',
  // PRIMARCH: GA00250'S REFERENCE (2026-10-04, after the first push: "i'd like to that be the glyph design if possible.
  // with the same color of the name"), drawn after it - THE THREE-BARRED CROSS: the shaft the full height up the middle;
  // a short bar near its head; the long crossbar below it, the glyph's widest; and low down a footrest as wide as the head
  // bar, slanting down to the right as the reference's does. Its widths and heights the reference's, measured off it; the
  // shaft and the bars a little thicker (1.6 units against its 1.35) so the footrest's slant still reads at a name's
  // 13 px. Filled, one colour; every bar wound the shaft's way round, so where they cross it the fill is whole.
  primarch: 'M7.2 0.4H8.8V15.6H7.2ZM6 1.4H10V2.9H6ZM2.9 3.8H13.1V5.4H2.9ZM6 9.6L10 12.9V14.5L6 11.2Z',
});

/** Is this glyph DRAWN as an outline rather than filled? The sprout is
 *  a shape and the brackets are strokes; said here so the layer does
 *  not have to know which is which by name. */
export const GLYPH_STROKE = Object.freeze({ sprout: true, dev: true, mod: true, dm: true, disciple: true, apostle: true, hierophant: true, shadowfang: false, penitent: true, herald: true, tower: false, crownDF: false, crownWR: false, crownSN: false, laurel: true, aegis: true, primarch: false });   // SEAT1c: the seats' four filled; ARENA4: the laurel's branches stroked; AEGIS: the pillars and the ring stroked; PRIMARCH: the cross filled

/**
 * The title a peer wears, ready to draw: `{ key, text, rgba }`, or
 * null. It takes the peer rather than the string so every caller asks
 * the same question of the same shape, and it refuses anything the
 * vocabulary does not name - net/wire.js `readBadge` has already done
 * that at the door, and this is the second door, because a title is
 * text a stranger's relay put on my screen.
 * @param {any} peer
 */
export function titleBadge(peer) {
  const key = peer?.title;
  if (typeof key !== 'string' || !TITLES.includes(key)) return null;
  // SEAT1c: a seat title worded off its claim where this client knows the place, else its plain word
  const text = (SEAT_TITLES.includes(key) ? seatTitleText(key, peer?.ts, _seatPlace) : null) ?? TITLE_TEXT[key];
  if (!text) return null;
  return { key, text, rgba: TITLE_RGBA[key] ?? null, gradient: TITLE_GRADIENT[key] ?? null, edge: TITLE_EDGE[key] ?? null };   // PENITENT: `edge`
}

/** SHADOW-FANG: a gradient's colour at `t` along it (0 the first stop, 1
 *  the last), RGBA 0..1 - the classic face's tint for one letter of a
 *  gradient title, since a bitmap run takes a single tint. */
export function gradientAt(stops, t) {
  if (!Array.isArray(stops) || !stops.length) return null;
  if (stops.length === 1) return stops[0];
  const f = Math.max(0, Math.min(1, Number(t) || 0)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const k = f - i, a = stops[i], b = stops[i + 1];
  return [0, 1, 2, 3].map((c) => a[c] + (b[c] - a[c]) * k);
}

/** A gradient's stops as a CSS linear-gradient, left to right. */
export const cssGradient = (stops) => `linear-gradient(90deg, ${stops.map(cssRgba).join(', ')})`;

/** THE STYLE PROPERTIES A DOM FACE WRITES FOR A TITLE, every one of them
 *  every time, so a face that re-uses one element (the name over a head)
 *  clears what the title before this one set. A one-colour title is its
 *  `color`; a GRADIENT title (SHADOW-FANG) is the gradient clipped to the
 *  letters, in the loaded 500 face, with the text shadow every face gives
 *  its titles off - under a clipped background a text shadow paints OVER
 *  the letters - and an EDGE OUTSIDE each letter instead: a pixel of the
 *  title's own colour to the right and below (the classic face's own edge
 *  run) and a black one under that, so the black half still reads over a
 *  night sky (a crimson halo round the word was tried first and lost
 *  "Shadow" on every dark ground). AUDIT A4/A5: the edge was a crimson
 *  text-stroke ON the letters with a synthesised bold, which covered most
 *  of each stem - in the world the word read crimson, black in 4-15% of
 *  "Shadow"'s ink, and Mac asked for a black and crimson gradient.
 *  PENITENT: the edge is TITLE_EDGE's where it names one - black, for a
 *  word whose ends are both bright. No title: all empty. */
export const TITLE_PAINT_KEYS = Object.freeze(['color', 'backgroundImage', 'webkitBackgroundClip', 'backgroundClip', 'webkitTextFillColor', 'webkitTextStroke', 'fontWeight', 'textShadow', 'filter']);
export function titlePaint(badge) {
  const out = Object.fromEntries(TITLE_PAINT_KEYS.map((k) => [k, '']));
  if (!badge) return out;
  out.color = cssRgba(badge.rgba) ?? '';
  if (Array.isArray(badge.gradient) && badge.gradient.length > 1) {
    const edge = cssRgba(badge.edge ?? badge.rgba) ?? '';   // PENITENT: its own edge where TITLE_EDGE names one
    out.backgroundImage = cssGradient(badge.gradient);
    out.webkitBackgroundClip = 'text';
    out.backgroundClip = 'text';
    out.webkitTextFillColor = 'transparent';
    out.fontWeight = '500';
    out.textShadow = 'none';
    out.filter = `drop-shadow(1px 0 0 ${edge}) drop-shadow(0 1px 0 ${edge}) drop-shadow(0 1px 0 #000)`;
  }
  return out;
}
/** `titlePaint` written onto an element's style - the chat line's and the
 *  profile card's title, each built fresh. (The name over a head keeps
 *  its own diffing door and walks TITLE_PAINT_KEYS itself.) */
export function paintTitle(node, badge) {
  const p = titlePaint(badge);
  for (const k of TITLE_PAINT_KEYS) node.style[k] = p[k];
  return node;
}

/**
 * The glyphs a peer wears, in the vocabulary's own order rather than
 * the wire's. ORDER IS NOT A PREFERENCE: a glyph is TRUE of a player,
 * not chosen by one, so two players with the same glyphs must show
 * them the same way round - which a list taken in arrival order would
 * not guarantee.
 * @param {any} peer
 */
export function glyphBadges(peer) {
  const on = Array.isArray(peer?.glyphs) ? peer.glyphs : [];
  const out = [];
  for (const key of GLYPHS) {
    if (!on.includes(key)) continue;
    out.push({
      key, mark: GLYPH_MARK[key] ?? '', rgba: GLYPH_RGBA[key] ?? null, path: GLYPH_PATH[key] ?? '',
      gradient: GLYPH_GRADIENT[key] ?? null, detail: GLYPH_DETAIL[key] ?? null,   // SHADOW-FANG
    });
  }
  return out;
}

/** ═══ ACC3c: THE COLOURS AS A STYLESHEET ═════════════════════════
 *
 * `ui/enhancedAccount.js` may not style itself - a pin holds it, and
 * enhancedStyle.js's own header says why: two copies of a design
 * language is how the front door and the rooms behind it drift apart.
 * So the card writes a CLASS and the skin carries the colour, and the
 * skin gets the colour from HERE rather than from a hex somebody typed
 * a second time.
 *
 * WALKED, not listed: a title added to the vocabulary gets a rule
 * without anybody remembering to write one.
 */
export const badgeClass = (kind, key) => `${kind}-${key}`;
/** AEGIS: THE TITLE WHOSE PAINT AN AURA'S BUTTON WEARS on the account card - the aura's own family: the Broker's fire
 *  the Gatebreaker's, the Oblivion Ward the Aegis of Oblivion's, the Golden Radiance the Primarch's (PRIMARCH), the Holo
 *  Shadow Cloak the Shadow Fang's black and crimson (SHADOW-CLOAK), the Seraph Wings the Founder's gold - the wings' own, where
 *  the developer's paint is a red (SERAPH-WINGS). A pin walks AURA_TEXT and requires an entry. */
export const AURA_PAINT = Object.freeze({ dagonfire: 'gatebreaker', oblivionward: 'aegis', radiance: 'primarch', shadowcloak: 'shadowfang', seraphwings: 'founder' });
/** SHADOW-FANG: `titlePaint`'s properties as CSS declarations, the colour
 *  left to the button (its border is drawn in it) - so a gradient title's
 *  word on the card is the SAME paint as over a head, not a second one. */
const CSS_NAME = { backgroundImage: 'background-image', webkitBackgroundClip: '-webkit-background-clip', backgroundClip: 'background-clip', webkitTextFillColor: '-webkit-text-fill-color', webkitTextStroke: '-webkit-text-stroke', fontWeight: 'font-weight', textShadow: 'text-shadow', filter: 'filter' };
const wordCss = (t) => {
  const p = titlePaint(titleBadge({ title: t }));
  return Object.entries(CSS_NAME).filter(([k]) => p[k]).map(([k, css]) => `${css}: ${p[k]};`).join(' ');
};
export const badgeCss = () => [
  ...TITLES.map((t) => `.card button.acttitle.${badgeClass('tl', t)} { color: ${cssRgba(TITLE_RGBA[t])}; }`),
  // SHADOW-FANG: a gradient title's word (the card wraps it in .acttitleword) - the button keeps the plain colour
  ...TITLES.filter((t) => TITLE_GRADIENT[t]).map((t) => `.card button.acttitle.${badgeClass('tl', t)} .acttitleword { ${wordCss(t)} }`),
  ...GLYPHS.map((g) => `.card .acctglyph.${badgeClass('gl', g)} .acctglyphart { color: ${cssRgba(GLYPH_RGBA[g])}; }`),
  // WB9g: an aura's button wears the Gatebreaker's own fire - the Broker's two pieces are one family of colour - its
  // word (.actauraword, the aura's name: a title's word rule stays one per gradient title) painted as that title's is.
  // AEGIS: each aura in ITS title's paint (AURA_PAINT) - the Oblivion Ward in the Aegis of Oblivion's violets
  ...Object.keys(AURA_TEXT).map((a) => `.card button.acttitle.actaura.aura-${a} { color: ${cssRgba(TITLE_RGBA[AURA_PAINT[a]])}; }\n.card button.acttitle.actaura.aura-${a} .actauraword { ${wordCss(AURA_PAINT[a])} }`),
].join('\n');

/** The classic face's whole suffix: the marks, run together, or ''.
 *  One string, because that face draws a run and measures it. */
export const glyphMarks = (peer) => glyphBadges(peer).map((g) => g.mark).join('');

/** ═══ INSPECT1: ONE GLYPH AS AN SVG NODE - one drawing, every DOM face ═
 *
 * The name over a head (ui/nameLayer.js), the chat's roster and lines
 * (ui/chatPanel.js) and the profile card (ui/profileWindow.js) all
 * draw a glyph, and the first two each wrote the SVG out by hand - so
 * this is the one drawing, and a face only says how thick it draws a
 * stroke at its own size. The path and the colour are the tables
 * above; filled or stroked is GLYPH_STROKE's word. Null where the
 * document has no SVG door (an old WebView): such a document draws NO
 * glyph rather than throwing under somebody's name.
 * @param {any} doc
 * @param {{ key: string, rgba: any, path: string }} g - one of glyphBadges' records
 * @param {string} cls
 * @param {number} [strokeWidth]
 */
export function glyphSvgNode(doc, g, cls, strokeWidth = 1.8) {
  const svg = glyphArtNode(doc, g, cls, strokeWidth);
  if (svg && g.rgba) svg.style.color = cssRgba(g.rgba) ?? '';
  return svg;
}

/** Each gradient a glyph defines needs an id no other node in the
 *  document has - `url(#id)` resolves against the whole document, and a
 *  name that left the screen would take a shared one with it. */
let gradientSerial = 0;

/**
 * THE DRAWING ITSELF, WITH NO COLOUR OF ITS OWN: every shape the tables
 * above paint in `currentColor`, so the caller decides the colour - the
 * DOM faces inline (glyphSvgNode), the account card by its class (ACC3c:
 * that card may not style itself). SHADOW-FANG: a GRADIENT glyph is
 * filled with its stops (a `linearGradient` of its own, after the shape,
 * so the shape stays the first child every face and pin reads) and
 * outlined in `currentColor`; a DETAIL is drawn over it in its own colour.
 * @param {any} doc
 * @param {{ key: string, path: string, gradient?: any, detail?: any }} g
 * @param {string} cls
 * @param {number} [strokeWidth]
 */
export function glyphArtNode(doc, g, cls, strokeWidth = 1.8) {
  const svg = doc?.createElementNS?.('http://www.w3.org/2000/svg', 'svg');
  if (!svg) return null;
  const NS = 'http://www.w3.org/2000/svg';
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', g.path);
  const stops = Array.isArray(g.gradient) && g.gradient.length > 1 ? g.gradient : null;
  // `currentColor` on every shape, so the caller's colour is the one decision
  if (stops) {
    const id = `dfglyph-grad-${++gradientSerial}`;
    svg.setAttribute('overflow', 'visible');   // AUDIT A7: the edge round a shape that meets the box's side (the wolf's nose) is drawn, not cut
    path.setAttribute('fill', `url(#${id})`);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', String(GLYPH_EDGE_W));
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    const defs = doc.createElementNS(NS, 'defs');
    const grad = doc.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '16'); grad.setAttribute('y2', '0');
    stops.forEach((rgba, i) => {
      const stop = doc.createElementNS(NS, 'stop');
      stop.setAttribute('offset', String(i / (stops.length - 1)));
      stop.setAttribute('stop-color', cssRgba(rgba) ?? '');
      grad.append(stop);
    });
    defs.append(grad);
    svg.append(defs);
  } else {
    if (GLYPH_STROKE[g.key]) {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(strokeWidth));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    } else path.setAttribute('fill', 'currentColor');
    svg.append(path);
  }
  if (g.detail?.path) {
    const d = doc.createElementNS(NS, 'path');
    d.setAttribute('d', g.detail.path);
    d.setAttribute('fill', cssRgba(g.detail.rgba) ?? 'currentColor');
    svg.append(d);
  }
  return svg;
}
